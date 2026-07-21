import { APPLICATION_STAGE_META } from '../../lib/fundingMeta'
import type { FundingQualityCheck, FundingStrategy } from '../../types/funding'
// qualityEngine은 별도 파일로 작성됨. 아직 없으면 tsc가 'cannot find module'을 낼 수 있으나
// 계약상 import를 유지한다.
import { runFundingQuality } from './qualityEngine'

export interface FundingSummary {
  matchCount: number
  primaryCount: number
  secondaryCount: number
  evidenceCount: number
  verifiedEvidenceCount: number
  /** 0-100 정수 */
  evidenceVerifyRate: number
  gapCount: number
  openGapCount: number
  criticalGapCount: number
  docCount: number
  docReadyCount: number
  /** 0-100 정수 */
  docReadyRate: number
  applicationCount: number
  currentStageLabel: string
  outcomeCount: number
  approvedCount: number
  verifiedMetricCount: number
  /** 승인/조건부승인 또는 부결 결과가 있으면 사례로 정리 가능 */
  caseCandidate: boolean
  hasOfficialConfirmationPending: boolean
  blockingErrorCount: number
  warningCount: number
  finalizeReady: boolean
  stale: boolean
  headline: string
}

function rate(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}

/**
 * 전략의 현재 상태를 수치(counts)로만 요약한다. 승인 확률·예상 금액 등 근거 없는 수치는 만들지 않는다.
 */
export function buildFundingSummary(strategy: FundingStrategy, stale: boolean): FundingSummary {
  const matchCount = strategy.matches.length
  const primaryCount = strategy.matches.filter((m) => m.priority === 'primary').length
  const secondaryCount = strategy.matches.filter((m) => m.priority === 'secondary').length

  const evidenceCount = strategy.evidence.length
  const verifiedEvidenceCount = strategy.evidence.filter((e) => e.verified).length
  const evidenceVerifyRate = rate(verifiedEvidenceCount, evidenceCount)

  const gapCount = strategy.gaps.length
  const openGapCount = strategy.gaps.filter(
    (g) => g.status === 'open' || g.status === 'in_progress',
  ).length
  const criticalGapCount = strategy.gaps.filter(
    (g) => g.severity === 'critical' && (g.status === 'open' || g.status === 'in_progress'),
  ).length

  const docCount = strategy.documentRequirements.length
  const docReadyCount = strategy.documentRequirements.filter(
    (d) => d.status === 'ready' || d.status === 'submitted',
  ).length
  const docReadyRate = rate(docReadyCount, docCount)

  const applicationCount = strategy.applications.length
  let currentStageLabel = ''
  let bestOrder = -1
  for (const app of strategy.applications) {
    const meta = APPLICATION_STAGE_META[app.applicationStage]
    if (meta.order > bestOrder) {
      bestOrder = meta.order
      currentStageLabel = meta.label
    }
  }

  const outcomeCount = strategy.outcomes.length
  const approvedCount = strategy.outcomes.filter(
    (o) => o.type === 'approved' || o.type === 'conditionally_approved',
  ).length
  const verifiedMetricCount = strategy.metrics.filter((m) => m.verified).length

  const caseCandidate = strategy.outcomes.some(
    (o) => o.type === 'approved' || o.type === 'conditionally_approved' || o.type === 'rejected',
  )

  const hasOfficialConfirmationPending = strategy.matches.some(
    (m) => m.officialConfirmationRequired.length > 0,
  )

  const checks: FundingQualityCheck[] = runFundingQuality(strategy, { stale })
  const blockingErrorCount = checks.filter((c) => c.severity === 'error' && !c.passed).length
  const warningCount = checks.filter((c) => c.severity === 'warning' && !c.passed).length
  const finalizeReady = blockingErrorCount === 0

  const isFinalized = strategy.status === 'finalized'
  let headline: string
  if (isFinalized) {
    headline = '연계 전략 확정'
  } else if (stale) {
    headline = '출처 원본 변경 — 새 버전 검토'
  } else if (blockingErrorCount > 0) {
    headline = `확정 전 해결할 오류 ${blockingErrorCount}건`
  } else if (primaryCount === 0) {
    headline = '우선 검토 기관 선택 필요'
  } else if (hasOfficialConfirmationPending) {
    headline = '공식 확인사항 점검 필요'
  } else {
    headline = '확정 가능'
  }

  return {
    matchCount,
    primaryCount,
    secondaryCount,
    evidenceCount,
    verifiedEvidenceCount,
    evidenceVerifyRate,
    gapCount,
    openGapCount,
    criticalGapCount,
    docCount,
    docReadyCount,
    docReadyRate,
    applicationCount,
    currentStageLabel,
    outcomeCount,
    approvedCount,
    verifiedMetricCount,
    caseCandidate,
    hasOfficialConfirmationPending,
    blockingErrorCount,
    warningCount,
    finalizeReady,
    stale,
    headline,
  }
}
