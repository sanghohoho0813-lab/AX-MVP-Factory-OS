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
 * D-351 대표 "이번 주 이렇게 찍으세요를 내 브랜딩에 유리하게 — AI 주제는 AX 로, 정책자금 신청할 때 … 채널 설계 기준에 맞춰서":
 *  - 키트 맨 위 '내 본업으로 잇기' 칩(채널 설계 기준에서 읽은 본업) — AI 주제는 늘 본업으로 이어진 제목(틀별) · 첫 문장 · 이렇게 말해요(규칙).
 *  - [AI로 내 채널에 맞게 추천](두 번 눌러 확인) — 기준 전부 · 이 후보 · 고른 본업으로 AI 가 다시 쓴다. 규칙 추천 / AI 추천을 바꿔 본다.
 * D-616 대표 "이번 주 뜨는 주제 1~10위와 이번 주 찍을 것 1~10위가 똑같이 중복 — 뜨는 주제에 합치자":
 *  - 1~10위 목록은 '이번 주 뜨는 주제'(KeywordHome) 하나만. 줄마다 신호 세기 · 마우스를 올리면 근거 숫자(OppPeek) ·
 *    누르면 이 파일의 카드 내용 전부(OppBody — 이렇게 찍으세요는 펼친 채).
 *  - 이 판(PlanView · [자세히 보기] 안)에는 고르는 기준 · 숨긴 주제 · 이번 주 제작 예정 · 시장 신호만 남는다.
 */
import { useMemo, useState, useSyncExternalStore } from 'react'
import { Fold } from '../../../components/ui/fold'
import { MkPick } from '../../../tools/marketing/mkKit'
import { ArrowRight, BarChart3, BookmarkCheck, BookmarkPlus, CalendarCheck, Check, ChevronDown, CircleHelp, Clapperboard, ClipboardCopy, Clock, CloudOff, EyeOff, Flame, Info, LayoutList, Lightbulb, Minus, NotebookPen, RotateCcw, Settings2, Sparkles, TrendingUp, Zap } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/primitives'
import { HintTip } from '../../../components/ui/fold'
import { hintFor } from '../../../content/sectionHints'
import { shortNum } from '../../../services/marketing/ytBench'
import { IDEA_STATUS_LABEL, type ContentIdea, type IdeaStatus } from '../../../services/marketing/radarStore'
import { kitText, shootKit } from '../../../services/marketing/shootKit'
import { coreChoices, type BrandCore } from '../../../services/marketing/brandAngle'
import { kitCloudFailed, kitContext, kitError, kitKey, kitRunning, kitSaved, kitVersion, startKitAi, subscribeKit, type KitAi } from '../../../services/marketing/kitAi'
import { scriptContext, scriptKey, type KitScript } from '../../../services/marketing/kitScript'
import { KitScriptPanel } from './KitScriptPanel'
import { otherDeviceNote } from '../../../services/marketing/keyedSync'
import type { ChannelBrief } from '../../../services/marketing/radarStore'
import { weekStart } from '../../../services/marketing/weekPlan'
import { todayLocalDate } from '../../../lib/appClock'
import { AiConfirm } from '../../../components/ai/AiConfirm'
import { ModelPicker } from '../../../components/ai/ModelPicker'
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
import { AxisBadge, DomainBadge, IconChip, RatioChip, Thumb, VideoRow } from './RadarParts'
import { mkText } from '../../../services/marketing/persona'

/** 시장 신호 첫 화면 개수(나머지는 [더 보기]) */
const SIGNAL_FIRST = 4

export function PlanView({
  plan,
  rising,
  breakouts,
  focus,
  noAi = false,
  basis,
  ideas,
  readOnly,
  noThumb,
  onUnmute,
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
  /** D-564 대표가 아닌 계정이 AI 쪽 관심 분야를 고르지 않았을 때 — 시장 신호에서 AI 판을 뺀다 */
  noAi?: boolean
  basis: string
  ideas: readonly ContentIdea[]
  readOnly: boolean
  noThumb: boolean
  onUnmute: (key: string) => void
  onOpenVideo: (v: RadarVideo) => void
  onMix: (m: MixGuide) => void
  onGoChannels: () => void
  onGoNotebook: () => void
}) {
  const [criteria, setCriteria] = useState(false)
  const selected = useMemo(() => ideas.filter((i) => i.status === 'selected').slice(0, 3), [ideas])
  return (
    <div className="flex flex-col gap-6" data-testid="radar-plan">
      {/* D-616 대표 "이번 주 뜨는 주제 1~10위가 이번 주 찍을 것과 똑같이 중복 — 뜨는 주제에 합치자".
          예전: 여기에 '이번 주 찍을 것' 제목 · 길잡이(주제 고르기 → 확정 → 찍고 올리기) · 같은 1~10위 목록이 한 번 더.
          지금: 1~10위(이유 · 근거 · 찍는 법 · 확정)는 위 '이번 주 뜨는 주제' 줄을 누르면 — 여기에는 고르는 기준 · 숨긴 주제 · 제작 예정만. */}
      <section className="flex flex-col gap-2.5" aria-label="이번 주 뜨는 주제 — 고르는 기준" data-testid="radar-guide">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="t-sub min-w-0 flex-1 basis-64 break-keep text-slate-700" data-testid="radar-guide-next">
            <b className="font-bold text-slate-900">이번 주 뜨는 주제는</b> 참고 채널 최근 30일 영상에서 여러 채널이 함께 다루고 평소보다 잘된 것으로 골라요 — 주제마다 이유 · 제목 · 표지 글 · 찍는 법은 위 목록에서 그 주제를 누르면 펼쳐져요.
          </p>
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
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-slate-100 pt-2" data-testid="radar-selected">
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
        )}

        {plan.aiDataShort && (
          <p className="t-sub flex flex-wrap items-center gap-x-2 gap-y-1 rounded-(--radius-control) border border-slate-300 bg-slate-50 px-3 py-2 break-keep text-slate-700" data-testid="radar-ai-short">
            <Info aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
            <span className="min-w-0 flex-1">
              AI 참고 영상이 부족합니다 — {mkText(plan.aiChannels === 0 ? 'AI 실무 · AX 채널이 아직 없습니다.' : '최근 30일에 AI · 자동화 주제 영상이 거의 없습니다.')} {mkText('AX · AI 후보는 데이터가 쌓이면 나옵니다.')}
            </span>
            <button type="button" onClick={onGoChannels} className="tap t-sub font-semibold text-brand-700 hover:underline">
              채널 보기
            </button>
          </p>
        )}
      </section>

      <MarketSignals rising={rising} breakouts={breakouts} focus={focus} noThumb={noThumb} onOpenVideo={onOpenVideo} noAi={noAi} />
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

export interface BrandCtx {
  brief: ChannelBrief
  cores: readonly BrandCore[]
  /** AI 추천 단추를 보이나(대표 계정 · 팀장 화면 보기가 아닐 때) */
  ai: boolean
  /** 칩 — '' = 그대로 두기 */
  onCore: (key: string, core: string) => void
}

interface CardProps {
  o: Opportunity
  brand?: BrandCtx
  status: ReadonlyMap<string, IdeaStatus>
  readOnly: boolean
  noThumb: boolean
  onConfirm: (o: Opportunity) => void
  onSave: (o: Opportunity) => void
  onMute: (o: Opportunity) => void
  onCopy: (text: string, what?: string) => void
  onOpenVideo: (v: RadarVideo) => void
  /** D-558 AI 추천 제목 → 대본 → 내 보관함(내 콘텐츠) — 그 줄 주소(실패 · 취소면 null) */
  onKeepScript?: (o: Opportunity, kit: KitAi, s: KitScript, rank: number) => Promise<string | null>
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

/**
 * D-616 '이번 주 뜨는 주제' 줄 하나가 품는 것(KeywordHome 이 그린다 — 예전 D-613 '이번 주 찍을 것' 목록과 합침).
 *  - OppPeek: PC 마우스를 올리면 — 근거 숫자만(직접 경쟁 채널 몇 곳 · 평소보다 잘된 영상 몇 편) + 누르면 무엇이 펼쳐지는지 한 줄.
 *  - OppBody: 누르면 — 왜 지금 · 근거 · [이 주제로 글 · 대본 만들기] · [이번 주로 확정] · 이번 주 이렇게 찍으세요(제목 · 첫 문장 ·
 *    잘 된 틀 → 우리 제목 · 제목 후보 · 표지 글 — 처음부터 펼친 채) · 왜 추천됐나요 · 근거 보기(참고 영상 · 관심 없음).
 * 안의 칸 · 단추 · 시험 이름은 D-613 카드 그대로(radar-why · radar-fact · radar-confirm · radar-kit …).
 */
export type OppCard = Omit<CardProps, 'o'>

export function OppPeek({ o }: { o: Opportunity }) {
  return (
    <div className="flex flex-col gap-2" data-testid="mk-key-peek">
      {o.facts.length > 0 ? (
        <Facts o={o} size="sm" />
      ) : (
        o.summary && <p className="t-sub break-keep text-slate-700">{o.summary}</p>
      )}
      <p className="t-meta flex items-center gap-1 break-keep text-slate-600">
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" /> 누르면 왜 지금 · 제목 · 표지 글 · 찍는 법까지 펼쳐져요
      </p>
    </div>
  )
}

export function OppBody({ o, rank, card, onMake }: { o: Opportunity; rank: number; card: OppCard; onMake: () => void }) {
  const [more, setMore] = useState(false)
  const props: CardProps = { ...card, o }
  return (
    // 넓은 PC 는 두 칸 — 왼쪽: 왜 지금 · 근거 · 단추 · 왜 추천됐나요 · 근거 보기 / 오른쪽: 이번 주 이렇게 찍으세요(제목 · 표지 글). 휴대폰은 한 줄로 차례대로
    <div className="grid min-w-0 grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-x-8">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {rank === 1 && (
            <span className="t-meta rounded-full bg-slate-900 px-2.5 py-0.5 font-bold text-white" data-testid="radar-rank1">
              이번 주 1순위
            </span>
          )}
          <AxisBadge axis={o.axis} />
          <DomainBadge axis={o.axis} domain={o.domain} />
        </div>
        {o.summary && (
          <p className="t-sub break-keep text-slate-700" data-testid="radar-why">
            <span className="font-bold text-slate-900">왜 지금 · </span>
            {o.summary}
          </p>
        )}
        <Facts o={o} size="sm" />
        <div className="flex flex-wrap items-center gap-2">
          {/* 예전 이 줄을 한 번 누르면 바로 열리던 콘텐츠 묶음(제목 · 유튜브 대본 · 릴스 · 블로그 · 카드뉴스 · 올릴 때 글) */}
          <Button variant="primary" onClick={onMake} data-testid="mk-key-go">
            이 주제로 글 · 대본 만들기 <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
          <ConfirmButton {...props} quiet />
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
          <WhyRecommended o={o} />
          <div>
            <DetailsToggle open={more} onToggle={() => setMore((x) => !x)} />
          </div>
          {more && <Details {...props} />}
        </div>
      </div>
      <ShootBox o={o} onCopy={card.onCopy} brand={card.brand} size={rank === 1 ? 'lg' : 'sm'} rank={rank} readOnly={card.readOnly} onKeepScript={card.onKeepScript} defaultOpen flush />
    </div>
  )
}

/**
 * 이번 주 이렇게 찍으세요 — 한 상자(D-253) · D-296 처음엔 접힌 채(제목 줄만) · 누르면 아래 전부.
 * 대표: "미래AI랩 관점 · 찍기 키트가 두 상자로 길게 나와 눈에 안 띈다 — 이름을 바꿔 한 상자에 · 긴 영상 구성 · 쇼츠 3컷 ·
 *        그대로/바꿀 것 · 찍기 전 준비는 지우고 잘 된 틀 → 우리 제목 · 제목 후보 · 썸네일 · 제목 예 · 첫 문장만".
 * 늘 보이는 것: 이렇게 말해요(우리 각도) · 제목 예 · 첫 문장. 펼치면: 잘 된 틀 → 우리 제목 · 제목 후보 · 썸네일.
 */
function ShootBox({ o, onCopy, brand, size = 'sm', rank = 0, readOnly = false, onKeepScript, defaultOpen = false, flush = false }: { o: Opportunity; onCopy: (text: string, what?: string) => void; brand?: BrandCtx; size?: 'lg' | 'sm'; rank?: number; readOnly?: boolean; onKeepScript?: CardProps['onKeepScript']; defaultOpen?: boolean; flush?: boolean }) {
  const kit = useMemo(() => shootKit(o), [o])
  // D-296 처음엔 접힌 채(제목 줄 · 준비 시간만) — 누르면 안의 글이 펼쳐진다
  // D-616 뜨는 주제 줄을 눌러 연 판 안에서는 펼친 채로(대표 "누르면 제목 · 표지 글은 어떻게 할지 종합적으로") — 접기는 그대로
  const [open, setOpen] = useState(defaultOpen)
  const lg = size === 'lg'
  // D-351 AI 추천 — 이 후보 · 이번 주 · 화면 밖(모듈)에 남는다
  const kver = useSyncExternalStore(subscribeKit, kitVersion)
  const today = todayLocalDate()
  const key = kitKey(o, weekStart(today))
  const aiKit = useMemo(() => kitSaved(key), [key, kver]) // eslint-disable-line react-hooks/exhaustive-deps
  const aiBusy = kitRunning(key)
  const aiErr = kitError(key)
  const [tab, setTab] = useState<'rule' | 'ai' | null>(null)
  const showAi = !!aiKit && (tab ?? 'ai') === 'ai'
  const choices = useMemo(() => (brand ? coreChoices(o, brand.cores) : []), [o, brand])
  const askAi = () => {
    if (!brand) return
    const core = brand.cores.find((c) => c.id === o.brand?.core) ?? null
    startKitAi(key, kitContext(o, brand.brief, core, brand.cores, today), o.brand?.label ?? '')
    setTab('ai')
  }
  return (
    // D-603 후보 카드 안의 또 한 칸(테두리) → 카드 안 가는 선 아래 한 줄(박스 안 박스 줄이기)
    <section className={`flex min-w-0 flex-col gap-2.5 border-t border-slate-100 pt-3 ${flush ? 'lg:border-t-0 lg:pt-0' : ''}`} data-testid="radar-kit" data-open={open ? '1' : '0'} aria-label={`${o.topic} — 이번 주 이렇게 찍으세요`}>
      <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} className="tap flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-left" data-testid="radar-kit-toggle">
        <IconChip icon={Clapperboard} tone="rose" />
        <span className={`font-extrabold text-slate-900 ${lg ? 't-card' : 't-sub'}`}>이번 주 이렇게 찍으세요</span>
        <span className="t-meta inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-semibold text-slate-700 ring-1 ring-slate-200" data-testid="radar-kit-effort">
          <Clock aria-hidden="true" className="size-3.5" /> {kit.effort.label} · {kit.effort.minutes}분쯤
        </span>
        <span className="t-meta ml-auto inline-flex items-center gap-0.5 font-bold text-brand-700">
          {open ? '접기' : '펼치기'}
          <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="flex min-w-0 flex-col gap-2.5" data-testid="radar-kit-open">
          {brand && choices.length > 0 && (
            <div className="flex min-w-0 flex-col gap-1" data-testid="radar-kit-cores">
              <p className="t-meta font-bold text-slate-700">
                내 본업으로 잇기 <span className="font-normal text-slate-500">· 채널 설계 기준에서 — 누르면 제목 · 첫 문장이 그 본업으로</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {o.axis !== 'axai' && (
                  <CoreChip on={!o.brand} label="주제 그대로" onClick={() => brand.onCore(o.key, '')} id="" />
                )}
                {choices.map((c) => (
                  <CoreChip key={c.id} id={c.id} on={o.brand?.core === c.id} label={c.label} onClick={() => brand.onCore(o.key, c.id)} />
                ))}
              </div>
            </div>
          )}
          {brand?.ai && (
            <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-(--radius-control) bg-violet-50 px-2.5 py-2" data-testid="radar-kit-ai">
              <Sparkles aria-hidden="true" className="size-4 shrink-0 text-violet-700" />
              <span className="t-meta min-w-0 flex-1 basis-40 break-keep text-violet-950">
                {aiBusy ? 'AI 가 내 채널 기준으로 쓰는 중이에요(10~30초) — 다른 화면으로 가도 답은 남아요.' : aiKit ? `AI 추천이 있어요${aiKit.core ? ` · ${aiKit.core}` : ''}${otherDeviceNote(aiKit.device) ? ` · ${otherDeviceNote(aiKit.device)}` : ''}` : '규칙 추천이 아쉬우면 — 채널 설계 기준 전부로 AI 가 다시 써요(누를 때만).'}
              </span>
              {!aiBusy && <ModelPicker />}
              <AiConfirm>
                <Button size="sm" variant={aiKit ? 'secondary' : 'primary'} onClick={askAi} disabled={aiBusy} data-testid="radar-kit-ai-run">
                  {aiBusy ? <Clock aria-hidden="true" className="size-4" /> : <Sparkles aria-hidden="true" className="size-4" />}
                  {aiBusy ? '쓰는 중…' : aiKit ? 'AI로 다시 추천' : 'AI로 내 채널에 맞게 추천'}
                </Button>
              </AiConfirm>
              {aiErr && (
                <p role="alert" className="t-meta basis-full break-keep text-danger-700" data-testid="radar-kit-ai-error">
                  AI 추천을 받지 못했어요 — {aiErr}
                </p>
              )}
              {/* D-515 클라우드에 못 올림 — 연결되면 다시(평소에는 없음) */}
              {aiKit && !aiBusy && kitCloudFailed() && (
                <p role="status" className="t-meta flex basis-full items-center gap-1.5 break-keep text-slate-700" data-testid="radar-kit-cloud-failed">
                  <CloudOff aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
                  인터넷이 불안해 AI 추천을 이 기기에만 남겼어요 — 연결되면 다시 올려요.
                </p>
              )}
            </div>
          )}
          {aiKit && (
            <div className="flex gap-1" role="tablist" aria-label="추천 보기">
              {(['ai', 'rule'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={(tab ?? 'ai') === t} onClick={() => setTab(t)} className={`tap t-meta rounded-full px-3 font-bold ${(tab ?? 'ai') === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300'}`} data-testid="radar-kit-tab" data-tab={t}>
                  {t === 'ai' ? 'AI 추천' : '규칙 추천'}
                </button>
              ))}
            </div>
          )}
          {showAi && aiKit ? (
            <AiKitBlock k={aiKit} lg={lg} onCopy={onCopy} o={o} kitK={key} brief={brand?.brief} today={today} readOnly={readOnly} onKeep={onKeepScript ? (s) => onKeepScript(o, aiKit, s, rank) : undefined} />
          ) : (
          <>
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
              <span className="t-meta font-bold text-brand-700">제목 예 </span>
              <span className="font-bold">{kit.titles[0]}</span>
            </p>
            <Button size="sm" variant="ghost" onClick={() => onCopy(kit.titles[0] ?? '')} aria-label={`제목 복사 — ${kit.titles[0]}`}>
              <ClipboardCopy aria-hidden="true" className="size-4" /> 복사
            </Button>
          </div>
          <p className="t-sub break-keep text-slate-800 [overflow-wrap:anywhere]" data-testid="radar-kit-hook">
            <span className="t-meta font-bold text-brand-700">첫 문장 </span>"{kit.hook}"
          </p>
          <div className="flex min-w-0 flex-col gap-3 border-t border-slate-100 pt-3" data-testid="radar-kit-body">
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
              <p className="t-sub font-bold text-slate-900">제목 후보 · 표지 글(썸네일)</p>
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
          </>
          )}
        </div>
      )}
    </section>
  )
}

function CoreChip({ id, label, on, onClick }: { id: string; label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`tap t-meta rounded-full px-2.5 font-bold ${on ? 'bg-brand-600 text-white' : 'bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50'}`} data-testid="radar-kit-core" data-core={id} data-on={on ? '1' : '0'}>
      {label}
    </button>
  )
}

/**
 * D-351 AI 추천 — 이렇게 말해요 · 제목(틀별) · 첫 문장 · 썸네일 · 구성 · 전체 복사.
 * D-558 대표: "제목을 누르면 복사만 되는데 — 한 번 더 누르면 몇 분짜리인지 골라 대본까지, 그걸 보관함으로".
 *   제목 줄을 누르면 그 제목이 골라지고(파랑) 바로 아래 '이 제목으로 대본 만들기' 판이 열린다. 복사 아이콘은 그대로.
 */
function AiKitBlock({ k, lg, o, kitK, brief, today, readOnly, onCopy, onKeep }: { k: KitAi; lg: boolean; o: Opportunity; kitK: string; brief?: ChannelBrief; today: string; readOnly: boolean; onCopy: (text: string, what?: string) => void; onKeep?: (s: KitScript) => Promise<string | null> }) {
  const topic = o.topic
  const [picked, setPicked] = useState<number | null>(null)
  const text = [
    `[이번 주 이렇게 찍으세요 · AI 추천] ${topic}${k.core ? ` → ${k.core}` : ''}`,
    k.view ? `이렇게 말해요: ${k.view}` : '',
    `첫 문장: ${k.hook}`,
    '',
    '제목 후보',
    ...k.titles.map((t, i) => `${i + 1}. ${t.type ? `[${t.type}] ` : ''}${t.text}`),
    k.thumbs.length ? `썸네일 문구: ${k.thumbs.join(' / ')}` : '',
    ...(k.outline.length ? ['', '구성', ...k.outline.map((x) => `- ${x}`)] : []),
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const canScript = !!brief
  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-(--radius-control) bg-white px-3 py-2.5 ring-1 ring-violet-200" data-testid="radar-kit-ai-result">
      {k.view && (
        <p className={`min-w-0 break-keep text-slate-900 [overflow-wrap:anywhere] ${lg ? 'text-[1.0625rem] leading-relaxed' : 't-sub'}`}>
          <span className="t-meta mr-1 inline-flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 align-middle font-bold text-white">
            <Lightbulb aria-hidden="true" className="size-3.5" /> 이렇게 말해요
          </span>
          <span className="font-semibold">{k.view}</span>
        </p>
      )}
      <p className="t-sub break-keep text-slate-800 [overflow-wrap:anywhere]" data-testid="radar-kit-ai-hook">
        <span className="t-meta font-bold text-brand-700">첫 문장 </span>"{k.hook}"
      </p>
      {canScript && (
        <p className="t-meta break-keep text-slate-600" data-testid="radar-kit-ai-pickhint">
          제목을 누르면 → 몇 분짜리인지 고르고 → 대본까지 만들어 내 보관함에 담아요.
        </p>
      )}
      <ul className="flex flex-col gap-1" data-testid="radar-kit-ai-titles">
        {k.titles.map((t, i) => {
          const on = picked === i + 1
          return (
            <li key={t.text} className="flex min-w-0 flex-col gap-1.5">
              <div className="flex min-w-0 items-start gap-1.5">
                {canScript ? (
                  <button
                    type="button"
                    onClick={() => setPicked(on ? null : i + 1)}
                    aria-expanded={on}
                    className={`tap flex min-w-0 flex-1 items-start gap-1.5 rounded-(--radius-control) px-1.5 py-1 text-left hover:bg-slate-50 ${on ? 'ring-1 ring-brand-300' : ''}`}
                    data-testid="radar-kit-ai-title"
                    data-index={i + 1}
                    data-on={on ? '1' : '0'}
                  >
                    {t.type && <span className="t-meta mt-0.5 shrink-0 rounded-full bg-slate-900 px-2 py-0.5 font-bold text-white">{t.type}</span>}
                    <span className={`t-sub min-w-0 flex-1 font-semibold break-keep [overflow-wrap:anywhere] ${on ? 'text-brand-700' : 'text-slate-900'}`}>{t.text}</span>
                    <span className="t-meta mt-0.5 inline-flex shrink-0 items-center gap-0.5 font-bold text-brand-700">
                      {on ? '접기' : '대본'}
                      <ChevronDown aria-hidden="true" className={`size-3.5 transition-transform ${on ? 'rotate-180' : ''}`} />
                    </span>
                  </button>
                ) : (
                  <>
                    {t.type && <span className="t-meta mt-0.5 shrink-0 rounded-full bg-slate-900 px-2 py-0.5 font-bold text-white">{t.type}</span>}
                    <span className="t-sub min-w-0 flex-1 font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">{t.text}</span>
                  </>
                )}
                <Button size="sm" variant="ghost" onClick={() => onCopy(t.text)} aria-label={`제목 복사 — ${t.text}`}>
                  <ClipboardCopy aria-hidden="true" className="size-4" />
                </Button>
              </div>
              {on && brief && (
                <KitScriptPanel
                  sKey={scriptKey(kitK, i + 1)}
                  title={t.text}
                  titleType={t.type}
                  titleIndex={i + 1}
                  context={(minutes, request) => scriptContext({ o, kit: k, titleIndex: i + 1, minutes, brief, request, today })}
                  onCopy={onCopy}
                  onKeep={onKeep}
                  readOnly={readOnly}
                />
              )}
            </li>
          )
        })}
      </ul>
      {k.thumbs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {k.thumbs.map((t) => (
            <span key={t} className="t-meta rounded-[6px] bg-slate-900 px-2 py-0.5 font-bold text-white">{t}</span>
          ))}
        </div>
      )}
      {k.outline.length > 0 && (
        <details className="t-sub rounded-lg bg-slate-50 px-2.5 py-1.5">
          <summary className="sum-chev cursor-pointer font-semibold text-slate-800">구성 {k.outline.length}줄</summary>
          <ul className="mt-1 flex flex-col gap-0.5">
            {k.outline.map((x) => (
              <li key={x} className="break-keep text-slate-700 [overflow-wrap:anywhere]">· {x}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => onCopy(text, '이번 주 찍을 것(AI 추천)')} data-testid="radar-kit-ai-copy">
          <ClipboardCopy aria-hidden="true" className="size-4" /> 전체 복사
        </Button>
        {k.model && <span className="t-meta text-slate-500">{k.model}</span>}
      </div>
    </div>
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
              <Peek key={g.group} videos={coverageHits(c, g.group)} title={o.topic} basis={`${mkText(coverageLine(g))} · 최근 ${c.coverageDays === 14 ? '2주' : '30일'}`} kind="coverage">
                {mkText(coverageLine(g))}
              </Peek>
            ))}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-1.5">
        <p className="t-sub font-bold text-slate-900">참고 영상 {o.benchmarks.length > 0 && <span className="t-meta font-normal text-slate-500">평소보다 잘된 것만 · {o.benchmarks.length}편</span>}</p>
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
        <p className="t-sub font-bold text-slate-900">표지 글(썸네일)</p>
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
            <span className="font-semibold text-slate-900">{WHY_LABEL.hot}</span> — 그 채널 평소(같은 긴 영상/쇼츠의 보통 조회수)보다 2배 넘게 잘됐는지 · 3배 넘으면 '터짐'(올린 지 7일 안 된 영상은 나이를 반영)
          </li>
          <li className="t-sub break-keep text-slate-700">
            <span className="font-semibold text-slate-900">{WHY_LABEL.growing}</span> — 그 전 6주보다 최근 2주에 빠르게 늘었는지
          </li>
          <li className="t-sub break-keep text-slate-700">
            <span className="font-semibold text-slate-900">{WHY_LABEL.small}</span> — 구독자 {shortNum(SMALL_CHANNEL_SUBS)} 이하 채널에서도 터졌는지
          </li>
          <li className="t-sub break-keep text-slate-700">
            <span className="font-semibold text-slate-900">{WHY_LABEL.domain}</span> — 메인 후보는 경제 · 경영 · AI 주제에서만. 그 밖에서 크게 터진 영상은 아래 '사이드 급상승' 에 따로(형식 참고용)
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

function MarketSignals({ rising, breakouts, focus, noThumb, onOpenVideo, noAi = false }: { rising: RisingTopic[]; breakouts: RadarVideo[]; focus: FocusData; noThumb: boolean; onOpenVideo: (v: RadarVideo) => void; /** D-564 대표가 아닌 계정이 AI 쪽 관심 분야를 고르지 않았으면 AI 판 · AI 말을 그리지 않는다 */ noAi?: boolean }) {
  const [allRising, setAllRising] = useState(false)
  const [allBreakouts, setAllBreakouts] = useState(false)
  // D-227 한 번에 한 판 — 고르지 않은 판은 그리지 않는다(지운 것은 없다 · [전부 보기] 는 예전처럼 다 펼친다)
  const [boardRaw, setBoardState] = useState<Board>(readBoard)
  // D-564 AI 판을 안 그리는 계정이 예전에 AI 판을 골라 뒀으면 '지금 강한 흐름' 으로
  const board: Board = noAi && boardRaw === 'ai' ? 'flow' : boardRaw
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
      hint={noAi ? '지금 강한 흐름 · 급상승 · 터진 영상 · 사이드 급상승 — 다음 후보를 찾을 때 펼쳐 보세요. 한 번에 한 판씩 보여요.' : '지금 강한 흐름 · AI 키워드 · 급상승 · 터진 영상 · 사이드 급상승 — 다음 후보를 찾을 때 펼쳐 보세요. 한 번에 한 판씩 보여요.'}
      icon={<IconChip icon={BarChart3} tone="indigo" />}
      testId="radar-signals-fold"
      summary={
        <span className="flex flex-wrap items-center gap-1.5" data-testid="radar-signals-summary">
          {top && <span className="t-meta rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-800">가장 센 흐름 · {top.label}</span>}
          <span className="t-meta rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">흐름 {flowN}</span>
          {!noAi && <span className="t-meta rounded-full bg-violet-50 px-2 py-0.5 text-violet-800">AI 키워드 {aiN}</span>}
          <span className="t-meta rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">급상승 {rising.length}</span>
          <span className="t-meta rounded-full bg-red-50 px-2 py-0.5 text-red-700">터진 영상 {breakouts.length}</span>
          {focus.side.length > 0 && <span className="t-meta rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">사이드 {focus.side.length}</span>}
        </span>
      }
    >
    <section className="flex flex-col gap-2.5" aria-labelledby="radar-signals-h" data-testid="radar-signals">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <HintTip tip={hintFor('시장 신호')} label={noAi ? '경제 · 경영 시장 신호' : '경제 · 경영 · AI 시장 신호'}>
          <h2 id="radar-signals-h" className="t-section flex items-center gap-2 font-extrabold break-keep text-slate-900">
            {noAi ? '경제 · 경영 시장 신호' : '경제 · 경영 · AI 시장 신호'}
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
          { key: 'flow', label: '지금 강한 흐름', hint: noAi ? '경제 · 경영' : '경제 · 경영 · AI', icon: BarChart3, tone: 'indigo', badge: flowN },
          ...(noAi ? [] : [{ key: 'ai', label: 'AI 핵심 키워드', hint: '회사별 · 업무 흐름', icon: Sparkles, tone: 'violet' as const, badge: aiN }]),
          { key: 'hot', label: '급상승 · 터진 영상', hint: '2주 · 평소보다', icon: Flame, tone: 'red', badge: rising.length + breakouts.length },
          { key: 'side', label: '사이드 급상승', hint: '분야 밖 · 형식 참고', icon: Zap, tone: 'amber', badge: focus.side.length },
          { key: 'all', label: '전부 보기', hint: '네 판을 한 화면에', icon: LayoutList, tone: 'slate' },
        ]}
        cols={noAi ? 4 : 5}
      />
      {on('flow') && <DomainBoard signals={focus.domains} />}
      {!noAi && on('ai') && <AiKeywordBoard keywords={focus.aiKeywords} workflow={focus.workflow} fresh={focus.fresh} />}
      {on('hot') && (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex min-w-0 flex-col gap-2 rounded-(--radius-card) border border-slate-200 bg-white p-3 sm:p-4" data-testid="radar-rising">
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
        <div className="flex min-w-0 flex-col gap-2 rounded-(--radius-card) border border-slate-200 bg-white p-3 sm:p-4" data-testid="radar-breakouts">
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
