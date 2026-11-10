/**
 * 마케팅 · 브랜딩 목차 (D-231) — 대표 "마케팅 브랜딩을 누르면 바로 콘텐츠 레이더가 뜨고, 홍보 글 · 홈페이지도 분석 · 채널 옆에
 * 목차로 — 굳이 나눌 필요 없다".
 *  - 목차(D-560): 살펴보기 = 남의 인기 영상(인기 영상 · 참고 채널 · 올리는 때 · 길이 — 안에서 탭) · 내 콘텐츠 |
 *    만들기 = 유튜브(예전 '이번 주 찍을 것') · 스레드 · 릴스 · 틱톡(D-273) · 홍보 글 만들기 · 홈페이지 만들기.
 *  - 레이더 화면에서는 레이더 칸이 그 자리에서 바뀌고(onRadar), 홍보 글 · 홈페이지 화면에서는 레이더 칸이 /marketing 으로 간다.
 *  - 홍보 글 · 홈페이지 도구는 주소 · 화면이 그대로(웹 스튜디오 도구 줄 · 업체 상세 입구도 그대로) — 목차만 같은 줄에 둔다.
 *  - 마케팅 · 브랜딩은 대표 전용 — 팀장(Pilot) · 팀장 화면으로 볼 때는 도구 화면에 이 줄을 그리지 않는다.
 * D-295 대표가 준 아이콘(마케팅 한 장 — config/iconSlots 'mk-*'): 찍을 것 = YouTube · 스레드 = Threads · 릴스 · 틱톡 = Reels · TikTok ·
 *   블로그 · 플레이스 = 블로그 실제 로고, 나머지(인기 · 채널 · 분석 · 내 콘텐츠 · 홈페이지)는 입체 아이콘. 여러 색 그림이라 흰 칸 위에 그린다.
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AtSign, BarChart3, ChevronDown, ChevronUp, Clapperboard, Film, Flame, Globe, Home, NotebookPen, PenLine, Tv, type LucideIcon } from 'lucide-react'
import { useIsPilot } from '../../auth/osAccess'
import { usePilotMarketingScreens } from '../../config/pilotMarketing'
import { slotIcon } from '../../config/iconSlots'
import { MARKETING_GUIDE_KEYS } from '../../content/menuGuide'

export type RadarView = 'plan' | 'top' | 'channels' | 'analysis' | 'make'
export type MarketingTab = RadarView | 'threads' | 'shorts' | 'content' | 'homepage'

interface Item {
  key: MarketingTab
  label: string
  short: string
  icon: LucideIcon
  /** D-239 넓은 화면에서 이름 아래 작은 글 */
  sub?: string
}

// D-507 대표 "60대 이상도 처음 딱 봐도" — 칸 이름은 쉬운 말(인기 영상 · 참고 채널 · 올리는 때 · 길이) · 열쇠(key) · 시험 이름은 그대로
// D-560 대표(2026-11-09) "이번 주 찍을 것 이름을 유튜브로 바꾸고 스레드 옆에 · 인기 영상 ~ 나머지도 합칠 수 있으면 합쳐도 좋아"
//  - plan = '유튜브'(만들기 줄 맨 앞, 스레드 옆) · 인기 영상 · 참고 채널 · 올리는 때 · 길이 = 살펴보기 한 칸 '남의 인기 영상'(안에서 탭 셋)
//  - 열쇠(view · key) · 주소(?view=) · 시험 이름(yt-view-*)은 그대로 — 화면 이름 · 경로 줄은 아래 이름표를 쓴다
export const RADAR_VIEWS: Item[] = [
  { key: 'plan', label: '유튜브', short: '유튜브', sub: '(긴 영상 · 이번 주 주제)', icon: slotIcon('mk-plan', Clapperboard) },
  { key: 'top', label: '인기 영상', short: '인기 영상', icon: slotIcon('mk-top', Flame) },
  { key: 'channels', label: '참고 채널', short: '참고 채널', icon: slotIcon('mk-channels', Tv) },
  { key: 'analysis', label: '올리는 때 · 길이', short: '분석', icon: slotIcon('mk-analysis', BarChart3) },
  { key: 'make', label: '내 콘텐츠', short: '내 콘텐츠', sub: '(만든 것 모음)', icon: slotIcon('mk-make', NotebookPen) },
]
/** D-560 '남의 인기 영상' 한 칸에 묶인 화면 셋(안에서 탭) */
export const LOOK_VIEWS: readonly RadarView[] = ['top', 'channels', 'analysis']
export const isLookView = (v: MarketingTab | null) => !!v && (LOOK_VIEWS as readonly string[]).includes(v)
const PLAN_ITEM = RADAR_VIEWS[0]
/** 살펴보기 줄 — 남의 인기 영상(셋을 한 칸) · 내 콘텐츠 */
const LOOK_ITEMS: Item[] = [
  { key: 'top', label: '남의 인기 영상', short: '인기 영상', sub: '(인기 영상 · 참고 채널 · 올리는 때)', icon: slotIcon('mk-top', Flame) },
  RADAR_VIEWS[4],
]
/** 목차 칸이 켜졌나 — '남의 인기 영상' 은 안의 세 화면 어디서든 켜짐 */
const isOn = (key: MarketingTab, active: MarketingTab | null) => (key === 'top' ? isLookView(active) : active === key)
const TOOLS: Array<Item & { to: string; on: string }> = [
  // D-273 대표 "쓰레드는 원래 없던 부분 — 기능을 잘 만들어 달라" — 실측 공식 틀 23가지 · 규칙 검사 · 기록표
  { key: 'threads', label: '스레드', short: '스레드', sub: '(짧은 글 SNS · 틀 23가지 · 기록표)', icon: slotIcon('mk-threads', AtSign), to: '/marketing/threads', on: 'from-slate-800 to-slate-950' },
  // D-273 대표 "릴스 틱톡 파트도 따로" — 숏폼 실측 공식 · 형식 5 · 대본 · 기록표
  { key: 'shorts', label: '릴스 · 틱톡', short: '릴스 · 틱톡', sub: '(1분 세로 영상 대본 · 기록표)', icon: slotIcon('mk-shorts', Film), to: '/marketing/shorts', on: 'from-pink-600 to-orange-500' },
  // D-239 대표 "홍보 글 만들기 이름이 별로 — 블로그 · 플레이스 홍보 글 만들기, 아래에 (키워드 · 플레이스 · 블로그 등)"
  { key: 'content', label: '블로그 · 플레이스 홍보 글 만들기', short: '블로그 · 플레이스', sub: '(키워드 · 플레이스 · 블로그 등)', icon: slotIcon('mk-content', PenLine), to: '/tools/content', on: 'from-violet-700 to-fuchsia-700' },
  { key: 'homepage', label: '홈페이지 만들기', short: '홈페이지', sub: '(업체 소개 한 장 · 내려받기)', icon: slotIcon('mk-homepage', Globe), to: '/tools/homepage', on: 'from-emerald-700 to-teal-700' },
]

/*
 * D-478 대표 "마케팅 · 브랜딩 — 돈 받고 팔아도 될 만큼" — 휴대폰에서 목차가 첫 화면의 절반(약 250px · 아이콘 위 · 글자 아래 두 줄 9칸)을 먹었다.
 *  - 휴대폰(sm 아래): 한 줄 가로 넘김 띠(칸마다 아이콘 + 짧은 이름 · 지금 화면은 파란 테두리 · 처음 열 때 지금 칸이 보이게 띠를 옮긴다).
 *    두 묶음(콘텐츠 레이더 · 만들기)은 띠 안 작은 이름표로 — 묶음 칸은 display: contents 로 풀어 한 줄에 둔다(같은 단추 하나 — 시험 이름 · 순서 그대로).
 *  - PC(sm 이상): 예전 두 줄 그대로(위 레이더 · 아래 만들기 칸 — D-282 · D-354).
 */
const cls = (on: boolean) =>
  `tap t-sub inline-flex min-h-11 shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-[10px] border px-2.5 py-1 text-center leading-tight font-semibold whitespace-nowrap sm:min-w-max sm:flex-auto sm:flex-row sm:gap-1.5 sm:rounded-[8px] sm:border-transparent sm:px-3 sm:py-2 ${on ? 'border-brand-500 bg-white text-brand-700 ring-2 ring-brand-100 sm:bg-brand-50 sm:ring-1 sm:ring-brand-200' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`

/** D-282 만들기 칸 — 흰 칸 + 형식 색 아이콘. 지금 화면이면 테두리 강조 */
const makeCls = (on: boolean) =>
  `tap t-sub flex min-h-11 shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-[10px] border px-2.5 py-1 leading-tight font-semibold whitespace-nowrap sm:min-h-12 sm:min-w-0 sm:shrink sm:flex-row sm:justify-start sm:gap-2 sm:rounded-(--radius-control) sm:px-2.5 sm:py-1.5 sm:whitespace-normal sm:break-keep ${on ? 'border-brand-500 bg-white text-slate-900 ring-2 ring-brand-100' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200'}`

/** 휴대폰 띠 안 묶음 이름표 · PC 왼쪽 이름 칸 · D-511 첫 화면(home)은 휴대폰에서 한 줄 머리 */
function GroupLabel({ long, short, home }: { long: string; short: string; home?: boolean }) {
  return (
    <span className={`t-meta flex shrink-0 items-center font-semibold whitespace-nowrap text-slate-500 sm:w-[6.5rem] ${home ? 'max-sm:basis-full max-sm:pt-1 max-sm:text-[0.9375rem] max-sm:text-slate-700' : 'max-sm:snap-start max-sm:px-1 max-sm:text-[0.6875rem]'}`}>
      <span className="sm:hidden">{short}</span>
      <span className="max-sm:hidden">{long}</span>
    </span>
  )
}

function Label({ it }: { it: Item }) {
  const Icon = it.icon
  return (
    <>
      {/* D-295 여러 색 아이콘 — 빨간 칸(지금 화면)에서도 보이게 흰 칸 위에 · 칸을 넘지 않게 그대로 크기(--icon-art-scale 1) */}
      <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white [--icon-art-scale:1] sm:size-7">
        <Icon aria-hidden="true" className="size-5 shrink-0 sm:size-6" />
      </span>
      <span className="lg:hidden">{it.short}</span>
      {it.sub ? (
        <span className="hidden flex-col items-start leading-tight lg:flex">
          <span>{it.label}</span>
          <span className="t-meta font-normal opacity-80">{it.sub}</span>
        </span>
      ) : (
        <span className="hidden lg:inline">{it.label}</span>
      )}
    </>
  )
}

/** 만들기 칸 안 — 형식 색 아이콘 + 이름(넓으면 아래 작은 설명) */
function MakeLabel({ it }: { it: Item }) {
  return (
    <>
      <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-white [--icon-art-scale:1] sm:size-9">
        <it.icon className="size-5 sm:size-8" />
      </span>
      <span className="min-w-0 text-center sm:text-left">
        <span className="lg:hidden">{it.short}</span>
        <span className="hidden min-w-0 flex-col leading-tight lg:flex">
          <span className="truncate">{it.label}</span>
          {it.sub && <span className="t-meta truncate font-normal text-slate-500">{it.sub}</span>}
        </span>
      </span>
    </>
  )
}

/** onRadar 가 있으면(레이더 화면) 레이더 칸은 그 자리에서 바꾼다 — 예전 시험 이름(yt-view-*) 그대로 */
/** D-511 첫 화면 목록 — 휴대폰에서 띠(옆으로 넘김) 대신 두 칸씩 다 보이게 */
const HOME_CELL = 'max-sm:grow max-sm:basis-[calc((100%-0.375rem)/2)]'

export function MarketingTabs({ active, onRadar, home = false }: { active: MarketingTab | null; onRadar?: (v: RadarView) => void; home?: boolean }) {
  // MK-SIMPLE(D-553) 첫 화면(살펴보기 · 만들기 목록)만 예전 큰 목록 — 나머지 화면은 얇은 한 줄(PC) · '다른 화면' 판(휴대폰)
  return home ? <BigTabs active={active} onRadar={onRadar} home /> : <SlimTabs active={active} onRadar={onRadar} />
}

function BigTabs({ active, onRadar, home = false }: { active: MarketingTab | null; onRadar?: (v: RadarView) => void; home?: boolean }) {
  const pilot = useIsPilot()
  // SAAS-2 서버가 마케팅을 연 고객 계정 — 레이더 · 스레드 · 릴스/틱톡까지(홍보 글 · 홈페이지는 1차 상품 정리 전까지 닫힘)
  const open = usePilotMarketingScreens()
  const strip = useRef<HTMLDivElement>(null)
  // D-478 휴대폰 띠 — 처음 열 때 지금 칸이 화면 안에 오게(띠만 옮긴다 · 화면은 그대로)
  useEffect(() => {
    const el = strip.current
    if (!el || el.scrollWidth <= el.clientWidth + 1) return
    const on = el.querySelector<HTMLElement>('[aria-selected="true"], [aria-current="page"]')
    if (!on) return
    const left = on.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft
    el.scrollLeft = Math.max(0, left - (el.clientWidth - on.offsetWidth) / 2)
  }, [active])
  // 도구 화면에서 마케팅이 닫힌 팀장(Pilot)에게는 그리지 않는다
  if (pilot && !open && !onRadar) return null
  const tools = pilot ? TOOLS.filter((t) => t.key === 'threads' || t.key === 'shorts') : TOOLS
  const showTools = !pilot || open
  // D-560 유튜브(plan)는 만들기 줄 맨 앞 — 만들기 줄이 없는 화면(마케팅이 닫힌 팀장)은 살펴보기 줄에
  const lookItems = showTools ? LOOK_ITEMS : [PLAN_ITEM, ...LOOK_ITEMS]
  /*
   * D-282 두 줄 — 위: 콘텐츠 레이더 보기(그 자리에서 바뀜) · 아래: 만들기(형식마다 색 아이콘 칸). 예전 한 줄은 넓은 화면에서도 두 줄로 어색하게 접혔다.
   * 칸 순서 · 시험 이름 · 주소는 그대로(찍을 것 · 인기 · 채널 · 분석 · 내 콘텐츠 → 스레드 · 릴스 · 틱톡 · 홍보 글 · 홈페이지).
   */
  return (
    <nav aria-label="마케팅 · 브랜딩 목차" data-testid="mk-tabs">
      <div ref={strip} data-testid="mk-tabs-strip" data-home={home ? '1' : undefined} className={`flex gap-1.5 sm:flex-col sm:gap-2 ${home ? 'max-sm:flex-wrap' : 'max-sm:snap-x max-sm:overflow-x-auto max-sm:pb-1 max-sm:[scrollbar-width:none]'}`}>
        <div className="max-sm:contents sm:flex sm:flex-row sm:items-center sm:gap-2">
          {/* D-507 '콘텐츠 레이더' → 쉬운 말 '살펴보기'(남의 인기 영상을 보고 고른다) */}
          <GroupLabel long="살펴보기" short="살펴보기" home={home} />
          <div className="max-sm:contents sm:flex sm:min-w-0 sm:flex-1 sm:flex-wrap sm:gap-1 sm:rounded-(--radius-control) sm:border sm:border-slate-200 sm:bg-white sm:p-1">
            {lookItems.map((it) =>
              onRadar ? (
                <button key={it.key} type="button" role="tab" aria-selected={isOn(it.key, active)} data-testid={`yt-view-${it.key}`} data-guide={MARKETING_GUIDE_KEYS[it.key]} onClick={() => onRadar(it.key as RadarView)} className={`${cls(isOn(it.key, active))} ${home ? HOME_CELL : ''}`}>
                  <Label it={it} />
                </button>
              ) : (
                <Link key={it.key} to={`/marketing?view=${it.key}`} className={`${cls(false)} ${home ? HOME_CELL : ''}`} data-testid={`mk-tab-${it.key}`} data-guide={MARKETING_GUIDE_KEYS[it.key]}>
                  <Label it={it} />
                </Link>
              ),
            )}
          </div>
        </div>
        {showTools && (
          <div className="max-sm:contents sm:flex sm:flex-row sm:items-center sm:gap-2">
            {!home && <span aria-hidden="true" className="w-px shrink-0 self-stretch bg-slate-200 sm:hidden" />}
            <GroupLabel long="만들기" short="만들기" home={home} />
            {/* D-354 넓은 화면 4칸은 칸이 좁아 이름 · 설명이 서너 줄로 접혔다 — 칸 폭(@container)이 넉넉할 때만 4칸, 아니면 2칸에 한 줄씩 */}
            <div className="max-sm:contents sm:@container sm:min-w-0 sm:flex-1">
              <div className={`max-sm:contents sm:grid sm:min-w-0 sm:gap-1.5 ${tools.length < TOOLS.length ? 'sm:grid-cols-3' : 'sm:grid-cols-3 sm:@[70rem]:grid-cols-5'}`}>
                {/* D-560 유튜브(이번 주 주제 → 긴 영상 대본) — 스레드 옆, 레이더 화면에서는 그 자리에서 바뀐다(yt-view-plan) */}
                {onRadar ? (
                  <button type="button" role="tab" aria-selected={active === 'plan'} onClick={() => onRadar('plan')} className={`${makeCls(active === 'plan')} ${home ? HOME_CELL : ''}`} data-testid="yt-view-plan" data-guide="mk-plan">
                    <MakeLabel it={PLAN_ITEM} />
                  </button>
                ) : (
                  <Link to="/marketing?view=plan" className={`${makeCls(false)} ${home ? HOME_CELL : ''}`} data-testid="mk-tab-plan" data-guide="mk-plan">
                    <MakeLabel it={PLAN_ITEM} />
                  </Link>
                )}
                {tools.map((it) => (
                  <Link key={it.key} to={it.to} aria-current={active === it.key ? 'page' : undefined} className={`${makeCls(active === it.key)} ${home ? HOME_CELL : ''}`} data-testid={`mk-tab-${it.key}`} data-guide={MARKETING_GUIDE_KEYS[it.key]}>
                    <MakeLabel it={it} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

/*
 * MK-SIMPLE(D-553) 대표 "60대 컨설턴트가 써도 이해되게 — 너무 복잡한 곳은 간편하게" — 화면마다 맨 위 큰 목록(두 줄 · 칸마다 설명 · PC 약 200px ·
 * 휴대폰은 옆으로 미는 띠)이 일보다 먼저 자리를 차지했다. 첫 화면(살펴보기 · 만들기 목록)만 큰 목록으로 두고, 나머지 화면은:
 *  - PC: 얇은 한 줄 — [⌂ 처음] · 살펴보기 다섯 · 만들기 넷(아이콘 + 짧은 이름 · 지금 화면은 파란 칸). 좁으면 두 줄로 접힌다.
 *  - 휴대폰: [⌂ 처음] · 지금 화면 이름 · [다른 화면 ▾] — 누르면 아래로 두 칸씩 전부(묶음 이름과 함께). 옆으로 밀어 찾지 않는다.
 * 칸 순서 · 시험 이름(yt-view-* · mk-tab-*) · 주소는 그대로 — 같은 단추 하나를 PC · 휴대폰이 함께 쓴다.
 */
const slimCls = (on: boolean) =>
  `tap t-sub inline-flex shrink-0 items-center gap-1.5 border font-semibold whitespace-nowrap max-sm:min-h-12 max-sm:w-full max-sm:justify-start max-sm:rounded-(--radius-control) max-sm:px-3 sm:min-h-10 sm:rounded-full sm:px-3 ${on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-slate-50'}`

function SlimIcon({ it }: { it: Item }) {
  const Icon = it.icon
  return (
    <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white [--icon-art-scale:1]">
      <Icon aria-hidden="true" className="size-5 shrink-0" />
    </span>
  )
}

function SlimTabs({ active, onRadar }: { active: MarketingTab | null; onRadar?: (v: RadarView) => void }) {
  const pilot = useIsPilot()
  const open = usePilotMarketingScreens()
  const [more, setMore] = useState(false)
  // 다른 화면으로 옮기면 휴대폰 판은 닫는다
  useEffect(() => setMore(false), [active])
  if (pilot && !open && !onRadar) return null
  const tools = pilot ? TOOLS.filter((t) => t.key === 'threads' || t.key === 'shorts') : TOOLS
  const showTools = !pilot || open
  const now = [...RADAR_VIEWS, ...TOOLS].find((t) => t.key === active) ?? null
  const planBtn = onRadar ? (
    <button type="button" role="tab" aria-selected={active === 'plan'} data-testid="yt-view-plan" data-guide="mk-plan" onClick={() => onRadar('plan')} className={slimCls(active === 'plan')}>
      <SlimIcon it={PLAN_ITEM} />
      {PLAN_ITEM.label}
    </button>
  ) : (
    <Link to="/marketing?view=plan" className={slimCls(false)} data-testid="mk-tab-plan" data-guide="mk-plan">
      <SlimIcon it={PLAN_ITEM} />
      {PLAN_ITEM.label}
    </Link>
  )
  const homeLink = (phone: boolean) => (
    <Link
      to="/marketing"
      className={phone ? 'tap t-sub inline-flex min-h-11 shrink-0 items-center gap-1 rounded-(--radius-control) border border-slate-200 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50' : slimCls(false)}
      data-testid={phone ? 'mk-home-link-m' : 'mk-home-link'}
    >
      <Home aria-hidden="true" className="size-4 shrink-0" />
      {phone ? '처음' : '마케팅 처음으로'}
    </Link>
  )
  const groupHead = (title: string, sub: string) => (
    <p className="t-sub col-span-2 pt-1 font-semibold break-keep text-slate-700 sm:hidden">
      {title} <span className="font-normal text-slate-600">— {sub}</span>
    </p>
  )
  return (
    <nav aria-label="마케팅 · 브랜딩 목차" data-testid="mk-tabs" data-slim="1" className="flex flex-col gap-2">
      {/* 휴대폰 — 처음 · 지금 화면 · 다른 화면 */}
      <div className="flex items-center gap-2 sm:hidden" data-testid="mk-tabs-phone">
        {homeLink(true)}
        <span className="t-sub flex min-w-0 flex-1 items-center gap-1.5 font-bold text-slate-900" data-testid="mk-tabs-now">
          {now && <SlimIcon it={now} />}
          <span className="min-w-0 leading-tight break-keep">{now ? (TOOLS.some((t) => t.key === now.key) ? now.short : now.label) : '마케팅'}</span>
        </span>
        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore((v) => !v)}
          className="tap t-sub inline-flex min-h-11 shrink-0 items-center gap-1 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50"
          data-testid="mk-tabs-more"
        >
          다른 화면
          {more ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
        </button>
      </div>
      {/* PC — 두 줄(살펴보기 · 만들기, 칸마다 아이콘 + 짧은 이름) · 휴대폰 — [다른 화면] 을 누르면 두 칸씩(묶음 이름과 함께) */}
      <div
        data-testid="mk-tabs-strip"
        className={`${more ? 'max-sm:grid' : 'max-sm:hidden'} grid-cols-2 gap-2 rounded-(--radius-control) border border-slate-200 bg-white p-2 sm:flex sm:flex-col sm:gap-1.5 sm:border-0 sm:bg-transparent sm:p-0`}
      >
        <div className="max-sm:contents sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
          {groupHead('살펴보기', '남의 인기 영상을 보고 고르기')}
          <span className="t-sub w-[4.5rem] shrink-0 font-semibold text-slate-600 max-sm:hidden">살펴보기</span>
          {!showTools && planBtn}
          {LOOK_ITEMS.map((it) =>
            onRadar ? (
              <button key={it.key} type="button" role="tab" aria-selected={isOn(it.key, active)} data-testid={`yt-view-${it.key}`} data-guide={MARKETING_GUIDE_KEYS[it.key]} onClick={() => onRadar(it.key as RadarView)} className={slimCls(isOn(it.key, active))}>
                <SlimIcon it={it} />
                {it.label}
              </button>
            ) : (
              <Link key={it.key} to={`/marketing?view=${it.key}`} className={slimCls(false)} data-testid={`mk-tab-${it.key}`} data-guide={MARKETING_GUIDE_KEYS[it.key]}>
                <SlimIcon it={it} />
                {it.label}
              </Link>
            ),
          )}
        </div>
        <div className="max-sm:contents sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
          {showTools && (
            <>
              {groupHead('만들기', '우리 글 · 대본 · 홈페이지 만들기')}
              <span className="t-sub w-[4.5rem] shrink-0 font-semibold text-slate-600 max-sm:hidden">만들기</span>
              {planBtn}
              {tools.map((it) => (
                <Link key={it.key} to={it.to} aria-current={active === it.key ? 'page' : undefined} className={slimCls(active === it.key)} data-testid={`mk-tab-${it.key}`} data-guide={MARKETING_GUIDE_KEYS[it.key]}>
                  <SlimIcon it={it} />
                  {it.short}
                </Link>
              ))}
            </>
          )}
          <span className="max-sm:hidden sm:ml-auto">{homeLink(false)}</span>
        </div>
      </div>
    </nav>
  )
}

/**
 * D-560 '남의 인기 영상' 안쪽 탭 — 인기 영상 · 참고 채널 · 올리는 때 · 길이(예전 목차 세 칸).
 * 시험 이름은 예전 목차 그대로(yt-view-channels · yt-view-analysis) · 인기 영상은 목차 칸(yt-view-top)과 겹치지 않게 yt-sub-top.
 */
export function LookTabs({ view, onPick }: { view: RadarView; onPick: (v: RadarView) => void }) {
  const items = RADAR_VIEWS.filter((it) => isLookView(it.key))
  return (
    <div role="tablist" aria-label="남의 인기 영상 — 볼 것 고르기" className="grid grid-cols-3 gap-1 rounded-(--radius-control) bg-slate-100 p-1" data-testid="yt-look-tabs">
      {items.map((it) => {
        const on = view === it.key
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onPick(it.key as RadarView)}
            className={`tap t-sub inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-[8px] px-1 text-center leading-tight font-semibold break-keep ${on ? 'bg-white text-brand-700 shadow-(--shadow-card) ring-2 ring-brand-200' : 'text-slate-600 hover:bg-white/70'}`}
            data-testid={it.key === 'top' ? 'yt-sub-top' : `yt-view-${it.key}`}
          >
            <span className="max-sm:hidden">
              <SlimIcon it={it} />
            </span>
            <span className="min-w-0">{it.key === 'analysis' ? <><span className="sm:hidden">올리는 때</span><span className="max-sm:hidden">{it.label}</span></> : it.label}</span>
          </button>
        )
      })}
    </div>
  )
}
