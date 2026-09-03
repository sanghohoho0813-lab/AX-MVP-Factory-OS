import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Clock,
  Copy,
  Inbox,
  Landmark,
  Moon,
  NotebookPen,
  Wallet,
} from 'lucide-react'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/toastContext'
import { QuickCapture } from '../components/journal/QuickCapture'
import { JournalList } from '../components/journal/JournalList'
import { EventCard } from '../components/ops/EventCard'
import { LinkCustomerModal } from '../components/ops/LinkCustomerModal'
import { ScreenGuide } from '../components/onboarding/ScreenGuide'
import { listClients } from '../services/clientOpsService'
import { buildAllAlerts, summarizeAlerts, dueText } from '../services/clientOpsAlerts'
import { buildAllSchedule, upcomingWithin } from '../services/clientOpsSchedule'
import {
  applyJournalFilter,
  createJournalEntry,
  deleteJournalEntry,
  listJournal,
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
import { formatKrw } from '../lib/format'
import { getDataModeConfig } from '../data/dataMode'
import { brand } from '../brand/brand.config'
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

function StatChip({
  label,
  value,
  tone,
  icon: Icon,
  to,
}: {
  label: string
  value: string
  tone: 'danger' | 'warning' | 'neutral' | 'success'
  icon: typeof Clock
  to: string
}) {
  const cls =
    tone === 'danger'
      ? 'border-danger-200 bg-danger-50/70'
      : tone === 'warning'
        ? 'border-warning-200 bg-warning-50/70'
        : tone === 'success'
          ? 'border-success-200 bg-success-50/60'
          : 'border-slate-200 bg-white'
  return (
    <Link to={to} className={`flex min-w-0 flex-col rounded-(--radius-card) border px-3.5 py-3 transition-shadow hover:shadow-(--shadow-card) ${cls}`}>
      <span className="flex items-center justify-between gap-2 text-[0.85rem] font-medium text-slate-600">
        <span className="truncate">{label}</span>
        <Icon aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
      </span>
      <strong className="mt-1 truncate text-[1.45rem] leading-tight font-bold text-slate-900">{value}</strong>
    </Link>
  )
}

function ActionRow({ action, rank }: { action: BriefAction; rank: number }) {
  const bar = action.severity === 'critical' ? 'bg-danger-500' : action.severity === 'warning' ? 'bg-warning-500' : 'bg-slate-300'
  return (
    <li>
      <Link
        to={action.href}
        className="flex gap-3 rounded-(--radius-card) border border-slate-200 bg-white p-3.5 shadow-(--shadow-card) transition-colors hover:border-brand-300"
      >
        <span className="flex flex-col items-center gap-1">
          <span className="flex size-7 items-center justify-center rounded-full bg-slate-900 text-[0.85rem] font-bold text-white">{rank}</span>
          <span aria-hidden="true" className={`w-1 flex-1 rounded-full ${bar}`} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[1rem] font-semibold break-keep text-slate-900">{action.title}</span>
          {action.detail && <span className="block text-[0.9rem] break-keep text-slate-600">{action.detail}</span>}
          <span className="mt-1 block text-[0.85rem] text-slate-500">
            {action.clientName && <span className="font-medium text-slate-700">{action.clientName} · </span>}
            이유: {action.reason}
          </span>
        </span>
        <ArrowRight aria-hidden="true" className="size-4 shrink-0 self-center text-slate-400" />
      </Link>
    </li>
  )
}

function SectionTitle({ title, to, count, icon: Icon }: { title: string; to?: string; count?: number; icon: typeof Clock }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-[1.15rem] font-bold text-slate-900">
        <Icon aria-hidden="true" className="size-5 text-slate-400" />
        {title}
        {typeof count === 'number' && <span className="text-[0.95rem] font-semibold text-slate-400">{count}</span>}
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
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [linking, setLinking] = useState<{ event: CustomerEvent; tab: 'existing' | 'new' } | null>(null)

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

  const active = useMemo(() => clients.filter((c) => c.archivedAt === null && c.status !== 'completed'), [clients])
  const clientNames = useMemo(() => new Map(clients.map((c) => [c.id, c.companyName])), [clients])
  const alerts = useMemo(() => buildAllAlerts(clients, today), [clients, today])
  const summary = useMemo(() => summarizeAlerts(alerts), [alerts])
  const schedule = useMemo(() => buildAllSchedule(clients, today), [clients, today])
  const weekDue = useMemo(() => upcomingWithin(schedule, 7).filter((e) => !e.done), [schedule])
  const waiting = useMemo(
    () => alerts.filter((a) => a.kind === 'waiting_too_long').length + active.filter((c) => c.status === 'waiting').length,
    [alerts, active],
  )
  const money = useMemo(() => buildMoneySignals(clients, today), [clients, today])
  const funding = useMemo(() => buildFundingDeadlines(clients, today), [clients, today])
  const openEvents = useMemo(() => events.filter(isOpenEvent), [events])
  const followUps = useMemo(() => journal.filter((j) => j.entryType === 'follow_up' && !j.completed), [journal])
  const dueToday = useMemo(() => followUps.filter((f) => f.dueDate && f.dueDate <= today), [followUps, today])
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

  const mustToday = summary.critical + dueToday.length + openEvents.filter((e) => e.priority === 'high').length

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
      <section aria-label="오늘" data-tour="home-today" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.95rem] font-medium text-slate-500">
              <time dateTime={now.toISOString()}>{timeText}</time>
            </p>
            <h1 className="mt-0.5 text-[1.75rem] leading-tight font-bold break-keep text-slate-900 lg:text-[2rem]">
              {greeting(now.getHours())}. {loading ? '오늘 할 일을 정리하는 중…' : mustToday > 0 ? `오늘 반드시 처리할 것이 ${mustToday}건 있습니다.` : '오늘 급한 일은 없습니다.'}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <ScreenGuide screenKey="home" />
            <Button variant="secondary" onClick={() => navigate('/ops/clients')}>
              <Building2 aria-hidden="true" className="size-4" /> 고객 운영
            </Button>
            <Button variant="primary" onClick={() => setSummaryOpen(true)}>
              <Moon aria-hidden="true" className="size-4" /> 오늘 정리하기
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
          <StatChip label="오늘 반드시 처리" value={`${mustToday}건`} tone={mustToday > 0 ? 'danger' : 'success'} icon={AlertTriangle} to="/ops/clients" />
          <StatChip label="이번 주 마감" value={`${weekDue.length}건`} tone={weekDue.length > 0 ? 'warning' : 'neutral'} icon={CalendarDays} to="/ops/calendar" />
          <StatChip label="고객에게 기다리는 것" value={`${waiting}건`} tone={waiting > 0 ? 'warning' : 'neutral'} icon={Clock} to="/ops/clients" />
          <StatChip
            label="받아야 할 돈"
            value={formatKrw(money.scheduled.total + money.overdue.total)}
            tone={money.overdue.count > 0 ? 'danger' : 'neutral'}
            icon={Wallet}
            to="/ops/clients"
          />
          <StatChip label="새 고객 이벤트" value={`${openEvents.length}건`} tone={openEvents.some((e) => e.priority === 'high') ? 'danger' : openEvents.length > 0 ? 'warning' : 'neutral'} icon={Inbox} to="/ops/inbox" />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* B. Top 3 */}
        <section aria-labelledby="top3" data-tour="home-top3" className="flex flex-col gap-3">
          <SectionTitle title="지금 이것부터" icon={ClipboardCheck} />
          {loading ? (
            <p className="text-[0.95rem] text-slate-500">불러오는 중…</p>
          ) : top.length === 0 ? (
            <div className="rounded-(--radius-card) border border-dashed border-slate-300 bg-white p-5 text-[0.95rem] text-slate-500">
              마감 지남·막힘·새 주문·오늘 후속조치가 없습니다. 이번 주 마감과 고객 대기 건을 미리 챙겨 두세요.
            </div>
          ) : (
            <ol className="flex flex-col gap-2">
              {top.map((a, i) => (
                <ActionRow key={a.id} action={a} rank={i + 1} />
              ))}
            </ol>
          )}
          <p className="text-[0.82rem] text-slate-400">
            순서 규칙: 마감 지남·막힘 → 결제된 주문 → 지난 후속조치 → 고객 서류·요청 → 임박 마감. 규칙 기반이며 AI 판단이 아닙니다.
          </p>
        </section>

        {/* C. 빠른 기록 + H. 오늘 기록 */}
        <section aria-labelledby="capture" data-tour="home-capture" className="flex flex-col gap-3">
          <SectionTitle title="무슨 일이 있었나요?" icon={NotebookPen} to="/journal" count={todayJournal.length} />
          <QuickCapture
            clients={active}
            compact
            onCreate={(input) => journalMutate(() => createJournalEntry(workspaceId, userId, input), '기록했습니다.')}
          />
          <JournalList
            entries={todayJournal.slice(0, 6)}
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
          {todayJournal.length > 6 && (
            <Link to="/journal" className="text-[0.9rem] font-medium text-brand-700 hover:underline">
              오늘 기록 {todayJournal.length}건 모두 보기
            </Link>
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* D. 고객 이벤트 */}
        <section aria-labelledby="events" data-tour="home-events" className="flex flex-col gap-3">
          <SectionTitle title="고객 이벤트" icon={Inbox} to="/ops/inbox" count={openEvents.length} />
          {openEvents.length === 0 ? (
            <div className="rounded-(--radius-card) border border-dashed border-slate-300 bg-white p-5 text-[0.92rem] break-keep text-slate-500">
              새 고객 요청이 없습니다. {brand.customerPlatformLabel}에서 진단·주문·서류·요청이 생기면 여기에 나타납니다.
              {isLocal && (
                <>
                  {' '}
                  <Link to="/ops/inbox" className="font-medium text-brand-700 hover:underline">이벤트함에서 샘플 만들기</Link>
                </>
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {openEvents.slice(0, 4).map((e) => (
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

        {/* E. 챙길 업체 */}
        <section aria-labelledby="attention" className="flex flex-col gap-3">
          <SectionTitle title="챙겨야 할 업체" icon={Building2} to="/ops/clients" count={attention.length} />
          {attention.length === 0 ? (
            <div className="rounded-(--radius-card) border border-dashed border-slate-300 bg-white p-5 text-[0.92rem] text-slate-500">
              {active.length === 0 ? (
                <>
                  아직 등록된 업체가 없습니다.{' '}
                  <Link to="/ops/clients" className="font-medium text-brand-700 hover:underline">첫 업체 등록</Link>
                </>
              ) : (
                '경고가 있는 업체가 없습니다.'
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-(--radius-card) border border-slate-200 bg-white">
              {attention.map(({ record, critical, warning, first }) => (
                <li key={record.id}>
                  <Link to={`/ops/clients/${record.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.98rem] font-semibold text-slate-900">{record.companyName}</span>
                      <span className="block truncate text-[0.88rem] text-slate-500">{first}</span>
                    </span>
                    {critical > 0 && <span className="rounded-full bg-danger-50 px-2 py-0.5 text-[0.82rem] font-semibold text-danger-700">급함 {critical}</span>}
                    {warning > 0 && <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[0.82rem] font-semibold text-warning-700">임박 {warning}</span>}
                    <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* F. 돈 */}
        <section aria-labelledby="money" className="flex flex-col gap-3">
          <SectionTitle title="돈" icon={Wallet} />
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-(--radius-card) border border-slate-200 bg-white p-3">
              <p className="text-[0.85rem] text-slate-500">예정 수금</p>
              <p className="text-[1.15rem] font-bold text-slate-900">{formatKrw(money.scheduled.total)}</p>
              <p className="text-[0.82rem] text-slate-400">{money.scheduled.count}건</p>
            </div>
            <div className={`rounded-(--radius-card) border p-3 ${money.overdue.count > 0 ? 'border-danger-200 bg-danger-50/60' : 'border-slate-200 bg-white'}`}>
              <p className="text-[0.85rem] text-slate-500">연체</p>
              <p className={`text-[1.15rem] font-bold ${money.overdue.count > 0 ? 'text-danger-700' : 'text-slate-900'}`}>{formatKrw(money.overdue.total)}</p>
              <p className="text-[0.82rem] text-slate-400">{money.overdue.count}건</p>
            </div>
            <div className="rounded-(--radius-card) border border-slate-200 bg-white p-3">
              <p className="text-[0.85rem] text-slate-500">금액 미정</p>
              <p className="text-[1.15rem] font-bold text-slate-900">{money.unknownAmount}건</p>
              <p className="text-[0.82rem] text-slate-400">합산 제외</p>
            </div>
          </div>
          {money.overdue.items.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-(--radius-card) border border-danger-200 bg-white">
              {money.overdue.items.slice(0, 4).map((m) => (
                <li key={`${m.clientId}-${m.label}-${m.dueDate}`}>
                  <Link to={`/ops/clients/${m.clientId}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-[0.92rem] hover:bg-slate-50">
                    <span className="min-w-0 truncate"><span className="font-semibold text-slate-800">{m.clientName}</span> · {m.label}</span>
                    <span className="shrink-0 font-semibold text-danger-700">{formatKrw(m.amount)} · {m.dueDate}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[0.82rem] text-slate-400">금액이 입력된 항목만 합산합니다.</p>
        </section>

        {/* G. 자금 마감 */}
        <section aria-labelledby="funding" className="flex flex-col gap-3">
          <SectionTitle title="지원사업 마감" icon={Landmark} to="/funding" count={funding.length} />
          {funding.length === 0 ? (
            <div className="rounded-(--radius-card) border border-dashed border-slate-300 bg-white p-5 text-[0.92rem] text-slate-500">
              14일 안에 마감되는 신청 건이 없습니다.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-(--radius-card) border border-slate-200 bg-white">
              {funding.slice(0, 5).map((f) => (
                <li key={`${f.clientId}-${f.programName}-${f.applyDueDate}`}>
                  <Link to={`/ops/clients/${f.clientId}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.95rem] font-semibold text-slate-800">{f.programName}</span>
                      <span className="block truncate text-[0.85rem] text-slate-500">{f.clientName}{f.institution ? ` · ${f.institution}` : ''}</span>
                    </span>
                    <span className={`shrink-0 text-[0.88rem] font-semibold ${f.daysLeft < 0 ? 'text-danger-700' : f.daysLeft <= 3 ? 'text-warning-700' : 'text-slate-600'}`}>
                      {dueText(f.daysLeft)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

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
            ['중요한 결정', daySummary.decisions, 'text-cat-plan-700'],
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
