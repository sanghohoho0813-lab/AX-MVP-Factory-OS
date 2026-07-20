import type {
  ValidationHandoffInput,
  ValidationRoundSummary,
  ValidationWorkspace,
} from '../../types/validation'
import { GATE_NUMBERS } from '../../lib/validationMeta'

function roundSummaries(w: ValidationWorkspace): ValidationRoundSummary[] {
  return w.rounds
    .slice()
    .sort((a, b) => a.roundNumber - b.roundNumber)
    .map((r) => {
      const runs = r.scenarioRuns
      return {
        roundNumber: r.roundNumber,
        name: r.name,
        totalScenarios: r.scenarioIds.length,
        passed: runs.filter((x) => x.result === 'passed').length,
        conditional: runs.filter((x) => x.result === 'conditional').length,
        failed: runs.filter((x) => x.result === 'failed').length,
        blocked: runs.filter((x) => x.result === 'blocked').length,
      }
    })
}

/** 확정 워크스페이스에서 인계 스냅샷을 만든다 (확정 시점 동결) */
export function buildValidationHandoff(w: ValidationWorkspace, generatedAt: string): ValidationHandoffInput {
  const current = w.buildArtifacts.find((b) => b.isCurrent)
  const passedCriteria: string[] = []
  const failedCriteria: string[] = []
  w.scenarios
    .filter((s) => s.required)
    .forEach((s) => {
      const runs = w.rounds.flatMap((r) => r.scenarioRuns).filter((run) => run.scenarioId === s.id && run.result !== 'not_run')
      const last = runs[runs.length - 1]
      if (last?.result === 'passed' || last?.result === 'conditional') passedCriteria.push(s.title)
      else if (last?.result === 'failed' || last?.result === 'blocked') failedCriteria.push(s.title)
    })

  return {
    workspaceId: w.id,
    projectId: w.projectId,
    organizationId: w.organizationId,
    trackType: w.trackType,
    version: w.version,
    sourceDesignId: w.sourceDesignId,
    sourceDesignVersion: w.sourceDesignVersion,
    objective: w.objective || w.plan.purpose,
    hypotheses: w.hypotheses.map((h) => h.statement),
    testedBuild: current ? `${current.name} ${current.version}`.trim() : '',
    participants: w.participants.length,
    scenarios: w.scenarios.filter((s) => s.status !== 'retired').length,
    roundSummaries: roundSummaries(w),
    passedCriteria,
    failedCriteria,
    unresolvedIssues: w.issues
      .filter((i) => i.status !== 'verified' && i.status !== 'wont_fix' && i.status !== 'accepted_risk')
      .map((i) => `[${i.severity}] ${i.title}`),
    metricResults: w.metricDefinitions.map((m) => {
      const ms = w.metricMeasurements.filter((x) => x.metricId === m.id)
      const latest = ms[ms.length - 1]
      return `${m.name}: ${latest ? `${latest.value}${latest.unit}` : '측정 필요'}`
    }),
    gateResults: GATE_NUMBERS.map((g) => {
      const gr = w.gateReviews.find((x) => x.gate === g)
      return { gate: g, status: gr?.status ?? 'locked' }
    }),
    finalDecision: w.finalDecision,
    evidenceIndex: w.evidenceArtifacts.map((e) => `${e.title} (${e.type})`),
    openQuestions: w.openQuestions,
    risks: w.risks,
    generatedAt,
  }
}
