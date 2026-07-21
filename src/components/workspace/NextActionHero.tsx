/**
 * "지금 해야 할 일" 히어로. 화면에서 가장 크고 강하게 표시되는 단일 다음 행동.
 * 고객사·프로젝트·해야 할 일·이유·큰 행동 버튼을 한 곳에 모은다.
 */

import { NavLink } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

export function NextActionHero({
  eyebrow,
  actionText,
  reason,
  actionLabel,
  actionPath,
  onAction,
  due,
  secondary,
}: {
  /** 상단 작은 컨텍스트 (예: "대한정밀 · 생산계획 AX MVP") */
  eyebrow?: string
  /** 지금 해야 하는 일 (큰 제목) */
  actionText: string
  /** 왜 필요한지 한 줄 */
  reason?: string
  actionLabel: string
  actionPath?: string
  onAction?: () => void
  /** 기한 등 보조 표시 */
  due?: string
  /** 보조 행동들 */
  secondary?: ReactNode
}) {
  return (
    <section className="rounded-(--radius-panel) border border-brand-100 bg-gradient-to-br from-brand-50/80 to-white p-6 sm:p-8">
      {eyebrow && (
        <p className="mb-2 text-[0.95rem] font-semibold text-brand-700">{eyebrow}</p>
      )}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <p className="text-[0.9rem] font-medium tracking-wide text-slate-500">지금 해야 할 일</p>
          <h2 className="mt-1.5 text-[1.6rem] leading-snug font-bold break-keep text-slate-900 sm:text-[1.8rem]">
            {actionText}
          </h2>
          {reason && <p className="mt-3 text-[1.05rem] leading-relaxed break-keep text-slate-600">{reason}</p>}
          {due && <p className="mt-3 inline-flex items-center rounded-full bg-warning-50 px-3 py-1 text-[0.9rem] font-medium text-warning-700">기한 · {due}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 lg:items-end">
          {actionPath ? (
            <NavLink
              to={actionPath}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-(--radius-control) bg-brand-600 px-7 text-[1.1rem] font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              {actionLabel}
              <ArrowRight aria-hidden="true" className="size-5" />
            </NavLink>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex h-14 cursor-pointer items-center justify-center gap-2 rounded-(--radius-control) bg-brand-600 px-7 text-[1.1rem] font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              {actionLabel}
              <ArrowRight aria-hidden="true" className="size-5" />
            </button>
          )}
          {secondary && <div className="flex flex-wrap gap-x-4 gap-y-1 lg:justify-end">{secondary}</div>}
        </div>
      </div>
    </section>
  )
}
