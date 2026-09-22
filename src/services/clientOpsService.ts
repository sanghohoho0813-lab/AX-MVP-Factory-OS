/**
 * 고객사 운영 저장소 — 통합 모델(ClientOpsRecord) 읽기·쓰기.
 *
 * 저장 키는 기존과 동일(STORAGE_KEYS.operationsClients)하게 유지하고,
 * 예전 형식(tasks/contractDeposit/successFee)으로 저장된 값은 읽을 때
 * 자동으로 새 형식으로 승격한다. 기존에 입력한 내용은 사라지지 않는다.
 */

import { getDataModeConfig } from '../data/dataMode'
import { getSupabaseClient } from '../lib/supabase/client'
import { generateId, notifyStoreChanged, readJson, STORAGE_KEYS, writeJson } from '../storage/localStore'
import { nowIso } from '../lib/appClock'
import { formatFileSize } from '../lib/format'
import {
  DOCUMENTS,
  FEE_KIND_LABEL,
  SERVICES,
  serviceMeta,
  normalizeServiceStatus,
} from '../content/clientOpsCatalog'
import {
  ACTIVITY_LIMIT,
  documentFileText,
  documentReceivedText,
  feeReceivedText,
  fundingStatusText,
  serviceDueText,
  serviceStatusText,
  withActivity,
} from './clientOpsActivity'
import type {
  ToolDeadline,
  ToolResult,
  ActivityEntry,
  ClientNote,
  ClientOpsRecord,
  ContractInfo,
  CustomDocument,
  CustomProfileField,
  FundingApplication,
  FundingStatus,
  ClientOpsStatus,
  CreateClientOpsInput,
  DocumentKey,
  DocumentState,
  FeeItem,
  ProfileGroupKey,
  ServiceKey,
  ServiceState,
} from '../types/clientOps'
import { CONTRACT_KIND_LABEL, emptyContract, isCustomDocumentKey, isCustomServiceKey, isProfileGroupKey } from '../types/clientOps'
import { documentMetaOf, makeCustomDocumentKey } from './clientOpsDocuments'

/* ------------------------------------------------------------------ */
/* 기본값 · 정규화 (예전 형식 자동 승격 포함)                            */
/* ------------------------------------------------------------------ */

function defaultService(): ServiceState {
  return {
    status: 'not_started',
    dueDate: '',
    nextStep: '',
    note: '',
    startedAt: null,
    completedAt: null,
    waitingSince: null,
  }
}

function defaultServices(): Record<ServiceKey, ServiceState> {
  return Object.fromEntries(SERVICES.map((s) => [s.key, defaultService()])) as Record<
    ServiceKey,
    ServiceState
  >
}

function defaultDocument(): DocumentState {
  return { received: false, issuedAt: '', fileName: '', fileSize: 0, storagePath: '', note: '', updatedAt: null }
}

function defaultDocuments(): Record<DocumentKey, DocumentState> {
  return Object.fromEntries(DOCUMENTS.map((d) => [d.key, defaultDocument()])) as Record<
    DocumentKey,
    DocumentState
  >
}

/** 예전 형식의 한 조각 (읽기 전용 승격에만 사용) */
interface LegacyShape {
  tasks?: Record<string, { completed?: boolean; dueDate?: string; note?: string }>
  contractDepositAmount?: number | null
  contractDepositReceived?: boolean
  successFeeAmount?: number | null
  successFeeReceived?: boolean
  fundingStatus?: string
  fundingNote?: string
}

function upgradeServices(
  raw: Partial<ClientOpsRecord> & LegacyShape,
): Record<ServiceKey, ServiceState> {
  const base = defaultServices()

  // 새 형식이 이미 있으면 그것을 우선 사용
  if (raw.services && typeof raw.services === 'object') {
    const stored = raw.services as Record<string, Partial<ServiceState>>
    // 직접 만든 항목이 아직 목록에 올라오기 전에 저장되는 일이 없도록,
    // 저장돼 있던 custom_ 키는 목록에 없어도 그대로 지킨다.
    const keys = new Set<ServiceKey>([...SERVICES.map((s) => s.key), ...Object.keys(stored).filter(isCustomServiceKey)])
    for (const key of keys) {
      const v = stored[key]
      base[key] ??= defaultService()
      if (!v) continue
      // 저장된 값이 예전 8단계일 수 있다 — 읽는 자리에서 현재 5단계로 옮긴다
      base[key] = { ...base[key], ...v, status: normalizeServiceStatus(v.status) }
    }
    return base
  }

  // 예전 tasks → services 승격 (completed:true → 완료)
  if (raw.tasks && typeof raw.tasks === 'object') {
    for (const s of SERVICES) {
      const legacy = raw.tasks[s.key]
      if (!legacy) continue
      base[s.key] = {
        ...base[s.key],
        status: legacy.completed ? 'done' : 'not_started',
        dueDate: typeof legacy.dueDate === 'string' ? legacy.dueDate : '',
        note: typeof legacy.note === 'string' ? legacy.note : '',
        completedAt: legacy.completed ? nowIso() : null,
      }
    }
  }

  // 예전 정책자금 자유 입력 → policyFund 업무 메모로 이관
  const fundingText = [raw.fundingStatus, raw.fundingNote].filter(Boolean).join(' / ').trim()
  if (fundingText) {
    base.policyFund = {
      ...base.policyFund,
      status: base.policyFund.status === 'not_started' ? 'in_progress' : base.policyFund.status,
      note: [base.policyFund.note, fundingText].filter(Boolean).join('\n'),
    }
  }

  return base
}

/**
 * 계약 정보 정규화.
 * 계약 칸이 없던 시절의 기록에는 아예 없으므로 빈 계약으로 채운다(기존 데이터 영향 0).
 */
function normalizeContract(raw: unknown): ContractInfo {
  if (raw === null || typeof raw !== 'object') return emptyContract()
  const c = raw as Partial<ContractInfo>
  const kind = c.kind === 'cash' || c.kind === 'insurance' || c.kind === 'mixed' ? c.kind : ''
  return {
    signedAt: typeof c.signedAt === 'string' ? c.signedAt : '',
    kind,
    cashAmount: typeof c.cashAmount === 'number' && Number.isFinite(c.cashAmount) ? c.cashAmount : null,
    policies: Array.isArray(c.policies)
      ? c.policies.map((p) => ({
          id: typeof p?.id === 'string' && p.id !== '' ? p.id : generateId(),
          insurer: typeof p?.insurer === 'string' ? p.insurer : '',
          productName: typeof p?.productName === 'string' ? p.productName : '',
          monthlyPremium: typeof p?.monthlyPremium === 'number' && Number.isFinite(p.monthlyPremium) ? p.monthlyPremium : null,
          startedAt: typeof p?.startedAt === 'string' ? p.startedAt : '',
          payTerm: typeof p?.payTerm === 'string' ? p.payTerm : '',
          note: typeof p?.note === 'string' ? p.note : '',
        }))
      : [],
    note: typeof c.note === 'string' ? c.note : '',
  }
}

/**
 * 직접 만든 칸 정규화.
 * 이 기능이 없던 시절의 기록에는 아예 없으므로 빈 배열이 된다(기존 데이터 영향 0).
 * 묶음 이름이 이상하면 '회사' 로 보낸다 — 칸을 잃어버리느니 자리를 옮긴다.
 */
function normalizeCustomFields(raw: unknown): CustomProfileField[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((f) => ({
      id: typeof f?.id === 'string' && f.id !== '' ? f.id : generateId(),
      group: isProfileGroupKey(f?.group) ? f.group : ('identity' as const),
      label: typeof f?.label === 'string' ? f.label : '',
      value: typeof f?.value === 'string' ? f.value : '',
    }))
    .filter((f) => f.label.trim() !== '')
}

/**
 * 직접 만든 서류 칸 정규화 (D-82).
 * 이 기능이 없던 시절의 기록에는 아예 없으므로 빈 배열이 된다(기존 데이터 영향 0).
 * 이름이 비어 있으면 버린다 — 이름 없는 칸은 화면에서 구분할 수 없다.
 */
function normalizeCustomDocuments(raw: unknown): CustomDocument[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((d) => ({
      id: typeof d?.id === 'string' && d.id !== '' ? d.id : generateId(),
      key: typeof d?.key === 'string' && d.key !== '' ? d.key : makeCustomDocumentKey(),
      label: typeof d?.label === 'string' ? d.label.trim() : '',
      validMonths:
        typeof d?.validMonths === 'number' && Number.isFinite(d.validMonths) && d.validMonths > 0
          ? Math.round(d.validMonths)
          : null,
      sensitive: d?.sensitive === true,
    }))
    .filter((d) => d.label !== '')
}

function upgradeFees(raw: Partial<ClientOpsRecord> & LegacyShape): FeeItem[] {
  if (Array.isArray(raw.fees)) {
    return raw.fees.map((f) => ({
      id: f.id ?? generateId(),
      serviceKey: f.serviceKey ?? null,
      kind: f.kind ?? 'deposit',
      label: f.label ?? FEE_KIND_LABEL[f.kind ?? 'deposit'],
      amount: typeof f.amount === 'number' ? f.amount : null,
      // 영업자 수수료 칸이 없던 시절의 기록에는 아예 없다 — null 이면 '수수료 없음' 이다
      agentFee: typeof f.agentFee === 'number' && Number.isFinite(f.agentFee) ? f.agentFee : null,
      agentName: typeof f.agentName === 'string' ? f.agentName : '',
      agentPaidAt: typeof f.agentPaidAt === 'string' ? f.agentPaidAt : null,
      dueDate: typeof f.dueDate === 'string' ? f.dueDate : '',
      receivedAt: typeof f.receivedAt === 'string' ? f.receivedAt : null,
      note: f.note ?? '',
    }))
  }

  // 예전 계약금·성공보수 두 칸 → 수금 항목으로 승격
  const out: FeeItem[] = []
  const today = nowIso().slice(0, 10)
  if (raw.contractDepositAmount != null || raw.contractDepositReceived) {
    out.push({
      id: 'legacy-deposit',
      serviceKey: null,
      kind: 'deposit',
      label: '계약금',
      amount: raw.contractDepositAmount ?? null,
      agentFee: null,
      agentName: '',
      agentPaidAt: null,
      dueDate: '',
      receivedAt: raw.contractDepositReceived ? today : null,
      note: '',
    })
  }
  if (raw.successFeeAmount != null || raw.successFeeReceived) {
    out.push({
      id: 'legacy-success',
      serviceKey: null,
      kind: 'success',
      label: '성공보수',
      amount: raw.successFeeAmount ?? null,
      agentFee: null,
      agentName: '',
      agentPaidAt: null,
      dueDate: '',
      receivedAt: raw.successFeeReceived ? today : null,
      note: '',
    })
  }
  return out
}

export function normalizeClientOps(value: Partial<ClientOpsRecord> & LegacyShape): ClientOpsRecord {
  const now = nowIso()
  const customDocuments = normalizeCustomDocuments(value.customDocuments)
  const documents = defaultDocuments()
  if (value.documents && typeof value.documents === 'object') {
    const stored = value.documents as Record<string, Partial<DocumentState>>
    /*
     * 기본 10종 + 직접 만든 칸(D-82).
     * 저장돼 있던 customdoc_ 상태는 정의가 사라졌어도 그대로 지킨다 — 칸을 지웠다고
     * 올려 둔 파일의 경로까지 잃으면 되돌릴 방법이 없다.
     */
    const keys = new Set<DocumentKey>([
      ...DOCUMENTS.map((d) => d.key),
      ...customDocuments.map((d) => d.key),
      ...Object.keys(stored).filter(isCustomDocumentKey),
    ])
    for (const key of keys) {
      const v = stored[key]
      documents[key] ??= defaultDocument()
      if (!v) continue
      documents[key] = { ...documents[key], ...v }
    }
  } else {
    for (const d of customDocuments) documents[d.key] ??= defaultDocument()
  }
  return {
    id: value.id ?? generateId(),
    workspaceId: value.workspaceId ?? null,
    companyName: value.companyName ?? '',
    contactName: value.contactName ?? '',
    contactPhone: value.contactPhone ?? '',
    contactEmail: value.contactEmail ?? '',
    businessNumber: value.businessNumber ?? '',
    corporateNumber: value.corporateNumber ?? '',
    businessAddress: value.businessAddress ?? '',
    industry: value.industry ?? '',
    representativeName: value.representativeName ?? '',
    representativeBirth: value.representativeBirth ?? '',
    employeeCount: value.employeeCount ?? '',
    shareholders: value.shareholders ?? '',
    establishedAt: value.establishedAt ?? '',
    businessCategory: value.businessCategory ?? '',
    businessItem: value.businessItem ?? '',
    businessItemsExtra: value.businessItemsExtra ?? '',
    contactTitle: value.contactTitle ?? '',
    companyPhone: value.companyPhone ?? '',
    homepage: value.homepage ?? '',
    status: (value.status as ClientOpsStatus) ?? 'active',
    nextAction: value.nextAction ?? '',
    nextActionDueDate: value.nextActionDueDate ?? '',
    notes: value.notes ?? '',
    services: upgradeServices(value),
    documents,
    contract: normalizeContract(value.contract),
    customFields: normalizeCustomFields(value.customFields),
    customDocuments,
    fees: upgradeFees(value),
    notes_list: Array.isArray(value.notes_list)
      ? value.notes_list.map((n) => ({
          id: n.id ?? generateId(),
          text: typeof n.text === 'string' ? n.text : '',
          pinned: n.pinned === true,
          createdAt: n.createdAt ?? now,
          updatedAt: n.updatedAt ?? now,
        }))
      : [],
    fundingApplications: Array.isArray(value.fundingApplications)
      ? value.fundingApplications.map((a) => ({
          id: a.id ?? generateId(),
          programName: a.programName ?? '',
          institution: a.institution ?? '',
          status: (a.status as FundingStatus) ?? 'watching',
          applyDueDate: a.applyDueDate ?? '',
          submittedAt: a.submittedAt ?? null,
          resultAt: a.resultAt ?? null,
          requestedAmount: typeof a.requestedAmount === 'number' ? a.requestedAmount : null,
          approvedAmount: typeof a.approvedAmount === 'number' ? a.approvedAmount : null,
          note: a.note ?? '',
          createdAt: a.createdAt ?? now,
          updatedAt: a.updatedAt ?? now,
        }))
      : [],
    toolResults: normalizeToolResults(value.toolResults),
    activity: Array.isArray(value.activity)
      ? value.activity
          .filter((a) => a && typeof a.text === 'string' && typeof a.at === 'string')
          .map((a) => ({
            id: a.id ?? generateId(),
            kind: (a.kind as ActivityEntry['kind']) ?? 'profile',
            text: a.text,
            serviceKey: (a.serviceKey as ServiceKey | null) ?? null,
            at: a.at,
          }))
          .slice(0, ACTIVITY_LIMIT)
      : [],
    archivedAt: typeof value.archivedAt === 'string' ? value.archivedAt : null,
    createdAt: value.createdAt ?? now,
    updatedAt: value.updatedAt ?? now,
  }
}

/* ------------------------------------------------------------------ */
/* 로컬 저장소                                                          */
/* ------------------------------------------------------------------ */

function readLocal(): ClientOpsRecord[] {
  return readJson<Array<Partial<ClientOpsRecord> & LegacyShape>>(
    STORAGE_KEYS.operationsClients,
    [],
  ).map(normalizeClientOps)
}

/**
 * 데이터 모드와 상관없이 이 브라우저(localStorage)에 남아 있는 고객을 읽는다.
 * 로컬 → 클라우드 이전에만 사용한다.
 */
export function readLocalClients(): ClientOpsRecord[] {
  return readLocal()
}

/*
 * '클라우드로 옮기기' 안내는 정말 옮길 것이 있을 때만 뜬다.
 *
 * 예전에는 이 브라우저에 로컬 기록이 있기만 하면 무조건 띄웠다. 그런데 옮기고
 * 나서도 브라우저 원본은 일부러 남겨 두므로(백업), 새로고침할 때마다 같은 안내가
 * 다시 떴다. '나중에' 도 화면 상태만 껐을 뿐 다음 접속에는 되살아났다.
 *
 * 그래서 판단 기준을 "로컬에 있느냐" 가 아니라 "아직 클라우드에 없느냐" 로 바꾼다.
 * 옮기고 나면 같은 id 가 클라우드에 생기므로 조건이 저절로 거짓이 된다.
 * '나중에' 는 그 id 들을 기억해 두어 다시 묻지 않는다 — 나중에 새 로컬 기록이
 * 생기면 그것만 다시 뜬다.
 */
function dismissedIds(): Set<string> {
  return new Set(readJson<string[]>(STORAGE_KEYS.localMigrationDismissed, []))
}

/** 아직 클라우드에 올라가지 않았고, 미루지도 않은 로컬 기록 */
export function pendingLocalClients(cloud: ClientOpsRecord[]): ClientOpsRecord[] {
  const inCloud = new Set(cloud.map((r) => r.id))
  const skipped = dismissedIds()
  return readLocal().filter((r) => !inCloud.has(r.id) && !skipped.has(r.id))
}

/** '나중에' — 이 기록들에 대해서는 다시 묻지 않는다 */
export function dismissLocalMigration(ids: string[]): void {
  const next = dismissedIds()
  for (const id of ids) next.add(id)
  writeJson(STORAGE_KEYS.localMigrationDismissed, [...next])
}

function writeLocal(records: ClientOpsRecord[]): void {
  writeJson(STORAGE_KEYS.operationsClients, records)
  notifyStoreChanged()
}

/* ------------------------------------------------------------------ */
/* Supabase 행 변환                                                     */
/* ------------------------------------------------------------------ */

function payloadOf(record: ClientOpsRecord) {
  const payload = { ...record } as Partial<ClientOpsRecord>
  delete payload.id
  delete payload.workspaceId
  delete payload.companyName
  delete payload.status
  delete payload.nextAction
  delete payload.nextActionDueDate
  delete payload.createdAt
  delete payload.updatedAt
  return payload
}

function fromRow(row: Record<string, unknown>): ClientOpsRecord {
  const payload = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Partial<
    ClientOpsRecord
  > &
    LegacyShape
  return normalizeClientOps({
    ...payload,
    id: String(row.id),
    workspaceId: row.workspace_id ? String(row.workspace_id) : null,
    companyName: String(row.company_name ?? ''),
    status: (row.status as ClientOpsStatus) ?? 'active',
    nextAction: String(row.next_action ?? ''),
    nextActionDueDate: row.next_action_due_date ? String(row.next_action_due_date) : '',
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  })
}

function isLocal(): boolean {
  return getDataModeConfig().mode === 'local'
}

/* ------------------------------------------------------------------ */
/* 공개 API                                                             */
/* ------------------------------------------------------------------ */

export async function listClients(workspaceId: string | null): Promise<ClientOpsRecord[]> {
  if (isLocal()) return readLocal().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  if (!workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const { data, error } = await getSupabaseClient()
    .from('operations_clients')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => fromRow(row as Record<string, unknown>))
}

export async function createClient(
  workspaceId: string | null,
  input: CreateClientOpsInput,
): Promise<ClientOpsRecord> {
  const now = nowIso()
  const record = normalizeClientOps({
    id: generateId(),
    workspaceId,
    companyName: input.companyName.trim(),
    contactName: input.contactName?.trim() ?? '',
    contactPhone: input.contactPhone?.trim() ?? '',
    businessNumber: input.businessNumber?.trim() ?? '',
    industry: input.industry?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
  })
  if (isLocal()) {
    writeLocal([record, ...readLocal()])
    return record
  }
  if (!workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const { data, error } = await getSupabaseClient()
    .from('operations_clients')
    .insert({
      id: record.id,
      workspace_id: workspaceId,
      company_name: record.companyName,
      status: record.status,
      next_action: record.nextAction,
      next_action_due_date: record.nextActionDueDate || null,
      payload: payloadOf(record),
    })
    .select()
    .single()
  if (error) throw error
  return fromRow(data as Record<string, unknown>)
}

export async function saveClient(record: ClientOpsRecord): Promise<ClientOpsRecord> {
  const next = normalizeClientOps({ ...record, updatedAt: nowIso() })
  if (isLocal()) {
    writeLocal(readLocal().map((item) => (item.id === next.id ? next : item)))
    return next
  }
  if (!next.workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const { data, error } = await getSupabaseClient()
    .from('operations_clients')
    .update({
      company_name: next.companyName,
      status: next.status,
      next_action: next.nextAction,
      next_action_due_date: next.nextActionDueDate || null,
      payload: payloadOf(next),
    })
    .eq('id', next.id)
    .eq('workspace_id', next.workspaceId)
    .select()
    .single()
  if (error) throw error
  return fromRow(data as Record<string, unknown>)
}

/**
 * 백업 복원용 일괄 저장.
 * local: 전체 목록을 통째로 교체한다(추가·삭제 모두 반영).
 * supabase: 전달된 레코드를 upsert 하고, 목록에 없는 행은 지운다.
 */
export async function replaceAllClients(
  workspaceId: string | null,
  records: ClientOpsRecord[],
): Promise<ClientOpsRecord[]> {
  const normalized = records.map((r) => normalizeClientOps({ ...r, workspaceId }))
  if (isLocal()) {
    writeLocal(normalized)
    return normalized
  }
  if (!workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const client = getSupabaseClient()
  const rows = normalized.map((r) => ({
    id: r.id,
    workspace_id: workspaceId,
    company_name: r.companyName,
    status: r.status,
    next_action: r.nextAction,
    next_action_due_date: r.nextActionDueDate || null,
    payload: payloadOf(r),
  }))
  if (rows.length > 0) {
    const { error } = await client.from('operations_clients').upsert(rows)
    if (error) throw error
  }
  const keepIds = normalized.map((r) => r.id)
  const del = client.from('operations_clients').delete().eq('workspace_id', workspaceId)
  const { error: delError } =
    keepIds.length > 0 ? await del.not('id', 'in', `(${keepIds.join(',')})`) : await del
  if (delError) throw delError
  return normalized
}

export async function deleteClient(record: ClientOpsRecord): Promise<void> {
  if (isLocal()) {
    writeLocal(readLocal().filter((item) => item.id !== record.id))
    return
  }
  if (!record.workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const { error } = await getSupabaseClient()
    .from('operations_clients')
    .delete()
    .eq('id', record.id)
    .eq('workspace_id', record.workspaceId)
  if (error) throw error
}

/* ------------------------------------------------------------------ */
/* 부분 수정 도우미 (화면에서 자주 쓰는 조작)                            */
/* ------------------------------------------------------------------ */

export function withService(
  record: ClientOpsRecord,
  key: ServiceKey,
  patch: Partial<ServiceState>,
): ClientOpsRecord {
  const prev = record.services[key]
  const next: ServiceState = { ...prev, ...patch }

  // 상태 전환에 따른 시각 자동 기록
  if (patch.status && patch.status !== prev.status) {
    if (patch.status === 'done') {
      next.completedAt = nowIso()
      next.waitingSince = null
    } else {
      next.completedAt = null
    }
    if (patch.status === 'waiting_client') {
      next.waitingSince = prev.waitingSince ?? nowIso()
    } else if (prev.status === 'waiting_client') {
      next.waitingSince = null
    }
    if (next.startedAt === null && patch.status !== 'not_started' && patch.status !== 'on_hold') {
      next.startedAt = nowIso()
    }
  }

  let out: ClientOpsRecord = { ...record, services: { ...record.services, [key]: next } }
  if (patch.status && patch.status !== prev.status) {
    out = withActivity(out, 'service_status', serviceStatusText(key, prev.status, patch.status), key)
  }
  if (patch.dueDate !== undefined && patch.dueDate !== prev.dueDate) {
    out = withActivity(out, 'service_due', serviceDueText(key, patch.dueDate), key)
  }
  return out
}

export function withDocument(
  record: ClientOpsRecord,
  key: DocumentKey,
  patch: Partial<DocumentState>,
): ClientOpsRecord {
  const prev = record.documents[key]
  let out: ClientOpsRecord = {
    ...record,
    documents: {
      ...record.documents,
      [key]: { ...prev, ...patch, updatedAt: nowIso() },
    },
  }
  const label = documentMetaOf(record, key).label
  if (patch.received !== undefined && patch.received !== prev.received) {
    out = withActivity(out, 'document', documentReceivedText(key, patch.received, label))
  }
  if (patch.fileName && patch.fileName !== prev.fileName) {
    out = withActivity(out, 'document', documentFileText(key, patch.fileName, label))
  }
  return out
}

/**
 * 서류 칸 직접 만들기 · 이름 고치기 (D-82).
 * `id` 를 주면 고치고, 없으면 새로 만든다. 키는 만들 때 한 번만 정한다 —
 * 이름을 고쳤다고 키가 바뀌면 이미 올려 둔 파일이 떨어져 나간다.
 */
export function withCustomDocument(
  record: ClientOpsRecord,
  input: { id?: string; label: string; validMonths?: number | null; sensitive?: boolean },
): ClientOpsRecord {
  const label = input.label.trim()
  if (label === '') return record
  const validMonths =
    typeof input.validMonths === 'number' && Number.isFinite(input.validMonths) && input.validMonths > 0
      ? Math.round(input.validMonths)
      : null
  const prev = input.id ? record.customDocuments.find((d) => d.id === input.id) : undefined
  if (prev) {
    const next: ClientOpsRecord = {
      ...record,
      customDocuments: record.customDocuments.map((d) =>
        d.id === prev.id ? { ...d, label, validMonths, sensitive: input.sensitive ?? d.sensitive } : d,
      ),
    }
    if (prev.label === label) return next
    return withActivity(next, 'document', `서류 칸 이름 변경 — ${prev.label} → ${label}`)
  }
  const doc: CustomDocument = {
    id: generateId(),
    key: makeCustomDocumentKey(),
    label,
    validMonths,
    sensitive: input.sensitive === true,
  }
  return withActivity(
    {
      ...record,
      customDocuments: [...record.customDocuments, doc],
      documents: { ...record.documents, [doc.key]: defaultDocument() },
    },
    'document',
    `서류 칸 추가 — ${label}`,
  )
}

/**
 * 서류 칸 없애기.
 * 정의만 지우고 **상태는 남긴다** — 올려 둔 파일의 경로까지 지우면 되돌릴 수 없다.
 * 같은 이름으로 다시 만들면 새 칸이 되므로, 정말 지우는 것은 사람이 파일을 정리한 뒤다.
 */
export function withoutCustomDocument(record: ClientOpsRecord, id: string): ClientOpsRecord {
  const gone = record.customDocuments.find((d) => d.id === id)
  if (!gone) return record
  return withActivity(
    { ...record, customDocuments: record.customDocuments.filter((d) => d.id !== id) },
    'document',
    `서류 칸 없앰 — ${gone.label}`,
  )
}

/**
 * 계약 정보 저장.
 * 무엇이 바뀌었는지 활동 기록에 한 줄 남긴다 — 계약 조건은 나중에 반드시 다시 확인하게 된다.
 */
export function withContract(record: ClientOpsRecord, next: ContractInfo): ClientOpsRecord {
  const prev = record.contract
  const changed: string[] = []
  if (prev.signedAt !== next.signedAt && next.signedAt !== '') changed.push(`계약일 ${next.signedAt}`)
  if (prev.kind !== next.kind && next.kind !== '') changed.push(`방식 ${CONTRACT_KIND_LABEL[next.kind]}`)
  if (prev.cashAmount !== next.cashAmount && next.cashAmount !== null) changed.push(`현금 ${next.cashAmount.toLocaleString('ko-KR')}원`)
  if (prev.policies.length !== next.policies.length) changed.push(`보험 ${next.policies.length}건`)

  const out: ClientOpsRecord = { ...record, contract: next }
  // 위 네 가지에 안 걸리는 수정(금액을 지움 · 보험 내용만 고침 · 메모)도 바뀐 건 바뀐 것이다
  if (changed.length === 0) {
    const same = JSON.stringify(prev) === JSON.stringify(next)
    return same ? out : withActivity(out, 'contract', '계약 — 내용 수정')
  }
  return withActivity(out, 'contract', `계약 — ${changed.join(' · ')}`)
}

/**
 * 직접 만든 칸을 넣거나 고친다.
 * `id` 가 있으면 그 칸을 고치고, 없으면 새로 만든다.
 */
export function withCustomField(
  record: ClientOpsRecord,
  field: { id?: string; group: ProfileGroupKey; label: string; value: string },
): ClientOpsRecord {
  const label = field.label.trim()
  const value = field.value.trim()
  if (label === '') return record

  const existing = field.id ? record.customFields.find((f) => f.id === field.id) : undefined
  if (existing) {
    if (existing.label === label && existing.value === value && existing.group === field.group) return record
    const next = record.customFields.map((f) =>
      f.id === existing.id ? { ...f, group: field.group, label, value } : f,
    )
    return withActivity({ ...record, customFields: next }, 'profile', `${label} · 고침`)
  }

  const made: CustomProfileField = { id: generateId(), group: field.group, label, value }
  return withActivity({ ...record, customFields: [...record.customFields, made] }, 'profile', `${label} 칸을 만듦`)
}

/** 직접 만든 칸을 지운다 (표준 칸은 지워지지 않는다 — 값만 비운다) */
export function withoutCustomField(record: ClientOpsRecord, id: string): ClientOpsRecord {
  const gone = record.customFields.find((f) => f.id === id)
  if (!gone) return record
  return withActivity(
    { ...record, customFields: record.customFields.filter((f) => f.id !== id) },
    'profile',
    `${gone.label} 칸을 지움`,
  )
}

export function withNewFee(record: ClientOpsRecord, fee: Partial<FeeItem>): ClientOpsRecord {
  const kind = fee.kind ?? 'deposit'
  const item: FeeItem = {
    id: generateId(),
    serviceKey: fee.serviceKey ?? null,
    kind,
    label:
      fee.label ??
      (fee.serviceKey ? `${serviceMeta(fee.serviceKey).shortLabel} ${FEE_KIND_LABEL[kind]}` : FEE_KIND_LABEL[kind]),
    amount: fee.amount ?? null,
    agentFee: fee.agentFee ?? null,
    agentName: (fee.agentName ?? '').trim(),
    agentPaidAt: fee.agentPaidAt ?? null,
    dueDate: fee.dueDate ?? '',
    receivedAt: fee.receivedAt ?? null,
    note: fee.note ?? '',
  }
  const label = item.amount === null ? item.label : `${item.label} ${item.amount.toLocaleString('ko-KR')}원`
  return withActivity({ ...record, fees: [...record.fees, item] }, 'fee_added', `수금 항목 추가 — ${label}`)
}

export function withFee(record: ClientOpsRecord, feeId: string, patch: Partial<FeeItem>): ClientOpsRecord {
  const prev = record.fees.find((f) => f.id === feeId)
  const out: ClientOpsRecord = {
    ...record,
    fees: record.fees.map((f) => (f.id === feeId ? { ...f, ...patch } : f)),
  }
  // 입금 확인은 계약 이행의 증거라 반드시 남긴다(해제는 오기 정정으로 보고 남기지 않는다).
  if (prev && patch.receivedAt !== undefined && patch.receivedAt && !prev.receivedAt) {
    return withActivity(out, 'fee_received', feeReceivedText(prev.label, patch.amount ?? prev.amount))
  }
  return out
}

export function withoutFee(record: ClientOpsRecord, feeId: string): ClientOpsRecord {
  return { ...record, fees: record.fees.filter((f) => f.id !== feeId) }
}

/* ------------------------------------------------------------------ */
/* 메모                                                                 */
/* ------------------------------------------------------------------ */

export function withNewNote(record: ClientOpsRecord, text: string): ClientOpsRecord {
  const now = nowIso()
  const note: ClientNote = { id: generateId(), text, pinned: false, createdAt: now, updatedAt: now }
  return { ...record, notes_list: [note, ...record.notes_list] }
}

export function withNoteText(record: ClientOpsRecord, id: string, text: string): ClientOpsRecord {
  return {
    ...record,
    notes_list: record.notes_list.map((n) => (n.id === id ? { ...n, text, updatedAt: nowIso() } : n)),
  }
}

export function withNotePinned(record: ClientOpsRecord, id: string, pinned: boolean): ClientOpsRecord {
  return {
    ...record,
    notes_list: record.notes_list.map((n) => (n.id === id ? { ...n, pinned, updatedAt: nowIso() } : n)),
  }
}

export function withoutNote(record: ClientOpsRecord, id: string): ClientOpsRecord {
  return { ...record, notes_list: record.notes_list.filter((n) => n.id !== id) }
}

/** 고정된 메모가 위, 그다음 최근 수정순 */
export function sortedNotes(record: ClientOpsRecord): ClientNote[] {
  return [...record.notes_list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.updatedAt.localeCompare(a.updatedAt)
  })
}

/* ------------------------------------------------------------------ */
/* 정책자금 신청 건                                                     */
/* ------------------------------------------------------------------ */

export function withNewFunding(
  record: ClientOpsRecord,
  input: Partial<FundingApplication>,
): ClientOpsRecord {
  const now = nowIso()
  const item: FundingApplication = {
    id: generateId(),
    programName: input.programName ?? '',
    institution: input.institution ?? '',
    status: input.status ?? 'watching',
    applyDueDate: input.applyDueDate ?? '',
    submittedAt: input.submittedAt ?? null,
    resultAt: input.resultAt ?? null,
    requestedAmount: input.requestedAmount ?? null,
    approvedAmount: input.approvedAmount ?? null,
    note: input.note ?? '',
    createdAt: now,
    updatedAt: now,
  }
  return withActivity(
    { ...record, fundingApplications: [item, ...record.fundingApplications] },
    'funding_added',
    `지원사업 등록 — ${item.programName.trim() || '이름 미정'}`,
    'policyFund',
  )
}

export function withFunding(
  record: ClientOpsRecord,
  id: string,
  patch: Partial<FundingApplication>,
): ClientOpsRecord {
  const prev = record.fundingApplications.find((a) => a.id === id)
  const out: ClientOpsRecord = {
    ...record,
    fundingApplications: record.fundingApplications.map((a) => {
      if (a.id !== id) return a
      const next = { ...a, ...patch, updatedAt: nowIso() }
      // 상태 전환 시 날짜 자동 기록
      if (patch.status && patch.status !== a.status) {
        if (patch.status === 'submitted' && next.submittedAt === null) next.submittedAt = nowIso().slice(0, 10)
        if ((patch.status === 'selected' || patch.status === 'rejected') && next.resultAt === null) {
          next.resultAt = nowIso().slice(0, 10)
        }
      }
      return next
    }),
  }
  if (prev && patch.status && patch.status !== prev.status) {
    return withActivity(
      out,
      'funding_status',
      fundingStatusText(prev.programName, prev.status, patch.status),
      'policyFund',
    )
  }
  return out
}

export function withoutFunding(record: ClientOpsRecord, id: string): ClientOpsRecord {
  return { ...record, fundingApplications: record.fundingApplications.filter((a) => a.id !== id) }
}

/* ------------------------------------------------------------------ */
/* 보관                                                                 */
/* ------------------------------------------------------------------ */

export function withArchived(record: ClientOpsRecord, archived: boolean): ClientOpsRecord {
  return withActivity(
    { ...record, archivedAt: archived ? nowIso() : null },
    'archive',
    archived ? '보관 처리' : '보관 해제',
  )
}

/* ------------------------------------------------------------------ */
/* 도구함 결과 (D-88)                                                    */
/* ------------------------------------------------------------------ */

/** 도구가 계산한 기한 목록 (D-89). 날짜 모양이 아니면 버린다 — 달력에 이상한 칸을 만들지 않기 위해. */
function normalizeToolDeadlines(value: unknown): ToolDeadline[] {
  if (!Array.isArray(value)) return []
  const out: ToolDeadline[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const d = raw as Partial<ToolDeadline>
    if (typeof d.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) continue
    out.push({
      date: d.date,
      title: typeof d.title === 'string' && d.title ? d.title : '기한',
      note: typeof d.note === 'string' ? d.note : '',
    })
  }
  return out.slice(0, TOOL_DEADLINE_LIMIT)
}

/** 저장된 도구 결과를 지금 모양으로. 모르는 값은 버리지 않고 빈 값으로 채운다. */
function normalizeToolResults(value: unknown): ToolResult[] {
  if (!Array.isArray(value)) return []
  const out: ToolResult[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Partial<ToolResult>
    if (typeof r.toolKey !== 'string' || !r.toolKey) continue
    out.push({
      id: typeof r.id === 'string' && r.id ? r.id : generateId(),
      toolKey: r.toolKey,
      title: typeof r.title === 'string' ? r.title : r.toolKey,
      verdict: typeof r.verdict === 'string' ? r.verdict : null,
      verdictLabel: typeof r.verdictLabel === 'string' ? r.verdictLabel : '',
      summary: typeof r.summary === 'string' ? r.summary : '',
      data: r.data ?? null,
      deadlines: normalizeToolDeadlines(r.deadlines),
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : nowIso(),
      publishedUpdateId: typeof r.publishedUpdateId === 'string' ? r.publishedUpdateId : null,
    })
  }
  return out
}

export const TOOL_RESULT_LIMIT = 50
/** 결과 한 건이 심을 수 있는 기한 수 — 회차가 스무 번이 넘는 지원금도 있어 넉넉히 둔다 */
export const TOOL_DEADLINE_LIMIT = 24

/** 도구 결과 한 건을 붙인다 — 최신이 앞, 상한을 넘으면 오래된 것부터 잘린다. */
export function withToolResult(
  record: ClientOpsRecord,
  input: Omit<ToolResult, 'id' | 'createdAt' | 'publishedUpdateId' | 'deadlines'> &
    Partial<Pick<ToolResult, 'id' | 'createdAt' | 'publishedUpdateId' | 'deadlines'>>,
): ClientOpsRecord {
  const item: ToolResult = {
    id: input.id ?? generateId(),
    toolKey: input.toolKey,
    title: input.title,
    verdict: input.verdict ?? null,
    verdictLabel: input.verdictLabel,
    summary: input.summary,
    data: input.data,
    deadlines: normalizeToolDeadlines(input.deadlines),
    createdAt: input.createdAt ?? nowIso(),
    publishedUpdateId: input.publishedUpdateId ?? null,
  }
  const text = item.verdictLabel ? `${item.title} · ${item.verdictLabel}` : item.title
  return withActivity({ ...record, toolResults: [item, ...record.toolResults].slice(0, TOOL_RESULT_LIMIT) }, 'tool', text)
}

/** 고객 플랫폼에 발행한 뒤 그 update id 를 기억해 둔다 (두 번 발행하지 않기 위해) */
export function withToolResultPublished(record: ClientOpsRecord, resultId: string, updateId: string | null): ClientOpsRecord {
  return {
    ...record,
    toolResults: record.toolResults.map((r) => (r.id === resultId ? { ...r, publishedUpdateId: updateId } : r)),
  }
}

export function withoutToolResult(record: ClientOpsRecord, resultId: string): ClientOpsRecord {
  const prev = record.toolResults.find((r) => r.id === resultId)
  if (!prev) return record
  return withActivity(
    { ...record, toolResults: record.toolResults.filter((r) => r.id !== resultId) },
    'tool',
    `${prev.title} 결과 지움`,
  )
}

/* ------------------------------------------------------------------ */
/* 파일 첨부                                                            */
/* ------------------------------------------------------------------ */

/** 클라우드(Supabase) 연결 시에만 실제 파일 업로드가 가능한지 */
export function canUploadFiles(): boolean {
  return getDataModeConfig().mode === 'supabase'
}

/**
 * 업로드가 막혔을 때 저장소가 주는 영어 메시지를 사람 말로 바꾼다.
 * 그대로 보여주면 "무엇을 어떻게 고쳐야 하는지" 를 알 수 없다.
 */
function uploadErrorMessage(raw: string, file: File): string {
  const m = raw.toLowerCase()
  if (m.includes('exceeded') || m.includes('too large') || m.includes('payload')) {
    return `파일이 너무 큽니다 (${formatFileSize(file.size)}). Supabase Dashboard → Storage → Settings 의 "Upload file size limit" 을 올리면 더 큰 파일도 올릴 수 있습니다.`
  }
  if (m.includes('mime') || m.includes('not supported') || m.includes('content type')) {
    return `이 형식(${file.type || '알 수 없음'})은 저장소가 아직 막고 있습니다. supabase/migrations/20260906000011_storage_open_types.sql 을 적용하면 모든 형식이 열립니다.`
  }
  if (m.includes('duplicate') || m.includes('already exists')) {
    return '같은 이름의 파일이 이미 있습니다. 잠시 뒤 다시 시도해 주세요.'
  }
  return `파일을 올리지 못했습니다. ${raw}`
}

export async function uploadDocumentFile(
  record: ClientOpsRecord,
  key: DocumentKey,
  file: File,
): Promise<ClientOpsRecord> {
  if (!canUploadFiles()) {
    throw new Error('파일 보관은 Supabase 클라우드 저장을 연결한 뒤 사용할 수 있습니다.')
  }
  if (!record.workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  // 저장 경로에는 영문·숫자만 남긴다(한글 파일명도 안전하게 올라간다).
  // 원래 이름은 fileName 에 그대로 보관해 화면에는 한글로 보인다.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${record.workspaceId}/${record.id}/${key}/${generateId()}-${safeName}`
  const { error } = await getSupabaseClient()
    .storage.from('client-documents')
    .upload(path, file, { contentType: file.type || 'application/octet-stream' })
  if (error) throw new Error(uploadErrorMessage(error.message, file))
  return saveClient(
    withDocument(record, key, {
      received: true,
      fileName: file.name,
      fileSize: file.size,
      storagePath: path,
    }),
  )
}

/**
 * 첨부 파일 서명 URL (5분).
 *
 * `downloadName` 을 주면 저장소가 `Content-Disposition: attachment` 를 붙여 준다 —
 * 브라우저가 새 탭에서 열지 않고 **바로 내려받는다**. 안 주면 열어서 보는 주소다.
 * 올릴 때 경로에서 한글을 지웠으므로(파일명은 fileName 에 보관), 내려받는 이름은 원래 이름으로 준다.
 */
export async function documentFileUrl(storagePath: string, downloadName?: string): Promise<string | null> {
  if (!canUploadFiles() || !storagePath) return null
  const { data, error } = await getSupabaseClient()
    .storage.from('client-documents')
    .createSignedUrl(storagePath, 60 * 5, downloadName ? { download: downloadName } : undefined)
  if (error) return null
  return data?.signedUrl ?? null
}

/**
 * 첨부 파일 내려받기.
 *
 * 저장소가 붙여 준 attachment 헤더 덕분에 링크를 누르면 바로 저장된다.
 * 새 탭으로 열지 않는다 — 열어 두면 PDF 미리보기가 떠서 '받았다' 는 느낌이 나지 않는다.
 */
export async function downloadDocumentFile(state: Pick<DocumentState, 'storagePath' | 'fileName'>): Promise<void> {
  if (!canUploadFiles()) {
    throw new Error('파일 내려받기는 Supabase 클라우드 저장을 연결한 뒤 사용할 수 있습니다.')
  }
  const url = await documentFileUrl(state.storagePath, state.fileName || undefined)
  if (!url) throw new Error('파일 주소를 만들지 못했습니다.')
  const a = document.createElement('a')
  a.href = url
  a.download = state.fileName || ''
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
