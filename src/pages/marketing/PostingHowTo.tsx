/**
 * D-583 올리는 법 — 접힌 한 줄('처음 올려 보시나요?')을 누르면 채널별 네댓 걸음.
 *
 * 📐 첫 화면에는 한 줄만(접힘). 여러 채널이면 안에서 탭으로 한 번에 하나만.
 * 글은 content/postingHowTo(규칙 글 — AI 아님). 60대 기준: 15px 이상 · 쉬운 말 · 누르는 칸 44px.
 * 펼친 것을 기억하지 않는다(저장하는 꾸미기 이름을 늘리지 않는다 — 처음 한두 번 보고 마는 안내).
 */
import { useState } from 'react'
import { HOWTO_NOTE, howTos, type HowToKey } from '../../content/postingHowTo'

export function PostingHowTo({ channels, open = false, testId = 'mk-howto' }: { channels: readonly HowToKey[]; open?: boolean; testId?: string }) {
  const list = howTos(channels)
  const [picked, setPicked] = useState<HowToKey>(channels[0])
  const cur = list.find((h) => h.key === picked) ?? list[0]
  if (!cur) return null
  return (
    <details className="rounded-(--radius-panel) border border-slate-200 bg-white" open={open} data-testid={testId}>
      <summary className="t-body flex min-h-12 cursor-pointer items-center gap-2 rounded-(--radius-panel) px-4 py-2.5 font-bold break-keep text-slate-900 hover:bg-slate-50" data-testid={`${testId}-toggle`} data-guide="fn-mk-howto">
        처음 올려 보시나요? <span className="font-semibold text-brand-700">올리는 법 보기</span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4">
        {list.length > 1 && (
          <div role="tablist" aria-label="어디에 올리나요" className="flex flex-wrap gap-1.5" data-testid={`${testId}-tabs`}>
            {list.map((h) => {
              const on = h.key === cur.key
              return (
                <button
                  key={h.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setPicked(h.key)}
                  className={`tap t-body min-h-11 rounded-full border px-3.5 font-semibold ${on ? 'border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-200' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}
                  data-testid={`${testId}-tab`}
                  data-key={h.key}
                >
                  {h.label}
                </button>
              )
            })}
          </div>
        )}
        <p className="t-body break-keep text-slate-800" data-testid={`${testId}-need`}>
          <span className="font-bold text-slate-900">준비물 </span>
          {cur.need}
        </p>
        <ol className="flex flex-col gap-2" aria-label={`${cur.label}에 올리는 순서`} data-testid={`${testId}-steps`}>
          {cur.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2.5" data-testid={`${testId}-step`}>
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[0.9375rem] font-bold text-slate-800 tabular-nums" aria-hidden="true">
                {i + 1}
              </span>
              <span className="t-body break-keep text-slate-900">{s}</span>
            </li>
          ))}
        </ol>
        <p className="t-body break-keep text-slate-800" data-testid={`${testId}-tip`}>
          <span className="font-bold text-brand-700">알아 두면 </span>
          {cur.tip}
        </p>
        <p className="t-sub break-keep text-slate-700">{HOWTO_NOTE}</p>
      </div>
    </details>
  )
}
