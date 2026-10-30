/**
 * D-360 오늘 화면 맨 위 한 줄 — 이번 주 1주일치 프로젝트에서 '오늘 올릴 것'.
 * 대표는 아침에 오늘 화면을 먼저 연다 — 마케팅 화면을 따로 열지 않아도 오늘 올릴 글(스레드 · 쇼츠 · 롱폼)이 한 줄로,
 * 누르면 그 탭으로(?week=1&start=&wt=). 이번 주(오늘이 든 주) 프로젝트가 없으면 그리지 않는다.
 * 마케팅은 대표 전용 — 팀장(Pilot)은 마케팅이 열린 계정만.
 */
import { useMemo, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Megaphone } from 'lucide-react'
import { todayLocalDate } from '../../../lib/appClock'
import { useIsPilot } from '../../../auth/osAccess'
import { usePilotMarketing } from '../../../config/pilotMarketing'
import { dayLabel } from '../../../services/marketing/weekPlan'
import { postingDay, postsOfDay } from '../../../services/marketing/todayPosts'
import { allWeeks, subscribeWeek, weekSaved, weekVersion } from '../../../services/marketing/weekRun'

export default function TodayPosts() {
  const pilot = useIsPilot()
  const open = usePilotMarketing() === 'open'
  const version = useSyncExternalStore(subscribeWeek, weekVersion)
  const today = todayLocalDate()
  const { monday, day } = postingDay(today)
  const has = useMemo(() => !!(weekSaved(monday) ?? allWeeks().find((w) => w.start === monday)), [monday, version]) // eslint-disable-line react-hooks/exhaustive-deps
  if ((pilot && !open) || !has) return null
  const items = postsOfDay(day)
  if (!items.length) return null
  return (
    <Link
      to={`/marketing?week=1&start=${monday}&wt=${items[0].tab}`}
      className="tap t-sub inline-flex max-w-full min-w-0 items-center gap-1.5 self-start rounded-full border border-violet-200 bg-violet-50 px-3 py-1 font-semibold text-violet-900 hover:bg-violet-100"
      data-testid="today-posts"
    >
      <Megaphone aria-hidden="true" className="size-4 shrink-0 text-violet-700" />
      <span className="min-w-0 truncate">
        오늘 올릴 것 · {dayLabel(monday, day)} {items.map((x) => x.text).join(' · ')}
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
    </Link>
  )
}
