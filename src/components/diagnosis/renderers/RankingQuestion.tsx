import { ChevronDown, ChevronUp } from 'lucide-react'
import { useMemo } from 'react'
import type { RendererProps } from './types'

/** 순서 정렬 — 드래그 대신 위·아래 버튼으로 순서 조정 */
export function RankingQuestion({ question, answer, onAnswer, disabled }: RendererProps) {
  const labelByValue = useMemo(
    () => new Map(question.options.map((o) => [o.value, o.label])),
    [question.options],
  )
  const baseOrder = useMemo(
    () =>
      [...question.options]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((o) => o.value),
    [question.options],
  )
  const order = answer?.kind === 'ranking' && answer.order.length > 0
    ? answer.order
    : baseOrder

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= order.length) return
    const copy = [...order]
    ;[copy[index], copy[next]] = [copy[next], copy[index]]
    onAnswer({ kind: 'ranking', order: copy })
  }

  return (
    <ol className="flex flex-col gap-2">
      {order.map((value, index) => (
        <li
          key={value}
          className="flex items-center gap-3 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[0.875rem] font-semibold text-slate-600">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
            {labelByValue.get(value) ?? value}
          </span>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              aria-label={`${index + 1}번 항목 위로`}
              disabled={disabled || index === 0}
              onClick={() => move(index, -1)}
              className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronUp aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              aria-label={`${index + 1}번 항목 아래로`}
              disabled={disabled || index === order.length - 1}
              onClick={() => move(index, 1)}
              className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronDown aria-hidden="true" className="size-4" />
            </button>
          </div>
        </li>
      ))}
    </ol>
  )
}
