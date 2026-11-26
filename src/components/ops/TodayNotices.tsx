/**
 * D-653 오늘 — 고객에게 보낼 안내(약속 전날 · 서류 3일째 · 받을 돈 · D-658 새 상담 신청 첫 인사 · D-666 서류 받았다고 알리기).
 *
 * 오늘 머리 줄에 '보낼 안내 n건' 단추 하나(없으면 안 그림) → 누르면 아래에서 올라오는 판에 한 줄씩.
 * 줄마다 [카톡 문구 복사](D-661 — 올리기 링크 · 공고 알림과 같은 말) → 카톡 · 문자에 붙여 보내고 → [보냈어요] → 업체 기록에 남고 목록에서 빠진다(+ 되돌리기).
 * 보내는 것은 사람이다(외부 발송 · 비용 0). 문구는 규칙 글(services/outbound) — AI 가 쓰지 않는다.
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Check, Copy, Send } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { NOTICE_KIND_WORD, outboundNotices, withNoticeSent, type OutboundNotice } from '../../services/outbound'
import { listClients, saveClient } from '../../services/clientOpsService'
import { listJournal, updateJournalEntry } from '../../services/journalService'
import { copyText } from '../consulting/studioParts'
import { useToast } from '../ui/toastContext'
import { Button } from '../ui/Button'
import { BottomSheet } from '../ui/primitives'
import { CallButton } from './opsControls'
import { useSenderLine } from '../layout/useCurrentUser'

const SHOW = 5

const KIND_WORD = NOTICE_KIND_WORD

export function TodayNotices({
  clients,
  today,
  workspaceId,
  onSaved,
  chip = false,
  openSignal = 0,
}: {
  clients: ClientOpsRecord[]
  today: string
  /** 누르기 직전에 이 작업실 기록을 새로 읽는다(D-212 — 아침에 열어 둔 화면으로 덮지 않게) */
  workspaceId: string | null
  onSaved: (record: ClientOpsRecord) => void
  /** 휴대폰 — 숫자 한 줄(가로로 넘기는 칩 줄) 맨 앞 칩 모양으로(머리 줄에 줄을 하나 더 쓰지 않게 · qa:firstscreen) */
  chip?: boolean
  /** D-673 밖에서 판을 연다(종의 '첫 인사 보내기' → /?notices=1) — 값이 바뀔 때마다 한 번 */
  openSignal?: number
}) {
  const sender = useSenderLine()
  const items = useMemo(() => outboundNotices(clients, today, sender), [clients, today, sender])
  const [open, setOpen] = useState(openSignal > 0)
  useEffect(() => {
    if (openSignal > 0) setOpen(true)
  }, [openSignal])
  if (!items.length && !open) return null
  return (
    <>
      {items.length > 0 &&
        (chip ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`보낼 안내 ${items.length}건 — 문구를 복사해 고객에게 보내요`}
            className="tap inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-left hover:border-slate-300 hover:bg-slate-50"
            data-testid="today-notices-open"
            data-count={items.length}
            data-guide="fn-today-notices"
          >
            <Send aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
            <span className="t-sub break-keep whitespace-nowrap text-slate-600">보낼 안내</span>
            <strong className="t-body font-bold whitespace-nowrap text-brand-700 tabular-nums">{items.length}건</strong>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="tap t-sub inline-flex shrink-0 items-center gap-1.5 font-semibold text-brand-700 hover:underline"
            data-testid="today-notices-open"
            data-count={items.length}
            data-guide="fn-today-notices"
          >
            <Send aria-hidden="true" className="size-4" />
            보낼 안내 {items.length}건
          </button>
        ))}
      {/* 판은 body 로 — 오늘 머리 띠(HeroFrame) 안에 그리면 아래 대화창 칸이 판 위로 올라온다(쌓임 순서) */}
      {open &&
        createPortal(
          <NoticeSheet items={items} today={today} workspaceId={workspaceId} clients={clients} onSaved={onSaved} onClose={() => setOpen(false)} />,
          document.body,
        )}
    </>
  )
}

/** D-667 판만 — 업체 화면 '지금 할 것' 알약이 연다(이 업체 것만 · 오늘 화면과 같은 판 · 같은 [보냈어요]) */
export function NoticesSheet({
  clients,
  today,
  workspaceId,
  onSaved,
  onClose,
}: {
  clients: ClientOpsRecord[]
  today: string
  workspaceId: string | null
  onSaved: (record: ClientOpsRecord) => void
  onClose: () => void
}) {
  const sender = useSenderLine()
  const items = useMemo(() => outboundNotices(clients, today, sender), [clients, today, sender])
  return createPortal(<NoticeSheet items={items} today={today} workspaceId={workspaceId} clients={clients} onSaved={onSaved} onClose={onClose} />, document.body)
}

function NoticeSheet({
  items,
  today,
  workspaceId,
  clients,
  onSaved,
  onClose,
}: {
  items: OutboundNotice[]
  today: string
  workspaceId: string | null
  clients: ClientOpsRecord[]
  onSaved: (record: ClientOpsRecord) => void
  onClose: () => void
}) {
  const { showToast } = useToast()
  const [all, setAll] = useState(false)
  const [peek, setPeek] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const shown = all ? items : items.slice(0, SHOW)

  const fresh = async (id: string): Promise<ClientOpsRecord | null> =>
    (await listClients(workspaceId).catch(() => null))?.find((c) => c.id === id) ?? clients.find((c) => c.id === id) ?? null

  /** 그 할 일을 끝냄 · 다시 엶 — 바뀌었으면 true(못 찾았거나 이미 그 상태 · 실패는 false) */
  const setTodo = async (id: string, completed: boolean): Promise<boolean> => {
    try {
      const todo = (await listJournal(workspaceId)).find((e) => e.id === id)
      if (!todo || todo.completed === completed) return false
      await updateJournalEntry(todo, { completed })
      return true
    } catch {
      return false
    }
  }

  const copy = async (n: OutboundNotice) => {
    const ok = await copyText(n.text)
    setCopied(ok ? n.key : null)
    showToast(ok ? '문구를 복사했어요 — 카톡 · 문자에 붙여 보내고 [보냈어요] 를 눌러 주세요' : '복사하지 못했어요 — [문구 보기] 에서 길게 눌러 복사해 주세요')
  }

  const sent = async (n: OutboundNotice) => {
    if (busy) return
    setBusy(n.key)
    try {
      const rec = await fresh(n.clientId)
      if (!rec) throw new Error('업체를 찾지 못했어요')
      const { record, undo } = withNoticeSent(rec, n, today)
      onSaved(await saveClient(record))
      // D-668 다 받았다고 알렸다 → 그 요청은 끝났으니(withNoticeSent) 그 요청으로 만든 '받았는지 확인' 할 일도 같이 끝낸다(못 끝내도 안내는 보낸 것)
      const todoDone = n.todoId ? await setTodo(n.todoId, true) : false
      showToast(`${n.companyName} — 보낸 것으로 적었어요${n.mark.type === 'notice' && n.mark.closeReqId ? ` · 서류 요청을 끝냈어요${todoDone ? '(할 일도 완료)' : ''}` : ''}`, {
        label: '되돌리기',
        onClick: () => {
          void (async () => {
            try {
              const now = await fresh(n.clientId)
              if (!now) throw new Error('missing')
              onSaved(await saveClient(undo(now)))
              if (todoDone && n.todoId) await setTodo(n.todoId, false)
              showToast('되돌렸어요 — 보낼 안내에 다시 보여요')
            } catch {
              showToast('되돌리지 못했어요 — 다시 눌러 주세요')
            }
          })()
        },
      })
    } catch (cause) {
      showToast(cause instanceof Error && cause.message ? cause.message : '저장하지 못했어요 — 다시 눌러 주세요')
    } finally {
      setBusy(null)
    }
  }

  return (
    <BottomSheet title="오늘 고객에게 보낼 안내" onClose={onClose}>
      <div className="flex flex-col gap-3" data-testid="notice-sheet">
        {items.length === 0 ? (
          <p className="t-body break-keep text-slate-700" data-testid="notice-empty">
            오늘 보낼 안내를 다 보냈어요.
          </p>
        ) : (
          <p className="t-sub break-keep text-slate-700">복사해서 보내고 [보냈어요] 를 누르면 목록에서 빠져요</p>
        )}
        <ul className="flex flex-col divide-y divide-slate-200">
          {shown.map((n) => (
            <li key={n.key} className="flex flex-col gap-2 py-3 first:pt-0" data-testid="notice-row" data-kind={n.kind} data-client={n.clientId}>
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="t-meta font-semibold text-slate-500">{KIND_WORD[n.kind]}</span>
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <Link to={`/ops/clients/${n.clientId}`} className="tap t-body font-bold [overflow-wrap:anywhere] text-slate-900 hover:text-brand-700 hover:underline" onClick={onClose}>
                      {n.companyName}
                    </Link>
                    <span className={`t-sub break-keep ${n.kind === 'fee' && /지남/.test(n.title) ? 'font-semibold text-danger-700' : 'text-slate-700'}`} data-testid="notice-title">
                      {n.title}
                    </span>
                  </span>
                </div>
                {/* D-671 글 대신 전화로 — 첫 인사 · 약속 확인은 통화가 빠를 때가 많다(번호가 없으면 안 그림). 통화한 뒤에도 [보냈어요] 로 적는다 */}
                <CallButton phone={n.phone} name={n.companyName} />
              </div>
              {peek === n.key && (
                <p className="t-sub rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 break-keep whitespace-pre-wrap text-slate-800" data-testid="notice-text">
                  {n.text}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => void copy(n)} data-testid="notice-copy">
                  {copied === n.key ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
                  카톡 문구 복사
                </Button>
                <Button variant={copied === n.key ? 'primary' : 'secondary'} disabled={busy === n.key} onClick={() => void sent(n)} data-testid="notice-sent">
                  {busy === n.key ? '적는 중…' : '보냈어요'}
                </Button>
                <button type="button" onClick={() => setPeek(peek === n.key ? null : n.key)} className="tap t-sub font-semibold text-brand-700 hover:underline" data-testid="notice-peek">
                  {peek === n.key ? '문구 접기' : '문구 보기'}
                </button>
              </div>
            </li>
          ))}
        </ul>
        {!all && items.length > SHOW && (
          <button type="button" onClick={() => setAll(true)} className="tap t-sub self-start font-semibold text-brand-700 hover:underline" data-testid="notice-more">
            {items.length - SHOW}건 더 보기
          </button>
        )}
      </div>
    </BottomSheet>
  )
}
