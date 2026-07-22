import { APPLICATION_STAGE_META, OUTCOME_TYPE_META } from '../../lib/fundingMeta'
import type { CaseStudyInput, FundingStrategy } from '../../types/funding'
import type { CollectedFundingSources } from './evidenceCollector'

/*
 * 사례 초안 빌더 (규칙 기반, 순수 데이터)
 *
 * helper 원칙: 과장 금지. 실제 승인 결과(approved/conditionally_approved)가 없는 전략은
 * 성공사례가 아니라 '내부 학습 사례'로만 정리한다. 승인 확률·예상 금액을 만들지 않으며,
 * 결과가 없으면 결과 없음을 명확히 표기한다. 초안은 항상 내부 전용(internal)으로 생성하고
 * 공개·고객공유는 별도 동의 절차 뒤 사용자가 설정한다.
 */

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const t = v.trim()
    if (t.length === 0 || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

function stageLabel(stage: string): string {
  return stage in APPLICATION_STAGE_META
    ? APPLICATION_STAGE_META[stage as keyof typeof APPLICATION_STAGE_META].label
    : stage
}

/**
 * 전략과 수집 근거로부터 사례 초안(CaseStudyInput)을 구성한다.
 * 실제 결과가 없으면 성공사례로 표현하지 않는다.
 */
export function buildCaseDraft(
  strategy: FundingStrategy,
  sources: CollectedFundingSources,
): CaseStudyInput {
  const org = sources.organization
  const industry = org?.industry ?? ''

  /* 후보 (우선·보조) */
  const focusedMatches = strategy.matches.filter(
    (m) => m.priority === 'primary' || m.priority === 'secondary',
  )
  const primaryMatches = strategy.matches.filter((m) => m.priority === 'primary')
  const selectedInstitutions = uniqueNonEmpty(focusedMatches.map((m) => m.institutionId))
  const selectedPrograms = uniqueNonEmpty(
    focusedMatches.map((m) => m.programId ?? '').filter((p) => p.length > 0),
  )

  /* 제목 (일반화 — 기업명 미포함) */
  const title = industry.length > 0
    ? `${industry} 기업 기관·자금 연계 사례`
    : '기업 기관·자금 연계 사례'

  /* 기업 개요 (정확한 주소 미포함) */
  const profileParts: string[] = []
  if (org?.region) profileParts.push(org.region)
  if (org && org.employeeCount !== null) profileParts.push(`직원 약 ${org.employeeCount}명`)
  if (industry.length > 0) profileParts.push(industry)
  const companyProfile = profileParts.join(' · ')

  /* 초기 상황·핵심 문제 */
  const initialSituation =
    sources.selectionHandoff?.problemDefinition?.trim() ||
    sources.project.objective?.trim() ||
    '초기 상황 정보 미입력 — 수동 보완 필요'
  const keyProblems = uniqueNonEmpty([
    ...(sources.assessment?.keyWeaknesses ?? []),
    ...(sources.assessment?.keyRisks ?? []),
  ])

  /* 전략 요약 */
  const strategySummaryParts: string[] = []
  if (strategy.objective.trim()) strategySummaryParts.push(`목적: ${strategy.objective.trim()}`)
  if (strategy.targetUse.trim()) strategySummaryParts.push(`자금 용도: ${strategy.targetUse.trim()}`)
  if (primaryMatches.length > 0) {
    strategySummaryParts.push(`우선 검토 기관: ${primaryMatches.map((m) => m.institutionId).join(', ')}`)
  }
  const strategySummary = strategySummaryParts.join(' / ')

  /* 준비 활동 */
  const preparationActions = uniqueNonEmpty([
    ...strategy.documentRequirements.map((d) => d.title),
    ...strategy.outreachPlans.map((p) => p.purpose),
  ])

  /* 진행 이력 요약 */
  const timelineSummary = strategy.applications.length > 0
    ? strategy.applications
        .map((a) => `${a.applicationName}: ${stageLabel(a.applicationStage)}`)
        .join(' · ')
    : '신청·심사 진행 이력 없음'

  /* 결과 요약 — 승인 결과가 없으면 성공사례로 표현하지 않는다 */
  const approvedOutcome = strategy.outcomes.find(
    (o) => o.type === 'approved' || o.type === 'conditionally_approved',
  )
  const rejectedOutcome = strategy.outcomes.find((o) => o.type === 'rejected')
  let outcomeSummary: string
  if (approvedOutcome) {
    const label = OUTCOME_TYPE_META[approvedOutcome.type].label
    outcomeSummary = approvedOutcome.summary.trim().length > 0
      ? `${label}: ${approvedOutcome.summary.trim()}`
      : label
  } else if (rejectedOutcome) {
    outcomeSummary = '부결 — 내부 학습 사례'
  } else {
    outcomeSummary = '실제 결과 없음 — 성공사례 아님'
  }

  /* 검증된 성과 지표만 (근거 없는 수치 금지) */
  const verifiedMetrics = strategy.metrics
    .filter((m) => m.verified)
    .map((m) => `${m.name}: ${m.actualValue}${m.unit}`)

  /* 과제·교훈·재사용 인사이트 */
  const challenges = uniqueNonEmpty(
    strategy.gaps.filter((g) => g.status === 'open' || g.status === 'in_progress').map((g) => g.title),
  )
  const lessons = uniqueNonEmpty(strategy.outcomes.map((o) => o.lessonsLearned))
  const reusableInsights = uniqueNonEmpty(
    strategy.matches.flatMap((m) => m.strengths),
  )

  /* 검증된 근거 id */
  const evidenceIds = sources.evidence.filter((e) => e.verified).map((e) => e.id)

  /* 자동 초안 원본 (수동 편집 비교용 평문 직렬화) */
  const section = (heading: string, body: string) => `[${heading}]\n${body}`
  const list = (items: string[]) => (items.length > 0 ? items.map((i) => `- ${i}`).join('\n') : '- (없음)')
  const originalDraft = [
    section('제목', title),
    section('업종', industry || '(미상)'),
    section('기업 개요', companyProfile || '(미상)'),
    section('초기 상황', initialSituation),
    section('핵심 문제', list(keyProblems)),
    section('전략 요약', strategySummary || '(미상)'),
    section('검토 기관', list(selectedInstitutions)),
    section('검토 프로그램', list(selectedPrograms)),
    section('준비 활동', list(preparationActions)),
    section('진행 이력', timelineSummary),
    section('결과', outcomeSummary),
    section('검증 지표', list(verifiedMetrics)),
    section('과제', list(challenges)),
    section('교훈', list(lessons)),
    section('재사용 인사이트', list(reusableInsights)),
  ].join('\n\n')

  return {
    projectId: strategy.projectId,
    organizationId: strategy.organizationId,
    strategyId: strategy.id,
    outcomeIds: strategy.outcomes.map((o) => o.id),
    status: 'draft',
    visibility: 'internal',
    title,
    industry,
    companyProfile,
    initialSituation,
    keyProblems,
    strategySummary,
    selectedInstitutions,
    selectedPrograms,
    preparationActions,
    timelineSummary,
    outcomeSummary,
    verifiedMetrics,
    challenges,
    lessons,
    reusableInsights,
    customerQuote: '',
    consentStatus: 'not_required_internal',
    anonymizationNotes: '',
    evidenceIds,
    originalDraft,
    manuallyEdited: false,
    createdBy: '',
    reviewedBy: '',
    approvedBy: '',
    approvedAt: null,
    archivedAt: null,
  }
}
