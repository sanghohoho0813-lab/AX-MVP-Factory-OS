import { useState } from 'react'
import { Landmark, Plus, Trash2 } from 'lucide-react'
import type { ClientOpsRecord, FundingStatus } from '../../types/clientOps'
import { FUNDING_STATUS_LABEL } from '../../content/clientOpsCatalog'
import { daysLeftFrom, dueText } from '../../services/clientOpsAlerts'
import { formatKrw } from '../../lib/format'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'

const FUNDING_STATUS_ORDER: FundingStatus[] = [
  'watching',
  'preparing',
  'submitted',
  'reviewing',
  'selected',
  'rejected',
  'given_up',
]

const STATUS_CLASS: Record<FundingStatus, string> = {
  watching: 'border-slate-200 bg-slate-50 text-slate-600',
  preparing: 'border-cat-doc-200 bg-cat-doc-50 text-cat-doc-700',
  submitted: 'border-cat-client-200 bg-cat-client-50 text-cat-client-700',
  reviewing: 'border-cat-plan-200 bg-cat-plan-50 text-cat-plan-700',
  selected: 'border-cat-money-200 bg-cat-money-50 text-cat-money-700',
  rejected: 'border-cat-fund-200 bg-cat-fund-50 text-cat-fund-700',
  given_up: 'border-slate-200 bg-slate-100 text-slate-500',
}

const inputCls =
  'rounded-(--radius-control) border border-slate-300 px-2.5 py-2 text-[0.95rem] focus:border-brand-500 focus:outline-none'

/** 정책자금·정부지원금은 공고마다 반복 신청하므로 건별로 관리한다 */
export function FundingSection({
  record,
  today,
  onChange,
  onAdd,
  onRemove,
}: {
  record: ClientOpsRecord
  today: string
  onChange: (id: string, patch: Record<string, unknown>) => void
  onAdd: (input: Record<string, unknown>) => void
  onRemove: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ programName: '', institution: '', applyDueDate: '', requestedAmount: '' })

  const apps = [...record.fundingApplications].sort((a, b) => {
    const rank = (s: FundingStatus) => (s === 'selected' || s === 'rejected' || s === 'given_up' ? 1 : 0)
    if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status)
    return (a.applyDueDate || '9999').localeCompare(b.applyDueDate || '9999')
  })

  const selectedTotal = apps
    .filter((a) => a.status === 'selected')
    .reduce((s, a) => s + (a.approvedAmount ?? 0), 0)

  const submit = () => {
    if (form.programName.trim() === '') return
    const n = Number(form.requestedAmount.replace(/[^0-9]/g, ''))
    onAdd({
      programName: form.programName.trim(),
      institution: form.institution.trim(),
      applyDueDate: form.applyDueDate,
      requestedAmount: Number.isFinite(n) && n > 0 ? n : null,
      status: 'watching',
    })
    setForm({ programName: '', institution: '', applyDueDate: '', requestedAmount: '' })
    setOpen(false)
  }

  return (
    <section aria-labelledby="funding" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="funding" className="flex items-center gap-2 text-[1.3rem] font-bold text-slate-900">
          <Landmark aria-hidden="true" className="size-5 text-cat-fund-500" />
          정책자금 · 정부지원금 신청
        </h2>
        <p className="text-[0.95rem] text-slate-600">
          공고마다 건을 추가하세요.
          {selectedTotal > 0 && (
            <>
              {' '}
              선정 확정 <strong className="text-cat-money-700">{formatKrw(selectedTotal)}</strong>
            </>
          )}
        </p>
      </div>

      <Panel flush>
        {apps.length === 0 ? (
          <p className="px-5 py-6 text-[0.95rem] text-slate-500">
            아직 등록한 신청 건이 없습니다. 공고를 발견하면 마감일과 함께 추가해 두세요. 마감이 다가오면 알려드립니다.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {apps.map((a) => {
              const left = a.applyDueDate ? daysLeftFrom(today, a.applyDueDate) : null
              const openStage = a.status === 'watching' || a.status === 'preparing'
              const overdue = openStage && left !== null && left < 0
              const soon = openStage && left !== null && left >= 0 && left <= 7
              return (
                <li
                  key={a.id}
                  className={`flex flex-col gap-2.5 px-5 py-4 ${overdue ? 'bg-danger-50/40' : soon ? 'bg-warning-50/40' : ''}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[1.05rem] font-bold break-keep text-slate-900">
                          {a.programName || '(공고명 없음)'}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[0.8rem] font-semibold ${STATUS_CLASS[a.status]}`}>
                          {FUNDING_STATUS_LABEL[a.status]}
                        </span>
                        {openStage && left !== null && (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[0.8rem] font-bold ${
                              left < 0
                                ? 'border-danger-200 bg-danger-100 text-danger-700'
                                : left <= 7
                                  ? 'border-warning-200 bg-warning-100 text-warning-800'
                                  : 'border-slate-200 bg-slate-50 text-slate-500'
                            }`}
                          >
                            신청 {dueText(left)}
                          </span>
                        )}
                      </div>
                      {a.institution && <p className="mt-0.5 text-[0.9rem] text-slate-500">{a.institution}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`${a.programName} 상태`}
                        value={a.status}
                        onChange={(e) => onChange(a.id, { status: e.target.value })}
                        className={`${inputCls} shrink-0`}
                      >
                        {FUNDING_STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {FUNDING_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label={`${a.programName} 삭제`}
                        onClick={() => onRemove(a.id)}
                        className="rounded-(--radius-control) p-2 text-slate-400 hover:bg-slate-100 hover:text-danger-600"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-[0.85rem] font-medium text-slate-600">
                      신청 마감
                      <input
                        type="date"
                        value={a.applyDueDate}
                        onChange={(e) => onChange(a.id, { applyDueDate: e.target.value })}
                        className={`mt-1 w-full ${inputCls}`}
                      />
                    </label>
                    <label className="text-[0.85rem] font-medium text-slate-600">
                      신청 금액(원)
                      <input
                        inputMode="numeric"
                        value={a.requestedAmount ?? ''}
                        onChange={(e) => {
                          const n = Number(e.target.value.replace(/[^0-9]/g, ''))
                          onChange(a.id, { requestedAmount: Number.isFinite(n) && n > 0 ? n : null })
                        }}
                        className={`mt-1 w-full ${inputCls}`}
                      />
                    </label>
                    <label className="text-[0.85rem] font-medium text-slate-600">
                      확정 금액(원)
                      <input
                        inputMode="numeric"
                        value={a.approvedAmount ?? ''}
                        onChange={(e) => {
                          const n = Number(e.target.value.replace(/[^0-9]/g, ''))
                          onChange(a.id, { approvedAmount: Number.isFinite(n) && n > 0 ? n : null })
                        }}
                        className={`mt-1 w-full ${inputCls}`}
                      />
                    </label>
                    <label className="text-[0.85rem] font-medium text-slate-600">
                      메모
                      <input
                        value={a.note}
                        onChange={(e) => onChange(a.id, { note: e.target.value })}
                        className={`mt-1 w-full ${inputCls}`}
                      />
                    </label>
                  </div>

                  {(a.submittedAt || a.resultAt) && (
                    <p className="text-[0.85rem] text-slate-500">
                      {a.submittedAt && <>접수 {a.submittedAt}</>}
                      {a.submittedAt && a.resultAt && ' · '}
                      {a.resultAt && <>결과 {a.resultAt}</>}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <div className="border-t border-slate-100 px-5 py-4">
          {open ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
              <label className="text-[0.85rem] font-medium text-slate-600 lg:col-span-2">
                사업·공고명
                <input
                  autoFocus
                  value={form.programName}
                  onChange={(e) => setForm({ ...form, programName: e.target.value })}
                  placeholder="예: 청년창업사관학교"
                  className={`mt-1 w-full ${inputCls}`}
                />
              </label>
              <label className="text-[0.85rem] font-medium text-slate-600">
                기관
                <input
                  value={form.institution}
                  onChange={(e) => setForm({ ...form, institution: e.target.value })}
                  placeholder="예: 중진공"
                  className={`mt-1 w-full ${inputCls}`}
                />
              </label>
              <label className="text-[0.85rem] font-medium text-slate-600">
                신청 마감
                <input
                  type="date"
                  value={form.applyDueDate}
                  onChange={(e) => setForm({ ...form, applyDueDate: e.target.value })}
                  className={`mt-1 w-full ${inputCls}`}
                />
              </label>
              <div className="flex gap-2">
                <Button variant="primary" onClick={submit} disabled={form.programName.trim() === ''}>
                  추가
                </Button>
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              신청 건 추가
            </Button>
          )}
        </div>
      </Panel>
    </section>
  )
}
