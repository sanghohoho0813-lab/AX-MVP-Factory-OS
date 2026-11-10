/**
 * D-592 찾기에서 화면 · 기능 이름으로도 찾기.
 *
 * 찾기 안내 글은 '화면 이름을 한 칸에서 찾아요' 라고 하는데, 실제로는 업체와 전문 모듈만 찾았다 —
 * 전문 모듈이 닫힌 고객 계정은 '스레드' · '일정' · '프로필 소개' 를 쳐도 아무것도 안 나왔다.
 *
 *  - 재료는 사용법 안내와 같은 표(이 계정에 보이는 메뉴 + 화면 안 기능 안내). 그래서 닫힌 화면은 여기서도 안 나온다.
 *  - 이름이 맞으면 먼저, 설명 글에만 있으면 뒤에(설명만 맞은 것은 세 개까지).
 *  - 화면이면 그 화면으로, 화면 안 기능이면 그 기능이 있는 화면으로. 어느 화면에나 있는 위쪽 단추는 안내 글로.
 * 규칙 계산이다 — AI 가 아니다.
 */
import { menuGuide } from './menuGuide'
import { functionGuidesOf } from './functionGuide'

export interface ScreenSearchRow {
  key: string
  label: string
  path: string
  hint?: string
  /** 아직 없는 화면(준비 중) — 찾아 주지 않는다 */
  soon?: boolean
  /** 화면이 아니라 어느 화면에나 있는 단추 */
  noLink?: boolean
}

export interface ScreenSearchGroup {
  key: string
  title: string
  rows: ScreenSearchRow[]
}

export interface ScreenHit {
  key: string
  kind: 'screen' | 'function'
  label: string
  sublabel: string
  path: string
}

/** 띄어쓰기 · 가운뎃점 · 괄호를 빼고 견준다 — '프로필소개' 로 쳐도 '프로필 소개 글' 이 맞게 */
export function squashForSearch(s: string): string {
  return s.toLowerCase().replace(/[\s·.,/()[\]'"‘’“”›>~+-]+/g, '')
}

const NAME_HIT = 20
const WHAT_ONLY_MAX = 3

/** 찾는 말 → 화면 · 기능(점수 높은 순). 두 글자부터 찾는다(한 글자는 너무 많이 걸린다) */
export function searchScreens(query: string, groups: ReadonlyArray<ScreenSearchGroup>, opts: { pilot?: boolean; basic?: boolean } = {}, limit = 6): ScreenHit[] {
  const q = squashForSearch(query)
  if ([...q].length < 2) return []
  const found: Array<ScreenHit & { score: number; order: number }> = []
  const seen = new Set<string>()
  let order = 0
  const push = (hit: ScreenHit, score: number) => {
    const id = `${hit.path}|${squashForSearch(hit.label)}`
    if (score <= 0 || seen.has(id)) return
    seen.add(id)
    found.push({ ...hit, score, order: order++ })
  }
  const nameScore = (label: string) => {
    const t = squashForSearch(label)
    if (!t.includes(q)) return 0
    return t === q ? 40 : t.startsWith(q) ? 30 : NAME_HIT
  }

  for (const g of groups) {
    for (const r of g.rows) {
      if (r.soon) continue
      const guide = menuGuide(r.key, { label: r.label, hint: r.hint, basic: opts.basic })
      if (r.noLink) {
        // 어느 화면에나 있는 위쪽 단추 — 갈 화면이 따로 없어 안내 글을 연다
        const s = nameScore(r.label) || (squashForSearch(guide.what).includes(q) ? 4 : 0)
        push({ key: r.key, kind: 'function', label: r.label, sublabel: `어느 화면에나 있는 단추 — ${guide.what}`, path: `/guide?m=${encodeURIComponent(r.key)}` }, s)
        continue
      }
      if (!r.path) continue
      // 메뉴 힌트는 대표 화면 기준으로 적혀 있다(닫힌 도구 이름이 섞여 있다) — 고객 계정은 이름과 안내 글로만 찾는다
      const hintHit = !opts.basic && r.hint && squashForSearch(r.hint).includes(q) ? 12 : 0
      const s = nameScore(r.label) + hintHit || (squashForSearch(guide.what).includes(q) ? 6 : 0)
      push({ key: r.key, kind: 'screen', label: r.label, sublabel: guide.what, path: r.path }, s ? s + 10 : 0)
      for (const { key, guide: fn } of functionGuidesOf(r.key, opts)) {
        const what = menuGuide(key, { basic: opts.basic }).what
        const fs = nameScore(fn.label) || (squashForSearch(what).includes(q) ? 5 : 0)
        push({ key, kind: 'function', label: fn.label, sublabel: `'${r.label}' 화면 안 — ${what}`, path: r.path }, fs)
      }
    }
  }

  found.sort((a, b) => b.score - a.score || a.order - b.order)
  const out: ScreenHit[] = []
  let whatOnly = 0
  for (const { score, order: _order, ...hit } of found) {
    if (out.length >= limit) break
    if (score < NAME_HIT) {
      if (whatOnly >= WHAT_ONLY_MAX) continue
      whatOnly++
    }
    out.push(hit)
  }
  return out
}
