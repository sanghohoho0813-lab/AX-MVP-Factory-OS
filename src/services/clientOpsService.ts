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
import {
  DOCUMENTS,
  FEE_KIND_LABEL,
  SERVICES,
  serviceMeta,
} from '../content/clientOpsCatalog'
import type {
  ClientOpsRecord,
  ClientOpsStatus,
  CreateClientOpsInput,
  DocumentKey,
  DocumentState,
  FeeItem,
  ServiceKey,
  ServiceState,
} from '../types/clientOps'

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
  return { received: false, issuedAt: '', fileName: '', storagePath: '', note: '', updatedAt: null }
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
    for (const s of SERVICES) {
      const v = (raw.services as Record<string, Partial<ServiceState>>)[s.key]
      if (!v) continue
      base[s.key] = { ...base[s.key], ...v }
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

function upgradeFees(raw: Partial<ClientOpsRecord> & LegacyShape): FeeItem[] {
  if (Array.isArray(raw.fees)) {
    return raw.fees.map((f) => ({
      id: f.id ?? generateId(),
      serviceKey: f.serviceKey ?? null,
      kind: f.kind ?? 'deposit',
      label: f.label ?? FEE_KIND_LABEL[f.kind ?? 'deposit'],
      amount: typeof f.amount === 'number' ? f.amount : null,
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
      dueDate: '',
      receivedAt: raw.successFeeReceived ? today : null,
      note: '',
    })
  }
  return out
}

export function normalizeClientOps(value: Partial<ClientOpsRecord> & LegacyShape): ClientOpsRecord {
  const now = nowIso()
  const documents = defaultDocuments()
  if (value.documents && typeof value.documents === 'object') {
    for (const d of DOCUMENTS) {
      const v = (value.documents as Record<string, Partial<DocumentState>>)[d.key]
      if (!v) continue
      documents[d.key] = { ...documents[d.key], ...v }
    }
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
    status: (value.status as ClientOpsStatus) ?? 'active',
    nextAction: value.nextAction ?? '',
    nextActionDueDate: value.nextActionDueDate ?? '',
    notes: value.notes ?? '',
    services: upgradeServices(value),
    documents,
    fees: upgradeFees(value),
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
    if (next.startedAt === null && patch.status !== 'not_started' && patch.status !== 'not_applicable') {
      next.startedAt = nowIso()
    }
  }

  return { ...record, services: { ...record.services, [key]: next } }
}

export function withDocument(
  record: ClientOpsRecord,
  key: DocumentKey,
  patch: Partial<DocumentState>,
): ClientOpsRecord {
  return {
    ...record,
    documents: {
      ...record.documents,
      [key]: { ...record.documents[key], ...patch, updatedAt: nowIso() },
    },
  }
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
    dueDate: fee.dueDate ?? '',
    receivedAt: fee.receivedAt ?? null,
    note: fee.note ?? '',
  }
  return { ...record, fees: [...record.fees, item] }
}

export function withFee(record: ClientOpsRecord, feeId: string, patch: Partial<FeeItem>): ClientOpsRecord {
  return {
    ...record,
    fees: record.fees.map((f) => (f.id === feeId ? { ...f, ...patch } : f)),
  }
}

export function withoutFee(record: ClientOpsRecord, feeId: string): ClientOpsRecord {
  return { ...record, fees: record.fees.filter((f) => f.id !== feeId) }
}

/* ------------------------------------------------------------------ */
/* 파일 첨부                                                            */
/* ------------------------------------------------------------------ */

/** 클라우드(Supabase) 연결 시에만 실제 파일 업로드가 가능한지 */
export function canUploadFiles(): boolean {
  return getDataModeConfig().mode === 'supabase'
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
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${record.workspaceId}/${record.id}/${key}/${generateId()}-${safeName}`
  const { error } = await getSupabaseClient()
    .storage.from('client-documents')
    .upload(path, file, { contentType: file.type || undefined })
  if (error) throw error
  return saveClient(
    withDocument(record, key, {
      received: true,
      fileName: file.name,
      storagePath: path,
    }),
  )
}

/** 첨부 파일 서명 URL (보기·내려받기) */
export async function documentFileUrl(storagePath: string): Promise<string | null> {
  if (!canUploadFiles() || !storagePath) return null
  const { data, error } = await getSupabaseClient()
    .storage.from('client-documents')
    .createSignedUrl(storagePath, 60 * 5)
  if (error) return null
  return data?.signedUrl ?? null
}
