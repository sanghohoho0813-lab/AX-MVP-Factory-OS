/**
 * 대시보드에 얹는 고용지원금 칸 (D-91).
 *
 * 위쪽(공통)은 이 OS 의 업체 기록을 본다. 여기는 **이 모듈이 쌓은 대상자**를 본다 —
 * 이번 달에 신청할 수 있는 회차, 신청일이 지난 회차, 서류가 덜 찬 사람, 지금까지 받은 돈.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { Badge, MetricTile, Section, Surface, type Tone } from '../../../components/ui/primitives'
import { addMo, fD, formatDday, getDdayFrom } from '../lib/dates'
import { fMan } from '../lib/format'
import { summarizeEmployees, type EmpRecord } from '../lib/empRecords'
import { useEmployees } from '../lib/useEmployees'
import { EmploymentDashboardMore } from './DashboardMore'

interface DueRow {
  empId: string
  clientId: string
  name: string
  label: string
  date: string
  dday: number
  amount: number
}

function upcoming(emps: readonly EmpRecord[], today: Date): DueRow[] {
  const out: DueRow[] = []
  for (const e of emps) {
    if (e.stage === 'resigned' || !e.hireDate) continue
    for (const r of e.rounds) {
      if (r.isPaid) continue
      const date = addMo(e.hireDate, r.month)
      const dday = getDdayFrom(date, today)
      if (dday === null || dday > 30) continue
      out.push({ empId: e.id, clientId: e.clientId, name: e.name, label: r.label, date, dday, amount: r.expectedAmount || r.amount || 0 })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export function EmploymentDashboardExtra() {
  const { employees } = useEmployees()
  const today = useMemo(() => new Date(), [])
  const sum = useMemo(() => summarizeEmployees(employees ?? [], today), [employees, today])
  const dues = useMemo(() => upcoming(employees ?? [], today), [employees, today])

  if (employees === null) return null
  const emps = employees

  if (emps.length === 0) {
    return (
      <Surface>
        <p className="t-sub break-keep text-slate-600">
          아직 지원금 대상자가 없습니다. 목차의{' '}
          <Link to="/tools/employment/companies" className="font-bold text-brand-700 hover:underline">
            업체 관리
          </Link>{' '}
          에서 한 사람을 넣으면 회차 일정과 이번 달 신청 건이 여기에 모입니다.
        </p>
      </Surface>
    )
  }

  return (
    <div className="flex flex-col gap-4" data-testid="emp-dashboard-extra">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MetricTile label="지원금 대상자" value={`${sum.active}명`} hint="퇴사 제외" />
        <MetricTile
          label="신청이 지난 회차"
          value={`${sum.overdue}건`}
          hint={sum.overdueAmount > 0 ? fMan(sum.overdueAmount) : '없음'}
          tone={sum.overdue > 0 ? 'danger' : 'neutral'}
        />
        <MetricTile label="7일 안에 신청" value={`${sum.next7}건`} tone={sum.next7 > 0 ? 'warning' : 'neutral'} />
        <MetricTile label="지금까지 받은 돈" value={fMan(sum.received)} tone={sum.received > 0 ? 'success' : 'neutral'} />
      </div>

      {dues.length > 0 && (
        <Section title="30일 안에 신청할 회차" count={dues.length}>
          <ul className="flex flex-col gap-2" data-testid="emp-dashboard-dues">
            {dues.slice(0, 8).map((d) => {
              const tone: Tone = d.dday < 0 ? 'danger' : d.dday <= 7 ? 'warning' : 'neutral'
              return (
                <li key={`${d.empId}-${d.label}`}>
                  <Surface as="div" edge={tone} showEdge={tone !== 'neutral'} padded={false}>
                    <Link to={`/ops/clients/${d.clientId}`} className="tap flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                      <CalendarClock aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                      <span className="t-sub font-bold text-slate-900">{d.name}</span>
                      <span className="t-sub min-w-0 flex-1 break-keep text-slate-600">{d.label} 신청</span>
                      <span className="t-meta text-slate-400">{fD(d.date)}</span>
                      <span className="t-meta tabular-nums text-slate-500">{fMan(d.amount)}</span>
                      <Badge tone={tone}>{formatDday(d.dday)}</Badge>
                    </Link>
                  </Surface>
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      <EmploymentDashboardMore employees={emps} today={today} />

      {sum.docsPending > 0 && (
        <Surface edge="warning" showEdge>
          <p className="t-sub break-keep text-slate-600">
            서류가 덜 찬 대상자 <b className="text-amber-700">{sum.docsPending}명</b>. 목차의{' '}
            <Link to="/tools/employment/board" className="font-bold text-brand-700 hover:underline">
              진행 보드
            </Link>{' '}
            에서 무엇이 빠졌는지 볼 수 있습니다.
          </p>
        </Surface>
      )}
    </div>
  )
}
