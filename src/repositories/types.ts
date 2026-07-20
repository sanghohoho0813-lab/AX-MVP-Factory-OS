import type {
  ActivityLog,
  Organization,
  OrganizationFilters,
  OrganizationInput,
  Project,
  ProjectFilters,
  ProjectInput,
} from '../types/domain'
import type {
  ModuleFilters,
  ProjectSurveyBlueprint,
  ProjectSurveyBlueprintInput,
  Question,
  QuestionFilters,
  QuestionInput,
  SurveyModule,
  SurveyModuleInput,
  SurveyTemplate,
  SurveyTemplateInput,
  TemplateFilters,
} from '../types/survey'
import type {
  DistributionFilters,
  ResponseFilters,
  SurveyDistribution,
  SurveyDistributionInput,
  SurveyResponse,
  SurveyResponseInput,
} from '../types/surveyRuntime'
import type {
  AnalysisIssue,
  AnalysisIssueInput,
  AssessmentFilters,
  AssessmentResult,
  AssessmentResultInput,
  InterviewQuestion,
  InterviewQuestionInput,
} from '../types/assessment'
import type {
  AutomationCandidate,
  AutomationCandidateInput,
  CandidateFilters,
  SelectionDecision,
  SelectionDecisionInput,
  SelectionFilters,
  SelectionHandoffInput,
  SelectionHandoffSnapshot,
} from '../types/selection'
import type {
  MvpDesign,
  MvpDesignFilters,
  MvpDesignHandoffInput,
  MvpDesignHandoffSnapshot,
  MvpDesignInput,
} from '../types/mvpDesign'
import type {
  WebsiteDesign,
  WebsiteDesignFilters,
  WebsiteDesignHandoffInput,
  WebsiteDesignHandoffSnapshot,
  WebsiteDesignInput,
} from '../types/websiteDesign'
import type {
  ValidationFilters,
  ValidationHandoffInput,
  ValidationHandoffSnapshot,
  ValidationTestSession,
  ValidationTestSessionInput,
  ValidationWorkspace,
  ValidationWorkspaceInput,
} from '../types/validation'
import type {
  DeliverableExportRecord,
  DeliverableExportRecordInput,
  DeliverableFilters,
  DeliverablePackage,
  DeliverablePackageInput,
  DeliverablePackageSnapshot,
  DeliverablePackageSnapshotInput,
} from '../types/deliverables'

/**
 * 저장소 계층 인터페이스.
 * 현재는 localStorage 구현을 사용하며, 향후 Supabase Repository로 교체한다.
 * UI는 이 인터페이스(또는 서비스 계층)만 사용해야 한다.
 */

export interface OrganizationRepository {
  getAll(includeArchived?: boolean): Organization[]
  getById(id: string): Organization | null
  create(input: OrganizationInput): Organization
  update(id: string, input: Partial<OrganizationInput>): Organization
  archive(id: string): Organization
  search(filters: OrganizationFilters): Organization[]
}

export interface ProjectRepository {
  getAll(includeArchived?: boolean): Project[]
  getById(id: string): Project | null
  getByOrganizationId(organizationId: string, includeArchived?: boolean): Project[]
  create(input: ProjectInput): Project
  update(id: string, input: Partial<ProjectInput>): Project
  archive(id: string): Project
  search(filters: ProjectFilters): Project[]
}

export interface ActivityRepository {
  getByOrganizationId(organizationId: string, limit?: number): ActivityLog[]
  getByProjectId(projectId: string, limit?: number): ActivityLog[]
  add(activity: Omit<ActivityLog, 'id' | 'createdAt'>): ActivityLog
}

export class EntityNotFoundError extends Error {
  constructor(
    entity:
      | '고객사'
      | '프로젝트'
      | '질문'
      | '모듈'
      | '템플릿'
      | '설문 초안'
      | '설문 링크'
      | '설문 응답'
      | '진단 분석'
      | '분석 이슈'
      | '인터뷰 질문'
      | '자동화 후보'
      | '선정 결과'
      | '인계 스냅샷'
      | 'MVP 설계'
      | 'MVP 설계 인계'
      | '홈페이지 설계'
      | '홈페이지 설계 인계'
      | '검증 워크스페이스'
      | '검증 인계'
      | '로컬 테스트 세션'
      | '제출자료 패키지'
      | '제출자료 스냅샷',
  ) {
    super(`${entity}를 찾을 수 없습니다.`)
    this.name = 'EntityNotFoundError'
  }
}

export class DuplicateCodeError extends Error {
  constructor(code: string) {
    super(`이미 사용 중인 질문 코드입니다: ${code}`)
    this.name = 'DuplicateCodeError'
  }
}

export interface QuestionRepository {
  getAll(includeArchived?: boolean): Question[]
  getById(id: string): Question | null
  create(input: QuestionInput): Question
  update(id: string, input: Partial<QuestionInput>): Question
  clone(id: string): Question
  setActive(id: string, active: boolean): Question
  archive(id: string): Question
  search(filters: QuestionFilters): Question[]
  /** 모듈·템플릿·초안에서 이 질문을 참조하는 횟수 */
  getUsageCount(id: string): number
  /** 코드 중복 여부 (excludeId는 자기 자신 제외) */
  isCodeTaken(code: string, excludeId?: string): boolean
}

export interface SurveyModuleRepository {
  getAll(includeArchived?: boolean): SurveyModule[]
  getById(id: string): SurveyModule | null
  create(input: SurveyModuleInput): SurveyModule
  update(id: string, input: Partial<SurveyModuleInput>): SurveyModule
  archive(id: string): SurveyModule
  search(filters: ModuleFilters): SurveyModule[]
}

export interface SurveyTemplateRepository {
  getAll(includeArchived?: boolean): SurveyTemplate[]
  getById(id: string): SurveyTemplate | null
  create(input: SurveyTemplateInput, estimatedMinutes: number): SurveyTemplate
  update(
    id: string,
    input: Partial<SurveyTemplateInput>,
    estimatedMinutes?: number,
  ): SurveyTemplate
  publish(id: string): SurveyTemplate
  cloneAsDraft(id: string): SurveyTemplate
  createNewVersion(id: string): SurveyTemplate
  archive(id: string): SurveyTemplate
  search(filters: TemplateFilters): SurveyTemplate[]
}

export interface ProjectSurveyBlueprintRepository {
  getAll(): ProjectSurveyBlueprint[]
  getById(id: string): ProjectSurveyBlueprint | null
  getByProjectId(projectId: string): ProjectSurveyBlueprint[]
  create(input: ProjectSurveyBlueprintInput): ProjectSurveyBlueprint
  update(
    id: string,
    input: Partial<ProjectSurveyBlueprintInput>,
  ): ProjectSurveyBlueprint
  markReady(id: string): ProjectSurveyBlueprint
}

export interface SurveyDistributionRepository {
  getAll(): SurveyDistribution[]
  getById(id: string): SurveyDistribution | null
  getByToken(accessToken: string): SurveyDistribution | null
  getByProjectId(projectId: string): SurveyDistribution[]
  create(input: SurveyDistributionInput, accessToken: string): SurveyDistribution
  update(
    id: string,
    input: Partial<SurveyDistribution>,
  ): SurveyDistribution
  revoke(id: string): SurveyDistribution
  regenerateToken(id: string, accessToken: string): SurveyDistribution
  markOpened(id: string): SurveyDistribution
  isTokenTaken(token: string): boolean
  search(filters: DistributionFilters): SurveyDistribution[]
}

export interface SurveyResponseRepository {
  getAll(): SurveyResponse[]
  getById(id: string): SurveyResponse | null
  getByDistributionId(distributionId: string): SurveyResponse | null
  create(input: SurveyResponseInput): SurveyResponse
  update(id: string, input: Partial<SurveyResponseInput>): SurveyResponse
  search(filters: ResponseFilters): SurveyResponse[]
}

export interface AssessmentRepository {
  getAll(): AssessmentResult[]
  getById(id: string): AssessmentResult | null
  getByProjectId(projectId: string): AssessmentResult[]
  /** superseded가 아닌 최신 버전(없으면 최신 버전) */
  getLatestByProjectId(projectId: string): AssessmentResult | null
  create(input: AssessmentResultInput): AssessmentResult
  update(id: string, input: Partial<AssessmentResultInput>): AssessmentResult
  markReviewed(id: string, reviewerName: string): AssessmentResult
  finalize(id: string, finalizerName: string): AssessmentResult
  supersede(id: string): AssessmentResult
  /** 프로젝트의 다음 버전 번호 계산 */
  nextVersion(projectId: string): number
  search(filters: AssessmentFilters): AssessmentResult[]
}

export interface AnalysisIssueRepository {
  getAll(): AnalysisIssue[]
  getByProjectId(projectId: string): AnalysisIssue[]
  createMany(items: AnalysisIssueInput[]): AnalysisIssue[]
  update(id: string, input: Partial<AnalysisIssueInput>): AnalysisIssue
  resolve(id: string, resolutionNote: string): AnalysisIssue
  exclude(id: string, reason: string): AnalysisIssue
  /** 자동 생성 이슈만 교체(수동·해결·제외 이슈는 보존) */
  replaceAutoGenerated(projectId: string, items: AnalysisIssueInput[]): AnalysisIssue[]
}

export interface InterviewQuestionRepository {
  getAll(): InterviewQuestion[]
  getByProjectId(projectId: string): InterviewQuestion[]
  create(input: InterviewQuestionInput): InterviewQuestion
  createMany(items: InterviewQuestionInput[]): InterviewQuestion[]
  update(id: string, input: Partial<InterviewQuestionInput>): InterviewQuestion
  select(id: string): InterviewQuestion
  answer(id: string, answer: string): InterviewQuestion
  exclude(id: string): InterviewQuestion
  /** 자동 생성 질문만 교체(수동·선택·답변 질문은 보존) */
  replaceAutoGenerated(
    projectId: string,
    items: InterviewQuestionInput[],
  ): InterviewQuestion[]
}

export interface AutomationCandidateRepository {
  getAll(): AutomationCandidate[]
  getById(id: string): AutomationCandidate | null
  getByProjectId(projectId: string, includeArchived?: boolean): AutomationCandidate[]
  create(input: AutomationCandidateInput): AutomationCandidate
  createMany(inputs: AutomationCandidateInput[]): AutomationCandidate[]
  update(id: string, input: Partial<AutomationCandidateInput>): AutomationCandidate
  archive(id: string): AutomationCandidate
  /** 여러 후보를 하나로 병합하고 원본은 보관 이력으로 남긴다 */
  merge(sourceCandidateIds: string[], target: AutomationCandidate): AutomationCandidate
  /** 자동 후보만 교체(수동·선정 포함·수정된 자동 후보는 보존, generationKey로 ID 유지) */
  replaceAutoGenerated(
    projectId: string,
    assessmentId: string,
    candidates: AutomationCandidateInput[],
  ): AutomationCandidate[]
  search(projectId: string, filters: CandidateFilters): AutomationCandidate[]
}

export interface SelectionDecisionRepository {
  getAll(): SelectionDecision[]
  getById(id: string): SelectionDecision | null
  getByProjectId(projectId: string): SelectionDecision[]
  getLatestByProjectId(projectId: string): SelectionDecision | null
  create(input: SelectionDecisionInput): SelectionDecision
  update(id: string, input: Partial<SelectionDecisionInput>): SelectionDecision
  markReviewed(id: string, reviewerName: string): SelectionDecision
  finalize(id: string, finalizerName: string): SelectionDecision
  supersede(id: string): SelectionDecision
  nextVersion(projectId: string): number
  search(filters: SelectionFilters): SelectionDecision[]
}

export interface SelectionHandoffRepository {
  getAll(): SelectionHandoffSnapshot[]
  getByProjectId(projectId: string): SelectionHandoffSnapshot[]
  getBySelectionDecisionId(selectionDecisionId: string): SelectionHandoffSnapshot | null
  create(snapshot: SelectionHandoffInput): SelectionHandoffSnapshot
  replaceForDecision(
    selectionDecisionId: string,
    snapshot: SelectionHandoffInput,
  ): SelectionHandoffSnapshot
}

export interface MvpDesignRepository {
  getAll(): MvpDesign[]
  getById(id: string): MvpDesign | null
  getByProjectId(projectId: string): MvpDesign[]
  getLatestByProjectId(projectId: string): MvpDesign | null
  create(input: MvpDesignInput): MvpDesign
  update(id: string, input: Partial<MvpDesignInput>): MvpDesign
  markReviewed(id: string, reviewerName: string): MvpDesign
  finalize(id: string, finalizerName: string): MvpDesign
  supersede(id: string): MvpDesign
  nextVersion(projectId: string): number
  search(filters: MvpDesignFilters): MvpDesign[]
}

export interface MvpDesignHandoffRepository {
  getAll(): MvpDesignHandoffSnapshot[]
  getByProjectId(projectId: string): MvpDesignHandoffSnapshot[]
  getByDesignId(mvpDesignId: string): MvpDesignHandoffSnapshot | null
  replaceForDesign(
    mvpDesignId: string,
    snapshot: MvpDesignHandoffInput,
  ): MvpDesignHandoffSnapshot
}

export interface WebsiteDesignRepository {
  getAll(): WebsiteDesign[]
  getById(id: string): WebsiteDesign | null
  getByProjectId(projectId: string): WebsiteDesign[]
  getLatestByProjectId(projectId: string): WebsiteDesign | null
  create(input: WebsiteDesignInput): WebsiteDesign
  update(id: string, input: Partial<WebsiteDesignInput>): WebsiteDesign
  markReviewed(id: string, reviewerName: string): WebsiteDesign
  finalize(id: string, finalizerName: string): WebsiteDesign
  supersede(id: string): WebsiteDesign
  nextVersion(projectId: string): number
  search(filters: WebsiteDesignFilters): WebsiteDesign[]
}

export interface WebsiteDesignHandoffRepository {
  getAll(): WebsiteDesignHandoffSnapshot[]
  getByProjectId(projectId: string): WebsiteDesignHandoffSnapshot[]
  getByDesignId(websiteDesignId: string): WebsiteDesignHandoffSnapshot | null
  create(snapshot: WebsiteDesignHandoffInput): WebsiteDesignHandoffSnapshot
  replaceForDesign(
    websiteDesignId: string,
    snapshot: WebsiteDesignHandoffInput,
  ): WebsiteDesignHandoffSnapshot
}

export interface ValidationWorkspaceRepository {
  getAll(): ValidationWorkspace[]
  getById(id: string): ValidationWorkspace | null
  getByProjectId(projectId: string): ValidationWorkspace[]
  getByProjectAndTrack(projectId: string, trackType: ValidationWorkspace['trackType']): ValidationWorkspace[]
  getLatestByProjectAndTrack(
    projectId: string,
    trackType: ValidationWorkspace['trackType'],
  ): ValidationWorkspace | null
  create(input: ValidationWorkspaceInput): ValidationWorkspace
  update(id: string, input: Partial<ValidationWorkspaceInput>): ValidationWorkspace
  markReady(id: string): ValidationWorkspace
  startTesting(id: string): ValidationWorkspace
  markEvaluating(id: string): ValidationWorkspace
  finalize(id: string, finalizerName: string): ValidationWorkspace
  supersede(id: string): ValidationWorkspace
  nextVersion(projectId: string, trackType: ValidationWorkspace['trackType']): number
  search(filters: ValidationFilters): ValidationWorkspace[]
}

export interface ValidationHandoffRepository {
  getAll(): ValidationHandoffSnapshot[]
  getByWorkspaceId(workspaceId: string): ValidationHandoffSnapshot | null
  getByProjectAndTrack(
    projectId: string,
    trackType: ValidationHandoffSnapshot['trackType'],
  ): ValidationHandoffSnapshot[]
  create(snapshot: ValidationHandoffInput): ValidationHandoffSnapshot
  replaceForWorkspace(
    workspaceId: string,
    snapshot: ValidationHandoffInput,
  ): ValidationHandoffSnapshot
}

export interface ValidationTestSessionRepository {
  getAll(): ValidationTestSession[]
  getByToken(accessToken: string): ValidationTestSession | null
  getByWorkspaceId(workspaceId: string): ValidationTestSession[]
  create(input: ValidationTestSessionInput, accessToken: string): ValidationTestSession
  update(id: string, input: Partial<ValidationTestSession>): ValidationTestSession
  revoke(id: string): ValidationTestSession
  complete(id: string): ValidationTestSession
}

export interface DeliverablePackageRepository {
  getAll(): DeliverablePackage[]
  getById(id: string): DeliverablePackage | null
  getByProjectId(projectId: string): DeliverablePackage[]
  getLatestByProjectId(projectId: string): DeliverablePackage | null
  create(input: DeliverablePackageInput): DeliverablePackage
  update(id: string, input: Partial<DeliverablePackageInput>): DeliverablePackage
  markReviewed(id: string, reviewerName: string): DeliverablePackage
  finalize(id: string, finalizerName: string): DeliverablePackage
  supersede(id: string): DeliverablePackage
  archive(id: string): DeliverablePackage
  nextVersion(projectId: string): number
  search(filters: DeliverableFilters): DeliverablePackage[]
}

export interface DeliverablePackageSnapshotRepository {
  getAll(): DeliverablePackageSnapshot[]
  getByPackageId(packageId: string): DeliverablePackageSnapshot | null
  getByProjectId(projectId: string): DeliverablePackageSnapshot[]
  create(snapshot: DeliverablePackageSnapshotInput): DeliverablePackageSnapshot
  replaceForPackage(
    packageId: string,
    snapshot: DeliverablePackageSnapshotInput,
  ): DeliverablePackageSnapshot
}

export interface DeliverableExportRepository {
  getByPackageId(packageId: string): DeliverableExportRecord[]
  create(record: DeliverableExportRecordInput): DeliverableExportRecord
  deleteByPackageId(packageId: string): void
}
