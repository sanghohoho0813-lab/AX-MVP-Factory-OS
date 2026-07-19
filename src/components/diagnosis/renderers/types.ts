import type {
  QuestionCondition,
  QuestionOption,
  QuestionType,
  RepeatTableColumn,
} from '../../../types/survey'

/** 렌더러가 필요로 하는 최소 질문 정보 (Question·Snapshot 공통) */
export interface RenderQuestion {
  id: string
  text: string
  helpText: string
  example: string
  type: QuestionType
  options: QuestionOption[]
  repeatTableColumns: RepeatTableColumn[]
}

/** 미리보기 답변 값 (discriminated union — 화면 상태에만 유지) */
export type SurveyAnswer =
  | { kind: 'text'; value: string }
  | { kind: 'choice'; value: string }
  | { kind: 'multi'; value: string[] }
  | { kind: 'table'; rows: Array<Record<string, string>> }
  | { kind: 'ranking'; order: string[] }

export interface RendererProps {
  question: RenderQuestion
  answer: SurveyAnswer | undefined
  onAnswer: (answer: SurveyAnswer) => void
  disabled?: boolean
}

/** 유형별 기본 답변 값 */
export function defaultAnswer(question: RenderQuestion): SurveyAnswer {
  switch (question.type) {
    case 'multiple_choice':
      return { kind: 'multi', value: [] }
    case 'single_choice':
    case 'yes_no':
    case 'scale_5':
      return { kind: 'choice', value: '' }
    case 'repeat_table':
      return { kind: 'table', rows: [] }
    case 'ranking':
      return {
        kind: 'ranking',
        order: [...question.options]
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((o) => o.value),
      }
    default:
      return { kind: 'text', value: '' }
  }
}

/**
 * 조건 평가: sourceQuestion의 답변이 조건을 만족하면 true(표시).
 * 조건이 없으면 항상 true.
 */
export function evaluateCondition(
  condition: QuestionCondition | null,
  sourceAnswer: SurveyAnswer | undefined,
): boolean {
  if (!condition) return true

  const target = condition.comparisonValue.trim()
  const answered = isAnswered(sourceAnswer)

  switch (condition.operator) {
    case 'is_answered':
      return answered
    case 'is_not_answered':
      return !answered
    case 'equals':
      return scalarValue(sourceAnswer) === target
    case 'not_equals':
      return scalarValue(sourceAnswer) !== target
    case 'includes':
      return multiValues(sourceAnswer).includes(target)
    case 'greater_than':
      return numericValue(sourceAnswer) > Number(target)
    case 'less_than':
      return numericValue(sourceAnswer) < Number(target)
    default:
      return true
  }
}

function isAnswered(answer: SurveyAnswer | undefined): boolean {
  if (!answer) return false
  switch (answer.kind) {
    case 'text':
    case 'choice':
      return answer.value.trim() !== ''
    case 'multi':
      return answer.value.length > 0
    case 'table':
      return answer.rows.length > 0
    case 'ranking':
      return answer.order.length > 0
  }
}

function scalarValue(answer: SurveyAnswer | undefined): string {
  if (!answer) return ''
  if (answer.kind === 'text' || answer.kind === 'choice') return answer.value
  return ''
}

function multiValues(answer: SurveyAnswer | undefined): string[] {
  if (!answer) return []
  if (answer.kind === 'multi') return answer.value
  if (answer.kind === 'choice') return [answer.value]
  return []
}

function numericValue(answer: SurveyAnswer | undefined): number {
  if (!answer) return Number.NaN
  if (answer.kind === 'text' || answer.kind === 'choice') {
    return Number(answer.value)
  }
  return Number.NaN
}
