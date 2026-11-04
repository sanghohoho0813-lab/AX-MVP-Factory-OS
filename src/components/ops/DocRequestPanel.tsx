/**
 * D-512 서류함 맨 위 '요청한 서류' — 보낸 요청 문구가 업체에 남아, 서류가 들어오면 저절로 줄어든다.
 *
 * 첫 화면은 한 줄(언제 보냈나 · 며칠째 · n/m 받음 · 아직 안 온 것 두 개) + 단추 둘. 줄 목록은 [목록 보기] 를 눌러야 펼친다(📐 첫 화면은 단순하게).
 * 박스는 흰 바탕 + 회색 테두리 하나(D-370) · 늦음(3일 넘게)만 빨간 글자.
 */
import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, Circle, MailCheck, Send } from 'lucide-react'
import type { ClientOpsRecord, DocRequest, DocumentKey } from '../../types/clientOps'
import { closedRequests, DOC_REQUEST_SHOWN, openRequests, requestProgress, withItemDone, withRequestClosed } from '../../services/docRequests'
import { Button } from '../ui/Button'

/** 보낸 뒤 이만큼 지나도 덜 왔으면 빨간 글자 — [보냈어요] 할 일 기한(3일)과 같게 */
const LATE_DAYS = 3

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`

export function DocRequestPanel({
  record,
  today,
  onCommit,
  onResend,
  onJump,
  onFinish,
}: {
  record: ClientOpsRecord
  today: string
  onCommit: (next: ClientOpsRecord) => Promise<boolean>
  /** 아직 안 온 것만 다시 부탁하는 문구 창 */
  onResend: (req: DocRequest) => void
  /** 그 서류 칸으로 */
  onJump: (key: DocumentKey) => void
  /** 다 받았을 때 — 이 요청으로 만든 할 일을 끝낸다(없으면 요청만 끝냄) */
  onFinish?: (req: DocRequest) => Promise<void>
}) {
  // D-532 표시만 줄인다 — 끝내지 않은 요청은 기록에 전부 남아 있고, 넘는 것은 [n개 더 보기] 로 연다(예전: 3개만 보이고 나머지는 말없이 숨음)
  const [allOpen, setAllOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const openAll = openRequests(record)
  const closed = closedRequests(record)
  if (!openAll.length && !closed.length) return null
  const open = allOpen ? openAll : openAll.slice(0, DOC_REQUEST_SHOWN)
  const hidden = openAll.length - open.length
  return (
    // 기다리는 요청이 없으면 '요청한 서류' 판은 없다(예전 그대로) — 지난 요청 한 줄만 남는다
    <section aria-label={openAll.length ? '요청한 서류' : '지난 서류 요청'} data-testid={openAll.length ? 'doc-req' : 'doc-req-history-wrap'} className="flex flex-col gap-2">
      {open.map((req) => (
        <RequestRow key={req.id} record={record} req={req} today={today} onCommit={onCommit} onResend={onResend} onJump={onJump} onFinish={onFinish} />
      ))}
      {(hidden > 0 || (allOpen && openAll.length > DOC_REQUEST_SHOWN) || closed.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {(hidden > 0 || allOpen) && openAll.length > DOC_REQUEST_SHOWN && (
            <button
              type="button"
              aria-expanded={allOpen}
              onClick={() => setAllOpen((v) => !v)}
              data-testid="doc-req-more"
              className="tap t-sub inline-flex min-h-9 items-center gap-1 rounded-(--radius-control) px-2 font-semibold text-brand-700 hover:bg-slate-50"
            >
              {allOpen ? '요청 접기' : `기다리는 요청 ${hidden}개 더 보기`}
              {allOpen ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
            </button>
          )}
          {closed.length > 0 && (
            <button
              type="button"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen((v) => !v)}
              data-testid="doc-req-history-toggle"
              className="tap t-sub inline-flex min-h-9 items-center gap-1 rounded-(--radius-control) px-2 font-medium text-slate-600 hover:bg-slate-50"
            >
              {historyOpen ? '지난 요청 접기' : `지난 요청 ${closed.length}건`}
              {historyOpen ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
            </button>
          )}
        </div>
      )}
      {historyOpen && closed.length > 0 && (
        <ul data-testid="doc-req-history" className="flex flex-col divide-y divide-slate-100 rounded-(--radius-panel) border border-slate-200 bg-white px-4">
          {closed.map((req) => {
            const p = requestProgress(record, req, today)
            return (
              <li key={req.id} data-testid="doc-req-history-row" className="t-sub flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 break-keep text-slate-700">
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {req.title || '서류 요청'} · {md(req.sentAt)} 보냄 · {md(req.closedAt ?? req.sentAt)} 끝냄
                </span>
                <span className="shrink-0 tabular-nums text-slate-600">{p.got}/{p.total} 받음</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function RequestRow({
  record,
  req,
  today,
  onCommit,
  onResend,
  onJump,
  onFinish,
}: {
  record: ClientOpsRecord
  req: DocRequest
  today: string
  onCommit: (next: ClientOpsRecord) => Promise<boolean>
  onResend: (req: DocRequest) => void
  onJump: (key: DocumentKey) => void
  onFinish?: (req: DocRequest) => Promise<void>
}) {
  const [listOpen, setListOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const p = requestProgress(record, req, today)
  const late = !p.done && p.waitingDays >= LATE_DAYS
  const pendingNames = p.pending.map((v) => v.item.label)

  const finish = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onFinish?.(req)
      await onCommit(withRequestClosed(record, req.id, today))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-testid="doc-req-row" data-id={req.id} data-done={p.done ? '1' : '0'} className="flex flex-col gap-2 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="t-body flex min-w-0 flex-wrap items-baseline gap-x-2 break-keep text-slate-900">
          <MailCheck aria-hidden="true" className="size-4 shrink-0 self-center text-brand-700" />
          <b className="font-bold">{p.done ? '요청한 서류를 다 받았어요' : '요청한 서류'}</b>
          <span className="t-sub text-slate-600">
            {md(req.sentAt)} 보냄{req.resentAt ? ` · ${md(req.resentAt)} 다시 보냄` : ''}
          </span>
          {!p.done && (
            <span data-testid="doc-req-days" className={`t-sub font-semibold ${late ? 'text-danger-700' : 'text-slate-700'}`}>
              {p.waitingDays === 0 ? '오늘 보냄' : `${p.waitingDays}일째 기다리는 중`}
            </span>
          )}
        </p>
        <span data-testid="doc-req-count" className={`t-body shrink-0 font-bold tabular-nums ${p.done ? 'text-success-700' : 'text-slate-900'}`}>
          {p.got}/{p.total} 받음
        </span>
      </div>

      {!p.done && !listOpen && pendingNames.length > 0 && (
        <p data-testid="doc-req-pending" className="t-sub break-keep text-slate-700 [overflow-wrap:anywhere]">
          아직: {pendingNames.slice(0, 2).join(' · ')}
          {pendingNames.length > 2 ? ` 외 ${pendingNames.length - 2}개` : ''}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {p.done ? (
          <Button variant="primary" size="sm" disabled={busy} onClick={() => void finish()} data-testid="doc-req-finish">
            <Check aria-hidden="true" className="size-3.5" />
            {req.todoId ? '끝내기(할 일도 완료)' : '끝내기'}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => onResend(req)} data-testid="doc-req-resend">
            <Send aria-hidden="true" className="size-3.5" />
            아직 안 온 {p.pending.length}개 다시 요청
          </Button>
        )}
        <button
          type="button"
          aria-expanded={listOpen}
          onClick={() => setListOpen((v) => !v)}
          data-testid="doc-req-list-toggle"
          className="tap t-sub inline-flex min-h-9 items-center gap-1 rounded-(--radius-control) px-2 font-semibold text-slate-700 hover:bg-slate-50"
        >
          {listOpen ? '목록 접기' : '목록 보기'}
          {listOpen ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
        </button>
        {!p.done && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onCommit(withRequestClosed(record, req.id, today))}
            data-testid="doc-req-close"
            className="tap t-sub ml-auto inline-flex min-h-9 items-center rounded-(--radius-control) px-2 font-medium text-slate-500 hover:bg-slate-50"
          >
            요청 끝내기
          </button>
        )}
      </div>

      {listOpen && (
        <ul className="flex flex-col divide-y divide-slate-100" data-testid="doc-req-list">
          {p.items.map((v) => (
            <li key={v.item.label} data-testid="doc-req-item" data-got={v.got ? '1' : '0'} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
              {v.got ? <Check aria-hidden="true" className="size-4 shrink-0 text-success-700" /> : <Circle aria-hidden="true" className="size-4 shrink-0 text-slate-400" />}
              <span className={`t-sub min-w-0 flex-1 break-keep [overflow-wrap:anywhere] ${v.got ? 'text-slate-600' : 'font-semibold text-slate-900'}`}>
                {v.item.label}
                {v.got && <span className="t-meta ml-1.5 font-normal text-success-700">{md(v.gotAt)} 받음{v.byDoc ? '' : '(체크)'}</span>}
              </span>
              {v.keys.length > 0 && (
                <button type="button" onClick={() => onJump(v.keys[0])} data-testid="doc-req-item-jump" data-key={v.keys[0]} className="tap t-meta inline-flex min-h-9 items-center rounded-(--radius-control) px-2 font-semibold text-brand-700 hover:bg-slate-50">
                  칸 보기
                </button>
              )}
              {!v.got && (
                <button
                  type="button"
                  onClick={() => void onCommit(withItemDone(record, req.id, v.item.label, today))}
                  data-testid="doc-req-item-done"
                  className="tap t-meta inline-flex min-h-9 items-center rounded-(--radius-control) border border-slate-200 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  받았어요
                </button>
              )}
              {v.got && !v.byDoc && (
                <button
                  type="button"
                  onClick={() => void onCommit(withItemDone(record, req.id, v.item.label, null))}
                  data-testid="doc-req-item-undo"
                  className="tap t-meta inline-flex min-h-9 items-center rounded-(--radius-control) px-2 font-medium text-slate-500 hover:bg-slate-50"
                >
                  되돌리기
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!listOpen && !p.done && p.pending.some((v) => v.keys.length === 0) && (
        <p className="t-meta break-keep text-slate-500">서류함 칸이 없는 것(날짜 · 금액 · 한 줄 답)은 [목록 보기] 에서 [받았어요] 로 체크해요. 서류는 올리면 저절로 받음이 돼요.</p>
      )}
    </div>
  )
}
