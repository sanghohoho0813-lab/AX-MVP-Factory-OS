import type { AssessmentResult } from '../../types/assessment'
import type { Project } from '../../types/domain'
import type {
  AutomationCandidate,
  HandoffCandidateSummary,
  ScopeItem,
  SelectionDecision,
  SelectionHandoffInput,
} from '../../types/selection'
import { DEFAULT_SCOPE_GUARDRAILS } from './scoringConfig'

function summarizeMetrics(c: AutomationCandidate): string[] {
  return c.metrics
    .filter((m) => m.value !== null)
    .map((m) => `${m.label} ${Number(m.value).toLocaleString('ko-KR')}${m.unit}`)
}

function summarizeEffects(c: AutomationCandidate): string[] {
  return c.expectedEffects
    .filter((e) => !e.notEstimable)
    .map((e) =>
      e.qualitative
        ? e.title
        : `${e.title} ${e.currentValue !== null ? `${e.currentValue}→${e.expectedValue}${e.unit}` : ''}`.trim(),
    )
}

function toSummary(c: AutomationCandidate): HandoffCandidateSummary {
  return {
    candidateId: c.id,
    name: c.name,
    taskFamily: c.taskFamily,
    problemStatement: c.problemStatement,
    priorityScore: c.priorityScore,
    quadrant: c.quadrant,
    confidence: c.confidence,
    automationApproach: c.automationApproach,
    aiNecessity: c.aiNecessity,
    recommendedMvpLevel: c.recommendedMvpLevel,
    templateMix: c.templateMix,
    keyMetrics: summarizeMetrics(c),
    keyEffects: summarizeEffects(c),
  }
}

/**
 * 확정 선정에서 Stage 7 인계 스냅샷을 만든다.
 * 확정 시점의 후보 내용을 동결해 이후 원본 변경과 무관하게 보존한다.
 */
export function buildHandoffSnapshot(
  decision: SelectionDecision,
  candidatesById: Map<string, AutomationCandidate>,
  assessment: AssessmentResult,
  project: Project,
  generatedAt: string,
): SelectionHandoffInput {
  const primary = decision.primaryCandidateId
    ? candidatesById.get(decision.primaryCandidateId) ?? null
    : null
  const secondary = decision.secondaryCandidateIds
    .map((id) => candidatesById.get(id))
    .filter((c): c is AutomationCandidate => c !== undefined)
  const rejected = decision.rejectedCandidateIds
    .map((id) => candidatesById.get(id))
    .filter((c): c is AutomationCandidate => c !== undefined)

  const scopeItems: ScopeItem[] = []
  if (primary) scopeItems.push({ label: primary.name, bucket: 'mvp_first' })
  secondary.forEach((c) => scopeItems.push({ label: c.name, bucket: 'phase_two' }))
  rejected.forEach((c) => scopeItems.push({ label: c.name, bucket: 'excluded' }))
  if (primary?.excludedScope) {
    scopeItems.push({ label: primary.excludedScope, bucket: 'excluded' })
  }

  const hasWebsiteTrack = project.projectType === 'ax_website'

  return {
    projectId: project.id,
    organizationId: project.organizationId,
    selectionDecisionId: decision.id,
    selectionVersion: decision.version,
    primaryCandidate: primary ? toSummary(primary) : null,
    secondaryCandidates: secondary.map(toSummary),
    problemDefinition: primary?.problemStatement ?? decision.decisionSummary,
    targetUsers: primary?.users ?? '',
    currentWorkflow: primary?.currentProcess ?? '',
    desiredWorkflow: primary?.desiredProcess ?? '',
    inputData: primary?.inputData ?? '',
    outputResults: primary?.outputResult ?? '',
    dependencies: primary?.dependencies ?? [],
    risks: decision.decisionRisks,
    expectedKpis: decision.expectedPrimaryKpis,
    templateMix: decision.recommendedTemplateMix.length > 0 ? decision.recommendedTemplateMix : (primary?.templateMix ?? []),
    recommendedMvpLevel: decision.recommendedMvpLevel,
    scopeGuardrails: DEFAULT_SCOPE_GUARDRAILS,
    scopeItems,
    excludedItems: rejected.map((c) => c.name),
    hasWebsiteTrack,
    websiteReadinessScore: assessment.websiteReadiness?.overallScore ?? null,
    websiteStudioRecommended: hasWebsiteTrack,
    sourceAssessmentVersion: assessment.version,
    generatedAt,
  }
}
