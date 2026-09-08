import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { useToast } from '../components/ui/toastContext'
import { listClients } from '../services/clientOpsService'
import {
  createJournalEntry,
  deleteJournalEntry,
  listJournal,
  shiftDate,
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

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const KINDS: ScheduleKind[] = ['task', 'funding', 'payment', 'document']

function CalendarContent({ workspaceId, userId }: { workspaceId: string | null; userId: string | null }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const today = todayLocalDate()
  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  /** 달력에는 마감만이 아니라 내가 적은 할 일도 함께 뜬다 */
  const [journal, setJournal] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [ym, setYm] = useState<[number, number]>(() => {
    const [y, m] = today.split('-')
    return [Number(y), Number(m)]
  })
  const [hidden, setHidden] = useState<Set<ScheduleKind>>(new Set())
  const [picked, setPicked] = useState<string | null>(today)
  /** 눌러서 연 할 일 */
  const [todoPick, setTodoPick] = useState<JournalEntry | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [c, j] = await Promise.all([listClients(workspaceId), listJournal(workspaceId)])
      setRecords(c)
      setJournal(j)
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
  /** 달력 칸에 점을 찍기 위한 날짜별 할 일 개수 */
  const todoCountByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of journal) {
      if (e.entryType !== 'follow_up' || e.dueDate === '') continue
      map.set(e.dueDate, (map.get(e.dueDate) ?? 0) + 1)
    }
    return map
  }, [journal])

  const activeClients = useMemo(
    () => records.filter((r) => r.archivedAt === null).map((r) => ({ id: r.id, companyName: r.companyName })),
    [records],
  )

  const mutate = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn()
      setJournal(await listJournal(workspaceId))
      if (done) showToast(done)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
    }
  }

  const clientNameOf = (id: string) => records.find((r) => r.id === id)?.companyName

  /** 할 일 시트에서 고른 것을 실행한다 */
  const applyTodoAction = (entry: JournalEntry, action: TodoAction) => {
    setTodoPick(null)
    if (action === 'delete') {
      void mutate(() => deleteJournalEntry(entry), '지웠습니다.')
      return
    }
    if (action === 'tomorrow') {
      void mutate(
        () => updateJournalEntry(entry, { dueDate: shiftDate(today, 1), completed: false }),
        '내일로 미뤘습니다.',
      )
      return
    }
    void mutate(() => updateJournalEntry(entry, { completed: action === 'done' }))
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
          <Button variant="secondary" onClick={() => { const [y,m]=today.split('-'); setYm([Number(y),Number(m)]); setPicked(today) }}>
            <CalendarDays aria-hidden="true" className="size-4" />
            오늘로
          </Button>
        }
      />

      {/* 월 이동 + 종류 필터 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* 휴대폰: 달 이동 줄과 건수를 나눈다. 한 줄에 넣으면 건수 칸이 40px 로 눌린다 */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="이전 달"
            onClick={() => setYm(shiftMonth(ym[0], ym[1], -1))}
            className="tap rounded-(--radius-control) border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <span className="min-w-[7.5rem] text-center text-[1.2rem] font-bold text-slate-900">
            {ym[0]}년 {ym[1]}월
          </span>
          <button
            type="button"
            aria-label="다음 달"
            onClick={() => setYm(shiftMonth(ym[0], ym[1], 1))}
            className="tap rounded-(--radius-control) border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
          <span className="w-full text-[0.9rem] whitespace-nowrap text-slate-500 sm:ml-1 sm:w-auto">
            이 달 남은 일정 {monthOpen.length}건
          </span>
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
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.85rem] font-medium ${
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

      {loading ? (
        <p className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-10 text-[0.95rem] text-slate-500">
          불러오는 중…
        </p>
      ) : (
        <>
          {/* 달력 */}
          <div className="overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white">
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
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPicked(d)}
                    className={`flex min-h-[5.5rem] flex-col gap-1 border-r border-b border-slate-100 p-1.5 text-left last:border-r-0 ${
                      inMonth ? 'bg-white' : 'bg-slate-50/60'
                    } ${isPicked ? 'ring-2 ring-brand-400 ring-inset' : ''} hover:bg-brand-50/40`}
                  >
                    <span
                      className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[0.85rem] font-semibold ${
                        isToday
                          ? 'bg-brand-600 text-white'
                          : !inMonth
                            ? 'text-slate-300'
                            : dow === 0
                              ? 'text-weekday-sun'
                              : dow === 6
                                ? 'text-weekday-sat'
                                : 'text-slate-700'
                      }`}
                    >
                      {Number(d.slice(8))}
                    </span>
                    {/* 좁은 화면에서는 업체명이 '한..' 처럼 잘려 쓸모가 없다.
                        점만 찍고 내용은 아래 그날 목록에서 읽게 한다. */}
                    <span className="mt-0.5 flex flex-wrap gap-0.5 lg:hidden">
                      {/* 내가 적은 할 일은 브랜드색 점으로 — 마감(회사 일정)과 구분된다 */}
                      {Array.from({ length: Math.min(todoCountByDate.get(d) ?? 0, 3) }, (_, i) => (
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
                    <span className="hidden flex-col gap-0.5 lg:flex">
                      {(todoCountByDate.get(d) ?? 0) > 0 && (
                        <span className="t-meta flex items-center gap-1 truncate rounded border border-brand-200 bg-brand-50/60 px-1 py-0.5 text-brand-700">
                          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-brand-500" />
                          <span className="truncate">할 일 {todoCountByDate.get(d)}</span>
                        </span>
                      )}
                      {list.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className={`t-meta flex items-center gap-1 truncate rounded border px-1 py-0.5 ${
                            e.done ? 'border-slate-100 text-slate-300 line-through' : SCHEDULE_KIND_CLASS[e.kind].chip
                          }`}
                        >
                          <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${SCHEDULE_KIND_CLASS[e.kind].dot}`} />
                          <span className="truncate">{e.clientName}</span>
                        </span>
                      ))}
                      {list.length > 3 && (
                        <span className="t-meta px-1 text-slate-500">+{list.length - 3}건</span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/*
            선택한 날.
            위는 내가 적은 할 일(고칠 수 있는 것), 아래는 업체에서 자동으로 올라온
            마감(고칠 수 없는 것). 순서가 곧 "내가 뭘 할 수 있나" 다.
          */}
          <section aria-label="선택한 날짜" className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-[1.15rem] font-bold text-slate-900">
                {picked ? `${Number(picked.slice(5, 7))}월 ${Number(picked.slice(8))}일 할 일` : '날짜를 선택하세요'}
                {picked && pickedTodos.length > 0 && (
                  <span className="ml-2 text-[0.95rem] font-medium text-slate-500">{pickedTodos.length}건</span>
                )}
              </h2>
              {picked && (
                <>
                  <TodoComposer
                    date={picked}
                    clients={activeClients}
                    onAdd={(draft) =>
                      void mutate(
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
                  {pickedTodos.length > 0 && (
                    <ul className="flex flex-col gap-2">
                      {pickedTodos.map((e) => (
                        <TodoRow
                          key={e.id}
                          entry={e}
                          today={today}
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
        </>
      )}

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
    <li className="relative">
      {onTodo && (
        <button
          type="button"
          aria-label={`${event.clientName} ${event.title} — 할 일로 넣기`}
          title="할 일로 넣기"
          onClick={onTodo}
          className="tap absolute top-2 right-2 z-10 rounded-(--radius-control) border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-brand-300 hover:text-brand-700"
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full items-start gap-3 rounded-(--radius-card) border bg-white px-4 py-3 text-left hover:bg-slate-50 ${
          event.done ? 'border-slate-200 opacity-60' : 'border-slate-200'
        }`}
      >
        <span aria-hidden="true" className={`mt-1.5 size-2.5 shrink-0 rounded-full ${cls.dot}`} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[1.02rem] font-bold break-keep text-slate-900">{event.clientName}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[0.8rem] font-medium ${cls.chip}`}>
              {SCHEDULE_KIND_LABEL[event.kind]}
            </span>
            {event.done && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.8rem] text-slate-500">
                처리됨
              </span>
            )}
          </span>
          <span className={`mt-0.5 block text-[1rem] break-keep ${event.done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
            {event.title}
          </span>
          {event.detail && <span className="block text-[0.9rem] break-keep text-slate-500">{event.detail}</span>}
        </span>
        {!event.done && event.daysLeft !== null && (
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.85rem] font-semibold whitespace-nowrap ${
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
