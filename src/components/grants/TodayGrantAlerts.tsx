/**
 * 오늘 — 지원사업 알림 (D-141). 7일 안에 끝나는 공고 중 조건 맞는 업체에 아직 안 알린 것만.
 * 누르면 그 공고 창(맞는 업체 · 카톡 문구)으로 간다.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useGrantData } from './useGrants'
import { grantClients, urgentGrantAlerts } from '../../services/grants/grantView'
import type { ClientOpsRecord } from '../../types/clientOps'

export function TodayGrantAlerts({ workspaceId, clients, today }: { workspaceId: string | null; clients: ClientOpsRecord[]; today: string }) {
  const { notices, sent } = useGrantData(workspaceId)
  const list = useMemo(() => urgentGrantAlerts(notices, grantClients(clients, today), sent, today), [notices, sent, clients, today])
  if (list.length === 0) return null
  return (
    <div data-testid="today-grants" className="flex flex-col gap-2">
      <p className="t-sub font-semibold text-brand-700">지원사업 — 맞는 업체에 알릴 공고 {list.length}건</p>
      <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-brand-200 bg-white">
        {list.map((a) => (
          <li key={a.notice.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
            <span className="t-sub w-20 shrink-0 font-semibold whitespace-nowrap text-brand-700">{a.deadlineLabel}</span>
            <Link to={`/grants?open=${a.notice.id}`} className="tap t-body min-w-0 flex-[1_1_12rem] break-keep font-bold text-slate-900 hover:text-brand-700 hover:underline">
              {a.notice.title}
            </Link>
            <span className="t-sub ml-auto shrink-0 break-keep text-slate-600">
              {a.pending.slice(0, 2).map((x) => x.client.record.companyName).join(' · ')}
              {a.pending.length > 2 ? ` 외 ${a.pending.length - 2}곳` : ''} 아직 안 알림
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
