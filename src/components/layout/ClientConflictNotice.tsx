/**
 * SYNC-2(D-547) 업체 기록 저장이 부딪혔을 때 — 모든 화면 위 한 장.
 *
 *  - 서로 다른 칸을 고쳤다 → 저장은 이미 끝났다(둘 다 살림). 잠깐 한 줄 '합쳐서 저장했어요'(6초 뒤 저절로 닫힘).
 *  - 같은 칸을 둘 다 다르게 고쳤다 → 그 칸만 보여 주고 고르게 한다: [내가 고친 것으로 저장] · [먼저 저장된 것으로 두기].
 *    어느 쪽이든 겹치지 않은 내 고침은 함께 저장된다. 고르기 전에는 아무것도 덮지 않는다.
 * 화면 위(머리줄 바로 아래)에 떠서 스크롤해도 보이고, 아래쪽 알림(저장됨 · 오류)과 겹치지 않는다. 박스는 흰 바탕 + 회색 테두리(D-370).
 */
import { useEffect, useRef, useState } from 'react'
import { GitMerge, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { onClientSaveNews, resolveClientConflict, type ClientSaveConflictError } from '../../services/clientOpsService'
import { conflictLabels, conflictValueText } from '../../services/clientMerge'

const LABEL_ROWS = 4

export function ClientConflictNotice() {
  const [merged, setMerged] = useState<string | null>(null)
  const [conflict, setConflict] = useState<ClientSaveConflictError | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const timer = useRef<number | undefined>(undefined)

  useEffect(
    () =>
      onClientSaveNews((n) => {
        if (n.kind === 'merged') {
          setMerged(n.record.companyName || '이 업체')
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => setMerged(null), 6000)
        } else if (n.kind === 'conflict') {
          setConflict(n.error)
          setError('')
        }
      }),
    [],
  )
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const pick = async (which: 'mine' | 'theirs') => {
    if (!conflict || busy) return
    setBusy(true)
    setError('')
    try {
      await resolveClientConflict(conflict, which)
      setConflict(null)
      setMerged(null)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : '저장하지 못했어요 — 다시 눌러 주세요.')
    } finally {
      setBusy(false)
    }
  }

  if (!merged && !conflict) return null
  const name = conflict ? conflict.latest.companyName || '이 업체' : merged
  const rows = conflict ? conflict.conflicts.slice(0, LABEL_ROWS) : []
  const more = conflict ? Math.max(0, conflict.conflicts.length - LABEL_ROWS) : 0
  return (
    // 화면 위(머리줄 바로 아래) — 아래쪽 알림(저장됨 · 오류) 자리와 겹치지 않게
    <div className="no-print fixed inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top,0px))] z-50 flex justify-center sm:inset-x-auto sm:top-20 sm:right-6 sm:justify-end lg:right-[calc(var(--dock-float,0px)+var(--side-reserve,0px)+1.5rem)]" data-testid="client-conflict-wrap">
      {conflict ? (
        <section role="alertdialog" aria-label="같은 칸을 먼저 고친 곳이 있어요" className="max-h-[calc(100dvh-7rem)] w-full max-w-[28rem] overflow-y-auto rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-lg" data-testid="client-conflict">
          <div className="flex items-start gap-2.5">
            <GitMerge aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-700" />
            <div className="min-w-0 flex-1">
              <p className="t-body font-bold break-keep text-slate-900">‘{name}’ — 같은 칸을 다른 곳에서 먼저 고쳤어요</p>
              <p className="t-sub mt-0.5 break-keep text-slate-700">겹치지 않은 고침은 둘 다 살려 둘게요. 아래 칸만 어느 쪽으로 할지 골라 주세요(고르기 전에는 아무것도 덮지 않아요).</p>
            </div>
          </div>
          <ul className="mt-3 flex flex-col divide-y divide-slate-200 rounded-(--radius-control) border border-slate-200" data-testid="client-conflict-rows">
            {rows.map((c) => (
              <li key={c.path} className="px-3 py-2" data-testid="client-conflict-row" data-path={c.path}>
                <p className="t-sub font-semibold text-slate-900">{conflictLabels([c])[0]}</p>
                <p className="t-sub mt-0.5 break-keep text-slate-700 [overflow-wrap:anywhere]">
                  내가 고친 것: <b className="font-semibold text-slate-900">{conflictValueText(c.mine)}</b>
                </p>
                <p className="t-sub break-keep text-slate-700 [overflow-wrap:anywhere]">
                  먼저 저장된 것: <b className="font-semibold text-slate-900">{conflictValueText(c.theirs)}</b>
                </p>
              </li>
            ))}
            {more > 0 && <li className="t-sub px-3 py-2 text-slate-600">그 밖에 {more}칸 더</li>}
          </ul>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button variant="primary" onClick={() => void pick('mine')} disabled={busy} className="w-full sm:w-auto" data-testid="client-conflict-mine">
              {busy ? '저장하는 중…' : '내가 고친 것으로 저장'}
            </Button>
            <Button variant="secondary" onClick={() => void pick('theirs')} disabled={busy} className="w-full sm:w-auto" data-testid="client-conflict-theirs">
              먼저 저장된 것으로 두기
            </Button>
          </div>
          {error && (
            <p role="alert" className="t-sub mt-2 break-keep text-danger-700" data-testid="client-conflict-error">
              {error}
            </p>
          )}
        </section>
      ) : (
        <div role="status" className="flex w-full max-w-[28rem] items-start gap-2.5 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3 shadow-lg" data-testid="client-merged">
          <GitMerge aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-700" />
          <p className="t-sub min-w-0 flex-1 break-keep text-slate-800">
            <b className="font-semibold text-slate-900">‘{name}’</b> — 다른 곳에서 먼저 고친 내용과 합쳐서 저장했어요(둘 다 남겼어요).
          </p>
          <button type="button" aria-label="알림 닫기" onClick={() => setMerged(null)} className="tap -m-1 inline-flex size-9 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-slate-100">
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
