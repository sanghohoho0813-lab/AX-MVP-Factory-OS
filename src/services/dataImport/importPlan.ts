/**
 * 가져오기 계획 — 로컬 스냅샷을 Supabase 업서트 연산 목록으로 변환한다.
 *
 * 원칙:
 *   - 멱등: 같은 계획을 다시 실행해도 중복이 생기지 않도록 id 기준 upsert.
 *   - 토큰 보안: 설문/테스트 세션의 원문 accessToken 은 DB 로 보내지 않는다.
 *     대신 access_token_hash(sha256) 컬럼으로 승격하고 payload 에서 원문을 제거한다.
 *   - 관계 컬럼 승격: workspace_id + 도메인별 관계/상태 컬럼을 별도로 채운다.
 *   - 이 모듈은 계획만 만든다(실행/삭제 없음). 원본 localStorage 는 건드리지 않는다.
 */

import type { DomainRow } from '../../repositories/async/mappers'
import { sha256Hex } from '../../repositories/async/publicTokenClient'
import type { ImportDomain, LocalSnapshot } from './localSnapshot'

interface WithId {
  id: string
  [key: string]: unknown
}

type Promoter = (entity: WithId) => Record<string, unknown>

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}
function int(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** 도메인별 관계·상태 컬럼 승격 규칙 (camelCase 엔티티 → 스네이크 컬럼) */
const PROMOTERS: Partial<Record<ImportDomain, Promoter>> = {
  organizations: (e) => ({ code: str(e.code), status: str(e.status) ?? 'active' }),
  projects: (e) => ({ organization_id: str(e.organizationId), project_code: str(e.projectCode), status: str(e.status) ?? 'active' }),
  activities: (e) => ({ organization_id: str(e.organizationId), project_id: str(e.projectId) }),
  questions: (e) => ({ code: str(e.code), active: e.active !== false, status: str(e.status) ?? 'active' }),
  survey_modules: (e) => ({ status: str(e.status) ?? 'active' }),
  survey_templates: (e) => ({ status: str(e.status) ?? 'draft', version: int(e.version) ?? 1 }),
  survey_blueprints: (e) => ({ project_id: str(e.projectId), status: str(e.status) ?? 'draft' }),
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
  deliverable_packages: (e) => ({ project_id: str(e.projectId), version: int(e.version) ?? 1, status: str(e.status) ?? 'draft' }),
  deliverable_package_snapshots: (e) => ({ project_id: str(e.projectId), package_id: str(e.packageId) }),
  deliverable_export_records: (e) => ({ package_id: str(e.packageId) }),
  institutions: (e) => ({ status: str(e.status) ?? 'active' }),
  support_programs: (e) => ({ institution_id: str(e.institutionId), status: str(e.status) ?? 'active' }),
  funding_strategies: (e) => ({ project_id: str(e.projectId), version: int(e.version) ?? 1, status: str(e.status) ?? 'draft' }),
  funding_strategy_snapshots: (e) => ({ project_id: str(e.projectId), strategy_id: str(e.strategyId) }),
  case_studies: (e) => ({ project_id: str(e.projectId), status: str(e.status) ?? 'draft' }),
}

/** 원문 토큰을 해시로 승격하고 payload 에서 제거해야 하는 도메인 */
const TOKEN_DOMAINS: Partial<Record<ImportDomain, string>> = {
  survey_distributions: 'project_id',
  validation_test_sessions: 'validation_workspace_id',
}

export interface DomainImportPlan {
  domain: ImportDomain
  rows: DomainRow[]
}

export interface ImportPlan {
  workspaceId: string
  totalRows: number
  domains: DomainImportPlan[]
}

/**
 * 스냅샷 + workspaceId 로 멱등 업서트 계획을 만든다.
 * 토큰 도메인은 accessToken 을 해시로 바꾸고 원문을 payload 에서 제거한다.
 */
export async function buildImportPlan(snapshot: LocalSnapshot, workspaceId: string): Promise<ImportPlan> {
  const domains: DomainImportPlan[] = []
  let totalRows = 0

  for (const snap of snapshot.domains) {
    if (snap.count === 0) continue
    const promote = PROMOTERS[snap.domain]
    const rows: DomainRow[] = []

    for (const rawEntity of snap.items) {
      const entity = { ...rawEntity } as WithId
      const promoted: Record<string, unknown> = promote ? promote(entity) : {}

      // 토큰 도메인: 원문 토큰 → 해시 승격 + payload 에서 제거
      if (snap.domain in TOKEN_DOMAINS) {
        const token = str(entity.accessToken)
        if (token) {
          promoted.access_token_hash = await sha256Hex(token)
        }
        delete entity.accessToken
        if (snap.domain === 'survey_distributions') {
          promoted.project_id = str(entity.projectId)
          promoted.status = str(entity.status) ?? 'issued'
        } else {
          promoted.validation_workspace_id = str(entity.workspaceId)
          promoted.status = str(entity.status) ?? 'active'
        }
      }

      rows.push({
        id: entity.id,
        workspace_id: workspaceId,
        payload: entity as Record<string, unknown>,
        ...promoted,
      })
    }

    domains.push({ domain: snap.domain, rows })
    totalRows += rows.length
  }

  return { workspaceId, totalRows, domains }
}
