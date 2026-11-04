/**
 * D-535 다른 기기에서 먼저 고친 모듈 기록을 덮기 전에 보관했다는 알림 — 모든 화면 위에 한 줄(닫기 전까지).
 *
 * 저장은 막지 않았다(방금 고친 것이 저장됐다). 덮인 쪽 내용은 같은 모듈의 보관 갈래에 남아 있고,
 * 작업공간 전체 내보내기(고객 관리 › 더보기 › [백업 내려받기]) 파일의 모듈 기록에 함께 담긴다.
 * 박스는 흰 바탕 + 회색 테두리(D-370) · 강조는 글자색만.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { History, X } from 'lucide-react'
import { MODULE_OVERWROTE_EVENT } from '../../services/moduleData'

export function ModuleOverwroteNotice() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const on = () => setCount((n) => n + 1)
    window.addEventListener(MODULE_OVERWROTE_EVENT, on)
    return () => window.removeEventListener(MODULE_OVERWROTE_EVENT, on)
  }, [])

  if (count === 0) return null
  return (
    <div role="status" data-testid="module-overwrote" className="no-print mb-4 flex items-start gap-3 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3">
      <History aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-700" />
      <div className="min-w-0 flex-1">
        <p className="t-sub font-bold text-slate-900">다른 기기에서 먼저 고친 내용이 있었어요{count > 1 ? ` (${count}번)` : ''}</p>
        <p className="t-sub mt-0.5 break-keep text-slate-700">
          방금 고친 것으로 저장했고, 덮이기 전 내용은 지우지 않고 보관해 두었어요. 보관한 내용은 백업 파일의 모듈 기록에 함께 들어가요.
        </p>
        <Link to="/ops/clients?more=1" className="t-sub mt-1 inline-block font-semibold text-brand-700 underline">
          백업 내려받으러 가기 →
        </Link>
      </div>
      <button type="button" aria-label="알림 닫기" onClick={() => setCount(0)} className="tap rounded-(--radius-control) p-1 text-slate-500 hover:bg-slate-100">
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}
