import type { Organization } from '../types/domain'
import { STORAGE_KEYS, generateId, notifyStoreChanged, readJson, writeJson } from '../storage/localStore'

export const CLIENT_SETUP_TASKS = [
  { key: 'patent', label: '특허 출원', description: '발명 내용 정리, 선행기술 검토, 출원 진행' },
  { key: 'venture', label: '벤처인증 혁신성장유형', description: '요건 점검, 평가 자료 준비, 신청' },
  { key: 'ax', label: 'AX 기획 및 개발', description: '진단, 우선과제, 설계·개발·검증' },
  { key: 'businessScope', label: '업종 추가·법인 목적사항', description: '사업자등록증 업종 추가와 법인등기 목적사항 반영' },
  { key: 'incorporation', label: '법인설립', description: '필요한 경우에만 설립 절차와 초기 서류 진행' },
] as const

export type ClientSetupTaskKey = (typeof CLIENT_SETUP_TASKS)[number]['key']
export type ClientDocumentKey =
  | 'businessRegistration'
  | 'corporateRegistry'
  | 'representativeId'
  | 'representativePhone'
  | 'businessNumber'
  | 'corporateNumber'
  | 'jointCertificate'
  | 'businessAddress'
  | 'smeCertificate'
  | 'healthInsurance'

export const CLIENT_DOCUMENTS: { key: ClientDocumentKey; label: string; requiredForFunding?: boolean }[] = [
  { key: 'businessRegistration', label: '사업자등록증', requiredForFunding: true },
  { key: 'corporateRegistry', label: '법인등기부등본', requiredForFunding: true },
  { key: 'representativeId', label: '대표자 신분증 사본', requiredForFunding: true },
  { key: 'representativePhone', label: '대표자 휴대폰번호' },
  { key: 'businessNumber', label: '사업자등록번호' },
  { key: 'corporateNumber', label: '법인번호', requiredForFunding: true },
  { key: 'jointCertificate', label: '공동인증서 전달', requiredForFunding: true },
  { key: 'businessAddress', label: '사업장 주소' },
  { key: 'smeCertificate', label: '중소기업 확인서', requiredForFunding: true },
  { key: 'healthInsurance', label: '대표자 건강보험득실확인서', requiredForFunding: true },
]

export interface ClientSetupTaskState {
  completed: boolean
  dueDate: string
  note: string
}

export interface ClientDocumentState {
  received: boolean
  note: string
  fileName: string | null
  storagePath: string | null
  uploadedAt: string | null
}

export interface ClientContractState {
  depositAmount: number | null
  depositReceived: boolean
  depositDueDate: string
  successFeeAmount: number | null
  successFeeReceived: boolean
  successFeeDueDate: string
  note: string
}

export interface ClientOperationsRecord {
  organizationId: string
  corporateNumber: string
  representativePhone: string
  businessAddress: string
  tasks: Record<ClientSetupTaskKey, ClientSetupTaskState>
  documents: Record<ClientDocumentKey, ClientDocumentState>
  contract: ClientContractState
  updatedAt: string
}

export interface ClientOperationsSummary {
  taskCompleted: number
  taskTotal: number
  documentReceived: number
  documentTotal: number
  fundingDocumentReceived: number
  fundingDocumentTotal: number
  paymentAttentionCount: number
  missingLabels: string[]
}

const EMPTY_TASK = (): ClientSetupTaskState => ({ completed: false, dueDate: '', note: '' })
const EMPTY_DOCUMENT = (): ClientDocumentState => ({ received: false, note: '', fileName: null, storagePath: null, uploadedAt: null })

function createRecord(organization: Organization): ClientOperationsRecord {
  return {
    organizationId: organization.id,
    corporateNumber: '',
    representativePhone: organization.primaryContact.phone,
    businessAddress: organization.address,
    tasks: Object.fromEntries(CLIENT_SETUP_TASKS.map(({ key }) => [key, EMPTY_TASK()])) as ClientOperationsRecord['tasks'],
    documents: Object.fromEntries(CLIENT_DOCUMENTS.map(({ key }) => [key, EMPTY_DOCUMENT()])) as ClientOperationsRecord['documents'],
    contract: {
      depositAmount: null,
      depositReceived: false,
      depositDueDate: '',
      successFeeAmount: null,
      successFeeReceived: false,
      successFeeDueDate: '',
      note: '',
    },
    updatedAt: new Date(0).toISOString(),
  }
}

function records(): Record<string, ClientOperationsRecord> {
  return readJson<Record<string, ClientOperationsRecord>>(STORAGE_KEYS.clientOperations, {})
}

function persist(next: Record<string, ClientOperationsRecord>): void {
  writeJson(STORAGE_KEYS.clientOperations, next)
  notifyStoreChanged()
}

export function getClientOperations(organization: Organization): ClientOperationsRecord {
  const current = records()[organization.id]
  if (!current) return createRecord(organization)
  const fallback = createRecord(organization)
  return {
    ...fallback,
    ...current,
    tasks: { ...fallback.tasks, ...current.tasks },
    documents: { ...fallback.documents, ...current.documents },
    contract: { ...fallback.contract, ...current.contract },
  }
}

export function updateClientOperations(
  organization: Organization,
  update: (current: ClientOperationsRecord) => ClientOperationsRecord,
): ClientOperationsRecord {
  const all = records()
  const next = { ...update(getClientOperations(organization)), updatedAt: new Date().toISOString() }
  all[organization.id] = next
  persist(all)
  return next
}

export function buildClientOperationsSummary(record: ClientOperationsRecord): ClientOperationsSummary {
  const taskCompleted = CLIENT_SETUP_TASKS.filter(({ key }) => record.tasks[key].completed).length
  const documentReceived = CLIENT_DOCUMENTS.filter(({ key }) => record.documents[key].received).length
  const fundingDocuments = CLIENT_DOCUMENTS.filter((document) => document.requiredForFunding)
  const fundingDocumentReceived = fundingDocuments.filter(({ key }) => record.documents[key].received).length
  const paymentAttentionCount = [
    record.contract.depositAmount !== null && !record.contract.depositReceived,
    record.contract.successFeeAmount !== null && !record.contract.successFeeReceived,
  ].filter(Boolean).length
  return {
    taskCompleted,
    taskTotal: CLIENT_SETUP_TASKS.length,
    documentReceived,
    documentTotal: CLIENT_DOCUMENTS.length,
    fundingDocumentReceived,
    fundingDocumentTotal: fundingDocuments.length,
    paymentAttentionCount,
    missingLabels: CLIENT_DOCUMENTS.filter(({ key }) => !record.documents[key].received).slice(0, 4).map(({ label }) => label),
  }
}

function filePath(organizationId: string, file: File): string {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100) || 'document'
  return `${organizationId}/${generateId()}-${safeName}`
}

/**
 * 민감 서류는 로컬에 보관하지 않고, Supabase Storage 업로드가 성공할 때만 첨부 상태를 기록한다.
 * 인증서 비밀번호처럼 비밀값은 이 서비스에서 취급하지 않는다.
 */
export async function uploadClientDocument(
  organization: Organization,
  key: ClientDocumentKey,
  file: File,
): Promise<ClientOperationsRecord> {
  const { getDataModeConfig } = await import('../data/dataMode')
  const config = getDataModeConfig()
  if (config.mode !== 'supabase') {
    throw new Error('서류 첨부는 Supabase 클라우드 저장 모드에서 사용할 수 있습니다.')
  }
  const { getSupabaseClient } = await import('../lib/supabase/client')
  const bucket = (import.meta.env.VITE_SUPABASE_DOCUMENTS_BUCKET as string | undefined)?.trim() || 'client-documents'
  const path = filePath(organization.id, file)
  const { error } = await getSupabaseClient().storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw new Error(`서류 업로드에 실패했습니다: ${error.message}`)
  return updateClientOperations(organization, (current) => ({
    ...current,
    documents: {
      ...current.documents,
      [key]: {
        ...current.documents[key],
        received: true,
        fileName: file.name,
        storagePath: path,
        uploadedAt: new Date().toISOString(),
      },
    },
  }))
}
