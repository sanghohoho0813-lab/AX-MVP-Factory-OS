/**
 * 매출 · 비용 (D-142) — 순수 함수.
 *
 * 대표: "계약하면 받을 돈을 적어 두잖아 — 그걸 예상 매출로. 매월 AI 비용 등 며칠에 결제되는지, 자잘한 사업 비용을 한곳에 모으고 싶다."
 *
 *  매출  계약 수금 항목에서 바로 계산한다(따로 적지 않는다 — 두 벌이 되지 않게).
 *        입금 완료일이 그 달이면 '들어온 돈(실매출)', 받기로 한 날이 그 달이면 '들어올 예정(예상 매출)'.
 *        조건 대기(정책자금 조달 후 등)는 달에 넣지 않고 '시기 미정' 으로 따로 — D-140 과 같은 규칙.
 *        이번 달에는 날짜 지난 미수금 · 지금 청구할 수 있는 돈도 '들어올 예정' 에 넣는다(받아야 할 돈이므로).
 *  비용  정기 결제(매월 N일 · 해마다 N월 N일, 원 · 달러) + 그때그때 쓴 돈 + 영업자 수수료(준 날 기준).
 *        달러는 사람이 정한 환율로 원 환산한다(환율을 지어내지 않는다 — 기본값은 '가정' 으로 표시).
 */
import type { ClientOpsRecord, FeeItem } from '../../types/clientOps'
import { feeStateOf, fundingFactsOf } from '../feeStatus'

/* ------------------------------------------------------------------ */
/* 모양                                                                  */
/* ------------------------------------------------------------------ */

export type Currency = 'KRW' | 'USD'

export type CostCategory = 'ai' | 'software' | 'marketing' | 'office' | 'telecom' | 'travel' | 'meal' | 'outsourcing' | 'fee' | 'tax' | 'etc'

export const COST_CATEGORY_ORDER: CostCategory[] = ['ai', 'software', 'marketing', 'office', 'telecom', 'travel', 'meal', 'outsourcing', 'fee', 'tax', 'etc']

export const COST_CATEGORY_LABEL: Record<CostCategory, string> = {
  ai: 'AI 도구',
  software: '소프트웨어 · 서버',
  marketing: '광고 · 마케팅',
  office: '사무실 · 비품',
  telecom: '통신',
  travel: '교통 · 차량',
  meal: '식대 · 접대',
  outsourcing: '외주',
  fee: '수수료',
  tax: '세금 · 공과금',
  etc: '기타',
}

export type PayMethod = 'corp_card' | 'personal_card' | 'transfer' | 'cash' | 'auto' | ''

export const PAY_METHOD_LABEL: Record<Exclude<PayMethod, ''>, string> = {
  corp_card: '법인카드',
  personal_card: '개인카드',
  transfer: '계좌이체',
  cash: '현금',
  auto: '자동이체',
}

export type Cycle = 'monthly' | 'yearly'

/** 정기 결제 — 매월 N일(또는 해마다 N월 N일) 나가는 돈 */
export interface Subscription {
  id: string
  name: string
  category: CostCategory
  amount: number
  currency: Currency
  cycle: Cycle
  /** 결제일(1~31). 그 달에 없는 날(31일 · 2월 30일)이면 그 달 마지막 날 */
  billingDay: number
  /** 해마다 결제하는 달(1~12) — cycle 이 yearly 일 때 */
  billingMonth: number
  /** 쓰기 시작한 날(YYYY-MM-DD, 모르면 '') — 이 날 전 결제는 세지 않는다 */
  startDate: string
  /** 해지한 날(YYYY-MM-DD, 쓰는 중이면 '') — 이 날 뒤 결제는 세지 않는다 */
  endDate: string
  payMethod: PayMethod
  memo: string
  createdAt: string
  updatedAt: string
}

/** 그때그때 쓴 돈 */
export interface Expense {
  id: string
  date: string
  name: string
  category: CostCategory
  amount: number
  currency: Currency
  payMethod: PayMethod
  memo: string
  /** 어느 업체 일로 쓴 돈인가(없으면 '') */
  clientId: string
  createdAt: string
  updatedAt: string
}

export interface FinanceSettings {
  /** 1달러 = N원 — 사람이 정한다 */
  usdKrw: number
  /** 사람이 환율을 바꿨는가(아니면 화면에 '가정' 표시) */
  rateSet: boolean
}

export const DEFAULT_SETTINGS: FinanceSettings = { usdKrw: 1400, rateSet: false }

/** 자주 쓰는 정기 결제 — 이름 · 분류 · 통화만. 금액은 사람이 적는다(요금은 자주 바뀐다) */
export const SUBSCRIPTION_PRESETS: { name: string; category: CostCategory; currency: Currency }[] = [
  { name: 'ChatGPT', category: 'ai', currency: 'USD' },
  { name: 'Claude', category: 'ai', currency: 'USD' },
  { name: 'Gemini', category: 'ai', currency: 'KRW' },
  { name: 'Cursor', category: 'ai', currency: 'USD' },
  { name: 'Midjourney', category: 'ai', currency: 'USD' },
  { name: 'Perplexity', category: 'ai', currency: 'USD' },
  { name: 'Vercel', category: 'software', currency: 'USD' },
  { name: 'Supabase', category: 'software', currency: 'USD' },
  { name: 'GitHub', category: 'software', currency: 'USD' },
  { name: 'Google Workspace', category: 'software', currency: 'KRW' },
  { name: 'Notion', category: 'software', currency: 'USD' },
  { name: 'Canva', category: 'software', currency: 'KRW' },
]

/* ------------------------------------------------------------------ */
/* 날짜                                                                  */
/* ------------------------------------------------------------------ */

const YMD = /^\d{4}-\d{2}-\d{2}$/
export const isYmd = (s: unknown): s is string => typeof s === 'string' && YMD.test(s)
export const ymOf = (ymd: string) => ymd.slice(0, 7)

function lastDay(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function addMonths(ym: string, n: number): string {
  const y = Number(ym.slice(0, 4))
  const m = Number(ym.slice(5, 7)) - 1 + n
  const yy = y + Math.floor(m / 12)
  const mm = ((m % 12) + 12) % 12
  return `${yy}-${String(mm + 1).padStart(2, '0')}`
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86_400_000)
}

/** 이 정기 결제가 그 달(ym)에 결제되는 날 — 없으면 '' (연 결제의 다른 달 · 시작 전 · 해지 뒤) */
export function chargeDateIn(s: Pick<Subscription, 'cycle' | 'billingDay' | 'billingMonth' | 'startDate' | 'endDate'>, ym: string): string {
  const y = Number(ym.slice(0, 4))
  const m = Number(ym.slice(5, 7))
  if (s.cycle === 'yearly' && s.billingMonth !== m) return ''
  const day = Math.min(Math.max(1, Math.round(s.billingDay) || 1), lastDay(y, m))
  const date = `${ym}-${String(day).padStart(2, '0')}`
  if (isYmd(s.startDate) && date < s.startDate) return ''
  if (isYmd(s.endDate) && date > s.endDate) return ''
  return date
}

/** 다음 결제일(오늘 포함) — 해지했으면 '' */
export function nextCharge(s: Subscription, today: string): string {
  for (let i = 0; i < 14; i++) {
    const d = chargeDateIn(s, addMonths(ymOf(today), i))
    if (d && d >= today) return d
  }
  return ''
}

/** 쓰는 중인가 — 오늘 해지했으면 이미 해지한 것으로 본다(오늘 결제분은 비용에 남는다) */
export function isActiveSub(s: Pick<Subscription, 'endDate'>, today: string): boolean {
  return !isYmd(s.endDate) || s.endDate > today
}

/* ------------------------------------------------------------------ */
/* 돈                                                                    */
/* ------------------------------------------------------------------ */

export function toKrw(amount: number, currency: Currency, settings: FinanceSettings): number {
  return Math.round(currency === 'USD' ? amount * settings.usdKrw : amount)
}

/** "$20" · "28,000원" */
export function moneyText(amount: number, currency: Currency): string {
  if (currency === 'USD') return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return `${Math.round(amount).toLocaleString('ko-KR')}원`
}

/** 12억 3,400만원 · 8,000만원 · 28,000원 — 큰 돈은 억 · 만 */
export function krwShort(won: number): string {
  const sign = won < 0 ? '-' : ''
  const a = Math.abs(Math.round(won))
  // 100만원 아래는 정확히(비용은 몇천 원 단위가 중요하다), 그 위는 억 · 만
  if (a < 1_000_000) return `${sign}${a.toLocaleString('ko-KR')}원`
  const eok = Math.floor(a / 1e8)
  const man = Math.round((a % 1e8) / 1e4)
  if (eok > 0) return `${sign}${eok.toLocaleString('ko-KR')}억${man ? ` ${man.toLocaleString('ko-KR')}만` : ''}원`
  return `${sign}${man.toLocaleString('ko-KR')}만원`
}

/** 한 달 돈으로 치면 — 연 결제는 12로 나눈다(정기 결제 합계용) */
export function monthlyEquivalent(s: Subscription, settings: FinanceSettings): number {
  const k = toKrw(s.amount, s.currency, settings)
  return s.cycle === 'yearly' ? Math.round(k / 12) : k
}

/* ------------------------------------------------------------------ */
/* 매출 — 계약 수금 항목에서                                              */
/* ------------------------------------------------------------------ */

export type RevenueKind = 'received' | 'expected' | 'overdue'

export interface RevenueLine {
  clientId: string
  clientName: string
  feeId: string
  label: string
  amount: number
  kind: RevenueKind
  /** 입금일 또는 받기로 한 날('' 이면 지금 청구할 수 있는 날짜 없는 돈) */
  date: string
}

export interface MonthRevenue {
  ym: string
  received: number
  expected: number
  /** expected 중 날짜 지난 미수금(이번 달에만) */
  overdue: number
  lines: RevenueLine[]
}

const amountOf = (f: FeeItem) => (typeof f.amount === 'number' && Number.isFinite(f.amount) && f.amount > 0 ? f.amount : 0)

/** 그 달의 매출 — 들어온 돈 · 들어올 예정 */
export function revenueInMonth(records: readonly ClientOpsRecord[], ym: string, today: string): MonthRevenue {
  const lines: RevenueLine[] = []
  const isThisMonth = ym === ymOf(today)
  for (const r of records) {
    const funding = fundingFactsOf(r.fundingApplications)
    for (const f of r.fees) {
      const amount = amountOf(f)
      if (!amount) continue
      const base = { clientId: r.id, clientName: r.companyName, feeId: f.id, label: f.label, amount }
      if (f.receivedAt) {
        if (ymOf(f.receivedAt) === ym) lines.push({ ...base, kind: 'received', date: f.receivedAt })
        continue
      }
      if (r.archivedAt) continue // 보관한 업체의 못 받은 돈은 예상에 넣지 않는다
      const st = feeStateOf(f, today, funding)
      if (st === 'waiting' || st === 'undated') continue
      const due = isYmd(f.dueDate) ? f.dueDate : ''
      if (due && ymOf(due) === ym && due >= today) lines.push({ ...base, kind: 'expected', date: due })
      else if (isThisMonth && st === 'overdue') lines.push({ ...base, kind: 'overdue', date: due })
      else if (isThisMonth && st === 'claimable' && !due) lines.push({ ...base, kind: 'expected', date: '' })
    }
  }
  lines.sort((a, b) => (a.kind === 'received' ? 0 : 1) - (b.kind === 'received' ? 0 : 1) || (a.date || '9').localeCompare(b.date || '9') || a.clientName.localeCompare(b.clientName))
  const sum = (k: RevenueKind[]) => lines.filter((l) => k.includes(l.kind)).reduce((s, l) => s + l.amount, 0)
  return { ym, received: sum(['received']), expected: sum(['expected', 'overdue']), overdue: sum(['overdue']), lines }
}

/** 받을 시기가 정해지지 않은 예상 매출 — 조건 대기 · 날짜 없는 예전 항목 · 아직 수금 항목으로 안 나눈 계약금액 */
export interface UndatedRevenue {
  waiting: number
  undated: number
  unplanned: number
  total: number
  /** 업체별(큰 순) */
  byClient: { clientId: string; clientName: string; amount: number; why: string }[]
}

export function undatedRevenue(records: readonly ClientOpsRecord[], today: string): UndatedRevenue {
  let waiting = 0
  let undated = 0
  let unplanned = 0
  const byClient: UndatedRevenue['byClient'] = []
  for (const r of records) {
    if (r.archivedAt) continue
    const funding = fundingFactsOf(r.fundingApplications)
    let w = 0
    let u = 0
    let planned = 0
    for (const f of r.fees) {
      const a = amountOf(f)
      planned += a
      if (!a || f.receivedAt) continue
      const st = feeStateOf(f, today, funding)
      if (st === 'waiting') w += a
      else if (st === 'undated') u += a
    }
    const cash = r.contract?.cashAmount ?? 0
    const gap = cash > planned ? cash - planned : 0
    waiting += w
    undated += u
    unplanned += gap
    const sum = w + u + gap
    if (sum > 0) byClient.push({ clientId: r.id, clientName: r.companyName, amount: sum, why: [w ? '조건 대기' : '', u ? '받을 날 미정' : '', gap ? '아직 안 나눈 계약금액' : ''].filter(Boolean).join(' · ') })
  }
  byClient.sort((a, b) => b.amount - a.amount)
  return { waiting, undated, unplanned, total: waiting + undated + unplanned, byClient }
}

/* ------------------------------------------------------------------ */
/* 비용                                                                  */
/* ------------------------------------------------------------------ */

export type CostSource = 'subscription' | 'expense' | 'agent'

export interface CostLine {
  id: string
  source: CostSource
  date: string
  name: string
  category: CostCategory
  /** 원 환산 */
  krw: number
  /** 원래 금액 · 통화 */
  amount: number
  currency: Currency
  payMethod: PayMethod
  memo: string
  clientId: string
}

export interface MonthCost {
  ym: string
  total: number
  subscriptions: number
  expenses: number
  agent: number
  lines: CostLine[]
  byCategory: { category: CostCategory; krw: number }[]
}

export function costInMonth(
  input: { subscriptions: readonly Subscription[]; expenses: readonly Expense[]; records: readonly ClientOpsRecord[]; settings: FinanceSettings },
  ym: string,
): MonthCost {
  const { settings } = input
  const lines: CostLine[] = []
  for (const s of input.subscriptions) {
    const d = chargeDateIn(s, ym)
    if (!d || !(s.amount > 0)) continue
    lines.push({ id: `sub:${s.id}`, source: 'subscription', date: d, name: s.name, category: s.category, krw: toKrw(s.amount, s.currency, settings), amount: s.amount, currency: s.currency, payMethod: s.payMethod, memo: s.memo, clientId: '' })
  }
  for (const e of input.expenses) {
    if (!isYmd(e.date) || ymOf(e.date) !== ym || !(e.amount > 0)) continue
    lines.push({ id: `exp:${e.id}`, source: 'expense', date: e.date, name: e.name, category: e.category, krw: toKrw(e.amount, e.currency, settings), amount: e.amount, currency: e.currency, payMethod: e.payMethod, memo: e.memo, clientId: e.clientId })
  }
  // 영업자 수수료 — 실제로 준 날 기준(D-108 정산과 같은 돈)
  for (const r of input.records) {
    for (const f of r.fees) {
      const fee = typeof f.agentFee === 'number' && f.agentFee > 0 ? f.agentFee : 0
      if (!fee || !f.agentPaidAt || ymOf(f.agentPaidAt) !== ym) continue
      lines.push({ id: `agent:${r.id}:${f.id}`, source: 'agent', date: f.agentPaidAt, name: `영업자 수수료 · ${f.agentName || '영업자'} (${r.companyName} ${f.label})`, category: 'fee', krw: fee, amount: fee, currency: 'KRW', payMethod: '', memo: '', clientId: r.id })
    }
  }
  lines.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
  const sum = (src: CostSource) => lines.filter((l) => l.source === src).reduce((s, l) => s + l.krw, 0)
  const cat = new Map<CostCategory, number>()
  for (const l of lines) cat.set(l.category, (cat.get(l.category) ?? 0) + l.krw)
  return {
    ym,
    total: lines.reduce((s, l) => s + l.krw, 0),
    subscriptions: sum('subscription'),
    expenses: sum('expense'),
    agent: sum('agent'),
    lines,
    byCategory: [...cat.entries()].map(([category, krw]) => ({ category, krw })).sort((a, b) => b.krw - a.krw),
  }
}

/* ------------------------------------------------------------------ */
/* 한 달 요약 · 앞으로 몇 달                                              */
/* ------------------------------------------------------------------ */

export interface MonthSummary {
  ym: string
  revenue: MonthRevenue
  cost: MonthCost
  /** 들어온 돈 − 나간 돈 */
  netSoFar: number
  /** (들어온 돈 + 들어올 예정) − 나간 돈 */
  netExpected: number
}

export function monthSummary(
  input: { records: readonly ClientOpsRecord[]; subscriptions: readonly Subscription[]; expenses: readonly Expense[]; settings: FinanceSettings },
  ym: string,
  today: string,
): MonthSummary {
  const revenue = revenueInMonth(input.records, ym, today)
  const cost = costInMonth(input, ym)
  return { ym, revenue, cost, netSoFar: revenue.received - cost.total, netExpected: revenue.received + revenue.expected - cost.total }
}

/** 이번 달부터 n달 — 예상 매출 흐름 */
export function outlook(
  input: { records: readonly ClientOpsRecord[]; subscriptions: readonly Subscription[]; expenses: readonly Expense[]; settings: FinanceSettings },
  today: string,
  n = 6,
): MonthSummary[] {
  return Array.from({ length: n }, (_, i) => monthSummary(input, addMonths(ymOf(today), i), today))
}

/** 며칠 안에 결제될 정기 결제 (오늘 포함) — 오늘 화면 */
export function upcomingCharges(subs: readonly Subscription[], today: string, days = 3): { sub: Subscription; date: string; inDays: number }[] {
  return subs
    .filter((s) => isActiveSub(s, today) && s.amount > 0)
    .map((sub) => ({ sub, date: nextCharge(sub, today) }))
    .filter((x) => x.date && daysBetween(today, x.date) <= days)
    .map((x) => ({ ...x, inDays: daysBetween(today, x.date) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/* ------------------------------------------------------------------ */
/* 다듬기 · 내보내기                                                       */
/* ------------------------------------------------------------------ */

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const posNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0)
const cat = (v: unknown): CostCategory => (COST_CATEGORY_ORDER.includes(v as CostCategory) ? (v as CostCategory) : 'etc')
const cur = (v: unknown): Currency => (v === 'USD' ? 'USD' : 'KRW')
const pay = (v: unknown): PayMethod => (typeof v === 'string' && v in PAY_METHOD_LABEL ? (v as PayMethod) : '')

export function normalizeSubscription(raw: unknown, id: string, now: string): Subscription | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const name = str(r.name, 60)
  if (!name) return null
  const day = typeof r.billingDay === 'number' && r.billingDay >= 1 && r.billingDay <= 31 ? Math.round(r.billingDay) : 1
  const month = typeof r.billingMonth === 'number' && r.billingMonth >= 1 && r.billingMonth <= 12 ? Math.round(r.billingMonth) : 1
  return {
    id,
    name,
    category: cat(r.category),
    amount: posNum(r.amount),
    currency: cur(r.currency),
    cycle: r.cycle === 'yearly' ? 'yearly' : 'monthly',
    billingDay: day,
    billingMonth: month,
    startDate: isYmd(r.startDate) ? r.startDate : '',
    endDate: isYmd(r.endDate) ? r.endDate : '',
    payMethod: pay(r.payMethod),
    memo: str(r.memo, 200),
    createdAt: str(r.createdAt, 40) || now,
    updatedAt: str(r.updatedAt, 40) || now,
  }
}

export function normalizeExpense(raw: unknown, id: string, now: string): Expense | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const amount = posNum(r.amount)
  if (!amount || !isYmd(r.date)) return null
  return {
    id,
    date: r.date as string,
    name: str(r.name, 80) || COST_CATEGORY_LABEL[cat(r.category)],
    category: cat(r.category),
    amount,
    currency: cur(r.currency),
    payMethod: pay(r.payMethod),
    memo: str(r.memo, 300),
    clientId: str(r.clientId, 80),
    createdAt: str(r.createdAt, 40) || now,
    updatedAt: str(r.updatedAt, 40) || now,
  }
}

export function normalizeSettings(raw: unknown): FinanceSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const rate = typeof r.usdKrw === 'number' && r.usdKrw >= 100 && r.usdKrw <= 10_000 ? r.usdKrw : DEFAULT_SETTINGS.usdKrw
  return { usdKrw: rate, rateSet: r.rateSet === true }
}

/** '28,000' · '2.8만' · '1억 2천' · '$20' → 숫자. 못 읽으면 null */
export function parseAmount(text: string): { amount: number; currency: Currency } | null {
  const t = text.replace(/\s+/g, '').replace(/,/g, '')
  if (!t) return null
  if (/^\$|달러|usd$/i.test(t)) {
    const n = Number(t.replace(/[^\d.]/g, ''))
    return Number.isFinite(n) && n > 0 ? { amount: Math.round(n * 100) / 100, currency: 'USD' } : null
  }
  // '1억2천' · '3천만' · '2.8만' · '15000' — 단위를 앞에서부터 하나씩 먹는다
  const UNITS: [string, number][] = [['억', 1e8], ['천만', 1e7], ['백만', 1e6], ['만', 1e4], ['천', 1e3]]
  let rest = t.replace(/원$/, '')
  let won = 0
  let lastUnit = Infinity
  while (rest) {
    const m = /^(\d+(?:\.\d+)?)(억|천만|백만|만|천)?/.exec(rest)
    if (!m || m[0] === '') return null
    const n = Number(m[1])
    let unit = m[2] ? (UNITS.find((u) => u[0] === m[2]) as [string, number])[1] : 1
    // '1억2천' 의 천은 천만(억 다음 자리) — 억 바로 뒤에 오는 '천' · '백' 은 만 단위로 본다
    if (m[2] === '천' && lastUnit === 1e8) unit = 1e7
    if (unit >= lastUnit) return null
    won += n * unit
    lastUnit = unit
    rest = rest.slice(m[0].length)
  }
  return won > 0 ? { amount: Math.round(won), currency: 'KRW' } : null
}

/** 세무사에게 보낼 한 달 비용 (CSV · 엑셀에서 열림) */
export function costCsv(cost: MonthCost, clientName: (id: string) => string = () => ''): string {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = ['날짜', '항목', '분류', '원 환산', '원래 금액', '통화', '결제 수단', '구분', '업체', '메모']
  const src: Record<CostSource, string> = { subscription: '정기 결제', expense: '비용', agent: '영업자 수수료' }
  const rows = cost.lines.map((l) => [l.date, l.name, COST_CATEGORY_LABEL[l.category], l.krw, l.amount, l.currency, l.payMethod ? PAY_METHOD_LABEL[l.payMethod as Exclude<PayMethod, ''>] : '', src[l.source], l.clientId ? clientName(l.clientId) : '', l.memo])
  return '﻿' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
}
