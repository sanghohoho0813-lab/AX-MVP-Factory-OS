/**
 * 계약 · 수금 한 번에 (D-140) — "얼마짜리 계약 → 지금 얼마 받음 → 나머지는 언제" 만 누르면 끝난다.
 *
 * 수금 항목 · 잔액 · 상태는 OS 가 만든다(contractPlan). 사용자가 치는 글자는 직접 금액 · 특수 조건 · 영업자 이름뿐.
 * 이미 수금 항목이 있으면 '아직 계획에 없는 돈' 만 나눈다 — 있는 항목과 입금 기록은 건드리지 않는다.
 */
import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import type { ClientOpsRecord, FeeConditionKind, FeeKind } from '../../types/clientOps'
import { formatKrw, formatKrwCompact, wonOf } from '../../lib/format'
import { AX_QUICK_AMOUNTS, PAY_METHOD_LABEL, planLines, recommendedMethod, whenText, withContractPlan, type PayMethod, type PlanLine, type When } from '../../services/contractPlan'
import { moneyPlanOf } from '../../services/feeStatus'
import { addDaysLocal } from '../../services/clientOpsNextAction'
import { BottomSheet } from '../ui/primitives'
import { Button } from '../ui/Button'

const chip = (on: boolean) =>
  `tap t-body inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 py-2 font-semibold whitespace-nowrap ${
    on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-800 hover:border-brand-400'
  }`

const money = (n: number) => formatKrwCompact(n) || '0원'

/** 남은 돈을 언제 — 버튼으로 */
const WHEN_CHIPS: { key: 'funding' | 'date' | 'project_done' | 'custom'; label: string }[] = [
  { key: 'funding', label: '정책자금 조달 후' },
  { key: 'date', label: '날짜 정하기' },
  { key: 'project_done', label: '프로젝트 완료 후' },
  { key: 'custom', label: '직접 조건' },
]
const FUNDING_CHIPS: { kind: FeeConditionKind; label: string }[] = [
  { kind: 'funding_executed', label: '실행(입금)되면' },
  { kind: 'funding_50m', label: '5천만원 이상' },
  { kind: 'funding_100m', label: '1억원 이상' },
]

function WhenPicker({ value, onChange, today, testId }: { value: When; onChange: (w: When) => void; today: string; testId?: string }) {
  const group = value.kind.startsWith('funding') ? 'funding' : value.kind === 'date' ? 'date' : value.kind === 'custom' ? 'custom' : value.kind === 'project_done' ? 'project_done' : ''
  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <div className="flex flex-wrap gap-2" role="group" aria-label="언제 받나요">
        {WHEN_CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={group === c.key}
            className={chip(group === c.key)}
            onClick={() =>
              onChange(
                c.key === 'funding'
                  ? { kind: value.kind.startsWith('funding') ? value.kind : 'funding_executed' }
                  : c.key === 'date'
                    ? { kind: 'date', date: value.date || addDaysLocal(today, 30) }
                    : c.key === 'custom'
                      ? { kind: 'custom', text: value.text ?? '' }
                      : { kind: 'project_done' },
              )
            }
          >
            {c.label}
          </button>
        ))}
      </div>
      {group === 'funding' && (
        <div className="flex flex-wrap gap-2 rounded-(--radius-control) bg-slate-50 p-2" role="group" aria-label="정책자금 조건">
          {FUNDING_CHIPS.map((f) => (
            <button key={f.kind} type="button" aria-pressed={value.kind === f.kind} className={chip(value.kind === f.kind)} onClick={() => onChange({ kind: f.kind })}>
              {f.label}
            </button>
          ))}
        </div>
      )}
      {group === 'date' && (
        <div className="flex flex-wrap items-center gap-2">
          {[
            ['1달 뒤', 30],
            ['2달 뒤', 60],
            ['3달 뒤', 90],
          ].map(([l, d]) => (
            <button key={l} type="button" className={chip(value.date === addDaysLocal(today, d as number))} onClick={() => onChange({ kind: 'date', date: addDaysLocal(today, d as number) })}>
              {l}
            </button>
          ))}
          <input type="date" aria-label="받을 날" value={value.date ?? ''} onChange={(e) => onChange({ kind: 'date', date: e.target.value })} className="t-body h-11 rounded-(--radius-control) border border-slate-300 px-3" />
        </div>
      )}
      {group === 'custom' && (
        <input
          aria-label="받는 조건"
          value={value.text ?? ''}
          maxLength={80}
          onChange={(e) => onChange({ kind: 'custom', text: e.target.value })}
          placeholder="예: 벤처인증 확인서 발급 시"
          className="t-body h-11 rounded-(--radius-control) border border-slate-300 px-3"
        />
      )}
    </div>
  )
}

function AmountChips({ options, value, onChange, testId, extra }: { options: { label: string; amount: number }[]; value: number | null; onChange: (n: number) => void; testId: string; extra?: string }) {
  const [typing, setTyping] = useState(false)
  const inOptions = value !== null && options.some((o) => o.amount === value)
  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.label} type="button" aria-pressed={!typing && value === o.amount} className={chip(!typing && value === o.amount)} onClick={() => { setTyping(false); onChange(o.amount) }}>
            {!typing && value === o.amount && <Check aria-hidden="true" className="size-4" />}
            {o.label}
          </button>
        ))}
        <button type="button" aria-pressed={typing || (value !== null && !inOptions && value > 0)} className={chip(typing || (value !== null && !inOptions && value > 0))} onClick={() => setTyping(true)}>
          직접 입력
        </button>
      </div>
      {(typing || (value !== null && !inOptions && value > 0)) && (
        <label className="flex items-center gap-2">
          <input
            autoFocus
            inputMode="numeric"
            aria-label={`${extra ?? '금액'} 직접 입력`}
            value={value && value > 0 ? value.toLocaleString('ko-KR') : ''}
            placeholder="예: 11,000,000"
            onChange={(e) => onChange(wonOf(e.target.value) ?? 0)}
            className="t-body h-12 min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 px-3 text-right font-semibold tabular-nums"
          />
          <span className="t-body shrink-0 text-slate-600">원</span>
        </label>
      )}
    </div>
  )
}

const STEP = 't-section text-slate-900'

export function ContractPlanSheet({
  record,
  today,
  onSave,
  onClose,
}: {
  record: ClientOpsRecord
  today: string
  onSave: (next: ClientOpsRecord) => void | boolean | Promise<boolean | void>
  onClose: () => void
}) {
  const m = moneyPlanOf(record, today)
  /** 이미 수금 항목이 있으면 계약금액은 정해져 있다 — 계획에 없는 돈만 나눈다 */
  const fixedTotal = m.planned > 0 ? Math.max(m.contract, m.planned) : null
  const [total, setTotal] = useState<number | null>(fixedTotal ?? (record.contract.cashAmount && record.contract.cashAmount > 0 ? record.contract.cashAmount : null))
  const portion = Math.max(0, (total ?? 0) - m.planned)
  const [method, setMethod] = useState<PayMethod | null>(null)
  const effMethod: PayMethod = method ?? recommendedMethod(portion)
  const [paid, setPaid] = useState<number | null>(null)
  const [upfront, setUpfront] = useState<number | null>(null)
  const [rest, setRest] = useState<When | null>(null)
  const effRest: When = rest ?? (effMethod === 'after_funding' ? { kind: 'funding_executed' } : { kind: 'project_done' })
  const [lines, setLines] = useState<PlanLine[] | null>(null)
  const [agentOpen, setAgentOpen] = useState(false)
  const [agentName, setAgentName] = useState(record.sales?.referrer ?? '')
  const [agentRate, setAgentRate] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const splitDefault = (p: number): PlanLine[] => {
    const third = Math.round(p / 3 / 10_000) * 10_000
    return [
      { label: '계약금', kind: 'deposit', amount: third, when: { kind: 'on_contract' }, receivedNow: false },
      { label: '중도금', kind: 'interim', amount: third, when: { kind: 'date', date: addDaysLocal(today, 60) }, receivedNow: false },
      { label: '성공보수', kind: 'success', amount: p - third * 2, when: { kind: 'funding_executed' }, receivedNow: false },
    ]
  }
  const effLines = lines ?? splitDefault(portion)
  // 계산이 가벼워 매번 다시 만든다(고른 것이 바뀌면 바로 미리보기에)
  const planned = planLines({ portion, method: effMethod, paidNow: paid ?? 0, upfront: upfront ?? 0, rest: effRest, lines: effLines })
  const plannedSum = planned.reduce((s, l) => s + l.amount, 0)
  const paidOptions = useMemo(() => {
    const out: { label: string; amount: number }[] = []
    if (effMethod === 'full_upfront') return [{ label: `전액 ${money(portion)}`, amount: portion }, { label: '아직 안 받음', amount: 0 }]
    for (const a of [5_000_000, 10_000_000]) if (a < portion) out.push({ label: money(a), amount: a })
    out.push({ label: `전액 ${money(portion)}`, amount: portion }, { label: '아직 안 받음', amount: 0 })
    return out
  }, [effMethod, portion])
  const remaining = Math.max(0, portion - (paid ?? 0) - (effMethod === 'upfront_rest' && (paid ?? 0) === 0 ? (upfront ?? 0) : 0))
  const ready = portion > 0 && (effMethod === 'split' ? Math.abs(plannedSum - portion) < 1 : paid !== null) && (effRest.kind !== 'date' || !!effRest.date) && (effRest.kind !== 'custom' || !!effRest.text?.trim())

  const save = async () => {
    if (!ready || busy) return
    setBusy(true)
    const next = withContractPlan(record, planned, { today, total: total ?? 0, setTotal: fixedTotal === null, agentName, agentRatePct: agentOpen ? agentRate : null })
    const ok = await onSave(next)
    setBusy(false)
    if (ok !== false) onClose()
  }

  const patchLine = (i: number, p: Partial<PlanLine>) => setLines(effLines.map((l, j) => (j === i ? { ...l, ...p } : l)))

  return (
    <BottomSheet
      title="계약 · 수금 한 번에"
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {portion > 0 && planned.length > 0 && (
            <ul className="t-sub flex flex-col gap-0.5 text-slate-700" data-testid="plan-preview">
              {planned.map((l, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-x-2">
                  <span className="break-keep">
                    <b className="text-slate-900">{l.label}</b> {money(l.amount)}
                  </span>
                  <span className={l.receivedNow ? 'font-semibold text-success-700' : 'text-slate-500'}>
                    {l.receivedNow ? '✓ 오늘 입금' : l.when.kind === 'on_contract' ? '지금 받을 돈' : `${whenText(l.when)} · ${l.when.kind === 'date' ? '받을 예정' : '조건 대기'}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="primary" className="w-full" onClick={() => void save()} disabled={!ready || busy} data-testid="plan-save">
            {busy ? '저장 중…' : '이대로 저장'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6" data-testid="contract-plan">
        {/* 1 얼마짜리 계약 */}
        <section className="flex flex-col gap-2.5">
          <h3 className={STEP}>① 얼마짜리 계약인가요?</h3>
          {fixedTotal !== null ? (
            <p className="t-body break-keep text-slate-700" data-testid="plan-fixed">
              계약금액 <b className="text-slate-900">{formatKrw(fixedTotal)}</b> 중 {formatKrw(m.planned)}은 이미 수금 계획이 있습니다 — 남은{' '}
              <b className="text-brand-800">{formatKrw(portion)}</b>을 정합니다.
            </p>
          ) : (
            <>
              <p className="t-sub text-slate-500">AX 계약 자주 쓰는 금액 · 다른 계약은 직접 입력</p>
              <AmountChips
                testId="plan-total"
                extra="계약금액"
                options={AX_QUICK_AMOUNTS.map((a) => ({ label: money(a), amount: a }))}
                value={total}
                onChange={(n) => {
                  setTotal(n)
                  setPaid(null)
                  setUpfront(null)
                  setLines(null)
                }}
              />
            </>
          )}
        </section>

        {portion > 0 && (
          <>
            {/* 2 어떻게 받나 */}
            <section className="flex flex-col gap-2.5">
              <h3 className={STEP}>② 어떻게 받나요?</h3>
              <div className="flex flex-wrap gap-2" role="group" aria-label="수금 방식" data-testid="plan-method">
                {(Object.keys(PAY_METHOD_LABEL) as PayMethod[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={effMethod === k}
                    className={chip(effMethod === k)}
                    onClick={() => {
                      setMethod(k)
                      setPaid(null)
                      setRest(null)
                    }}
                  >
                    {PAY_METHOD_LABEL[k]}
                    {recommendedMethod(portion) === k && <span className={`t-meta rounded-full px-1.5 ${effMethod === k ? 'bg-white/20' : 'bg-brand-50 text-brand-700'}`}>추천</span>}
                  </button>
                ))}
              </div>
            </section>

            {effMethod !== 'split' ? (
              <>
                {/* 3 지금 받은 돈 */}
                <section className="flex flex-col gap-2.5">
                  <h3 className={STEP}>③ 지금 받은 돈</h3>
                  <p className="t-sub break-keep text-slate-500">실제로 들어온 돈만 고르세요 — 고른 만큼만 '입금 완료' 로 적습니다.</p>
                  <AmountChips testId="plan-paid" extra="받은 돈" options={paidOptions} value={paid} onChange={(n) => setPaid(Math.min(n, portion))} />
                </section>

                {effMethod === 'upfront_rest' && paid === 0 && (
                  <section className="flex flex-col gap-2.5">
                    <h3 className={STEP}>선금은 얼마로 할까요?</h3>
                    <AmountChips
                      testId="plan-upfront"
                      extra="선금"
                      options={[5_000_000, 10_000_000].filter((a) => a < portion).map((a) => ({ label: money(a), amount: a }))}
                      value={upfront}
                      onChange={(n) => setUpfront(Math.min(n, portion))}
                    />
                  </section>
                )}

                {/* 4 남은 돈 언제 */}
                {effMethod !== 'full_upfront' && paid !== null && remaining > 0 && (
                  <section className="flex flex-col gap-2.5">
                    <h3 className={STEP}>
                      ④ 남은 <span className="text-brand-800">{money(remaining)}</span>은 언제 받나요?
                    </h3>
                    <WhenPicker value={effRest} onChange={setRest} today={today} testId="plan-when" />
                  </section>
                )}
              </>
            ) : (
              <section className="flex flex-col gap-3" data-testid="plan-split">
                <h3 className={STEP}>③ 나눠 받기</h3>
                {effLines.map((l, i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-(--radius-card) border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        aria-label={`${i + 1}번째 이름`}
                        value={l.label}
                        onChange={(e) => patchLine(i, { label: e.target.value })}
                        className="t-body h-11 w-28 rounded-(--radius-control) border border-slate-300 px-3 font-semibold"
                      />
                      <input
                        inputMode="numeric"
                        aria-label={`${i + 1}번째 금액`}
                        value={l.amount > 0 ? l.amount.toLocaleString('ko-KR') : ''}
                        onChange={(e) => patchLine(i, { amount: wonOf(e.target.value) ?? 0 })}
                        className="t-body h-11 min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 px-3 text-right font-semibold tabular-nums"
                      />
                      <button type="button" aria-pressed={l.receivedNow} className={chip(l.receivedNow)} onClick={() => patchLine(i, { receivedNow: !l.receivedNow })}>
                        {l.receivedNow && <Check aria-hidden="true" className="size-4" />}지금 받음
                      </button>
                    </div>
                    {!l.receivedNow && (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" aria-pressed={l.when.kind === 'on_contract'} className={chip(l.when.kind === 'on_contract')} onClick={() => patchLine(i, { when: { kind: 'on_contract' } })}>
                          계약 시
                        </button>
                        <div className="w-full">
                          <WhenPicker value={l.when} onChange={(w) => patchLine(i, { when: w })} today={today} />
                        </div>
                      </div>
                    )}
                    {effLines.length > 1 && (
                      <button type="button" onClick={() => setLines(effLines.filter((_, j) => j !== i))} className="tap t-sub self-end font-medium text-slate-500 underline">
                        이 줄 빼기
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setLines([...effLines, { label: '잔금', kind: 'interim' as FeeKind, amount: Math.max(0, portion - plannedSum), when: { kind: 'project_done' }, receivedNow: false }])}
                  className="tap t-body rounded-(--radius-control) border border-dashed border-slate-300 py-2.5 font-semibold text-brand-700"
                >
                  ＋ 한 줄 더
                </button>
                <p className={`t-sub font-semibold ${Math.abs(plannedSum - portion) < 1 ? 'text-success-700' : 'text-danger-700'}`} data-testid="plan-split-sum">
                  나눈 합계 {formatKrw(plannedSum)} / 계약 {formatKrw(portion)}
                  {Math.abs(plannedSum - portion) >= 1 && ` — ${formatKrw(Math.abs(portion - plannedSum))} ${plannedSum < portion ? '모자람' : '넘침'}`}
                </p>
              </section>
            )}

            {/* 영업자 — 있을 때만 */}
            <section className="flex flex-col gap-2">
              <button type="button" aria-expanded={agentOpen} onClick={() => setAgentOpen((v) => !v)} className="tap t-sub self-start font-medium text-slate-600 underline">
                {agentOpen ? '영업자 수수료 없음으로' : '영업자 수수료가 있나요?'}
              </button>
              {agentOpen && (
                <div className="flex flex-wrap items-center gap-2">
                  <input aria-label="영업자 이름" value={agentName} onChange={(e) => setAgentName(e.target.value)} placeholder="영업자 이름" className="t-body h-11 w-32 rounded-(--radius-control) border border-slate-300 px-3" />
                  {[10, 20, 30].map((r) => (
                    <button key={r} type="button" aria-pressed={agentRate === r} className={chip(agentRate === r)} onClick={() => setAgentRate(r)}>
                      {r}%
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
