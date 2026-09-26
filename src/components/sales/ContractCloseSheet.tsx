/**
 * 계약 완료 확인 시트 (D-122) — 어디서 '계약 완료' 를 누르든 이 한 장.
 *
 * 영업 보드 · 업체 상세(영업 · 계약 단계) · 상품·제안의 '계약 완료로' 가 모두 이 시트를 연다.
 * 이미 아는 것(제안 상품 · 예상 수임료 · 소개한 사람 · 계약 경로 · 월납)으로 채워 두고, 사람이 확인해 누른다.
 * 누르면 계약 정보 · 수금 항목(받을 날 · 영업자) · 보험 · 업무 시작까지 한 번에 저장된다(salesContract).
 */
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { BottomSheet } from '../ui/primitives'
import { Button } from '../ui/Button'
import { formatKrw, wonOf } from '../../lib/format'
import { addDaysLocal } from '../../services/clientOpsNextAction'
import type { ContractCloseDraft } from '../../services/salesContract'
import { BUILTIN_SERVICES } from '../../content/clientOpsCatalog'
import { CONTRACT_KIND_LABEL, CONTRACT_KIND_ORDER, type ClientOpsRecord } from '../../types/clientOps'

const inputCls = 'mt-1 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2.5 text-[1rem] text-slate-900 focus:border-brand-500 focus:outline-none'
const chip = (on: boolean) =>
  `tap t-sub rounded-full border px-3 py-1.5 font-semibold ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300'}`

const won = (n: number | null) => (n === null || n === 0 ? '' : n.toLocaleString('ko-KR'))

export function ContractCloseSheet({
  record,
  draft: initial,
  onSubmit,
  onStageOnly,
  onClose,
}: {
  record: ClientOpsRecord
  draft: ContractCloseDraft
  /** 저장 — 됐으면 true(시트를 닫는다) */
  onSubmit: (d: ContractCloseDraft) => Promise<boolean>
  /** 주면 '단계만 옮기기' 단추가 붙는다(수금 · 계약 정보는 나중에) */
  onStageOnly?: () => Promise<boolean>
  onClose: () => void
}) {
  const [d, setD] = useState<ContractCloseDraft>(initial)
  const [busy, setBusy] = useState(false)
  const total = d.lines.reduce((s, l) => s + (l.amount ?? 0), 0)
  const wantsIns = d.kind === 'insurance' || d.kind === 'mixed'
  const agentTotal = d.agentRatePct ? Math.round((total * d.agentRatePct) / 100) : 0
  const startable = BUILTIN_SERVICES.filter((s) => record.services[s.key]?.status === 'not_started')

  const run = async (fn: () => Promise<boolean>) => {
    if (busy) return
    setBusy(true)
    const ok = await fn()
    setBusy(false)
    if (ok) onClose()
  }
  const setLine = (i: number, patch: Partial<ContractCloseDraft['lines'][number]>) =>
    setD((cur) => ({ ...cur, lines: cur.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }))

  return (
    <BottomSheet
      title={`${record.companyName} — 계약 완료`}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>
            취소
          </Button>
          {onStageOnly && (
            <Button variant="secondary" onClick={() => void run(onStageOnly)} disabled={busy} data-testid="contract-close-stage-only">
              단계만 옮기기
            </Button>
          )}
          <Button variant="primary" onClick={() => void run(() => onSubmit(d))} disabled={busy} data-testid="contract-close-save">
            {busy ? '저장 중…' : '계약 완료로 저장'}
          </Button>
        </div>
      }
    >
      <div data-testid="contract-close" className="flex flex-col gap-4">
        <p className="t-sub break-keep text-slate-600">
          아는 것으로 채워 두었습니다. 확인하고 저장하면 계약 정보 · 수금 항목 · 영업자 수수료 · 업무 시작까지 한 번에 들어갑니다.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <label className="t-sub font-medium text-slate-700">
            계약일
            <input type="date" value={d.signedAt} onChange={(e) => setD({ ...d, signedAt: e.target.value })} className={inputCls} />
          </label>
          <label className="t-sub font-medium text-slate-700">
            받을 날
            <input type="date" aria-label="받을 날" value={d.dueDate} onChange={(e) => setD({ ...d, dueDate: e.target.value })} className={inputCls} />
          </label>
        </div>
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {[7, 14, 30].map((n) => (
            <button key={n} type="button" onClick={() => setD({ ...d, dueDate: addDaysLocal(d.signedAt || d.dueDate, n) })} className={chip(false)}>
              계약 {n}일 뒤
            </button>
          ))}
        </div>

        <fieldset>
          <legend className="t-sub font-medium text-slate-700">계약 방식</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {CONTRACT_KIND_ORDER.map((k) => (
              <button key={k} type="button" aria-pressed={d.kind === k} onClick={() => setD({ ...d, kind: d.kind === k ? '' : k })} className={chip(d.kind === k)}>
                {CONTRACT_KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="t-sub font-medium text-slate-700">받을 돈 (수금 항목)</legend>
          {d.lines.map((l, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <label className="t-meta min-w-0 flex-[1_1_10rem] text-slate-500">
                무엇
                <input value={l.label} aria-label={`수금 항목 ${i + 1} 이름`} onChange={(e) => setLine(i, { label: e.target.value })} className={inputCls} />
              </label>
              <label className="t-meta w-36 text-slate-500">
                금액(원)
                <input
                  value={won(l.amount)}
                  inputMode="numeric"
                  aria-label={`수금 항목 ${i + 1} 금액`}
                  onChange={(e) => setLine(i, { amount: wonOf(e.target.value) })}
                  className={`${inputCls} text-right tabular-nums`}
                />
              </label>
              {d.lines.length > 1 && (
                <button type="button" onClick={() => setD({ ...d, lines: d.lines.filter((_, j) => j !== i) })} className="tap mb-1 inline-flex items-center gap-1 rounded-(--radius-control) px-2 text-[0.9rem] text-slate-500 hover:bg-slate-100">
                  <X aria-hidden="true" className="size-4" /> 빼기
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setD({ ...d, lines: [...d.lines, { label: '', amount: null }] })} className="tap t-sub inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
              <Plus aria-hidden="true" className="size-4" /> 항목 더하기
            </button>
            <span className="t-sub font-semibold text-slate-800 tabular-nums">합계 {formatKrw(total)}</span>
          </div>
        </fieldset>

        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
          <label className="t-sub font-medium text-slate-700">
            영업자(소개한 사람)
            <input value={d.agentName} onChange={(e) => setD({ ...d, agentName: e.target.value })} placeholder="없으면 비워 두세요" className={inputCls} />
          </label>
          <label className="t-sub font-medium text-slate-700">
            수수료 %
            <input
              value={d.agentRatePct === null ? '' : String(d.agentRatePct)}
              inputMode="decimal"
              aria-label="영업자 수수료율"
              onChange={(e) => {
                const n = parseFloat(e.target.value.replace(/[^0-9.]/g, ''))
                setD({ ...d, agentRatePct: Number.isFinite(n) ? Math.min(100, n) : null })
              }}
              className={`${inputCls} text-right`}
            />
          </label>
        </div>
        {agentTotal > 0 && d.agentName.trim() !== '' && (
          <p className="t-meta -mt-2 text-slate-500">
            {d.agentName} 몫 {formatKrw(agentTotal)} — 고객이 입금하면 영업자 정산의 '지금 줄 돈' 으로 갑니다.
          </p>
        )}

        {wantsIns && (
          <label className="t-sub font-medium text-slate-700">
            월납 보험료(원)
            <input
              value={won(d.monthlyPremium)}
              inputMode="numeric"
              aria-label="월납 보험료"
              onChange={(e) => setD({ ...d, monthlyPremium: wonOf(e.target.value) })}
              className={`${inputCls} text-right tabular-nums`}
            />
          </label>
        )}

        {startable.length > 0 && (
          <fieldset>
            <legend className="t-sub font-medium text-slate-700">시작할 업무</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {startable.map((s) => {
                const on = d.services.includes(s.key)
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setD({ ...d, services: on ? d.services.filter((k) => k !== s.key) : [...d.services, s.key] })}
                    className={chip(on)}
                  >
                    {s.shortLabel}
                  </button>
                )
              })}
            </div>
            <p className="t-meta mt-1 text-slate-500">고른 업무는 '진행 중' 으로 시작합니다.</p>
          </fieldset>
        )}
      </div>
    </BottomSheet>
  )
}
