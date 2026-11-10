/**
 * D-596 연락 받는 길 만드는 법 — 접힌 한 줄('연락 받는 길이 아직 없나요?')을 누르면 길마다 서너 걸음.
 *
 * 📐 첫 화면에는 한 줄만(접힘). 안에서 탭으로 한 번에 하나(카카오톡 오픈채팅 · 채널 · 전화).
 * 걸음 아래 '프로필에 적을 한 줄' → [소개 글에 이 줄 넣기] 를 누르면 위의 프로필 소개 글 만들기의 '연락 받는 길' 칸에 들어간다.
 * 글은 content/contactPathHowTo(규칙 글 — AI 아님). 60대 기준: 15px 이상 · 쉬운 말 · 누르는 칸 44px.
 * 아무것도 저장하지 않는다(연락처도 · 펼친 것도).
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp } from 'lucide-react'
import { CONTACT_PATHS, CONTACT_PATH_AFTER, CONTACT_PATH_NOTE, type ContactPathKey } from '../../content/contactPathHowTo'
import { LEAD_FROM_CONTENT_HREF } from '../../services/marketing/mkPath'

export function ContactPathHowTo({ onUse, testId = 'mk-contact' }: { onUse?: (line: string) => void; testId?: string }) {
  const [picked, setPicked] = useState<ContactPathKey>('openchat')
  const cur = CONTACT_PATHS.find((c) => c.key === picked) ?? CONTACT_PATHS[0]
  return (
    <details className="rounded-(--radius-panel) border border-slate-200 bg-white" data-testid={testId}>
      <summary className="t-body flex min-h-12 cursor-pointer flex-wrap items-center gap-x-2 rounded-(--radius-panel) px-4 py-2.5 font-bold break-keep text-slate-900 hover:bg-slate-50" data-testid={`${testId}-toggle`} data-guide="fn-mk-contact">
        연락 받는 길이 아직 없나요? <span className="font-semibold text-brand-700">연락 받는 길 만드는 법</span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4">
        <p className="t-body break-keep text-slate-800">
          글을 본 사람이 <strong className="font-bold text-slate-900">말을 걸 수 있는 길</strong>이 프로필에 하나는 있어야 해요. 아래에서 편한 것 하나만 고르세요.
        </p>
        <div role="tablist" aria-label="어떤 길로 받을까요" className="flex flex-wrap gap-1.5" data-testid={`${testId}-tabs`}>
          {CONTACT_PATHS.map((c) => {
            const on = c.key === cur.key
            return (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setPicked(c.key)}
                className={`tap t-body min-h-11 rounded-full border px-3.5 font-semibold ${on ? 'border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-200' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}
                data-testid={`${testId}-tab`}
                data-key={c.key}
              >
                {c.label}
              </button>
            )
          })}
        </div>
        <p className="t-body break-keep text-slate-800" data-testid={`${testId}-fit`}>
          <span className="font-bold text-slate-900">이런 분께 </span>
          {cur.fit}
        </p>
        <p className="t-body break-keep text-slate-800" data-testid={`${testId}-need`}>
          <span className="font-bold text-slate-900">준비물 </span>
          {cur.need}
        </p>
        <ol className="flex flex-col gap-2" aria-label={`${cur.label} 만드는 순서`} data-testid={`${testId}-steps`}>
          {cur.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2.5" data-testid={`${testId}-step`}>
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[0.9375rem] font-bold text-slate-800 tabular-nums" aria-hidden="true">
                {i + 1}
              </span>
              <span className="t-body break-keep text-slate-900">{s}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid={`${testId}-bio`}>
          <p className="t-body min-w-0 flex-1 basis-56 break-keep text-slate-800">
            <span className="font-bold text-slate-900">프로필에 적을 한 줄 </span>
            <span data-testid={`${testId}-bio-line`}>{cur.bioLine}</span>
          </p>
          {onUse && (
            <button
              type="button"
              onClick={() => onUse(cur.bioLine)}
              className="tap t-body inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3.5 font-semibold text-slate-800 hover:bg-slate-50"
              data-testid={`${testId}-use`}
            >
              <ArrowUp aria-hidden="true" className="size-4" /> 소개 글에 이 줄 넣기
            </button>
          )}
        </div>
        <p className="t-body break-keep text-slate-800" data-testid={`${testId}-tip`}>
          <span className="font-bold text-brand-700">알아 두면 </span>
          {cur.tip}
        </p>
        <p className="t-body break-keep text-slate-800" data-testid={`${testId}-after`}>
          {CONTACT_PATH_AFTER}{' '}
          <Link to={LEAD_FROM_CONTENT_HREF} className="font-bold text-brand-700 underline underline-offset-2" data-testid={`${testId}-lead`}>
            잠재고객으로 적어 두기
          </Link>
        </p>
        <p className="t-sub break-keep text-slate-700">{CONTACT_PATH_NOTE}</p>
      </div>
    </details>
  )
}
