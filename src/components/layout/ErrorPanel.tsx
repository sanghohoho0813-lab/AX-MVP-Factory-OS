/**
 * 화면 오류 안내 (D-95) — 본문 울타리와 라우터 오류 화면이 같이 쓴다.
 * 기록은 브라우저·클라우드에 그대로 있다는 것을 먼저 말한다(대표가 가장 먼저 걱정하는 것).
 * D-568 대표가 아닌 계정(팀장 · 구독 고객)의 화면 오류는 운영자에게 자동으로 전해진다 — 오류 글 · 화면 주소만(고객사 자료 없음).
 *       전해지면 '운영자에게 전해졌어요' 한 줄. 문의 창구(0025)가 없으면 아무것도 보내지 않고 예전 그대로.
 */

import { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { AuthContext } from '../../auth/authContext'
import { isStaleChunkError } from '../../lib/staleChunk'
import { reportScreenError } from '../../services/support'

export function ErrorPanel({ error, onRetry, withHomeLink = true }: { error: unknown; onRetry?: () => void; withHomeLink?: boolean }) {
  const stale = isStaleChunkError(error)
  const detail = error instanceof Error ? error.message : String(error ?? '')
  const auth = useContext(AuthContext)
  // 대표 자신의 화면 오류는 대표가 바로 본다 — 보내지 않는다
  const shouldReport = !stale && !!auth?.session && auth.access === 'pilot'
  const [reported, setReported] = useState(false)
  useEffect(() => {
    if (!shouldReport) return
    let alive = true
    void reportScreenError(error, 'screen').then((ok) => alive && setReported(ok))
    return () => {
      alive = false
    }
  }, [error, shouldReport])
  return (
    <div role="alert" data-testid="screen-error" className="mx-auto flex max-w-xl flex-col gap-3 rounded-(--radius-card) border border-slate-200 bg-white p-5 sm:p-6">
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
          <button type="button" onClick={onRetry} className="tap rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-[0.9375rem] font-semibold text-slate-800 hover:bg-slate-50">
            다시 시도
          </button>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="tap inline-flex items-center gap-1.5 rounded-(--radius-control) bg-brand-600 px-3 py-2 text-[0.9375rem] font-semibold text-white hover:bg-brand-700"
        >
          <RefreshCw aria-hidden="true" className="size-4" /> 새로고침
        </button>
        {withHomeLink && (
          <Link to="/" className="tap rounded-(--radius-control) px-3 py-2 text-[0.9375rem] font-medium text-brand-700 hover:underline">
            오늘 화면으로
          </Link>
        )}
      </div>
      {reported && (
        <p className="t-sub break-keep text-slate-700" role="status" data-testid="screen-error-sent">
          이 오류는 운영자에게 전해졌어요(오류 내용 · 화면 주소만). 무엇을 하다가 생겼는지 알려 주시면 더 빨리 고쳐요 —{' '}
          <Link to={`/support?from=${encodeURIComponent(typeof window === 'undefined' ? '' : window.location.pathname)}`} className="font-semibold text-brand-700 hover:underline">
            문의하기
          </Link>
        </p>
      )}
      {!stale && detail && (
        <details className="t-meta text-slate-500">
          <summary className="cursor-pointer">오류 내용</summary>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all">{detail}</pre>
        </details>
      )}
    </div>
  )
}
