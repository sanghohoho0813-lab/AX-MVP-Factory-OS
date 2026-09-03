/**
 * 고객 플랫폼 브릿지 저장소 — 고객 이벤트·연결·공개 업데이트·요청·공유 서류.
 *
 * supabase 모드: 브릿지 테이블(workspace_id RLS)과 portal_preview_project RPC.
 * local 모드: localStorage 어댑터. 고객 플랫폼이 없으므로 이벤트는 "샘플 만들기"로만 생긴다(DEMO 표시).
 *
 * 이 파일의 어떤 함수도 고객 인증을 우회하지 않는다. 고객이 보는 화면의 미리보기는
 * 고객용 투영과 같은 SQL(portal_project_projection)을 워크스페이스 멤버 권한으로 호출한 결과다.
 */

import { getDataModeConfig } from '../data/dataMode'
import { getSupabaseClient } from '../lib/supabase/client'
import { nowIso } from '../lib/appClock'
import { generateId, notifyStoreChanged, readJson, STORAGE_KEYS, writeJson } from '../storage/localStore'
import { isCustomerStage, type CustomerStage } from '../config/serviceCatalog'
import type {
  CustomerEvent,
  CustomerEventPriority,
  CustomerEventStatus,
  CustomerEventType,
  PortalClientLink,
  PortalDocument,
  PortalDocumentStatus,
  PortalProjection,
  PortalRequest,
  PortalRequestStatus,
  PortalUpdate,
  PortalUpdateCategory,
} from '../types/bridge'

/* ------------------------------------------------------------------ */
/* 표시용 사전                                                            */
/* ------------------------------------------------------------------ */

export const EVENT_TYPE_LABEL: Record<CustomerEventType, string> = {
  diagnosis_completed: '사업 진단 완료',
  consultation_requested: '상담 신청',
  service_order_created: '서비스 주문',
  document_uploaded: '서류 업로드',
  customer_request_created: '고객 요청',
  customer_action_completed: '요청 조치 완료',
  customer_reply: '고객 답변',
  profile_updated: '고객 정보 변경',
}

export const EVENT_STATUS_LABEL: Record<CustomerEventStatus, string> = {
  new: '새 이벤트',
  linked: '연결됨',
  in_progress: '처리 중',
  resolved: '처리 완료',
  ignored: '보류',
}

export const EVENT_PRIORITY_LABEL: Record<CustomerEventPriority, string> = {
  high: '지금',
  medium: '오늘 중',
  low: '참고',
}

export const UPDATE_CATEGORY_LABEL: Record<PortalUpdateCategory, string> = {
  progress: '진행 상황',
  document_request: '서류 요청',
  result: '결과 안내',
  notice: '안내',
  question: '확인 요청',
}

export const REQUEST_TYPE_LABEL: Record<PortalRequest['requestType'], string> = {
  document: '서류 문의',
  schedule: '일정 문의',
  status: '진행상태 문의',
  consultation: '추가 상담',
  info_change: '정보 수정',
  other: '기타',
}

export const REQUEST_STATUS_LABEL: Record<PortalRequestStatus, string> = {
  open: '답변 대기',
  answered: '답변함',
  resolved: '해결',
  closed: '종료',
}

export const DOCUMENT_STATUS_LABEL: Record<PortalDocumentStatus, string> = {
  requested: '요청함',
  uploaded: '고객 업로드됨',
  verified: '확인 완료',
  rejected: '다시 요청',
}

/** 이벤트 한 줄 요약 — 고객이 제출한 값만으로 만든다 */
export function eventSummary(e: CustomerEvent): { who: string; what: string } {
  const p = e.payload
  const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : '')
  const who = str('company_name') || str('company') || str('buyer_name') || str('representative_name') || str('name') || '고객'
  switch (e.eventType) {
    case 'diagnosis_completed':
      return { who, what: `사업 진단을 마쳤습니다${str('lead_grade') ? ` · 등급 ${str('lead_grade')}` : ''}` }
    case 'consultation_requested':
      return { who, what: `상담을 신청했습니다${str('program') ? ` · ${str('program')}` : ''}` }
    case 'service_order_created':
      return { who, what: `서비스를 주문했습니다 · ${str('product_slug') || '상품'}${str('order_number') ? ` (${str('order_number')})` : ''}` }
    case 'document_uploaded':
      return { who, what: `서류를 올렸습니다 · ${str('title') || str('file_name') || '파일'}` }
    case 'customer_request_created':
      return { who, what: `요청을 보냈습니다 · ${str('title') || REQUEST_TYPE_LABEL[(str('request_type') as PortalRequest['requestType']) || 'other']}` }
    case 'customer_action_completed':
      return { who, what: `요청하신 조치를 마쳤습니다 · ${str('title')}` }
    case 'customer_reply':
      return { who, what: '답변을 남겼습니다' }
    case 'profile_updated':
      return { who, what: '계정 정보를 바꿨습니다' }
  }
}

/* ------------------------------------------------------------------ */
/* 우선순위 정렬 — 설명 가능한 규칙                                       */
/* ------------------------------------------------------------------ */

const PRIORITY_RANK: Record<CustomerEventPriority, number> = { high: 0, medium: 1, low: 2 }
const STATUS_RANK: Record<CustomerEventStatus, number> = { new: 0, linked: 1, in_progress: 2, ignored: 3, resolved: 4 }

export function sortEvents(events: CustomerEvent[]): CustomerEvent[] {
  return [...events].sort((a, b) => {
    if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status]
    if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    return b.occurredAt.localeCompare(a.occurredAt)
  })
}

export function isOpenEvent(e: CustomerEvent): boolean {
  return e.status === 'new' || e.status === 'linked' || e.status === 'in_progress'
}

/* ------------------------------------------------------------------ */
/* 정규화 · 행 변환                                                        */
/* ------------------------------------------------------------------ */

function isLocal(): boolean {
  return getDataModeConfig().mode === 'local'
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}
function nul(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}

function normalizeEvent(v: Partial<CustomerEvent>): CustomerEvent {
  const now = nowIso()
  return {
    id: v.id ?? generateId(),
    workspaceId: v.workspaceId ?? null,
    portalClientLinkId: v.portalClientLinkId ?? null,
    operationsClientId: v.operationsClientId ?? null,
    profileId: v.profileId ?? null,
    eventType: (v.eventType as CustomerEventType) ?? 'customer_request_created',
    sourceType: v.sourceType ?? 'manual',
    sourceId: v.sourceId ?? generateId(),
    dedupeKey: v.dedupeKey ?? `${v.sourceType ?? 'manual'}:${v.sourceId ?? generateId()}:${v.eventType ?? 'x'}`,
    payloadVersion: v.payloadVersion ?? 1,
    payload: v.payload && typeof v.payload === 'object' ? v.payload : {},
    priority: (v.priority as CustomerEventPriority) ?? 'medium',
    status: (v.status as CustomerEventStatus) ?? 'new',
    occurredAt: v.occurredAt ?? now,
    receivedAt: v.receivedAt ?? now,
    handledAt: v.handledAt ?? null,
    handlingNote: v.handlingNote ?? '',
    createdAt: v.createdAt ?? now,
    updatedAt: v.updatedAt ?? now,
  }
}

function eventFromRow(r: Record<string, unknown>): CustomerEvent {
  return normalizeEvent({
    id: String(r.id),
    workspaceId: nul(r.workspace_id),
    portalClientLinkId: nul(r.portal_client_link_id),
    operationsClientId: nul(r.operations_client_id),
    profileId: nul(r.profile_id),
    eventType: r.event_type as CustomerEventType,
    sourceType: str(r.source_type),
    sourceId: str(r.source_id),
    dedupeKey: str(r.dedupe_key),
    payloadVersion: typeof r.payload_version === 'number' ? r.payload_version : 1,
    payload: (r.customer_safe_payload as Record<string, unknown>) ?? {},
    priority: r.priority as CustomerEventPriority,
    status: r.status as CustomerEventStatus,
    occurredAt: str(r.occurred_at),
    receivedAt: str(r.received_at),
    handledAt: nul(r.handled_at),
    handlingNote: str(r.handling_note),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  })
}

function normalizeLink(v: Partial<PortalClientLink>): PortalClientLink {
  const now = nowIso()
  return {
    id: v.id ?? generateId(),
    workspaceId: v.workspaceId ?? null,
    operationsClientId: v.operationsClientId ?? '',
    profileId: v.profileId ?? '',
    organizationId: v.organizationId ?? null,
    primaryProjectId: v.primaryProjectId ?? null,
    status: v.status ?? 'active',
    customerStage: isCustomerStage(v.customerStage) ? v.customerStage : 'preparing',
    displayName: v.displayName ?? '',
    consultantName: v.consultantName ?? '',
    linkedAt: v.linkedAt ?? now,
    createdAt: v.createdAt ?? now,
    updatedAt: v.updatedAt ?? now,
    profileEmail: v.profileEmail ?? '',
    profileName: v.profileName ?? '',
  }
}

function linkFromRow(r: Record<string, unknown>): PortalClientLink {
  const profile = (r.profiles as Record<string, unknown> | null) ?? null
  return normalizeLink({
    id: String(r.id),
    workspaceId: nul(r.workspace_id),
    operationsClientId: str(r.operations_client_id),
    profileId: str(r.profile_id),
    organizationId: nul(r.organization_id),
    primaryProjectId: nul(r.primary_project_id),
    status: r.status as PortalClientLink['status'],
    customerStage: r.customer_stage as CustomerStage,
    displayName: str(r.display_name),
    consultantName: str(r.consultant_name),
    linkedAt: str(r.linked_at),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
    profileEmail: profile ? str(profile.email) : '',
    profileName: profile ? str(profile.name) : '',
  })
}

function normalizeUpdate(v: Partial<PortalUpdate>): PortalUpdate {
  const now = nowIso()
  return {
    id: v.id ?? generateId(),
    workspaceId: v.workspaceId ?? null,
    portalClientLinkId: v.portalClientLinkId ?? '',
    projectId: v.projectId ?? null,
    category: v.category ?? 'progress',
    title: v.title ?? '',
    body: v.body ?? '',
    status: v.status ?? 'draft',
    customerActionRequired: v.customerActionRequired === true,
    customerActionLabel: v.customerActionLabel ?? '',
    dueDate: v.dueDate ?? '',
    customerCompletedAt: v.customerCompletedAt ?? null,
    publishedAt: v.publishedAt ?? null,
    createdAt: v.createdAt ?? now,
    updatedAt: v.updatedAt ?? now,
  }
}

function updateFromRow(r: Record<string, unknown>): PortalUpdate {
  return normalizeUpdate({
    id: String(r.id),
    workspaceId: nul(r.workspace_id),
    portalClientLinkId: str(r.portal_client_link_id),
    projectId: nul(r.project_id),
    category: r.category as PortalUpdateCategory,
    title: str(r.title),
    body: str(r.body),
    status: r.status as PortalUpdate['status'],
    customerActionRequired: r.customer_action_required === true,
    customerActionLabel: str(r.customer_action_label),
    dueDate: str(r.due_date),
    customerCompletedAt: nul(r.customer_completed_at),
    publishedAt: nul(r.published_at),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  })
}

function normalizeRequest(v: Partial<PortalRequest>): PortalRequest {
  const now = nowIso()
  return {
    id: v.id ?? generateId(),
    workspaceId: v.workspaceId ?? null,
    portalClientLinkId: v.portalClientLinkId ?? '',
    projectId: v.projectId ?? null,
    requestType: v.requestType ?? 'other',
    title: v.title ?? '',
    body: v.body ?? '',
    status: v.status ?? 'open',
    answer: v.answer ?? '',
    createdAt: v.createdAt ?? now,
    answeredAt: v.answeredAt ?? null,
    resolvedAt: v.resolvedAt ?? null,
    updatedAt: v.updatedAt ?? now,
  }
}

function requestFromRow(r: Record<string, unknown>): PortalRequest {
  return normalizeRequest({
    id: String(r.id),
    workspaceId: nul(r.workspace_id),
    portalClientLinkId: str(r.portal_client_link_id),
    projectId: nul(r.project_id),
    requestType: r.request_type as PortalRequest['requestType'],
    title: str(r.title),
    body: str(r.body),
    status: r.status as PortalRequestStatus,
    answer: str(r.answer),
    createdAt: str(r.created_at),
    answeredAt: nul(r.answered_at),
    resolvedAt: nul(r.resolved_at),
    updatedAt: str(r.updated_at),
  })
}

function normalizeDocument(v: Partial<PortalDocument>): PortalDocument {
  const now = nowIso()
  return {
    id: v.id ?? generateId(),
    workspaceId: v.workspaceId ?? null,
    portalClientLinkId: v.portalClientLinkId ?? '',
    projectId: v.projectId ?? null,
    operationsClientId: v.operationsClientId ?? '',
    documentType: v.documentType ?? 'other',
    title: v.title ?? '',
    storagePath: v.storagePath ?? '',
    fileName: v.fileName ?? '',
    fileSize: v.fileSize ?? null,
    mimeType: v.mimeType ?? '',
    source: v.source ?? 'internal',
    visibility: v.visibility ?? 'internal_only',
    status: v.status ?? 'requested',
    customerNote: v.customerNote ?? '',
    internalNote: v.internalNote ?? '',
    requestedAt: v.requestedAt ?? null,
    uploadedAt: v.uploadedAt ?? null,
    verifiedAt: v.verifiedAt ?? null,
    createdAt: v.createdAt ?? now,
    updatedAt: v.updatedAt ?? now,
  }
}

function documentFromRow(r: Record<string, unknown>): PortalDocument {
  return normalizeDocument({
    id: String(r.id),
    workspaceId: nul(r.workspace_id),
    portalClientLinkId: str(r.portal_client_link_id),
    projectId: nul(r.project_id),
    operationsClientId: str(r.operations_client_id),
    documentType: str(r.document_type),
    title: str(r.title),
    storagePath: str(r.storage_path),
    fileName: str(r.file_name),
    fileSize: typeof r.file_size === 'number' ? r.file_size : null,
    mimeType: str(r.mime_type),
    source: r.source as PortalDocument['source'],
    visibility: r.visibility as PortalDocument['visibility'],
    status: r.status as PortalDocumentStatus,
    customerNote: str(r.customer_note),
    internalNote: str(r.internal_note),
    requestedAt: nul(r.requested_at),
    uploadedAt: nul(r.uploaded_at),
    verifiedAt: nul(r.verified_at),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  })
}

/* ------------------------------------------------------------------ */
/* 로컬 어댑터                                                            */
/* ------------------------------------------------------------------ */

const local = {
  events: () => readJson<Partial<CustomerEvent>[]>(STORAGE_KEYS.customerEvents, []).map(normalizeEvent),
  links: () => readJson<Partial<PortalClientLink>[]>(STORAGE_KEYS.portalLinks, []).map(normalizeLink),
  updates: () => readJson<Partial<PortalUpdate>[]>(STORAGE_KEYS.portalUpdates, []).map(normalizeUpdate),
  requests: () => readJson<Partial<PortalRequest>[]>(STORAGE_KEYS.portalRequests, []).map(normalizeRequest),
  documents: () => readJson<Partial<PortalDocument>[]>(STORAGE_KEYS.portalDocuments, []).map(normalizeDocument),
  write(key: string, value: unknown) {
    writeJson(key, value)
    notifyStoreChanged()
  },
}

/* ------------------------------------------------------------------ */
/* 고객 이벤트                                                            */
/* ------------------------------------------------------------------ */

export async function listEvents(workspaceId: string | null): Promise<CustomerEvent[]> {
  if (isLocal()) return sortEvents(local.events())
  if (!workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const { data, error } = await getSupabaseClient()
    .from('customer_events')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('occurred_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return sortEvents((data ?? []).map((r) => eventFromRow(r as Record<string, unknown>)))
}

export async function updateEvent(
  event: CustomerEvent,
  patch: Partial<Pick<CustomerEvent, 'status' | 'handlingNote' | 'portalClientLinkId' | 'operationsClientId'>>,
): Promise<CustomerEvent> {
  const next = normalizeEvent({ ...event, ...patch, updatedAt: nowIso() })
  if (patch.status === 'resolved' || patch.status === 'ignored') next.handledAt = event.handledAt ?? nowIso()
  if (patch.status === 'new' || patch.status === 'linked' || patch.status === 'in_progress') next.handledAt = null
  if (isLocal()) {
    local.write(STORAGE_KEYS.customerEvents, local.events().map((e) => (e.id === next.id ? next : e)))
    return next
  }
  const { data, error } = await getSupabaseClient()
    .from('customer_events')
    .update({
      status: next.status,
      handling_note: next.handlingNote,
      portal_client_link_id: next.portalClientLinkId,
      operations_client_id: next.operationsClientId,
      handled_at: next.handledAt,
    })
    .eq('id', event.id)
    .select()
    .single()
  if (error) throw error
  return eventFromRow(data as Record<string, unknown>)
}

/**
 * 로컬 데모 전용 — 고객 플랫폼이 없는 로컬 모드에서 흐름을 보여주기 위한 샘플 이벤트.
 * payload 에 demo:true 를 넣어 화면에서 DEMO 로 표시한다. supabase 모드에서는 동작하지 않는다.
 */
export function seedDemoEvents(): CustomerEvent[] {
  if (!isLocal()) throw new Error('샘플 이벤트는 로컬 데모 모드에서만 만들 수 있습니다.')
  const now = nowIso()
  const samples: Partial<CustomerEvent>[] = [
    {
      eventType: 'diagnosis_completed',
      sourceType: 'demo_lead',
      sourceId: 'demo-lead-1',
      priority: 'high',
      payload: { demo: true, company_name: '한빛정밀(샘플)', representative_name: '김대표', phone: '010-0000-0001', email: 'demo1@example.com', industry: '제조업', business_type: 'corp', lead_grade: 'A' },
      occurredAt: now,
    },
    {
      eventType: 'service_order_created',
      sourceType: 'demo_order',
      sourceId: 'demo-order-1',
      priority: 'high',
      payload: { demo: true, order_number: 'SO-DEMO-0001', product_slug: 'venture-certification', company_name: '푸른물류(샘플)', buyer_name: '이대표', buyer_email: 'demo2@example.com', status: 'payment_confirmed' },
      occurredAt: now,
    },
    {
      eventType: 'customer_request_created',
      sourceType: 'demo_request',
      sourceId: 'demo-request-1',
      priority: 'medium',
      payload: { demo: true, company_name: '한빛정밀(샘플)', request_type: 'status', title: '벤처인증 진행 상황이 궁금합니다' },
      occurredAt: now,
    },
  ]
  const existing = local.events()
  const created = samples
    .map((s) => normalizeEvent({ ...s, dedupeKey: `${s.sourceType}:${s.sourceId}:${s.eventType}` }))
    .filter((e) => !existing.some((x) => x.dedupeKey === e.dedupeKey))
  local.write(STORAGE_KEYS.customerEvents, [...created, ...existing])
  return created
}

/* ------------------------------------------------------------------ */
/* 연결                                                                    */
/* ------------------------------------------------------------------ */

const LINK_SELECT = '*, profiles:profile_id(email)'

export async function listLinks(workspaceId: string | null): Promise<PortalClientLink[]> {
  if (isLocal()) return local.links()
  if (!workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const { data, error } = await getSupabaseClient()
    .from('portal_client_links')
    .select(LINK_SELECT)
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => linkFromRow(r as Record<string, unknown>))
}

export async function listLinksForClient(workspaceId: string | null, clientId: string): Promise<PortalClientLink[]> {
  const all = await listLinks(workspaceId)
  return all.filter((l) => l.operationsClientId === clientId)
}

/** 고객 계정 찾기 — 이메일로. 후보를 보여줄 뿐 자동으로 연결하지 않는다. */
export async function findProfileByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const q = email.trim().toLowerCase()
  if (!q) return null
  if (isLocal()) {
    // 로컬 데모: 이메일을 그대로 가짜 계정으로 취급한다(DEMO)
    return { id: `demo-profile:${q}`, email: q }
  }
  const { data, error } = await getSupabaseClient().from('profiles').select('id, email').ilike('email', q).limit(1)
  if (error) throw new Error('고객 계정을 조회하지 못했습니다. 관리자 권한이 필요할 수 있습니다.')
  const row = (data ?? [])[0] as { id: string; email: string } | undefined
  return row ? { id: row.id, email: row.email } : null
}

export async function createLink(
  workspaceId: string | null,
  input: { operationsClientId: string; profileId: string; profileEmail: string; displayName?: string; consultantName?: string; customerStage?: CustomerStage },
): Promise<PortalClientLink> {
  const link = normalizeLink({
    workspaceId,
    operationsClientId: input.operationsClientId,
    profileId: input.profileId,
    profileEmail: input.profileEmail,
    displayName: input.displayName ?? '',
    consultantName: input.consultantName ?? '',
    customerStage: input.customerStage ?? 'preparing',
  })
  if (isLocal()) {
    const existing = local.links()
    if (existing.some((l) => l.operationsClientId === link.operationsClientId && l.profileId === link.profileId)) {
      throw new Error('이미 연결된 계정입니다.')
    }
    local.write(STORAGE_KEYS.portalLinks, [link, ...existing])
    return link
  }
  if (!workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const { data, error } = await getSupabaseClient()
    .from('portal_client_links')
    .insert({
      workspace_id: workspaceId,
      operations_client_id: link.operationsClientId,
      profile_id: link.profileId,
      display_name: link.displayName || null,
      consultant_name: link.consultantName || null,
      customer_stage: link.customerStage,
    })
    .select(LINK_SELECT)
    .single()
  if (error) throw error
  return linkFromRow(data as Record<string, unknown>)
}

export async function updateLink(
  link: PortalClientLink,
  patch: Partial<Pick<PortalClientLink, 'status' | 'customerStage' | 'displayName' | 'consultantName'>>,
): Promise<PortalClientLink> {
  const next = normalizeLink({ ...link, ...patch, updatedAt: nowIso() })
  if (isLocal()) {
    local.write(STORAGE_KEYS.portalLinks, local.links().map((l) => (l.id === next.id ? next : l)))
    return next
  }
  const { data, error } = await getSupabaseClient()
    .from('portal_client_links')
    .update({
      status: next.status,
      customer_stage: next.customerStage,
      display_name: next.displayName || null,
      consultant_name: next.consultantName || null,
    })
    .eq('id', link.id)
    .select(LINK_SELECT)
    .single()
  if (error) throw error
  return linkFromRow(data as Record<string, unknown>)
}

/* ------------------------------------------------------------------ */
/* 공개 업데이트 — 명시 발행 모델                                          */
/* ------------------------------------------------------------------ */

export async function listUpdates(workspaceId: string | null, linkId: string): Promise<PortalUpdate[]> {
  if (isLocal()) return local.updates().filter((u) => u.portalClientLinkId === linkId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  if (!workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const { data, error } = await getSupabaseClient()
    .from('portal_updates')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('portal_client_link_id', linkId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => updateFromRow(r as Record<string, unknown>))
}

export interface PublishUpdateInput {
  linkId: string
  category: PortalUpdateCategory
  title: string
  body: string
  customerActionRequired: boolean
  customerActionLabel?: string
  dueDate?: string
  /** 함께 바꿀 고객 공개 단계 (선택) */
  customerStage?: CustomerStage
}

/** "고객에게 공개" — 초안 저장이 아니라 바로 published 로 만든다. 취소는 archive 로. */
export async function publishUpdate(workspaceId: string | null, input: PublishUpdateInput): Promise<PortalUpdate> {
  const title = input.title.trim()
  if (!title) throw new Error('제목을 입력해 주세요.')
  const now = nowIso()
  const update = normalizeUpdate({
    workspaceId,
    portalClientLinkId: input.linkId,
    category: input.category,
    title,
    body: input.body.trim(),
    status: 'published',
    customerActionRequired: input.customerActionRequired,
    customerActionLabel: input.customerActionLabel?.trim() ?? '',
    dueDate: input.dueDate ?? '',
    publishedAt: now,
  })
  if (isLocal()) {
    local.write(STORAGE_KEYS.portalUpdates, [update, ...local.updates()])
    if (input.customerStage) {
      local.write(
        STORAGE_KEYS.portalLinks,
        local.links().map((l) => (l.id === input.linkId ? { ...l, customerStage: input.customerStage as CustomerStage, updatedAt: now } : l)),
      )
    }
    return update
  }
  if (!workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('portal_updates')
    .insert({
      workspace_id: workspaceId,
      portal_client_link_id: update.portalClientLinkId,
      category: update.category,
      title: update.title,
      body: update.body,
      status: 'published',
      customer_action_required: update.customerActionRequired,
      customer_action_label: update.customerActionLabel || null,
      due_date: update.dueDate || null,
      published_at: now,
    })
    .select()
    .single()
  if (error) throw error
  if (input.customerStage) {
    const { error: stageError } = await client
      .from('portal_client_links')
      .update({ customer_stage: input.customerStage })
      .eq('id', input.linkId)
    if (stageError) throw stageError
  }
  return updateFromRow(data as Record<string, unknown>)
}

export async function archiveUpdate(update: PortalUpdate): Promise<PortalUpdate> {
  const next = normalizeUpdate({ ...update, status: 'archived', updatedAt: nowIso() })
  if (isLocal()) {
    local.write(STORAGE_KEYS.portalUpdates, local.updates().map((u) => (u.id === next.id ? next : u)))
    return next
  }
  const { data, error } = await getSupabaseClient().from('portal_updates').update({ status: 'archived' }).eq('id', update.id).select().single()
  if (error) throw error
  return updateFromRow(data as Record<string, unknown>)
}

/* ------------------------------------------------------------------ */
/* 고객 요청                                                               */
/* ------------------------------------------------------------------ */

export async function listRequests(workspaceId: string | null, linkId: string): Promise<PortalRequest[]> {
  if (isLocal()) return local.requests().filter((r) => r.portalClientLinkId === linkId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (!workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const { data, error } = await getSupabaseClient()
    .from('portal_requests')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('portal_client_link_id', linkId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => requestFromRow(r as Record<string, unknown>))
}

export async function answerRequest(request: PortalRequest, answer: string, status: PortalRequestStatus): Promise<PortalRequest> {
  const now = nowIso()
  const next = normalizeRequest({
    ...request,
    answer: answer.trim(),
    status,
    answeredAt: answer.trim() ? (request.answeredAt ?? now) : request.answeredAt,
    resolvedAt: status === 'resolved' || status === 'closed' ? (request.resolvedAt ?? now) : null,
    updatedAt: now,
  })
  if (isLocal()) {
    local.write(STORAGE_KEYS.portalRequests, local.requests().map((r) => (r.id === next.id ? next : r)))
    return next
  }
  const { data, error } = await getSupabaseClient()
    .from('portal_requests')
    .update({ answer: next.answer || null, status: next.status, answered_at: next.answeredAt, resolved_at: next.resolvedAt })
    .eq('id', request.id)
    .select()
    .single()
  if (error) throw error
  return requestFromRow(data as Record<string, unknown>)
}

/** 로컬 데모 전용 — 고객이 보낸 요청을 흉내 낸다 */
export function seedDemoRequest(linkId: string, workspaceId: string | null): PortalRequest {
  if (!isLocal()) throw new Error('로컬 데모 모드에서만 만들 수 있습니다.')
  const request = normalizeRequest({
    workspaceId,
    portalClientLinkId: linkId,
    requestType: 'status',
    title: '진행 상황이 궁금합니다 (샘플)',
    body: '지난주 서류를 보냈는데 다음 단계가 무엇인지 알고 싶습니다.',
  })
  local.write(STORAGE_KEYS.portalRequests, [request, ...local.requests()])
  const event = normalizeEvent({
    workspaceId,
    portalClientLinkId: linkId,
    eventType: 'customer_request_created',
    sourceType: 'portal_request',
    sourceId: request.id,
    dedupeKey: `portal_request:${request.id}:customer_request_created`,
    priority: 'medium',
    status: 'linked',
    payload: { demo: true, request_type: request.requestType, title: request.title, body: request.body },
  })
  local.write(STORAGE_KEYS.customerEvents, [event, ...local.events()])
  return request
}

/* ------------------------------------------------------------------ */
/* 공유 서류                                                               */
/* ------------------------------------------------------------------ */

export async function listDocuments(workspaceId: string | null, linkId: string): Promise<PortalDocument[]> {
  if (isLocal()) return local.documents().filter((d) => d.portalClientLinkId === linkId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  if (!workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const { data, error } = await getSupabaseClient()
    .from('portal_documents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('portal_client_link_id', linkId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => documentFromRow(r as Record<string, unknown>))
}

/** 고객에게 서류를 요청한다 — 고객 화면 "요청받은 서류"에 나타난다 */
export async function requestDocument(
  workspaceId: string | null,
  input: { linkId: string; operationsClientId: string; documentType: string; title: string; customerNote?: string },
): Promise<PortalDocument> {
  const title = input.title.trim()
  if (!title) throw new Error('서류 이름을 입력해 주세요.')
  const now = nowIso()
  const doc = normalizeDocument({
    workspaceId,
    portalClientLinkId: input.linkId,
    operationsClientId: input.operationsClientId,
    documentType: input.documentType,
    title,
    source: 'internal',
    visibility: 'internal_only',
    status: 'requested',
    customerNote: input.customerNote?.trim() ?? '',
    requestedAt: now,
  })
  if (isLocal()) {
    local.write(STORAGE_KEYS.portalDocuments, [doc, ...local.documents()])
    return doc
  }
  if (!workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const { data, error } = await getSupabaseClient()
    .from('portal_documents')
    .insert({
      workspace_id: workspaceId,
      portal_client_link_id: doc.portalClientLinkId,
      operations_client_id: doc.operationsClientId,
      document_type: doc.documentType,
      title: doc.title,
      source: 'internal',
      visibility: 'internal_only',
      status: 'requested',
      customer_note: doc.customerNote || null,
      requested_at: now,
    })
    .select()
    .single()
  if (error) throw error
  return documentFromRow(data as Record<string, unknown>)
}

/** 고객이 올린 서류를 확인 완료 / 다시 요청으로 처리한다 (업로드됨 ≠ 검토완료) */
export async function reviewDocument(doc: PortalDocument, status: 'verified' | 'rejected', internalNote = ''): Promise<PortalDocument> {
  const now = nowIso()
  const next = normalizeDocument({
    ...doc,
    status,
    internalNote: internalNote.trim() || doc.internalNote,
    verifiedAt: status === 'verified' ? now : null,
    updatedAt: now,
  })
  if (isLocal()) {
    local.write(STORAGE_KEYS.portalDocuments, local.documents().map((d) => (d.id === next.id ? next : d)))
    return next
  }
  const { data, error } = await getSupabaseClient()
    .from('portal_documents')
    .update({ status: next.status, internal_note: next.internalNote || null, verified_at: next.verifiedAt })
    .eq('id', doc.id)
    .select()
    .single()
  if (error) throw error
  return documentFromRow(data as Record<string, unknown>)
}

/** 내부 파일을 고객에게 공유한다 (storage 정책이 visibility 를 참조하므로 이 한 줄이 곧 권한이다) */
export async function shareDocument(
  workspaceId: string | null,
  input: { linkId: string; operationsClientId: string; documentType: string; title: string; storagePath: string; fileName: string },
): Promise<PortalDocument> {
  const now = nowIso()
  const doc = normalizeDocument({
    workspaceId,
    portalClientLinkId: input.linkId,
    operationsClientId: input.operationsClientId,
    documentType: input.documentType,
    title: input.title.trim() || input.fileName,
    storagePath: input.storagePath,
    fileName: input.fileName,
    source: 'internal',
    visibility: 'shared_with_customer',
    status: 'verified',
    verifiedAt: now,
    uploadedAt: now,
  })
  if (isLocal()) {
    local.write(STORAGE_KEYS.portalDocuments, [doc, ...local.documents()])
    return doc
  }
  if (!workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const { data, error } = await getSupabaseClient()
    .from('portal_documents')
    .insert({
      workspace_id: workspaceId,
      portal_client_link_id: doc.portalClientLinkId,
      operations_client_id: doc.operationsClientId,
      document_type: doc.documentType,
      title: doc.title,
      storage_path: doc.storagePath,
      file_name: doc.fileName,
      source: 'internal',
      visibility: 'shared_with_customer',
      status: 'verified',
      verified_at: now,
      uploaded_at: now,
    })
    .select()
    .single()
  if (error) throw error
  return documentFromRow(data as Record<string, unknown>)
}

/** 로컬 데모 전용 — 고객이 요청받은 서류를 올린 것으로 흉내 낸다 */
export function seedDemoUpload(doc: PortalDocument): PortalDocument {
  if (!isLocal()) throw new Error('로컬 데모 모드에서만 만들 수 있습니다.')
  const now = nowIso()
  const next = normalizeDocument({
    ...doc,
    source: 'customer',
    visibility: 'customer_uploaded',
    status: 'uploaded',
    fileName: `${doc.title}.pdf`,
    storagePath: `demo/portal/${doc.portalClientLinkId}/${doc.id}.pdf`,
    uploadedAt: now,
    updatedAt: now,
  })
  local.write(STORAGE_KEYS.portalDocuments, local.documents().map((d) => (d.id === next.id ? next : d)))
  const event = normalizeEvent({
    workspaceId: doc.workspaceId,
    portalClientLinkId: doc.portalClientLinkId,
    eventType: 'document_uploaded',
    sourceType: 'portal_document',
    sourceId: `${doc.id}:${now}`,
    dedupeKey: `portal_document:${doc.id}:${now}:document_uploaded`,
    priority: 'high',
    status: 'linked',
    payload: { demo: true, document_type: doc.documentType, title: doc.title, file_name: next.fileName },
  })
  local.write(STORAGE_KEYS.customerEvents, [event, ...local.events()])
  return next
}

/* ------------------------------------------------------------------ */
/* 고객 화면 미리보기 — 고객이 보는 것과 같은 투영                          */
/* ------------------------------------------------------------------ */

/**
 * 로컬 모드에서도 같은 규칙으로 투영을 만든다. supabase 의 portal_project_projection 과
 * 필드·필터가 같아야 하며, 브릿지 계약 테스트가 둘의 동치를 확인한다.
 */
export function buildProjection(
  link: PortalClientLink,
  companyName: string,
  updates: PortalUpdate[],
  documents: PortalDocument[],
  requests: PortalRequest[],
): PortalProjection {
  const published = updates
    .filter((u) => u.status === 'published')
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
  const latestPublished = published[0]?.publishedAt ?? null
  return {
    project: {
      link_id: link.id,
      name: link.displayName.trim() || companyName,
      company_name: companyName,
      stage: link.customerStage,
      status: link.status,
      consultant_name: link.consultantName || null,
      updated_at: latestPublished && latestPublished > link.updatedAt ? latestPublished : link.updatedAt,
    },
    updates: published.map((u) => ({
      id: u.id,
      category: u.category,
      title: u.title,
      body: u.body,
      action_required: u.customerActionRequired,
      action_label: u.customerActionLabel || null,
      due_date: u.dueDate || null,
      completed_at: u.customerCompletedAt,
      published_at: u.publishedAt ?? u.createdAt,
    })),
    documents: documents
      .filter((d) => d.status === 'requested' || d.visibility === 'customer_uploaded' || d.visibility === 'shared_with_customer')
      .sort((a, b) => {
        if ((a.status === 'requested') !== (b.status === 'requested')) return a.status === 'requested' ? -1 : 1
        return (b.uploadedAt ?? b.requestedAt ?? b.createdAt).localeCompare(a.uploadedAt ?? a.requestedAt ?? a.createdAt)
      })
      .map((d) => ({
        id: d.id,
        document_type: d.documentType,
        title: d.title,
        status: d.status,
        visibility: d.visibility,
        file_name: d.fileName || null,
        storage_path: d.visibility === 'customer_uploaded' || d.visibility === 'shared_with_customer' ? d.storagePath || null : null,
        customer_note: d.customerNote || null,
        requested_at: d.requestedAt,
        uploaded_at: d.uploadedAt,
        verified_at: d.verifiedAt,
      })),
    requests: [...requests]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => ({
        id: r.id,
        request_type: r.requestType,
        title: r.title,
        body: r.body,
        status: r.status,
        answer: r.answer || null,
        created_at: r.createdAt,
        answered_at: r.answeredAt,
      })),
  }
}

export async function previewProjection(workspaceId: string | null, link: PortalClientLink, companyName: string): Promise<PortalProjection> {
  if (isLocal()) {
    return buildProjection(
      link,
      companyName,
      local.updates().filter((u) => u.portalClientLinkId === link.id),
      local.documents().filter((d) => d.portalClientLinkId === link.id),
      local.requests().filter((r) => r.portalClientLinkId === link.id),
    )
  }
  void workspaceId
  const { data, error } = await getSupabaseClient().rpc('portal_preview_project', { p_link_id: link.id })
  if (error) throw error
  return data as PortalProjection
}
