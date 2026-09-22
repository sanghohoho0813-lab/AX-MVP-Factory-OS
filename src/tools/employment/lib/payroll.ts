/**
 * 급여 계산 — 원본 WageCalc 의 useMemo 본문(SubsidyApp.jsx 530~566 줄)을 순수 함수로 뽑았다.
 *
 * 2026년 4대보험 요율·근로소득세 구간·근로소득세액공제 식을 숫자 하나 바꾸지 않았다.
 * 소득세는 간이세액표 근사다 — 실제 원천징수액과 차이가 날 수 있다.
 */

import { BOSU_FLOOR_2026, MIN_WAGE_2026 } from './constants'

/** 국민연금 기준소득월액 상한 (2026 표 기준값 그대로) */
export const PENSION_BASE_CAP = 5900000
export const RATE_PENSION = 0.045
export const RATE_HEALTH = 0.03545
export const RATE_CARE_OF_HEALTH = 0.1295
export const RATE_EMPLOY = 0.009
export const RATE_INJURY_ER = 0.0143

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
  injury_er: number
  total4_er: number
  incomeTax: number
  localTax: number
  totalDeduct: number
  netPay: number
  totalEmployerCost: number
}

export function computePayroll(monthlyPay: number, weeklyHours: number, dependents: number): PayrollResult | null {
  const monthly = Number(monthlyPay) || 0
  if (!monthly) return null
  const wh = Number(weeklyHours) || 40
  const mh = wh >= 40 ? 209 : Math.round((wh + (wh >= 15 ? (wh / 40) * 8 : 0)) * 4.345)
  const hourlyWage = Math.round(monthly / mh)
  const minMonthly = Math.round(MIN_WAGE_2026 * mh)
  // 4대보험 근로자
  const pensionBase = Math.min(monthly, PENSION_BASE_CAP)
  const pension_ee = Math.round(pensionBase * RATE_PENSION)
  const health_ee = Math.round(monthly * RATE_HEALTH)
  const care_ee = Math.round(health_ee * RATE_CARE_OF_HEALTH)
  const employ_ee = Math.round(monthly * RATE_EMPLOY)
  const total4_ee = pension_ee + health_ee + care_ee + employ_ee
  // 4대보험 사업주
  const pension_er = Math.round(pensionBase * RATE_PENSION)
  const health_er = Math.round(monthly * RATE_HEALTH)
  const care_er = Math.round(health_er * RATE_CARE_OF_HEALTH)
  const employ_er = Math.round(monthly * RATE_EMPLOY)
  const injury_er = Math.round(monthly * RATE_INJURY_ER)
  const total4_er = pension_er + health_er + care_er + employ_er + injury_er
  // 소득세 (간이세액표 근사)
  const annual = monthly * 12
  let emDed: number
  if (annual <= 5000000) emDed = annual * 0.7
  else if (annual <= 15000000) emDed = 3500000 + (annual - 5000000) * 0.4
  else if (annual <= 45000000) emDed = 7500000 + (annual - 15000000) * 0.15
  else if (annual <= 100000000) emDed = 12000000 + (annual - 45000000) * 0.05
  else emDed = 14750000 + (annual - 100000000) * 0.02
  const deps = Math.max(1, Number(dependents) || 1)
  const taxBase = Math.max(0, annual - emDed - 1500000 * deps)
  let annTax: number
  if (taxBase <= 14000000) annTax = taxBase * 0.06
  else if (taxBase <= 50000000) annTax = 840000 + (taxBase - 14000000) * 0.15
  else if (taxBase <= 88000000) annTax = 6240000 + (taxBase - 50000000) * 0.24
  else if (taxBase <= 150000000) annTax = 15360000 + (taxBase - 88000000) * 0.35
  else annTax = 37060000 + (taxBase - 150000000) * 0.38
  const credit = Math.min(annTax <= 1300000 ? annTax * 0.55 : 715000 + (annTax - 1300000) * 0.3, 740000)
  const incomeTax = Math.max(0, Math.round((annTax - credit) / 12))
  const localTax = Math.round(incomeTax * 0.1)
  return {
    hourlyWage: hourlyWage,
    monthlyHours: mh,
    minMonthly: minMonthly,
    isAboveMin: hourlyWage >= MIN_WAGE_2026,
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
    injury_er: injury_er,
    total4_er: total4_er,
    incomeTax: incomeTax,
    localTax: localTax,
    totalDeduct: total4_ee + incomeTax + localTax,
    netPay: monthly - total4_ee - incomeTax - localTax,
    totalEmployerCost: monthly + total4_er,
  }
}
