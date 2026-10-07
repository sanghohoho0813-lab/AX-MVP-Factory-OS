/**
 * 지원사업 2차 · 3차 거르기 (D-168) — '맞는 업체 n곳' 이 하루 수십 건이면 아무도 안 읽는다.
 *
 *   1차  지역 · 업력 · 업종(이미 있는 '맞는 업체가 있는 공고만')
 *   2차  금액 — 공고 글에서 업체당 금액을 규칙으로 읽는다(최대 5천만원 · 2,000만원 이내 · 1억 5천만원 · 월 80만원 × 12개월)
 *        '총 예산 10억' · '매출 10억 이상' 같은 조건 금액은 지원금으로 보지 않는다. 못 읽으면 '금액 안 적힘'.
 *   3차  선정 규모(30개사 · 10개 기업 내외) · 교육 · 설명회 · 행사 · 수요조사 빼기 · 마감까지 여유
 *
 * 규칙 계산이다(AI 아님). 숫자를 지어내지 않는다 — 글에 적힌 것만 읽는다.
 * 설정은 쓰는 사람 브라우저에 둔다(사람마다 보고 싶은 기준이 다르다). 거른 공고도 '거른 공고 보기' 로 언제든 본다.
 */
import { deadlineOf, type GrantNotice } from './grantMatch'

export interface GrantFilterSettings {
  /** 거르기 켜기 — 끄면 1차만(예전 화면 그대로) */
  on: boolean
  /** 업체당 최소 금액(만원). 0 = 상관없음 */
  minAmount: number
  /** 금액이 안 적힌 공고 숨기기 */
  hideNoAmount: boolean
  /** 최소 선정 규모(곳). 0 = 상관없음 */
  minSlots: number
  /** 선정 규모가 안 적힌 공고 숨기기 */
  hideNoSlots: boolean
  /** 교육 · 설명회 · 행사 · 공모전 · 수요조사 빼기 */
  skipEvents: boolean
  /** 마감까지 최소 며칠(날짜 마감만 — 선착순 · 상시는 그대로). 0 = 상관없음 */
  minDays: number
}

export const DEFAULT_GRANT_FILTER: GrantFilterSettings = {
  on: true,
  minAmount: 300,
  hideNoAmount: false,
  minSlots: 0,
  hideNoSlots: false,
  skipEvents: true,
  minDays: 0,
}

export const AMOUNT_STEPS = [0, 300, 1000, 3000, 5000, 10000] as const
export const SLOT_STEPS = [0, 5, 10, 30, 50] as const
export const DAY_STEPS = [0, 3, 7, 14] as const

/** 만원 → '300만원' · '1억원' · '1억 5천만원' */
export function manText(man: number): string {
  if (man >= 10000) {
    const eok = Math.floor(man / 10000)
    const rest = Math.round(man % 10000)
    return rest ? `${eok}억 ${rest % 1000 === 0 ? `${rest / 1000}천만` : `${rest.toLocaleString()}만`}원` : `${eok}억원`
  }
  if (man >= 1000 && man % 1000 === 0) return `${man / 1000}천만원`
  return `${Math.round(man).toLocaleString()}만원`
}

/* ------------------------------------------------------------------ */
/* 금액 읽기                                                             */
/* ------------------------------------------------------------------ */

const UNIT: Record<string, number> = { 억: 10000, 천만: 1000, 백만: 100, 만: 1, 천: 0.1 }
const num = (s: string) => Number(s.replace(/,/g, ''))

// 숫자 + 단위(+ 둘째 숫자 단위) + 원 — '5천만원' '1억 5천만 원' '2,000만원' '10,000,000원' '50백만원' '5,000천원'
const MONEY = /(\d[\d,]*(?:\.\d+)?)\s*(억|천만|백만|만|천)?\s*(?:(\d[\d,]*(?:\.\d+)?)\s*(천만|백만|만))?\s*원/g
// 지원금이 아닌 금액(자격 조건 · 전체 예산)
const NOT_SUPPORT_BEFORE = /(매출|자산|자본|수출액|수출실적|투자\s*유치|투자액|부채|총\s*사업비|총\s*예산|사업\s*예산|예산|총액|총)\s*[^\d]{0,6}$/
const NOT_SUPPORT_AFTER = /^\s*(이상|미만|초과)/
const PER_COMPANY = /(최대|업체당|기업당|과제당|개사당|社당|1개사|한도|이내|까지|1인당|인당|팀당)/

export interface AmountRead {
  /** 업체당 금액(만원) — 못 읽으면 null */
  man: number | null
  /** 화면에 보여 줄 글('최대 5천만원') — 읽은 그대로 */
  text: string
}

export function amountOf(n: Pick<GrantNotice, 'amountText' | 'title' | 'summary'>): AmountRead {
  const body = `${n.amountText} ${n.title} ${n.summary}`.replace(/\s+/g, ' ')
  const months = /(\d{1,2})\s*개월/.exec(body)
  type Hit = { man: number; strong: boolean; text: string }
  const hits: Hit[] = []
  for (const m of body.matchAll(MONEY)) {
    const at = m.index ?? 0
    const before = body.slice(Math.max(0, at - 14), at)
    const after = body.slice(at + m[0].length, at + m[0].length + 6)
    if (NOT_SUPPORT_BEFORE.test(before) || NOT_SUPPORT_AFTER.test(after)) continue
    let man = num(m[1]) * (m[2] ? UNIT[m[2]] : 1 / 10000) + (m[3] ? num(m[3]) * UNIT[m[4]] : 0)
    if (!Number.isFinite(man) || man <= 0) continue
    // 월 금액은 개월 수만큼(적힌 게 없으면 12개월로 본다)
    const monthly = /월\s*(?:최대\s*)?$/.test(before)
    if (monthly) man *= months ? Number(months[1]) : 12
    if (man < 10) continue // 1만원 미만(참가비 · 수수료 같은 것)은 지원금이 아니다
    const lead = /(최대|업체당|기업당|과제당|개사당|1인당|인당|팀당|월)\s*(?:최대\s*)?$/.exec(before)?.[0] ?? ''
    hits.push({ man, strong: PER_COMPANY.test(`${before.slice(-8)}${m[0]}${after}`), text: `${lead}${m[0]}`.trim() })
  }
  if (hits.length === 0) return { man: null, text: '' }
  const pool = hits.some((h) => h.strong) ? hits.filter((h) => h.strong) : hits
  const best = pool.reduce((a, b) => (b.man > a.man ? b : a))
  return { man: Math.round(best.man), text: n.amountText.trim() || best.text }
}

/* ------------------------------------------------------------------ */
/* 선정 규모 · 행사 읽기                                                  */
/* ------------------------------------------------------------------ */

const SLOTS = /(\d[\d,]*)\s*(?:여\s*)?(?:개\s*(?:사|기업|업체|팀|社|과제|소)|개사|社|곳)(?!\s*(?:이상의?\s*)?(?:거래|매출|고객))/g

/** 선정 규모(곳) — '30개사 내외' '10개 기업' '50곳'. 못 읽으면 null */
export function slotsOf(n: Pick<GrantNotice, 'title' | 'summary' | 'target'>): number | null {
  const body = `${n.title} ${n.summary} ${n.target}`.replace(/\s+/g, ' ')
  let best: number | null = null
  for (const m of body.matchAll(SLOTS)) {
    const at = m.index ?? 0
    // '1개사당' · '최대 3개사까지 컨소시엄' 은 규모가 아니다
    if (/^\s*당/.test(body.slice(at + m[0].length, at + m[0].length + 2))) continue
    const v = num(m[1])
    if (Number.isFinite(v) && v > 0 && v < 100000) best = Math.max(best ?? 0, v)
  }
  return best
}

const EVENT = /(설명회|세미나|포럼|컨퍼런스|콘퍼런스|간담회|아카데미|특강|강좌|교육생|교육\s*(?:과정|참가|운영|프로그램|신청|안내)|경진\s*대회|공모전|캠프|네트워킹|데모\s*데이|IR\s*데이|시상|포상|수요\s*조사|설문|참관|워크숍|워크샵|박람회\s*참관|행사\s*(?:개최|참가|안내))/

/** 교육 · 행사 · 수요조사 같은 공고인가 — 돈이 나오는 사업이 아니다. 공고 이름만 본다(개요의 '교육 포함' 은 빼지 않는다) */
export function eventWord(n: Pick<GrantNotice, 'title'>): string {
  return EVENT.exec(n.title)?.[1]?.replace(/\s+/g, ' ') ?? ''
}

/* ------------------------------------------------------------------ */
/* 거르기                                                                */
/* ------------------------------------------------------------------ */

export interface GrantFacts {
  amount: AmountRead
  slots: number | null
  event: string
}

export function factsOf(n: GrantNotice): GrantFacts {
  return { amount: amountOf(n), slots: slotsOf(n), event: eventWord(n) }
}

export type FilterStage = 2 | 3

export interface FilterVerdict {
  pass: boolean
  /** 걸린 단계 — 통과면 null */
  stage: FilterStage | null
  /** 왜 걸렸나(쉬운 말) */
  why: string
}

export function judgeGrant(n: GrantNotice, f: GrantFacts, s: GrantFilterSettings, today: string): FilterVerdict {
  if (!s.on) return { pass: true, stage: null, why: '' }
  // 2차 — 금액
  if (f.amount.man === null) {
    if (s.hideNoAmount) return { pass: false, stage: 2, why: '금액이 안 적힘' }
  } else if (s.minAmount > 0 && f.amount.man < s.minAmount) {
    return { pass: false, stage: 2, why: `금액 ${manText(f.amount.man)} < ${manText(s.minAmount)}` }
  }
  // 3차 — 행사 · 규모 · 여유
  if (s.skipEvents && f.event) return { pass: false, stage: 3, why: `${f.event} 공고` }
  if (f.slots === null) {
    if (s.hideNoSlots) return { pass: false, stage: 3, why: '선정 규모가 안 적힘' }
  } else if (s.minSlots > 0 && f.slots < s.minSlots) {
    return { pass: false, stage: 3, why: `선정 ${f.slots}곳 < ${s.minSlots}곳` }
  }
  if (s.minDays > 0) {
    const d = deadlineOf(n, today)
    if (n.deadlineKind === 'date' && d.days !== null && d.days < s.minDays) return { pass: false, stage: 3, why: `마감까지 ${Math.max(0, d.days)}일` }
  }
  return { pass: true, stage: null, why: '' }
}

/** 설정을 사람이 읽는 한 줄로 — '금액 300만원 이상 · 교육·행사 빼기' */
export function settingsLine(s: GrantFilterSettings): { stage2: string; stage3: string } {
  const a = [s.minAmount > 0 ? `${manText(s.minAmount)} 이상` : '', s.hideNoAmount ? '금액 적힌 것만' : ''].filter(Boolean).join(' · ')
  const b = [
    s.minSlots > 0 ? `${s.minSlots}곳 이상 선정` : '',
    s.hideNoSlots ? '규모 적힌 것만' : '',
    s.skipEvents ? '교육·행사 빼기' : '',
    s.minDays > 0 ? `마감 ${s.minDays}일 이상 남음` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  return { stage2: a || '상관없음', stage3: b || '상관없음' }
}

/* ------------------------------------------------------------------ */
/* 설정 저장(쓰는 사람 브라우저)                                           */
/* ------------------------------------------------------------------ */

const KEY = 'axmvp.grants.filter.v1'

export function normalizeFilter(raw: unknown): GrantFilterSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof GrantFilterSettings, unknown>>
  const pick = <T extends number>(v: unknown, steps: readonly T[], d: T): T => (steps.includes(v as T) ? (v as T) : d)
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
  const D = DEFAULT_GRANT_FILTER
  return {
    on: bool(r.on, D.on),
    minAmount: pick(r.minAmount, AMOUNT_STEPS as readonly number[], D.minAmount),
    hideNoAmount: bool(r.hideNoAmount, D.hideNoAmount),
    minSlots: pick(r.minSlots, SLOT_STEPS as readonly number[], D.minSlots),
    hideNoSlots: bool(r.hideNoSlots, D.hideNoSlots),
    skipEvents: bool(r.skipEvents, D.skipEvents),
    minDays: pick(r.minDays, DAY_STEPS as readonly number[], D.minDays),
  }
}

export function loadGrantFilter(scope: string): GrantFilterSettings {
  try {
    const raw = window.localStorage.getItem(`${KEY}:${scope}`)
    return normalizeFilter(raw ? JSON.parse(raw) : null)
  } catch {
    return { ...DEFAULT_GRANT_FILTER }
  }
}

export function saveGrantFilter(scope: string, s: GrantFilterSettings): void {
  try {
    window.localStorage.setItem(`${KEY}:${scope}`, JSON.stringify(s))
  } catch {
    /* 저장 공간이 막혀도 이번 화면에서는 그대로 쓴다 */
  }
}
