/**
 * 이번 주 찍을 것 (D-194 콘텐츠 레이더 첫 화면 · D-195 UX 3.0) — 결정 → 이유 → 상세 근거.
 *  1) 1순위 하나만 크게(HERO) — 주제 · 왜 지금 한 문장 · 핵심 근거 2개 · MIRAE 관점 · 제목 예 · [이번 주로 확정] [근거 보기]
 *  2) 2 · 3순위는 작게 — 핵심 근거 · MIRAE 관점 한 줄 · [이번 주로 확정] [근거]
 *  3) 4~10위 — D-296 대표 "10순위까지 한 번에": 2 · 3순위와 같은 카드로 다 보인다([후보 더 보기] 없음)
 *  4) 경제 · 경영 · AI 시장 신호(D-197 · 다음 후보를 찾는 곳) — 지금 강한 흐름(세 영역) · AI 핵심 키워드 ·
 *     급상승 주제 · 평소보다 터진 영상 각 4개 + [더 보기] — 메인 후보처럼 경제 · 경영 · AI 주제만
 *  5) 사이드 급상승(D-197) — 그 밖 주제에서 비정상적으로 크게 터진 영상만(최대 5) · TOP 보다 작게
 * 카드마다 [왜 추천됐나요?] — 추천 기준 다섯 가지 중 맞는 것 · 아닌 것(점수 없음).
 * 썸네일 · 배수 · 모든 숫자는 [근거 보기] 안에 — 숨기지 않고 자리만 옮겼다(기본 상태에서 시선을 뺏지 않게).
 * 카드 문구는 '근거 → 제안' 순서. 'AI 추천' · '성공 가능 %' 같은 말을 쓰지 않는다.
 * D-227 대표 "한 페이지에 너무 많으면 역효과 · 길을 잃지 않게 · 토스처럼 다음 단계로":
 *  - 맨 위 길잡이 ① 주제 고르기 → ② 이번 주로 확정 → ③ 찍고 올리기(수첩) — 지금 할 일 한 줄 · 제작 예정 주제는 길잡이 안에.
 *  - 시장 신호(지금 강한 흐름 · AI 키워드 · 급상승 · 터진 영상 · 사이드 급상승)는 접어 두고 숫자 요약만 —
 *    펼치면 판 하나만 고르게(한 번에 한 판). 지운 것은 없다.
 * D-231 대표 "미래는 이렇게 말합니다가 애매 — 미래AI랩 관점을 강조 · 어떤 제목 · 어떤 내용으로 찍을지 예시까지 한 번에 ·
 *        몇 분 안에 '오늘 이거 찍자' 가 판단되게":
 *  - 'MIRAE 관점' → 눈에 띄는 '미래AI랩 관점' 상자(1순위는 크게).
 *  - 후보마다 '이번 주 이렇게 찍으세요'(찍기 키트) — 제목 예 · 첫 문장 · 준비 시간은 늘 보이고, 펼치면 잘 된 틀 → 우리 제목 ·
 *    긴 영상 구성 · 쇼츠 3컷 · 그대로/바꿀 것 · 준비물 · 키트 복사. 1순위는 펼친 채로. 4위 아래 한 줄에도 제목 예.
 * D-296 대표 "처음부터 읽을 게 너무 많아 눈이 아프다 — 이번 주 이렇게 찍으세요도 펼치기를 눌러야 나오게":
 *  - 찍기 키트는 1순위까지 모두 접힌 채(제목 줄 · 준비 시간만). 누르면 이렇게 말해요 · 제목 예 · 첫 문장 · 잘 된 틀 → 우리 제목 · 제목 후보 · 썸네일 · 전체 복사.
 */
import { useMemo, useState } from 'react'
import { Fold } from '../../../components/ui/fold'
import { MkPick, MkSteps } from '../../../tools/marketing/mkKit'
import { ArrowRight, BarChart3, BookmarkCheck, BookmarkPlus, CalendarCheck, Check, ChevronDown, CircleHelp, Clapperboard, ClipboardCopy, Clock, EyeOff, Flame, Info, LayoutList, Lightbulb, Minus, NotebookPen, RotateCcw, Settings2, Sparkles, TrendingUp, Zap } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/primitives'
import { HintTip } from '../../../components/ui/fold'
import { hintFor } from '../../../content/sectionHints'
import { shortNum } from '../../../services/marketing/ytBench'
import { IDEA_STATUS_LABEL, type ContentIdea, type IdeaStatus } from '../../../services/marketing/radarStore'
import { kitText, shootKit } from '../../../services/marketing/shootKit'
import {
  APPROACH_LABEL,
  AXIS_HINT,
  AXIS_LABEL,
  DEFAULT_MIX,
  PATTERN_LABEL,
  SMALL_CHANNEL_SUBS,
  WHY_LABEL,
  clusterHot,
  coverageHits,
  coverageLine,
  normalizeMix,
  opportunityLabel,
  whyRecommended,
  type AiKeywordStat,
  type AiWorkflowSignal,
  type DomainSignal,
  type MixGuide,
  type NewAiKeyword,
  type Opportunity,
  type RadarPlan,
  type RadarVideo,
  type RisingTopic,
  type SideBreakout,
} from '../../../services/marketing/ytRadar'
import { Peek } from './EvidencePeek'
import { AiKeywordBoard, DomainBoard, SideBreakouts } from './FocusSignals'
import { AxisBadge, DomainBadge, IconChip, RatioChip, StrengthMeter, Thumb, VideoRow } from './RadarParts'
import { mkText } from '../../../services/marketing/persona'

/** 시장 신호 첫 화면 개수(나머지는 [더 보기]) */
const SIGNAL_FIRST = 4

export function PlanView({
  plan,
  rising,
  breakouts,
  focus,
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
  /** D-197 — 지금 강한 흐름 · AI 핵심 키워드 · 업무 흐름 · 새 AI 키워드 후보 · 사이드 급상승 */
  focus: FocusData
  basis: string
  ideas: readonly ContentIdea[]
  readOnly: boolean
  noThumb: boolean
  onConfirm: (o: Opportunity) => void
  onSave: (o: Opportunity) => void
  onMute: (o: Opportunity) => void
  onUnmute: (key: string) => void
  onCopy: (text: string, what?: string) => void
  onOpenVideo: (v: RadarVideo) => void
  onMix: (m: MixGuide) => void
  onGoChannels: () => void
  onGoNotebook: () => void
}) {
  const [criteria, setCriteria] = useState(false)
  const status = useMemo(() => new Map(ideas.map((i) => [i.key, i.status])), [ideas])
  const selected = useMemo(() => ideas.filter((i) => i.status === 'selected').slice(0, 3), [ideas])
  // 제작 예정 · 대본 · 촬영 중인 것이 있으면 길잡이는 ③ 찍고 올리기
  const inWork = useMemo(() => ideas.filter((i) => i.status === 'selected' || i.status === 'script' || i.status === 'filmed').length, [ideas])
  const [hero, ...subs] = plan.picks.slice(0, 3)
  const rest = plan.picks.slice(3)
  const card = { status, readOnly, noThumb, onConfirm, onSave, onMute, onCopy, onOpenVideo }
  return (
    <div className="flex flex-col gap-6" data-testid="radar-plan">
      <section className="flex flex-col gap-3" aria-labelledby="radar-plan-h">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <HintTip tip={hintFor('이번 주 찍을 것')} label="이번 주 찍을 것">
            <h2 id="radar-plan-h" className="flex items-center gap-2 text-[1.375rem] leading-tight font-extrabold text-slate-900 sm:text-2xl">
              <IconChip icon={Clapperboard} tone="rose" size="lg" />
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

        {/* D-227 길잡이 — 지금 몇 단계 · 다음에 누를 것 한 줄(제작 예정 주제도 여기 안에) */}
        <div className="flex flex-col gap-3 rounded-(--radius-panel) border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-white p-3 sm:p-4" data-testid="radar-guide">
          <div className="mx-auto w-full max-w-xl">
            <MkSteps
              steps={[
                { key: 'pick', label: '주제 고르기' },
                { key: 'confirm', label: '이번 주로 확정' },
                { key: 'make', label: '찍고 올리기' },
              ]}
              current={inWork > 0 ? 2 : 0}
              tone="rose"
              onGo={(k) => (k === 'make' ? onGoNotebook() : document.querySelector('[data-testid="radar-top"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))}
              testId="radar-steps"
            />
          </div>
          {selected.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-(--radius-control) border border-success-200 bg-success-50/70 px-3 py-2" data-testid="radar-selected">
              <span className="t-sub inline-flex items-center gap-1 font-bold text-success-800">
                <CalendarCheck aria-hidden="true" className="size-4" /> 이번 주 제작 예정
              </span>
              {selected.map((i) => (
                <span key={i.id} className="t-sub min-w-0 font-semibold break-keep text-slate-800 [overflow-wrap:anywhere]" data-testid="radar-selected-item">
                  {i.topic}
                </span>
              ))}
              <button type="button" onClick={onGoNotebook} className="tap t-sub ml-auto inline-flex items-center gap-1 rounded-full bg-success-700 px-3 font-bold text-white hover:bg-success-800" data-testid="radar-guide-notebook">
                <NotebookPen aria-hidden="true" className="size-4" /> 다음: 내 콘텐츠에서 일정 · 체크 <ArrowRight aria-hidden="true" className="size-4" />
              </button>
            </div>
          ) : (
            <p className="t-sub flex items-start gap-1.5 break-keep text-slate-700" data-testid="radar-guide-next">
              <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-rose-600" />
              <span className="min-w-0">
                <b className="font-bold text-slate-900">지금 할 일 — </b>
                {hero ? "1~10순위가 아래에 다 있어요 — 마음에 드는 주제의 '이번 주 이렇게 찍으세요' 를 눌러 제목 예 · 첫 문장을 보고, 찍을 만하면 [이번 주로 확정] 을 눌러 주세요." : '후보가 생기면 여기서 바로 고를 수 있어요.'}
              </span>
            </p>
          )}
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
            {/* D-296 4~10위도 한 번에 — 2 · 3순위와 같은 카드(찍기 키트는 접힌 채라 길지 않다) */}
            {rest.length > 0 && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="radar-rest">
                {rest.map((o, i) => (
                  <SubCard key={o.key} o={o} rank={i + 4} {...card} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <MarketSignals rising={rising} breakouts={breakouts} focus={focus} noThumb={noThumb} onOpenVideo={onOpenVideo} />
    </div>
  )
}

export interface FocusData {
  domains: DomainSignal[]
  aiKeywords: AiKeywordStat[]
  workflow: AiWorkflowSignal[]
  fresh: NewAiKeyword[]
  side: SideBreakout[]
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
  onCopy: (text: string, what?: string) => void
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
    <Button variant={quiet ? 'secondary' : 'primary'} onClick={() => onConfirm(o)} disabled={readOnly} data-testid="radar-confirm" title={readOnly ? '팀장 화면을 보는 중에는 저장하지 않습니다' : '내 콘텐츠에 제작 예정으로 담습니다'}>
      <CalendarCheck aria-hidden="true" className="size-4" /> 이번 주로 확정
    </Button>
  )
}

/** 핵심 근거 칩 — 숫자가 센 영상이 있으면 마우스를 올리거나 누르면 그 영상 목록(D-198) */
function Facts({ o, size = 'md' }: { o: Opportunity; size?: 'md' | 'sm' }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="핵심 근거">
      {o.facts.map((f, i) => (
        <li key={f} className={`${size === 'md' ? 't-sub' : 't-meta'} min-w-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-semibold break-keep text-slate-700`} data-testid="radar-fact">
          <Peek videos={o.factHits[i] ?? []} title={o.topic} basis={f} kind="fact">
            {f}
          </Peek>
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
    <article className="flex min-w-0 flex-col gap-4 self-start rounded-(--radius-panel) border border-slate-300 bg-white p-4 shadow-(--shadow-card) sm:p-6 md:col-span-2 xl:col-span-1" data-testid="radar-opp" data-size="hero" data-rank="1" data-axis={o.axis} data-domain={o.domain} data-strength={o.strength} aria-labelledby={`radar-h-${o.key}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="t-meta rounded-full bg-slate-900 px-2.5 py-0.5 font-bold text-white" data-testid="radar-rank1">
          이번 주 1순위
        </span>
        <AxisBadge axis={o.axis} />
        <DomainBadge axis={o.axis} domain={o.domain} />
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
        <WhyRecommended o={o} />
      </div>
      {open && <Details {...props} />}
      {/* D-238: [이번 주로 확정] 을 찍기 키트 위로 — 키트를 펼쳐 둔 채라 단추가 화면 한참 아래로 밀려 있었다 */}
      <div className="flex flex-wrap items-center gap-2">
        <ConfirmButton {...props} />
        <DetailsToggle open={open} onToggle={() => setOpen((x) => !x)} />
      </div>
      <ShootBox o={o} onCopy={props.onCopy} size="lg" />
    </article>
  )
}

/** 2~10순위 — 작게(핵심 근거 · 찍기 키트는 접힌 채) */
function SubCard(props: CardProps & { rank: number }) {
  const { o, rank } = props
  const [open, setOpen] = useState(false)
  return (
    <article className="flex min-w-0 flex-col gap-2.5 rounded-(--radius-card) border border-slate-200 bg-white p-4" data-testid="radar-opp" data-size="sub" data-rank={rank} data-axis={o.axis} data-domain={o.domain} data-strength={o.strength} aria-labelledby={`radar-h-${o.key}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="t-meta flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-700">{rank}</span>
        <AxisBadge axis={o.axis} />
        <DomainBadge axis={o.axis} domain={o.domain} />
        <StrengthMeter strength={o.strength} />
      </div>
      <h3 id={`radar-h-${o.key}`} className="t-card font-bold break-keep text-slate-900 [overflow-wrap:anywhere]" data-testid="radar-opp-topic">
        {o.topic}
      </h3>
      <Facts o={o} size="sm" />
      <WhyRecommended o={o} />
      <ShootBox o={o} onCopy={props.onCopy} />
      {open && <Details {...props} />}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <ConfirmButton {...props} quiet />
        <DetailsToggle open={open} onToggle={() => setOpen((x) => !x)} short />
      </div>
    </article>
  )
}

/**
 * 이번 주 이렇게 찍으세요 — 한 상자(D-253) · D-296 처음엔 접힌 채(제목 줄만) · 누르면 아래 전부.
 * 대표: "미래AI랩 관점 · 찍기 키트가 두 상자로 길게 나와 눈에 안 띈다 — 이름을 바꿔 한 상자에 · 긴 영상 구성 · 쇼츠 3컷 ·
 *        그대로/바꿀 것 · 찍기 전 준비는 지우고 잘 된 틀 → 우리 제목 · 제목 후보 · 썸네일 · 제목 예 · 첫 문장만".
 * 늘 보이는 것: 이렇게 말해요(우리 각도) · 제목 예 · 첫 문장. 펼치면: 잘 된 틀 → 우리 제목 · 제목 후보 · 썸네일.
 */
function ShootBox({ o, onCopy, size = 'sm' }: { o: Opportunity; onCopy: (text: string, what?: string) => void; size?: 'lg' | 'sm' }) {
  const kit = useMemo(() => shootKit(o), [o])
  // D-296 처음엔 접힌 채(제목 줄 · 준비 시간만) — 누르면 안의 글이 펼쳐진다
  const [open, setOpen] = useState(false)
  const lg = size === 'lg'
  return (
    <section className={`flex min-w-0 flex-col gap-2.5 rounded-(--radius-card) border-2 border-rose-300 bg-gradient-to-br from-rose-50 via-white to-white ${lg ? 'p-3 sm:p-4' : 'p-2.5 sm:p-3'}`} data-testid="radar-kit" data-open={open ? '1' : '0'} aria-label={`${o.topic} — 이번 주 이렇게 찍으세요`}>
      <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} className="tap flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-left" data-testid="radar-kit-toggle">
        <IconChip icon={Clapperboard} tone="rose" />
        <span className={`font-extrabold text-rose-900 ${lg ? 't-card' : 't-sub'}`}>이번 주 이렇게 찍으세요</span>
        <span className="t-meta inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-semibold text-slate-700 ring-1 ring-slate-200" data-testid="radar-kit-effort">
          <Clock aria-hidden="true" className="size-3.5" /> {kit.effort.label} · {kit.effort.minutes}분쯤
        </span>
        <span className="t-meta ml-auto inline-flex items-center gap-0.5 font-bold text-rose-700">
          {open ? '접기' : '펼치기'}
          <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="flex min-w-0 flex-col gap-2.5" data-testid="radar-kit-open">
          <p className={`min-w-0 break-keep text-slate-900 [overflow-wrap:anywhere] ${lg ? 'text-[1.0625rem] leading-relaxed' : 't-sub'}`} data-testid="radar-angle">
            <span className="t-meta mr-1 inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 align-middle font-bold text-white">
              <Lightbulb aria-hidden="true" className="size-3.5" /> 이렇게 말해요
            </span>
            <span className="font-semibold" data-testid="radar-view">
              {o.view}
            </span>
          </p>
          <div className="flex min-w-0 items-start gap-2">
            <p className="t-sub min-w-0 flex-1 break-keep text-slate-900 [overflow-wrap:anywhere]" data-testid="radar-kit-title">
              <span className="t-meta font-bold text-rose-700">제목 예 </span>
              <span className="font-bold">{kit.titles[0]}</span>
            </p>
            <Button size="sm" variant="ghost" onClick={() => onCopy(kit.titles[0] ?? '')} aria-label={`제목 복사 — ${kit.titles[0]}`}>
              <ClipboardCopy aria-hidden="true" className="size-4" /> 복사
            </Button>
          </div>
          <p className="t-sub break-keep text-slate-800 [overflow-wrap:anywhere]" data-testid="radar-kit-hook">
            <span className="t-meta font-bold text-rose-700">첫 문장 </span>"{kit.hook}"
          </p>
          <div className="flex min-w-0 flex-col gap-3 border-t border-rose-100 pt-3" data-testid="radar-kit-body">
            {kit.frames.length > 0 && (
              <div className="flex flex-col gap-1.5" data-testid="radar-kit-frames">
                <p className="t-sub font-bold text-slate-900">잘 된 틀 → 우리 제목 <span className="t-meta font-normal text-slate-500">구조만 가져오고 제목 · 대사는 새로</span></p>
                <ul className="flex flex-col gap-1.5">
                  {kit.frames.map((f) => (
                    <li key={f.pattern} className="flex min-w-0 flex-col gap-0.5 rounded-(--radius-control) bg-white px-3 py-2 ring-1 ring-slate-200" data-testid="radar-kit-frame" data-pattern={f.pattern}>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="t-meta rounded-full bg-slate-900 px-2 py-0.5 font-bold text-white">{f.label}</span>
                        <span className="t-meta break-keep text-slate-500">{f.note}</span>
                      </span>
                      {f.ref && (
                        <span className="t-meta line-clamp-2 break-keep text-slate-500 [overflow-wrap:anywhere]">
                          잘된 영상 · {f.ref.title} — {f.ref.channel}
                          {f.ref.ratio && <b className="font-semibold text-red-700"> · {f.ref.ratio}</b>}
                          {f.ref.short ? ' · 쇼츠' : ''}
                        </span>
                      )}
                      <span className="t-sub font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">→ {f.mine}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex min-w-0 flex-col gap-1.5" data-testid="radar-kit-titles">
              <p className="t-sub font-bold text-slate-900">제목 후보 · 썸네일</p>
              <ul className="flex flex-col gap-0.5">
                {kit.titles.map((t) => (
                  <li key={t} className="t-sub break-keep text-slate-800 [overflow-wrap:anywhere]">· {t}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-1.5">
                {kit.thumbs.map((t) => (
                  <span key={t} className="t-meta rounded-[6px] bg-slate-900 px-2 py-0.5 font-bold text-white">{t}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => onCopy(kitText(o, kit), '이번 주 찍을 것')} data-testid="radar-kit-copy">
              <ClipboardCopy aria-hidden="true" className="size-4" /> 전체 복사
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * [왜 추천됐나요?] — 추천 기준 다섯 가지(여러 채널 반복 · 평소보다 잘됨 · 늘어남 · 작은 채널 · 경제·경영·AI) 중
 * 이 후보에 맞는 것 · 아닌 것. 점수를 매기지 않는다(D-197).
 */
function WhyRecommended({ o }: { o: Opportunity }) {
  const [open, setOpen] = useState(false)
  const items = useMemo(() => whyRecommended(o), [o])
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} className="tap t-sub inline-flex items-center gap-1 self-start font-semibold text-slate-600 hover:text-slate-900" data-testid="radar-why-rec">
        <CircleHelp aria-hidden="true" className="size-4" /> 왜 추천됐나요?
        <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2.5" data-testid="radar-why-panel">
          <ul className="flex flex-col gap-1">
            {items.map((i) => (
              <li key={i.id} className="t-sub flex min-w-0 items-start gap-2 break-keep" data-testid="radar-why-item" data-id={i.id} data-met={i.met ? '1' : '0'}>
                {i.met ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-600" /> : <Minus aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />}
                <span className="min-w-0">
                  <span className={`font-semibold ${i.met ? 'text-slate-900' : 'text-slate-500'}`}>{i.label}</span>
                  <span className={i.met ? 'text-slate-700' : 'text-slate-500'}> — {i.text}</span>
                  <span className="sr-only">{i.met ? '(맞음)' : '(아직 아님)'}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="t-meta break-keep text-slate-500">점수를 매기지 않습니다 — 맞는 근거와 [추천 기준] 의 규칙으로 순서를 정합니다.</p>
        </div>
      )}
    </div>
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
        <p className="t-meta flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-600" data-testid="radar-evidence">
          <Peek videos={c.hits} title={o.topic} basis="최근 30일 관련 영상" kind="related">
            관련 영상 {c.videos30}편(30일)
          </Peek>
          <Peek videos={c.hits} title={o.topic} basis="최근 30일 관련 영상" kind="channels">
            채널 {c.channels30}곳
          </Peek>
          {c.breakouts > 0 && (
            <Peek videos={clusterHot(c)} title={o.topic} basis="평소보다 터진 영상(최근 30일)" kind="hot" className="font-semibold text-red-700">
              평소보다 터진 영상 {c.breakouts}편
            </Peek>
          )}
        </p>
        {c.coverage.length > 0 && (
          <p className="t-meta flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-600" data-testid="radar-coverage">
            <span className="text-slate-400">최근 {c.coverageDays === 14 ? '2주' : '30일'} 묶음별</span>
            {c.coverage.map((g) => (
              <Peek key={g.group} videos={coverageHits(c, g.group)} title={o.topic} basis={`${coverageLine(g)} · 최근 ${c.coverageDays === 14 ? '2주' : '30일'}`} kind="coverage">
                {coverageLine(g)}
              </Peek>
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
        <span className="font-bold text-slate-900">추천 접근 · {mkText(APPROACH_LABEL[o.approach])}</span> — {mkText(o.approachWhy)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {inNotebook ? (
          <span className="t-sub inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-success-700" data-testid="radar-saved">
            <BookmarkCheck aria-hidden="true" className="size-4" /> 내 콘텐츠에 있음
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
      <div className="flex flex-col gap-1.5" data-testid="radar-criteria-list">
        <p className="t-sub font-bold text-slate-900">이 레이더는 이렇게 고릅니다</p>
        <ol className="flex list-decimal flex-col gap-0.5 pl-5">
          <li className="t-sub break-keep text-slate-700">
            <span className="font-semibold text-slate-900">{WHY_LABEL.spread}</span> — 최근 2주 여러 채널이 같은 주제를 다뤘는지
          </li>
          <li className="t-sub break-keep text-slate-700">
            <span className="font-semibold text-slate-900">{WHY_LABEL.hot}</span> — 그 채널 평소(같은 롱폼/쇼츠 중앙값)보다 2배 넘게 잘됐는지 · 3배 넘으면 '터짐'(올린 지 7일 안 된 영상은 나이를 반영)
          </li>
          <li className="t-sub break-keep text-slate-700">
            <span className="font-semibold text-slate-900">{WHY_LABEL.growing}</span> — 그 전 6주보다 최근 2주에 빠르게 늘었는지
          </li>
          <li className="t-sub break-keep text-slate-700">
            <span className="font-semibold text-slate-900">{WHY_LABEL.small}</span> — 구독자 {shortNum(SMALL_CHANNEL_SUBS)} 이하 채널에서도 터졌는지
          </li>
          <li className="t-sub break-keep text-slate-700">
            <span className="font-semibold text-slate-900">{WHY_LABEL.domain}</span> — 메인 후보는 경제 · 경영 · AI 주제에서만. 그 밖에서 크게 터진 영상은 아래 '사이드 급상승' 에 따로(포맷 참고용)
          </li>
        </ol>
        <p className="t-meta break-keep text-slate-500">점수를 매기지 않습니다 — 신호 강함 = 최근 2주 3개 넘는 채널 + 터진 영상 · 신호 보통 = 2개 넘는 채널 + 늘어남이나 잘된 영상 · 그 밖은 초기 신호. 한 채널이 거의 다 올린 주제는 초기 신호까지만.</p>
      </div>
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
                title={mkText(AXIS_HINT[k])}
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

type Board = 'flow' | 'ai' | 'hot' | 'side' | 'all'
const BOARDS: Board[] = ['flow', 'ai', 'hot', 'side', 'all']
/** 고른 판은 이 기기에 기억 — '전부 보기' 를 고른 사람은 다음에도 예전처럼 한 화면에 */
const BOARD_KEY = 'axmvp.radar.board'
function readBoard(): Board {
  try {
    const v = localStorage.getItem(BOARD_KEY) as Board | null
    if (v && BOARDS.includes(v)) return v
  } catch {
    // 기억을 못 읽어도 첫 판으로
  }
  return 'flow'
}

function MarketSignals({ rising, breakouts, focus, noThumb, onOpenVideo }: { rising: RisingTopic[]; breakouts: RadarVideo[]; focus: FocusData; noThumb: boolean; onOpenVideo: (v: RadarVideo) => void }) {
  const [allRising, setAllRising] = useState(false)
  const [allBreakouts, setAllBreakouts] = useState(false)
  // D-227 한 번에 한 판 — 고르지 않은 판은 그리지 않는다(지운 것은 없다 · [전부 보기] 는 예전처럼 다 펼친다)
  const [board, setBoardState] = useState<Board>(readBoard)
  const setBoard = (b: Board) => {
    setBoardState(b)
    try {
      localStorage.setItem(BOARD_KEY, b)
    } catch {
      // 기억만 못 할 뿐 화면은 바뀐다
    }
  }
  const on = (b: Board) => board === b || board === 'all'
  const shownRising = allRising ? rising : rising.slice(0, SIGNAL_FIRST)
  const shown = useMemo(() => (allBreakouts ? breakouts : breakouts.slice(0, SIGNAL_FIRST)), [allBreakouts, breakouts])
  const flowN = focus.domains.reduce((n, d) => n + d.items.length, 0)
  const aiN = focus.aiKeywords.length
  const top = focus.domains.flatMap((d) => d.items).sort((a, b) => b.channels14 - a.channels14 || b.videos14 - a.videos14)[0]
  return (
    <Fold
      id="radar.signals"
      title="다음 후보 찾기 · 시장 신호"
      hint="지금 강한 흐름 · AI 키워드 · 급상승 · 터진 영상 · 사이드 급상승 — 다음 후보를 찾을 때 펼쳐 보세요. 한 번에 한 판씩 보여요."
      icon={<IconChip icon={BarChart3} tone="indigo" />}
      testId="radar-signals-fold"
      summary={
        <span className="flex flex-wrap items-center gap-1.5" data-testid="radar-signals-summary">
          {top && <span className="t-meta rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-800">가장 센 흐름 · {top.label}</span>}
          <span className="t-meta rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">흐름 {flowN}</span>
          <span className="t-meta rounded-full bg-violet-50 px-2 py-0.5 text-violet-800">AI 키워드 {aiN}</span>
          <span className="t-meta rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">급상승 {rising.length}</span>
          <span className="t-meta rounded-full bg-red-50 px-2 py-0.5 text-red-700">터진 영상 {breakouts.length}</span>
          {focus.side.length > 0 && <span className="t-meta rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">사이드 {focus.side.length}</span>}
        </span>
      }
    >
    <section className="flex flex-col gap-2.5" aria-labelledby="radar-signals-h" data-testid="radar-signals">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <HintTip tip={hintFor('시장 신호')} label="경제 · 경영 · AI 시장 신호">
          <h2 id="radar-signals-h" className="t-section flex items-center gap-2 font-extrabold break-keep text-slate-900">
            경제 · 경영 · AI 시장 신호
          </h2>
        </HintTip>
        <span className="t-meta break-keep text-slate-500" data-testid="radar-peek-hint">
          다음 후보를 찾는 곳 · 밑줄 친 숫자에 마우스를 올리면(휴대폰은 누르면) 그 영상이 바로 보입니다
        </span>
      </div>
      <MkPick
        label="볼 신호 고르기"
        testId="radar-board-pick"
        value={board}
        onChange={(k) => setBoard(k as Board)}
        options={[
          { key: 'flow', label: '지금 강한 흐름', hint: '경제 · 경영 · AI', icon: BarChart3, tone: 'indigo', badge: flowN },
          { key: 'ai', label: 'AI 핵심 키워드', hint: '회사별 · 업무 흐름', icon: Sparkles, tone: 'violet', badge: aiN },
          { key: 'hot', label: '급상승 · 터진 영상', hint: '2주 · 평소보다', icon: Flame, tone: 'red', badge: rising.length + breakouts.length },
          { key: 'side', label: '사이드 급상승', hint: '분야 밖 · 포맷 참고', icon: Zap, tone: 'amber', badge: focus.side.length },
          { key: 'all', label: '전부 보기', hint: '네 판을 한 화면에', icon: LayoutList, tone: 'slate' },
        ]}
        cols={5}
      />
      {on('flow') && <DomainBoard signals={focus.domains} />}
      {on('ai') && <AiKeywordBoard keywords={focus.aiKeywords} workflow={focus.workflow} fresh={focus.fresh} />}
      {on('hot') && (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex min-w-0 flex-col gap-2 rounded-(--radius-card) border border-emerald-100 bg-emerald-50/40 p-3 sm:p-4" data-testid="radar-rising">
          <HintTip tip={hintFor('급상승 주제')} label="급상승 주제">
            <h3 className="t-card flex items-center gap-2 font-bold text-slate-900">
              <IconChip icon={TrendingUp} tone="emerald" /> 급상승 주제
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
                    <Peek videos={r.recent} title={r.label} basis="최근 2주" kind="rising" className="t-meta text-slate-600">
                      2주 {r.videos14}편 · {r.channels14}채널
                    </Peek>
                    {r.growing && <Badge tone="brand">빠르게 늘어남</Badge>}
                    {r.breakouts > 0 && (
                      <Peek videos={r.hot} title={r.label} basis={r.fit ? '평소보다 터진 영상(최근 30일)' : '평소보다 터진 영상(최근 2주)'} kind="rising-hot">
                        <Badge tone="danger">터진 영상 {r.breakouts}</Badge>
                      </Peek>
                    )}
                    {!r.fit && <Badge>{mkText('MIRAE 분야 밖 · 참고')}</Badge>}
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
        <div className="flex min-w-0 flex-col gap-2 rounded-(--radius-card) border border-red-100 bg-red-50/30 p-3 sm:p-4" data-testid="radar-breakouts">
          <HintTip tip={hintFor('평소보다 터진 영상')} label="평소보다 터진 영상">
            <h3 className="t-card flex items-center gap-2 font-bold text-slate-900">
              <IconChip icon={Flame} tone="red" /> 평소보다 터진 영상
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
      )}
      {on('side') && <SideBreakouts items={focus.side} noThumb={noThumb} onOpenVideo={onOpenVideo} />}
    </section>
    </Fold>
  )
}
