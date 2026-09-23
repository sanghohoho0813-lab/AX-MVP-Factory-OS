/**
 * 상담 고객 관리 — 어디까지 왔고 다음에 무엇을 하는가 (D-91).
 *
 * 원본의 고객 관리 화면을 옮겼다. 다만 고객 명단은 새로 만들지 않는다 —
 * 고객 운영의 업체를 그대로 쓰고, 이 모듈은 그 업체의 상담 단계·다음 액션만 쌓는다.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Clock } from 'lucide-react'
import { Badge, MetricTile, Section, Surface, type Tone } from '../../../components/ui/primitives'
import { useToolClient } from '../../shared/toolClientContext'
import { useModuleBucket } from '../../shared/useModuleBucket'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { CUSTOMER_STAGES, type CustomerStage } from '../types'
import { daysSinceContact, emptyConsult, isOpenStage, summarizeConsults, type ConsultData } from '../lib/consultRecord'

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

function stageTone(stage: CustomerStage): Tone {
  if (stage === '승인') return 'success'
  if (stage === '실패' || stage === '보류') return 'danger'
  if (stage === '신규 DB') return 'neutral'
  return 'brand'
}

export function CustomersScreen() {
  const { loadClients } = useToolClient()
  const consults = useModuleBucket<ConsultData>('policy-funding', 'consults')
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  const [onlyOpen, setOnlyOpen] = useState(false)

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
  const rowOf = useMemo(() => {
    const map = new Map<string, { id: string; data: ConsultData }>()
    for (const r of consults.rows ?? []) map.set(r.clientId, { id: r.id, data: r.data })
    return map
  }, [consults.rows])

  if (clients === null || consults.rows === null) {
    return <p className="t-sub text-slate-400">상담 기록을 읽는 중…</p>
  }

  const tracked = clients.filter((c) => rowOf.has(c.id))
  const sum = summarizeConsults(
    tracked.map((c) => {
      const d = rowOf.get(c.id)!.data
      return { stage: d.stage, lastContactedAt: d.lastContactedAt }
    }),
    today,
  )

  const shown = onlyOpen ? tracked : clients

  const patch = async (client: ClientOpsRecord, next: Partial<ConsultData>) => {
    const cur = rowOf.get(client.id)
    await consults.save({ id: cur?.id, clientId: client.id, data: { ...(cur?.data ?? emptyConsult()), ...next } })
  }

  return (
    <div className="flex flex-col gap-5" data-testid="pf-customers">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MetricTile label="상담 중" value={`${sum.open}곳`} tone={sum.open > 0 ? 'brand' : 'neutral'} />
        <MetricTile label="승인" value={`${sum.approved}곳`} tone={sum.approved > 0 ? 'success' : 'neutral'} />
        <MetricTile label="보류·실패" value={`${sum.failed}곳`} tone={sum.failed > 0 ? 'danger' : 'neutral'} />
        <MetricTile label="2주 넘게 연락 없음" value={`${sum.stale}곳`} tone={sum.stale > 0 ? 'warning' : 'neutral'} hint="먼저 연락할 곳" />
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="size-4" />
        <span className="t-sub text-slate-600">상담을 시작한 업체만 보기</span>
      </label>

      <Section title="업체" count={shown.length}>
        <ul className="flex flex-col gap-2" data-testid="pf-customer-list">
          {shown.map((c) => {
            const data = rowOf.get(c.id)?.data ?? emptyConsult()
            const days = daysSinceContact(data.lastContactedAt, today)
            const late = isOpenStage(data.stage) && (days === null || days >= 14)
            return (
              <li key={c.id}>
                <Surface as="div" edge={late ? 'warning' : stageTone(data.stage)} showEdge={rowOf.has(c.id)}>
                  <div className="flex flex-col gap-2" data-client={c.id}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Building2 aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                      <span className="t-sub font-bold text-slate-900">{c.companyName}</span>
                      {data.topAgency && <Badge tone="neutral">{data.topAgency}</Badge>}
                      {data.score !== null && <span className="t-meta text-slate-500">점수 {data.score}</span>}
                      {days !== null && (
                        <span className={`t-meta inline-flex items-center gap-1 ${late ? 'text-amber-700' : 'text-slate-500'}`}>
                          <Clock aria-hidden="true" className="size-3.5" /> {days}일 전 연락
                        </span>
                      )}
                      <Link to={`/ops/clients/${c.id}`} className="t-meta ml-auto text-brand-700 hover:underline">
                        업체 기록
                      </Link>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[10rem_1fr_9rem]">
                      <select
                        aria-label={`${c.companyName} 진행 단계`}
                        value={data.stage}
                        data-stage-for={c.id}
                        onChange={(e) => void patch(c, { stage: e.target.value as CustomerStage })}
                        className={inputCls}
                      >
                        {CUSTOMER_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label={`${c.companyName} 다음 액션`}
                        defaultValue={data.nextAction}
                        onBlur={(e) => void patch(c, { nextAction: e.target.value })}
                        placeholder="다음에 할 일 (예: 재무제표 받기)"
                        className={inputCls}
                      />
                      <input
                        type="date"
                        aria-label={`${c.companyName} 마지막 연락일`}
                        defaultValue={data.lastContactedAt}
                        onBlur={(e) => void patch(c, { lastContactedAt: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    {data.memo && <p className="t-meta break-keep text-slate-500">{data.memo}</p>}
                  </div>
                </Surface>
              </li>
            )
          })}
        </ul>
      </Section>

      <p className="t-meta break-keep text-slate-400">
        진단 화면에서 결과를 업체에 붙이면 1순위 기관과 점수가 여기에 함께 뜹니다.
      </p>
    </div>
  )
}
