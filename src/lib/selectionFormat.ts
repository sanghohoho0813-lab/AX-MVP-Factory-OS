import type {
  AutomationCandidate,
  CandidateMetric,
  ExpectedEffect,
} from '../types/selection'

/** 월 예상 절감시간 요약 — 계산 불가면 null */
export function monthlySavingHours(candidate: AutomationCandidate): number | null {
  const effect = candidate.expectedEffects.find(
    (e) => e.type === 'time_saving' && !e.notEstimable && e.currentValue !== null && e.expectedValue !== null,
  )
  if (!effect || effect.currentValue === null || effect.expectedValue === null) return null
  return Math.round((effect.currentValue - effect.expectedValue) * 10) / 10
}

export function monthlySavingLabel(candidate: AutomationCandidate): string {
  const saved = monthlySavingHours(candidate)
  return saved === null ? '산정 필요' : `월 약 ${saved.toLocaleString('ko-KR')}시간`
}

export function metricText(metric: CandidateMetric): string {
  if (metric.value === null) return `${metric.label} 산정 필요`
  return `${metric.label} ${Number(metric.value).toLocaleString('ko-KR')}${metric.unit}`
}

export function effectText(effect: ExpectedEffect): string {
  if (effect.notEstimable) return `${effect.title} (산정 필요)`
  if (effect.qualitative) return effect.title
  if (effect.currentValue !== null && effect.expectedValue !== null) {
    return `${effect.title}: ${effect.currentValue.toLocaleString('ko-KR')} → ${effect.expectedValue.toLocaleString('ko-KR')} ${effect.unit}`
  }
  return effect.title
}

/** 후보의 주요 위험 요약(활성 감점 상위) */
export function topRiskText(candidate: AutomationCandidate): string | null {
  const active = candidate.deductions.filter((d) => !d.excluded)
  if (active.length === 0) return null
  return active[0].label
}
