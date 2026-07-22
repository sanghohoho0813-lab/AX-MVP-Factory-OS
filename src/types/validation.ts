import type { MvpDesignHandoffSnapshot } from './mvpDesign'
import type { WebsiteDesignHandoffSnapshot } from './websiteDesign'

/* ------------------------------------------------------------------ */
/* 실제 사용 테스트·Stage-Gate 운영 도메인 (Stage 9)                     */
/*                                                                     */
/* 확정된 AX MVP 설계 또는 홈페이지 설계를 테스트 계획·회차·피드백·이슈·  */
/* KPI·Gate 판정·다음 결정으로 연결한다. AX와 홈페이지 결과는 합산하지    */
/* 않으며, 확정 스냅샷은 원본 변경과 무관하게 보존한다.                  */
/* ------------------------------------------------------------------ */

/* A. 트랙 */
export type ValidationTrackType = 'ax_mvp' | 'website'

/* B. 워크스페이스 상태 */
export type ValidationWorkspaceStatus =
  | 'draft'
  | 'ready'
  | 'testing'
  | 'evaluating'
  | 'finalized'
  | 'superseded'

/* C. Gate 번호 */
export type ValidationGateNumber =
  | 'gate_0'
  | 'gate_1'
  | 'gate_2'
  | 'gate_3'
  | 'gate_4'
  | 'gate_5'
  | 'gate_6'
  | 'gate_7'

/* D. Gate 상태 */
export type ValidationGateStatus =
  | 'locked'
  | 'ready'
  | 'in_progress'
  | 'passed'
  | 'conditional_pass'
  | 'failed'
  | 'waived'

/* E. 최종 결정 */
export type ValidationDecisionType =
  | 'continue'
  | 'revise_and_retest'
  | 'expand_scope'
  | 'prepare_operation'
  | 'hold'
  | 'stop'

export type SourceDesignType = 'mvp_design' | 'website_design'

/* G. 가설 */
export type HypothesisSource = 'assessment' | 'selection' | 'mvp_design' | 'website_design' | 'manual'
export type HypothesisPriority = 'critical' | 'high' | 'medium' | 'low'

export interface ValidationHypothesis {
  id: string
  statement: string
  source: HypothesisSource
  evidenceRequired: string
  successCondition: string
  failureCondition: string
  priority: HypothesisPriority
  relatedScenarioIds: string[]
  relatedMetricIds: string[]
}

/* H. 테스트 계획 */
export type TestMethod =
  | 'moderated'
  | 'unmoderated_local'
  | 'observation'
  | 'scenario_test'
  | 'checklist'
  | 'interview'
  | 'mixed'

export interface ValidationPlan {
  purpose: string
  scope: string
  outOfScope: string
  environment: string
  testMethod: TestMethod
  startDate: string
  targetEndDate: string
  ownerId: string
  reviewerIds: string[]
  participantTarget: number
  requiredRounds: number
  entryCriteria: string[]
  exitCriteria: string[]
  privacyNotes: string
  securityNotes: string
  fallbackPlan: string
  notes: string
}

/* I/J. 제작물 */
export type BuildArtifactType = 'prototype' | 'ax_mvp' | 'website_preview' | 'document' | 'spreadsheet' | 'other'
export type BuildArtifactStatus = 'draft' | 'ready_for_test' | 'testing' | 'replaced' | 'archived'

export interface BuildArtifact {
  id: string
  type: BuildArtifactType
  name: string
  version: string
  url: string
  accessMethod: string
  environment: string
  releaseNotes: string
  knownLimitations: string
  sourceCommit: string
  deployedAt: string
  status: BuildArtifactStatus
  isCurrent: boolean
  createdAt: string
  updatedAt: string
}

/* K/L. 참여자 */
export type ValidationParticipantRole =
  | 'owner'
  | 'manager'
  | 'operator'
  | 'reviewer'
  | 'customer'
  | 'external'
  | 'observer'
  | 'other'
export type ParticipantConsentStatus = 'not_required' | 'pending' | 'agreed' | 'declined'
export type ParticipantStatus = 'invited' | 'ready' | 'completed' | 'cancelled'

export interface ValidationParticipant {
  id: string
  name: string
  role: ValidationParticipantRole
  organization: string
  contactNote: string
  consentStatus: ParticipantConsentStatus
  expertise: string
  assignedScenarioIds: string[]
  status: ParticipantStatus
  notes: string
  createdAt: string
}

/* M/N. 시나리오 */
export type ValidationScenarioType =
  | 'happy_path'
  | 'error'
  | 'boundary'
  | 'permission'
  | 'mobile'
  | 'data_quality'
  | 'performance'
  | 'accessibility'
  | 'ai_quality'
  | 'integration'
  | 'conversion'
  | 'content'
  | 'other'
export type ScenarioStatus = 'draft' | 'ready' | 'retired'

export interface ValidationScenario {
  id: string
  sourceScenarioId: string
  sourceCriterionIds: string[]
  title: string
  description: string
  type: ValidationScenarioType
  priority: HypothesisPriority
  targetRoles: ValidationParticipantRole[]
  preconditions: string
  steps: string[]
  expectedResult: string
  measurementMethod: string
  requiredEvidence: string
  passRule: string
  required: boolean
  status: ScenarioStatus
  orderIndex: number
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

/* O/P/Q/R. 회차·실행 */
export type ValidationRoundStatus = 'planned' | 'ready' | 'in_progress' | 'completed' | 'cancelled'

export interface ValidationRound {
  id: string
  workspaceId: string
  roundNumber: number
  name: string
  objective: string
  buildArtifactId: string | null
  participantIds: string[]
  scenarioIds: string[]
  scheduledAt: string
  startedAt: string | null
  completedAt: string | null
  status: ValidationRoundStatus
  facilitatorId: string
  environmentNotes: string
  summary: string
  scenarioRuns: ScenarioRun[]
  createdAt: string
  updatedAt: string
}

export type ScenarioRunResult = 'not_run' | 'passed' | 'conditional' | 'failed' | 'blocked'

export interface ScenarioRun {
  id: string
  roundId: string
  scenarioId: string
  participantId: string
  result: ScenarioRunResult
  startedAt: string | null
  completedAt: string | null
  observedBehavior: string
  actualResult: string
  timeSpentMinutes: number | null
  errorCount: number | null
  assistanceNeeded: boolean
  conditionRemaining: string
  conditionOwnerId: string
  evidenceArtifactIds: string[]
  feedbackItemIds: string[]
  notes: string
  recordedBy: string
}

/* S/T/U. 피드백 */
export type FeedbackType =
  | 'positive'
  | 'confusion'
  | 'request'
  | 'usability'
  | 'data'
  | 'performance'
  | 'error'
  | 'content'
  | 'accessibility'
  | 'trust'
  | 'other'
export type FeedbackSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical'
export type FeedbackSource = 'participant' | 'facilitator' | 'observer' | 'system' | 'manual'
export type FeedbackStatus = 'new' | 'reviewed' | 'accepted' | 'planned' | 'resolved' | 'rejected' | 'duplicate'

export interface FeedbackItem {
  id: string
  workspaceId: string
  roundId: string | null
  scenarioRunId: string | null
  participantId: string | null
  type: FeedbackType
  severity: FeedbackSeverity
  title: string
  description: string
  context: string
  source: FeedbackSource
  relatedFeatureIds: string[]
  relatedScreenIds: string[]
  relatedPageIds: string[]
  relatedSectionIds: string[]
  evidenceArtifactIds: string[]
  status: FeedbackStatus
  ownerId: string
  dueDate: string
  resolution: string
  createdAt: string
  updatedAt: string
}

/* V/W. 이슈 */
export type ValidationIssueType =
  | 'blocker'
  | 'defect'
  | 'data_gap'
  | 'process_gap'
  | 'scope'
  | 'privacy'
  | 'security'
  | 'accessibility'
  | 'integration'
  | 'content'
  | 'adoption'
  | 'other'
export type ValidationIssueStatus =
  | 'open'
  | 'investigating'
  | 'planned'
  | 'fixed'
  | 'verified'
  | 'accepted_risk'
  | 'wont_fix'

export interface ValidationIssue {
  id: string
  workspaceId: string
  sourceFeedbackIds: string[]
  type: ValidationIssueType
  severity: FeedbackSeverity
  title: string
  description: string
  reproductionSteps: string
  expectedBehavior: string
  actualBehavior: string
  impact: string
  ownerId: string
  status: ValidationIssueStatus
  resolutionPlan: string
  dueDate: string
  resolvedAt: string | null
  acceptedRiskReason: string
  acceptedRiskApprovedBy: string
  evidenceArtifactIds: string[]
  createdAt: string
  updatedAt: string
}

/* X/Y. 증빙 (메타데이터만 저장, 실제 파일 저장 금지) */
export type EvidenceArtifactType = 'screenshot' | 'recording' | 'note' | 'document' | 'log' | 'metric' | 'link' | 'other'

export interface EvidenceArtifact {
  id: string
  type: EvidenceArtifactType
  title: string
  description: string
  fileName: string
  mimeType: string
  sizeBytes: number | null
  externalUrl: string
  capturedAt: string
  capturedBy: string
  relatedRoundId: string | null
  relatedScenarioRunIds: string[]
  relatedFeedbackIds: string[]
  relatedIssueIds: string[]
  metadataOnly: boolean
  createdAt: string
}

/* Z/AA. KPI */
export type MetricDirection = 'increase' | 'decrease' | 'maintain' | 'threshold'
export type MetricEvaluationStatus = 'target_met' | 'improving' | 'unchanged' | 'worsened' | 'insufficient_data'

export interface ValidationMetricDefinition {
  id: string
  sourceKpiId: string
  name: string
  description: string
  unit: string
  baselineValue: string
  targetValue: string
  measurementMethod: string
  measurementSource: string
  frequency: string
  ownerRole: string
  required: boolean
  direction: MetricDirection
}

export interface ValidationMetricMeasurement {
  id: string
  metricId: string
  roundId: string | null
  value: string
  unit: string
  measuredAt: string
  measuredBy: string
  evidenceArtifactIds: string[]
  notes: string
}

/* AB/AC. Gate */
export type GateCriterionStatus = 'not_checked' | 'met' | 'partially_met' | 'not_met' | 'waived'

export interface GateCriterion {
  id: string
  title: string
  description: string
  required: boolean
  status: GateCriterionStatus
  evidenceIds: string[]
  waiverReason: string
  approvedBy: string
  notes: string
}

export interface GateReview {
  id: string
  workspaceId: string
  gate: ValidationGateNumber
  status: ValidationGateStatus
  criteria: GateCriterion[]
  summary: string
  conditions: string
  conditionOwnerId: string
  conditionDueDate: string
  waiverReason: string
  approvedBy: string
  reviewerId: string
  reviewedAt: string | null
  nextAction: string
  relatedIssueIds: string[]
  evidenceArtifactIds: string[]
  version: number
  /** 자동 평가 초안(규칙 기반) — 담당자 최종 판정과 함께 보존 */
  autoDraftStatus: ValidationGateStatus
}

/* AD. 최종 결정 */
export interface ValidationFinalDecision {
  type: ValidationDecisionType | null
  summary: string
  rationale: string
  requiredActions: string[]
  ownerId: string
  targetDate: string
  approvedBy: string
  decidedAt: string | null
}

/* AE. 품질검사 */
export type ValidationQualitySeverity = 'info' | 'warning' | 'error'

export interface ValidationQualityCheck {
  id: string
  severity: ValidationQualitySeverity
  title: string
  description: string
  passed: boolean
  relatedIds: string[]
}

/* F. 워크스페이스 (aggregate root) */
export type ValidationHandoffSource = MvpDesignHandoffSnapshot | WebsiteDesignHandoffSnapshot

export interface ValidationWorkspace {
  id: string
  projectId: string
  organizationId: string
  trackType: ValidationTrackType
  version: number
  status: ValidationWorkspaceStatus
  sourceDesignType: SourceDesignType
  sourceDesignId: string
  sourceDesignVersion: number
  sourceHandoffSnapshot: ValidationHandoffSource | null
  sourceSnapshotHash: string
  title: string
  objective: string
  targetUsers: string
  hypotheses: ValidationHypothesis[]
  plan: ValidationPlan
  buildArtifacts: BuildArtifact[]
  participants: ValidationParticipant[]
  scenarios: ValidationScenario[]
  rounds: ValidationRound[]
  feedbackItems: FeedbackItem[]
  issues: ValidationIssue[]
  evidenceArtifacts: EvidenceArtifact[]
  metricDefinitions: ValidationMetricDefinition[]
  metricMeasurements: ValidationMetricMeasurement[]
  gateReviews: GateReview[]
  finalDecision: ValidationFinalDecision
  qualityChecks: ValidationQualityCheck[]
  openQuestions: string[]
  assumptions: string[]
  risks: string[]
  ruleVersion: string
  createdBy: string
  reviewedBy: string
  finalizedBy: string
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
  finalizedAt: string | null
  supersededAt: string | null
}

export type ValidationWorkspaceInput = Omit<ValidationWorkspace, 'id' | 'version' | 'createdAt' | 'updatedAt'>

/* AF. 인계 스냅샷 */
export interface ValidationRoundSummary {
  roundNumber: number
  name: string
  totalScenarios: number
  passed: number
  conditional: number
  failed: number
  blocked: number
}

export interface ValidationHandoffSnapshot {
  id: string
  workspaceId: string
  projectId: string
  organizationId: string
  trackType: ValidationTrackType
  version: number
  sourceDesignId: string
  sourceDesignVersion: number
  objective: string
  hypotheses: string[]
  testedBuild: string
  participants: number
  scenarios: number
  roundSummaries: ValidationRoundSummary[]
  passedCriteria: string[]
  failedCriteria: string[]
  unresolvedIssues: string[]
  metricResults: string[]
  gateResults: { gate: ValidationGateNumber; status: ValidationGateStatus }[]
  finalDecision: ValidationFinalDecision
  evidenceIndex: string[]
  openQuestions: string[]
  risks: string[]
  generatedAt: string
}

export type ValidationHandoffInput = Omit<ValidationHandoffSnapshot, 'id'>

/* 로컬 테스트 세션 (참여자용 런타임 · localStorage 로컬 전용) */
export type TestSessionStatus = 'active' | 'completed' | 'revoked' | 'expired'

export interface TestSessionScenarioResult {
  scenarioId: string
  done: boolean
  difficulty: 'easy' | 'normal' | 'hard' | null
  comment: string
  errorReport: string
  positive: string
}

export interface ValidationTestSession {
  id: string
  workspaceId: string
  projectId: string
  accessToken: string
  participantName: string
  scenarioIds: string[]
  status: TestSessionStatus
  consented: boolean
  consentedAt: string | null
  results: TestSessionScenarioResult[]
  submittedAt: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export type ValidationTestSessionInput = Omit<ValidationTestSession, 'id' | 'accessToken' | 'createdAt' | 'updatedAt'>

export interface ValidationFilters {
  query?: string
  status?: ValidationWorkspaceStatus
  trackType?: ValidationTrackType
}
