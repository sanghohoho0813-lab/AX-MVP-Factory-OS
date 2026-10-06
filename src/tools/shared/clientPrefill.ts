/**
 * 업체 기록 → 도구 입력값 (D-90).
 *
 * 업체 상세에서 도구를 열면(`?client=`) 이미 아는 것은 다시 묻지 않는다.
 * 대표 생년월일·설립일·업종·직원 수는 업체 기록에 있다 — 그대로 옮겨 채운다.
 *
 * D-128: 값은 고객 사실 창고(services/customerFacts.ts)에서 읽는다 — 확인됨 · 적어 둠 · 예상값만.
 * 자료에서 읽고 아직 확인하지 않은 후보는 도구에 넣지 않는다.
 *
 * 규칙
 *  - **빈 칸만 채운다.** 대표가 이미 고쳐 둔 값은 건드리지 않는다.
 *  - 모르면 비워 둔다. 짐작해서 넣지 않는다 — 판정이 달라지기 때문이다.
 *  - 업종은 업체가 적어 둔 말(자유 입력)에서 알아본다. 못 알아보면 비워 둔다.
 */

import type { ClientOpsRecord } from '../../types/clientOps'
import { josa } from '../../lib/josa'
import { readFact, usableFactValue, wonOf } from '../../services/customerFacts'

/**
 * 업체가 적어 둔 업종 말 → 창업감면·정책자금이 쓰는 업종 값.
 * D-136: **감면 · 지원에서 빠지는 업종(부동산 · 금융)을 먼저 본다** — 예전에는 '부동산개발업' 이 '개발' 로
 * 정보통신이 되고 '부동산 컨설팅' 이 전문서비스가 되어, 안 되는 업종이 된다고 나왔다.
 * '임대' 는 부동산 임대일 때만 부동산(장비 · 차량 임대는 다른 업종 — 모르면 비워 둔다).
 */
const INDUSTRY_WORDS: { value: string; words: string[] }[] = [
  { value: 'real_estate', words: ['부동산', '건물임대', '주택임대', '상가임대', '토지임대', '분양'] },
  { value: 'finance_insurance', words: ['금융', '보험', '대부', '투자자문', '신탁'] },
  { value: 'manufacturing', words: ['제조', '생산', '가공', '공장'] },
  { value: 'ict', words: ['정보통신', 'IT', '소프트웨어', 'SW', '플랫폼', '앱', '시스템', '개발'] },
  { value: 'professional', words: ['전문', '컨설팅', '엔지니어링', '설계', '연구'] },
  { value: 'wholesale_retail', words: ['도소매', '도매', '소매', '유통', '판매', '무역'] },
  { value: 'restaurant', words: ['음식', '식당', '외식', '카페'] },
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

/**
 * 설립일 → 업력(꽉 찬 개월 수). 설립일이 없거나 오늘보다 뒤면 null.
 * D-136: 달력으로 센다(생일 세듯) — 3년 11개월은 47개월이지 '3년 = 36개월' 이 아니다.
 * 연구소의 '창업 3년 이내' 처럼 개월로 가르는 규칙은 이 값을 써야 한다.
 */
export function monthsInBusiness(establishedAt: string, today: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(establishedAt ?? '')
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const check = new Date(y, mo - 1, d)
  if (check.getFullYear() !== y || check.getMonth() !== mo - 1 || check.getDate() !== d) return null
  let months = (today.getFullYear() - y) * 12 + (today.getMonth() - (mo - 1))
  if (today.getDate() < d) months -= 1
  return months < 0 ? null : months
}

/** 설립일 → 업력(꽉 찬 년). 설립일이 없으면 null — 달력으로 센다(D-136) */
export function yearsInBusiness(establishedAt: string, today: Date): number | null {
  const months = monthsInBusiness(establishedAt, today)
  return months === null ? null : Math.floor(months / 12)
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

/** 원 단위 사실 하나 — 값 · 기준 연도 · 상태 */
export interface WonFact {
  won: number
  asOf: string
  /** 예상값이면 true — 확정된 숫자처럼 쓰지 않는다 */
  estimated: boolean
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
  /** D-136: 꽉 찬 개월 — '3년 이내' 같은 규칙은 years 가 아니라 이것으로 */
  months: number | null
  representativeAge: number | null
  /* D-128 — 사실 창고에서 더 읽는 것(모르면 비워 둔다) */
  representativeName: string
  businessNumber: string
  corporateNumber: string
  address: string
  revenue: WonFact | null
  operatingProfit: WonFact | null
  netIncome: WonFact | null
  totalAssets: WonFact | null
  totalLiabilities: WonFact | null
}

function wonFact(record: ClientOpsRecord, key: string): WonFact | null {
  const f = readFact(record, key)
  if (!f || f.status === 'missing') return null
  const won = wonOf(f.value)
  return won === null ? null : { won, asOf: f.asOf, estimated: f.status === 'estimated' }
}

export function clientFacts(record: ClientOpsRecord, today: Date): ClientFacts {
  const established = usableFactValue(record, 'establishedAt')
  const birth = usableFactValue(record, 'representativeBirth')
  return {
    companyName: usableFactValue(record, 'companyName'),
    businessType: businessTypeOf(record),
    representativeBirth: birth,
    establishedAt: established,
    industry: industryValueOf(record.industry || record.businessItem || record.businessCategory),
    // D-165: 업종 칸이 비면 사업자등록증의 업태 · 종목으로 — 업체 상세 판정 카드와 도구가 같은 업종을 쓴다
    industryText: (record.industry ?? '').trim() || [record.businessCategory, record.businessItem].map((v) => (v ?? '').trim()).filter(Boolean).join(' '),
    employeeCount: employeeCountOf(usableFactValue(record, 'employeeCount')),
    years: yearsInBusiness(established, today),
    months: monthsInBusiness(established, today),
    representativeAge: ageOf(birth, today),
    representativeName: usableFactValue(record, 'representativeName'),
    businessNumber: usableFactValue(record, 'businessNumber'),
    corporateNumber: usableFactValue(record, 'corporateNumber'),
    address: usableFactValue(record, 'businessAddress'),
    revenue: wonFact(record, 'revenue'),
    operatingProfit: wonFact(record, 'operatingProfit'),
    netIncome: wonFact(record, 'netIncome'),
    totalAssets: wonFact(record, 'totalAssets'),
    totalLiabilities: wonFact(record, 'totalLiabilities'),
  }
}

/** 채운 칸 이름들 → "대표 생년월일 · 설립일을 업체 기록에서 채웠습니다" */
export function prefilledText(names: string[]): string {
  return names.length === 0 ? '' : `${josa(names.join(' · '), '을/를')} 업체 기록에서 채웠습니다`
}
