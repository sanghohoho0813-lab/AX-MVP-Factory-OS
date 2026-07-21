import type { FundingQualityCheck, FundingStrategy } from '../../types/funding'

let seq = 0
function mk(
  severity: FundingQualityCheck['severity'],
  title: string,
  description: string,
  passed: boolean,
  relatedIds: string[] = [],
): FundingQualityCheck {
  seq += 1
  return { id: `fq-${seq}`, severity, title, description, passed, relatedIds }
}

/**
 * 연계 전략 품질검사. error + passed=false 는 확정을 막는다. 결정적.
 * 승인 가능성·금액을 판정하지 않으며, 근거·확인사항의 충실도만 점검한다.
 */
export function runFundingQuality(strategy: FundingStrategy, opts: { stale: boolean }): FundingQualityCheck[] {
  seq = 0
  const checks: FundingQualityCheck[] = []
  const active = strategy.matches.filter((m) => m.priority !== 'excluded')
  const primaries = active.filter((m) => m.priority === 'primary')

  /* 오류 */
  checks.push(mk('error', '연계 목적', '기관·자금 연계 목적이 필요합니다.', strategy.objective.trim() !== ''))
  checks.push(mk('error', '자금 용도', '필요한 자금 용도가 필요합니다.', strategy.targetUse.trim() !== ''))
  checks.push(mk('error', '후보 기관', '후보 기관이 1개 이상 있어야 합니다.', active.length > 0))
  checks.push(mk('error', 'primary 후보', '우선 검토(primary) 후보가 1개 이상 필요합니다.', primaries.length > 0))
  const primaryNoEvidence = primaries.filter((m) => m.strengths.length === 0 && m.criterionChecks.every((c) => c.projectEvidenceIds.length === 0))
  checks.push(mk('error', 'primary 후보 근거', '우선 후보에는 연결된 근거가 있어야 합니다.', primaryNoEvidence.length === 0, primaryNoEvidence.map((m) => m.id)))
  const primaryNoConfirm = primaries.filter((m) => m.officialConfirmationRequired.length === 0)
  checks.push(mk('error', 'primary 공식 확인사항', '우선 후보에는 공식 확인사항이 있어야 합니다.', primaryNoConfirm.length === 0, primaryNoConfirm.map((m) => m.id)))
  const openCritical = strategy.gaps.filter((g) => g.severity === 'critical' && g.status === 'open')
  checks.push(mk('error', 'critical 부족조건', '중대 부족조건이 처리되어야 합니다.', openCritical.length === 0, openCritical.map((g) => g.id)))
  checks.push(mk('error', '필수 준비자료', '필수 준비자료가 1개 이상 있어야 합니다.', strategy.documentRequirements.some((d) => d.required)))
  // 신청 결과와 Outcome 불일치
  const resolvedApps = strategy.applications.filter((a) => ['approved', 'conditionally_approved', 'rejected'].includes(a.applicationStage))
  const mismatch = resolvedApps.some((a) => !strategy.outcomes.some((o) => o.applicationId === a.id))
  checks.push(mk('error', '결과 기록 일치', '승인·부결된 신청은 결과(Outcome)가 기록되어야 합니다.', !mismatch))
  // 승인금액 > 요청금액인데 설명 없음
  const amountIssue = strategy.outcomes.some((o) => {
    const req = Number(o.requestedAmount.replace(/[^0-9.]/g, ''))
    const app = Number(o.approvedAmount.replace(/[^0-9.]/g, ''))
    return Number.isFinite(req) && Number.isFinite(app) && req > 0 && app > req && o.conditions.length === 0 && o.summary.trim() === ''
  })
  checks.push(mk('error', '승인금액 설명', '승인금액이 요청금액보다 크면 설명이 필요합니다.', !amountIssue))

  /* 경고 */
  const onlyManual = strategy.evidence.length > 0 && strategy.evidence.every((e) => e.sourceType === 'manual' || e.sourceType === 'external_document')
  checks.push(mk('warning', '근거 출처', '자동 수집 근거 없이 수동 입력만 있습니다. 확정 결과 연결을 확인하세요.', !onlyManual))
  checks.push(mk('warning', '재무 근거', '재무 관련 근거가 없습니다. 융자·보증 검토 시 확인이 필요합니다.', strategy.evidence.some((e) => e.label.includes('매출') || e.label.includes('재무'))))
  checks.push(mk('warning', '기술 근거', '기술·혁신 근거가 없습니다.', strategy.evidence.some((e) => e.label.includes('AI') || e.label.includes('기술') || e.label.includes('설계'))))
  checks.push(mk('warning', '검증 결과', '실제 사용 테스트 결과 근거가 없습니다.', strategy.evidence.some((e) => e.sourceType === 'validation')))
  checks.push(mk('warning', '접촉 계획', '접촉 계획이 없습니다.', strategy.outreachPlans.length > 0))
  const docNoOwner = strategy.documentRequirements.filter((d) => d.required && d.ownerId.trim() === '')
  checks.push(mk('warning', '준비자료 담당자', '필수 준비자료에 담당자가 없습니다.', docNoOwner.length === 0, docNoOwner.map((d) => d.id)))
  const openSupplement = strategy.applications.filter((a) => a.applicationStage === 'supplement_requested')
  checks.push(mk('warning', '보완 요청', '보완 요청이 처리되지 않았습니다.', openSupplement.length === 0, openSupplement.map((a) => a.id)))
  const unverifiedMetrics = strategy.metrics.filter((m) => !m.verified)
  checks.push(mk('warning', 'KPI 검증', '검증되지 않은 성과 KPI가 있습니다.', strategy.metrics.length === 0 || unverifiedMetrics.length === 0, unverifiedMetrics.map((m) => m.id)))
  const outcomeNoEvidence = strategy.outcomes.filter((o) => (o.type === 'approved' || o.type === 'conditionally_approved') && o.evidenceIds.length === 0)
  checks.push(mk('warning', '결과 증빙', '승인 결과에 증빙이 없습니다.', outcomeNoEvidence.length === 0, outcomeNoEvidence.map((o) => o.id)))
  if (opts.stale) checks.push(mk('warning', '정보 최신성', '출처 원본이 변경되었습니다. 새 버전 생성을 검토하세요.', false))
  const staleUnknownMatches = active.filter((m) => m.confidence === 'insufficient_data')
  checks.push(mk('warning', '정보 판단 부족', '현재 정보로 판단이 부족한 후보가 있습니다. 공식 확인이 필요합니다.', staleUnknownMatches.length === 0, staleUnknownMatches.map((m) => m.id)))

  /* 안내 */
  checks.push(mk('info', '후보 기관 수', `${active.length}개 후보 · 우선 ${primaries.length}개`, true))
  const verified = strategy.evidence.filter((e) => e.verified).length
  checks.push(mk('info', '근거 검증률', `${strategy.evidence.length > 0 ? Math.round((verified / strategy.evidence.length) * 100) : 0}%`, true))
  const resolvedGaps = strategy.gaps.filter((g) => g.status === 'resolved' || g.status === 'accepted' || g.status === 'not_applicable').length
  checks.push(mk('info', '부족조건 해결률', `${strategy.gaps.length > 0 ? Math.round((resolvedGaps / strategy.gaps.length) * 100) : 0}%`, true))
  const readyDocs = strategy.documentRequirements.filter((d) => d.status === 'ready' || d.status === 'submitted').length
  checks.push(mk('info', '준비자료 완성률', `${strategy.documentRequirements.length > 0 ? Math.round((readyDocs / strategy.documentRequirements.length) * 100) : 0}%`, true))
  checks.push(mk('info', '결과', `결과 ${strategy.outcomes.length}건 · 검증 KPI ${strategy.metrics.filter((m) => m.verified).length}건`, true))

  return checks
}

export function hasFundingBlockingErrors(checks: FundingQualityCheck[]): boolean {
  return checks.some((c) => c.severity === 'error' && !c.passed)
}
