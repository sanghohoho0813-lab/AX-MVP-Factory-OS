/**
 * OS 테마 강조색을 16진수로 (D-96) · 테마를 바꾸면 바로 따라가게 (D-98).
 *
 * 원본 모듈(영업·크레탑)은 색을 `C.blue + "40"` 처럼 16진수 뒤에 투명도를 붙여 쓴다 — CSS 변수(var())를 넣으면 깨진다.
 * 그래서 테마의 강조색을 16진수로 읽어 원본 팔레트에 넣는다.
 * D-96 에서는 모듈을 읽을 때 한 번만 읽어서, 테마를 바꾸면 새로고침해야 했다.
 * D-98: 모듈 화면이 그려질 때마다 지금 테마와 비교해, 바뀌었으면 팔레트와 그 색을 미리 담아 둔 표(단추·단계 색)를 새 색으로 고친다.
 */

import { useEffect, useReducer } from 'react'

export type BrandStep = '50' | '100' | '200' | '500' | '600' | '700'

export function brandHex(step: BrandStep, fallback: string): string {
  try {
    if (typeof document === 'undefined') return fallback
    const v = getComputedStyle(document.documentElement).getPropertyValue(`--color-brand-${step}`).trim()
    return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback
  } catch {
    return fallback
  }
}

/** 표 안의 글자 값에서 옛 색을 새 색으로 한 번에 바꾼다(옛 색 → 새 색이 다른 옛 색과 겹쳐도 두 번 바뀌지 않게 한 번에) */
export function retint(roots: readonly unknown[], map: ReadonlyMap<string, string>): void {
  if (map.size === 0) return
  const lower = new Map([...map].map(([k, v]) => [k.toLowerCase(), v]))
  const re = new RegExp([...lower.keys()].map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi')
  const seen = new Set<object>()
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    const rec = node as Record<string, unknown>
    for (const key of Object.keys(rec)) {
      const v = rec[key]
      if (typeof v === 'string') {
        const next = v.replace(re, (m) => lower.get(m.toLowerCase()) ?? m)
        if (next !== v) rec[key] = next
      } else if (v && typeof v === 'object') walk(v)
    }
  }
  roots.forEach(walk)
}

export type BrandSlots = Record<string, readonly [BrandStep, string]>

/**
 * 팔레트 이름표 → 테마 단계. `sync()` 는 지금 테마를 읽어, 바뀐 색만 `roots` 안에서 고친다.
 * 바뀐 것이 있으면 true.
 */
export function brandSync(slots: BrandSlots, roots: readonly unknown[]): () => boolean {
  const read = () => Object.fromEntries(Object.entries(slots).map(([k, [step, fb]]) => [k, brandHex(step, fb)]))
  let now: Record<string, string> = read()
  return () => {
    const next = read()
    const map = new Map<string, string>()
    for (const k of Object.keys(slots)) if (next[k].toLowerCase() !== now[k].toLowerCase()) map.set(now[k], next[k])
    if (map.size === 0) return false
    retint(roots, map)
    now = next
    return true
  }
}

/** 화면이 떠 있는 동안 테마를 바꾸면(html[data-theme]) 다시 그리게 한다 */
export function useThemeRerender(): void {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    const mo = new MutationObserver(() => bump())
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => mo.disconnect()
  }, [])
}
