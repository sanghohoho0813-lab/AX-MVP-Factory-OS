import type { RendererProps } from './types'

const optionClass = (checked: boolean) =>
  `flex cursor-pointer items-center gap-2.5 rounded-(--radius-control) border px-3 py-2.5 text-sm transition-colors ${
    checked
      ? 'border-brand-600 bg-brand-50 text-brand-800'
      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
  }`

export function SingleChoiceQuestion({ question, answer, onAnswer, disabled }: RendererProps) {
  const current = answer?.kind === 'choice' ? answer.value : ''
  const options = [...question.options].sort((a, b) => a.orderIndex - b.orderIndex)
  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => (
        <label key={option.id} className={optionClass(current === option.value)}>
          <input
            type="radio"
            name={question.id}
            value={option.value}
            checked={current === option.value}
            disabled={disabled}
            onChange={() => onAnswer({ kind: 'choice', value: option.value })}
            className="size-4 accent-brand-600"
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}

export function MultipleChoiceQuestion({ question, answer, onAnswer, disabled }: RendererProps) {
  const current = answer?.kind === 'multi' ? answer.value : []
  const options = [...question.options].sort((a, b) => a.orderIndex - b.orderIndex)
  const toggle = (value: string) => {
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onAnswer({ kind: 'multi', value: next })
  }
  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => (
        <label key={option.id} className={optionClass(current.includes(option.value))}>
          <input
            type="checkbox"
            value={option.value}
            checked={current.includes(option.value)}
            disabled={disabled}
            onChange={() => toggle(option.value)}
            className="size-4 accent-brand-600"
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}

export function ScaleQuestion({ question, answer, onAnswer, disabled }: RendererProps) {
  const current = answer?.kind === 'choice' ? answer.value : ''
  const options = [...question.options].sort((a, b) => a.orderIndex - b.orderIndex)
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const checked = current === option.value
        return (
          <label
            key={option.id}
            className={`flex min-w-16 flex-1 cursor-pointer flex-col items-center gap-1 rounded-(--radius-control) border px-2 py-2.5 text-center text-[0.875rem] transition-colors ${
              checked
                ? 'border-brand-600 bg-brand-50 text-brand-800'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name={question.id}
              value={option.value}
              checked={checked}
              disabled={disabled}
              onChange={() => onAnswer({ kind: 'choice', value: option.value })}
              className="sr-only"
            />
            <span className="text-base font-semibold">{option.value}</span>
            <span className="break-keep">{option.label}</span>
          </label>
        )
      })}
    </div>
  )
}
