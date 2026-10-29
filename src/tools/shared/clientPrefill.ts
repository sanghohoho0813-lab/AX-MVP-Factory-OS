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
import { entityKindOf } from '../../services/clientOrder'

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

/**
 * 법인인지 개인인지 (D-209 — 상황 예시 판정 fitContext 와 같은 규칙).
 * 법인: 법인번호 · 사업자번호 가운데 81·82·84~88 · 이름의 (주)/주식회사 등 · 주주명부.
 * 개인: 사업자번호 가운데 01~79 · 90~99. 둘 다 아니면 모름('').
 * 예전에는 법인번호만 봐서 사업자번호가 개인인 업체도 '모름' → 도구는 법인세로 계산하고, 상황 예시는 개인으로 봤다.
 */
export function businessTypeOf(record: Pick<ClientOpsRecord, 'corporateNumber'> & Partial<Pick<ClientOpsRecord, 'companyName' | 'businessNumber' | 'shareholderRegister'>>): '' | 'individual' | 'corporation' {
  if (entityKindOf({ companyName: record.companyName ?? '', businessNumber: record.businessNumber, corporateNumber: record.corporateNumber }) === 'corporation') return 'corporation'
  if ((record.shareholderRegister ?? []).length > 0) return 'corporation'
  const digits = (record.businessNumber ?? '').replace(/\D/g, '')
  const mid = digits.length === 10 ? Number(digits.slice(3, 5)) : null
  if (mid !== null && ((mid >= 1 && mid <= 79) || (mid >= 90 && mid <= 99))) return 'individual'
  return ''
}

/** "5명(대표 포함)" 같은 글에서 숫자만 (없으면 null) */
export function employeeCountOf(text: string): number | null {
  // D-216: '1,234명' 은 1,234 — 예전에는 쉼표 앞에서 끊겨 1명이 됐다
  const m = /(\d{1,3}(?:,\d{3})+|\d+)/.exec(text ?? '')
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
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
  /** D-325 벤처기업 확인일(올린 벤처기업확인서 중 가장 이른 '확인일') — 창업 3년 안이면 창업벤처중소기업 감면. 모르면 '' */
  ventureConfirmedAt?: string
  /** D-329 지금 유효한 벤처기업확인서가 있는지(…까지 가 오늘 이후) — 연구소 전담요원 2명 기준 */
  ventureValidNow?: boolean
  /** D-329 중소기업 확인서의 기업 규모(유효한 것) — 연구소 전담요원 기준(소기업 3 · 중기업 5). 모르면 '' */
  smeSize?: '소기업' | '중기업' | ''
}

const UNTIL = /(\d{4}-\d{2}-\d{2})\s*까지/
/** D-329 중소기업 확인서(cf:중소기업 확인 · 회사 정보 '중소기업 확인' 칸)의 규모 — 기한 지난 것은 빼고, 소상공인 · 소기업은 '소기업' */
export function smeSizeOf(record: ClientOpsRecord, today: string): '소기업' | '중기업' | '' {
  const values = [
    ...Object.entries(record.factValues ?? {}).filter(([k]) => /^cf:중소기업\s*확인/.test(k)).map(([, v]) => String(v)),
    ...(record.customFields ?? []).filter((f) => /중소기업\s*확인/.test(f.label)).map((f) => f.value),
  ].filter((v) => !((UNTIL.exec(v)?.[1] ?? '9999') < today))
  if (values.some((v) => /중기업/.test(v))) return '중기업'
  if (values.some((v) => /소기업|소상공인/.test(v))) return '소기업'
  return ''
}
/** D-329 지금 유효한 벤처기업확인서(cf:벤처기업 …)가 있는지 */
export function ventureValidOn(record: ClientOpsRecord, today: string): boolean {
  return Object.entries(record.factValues ?? {}).some(([k, v]) => /^cf:벤처기업/.test(k) && !((UNTIL.exec(String(v))?.[1] ?? '9999') < today))
}

/** D-325 올린 벤처기업확인서(cf:벤처기업 …)의 '확인일' 중 가장 이른 날 — 처음 확인받은 날이 창업 3년 안인지 본다 */
export function ventureConfirmedAt(record: ClientOpsRecord): string {
  const dates = Object.entries(record.factValues ?? {})
    .filter(([k]) => /^cf:벤처기업/.test(k))
    .map(([, v]) => /확인일\s*(\d{4}-\d{2}-\d{2})/.exec(String(v))?.[1] ?? '')
    .filter(Boolean)
    .sort()
  return dates[0] ?? ''
}

function wonFact(record: ClientOpsRecord, key: string): WonFact | null {
  const f = readFact(record, key)
  if (!f || f.status === 'missing') return null
  const won = wonOf(f.value)
  return won === null ? null : { won, asOf: f.asOf, estimated: f.status === 'estimated' }
}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function clientFacts(record: ClientOpsRecord, today: Date): ClientFacts {
  const established = usableFactValue(record, 'establishedAt')
  const birth = usableFactValue(record, 'representativeBirth')
  return {
    companyName: usableFactValue(record, 'companyName'),
    businessType: businessTypeOf(record),
    representativeBirth: birth,
    establishedAt: established,
    // D-244: 앞 칸 글이 있어도 아는 업종이 아니면 다음 칸으로 — 업태 '제조업' · 종목 '정밀기계 부품' 이 예전엔 '모름' 이었다
    industry: industryValueOf(record.industry) || industryValueOf(record.businessItem) || industryValueOf(record.businessCategory),
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
    ventureConfirmedAt: ventureConfirmedAt(record),
    ventureValidNow: ventureValidOn(record, isoDay(today)),
    smeSize: smeSizeOf(record, isoDay(today)),
  }
}

/** 채운 칸 이름들 → "대표 생년월일 · 설립일을 업체 기록에서 채웠습니다" */
export function prefilledText(names: string[]): string {
  return names.length === 0 ? '' : `${josa(names.join(' · '), '을/를')} 업체 기록에서 채웠습니다`
}
