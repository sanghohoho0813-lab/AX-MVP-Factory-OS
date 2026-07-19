import type { AssessmentResult } from '../../types/assessment'
import type { AnalysisIssue } from '../../types/assessment'
import type { MvpLevel } from '../../types/domain'
import type {
  AiNecessity,
  AutomationApproach,
  CandidateComplexity,
  CandidateDependency,
  CandidateMetric,
  CandidateTemplateMix,
  ExpectedEffect,
} from '../../types/selection'
import type { AnalysisDataset } from '../assessment/analysisData'
import { TAG } from '../assessment/scoringConfig'
import { AUTOMATION_RATIO_RULES } from './scoringConfig'
import { FAMILY_TO_TEMPLATE } from './candidateTaxonomy'
import type { CandidateDraft, DraftMetric } from './candidateExtraction'

/* ------------------------------------------------------------------ */
/* 프로젝트 전역 컨텍스트                                                */
/* ------------------------------------------------------------------ */

export interface EnrichmentContext {
  privacyRiskGlobal: boolean
  expertRiskGlobal: boolean
  criticalExpert: boolean
  processClarity: number
  dataReadiness: number
  adoption: number
  fundingConnection: number
  hasFieldUser: boolean
  hasTestOwner: boolean
  hasMeasurableKpi: boolean
  assessmentConfidence: AssessmentResult['confidence']
}

function domainNorm(assessment: AssessmentResult, domain: string): number {
  const d = assessment.domainScores.find((x) => x.domain === domain)
  return d && d.measured ? d.normalizedScore : 0
}

export function buildEnrichmentContext(
  dataset: AnalysisDataset,
  assessment: AssessmentResult,
  issues: AnalysisIssue[],
): EnrichmentContext {
  const privacy = issues.some((i) => i.ruleKey === 'risk_privacy' || i.type === 'risk_signal')
  const expert = issues.some((i) => i.type === 'expert_review')
  const criticalExpert = issues.some(
    (i) => (i.type === 'expert_review' || i.type === 'risk_signal') && i.severity === 'critical' && i.status !== 'resolved' && i.status !== 'excluded',
  )
  const hasField = dataset.rolesPresent.includes('worker')
  const testOwner = dataset.respondents.some((r) =>
    r.byTag.get(TAG.testOwner)?.some((n) => String(n.rawValue) === 'yes'),
  )
  const kpi = dataset.respondents.some((r) =>
    r.byTag.get(TAG.measurableKpi)?.some((n) => n.answered && !n.selectedOptionValues.includes('none')),
  )
  return {
    privacyRiskGlobal: privacy,
    expertRiskGlobal: expert,
    criticalExpert,
    processClarity: domainNorm(assessment, 'process_clarity'),
    dataReadiness: domainNorm(assessment, 'data_readiness'),
    adoption: domainNorm(assessment, 'adoption'),
    fundingConnection: domainNorm(assessment, 'funding_connection'),
    hasFieldUser: hasField,
    hasTestOwner: testOwner,
    hasMeasurableKpi: kpi,
    assessmentConfidence: assessment.confidence,
  }
}

/* ------------------------------------------------------------------ */
/* 지표                                                                 */
/* ------------------------------------------------------------------ */

function metricId(candidateKey: string, type: string): string {
  return `m-${candidateKey}-${type}`
}

export function finalizeMetrics(draft: CandidateDraft): CandidateMetric[] {
  return draft.metrics.map((m: DraftMetric) => ({
    id: metricId(draft.generationKey, m.type),
    type: m.type,
    label: m.label,
    value: m.value,
    unit: m.unit,
    sourceEvidenceIds: m.sourceEvidenceIds,
    confidence: m.confidence,
    manuallyEdited: false,
    editReason: '',
  }))
}

function metricValue(metrics: CandidateMetric[], type: string): number | null {
  const m = metrics.find((x) => x.type === type)
  return m ? m.value : null
}

/* ------------------------------------------------------------------ */
/* 예상 효과                                                            */
/* ------------------------------------------------------------------ */

export function computeExpectedEffects(
  draft: CandidateDraft,
  metrics: CandidateMetric[],
  ratio: number,
): ExpectedEffect[] {
  const effects: ExpectedEffect[] = []
  const monthlyHours = metricValue(metrics, 'monthly_hours')
  const externalCost = metricValue(metrics, 'external_cost')
  const key = draft.generationKey

  // 시간 절감
  if (monthlyHours !== null && monthlyHours > 0) {
    const saved = Math.round(monthlyHours * ratio * 10) / 10
    effects.push({
      id: `e-${key}-time`,
      type: 'time_saving',
      title: '예상 절감시간',
      currentValue: monthlyHours,
      expectedValue: Math.round((monthlyHours - saved) * 10) / 10,
      unit: '시간/월',
      calculationMethod: '월 총 업무시간 × (1 − 예상 자동화 비율)',
      assumption: `예상 자동화 비율 ${Math.round(ratio * 100)}% (가정, 수정 가능)`,
      confidence: 'medium',
      evidenceIds: metrics.find((m) => m.type === 'monthly_hours')?.sourceEvidenceIds ?? [],
      manuallyEdited: false,
      notEstimable: false,
      qualitative: false,
    })
  } else {
    effects.push({
      id: `e-${key}-time`,
      type: 'time_saving',
      title: '예상 절감시간',
      currentValue: null,
      expectedValue: null,
      unit: '시간/월',
      calculationMethod: '월 처리건수 × 건당 소요시간 ÷ 60 × 자동화 비율',
      assumption: '월 처리건수와 건당 소요시간이 확인되지 않았습니다.',
      confidence: 'insufficient',
      evidenceIds: [],
      manuallyEdited: false,
      notEstimable: true,
      qualitative: false,
    })
  }

  // 비용 절감(외주비 기준일 때만)
  if (externalCost !== null && externalCost > 0) {
    const saved = Math.round(externalCost * ratio)
    effects.push({
      id: `e-${key}-cost`,
      type: 'cost_saving',
      title: '예상 외주비 절감',
      currentValue: externalCost,
      expectedValue: externalCost - saved,
      unit: '원/월',
      calculationMethod: '월 외주비 × 예상 자동화 비율',
      assumption: `예상 자동화 비율 ${Math.round(ratio * 100)}% (가정)`,
      confidence: 'low',
      evidenceIds: [],
      manuallyEdited: false,
      notEstimable: false,
      qualitative: false,
    })
  }

  // 정성 효과
  const qualitative: Array<{ type: ExpectedEffect['type']; title: string }> = [
    { type: 'standardization', title: '업무 표준화 및 담당자 의존 감소' },
  ]
  if (['schedule_progress', 'reporting_dashboard', 'approval_workflow'].includes(draft.taskFamily)) {
    qualitative.push({ type: 'visibility', title: '진행상태 가시화' })
  }
  if (draft.tags.includes('key_person_risk') || draft.tags.includes('owner_operational')) {
    qualitative.push({ type: 'knowledge_transfer', title: '핵심 담당자 지식의 시스템화' })
  }
  if (['data_validation'].includes(draft.taskFamily) || draft.tags.includes('error_rate')) {
    qualitative.push({ type: 'error_reduction', title: '누락·오류 감소' })
  }
  qualitative.forEach((q, i) => {
    effects.push({
      id: `e-${key}-q${i}`,
      type: q.type,
      title: q.title,
      currentValue: null,
      expectedValue: null,
      unit: '',
      calculationMethod: '',
      assumption: '정성 효과 — 금액으로 환산하지 않습니다.',
      confidence: 'medium',
      evidenceIds: draft.sourceEvidenceIds,
      manuallyEdited: false,
      notEstimable: false,
      qualitative: true,
    })
  })

  return effects
}

/* ------------------------------------------------------------------ */
/* 자동화 방식 · AI 필요성 · 복잡도                                       */
/* ------------------------------------------------------------------ */

const AI_FAMILIES = new Set(['document_generation', 'customer_response'])

export function recommendApproach(
  draft: CandidateDraft,
  ctx: EnrichmentContext,
): { approach: AutomationApproach; reason: string } {
  if (ctx.dataReadiness < 40 && draft.metrics.length === 0) {
    return { approach: 'data_cleanup_first', reason: '활용할 데이터가 부족해 개발보다 자료 정리가 먼저 필요합니다.' }
  }
  if (ctx.processClarity < 35) {
    return { approach: 'process_definition_first', reason: '업무 규칙과 책임자가 불명확해 업무 정의가 먼저 필요합니다.' }
  }
  if (draft.taskFamily === 'diagnosis_decision' && ctx.expertRiskGlobal) {
    return { approach: 'hybrid', reason: '판정 흐름은 규칙으로 구성하되, 전문 판단이 필요한 부분은 사람이 최종 검토해야 합니다.' }
  }
  if (AI_FAMILIES.has(draft.taskFamily) || draft.tags.includes('draft_generation')) {
    return { approach: 'ai_assisted', reason: '자유서술 문서·응대 초안 작성에 AI가 유용하며, 최종 검토는 담당자가 수행합니다.' }
  }
  if (['approval_workflow', 'schedule_progress', 'reporting_dashboard'].includes(draft.taskFamily)) {
    return { approach: 'workflow_automation', reason: '담당자 배정·승인·진행상태 흐름이 명확해 워크플로 자동화가 적합합니다.' }
  }
  return { approach: 'rule_based', reason: '정해진 조건·계산으로 처리할 수 있어 규칙 기반 자동화가 적합합니다.' }
}

export function judgeAiNecessity(
  draft: CandidateDraft,
  approach: AutomationApproach,
  ctx: EnrichmentContext,
): { necessity: AiNecessity; reason: string; humanReview: boolean } {
  if (approach === 'ai_assisted' || approach === 'hybrid') {
    return {
      necessity: 'useful',
      reason: '비정형 문서·요약·초안 작성에 AI가 실질적 효과가 있습니다. 결과는 담당자가 최종 검토합니다.',
      humanReview: true,
    }
  }
  if (draft.taskFamily === 'reporting_dashboard') {
    return { necessity: 'optional', reason: '기본 집계는 규칙으로 충분하며, 요약·해설에 AI를 선택적으로 활용할 수 있습니다.', humanReview: false }
  }
  if (ctx.dataReadiness < 40) {
    return { necessity: 'advanced_later', reason: '데이터가 더 축적된 후 예측·고급분석을 검토하는 것이 적절합니다.', humanReview: false }
  }
  return { necessity: 'unnecessary', reason: '규칙 기반으로 충분히 처리할 수 있어 AI가 필요하지 않습니다.', humanReview: false }
}

export function estimateComplexity(
  draft: CandidateDraft,
  approach: AutomationApproach,
  dependencyCount: number,
): CandidateComplexity {
  if (approach === 'data_cleanup_first' || approach === 'process_definition_first') return 'high'
  let score = 0
  if (approach === 'workflow_automation') score += 1
  if (approach === 'ai_assisted') score += 2
  if (approach === 'hybrid') score += 3
  if (draft.taskFamily === 'system_integration') score += 2
  score += Math.min(2, dependencyCount)
  if (score >= 5) return 'very_high'
  if (score >= 3) return 'high'
  if (score >= 1) return 'medium'
  return 'low'
}

/* ------------------------------------------------------------------ */
/* 의존성                                                               */
/* ------------------------------------------------------------------ */

export function buildDependencies(
  draft: CandidateDraft,
  ctx: EnrichmentContext,
): CandidateDependency[] {
  const deps: CandidateDependency[] = []
  const add = (
    type: CandidateDependency['type'],
    title: string,
    description: string,
    required: boolean,
  ) =>
    deps.push({
      id: `dep-${draft.generationKey}-${type}`,
      type,
      title,
      description,
      requiredBeforeMvp: required,
      resolved: false,
      resolutionNote: '',
    })

  if (ctx.dataReadiness < 45 || draft.metrics.length === 0) {
    add('data', '핵심 데이터·샘플 확보', '진단·구축에 필요한 실제 자료 샘플을 확보해야 합니다.', true)
  }
  if (ctx.processClarity < 45) {
    add('process', '업무 규칙 정리', '처리 기준·승인 흐름을 명확히 정의해야 합니다.', true)
  }
  if (!ctx.hasTestOwner) {
    add('user', '테스트 담당자 지정', '검증을 담당할 실제 사용자를 지정해야 합니다.', true)
  }
  if (ctx.privacyRiskGlobal && ['data_collection', 'data_validation'].includes(draft.taskFamily)) {
    add('security', '개인정보 처리 기준 확인', '개인정보 처리 범위·주체를 확인해야 합니다.', true)
  }
  if (ctx.expertRiskGlobal && draft.taskFamily === 'diagnosis_decision') {
    add('expert', '전문가 검토', '전문 판단이 필요한 범위에 대한 전문가 검토가 필요합니다.', true)
  }
  return deps
}

/* ------------------------------------------------------------------ */
/* 템플릿 조합 · MVP 레벨                                                */
/* ------------------------------------------------------------------ */

export function recommendTemplateMix(draft: CandidateDraft): CandidateTemplateMix[] {
  const primary = FAMILY_TO_TEMPLATE[draft.taskFamily]
  const hasCollection = draft.metrics.some((m) => m.type === 'monthly_volume')
  if (hasCollection && primary !== 'data_collection_validation') {
    return [
      { template: primary, percentage: 70, reason: `${draft.taskFamily} 업무의 핵심 흐름` },
      { template: 'data_collection_validation', percentage: 30, reason: '반복 입력·수집·검수 처리' },
    ]
  }
  return [{ template: primary, percentage: 100, reason: '핵심 업무 흐름에 맞는 표준 템플릿' }]
}

export function recommendMvpLevel(complexity: CandidateComplexity): MvpLevel {
  switch (complexity) {
    case 'low':
      return 1
    case 'medium':
      return 2
    case 'high':
      return 2
    case 'very_high':
      return 3
  }
}

export function ratioForDraft(draft: CandidateDraft): number {
  return AUTOMATION_RATIO_RULES[draft.ratioKey].default
}
