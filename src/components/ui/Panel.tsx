import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  actions?: ReactNode
  children: ReactNode
  /** 내부 여백 없이 표 등을 직접 배치할 때 */
  flush?: boolean
}

/** 1px 테두리 + 약한 그림자의 공통 콘텐츠 패널 */
export function Panel({ title, actions, children, flush = false }: PanelProps) {
  return (
    <section className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        {actions}
      </div>
      <div className={flush ? '' : 'px-5 py-5'}>{children}</div>
    </section>
  )
}
