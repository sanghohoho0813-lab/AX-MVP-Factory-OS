/**
 * AI 사용량 — 달마다 호출 수 · 빠르게/보통/깊게 · 토큰 · 예상 비용(가격을 설정했을 때만 — 지어내지 않는다).
 * 복잡한 대시보드가 아니라 한 장 표(대표가 비용을 신경 쓴다).
 */
import type { AiRun, SkillId, Tier } from './types'
import { skillName } from './skillCatalog'

export interface MonthUsage {
  month: string
  calls: number
  byTier: Record<Tier, number>
  inputTokens: number
  outputTokens: number
  /** 가격을 아는 호출의 합(USD) — 가격을 모르는 호출이 있으면 costUnknownCalls 로 따로 */
  costUsd: number
  costUnknownCalls: number
  failed: number
  bySkill: { skillId: SkillId; name: string; calls: number; adopted: number; rejected: number }[]
}

export const monthOf = (iso: string) => (iso ?? '').slice(0, 7)

export function monthUsage(runs: readonly AiRun[], month: string): MonthUsage {
  const list = runs.filter((r) => monthOf(r.createdAt) === month && r.tier !== 'manual')
  const byTier: Record<Tier, number> = { cheap: 0, standard: 0, deep: 0, manual: 0 }
  const skills = new Map<SkillId, MonthUsage['bySkill'][number]>()
  let input = 0
  let output = 0
  let cost = 0
  let unknown = 0
  let failed = 0
  for (const r of list) {
    byTier[r.tier] += 1
    input += r.usage.input
    output += r.usage.output
    if (r.estimatedCostUsd == null) unknown += 1
    else cost += r.estimatedCostUsd
    if (r.status === 'failed') failed += 1
    const s = skills.get(r.skillId) ?? { skillId: r.skillId, name: skillName(r.skillId), calls: 0, adopted: 0, rejected: 0 }
    s.calls += 1
    if (r.evaluation === 'adopted' || r.evaluation === 'partially_adopted') s.adopted += 1
    if (r.evaluation === 'rejected') s.rejected += 1
    skills.set(r.skillId, s)
  }
  return {
    month,
    calls: list.length,
    byTier,
    inputTokens: input,
    outputTokens: output,
    costUsd: Math.round(cost * 10000) / 10000,
    costUnknownCalls: unknown,
    failed,
    bySkill: [...skills.values()].sort((a, b) => b.calls - a.calls),
  }
}

export function usageMonths(runs: readonly AiRun[], today: string): string[] {
  const set = new Set(runs.map((r) => monthOf(r.createdAt)).filter(Boolean))
  set.add(monthOf(today))
  return [...set].sort().reverse()
}
