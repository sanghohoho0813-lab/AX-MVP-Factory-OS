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
  constructor(entity: '고객사' | '프로젝트' | '질문' | '모듈' | '템플릿' | '설문 초안') {
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
