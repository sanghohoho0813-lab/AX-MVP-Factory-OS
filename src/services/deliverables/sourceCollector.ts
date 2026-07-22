import type { Organization, Project } from '../../types/domain'
import type { AssessmentResult } from '../../types/assessment'
import type { SelectionDecision, SelectionHandoffSnapshot } from '../../types/selection'
import type { MvpDesign, MvpDesignHandoffSnapshot } from '../../types/mvpDesign'
import type { WebsiteDesign, WebsiteDesignHandoffSnapshot } from '../../types/websiteDesign'
import type { ValidationHandoffSnapshot, ValidationWorkspace } from '../../types/validation'
import type { DeliverableSourceReference } from '../../types/deliverables'
import {
  assessmentRepository,
  mvpDesignHandoffRepository,
  mvpDesignRepository,
  organizationRepository,
  projectRepository,
  selectionDecisionRepository,
  selectionHandoffRepository,
  surveyResponseRepository,
  validationHandoffRepository,
  validationWorkspaceRepository,
  websiteDesignHandoffRepository,
  websiteDesignRepository,
} from '../../repositories'
import { DELIVERABLE_ISO } from './contentBlocks'

/** 프로젝트별로 수집한 확정 출처 묶음 */
export interface CollectedSources {
  organization: Organization | null
  project: Project
  submittedResponseIds: string[]
  assessment: AssessmentResult | null
  selectionDecision: SelectionDecision | null
  selectionHandoff: SelectionHandoffSnapshot | null
  mvpDesign: MvpDesign | null
  mvpHandoff: MvpDesignHandoffSnapshot | null
  websiteDesign: WebsiteDesign | null
  websiteHandoff: WebsiteDesignHandoffSnapshot | null
  axValidation: ValidationWorkspace | null
  axValidationHandoff: ValidationHandoffSnapshot | null
  websiteValidation: ValidationWorkspace | null
  websiteValidationHandoff: ValidationHandoffSnapshot | null
  references: DeliverableSourceReference[]
}

function finalizedMvp(projectId: string): { design: MvpDesign; handoff: MvpDesignHandoffSnapshot | null } | null {
  const design = mvpDesignRepository.getByProjectId(projectId).find((d) => d.status === 'finalized')
  if (!design) return null
  return { design, handoff: mvpDesignHandoffRepository.getByDesignId(design.id) }
}
function finalizedWebsite(projectId: string): { design: WebsiteDesign; handoff: WebsiteDesignHandoffSnapshot | null } | null {
  const design = websiteDesignRepository.getByProjectId(projectId).find((d) => d.status === 'finalized')
  if (!design) return null
  return { design, handoff: websiteDesignHandoffRepository.getByDesignId(design.id) }
}
function finalizedValidation(projectId: string, track: 'ax_mvp' | 'website') {
  const w = validationWorkspaceRepository.getByProjectAndTrack(projectId, track).find((x) => x.status === 'finalized')
  if (!w) return { workspace: null, handoff: null }
  return { workspace: w, handoff: validationHandoffRepository.getByWorkspaceId(w.id) }
}

let refSeq = 0
function ref(
  sourceType: DeliverableSourceReference['sourceType'],
  sourceId: string,
  sourceVersion: number,
  label: string,
  track: DeliverableSourceReference['track'],
  available: boolean,
  snapshotHash = '',
  notes = '',
): DeliverableSourceReference {
  refSeq += 1
  return {
    id: `src-${refSeq}`,
    sourceType,
    sourceId,
    sourceVersion,
    label,
    capturedAt: DELIVERABLE_ISO,
    snapshotHash,
    track,
    available,
    stale: false,
    notes,
  }
}

/** 프로젝트의 모든 확정 출처를 수집한다. 확정 스냅샷을 우선 사용한다. */
export function collectSources(projectId: string): CollectedSources | null {
  const project = projectRepository.getById(projectId)
  if (!project) return null
  refSeq = 0
  const organization = organizationRepository.getById(project.organizationId)
  const submitted = surveyResponseRepository.search({ projectId, status: 'submitted' })
  const assessmentLatest = assessmentRepository.getLatestByProjectId(projectId)
  const assessment = assessmentLatest && assessmentLatest.status === 'finalized' ? assessmentLatest : null
  const decisionLatest = selectionDecisionRepository.getLatestByProjectId(projectId)
  const selectionDecision = decisionLatest && decisionLatest.status === 'finalized' ? decisionLatest : null
  const selectionHandoff = selectionDecision ? selectionHandoffRepository.getBySelectionDecisionId(selectionDecision.id) : null

  const isAxTrack = project.projectType === 'ax' || project.projectType === 'ax_website'
  const isWebsiteTrack = project.projectType === 'website' || project.projectType === 'ax_website'

  const mvp = isAxTrack ? finalizedMvp(projectId) : null
  const web = isWebsiteTrack ? finalizedWebsite(projectId) : null
  const axVal = isAxTrack ? finalizedValidation(projectId, 'ax_mvp') : { workspace: null, handoff: null }
  const webVal = isWebsiteTrack ? finalizedValidation(projectId, 'website') : { workspace: null, handoff: null }

  const references: DeliverableSourceReference[] = [
    ref('organization', organization?.id ?? '', 0, `고객사 · ${organization?.name ?? '미상'}`, 'overview', organization !== null),
    ref('project', project.id, 0, `프로젝트 · ${project.name}`, 'overview', true),
    ref('survey_response', projectId, submitted.length, `제출 설문 응답 ${submitted.length}건`, 'overview', submitted.length > 0),
    ref('assessment', assessment?.id ?? '', assessment?.version ?? 0, assessment ? `진단 결과 v${assessment.version}` : '진단 결과 (미확정)', 'overview', assessment !== null, assessment?.sourceSnapshotHash ?? ''),
  ]

  if (isAxTrack) {
    references.push(
      ref('selection_decision', selectionDecision?.id ?? '', selectionDecision?.version ?? 0, selectionDecision ? `과제선정 v${selectionDecision.version}` : '과제선정 (미확정)', 'ax', selectionDecision !== null),
      ref('selection_handoff', selectionHandoff?.id ?? '', selectionHandoff?.selectionVersion ?? 0, selectionHandoff ? '과제선정 인계 스냅샷' : '과제선정 인계 (없음)', 'ax', selectionHandoff !== null),
      ref('mvp_design', mvp?.design.id ?? '', mvp?.design.version ?? 0, mvp ? `AX MVP 설계 v${mvp.design.version}` : 'AX MVP 설계 (미확정)', 'ax', mvp !== null),
      ref('mvp_design_handoff', mvp?.handoff?.id ?? '', mvp?.design.version ?? 0, mvp?.handoff ? 'AX MVP 설계 인계 스냅샷' : 'AX MVP 설계 인계 (없음)', 'ax', Boolean(mvp?.handoff)),
      ref('validation_workspace', axVal.workspace?.id ?? '', axVal.workspace?.version ?? 0, axVal.workspace ? `AX 실제 사용 테스트 v${axVal.workspace.version}` : 'AX 실제 사용 테스트 (없음)', 'validation', axVal.workspace !== null),
      ref('validation_handoff', axVal.handoff?.id ?? '', axVal.handoff?.version ?? 0, axVal.handoff ? 'AX 검증 인계 스냅샷' : 'AX 검증 인계 (없음)', 'validation', axVal.handoff !== null),
    )
  }
  if (isWebsiteTrack) {
    references.push(
      ref('website_design', web?.design.id ?? '', web?.design.version ?? 0, web ? `홈페이지 설계 v${web.design.version}` : '홈페이지 설계 (미확정)', 'website', web !== null),
      ref('website_design_handoff', web?.handoff?.id ?? '', web?.design.version ?? 0, web?.handoff ? '홈페이지 설계 인계 스냅샷' : '홈페이지 설계 인계 (없음)', 'website', Boolean(web?.handoff)),
      ref('validation_workspace', webVal.workspace?.id ?? '', webVal.workspace?.version ?? 0, webVal.workspace ? `홈페이지 테스트 v${webVal.workspace.version}` : '홈페이지 테스트 (없음)', 'validation', webVal.workspace !== null),
      ref('validation_handoff', webVal.handoff?.id ?? '', webVal.handoff?.version ?? 0, webVal.handoff ? '홈페이지 검증 인계 스냅샷' : '홈페이지 검증 인계 (없음)', 'validation', webVal.handoff !== null),
    )
  }

  return {
    organization,
    project,
    submittedResponseIds: submitted.map((r) => r.id),
    assessment,
    selectionDecision,
    selectionHandoff,
    mvpDesign: mvp?.design ?? null,
    mvpHandoff: mvp?.handoff ?? null,
    websiteDesign: web?.design ?? null,
    websiteHandoff: web?.handoff ?? null,
    axValidation: axVal.workspace,
    axValidationHandoff: axVal.handoff,
    websiteValidation: webVal.workspace,
    websiteValidationHandoff: webVal.handoff,
    references,
  }
}

/** 확정 출처 버전을 결합해 패키지 스냅샷 해시를 만든다 (원본 변경 감지용) */
export function computeSourceHash(sources: CollectedSources): string {
  return sources.references
    .filter((r) => r.available)
    .map((r) => `${r.sourceType}:${r.sourceVersion}`)
    .join('|')
}

/** 트랙별 사용 가능 여부 */
export interface DeliverableEligibility {
  canCreate: boolean
  hasAx: boolean
  hasWebsite: boolean
  hasValidation: boolean
  hasDiagnosis: boolean
  hasSelection: boolean
  reasons: string[]
}

export function evaluateEligibility(sources: CollectedSources): DeliverableEligibility {
  const hasAx = sources.mvpHandoff !== null || sources.mvpDesign !== null
  const hasWebsite = sources.websiteHandoff !== null || sources.websiteDesign !== null
  const hasValidation = sources.axValidationHandoff !== null || sources.websiteValidationHandoff !== null
  const hasDiagnosis = sources.assessment !== null
  const hasSelection = sources.selectionDecision !== null
  const reasons: string[] = []
  if (!hasDiagnosis) reasons.push('확정된 진단 결과가 없습니다. 진단을 먼저 확정하면 더 완성도 높은 자료를 만들 수 있습니다.')
  if (!hasAx && !hasWebsite) reasons.push('확정된 AX MVP 설계 또는 홈페이지 설계가 필요합니다.')
  // 최소한 하나의 확정 설계 또는 진단이 있으면 자료 생성 가능
  const canCreate = hasAx || hasWebsite || hasDiagnosis
  return { canCreate, hasAx, hasWebsite, hasValidation, hasDiagnosis, hasSelection, reasons }
}
