import type { RespondentRole } from '../../types'
import type {
  AssessmentConfidence,
  DomainScore,
  ResponseComparisonItem,
} from '../../types/assessment'
import { surveyRolesForProject } from '../projectSurveyService'
import { TAG } from './scoringConfig'
import type { AnalysisDataset } from './analysisData'

export interface ConfidenceResult {
  confidence: AssessmentConfidence
  confidenceReason: string
  dataCompleteness: number
  respondentCoverage: number
  hasNumericData: boolean
  hasOwnerFieldComparison: boolean
  unresolvedCriticalConflicts: number
}

function completeness(dataset: AnalysisDataset): {
  overall: number
  requiredRate: number
} {
  let totalVisible = 0
  let totalAnswered = 0
  let requiredVisible = 0
  let requiredAnswered = 0
  for (const respondent of dataset.respondents) {
    for (const placement of respondent.visiblePlacements) {
      totalVisible += 1
      const normalized = respondent.normalizedById.get(placement.questionId)
      const answered = normalized?.answered ?? false
      if (answered) totalAnswered += 1
      if (placement.required) {
        requiredVisible += 1
        if (answered) requiredAnswered += 1
      }
    }
  }
  return {
    overall: totalVisible === 0 ? 0 : Math.round((totalAnswered / totalVisible) * 100),
    requiredRate:
      requiredVisible === 0 ? 100 : Math.round((requiredAnswered / requiredVisible) * 100),
  }
}

function hasNumericData(dataset: AnalysisDataset): boolean {
  return dataset.respondents.some(
    (r) =>
      (r.byTag.get(TAG.baselineTime)?.some((n) => n.answered) ?? false) ||
      (r.byTag.get(TAG.baselineError)?.some((n) => n.answered) ?? false),
  )
}

export function computeConfidence(
  dataset: AnalysisDataset,
  domainScores: DomainScore[],
  comparisons: ResponseComparisonItem[],
): ConfidenceResult {
  const expectedRoles = surveyRolesForProject(dataset.project)
  const rolesPresent = dataset.rolesPresent
  const respondentCoverage =
    expectedRoles.length === 0
      ? 0
      : Math.round(
          (rolesPresent.filter((r) => expectedRoles.includes(r)).length /
            expectedRoles.length) *
            100,
        )

  const { overall } = completeness(dataset)
  const numeric = hasNumericData(dataset)

  const hasOwner = rolesPresent.includes('owner')
  const hasField = (['worker', 'manager'] as RespondentRole[]).some((r) =>
    rolesPresent.includes(r),
  )
  const hasOwnerFieldComparison = hasOwner && hasField

  const measuredDomains = domainScores.filter((d) => d.measured).length
  const lowDomains = domainScores.filter(
    (d) => d.measured && d.confidence === 'low',
  ).length
  const unresolvedCriticalConflicts = comparisons.filter(
    (c) => c.status === 'major_gap' && c.importance === 'critical',
  ).length

  const single = dataset.respondents.length <= 1

  let confidence: AssessmentConfidence
  let reason: string

  if (overall < 25 || measuredDomains < 2) {
    confidence = 'insufficient'
    reason =
      '점수 산정에 필요한 최소 응답 데이터가 부족합니다. 핵심 문항 응답과 추가 응답자가 필요합니다.'
  } else if (
    hasOwnerFieldComparison &&
    overall >= 60 &&
    numeric &&
    lowDomains <= 1
  ) {
    confidence = 'high'
    reason =
      '대표자와 현장 응답이 모두 포함되고 핵심 영역 응답률과 수치 데이터가 충분합니다.'
  } else if (single) {
    confidence = 'low'
    reason = single
      ? '제출 응답이 1명뿐이라 인식 차이·실행 가능성 판단이 제한됩니다.'
      : '핵심 영역 응답이 부족합니다.'
  } else if (overall >= 45 && lowDomains <= 2) {
    confidence = 'medium'
    reason = !hasOwnerFieldComparison
      ? '일부 역할(대표자 또는 현장) 응답이 없어 실제 업무량·실행 가능성 판단이 제한됩니다.'
      : '정성 응답 위주이거나 일부 수치 데이터가 부족합니다.'
  } else {
    confidence = 'low'
    reason = '핵심 영역 다수의 응답률이 낮아 신뢰도가 낮습니다.'
  }

  return {
    confidence,
    confidenceReason: reason,
    dataCompleteness: overall,
    respondentCoverage,
    hasNumericData: numeric,
    hasOwnerFieldComparison,
    unresolvedCriticalConflicts,
  }
}

/** 데이터 충분도 세부(참고용) */
export function dataCompletenessDetail(dataset: AnalysisDataset) {
  const { overall, requiredRate } = completeness(dataset)
  return { overall, requiredRate }
}
