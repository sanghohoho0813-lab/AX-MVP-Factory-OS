/**
 * 업체 기록 → 정책자금 진단 입력 (D-144).
 *
 * 정책자금 화면(업체로 열었을 때 빈 칸 채우기)과 업체 상세 '맞춤 추천'(서류만 올려도 판정)이 같은 구간 나누기를 쓴다.
 * 모르는 것은 null — 짐작하지 않는다(D-90).
 */
import type { ClientFacts } from '../shared/clientPrefill'
import { DEFAULT_INPUT } from './diagnosis'
import type { DiagnosisInput } from './types'

/* 업체 기록의 숫자 → 이 도구가 쓰는 구간 (모르면 null — 짐작하지 않는다, D-90) */
export function yearsBand(years: number | null): DiagnosisInput['years'] | null {
  if (years === null) return null
  if (years < 1) return '1년 미만'
  if (years < 3) return '1~3년'
  if (years < 7) return '3~7년'
  return '7년 이상'
}

export function employeesBand(n: number | null): DiagnosisInput['employees'] | null {
  if (n === null) return null
  if (n <= 0) return '0명'
  if (n <= 4) return '1~4명'
  if (n <= 9) return '5~9명'
  return '10명 이상'
}

/** 원 → 매출 규모 칸 (D-128) */
export function revenueBand(won: number): DiagnosisInput['revenue'] {
  const eok = won / 1e8
  if (eok < 1) return '1억 미만'
  if (eok < 5) return '1~5억'
  if (eok < 10) return '5~10억'
  if (eok < 30) return '10~30억'
  return '30억 이상'
}

export function lastYearRevenueBand(won: number): NonNullable<DiagnosisInput['lastYearRevenue']> {
  const eok = won / 1e8
  if (eok < 1) return '1억 미만'
  if (eok < 3) return '1~3억'
  if (eok < 5) return '3~5억'
  if (eok < 10) return '5~10억'
  if (eok < 30) return '10~30억'
  return '30억 이상'
}

export function ceoAgeBand(age: number | null): NonNullable<DiagnosisInput['ceoAge']> | null {
  if (age === null) return null
  if (age <= 39) return '만 39세 이하'
  if (age <= 49) return '40~49세'
  return '50세 이상'
}


/** 업체 사실 → 진단 입력 · 채운 칸 이름 · 모자란 것(업력 · 업종이 없으면 판정하지 않는다) */
export function policyInputFromFacts(facts: ClientFacts): { input: DiagnosisInput; filled: string[]; missing: string[] } {
  const input: DiagnosisInput = { ...DEFAULT_INPUT, companyName: facts.companyName }
  const filled: string[] = []
  const missing: string[] = []
  if (facts.industryText) {
    input.industry = facts.industryText
    filled.push('업종')
  } else missing.push('업종')
  if (facts.businessType === 'corporation') input.businessType = '법인사업자'
  const years = yearsBand(facts.years)
  if (years) {
    input.years = years
    filled.push('업력')
  } else missing.push('설립일')
  const emp = employeesBand(facts.employeeCount)
  if (emp) {
    input.employees = emp
    filled.push('직원 수')
  }
  const rev = facts.revenue && !facts.revenue.estimated ? facts.revenue.won : null
  if (rev !== null) {
    input.revenue = revenueBand(rev)
    input.lastYearRevenue = lastYearRevenueBand(rev)
    filled.push('매출')
  } else missing.push('매출')
  const ni = facts.netIncome && !facts.netIncome.estimated ? facts.netIncome.won : null
  if (ni !== null) {
    input.netProfit = ni > 0 ? '흑자' : ni < 0 ? '적자' : '손익분기'
    filled.push('순이익')
  }
  const age = ceoAgeBand(facts.representativeAge)
  if (age) {
    input.ceoAge = age
    filled.push('대표 나이')
  }
  return { input, filled, missing }
}
