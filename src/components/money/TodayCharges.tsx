/**
 * 오늘 — 3일 안에 결제될 정기 결제 (D-142). 없으면 아무것도 안 그린다.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listSubscriptions, loadSettings } from '../../services/finance/financeStore'
import { DEFAULT_SETTINGS, moneyText, toKrw, upcomingCharges, type FinanceSettings, type Subscription } from '../../services/finance/financeCore'

export function TodayCharges({ workspaceId, today }: { workspaceId: string | null; today: string }) {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [settings, setSettings] = useState<FinanceSettings>(DEFAULT_SETTINGS)
  useEffect(() => {
    void Promise.all([listSubscriptions(workspaceId), loadSettings(workspaceId)])
      .then(([s, st]) => {
        setSubs(s)
        setSettings(st)
      })
      .catch(() => undefined)
  }, [workspaceId])
  const list = upcomingCharges(subs, today, 3)
  if (list.length === 0) return null
  const total = list.reduce((s, x) => s + toKrw(x.sub.amount, x.sub.currency, settings), 0)
  return (
    <div data-testid="today-charges" className="flex flex-col gap-2">
      <p className="t-sub font-semibold text-slate-700">
        3일 안 결제 {list.length}건 · 약 {total.toLocaleString('ko-KR')}원
      </p>
      <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200 bg-white">
        {list.map((x) => (
          <li key={x.sub.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
            <span className={`t-sub w-20 shrink-0 font-semibold whitespace-nowrap ${x.inDays === 0 ? 'text-danger-700' : 'text-brand-700'}`}>{x.inDays === 0 ? '오늘' : x.inDays === 1 ? '내일' : `${x.inDays}일 뒤`}</span>
            <Link to="/money?tab=subs" className="tap t-body inline-flex min-w-0 flex-1 items-center font-bold text-slate-900 hover:text-brand-700 hover:underline">
              {x.sub.name}
            </Link>
            <span className="t-sub ml-auto shrink-0 text-slate-600 tabular-nums">{moneyText(x.sub.amount, x.sub.currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
