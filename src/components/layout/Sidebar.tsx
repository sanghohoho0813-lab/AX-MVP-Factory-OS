import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronsLeft, ChevronsRight, X } from 'lucide-react'
import { APP_VERSION } from '../../data/navigation'
import { brand } from '../../brand/brand.config'
import { BrandLogo } from '../brand/BrandLogo'
import {
  enabledModulesByGroup,
  groupAccentClass,
  navAccentClass,
  type ModuleGroupKey,
} from '../../config/moduleRegistry'
import { readRaw, writeRaw } from '../../storage/localStore'

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
  const groups = enabledModulesByGroup()
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
      <div className={`flex h-16 shrink-0 items-center border-b border-navy-800 ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        <button
          type="button"
          onClick={() => { navigate('/'); onNavigate?.() }}
          aria-label={`${brand.productName} 홈으로`}
          className="flex min-w-0 cursor-pointer items-center gap-2.5"
        >
          {collapsed ? (
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[0.9rem] font-black text-white">
              M
            </span>
          ) : (
            <span className="flex min-w-0 flex-col items-start gap-0.5">
              <BrandLogo tone="dark" imgClassName="h-8 max-w-[164px]" />
              <span className="truncate text-[0.72rem] font-semibold tracking-wide text-navy-300">
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
            const containsActive = items.some((m) =>
              m.exact ? location.pathname === m.path : location.pathname === m.path || location.pathname.startsWith(`${m.path}/`),
            )
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
                      className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-3 pb-1.5 text-[0.8rem] font-semibold tracking-wide text-navy-300 hover:text-white"
                    >
                      <span aria-hidden="true" className={`h-3 w-1 shrink-0 rounded-full ${groupAccentClass(group.accent)}`} />
                      <span className="flex-1 text-left">{group.title}</span>
                      <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                    </button>
                  ) : (
                    <p id={`nav-${group.key}`} className="flex items-center gap-1.5 px-3 pb-1.5 text-[0.8rem] font-semibold tracking-wide text-navy-300">
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
                    {items.map((item) => (
                      <li key={item.key}>
                        <NavLink
                          to={item.path}
                          end={item.exact === true}
                          onClick={onNavigate}
                          title={collapsed ? item.label : item.hint}
                          className={({ isActive }) =>
                            `relative flex min-h-11 items-center gap-3 rounded-(--radius-control) px-3 py-2.5 text-[0.95rem] font-medium transition-colors ${collapsed ? 'justify-center px-0' : ''} ${
                              isActive ? 'bg-brand-600 text-white' : 'text-navy-200 hover:bg-navy-800 hover:text-white'
                            }`
                          }
                        >
                          {({ isActive }: { isActive: boolean }) => (
                            <>
                              {isActive && !collapsed && (
                                <span
                                  aria-hidden="true"
                                  className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-white/90"
                                />
                              )}
                              <item.icon
                                aria-hidden="true"
                                className={`size-5 shrink-0 ${isActive ? 'text-white' : navAccentClass(item.accent)}`}
                              />
                              {!collapsed && <span className="truncate">{item.label}</span>}
                            </>
                          )}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-navy-800 px-3 py-3">
        {!collapsed && (
          <p className="px-3 pb-2 text-[0.8rem] text-navy-300">
            {brand.productSubtitle} · <span className="font-medium text-navy-200">{APP_VERSION}</span>
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
      <aside className={`sticky top-0 hidden h-screen shrink-0 transition-[width] duration-200 lg:block ${collapsed ? 'w-[80px]' : 'w-64 xl:w-72'}`}>
        <SidebarContent collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="메뉴 배경 닫기" onClick={onCloseMobile} className="absolute inset-0 cursor-default bg-navy-950/50" />
          <div className="absolute inset-y-0 left-0 w-[300px] max-w-[85vw] shadow-(--shadow-overlay)">
            <SidebarContent collapsed={false} onNavigate={onCloseMobile} onCloseMobile={onCloseMobile} />
          </div>
        </div>
      )}
    </>
  )
}
