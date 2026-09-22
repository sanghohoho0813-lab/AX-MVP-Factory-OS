import type {
  BusinessType,
  ExemptionKey,
  IndustryRelation,
  Industry,
  Overconcentration,
  Region,
  StartupForm,
  YesNoUnknown,
} from '../types'

// 화면 선택지 + 라벨을 한 곳에서 관리 (폼 / 요약문 / PDF 공용)
export interface Option<T extends string> {
  value: T
  label: string
}

export const BUSINESS_TYPES: Option<BusinessType>[] = [
  { value: 'individual', label: '개인사업자' },
  { value: 'corporation', label: '법인사업자' },
]

export const REGIONS: Option<Region>[] = [
  { value: 'seoul', label: '서울' },
  { value: 'gyeonggi_incheon', label: '경기/인천' },
  { value: 'metro_city', label: '지방 광역시' },
  { value: 'other_local', label: '기타 지방' },
]

export const OVERCONCENTRATIONS: Option<Overconcentration>[] = [
  { value: 'yes', label: '예' },
  { value: 'no', label: '아니오' },
  { value: 'unknown', label: '잘 모르겠음' },
]

export const INDUSTRIES: Option<Industry>[] = [
  { value: 'manufacturing', label: '제조업' },
  { value: 'ict', label: '정보통신업' },
  { value: 'professional', label: '전문서비스업' },
  { value: 'wholesale_retail', label: '도소매업' },
  { value: 'restaurant', label: '음식점업' },
  { value: 'real_estate', label: '부동산업' },
  { value: 'finance_insurance', label: '금융/보험업' },
  { value: 'etc', label: '기타' },
]

export const STARTUP_FORMS: Option<StartupForm>[] = [
  { value: 'brand_new', label: '완전 신규 창업' },
  { value: 'conversion', label: '개인사업자에서 법인전환' },
  { value: 'acquisition', label: '기존 사업 양수' },
  { value: 'reopen_same', label: '폐업 후 같은 업종 재창업' },
  { value: 'succession', label: '가족/특수관계인 사업 승계' },
  { value: 'unknown', label: '잘 모르겠음' },
]

export const CHECK_ITEMS: Option<ExemptionKey>[] = [
  { value: 'incomeTax', label: '법인세/소득세' },
  { value: 'acquisitionTax', label: '취득세' },
  { value: 'propertyTax', label: '재산세' },
  { value: 'registrationTax', label: '등록면허세' },
]

// 상세(선택) 입력 공용 선택지
export const YES_NO_UNKNOWN: Option<YesNoUnknown>[] = [
  { value: 'yes', label: '예' },
  { value: 'no', label: '아니오' },
  { value: 'unknown', label: '모름' },
]

export const INDUSTRY_RELATIONS: Option<IndustryRelation>[] = [
  { value: 'same', label: '동종' },
  { value: 'different', label: '이종' },
  { value: 'none', label: '해당 없음' },
  { value: 'unknown', label: '모름' },
]

// value -> label 빠른 조회용 헬퍼
function toMap<T extends string>(opts: Option<T>[]): Record<string, string> {
  return Object.fromEntries(opts.map((o) => [o.value, o.label]))
}

export const LABEL = {
  businessType: toMap(BUSINESS_TYPES),
  region: toMap(REGIONS),
  overconcentration: toMap(OVERCONCENTRATIONS),
  industry: toMap(INDUSTRIES),
  startupForm: toMap(STARTUP_FORMS),
  checkItem: toMap(CHECK_ITEMS),
}

// 값이 비어있을 때 표시할 기본 문자열
export function labelOf(map: Record<string, string>, value: string): string {
  return value ? (map[value] ?? '-') : '-'
}
