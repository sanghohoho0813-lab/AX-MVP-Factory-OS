/**
 * D-587 홈 화면에 넣는 법 — 접힌 한 줄('매일 쓰려면 — 휴대폰 홈 화면에 넣는 법')을 누르면 기기별 서너 걸음.
 *
 * 📐 첫 화면에는 한 줄만(접힘). 안에서 탭으로 한 번에 하나(아이폰 · 갤럭시 · PC) — 지금 기기에 맞는 탭이 먼저 골라져 있다.
 * 글은 content/homeScreenHowTo(규칙 글 — AI 아님). 펼친 것을 기억하지 않는다(저장하는 꾸미기 이름을 늘리지 않는다).
 */
import { useState } from 'react'
import { HOME_HOWTO, HOME_HOWTO_NOTE, type HomeHowToKey } from '../../content/homeScreenHowTo'

/** 지금 기기에 맞는 탭 — 모르면 아이폰부터 */
function guessDevice(): HomeHowToKey {
  if (typeof navigator === 'undefined') return 'iphone'
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iphone'
  // 터치가 되는 맥 = 아이패드
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'iphone'
  return 'pc'
}

export function AddToHomeHowTo({ testId = 'home-howto' }: { testId?: string }) {
  const [picked, setPicked] = useState<HomeHowToKey>(guessDevice)
  const cur = HOME_HOWTO.find((h) => h.key === picked) ?? HOME_HOWTO[0]
  return (
    <details className="rounded-(--radius-panel) border border-slate-200 bg-white" data-testid={testId}>
      <summary className="t-body flex min-h-12 cursor-pointer flex-wrap items-center gap-x-2 rounded-(--radius-panel) px-4 py-2.5 font-bold break-keep text-slate-900 hover:bg-slate-50" data-testid={`${testId}-toggle`} data-guide="fn-home-howto">
        매일 쓰려면 — <span className="font-semibold text-brand-700">휴대폰 홈 화면에 넣는 법</span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4">
        <p className="t-sub break-keep text-slate-700">홈 화면에 넣어 두면 아이콘 한 번으로 열려요. 로그인도 그대로 남아요.</p>
        <div role="tablist" aria-label="어느 기기인가요" className="flex flex-wrap gap-1.5" data-testid={`${testId}-tabs`}>
          {HOME_HOWTO.map((h) => {
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
        <p className="t-body break-keep text-slate-800" data-testid={`${testId}-need`}>
          <span className="font-bold text-slate-900">준비 </span>
          {cur.need}
        </p>
        <ol className="flex flex-col gap-2" aria-label={`${cur.label} — 홈 화면에 넣는 순서`} data-testid={`${testId}-steps`}>
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
        <p className="t-sub break-keep text-slate-700">{HOME_HOWTO_NOTE}</p>
      </div>
    </details>
  )
}
