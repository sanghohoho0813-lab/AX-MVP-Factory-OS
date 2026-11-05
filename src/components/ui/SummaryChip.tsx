/**
 * 한 줄 요약 칩(U2 오늘 숫자 줄 · U3 고객 관리 숫자 줄이 같이 쓴다) — 큰 숫자 칸 대신 목록 위 한 줄.
 * 흰 바탕 · 회색 테두리(박스 색 하나) · 급한 것은 숫자 글자색으로만(빨강 = 늦음 · 주황 = 곧 · 파랑 = 볼 것).
 * 누르면 가는 곳(to) · 하는 일(onClick)이 있으면 단추, 없으면 그냥 표시. 설명은 마우스를 올리면(title).
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

export type SummaryUrgency = 'neutral' | 'danger' | 'warning' | 'brand'

export interface SummaryChipProps {
  testId: string
  icon: LucideIcon
  label: string
  value: string
  hint: string
  urgency?: SummaryUrgency
  to?: string
  onClick?: () => void
}

const VALUE_TONE: Record<SummaryUrgency, string> = {
  neutral: 'text-slate-900',
  danger: 'text-danger-700',
  warning: 'text-warning-800',
  brand: 'text-brand-700',
}

export function SummaryChip({ testId, icon: Icon, label, value, hint, urgency = 'neutral', to, onClick }: SummaryChipProps) {
  const inner: ReactNode = (
    <>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
      <span className="t-sub break-keep whitespace-nowrap text-slate-600">{label}</span>
      <strong className={`t-body font-bold whitespace-nowrap tabular-nums ${VALUE_TONE[urgency]}`}>{value}</strong>
    </>
  )
  const base = 'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-left'
  const cls = `tap ${base} hover:border-slate-300 hover:bg-slate-50`
  if (to)
    return (
      <Link to={to} title={hint} aria-label={`${label} ${value} — ${hint}`} className={cls} data-testid={testId}>
        {inner}
      </Link>
    )
  if (onClick)
    return (
      <button type="button" title={hint} aria-label={`${label} ${value} — ${hint}`} onClick={onClick} className={cls} data-testid={testId}>
        {inner}
      </button>
    )
  return (
    <span title={hint} aria-label={`${label} ${value} — ${hint}`} className={base} data-testid={testId}>
      {inner}
    </span>
  )
}
