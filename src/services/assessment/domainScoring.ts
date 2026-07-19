import type { RespondentRole } from '../../types'
import type { SnapshotPlacement } from '../../types/survey'
import type {
  AssessmentDomain,
  AssessmentEvidence,
  DomainScore,
  ScoreConfidence,
} from '../../types/assessment'
import { RESPONDENT_ROLE_META } from '../../lib/surveyMeta'
import { ASSESSMENT_DOMAIN_META } from '../../lib/assessmentMeta'
import {
  DOMAIN_MAX_SCORE,
  DOMAIN_ROLE_WEIGHT,
} from './scoringConfig'
import type { AnalysisDataset, RespondentDataset } from './analysisData'
import { buildAnswerEvidence } from './evidenceBuilder'

/** SnapshotPlacement.scoringDomain(문자열) → AssessmentDomain 매핑 */
const DOMAIN_KEYS: AssessmentDomain[] = [
  'repetition',
  'economic',
  'data_readiness',
  'process_clarity',
  'adoption',
  'execution',
  'funding_connection',
]

function isAssessmentDomain(value: string): value is AssessmentDomain {
  return (DOMAIN_KEYS as string[]).includes(value)
}

interface ScoredAnswer {
  respondent: RespondentDataset
  placement: SnapshotPlacement
  normalizedScore: number
  weight: number
}

export interface DomainScoringResult {
  domainScores: DomainScore[]
  evidence: AssessmentEvidence[]
  subtotalScore: number
  scoreCoverage: number
}

/** 역할별 가중치를 존재하는 역할에 대해 재정규화 */
function normalizedRoleWeights(
  domain: AssessmentDomain,
  rolesPresent: RespondentRole[],
): Record<string, number> {
  const weights = DOMAIN_ROLE_WEIGHT[domain]
  const total = rolesPresent.reduce((sum, role) => sum + weights[role], 0)
  const out: Record<string, number> = {}
  if (total === 0) {
    // 균등 분배 (이론상 도달하지 않음)
    rolesPresent.forEach((role) => (out[role] = 1 / rolesPresent.length))
    return out
  }
  rolesPresent.forEach((role) => (out[role] = weights[role] / total))
  return out
}

function domainConfidence(
  answeredCount: number,
  applicableCount: number,
  roleCount: number,
): ScoreConfidence {
  if (answeredCount === 0) return 'low'
  const coverage = applicableCount === 0 ? 0 : answeredCount / applicableCount
  if (coverage >= 0.66 && answeredCount >= 3 && roleCount >= 1) return 'high'
  if (coverage >= 0.4 && answeredCount >= 2) return 'medium'
  return 'low'
}

function scoreOneDomain(
  domain: AssessmentDomain,
  dataset: AnalysisDataset,
  analyzedAt: string,
): { score: DomainScore; evidence: AssessmentEvidence[] } {
  const maxScore = DOMAIN_MAX_SCORE[domain]
  const applicableQuestionIds = new Set<string>()
  const answeredQuestionIds = new Set<string>()
  const scored: ScoredAnswer[] = []
  const evidence: AssessmentEvidence[] = []

  for (const respondent of dataset.respondents) {
    for (const placement of respondent.visiblePlacements) {
      if (placement.scoringDomain !== domain) continue
      applicableQuestionIds.add(placement.questionId)
      const normalized = respondent.normalizedById.get(placement.questionId)
      if (!normalized || normalized.normalizedScore === null) continue
      answeredQuestionIds.add(placement.questionId)
      const weight = dataset.questionMeta(placement.questionId).scoringWeight
      scored.push({
        respondent,
        placement,
        normalizedScore: normalized.normalizedScore,
        weight,
      })
      evidence.push(
        buildAnswerEvidence({
          projectId: dataset.project.id,
          respondent,
          placement,
          normalized,
          weight,
          evidenceType: 'answer',
          explanation: `${RESPONDENT_ROLE_META[respondent.role].label} · 정규화 ${normalized.normalizedScore}점 (가중치 ${weight})`,
          analyzedAt,
        }),
      )
    }
  }

  const answeredCount = answeredQuestionIds.size
  const applicableCount = applicableQuestionIds.size

  // 역할별 가중 평균
  const byRole = new Map<RespondentRole, ScoredAnswer[]>()
  for (const s of scored) {
    const list = byRole.get(s.respondent.role) ?? []
    list.push(s)
    byRole.set(s.respondent.role, list)
  }
  const rolesPresent = [...byRole.keys()]

  let normalizedScore = 0
  const warnings: string[] = []

  if (scored.length > 0 && rolesPresent.length > 0) {
    const roleWeights = normalizedRoleWeights(domain, rolesPresent)
    for (const role of rolesPresent) {
      const answers = byRole.get(role) ?? []
      const wsum = answers.reduce((s, a) => s + a.weight, 0)
      const roleScore =
        wsum === 0
          ? 0
          : answers.reduce((s, a) => s + a.normalizedScore * a.weight, 0) / wsum
      normalizedScore += roleWeights[role] * roleScore
    }
    normalizedScore = Math.round(normalizedScore)
  }

  const measured = answeredCount > 0
  const confidence = domainConfidence(
    answeredCount,
    applicableCount,
    rolesPresent.length,
  )

  if (!measured) {
    warnings.push('점수화된 응답이 없어 이 영역은 총점 계산에서 제외됩니다.')
  } else if (confidence === 'low') {
    warnings.push('응답이 적어 이 영역 점수의 신뢰도가 낮습니다.')
  }

  const rawScore = measured
    ? Math.round((normalizedScore / 100) * maxScore * 10) / 10
    : 0

  const roleLabel = rolesPresent
    .map((r) => RESPONDENT_ROLE_META[r].label)
    .join('·')
  const explanation = measured
    ? `${ASSESSMENT_DOMAIN_META[domain].label}: 점수 대상 ${applicableCount}개 중 ${answeredCount}개 응답, ${roleLabel} 응답 기준 정규화 ${normalizedScore}점.`
    : `${ASSESSMENT_DOMAIN_META[domain].label}: 점수화된 응답이 없습니다.`

  const score: DomainScore = {
    domain,
    rawScore,
    maxScore,
    normalizedScore: measured ? normalizedScore : 0,
    evidenceCount: evidence.length,
    applicableQuestionCount: applicableCount,
    answeredQuestionCount: answeredCount,
    confidence,
    evidenceIds: evidence.map((e) => e.id),
    explanation,
    warnings,
    measured,
  }
  return { score, evidence }
}

/**
 * 전 영역 점수를 계산한다. (순수 함수 · 같은 입력에 같은 결과)
 * - 응답이 없는 영역은 총점 계산에서 제외하고, 측정 가능한 영역의 배점을 100으로 환산한다.
 */
export function scoreDomains(
  dataset: AnalysisDataset,
  analyzedAt: string,
): DomainScoringResult {
  const domainScores: DomainScore[] = []
  const evidence: AssessmentEvidence[] = []

  for (const domain of DOMAIN_KEYS) {
    const { score, evidence: ev } = scoreOneDomain(domain, dataset, analyzedAt)
    domainScores.push(score)
    evidence.push(...ev)
  }

  const measured = domainScores.filter((d) => d.measured)
  const measuredMax = measured.reduce((s, d) => s + d.maxScore, 0)
  const measuredRaw = measured.reduce((s, d) => s + d.rawScore, 0)
  const subtotalScore =
    measuredMax > 0
      ? Math.max(0, Math.min(100, Math.round((measuredRaw / measuredMax) * 100)))
      : 0

  const totalApplicable = domainScores.reduce(
    (s, d) => s + d.applicableQuestionCount,
    0,
  )
  const totalAnswered = domainScores.reduce(
    (s, d) => s + d.answeredQuestionCount,
    0,
  )
  const scoreCoverage =
    totalApplicable > 0
      ? Math.round((totalAnswered / totalApplicable) * 100)
      : 0

  return { domainScores, evidence, subtotalScore, scoreCoverage }
}

export { isAssessmentDomain }
