import type {
  CandidateRiskDeductionType,
  CandidateScoreDomain,
  PriorityQuadrant,
} from '../../types/selection'

/** 과제선별 규칙 버전 */
export const SELECTION_RULE_VERSION = '1.0.0'

/** 후보 우선순위 점수(100점) 영역별 최대 배점 */
export const CANDIDATE_DOMAIN_MAX: Record<CandidateScoreDomain, number> = {
  operational_impact: 20,
  repetition_value: 15,
  economic_benefit: 15,
  process_suitability: 10,
  data_readiness: 10,
  implementation_feasibility: 10,
  adoption_readiness: 10,
  funding_scalability: 10,
}

/** 위험 감점 유형별 상한 */
export const RISK_DEDUCTION_CAP: Record<CandidateRiskDeductionType, number> = {
  expert_risk: 8,
  privacy_risk: 6,
  unclear_process: 5,
  insufficient_data: 6,
  low_adoption: 6,
  external_dependency: 5,
  integration_complexity: 4,
  excessive_scope: 7,
  no_owner: 6,
  low_measurement: 4,
  custom: 10,
}

/** 자동 위험 감점 총합 상한 */
export const MAX_RISK_DEDUCTION = 25

/** 우선순위 구간 */
export interface PriorityBand {
  min: number
  quadrantHint: PriorityQuadrant
  label: string
}
export const PRIORITY_BANDS: PriorityBand[] = [
  { min: 85, quadrantHint: 'quick_win', label: '핵심 과제 후보' },
  { min: 70, quadrantHint: 'quick_win', label: '우선 검토 후보' },
  { min: 55, quadrantHint: 'strategic_bet', label: '추가 확인 후 판단' },
  { min: 0, quadrantHint: 'defer', label: '후순위 또는 보류' },
]

export function priorityBandLabel(score: number): string {
  for (const band of PRIORITY_BANDS) {
    if (score >= band.min) return band.label
  }
  return '후순위 또는 보류'
}

/**
 * 예상 자동화 비율 규칙 범위 (가정값 · 담당자 수정 가능).
 * key: 업무 성격.
 */
export const AUTOMATION_RATIO_RULES = {
  duplicate_entry: { min: 0.5, max: 0.8, default: 0.65, label: '단순 중복 입력' },
  document_draft: { min: 0.3, max: 0.6, default: 0.45, label: '정형 문서 초안' },
  schedule_status: { min: 0.2, max: 0.5, default: 0.35, label: '일정·상태 관리' },
  expert_involved: { min: 0.1, max: 0.3, default: 0.2, label: '전문가 판단 포함' },
  general: { min: 0.2, max: 0.5, default: 0.35, label: '일반 업무' },
} as const

export type AutomationRatioKey = keyof typeof AUTOMATION_RATIO_RULES

/** 매트릭스 축 계산에 쓰는 영역 그룹 */
export const FEASIBILITY_AXIS_DOMAINS: CandidateScoreDomain[] = [
  'data_readiness',
  'process_suitability',
  'implementation_feasibility',
  'adoption_readiness',
]
export const IMPACT_AXIS_DOMAINS: CandidateScoreDomain[] = [
  'operational_impact',
  'repetition_value',
  'economic_benefit',
  'funding_scalability',
]

/** Stage 7 범위 가드레일 기본값 */
export const DEFAULT_SCOPE_GUARDRAILS: string[] = [
  '핵심 업무 1개',
  '사용자 역할 최대 3개',
  '화면 최대 8개',
  '핵심 입력 폼 최대 3개',
  'AI 기능 최대 2개',
  '보고서 최대 1종',
  '외부 API 최대 1개',
  '관리자 기능 최소',
  '모바일 웹',
  '네이티브 앱 제외',
  'ERP 전체 연동 제외',
  '대규모 데이터 이전 제외',
  '자체 AI 모델 학습 제외',
  '복수 고객사 SaaS화 제외',
  '결제 제외',
  '다국어 제외',
]

/** analysisTag → taskFamily / 업무 성격 별칭 매핑 */
export interface TagRule {
  taskFamily: import('../../types/selection').CandidateTaskFamily
  ratioKey: AutomationRatioKey
  /** 후보명 접미(업무명 힌트) */
  nameHint: string
}

export const TAG_RULES: Record<string, TagRule> = {
  task_inventory: { taskFamily: 'schedule_progress', ratioKey: 'general', nameHint: '업무 처리 관리' },
  duplicate_entry: { taskFamily: 'data_collection', ratioKey: 'duplicate_entry', nameHint: '중복 입력 정리' },
  repeat_docs: { taskFamily: 'document_generation', ratioKey: 'document_draft', nameHint: '반복 문서 작성' },
  draft_generation: { taskFamily: 'document_generation', ratioKey: 'document_draft', nameHint: '보고서·제안서 초안 작성' },
  classification: { taskFamily: 'customer_response', ratioKey: 'document_draft', nameHint: '문의·문서 분류' },
  repeat_response: { taskFamily: 'customer_response', ratioKey: 'document_draft', nameHint: '반복 문의 응대' },
  unstructured_text: { taskFamily: 'document_generation', ratioKey: 'document_draft', nameHint: '자유서술 문서 처리' },
  approval: { taskFamily: 'approval_workflow', ratioKey: 'schedule_status', nameHint: '승인 요청·반려 관리' },
  waiting_time: { taskFamily: 'approval_workflow', ratioKey: 'schedule_status', nameHint: '승인·회신 대기 관리' },
  data_provision: { taskFamily: 'data_collection', ratioKey: 'schedule_status', nameHint: '자료 요청·수집' },
  data_format: { taskFamily: 'data_collection', ratioKey: 'general', nameHint: '업무 데이터 통합관리' },
  improvement_goal: { taskFamily: 'reporting_dashboard', ratioKey: 'schedule_status', nameHint: '개선 지표 관리' },
  measurable_kpi: { taskFamily: 'reporting_dashboard', ratioKey: 'schedule_status', nameHint: '성과 지표 대시보드' },
  error_rate: { taskFamily: 'data_validation', ratioKey: 'general', nameHint: '오류·누락 검수' },
  key_person_risk: { taskFamily: 'schedule_progress', ratioKey: 'general', nameHint: '담당자 의존 업무 표준화' },
  owner_operational: { taskFamily: 'schedule_progress', ratioKey: 'general', nameHint: '대표자 반복 실무 이관' },
  customer_delay: { taskFamily: 'customer_response', ratioKey: 'schedule_status', nameHint: '고객 자료 회신 관리' },
  response_time: { taskFamily: 'customer_response', ratioKey: 'schedule_status', nameHint: '고객 응답 관리' },
  outsourcing_cost: { taskFamily: 'quotation_cost_profit', ratioKey: 'general', nameHint: '외주 비용 절감 업무' },
}
