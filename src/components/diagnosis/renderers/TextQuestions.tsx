import type { RendererProps } from './types'

const inputClass =
  'h-11 w-full rounded-(--radius-control) border border-slate-300 px-3 text-sm focus:border-brand-500 disabled:bg-slate-50'

const SHORT_MAX = 300
const LONG_MAX = 3000

export function TextQuestion({ question, answer, onAnswer, disabled }: RendererProps) {
  const value = answer?.kind === 'text' ? answer.value : ''
  if (question.type === 'long_text') {
    return (
      <div>
        <textarea
          rows={4}
          value={value}
          maxLength={LONG_MAX}
          disabled={disabled}
          placeholder={question.example ? `예: ${question.example}` : undefined}
          onChange={(e) => onAnswer({ kind: 'text', value: e.target.value })}
          className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 disabled:bg-slate-50"
        />
        <p className="mt-1 text-right text-[0.875rem] text-slate-400">
          {value.length} / {LONG_MAX}
        </p>
      </div>
    )
  }
  return (
    <div>
      <input
        type="text"
        value={value}
        maxLength={SHORT_MAX}
        disabled={disabled}
        placeholder={question.example ? `예: ${question.example}` : undefined}
        onChange={(e) => onAnswer({ kind: 'text', value: e.target.value })}
        className={inputClass}
      />
      {value.length > SHORT_MAX * 0.7 && (
        <p className="mt-1 text-right text-[0.875rem] text-slate-400">
          {value.length} / {SHORT_MAX}
        </p>
      )}
    </div>
  )
}

export function NumberQuestion({ question, answer, onAnswer, disabled }: RendererProps) {
  const value = answer?.kind === 'text' ? answer.value : ''
  const type =
    question.type === 'time' ? 'time' : question.type === 'date' ? 'date' : 'text'
  const inputMode =
    question.type === 'number' || question.type === 'currency'
      ? 'numeric'
      : undefined
  const suffix = question.type === 'currency' ? '원' : ''
  return (
    <div className="relative max-w-xs">
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        disabled={disabled}
        placeholder={question.example || undefined}
        onChange={(e) => {
          const raw = e.target.value
          const next =
            question.type === 'currency' || question.type === 'number'
              ? raw.replace(/[^\d.-]/g, '')
              : raw
          onAnswer({ kind: 'text', value: next })
        }}
        className={`${inputClass} ${suffix ? 'pr-8 text-right' : ''}`}
      />
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-400">
          {suffix}
        </span>
      )}
    </div>
  )
}
