/**
 * 원본 lib/storage.ts 자리 (D-92).
 *
 * 원본은 상담 고객 명단을 localStorage(`pfos.customers.v1`)에 따로 들고 있었다.
 * 이 OS 에서는 업체가 고객 운영 하나뿐이라, **고객 = 고객 운영 업체**다:
 *   - 고객 id 는 고객 운영 업체 id 와 같다
 *   - 기록은 모듈 기록(`policy-funding` · `consults`)에 업체별 한 줄로 남는다 — D-91 상담 기록과 같은 줄이라 옛 기록도 그대로 보인다
 *   - 회사명은 고객 운영 기록을 비춘다
 * 화면 코드가 부르던 함수 이름(getStoredCustomers · saveCustomer …)은 원본 그대로 둔다.
 */

import type { Customer, CustomerStage, DiagnosisInput, DiagnosisResult } from '../types'
import { CUSTOMER_STAGES } from '../types'
import { deleteRow, listRows, saveRow } from '../../../services/moduleData'
import type { ClientOpsRecord } from '../../../types/clientOps'

const MODULE = 'policy-funding'
const BUCKET = 'consults'
const EVENT = 'pfos:customers'
const EMPTY: Customer[] = []

let cacheVal: Customer[] = EMPTY
let workspace: string | null = null
let osClients: ClientOpsRecord[] = []
const rowIdOf = new Map<string, string>()

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function isStage(v: unknown): v is CustomerStage {
  return typeof v === 'string' && (CUSTOMER_STAGES as readonly string[]).includes(v)
}

/** 모듈 기록 한 줄 → 원본 고객 모양 (D-91 상담 기록도 받아 준다) */
export function customerFromRow(clientId: string, data: Record<string, unknown>, os?: ClientOpsRecord): Customer {
  const str = (k: string, d = '') => (typeof data[k] === 'string' ? (data[k] as string) : d)
  const today = todayStr()
  return {
    ...(data as Partial<Customer>),
    id: clientId,
    companyName: os?.companyName || str('companyName', '고객사'),
    industry: str('industry') || os?.industry || '-',
    businessType: data.businessType === '법인사업자' || data.businessType === '개인사업자' ? data.businessType : os?.corporateNumber ? '법인사업자' : '개인사업자',
    recommendedAgency: str('recommendedAgency') || str('topAgency') || '-',
    score: typeof data.score === 'number' ? data.score : 0,
    stage: isStage(data.stage) ? data.stage : '신규 DB',
    nextAction: str('nextAction'),
    lastContactedAt: str('lastContactedAt') || today,
    updatedAt: str('updatedAt') || today,
    upsellOpportunities: Array.isArray(data.upsellOpportunities) ? (data.upsellOpportunities as string[]) : [],
    memo: str('memo'),
  }
}

function emit(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

function persist(c: Customer): void {
  // D-91 화면·대시보드가 읽던 이름(topAgency)도 같이 적어 둔다
  const data = { ...c, topAgency: c.recommendedAgency } as unknown as Record<string, unknown>
  void saveRow(workspace, MODULE, BUCKET, { id: rowIdOf.get(c.id), clientId: c.id, data })
    .then((row) => {
      rowIdOf.set(c.id, row.id)
    })
    .catch(() => undefined)
}

// 캐시된 스냅샷 — 값이 바뀔 때만 새 배열이다 (useSyncExternalStore 무한 렌더 방지)
export function getStoredCustomers(): Customer[] {
  return cacheVal
}

export function getServerCustomers(): Customer[] {
  return EMPTY
}

export function subscribeCustomers(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(EVENT, callback)
  return () => window.removeEventListener(EVENT, callback)
}

export function getStoredCustomerById(id: string): Customer | undefined {
  return cacheVal.find((c) => c.id === id)
}

// 신규 저장 또는 동일 id 덮어쓰기(업서트)
export function saveCustomer(customer: Customer): void {
  const list = cacheVal.slice()
  const idx = list.findIndex((c) => c.id === customer.id)
  if (idx >= 0) list[idx] = customer
  else list.unshift(customer)
  cacheVal = list
  persist(customer)
  emit()
}

export function updateCustomer(id: string, patch: Partial<Customer>): Customer | undefined {
  const list = cacheVal.slice()
  const idx = list.findIndex((c) => c.id === id)
  if (idx < 0) return undefined
  const updated: Customer = { ...list[idx], ...patch, updatedAt: todayStr() }
  list[idx] = updated
  cacheVal = list
  persist(updated)
  emit()
  return updated
}

/** 상담 기록만 지운다 — 고객 운영 업체는 그대로 남는다 */
export function deleteCustomer(id: string): void {
  cacheVal = cacheVal.filter((c) => c.id !== id)
  const rowId = rowIdOf.get(id)
  rowIdOf.delete(id)
  if (rowId) void deleteRow(workspace, MODULE, BUCKET, rowId).catch(() => undefined)
  emit()
}

// 진단 결과(input + result)를 고객 레코드로 변환 — 이 OS 에서는 고객 운영 업체를 골라야 한다
export function buildCustomerFromDiagnosis(
  input: DiagnosisInput,
  result: DiagnosisResult,
  opts?: { quickInput?: DiagnosisInput; deepInput?: DiagnosisInput; clientId?: string },
): Customer {
  const today = todayStr()
  const os = opts?.clientId ? osClients.find((c) => c.id === opts.clientId) : undefined
  const prev = opts?.clientId ? getStoredCustomerById(opts.clientId) : undefined
  return {
    id: opts?.clientId ?? '',
    companyName: os?.companyName || input.companyName || result.companyName || '고객사',
    industry: input.industry || '-',
    businessType: input.businessType,
    recommendedAgency: result.topAgency,
    score: result.overallScore,
    // 이미 상담 중인 업체면 단계·연락 기록을 이어 간다
    stage: prev && prev.stage !== '신규 DB' ? prev.stage : '1차 상담 완료',
    nextAction: result.nextAction,
    lastContactedAt: today,
    updatedAt: today,
    upsellOpportunities: result.upsells.map((u) => u.title),
    memo: prev?.memo || input.memo,
    consultationChecklist: prev?.consultationChecklist,
    leadReaction: prev?.leadReaction,
    closingScore: prev?.closingScore,
    diagnosisInput: input,
    diagnosisResult: result,
    quickDiagnosisInput: opts?.quickInput,
    deepDiagnosisInput: opts?.deepInput,
    likelihoodLevel: result.likelihoodLevel,
    specialFundingTracks: result.specialTracks,
  }
}

/* ───────── 이 OS 쪽 ───────── */

export function pfOsClients(): ClientOpsRecord[] {
  return osClients
}

/** 정책자금 화면을 열기 전에 한 번 — 모듈 기록을 읽어 원본 명단 모양으로 */
export async function hydratePolicyStore(workspaceId: string | null, clients: ClientOpsRecord[]): Promise<void> {
  workspace = workspaceId
  osClients = clients
  const rows = await listRows(workspaceId, MODULE, BUCKET)
  rowIdOf.clear()
  const byId = new Map(clients.map((c) => [c.id, c]))
  const list: Customer[] = []
  for (const r of rows) {
    if (!r.clientId) continue
    const os = byId.get(r.clientId)
    // 고객 운영에서 지운 업체의 상담 기록은 보이지 않는다 (기록 자체는 남는다)
    if (!os) continue
    rowIdOf.set(r.clientId, r.id)
    list.push(customerFromRow(r.clientId, r.data, os))
  }
  list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  cacheVal = list
  emit()
}

/** 시험용 */
export function resetPolicyStoreForTest(list: Customer[], clients: ClientOpsRecord[] = []): void {
  cacheVal = list
  osClients = clients
  rowIdOf.clear()
}
