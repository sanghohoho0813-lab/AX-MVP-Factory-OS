/**
 * D-271 기획 대화 화면 — AI 의 회사 이해 · 의견(흔한 방향 · 약한 점) · 질문 하나와 누를 답. 대표는 답을 누르거나 짧게 적는다.
 * 명세서 작업판 · 벤처 사업계획서 AI 판이 같이 쓴다(testId 앞머리만 다름).
 */
import { useState } from 'react'
import { ArrowRight, Loader2, MessageCircleQuestion, Send, Sparkles } from 'lucide-react'
import { Button } from '../ui/Button'
import { TALK_MAX, answeredCount, openRound, talkFinished, type TalkRound } from '../../services/aiAssist/talk'
import { AiConfirm } from './AiConfirm'

export function PlanTalk({
  rounds,
  busy,
  onAnswer,
  onNext,
  nextLabel,
  testId,
  compact = false,
}: {
  rounds: TalkRound[]
  busy: boolean
  /** 답을 누르거나 적어 보냄 */
  onAnswer: (answer: string) => void
  /** [이제 아이디어 5개 내줘] 같은 다음 단계 */
  onNext: () => void
  nextLabel: string
  testId: string
  /** 아이디어가 나온 뒤에는 접어서 */
  compact?: boolean
}) {
  const [own, setOwn] = useState('')
  const open = openRound(rounds)
  const n = answeredCount(rounds)
  const finished = talkFinished(rounds)
  const body = (
    <ol className="flex flex-col gap-2.5" data-testid={`${testId}-rounds`}>
      {rounds.map((r, i) => (
        <li key={i} className="flex flex-col gap-1.5" data-testid={`${testId}-round`} data-answered={r.answer ? 'yes' : 'no'} data-done={r.done ? 'yes' : 'no'}>
          <div className="flex flex-col gap-1.5 rounded-(--radius-control) border border-violet-200 bg-violet-50/60 px-3 py-2.5">
            {r.understanding && (
              <p className="t-sub break-keep text-slate-800" data-testid={`${testId}-understanding`}>
                <b className="font-semibold text-violet-900">회사 이해</b> · {r.understanding}
              </p>
            )}
            {r.opinions.length > 0 && (
              <ul className="flex flex-col gap-0.5" data-testid={`${testId}-opinions`}>
                {r.opinions.map((o, j) => (
                  <li key={j} className="t-sub break-keep text-slate-700">
                    <b className="font-semibold text-slate-900">{o.title}</b>
                    {o.note ? ` — ${o.note}` : ''}
                  </li>
                ))}
              </ul>
            )}
            {r.done ? (
              <p className="t-sub font-semibold break-keep text-success-800" data-testid={`${testId}-enough`}>
                충분히 좁혀졌어요 — {r.why || '이제 낼 수 있어요'}
              </p>
            ) : (
              r.question && (
                <p className="t-body font-bold break-keep text-slate-900" data-testid={`${testId}-question`}>
                  <MessageCircleQuestion aria-hidden="true" className="mr-1 inline size-5 align-[-3px] text-violet-700" />
                  {r.question}
                  {r.why && <span className="t-meta block font-normal text-slate-500">{r.why}</span>}
                </p>
              )
            )}
          </div>
          {r.answer && (
            <p className="t-sub ml-6 self-end rounded-(--radius-control) bg-slate-900 px-3 py-1.5 break-keep text-white" data-testid={`${testId}-answer`}>
              {r.answer}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
  if (compact) {
    return (
      <details className="rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2" data-testid={testId}>
        <summary className="tap t-sub cursor-pointer font-semibold text-slate-700">기획 대화 {n}번 — 이 답대로 냈어요(펼쳐 보기)</summary>
        <div className="mt-2">{body}</div>
      </details>
    )
  }
  return (
    <section className="flex flex-col gap-2.5" data-testid={testId} data-answered={n} aria-label="기획 대화">
      <p className="t-meta font-semibold text-slate-600">
        기획 대화 · 질문 {Math.min(n + (open ? 1 : 0), TALK_MAX)}/{TALK_MAX} — 답을 누르면 다음 질문, {TALK_MAX}번이 되거나 AI 가 충분하다고 하면 그대로 냅니다
      </p>
      {body}
      {open && !busy && (
        <div className="flex flex-col gap-2" data-testid={`${testId}-options`}>
          <div className="flex flex-wrap gap-1.5">
            {open.options.map((o) => (
              <AiConfirm keepLabel confirmLabel="이대로 답하기" cancel={false}><button key={o} type="button" onClick={() => onAnswer(o)} className="tap t-sub min-h-11 rounded-full border border-violet-300 bg-white px-3.5 text-left font-semibold break-keep text-violet-900 hover:bg-violet-50" data-testid={`${testId}-option`}>
                {o}
              </button></AiConfirm>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={own} onChange={(e) => setOwn(e.target.value)} maxLength={300} placeholder="직접 적어도 돼요" aria-label="직접 답하기" className="t-sub min-h-11 min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 bg-white px-2.5 text-slate-900" data-testid={`${testId}-own`} />
            <Button
              variant="secondary"
              size="sm"
              disabled={own.trim().length < 2}
              onClick={() => {
                onAnswer(own.trim())
                setOwn('')
              }}
              data-testid={`${testId}-send`}
            >
              <Send aria-hidden="true" className="size-4" /> 보내기
            </Button>
          </div>
        </div>
      )}
      {busy && (
        <p className="t-sub flex items-center gap-1.5 text-violet-800" role="status">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" /> AI 가 생각하는 중…
        </p>
      )}
      {!busy && (
        <div className="flex flex-wrap gap-2">
          <AiConfirm><Button variant={finished ? 'primary' : 'ghost'} className={finished ? 'min-h-12' : ''} onClick={onNext} data-testid={`${testId}-next`}>
            {finished ? <Sparkles aria-hidden="true" className="size-5" /> : <ArrowRight aria-hidden="true" className="size-4" />} {nextLabel}
          </Button></AiConfirm>
        </div>
      )}
    </section>
  )
}
