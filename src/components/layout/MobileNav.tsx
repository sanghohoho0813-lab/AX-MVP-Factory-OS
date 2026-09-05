/**
 * 모바일 하단 내비게이션.
 *
 * 대표가 하루에 여러 번 오가는 곳은 사실 다섯 군데뿐이다. 그 다섯 개만 아래에
 * 두고, 나머지(AX 스튜디오·도구·설정)는 '더보기' 로 접는다. 서랍 메뉴만으로는
 * 화면을 옮길 때마다 두 번씩 눌러야 해서 한 손으로 쓰기 어렵다.
 *
 * 1024px 이상에서는 왼쪽 사이드바가 그 역할을 하므로 나타나지 않는다.
 */

import { NavLink, useLocation } from 'react-router-dom'
import { CalendarDays, Inbox, LayoutGrid, ListChecks, Sun } from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: typeof Sun
  /** 이 경로들로 시작하면 선택된 것으로 본다 */
  match?: string[]
}

const ITEMS: NavItem[] = [
  { to: '/', label: '오늘', icon: Sun, match: ['/'] },
  { to: '/ops/clients', label: '고객', icon: ListChecks, match: ['/ops/clients'] },
  { to: '/ops/inbox', label: '이벤트', icon: Inbox, match: ['/ops/inbox'] },
  { to: '/ops/calendar', label: '일정', icon: CalendarDays, match: ['/ops/calendar', '/journal'] },
]

function isActive(pathname: string, item: NavItem): boolean {
  if (item.to === '/') return pathname === '/'
  return (item.match ?? [item.to]).some((m) => pathname === m || pathname.startsWith(m + '/'))
}

export function MobileNav({ onOpenMore }: { onOpenMore: () => void }) {
  const { pathname } = useLocation()

  return (
    <nav
      aria-label="주요 화면"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
    >
      <ul className="flex items-stretch">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item)
          const Icon = item.icon
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-1.5 ${
                  active ? 'text-brand-700' : 'text-slate-500'
                }`}
              >
                <Icon aria-hidden="true" className={`size-5 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
                <span className="t-meta font-medium">{item.label}</span>
              </NavLink>
            </li>
          )
        })}
        <li className="flex-1">
          <button
            type="button"
            onClick={onOpenMore}
            className="flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 py-1.5 text-slate-500"
          >
            <LayoutGrid aria-hidden="true" className="size-5 text-slate-400" />
            <span className="t-meta font-medium">더보기</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
