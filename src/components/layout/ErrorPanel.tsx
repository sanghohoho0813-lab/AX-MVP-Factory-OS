/**
 * 화면 오류 안내 (D-95) — 본문 울타리와 라우터 오류 화면이 같이 쓴다.
 * 기록은 브라우저·클라우드에 그대로 있다는 것을 먼저 말한다(대표가 가장 먼저 걱정하는 것).
 */

import { Link } from 'react-router-dom'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { isStaleChunkError } from '../../lib/staleChunk'

export function ErrorPanel({ error, onRetry, withHomeLink = true }: { error: unknown; onRetry?: () => void; withHomeLink?: boolean }) {
  const stale = isStaleChunkError(error)
  const detail = error instanceof Error ? error.message : String(error ?? '')
  return (
    <div role="alert" data-testid="screen-error" className="mx-auto flex max-w-xl flex-col gap-3 rounded-(--radius-card) border border-amber-200 bg-amber-50/60 p-5 sm:p-6">
      <p className="t-card flex items-center gap-2 font-bold text-slate-900">
        <AlertTriangle aria-hidden="true" className="size-5 shrink-0 text-amber-600" />
        {stale ? '새 버전이 올라왔습니다' : '이 화면을 여는 중 문제가 생겼습니다'}
      </p>
      <p className="t-sub break-keep text-slate-700">
        {stale
          ? '열어 두신 사이에 새 버전이 배포되었습니다. 새로고침하면 바로 이어서 쓸 수 있습니다.'
          : '적어 두신 기록은 그대로 있습니다. 다시 시도하거나 새로고침해 보세요. 계속 같으면 아래 내용을 알려 주세요.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {onRetry && !stale && (
          <button type="button" onClick={onRetry} className="tap rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-[0.95rem] font-semibold text-slate-800 hover:bg-slate-50">
            다시 시도
          </button>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="tap inline-flex items-center gap-1.5 rounded-(--radius-control) bg-brand-600 px-3 py-2 text-[0.95rem] font-semibold text-white hover:bg-brand-700"
        >
          <RefreshCw aria-hidden="true" className="size-4" /> 새로고침
        </button>
        {withHomeLink && (
          <Link to="/" className="tap rounded-(--radius-control) px-3 py-2 text-[0.95rem] font-medium text-brand-700 hover:underline">
            오늘 화면으로
          </Link>
        )}
      </div>
      {!stale && detail && (
        <details className="t-meta text-slate-500">
          <summary className="cursor-pointer">오류 내용</summary>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all">{detail}</pre>
        </details>
      )}
    </div>
  )
}
