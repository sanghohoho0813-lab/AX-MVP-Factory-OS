import { useCallback, useEffect, useMemo, useState } from 'react'
import { TodayCharges } from '../components/money/TodayCharges'
import { TodayCare } from '../components/ops/TodayCare'
import { TodayDecisions } from '../components/ops/DecisionList'
import { useGrantData } from '../components/grants/useGrants'
import { useEntitlements } from '../lib/entitlementsStore'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarClock,
  Clock,
  Copy,
  Inbox,
  KanbanSquare,
  Moon,
  NotebookPen,
} from 'lucide-react'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { Blank, Disclosure, MetricTile } from '../components/ui/primitives'
import { Modal } from '../components/ui/Modal'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/toastContext'
import { QuickCapture } from '../components/journal/QuickCapture'
import { TodoActionSheet, TodoComposer, TodoRow, type TodoAction } from '../components/journal/TodoBoard'
import { JournalList } from '../components/journal/JournalList'
import { EventCard } from '../components/ops/EventCard'
import { LinkCustomerModal } from '../components/ops/LinkCustomerModal'
import { ScreenGuide } from '../components/onboarding/ScreenGuide'
import { listClients } from '../services/clientOpsService'
import { salesActionPath, salesRecontacts, salesRisks } from '../services/salesSignals'
import { agentLedger, agentLedgerTotals, netAmountOf } from '../services/feeMath'
import { CallButton } from '../components/ops/opsControls'
import { addDaysLocal } from '../services/clientOpsNextAction'
import { isProspect, salesInFlow } from '../services/salesPipeline'
import { buildAllAlerts } from '../services/clientOpsAlerts'
import { buildAllSchedule, upcomingWithin } from '../services/clientOpsSchedule'
import {
  applyJournalFilter,
  createJournalEntry,
  deleteJournalEntry,
  listJournal,
  postponedDue,
  updateJournalEntry,
} from '../services/journalService'
import { isOpenEvent, listEvents, updateEvent } from '../services/customerBridgeService'
import {
  buildDaySummary,
  buildMoneySignals,
  hardDeadlineActions,
  daySummaryText,
} from '../services/dailyBriefService'
import { agendaWhen, buildAgenda, type AgendaItem } from '../services/upcomingAgenda'
import { nowDate, todayLocalDate } from '../lib/appClock'
import { krwTile } from '../lib/format'
import { getDataModeConfig } from '../data/dataMode'
import { brand } from '../brand/brand.config'
import { contractStageOf } from '../types/clientOps'
import type { ClientOpsRecord } from '../types/clientOps'
import type { CustomerEvent, CustomerEventStatus, JournalEntry } from '../types/bridge'

/** D-159: 할 일이 4건 넘으면 휴대폰에서도 두 칸 — 여섯 건이면 세 줄로 끝난다 */
const todoGridClass = (n: number) => `ax-stagger grid gap-2 ${n >= 4 ? 'grid-cols-2' : 'grid-cols-1'} lg:grid-cols-2`

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/** 실제 로컬 시각 — 하드코딩하지 않고 30초마다 갱신한다 */
function useClock(): Date {
  const [now, setNow] = useState(() => nowDate())
  useEffect(() => {
    const id = window.setInterval(() => setNow(nowDate()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function greeting(hour: number): string {
  if (hour < 5) return '늦은 밤입니다'
  if (hour < 12) return '좋은 아침입니다'
  if (hour < 18) return '좋은 오후입니다'
  return '좋은 저녁입니다'
}

/** 다가오는 마감 · 약속 한 줄 — 날짜가 앞에, 무엇 · 어느 업체가 뒤에 */
function AgendaRow({ item }: { item: AgendaItem }) {
  const w = agendaWhen(item)
  const tone = item.daysLeft < 0 ? 'text-danger-700' : item.daysLeft <= 1 ? 'text-danger-700' : item.daysLeft <= 3 ? 'text-brand-700' : 'text-slate-600'
  return (
    <li data-testid="agenda-row" data-kind={item.kind}>
      <Link to={item.href} className="ax-lift flex items-start gap-3 rounded-(--radius-card) border border-slate-200 bg-white px-4 py-3">
        <span className="flex w-16 shrink-0 flex-col">
          <span className={`t-body font-bold whitespace-nowrap ${tone}`}>{w.label}</span>
          <span className="t-meta whitespace-nowrap text-slate-500">{w.date}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="t-body block break-keep font-semibold text-slate-900 [overflow-wrap:anywhere]">{item.title}</span>
          <span className="t-sub block break-keep text-slate-500 [overflow-wrap:anywhere]">
            {item.kindLabel}
            {item.clientName ? ` · ${item.clientName}` : ''}
            {item.detail && item.kind !== 'next' ? ` · ${item.detail}` : ''}
          </span>
        </span>
        <ArrowRight aria-hidden="true" className="size-4 shrink-0 self-center text-slate-300" />
      </Link>
    </li>
  )
}

/*
 * 묶음 머리의 아이콘 색.
 *
 * 화면 하나에 묶음이 여덟 개인데 아이콘이 전부 같은 회색이면 스크롤하다가
 * 지금 어디를 보고 있는지 알 수 없다. 왼쪽 메뉴와 같은 색표를 써서 묶음마다
 * 다른 색의 작은 칩을 둔다. 급한 정도를 말하는 색(빨강·주황)과는 자리가
 * 달라서 — 머리에만, 아주 작게 — 헷갈리지 않는다.
 *
 * 클래스 이름은 통째로 적는다(이어 붙이면 Tailwind 가 만들지 않는다).
 */
type SectionAccent = 'todo' | 'urgent' | 'journal' | 'event' | 'client' | 'money' | 'fund' | 'sales'

const SECTION_CHIP: Record<SectionAccent, string> = {
  todo: 'bg-brand-50 text-brand-600',
  urgent: 'bg-danger-50 text-danger-600',
  journal: 'bg-purple-50 text-nav-customer',
  event: 'bg-blue-50 text-nav-overview',
  client: 'bg-teal-50 text-nav-ops',
  money: 'bg-amber-50 text-nav-revenue',
  fund: 'bg-emerald-50 text-nav-evidence',
  sales: 'bg-amber-50 text-nav-revenue',
}

function SectionTitle({
  title,
  to,
  count,
  icon: Icon,
  accent,
}: {
  title: string
  to?: string
  count?: number
  icon: typeof Clock
  accent: SectionAccent
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-[1.15rem] font-bold text-slate-900">
        <span
          aria-hidden="true"
          className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${SECTION_CHIP[accent]}`}
        >
          <Icon className="size-4" />
        </span>
        {title}
        {typeof count === 'number' && <span className="text-[0.95rem] font-semibold text-slate-500">{count}</span>}
      </h2>
      {to && (
        <Link to={to} className="tap inline-flex items-center text-[0.9rem] font-medium text-brand-700 hover:underline">
          모두 보기
        </Link>
      )}
    </div>
  )
}

/**
 * 오늘의 Command Center — 앱을 켠 뒤 5초 안에 "오늘 무엇부터"를 답한다.
 * 위에서부터: 오늘 · 다가오는 마감 · 약속 · 빠른 기록 · 고객 이벤트 · 챙길 업체 · 돈 · 자금 마감 · 오늘 기록 · 하루 정리.
 */
function CommandCenter({ workspaceId, userId }: { workspaceId: string | null; userId: string | null }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const now = useClock()
  const today = todayLocalDate(now)
  const isLocal = getDataModeConfig().mode === 'local'

  const [clients, setClients] = useState<ClientOpsRecord[]>([])
  const [journal, setJournal] = useState<JournalEntry[]>([])
  const [events, setEvents] = useState<CustomerEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [linking, setLinking] = useState<{ event: CustomerEvent; tab: 'existing' | 'new' } | null>(null)
  /** 눌러서 연 할 일 — 무엇을 할지 시트에서 고른다 */
  const [todoPick, setTodoPick] = useState<JournalEntry | null>(null)
  /** D-122: 지우기 전에 한 번 묻는다 — 일기 화면 · 업체 기록과 같게 */
  const [pendingDelete, setPendingDelete] = useState<JournalEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  // D-158: 확인할 것 — 공고 · 요금제 권한
  const { notices: grantNotices, linkOf } = useGrantData(workspaceId)
  const { ent } = useEntitlements()
  const usable = useCallback((key: string) => key === 'grants' || ent.feature(key).usable, [ent])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [c, j] = await Promise.all([listClients(workspaceId), listJournal(workspaceId)])
      setClients(c)
      setJournal(j)
      try {
        setEvents(await listEvents(workspaceId))
      } catch {
        // 브릿지 미적용(READY) — 이벤트 없이 계속 동작한다
        setEvents([])
      }
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, showToast])

  useEffect(() => {
    void load()
  }, [load])

  // 계약 완료(끝남)·보관을 뺀 곳이 '지금 챙기는 업체'
  const active = useMemo(
    () => clients.filter((c) => c.archivedAt === null && contractStageOf(c.status) !== 'closed'),
    [clients],
  )
  const clientNames = useMemo(() => new Map(clients.map((c) => [c.id, c.companyName])), [clients])
  const alerts = useMemo(() => buildAllAlerts(clients, today), [clients, today])
  const schedule = useMemo(() => buildAllSchedule(clients, today), [clients, today])
  // '이번 주 마감' 은 마감만 — 다음 약속(D-120)은 아래 '약속' 줄에 따로
  const weekDue = useMemo(() => upcomingWithin(schedule, 7).filter((e) => !e.done && e.kind !== 'next'), [schedule])
  /** 계약 전 업체 — 약속 줄에서 '미팅 준비' 로, 나머지는 '업체 열기' 로 */
  const prospectIds = useMemo(() => new Set(clients.filter(isProspect).map((c) => c.id)), [clients])
  /** 다음 약속 — 지난 것 · 오늘 · 내일 (D-120). 날짜 순 */
  const appointments = useMemo(
    () => schedule.filter((e) => e.kind === 'next' && e.daysLeft !== null && e.daysLeft <= 1).sort((a, b) => a.date.localeCompare(b.date)),
    [schedule],
  )
  const waiting = useMemo(
    // 업체 수준의 '고객 대기' 는 계약 단계로 바뀌면서 사라졌다 — 경고만 센다
    () => alerts.filter((a) => a.kind === 'waiting_too_long').length,
    [alerts],
  )
  const money = useMemo(() => buildMoneySignals(clients, today), [clients, today])
  const agentPayable = useMemo(() => agentLedgerTotals(agentLedger(clients)).payable, [clients])
  const phoneOf = (id: string) => {
    const c = clients.find((x) => x.id === id)
    return c ? c.contactPhone.trim() || c.companyPhone.trim() : ''
  }
  /** D-125: 이번 주(오늘 ~ 6일 뒤) 받을 날인 안 받은 돈 — 내 몫 기준 */
  const weekIn = useMemo(() => {
    const end = addDaysLocal(today, 6)
    const items = clients
      .filter((c) => c.archivedAt === null)
      .flatMap((c) => c.fees.filter((f) => f.receivedAt === null && f.dueDate !== '' && f.dueDate >= today && f.dueDate <= end))
    return { count: items.length, total: items.reduce((n, f) => n + netAmountOf(f), 0) }
  }, [clients, today])
  /** 계약 고객의 받을 날 없는 미수 항목 — 달력 · 연체 경고에 안 뜬다 */
  const noDueFees = useMemo(
    () =>
      clients
        .filter((c) => c.archivedAt === null)
        // D-140: 조건으로 받는 돈 · 계약 시 받는 돈은 날짜가 없어도 정상 — '받을 날 안 정한' 에 넣지 않는다
        .flatMap((c) => c.fees.filter((f) => f.receivedAt === null && f.dueDate === '' && !f.conditionKind && (f.amount ?? 0) > 0).map((f) => ({ clientId: c.id, label: f.label }))),
    [clients],
  )
  // D-118: 영업 신호 — 영업 관리 보드와 같은 규칙
  const salesRiskList = useMemo(() => salesRisks(clients, today), [clients, today])
  const salesRecontactList = useMemo(() => salesRecontacts(clients), [clients])
  const salesFlow = useMemo(() => {
    const flow = salesInFlow(clients)
    return { count: flow.list.length, fee: flow.fee }
  }, [clients])
  const openEvents = useMemo(() => events.filter(isOpenEvent), [events])
  /**
   * 오늘 화면에 걸리는 할 일 — 기한이 오늘 이하인 것 전부.
   * 끝낸 것도 포함한다(아래에서 접어 두려면 목록에 있어야 한다).
   */
  const dueToday = useMemo(
    () => journal.filter((j) => j.entryType === 'follow_up' && j.dueDate !== '' && j.dueDate <= today),
    [journal, today],
  )
  /**
   * D-143: '지금 이것부터'(규칙이 고른 셋) 대신 날짜가 정해진 실제 일 — 고객과 약속한 기한 · 미팅 · 업무 마감 · 신청 마감.
   * 위 칸(오늘 할 일 · 업체 약속 · 놓치면 끝나는 기한)에 이미 있는 것은 뺀다.
   */
  const agendaAll = useMemo(() => buildAgenda({ schedule, journal, clientNames, prospectIds, today, days: 14 }), [schedule, journal, clientNames, prospectIds, today])
  // 앞으로 올 것을 먼저 — 마감이 지난 업무 · 신청은 아래 한 줄로 접는다(다가오는 것을 밀어내지 않게)
  const agenda = useMemo(() => agendaAll.filter((a) => a.daysLeft >= 0), [agendaAll])
  const agendaLate = useMemo(() => agendaAll.filter((a) => a.daysLeft < 0).sort((a, b) => b.date.localeCompare(a.date)), [agendaAll])
  /** D-138: 지나면 신청할 수 없는 기한(청년도약 참여신청 등) 7일 안 — 오늘 할 일 칸에 따로 둔다(순위 다툼에 묻히지 않게) */
  const hardDue = useMemo(() => hardDeadlineActions(schedule), [schedule])
  const todayJournal = useMemo(() => applyJournalFilter(journal, { range: 'today' }, today), [journal, today])
  const daySummary = useMemo(
    () => buildDaySummary({ today, journal, clients, alerts, events, clientNames }),
    [today, journal, clients, alerts, events, clientNames],
  )

  /*
   * 화면 맨 위 숫자는 '내가 적은 할 일' 만 센다.
   *
   * 예전에는 규칙이 찾은 경고(마감·서류·수금)를 전부 더해 "반드시 처리할 것 12건"
   * 같은 숫자를 띄웠다. 그런데 그 대부분은 아직 안 받은 서류라 오늘 당장의 일이
   * 아니었다. 매일 두 자리 숫자가 뜨면 그 숫자는 아무 뜻도 없어진다.
   * 날짜가 있는 일은 아래 '다가오는 마감 · 약속' 에서 날짜 순으로 보인다.
   */
  const openTodos = useMemo(() => dueToday.filter((e) => !e.completed), [dueToday])
  // D-159: 적은 순서대로 번호(일정 달력과 같게) — 밀린 것부터 이어서 센다
  const byCreated = (a: JournalEntry, b: JournalEntry) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
  const overdueTodos = useMemo(() => openTodos.filter((e) => e.dueDate < today).sort(byCreated), [openTodos, today])
  const todayTodos = useMemo(() => openTodos.filter((e) => e.dueDate >= today).sort(byCreated), [openTodos, today])
  const doneTodos = useMemo(() => dueToday.filter((e) => e.completed), [dueToday])
  const todoCount = openTodos.length

  const clientNameOf = (id: string) => clientNames.get(id)

  /** 할 일 시트에서 고른 것을 실행한다 */
  const applyTodoAction = (entry: JournalEntry, action: TodoAction) => {
    setTodoPick(null)
    if (action === 'delete') {
      void journalMutate(() => deleteJournalEntry(entry), '지웠습니다.')
      return
    }
    if (action === 'tomorrow') {
      void journalMutate(
        () => updateJournalEntry(entry, { dueDate: postponedDue(entry.dueDate, today), completed: false }),
        '내일로 미뤘습니다.',
      )
      return
    }
    void journalMutate(() => updateJournalEntry(entry, { completed: action === 'done' }))
  }

  /** 오늘 할 일 한 줄 넣기 — 업무 일기의 '할 일' 로 저장된다 */
  const addTodo = (draft: { content: string; dueDate: string; clientId: string | null }) =>
    journalMutate(
      () =>
        createJournalEntry(workspaceId, userId, {
          entryDate: today,
          entryType: 'follow_up',
          content: draft.content,
          clientId: draft.clientId,
          dueDate: draft.dueDate,
        }),
      '할 일을 넣었습니다.',
    )

  /** 됐으면 true — 할 일 칸은 실패하면 적은 글을 그대로 둔다(D-120) */
  const journalMutate = async (fn: () => Promise<unknown>, done?: string): Promise<boolean> => {
    try {
      await fn()
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
      return false
    }
    // D-122: 저장은 됐는데 다시 읽기만 실패했으면 '됐다' — 적은 글을 남겨 두면 다시 눌러 두 번 들어간다
    try {
      setJournal(await listJournal(workspaceId))
    } catch {
      showToast('저장했습니다. 목록을 다시 읽지 못했습니다 — 잠시 뒤 새로고침해 주세요.')
      return true
    }
    if (done) showToast(done)
    return true
  }

  const setEventStatus = async (event: CustomerEvent, status: CustomerEventStatus) => {
    try {
      const updated = await updateEvent(event, { status })
      setEvents((list) => list.map((e) => (e.id === updated.id ? updated : e)))
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
    }
  }

  const timeText = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${WEEKDAY[now.getDay()]}요일 · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      {/* A. 오늘 */}
      {/* 1단계 — 오늘이 어떤 날인지 한 문장 */}
      <section aria-label="오늘" data-tour="home-today" className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="t-sub font-medium text-slate-500">
              <time dateTime={now.toISOString()}>{timeText}</time> · {greeting(now.getHours())}
            </p>
            <h1 className="t-page mt-0.5 flex flex-wrap items-baseline gap-x-3 break-keep text-slate-900">
              {loading
                ? '오늘 할 일을 불러오는 중…'
                : todoCount > 0
                  ? `오늘 할 일 ${todoCount}건`
                  : '오늘 할 일을 적어 보세요'}
              <Link to="/journal" className="tap t-sub inline-flex items-center font-medium text-brand-700 hover:underline">
                모두 보기
              </Link>
            </h1>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 self-start sm:self-auto">
            <span className="hidden lg:inline-flex">
              <ScreenGuide screenKey="home" />
            </span>
            <span className="hidden sm:inline-flex">
              <Button variant="primary" onClick={() => setSummaryOpen(true)}>
                <Moon aria-hidden="true" className="size-4" /> 오늘 정리하기
              </Button>
            </span>
          </div>
        </div>
      </section>

      {/*
        B. 오늘 할 일 — 내가 적은 것.
        규칙이 찾아 주는 경고보다 위에 둔다. 하루를 실제로 굴리는 것은 내가 적어 둔
        한 줄이지, 시스템이 센 숫자가 아니다.
      */}
      <section
        aria-labelledby="todos"
        className="flex flex-col gap-3 rounded-(--radius-panel) border-2 border-brand-200 bg-brand-50/30 p-4 sm:p-5"
      >
        {/*
          카드 안에 '오늘 할 일' 제목을 또 두지 않는다 — 바로 위 h1 이 이미 그 말이다.
          제목 줄을 없앤 자리를 적는 칸이 가져간다. 이 화면에서 제일 많이 누르는 곳이다.
        */}
        <h2 id="todos" className="sr-only">
          오늘 할 일
        </h2>
        <TodoComposer date={today} clients={active} onAdd={addTodo} />

        {/* 밀린 것 — 어제까지가 기한인데 아직 안 끝난 것 */}
        {overdueTodos.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="t-sub font-semibold text-danger-700">밀린 것 {overdueTodos.length}건</p>
            <ul className={todoGridClass(overdueTodos.length)} data-testid="today-todo-grid">
              {overdueTodos.map((e, i) => (
                <TodoRow
                  key={e.id}
                  number={i + 1}
                  entry={e}
                  today={today}
                  clientName={e.clientId ? clientNames.get(e.clientId) : undefined}
                  onPick={() => setTodoPick(e)}
                />
              ))}
            </ul>
          </div>
        )}

        {todayTodos.length > 0 && (
          <ul className={todoGridClass(todayTodos.length)} data-testid="today-todo-grid">
            {todayTodos.map((e, i) => (
              <TodoRow
                key={e.id}
                number={overdueTodos.length + i + 1}
                entry={e}
                today={today}
                clientName={e.clientId ? clientNames.get(e.clientId) : undefined}
                onPick={() => setTodoPick(e)}
              />
            ))}
          </ul>
        )}

        {/* D-142: PC 에서는 기한 · 지원사업 · 결제 · 약속을 두 칸으로 — 한 줄씩 쌓이면 아래 '다가오는 마감 · 약속' 이 화면 밖으로 밀렸다 */}
        <div className="flex flex-col gap-3 empty:hidden lg:grid lg:grid-cols-2 lg:items-start lg:gap-4" data-testid="today-side-grid">
          {/* D-138: 놓치면 끝나는 기한 — 지나면 신청할 수 없는 것만(7일 안) */}
          {hardDue.length > 0 && (
            <div data-testid="today-hard-deadlines" className="flex flex-col gap-2">
              <p className="t-sub font-semibold text-danger-700">놓치면 끝나는 기한 {hardDue.length}건</p>
              <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-danger-200 bg-white">
                {hardDue.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                    <span className="t-sub w-20 shrink-0 font-semibold whitespace-nowrap text-danger-700">{a.reason.startsWith('오늘') ? '오늘까지' : a.reason.split(' — ')[0]}</span>
                    <Link to={a.href} className="tap t-body inline-flex items-center font-bold text-slate-900 hover:text-brand-700 hover:underline">
                      {a.clientName}
                    </Link>
                    <span className="t-body min-w-0 flex-[1_1_10rem] break-keep text-slate-700">{a.title}</span>
                    <span className="t-sub ml-auto shrink-0 break-keep text-slate-500">지나면 신청 불가</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* D-156: '맞는 업체에 알릴 공고(7일 안 마감)' 자동 알림은 뺐다(대표: 다 뜨면 오히려 안 보게 된다).
              도전 체크한 공고의 마감은 업체의 신청 건으로 위 '다가오는 마감 · 약속' 에 뜬다 */}

          {/* D-142: 3일 안에 결제될 정기 결제 */}
          <TodayCharges workspaceId={workspaceId} today={today} />

          {/* D-120: 다음 약속 — 업체마다 적어 둔 '다음에 무엇을, 언제' 가운데 지난 것 · 오늘 · 내일 */}
          {appointments.length > 0 && (
            <div data-testid="today-appointments" className="flex flex-col gap-2">
              <p className="t-sub font-semibold text-slate-700">업체 약속 {appointments.length}건</p>
              <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200 bg-white">
                {appointments.map((e) => {
                  const late = (e.daysLeft ?? 0) < 0
                  return (
                    <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                      <span className={`t-sub w-20 shrink-0 font-semibold whitespace-nowrap ${late ? 'text-danger-700' : 'text-brand-700'}`}>
                        {e.daysLeft === 0 ? '오늘' : e.daysLeft === 1 ? '내일' : `${Math.abs(e.daysLeft ?? 0)}일 지남`}
                      </span>
                      <Link to={`/ops/clients/${e.clientId}`} className="tap t-body inline-flex items-center font-bold text-slate-900 hover:text-brand-700 hover:underline">
                        {e.clientName}
                      </Link>
                      <span className="t-body min-w-0 flex-[1_1_10rem] break-keep text-slate-700">{e.title}</span>
                      <span className="ml-auto flex shrink-0 items-center gap-2">
                        {prospectIds.has(e.clientId) ? (
                          <Link to={`/sales/meeting?client=${e.clientId}`} className="tap t-sub inline-flex items-center font-semibold text-brand-700 hover:underline">
                            미팅 준비 →
                          </Link>
                        ) : (
                          <Link to={`/ops/clients/${e.clientId}`} className="tap t-sub inline-flex items-center font-semibold text-brand-700 hover:underline">
                            업체 열기 →
                          </Link>
                        )}
                        {/* D-125: 약속 줄에서 바로 전화 */}
                        <CallButton phone={phoneOf(e.clientId)} name={e.clientName} />
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>

        {/* 끝낸 것은 접어 둔다 — 남은 일이 목록의 전부여야 한다 */}
        {doneTodos.length > 0 && (
          <Disclosure title="끝낸 것" hint={`${doneTodos.length}건`}>
            <ul className={todoGridClass(doneTodos.length)}>
              {doneTodos.map((e) => (
                <TodoRow
                  key={e.id}
                  entry={e}
                  today={today}
                  clientName={e.clientId ? clientNames.get(e.clientId) : undefined}
                  onPick={() => setTodoPick(e)}
                />
              ))}
            </ul>
          </Disclosure>
        )}
      </section>

      {/* D-158: 확인할 것 — 프로그램이 준비한 것에 맞다 · 아니다만(없으면 칸 없음) */}
      <TodayDecisions
        clients={clients}
        today={today}
        workspaceId={workspaceId}
        userId={userId}
        notices={grantNotices}
        usable={usable}
        onSaved={(r) => setClients((cs) => cs.map((c) => (c.id === r.id ? r : c)))}
        onTodo={(e) => setJournal((js) => [e, ...js])}
        linkOf={linkOf}
        onTodosRemoved={(ids) => setJournal((js) => js.filter((j) => !ids.includes(j.id)))}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* 2단계 — 다가오는 마감 · 약속(D-143: 날짜가 있는 실제 일만, 날짜 순) */}
        <section aria-labelledby="upcoming" data-tour="home-upcoming" data-testid="today-agenda" className="flex min-w-0 flex-col gap-3">
          <SectionTitle title="다가오는 마감 · 약속" icon={CalendarClock} to="/ops/calendar" count={agenda.length} accent="urgent" />
          {loading ? (
            <p className="t-sub text-slate-500">불러오는 중…</p>
          ) : agenda.length === 0 ? (
            <p className="t-sub break-keep rounded-(--radius-card) border border-dashed border-slate-300 bg-white px-4 py-4 text-slate-500" data-testid="today-agenda-empty">
              2주 안에 잡힌 마감 · 약속이 없습니다. 업체에 다음 약속이나 기한을 적어 두면 여기에 날짜 순으로 보여요.
            </p>
          ) : (
            <ol className="ax-stagger flex flex-col gap-2">
              {agenda.slice(0, 8).map((a) => (
                <AgendaRow key={a.id} item={a} />
              ))}
            </ol>
          )}
          {agenda.length > 8 && (
            <Link to="/ops/calendar" className="tap t-sub inline-flex items-center self-start font-semibold text-brand-700 hover:underline" data-testid="today-agenda-more">
              2주 안 {agenda.length}건 모두 달력에서 보기 →
            </Link>
          )}
          {agendaLate.length > 0 && (
            <div data-testid="today-agenda-late">
              <Disclosure title="마감 지난 업무 · 신청" hint={`${agendaLate.length}건 — 끝냈으면 업체에서 완료로 바꿔 주세요`}>
                <ol className="flex flex-col gap-2">
                  {agendaLate.slice(0, 10).map((a) => (
                    <AgendaRow key={a.id} item={a} />
                  ))}
                </ol>
              </Disclosure>
            </div>
          )}

          {/* 오늘의 숫자 — 위가 아니라 할 일 아래에 둔다. 숫자는 판단의 근거이지 할 일이 아니다 */}
          <div className="ax-stagger mt-1 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <MetricTile
              label="이번 주 마감"
              value={`${weekDue.length}건`}
              tone={weekDue.length > 0 ? 'warning' : 'neutral'}
              onClick={() => navigate('/ops/calendar')}
            />
            <MetricTile
              label="고객 회신 대기"
              value={`${waiting}건`}
              tone={waiting > 0 ? 'warning' : 'neutral'}
              // D-126: 그 조건으로 거른 목록이 바로 열린다(예전엔 전체 목록)
              onClick={() => navigate(waiting > 0 ? '/ops/clients?filter=waiting' : '/ops/clients')}
            />
            <MetricTile
              label="못 받은 내 돈"
              value={krwTile(money.scheduled.total + money.overdue.total)}
              tone={money.overdue.count > 0 ? 'danger' : 'neutral'}
              hint={
                [
                  // D-125: 이번 주 들어올 돈을 먼저 — 대표가 가장 먼저 묻는 숫자
                  weekIn.count > 0 ? `이번 주 받을 것 ${krwTile(weekIn.total)} · ${weekIn.count}건` : '',
                  money.overdue.count > 0 ? `연체 ${money.overdue.count}건` : '',
                  money.scheduled.gross + money.overdue.gross !== money.scheduled.total + money.overdue.total
                    ? `청구 기준 ${krwTile(money.scheduled.gross + money.overdue.gross)}`
                    : '',
                ]
                  .filter((v) => v !== '')
                  .join(' · ') || undefined
              }
              // D-122: 연체가 있으면 가장 오래 밀린 업체의 수금 탭으로 바로
              onClick={() => navigate(money.overdue.items[0] ? `/ops/clients/${money.overdue.items[0].clientId}?tab=fees` : money.scheduled.count > 0 ? '/ops/clients?filter=unpaid' : '/ops/clients')}
            />
            {/* 새 요청은 '급한 일' 이 아니라 '새로 온 것' 이다 — 빨강 대신 브랜드색 */}
            <MetricTile
              label="새 상담신청"
              value={`${openEvents.length}건`}
              tone={openEvents.length > 0 ? 'brand' : 'neutral'}
              onClick={() => navigate('/ops/inbox')}
            />
          </div>

          {/* D-122: 오늘 화면에 안 보이던 돈 두 가지 — 영업자에게 줄 돈 · 받을 날을 안 정한 수금 */}
          {(agentPayable > 0 || noDueFees.length > 0) && (
            <p data-testid="today-money-notes" className="t-sub flex flex-wrap gap-x-4 gap-y-1 break-keep text-slate-600">
              {agentPayable > 0 && (
                <Link to="/ops/agents" className="tap inline-flex items-center font-semibold text-warning-700 hover:underline">
                  영업자에게 줄 돈 {krwTile(agentPayable)} (고객 입금됨) →
                </Link>
              )}
              {noDueFees.length > 0 && (
                <Link to={`/ops/clients/${noDueFees[0].clientId}?tab=fees`} className="tap inline-flex items-center font-semibold text-slate-700 hover:underline">
                  받을 날을 안 정한 수금 {noDueFees.length}건 →
                </Link>
              )}
            </p>
          )}

        </section>

        {/* 3단계 — 빠른 기록 */}
        <section aria-labelledby="capture" data-tour="home-capture" className="flex min-w-0 flex-col gap-3">
          <SectionTitle title="무슨 일이 있었나요?" icon={NotebookPen} to="/journal" count={todayJournal.length} accent="journal" />
          <QuickCapture
            clients={active}
            compact
            onCreate={(input) => journalMutate(() => createJournalEntry(workspaceId, userId, input), '기록했습니다.')}
          />
          <JournalList
            entries={todayJournal.slice(0, 4)}
            clientNames={clientNames}
            today={today}
            showDate={false}
            onToggleComplete={(e) => journalMutate(() => updateJournalEntry(e, { completed: !e.completed }))}
            onTogglePin={(e) => journalMutate(() => updateJournalEntry(e, { pinned: !e.pinned }))}
            onEdit={(e, content) => journalMutate(() => updateJournalEntry(e, { content }))}
            onDelete={(e) => setPendingDelete(e)}
            emptyTitle="오늘 기록된 업무가 없습니다."
            emptyHint="통화 · 결정 · 할 일을 바로 남겨 두면 나중에 고객별 이력이 이어집니다."
          />
          {todayJournal.length > 4 && (
            <Link to="/journal" className="tap t-sub inline-flex items-center font-medium text-brand-700 hover:underline">
              오늘 기록 {todayJournal.length}건 모두 보기
            </Link>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* 4단계 — 고객 이벤트 */}
        <section aria-labelledby="events" data-tour="home-events" className="flex min-w-0 flex-col gap-3">
          <SectionTitle title="상담신청" icon={Inbox} to="/ops/inbox" count={openEvents.length} accent="event" />
          {openEvents.length === 0 ? (
            <Blank
              title={`새 고객 요청이 없습니다. ${brand.customerPlatformLabel}에서 요청이 오면 여기에 뜹니다.`}
              icon={<Inbox className="size-7" />}
              action={
                isLocal ? (
                  <Link to="/ops/inbox" className="t-sub font-medium text-brand-700 hover:underline">
                    상담신청함에서 샘플 만들기
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {openEvents.slice(0, 3).map((e) => (
                <li key={e.id}>
                  <EventCard
                    event={e}
                    compact
                    clientName={e.operationsClientId ? (clientNames.get(e.operationsClientId) ?? null) : null}
                    onLink={() => setLinking({ event: e, tab: 'existing' })}
                    onCreateClient={() => setLinking({ event: e, tab: 'new' })}
                    onStatus={(status) => void setEventStatus(e, status)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* D-118: 영업 — 영업 관리 보드의 '지금 챙길 영업' 을 오늘에서도. 없으면 다시 연락할 곳 */}
        <section aria-labelledby="today-sales" data-testid="today-sales" className="flex min-w-0 flex-col gap-3">
          <SectionTitle title="영업" icon={KanbanSquare} to="/sales/board" count={salesRiskList.length} accent="sales" />
          <p className="t-sub text-slate-500">
            진행 중 <strong className="font-semibold text-slate-800 tabular-nums">{salesFlow.count}곳</strong>
            {salesFlow.fee > 0 && <> · 예상 수임료 <strong className="font-semibold text-slate-800 tabular-nums">{krwTile(salesFlow.fee)}</strong></>}
            {salesRecontactList.length > 0 && <> · 다시 연락할 곳 {salesRecontactList.length}</>}
            {' · '}
            {/* D-119: 크레탑 보고서 한 번으로 잠재고객 등록 */}
            <Link to="/sales/new" data-testid="today-cretop-intake" className="font-semibold whitespace-nowrap text-brand-700 hover:underline">
              + 크레탑으로 등록
            </Link>
          </p>
          {salesRiskList.length === 0 && salesRecontactList.length === 0 ? (
            <Blank
              title="지금 챙길 영업이 없습니다."
              icon={<KanbanSquare className="size-7" />}
              action={
                <Link to="/sales/board" className="tap inline-flex items-center gap-1 rounded-(--radius-control) border border-brand-200 bg-brand-50 px-3 py-2 font-semibold text-brand-700 hover:bg-brand-100">
                  영업 보드에서 잠재고객 등록 →
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-panel) border border-slate-200 bg-white">
              {(salesRiskList.length > 0
                ? salesRiskList.slice(0, 3).map((r) => ({ id: r.record.id, name: r.record.companyName, why: r.reason, tone: 'text-warning-700', go: r.action }))
                : salesRecontactList.slice(0, 3).map((r) => ({ id: r.record.id, name: r.record.companyName, why: r.reasons[0], tone: 'text-slate-500', go: '연락하기' }))
              ).map((x) => (
                <li key={x.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5">
                  <Link to={`/ops/clients/${x.id}`} className="t-sub font-bold text-slate-900 hover:text-brand-700 hover:underline">{x.name}</Link>
                  {/* 12rem 아래로는 줄이지 않고 다음 줄로 — 좁은 화면 · 큰 글자에서 한 줄에 두세 자씩 짜부라지지 않게 */}
                  <span className={`t-sub min-w-0 flex-[1_1_12rem] break-keep ${x.tone}`}>{x.why}</span>
                  <Link to={salesActionPath(x.go, x.id)} className="t-meta ml-auto shrink-0 font-semibold text-brand-700 hover:underline">{x.go} →</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* D-155: 계약 고객 돌봄 — 한 달 넘게 조용 · 계약 1주년. 없으면 칸 없음 */}
        <TodayCare clients={clients} today={today} onSaved={(r) => setClients((cs) => cs.map((c) => (c.id === r.id ? r : c)))} />
      </div>

      {/* 하루의 끝에 누르는 버튼이라 모바일에서는 화면 맨 아래에 둔다 */}
      <Button variant="secondary" className="w-full sm:hidden" onClick={() => setSummaryOpen(true)}>
        <Moon aria-hidden="true" className="size-4" /> 오늘 정리하기
      </Button>

      {/* I. 하루 정리 */}
      <Modal open={summaryOpen} title={`${today} 하루 정리`} size="lg" onClose={() => setSummaryOpen(false)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(daySummaryText(daySummary)).then(() => showToast('하루 정리를 복사했습니다.'))
              }}
            >
              <Copy aria-hidden="true" className="size-4" /> 복사
            </Button>
            <Button variant="primary" onClick={() => setSummaryOpen(false)}>닫기</Button>
          </>
        }
      >
        <p className="text-[0.875rem] text-slate-400">오늘 남긴 기록 · 처리한 일을 모아 정리했습니다.</p>
        {(
          [
            ['오늘 처리', daySummary.done, 'text-success-700'],
            ['아직 남음', daySummary.remaining, 'text-danger-700'],
            ['내일로 넘김', daySummary.carriedOver, 'text-warning-700'],
            ['중요한 결정', daySummary.decisions, 'text-slate-800'],
            ['새로운 이슈', daySummary.issues, 'text-slate-700'],
          ] as const
        ).map(([title, items, cls]) => (
          <div key={title} className="mt-4">
            <h3 className={`text-[0.95rem] font-bold ${cls}`}>{title} <span className="font-semibold text-slate-400">{items.length}</span></h3>
            {items.length === 0 ? (
              <p className="mt-1 text-[0.9rem] text-slate-400">없음</p>
            ) : (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[0.92rem] break-keep text-slate-700">
                {items.slice(0, 12).map((i, idx) => <li key={idx}>{i}</li>)}
                {items.length > 12 && <li className="text-slate-400">외 {items.length - 12}건</li>}
              </ul>
            )}
          </div>
        ))}
      </Modal>


      {todoPick && (
        <TodoActionSheet
          entry={todoPick}
          clientName={todoPick.clientId ? clientNameOf(todoPick.clientId) : undefined}
          clients={active}
          onPick={(action) => applyTodoAction(todoPick, action)}
          onSave={async (patch) => {
            // D-122: 저장이 된 뒤에만 닫는다 — 실패하면 고치던 칸이 그대로
            const ok = await journalMutate(() => updateJournalEntry(todoPick, patch), '고쳤습니다.')
            if (ok) setTodoPick(null)
            return ok
          }}
          onOpenClient={
            todoPick.clientId ? () => navigate(`/ops/clients/${todoPick.clientId}`) : undefined
          }
          onClose={() => setTodoPick(null)}
        />
      )}

      <ConfirmModal
        open={pendingDelete !== null}
        title="기록 삭제"
        message={pendingDelete ? `"${pendingDelete.content.slice(0, 40)}${pendingDelete.content.length > 40 ? '…' : ''}" 기록을 지웁니다. 되돌릴 수 없습니다.` : ''}
        confirmLabel="지우기"
        danger
        busy={deleting}
        onConfirm={() => {
          const e = pendingDelete
          if (!e) return
          setDeleting(true)
          void journalMutate(() => deleteJournalEntry(e), '지웠습니다.').then(() => {
            setDeleting(false)
            setPendingDelete(null)
          })
        }}
        onCancel={() => setPendingDelete(null)}
      />

      {linking && (
        <LinkCustomerModal
          event={linking.event}
          clients={clients}
          workspaceId={workspaceId}
          initialTab={linking.tab}
          onClose={() => setLinking(null)}
          onDone={(updated) => {
            setLinking(null)
            setEvents((list) => list.map((e) => (e.id === updated.id ? updated : e)))
            const cid = updated.operationsClientId
            showToast('업체에 연결했습니다.', cid ? { label: '미팅 준비 →', onClick: () => navigate(`/sales/meeting?client=${cid}&round=1`) } : undefined)
            void load()
          }}
        />
      )}
    </div>
  )
}

export function TodayCommandCenterPage() {
  return <WorkspaceScope>{(ctx) => <CommandCenter workspaceId={ctx.workspaceId} userId={ctx.userId} />}</WorkspaceScope>
}
