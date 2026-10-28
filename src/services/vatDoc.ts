/**
 * D-311 부가가치세 과세표준증명(홈택스) · 면세사업자 수입금액증명 → 해마다 매출.
 *
 * 정책자금 · 지원사업 신청에 거의 늘 내는 서류인데 예전에는 '기타 · 확인 필요' 로만 들어갔다.
 * 재무제표가 없는 개인사업자는 이 서류가 매출의 유일한 근거라, 맞춤 추천이 '매출(재무제표 · 크레탑)' 을 계속 달라고 했다.
 *
 *  - 줄마다 과세기간(2025.01.01 ~ 2025.06.30 · 2025년 1기 확정)과 그 뒤 첫 금액(과세표준)을 읽는다. 신고일 같은 날짜는 금액이 아니다.
 *  - 같은 기간이 두 번 나오면(수정신고 · 경정) 수정 · 경정 쪽, 아니면 늦게 신고한 쪽.
 *  - 해마다 더한다. 1~12월이 빈틈없이 덮이고 겹치지 않으면 '다 찬 해'. 기간이 겹치면(예정 + 확정 6개월) 확실하지 않음 — 사람이 확인.
 *  - 과세표준은 과세 매출(면세 매출은 빠진다). 면세사업자 수입금액증명은 해마다 수입금액 그대로.
 * 규칙 계산 — 외부 호출 없음. 주민등록번호는 읽지도 남기지도 않는다.
 */

export interface VatPeriod {
  /** YYYY-MM */
  from: string
  to: string
  base: number
  /** 확정 · 예정 · 수정 · 경정 · 기한후 · '' */
  kind: string
}

export interface VatYear {
  year: number
  total: number
  /** 덮인 달 수 */
  months: number
  /** 1~12월이 겹침 없이 다 덮였나 */
  full: boolean
  /** 기간이 서로 겹쳤나(예정 + 확정이 같은 달을 함께 말함) */
  overlap: boolean
}

export interface VatRead {
  kind: 'vat' | 'exempt'
  periods: VatPeriod[]
  years: VatYear[]
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const flat = (t: string) => t.replace(/[ \t ]+/g, ' ')

export function looksLikeVatCert(text: string, fileName = ''): boolean {
  const t = `${fileName} ${String(text || '').slice(0, 3000)}`.replace(/\s+/g, '')
  return /부가가치세과세표준증명|부가세과세표준증명|과세표준증명원?|면세사업자수입금액증명|수입금액증명/.test(t)
}

const DATE = String.raw`(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?`
const RANGE = new RegExp(`${DATE}\\s*[~∼～\\-]\\s*${DATE}`)
const TERM = /(20\d{2})\s*년\s*(?:도\s*)?([12])\s*기\s*(예정|확정)?/
const ANY_DATE = new RegExp(DATE, 'g')
const MONEY = /-?\d{1,3}(?:,\d{3})+|-?\d+/g

function unitOf(text: string): number {
  const m = /단\s*위\s*[:：]?\s*(백만\s*원|천\s*원|원)/.exec(text)
  if (!m) return 1
  if (/백만/.test(m[1])) return 1_000_000
  if (/천/.test(m[1])) return 1_000
  return 1
}

/** 기간 · 금액 줄들 → 기간마다 하나(수정 · 경정 우선, 아니면 늦게 신고한 것) */
export function readVatCert(text: string): VatRead | null {
  const raw = String(text || '')
  if (!looksLikeVatCert(raw)) return null
  const kind: VatRead['kind'] = /면세\s*사업자\s*수입\s*금액\s*증명|수입\s*금액\s*증명/.test(raw) && !/과세\s*표준\s*증명/.test(raw) ? 'exempt' : 'vat'
  const unit = unitOf(raw)
  const lines = raw.split(/\r?\n/).map(flat).map((l) => l.trim()).filter(Boolean)
  // 표가 줄로 쪼개져도 — 기간이 있는 줄부터 다음 기간 줄 앞까지를 한 행으로
  const rows: string[] = []
  for (const l of lines) {
    if (RANGE.test(l) || TERM.test(l)) rows.push(l)
    else if (rows.length && !/합\s*계|소\s*계/.test(l) && rows[rows.length - 1].length < 400) rows[rows.length - 1] += ` ${l}`
  }
  type Row = VatPeriod & { filed: string; termOnly?: { year: number; half: 1 | 2 } }
  const found: Row[] = []
  for (const row of rows) {
    // 증명서 머리의 '과세기간 2024년 01월 01일 ~ 2025년 06월 30일'(조회 범위)은 행이 아니다
    if (/조회\s*기간|증명\s*기간|발급\s*기간|과세\s*기간/.test(row) && !/확정|예정|수정|경정|기한\s*후/.test(row)) continue
    const r = RANGE.exec(row)
    const t = r ? null : TERM.exec(row)
    let from = ''
    let to = ''
    let termOnly: Row['termOnly']
    let rest = row
    if (r) {
      from = `${r[1]}-${pad2(Number(r[2]))}`
      to = `${r[4]}-${pad2(Number(r[5]))}`
      rest = row.slice(0, r.index) + ' ' + row.slice(r.index + r[0].length)
    } else if (t) {
      const year = Number(t[1])
      const half = Number(t[2]) as 1 | 2
      termOnly = { year, half }
      rest = row.slice(0, t.index) + ' ' + row.slice(t.index + t[0].length)
    } else continue
    const filed = [...rest.matchAll(ANY_DATE)].map((d) => `${d[1]}-${pad2(Number(d[2]))}-${pad2(Number(d[3]))}`).pop() ?? ''
    // 날짜 · 사업자번호 · 주민번호 · 전화번호는 금액이 아니다
    const noDates = rest.replace(ANY_DATE, ' ').replace(/\d{3}\s*-\s*\d{2}\s*-\s*\d{5}|\d{6}\s*-\s*[\d*]{7}|0\d{1,2}\s*-\s*\d{3,4}\s*-\s*\d{4}/g, ' ')
    // 첫 금액 = 과세표준. 1~999 는 금액이 아니다(줄 번호 · 기수) — 0 은 휴업 등으로 실제로 있다
    const money = [...noDates.matchAll(MONEY)].map((m) => Number(m[0].replace(/,/g, ''))).find((n) => Number.isFinite(n) && (n === 0 || Math.abs(n) >= 1000))
    if (money === undefined) continue
    const k = /수정/.test(row) ? '수정' : /경정/.test(row) ? '경정' : /기한\s*후/.test(row) ? '기한후' : /예정/.test(row) ? '예정' : /확정/.test(row) ? '확정' : ''
    found.push({ from, to, base: money * unit, kind: k, filed, ...(termOnly ? { termOnly } : {}) })
  }
  // '2025년 1기 예정 · 확정' 처럼 기수만 적힌 줄 — 같은 기에 예정이 있으면 확정은 뒤 석 달, 없으면 여섯 달
  for (const f of found) {
    if (!f.termOnly) continue
    const { year, half } = f.termOnly
    const start = half === 1 ? 1 : 7
    const hasPre = found.some((g) => g.termOnly && g.termOnly.year === year && g.termOnly.half === half && g.kind === '예정')
    const [a, b] = f.kind === '예정' ? [start, start + 2] : hasPre ? [start + 3, start + 5] : [start, start + 5]
    f.from = `${year}-${pad2(a)}`
    f.to = `${year}-${pad2(b)}`
  }
  const rank = (k: string) => (k === '수정' || k === '경정' ? 2 : 1)
  const byPeriod = new Map<string, Row>()
  for (const f of found) {
    const key = `${f.from}~${f.to}`
    const cur = byPeriod.get(key)
    if (!cur || rank(f.kind) > rank(cur.kind) || (rank(f.kind) === rank(cur.kind) && f.filed > cur.filed)) byPeriod.set(key, f)
  }
  const periods: VatPeriod[] = [...byPeriod.values()]
    .filter((p) => p.from <= p.to && p.from.slice(0, 4) === p.to.slice(0, 4))
    .map(({ from, to, base, kind: k }) => ({ from, to, base, kind: k }))
    .sort((a, b) => a.from.localeCompare(b.from))
  if (!periods.length) return null
  const years = new Map<number, { total: number; seen: number[] }>()
  for (const p of periods) {
    const y = Number(p.from.slice(0, 4))
    const e = years.get(y) ?? { total: 0, seen: [] }
    e.total += p.base
    for (let m = Number(p.from.slice(5)); m <= Number(p.to.slice(5)); m++) e.seen.push(m)
    years.set(y, e)
  }
  return {
    kind,
    periods,
    years: [...years.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, e]) => {
        const months = new Set(e.seen).size
        const overlap = e.seen.length !== months
        return { year, total: e.total, months, full: months === 12 && !overlap, overlap }
      }),
  }
}

/** 가장 최근 '다 찬 해'(1~12월 · 겹침 없음) */
export function latestFullYear(read: VatRead): VatYear | null {
  return [...read.years].reverse().find((y) => y.full) ?? null
}

/** 올해처럼 아직 덜 찬 해와 작년 같은 달까지 — '2026년 1~6월 2.1억(작년 같은 기간보다 +18%)' 에 쓴다 */
export function sameMonthsLastYear(read: VatRead, year: number): { cur: number; prev: number; months: number } | null {
  const cur = read.periods.filter((p) => Number(p.from.slice(0, 4)) === year)
  if (!cur.length) return null
  const spans = cur.map((p) => `${p.from.slice(5)}~${p.to.slice(5)}`)
  const prev = read.periods.filter((p) => Number(p.from.slice(0, 4)) === year - 1 && spans.includes(`${p.from.slice(5)}~${p.to.slice(5)}`))
  if (prev.length !== cur.length) return null
  const months = cur.reduce((n, p) => n + Number(p.to.slice(5)) - Number(p.from.slice(5)) + 1, 0)
  return { cur: cur.reduce((n, p) => n + p.base, 0), prev: prev.reduce((n, p) => n + p.base, 0), months }
}

const pct = (cur: number, prev: number) => {
  const p = Math.round((cur / prev - 1) * 100)
  return `${p > 0 ? '+' : ''}${p}%`
}

/**
 * 올린 서류 요약에 보일 한 줄 — '2025년 4억 2,000만원(부가세 과세표준 · 2024년보다 +18%) · 2026년 6개월 2억 1,000만원(작년 같은 기간보다 +12%)'.
 * 다 찬 해가 없으면 해마다 더한 값과 덮인 달 수만.
 */
export function vatSummary(read: VatRead, fmt: (won: number) => string): string {
  const what = read.kind === 'exempt' ? '면세 수입금액' : '부가세 과세표준'
  const full = read.years.filter((y) => y.full)
  const last = full[full.length - 1]
  if (!last) return read.years.map((y) => `${y.year}년 ${fmt(y.total)}(${y.months}개월${y.overlap ? ' · 기간 겹침' : ''})`).join(' · ')
  const prev = full.find((y) => y.year === last.year - 1)
  const head = `${last.year}년 ${fmt(last.total)}(${what}${prev && prev.total > 0 ? ` · ${prev.year}년보다 ${pct(last.total, prev.total)}` : ''})`
  const late = read.years.find((y) => !y.full && !y.overlap && y.year > last.year)
  const same = late ? sameMonthsLastYear(read, late.year) : null
  if (!late) return head
  return `${head} · ${late.year}년 ${late.months}개월 ${fmt(late.total)}${same && same.prev > 0 ? `(작년 같은 기간보다 ${pct(same.cur, same.prev)})` : ''}`
}
