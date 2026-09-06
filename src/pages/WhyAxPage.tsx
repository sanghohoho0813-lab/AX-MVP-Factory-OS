/**
 * 기획의도 — 이 시스템을 왜 만들었는가.
 *
 * 규격(v3.0 §24·Q-7)은 이 이야기가 "찾을 수 있는 곳" 에 있어야 한다고 한다.
 * 사이드바 '이 시스템' 그룹에서 연다. 본문은 src/content/whyAxContent.ts 에 있다.
 * 맨 아래에 지금 무엇이 LIVE/READY/NEXT 인지와 지표 상태를 함께 붙인다 —
 * 이야기와 실제가 어긋나지 않게 하려는 것이다.
 */

import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Badge, Disclosure, Section, type Tone } from '../components/ui/primitives'
import { WHY_SECTIONS } from '../content/whyAxContent'
import { CAPABILITY_LEVEL_LABEL, FUTURE_ITEMS, currentCapabilities, type CapabilityLevel } from '../config/capabilityStatus'
import { getDataModeConfig } from '../data/dataMode'
import { brand } from '../brand/brand.config'

const LEVEL_TONE: Record<CapabilityLevel, Tone> = { live: 'success', ready: 'warning', next: 'neutral' }

export function WhyAxPage() {
  const mode = getDataModeConfig().mode
  const caps = currentCapabilities(mode)
  const live = caps.filter((c) => c.level === 'live').length
  const ready = caps.filter((c) => c.level === 'ready').length

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8">
      <PageHeader
        title="기획의도"
        description={`${brand.productName} 를 왜 만들었고, 무엇을 바꾸며, 무엇이 남는지. 있는 그대로 적었다.`}
      />

      {/* 한 줄 요약 — 5초 안에 읽히는 것 */}
      <div className="rounded-(--radius-panel) border border-slate-200 bg-white p-5 sm:p-6">
        <p className="t-meta font-semibold tracking-wide text-slate-500 uppercase">한 문장으로</p>
        <p className="t-section mt-2 break-keep text-slate-900">
          여러 고객사의 일을 매일 아침 머릿속에서 다시 조합하던 시간을 없애고, 고객이 한 행동이 내 일감이 되어
          돌아오게 만든 시스템.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="success">실제로 쓰는 중 {live}</Badge>
          {ready > 0 && <Badge tone="warning">연결 준비됨 {ready}</Badge>}
          <Badge tone="neutral">아직 없음 {FUTURE_ITEMS.length}</Badge>
        </div>
      </div>

      {/* 본문 13장 */}
      <ol className="flex flex-col gap-7">
        {WHY_SECTIONS.map((s) => (
          <li key={s.id} id={s.id} className="flex gap-4">
            <span className="t-meta mt-1.5 w-7 shrink-0 font-semibold tabular-nums text-slate-400">{s.no}</span>
            <div className="min-w-0 flex-1">
              <h2 className="t-section break-keep text-slate-900">{s.title}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="t-body mt-2 break-keep text-slate-700">
                  {p}
                </p>
              ))}
              {s.bullets && (
                <ul className="t-body mt-2 flex flex-col gap-1.5 break-keep text-slate-700">
                  {s.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden="true" className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-slate-300" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* 이야기와 실제가 어긋나지 않도록 — 지금 상태 */}
      <Section title="지금 무엇이 있고 무엇이 없는가">
        <Disclosure title="기능 상태표" hint={`LIVE ${live} · READY ${ready} · NEXT ${FUTURE_ITEMS.length}`} defaultOpen={false}>
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
          <Link
            to="/kpi"
            className="tap t-sub inline-flex items-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3.5 py-2 font-medium text-slate-700 hover:bg-slate-50"
          >
            성과 지표 보기 <ArrowRight aria-hidden="true" className="size-4 text-slate-400" />
          </Link>
          <Link
            to="/roadmap"
            className="tap t-sub inline-flex items-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3.5 py-2 font-medium text-slate-700 hover:bg-slate-50"
          >
            향후 확장 (NEXT) 보기 <ArrowRight aria-hidden="true" className="size-4 text-slate-400" />
          </Link>
        </div>
      </Section>
    </div>
  )
}
