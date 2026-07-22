/**
 * Repository 번들 — 앱이 사용하는 모든 저장소를 한 객체로 묶는다.
 * 동기 번들(기존 Stage 1~11 로컬 구현)과, 그것을 비동기로 감싼 번들을 함께 정의한다.
 */

import {
  organizationRepository,
  projectRepository,
  activityRepository,
  questionRepository,
  surveyModuleRepository,
  surveyTemplateRepository,
  projectSurveyBlueprintRepository,
  surveyDistributionRepository,
  surveyResponseRepository,
  assessmentRepository,
  analysisIssueRepository,
  interviewQuestionRepository,
  automationCandidateRepository,
  selectionDecisionRepository,
  selectionHandoffRepository,
  mvpDesignRepository,
  mvpDesignHandoffRepository,
  websiteDesignRepository,
  websiteDesignHandoffRepository,
  validationWorkspaceRepository,
  validationHandoffRepository,
  validationTestSessionRepository,
  deliverablePackageRepository,
  deliverablePackageSnapshotRepository,
  deliverableExportRepository,
  institutionRepository,
  supportProgramRepository,
  fundingStrategyRepository,
  fundingStrategySnapshotRepository,
  caseStudyRepository,
} from '../index'
import type {
  ActivityRepository,
  AnalysisIssueRepository,
  AssessmentRepository,
  AutomationCandidateRepository,
  CaseStudyRepository,
  DeliverableExportRepository,
  DeliverablePackageRepository,
  DeliverablePackageSnapshotRepository,
  FundingStrategyRepository,
  FundingStrategySnapshotRepository,
  InstitutionRepository,
  InterviewQuestionRepository,
  MvpDesignHandoffRepository,
  MvpDesignRepository,
  OrganizationRepository,
  ProjectRepository,
  ProjectSurveyBlueprintRepository,
  QuestionRepository,
  SelectionDecisionRepository,
  SelectionHandoffRepository,
  SupportProgramRepository,
  SurveyDistributionRepository,
  SurveyModuleRepository,
  SurveyResponseRepository,
  SurveyTemplateRepository,
  ValidationHandoffRepository,
  ValidationTestSessionRepository,
  ValidationWorkspaceRepository,
  WebsiteDesignHandoffRepository,
  WebsiteDesignRepository,
} from '../types'
import { asyncify, type Asyncify } from './asyncify'

/** 동기 저장소 번들 (기존 로컬 구현) */
export interface SyncRepositoryBundle {
  organizations: OrganizationRepository
  projects: ProjectRepository
  activities: ActivityRepository
  questions: QuestionRepository
  surveyModules: SurveyModuleRepository
  surveyTemplates: SurveyTemplateRepository
  surveyBlueprints: ProjectSurveyBlueprintRepository
  surveyDistributions: SurveyDistributionRepository
  surveyResponses: SurveyResponseRepository
  assessments: AssessmentRepository
  analysisIssues: AnalysisIssueRepository
  interviewQuestions: InterviewQuestionRepository
  automationCandidates: AutomationCandidateRepository
  selectionDecisions: SelectionDecisionRepository
  selectionHandoffs: SelectionHandoffRepository
  mvpDesigns: MvpDesignRepository
  mvpDesignHandoffs: MvpDesignHandoffRepository
  websiteDesigns: WebsiteDesignRepository
  websiteDesignHandoffs: WebsiteDesignHandoffRepository
  validationWorkspaces: ValidationWorkspaceRepository
  validationHandoffs: ValidationHandoffRepository
  validationTestSessions: ValidationTestSessionRepository
  deliverablePackages: DeliverablePackageRepository
  deliverablePackageSnapshots: DeliverablePackageSnapshotRepository
  deliverableExports: DeliverableExportRepository
  institutions: InstitutionRepository
  supportPrograms: SupportProgramRepository
  fundingStrategies: FundingStrategyRepository
  fundingStrategySnapshots: FundingStrategySnapshotRepository
  caseStudies: CaseStudyRepository
}

/** 비동기 저장소 번들 (모든 메서드가 Promise 반환) */
export type AsyncRepositoryBundle = {
  [K in keyof SyncRepositoryBundle]: Asyncify<SyncRepositoryBundle[K]>
}

/** 앱 전역 동기 번들 (기존 싱글턴 재사용) */
export const syncRepositoryBundle: SyncRepositoryBundle = {
  organizations: organizationRepository,
  projects: projectRepository,
  activities: activityRepository,
  questions: questionRepository,
  surveyModules: surveyModuleRepository,
  surveyTemplates: surveyTemplateRepository,
  surveyBlueprints: projectSurveyBlueprintRepository,
  surveyDistributions: surveyDistributionRepository,
  surveyResponses: surveyResponseRepository,
  assessments: assessmentRepository,
  analysisIssues: analysisIssueRepository,
  interviewQuestions: interviewQuestionRepository,
  automationCandidates: automationCandidateRepository,
  selectionDecisions: selectionDecisionRepository,
  selectionHandoffs: selectionHandoffRepository,
  mvpDesigns: mvpDesignRepository,
  mvpDesignHandoffs: mvpDesignHandoffRepository,
  websiteDesigns: websiteDesignRepository,
  websiteDesignHandoffs: websiteDesignHandoffRepository,
  validationWorkspaces: validationWorkspaceRepository,
  validationHandoffs: validationHandoffRepository,
  validationTestSessions: validationTestSessionRepository,
  deliverablePackages: deliverablePackageRepository,
  deliverablePackageSnapshots: deliverablePackageSnapshotRepository,
  deliverableExports: deliverableExportRepository,
  institutions: institutionRepository,
  supportPrograms: supportProgramRepository,
  fundingStrategies: fundingStrategyRepository,
  fundingStrategySnapshots: fundingStrategySnapshotRepository,
  caseStudies: caseStudyRepository,
}

/** 동기 로컬 번들을 비동기 계약으로 감싼 번들을 만든다 */
export function createLocalAsyncBundle(): AsyncRepositoryBundle {
  const entries = Object.entries(syncRepositoryBundle) as [
    keyof SyncRepositoryBundle,
    SyncRepositoryBundle[keyof SyncRepositoryBundle],
  ][]
  const bundle = {} as Record<string, unknown>
  for (const [key, repo] of entries) {
    bundle[key] = asyncify(repo as object)
  }
  return bundle as AsyncRepositoryBundle
}
