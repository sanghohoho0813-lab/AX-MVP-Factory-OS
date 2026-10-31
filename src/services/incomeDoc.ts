/**
 * D-373 소득금액증명(홈택스 · 종합소득세 신고자용) → 개인사업자의 해마다 수입금액(매출) · 사업소득금액.
 *
 * 개인사업자는 재무제표가 없어 정책자금 · 지원사업에 이 서류를 낸다. 예전에는 제목대로 칸만 만들고 숫자는 읽지 않아
 * 맞춤 추천이 매출 · 이익을 계속 달라고 했다.
 *
 *  - '사업' 소득 줄만 읽는다(근로 · 이자 · 배당 줄은 뺀다 — 법인 대표의 근로소득 증명이 회사 매출로 들어가지 않게).
 *  - 줄 맨 앞 귀속연도(없으면 바로 위 '귀속연도' 줄)와 금액 — 수입금액 · (필요경비) · 소득금액 순서.
 *    금액이 셋이면 수입 − 경비 = 소득 이 맞아야 하고, 둘이면 소득이 수입보다 크지 않아야 한다. 아니면 '확실하지 않음'.
 *  - 같은 해에 사업 줄이 여럿이면(사업장 둘) 더하고 '확실하지 않음' — 사람이 본다.
 *  - 사업자등록번호 · 주민등록번호 · 날짜는 금액으로 읽지 않는다. 주민등록번호는 남기지 않는다.
 * 규칙 계산 — 외부 호출 없음.
 */

import { fixAmountNoise } from './ocrNumbers'

export interface IncomeYear {
  year: number
  /** 수입금액(원) */
  revenue: number
  /** 사업소득금액(원) — 결손이면 음수 */
  income: number
  /** 이 해에 사업 줄이 몇 개였나 */
  rows: number
}

export interface IncomeRead {
  years: IncomeYear[]
  /** 모든 줄이 검산(수입 − 경비 = 소득 · 소득 ≤ 수입)에 맞고 해마다 한 줄 */
  sure: boolean
}

export function looksLikeIncomeCert(text: string, fileName = ''): boolean {
  const t = `${fileName} ${String(text || '').slice(0, 3000)}`.replace(/\s+/g, '')
  return /소득금액증명/.test(t)
}

function unitOf(text: string): number {
  const m = /단\s*위\s*[:：]?\s*(백만\s*원|천\s*원|원)/.exec(text)
  if (!m) return 1
  if (/백만/.test(m[1])) return 1_000_000
  if (/천/.test(m[1])) return 1_000
  return 1
}

/** 금액 — 쉼표가 있는 수 또는 다섯 자리 이상. '△' · '-' 는 결손 */
const MONEY = /(△|-)?\s*(?<![\d,.])(\d{1,3}(?:,\d{3})+|\d{5,})(?![\d,.])/g

export function readIncomeCert(text: string): IncomeRead | null {
  const raw = fixAmountNoise(String(text || ''))
  if (!looksLikeIncomeCert(raw)) return null
  const unit = unitOf(raw)
  const byYear = new Map<number, IncomeYear>()
  let sure = true
  let curYear = 0
  for (const line0 of raw.split(/\r?\n/)) {
    const line = line0.replace(/[ \t ]+/g, ' ').trim()
    if (!line) continue
    const head = /^(20\d{2})(?:\s*년(?:\s*귀속)?)?(?=\s|$)/.exec(line) ?? /귀\s*속\s*(?:연\s*도|년\s*도)?\s*[:：]?\s*(20\d{2})/.exec(line)
    if (head) curYear = Number(head[1])
    if (!/사\s*업/.test(line)) continue
    // 근로 · 이자 · 배당 · 연금 · 기타 소득 줄은 뺀다(머리 줄 · 소재지 줄은 금액이 둘 이상 없어 아래에서 빠진다)
    if (/근\s*로|이\s*자|배\s*당|연\s*금|기\s*타\s*소\s*득/.test(line) && !/사\s*업\s*소\s*득/.test(line)) continue
    const body = line
      .replace(/\d{3}\s*-\s*\d{2}\s*-\s*\d{5}/g, ' ')
      .replace(/\d{6}\s*-\s*[\d*]{7}/g, ' ')
      .replace(/20\d{2}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}/g, ' ')
      .replace(/^(20\d{2})(?:\s*년(?:\s*귀속)?)?/, ' ')
    const nums: number[] = []
    for (const m of body.matchAll(MONEY)) nums.push((m[1] ? -1 : 1) * Number(m[2].replace(/,/g, '')) * unit)
    if (nums.length < 2 || !curYear || nums[0] <= 0) continue
    const [rev, a, b] = nums
    // 셋이면 수입 · 경비 · 소득(수입 − 경비 = 소득이어야 확실) · 둘이면 수입 · 소득(소득 ≤ 수입)
    const income = nums.length >= 3 ? b : a
    const ok = nums.length >= 3 ? rev - a === b : a <= rev
    if (!ok) sure = false
    const y = byYear.get(curYear)
    if (y) {
      y.revenue += rev
      y.income += income
      y.rows += 1
      sure = false
    } else byYear.set(curYear, { year: curYear, revenue: rev, income, rows: 1 })
  }
  const years = [...byYear.values()].sort((x, y) => x.year - y.year)
  if (!years.length) return null
  return { years, sure }
}

const pct = (cur: number, prev: number) => {
  const p = Math.round((cur / prev - 1) * 100)
  return `${p > 0 ? '+' : ''}${p}%`
}

/** 회사 정보 '매출 추이' 한 줄 — 정책자금 '매출 성장세' 가 같은 모양('2024년보다 +20%')을 읽는다(vatTrendOf) */
export function incomeTrendLine(read: IncomeRead, fmt: (won: number) => string): string {
  const last = read.years[read.years.length - 1]
  const prev = read.years.find((y) => y.year === last.year - 1)
  if (!prev || prev.revenue <= 0) return ''
  return `${last.year}년 ${fmt(last.revenue)}(소득금액증명 수입금액 · ${prev.year}년보다 ${pct(last.revenue, prev.revenue)})`
}
