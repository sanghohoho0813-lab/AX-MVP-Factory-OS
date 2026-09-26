import type { CSSProperties } from 'react'
import { TextScaleQuickButton } from '../ui/TextScaleQuickButton'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { isAdvancedVisible } from '../../lib/featureVisibility'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronsLeft, ChevronsRight, ExternalLink, X } from 'lucide-react'
import { APP_VERSION } from '../../data/navigation'
import { brand } from '../../brand/brand.config'
import { BrandLogo } from '../brand/BrandLogo'
import {
  enabledModulesByGroup,
  groupAccentClass,
  moduleMatchLength,
  navAccentClass,
  type ModuleDefinition,
  type ModuleGroupKey,
} from '../../config/moduleRegistry'
import { readRaw, writeRaw } from '../../storage/localStore'
import { FUTURE_ITEMS, type FutureItem } from '../../config/capabilityStatus'
import { FutureItemDialog } from './FutureItemDialog'
import { futureIcon } from './futureIcons'
import { useCurrentUser } from './useCurrentUser'
import { useNavCounts, type NavCounts } from './useNavCounts'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
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
  const location = useLocation()
  // D-120: 설정 '고급 운영 기능 보기' 를 따른다(끄면 검증 · 기관 전략 · 사례를 목차에서 뺀다). 바꾸면 바로 다시 그린다
  useStoreVersion()
  const groups = enabledModulesByGroup({ advanced: isAdvancedVisible() })
  const counts = useNavCounts()
  const [userCollapsed, setUserCollapsed] = useState<Set<ModuleGroupKey> | null>(null)

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
              <span className="truncate text-[0.8125rem] font-semibold tracking-wide text-navy-300">
                {brand.productName}
              </span>
            </span>
          )}
        </button>
        {onCloseMobile && (
          <button type="button" aria-label="메뉴 닫기" onClick={onCloseMobile} className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-navy-300 hover:bg-navy-800 hover:text-white">
            <X aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>

      <nav aria-label="주 메뉴" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-4">
          {groups.map(({ group, items }) => {
            const containsActive = items.some((m) => moduleMatchLength(m, location.pathname) > 0)
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
                      <span aria-hidden="true" className={`h-3 w-1 shrink-0 rounded-full ${groupAccentClass(group.accent)}`} />
                      <span className="flex-1 text-left">{group.title}</span>
                      <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                    </button>
                  ) : (
                    <p id={`nav-${group.key}`} className="flex items-center gap-1.5 px-3 pb-1.5 text-[0.875rem] font-semibold tracking-wide text-navy-300">
                      <span aria-hidden="true" className={`h-3 w-1 shrink-0 rounded-full ${groupAccentClass(group.accent)}`} />
                      {group.title}
                    </p>
                  )
                )}
                {(collapsed || !isCollapsed) && (
                  <ul
                    id={listId}
                    aria-labelledby={!collapsed && !group.collapsible ? `nav-${group.key}` : undefined}
                    aria-label={collapsed || group.collapsible ? group.title : undefined}
                    className="flex flex-col gap-1"
                  >
                    {items.map((item, idx) => (
                      <li key={item.key}>
                        {item.expand === 'future-items' ? (
                          <FutureExpandRow item={item} collapsed={collapsed} />
                        ) : (
                        (() => {
                          // D-103: 불 켜짐과 '지금 화면'(aria-current)을 같은 규칙으로 — 함께 맡는 주소(일정 ↔ 기록)에서도 읽는 기계가 알게
                          const isActive = moduleMatchLength(item, location.pathname) > 0
                          return (
                        <Link
                          to={item.path}
                          onClick={onNavigate}
                          title={collapsed ? item.label : item.hint}
                          aria-current={isActive ? 'page' : undefined}
                          className={`relative flex min-h-11 items-center gap-3 rounded-(--radius-control) px-3 py-2.5 text-[0.95rem] font-medium transition-colors ${collapsed ? 'justify-center px-0' : ''} ${
                            isActive ? 'active bg-brand-600 text-white' : 'text-navy-200 hover:bg-navy-800 hover:text-white'
                          }`}
                        >
                              {isActive && !collapsed && (
                                <span
                                  aria-hidden="true"
                                  className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-white/90"
                                />
                              )}
                              <item.icon
                                aria-hidden="true"
                                className={`size-5 shrink-0 ${isActive ? 'text-white' : group.key === 'tools' ? 'nav-ramp' : navAccentClass(item.accent)}`}
                                style={!isActive && group.key === 'tools' ? rampStyle(idx, items.length) : undefined}
                              />
                              {!collapsed && <span className="truncate">{item.label}</span>}
                              <NavBadge kind={item.badge} counts={counts} active={isActive} collapsed={collapsed} />
                              {!collapsed && item.status === 'soon' && (
                                <span
                                  className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[0.75rem] font-semibold ${
                                    isActive ? 'bg-white/20 text-white' : 'bg-navy-800 text-navy-200'
                                  }`}
                                >
                                  {/* D-120: 배지는 작게 — 메뉴 이름(1차 미팅 체크리스트)이 잘리지 않게 */}
                                  준비 중
                                </span>
                              )}
                              {!collapsed && item.status === 'next' && (
                                <span
                                  className={`ml-auto shrink-0 rounded-full border px-1.5 py-0.5 text-[0.75rem] font-semibold tracking-wide ${
                                    isActive ? 'border-white/40 text-white' : 'border-navy-600 text-navy-300'
                                  }`}
                                >
                                  다음
                                </span>
                              )}
                        </Link>
                          )
                        })()
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
      <div className="shrink-0 border-t border-navy-800 px-3 py-3">
        {/* D-120: 휴대폰 서랍에서는 글자 크기를 바로 — 머리줄에 자리가 없다 */}
        {onCloseMobile && (
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <span className="text-[0.9rem] text-navy-200">글자 크기</span>
            <TextScaleQuickButton showLabel />
          </div>
        )}
        <SidebarAccount collapsed={collapsed} />
        {!collapsed && (
          <p className="t-meta truncate px-3 pt-2 pb-1 text-navy-300" title={`${brand.productSubtitle} · ${APP_VERSION}`}>
            {brand.productSubtitle} · <span className="text-navy-200">{APP_VERSION}</span>
          </p>
        )}
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
            className={`flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-(--radius-control) px-3 py-2 text-[0.9rem] text-navy-200 hover:bg-navy-800 hover:text-white ${collapsed ? 'justify-center px-0' : ''}`}
          >
            {collapsed ? <ChevronsRight aria-hidden="true" className="size-[18px] shrink-0" /> : (<><ChevronsLeft aria-hidden="true" className="size-[18px] shrink-0" /><span>사이드바 접기</span></>)}
          </button>
        )}
      </div>
    </div>
  )
}

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  return (
    <>
      <aside className={`no-print sticky top-0 hidden h-screen shrink-0 transition-[width] duration-200 lg:block ${collapsed ? 'w-[80px]' : 'w-64 xl:w-72'}`}>
        <SidebarContent collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
      </aside>
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
 * D-102: 도구함 아이콘 색 — 맨 위(세금 계산기)부터 아래로 색상(hue)만 조금씩 옮겨 간다.
 * 밝기·채도는 한 가지로 묶어(톤 일정) 튀지 않게 하고, 시작 색상은 지금 테마의 강조색에서 잡는다(테마를 바꾸면 같이 옮겨 간다).
 * 전체 폭은 84° — 한 칸에 84/(n-1)° 씩(8칸이면 12°). 더 넓히면 맨 아래가 딴 색처럼 튄다.
 */
function rampStyle(index: number, count: number): CSSProperties {
  const step = count > 1 ? 84 / (count - 1) : 0
  return { ['--ramp-shift' as string]: String(Math.round(index * step)) }
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
        title={collapsed ? item.label : item.hint}
        className={`relative flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-(--radius-control) px-3 py-2.5 text-left text-[0.95rem] font-medium text-navy-200 transition-colors hover:bg-navy-800 hover:text-white ${collapsed ? 'justify-center px-0' : ''}`}
      >
        <item.icon aria-hidden="true" className={`size-5 shrink-0 ${navAccentClass(item.accent)}`} />
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
  const text = n > 99 ? '99+' : String(n)
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
      <span data-nav-badge={kind} aria-label={label} className="absolute top-1 right-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[0.8125rem] font-bold text-white tabular-nums">
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
