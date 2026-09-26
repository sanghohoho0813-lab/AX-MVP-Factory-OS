import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useDismissable } from '../../lib/useDismissable'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { WorkspaceScope } from '../workspace/WorkspaceScope'
import { todayLocalDate } from '../../lib/appClock'
import type { OpsAlert } from '../../types/clientOps'

/**
 * 헤더 알림 종 — 데모 상수가 아니라 실제 경고(마감·서류·수금)와 열린 고객 이벤트 수를 보여준다.
 */
function BellContent({ workspaceId }: { workspaceId: string | null }) {
  const { open, setOpen, containerRef } = useDismissable<HTMLDivElement>()
  const version = useStoreVersion()
  const [alerts, setAlerts] = useState<OpsAlert[]>([])
  /** 종 목록에 보일 상담신청 한 줄 (누구 · 종류) — 읽을 때 한 번 만든다 */
  const [events, setEvents] = useState<{ id: string; text: string }[]>([])

  useEffect(() => {
    let alive = true
    void (async () => {
      // D-112: 서비스는 종이 처음 셀 때 불러온다 — 첫 파일에서 뺀다
      try {
        const [{ listClients }, { buildAllAlerts }] = await Promise.all([
          import('../../services/clientOpsService'),
          import('../../services/clientOpsAlerts'),
        ])
        const clients = await listClients(workspaceId)
        if (alive) setAlerts(buildAllAlerts(clients, todayLocalDate()))
      } catch {
        if (alive) setAlerts([])
      }
      try {
        const { EVENT_TYPE_LABEL, eventSummary, isOpenEvent, listEvents } = await import('../../services/customerBridgeService')
        const ev = await listEvents(workspaceId)
        // D-105: 예전에는 'customer request created' 처럼 영문 코드가 그대로 보였다 — 상담신청 화면과 같은 한글 이름으로
        if (alive) setEvents(ev.filter(isOpenEvent).map((e) => ({ id: e.id, text: `${eventSummary(e).who} · ${EVENT_TYPE_LABEL[e.eventType] ?? '고객 활동'}` })))
      } catch {
        if (alive) setEvents([])
      }
    })()
    return () => { alive = false }
  }, [workspaceId, version])

  const critical = useMemo(() => alerts.filter((a) => a.severity === 'critical'), [alerts])
  const count = critical.length + events.length

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={count > 0 ? `챙길 것 ${count}건` : '챙길 것 없음'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-10 cursor-pointer items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        <Bell aria-hidden="true" className="size-5" />
        {count > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[0.8125rem] font-semibold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-1.5 w-80 max-w-[calc(100vw-2rem)] rounded-(--radius-card) border border-slate-200 bg-white shadow-(--shadow-overlay)">
          <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">지금 챙길 것</p>
          {count === 0 ? (
            <p className="px-4 py-4 text-[0.9rem] text-slate-500">급한 경고와 새 상담신청이 없습니다.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {events.slice(0, 4).map((e) => (
                <li key={e.id} className="border-b border-slate-50">
                  <Link to="/ops/inbox" onClick={() => setOpen(false)} className="block px-4 py-2.5 hover:bg-slate-50">
                    <span className="block text-[0.85rem] font-semibold text-slate-700">상담신청</span>
                    <span className="block truncate text-[0.9rem] text-slate-700">
                      {e.text}
                    </span>
                  </Link>
                </li>
              ))}
              {critical.slice(0, 6).map((a) => (
                <li key={a.id} className="border-b border-slate-50">
                  <Link to={`/ops/clients/${a.clientId}`} onClick={() => setOpen(false)} className="block px-4 py-2.5 hover:bg-slate-50">
                    <span className="block text-[0.85rem] font-semibold text-danger-700">{a.clientName}</span>
                    <span className="block truncate text-[0.9rem] text-slate-700">{a.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link to="/" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-2.5 text-[0.9rem] font-medium text-brand-700 hover:bg-slate-50">
            오늘 화면에서 모두 보기
          </Link>
        </div>
      )}
    </div>
  )
}

export function SignalBell() {
  return <WorkspaceScope>{(ctx) => <BellContent workspaceId={ctx.workspaceId} />}</WorkspaceScope>
}
