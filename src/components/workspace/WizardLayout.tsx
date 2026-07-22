/**
 * 단계형 입력(마법사) 공통 레이아웃.
 * 상단 진행률 + 좌측 단계 목록(데스크톱) + 중앙 현재 단계 + 우측 요약(선택).
 * 이전/다음/저장, 임시저장을 제공한다. 모바일에서는 한 열로 전환한다.
 */

import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Button } from '../ui/Button'

export interface WizardStep {
  key: string
  title: string
  optional?: boolean
}

export function WizardLayout({
  title,
  description,
  steps,
  current,
  onStepChange,
  onPrev,
  onNext,
  onSubmit,
  onSaveDraft,
  submitLabel,
  saving = false,
  summary,
  children,
}: {
  title: string
  description?: string
  steps: WizardStep[]
  current: number
  onStepChange?: (index: number) => void
  onPrev: () => void
  onNext: () => void
  onSubmit: () => void
  onSaveDraft?: () => void
  submitLabel: string
  saving?: boolean
  summary?: ReactNode
  children: ReactNode
}) {
  const isLast = current >= steps.length - 1
  const pct = Math.round(((current + 1) / steps.length) * 100)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div>
        <h1 className="text-[1.6rem] font-bold break-keep text-slate-900">{title}</h1>
        {description && <p className="mt-1.5 text-[1.05rem] break-keep text-slate-600">{description}</p>}
      </div>

      {/* 진행률 */}
      <div>
        <div className="flex items-center justify-between text-[0.9rem] font-medium text-slate-500">
          <span>{steps[current]?.title}</span>
          <span>{current + 1} / {steps.length} 단계</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <span className="block h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
        {/* 좌측 단계 목록 */}
        <nav aria-label="입력 단계" className="hidden lg:block">
          <ol className="flex flex-col gap-1">
            {steps.map((s, i) => {
              const state = i < current ? 'done' : i === current ? 'current' : 'upcoming'
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => onStepChange?.(i)}
                    disabled={i > current}
                    aria-current={state === 'current' ? 'step' : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-(--radius-control) px-3 py-2.5 text-left text-[0.95rem] transition-colors disabled:cursor-not-allowed ${
                      state === 'current' ? 'bg-brand-50 font-semibold text-brand-800' : state === 'done' ? 'text-slate-700 hover:bg-slate-50' : 'text-slate-400'
                    }`}
                  >
                    <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.8rem] font-bold ${
                      state === 'done' ? 'border-success-500 bg-success-500 text-white' : state === 'current' ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 text-slate-400'
                    }`}>
                      {state === 'done' ? <Check aria-hidden="true" className="size-3.5" /> : i + 1}
                    </span>
                    <span className="truncate">{s.title}{s.optional && <span className="ml-1 text-[0.8rem] text-slate-400">(선택)</span>}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        {/* 중앙 입력 */}
        <div className="min-w-0 rounded-(--radius-panel) border border-slate-200 bg-white p-5 sm:p-6">
          {children}
        </div>

        {/* 우측 요약 */}
        {summary && (
          <aside className="min-w-0">
            <div className="rounded-(--radius-panel) border border-slate-200 bg-slate-50/60 p-4 lg:sticky lg:top-6">
              <p className="mb-3 text-[0.95rem] font-semibold text-slate-700">입력 요약</p>
              {summary}
            </div>
          </aside>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onPrev} disabled={saving}>
          <ArrowLeft aria-hidden="true" className="size-4" /> {current === 0 ? '취소' : '이전'}
        </Button>
        <div className="flex items-center gap-2">
          {onSaveDraft && (
            <Button variant="ghost" onClick={onSaveDraft} disabled={saving}>임시저장</Button>
          )}
          {isLast ? (
            <Button variant="primary" onClick={onSubmit} disabled={saving}>
              {saving ? '저장 중…' : submitLabel}
            </Button>
          ) : (
            <Button variant="primary" onClick={onNext} disabled={saving}>
              다음 <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/** 요약 패널의 한 줄 항목 */
export function WizardSummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
      <span className="shrink-0 text-[0.9rem] text-slate-500">{label}</span>
      <span className="min-w-0 break-keep text-right text-[0.9rem] font-medium text-slate-800">{value || <span className="text-slate-300">미입력</span>}</span>
    </div>
  )
}
