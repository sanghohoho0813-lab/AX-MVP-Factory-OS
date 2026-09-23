/**
 * 원본 Layout 자리 (D-92) — 원본의 사이드바·모바일 탭은 이 OS 의 모듈 목차가 대신한다.
 * 여기서는 원본 머리(제목·설명·단추)와 본문만 그린다.
 */
import type { ReactNode } from 'react'

export default function Layout({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5" data-lab-page={title}>
      <header className="print-hide flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="t-page break-keep text-slate-900">{title}</h1>
          {subtitle ? <p className="t-sub mt-1 break-keep text-slate-600">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 [&>div]:flex-wrap">{actions}</div> : null}
      </header>
      <div className="print-full">{children}</div>
    </div>
  )
}
