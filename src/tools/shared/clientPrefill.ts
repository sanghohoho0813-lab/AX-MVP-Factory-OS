/**
 * 업체 기록 → 도구 입력값 (D-90).
 *
 * 업체 상세에서 도구를 열면(`?client=`) 이미 아는 것은 다시 묻지 않는다.
 * 대표 생년월일·설립일·업종·직원 수는 업체 기록에 있다 — 그대로 옮겨 채운다.
 *
 * 규칙
 *  - **빈 칸만 채운다.** 대표가 이미 고쳐 둔 값은 건드리지 않는다.
 *  - 모르면 비워 둔다. 짐작해서 넣지 않는다 — 판정이 달라지기 때문이다.
 *  - 업종은 업체가 적어 둔 말(자유 입력)에서 알아본다. 못 알아보면 비워 둔다.
 */

import type { ClientOpsRecord } from '../../types/clientOps'

/** 업체가 적어 둔 업종 말 → 창업감면·정책자금이 쓰는 업종 값 */
const INDUSTRY_WORDS: { value: string; words: string[] }[] = [
  { value: 'manufacturing', words: ['제조', '생산', '가공', '공장'] },
  { value: 'ict', words: ['정보통신', 'IT', '소프트웨어', 'SW', '플랫폼', '앱', '시스템', '개발'] },
  { value: 'professional', words: ['전문', '컨설팅', '엔지니어링', '설계', '연구'] },
  { value: 'wholesale_retail', words: ['도소매', '도매', '소매', '유통', '판매', '무역'] },
  { value: 'restaurant', words: ['음식', '식당', '외식', '카페'] },
  { value: 'real_estate', words: ['부동산', '임대'] },
  { value: 'finance_insurance', words: ['금융', '보험', '대부'] },
]

/** 업체의 업종 글에서 도구가 아는 값 찾기 (못 찾으면 빈 글자) */
export function industryValueOf(text: string): string {
  const t = (text ?? '').replace(/\s/g, '')
  if (!t) return ''
  for (const row of INDUSTRY_WORDS) {
    if (row.words.some((w) => t.includes(w))) return row.value
  }
  return ''
}

/** 법인인지 개인인지 — 법인번호가 적혀 있으면 법인으로 본다 */
export function businessTypeOf(record: Pick<ClientOpsRecord, 'corporateNumber'>): '' | 'individual' | 'corporation' {
  return record.corporateNumber.trim() ? 'corporation' : ''
}

/** "5명(대표 포함)" 같은 글에서 숫자만 (없으면 null) */
export function employeeCountOf(text: string): number | null {
  const m = /(\d+)/.exec(text ?? '')
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

/** 설립일 → 업력(년). 설립일이 없으면 null */
export function yearsInBusiness(establishedAt: string, today: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(establishedAt ?? '')) return null
  const start = new Date(`${establishedAt}T00:00:00`)
  if (Number.isNaN(start.getTime())) return null
  const years = (today.getTime() - start.getTime()) / (365.25 * 86400000)
  return years < 0 ? null : Math.floor(years)
}

/** 생년월일 → 만 나이 (없으면 null) */
export function ageOf(birth: string, today: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth ?? '')) return null
  const b = new Date(`${birth}T00:00:00`)
  if (Number.isNaN(b.getTime())) return null
  let age = today.getFullYear() - b.getFullYear()
  const m = today.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age -= 1
  return age < 0 ? null : age
}

/** 도구가 공통으로 쓰는 '업체에서 아는 것' */
export interface ClientFacts {
  companyName: string
  /** '' | 'individual' | 'corporation' */
  businessType: '' | 'individual' | 'corporation'
  /** YYYY-MM-DD */
  representativeBirth: string
  /** YYYY-MM-DD */
  establishedAt: string
  /** 도구가 아는 업종 값 ('' 면 모름) */
  industry: string
  /** 업체가 적어 둔 업종 글 그대로 */
  industryText: string
  employeeCount: number | null
  years: number | null
  representativeAge: number | null
}

export function clientFacts(record: ClientOpsRecord, today: Date): ClientFacts {
  return {
    companyName: record.companyName ?? '',
    businessType: businessTypeOf(record),
    representativeBirth: record.representativeBirth ?? '',
    establishedAt: record.establishedAt ?? '',
    industry: industryValueOf(record.industry || record.businessItem || record.businessCategory),
    industryText: record.industry ?? '',
    employeeCount: employeeCountOf(record.employeeCount),
    years: yearsInBusiness(record.establishedAt, today),
    representativeAge: ageOf(record.representativeBirth, today),
  }
}

/** 채운 칸 이름들 → "대표 생년월일 · 설립일을 업체 기록에서 채웠습니다" */
export function prefilledText(names: string[]): string {
  return names.length === 0 ? '' : `${names.join(' · ')}을(를) 업체 기록에서 채웠습니다`
}
