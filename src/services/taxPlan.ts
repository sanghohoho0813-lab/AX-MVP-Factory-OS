/**
 * 절세 설계 (D-130) — "원하는 결과" 를 적으면 세금 계산기 9종의 식으로 거꾸로 찾는다.
 *
 * 원칙
 *  - `taxCalc.ts` 를 한 글자도 바꾸지 않는다. 계산기 정의의 compute() 를 **그대로** 부르고
 *    (원본 대조 qa:tax 가 지키는 식), 결과 줄의 숫자를 읽는다. 식을 새로 쓰지 않는다.
 *  - 목표값은 이분법으로 찾는다 — 계산기 05 의 solveLimit 과 같은 방법(세후 금액은 세전 금액이 늘면 는다).
 *  - 모든 결과에 근거(어느 계산기 · 어느 법 조항 · 어떤 가정)를 붙인다. 모르는 값은 짐작하지 않고 '가정' 으로 밝힌다.
 *  - 규칙 계산이다. 외부 호출 없음. 'AI' 라고 부르지 않는다. 결과는 참고용 — 실행 전 세무사 검토.
 */

import { calculatorOf, computeSalary, defaultValues, unlistedShareValuation, type Output, type UnlistedShareResult } from './taxCalc'
import { parseWonInput } from './customerFacts'
import type { ClientOpsRecord, ShareholderRelation, ShareholderRow } from '../types/clientOps'

/* ------------------------------------------------------------------ */
/* 현황 — 업체 기록 taxProfile(글자) ↔ 계산용 숫자                        */
/* ------------------------------------------------------------------ */

/** 업체 기록 taxProfile 의 칸 — 값은 사람이 적은 글자 그대로('1억 2천만' 도 된다) */
export const PROFILE_FIELDS = {
  monthlySalary: '대표 월 급여(지금)',
  ceoStartDate: '대표 취임일(퇴직금 기산일)',
  loanBalance: '가지급금 잔액',
  retainedEarnings: '배당 가능한 이익(미처분이익잉여금)',
  corpBand: '법인세 과세표준',
  totalShares: '발행주식 총수',
  par: '1주 액면가',
  perShareManual: '1주당 가치(직접 적기)',
  vRate: '순손익가치 환원율(%)',
  vAsset: '자산총계',
  vDebt: '부채총계',
  vReBook: '부동산 장부가',
  vReFair: '부동산 시가',
  vType: '법인 구분',
  vInc0: '순이익 — 2년 전',
  vInc1: '순이익 — 직전 연도',
  vInc2: '순이익 — 결산 연도',
  otherFinIncome: '대표의 다른 이자·배당(연)',
  estateRealEstate: '대표 부동산',
  estateFinancial: '대표 금융재산',
  estateOther: '대표 기타 재산',
  estateDebt: '대표 채무',
  spouseAlive: '배우자',
  children: '자녀 수',
  priorGift: '10년 안에 자녀에게 증여한 금액',
  retireMult: '정관 퇴직금 지급배수',
} as const

export type ProfileKey = keyof typeof PROFILE_FIELDS
export type TaxProfile = Partial<Record<ProfileKey, string>>

export const CORP_BAND_OPTIONS = ['2억 이하', '2억 초과'] as const
export const CORP_TYPE_OPTIONS = ['일반법인', '부동산과다보유법인', '특수법인'] as const

/** 법인세 절감 가정 — 01 계산기와 같은 숫자(과표 2억 이하 11% · 초과 22%, 지방소득세 포함) */
const CORP_RATE = { low: 0.11, high: 0.22 }

/** '1억 2천만' · '120,000,000' · '1.2억' · '300백만' → 원. 못 읽으면 0 */
export function wonOf(text: string | undefined): number {
  if (!text) return 0
  const t = text.replace(/(\d+(?:\.\d+)?)\s*백만/g, (_, n: string) => `${Number(n) * 100}만`)
  const v = parseWonInput(t)
  return v !== null && Number.isFinite(v) ? v : 0
}

function numOf(text: string | undefined, fallback = 0): number {
  if (!text || text.trim() === '') return fallback
  const n = Number(text.replace(/[,%\s]/g, ''))
  return Number.isFinite(n) ? n : fallback
}

export interface ProfileView {
  monthlySalary: number
  ceoStartDate: string
  loanBalance: number
  retainedEarnings: number
  corpRate: number
  corpBand: string
  totalShares: number
  par: number
  perShareManual: number
  vRate: number
  vAsset: number
  vDebt: number
  vReBook: number
  vReFair: number
  vType: string
  vInc: [number | null, number | null, number | null]
  otherFinIncome: number
  estateRealEstate: number
  estateFinancial: number
  estateOther: number
  estateDebt: number
  spouseAlive: boolean
  children: number
  priorGift: number
  retireMult: number
}

export function viewProfile(p: TaxProfile): ProfileView {
  const incOf = (k: 'vInc0' | 'vInc1' | 'vInc2') => (p[k] && p[k]!.trim() !== '' ? wonOf(p[k]) : null)
  const band = p.corpBand === '2억 초과' ? '2억 초과' : '2억 이하'
  return {
    monthlySalary: wonOf(p.monthlySalary),
    ceoStartDate: /^\d{4}-\d{2}-\d{2}$/.test(p.ceoStartDate ?? '') ? p.ceoStartDate! : '',
    loanBalance: wonOf(p.loanBalance),
    retainedEarnings: wonOf(p.retainedEarnings),
    corpBand: band,
    corpRate: band === '2억 초과' ? CORP_RATE.high : CORP_RATE.low,
    totalShares: Math.floor(numOf(p.totalShares)),
    par: wonOf(p.par),
    perShareManual: wonOf(p.perShareManual),
    vRate: numOf(p.vRate, 10) || 10,
    vAsset: wonOf(p.vAsset),
    vDebt: wonOf(p.vDebt),
    vReBook: wonOf(p.vReBook),
    vReFair: wonOf(p.vReFair),
    vType: (CORP_TYPE_OPTIONS as readonly string[]).includes(p.vType ?? '') ? p.vType! : '일반법인',
    vInc: [incOf('vInc0'), incOf('vInc1'), incOf('vInc2')],
    otherFinIncome: wonOf(p.otherFinIncome),
    estateRealEstate: wonOf(p.estateRealEstate),
    estateFinancial: wonOf(p.estateFinancial),
    estateOther: wonOf(p.estateOther),
    estateDebt: wonOf(p.estateDebt),
    spouseAlive: p.spouseAlive !== '없음',
    children: Math.max(0, Math.floor(numOf(p.children, 0))),
    priorGift: wonOf(p.priorGift),
    retireMult: Math.min(2, Math.max(0, numOf(p.retireMult, 2))),
  }
}

/* ------------------------------------------------------------------ */
/* 업체 기록에서 채우기 — 빈 칸만, 어디서 왔는지 함께                      */
/* ------------------------------------------------------------------ */

export interface ProfileSuggestion {
  key: ProfileKey
  value: string
  from: string
}

interface CretopStock {
  perShare: number
  shares: number
  total: number
}

/** 업체 기록에 붙은 가장 최근 크레탑 결과의 주식가치(09 식으로 계산된 것) */
export function cretopStockOf(record: ClientOpsRecord | null): CretopStock | null {
  if (!record) return null
  for (const r of record.toolResults) {
    if (r.toolKey !== 'cretop') continue
    const sv = (r.data as { stockValue?: { perShare?: unknown; shares?: unknown; total?: unknown } } | null)?.stockValue
    const perShare = Number(sv?.perShare)
    const shares = Number(sv?.shares)
    if (Number.isFinite(perShare) && perShare > 0) return { perShare, shares: Number.isFinite(shares) ? shares : 0, total: Number(sv?.total) || 0 }
  }
  return null
}

export function profileSuggestions(record: ClientOpsRecord | null, profile: TaxProfile): ProfileSuggestion[] {
  if (!record) return []
  const out: ProfileSuggestion[] = []
  const empty = (k: ProfileKey) => !profile[k] || profile[k]!.trim() === ''
  const fv = record.factValues
  const put = (k: ProfileKey, v: string | undefined, from: string) => {
    if (v && v.trim() !== '' && empty(k)) out.push({ key: k, value: v, from })
  }
  put('vAsset', fv.totalAssets, '회사 정보 · 자산')
  put('vDebt', fv.totalLiabilities, '회사 정보 · 부채')
  put('vInc2', fv.netIncome, '회사 정보 · 순이익(결산 연도로)')
  const cr = cretopStockOf(record)
  if (cr && cr.shares > 0) put('totalShares', String(cr.shares), '크레탑 보고서 · 발행주식수')
  if (record.establishedAt) put('ceoStartDate', record.establishedAt, '설립일 — 대표가 설립 때부터 임원이면 그대로')
  return out
}

/* ------------------------------------------------------------------ */
/* 주주명부                                                              */
/* ------------------------------------------------------------------ */

export const RELATION_LABEL: Record<ShareholderRelation, string> = {
  ceo: '대표',
  spouse: '배우자',
  child: '자녀(성년)',
  minor_child: '자녀(미성년)',
  parent: '부모',
  executive: '임원',
  relative: '친족',
  corp: '법인',
  other: '기타',
}

export interface SuggestedHolder {
  name: string
  relation: ShareholderRelation
  pct: number
}

/** 업체 기록의 주주 글('대표 60% · 배우자 25% · 김이사 15%')에서 이름 · 관계 · 지분율만 읽는다 — 주식 수는 짐작하지 않는다 */
export function holdersFromText(text: string, ceoName = ''): SuggestedHolder[] {
  const out: SuggestedHolder[] = []
  for (const m of text.matchAll(/([가-힣A-Za-z()（）·.\s]{1,20}?)\s*(\d+(?:\.\d+)?)\s*%/g)) {
    const raw = m[1].replace(/^[\s·,/]+|[\s·,/]+$/g, '').trim()
    if (!raw) continue
    const pct = Number(m[2])
    if (!(pct > 0 && pct <= 100)) continue
    const relation: ShareholderRelation = /대표|본인/.test(raw)
      ? 'ceo'
      : /배우자|아내|남편|부인|처$/.test(raw)
        ? 'spouse'
        : /미성년/.test(raw)
          ? 'minor_child'
          : /자녀|아들|딸|장남|장녀|차남|차녀/.test(raw)
            ? 'child'
            : /부친|모친|아버지|어머니|부모/.test(raw)
              ? 'parent'
              : /이사|임원|감사|전무|상무/.test(raw)
                ? 'executive'
                : /\(주\)|주식회사|법인|㈜/.test(raw)
                  ? 'corp'
                  : 'other'
    const name = relation === 'ceo' && ceoName ? ceoName : raw
    out.push({ name, relation, pct })
  }
  return out
}

export interface Holding {
  row: ShareholderRow
  ratio: number
  value: number
}

export interface ShareValue {
  /** 1주당 가치(원). 모르면 0 */
  perShare: number
  total: number
  totalShares: number
  source: 'manual' | '09' | 'none'
  result: UnlistedShareResult | null
  notes: string[]
}

export function totalSharesOf(p: ProfileView, reg: ShareholderRow[]): number {
  return p.totalShares > 0 ? p.totalShares : reg.reduce((a, r) => a + r.shares, 0)
}

/** 1주당 가치 — 직접 적은 값이 있으면 그것, 아니면 09 비상장주식 가치평가 식(같은 함수) */
export function shareValueOf(p: ProfileView, reg: ShareholderRow[]): ShareValue {
  const totalShares = totalSharesOf(p, reg)
  const notes: string[] = []
  if (p.perShareManual > 0) {
    return { perShare: p.perShareManual, total: p.perShareManual * totalShares, totalShares, source: 'manual', result: null, notes: ['1주당 가치는 직접 적은 값입니다.'] }
  }
  const anyInc = p.vInc.some((x) => x !== null)
  if (totalShares <= 0 || (p.vAsset <= 0 && !anyInc)) {
    if (totalShares <= 0) notes.push('발행주식 총수(또는 주주명부 주식 수)를 적으면 주식가치를 계산합니다.')
    else notes.push('자산 · 부채 · 순이익을 적으면 09 식으로 주식가치를 계산합니다.')
    return { perShare: 0, total: 0, totalShares, source: 'none', result: null, notes }
  }
  const missing = (['2년 전', '직전 연도', '결산 연도'] as const).filter((_, i) => p.vInc[i] === null)
  if (missing.length > 0) notes.push(`${missing.join(' · ')} 순이익이 없어 0원으로 계산했습니다 — 적으면 더 정확해집니다.`)
  const r = unlistedShareValuation({
    shares: totalShares,
    ratePct: p.vRate,
    asset: p.vAsset,
    debt: p.vDebt,
    reBook: p.vReBook,
    reFair: p.vReFair,
    severance: 0,
    goodwill: 0,
    corpType: p.vType,
    income: [p.vInc[0] ?? 0, p.vInc[1] ?? 0, p.vInc[2] ?? 0],
    months: [0, 0, 0],
    caps: [0, 0, 0],
  })
  if (r.autoType !== p.vType) notes.push(`부동산 비율로 보면 '${r.autoType}' 입니다 — 법인 구분을 확인하세요.`)
  return { perShare: Math.round(r.finalPerShare), total: Math.round(r.totalValue), totalShares, source: '09', result: r, notes }
}

export function holdingsOf(reg: ShareholderRow[], sv: ShareValue): Holding[] {
  const total = sv.totalShares
  return reg
    .filter((r) => r.shares > 0)
    .map((row) => ({ row, ratio: total > 0 ? row.shares / total : 0, value: row.shares * sv.perShare }))
}

export function ceoOf(reg: ShareholderRow[]): ShareholderRow | null {
  return reg.find((r) => r.relation === 'ceo') ?? null
}

/* ------------------------------------------------------------------ */
/* 계산기 부르기 — compute() 그대로, 결과 줄에서 숫자 읽기                  */
/* ------------------------------------------------------------------ */

/** 계산기에서 같은 숫자로 열 때 쓰는 값 묶음 */
export interface CalcOpen {
  calc: string
  sub: string
  values: Record<string, string>
  label: string
}

function run(calcKey: string, subKey: string, values: Record<string, string>): Output {
  const calc = calculatorOf(calcKey)
  const sub = calc?.subs.find((s) => s.key === subKey)
  if (!calc || !sub) throw new Error(`계산기 ${calcKey}/${subKey} 가 없습니다`)
  return sub.compute({ ...defaultValues(calc), ...values })
}

/** 결과 줄 '1,234원' → 1234. 없으면 NaN */
export function lineWon(out: Output, blockId: string, k: string, nth = 0): number {
  const lines = out.blocks.find((b) => b.id === blockId)?.lines.filter((l) => l.k === k) ?? []
  const v = lines[nth]?.v ?? ''
  const t = v.replace(/[,원\s]/g, '')
  if (t === '' || t === '-') return NaN
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

const s = (n: number) => String(Math.round(n))

/** f 가 늘어나는 함수일 때 f(x) ≥ target 인 가장 작은 x (계산기 05 solveLimit 과 같은 이분법) */
function solveUp(f: (x: number) => number, target: number, lo: number, hi: number, cap = 1e13): number | null {
  let h = hi
  while (f(h) < target) {
    if (h >= cap) return null
    h = Math.min(cap, h * 2 + 1)
  }
  let l = lo
  for (let i = 0; i < 70; i++) {
    const mid = (l + h) / 2
    if (f(mid) < target) l = mid
    else h = mid
  }
  return h
}

/* ---- 03 2026 소득세 계산기(양도 · 퇴직 · 종합) 한 벌 ---- */

interface T9In {
  today: string
  qty?: number
  price?: number
  acquire?: number
  totalShares?: number
  held?: number
  isMajor?: boolean
  sme?: boolean
  retireAmt?: number
  startDate?: string
  dividend?: number
  salary?: number
  interest?: number
  insDed?: number
}

function t9Values(i: T9In): Record<string, string> {
  const p = 'inc_a'
  return {
    [`${p}_qty`]: s(i.qty ?? 0),
    [`${p}_transferPrice`]: s(i.price ?? 0),
    [`${p}_acquirePrice`]: s(i.acquire ?? 0),
    [`${p}_transferDate`]: i.today,
    [`${p}_totalShares`]: s(i.totalShares ?? 0),
    [`${p}_heldShares`]: s(i.held ?? 0),
    [`${p}_isSme`]: i.sme === false ? '비중소기업' : '중소기업',
    [`${p}_under1yr`]: '1년이상',
    [`${p}_isMajor`]: i.isMajor ? '대주주' : '소액주주',
    [`${p}_basicDed`]: '여',
    [`${p}_retireAmt`]: s(i.retireAmt ?? 0),
    [`${p}_startDate`]: i.startDate || i.today,
    [`${p}_endDate`]: i.today,
    [`${p}_interest`]: s(i.interest ?? 0),
    [`${p}_dividend`]: s(i.dividend ?? 0),
    [`${p}_business`]: '0',
    [`${p}_salary`]: s(i.salary ?? 0),
    [`${p}_pension`]: '0',
    [`${p}_other`]: '0',
    [`${p}_personalDed`]: '1500000',
    [`${p}_otherDed`]: s(i.insDed ?? 0),
    [`${p}_specialCredit`]: '0',
    [`${p}_otherCredit`]: '0',
  }
}

function t9(i: T9In) {
  const values = t9Values(i)
  const out = run('t9', 'inc_a', values)
  return {
    gainTax: lineWon(out, 'inc_a_out1', '⑫ 양도소득세 총부담액'),
    retireTax: lineWon(out, 'inc_a_out2', '⑩ 퇴직소득세 총부담액'),
    incomeTax: lineWon(out, 'inc_a_out3', '종합소득세 총부담세액'),
    values,
  }
}

/* ------------------------------------------------------------------ */
/* 목표 1 — 급여 맞추기 (01 대표이사 급여 최적화 계산기)                    */
/* ------------------------------------------------------------------ */

export type SalaryMode = 'rate' | 'net' | 'min'

export interface SalaryGoal {
  mode: SalaryMode
  /** 개인 실효부담률 상한(%) */
  ratePct?: number
  /** 세후 월 실수령 목표(원) */
  netMonthly?: number
}

type Sal = ReturnType<typeof computeSalary>

export interface SalaryResult {
  ok: boolean
  message: string
  monthly: number
  r: Sal | null
  current: Sal | null
  best: { low: { m: number; r: Sal }; high: { m: number; r: Sal } }
  basis: string[]
  open: CalcOpen | null
}

function salaryGrid() {
  const rows: { m: number; r: Sal }[] = []
  for (let m = 1000000; m <= 20000000; m += 1000000) rows.push({ m, r: computeSalary(m) })
  let low = rows[0]
  let high = rows[0]
  for (const row of rows) {
    if (row.r.netOutLow < low.r.netOutLow) low = row
    if (row.r.netOutHigh < high.r.netOutHigh) high = row
  }
  return { low, high }
}

const SALARY_BASIS = [
  '01 대표이사 급여 최적화 계산기의 식 그대로 — 근로소득공제(소득세법 §47) · 기본세율(§55) · 근로소득세액공제(§59) · 지방소득세 10%',
  '국민연금 4.75%(상한 월 659만원) · 건강보험 3.595% · 장기요양 13.14% — 대표이사는 고용·산재보험 제외로 가정',
  '법인세 절감은 과표 2억 이하 11% · 초과 22%(지방소득세 포함)로 가정 — 01 계산기와 같다',
  '임원 보수는 정관 · 주주총회 결의 한도 안에서, 같은 직위 임원보다 지나치게 많으면 손금불산입될 수 있다(법인세법 시행령 §43)',
]

export function salaryPlan(p: ProfileView, goal: SalaryGoal): SalaryResult {
  const current = p.monthlySalary > 0 ? computeSalary(p.monthlySalary) : null
  const best = salaryGrid()
  const base = { current, best, basis: SALARY_BASIS }
  const finish = (monthly: number, message: string): SalaryResult => ({
    ...base,
    ok: true,
    message,
    monthly,
    r: computeSalary(monthly),
    open: { calc: 't2', sub: 'main', values: { s_monthly: s(monthly) }, label: '01 급여 최적화에서 열기' },
  })
  if (goal.mode === 'min') {
    const b = p.corpRate === CORP_RATE.high ? best.high : best.low
    return finish(b.m, `과표 ${p.corpBand} 법인에서 회사+대표가 함께 부담하는 돈(순유출)이 가장 적은 월 급여`)
  }
  if (goal.mode === 'rate') {
    const target = (goal.ratePct ?? 0) / 100
    if (!(target > 0)) return { ...base, ok: false, message: '실효부담률(%)을 적어 주세요.', monthly: 0, r: null, open: null }
    // 실효부담률은 국민연금 상한 때문에 한 방향으로만 늘지 않는다 — 10만원 단위로 다 훑고, 1천원 단위로 다듬는다
    let found = 0
    for (let m = 100000; m <= 100000000; m += 100000) if (computeSalary(m).effRate <= target) found = m
    if (found === 0) {
      const lowest = computeSalary(100000).effRate
      return { ...base, ok: false, message: `실효부담률 ${goal.ratePct}% 이하는 4대보험만으로도 넘습니다(월 10만원에서도 ${(lowest * 100).toFixed(1)}%).`, monthly: 0, r: null, open: null }
    }
    let m = found
    for (let x = found; x <= found + 100000; x += 1000) if (computeSalary(x).effRate <= target) m = x
    return finish(m, `개인 실효부담률 ${goal.ratePct}% 이하에서 가장 많이 받을 수 있는 월 급여`)
  }
  const netMonthly = goal.netMonthly ?? 0
  if (!(netMonthly > 0)) return { ...base, ok: false, message: '세후 월 실수령 목표를 적어 주세요.', monthly: 0, r: null, open: null }
  const m = solveUp((x) => computeSalary(x).afterTax / 12, netMonthly, 0, netMonthly * 2)
  if (m === null) return { ...base, ok: false, message: '찾지 못했습니다.', monthly: 0, r: null, open: null }
  return finish(Math.ceil(m / 1000) * 1000, `세후 월 ${Math.round(netMonthly).toLocaleString('ko-KR')}원을 받으려면 필요한 월 급여`)
}

/* ------------------------------------------------------------------ */
/* 목표 2 — 대표가 세후 N원 가져오기: 급여 · 배당 · 주식 양도 · 퇴직금 · 섞기  */
/* ------------------------------------------------------------------ */

export type CashRouteKey = 'salary' | 'dividend' | 'shareSale' | 'retire' | 'mix'

export interface CashRoute {
  key: CashRouteKey
  label: string
  ok: boolean
  /** 안 되는 까닭 · 모자란 값 */
  reason: string
  /** 회사에서 나가는 돈 */
  companyOut: number
  /** 대표가 내는 세금(4대보험 포함) */
  personalTax: number
  /** 회사가 덜 내는 법인세 */
  corpSaving: number
  /** 순부담 = 대표 세금 − 법인세 절감 */
  netBurden: number
  /** 대표 손에 남는 돈 */
  net: number
  lines: string[]
  conditions: string[]
  basis: string[]
  open: CalcOpen | null
}

export interface CashPlan {
  target: number
  routes: CashRoute[]
  best: CashRoute | null
  notes: string[]
}

const fmt = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
/** 큰 돈은 억 · 만으로 — '44억 4,000만원' */
function eokOf(n: number): string {
  const a = Math.abs(Math.round(n))
  const eok = Math.floor(a / 1e8)
  const man = Math.round((a % 1e8) / 1e4)
  const sign = n < 0 ? '-' : ''
  if (eok > 0) return `${sign}${eok.toLocaleString('ko-KR')}억${man > 0 ? ` ${man.toLocaleString('ko-KR')}만` : ''}원`
  if (man > 0) return `${sign}${man.toLocaleString('ko-KR')}만원`
  return fmt(n)
}

function failRoute(key: CashRouteKey, label: string, reason: string, basis: string[] = []): CashRoute {
  return { key, label, ok: false, reason, companyOut: 0, personalTax: 0, corpSaving: 0, netBurden: 0, net: 0, lines: [], conditions: [], basis, open: null }
}

interface Ctx {
  p: ProfileView
  reg: ShareholderRow[]
  sv: ShareValue
  today: string
}

function salaryRoute(c: Ctx, target: number): CashRoute & { newMonthly: number } {
  const m0 = c.p.monthlySalary
  const r0 = computeSalary(m0)
  const m1raw = solveUp((m) => computeSalary(m).afterTax - r0.afterTax, target, m0, m0 + target / 6)
  if (m1raw === null) return { ...failRoute('salary', '급여 올리기', '찾지 못했습니다.'), newMonthly: m0 }
  const m1 = Math.ceil(m1raw / 1000) * 1000
  const r1 = computeSalary(m1)
  const high = c.p.corpRate === CORP_RATE.high
  const personalTax = r1.personalTotal - r0.personalTotal
  const corpSaving = (high ? r1.corpSaveHigh : r1.corpSaveLow) - (high ? r0.corpSaveHigh : r0.corpSaveLow)
  return {
    key: 'salary',
    label: '급여 올리기(1년)',
    ok: true,
    reason: '',
    companyOut: r1.annual - r0.annual,
    personalTax,
    corpSaving,
    netBurden: personalTax - corpSaving,
    net: r1.afterTax - r0.afterTax,
    lines: [`월 급여 ${fmt(m0)} → ${fmt(m1)} (12개월)`, `개인 실효부담률 ${(r1.effRate * 100).toFixed(1)}%`],
    conditions: [
      ...(m0 === 0 ? ['지금 급여를 적지 않아 0원에서 올리는 것으로 계산했습니다 — 실제 세금은 더 많습니다.'] : []),
      '임원 보수 한도(정관 · 주주총회 결의) 안이어야 비용(손금)으로 인정됩니다.',
    ],
    basis: SALARY_BASIS,
    open: { calc: 't2', sub: 'main', values: { s_monthly: s(m1) }, label: '01 급여 최적화에서 열기' },
    newMonthly: m1,
  }
}

const DIVIDEND_BASIS = [
  '03 2026 소득세 계산기(종합소득세)의 식 그대로 — 지금 급여에 배당만 더했을 때 늘어나는 세금',
  '금융소득(이자+배당) 2천만원 초과분은 종합과세(소득세법 §14) · 배당가산(Gross-up) · 배당세액공제(§56) · 분리과세와 비교해 큰 세액(§62)',
  '배당은 법인 비용이 아니다 — 법인세 절감 없음',
  '배당은 배당 가능한 이익(상법 §462) 안에서만, 지분율대로(균등배당)',
]

function dividendToCeo(c: Ctx, salaryAnnual: number, insDed: number, target: number) {
  const base = t9({ today: c.today, salary: salaryAnnual, insDed, interest: c.p.otherFinIncome }).incomeTax
  const f = (d: number) => d - (t9({ today: c.today, salary: salaryAnnual, insDed, interest: c.p.otherFinIncome, dividend: d }).incomeTax - base)
  const draw = solveUp(f, target, 0, target * 1.2)
  if (draw === null) return null
  const d = Math.ceil(draw / 1000) * 1000
  const after = t9({ today: c.today, salary: salaryAnnual, insDed, interest: c.p.otherFinIncome, dividend: d })
  return { dividend: d, tax: after.incomeTax - base, values: after.values }
}

function dividendRoute(c: Ctx, target: number): CashRoute {
  const ceo = ceoOf(c.reg)
  const total = c.sv.totalShares
  const ratio = ceo && total > 0 ? ceo.shares / total : 1
  const r0 = computeSalary(c.p.monthlySalary)
  const got = dividendToCeo(c, r0.annual, r0.insTotal, target)
  if (!got) return failRoute('dividend', '배당', '찾지 못했습니다.', DIVIDEND_BASIS)
  const companyOut = ratio > 0 ? got.dividend / ratio : got.dividend
  const conditions = [
    ...(ceo ? [] : ['주주명부에 대표가 없어 대표 지분 100%로 계산했습니다.']),
    ...(ratio < 1 ? [`지분율대로 나누므로 다른 주주도 ${fmt(companyOut - got.dividend)}을 받습니다(그 주주의 세금은 따로).`] : []),
    '지분율과 다르게 나누는 차등배당은 증여 · 초과배당(§45의5) 과세 문제 — 세무사 확인.',
  ]
  let ok = true
  let reason = ''
  if (c.p.retainedEarnings > 0 && companyOut > c.p.retainedEarnings) {
    ok = false
    reason = `배당 가능한 이익 ${fmt(c.p.retainedEarnings)}보다 많이 필요합니다(${fmt(companyOut)}).`
  } else if (c.p.retainedEarnings === 0) conditions.push('배당 가능한 이익(미처분이익잉여금)을 적으면 된다 · 안 된다를 가립니다.')
  return {
    key: 'dividend',
    label: '배당',
    ok,
    reason,
    companyOut,
    personalTax: got.tax,
    corpSaving: 0,
    netBurden: got.tax,
    net: got.dividend - got.tax,
    lines: [`대표 배당 ${fmt(got.dividend)}${ratio < 1 ? ` (지분 ${(ratio * 100).toFixed(1)}% · 회사 전체 배당 ${fmt(companyOut)})` : ''}`],
    conditions,
    basis: DIVIDEND_BASIS,
    open: { calc: 't9', sub: 'inc_a', values: got.values, label: '03 소득세(1안)에서 열기' },
  }
}

const SHARE_SALE_BASIS = [
  '03 2026 소득세 계산기(양도소득세)의 식 그대로 — 비상장주식 양도(소득세법 §94) · 세율(§104: 중소기업 대주주 3억 이하 20% · 초과 25%, 소액 10%) · 지방소득세 10% · 증권거래세 0.35%',
  '대주주는 지분 4% 이상 또는 보유 10억원 이상(03 계산기 기준)',
  '1주당 가격은 09 비상장주식 가치평가(상증세법 §63 보충적 평가) — 시가로 거래해 저가 · 고가 이익증여(§35)를 피한다',
  '회사가 사들이면 자기주식 취득(상법 §341: 배당가능이익 한도 · 주주총회 결의). 소각 목적이면 의제배당(소득세법 §17②)으로 과세될 수 있다',
]

function shareSaleRoute(c: Ctx, target: number): CashRoute {
  const ceo = ceoOf(c.reg)
  const V = c.sv.perShare
  if (!ceo || ceo.shares <= 0) return failRoute('shareSale', '주식 팔기(자기주식 등)', '주주명부에 대표 주식 수를 적어 주세요.', SHARE_SALE_BASIS)
  if (!(V > 0)) return failRoute('shareSale', '주식 팔기(자기주식 등)', '1주당 가치를 알아야 합니다(자산 · 순이익 또는 직접 적기).', SHARE_SALE_BASIS)
  const H = ceo.shares
  const total = c.sv.totalShares
  const acquire = ceo.acquirePrice > 0 ? ceo.acquirePrice : c.p.par
  const isMajor = (total > 0 && H / total >= 0.04) || H * V >= 1e9
  const run1 = (q: number) => t9({ today: c.today, qty: q, price: V, acquire, totalShares: total, held: H, isMajor })
  const f = (q: number) => q * V - run1(q).gainTax
  const all = f(H)
  if (all < target) return failRoute('shareSale', '주식 팔기(자기주식 등)', `대표 주식을 다 팔아도 세후 ${fmt(all)}입니다.`, SHARE_SALE_BASIS)
  const qRaw = solveUp(f, target, 0, H, H)
  const q = Math.min(H, Math.ceil(qRaw ?? H))
  const r = run1(q)
  return {
    key: 'shareSale',
    label: '주식 팔기(자기주식 등)',
    ok: true,
    reason: '',
    companyOut: q * V,
    personalTax: r.gainTax,
    corpSaving: 0,
    netBurden: r.gainTax,
    net: q * V - r.gainTax,
    lines: [
      `대표 주식 ${q.toLocaleString('ko-KR')}주 × 1주 ${fmt(V)}`,
      `대표 지분 ${total > 0 ? ((H / total) * 100).toFixed(1) : '-'}% → ${total > 0 ? (((H - q) / total) * 100).toFixed(1) : '-'}%${isMajor ? ' · 대주주' : ''}`,
    ],
    conditions: [
      ...(ceo.acquirePrice > 0 ? [] : [c.p.par > 0 ? `취득가를 몰라 액면가(${fmt(c.p.par)})로 보았습니다.` : '취득가 · 액면가를 몰라 0원으로 보았습니다 — 세금이 실제보다 많게 나옵니다.']),
      '회사가 사들이면 배당가능이익 한도 · 주주총회 결의가 필요하고, 소각하면 의제배당으로 과세될 수 있습니다 — 세무사 확인.',
    ],
    basis: SHARE_SALE_BASIS,
    open: { calc: 't9', sub: 'inc_a', values: r.values, label: '03 소득세(1안)에서 열기' },
  }
}

const RETIRE_BASIS = [
  '03 2026 소득세 계산기(퇴직소득세)의 식 그대로 — 근속연수공제 · 환산급여공제 · 연분연승(소득세법 §48 · §55)',
  '임원 퇴직소득 한도(소득세법 §22③)는 02 퇴직급여 계산(임원퇴직급여산출액)의 식 — 넘는 부분은 근로소득',
  '정관 한도 안의 임원 퇴직금은 법인 비용(법인세법 시행령 §44) — 법인세 절감',
  '실제로 퇴임할 때만(현실적 퇴직) — 임원 퇴직금 중간정산은 법정 사유가 있을 때만 된다',
]

function retireLimit(c: Ctx, start: string): number {
  const annual = c.p.monthlySalary * 12
  const out = run('t6', 'p2', {
    r_start: start,
    r_end: c.today,
    r_mult_pre: '3',
    r_mult_post: String(c.p.retireMult),
    r_avg1: s(annual),
    r_avg2: s(annual),
    r_avg3: s(annual),
  })
  return lineWon(out, 'r_out', '정관 규정 있을 시 퇴직소득한도')
}

function retireRoute(c: Ctx, target: number): CashRoute {
  const start = c.p.ceoStartDate
  if (!start) return failRoute('retire', '퇴직금(퇴임 때)', '대표 취임일(퇴직금 기산일)을 적어 주세요.', RETIRE_BASIS)
  const f = (r: number) => r - t9({ today: c.today, retireAmt: r, startDate: start }).retireTax
  const raw = solveUp(f, target, 0, target * 1.2)
  if (raw === null) return failRoute('retire', '퇴직금(퇴임 때)', '찾지 못했습니다.', RETIRE_BASIS)
  const R = Math.ceil(raw / 1000) * 1000
  const r = t9({ today: c.today, retireAmt: R, startDate: start })
  const limit = c.p.monthlySalary > 0 ? retireLimit(c, start) : NaN
  const overLimit = Number.isFinite(limit) && R > limit
  return {
    key: 'retire',
    label: '퇴직금(퇴임 때)',
    ok: !overLimit,
    reason: overLimit ? `임원 퇴직금 한도 ${fmt(limit)}를 넘습니다 — 넘는 부분은 근로소득으로 과세됩니다.` : '',
    companyOut: R,
    personalTax: r.retireTax,
    corpSaving: R * c.p.corpRate,
    netBurden: r.retireTax - R * c.p.corpRate,
    net: R - r.retireTax,
    lines: [
      `퇴직금 ${fmt(R)} (취임 ${start} ~ 오늘)`,
      Number.isFinite(limit) ? `정관 배수 ${c.p.retireMult}배 한도 ${fmt(limit)}` : '지금 급여를 적으면 한도를 계산합니다',
      ...(r.retireTax - R * c.p.corpRate < 0 ? ['법인세가 줄어드는 것이 대표 세금보다 커서 순부담이 마이너스입니다.'] : []),
    ],
    conditions: [
      '실제로 퇴임할 때만 됩니다 — 지금 현금이 필요할 때 쓰는 길이 아닐 수 있습니다.',
      '정관에 임원 퇴직금 규정(지급배수)이 있어야 합니다.',
      ...(c.p.monthlySalary > 0 ? ['한도는 최근 급여가 지금 급여와 같았다고 보고 계산했습니다.'] : []),
    ],
    basis: RETIRE_BASIS,
    open: { calc: 't9', sub: 'inc_a', values: r.values, label: '03 소득세(1안)에서 열기' },
  }
}

/** 급여와 배당을 섞기 — 10% 간격으로 나눠 보고 순부담이 가장 적은 비율 */
function mixRoute(c: Ctx, target: number): CashRoute | null {
  const ceo = ceoOf(c.reg)
  const total = c.sv.totalShares
  const ratio = ceo && total > 0 ? ceo.shares / total : 1
  let best: { a: number; burden: number; sal: ReturnType<typeof salaryRoute>; div: NonNullable<ReturnType<typeof dividendToCeo>> } | null = null
  for (let k = 1; k <= 9; k++) {
    const a = k / 10
    const sal = salaryRoute(c, target * a)
    if (!sal.ok) continue
    const r1 = computeSalary(sal.newMonthly)
    const div = dividendToCeo(c, r1.annual, r1.insTotal, target * (1 - a))
    if (!div) continue
    const companyDiv = ratio > 0 ? div.dividend / ratio : div.dividend
    if (c.p.retainedEarnings > 0 && companyDiv > c.p.retainedEarnings) continue
    const burden = sal.netBurden + div.tax
    if (!best || burden < best.burden) best = { a, burden, sal, div }
  }
  if (!best) return null
  const companyDiv = ratio > 0 ? best.div.dividend / ratio : best.div.dividend
  return {
    key: 'mix',
    label: `섞기 — 급여 ${Math.round(best.a * 100)}% + 배당 ${Math.round((1 - best.a) * 100)}%`,
    ok: true,
    reason: '',
    companyOut: best.sal.companyOut + companyDiv,
    personalTax: best.sal.personalTax + best.div.tax,
    corpSaving: best.sal.corpSaving,
    netBurden: best.burden,
    net: best.sal.net + (best.div.dividend - best.div.tax),
    lines: [...best.sal.lines.slice(0, 1), `대표 배당 ${fmt(best.div.dividend)}`],
    conditions: ['급여 · 배당 각각의 조건을 모두 지켜야 합니다.'],
    basis: [...SALARY_BASIS.slice(0, 1), ...DIVIDEND_BASIS.slice(0, 2), '섞는 비율은 10% 간격으로 모두 계산해 순부담이 가장 적은 것을 골랐다'],
    open: null,
  }
}

export function cashPlan(p: ProfileView, reg: ShareholderRow[], sv: ShareValue, target: number, today: string): CashPlan {
  const notes: string[] = []
  if (!(target > 0)) return { target, routes: [], best: null, notes: ['가져올 금액(세후)을 적어 주세요.'] }
  const c: Ctx = { p, reg, sv, today }
  const routes: CashRoute[] = [salaryRoute(c, target), dividendRoute(c, target), shareSaleRoute(c, target), retireRoute(c, target)]
  const mix = mixRoute(c, target)
  const bestSingle = routes.filter((r) => r.ok).sort((a, b) => a.netBurden - b.netBurden)[0]
  if (mix && (!bestSingle || mix.netBurden < bestSingle.netBurden - 1)) routes.push(mix)
  else notes.push('급여와 배당을 섞어도 한 가지 방법보다 싸지 않았습니다.')
  if (p.monthlySalary === 0) notes.push('대표 월 급여(지금)를 적으면 모든 방법이 더 정확해집니다.')
  // 줄 세우기: 되는 것(순부담 적은 순) → 퇴직금(퇴임할 때만 — 지금 쓰는 길이 아닐 수 있어 뒤로) → 안 되는 것
  const rank = (r: CashRoute) => (!r.ok ? 2 : r.key === 'retire' ? 1 : 0)
  const ranked = [...routes].sort((a, b) => rank(a) - rank(b) || a.netBurden - b.netBurden)
  const best = ranked.find((r) => r.ok && r.key !== 'retire') ?? ranked.find((r) => r.ok) ?? null
  return { target, routes: ranked, best, notes }
}

/* ------------------------------------------------------------------ */
/* 목표 3 — 지분 증여 · 가업승계 (04 증여세 · 09 주식가치)                  */
/* ------------------------------------------------------------------ */

export type GiftMode = 'pct' | 'shares' | 'value' | 'budget' | 'free'

export interface GiftGoal {
  recipientId: string
  mode: GiftMode
  /** pct: 발행주식 대비 %, shares: 주 수, value: 원, budget: 증여세 상한(원) */
  amount: number
}

export interface GiftResult {
  ok: boolean
  message: string
  recipient: string
  rel: string
  qty: number
  value: number
  tax: number
  deduction: number
  taxFreeQty: number
  ceoAfterPct: number
  recipientAfterPct: number
  lines: string[]
  conditions: string[]
  basis: string[]
  open: CalcOpen | null
}

/** 주주명부 관계 → 04 계산기 '증여자와의 관계'(증여자 = 대표) */
export function giftRelOf(relation: ShareholderRelation): string {
  if (relation === 'spouse') return '배우자'
  if (relation === 'child') return '직계존속(성년)'
  if (relation === 'minor_child') return '직계존속(미성년)'
  if (relation === 'parent') return '직계비속'
  if (relation === 'relative') return '기타친족'
  return '타인'
}

const GIFT_BASIS = [
  '04 주식양수도 · 증여세 계산기(증여세 비교)의 식 그대로 — 증여재산공제(상증세법 §53: 배우자 6억 · 성년 자녀 5천만 · 미성년 2천만, 10년 합산) · 세율(§56 → §26 10~50%) · 10년 안 기증여 합산',
  '1주당 가치는 09 비상장주식 가치평가(상증세법 §63 · 시행령 §54 보충적 평가)',
  '신고 기한: 증여일이 속한 달의 말일부터 3개월. 신고세액공제(3%)는 계산기에 없다 — 실제 세액은 조금 적을 수 있다',
]

function giftTax(V: number, qty: number, prior: number, rel: string) {
  const values = { k_fair1: s(V), k_qty1: s(qty), k_prior1: s(prior), k_rel1: rel, k_fair2: '0', k_qty2: '0', k_prior2: '0', k_rel2: '타인' }
  const out = run('t5', 'j2', values)
  return { tax: lineWon(out, 'k_out', '납부할 증여세', 0), deduction: lineWon(out, 'k_out', '증여공제', 0), values }
}

export function giftPlan(p: ProfileView, reg: ShareholderRow[], sv: ShareValue, goal: GiftGoal): GiftResult {
  const ceo = ceoOf(reg)
  const who = reg.find((r) => r.id === goal.recipientId) ?? null
  const empty: GiftResult = {
    ok: false, message: '', recipient: who?.name ?? '', rel: '', qty: 0, value: 0, tax: 0, deduction: 0, taxFreeQty: 0,
    ceoAfterPct: 0, recipientAfterPct: 0, lines: [], conditions: [], basis: GIFT_BASIS, open: null,
  }
  if (!ceo || ceo.shares <= 0) return { ...empty, message: '주주명부에 대표 주식 수를 적어 주세요.' }
  if (!who) return { ...empty, message: '받는 사람을 주주명부에서 골라 주세요(아직 주식이 없으면 0주로 한 줄 넣으세요).' }
  const V = sv.perShare
  if (!(V > 0)) return { ...empty, message: '1주당 가치를 알아야 합니다(자산 · 순이익 또는 직접 적기).' }
  const T = sv.totalShares
  const rel = giftRelOf(who.relation)
  const prior = who.relation === 'child' || who.relation === 'minor_child' ? p.priorGift : 0
  const ded = giftTax(V, 0, 0, rel).deduction
  const taxFreeQty = Math.max(0, Math.floor((ded - prior) / V))
  let qty = 0
  if (goal.mode === 'pct') qty = Math.round((T * goal.amount) / 100)
  else if (goal.mode === 'shares') qty = Math.round(goal.amount)
  else if (goal.mode === 'value') qty = Math.floor(goal.amount / V)
  else if (goal.mode === 'free') qty = taxFreeQty
  else {
    // 증여세 상한 안에서 가장 많이
    let lo = 0
    let hi = ceo.shares
    if (giftTax(V, hi, prior, rel).tax <= goal.amount) lo = hi
    else
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2)
        if (giftTax(V, mid, prior, rel).tax <= goal.amount) lo = mid
        else hi = mid
      }
    qty = lo
  }
  const capped = Math.min(qty, ceo.shares)
  const g = giftTax(V, capped, prior, rel)
  const conditions = [
    ...(qty > ceo.shares ? [`대표 주식(${ceo.shares.toLocaleString('ko-KR')}주)보다 많아 대표 주식 전부로 계산했습니다.`] : []),
    ...(prior > 0 ? [`10년 안에 준 ${fmt(prior)}을 합산했습니다.`] : []),
    '가업승계 증여세 과세특례(조세특례제한법 §30의6 — 요건을 갖추면 10억 공제 뒤 낮은 세율)는 계산기에 없습니다 — 해당하면 세금이 크게 줄 수 있어 세무사 확인.',
    '증여 뒤 10년 안에 대표가 사망하면 이 증여는 상속재산에 다시 더해집니다(상증세법 §13).',
  ]
  return {
    ok: true,
    message: goal.mode === 'free' ? '증여세 없이(공제 한도 안에서) 줄 수 있는 만큼' : goal.mode === 'budget' ? `증여세 ${fmt(goal.amount)} 이하로 줄 수 있는 가장 많은 주식` : '',
    recipient: who.name,
    rel,
    qty: capped,
    value: capped * V,
    tax: g.tax,
    deduction: g.deduction,
    taxFreeQty,
    ceoAfterPct: T > 0 ? ((ceo.shares - capped) / T) * 100 : 0,
    recipientAfterPct: T > 0 ? ((who.shares + capped) / T) * 100 : 0,
    lines: [
      `${who.name}(${RELATION_LABEL[who.relation]})에게 ${capped.toLocaleString('ko-KR')}주 × 1주 ${fmt(V)} = ${fmt(capped * V)}`,
      `증여공제 ${fmt(g.deduction)} · 세금 없이 줄 수 있는 주식 ${taxFreeQty.toLocaleString('ko-KR')}주`,
    ],
    conditions,
    basis: GIFT_BASIS,
    open: { calc: 't5', sub: 'j2', values: g.values, label: '04 증여세 비교에서 열기' },
  }
}

/* ------------------------------------------------------------------ */
/* 목표 4 — 상속세 미리 보기 (08 상속세 계산기)                            */
/* ------------------------------------------------------------------ */

export interface InheritResult {
  ok: boolean
  message: string
  estate: number
  shareValue: number
  taxNow: number
  /** 계획한 증여가 있을 때 — 10년 안 상속(합산) · 10년 뒤 상속 */
  withGift: { giftValue: number; giftTax: number; within10: number; after10: number } | null
  lines: string[]
  conditions: string[]
  basis: string[]
  open: CalcOpen | null
}

const INHERIT_BASIS = [
  '08 상속세 계산기의 식 그대로 — 일괄공제 5억(상증세법 §21) · 배우자공제 최소 5억(§19) · 금융재산공제(§22) · 세율(§26) · 신고세액공제 3%(§69)',
  '대표 주식은 09 비상장주식 가치평가(§63) 값으로 기타재산에 넣었다(금융재산공제 대상 아님)',
  '10년 안에 상속인에게 준 증여는 상속재산에 더하고 낸 증여세를 뺀다(§13 · §28)',
  '배우자공제는 최소 5억으로 계산했다 — 배우자가 실제로 더 받으면 공제가 커질 수 있다',
]

function inheritTax(p: ProfileView, etc: number, gift: number, giftCredit: number) {
  const values = {
    h_re: s(p.estateRealEstate), h_fin: s(p.estateFinancial), h_etc: s(etc), h_gift: s(gift), h_exempt: '0',
    h_due: '0', h_funeral: '0', h_debt: s(p.estateDebt),
    h_spouse: p.spouseAlive ? '예' : '아니오', h_children: String(p.children), h_minor: '0', h_minor_yr: '0', h_old: '0', h_disabled: '0', h_disabled_yr: '0',
    h_spouse_actual: '0', h_spouse_legal: '0', h_house_ok: '아니오', h_house_val: '0', h_skip: '해당없음', h_gift_credit: s(giftCredit),
  }
  const out = run('t4', 'i1', values)
  return { tax: lineWon(out, 'h_out', '납부할 상속세'), values }
}

export function inheritancePlan(p: ProfileView, reg: ShareholderRow[], sv: ShareValue, gift: GiftResult | null): InheritResult {
  const ceo = ceoOf(reg)
  const shareValue = ceo && sv.perShare > 0 ? ceo.shares * sv.perShare : 0
  const estate = p.estateRealEstate + p.estateFinancial + p.estateOther + shareValue
  if (estate <= 0) {
    return { ok: false, message: '대표 재산(부동산 · 금융 · 기타)이나 주식가치를 알아야 합니다.', estate: 0, shareValue: 0, taxNow: 0, withGift: null, lines: [], conditions: [], basis: INHERIT_BASIS, open: null }
  }
  const now = inheritTax(p, p.estateOther + shareValue, p.priorGift, 0)
  let withGift: InheritResult['withGift'] = null
  if (gift && gift.ok && gift.value > 0) {
    const left = p.estateOther + Math.max(0, shareValue - gift.value)
    const within10 = inheritTax(p, left, p.priorGift + gift.value, gift.tax).tax
    const after10 = inheritTax(p, left, 0, 0).tax
    withGift = { giftValue: gift.value, giftTax: gift.tax, within10, after10 }
  }
  return {
    ok: true,
    message: '',
    estate,
    shareValue,
    taxNow: now.tax,
    withGift,
    lines: [
      `대표 재산 ${eokOf(estate)} (주식 ${eokOf(shareValue)} 포함) · 채무 ${eokOf(p.estateDebt)}`,
      `배우자 ${p.spouseAlive ? '있음' : '없음'} · 자녀 ${p.children}명`,
    ],
    conditions: ['주식가치는 오늘 값입니다 — 회사가 크면 상속 때 값도 커집니다.', '장례비는 최소 500만원, 공과금은 0원으로 보았습니다.'],
    basis: INHERIT_BASIS,
    open: { calc: 't4', sub: 'i1', values: now.values, label: '08 상속세에서 열기' },
  }
}

/* ------------------------------------------------------------------ */
/* 목표 5 — 가지급금 (07 가지급금 손실계산기)                              */
/* ------------------------------------------------------------------ */

export interface LoanResult {
  ok: boolean
  message: string
  yearLoss: number
  fiveYear: number
  tenYear: number
  marginalPct: number
  lines: string[]
  basis: string[]
  open: CalcOpen | null
}

const LOAN_BASIS = [
  '07 가지급금 손실계산기의 식 그대로 — 인정이자(법인세법 시행령 §89, 당좌대출이자율 4.6% 가정)의 법인세 · 대표 소득세(상여처분) · 4대보험, 차입금이 있으면 지급이자 손금불산입(법인세법 §28)',
  '대표 한계세율은 지금 급여로 01 계산기에서 구했다',
  '갚으려면 대표가 세후로 잔액만큼 필요하다 — "현금 가져오기" 목표로 가장 싼 길을 본다',
]

export function loanPlan(p: ProfileView): LoanResult {
  const bal = p.loanBalance
  if (!(bal > 0)) return { ok: false, message: '가지급금 잔액을 적어 주세요.', yearLoss: 0, fiveYear: 0, tenYear: 0, marginalPct: 0, lines: [], basis: LOAN_BASIS, open: null }
  const m0 = p.monthlySalary
  const a = computeSalary(m0)
  const b = computeSalary(m0 + 100000)
  const marginal = Math.min(0.495, Math.max(0.066, (b.finalTax + b.localTax - (a.finalTax + a.localTax)) / 1200000))
  const values = {
    g_principal: s(bal), g_rate: '4.6', g_years: '5', g_corp: String(Math.round(p.corpRate * 100)),
    g_inc: (marginal * 100).toFixed(1), g_ins: '9', g_debt: '없음', g_borrow: '4.6',
  }
  const out = run('t1', 'main', values)
  return {
    ok: true,
    message: '',
    yearLoss: lineWon(out, 'g_out', '연간 손실액 (1년차 기준)'),
    fiveYear: lineWon(out, 'g_out', '분석기간(5년) 누적손실'),
    tenYear: lineWon(out, 'g_out', '10년 방치 시 누적손실'),
    marginalPct: marginal * 100,
    lines: [`가지급금 ${fmt(bal)} · 인정이자 4.6% · 대표 한계세율 ${(marginal * 100).toFixed(1)}% · 회사 차입금 없음으로 가정`],
    basis: LOAN_BASIS,
    open: { calc: 't1', sub: 'main', values, label: '07 가지급금에서 열기' },
  }
}

/* ------------------------------------------------------------------ */
/* 목표 6 — 퇴직금 한도와 세금 (02 · 03)                                  */
/* ------------------------------------------------------------------ */

export interface RetireResult {
  ok: boolean
  message: string
  limit: number
  tax: number
  net: number
  lines: string[]
  basis: string[]
  open: CalcOpen | null
}

export function retirePlan(p: ProfileView, today: string): RetireResult {
  if (!p.ceoStartDate) return { ok: false, message: '대표 취임일(퇴직금 기산일)을 적어 주세요.', limit: 0, tax: 0, net: 0, lines: [], basis: RETIRE_BASIS, open: null }
  if (!(p.monthlySalary > 0)) return { ok: false, message: '대표 월 급여(지금)를 적어 주세요 — 한도가 급여로 정해집니다.', limit: 0, tax: 0, net: 0, lines: [], basis: RETIRE_BASIS, open: null }
  const c: Ctx = { p, reg: [], sv: { perShare: 0, total: 0, totalShares: 0, source: 'none', result: null, notes: [] }, today }
  const limit = retireLimit(c, p.ceoStartDate)
  const r = t9({ today, retireAmt: limit, startDate: p.ceoStartDate })
  return {
    ok: true,
    message: '',
    limit,
    tax: r.retireTax,
    net: limit - r.retireTax,
    lines: [`취임 ${p.ceoStartDate} ~ 오늘 · 정관 배수 ${p.retireMult}배 · 최근 급여 = 지금 급여로 가정`],
    basis: RETIRE_BASIS,
    open: {
      calc: 't6',
      sub: 'p2',
      values: { r_start: p.ceoStartDate, r_end: today, r_mult_pre: '3', r_mult_post: String(p.retireMult), r_avg1: s(p.monthlySalary * 12), r_avg2: s(p.monthlySalary * 12), r_avg3: s(p.monthlySalary * 12) },
      label: '02 퇴직급여(한도)에서 열기',
    },
  }
}

/* ------------------------------------------------------------------ */
/* 문장으로 적기 — 낱말 규칙으로 목표 · 금액 · 비율을 읽는다(외부 호출 없음)     */
/* ------------------------------------------------------------------ */

export type GoalKey = 'salary' | 'cash' | 'gift' | 'inherit' | 'loan' | 'retire'

export const GOAL_LABEL: Record<GoalKey, string> = {
  cash: '대표가 현금 가져오기',
  salary: '급여 맞추기',
  gift: '지분 증여 · 가업승계',
  inherit: '상속세 미리 보기',
  loan: '가지급금 정리',
  retire: '퇴직금 한도 · 세금',
}

export interface ParsedGoal {
  goals: GoalKey[]
  cash?: number
  salary?: SalaryGoal
  gift?: { mode: GiftMode; amount: number }
  loan?: number
  heard: string[]
}

const MONEY_RE = /(?:\d[\d,]*(?:\.\d+)?\s*(?:억|천만|백만|만)\s*)+(?:\d[\d,]*\s*)?원?|\d{1,3}(?:,\d{3})+\s*원?|\d+\s*원/g

export function parseGoalText(text: string): ParsedGoal {
  const t = text.trim()
  const out: ParsedGoal = { goals: [], heard: [] }
  if (!t) return out
  const amounts = [...t.matchAll(MONEY_RE)].map((m) => wonOf(m[0].replace(/\s/g, ''))).filter((n) => n > 0)
  const pctM = /(\d+(?:\.\d+)?)\s*(?:%|퍼센트|프로)/.exec(t)
  const pctVal = pctM ? Number(pctM[1]) : null
  const amount = amounts[0] ?? null
  const add = (g: GoalKey) => {
    if (!out.goals.includes(g)) out.goals.push(g)
  }
  const has = (re: RegExp) => re.test(t)

  if (has(/가지급금/)) {
    add('loan')
    if (amount) {
      out.loan = amount
      out.cash = amount
      add('cash')
      out.heard.push(`가지급금 ${fmt(amount)} — 갚는 데 필요한 돈을 가장 싸게 가져오는 길까지`)
    } else out.heard.push('가지급금 정리')
  }
  if (has(/급여|월급|연봉|보수/)) {
    add('salary')
    if (pctVal !== null && has(/실효|부담|세율|%|퍼센트|프로/)) {
      out.salary = { mode: 'rate', ratePct: pctVal }
      out.heard.push(`급여 — 개인 실효부담률 ${pctVal}% 이하`)
    } else if (amount && has(/세후|실수령|손에|받고/)) {
      const monthly = has(/연\s*\d|연봉|1년/) ? amount / 12 : amount
      out.salary = { mode: 'net', netMonthly: monthly }
      out.heard.push(`급여 — 세후 월 ${fmt(monthly)}`)
    } else if (has(/최적|적정|가장/)) {
      out.salary = { mode: 'min' }
      out.heard.push('급여 — 회사+대표 부담이 가장 적은 급여')
    } else out.heard.push('급여 맞추기')
  }
  if (has(/증여|물려|넘기|넘겨|승계|자녀에게|아들에게|딸에게/)) {
    add('gift')
    if (pctVal !== null && !out.salary) {
      out.gift = { mode: 'pct', amount: pctVal }
      out.heard.push(`지분 ${pctVal}% 증여`)
    } else if (has(/세금\s*없이|비과세|공제\s*안|공제\s*한도/)) {
      out.gift = { mode: 'free', amount: 0 }
      out.heard.push('증여세 없이 줄 수 있는 만큼')
    } else if (amount && has(/증여세\s*[\d,.]|세금\s*[\d,.]/)) {
      out.gift = { mode: 'budget', amount }
      out.heard.push(`증여세 ${fmt(amount)} 이하로 가장 많이`)
    } else if (amount && !out.cash) {
      out.gift = { mode: 'value', amount }
      out.heard.push(`주식 ${fmt(amount)}어치 증여`)
    } else out.heard.push('지분 증여')
    if (has(/승계/)) add('inherit')
  }
  if (has(/상속/)) {
    add('inherit')
    out.heard.push('상속세 미리 보기')
  }
  if (has(/퇴직|퇴임|은퇴/)) {
    add('retire')
    out.heard.push('퇴직금 한도 · 세금')
  }
  if (!out.loan && amount && (has(/현금|가져오|가져가|인출|빼|필요|쓰고|마련|받고\s*싶/) || out.goals.length === 0) && !(out.salary?.mode === 'net') && !out.gift?.amount) {
    add('cash')
    out.cash = amount
    out.heard.push(`대표가 세후 ${fmt(amount)} 가져오기 — 급여 · 배당 · 주식 · 퇴직금 비교`)
  }
  return out
}

/* ------------------------------------------------------------------ */
/* 업체 기록 · 카톡에 붙일 글                                             */
/* ------------------------------------------------------------------ */

export function planSummary(parts: { title: string; lines: string[] }[]): string {
  const out = ['[절세 설계 — 원하는 결과로 찾기]']
  for (const p of parts) {
    out.push('', `■ ${p.title}`)
    for (const l of p.lines) out.push(`  ${l}`)
  }
  out.push('', '세금 계산기 9종(기업지원단 배포본)과 같은 식으로 계산했습니다. 참고용이며 실행 전 담당 세무사 검토가 필요합니다.')
  return out.join('\n')
}
