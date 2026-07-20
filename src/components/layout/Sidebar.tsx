import { NavLink } from 'react-router-dom'
import { BookOpen, ChevronsLeft, ChevronsRight, X } from 'lucide-react'
import { APP_VERSION, NAVIGATION_GROUPS } from '../../data/navigation'
import { useToast } from '../ui/toastContext'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

interface SidebarContentProps {
  collapsed: boolean
  onToggleCollapsed?: () => void
  onNavigate?: () => void
  onCloseMobile?: () => void
}

function SidebarContent({
  collapsed,
  onToggleCollapsed,
  onNavigate,
  onCloseMobile,
}: SidebarContentProps) {
  const { showToast } = useToast()

  return (
    <div className="flex h-full flex-col bg-navy-900 text-navy-200">
      {/* 로고 */}
      <div
        className={`flex h-16 shrink-0 items-center border-b border-navy-800 ${
          collapsed ? 'justify-center px-2' : 'justify-between px-5'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-[13px] font-bold text-white"
          >
            AX
          </span>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[11px] text-navy-300">김팀장의</p>
              <p className="truncate text-sm font-semibold text-white">
                AX MVP Factory OS
              </p>
            </div>
          )}
        </div>
        {onCloseMobile && (
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={onCloseMobile}
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-navy-300 hover:bg-navy-800 hover:text-white"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>

      {/* 내비게이션 — 업무 흐름 중심 그룹 */}
      <nav aria-label="주 메뉴" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-5">
          {NAVIGATION_GROUPS.map((group) => (
            <li key={group.key}>
              {!collapsed && group.title && (
                <p
                  id={`nav-group-${group.key}`}
                  className="px-3 pb-1.5 text-[11px] font-semibold tracking-wide text-navy-300 uppercase"
                >
                  {group.title}
                </p>
              )}
              <ul
                aria-labelledby={!collapsed && group.title ? `nav-group-${group.key}` : undefined}
                aria-label={collapsed && group.title ? group.title : undefined}
                className="flex flex-col gap-1"
              >
                {group.items.map((item) => (
                  <li key={item.key}>
                    <NavLink
                      to={item.path}
                      end={item.path === '/'}
                      onClick={onNavigate}
                      title={collapsed ? (item.hint ? `${item.label} (${item.hint})` : item.label) : item.hint}
                      className={({ isActive }) =>
                        `flex min-h-11 items-center gap-3 rounded-(--radius-control) px-3 py-2.5 text-[15px] font-medium transition-colors ${
                          collapsed ? 'justify-center px-0' : ''
                        } ${
                          isActive
                            ? 'bg-brand-600 text-white'
                            : 'text-navy-200 hover:bg-navy-800 hover:text-white'
                        }`
                      }
                    >
                      {typeof item.step === 'number' ? (
                        <span
                          aria-hidden="true"
                          className="flex size-5 shrink-0 items-center justify-center rounded-md bg-navy-800 text-[11px] font-bold text-navy-200"
                        >
                          {item.step}
                        </span>
                      ) : (
                        <item.icon aria-hidden="true" className="size-5 shrink-0" />
                      )}
                      {!collapsed && (
                        <span className="truncate">
                          {typeof item.step === 'number' && (
                            <span className="sr-only">{item.step}단계 </span>
                          )}
                          {item.label}
                        </span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      {/* 하단: 버전 / 사용 가이드 / 접기 */}
      <div className="shrink-0 border-t border-navy-800 px-3 py-3">
        {!collapsed && (
          <p className="px-3 pb-2 text-[11px] text-navy-300">
            현재 버전 <span className="font-medium text-navy-200">{APP_VERSION}</span>
          </p>
        )}
        <button
          type="button"
          onClick={() => showToast('사용 가이드는 다음 개발 단계에서 제공됩니다.')}
          title={collapsed ? '사용 가이드' : undefined}
          className={`flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-(--radius-control) px-3 py-2 text-sm text-navy-200 hover:bg-navy-800 hover:text-white ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          <BookOpen aria-hidden="true" className="size-[18px] shrink-0" />
          {!collapsed && <span>사용 가이드</span>}
        </button>
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
            className={`mt-1 flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-(--radius-control) px-3 py-2 text-sm text-navy-200 hover:bg-navy-800 hover:text-white ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            {collapsed ? (
              <ChevronsRight aria-hidden="true" className="size-[18px] shrink-0" />
            ) : (
              <>
                <ChevronsLeft aria-hidden="true" className="size-[18px] shrink-0" />
                <span>사이드바 접기</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  return (
    <>
      {/* 데스크톱 사이드바 */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 transition-[width] duration-200 lg:block ${
          collapsed ? 'w-[76px]' : 'w-60 xl:w-64'
        }`}
      >
        <SidebarContent collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
      </aside>

      {/* 모바일/태블릿 오버레이 사이드바 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="메뉴 배경 닫기"
            onClick={onCloseMobile}
            className="absolute inset-0 cursor-default bg-navy-950/50"
          />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] shadow-(--shadow-overlay)">
            <SidebarContent
              collapsed={false}
              onNavigate={onCloseMobile}
              onCloseMobile={onCloseMobile}
            />
          </div>
        </div>
      )}
    </>
  )
}
