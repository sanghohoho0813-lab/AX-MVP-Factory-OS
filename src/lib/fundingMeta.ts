import {
  AlertTriangle,
  Award,
  Banknote,
  Briefcase,
  Building2,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Coins,
  FileCheck,
  FlaskConical,
  Globe,
  Handshake,
  Landmark,
  type LucideIcon,
  MapPin,
  MinusCircle,
  Phone,
  Rocket,
  ShieldCheck,
  Ship,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react'
import type { StatusTone } from '../types'
import type {
  ApplicationStage,
  CaseStudyStatus,
  CaseVisibility,
  ConsentStatus,
  CriterionStatus,
  DocumentRequirementStatus,
  FundingStrategyStatus,
  GapSeverity,
  GapStatus,
  InformationFreshnessStatus,
  InstitutionCategory,
  MatchConfidence,
  MatchPriority,
  OutcomeMetricType,
  OutcomeType,
  OutreachChannel,
  OutreachPlanStatus,
  SourceStatus,
  SupportType,
} from '../types/funding'

interface Meta {
  label: string
  tone: StatusTone
  order: number
  description?: string
}
interface IconMeta extends Meta {
  icon: LucideIcon
}

/* 기관 유형 */
export const INSTITUTION_CATEGORY_META: Record<InstitutionCategory, IconMeta> = {
  policy_finance: { label: '정책금융', tone: 'info', icon: Banknote, order: 0 },
  credit_guarantee: { label: '신용보증', tone: 'accent', icon: ShieldCheck, order: 1 },
  technology_guarantee: { label: '기술보증', tone: 'accent', icon: FlaskConical, order: 2 },
  startup_support: { label: '창업지원', tone: 'success', icon: Rocket, order: 3 },
  rnd_support: { label: '연구개발지원', tone: 'info', icon: FlaskConical, order: 4 },
  employment_support: { label: '고용지원', tone: 'info', icon: Users, order: 5 },
  local_government: { label: '지자체지원', tone: 'neutral', icon: MapPin, order: 6 },
  export_support: { label: '수출지원', tone: 'info', icon: Ship, order: 7 },
  certification: { label: '기업인증', tone: 'success', icon: Award, order: 8 },
  investment: { label: '투자연계', tone: 'accent', icon: TrendingUp, order: 9 },
  private_finance: { label: '민간금융', tone: 'neutral', icon: Landmark, order: 10 },
  other: { label: '기타', tone: 'neutral', icon: Building2, order: 11 },
}
export const INSTITUTION_CATEGORIES = (Object.keys(INSTITUTION_CATEGORY_META) as InstitutionCategory[]).sort(
  (a, b) => INSTITUTION_CATEGORY_META[a].order - INSTITUTION_CATEGORY_META[b].order,
)

/* 출처 상태 */
export const SOURCE_STATUS_META: Record<SourceStatus, Meta> = {
  official_verified: { label: '공식 확인', tone: 'success', order: 0, description: '공식 출처로 확인된 정보' },
  user_entered: { label: '직접 입력', tone: 'info', order: 1, description: '사용자가 입력한 정보' },
  reference_only: { label: '참고용', tone: 'neutral', order: 2, description: '참고용 예시 — 공식 확인 필요' },
  stale: { label: '오래된 정보', tone: 'warning', order: 3, description: '유효기간이 지나 재확인 필요' },
  unknown: { label: '확인 필요', tone: 'warning', order: 4, description: '확인일이 없어 최신성 알 수 없음' },
}
export const SOURCE_STATUSES = (Object.keys(SOURCE_STATUS_META) as SourceStatus[]).sort(
  (a, b) => SOURCE_STATUS_META[a].order - SOURCE_STATUS_META[b].order,
)

/* 지원 유형 */
export const SUPPORT_TYPE_META: Record<SupportType, IconMeta> = {
  loan: { label: '융자', tone: 'info', icon: Banknote, order: 0 },
  guarantee: { label: '보증', tone: 'accent', icon: ShieldCheck, order: 1 },
  grant: { label: '출연금', tone: 'success', icon: Coins, order: 2 },
  subsidy: { label: '보조금', tone: 'success', icon: Coins, order: 3 },
  voucher: { label: '바우처', tone: 'info', icon: FileCheck, order: 4 },
  rnd: { label: '연구개발', tone: 'info', icon: FlaskConical, order: 5 },
  employment: { label: '고용', tone: 'info', icon: Users, order: 6 },
  export: { label: '수출', tone: 'info', icon: Ship, order: 7 },
  certification: { label: '인증', tone: 'success', icon: Award, order: 8 },
  investment: { label: '투자', tone: 'accent', icon: TrendingUp, order: 9 },
  tax_support: { label: '세제지원', tone: 'neutral', icon: Landmark, order: 10 },
  consulting: { label: '컨설팅', tone: 'neutral', icon: Briefcase, order: 11 },
  other: { label: '기타', tone: 'neutral', icon: ClipboardList, order: 12 },
}
export const SUPPORT_TYPES = (Object.keys(SUPPORT_TYPE_META) as SupportType[]).sort(
  (a, b) => SUPPORT_TYPE_META[a].order - SUPPORT_TYPE_META[b].order,
)

/* 정보 최신성 */
export const FRESHNESS_META: Record<InformationFreshnessStatus, IconMeta> = {
  current: { label: '최신', tone: 'success', icon: CheckCircle2, order: 0 },
  review_due: { label: '재확인 권장', tone: 'warning', icon: Clock, order: 1 },
  stale: { label: '오래됨', tone: 'danger', icon: AlertTriangle, order: 2 },
  unknown: { label: '확인 필요', tone: 'warning', icon: CircleHelp, order: 3 },
}

/* 전략 상태 */
export const STRATEGY_STATUS_META: Record<FundingStrategyStatus, IconMeta> = {
  draft: { label: '작성 중', tone: 'neutral', icon: ClipboardList, order: 0 },
  reviewed: { label: '내부 검토', tone: 'info', icon: ClipboardCheck, order: 1 },
  finalized: { label: '전략 확정', tone: 'success', icon: ShieldCheck, order: 2 },
  superseded: { label: '이전 버전', tone: 'neutral', icon: MinusCircle, order: 3 },
}
export const STRATEGY_STATUSES = (Object.keys(STRATEGY_STATUS_META) as FundingStrategyStatus[]).sort(
  (a, b) => STRATEGY_STATUS_META[a].order - STRATEGY_STATUS_META[b].order,
)

/* 후보 우선순위 */
export const MATCH_PRIORITY_META: Record<MatchPriority, Meta> = {
  primary: { label: '우선 검토', tone: 'success', order: 0, description: '가장 먼저 추가 검토할 후보' },
  secondary: { label: '보조 검토', tone: 'info', order: 1, description: '자료 보강 후 검토할 후보' },
  watch: { label: '관찰', tone: 'neutral', order: 2, description: '조건 변화 시 재검토' },
  excluded: { label: '제외', tone: 'neutral', order: 3, description: '현재 검토 대상 제외' },
}
export const MATCH_PRIORITIES = (Object.keys(MATCH_PRIORITY_META) as MatchPriority[]).sort(
  (a, b) => MATCH_PRIORITY_META[a].order - MATCH_PRIORITY_META[b].order,
)

/* 후보 신뢰도 (승인 확률 아님) */
export const MATCH_CONFIDENCE_META: Record<MatchConfidence, Meta> = {
  high: { label: '근거 충분', tone: 'success', order: 0, description: '기초 요건 근거가 비교적 충분 (승인 보장 아님)' },
  medium: { label: '보통', tone: 'info', order: 1, description: '일부 근거 확인, 추가 확인 필요' },
  low: { label: '근거 부족', tone: 'warning', order: 2, description: '자료 보강 후 검토 필요' },
  insufficient_data: { label: '판단 부족', tone: 'neutral', order: 3, description: '현재 정보로 판단 부족' },
}

/* 요건 충족 상태 */
export const CRITERION_STATUS_META: Record<CriterionStatus, Meta> = {
  met: { label: '충족', tone: 'success', order: 0 },
  partially_met: { label: '부분 충족', tone: 'warning', order: 1 },
  not_met: { label: '미충족', tone: 'danger', order: 2 },
  unknown: { label: '확인 필요', tone: 'neutral', order: 3, description: '데이터 없음 — 미충족과 다름' },
  not_applicable: { label: '해당 없음', tone: 'neutral', order: 4 },
}
export const CRITERION_STATUSES = (Object.keys(CRITERION_STATUS_META) as CriterionStatus[]).sort(
  (a, b) => CRITERION_STATUS_META[a].order - CRITERION_STATUS_META[b].order,
)

/* 부족조건 심각도 */
export const GAP_SEVERITY_META: Record<GapSeverity, Meta> = {
  info: { label: '참고', tone: 'neutral', order: 0 },
  low: { label: '낮음', tone: 'info', order: 1 },
  medium: { label: '보통', tone: 'warning', order: 2 },
  high: { label: '높음', tone: 'warning', order: 3 },
  critical: { label: '중대', tone: 'danger', order: 4 },
}
export const GAP_SEVERITIES = (Object.keys(GAP_SEVERITY_META) as GapSeverity[]).sort(
  (a, b) => GAP_SEVERITY_META[a].order - GAP_SEVERITY_META[b].order,
)

/* 부족조건 상태 */
export const GAP_STATUS_META: Record<GapStatus, Meta> = {
  open: { label: '미해결', tone: 'warning', order: 0 },
  in_progress: { label: '진행 중', tone: 'info', order: 1 },
  resolved: { label: '해결', tone: 'success', order: 2 },
  accepted: { label: '감수', tone: 'neutral', order: 3 },
  not_applicable: { label: '해당 없음', tone: 'neutral', order: 4 },
}
export const GAP_STATUSES = (Object.keys(GAP_STATUS_META) as GapStatus[]).sort(
  (a, b) => GAP_STATUS_META[a].order - GAP_STATUS_META[b].order,
)

/* 접촉 채널 */
export const OUTREACH_CHANNEL_META: Record<OutreachChannel, IconMeta> = {
  phone: { label: '전화', tone: 'info', icon: Phone, order: 0 },
  email: { label: '이메일', tone: 'info', icon: FileCheck, order: 1 },
  website: { label: '누리집', tone: 'info', icon: Globe, order: 2 },
  visit: { label: '방문', tone: 'info', icon: MapPin, order: 3 },
  referral: { label: '소개', tone: 'accent', icon: Handshake, order: 4 },
  briefing: { label: '설명회', tone: 'info', icon: Users, order: 5 },
  seminar: { label: '세미나', tone: 'info', icon: Users, order: 6 },
  consultant: { label: '컨설턴트', tone: 'neutral', icon: Briefcase, order: 7 },
  other: { label: '기타', tone: 'neutral', icon: ClipboardList, order: 8 },
}
export const OUTREACH_CHANNELS = (Object.keys(OUTREACH_CHANNEL_META) as OutreachChannel[]).sort(
  (a, b) => OUTREACH_CHANNEL_META[a].order - OUTREACH_CHANNEL_META[b].order,
)

/* 접촉 계획 상태 */
export const OUTREACH_PLAN_STATUS_META: Record<OutreachPlanStatus, Meta> = {
  planned: { label: '예정', tone: 'neutral', order: 0 },
  prepared: { label: '준비 완료', tone: 'info', order: 1 },
  contacted: { label: '접촉함', tone: 'accent', order: 2 },
  follow_up: { label: '후속 진행', tone: 'warning', order: 3 },
  completed: { label: '완료', tone: 'success', order: 4 },
  cancelled: { label: '취소', tone: 'neutral', order: 5 },
}
export const OUTREACH_PLAN_STATUSES = (Object.keys(OUTREACH_PLAN_STATUS_META) as OutreachPlanStatus[]).sort(
  (a, b) => OUTREACH_PLAN_STATUS_META[a].order - OUTREACH_PLAN_STATUS_META[b].order,
)

/* 준비자료 상태 */
export const DOCUMENT_STATUS_META: Record<DocumentRequirementStatus, Meta> = {
  missing: { label: '미준비', tone: 'danger', order: 0 },
  requested: { label: '요청함', tone: 'warning', order: 1 },
  received: { label: '수령', tone: 'info', order: 2 },
  reviewing: { label: '검토 중', tone: 'info', order: 3 },
  ready: { label: '준비 완료', tone: 'success', order: 4 },
  submitted: { label: '제출함', tone: 'success', order: 5 },
  not_required: { label: '불필요', tone: 'neutral', order: 6 },
}
export const DOCUMENT_STATUSES = (Object.keys(DOCUMENT_STATUS_META) as DocumentRequirementStatus[]).sort(
  (a, b) => DOCUMENT_STATUS_META[a].order - DOCUMENT_STATUS_META[b].order,
)

/* 신청 단계 */
export const APPLICATION_STAGE_META: Record<ApplicationStage, Meta> = {
  prospect: { label: '후보', tone: 'neutral', order: 0 },
  pre_review: { label: '사전검토', tone: 'neutral', order: 1 },
  preparing: { label: '준비 중', tone: 'info', order: 2 },
  submitted: { label: '제출', tone: 'info', order: 3 },
  reviewing: { label: '심사 중', tone: 'warning', order: 4 },
  supplement_requested: { label: '보완 요청', tone: 'warning', order: 5 },
  supplement_submitted: { label: '보완 제출', tone: 'info', order: 6 },
  approved: { label: '승인', tone: 'success', order: 7 },
  conditionally_approved: { label: '조건부 승인', tone: 'success', order: 8 },
  rejected: { label: '부결', tone: 'danger', order: 9 },
  withdrawn: { label: '철회', tone: 'neutral', order: 10 },
  on_hold: { label: '보류', tone: 'neutral', order: 11 },
  completed: { label: '완료', tone: 'success', order: 12 },
}
export const APPLICATION_STAGES = (Object.keys(APPLICATION_STAGE_META) as ApplicationStage[]).sort(
  (a, b) => APPLICATION_STAGE_META[a].order - APPLICATION_STAGE_META[b].order,
)

/* 결과 유형 */
export const OUTCOME_TYPE_META: Record<OutcomeType, IconMeta> = {
  approved: { label: '승인', tone: 'success', icon: CheckCircle2, order: 0 },
  conditionally_approved: { label: '조건부 승인', tone: 'success', icon: CheckCircle2, order: 1 },
  rejected: { label: '부결', tone: 'danger', icon: XCircle, order: 2 },
  withdrawn: { label: '철회', tone: 'neutral', icon: MinusCircle, order: 3 },
  on_hold: { label: '보류', tone: 'neutral', icon: Clock, order: 4 },
  not_applied: { label: '미신청', tone: 'neutral', icon: MinusCircle, order: 5 },
  pending: { label: '진행 중', tone: 'info', icon: Clock, order: 6 },
}
export const OUTCOME_TYPES = (Object.keys(OUTCOME_TYPE_META) as OutcomeType[]).sort(
  (a, b) => OUTCOME_TYPE_META[a].order - OUTCOME_TYPE_META[b].order,
)

/* 성과 지표 유형 */
export const OUTCOME_METRIC_TYPE_META: Record<OutcomeMetricType, { label: string }> = {
  funding_amount: { label: '자금 조달액' },
  guarantee_amount: { label: '보증 금액' },
  grant_amount: { label: '지원금액' },
  interest_cost: { label: '금융 비용' },
  processing_days: { label: '처리 기간(일)' },
  preparation_hours: { label: '준비 시간' },
  consulting_hours: { label: '컨설팅 투입시간' },
  jobs_created: { label: '고용 변화' },
  revenue_change: { label: '매출 변화' },
  cost_reduction: { label: '비용 절감' },
  time_saved: { label: '업무시간 절감' },
  certification_obtained: { label: '인증 취득' },
  application_count: { label: '신청 건수' },
  approval_count: { label: '승인 건수' },
  other: { label: '기타' },
}
export const OUTCOME_METRIC_TYPES = Object.keys(OUTCOME_METRIC_TYPE_META) as OutcomeMetricType[]

/* 사례 공개범위 */
export const CASE_VISIBILITY_META: Record<CaseVisibility, Meta> = {
  internal: { label: '내부 전용', tone: 'danger', order: 0, description: '외부 노출 금지' },
  anonymized: { label: '익명화', tone: 'warning', order: 1, description: '재식별 불가하게 익명 처리' },
  customer_approved: { label: '고객 승인', tone: 'success', order: 2, description: '고객 동의로 공유 가능' },
  public: { label: '공개', tone: 'accent', order: 3, description: '공개 가능' },
}
export const CASE_VISIBILITIES = (Object.keys(CASE_VISIBILITY_META) as CaseVisibility[]).sort(
  (a, b) => CASE_VISIBILITY_META[a].order - CASE_VISIBILITY_META[b].order,
)

/* 사례 상태 */
export const CASE_STATUS_META: Record<CaseStudyStatus, Meta> = {
  draft: { label: '초안', tone: 'neutral', order: 0 },
  review: { label: '검토', tone: 'info', order: 1 },
  approved: { label: '승인', tone: 'success', order: 2 },
  archived: { label: '보관', tone: 'neutral', order: 3 },
}
export const CASE_STATUSES = (Object.keys(CASE_STATUS_META) as CaseStudyStatus[]).sort(
  (a, b) => CASE_STATUS_META[a].order - CASE_STATUS_META[b].order,
)

/* 동의 상태 */
export const CONSENT_STATUS_META: Record<ConsentStatus, Meta> = {
  not_requested: { label: '미요청', tone: 'neutral', order: 0 },
  pending: { label: '대기', tone: 'warning', order: 1 },
  agreed: { label: '동의', tone: 'success', order: 2 },
  declined: { label: '거절', tone: 'danger', order: 3 },
  not_required_internal: { label: '내부용(불필요)', tone: 'neutral', order: 4 },
}
export const CONSENT_STATUSES = (Object.keys(CONSENT_STATUS_META) as ConsentStatus[]).sort(
  (a, b) => CONSENT_STATUS_META[a].order - CONSENT_STATUS_META[b].order,
)

/* 사용자 흐름 7단계 (쉬운 표시) */
export const FUNDING_STEPS = [
  '연결할 기관 찾기',
  '근거와 부족조건 확인',
  '접촉 계획 세우기',
  '준비자료 점검',
  '신청·심사 진행',
  '결과·성과 기록',
  '사례로 정리',
] as const

/** 승인 확률·예상 금액을 만들지 않는다는 핵심 고지 */
export const NO_APPROVAL_PREDICTION_NOTE =
  '이 화면은 승인 가능성·확률이나 예상 한도·금리·지원금액을 제시하지 않습니다. 추가로 검토할 우선순위와 확인이 필요한 사항만 정리합니다. 실제 조건은 공식 공고와 기관 문의로 확인해야 합니다.'

/** 기관 제출 준비자료 고지 */
export const INSTITUTION_SUBMISSION_NOTE =
  '기관 제출 준비자료는 공식 신청서가 아니며 자동 제출·기관 양식 대체가 아닙니다. 실제 공고·신청서식을 반드시 확인하세요.'
