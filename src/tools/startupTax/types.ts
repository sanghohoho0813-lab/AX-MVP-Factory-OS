// ===========================================================================
// 도메인 타입 정의
// ===========================================================================

// 사업자 유형
export type BusinessType = 'individual' | 'corporation'

// 사업장 지역
export type Region = 'seoul' | 'gyeonggi_incheon' | 'metro_city' | 'other_local'

// 수도권 과밀억제권역 여부
export type Overconcentration = 'yes' | 'no' | 'unknown'

// 업종
export type Industry =
  | 'manufacturing'
  | 'ict'
  | 'professional'
  | 'wholesale_retail'
  | 'restaurant'
  | 'real_estate'
  | 'finance_insurance'
  | 'etc'

// 창업 형태
export type StartupForm =
  | 'brand_new' // 완전 신규 창업
  | 'conversion' // 개인 -> 법인 전환
  | 'acquisition' // 기존 사업 양수
  | 'reopen_same' // 폐업 후 같은 업종 재창업
  | 'succession' // 가족/특수관계인 사업 승계
  | 'unknown' // 잘 모르겠음

// 감면 확인 항목 키
export type ExemptionKey = 'incomeTax' | 'acquisitionTax' | 'propertyTax' | 'registrationTax'

// 예/아니오/모름 3지선다 (상세 입력 공용)
export type YesNoUnknown = 'yes' | 'no' | 'unknown'

// 기존 사업과의 업종 관계
export type IndustryRelation = 'same' | 'different' | 'none' | 'unknown'

// 상세(선택) 입력 — 창업 인정/창업기업 확인 정밀 판단용
export interface AdvancedInput {
  originalStartDate: string // 기존 개인사업 최초 개시일 (법인전환 시 창업일 승계 기준)
  hasExistingSole: YesNoUnknown | '' // 기존 개인사업자 보유 여부
  hasExistingCorp: YesNoUnknown | '' // 기존 법인 보유 여부
  isExistingExec: YesNoUnknown | '' // 기존 법인 임원 여부
  newOwnerShare: string // 신규 법인 대표 지분율(%)
  familyShare: string // 친족 합산 지분율(%)
  existingCorpExecShare: string // 기존 법인+임원 합산 지분율(%)
  isOligopoly: YesNoUnknown | '' // 기존 법인 과점주주 여부
  prevIndustryRelation: IndustryRelation | '' // 기존 사업과 동종/이종 여부
  assetTakeoverRatio: string // 기존 자산 인수 비율(%)
  employeeMoved: YesNoUnknown | '' // 기존 직원 이동 여부
  reuseIdentity: YesNoUnknown | '' // 기존 거래처/상호/홈페이지 사용 여부
  sameAddress: YesNoUnknown | '' // 같은 주소/사무실 사용 여부
}

// 입력 폼 데이터
export interface FormData {
  businessType: BusinessType | ''
  birthDate: string // YYYY-MM-DD
  startupDate: string // YYYY-MM-DD
  region: Region | ''
  overconcentration: Overconcentration | ''
  industry: Industry | ''
  startupForm: StartupForm | ''
  checkItems: Record<ExemptionKey, boolean>
  advanced: AdvancedInput
}

// ===========================================================================
// 판정 결과 타입
// ===========================================================================

// 판정 상태 (4단계)
//  good        🟢 감면 가능성 높음
//  caution     🟡 주의 필요
//  conditional 🟠 조건부 검토
//  bad         🔴 불가 가능성 높음
export type Verdict = 'good' | 'caution' | 'conditional' | 'bad'

// 핵심 감면 항목 판정 결과 (법인세/소득세, 취득세, 재산세)
export interface ItemResult {
  key: ExemptionKey
  title: string
  verdict: Verdict
  reasons: string[] // 이유 2~4줄
  checkPoints: string[] // 추가 확인 필요사항
  consultScript: string // 상담 멘트 예시
}

// 등록면허세 — 종합판정에서 제외, 별도 참고 영역으로만 표시
export interface RegistrationReference {
  title: string
  note: string
  checkPoints: string[]
}

// 창업 제외사유 진단 항목
export interface ExclusionReason {
  title: string
  detail: string
  exception: string
}

// 예상 절세 포인트 한 줄 (정확 세액 계산 아님)
export type SavingsTone = 'good' | 'caution' | 'bad'
export interface SavingsPoint {
  tone: SavingsTone
  text: string
}

// 전문가 검토 추천도 등급
export type ReviewGrade = 'A' | 'B' | 'C' | 'D'
export interface ExpertReview {
  grade: ReviewGrade
  label: string // 예: 상담 강력 추천
  description: string // 등급 사유 설명
  factors: string[] // 감지된 검토 필요 요소
}

// 예상 절세 규모 (실제 세액 계산 아님, 가능성 수준만)
export type SavingsLevelGrade = 'A' | 'B' | 'C' | 'D'
export interface SavingsLevel {
  level: SavingsLevelGrade
  label: string // 예: 수천만 원 이상 절세 가능성
}

// 창업일 승계 분석 (법인전환·양수 등에서 실질 창업일 산정)
export interface Lineage {
  inherited: boolean // 창업일이 기존 사업에서 승계되는 유형인지
  effectiveStartDate: string // 실질 창업일 (승계 시 기존 개인사업 최초 개시일)
  effectiveStartLabel: string // 근거 설명
  businessAgeYears: number | null // 실질 창업일 기준 업력(년, 소수)
  within7Years: boolean | null // 창업지원법 창업기업 업력 7년 이내 여부
  taxRemainingYears: number | null // 조특법 감면 5년 중 잔여 연수
  hasTaxRemaining: boolean | null // 감면 잔여기간 존재 여부
  needsOriginalDate: boolean // 승계형인데 기존 개시일 미입력 → 확인 필요
}

// 청년 기준 (조특법 / 창업지원법 분리)
export interface YouthStatus {
  age: number | null
  taxLaw: boolean | null // 조특법: 만 15~34세 (병역 최대 6년 차감)
  taxLawNote: string
  startupLaw: boolean | null // 창업지원법: 만 39세 이하
  startupLawNote: string
}

// 법 기준별 판정 블록 (조특법 / 창업지원법 / 지방세)
export type FrameworkKey = 'taxLaw' | 'startupLaw' | 'localTax'
export interface FrameworkResult {
  key: FrameworkKey
  title: string // 예: 조특법 기준 (세액감면)
  subtitle: string
  verdict: Verdict
  conclusion: string // 한줄 결론
  points: SavingsPoint[] // 항목별 판단 (tone 포함)
  risks: string[] // 핵심 리스크
  checkPoints: string[] // 확인 필요사항
  note: string // 동종 업종 기준 차이 등 분리 안내
}

// 종합 판정 결과
export interface JudgementResult {
  overall: Verdict
  oneLineConclusion: string // 한줄 결론 (사장님용)
  reasons: string[] // 판정 사유 (간단 불릿)
  keyReasons: string[] // 이번 판정의 핵심 이유 (3줄, 창업형태/업종/권역)
  keyChecks: string[] // 주요 확인사항 (초기 화면 노출)

  // 상담 전환용 advisory
  savingsPoints: SavingsPoint[] // 예상 절세 포인트
  savingsAdvice: string // 상담 시 확인 포인트 한 줄
  savingsLevel: SavingsLevel // 예상 절세 규모 (LEVEL A~D)
  missedPoints: string[] // 많은 대표님들이 놓치는 부분
  expertReview: ExpertReview // 전문가 검토 추천도 (A/B/C/D)

  // 청년 분석 (기존 호환) + 이중 기준
  isYouth: boolean | null
  age: number | null
  youth: YouthStatus

  // 법 기준별 판정 (조특법 / 창업지원법 / 지방세)
  frameworks: FrameworkResult[]

  // 창업일 승계 분석 (법인전환 등)
  lineage: Lineage

  // 창업 인정 분석
  startupRecognition: Verdict
  startupRecognitionNote: string
  exclusionReasons: ExclusionReason[]

  // 핵심 항목 (종합판정 대상) + 등록면허세 참고
  coreItems: ItemResult[]
  registration: RegistrationReference | null

  // 상담 활용
  consultQuestions: string[] // 상담 시 확인해야 할 핵심 질문
  consultChecklist: string[] // 전문가 검토 시 확인 가능한 항목 (계약 유도)
}
