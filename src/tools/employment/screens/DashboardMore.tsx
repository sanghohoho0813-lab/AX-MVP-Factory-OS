/**
 * 고용지원금 대시보드 — 원본에 있던 나머지 칸 (D-92).
 *
 * 🔔 오늘 바로 해야 할 일 · 📅 신청 일정 달력(날짜 메모) · 📈 월별 수령 · 🏆 업체별 수령 순위 ·
 * 💳 미지급 대상자 · 지원금별 파이프라인 · 🛡️ 업체별 위험도 · 수수료 요약 · 엑셀용 데이터 복사.
 * 규칙은 lib/companyMeta.ts(원본 그대로). 달력 메모는 모듈 기록 `employment/calendar` 에 한 줄로 둔다.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { Badge, MetricTile, Section, Surface } from '../../../components/ui/primitives'
import { useToast } from '../../../components/ui/toastContext'
import { useToolClient } from '../../shared/toolClientContext'
import { useModuleBucket } from '../../shared/useModuleBucket'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { addMo, formatDday } from '../lib/dates'
import { fMan } from '../lib/format'
import type { EmpRecord } from '../lib/empRecords'
import { usePrograms } from '../lib/usePrograms'
import {
  commissionTotals,
  companyRanking,
  companyRiskRanking,
  ddayAlerts,
  excelCopyText,
  monthlyReceived,
  pendingPayments,
  programPipeline,
  toCompanyMeta,
  type CompanyMeta,
} from '../lib/companyMeta'

interface MemoStore extends Record<string, unknown> {
  /** 'YYYY-MM-DD' → 메모 목록 */
  memos: Record<string, Array<{ id: string; text: string }>>
}

export function EmploymentDashboardMore({ employees, today }: { employees: EmpRecord[]; today: Date }) {
  const { showToast } = useToast()
  const { loadClients } = useToolClient()
  const { programs } = usePrograms()
  const metaBucket = useModuleBucket<CompanyMeta>('employment', 'companies')
  const calBucket = useModuleBucket<MemoStore>('employment', 'calendar')
  const [clients, setClients] = useState<ClientOpsRecord[]>([])
  const [showAll, setShowAll] = useState(false)
  const [year, setYear] = useState(today.getFullYear())
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [pickDay, setPickDay] = useState<number | null>(null)
  const [memoText, setMemoText] = useState('')

  useEffect(() => {
    let alive = true
    void loadClients().then((l) => {
      if (alive) setClients(l.filter((c) => c.archivedAt === null))
    })
    return () => {
      alive = false
    }
  }, [loadClients])

  const programName = (id: string) => programs?.find((p) => p.id === id)?.name ?? id
  const companies = useMemo(
    () => clients.map((c) => ({ id: c.id, name: c.companyName, meta: toCompanyMeta(metaBucket.rows?.find((r) => r.clientId === c.id)?.data) })),
    [clients, metaBucket.rows],
  )
  const tasks = useMemo(() => ddayAlerts(employees, companies, today), [employees, companies, today])
  const monthly = useMemo(() => monthlyReceived(employees, year), [employees, year])
  const ranking = useMemo(() => companyRanking(employees, companies), [employees, companies])
  const pending = useMemo(() => pendingPayments(employees, today), [employees, today])
  const pipeline = useMemo(() => programPipeline(employees, (id) => programs?.find((p) => p.id === id)?.name ?? id), [employees, programs])
  const risk = useMemo(() => companyRiskRanking(employees, companies, today), [employees, companies, today])
  const comm = useMemo(() => commissionTotals(employees, companies, today), [employees, companies, today])

  const calRow = calBucket.rows?.[0]
  const memos: MemoStore['memos'] = (calRow?.data.memos as MemoStore['memos'] | undefined) ?? {}
  const y = cursor.getFullYear()
  const m = cursor.getMonth()
  const keyOf = (d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const events = useMemo(() => {
    const list: Array<{ day: number; name: string; clientId: string }> = []
    for (const e of employees) {
      if (e.stage === 'resigned' || !e.hireDate) continue
      for (const r of e.rounds) {
        if (r.isPaid) continue
        const ed = addMo(e.hireDate, r.month)
        const d = new Date(`${ed}T00:00:00`)
        if (d.getFullYear() === y && d.getMonth() === m) list.push({ day: d.getDate(), name: `${e.name} ${r.label}`, clientId: e.clientId })
      }
    }
    return list
  }, [employees, y, m])
  const firstDow = new Date(y, m, 1).getDay()
  const days = new Date(y, m + 1, 0).getDate()
  const saveMemos = (next: MemoStore['memos']) => calBucket.save({ id: calRow?.id, clientId: '', data: { memos: next } })
  const maxR = Math.max(1, ...monthly.map((d) => d.received))
  const top = tasks[0]
  const overdueCount = tasks.filter((t) => t.pri === 0).length

  return (
    <div className="flex flex-col gap-4" data-testid="emp-dashboard-more">
      {tasks.length > 0 && (
        <Section title="🔔 오늘 바로 해야 할 일" count={tasks.length} action={<Badge tone={overdueCount > 0 ? 'danger' : 'brand'}>필수 확인</Badge>}>
          {top && (
            <p className="t-sub mb-2 break-keep text-slate-600">
              최우선: <b style={{ color: top.kindColor }}>{top.kind}</b> {top.title} · {top.sub}
              {top.dday !== null ? ` · ${formatDday(top.dday)}` : ''}
            </p>
          )}
          <ul className="flex flex-col gap-1.5" data-testid="emp-today-tasks">
            {(showAll ? tasks : tasks.slice(0, 7)).map((t) => (
              <li key={t.id}>
                <Link to={`/tools/employment/companies?client=${t.clientId}`} className="tap flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2">
                  <span className="t-meta rounded-md px-2 py-0.5 font-bold text-white" style={{ background: t.kindColor }}>
                    {t.kind}
                  </span>
                  <b className="t-sub">{t.title}</b>
                  <span className="t-meta text-slate-500">{t.sub}</span>
                  {t.dday !== null && <span className="t-meta ml-auto font-bold" style={{ color: t.kindColor }}>{t.dday < 0 ? `${Math.abs(t.dday)}일 지연` : formatDday(t.dday)}</span>}
                </Link>
              </li>
            ))}
          </ul>
          {tasks.length > 7 && (
            <button type="button" className="t-meta mt-1 text-brand-700 hover:underline" onClick={() => setShowAll((v) => !v)}>
              {showAll ? '접기 ⌃' : `전체 ${tasks.length}건 보기 ⌄`}
            </button>
          )}
        </Section>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4" data-testid="emp-commission-kpi">
        <MetricTile label="누적 수수료" value={fMan(comm.total)} />
        <MetricTile label="미청구 수수료" value={fMan(comm.unbilled)} tone={comm.unbilled > 0 ? 'warning' : 'neutral'} />
        <MetricTile label="미입금 수수료" value={fMan(comm.unpaid)} tone={comm.unpaid > 0 ? 'danger' : 'neutral'} />
        <MetricTile label="이번 달 예상 수수료" value={fMan(comm.thisMonth)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="📅 신청 일정"
          action={
            <span className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => { setCursor(new Date(y, m - 1, 1)); setPickDay(null) }} aria-label="이전 달">
                ◀
              </Button>
              <span className="t-sub min-w-24 text-center font-bold">
                {y}년 {m + 1}월
              </span>
              <Button size="sm" variant="ghost" onClick={() => { setCursor(new Date(y, m + 1, 1)); setPickDay(null) }} aria-label="다음 달">
                ▶
              </Button>
            </span>
          }
        >
          <Surface className="p-2">
            <div className="grid grid-cols-7 gap-0.5 text-center" data-testid="emp-calendar">
              {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                <div key={d} className={`t-meta py-1 font-bold ${i === 0 ? 'text-danger-700' : i === 6 ? 'text-brand-700' : 'text-slate-500'}`}>
                  {d}
                </div>
              ))}
              {Array.from({ length: firstDow }, (_, i) => (
                <div key={`b${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const d = i + 1
                const ev = events.filter((e) => e.day === d)
                const mm = memos[keyOf(d)] ?? []
                const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d
                return (
                  <button key={d} type="button" onClick={() => setPickDay(d)} className={`tap min-h-14 rounded border p-0.5 text-left ${pickDay === d ? 'border-brand-500 bg-brand-50' : isToday ? 'border-amber-300 bg-amber-50' : 'border-slate-100'}`}>
                    <div className="t-meta font-bold text-slate-700">
                      {d}
                      {mm.length > 0 && ' 📝'}
                    </div>
                    {ev.slice(0, 2).map((e, k) => (
                      <div key={k} className="truncate rounded bg-blue-100 px-0.5 text-[0.62rem] text-blue-700">
                        {e.name}
                      </div>
                    ))}
                    {ev.length > 2 && <div className="text-[0.62rem] text-slate-400">+{ev.length - 2}</div>}
                  </button>
                )
              })}
            </div>
            {pickDay !== null && (
              <div className="mt-2 flex flex-col gap-1.5 border-t border-slate-100 pt-2">
                <span className="t-sub font-bold">
                  {m + 1}월 {pickDay}일
                </span>
                {events.filter((e) => e.day === pickDay).map((e, k) => (
                  <Link key={k} to={`/tools/employment/companies?client=${e.clientId}`} className="t-meta text-brand-700 hover:underline">
                    {e.name} 신청
                  </Link>
                ))}
                {(memos[keyOf(pickDay)] ?? []).map((mm) => (
                  <div key={mm.id} className="t-meta flex items-center gap-2 text-slate-700">
                    📝 {mm.text}
                    <button type="button" className="text-slate-400 hover:text-danger-700" onClick={() => void saveMemos({ ...memos, [keyOf(pickDay)]: (memos[keyOf(pickDay)] ?? []).filter((x) => x.id !== mm.id) })}>
                      ×
                    </button>
                  </div>
                ))}
                <div className="flex gap-1.5">
                  <input aria-label="달력 메모" value={memoText} onChange={(e) => setMemoText(e.target.value)} placeholder="메모..." className="t-sub min-w-0 flex-1 rounded border border-slate-300 px-2 py-1" />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!memoText.trim()) return
                      const k = keyOf(pickDay)
                      void saveMemos({ ...memos, [k]: [...(memos[k] ?? []), { id: Date.now().toString(36), text: memoText.trim() }] })
                      setMemoText('')
                    }}
                  >
                    추가
                  </Button>
                </div>
              </div>
            )}
          </Surface>
        </Section>

        <Section
          title="📈 월별 수령"
          action={
            <span className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setYear((v) => v - 1)} aria-label="이전 해">
                ◀
              </Button>
              <span className="t-sub font-bold">{year}</span>
              <Button size="sm" variant="ghost" onClick={() => setYear((v) => v + 1)} aria-label="다음 해">
                ▶
              </Button>
            </span>
          }
        >
          <Surface>
            <div className="flex h-36 items-end gap-1" data-testid="emp-monthly">
              {monthly.map((d) => (
                <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-emerald-500" style={{ height: `${Math.round((d.received / maxR) * 100)}%`, minHeight: d.received ? 4 : 0 }} title={fMan(d.received)} />
                  <span className="text-[0.66rem] text-slate-500">{d.month}월</span>
                </div>
              ))}
            </div>
            <p className="t-meta mt-2 text-slate-500">연간: <b className="text-emerald-700">{fMan(monthly.reduce((s, d) => s + d.received, 0))}</b> · 지급 확인한 날 기준</p>
          </Surface>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {ranking.length > 0 && (
          <Section title="🏆 업체별 수령 순위">
            <ul className="flex flex-col gap-1.5">
              {ranking.map((r, i) => (
                <li key={r.id} className="t-sub flex items-center justify-between gap-2 rounded bg-slate-50 px-3 py-2">
                  <span>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`} <b>{r.name}</b> <span className="t-meta text-slate-500">{r.empCount}명</span>
                  </span>
                  <b className="text-emerald-700">{fMan(r.total)}</b>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <Section title="💳 미지급 대상자" count={pending.length} action={<Badge tone="brand">{fMan(pending.reduce((s, p) => s + p.remainingAmount, 0))}</Badge>}>
          {pending.length === 0 ? (
            <p className="t-sub text-slate-500">없음</p>
          ) : (
            <ul className="flex max-h-60 flex-col gap-1.5 overflow-auto">
              {pending.map((p) => (
                <li key={p.id} className="t-sub flex flex-wrap items-center gap-2 rounded bg-slate-50 px-3 py-1.5">
                  <b>{p.name}</b>
                  <span className="t-meta text-slate-500">
                    {p.paidCount}/{p.totalRounds}회차
                  </span>
                  {p.nextDday !== null && <Badge tone={p.nextDday < 0 ? 'danger' : p.nextDday <= 7 ? 'warning' : 'neutral'}>{formatDday(p.nextDday)}</Badge>}
                  <span className="t-meta ml-auto tabular-nums">{fMan(p.remainingAmount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {pipeline.length > 0 && (
        <Section title="지원금별 파이프라인">
          <Surface className="flex flex-col gap-3" data-testid="emp-program-pipeline">
            {pipeline.map((r) => {
              const pct = r.expected > 0 ? Math.round((r.received / r.expected) * 100) : 0
              return (
                <div key={r.programId}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="t-sub font-bold text-slate-700">
                      {r.name} <span className="t-meta text-slate-400">{r.count}명</span>
                    </span>
                    <span className="t-meta text-slate-500">
                      <b className="text-emerald-600">{fMan(r.received)}</b> / {fMan(r.expected)} <b className="text-slate-900">{pct}%</b>
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </Surface>
        </Section>
      )}

      {risk.length > 0 && (
        <Section title="🛡️ 업체별 위험도" action={<span className="t-meta text-slate-500">지연·임박·서류·수령예정액 종합</span>}>
          <ul className="grid gap-2 sm:grid-cols-2" data-testid="emp-risk-ranking">
            {risk.map((r) => (
              <li key={r.id}>
                <Link to={`/tools/employment/companies?client=${r.id}`} className="tap flex flex-col gap-1 rounded-(--radius-panel) border px-3 py-2.5" style={{ background: r.level.bg, borderColor: `${r.level.c}33` }}>
                  <span className="flex items-center justify-between gap-2">
                    <b className="t-sub text-slate-900">{r.name}</b>
                    <span className="t-meta rounded-md px-2 py-0.5 font-bold text-white" style={{ background: r.level.c }}>
                      {r.level.t}
                    </span>
                  </span>
                  <span className="t-meta text-slate-600">
                    대상자 {r.empCount}명 · 지연 {r.overdue} · 임박 {r.next7} · 서류 {r.docMiss} · 예정 {fMan(r.remaining)}
                    {r.nextDday !== null ? ` · 다음 ${formatDday(r.nextDday)}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const t = excelCopyText(employees, (id) => clients.find((c) => c.id === id)?.companyName ?? '', programName)
            void navigator.clipboard?.writeText(t).then(() => showToast('엑셀용 데이터가 복사되었습니다.')).catch(() => undefined)
          }}
          data-testid="emp-excel-copy"
        >
          📋 엑셀용 데이터 복사
        </Button>
      </div>
    </div>
  )
}
