/**
 * D-374 법인전환 검토 — 개인사업자의 사업소득으로 '지금 종합소득세' 와 '법인이면 법인세 + 대표 급여 세금' 을 나란히.
 *
 * 개인사업자 컨설팅에서 가장 흔한 제안거리인데 OS 에는 없었다(개인사업자에게는 '주주명부 · 대표 급여를 알면' 처럼 맞지 않는 말만 했다).
 *  - 개인: 세금 계산기 03(2026 소득세 · 종합)에 사업소득금액만 넣은 '종합소득세 총부담세액'(지방소득세 포함) — 계산기 식 그대로.
 *  - 법인 ① 다 가져갈 때: 이익 전부를 대표 급여로(월 = 이익 ÷ 12) — 법인세 0 · 급여 소득세 + 지방소득세(계산기 01 식). 제목 숫자는 이것(부풀리지 않게).
 *  - 법인 ② 회사에 남겨 둘 때: 대표 급여(월 100만 ~ 2,000만, 50만 단위)를 떼고 남은 이익의 법인세(2026 세율 · 계산기 05 식) + 지방소득세 10%
 *    + 급여 세금이 가장 작은 급여. 남는 이익은 회사 돈 — 가져가려면 배당세가 붙는다고 같이 말한다(올해 세금이 작아 보이는 까닭).
 *  - 세금만 비교한다 — 4대보험(개인도 지역가입으로 비슷하게 낸다) · 법인 운영비(기장 · 등기) · 전환 비용(현물출자 · 사업양수도 취득세)은 뺀다. 참고용 · 세무사 확인.
 * 세금 계산기 식은 바꾸지 않는다(D-341) — 계산기를 그대로 부른다. 규칙 계산 — 외부 호출 없음.
 */
import type { ClientOpsRecord } from '../types/clientOps'
import { clientFacts } from '../tools/shared/clientPrefill'
import { calculatorOf, computeSalary, corpTaxLocal, defaultValues } from './taxCalc'

/** 맞춤 추천 · 상황 예시가 법인전환을 '맞는 상황 · 검토해 볼 만함' 으로 올리는 1년 세금 차이(다 가져갈 때) */
export const CONVERT_MIN = 3_000_000

/** 개인사업자 사업소득(원) — 회사 정보 '순이익'(소득금액증명 · 직접 적음). 예상값이거나 없으면 0 */
export function businessIncomeOf(record: ClientOpsRecord, today: string): number {
  const n = clientFacts(record, new Date(`${today}T00:00:00`)).netIncome
  return n && !n.estimated && n.won > 0 ? n.won : 0
}

export interface ConvertCase {
  /** 대표 월 급여 */
  monthly: number
  /** 법인세 + 지방소득세 */
  corpTax: number
  /** 대표 급여 소득세 + 지방소득세 */
  salaryTax: number
  total: number
  /** 법인에 남는 이익(이익 − 급여 − 법인세) */
  kept: number
}

export interface ConvertResult {
  income: number
  /** 개인 종합소득세 총부담세액(지방소득세 포함) */
  personal: number
  /** ① 다 가져갈 때(이익 전부 급여) */
  all: ConvertCase
  /** ② 회사에 남겨 둘 때(세금 합이 가장 작은 급여) */
  keep: ConvertCase
  /** personal − all.total (양수면 법인이 덜 냄) — 제목 숫자 */
  saving: number
  /** personal − keep.total — 올해 세금만(남긴 돈은 나중에 배당세) */
  savingKeep: number
  /** 계산기에서 같은 숫자로 열 값 */
  open: { t9: Record<string, string>; t2: Record<string, string> }
}

/** 03 계산기 종합소득 칸에 사업소득만 */
export function personalValues(income: number): Record<string, string> {
  const p = 'inc_a'
  return {
    [`${p}_interest`]: '0',
    [`${p}_dividend`]: '0',
    [`${p}_business`]: String(Math.round(income)),
    [`${p}_salary`]: '0',
    [`${p}_pension`]: '0',
    [`${p}_other`]: '0',
    [`${p}_otherDed`]: '0',
    [`${p}_specialCredit`]: '0',
    [`${p}_otherCredit`]: '0',
  }
}

function personalTax(income: number): number {
  const calc = calculatorOf('t9')
  const sub = calc?.subs.find((s) => s.key === 'inc_a')
  if (!calc || !sub) return NaN
  const out = sub.compute({ ...defaultValues(calc), ...personalValues(income) })
  const v = out.blocks.find((b) => b.id === 'inc_a_out3')?.lines.find((l) => l.k === '종합소득세 총부담세액')?.v ?? ''
  const n = Number(v.replace(/[^\d-]/g, ''))
  return v && Number.isFinite(n) ? n : NaN
}

/** 법인세(2026 세율 — 계산기 05 와 같은 식) + 지방소득세 10% */
export function corpTaxWithLocal(profit: number): number {
  return Math.round(corpTaxLocal(Math.max(0, profit)) * 1.1)
}

function corpCase(income: number, monthly: number): ConvertCase {
  const annual = monthly * 12
  const r = computeSalary(monthly)
  const salaryTax = r.finalTax + r.localTax
  const corpTax = corpTaxWithLocal(income - annual)
  return { monthly, corpTax, salaryTax, total: corpTax + salaryTax, kept: Math.max(0, income - annual - corpTax) }
}

/** 사업소득금액(원) → 개인 vs 법인. 소득이 없거나 계산하지 못하면 null */
export function convertCompare(income: number): ConvertResult | null {
  if (!(income > 0)) return null
  const personal = personalTax(income)
  if (!Number.isFinite(personal)) return null
  const all = corpCase(income, Math.floor(income / 12))
  let keep: ConvertCase | null = null
  for (let m = 1_000_000; m <= 20_000_000 && m * 12 <= income; m += 500_000) {
    const c = corpCase(income, m)
    if (!keep || c.total < keep.total) keep = c
  }
  // 이익이 연 1,200만원도 안 되면 남겨 둘 것도 없다 — 다 가져갈 때와 같다
  if (!keep || keep.total >= all.total) keep = all
  return { income, personal, all, keep, saving: personal - all.total, savingKeep: personal - keep.total, open: { t9: personalValues(income), t2: { s_monthly: String(all.monthly) } } }
}

/**
 * 성실신고확인 대상 수입금액 기준(소득세법 시행령 제133조) — 개인사업자가 법인전환을 가장 많이 검토하는 계기.
 * 업종 글이 분명할 때만(애매하면 null — 짐작하지 않는다). 15억: 도 · 소매 · 농림어업 · 광업 · 부동산매매 /
 * 7억 5천: 제조 · 숙박 · 음식점 · 건설 · 운수 · 출판 · 방송통신 · 정보서비스(소프트웨어) · 금융보험 · 전기가스수도 /
 * 5억: 부동산임대 · 전문 · 과학기술서비스(컨설팅 · 디자인 · 광고) · 사업시설관리 · 교육 · 보건 · 예술 · 스포츠 · 수리 · 개인서비스.
 */
const DILIGENT: { limit: number; label: string; re: RegExp }[] = [
  { limit: 1_500_000_000, label: '도 · 소매 · 농림어업 등', re: /도매|소매|전자상거래|쇼핑몰|농업|임업|어업|광업|부동산\s*매매/ },
  { limit: 750_000_000, label: '제조 · 음식 · 건설 · 정보통신 등', re: /제조|숙박|음식|식당|카페|건설|공사|운수|운송|물류|출판|방송|통신|소프트웨어|정보\s*서비스|금융|보험|전기|가스|수도/ },
  { limit: 500_000_000, label: '서비스업(임대 · 전문 · 교육 · 보건 등)', re: /부동산\s*임대|임대업|전문\s*서비스|과학|기술\s*서비스|컨설팅|디자인|광고|사업\s*시설|사업\s*지원|교육|학원|보건|의료|병원|의원|예술|스포츠|여가|협회|수리|미용|개인\s*서비스/ },
]

export function diligentLimitOf(industryText: string): { limit: number; label: string } | null {
  const t = (industryText ?? '').trim()
  if (!t) return null
  const hits = DILIGENT.filter((d) => d.re.test(t))
  // 두 무리에 걸치면(예: '제조 · 도매') 어느 기준인지 모른다 — 말하지 않는다
  return hits.length === 1 ? { limit: hits[0].limit, label: hits[0].label } : null
}

/** 매출(수입금액) · 업종 → '성실신고확인 대상' 한 줄. 모르면 '' */
export function diligentLine(revenue: number, industryText: string, fmt: (won: number) => string): string {
  const d = diligentLimitOf(industryText)
  if (!d || !(revenue > 0)) return ''
  if (revenue >= d.limit) return `매출 ${fmt(revenue)} — 성실신고확인 대상(${d.label} ${fmt(d.limit)} 이상) · 법인전환을 많이 검토하는 구간`
  if (revenue >= d.limit * 0.7) return `매출 ${fmt(revenue)} — 성실신고확인 기준(${d.label} ${fmt(d.limit)})까지 ${fmt(d.limit - revenue)} 남음`
  return ''
}
