import type { RespondentRole } from '../../types'
import type {
  ExpertRiskGrade,
  Question,
  QuestionCategory,
  QuestionOption,
  QuestionScope,
  QuestionType,
  RepeatColumnFieldType,
  RepeatTableColumn,
  RiskSignalLevel,
  ScoringDomain,
} from '../../types/survey'
import { questionNeedsColumns, questionNeedsOptions } from '../../lib/surveyMeta'

/** 시드 데이터 고정 타임스탬프 (Date.now 사용 불가 환경 대비) */
export const SEED_TS = '2026-07-01T00:00:00.000Z'

/** 선택지 축약 튜플: [라벨, 값, 점수, 위험신호?] */
export type OptSpec = [string, string, number, RiskSignalLevel?]

export function buildOptions(specs: OptSpec[]): QuestionOption[] {
  return specs.map((spec, index) => ({
    id: `opt-${index}`,
    label: spec[0],
    value: spec[1],
    score: spec[2],
    riskSignal: spec[3] ?? 'none',
    orderIndex: index,
  }))
}

/** 표 컬럼 축약 튜플: [라벨, 필드유형, 필수?, 단위?] */
export type ColSpec = [string, RepeatColumnFieldType, boolean?, string?]

export function buildColumns(specs: ColSpec[]): RepeatTableColumn[] {
  return specs.map((spec, index) => ({
    id: `col-${index}`,
    label: spec[0],
    fieldType: spec[1],
    required: spec[2] ?? false,
    unit: spec[3] ?? '',
    orderIndex: index,
  }))
}

/** yes/no 기본 선택지 */
export const YES_NO_OPTS: OptSpec[] = [
  ['예', 'yes', 1],
  ['아니오', 'no', 0],
]

/** 5점 척도 기본 선택지 */
export const SCALE_5_OPTS: OptSpec[] = [
  ['전혀 아니다', '1', 1],
  ['아니다', '2', 2],
  ['보통이다', '3', 3],
  ['그렇다', '4', 4],
  ['매우 그렇다', '5', 5],
]

export interface QuestionSpec {
  code: string
  text: string
  type: QuestionType
  category: QuestionCategory
  role: RespondentRole
  scope: QuestionScope
  help?: string
  example?: string
  industryKeys?: string[]
  objectiveKeys?: string[]
  required?: boolean
  scoring?: ScoringDomain
  weight?: number
  risk?: ExpertRiskGrade
  riskReason?: string
  tags?: string[]
  options?: OptSpec[]
  columns?: ColSpec[]
}

/** 축약 스펙 → 완전한 Question 객체 */
export function buildQuestion(spec: QuestionSpec): Question {
  const scoring = spec.scoring ?? 'none'
  const weight = scoring === 'none' ? 0 : (spec.weight ?? 2)

  let options: QuestionOption[] = []
  if (questionNeedsOptions(spec.type)) {
    if (spec.options) options = buildOptions(spec.options)
    else if (spec.type === 'yes_no') options = buildOptions(YES_NO_OPTS)
    else if (spec.type === 'scale_5') options = buildOptions(SCALE_5_OPTS)
  }

  const repeatTableColumns = questionNeedsColumns(spec.type)
    ? buildColumns(spec.columns ?? [])
    : []

  return {
    id: `q-${spec.code}`,
    code: spec.code,
    text: spec.text,
    helpText: spec.help ?? '',
    example: spec.example ?? '',
    type: spec.type,
    category: spec.category,
    respondentRole: spec.role,
    scope: spec.scope,
    industryKeys: spec.industryKeys ?? [],
    objectiveKeys: spec.objectiveKeys ?? [],
    requiredDefault: spec.required ?? false,
    scoringDomain: scoring,
    scoringWeight: weight,
    expertRiskGrade: spec.risk ?? 'green',
    riskReason: spec.riskReason ?? '',
    analysisTags: spec.tags ?? [],
    options,
    repeatTableColumns,
    active: true,
    version: 1,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
    archivedAt: null,
  }
}
