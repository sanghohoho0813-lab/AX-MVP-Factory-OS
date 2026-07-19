import type { RespondentRole } from './index'

/* ------------------------------------------------------------------ */
/* 질문 (Question)                                                     */
/* ------------------------------------------------------------------ */

export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'yes_no'
  | 'scale_5'
  | 'number'
  | 'currency'
  | 'time'
  | 'date'
  | 'short_text'
  | 'long_text'
  | 'file'
  | 'repeat_table'
  | 'ranking'

export type QuestionCategory =
  | 'company'
  | 'workflow'
  | 'waste'
  | 'data'
  | 'systems'
  | 'ai_fit'
  | 'adoption'
  | 'kpi'
  | 'compliance'
  | 'website'

export type QuestionScope = 'common' | 'industry' | 'objective' | 'custom'

export type ScoringDomain =
  | 'none'
  | 'repetition'
  | 'economic'
  | 'data_readiness'
  | 'process_clarity'
  | 'adoption'
  | 'execution'
  | 'funding_connection'

export type ExpertRiskGrade = 'green' | 'yellow' | 'red'

export type RiskSignalLevel = 'none' | 'info' | 'warning' | 'critical'

export interface QuestionOption {
  id: string
  label: string
  value: string
  /** 향후 진단 계산용 원시 점수 (이번 단계에서는 저장만) */
  score: number
  riskSignal: RiskSignalLevel
  orderIndex: number
}

export type RepeatColumnFieldType =
  | 'short_text'
  | 'number'
  | 'currency'
  | 'time'
  | 'date'
  | 'single_choice'

export interface RepeatTableColumn {
  id: string
  label: string
  fieldType: RepeatColumnFieldType
  required: boolean
  unit: string
  orderIndex: number
}

export interface Question {
  id: string
  /** 중복 불가 코드 (예: COM-WF-001) */
  code: string
  text: string
  helpText: string
  example: string
  type: QuestionType
  category: QuestionCategory
  respondentRole: RespondentRole
  scope: QuestionScope
  /** 관련 업종 키 (scope=industry일 때 1개 이상) */
  industryKeys: string[]
  /** 관련 목적 키 (scope=objective일 때 1개 이상) */
  objectiveKeys: string[]
  requiredDefault: boolean
  scoringDomain: ScoringDomain
  /** 0~5, scoringDomain이 none이면 0 */
  scoringWeight: number
  expertRiskGrade: ExpertRiskGrade
  riskReason: string
  analysisTags: string[]
  options: QuestionOption[]
  repeatTableColumns: RepeatTableColumn[]
  active: boolean
  version: number
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export type QuestionInput = Omit<
  Question,
  'id' | 'version' | 'createdAt' | 'updatedAt' | 'archivedAt'
>

export interface QuestionFilters {
  query?: string
  category?: QuestionCategory
  type?: QuestionType
  respondentRole?: RespondentRole
  scope?: QuestionScope
  scoringDomain?: ScoringDomain
  expertRiskGrade?: ExpertRiskGrade
  /** 'active' | 'inactive' | undefined(전체) */
  activeState?: 'active' | 'inactive'
  /** true면 사용 중인 질문만 */
  inUse?: boolean
  includeArchived?: boolean
}

export type QuestionSortKey = 'updated' | 'code' | 'usage' | 'category'

/* ------------------------------------------------------------------ */
/* 모듈 (SurveyModule)                                                 */
/* ------------------------------------------------------------------ */

export type ModuleKind = 'industry' | 'objective'

export type ModuleStatus = 'draft' | 'active' | 'archived'

export interface SurveyModule {
  id: string
  name: string
  description: string
  kind: ModuleKind
  /** 관련 업종 또는 목적 키 */
  keys: string[]
  recommendedRespondentRoles: RespondentRole[]
  /** 질문 내용은 복제하지 않고 ID만 연결 */
  questionIds: string[]
  status: ModuleStatus
  version: number
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export type SurveyModuleInput = Omit<
  SurveyModule,
  'id' | 'version' | 'createdAt' | 'updatedAt' | 'archivedAt'
>

export interface ModuleFilters {
  query?: string
  kind?: ModuleKind
  status?: ModuleStatus
  respondentRole?: RespondentRole
  includeArchived?: boolean
}

/* ------------------------------------------------------------------ */
/* 조건부 질문                                                          */
/* ------------------------------------------------------------------ */

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'includes'
  | 'greater_than'
  | 'less_than'
  | 'is_answered'
  | 'is_not_answered'

export interface QuestionCondition {
  sourceQuestionId: string
  operator: ConditionOperator
  comparisonValue: string
}

/* ------------------------------------------------------------------ */
/* 설문 템플릿 (SurveyTemplate)                                        */
/* ------------------------------------------------------------------ */

export interface TemplateQuestionPlacement {
  id: string
  questionId: string
  required: boolean
  condition: QuestionCondition | null
  orderIndex: number
}

export interface SurveySection {
  id: string
  title: string
  description: string
  orderIndex: number
  placements: TemplateQuestionPlacement[]
}

export type SurveyTemplateStatus = 'draft' | 'published' | 'archived'

export type SurveyPurpose = 'ax_diagnosis' | 'website_readiness' | 'funding'

export interface SurveyTemplate {
  id: string
  name: string
  description: string
  respondentRole: RespondentRole
  purpose: SurveyPurpose
  sections: SurveySection[]
  status: SurveyTemplateStatus
  version: number
  estimatedMinutes: number
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  archivedAt: string | null
}

export type SurveyTemplateInput = Omit<
  SurveyTemplate,
  'id' | 'version' | 'estimatedMinutes' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'archivedAt'
>

export interface TemplateFilters {
  query?: string
  respondentRole?: RespondentRole
  status?: SurveyTemplateStatus
  purpose?: SurveyPurpose
  includeArchived?: boolean
}

/* ------------------------------------------------------------------ */
/* 프로젝트 설문 초안 (ProjectSurveyBlueprint)                         */
/* ------------------------------------------------------------------ */

export type ProjectSurveyBlueprintStatus = 'draft' | 'ready'

export type QualitySeverity = 'info' | 'warning' | 'error'

export interface SurveyQualityCheck {
  id: string
  type: string
  severity: QualitySeverity
  title: string
  description: string
  passed: boolean
}

/**
 * 스냅샷 질문 — 템플릿·질문 원본이 나중에 바뀌어도
 * 저장된 프로젝트 설문 초안이 흔들리지 않도록 필요한 정보를 복제해 보존한다.
 */
export interface SnapshotPlacement {
  id: string
  questionId: string
  questionCode: string
  questionText: string
  helpText: string
  example: string
  type: QuestionType
  category: QuestionCategory
  scope: QuestionScope
  scoringDomain: ScoringDomain
  expertRiskGrade: ExpertRiskGrade
  options: QuestionOption[]
  repeatTableColumns: RepeatTableColumn[]
  required: boolean
  condition: QuestionCondition | null
  /** 질문 출처 배지: common/industry/objective/custom */
  sourceScope: QuestionScope
  orderIndex: number
}

export interface SnapshotSection {
  id: string
  title: string
  description: string
  orderIndex: number
  placements: SnapshotPlacement[]
}

export interface ProjectSurveyBlueprint {
  id: string
  projectId: string
  templateId: string | null
  respondentRole: RespondentRole
  selectedModuleIds: string[]
  additionalQuestionIds: string[]
  excludedQuestionIds: string[]
  /** 최종 조합된 설문 구조 스냅샷 */
  sections: SnapshotSection[]
  status: ProjectSurveyBlueprintStatus
  qualityChecks: SurveyQualityCheck[]
  estimatedMinutes: number
  createdAt: string
  updatedAt: string
}

export type ProjectSurveyBlueprintInput = Omit<
  ProjectSurveyBlueprint,
  'id' | 'createdAt' | 'updatedAt'
>

/* ------------------------------------------------------------------ */
/* 설문 구성 요약 (composition summary)                                 */
/* ------------------------------------------------------------------ */

export interface SurveyCompositionSummary {
  totalQuestions: number
  conditionalQuestions: number
  estimatedVisibleQuestions: number
  estimatedMinutes: number
  commonRatio: number
  industryRatio: number
  objectiveRatio: number
  customRatio: number
  requiredRatio: number
  scoringCoverage: ScoringDomain[]
  expertRiskCount: number
}
