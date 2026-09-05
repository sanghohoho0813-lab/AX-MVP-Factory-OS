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
  Moon,
  NotebookPen,
  Wallet,
} from 'lucide-react'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { Badge, Blank, Disclosure, ListRow, ListSurface, MetricTile } from '../components/ui/primitives'
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
import { formatKrw, krwTile } from '../lib/format'
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

function ActionRow({ action, rank }: { action: BriefAction; rank: number }) {
  const edge =
    action.severity === 'critical' ? 'bg-danger-500' : action.severity === 'warning' ? 'bg-warning-500' : 'bg-slate-300'
  return (
    <li>
      <Link
        to={action.href}
        className="ax-lift relative flex items-start gap-3 overflow-hidden rounded-(--radius-card) border border-slate-200 bg-white py-3.5 pr-3 pl-4"
      >
        <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] ${edge}`} />
        <span className="t-meta mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-900 font-bold text-white">
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
      {/* 1단계 — 오늘이 어떤 날인지 한 문장 */}
      <section aria-label="오늘" data-tour="home-today" className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="t-sub font-medium text-slate-500">
              <time dateTime={now.toISOString()}>{timeText}</time> · {greeting(now.getHours())}
            </p>
            <h1 className="t-page mt-0.5 break-keep text-slate-900">
              {loading ? '오늘 할 일을 정리하는 중…' : mustToday > 0 ? `반드시 처리할 것 ${mustToday}건` : '오늘 급한 일 없음'}
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* 2단계 — 지금 이것부터 (최대 3건) */}
        <section aria-labelledby="top3" data-tour="home-top3" className="flex min-w-0 flex-col gap-3">
          <SectionTitle title="지금 이것부터" icon={ClipboardCheck} />
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
          <SectionTitle title="무슨 일이 있었나요?" icon={NotebookPen} to="/journal" count={todayJournal.length} />
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
          <SectionTitle title="고객 이벤트" icon={Inbox} to="/ops/inbox" count={openEvents.length} />
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
          <SectionTitle title="챙겨야 할 업체" icon={Building2} to="/ops/clients" count={attention.length} />
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
          <SectionTitle title="돈" icon={Wallet} />
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
          <SectionTitle title="지원사업 마감" icon={Landmark} to="/funding" count={funding.length} />
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
