/**
 * 일정 안의 탭 (D-103) — 달력 · 오늘 기록 · 주간 돌아보기 · 전체 기록.
 *
 * 예전에는 기록 셋이 '가끔 쓰는 것' 에 따로 세 줄로 있었다. "일정 안으로 합치자" 는 지시로
 * 일정 한 곳에서 탭으로 오간다. 주소는 그대로(/ops/calendar · /journal · /journal/week · /journal/all) —
 * 오늘 화면·알림에서 걸어 둔 링크가 깨지지 않는다.
 */
import { NavLink } from 'react-router-dom'
import { CalendarDays, CalendarRange, History, NotebookPen, type LucideIcon } from 'lucide-react'

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/ops/calendar', label: '달력', icon: CalendarDays },
  { to: '/journal', label: '오늘 기록', icon: NotebookPen },
  { to: '/journal/week', label: '주간 돌아보기', icon: CalendarRange },
  { to: '/journal/all', label: '전체 기록', icon: History },
]

export function ScheduleTabs() {
  return (
    <nav aria-label="일정 보기" data-testid="schedule-tabs" className="no-print">
      {/* 휴대폰: 네 칸이 한 줄에 다 보이게(아이콘 위 · 글 아래) — 옆으로 밀어야 보이던 '전체 기록' 이 없게 */}
      <ul className="grid grid-cols-4 gap-1 rounded-(--radius-control) border border-slate-200 bg-white p-1 sm:inline-flex sm:w-auto">
        {TABS.map((t) => (
          <li key={t.to} className="min-w-0">
            <NavLink
              to={t.to}
              end
              className={({ isActive }) =>
                `tap flex h-full flex-col items-center justify-center gap-0.5 rounded-[8px] px-1 py-1.5 text-center font-semibold break-keep sm:flex-row sm:gap-1.5 sm:px-3 sm:py-2 ${
                  isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <t.icon aria-hidden="true" className="size-4 shrink-0" />
              <span className="text-[0.8rem] leading-tight sm:text-[0.9rem] sm:whitespace-nowrap">{t.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
