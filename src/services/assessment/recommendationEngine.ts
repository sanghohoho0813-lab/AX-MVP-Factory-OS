import type {
  AnalysisIssueInput,
  AssessmentRecommendation,
  DomainScore,
} from '../../types/assessment'
import { recommendationForScore, TAG } from './scoringConfig'
import { answersForTag, type AnalysisDataset } from './analysisData'
import type { ConfidenceResult } from './confidenceEngine'

export interface RecommendationResult {
  baseRecommendation: AssessmentRecommendation
  recommendation: AssessmentRecommendation
  exceptionReason: string
}

/**
 * 판정 계산. (순수 함수)
 * 점수 구간 기반 기본 판정 + 예외 판정(데이터 부족·도입 의지 부족·전문가 위험).
 */
export function decideRecommendation(
  finalScore: number,
  dataset: AnalysisDataset,
  domainScores: DomainScore[],
  confidence: ConfidenceResult,
  issues: AnalysisIssueInput[],
): RecommendationResult {
  const base = recommendationForScore(finalScore)

  // 예외 C: 전문가 위험 (critical)
  const criticalExpert = issues.some(
    (i) =>
      (i.type === 'expert_review' || i.type === 'risk_signal') &&
      i.severity === 'critical',
  )
  if (criticalExpert) {
    return {
      baseRecommendation: base,
      recommendation: 'expert_review_required',
      exceptionReason:
        '세무·노무·법무 등 전문가 최종 판단 또는 개인정보 위험이 커 전문가 검토가 우선입니다.',
    }
  }

  // 예외 A: 데이터 부족
  const lowConfidenceCore = domainScores.filter(
    (d) => d.measured && d.confidence === 'low',
  ).length
  const dataInsufficient =
    confidence.confidence === 'insufficient' ||
    confidence.dataCompleteness < 40 ||
    lowConfidenceCore >= 3
  if (dataInsufficient) {
    return {
      baseRecommendation: base,
      recommendation: 'build_deferred_data',
      exceptionReason:
        '핵심 데이터가 부족해(데이터 충분도·신뢰도 미달) 지금 구축을 확정하기 어렵습니다.',
    }
  }

  // 예외 B: 도입 의지 부족
  const adoption = domainScores.find((d) => d.domain === 'adoption')
  const feedbackNo = answersForTag(dataset, TAG.feedbackCadence).some(
    (a) => String(a.normalized.rawValue) === 'no',
  )
  const noWorker = !dataset.rolesPresent.includes('worker')
  const adoptionLow =
    (adoption?.measured && adoption.normalizedScore < 30) ||
    (feedbackNo && noWorker)
  if (adoptionLow) {
    return {
      baseRecommendation: base,
      recommendation: 'build_deferred_adoption',
      exceptionReason:
        '실제 사용·운영 의지 또는 담당자·피드백 여건이 확인되지 않아 구축을 보류합니다.',
    }
  }

  return {
    baseRecommendation: base,
    recommendation: base,
    exceptionReason: '',
  }
}
