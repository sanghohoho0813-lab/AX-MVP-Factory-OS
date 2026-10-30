import { useMemo, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2, Square, X } from 'lucide-react'
import { activeWeekRun, markWeekSeen, stopWeekAi, subscribeWeek, weekVersion } from '../../services/marketing/weekRun'
import { weekStart } from '../../services/marketing/weekPlan'
import { todayLocalDate } from '../../lib/appClock'

/**
 * D-350 1주일치 쓰는 중 — 어느 화면에서나 아래에 작게(대표: "멈춤을 안 누르면 뒤로 가기 · 고객 관리 · 특허 벤처를 눌러도 알아서 돌아가게").
 * 쓰는 중이면 [보기] · [멈추기], 다 썼는데 아직 안 봤으면 '다 썼어요' [보기] · 닫기. 1주일치 화면에 있으면 띄우지 않는다(그 화면에 다 있다).
 */
export function WeekRunDock() {
  const version = useSyncExternalStore(subscribeWeek, weekVersion)
  const active = useMemo(() => activeWeekRun(), [version]) // eslint-disable-line react-hooks/exhaustive-deps
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  if (!active) return null
  const onWeek = pathname === '/marketing' && new URLSearchParams(search).get('week') === '1'
  if (onWeek) return null
  const { start, run } = active
  const states = Object.values(run.parts)
  const running = states.includes('running')
  const done = states.filter((s) => s === 'done').length
  const failed = states.filter((s) => s === 'error').length
  const open = () => {
    if (!running) markWeekSeen(start)
    navigate(`/marketing?week=1${start === weekStart(todayLocalDate()) ? '' : `&start=${start}&from=make`}`)
    window.scrollTo({ top: 0 })
  }
  return (
    <div
      role="status"
      className="no-print fixed bottom-[calc(4.35rem+env(safe-area-inset-bottom))] left-4 z-30 flex max-w-[calc(100vw-6rem)] items-center gap-1.5 rounded-full border border-violet-200 bg-white py-1 pr-1 pl-3 shadow-(--shadow-overlay) lg:right-[calc(var(--dock-float,0px)+var(--side-reserve,0px)+5rem)] lg:bottom-6 lg:left-auto"
      data-testid="week-dock"
      data-state={running ? 'running' : 'done'}
    >
      {running ? <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin text-violet-700" /> : <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success-600" />}
      {/* 휴대폰은 짧게(아래 메뉴 위 한 줄 · 숫자가 잘리지 않게) */}
      <span className="t-sub min-w-0 truncate font-semibold text-slate-900">
        <span className="sm:hidden">{running ? `1주일치 ${done}/6` : failed ? `1주일치 ${failed}개 실패` : '1주일치 다 씀'}</span>
        <span className="hidden sm:inline">{running ? `1주일치 쓰는 중 ${done}/6` : failed ? `1주일치 다 썼어요(${failed}갈래 실패)` : '1주일치 다 썼어요'}</span>
      </span>
      <button type="button" onClick={open} className="tap t-sub shrink-0 rounded-full bg-violet-600 px-3 font-bold text-white hover:bg-violet-700" data-testid="week-dock-open">
        보기
      </button>
      {running ? (
        <button type="button" onClick={() => stopWeekAi(start)} className="tap t-sub inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 font-semibold text-slate-700 hover:bg-slate-100" data-testid="week-dock-stop">
          <Square aria-hidden="true" className="size-3.5" /> 멈추기
        </button>
      ) : (
        <button type="button" onClick={() => markWeekSeen(start)} aria-label="알림 닫기" className="tap inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" data-testid="week-dock-close">
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  )
}
