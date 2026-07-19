import type {
  ConditionOperator,
  Question,
  QuestionCondition,
} from '../../types/survey'
import { CONDITION_OPERATOR_META } from '../../lib/surveyMeta'
import { questionNeedsOptions } from '../../lib/surveyMeta'

interface ConditionEditorProps {
  condition: QuestionCondition | null
  /** 현재 질문보다 앞에 배치된 답변 가능 질문들 */
  sourceQuestions: Question[]
  onChange: (condition: QuestionCondition | null) => void
}

const OPERATORS: ConditionOperator[] = [
  'equals',
  'not_equals',
  'includes',
  'greater_than',
  'less_than',
  'is_answered',
  'is_not_answered',
]

/** 단일 조건부 표시 규칙 편집기 (중첩 AND/OR 없음) */
export function ConditionEditor({
  condition,
  sourceQuestions,
  onChange,
}: ConditionEditorProps) {
  const enabled = condition !== null
  const source = condition
    ? sourceQuestions.find((q) => q.id === condition.sourceQuestionId)
    : undefined
  const operatorMeta = condition
    ? CONDITION_OPERATOR_META[condition.operator]
    : null

  const toggle = (on: boolean) => {
    if (!on) {
      onChange(null)
      return
    }
    const first = sourceQuestions[0]
    onChange({
      sourceQuestionId: first?.id ?? '',
      operator: 'equals',
      comparisonValue: '',
    })
  }

  return (
    <div className="mt-2 rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2.5">
      <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-slate-700">
        <input
          type="checkbox"
          checked={enabled}
          disabled={sourceQuestions.length === 0}
          onChange={(e) => toggle(e.target.checked)}
          className="size-3.5 accent-brand-600"
        />
        조건부 표시
        {sourceQuestions.length === 0 && (
          <span className="text-xs font-normal text-slate-400">
            (앞에 배치된 질문이 있어야 설정할 수 있습니다)
          </span>
        )}
      </label>

      {enabled && condition && (
        <div className="mt-2.5 flex flex-col gap-2">
          <p className="text-xs text-slate-500">
            아래 조건을 만족할 때 이 질문을 표시합니다.
          </p>
          <select
            aria-label="조건 기준 질문"
            value={condition.sourceQuestionId}
            onChange={(e) =>
              onChange({ ...condition, sourceQuestionId: e.target.value })
            }
            className="h-9 w-full rounded-lg border border-slate-300 px-2 text-[13px]"
          >
            {sourceQuestions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.code} · {q.text.slice(0, 24)}
              </option>
            ))}
          </select>
          <select
            aria-label="조건 연산자"
            value={condition.operator}
            onChange={(e) =>
              onChange({
                ...condition,
                operator: e.target.value as ConditionOperator,
              })
            }
            className="h-9 w-full rounded-lg border border-slate-300 px-2 text-[13px]"
          >
            {OPERATORS.map((op) => (
              <option key={op} value={op}>
                {CONDITION_OPERATOR_META[op].label}
              </option>
            ))}
          </select>
          {operatorMeta?.needsValue &&
            (source && questionNeedsOptions(source.type) ? (
              <select
                aria-label="비교값"
                value={condition.comparisonValue}
                onChange={(e) =>
                  onChange({ ...condition, comparisonValue: e.target.value })
                }
                className="h-9 w-full rounded-lg border border-slate-300 px-2 text-[13px]"
              >
                <option value="">값 선택</option>
                {source.options.map((o) => (
                  <option key={o.id} value={o.value}>
                    {o.label} ({o.value})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                aria-label="비교값"
                value={condition.comparisonValue}
                onChange={(e) =>
                  onChange({ ...condition, comparisonValue: e.target.value })
                }
                placeholder="비교값 입력"
                className="h-9 w-full rounded-lg border border-slate-300 px-2 text-[13px]"
              />
            ))}
        </div>
      )}
    </div>
  )
}
