import type { QuestionType, RiskSignalLevel } from '../../types/survey'
import type { SnapshotPlacement } from '../../types/survey'
import type {
  RepeatTableAnswer,
  SurveyAnswerValue,
  SurveyFileMetadata,
} from '../../types/surveyRuntime'
import type { ScoreConfidence } from '../../types/assessment'
import { formatKrw } from '../../lib/format'
import {
  NUMERIC_SCORING_RULES,
  repeatTableRowScore,
  textAnswerScore,
} from './scoringConfig'

export interface NormalizedAnswer {
  questionId: string
  questionCode: string
  type: QuestionType
  answered: boolean
  rawValue: SurveyAnswerValue
  displayValue: string
  /** 숫자·금액·시간에서 추출한 수치(없으면 null) */
  numericValue: number | null
  /** 0~100 점수화 값. 점수화 불가·미응답이면 null */
  normalizedScore: number | null
  scoreConfidence: ScoreConfidence
  selectedOptionValues: string[]
  selectedOptionScores: number[]
  rowCount: number
  riskSignals: RiskSignalLevel[]
}

function isFileMeta(value: SurveyAnswerValue): value is SurveyFileMetadata {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'localOnly' in value
  )
}

/** 문자열에서 보수적으로 첫 숫자를 추출 (쉼표 제거) */
export function extractLeadingNumber(text: string): number | null {
  const match = text.replace(/[,\s]/g, '').match(/-?\d+(\.\d+)?/)
  if (!match) return null
  const n = Number(match[0])
  return Number.isFinite(n) ? n : null
}

function toNumber(value: SurveyAnswerValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') return extractLeadingNumber(value)
  return null
}

/** 선택형 옵션 점수 범위 기준 0~100 정규화 */
function normalizeOptionScore(
  placement: SnapshotPlacement,
  optionScore: number,
): number | null {
  const scores = placement.options.map((o) => o.score)
  if (scores.length === 0) return null
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  if (max === min) return null // 점수 차가 없어 판별 불가
  const clamped = Math.max(min, Math.min(max, optionScore))
  return Math.round(((clamped - min) / (max - min)) * 100)
}

function optionByValue(placement: SnapshotPlacement, value: string) {
  return placement.options.find((o) => o.value === value)
}

function optionLabel(placement: SnapshotPlacement, value: string): string {
  return optionByValue(placement, value)?.label ?? value
}

/** repeat_table에서 실제 값이 있는 행 수 */
function countFilledRows(rows: RepeatTableAnswer[]): number {
  return rows.filter((row) =>
    Object.values(row).some((v) => String(v).trim() !== ''),
  ).length
}

/** 사람이 읽을 수 있는 근거 표현 */
export function formatEvidenceValue(
  placement: SnapshotPlacement,
  value: SurveyAnswerValue,
): string {
  if (value === undefined || value === null || value === '') return '미응답'
  switch (placement.type) {
    case 'single_choice':
    case 'yes_no':
    case 'scale_5':
      return optionLabel(placement, String(value))
    case 'multiple_choice':
      if (Array.isArray(value)) {
        if (value.length === 0) return '미응답'
        return (value as string[]).map((v) => optionLabel(placement, v)).join(', ')
      }
      return String(value)
    case 'currency':
      return formatKrw(Number(value) || 0)
    case 'number':
    case 'time':
      return typeof value === 'number'
        ? value.toLocaleString('ko-KR')
        : String(value)
    case 'ranking':
      if (Array.isArray(value)) {
        return (value as string[])
          .map((v, i) => `${i + 1}. ${optionLabel(placement, v)}`)
          .join(' / ')
      }
      return String(value)
    case 'repeat_table':
      if (Array.isArray(value) && !isFileMeta(value)) {
        const rows = value as RepeatTableAnswer[]
        const filled = countFilledRows(rows)
        return filled === 0 ? '미응답' : `${filled}개 항목 입력`
      }
      return '미응답'
    case 'file':
      return isFileMeta(value) ? `첨부: ${value.name}` : '미응답'
    default:
      return String(value)
  }
}

/**
 * 단일 답변을 정규화한다. (순수 함수)
 * tags는 숫자 문항의 명시적 점수화 규칙 판별에 사용한다.
 */
export function normalizeAnswerValue(
  placement: SnapshotPlacement,
  value: SurveyAnswerValue | undefined,
  tags: string[],
): NormalizedAnswer {
  const base: NormalizedAnswer = {
    questionId: placement.questionId,
    questionCode: placement.questionCode,
    type: placement.type,
    answered: false,
    rawValue: value ?? null,
    displayValue: '미응답',
    numericValue: null,
    normalizedScore: null,
    scoreConfidence: 'medium',
    selectedOptionValues: [],
    selectedOptionScores: [],
    rowCount: 0,
    riskSignals: [],
  }

  if (value === undefined || value === null || value === '') return base

  base.displayValue = formatEvidenceValue(placement, value)

  switch (placement.type) {
    case 'single_choice':
    case 'yes_no':
    case 'scale_5': {
      const v = String(value)
      const opt = optionByValue(placement, v)
      if (!opt) return base
      base.answered = true
      base.selectedOptionValues = [v]
      base.selectedOptionScores = [opt.score]
      base.riskSignals = opt.riskSignal !== 'none' ? [opt.riskSignal] : []
      base.normalizedScore = normalizeOptionScore(placement, opt.score)
      base.scoreConfidence = 'high'
      return base
    }
    case 'multiple_choice': {
      if (!Array.isArray(value)) return base
      const values = value as string[]
      if (values.length === 0) return base
      base.answered = true
      base.selectedOptionValues = values
      const opts = values.map((v) => optionByValue(placement, v)).filter(Boolean)
      base.selectedOptionScores = opts.map((o) => o!.score)
      base.riskSignals = opts
        .map((o) => o!.riskSignal)
        .filter((r) => r !== 'none')
      const normalized = opts
        .map((o) => normalizeOptionScore(placement, o!.score))
        .filter((n): n is number => n !== null)
      base.normalizedScore =
        normalized.length > 0
          ? Math.round(normalized.reduce((s, n) => s + n, 0) / normalized.length)
          : null
      base.scoreConfidence = 'high'
      return base
    }
    case 'number':
    case 'currency':
    case 'time': {
      const num = toNumber(value)
      base.answered = num !== null
      base.numericValue = num
      if (num === null) return base
      const rule = tags
        .map((t) => NUMERIC_SCORING_RULES[t])
        .find((r) => r !== undefined)
      if (rule) {
        const band = [...rule]
          .sort((a, b) => b.threshold - a.threshold)
          .find((b) => num >= b.threshold)
        base.normalizedScore = band ? band.score : 0
        base.scoreConfidence = 'medium'
      }
      return base
    }
    case 'short_text':
    case 'long_text': {
      const text = String(value)
      base.answered = text.trim() !== ''
      if (!base.answered) return base
      base.numericValue = extractLeadingNumber(text)
      base.normalizedScore = textAnswerScore(text)
      base.scoreConfidence = 'low'
      return base
    }
    case 'repeat_table': {
      if (!Array.isArray(value) || isFileMeta(value)) return base
      const rows = value as RepeatTableAnswer[]
      const filled = countFilledRows(rows)
      base.rowCount = filled
      base.answered = filled > 0
      if (filled === 0) return base
      base.normalizedScore = repeatTableRowScore(filled)
      base.scoreConfidence = 'medium'
      return base
    }
    case 'file': {
      base.answered = isFileMeta(value)
      return base
    }
    case 'ranking': {
      base.answered = Array.isArray(value) && value.length > 0
      if (Array.isArray(value)) base.selectedOptionValues = value as string[]
      return base
    }
    case 'date': {
      base.answered = String(value).trim() !== ''
      return base
    }
    default:
      return base
  }
}
