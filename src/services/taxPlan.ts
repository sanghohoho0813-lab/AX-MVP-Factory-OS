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
  ceoAge: '대표 나이(만)',
  bizYears: '대표가 회사를 경영한 햇수',
  bizAssetRatio: '가업자산 비율(%) — 사업과 무관한 자산을 뺀 몫',
} as const

export type ProfileKey = keyof typeof PROFILE_FIELDS
export type TaxProfile = Partial<Record<ProfileKey, string>>

export const CORP_BAND_OPTIONS = ['2억 이하', '2억 초과'] as const
export const CORP_TYPE_OPTIONS = ['일반법인', '부동산과다보유법인', '특수법인'] as const

/**
 * D-132: 가정값은 계산기 9종의 정의에서 읽는다 — 절세 설계가 따로 숫자를 적어 두지 않는다.
 * 계산기(원본)의 기본값이 바뀌면 절세 설계도 같이 바뀐다. 한 벌만 둔다.
 */
export function calcDefault(calcKey: string, fieldId: string): string {
  const calc = calculatorOf(calcKey)
  const v = calc ? defaultValues(calc)[fieldId] : undefined
  if (typeof v !== 'string') throw new Error(`계산기 ${calcKey} 에 ${fieldId} 칸이 없습니다`)
  return v
}

/** 법인세 절감률 — 01 대표이사 급여 계산기의 식에서 그대로 꺼낸다(과표 2억 이하 · 초과) */
const CORP_RATE = (() => {
  const r = computeSalary(1000000)
  return { low: r.corpSaveLow / r.annual, high: r.corpSaveHigh / r.annual }
})()

/** 절세 설계가 쓰는 가정 — 전부 계산기 정의의 기본값(단위 시험이 같은지 지킨다) */
export const ASSUMPTIONS = {
  /** 03 소득세: 인적공제 */
  personalDed: calcDefault('t9', 'inc_a_personalDed'),
  /** 07 가지급금: 인정이자율 · 4대보험 추가부담률 · 차입이자율 · 분석기간 */
  loanRate: calcDefault('t1', 'g_rate'),
  loanIns: calcDefault('t1', 'g_ins'),
  loanBorrow: calcDefault('t1', 'g_borrow'),
  loanYears: calcDefault('t1', 'g_years'),
  /** 02 퇴직급여: 지급배수(2019년까지 · 2020년부터) */
  retireMultPre: calcDefault('t6', 'r_mult_pre'),
  retireMultPost: calcDefault('t6', 'r_mult_post'),
  /** 09 비상장주식: 순손익가치 환원율 */
  valuationRate: calcDefault('t3', 'v_rate'),
  corpRateLow: CORP_RATE.low,
  corpRateHigh: CORP_RATE.high,
}

/** '1억 2천만' · '120,000,000' · '1.2억' · '300백만' → 원. 못 읽으면 0 */
export function wonOf(text: string | undefined): number {
  if (!text) return 0
  const t = text
    .replace(/(\d+(?:\.\d+)?)\s*백만/g, (_, n: string) => `${Number(n) * 100}만`)
    // '1억 5천' 은 말로는 1억 5천만 — 억 뒤의 '천' 만 천만으로 읽는다(그냥 '5천' 은 5천원인지 5천만원인지 몰라 읽지 않는다 — 칸 아래 '읽지 못했습니다')
    .replace(/억\s*(\d+)\s*천(?!만)/g, (_, n: string) => `억${n}천만`)
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
  /** 모르면 null — 짐작하지 않는다 */
  ceoAge: number | null
  bizYears: number | null
  /** 0~1. 안 적으면 1(100%)로 보고 ★ 표시 */
  bizAssetRatio: number
  bizAssetRatioGiven: boolean
}

export function viewProfile(p: TaxProfile): ProfileView {
  const incOf = (k: 'vInc0' | 'vInc1' | 'vInc2') => (p[k] && p[k]!.trim() !== '' ? wonOf(p[k]) : null)
  const band = p.corpBand === '2억 초과' ? '2억 초과' : '2억 이하'
  return {
    monthlySalary: Math.max(0, wonOf(p.monthlySalary)),
    ceoStartDate: /^\d{4}-\d{2}-\d{2}$/.test(p.ceoStartDate ?? '') ? p.ceoStartDate! : '',
    loanBalance: Math.max(0, wonOf(p.loanBalance)),
    retainedEarnings: Math.max(0, wonOf(p.retainedEarnings)),
    corpBand: band,
    corpRate: band === '2억 초과' ? CORP_RATE.high : CORP_RATE.low,
    totalShares: Math.floor(numOf(p.totalShares)),
    par: Math.max(0, wonOf(p.par)),
    perShareManual: Math.max(0, wonOf(p.perShareManual)),
    vRate: numOf(p.vRate, Number(ASSUMPTIONS.valuationRate)) || Number(ASSUMPTIONS.valuationRate),
    vAsset: Math.max(0, wonOf(p.vAsset)),
    vDebt: Math.max(0, wonOf(p.vDebt)),
    vReBook: Math.max(0, wonOf(p.vReBook)),
    vReFair: Math.max(0, wonOf(p.vReFair)),
    vType: (CORP_TYPE_OPTIONS as readonly string[]).includes(p.vType ?? '') ? p.vType! : '일반법인',
    vInc: [incOf('vInc0'), incOf('vInc1'), incOf('vInc2')],
    otherFinIncome: Math.max(0, wonOf(p.otherFinIncome)),
    estateRealEstate: Math.max(0, wonOf(p.estateRealEstate)),
    estateFinancial: Math.max(0, wonOf(p.estateFinancial)),
    estateOther: Math.max(0, wonOf(p.estateOther)),
    estateDebt: Math.max(0, wonOf(p.estateDebt)),
    spouseAlive: p.spouseAlive !== '없음',
    children: Math.max(0, Math.floor(numOf(p.children, 0))),
    priorGift: Math.max(0, wonOf(p.priorGift)),
    retireMult: Math.min(Number(ASSUMPTIONS.retireMultPost), Math.max(0, numOf(p.retireMult, Number(ASSUMPTIONS.retireMultPost)))),
    ceoAge: p.ceoAge && p.ceoAge.trim() !== '' ? Math.floor(numOf(p.ceoAge)) : null,
    bizYears: p.bizYears && p.bizYears.trim() !== '' ? numOf(p.bizYears) : null,
    bizAssetRatio: p.bizAssetRatio && p.bizAssetRatio.trim() !== '' ? Math.min(100, Math.max(0, numOf(p.bizAssetRatio))) / 100 : 1,
    bizAssetRatioGiven: !!(p.bizAssetRatio && p.bizAssetRatio.trim() !== ''),
  }
}

/** 만 나이 · 햇수 — YYYY-MM-DD 두 개 사이 */
export function fullYearsBetween(from: string, to: string): number | null {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from)
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to)
  if (!a || !b) return null
  let y = Number(b[1]) - Number(a[1])
  if (Number(b[2]) * 100 + Number(b[3]) < Number(a[2]) * 100 + Number(a[3])) y -= 1
  return y >= 0 ? y : null
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

export function profileSuggestions(record: ClientOpsRecord | null, profile: TaxProfile, today = ''): ProfileSuggestion[] {
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
  if (today) {
    const age = record.representativeBirth ? fullYearsBetween(record.representativeBirth, today) : null
    if (age !== null) put('ceoAge', String(age), '회사 정보 · 대표 생년월일')
    const years = record.establishedAt ? fullYearsBetween(record.establishedAt, today) : null
    if (years !== null) put('bizYears', String(years), '설립일부터 — 대표가 그때부터 경영했으면 그대로')
  }
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

/** 결과 줄의 글자 그대로 */
export function lineText(out: Output, blockId: string, k: string): string {
  return out.blocks.find((b) => b.id === blockId)?.lines.find((l) => l.k === k)?.v ?? ''
}

/**
 * D-132: 대조(proof) — 절세 설계가 보여 주는 숫자를 '같은 값으로 계산기에서 열었을 때' 나오는 줄과 맞춰 본다.
 * 화면에 '✓ 계산기 NN과 같은 숫자' 로 보이고, 단위 시험이 무작위 현황 수십 벌에서 전부 맞는지 본다.
 */
export interface Proof {
  calc: string
  sub: string
  values: Record<string, string>
  blockId: string
  k: string
  nth?: number
  /** 절세 설계가 쓴 숫자 */
  expect: number
}

export function checkProof(pf: Proof): { ok: boolean; got: number } {
  try {
    const got = lineWon(run(pf.calc, pf.sub, pf.values), pf.blockId, pf.k, pf.nth ?? 0)
    // 계산기는 원 단위로 반올림해 보여 준다 — 1원 안쪽은 같다
    return { ok: Number.isFinite(got) && Number.isFinite(pf.expect) && Math.abs(got - pf.expect) <= 1, got }
  } catch {
    return { ok: false, got: NaN }
  }
}

/** 계산기 번호 — 't9' → '03' */
export function calcNo(calcKey: string): string {
  return calculatorOf(calcKey)?.no ?? calcKey
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
    [`${p}_personalDed`]: ASSUMPTIONS.personalDed,
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
    autoMajor: lineText(out, 'inc_a_out1', '자동판정 참고값'),
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
  proof?: Proof | null
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
    proof: { calc: 't2', sub: 'main', values: { s_monthly: s(monthly) }, blockId: 's_corp', k: '세후 실수령액', expect: computeSalary(monthly).afterTax },
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

export type CashRouteKey = 'salary' | 'dividend' | 'shareSale' | 'shareBurn' | 'spouseBurn' | 'retire' | 'mix'

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
  /** ★ 확실하지 않아 세무사 검증이 필요한 것 — 화면에 별표로 */
  verify: string[]
  /** 다툼이 있는 방법 — 추천에서 빼고 맨 뒤 '검증 필요' 로 */
  unsafe?: boolean
  /** 돈을 받는 사람이 대표가 아닐 때(배우자) */
  receiver?: string
  /** D-132: 계산기 대조 — 같은 값으로 계산기를 열면 나오는 줄 */
  proof?: Proof | null
  /** D-132: 계산기 9종 밖의 식 · 가정이 들어간 곳(★) */
  outside?: string
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
  return { key, label, ok: false, reason, companyOut: 0, personalTax: 0, corpSaving: 0, netBurden: 0, net: 0, lines: [], conditions: [], basis, open: null, verify: [] }
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
    verify: [],
    proof: { calc: 't2', sub: 'main', values: { s_monthly: s(m1) }, blockId: 's_personal', k: '개인 부담 총액', expect: r1.personalTotal },
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
  return { dividend: d, tax: after.incomeTax - base, after: after.incomeTax, values: after.values }
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
    verify: [],
    proof: { calc: 't9', sub: 'inc_a', values: got.values, blockId: 'inc_a_out3', k: '종합소득세 총부담세액', expect: got.after },
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
  // 대주주 판정은 03 계산기의 '자동판정 참고값' 을 그대로 쓴다(지분율 · 보유 시가총액 기준 — 식을 따로 두지 않는다)
  const isMajor = t9({ today: c.today, qty: 0, price: V, acquire, totalShares: total, held: H }).autoMajor === '대주주'
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
    proof: { calc: 't9', sub: 'inc_a', values: r.values, blockId: 'inc_a_out1', k: '⑫ 양도소득세 총부담액', expect: r.gainTax },
    verify: ['회사가 사들인 주식을 보유 · 다시 팔 목적이어야 양도소득입니다 — 소각할 목적이면 의제배당(아래 "자사주 소각")으로 과세됩니다. 계약서 · 이사회 · 주주총회 결의 내용으로 판단'],
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
    r_mult_pre: ASSUMPTIONS.retireMultPre,
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
    verify: [],
    proof: { calc: 't9', sub: 'inc_a', values: r.values, blockId: 'inc_a_out2', k: '⑩ 퇴직소득세 총부담액', expect: r.retireTax },
    outside: '법인세 절감은 01 계산기의 법인세율(11% · 22%)을 퇴직금에 곱한 값',
  }
}

const SHARE_BURN_BASIS = [
  '03 2026 소득세 계산기(종합소득세)의 식 그대로 — 회사가 주식을 사서 소각하면 받은 돈 − 취득가가 배당(의제배당, 소득세법 §17②)이 되어 지금 급여와 합쳐 종합과세',
  '자기주식 취득은 배당가능이익 한도 안에서 · 주주총회 결의(상법 §341)',
  '1주당 가격은 09 비상장주식 가치평가(상증세법 §63)',
]

/** 자사주 소각(이익소각 · 감자) — 대표에게는 배당(의제배당). 양도(보유 목적)와 나란히 비교한다 */
function shareBurnRoute(c: Ctx, target: number): CashRoute {
  const label = '자사주 소각(의제배당)'
  const ceo = ceoOf(c.reg)
  const V = c.sv.perShare
  if (!ceo || ceo.shares <= 0) return failRoute('shareBurn', label, '주주명부에 대표 주식 수를 적어 주세요.', SHARE_BURN_BASIS)
  if (!(V > 0)) return failRoute('shareBurn', label, '1주당 가치를 알아야 합니다(자산 · 순이익 또는 직접 적기).', SHARE_BURN_BASIS)
  const H = ceo.shares
  const acquire = ceo.acquirePrice > 0 ? ceo.acquirePrice : c.p.par
  const r0 = computeSalary(c.p.monthlySalary)
  const base = t9({ today: c.today, salary: r0.annual, insDed: r0.insTotal, interest: c.p.otherFinIncome }).incomeTax
  const at = (q: number) => t9({ today: c.today, salary: r0.annual, insDed: r0.insTotal, interest: c.p.otherFinIncome, dividend: Math.max(0, q * (V - acquire)) })
  const f = (q: number) => q * V - (at(q).incomeTax - base)
  const all = f(H)
  if (all < target) return failRoute('shareBurn', label, `대표 주식을 다 소각해도 세후 ${fmt(all)}입니다.`, SHARE_BURN_BASIS)
  const q = Math.min(H, Math.ceil(solveUp(f, target, 0, H, H) ?? H))
  const r = at(q)
  const tax = r.incomeTax - base
  const out = q * V
  const ok = !(c.p.retainedEarnings > 0 && out > c.p.retainedEarnings)
  return {
    key: 'shareBurn',
    label,
    ok,
    reason: ok ? '' : `자기주식은 배당 가능한 이익(${fmt(c.p.retainedEarnings)}) 안에서만 살 수 있습니다(${fmt(out)} 필요).`,
    companyOut: out,
    personalTax: tax,
    corpSaving: 0,
    netBurden: tax,
    net: out - tax,
    lines: [`대표 주식 ${q.toLocaleString('ko-KR')}주 × 1주 ${fmt(V)} → 소각`, `의제배당 ${fmt(Math.max(0, q * (V - acquire)))} (받은 돈 − 취득가)`],
    conditions: [
      ...(ceo.acquirePrice > 0 ? [] : [c.p.par > 0 ? `취득가를 몰라 액면가(${fmt(c.p.par)})로 보았습니다.` : '취득가 · 액면가를 몰라 0원으로 보았습니다.']),
      ...(c.p.retainedEarnings === 0 ? ['배당 가능한 이익을 적으면 살 수 있는 한도를 가립니다.'] : []),
      '소각하면 다른 주주 지분율이 올라갑니다(주식 수가 줄어서).',
    ],
    basis: SHARE_BURN_BASIS,
    open: { calc: 't9', sub: 'inc_a', values: r.values, label: '03 소득세(1안)에서 열기' },
    proof: { calc: 't9', sub: 'inc_a', values: r.values, blockId: 'inc_a_out3', k: '종합소득세 총부담세액', expect: r.incomeTax },
    verify: ['의제배당에도 배당가산(Gross-up) · 배당세액공제를 적용해 계산했습니다 — 소각 재원(이익잉여금 · 자본잉여금)에 따라 달라질 수 있습니다'],
  }
}

/**
 * 배우자에게 주식을 증여한 뒤 회사가 사서 소각 — 컨설팅에서 흔히 쓰였지만 다툼이 있다.
 * 계산은 04 증여세 식 그대로, 의제배당은 증여가액 = 소각가라 0 으로 본다. 추천하지 않고 '★ 검증 필요' 로만.
 */
function spouseBurnRoute(c: Ctx, target: number): CashRoute {
  const label = '배우자 증여 후 소각'
  const ceo = ceoOf(c.reg)
  const V = c.sv.perShare
  const basis = [
    '04 증여세 계산기의 식 그대로 — 배우자 증여재산공제 6억(상증세법 §53, 10년 합산)',
    '배우자가 증여받은 값(시가)이 취득가가 되어, 같은 값에 소각하면 의제배당이 거의 없다는 계산',
  ]
  const verify = [
    '증여받은 주식을 곧 양도 · 소각하면 증여자(대표)의 취득가로 계산하는 이월과세(소득세법 §97의2, 2025년부터 주식 포함 · 1년)와 같은 취지로 과세될 수 있습니다',
    '소각 대금이 결국 대표에게 돌아가면 실질과세(국세기본법 §14)로 부인된 사례가 있습니다',
    '돈은 대표가 아니라 배우자에게 갑니다',
  ]
  if (!ceo || ceo.shares <= 0 || !(V > 0)) return { ...failRoute('spouseBurn', label, '대표 주식 수 · 1주당 가치를 알아야 합니다.', basis), unsafe: true, verify }
  const q = Math.min(ceo.shares, Math.ceil(target / V))
  const g = giftTax(V, q, 0, '배우자')
  return {
    key: 'spouseBurn',
    label,
    ok: q * V >= target,
    reason: q * V >= target ? '' : '대표 주식이 모자랍니다.',
    companyOut: q * V,
    personalTax: g.tax,
    corpSaving: 0,
    netBurden: g.tax,
    net: q * V - g.tax,
    lines: [`대표 → 배우자 ${q.toLocaleString('ko-KR')}주 증여(${fmt(q * V)}) → 회사가 사서 소각`, `증여세 ${fmt(g.tax)} · 의제배당 0원으로 계산`],
    conditions: ['추천하지 않습니다 — 세무사와 먼저 확인할 방법입니다.'],
    basis,
    open: { calc: 't5', sub: 'j2', values: g.values, label: '04 증여세 비교에서 열기' },
    proof: { calc: 't5', sub: 'j2', values: g.values, blockId: 'k_out', k: '납부할 증여세', expect: g.tax },
    outside: '의제배당 0원은 계산기 밖 가정(증여가액 = 소각가)',
    verify,
    unsafe: true,
    receiver: '배우자',
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
    verify: [],
    proof: null,
    outside: '01 급여 · 03 소득세 계산기 결과를 더한 것',
  }
}

export function cashPlan(p: ProfileView, reg: ShareholderRow[], sv: ShareValue, target: number, today: string): CashPlan {
  const notes: string[] = []
  if (!(target > 0)) return { target, routes: [], best: null, notes: ['가져올 금액(세후)을 적어 주세요.'] }
  const c: Ctx = { p, reg, sv, today }
  const routes: CashRoute[] = [salaryRoute(c, target), dividendRoute(c, target), shareSaleRoute(c, target), shareBurnRoute(c, target), retireRoute(c, target)]
  const mix = mixRoute(c, target)
  const bestSingle = routes.filter((r) => r.ok && r.key !== 'retire').sort((a, b) => a.netBurden - b.netBurden)[0]
  if (mix && (!bestSingle || mix.netBurden < bestSingle.netBurden - 1)) routes.push(mix)
  else notes.push('급여와 배당을 섞어도 한 가지 방법보다 싸지 않았습니다.')
  routes.push(spouseBurnRoute(c, target))
  if (p.monthlySalary === 0) notes.push('대표 월 급여(지금)를 적으면 모든 방법이 더 정확해집니다.')
  // 줄 세우기: 되는 것(순부담 적은 순) → 퇴직금(퇴임할 때만) → ★ 다툼 있는 방법 → 안 되는 것
  const rank = (r: CashRoute) => (r.unsafe ? 3 : !r.ok ? 2 : r.key === 'retire' ? 1 : 0)
  const ranked = [...routes].sort((a, b) => rank(a) - rank(b) || a.netBurden - b.netBurden)
  const best = ranked.find((r) => r.ok && !r.unsafe && r.key !== 'retire') ?? null
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

/** 가업승계 증여세 과세특례(조세특례제한법 §30의6) — 2023년 1월 1일 이후 증여분 기준 */
export const SUCCESSION = { deduction: 1e9, bracket: 1.2e10, lowRate: 0.1, highRate: 0.2 }

/** 특례 한도 — 부모가 가업을 경영한 기간 10년 300억 · 20년 400억 · 30년 600억 */
export function successionLimit(years: number | null): number {
  if (years === null) return 0
  return years >= 30 ? 6e10 : years >= 20 ? 4e10 : years >= 10 ? 3e10 : 0
}

/** 특례 세액 — (특례 가액 − 10억) 중 120억까지 10% · 넘는 부분 20% */
export function successionSpecialTax(specialValue: number): number {
  const base = Math.max(0, specialValue - SUCCESSION.deduction)
  return base <= SUCCESSION.bracket ? base * SUCCESSION.lowRate : SUCCESSION.bracket * SUCCESSION.lowRate + (base - SUCCESSION.bracket) * SUCCESSION.highRate
}

export type CheckState = 'ok' | 'no' | 'unknown'

export interface SuccessionResult {
  state: CheckState
  checks: { label: string; state: CheckState; note: string }[]
  limit: number
  specialValue: number
  excessValue: number
  specialTax: number
  excessTax: number
  total: number
  general: number
  saving: number
  lines: string[]
  verify: string[]
  basis: string[]
  /** 계산기 9종 밖의 식 */
  outside: string
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
  proof?: Proof | null
  /** 가업승계 증여세 과세특례와 비교 — 자녀에게 줄 때만 */
  succession: SuccessionResult | null
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
    ceoAfterPct: 0, recipientAfterPct: 0, lines: [], conditions: [], basis: GIFT_BASIS, open: null, succession: null,
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
    proof: { calc: 't5', sub: 'j2', values: g.values, blockId: 'k_out', k: '납부할 증여세', expect: g.tax },
    succession: who.relation === 'child' || who.relation === 'minor_child' ? successionPlan(p, who.relation, capped * V, g.tax, prior, rel) : null,
  }
}

const SUCCESSION_BASIS = [
  '조세특례제한법 §30의6 가업승계 증여세 과세특례(2023년 1월 1일 이후 증여분): 가업주식 가액에서 10억 공제 → 120억까지 10% · 넘는 부분 20%',
  '특례 한도: 부모가 가업을 경영한 기간 10년 이상 300억 · 20년 이상 400억 · 30년 이상 600억',
  '특례로 증여한 주식은 증여 뒤 기간과 관계없이 상속세 과세가액에 더해진다(가업상속공제 요건을 갖추면 그때 공제받을 수 있다)',
  '일반 증여세는 04 증여세 비교 계산기의 식 그대로',
]

function successionPlan(p: ProfileView, relation: ShareholderRelation, value: number, generalTax: number, prior: number, rel: string): SuccessionResult {
  const checks: SuccessionResult['checks'] = [
    {
      label: '증여자(대표) 60세 이상',
      state: p.ceoAge === null ? 'unknown' : p.ceoAge >= 60 ? 'ok' : 'no',
      note: p.ceoAge === null ? '대표 나이를 적어 주세요' : `만 ${p.ceoAge}세`,
    },
    {
      label: '받는 사람 18세 이상 자녀',
      state: relation === 'child' ? 'ok' : 'unknown',
      note: relation === 'child' ? '성년 자녀' : '미성년 자녀 — 18세 이상이면 됩니다',
    },
    {
      label: '대표가 10년 이상 계속 경영',
      state: p.bizYears === null ? 'unknown' : p.bizYears >= 10 ? 'ok' : 'no',
      note: p.bizYears === null ? '경영한 햇수를 적어 주세요' : `${p.bizYears}년`,
    },
    { label: '중소기업 · 중견기업(가업상속공제 대상 업종)', state: 'unknown', note: '업종 · 규모 확인 필요' },
  ]
  const state: CheckState = checks.some((c) => c.state === 'no') ? 'no' : checks.some((c) => c.state === 'unknown') ? 'unknown' : 'ok'
  const limit = successionLimit(p.bizYears !== null && p.bizYears >= 10 ? p.bizYears : 10)
  const specialValue = Math.min(value * p.bizAssetRatio, limit)
  const excessValue = Math.max(0, value - specialValue)
  const specialTax = successionSpecialTax(specialValue)
  const excessTax = excessValue > 0 ? giftTax(excessValue, 1, prior, rel).tax : 0
  const total = specialTax + excessTax
  const verify = [
    '금액 · 세율 · 한도는 2023년 개정 조세특례제한법 기준입니다 — 2026년 현재 그대로인지 확인',
    ...(p.bizAssetRatioGiven ? [] : ['가업자산 비율을 100%로 보았습니다 — 사업과 무관한 자산(임대 부동산 · 과다 현금 등) 몫은 특례가 안 되어 세금이 늘어납니다']),
    ...(excessValue > 0 ? ['특례를 넘는 부분을 일반 증여세로 따로 계산했습니다 — 실제 합산 방법은 세무사 확인'] : []),
    '특례에는 신고세액공제(3%)를 적용하지 않았습니다',
    '사후관리 5년(받은 사람이 가업에 종사 · 3년 안 대표이사 취임 · 지분 유지)을 어기면 일반 증여세와 이자를 추징합니다',
  ]
  return {
    state,
    checks,
    limit,
    specialValue,
    excessValue,
    specialTax,
    excessTax,
    total,
    general: generalTax,
    saving: generalTax - total,
    lines: [
      `특례 가액 ${eokOf(specialValue)}${excessValue > 0 ? ` · 특례 밖 ${eokOf(excessValue)}` : ''} (한도 ${eokOf(limit)})`,
      excessValue > 0 ? `특례 증여세 ${fmt(specialTax)} + 특례 밖 일반 증여세 ${fmt(excessTax)} = ${fmt(total)}` : `특례 증여세 ${fmt(specialTax)} ((특례 가액 − 10억) × 10%)`,
      `일반 증여세 ${fmt(generalTax)} → ${generalTax - total > 0 ? `${eokOf(generalTax - total)} 적음` : '차이 없음'}`,
    ],
    verify,
    basis: SUCCESSION_BASIS,
    outside: '조세특례제한법 §30의6 식 — 계산기 9종에 없는 식(일반 증여세는 04 식)',
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
  /** 가업상속공제(상증세법 §18의2)를 받으면 ★ — 대표가 10년 이상 경영했을 때만 */
  familyBiz: { deduction: number; tax: number; verify: string[]; proof: Proof; outside: string } | null
  lines: string[]
  conditions: string[]
  basis: string[]
  open: CalcOpen | null
  proof?: Proof | null
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
    return { ok: false, message: '대표 재산(부동산 · 금융 · 기타)이나 주식가치를 알아야 합니다.', estate: 0, shareValue: 0, taxNow: 0, withGift: null, familyBiz: null, lines: [], conditions: [], basis: INHERIT_BASIS, open: null }
  }
  const now = inheritTax(p, p.estateOther + shareValue, p.priorGift, 0)
  let withGift: InheritResult['withGift'] = null
  if (gift && gift.ok && gift.value > 0) {
    const left = p.estateOther + Math.max(0, shareValue - gift.value)
    const within10 = inheritTax(p, left, p.priorGift + gift.value, gift.tax).tax
    const after10 = inheritTax(p, left, 0, 0).tax
    withGift = { giftValue: gift.value, giftTax: gift.tax, within10, after10 }
  }
  let familyBiz: InheritResult['familyBiz'] = null
  if (shareValue > 0 && p.bizYears !== null && p.bizYears >= 10) {
    const deduction = Math.min(shareValue * p.bizAssetRatio, successionLimit(p.bizYears))
    const fbt = inheritTax(p, p.estateOther + shareValue - deduction, p.priorGift, 0)
    familyBiz = {
      deduction,
      tax: fbt.tax,
      proof: { calc: 't4', sub: 'i1', values: fbt.values, blockId: 'h_out', k: '납부할 상속세', expect: fbt.tax },
      outside: '공제액(상증세법 §18의2)은 계산기 9종 밖 — 공제한 뒤 상속세는 08 식',
      verify: [
        '가업상속공제 요건(대표가 10년 이상 경영 · 지분 40% 이상을 10년 이상 보유 · 대표이사 재직 기간, 상속인이 가업에 종사 · 대표이사 취임)을 모두 갖춰야 합니다',
        '사후관리 5년(가업 · 고용 · 지분 유지)을 어기면 추징합니다',
        '한도(10년 300억 · 20년 400억 · 30년 600억)와 가업자산 비율은 2023년 개정 기준 — 2026년 현재 확인',
      ],
    }
  }
  return {
    ok: true,
    message: '',
    estate,
    shareValue,
    taxNow: now.tax,
    withGift,
    familyBiz,
    lines: [
      `대표 재산 ${eokOf(estate)} (주식 ${eokOf(shareValue)} 포함) · 채무 ${eokOf(p.estateDebt)}`,
      `배우자 ${p.spouseAlive ? '있음' : '없음'} · 자녀 ${p.children}명`,
    ],
    conditions: ['주식가치는 오늘 값입니다 — 회사가 크면 상속 때 값도 커집니다.', '장례비는 최소 500만원, 공과금은 0원으로 보았습니다.'],
    basis: INHERIT_BASIS,
    open: { calc: 't4', sub: 'i1', values: now.values, label: '08 상속세에서 열기' },
    proof: { calc: 't4', sub: 'i1', values: now.values, blockId: 'h_out', k: '납부할 상속세', expect: now.tax },
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
  proof?: Proof | null
}

const LOAN_BASIS = [
  '07 가지급금 손실계산기의 식 그대로 — 인정이자(법인세법 시행령 §89, 07 계산기 기본 인정이자율)의 법인세 · 대표 소득세(상여처분) · 4대보험, 차입금이 있으면 지급이자 손금불산입(법인세법 §28)',
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
    g_principal: s(bal), g_rate: ASSUMPTIONS.loanRate, g_years: ASSUMPTIONS.loanYears, g_corp: String(Math.round(p.corpRate * 100)),
    g_inc: (marginal * 100).toFixed(1), g_ins: ASSUMPTIONS.loanIns, g_debt: '없음', g_borrow: ASSUMPTIONS.loanBorrow,
  }
  const out = run('t1', 'main', values)
  return {
    ok: true,
    message: '',
    yearLoss: lineWon(out, 'g_out', '연간 손실액 (1년차 기준)'),
    fiveYear: lineWon(out, 'g_out', '분석기간(5년) 누적손실'),
    tenYear: lineWon(out, 'g_out', '10년 방치 시 누적손실'),
    marginalPct: marginal * 100,
    lines: [`가지급금 ${fmt(bal)} · 인정이자 ${ASSUMPTIONS.loanRate}%(07 계산기 기본값) · 대표 한계세율 ${(marginal * 100).toFixed(1)}% · 회사 차입금 없음으로 가정`],
    basis: LOAN_BASIS,
    open: { calc: 't1', sub: 'main', values, label: '07 가지급금에서 열기' },
    proof: { calc: 't1', sub: 'main', values, blockId: 'g_out', k: '연간 손실액 (1년차 기준)', expect: lineWon(out, 'g_out', '연간 손실액 (1년차 기준)') },
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

export function retirePlan(p: ProfileView, today: string): RetireResult & { proof?: Proof | null } {
  if (!p.ceoStartDate) return { ok: false, message: '대표 취임일(퇴직금 기산일)을 적어 주세요.', limit: 0, tax: 0, net: 0, lines: [], basis: RETIRE_BASIS, open: null }
  if (!(p.monthlySalary > 0)) return { ok: false, message: '대표 월 급여(지금)를 적어 주세요 — 한도가 급여로 정해집니다.', limit: 0, tax: 0, net: 0, lines: [], basis: RETIRE_BASIS, open: null }
  const c: Ctx = { p, reg: [], sv: { perShare: 0, total: 0, totalShares: 0, source: 'none', result: null, notes: [] }, today }
  const limit = retireLimit(c, p.ceoStartDate)
  const r = t9({ today, retireAmt: limit, startDate: p.ceoStartDate })
  const limitValues = { r_start: p.ceoStartDate, r_end: today, r_mult_pre: ASSUMPTIONS.retireMultPre, r_mult_post: String(p.retireMult), r_avg1: s(p.monthlySalary * 12), r_avg2: s(p.monthlySalary * 12), r_avg3: s(p.monthlySalary * 12) }
  return {
    ok: true,
    message: '',
    limit,
    tax: r.retireTax,
    net: limit - r.retireTax,
    lines: [`취임 ${p.ceoStartDate} ~ 오늘 · 정관 배수 ${p.retireMult}배 · 최근 급여 = 지금 급여로 가정`],
    basis: RETIRE_BASIS,
    open: { calc: 't6', sub: 'p2', values: limitValues, label: '02 퇴직급여(한도)에서 열기' },
    proof: { calc: 't6', sub: 'p2', values: limitValues, blockId: 'r_out', k: '정관 규정 있을 시 퇴직소득한도', expect: limit },
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
  if (has(/자사주|자기주식|이익소각|소각/)) {
    add('cash')
    out.heard.push('자사주 — 양도(보유 목적)와 소각(의제배당) 비교')
  }
  if (has(/특례/) && !out.goals.includes('gift')) {
    add('gift')
    out.heard.push('가업승계 증여세 과세특례')
  }
  if (has(/퇴직|퇴임|은퇴/)) {
    add('retire')
    out.heard.push('퇴직금 한도 · 세금')
  }
  if (!out.loan && amount && (has(/현금|가져오|가져가|인출|빼|필요|쓰고|마련|받고\s*싶|자사주|자기주식|소각/) || out.goals.length === 0) && !(out.salary?.mode === 'net') && !(out.gift && (out.gift.mode === 'value' || out.gift.mode === 'budget'))) {
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
