import type {
  FundingStrategy,
  FundingStrategySnapshotInput,
} from '../../types/funding'

/** 확정 시점의 전략 상태를 동결한 스냅샷 입력을 만든다. */
export function buildFundingSnapshot(
  strategy: FundingStrategy,
  generatedAt: string,
): FundingStrategySnapshotInput {
  const selectedMatches = strategy.matches.filter((m) => m.priority === 'primary' || m.priority === 'secondary')
  const caseCandidate = strategy.outcomes.some(
    (o) => o.type === 'approved' || o.type === 'conditionally_approved' || o.type === 'rejected',
  )
  return {
    strategyId: strategy.id,
    projectId: strategy.projectId,
    organizationId: strategy.organizationId,
    version: strategy.version,
    objective: strategy.objective,
    targetUse: strategy.targetUse,
    selectedMatches: selectedMatches.map((m) => ({ ...m, criterionChecks: m.criterionChecks.map((c) => ({ ...c })) })),
    strengths: selectedMatches.flatMap((m) => m.strengths),
    gaps: strategy.gaps.map((g) => ({ ...g })),
    outreachPlan: strategy.outreachPlans.map((p) => ({ ...p })),
    requiredDocuments: strategy.documentRequirements.map((d) => ({ ...d })),
    applications: strategy.applications.map((a) => ({ ...a })),
    outcomes: strategy.outcomes.map((o) => ({ ...o })),
    metrics: strategy.metrics.map((m) => ({ ...m })),
    caseCandidate,
    officialConfirmationNotes: strategy.officialConfirmationNotes,
    openQuestions: [...strategy.openQuestions],
    assumptions: [...strategy.assumptions],
    risks: [...strategy.risks],
    generatedAt,
  }
}
