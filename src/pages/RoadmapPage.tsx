/**
 * 향후 확장 — 아직 없는 기능을 "없다" 고 말하는 화면.
 *
 * 규격(v3.0 U-3)이 요구하는 것: 확장 가능성을 한눈에 보이되, NEXT 배지로 현재
 * 기능과 분리하고, 누르면 404 대신 계획을 보여줄 것. 그래서 이 화면의 항목은
 * 전부 '무엇을 · 왜 지금은 아닌지 · 언제 다시 볼지' 세 가지만 말한다.
 *
 * 위에는 지금 있는 것(LIVE/READY)을 먼저 둔다 — 현재 70% 앞에 미래 30% 를 두면
 * 미래가 현재처럼 읽힌다.
 */

import { useState } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { Badge, BottomSheet, ListRow, ListSurface, Section, type Tone } from '../components/ui/primitives'
import {
  CAPABILITY_LEVEL_LABEL,
  FUTURE_ITEMS,
  currentCapabilities,
  type CapabilityLevel,
  type FutureItem,
} from '../config/capabilityStatus'
import { getDataModeConfig } from '../data/dataMode'

const LEVEL_TONE: Record<CapabilityLevel, Tone> = { live: 'success', ready: 'warning', next: 'neutral' }

export function RoadmapPage() {
  const mode = getDataModeConfig().mode
  const caps = currentCapabilities(mode)
  const [open, setOpen] = useState<FutureItem | null>(null)

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
      <PageHeader
        title="향후 확장"
        description="아래 NEXT 항목은 아직 없는 기능입니다. 무엇을 만들지, 왜 지금은 아닌지, 언제 다시 볼지만 적었습니다."
      />

      <Section title="지금 있는 것" count={caps.length}>
        <ListSurface>
          {caps.map((c) => (
            <ListRow
              key={c.key}
              title={c.label}
              meta={c.note}
              badge={<Badge tone={LEVEL_TONE[c.level]}>{CAPABILITY_LEVEL_LABEL[c.level]}</Badge>}
            />
          ))}
        </ListSurface>
      </Section>

      <Section title="아직 없는 것 — NEXT" count={FUTURE_ITEMS.length}>
        <p className="t-sub break-keep text-slate-500">
          누르면 계획이 열립니다. 어느 것도 지금 동작하지 않으며, 이 화면 어디에도 미래 기능을 쓰는 버튼은 없습니다.
        </p>
        <ListSurface className="border-dashed">
          {FUTURE_ITEMS.map((f) => (
            <ListRow
              key={f.key}
              title={f.label}
              meta={f.what}
              badge={<Badge tone="neutral">NEXT</Badge>}
              onClick={() => setOpen(f)}
            />
          ))}
        </ListSurface>
      </Section>

      {open && (
        <BottomSheet title={open.label} onClose={() => setOpen(null)}>
          <div className="flex flex-col gap-4">
            <Badge tone="neutral" className="self-start">
              NEXT · 아직 없는 기능
            </Badge>
            <div>
              <p className="t-meta font-semibold tracking-wide text-slate-500 uppercase">무엇을</p>
              <p className="t-body mt-1 break-keep text-slate-800">{open.what}</p>
            </div>
            <div>
              <p className="t-meta font-semibold tracking-wide text-slate-500 uppercase">왜 지금은 아닌가</p>
              <p className="t-body mt-1 break-keep text-slate-800">{open.whyNotNow}</p>
            </div>
            <div>
              <p className="t-meta font-semibold tracking-wide text-slate-500 uppercase">언제 다시 볼까</p>
              <p className="t-body mt-1 break-keep text-slate-800">{open.revisitWhen}</p>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}
