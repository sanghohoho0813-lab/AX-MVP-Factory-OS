import type {
  AiNecessity,
  AutomationApproach,
  CandidateComplexity,
  CandidateConfidence,
  CandidateDependency,
  CandidateDomainScore,
  CandidateMetric,
  CandidateRiskDeduction,
  CandidateRiskDeductionType,
  CandidateRiskLevel,
  CandidateScoreDomain,
  PriorityQuadrant,
} from '../../types/selection'
import { CANDIDATE_SCORE_DOMAIN_META, RISK_DEDUCTION_LABEL } from '../../lib/selectionMeta'
import {
  CANDIDATE_DOMAIN_MAX,
  FEASIBILITY_AXIS_DOMAINS,
  IMPACT_AXIS_DOMAINS,
  MAX_RISK_DEDUCTION,
  RISK_DEDUCTION_CAP,
} from './scoringConfig'
import type { CandidateDraft } from './candidateExtraction'
import type { EnrichmentContext } from './candidateEnrichment'

export interface ScoringInput {
  draft: CandidateDraft
  metrics: CandidateMetric[]
  approach: AutomationApproach
  aiNecessity: AiNecessity
  humanReviewRequired: boolean
  complexity: CandidateComplexity
  dependencies: CandidateDependency[]
  ctx: EnrichmentContext
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

function metricValue(metrics: CandidateMetric[], type: string): number | null {
  const m = metrics.find((x) => x.type === type)
  return m ? m.value : null
}

interface DomainCalc {
  normalized: number
  confidence: CandidateConfidence
  explanation: string
  warnings: string[]
}

function scoreDomain(domain: CandidateScoreDomain, input: ScoringInput): DomainCalc {
  const { draft, metrics, ctx, complexity, dependencies } = input
  const volume = metricValue(metrics, 'monthly_volume')
  const hours = metricValue(metrics, 'monthly_hours')
  const cost = metricValue(metrics, 'external_cost')
  const requiredDeps = dependencies.filter((d) => d.requiredBeforeMvp).length
  const warnings: string[] = []

  switch (domain) {
    case 'operational_impact': {
      let s = 40
      if (draft.ownerRole === 'owner' || draft.tags.includes('owner_operational') || draft.tags.includes('key_person_risk')) s += 25
      if (hours !== null && hours >= 40) s += 20
      else if (hours !== null && hours >= 10) s += 10
      if (['schedule_progress', 'quotation_cost_profit', 'customer_sales', 'approval_workflow', 'inventory_asset'].includes(draft.taskFamily)) s += 15
      return { normalized: clamp(s), confidence: hours !== null ? 'high' : 'medium', explanation: '핵심 업무·담당자 영향과 업무 규모를 반영했습니다.', warnings }
    }
    case 'repetition_value': {
      let s: number
      if (volume !== null) {
        s = volume >= 150 ? 100 : volume >= 60 ? 80 : volume >= 20 ? 60 : volume >= 1 ? 45 : 30
      } else {
        s = draft.tags.some((t) => ['task_inventory', 'duplicate_entry', 'repeat_docs'].includes(t)) ? 60 : 40
        warnings.push('월 처리건수가 확인되지 않아 반복성 점수의 신뢰도가 낮습니다.')
      }
      return { normalized: clamp(s), confidence: volume !== null ? 'high' : 'low', explanation: '월 처리건수·반복 성격을 반영했습니다.', warnings }
    }
    case 'economic_benefit': {
      let s: number
      let conf: CandidateConfidence = 'medium'
      if (hours !== null) {
        s = hours >= 160 ? 100 : hours >= 80 ? 80 : hours >= 40 ? 65 : hours >= 10 ? 45 : 30
        conf = 'high'
      } else if (cost !== null && cost > 0) {
        s = 60
      } else {
        s = 30
        conf = 'low'
        warnings.push('월 총시간·비용 데이터가 부족해 개선 가능성 산정이 제한됩니다.')
      }
      return { normalized: clamp(s), confidence: conf, explanation: '월 총시간·외주비 등 절감 여지를 반영했습니다.', warnings }
    }
    case 'process_suitability': {
      let s = ctx.processClarity
      if (input.approach === 'rule_based' || input.approach === 'workflow_automation') s += 15
      if (input.approach === 'process_definition_first') s -= 30
      if (input.approach === 'ai_assisted') s -= 5
      if (s < 40) warnings.push('업무 규칙·흐름이 충분히 명확하지 않습니다.')
      return { normalized: clamp(s), confidence: 'medium', explanation: '진단의 프로세스 명확성과 자동화 방식을 반영했습니다.', warnings }
    }
    case 'data_readiness': {
      const s = ctx.dataReadiness
      if (s < 30) warnings.push('활용 가능한 데이터가 부족합니다.')
      return { normalized: clamp(s), confidence: 'medium', explanation: '진단의 데이터 준비도를 반영했습니다.', warnings }
    }
    case 'implementation_feasibility': {
      const base = complexity === 'low' ? 90 : complexity === 'medium' ? 70 : complexity === 'high' ? 45 : 25
      const s = base - requiredDeps * 8
      if (s < 40) warnings.push('구현 복잡도·선행조건으로 1차 MVP 구현 난이도가 높습니다.')
      return { normalized: clamp(s), confidence: 'medium', explanation: '복잡도와 필수 선행조건 수를 반영했습니다.', warnings }
    }
    case 'adoption_readiness': {
      let s = ctx.adoption
      if (ctx.hasFieldUser) s += 10
      if (ctx.hasTestOwner) s += 10
      if (s < 30) warnings.push('실제 사용자·담당자 확인이 부족합니다.')
      return { normalized: clamp(s), confidence: 'medium', explanation: '진단 도입 의지와 현장 담당자·테스트 담당자 여부를 반영했습니다.', warnings }
    }
    case 'funding_scalability': {
      let s = ctx.fundingConnection
      if (ctx.hasMeasurableKpi) s += 20
      if (['reporting_dashboard', 'diagnosis_decision'].includes(draft.taskFamily)) s += 15
      return { normalized: clamp(s), confidence: 'low', explanation: '생산성·기술성을 기관 자료로 설명하기 쉬운 정도를 반영했습니다(합격 가능성 아님).', warnings }
    }
  }
}

export function scoreCandidateDomains(input: ScoringInput): CandidateDomainScore[] {
  return (Object.keys(CANDIDATE_DOMAIN_MAX) as CandidateScoreDomain[]).map((domain) => {
    const calc = scoreDomain(domain, input)
    const max = CANDIDATE_DOMAIN_MAX[domain]
    const raw = Math.round((calc.normalized / 100) * max * 10) / 10
    return {
      domain,
      rawScore: raw,
      maxScore: max,
      normalizedScore: calc.normalized,
      confidence: calc.confidence,
      evidenceIds: input.draft.sourceEvidenceIds,
      explanation: `${CANDIDATE_SCORE_DOMAIN_META[domain].label}: ${calc.explanation}`,
      warnings: calc.warnings,
      autoScore: raw,
      adjustedScore: null,
      adjustmentReason: '',
    }
  })
}

/* ------------------------------------------------------------------ */
/* 위험 감점                                                            */
/* ------------------------------------------------------------------ */

export function computeRiskDeductions(
  input: ScoringInput,
  domainScores: CandidateDomainScore[],
): CandidateRiskDeduction[] {
  const { draft, metrics, ctx, dependencies } = input
  const norm = (d: CandidateScoreDomain) => domainScores.find((x) => x.domain === d)?.normalizedScore ?? 0
  const drafts: Array<{ type: CandidateRiskDeductionType; points: number; reason: string; resolution: string; evidenceIds: string[]; priority: number }> = []

  const expertCore = ctx.expertRiskGlobal && (draft.taskFamily === 'diagnosis_decision' || input.humanReviewRequired)
  if (expertCore) {
    drafts.push({ type: 'expert_risk', points: ctx.criticalExpert ? 8 : 5, reason: '세무·노무·법무 등 전문가 최종 판단이 핵심에 포함됩니다.', resolution: '자동화 범위를 참고·초안 생성으로 축소하고 전문가 검토 단계를 유지하세요.', evidenceIds: draft.sourceEvidenceIds, priority: 1 })
  }
  if (ctx.privacyRiskGlobal && ['data_collection', 'data_validation'].includes(draft.taskFamily)) {
    drafts.push({ type: 'privacy_risk', points: 6, reason: '개인정보·민감정보 처리가 포함될 수 있습니다.', resolution: '개인정보 처리 주체·범위를 확인하고 보관·접근 기준을 정의하세요.', evidenceIds: [], priority: 2 })
  }
  if (norm('process_suitability') < 40) {
    drafts.push({ type: 'unclear_process', points: 5, reason: '업무 흐름·규칙이 명확하지 않습니다.', resolution: '처리 기준과 승인 흐름을 인터뷰로 정리하세요.', evidenceIds: [], priority: 4 })
  }
  const noMetrics = metrics.length === 0
  if (norm('data_readiness') < 30 || noMetrics) {
    drafts.push({ type: 'insufficient_data', points: 6, reason: '활용 가능한 데이터·수치가 부족합니다.', resolution: '실제 자료 샘플과 처리량·시간 데이터를 확보하세요.', evidenceIds: [], priority: 3 })
  }
  if (norm('adoption_readiness') < 30 || !ctx.hasFieldUser) {
    drafts.push({ type: 'low_adoption', points: !ctx.hasFieldUser ? 4 : 6, reason: '실제 사용자·현장 담당자 확인이 부족합니다.', resolution: '현장 담당자와 테스트 담당자를 지정하세요.', evidenceIds: [], priority: 5 })
  }
  if (dependencies.some((d) => d.type === 'external_system')) {
    drafts.push({ type: 'external_dependency', points: 5, reason: '외부 시스템 연동에 의존합니다.', resolution: '연동 범위를 1차 MVP에서 최소화하세요.', evidenceIds: [], priority: 6 })
  }
  if (draft.taskFamily === 'system_integration') {
    drafts.push({ type: 'excessive_scope', points: 5, reason: '통합 범위가 넓어 1차 MVP 범위를 넘어설 수 있습니다.', resolution: '핵심 업무 1개로 범위를 좁히세요.', evidenceIds: [], priority: 7 })
  }
  // 데이터 부족 감점이 없을 때만 측정기준 감점(중복 방지)
  if (!noMetrics && norm('data_readiness') >= 30 && !ctx.hasMeasurableKpi) {
    drafts.push({ type: 'low_measurement', points: 4, reason: '개선 효과를 측정할 지표가 정리되지 않았습니다.', resolution: '처리시간·건수·오류 중 측정 가능한 지표를 확정하세요.', evidenceIds: [], priority: 8 })
  }

  drafts.sort((a, b) => a.priority - b.priority)
  const result: CandidateRiskDeduction[] = []
  let running = 0
  for (const d of drafts) {
    if (running >= MAX_RISK_DEDUCTION) break
    const cap = RISK_DEDUCTION_CAP[d.type]
    const allowed = Math.min(d.points, cap, MAX_RISK_DEDUCTION - running)
    if (allowed <= 0) continue
    running += allowed
    result.push({
      id: `crd-${draft.generationKey}-${d.type}`,
      type: d.type,
      label: RISK_DEDUCTION_LABEL[d.type],
      points: allowed,
      reason: d.reason,
      evidenceIds: d.evidenceIds,
      autoGenerated: true,
      excluded: false,
      exclusionReason: '',
      resolution: d.resolution,
    })
  }
  return result
}

/* ------------------------------------------------------------------ */
/* 우선순위 · 사분면 · 신뢰도                                            */
/* ------------------------------------------------------------------ */

export function computePriority(
  domainScores: CandidateDomainScore[],
  deductions: CandidateRiskDeduction[],
): { subtotalScore: number; deductionTotal: number; priorityScore: number } {
  const subtotalScore = Math.round(
    domainScores.reduce((s, d) => s + (d.adjustedScore ?? d.rawScore), 0) * 10,
  ) / 10
  const deductionTotal = deductions.filter((d) => !d.excluded).reduce((s, d) => s + d.points, 0)
  const priorityScore = clamp(subtotalScore - deductionTotal)
  return { subtotalScore, deductionTotal, priorityScore }
}

function axisAverage(domainScores: CandidateDomainScore[], domains: CandidateScoreDomain[]): number {
  const vals = domainScores.filter((d) => domains.includes(d.domain)).map((d) => d.adjustedScore !== null ? (d.adjustedScore / d.maxScore) * 100 : d.normalizedScore)
  return vals.length === 0 ? 0 : Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
}

export function computeAxes(domainScores: CandidateDomainScore[]): { impact: number; feasibility: number } {
  return {
    impact: axisAverage(domainScores, IMPACT_AXIS_DOMAINS),
    feasibility: axisAverage(domainScores, FEASIBILITY_AXIS_DOMAINS),
  }
}

export function computeQuadrant(
  domainScores: CandidateDomainScore[],
  input: ScoringInput,
): { quadrant: PriorityQuadrant; exceptionReason: string } {
  const norm = (d: CandidateScoreDomain) => domainScores.find((x) => x.domain === d)?.normalizedScore ?? 0
  if (input.ctx.criticalExpert && (input.draft.taskFamily === 'diagnosis_decision' || input.humanReviewRequired)) {
    return { quadrant: 'defer', exceptionReason: '전문가 최종 판단이 핵심이라 전문가 검토 전까지 보류합니다.' }
  }
  if (norm('data_readiness') < 30) {
    return { quadrant: 'prepare_first', exceptionReason: '데이터 준비도가 낮아 자료 정리가 먼저 필요합니다.' }
  }
  if (norm('process_suitability') < 30) {
    return { quadrant: 'prepare_first', exceptionReason: '업무 정의가 불명확해 업무 정리가 먼저 필요합니다.' }
  }
  if (norm('adoption_readiness') < 30) {
    return { quadrant: 'prepare_first', exceptionReason: '현장 수용성이 낮아 현장 합의가 먼저 필요합니다.' }
  }
  const { impact, feasibility } = computeAxes(domainScores)
  if (feasibility >= 55 && impact >= 55) return { quadrant: 'quick_win', exceptionReason: '' }
  if (impact >= 55 && feasibility < 55) return { quadrant: 'strategic_bet', exceptionReason: '' }
  if (feasibility >= 55 && impact < 55) return { quadrant: 'prepare_first', exceptionReason: '' }
  return { quadrant: 'defer', exceptionReason: '' }
}

export function computeConfidence(
  input: ScoringInput,
): { confidence: CandidateConfidence; reason: string } {
  const { metrics, draft, ctx } = input
  const hasHours = metrics.some((m) => m.type === 'monthly_hours' && m.value !== null)
  const hasVolume = metrics.some((m) => m.type === 'monthly_volume' && m.value !== null)
  const hasEvidence = draft.sourceEvidenceIds.length > 0
  if (metrics.length === 0 && !hasEvidence) {
    return { confidence: 'insufficient', reason: '업무량·시간 수치와 진단 근거가 확인되지 않았습니다. 추가 인터뷰 또는 자료 수집이 필요합니다.' }
  }
  if (hasHours && hasVolume && hasEvidence && ctx.assessmentConfidence !== 'low') {
    return { confidence: 'high', reason: '월 처리건수·소요시간과 진단 근거가 함께 확인되었습니다.' }
  }
  if ((hasVolume || hasHours) && hasEvidence) {
    return { confidence: 'medium', reason: '일부 업무량 수치와 근거가 확인되었습니다.' }
  }
  return { confidence: 'low', reason: '업무량 수치가 부족하거나 단일 역할 응답에 근거합니다.' }
}

/** 카드 표시용 위험 수준 (저장 안 함, 파생) */
export function candidateRiskLevel(candidate: {
  deductions: CandidateRiskDeduction[]
  expertRiskGrade: string
  humanReviewRequired: boolean
}): CandidateRiskLevel {
  const active = candidate.deductions.filter((d) => !d.excluded)
  const total = active.reduce((s, d) => s + d.points, 0)
  const hasExpert = active.some((d) => d.type === 'expert_risk')
  if (hasExpert && candidate.expertRiskGrade === 'red') return 'critical'
  if (total >= 15) return 'high'
  if (total >= 8) return 'medium'
  return 'low'
}
