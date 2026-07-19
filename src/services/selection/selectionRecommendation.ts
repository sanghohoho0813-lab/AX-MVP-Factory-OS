import type { Organization, Project } from '../../types/domain'
import type {
  AutomationCandidate,
  CandidateSelectionReason,
} from '../../types/selection'
import { QUADRANT_META, TASK_FAMILY_META } from '../../lib/selectionMeta'
import { candidateRiskLevel } from './candidateScoring'

/** primary(핵심 과제) 자동 추천 대상에서 제외되는 후보인지 */
export function isPrimaryEligible(c: AutomationCandidate): boolean {
  if (c.confidence === 'insufficient') return false
  if (c.complexity === 'very_high') return false
  if (candidateRiskLevel(c) === 'critical') return false
  if (c.automationApproach === 'data_cleanup_first') return false
  if (c.automationApproach === 'process_definition_first') return false
  if (c.automationApproach === 'not_recommended') return false
  const externalDeps = c.dependencies.filter((d) => d.type === 'external_system').length
  if (externalDeps >= 2) return false
  if (c.expertRiskGrade === 'red' && c.humanReviewRequired) return false
  return true
}

/** 선정 후보로 지정 가능한 상태인지 (section 28 조건) */
export function isSelectable(c: AutomationCandidate): boolean {
  if (c.status === 'archived' || c.status === 'rejected') return false
  if (c.confidence === 'insufficient') return false
  if (c.name.trim() === '' || c.problemStatement.trim() === '') return false
  if (c.templateMix.length === 0) return false
  const criticalRiskUnresolved = candidateRiskLevel(c) === 'critical'
  if (criticalRiskUnresolved) return false
  return true
}

export interface CandidateRecommendation {
  primary: AutomationCandidate | null
  secondary: AutomationCandidate[]
  top: AutomationCandidate[]
  reasonsById: Record<string, CandidateSelectionReason[]>
}

function autoReasons(c: AutomationCandidate): CandidateSelectionReason[] {
  const reasons: CandidateSelectionReason[] = []
  if (c.quadrant === 'quick_win') reasons.push('quick_win')
  const opImpact = c.domainScores.find((d) => d.domain === 'operational_impact')
  if (opImpact && opImpact.normalizedScore >= 65) reasons.push('high_impact')
  const dataReady = c.domainScores.find((d) => d.domain === 'data_readiness')
  if (dataReady && dataReady.normalizedScore >= 60) reasons.push('data_ready')
  if (c.ownerRole === 'worker') reasons.push('field_demand')
  const funding = c.domainScores.find((d) => d.domain === 'funding_scalability')
  if (funding && funding.normalizedScore >= 60) reasons.push('funding_value')
  if (reasons.length === 0) reasons.push('strategic_value')
  return reasons
}

/**
 * 규칙 기반 핵심·보조 과제 추천. (순수 함수)
 * 점수가 가장 높아도 primary 부적격 조건이면 제외한다.
 */
export function recommendCandidates(
  candidates: AutomationCandidate[],
): CandidateRecommendation {
  const active = candidates.filter((c) => c.status !== 'archived' && c.status !== 'rejected')
  const sorted = [...active].sort((a, b) => b.priorityScore - a.priorityScore)
  const top = sorted.slice(0, 3)

  const primary = sorted.find((c) => isPrimaryEligible(c) && isSelectable(c)) ?? null

  const secondary = sorted
    .filter(
      (c) =>
        c.id !== primary?.id &&
        isSelectable(c) &&
        // primary와 동일 업무군·동일 generationKey 중복 방지
        !(primary && c.taskFamily === primary.taskFamily && c.name === primary.name),
    )
    .slice(0, 2)

  const reasonsById: Record<string, CandidateSelectionReason[]> = {}
  if (primary) reasonsById[primary.id] = autoReasons(primary)
  secondary.forEach((c) => (reasonsById[c.id] = autoReasons(c)))

  return { primary, secondary, top, reasonsById }
}

/** 규칙 기반 선정 요약 초안 */
export function buildSelectionSummary(
  _project: Project,
  organization: Organization | null,
  primary: AutomationCandidate | null,
  secondary: AutomationCandidate[],
): string {
  const org = organization?.name ?? '고객사'
  if (!primary) {
    return `${org}의 후보 중 지금 바로 1차 MVP로 확정할 수 있는 핵심 과제가 확인되지 않았습니다. 선행 준비 또는 추가 확인이 필요합니다.`
  }
  const familyLabel = TASK_FAMILY_META[primary.taskFamily].label
  const quadrant = QUADRANT_META[primary.quadrant].label
  const hoursEffect = primary.expectedEffects.find((e) => e.type === 'time_saving' && !e.notEstimable)
  const effectText = hoursEffect
    ? `월 약 ${hoursEffect.currentValue}시간 규모의 반복 업무를 대상으로 하며 `
    : ''
  const secondaryText =
    secondary.length > 0
      ? ` 후속으로 ${secondary.map((s) => s.name).join(', ')}을(를) 2차 고도화 후보로 분리합니다.`
      : ''
  return `${org}의 1차 핵심 과제는 '${primary.name}'(${familyLabel})로 추천합니다. ${effectText}${quadrant} 영역에 위치해 ${primary.automationApproach === 'workflow_automation' ? '워크플로 자동화' : primary.automationApproach === 'rule_based' ? '규칙 기반' : 'AI 보조 포함'} 방식으로 MVP-lite 수준에서 검증할 수 있습니다.${secondaryText} (규칙 기반 계산)`
}

/** primary 후보의 기대 KPI 초안 */
export function suggestPrimaryKpis(primary: AutomationCandidate | null): string[] {
  if (!primary) return []
  const kpis: string[] = []
  if (primary.metrics.some((m) => m.type === 'monthly_hours')) kpis.push('월 처리시간')
  if (primary.metrics.some((m) => m.type === 'monthly_volume')) kpis.push('월 처리 가능 건수')
  if (primary.metrics.some((m) => m.type === 'error_count') || primary.taskFamily === 'data_validation') kpis.push('오류·누락 건수')
  kpis.push('사용 횟수·사용자 수')
  return [...new Set(kpis)]
}
