/**
 * 급여 계산 — 원본 WageCalc 의 useMemo 본문(SubsidyApp.jsx 530~566 줄)을 순수 함수로 뽑았다.
 * 원본 화면(orig/SubsidyApp.jsx 급여 계산기)도 이 함수를 그대로 쓴다 — 계산은 한 곳에만 있다.
 *
 * D-136: 요율이 2025년 값이었는데 '2026년 기준' 이라고 적혀 있었다. 아래 한 묶음(RATES_2026)으로 모았다.
 * 소득세는 간이세액표 산식을 따라 근사한다 — 간이세액표 금액과 다를 수 있다(화면에 '근사치' 로 적는다).
 */

import { BOSU_FLOOR_2026, MIN_WAGE_2026 } from './constants'
import { monthlyHoursOf } from './eligibility'

/* ── 2026 기준 — 고시 확인 필요 ────────────────────────────────────────
 * 국민연금: 보험료율 9.5%(근로자·사업주 각 4.75%, 2026년부터 — 연금개혁), 기준소득월액 상한 637만 · 하한 40만(2025.7~2026.6 적용분)
 * 건강보험: 7.19%(근로자·사업주 각 3.595%)
 * 장기요양: 건강보험료 × 13.14%
 * 고용보험: 실업급여 근로자·사업주 각 0.9% + 사업주만 고용안정·직업능력개발 0.25%(150인 미만 기준)
 * 산재보험: 업종마다 다르다 — 기본 1.43% 로 두고 화면에 ★확인 표시
 */
export const RATES_2026 = {
  label: '2026 기준 — 고시 확인 필요',
  pensionEach: 0.0475,
  pensionBaseCap: 6370000,
  pensionBaseFloor: 400000,
  healthEach: 0.03595,
  careOfHealth: 0.1314,
  employEach: 0.009,
  /** 고용안정·직업능력개발(사업주만) — 150인 미만. 150인 이상은 0.45~0.85% */
  employStabilityEr: 0.0025,
  /** 산재 — 업종별. 기본값일 뿐이다 ★ */
  injuryEr: 0.0143,
} as const

/** 옛 이름 (다른 곳에서 읽을 수 있어 남긴다) */
export const PENSION_BASE_CAP = RATES_2026.pensionBaseCap
export const RATE_PENSION = RATES_2026.pensionEach
export const RATE_HEALTH = RATES_2026.healthEach
export const RATE_CARE_OF_HEALTH = RATES_2026.careOfHealth
export const RATE_EMPLOY = RATES_2026.employEach
export const RATE_EMPLOY_STABILITY_ER = RATES_2026.employStabilityEr
export const RATE_INJURY_ER = RATES_2026.injuryEr

/** 화면 표시용 요율 글자 (계산과 같은 숫자에서 만든다) */
const pct = (r: number) => `${Math.round(r * 100000) / 1000}%`
export const RATE_LABELS = {
  pension: pct(RATES_2026.pensionEach),
  health: pct(RATES_2026.healthEach),
  care: `건보×${pct(RATES_2026.careOfHealth)}`,
  employ: pct(RATES_2026.employEach),
  employStability: `${pct(RATES_2026.employStabilityEr)} (150인 미만)`,
  injury: `업종별 — 기본 ${pct(RATES_2026.injuryEr)}(★확인)`,
  note: '★ 2026년 요율 기준 · 고시로 확인',
  incomeTax: '근사치(간이세액표와 다를 수 있음)',
} as const

export interface PayrollResult {
  hourlyWage: number
  monthlyHours: number
  minMonthly: number
  isAboveMin: boolean
  isAboveFloor: boolean
  gap: number
  pension_ee: number
  health_ee: number
  care_ee: number
  employ_ee: number
  total4_ee: number
  pension_er: number
  health_er: number
  care_er: number
  employ_er: number
  /** 고용안정·직업능력개발 (사업주만) */
  employStab_er: number
  injury_er: number
  total4_er: number
  incomeTax: number
  localTax: number
  totalDeduct: number
  netPay: number
  totalEmployerCost: number
}

/** 근로소득공제 (소득세법 47조) */
export function earnedIncomeDeduction(annual: number): number {
  if (annual <= 5000000) return annual * 0.7
  if (annual <= 15000000) return 3500000 + (annual - 5000000) * 0.4
  if (annual <= 45000000) return 7500000 + (annual - 15000000) * 0.15
  if (annual <= 100000000) return 12000000 + (annual - 45000000) * 0.05
  return Math.min(20000000, 14750000 + (annual - 100000000) * 0.02)
}

/** 종합소득세 기본세율 (2023년 귀속부터) */
export function basicIncomeTax(taxBase: number): number {
  const b = Math.max(0, taxBase)
  if (b <= 14000000) return b * 0.06
  if (b <= 50000000) return 840000 + (b - 14000000) * 0.15
  if (b <= 88000000) return 6240000 + (b - 50000000) * 0.24
  if (b <= 150000000) return 15360000 + (b - 88000000) * 0.35
  if (b <= 300000000) return 37060000 + (b - 150000000) * 0.38
  if (b <= 500000000) return 94060000 + (b - 300000000) * 0.4
  if (b <= 1000000000) return 174060000 + (b - 500000000) * 0.42
  return 384060000 + (b - 1000000000) * 0.45
}

/** 근로소득세액공제 — 산출세액 기준 55%/30% + 총급여별 한도 (소득세법 59조) */
export function earnedIncomeTaxCredit(annTax: number, annual: number): number {
  const raw = annTax <= 1300000 ? annTax * 0.55 : 715000 + (annTax - 1300000) * 0.3
  let cap: number
  if (annual <= 33000000) cap = 740000
  else if (annual <= 70000000) cap = Math.max(660000, 740000 - (annual - 33000000) * 0.008)
  else if (annual <= 120000000) cap = Math.max(500000, 660000 - (annual - 70000000) * 0.5)
  else cap = Math.max(200000, 500000 - (annual - 120000000) * 0.5)
  return Math.min(raw, cap)
}

/**
 * 간이세액표 산식의 '특별소득공제 등' 표준값 — 공제대상가족 1명 기준 식만 쓴다.
 * (2명 이상은 간이세액표가 이보다 조금 더 공제한다 → 여기 결과가 조금 높게 나올 수 있다 ★)
 * 총급여 1억 2천만 원 초과는 넣지 않는다.
 */
export function standardSpecialDeduction(annual: number): number {
  if (annual <= 30000000) return 3100000 + annual * 0.04
  if (annual <= 45000000) return 3100000 + annual * 0.04 - (annual - 30000000) * 0.05
  if (annual <= 70000000) return 3100000 + annual * 0.015
  if (annual <= 120000000) return 3100000 + annual * 0.005
  return 0
}

export function computePayroll(monthlyPay: number, weeklyHours: number, dependents: number): PayrollResult | null {
  const raw = Number(monthlyPay)
  // 음수·글자는 0 으로 본다
  const monthly = Number.isFinite(raw) && raw > 0 ? raw : 0
  if (!monthly) return null
  const R = RATES_2026
  const mh = monthlyHoursOf(weeklyHours)
  const hourlyWage = Math.floor(monthly / mh)
  const minMonthly = MIN_WAGE_2026 * mh
  // 4대보험 근로자 (원 단위 반올림 근사 ★ 실제 고지는 절사 규칙이 있다)
  const pensionBase = Math.min(Math.max(monthly, R.pensionBaseFloor), R.pensionBaseCap)
  const pension_ee = Math.round(pensionBase * R.pensionEach)
  const health_ee = Math.round(monthly * R.healthEach)
  const care_ee = Math.round(health_ee * R.careOfHealth)
  const employ_ee = Math.round(monthly * R.employEach)
  const total4_ee = pension_ee + health_ee + care_ee + employ_ee
  // 4대보험 사업주
  const pension_er = pension_ee
  const health_er = health_ee
  const care_er = care_ee
  const employ_er = Math.round(monthly * R.employEach)
  const employStab_er = Math.round(monthly * R.employStabilityEr)
  const injury_er = Math.round(monthly * R.injuryEr)
  const total4_er = pension_er + health_er + care_er + employ_er + employStab_er + injury_er
  // 소득세 — 간이세액표 산식 근사 (근로소득공제 · 인적공제 150만×가족 · 연금보험료공제 · 특별소득공제 표준값 · 근로소득세액공제)
  const annual = monthly * 12
  const deps = Math.max(1, Math.floor(Number(dependents)) || 1)
  const taxBase = Math.max(0, annual - earnedIncomeDeduction(annual) - 1500000 * deps - pension_ee * 12 - standardSpecialDeduction(annual))
  const annTax = basicIncomeTax(taxBase)
  const credit = earnedIncomeTaxCredit(annTax, annual)
  const incomeTax = Math.max(0, Math.round((annTax - credit) / 12))
  const localTax = Math.round(incomeTax * 0.1)
  return {
    hourlyWage: hourlyWage,
    monthlyHours: mh,
    minMonthly: minMonthly,
    isAboveMin: monthly >= minMonthly,
    isAboveFloor: monthly >= BOSU_FLOOR_2026,
    gap: hourlyWage - MIN_WAGE_2026,
    pension_ee: pension_ee,
    health_ee: health_ee,
    care_ee: care_ee,
    employ_ee: employ_ee,
    total4_ee: total4_ee,
    pension_er: pension_er,
    health_er: health_er,
    care_er: care_er,
    employ_er: employ_er,
    employStab_er: employStab_er,
    injury_er: injury_er,
    total4_er: total4_er,
    incomeTax: incomeTax,
    localTax: localTax,
    totalDeduct: total4_ee + incomeTax + localTax,
    netPay: monthly - total4_ee - incomeTax - localTax,
    totalEmployerCost: monthly + total4_er,
  }
}
