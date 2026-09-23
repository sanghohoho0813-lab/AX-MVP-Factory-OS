/**
 * 진행 보드 — 준비중부터 최종지급완료까지 7단계 (D-91).
 *
 * 원본의 칸반을 옮긴 것이다. 끌어다 놓기 대신 **단계를 고르는 칸**을 쓴다 —
 * 휴대폰에서 끌어다 놓기는 잘 안 되고, 대표는 휴대폰으로도 이 화면을 본다.
 *
 * 카드 순서는 원본과 같다: 지연 → 임박(7일) → 서류 미완료 → 일반.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, MetricTile, Surface, type Tone } from '../../../components/ui/primitives'
import { useToolClient } from '../../shared/toolClientContext'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { DEFAULT_PROGRAMS } from '../lib/programs'
import { fD, formatDday } from '../lib/dates'
import { fMan } from '../lib/format'
import {
  EMP_STAGES,
  boardColumns,
  empNextDate,
  empNextDday,
  empRemaining,
  summarizeEmployees,
  type EmpRecord,
  type EmpStage,
} from '../lib/empRecords'
import { useEmployees } from '../lib/useEmployees'

export function BoardScreen() {
  const { loadClients } = useToolClient()
  const { employees, save } = useEmployees()
  const [clients, setClients] = useState<ClientOpsRecord[]>([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    let alive = true
    void loadClients().then((list) => {
      if (alive) setClients(list.filter((c) => c.archivedAt === null))
    })
    return () => {
      alive = false
    }
  }, [loadClients])

  const today = useMemo(() => new Date(), [])
  const shown = useMemo(
    () => (employees ?? []).filter((e) => filter === 'all' || e.clientId === filter),
    [employees, filter],
  )
  const columns = useMemo(() => boardColumns(shown, today), [shown, today])
  const sum = useMemo(() => summarizeEmployees(shown, today), [shown, today])

  if (employees === null) return <p className="t-sub text-slate-400">대상자를 읽는 중…</p>

  const nameOf = (id: string) => clients.find((c) => c.id === id)?.companyName ?? '업체 없음'

  return (
    <div className="flex flex-col gap-5" data-testid="emp-board">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MetricTile label="진행 중" value={`${sum.active}명`} hint="퇴사 제외" />
        <MetricTile label="남은 예정액" value={fMan(sum.pipeline)} hint="아직 안 받은 회차" />
        <MetricTile
          label="지난 회차"
          value={`${sum.overdue}건`}
          hint={sum.overdueAmount > 0 ? fMan(sum.overdueAmount) : '없음'}
          tone={sum.overdue > 0 ? 'danger' : 'neutral'}
        />
        <MetricTile label="최종지급완료" value={`${sum.completed}명`} tone={sum.completed > 0 ? 'success' : 'neutral'} />
      </div>

      <label className="flex flex-wrap items-center gap-2">
        <span className="t-sub font-medium text-slate-600">업체</span>
        <select
          aria-label="업체로 거르기"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 t-sub text-slate-800"
        >
          <option value="all">전체</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </select>
      </label>

      {shown.length === 0 ? (
        <Surface>
          <p className="t-sub break-keep text-slate-600">
            아직 보드에 올라온 대상자가 없습니다. 목차의 <b>업체 관리</b> 에서 대상자를 넣으면 여기에 단계별로 섭니다.
          </p>
        </Surface>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {columns.map((col) => (
            <div key={col.stage.key} className="flex w-[17rem] shrink-0 flex-col gap-2" data-column={col.stage.key}>
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="t-sub font-bold text-slate-800">{col.stage.label}</span>
                <span className="t-meta rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">{col.items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {col.items.map((emp) => (
                  <BoardCard
                    key={emp.id}
                    emp={emp}
                    clientName={nameOf(emp.clientId)}
                    today={today}
                    onStage={(stage) => void save({ ...emp, stage })}
                  />
                ))}
                {col.items.length === 0 && (
                  <div className="rounded-(--radius-panel) border border-dashed border-slate-200 px-3 py-4 text-center t-meta text-slate-300">
                    없음
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BoardCard({
  emp,
  clientName,
  today,
  onStage,
}: {
  emp: EmpRecord
  clientName: string
  today: Date
  onStage: (stage: EmpStage) => void
}) {
  const dd = empNextDday(emp, today)
  const tone: Tone = dd !== null && dd < 0 ? 'danger' : dd !== null && dd <= 7 ? 'warning' : 'neutral'
  const program = DEFAULT_PROGRAMS[emp.programId]
  const docsLeft = emp.docs.filter((d) => !d.done).length

  return (
    <Surface as="div" edge={tone} showEdge={tone !== 'neutral'}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="t-sub font-bold text-slate-900">{emp.name}</span>
          {dd !== null && <Badge tone={tone}>{formatDday(dd)}</Badge>}
        </div>
        <Link to={`/ops/clients/${emp.clientId}`} className="t-meta text-slate-500 hover:underline">
          {clientName}
        </Link>
        <span className="t-meta text-slate-500">{program?.name ?? '지원금 미지정'}</span>
        <span className="t-meta text-slate-500">
          남은 {fMan(empRemaining(emp))}
          {empNextDate(emp) ? ` · 다음 ${fD(empNextDate(emp))}` : ''}
        </span>
        {docsLeft > 0 && <span className="t-meta text-amber-700">서류 {docsLeft}건 남음</span>}
        <select
          aria-label={`${emp.name} 단계 옮기기`}
          value={emp.stage}
          onChange={(e) => onStage(e.target.value as EmpStage)}
          className="mt-1 rounded-(--radius-control) border border-slate-300 bg-white px-2 py-1 t-meta text-slate-700"
        >
          {EMP_STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </Surface>
  )
}
