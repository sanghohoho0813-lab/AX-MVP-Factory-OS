/**
 * D-571 고객 모으기 기초 7가지 (/marketing/basics) — 어디서부터 해야 할지 모르는 사람이 5분 안에 읽고 바로 해 보는 곳.
 *
 *  - 첫 화면은 제목 줄 일곱 개 + 지금 읽을 한 가지만 펼침(한 번에 하나) · 맨 위 '이 화면은' 한 줄 · 몇 개 읽었는지.
 *  - 한 가지마다: 요점 · 왜 · 이렇게 말고 → 이렇게 · [바로 해 보기](그 일을 하는 화면) · [읽었어요](다음 것이 펼쳐진다).
 *  - 읽은 표시는 이 브라우저에 기억 — 다음에 열면 안 읽은 것부터.
 * 규칙 글이다(content/marketingBasics) — AI 를 부르지 않는다. 마케팅 영역이라 글자 15px 이상 · 쉬운 말(D-507).
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { MarketingTabs } from '../../tools/marketing/MarketingTabs'
import { ScreenGuide } from '../../tools/marketing/ScreenGuide'
import { MARKETING_BASICS, markBasicRead, nextBasic, readBasics } from '../../content/marketingBasics'

export function MarketingBasicsPage() {
  const [read, setRead] = useState<string[]>(() => readBasics())
  const [open, setOpen] = useState<string | null>(() => nextBasic(readBasics())?.key ?? null)
  const done = read.length
  const total = MARKETING_BASICS.length

  const markRead = (key: string) => {
    const next = markBasicRead(key)
    setRead(next)
    setOpen(nextBasic(next)?.key ?? null)
  }

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4" data-testid="mk-basics">
      <MarketingTabs active={null} />
      <PageHeader title="고객 모으기 기초 7가지" description="처음이라면 여기부터 — 한 가지에 1분, 읽고 바로 해 볼 수 있어요." />
      <ScreenGuide id="basics" what="글로 고객을 모으는 기본 일곱 가지를 짧게 알려 주는 곳이에요." steps={['한 가지 읽기', '[바로 해 보기]', '[읽었어요]']} />

      <p className="t-body break-keep text-slate-800" role="status" data-testid="mk-basics-progress" data-done={done}>
        <strong className="font-bold text-slate-900">
          {done} / {total}
        </strong>{' '}
        읽었어요{done >= total ? ' — 다 읽으셨어요. 이제 한 주에 세 편만 꾸준히 올려 보세요.' : done === 0 ? ' — 첫 번째부터 읽어 보세요.' : ' — 이어서 읽어 보세요.'}
      </p>

      <ol className="flex flex-col gap-2" aria-label="고객 모으기 기초">
        {MARKETING_BASICS.map((b, i) => {
          const on = open === b.key
          const isRead = read.includes(b.key)
          const panelId = `mk-basic-${b.key}`
          return (
            <li key={b.key} className="rounded-(--radius-panel) border border-slate-200 bg-white" data-testid="mk-basic" data-key={b.key} data-open={on ? '1' : '0'} data-read={isRead ? '1' : '0'}>
              <button type="button" aria-expanded={on} aria-controls={panelId} onClick={() => setOpen(on ? null : b.key)} data-no-veil className="tap flex min-h-14 w-full items-center gap-3 rounded-(--radius-panel) px-4 py-2.5 text-left hover:bg-slate-50" data-testid="mk-basic-toggle">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border font-bold tabular-nums ${isRead ? 'border-success-200 text-success-700' : 'border-slate-300 text-slate-800'}`} aria-hidden="true">
                  {isRead ? <Check className="size-4" /> : i + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="t-body font-bold break-keep text-slate-900">{b.title}</span>
                  {!on && <span className="t-sub break-keep text-slate-700">{b.point}</span>}
                </span>
                <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-slate-600 transition-transform ${on ? 'rotate-180' : ''}`} />
              </button>
              {on && (
                <div id={panelId} className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4" data-testid="mk-basic-panel">
                  <p className="t-section break-keep text-slate-900">{b.point}</p>
                  <p className="t-body break-keep text-slate-800">
                    <span className="font-bold text-brand-700">왜 그런가요 </span>
                    {b.why}
                  </p>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    <div className="flex flex-col gap-1 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5">
                      <dt className="t-sub font-bold text-danger-700">이렇게 말고</dt>
                      <dd className="t-body break-keep text-slate-800">{b.bad}</dd>
                    </div>
                    <div className="flex flex-col gap-1 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5">
                      <dt className="t-sub font-bold text-brand-700">이렇게</dt>
                      <dd className="t-body break-keep text-slate-900">{b.good}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={b.tryHref} className="tap t-body inline-flex min-h-12 items-center gap-1.5 rounded-(--radius-control) bg-brand-600 px-4 font-bold text-white hover:bg-brand-700" data-testid="mk-basic-try">
                      {b.tryLabel} <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                    {!isRead && (
                      <button type="button" onClick={() => markRead(b.key)} className="tap t-body inline-flex min-h-12 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-50" data-testid="mk-basic-read">
                        <Check aria-hidden="true" className="size-4" /> 읽었어요
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
