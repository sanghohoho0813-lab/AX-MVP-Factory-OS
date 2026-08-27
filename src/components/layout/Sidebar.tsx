import { NavLink, useNavigate } from 'react-router-dom'
import {
  CheckSquare,
  ChevronsLeft,
  ChevronsRight,
  Landmark,
  Settings,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { APP_VERSION } from '../../data/navigation'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

interface NavItem {
  label: string
  path: string
  icon: LucideIcon
}
interface NavGroup {
  key: string
  title: string
  items: NavItem[]
}

/**
 * 전역 메뉴. 기본(core)은 핵심 흐름만 표시하고,
 * 고급 운영 기능(테스트·기관·사례·전체 현황)은 advanced 모드에서만 추가한다.
 */
function buildGroups(): NavGroup[] {
  return [
    { key: 'today', title: '운영', items: [{ label: '고객 운영', path: '/ops/clients', icon: CheckSquare }] },
    {
      key: 'funding',
      title: '지원사업',
      items: [
        { label: '자금·지원사업', path: '/funding', icon: Landmark },
      ],
    },
    { key: 'settings', title: '설정', items: [{ label: '설정', path: '/settings', icon: Settings }] },
  ]
}

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
  const groups = buildGroups()

  return (
    <div className="flex h-full flex-col bg-navy-900 text-navy-200">
      <div className={`flex h-16 shrink-0 items-center border-b border-navy-800 ${collapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
        <button type="button" onClick={() => { navigate('/'); onNavigate?.() }} className="flex min-w-0 cursor-pointer items-center gap-2.5">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-[0.85rem] font-bold text-white">AX</span>
          {!collapsed && <span className="truncate text-[1rem] font-semibold text-white">Factory OS</span>}
        </button>
        {onCloseMobile && (
          <button type="button" aria-label="메뉴 닫기" onClick={onCloseMobile} className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-navy-300 hover:bg-navy-800 hover:text-white">
            <X aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>

      <nav aria-label="주 메뉴" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-5">
          {groups.map((group) => (
            <li key={group.key}>
              {!collapsed && (
                <p id={`nav-${group.key}`} className="px-3 pb-1.5 text-[0.8rem] font-semibold tracking-wide text-navy-300">{group.title}</p>
              )}
              <ul aria-labelledby={!collapsed ? `nav-${group.key}` : undefined} aria-label={collapsed ? group.title : undefined} className="flex flex-col gap-1">
                  {group.items.map((item) => (
                    <li key={item.path + item.label}>
                      <NavLink
                        to={item.path}
                        end={item.path === '/'}
                        onClick={onNavigate}
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          `flex min-h-11 items-center gap-3 rounded-(--radius-control) px-3 py-2.5 text-[0.95rem] font-medium transition-colors ${collapsed ? 'justify-center px-0' : ''} ${
                            isActive ? 'bg-brand-600 text-white' : 'text-navy-200 hover:bg-navy-800 hover:text-white'
                          }`
                        }
                      >
                        <item.icon aria-hidden="true" className="size-5 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </NavLink>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-navy-800 px-3 py-3">
        {!collapsed && <p className="px-3 pb-2 text-[0.8rem] text-navy-300">버전 <span className="font-medium text-navy-200">{APP_VERSION}</span></p>}
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
