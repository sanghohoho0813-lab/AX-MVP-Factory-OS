import { Suspense, lazy, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { AiAssist } from '../components/ai/AiAssist'
import { clientBundle, clientsBundle, todayBundle, todayLabel } from '../services/aiAssist/builders'
import { HomeAsk } from '../components/home/HomeAsk'
import { homeSuggestions, mergeBundles, nearNames, openedBy, planChips, planSection, ruleAnswer, type HomeIntent, type PickLite, type PlanChip } from '../services/homeAsk/homeAsk'
import { newFacts, newNumbers, talkAnswers, talkNext, talkNumbers, type TalkAnswer, type TalkNext, type TalkNumber } from '../services/homeAsk/homeTalk'
import { CHAT_NEW_ID, aiFactLines, docCompanyOf, previewWithDocs, readFactsLines, type ChatDoc, type DocCompany } from '../services/homeAsk/homeDocs'
import { personNames, safeText, type AssistSection } from '../services/aiAssist/context'
import { generateId } from '../storage/localStore'
import { nowIso } from '../lib/appClock'
import type { DocBatchSummary } from '../services/docAutoAnalyze'
import { assistOn, useAiAssistAccess } from '../auth/ownerAiAccess'
import { INSIGHT_TONE_LABEL } from '../services/insightLabels'
import { careList } from '../services/clientCare'
import { listSubscriptions } from '../services/finance/financeStore'
import { upcomingCharges } from '../services/finance/financeCore'
import { useMoneyWords } from '../components/ops/useMoneyWords'
import { useIsPhone } from '../lib/useIsPhone'
import { TodayCharges } from '../components/money/TodayCharges'
import { TodayCare } from '../components/ops/TodayCare'
import { TodayDecisions } from '../components/ops/DecisionList'
import { useGrantData } from '../components/grants/useGrants'
import { useClientReco } from '../components/ops/useClientReco'
import { TodayPicks, TodayPicksPlaceholder } from '../components/ops/TodayPicks'
import { TodayKpis } from '../components/ops/TodayKpis'
import { AppLauncher } from '../components/layout/AppLauncher'
import { hasWeekData, subscribeWeekRunLoaded } from '../services/marketing/weekRunFlag'
import { useAllDecisions } from '../components/ops/useAllDecisions'
import { useEntitlements } from '../lib/entitlementsStore'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  CirclePlus,
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
import { HeroFrame } from '../components/ui/pageFrame'
import { ArrangeArea, ArrangeItem } from '../components/ui/arrange'
import { useToast } from '../components/ui/toastContext'
import { QuickCapture } from '../components/journal/QuickCapture'
import { TodoActionSheet, TodoComposer, TodoRow, type TodoAction, type TodoDraft, type TodoEdits } from '../components/journal/TodoBoard'
import { JournalList } from '../components/journal/JournalList'
import { EventCard } from '../components/ops/EventCard'
import { LinkCustomerModal } from '../components/ops/LinkCustomerModal'
import { listClients, saveClient } from '../services/clientOpsService'
import { salesActionPath, salesRecontacts, salesRisks } from '../services/salesSignals'
import { agentLedger, agentLedgerTotals, netAmountOf } from '../services/feeMath'
import { CallButton } from '../components/ops/opsControls'
import { addDaysLocal, friendlyDate } from '../services/clientOpsNextAction'
import { countContractClients, isProspect, salesInFlow } from '../services/salesPipeline'
import { buildAllAlerts } from '../services/clientOpsAlerts'
import { buildAllSchedule, buildClientSchedule, upcomingWithin } from '../services/clientOpsSchedule'
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
import { agendaWhen, buildAgenda, contentAgenda, type AgendaItem } from '../services/upcomingAgenda'
import { listIdeas, type ContentIdea } from '../services/marketing/radarStore'
import { localDateOf, nowDate, todayLocalDate } from '../lib/appClock'
import { krwTile } from '../lib/format'
import { getDataModeConfig } from '../data/dataMode'
import { Fold, HelpHeading } from '../components/ui/fold'
import { useIsPilot } from '../auth/osAccess'
import { CLIENT_TYPE_LABEL, clientTypeOf } from '../services/clientType'
import type { ClientOpsRecord } from '../types/clientOps'
import type { CustomerEvent, CustomerEventStatus, JournalEntry } from '../types/bridge'
import { FirstClientSteps } from '../components/ops/FirstClientSteps'
import { PERSONAL_KEY } from '../services/journalKind'
import { recordMove, todoDay, useTodoTrail } from '../services/todoTrail'
import { PrivateNote } from '../components/journal/PrivateNote'

/** D-360 오늘 올릴 것(마케팅) — 마케팅 코드는 첫 화면 묶음에 넣지 않는다 */
const TodayPosts = lazy(() => import('./marketing/radar/TodayPosts'))
// D-479 남긴 1주일치가 있거나 이번 접속에서 1주일치를 다뤘을 때만 '오늘 올릴 것' 부품을 받아 온다
const weekDataNow = () => hasWeekData()

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

/** 휴대폰에서 처음 보여 줄 줄 수(D-166) */
const PHONE_ROWS = 3

/** D-238: 오늘 화면은 업체마다 공고를 대 보지 않는다 — 모듈 판정만 센다 */
const noGrantFit = () => 0

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

/** 목차 앞 색 칩(D-192: 접는 목차 Fold 의 icon 으로) */
function SectionChip({ icon: Icon, accent }: { icon: typeof Clock; accent: SectionAccent }) {
  return (
    <span aria-hidden="true" className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${SECTION_CHIP[accent]}`}>
      <Icon className="size-4" />
    </span>
  )
}

/** 목차 오른쪽 '모두 보기' — 접혀 있어도 바로 간다 */
function AllLink({ to }: { to: string }) {
  return (
    <Link to={to} className="tap inline-flex items-center text-[0.9rem] font-medium text-brand-700 hover:underline">
      모두 보기
    </Link>
  )
}

/** D-282 바로가기 — 목차 머리 + 앱 런처(PC 흰 카드 · 휴대폰 큰 아이콘) */
function TodayLauncher({ phone }: { phone: boolean }) {
  return (
    <section aria-labelledby="today-launcher-title" className="flex flex-col gap-2" data-testid="today-launcher">
      <HelpHeading
        id="today-launcher-title"
        label="바로가기"
        help="자주 여는 기능으로 바로 가요. 왼쪽 메뉴와 같은 기능이고, 계정에 열린 것만 보여요. 나머지는 [전체 도구] 에 있어요."
        className={`${phone ? 't-card' : 't-section'} flex items-center gap-2 break-keep text-slate-900`}
      >
        바로가기
      </HelpHeading>
      <AppLauncher variant={phone ? 'icon' : 'card'} />
    </section>
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
  const weekData = useSyncExternalStore(subscribeWeekRunLoaded, weekDataNow)
  const today = todayLocalDate(now)
  const isLocal = getDataModeConfig().mode === 'local'
  // D-162: Pilot 은 고객 플랫폼 상담신청 · 영업자 정산을 쓰지 않는다 — 그 칸을 그리지 않는다
  const pilot = useIsPilot()

  const [clients, setClients] = useState<ClientOpsRecord[]>([])
  // D-238: 먼저 제안할 것(가능성 높은 모듈)이 있는 업체 수 — 고객 관리 카드 띠와 같은 판정(지원사업 공고 수는 빼고 모듈 판정만)
  const reco = useClientReco(clients, today, noGrantFit)
  const pickCount = useMemo(
    () => (reco.ready ? clients.filter((c) => c.archivedAt === null && c.status !== 'completed' && (reco.chips.get(c.id) ?? []).some((x) => x.tone === 'good')).length : 0),
    [clients, reco],
  )
  // D-166: 휴대폰에서는 목록을 짧게(3건 · 4건) — '더 보기' 로 펼친다. PC 는 그대로
  const phone = useIsPhone()
  const [showAllAppts, setShowAllAppts] = useState(false)
  const [journal, setJournal] = useState<JournalEntry[]>([])
  // D-486 미룬 할 일 흔적 — 줄에 '11/1에서 미룸'
  const trail = useTodoTrail()
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

  // D-237 내 콘텐츠(콘텐츠 레이더)의 촬영 · 게시 예정 — 대표 화면에만(팀장은 마케팅이 없다). 못 읽으면 없이 그린다
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  useEffect(() => {
    if (pilot) {
      setIdeas([])
      return
    }
    let alive = true
    listIdeas(workspaceId)
      .then((list) => alive && setIdeas(list))
      .catch(() => alive && setIdeas([]))
    return () => {
      alive = false
    }
  }, [workspaceId, pilot])

  // 계약 완료(끝남)·보관을 뺀 곳이 '지금 챙기는 업체'
  // D-168: 할 일에 붙일 업체 — 보관하지 않은 업체 전부. 예전에는 예전 '끝남'(completed) 업체를 뺐는데,
  // D-157 부터 그 업체도 화면에는 '계약 완료' 로 보여 8곳 중 6곳만 고를 수 있었다(대표 지적).
  const active = useMemo(() => clients.filter((c) => c.archivedAt === null), [clients])
  const clientNames = useMemo(() => new Map(clients.map((c) => [c.id, c.companyName])), [clients])
  const alerts = useMemo(() => buildAllAlerts(clients, today), [clients, today])
  const schedule = useMemo(() => buildAllSchedule(clients, today), [clients, today])
  // '이번 주 마감' 은 마감만 — 다음 약속(D-120)은 아래 '약속' 줄에 따로
  // D-210: '이번 주' 는 오늘 ~ 6일 뒤(7일) — 아래 '이번 주 받을 것' 과 같은 기간(예전: 8일을 셌다)
  const weekDue = useMemo(() => upcomingWithin(schedule, 6).filter((e) => !e.done && e.kind !== 'next'), [schedule])
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
  const moneyWords = useMoneyWords()
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
  const contentDue = useMemo(() => contentAgenda(ideas, today), [ideas, today])
  const agendaAll = useMemo(() => buildAgenda({ schedule, journal, clientNames, prospectIds, today, days: 14, extra: contentDue }), [schedule, journal, clientNames, prospectIds, today, contentDue])
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
  // D-210: '끝낸 것' 은 오늘 끝낸 할 일 — 예전에는 기한이 지난 끝낸 할 일을 전부(몇 달 치) 세고, 미리 끝낸 다음 주 할 일은 빠졌다
  const doneTodos = useMemo(
    () => journal.filter((j) => j.entryType === 'follow_up' && j.completed && j.completedAt !== null && localDateOf(j.completedAt) === today),
    [journal, today],
  )
  const todoCount = openTodos.length
  // D-282 맨 위 KPI — 화면이 이미 센 것만(확인할 것은 아래 '확인할 것' 칸과 같은 판정)
  // D-479 업체가 많으면 나눠 계산(다 모이기 전엔 0) — 결과는 아래 '확인할 것' 목록과 함께 쓴다
  // 아직 모으는 중이면 null — 숫자 칸에 지어낸 0 대신 '–'
  const decisionCount = useAllDecisions(clients, today, grantNotices, usable)?.length ?? null
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  /** D-239: AI 도우미에 보낼 오늘 자료 — 화면이 이미 계산한 목록 그대로 */
  const assistBuild = useCallback(async () => {
    let charges: { name: string; date: string; amount: string }[] = []
    try {
      const subs = await listSubscriptions(workspaceId)
      charges = upcomingCharges(subs, today, 3).map((c) => ({ name: c.sub.name, date: c.date, amount: `${c.sub.currency === 'USD' ? '$' : ''}${c.sub.amount.toLocaleString('ko-KR')}${c.sub.currency === 'USD' ? '' : '원'}` }))
    } catch {
      charges = []
    }
    return todayBundle({ today, clients, overdueTodos, todayTodos, hardDue, appointments, agenda, agendaLate, money, weekIn, salesRisks: salesRiskList, recontacts: salesRecontactList, care: careList(clients, today), openEvents: pilot ? 0 : openEvents.length, agentPayable: pilot ? 0 : agentPayable, charges, journal })
  }, [workspaceId, today, clients, overdueTodos, todayTodos, hardDue, appointments, agenda, agendaLate, money, weekIn, salesRiskList, salesRecontactList, pilot, openEvents, agentPayable, journal])

  const clientNameOf = (id: string) => clientNames.get(id)

  /*
   * D-497 맨 위 대화창 — 질문 세 줄은 지금 자료에서(약속 → 새 서류 → 추천 많은 업체), 묻는 순간 자료를 묶는다.
   * 물어본 업체: 회사 · OS 모듈 판정 · 일정 · 받을 돈 · 서류함(업체 상세 AI 도우미와 같은 자료) → 오늘 → (업체가 없으면) 고객 전체.
   */
  const aiAccess = useAiAssistAccess()
  const homeTips = useMemo(() => {
    const weekAgo = addDaysLocal(today, -7)
    const freshDocs = active
      .map((c) => ({ c, at: Object.values(c.documents ?? {}).reduce((m, d) => (d && typeof d.uploadedAt === 'string' && d.uploadedAt > m ? d.uploadedAt : m), '') }))
      .filter((x) => x.at && x.at.slice(0, 10) >= weekAgo)
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((x) => ({ clientId: x.c.id, clientName: x.c.companyName }))
    const recos = active
      .map((c) => ({ clientId: c.id, clientName: c.companyName, labels: (reco.chips.get(c.id) ?? []).map((ch) => ch.label), score: reco.scores.get(c.id) ?? 0 }))
      .filter((r) => r.labels.length > 0)
      .sort((a, b) => b.score - a.score || b.labels.length - a.labels.length)
    return homeSuggestions({ appointments: appointments.map((e) => ({ clientId: e.clientId ?? null, clientName: e.clientName, daysLeft: e.daysLeft })), freshDocs, recos, overdueMoney: money.overdue.count, hasTodos: todoCount > 0 })
  }, [active, today, reco, appointments, money, todoCount])
  const homePrepare = useCallback(
    async (question: string, ids: string[], intents: HomeIntent[], docs: readonly ChatDoc[] = []) => {
      const base = await assistBuild()
      const { buildInsights, topPicks } = await import('../services/clientInsights')
      let focus = ids.map((id) => clients.find((c) => c.id === id)).filter((c): c is ClientOpsRecord => !!c)
      /*
       * D-498 함께 올린 서류 — 어느 회사 서류인지(번호 · 이름) 찾고, 그 업체(없으면 빈 새 업체)에 서류를 얹어 임시 판정. 저장하지 않는다.
       * 서류에서 회사를 못 찾으면 질문에 나온 업체에 얹는다.
       */
      let docCompany: DocCompany | null = null
      let docSummary: DocBatchSummary | null = null
      const docSections: AssistSection[] = []
      const docFacts: string[] = []
      if (docs.length) {
        const [{ guessNewClientFromDocs }, { findClientForCretop }, { normalizeClientOps }] = await Promise.all([import('../services/newClientFromDocs'), import('../services/salesCretop'), import('../services/clientOpsService')])
        const { guess } = guessNewClientFromDocs(docs.filter((d) => d.text).map((d) => ({ fileName: d.file.name, text: d.text, method: d.method })))
        docCompany = docCompanyOf(guess, clients, findClientForCretop)
        const named = focus[0]
        const target = docCompany?.clientId ? clients.find((c) => c.id === docCompany?.clientId) ?? null : !docCompany && named ? named : null
        if (docCompany && named && docCompany.clientId !== named.id) docFacts.push(`질문의 업체(${named.companyName})와 서류의 회사(${docCompany.name || '다른 회사'})가 달라요 — 서류의 회사로 판정했어요`)
        if (!docCompany && target) docCompany = { clientId: target.id, name: target.companyName, bizNo: target.businessNumber, contact: '' }
        const blank = target ?? normalizeClientOps({ id: CHAT_NEW_ID, companyName: docCompany?.name || '새 업체', businessNumber: docCompany?.bizNo ?? '' } as Parameters<typeof normalizeClientOps>[0])
        const prev = await previewWithDocs(blank, docs, { now: nowIso(), today, makeId: generateId })
        docSummary = prev.summary
        focus = [prev.record, ...focus.filter((r) => r.id !== prev.record.id)].slice(0, 3)
        const names = personNames(prev.record)
        docSections.push({ name: '방금 올린 서류(아직 저장 전 · 임시 판정)', rows: docs.map((d) => ({ 서류: d.label || '종류 모름', 파일: safeText(d.file.name, names, 80), 등록된업체: target ? '예' : '아니요(새 업체)' })) })
        const facts = aiFactLines(prev.summary)
        if (facts.length) docSections.push({ name: '방금 올린 서류에서 읽은 것', rows: facts.map((f) => ({ 읽은것: f })) })
      }
      const DOCISH = /서류|증명|명부|재무|등본|등기|계약서|확인서|등록증|신고서|원천징수|정관|규정|주주/
      const focusData = focus.map((r) => {
        const insights = buildInsights(r, today, grantNotices, usable)
        const picks: PickLite[] = topPicks(insights, 4).map((x) => ({ key: x.key, label: x.label, tone: x.tone, toneLabel: INSIGHT_TONE_LABEL[x.tone], headline: x.headline, amount: x.amount, missing: x.missing, openPath: x.openPath }))
        const missingDocs = [...new Set(insights.flatMap((x) => x.missing).filter((m) => DOCISH.test(m)))]
        return { r, insights, picks, missingDocs }
      })
      /*
       * D-501 물어본 업체에 맞는 상황 예시(맞음 · 결과 나옴 · 질문에 나온 모듈 먼저 · 최대 3) — 답 아래 단추 · AI 자료 칸.
       * 모듈은 저장된 업체 기록으로 열리므로 상황도 저장된 기록으로 계산한다(올린 서류는 저장한 뒤 반영).
       */
      const planRec = focus[0] ? clients.find((c) => c.id === focus[0].id) : undefined
      let plans: PlanChip[] = []
      /*
       * D-502 질문에서 읽은 업체 사정(청년 뽑는대 · 설비 살 계획 · 가지급금 있어 …) — 상황 예시 질문의 답.
       * 사실은 [업체에 기록] 한 번으로 남기고(아직 업체에 없는 답만), 가정(… 하면 얼마?)은 그 가정으로 설계만 보여 준다.
       * 단추의 상황은 그 답을 넣은 기록으로 계산 — 새로 맞게 된 상황이 맨 앞.
       */
      const talk = talkAnswers(question)
      // D-503 말한 숫자(작년 매출 52억 · 직원 18명 …) — 회사 정보(사실 창고 · 출처 '상담 메모')로. 이 숫자로 달라지는 판정도 함께 보여 준다
      const nums = talkNumbers(question, Number(today.slice(0, 4)))
      // D-504 말한 다음 약속(다음 주 화요일 오후 2시 2차 미팅) — 업체 '다음 할 일'(날짜 · 무엇). 이미 같으면 다시 묻지 않는다
      const said = talkNext(question, today)
      const talkNx: TalkNext | null = said && planRec && !(planRec.nextActionDueDate === said.date && planRec.nextAction === said.text) ? said : null
      let talkFacts: TalkAnswer[] = []
      let talkNums: TalkNumber[] = []
      let talkChanges: string[] = []
      let talkSec: AssistSection | null = null
      if (planRec) {
        try {
          const [{ runScenarios, runScenariosCached }, { scenarioAnswer, withScenarioAnswer }, { readFact, withFactValue }] = await Promise.all([import('../services/scenarios'), import('../services/scenarioFit'), import('../services/customerFacts')])
          const before = runScenariosCached(planRec, today, usable, true)
          talkFacts = newFacts(talk, (k) => scenarioAnswer(planRec, k))
          talkNums = newNumbers(nums, (k) => readFact(planRec, k)?.value ?? '')
          const ifs = talk.filter((t) => t.mode === 'if')
          const withNums = talkNums.reduce((r, n) => withFactValue(r, n.key, n.value, { source: 'meeting', asOf: n.asOf, now: nowIso() }), planRec)
          if (talkFacts.length || talkNums.length) {
            const { insightChanges } = await import('../services/clientInsights')
            talkChanges = insightChanges(buildInsights(planRec, today, grantNotices, usable), buildInsights(talkFacts.reduce((r, t) => withScenarioAnswer(r, t.key, t.a, nowIso()), withNums), today, grantNotices, usable)).map((i) => `${i.label} — ${INSIGHT_TONE_LABEL[i.tone]}`)
          }
          if (talkFacts.length || talkNums.length || ifs.length) {
            const withFacts = talkFacts.reduce((r, t) => withScenarioAnswer(r, t.key, t.a, nowIso()), withNums)
            const afterFacts = talkFacts.length || talkNums.length ? runScenarios(withFacts, today, usable, true) : before
            const withIfs = ifs.reduce((r, t) => withScenarioAnswer(r, t.key, t.a, nowIso()), withFacts)
            const after = ifs.length ? runScenarios(withIfs, today, usable, true) : afterFacts
            const tags = new Map([...openedBy(afterFacts, after, 'if'), ...openedBy(before, afterFacts, 'talk')])
            plans = planChips(after, intents, 3, CHAT_NEW_ID, tags)
          } else {
            plans = planChips(before, intents)
          }
          const told = [...talkFacts, ...ifs]
          const rows = [
            ...told.map((t) => ({ 사정: t.label, 답: t.a === 'yes' ? '있음' : '없음', 종류: t.mode === 'if' ? '가정(물어본 것)' : '말한 사실' })),
            ...talkNums.map((n) => ({ 사정: `${n.label}${n.asOf ? `(${n.asOf}년)` : ''}`, 답: n.display, 종류: '말한 숫자' })),
            ...talkChanges.map((c) => ({ 사정: '이 말로 달라지는 판정', 답: c, 종류: '규칙 계산' })),
            ...(talkNx ? [{ 사정: '다음 약속', 답: `${friendlyDate(talkNx.date)} ${talkNx.text}`, 종류: '말한 일정' }] : []),
          ]
          if (rows.length) talkSec = { name: `물어본 업체 · ${planRec.companyName} 대화에서 알게 된 사정(아직 기록 전 · 가정은 가정)`, rows }
        } catch {
          plans = [] // 상황 계산이 실패해도 답은 나간다
        }
      }
      const plansSec = planRec ? planSection(plans, planRec.companyName) : null
      const TODAY_FOCUS = new Set(['오늘 할 일', '놓치면 끝나는 기한(7일 안)', '업체 약속(지난 것 · 오늘 · 내일)'])
      const TODAY_ALL = new Set(['밀린 할 일', '오늘 할 일', '놓치면 끝나는 기한(7일 안)', '업체 약속(지난 것 · 오늘 · 내일)', '다가오는 마감 · 약속(14일)', '밀린 돈(받을 날 지남)', '영업 — 챙길 곳', '영업 — 다시 연락할 곳'])
      const bundle = mergeBundles(
        [
          ...focusData.map((f) => ({ bundle: clientBundle(f.r, today, f.insights, buildClientSchedule(f.r, today)), rename: (n: string) => `물어본 업체 · ${n}` })),
          { bundle: base, take: (n: string) => (focus.length ? TODAY_FOCUS : TODAY_ALL).has(n), rename: (n: string) => `오늘 · ${n}` },
          ...(focus.length ? [] : [{ bundle: clientsBundle(active, today, reco), rename: (n: string) => `고객 · ${n}` }]),
        ],
        { title: '오늘 대화창', today: todayLabel(today), purpose: docs.length ? `방금 올린 서류(${docCompany?.name || '회사 모름'}) — 이 서류로 무엇을 제안하고 무엇을 더 받을지(아직 저장 전 · 임시 판정)` : focus.length ? `물어본 업체(${focus.map((f) => f.companyName).join(' · ')}) — 무엇을 제안하고 무엇을 확인할지` : '오늘 · 이번 주 · 고객 전체 — 물어본 것에 바로 답' },
        { before: [...docSections, ...(talkSec ? [talkSec] : []), ...(plansSec ? [plansSec] : [])], facts: [...docFacts, ...(focus.length ? [] : [`등록된 업체 ${active.length}곳`])] },
      )
      // 아직 등록 안 된 업체(임시 기록)로 가는 이동 주소는 뺀다 — 눌러도 없는 화면
      for (const [ref, href] of Object.entries(bundle.links)) if (href.includes(CHAT_NEW_ID)) delete bundle.links[ref]
      const companyish = intents.includes('meeting') || intents.includes('docs') || /업체|회사|기업|대표님/.test(question)
      const rule = ruleAnswer({
        question,
        intents,
        focus: focusData.map((f) => ({ id: f.r.id, name: f.r.companyName, picks: f.picks, missingDocs: f.missingDocs })),
        today: {
          overdue: overdueTodos.length,
          todos: todayTodos.slice(0, 3).map((t) => t.content.slice(0, 60)),
          hardDue: hardDue.slice(0, 3).map((h) => `${h.clientName ? `${h.clientName} · ` : ''}${h.title}`),
          appointments: appointments.filter((e) => (e.daysLeft ?? 9) >= 0).slice(0, 3).map((e) => `${e.clientName} — ${e.title}${e.daysLeft === 0 ? ' (오늘)' : e.daysLeft === 1 ? ' (내일)' : ''}`),
        },
        nearNames: focus.length === 0 && companyish ? nearNames(question, active) : [],
      })
      if (docs.length) {
        for (const [ref, href] of Object.entries(rule.links)) if (href.includes(CHAT_NEW_ID)) delete rule.links[ref]
        const read = readFactsLines(docSummary)
        if (read.length) rule.items.unshift({ title: '이 서류에서 읽은 것', outline: read })
        if (docFacts.length) rule.caution = docFacts.join(' ')
      }
      return { bundle, rule, plans, ...(planRec && (talkFacts.length || talkNums.length || talkNx) ? { talk: { clientId: planRec.id, company: planRec.companyName, answers: talkFacts, numbers: talkNums, changes: talkChanges, ...(talkNx ? { next: talkNx } : {}) } } : {}), ...(docs.length ? { docCompany } : {}) }
    },
    [assistBuild, clients, active, today, grantNotices, usable, reco, overdueTodos, todayTodos, hardDue, appointments],
  )

  /** D-502 대화창에서 읽은 업체 사정을 업체에 기록 — 저장 직전에 새로 읽어(다른 창 · 팀장이 고친 것을 덮지 않게 · D-212) 답만 더한다 */
  const recordTalk = useCallback(
    async (clientId: string, answers: readonly TalkAnswer[], numbers: readonly TalkNumber[] = [], next?: TalkNext): Promise<boolean> => {
      const { applyTalk } = await import('../services/homeAsk/talkApply')
      try {
        const fresh = (await listClients(workspaceId).catch(() => null))?.find((c) => c.id === clientId) ?? clients.find((c) => c.id === clientId)
        if (!fresh) return false
        // D-505 업무 일기 메모와 같은 길(숫자 → 사정 → 다음 약속)
        const saved = await saveClient(applyTalk(fresh, { answers: [...answers], numbers: [...numbers], next: next ?? null }, nowIso()))
        setClients((cs) => cs.map((c) => (c.id === saved.id ? saved : c)))
        return true
      } catch (cause) {
        showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
        return false
      }
    },
    [workspaceId, clients, showToast],
  )

  /** 할 일 시트에서 고른 것을 실행한다 */
  const applyTodoAction = async (entry: JournalEntry, action: TodoAction, edits?: TodoEdits) => {
    // D-201: 같은 창에서 고친 내용 · 기한 · 업체가 있으면 상태와 함께 한 번에 저장한다.
    // 고친 것이 있으면 저장이 된 뒤에만 창을 닫는다(실패하면 적은 것이 창에 그대로 남는다).
    if (!edits || action === 'delete') setTodoPick(null)
    const base: Partial<JournalEntry> = edits ? { content: edits.content, dueDate: edits.dueDate, clientId: edits.clientId, serviceKey: edits.serviceKey } : {}
    let ok: boolean
    // D-486 더 나중 날로 옮기면 떠난 날에 흔적(달력에 옅은 주황)
    const from = todoDay(entry)
    let to = edits?.dueDate || from
    if (action === 'delete') ok = await journalMutate(() => deleteJournalEntry(entry), '지웠습니다.')
    else if (action === 'today') {
      to = today
      ok = await journalMutate(() => updateJournalEntry(entry, { ...base, dueDate: today, completed: false }), '오늘 할 일로 옮겼습니다.')
    } else if (action === 'tomorrow') {
      to = postponedDue(entry.dueDate, today)
      ok = await journalMutate(() => updateJournalEntry(entry, { ...base, dueDate: to, completed: false }), '내일로 미뤘습니다.')
    } else ok = await journalMutate(() => updateJournalEntry(entry, { ...base, completed: action === 'done' }), edits ? '저장했습니다.' : undefined)
    if (ok && action !== 'delete') recordMove(entry.id, from, to)
    if (ok && edits) setTodoPick(null)
  }


  /** 오늘 할 일 한 줄 넣기 — 업무 일기의 '할 일' 로 저장된다 */
  const addTodo = (draft: TodoDraft) =>
    journalMutate(
      () =>
        createJournalEntry(workspaceId, userId, {
          entryDate: today,
          entryType: 'follow_up',
          content: draft.content,
          clientId: draft.clientId,
          dueDate: draft.dueDate,
          // 2026-11-02 개인 일정은 service_key 'personal'(업무 일기 칸 그대로 — 본인만 읽는다)
          serviceKey: draft.kind === 'personal' ? PERSONAL_KEY : null,
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
        {/* UXS-1 웰컴 띠 — 화면 공통 머리 바탕(HeroFrame) + 대표 그림 1번. 글 · 단추 · 셈은 그대로 */}
        <HeroFrame art="home" testId="today-hero">
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:py-6 lg:min-h-[9.5rem] lg:justify-center">
          <div className="min-w-0 flex-1 lg:max-w-[62%]">
            <p className="t-sub font-medium text-slate-500">
              <time dateTime={now.toISOString()}>{timeText}</time> · {greeting(now.getHours())}
            </p>
            <h1 className="t-page mt-0.5 flex flex-wrap items-baseline gap-x-3 break-keep text-slate-900">
              {/* D-482 읽는 동안은 짧게(한 줄) — 긴 '불러오는 중' 문구가 휴대폰에서 두 줄이었다가 '오늘 할 일 n건' 한 줄로 줄며 아래가 통째로 밀렸다 */}
              {loading
                ? '오늘 할 일'
                : todoCount > 0
                  ? `오늘 할 일 ${todoCount}건`
                  : '오늘 할 일을 적어 보세요'}
              <Link to="/journal" className="tap t-sub inline-flex items-center font-medium text-brand-700 hover:underline">
                모두 보기
              </Link>
            </h1>
            {/* D-360 이번 주 1주일치 프로젝트가 있으면 오늘 올릴 것 한 줄(누르면 그 탭) */}
            {weekData && (
              <Suspense fallback={null}>
                <TodayPosts />
              </Suspense>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 self-start">
            <span className="hidden sm:inline-flex">
              {/* NX-1 하루를 마칠 때 누르는 단추 — 아침 첫 화면의 강조는 '오늘 먼저 제안할 것' 에 양보(단추 · 하는 일은 그대로) */}
              <Button variant="secondary" onClick={() => setSummaryOpen(true)}>
                <Moon aria-hidden="true" className="size-4" /> 오늘 정리하기
              </Button>
            </span>
          </div>
        </div>
        </HeroFrame>
      </section>

      {/* D-162: 업체가 하나도 없으면 빈 화면 자체가 다음 행동을 알려 준다(안내 창 없이) */}
      {!loading && clients.length === 0 && (
        <section data-testid="today-first-client" className="flex flex-col items-center gap-3 rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-8 text-center">
          <Building2 aria-hidden="true" className="size-8 text-brand-400" />
          <p className="text-[1.2rem] font-bold text-slate-900">등록된 업체가 없습니다</p>
          <Button variant="primary" onClick={() => navigate('/ops/clients?new=1')} data-testid="today-first-client-add">
            <CirclePlus aria-hidden="true" className="size-4" />첫 업체 등록
          </Button>
          <p className="t-body max-w-xl break-keep text-slate-600">업체를 등록하면 일정 · 서류 · 업무 · 수금을 한곳에서 관리할 수 있습니다.</p>
          <FirstClientSteps />
        </section>
      )}

      {/*
        D-287 화면 꾸미기 — 아래 칸은 사람마다 순서 · 오늘만 숨기기 · 계속 숨기기(경로 줄 [화면 꾸미기]).
        기본 순서는 예전 그대로(휴대폰은 바로가기가 숫자 칸 위). 머리(인사 · 오늘 할 일 수)와 '첫 업체 등록' 안내는 늘 위.
      */}
      <ArrangeArea page="today" title="오늘" className="flex flex-col gap-4 sm:gap-6">
        {/* D-497 맨 위 대화창 — 처음엔 보이고, 화면 꾸미기로 숨길 수 있다(대표 · 팀장 — AI 도우미와 같은 자격) */}
        {assistOn(aiAccess) && (
          <ArrangeItem id="ask" label="무엇이든 물어보기(대화창)" hint="업체 이름과 함께 물으면 그 업체 판정 · 서류로 답해요">
            <HomeAsk clients={clients} suggestions={homeTips} canAI={assistOn(aiAccess)} prepare={homePrepare} onRecordTalk={recordTalk} onRecorded={() => void listJournal(workspaceId).then(setJournal).catch(() => undefined)} />
          </ArrangeItem>
        )}
        {phone && (
          <ArrangeItem id="launcher" label="바로가기" hint="자주 쓰는 화면 아이콘">
            <TodayLauncher phone />
          </ArrangeItem>
        )}
        <ArrangeItem id="kpis" label="숫자 다섯 칸" hint="오늘 처리할 업무 · 진행 중 고객사 · 확인 필요 · AI 작업 · 상담">
          {/* D-482 읽는 동안에도 칸 자리를 잡아 둔다 — 다 읽은 뒤 숫자 칸이 끼어들며 아래가 통째로 밀렸다(화면 밀림 CLS) */}
          {(
                    <TodayKpis
                      loading={loading}
                      todo={{ open: todoCount, overdue: overdueTodos.length, hard: hardDue.length }}
                      clients={{ contract: countContractClients(clients), prospect: clients.filter(isProspect).length }}
                      decisions={decisionCount}
                      follow={{ events: openEvents.length, appointments: appointments.length, lateAppointments: appointments.filter((e) => (e.daysLeft ?? 0) < 0).length }}
                      pilot={pilot}
                      phone={phone}
                      onTodos={() => scrollTo('today-todo-card')}
                      onFollow={() => (!pilot && openEvents.length > 0 ? navigate('/ops/inbox') : appointments.length > 0 ? scrollTo('today-appointments') : navigate('/ops/calendar'))}
                    />
                  )}
        </ArrangeItem>
        {!phone && (
          <ArrangeItem id="launcher" label="바로가기" hint="자주 쓰는 화면 아이콘">
            <TodayLauncher phone={false} />
          </ArrangeItem>
        )}
        <ArrangeItem id="picks" label="오늘 먼저 제안할 것" hint="맞는 모듈이 있는 업체">
          {/* D-482 읽는 동안 · 판정을 기다리는 동안은 같은 모양의 자리(업체가 있을 때) — 끝나면 칸으로 바뀐다 */}
          {loading || (!reco.ready && active.length > 0) ? <TodayPicksPlaceholder /> : <TodayPicks clients={clients} reco={reco} phone={phone} />}
        </ArrangeItem>
        <ArrangeItem id="assist" label="AI 도우미" hint="오늘 제일 중요한 것 · 직접 묻기">
          {!loading && clients.length > 0 && <AiAssist page="today" title="오늘 할 일" presets={['today.top3', 'today.deadline', 'today.order', 'today.calls']} build={assistBuild} onRecorded={() => void listJournal(workspaceId).then(setJournal).catch(() => undefined)} />}
        </ArrangeItem>
        <ArrangeItem id="todos" label="오늘 할 일" hint="할 일 적기 · 밀린 것 · 오늘 · 끝낸 것">
          {/*
            B. 오늘 할 일 — 내가 적은 것.
            규칙이 찾아 주는 경고보다 위에 둔다. 하루를 실제로 굴리는 것은 내가 적어 둔
            한 줄이지, 시스템이 센 숫자가 아니다.
          */}
          <section
            aria-labelledby="todos"
            id="today-todo-card"
            className="scroll-mt-24 flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5"
          >
            {/*
              카드 안에 '오늘 할 일' 제목을 또 두지 않는다 — 바로 위 h1 이 이미 그 말이다.
              제목 줄을 없앤 자리를 적는 칸이 가져간다. 이 화면에서 제일 많이 누르는 곳이다.
            */}
            <h2 id="todos" className="sr-only">
              오늘 할 일
            </h2>
            <TodoComposer date={today} clients={active} onAdd={addTodo} />
            {/* 2026-11-02 대표 지시 — 내 할 일은 나만 본다는 것을 분명히(사실: 업무 일기 RLS 본인만) */}
            <PrivateNote />

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
                      movedFrom={trail[e.id]?.from}
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
                      movedFrom={trail[e.id]?.from}
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
                  {/* D-377 박스 색은 하나로 — 급한 것은 제목 · 날짜의 빨간 글자가 말한다 */}
                  <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200 bg-white">
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
                <div data-testid="today-appointments" id="today-appointments" className="scroll-mt-24 flex flex-col gap-2">
                  <p className="t-sub font-semibold text-slate-700">업체 약속 {appointments.length}건</p>
                  <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200 bg-white">
                    {(phone && !showAllAppts ? appointments.slice(0, PHONE_ROWS) : appointments).map((e) => {
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
                  {phone && !showAllAppts && appointments.length > PHONE_ROWS && (
                    <button type="button" onClick={() => setShowAllAppts(true)} className="tap t-sub self-start font-semibold text-brand-700 hover:underline" data-testid="today-appointments-more">
                      업체 약속 {appointments.length - PHONE_ROWS}건 더 보기
                    </button>
                  )}
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
                      movedFrom={trail[e.id]?.from}
                    />
                  ))}
                </ul>
              </Disclosure>
            )}
          </section>
        </ArrangeItem>
        <ArrangeItem id="decisions" label="확인할 것" hint="자료에서 읽은 정보 — 맞다 · 아니다">
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
        </ArrangeItem>
        <ArrangeItem id="agenda" label="다가오는 마감 · 약속" span="wide">
          {/* 2단계 — 다가오는 마감 · 약속(D-143: 날짜가 있는 실제 일만, 날짜 순) */}
          {/* D-192: 목차마다 접기 · 마우스를 올리면 무슨 칸인지. 마감 · 약속은 펼친 채로 시작 */}
          <Fold
            id="today.agenda"
            title="다가오는 마감 · 약속"
            headingId="upcoming"
            tour="home-upcoming"
            testId="today-agenda"
            // D-357 첫 화면은 단순하게 — 접힌 채로 숫자만(밀린 것 · 오늘 약속은 위 할 일 칸에 이미 있다)
            // D-365 접혀 있어도 돈 숫자는 한 줄에(안의 '못 받은 내 돈 · 미수금' 칸과 같은 숫자)
            summary={`${agenda.length ? `2주 안 ${agenda.length}건 — 누르면 날짜 순으로` : '2주 안에 잡힌 마감 · 약속 없음'}${money.scheduled.total + money.overdue.total > 0 ? ` · ${moneyWords.unpaid} ${krwTile(money.scheduled.total + money.overdue.total)}${money.overdue.count > 0 ? `(연체 ${money.overdue.count}건)` : ''}` : ''}`}
            icon={<SectionChip icon={CalendarClock} accent="urgent" />}
            count={agenda.length}
            countTone={agenda.length > 0 ? 'danger' : 'neutral'}
            action={<AllLink to="/ops/calendar" />}
          >
            {loading ? (
              <p className="t-sub text-slate-500">불러오는 중…</p>
            ) : agenda.length === 0 ? (
              <p className="t-sub break-keep rounded-(--radius-card) border border-dashed border-slate-300 bg-white px-4 py-4 text-slate-500" data-testid="today-agenda-empty">
                2주 안에 잡힌 마감 · 약속이 없습니다.
              </p>
            ) : (
              <ol className="ax-stagger flex flex-col gap-2">
                {agenda.slice(0, phone ? 4 : 8).map((a) => (
                  <AgendaRow key={a.id} item={a} />
                ))}
              </ol>
            )}
            {agenda.length > (phone ? 4 : 8) && (
              <Link to="/ops/calendar" className="tap t-sub inline-flex items-center self-start font-semibold text-brand-700 hover:underline" data-testid="today-agenda-more">
                2주 안 {agenda.length}건 모두 달력에서 보기 →
              </Link>
            )}
            {agendaLate.length > 0 && (
              <div data-testid="today-agenda-late">
                <Disclosure title="마감 지난 업무 · 신청" hint={`${agendaLate.length}건`}>
                  <ol className="flex flex-col gap-2">
                    {agendaLate.slice(0, 10).map((a) => (
                      <AgendaRow key={a.id} item={a} />
                    ))}
                  </ol>
                </Disclosure>
              </div>
            )}

            {/* 오늘의 숫자 — 위가 아니라 할 일 아래에 둔다. 숫자는 판단의 근거이지 할 일이 아니다 */}
            <div className={`ax-stagger mt-1 grid grid-cols-2 gap-2.5 ${pilot ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
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
                label={moneyWords.unpaid}
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
              {!pilot && (
                <MetricTile
                  label="새 상담신청"
                  value={`${openEvents.length}건`}
                  tone={openEvents.length > 0 ? 'brand' : 'neutral'}
                  onClick={() => navigate('/ops/inbox')}
                />
              )}
            </div>

            {/* D-122: 오늘 화면에 안 보이던 돈 두 가지 — 영업자에게 줄 돈 · 받을 날을 안 정한 수금 */}
            {((!pilot && agentPayable > 0) || noDueFees.length > 0) && (
              <p data-testid="today-money-notes" className="t-sub flex flex-wrap gap-x-4 gap-y-1 break-keep text-slate-600">
                {!pilot && agentPayable > 0 && (
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
          </Fold>
        </ArrangeItem>
        <ArrangeItem id="capture" label="무슨 일이 있었나요? (메모 · 기록)" hint="빠른 기록 · 오늘 적은 메모" span="narrow">
          {/* 3단계 — 빠른 기록(D-192: 접어 두고 필요할 때 펼친다) */}
          <Fold
            id="today.capture"
            title="무슨 일이 있었나요?"
            headingId="capture"
            tour="home-capture"
            testId="today-capture"
            summary="누르면 바로 적는 칸"
            icon={<SectionChip icon={NotebookPen} accent="journal" />}
            count={todayJournal.length}
            action={<AllLink to="/journal" />}
          >
            <QuickCapture
              clients={active}
              compact
              onCreate={(input) => journalMutate(() => createJournalEntry(workspaceId, userId, input), '기록했습니다.')}
              // D-506 업체를 골라 적은 메모 → 사정 · 숫자 · 다음 약속 [그 업체에 기록](대화창과 같은 저장 길)
              onTalkRecord={(id, f) => recordTalk(id, f.answers, f.numbers, f.next ?? undefined)}
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
              emptyHint=""
            />
            {todayJournal.length > 4 && (
              <Link to="/journal" className="tap t-sub inline-flex items-center font-medium text-brand-700 hover:underline">
                오늘 기록 {todayJournal.length}건 모두 보기
              </Link>
            )}
          </Fold>
        </ArrangeItem>
        {/* 4단계 — 고객 이벤트(Pilot 은 고객 플랫폼을 쓰지 않는다) */}
        {!pilot && (
          <ArrangeItem id="events" label="상담신청" span="half">
          <Fold
            id="today.events"
            title="상담신청"
            headingId="events"
            tour="home-events"
            testId="today-events"
            icon={<SectionChip icon={Inbox} accent="event" />}
            count={openEvents.length}
            countTone="brand"
            action={<AllLink to="/ops/inbox" />}
          >
            {openEvents.length === 0 ? (
              <Blank
                title="새 상담신청이 없습니다."
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
          </Fold>
        
          </ArrangeItem>
        )}
        <ArrangeItem id="sales" label="영업" hint="지금 챙길 영업 · 다시 연락할 곳" span="half">
          {/* D-118: 영업 — 영업 관리 보드의 '지금 챙길 영업' 을 오늘에서도. 없으면 다시 연락할 곳 */}
          <Fold
            id="today.sales"
            title="영업"
            headingId="today-sales"
            testId="today-sales"
            icon={<SectionChip icon={KanbanSquare} accent="sales" />}
            count={salesRiskList.length}
            countTone="warning"
            action={<AllLink to="/sales/board" />}
          >
            <p className="t-sub text-slate-500">
              진행 중 <strong className="font-semibold text-slate-800 tabular-nums">{salesFlow.count}곳</strong>
              {salesFlow.fee > 0 && <> · 예상 수임료 <strong className="font-semibold text-slate-800 tabular-nums">{krwTile(salesFlow.fee)}</strong></>}
              {salesRecontactList.length > 0 && <> · 다시 연락할 곳 {salesRecontactList.length}</>}
              {pickCount > 0 && (
                <>
                  {' · '}
                  <Link to="/ops/clients?sort=reco" data-testid="today-reco-count" className="tap inline-flex items-center font-semibold whitespace-nowrap text-success-700 hover:underline">
                    먼저 제안할 업체 {pickCount}곳 →
                  </Link>
                </>
              )}
              {' · '}
              {/* D-119: 크레탑 보고서 한 번으로 잠재고객 등록 */}
              <Link to="/sales/new" data-testid="today-cretop-intake" className="tap inline-flex items-center font-semibold whitespace-nowrap text-brand-700 hover:underline">
                + 크레탑으로 등록
              </Link>
            </p>
            {salesRiskList.length === 0 && salesRecontactList.length === 0 ? (
              <Blank
                title="지금 챙길 영업이 없습니다."
                icon={<KanbanSquare className="size-7" />}
                action={
                  <Link to="/sales/board" className="tap inline-flex items-center gap-1 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 font-semibold text-brand-700 hover:bg-brand-100">
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
                  <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-1.5">
                    <Link to={`/ops/clients/${x.id}`} className="tap t-sub inline-flex items-center font-bold text-slate-900 hover:text-brand-700 hover:underline">{x.name}</Link>
                    {/* 12rem 아래로는 줄이지 않고 다음 줄로 — 좁은 화면 · 큰 글자에서 한 줄에 두세 자씩 짜부라지지 않게 */}
                    <span className={`t-sub min-w-0 flex-[1_1_12rem] break-keep ${x.tone}`}>{x.why}</span>
                    <Link to={salesActionPath(x.go, x.id)} className="tap t-meta ml-auto inline-flex shrink-0 items-center font-semibold text-brand-700 hover:underline">{x.go} →</Link>
                  </li>
                ))}
              </ul>
            )}
          </Fold>
        </ArrangeItem>
        <ArrangeItem id="care" label="안부 챙길 계약 고객" hint="한 달 넘게 조용 · 계약 1주년(없으면 칸 없음)" span="half">
          {/* D-155: 계약 고객 돌봄 — 한 달 넘게 조용 · 계약 1주년. 없으면 칸 없음 */}
          <TodayCare clients={clients} today={today} workspaceId={workspaceId} onSaved={(r) => setClients((cs) => cs.map((c) => (c.id === r.id ? r : c)))} />
        </ArrangeItem>
      </ArrangeArea>

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
            <HelpHeading as="h3" tight label={title} className={`text-[0.95rem] font-bold ${cls}`}>
              {title} <span className="font-semibold text-slate-400">{items.length}</span>
            </HelpHeading>
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
          onPick={(action, edits) => void applyTodoAction(todoPick, action, edits)}
          onSave={async (patch) => {
            // D-122: 저장이 된 뒤에만 닫는다 — 실패하면 고치던 칸이 그대로
            const ok = await journalMutate(() => updateJournalEntry(todoPick, patch), '고쳤습니다.')
            if (ok && typeof patch.dueDate === 'string') recordMove(todoPick.id, todoDay(todoPick), patch.dueDate || todoDay(todoPick))
            if (ok) setTodoPick(null)
            return ok
          }}
          onOpenClient={(cid) => navigate(`/ops/clients/${cid}`)}
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
          onDone={(updated, _link, created) => {
            setLinking(null)
            setEvents((list) => list.map((e) => (e.id === updated.id ? updated : e)))
            const cid = updated.operationsClientId
            // D-182: 새로 만들었으면 어디로 들어갔는지 말한다(대표 화면)
            const made = created && !pilot ? clientTypeOf(created) : null
            showToast(
              made ? `${created?.companyName} — ${CLIENT_TYPE_LABEL[made]}으로 등록하고 연결했습니다.` : '업체에 연결했습니다.',
              made === 'consultant'
                ? { label: '컨설턴트 고객 보기 →', onClick: () => navigate('/ops/clients?type=consultant') }
                : cid ? { label: '미팅 준비 →', onClick: () => navigate(`/sales/meeting?client=${cid}&round=1`) } : undefined,
            )
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
