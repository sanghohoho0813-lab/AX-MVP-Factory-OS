import type {
  ValidationGateNumber,
  ValidationWorkspace,
} from '../../types/validation'
import { GATE_NUMBERS } from '../../lib/validationMeta'
import { requiredPassStat, hasOpenCritical } from './gateEngine'
import { runValidationQuality, hasBlockingErrors } from './qualityEngine'

export interface ValidationSummary {
  /** 필수 시나리오 통과 통계 (근거 없는 성공 판정 금지 — notRun 있으면 미완료) */
  requiredTotal: number
  requiredPassed: number
  requiredPassRate: number
  requiredNotRun: number
  requiredMeasured: boolean
  /** 완료된 회차 수 */
  completedRounds: number
  totalRounds: number
  /** 미해결 critical 이슈 존재 여부 (있으면 Gate 6·확정 차단) */
  hasOpenCritical: boolean
  openIssues: number
  /** KPI 측정 여부 — 측정값 없으면 '측정 필요' */
  metricsDefined: number
  metricsMeasured: number
  /** Gate 진행 요약 */
  gateProgress: { gate: ValidationGateNumber; passed: boolean; failed: boolean }[]
  gatesPassed: number
  /** 확정 가능 여부 (품질검사 error 없음) */
  finalizeReady: boolean
  blockingReasons: string[]
  /** 한 줄 상태 문구 (근거 없는 성공 표현 금지) */
  headline: string
}

/** 워크스페이스 상태를 결정적으로 요약한다. 검증되지 않은 성공을 단정하지 않는다. */
export function buildValidationSummary(w: ValidationWorkspace): ValidationSummary {
  const stat = requiredPassStat(w)
  const completedRounds = w.rounds.filter((r) => r.status === 'completed').length
  const openIssues = w.issues.filter(
    (i) => i.status !== 'verified' && i.status !== 'wont_fix' && i.status !== 'accepted_risk',
  ).length
  const metricsMeasured = new Set(w.metricMeasurements.map((m) => m.metricId)).size

  const gateProgress = GATE_NUMBERS.map((gate) => {
    const gr = w.gateReviews.find((x) => x.gate === gate)
    return {
      gate,
      passed: gr?.status === 'passed' || gr?.status === 'conditional_pass',
      failed: gr?.status === 'failed',
    }
  })

  const checks = runValidationQuality(w)
  const blocking = checks.filter((c) => c.severity === 'error' && !c.passed)
  const finalizeReady = !hasBlockingErrors(checks)

  const requiredMeasured = stat.requiredTotal > 0 && stat.notRun === 0

  let headline: string
  if (w.status === 'finalized') {
    headline = '검증 확정 완료'
  } else if (stat.requiredTotal === 0) {
    headline = '필수 시나리오 준비 필요'
  } else if (stat.notRun > 0) {
    headline = `필수 시나리오 ${stat.notRun}건 미측정 — 테스트 진행 필요`
  } else if (hasOpenCritical(w)) {
    headline = '미해결 critical 이슈 — 확정 불가'
  } else {
    headline = `필수 통과율 ${stat.passRate}% · 미해결 이슈 ${openIssues}건`
  }

  return {
    requiredTotal: stat.requiredTotal,
    requiredPassed: stat.passed + stat.conditional,
    requiredPassRate: stat.passRate,
    requiredNotRun: stat.notRun,
    requiredMeasured,
    completedRounds,
    totalRounds: w.rounds.length,
    hasOpenCritical: hasOpenCritical(w),
    openIssues,
    metricsDefined: w.metricDefinitions.length,
    metricsMeasured,
    gateProgress,
    gatesPassed: gateProgress.filter((g) => g.passed).length,
    finalizeReady,
    blockingReasons: blocking.map((c) => c.title),
    headline,
  }
}
