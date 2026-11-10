/**
 * D-568 받은 문의 · 화면 오류 — 대표(운영자) 화면. 받은 피드백함 안의 탭 하나.
 *
 *  - 고객 · 팀장이 [문의하기] 로 보낸 글과, 그 사람 화면에서 난 오류(자동)를 한곳에.
 *  - 열면 읽음으로 적는다(종 · 메뉴 숫자가 사라진다). 이번에 본 '새로' 표시는 화면을 떠날 때까지 둔다.
 *  - 문의에는 답장을 쓸 수 있다 — 보낸 사람의 [문의하기] 화면에 뜬다. 보낸 글은 고치지 못한다.
 *  - 고객사 자료는 여기 오지 않는다 — 글 · 화면 주소 · 오류 글만.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Inbox } from 'lucide-react'
import { markSupportRead, replySupport, type InboxMessage } from '../../services/support'

type Filter = 'all' | 'question' | 'error'

function whenText(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const CONTEXT_LABELS: Record<string, string> = { path: '화면', source: '잡힌 곳', build: '버전', viewport: '화면 크기', agent: '브라우저' }
const SOURCE_LABELS: Record<string, string> = { screen: '화면 오류 판', window: '잡히지 않은 오류', promise: '끝나지 않은 작업' }

function ReplyBox({ m }: { m: InboxMessage }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(m.reply)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const save = async () => {
    if (busy || !text.trim()) return
    setBusy(true)
    const ok = await replySupport(m.id, text)
    setBusy(false)
    setNote(ok ? '답장을 보냈습니다.' : '보내지 못했습니다. 잠시 뒤 다시 눌러 주세요.')
    if (ok) setOpen(false)
  }
  if (!open) {
    return (
      <div className="flex flex-col gap-1.5">
        {m.reply && (
          <div className="flex flex-col gap-0.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2" data-testid="support-inbox-reply">
            <span className="t-meta font-bold text-brand-700">
              보낸 답장 · {whenText(m.repliedAt)}
              {m.seenAt ? ' · 읽음' : ''}
            </span>
            <p className="t-sub break-keep whitespace-pre-wrap text-slate-800">{m.reply}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setOpen(true)} className="tap t-sub min-h-10 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50" data-testid="support-inbox-reply-open">
            {m.reply ? '답장 고쳐 보내기' : '답장 쓰기'}
          </button>
          {note && (
            <span className="t-meta text-slate-600" role="status">
              {note}
            </span>
          )}
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 2000))}
        rows={3}
        aria-label="답장"
        placeholder="답장을 적으세요 — 보낸 사람의 [문의하기] 화면에 뜹니다."
        className="t-sub w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-none"
        data-testid="support-inbox-reply-text"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void save()} disabled={busy || !text.trim()} className="tap t-sub min-h-10 rounded-(--radius-control) bg-brand-600 px-4 font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300" data-testid="support-inbox-reply-send">
          {busy ? '보내는 중…' : '답장 보내기'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="tap t-sub min-h-10 rounded-(--radius-control) px-3 font-medium text-slate-700 hover:bg-slate-50">
          닫기
        </button>
        {note && (
          <span className="t-meta text-danger-700" role="alert">
            {note}
          </span>
        )}
      </div>
    </div>
  )
}

function Card({ m, fresh }: { m: InboxMessage; fresh: boolean }) {
  const who = m.authorName || m.authorEmail || '이름 없음'
  const context = Object.entries(m.context).filter(([k]) => k !== 'stack')
  return (
    <li className={`flex flex-col gap-2.5 rounded-(--radius-panel) border bg-white px-4 py-4 sm:px-5 ${fresh ? 'border-danger-300' : 'border-slate-200'}`} data-testid="support-inbox-entry" data-kind={m.kind} data-fresh={fresh ? '1' : '0'}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {fresh && <span className="rounded-full bg-danger-500 px-2 py-0.5 text-[0.78rem] font-bold text-white">새로</span>}
        <span className={`t-meta rounded-full border px-2 py-0.5 font-semibold ${m.kind === 'error' ? 'border-danger-200 text-danger-700' : 'border-brand-200 text-brand-700'}`}>{m.kind === 'error' ? '화면 오류' : '문의'}</span>
        <span className="text-[1rem] font-bold text-slate-900" data-testid="support-inbox-who">
          {who}
        </span>
        <span className="t-meta rounded-full border border-slate-200 px-2 py-0.5 text-slate-700">{m.audience === 'customer' ? '구독 고객' : '내부'}</span>
        <span className="t-meta text-slate-500">
          {whenText(m.createdAt)}
          {m.authorName && m.authorEmail ? ` · ${m.authorEmail}` : ''}
        </span>
      </div>
      <p className={`break-all whitespace-pre-wrap text-slate-900 ${m.kind === 'error' ? 't-sub font-mono' : 'text-[1rem] break-keep'}`} data-testid="support-inbox-body">
        {m.body}
      </p>
      {context.length > 0 && (
        <p className="t-meta break-all text-slate-600" data-testid="support-inbox-context">
          {context.map(([k, v]) => `${CONTEXT_LABELS[k] ?? k}: ${k === 'source' ? SOURCE_LABELS[v] ?? v : v}`).join(' · ')}
        </p>
      )}
      {m.context.stack && (
        <details className="t-meta text-slate-600">
          <summary className="cursor-pointer">오류가 난 자리</summary>
          <pre className="mt-1 max-h-40 overflow-auto break-all whitespace-pre-wrap">{m.context.stack}</pre>
        </details>
      )}
      <ReplyBox m={m} />
    </li>
  )
}

export function SupportInbox({ entries, error }: { entries: InboxMessage[] | null; error: string }) {
  const [filter, setFilter] = useState<Filter>('all')
  const freshIds = useRef<Set<string> | null>(null)
  const marked = useRef(new Set<string>())
  const [, setTick] = useState(0)

  // 열면 읽음으로 — 열어 둔 동안 새로 온 것도 '새로' 를 달고 읽음으로 적는다
  useEffect(() => {
    if (!entries) return
    const first = freshIds.current === null
    if (first) freshIds.current = new Set()
    const toRead = entries.filter((e) => !e.readAt && !marked.current.has(e.id))
    for (const e of toRead) {
      freshIds.current?.add(e.id)
      marked.current.add(e.id)
    }
    if (first || toRead.length > 0) setTick((n) => n + 1)
    if (toRead.length > 0) void markSupportRead(toRead.map((e) => e.id)).catch(() => {})
  }, [entries])

  const counts = useMemo(() => ({ all: entries?.length ?? 0, question: (entries ?? []).filter((e) => e.kind === 'question').length, error: (entries ?? []).filter((e) => e.kind === 'error').length }), [entries])
  const shown = useMemo(() => (entries ?? []).filter((e) => filter === 'all' || e.kind === filter), [entries, filter])
  const fresh = freshIds.current ?? new Set<string>()

  return (
    <div className="flex flex-col gap-4" data-testid="support-inbox">
      {error && (
        <p role="alert" className="t-sub rounded-(--radius-control) border border-slate-200 bg-white px-4 py-3 text-danger-700">
          {error}
        </p>
      )}
      {entries === null && <p className="t-sub text-slate-600">불러오는 중…</p>}
      {entries !== null && counts.all === 0 && (
        <div data-testid="support-inbox-empty" className="flex flex-col items-center gap-2 rounded-(--radius-panel) border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <Inbox aria-hidden="true" className="size-9 text-slate-400" />
          <p className="text-[1rem] font-semibold text-slate-800">아직 받은 문의 · 오류가 없습니다</p>
          <p className="t-sub break-keep text-slate-600">고객 · 팀장이 [문의하기] 로 보낸 글과, 그 화면에서 난 오류가 여기에 모입니다. 고객사 자료는 같이 오지 않습니다.</p>
        </div>
      )}
      {counts.all > 0 && (
        <>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="종류">
            {(
              [
                ['all', '전체'],
                ['question', '문의'],
                ['error', '화면 오류'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                onClick={() => setFilter(id)}
                data-testid="support-inbox-filter"
                data-filter={id}
                className={`tap min-h-10 rounded-full border px-3.5 text-[0.9375rem] font-semibold ${filter === id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {label} {counts[id]}
              </button>
            ))}
          </div>
          <ul className="flex flex-col gap-2.5">
            {shown.map((e) => (
              <Card key={e.id} m={e} fresh={fresh.has(e.id)} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
