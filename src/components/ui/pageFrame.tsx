/**
 * UXS-1 화면 문법 — 업무 화면을 같은 다섯 칸 순서로 읽히게 하는 공통 틀(대표 2026-10-25 "화면을 같은 문법으로 읽히게").
 *
 *   ① PageHero      머리 — 기능 아이콘 · 제목 · 한 줄 상태 → (보는 대상 고르개) → 주 단추. 오른쪽에 대표 배경 그림(장식은 이것 하나).
 *   ② SummaryStrip  요약 줄 — KpiCard 3~5칸, 같은 모양. 화면이 실제로 센 숫자만.
 *   ③ NextActionBar 지금 할 일 — '다음 할 일 + 단추 하나' 한 줄. 요약 바로 아래, 화면마다 같은 자리.
 *   ④ WorkPanel     본문 작업 판 — 판 머리(구역 제목 + 오른쪽 작은 단추) · 첫 줄 검색/필터 · 판 안에서는 상자를 또 두르지 않는다.
 *   ⑤ PageColumns   본문 + 보조 칸 — 넓은 화면(1280px↑)에서 오른쪽 한 칸, 좁으면 본문 아래.
 *
 * 색 · 모서리 · 글자 크기는 primitives 의 계약을 그대로 쓴다(판 --radius-panel · 단추 --radius-control · 구역 제목 t-section 하나).
 * 기능 로직은 여기에 없다 — 화면은 가진 값을 칸에 넣기만 한다.
 */
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { screenTitleForPath } from '../../config/moduleRegistry'
import { HERO_ART, type HeroArt } from '../../config/heroArt'
import { toneClass, type FeatureTone } from '../../config/featureVisual'
import { useTitleIcon } from './titleIcon'
import { HintTip } from './fold'
import { hintFor } from '../../content/sectionHints'
import { ScrollHintRow } from './ScrollHintRow'
import { useIsPhone } from '../../lib/useIsPhone'
import { KpiGroupContext } from './kpiGroup'

/** 화면 띠 사이 간격 한 가지 */
export function PageStack({ children, className = '', testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <div className={`flex flex-col gap-4 sm:gap-5 ${className}`} data-testid={testId}>
      {children}
    </div>
  )
}

/**
 * ① 머리. 휴대폰 위쪽 띠가 이미 같은 이름을 말하면 제목 · 아이콘은 숨긴다(읽는 기계에는 남김 — ScreenTitle 과 같은 규칙).
 * 배경 그림은 640px 이상에서만(휴대폰은 글자 자리가 좁아 그림이 글자 밑에 깔린다).
 * 휴대폰에서는 머리 → '지금 할 일' → 요약 순서(order) — 세로로 긴 요약(단계 · 회사 한눈에)이 할 일을 첫 화면 밖으로 밀지 않게.
 */
export function PageHero({
  title,
  sub,
  icon,
  badges,
  back,
  context,
  actions,
  notice,
  art,
  titleTestId,
  testId = 'page-hero',
}: {
  title: string
  sub?: ReactNode
  /** 없으면 메뉴와 같은 기능 아이콘(제목이 메뉴 이름으로 시작할 때) */
  icon?: ReactNode
  /** 제목 옆 작은 배지(보관됨 · 요청 출처 …) */
  badges?: ReactNode
  /** 제목 위 '← 목록' */
  back?: ReactNode
  /** 무엇을 보는지 고르는 칸(회사 · 관계 · 구역 탭) — 제목 아래 한 줄 */
  context?: ReactNode
  /** 주 단추 하나(진한) + 보조 최대 2개 — 맨 아래 줄 왼쪽, 화면마다 같은 자리 */
  actions?: ReactNode
  /** 머리 아래 붙는 얇은 알림 띠(AI 설정 필요 등) */
  notice?: ReactNode
  art?: HeroArt
  titleTestId?: string
  testId?: string
}) {
  const { pathname } = useLocation()
  const auto = useTitleIcon(title)
  const shownIcon = icon === undefined ? auto : icon
  const sameAsHeader = (screenTitleForPath(pathname) ?? '').replace(/\s*\([^)]*\)\s*$/, '') === title
  return (
    <HeroFrame art={art} testId={testId} notice={notice}>
      <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-5 lg:min-h-[10.5rem] lg:justify-center">
        {back}
        <div className="flex items-start gap-3 sm:gap-4 lg:max-w-[62%]">
          {shownIcon && <span className={`shrink-0 ${sameAsHeader ? 'hidden lg:flex' : 'flex'}`}>{shownIcon}</span>}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className={`t-page min-w-0 break-keep text-slate-900 ${sameAsHeader ? 'sr-only lg:not-sr-only' : ''}`} data-testid={titleTestId}>
                {title}
              </h1>
              {badges}
            </div>
            {sub && <div className="t-sub break-keep text-slate-600">{sub}</div>}
          </div>
        </div>
        {/* 고르개 → 단추 한 줄(머리 높이를 줄인다). 넓은 화면에서 그림 쪽으로 넘어가지 않게 62% 안 */}
        {(context || actions) && (
          <div className="flex max-w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2 lg:max-w-[62%]" data-testid="page-hero-actions">
            {context && <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">{context}</div>}
            {/* 단추는 한 묶음 — 줄이 모자라면 묶음째 다음 줄로(주 단추와 보조 단추가 갈라지지 않게) */}
            {actions && <div className={`flex max-w-full min-w-0 flex-wrap items-center gap-2 ${context ? 'sm:ml-1' : ''}`}>{actions}</div>}
          </div>
        )}
      </div>
    </HeroFrame>
  )
}

/**
 * 머리 바탕만(흰 판 · 오른쪽 배경 그림 · 휴대폰 옅은 빛) — 제목 줄을 화면이 직접 그리는 곳(오늘 화면 인사 · 할 일 수)에 쓴다.
 * PageHero 도 이 위에 그린다.
 */
export function HeroFrame({ art, children, notice, testId = 'page-hero' }: { art?: HeroArt; children: ReactNode; notice?: ReactNode; testId?: string }) {
  return (
    <section className="relative isolate overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white max-sm:order-first" data-testid={testId} data-hero={art ?? 'none'}>
      {/* 휴대폰은 그림 대신 옅은 브랜드 빛 한 겹 */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-brand-50/70 via-white to-white sm:hidden" />
      {art && (
        <div
          aria-hidden="true"
          data-hero-art={art}
          className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden w-[min(64%,46rem)] bg-cover bg-right bg-no-repeat sm:block"
          style={{ backgroundImage: `url("${HERO_ART[art]}")` }}
        />
      )}
      {children}
      {notice}
    </section>
  )
}

const SUMMARY_COLS = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' } as const

/**
 * ② 요약 줄 — 안에는 KpiCard 만 넣는다. PC 는 한 판 안의 칸(박스 하나).
 * 휴대폰은 오늘 화면 숫자 줄과 같게 옆으로 밀기(네 칸을 2×2 로 쌓으면 첫 화면 300px 를 먹는다).
 */
export function SummaryStrip({ children, cols = 4, label = '한눈에 보기', testId = 'summary-strip' }: { children: ReactNode; cols?: keyof typeof SUMMARY_COLS; label?: string; testId?: string }) {
  const phone = useIsPhone()
  if (phone)
    return (
      <section aria-label={label} data-testid={testId}>
        <ScrollHintRow fade="from-slate-50 via-slate-50/90" innerClassName="flex gap-2 pb-1 *:w-[10.5rem] *:shrink-0">
          {children}
        </ScrollHintRow>
      </section>
    )
  // PC · 태블릿은 한 판(칸 사이 1px 선) — 고객 관리 요약 줄(ui/SummaryStrip)과 같은 '요약 = 한 판' 문법
  return (
    <KpiGroupContext.Provider value={true}>
      <section aria-label={label} className={`grid grid-cols-2 gap-px overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-slate-200 ${SUMMARY_COLS[cols]}`} data-testid={testId}>
        {children}
      </section>
    </KpiGroupContext.Provider>
  )
}

/** ③ 지금 할 일 — 한 화면에 하나. 단추는 하나(보조는 글자 링크로) */
export function NextActionBar({
  label = '지금 할 일',
  title,
  detail,
  extra,
  action,
  icon: Icon = ArrowRight,
  tone = 'indigo',
  testId = 'next-action',
  attrs,
}: {
  label?: string
  title: ReactNode
  detail?: ReactNode
  /** 제목 아래 덧붙일 줄(검토 전 결과 n개 등) */
  extra?: ReactNode
  action?: ReactNode
  icon?: LucideIcon
  /** 아이콘 칸 · 왼쪽 옅은 빛만 그 화면 기능 색(D-282 — 색은 아이콘 칸에만). 판 · 글자 · 단추는 화면마다 같다 */
  tone?: FeatureTone
  testId?: string
  attrs?: Record<string, string>
}) {
  const t = toneClass(tone)
  return (
    <section
      className="relative flex flex-col gap-3 overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3.5 shadow-(--shadow-card) max-sm:-order-1 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
      data-testid={testId}
      data-frame="next"
      {...attrs}
    >
      <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r ${NEXT_GLOW[tone]} to-transparent`} />
      <span aria-hidden="true" className={`relative hidden size-11 shrink-0 items-center justify-center rounded-xl sm:flex ${t.tile}`}>
        <Icon className="size-5" />
      </span>
      <div className="relative min-w-0 flex-1">
        <p className="t-meta font-semibold text-slate-500">{label}</p>
        <div className="t-card break-keep text-slate-900">{title}</div>
        {detail && <div className="t-sub break-keep text-slate-600">{detail}</div>}
        {extra}
      </div>
      {action && <div className="relative flex shrink-0 flex-wrap gap-2 *:w-full sm:*:w-auto">{action}</div>}
    </section>
  )
}

/** 지금 할 일 줄 왼쪽 옅은 빛 — 통째로 적는다(D-26) */
const NEXT_GLOW: Record<FeatureTone, string> = {
  indigo: 'from-indigo-50',
  teal: 'from-teal-50',
  blue: 'from-blue-50',
  purple: 'from-violet-50',
  amber: 'from-amber-50',
  orange: 'from-orange-50',
  coral: 'from-coral-50',
  green: 'from-emerald-50',
  cyan: 'from-cyan-50',
  rose: 'from-rose-50',
  slate: 'from-slate-50',
}

/** ④ 본문 작업 판 — 일 하나에 판 하나 */
export function WorkPanel({
  title,
  hint,
  count,
  actions,
  toolbar,
  children,
  testId,
  id,
  bodyClassName = 'px-4 pb-4 sm:px-5 sm:pb-5',
}: {
  title?: string
  /** 목차 설명 — 없으면 사전(hintFor)에서 */
  hint?: string
  count?: number
  actions?: ReactNode
  /** 검색 · 필터 — 판의 첫 줄 */
  toolbar?: ReactNode
  children: ReactNode
  testId?: string
  id?: string
  bodyClassName?: string
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white pt-4 sm:pt-5" data-testid={testId} aria-labelledby={id}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5">
          {title && (
            // D-192 목차마다 설명(마우스를 올리면 · 휴대폰은 ⓘ) — SectionTitle 과 같은 사전(content/sectionHints)
            <HintTip tip={hint ?? hintFor(title)} label={title}>
              <h2 id={id} className="t-section flex min-w-0 items-center gap-2 break-keep text-slate-900">
                {title}
                {typeof count === 'number' && count > 0 && <span className="t-meta rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-500 tabular-nums">{count}</span>}
              </h2>
            </HintTip>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {toolbar && <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5">{toolbar}</div>}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

/** ⑤ 본문 + 보조 칸 */
export function PageColumns({ children, aside, asideLabel }: { children: ReactNode; aside?: ReactNode; asideLabel?: string }) {
  if (!aside) return <div className="flex min-w-0 flex-col gap-4">{children}</div>
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
      <aside aria-label={asideLabel} className="flex min-w-0 flex-col gap-3">
        {aside}
      </aside>
    </div>
  )
}
