/**
 * D-282 오늘 화면 맨 위 KPI 다섯 칸 — 화면이 이미 센 숫자만 쓴다(지어낸 숫자 0).
 *   오늘 처리할 업무 = 기한이 오늘까지인 안 끝난 할 일(제목 '오늘 할 일 n건' 과 같은 수)
 *   진행 중 고객사   = 보관하지 않은 업체(계약 · 잠재)
 *   확인 필요 항목   = '확인할 것' 과 같은 판정(buildAllDecisions)
 *   최근 AI 작업     = AI 전략실 지난 7일 실행 — 기능 권한이 있는 사람만(팀장 화면에는 칸이 없다)
 *   상담 · 후속      = 새 상담신청(대표) + 업체 약속(지난 것 · 오늘 · 내일)
 * 누르면 그 목록으로. 0 이면 색 없음(화면 규칙 §2).
 * U2(2026-11-05 대표 승인): 큰 칸 다섯 개 → 목록 위 한 줄 요약(칩 다섯) — 숫자 · 셈 · 누르면 가는 곳은 그대로, 설명은 칩에 마우스를 올리면(title).
 */
import { useContext, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, CheckCheck, ListTodo, MessagesSquare, Sparkles, Users, type LucideIcon } from 'lucide-react'
import { ScrollHintRow } from '../ui/ScrollHintRow'
import { useOwnerAiAccess } from '../../auth/ownerAiAccess'
import { AuthContext } from '../../auth/authContext'
import { nowDate } from '../../lib/appClock'

interface Props {
  todo: { open: number; overdue: number; hard: number }
  clients: { contract: number; prospect: number }
  /** null = 아직 모으는 중('–') */
  decisions: number | null
  follow: { events: number; appointments: number; lateAppointments: number }
  pilot: boolean
  phone: boolean
  onTodos: () => void
  onFollow: () => void
  /** D-482 업체 · 할 일을 읽는 동안 — 칸 자리를 미리 잡아(숫자 대신 '–') 다 읽은 뒤 아래 칸이 밀려 내려가지 않게 */
  loading?: boolean
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

export function TodayKpis({ todo, clients, decisions, follow, pilot, phone, onTodos, onFollow, loading = false }: Props) {
  // 읽는 중에는 숫자 · 설명 대신 자리만(지어낸 0 을 잠깐이라도 보이지 않게)
  const val = (text: string) => (loading ? '–' : text)
  const tip = (text: string) => (loading ? '불러오는 중…' : text)
  const aiOpen = useOwnerAiAccess() === 'yes'
  const ai = useRecentAiRuns(!pilot && aiOpen)
  const latest = ai?.latest ?? null
  const followCount = (pilot ? 0 : follow.events) + follow.appointments
  const chips: ChipProps[] = [
    {
      testId: 'kpi-todo',
      icon: ListTodo,
      label: '오늘 처리할 업무',
      value: val(`${todo.open}건`),
      urgency: loading ? 'neutral' : todo.overdue > 0 || todo.hard > 0 ? 'danger' : 'neutral',
      hint: tip([todo.overdue > 0 ? `밀린 것 ${todo.overdue}건` : '', todo.hard > 0 ? `놓치면 끝나는 기한 ${todo.hard}건` : ''].filter(Boolean).join(' · ') || (todo.open === 0 ? '오늘 기한인 할 일 없음' : '오늘까지 할 일')),
      onClick: onTodos,
    },
    {
      testId: 'kpi-clients',
      icon: Users,
      label: '진행 중 고객사',
      value: val(`${clients.contract + clients.prospect}곳`),
      hint: tip(`계약 ${clients.contract}곳 · 잠재 ${clients.prospect}곳`),
      to: '/ops/clients',
    },
    {
      testId: 'kpi-decide',
      icon: CheckCheck,
      label: '확인 필요 항목',
      value: decisions === null ? '–' : val(`${decisions}개`),
      urgency: loading || decisions === null ? 'neutral' : decisions > 0 ? 'brand' : 'neutral',
      hint: decisions === null ? '모으는 중…' : tip(decisions > 0 ? '맞다 · 아니다만 고르면 끝' : '확인할 것 없음'),
      to: '/ops/decide',
    },
    ...(ai
      ? [
          {
            testId: 'kpi-ai',
            icon: Sparkles,
            label: '최근 AI 작업',
            value: val(`${ai.count}건`),
            hint: tip(latest ? `지난 7일 · 최근 ${latest.task}${latest.company ? ` · ${latest.company}` : ''}` : '지난 7일 실행 없음'),
            to: latest ? `/ai/${latest.caseId}` : '/ai',
          } satisfies ChipProps,
        ]
      : []),
    {
      testId: 'kpi-follow',
      icon: pilot ? CalendarClock : MessagesSquare,
      label: pilot ? '후속 약속' : '상담 · 후속',
      value: val(`${followCount}건`),
      urgency: loading ? 'neutral' : follow.lateAppointments > 0 ? 'warning' : !pilot && follow.events > 0 ? 'brand' : 'neutral',
      hint: tip([!pilot ? `새 상담신청 ${follow.events}` : '', `업체 약속 ${follow.appointments}${follow.lateAppointments > 0 ? `(지난 것 ${follow.lateAppointments})` : ''}`].filter(Boolean).join(' · ')),
      onClick: onFollow,
    },
  ]
  const row = chips.map((c) => <SummaryChip key={c.testId} {...c} />)
  if (phone) {
    return (
      <section aria-label="오늘 숫자" data-testid="today-kpis">
        <ScrollHintRow fade="from-white via-white/90" innerClassName="flex gap-2 pb-1">
          {row}
        </ScrollHintRow>
      </section>
    )
  }
  return (
    <section aria-label="오늘 숫자" data-testid="today-kpis" className="flex flex-wrap items-center gap-2">
      {row}
    </section>
  )
}

type Urgency = 'neutral' | 'danger' | 'warning' | 'brand'
interface ChipProps {
  testId: string
  icon: LucideIcon
  label: string
  value: string
  hint: string
  urgency?: Urgency
  to?: string
  onClick?: () => void
}

/** 요약 칩 하나 — 흰 바탕 · 회색 테두리(박스 색 하나) · 급한 것은 숫자 글자색으로만(빨강 = 늦음 · 파랑 = 볼 것 · 주황 = 지난 약속) */
const VALUE_TONE: Record<Urgency, string> = {
  neutral: 'text-slate-900',
  danger: 'text-danger-700',
  warning: 'text-warning-800',
  brand: 'text-brand-700',
}
function SummaryChip({ testId, icon: Icon, label, value, hint, urgency = 'neutral', to, onClick }: ChipProps) {
  const inner: ReactNode = (
    <>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
      <span className="t-sub break-keep whitespace-nowrap text-slate-600">{label}</span>
      <strong className={`t-body font-bold whitespace-nowrap tabular-nums ${VALUE_TONE[urgency]}`}>{value}</strong>
    </>
  )
  const cls = 'tap inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-left hover:border-slate-300 hover:bg-slate-50'
  if (to)
    return (
      <Link to={to} title={hint} aria-label={`${label} ${value} — ${hint}`} className={cls} data-testid={testId}>
        {inner}
      </Link>
    )
  return (
    <button type="button" title={hint} aria-label={`${label} ${value} — ${hint}`} onClick={onClick} className={cls} data-testid={testId}>
      {inner}
    </button>
  )
}
