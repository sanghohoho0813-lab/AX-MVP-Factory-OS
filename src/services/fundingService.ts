import type { Organization, Project } from '../types/domain'
import type {
  ApplicationStage,
  DocumentRequirementStatus,
  FundingApplication,
  FundingDocumentRequirement,
  FundingEvidence,
  FundingGap,
  FundingOutcome,
  FundingStrategy,
  InternalPerformance,
  MatchPriority,
  OutcomeMetric,
  OutreachActivity,
  OutreachPlan,
  OutreachPlanStatus,
} from '../types/funding'
import {
  activityRepository,
  fundingStrategyRepository,
  fundingStrategySnapshotRepository,
  organizationRepository,
  projectRepository,
} from '../repositories'
import { CURRENT_USER } from '../data/demo'
import {
  buildStrategyDraft,
  previewStrategyDraft,
  type DraftPreview,
} from './funding/fundingOrchestrator'
import {
  collectFundingSources,
  computeFundingSourceHash,
  evaluateFundingEligibility,
  type FundingEligibility,
} from './funding/evidenceCollector'
import { runFundingQuality, hasFundingBlockingErrors } from './funding/qualityEngine'
import { buildFundingSummary, type FundingSummary } from './funding/fundingSummaryBuilder'
import { buildFundingSnapshot } from './funding/fundingSnapshotBuilder'
import { FUNDING_RULE_VERSION, FUNDING_ISO } from './funding/fundingTaxonomy'

function nowIso(): string {
  return new Date().toISOString()
}
function genId(prefix: string): string {
  return `${prefix}-${nowIso()}-${Math.round(performance.now())}`
}

export class FundingBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FundingBlockedError'
  }
}
export class FundingEditError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FundingEditError'
  }
}

/* ------------------------------------------------------------------ */
/* 자격·미리보기·생성                                                   */
/* ------------------------------------------------------------------ */

export function getFundingEligibility(projectId: string): FundingEligibility | null {
  const sources = collectFundingSources(projectId)
  return sources ? evaluateFundingEligibility(sources) : null
}

export function getStrategyPreview(projectId: string): DraftPreview | null {
  return previewStrategyDraft(projectId)
}

export function createStrategy(projectId: string): FundingStrategy {
  const project = projectRepository.getById(projectId)
  if (!project) throw new FundingBlockedError('프로젝트를 찾을 수 없습니다.')
  const result = buildStrategyDraft(projectId, CURRENT_USER.name)
  if (!result) throw new FundingBlockedError('연계 근거를 수집할 수 없습니다.')
  const created = fundingStrategyRepository.create(result.input)
  activityRepository.add({
    organizationId: created.organizationId,
    projectId,
    activityType: 'project_updated',
    title: '기관·자금 연계 전략 초안이 생성되었습니다.',
    description: `후보 기관 ${created.matches.length}개 · 규칙 v${FUNDING_RULE_VERSION}`,
    actorName: CURRENT_USER.name,
  })
  return created
}

export function createNewVersion(projectId: string): FundingStrategy {
  const result = buildStrategyDraft(projectId, CURRENT_USER.name)
  if (!result) throw new FundingBlockedError('연계 근거를 수집할 수 없습니다.')
  return fundingStrategyRepository.create(result.input)
}

/* ------------------------------------------------------------------ */
/* 편집 공통                                                            */
/* ------------------------------------------------------------------ */

function load(strategyId: string): FundingStrategy {
  const s = fundingStrategyRepository.getById(strategyId)
  if (!s) throw new FundingEditError('연계 전략을 찾을 수 없습니다.')
  return s
}
function assertEditable(s: FundingStrategy): void {
  if (s.status === 'finalized' || s.status === 'superseded') {
    throw new FundingEditError('확정된 전략은 수정할 수 없습니다. 새 버전을 만드세요.')
  }
}

export function needsRefresh(s: FundingStrategy): boolean {
  if (s.ruleVersion !== FUNDING_RULE_VERSION) return true
  const sources = collectFundingSources(s.projectId)
  if (!sources) return false
  return computeFundingSourceHash(sources) !== s.sourceSnapshotHash
}

function saveWith(s: FundingStrategy, patch: Partial<FundingStrategy>): FundingStrategy {
  const merged = { ...s, ...patch }
  const qualityChecks = runFundingQuality(merged, { stale: needsRefresh(merged) })
  return fundingStrategyRepository.update(s.id, { ...patch, qualityChecks })
}

export function updateStrategyMeta(
  strategyId: string,
  patch: Partial<Pick<FundingStrategy, 'objective' | 'targetUse' | 'preferredSupportTypes' | 'strategySummary' | 'analystNotes' | 'officialConfirmationNotes' | 'openQuestions' | 'assumptions' | 'risks'>>,
): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  return saveWith(s, patch)
}

export function updateInternalPerformance(strategyId: string, patch: Partial<InternalPerformance>): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  return saveWith(s, { internalPerformance: { ...s.internalPerformance, ...patch } })
}

/* ------------------------------------------------------------------ */
/* 근거                                                                 */
/* ------------------------------------------------------------------ */

export function addEvidence(strategyId: string, input: Pick<FundingEvidence, 'label' | 'value' | 'unit' | 'description'> & Partial<Pick<FundingEvidence, 'sensitive'>>): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  const item: FundingEvidence = {
    id: genId('fev'), sourceType: 'manual', sourceId: '', label: input.label, description: input.description,
    value: input.value, unit: input.unit, evidenceDate: FUNDING_ISO, verified: false, verificationNote: '',
    sensitive: input.sensitive ?? false, relatedMatchIds: [], createdAt: nowIso(), updatedAt: nowIso(),
  }
  return saveWith(s, { evidence: [...s.evidence, item] })
}
export function updateEvidence(strategyId: string, evidenceId: string, patch: Partial<Pick<FundingEvidence, 'label' | 'value' | 'unit' | 'verified' | 'verificationNote' | 'sensitive'>>): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  return saveWith(s, { evidence: s.evidence.map((e) => (e.id === evidenceId ? { ...e, ...patch, updatedAt: nowIso() } : e)) })
}
export function removeEvidence(strategyId: string, evidenceId: string): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  return saveWith(s, { evidence: s.evidence.filter((e) => e.id !== evidenceId) })
}

/* ------------------------------------------------------------------ */
/* 후보(Match)                                                          */
/* ------------------------------------------------------------------ */

export function setMatchPriority(strategyId: string, matchId: string, priority: MatchPriority, exclusionReason = ''): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  const matches = s.matches.map((m) => {
    if (m.id !== matchId) return m
    return { ...m, priority, updatedAt: nowIso(), excludedAt: priority === 'excluded' ? nowIso() : null, exclusionReason: priority === 'excluded' ? exclusionReason : '' }
  })
  return saveWith(s, { matches })
}
export function updateMatch(strategyId: string, matchId: string, patch: Partial<Pick<import('../types/funding').FundingMatch, 'reasonSummary' | 'expectedUse' | 'analystOpinion' | 'officialConfirmationRequired' | 'requiredNextActions' | 'risks'>>): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  return saveWith(s, { matches: s.matches.map((m) => (m.id === matchId ? { ...m, ...patch, updatedAt: nowIso() } : m)) })
}
export function updateCriterion(strategyId: string, matchId: string, criterionId: string, patch: Partial<Pick<import('../types/funding').ProgramCriterionCheck, 'status' | 'analystNote'>>): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  const matches = s.matches.map((m) => {
    if (m.id !== matchId) return m
    return { ...m, criterionChecks: m.criterionChecks.map((c) => (c.id === criterionId ? { ...c, ...patch } : c)) }
  })
  return saveWith(s, { matches })
}

/* ------------------------------------------------------------------ */
/* 부족조건(Gap)                                                        */
/* ------------------------------------------------------------------ */

export function addGap(strategyId: string, input: Pick<FundingGap, 'category' | 'severity' | 'title' | 'description' | 'requiredAction' | 'evidenceNeeded'> & Partial<Pick<FundingGap, 'matchId'>>): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  const gap: FundingGap = {
    id: genId('gap'), strategyId, matchId: input.matchId ?? null, category: input.category, severity: input.severity,
    title: input.title, description: input.description, requiredAction: input.requiredAction, ownerId: '', dueDate: '',
    status: 'open', evidenceNeeded: input.evidenceNeeded, resolution: '', createdAt: nowIso(), updatedAt: nowIso(),
  }
  return saveWith(s, { gaps: [...s.gaps, gap] })
}
export function updateGap(strategyId: string, gapId: string, patch: Partial<Pick<FundingGap, 'severity' | 'title' | 'description' | 'requiredAction' | 'ownerId' | 'dueDate' | 'status' | 'resolution'>>): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  return saveWith(s, { gaps: s.gaps.map((g) => (g.id === gapId ? { ...g, ...patch, updatedAt: nowIso() } : g)) })
}
export function removeGap(strategyId: string, gapId: string): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  return saveWith(s, { gaps: s.gaps.filter((g) => g.id !== gapId) })
}

/* ------------------------------------------------------------------ */
/* 접촉 계획·이력                                                       */
/* ------------------------------------------------------------------ */

export function addOutreachPlan(strategyId: string, input: Pick<OutreachPlan, 'institutionId' | 'purpose' | 'targetRole' | 'channel'> & Partial<Pick<OutreachPlan, 'programId' | 'plannedDate' | 'preparationItems' | 'keyQuestions' | 'talkingPoints'>>): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  const plan: OutreachPlan = {
    id: genId('plan'), strategyId, institutionId: input.institutionId, programId: input.programId ?? null,
    purpose: input.purpose, targetRole: input.targetRole, channel: input.channel, plannedDate: input.plannedDate ?? '',
    ownerId: '', preparationItems: input.preparationItems ?? [], keyQuestions: input.keyQuestions ?? [],
    talkingPoints: input.talkingPoints ?? [], status: 'planned', notes: '', createdAt: nowIso(), updatedAt: nowIso(),
  }
  return saveWith(s, { outreachPlans: [...s.outreachPlans, plan] })
}
export function updateOutreachPlan(strategyId: string, planId: string, patch: Partial<Pick<OutreachPlan, 'purpose' | 'targetRole' | 'channel' | 'plannedDate' | 'ownerId' | 'status' | 'notes'>>): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  return saveWith(s, { outreachPlans: s.outreachPlans.map((p) => (p.id === planId ? { ...p, ...patch, updatedAt: nowIso() } : p)) })
}
/** 접촉 기록 (실제 이메일·문자 발송 없음, 개인 연락처 과도 저장 금지) */
export function recordOutreachActivity(strategyId: string, planId: string, input: Pick<OutreachActivity, 'channel' | 'contactRole' | 'summary'> & Partial<Pick<OutreachActivity, 'contactNameNote' | 'institutionFeedback' | 'requestedMaterials' | 'nextAction' | 'nextActionDueDate' | 'internalOnly'>>): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  const activity: OutreachActivity = {
    id: genId('act'), planId, strategyId, occurredAt: nowIso(), channel: input.channel, contactRole: input.contactRole,
    contactNameNote: input.contactNameNote ?? '', summary: input.summary, institutionFeedback: input.institutionFeedback ?? '',
    requestedMaterials: input.requestedMaterials ?? [], nextAction: input.nextAction ?? '', nextActionDueDate: input.nextActionDueDate ?? '',
    internalOnly: input.internalOnly ?? false, createdBy: CURRENT_USER.name, createdAt: nowIso(),
  }
  const outreachPlans = s.outreachPlans.map((p) => (p.id === planId ? { ...p, status: 'contacted' as OutreachPlanStatus, updatedAt: nowIso() } : p))
  return saveWith(s, { outreachActivities: [...s.outreachActivities, activity], outreachPlans })
}

/* ------------------------------------------------------------------ */
/* 준비자료                                                             */
/* ------------------------------------------------------------------ */

export function addDocumentRequirement(strategyId: string, input: Pick<FundingDocumentRequirement, 'category' | 'title' | 'description' | 'required'> & Partial<Pick<FundingDocumentRequirement, 'officialFormRequired' | 'sensitive'>>): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  const doc: FundingDocumentRequirement = {
    id: genId('doc'), strategyId, matchId: null, category: input.category, title: input.title, description: input.description,
    status: 'missing', required: input.required, sourceDeliverablePackageId: '', sourceEvidenceIds: [], ownerId: '', dueDate: '',
    officialFormRequired: input.officialFormRequired ?? false, sensitive: input.sensitive ?? false, notes: '', createdAt: nowIso(), updatedAt: nowIso(),
  }
  return saveWith(s, { documentRequirements: [...s.documentRequirements, doc] })
}
export function updateDocumentRequirement(strategyId: string, docId: string, patch: Partial<Pick<FundingDocumentRequirement, 'status' | 'required' | 'ownerId' | 'dueDate' | 'sourceDeliverablePackageId' | 'notes'>>): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  return saveWith(s, { documentRequirements: s.documentRequirements.map((d) => (d.id === docId ? { ...d, ...patch, updatedAt: nowIso() } : d)) })
}
export function setDocumentStatus(strategyId: string, docId: string, status: DocumentRequirementStatus): FundingStrategy {
  return updateDocumentRequirement(strategyId, docId, { status })
}
export function linkDeliverablePackage(strategyId: string, docId: string, packageId: string): FundingStrategy {
  return updateDocumentRequirement(strategyId, docId, { sourceDeliverablePackageId: packageId, status: 'ready' })
}

/* ------------------------------------------------------------------ */
/* 신청 파이프라인                                                      */
/* ------------------------------------------------------------------ */

export function addApplication(strategyId: string, input: Pick<FundingApplication, 'matchId' | 'applicationName'> & Partial<Pick<FundingApplication, 'applicationReference' | 'requestedAmount' | 'currency'>>): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  const app: FundingApplication = {
    id: genId('app'), strategyId, matchId: input.matchId, applicationName: input.applicationName, applicationStage: 'prospect',
    applicationReference: input.applicationReference ?? '', submittedAt: '', reviewStartedAt: '', resultAt: '',
    requestedAmount: input.requestedAmount ?? '', approvedAmount: '', currency: input.currency ?? 'KRW', approvedConditions: [],
    rejectionReasons: [], supplementRequests: [], nextAction: '', ownerId: '', notes: '', createdAt: nowIso(), updatedAt: nowIso(),
  }
  return saveWith(s, { applications: [...s.applications, app] })
}
export function setApplicationStage(strategyId: string, appId: string, stage: ApplicationStage): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  const applications = s.applications.map((a) => {
    if (a.id !== appId) return a
    const next = { ...a, applicationStage: stage, updatedAt: nowIso() }
    if (stage === 'submitted' && !a.submittedAt) next.submittedAt = nowIso()
    if (stage === 'reviewing' && !a.reviewStartedAt) next.reviewStartedAt = nowIso()
    if (['approved', 'conditionally_approved', 'rejected'].includes(stage) && !a.resultAt) next.resultAt = nowIso()
    return next
  })
  return saveWith(s, { applications })
}
export function updateApplication(strategyId: string, appId: string, patch: Partial<Pick<FundingApplication, 'applicationName' | 'applicationReference' | 'requestedAmount' | 'approvedAmount' | 'nextAction' | 'ownerId' | 'notes' | 'supplementRequests'>>): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  return saveWith(s, { applications: s.applications.map((a) => (a.id === appId ? { ...a, ...patch, updatedAt: nowIso() } : a)) })
}

/* ------------------------------------------------------------------ */
/* 결과·성과                                                            */
/* ------------------------------------------------------------------ */

export function recordOutcome(strategyId: string, input: Pick<FundingOutcome, 'applicationId' | 'type' | 'summary'> & Partial<Pick<FundingOutcome, 'requestedAmount' | 'approvedAmount' | 'executedAmount' | 'currency' | 'approvalDate' | 'executionDate' | 'conditions' | 'rejectionReasons' | 'lessonsLearned' | 'followUpActions'>>): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  const outcome: FundingOutcome = {
    id: genId('out'), strategyId, applicationId: input.applicationId, type: input.type, summary: input.summary,
    requestedAmount: input.requestedAmount ?? '', approvedAmount: input.approvedAmount ?? '', executedAmount: input.executedAmount ?? '',
    currency: input.currency ?? 'KRW', approvalDate: input.approvalDate ?? '', executionDate: input.executionDate ?? '',
    conditions: input.conditions ?? [], rejectionReasons: input.rejectionReasons ?? [], lessonsLearned: input.lessonsLearned ?? '',
    followUpActions: input.followUpActions ?? [], evidenceIds: [], recordedBy: CURRENT_USER.name, recordedAt: nowIso(),
  }
  return saveWith(s, { outcomes: [...s.outcomes, outcome] })
}
export function updateOutcome(strategyId: string, outcomeId: string, patch: Partial<Pick<FundingOutcome, 'type' | 'summary' | 'requestedAmount' | 'approvedAmount' | 'executedAmount' | 'approvalDate' | 'executionDate' | 'lessonsLearned'>>): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  return saveWith(s, { outcomes: s.outcomes.map((o) => (o.id === outcomeId ? { ...o, ...patch } : o)) })
}
export function removeOutcome(strategyId: string, outcomeId: string): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  return saveWith(s, { outcomes: s.outcomes.filter((o) => o.id !== outcomeId), metrics: s.metrics.filter((m) => m.outcomeId !== outcomeId) })
}

export function addMetric(strategyId: string, input: Pick<OutcomeMetric, 'type' | 'name' | 'unit'> & Partial<Pick<OutcomeMetric, 'outcomeId' | 'baselineValue' | 'targetValue' | 'actualValue' | 'measurementMethod' | 'sensitive'>>): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  const metric: OutcomeMetric = {
    id: genId('mt'), strategyId, outcomeId: input.outcomeId ?? '', type: input.type, name: input.name,
    baselineValue: input.baselineValue ?? '', targetValue: input.targetValue ?? '', actualValue: input.actualValue ?? '',
    unit: input.unit, measurementMethod: input.measurementMethod ?? '', measurementDate: '', sourceEvidenceIds: [],
    verified: false, sensitive: input.sensitive ?? false, notes: '',
  }
  return saveWith(s, { metrics: [...s.metrics, metric] })
}
export function updateMetric(strategyId: string, metricId: string, patch: Partial<Pick<OutcomeMetric, 'name' | 'baselineValue' | 'targetValue' | 'actualValue' | 'unit' | 'verified' | 'measurementMethod' | 'sensitive'>>): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  const metrics = s.metrics.map((m) => (m.id === metricId ? { ...m, ...patch, measurementDate: patch.actualValue !== undefined ? nowIso() : m.measurementDate } : m))
  return saveWith(s, { metrics })
}
export function removeMetric(strategyId: string, metricId: string): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  return saveWith(s, { metrics: s.metrics.filter((m) => m.id !== metricId) })
}

/* ------------------------------------------------------------------ */
/* 라이프사이클                                                         */
/* ------------------------------------------------------------------ */

export function markReviewed(strategyId: string): FundingStrategy {
  const s = load(strategyId)
  assertEditable(s)
  return fundingStrategyRepository.markReviewed(strategyId, CURRENT_USER.name)
}

export interface FinalizeCheck {
  ok: boolean
  reasons: string[]
}
export function checkCanFinalize(s: FundingStrategy): FinalizeCheck {
  const checks = runFundingQuality(s, { stale: needsRefresh(s) })
  const reasons = checks.filter((c) => c.severity === 'error' && !c.passed).map((c) => `${c.title}: ${c.description}`)
  return { ok: reasons.length === 0, reasons }
}

export function finalizeStrategy(strategyId: string): FundingStrategy {
  const s = load(strategyId)
  if (s.status === 'finalized') return s
  const checks = runFundingQuality(s, { stale: needsRefresh(s) })
  if (hasFundingBlockingErrors(checks)) {
    throw new FundingBlockedError(checks.filter((c) => c.severity === 'error' && !c.passed).map((c) => c.title).join(', '))
  }
  fundingStrategyRepository.update(s.id, { qualityChecks: checks })
  const finalized = fundingStrategyRepository.finalize(s.id, CURRENT_USER.name)
  fundingStrategySnapshotRepository.replaceForStrategy(finalized.id, buildFundingSnapshot(finalized, nowIso()))
  const primary = finalized.matches.find((m) => m.priority === 'primary')
  activityRepository.add({
    organizationId: finalized.organizationId,
    projectId: finalized.projectId,
    activityType: 'status_changed',
    title: `${organizationRepository.getById(finalized.organizationId)?.name ?? '고객사'}의 기관·자금 연계 전략이 확정되었습니다.`,
    description: primary ? `우선 검토: ${primary.reasonSummary.slice(0, 40)}` : `후보 ${finalized.matches.length}개`,
    actorName: CURRENT_USER.name,
  })
  return finalized
}

/* ------------------------------------------------------------------ */
/* 조회 컨텍스트·요약·대시보드                                          */
/* ------------------------------------------------------------------ */

export function getStrategy(id: string): FundingStrategy | null {
  return fundingStrategyRepository.getById(id)
}
export function summarizeStrategy(s: FundingStrategy): FundingSummary {
  return buildFundingSummary(s, needsRefresh(s))
}
export function getAllStrategies(): FundingStrategy[] {
  return fundingStrategyRepository.getAll()
}

export interface ProjectFundingContext {
  project: Project
  organization: Organization | null
  eligibility: FundingEligibility
  strategies: FundingStrategy[]
  latest: FundingStrategy | null
  latestStale: boolean
}

export function getProjectFundingContext(projectId: string): ProjectFundingContext | null {
  const project = projectRepository.getById(projectId)
  if (!project) return null
  const eligibility = getFundingEligibility(projectId)
  if (!eligibility) return null
  const strategies = fundingStrategyRepository.getByProjectId(projectId)
  const latest = fundingStrategyRepository.getLatestByProjectId(projectId)
  return {
    project,
    organization: organizationRepository.getById(project.organizationId),
    eligibility,
    strategies,
    latest,
    latestStale: latest ? needsRefresh(latest) : false,
  }
}

export interface FundingPendingCounts {
  creatable: number
  reviewing: number
  applyingReady: number
  underReview: number
  outcomeDone: number
  supplementNeeded: number
}

/** 대시보드·메인 상단 요약 */
export function countFundingPending(): FundingPendingCounts {
  let creatable = 0, reviewing = 0, applyingReady = 0, underReview = 0, outcomeDone = 0, supplementNeeded = 0
  for (const project of projectRepository.getAll()) {
    if (project.status === 'archived') continue
    const eligibility = getFundingEligibility(project.id)
    if (!eligibility?.canCreate) continue
    const latest = fundingStrategyRepository.getLatestByProjectId(project.id)
    if (!latest) { creatable += 1; continue }
    if (latest.status === 'draft' || latest.status === 'reviewed') reviewing += 1
    if (latest.applications.some((a) => a.applicationStage === 'preparing' || a.applicationStage === 'pre_review')) applyingReady += 1
    if (latest.applications.some((a) => a.applicationStage === 'reviewing' || a.applicationStage === 'submitted')) underReview += 1
    if (latest.applications.some((a) => a.applicationStage === 'supplement_requested')) supplementNeeded += 1
    if (latest.outcomes.length > 0) outcomeDone += 1
  }
  return { creatable, reviewing, applyingReady, underReview, outcomeDone, supplementNeeded }
}
