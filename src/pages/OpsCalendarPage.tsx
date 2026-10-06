import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type LiHTMLAttributes } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, TriangleAlert } from 'lucide-react'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { useToast } from '../components/ui/toastContext'
import { listClients } from '../services/clientOpsService'
import {
  createJournalEntry,
  deleteJournalEntry,
  listJournal,
  postponedDue,
  todosOn,
  updateJournalEntry,
} from '../services/journalService'
import {
  SCHEDULE_KIND_CLASS,
  SCHEDULE_KIND_LABEL,
  buildAllSchedule,
  groupByDate,
  monthGrid,
  shiftMonth,
  type ScheduleEvent,
  type ScheduleKind,
} from '../services/clientOpsSchedule'
import { dueText } from '../services/clientOpsAlerts'
import { todayLocalDate } from '../lib/appClock'
import type { ClientOpsRecord } from '../types/clientOps'
import type { JournalEntry } from '../types/bridge'
import { TodoActionSheet, TodoComposer, TodoRow, type TodoAction } from '../components/journal/TodoBoard'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { ScheduleTabs } from '../components/journal/ScheduleTabs'
import { CalendarQuickSheet, HolidayImportSheet, type QuickTodoInput } from '../components/journal/CalendarQuickSheet'
import { addDaysOff, dateLabel, daysOffByDate, listDaysOff, missingPublicHolidays, monthWorkdays, prevWorkday, removeDayOff, type DayOff, type DayOffKind } from '../services/daysOff'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const KINDS: ScheduleKind[] = ['next', 'task', 'funding', 'payment', 'document', 'tool']

function CalendarContent({ workspaceId, userId }: { workspaceId: string | null; userId: string | null }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const today = todayLocalDate()
  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  /** 달력에는 마감만이 아니라 내가 적은 할 일도 함께 뜬다 */
  const [journal, setJournal] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [ym, setYm] = useState<[number, number]>(() => {
    const [y, m] = today.split('-')
    return [Number(y), Number(m)]
  })
  const [hidden, setHidden] = useState<Set<ScheduleKind>>(new Set())
  const [picked, setPicked] = useState<string | null>(today)
  /** 눌러서 연 할 일 */
  const [todoPick, setTodoPick] = useState<JournalEntry | null>(null)
  /** D-139: 쉬는 날(공휴일 · 대체공휴일 · 명절 · 휴무) — 못 읽어도 달력은 뜬다 */
  const [daysOff, setDaysOff] = useState<DayOff[]>([])
  /** D-139: 달력에서 바로 적기 창 */
  const [quick, setQuick] = useState<{ date: string; tab: 'todo' | 'off' } | null>(null)
  const [holidayImport, setHolidayImport] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [c, j] = await Promise.all([listClients(workspaceId), listJournal(workspaceId)])
      setRecords(c)
      setJournal(j)
      setLoadError('')
      setDaysOff(await listDaysOff(workspaceId).catch(() => [] as DayOff[]))
    } catch (cause) {
      // D-120: 못 읽으면 빈 달력 대신 알린다
      setLoadError(cause instanceof Error ? cause.message : '일정을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    void load()
  }, [load])

  const events = useMemo(
    () => buildAllSchedule(records, today).filter((e) => !hidden.has(e.kind)),
    [records, today, hidden],
  )
  const byDate = useMemo(() => groupByDate(events), [events])
  const days = useMemo(() => monthGrid(ym[0], ym[1]), [ym])
  const monthPrefix = `${ym[0]}-${String(ym[1]).padStart(2, '0')}`
  const pickedEvents = picked ? (byDate.get(picked) ?? []) : []
  const pickedTodos = useMemo(() => (picked ? todosOn(journal, picked) : []), [journal, picked])
  /** 날짜별 내가 적은 할 일 — 안 끝낸 것 먼저(todosOn 과 같은 순서). 휴대폰은 점, PC 는 칸 안에 글로 (D-156) */
  const todosByDate = useMemo(() => {
    const map = new Map<string, JournalEntry[]>()
    for (const e of journal) {
      if (e.entryType !== 'follow_up' || e.dueDate === '') continue
      const list = map.get(e.dueDate)
      if (list) list.push(e)
      else map.set(e.dueDate, [e])
    }
    for (const [d, list] of map) map.set(d, todosOn(list, d))
    return map
  }, [journal])
  const nameById = useMemo(() => new Map(records.map((r) => [r.id, r.companyName])), [records])
  const shortName = (n: string) => n.replace(/\(주\)|㈜|주식회사/g, '').trim()
  const clientNameOfId = (id: string | null | undefined) => (id ? (nameById.get(id) ?? '') : '')

  const offMap = useMemo(() => daysOffByDate(daysOff), [daysOff])
  const offSet = useMemo(() => new Set(daysOff.map((d) => d.date)), [daysOff])
  const workdays = useMemo(() => monthWorkdays(ym[0], ym[1], offSet), [ym, offSet])
  const missingHolidays = useMemo(() => missingPublicHolidays(ym[0], daysOff), [ym, daysOff])
  const pickedOff = picked ? (offMap.get(picked) ?? []) : []

  const activeClients = useMemo(
    () => records.filter((r) => r.archivedAt === null).map((r) => ({ id: r.id, companyName: r.companyName })),
    [records],
  )

  /** 저장 중에 또 누르면(할 일로 · 미루기) 두 번 들어가지 않게 — 한 번에 하나(D-122) */
  const busyRef = useRef(false)
  const mutate = async (fn: () => Promise<unknown>, done?: string): Promise<boolean> => {
    if (busyRef.current) {
      // D-125: 조용히 무시하지 않는다 — 적은 글은 칸에 그대로 있다
      showToast('앞의 저장이 끝나는 중입니다. 잠시 뒤 다시 눌러 주세요.')
      return false
    }
    busyRef.current = true
    try {
      await fn()
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
      return false
    } finally {
      busyRef.current = false
    }
    // 저장은 됐는데 다시 읽기만 실패했으면 '됐다'
    try {
      setJournal(await listJournal(workspaceId))
    } catch {
      showToast('저장했습니다. 목록을 다시 읽지 못했습니다 — 잠시 뒤 새로고침해 주세요.')
      return true
    }
    if (done) showToast(done)
    return true
  }

  /** D-150: 이번에 넣은 반복 할 일(실패 뒤 다시 누를 때 건너뛰려고) */
  const savedTodoKeys = useRef(new Set<string>())
  const clientNameOf = (id: string) => records.find((r) => r.id === id)?.companyName

  /** D-139: 빠른 적기 — 반복이면 날짜마다 한 줄 */
  const saveQuickTodos = (input: QuickTodoInput) =>
    mutate(
      async () => {
        // D-150: 반복 할 일을 넣다가 중간에 실패하면 다시 눌렀을 때 이미 들어간 날은 건너뛴다(예전에는 앞의 것이 두 번 들어갔다)
        for (const d of input.dates) {
          const key = `${input.clientId ?? ''}|${input.content}|${d}`
          if (savedTodoKeys.current.has(key)) continue
          await createJournalEntry(workspaceId, userId, { entryDate: today, entryType: 'follow_up', content: input.content, clientId: input.clientId, dueDate: d })
          savedTodoKeys.current.add(key)
        }
        savedTodoKeys.current.clear()
      },
      input.dates.length > 1 ? `할 일 ${input.dates.length}개를 넣었습니다 (${dateLabel(input.dates[0])}부터).` : `${dateLabel(input.dates[0])}에 할 일을 넣었습니다.`,
    )
  const reloadDaysOff = async () => setDaysOff(await listDaysOff(workspaceId))
  const saveDaysOff = async (items: { date: string; name: string; kind: DayOffKind }[]): Promise<boolean> => {
    try {
      const n = await addDaysOff(workspaceId, items, daysOff)
      await reloadDaysOff()
      showToast(n > 0 ? `쉬는 날 ${n}일을 표시했습니다.` : '이미 표시된 날입니다.')
      return true
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '표시하지 못했습니다.')
      return false
    }
  }
  const removeOff = async (d: DayOff): Promise<boolean> => {
    try {
      await removeDayOff(workspaceId, d.id)
      await reloadDaysOff()
      showToast(`${dateLabel(d.date)} '${d.name}' 표시를 지웠습니다.`)
      return true
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '지우지 못했습니다.')
      return false
    }
  }

  /** 할 일 시트에서 고른 것을 실행한다 */
  const applyTodoAction = (entry: JournalEntry, action: TodoAction) => {
    setTodoPick(null)
    if (action === 'delete') {
      void mutate(() => deleteJournalEntry(entry), '지웠습니다.')
      return
    }
    if (action === 'tomorrow') {
      void mutate(
        () => updateJournalEntry(entry, { dueDate: postponedDue(entry.dueDate, today), completed: false }),
        '내일로 미뤘습니다.',
      )
      return
    }
    void mutate(() => updateJournalEntry(entry, { completed: action === 'done' }))
  }

  /**
   * D-157: PC 에서 할 일을 끌어 다른 날짜 칸에 놓으면 그 날로 옮긴다(오른쪽 목록 · 칸 안의 할 일 줄).
   * 끝낸 할 일 · 같은 날은 그대로. 옮긴 날을 골라 목록이 따라가게 한다.
   */
  const TODO_DRAG = 'application/x-ax-todo'
  const [dropDay, setDropDay] = useState<string | null>(null)
  const dragTodo = (entry: JournalEntry) => ({
    draggable: !entry.completed,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(TODO_DRAG, entry.id)
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragEnd: () => setDropDay(null),
  })
  const moveTodo = (id: string, day: string) => {
    setDropDay(null)
    const entry = journal.find((x) => x.id === id)
    if (!entry || entry.dueDate === day || entry.completed) return
    void mutate(() => updateJournalEntry(entry, { dueDate: day }), `'${entry.content.slice(0, 20)}' — ${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일로 옮겼습니다.`).then((ok) => {
      if (ok) setPicked(day)
    })
  }

  const monthEvents = events.filter((e) => e.date.startsWith(monthPrefix))
  const monthOpen = monthEvents.filter((e) => !e.done)

  const toggleKind = (k: ScheduleKind) =>
    setHidden((s) => {
      const next = new Set(s)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="일정"
        description="모든 업체의 마감·신청·수금·서류 만료를 한 달력에서 봅니다."
        actions={
          <>
            <Button variant="secondary" onClick={() => { const [y,m]=today.split('-'); setYm([Number(y),Number(m)]); setPicked(today) }}>
              <CalendarDays aria-hidden="true" className="size-4" />
              오늘로
            </Button>
            {/* D-139: 어디서든 바로 적기 — 고른 날(없으면 오늘) */}
            <Button variant="primary" onClick={() => setQuick({ date: picked ?? today, tab: 'todo' })} data-testid="calendar-quick-open">
              <Plus aria-hidden="true" className="size-4" />
              적기
            </Button>
          </>
        }
      />
      <ScheduleTabs />

      {/* 월 이동 + 종류 필터 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* 휴대폰: 달 이동 줄과 건수를 나눈다. 한 줄에 넣으면 건수 칸이 40px 로 눌린다 */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="이전 달"
            onClick={() => setYm(shiftMonth(ym[0], ym[1], -1))}
            className="tap t-sub inline-flex items-center gap-0.5 rounded-(--radius-control) border border-slate-200 bg-white py-2 pr-2.5 pl-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            {/* D-127: 화살표만 두지 않는다 — 무엇을 하는지 글로 */}
            <ChevronLeft aria-hidden="true" className="size-4" />
            지난달
          </button>
          <span className="min-w-[6.5rem] text-center text-[1.2rem] font-bold text-slate-900">
            {ym[0]}년 {ym[1]}월
          </span>
          <button
            type="button"
            aria-label="다음 달"
            onClick={() => setYm(shiftMonth(ym[0], ym[1], 1))}
            className="tap t-sub inline-flex items-center gap-0.5 rounded-(--radius-control) border border-slate-200 bg-white py-2 pr-1.5 pl-2.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            다음 달
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
          <span className="w-full text-[0.9rem] text-slate-500 sm:ml-1 sm:w-auto" data-testid="calendar-month-summary">
            <span className="whitespace-nowrap">이 달 남은 일정 {monthOpen.length}건</span> · <span className="whitespace-nowrap">영업일 {workdays.workdays}일</span>
            {workdays.weekdayOffs > 0 && <span className="whitespace-nowrap text-danger-700"> · 평일 쉬는 날 {workdays.weekdayOffs}일</span>}
          </span>
          {/* D-139: 법정 공휴일은 자동으로 깔지 않는다 — 대표가 보고 넣는다 */}
          {missingHolidays.length > 0 && (
            <button type="button" onClick={() => setHolidayImport(true)} data-testid="holiday-import-open" className="tap t-sub rounded-full border border-danger-200 bg-danger-50 px-3 py-1 font-semibold text-danger-700 hover:bg-white">
              {ym[0]}년 공휴일 넣기 ({missingHolidays.length}일)
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => {
            const on = !hidden.has(k)
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => toggleKind(k)}
                className={`tap inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.875rem] font-medium ${
                  on ? SCHEDULE_KIND_CLASS[k].chip : 'border-slate-200 bg-white text-slate-400'
                }`}
              >
                <span aria-hidden="true" className={`size-2 rounded-full ${on ? SCHEDULE_KIND_CLASS[k].dot : 'bg-slate-300'}`} />
                {SCHEDULE_KIND_LABEL[k]}
              </button>
            )
          })}
        </div>
      </div>

      {loadError && (
        <p role="alert" className="flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-danger-200 bg-danger-50 px-4 py-3 text-[0.95rem] text-danger-700">
          일정을 불러오지 못했습니다 — {loadError}
          <button type="button" onClick={() => void load()} className="tap font-semibold underline">
            다시 불러오기
          </button>
        </p>
      )}
      {loading ? (
        <p className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-10 text-[0.95rem] text-slate-500">
          불러오는 중…
        </p>
      ) : (
        <>
          {/* D-156: PC 에서는 달력을 왼쪽에 줄여 두고 고른 날의 할 일을 오른쪽에 — 한눈에. 휴대폰은 위아래 그대로 */}
          <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(19rem,22rem)] xl:items-start">
          <div className="flex min-w-0 flex-col gap-5">
          {/* 달력 */}
          <div className="overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white" data-testid="month-calendar">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
              {WEEKDAYS.map((w, i) => (
                <div
                  key={w}
                  className={`py-2 text-center text-[0.88rem] font-semibold ${
                    i === 0 ? 'text-weekday-sun' : i === 6 ? 'text-weekday-sat' : 'text-slate-600'
                  }`}
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const inMonth = d.startsWith(monthPrefix)
                const list = byDate.get(d) ?? []
                const isToday = d === today
                const isPicked = d === picked
                const dow = new Date(`${d}T00:00:00Z`).getUTCDay()
                const off = offMap.get(d)
                const todos = todosByDate.get(d) ?? []
                // PC 칸: 할 일 → 업체 일정 순으로 3줄까지, 나머지는 +n건
                // D-157: 끝낸 것은 맨 뒤로 — 끝낸 할 일 셋이 열린 업체 일정을 '+n건' 으로 밀어내지 않게
                const lines = [
                  ...todos.map((t) => ({ key: t.id, kind: 'todo' as const, title: t.content, who: shortName(clientNameOfId(t.clientId)), done: t.completed, entry: t })),
                  ...list.map((e) => ({ key: e.id, kind: e.kind, title: e.title, who: shortName(e.clientName), done: e.done, entry: null as JournalEntry | null })),
                ].sort((a, b) => Number(a.done) - Number(b.done))
                return (
                  <button
                    key={d}
                    type="button"
                    data-date={d}
                    data-off={off ? 'true' : undefined}
                    title={off ? `${off.map((o) => o.name).join(' · ')} — 한 번 더 누르면 바로 적기` : '한 번 더 누르면 바로 적기'}
                    // D-139: 고른 날을 한 번 더 누르면(두 번 누르기) 바로 적는 창
                    onClick={() => (isPicked ? setQuick({ date: d, tab: 'todo' }) : setPicked(d))}
                    onDragOver={(e) => {
                      if (!e.dataTransfer.types.includes(TODO_DRAG)) return
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      if (dropDay !== d) setDropDay(d)
                    }}
                    onDragLeave={() => setDropDay((v) => (v === d ? null : v))}
                    onDrop={(e) => {
                      const id = e.dataTransfer.getData(TODO_DRAG)
                      if (!id) return
                      e.preventDefault()
                      moveTodo(id, d)
                    }}
                    data-drop={dropDay === d ? 'true' : undefined}
                    className={`flex min-h-[5.5rem] min-w-0 flex-col gap-1 border-r border-b lg:min-h-[6.75rem] lg:p-1 border-slate-100 p-1.5 text-left last:border-r-0 ${
                      inMonth ? 'bg-white' : 'bg-slate-50/60'
                    } ${off && !inMonth ? 'opacity-60' : ''} ${isPicked ? 'ring-2 ring-brand-400 ring-inset' : ''} ${dropDay === d ? 'bg-brand-100 ring-2 ring-brand-600 ring-inset' : ''} hover:bg-brand-50/40`}
                  >
                    <span
                      className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[0.875rem] font-semibold ${
                        isToday
                          ? 'bg-brand-600 text-white'
                          : !inMonth
                            ? 'text-slate-400'
                            : off || dow === 0
                              ? 'text-weekday-sun'
                              : dow === 6
                                ? 'text-weekday-sat'
                                : 'text-slate-700'
                      }`}
                    >
                      {Number(d.slice(8))}
                    </span>
                    {/* 쉬는 날은 일요일처럼 날짜 숫자만 빨갛게(D-139 대표: 빗금은 과하다). 좁은 화면은 이름이 잘려서 달력 아래 '이 달 쉬는 날' 에 */}
                    {off && (
                      <span className="t-meta hidden max-w-full truncate leading-tight font-semibold text-weekday-sun lg:block" data-testid="day-off-label">
                        {off[0].name}
                      </span>
                    )}
                    {/* 좁은 화면에서는 업체명이 '한..' 처럼 잘려 쓸모가 없다.
                        점만 찍고 내용은 아래 그날 목록에서 읽게 한다. */}
                    <span className="mt-0.5 flex flex-wrap gap-0.5 lg:hidden">
                      {/* 내가 적은 할 일은 브랜드색 점으로 — 마감(회사 일정)과 구분된다 */}
                      {Array.from({ length: Math.min(todos.length, 3) }, (_, i) => (
                        <span key={`t${i}`} aria-hidden="true" className="size-1.5 rounded-full bg-brand-500" />
                      ))}
                      {list.slice(0, 4).map((e) => (
                        <span
                          key={e.id}
                          aria-hidden="true"
                          className={`size-1.5 rounded-full ${e.done ? 'bg-slate-200' : SCHEDULE_KIND_CLASS[e.kind].dot}`}
                        />
                      ))}
                    </span>
                    {/* D-156: '할 일 4' 숫자 대신 무슨 일인지 — 윗줄 할 일(진하게), 아랫줄 업체(작게). 내가 적은 할 일은 진한 브랜드색, 업체 일정은 종류색 */}
                    <span className="hidden min-w-0 flex-col gap-0.5 lg:flex" data-testid="cell-lines">
                      {lines.slice(0, 3).map((l) => (
                        <span
                          key={l.key}
                          title={l.who ? `${l.who} · ${l.title}` : l.title}
                          data-kind={l.kind}
                          {...(l.entry ? dragTodo(l.entry) : {})}
                          className={`flex min-w-0 flex-col rounded border px-1 py-0.5 leading-tight ${
                            l.done
                              ? 'border-slate-100 bg-white text-slate-400 line-through'
                              : l.kind === 'todo'
                                ? 'border-brand-600 bg-brand-600 text-white'
                                : SCHEDULE_KIND_CLASS[l.kind].cell
                          }`}
                        >
                          {/* 두 줄까지 — 한 줄로 자르면 '대표님…' 처럼 무슨 일인지 안 보였다 */}
                          <span className="t-meta line-clamp-2 font-semibold [overflow-wrap:anywhere]">{l.title}</span>
                          {l.who && <span className="t-meta truncate opacity-80">{l.who}</span>}
                        </span>
                      ))}
                      {lines.length > 3 && <span className="t-meta px-1 font-semibold text-slate-600">+{lines.length - 3}건 더</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* D-139: 이 달 쉬는 날 — 누르면 그날로 */}
          {daysOff.some((d) => d.date.startsWith(monthPrefix)) && (
            <div className="flex flex-wrap items-center gap-1.5" data-testid="month-days-off">
              <span className="t-sub mr-1 font-semibold text-slate-700">이 달 쉬는 날</span>
              {daysOff
                .filter((d) => d.date.startsWith(monthPrefix))
                .map((d) => (
                  <button key={d.id} type="button" onClick={() => setPicked(d.date)} className="tap t-sub rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-weekday-sun hover:bg-slate-50">
                    {Number(d.date.slice(5, 7))}/{Number(d.date.slice(8))} {d.name}
                  </button>
                ))}
            </div>
          )}

          {/*
            선택한 날.
            위는 내가 적은 할 일(고칠 수 있는 것), 아래는 업체에서 자동으로 올라온
            마감(고칠 수 없는 것). 순서가 곧 "내가 뭘 할 수 있나" 다.
          */}
          </div>
          <section aria-label="선택한 날짜" className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto xl:rounded-(--radius-panel) xl:border xl:border-slate-200 xl:bg-slate-50/60 xl:p-4" data-testid="picked-panel">
            <div className="flex flex-col gap-2">
              <h2 className="text-[1.15rem] font-bold text-slate-900">
                {picked ? `${Number(picked.slice(5, 7))}월 ${Number(picked.slice(8))}일 할 일` : '날짜를 선택하세요'}
                {picked && pickedTodos.length > 0 && (
                  <span className="ml-2 text-[0.95rem] font-medium text-slate-500">{pickedTodos.length}건</span>
                )}
              </h2>
              {picked && (
                <>
                  {/* D-139: 쉬는 날 · 쉬는 날 마감 */}
                  {pickedOff.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-(--radius-control) border border-slate-200 bg-white px-4 py-2.5" data-testid="picked-day-off">
                      <span className="t-body font-bold text-weekday-sun">쉬는 날 · {pickedOff.map((o) => o.name).join(' · ')}</span>
                      <button type="button" onClick={() => setQuick({ date: picked, tab: 'off' })} className="tap t-sub ml-auto font-semibold text-slate-700 underline">
                        고치기 · 지우기
                      </button>
                    </div>
                  )}
                  {(pickedOff.length > 0 || [0, 6].includes(new Date(`${picked}T00:00:00Z`).getUTCDay())) && pickedEvents.some((e) => !e.done) && (
                    <p className="t-sub flex items-start gap-2 break-keep rounded-(--radius-control) border border-warning-200 bg-warning-50 px-4 py-2.5 text-warning-800" data-testid="picked-off-deadline">
                      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                      <span>
                        쉬는 날에 걸린 업체 마감이 {pickedEvents.filter((e) => !e.done).length}건 있습니다
                        {prevWorkday(picked, offSet) ? ` — 전 영업일 ${dateLabel(prevWorkday(picked, offSet) as string)}까지 챙기세요.` : '.'}
                      </span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" onClick={() => setQuick({ date: picked, tab: 'todo' })} data-testid="picked-quick-todo">
                      <Plus aria-hidden="true" className="size-4" />이 날에 적기 · 반복
                    </Button>
                    <Button variant="secondary" onClick={() => setQuick({ date: picked, tab: 'off' })} data-testid="picked-quick-off">
                      {pickedOff.length > 0 ? '쉬는 날 고치기' : '쉬는 날로 표시'}
                    </Button>
                  </div>
                  <TodoComposer
                    date={picked}
                    clients={activeClients}
                    onAdd={(draft) =>
                      mutate(
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
                    }
                  />
                  {pickedTodos.some((t) => !t.completed) && (
                    <p className="t-sub hidden break-keep text-slate-500 lg:block" data-testid="drag-hint">할 일을 끌어 왼쪽 달력의 다른 날짜에 놓으면 그 날로 옮겨져요.</p>
                  )}
                  {pickedTodos.length > 0 && (
                    <ul className="flex flex-col gap-2">
                      {pickedTodos.map((e) => (
                        <TodoRow
                          key={e.id}
                          entry={e}
                          today={today}
                          dragProps={{ ...dragTodo(e), 'data-todo-id': e.id } as LiHTMLAttributes<HTMLLIElement>}
                          clientName={
                            e.clientId ? records.find((r) => r.id === e.clientId)?.companyName : undefined
                          }
                          onPick={() => setTodoPick(e)}
                        />
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="text-[1.15rem] font-bold text-slate-900">
                업체 일정
                {picked && <span className="ml-2 text-[0.95rem] font-medium text-slate-500">{pickedEvents.length}건</span>}
              </h2>
              {pickedEvents.length === 0 ? (
                <p className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-6 text-[0.95rem] text-slate-500">
                  이 날에는 업체 쪽 마감이 없습니다.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {pickedEvents.map((e) => (
                    <EventRow
                      key={e.id}
                      event={e}
                      onOpen={() => navigate(`/ops/clients/${e.clientId}`)}
                      onTodo={() =>
                        void mutate(
                          () =>
                            createJournalEntry(workspaceId, userId, {
                              entryDate: today,
                              entryType: 'follow_up',
                              content: `${e.clientName} · ${e.title}`,
                              clientId: e.clientId,
                              dueDate: picked ?? today,
                            }),
                          '할 일로 옮겼습니다.',
                        )
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>
          </div>
        </>
      )}

      {quick && (
        <CalendarQuickSheet
          key={`${quick.date}-${quick.tab}`}
          date={quick.date}
          initialTab={quick.tab}
          clients={activeClients}
          daysOffOn={offMap.get(quick.date) ?? []}
          offDates={offSet}
          onSaveTodos={saveQuickTodos}
          onSaveDaysOff={saveDaysOff}
          onRemoveDayOff={removeOff}
          onClose={() => setQuick(null)}
        />
      )}
      {holidayImport && <HolidayImportSheet year={ym[0]} items={missingHolidays} onSave={saveDaysOff} onClose={() => setHolidayImport(false)} />}

      {todoPick && (
        <TodoActionSheet
          entry={todoPick}
          clientName={todoPick.clientId ? clientNameOf(todoPick.clientId) : undefined}
          clients={activeClients}
          onPick={(action) => applyTodoAction(todoPick, action)}
          onSave={async (patch) => {
            // D-122: 저장이 된 뒤에만 닫는다 — 실패하면 고치던 칸이 그대로
            const ok = await mutate(() => updateJournalEntry(todoPick, patch), '고쳤습니다.')
            if (ok) setTodoPick(null)
            return ok
          }}
          onOpenClient={
            todoPick.clientId ? () => navigate(`/ops/clients/${todoPick.clientId}`) : undefined
          }
          onClose={() => setTodoPick(null)}
        />
      )}
    </div>
  )
}

export function EventRow({
  event,
  onOpen,
  onTodo,
}: {
  event: ScheduleEvent
  onOpen: () => void
  /** 이 마감을 내 할 일로 옮긴다 (없으면 단추를 두지 않는다) */
  onTodo?: () => void
}) {
  const cls = SCHEDULE_KIND_CLASS[event.kind]
  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full items-start gap-3 rounded-(--radius-card) border border-l-4 bg-white px-4 py-3 text-left hover:bg-slate-50 ${cls.bar} ${
          event.done ? 'border-slate-200 opacity-60' : 'border-slate-200'
        }`}
      >
        <span aria-hidden="true" className={`mt-1.5 size-2.5 shrink-0 rounded-full ${cls.dot}`} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[1.02rem] font-bold break-keep text-slate-900">{event.clientName}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[0.875rem] font-medium ${cls.chip}`}>
              {SCHEDULE_KIND_LABEL[event.kind]}
            </span>
            {event.done && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.875rem] text-slate-500">
                처리됨
              </span>
            )}
          </span>
          <span className={`mt-0.5 block text-[1rem] break-keep ${event.done ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
            {event.title}
          </span>
          {event.detail && <span className="block text-[0.9rem] break-keep text-slate-500">{event.detail}</span>}
        </span>
        {!event.done && event.daysLeft !== null && (
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.875rem] font-semibold whitespace-nowrap ${
              event.daysLeft < 0
                ? 'border-danger-200 bg-danger-50 text-danger-700'
                : event.daysLeft <= 7
                  ? 'border-warning-200 bg-warning-50 text-warning-800'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
          >
            {dueText(event.daysLeft)}
          </span>
        )}
      </button>
      {/* D-122: 카드 모서리에 떠 있던 '+' 는 남은 날 배지를 가렸고 뜻도 몰랐다 — 카드 아래 글자 단추로 */}
      {onTodo && (
        <button
          type="button"
          aria-label={`${event.clientName} ${event.title} — 할 일로 넣기`}
          onClick={onTodo}
          className="tap t-sub -mt-px inline-flex items-center gap-1 self-end rounded-b-(--radius-control) border border-t-0 border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-brand-700 hover:bg-brand-50"
        >
          <Plus aria-hidden="true" className="size-4" />
          할 일로 넣기
        </button>
      )}
    </li>
  )
}

/**
 * 일기(할 일)를 함께 쓰므로 워크스페이스와 사용자 id 가 둘 다 필요하다.
 * 다른 화면과 같은 WorkspaceScope 를 쓴다.
 */
export function OpsCalendarPage() {
  return <WorkspaceScope>{(ctx) => <CalendarContent workspaceId={ctx.workspaceId} userId={ctx.userId} />}</WorkspaceScope>
}
