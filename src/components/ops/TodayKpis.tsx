/**
 * D-282 오늘 화면 맨 위 KPI 다섯 칸 — 화면이 이미 센 숫자만 쓴다(지어낸 숫자 0).
 *   오늘 처리할 업무 = 기한이 오늘까지인 안 끝난 할 일(제목 '오늘 할 일 n건' 과 같은 수)
 *   진행 중 고객사   = 보관하지 않은 업체(계약 · 잠재)
 *   확인 필요 항목   = '확인할 것' 과 같은 판정(buildAllDecisions)
 *   최근 AI 작업     = AI 전략실 지난 7일 실행 — 기능 권한이 있는 사람만(팀장 화면에는 칸이 없다)
 *   상담 · 후속      = 새 상담신청(대표) + 업체 약속(지난 것 · 오늘 · 내일)
 * 누르면 그 목록으로. 0 이면 색 없음(화면 규칙 §2).
 */
import { useContext, useEffect, useState } from 'react'
import { CalendarClock, CheckCheck, ListTodo, MessagesSquare, Sparkles, Users } from 'lucide-react'
import { KpiCard } from '../ui/visual'
import { ScrollHintRow } from '../ui/ScrollHintRow'
import { useOwnerAiAccess } from '../../auth/ownerAiAccess'
import { AuthContext } from '../../auth/authContext'
import { nowDate } from '../../lib/appClock'

interface Props {
  todo: { open: number; overdue: number; hard: number }
  clients: { contract: number; prospect: number }
  decisions: number
  follow: { events: number; appointments: number; lateAppointments: number }
  pilot: boolean
  phone: boolean
  onTodos: () => void
  onFollow: () => void
}

interface RecentAi {
  count: number
  latest: { caseId: string; task: string; company: string } | null
}

/**
 * 지난 7일 AI 전략실 실행 — AI 전략실 문지기(useOwnerAiAccess)가 'yes' 인 사람만. 아니면 null(칸 없음) · 못 읽어도 null.
 * AI 전략실 저장소 · 이름표는 그때 불러온다(오늘 화면 첫 파일에 넣지 않는다). 데이터는 DB 정책이 따로 막는다.
 */
function useRecentAiRuns(enabled: boolean): RecentAi | null {
  const auth = useContext(AuthContext)
  const workspaceId = auth?.currentWorkspaceId ?? null
  const userId = auth?.session?.user.id ?? null
  const [state, setState] = useState<RecentAi | null>(null)
  useEffect(() => {
    if (!enabled) {
      setState(null)
      return
    }
    let alive = true
    void (async () => {
      try {
        const [{ ownerAiRepo }, { SKILL_META }] = await Promise.all([import('../../services/ownerAi/repo'), import('../../services/ownerAi/skillCatalog')])
        const repo = ownerAiRepo({ workspaceId, userId })
        const since = new Date(nowDate().getTime() - 7 * 86_400_000).toISOString()
        const [runs, cases] = await Promise.all([repo.listRunsSince(since), repo.listCases()])
        if (!alive) return
        const last = [...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
        const company = last ? (cases.find((c) => c.id === last.caseId)?.companyName ?? '') : ''
        setState({ count: runs.length, latest: last ? { caseId: last.caseId, task: SKILL_META[last.skillId]?.name ?? 'AI 작업', company } : null })
      } catch {
        if (alive) setState(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [enabled, workspaceId, userId])
  return state
}

export function TodayKpis({ todo, clients, decisions, follow, pilot, phone, onTodos, onFollow }: Props) {
  const aiOpen = useOwnerAiAccess() === 'yes'
  const ai = useRecentAiRuns(!pilot && aiOpen)
  const latest = ai?.latest ?? null
  const followCount = (pilot ? 0 : follow.events) + follow.appointments
  const cards = [
    <KpiCard
      key="todo"
      testId="kpi-todo"
      icon={ListTodo}
      tone="indigo"
      label="오늘 처리할 업무"
      value={`${todo.open}건`}
      urgency={todo.overdue > 0 || todo.hard > 0 ? 'danger' : 'neutral'}
      hint={[todo.overdue > 0 ? `밀린 것 ${todo.overdue}건` : '', todo.hard > 0 ? `놓치면 끝나는 기한 ${todo.hard}건` : ''].filter(Boolean).join(' · ') || (todo.open === 0 ? '오늘 기한인 할 일 없음' : '오늘까지 할 일')}
      onClick={onTodos}
    />,
    <KpiCard
      key="clients"
      testId="kpi-clients"
      icon={Users}
      tone="blue"
      label="진행 중 고객사"
      value={`${clients.contract + clients.prospect}곳`}
      hint={`계약 ${clients.contract}곳 · 잠재 ${clients.prospect}곳`}
      to="/ops/clients"
    />,
    <KpiCard
      key="decide"
      testId="kpi-decide"
      icon={CheckCheck}
      tone="indigo"
      label="확인 필요 항목"
      value={`${decisions}개`}
      urgency={decisions > 0 ? 'brand' : 'neutral'}
      hint={decisions > 0 ? '맞다 · 아니다만 고르면 끝' : '확인할 것 없음'}
      to="/ops/decide"
    />,
    ...(ai
      ? [
          <KpiCard
            key="ai"
            testId="kpi-ai"
            icon={Sparkles}
            tone="purple"
            label="최근 AI 작업"
            value={`${ai.count}건`}
            hint={latest ? `지난 7일 · 최근 ${latest.task}${latest.company ? ` · ${latest.company}` : ''}` : '지난 7일 실행 없음'}
            to={latest ? `/ai/${latest.caseId}` : '/ai'}
          />,
        ]
      : []),
    <KpiCard
      key="follow"
      testId="kpi-follow"
      icon={pilot ? CalendarClock : MessagesSquare}
      tone={pilot ? 'teal' : 'rose'}
      label={pilot ? '후속 약속' : '상담 · 후속'}
      value={`${followCount}건`}
      urgency={follow.lateAppointments > 0 ? 'warning' : !pilot && follow.events > 0 ? 'brand' : 'neutral'}
      hint={[!pilot ? `새 상담신청 ${follow.events}` : '', `업체 약속 ${follow.appointments}${follow.lateAppointments > 0 ? `(지난 것 ${follow.lateAppointments})` : ''}`].filter(Boolean).join(' · ')}
      onClick={onFollow}
    />,
  ]
  if (phone) {
    return (
      <section aria-label="오늘 숫자" data-testid="today-kpis">
        <ScrollHintRow fade="from-white via-white/90" innerClassName="flex gap-2 pb-1">
          {cards.map((c) => (
            <div key={c.key} className="w-[10.5rem] shrink-0">
              {c}
            </div>
          ))}
        </ScrollHintRow>
      </section>
    )
  }
  return (
    <section aria-label="오늘 숫자" data-testid="today-kpis" className={`ax-stagger grid grid-cols-2 gap-2.5 md:grid-cols-3 ${cards.length >= 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
      {cards}
    </section>
  )
}
