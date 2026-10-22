/**
 * D-269 · D-270 기획 후보(특허 아이디어 · 벤처 사업계획서 방향) — 점수 순으로 줄 세우기 · [이 중 제일 좋은 게 뭐야?] 로 다시 매기기 ·
 * [자체점검으로 더 짜내기] 로 새 후보 더하기. 명세서와 사업계획서가 같은 규칙을 쓴다(규칙 계산 · AI 아님).
 */
import type { AssistAnswer } from './client'

export interface Ranked {
  title: string
  /** 추천 점수(0~100 · AI 가 매김) */
  score?: number
  /** 이 순위인 이유(다른 후보와 견줘서 한 줄) */
  reason?: string
  /** [더 짜내기] 로 새로 나온 것 */
  fresh?: boolean
}

/** 점수 글 → 0~100 숫자("82점" · "82/100" · "82") */
export function scoreOf(v: unknown): number | undefined {
  const m = /(\d{1,3}(?:\.\d+)?)/.exec(String(v ?? ''))
  if (!m) return undefined
  const n = Math.round(Number(m[1]))
  return n >= 0 && n <= 100 ? n : undefined
}

/** 명칭 비교용(영문 중괄호 · 띄어쓰기 · 기호 무시) */
export const titleKey = (t: string) => String(t ?? '').replace(/\{[^}]*\}/g, '').replace(/[\s·,.\-()]/g, '')

/** 명칭 앞 순위 표지 떼기("[2순위] …" · "추천: …") */
export const stripRank = (t: string) => String(t ?? '').replace(/^\s*(?:\[?\s*(?:\d\s*순위|추천|후보)\s*\]?\s*[:.)·-]?\s*)/, '').trim()

/** 순위 표지 — 1~3순위만, 나머지는 후보 */
export const rankLabel = (i: number) => (i < 3 ? `${i + 1}순위` : '후보')

/** 점수 높은 순(점수 없는 것은 뒤 · 같으면 원래 순서) */
export function rankByScore<T extends Ranked>(items: T[]): T[] {
  return items
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (b.p.score ?? -1) - (a.p.score ?? -1) || a.i - b.i)
    .map((x) => x.p)
}

/** [이 중 제일 좋은 게 뭐야?] 의 답 → 후보마다 점수 · 이유를 고쳐 다시 줄 세움. 항목은 '후보 n' 또는 명칭으로 찾는다 */
export function rerankByAnswer<T extends Ranked>(items: T[], answer: AssistAnswer | null): { items: T[]; matched: number; headline: string } {
  if (!answer) return { items, matched: 0, headline: '' }
  const next = items.map((p) => ({ ...p }))
  let matched = 0
  for (const it of answer.items ?? []) {
    const raw = String(it.title ?? '')
    const byNo = /후보\s*(\d+)/.exec(raw) ?? /후보\s*(\d+)/.exec(String(it.ref ?? ''))
    let idx = byNo ? Number(byNo[1]) - 1 : -1
    if (idx < 0 || idx >= next.length) {
      const k = titleKey(stripRank(raw.replace(/^\s*후보\s*\d+\s*[:.)·-]?\s*/, '')))
      idx = k ? next.findIndex((p) => titleKey(p.title) === k || (k.length >= 8 && (titleKey(p.title).includes(k) || k.includes(titleKey(p.title))))) : -1
    }
    if (idx < 0) continue
    const score = scoreOf(it.amount)
    if (score == null) continue
    next[idx].score = score
    const why = String(it.when ?? it.detail ?? '').trim()
    if (why) next[idx].reason = why
    matched += 1
  }
  return { items: rankByScore(next), matched, headline: String(answer.headline ?? '').trim() }
}

/** [더 짜내기] 로 나온 새 후보를 더한다(같은 명칭은 빼고 · 이번에 나온 것만 fresh · max 안 — 넘치면 점수가 가장 낮은 옛 후보부터 뺌) */
export function addFresh<T extends Ranked>(items: T[], more: T[], max: number): { items: T[]; added: number } {
  const fresh = more.filter((m) => !items.some((p) => titleKey(p.title) === titleKey(m.title))).map((m) => ({ ...m, fresh: true }))
  const all = rankByScore([...items.map((p) => ({ ...p, fresh: false })), ...fresh])
  while (all.length > max) {
    const drop = all.map((p, i) => ({ p, i })).filter((x) => !x.p.fresh).pop()
    if (!drop) break
    all.splice(drop.i, 1)
  }
  return { items: all.map((p) => (p.fresh ? p : { ...p, fresh: undefined })), added: fresh.length }
}
