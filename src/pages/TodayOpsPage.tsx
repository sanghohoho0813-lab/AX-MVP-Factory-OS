import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Sun } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { getDataModeConfig } from '../data/dataMode'
import { listClients } from '../services/clientOpsService'
import {
  buildAllSchedule,
  overdueEvents,
  upcomingWithin,
  type ScheduleEvent,
} from '../services/clientOpsSchedule'
import { buildAllAlerts, summarizeAlerts } from '../services/clientOpsAlerts'
import { todayLocalDate } from '../lib/appClock'
import type { ClientOpsRecord } from '../types/clientOps'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { StatTile } from '../components/ops/opsParts'
import { EventRow } from './OpsCalendarPage'

function Group({
  title,
  hint,
  events,
  onOpen,
  tone,
}: {
  title: string
  hint: string
  events: ScheduleEvent[]
  onOpen: (e: ScheduleEvent) => void
  tone: 'danger' | 'warning' | 'neutral'
}) {
  if (events.length === 0) return null
  const bar = tone === 'danger' ? 'bg-danger-500' : tone === 'warning' ? 'bg-warning-500' : 'bg-slate-300'
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className={`h-4 w-1 rounded-full ${bar}`} />
        <h2 className="text-[1.15rem] font-bold text-slate-900">
          {title} <span className="text-slate-400">{events.length}</span>
        </h2>
        <span className="text-[0.9rem] text-slate-500">{hint}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {events.map((e) => (
          <EventRow key={e.id} event={e} onOpen={() => onOpen(e)} />
        ))}
      </ul>
    </section>
  )
}

function TodayContent({ workspaceId }: { workspaceId: string | null }) {
  const navigate = useNavigate()
  const today = todayLocalDate()
  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setRecords(await listClients(workspaceId))
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    void load()
  }, [load])

  const events = useMemo(() => buildAllSchedule(records, today), [records, today])
  const alerts = useMemo(() => buildAllAlerts(records, today), [records, today])
  const summary = useMemo(() => summarizeAlerts(alerts), [alerts])

  const past = overdueEvents(events)
  const dueToday = events.filter((e) => !e.done && e.daysLeft === 0)
  const thisWeek = upcomingWithin(events, 7).filter((e) => e.daysLeft !== 0)
  const openClients = records.filter((r) => r.archivedAt === null && r.status !== 'completed').length

  const go = (e: ScheduleEvent) => navigate(`/ops/clients/${e.clientId}`)
  const nothing = past.length === 0 && dueToday.length === 0 && thisWeek.length === 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="오늘 할 일"
        description={`${today} · 마감이 지난 일과 이번 주에 끝내야 할 일만 모았습니다.`}
        actions={
          <Button variant="secondary" onClick={() => navigate('/ops/calendar')}>
            <CalendarDays aria-hidden="true" className="size-4" />
            달력으로 보기
          </Button>
        }
      />

      <section aria-label="요약" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="마감 지난 일"
          value={`${past.length}건`}
          tone={past.length > 0 ? 'danger' : 'success'}
          icon={AlertTriangle}
        />
        <StatTile label="오늘까지" value={`${dueToday.length}건`} tone={dueToday.length > 0 ? 'warning' : 'neutral'} icon={Sun} />
        <StatTile label="이번 주" value={`${thisWeek.length}건`} icon={ClipboardList} />
        <StatTile label="관리 중인 업체" value={`${openClients}곳`} hint={`경고 ${summary.total}건`} icon={CheckCircle2} />
      </section>

      {loading ? (
        <p className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-10 text-[0.95rem] text-slate-500">
          불러오는 중…
        </p>
      ) : nothing ? (
        <div className="rounded-(--radius-panel) border border-success-200 bg-success-50/60 px-5 py-12 text-center">
          <CheckCircle2 aria-hidden="true" className="mx-auto size-9 text-success-600" />
          <p className="mt-3 text-[1.2rem] font-bold text-slate-900">이번 주에 급한 일이 없습니다</p>
          <p className="mt-1 text-[1rem] break-keep text-slate-600">
            마감이 지난 일도, 이번 주 안에 끝내야 할 일도 없습니다.
          </p>
          <Button variant="secondary" className="mt-5" onClick={() => navigate('/ops/clients')}>
            전체 현황 보기
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <Group title="마감이 지났습니다" hint="가장 먼저 처리하세요" events={past} onOpen={go} tone="danger" />
          <Group title="오늘까지" hint="오늘 안에 끝내야 합니다" events={dueToday} onOpen={go} tone="warning" />
          <Group title="이번 주" hint="7일 이내" events={thisWeek} onOpen={go} tone="neutral" />
        </div>
      )}
    </div>
  )
}

function CloudToday() {
  const { currentWorkspaceId } = useAuth()
  return <TodayContent workspaceId={currentWorkspaceId} />
}

export function TodayOpsPage() {
  return getDataModeConfig().mode === 'supabase' ? <CloudToday /> : <TodayContent workspaceId={null} />
}
