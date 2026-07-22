import type {
  GateReview,
  ScenarioRun,
  ValidationGateNumber,
  ValidationGateStatus,
  ValidationWorkspace,
} from '../../types/validation'
import { GATE_NUMBERS } from '../../lib/validationMeta'
import { defaultGateCriteria } from './gateConfig'

const ISO = '1970-01-01T00:00:00.000Z'

export function buildGateReviews(): GateReview[] {
  return GATE_NUMBERS.map((gate, i) => ({
    id: `gr-${i}`,
    workspaceId: '',
    gate,
    status: i === 0 ? 'ready' : 'locked',
    criteria: defaultGateCriteria(gate),
    summary: '',
    conditions: '',
    conditionOwnerId: '',
    conditionDueDate: '',
    waiverReason: '',
    approvedBy: '',
    reviewerId: '',
    reviewedAt: null,
    nextAction: '',
    relatedIssueIds: [],
    evidenceArtifactIds: [],
    version: 1,
    autoDraftStatus: i === 0 ? 'ready' : 'locked',
  }))
}

/* 회차 실행 결과 집계 */
export function allRuns(workspace: Pick<ValidationWorkspace, 'rounds'>): ScenarioRun[] {
  return workspace.rounds.flatMap((r) => r.scenarioRuns)
}

export interface RequiredPassStat {
  requiredTotal: number
  passed: number
  conditional: number
  failed: number
  blocked: number
  notRun: number
  passRate: number
}

/** 필수 시나리오 통과 통계 (최신 결과 기준) */
export function requiredPassStat(workspace: ValidationWorkspace): RequiredPassStat {
  const requiredIds = new Set(workspace.scenarios.filter((s) => s.required && s.status !== 'retired').map((s) => s.id))
  const latest = new Map<string, ScenarioRun['result']>()
  workspace.rounds
    .slice()
    .sort((a, b) => a.roundNumber - b.roundNumber)
    .forEach((r) => r.scenarioRuns.forEach((run) => {
      if (requiredIds.has(run.scenarioId) && run.result !== 'not_run') latest.set(run.scenarioId, run.result)
    }))
  let passed = 0, conditional = 0, failed = 0, blocked = 0
  requiredIds.forEach((id) => {
    const r = latest.get(id)
    if (r === 'passed') passed += 1
    else if (r === 'conditional') conditional += 1
    else if (r === 'failed') failed += 1
    else if (r === 'blocked') blocked += 1
  })
  const requiredTotal = requiredIds.size
  const measured = passed + conditional + failed + blocked
  return {
    requiredTotal,
    passed,
    conditional,
    failed,
    blocked,
    notRun: requiredTotal - measured,
    passRate: requiredTotal > 0 ? Math.round(((passed + conditional) / requiredTotal) * 100) : 0,
  }
}

export function hasOpenCritical(workspace: ValidationWorkspace): boolean {
  return workspace.issues.some(
    (i) => i.severity === 'critical' && i.status !== 'verified' && i.status !== 'accepted_risk' && i.status !== 'wont_fix',
  )
}

/** 규칙 기반 Gate 자동 초안 상태 (담당자 최종 판정과 별도 보존) */
export function autoDraftGateStatus(workspace: ValidationWorkspace, gate: ValidationGateNumber): ValidationGateStatus {
  const current = workspace.buildArtifacts.find((b) => b.isCurrent)
  const stat = requiredPassStat(workspace)
  switch (gate) {
    case 'gate_0':
    case 'gate_1':
    case 'gate_2':
      // 확정 설계 인계로 워크스페이스를 만든 시점에서 충족
      return workspace.sourceHandoffSnapshot ? 'passed' : 'failed'
    case 'gate_3':
      if (current && (current.url.trim() !== '' || current.accessMethod.trim() !== '')) return 'passed'
      return workspace.buildArtifacts.length > 0 ? 'in_progress' : 'ready'
    case 'gate_4': {
      const ok = workspace.participants.length > 0 && workspace.scenarios.some((s) => s.required) && workspace.metricDefinitions.length > 0
      return ok ? 'passed' : 'in_progress'
    }
    case 'gate_5': {
      const anyCompleted = workspace.rounds.some((r) => r.status === 'completed')
      return anyCompleted ? 'passed' : workspace.rounds.length > 0 ? 'in_progress' : 'ready'
    }
    case 'gate_6': {
      if (stat.requiredTotal === 0 || stat.notRun > 0) return 'in_progress'
      if (hasOpenCritical(workspace) || stat.failed > 0 || stat.blocked > 0) return 'failed'
      if (stat.conditional > 0) return 'conditional_pass'
      return 'passed'
    }
    case 'gate_7':
      return workspace.finalDecision.type ? 'passed' : 'in_progress'
    default:
      return 'locked'
  }
}

/** 이전 필수 Gate가 failed면 다음 Gate 통과를 막는다 */
export function canSetGateStatus(
  workspace: ValidationWorkspace,
  gate: ValidationGateNumber,
  next: ValidationGateStatus,
): { ok: boolean; reason: string } {
  const idx = GATE_NUMBERS.indexOf(gate)
  const prev = workspace.gateReviews.filter((g) => GATE_NUMBERS.indexOf(g.gate) < idx)
  const prevFailed = prev.find((g) => g.status === 'failed')
  if (prevFailed && (next === 'passed' || next === 'conditional_pass')) {
    return { ok: false, reason: '이전 Gate가 실패 상태여서 다음 Gate를 통과시킬 수 없습니다.' }
  }
  if (gate === 'gate_6' && next === 'passed' && hasOpenCritical(workspace)) {
    return { ok: false, reason: '미해결 critical 이슈가 있어 Gate 6을 통과시킬 수 없습니다.' }
  }
  if (idx > GATE_NUMBERS.indexOf('gate_5') && next === 'passed') {
    const anyCompleted = workspace.rounds.some((r) => r.status === 'completed')
    if (!anyCompleted && gate !== 'gate_7') {
      return { ok: false, reason: '테스트 회차가 완료되기 전에는 최종 성공 판정을 할 수 없습니다.' }
    }
  }
  return { ok: true, reason: '' }
}

export { ISO as GATE_ISO }
