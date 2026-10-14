/**
 * 이번 주 찍을 것 (D-194 콘텐츠 레이더 첫 화면 · D-195 UX 3.0) — 결정 → 이유 → 상세 근거.
 *  1) 1순위 하나만 크게(HERO) — 주제 · 왜 지금 한 문장 · 핵심 근거 2개 · MIRAE 관점 · 제목 예 · [이번 주로 확정] [근거 보기]
 *  2) 2 · 3순위는 작게 — 핵심 근거 · MIRAE 관점 한 줄 · [이번 주로 확정] [근거]
 *  3) 4 · 5위 한 줄 · [후보 더 보기] 6~10위
 *  4) 시장 신호(다음 후보를 찾는 곳) — 급상승 주제 · 평소보다 터진 영상 각 4개 + [더 보기]
 * 썸네일 · 배수 · 모든 숫자는 [근거 보기] 안에 — 숨기지 않고 자리만 옮겼다(기본 상태에서 시선을 뺏지 않게).
 * 카드 문구는 '근거 → 제안' 순서. 'AI 추천' · '성공 가능 %' 같은 말을 쓰지 않는다.
 */
import { useMemo, useState } from 'react'
import { BookmarkCheck, BookmarkPlus, CalendarCheck, ChevronDown, ClipboardCopy, EyeOff, Flame, Info, NotebookPen, RotateCcw, Settings2, TrendingUp } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/primitives'
import { HintTip } from '../../../components/ui/fold'
import { hintFor } from '../../../content/sectionHints'
import { shortNum } from '../../../services/marketing/ytBench'
import { IDEA_STATUS_LABEL, type ContentIdea, type IdeaStatus } from '../../../services/marketing/radarStore'
import {
  APPROACH_LABEL,
  AXIS_HINT,
  AXIS_LABEL,
  DEFAULT_MIX,
  PATTERN_LABEL,
  coverageLine,
  normalizeMix,
  opportunityLabel,
  type MixGuide,
  type Opportunity,
  type RadarPlan,
  type RadarVideo,
  type RisingTopic,
} from '../../../services/marketing/ytRadar'
import { AxisBadge, RatioChip, StrengthMeter, Thumb, VideoRow } from './RadarParts'

/** 시장 신호 첫 화면 개수(나머지는 [더 보기]) */
const SIGNAL_FIRST = 4

export function PlanView({
  plan,
  rising,
  breakouts,
  basis,
  ideas,
  readOnly,
  noThumb,
  onConfirm,
  onSave,
  onMute,
  onUnmute,
  onCopy,
  onOpenVideo,
  onMix,
  onGoChannels,
  onGoNotebook,
}: {
  plan: RadarPlan
  rising: RisingTopic[]
  breakouts: RadarVideo[]
  basis: string
  ideas: readonly ContentIdea[]
  readOnly: boolean
  noThumb: boolean
  onConfirm: (o: Opportunity) => void
  onSave: (o: Opportunity) => void
  onMute: (o: Opportunity) => void
  onUnmute: (key: string) => void
  onCopy: (text: string) => void
  onOpenVideo: (v: RadarVideo) => void
  onMix: (m: MixGuide) => void
  onGoChannels: () => void
  onGoNotebook: () => void
}) {
  const [more, setMore] = useState(false)
  const [criteria, setCriteria] = useState(false)
  const status = useMemo(() => new Map(ideas.map((i) => [i.key, i.status])), [ideas])
  const selected = useMemo(() => ideas.filter((i) => i.status === 'selected').slice(0, 3), [ideas])
  const [hero, ...subs] = plan.picks.slice(0, 3)
  const next = plan.picks.slice(3, 5)
  const rest = plan.picks.slice(5)
  const card = { status, readOnly, noThumb, onConfirm, onSave, onMute, onCopy, onOpenVideo }
  return (
    <div className="flex flex-col gap-6" data-testid="radar-plan">
      <section className="flex flex-col gap-3" aria-labelledby="radar-plan-h">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <HintTip tip={hintFor('이번 주 찍을 것')} label="이번 주 찍을 것">
            <h2 id="radar-plan-h" className="t-section font-bold text-slate-900">
              이번 주 찍을 것
            </h2>
          </HintTip>
          <div className="flex flex-wrap items-center gap-2">
            {plan.muted.length > 0 && (
              <button type="button" onClick={() => setCriteria(true)} className="tap t-meta inline-flex items-center gap-1 rounded-full px-2 font-semibold text-slate-500 hover:text-slate-800" data-testid="radar-muted-chip">
                <EyeOff aria-hidden="true" className="size-3.5" /> 숨긴 주제 {plan.muted.length}
              </button>
            )}
            <button
              type="button"
              onClick={() => setCriteria((x) => !x)}
              aria-expanded={criteria}
              className="tap t-sub inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 font-semibold text-slate-600 hover:border-brand-400"
              data-testid="radar-mix"
              title={hintFor('추천 기준')}
            >
              <Settings2 aria-hidden="true" className="size-4" /> 추천 기준
            </button>
          </div>
        </div>

        {criteria && <Criteria plan={plan} basis={basis} readOnly={readOnly} onMix={onMix} onUnmute={onUnmute} onClose={() => setCriteria(false)} />}

        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-(--radius-control) border border-success-200 bg-success-50/60 px-3 py-1.5" data-testid="radar-selected">
            <span className="t-meta inline-flex items-center gap-1 font-bold text-success-800">
              <CalendarCheck aria-hidden="true" className="size-4" /> 이번 주 제작 예정
            </span>
            {selected.map((i) => (
              <span key={i.id} className="t-sub min-w-0 font-semibold break-keep text-slate-800 [overflow-wrap:anywhere]" data-testid="radar-selected-item">
                {i.topic}
              </span>
            ))}
            <button type="button" onClick={onGoNotebook} className="tap t-meta ml-auto inline-flex items-center gap-1 font-semibold text-success-800 hover:underline">
              <NotebookPen aria-hidden="true" className="size-3.5" /> 수첩
            </button>
          </div>
        )}

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

        {!hero ? (
          <p className="t-body rounded-(--radius-card) border border-dashed border-slate-300 bg-white px-4 py-6 break-keep text-slate-500" data-testid="radar-empty">
            최근 30일에 2편 넘게 함께 나온 주제가 아직 없습니다 — 억지로 후보를 만들지 않았습니다. 며칠 뒤 다시 보거나 채널을 더해 주세요.
          </p>
        ) : (
          <>
            {/* PC(1280+): 1순위 왼쪽 크게 · 2 · 3순위 오른쪽 세로 / 그 아래 폭: 1순위 한 줄 전체 · 2 · 3 두 칸 / 휴대폰: 1 → 2 → 3 */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" data-testid="radar-top">
              <HeroCard o={hero} {...card} />
              {subs.length > 0 && (
                <div className="flex min-w-0 flex-col gap-3 md:col-span-2 md:grid md:grid-cols-2 xl:col-span-1 xl:flex">
                  {subs.map((o, i) => (
                    <SubCard key={o.key} o={o} rank={i + 2} {...card} />
                  ))}
                </div>
              )}
            </div>
            {next.length > 0 && (
              <ol className="flex flex-col gap-2" start={4}>
                {next.map((o, i) => (
                  <CompactOpportunity key={o.key} o={o} rank={i + 4} {...card} />
                ))}
              </ol>
            )}
            {rest.length > 0 &&
              (more ? (
                <ol className="flex flex-col gap-2" start={6} data-testid="radar-more-list">
                  {rest.map((o, i) => (
                    <CompactOpportunity key={o.key} o={o} rank={i + 6} {...card} />
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
  status: ReadonlyMap<string, IdeaStatus>
  readOnly: boolean
  noThumb: boolean
  onConfirm: (o: Opportunity) => void
  onSave: (o: Opportunity) => void
  onMute: (o: Opportunity) => void
  onCopy: (text: string) => void
  onOpenVideo: (v: RadarVideo) => void
}

/** [이번 주로 확정] — 수첩에 '제작 예정' 으로. 이미 제작 예정 이후 단계면 그 단계를 보여 준다 */
function ConfirmButton({ o, status, readOnly, onConfirm, quiet }: Pick<CardProps, 'o' | 'status' | 'readOnly' | 'onConfirm'> & { quiet?: boolean }) {
  const s = status.get(o.key)
  if (s && s !== 'idea')
    return (
      <span className="t-sub inline-flex min-h-[44px] items-center gap-1.5 font-bold text-success-700" data-testid="radar-confirmed">
        <CalendarCheck aria-hidden="true" className="size-4" /> {s === 'selected' ? '이번 주 제작 예정' : IDEA_STATUS_LABEL[s]}
      </span>
    )
  return (
    <Button variant={quiet ? 'secondary' : 'primary'} onClick={() => onConfirm(o)} disabled={readOnly} data-testid="radar-confirm" title={readOnly ? '팀장 화면을 보는 중에는 저장하지 않습니다' : '콘텐츠 수첩에 제작 예정으로 담습니다'}>
      <CalendarCheck aria-hidden="true" className="size-4" /> 이번 주로 확정
    </Button>
  )
}

function Facts({ o, size = 'md' }: { o: Opportunity; size?: 'md' | 'sm' }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="핵심 근거">
      {o.facts.map((f) => (
        <li key={f} className={`${size === 'md' ? 't-sub' : 't-meta'} rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-semibold break-keep text-slate-700`} data-testid="radar-fact">
          {f}
        </li>
      ))}
    </ul>
  )
}

function DetailsToggle({ open, onToggle, short }: { open: boolean; onToggle: () => void; short?: boolean }) {
  return (
    <Button variant="secondary" onClick={onToggle} aria-expanded={open} data-testid="radar-opp-more">
      <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} /> {open ? '접기' : short ? '근거' : '근거 보기'}
    </Button>
  )
}

/** 1순위 — 하나만 크게. 결정(주제) → 이유(한 문장 · 근거 2개) → MIRAE 관점 · 제목 예 → [확정] */
function HeroCard(props: CardProps) {
  const { o } = props
  const [open, setOpen] = useState(false)
  return (
    <article className="flex min-w-0 flex-col gap-4 self-start rounded-(--radius-panel) border border-slate-300 bg-white p-4 shadow-(--shadow-card) sm:p-6 md:col-span-2 xl:col-span-1" data-testid="radar-opp" data-size="hero" data-rank="1" data-axis={o.axis} data-strength={o.strength} aria-labelledby={`radar-h-${o.key}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="t-meta rounded-full bg-slate-900 px-2.5 py-0.5 font-bold text-white" data-testid="radar-rank1">
          이번 주 1순위
        </span>
        <AxisBadge axis={o.axis} />
        <StrengthMeter strength={o.strength} />
      </div>
      <h3 id={`radar-h-${o.key}`} className="text-2xl leading-tight font-bold break-keep text-slate-900 [overflow-wrap:anywhere] sm:text-[28px]" data-testid="radar-opp-topic">
        {o.topic}
      </h3>
      <div className="flex flex-col gap-2">
        <p className="t-body break-keep text-slate-700" data-testid="radar-why">
          <span className="font-bold text-slate-900">왜 지금 · </span>
          {o.summary}
        </p>
        <Facts o={o} />
      </div>
      <div className="flex flex-col gap-1.5 rounded-(--radius-card) border-l-4 border-brand-500 bg-brand-50/50 px-4 py-3">
        <p className="t-meta font-bold tracking-wide text-brand-800">MIRAE 는 이렇게 다르게 말합니다</p>
        <p className="t-body break-keep text-slate-900" data-testid="radar-view">
          {o.view}
        </p>
        <p className="t-sub break-keep text-slate-900">
          <span className="t-meta text-slate-500">제목 예 </span>
          <span className="font-semibold">{o.titles[0]?.text}</span>
        </p>
      </div>
      {open && <Details {...props} />}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <ConfirmButton {...props} />
        <DetailsToggle open={open} onToggle={() => setOpen((x) => !x)} />
      </div>
    </article>
  )
}

/** 2 · 3순위 — 작게(핵심 근거 · MIRAE 관점 한 줄) */
function SubCard(props: CardProps & { rank: number }) {
  const { o, rank } = props
  const [open, setOpen] = useState(false)
  return (
    <article className="flex min-w-0 flex-col gap-2.5 rounded-(--radius-card) border border-slate-200 bg-white p-4" data-testid="radar-opp" data-size="sub" data-rank={rank} data-axis={o.axis} data-strength={o.strength} aria-labelledby={`radar-h-${o.key}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="t-meta flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-700">{rank}</span>
        <AxisBadge axis={o.axis} />
        <StrengthMeter strength={o.strength} />
      </div>
      <h3 id={`radar-h-${o.key}`} className="t-card font-bold break-keep text-slate-900 [overflow-wrap:anywhere]" data-testid="radar-opp-topic">
        {o.topic}
      </h3>
      <Facts o={o} size="sm" />
      <p className="t-sub break-keep text-slate-700" data-testid="radar-view">
        <span className="t-meta font-bold text-brand-800">MIRAE 관점 </span>
        {o.view}
      </p>
      {open && <Details {...props} />}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <ConfirmButton {...props} quiet />
        <DetailsToggle open={open} onToggle={() => setOpen((x) => !x)} short />
      </div>
    </article>
  )
}

/** 4위 아래 — 한 줄(누르면 펼침) */
function CompactOpportunity(props: CardProps & { rank: number }) {
  const { o, rank } = props
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
          <p className="t-sub break-keep text-slate-700">{o.summary}</p>
          <Facts o={o} size="sm" />
          <p className="t-sub break-keep text-slate-800">
            <span className="t-meta font-bold text-brand-800">MIRAE 관점 </span>
            {o.view}
          </p>
          <Details {...props} />
          <div>
            <ConfirmButton {...props} quiet />
          </div>
        </div>
      )}
    </li>
  )
}

/** [근거 보기] — 숫자 전부 · 벤치마킹 영상(썸네일 · 배수 · 제목) · 제목 후보 · 썸네일 문구 · 담기 · 관심 없음 */
function Details({ o, status, readOnly, noThumb, onSave, onMute, onCopy, onOpenVideo }: CardProps) {
  const c = o.cluster
  const inNotebook = status.has(o.key)
  return (
    <div className="flex flex-col gap-4 border-t border-slate-100 pt-3" data-testid="radar-opp-details">
      <section className="flex flex-col gap-1.5">
        <p className="t-sub font-bold text-slate-900">근거</p>
        <ul className="flex flex-col gap-0.5">
          {o.whyNow.map((w) => (
            <li key={w} className="t-sub flex gap-1.5 break-keep text-slate-700">
              <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-slate-400" />
              <span className="min-w-0">{w}</span>
            </li>
          ))}
        </ul>
        <p className="t-meta flex flex-wrap gap-x-3 gap-y-0.5 text-slate-600" data-testid="radar-evidence">
          <span>관련 영상 {c.videos30}편(30일)</span>
          <span>채널 {c.channels30}곳</span>
          {c.breakouts > 0 && <span className="font-semibold text-red-700">평소보다 터진 영상 {c.breakouts}편</span>}
        </p>
        {c.coverage.length > 0 && (
          <p className="t-meta flex flex-wrap gap-x-3 gap-y-0.5 text-slate-600" data-testid="radar-coverage">
            <span className="text-slate-400">최근 {c.coverageDays === 14 ? '2주' : '30일'} 묶음별</span>
            {c.coverage.map((g) => (
              <span key={g.group}>{coverageLine(g)}</span>
            ))}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-1.5">
        <p className="t-sub font-bold text-slate-900">벤치마킹 영상 {o.benchmarks.length > 0 && <span className="t-meta font-normal text-slate-500">평소보다 잘된 것만 · {o.benchmarks.length}편</span>}</p>
        {o.benchmarks.length === 0 ? (
          <p className="t-sub break-keep text-slate-500" data-testid="radar-bench-none">
            평소보다 잘된 영상은 아직 없습니다 — 관련 영상 {c.videos30}편이 모두 채널 평소 수준입니다.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {o.benchmarks.map((v) => (
              <li key={v.id} className="min-w-0">
                <button type="button" onClick={() => onOpenVideo(v)} className="tap flex w-full min-w-0 flex-row gap-2.5 rounded-(--radius-card) p-1 text-left hover:bg-slate-50 sm:flex-col sm:gap-1" aria-label={`${v.title} — 자세히`} data-testid="radar-bench-thumb">
                  <Thumb v={v} noThumb={noThumb} className="w-28 shrink-0 sm:w-full" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <RatioChip v={v} />
                    <span className="t-meta line-clamp-2 font-semibold break-keep text-slate-800 [overflow-wrap:anywhere]">{v.title}</span>
                    <span className="t-meta truncate text-slate-500">{v.channelName}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-1.5">
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
      </section>
      <section className="flex flex-col gap-1.5">
        <p className="t-sub font-bold text-slate-900">썸네일 문구</p>
        <div className="flex flex-wrap gap-1.5">
          {o.thumbs.map((t) => (
            <span key={t} className="t-sub rounded-[6px] border border-slate-800 bg-slate-900 px-2.5 py-1 font-bold text-white" data-testid="radar-thumb-text">
              {t}
            </span>
          ))}
        </div>
      </section>
      <p className="t-sub break-keep text-slate-700" data-testid="radar-approach">
        <span className="font-bold text-slate-900">추천 접근 · {APPROACH_LABEL[o.approach]}</span> — {o.approachWhy}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {inNotebook ? (
          <span className="t-sub inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-success-700" data-testid="radar-saved">
            <BookmarkCheck aria-hidden="true" className="size-4" /> 수첩에 있음
          </span>
        ) : (
          <Button variant="secondary" onClick={() => onSave(o)} disabled={readOnly} data-testid="radar-save" title="이번 주가 아니어도 나중에 볼 아이디어로 담습니다">
            <BookmarkPlus aria-hidden="true" className="size-4" /> 아이디어로 담기
          </Button>
        )}
        <Button variant="ghost" onClick={() => onMute(o)} disabled={readOnly} data-testid="radar-mute" title="이 후보를 다음 추천에서 뺍니다 — 추천 기준 › 숨긴 주제에서 되살립니다">
          <EyeOff aria-hidden="true" className="size-4" /> 관심 없음
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 추천 기준 — 받은 데이터 · 비중 가이드 · 숨긴 주제                          */
/* ------------------------------------------------------------------ */

function Criteria({ plan, basis, readOnly, onMix, onUnmute, onClose }: { plan: RadarPlan; basis: string; readOnly: boolean; onMix: (m: MixGuide) => void; onUnmute: (key: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<MixGuide>(plan.mix)
  return (
    <div className="flex flex-col gap-4 rounded-(--radius-card) border border-slate-200 bg-white p-4 shadow-(--shadow-card)" data-testid="radar-criteria">
      <p className="t-sub break-keep text-slate-600" data-testid="radar-basis">
        {basis}
      </p>
      <div className="flex flex-col gap-2" data-testid="radar-mix-panel">
        <HintTip tip={hintFor('비중 가이드')} label="비중 가이드">
          <p className="t-sub font-bold text-slate-900">비중 가이드</p>
        </HintTip>
        <p className="t-meta break-keep text-slate-500">규칙이 아니라 안내입니다 — 데이터가 센 후보가 먼저이고, 앞 5개에서 한 종류가 몰리지 않게만 막습니다.</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
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
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            disabled={readOnly}
            onClick={() => {
              onMix(normalizeMix(draft))
              onClose()
            }}
          >
            적용
          </Button>
          <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => setDraft(DEFAULT_MIX)}>
            기본값(45 · 35 · 20)
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-slate-100 pt-3" data-testid="radar-muted">
        <p className="t-sub font-bold text-slate-900">숨긴 주제 {plan.muted.length > 0 && <span className="t-meta font-normal text-slate-500">{plan.muted.length}개</span>}</p>
        {plan.muted.length === 0 ? (
          <p className="t-meta break-keep text-slate-500">후보의 [근거 보기] › [관심 없음] 을 누르면 그 후보만 다음 추천에서 빠지고 여기에 모입니다.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {plan.muted.map((k) => {
              const { axis, label } = opportunityLabel(k)
              return (
                <li key={k} className="flex flex-wrap items-center gap-2 py-1.5" data-testid="radar-muted-row">
                  {axis && <AxisBadge axis={axis} />}
                  <span className="t-sub min-w-0 flex-[1_1_10rem] font-semibold break-keep text-slate-800">{label}</span>
                  <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => onUnmute(k)} data-testid="radar-unmute">
                    <RotateCcw aria-hidden="true" className="size-4" /> 다시 보기
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 시장 신호 — 다음 후보를 찾는 곳(후보보다 눈에 덜 띄게)                      */
/* ------------------------------------------------------------------ */

function MarketSignals({ rising, breakouts, noThumb, onOpenVideo }: { rising: RisingTopic[]; breakouts: RadarVideo[]; noThumb: boolean; onOpenVideo: (v: RadarVideo) => void }) {
  const [allRising, setAllRising] = useState(false)
  const [allBreakouts, setAllBreakouts] = useState(false)
  const shownRising = allRising ? rising : rising.slice(0, SIGNAL_FIRST)
  const shown = useMemo(() => (allBreakouts ? breakouts : breakouts.slice(0, SIGNAL_FIRST)), [allBreakouts, breakouts])
  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="radar-signals-h" data-testid="radar-signals">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <HintTip tip={hintFor('시장 신호')} label="시장 신호">
          <h2 id="radar-signals-h" className="t-card font-bold text-slate-900">
            시장 신호
          </h2>
        </HintTip>
        <span className="t-meta text-slate-500">다음 후보를 찾는 곳</span>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex min-w-0 flex-col gap-2 rounded-(--radius-card) border border-slate-200 bg-slate-50/60 p-3 sm:p-4" data-testid="radar-rising">
          <HintTip tip={hintFor('급상승 주제')} label="급상승 주제">
            <h3 className="t-sub flex items-center gap-1.5 font-bold text-slate-800">
              <TrendingUp aria-hidden="true" className="size-4 text-brand-600" /> 급상승 주제
            </h3>
          </HintTip>
          {rising.length === 0 ? (
            <p className="t-sub text-slate-500">최근 2주에 여러 채널이 함께 다룬 주제가 없습니다.</p>
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-slate-200/70">
                {shownRising.map((r) => (
                  <li key={r.label} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-2" data-testid="radar-rising-row">
                    <span className="t-sub min-w-0 flex-[1_1_8rem] font-semibold break-keep text-slate-800">{r.label}</span>
                    <span className="t-meta text-slate-600">
                      2주 {r.videos14}편 · {r.channels14}채널
                    </span>
                    {r.growing && <Badge tone="brand">빠르게 늘어남</Badge>}
                    {r.breakouts > 0 && <Badge tone="danger">터진 영상 {r.breakouts}</Badge>}
                    {!r.fit && <Badge>MIRAE 분야 밖 · 참고</Badge>}
                  </li>
                ))}
              </ul>
              {rising.length > SIGNAL_FIRST && !allRising && (
                <div>
                  <Button size="sm" variant="ghost" onClick={() => setAllRising(true)} data-testid="radar-rising-more">
                    더 보기 ({rising.length - SIGNAL_FIRST})
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2 rounded-(--radius-card) border border-slate-200 bg-slate-50/60 p-3 sm:p-4" data-testid="radar-breakouts">
          <HintTip tip={hintFor('평소보다 터진 영상')} label="평소보다 터진 영상">
            <h3 className="t-sub flex items-center gap-1.5 font-bold text-slate-800">
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
              {breakouts.length > SIGNAL_FIRST && !allBreakouts && (
                <div>
                  <Button size="sm" variant="ghost" onClick={() => setAllBreakouts(true)} data-testid="radar-breakouts-more">
                    더 보기 ({breakouts.length - SIGNAL_FIRST})
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
