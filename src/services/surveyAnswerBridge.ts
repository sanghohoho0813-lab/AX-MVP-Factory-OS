import type { QuestionType } from '../types/survey'
import type {
  RepeatTableAnswer,
  SurveyAnswerValue,
  SurveyFileMetadata,
} from '../types/surveyRuntime'
import type { SurveyAnswer } from '../components/diagnosis/renderers/types'

/** 렌더러 답변(SurveyAnswer) → 저장 값(SurveyAnswerValue) */
export function answerToValue(answer: SurveyAnswer): SurveyAnswerValue {
  switch (answer.kind) {
    case 'text':
    case 'choice':
      return answer.value
    case 'multi':
      return answer.value
    case 'ranking':
      return answer.order
    case 'table':
      // 완전히 빈 행은 제거
      return answer.rows.filter((row) =>
        Object.values(row).some((v) => v.trim() !== ''),
      )
    case 'file':
      return answer.file
  }
}

/** 저장 값(SurveyAnswerValue) → 렌더러 답변(SurveyAnswer), 질문 유형 기준 */
export function valueToAnswer(
  value: SurveyAnswerValue,
  type: QuestionType,
  fallbackOrder: string[],
): SurveyAnswer {
  switch (type) {
    case 'multiple_choice':
      return { kind: 'multi', value: Array.isArray(value) ? (value as string[]) : [] }
    case 'ranking':
      return {
        kind: 'ranking',
        order:
          Array.isArray(value) && value.length > 0
            ? (value as string[])
            : fallbackOrder,
      }
    case 'repeat_table':
      return {
        kind: 'table',
        rows: Array.isArray(value) ? (value as RepeatTableAnswer[]) : [],
      }
    case 'file':
      return {
        kind: 'file',
        file:
          value && typeof value === 'object' && !Array.isArray(value)
            ? (value as SurveyFileMetadata)
            : null,
      }
    case 'single_choice':
    case 'yes_no':
    case 'scale_5':
      return { kind: 'choice', value: typeof value === 'string' ? value : '' }
    default:
      return {
        kind: 'text',
        value:
          typeof value === 'string'
            ? value
            : typeof value === 'number'
              ? String(value)
              : '',
      }
  }
}

/** 저장 값이 "응답됨"인지 유형별로 판정 */
export function isValueAnswered(
  value: SurveyAnswerValue | undefined,
  type: QuestionType,
): boolean {
  if (value === undefined || value === null) return false
  switch (type) {
    case 'short_text':
    case 'long_text':
    case 'single_choice':
    case 'yes_no':
    case 'scale_5':
    case 'time':
    case 'date':
      return typeof value === 'string' && value.trim() !== ''
    case 'number':
    case 'currency':
      // 0도 정상 응답
      if (typeof value === 'number') return true
      return typeof value === 'string' && value.trim() !== ''
    case 'multiple_choice':
      return Array.isArray(value) && value.length > 0
    case 'ranking':
      return Array.isArray(value) && value.length > 0
    case 'repeat_table':
      return (
        Array.isArray(value) &&
        (value as RepeatTableAnswer[]).some((row) =>
          Object.values(row).some((v) => String(v).trim() !== ''),
        )
      )
    case 'file':
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    default:
      return false
  }
}
