/**
 * 대시보드에 얹는 정책자금 칸 (D-91).
 *
 * 위쪽(공통)은 업체 기록을 본다. 여기는 이 모듈이 쌓은 **상담 상태**를 본다 —
 * 단계별 몇 곳인지, 오래 연락 못 한 곳은 어디인지.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { Badge, MetricTile, Section, Surface } from '../../../components/ui/primitives'
import { useToolClient } from '../../shared/toolClientContext'
import { useModuleBucket } from '../../shared/useModuleBucket'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { daysSinceContact, isOpenStage, summarizeConsults, type ConsultData } from '../lib/consultRecord'

export function PolicyDashboardExtra() {
  const { loadClients } = useToolClient()
  const consults = useModuleBucket<ConsultData>('policy-funding', 'consults')
  const [clients, setClients] = useState<ClientOpsRecord[]>([])

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
  const sum = useMemo(
    () => summarizeConsults((consults.rows ?? []).map((r) => ({ stage: r.data.stage, lastContactedAt: r.data.lastContactedAt })), today),
    [consults.rows, today],
  )

  const stale = useMemo(
    () =>
      (consults.rows ?? [])
        .filter((r) => isOpenStage(r.data.stage))
        .map((r) => ({
          clientId: r.clientId,
          name: clients.find((c) => c.id === r.clientId)?.companyName ?? '업체',
          stage: r.data.stage,
          nextAction: r.data.nextAction,
          days: daysSinceContact(r.data.lastContactedAt, today),
        }))
        .filter((r) => r.days === null || r.days >= 14)
        .sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999)),
    [consults.rows, clients, today],
  )

  if (consults.rows === null) return null

  if (consults.rows.length === 0) {
    return (
      <Surface>
        <p className="t-sub break-keep text-slate-600">
          아직 상담으로 저장한 업체가 없습니다.{' '}
          <Link to="/tools/policy-funding/diagnosis" className="font-bold text-brand-700 hover:underline">
            진단하기
          </Link>{' '}
          에서 업체를 물고 진단한 뒤 <b>이 업체 상담으로 저장</b> 을 누르면 여기에 단계별로 모입니다.
        </p>
      </Surface>
    )
  }

  return (
    <div className="flex flex-col gap-4" data-testid="pf-dashboard-extra">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MetricTile label="상담 중" value={`${sum.open}곳`} tone={sum.open > 0 ? 'brand' : 'neutral'} />
        <MetricTile label="승인" value={`${sum.approved}곳`} tone={sum.approved > 0 ? 'success' : 'neutral'} />
        <MetricTile label="보류·실패" value={`${sum.failed}곳`} tone={sum.failed > 0 ? 'danger' : 'neutral'} />
        <MetricTile label="2주 넘게 연락 없음" value={`${sum.stale}곳`} tone={sum.stale > 0 ? 'warning' : 'neutral'} />
      </div>

      {stale.length > 0 && (
        <Section title="먼저 연락할 곳" count={stale.length}>
          <ul className="flex flex-col gap-2" data-testid="pf-stale">
            {stale.slice(0, 6).map((s) => (
              <li key={s.clientId}>
                <Surface as="div" edge="warning" showEdge padded={false}>
                  <Link to={`/tools/policy-funding/customers`} className="tap flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                    <Clock aria-hidden="true" className="size-4 shrink-0 text-amber-500" />
                    <span className="t-sub font-bold text-slate-900">{s.name}</span>
                    <Badge tone="neutral">{s.stage}</Badge>
                    <span className="t-sub min-w-0 flex-1 break-keep text-slate-600">{s.nextAction || '다음 액션이 비어 있습니다'}</span>
                    <span className="t-meta text-amber-700">{s.days === null ? '연락 기록 없음' : `${s.days}일 전`}</span>
                  </Link>
                </Surface>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
