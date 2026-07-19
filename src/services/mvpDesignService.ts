import type { Organization, Project, MvpLevel } from '../types/domain'
import type {
  FeatureScope,
  MvpDesign,
  MvpFeature,
} from '../types/mvpDesign'
import type { SelectionHandoffSnapshot } from '../types/selection'
import {
  activityRepository,
  mvpDesignHandoffRepository,
  mvpDesignRepository,
  organizationRepository,
  projectRepository,
  selectionDecisionRepository,
  selectionHandoffRepository,
} from '../repositories'
import { CURRENT_USER } from '../data/demo'
import { buildDesignDraft, computeDesignHash } from './mvpDesign/designOrchestrator'
import { evaluateGuardrails } from './mvpDesign/guardrailEngine'
import { runQualityChecks, hasBlockingErrors } from './mvpDesign/qualityEngine'
import { buildDesignHandoffSnapshot } from './mvpDesign/designHandoffBuilder'
import { MVP_DESIGN_RULE_VERSION } from './mvpDesign/scoringConfig'

function nowIso(): string {
  return new Date().toISOString()
}

export class DesignBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DesignBlockedError'
  }
}
export class DesignEditError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DesignEditError'
  }
}

/* ------------------------------------------------------------------ */
/* 자격·라이프사이클                                                    */
/* ------------------------------------------------------------------ */

export type DesignLifecycle =
  | 'website_only'
  | 'not_eligible'
  | 'ready_to_design'
  | 'draft'
  | 'reviewed'
  | 'finalized'
  | 'needs_redesign'

export interface DesignEligibility {
  canDesign: boolean
  reasons: string[]
  websiteRedirect: boolean
  handoff: SelectionHandoffSnapshot | null
}

/** 최신 확정 선정의 인계 스냅샷을 찾는다 */
function findFinalizedHandoff(projectId: string): SelectionHandoffSnapshot | null {
  const decision = selectionDecisionRepository.getLatestByProjectId(projectId)
  if (!decision || decision.status !== 'finalized') return null
  return selectionHandoffRepository.getBySelectionDecisionId(decision.id)
}

export function getDesignEligibility(project: Project): DesignEligibility {
  if (project.projectType === 'website') {
    return { canDesign: false, reasons: ['홈페이지 단독 프로젝트입니다.'], websiteRedirect: true, handoff: null }
  }
  const handoff = findFinalizedHandoff(project.id)
  if (!handoff) {
    return {
      canDesign: false,
      reasons: ['먼저 과제선별에서 핵심 과제를 확정해야 합니다.'],
      websiteRedirect: false,
      handoff: null,
    }
  }
  if (!handoff.primaryCandidate) {
    return {
      canDesign: false,
      reasons: ['확정된 핵심 과제가 없어 설계를 시작할 수 없습니다.'],
      websiteRedirect: false,
      handoff,
    }
  }
  return { canDesign: true, reasons: [], websiteRedirect: false, handoff }
}

/** 설계가 확정보다 오래되어 재설계가 필요한지 */
export function needsRedesign(design: MvpDesign): boolean {
  const handoff = findFinalizedHandoff(design.projectId)
  if (!handoff) return false
  if (handoff.selectionVersion !== design.selectionVersion) return true
  return computeDesignHash(handoff) !== design.sourceSnapshotHash
}

export function getProjectDesignLifecycle(project: Project): DesignLifecycle {
  if (project.projectType === 'website') return 'website_only'
  const eligibility = getDesignEligibility(project)
  if (!eligibility.canDesign) return 'not_eligible'
  const design = mvpDesignRepository.getLatestByProjectId(project.id)
  if (design) {
    if (design.status === 'finalized') return needsRedesign(design) ? 'needs_redesign' : 'finalized'
    if (design.status === 'reviewed') return 'reviewed'
    if (design.status === 'draft') return 'draft'
  }
  return 'ready_to_design'
}

/** 대시보드 KPI: 제작 중 MVP(확정 선정 있음·설계 미확정) */
export function countDesignInProgress(): number {
  return projectRepository.getAll().filter((p) => {
    if (p.projectType === 'website') return false
    const handoff = findFinalizedHandoff(p.id)
    if (!handoff || !handoff.primaryCandidate) return false
    const design = mvpDesignRepository.getLatestByProjectId(p.id)
    return !design || design.status !== 'finalized' || needsRedesign(design)
  }).length
}

/* ------------------------------------------------------------------ */
/* 설계 생성/재생성                                                     */
/* ------------------------------------------------------------------ */

/** 확정 핵심 과제로부터 설계 초안을 생성하거나 최신 상태를 확보한다 */
export function ensureDesignDraft(projectId: string): MvpDesign {
  const project = projectRepository.getById(projectId)
  if (!project) throw new DesignBlockedError('프로젝트를 찾을 수 없습니다.')
  const eligibility = getDesignEligibility(project)
  if (!eligibility.canDesign || !eligibility.handoff) {
    throw new DesignBlockedError(eligibility.reasons[0] ?? '설계를 시작할 수 없습니다.')
  }
  const existing = mvpDesignRepository.getLatestByProjectId(projectId)
  if (existing && existing.status !== 'finalized' && existing.status !== 'superseded') {
    return existing
  }
  const organization = organizationRepository.getById(project.organizationId)
  const draft = buildDesignDraft(eligibility.handoff, project, organization, CURRENT_USER.name, nowIso())
  const created = mvpDesignRepository.create(draft)
  activityRepository.add({
    organizationId: project.organizationId,
    projectId,
    activityType: 'project_updated',
    title: 'MVP 설계 초안이 생성되었습니다.',
    description: `기능 ${draft.features.length}건 · 규칙 v${MVP_DESIGN_RULE_VERSION}`,
    actorName: CURRENT_USER.name,
  })
  return created
}

/** 확정 핵심 과제 기준으로 설계를 다시 생성한다(초안/검토 상태 대상) */
export function regenerateDesign(designId: string): MvpDesign {
  const design = mvpDesignRepository.getById(designId)
  if (!design) throw new DesignBlockedError('설계를 찾을 수 없습니다.')
  if (design.status === 'finalized' || design.status === 'superseded') {
    throw new DesignBlockedError('확정된 설계는 다시 생성할 수 없습니다. 새 버전을 만드세요.')
  }
  const project = projectRepository.getById(design.projectId)
  if (!project) throw new DesignBlockedError('프로젝트를 찾을 수 없습니다.')
  const handoff = findFinalizedHandoff(design.projectId)
  if (!handoff) throw new DesignBlockedError('확정된 핵심 과제가 없습니다.')
  const organization = organizationRepository.getById(project.organizationId)
  const draft = buildDesignDraft(handoff, project, organization, design.createdBy || CURRENT_USER.name, design.createdAt)
  return mvpDesignRepository.update(designId, {
    ...draft,
    status: 'draft',
    designSummary: design.designSummary,
    scopeNotes: design.scopeNotes,
  })
}

/** 확정 후 최신 핵심 과제를 반영한 새 설계 버전을 만든다 */
export function createNewDesignVersion(projectId: string): MvpDesign {
  const project = projectRepository.getById(projectId)
  if (!project) throw new DesignBlockedError('프로젝트를 찾을 수 없습니다.')
  const eligibility = getDesignEligibility(project)
  if (!eligibility.canDesign || !eligibility.handoff) {
    throw new DesignBlockedError(eligibility.reasons[0] ?? '설계를 시작할 수 없습니다.')
  }
  const organization = organizationRepository.getById(project.organizationId)
  const draft = buildDesignDraft(eligibility.handoff, project, organization, CURRENT_USER.name, nowIso())
  return mvpDesignRepository.create(draft)
}

/* ------------------------------------------------------------------ */
/* 편집 — 파생값 재계산                                                 */
/* ------------------------------------------------------------------ */

function maxScope(a: FeatureScope, b: FeatureScope): FeatureScope {
  const order: FeatureScope[] = ['excluded', 'later', 'should', 'must']
  return order.indexOf(a) >= order.indexOf(b) ? a : b
}

/** 기능 범위 변경 후 화면 범위·가드레일·품질 점검을 다시 계산한다 */
function recomputeDerived(design: MvpDesign): Pick<MvpDesign, 'screens' | 'guardrailChecks' | 'qualityChecks'> {
  const featureScopeById = new Map(design.features.map((f) => [f.id, f.scope]))
  const screens = design.screens.map((s) => {
    const scopes = s.featureIds.map((fid) => featureScopeById.get(fid) ?? 'later')
    const scope = scopes.reduce<FeatureScope>((acc, sc) => maxScope(acc, sc), 'excluded')
    return { ...s, scope }
  })
  const forGuardrail = { ...design, screens }
  const guardrailChecks = evaluateGuardrails(forGuardrail)
  const qualityChecks = runQualityChecks(
    {
      features: design.features,
      screens,
      roles: design.roles,
      aiFeatures: design.aiFeatures,
      integrations: design.integrations,
      businessRules: design.businessRules,
      acceptanceCriteria: design.acceptanceCriteria,
      kpis: design.kpis,
      levelDecision: design.levelDecision,
      hasWebsiteTrack: design.hasWebsiteTrack,
      websiteStudioRecommended: design.websiteStudioRecommended,
    },
    guardrailChecks,
  )
  return { screens, guardrailChecks, qualityChecks }
}

function assertEditable(design: MvpDesign): void {
  if (design.status === 'finalized' || design.status === 'superseded') {
    throw new DesignEditError('확정된 설계는 수정할 수 없습니다. 새 버전을 만드세요.')
  }
}

export function setFeatureScope(
  designId: string,
  featureId: string,
  scope: FeatureScope,
  reason: string,
): MvpDesign {
  const design = mvpDesignRepository.getById(designId)
  if (!design) throw new DesignEditError('설계를 찾을 수 없습니다.')
  assertEditable(design)
  const features = design.features.map((f) =>
    f.id === featureId ? { ...f, scope, scopeReason: reason.trim() } : f,
  )
  const next = { ...design, features }
  const derived = recomputeDerived(next)
  return mvpDesignRepository.update(designId, { features, ...derived })
}

export function updateFeatureDefinition(
  designId: string,
  featureId: string,
  patch: Partial<Pick<MvpFeature, 'name' | 'summary' | 'input' | 'processing' | 'output' | 'automationMode' | 'humanReviewRequired'>>,
): MvpDesign {
  const design = mvpDesignRepository.getById(designId)
  if (!design) throw new DesignEditError('설계를 찾을 수 없습니다.')
  assertEditable(design)
  const features = design.features.map((f) => (f.id === featureId ? { ...f, ...patch } : f))
  const next = { ...design, features }
  const derived = recomputeDerived(next)
  return mvpDesignRepository.update(designId, { features, ...derived })
}

export function setMvpLevel(designId: string, level: MvpLevel, reason: string): MvpDesign {
  const design = mvpDesignRepository.getById(designId)
  if (!design) throw new DesignEditError('설계를 찾을 수 없습니다.')
  assertEditable(design)
  const isOverride = level !== design.levelDecision.recommendedLevel
  if (isOverride && reason.trim() === '') {
    throw new DesignEditError('권장 수준과 다른 MVP 수준을 선택하려면 사유가 필요합니다.')
  }
  const levelDecision = {
    ...design.levelDecision,
    selectedLevel: level,
    overrideReason: isOverride ? reason.trim() : '',
  }
  const next = { ...design, levelDecision }
  const derived = recomputeDerived(next)
  return mvpDesignRepository.update(designId, { levelDecision, ...derived })
}

export function updateDesignNotes(
  designId: string,
  patch: Partial<Pick<MvpDesign, 'designSummary' | 'scopeNotes'>>,
): MvpDesign {
  const design = mvpDesignRepository.getById(designId)
  if (!design) throw new DesignEditError('설계를 찾을 수 없습니다.')
  assertEditable(design)
  return mvpDesignRepository.update(designId, patch)
}

/* ------------------------------------------------------------------ */
/* 검토 / 확정                                                          */
/* ------------------------------------------------------------------ */

export interface DesignFinalizeCheck {
  ok: boolean
  reasons: string[]
}

export function checkCanFinalizeDesign(design: MvpDesign): DesignFinalizeCheck {
  const reasons: string[] = []
  if (hasBlockingErrors(design.qualityChecks)) {
    reasons.push('해결해야 할 설계 오류가 있습니다.')
  }
  if (design.features.filter((f) => f.scope === 'must').length === 0) {
    reasons.push('1차 필수(Must) 기능을 최소 1개 지정해야 합니다.')
  }
  if (design.designSummary.trim() === '') {
    reasons.push('설계 요약(최종 의견)을 작성해야 합니다.')
  }
  const isOverride = design.levelDecision.selectedLevel !== design.levelDecision.recommendedLevel
  if (isOverride && design.levelDecision.overrideReason.trim() === '') {
    reasons.push('권장과 다른 MVP 수준을 선택한 사유가 필요합니다.')
  }
  return { ok: reasons.length === 0, reasons }
}

export function markDesignReviewed(designId: string): MvpDesign {
  const design = mvpDesignRepository.getById(designId)
  if (!design) throw new DesignBlockedError('설계를 찾을 수 없습니다.')
  assertEditable(design)
  return mvpDesignRepository.markReviewed(designId, CURRENT_USER.name)
}

export function finalizeDesign(designId: string): MvpDesign {
  const design = mvpDesignRepository.getById(designId)
  if (!design) throw new DesignBlockedError('설계를 찾을 수 없습니다.')
  if (design.status === 'finalized') return design
  const check = checkCanFinalizeDesign(design)
  if (!check.ok) throw new DesignBlockedError(check.reasons.join(' '))

  const finalized = mvpDesignRepository.finalize(designId, CURRENT_USER.name)
  // 인계 스냅샷 동결
  const snapshot = buildDesignHandoffSnapshot(finalized, nowIso())
  mvpDesignHandoffRepository.replaceForDesign(finalized.id, snapshot)

  activityRepository.add({
    organizationId: finalized.organizationId,
    projectId: finalized.projectId,
    activityType: 'status_changed',
    title: `MVP 설계가 확정되었습니다: ${finalized.coreTaskName}`,
    description: `Level ${finalized.levelDecision.selectedLevel} · 필수 기능 ${finalized.features.filter((f) => f.scope === 'must').length}건`,
    actorName: CURRENT_USER.name,
  })
  return finalized
}

/* ------------------------------------------------------------------ */
/* 조회 컨텍스트                                                        */
/* ------------------------------------------------------------------ */

export interface ProjectDesignContext {
  project: Project
  organization: Organization | null
  eligibility: DesignEligibility
  lifecycle: DesignLifecycle
  design: MvpDesign | null
  needsRedesignFlag: boolean
}

export function getProjectDesignContext(projectId: string): ProjectDesignContext | null {
  const project = projectRepository.getById(projectId)
  if (!project) return null
  const design = mvpDesignRepository.getLatestByProjectId(projectId)
  return {
    project,
    organization: organizationRepository.getById(project.organizationId),
    eligibility: getDesignEligibility(project),
    lifecycle: getProjectDesignLifecycle(project),
    design,
    needsRedesignFlag: design ? needsRedesign(design) : false,
  }
}
