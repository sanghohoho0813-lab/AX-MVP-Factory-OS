/**
 * 라우터가 잡은 오류 (D-95) — 머리줄·사이드바까지 넘어졌을 때의 마지막 자리.
 * 라우터 기본 화면("Unexpected Application Error!", 영어·개발자용) 대신 선다.
 */

import { useEffect } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { isStaleChunkError, reloadOnceForNewVersion } from '../../lib/staleChunk'
import { ErrorPanel } from './ErrorPanel'

export function RouteErrorScreen() {
  const raw = useRouteError()
  const error = isRouteErrorResponse(raw) ? new Error(`${raw.status} ${raw.statusText}`) : raw
  useEffect(() => {
    console.error('[라우트 오류]', raw)
    if (isStaleChunkError(raw)) reloadOnceForNewVersion()
  }, [raw])
  return (
    <div className="flex min-h-dvh items-start justify-center bg-slate-50 px-4 pt-[12vh]">
      <ErrorPanel error={error} withHomeLink={false} />
    </div>
  )
}
