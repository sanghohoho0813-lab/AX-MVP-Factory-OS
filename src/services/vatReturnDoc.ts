/**
 * D-395 부가가치세 신고서(일반과세자 · 간이과세자 · 예정 · 확정) → 그 신고 기간의 과세표준(매출).
 *
 * 세무사 사무실에는 기마다 있는 서류인데, 예전에는 '부가세 과세표준증명' 만 읽어 신고서를 올리면 아무것도 남지 않았다.
 * 재무제표가 아직 없는 올해 매출(1기 · 예정)을 가장 먼저 보여 주는 서류다.
 *  - 신고 기간: '2026년 제1기 (1월 1일 ~ 6월 30일)' · '과세기간 2026.01.01 ~ 2026.06.30' · 예정 · 확정.
 *  - 금액: 과세표준 및 매출세액 '합계 (9)' · '합계 ⑨' 줄의 첫 금액(세액이 아니라 과세표준).
 *  - 한 기간 금액이라 회사 정보 '매출(한 해)' 칸에는 넣지 않고 '부가세 신고 매출' 칸에 기간과 함께 남긴다.
 *  - 상호 · 번호 · 매입 금액은 이 서류로 읽지 않는다. 규칙 계산 — 외부 호출 없음.
 */

import { fixAmountNoise } from './ocrNumbers'

export interface VatReturnRead {
  year: number
  /** 1기 · 2기 — 모르면 0 */
  half: 0 | 1 | 2
  kind: '예정' | '확정' | ''
  /** YYYY-MM — 기간을 못 읽으면 '' */
  from: string
  to: string
  /** 과세표준 합계(원) */
  base: number
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** 맨 위 몇 줄에 '… 부가가치세 … 신고서' 제목(과세표준증명은 아님) */
export function looksLikeVatReturn(text: string): boolean {
  const head = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6).join(' ')
  if (/과\s*세\s*표\s*준\s*증\s*명/.test(head)) return false
  return /부\s*가\s*가\s*치\s*세[^\n]{0,60}?신\s*고\s*서/.test(head)
}

export function readVatReturn(text: string): VatReturnRead | null {
  const raw = fixAmountNoise(String(text || ''))
  if (!looksLikeVatReturn(raw)) return null
  const t = /(20\d{2})\s*년\s*(?:제\s*)?([12])\s*기/.exec(raw)
  const full = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*\d{1,2}\s*일?\s*[~∼～]\s*(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*\d{1,2}/.exec(raw)
  const months = /\(\s*(\d{1,2})\s*월\s*\d{1,2}\s*일\s*[~∼～]\s*(\d{1,2})\s*월\s*\d{1,2}\s*일\s*\)/.exec(raw)
  // 제목의 고른 표시 — '[√]확정' · '■ 예정' (고르지 않은 '[ ]예정' 은 아님)
  const kind: VatReturnRead['kind'] = /[√✓V■●]\s*\]?\s*확\s*정/.test(raw) ? '확정' : /[√✓V■●]\s*\]?\s*예\s*정/.test(raw) ? '예정' : ''
  const year = full ? Number(full[1]) : t ? Number(t[1]) : 0
  if (!year) return null
  const half = (t ? Number(t[2]) : full ? (Number(full[2]) <= 6 ? 1 : 2) : 0) as VatReturnRead['half']
  let from = ''
  let to = ''
  if (full && full[1] === full[3]) {
    from = `${full[1]}-${pad2(Number(full[2]))}`
    to = `${full[3]}-${pad2(Number(full[4]))}`
  } else if (months) {
    from = `${year}-${pad2(Number(months[1]))}`
    to = `${year}-${pad2(Number(months[2]))}`
  }
  // 과세표준 및 매출세액 합계 (9) — 첫 금액. 세율(10/100) · 줄 번호는 금액이 아니다
  for (const line of raw.split(/\r?\n/)) {
    const m = /합\s*계\s*(?:[(（]\s*9\s*[)）]|⑨)([^\n]*)/.exec(line)
    if (!m) continue
    const money = [...m[1].matchAll(/-?\d{1,3}(?:,\d{3})+|-?\d{4,}/g)].map((x) => Number(x[0].replace(/,/g, ''))).find((n) => Number.isFinite(n))
    if (money === undefined) continue
    return { year, half, kind, from, to, base: money }
  }
  return null
}

/**
 * D-396 같은 해 신고서 여러 장(1기 · 2기 확정 / 예정 · 확정)이 1~12월을 빈틈 · 겹침 없이 덮으면 그해 과세표준 합계 = 한 해 매출.
 * 같은 기간이 두 번이면(같은 신고서를 두 번 올림) 하나만. 덮지 못하면 null — 짐작하지 않는다. 가장 최근 해 먼저.
 */
export function fullYearFromReturns(reads: readonly VatReturnRead[]): { year: number; total: number; count: number } | null {
  const byPeriod = new Map<string, VatReturnRead>()
  for (const r of reads) if (r.from && r.to && r.from.slice(0, 4) === r.to.slice(0, 4) && r.from <= r.to) byPeriod.set(`${r.from}~${r.to}`, r)
  const years = [...new Set([...byPeriod.values()].map((r) => Number(r.from.slice(0, 4))))].sort((a, b) => b - a)
  for (const y of years) {
    const ps = [...byPeriod.values()].filter((r) => Number(r.from.slice(0, 4)) === y)
    const months = ps.flatMap((r) => Array.from({ length: Number(r.to.slice(5)) - Number(r.from.slice(5)) + 1 }, (_, i) => Number(r.from.slice(5)) + i))
    if (months.length === 12 && new Set(months).size === 12) return { year: y, total: ps.reduce((a, r) => a + r.base, 0), count: ps.length }
  }
  return null
}

/**
 * D-405 '부가세 신고 추이' 칸 — 신고 기간마다 과세표준을 'YYYY-MM~MM N원' 으로 쌓는다(기간 순서 · 최근 12개 · 같은 기간은 새것).
 * 기간이 둘 이상일 때만 글이 생긴다. 사람이 읽을 수 있게 원 단위 쉼표.
 */
export interface VatPeriodAmount {
  from: string
  to: string
  base: number
}

export function parseVatTrend(text: string): VatPeriodAmount[] {
  return [...String(text || '').matchAll(/(20\d{2})-(\d{2})~(\d{2})\s+(-?[\d,]+)원/g)].map((m) => ({ from: `${m[1]}-${m[2]}`, to: `${m[1]}-${m[3]}`, base: Number(m[4].replace(/,/g, '')) }))
}

export function mergeVatTrend(prev: string, adds: readonly VatPeriodAmount[]): string {
  const m = new Map<string, VatPeriodAmount>()
  for (const p of [...parseVatTrend(prev), ...adds]) if (p.from && p.to && p.from.slice(0, 4) === p.to.slice(0, 4) && p.from <= p.to) m.set(`${p.from}~${p.to}`, p)
  const list = [...m.values()].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)).slice(-12)
  return list.length >= 2 ? list.map((p) => `${p.from}~${p.to.slice(5)} ${p.base.toLocaleString('en-US')}원`).join(' · ') : ''
}

/** 가장 최근 기간과 작년 같은 기간(같은 달들) — 둘 다 있으면 증감 %(반올림) */
export function vatYearOverYear(trend: string): { cur: VatPeriodAmount; prev: VatPeriodAmount; pct: number } | null {
  const list = parseVatTrend(trend).sort((a, b) => a.to.localeCompare(b.to) || a.from.localeCompare(b.from))
  const cur = list[list.length - 1]
  if (!cur) return null
  const shift = (ym: string) => `${Number(ym.slice(0, 4)) - 1}${ym.slice(4)}`
  const prev = list.find((p) => p.from === shift(cur.from) && p.to === shift(cur.to))
  if (!prev || prev.base <= 0) return null
  return { cur, prev, pct: Math.round(((cur.base - prev.base) / prev.base) * 100) }
}

/** '2026년 1~6월 작년 같은 기간보다 +24%' — 정책자금 매출 추이 읽기(vatTrendOf)와 같은 말 */
export function vatYoyText(y: { cur: VatPeriodAmount; pct: number }): string {
  return `${y.cur.from.slice(0, 4)}년 ${Number(y.cur.from.slice(5))}~${Number(y.cur.to.slice(5))}월 작년 같은 기간보다 ${y.pct > 0 ? '+' : ''}${y.pct}%`
}

/** '부가세 신고 매출' 칸 글('2026년 1기 확정(1~6월) 과세표준 6억 2,000만원') → 기간 · 금액(금액은 부르는 쪽이 원으로) */
export function periodOfReturnValue(value: string): { from: string; to: string; amountText: string } | null {
  const m = /^(20\d{2})년[^(]*\((\d{1,2})~(\d{1,2})월\)\s*과세표준\s*(.+)$/.exec(String(value || '').trim())
  if (!m) return null
  return { from: `${m[1]}-${m[2].padStart(2, '0')}`, to: `${m[1]}-${m[3].padStart(2, '0')}`, amountText: m[4] }
}

/** 회사 정보 '부가세 신고 매출' 칸 — '2026년 1기 확정(1~6월) 과세표준 6억 2,000만원' */
export function vatReturnValue(r: VatReturnRead, won: (n: number) => string): string {
  const term = `${r.year}년${r.half ? ` ${r.half}기` : ''}${r.kind ? ` ${r.kind}` : ''}`
  const span = r.from && r.to ? `(${Number(r.from.slice(5))}~${Number(r.to.slice(5))}월)` : ''
  return `${term}${span} 과세표준 ${won(r.base)}`
}
