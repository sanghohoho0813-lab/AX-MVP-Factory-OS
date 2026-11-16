/**
 * D-620 정책자금 진단에 남긴 답 — 진단 화면과 업체 맞춤 추천(카드 · AI 도우미 자료)이 같이 쓴다.
 *
 * 예전에는 카드가 업체 기록만 보고 따로 진단해, 진단 화면에서 매출 · 신용을 답해 1순위 기관이 바뀌어도
 * 카드는 예전 기관 · '매출을 알면 더 정확해요' 그대로였다. 이제 두 곳 모두:
 *   남긴 답(이 브라우저 · 업체 기록에 붙인 것 가운데 새것) → 업체 기록으로 빈 칸만 채움(`prefillPolicyInput`) → `runDiagnosis`.
 * 규칙(엔진)은 그대로다 — 여기는 입력을 만드는 곳이다. 규칙 계산이다 — AI 가 아니다.
 */
import type { ClientOpsRecord } from '../../../types/clientOps'
import type { ClientFacts } from '../../shared/clientPrefill'
import { sharedToolKey } from '../../shared/toolStorage'
import { policyEvidence } from '../../../services/policyEvidence'
import { ceoAgeBand, employeesBand, lastYearRevenueBand, revenueBand, yearsBand } from '../clientInput'
import { DEFAULT_INPUT } from '../diagnosis'
import type { DiagnosisInput } from '../types'

const STORAGE_KEY = 'axmvp.tools.policyFunding'
/** D-126: 업체마다 따로 기억한다 — 예전에는 브라우저에 하나라 다른 업체로 열어도 앞 업체 답이 그대로 보였다 */
export const policyInputKey = (clientId: string | null | undefined) => (clientId ? `${STORAGE_KEY}.${clientId}` : sharedToolKey(STORAGE_KEY))

/**
 * D-215: 사람이 직접 바꾼 칸 — 업체 정보로 채울 때 건드리지 않는다.
 * 이 도구는 기본값이 빈 값이 아니라(개인사업자 · 1~3년 · 1~4명) '기본값과 같으면 안 고친 칸' 으로 봤는데,
 * 일부러 고른 '개인사업자' · '1~3년' 이 기본값과 같아 다시 열 때마다 업체 정보(법인 · 5년)로 바뀌었다.
 */
export const policyTouchedKey = (clientId: string | null | undefined) => `${policyInputKey(clientId)}:touched`
export function loadPolicyTouched(clientId: string | null | undefined): Set<string> {
  try {
    const raw = localStorage.getItem(policyTouchedKey(clientId))
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

/** 이 브라우저에 남긴 입력(없거나 읽지 못하면 null) */
export function loadPolicyInputRaw(clientId: string | null | undefined): Partial<DiagnosisInput> | null {
  try {
    const raw = localStorage.getItem(policyInputKey(clientId))
    const v = raw ? (JSON.parse(raw) as unknown) : null
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Partial<DiagnosisInput>) : null
  } catch {
    return null
  }
}

/**
 * 사람이 답을 고친 때(이 브라우저) — 업체 기록에 붙인 답과 견줄 때 쓴다.
 *   null = 적어 둔 때가 없다(이 표시가 생기기 전의 기록) · '' = 화면을 열기만 했다(아직 답하지 않음) · 그 밖 = 고친 때.
 */
const savedAtKey = (clientId: string | null | undefined) => `${policyInputKey(clientId)}:at`
export function policySavedAt(clientId: string | null | undefined): string | null {
  try {
    return localStorage.getItem(savedAtKey(clientId))
  } catch {
    return null
  }
}
export function markPolicySavedAt(clientId: string | null | undefined, at: string): void {
  try {
    localStorage.setItem(savedAtKey(clientId), at)
  } catch {
    /* 못 적어도 진단은 된다 */
  }
}

/**
 * 업체 기록으로 채운다(D-90 · D-128 · D-215 · D-306 · D-307 · D-310 · D-311 · D-381 그대로) — **아직 손대지 않은 칸만**.
 * 진단 화면과 맞춤 추천 카드가 같이 쓴다. filled 는 '무엇을 채웠나' 한 줄에 쓴다.
 */
export function prefillPolicyInput(base0: DiagnosisInput, facts: ClientFacts, opts: { touched: ReadonlySet<string>; record: ClientOpsRecord | null; today: string }): { next: DiagnosisInput; filled: string[] } {
  const filled: string[] = []
  // D-215: 사람이 바꾼 칸은 '기본값이 아닌 것' 처럼 다룬다 — 아래 '기본값과 같으면 채움' 비교에서 빠지게
  const t = opts.touched
  const base = { ...base0 }
  const next = { ...base }
  const isUntouched = (k: keyof DiagnosisInput) => !t.has(k as string)
  if (!next.companyName && facts.companyName) {
    next.companyName = facts.companyName
    filled.push('업체명')
  }
  if (!next.industry && facts.industryText) {
    next.industry = facts.industryText
    filled.push('업종')
  }
  if (isUntouched('businessType') && next.businessType === DEFAULT_INPUT.businessType && facts.businessType === 'corporation') {
    next.businessType = '법인사업자'
    filled.push('사업자 유형')
  }
  const years = yearsBand(facts.years)
  if (isUntouched('years') && next.years === DEFAULT_INPUT.years && years) {
    next.years = years
    filled.push('업력')
  }
  const emp = employeesBand(facts.employeeCount)
  if (isUntouched('employees') && next.employees === DEFAULT_INPUT.employees && emp) {
    next.employees = emp
    filled.push('직원 수')
  }
  // D-128: 매출 · 순이익은 사실 창고에서 — 확인됨 · 적어 둔 값만(예상값은 넣지 않는다)
  const rev = facts.revenue && !facts.revenue.estimated ? facts.revenue.won : null
  if (rev !== null) {
    const band = revenueBand(rev)
    if (isUntouched('revenue') && next.revenue === DEFAULT_INPUT.revenue && band !== next.revenue) {
      next.revenue = band
      filled.push('매출 규모')
    }
    if ((next.lastYearRevenue ?? '미확인') === '미확인') {
      next.lastYearRevenue = lastYearRevenueBand(rev)
      filled.push(`작년 매출${facts.revenue?.asOf ? `(${facts.revenue.asOf})` : ''}`)
    }
  }
  const ni = facts.netIncome && !facts.netIncome.estimated ? facts.netIncome.won : null
  if (ni !== null && (next.netProfit ?? '미확인') === '미확인') {
    next.netProfit = ni > 0 ? '흑자' : ni < 0 ? '적자' : '손익분기'
    filled.push('순이익')
  }
  const age = ceoAgeBand(facts.representativeAge)
  if ((next.ceoAge ?? '미확인') === '미확인' && age) {
    next.ceoAge = age
    filled.push('대표 나이')
  }
  // D-306 서류함 납세증명서 · 완납증명서 → 체납 없음 · 자본잠식 → 부채비율 높음(맞춤 추천과 같은 근거) — 아직 '미확인' 인 칸만
  if (opts.record) {
    const ev = policyEvidence(opts.record, facts, opts.today)
    const put = <K extends 'taxArrears' | 'insuranceArrears' | 'debtRatioStatus' | 'youthEmployment' | 'creditBand'>(k: K, label: string) => {
      const v = ev.input[k]
      if (v && isUntouched(k) && (next[k] ?? '미확인') === '미확인') {
        next[k] = v as DiagnosisInput[K]
        filled.push(label)
      }
    }
    put('taxArrears', '세금 체납 없음(납세증명서)')
    put('insuranceArrears', '4대보험 체납 없음(완납증명서)')
    put('debtRatioStatus', '부채비율 높음(자본잠식)')
    // D-310 4대보험 명부 — 직원이 늘었으면 강점 '고용 증가'(고른 강점은 그대로 두고 더한다) · 청년 직원이 있으면 청년 고용 '있음'
    if (ev.input.strengths?.length && isUntouched('strengths') && ev.input.strengths.some((x) => !next.strengths.includes(x))) {
      next.strengths = [...next.strengths.filter((x) => x !== '없음' && !ev.input.strengths?.includes(x)), ...ev.input.strengths]
      filled.push('강점 고용 증가(4대보험 명부)')
    }
    put('youthEmployment', '청년 고용 있음(4대보험 명부)')
    // D-381 대표 신용점수 조회서 → 대표 신용 칸(아직 '미확인' 일 때만)
    if (ev.input.creditBand) put('creditBand', `대표 신용 ${ev.input.creditBand}(신용점수 조회서)`)
    // D-311 서류함에 있는 준비 서류 → 자료 체크 '확보' — 사람이 고르는 칸이 아니라 늘 지금 서류함대로
    const docs = ev.input.haveDocs ?? []
    if (docs.join() !== (next.haveDocs ?? []).join()) {
      next.haveDocs = docs
      if (docs.length) filled.push(`준비 서류 ${docs.length}가지(서류함)`)
    }
    // D-307 가점(특허 · 연구소 · 벤처 · 이노비즈 …) — 아직 아무것도 고르지 않았을 때만
    if (ev.input.bonusItems?.length && isUntouched('bonusItems') && (next.bonusItems ?? []).filter((b) => b !== '없음').length === 0) {
      next.bonusItems = ev.input.bonusItems
      filled.push(`가점(${ev.input.bonusItems.join(' · ')})`)
    }
  }
  return { next, filled }
}

/** 업체 기록에 붙인 정책자금 진단의 입력(가장 최근 것) — 진단 화면은 붙일 때 입력을 같이 싣는다 */
export function attachedPolicyInput(record: Pick<ClientOpsRecord, 'toolResults'> | null | undefined): { input: Partial<DiagnosisInput>; touched: string[]; at: string } | null {
  let best: { input: Partial<DiagnosisInput>; touched: string[]; at: string } | null = null
  for (const r of record?.toolResults ?? []) {
    if (r.toolKey !== 'policy-funding') continue
    const d = r.data as { input?: unknown; touched?: unknown } | null
    if (!d?.input || typeof d.input !== 'object' || Array.isArray(d.input)) continue
    if (best && Date.parse(r.createdAt) <= Date.parse(best.at)) continue
    best = { input: d.input as Partial<DiagnosisInput>, touched: Array.isArray(d.touched) ? d.touched.filter((x): x is string => typeof x === 'string') : [], at: r.createdAt }
  }
  return best
}

export interface PickedPolicy {
  input: DiagnosisInput
  touched: Set<string>
  /** local = 이 브라우저의 답 · record = 업체 기록에 붙인 답 */
  from: 'local' | 'record'
  at: string
}

/**
 * 이 업체의 진단 입력 — 이 브라우저에 남긴 것과 업체 기록에 붙인 것 가운데 새것(없으면 null).
 * 고친 때를 모르는 예전 기록은 이 브라우저 것이 먼저(예전에 붙인 결과가 더 옛것일 수 있다). 열기만 한 것(답 없음)은 붙인 답에 진다.
 */
export function savedPolicyFor(record: Pick<ClientOpsRecord, 'id' | 'toolResults'>): PickedPolicy | null {
  const local = loadPolicyInputRaw(record.id)
  const at = policySavedAt(record.id)
  const att = attachedPolicyInput(record)
  if (local && (!att || at === null || (at !== '' && Date.parse(at) >= Date.parse(att.at)))) return { input: { ...DEFAULT_INPUT, ...local }, touched: loadPolicyTouched(record.id), from: 'local', at: at ?? '' }
  if (att) return { input: { ...DEFAULT_INPUT, ...att.input }, touched: new Set(att.touched), from: 'record', at: att.at }
  return null
}
