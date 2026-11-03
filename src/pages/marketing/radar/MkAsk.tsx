/**
 * D-511 마케팅 · 브랜딩 첫 화면 맨 위 대화창 — 오늘 화면 대화창처럼 한 줄 쓰면 바로 그 결과로.
 * 대표(2026-11-03): "처음에 딱 미니 LLM 처럼 보이고 살펴보기 · 만들기만 — 나머지는 한 번 눌러야 보이게. 진짜 심플하게".
 *  - 쓴 말은 규칙으로 갈 곳을 정한다(services/marketing/mkAsk) — 'AI' 라고 부르지 않는다. 글을 AI 로 다시 쓰는 것은 그 화면의 [AI로 다 쓰기] 단추만.
 *  - 아래 바로 가기 다섯(이번 주 · 1주일치 · 스레드 · 릴스/틱톡 · 블로그/플레이스) — 쓰지 않고 한 번 눌러도 된다.
 */
import { useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { MK_ASK_CHIPS, mkRoute, type MkRoute } from '../../../services/marketing/mkAsk'

export function MkAsk({ onRoute }: { onRoute: (r: MkRoute) => void }) {
  const [text, setText] = useState('')
  const [hint, setHint] = useState('')
  const go = (t: string) => {
    const r = mkRoute(t)
    if (r.kind === 'none') return setHint('주제를 두 글자 이상 써 주세요 — 예) 정책자금 달라지는 점')
    setHint('')
    onRoute(r)
  }
  return (
    <section className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="mk-ask-title" data-testid="mk-ask">
      <div className="flex flex-col gap-1">
        <h2 id="mk-ask-title" className="t-section flex items-center gap-2 text-slate-900">
          <MessageCircle aria-hidden="true" className="size-5 shrink-0 text-brand-600" />
          무엇을 만들까요?
        </h2>
        <p className="t-sub break-keep text-slate-700" data-testid="mk-guide">
          주제나 하고 싶은 것을 한 줄로 쓰면, 올릴 글 · 대본을 바로 만들어 드려요.
        </p>
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          go(text)
        }}
      >
        <label className="flex min-w-0 flex-1">
          <span className="sr-only">무엇을 만들까요</span>
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              if (hint) setHint('')
            }}
            maxLength={80}
            placeholder="예) 정책자금 달라지는 점 · 스레드 글로"
            className="t-body min-h-12 w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3.5 outline-none placeholder:text-slate-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            data-testid="mk-ask-input"
          />
        </label>
        <Button type="submit" variant="primary" className="min-h-12 justify-center" data-testid="mk-ask-go">
          <Send aria-hidden="true" className="size-4" /> 만들기
        </Button>
      </form>
      {hint && (
        <p role="status" className="t-sub break-keep text-danger-700" data-testid="mk-ask-hint">
          {hint}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5" data-testid="mk-ask-chips">
        {MK_ASK_CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => go(c.say)}
            className="tap t-sub min-h-11 rounded-full border border-slate-200 bg-white px-3.5 font-semibold break-keep text-slate-800 hover:border-brand-300 hover:bg-slate-50"
            data-testid="mk-ask-chip"
            data-id={c.id}
          >
            {c.label}
          </button>
        ))}
      </div>
    </section>
  )
}
