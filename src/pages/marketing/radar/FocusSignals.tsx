/**
 * 경제 · 경영 · AI 시장 신호 · 사이드 급상승 (D-197 콘텐츠 레이더 집중).
 *  - 지금 강한 흐름: 경제 · 경영 · AI 마다 최근 데이터가 있는 주제만(없으면 '아직 없음' — 억지로 채우지 않는다)
 *  - AI 핵심 키워드: 회사(OpenAI · Anthropic · Google)별 세부 이름 — 최근 30일 제목에 실제로 나온 것만 · 숫자는 채널 · 영상 · 터진 영상(점수 없음)
 *  - 새 AI 키워드 후보: 분류표 밖 이름 — 보여 주기만(분류표에 저절로 넣지 않는다)
 *  - 사이드 급상승: 경제 · 경영 · AI 밖에서 비정상적으로 크게 터진 영상만(최대 5) — 주제가 아니라 포맷 · 훅 · 구성 참고.
 *    TOP 보다 작게(작은 제목 · 작은 썸네일 · 한 줄씩).
 */
import { Sparkles, Waypoints, Zap } from 'lucide-react'
import { HintTip } from '../../../components/ui/fold'
import { Badge } from '../../../components/ui/primitives'
import { hintFor } from '../../../content/sectionHints'
import {
  DOMAIN_LABEL,
  FORMAT_LABEL,
  VENDOR_LABEL,
  ratioLine,
  type AiKeywordStat,
  type AiVendor,
  type DomainSignal,
  type NewAiKeyword,
  type RadarVideo,
  type SideBreakout,
} from '../../../services/marketing/ytRadar'
import { IconChip, RatioChip, Thumb } from './RadarParts'

/** 영역마다 무엇을 보나(빈 칸일 때 한 줄로) */
const DOMAIN_SCOPE: Record<DomainSignal['domain'], string> = {
  economy: '금리 · 환율 · 경기 · 물가 · 부동산 · 주식 · 경제 정책',
  business: '절세 · 정책자금 · 지원사업 · 인사 · 마케팅 · 경영',
  ai: 'AI 도구 · 업무자동화 · 에이전트 · 노코드',
  other: '',
}

/** 영역마다 아주 연한 바탕색 — 세 칸이 한눈에 나뉘게(D-197 대표 요청) */
const DOMAIN_BOX: Record<DomainSignal['domain'], string> = {
  economy: 'border-sky-100 bg-sky-50/50',
  business: 'border-amber-100 bg-amber-50/50',
  ai: 'border-violet-100 bg-violet-50/50',
  other: 'border-slate-200 bg-white',
}
const DOMAIN_TEXT: Record<DomainSignal['domain'], string> = { economy: 'text-sky-800', business: 'text-amber-800', ai: 'text-violet-800', other: 'text-slate-900' }

/** 지금 강한 흐름 — 경제 · 경영 · AI 세 칸(PC 세 줄 · 휴대폰 위아래) */
export function DomainBoard({ signals }: { signals: readonly DomainSignal[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid="radar-domains">
      <HintTip tip={hintFor('지금 강한 흐름')} label="지금 강한 흐름">
        <h3 className="t-card flex items-center gap-2 font-bold text-slate-900">
          <IconChip icon={Waypoints} tone="sky" /> 지금 강한 흐름
        </h3>
      </HintTip>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {signals.map((d) => (
          <div key={d.domain} className={`flex min-w-0 flex-col gap-1 rounded-(--radius-card) border p-3 ${DOMAIN_BOX[d.domain]}`} data-testid={`radar-domain-${d.domain}`} data-count={d.items.length}>
            <p className={`t-card font-bold ${DOMAIN_TEXT[d.domain]}`}>{DOMAIN_LABEL[d.domain]}</p>
            {d.items.length === 0 ? (
              <p className="t-meta break-keep text-slate-500" data-testid="radar-domain-empty">
                최근 2주에 여러 채널이 함께 다룬 주제가 아직 없습니다 <span className="text-slate-400">({DOMAIN_SCOPE[d.domain]})</span>
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-slate-100">
                {d.items.map((x) => (
                  <li key={x.topicId} className="flex min-w-0 flex-col gap-0.5 py-1.5" data-testid="radar-domain-row" data-topic={x.topicId}>
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="t-sub min-w-0 font-semibold break-keep text-slate-800 [overflow-wrap:anywhere]">{x.label}</span>
                      {x.breakouts > 0 && <Badge tone="danger">터진 영상 {x.breakouts}</Badge>}
                      {x.growing && <Badge tone="brand">늘어남</Badge>}
                    </span>
                    <span className="t-meta text-slate-500">
                      2주 {x.channels14}개 채널 · {x.videos14}편
                    </span>
                    {x.focus && <span className="t-meta break-keep text-brand-800">→ {x.focus}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const VENDORS: readonly AiVendor[] = ['openai', 'anthropic', 'google']

/** AI 핵심 키워드 — 회사별 세부 이름(실제로 나온 것만) · 업무 흐름 · 새 AI 키워드 후보 */
export function AiKeywordBoard({
  keywords,
  workflow,
  fresh,
}: {
  keywords: readonly AiKeywordStat[]
  workflow: ReadonlyArray<{ topicId: string; label: string; channels: number; videos: number; breakouts: number }>
  fresh: readonly NewAiKeyword[]
}) {
  if (keywords.length === 0 && workflow.length === 0 && fresh.length === 0) return null
  const vendors = VENDORS.map((v) => ({ v, list: keywords.filter((k) => k.vendor === v) })).filter((x) => x.list.length > 0)
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-(--radius-card) border border-violet-100 bg-violet-50/30 p-3 sm:p-4" data-testid="radar-ai-keywords">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <HintTip tip={hintFor('AI 핵심 키워드')} label="AI 핵심 키워드">
          <h3 className="t-card flex items-center gap-2 font-bold text-slate-900">
            <IconChip icon={Sparkles} tone="violet" /> AI 핵심 키워드
          </h3>
        </HintTip>
        <span className="t-meta text-slate-500">최근 30일 제목에 실제로 나온 이름만</span>
      </div>
      {vendors.length > 0 && (
        <div className={`grid grid-cols-1 gap-2 ${vendors.length >= 3 ? 'md:grid-cols-3' : vendors.length === 2 ? 'md:grid-cols-2' : ''}`}>
          {vendors.map(({ v, list }) => (
            <div key={v} className="flex min-w-0 flex-col gap-1 rounded-(--radius-card) border border-slate-200 bg-white p-3" data-testid="radar-ai-vendor" data-vendor={v}>
              <p className="t-meta font-bold tracking-wide text-slate-500">{VENDOR_LABEL[v]}</p>
              <ul className="flex flex-col divide-y divide-slate-100">
                {list.map((k) => (
                  <li key={k.id} className="flex min-w-0 flex-col gap-0.5 py-1.5" data-testid="radar-ai-kw" data-kw={k.id}>
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="t-sub font-bold text-slate-900">{k.label}</span>
                      <span className="t-meta text-slate-600">
                        {k.channels}개 채널 · {k.videos}편
                      </span>
                      {k.breakouts > 0 && <Badge tone="danger">터진 영상 {k.breakouts}</Badge>}
                    </span>
                    {k.focus && <span className="t-meta break-keep text-brand-800">→ {k.focus}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {workflow.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid="radar-ai-flows">
          <span className="t-meta font-bold text-slate-500">업무 흐름</span>
          {workflow.map((w) => (
            <span key={w.topicId} className="t-meta inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 break-keep text-slate-700" data-testid="radar-ai-flow">
              <span className="font-semibold text-slate-800">{w.label}</span> {w.channels}개 채널 · {w.videos}편
            </span>
          ))}
        </div>
      )}
      {fresh.length > 0 && (
        <div className="flex min-w-0 flex-col gap-1 rounded-(--radius-control) border border-dashed border-brand-300 bg-brand-50/40 px-3 py-2" data-testid="radar-ai-new">
          <p className="t-meta flex flex-wrap items-center gap-x-2 font-bold text-brand-800">
            새 AI 키워드 후보 <span className="font-normal text-slate-500">분류표에 아직 없는 이름 — 저절로 넣지 않습니다(보고 판단)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {fresh.map((k) => (
              <span key={k.word} className="t-meta inline-flex items-center gap-1 rounded-full border border-brand-200 bg-white px-2.5 py-1 text-slate-700" data-testid="radar-ai-new-kw">
                <span className="font-bold text-slate-900">{k.word}</span> AI · AX {k.channels}개 채널 · {k.videos}편
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** 사이드 급상승 — TOP 보다 작게. 없으면 한 줄만 */
export function SideBreakouts({ items, noThumb, onOpenVideo }: { items: readonly SideBreakout[]; noThumb: boolean; onOpenVideo: (v: RadarVideo) => void }) {
  return (
    <section className="flex flex-col gap-2 rounded-(--radius-card) border border-amber-100 bg-amber-50/40 p-3 sm:p-4" aria-labelledby="radar-side-h" data-testid="radar-side" data-count={items.length}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <HintTip tip={hintFor('사이드 급상승')} label="사이드 급상승">
          <h2 id="radar-side-h" className="t-card flex items-center gap-2 font-bold text-slate-900">
            <IconChip icon={Zap} tone="amber" /> 사이드 급상승
          </h2>
        </HintTip>
        <span className="t-meta break-keep text-slate-500">경제 · 경영 · AI 밖에서 크게 터진 영상 — 주제가 아니라 포맷 · 훅 · 구성 참고</span>
      </div>
      {items.length === 0 ? (
        <p className="t-meta break-keep text-slate-500" data-testid="radar-side-none">
          최근 2주에 그 밖 주제에서 비정상적으로 크게 터진 영상은 없습니다 — 억지로 채우지 않습니다.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-3 gap-y-1 lg:grid-cols-2">
          {items.map(({ v, why, notes }) => (
            <li key={v.id} className="min-w-0" data-testid="radar-side-row">
              <button type="button" onClick={() => onOpenVideo(v)} className="tap flex w-full min-w-0 items-start gap-2.5 rounded-(--radius-card) px-1 py-1.5 text-left hover:bg-white" aria-label={`${v.title} — 자세히`}>
                <Thumb v={v} noThumb={noThumb} className="w-20 shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="t-sub line-clamp-2 font-semibold break-keep text-slate-800 [overflow-wrap:anywhere]">{v.title}</span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <RatioChip v={v} />
                    {v.formats.map((f) => (
                      <Badge key={f} tone={f === 'interview' ? 'brand' : 'neutral'}>
                        <span data-testid="radar-side-format" data-format={f}>
                          {FORMAT_LABEL[f]}
                        </span>
                      </Badge>
                    ))}
                  </span>
                  <span className="t-meta truncate text-slate-500">
                    {v.channelName}
                    {why !== ratioLine(v) && ` · ${why}`}
                  </span>
                  {notes.length > 0 && (
                    <span className="t-meta break-keep text-slate-600" data-testid="radar-side-notes">
                      참고 · {notes.join(' · ')}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
