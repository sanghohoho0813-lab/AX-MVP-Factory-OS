import type { SnapshotPlacement } from '../../types/survey'
import type {
  AssessmentEvidence,
  AssessmentEvidenceType,
} from '../../types/assessment'
import type { NormalizedAnswer } from './answerNormalization'
import type { RespondentDataset } from './analysisData'

/** 결정적(비랜덤) 근거 ID — 재분석 시 동일 입력에 동일 ID */
export function evidenceId(
  responseId: string,
  questionCode: string,
  kind = 'a',
): string {
  return `ev-${kind}-${responseId}-${questionCode}`
}

export interface BuildEvidenceInput {
  projectId: string
  respondent: RespondentDataset
  placement: SnapshotPlacement
  normalized: NormalizedAnswer
  weight: number
  evidenceType: AssessmentEvidenceType
  explanation: string
  analyzedAt: string
}

export function buildAnswerEvidence(input: BuildEvidenceInput): AssessmentEvidence {
  const { placement, normalized, respondent } = input
  const contribution =
    normalized.normalizedScore !== null
      ? Math.round(normalized.normalizedScore * input.weight * 10) / 10
      : 0
  return {
    id: evidenceId(
      respondent.responseId,
      placement.questionCode,
      input.evidenceType === 'answer' ? 'a' : input.evidenceType.slice(0, 3),
    ),
    projectId: input.projectId,
    distributionId: respondent.distributionId,
    responseId: respondent.responseId,
    respondentRole: respondent.role,
    respondentName: respondent.respondentName,
    questionId: placement.questionId,
    questionCode: placement.questionCode,
    questionText: placement.questionText,
    category: placement.category,
    scoringDomain: placement.scoringDomain,
    answerValue: normalized.displayValue,
    normalizedValue: normalized.normalizedScore,
    evidenceType: input.evidenceType,
    weight: input.weight,
    contribution,
    explanation: input.explanation,
    createdAt: input.analyzedAt,
  }
}
