/**
 * 이번 주 찍을 것 (D-194 콘텐츠 레이더 첫 화면) — 결정이 먼저, 숫자는 근거로만.
 *  1) 후보 TOP 3 카드(근거 → 제안) · 4~5위 한 줄 · [후보 더 보기] 6~10위
 *  2) 시장 신호 — 급상승 주제 · 평소보다 터진 영상
 *  3) 콘텐츠 수첩(IdeaNotebook — 따로)
 * 카드 문구는 '근거 → 제안' 순서. 'AI 추천' · '성공 가능 %' 같은 말을 쓰지 않는다.
 */
import { useMemo, useState } from 'react'
import { BookmarkCheck, BookmarkPlus, ChevronDown, ClipboardCopy, Flame, Info, Settings2, TrendingUp } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/primitives'
import { HintTip } from '../../../components/ui/fold'
import { hintFor } from '../../../content/sectionHints'
import { shortNum } from '../../../services/marketing/ytBench'
import {
  APPROACH_LABEL,
  AXIS_HINT,
  AXIS_LABEL,
  DEFAULT_MIX,
  PATTERN_LABEL,
  normalizeMix,
  type MixGuide,
  type Opportunity,
  type RadarPlan,
  type RadarVideo,
  type RisingTopic,
} from '../../../services/marketing/ytRadar'
import { AxisBadge, RatioChip, StrengthMeter, Thumb, VideoRow } from './RadarParts'

export function PlanView({
  plan,
  rising,
  breakouts,
  basis,
  savedKeys,
  readOnly,
  noThumb,
  onSave,
  onCopy,
  onOpenVideo,
  onMix,
  onGoChannels,
}: {
  plan: RadarPlan
  rising: RisingTopic[]
  breakouts: RadarVideo[]
  basis: string
  savedKeys: ReadonlySet<string>
  readOnly: boolean
  noThumb: boolean
  onSave: (o: Opportunity) => void
  onCopy: (text: string) => void
  onOpenVideo: (v: RadarVideo) => void
  onMix: (m: MixGuide) => void
  onGoChannels: () => void
}) {
  const [more, setMore] = useState(false)
  const top = plan.picks.slice(0, 3)
  const next = plan.picks.slice(3, 5)
  const rest = plan.picks.slice(5)
  return (
    <div className="flex flex-col gap-6" data-testid="radar-plan">
      <section className="flex flex-col gap-3" aria-labelledby="radar-plan-h">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <HintTip tip={hintFor('이번 주 찍을 것')} label="이번 주 찍을 것">
              <h2 id="radar-plan-h" className="t-section font-bold text-slate-900">
                이번 주 찍을 것
              </h2>
            </HintTip>
            <p className="t-meta text-slate-500" data-testid="radar-basis">
              {basis}
            </p>
          </div>
          <MixEditor mix={plan.mix} readOnly={readOnly} onMix={onMix} />
        </div>

        {plan.aiDataShort && (
          <p className="t-sub flex flex-wrap items-center gap-x-2 gap-y-1 rounded-(--radius-control) border border-slate-300 bg-slate-50 px-3 py-2 break-keep text-slate-700" data-testid="radar-ai-short">
            <Info aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
            <span className="min-w-0 flex-1">
              AI 벤치마킹 데이터가 부족합니다 — {plan.aiChannels === 0 ? 'AI 실무 · AX 채널이 아직 없습니다.' : '최근 30일에 AI · 자동화 주제 영상이 거의 없습니다.'} AX · AI 후보는 데이터가 쌓이면 나옵니다.
            </span>
            <button type="button" onClick={onGoChannels} className="tap t-sub font-semibold text-brand-700 hover:underline">
              채널 보기
            </button>
          </p>
        )}

        {plan.picks.length === 0 ? (
          <p className="t-body rounded-(--radius-card) border border-dashed border-slate-300 bg-white px-4 py-6 break-keep text-slate-500" data-testid="radar-empty">
            최근 30일에 2편 넘게 함께 나온 주제가 아직 없습니다 — 억지로 후보를 만들지 않았습니다. 며칠 뒤 다시 보거나 채널을 더해 주세요.
          </p>
        ) : (
          <>
            <ol className="grid grid-cols-1 gap-3 xl:grid-cols-3" data-testid="radar-top">
              {top.map((o, i) => (
                <OpportunityCard key={o.key} o={o} rank={i + 1} saved={savedKeys.has(o.key)} readOnly={readOnly} noThumb={noThumb} onSave={onSave} onCopy={onCopy} onOpenVideo={onOpenVideo} />
              ))}
            </ol>
            {next.length > 0 && (
              <ol className="flex flex-col gap-2" start={4}>
                {next.map((o, i) => (
                  <CompactOpportunity key={o.key} o={o} rank={i + 4} saved={savedKeys.has(o.key)} readOnly={readOnly} noThumb={noThumb} onSave={onSave} onCopy={onCopy} onOpenVideo={onOpenVideo} />
                ))}
              </ol>
            )}
            {rest.length > 0 &&
              (more ? (
                <ol className="flex flex-col gap-2" start={6} data-testid="radar-more-list">
                  {rest.map((o, i) => (
                    <CompactOpportunity key={o.key} o={o} rank={i + 6} saved={savedKeys.has(o.key)} readOnly={readOnly} noThumb={noThumb} onSave={onSave} onCopy={onCopy} onOpenVideo={onOpenVideo} />
                  ))}
                </ol>
              ) : (
                <div>
                  <Button variant="secondary" onClick={() => setMore(true)} data-testid="radar-more">
                    <ChevronDown aria-hidden="true" className="size-4" /> 후보 더 보기 ({rest.length})
                  </Button>
                </div>
              ))}
          </>
        )}
      </section>

      <MarketSignals rising={rising} breakouts={breakouts} noThumb={noThumb} onOpenVideo={onOpenVideo} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 후보 카드                                                              */
/* ------------------------------------------------------------------ */

interface CardProps {
  o: Opportunity
  rank: number
  saved: boolean
  readOnly: boolean
  noThumb: boolean
  onSave: (o: Opportunity) => void
  onCopy: (text: string) => void
  onOpenVideo: (v: RadarVideo) => void
}

function SaveButton({ o, saved, readOnly, onSave }: Pick<CardProps, 'o' | 'saved' | 'readOnly' | 'onSave'>) {
  if (saved)
    return (
      <span className="t-sub inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-success-700" data-testid="radar-saved">
        <BookmarkCheck aria-hidden="true" className="size-4" /> 수첩에 있음
      </span>
    )
  return (
    <Button variant="primary" onClick={() => onSave(o)} disabled={readOnly} data-testid="radar-save" title={readOnly ? '팀장 화면을 보는 중에는 저장하지 않습니다' : undefined}>
      <BookmarkPlus aria-hidden="true" className="size-4" /> 아이디어 저장
    </Button>
  )
}

function Evidence({ o }: { o: Opportunity }) {
  const c = o.cluster
  return (
    <p className="t-meta flex flex-wrap gap-x-3 gap-y-0.5 text-slate-600" data-testid="radar-evidence">
      <span>관련 영상 {c.videos30}편(30일)</span>
      <span>채널 {c.channels30}곳</span>
      {c.breakouts > 0 && <span className="font-semibold text-red-700">평소보다 터진 영상 {c.breakouts}편</span>}
    </p>
  )
}

function Details({ o, noThumb, onCopy, onOpenVideo }: Pick<CardProps, 'o' | 'noThumb' | 'onCopy' | 'onOpenVideo'>) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 pt-3" data-testid="radar-opp-details">
      <div className="flex flex-col gap-1">
        <p className="t-sub font-bold text-slate-900">대표 벤치마킹</p>
        <ul className="flex flex-col">
          {o.benchmarks.map((v) => (
            <VideoRow key={v.id} v={v} onOpen={onOpenVideo} noThumb={noThumb} />
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="t-sub font-bold text-slate-900">제목 후보</p>
        <ul className="flex flex-col gap-1">
          {o.titles.map((t) => (
            <li key={t.text} className="flex min-w-0 items-center gap-2" data-testid="radar-title">
              <span className="t-sub min-w-0 flex-1 break-keep text-slate-800 [overflow-wrap:anywhere]">
                {t.text}
                {t.patterns.length > 0 && <span className="t-meta ml-1.5 text-slate-400">{t.patterns.map((p) => PATTERN_LABEL[p]).join(' · ')}</span>}
              </span>
              <Button size="sm" variant="ghost" onClick={() => onCopy(t.text)} aria-label={`제목 복사 — ${t.text}`}>
                <ClipboardCopy aria-hidden="true" className="size-4" /> 복사
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="t-sub font-bold text-slate-900">썸네일 문구</p>
        <div className="flex flex-wrap gap-1.5">
          {o.thumbs.map((t) => (
            <span key={t} className="t-sub rounded-[6px] border border-slate-800 bg-slate-900 px-2.5 py-1 font-bold text-white" data-testid="radar-thumb-text">
              {t}
            </span>
          ))}
        </div>
      </div>
      <p className="t-sub break-keep text-slate-700" data-testid="radar-approach">
        <span className="font-bold text-slate-900">추천 접근 · {APPROACH_LABEL[o.approach]}</span> — {o.approachWhy}
      </p>
    </div>
  )
}

function OpportunityCard({ o, rank, saved, readOnly, noThumb, onSave, onCopy, onOpenVideo }: CardProps) {
  const [open, setOpen] = useState(false)
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-(--radius-card) border border-slate-200 bg-white p-4" data-testid="radar-opp" data-axis={o.axis} data-strength={o.strength}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="t-meta flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-900 font-bold text-white">{rank}</span>
        <AxisBadge axis={o.axis} />
        <StrengthMeter strength={o.strength} />
      </div>
      <h3 className="t-card font-bold break-keep text-slate-900 [overflow-wrap:anywhere]" data-testid="radar-opp-topic">
        {o.topic}
      </h3>
      <div className="flex flex-col gap-1">
        <p className="t-meta font-bold tracking-wide text-slate-500">왜 지금?</p>
        <ul className="flex flex-col gap-0.5" data-testid="radar-why">
          {o.whyNow.slice(0, 3).map((w) => (
            <li key={w} className="t-sub flex gap-1.5 break-keep text-slate-700">
              <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-slate-400" />
              <span className="min-w-0">{w}</span>
            </li>
          ))}
        </ul>
      </div>
      <Evidence o={o} />
      {o.benchmarks.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5" aria-label="대표 벤치마킹 영상">
          {o.benchmarks.slice(0, 3).map((v) => (
            <button key={v.id} type="button" onClick={() => onOpenVideo(v)} className="tap flex min-w-0 flex-col gap-0.5 text-left" aria-label={`${v.title} — 자세히`} data-testid="radar-bench-thumb">
              <Thumb v={v} noThumb={noThumb} />
              <RatioChip v={v} />
            </button>
          ))}
        </div>
      )}
      <div className="rounded-(--radius-control) bg-slate-50 px-3 py-2">
        <p className="t-meta font-bold tracking-wide text-slate-500">MIRAE 관점</p>
        <p className="t-sub break-keep text-slate-800" data-testid="radar-view">
          {o.view}
        </p>
        <p className="t-sub mt-1 break-keep text-slate-900">
          <span className="t-meta text-slate-500">제목 예 </span>
          <span className="font-semibold">{o.titles[0]?.text}</span>
        </p>
      </div>
      {open && <Details o={o} noThumb={noThumb} onCopy={onCopy} onOpenVideo={onOpenVideo} />}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setOpen((x) => !x)} aria-expanded={open} data-testid="radar-opp-more">
          <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} /> {open ? '접기' : '벤치마킹 영상 · 제목 보기'}
        </Button>
        <SaveButton o={o} saved={saved} readOnly={readOnly} onSave={onSave} />
      </div>
    </li>
  )
}

function CompactOpportunity({ o, rank, saved, readOnly, noThumb, onSave, onCopy, onOpenVideo }: CardProps) {
  const [open, setOpen] = useState(false)
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-(--radius-card) border border-slate-200 bg-white px-3 py-2.5" data-testid="radar-opp-compact" data-axis={o.axis}>
      <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} className="tap flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-left">
        <span className="t-meta flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-700">{rank}</span>
        <AxisBadge axis={o.axis} />
        <span className="t-body min-w-0 flex-[1_1_12rem] font-bold break-keep text-slate-900 [overflow-wrap:anywhere]">{o.topic}</span>
        <StrengthMeter strength={o.strength} />
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-2 pl-1">
          <ul className="flex flex-col gap-0.5">
            {o.whyNow.slice(0, 3).map((w) => (
              <li key={w} className="t-sub break-keep text-slate-700">
                · {w}
              </li>
            ))}
          </ul>
          <Evidence o={o} />
          <p className="t-sub break-keep text-slate-800">
            <span className="t-meta font-bold text-slate-500">MIRAE 관점 </span>
            {o.view}
          </p>
          <Details o={o} noThumb={noThumb} onCopy={onCopy} onOpenVideo={onOpenVideo} />
          <div>
            <SaveButton o={o} saved={saved} readOnly={readOnly} onSave={onSave} />
          </div>
        </div>
      )}
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* 비중 가이드                                                            */
/* ------------------------------------------------------------------ */

function MixEditor({ mix, readOnly, onMix }: { mix: MixGuide; readOnly: boolean; onMix: (m: MixGuide) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<MixGuide>(mix)
  const label = `시장 ${mix.market} · AX·AI ${mix.axai} · BRIDGE ${mix.bridge}`
  return (
    <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={() => {
          setDraft(mix)
          setOpen((x) => !x)
        }}
        aria-expanded={open}
        className="tap t-meta inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-600 hover:border-brand-400"
        data-testid="radar-mix"
        title={hintFor('비중 가이드')}
      >
        <Settings2 aria-hidden="true" className="size-3.5" /> 비중 가이드 {label}
      </button>
      {open && (
        <div className="flex w-full max-w-sm flex-col gap-2 rounded-(--radius-card) border border-slate-200 bg-white p-3 shadow-(--shadow-card)" data-testid="radar-mix-panel">
          <p className="t-meta break-keep text-slate-500">규칙이 아니라 안내입니다 — 후보를 이 비율에 가깝게 섞어 보여 줍니다.</p>
          {(['market', 'axai', 'bridge'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2">
              <span className="t-sub w-20 shrink-0 font-semibold text-slate-700">{AXIS_LABEL[k]}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={draft[k]}
                onChange={(e) => setDraft((d) => ({ ...d, [k]: Number(e.target.value) }))}
                className="tap t-sub w-20 rounded-(--radius-control) border border-slate-300 px-2 py-1.5"
                aria-label={`${AXIS_LABEL[k]} 비중`}
                title={AXIS_HINT[k]}
              />
              <span className="t-meta text-slate-400">%</span>
            </label>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={readOnly}
              onClick={() => {
                onMix(normalizeMix(draft))
                setOpen(false)
              }}
            >
              적용
            </Button>
            <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => setDraft(DEFAULT_MIX)}>
              기본값(45 · 35 · 20)
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 시장 신호                                                              */
/* ------------------------------------------------------------------ */

function MarketSignals({ rising, breakouts, noThumb, onOpenVideo }: { rising: RisingTopic[]; breakouts: RadarVideo[]; noThumb: boolean; onOpenVideo: (v: RadarVideo) => void }) {
  const [allBreakouts, setAllBreakouts] = useState(false)
  const shown = useMemo(() => (allBreakouts ? breakouts : breakouts.slice(0, 6)), [allBreakouts, breakouts])
  return (
    <section className="flex flex-col gap-3" aria-labelledby="radar-signals-h" data-testid="radar-signals">
      <HintTip tip={hintFor('시장 신호')} label="시장 신호">
        <h2 id="radar-signals-h" className="t-section font-bold text-slate-900">
          시장 신호
        </h2>
      </HintTip>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex min-w-0 flex-col gap-2 rounded-(--radius-card) border border-slate-200 bg-white p-3 sm:p-4" data-testid="radar-rising">
          <HintTip tip={hintFor('급상승 주제')} label="급상승 주제">
            <h3 className="t-card flex items-center gap-1.5 font-bold text-slate-900">
              <TrendingUp aria-hidden="true" className="size-4 text-brand-600" /> 급상승 주제
            </h3>
          </HintTip>
          {rising.length === 0 ? (
            <p className="t-sub text-slate-500">최근 2주에 여러 채널이 함께 다룬 주제가 없습니다.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100">
              {rising.map((r) => (
                <li key={r.label} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-2" data-testid="radar-rising-row">
                  <span className="t-body min-w-0 flex-[1_1_8rem] font-semibold break-keep text-slate-900">{r.label}</span>
                  <span className="t-meta text-slate-600">
                    2주 {r.videos14}편 · {r.channels14}채널
                  </span>
                  {r.growing && <Badge tone="brand">빠르게 늘어남</Badge>}
                  {r.breakouts > 0 && <Badge tone="danger">터진 영상 {r.breakouts}</Badge>}
                  {!r.fit && <Badge>MIRAE 분야 밖 · 참고</Badge>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2 rounded-(--radius-card) border border-slate-200 bg-white p-3 sm:p-4" data-testid="radar-breakouts">
          <HintTip tip={hintFor('평소보다 터진 영상')} label="평소보다 터진 영상">
            <h3 className="t-card flex items-center gap-1.5 font-bold text-slate-900">
              <Flame aria-hidden="true" className="size-4 text-red-500" /> 평소보다 터진 영상
            </h3>
          </HintTip>
          {breakouts.length === 0 ? (
            <p className="t-sub text-slate-500">최근 30일에 채널 평소보다 3배 넘게 본 영상이 없습니다.</p>
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                {shown.map((v) => (
                  <VideoRow key={v.id} v={v} onOpen={onOpenVideo} noThumb={noThumb} />
                ))}
              </ul>
              {breakouts.length > 6 && !allBreakouts && (
                <div>
                  <Button size="sm" variant="ghost" onClick={() => setAllBreakouts(true)}>
                    더 보기 ({breakouts.length - 6})
                  </Button>
                </div>
              )}
              <p className="t-meta text-slate-400">구독자 {shortNum(30_000)} 이하 채널에서 터진 영상은 더 강한 신호로 봅니다.</p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
