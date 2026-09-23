/**
 * 모듈 첫 화면 — 이 OS 의 업체 기록을 그대로 본다 (D-91).
 *
 * 원본 OS 들의 대시보드는 저마다 자기 안의 샘플 데이터를 셌다. 여기서는 그러지 않는다.
 * 모듈 대시보드는 **고객 운영의 업체 명단**을 읽고, 그 업체들에 대해 이 모듈이
 *   - 지금 돌릴 수 있는가(서류가 다 있는가),
 *   - 무엇을 만들어 두었는가(도구 결과),
 *   - 언제까지 해야 하는가(도구가 계산한 기한)
 * 를 말한다. 명단이 두 벌로 갈라지지 않게 하는 것이 이 화면의 첫 번째 일이다.
 *
 * 모듈마다 다른 것(이번 달 회차·연구노트 밀린 수 같은 것)은 `children` 으로 아래에 더한다.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Building2, CalendarClock, FileWarning } from 'lucide-react'
import { Badge, MetricTile, Section, Surface, type Tone } from '../../components/ui/primitives'
import { toolOf } from '../../config/toolRegistry'
import { toolReadiness } from '../../services/toolReadiness'
import { todayLocalDate } from '../../lib/appClock'
import { daysLeftFrom } from '../../services/clientOpsAlerts'
import type { ClientOpsRecord, ToolResult } from '../../types/clientOps'
import { useToolClient } from './toolClientContext'

/** 이 모듈이 만든 기한 한 줄 — 어느 업체의 것인지까지 */
interface ModuleDue {
  clientId: string
  clientName: string
  date: string
  title: string
  note: string
  daysLeft: number | null
}

/** 서류가 빠져서 아직 못 돌리는 업체 한 줄 */
interface ModuleGap {
  clientId: string
  clientName: string
  missing: string[]
}

export interface ModuleDashboardSummary {
  clients: ClientOpsRecord[]
  ready: ClientOpsRecord[]
  gaps: ModuleGap[]
  dues: ModuleDue[]
  results: { clientId: string; clientName: string; result: ToolResult }[]
}

/** 업체 명단 → 이 모듈이 볼 것들 (시험이 이 함수를 직접 붙든다) */
export function summarizeModule(
  clients: ClientOpsRecord[],
  toolKey: string,
  today: string,
): ModuleDashboardSummary {
  const tool = toolOf(toolKey)
  const live = clients.filter((c) => c.archivedAt === null)

  const ready: ClientOpsRecord[] = []
  const gaps: ModuleGap[] = []
  const dues: ModuleDue[] = []
  const results: { clientId: string; clientName: string; result: ToolResult }[] = []

  for (const c of live) {
    if (tool) {
      const r = toolReadiness(c, tool, today)
      if (r.ready) ready.push(c)
      else gaps.push({ clientId: c.id, clientName: c.companyName, missing: r.missing.map((m) => m.label) })
    }
    for (const result of c.toolResults) {
      if (result.toolKey !== toolKey) continue
      results.push({ clientId: c.id, clientName: c.companyName, result })
      for (const d of result.deadlines) {
        dues.push({
          clientId: c.id,
          clientName: c.companyName,
          date: d.date,
          title: d.title,
          note: d.note,
          daysLeft: daysLeftFrom(today, d.date),
        })
      }
    }
  }

  dues.sort((a, b) => (a.date === b.date ? a.clientName.localeCompare(b.clientName) : a.date.localeCompare(b.date)))
  results.sort((a, b) => b.result.createdAt.localeCompare(a.result.createdAt))

  return { clients: live, ready, gaps, dues, results }
}

/** 남은 날 → 말과 색 */
function dueTone(daysLeft: number | null): { tone: Tone; text: string } {
  if (daysLeft === null) return { tone: 'neutral', text: '날짜 없음' }
  if (daysLeft < 0) return { tone: 'danger', text: `${Math.abs(daysLeft)}일 지남` }
  if (daysLeft === 0) return { tone: 'danger', text: '오늘' }
  if (daysLeft <= 14) return { tone: 'warning', text: `${daysLeft}일 남음` }
  return { tone: 'neutral', text: `${daysLeft}일 남음` }
}

export interface ModuleDashboardProps {
  toolKey: string
  /** 모듈이 직접 더하는 칸 — 위(칸 아래)에 그대로 놓인다 */
  children?: ReactNode
}

export function ModuleDashboard({ toolKey, children }: ModuleDashboardProps) {
  const { loadClients } = useToolClient()
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  const tool = toolOf(toolKey)
  const today = todayLocalDate()

  useEffect(() => {
    let alive = true
    void loadClients().then((list) => {
      if (alive) setClients(list)
    })
    return () => {
      alive = false
    }
  }, [loadClients])

  const sum = useMemo(
    () => summarizeModule(clients ?? [], toolKey, today),
    [clients, toolKey, today],
  )

  if (clients === null) {
    return <p className="t-sub text-slate-400">업체 기록을 읽는 중…</p>
  }

  const upcoming = sum.dues.filter((d) => d.daysLeft !== null && d.daysLeft <= 30)
  const overdue = sum.dues.filter((d) => d.daysLeft !== null && d.daysLeft < 0)
  const basePath = tool?.path ?? '/tools'

  return (
    <div className="flex flex-col gap-5" data-testid="module-dashboard" data-module={toolKey}>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MetricTile label="업체" value={`${sum.clients.length}곳`} hint="고객 운영에 있는 업체" />
        <MetricTile
          label="지금 돌릴 수 있는 업체"
          value={`${sum.ready.length}곳`}
          hint="필요한 서류가 다 있는 곳"
          tone={sum.ready.length > 0 ? 'success' : 'neutral'}
        />
        <MetricTile
          label="서류가 빠진 업체"
          value={`${sum.gaps.length}곳`}
          hint="받아야 할 서류가 있다"
          tone={sum.gaps.length > 0 ? 'warning' : 'neutral'}
        />
        <MetricTile
          label="이 모듈이 만든 기한"
          value={`${upcoming.length}건`}
          hint={overdue.length > 0 ? `지난 것 ${overdue.length}건` : '30일 안'}
          tone={overdue.length > 0 ? 'danger' : upcoming.length > 0 ? 'warning' : 'neutral'}
        />
      </div>

      {sum.clients.length === 0 && (
        <Surface edge="brand" showEdge>
          <p className="t-sub break-keep text-slate-600">
            아직 업체가 없습니다. <Link to="/ops/clients" className="font-bold text-brand-700 hover:underline">고객 운영</Link> 에서 업체를 만들면
            이 화면이 그 업체들로 채워집니다. 이 모듈은 업체 명단을 따로 갖지 않습니다.
          </p>
        </Surface>
      )}

      {children}

      {sum.dues.length > 0 && (
        <Section title="이 모듈이 잡아 둔 기한" count={sum.dues.length}>
          <ul className="flex flex-col gap-2" data-testid="module-dues">
            {sum.dues.slice(0, 8).map((d, i) => {
              const tone = dueTone(d.daysLeft)
              return (
                <li key={`${d.clientId}-${d.date}-${i}`}>
                  <Surface as="div" edge={tone.tone} showEdge padded={false}>
                    <Link
                      to={`/ops/clients/${d.clientId}`}
                      className="tap flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5"
                    >
                      <CalendarClock aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                      <span className="t-sub font-bold text-slate-900">{d.clientName}</span>
                      <span className="t-sub min-w-0 flex-1 break-keep text-slate-600">{d.title}</span>
                      <span className="t-meta text-slate-400">{d.date}</span>
                      <Badge tone={tone.tone}>{tone.text}</Badge>
                    </Link>
                  </Surface>
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      {sum.gaps.length > 0 && (
        <Section title="서류부터 받아야 하는 업체" count={sum.gaps.length}>
          <ul className="flex flex-col gap-2" data-testid="module-gaps">
            {sum.gaps.slice(0, 8).map((g) => (
              <li key={g.clientId}>
                <Surface as="div" edge="warning" showEdge padded={false}>
                  <Link
                    to={`/ops/clients/${g.clientId}?tab=docs`}
                    className="tap flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5"
                  >
                    <FileWarning aria-hidden="true" className="size-4 shrink-0 text-amber-500" />
                    <span className="t-sub font-bold text-slate-900">{g.clientName}</span>
                    <span className="t-sub min-w-0 flex-1 break-keep text-amber-700">{g.missing.join(' · ')} 없음</span>
                    <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-slate-300" />
                  </Link>
                </Surface>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {sum.ready.length > 0 && (
        <Section title="이 업체로 바로 열기" count={sum.ready.length}>
          <div className="flex flex-wrap gap-2" data-testid="module-ready">
            {sum.ready.slice(0, 12).map((c) => (
              <Link
                key={c.id}
                to={`${basePath}?client=${c.id}`}
                data-client={c.id}
                className="tap inline-flex items-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 t-sub font-medium text-slate-700 hover:bg-slate-50"
              >
                <Building2 aria-hidden="true" className="size-4 text-slate-400" />
                {c.companyName}
              </Link>
            ))}
          </div>
        </Section>
      )}

      {sum.results.length > 0 && (
        <Section title="최근 결과" count={sum.results.length}>
          <ul className="flex flex-col gap-2" data-testid="module-results">
            {sum.results.slice(0, 6).map(({ clientId, clientName, result }) => (
              <li key={result.id}>
                <Surface as="div" padded={false}>
                  <Link to={`/ops/clients/${clientId}`} className="tap flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                    <span className="t-sub font-bold text-slate-900">{clientName}</span>
                    <span className="t-sub min-w-0 flex-1 break-keep text-slate-600">{result.title}</span>
                    {result.verdictLabel && <Badge tone="neutral">{result.verdictLabel}</Badge>}
                    <span className="t-meta text-slate-400">{result.createdAt.slice(0, 10)}</span>
                  </Link>
                </Surface>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {sum.clients.length > 0 && sum.results.length === 0 && (
        <Surface edge="neutral">
          <p className="t-sub flex flex-wrap items-center gap-2 break-keep text-slate-600">
            <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
            아직 이 모듈로 만든 결과가 없습니다. 목차에서 화면을 골라 돌리면, 결과와 기한이 업체 기록과 달력으로 갑니다.
          </p>
        </Surface>
      )}
    </div>
  )
}
