/**
 * D-368 진단서를 드린 뒤 새로 추천할 수 있게 된 모듈 — 오늘 화면 '오늘 먼저 제안할 것' 줄에 붙인다.
 * 판정 엔진 없이(오늘 화면 첫 묶음을 가볍게) 업체 카드 추천 칩과 마지막으로 드린 기록의 판정만 견준다.
 * 그때 그 모듈이 '자료 필요 · 지금은 어려움' 이었는데 지금 '검토해 볼 만함 · 가능성 높음'(또는 검토 → 높음)이면 새 추천.
 */
import type { DiagnosisGiven } from '../types/clientOps'

const RANK: Record<string, number> = { good: 3, maybe: 2, done: 2, need: 1, no: 0 }

export function improvedSinceGiven(given: readonly DiagnosisGiven[] | undefined, chips: readonly { key: string; label: string; tone: string }[]): string[] {
  const last = given?.[0]
  if (!last) return []
  const before = new Map(last.lines.map((l) => [l.key, l.tone]))
  return chips
    .filter((c) => {
      const b = before.get(c.key)
      return b !== undefined && (RANK[c.tone] ?? 0) > (RANK[b] ?? 0)
    })
    .map((c) => c.label)
}
