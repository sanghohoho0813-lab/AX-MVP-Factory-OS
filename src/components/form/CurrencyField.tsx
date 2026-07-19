import { FieldWrapper, inputClass } from './fields'
import { formatKrwCompact } from '../../lib/format'

interface CurrencyFieldProps {
  id: string
  label: string
  required?: boolean
  error?: string
  help?: string
  fullWidth?: boolean
  disabled?: boolean
  placeholder?: string
  value: number | null
  onChange: (value: number | null) => void
}

/** 원화 금액 입력 — 천 단위 구분 표시 + 억/만원 보조 표기, 음수 입력 불가 */
export function CurrencyField({
  id,
  label,
  required,
  error,
  help,
  fullWidth,
  disabled,
  placeholder,
  value,
  onChange,
}: CurrencyFieldProps) {
  const compact = value !== null ? formatKrwCompact(value) : ''
  const helpText = compact ? `약 ${compact}` : help

  return (
    <FieldWrapper
      id={id}
      label={label}
      required={required}
      help={helpText}
      error={error}
      fullWidth={fullWidth}
    >
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          placeholder={placeholder}
          value={value !== null ? value.toLocaleString('ko-KR') : ''}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '')
            if (digits === '') {
              onChange(null)
              return
            }
            const parsed = Number(digits)
            onChange(Number.isFinite(parsed) ? Math.max(0, parsed) : null)
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? `${id}-error` : helpText ? `${id}-help` : undefined
          }
          className={`${inputClass} pr-9 text-right`}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-400"
        >
          원
        </span>
      </div>
    </FieldWrapper>
  )
}
