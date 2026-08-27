import { getDataModeConfig } from '../data/dataMode'
import { getSupabaseClient } from '../lib/supabase/client'
import { generateId, readJson, STORAGE_KEYS, writeJson } from '../storage/localStore'

export const OPERATIONS_TASKS = [
  ['patent', '특허 출원'],
  ['venture', '벤처인증 혁신성장유형'],
  ['ax', 'AX 기획 및 개발'],
  ['businessScope', '업종 추가·법인 목적사항'],
  ['incorporation', '법인설립'],
] as const

export const OPERATIONS_DOCUMENTS = [
  ['businessRegistration', '사업자등록증'],
  ['corporateRegistry', '법인등기부등본'],
  ['representativeId', '대표자 신분증 사본'],
  ['representativePhone', '대표자 휴대폰번호'],
  ['businessNumber', '사업자등록번호'],
  ['corporateNumber', '법인번호'],
  ['jointCertificate', '공동인증서 전달'],
  ['businessAddress', '사업장 주소'],
  ['smeCertificate', '중소기업 확인서'],
  ['healthInsurance', '대표자 건강보험득실확인서'],
] as const

export type OperationsTaskKey = (typeof OPERATIONS_TASKS)[number][0]
export type OperationsDocumentKey = (typeof OPERATIONS_DOCUMENTS)[number][0]
export type OperationsStatus = 'active' | 'waiting' | 'paused' | 'completed'

export interface OperationsTask {
  completed: boolean
  dueDate: string
  note: string
}

export interface OperationsDocument {
  received: boolean
  fileName: string
  storagePath: string
  updatedAt: string | null
}

export interface OperationsClient {
  id: string
  workspaceId: string | null
  companyName: string
  contactName: string
  contactPhone: string
  contactEmail: string
  businessNumber: string
  corporateNumber: string
  businessAddress: string
  industry: string
  status: OperationsStatus
  nextAction: string
  nextActionDueDate: string
  notes: string
  tasks: Record<OperationsTaskKey, OperationsTask>
  documents: Record<OperationsDocumentKey, OperationsDocument>
  contractDepositAmount: number | null
  contractDepositReceived: boolean
  successFeeAmount: number | null
  successFeeReceived: boolean
  fundingStatus: string
  fundingNote: string
  createdAt: string
  updatedAt: string
}

export interface CreateOperationsClientInput {
  companyName: string
  contactName?: string
  contactPhone?: string
  nextAction?: string
  nextActionDueDate?: string
}

function defaultTasks(): Record<OperationsTaskKey, OperationsTask> {
  return Object.fromEntries(OPERATIONS_TASKS.map(([key]) => [key, { completed: false, dueDate: '', note: '' }])) as Record<OperationsTaskKey, OperationsTask>
}

function defaultDocuments(): Record<OperationsDocumentKey, OperationsDocument> {
  return Object.fromEntries(OPERATIONS_DOCUMENTS.map(([key]) => [key, { received: false, fileName: '', storagePath: '', updatedAt: null }])) as Record<OperationsDocumentKey, OperationsDocument>
}

function normalize(value: Partial<OperationsClient>): OperationsClient {
  const now = new Date().toISOString()
  return {
    id: value.id ?? generateId(), workspaceId: value.workspaceId ?? null, companyName: value.companyName ?? '',
    contactName: value.contactName ?? '', contactPhone: value.contactPhone ?? '', contactEmail: value.contactEmail ?? '',
    businessNumber: value.businessNumber ?? '', corporateNumber: value.corporateNumber ?? '', businessAddress: value.businessAddress ?? '', industry: value.industry ?? '',
    status: value.status ?? 'active', nextAction: value.nextAction ?? '', nextActionDueDate: value.nextActionDueDate ?? '', notes: value.notes ?? '',
    tasks: { ...defaultTasks(), ...(value.tasks ?? {}) }, documents: { ...defaultDocuments(), ...(value.documents ?? {}) },
    contractDepositAmount: value.contractDepositAmount ?? null, contractDepositReceived: value.contractDepositReceived ?? false,
    successFeeAmount: value.successFeeAmount ?? null, successFeeReceived: value.successFeeReceived ?? false,
    fundingStatus: value.fundingStatus ?? '', fundingNote: value.fundingNote ?? '', createdAt: value.createdAt ?? now, updatedAt: value.updatedAt ?? now,
  }
}

function readLocal(): OperationsClient[] {
  return readJson<OperationsClient[]>(STORAGE_KEYS.operationsClients, []).map(normalize)
}

function payloadOf(client: OperationsClient) {
  const payload = { ...client } as Partial<OperationsClient>
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

function fromRow(row: Record<string, unknown>): OperationsClient {
  const payload = (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Partial<OperationsClient>
  return normalize({ ...payload, id: String(row.id), workspaceId: String(row.workspace_id), companyName: String(row.company_name ?? ''), status: row.status as OperationsStatus, nextAction: String(row.next_action ?? ''), nextActionDueDate: String(row.next_action_due_date ?? ''), createdAt: String(row.created_at ?? ''), updatedAt: String(row.updated_at ?? '') })
}

export async function listOperationsClients(workspaceId: string | null): Promise<OperationsClient[]> {
  if (getDataModeConfig().mode === 'local') return readLocal().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  if (!workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const { data, error } = await getSupabaseClient().from('operations_clients').select('*').eq('workspace_id', workspaceId).order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => fromRow(row as Record<string, unknown>))
}

export async function createOperationsClient(workspaceId: string | null, input: CreateOperationsClientInput): Promise<OperationsClient> {
  const now = new Date().toISOString()
  const record = normalize({ id: generateId(), workspaceId, companyName: input.companyName.trim(), contactName: input.contactName?.trim(), contactPhone: input.contactPhone?.trim(), nextAction: input.nextAction?.trim(), nextActionDueDate: input.nextActionDueDate, createdAt: now, updatedAt: now })
  if (getDataModeConfig().mode === 'local') {
    writeJson(STORAGE_KEYS.operationsClients, [record, ...readLocal()])
    return record
  }
  if (!workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const { data, error } = await getSupabaseClient().from('operations_clients').insert({ id: record.id, workspace_id: workspaceId, company_name: record.companyName, status: record.status, next_action: record.nextAction, next_action_due_date: record.nextActionDueDate || null, payload: payloadOf(record) }).select().single()
  if (error) throw error
  return fromRow(data as Record<string, unknown>)
}

export async function saveOperationsClient(record: OperationsClient): Promise<OperationsClient> {
  const next = normalize({ ...record, updatedAt: new Date().toISOString() })
  if (getDataModeConfig().mode === 'local') {
    writeJson(STORAGE_KEYS.operationsClients, readLocal().map((item) => item.id === next.id ? next : item))
    return next
  }
  if (!next.workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const { data, error } = await getSupabaseClient().from('operations_clients').update({ company_name: next.companyName, status: next.status, next_action: next.nextAction, next_action_due_date: next.nextActionDueDate || null, payload: payloadOf(next) }).eq('id', next.id).eq('workspace_id', next.workspaceId).select().single()
  if (error) throw error
  return fromRow(data as Record<string, unknown>)
}

export async function uploadOperationsDocument(record: OperationsClient, key: OperationsDocumentKey, file: File): Promise<OperationsClient> {
  if (getDataModeConfig().mode !== 'supabase') throw new Error('파일 보관은 Supabase 클라우드 저장을 연결한 뒤 사용할 수 있습니다.')
  if (!record.workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${record.workspaceId}/${record.id}/${key}/${generateId()}-${safeName}`
  const { error } = await getSupabaseClient().storage.from('client-documents').upload(path, file, { contentType: file.type || undefined })
  if (error) throw error
  return saveOperationsClient({ ...record, documents: { ...record.documents, [key]: { received: true, fileName: file.name, storagePath: path, updatedAt: new Date().toISOString() } } })
}

export function operationsProgress(record: OperationsClient): { tasks: number; documents: number; payment: number } {
  return { tasks: OPERATIONS_TASKS.filter(([key]) => record.tasks[key].completed).length, documents: OPERATIONS_DOCUMENTS.filter(([key]) => record.documents[key].received).length, payment: Number(record.contractDepositReceived) + Number(record.successFeeReceived) }
}
