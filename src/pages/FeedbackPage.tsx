/**
 * 개발자에게 피드백 — 팀장 설문 화면 (D-188).
 *
 * 누르기만 하면 되는 설문(1~5점 · 해당되는 것 모두 · 하나 고르기) + 마지막에 직접 쓰기.
 * 안 써 본 것은 비워 둔다. 보내면 대표 화면 [받은 피드백함] 에 바로 뜬다(알림 · 빨간 숫자).
 * 대표가 팀장 화면을 보는 중이면 미리 보기만(보내기 꺼짐) — 대표 이름으로 팀장 의견이 쌓이지 않게.
 */

import { useContext, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Check, CheckCircle2, MessageSquareHeart, Send } from 'lucide-react'
import { AuthContext } from '../auth/authContext'
import { useIsPilot, useViewingPilot } from '../auth/osAccess'
import { useCurrentUser } from '../components/layout/useCurrentUser'
import { useMyFeedback } from '../components/feedback/useFeedback'
import { Button } from '../components/ui/Button'
import { ScreenTitle } from '../components/ui/primitives'
import { useToast } from '../components/ui/toastContext'
import { nowIso, todayLocalDate } from '../lib/appClock'
import { FEEDBACK_QUESTIONS, answeredCount, feedbackRound, submitFeedback, type FeedbackAnswers, type FeedbackEntry } from '../services/feedbackSurvey'

function whenText(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function FeedbackPage() {
  const pilot = useIsPilot()
  const viewing = useViewingPilot()
  const auth = useContext(AuthContext)
  const me = useCurrentUser()
  const { showToast } = useToast()
  const workspaceId = auth?.currentWorkspaceId ?? null
  const loaded = useMyFeedback(workspaceId)
  /** 방금 보낸 것 — 목록을 다시 읽기 전에도 바로 보이게 */
  const [justSent, setJustSent] = useState<FeedbackEntry[]>([])
  const mine = useMemo(() => {
    if (loaded === null && justSent.length === 0) return null
    const base = loaded ?? []
    return [...justSent.filter((j) => !base.some((e) => e.id === j.id)), ...base]
  }, [loaded, justSent])
  const round = feedbackRound(todayLocalDate())
  const [answers, setAnswers] = useState<FeedbackAnswers>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const done = useMemo(() => (mine ?? []).some((e) => e.round === round.id), [mine, round.id])
  const count = answeredCount(answers)

  // 대표 화면에서는 받은 피드백함으로
  if (!pilot) return <Navigate to="/feedback/inbox" replace />

  const set = (id: string, v: FeedbackAnswers[string] | undefined) =>
    setAnswers((cur) => {
      const next = { ...cur }
      if (v === undefined || (Array.isArray(v) && v.length === 0) || v === '') delete next[id]
      else next[id] = v
      return next
    })

  const send = async () => {
    if (viewing || count === 0 || sending) return
    setSending(true)
    try {
      const user = auth?.session?.user
      const entry = await submitFeedback(workspaceId, {
        answers,
        author: { id: user?.id ?? '', name: me.name, title: me.title, email: user?.email ?? '' },
        today: todayLocalDate(),
        at: nowIso(),
        device: typeof window !== 'undefined' && window.innerWidth < 1024 ? '휴대폰' : 'PC',
      })
      setJustSent((cur) => [entry, ...cur])
      setSent(true)
      setAnswers({})
      window.scrollTo({ top: 0 })
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '보내지 못했습니다. 잠시 뒤 다시 눌러 주세요.')
    } finally {
      setSending(false)
    }
  }

  const history = (
    <section className="flex flex-col gap-2" data-testid="feedback-history">
      <h2 className="t-section text-slate-900">내가 보낸 피드백 {(mine ?? []).length}건</h2>
      {(mine ?? []).length === 0 ? (
        <p className="t-sub text-slate-500">아직 보낸 것이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {(mine ?? []).slice(0, 8).map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5">
              <span className="t-sub font-semibold text-slate-800">{e.roundLabel || '피드백'}</span>
              <span className="t-meta text-slate-500">{whenText(e.at)} · 답 {Object.keys(e.answers).length}개</span>
              <span data-testid="feedback-read" className={`t-meta ml-auto font-semibold ${e.readAt ? 'text-success-700' : 'text-slate-500'}`}>
                {e.readAt ? '✓ 대표님 읽음' : '아직 안 읽음'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  if (sent) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <div data-testid="feedback-sent" className="flex flex-col items-center gap-3 rounded-(--radius-panel) border border-success-200 bg-success-50 px-6 py-8 text-center">
          <CheckCircle2 aria-hidden="true" className="size-10 text-success-600" />
          <p className="text-[1.25rem] font-bold text-slate-900">보냈어요 — 고맙습니다!</p>
          <p className="t-sub break-keep text-slate-700">대표님 [받은 피드백함]에 바로 전달됐어요. 읽으시면 아래에 '대표님 읽음' 이 표시됩니다.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={() => setSent(false)}>
              더 보내기
            </Button>
            <Link to="/" className="tap inline-flex min-h-11 items-center rounded-(--radius-control) bg-slate-900 px-4 font-semibold text-white hover:bg-slate-800">
              오늘로
            </Link>
          </div>
        </div>
        {history}
      </div>
    )
  }

  let no = 0
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <ScreenTitle title="개발자에게 피드백" sub={`${round.label} · 2주마다 한 번 · 누르기만 하면 1분`} />

      <div className="flex items-start gap-3 rounded-(--radius-panel) border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-4">
        <MessageSquareHeart aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-orange-600" />
        <div className="min-w-0">
          <p className="text-[1rem] font-bold break-keep text-slate-900">쓰시면서 느낀 그대로 눌러 주세요</p>
          <p className="t-sub break-keep text-slate-700">안 써 본 것은 비워 두셔도 됩니다. 보내면 대표님께 바로 전달되고, 다음 고도화 순서를 정하는 데 씁니다.</p>
          {done && (
            <p data-testid="feedback-done" className="t-sub mt-1.5 font-semibold break-keep text-success-700">
              ✓ 이번 회차는 이미 보내셨어요 — 더 하고 싶은 말이 있으면 또 보내도 됩니다.
            </p>
          )}
        </div>
      </div>

      {viewing && (
        <p role="status" data-testid="feedback-viewing" className="t-sub rounded-(--radius-control) border border-slate-200 bg-slate-50 px-4 py-3 break-keep text-slate-700">
          지금은 대표님이 팀장 화면을 보는 중이라 미리 보기만 됩니다(보내기는 팀장님 계정에서).
        </p>
      )}

      {FEEDBACK_QUESTIONS.map((q) => {
        no += 1
        const v = answers[q.id]
        return (
          <section key={q.id} data-testid="feedback-q" data-kind={q.kind} className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-4 sm:px-5">
            <p className="text-[1.02rem] font-bold break-keep text-slate-900">
              <span className="mr-1.5 text-orange-600">{no}.</span>
              {q.title}
            </p>
            {q.kind === 'rating' && (
              <div>
                <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={q.title}>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const on = v === n
                    return (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={`${n}점`}
                        onClick={() => set(q.id, on ? undefined : n)}
                        className={`tap min-h-12 rounded-(--radius-control) border text-[1.1rem] font-bold ${on ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-orange-50'}`}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
                <div className="t-meta mt-1.5 flex justify-between text-slate-500">
                  <span>1 {q.low}</span>
                  <span>{q.high} 5</span>
                </div>
              </div>
            )}
            {(q.kind === 'multi' || q.kind === 'single') && (
              <div className="flex flex-col gap-1.5">
                {q.kind === 'multi' && <p className="t-meta text-slate-500">여러 개 골라도 돼요</p>}
                <div className="flex flex-wrap gap-1.5">
                  {q.options.map((o) => {
                    const on = q.kind === 'multi' ? Array.isArray(v) && v.includes(o) : v === o
                    return (
                      <button
                        key={o}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          if (q.kind === 'single') return set(q.id, on ? undefined : o)
                          const cur = Array.isArray(v) ? v : []
                          set(q.id, on ? cur.filter((x) => x !== o) : [...cur, o])
                        }}
                        className={`tap inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-[0.95rem] font-medium break-keep ${on ? 'border-orange-500 bg-orange-50 text-orange-800 ring-1 ring-orange-400' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                      >
                        {on && <Check aria-hidden="true" className="size-4 shrink-0" />}
                        {o}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {q.kind === 'text' && (
              <textarea
                value={typeof v === 'string' ? v : ''}
                onChange={(e) => set(q.id, e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder={q.placeholder}
                aria-label={q.title}
                className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5 text-[1rem]"
              />
            )}
          </section>
        )
      })}

      {/* 보내기 — 질문을 내려 보는 동안 바닥에 붙어 늘 보인다(휴대폰은 아래 메뉴 위) */}
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 lg:bottom-4">
        <div className="flex items-center gap-3 rounded-(--radius-panel) border border-slate-200 bg-white/95 px-4 py-3 shadow-(--shadow-overlay) backdrop-blur">
          <span className="t-sub text-slate-600" data-testid="feedback-count">
            답한 질문 <b className="text-slate-900">{count}</b> / {FEEDBACK_QUESTIONS.length}
          </span>
          <Button variant="primary" className="ml-auto" disabled={count === 0 || sending || Boolean(viewing)} onClick={() => void send()} data-testid="feedback-send">
            <Send aria-hidden="true" className="size-4" />
            {sending ? '보내는 중…' : '대표님께 보내기'}
          </Button>
        </div>
      </div>

      {history}
    </div>
  )
}
