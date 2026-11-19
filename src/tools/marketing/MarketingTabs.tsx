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
import { useEffect, useState } from 'react'
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
 * 첫 화면(/marketing) 큰 목록 — 살펴보기 · 만들기 두 묶음.
 *  - D-478 · D-511 휴대폰: 묶음 이름 한 줄 + 두 칸씩(아이콘 위 · 짧은 이름 아래) — 옆으로 밀어 찾지 않는다.
 *  - D-636 대표(2026-11-18) "휴대폰에서는 유튜브 · 스레드 박스 모양이 괜찮은데 PC 에서는 정사각형에 가까운 직사각형이었으면" —
 *    PC 도 휴대폰과 같은 모양(아이콘 위 · 이름 아래)으로, 4:3 칸에. 예전 PC 는 넓고 납작한 가로 띠(살펴보기 한 판 · 만들기 3칸)였다.
 *    · 칸 폭은 9.5rem 안팎 — 넓은 화면에서 띠처럼 늘어나지 않게 칸 수를 늘린다(남는 자리는 비워 둔다).
 *    · 두 묶음이 같은 칸 폭을 쓴다(위아래 칸이 줄 맞춤). 묶음 이름은 칸 위 한 줄(휴대폰과 같게).
 *  - 칸 순서 · 시험 이름(yt-view-* · mk-tab-*) · 주소 · 안내 열쇠(data-guide)는 그대로.
 * D-627 칸 아래 작은 설명(sub)은 화면에 늘 깔지 않는다 — 그 칸이 무엇인지는 마우스를 올리면 뜨는 메뉴 안내 카드(data-guide)가 말한다.
 */
/** D-511 휴대폰 — 두 칸씩 다 보이게 */
const HOME_CELL = 'max-sm:grow max-sm:basis-[calc((100%-0.375rem)/2)]'
const HOME_GRID = 'max-sm:contents sm:grid sm:w-full sm:min-w-0 sm:grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] sm:gap-2.5'
const homeCls = (on: boolean) =>
  `tap t-sub flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[10px] border px-2.5 py-1 text-center leading-tight font-semibold whitespace-nowrap ${HOME_CELL} sm:aspect-[4/3] sm:gap-2.5 sm:rounded-xl sm:px-3 sm:py-3 sm:whitespace-normal sm:break-keep ${on ? 'border-brand-500 bg-white text-slate-900 ring-2 ring-brand-100' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-slate-50'}`

/** 묶음 이름 — 휴대폰 · PC 모두 칸 위 한 줄 */
function GroupLabel({ children }: { children: string }) {
  return <span className="t-meta flex shrink-0 items-center text-[0.9375rem] font-semibold whitespace-nowrap text-slate-700 max-sm:basis-full max-sm:pt-1">{children}</span>
}

/**
 * 칸 안 — 여러 색 아이콘(D-295 · 흰 칸 위 · 칸을 넘지 않게 그대로 크기) + 이름.
 * 휴대폰은 작은 아이콘 + 짧은 이름 · PC 는 큰 아이콘 위 + 이름 아래(살펴보기 칸은 긴 이름 '남의 인기 영상').
 */
function HomeTileLabel({ it, long = false }: { it: Item; long?: boolean }) {
  const Icon = it.icon
  return (
    <>
      <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white [--icon-art-scale:1] sm:size-12 sm:rounded-xl">
        <Icon aria-hidden="true" className="size-5 shrink-0 sm:size-11" />
      </span>
      {long ? (
        <>
          <span className="sm:hidden">{it.short}</span>
          <span className="max-sm:hidden">{it.label}</span>
        </>
      ) : (
        <span className="min-w-0 max-sm:truncate">{it.short}</span>
      )}
    </>
  )
}

/** onRadar 가 있으면(레이더 화면) 레이더 칸은 그 자리에서 바꾼다 — 예전 시험 이름(yt-view-*) 그대로 */
export function MarketingTabs({ active, onRadar, home = false }: { active: MarketingTab | null; onRadar?: (v: RadarView) => void; home?: boolean }) {
  // MK-SIMPLE(D-553) 첫 화면(살펴보기 · 만들기 목록)만 큰 목록 — 나머지 화면은 얇은 한 줄(PC) · '다른 화면' 판(휴대폰)
  return home ? <HomeTabs active={active} onRadar={onRadar} /> : <SlimTabs active={active} onRadar={onRadar} />
}

function HomeTabs({ active, onRadar }: { active: MarketingTab | null; onRadar?: (v: RadarView) => void }) {
  const pilot = useIsPilot()
  // SAAS-2 서버가 마케팅을 연 고객 계정 — 레이더 · 스레드 · 릴스/틱톡까지(홍보 글 · 홈페이지는 1차 상품 정리 전까지 닫힘)
  const open = usePilotMarketingScreens()
  // 도구 화면에서 마케팅이 닫힌 팀장(Pilot)에게는 그리지 않는다
  if (pilot && !open && !onRadar) return null
  const tools = pilot ? TOOLS.filter((t) => t.key === 'threads' || t.key === 'shorts') : TOOLS
  const showTools = !pilot || open
  // D-560 유튜브(plan)는 만들기 줄 맨 앞 — 만들기 줄이 없는 화면(마케팅이 닫힌 팀장)은 살펴보기 줄에
  const lookItems = showTools ? LOOK_ITEMS : [PLAN_ITEM, ...LOOK_ITEMS]
  return (
    <nav aria-label="마케팅 · 브랜딩 목차" data-testid="mk-tabs">
      <div data-testid="mk-tabs-strip" data-home="1" className="flex gap-1.5 max-sm:flex-wrap sm:flex-col sm:gap-5">
        <div className="max-sm:contents sm:flex sm:flex-col sm:gap-2">
          {/* D-507 '콘텐츠 레이더' → 쉬운 말 '살펴보기'(남의 인기 영상을 보고 고른다) */}
          <GroupLabel>살펴보기</GroupLabel>
          <div className={HOME_GRID}>
            {lookItems.map((it) =>
              onRadar ? (
                <button key={it.key} type="button" role="tab" aria-selected={isOn(it.key, active)} data-testid={`yt-view-${it.key}`} data-guide={MARKETING_GUIDE_KEYS[it.key]} onClick={() => onRadar(it.key as RadarView)} className={homeCls(isOn(it.key, active))}>
                  <HomeTileLabel it={it} long />
                </button>
              ) : (
                <Link key={it.key} to={`/marketing?view=${it.key}`} className={homeCls(false)} data-testid={`mk-tab-${it.key}`} data-guide={MARKETING_GUIDE_KEYS[it.key]}>
                  <HomeTileLabel it={it} long />
                </Link>
              ),
            )}
          </div>
        </div>
        {showTools && (
          <div className="max-sm:contents sm:flex sm:flex-col sm:gap-2">
            <GroupLabel>만들기</GroupLabel>
            <div className={HOME_GRID}>
              {/* D-560 유튜브(이번 주 주제 → 긴 영상 대본) — 스레드 옆, 레이더 화면에서는 그 자리에서 바뀐다(yt-view-plan) */}
              {onRadar ? (
                <button type="button" role="tab" aria-selected={active === 'plan'} onClick={() => onRadar('plan')} className={homeCls(active === 'plan')} data-testid="yt-view-plan" data-guide="mk-plan">
                  <HomeTileLabel it={PLAN_ITEM} />
                </button>
              ) : (
                <Link to="/marketing?view=plan" className={homeCls(false)} data-testid="mk-tab-plan" data-guide="mk-plan">
                  <HomeTileLabel it={PLAN_ITEM} />
                </Link>
              )}
              {tools.map((it) => (
                <Link key={it.key} to={it.to} aria-current={active === it.key ? 'page' : undefined} className={homeCls(active === it.key)} data-testid={`mk-tab-${it.key}`} data-guide={MARKETING_GUIDE_KEYS[it.key]}>
                  <HomeTileLabel it={it} />
                </Link>
              ))}
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
 * D-627 대표 "목차를 눌러 들어갔을 때 한 화면 글자 수를 엄격하게 — 여러 번 누르더라도 하나하나 더 나오게" — PC 도 휴대폰처럼
 *   [⌂ 처음] · 지금 화면 이름 · [다른 화면 ▾] 한 줄. 누르면 예전 두 줄(살펴보기 · 만들기 칸 전부)이 그 아래 펼쳐진다(지운 칸 없음).
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
  const homeLink = (
    <Link
      to="/marketing"
      title="마케팅 처음으로"
      className="tap t-sub inline-flex min-h-11 shrink-0 items-center gap-1 rounded-(--radius-control) border border-slate-200 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-50"
      data-testid="mk-home-link-m"
    >
      <Home aria-hidden="true" className="size-4 shrink-0" />
      처음
    </Link>
  )
  const groupHead = (title: string, sub: string) => (
    <p className="t-sub col-span-2 pt-1 font-semibold break-keep text-slate-700 sm:hidden">
      {title} <span className="font-normal text-slate-600">— {sub}</span>
    </p>
  )
  return (
    <nav aria-label="마케팅 · 브랜딩 목차" data-testid="mk-tabs" data-slim="1" className="flex flex-col gap-2">
      {/* 처음 · 지금 화면 · 다른 화면(D-627 PC 도 같은 한 줄) */}
      {/* 글자를 크게 쓰는 좁은 휴대폰(360 · 매우 크게)에서는 [다른 화면] 이 아랫줄로 — 지금 화면 이름이 한 글자씩 꺾이지 않게 */}
      <div className="flex flex-wrap items-center gap-2" data-testid="mk-tabs-phone">
        {homeLink}
        <span className="t-sub flex min-w-0 flex-1 basis-[7.5rem] items-center gap-1.5 font-bold text-slate-900 sm:flex-none sm:basis-auto sm:px-1" data-testid="mk-tabs-now">
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
      {/* [다른 화면] 을 누르면 — PC 두 줄(살펴보기 · 만들기, 칸마다 아이콘 + 짧은 이름) · 휴대폰 두 칸씩(묶음 이름과 함께) */}
      <div
        data-testid="mk-tabs-strip"
        className={`${more ? 'grid sm:flex' : 'hidden'} grid-cols-2 gap-2 rounded-(--radius-control) border border-slate-200 bg-white p-2 sm:flex-col sm:gap-1.5`}
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
            data-guide="fn-mk-look"
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
