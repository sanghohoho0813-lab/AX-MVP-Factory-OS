import type { Question, QuestionType } from '../types/survey'
import { QUESTION_TYPE_META } from './surveyMeta'

/**
 * 조건부 질문 예상 노출률.
 * 조건부 질문은 항상 표시되지 않으므로 예상시간 계산 시 50%만 반영한다.
 */
export const CONDITIONAL_EXPOSURE_RATE = 0.5

/** 질문 유형별 기본 예상 응답시간(분) */
export function questionEstimateMinutes(type: QuestionType): number {
  return QUESTION_TYPE_META[type].estimateMinutes
}

/**
 * 질문 목록의 예상 소요시간(분).
 * conditionalCount만큼은 노출률을 적용해 부분 반영한다.
 * 계산 근거: 무조건 노출 질문은 100%, 조건부 질문은 CONDITIONAL_EXPOSURE_RATE 반영.
 */
export function estimateFromQuestions(
  questions: Question[],
  visibleCount: number,
  conditionalCount = 0,
): number {
  // 전체 합산 후, 조건부 질문 비율만큼 노출률을 반영해 근사한다.
  const total = questions.reduce(
    (sum, q) => sum + questionEstimateMinutes(q.type),
    0,
  )
  if (questions.length === 0) return 0
  const avgPerQuestion = total / questions.length
  const unconditional = Math.max(0, visibleCount - conditionalCount)
  const effective =
    unconditional + conditionalCount * CONDITIONAL_EXPOSURE_RATE
  const minutes = avgPerQuestion * effective
  return Math.round(minutes * 10) / 10
}

/** 유형별 예상시간의 단순 합 (조건 미고려) */
export function sumEstimateMinutes(types: QuestionType[]): number {
  const total = types.reduce((sum, t) => sum + questionEstimateMinutes(t), 0)
  return Math.round(total * 10) / 10
}
