import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Option } from '../../lib/options'

// Toss 스타일 카드 섹션
export function Section({ children }: { children: ReactNode }) {
  return <div className="rounded-3xl bg-white p-6 shadow-card sm:p-7">{children}</div>
}

// 단계 번호 + 제목 라벨
export function FieldLabel({ step, children }: { step?: number; children: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      {step !== undefined && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">
          {step}
        </span>
      )}
      <h3 className="text-xl font-bold text-gray-900">{children}</h3>
    </div>
  )
}

// 선택형 버튼 그룹
export function ChoiceGroup<T extends string>({
  options,
  value,
  onSelect,
  columns = 2,
}: {
  options: Option<T>[]
  value: T | ''
  onSelect: (v: T) => void
  columns?: number
}) {
  return (
    <div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(opt.value)}
            className={[
              'rounded-2xl border px-4 py-4 text-lg font-medium transition-colors',
              active
                ? 'border-brand bg-brand text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 active:bg-gray-50',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// 작은 안내 문구
export function HintText({ children }: { children: ReactNode }) {
  return <div className="mt-2.5 text-base leading-relaxed text-gray-400">{children}</div>
}

// 접이식(아코디언) — 상세 내용을 기본 닫힘 상태로 감춘다
export function Accordion({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-xl font-bold text-gray-900">{title}</span>
        <span
          className={`text-2xl text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>
      {open && <div className="border-t border-gray-100 p-4 sm:p-5">{children}</div>}
    </div>
  )
}
