import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

/* ------------------------------------------------------------------ */
/* 공통 래퍼                                                            */
/* ------------------------------------------------------------------ */

interface FieldWrapperProps {
  id: string
  label: string
  required?: boolean
  help?: string
  error?: string
  /** 두 열 그리드에서 한 줄 전체 사용 */
  fullWidth?: boolean
  children: ReactNode
}

export function FieldWrapper({
  id,
  label,
  required,
  help,
  error,
  fullWidth,
  children,
}: FieldWrapperProps) {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : ''}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-slate-700">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-danger-500">
            *
          </span>
        )}
        {required && <span className="sr-only">(필수)</span>}
      </label>
      {children}
      {help && !error && (
        <p id={`${id}-help`} className="mt-1 text-[0.875rem] break-keep text-slate-400">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-[0.875rem] break-keep text-danger-600">
          {error}
        </p>
      )}
    </div>
  )
}

export const inputClass =
  'h-10 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 text-[1rem] text-slate-800 placeholder:text-slate-400 focus:border-brand-500 disabled:bg-slate-50 disabled:text-slate-400 aria-invalid:border-danger-500'

function describedBy(id: string, help?: string, error?: string): string | undefined {
  if (error) return `${id}-error`
  if (help) return `${id}-help`
  return undefined
}

/* ------------------------------------------------------------------ */
/* 텍스트 입력                                                          */
/* ------------------------------------------------------------------ */

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string
  label: string
  help?: string
  error?: string
  fullWidth?: boolean
}

export function TextField({
  id,
  label,
  required,
  help,
  error,
  fullWidth,
  className = '',
  ...rest
}: TextFieldProps) {
  return (
    <FieldWrapper
      id={id}
      label={label}
      required={required}
      help={help}
      error={error}
      fullWidth={fullWidth}
    >
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, help, error)}
        className={`${inputClass} ${className}`}
        {...rest}
      />
    </FieldWrapper>
  )
}

/* ------------------------------------------------------------------ */
/* 셀렉트                                                               */
/* ------------------------------------------------------------------ */

export interface SelectOption {
  value: string
  label: string
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  id: string
  label: string
  options: SelectOption[]
  placeholder?: string
  help?: string
  error?: string
  fullWidth?: boolean
}

export function SelectField({
  id,
  label,
  required,
  options,
  placeholder,
  help,
  error,
  fullWidth,
  className = '',
  ...rest
}: SelectFieldProps) {
  return (
    <FieldWrapper
      id={id}
      label={label}
      required={required}
      help={help}
      error={error}
      fullWidth={fullWidth}
    >
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, help, error)}
        className={`${inputClass} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m4%206%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-position-[right_10px_center] bg-no-repeat pr-9 ${className}`}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  )
}

/* ------------------------------------------------------------------ */
/* 텍스트에어리어                                                        */
/* ------------------------------------------------------------------ */

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string
  label: string
  help?: string
  error?: string
  fullWidth?: boolean
}

export function TextAreaField({
  id,
  label,
  required,
  help,
  error,
  fullWidth = true,
  className = '',
  rows = 3,
  ...rest
}: TextAreaFieldProps) {
  return (
    <FieldWrapper
      id={id}
      label={label}
      required={required}
      help={help}
      error={error}
      fullWidth={fullWidth}
    >
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, help, error)}
        className={`w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2.5 text-[1rem] text-slate-800 placeholder:text-slate-400 focus:border-brand-500 aria-invalid:border-danger-500 ${className}`}
        {...rest}
      />
    </FieldWrapper>
  )
}

/* ------------------------------------------------------------------ */
/* 라디오 그룹 (예/아니오 등)                                            */
/* ------------------------------------------------------------------ */

interface RadioGroupFieldProps {
  id: string
  label: string
  required?: boolean
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  fullWidth?: boolean
}

export function RadioGroupField({
  id,
  label,
  required,
  value,
  options,
  onChange,
  fullWidth,
}: RadioGroupFieldProps) {
  return (
    <fieldset className={fullWidth ? 'sm:col-span-2' : ''}>
      <legend className="mb-1.5 block text-[13px] font-medium text-slate-700">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-danger-500">
            *
          </span>
        )}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = option.value === value
          return (
            <label
              key={option.value}
              className={`flex h-10 cursor-pointer items-center gap-2 rounded-(--radius-control) border px-3.5 text-sm font-medium transition-colors ${
                checked
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
              }`}
            >
              <input
                type="radio"
                name={id}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="size-3.5 accent-brand-600"
              />
              {option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/* ------------------------------------------------------------------ */
/* 체크박스 그룹 (복수 선택)                                             */
/* ------------------------------------------------------------------ */

interface CheckboxGroupFieldProps {
  label: string
  values: string[]
  options: readonly string[]
  onChange: (values: string[]) => void
  error?: string
  fullWidth?: boolean
  /** 저장값과 다른 표시 라벨이 필요할 때 */
  renderLabel?: (value: string) => string
}

export function CheckboxGroupField({
  label,
  values,
  options,
  onChange,
  error,
  fullWidth = true,
  renderLabel,
}: CheckboxGroupFieldProps) {
  return (
    <fieldset className={fullWidth ? 'sm:col-span-2' : ''}>
      <legend className="mb-1.5 block text-[13px] font-medium text-slate-700">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = values.includes(option)
          return (
            <label
              key={option}
              className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-(--radius-control) border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                checked
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? values.filter((v) => v !== option)
                      : [...values, option],
                  )
                }
                className="size-3.5 accent-brand-600"
              />
              {renderLabel ? renderLabel(option) : option}
            </label>
          )
        })}
      </div>
      {error && <p className="mt-1 text-[0.875rem] text-danger-600">{error}</p>}
    </fieldset>
  )
}
