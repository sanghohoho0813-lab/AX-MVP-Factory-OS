/**
 * 기획의도 — 이 시스템을 왜 만들었는가.
 *
 * 규격(v3.0 §24·Q-7)은 이 이야기가 "찾을 수 있는 곳" 에 있어야 한다고 한다.
 * 사이드바 '이 시스템' 그룹에서 연다. 본문은 src/content/whyAxContent.ts 에 있다.
 * 맨 아래에 지금 무엇이 LIVE/READY/NEXT 인지와 지표 상태를 함께 붙인다 —
 * 이야기와 실제가 어긋나지 않게 하려는 것이다.
 */

import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Home, ListOrdered } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Badge, Disclosure, Section, type Tone } from '../components/ui/primitives'
import { useFold } from '../components/ui/fold'
import { WHY_SECTIONS, type WhySection } from '../content/whyAxContent'
import { CAPABILITY_LEVEL_LABEL, FUTURE_ITEMS, currentCapabilities, type CapabilityLevel } from '../config/capabilityStatus'
import { getDataModeConfig } from '../data/dataMode'
import { useState } from 'react'

const LEVEL_TONE: Record<CapabilityLevel, Tone> = { live: 'success', ready: 'warning', next: 'neutral' }

/** D-627 한 쪽에 담는 글 양(빈칸 빼고) — 휴대폰 150자 한도 안에 제목 · 이전/다음까지 들어가게 */
const PAGE_BUDGET = 100
const len = (t: string) => t.replace(/\s/g, '').length

interface WhyPage {
  sec: WhySection
  /** 이 장의 몇 번째 쪽(1부터) · 이 장이 몇 쪽인지 */
  part: number
  parts: number
  body: string[]
  bullets: string[]
}

/** 장마다 문단 · 항목을 PAGE_BUDGET 안으로 나눈다(문단 하나가 넘으면 그 문단만 한 쪽) */
function whyPages(sections: WhySection[] = WHY_SECTIONS): WhyPage[] {
  const out: WhyPage[] = []
  for (const sec of sections) {
    const items: { kind: 'p' | 'b'; text: string }[] = [...sec.body.map((text) => ({ kind: 'p' as const, text })), ...(sec.bullets ?? []).map((text) => ({ kind: 'b' as const, text }))]
    const chunks: (typeof items)[] = []
    let cur: typeof items = []
    let used = 0
    for (const it of items) {
      if (cur.length > 0 && used + len(it.text) > PAGE_BUDGET) {
        chunks.push(cur)
        cur = []
        used = 0
      }
      cur.push(it)
      used += len(it.text)
    }
    if (cur.length > 0) chunks.push(cur)
    chunks.forEach((c, i) =>
      out.push({ sec, part: i + 1, parts: chunks.length, body: c.filter((x) => x.kind === 'p').map((x) => x.text), bullets: c.filter((x) => x.kind === 'b').map((x) => x.text) }),
    )
  }
  return out
}

const PAGES = whyPages()
/** 마지막 쪽 다음 = '지금 무엇이 있고 무엇이 없는가' */
const STATUS_PAGE = PAGES.length + 1

const navBtn =
  'tap inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3.5 font-medium whitespace-nowrap text-slate-700 hover:bg-slate-50'
const nextBtn =
  'tap inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-brand-600 bg-brand-600 px-4 font-semibold whitespace-nowrap text-white hover:bg-brand-700'

export function WhyAxPage() {
  const mode = getDataModeConfig().mode
  const caps = currentCapabilities(mode)
  const live = caps.filter((c) => c.level === 'live').length
  const ready = caps.filter((c) => c.level === 'ready').length
  const [params, setParams] = useSearchParams()
  const raw = Number(params.get('p') ?? '0')
  const at = Number.isFinite(raw) ? Math.min(Math.max(0, Math.floor(raw)), STATUS_PAGE) : 0
  const go = (n: number) => {
    const next = new URLSearchParams(params)
    if (n <= 0) next.delete('p')
    else next.set('p', String(n))
    setParams(next)
    window.scrollTo({ top: 0 })
  }
  const [tocOpen, setTocOpen] = useFold('why.toc', false)
  const [tocAll, setTocAll] = useState(false)
  const firstPageOf = (id: string) => PAGES.findIndex((pg) => pg.sec.id === id) + 1
  const page = at >= 1 && at <= PAGES.length ? PAGES[at - 1] : null

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
      {/* D-627 머리는 제목 + 한 줄 — 본문 13장은 한 쪽씩(누를 때마다 다음 쪽) */}
      <PageHeader title="기획의도" description="왜 만들었고 무엇을 바꾸는지" />

      {at === 0 && (
        <>
          {/* 한 줄 요약 — 5초 안에 읽히는 것 */}
          <div className="rounded-(--radius-panel) border border-slate-200 bg-white p-5 sm:p-6" data-testid="why-cover">
            <p className="t-meta font-semibold text-slate-500">한 문장으로</p>
            <p className="t-section mt-2 break-keep text-slate-900">
              여러 고객사의 일을 매일 아침 머릿속에서 다시 조합하던 시간을 없애고, 고객이 한 행동이 내 일감이 되어
              돌아오게 만든 시스템.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="success">쓰는 중 {live}</Badge>
              {ready > 0 && <Badge tone="warning">준비됨 {ready}</Badge>}
              <Badge tone="neutral">아직 없음 {FUTURE_ITEMS.length}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={nextBtn} onClick={() => go(1)} data-testid="why-start" title={`${WHY_SECTIONS.length}장 · ${PAGES.length}쪽`}>
              <BookOpen aria-hidden="true" className="size-4" /> 1장부터 읽기
            </button>
            <button type="button" className={navBtn} onClick={() => setTocOpen(!tocOpen)} aria-expanded={tocOpen} data-testid="why-toc-toggle" title="장 목록">
              <ListOrdered aria-hidden="true" className="size-4" /> 목차
            </button>
          </div>
          {tocOpen && (
            <ol className="flex flex-col divide-y divide-slate-100 rounded-(--radius-card) border border-slate-200 bg-white" data-testid="why-toc">
              {WHY_SECTIONS.filter((_, i) => tocAll || i < 5).map((sec) => (
                <li key={sec.id}>
                  <button type="button" className="tap flex min-h-11 w-full items-center gap-3 px-4 text-left hover:bg-slate-50" onClick={() => go(firstPageOf(sec.id))}>
                    <span className="t-meta w-6 shrink-0 tabular-nums text-slate-400">{sec.no}</span>
                    <span className="t-body min-w-0 flex-1 truncate text-slate-800">{sec.title}</span>
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                  </button>
                </li>
              ))}
              {!tocAll && WHY_SECTIONS.length > 5 && (
                <li>
                  <button type="button" className="tap t-sub flex min-h-11 w-full items-center justify-center font-semibold text-brand-700 hover:bg-slate-50" onClick={() => setTocAll(true)} data-testid="why-toc-more">
                    {WHY_SECTIONS.length - 5}개 더 보기
                  </button>
                </li>
              )}
            </ol>
          )}
        </>
      )}

      {page && (
        <article className="flex flex-col gap-4" data-testid="why-page" data-page={at} id={page.sec.id}>
          <div>
            <p className="t-meta font-semibold tabular-nums text-slate-500" title={`${PAGES.length}쪽 가운데 ${at}쪽`}>
              {page.sec.no} / {WHY_SECTIONS.length}
              {page.parts > 1 && <span> · {page.part}/{page.parts}</span>}
            </p>
            <h2 className="t-section mt-1 break-keep text-slate-900">{page.sec.title}</h2>
            {page.body.map((p, i) => (
              <p key={i} className="t-body mt-3 break-keep text-slate-700">
                {p}
              </p>
            ))}
            {page.bullets.length > 0 && (
              <ul className="t-body mt-3 flex flex-col gap-1.5 break-keep text-slate-700">
                {page.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden="true" className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-slate-300" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div aria-hidden="true" className="flex gap-0.5">
            {PAGES.map((_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i < at ? 'bg-brand-500' : 'bg-slate-200'}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={navBtn} onClick={() => go(0)} aria-label="처음으로" title="처음으로" data-testid="why-home">
              <Home aria-hidden="true" className="size-4" />
            </button>
            <button type="button" className={navBtn} onClick={() => go(at - 1)} aria-label="이전 쪽" data-testid="why-prev">
              <ChevronLeft aria-hidden="true" className="size-4" /> 이전
            </button>
            <button
              type="button"
              className={`${nextBtn} ml-auto`}
              onClick={() => go(at + 1)}
              aria-label="다음 쪽"
              title={at < PAGES.length ? `다음 · ${PAGES[at].sec.title}` : '다음 · 지금 상태'}
              data-testid="why-next"
            >
              다음 <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        </article>
      )}

      {at === STATUS_PAGE && (
        // 이야기와 실제가 어긋나지 않도록 — 지금 상태(맨 마지막 쪽)
        <Section title="지금 무엇이 있고 무엇이 없는가">
          <Disclosure title="기능 상태표" hint={`쓰는 중 ${live} · 준비됨 ${ready} · 아직 ${FUTURE_ITEMS.length}`} defaultOpen={false}>
            <ul className="divide-y divide-slate-100">
              {caps.map((c) => (
                <li key={c.key} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="t-body block break-keep text-slate-800">{c.label}</span>
                    <span className="t-sub block break-keep text-slate-500">{c.note}</span>
                  </span>
                  <Badge tone={LEVEL_TONE[c.level]}>{CAPABILITY_LEVEL_LABEL[c.level]}</Badge>
                </li>
              ))}
            </ul>
          </Disclosure>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={navBtn} onClick={() => go(STATUS_PAGE - 1)} data-testid="why-prev">
              <ChevronLeft aria-hidden="true" className="size-4" /> 이전
            </button>
            <Link to="/kpi" className={navBtn}>
              성과 지표 <ArrowRight aria-hidden="true" className="size-4 text-slate-400" />
            </Link>
            <Link to="/roadmap" className={navBtn}>
              향후 확장 <ArrowRight aria-hidden="true" className="size-4 text-slate-400" />
            </Link>
          </div>
        </Section>
      )}
    </div>
  )
}
