/**
 * D-395 부가가치세 신고서(일반과세자 · 간이과세자 · 예정 · 확정) → 그 신고 기간의 과세표준(매출).
 *
 * 세무사 사무실에는 기마다 있는 서류인데, 예전에는 '부가세 과세표준증명' 만 읽어 신고서를 올리면 아무것도 남지 않았다.
 * 재무제표가 아직 없는 올해 매출(1기 · 예정)을 가장 먼저 보여 주는 서류다.
 *  - 신고 기간: '2026년 제1기 (1월 1일 ~ 6월 30일)' · '과세기간 2026.01.01 ~ 2026.06.30' · 예정 · 확정.
 *  - 금액: 과세표준 및 매출세액 '합계 (9)' 줄의 첫 금액(세액이 아니라 과세표준).
 *  - 한 기간 금액이라 회사 정보 '매출(한 해)' 칸에는 넣지 않고 '부가세 신고 매출' 칸에 기간과 함께 남긴다.
 *  - 상호 · 번호 · 매입 금액은 이 서류로 읽지 않는다. 규칙 계산 — 외부 호출 없음.
 */

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
  const raw = String(text || '')
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
    const m = /합\s*계\s*[(（]\s*9\s*[)）]([^\n]*)/.exec(line)
    if (!m) continue
    const money = [...m[1].matchAll(/-?\d{1,3}(?:,\d{3})+|-?\d{4,}/g)].map((x) => Number(x[0].replace(/,/g, ''))).find((n) => Number.isFinite(n))
    if (money === undefined) continue
    return { year, half, kind, from, to, base: money }
  }
  return null
}

/** 회사 정보 '부가세 신고 매출' 칸 — '2026년 1기 확정(1~6월) 과세표준 6억 2,000만원' */
export function vatReturnValue(r: VatReturnRead, won: (n: number) => string): string {
  const term = `${r.year}년${r.half ? ` ${r.half}기` : ''}${r.kind ? ` ${r.kind}` : ''}`
  const span = r.from && r.to ? `(${Number(r.from.slice(5))}~${Number(r.to.slice(5))}월)` : ''
  return `${term}${span} 과세표준 ${won(r.base)}`
}
