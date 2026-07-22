import { NavLink, useNavigate } from 'react-router-dom'
import {
  Building2,
  CheckSquare,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FileCheck2,
  Filter,
  FolderOpen,
  Landmark,
  Library,
  ListChecks,
  Palette,
  PencilRuler,
  SearchCheck,
  Settings,
  TrendingUp,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { APP_VERSION } from '../../data/navigation'
import { useActiveProject } from '../../context/activeProject'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { isAdvancedVisible } from '../../lib/featureVisibility'

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
function buildGroups(
  activeProjectId: string | null,
  projectType: string | undefined,
  advanced: boolean,
): NavGroup[] {
  const pid = activeProjectId
  // 프로젝트 유형별 핵심 메뉴 — AX: 진단·선택·AX설계 / 홈페이지: 홈페이지 설계 / 혼합: 모두
  const workspaceItems: NavItem[] = pid
    ? [
        ...(projectType !== 'website'
          ? [{ label: '기업 진단', path: `/diagnosis/projects/${pid}/setup`, icon: ClipboardList }]
          : []),
        ...(projectType !== 'website' ? [{ label: '만들 업무 선택', path: `/selection/projects/${pid}`, icon: Filter }] : []),
        ...(projectType !== 'website' ? [{ label: 'AX 기능 설계', path: `/mvp-design/projects/${pid}`, icon: PencilRuler }] : []),
        ...(projectType !== 'ax' ? [{ label: '홈페이지 설계', path: `/website-studio/projects/${pid}`, icon: Palette }] : []),
        { label: '결과자료', path: `/deliverables/projects/${pid}`, icon: FolderOpen },
      ]
    : []
  const advancedItems: NavItem[] = advanced
    ? [
        ...(pid ? [{ label: '실제 사용 테스트', path: `/validation/projects/${pid}`, icon: SearchCheck }] : []),
        ...(pid ? [{ label: '기관·자금 연계', path: `/funding/projects/${pid}`, icon: Landmark }] : []),
        { label: '검증 결과', path: '/validation/results', icon: ListChecks },
        { label: '사례 라이브러리', path: '/cases', icon: Library },
        { label: '전체 진행 현황', path: '/reports', icon: TrendingUp },
      ]
    : []

  return [
    { key: 'today', title: '오늘 할 일', items: [{ label: '오늘 할 일', path: '/', icon: CheckSquare }] },
    { key: 'clients', title: '고객·프로젝트', items: [{ label: '고객사·프로젝트', path: '/clients', icon: Building2 }] },
    { key: 'workspace', title: '작업공간', items: workspaceItems },
    // 결과자료는 최상위 1개만 — 프로젝트 선택 시 작업공간의 '결과자료'가 대표이므로
    // 전체 목록 메뉴는 프로젝트 미선택 상태에서만 표시한다(같은 목적의 메뉴 중복 금지).
    ...(!pid
      ? [
          {
            key: 'results',
            title: '결과·자료',
            items: [{ label: '결과자료', path: '/deliverables/results', icon: FileCheck2 }],
          },
        ]
      : []),
    ...(advancedItems.length > 0 ? [{ key: 'advanced', title: '고급 운영', items: advancedItems }] : []),
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
  const { project } = useActiveProject()
  useStoreVersion()
  const groups = buildGroups(project?.id ?? null, project?.projectType, isAdvancedVisible())

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
              {group.key === 'workspace' && group.items.length === 0 ? (
                !collapsed && (
                  <div className="px-3 py-1.5">
                    <p className="text-[0.85rem] leading-snug break-keep text-navy-300/80">먼저 작업할 프로젝트를 선택하세요.</p>
                    <button
                      type="button"
                      onClick={() => { navigate('/clients'); onNavigate?.() }}
                      className="mt-2 w-full cursor-pointer rounded-(--radius-control) border border-navy-700 px-3 py-2 text-[0.875rem] font-medium text-navy-100 hover:bg-navy-800"
                    >
                      프로젝트 선택하기
                    </button>
                  </div>
                )
              ) : (
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
              )}
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
