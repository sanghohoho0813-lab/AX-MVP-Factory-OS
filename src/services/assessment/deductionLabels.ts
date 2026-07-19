import type { AssessmentDeductionType } from '../../types/assessment'

export const DEDUCTION_TYPE_LABEL: Record<AssessmentDeductionType, string> = {
  no_owner: '핵심 담당자 부재',
  no_field_participant: '현장 응답 부재',
  insufficient_data: '데이터 제공 불가',
  inconsistent_process: '업무 규칙 불명확',
  high_privacy_risk: '개인정보·위험 신호',
  expert_judgment_dominant: '전문가 판단 비중',
  no_measurable_kpi: '측정 가능한 KPI 없음',
  low_adoption_will: '도입 의지 부족',
  formal_build_only: '형식적 구축 위험',
  severe_response_conflict: '심각한 응답 충돌',
  custom: '수동 감점',
}
