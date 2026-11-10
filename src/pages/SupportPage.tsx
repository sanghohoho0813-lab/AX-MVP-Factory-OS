/**
 * D-568 문의하기 (출시 목록 L-4) — 팀장 · 구독 고객이 궁금한 점 · 불편한 점을 적어 보내면 운영자(대표)가 읽고 답한다.
 *
 *  - 한 화면에 한 가지: 적는 칸 하나 + [보내기]. 아래에는 보낸 문의와 답장만.
 *  - 가는 것은 적은 글 + 어느 화면에서 왔는지(주소)뿐 — 고객사 자료는 같이 가지 않는다.
 *  - 답장이 오면 메뉴 '설정' 옆에 '답장' 표시 — 이 화면을 열면 본 것으로 적는다(이번에 본 표시는 떠날 때까지 둔다).
 *  - 화면 오류는 자동으로 전해진다(services/support.reportScreenError) — 여기서는 몇 건 갔는지만 접어서 보여 준다.
 * 서버에 0025 가 아직 없으면 '준비하고 있어요' 한 줄만. 운영자가 열면 받은함으로 보낸다.
 */
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, Send } from 'lucide-react'
import { AuthContext } from '../auth/authContext'
import { ScreenTitle } from '../components/ui/primitives'
import { useMySupport, useSupportState } from '../components/support/useSupport'
import { SUPPORT_BODY_MAX, cleanPath, markSupportSeen, messageStatus, sendFailText, sendSupport, unseenReplies, type SupportMessage } from '../services/support'

const BOX = 'rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-4 sm:px-5'

function whenText(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function Row({ m, fresh }: { m: SupportMessage; fresh: boolean }) {
  const st = messageStatus(m)
  return (
    <li className="flex flex-col gap-2 py-3.5" data-testid="support-row" data-status={st.key} data-fresh={fresh ? '1' : '0'}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`t-sub rounded-full border px-2.5 py-0.5 font-semibold ${st.key === 'replied' ? 'border-brand-200 text-brand-700' : 'border-slate-200 text-slate-700'}`} data-testid="support-status">
          {fresh ? '새 답장' : st.label}
        </span>
        <span className="t-sub text-slate-600">{whenText(m.createdAt)}</span>
      </div>
      <p className="t-body break-keep whitespace-pre-wrap text-slate-900">{m.body}</p>
      {m.reply && (
        <div className="flex flex-col gap-1 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5" data-testid="support-reply">
          <span className="t-sub font-bold text-brand-700">운영자 답장 · {whenText(m.repliedAt)}</span>
          <p className="t-body break-keep whitespace-pre-wrap text-slate-900">{m.reply}</p>
        </div>
      )}
    </li>
  )
}

export function SupportPage() {
  const auth = useContext(AuthContext)
  const [params] = useSearchParams()
  const operator = auth?.access === 'full' && !auth.pilotViews.some((v) => v.workspaceId === auth.currentWorkspaceId)
  const state = useSupportState(!operator)
  const ready = state === 'ready'
  const { list, error } = useMySupport(ready)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [fail, setFail] = useState('')
  /** 이번에 열었을 때 새 답장이던 줄 — 본 것으로 적은 뒤에도 이 화면에서는 '새 답장' 을 둔다 */
  const fresh = useRef(new Set<string>())
  const [, setTick] = useState(0)

  useEffect(() => {
    const unseen = unseenReplies(list ?? []).filter((m) => !fresh.current.has(m.id))
    if (unseen.length === 0) return
    for (const m of unseen) fresh.current.add(m.id)
    setTick((n) => n + 1)
    void markSupportSeen(unseen.map((m) => m.id)).catch(() => {})
  }, [list])

  const questions = useMemo(() => (list ?? []).filter((m) => m.kind === 'question'), [list])
  const errors = useMemo(() => (list ?? []).filter((m) => m.kind === 'error'), [list])

  if (operator) return <Navigate to="/feedback/inbox?tab=support" replace />

  const send = async () => {
    if (busy || !text.trim()) return
    setBusy(true)
    setFail('')
    const from = cleanPath(params.get('from') ?? '')
    const res = await sendSupport('question', text, from && from !== '/' ? { path: from } : {})
    setBusy(false)
    if (res.ok) {
      setText('')
      setSent(true)
    } else {
      setSent(false)
      setFail(sendFailText(res.reason))
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4" data-testid="support-page" data-state={state ?? 'loading'}>
      <ScreenTitle title="문의하기" sub="궁금한 점 · 불편한 점을 적어 보내면 운영자가 읽고 답해 드려요." />

      {state === null && <p className={`${BOX} t-body text-slate-700`}>여는 중…</p>}

      {state === 'missing' && (
        <div className={`${BOX} flex flex-col gap-2`} data-testid="support-missing">
          <p className="t-section text-slate-900">문의 창구를 준비하고 있어요</p>
          <p className="t-body break-keep text-slate-700">곧 이 화면에서 바로 물어볼 수 있어요. 그동안 메뉴마다 무엇을 하는 곳인지는 사용법 안내에서 볼 수 있어요.</p>
          <Link to="/guide" className="tap t-body inline-flex min-h-11 w-fit items-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50">
            사용법 안내 보기 <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      )}

      {state === 'off' && (
        <p className={`${BOX} t-body break-keep text-slate-700`} role="alert" data-testid="support-off">
          지금은 연결이 안 돼요. 잠시 뒤 이 화면을 다시 열어 주세요.
        </p>
      )}

      {ready && (
        <>
          <section className={`${BOX} flex flex-col gap-3`} aria-label="문의 적기">
            <label htmlFor="support-text" className="t-section text-slate-900">
              무엇이 궁금하세요?
            </label>
            <textarea
              id="support-text"
              value={text}
              onChange={(e) => {
                setText(e.target.value.slice(0, SUPPORT_BODY_MAX))
                if (sent) setSent(false)
              }}
              rows={4}
              placeholder="예: 서류를 올렸는데 칸에 안 들어가요. / 이런 기능이 있으면 좋겠어요."
              className="t-body w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none"
              data-testid="support-text"
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="t-sub min-w-0 flex-1 basis-64 break-keep text-slate-700">적은 글만 가요 — 고객사 자료는 같이 가지 않아요.</p>
              <button
                type="button"
                onClick={() => void send()}
                disabled={busy || !text.trim()}
                className="tap t-body inline-flex min-h-12 items-center gap-1.5 rounded-(--radius-control) bg-brand-600 px-5 font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                data-testid="support-send"
              >
                <Send aria-hidden="true" className="size-4" /> {busy ? '보내는 중…' : '보내기'}
              </button>
            </div>
            {sent && (
              <p className="t-body flex items-center gap-1.5 break-keep font-semibold text-success-700" role="status" data-testid="support-sent">
                <Check aria-hidden="true" className="size-4 shrink-0" /> 보냈어요. 답장이 오면 왼쪽 메뉴 '설정' 옆에 표시가 떠요.
              </p>
            )}
            {fail && (
              <p className="t-body break-keep font-semibold text-danger-700" role="alert" data-testid="support-fail">
                {fail}
              </p>
            )}
          </section>

          <section className={`${BOX} flex flex-col`} aria-label="보낸 문의">
            <h2 className="t-section text-slate-900">
              보낸 문의 <span className="t-sub font-normal text-slate-600">{list === null ? '불러오는 중…' : `${questions.length}건`}</span>
            </h2>
            {error && (
              <p className="t-sub mt-2 text-danger-700" role="alert">
                {error}
              </p>
            )}
            {list !== null && questions.length === 0 && !error && (
              <p className="t-body mt-2 break-keep text-slate-700" data-testid="support-empty">
                아직 보낸 문의가 없어요. 위 칸에 적고 [보내기] 를 누르면 여기에 쌓여요.
              </p>
            )}
            {questions.length > 0 && (
              <ul className="flex flex-col divide-y divide-slate-200" data-testid="support-list">
                {questions.map((m) => (
                  <Row key={m.id} m={m} fresh={fresh.current.has(m.id)} />
                ))}
              </ul>
            )}
            {errors.length > 0 && (
              <details className="mt-2 border-t border-slate-200 pt-3" data-testid="support-errors">
                <summary className="t-sub cursor-pointer font-semibold text-slate-700">자동으로 전해진 화면 오류 {errors.length}건</summary>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {errors.map((m) => (
                    <li key={m.id} className="t-sub break-all text-slate-700">
                      {whenText(m.createdAt)} · {m.context.path ?? ''} — {m.body}
                      {m.reply ? ` → 답장: ${m.reply}` : ''}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        </>
      )}
    </div>
  )
}
