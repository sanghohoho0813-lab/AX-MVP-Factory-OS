// 공용 UI 프리미티브 — 카드 남발 금지, 상태는 배지 색으로 즉시 구분 (Toss/Linear 톤)
import type { ReactNode } from 'react'
import type { ContractStatus, ProjectStatus, StageStatus } from '../lib/types'
import { CONTRACT_STATUS_LABEL, PROJECT_STATUS_LABEL, STAGE_STATUS_LABEL } from '../lib/types'

export function PageHeader({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">{title}</h1>
        {desc && <p className="mt-1 text-sm text-slate-500">{desc}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <p className="text-[0.95rem] font-semibold text-slate-700">{title}</p>
      {desc && <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-400">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

const btnBase = 'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none'
export function Button({
  children, onClick, type = 'button', variant = 'primary', size = 'md', disabled,
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  disabled?: boolean
}) {
  const v = {
    primary: 'bg-navy-800 text-white hover:bg-navy-700',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
    danger: 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50',
  }[variant]
  const s = size === 'sm' ? 'px-3 py-1.5 text-[0.82rem]' : 'px-4 py-2.5 text-sm'
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${btnBase} ${v} ${s}`}>
      {children}
    </button>
  )
}

// ── 배지 ──────────────────────────────────────────────────────

const STAGE_STATUS_TONE: Record<StageStatus, string> = {
  not_started: 'bg-slate-100 text-slate-500',
  materials_requested: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  collecting: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  analyzing: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  prototyping: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  customer_review: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200',
  revising: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  testing: 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200',
  passed: 'bg-teal-500/10 text-teal-700 ring-1 ring-inset ring-teal-500/30',
  hold: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
  stopped: 'bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200',
  completed: 'bg-navy-800 text-white',
}

export function StageStatusBadge({ status }: { status: StageStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${STAGE_STATUS_TONE[status]}`}>
      {STAGE_STATUS_LABEL[status]}
    </span>
  )
}

const PROJECT_STATUS_TONE: Record<ProjectStatus, string> = {
  active: 'bg-teal-500/10 text-teal-700 ring-1 ring-inset ring-teal-500/30',
  waiting_customer: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200',
  hold: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
  dropped: 'bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200',
  completed: 'bg-navy-800 text-white',
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${PROJECT_STATUS_TONE[status]}`}>
      {PROJECT_STATUS_LABEL[status]}
    </span>
  )
}

export function ContractBadge({ status }: { status: ContractStatus }) {
  const tone = status === 'contracted' ? 'bg-navy-50 text-navy-700 ring-1 ring-inset ring-navy-200'
    : status === 'reviewing' ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200'
    : status === 'maintenance' ? 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200'
    : 'bg-slate-100 text-slate-500'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${tone}`}>
      {CONTRACT_STATUS_LABEL[status]}
    </span>
  )
}

export function StageChip({ no, compact }: { no: number; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-navy-50 px-2 py-0.5 text-xs font-bold text-navy-700 ring-1 ring-inset ring-navy-200">
      S{no}{!compact && <span className="font-semibold text-navy-600/70">단계</span>}
    </span>
  )
}

export function LevelChip({ current, target }: { current: number; target?: number }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
      L{current}{target != null && <span className="ml-0.5 font-semibold text-slate-400">→ L{target}</span>}
    </span>
  )
}

// ── 폼 요소 ───────────────────────────────────────────────────

export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-navy-600 focus:ring-2 focus:ring-navy-600/15'
export const labelCls = 'mb-1.5 block text-[0.82rem] font-semibold text-slate-600'

export function Field({ label, required, children, hint }: { label: string; required?: boolean; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className={labelCls}>
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export function ErrorNote({ msg }: { msg: string | null }) {
  if (!msg) return null
  return <p className="rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700">{msg}</p>
}
