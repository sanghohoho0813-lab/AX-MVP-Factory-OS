/**
 * 원본 Layout 자리 (D-92) — 원본의 사이드바·모바일 탭은 이 OS 의 모듈 목차가 대신한다.
 * 여기서는 원본 머리(제목·설명·단추)와 본문만 그린다.
 */
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { flushLabStore, labUnsavedCount, subscribeLabSave } from '../store'

/** D-224 저장하지 못한 기록이 있으면 위에 알린다 — 예전에는 실패해도 아무 표시가 없었다 */
function UnsavedNote() {
  const n = useSyncExternalStore(subscribeLabSave, labUnsavedCount, () => 0)
  const [busy, setBusy] = useState(false)
  if (n === 0) return null
  return (
    <div role="alert" data-testid="lab-unsaved" className="print-hide flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
      <span className="min-w-0 flex-1 break-keep">저장하지 못한 기록이 있어요. 적은 내용은 이 화면에 그대로 있고, 조금 뒤 다시 저장합니다. 이 창을 닫지 마세요.</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void flushLabStore().finally(() => setBusy(false))
        }}
        className="min-h-11 rounded-lg border border-amber-400 bg-white px-3 text-sm font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
      >
        {busy ? '저장하는 중…' : '지금 다시 저장'}
      </button>
    </div>
  )
}

export default function Layout({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5" data-lab-page={title}>
      <UnsavedNote />
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
