/**
 * 준비도 5단계 (D-170) — 근거(✓ △ ✗ ?) 목록에서 등급을 정한다. 숫자는 화면에 내지 않는다.
 *
 *  - 반드시 필요한 조건(must)이 ✗ 하나라도 → 매우 낮음
 *  - 반드시 필요한 조건을 모르면 → 추가 확인 필요
 *  - 나머지(core)는 ✓ 2 · △ 1 · ✗ 0 으로 비율을 보고 매우 높음 ~ 매우 낮음. 절반 넘게 모르면 추가 확인 필요.
 */
import type { CheckState, Readiness, Reason } from './types'

export interface Check {
  weight: 'must' | 'core'
  state: CheckState
  text: string
}

export function readinessOf(checks: readonly Check[]): Readiness {
  const must = checks.filter((c) => c.weight === 'must')
  if (must.some((c) => c.state === 'no')) return 'very_low'
  if (must.some((c) => c.state === 'unknown')) return 'unknown'
  const core = checks.filter((c) => c.weight === 'core')
  if (core.length === 0) return must.length ? 'high' : 'unknown'
  const unknown = core.filter((c) => c.state === 'unknown').length
  if (unknown * 2 > core.length) return 'unknown'
  const known = core.filter((c) => c.state !== 'unknown')
  const got = known.reduce((s, c) => s + (c.state === 'ok' ? 2 : c.state === 'warn' ? 1 : 0), 0)
  const r = got / (known.length * 2)
  if (r >= 0.85) return 'very_high'
  if (r >= 0.65) return 'high'
  if (r >= 0.45) return 'medium'
  if (r >= 0.25) return 'low'
  return 'very_low'
}

/** 근거는 ✗ → △ → ? → ✓ 순으로(보강할 것이 먼저 눈에) — 단, 화면에서는 ✓ 를 먼저 보여 '되는 것' 부터 */
export function reasonsOf(checks: readonly Check[]): Reason[] {
  const order: Record<CheckState, number> = { ok: 0, warn: 1, unknown: 2, no: 3 }
  return [...checks].sort((a, b) => order[a.state] - order[b.state]).map((c) => ({ state: c.state, text: c.text }))
}

export const READINESS_RANK: Record<Readiness, number> = { very_high: 5, high: 4, medium: 3, low: 2, very_low: 1, unknown: 0 }
