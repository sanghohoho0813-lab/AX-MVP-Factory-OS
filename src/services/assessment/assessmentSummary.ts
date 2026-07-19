import type {
  AnalysisIssueInput,
  AssessmentDeduction,
  AssessmentRecommendation,
  DomainScore,
  ResponseComparisonItem,
} from '../../types/assessment'
import { ASSESSMENT_DOMAIN_META, RECOMMENDATION_META } from '../../lib/assessmentMeta'
import { RESPONDENT_ROLE_META } from '../../lib/surveyMeta'
import type { AnalysisDataset } from './analysisData'
import type { ConfidenceResult } from './confidenceEngine'

export interface AssessmentNarrative {
  keyStrengths: string[]
  keyWeaknesses: string[]
  keyRisks: string[]
  missingDataSummary: string[]
  conflictSummary: string[]
  suggestedNextActions: string[]
  autoSummary: string
}

const NEXT_ACTIONS_BY_RECOMMENDATION: Record<
  AssessmentRecommendation,
  string[]
> = {
  ax_strongly_recommended: [
    '핵심 업무를 대상으로 클릭형 프로토타입 또는 Level 1 MVP로 바로 진행',
    '개선 전후 KPI 측정 기준을 확정',
  ],
  simple_automation_recommended: [
    '핵심 업무 1개만 MVP-lite로 먼저 검증',
    '테스트 담당자와 주간 피드백 일정 확정',
  ],
  diagnosis_document_first: [
    '업무 흐름 정리와 문서 자동화부터 시작',
    '핵심 업무 범위를 확정한 뒤 재진단',
  ],
  funding_consulting_first: [
    '자금조달 컨설팅과 업무 정리를 우선 진행',
    '사업화 증빙 자료 준비 상태 점검',
  ],
  build_deferred_data: [
    '핵심 업무의 샘플 데이터 10건 이상 확보',
    '월 처리량·소요시간 등 수치 데이터 보완 후 재진단',
  ],
  build_deferred_adoption: [
    '실제 사용 담당자 지정과 사용 계획 확정',
    '도입 목적·운영 적용 계획 재확인 후 재검토',
  ],
  expert_review_required: [
    '개인정보·전문 판단 위험에 대한 전문가 검토 진행',
    '자동화 가능 범위와 사람 검토 범위를 구분해 재정의',
  ],
}

function measuredSorted(domainScores: DomainScore[]): DomainScore[] {
  return domainScores
    .filter((d) => d.measured)
    .sort((a, b) => b.normalizedScore - a.normalizedScore)
}

export function buildNarrative(
  dataset: AnalysisDataset,
  domainScores: DomainScore[],
  _deductions: AssessmentDeduction[],
  issues: AnalysisIssueInput[],
  comparisons: ResponseComparisonItem[],
  recommendation: AssessmentRecommendation,
  confidence: ConfidenceResult,
  finalScore: number,
): AssessmentNarrative {
  const measured = measuredSorted(domainScores)

  const keyStrengths = measured
    .filter((d) => d.normalizedScore >= 65)
    .slice(0, 4)
    .map(
      (d) =>
        `${ASSESSMENT_DOMAIN_META[d.domain].label}이(가) 우수합니다 (정규화 ${d.normalizedScore}점).`,
    )

  const keyWeaknesses = [...measured]
    .filter((d) => d.normalizedScore < 50)
    .sort((a, b) => a.normalizedScore - b.normalizedScore)
    .slice(0, 4)
    .map(
      (d) =>
        `${ASSESSMENT_DOMAIN_META[d.domain].label}이(가) 부족합니다 (정규화 ${d.normalizedScore}점).`,
    )

  const keyRisks = issues
    .filter(
      (i) =>
        i.type === 'risk_signal' ||
        i.type === 'expert_review' ||
        i.type === 'perception_gap' ||
        i.severity === 'critical',
    )
    .slice(0, 5)
    .map((i) => i.title)

  const missingDataSummary = issues
    .filter((i) => i.type === 'missing_data' || i.type === 'insufficient_response')
    .map((i) => i.title)

  const conflictSummary = comparisons
    .filter((c) => c.status === 'major_gap')
    .map((c) => `${c.title}: ${c.interpretation}`)

  const suggestedNextActions = [
    ...NEXT_ACTIONS_BY_RECOMMENDATION[recommendation],
  ]

  // 규칙 기반 요약 문장 조립
  const orgName = dataset.organization?.name ?? '고객사'
  const topStrength = measured[0]
  const worst = [...measured].sort(
    (a, b) => a.normalizedScore - b.normalizedScore,
  )[0]
  const roles = dataset.rolesPresent
    .map((r) => RESPONDENT_ROLE_META[r].label)
    .join('·')

  const parts: string[] = []
  if (topStrength && topStrength.normalizedScore >= 60) {
    parts.push(
      `${orgName}는 ${ASSESSMENT_DOMAIN_META[topStrength.domain].label} 측면에서 강점이 확인됩니다`,
    )
  } else {
    parts.push(`${orgName}의 제출 응답을 기준으로 진단을 수행했습니다`)
  }

  const conflict = comparisons.find((c) => c.status === 'major_gap')
  if (conflict) {
    parts.push(
      `다만 ${conflict.title}에서 응답자 간 차이가 있어 핵심 업무 범위 확정이 필요합니다`,
    )
  } else if (worst && worst.normalizedScore < 50) {
    parts.push(
      `다만 ${ASSESSMENT_DOMAIN_META[worst.domain].label}이(가) 부족해 보완이 필요합니다`,
    )
  }

  parts.push(
    `현재 판정은 '${RECOMMENDATION_META[recommendation].label}'이며, ${RECOMMENDATION_META[recommendation].description}`,
  )

  const coverageNote =
    confidence.confidence === 'high'
      ? ''
      : ` 응답 신뢰도가 ${confidence.confidence === 'insufficient' ? '미달' : '충분하지 않아'} 추가 응답·인터뷰로 보완하면 판단이 명확해집니다.`

  const autoSummary = `${parts.join('. ')}.${coverageNote} (제출 응답 ${dataset.respondents.length}명 · ${roles || '역할 미상'} · 최종 점수 ${finalScore}점, 규칙 기반 계산)`

  return {
    keyStrengths,
    keyWeaknesses,
    keyRisks,
    missingDataSummary,
    conflictSummary,
    suggestedNextActions,
    autoSummary,
  }
}
