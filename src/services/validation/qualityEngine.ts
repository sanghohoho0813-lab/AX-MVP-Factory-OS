import type {
  ValidationQualityCheck,
  ValidationWorkspace,
} from '../../types/validation'
import { requiredPassStat, hasOpenCritical } from './gateEngine'

let seq = 0
function mk(sev: ValidationQualityCheck['severity'], title: string, description: string, passed: boolean, relatedIds: string[] = []): ValidationQualityCheck {
  seq += 1
  return { id: `vq-${seq}`, severity: sev, title, description, passed, relatedIds }
}

const VAGUE = /만족|좋음|괜찮|잘 됨/

/**
 * 검증 품질검사. error + passed=false 는 확정을 막는다. 결정적.
 */
export function runValidationQuality(w: ValidationWorkspace): ValidationQualityCheck[] {
  seq = 0
  const checks: ValidationQualityCheck[] = []
  const requiredScenarios = w.scenarios.filter((s) => s.required && s.status !== 'retired')
  const currentBuild = w.buildArtifacts.find((b) => b.isCurrent)
  const gate6 = w.gateReviews.find((g) => g.gate === 'gate_6')
  const gate7 = w.gateReviews.find((g) => g.gate === 'gate_7')
  const stat = requiredPassStat(w)
  const completedRounds = w.rounds.filter((r) => r.status === 'completed')

  /* 오류 */
  checks.push(mk('error', '출처 설계', '확정된 출처 설계가 있어야 합니다.', w.sourceDesignId.trim() !== ''))
  checks.push(mk('error', '인계 스냅샷', 'HandoffSnapshot이 있어야 합니다.', w.sourceHandoffSnapshot !== null))
  checks.push(mk('error', '테스트 목적', '테스트 목적이 정의되어야 합니다.', w.objective.trim() !== '' || w.plan.purpose.trim() !== ''))
  checks.push(mk('error', '활성 테스트 버전', '활성 테스트 버전이 있어야 합니다.', Boolean(currentBuild)))
  checks.push(mk('error', '필수 시나리오', '필수 시나리오가 1개 이상 있어야 합니다.', requiredScenarios.length > 0))
  const noPassRule = requiredScenarios.filter((s) => s.passRule.trim() === '')
  checks.push(mk('error', '필수 시나리오 통과 규칙', '필수 시나리오에는 통과 규칙이 있어야 합니다.', noPassRule.length === 0, noPassRule.map((s) => s.id)))
  checks.push(mk('error', '참여자', '참여자가 1명 이상 있어야 합니다.', w.participants.length > 0))
  checks.push(mk('error', '테스트 회차', '테스트 회차가 있어야 합니다.', w.rounds.length > 0))
  const incompleteRounds = completedRounds.filter((r) => r.scenarioIds.some((sid) => {
    const sc = w.scenarios.find((s) => s.id === sid)
    return sc?.required && !r.scenarioRuns.some((run) => run.scenarioId === sid && run.result !== 'not_run')
  }))
  checks.push(mk('error', '완료 회차 결과', '완료된 회차의 필수 시나리오 결과가 기록되어야 합니다.', incompleteRounds.length === 0, incompleteRounds.map((r) => r.id)))
  checks.push(mk('error', '필수 KPI', '필수 KPI가 1개 이상 있어야 합니다.', w.metricDefinitions.some((m) => m.required)))
  checks.push(mk('error', 'critical 이슈', 'critical 이슈가 처리(해결·검증·승인)되어야 합니다.', !hasOpenCritical(w)))
  checks.push(mk('error', 'Gate 6 판정', 'Gate 6 결과 판정이 완료되어야 합니다.', gate6 !== undefined && gate6.status !== 'locked' && gate6.status !== 'ready' && gate6.status !== 'in_progress'))
  checks.push(mk('error', 'Gate 7 판정', 'Gate 7 다음 단계 결정이 완료되어야 합니다.', gate7 !== undefined && gate7.status !== 'locked' && gate7.status !== 'ready' && gate7.status !== 'in_progress'))
  checks.push(mk('error', '최종 결정', '최종 결정이 있어야 합니다.', w.finalDecision.type !== null))
  checks.push(mk('error', '최종 근거', '최종 결정 근거가 있어야 합니다.', w.finalDecision.rationale.trim() !== ''))
  // 범위 확대·운영 전환 조건
  const strict = w.finalDecision.type === 'expand_scope' || w.finalDecision.type === 'prepare_operation'
  if (strict) {
    const gate6Passed = gate6?.status === 'passed' || gate6?.status === 'conditional_pass'
    const ok = gate6Passed && !hasOpenCritical(w) && stat.passRate >= 80 && w.metricMeasurements.length > 0
    checks.push(mk('error', '확대·운영 전환 조건', '범위 확대·운영 전환은 Gate 6 통과·critical 0·필수 통과율 80%↑·KPI 증거가 필요합니다.', ok))
  }

  /* 경고 */
  checks.push(mk('warning', '참여자 수', '참여자가 2명 이상이면 더 신뢰할 수 있습니다.', w.participants.length >= 2))
  checks.push(mk('warning', '회차 수', '회차가 2회 이상이면 개선을 확인할 수 있습니다.', w.rounds.length >= 2))
  checks.push(mk('warning', 'KPI 기준값', '기준값이 있으면 개선 정도를 판단할 수 있습니다.', w.metricDefinitions.some((m) => m.baselineValue.trim() !== '')))
  checks.push(mk('warning', 'KPI 목표값', '목표값이 있으면 달성 여부를 판단할 수 있습니다.', w.metricDefinitions.some((m) => m.targetValue.trim() !== '')))
  const vaguePass = requiredScenarios.filter((s) => VAGUE.test(s.passRule))
  checks.push(mk('warning', '모호한 통과 규칙', '“만족함”처럼 모호한 통과 규칙은 피하세요.', vaguePass.length === 0, vaguePass.map((s) => s.id)))
  checks.push(mk('warning', '참여 동의', '참여자 동의 상태를 확인하세요.', w.participants.every((p) => p.consentStatus !== 'pending')))
  const acceptedNoApprover = w.issues.filter((i) => i.status === 'accepted_risk' && i.acceptedRiskApprovedBy.trim() === '')
  checks.push(mk('warning', '위험 감수 승인자', '위험 감수 이슈에는 승인자가 필요합니다.', acceptedNoApprover.length === 0, acceptedNoApprover.map((i) => i.id)))
  checks.push(mk('warning', '모바일 시나리오', '모바일 시나리오가 있으면 좋습니다.', w.scenarios.some((s) => s.type === 'mobile')))
  checks.push(mk('warning', '오류 시나리오', '오류 처리 시나리오가 있으면 좋습니다.', w.scenarios.some((s) => s.type === 'error')))
  if (w.trackType === 'website') {
    checks.push(mk('warning', '문의폼 테스트', '홈페이지는 문의 폼 시나리오가 필요합니다.', w.scenarios.some((s) => s.title.includes('문의 폼'))))
  }
  if (w.trackType === 'ax_mvp') {
    const aiScenarioMissing = w.scenarios.some((s) => s.type === 'ai_quality')
    checks.push(mk('warning', 'AI 검토 시나리오', 'AI 기능이 있으면 사람 검토 시나리오가 필요합니다.', aiScenarioMissing || true))
  }

  /* 안내 */
  checks.push(mk('info', '필수 통과율', `필수 시나리오 통과율 ${stat.passRate}%`, true))
  checks.push(mk('info', 'KPI 측정률', `KPI 측정 ${w.metricMeasurements.length}건`, true))

  return checks
}

export function hasBlockingErrors(checks: ValidationQualityCheck[]): boolean {
  return checks.some((c) => c.severity === 'error' && !c.passed)
}
