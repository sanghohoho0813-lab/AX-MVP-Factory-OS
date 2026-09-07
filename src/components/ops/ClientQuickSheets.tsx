/**
 * 고객 목록에서 바로 고치는 두 개의 시트.
 *
 *   상태 시트 — 업무 하나의 진행 상태를 그 자리에서 바꾼다.
 *   수금 시트 — 그 업체의 수금 항목을 그 자리에서 고치고 새로 넣는다.
 *
 * 둘 다 업체 기록을 실제로 저장한다. 목록에서 바꾼 값과 업체 상세에서 보는 값이
 * 같아야 하므로, 저장 함수(withService·withFee …)를 상세 화면과 똑같이 쓴다.
 */

import { useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import type { ClientOpsRecord, FeeKind, ServiceKey, ServiceStatus } from '../../types/clientOps'
import {
  FEE_KIND_LABEL,
  FEE_KIND_ORDER,
  SERVICES,
  SERVICE_STATUS_LABEL,
  SERVICE_STATUS_ORDER,
} from '../../content/clientOpsCatalog'
import { withFee, withNewFee, withoutFee, withService } from '../../services/clientOpsService'
import { daysLeftFrom, dueText } from '../../services/clientOpsAlerts'
import { formatKrw } from '../../lib/format'
import { BottomSheet } from '../ui/primitives'
import { Button } from '../ui/Button'
import { parseAmount } from './opsControls'

/* ------------------------------------------------------------------ */
/* 상태 바꾸기                                                          */
/* ------------------------------------------------------------------ */

/** 상태 한 줄의 설명 — 무엇을 고르는지 헷갈리지 않게 */
const STATUS_HINT: Record<ServiceStatus, string> = {
  not_started: '아직 손대지 않았습니다',
  in_progress: '지금 하고 있습니다',
  waiting_client: '고객 회신을 기다립니다',
  done: '끝났습니다',
  on_hold: '지금은 멈춰 둡니다 (나중에 다시)',
  not_applicable: '이 회사에는 해당하지 않습니다 (진행률에서 뺍니다)',
}

export function ServiceStatusSheet({
  record,
  serviceKey,
  onSave,
  onOpenClient,
  onClose,
}: {
  record: ClientOpsRecord
  serviceKey: ServiceKey
  onSave: (next: ClientOpsRecord) => void
  onOpenClient: () => void
  onClose: () => void
}) {
  const meta = SERVICES.find((s) => s.key === serviceKey)
  const state = record.services[serviceKey]
  if (!meta) return null

  const pick = (status: ServiceStatus) => {
    if (status !== state.status) onSave(withService(record, serviceKey, { status }))
    onClose()
  }

  return (
    <BottomSheet title={`${record.companyName} · ${meta.label}`} onClose={onClose}>
      <div className="flex flex-col gap-1">
        {SERVICE_STATUS_ORDER.map((s) => {
          const active = s === state.status
          return (
            <button
              key={s}
              type="button"
              onClick={() => pick(s)}
              className={`flex items-center gap-3 rounded-(--radius-control) border px-3 py-3 text-left ${
                active ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span
                  className={`t-body block font-semibold ${
                    s === 'not_applicable' ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-900'
                  }`}
                >
                  {SERVICE_STATUS_LABEL[s]}
                </span>
                <span className="t-meta block break-keep text-slate-500">{STATUS_HINT[s]}</span>
              </span>
              {active && <Check aria-hidden="true" className="size-4 shrink-0 text-brand-600" />}
            </button>
          )
        })}
      </div>

      <Button variant="secondary" className="mt-3 w-full" onClick={onOpenClient}>
        이 업무 자세히 보기
      </Button>
    </BottomSheet>
  )
}

/* ------------------------------------------------------------------ */
/* 수금 고치기                                                          */
/* ------------------------------------------------------------------ */

export function ClientMoneySheet({
  record,
  today,
  onSave,
  onOpenClient,
  onClose,
}: {
  record: ClientOpsRecord
  today: string
  onSave: (next: ClientOpsRecord) => void
  onOpenClient: () => void
  onClose: () => void
}) {
  const [kind, setKind] = useState<FeeKind>('deposit')
  const [amount, setAmount] = useState(0)
  const [due, setDue] = useState('')

  const unpaid = record.fees.filter((f) => f.receivedAt === null).reduce((n, f) => n + (f.amount ?? 0), 0)

  const add = () => {
    onSave(withNewFee(record, { kind, label: FEE_KIND_LABEL[kind], amount: amount > 0 ? amount : null, dueDate: due }))
    setAmount(0)
    setDue('')
  }

  return (
    <BottomSheet title={`${record.companyName} · 수금`} onClose={onClose}>
      <p className="t-sub text-slate-600">
        아직 못 받은 돈 <strong className="font-semibold text-slate-900">{formatKrw(unpaid)}</strong>
      </p>

      {record.fees.length === 0 ? (
        <p className="t-sub mt-3 rounded-(--radius-control) border border-dashed border-slate-300 px-4 py-5 text-center text-slate-500">
          아직 넣은 수금 항목이 없습니다.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {record.fees.map((fee) => {
            const left = fee.dueDate ? daysLeftFrom(today, fee.dueDate) : null
            const overdue = fee.receivedAt === null && left !== null && left < 0
            return (
              <li
                key={fee.id}
                className={`rounded-(--radius-control) border px-3 py-2.5 ${
                  overdue ? 'border-danger-200 bg-danger-50/50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <label className="flex shrink-0 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={fee.receivedAt !== null}
                      onChange={(e) => onSave(withFee(record, fee.id, { receivedAt: e.target.checked ? today : null }))}
                      className="size-5 accent-brand-600"
                    />
                    <span className="sr-only">입금 완료</span>
                  </label>
                  <span className="t-body min-w-0 flex-1 truncate font-semibold text-slate-900">{fee.label}</span>
                  {overdue && <span className="t-meta shrink-0 font-bold text-danger-700">{dueText(left)}</span>}
                  {fee.receivedAt && <span className="t-meta shrink-0 text-success-700">{fee.receivedAt} 입금</span>}
                  <button
                    type="button"
                    aria-label={`${fee.label} 삭제`}
                    onClick={() => onSave(withoutFee(record, fee.id))}
                    className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-danger-600"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2 pl-[1.9rem]">
                  <input
                    type="date"
                    aria-label={`${fee.label} 받기로 한 날`}
                    value={fee.dueDate}
                    onChange={(e) => onSave(withFee(record, fee.id, { dueDate: e.target.value }))}
                    className="min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 px-2 py-2 text-[0.92rem]"
                  />
                  <input
                    aria-label={`${fee.label} 금액`}
                    value={fee.amount === null ? '' : fee.amount.toLocaleString('ko-KR')}
                    onChange={(e) => {
                      const n = parseAmount(e.target.value)
                      onSave(withFee(record, fee.id, { amount: n > 0 ? n : null }))
                    }}
                    inputMode="numeric"
                    placeholder="미정"
                    className="w-24 shrink-0 rounded-(--radius-control) border border-slate-300 px-2 py-2 text-right text-[1rem] font-semibold tabular-nums"
                  />
                  <button
                    type="button"
                    aria-label={`${fee.label} 금액에 100만원 더하기`}
                    onClick={() => onSave(withFee(record, fee.id, { amount: (fee.amount ?? 0) + 1_000_000 }))}
                    className="shrink-0 rounded-(--radius-control) border border-slate-200 px-2 py-2 text-[0.85rem] font-semibold whitespace-nowrap text-slate-600 hover:border-brand-300"
                  >
                    +100만
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* 새 항목 */}
      <div className="mt-3 rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3">
        <p className="t-sub font-semibold text-slate-700">수금 항목 넣기</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            aria-label="수금 종류"
            value={kind}
            onChange={(e) => setKind(e.target.value as FeeKind)}
            className="rounded-(--radius-control) border border-slate-300 bg-white px-2 py-2 text-[0.95rem]"
          >
            {FEE_KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {FEE_KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <input
            aria-label="금액"
            value={amount === 0 ? '' : amount.toLocaleString('ko-KR')}
            onChange={(e) => setAmount(parseAmount(e.target.value))}
            inputMode="numeric"
            placeholder="금액"
            className="w-28 rounded-(--radius-control) border border-slate-300 px-2 py-2 text-right text-[1rem] font-semibold tabular-nums"
          />
          <input
            type="date"
            aria-label="받기로 한 날"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 px-2 py-2 text-[0.92rem]"
          />
        </div>
        <Button variant="primary" size="sm" className="mt-2 w-full" onClick={add}>
          <Plus aria-hidden="true" className="size-3.5" />
          넣기
        </Button>
      </div>

      <Button variant="secondary" className="mt-3 w-full" onClick={onOpenClient}>
        수금 탭에서 자세히 보기
      </Button>
    </BottomSheet>
  )
}
