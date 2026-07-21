/**
 * 로컬 데이터 스냅샷 — localStorage 의 Stage 1~11 도메인 데이터를 읽어
 * 가져오기(마이그레이션) 준비용 스냅샷을 만든다.
 *
 * 원칙:
 *   - 읽기 전용. 이 모듈은 어떤 것도 삭제·변경하지 않는다.
 *   - 가져오기 성공 전에 원본을 지우지 않으며, 성공 후에도 자동 삭제하지 않는다.
 *   - Supabase 도메인 테이블과 1:1 매핑되는 도메인 키를 사용한다.
 */

import { STORAGE_KEYS, SCHEMA_VERSION, readJson, readSchemaVersion } from '../../storage/localStore'

/** 스냅샷의 도메인 키(= Supabase 테이블명) */
export type ImportDomain =
  | 'organizations'
  | 'projects'
  | 'activities'
  | 'questions'
  | 'survey_modules'
  | 'survey_templates'
  | 'survey_blueprints'
  | 'survey_distributions'
  | 'survey_responses'
  | 'assessments'
  | 'analysis_issues'
  | 'interview_questions'
  | 'automation_candidates'
  | 'selection_decisions'
  | 'selection_handoffs'
  | 'mvp_designs'
  | 'mvp_design_handoffs'
  | 'website_designs'
  | 'website_design_handoffs'
  | 'validation_workspaces'
  | 'validation_handoffs'
  | 'validation_test_sessions'
  | 'deliverable_packages'
  | 'deliverable_package_snapshots'
  | 'deliverable_export_records'
  | 'institutions'
  | 'support_programs'
  | 'funding_strategies'
  | 'funding_strategy_snapshots'
  | 'case_studies'

interface WithId {
  id: string
  [key: string]: unknown
}

/** 도메인 키 → localStorage 키 매핑 (STORAGE_KEYS 재사용) */
const DOMAIN_TO_STORAGE: Record<ImportDomain, string> = {
  organizations: STORAGE_KEYS.organizations,
  projects: STORAGE_KEYS.projects,
  activities: STORAGE_KEYS.activities,
  questions: STORAGE_KEYS.questions,
  survey_modules: STORAGE_KEYS.surveyModules,
  survey_templates: STORAGE_KEYS.surveyTemplates,
  survey_blueprints: STORAGE_KEYS.surveyBlueprints,
  survey_distributions: STORAGE_KEYS.surveyDistributions,
  survey_responses: STORAGE_KEYS.surveyResponses,
  assessments: STORAGE_KEYS.assessments,
  analysis_issues: STORAGE_KEYS.analysisIssues,
  interview_questions: STORAGE_KEYS.interviewQuestions,
  automation_candidates: STORAGE_KEYS.automationCandidates,
  selection_decisions: STORAGE_KEYS.selectionDecisions,
  selection_handoffs: STORAGE_KEYS.selectionHandoffs,
  mvp_designs: STORAGE_KEYS.mvpDesigns,
  mvp_design_handoffs: STORAGE_KEYS.mvpDesignHandoffs,
  website_designs: STORAGE_KEYS.websiteDesigns,
  website_design_handoffs: STORAGE_KEYS.websiteDesignHandoffs,
  validation_workspaces: STORAGE_KEYS.validationWorkspaces,
  validation_handoffs: STORAGE_KEYS.validationHandoffs,
  validation_test_sessions: STORAGE_KEYS.validationTestSessions,
  deliverable_packages: STORAGE_KEYS.deliverablePackages,
  deliverable_package_snapshots: STORAGE_KEYS.deliverablePackageSnapshots,
  deliverable_export_records: STORAGE_KEYS.deliverableExportRecords,
  institutions: STORAGE_KEYS.institutions,
  support_programs: STORAGE_KEYS.supportPrograms,
  funding_strategies: STORAGE_KEYS.fundingStrategies,
  funding_strategy_snapshots: STORAGE_KEYS.fundingStrategySnapshots,
  case_studies: STORAGE_KEYS.caseStudies,
}

/** 안전한 가져오기 순서 — 부모(고객사/프로젝트)를 먼저 넣어 FK 를 만족시킨다. */
export const IMPORT_ORDER: ImportDomain[] = [
  'organizations',
  'projects',
  'activities',
  'questions',
  'survey_modules',
  'survey_templates',
  'survey_blueprints',
  'survey_distributions',
  'survey_responses',
  'assessments',
  'analysis_issues',
  'interview_questions',
  'automation_candidates',
  'selection_decisions',
  'selection_handoffs',
  'mvp_designs',
  'mvp_design_handoffs',
  'website_designs',
  'website_design_handoffs',
  'validation_workspaces',
  'validation_handoffs',
  'validation_test_sessions',
  'deliverable_packages',
  'deliverable_package_snapshots',
  'deliverable_export_records',
  'institutions',
  'support_programs',
  'funding_strategies',
  'funding_strategy_snapshots',
  'case_studies',
]

export interface DomainSnapshot {
  domain: ImportDomain
  count: number
  items: WithId[]
}

export interface LocalSnapshot {
  schemaVersion: number
  expectedSchemaVersion: number
  /** 스키마 버전이 기대값과 다르면 가져오기 전에 경고해야 한다 */
  schemaMatches: boolean
  totalItems: number
  domains: DomainSnapshot[]
}

/** 전체 로컬 스냅샷을 만든다(읽기 전용). */
export function buildLocalSnapshot(): LocalSnapshot {
  const domains: DomainSnapshot[] = []
  let totalItems = 0
  for (const domain of IMPORT_ORDER) {
    const items = readJson<WithId[]>(DOMAIN_TO_STORAGE[domain], [])
    const safeItems = Array.isArray(items) ? items.filter((it) => it && typeof it.id === 'string') : []
    domains.push({ domain, count: safeItems.length, items: safeItems })
    totalItems += safeItems.length
  }
  const schemaVersion = readSchemaVersion() ?? 0
  return {
    schemaVersion,
    expectedSchemaVersion: SCHEMA_VERSION,
    schemaMatches: schemaVersion === SCHEMA_VERSION,
    totalItems,
    domains,
  }
}

/** 스냅샷을 사람이 확인할 수 있는 요약(도메인별 건수)으로 변환. */
export function summarizeSnapshot(snapshot: LocalSnapshot): { domain: ImportDomain; count: number }[] {
  return snapshot.domains.filter((d) => d.count > 0).map((d) => ({ domain: d.domain, count: d.count }))
}
