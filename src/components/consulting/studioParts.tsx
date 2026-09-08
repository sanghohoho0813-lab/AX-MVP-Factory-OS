/**
 * 컨설팅 작업실 공통 부품 — 단계 배지 · 입력칸(블러 저장) · 다음 행동 줄 · 복사/다운로드.
 *
 * 색 규칙은 primitives 와 같다: 막힘=빨강, 검토 대기=주황, 완료=초록, 진행=브랜드, 나머지 무채색.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, Check, ClipboardCopy, Download } from 'lucide-react'
import type { NextAction, StageKey, StageStatus } from '../../types/consulting'
import { stageDef } from '../../domain/consulting/workflowDefinition'
import { Badge, type Tone } from '../ui/primitives'
import { Button } from '../ui/Button'

export const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  not_started: '시작 전',
  in_progress: '진행 중',
  blocked: '막힘',
  ready_for_review: '검토 대기',
  completed: '완료',
  skipped: '건너뜀',
}

export const STAGE_STATUS_ORDER: StageStatus[] = ['not_started', 'in_progress', 'blocked', 'ready_for_review', 'completed', 'skipped']

export function stageTone(s: StageStatus): Tone {
  switch (s) {
    case 'blocked': return 'danger'
    case 'ready_for_review': return 'warning'
    case 'completed': return 'success'
    case 'in_progress': return 'brand'
    default: return 'neutral'
  }
}

export function StageBadge({ status }: { status: StageStatus }) {
  return <Badge tone={stageTone(status)}>{STAGE_STATUS_LABEL[status]}</Badge>
}

/** "S3 · 특허 아이디어" */
export function stageTitle(key: StageKey): string {
  return `${key} · ${stageDef(key).label}`
}

/* ------------------------------------------------------------------ */
/* 입력칸 — 타이핑 중에는 로컬, 포커스가 빠질 때 저장                         */
/* ------------------------------------------------------------------ */

const inputCls =
  't-body w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none'

export function TextField({
  label,
  value,
  onCommit,
  placeholder,
  hint,
  multiline = false,
  rows = 3,
  type = 'text',
  id,
}: {
  label: string
  value: string
  onCommit: (v: string) => void
  placeholder?: string
  hint?: string
  multiline?: boolean
  rows?: number
  type?: 'text' | 'date' | 'url'
  id?: string
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    if (draft !== value) onCommit(draft)
  }
  return (
    <label className="block" id={id ? `${id}-wrap` : undefined}>
      <span className="t-sub block font-medium text-slate-600">{label}</span>
      {multiline ? (
        <textarea
          id={id}
          value={draft}
          rows={rows}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          className={`${inputCls} mt-1 resize-y`}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          className={`${inputCls} mt-1`}
        />
      )}
      {hint && <span className="t-meta mt-1 block break-keep text-slate-500">{hint}</span>}
    </label>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  id,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  id?: string
}) {
  return (
    <label className="block">
      <span className="t-sub block font-medium text-slate-600">{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className={`${inputCls} mt-1 h-11`}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function CheckRow({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="tap flex cursor-pointer items-start gap-3 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5 hover:bg-slate-50">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-4 shrink-0 accent-brand-600" />
      {/* flex-1 이 없으면 글자 칸이 라벨의 최대 폭으로 굳어 보조 설명이 세로로 흐른다 (D-23) */}
      <span className="min-w-0 flex-1">
        <span className="t-body block break-keep text-slate-900">{label}</span>
        {hint && <span className="t-meta block break-keep text-slate-500">{hint}</span>}
      </span>
    </label>
  )
}

/* ------------------------------------------------------------------ */
/* 다음 행동                                                            */
/* ------------------------------------------------------------------ */

export function NextActionRow({ action, index, onOpen }: { action: NextAction; index: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="tap flex w-full items-start gap-3 rounded-(--radius-card) border border-brand-200 bg-white px-4 py-3.5 text-left hover:bg-brand-50/40"
    >
      <span aria-hidden="true" className="t-meta mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="t-card block break-keep text-slate-900">{action.title}</span>
        <span className="t-sub mt-0.5 block break-keep text-slate-500">{action.why}</span>
        <span className="t-meta mt-1 block text-slate-400">{stageTitle(action.stageKey)}</span>
      </span>
      <ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-brand-500" />
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* 복사 · 다운로드                                                       */
/* ------------------------------------------------------------------ */

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand?.('copy') ?? false
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

export function downloadText(fileName: string, text: string, mime = 'text/markdown'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function CopyButton({ text, label = '복사', variant = 'secondary' }: { text: string; label?: string; variant?: 'primary' | 'secondary' | 'ghost' }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      variant={variant}
      onClick={() => {
        void copyText(text).then((ok) => {
          setDone(ok)
          setTimeout(() => setDone(false), 1800)
        })
      }}
    >
      {done ? <Check aria-hidden="true" className="size-4" /> : <ClipboardCopy aria-hidden="true" className="size-4" />}
      {done ? '복사했습니다' : label}
    </Button>
  )
}

export function DownloadButton({ fileName, text, label }: { fileName: string; text: string; label: string }) {
  return (
    <Button variant="secondary" onClick={() => downloadText(fileName, text)}>
      <Download aria-hidden="true" className="size-4" />
      {label}
    </Button>
  )
}

/** 작은 진행 막대 — 숫자와 함께 */
export function MiniProgress({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        {label && <span className="t-sub text-slate-600">{label}</span>}
        <span className="t-meta font-semibold text-slate-700">
          {value}/{max}
        </span>
      </div>
      <div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/** 화면 안 소제목 + 설명 (탭 안에서 쓴다) */
export function Block({ title, hint, children, action }: { title: string; hint?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="t-card break-keep text-slate-900">{title}</h3>
          {hint && <p className="t-sub mt-0.5 break-keep text-slate-500">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** 마이그레이션 미적용 안내 — 아무것도 깨지지 않고 이것만 보인다 */
export function TablesMissingNotice() {
  return (
    <div className="rounded-(--radius-panel) border border-warning-200 bg-warning-50 p-5">
      <p className="t-card break-keep text-warning-700">컨설팅 작업실은 READY 상태입니다</p>
      <p className="t-body mt-1 break-keep text-slate-700">
        클라우드에 아직 컨설팅 표가 없습니다. 아래 SQL 을 Supabase SQL Editor 에서 한 번 실행하면 바로 쓸 수 있습니다.
        기존 데이터는 건드리지 않습니다.
      </p>
      <code className="t-meta mt-2 block break-all rounded-(--radius-control) bg-white px-3 py-2 text-slate-700">
        supabase/migrations/20260908000012_consulting_studio.sql
      </code>
    </div>
  )
}
