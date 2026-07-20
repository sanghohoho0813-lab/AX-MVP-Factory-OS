import type { Organization, Project } from '../types/domain'
import type {
  BuildArtifact,
  BuildArtifactType,
  EvidenceArtifact,
  FeedbackItem,
  GateCriterionStatus,
  ScenarioRun,
  SourceDesignType,
  TestSessionScenarioResult,
  ValidationFinalDecision,
  ValidationGateNumber,
  ValidationGateStatus,
  ValidationIssue,
  ValidationMetricDefinition,
  ValidationMetricMeasurement,
  ValidationParticipant,
  ValidationPlan,
  ValidationRound,
  ValidationScenario,
  ValidationScenarioType,
  ValidationTestSession,
  ValidationTrackType,
  ValidationWorkspace,
} from '../types/validation'
import type { MvpDesignHandoffSnapshot } from '../types/mvpDesign'
import type { WebsiteDesignHandoffSnapshot } from '../types/websiteDesign'
import {
  activityRepository,
  mvpDesignHandoffRepository,
  mvpDesignRepository,
  organizationRepository,
  projectRepository,
  validationHandoffRepository,
  validationTestSessionRepository,
  validationWorkspaceRepository,
  websiteDesignHandoffRepository,
  websiteDesignRepository,
} from '../repositories'
import { CURRENT_USER } from '../data/demo'
import { TRACK_META } from '../lib/validationMeta'
import { generateId } from '../storage/localStore'
import { generateUniqueAccessToken } from './surveyTokenService'
import { buildWorkspaceDraft, computeValidationHash } from './validation/orchestrator'
import {
  autoDraftGateStatus,
  canSetGateStatus,
  hasOpenCritical,
  requiredPassStat,
} from './validation/gateEngine'
import { runValidationQuality, hasBlockingErrors } from './validation/qualityEngine'
import { buildValidationHandoff } from './validation/handoffBuilder'
import { buildValidationSummary, type ValidationSummary } from './validation/summaryBuilder'
import { VALIDATION_RULE_VERSION } from './validation/gateConfig'

function nowIso(): string {
  return new Date().toISOString()
}

export class ValidationBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationBlockedError'
  }
}
export class ValidationEditError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationEditError'
  }
}

/* ------------------------------------------------------------------ */
/* 출처 설계 확정본 조회                                                 */
/* ------------------------------------------------------------------ */

interface MvpSource {
  designId: string
  designVersion: number
  handoff: MvpDesignHandoffSnapshot
}
interface WebsiteSource {
  designId: string
  designVersion: number
  handoff: WebsiteDesignHandoffSnapshot
}

function finalizedMvpSource(projectId: string): MvpSource | null {
  const finalized = mvpDesignRepository.getByProjectId(projectId).find((d) => d.status === 'finalized')
  if (!finalized) return null
  const handoff = mvpDesignHandoffRepository.getByDesignId(finalized.id)
  if (!handoff) return null
  return { designId: finalized.id, designVersion: finalized.version, handoff }
}

function finalizedWebsiteSource(projectId: string): WebsiteSource | null {
  const finalized = websiteDesignRepository.getByProjectId(projectId).find((d) => d.status === 'finalized')
  if (!finalized) return null
  const handoff = websiteDesignHandoffRepository.getByDesignId(finalized.id)
  if (!handoff) return null
  return { designId: finalized.id, designVersion: finalized.version, handoff }
}

/* ------------------------------------------------------------------ */
/* 자격 판정 — 트랙별 (AX와 홈페이지는 합산하지 않고 분리)               */
/* ------------------------------------------------------------------ */

export interface TrackEligibility {
  trackType: ValidationTrackType
  sourceDesignType: SourceDesignType
  available: boolean
  reason: string
  sourceDesignId: string
  sourceDesignVersion: number
}

/** 프로젝트 유형별 검증 대상 트랙 목록 (ax_website는 2개 트랙을 별도로 생성) */
export function trackTypesForProject(project: Project): ValidationTrackType[] {
  if (project.projectType === 'ax') return ['ax_mvp']
  if (project.projectType === 'website') return ['website']
  return ['ax_mvp', 'website']
}

export function getValidationEligibility(project: Project): TrackEligibility[] {
  return trackTypesForProject(project).map((trackType) => {
    if (trackType === 'ax_mvp') {
      const src = finalizedMvpSource(project.id)
      return {
        trackType,
        sourceDesignType: 'mvp_design' as const,
        available: src !== null,
        reason: src ? '' : 'AX MVP 설계를 먼저 확정해야 실제 사용 테스트를 시작할 수 있습니다.',
        sourceDesignId: src?.designId ?? '',
        sourceDesignVersion: src?.designVersion ?? 0,
      }
    }
    const src = finalizedWebsiteSource(project.id)
    return {
      trackType,
      sourceDesignType: 'website_design' as const,
      available: src !== null,
      reason: src ? '' : '홈페이지 설계를 먼저 확정해야 실제 사용 테스트를 시작할 수 있습니다.',
      sourceDesignId: src?.designId ?? '',
      sourceDesignVersion: src?.designVersion ?? 0,
    }
  })
}

/* ------------------------------------------------------------------ */
/* 워크스페이스 생성/조회                                                */
/* ------------------------------------------------------------------ */

function buildDraftInput(project: Project, organization: Organization | null, trackType: ValidationTrackType) {
  if (trackType === 'ax_mvp') {
    const src = finalizedMvpSource(project.id)
    if (!src) throw new ValidationBlockedError('확정된 AX MVP 설계가 없습니다.')
    return buildWorkspaceDraft({
      project,
      organization,
      trackType,
      sourceDesignType: 'mvp_design',
      sourceDesignId: src.designId,
      sourceDesignVersion: src.designVersion,
      mvpHandoff: src.handoff,
      websiteHandoff: null,
      createdBy: CURRENT_USER.name,
    })
  }
  const src = finalizedWebsiteSource(project.id)
  if (!src) throw new ValidationBlockedError('확정된 홈페이지 설계가 없습니다.')
  return buildWorkspaceDraft({
    project,
    organization,
    trackType,
    sourceDesignType: 'website_design',
    sourceDesignId: src.designId,
    sourceDesignVersion: src.designVersion,
    mvpHandoff: null,
    websiteHandoff: src.handoff,
    createdBy: CURRENT_USER.name,
  })
}

/** 트랙별 최신 진행 워크스페이스를 확보한다 (없으면 확정 설계로부터 생성). */
export function ensureWorkspace(projectId: string, trackType: ValidationTrackType): ValidationWorkspace {
  const project = projectRepository.getById(projectId)
  if (!project) throw new ValidationBlockedError('프로젝트를 찾을 수 없습니다.')
  if (!trackTypesForProject(project).includes(trackType)) {
    throw new ValidationBlockedError('이 프로젝트에서 지원하지 않는 트랙입니다.')
  }
  const existing = validationWorkspaceRepository.getLatestByProjectAndTrack(projectId, trackType)
  if (existing && existing.status !== 'finalized' && existing.status !== 'superseded') {
    return existing
  }
  const organization = organizationRepository.getById(project.organizationId)
  const draft = buildDraftInput(project, organization, trackType)
  const created = validationWorkspaceRepository.create(draft)
  activityRepository.add({
    organizationId: project.organizationId,
    projectId,
    activityType: 'project_updated',
    title: `실제 사용 테스트(${TRACK_META[trackType].label}) 워크스페이스가 생성되었습니다.`,
    description: `필수 시나리오 ${created.scenarios.filter((s) => s.required).length}개 · 규칙 v${VALIDATION_RULE_VERSION}`,
    actorName: CURRENT_USER.name,
  })
  return created
}

/** 새 버전 생성 (확정본이 있어도 강제로 새 초안을 만든다) */
export function createNewVersion(projectId: string, trackType: ValidationTrackType): ValidationWorkspace {
  const project = projectRepository.getById(projectId)
  if (!project) throw new ValidationBlockedError('프로젝트를 찾을 수 없습니다.')
  const organization = organizationRepository.getById(project.organizationId)
  const draft = buildDraftInput(project, organization, trackType)
  return validationWorkspaceRepository.create(draft)
}

export function getWorkspace(id: string): ValidationWorkspace | null {
  return validationWorkspaceRepository.getById(id)
}

/* ------------------------------------------------------------------ */
/* 편집 공통                                                            */
/* ------------------------------------------------------------------ */

function load(workspaceId: string): ValidationWorkspace {
  const w = validationWorkspaceRepository.getById(workspaceId)
  if (!w) throw new ValidationEditError('검증 워크스페이스를 찾을 수 없습니다.')
  return w
}

function assertEditable(w: ValidationWorkspace): void {
  if (w.status === 'finalized' || w.status === 'superseded') {
    throw new ValidationEditError('확정된 검증은 수정할 수 없습니다. 새 버전을 만드세요.')
  }
}

/** 파생 품질검사를 재계산하며 저장한다. */
function saveWith(w: ValidationWorkspace, patch: Partial<ValidationWorkspace>): ValidationWorkspace {
  const merged = { ...w, ...patch }
  const qualityChecks = runValidationQuality(merged)
  return validationWorkspaceRepository.update(w.id, { ...patch, qualityChecks })
}

/* ------------------------------------------------------------------ */
/* 계획 편집                                                            */
/* ------------------------------------------------------------------ */

export function updatePlan(workspaceId: string, patch: Partial<ValidationPlan>): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  return saveWith(w, { plan: { ...w.plan, ...patch } })
}

export function updateBasics(
  workspaceId: string,
  patch: Partial<Pick<ValidationWorkspace, 'title' | 'objective' | 'targetUsers' | 'assumptions' | 'risks' | 'openQuestions'>>,
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  return saveWith(w, patch)
}

/* ------------------------------------------------------------------ */
/* 제작물(테스트 버전) 편집                                             */
/* ------------------------------------------------------------------ */

export function addBuildArtifact(
  workspaceId: string,
  input: Pick<BuildArtifact, 'name' | 'version' | 'type' | 'url' | 'accessMethod' | 'environment' | 'releaseNotes' | 'knownLimitations'>,
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const ts = nowIso()
  const artifact: BuildArtifact = {
    id: generateId(),
    type: input.type,
    name: input.name,
    version: input.version,
    url: input.url,
    accessMethod: input.accessMethod,
    environment: input.environment,
    releaseNotes: input.releaseNotes,
    knownLimitations: input.knownLimitations,
    sourceCommit: '',
    deployedAt: '',
    status: 'ready_for_test',
    isCurrent: w.buildArtifacts.length === 0,
    createdAt: ts,
    updatedAt: ts,
  }
  return saveWith(w, { buildArtifacts: [...w.buildArtifacts, artifact] })
}

export function updateBuildArtifact(
  workspaceId: string,
  artifactId: string,
  patch: Partial<Pick<BuildArtifact, 'name' | 'version' | 'type' | 'url' | 'accessMethod' | 'environment' | 'releaseNotes' | 'knownLimitations' | 'status'>>,
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const buildArtifacts = w.buildArtifacts.map((b) => (b.id === artifactId ? { ...b, ...patch, updatedAt: nowIso() } : b))
  return saveWith(w, { buildArtifacts })
}

/** 활성 테스트 버전 지정 — 하나만 isCurrent */
export function setCurrentBuild(workspaceId: string, artifactId: string): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const buildArtifacts = w.buildArtifacts.map((b) => ({ ...b, isCurrent: b.id === artifactId, updatedAt: nowIso() }))
  return saveWith(w, { buildArtifacts })
}

export function removeBuildArtifact(workspaceId: string, artifactId: string): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const remaining = w.buildArtifacts.filter((b) => b.id !== artifactId)
  // 활성 버전이 삭제되면 첫 번째를 활성으로
  if (remaining.length > 0 && !remaining.some((b) => b.isCurrent)) {
    remaining[0] = { ...remaining[0], isCurrent: true }
  }
  return saveWith(w, { buildArtifacts: remaining })
}

/* ------------------------------------------------------------------ */
/* 참여자 편집                                                          */
/* ------------------------------------------------------------------ */

export function addParticipant(
  workspaceId: string,
  input: Pick<ValidationParticipant, 'name' | 'role' | 'organization' | 'contactNote' | 'consentStatus' | 'expertise'>,
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const participant: ValidationParticipant = {
    id: generateId(),
    name: input.name,
    role: input.role,
    organization: input.organization,
    contactNote: input.contactNote,
    consentStatus: input.consentStatus,
    expertise: input.expertise,
    assignedScenarioIds: [],
    status: 'invited',
    notes: '',
    createdAt: nowIso(),
  }
  return saveWith(w, { participants: [...w.participants, participant] })
}

export function updateParticipant(
  workspaceId: string,
  participantId: string,
  patch: Partial<Pick<ValidationParticipant, 'name' | 'role' | 'organization' | 'contactNote' | 'consentStatus' | 'expertise' | 'assignedScenarioIds' | 'status' | 'notes'>>,
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const participants = w.participants.map((p) => (p.id === participantId ? { ...p, ...patch } : p))
  return saveWith(w, { participants })
}

export function removeParticipant(workspaceId: string, participantId: string): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  return saveWith(w, { participants: w.participants.filter((p) => p.id !== participantId) })
}

/* ------------------------------------------------------------------ */
/* 시나리오 편집                                                        */
/* ------------------------------------------------------------------ */

function reindex<T extends { orderIndex: number }>(list: T[]): T[] {
  return list.map((item, i) => ({ ...item, orderIndex: i }))
}

export function addScenario(
  workspaceId: string,
  input: Pick<ValidationScenario, 'title' | 'description' | 'type' | 'priority' | 'passRule' | 'required'> & Partial<Pick<ValidationScenario, 'preconditions' | 'steps' | 'expectedResult' | 'measurementMethod' | 'requiredEvidence'>>,
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const ts = nowIso()
  const scenario: ValidationScenario = {
    id: generateId(),
    sourceScenarioId: '',
    sourceCriterionIds: [],
    title: input.title,
    description: input.description,
    type: input.type,
    priority: input.priority,
    targetRoles: [],
    preconditions: input.preconditions ?? '',
    steps: input.steps ?? [],
    expectedResult: input.expectedResult ?? input.description,
    measurementMethod: input.measurementMethod ?? '관찰·기록',
    requiredEvidence: input.requiredEvidence ?? '',
    passRule: input.passRule,
    required: input.required,
    status: 'ready',
    orderIndex: w.scenarios.length,
    createdAt: ts,
    updatedAt: ts,
    archivedAt: null,
  }
  return saveWith(w, { scenarios: reindex([...w.scenarios, scenario]) })
}

export function updateScenario(
  workspaceId: string,
  scenarioId: string,
  patch: Partial<Pick<ValidationScenario, 'title' | 'description' | 'type' | 'priority' | 'preconditions' | 'steps' | 'expectedResult' | 'measurementMethod' | 'requiredEvidence' | 'passRule' | 'required' | 'status' | 'targetRoles'>>,
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const scenarios = w.scenarios.map((s) => (s.id === scenarioId ? { ...s, ...patch, updatedAt: nowIso() } : s))
  return saveWith(w, { scenarios })
}

export function duplicateScenario(workspaceId: string, scenarioId: string): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const src = w.scenarios.find((s) => s.id === scenarioId)
  if (!src) throw new ValidationEditError('시나리오를 찾을 수 없습니다.')
  const ts = nowIso()
  const copy: ValidationScenario = {
    ...src,
    id: generateId(),
    sourceScenarioId: '',
    title: `${src.title} 사본`,
    orderIndex: w.scenarios.length,
    createdAt: ts,
    updatedAt: ts,
    archivedAt: null,
  }
  return saveWith(w, { scenarios: reindex([...w.scenarios, copy]) })
}

/** 완료된 회차에서 실행된 시나리오는 삭제하지 않고 은퇴(retired) 처리 */
export function retireScenario(workspaceId: string, scenarioId: string): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const scenarios = w.scenarios.map((s) => (s.id === scenarioId ? { ...s, status: 'retired' as const, updatedAt: nowIso(), archivedAt: nowIso() } : s))
  return saveWith(w, { scenarios })
}

export function moveScenario(workspaceId: string, scenarioId: string, direction: 'up' | 'down'): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const sorted = [...w.scenarios].sort((a, b) => a.orderIndex - b.orderIndex)
  const idx = sorted.findIndex((s) => s.id === scenarioId)
  if (idx < 0) return w
  const swap = direction === 'up' ? idx - 1 : idx + 1
  if (swap < 0 || swap >= sorted.length) return w
  ;[sorted[idx], sorted[swap]] = [sorted[swap], sorted[idx]]
  return saveWith(w, { scenarios: reindex(sorted) })
}

/* ------------------------------------------------------------------ */
/* 회차·실행 편집 (완료 회차 원본은 보존)                                */
/* ------------------------------------------------------------------ */

export function createRound(
  workspaceId: string,
  input: Pick<ValidationRound, 'name' | 'objective'> & Partial<Pick<ValidationRound, 'buildArtifactId' | 'participantIds' | 'scenarioIds' | 'scheduledAt' | 'facilitatorId'>>,
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const ts = nowIso()
  const current = w.buildArtifacts.find((b) => b.isCurrent)
  const round: ValidationRound = {
    id: generateId(),
    workspaceId: w.id,
    roundNumber: w.rounds.reduce((m, r) => Math.max(m, r.roundNumber), 0) + 1,
    name: input.name,
    objective: input.objective,
    buildArtifactId: input.buildArtifactId ?? current?.id ?? null,
    participantIds: input.participantIds ?? [],
    scenarioIds: input.scenarioIds ?? w.scenarios.filter((s) => s.required && s.status !== 'retired').map((s) => s.id),
    scheduledAt: input.scheduledAt ?? '',
    startedAt: null,
    completedAt: null,
    status: 'planned',
    facilitatorId: input.facilitatorId ?? '',
    environmentNotes: '',
    summary: '',
    scenarioRuns: [],
    createdAt: ts,
    updatedAt: ts,
  }
  return saveWith(w, { rounds: [...w.rounds, round] })
}

function mutateRound(w: ValidationWorkspace, roundId: string, fn: (r: ValidationRound) => ValidationRound): ValidationRound[] {
  return w.rounds.map((r) => (r.id === roundId ? { ...fn(r), updatedAt: nowIso() } : r))
}

function assertRoundEditable(round: ValidationRound): void {
  if (round.status === 'completed' || round.status === 'cancelled') {
    throw new ValidationEditError('완료·취소된 회차의 결과는 수정할 수 없습니다. 새 회차를 만드세요.')
  }
}

export function updateRound(
  workspaceId: string,
  roundId: string,
  patch: Partial<Pick<ValidationRound, 'name' | 'objective' | 'buildArtifactId' | 'participantIds' | 'scenarioIds' | 'scheduledAt' | 'facilitatorId' | 'environmentNotes' | 'summary'>>,
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const round = w.rounds.find((r) => r.id === roundId)
  if (!round) throw new ValidationEditError('회차를 찾을 수 없습니다.')
  assertRoundEditable(round)
  return saveWith(w, { rounds: mutateRound(w, roundId, (r) => ({ ...r, ...patch })) })
}

export function startRound(workspaceId: string, roundId: string): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const result = saveWith(w, { rounds: mutateRound(w, roundId, (r) => ({ ...r, status: 'in_progress', startedAt: r.startedAt ?? nowIso() })) })
  if (w.status === 'ready' || w.status === 'draft') validationWorkspaceRepository.startTesting(w.id)
  return validationWorkspaceRepository.getById(result.id) ?? result
}

export function completeRound(workspaceId: string, roundId: string, summary: string): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const round = w.rounds.find((r) => r.id === roundId)
  if (!round) throw new ValidationEditError('회차를 찾을 수 없습니다.')
  return saveWith(w, {
    rounds: mutateRound(w, roundId, (r) => ({ ...r, status: 'completed', completedAt: nowIso(), summary })),
  })
}

export function cancelRound(workspaceId: string, roundId: string): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  return saveWith(w, { rounds: mutateRound(w, roundId, (r) => ({ ...r, status: 'cancelled' })) })
}

/** 시나리오 실행 결과 기록 (진행 중 회차에만) — 근거 없는 통과 금지: 결과·관찰 기록 필요 */
export function recordScenarioRun(
  workspaceId: string,
  roundId: string,
  input: Pick<ScenarioRun, 'scenarioId' | 'participantId' | 'result'> & Partial<Pick<ScenarioRun, 'observedBehavior' | 'actualResult' | 'timeSpentMinutes' | 'errorCount' | 'assistanceNeeded' | 'conditionRemaining' | 'notes' | 'evidenceArtifactIds'>>,
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const round = w.rounds.find((r) => r.id === roundId)
  if (!round) throw new ValidationEditError('회차를 찾을 수 없습니다.')
  assertRoundEditable(round)
  const existing = round.scenarioRuns.find((x) => x.scenarioId === input.scenarioId && x.participantId === input.participantId)
  const run: ScenarioRun = {
    id: existing?.id ?? generateId(),
    roundId,
    scenarioId: input.scenarioId,
    participantId: input.participantId,
    result: input.result,
    startedAt: existing?.startedAt ?? nowIso(),
    completedAt: input.result === 'not_run' ? null : nowIso(),
    observedBehavior: input.observedBehavior ?? existing?.observedBehavior ?? '',
    actualResult: input.actualResult ?? existing?.actualResult ?? '',
    timeSpentMinutes: input.timeSpentMinutes ?? existing?.timeSpentMinutes ?? null,
    errorCount: input.errorCount ?? existing?.errorCount ?? null,
    assistanceNeeded: input.assistanceNeeded ?? existing?.assistanceNeeded ?? false,
    conditionRemaining: input.conditionRemaining ?? existing?.conditionRemaining ?? '',
    conditionOwnerId: existing?.conditionOwnerId ?? '',
    evidenceArtifactIds: input.evidenceArtifactIds ?? existing?.evidenceArtifactIds ?? [],
    feedbackItemIds: existing?.feedbackItemIds ?? [],
    notes: input.notes ?? existing?.notes ?? '',
    recordedBy: CURRENT_USER.name,
  }
  const scenarioRuns = existing
    ? round.scenarioRuns.map((x) => (x.id === existing.id ? run : x))
    : [...round.scenarioRuns, run]
  return saveWith(w, { rounds: mutateRound(w, roundId, (r) => ({ ...r, scenarioRuns })) })
}

/* ------------------------------------------------------------------ */
/* 피드백 편집 (의견) — 이슈(증거·재현)와 구분                           */
/* ------------------------------------------------------------------ */

export function addFeedback(
  workspaceId: string,
  input: Pick<FeedbackItem, 'type' | 'severity' | 'title' | 'description'> & Partial<Pick<FeedbackItem, 'roundId' | 'scenarioRunId' | 'participantId' | 'context' | 'source'>>,
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const ts = nowIso()
  const item: FeedbackItem = {
    id: generateId(),
    workspaceId: w.id,
    roundId: input.roundId ?? null,
    scenarioRunId: input.scenarioRunId ?? null,
    participantId: input.participantId ?? null,
    type: input.type,
    severity: input.severity,
    title: input.title,
    description: input.description,
    context: input.context ?? '',
    source: input.source ?? 'facilitator',
    relatedFeatureIds: [],
    relatedScreenIds: [],
    relatedPageIds: [],
    relatedSectionIds: [],
    evidenceArtifactIds: [],
    status: 'new',
    ownerId: '',
    dueDate: '',
    resolution: '',
    createdAt: ts,
    updatedAt: ts,
  }
  return saveWith(w, { feedbackItems: [...w.feedbackItems, item] })
}

export function updateFeedback(
  workspaceId: string,
  feedbackId: string,
  patch: Partial<Pick<FeedbackItem, 'type' | 'severity' | 'title' | 'description' | 'context' | 'status' | 'ownerId' | 'dueDate' | 'resolution'>>,
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const feedbackItems = w.feedbackItems.map((f) => (f.id === feedbackId ? { ...f, ...patch, updatedAt: nowIso() } : f))
  return saveWith(w, { feedbackItems })
}

export function removeFeedback(workspaceId: string, feedbackId: string): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  return saveWith(w, { feedbackItems: w.feedbackItems.filter((f) => f.id !== feedbackId) })
}

/** 여러 피드백을 하나로 병합 (원본은 duplicate 처리로 보존) */
export function mergeFeedback(workspaceId: string, sourceIds: string[], targetId: string): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const feedbackItems = w.feedbackItems.map((f) => {
    if (sourceIds.includes(f.id) && f.id !== targetId) return { ...f, status: 'duplicate' as const, updatedAt: nowIso() }
    return f
  })
  return saveWith(w, { feedbackItems })
}

/* ------------------------------------------------------------------ */
/* 이슈 편집 (증거·재현) — critical은 확정을 막는다                      */
/* ------------------------------------------------------------------ */

export function createIssueFromFeedback(workspaceId: string, feedbackId: string): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const fb = w.feedbackItems.find((f) => f.id === feedbackId)
  if (!fb) throw new ValidationEditError('피드백을 찾을 수 없습니다.')
  const ts = nowIso()
  const issue: ValidationIssue = {
    id: generateId(),
    workspaceId: w.id,
    sourceFeedbackIds: [feedbackId],
    type: 'defect',
    severity: fb.severity,
    title: fb.title,
    description: fb.description,
    reproductionSteps: '',
    expectedBehavior: '',
    actualBehavior: '',
    impact: '',
    ownerId: '',
    status: 'open',
    resolutionPlan: '',
    dueDate: '',
    resolvedAt: null,
    acceptedRiskReason: '',
    acceptedRiskApprovedBy: '',
    evidenceArtifactIds: [...fb.evidenceArtifactIds],
    createdAt: ts,
    updatedAt: ts,
  }
  const feedbackItems = w.feedbackItems.map((f) => (f.id === feedbackId ? { ...f, status: 'planned' as const, updatedAt: ts } : f))
  return saveWith(w, { issues: [...w.issues, issue], feedbackItems })
}

export function addIssue(
  workspaceId: string,
  input: Pick<ValidationIssue, 'type' | 'severity' | 'title' | 'description'> & Partial<Pick<ValidationIssue, 'reproductionSteps' | 'expectedBehavior' | 'actualBehavior' | 'impact'>>,
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const ts = nowIso()
  const issue: ValidationIssue = {
    id: generateId(),
    workspaceId: w.id,
    sourceFeedbackIds: [],
    type: input.type,
    severity: input.severity,
    title: input.title,
    description: input.description,
    reproductionSteps: input.reproductionSteps ?? '',
    expectedBehavior: input.expectedBehavior ?? '',
    actualBehavior: input.actualBehavior ?? '',
    impact: input.impact ?? '',
    ownerId: '',
    status: 'open',
    resolutionPlan: '',
    dueDate: '',
    resolvedAt: null,
    acceptedRiskReason: '',
    acceptedRiskApprovedBy: '',
    evidenceArtifactIds: [],
    createdAt: ts,
    updatedAt: ts,
  }
  return saveWith(w, { issues: [...w.issues, issue] })
}

export function updateIssue(
  workspaceId: string,
  issueId: string,
  patch: Partial<Pick<ValidationIssue, 'type' | 'severity' | 'title' | 'description' | 'reproductionSteps' | 'expectedBehavior' | 'actualBehavior' | 'impact' | 'ownerId' | 'status' | 'resolutionPlan' | 'dueDate' | 'acceptedRiskReason' | 'acceptedRiskApprovedBy'>>,
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const issues = w.issues.map((i) => {
    if (i.id !== issueId) return i
    const next = { ...i, ...patch, updatedAt: nowIso() }
    if ((patch.status === 'fixed' || patch.status === 'verified') && !i.resolvedAt) next.resolvedAt = nowIso()
    return next
  })
  return saveWith(w, { issues })
}

export function removeIssue(workspaceId: string, issueId: string): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  return saveWith(w, { issues: w.issues.filter((i) => i.id !== issueId) })
}

/* ------------------------------------------------------------------ */
/* 증빙 (메타데이터만 — 실제 파일 저장 금지)                             */
/* ------------------------------------------------------------------ */

export function addEvidence(
  workspaceId: string,
  input: Pick<EvidenceArtifact, 'type' | 'title' | 'description'> & Partial<Pick<EvidenceArtifact, 'fileName' | 'mimeType' | 'sizeBytes' | 'externalUrl' | 'relatedRoundId' | 'relatedIssueIds' | 'relatedFeedbackIds'>>,
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const evidence: EvidenceArtifact = {
    id: generateId(),
    type: input.type,
    title: input.title,
    description: input.description,
    fileName: input.fileName ?? '',
    mimeType: input.mimeType ?? '',
    sizeBytes: input.sizeBytes ?? null,
    externalUrl: input.externalUrl ?? '',
    capturedAt: nowIso(),
    capturedBy: CURRENT_USER.name,
    relatedRoundId: input.relatedRoundId ?? null,
    relatedScenarioRunIds: [],
    relatedFeedbackIds: input.relatedFeedbackIds ?? [],
    relatedIssueIds: input.relatedIssueIds ?? [],
    metadataOnly: true,
    createdAt: nowIso(),
  }
  return saveWith(w, { evidenceArtifacts: [...w.evidenceArtifacts, evidence] })
}

export function removeEvidence(workspaceId: string, evidenceId: string): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  return saveWith(w, { evidenceArtifacts: w.evidenceArtifacts.filter((e) => e.id !== evidenceId) })
}

/* ------------------------------------------------------------------ */
/* KPI 편집 — 측정값 없으면 '측정 필요', 근거 없는 숫자 금지             */
/* ------------------------------------------------------------------ */

export function updateMetric(
  workspaceId: string,
  metricId: string,
  patch: Partial<Pick<ValidationMetricDefinition, 'name' | 'description' | 'unit' | 'baselineValue' | 'targetValue' | 'measurementMethod' | 'measurementSource' | 'frequency' | 'ownerRole' | 'required' | 'direction'>>,
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const metricDefinitions = w.metricDefinitions.map((m) => (m.id === metricId ? { ...m, ...patch } : m))
  return saveWith(w, { metricDefinitions })
}

export function addMetric(
  workspaceId: string,
  input: Pick<ValidationMetricDefinition, 'name' | 'direction' | 'required'> & Partial<Pick<ValidationMetricDefinition, 'description' | 'unit' | 'baselineValue' | 'targetValue' | 'measurementMethod' | 'measurementSource' | 'frequency' | 'ownerRole'>>,
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const metric: ValidationMetricDefinition = {
    id: generateId(),
    sourceKpiId: '',
    name: input.name,
    description: input.description ?? '',
    unit: input.unit ?? '',
    baselineValue: input.baselineValue ?? '',
    targetValue: input.targetValue ?? '',
    measurementMethod: input.measurementMethod ?? '현장 측정 필요',
    measurementSource: input.measurementSource ?? '',
    frequency: input.frequency ?? '회차별',
    ownerRole: input.ownerRole ?? '',
    required: input.required,
    direction: input.direction,
  }
  return saveWith(w, { metricDefinitions: [...w.metricDefinitions, metric] })
}

export function removeMetric(workspaceId: string, metricId: string): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const metricDefinitions = w.metricDefinitions.filter((m) => m.id !== metricId)
  const metricMeasurements = w.metricMeasurements.filter((m) => m.metricId !== metricId)
  return saveWith(w, { metricDefinitions, metricMeasurements })
}

export function recordMeasurement(
  workspaceId: string,
  input: Pick<ValidationMetricMeasurement, 'metricId' | 'value' | 'unit'> & Partial<Pick<ValidationMetricMeasurement, 'roundId' | 'notes'>>,
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const measurement: ValidationMetricMeasurement = {
    id: generateId(),
    metricId: input.metricId,
    roundId: input.roundId ?? null,
    value: input.value,
    unit: input.unit,
    measuredAt: nowIso(),
    measuredBy: CURRENT_USER.name,
    evidenceArtifactIds: [],
    notes: input.notes ?? '',
  }
  return saveWith(w, { metricMeasurements: [...w.metricMeasurements, measurement] })
}

/* ------------------------------------------------------------------ */
/* Gate 판정 (자동 초안 보존 + 담당자 최종 판정)                         */
/* ------------------------------------------------------------------ */

export function updateGateCriterion(
  workspaceId: string,
  gate: ValidationGateNumber,
  criterionId: string,
  status: GateCriterionStatus,
  notes = '',
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const gateReviews = w.gateReviews.map((g) => {
    if (g.gate !== gate) return g
    const criteria = g.criteria.map((c) => (c.id === criterionId ? { ...c, status, notes } : c))
    return { ...g, criteria }
  })
  return saveWith(w, { gateReviews })
}

export function setGateStatus(
  workspaceId: string,
  gate: ValidationGateNumber,
  status: ValidationGateStatus,
  patch: Partial<{ summary: string; conditions: string; nextAction: string; waiverReason: string; approvedBy: string }> = {},
): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const guard = canSetGateStatus(w, gate, status)
  if (!guard.ok) throw new ValidationEditError(guard.reason)
  const gateReviews = w.gateReviews.map((g) =>
    g.gate === gate
      ? {
          ...g,
          status,
          summary: patch.summary ?? g.summary,
          conditions: patch.conditions ?? g.conditions,
          nextAction: patch.nextAction ?? g.nextAction,
          waiverReason: patch.waiverReason ?? g.waiverReason,
          approvedBy: patch.approvedBy ?? g.approvedBy,
          reviewerId: CURRENT_USER.name,
          reviewedAt: nowIso(),
          autoDraftStatus: autoDraftGateStatus(w, gate),
          version: g.version + 1,
        }
      : g,
  )
  return saveWith(w, { gateReviews })
}

/** 규칙 기반 자동 초안으로 모든 Gate 상태를 새로고침 (담당자 확정 전 참고용) */
export function refreshGateDrafts(workspaceId: string): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const gateReviews = w.gateReviews.map((g) => ({ ...g, autoDraftStatus: autoDraftGateStatus(w, g.gate) }))
  return saveWith(w, { gateReviews })
}

/* ------------------------------------------------------------------ */
/* 최종 결정 — 확대·운영 전환은 강한 조건 필요                           */
/* ------------------------------------------------------------------ */

export function updateFinalDecision(workspaceId: string, patch: Partial<ValidationFinalDecision>): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const nextDecision = { ...w.finalDecision, ...patch }
  const strict = nextDecision.type === 'expand_scope' || nextDecision.type === 'prepare_operation'
  if (strict) {
    const gate6 = w.gateReviews.find((g) => g.gate === 'gate_6')
    const gate6Passed = gate6?.status === 'passed' || gate6?.status === 'conditional_pass'
    const stat = requiredPassStat(w)
    if (!gate6Passed || hasOpenCritical(w) || stat.passRate < 80 || w.metricMeasurements.length === 0) {
      throw new ValidationEditError('범위 확대·운영 전환은 Gate 6 통과·critical 0·필수 통과율 80%↑·KPI 측정 증거가 있어야 선택할 수 있습니다.')
    }
  }
  if (nextDecision.type && !nextDecision.decidedAt) nextDecision.decidedAt = nowIso()
  return saveWith(w, { finalDecision: nextDecision })
}

/* ------------------------------------------------------------------ */
/* 라이프사이클                                                         */
/* ------------------------------------------------------------------ */

export function markReviewed(workspaceId: string): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  return validationWorkspaceRepository.update(w.id, { status: 'ready', reviewedBy: CURRENT_USER.name, reviewedAt: nowIso() })
}

export function markEvaluating(workspaceId: string): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  return validationWorkspaceRepository.markEvaluating(w.id)
}

export interface FinalizeCheck {
  ok: boolean
  reasons: string[]
}

export function checkCanFinalize(w: ValidationWorkspace): FinalizeCheck {
  const checks = runValidationQuality(w)
  const reasons = checks.filter((c) => c.severity === 'error' && !c.passed).map((c) => `${c.title}: ${c.description}`)
  return { ok: reasons.length === 0, reasons }
}

/** 검증 확정 — 품질검사 error 없음, critical 이슈 없음, 회차 완료 필요 (근거 없는 성공 금지). */
export function finalizeWorkspace(workspaceId: string): ValidationWorkspace {
  const w = load(workspaceId)
  if (w.status === 'finalized') return w
  const checks = runValidationQuality(w)
  if (hasBlockingErrors(checks)) {
    throw new ValidationBlockedError(checks.filter((c) => c.severity === 'error' && !c.passed).map((c) => c.title).join(', '))
  }
  // 최신 품질검사 저장 후 확정
  validationWorkspaceRepository.update(w.id, { qualityChecks: checks })
  const finalized = validationWorkspaceRepository.finalize(w.id, CURRENT_USER.name)
  const snapshot = buildValidationHandoff(finalized, nowIso())
  validationHandoffRepository.replaceForWorkspace(finalized.id, snapshot)
  activityRepository.add({
    organizationId: finalized.organizationId,
    projectId: finalized.projectId,
    activityType: 'status_changed',
    title: `실제 사용 테스트(${TRACK_META[finalized.trackType].label}) 결과가 확정되었습니다.`,
    description: `최종 결정: ${finalized.finalDecision.type ?? '미정'} · 규칙 v${VALIDATION_RULE_VERSION}`,
    actorName: CURRENT_USER.name,
  })
  return finalized
}

/* ------------------------------------------------------------------ */
/* 재검증 필요·요약                                                     */
/* ------------------------------------------------------------------ */

/** 출처 설계가 새 버전으로 확정되었는지 (재검증 필요 판정) */
export function needsRevalidation(w: ValidationWorkspace): boolean {
  if (w.ruleVersion !== VALIDATION_RULE_VERSION) return true
  const src = w.trackType === 'ax_mvp' ? finalizedMvpSource(w.projectId) : finalizedWebsiteSource(w.projectId)
  if (!src) return false
  return computeValidationHash(src.designId, src.designVersion) !== w.sourceSnapshotHash
}

export function summarize(w: ValidationWorkspace): ValidationSummary {
  return buildValidationSummary(w)
}

/* ------------------------------------------------------------------ */
/* 조회 컨텍스트·대시보드                                                */
/* ------------------------------------------------------------------ */

export interface TrackContext {
  trackType: ValidationTrackType
  eligibility: TrackEligibility
  workspace: ValidationWorkspace | null
  summary: ValidationSummary | null
  needsRevalidationFlag: boolean
}

export interface ProjectValidationContext {
  project: Project
  organization: Organization | null
  tracks: TrackContext[]
}

export function getProjectValidationContext(projectId: string): ProjectValidationContext | null {
  const project = projectRepository.getById(projectId)
  if (!project) return null
  const eligibilities = getValidationEligibility(project)
  const tracks: TrackContext[] = eligibilities.map((eligibility) => {
    const workspace = validationWorkspaceRepository.getLatestByProjectAndTrack(projectId, eligibility.trackType)
    return {
      trackType: eligibility.trackType,
      eligibility,
      workspace,
      summary: workspace ? buildValidationSummary(workspace) : null,
      needsRevalidationFlag: workspace ? needsRevalidation(workspace) : false,
    }
  })
  return {
    project,
    organization: organizationRepository.getById(project.organizationId),
    tracks,
  }
}

export interface ValidationPendingCounts {
  preparing: number
  testing: number
  criticalIssues: number
}

/** 대시보드 KPI: 테스트 준비/테스트 중/중대 이슈 (프로젝트 단위) */
export function countValidationPending(): ValidationPendingCounts {
  let preparing = 0
  let testing = 0
  let criticalIssues = 0
  for (const project of projectRepository.getAll()) {
    if (project.status === 'archived') continue
    const eligibilities = getValidationEligibility(project)
    for (const el of eligibilities) {
      if (!el.available) continue
      const w = validationWorkspaceRepository.getLatestByProjectAndTrack(project.id, el.trackType)
      if (!w || w.status === 'draft' || w.status === 'ready') {
        preparing += 1
      } else if (w.status === 'testing' || w.status === 'evaluating') {
        testing += 1
      }
      if (w && hasOpenCritical(w)) criticalIssues += 1
    }
  }
  return { preparing, testing, criticalIssues }
}

/* ------------------------------------------------------------------ */
/* 로컬 테스트 세션 (localStorage 로컬 전용 · 외부 전송 없음)             */
/* ------------------------------------------------------------------ */

/** 로컬 테스트 링크 생성 — 고엔트로피 토큰(24바이트). 이메일·SMS 발송 없음. */
export function createTestSession(
  workspaceId: string,
  participantName: string,
  scenarioIds: string[],
): ValidationTestSession {
  const w = load(workspaceId)
  const token = generateUniqueAccessToken((t) => validationTestSessionRepository.getByToken(t) !== null)
  return validationTestSessionRepository.create(
    {
      workspaceId: w.id,
      projectId: w.projectId,
      participantName,
      scenarioIds: scenarioIds.length > 0 ? scenarioIds : w.scenarios.filter((s) => s.status !== 'retired').map((s) => s.id),
      status: 'active',
      consented: false,
      consentedAt: null,
      results: [],
      submittedAt: null,
      expiresAt: null,
    },
    token,
  )
}

export interface ResolvedTestSession {
  session: ValidationTestSession
  workspaceTitle: string
  organizationName: string
  scenarios: Pick<ValidationScenario, 'id' | 'title' | 'description' | 'type' | 'preconditions' | 'steps' | 'expectedResult' | 'passRule'>[]
}

/** 토큰으로 로컬 테스트 세션을 해석한다 (참여자 런타임용). */
export function resolveTestSession(accessToken: string): ResolvedTestSession | null {
  const session = validationTestSessionRepository.getByToken(accessToken)
  if (!session) return null
  const w = validationWorkspaceRepository.getById(session.workspaceId)
  if (!w) return null
  const org = organizationRepository.getById(w.organizationId)
  const scenarios = session.scenarioIds
    .map((id) => w.scenarios.find((s) => s.id === id))
    .filter((s): s is ValidationScenario => s !== undefined)
    .map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      type: s.type,
      preconditions: s.preconditions,
      steps: s.steps,
      expectedResult: s.expectedResult,
      passRule: s.passRule,
    }))
  return { session, workspaceTitle: w.title, organizationName: org?.name ?? '', scenarios }
}

/** 참여자 제출 (로컬 전용 저장). 동의 없이는 제출 불가. */
export function submitTestSession(
  accessToken: string,
  consented: boolean,
  results: TestSessionScenarioResult[],
): ValidationTestSession {
  const session = validationTestSessionRepository.getByToken(accessToken)
  if (!session) throw new ValidationEditError('테스트 세션을 찾을 수 없습니다.')
  if (session.status !== 'active') throw new ValidationEditError('이미 종료되었거나 사용할 수 없는 테스트 링크입니다.')
  if (!consented) throw new ValidationEditError('참여 동의가 필요합니다.')
  validationTestSessionRepository.update(session.id, {
    consented: true,
    consentedAt: nowIso(),
    results,
  })
  return validationTestSessionRepository.complete(session.id)
}

export function revokeTestSession(sessionId: string): ValidationTestSession {
  return validationTestSessionRepository.revoke(sessionId)
}

export function listTestSessions(workspaceId: string): ValidationTestSession[] {
  return validationTestSessionRepository.getByWorkspaceId(workspaceId)
}

/** 제출된 로컬 테스트 결과를 워크스페이스 피드백으로 반영 (담당자 확인 후). */
export function importTestSessionFeedback(workspaceId: string, sessionId: string): ValidationWorkspace {
  const w = load(workspaceId)
  assertEditable(w)
  const session = validationTestSessionRepository.getByWorkspaceId(workspaceId).find((s) => s.id === sessionId)
  if (!session) throw new ValidationEditError('테스트 세션을 찾을 수 없습니다.')
  if (session.status !== 'completed') throw new ValidationEditError('제출 완료된 세션만 반영할 수 있습니다.')
  const ts = nowIso()
  const newItems: FeedbackItem[] = []
  session.results.forEach((r) => {
    const scenario = w.scenarios.find((s) => s.id === r.scenarioId)
    const scenarioTitle = scenario?.title ?? '시나리오'
    if (r.errorReport.trim()) {
      newItems.push(mkSessionFeedback(w.id, session.participantName, 'error', r.difficulty === 'hard' ? 'high' : 'medium', `${scenarioTitle} 오류`, r.errorReport, ts))
    }
    if (r.comment.trim()) {
      newItems.push(mkSessionFeedback(w.id, session.participantName, 'usability', 'low', `${scenarioTitle} 의견`, r.comment, ts))
    }
    if (r.positive.trim()) {
      newItems.push(mkSessionFeedback(w.id, session.participantName, 'positive', 'info', `${scenarioTitle} 긍정 피드백`, r.positive, ts))
    }
  })
  if (newItems.length === 0) return w
  return saveWith(w, { feedbackItems: [...w.feedbackItems, ...newItems] })
}

function mkSessionFeedback(
  workspaceId: string,
  participantName: string,
  type: FeedbackItem['type'],
  severity: FeedbackItem['severity'],
  title: string,
  description: string,
  ts: string,
): FeedbackItem {
  return {
    id: generateId(),
    workspaceId,
    roundId: null,
    scenarioRunId: null,
    participantId: null,
    type,
    severity,
    title,
    description: `${description}\n(로컬 테스트 참여자: ${participantName})`,
    context: '로컬 테스트 세션',
    source: 'participant',
    relatedFeatureIds: [],
    relatedScreenIds: [],
    relatedPageIds: [],
    relatedSectionIds: [],
    evidenceArtifactIds: [],
    status: 'new',
    ownerId: '',
    dueDate: '',
    resolution: '',
    createdAt: ts,
    updatedAt: ts,
  }
}

// 사용되는 타입 재노출 (페이지 편의)
export type { ValidationScenarioType, BuildArtifactType }
