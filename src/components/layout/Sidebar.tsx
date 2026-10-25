import type { FocusEvent as ReactFocusEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { isAdvancedVisible } from '../../lib/featureVisibility'
import { useEffect, useRef, useState } from 'react'
import { MAIN_MIN, NAV_MIN, navMaxFor, navPx, setNavSize, showNav, sizeAtDrag, stepNav, toggleNavIcons, useNavSize, type NavSize } from '../../lib/navWidth'
import { Link, useNavigate } from 'react-router-dom'
import { useNavPath } from '../../lib/navFrom'
import { ChevronDown, ChevronsLeft, ChevronsRight, ExternalLink, X, type LucideIcon } from 'lucide-react'
import { FeedbackNavButton } from '../feedback/FeedbackNavButton'
import { brand } from '../../brand/brand.config'
import { BrandLogo } from '../brand/BrandLogo'
import {
  enabledModulesByGroup,
  moduleMatchLength,
  navPathForSidebar,
  type ModuleDefinition,
  type ModuleGroupKey,
} from '../../config/moduleRegistry'
import { groupTone, moduleTone, toneClass, type FeatureTone } from '../../config/featureVisual'
import { readRaw, writeRaw } from '../../storage/localStore'
import { FUTURE_ITEMS, type FutureItem } from '../../config/capabilityStatus'
import { FutureItemDialog } from './FutureItemDialog'
import { futureIcon } from './futureIcons'
import { useCurrentUser } from './useCurrentUser'
import { ViewAsSwitch } from './ViewAsSwitch'
import { DeviceSwitch } from './DeviceView'
import { AccountSwitchItems } from './AccountSwitch'
import { useNavCounts, type NavCounts } from './useNavCounts'
import { useIsPilot } from '../../auth/osAccess'
import { useCapabilitySet } from '../../auth/ownerAiAccess'
import { useBackToClose } from '../../lib/backToClose'
import { useEntitlements } from '../../lib/entitlementsStore'

interface SidebarProps {
  mobileOpen: boolean
  onCloseMobile: () => void
}

/** 접힌 그룹 상태 저장 키 — 화면 설정과 같은 접두어를 쓰되 도메인 데이터와 분리한다 */
const GROUP_STATE_KEY = 'axmvp.ui.nav.collapsed'

function readCollapsedGroups(): Set<ModuleGroupKey> {
  try {
    const raw = readRaw(GROUP_STATE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function writeCollapsedGroups(set: Set<ModuleGroupKey>): void {
  try {
    writeRaw(GROUP_STATE_KEY, JSON.stringify([...set]))
  } catch {
    // 저장 실패는 앱을 막지 않는다
  }
}

/**
 * 전역 메뉴 — 모듈 레지스트리에서 그룹·항목을 읽어 그린다.
 * 대표의 하루 순서(오늘 → 고객 → 일정 → 자금 → 일기)를 먼저 두고,
 * 프로젝트당 한 번 쓰는 전문 기능(AX STUDIO)은 접어 둔다.
 */
function SidebarContent({
  collapsed,
  onToggleCollapsed,
  onNavigate,
  onCloseMobile,
}: {
  collapsed: boolean
  onToggleCollapsed?: () => void
  onNavigate?: () => void
  onCloseMobile?: () => void
}) {
  const navigate = useNavigate()
  // D-124: 영업에서 온 업체 화면이면 영업 관리에 불을 켠 채로
  // D-233: 마케팅 · 브랜딩이 함께 맡는 화면(콘텐츠 레이더 · 홍보 글 · 홈페이지)에서는 '마케팅 · 브랜딩' 한 줄에만 불
  const navPath = navPathForSidebar(useNavPath())
  // D-120: 설정 '고급 운영 기능 보기' 를 따른다(끄면 검증 · 기관 전략 · 사례를 목차에서 뺀다). 바꾸면 바로 다시 그린다
  useStoreVersion()
  // D-162: Pilot 에게는 대표 전용 묶음 · 줄을 빼고 보인다(같은 메뉴 표에서)
  const pilot = useIsPilot()
  const caps = useCapabilitySet()
  const groups = enabledModulesByGroup({ advanced: isAdvancedVisible(), pilot, caps })
  const counts = useNavCounts()
  const [userCollapsed, setUserCollapsed] = useState<Set<ModuleGroupKey> | null>(null)
  // D-282 접힌 메뉴(아이콘만)에서 손을 올리거나 키보드로 옮기면 이름표 — 브라우저 기본 title 은 늦게 · 작게 떠서 대신한다
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null)
  const showTip = (e: ReactMouseEvent<HTMLElement> | ReactFocusEvent<HTMLElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-nav-tip]')
    if (!el) return setTip(null)
    const r = el.getBoundingClientRect()
    setTip({ label: el.dataset.navTip ?? '', top: r.top + r.height / 2, left: r.right + 10 })
  }
  const tipProps = collapsed ? { onMouseOver: showTip, onFocus: showTip, onMouseLeave: () => setTip(null), onBlur: () => setTip(null), onScroll: () => setTip(null) } : {}

  useEffect(() => {
    setUserCollapsed(readCollapsedGroups())
  }, [])

  const isGroupCollapsed = (key: ModuleGroupKey, defaultCollapsed: boolean, containsActive: boolean) => {
    // 현재 화면이 그 그룹 안에 있으면 펼쳐서 위치를 잃지 않게 한다
    if (containsActive) return false
    if (userCollapsed === null) return defaultCollapsed
    if (userCollapsed.has(key)) return true
    // 사용자가 한 번이라도 펼쳤으면 그 선택을 기억한다
    const openedKey = `open:${key}` as ModuleGroupKey
    if (userCollapsed.has(openedKey)) return false
    return defaultCollapsed
  }

  const toggleGroup = (key: ModuleGroupKey, currentlyCollapsed: boolean) => {
    const next = new Set(userCollapsed ?? [])
    const openedKey = `open:${key}` as ModuleGroupKey
    if (currentlyCollapsed) {
      next.delete(key)
      next.add(openedKey)
    } else {
      next.add(key)
      next.delete(openedKey)
    }
    setUserCollapsed(next)
    writeCollapsedGroups(next)
  }

  /** D-127: 분야 줄 — 지금 화면이 그 안이면 펼치고, 아니면 사람이 연 것만 펼친다(처음에는 접힘) */
  const isCategoryOpen = (key: string, containsActive: boolean) => {
    if (containsActive) return true
    return userCollapsed?.has(`open:cat:${key}` as ModuleGroupKey) ?? false
  }
  const toggleCategory = (key: string, currentlyOpen: boolean) => {
    const next = new Set(userCollapsed ?? [])
    const k = `open:cat:${key}` as ModuleGroupKey
    if (currentlyOpen) next.delete(k)
    else next.add(k)
    setUserCollapsed(next)
    writeCollapsedGroups(next)
  }

  return (
    <div className="flex h-full flex-col bg-navy-900 text-navy-200">
      {/* 로고를 1.5배로 키우면서 머리 칸도 함께 키운다 — 안 키우면 제품명 줄이 눌린다 (D-87) */}
      <div className={`flex h-20 shrink-0 items-center border-b border-navy-800 ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        <button
          type="button"
          onClick={() => { navigate('/'); onNavigate?.() }}
          aria-label={`${brand.productName} 홈으로`}
          className="flex min-w-0 cursor-pointer items-center gap-2.5"
        >
          {collapsed ? (
            <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[1.15rem] font-black text-white">
              M
            </span>
          ) : (
            <span className="flex min-w-0 flex-col items-start gap-0.5">
              <BrandLogo tone="dark" imgClassName="h-12 max-w-[200px]" />
              <span className="truncate text-[0.875rem] font-semibold tracking-wide text-navy-300">
                {brand.productName}
              </span>
            </span>
          )}
        </button>
        {onCloseMobile && (
          <button type="button" aria-label="메뉴 닫기" onClick={onCloseMobile} className="tap flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-navy-300 hover:bg-navy-800 hover:text-white">
            <X aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>

      <nav aria-label="주 메뉴" className="flex-1 overflow-y-auto px-3 py-4" {...tipProps}>
        <ul className="flex flex-col gap-5">
          {groups.map(({ group, items }) => {
            const containsActive = items.some((m) => moduleMatchLength(m, navPath) > 0)
            const isCollapsed = group.collapsible
              ? isGroupCollapsed(group.key, group.defaultCollapsed ?? false, containsActive)
              : false
            const listId = `nav-list-${group.key}`
            return (
              <li key={group.key}>
                {!collapsed && (
                  group.collapsible ? (
                    <button
                      type="button"
                      aria-expanded={!isCollapsed}
                      aria-controls={listId}
                      onClick={() => toggleGroup(group.key, isCollapsed)}
                      className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-3 pb-1.5 text-[0.875rem] font-semibold tracking-wide text-navy-300 hover:text-white"
                    >
                      <span aria-hidden="true" className={`h-3 w-1 shrink-0 rounded-full ${toneClass(groupTone(group.key)).bar}`} />
                      <span className="flex-1 text-left">{group.title}</span>
                      <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                    </button>
                  ) : (
                    <p id={`nav-${group.key}`} className="flex items-center gap-1.5 px-3 pb-1.5 text-[0.875rem] font-semibold tracking-wide text-navy-300">
                      <span aria-hidden="true" className={`h-3 w-1 shrink-0 rounded-full ${toneClass(groupTone(group.key)).bar}`} />
                      {group.title}
                    </p>
                  )
                )}
                {(collapsed || !isCollapsed) && (
                  <ul
                    id={listId}
                    aria-labelledby={!collapsed && !group.collapsible ? `nav-${group.key}` : undefined}
                    aria-label={collapsed || group.collapsible ? group.title : undefined}
                    className="flex flex-col gap-0.5"
                  >
                    {items.filter((item) => !item.parent).map((item) => (
                      <li key={item.key}>
                        {item.expand === 'future-items' ? (
                          <FutureExpandRow item={item} collapsed={collapsed} />
                        ) : item.kind === 'category' ? (
                          <CategoryRow
                            item={item}
                            items={items.filter((c) => c.parent === item.key)}
                            navPath={navPath}
                            collapsed={collapsed}
                            onNavigate={onNavigate}
                            isOpen={isCategoryOpen}
                            onToggle={toggleCategory}
                          />
                        ) : (
                          <NavLinkRow
                            item={item}
                            isActive={moduleMatchLength(item, navPath) > 0}
                            collapsed={collapsed}
                            onNavigate={onNavigate}
                            counts={counts}
                            tone={moduleTone(item.key)}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {/*
        D-103: 아래 한 줄 — 지금 쓰는 사람(로그인한 사람 이름, 없으면 대표 이름) · 고객 플랫폼은 작은 아이콘.
        예전 서랍의 '이 기기 · 계정' 칸(고객 플랫폼 열기 · 처음 사용 가이드 · 글자 크기)은 없앴다 —
        가이드는 '이 시스템' 묶음으로, 글자 크기는 설정으로 갔다.
      */}
      <div className="shrink-0 border-t border-navy-800 px-3 py-3" {...tipProps}>
        {/* D-158: 휴대폰 서랍의 글자 크기는 뺐다(대표: 설정에 있으니 굳이) */}
        {/* D-164: 휴대폰 서랍에서도 대표 ↔ 팀장 화면(PC 는 머리줄 오른쪽 위) */}
        {!collapsed && (
          <div className="mb-2 px-1.5 lg:hidden">
            <ViewAsSwitch stacked />
          </div>
        )}
        {/* D-286 휴대폰 서랍(더보기)에서도 보기 방식 — PC · Mobile · PC+Mobile(대표 "폰에서도 PC 버전 · 모바일 · 동시에") */}
        {onCloseMobile && !collapsed && (
          <div className="mb-2 px-1.5 lg:hidden" data-testid="drawer-device">
            <p className="mb-1 px-0.5 text-[0.8125rem] font-semibold text-navy-200">보기 방식</p>
            <DeviceSwitch stacked />
          </div>
        )}
        {/* D-254 [ChatGPT 옆에 띄우기] 는 D-265 에 본문 오른쪽 위로 옮겼다(AppShell — 대표 "우측 상단 여백에") */}
        <SidebarAccount collapsed={collapsed} />
        {/* D-184: 휴대폰 서랍 — 다른 계정으로 바꾸기 · 로그아웃(PC 는 머리줄 오른쪽 위 사용자 메뉴) */}
        {onCloseMobile && (
          <div className="mt-1.5">
            <AccountSwitchItems tone="dark" />
          </div>
        )}
        {/* D-188: 예전 '컨설팅 운영 · AX 스튜디오 · v0.1.0' 글자 자리 — 팀장은 [개발자에게 피드백], 대표는 [받은 피드백함] */}
        <div className="mt-2">
          <FeedbackNavButton collapsed={collapsed} onNavigate={onNavigate} />
        </div>
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
            data-nav-tip={collapsed ? '사이드바 펼치기' : undefined}
            className={`flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-(--radius-control) px-3 py-2 text-[0.9rem] text-navy-200 hover:bg-navy-800 hover:text-white ${collapsed ? 'justify-center px-0' : ''}`}
          >
            {collapsed ? <ChevronsRight aria-hidden="true" className="size-[18px] shrink-0" /> : (<><ChevronsLeft aria-hidden="true" className="size-[18px] shrink-0" /><span>사이드바 접기</span></>)}
          </button>
        )}
      </div>
      {collapsed && tip && (
        <div
          role="tooltip"
          data-testid="nav-tip"
          style={{ top: tip.top, left: tip.left }}
          className="t-sub pointer-events-none fixed z-[60] -translate-y-1/2 rounded-(--radius-control) bg-slate-900 px-3 py-1.5 font-semibold whitespace-nowrap text-white shadow-(--shadow-overlay)"
        >
          {tip.label}
        </div>
      )}
    </div>
  )
}

/**
 * D-282 메뉴 아이콘 칸 — 기능 색 옅은 바탕 + 아이콘(어두운 메뉴 위). 지금 화면이면 흰 칸.
 * 색은 '어디인가' 만 말한다(화면 규칙 §8-1). 급한 정도는 숫자 배지(빨강)가 말한다.
 */
function NavIcon({ icon: Icon, tone, active, collapsed, small = false }: { icon: LucideIcon; tone: FeatureTone; active: boolean; collapsed: boolean; small?: boolean }) {
  const t = toneClass(tone)
  const box = collapsed ? 'size-10 rounded-xl' : small ? 'size-7 rounded-lg' : 'size-8 rounded-lg'
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center ${box} ${active ? 'bg-white/20 text-white' : `${t.darkTile} ${t.darkIcon}`}`}>
      <Icon className={collapsed ? 'size-5' : small ? 'size-4' : 'size-[18px]'} />
    </span>
  )
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  // D-124: 서랍 메뉴가 열렸을 때 휴대폰 뒤로가기는 서랍만 닫는다
  useBackToClose(mobileOpen, onCloseMobile)
  // D-256 메뉴 폭 — 넓게(끈 폭) · 아이콘 · 숨김. 끈 적 없으면 예전 폭(256 · 큰 화면 288) 그대로
  const nav = useNavSize()
  const px = navPx(nav)
  const [dragging, setDragging] = useState(false)
  const asideRef = useRef<HTMLElement>(null)
  return (
    <>
      <aside
        ref={asideRef}
        // 큰 화면에서 넓혀 둔 폭도 좁은 화면에서는 본문 768px 을 남기고 줄여 보인다
        style={{ ...(px == null ? {} : { width: px }), ...(nav.mode === 'full' ? { maxWidth: `max(${NAV_MIN}px, calc(100vw - ${MAIN_MIN}px))` } : {}) }}
        data-nav-mode={nav.mode}
        className={`no-print sticky top-0 z-30 hidden h-screen shrink-0 lg:block ${dragging ? '' : 'transition-[width] duration-200'} ${px == null ? 'w-64 xl:w-72' : ''}`}
      >
        {nav.mode !== 'hidden' && <SidebarContent collapsed={nav.mode === 'icons'} onToggleCollapsed={toggleNavIcons} />}
        <NavResizeHandle nav={nav} asideRef={asideRef} onDragging={setDragging} />
      </aside>
      {nav.mode === 'hidden' && (
        <button
          type="button"
          onClick={showNav}
          aria-label="메뉴 다시 보이기"
          title="메뉴 다시 보이기 — 왼쪽 끝 경계선을 끌어도 돌아와요"
          data-testid="nav-show"
          className="no-print fixed top-24 left-0 z-40 hidden h-14 w-7 cursor-pointer items-center justify-center rounded-r-(--radius-control) border border-l-0 border-navy-700 bg-navy-900 text-navy-100 shadow-(--shadow-card) hover:bg-navy-800 hover:text-white lg:flex"
        >
          <ChevronsRight aria-hidden="true" className="size-4" />
        </button>
      )}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="메뉴 배경 닫기" onClick={onCloseMobile} className="absolute inset-0 cursor-default bg-navy-950/50" />
          <div className="absolute inset-y-0 left-0 w-[300px] max-w-[85vw] shadow-(--shadow-overlay)">
            <SidebarContent collapsed={false} onNavigate={onCloseMobile} onCloseMobile={onCloseMobile} />
          </div>
        </div>
      )}
    </>
  )
}

/**
 * D-256 메뉴 경계선 — 끌면 폭이 따라오고, 왼쪽 끝으로 끌면 아이콘 → 숨김. 두 번 누르면 예전 폭.
 * 끄는 동안은 저장하지 않고(화면만) 손을 놓을 때 한 번 저장. 숨김이어도 왼쪽 끝 6px 는 잡힌다.
 */
function NavResizeHandle({ nav, asideRef, onDragging }: { nav: NavSize; asideRef: RefObject<HTMLElement | null>; onDragging: (v: boolean) => void }) {
  const shown = () => Math.round(asideRef.current?.getBoundingClientRect().width ?? navPx(nav) ?? 256)
  const max = () => navMaxFor(window.innerWidth)
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const el = e.currentTarget
    const start = nav
    const left = asideRef.current?.getBoundingClientRect().left ?? 0
    const limit = max()
    let last = start
    let frame = 0
    let x = e.clientX
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* 잡기가 안 돼도 끌기는 된다 */
    }
    onDragging(true)
    const body = document.body.style
    const before = { cursor: body.cursor, select: body.userSelect }
    body.cursor = 'col-resize'
    body.userSelect = 'none'
    const move = (ev: PointerEvent) => {
      x = ev.clientX
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        last = sizeAtDrag(x - left, start, limit)
        setNavSize(last, false)
      })
    }
    const up = () => {
      if (frame) cancelAnimationFrame(frame)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      body.cursor = before.cursor
      body.userSelect = before.select
      onDragging(false)
      setNavSize(last)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      setNavSize(stepNav(nav, e.key === 'ArrowLeft' ? -1 : 1, shown(), max()))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setNavSize({ mode: 'hidden', width: nav.width })
    } else if (e.key === 'End') {
      e.preventDefault()
      setNavSize({ mode: 'full', width: max() })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      setNavSize({ mode: 'full', width: null })
    }
  }
  const now = navPx(nav)
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="메뉴 폭 — 끌어서 넓히기 · 좁히기 · 숨기기(←/→ · Enter 는 원래 폭)"
      aria-valuemin={0}
      aria-valuemax={typeof window === 'undefined' ? 440 : navMaxFor(window.innerWidth)}
      aria-valuenow={now ?? undefined}
      tabIndex={0}
      title="끌어서 메뉴 폭 바꾸기 — 왼쪽 끝까지 끌면 숨김 · 두 번 누르면 원래 폭"
      onPointerDown={onPointerDown}
      onDoubleClick={() => setNavSize({ mode: 'full', width: null })}
      onKeyDown={onKeyDown}
      data-testid="nav-resize"
      className="group absolute top-0 -right-1.5 z-40 h-full w-3 cursor-col-resize touch-none outline-none"
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-transparent transition-colors group-hover:bg-brand-400 group-focus-visible:bg-brand-500 group-active:bg-brand-500" />
      <span aria-hidden="true" className="absolute top-1/2 left-1/2 hidden h-10 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500 group-hover:block group-focus-visible:block" />
    </div>
  )
}

function NavLinkRow({
  item,
  isActive,
  collapsed,
  onNavigate,
  counts,
  tone,
  nested = false,
}: {
  item: ModuleDefinition
  isActive: boolean
  collapsed: boolean
  onNavigate?: () => void
  counts: NavCounts
  /** 기능 색 — 분야 아래 줄(nested)은 색 없이 작은 아이콘 */
  tone?: FeatureTone
  nested?: boolean
}) {
  return (
    <Link
      to={item.path}
      onClick={onNavigate}
      title={collapsed ? undefined : item.hint}
      aria-label={collapsed ? item.label : undefined}
      data-nav-tip={collapsed ? item.label : undefined}
      // D-103: 불 켜짐과 '지금 화면'(aria-current)을 같은 규칙으로 — 함께 맡는 주소(일정 ↔ 기록)에서도 읽는 기계가 알게
      aria-current={isActive ? 'page' : undefined}
      className={`relative flex items-center gap-3 rounded-(--radius-control) font-medium transition-colors ${nested ? 'min-h-11 px-3 py-2 text-[0.92rem]' : 'min-h-11 px-2 py-1.5 text-[0.95rem]'} ${collapsed ? 'justify-center px-0' : ''} ${
        isActive ? 'active bg-brand-600 text-white' : 'text-navy-200 hover:bg-navy-800 hover:text-white'
      }`}
    >
      {isActive && !collapsed && <span aria-hidden="true" className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-white/90" />}
      {nested || !tone ? (
        <item.icon aria-hidden="true" className={`size-4 shrink-0 ${isActive ? 'text-white' : 'text-navy-300'}`} />
      ) : (
        <NavIcon icon={item.icon} tone={tone} active={isActive} collapsed={collapsed} />
      )}
      {!collapsed && <span className="truncate">{item.label}</span>}
      <NavBadge kind={item.badge} counts={counts} active={isActive} collapsed={collapsed} />
      {!collapsed && item.status === 'soon' && (
        <span className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[0.875rem] font-semibold ${isActive ? 'bg-white/20 text-white' : 'bg-navy-800 text-navy-200'}`}>
          {/* D-120: 배지는 작게 — 메뉴 이름(1차 미팅 체크리스트)이 잘리지 않게 */}
          준비 중
        </span>
      )}
      {!collapsed && item.status === 'next' && (
        <span className={`ml-auto shrink-0 rounded-full border px-1.5 py-0.5 text-[0.875rem] font-semibold tracking-wide ${isActive ? 'border-white/40 text-white' : 'border-navy-600 text-navy-300'}`}>
          다음
        </span>
      )}
    </Link>
  )
}

/**
 * D-127: 전문 모듈 분야 한 줄 — 누르면 그 아래 기능이 펼쳐진다(화면은 옮기지 않는다).
 * 잠긴 모듈도 감추지 않고 '잠김' 을 글자로 적는다. 사이드바를 접었을 때는 모듈 살펴보기로 가는 아이콘.
 */
function CategoryRow({
  item,
  items,
  navPath,
  collapsed,
  onNavigate,
  isOpen,
  onToggle,
}: {
  item: ModuleDefinition
  items: ModuleDefinition[]
  navPath: string
  collapsed: boolean
  onNavigate?: () => void
  isOpen: (key: string, containsActive: boolean) => boolean
  onToggle: (key: string, currentlyOpen: boolean) => void
}) {
  const { ent } = useEntitlements()
  const counts = useNavCounts()
  const locked = item.moduleKey ? !ent.module(item.moduleKey).usable : false
  const selfActive = moduleMatchLength(item, navPath) > 0
  const childActive = items.some((c) => moduleMatchLength(c, navPath) > 0)
  const open = isOpen(item.key, childActive || selfActive)
  const listId = `nav-cat-${item.key}`
  const tone = moduleTone(item.key)
  if (collapsed) {
    return (
      <Link
        to={item.path}
        onClick={onNavigate}
        data-nav-tip={item.label}
        aria-current={selfActive || childActive ? 'page' : undefined}
        className={`relative flex min-h-11 items-center justify-center rounded-(--radius-control) py-1.5 transition-colors ${selfActive || childActive ? 'active bg-brand-600 text-white' : 'text-navy-200 hover:bg-navy-800 hover:text-white'}`}
      >
        <NavIcon icon={item.icon} tone={tone} active={selfActive || childActive} collapsed />
        <span className="sr-only">{item.label}</span>
      </Link>
    )
  }
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        data-nav-category={item.moduleKey}
        onClick={() => onToggle(item.key, open)}
        title={item.hint}
        className={`relative flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-(--radius-control) px-2 py-1.5 text-left text-[0.95rem] font-medium transition-colors ${
          selfActive ? 'bg-navy-800 text-white' : childActive ? 'text-white' : 'text-navy-200 hover:bg-navy-800 hover:text-white'
        }`}
      >
        <NavIcon icon={item.icon} tone={tone} active={false} collapsed={false} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {locked && (
          <span data-nav-locked className="shrink-0 rounded-full border border-navy-600 px-1.5 py-0.5 text-[0.875rem] font-semibold text-navy-300">
            잠김
          </span>
        )}
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <ul id={listId} aria-label={`${item.label} 기능`} className="mt-1 ml-6 flex flex-col gap-0.5 border-l border-navy-700 pl-2">
          {items.map((c) => (
            <li key={c.key}>
              <NavLinkRow item={c} isActive={moduleMatchLength(c, navPath) > 0} collapsed={false} onNavigate={onNavigate} counts={counts} nested />
            </li>
          ))}
          <li>
            <Link
              to={item.path}
              onClick={onNavigate}
              aria-current={selfActive ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-2 rounded-(--radius-control) px-3 py-2 text-[0.92rem] font-medium ${selfActive ? 'bg-brand-600 text-white' : 'text-navy-300 hover:bg-navy-800 hover:text-white'}`}
            >
              {item.label} 살펴보기
            </Link>
          </li>
        </ul>
      )}
    </>
  )
}

/** D-103: 사이드바 아래 — 이름 · 직함 + 고객 플랫폼 아이콘 */
function SidebarAccount({ collapsed }: { collapsed: boolean }) {
  const me = useCurrentUser()
  const portal = (
    <a
      href={brand.customerPlatformUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${brand.customerPlatformLabel} 열기 (새 창)`}
      title={`${brand.customerPlatformLabel} 열기`}
      data-testid="sidebar-portal-link"
      className="flex size-9 shrink-0 items-center justify-center rounded-(--radius-control) text-navy-300 hover:bg-navy-800 hover:text-white"
    >
      <ExternalLink aria-hidden="true" className="size-[18px]" />
    </a>
  )
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <span title={`${me.name} ${me.title}`} aria-label={`${me.name} ${me.title}`} role="img" className="flex size-9 items-center justify-center rounded-full bg-white/10 text-[0.9rem] font-bold text-white">
          {me.initial}
        </span>
        {portal}
      </div>
    )
  }
  return (
    <div data-testid="sidebar-account" className="flex items-center gap-2.5 px-1.5">
      <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-[0.9rem] font-bold text-white">
        {me.initial}
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.95rem] text-navy-100">
        <b className="font-bold text-white">{me.name}</b> {me.title}
      </span>
      {portal}
    </div>
  )
}

/**
 * D-103: '향후 확장' — 눌러도 화면을 옮기지 않는다. 메뉴 안에서 아직 없는 기능 목록이 펼쳐지고,
 * 하나를 누르면 화면 가운데 안내창(어떻게 돌아갈 수 있는지 + 예시)이 뜬다.
 */
function FutureExpandRow({ item, collapsed }: { item: ModuleDefinition; collapsed: boolean }) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<FutureItem | null>(null)
  const listId = `future-list-${item.key}`
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? undefined : item.hint}
        aria-label={collapsed ? item.label : undefined}
        data-nav-tip={collapsed ? item.label : undefined}
        className={`relative flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-(--radius-control) px-2 py-1.5 text-left text-[0.95rem] font-medium text-navy-200 transition-colors hover:bg-navy-800 hover:text-white ${collapsed ? 'justify-center px-0' : ''}`}
      >
        <NavIcon icon={item.icon} tone="slate" active={false} collapsed={collapsed} />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {!collapsed && (
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            <span className="t-meta rounded-full border border-navy-600 px-1.5 py-0.5 font-semibold tracking-wide text-navy-300">다음</span>
            <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${open ? '' : '-rotate-90'}`} />
          </span>
        )}
      </button>
      {open && (
        <ul id={listId} aria-label={`${item.label} 목록`} className={`mt-1 flex flex-col gap-0.5 ${collapsed ? '' : 'ml-5 border-l border-navy-700 pl-2'}`}>
          {FUTURE_ITEMS.map((f) => {
            const Icon = futureIcon(f.key)
            return (
              <li key={f.key}>
                <button
                  type="button"
                  onClick={() => setPicked(f)}
                  title={collapsed ? f.short : f.label}
                  data-future={f.key}
                  className={`flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-(--radius-control) px-2.5 py-2 text-left text-[0.9rem] text-navy-200 hover:bg-navy-800 hover:text-white ${collapsed ? 'justify-center px-0' : ''}`}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-navy-300" />
                  {collapsed ? <span className="sr-only">{f.short}</span> : <span className="truncate">{f.short}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <FutureItemDialog item={picked} onClose={() => setPicked(null)} onPick={setPicked} />
    </>
  )
}

/**
 * D-104: 메뉴 옆 숫자.
 *  - 고객 관리 — 계약 고객 수(D-114, 잠재고객은 빼고 고객 관리 안에서 본다). 튀지 않게 옅은 글자(0 이어도 보인다 — '몇 곳인지' 가 뜻이므로).
 *  - 상담신청 · 1차 미팅 — 빨간 바탕 흰 숫자. 처리할 것이 있을 때만(0 이면 없음).
 * 접힌 사이드바에서는 빨간 것만 아이콘 위에 작은 점 숫자로.
 */
function NavBadge({ kind, counts, active, collapsed }: { kind: ModuleDefinition['badge']; counts: NavCounts; active: boolean; collapsed: boolean }) {
  if (!kind) return null
  const n = kind === 'clients' ? counts.clients : kind === 'requests' ? counts.requests : counts.firstMeetings
  if (n === null) return null
  // D-223 계약 고객 수는 휴대폰 아래 메뉴와 같게 999 까지(예전: PC 는 '99+', 휴대폰은 실제 숫자) · 빨간 숫자는 99+
  const text = kind === 'clients' ? (n > 999 ? '999+' : String(n)) : n > 99 ? '99+' : String(n)
  if (kind === 'clients') {
    if (collapsed) return null
    return (
      <span data-nav-badge={kind} aria-label={`계약 고객 ${n}곳`} className={`t-meta ml-auto shrink-0 tabular-nums ${active ? 'text-white/80' : 'text-navy-300'}`}>
        {text}
      </span>
    )
  }
  if (n <= 0) return null
  const label = kind === 'requests' ? `새 상담신청 ${n}건` : `남은 1차 미팅 ${n}건`
  if (collapsed) {
    return (
      <span data-nav-badge={kind} aria-label={label} className="absolute top-1 right-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[0.875rem] font-bold text-white tabular-nums">
        {text}
      </span>
    )
  }
  return (
    <span data-nav-badge={kind} aria-label={label} className="t-meta ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger-500 px-1.5 font-bold text-white tabular-nums">
      {text}
    </span>
  )
}
