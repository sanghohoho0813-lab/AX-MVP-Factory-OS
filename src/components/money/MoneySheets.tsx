/**
 * 매출 · 비용 — 비용 적기 · 정기 결제 · 환율 창 (D-142).
 * 금액은 '2.8만' · '$20' 처럼 말하듯 적어도 읽는다. 분류 · 결제 수단 · 날짜는 누르기로.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { BottomSheet } from '../ui/primitives'
import { Button } from '../ui/Button'
import { AiSoonButton } from '../ui/AiSoonButton'
import {
  COST_CATEGORY_LABEL,
  COST_CATEGORY_ORDER,
  PAY_METHOD_LABEL,
  SUBSCRIPTION_PRESETS,
  moneyText,
  parseAmount,
  toKrw,
  type CostCategory,
  type Currency,
  type Cycle,
  type Expense,
  type FinanceSettings,
  type PayMethod,
  type Subscription,
} from '../../services/finance/financeCore'

const inputCls = 'w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2.5 t-body focus:border-brand-500 focus:outline-none'

function Chip({ on, onClick, children, testid }: { on: boolean; onClick: () => void; children: ReactNode; testid?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      data-testid={testid}
      onClick={onClick}
      className={`tap t-sub rounded-full border px-3 py-1.5 font-semibold whitespace-nowrap ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand-300'}`}
    >
      {children}
    </button>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="t-sub font-semibold text-slate-700">{label}</span>
      {children}
    </div>
  )
}

const PAY_KEYS = Object.keys(PAY_METHOD_LABEL) as Exclude<PayMethod, ''>[]

function amountInputText(amount: number, currency: Currency): string {
  if (!amount) return ''
  return currency === 'USD' ? `$${amount}` : amount.toLocaleString('ko-KR')
}

function AmountField({ text, onText, currency, onCurrency, settings, testid }: { text: string; onText: (t: string) => void; currency: Currency; onCurrency: (c: Currency) => void; settings: FinanceSettings; testid: string }) {
  const parsed = parseAmount(currency === 'USD' && text && !/^\$/.test(text) ? `$${text}` : text)
  return (
    <Row label="금액">
      <div className="flex gap-2">
        <input id={testid} data-testid={testid} value={text} onChange={(e) => onText(e.target.value)} inputMode="decimal" placeholder={currency === 'USD' ? '20' : '28,000 · 2.8만'} className={`${inputCls} t-section font-semibold tabular-nums`} />
        <div className="flex shrink-0 rounded-(--radius-control) border border-slate-200 bg-slate-50 p-0.5" role="radiogroup" aria-label="통화">
          {(['KRW', 'USD'] as Currency[]).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={currency === c} onClick={() => onCurrency(c)} className={`tap t-sub rounded-[8px] px-3 font-semibold ${currency === c ? 'bg-white text-slate-900 shadow-(--shadow-card)' : 'text-slate-500'}`}>
              {c === 'KRW' ? '원' : '달러'}
            </button>
          ))}
        </div>
      </div>
      <span className="t-sub text-slate-500" data-testid={`${testid}-read`}>
        {text.trim() === '' ? ' ' : parsed ? `${moneyText(parsed.amount, parsed.currency)}${parsed.currency === 'USD' ? ` ≈ ${toKrw(parsed.amount, 'USD', settings).toLocaleString('ko-KR')}원` : ''}` : '금액을 읽지 못했어요 — 숫자로 적어 주세요'}
      </span>
    </Row>
  )
}

function readAmount(text: string, currency: Currency) {
  return parseAmount(currency === 'USD' && text && !/^\$/.test(text) ? `$${text}` : text)
}

/* ------------------------------------------------------------------ */
/* 비용 적기                                                              */
/* ------------------------------------------------------------------ */

export type ExpenseInput = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>

export function ExpenseSheet({
  initial,
  today,
  settings,
  recentNames,
  clients,
  onSave,
  onDelete,
  onClose,
}: {
  initial?: Expense
  today: string
  settings: FinanceSettings
  recentNames: { name: string; category: CostCategory }[]
  clients: { id: string; name: string }[]
  onSave: (v: ExpenseInput) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}) {
  const [amountText, setAmountText] = useState(initial ? amountInputText(initial.amount, initial.currency) : '')
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? 'KRW')
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState<CostCategory>(initial?.category ?? 'etc')
  const [date, setDate] = useState(initial?.date ?? today)
  const [payMethod, setPayMethod] = useState<PayMethod>(initial?.payMethod ?? 'corp_card')
  const [clientId, setClientId] = useState(initial?.clientId ?? '')
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const yesterday = useMemo(() => {
    const d = new Date(`${today}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 1)
    return d.toISOString().slice(0, 10)
  }, [today])

  const save = async () => {
    const a = readAmount(amountText, currency)
    if (!a) return setError('금액을 적어 주세요.')
    setBusy(true)
    setError('')
    try {
      await onSave({ amount: a.amount, currency: a.currency, name: name.trim(), category, date, payMethod, clientId, memo: memo.trim() })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet
      title={initial ? '비용 고치기' : '비용 적기'}
      onClose={onClose}
      footer={
        <Button variant="primary" className="w-full" onClick={() => void save()} disabled={busy} data-testid="expense-save">
          {busy ? '저장 중…' : '저장'}
        </Button>
      }
    >
      <div className="flex flex-col gap-4" data-testid="expense-sheet">
        {!initial && <AiSoonButton size="sm" label="영수증 사진으로 적기" what="영수증 · 카드 결제 문자 사진을 읽어 금액 · 날짜 · 항목을 채워 줍니다" className="self-start" />}
        <AmountField text={amountText} onText={setAmountText} currency={currency} onCurrency={setCurrency} settings={settings} testid="expense-amount" />
        <Row label="무엇에 썼나요">
          <input id="expense-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 미팅 택시 · 네이버 광고" className={inputCls} />
          {recentNames.length > 0 && !initial && (
            <div className="flex flex-wrap gap-1.5" data-testid="expense-recent">
              {recentNames.map((r) => (
                <Chip
                  key={r.name}
                  on={name === r.name}
                  onClick={() => {
                    setName(r.name)
                    setCategory(r.category)
                  }}
                >
                  {r.name}
                </Chip>
              ))}
            </div>
          )}
        </Row>
        <Row label="분류">
          <div className="flex flex-wrap gap-1.5">
            {COST_CATEGORY_ORDER.map((c) => (
              <Chip key={c} on={category === c} onClick={() => setCategory(c)} testid={`expense-cat-${c}`}>
                {COST_CATEGORY_LABEL[c]}
              </Chip>
            ))}
          </div>
        </Row>
        <Row label="날짜">
          <div className="flex flex-wrap items-center gap-2">
            <Chip on={date === today} onClick={() => setDate(today)}>
              오늘
            </Chip>
            <Chip on={date === yesterday} onClick={() => setDate(yesterday)}>
              어제
            </Chip>
            <input type="date" id="expense-date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={`${inputCls} w-auto`} />
          </div>
        </Row>
        <Row label="결제 수단">
          <div className="flex flex-wrap gap-1.5">
            {PAY_KEYS.map((p) => (
              <Chip key={p} on={payMethod === p} onClick={() => setPayMethod(payMethod === p ? '' : p)}>
                {PAY_METHOD_LABEL[p]}
              </Chip>
            ))}
          </div>
        </Row>
        {clients.length > 0 && (
          <Row label="어느 업체 일인가요(선택)">
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls} data-testid="expense-client">
              <option value="">업체와 상관없음</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Row>
        )}
        <Row label="메모(선택)">
          <input value={memo} onChange={(e) => setMemo(e.target.value)} className={inputCls} />
        </Row>
        {error && (
          <p role="alert" className="t-sub rounded-(--radius-control) border border-danger-200 bg-danger-50 px-3 py-2 text-danger-700">
            {error}
          </p>
        )}
        {initial && onDelete && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {confirmDel ? (
              <>
                <span className="t-sub text-danger-700">이 비용을 지울까요?</span>
                <Button size="sm" variant="danger" onClick={() => void onDelete()} data-testid="expense-delete-yes">
                  네, 지우기
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDel(false)}>
                  아니요
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmDel(true)} data-testid="expense-delete">
                지우기
              </Button>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

/* ------------------------------------------------------------------ */
/* 정기 결제                                                              */
/* ------------------------------------------------------------------ */

export type SubscriptionInput = Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>

export function SubscriptionSheet({
  initial,
  today,
  settings,
  onSave,
  onDelete,
  onClose,
}: {
  initial?: Subscription
  today: string
  settings: FinanceSettings
  onSave: (v: SubscriptionInput) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState<CostCategory>(initial?.category ?? 'ai')
  const [amountText, setAmountText] = useState(initial ? amountInputText(initial.amount, initial.currency) : '')
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? 'USD')
  const [cycle, setCycle] = useState<Cycle>(initial?.cycle ?? 'monthly')
  const [day, setDay] = useState(initial?.billingDay ?? Number(today.slice(8, 10)))
  const [month, setMonth] = useState(initial?.billingMonth ?? Number(today.slice(5, 7)))
  const [payMethod, setPayMethod] = useState<PayMethod>(initial?.payMethod ?? 'corp_card')
  const [startDate, setStartDate] = useState(initial?.startDate ?? '')
  const [endDate, setEndDate] = useState(initial?.endDate ?? '')
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  const save = async (patch: Partial<SubscriptionInput> = {}) => {
    const a = readAmount(amountText, currency)
    if (!name.trim()) return setError('이름을 적어 주세요.')
    if (!a) return setError('금액을 적어 주세요.')
    setBusy(true)
    setError('')
    try {
      await onSave({ name: name.trim(), category, amount: a.amount, currency: a.currency, cycle, billingDay: day, billingMonth: month, payMethod, startDate, endDate, memo: memo.trim(), ...patch })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet
      title={initial ? '정기 결제 고치기' : '정기 결제 넣기'}
      onClose={onClose}
      footer={
        <Button variant="primary" className="w-full" onClick={() => void save()} disabled={busy} data-testid="sub-save">
          {busy ? '저장 중…' : '저장'}
        </Button>
      }
    >
      <div className="flex flex-col gap-4" data-testid="sub-sheet">
        {!initial && (
          <Row label="자주 쓰는 것">
            <div className="flex flex-wrap gap-1.5" data-testid="sub-presets">
              {SUBSCRIPTION_PRESETS.map((p) => (
                <Chip
                  key={p.name}
                  on={name === p.name}
                  onClick={() => {
                    setName(p.name)
                    setCategory(p.category)
                    setCurrency(p.currency)
                  }}
                >
                  {p.name}
                </Chip>
              ))}
            </div>
            <span className="t-meta text-slate-500">요금은 자주 바뀌어서 금액은 직접 적어 주세요.</span>
          </Row>
        )}
        <Row label="이름">
          <input id="sub-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: Claude Max · 사무실 인터넷" className={inputCls} />
        </Row>
        <AmountField text={amountText} onText={setAmountText} currency={currency} onCurrency={setCurrency} settings={settings} testid="sub-amount" />
        <Row label="언제 결제되나요">
          <div className="flex flex-wrap items-center gap-2">
            <Chip on={cycle === 'monthly'} onClick={() => setCycle('monthly')} testid="sub-monthly">
              매월
            </Chip>
            <Chip on={cycle === 'yearly'} onClick={() => setCycle('yearly')} testid="sub-yearly">
              해마다
            </Chip>
            {cycle === 'yearly' && (
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`${inputCls} w-auto`} aria-label="결제 달" data-testid="sub-month">
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}월
                  </option>
                ))}
              </select>
            )}
            <select value={day} onChange={(e) => setDay(Number(e.target.value))} className={`${inputCls} w-auto`} aria-label="결제일" data-testid="sub-day">
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}일
                </option>
              ))}
            </select>
          </div>
          {day > 28 && <span className="t-meta text-slate-500">그날이 없는 달에는 그 달 마지막 날로 셉니다.</span>}
        </Row>
        <Row label="분류">
          <div className="flex flex-wrap gap-1.5">
            {COST_CATEGORY_ORDER.map((c) => (
              <Chip key={c} on={category === c} onClick={() => setCategory(c)}>
                {COST_CATEGORY_LABEL[c]}
              </Chip>
            ))}
          </div>
        </Row>
        <Row label="결제 수단">
          <div className="flex flex-wrap gap-1.5">
            {PAY_KEYS.map((p) => (
              <Chip key={p} on={payMethod === p} onClick={() => setPayMethod(payMethod === p ? '' : p)}>
                {PAY_METHOD_LABEL[p]}
              </Chip>
            ))}
          </div>
        </Row>
        <Row label="쓰기 시작한 날(선택)">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${inputCls} w-auto`} />
          <span className="t-meta text-slate-500">비워 두면 지난달 비용에도 들어갑니다.</span>
        </Row>
        <Row label="메모(선택)">
          <input value={memo} onChange={(e) => setMemo(e.target.value)} className={inputCls} />
        </Row>
        {error && (
          <p role="alert" className="t-sub rounded-(--radius-control) border border-danger-200 bg-danger-50 px-3 py-2 text-danger-700">
            {error}
          </p>
        )}
        {initial && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            {endDate ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEndDate('')
                  void save({ endDate: '' })
                }}
                data-testid="sub-resume"
              >
                다시 쓰기
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEndDate(today)
                  void save({ endDate: today })
                }}
                data-testid="sub-cancel"
              >
                오늘 해지했어요
              </Button>
            )}
            {onDelete &&
              (confirmDel ? (
                <>
                  <span className="t-sub text-danger-700">지난 달 비용에서도 빠집니다. 지울까요?</span>
                  <Button size="sm" variant="danger" onClick={() => void onDelete()} data-testid="sub-delete-yes">
                    네, 지우기
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDel(false)}>
                    아니요
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirmDel(true)} data-testid="sub-delete">
                  지우기
                </Button>
              ))}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

/* ------------------------------------------------------------------ */
/* 환율                                                                  */
/* ------------------------------------------------------------------ */

export function RateSheet({ settings, onSave, onClose }: { settings: FinanceSettings; onSave: (s: FinanceSettings) => Promise<void>; onClose: () => void }) {
  const [text, setText] = useState(String(settings.usdKrw))
  const n = Number(text.replace(/[,\s원]/g, ''))
  const ok = Number.isFinite(n) && n >= 100 && n <= 10_000
  return (
    <BottomSheet
      title="달러 환율"
      onClose={onClose}
      footer={
        <Button variant="primary" className="w-full" disabled={!ok} onClick={() => void onSave({ usdKrw: Math.round(n * 100) / 100, rateSet: true })} data-testid="rate-save">
          저장
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="t-sub font-semibold text-slate-700">1달러 = 몇 원으로 셀까요</span>
          <input id="rate-input" value={text} onChange={(e) => setText(e.target.value)} inputMode="decimal" className={`${inputCls} t-section font-semibold tabular-nums`} />
        </label>
        <p className="t-sub text-slate-500">카드사가 실제로 청구한 환율과 조금 다를 수 있어요. 달러 결제를 원으로 환산할 때만 씁니다.</p>
      </div>
    </BottomSheet>
  )
}
