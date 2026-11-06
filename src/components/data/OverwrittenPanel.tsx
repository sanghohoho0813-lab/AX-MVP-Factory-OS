/**
 * D-550 SYNC-5 '다른 기기 때문에 덮인 내용' — 보관해 둔 판(D-535)을 보고 그때 내용으로 되돌린다.
 *
 * 설정 › 데이터(대표) · 설정(팀장)에. 모듈 화면 위 알림 줄(ModuleOverwroteNotice)이 여기로 데려온다(?focus=overwritten).
 * 보관된 것이 없으면 아무것도 그리지 않는다(데려온 경우만 '없어요' 한 줄).
 * 되돌리기 = 지금 내용을 먼저 보관하고 바꾼다(지우는 것 0 · 되돌린 것도 다시 되돌림). 한 번 더 묻는다.
 * 박스는 흰 바탕 + 회색 테두리(D-370) · 강조는 글자색.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { History, RotateCcw } from 'lucide-react'
import { Panel } from '../ui/Panel'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { useAuth } from '../../auth/AuthProvider'
import { listOverwritten, readModuleRow, restoreOverwritten, type OverwrittenEntry } from '../../services/moduleData'
import { diffSummary, kindLabel, openHref, recordTitle, whenLabel } from '../../services/overwrittenView'
import { listClients } from '../../services/clientOpsService'
import { todayLocalDate } from '../../lib/appClock'

const FIRST = 5
const MORE = 20

type Diff = ReturnType<typeof diffSummary> | 'loading' | 'error'

function DiffBox({ workspaceId, entry }: { workspaceId: string; entry: OverwrittenEntry }) {
  const [diff, setDiff] = useState<Diff | null>(null)
  const load = () => {
    if (diff) return
    setDiff('loading')
    readModuleRow(workspaceId, entry.originalId).then(
      (row) => setDiff(diffSummary(entry.data, row ? row.data : null)),
      () => setDiff('error'),
    )
  }
  return (
    <details className="mt-2" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && load()} data-testid="overwritten-diff">
      <summary className="t-sub w-fit font-semibold text-brand-700">지금 내용과 무엇이 달라요?</summary>
      <div className="t-sub mt-2 break-keep text-slate-700">
        {diff === 'loading' && <p>읽는 중…</p>}
        {diff === 'error' && <p className="text-danger-700">지금 내용을 읽지 못했어요 — 인터넷을 확인하고 다시 펼쳐 주세요.</p>}
        {diff && typeof diff === 'object' && diff.removed && <p>지금은 이 기록이 지워져 있어요 — 되돌리면 그때 내용으로 다시 만들어요.</p>}
        {diff && typeof diff === 'object' && !diff.removed && diff.count === 0 && <p>지금 내용과 같아요.</p>}
        {diff && typeof diff === 'object' && !diff.removed && diff.count > 0 && (
          <>
            <p>고친 곳 {diff.count}군데{diff.samples.length < diff.count ? ` — 앞 ${diff.samples.length}곳만 보여요` : ''}</p>
            <ul className="mt-1 flex flex-col gap-1.5">
              {diff.samples.map((x, i) => (
                <li key={i} className="rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2">
                  <p>
                    <span className="font-semibold text-slate-900">그때</span> {x.then}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">지금</span> {x.now}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  )
}

export function OverwrittenPanel({ focus = false }: { focus?: boolean }) {
  const { currentWorkspaceId } = useAuth()
  const [entries, setEntries] = useState<OverwrittenEntry[] | null>(null)
  const [error, setError] = useState('')
  const [shown, setShown] = useState(FIRST)
  const [names, setNames] = useState<Record<string, string>>({})
  const [ask, setAsk] = useState<OverwrittenEntry | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ line: string; href: string } | null>(null)
  const box = useRef<HTMLDivElement | null>(null)
  const today = todayLocalDate()

  const load = useCallback(async () => {
    if (!currentWorkspaceId) return
    setError('')
    try {
      const list = await listOverwritten(currentWorkspaceId)
      setEntries(list ?? [])
      if (list && list.some((e) => e.clientId)) {
        listClients(currentWorkspaceId).then(
          (cs) => setNames(Object.fromEntries(cs.map((c) => [c.id, c.companyName]))),
          () => undefined,
        )
      }
    } catch {
      setEntries([])
      setError('보관한 내용을 읽지 못했어요 — 인터넷을 확인하고 새로 고쳐 주세요.')
    }
  }, [currentWorkspaceId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (focus && entries && box.current) box.current.scrollIntoView({ block: 'start' })
  }, [focus, entries])

  if (!currentWorkspaceId || entries === null) return null
  if (entries.length === 0 && !focus && !error) return null

  const restore = async () => {
    if (!ask || busy) return
    setBusy(true)
    try {
      const r = await restoreOverwritten(currentWorkspaceId, ask.id)
      setDone({
        line: `${kindLabel(ask)}${recordTitle(ask) ? ` '${recordTitle(ask)}'` : ''} — ${whenLabel(ask.replacedAt, today)} 전 내용으로 되돌렸어요${r.recreated ? '(지워져 있어 다시 만들었어요)' : '. 바로 전 내용은 목록 맨 위에 보관했어요'}.`,
        href: openHref(ask),
      })
      setAsk(null)
      setShown(FIRST)
      await load()
    } catch (cause) {
      setDone({ line: cause instanceof Error && cause.message ? cause.message : '되돌리지 못했어요 — 다시 눌러 주세요.', href: '' })
      setAsk(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={box} className="scroll-mt-20" data-testid="overwritten-panel">
      <Panel title={entries.length ? `다른 기기 때문에 덮인 내용 ${entries.length}개` : '다른 기기 때문에 덮인 내용'}>
        <p className="t-sub break-keep text-slate-600">
          PC · 휴대폰에서 같은 기록을 함께 고치면 나중 것이 저장되고, 먼저 것은 지우지 않고 여기 보관돼요. [되돌리기] 를 누르면 그때 내용으로 바꾸고, 지금 내용도 보관해 둬요.
        </p>
        {error && <p className="t-sub mt-3 text-danger-700">{error}</p>}
        {!error && entries.length === 0 && (
          <p className="t-sub mt-3 text-slate-700" data-testid="overwritten-empty">
            보관된 내용이 없어요.
          </p>
        )}
        {done && (
          <p role="status" className="t-sub mt-3 break-keep text-slate-900" data-testid="overwritten-done">
            {done.line}{' '}
            {done.href && (
              <Link to={done.href} className="font-semibold text-brand-700 underline">
                열어 보기 →
              </Link>
            )}
          </p>
        )}
        {entries.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {entries.slice(0, shown).map((e) => {
              const title = recordTitle(e)
              const company = e.clientId ? names[e.clientId] : ''
              const href = openHref(e)
              return (
                <li key={e.id} className="rounded-(--radius-control) border border-slate-200 bg-white px-4 py-3" data-testid="overwritten-item">
                  {/* 휴대폰은 글 아래에 단추(이름이 좁은 칸에 짜부라지지 않게) */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="t-body font-semibold break-keep text-slate-900">
                        <History aria-hidden="true" className="mr-1 inline size-4 text-slate-500" />
                        {kindLabel(e)}
                        {title ? ` · ${title}` : ''}
                      </p>
                      <p className="t-sub mt-0.5 break-keep text-slate-600">
                        {company ? `${company} · ` : ''}
                        {e.reason === 'restore' ? `${whenLabel(e.replacedAt, today)} 되돌리기 바로 전 내용` : `${whenLabel(e.replacedAt, today)} 다른 기기 저장에 덮임`}
                        {e.restoredAt && <span className="ml-1 font-semibold text-brand-700">· {whenLabel(e.restoredAt, today)}에 이 내용으로 되돌림</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {href && (
                        <Link to={href} className="t-sub tap inline-flex items-center rounded-(--radius-control) px-2 font-semibold text-brand-700 hover:bg-slate-100">
                          열어 보기
                        </Link>
                      )}
                      <Button variant="secondary" onClick={() => setAsk(e)} disabled={busy} data-testid="overwritten-restore">
                        <RotateCcw aria-hidden="true" className="size-4" />
                        되돌리기
                      </Button>
                    </div>
                  </div>
                  <DiffBox workspaceId={currentWorkspaceId} entry={e} />
                </li>
              )
            })}
          </ul>
        )}
        {entries.length > shown && (
          <Button variant="secondary" className="mt-3 w-full" onClick={() => setShown((n) => n + MORE)} data-testid="overwritten-more">
            {Math.min(MORE, entries.length - shown)}개 더 보기(남은 {entries.length - shown}개)
          </Button>
        )}
      </Panel>
      <ConfirmModal
        open={!!ask}
        title="그때 내용으로 되돌릴까요?"
        message={ask ? `${kindLabel(ask)}${recordTitle(ask) ? ` '${recordTitle(ask)}'` : ''} — ${whenLabel(ask.replacedAt, today)} 전 내용으로 바꿔요. 지금 내용은 지우지 않고 이 목록 맨 위에 보관해 둬요.` : ''}
        warning="다른 기기에서 이 기록을 열어 두었다면, 그 화면은 새로 고친 뒤 써 주세요."
        confirmLabel="되돌리기"
        busy={busy}
        onConfirm={() => void restore()}
        onCancel={() => setAsk(null)}
      />
    </div>
  )
}
