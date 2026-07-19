import {
  Archive,
  Ban,
  BarChart3,
  Boxes,
  Brain,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Coins,
  Database,
  FileCheck2,
  FileText,
  FlaskConical,
  Gauge,
  GitMerge,
  Landmark,
  Layers,
  type LucideIcon,
  MinusCircle,
  Rocket,
  Route,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Truck,
  Users,
  Workflow,
  Wrench,
  ZapOff,
} from 'lucide-react'
import type { StatusTone } from '../types'
import type {
  AiNecessity,
  AutomationApproach,
  CandidateComplexity,
  CandidateConfidence,
  CandidateDependencyType,
  CandidateRiskDeductionType,
  CandidateRiskLevel,
  CandidateScoreDomain,
  CandidateSelectionReason,
  CandidateSourceType,
  CandidateStatus,
  CandidateTaskFamily,
  PriorityQuadrant,
  RecommendedMvpTemplate,
  SelectionResultStatus,
} from '../types/selection'

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
interface SimpleMeta {
  label: string
  tone: StatusTone
  order: number
}

/* 후보 상태 */
export const CANDIDATE_STATUS_META: MetaMap<CandidateStatus> = {
  discovered: { label: '자동 발견', description: '진단 응답에서 자동 발견된 후보입니다.', tone: 'neutral', icon: Search, order: 0 },
  reviewing: { label: '검토 중', description: '담당자가 검토 중인 후보입니다.', tone: 'info', icon: ClipboardList, order: 1 },
  shortlisted: { label: '후보 선정', description: '우선 검토 대상으로 선정된 후보입니다.', tone: 'info', icon: Star, order: 2 },
  selected_primary: { label: '핵심 과제', description: '1차 MVP 핵심 과제로 선정되었습니다.', tone: 'success', icon: Rocket, order: 3 },
  selected_secondary: { label: '보조 과제', description: '핵심 과제의 후속·연계 과제입니다.', tone: 'accent', icon: Layers, order: 4 },
  deferred: { label: '후순위 보류', description: '지금은 보류하고 이후 재검토합니다.', tone: 'warning', icon: MinusCircle, order: 5 },
  rejected: { label: '제외', description: '이번 선정에서 제외된 후보입니다.', tone: 'danger', icon: Ban, order: 6 },
  archived: { label: '보관', description: '기본 목록에서 숨겨진 후보입니다.', tone: 'neutral', icon: Archive, order: 7 },
}
export const CANDIDATE_STATUSES = keysByOrder(CANDIDATE_STATUS_META)

/* 후보 출처 */
export const CANDIDATE_SOURCE_META: Record<CandidateSourceType, { label: string; icon: LucideIcon }> = {
  repeat_table: { label: '업무 목록 표', icon: ClipboardList },
  structured_answer: { label: '구조화 응답', icon: FileText },
  assessment_evidence: { label: '진단 근거', icon: FileCheck2 },
  analysis_issue: { label: '확인 필요 이슈', icon: ShieldAlert },
  interview_answer: { label: '인터뷰 답변', icon: Users },
  manual: { label: '수동 추가', icon: Wrench },
}

/* 업무군 */
export const TASK_FAMILY_META: Record<CandidateTaskFamily, { label: string; tone: StatusTone; icon: LucideIcon }> = {
  data_collection: { label: '자료 수집', tone: 'info', icon: Database },
  data_validation: { label: '자료 검수', tone: 'info', icon: ClipboardCheck },
  document_generation: { label: '문서 생성', tone: 'accent', icon: FileText },
  diagnosis_decision: { label: '진단·판정', tone: 'accent', icon: Gauge },
  schedule_progress: { label: '일정·진행관리', tone: 'info', icon: CalendarClock },
  approval_workflow: { label: '승인 워크플로', tone: 'warning', icon: Workflow },
  quotation_cost_profit: { label: '견적·원가·마진', tone: 'success', icon: Coins },
  inventory_asset: { label: '재고·자산', tone: 'neutral', icon: Boxes },
  field_operation: { label: '현장 운영', tone: 'neutral', icon: Truck },
  customer_sales: { label: '고객·영업', tone: 'success', icon: TrendingUp },
  customer_response: { label: '고객 응대', tone: 'info', icon: Users },
  reporting_dashboard: { label: '보고·대시보드', tone: 'accent', icon: BarChart3 },
  system_integration: { label: '시스템 연동', tone: 'warning', icon: Route },
  website_content: { label: '홈페이지 콘텐츠', tone: 'accent', icon: FileText },
  other: { label: '기타', tone: 'neutral', icon: ClipboardList },
}
export const TASK_FAMILIES = Object.keys(TASK_FAMILY_META) as CandidateTaskFamily[]

/* 자동화 방식 */
export const AUTOMATION_APPROACH_META: MetaMap<AutomationApproach> = {
  rule_based: { label: '규칙 기반', description: '정해진 조건·계산으로 처리할 수 있습니다.', tone: 'success', icon: ShieldCheck, order: 0 },
  workflow_automation: { label: '워크플로 자동화', description: '담당자 배정·승인·알림 흐름을 자동화합니다.', tone: 'info', icon: Workflow, order: 1 },
  ai_assisted: { label: 'AI 보조', description: '비정형 문서·요약·분류에 AI를 활용합니다.', tone: 'accent', icon: Brain, order: 2 },
  hybrid: { label: '혼합형', description: '규칙 흐름에 일부 AI 보조를 결합합니다.', tone: 'accent', icon: GitMerge, order: 3 },
  data_cleanup_first: { label: '자료 정리 우선', description: '개발보다 데이터 정리가 먼저 필요합니다.', tone: 'warning', icon: Database, order: 4 },
  process_definition_first: { label: '업무 정의 우선', description: '업무 규칙·책임자 정의가 먼저 필요합니다.', tone: 'warning', icon: Route, order: 5 },
  manual_improvement_only: { label: '업무개선 권장', description: '개발보다 양식·절차 개선이 적합합니다.', tone: 'neutral', icon: Wrench, order: 6 },
  not_recommended: { label: '권장하지 않음', description: '효과가 낮거나 위험이 과도합니다.', tone: 'danger', icon: Ban, order: 7 },
}

/* AI 필요성 */
export const AI_NECESSITY_META: MetaMap<AiNecessity> = {
  unnecessary: { label: 'AI 불필요', description: '규칙 기반으로 충분합니다.', tone: 'neutral', icon: ZapOff, order: 0 },
  optional: { label: 'AI 선택', description: '있으면 편하지만 핵심은 아닙니다.', tone: 'info', icon: Sparkles, order: 1 },
  useful: { label: 'AI 유용', description: '비정형 처리에 실질적 효과가 있습니다.', tone: 'accent', icon: Brain, order: 2 },
  advanced_later: { label: '고도화 후 검토', description: '데이터 축적 후 예측·고급분석을 검토합니다.', tone: 'warning', icon: TrendingUp, order: 3 },
  not_applicable: { label: '해당 없음', description: 'AI와 무관한 업무입니다.', tone: 'neutral', icon: MinusCircle, order: 4 },
}

/* 복잡도 */
export const COMPLEXITY_META: Record<CandidateComplexity, SimpleMeta> = {
  low: { label: '낮음', tone: 'success', order: 0 },
  medium: { label: '보통', tone: 'info', order: 1 },
  high: { label: '높음', tone: 'warning', order: 2 },
  very_high: { label: '매우 높음', tone: 'danger', order: 3 },
}

/* 위험 수준 */
export const RISK_LEVEL_META: Record<CandidateRiskLevel, SimpleMeta> = {
  low: { label: '낮음', tone: 'success', order: 0 },
  medium: { label: '보통', tone: 'info', order: 1 },
  high: { label: '높음', tone: 'warning', order: 2 },
  critical: { label: '중대', tone: 'danger', order: 3 },
}

/* 신뢰도 */
export const CANDIDATE_CONFIDENCE_META: Record<CandidateConfidence, SimpleMeta> = {
  high: { label: '높음', tone: 'success', order: 0 },
  medium: { label: '보통', tone: 'warning', order: 1 },
  low: { label: '낮음', tone: 'danger', order: 2 },
  insufficient: { label: '데이터 미달', tone: 'danger', order: 3 },
}

/* 의존성 유형 */
export const DEPENDENCY_TYPE_META: Record<CandidateDependencyType, { label: string; icon: LucideIcon }> = {
  data: { label: '데이터', icon: Database },
  process: { label: '프로세스', icon: Route },
  user: { label: '담당자', icon: Users },
  expert: { label: '전문가', icon: ShieldAlert },
  external_system: { label: '외부 시스템', icon: Route },
  contract: { label: '계약·권한', icon: FileText },
  security: { label: '보안·개인정보', icon: ShieldCheck },
  other: { label: '기타', icon: ClipboardList },
}

/* 후보 점수 영역 */
export const CANDIDATE_SCORE_DOMAIN_META: MetaMap<CandidateScoreDomain> = {
  operational_impact: { label: '운영 영향도', description: '핵심 업무·고객·매출과의 연결 정도입니다.', tone: 'info', icon: TrendingUp, order: 0 },
  repetition_value: { label: '반복성과 업무량', description: '반복 빈도와 업무량입니다.', tone: 'info', icon: Layers, order: 1 },
  economic_benefit: { label: '시간·비용 개선', description: '절감 가능한 시간과 비용입니다.', tone: 'accent', icon: Coins, order: 2 },
  process_suitability: { label: '프로세스 자동화 적합성', description: '업무 규칙화 가능성입니다.', tone: 'info', icon: Workflow, order: 3 },
  data_readiness: { label: '데이터 준비도', description: '활용 가능한 데이터의 준비 정도입니다.', tone: 'info', icon: Database, order: 4 },
  implementation_feasibility: { label: '구현 실행 가능성', description: '1차 MVP 범위 내 구현 가능성입니다.', tone: 'success', icon: Wrench, order: 5 },
  adoption_readiness: { label: '사용자 도입 준비도', description: '실제 사용자·운영 여건입니다.', tone: 'success', icon: Users, order: 6 },
  funding_scalability: { label: '자금조달·확장 설명력', description: '생산성·기술성을 설명하기 쉬운 정도입니다.', tone: 'neutral', icon: Landmark, order: 7 },
}
export const CANDIDATE_SCORE_DOMAINS = keysByOrder(CANDIDATE_SCORE_DOMAIN_META)

/* 위험 감점 유형 */
export const RISK_DEDUCTION_LABEL: Record<CandidateRiskDeductionType, string> = {
  expert_risk: '전문가 최종 판단 핵심',
  privacy_risk: '개인정보·민감정보 위험',
  unclear_process: '업무 흐름 불명확',
  insufficient_data: '데이터 부족',
  low_adoption: '실제 사용자·담당자 없음',
  external_dependency: '외부 시스템 연동 의존',
  integration_complexity: '통합 복잡도',
  excessive_scope: '1차 MVP 범위 과다',
  no_owner: '운영 담당자 부재',
  low_measurement: '효과 측정 기준 없음',
  custom: '수동 감점',
}

/* 우선순위 사분면 */
export const QUADRANT_META: MetaMap<PriorityQuadrant> = {
  quick_win: { label: '빠른 실행', description: '효과가 크고 구현이 쉬운 후보입니다.', tone: 'success', icon: Rocket, order: 0 },
  strategic_bet: { label: '전략적 투자', description: '효과는 크나 준비·구현이 필요한 후보입니다.', tone: 'accent', icon: Star, order: 1 },
  prepare_first: { label: '선행 준비 필요', description: '데이터·업무 정의 등 선행 준비가 필요합니다.', tone: 'warning', icon: ClipboardList, order: 2 },
  defer: { label: '후순위 보류', description: '지금은 우선순위가 낮은 후보입니다.', tone: 'neutral', icon: MinusCircle, order: 3 },
}
export const QUADRANTS = keysByOrder(QUADRANT_META)

/* 선정 결과 상태 */
export const SELECTION_STATUS_META: MetaMap<SelectionResultStatus> = {
  draft: { label: '선정 초안', description: '자동 추천을 반영한 초안입니다.', tone: 'warning', icon: FlaskConical, order: 0 },
  reviewed: { label: '내부 검토', description: '담당자 검토를 마쳤습니다.', tone: 'info', icon: ClipboardCheck, order: 1 },
  finalized: { label: '과제선정 확정', description: '핵심 과제가 확정되었습니다.', tone: 'success', icon: CheckCircle2, order: 2 },
  superseded: { label: '이전 버전', description: '새 버전으로 대체된 이전 선정입니다.', tone: 'neutral', icon: MinusCircle, order: 3 },
}
export const SELECTION_STATUSES = keysByOrder(SELECTION_STATUS_META)

/* 선정 근거 */
export const SELECTION_REASON_META: Record<CandidateSelectionReason, { label: string }> = {
  high_impact: { label: '운영 영향이 큼' },
  quick_win: { label: '빠른 실행 가능' },
  strategic_value: { label: '전략적 가치' },
  data_ready: { label: '데이터 준비도가 높음' },
  field_demand: { label: '현장 요구가 명확' },
  funding_value: { label: '자금조달 설명력이 높음' },
  prerequisite: { label: '핵심 업무의 선행과제' },
  manual_decision: { label: '담당자 판단' },
  other: { label: '기타' },
}
export const SELECTION_REASONS = Object.keys(SELECTION_REASON_META) as CandidateSelectionReason[]

/* 추천 MVP 템플릿 */
export const MVP_TEMPLATE_META: Record<RecommendedMvpTemplate, { label: string; description: string }> = {
  diagnosis_decision: { label: '진단·판정형', description: '입력을 기준으로 판정·분류·추천을 제공합니다.' },
  document_report: { label: '문서·보고서형', description: '보고서·문서 초안을 자동 생성합니다.' },
  schedule_progress: { label: '일정·진행관리형', description: '일정·배정·진행상태를 관리합니다.' },
  quotation_cost_profit: { label: '견적·원가·마진형', description: '견적·원가·마진을 계산합니다.' },
  inventory_asset_field: { label: '재고·자산·현장형', description: '재고·자산·현장 기록을 관리합니다.' },
  customer_sales: { label: '고객·영업형', description: '고객·영업·상담을 관리합니다.' },
  data_collection_validation: { label: '자료 수집·검수형', description: '자료 수집·검수·누락 확인을 처리합니다.' },
  approval_workflow: { label: '승인 워크플로형', description: '요청·승인·반려·재제출을 관리합니다.' },
}
export const MVP_TEMPLATES = Object.keys(MVP_TEMPLATE_META) as RecommendedMvpTemplate[]
