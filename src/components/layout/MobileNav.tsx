/**
 * 모바일 하단 내비게이션.
 *
 * 대표가 하루에 여러 번 오가는 곳은 사실 다섯 군데뿐이다. 그 다섯 개만 아래에
 * 두고, 나머지(AX 스튜디오·도구·설정)는 '더보기' 로 접는다. 서랍 메뉴만으로는
 * 화면을 옮길 때마다 두 번씩 눌러야 해서 한 손으로 쓰기 어렵다.
 *
 * 1024px 이상에서는 왼쪽 사이드바가 그 역할을 하므로 나타나지 않는다.
 */

import { useNavCounts } from './useNavCounts'
import { Link } from 'react-router-dom'
import { useNavPath } from '../../lib/navFrom'
import { CalendarDays, Inbox, LayoutGrid, ListChecks, Sun } from 'lucide-react'
import { navAccentClass, type NavAccent } from '../../config/moduleRegistry'

interface NavItem {
  to: string
  label: string
  icon: typeof Sun
  /** 서랍(햄버거) 메뉴의 같은 항목과 같은 아이콘 색 — moduleRegistry 의 accent */
  accent: NavAccent
  /** 이 경로들로 시작하면 선택된 것으로 본다 */
  match?: string[]
}

/** 서랍 메뉴 순서와 같다: 오늘 → 일정 → 고객 → 상담신청 (D-108) */
const ITEMS: NavItem[] = [
  { to: '/', label: '오늘', icon: Sun, accent: 'overview', match: ['/'] },
  { to: '/ops/calendar', label: '일정', icon: CalendarDays, accent: 'evidence', match: ['/ops/calendar', '/journal'] },
  { to: '/ops/clients', label: '고객', icon: ListChecks, accent: 'ops', match: ['/ops/clients'] },
  { to: '/ops/inbox', label: '상담신청', icon: Inbox, accent: 'alert', match: ['/ops/inbox'] },
]

/* 고른 칸의 옅은 바탕 — Tailwind 는 적힌 글자만 만들므로 통째로 적는다 */
const ACTIVE_BG: Record<NavAccent, string> = {
  overview: 'bg-nav-overview/15',
  ops: 'bg-nav-ops/15',
  revenue: 'bg-nav-revenue/15',
  customer: 'bg-nav-customer/15',
  ai: 'bg-nav-ai/15',
  evidence: 'bg-nav-evidence/15',
  alert: 'bg-nav-alert/15',
  system: 'bg-nav-system/15',
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.to === '/') return pathname === '/'
  return (item.match ?? [item.to]).some((m) => pathname === m || pathname.startsWith(m + '/'))
}

export function MobileNav({ onOpenMore }: { onOpenMore: () => void }) {
  // D-124: 영업에서 온 업체 화면이면 '고객' 칸에 불을 켜지 않는다
  const pathname = useNavPath()
  const counts = useNavCounts()

  return (
    <nav
      aria-label="주요 화면"
      className="no-print pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
    >
      <ul className="flex items-stretch">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item)
          const Icon = item.icon
          const requests = item.to === '/ops/inbox' ? (counts.requests ?? 0) : 0
          const clients = item.to === '/ops/clients' ? counts.clients : null
          return (
            <li key={item.to} className="min-w-0 flex-1">
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-0 py-1.5"
              >
                <span
                  className={`relative flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? ACTIVE_BG[item.accent] : ''}`}
                >
                  <Icon aria-hidden="true" className={`size-5 ${navAccentClass(item.accent)}`} />
                  {/* D-104 · D-108: 처리 안 한 상담신청 수 — 빨간 바탕 흰 숫자, 흰 테두리로 아이콘과 떼어 바로 보이게 (0 이면 없음) */}
                  {requests > 0 && (
                    <span
                      data-nav-badge="requests"
                      aria-label={`새 상담신청 ${requests}건`}
                      className="absolute -top-1 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger-500 px-1 text-[0.8125rem] leading-none font-bold text-white tabular-nums shadow-sm ring-2 ring-white"
                    >
                      {requests > 99 ? '99+' : requests}
                    </span>
                  )}
                </span>
                <span className="flex items-baseline gap-0.5 whitespace-nowrap">
                  <span
                    className={`t-meta ${
                      active ? 'font-semibold text-slate-900' : requests > 0 ? 'font-semibold text-danger-600' : 'font-medium text-slate-500'
                    }`}
                  >
                    {item.label}
                  </span>
                  {/* D-108 · D-114: 계약 고객 수 — 아주 작게, 튀지 않는 색 (0 도 보인다) */}
                  {clients !== null && (
                    <span data-nav-badge="clients" aria-label={`계약 고객 ${clients}곳`} className="text-[0.75rem] leading-none font-medium text-slate-400 tabular-nums">
                      {clients > 999 ? '999+' : clients}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          )
        })}
        <li className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpenMore}
            className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-0 py-1.5 whitespace-nowrap text-slate-500"
          >
            {/* 더보기 = 서랍 — 서랍 속 컨설팅 작업실 첫 아이콘과 같은 색(테마를 따라간다) */}
            <span className="flex h-7 w-12 items-center justify-center">
              <LayoutGrid aria-hidden="true" className="nav-ramp size-5" />
            </span>
            <span className="t-meta font-medium">더보기</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
