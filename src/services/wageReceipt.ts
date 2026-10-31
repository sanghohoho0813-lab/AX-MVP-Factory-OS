/**
 * D-342 근로소득 원천징수영수증(지급명세서) · 급여대장 → 대표 월 급여.
 *
 * 절세 설계 · 맞춤 추천의 퇴직금 · 급여 vs 배당은 '대표 월 급여(지금)' 를 알아야 숫자가 나온다.
 * 대표 본인의 영수증이면 총급여(비과세 뺀 것)를 근무한 달 수로 나눠 월 급여를 잡는다.
 * 여러 사람 것이 한 파일에 묶여 있어도(지급명세서 묶음) 사람마다 나눠 읽는다.
 * 급여대장(엑셀)은 대표 줄의 과세 급여 — 이번 달 금액이라 작년 영수증보다 먼저 쓴다.
 * 주민등록번호 · 주소는 읽지 않는다. 규칙 계산 — 외부 호출 없음.
 */

import { fixAmountNoise, joinSpacedHangul } from './ocrNumbers'

export interface WageReceipt {
  /** 소득자 성명 — 못 읽으면 '' */
  name: string
  /** 같은 장의 징수의무자 대표자 성명 — 소득자와 같으면 대표 본인 영수증 */
  payerCeo: string
  /** 귀속 연도(근무기간 끝 해) — 못 읽으면 null */
  year: number | null
  /** 총급여(원) — 비과세를 뺀 것. 못 읽으면 0 */
  totalPay: number
  /** 근무한 달 수(근무기간에서) — 못 읽으면 12 */
  months: number
  /** 근무기간을 읽었는가 */
  monthsSure: boolean
}

const TITLE = /근\s*로\s*소\s*득\s*(?:원\s*천\s*징\s*수\s*영\s*수\s*증|지\s*급\s*명\s*세\s*서)/

/** 근로소득 원천징수영수증 · 지급명세서인가 — 제목(또는 파일 이름)과 급여 낱말이 함께 */
export function looksLikeWageReceipt(text: string, fileName = ''): boolean {
  const t = String(text || '')
  const titled = TITLE.test(t.slice(0, 4000)) || /원\s*천\s*징\s*수\s*영\s*수\s*증|근로\s*소득\s*지급\s*명세/.test(fileName)
  return titled && /총\s*급\s*여|급\s*여|근\s*무\s*기\s*간/.test(t)
}

/** 원 단위 금액 — '7,000만원' · '30%' 같은 안내 글의 숫자는 빼고 */
const MONEY = /(?<![\d,])(\d{1,3}(?:,\d{3})+|\d{5,})(?![,\d])(?!\s*(?:만|천|억|%))/g

function moneyAfter(block: string, label: RegExp, span = 70): number {
  const m = label.exec(block)
  if (!m) return 0
  const rest = block.slice(m.index + m[0].length, m.index + m[0].length + span)
  const v = [...rest.matchAll(MONEY)][0]
  return v ? Number(v[1].replace(/,/g, '')) : 0
}

/** 소득자 성명 자리들 — '대표자(성명)' 은 빼고 '⑥ 성 명 홍길동' · '성명: 홍길동' */
function nameSpots(t: string): { at: number; name: string }[] {
  const out: { at: number; name: string }[] = []
  for (const m of t.matchAll(/성\s*명\s*[:：]?\s*([가-힣]{2,5})(?![가-힣])/g)) {
    const at = m.index ?? 0
    if (/대\s*표\s*자\s*\(?\s*$/.test(t.slice(Math.max(0, at - 12), at))) continue
    out.push({ at, name: m[1] })
  }
  return out
}

function ymOf(s: string): { y: number; m: number } | null {
  const d = /(\d{4})\s*[.\-/년]\s*(\d{1,2})/.exec(s)
  return d ? { y: Number(d[1]), m: Number(d[2]) } : null
}

/** 한 사람 몫 */
function readOne(block: string, name: string, payerCeo: string): WageReceipt {
  // 근무기간 — 첫 줄(주(현) 근무지). '2025.01.01 ~ 2025.12.31'
  const period = /근\s*무\s*기\s*간\s*[:：]?\s*([0-9.\-/년월일\s]{6,16})\s*[~∼〜～-]\s*([0-9.\-/년월일\s]{6,16})/.exec(block)
  const a = period ? ymOf(period[1]) : null
  const b = period ? ymOf(period[2]) : null
  const span = a && b ? (b.y - a.y) * 12 + (b.m - a.m) + 1 : 0
  const monthsSure = span >= 1 && span <= 12
  // 총급여(㉑ · 21) — 없으면 ⑯ 계에서 비과세소득 계(⑳)를 뺀다
  let totalPay = moneyAfter(block, /총\s*급\s*여(?:\s*\([^)]{0,40}\))?/)
  if (!totalPay) {
    const gross = moneyAfter(block, /(?:⑯|16)\s*계/, 40)
    const exempt = moneyAfter(block, /비\s*과\s*세\s*소\s*득\s*계/, 40)
    totalPay = gross > exempt ? gross - exempt : gross
  }
  const yearM = /(\d{4})\s*년\s*귀\s*속|귀\s*속\s*(?:연\s*도)?\s*[:：]?\s*(\d{4})/.exec(block)
  return {
    name,
    payerCeo,
    year: b?.y ?? (yearM ? Number(yearM[1] || yearM[2]) : null),
    totalPay,
    months: monthsSure ? span : 12,
    monthsSure,
  }
}

/** 영수증 글 → 사람마다(성명 자리에서 다음 성명 자리까지) */
export function readWageReceipts(text: string): WageReceipt[] {
  // D-417 스캔 영수증 — 마침표 금액('93.600.000') · 한 글자씩 띄운 이름('박 지 훈')을 먼저 고친다
  const t = fixAmountNoise(joinSpacedHangul(String(text || '').replace(/\r/g, '')))
  const spots = nameSpots(t)
  if (spots.length === 0) return []
  const out: WageReceipt[] = []
  spots.forEach((s, i) => {
    const end = i + 1 < spots.length ? spots[i + 1].at : t.length
    // 징수의무자 대표자 — 이 사람 성명 바로 앞쪽(같은 장의 머리)
    const head = t.slice(i > 0 ? spots[i - 1].at : 0, s.at)
    const ceo = [...head.matchAll(/대\s*표\s*자\s*\(?\s*성\s*명\s*\)?\s*[:：]?\s*([가-힣]{2,5})(?![가-힣])/g)].pop()?.[1] ?? ''
    const r = readOne(t.slice(s.at, end), s.name, ceo)
    // 같은 사람이 두 번(1쪽 · 2쪽 머리) 나오면 하나로 — 총급여를 읽은 쪽
    const prev = out.find((o) => o.name === r.name)
    if (prev) {
      if (!prev.totalPay && r.totalPay) Object.assign(prev, { ...r, payerCeo: prev.payerCeo || r.payerCeo })
      return
    }
    out.push(r)
  })
  return out.filter((r) => r.totalPay > 0)
}

const squash = (s: string) => s.replace(/\s/g, '')

/** 대표 본인 영수증 — 회사 대표 이름과 같거나(이름을 알 때) 같은 장의 징수의무자 대표자와 같을 때 */
export function ceoWageReceipt(list: readonly WageReceipt[], representativeName: string): WageReceipt | null {
  const rep = squash(representativeName || '')
  if (rep) return list.find((r) => squash(r.name) === rep) ?? null
  return list.find((r) => r.payerCeo && squash(r.payerCeo) === squash(r.name)) ?? null
}

/** 월 급여(원) — 총급여 ÷ 근무한 달 수, 천 원 단위로 */
export function monthlyPayOf(r: WageReceipt): number {
  return Math.round(r.totalPay / r.months / 1000) * 1000
}

/* ------------------------------------------------------------------ */
/* 급여대장(엑셀) — 대표 줄의 이번 달 과세 급여                              */
/* ------------------------------------------------------------------ */

export interface LedgerPay {
  name: string
  /** 월 급여(원) — 과세 칸이 있으면 그 값, 없으면 지급 합계에서 비과세를 뺀 값 */
  monthly: number
  /** 'YYYY-MM' — 제목에서 읽은 달. 못 읽으면 '' */
  month: string
  /** 비과세를 뺐는가(과세 칸 · 비과세 칸이 있었나) */
  taxable: boolean
}

const NAME_HEAD = /^(?:성\s*명|이\s*름|사\s*원\s*명|직\s*원\s*명)$/
const TOTAL_HEAD = /지\s*급\s*(?:합\s*계|총\s*액|액\s*(?:합\s*)?계)|총\s*지\s*급\s*액|급\s*여\s*(?:합\s*계|총\s*액)|^지\s*급\s*계$/
const TAXABLE_HEAD = /^과\s*세\s*(?:급\s*여|대\s*상|소\s*득|합\s*계|계|총\s*액)?(?:\s*\(?\s*계\s*\)?)?$/
const EXEMPT_HEAD = /^비\s*과\s*세/
const ROLE_HEAD = /^(?:직\s*위|직\s*급|직\s*책)$/

/** 급여대장인가 — 제목(또는 파일 이름)에 '급여대장 · 급여명세 · 급여지급' 이 있고 표 머리에 성명과 지급 합계 */
export function looksLikePayrollLedger(text: string, fileName = ''): boolean {
  const t = String(text || '')
  if (!/급\s*여\s*(?:대\s*장|명\s*세|지\s*급\s*(?:내\s*역|대\s*장))/.test(`${fileName} ${t.slice(0, 2000)}`)) return false
  return t.split('\n').some((l) => {
    const cells = l.split('\t').map((c) => c.trim())
    return cells.some((c) => NAME_HEAD.test(c)) && cells.some((c) => TOTAL_HEAD.test(c))
  })
}

const won = (c: string | undefined) => {
  const v = Number(String(c ?? '').replace(/[,\s원]/g, ''))
  return Number.isFinite(v) && v > 0 ? v : 0
}

/** 급여대장 → 대표 줄(이름이 같거나, 이름을 모르면 직위가 '대표') — 여러 달이면 마지막 달 */
export function readLedgerCeoPay(text: string, representativeName: string): LedgerPay | null {
  const lines = String(text || '').replace(/\r/g, '').split('\n')
  const rep = squash(representativeName || '')
  let head: { name: number; total: number; taxable: number; exempt: number; role: number } | null = null
  let month = ''
  let found: LedgerPay | null = null
  for (const line of lines) {
    const m = /(\d{4})\s*[년.\-/]\s*(\d{1,2})\s*월?\s*(?:분|귀속)?\s*급\s*여/.exec(line)
    if (m) month = `${m[1]}-${m[2].padStart(2, '0')}`
    const cells = line.split('\t').map((c) => c.trim())
    const name = cells.findIndex((c) => NAME_HEAD.test(c))
    const total = cells.findIndex((c) => TOTAL_HEAD.test(c))
    if (name >= 0 && total >= 0) {
      head = { name, total, taxable: cells.findIndex((c) => TAXABLE_HEAD.test(c)), exempt: cells.findIndex((c) => EXEMPT_HEAD.test(c)), role: cells.findIndex((c) => ROLE_HEAD.test(c)) }
      continue
    }
    if (!head) continue
    const who = cells[head.name] ?? ''
    if (!/^[가-힣]{2,5}$/.test(squash(who))) continue
    const isCeo = rep ? squash(who) === rep : head.role >= 0 && /대\s*표/.test(cells[head.role] ?? '')
    if (!isCeo) continue
    const gross = won(cells[head.total])
    const taxableCell = head.taxable >= 0 ? won(cells[head.taxable]) : 0
    const exempt = head.exempt >= 0 ? won(cells[head.exempt]) : 0
    const monthly = taxableCell || (gross > exempt ? gross - exempt : gross)
    if (monthly > 0) found = { name: squash(who), monthly, month, taxable: taxableCell > 0 || exempt > 0 }
  }
  return found
}
