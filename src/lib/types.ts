// AX MVP Factory OS — 도메인 타입·상수 (S1)
// Stage(진행 단계 0~7)와 Level(MVP 수준 0~5)은 서로 다른 축 — 절대 합치지 않는다.

export type Role = 'owner' | 'staff'

export type Profile = {
  id: string
  role: Role
  name: string | null
  email: string | null
}

export type Industry = {
  code: string
  name: string
  parent_code: string | null
  sort: number
  active: boolean
}

export type CompanyStatus = 'active' | 'archived'

export type Company = {
  id: string
  name: string
  industry_code: string | null
  sub_industry: string | null
  employee_band: string | null
  revenue_band: string | null
  region: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  memo: string | null
  status: CompanyStatus
  created_at: string
  updated_at: string
}

export type ProjectStatus = 'active' | 'waiting_customer' | 'hold' | 'dropped' | 'completed'
export type ContractStatus = 'pre' | 'reviewing' | 'contracted' | 'maintenance'

export type Project = {
  id: string
  company_id: string
  name: string
  industry_code: string | null
  current_stage: number // 0~7
  current_level: number // 0~5
  target_level: number // 0~5
  status: ProjectStatus
  contract_status: ContractStatus
  summary: string | null
  created_at: string
  updated_at: string
}

export type StageStatus =
  | 'not_started'
  | 'materials_requested'
  | 'collecting'
  | 'analyzing'
  | 'prototyping'
  | 'customer_review'
  | 'revising'
  | 'testing'
  | 'passed'
  | 'hold'
  | 'stopped'
  | 'completed'

export type ChecklistItem = { label: string; done: boolean }

export type ProjectStage = {
  id: string
  project_id: string
  stage_no: number
  title: string
  purpose: string | null
  status: StageStatus
  started_at: string | null
  target_end_at: string | null
  completed_at: string | null
  owner_name: string | null
  customer_contact: string | null
  required_materials: string | null
  completion_criteria: string | null
  checklist: ChecklistItem[]
  risks: string | null
  hold_reason: string | null
  next_action: string | null
  memo: string | null
  customer_confirmed: boolean
  updated_at: string
}

export type StageLogType = 'note' | 'status_change' | 'stage_advance' | 'customer' | 'risk'

export type StageLog = {
  id: string
  project_id: string
  stage_no: number
  type: StageLogType
  content: string
  created_at: string
}

// ── 라벨·표시 상수 ─────────────────────────────────────────────

export const STAGE_TITLES: readonly string[] = [
  '상담 접수 및 기본 적합성',
  '업종 맞춤 현장 설문·데이터 수집',
  'AX 적합성 진단 및 과제 선정',
  '클릭형 프로토타입 / MVP-lite',
  '정식 계약 및 핵심 MVP 개발',
  '현장 적용·사용자 테스트',
  '성과 측정·기관 제출자료 생성',
  '운영 고도화·유지관리·업셀링',
]

export const LEVEL_LABELS: readonly string[] = [
  'Level 0 · 아이디어·진단',
  'Level 1 · 클릭형 프로토타입',
  'Level 2 · MVP-lite',
  'Level 3 · 실사용 MVP',
  'Level 4 · AX 운영 시스템',
  'Level 5 · 사업화·확장형',
]

export const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  not_started: '시작 전',
  materials_requested: '자료 요청',
  collecting: '자료 수집 중',
  analyzing: '분석 중',
  prototyping: '시제품 제작 중',
  customer_review: '고객 검토 중',
  revising: '수정 중',
  testing: '테스트 중',
  passed: '통과',
  hold: '보류',
  stopped: '중단',
  completed: '완료',
}

// 고객 응답·확인을 기다리는 상태 (대시보드 '고객 응답 대기' 산출 기준)
export const CUSTOMER_WAIT_STATUSES: readonly StageStatus[] = [
  'materials_requested',
  'customer_review',
]

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: '진행 중',
  waiting_customer: '고객 대기',
  hold: '보류',
  dropped: '중단',
  completed: '완료',
}

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  pre: '계약 전',
  reviewing: '전환 검토',
  contracted: '계약 완료',
  maintenance: '유지관리',
}

export const EMPLOYEE_BANDS = ['1~4명', '5~9명', '10~29명', '30~99명', '100명 이상'] as const
export const REVENUE_BANDS = ['5억 미만', '5~20억', '20~50억', '50~100억', '100억 이상'] as const

export function fmtDate(s?: string | null): string {
  if (!s) return '-'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export function isOverdue(stage: Pick<ProjectStage, 'target_end_at' | 'status'>): boolean {
  if (!stage.target_end_at) return false
  if (['passed', 'completed', 'stopped'].includes(stage.status)) return false
  return new Date(stage.target_end_at).getTime() < new Date(new Date().toDateString()).getTime()
}
