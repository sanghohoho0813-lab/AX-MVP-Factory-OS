import type { Question, QuestionInput } from '../types/survey'
import { questionNeedsColumns, questionNeedsOptions } from '../lib/surveyMeta'
import { questionRepository } from '../repositories'

export type QuestionFieldError =
  | 'code'
  | 'text'
  | 'type'
  | 'options'
  | 'repeatTableColumns'
  | 'scoringWeight'
  | 'riskReason'
  | 'industryKeys'
  | 'objectiveKeys'

export type QuestionErrors = Partial<Record<QuestionFieldError, string>>

/**
 * 질문 입력 검증 (순수 함수 + 코드 중복은 repository로 확인).
 * 저장 전 UI에서 호출한다.
 */
export function validateQuestion(
  input: QuestionInput,
  excludeId?: string,
): QuestionErrors {
  const errors: QuestionErrors = {}

  if (!input.code.trim()) {
    errors.code = '질문 코드를 입력해 주세요.'
  } else if (questionRepository.isCodeTaken(input.code, excludeId)) {
    errors.code = '이미 사용 중인 질문 코드입니다.'
  }

  if (!input.text.trim()) errors.text = '질문 문구를 입력해 주세요.'

  if (questionNeedsOptions(input.type)) {
    if (input.options.length < 2) {
      errors.options = '선택형 질문은 선택지가 최소 2개 필요합니다.'
    } else {
      const values = input.options.map((o) => o.value.trim())
      if (values.some((v) => v === '')) {
        errors.options = '모든 선택지의 내부값을 입력해 주세요.'
      } else if (new Set(values).size !== values.length) {
        errors.options = '선택지 내부값은 중복될 수 없습니다.'
      }
    }
  }

  if (questionNeedsColumns(input.type) && input.repeatTableColumns.length < 2) {
    errors.repeatTableColumns = '표 반복 입력은 컬럼이 최소 2개 필요합니다.'
  }

  if (input.scoringDomain === 'none') {
    if (input.scoringWeight !== 0) {
      errors.scoringWeight = '점수 영역이 없으면 가중치는 0이어야 합니다.'
    }
  } else if (input.scoringWeight < 1 || input.scoringWeight > 5) {
    errors.scoringWeight = '점수 가중치는 1~5 사이여야 합니다.'
  }

  if (input.expertRiskGrade === 'red' && !input.riskReason.trim()) {
    errors.riskReason = '전문가 최종 확인 등급은 위험 이유가 필요합니다.'
  }

  if (input.scope === 'industry' && input.industryKeys.length === 0) {
    errors.industryKeys = '업종 특화 질문은 관련 업종을 1개 이상 선택해 주세요.'
  }
  if (input.scope === 'objective' && input.objectiveKeys.length === 0) {
    errors.objectiveKeys = '목적 특화 질문은 관련 목적을 1개 이상 선택해 주세요.'
  }

  return errors
}

/** 유형에 맞지 않는 옵션·컬럼을 정리해 저장 안정성을 보장한다 */
export function normalizeQuestionInput(input: QuestionInput): QuestionInput {
  return {
    ...input,
    code: input.code.trim().toUpperCase(),
    text: input.text.trim(),
    options: questionNeedsOptions(input.type) ? input.options : [],
    repeatTableColumns: questionNeedsColumns(input.type)
      ? input.repeatTableColumns
      : [],
    scoringWeight: input.scoringDomain === 'none' ? 0 : input.scoringWeight,
    industryKeys: input.scope === 'industry' ? input.industryKeys : [],
    objectiveKeys: input.scope === 'objective' ? input.objectiveKeys : [],
  }
}

export function createQuestion(input: QuestionInput): Question {
  return questionRepository.create(normalizeQuestionInput(input))
}

export function updateQuestion(id: string, input: QuestionInput): Question {
  return questionRepository.update(id, normalizeQuestionInput(input))
}
