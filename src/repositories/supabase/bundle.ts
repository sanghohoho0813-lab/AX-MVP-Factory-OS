/**
 * Supabase 저장소 번들 — 29개 도메인 저장소를 실제 인스턴스로 만들어 반환한다.
 *
 * 각 저장소는 SupabaseDomainRepo(공통 CRUD, 실제 비동기)를 기반으로 하고,
 * 도메인 특화 메서드는 명시적 오류를 던진다(가짜 성공 금지). Repository Factory 가
 * 이 번들을 supabase 모드에서 반환한다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AsyncRepositoryBundle, SyncRepositoryBundle } from '../async/bundle'
import type { PromotedColumns } from '../async/mappers'
import { SupabaseDomainRepo, notImplemented, type DomainRepoConfig, type EntityLike } from './core'

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}
function int(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** 도메인별 승격(관계·상태·버전) 컬럼 규칙 */
const PROMOTERS: Record<string, (e: EntityLike) => PromotedColumns> = {
  organizations: (e) => ({ code: str(e.code), status: str(e.status) ?? 'active' }),
  projects: (e) => ({ organization_id: str(e.organizationId), project_code: str(e.projectCode), status: str(e.status) ?? 'active' }),
  activities: (e) => ({ organization_id: str(e.organizationId), project_id: str(e.projectId) }),
  questions: (e) => ({ code: str(e.code), active: e.active !== false, status: str(e.status) ?? 'active' }),
  survey_modules: (e) => ({ status: str(e.status) ?? 'active' }),
  survey_templates: (e) => ({ status: str(e.status) ?? 'draft', version: int(e.version) ?? 1 }),
  survey_blueprints: (e) => ({ project_id: str(e.projectId), status: str(e.status) ?? 'draft' }),
  survey_distributions: (e) => ({ project_id: str(e.projectId), status: str(e.status) ?? 'issued' }),
  survey_responses: (e) => ({ distribution_id: str(e.distributionId), project_id: str(e.projectId) }),
  assessments: (e) => ({ project_id: str(e.projectId), version: int(e.version) ?? 1, status: str(e.status) ?? 'draft' }),
  analysis_issues: (e) => ({ project_id: str(e.projectId) }),
  interview_questions: (e) => ({ project_id: str(e.projectId) }),
  automation_candidates: (e) => ({ project_id: str(e.projectId), assessment_id: str(e.assessmentId), status: str(e.status) ?? 'active' }),
  selection_decisions: (e) => ({ project_id: str(e.projectId), version: int(e.version) ?? 1, status: str(e.status) ?? 'draft' }),
  selection_handoffs: (e) => ({ project_id: str(e.projectId), selection_decision_id: str(e.selectionDecisionId) }),
  mvp_designs: (e) => ({ project_id: str(e.projectId), version: int(e.version) ?? 1, status: str(e.status) ?? 'draft' }),
  mvp_design_handoffs: (e) => ({ project_id: str(e.projectId), mvp_design_id: str(e.mvpDesignId) }),
  website_designs: (e) => ({ project_id: str(e.projectId), version: int(e.version) ?? 1, status: str(e.status) ?? 'draft' }),
  website_design_handoffs: (e) => ({ project_id: str(e.projectId), website_design_id: str(e.websiteDesignId) }),
  validation_workspaces: (e) => ({ project_id: str(e.projectId), track_type: str(e.trackType), version: int(e.version) ?? 1, status: str(e.status) ?? 'draft' }),
  validation_handoffs: (e) => ({ project_id: str(e.projectId), validation_workspace_id: str(e.workspaceId), track_type: str(e.trackType) }),
  validation_test_sessions: (e) => ({ validation_workspace_id: str(e.workspaceId), status: str(e.status) ?? 'active' }),
  deliverable_packages: (e) => ({ project_id: str(e.projectId), version: int(e.version) ?? 1, status: str(e.status) ?? 'draft' }),
  deliverable_package_snapshots: (e) => ({ project_id: str(e.projectId), package_id: str(e.packageId) }),
  deliverable_export_records: (e) => ({ package_id: str(e.packageId) }),
  institutions: (e) => ({ status: str(e.status) ?? 'active' }),
  support_programs: (e) => ({ institution_id: str(e.institutionId), status: str(e.status) ?? 'active' }),
  funding_strategies: (e) => ({ project_id: str(e.projectId), version: int(e.version) ?? 1, status: str(e.status) ?? 'draft' }),
  funding_strategy_snapshots: (e) => ({ project_id: str(e.projectId), strategy_id: str(e.strategyId) }),
  case_studies: (e) => ({ project_id: str(e.projectId), status: str(e.status) ?? 'draft' }),
}

/**
 * 공통 CRUD 는 실제 구현, 그 외 도메인 특화 메서드는 명시적 오류 thunk 로 노출하는
 * 프록시 저장소를 만든다.
 */
function makeRepo(
  client: SupabaseClient,
  workspaceId: string,
  table: string,
  searchPredicate?: DomainRepoConfig<EntityLike>['searchPredicate'],
): unknown {
  const base = new SupabaseDomainRepo<EntityLike>({
    client,
    workspaceId,
    table,
    promote: PROMOTERS[table],
    searchPredicate,
  })
  const target = base as unknown as Record<string, unknown>
  return new Proxy(target, {
    get(obj, prop: string | symbol) {
      if (typeof prop === 'string') {
        const value = obj[prop]
        if (typeof value === 'function') return (value as (...a: unknown[]) => unknown).bind(base)
        if (prop === 'then') return undefined // 프록시가 thenable 로 오인되지 않게
        return notImplemented(table, prop)
      }
      return undefined
    },
  })
}

/** supabase 저장소 번들 생성 (모든 도메인 실제 인스턴스 반환) */
export function createSupabaseBundle(client: SupabaseClient, workspaceId: string): AsyncRepositoryBundle {
  const r = (table: string, sp?: DomainRepoConfig<EntityLike>['searchPredicate']) =>
    makeRepo(client, workspaceId, table, sp)

  const bundle: Record<keyof SyncRepositoryBundle, unknown> = {
    organizations: r('organizations'),
    projects: r('projects'),
    activities: r('activities'),
    questions: r('questions'),
    surveyModules: r('survey_modules'),
    surveyTemplates: r('survey_templates'),
    surveyBlueprints: r('survey_blueprints'),
    surveyDistributions: r('survey_distributions'),
    surveyResponses: r('survey_responses'),
    assessments: r('assessments'),
    analysisIssues: r('analysis_issues'),
    interviewQuestions: r('interview_questions'),
    automationCandidates: r('automation_candidates'),
    selectionDecisions: r('selection_decisions'),
    selectionHandoffs: r('selection_handoffs'),
    mvpDesigns: r('mvp_designs'),
    mvpDesignHandoffs: r('mvp_design_handoffs'),
    websiteDesigns: r('website_designs'),
    websiteDesignHandoffs: r('website_design_handoffs'),
    validationWorkspaces: r('validation_workspaces'),
    validationHandoffs: r('validation_handoffs'),
    validationTestSessions: r('validation_test_sessions'),
    deliverablePackages: r('deliverable_packages'),
    deliverablePackageSnapshots: r('deliverable_package_snapshots'),
    deliverableExports: r('deliverable_export_records'),
    institutions: r('institutions'),
    supportPrograms: r('support_programs'),
    fundingStrategies: r('funding_strategies'),
    fundingStrategySnapshots: r('funding_strategy_snapshots'),
    caseStudies: r('case_studies'),
  }
  return bundle as unknown as AsyncRepositoryBundle
}
