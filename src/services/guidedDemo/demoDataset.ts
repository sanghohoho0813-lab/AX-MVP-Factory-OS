import type { RespondentRole } from '../../types'
import type { SurveyAnswerValue } from '../../types/surveyRuntime'

/** 시연(가이드 데모) 고정 식별자 */
export const DEMO_PROJECT_ID = 'proj-101'
export const DEMO_ORG_ID = 'org-001'
export const DEMO_TOKEN_PREFIX = 'guided-demo-'
export const DEMO_SURVEY_TITLE = '대한정밀 생산계획 AX 진단'

export interface DemoRespondent {
  role: RespondentRole
  name: string
  position: string
  answers: { code: string; value: SurveyAnswerValue }[]
}

/**
 * 대한정밀 생산계획 AX MVP 시연용 응답.
 * 실제 진단·선별·설계 규칙 엔진이 의미 있는 결과를 내도록 구성한 값이며,
 * 확정된 데모 시나리오이므로 임의로 변경하지 않는다.
 */
export const DEMO_RESPONDENTS: DemoRespondent[] = [
  {
    role: 'owner',
    name: '정대표',
    position: '대표이사',
    answers: [
      { code: 'COM-CO-004', value: '숙련 인력 의존도가 높아 담당자 부재 시 생산계획이 지연됩니다.' },
      { code: 'COM-CO-005', value: '생산계획 수립을 자동 배정으로 전환하고 싶습니다.' },
      { code: 'COM-WA-007', value: 2000000 },
      { code: 'COM-WA-009', value: 'yes' },
      { code: 'COM-AD-001', value: '5' },
      { code: 'COM-AD-006', value: '4' },
      { code: 'COM-AD-008', value: 'yes' },
      { code: 'COM-KPI-001', value: 60 },
      { code: 'COM-KPI-004', value: '생산계획 시간을 3시간에서 30분으로 단축' },
    ],
  },
  {
    role: 'worker',
    name: '김현장',
    position: '생산반장',
    answers: [
      {
        code: 'COM-WF-001',
        value: [
          { 'col-0': '생산계획 수립', 'col-1': '김현장', 'col-2': '180', 'col-3': '12' },
          { 'col-0': '자재 입고 기록', 'col-1': '박현장', 'col-2': '220', 'col-3': '8' },
          { 'col-0': '출고 검수', 'col-1': '이현장', 'col-2': '160', 'col-3': '10' },
        ],
      },
      { code: 'COM-WF-003', value: '발주 접수 → 재고 확인 → 작업지시 → 생산 → 검수 → 출고' },
      { code: 'COM-WF-006', value: 'daily' },
      { code: 'COM-WA-001', value: 'yes' },
      { code: 'COM-WA-002', value: 'yes' },
      { code: 'COM-WA-004', value: '4' },
      { code: 'COM-DATA-001', value: ['excel', 'erp'] },
      { code: 'COM-DATA-003', value: 'server' },
      { code: 'COM-DATA-007', value: 'yes' },
      { code: 'COM-AD-002', value: '4' },
      { code: 'COM-AD-003', value: 'yes' },
      { code: 'COM-AD-004', value: 'ready' },
      { code: 'COM-AD-005', value: 'yes' },
      { code: 'COM-KPI-001', value: 200 },
      { code: 'COM-KPI-002', value: 15 },
      { code: 'COM-KPI-005', value: ['time', 'error', 'volume'] },
      { code: 'COM-AI-003', value: 'yes' },
    ],
  },
]
