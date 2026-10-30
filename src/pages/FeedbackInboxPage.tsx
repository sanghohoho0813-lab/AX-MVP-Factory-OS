/**
 * 받은 피드백함 — 대표 화면 (D-188).
 *
 * 팀장이 [개발자에게 피드백] 으로 보낸 것을 한곳에 모은다.
 *  - 위: 회차(또는 전체) 모아 보기 — 점수 평균(1~5) · 많이 고른 것 순 · 하나 고르기 · 직접 쓴 말.
 *  - 아래: 보낸 것 하나하나(새 것에 '새로' 표시) — 점수는 점 다섯 개, 고른 것은 칩, 직접 쓴 말은 따옴표 상자.
 * 열면 읽음으로 적는다(사이드바 · 종 숫자가 사라지고, 팀장 화면에 '대표님 읽음'). 이번에 본 '새로' 표시는 화면을 떠날 때까지 둔다.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Inbox, MessageSquareQuote } from 'lucide-react'
import { ScreenTitle } from '../components/ui/primitives'
import { useFeedbackInbox, type InboxEntry } from '../components/feedback/useFeedback'
import { nowIso } from '../lib/appClock'
import { FEEDBACK_QUESTIONS, markFeedbackRead, summarizeFeedback } from '../services/feedbackSurvey'

function whenText(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${days[d.getDay()]}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function Dots({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value}점 / 5점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} aria-hidden="true" className={`size-2.5 rounded-full ${n <= value ? 'bg-orange-500' : 'bg-slate-200'}`} />
      ))}
    </span>
  )
}

function EntryCard({ e, fresh }: { e: InboxEntry; fresh: boolean }) {
  return (
    <li data-testid="feedback-entry" data-fresh={fresh ? '1' : '0'} className={`flex flex-col gap-3 rounded-(--radius-panel) border bg-white px-4 py-4 sm:px-5 ${fresh ? 'border-orange-300 ring-1 ring-orange-200' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {fresh && <span className="rounded-full bg-danger-500 px-2 py-0.5 text-[0.78rem] font-bold text-white">새로</span>}
        <span className="text-[1rem] font-bold text-slate-900">{e.person}</span>
        <span className="t-meta text-slate-500">
          {whenText(e.at)} · {e.roundLabel || '피드백'}
          {e.device ? ` · ${e.device}` : ''}
        </span>
      </div>
      <dl className="flex flex-col gap-2.5">
        {FEEDBACK_QUESTIONS.map((q) => {
          const v = e.answers[q.id]
          if (v === undefined) return null
          return (
            <div key={q.id} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
              <dt className="t-sub shrink-0 break-keep text-slate-500 sm:w-64">{q.title.replace(/ — .*$/, '')}</dt>
              <dd className="min-w-0 flex-1">
                {q.kind === 'rating' && typeof v === 'number' && (
                  <span className="inline-flex items-center gap-2">
                    <Dots value={v} />
                    <b className="text-slate-900">{v}</b>
                    <span className="t-meta text-slate-500">/ 5</span>
                  </span>
                )}
                {Array.isArray(v) && (
                  <span className="flex flex-wrap gap-1">
                    {v.map((o) => (
                      <span key={o} className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[0.88rem] font-medium text-orange-800">
                        {o}
                      </span>
                    ))}
                  </span>
                )}
                {q.kind === 'single' && typeof v === 'string' && (
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-0.5 text-[0.9rem] font-semibold text-slate-800">{v}</span>
                )}
                {q.kind === 'text' && typeof v === 'string' && (
                  <p className="rounded-(--radius-control) border-l-4 border-orange-400 bg-orange-50/60 px-3 py-2 text-[0.98rem] break-keep whitespace-pre-wrap text-slate-800">{v}</p>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
    </li>
  )
}

export function FeedbackInboxPage() {
  const { entries, unread, error } = useFeedbackInbox()
  const [round, setRound] = useState<string>('all')
  /** 이번에 열었을 때 새것이던 줄 — 읽음으로 적은 뒤에도 이 화면에서는 '새로' 를 둔다 */
  const freshIds = useRef<Set<string> | null>(null)
  /** 읽음으로 적은 줄 — 같은 줄을 두 번 적지 않게 */
  const marked = useRef(new Set<string>())
  const [, setTick] = useState(0)

  // D-222 열어 둔 동안 새로 온 피드백도 '새로' 를 달고 읽음으로 적는다 — 예전에는 처음 열 때 한 번만 적어, 그 뒤에 온 것은 종 · 메뉴 숫자에 계속 남았다
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
    if (toRead.length > 0) void markFeedbackRead(toRead, nowIso()).catch(() => {})
  }, [entries])

  const rounds = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>()
    for (const e of entries ?? []) m.set(e.round, { label: e.roundLabel || e.round, n: (m.get(e.round)?.n ?? 0) + 1 })
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [entries])
  const shown = useMemo(() => (entries ?? []).filter((e) => round === 'all' || e.round === round), [entries, round])
  const sum = useMemo(() => summarizeFeedback(shown), [shown])
  const fresh = freshIds.current ?? new Set<string>()
  const total = entries?.length ?? 0

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <ScreenTitle title="받은 피드백함" sub={entries === null ? '불러오는 중…' : `팀장님이 보낸 의견 ${total}건${fresh.size > 0 ? ` · 새 의견 ${fresh.size}건` : unread > 0 ? ` · 새 의견 ${unread}건` : ''}`} />

      {error && (
        <p role="alert" className="t-sub rounded-(--radius-control) border border-slate-200 bg-white px-4 py-3 text-danger-700">
          {error}
        </p>
      )}

      {entries !== null && total === 0 && (
        <div data-testid="feedback-inbox-empty" className="flex flex-col items-center gap-2 rounded-(--radius-panel) border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <Inbox aria-hidden="true" className="size-9 text-slate-400" />
          <p className="text-[1.05rem] font-semibold text-slate-800">아직 받은 피드백이 없습니다</p>
          <p className="t-sub break-keep text-slate-600">팀장님이 왼쪽 아래 [개발자에게 피드백]으로 보내면 여기에 정리되고, 종 · 이 메뉴에 빨간 숫자가 뜹니다.</p>
        </div>
      )}

      {total > 0 && (
        <>
          {rounds.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="회차">
              {[['all', { label: '전체', n: total }] as const, ...rounds].map(([id, r]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={round === id}
                  onClick={() => setRound(id)}
                  className={`tap min-h-10 rounded-full border px-3.5 text-[0.92rem] font-semibold ${round === id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {r.label} {r.n}
                </button>
              ))}
            </div>
          )}

          {/* 모아 보기 */}
          <section data-testid="feedback-summary" className="grid gap-4 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-4 sm:px-5 lg:grid-cols-2">
            <div className="flex flex-col gap-2.5">
              <h2 className="t-section text-slate-900">점수 평균 <span className="t-meta font-normal text-slate-500" data-testid="feedback-basis">(응답 {sum.responses}건 · {sum.people}명)</span></h2>
              {sum.ratings.map((r) => (
                <div key={r.id} className="flex flex-col gap-1">
                  <p className="t-sub break-keep text-slate-700">{r.title}</p>
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${r.average ? (r.average / 5) * 100 : 0}%` }} />
                    </div>
                    <b className="w-16 shrink-0 text-right text-slate-900" data-testid="feedback-avg">{r.average === null ? '—' : `${r.average} / 5`}</b>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {sum.choices.map((c) => (
                <div key={c.id} className="flex flex-col gap-1.5">
                  <h3 className="t-sub font-semibold break-keep text-slate-800">{c.title.replace(/ — .*$/, '')}</h3>
                  {c.counts.length === 0 ? (
                    <p className="t-meta text-slate-400">아직 고른 것이 없습니다</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {c.counts.slice(0, 5).map((x) => (
                        <li key={x.option} className="flex items-center gap-2">
                          <span className="t-meta min-w-0 flex-1 truncate text-slate-700">{x.option}</span>
                          <span className="h-2 w-20 overflow-hidden rounded-full bg-slate-100 sm:w-28">
                            <span className="block h-full rounded-full bg-orange-400" style={{ width: `${(x.count / Math.max(1, sum.responses)) * 100}%` }} />
                          </span>
                          <b className="w-8 shrink-0 text-right text-[0.9rem] text-slate-900">{x.count}</b>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            {sum.texts.length > 0 && (
              <div className="flex flex-col gap-2 lg:col-span-2">
                <h3 className="t-sub flex items-center gap-1.5 font-semibold text-slate-800">
                  <MessageSquareQuote aria-hidden="true" className="size-4 text-orange-600" />
                  직접 쓴 말 {sum.texts.length}건
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {sum.texts.slice(0, 5).map((t, i) => (
                    <li key={i} className="rounded-(--radius-control) border-l-4 border-orange-400 bg-orange-50/60 px-3 py-2 text-[0.95rem] break-keep text-slate-800">
                      {t.text}
                      <span className="t-meta ml-2 text-slate-500">— {t.name} · {whenText(t.at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* 하나하나 */}
          <section className="flex flex-col gap-2.5">
            <h2 className="t-section text-slate-900">보낸 것 하나하나</h2>
            <ul className="flex flex-col gap-2.5">
              {shown.map((e) => (
                <EntryCard key={e.id} e={e} fresh={fresh.has(e.id)} />
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
