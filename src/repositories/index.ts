import {
  LocalActivityRepository,
  LocalOrganizationRepository,
  LocalProjectRepository,
} from './localRepositories'
import {
  LocalProjectSurveyBlueprintRepository,
  LocalQuestionRepository,
  LocalSurveyModuleRepository,
  LocalSurveyTemplateRepository,
} from './surveyRepositories'
import { runMigrations } from './migrations'
import type {
  ActivityRepository,
  OrganizationRepository,
  ProjectRepository,
  ProjectSurveyBlueprintRepository,
  QuestionRepository,
  SurveyModuleRepository,
  SurveyTemplateRepository,
} from './types'

runMigrations()

/**
 * 앱 전역 저장소 싱글턴.
 * 향후 Supabase 연결 시 이 파일에서 구현체만 교체한다.
 */
export const organizationRepository: OrganizationRepository =
  new LocalOrganizationRepository()

export const projectRepository: ProjectRepository = new LocalProjectRepository()

export const activityRepository: ActivityRepository = new LocalActivityRepository()

export const questionRepository: QuestionRepository =
  new LocalQuestionRepository()

export const surveyModuleRepository: SurveyModuleRepository =
  new LocalSurveyModuleRepository()

export const surveyTemplateRepository: SurveyTemplateRepository =
  new LocalSurveyTemplateRepository()

export const projectSurveyBlueprintRepository: ProjectSurveyBlueprintRepository =
  new LocalProjectSurveyBlueprintRepository()

export { EntityNotFoundError, DuplicateCodeError } from './types'
