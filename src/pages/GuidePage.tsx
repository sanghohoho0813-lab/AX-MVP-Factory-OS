/**
 * D-565 사용법 안내 — 메뉴마다 '무엇을 하나요 · 왜 있나요 · 쓰면 이렇게 돼요 · 앞으로' + 사용법 영상 자리.
 * 대표(2026-11-10): "메뉴마다 이게 뭐고 왜 있고 어떻게 고도화될 예정이고 어떤 효과가 있는지 · 튜토리얼 영상 넣을 자리".
 *
 *  - 📐 첫 화면은 단순하게: 묶음 탭 하나(오늘 · 고객 · 영업 …) + 그 묶음의 메뉴 이름만. 메뉴를 누르면 그 줄만 펼쳐진다(한 번에 하나).
 *  - 이 계정에 보이는 메뉴만(왼쪽 메뉴와 같은 표 — enabledModulesByGroup). 고객 계정에는 전문 모듈 묶음이 없다.
 *  - 영상은 config/menuVideos 에 한 줄 넣으면 그 자리에서 재생 — 없으면 '영상 준비 중'.
 *  - `?m=<메뉴 key>` 로 오면 그 메뉴가 펼쳐진 채(마우스 안내 카드 · 다른 화면의 링크가 데려온다).
 * 규칙 글이다 — AI 를 부르지 않는다.
 */
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, ChevronDown, MessageCircleQuestion, PlayCircle } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { GUIDE_LABELS, menuGuide } from '../content/menuGuide'
import { functionGuidesOf } from '../content/functionGuide'
import { menuVideo } from '../config/menuVideos'
import { minutesLabel } from '../config/tutorialVideos'
import { useTutorial } from '../components/tutorial/tutorialContext'
import { useSupportState } from '../components/support/useSupport'
import { AddToHomeHowTo } from '../components/guide/AddToHomeHowTo'
import { useGuideGroups } from '../components/guide/useGuideGroups'
import { WhatsNew } from '../components/guide/WhatsNew'

export function GuidePage() {
  const { groups, pilot, basic } = useGuideGroups()
  const tutorial = useTutorial()
  const support = useSupportState(pilot)
  const [params, setParams] = useSearchParams()
  const want = params.get('m') ?? ''

  const wantGroup = groups.find((g) => g.rows.some((r) => r.key === want))?.key
  const [tab, setTab] = useState<string | null>(null)
  const active = groups.find((g) => g.key === (tab ?? wantGroup)) ?? groups[0]
  const [open, setOpen] = useState<string | null>(null)
  const openKey = open ?? (active?.rows.some((r) => r.key === want) ? want : null)

  const pick = (key: string) => {
    const next = openKey === key ? '' : key
    setOpen(next)
    // 주소에 남긴다 — 새로 고치거나 링크로 보내도 같은 줄이 펼쳐진다
    const p = new URLSearchParams(params)
    if (next) p.set('m', next)
    else p.delete('m')
    setParams(p, { replace: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4" data-testid="guide-page">
      <PageHeader title="사용법 안내" description="메뉴를 누르면 무엇을 하는 곳인지 · 왜 있는지 · 사용법 영상이 펼쳐져요." />

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="메뉴 묶음" data-testid="guide-groups">
        {groups.map((g) => {
          const on = g.key === active?.key
          return (
            <button
              key={g.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                setTab(g.key)
                setOpen('')
              }}
              className={`tap t-sub inline-flex min-h-11 items-center rounded-full border px-4 font-bold ${on ? 'border-brand-500 bg-white text-brand-800 ring-1 ring-brand-300' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              data-testid="guide-group"
              data-group={g.key}
            >
              {g.title}
            </button>
          )
        })}
      </div>

      <ul className="flex flex-col gap-2" aria-label={`${active?.title ?? ''} 메뉴 안내`} data-testid="guide-list">
        {(active?.rows ?? []).map((r) => {
          const on = openKey === r.key
          const g = menuGuide(r.key, { label: r.label, hint: r.hint, basic })
          const panelId = `guide-panel-${r.key}`
          // D-569 이 화면 안의 주요 기능(업체 화면의 탭 같은 것) — 화면에서 마우스를 올려도 같은 글이 뜬다
          const fns = on && !r.noLink ? functionGuidesOf(r.key, { pilot, basic }) : []
          return (
            <li key={r.key} className={`rounded-(--radius-panel) border border-slate-200 bg-white ${r.nested ? 'sm:ml-6' : ''}`} data-testid="guide-row" data-key={r.key} data-open={on ? '1' : '0'}>
              <button type="button" aria-expanded={on} aria-controls={panelId} onClick={() => pick(r.key)} data-no-veil className="tap flex min-h-14 w-full items-center gap-3 rounded-(--radius-panel) px-4 py-2.5 text-left hover:bg-slate-50" data-testid="guide-row-toggle">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="t-body font-bold break-keep text-slate-900">
                    {r.label}
                    {r.soon && <span className="t-meta ml-2 rounded-full border border-slate-300 px-2 py-0.5 font-semibold text-slate-600">준비 중</span>}
                  </span>
                  {!on && <span className="t-sub truncate text-slate-600">{g.what}</span>}
                </span>
                <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-slate-500 transition-transform ${on ? 'rotate-180' : ''}`} />
              </button>
              {on && (
                <div id={panelId} className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3.5 lg:flex-row lg:gap-5" data-testid="guide-panel">
                  <dl className="flex min-w-0 flex-1 flex-col gap-2.5">
                    {(['what', 'why', 'effect', 'next'] as const).map((k) => (
                      <div key={k} className="flex flex-col gap-0.5" data-testid={`guide-${k}`}>
                        <dt className="t-sub font-bold text-brand-700">{GUIDE_LABELS[k]}</dt>
                        <dd className="t-body break-keep text-slate-800">{g[k]}</dd>
                      </div>
                    ))}
                    {fns.length > 0 && (
                      <div className="flex flex-col gap-1.5" data-testid="guide-functions">
                        <dt className="t-sub font-bold text-brand-700">이 화면 안에서 할 수 있는 것</dt>
                        <dd>
                          <ul className="flex flex-col gap-1">
                            {fns.map(({ key, guide }) => (
                              <li key={key} className="t-sub break-keep text-slate-800" data-testid="guide-function" data-key={key}>
                                <span className="font-bold text-slate-900">{guide.label}</span> — {menuGuide(key, { basic }).what}
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    )}
                    {!r.soon && !r.noLink && (
                      <Link to={r.path} className="tap t-sub mt-1 inline-flex min-h-11 items-center gap-1.5 self-start rounded-(--radius-control) bg-brand-600 px-4 font-bold text-white hover:bg-brand-700" data-testid="guide-go">
                        이 화면 열기 <ArrowRight aria-hidden="true" className="size-4" />
                      </Link>
                    )}
                  </dl>
                  {!r.noLink && <GuideVideo k={r.key} label={r.label} />}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/* D-593 새로 생긴 것(접힌 한 줄) — 뭐가 바뀌었는지 화면 안에서 보고 한 번 눌러 써 본다 */}
      <WhatsNew />

      {/* D-587 매일 쓰게 — 휴대폰 홈 화면에 넣는 법(접힌 한 줄) */}
      <AddToHomeHowTo />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3" data-testid="guide-foot">
        <p className="t-sub min-w-0 flex-1 basis-64 break-keep text-slate-700">
          <span className="max-lg:hidden">왼쪽 메뉴에 마우스를 올려도 같은 설명이 떠요(번거로우면 설정 › 계정 · 보기에서 끌 수 있어요). </span><span className="lg:hidden">다른 화면에서는 맨 위 화면 이름을 누르면 그 화면 안내가 떠요. </span>궁금한 점 · 불편한 점은 알려 주세요 — 먼저 고쳐요.
        </p>
        {tutorial && (
          <button type="button" onClick={() => tutorial.open()} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50" data-testid="guide-tutorial">
            <PlayCircle aria-hidden="true" className="size-4 text-brand-600" /> 전체 안내 영상 보기
          </button>
        )}
        {/* D-568 문의하기 — 팀장 · 구독 고객(문의 창구 0025 가 열려 있을 때만). 대표는 받은함에서 읽는다 */}
        {pilot && support === 'ready' && (
          <Link to="/support" className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50" data-testid="guide-support">
            <MessageCircleQuestion aria-hidden="true" className="size-4 text-brand-600" /> 문의하기
          </Link>
        )}
        {/* 설문(/feedback)은 내부 팀장용 — 외부 구독 고객은 위 문의하기로 */}
        {pilot && !basic && (
          <Link to="/feedback" className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50" data-testid="guide-feedback">
            의견 보내기 <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
    </div>
  )
}

/** 메뉴 사용법 영상 칸 — 영상이 있으면 그 자리에서 재생, 없으면 '영상 준비 중' 자리 */
function GuideVideo({ k, label }: { k: string; label: string }) {
  const v = menuVideo(k)
  if (v)
    return (
      <figure className="flex w-full shrink-0 flex-col gap-1.5 lg:w-[22rem]" data-testid="guide-video" data-ready="1">
        <video controls preload="none" poster={v.poster} src={v.src} className="aspect-video w-full rounded-(--radius-card) border border-slate-200 bg-black" aria-label={`${v.title ?? label} 사용법 영상`} />
        <figcaption className="t-meta text-slate-600">
          {v.title ?? `${label} 사용법`}
          {v.seconds ? ` · ${minutesLabel(v.seconds)}` : ''}
        </figcaption>
      </figure>
    )
  return (
    <div className="flex aspect-video w-full shrink-0 flex-col items-center justify-center gap-1.5 rounded-(--radius-card) border border-dashed border-slate-300 bg-white px-4 text-center lg:w-[22rem]" data-testid="guide-video" data-ready="0">
      <PlayCircle aria-hidden="true" className="size-8 text-slate-400" />
      <p className="t-sub font-bold text-slate-700">사용법 영상 준비 중</p>
      <p className="t-meta break-keep text-slate-600">준비되면 여기서 바로 볼 수 있어요.</p>
    </div>
  )
}
