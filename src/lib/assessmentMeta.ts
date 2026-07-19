import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDollarSign,
  CircleHelp,
  ClipboardCheck,
  Database,
  FileWarning,
  FlaskConical,
  Landmark,
  Layers,
  type LucideIcon,
  MessageCircleQuestion,
  MinusCircle,
  Palette,
  Recycle,
  Rocket,
  ScanSearch,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  Users,
  Workflow,
} from 'lucide-react'
import type { StatusTone } from '../types'
import type {
  AnalysisIssueSeverity,
  AnalysisIssueStatus,
  AnalysisIssueType,
  AssessmentConfidence,
  AssessmentDomain,
  AssessmentRecommendation,
  AssessmentStatus,
  ComparisonImportance,
  InterviewQuestionPriority,
  InterviewQuestionStatus,
  ResponseComparisonStatus,
  ScoreConfidence,
  WebsiteReadinessDomain,
  WebsiteReadinessRecommendation,
} from '../types/assessment'

interface Meta {
  label: string
  description: string
  tone: StatusTone
  icon: LucideIcon
  order: number
}

type MetaMap<K extends string> = Record<K, Meta>

function keysByOrder<K extends string>(map: MetaMap<K>): K[] {
  return (Object.keys(map) as K[]).sort((a, b) => map[a].order - map[b].order)
}

/* ------------------------------------------------------------------ */
/* 분석 상태                                                            */
/* ------------------------------------------------------------------ */

export const ASSESSMENT_STATUS_META: MetaMap<AssessmentStatus> = {
  draft: {
    label: '분석 초안',
    description: '자동 분석이 계산된 초안 상태입니다.',
    tone: 'warning',
    icon: FlaskConical,
    order: 0,
  },
  reviewed: {
    label: '내부 검토',
    description: '담당자가 검토를 완료한 상태입니다.',
    tone: 'info',
    icon: ScanSearch,
    order: 1,
  },
  finalized: {
    label: '진단 확정',
    description: '진단 결과가 확정되었습니다.',
    tone: 'success',
    icon: CheckCircle2,
    order: 2,
  },
  superseded: {
    label: '이전 버전',
    description: '새 버전 분석으로 대체된 이전 결과입니다.',
    tone: 'neutral',
    icon: MinusCircle,
    order: 3,
  },
}

export const ASSESSMENT_STATUSES = keysByOrder(ASSESSMENT_STATUS_META)

/* ------------------------------------------------------------------ */
/* 판정                                                                 */
/* ------------------------------------------------------------------ */

export const RECOMMENDATION_META: MetaMap<AssessmentRecommendation> = {
  ax_strongly_recommended: {
    label: 'AX 결합형 적극 추천',
    description: '반복성·효과·데이터가 충분해 AX 도입 가치가 높습니다.',
    tone: 'success',
    icon: Sparkles,
    order: 0,
  },
  simple_automation_recommended: {
    label: '간단한 업무자동화 추천',
    description: '핵심 업무 1개를 MVP-lite로 먼저 검증하는 것이 적절합니다.',
    tone: 'info',
    icon: Rocket,
    order: 1,
  },
  diagnosis_document_first: {
    label: '진단·문서 자동화부터 시작',
    description: '업무 정리와 문서 자동화로 기반을 먼저 다지는 단계입니다.',
    tone: 'info',
    icon: ClipboardCheck,
    order: 2,
  },
  funding_consulting_first: {
    label: '자금조달·업무정리 우선',
    description: '구축보다 자금조달 컨설팅과 업무 정리가 먼저 필요합니다.',
    tone: 'warning',
    icon: Landmark,
    order: 3,
  },
  build_deferred_data: {
    label: '데이터 부족으로 구축 보류',
    description: '핵심 데이터가 부족해 지금 구축을 확정하기 어렵습니다.',
    tone: 'warning',
    icon: Database,
    order: 4,
  },
  build_deferred_adoption: {
    label: '도입 의지 부족으로 구축 보류',
    description: '실제 사용·운영 의지가 확인되지 않아 구축을 보류합니다.',
    tone: 'warning',
    icon: TrendingDown,
    order: 5,
  },
  expert_review_required: {
    label: '전문가 검토 후 진행',
    description: '개인정보·전문 판단 위험이 커 전문가 검토가 필요합니다.',
    tone: 'danger',
    icon: ShieldAlert,
    order: 6,
  },
}

export const RECOMMENDATIONS = keysByOrder(RECOMMENDATION_META)

/* ------------------------------------------------------------------ */
/* 점수 영역                                                            */
/* ------------------------------------------------------------------ */

export const ASSESSMENT_DOMAIN_META: MetaMap<AssessmentDomain> = {
  repetition: {
    label: '반복성과 업무량',
    description: '자동화 대상 업무의 반복 정도와 업무량입니다.',
    tone: 'info',
    icon: Recycle,
    order: 0,
  },
  economic: {
    label: '시간·비용 절감 가능성',
    description: '자동화로 줄일 수 있는 시간과 비용의 규모입니다.',
    tone: 'accent',
    icon: CircleDollarSign,
    order: 1,
  },
  data_readiness: {
    label: '데이터 준비도',
    description: '활용 가능한 데이터의 형태·품질·접근성입니다.',
    tone: 'info',
    icon: Database,
    order: 2,
  },
  process_clarity: {
    label: '프로세스 명확성',
    description: '업무 규칙과 처리 흐름이 명확한 정도입니다.',
    tone: 'info',
    icon: Workflow,
    order: 3,
  },
  adoption: {
    label: '사용자 도입 의지',
    description: '대표자·현장의 실제 사용 및 변화 의지입니다.',
    tone: 'success',
    icon: Users,
    order: 4,
  },
  execution: {
    label: '실행 및 유지 가능성',
    description: '테스트 담당자·자료 제공·피드백 등 실행 여건입니다.',
    tone: 'accent',
    icon: Rocket,
    order: 5,
  },
  funding_connection: {
    label: '자금조달·확장 연결성',
    description: '자금조달·사업화로 이어질 수 있는 연결성입니다.',
    tone: 'neutral',
    icon: Landmark,
    order: 6,
  },
}

export const ASSESSMENT_DOMAINS = keysByOrder(ASSESSMENT_DOMAIN_META)

/* ------------------------------------------------------------------ */
/* 신뢰도                                                               */
/* ------------------------------------------------------------------ */

export const CONFIDENCE_META: MetaMap<AssessmentConfidence> = {
  high: {
    label: '높음',
    description: '대표자·현장 응답과 수치 데이터가 충분합니다.',
    tone: 'success',
    icon: CheckCircle2,
    order: 0,
  },
  medium: {
    label: '보통',
    description: '일부 역할 응답이나 수치 데이터가 부족합니다.',
    tone: 'warning',
    icon: AlertTriangle,
    order: 1,
  },
  low: {
    label: '낮음',
    description: '단일 응답이거나 핵심 문항 응답이 부족합니다.',
    tone: 'danger',
    icon: AlertTriangle,
    order: 2,
  },
  insufficient: {
    label: '데이터 미달',
    description: '점수 산정에 필요한 최소 데이터에 미치지 못합니다.',
    tone: 'danger',
    icon: Ban,
    order: 3,
  },
}

/** 영역 단위 신뢰도(3단계)용 축약 접근 */
export const SCORE_CONFIDENCE_META: Record<
  ScoreConfidence,
  { label: string; tone: StatusTone }
> = {
  high: { label: '높음', tone: 'success' },
  medium: { label: '보통', tone: 'warning' },
  low: { label: '낮음', tone: 'danger' },
}

/* ------------------------------------------------------------------ */
/* 이슈 유형·심각도·상태                                                 */
/* ------------------------------------------------------------------ */

export const ISSUE_TYPE_META: MetaMap<AnalysisIssueType> = {
  contradiction: {
    label: '응답 모순',
    description: '같은 사실에 대한 응답이 서로 충돌합니다.',
    tone: 'danger',
    icon: AlertTriangle,
    order: 0,
  },
  perception_gap: {
    label: '인식 차이',
    description: '대표자와 현장의 인식이 크게 다릅니다.',
    tone: 'warning',
    icon: Users,
    order: 1,
  },
  missing_data: {
    label: '데이터 누락',
    description: '판단에 필요한 핵심 정보가 비어 있습니다.',
    tone: 'warning',
    icon: FileWarning,
    order: 2,
  },
  risk_signal: {
    label: '위험 신호',
    description: '개인정보·전문가 위험 등 주의가 필요한 신호입니다.',
    tone: 'danger',
    icon: ShieldAlert,
    order: 3,
  },
  expert_review: {
    label: '전문가 확인',
    description: '전문 판단이 필요한 영역이 포함되어 있습니다.',
    tone: 'danger',
    icon: ShieldAlert,
    order: 4,
  },
  insufficient_response: {
    label: '응답 부족',
    description: '응답자·응답 수가 부족해 판단이 제한됩니다.',
    tone: 'warning',
    icon: MinusCircle,
    order: 5,
  },
  invalid_answer: {
    label: '응답 오류',
    description: '형식이 맞지 않거나 해석이 어려운 응답입니다.',
    tone: 'warning',
    icon: FileWarning,
    order: 6,
  },
  outlier: {
    label: '극단값',
    description: '다른 응답과 크게 벗어난 값입니다.',
    tone: 'info',
    icon: ScanSearch,
    order: 7,
  },
}

export const ISSUE_TYPES = keysByOrder(ISSUE_TYPE_META)

export const ISSUE_SEVERITY_META: Record<
  AnalysisIssueSeverity,
  { label: string; tone: StatusTone; order: number }
> = {
  critical: { label: '중대', tone: 'danger', order: 0 },
  warning: { label: '주의', tone: 'warning', order: 1 },
  info: { label: '참고', tone: 'info', order: 2 },
}

export const ISSUE_STATUS_META: Record<
  AnalysisIssueStatus,
  { label: string; tone: StatusTone; order: number }
> = {
  open: { label: '미확인', tone: 'warning', order: 0 },
  acknowledged: { label: '확인함', tone: 'info', order: 1 },
  resolved: { label: '해결', tone: 'success', order: 2 },
  excluded: { label: '제외', tone: 'neutral', order: 3 },
}

/* ------------------------------------------------------------------ */
/* 인터뷰 질문 우선순위·상태                                             */
/* ------------------------------------------------------------------ */

export const INTERVIEW_PRIORITY_META: Record<
  InterviewQuestionPriority,
  { label: string; tone: StatusTone; order: number }
> = {
  critical: { label: '최우선', tone: 'danger', order: 0 },
  high: { label: '높음', tone: 'warning', order: 1 },
  medium: { label: '보통', tone: 'info', order: 2 },
  low: { label: '낮음', tone: 'neutral', order: 3 },
}

export const INTERVIEW_STATUS_META: Record<
  InterviewQuestionStatus,
  { label: string; tone: StatusTone; order: number }
> = {
  suggested: { label: '자동 제안', tone: 'neutral', order: 0 },
  selected: { label: '선택됨', tone: 'info', order: 1 },
  answered: { label: '답변 완료', tone: 'success', order: 2 },
  excluded: { label: '제외', tone: 'neutral', order: 3 },
}

/* ------------------------------------------------------------------ */
/* 응답 비교 상태·중요도                                                 */
/* ------------------------------------------------------------------ */

export const COMPARISON_STATUS_META: Record<
  ResponseComparisonStatus,
  { label: string; tone: StatusTone; icon: LucideIcon; order: number }
> = {
  aligned: { label: '일치', tone: 'success', icon: CheckCircle2, order: 0 },
  minor_gap: { label: '일부 차이', tone: 'warning', icon: AlertTriangle, order: 1 },
  major_gap: { label: '큰 차이', tone: 'danger', icon: AlertTriangle, order: 2 },
  insufficient: { label: '확인 필요', tone: 'neutral', icon: CircleHelp, order: 3 },
}

export const COMPARISON_IMPORTANCE_META: Record<
  ComparisonImportance,
  { label: string; tone: StatusTone; order: number }
> = {
  critical: { label: '매우 중요', tone: 'danger', order: 0 },
  high: { label: '중요', tone: 'warning', order: 1 },
  medium: { label: '보통', tone: 'info', order: 2 },
  low: { label: '낮음', tone: 'neutral', order: 3 },
}

/* ------------------------------------------------------------------ */
/* 홈페이지 준비도                                                       */
/* ------------------------------------------------------------------ */

export const WEBSITE_DOMAIN_META: MetaMap<WebsiteReadinessDomain> = {
  purpose_clarity: {
    label: '홈페이지 목적 명확성',
    description: '홈페이지의 목적과 핵심 행동이 분명한 정도입니다.',
    tone: 'info',
    icon: Target,
    order: 0,
  },
  customer_clarity: {
    label: '핵심 고객 명확성',
    description: '타깃 고객과 차별점이 분명한 정도입니다.',
    tone: 'info',
    icon: Users,
    order: 1,
  },
  content_readiness: {
    label: '콘텐츠 준비도',
    description: '필요한 페이지와 콘텐츠가 준비된 정도입니다.',
    tone: 'accent',
    icon: Layers,
    order: 2,
  },
  brand_direction: {
    label: '브랜드 방향 명확성',
    description: '브랜드 분위기와 색상 방향의 명확성입니다.',
    tone: 'accent',
    icon: Palette,
    order: 3,
  },
  asset_readiness: {
    label: '이미지·영상 자산 준비도',
    description: '로고·사진·영상 등 시각 자산의 보유 정도입니다.',
    tone: 'info',
    icon: Layers,
    order: 4,
  },
  operation_readiness: {
    label: '운영·수정 준비도',
    description: '완성 후 운영·수정 체계의 준비 정도입니다.',
    tone: 'neutral',
    icon: ClipboardCheck,
    order: 5,
  },
}

export const WEBSITE_DOMAINS = keysByOrder(WEBSITE_DOMAIN_META)

export const WEBSITE_RECOMMENDATION_META: Record<
  WebsiteReadinessRecommendation,
  { label: string; description: string; tone: StatusTone; icon: LucideIcon }
> = {
  design_ready: {
    label: '바로 디자인 시안 제작 가능',
    description: '핵심 정보와 자산이 충분해 시안 제작을 시작할 수 있습니다.',
    tone: 'success',
    icon: Sparkles,
  },
  content_supplement: {
    label: '일부 콘텐츠 보완 후 제작 권장',
    description: '핵심 방향은 명확하나 콘텐츠 일부 보완이 필요합니다.',
    tone: 'info',
    icon: ClipboardCheck,
  },
  structure_first: {
    label: '페이지 구조·콘텐츠 정리부터 필요',
    description: '페이지 구성과 콘텐츠 정리가 먼저 필요합니다.',
    tone: 'warning',
    icon: Layers,
  },
  planning_interview_first: {
    label: '홈페이지 기획 인터뷰 우선',
    description: '목적·고객·콘텐츠가 불명확해 기획 인터뷰가 먼저 필요합니다.',
    tone: 'warning',
    icon: MessageCircleQuestion,
  },
}

/* 아이콘 재노출 (컴포넌트 편의) */
export { CircleHelp as ConfidenceHelpIcon }
