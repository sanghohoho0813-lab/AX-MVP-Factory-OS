import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  Clock,
  Copy,
  Inbox,
  Landmark,
  ListTodo,
  Moon,
  NotebookPen,
  Wallet,
  Workflow,
} from 'lucide-react'
import { ConsultingNextActions } from '../components/consulting/ConsultingNextActions'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { Badge, Blank, Disclosure, ListRow, ListSurface, MetricTile } from '../components/ui/primitives'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/toastContext'
import { QuickCapture } from '../components/journal/QuickCapture'
import { TodoActionSheet, TodoComposer, TodoRow, type TodoAction } from '../components/journal/TodoBoard'
import { JournalList } from '../components/journal/JournalList'
import { EventCard } from '../components/ops/EventCard'
import { LinkCustomerModal } from '../components/ops/LinkCustomerModal'
import { ScreenGuide } from '../components/onboarding/ScreenGuide'
import { listClients } from '../services/clientOpsService'
import { buildAllAlerts, dueText } from '../services/clientOpsAlerts'
import { buildAllSchedule, upcomingWithin } from '../services/clientOpsSchedule'
import {
  applyJournalFilter,
  createJournalEntry,
  deleteJournalEntry,
  listJournal,
  shiftDate,
  updateJournalEntry,
} from '../services/journalService'
import { isOpenEvent, listEvents, updateEvent } from '../services/customerBridgeService'
import {
  buildDaySummary,
  buildFundingDeadlines,
  buildMoneySignals,
  buildTopActions,
  daySummaryText,
  type BriefAction,
} from '../services/dailyBriefService'
import { nowDate, todayLocalDate } from '../lib/appClock'
import { formatKrw, krwTile } from '../lib/format'
import { getDataModeConfig } from '../data/dataMode'
import { brand } from '../brand/brand.config'
import { contractStageOf } from '../types/clientOps'
import type { ClientOpsRecord } from '../types/clientOps'
import type { CustomerEvent, CustomerEventStatus, JournalEntry } from '../types/bridge'

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

function ActionRow({ action, rank }: { action: BriefAction; rank: number }) {
  /*
   * 바탕은 칠하지 않는다 (화면 규칙 §2). 왼쪽 선과 순번 원의 색으로만 말한다.
   * 세 장이 모두 '마감 지남' 인 날이 흔한데, 그때 바탕까지 칠하면 화면 위쪽이 통째로
   * 빨간 덩어리가 되어 1·2·3 의 차이가 오히려 사라진다. 무게는 순번이 말한다.
   */
  const look =
    action.severity === 'critical'
      ? { edge: 'bg-danger-500', fill: 'border-slate-200 bg-white', rank: 'bg-danger-600' }
      : action.severity === 'warning'
        ? { edge: 'bg-warning-500', fill: 'border-slate-200 bg-white', rank: 'bg-warning-600' }
        : { edge: 'bg-slate-300', fill: 'border-slate-200 bg-white', rank: 'bg-slate-700' }
  return (
    <li>
      <Link
        to={action.href}
        className={`ax-lift relative flex items-start gap-3 overflow-hidden rounded-(--radius-card) border py-3.5 pr-3 pl-4 ${look.fill}`}
      >
        <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] ${look.edge}`} />
        <span
          className={`t-meta mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full font-bold text-white ${look.rank}`}
        >
          {rank}
        </span>
        <span className="min-w-0 flex-1">
          <span className="t-card block break-keep text-slate-900">{action.title}</span>
          {action.detail && <span className="t-sub block break-keep text-slate-600">{action.detail}</span>}
          {/* 왜 이것이 위에 있는지 — 한 줄을 넘기지 않는다 */}
          <span className="t-meta mt-0.5 block truncate text-slate-500">
            {action.clientName ? `${action.clientName} · ` : ''}
            {action.reason}
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
type SectionAccent = 'todo' | 'urgent' | 'journal' | 'event' | 'client' | 'money' | 'fund'

const SECTION_CHIP: Record<SectionAccent, string> = {
  todo: 'bg-brand-50 text-brand-600',
  urgent: 'bg-danger-50 text-danger-600',
  journal: 'bg-purple-50 text-nav-customer',
  event: 'bg-blue-50 text-nav-overview',
  client: 'bg-teal-50 text-nav-ops',
  money: 'bg-amber-50 text-nav-revenue',
  fund: 'bg-emerald-50 text-nav-evidence',
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
        <Link to={to} className="text-[0.9rem] font-medium text-brand-700 hover:underline">
          모두 보기
        </Link>
      )}
    </div>
  )
}

/**
 * 오늘의 Command Center — 앱을 켠 뒤 5초 안에 "오늘 무엇부터"를 답한다.
 * 위에서부터: 오늘 · Top 3 · 빠른 기록 · 고객 이벤트 · 챙길 업체 · 돈 · 자금 마감 · 오늘 기록 · 하루 정리.
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
  const [consultingCount, setConsultingCount] = useState(0)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [linking, setLinking] = useState<{ event: CustomerEvent; tab: 'existing' | 'new' } | null>(null)
  /** 눌러서 연 할 일 — 무엇을 할지 시트에서 고른다 */
  const [todoPick, setTodoPick] = useState<JournalEntry | null>(null)

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

  // 계약 종료·보관을 뺀 곳이 '지금 챙기는 업체'
  const active = useMemo(
    () => clients.filter((c) => c.archivedAt === null && contractStageOf(c.status) !== 'closed'),
    [clients],
  )
  const clientNames = useMemo(() => new Map(clients.map((c) => [c.id, c.companyName])), [clients])
  const alerts = useMemo(() => buildAllAlerts(clients, today), [clients, today])
  const schedule = useMemo(() => buildAllSchedule(clients, today), [clients, today])
  const weekDue = useMemo(() => upcomingWithin(schedule, 7).filter((e) => !e.done), [schedule])
  const waiting = useMemo(
    // 업체 수준의 '고객 대기' 는 계약 단계로 바뀌면서 사라졌다 — 경고만 센다
    () => alerts.filter((a) => a.kind === 'waiting_too_long').length,
    [alerts],
  )
  const money = useMemo(() => buildMoneySignals(clients, today), [clients, today])
  const funding = useMemo(() => buildFundingDeadlines(clients, today), [clients, today])
  const openEvents = useMemo(() => events.filter(isOpenEvent), [events])
  const followUps = useMemo(() => journal.filter((j) => j.entryType === 'follow_up' && !j.completed), [journal])
  /**
   * 오늘 화면에 걸리는 할 일 — 기한이 오늘 이하인 것 전부.
   * 끝낸 것도 포함한다(아래에서 접어 두려면 목록에 있어야 한다).
   */
  const dueToday = useMemo(
    () => journal.filter((j) => j.entryType === 'follow_up' && j.dueDate !== '' && j.dueDate <= today),
    [journal, today],
  )
  const top = useMemo(
    () => buildTopActions({ alerts, events, followUps, clientNames, today }, 3),
    [alerts, events, followUps, clientNames, today],
  )
  const todayJournal = useMemo(() => applyJournalFilter(journal, { range: 'today' }, today), [journal, today])
  const attention = useMemo(() => {
    const byClient = new Map<string, { record: ClientOpsRecord; critical: number; warning: number; first: string }>()
    for (const a of alerts) {
      const r = clients.find((c) => c.id === a.clientId)
      if (!r) continue
      const cur = byClient.get(a.clientId) ?? { record: r, critical: 0, warning: 0, first: a.title }
      if (a.severity === 'critical') cur.critical += 1
      else if (a.severity === 'warning') cur.warning += 1
      byClient.set(a.clientId, cur)
    }
    return [...byClient.values()].sort((x, y) => y.critical - x.critical || y.warning - x.warning).slice(0, 5)
  }, [alerts, clients])
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
   * 규칙이 찾은 것은 아래 '지금 이것부터' 에서 계속 보인다.
   */
  const openTodos = useMemo(() => dueToday.filter((e) => !e.completed), [dueToday])
  const overdueTodos = useMemo(() => openTodos.filter((e) => e.dueDate < today), [openTodos, today])
  const todayTodos = useMemo(() => openTodos.filter((e) => e.dueDate >= today), [openTodos, today])
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
        () => updateJournalEntry(entry, { dueDate: shiftDate(today, 1), completed: false }),
        '내일로 미뤘습니다.',
      )
      return
    }
    void journalMutate(() => updateJournalEntry(entry, { completed: action === 'done' }))
  }

  /** 오늘 할 일 한 줄 넣기 — 업무 일기의 '할 일' 로 저장된다 */
  const addTodo = (draft: { content: string; dueDate: string; clientId: string | null }) =>
    void journalMutate(
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

  const journalMutate = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn()
      setJournal(await listJournal(workspaceId))
      if (done) showToast(done)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
    }
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
            <h1 className="t-page mt-0.5 break-keep text-slate-900">
              {loading
                ? '오늘 할 일을 불러오는 중…'
                : todoCount > 0
                  ? `오늘 할 일 ${todoCount}건`
                  : '오늘 할 일을 적어 보세요'}
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
        <div className="flex items-center justify-between gap-2">
          <h2 id="todos" className="t-page flex items-center gap-2 break-keep text-slate-900">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white"
            >
              <ListTodo className="size-5" />
            </span>
            오늘 할 일
          </h2>
          <Link to="/journal" className="t-sub shrink-0 font-medium text-brand-700 hover:underline">
            모두 보기
          </Link>
        </div>

        <TodoComposer date={today} clients={active} onAdd={addTodo} />

        {/* 밀린 것 — 어제까지가 기한인데 아직 안 끝난 것 */}
        {overdueTodos.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="t-sub font-semibold text-danger-700">밀린 것 {overdueTodos.length}건</p>
            <ul className="ax-stagger flex flex-col gap-2">
              {overdueTodos.map((e) => (
                <TodoRow
                  key={e.id}
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
          <ul className="ax-stagger flex flex-col gap-2">
            {todayTodos.map((e) => (
              <TodoRow
                key={e.id}
                entry={e}
                today={today}
                clientName={e.clientId ? clientNames.get(e.clientId) : undefined}
                onPick={() => setTodoPick(e)}
              />
            ))}
          </ul>
        )}

        {/* 끝낸 것은 접어 둔다 — 남은 일이 목록의 전부여야 한다 */}
        {doneTodos.length > 0 && (
          <Disclosure title="끝낸 것" hint={`${doneTodos.length}건`}>
            <ul className="flex flex-col gap-2">
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* 2단계 — 지금 이것부터 (최대 3건) */}
        <section aria-labelledby="top3" data-tour="home-top3" className="flex min-w-0 flex-col gap-3">
          <SectionTitle title="지금 이것부터" icon={ClipboardCheck} accent="urgent" />
          {loading ? (
            <p className="t-sub text-slate-500">불러오는 중…</p>
          ) : top.length === 0 ? (
            <Blank title="마감 지남·막힘·오늘 후속조치가 없습니다." icon={<ClipboardCheck className="size-7" />} />
          ) : (
            <ol className="ax-stagger flex flex-col gap-2">
              {top.map((a, i) => (
                <ActionRow key={a.id} action={a} rank={i + 1} />
              ))}
            </ol>
          )}

          {/* 컨설팅 작업실 — 진행 중인 특허·벤처·MVP 프로젝트의 다음 행동 (없으면 통째로 숨긴다) */}
          {consultingCount > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              <SectionTitle title="컨설팅 다음 행동" icon={Workflow} to="/studio" count={consultingCount} accent="todo" />
            </div>
          )}
          <ConsultingNextActions workspaceId={workspaceId} today={today} onCount={setConsultingCount} />

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
              onClick={() => navigate('/ops/clients')}
            />
            <MetricTile
              label="받아야 할 돈"
              value={krwTile(money.scheduled.total + money.overdue.total)}
              tone={money.overdue.count > 0 ? 'danger' : 'neutral'}
              hint={money.overdue.count > 0 ? `연체 ${money.overdue.count}건` : undefined}
              onClick={() => navigate('/ops/clients')}
            />
            {/* 새 요청은 '급한 일' 이 아니라 '새로 온 것' 이다 — 빨강 대신 브랜드색 */}
            <MetricTile
              label="새 고객 이벤트"
              value={`${openEvents.length}건`}
              tone={openEvents.length > 0 ? 'brand' : 'neutral'}
              onClick={() => navigate('/ops/inbox')}
            />
          </div>

          <p className="t-meta text-slate-500">
            순서 규칙: 마감 지남·막힘 → 결제된 주문 → 지난 후속조치 → 고객 서류·요청 → 임박 마감. 규칙 기반이며 AI 판단이 아닙니다.
          </p>
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
            onToggleComplete={(e) => void journalMutate(() => updateJournalEntry(e, { completed: !e.completed }))}
            onTogglePin={(e) => void journalMutate(() => updateJournalEntry(e, { pinned: !e.pinned }))}
            onEdit={(e, content) => { if (content) void journalMutate(() => updateJournalEntry(e, { content })) }}
            onDelete={(e) => void journalMutate(() => deleteJournalEntry(e), '지웠습니다.')}
            emptyTitle="오늘 기록된 업무가 없습니다."
            emptyHint="통화·결정·후속조치를 바로 남겨두면 나중에 고객별 이력이 이어집니다."
          />
          {todayJournal.length > 4 && (
            <Link to="/journal" className="t-sub font-medium text-brand-700 hover:underline">
              오늘 기록 {todayJournal.length}건 모두 보기
            </Link>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* 4단계 — 고객 이벤트 */}
        <section aria-labelledby="events" data-tour="home-events" className="flex min-w-0 flex-col gap-3">
          <SectionTitle title="고객 이벤트" icon={Inbox} to="/ops/inbox" count={openEvents.length} accent="event" />
          {openEvents.length === 0 ? (
            <Blank
              title={`새 고객 요청이 없습니다. ${brand.customerPlatformLabel}에서 요청이 오면 여기에 뜹니다.`}
              icon={<Inbox className="size-7" />}
              action={
                isLocal ? (
                  <Link to="/ops/inbox" className="t-sub font-medium text-brand-700 hover:underline">
                    이벤트함에서 샘플 만들기
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

        {/* 4단계 — 챙겨야 할 업체 */}
        <section aria-labelledby="attention" className="flex min-w-0 flex-col gap-3">
          <SectionTitle title="챙겨야 할 업체" icon={Building2} to="/ops/clients" count={attention.length} accent="client" />
          {attention.length === 0 ? (
            <Blank
              title={active.length === 0 ? '아직 등록된 업체가 없습니다.' : '경고가 있는 업체가 없습니다.'}
              icon={<Building2 className="size-7" />}
              action={
                active.length === 0 ? (
                  <Link to="/ops/clients" className="t-sub font-medium text-brand-700 hover:underline">
                    첫 업체 등록
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ListSurface>
              {attention.slice(0, 4).map(({ record, critical, warning, first }) => (
                <ListRow
                  key={record.id}
                  title={record.companyName}
                  meta={first}
                  badge={
                    critical > 0 ? (
                      <Badge tone="danger">지금 {critical}</Badge>
                    ) : warning > 0 ? (
                      <Badge tone="warning">곧 {warning}</Badge>
                    ) : undefined
                  }
                  onClick={() => navigate(`/ops/clients/${record.id}`)}
                />
              ))}
            </ListSurface>
          )}
          {attention.length > 4 && (
            <Link to="/ops/clients" className="t-sub font-medium text-brand-700 hover:underline">
              {attention.length - 4}곳 더 보기
            </Link>
          )}
        </section>

        {/* 5단계 — 돈. 숫자만 먼저 보이고 상세는 펼친다 */}
        <section aria-labelledby="money" className="flex min-w-0 flex-col gap-3">
          <SectionTitle title="돈" icon={Wallet} accent="money" />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <MetricTile label="예정 수금" value={krwTile(money.scheduled.total)} hint={`${money.scheduled.count}건`} />
            <MetricTile
              label="연체"
              value={krwTile(money.overdue.total)}
              tone={money.overdue.count > 0 ? 'danger' : 'neutral'}
              hint={`${money.overdue.count}건`}
            />
            <MetricTile label="금액 미정" value={`${money.unknownAmount}건`} hint="합산 제외" />
          </div>
          {money.overdue.items.length > 0 && (
            <Disclosure title="연체 상세" hint={`${money.overdue.items.length}건`}>
              <ul className="divide-y divide-slate-100">
                {money.overdue.items.slice(0, 6).map((m) => (
                  <li key={`${m.clientId}-${m.label}-${m.dueDate}`}>
                    <Link
                      to={`/ops/clients/${m.clientId}`}
                      className="t-sub flex items-center justify-between gap-2 py-2.5 hover:text-brand-700"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-semibold text-slate-800">{m.clientName}</span> · {m.label}
                      </span>
                      <span className="shrink-0 font-semibold text-danger-700">
                        {formatKrw(m.amount)} · {m.dueDate}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
        </section>

        {/* 5단계 — 지원사업 마감 */}
        <section aria-labelledby="funding" className="flex min-w-0 flex-col gap-3">
          <SectionTitle title="지원사업 마감" icon={Landmark} to="/funding" count={funding.length} accent="fund" />
          {funding.length === 0 ? (
            <Blank title="14일 안에 마감되는 신청 건이 없습니다." icon={<Landmark className="size-7" />} />
          ) : (
            <ListSurface>
              {funding.slice(0, 4).map((f) => (
                <ListRow
                  key={`${f.clientId}-${f.programName}-${f.applyDueDate}`}
                  title={f.programName}
                  meta={`${f.clientName}${f.institution ? ` · ${f.institution}` : ''}`}
                  right={
                    <span
                      className={
                        f.daysLeft < 0
                          ? 'font-semibold text-danger-700'
                          : f.daysLeft <= 3
                            ? 'font-semibold text-warning-700'
                            : ''
                      }
                    >
                      {dueText(f.daysLeft)}
                    </span>
                  }
                  onClick={() => navigate(`/ops/clients/${f.clientId}`)}
                />
              ))}
            </ListSurface>
          )}
        </section>
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
        <p className="text-[0.85rem] text-slate-400">활동 기록·업무 일기·이벤트 처리 내역을 규칙으로 정리한 것입니다 (AI 요약 아님).</p>
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
          onPick={(action) => applyTodoAction(todoPick, action)}
          onOpenClient={
            todoPick.clientId ? () => navigate(`/ops/clients/${todoPick.clientId}`) : undefined
          }
          onClose={() => setTodoPick(null)}
        />
      )}

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
            showToast('고객사에 연결했습니다.')
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
