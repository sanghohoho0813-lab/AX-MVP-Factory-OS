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
import { DEFAULT_INPUT, runDiagnosis } from '../diagnosis'
import { deleteRow, listRows, saveRow } from '../../../services/moduleData'
import { generateId } from '../../../storage/localStore'
import type { ClientOpsRecord, ToolResult } from '../../../types/clientOps'

const MODULE = 'policy-funding'
const BUCKET = 'consults'
const EVENT = 'pfos:customers'
const EMPTY: Customer[] = []

let cacheVal: Customer[] = EMPTY
let workspace: string | null = null
let osClients: ClientOpsRecord[] = []
const rowIdOf = new Map<string, string>()
/** D-224 업체별 저장 차례 — 먼저 누른 저장의 응답이 늦게 와도 나중 것을 덮지 않게 */
const chainOf = new Map<string, Promise<unknown>>()

/** 오늘 날짜(YYYY-MM-DD) — D-136: 이 기기의 날짜로 (UTC 로 자르면 한국 아침 9시 전에는 어제가 된다) */
export function todayStr(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
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
    // D-216: 연락한 날을 모르면 빈 칸 — 예전에는 오늘로 채워 상세 화면에서 저장하면 '오늘 연락함' 이 됐다(2주 넘게 조용 · 진단일도 틀어짐)
    lastContactedAt: str('lastContactedAt'),
    updatedAt: str('updatedAt') || today,
    upsellOpportunities: Array.isArray(data.upsellOpportunities) ? (data.upsellOpportunities as string[]) : [],
    memo: str('memo'),
  }
}

function emit(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

/** 저장이 끝나면 true · 실패하면 false — D-224: 예전에는 실패를 삼켜 '저장되었습니다' 만 떴다(새로고침하면 사라짐) */
function persist(c: Customer): Promise<boolean> {
  // D-91 화면·대시보드가 읽던 이름(topAgency)도 같이 적어 둔다
  const data = { ...c, topAgency: c.recommendedAgency } as unknown as Record<string, unknown>
  // D-165: 줄 id 를 저장 전에 정한다 — 첫 저장이 돌아오기 전에 또 저장하면 같은 업체 줄이 둘 생겼다
  const id = rowIdOf.get(c.id) ?? generateId()
  rowIdOf.set(c.id, id)
  const ws = workspace
  const run = (chainOf.get(c.id) ?? Promise.resolve()).then(() =>
    saveRow(ws, MODULE, BUCKET, { id, clientId: c.id, data }).then(
      () => true,
      () => false,
    ),
  )
  chainOf.set(c.id, run)
  return run
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

// 신규 저장 또는 동일 id 덮어쓰기(업서트) — 화면은 바로 바뀌고, 돌려주는 약속은 실제로 저장됐는지(true/false)
export function saveCustomer(customer: Customer): Promise<boolean> {
  const list = cacheVal.slice()
  const idx = list.findIndex((c) => c.id === customer.id)
  if (idx >= 0) list[idx] = customer
  else list.unshift(customer)
  cacheVal = list
  const done = persist(customer)
  emit()
  return done
}

export function updateCustomer(id: string, patch: Partial<Customer>): Customer | undefined {
  const list = cacheVal.slice()
  const idx = list.findIndex((c) => c.id === id)
  if (idx < 0) return undefined
  const updated: Customer = { ...list[idx], ...patch, updatedAt: todayStr() }
  list[idx] = updated
  cacheVal = list
  void persist(updated)
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

/**
 * D-237 결과서가 읽을 이 업체의 진단 — 상담으로 저장한 진단이 먼저, 없으면 업체 기록에 마지막으로 붙인 진단(그 입력으로 다시 계산).
 * 예전에는 [업체 기록에 붙이기] 만 누른 업체의 결과서가 '저장한 상담이 없습니다' 로 비었다. 둘 다 없으면 null.
 */
export function reportCustomerFor(clientId: string, toolResults: readonly ToolResult[] | undefined): Customer | null {
  const stored = getStoredCustomerById(clientId)
  if (stored?.diagnosisResult) return stored
  // 새것이 앞에 붙는다(withToolResult)
  const last = (toolResults ?? [])
    .filter((r) => r.toolKey === 'policy-funding')
    .map((r) => ({ at: r.createdAt, input: (r.data as { input?: Partial<DiagnosisInput> } | null)?.input }))
    .find((x): x is { at: string; input: Partial<DiagnosisInput> } => !!x.input && typeof x.input === 'object')
  if (!last) return stored ?? null
  const input: DiagnosisInput = { ...DEFAULT_INPUT, ...last.input }
  const day = Number.isNaN(Date.parse(last.at)) ? todayStr() : todayStr(new Date(last.at))
  const c = buildCustomerFromDiagnosis(input, runDiagnosis(input), { clientId })
  // 진단일 = 붙인 날(오늘이 아니라) · 상담으로 저장한 적 없으면 단계는 '1차 상담 완료' 그대로
  return { ...c, lastContactedAt: stored?.lastContactedAt || day, updatedAt: day }
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
    // 새것부터 온다 — 같은 업체 줄이 둘이면(예전 겹친 줄) 새것 하나만
    if (rowIdOf.has(r.clientId)) continue
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
