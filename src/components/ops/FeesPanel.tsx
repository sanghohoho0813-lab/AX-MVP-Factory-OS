/**
 * 계약 · 수금 (D-140) — 회계 프로그램처럼 보이지 않게.
 *
 * 기본 화면은 숫자 네 개(계약금액 · 입금 완료 · 지금 받을 돈 · 조건부 · 예정)와 항목마다 두 줄:
 *   계약금 500만원  ✓ 9월 30일 입금
 *   잔금 1,000만원  정책자금 1억원 이상 조달 시 · [조건 대기]
 * 입력 칸은 '고치기' 를 눌렀을 때만. 입금은 한 번 더 묻고(오늘 N원 입금으로 처리할까요?), 되돌릴 수 있다.
 * 영업자 수수료는 값이 있을 때만 한 줄로 — 핵심 숫자와 다투지 않게.
 */
import { useMoneyWords } from './useMoneyWords'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Pencil, Plus, Undo2 } from 'lucide-react'
import type { ClientOpsRecord, FeeConditionKind, FeeItem, FeeKind, ServiceKey } from '../../types/clientOps'
import { FEE_CONDITION_LABEL, FEE_CONDITION_ORDER } from '../../types/clientOps'
import { FEE_KIND_LABEL, FEE_KIND_ORDER, SERVICES } from '../../content/clientOpsCatalog'
import { withFee, withNewFee, withoutFee } from '../../services/clientOpsService'
import { agentShares, feeMathOf, feeTotals, marginPct, marginText } from '../../services/feeMath'
import { FEE_STATE_LABEL, conditionText, feeStateOf, fundingFactsOf, isConditional, moneyPlanOf, type FeeState, type FundingFacts } from '../../services/feeStatus'
import { daysLeftFrom, dueText } from '../../services/clientOpsAlerts'
import { formatKrw, formatKrwCompact, krwTile } from '../../lib/format'
import { Button } from '../ui/Button'
import { InlineConfirm } from '../ui/InlineConfirm'
import { MetricTile } from '../ui/primitives'
import { AmountField, DueDateField, parseAmount } from './opsControls'
import { ContractPlanSheet } from './ContractPlanSheet'
import { useIsPilot } from '../../auth/osAccess'

const STATE_CLASS: Record<FeeState, string> = {
  received: 'border-success-200 bg-success-50 text-success-800',
  waiting: 'border-slate-200 bg-slate-100 text-slate-700',
  scheduled: 'border-brand-200 bg-brand-50 text-brand-800',
  claimable: 'border-warning-200 bg-warning-50 text-warning-800',
  overdue: 'border-danger-200 bg-danger-50 text-danger-700',
  undated: 'border-slate-200 bg-white text-slate-600',
}

export function FeeStateBadge({ state }: { state: FeeState }) {
  return (
    <span data-testid="fee-state" data-state={state} className={`t-meta inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-bold whitespace-nowrap ${STATE_CLASS[state]}`}>
      {FEE_STATE_LABEL[state]}
    </span>
  )
}

const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`
const chip = (on: boolean) =>
  `tap t-sub inline-flex min-h-10 items-center rounded-full border px-3 py-1.5 font-semibold whitespace-nowrap ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400'}`

/** 받는 조건 고르기(고치기 · 한 줄 더) */
function ConditionChips({ value, onChange, labelPrefix }: { value: FeeConditionKind | ''; onChange: (k: FeeConditionKind | '') => void; labelPrefix: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${labelPrefix} 받는 조건`}>
      {FEE_CONDITION_ORDER.map((k) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(value === k ? '' : k)} className={chip(value === k)}>
          {k === 'date' ? '날짜' : FEE_CONDITION_LABEL[k].replace(' 시', '').replace('정책자금 ', '정책자금 ')}
        </button>
      ))}
    </div>
  )
}

function FeeLine({
  fee,
  record,
  onChange,
  today,
  funding,
}: {
  fee: FeeItem
  record: ClientOpsRecord
  onChange: (next: ClientOpsRecord) => void | boolean | Promise<boolean>
  today: string
  funding: FundingFacts
}) {
  const state = feeStateOf(fee, today, funding)
  const [confirm, setConfirm] = useState<'in' | 'undo' | null>(null)
  const [edit, setEdit] = useState(false)
  const left = fee.dueDate ? daysLeftFrom(today, fee.dueDate) : null
  const cond = conditionText(fee)
  const m = feeMathOf(fee)
  const service = fee.serviceKey ? SERVICES.find((s) => s.key === fee.serviceKey)?.shortLabel : null
  const patch = (p: Partial<FeeItem>) => onChange(withFee(record, fee.id, p))

  return (
    <li className="flex flex-col gap-2 px-4 py-3.5 sm:px-5" data-testid="fee-line" data-fee-id={fee.id}>
      {/* 1줄 — 이름 · 금액 */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="t-body font-bold break-keep text-slate-900">{fee.label}</span>
          {service && <span className="t-meta rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-500">{service}</span>}
        </span>
        <span className={`t-body shrink-0 font-bold tabular-nums ${state === 'received' ? 'text-slate-500' : 'text-slate-900'}`}>{fee.amount === null ? '금액 미정' : formatKrwCompact(fee.amount) || formatKrw(fee.amount)}</span>
      </div>

      {/* 2줄 — 상태 */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {state === 'received' ? (
          <span className="t-sub inline-flex items-center gap-1 font-semibold text-success-700" data-testid="fee-received">
            <Check aria-hidden="true" className="size-4" /> 입금 완료 · {md(fee.receivedAt as string)}
          </span>
        ) : (
          <>
            {cond && <span className="t-sub break-keep text-slate-700">{cond}</span>}
            <FeeStateBadge state={state} />
            {left !== null && (state === 'overdue' || state === 'scheduled' || state === 'claimable') && <span className={`t-sub ${state === 'overdue' ? 'font-bold text-danger-700' : 'text-slate-500'}`}>{dueText(left)}</span>}
          </>
        )}
        {m.agent > 0 && m.net !== null && (
          <span className="t-sub text-slate-500">
            {fee.agentName.trim() !== '' && <span className="mr-1">{fee.agentName.trim()} 몫 빼고</span>}→ 내 몫 <b className="font-semibold text-slate-800 tabular-nums">{formatKrw(m.net)}</b>
            {m.marginPct !== null && <span className="ml-1 font-bold text-brand-700">{marginText(m.marginPct)}</span>}
          </span>
        )}
      </div>

      {/* 3줄 — 누를 것 */}
      {confirm === null ? (
        <div className="flex flex-wrap items-center gap-2">
          {state === 'received' ? (
            <button type="button" onClick={() => setConfirm('undo')} aria-label={`${fee.label} 입금 되돌리기`} className="tap t-sub inline-flex items-center gap-1 font-medium text-slate-500 underline hover:text-slate-800">
              <Undo2 aria-hidden="true" className="size-4" /> 되돌리기
            </button>
          ) : (
            <>
              <button
                type="button"
                aria-label={`${fee.label} 입금`}
                onClick={() => setConfirm('in')}
                className="tap t-sub inline-flex min-h-10 items-center rounded-(--radius-control) border border-brand-300 bg-white px-3.5 font-semibold text-brand-800 hover:bg-brand-50"
              >
                입금 확인
              </button>
              {state === 'waiting' && (
                <button type="button" aria-label={`${fee.label} 조건 충족됨`} onClick={() => void patch({ conditionMetAt: today })} className="tap t-sub inline-flex min-h-10 items-center rounded-(--radius-control) border border-slate-300 bg-white px-3.5 font-semibold text-slate-700 hover:border-brand-300">
                  조건 충족됨
                </button>
              )}
            </>
          )}
          <button type="button" aria-expanded={edit} aria-label={`${fee.label} 고치기`} onClick={() => setEdit((v) => !v)} className="tap t-sub ml-auto inline-flex items-center gap-1 font-medium text-slate-600 hover:text-brand-700">
            <Pencil aria-hidden="true" className="size-3.5" /> {edit ? '접기' : '고치기'}
          </button>
        </div>
      ) : (
        <div role="alertdialog" aria-label={confirm === 'in' ? '입금 확인' : '입금 되돌리기'} className="flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-brand-200 bg-brand-50 px-3 py-2.5" data-testid="fee-confirm">
          <span className="t-body min-w-0 break-keep font-semibold text-slate-900">
            {confirm === 'in' ? `오늘(${md(today)}) ${fee.amount === null ? '' : `${formatKrw(fee.amount)} `}입금으로 처리할까요?` : '입금 표시를 지울까요? (아직 안 들어온 돈이 됩니다)'}
          </span>
          <span className="ml-auto flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setConfirm(null)
                void patch(confirm === 'in' ? { receivedAt: today } : { receivedAt: null })
              }}
            >
              {confirm === 'in' ? '네, 입금 완료' : '네, 지우기'}
            </Button>
            <Button size="sm" onClick={() => setConfirm(null)}>
              취소
            </Button>
          </span>
        </div>
      )}

      {/* 고치기 — 누른 때만 */}
      {edit && (
        <div className="flex flex-col gap-3 rounded-(--radius-card) border border-slate-200 bg-slate-50/60 p-3" data-testid="fee-editor">
          <div className="flex flex-wrap items-end gap-2">
            <label className="t-sub font-medium text-slate-600">
              이름
              <input aria-label={`${fee.label} 이름`} value={fee.label} onChange={(e) => void patch({ label: e.target.value })} className="t-body mt-1 block h-11 w-32 rounded-(--radius-control) border border-slate-300 bg-white px-3" />
            </label>
            <label className="t-sub font-medium text-slate-600">
              금액
              <span className="mt-1 flex items-center gap-1.5">
                <input
                  aria-label={`${fee.label} 금액`}
                  value={fee.amount === null ? '' : fee.amount.toLocaleString('ko-KR')}
                  onChange={(e) => {
                    const n = parseAmount(e.target.value)
                    void patch({ amount: n > 0 ? n : null })
                  }}
                  inputMode="numeric"
                  placeholder="미정"
                  className="t-body h-11 w-32 rounded-(--radius-control) border border-slate-300 bg-white px-3 text-right font-semibold tabular-nums"
                />
                <button type="button" aria-label={`${fee.label} 금액에 100만원 더하기`} onClick={() => void patch({ amount: (fee.amount ?? 0) + 1_000_000 })} className="tap t-sub rounded-(--radius-control) border border-slate-200 bg-white px-2 py-2 font-semibold text-slate-600">
                  +100만
                </button>
              </span>
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="t-sub font-medium text-slate-600">받는 조건</span>
            <ConditionChips value={fee.conditionKind ?? ''} labelPrefix={fee.label} onChange={(k) => void patch({ conditionKind: k, conditionMetAt: null })} />
            {fee.conditionKind === 'custom' && (
              <input aria-label={`${fee.label} 직접 조건`} value={fee.conditionText ?? ''} maxLength={80} onChange={(e) => void patch({ conditionText: e.target.value })} placeholder="예: 벤처인증 확인서 발급 시" className="t-body h-11 rounded-(--radius-control) border border-slate-300 bg-white px-3" />
            )}
            {(!fee.conditionKind || fee.conditionKind === 'date' || fee.conditionKind === 'on_contract') && (
              <label className="t-sub flex flex-wrap items-center gap-2 text-slate-600">
                받기로 한 날{fee.conditionKind === 'on_contract' ? '(있으면)' : ''}
                <input type="date" aria-label={`${fee.label} 받기로 한 날`} value={fee.dueDate} onChange={(e) => void patch({ dueDate: e.target.value })} className="t-body h-11 rounded-(--radius-control) border border-slate-300 bg-white px-3" />
              </label>
            )}
            {isConditional(fee) && fee.conditionMetAt && (
              <button type="button" onClick={() => void patch({ conditionMetAt: null })} className="tap t-sub self-start text-slate-500 underline">
                {md(fee.conditionMetAt)} 조건 충족 표시 지우기
              </button>
            )}
          </div>
          {fee.receivedAt && (
            <label className="t-sub flex flex-wrap items-center gap-2 font-medium text-success-700">
              입금일
              <input
                type="date"
                aria-label={`${fee.label} 입금일`}
                value={fee.receivedAt}
                onChange={(e) => {
                  if (e.target.value) void patch({ receivedAt: e.target.value })
                }}
                className="t-body h-11 rounded-(--radius-control) border border-success-200 bg-white px-3 tabular-nums"
              />
            </label>
          )}
          {/* 영업자 — 이 항목에서 나갈 수수료 */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <label className="t-sub flex items-center gap-1.5 text-slate-600">
              영업자 수수료
              <input
                aria-label={`${fee.label} 영업자 수수료`}
                value={fee.agentFee === null ? '' : fee.agentFee.toLocaleString('ko-KR')}
                onChange={(e) => {
                  const n = parseAmount(e.target.value)
                  void patch({ agentFee: n > 0 ? n : null })
                }}
                inputMode="numeric"
                placeholder="없음"
                className="t-body h-10 w-28 rounded-(--radius-control) border border-slate-300 bg-white px-2 text-right font-semibold tabular-nums"
              />
            </label>
            {(fee.agentFee !== null || fee.agentName !== '') && (
              <input aria-label={`${fee.label} 영업자 이름`} value={fee.agentName} onChange={(e) => void patch({ agentName: e.target.value })} placeholder="영업자 이름" className="t-body h-10 w-28 rounded-(--radius-control) border border-slate-300 bg-white px-2" />
            )}
            {fee.agentFee !== null && fee.agentFee > 0 && (
              <label className="t-sub inline-flex items-center gap-1.5 text-slate-600">
                <input
                  type="checkbox"
                  aria-label={`${fee.label} 영업자 지급 완료`}
                  checked={fee.agentPaidAt !== null}
                  // D-149: 입금 확인을 되돌려도 '지급' 이 남아 있으면 끌 수 있어야 한다(예전에는 막혀서 못 고쳤다)
                  disabled={fee.receivedAt === null && fee.agentPaidAt === null}
                  onChange={(e) => void patch({ agentPaidAt: e.target.checked ? today : null })}
                  className="size-5 accent-brand-600 disabled:opacity-40"
                />
                {fee.receivedAt === null && fee.agentPaidAt !== null ? (
                  <span className="text-warning-800">고객 입금 전인데 지급으로 적혀 있어요 — 아직 안 줬으면 끄세요</span>
                ) : fee.receivedAt === null ? (
                  <span className="text-slate-400">고객 입금 전</span>
                ) : fee.agentPaidAt ? (
                  <span className="inline-flex items-center gap-1">
                    지급
                    <input type="date" aria-label={`${fee.label} 영업자 지급일`} value={fee.agentPaidAt} onChange={(e) => e.target.value && void patch({ agentPaidAt: e.target.value })} className="bg-transparent tabular-nums" />
                  </span>
                ) : (
                  <span className="font-semibold text-warning-700">영업자에게 줄 돈</span>
                )}
              </label>
            )}
          </div>
          <InlineConfirm className="self-end" question={`${fee.label} 지울까요?`} onConfirm={() => void onChange(withoutFee(record, fee.id))} testId="fee-delete" />
        </div>
      )}
    </li>
  )
}

export function FeesPanel({
  record,
  onChange,
  today,
}: {
  record: ClientOpsRecord
  onChange: (next: ClientOpsRecord) => void | boolean | Promise<boolean>
  today: string
}) {
  const moneyWords = useMoneyWords()
  const navigate = useNavigate()
  const pilot = useIsPilot()
  const funding = fundingFactsOf(record.fundingApplications)
  const m = moneyPlanOf(record, today)
  const totals = feeTotals(record.fees, funding)
  const shares = agentShares(record.fees)
  const [planOpen, setPlanOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  // 한 줄 더 넣기(드물게) — 예전 입력 칸을 그대로 두되 접어 둔다
  const [kind, setKind] = useState<FeeKind>('deposit')
  const [serviceKey, setServiceKey] = useState<ServiceKey | ''>('')
  const [amount, setAmount] = useState(0)
  const [dueDate, setDueDate] = useState('')
  const [cond, setCond] = useState<FeeConditionKind | ''>('')
  const [agentFee, setAgentFee] = useState(0)
  const [agentName, setAgentName] = useState('')
  const [adding, setAdding] = useState(false)
  const draftMargin = marginPct(amount > 0 ? amount : null, agentFee)

  const add = async () => {
    if (adding) return
    setAdding(true)
    const ok = await onChange(
      withNewFee(record, {
        kind,
        serviceKey: serviceKey === '' ? null : serviceKey,
        amount: amount > 0 ? amount : null,
        agentFee: agentFee > 0 ? agentFee : null,
        agentName,
        dueDate,
        ...(cond ? { conditionKind: cond } : {}),
      }),
    )
    setAdding(false)
    if (ok === false) return
    setAmount(0)
    setAgentFee(0)
    setAgentName('')
    setDueDate('')
    setCond('')
  }

  const empty = record.fees.length === 0
  return (
    <section aria-labelledby="fees" className="flex flex-col gap-3" data-testid="fees-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="fees" className="text-[1.3rem] font-bold text-slate-900">
          계약 · 수금
        </h2>
        {!empty && (
          <Button onClick={() => setPlanOpen(true)} data-testid="plan-open">
            계약 · 수금 한 번에
          </Button>
        )}
      </div>

      {empty ? (
        <div className="flex flex-col items-start gap-3 rounded-(--radius-panel) border border-brand-200 bg-brand-50/50 p-5" data-testid="plan-empty">
          <p className="t-body break-keep text-slate-800">
            <b>얼마짜리 계약 → 지금 얼마 받음 → 나머지는 언제</b> 세 가지만 고르면 수금 계획이 만들어집니다.
          </p>
          <Button variant="primary" onClick={() => setPlanOpen(true)} data-testid="plan-open">
            계약금액 · 받은 돈 · 남은 돈 정하기
          </Button>
        </div>
      ) : (
        <>
          {m.unplanned > 0 && (
            <div data-testid="plan-gap" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-(--radius-control) border border-warning-200 bg-warning-50 px-4 py-3">
              <span className="t-body break-keep text-slate-800">
                계약금액 {formatKrw(m.contract)} 중 <b className="text-warning-800">{formatKrw(m.unplanned)}</b>은 아직 언제 받을지 정하지 않았습니다.
              </span>
              <Button variant="primary" size="sm" onClick={() => setPlanOpen(true)}>
                남은 {krwTile(m.unplanned)} 받는 방법 정하기
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" data-testid="money-tiles">
            <MetricTile label="계약금액" value={krwTile(m.contract)} hint={m.unknownCount > 0 ? `금액 미정 ${m.unknownCount}건` : undefined} />
            <MetricTile label="입금 완료" value={krwTile(m.received)} tone={m.received > 0 ? 'success' : 'neutral'} />
            <MetricTile hintOnMobile label="지금 받을 돈" value={krwTile(m.now)} tone={m.overdue > 0 ? 'danger' : m.now > 0 ? 'warning' : 'neutral'} hint={m.overdue > 0 ? `그중 미수금 ${krwTile(m.overdue)}` : m.now > 0 ? '청구 가능' : '미수금 없음'} />
            <MetricTile
              hintOnMobile
              label="조건부 · 예정"
              value={krwTile(m.later)}
              hint={[m.waiting > 0 ? `조건 대기 ${krwTile(m.waiting)}` : '', m.scheduled > 0 ? `날짜 예정 ${krwTile(m.scheduled)}` : '', m.undated > 0 ? `받을 날 미정 ${krwTile(m.undated)}` : ''].filter(Boolean).join(' · ') || undefined}
            />
          </div>

          {totals.agent > 0 && (
            <p className="t-sub break-keep text-slate-500" data-testid="fees-agent">
              영업자 수수료 {formatKrw(totals.agent)}
              {shares.length > 0 && ` (${shares.map((s) => `${s.name} ${formatKrw(s.amount)}`).join(' · ')})`} → 내 몫 {formatKrw(totals.net)}
              {totals.marginPct !== null && ` · 이익률 ${marginText(totals.marginPct)}`} · {moneyWords.unpaid} {krwTile(totals.unpaidNet)}
              {totals.unpaidGross !== totals.unpaidNet && ` (청구 기준 ${krwTile(totals.unpaidGross)})`}{' '}
              {!pilot && (
                <button type="button" onClick={() => navigate('/ops/agents')} className="tap font-medium text-brand-700 underline">
                  영업자 정산
                </button>
              )}
            </p>
          )}

          <ul className="divide-y divide-slate-100 rounded-(--radius-panel) border border-slate-200 bg-white">
            {record.fees.map((fee) => (
              <FeeLine key={fee.id} fee={fee} record={record} onChange={onChange} today={today} funding={funding} />
            ))}
          </ul>
        </>
      )}

      {!addOpen ? (
        <button type="button" onClick={() => setAddOpen(true)} data-testid="fee-add-open" className="tap t-sub inline-flex items-center gap-1.5 self-start font-medium text-slate-600 hover:text-brand-700">
          <Plus aria-hidden="true" className="size-4" /> 수금 항목 하나 직접 넣기
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4" data-testid="fee-add">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[0.88rem] font-medium text-slate-600">
              종류
              <select value={kind} onChange={(e) => setKind(e.target.value as FeeKind)} className="mt-1 block h-11 rounded-(--radius-control) border border-slate-300 px-2 text-[0.95rem]">
                {FEE_KIND_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {FEE_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[0.88rem] font-medium text-slate-600">
              관련 업무
              <select value={serviceKey} onChange={(e) => setServiceKey(e.target.value as ServiceKey | '')} className="mt-1 block h-11 rounded-(--radius-control) border border-slate-300 px-2 text-[0.95rem]">
                <option value="">전체 계약</option>
                {SERVICES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.shortLabel}
                  </option>
                ))}
              </select>
            </label>
            <AmountField id="fee-new-amount" value={amount} onChange={setAmount} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="t-sub font-medium text-slate-600">받는 조건</span>
            <ConditionChips value={cond} onChange={setCond} labelPrefix="새 항목" />
            {(!cond || cond === 'date' || cond === 'on_contract') && (
              <div className="min-w-0">
                <DueDateField label="받기로 한 날" value={dueDate} today={today} onChange={setDueDate} />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <AmountField id="fee-new-agent" label="영업자 수수료" value={agentFee} onChange={setAgentFee} />
            {agentFee > 0 && (
              <label className="text-[0.88rem] font-medium text-slate-600">
                영업자 이름
                <input value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="누구에게" className="mt-1 block h-11 w-28 rounded-(--radius-control) border border-slate-300 px-2 text-[0.95rem]" />
              </label>
            )}
            {draftMargin !== null && <span className="t-sub self-center rounded-full bg-brand-50 px-2.5 py-1 font-bold text-brand-700 tabular-nums">이익률 {marginText(draftMargin)}</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => void add()} disabled={adding}>
              <Plus aria-hidden="true" className="size-4" />
              추가
            </Button>
            <Button onClick={() => setAddOpen(false)}>닫기</Button>
          </div>
        </div>
      )}

      {planOpen && <ContractPlanSheet record={record} today={today} onSave={onChange} onClose={() => setPlanOpen(false)} />}
    </section>
  )
}
