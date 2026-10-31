/**
 * D-397 면세사업자 사업장현황신고서(병원 · 학원 · 농축수산 등 — 매년 2월 신고) → 그해 수입금액(매출).
 *
 * 면세사업자는 부가세 신고가 없어 이 신고서가 한 해 매출의 기본 근거인데, 예전에는 올려도 아무것도 읽지 않았다
 * (같은 숫자를 담은 '면세사업자 수입금액증명' 만 읽었다).
 *  - 귀속 연도: '( 2025 년 귀속 )' · '귀속연도 2025' · '과세기간 2025.01.01 ~ 2025.12.31'.
 *  - 금액: 수입금액(매출액) 명세 표의 '합계' 줄 첫 금액 — 수입금액 낱말 뒤에서만 찾는다(앞쪽 기본사항 숫자는 아님).
 *  - 상호 · 번호 · 경비 · 임차료 같은 다른 칸은 이 서류로 읽지 않는다. 규칙 계산 — 외부 호출 없음.
 */

import { fixAmountNoise } from './ocrNumbers'

export interface SiteReportRead {
  year: number
  revenue: number
  /** D-399 기본사항 '종업원수' — 못 읽으면 null */
  employees: number | null
}

export function looksLikeSiteReport(text: string): boolean {
  const head = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6).join(' ')
  return /사\s*업\s*장\s*현\s*황\s*신\s*고\s*서/.test(head)
}

export function readSiteReport(text: string): SiteReportRead | null {
  const raw = fixAmountNoise(String(text || ''))
  if (!looksLikeSiteReport(raw)) return null
  const y =
    /(20\d{2})\s*년\s*(?:도\s*)?귀\s*속/.exec(raw) ??
    /귀\s*속\s*(?:연\s*도|년\s*도)\s*[:：]?\s*(20\d{2})/.exec(raw) ??
    /과\s*세\s*기\s*간\s*[:：]?\s*(20\d{2})\s*[.\-/년]\s*0?1\s*[.\-/월]\s*0?1/.exec(raw)
  if (!y) return null
  const at = raw.search(/수\s*입\s*금\s*액/)
  if (at < 0) return null
  for (const line of raw.slice(at).split(/\r?\n/)) {
    const m = /합\s*계([^\n]*)/.exec(line)
    if (!m) continue
    const money = [...m[1].matchAll(/\d{1,3}(?:,\d{3})+|\d{5,}/g)].map((x) => Number(x[0].replace(/,/g, ''))).find((n) => n >= 10_000)
    if (money !== undefined) {
      const e = /종\s*업\s*원\s*수\s*[:：]?\s*(\d{1,4})(?![\d,])/.exec(raw)
      return { year: Number(y[1]), revenue: money, employees: e && Number(e[1]) > 0 ? Number(e[1]) : null }
    }
  }
  return null
}
