/**
 * 브라우저 저장 공간 가득 참 알림 (D-95) — 모든 화면 위에 한 줄.
 *
 * 저장이 한 번이라도 실패하면 뜨고, 닫기 전까지 남는다. 무엇을 하면 되는지(백업 → 정리)를 같이 적는다.
 * 실패한 기록은 이 창을 닫기 전까지는 화면에 남아 있다 — 그 사이에 백업을 받으면 잃지 않는다.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HardDrive, X } from 'lucide-react'
import { STORAGE_FULL_EVENT, localStorageChars } from '../../storage/storageFull'

export function StorageFullNotice() {
  const [full, setFull] = useState(false)
  const [mb, setMb] = useState(0)

  useEffect(() => {
    const on = () => {
      setFull(true)
      setMb(Math.round((localStorageChars() / 1024 / 1024) * 10) / 10)
    }
    window.addEventListener(STORAGE_FULL_EVENT, on)
    return () => window.removeEventListener(STORAGE_FULL_EVENT, on)
  }, [])

  if (!full) return null
  return (
    <div role="alert" data-testid="storage-full" className="no-print mb-4 flex items-start gap-3 rounded-(--radius-panel) border border-rose-200 bg-rose-50 px-4 py-3">
      <HardDrive aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-rose-600" />
      <div className="min-w-0 flex-1">
        <p className="t-sub font-bold text-rose-800">브라우저 저장 공간이 가득 차 방금 적은 것을 저장하지 못했습니다</p>
        <p className="t-sub mt-0.5 break-keep text-rose-700">
          이 창을 닫기 전까지는 화면에 남아 있습니다. <b>먼저 백업을 내려받고</b>, 쓰지 않는 첨부 파일·오래된 분석 이력을 지워 주세요.
          {mb > 0 ? ` (지금 쓰는 양 약 ${mb}MB · 브라우저 한도 약 5MB)` : ''}
        </p>
        <Link to="/ops/clients?more=1" className="t-sub mt-1 inline-block font-bold text-rose-800 underline">
          백업 내려받으러 가기 →
        </Link>
      </div>
      <button type="button" aria-label="알림 닫기" onClick={() => setFull(false)} className="tap rounded-(--radius-control) p-1 text-rose-400 hover:bg-rose-100">
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}
