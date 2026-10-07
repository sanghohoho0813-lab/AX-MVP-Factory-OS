/**
 * 기업인증 Core — 타입 (D-170).
 *
 * 이 폴더(core · rules · innobiz · mainbiz · iso)는 MIRAE OS 를 모른다. 업체 기록 · 화면 · 저장소를 import 하지 않는다.
 * OS 와는 `integration/` 의 어댑터가 `CertificationClientContext` 를 만들어 넘겨 주고, 결과(`CertificationAssessment`)를 받는다.
 * → 나중에 이 Core 만 떼어 다른 법인컨설팅 솔루션에 그대로 쓸 수 있다.
 *
 * 원칙
 *  - 자체 준비도는 5단계(매우 높음 ~ 매우 낮음) + '추가 확인 필요'. 퍼센트 · 자체 점수 없음.
 *  - 공식 점수(이노비즈 650/700 · 메인비즈 600/700)는 '공식 기준' 으로만 숫자를 보여 준다 — 자체 판정과 섞지 않는다.
 *  - 모르는 값은 추측하지 않는다(null = 모름 → '추가 확인 필요').
 */

export type CertificationKey = 'venture' | 'lab' | 'innobiz' | 'mainbiz' | 'iso9001' | 'iso14001' | 'iso45001'

/** 자체 준비도 — 근거와 늘 같이 보인다 */
export type Readiness = 'very_high' | 'high' | 'medium' | 'low' | 'very_low' | 'unknown'

export const READINESS_LABEL: Record<Readiness, string> = {
  very_high: '매우 높음',
  high: '높음',
  medium: '보통',
  low: '낮음',
  very_low: '매우 낮음',
  unknown: '추가 확인 필요',
}

/** 추천 — 가능 여부만이 아니라 지금 할지 */
export type Recommendation = 'held' | 'now' | 'possible' | 'after_fix' | 'too_early' | 'low_priority' | 'not_needed' | 'need_info'

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  held: '보유 중',
  now: '지금 추천',
  possible: '진행 가능',
  after_fix: '보완 후 추천',
  too_early: '아직 이르다',
  low_priority: '우선순위 낮음',
  not_needed: '지금은 굳이 필요 없음',
  need_info: '추가 확인 필요',
}

/** 근거 한 줄 — ✓ 충족 · △ 보강 · ✗ 미충족 · ? 모름 */
export type CheckState = 'ok' | 'warn' | 'no' | 'unknown'

export interface Reason {
  state: CheckState
  text: string
}

/** 업체 규모(중소기업기본법 기준 — 모르면 null) */
export type CompanySize = 'small' | 'medium' | 'mid_large' | 'large'

export type ResearchUnit = 'lab' | 'dept' | 'none'

/**
 * 연구개발비 범위(AX) — 칩으로 고른 범위는 대표 금액(3천만 · 7천만 …)으로 바꾸지 않는다.
 * 첫 추천과 질문 순서에만 쓰고, 벤처 공식 판단(5천만원 이상 · 매출 대비 비율)은 정확한 금액이 있어야 한다.
 */
export type RndRange = 'none' | 'under_50m' | '50m_100m' | 'over_100m' | 'unknown'

export const RND_RANGE_LABEL: Record<RndRange, string> = {
  none: '없음',
  under_50m: '5천만원 미만',
  '50m_100m': '5천만~1억원',
  over_100m: '1억원 이상',
  unknown: '모름',
}

/** 업체가 가진 인증 하나 */
export interface HeldCertification {
  key: CertificationKey
  /** 'YYYY-MM-DD' — 모르면 '' */
  validUntil: string
  /** 화면용 원문(번호 · 기관 등) */
  note: string
}

/** 증빙 자료 — 업체 서류함에 이미 있는가 */
export interface EvidenceDoc {
  /** Core 증빙 id(rules 의 evidence id 와 같다) */
  id: string
  label: string
  /** 서류함에 있고 쓸 수 있다 */
  have: boolean
  /** 만료됐거나 곧 만료 */
  stale?: boolean
}

/**
 * Core 가 받는 업체 사정 — 모르면 null. 어댑터가 업체 기록 · 사실 창고 · 서류함에서 채운다.
 */
export interface CertificationClientContext {
  companyName: string
  entity: 'corporation' | 'individual' | null
  /** 오늘 기준 꽉 찬 업력(년) */
  years: number | null
  months: number | null
  industryText: string
  /** 제조 · 건설 · SW · 바이오 · 서비스 … 대분류(모르면 '') */
  industryGroup: 'manufacturing' | 'construction' | 'agriculture' | 'software' | 'bio' | 'environment' | 'design' | 'service' | 'retail' | 'food' | 'other' | ''
  employees: number | null
  size: CompanySize | null
  /** 원 */
  revenue: number | null
  operatingProfit: number | null
  netIncome: number | null
  totalAssets: number | null
  totalLiabilities: number | null
  /** 직전 연도 연구개발비(원) — 정확한 금액만(범위 칩은 넣지 않는다) */
  rndExpense: number | null
  /** AX: 연구개발비 범위(정확한 금액을 모를 때) */
  rndRange?: RndRange | null
  /** AX: 한국표준산업분류(KSIC) 코드 숫자(2~5자리) — 확인된 것만. 없으면 세부 업종 판정은 '확인 필요' */
  ksic?: string | null
  /** AX: 중소기업확인서(유효)가 서류함 · 인증서 칸에 있다 */
  smeDoc?: boolean
  /** AX: 기존 입력값과 확인된 정보가 달라 확인된 정보를 쓴 것(화면 안내) */
  conflicts?: string[]
  researchUnit: ResearchUnit | null
  /** 연구전담요원 수 */
  researchers: number | null
  patents: number | null
  held: HeldCertification[]
  /** B2B 납품 · 거래처 인증 요구 */
  b2b: boolean | null
  /** 공공 조달 · 입찰 계획 */
  procurement: boolean | null
  exportPlan: boolean | null
  policyFundPlan: boolean | null
  rndPlan: boolean | null
  /** 체납 · 연체 · 회생 같은 제외 사유가 있다고 확인됨 */
  exclusionFlags: string[]
  /** 서류함 증빙 */
  evidence: EvidenceDoc[]
  /** P1: 판정에 쓴 사실의 출처 · 확인 여부(OS 연결층이 채운다 — 없으면 '모름') */
  basis?: BasisItem[]
  /** 오늘 'YYYY-MM-DD' */
  today: string
}

export type BasisField =
  | 'years' | 'industry' | 'size' | 'employees' | 'revenue' | 'operatingProfit' | 'totalAssets' | 'totalLiabilities'
  | 'rndExpense' | 'researchUnit' | 'researchers' | 'patents' | 'b2b' | 'procurement' | 'exportPlan' | 'exclusion'

/** 근거 한 줄 — ✓ confirmed · △ estimated · ? missing */
export interface BasisItem {
  field: BasisField
  label: string
  /** 화면에 보일 값(없으면 '') */
  value: string
  state: 'confirmed' | 'estimated' | 'missing'
  /** 어디서 — '사업자등록증' · '회사 정보(확인)' · '연구소 관리 기록' · '컨설턴트 선택(회사 정보 미확인)' … */
  from: string
}

/** 이 업체에 특히 쓸 만한 혜택 */
export interface BenefitPick {
  id: string
  title: string
  /** 왜 추천했나 */
  why: string
  /** 기관 · 시기 · 조건에 따라 달라짐 */
  conditional: boolean
}

export interface NextAction {
  label: string
  kind: 'open_tool' | 'self_check' | 'collect_docs' | 'consult' | 'renew' | 'confirm_facts' | 'wait'
}

export interface CertificationAssessment {
  key: CertificationKey
  label: string
  readiness: Readiness
  recommendation: Recommendation
  /** 한 줄 이유 */
  oneLine: string
  /** 등급 근거(✓ △ ✗ ?) */
  reasons: Reason[]
  /** 판정에 모자란 사실(대표 확인 필요) */
  missingFacts: string[]
  /** 모자란 증빙 */
  missingEvidence: string[]
  /** 있는 증빙 */
  haveEvidence: string[]
  benefits: BenefitPick[]
  /** 지금 진행 추천 · 3개월 내 검토 · 다른 인증 먼저 … */
  timing: string
  nextAction: NextAction
  /** 보유 중이면 만료 · 갱신 */
  renewal?: { validUntil: string; daysLeft: number; prepareFrom: string; note: string }
  /** P1: 이전 인증이 만료(연장 기간도 지남) — 새로 신청할 대상 */
  expired?: true
}
