/**
 * 연구개발비(AX) — 정확한 금액(원)과 칩으로 고른 범위를 섞지 않는다.
 * 범위는 첫 추천 · 질문 순서에만 쓴다. 벤처 공식 판단(5천만원 이상 · 매출 대비 비율)은 정확한 금액이 있어야 한다.
 */
import { RND_RANGE_LABEL, type CertificationClientContext } from './types'

const won = (n: number) => (Math.abs(n) >= 1e8 ? `${Math.round(n / 1e7) / 10}억원` : `${Math.round(n / 1e4).toLocaleString()}만원`)

/** 연구개발비가 있나 — 정확한 금액 우선, 없으면 범위(없음 · 모름은 null) */
export function rndPositive(c: CertificationClientContext): boolean | null {
  if (c.rndExpense !== null) return c.rndExpense > 0
  if (!c.rndRange || c.rndRange === 'unknown') return null
  return c.rndRange !== 'none'
}

/** 연구개발비 한 줄(정확한 금액 · 범위) — 모르면 '' */
export function rndText(c: CertificationClientContext): string {
  if (c.rndExpense !== null) return won(c.rndExpense)
  if (c.rndRange && c.rndRange !== 'unknown') return `${RND_RANGE_LABEL[c.rndRange]}(범위)`
  return ''
}

/** 범위로는 5천만원 이상인데 정확한 금액이 없다 — '정확한 연구개발비 확인 필요' */
export function rndNeedsExact(c: CertificationClientContext): boolean {
  return c.rndExpense === null && (c.rndRange === '50m_100m' || c.rndRange === 'over_100m')
}
