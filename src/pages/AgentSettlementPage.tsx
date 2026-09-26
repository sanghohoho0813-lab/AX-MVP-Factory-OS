/**
 * 영업자 정산 — 누구한테 지금 얼마를 줘야 하는가 (D-78).
 *
 * 수금 항목마다 적어 둔 영업자 수수료(D-73)·이름(D-75)을 사람별로 모은다.
 * 돈이 나가는 순서는 하나다: 고객이 입금한다 → 영업자에게 준다.
 * 그래서 '지금 줄 돈' 은 고객 입금이 확인된 항목에서만 세고, 아직 안 들어온 몫은 따로 둔다.
 * 지급 완료는 여기서 바로 체크한다 — 업체 상세까지 들어가지 않아도 된다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Handshake } from 'lucide-react'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { useToast } from '../components/ui/toastContext'
import { MetricTile, ScreenTitle } from '../components/ui/primitives'
import { Panel } from '../components/ui/Panel'
import { Button } from '../components/ui/Button'
import { listClients, saveClient, withFee } from '../services/clientOpsService'
import { agentLedger, agentLedgerTotals, type AgentLedgerItem } from '../services/feeMath'
import { formatKrw, krwTile } from '../lib/format'
import { todayLocalDate } from '../lib/appClock'
import type { ClientOpsRecord } from '../types/clientOps'

function SettlementContent({ workspaceId }: { workspaceId: string | null }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const today = todayLocalDate()
  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setRecords(await listClients(workspaceId))
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '업체 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => agentLedger(records), [records])
  const totals = useMemo(() => agentLedgerTotals(rows), [rows])

  /** 지급 완료 체크 — 업체 기록을 찾아 그 항목만 고치고 저장한다 */
  const togglePaid = async (item: AgentLedgerItem, paid: boolean) => {
    const rec = records.find((r) => r.id === item.clientId)
    if (!rec) return
    const next = withFee(rec, item.feeId, { agentPaidAt: paid ? today : null })
    setRecords((list) => list.map((r) => (r.id === next.id ? next : r)))
    try {
      const saved = await saveClient(next)
      setRecords((list) => list.map((r) => (r.id === saved.id ? saved : r)))
      showToast(paid ? '지급 완료로 표시했습니다.' : '지급 완료를 취소했습니다.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
      void load()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ScreenTitle
        title="영업자 정산"
        sub={`${today} · 영업자 ${totals.agents}명`}
        actions={
          <Button variant="secondary" onClick={() => navigate('/ops/clients')}>
            고객 관리로
          </Button>
        }
      />

      {error && (
        <p role="alert" className="rounded-(--radius-control) border border-danger-200 bg-danger-50 px-4 py-3 text-[0.95rem] text-danger-700">
          {error}
        </p>
      )}

      {/* 위 네 칸 — 지금 줄 돈이 첫째. 나머지는 그 돈이 어디서 왔는지 설명한다 */}
      <section aria-label="정산 요약" className="ax-stagger grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <MetricTile
          label="지금 줄 돈"
          value={krwTile(totals.payable)}
          tone={totals.payable > 0 ? 'warning' : 'neutral'}
          hint="고객이 입금했고 아직 안 준 것"
        />
        <MetricTile label="고객 입금 전" value={krwTile(totals.waiting)} hint="고객이 주면 그때 줄 돈" />
        <MetricTile label="이미 준 돈" value={krwTile(totals.paid)} />
        <MetricTile label="수수료 전체" value={krwTile(totals.total)} hint={`영업자 ${totals.agents}명`} />
      </section>

      {loading ? (
        <p className="t-sub text-slate-500">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-12 text-center">
          <Handshake aria-hidden="true" className="mx-auto size-9 text-brand-400" />
          <p className="mt-3 text-[1.2rem] font-bold text-slate-900">영업자 수수료를 적은 항목이 아직 없습니다</p>
          <p className="mx-auto mt-2 max-w-xl text-[1rem] break-keep text-slate-600">
            업체 상세의 수금 탭에서 항목마다 <strong className="font-semibold">영업자 수수료</strong>와{' '}
            <strong className="font-semibold">이름</strong>을 적으면 여기에 사람별로 모입니다.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => (
            <li key={row.name}>
              <Panel flush>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-100 px-5 py-4">
                  <h2 className="t-section text-slate-900">{row.name}</h2>
                  <p className="t-sub flex flex-wrap items-baseline gap-x-3 text-slate-500">
                    <span className={row.payable > 0 ? 'font-bold text-warning-700' : ''}>
                      지금 줄 돈 <span className="tabular-nums">{formatKrw(row.payable)}</span>
                    </span>
                    {row.waiting > 0 && (
                      <span>
                        입금 전 <span className="tabular-nums">{formatKrw(row.waiting)}</span>
                      </span>
                    )}
                    {row.paid > 0 && (
                      <span>
                        준 돈 <span className="tabular-nums">{formatKrw(row.paid)}</span>
                      </span>
                    )}
                  </p>
                </div>
                <ul className="divide-y divide-slate-100">
                  {row.items.map((item) => {
                    const state = item.agentPaidAt ? 'paid' : item.receivedAt ? 'payable' : 'waiting'
                    return (
                      <li key={item.feeId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3">
                        <label className="flex shrink-0 items-center gap-2">
                          <input
                            type="checkbox"
                            aria-label={`${item.clientName} ${item.label} 영업자 지급 완료`}
                            checked={state === 'paid'}
                            disabled={state === 'waiting'}
                            onChange={(e) => void togglePaid(item, e.target.checked)}
                            className="size-5 accent-brand-600 disabled:opacity-40"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => navigate(`/ops/clients/${item.clientId}?tab=fees`)}
                          className="inline-flex min-w-0 items-center gap-1 text-left font-semibold text-slate-900 hover:text-brand-700 hover:underline"
                        >
                          <span className="truncate">{item.clientName}</span>
                          <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 text-slate-400" />
                        </button>
                        <span className="t-sub text-slate-600">{item.label}</span>
                        <strong className="ml-auto text-[1rem] font-semibold text-slate-900 tabular-nums">{formatKrw(item.agentFee)}</strong>
                        {state === 'paid' ? (
                          <span className="rounded-full border border-success-200 bg-success-50 px-2 py-0.5 t-meta font-semibold text-success-700">
                            지급 {item.agentPaidAt}
                          </span>
                        ) : state === 'payable' ? (
                          <span className="rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 t-meta font-bold text-warning-700">
                            줄 돈 · 고객 입금 {item.receivedAt}
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 t-meta text-slate-500">
                            고객 입금 전{item.amount !== null ? ` · 청구 ${formatKrw(item.amount)}` : ''}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AgentSettlementPage() {
  return <WorkspaceScope>{(ctx) => <SettlementContent workspaceId={ctx.workspaceId} />}</WorkspaceScope>
}
