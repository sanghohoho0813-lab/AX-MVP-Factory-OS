/**
 * D-551 SYNC-4 AI 결과가 보관 한도에서 밀려났다는 알림 — 모든 화면 위에 한 줄(닫기 전까지 · 마지막 것).
 * 박스는 흰 바탕 + 회색 테두리(D-370) · 강조는 글자색만.
 */
import { useEffect, useState } from 'react'
import { Archive, X } from 'lucide-react'
import { EVICTED_EVENT, evictedLine, type EvictedDetail } from '../../services/marketing/storeEvicted'

export function AiStoreEvictedNotice() {
  const [detail, setDetail] = useState<EvictedDetail | null>(null)

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<EvictedDetail>).detail
      if (d && Array.isArray(d.labels) && d.labels.length) setDetail(d)
    }
    window.addEventListener(EVICTED_EVENT, on)
    return () => window.removeEventListener(EVICTED_EVENT, on)
  }, [])

  if (!detail) return null
  return (
    <div role="status" data-testid="ai-store-evicted" className="no-print mb-4 flex items-start gap-3 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3">
      <Archive aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-slate-600" />
      <p className="t-sub min-w-0 flex-1 break-keep text-slate-800">{evictedLine(detail)}</p>
      <button type="button" aria-label="알림 닫기" onClick={() => setDetail(null)} className="tap inline-flex size-10 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-slate-100" data-testid="ai-store-evicted-close">
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}
