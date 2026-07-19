import { RotateCcw, Search } from 'lucide-react'
import type { SelectOption } from '../form/fields'

export interface FilterSelectConfig {
  key: string
  ariaLabel: string
  value: string
  placeholder: string
  options: SelectOption[]
  onChange: (value: string) => void
}

interface FilterBarProps {
  searchValue: string
  searchPlaceholder: string
  onSearchChange: (value: string) => void
  selects: FilterSelectConfig[]
  onReset: () => void
  resultCount: number
  resultUnit?: string
  hasActiveFilters: boolean
}

const filterSelectClass =
  "h-9 cursor-pointer rounded-(--radius-control) border border-slate-200 bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m4%206%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-position-[right_8px_center] bg-no-repeat appearance-none pr-8 pl-3 text-[13px] text-slate-700 hover:border-slate-300"

/** 검색 + 셀렉트 필터 + 초기화 + 결과 수를 담는 공통 필터 바 */
export function FilterBar({
  searchValue,
  searchPlaceholder,
  onSearchChange,
  selects,
  onReset,
  resultCount,
  resultUnit = '건',
  hasActiveFilters,
}: FilterBarProps) {
  return (
    <div className="rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3.5 shadow-(--shadow-card)">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            role="searchbox"
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-9 w-full rounded-(--radius-control) border border-slate-200 bg-slate-50 pr-3 pl-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white"
          />
        </div>
        {selects.map((select) => (
          <select
            key={select.key}
            aria-label={select.ariaLabel}
            value={select.value}
            onChange={(event) => select.onChange(event.target.value)}
            className={filterSelectClass}
          >
            <option value="">{select.placeholder}</option>
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-(--radius-control) px-2.5 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            필터 초기화
          </button>
        )}
      </div>
      <p className="mt-2.5 text-xs text-slate-400" aria-live="polite">
        총 <span className="font-semibold text-slate-600">{resultCount}</span>
        {resultUnit}
      </p>
    </div>
  )
}
