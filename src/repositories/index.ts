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
import {
  LocalSurveyDistributionRepository,
  LocalSurveyResponseRepository,
} from './runtimeRepositories'
import {
  LocalAnalysisIssueRepository,
  LocalAssessmentRepository,
  LocalInterviewQuestionRepository,
} from './assessmentRepositories'
import {
  LocalAutomationCandidateRepository,
  LocalSelectionDecisionRepository,
  LocalSelectionHandoffRepository,
} from './selectionRepositories'
import {
  LocalMvpDesignHandoffRepository,
  LocalMvpDesignRepository,
} from './mvpDesignRepositories'
import {
  LocalWebsiteDesignHandoffRepository,
  LocalWebsiteDesignRepository,
} from './websiteDesignRepositories'
import {
  LocalValidationHandoffRepository,
  LocalValidationTestSessionRepository,
  LocalValidationWorkspaceRepository,
} from './validationRepositories'
import {
  LocalDeliverableExportRepository,
  LocalDeliverablePackageRepository,
  LocalDeliverablePackageSnapshotRepository,
} from './deliverableRepositories'
import {
  LocalCaseStudyRepository,
  LocalFundingStrategyRepository,
  LocalFundingStrategySnapshotRepository,
  LocalInstitutionRepository,
  LocalSupportProgramRepository,
} from './fundingRepositories'
import { runMigrations } from './migrations'
import type {
  ActivityRepository,
  AnalysisIssueRepository,
  AssessmentRepository,
  AutomationCandidateRepository,
  InterviewQuestionRepository,
  MvpDesignHandoffRepository,
  MvpDesignRepository,
  WebsiteDesignHandoffRepository,
  WebsiteDesignRepository,
  OrganizationRepository,
  ProjectRepository,
  ProjectSurveyBlueprintRepository,
  QuestionRepository,
  SelectionDecisionRepository,
  SelectionHandoffRepository,
  SurveyDistributionRepository,
  SurveyModuleRepository,
  SurveyResponseRepository,
  SurveyTemplateRepository,
  ValidationHandoffRepository,
  ValidationTestSessionRepository,
  ValidationWorkspaceRepository,
  DeliverablePackageRepository,
  DeliverablePackageSnapshotRepository,
  DeliverableExportRepository,
  InstitutionRepository,
  SupportProgramRepository,
  FundingStrategyRepository,
  FundingStrategySnapshotRepository,
  CaseStudyRepository,
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

export const surveyDistributionRepository: SurveyDistributionRepository =
  new LocalSurveyDistributionRepository()

export const surveyResponseRepository: SurveyResponseRepository =
  new LocalSurveyResponseRepository()

export const assessmentRepository: AssessmentRepository =
  new LocalAssessmentRepository()

export const analysisIssueRepository: AnalysisIssueRepository =
  new LocalAnalysisIssueRepository()

export const interviewQuestionRepository: InterviewQuestionRepository =
  new LocalInterviewQuestionRepository()

export const automationCandidateRepository: AutomationCandidateRepository =
  new LocalAutomationCandidateRepository()

export const selectionDecisionRepository: SelectionDecisionRepository =
  new LocalSelectionDecisionRepository()

export const selectionHandoffRepository: SelectionHandoffRepository =
  new LocalSelectionHandoffRepository()

export const mvpDesignRepository: MvpDesignRepository =
  new LocalMvpDesignRepository()

export const mvpDesignHandoffRepository: MvpDesignHandoffRepository =
  new LocalMvpDesignHandoffRepository()

export const websiteDesignRepository: WebsiteDesignRepository =
  new LocalWebsiteDesignRepository()

export const websiteDesignHandoffRepository: WebsiteDesignHandoffRepository =
  new LocalWebsiteDesignHandoffRepository()

export const validationWorkspaceRepository: ValidationWorkspaceRepository =
  new LocalValidationWorkspaceRepository()

export const validationHandoffRepository: ValidationHandoffRepository =
  new LocalValidationHandoffRepository()

export const validationTestSessionRepository: ValidationTestSessionRepository =
  new LocalValidationTestSessionRepository()

export const deliverablePackageRepository: DeliverablePackageRepository =
  new LocalDeliverablePackageRepository()

export const deliverablePackageSnapshotRepository: DeliverablePackageSnapshotRepository =
  new LocalDeliverablePackageSnapshotRepository()

export const deliverableExportRepository: DeliverableExportRepository =
  new LocalDeliverableExportRepository()

export const institutionRepository: InstitutionRepository =
  new LocalInstitutionRepository()

export const supportProgramRepository: SupportProgramRepository =
  new LocalSupportProgramRepository()

export const fundingStrategyRepository: FundingStrategyRepository =
  new LocalFundingStrategyRepository()

export const fundingStrategySnapshotRepository: FundingStrategySnapshotRepository =
  new LocalFundingStrategySnapshotRepository()

export const caseStudyRepository: CaseStudyRepository =
  new LocalCaseStudyRepository()

export { guidedDemoRepository } from './guidedDemoRepository'

export { EntityNotFoundError, DuplicateCodeError } from './types'
