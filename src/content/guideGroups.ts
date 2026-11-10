/**
 * 이 계정에 보이는 메뉴 · 화면 표(D-565 사용법 안내 화면이 그리던 것 — D-592 찾기도 같은 표를 쓴다).
 * 왼쪽 메뉴와 같은 표(enabledModulesByGroup)에서 만든다 — 고객 계정에는 전문 모듈 묶음이 없다.
 */
import { enabledModulesByGroup, type ModuleDefinition } from '../config/moduleRegistry'
import { MARKETING_GUIDE_LIST } from './menuGuide'
import { functionGuidesOf } from './functionGuide'

export interface GuideRow {
  key: string
  label: string
  path: string
  hint?: string
  /** 묶음 안쪽 줄(분야 아래 도구 · 마케팅 안 화면) */
  nested?: boolean
  /** 아직 없는 기능(출시 예정 · 준비 중) — [화면 열기] 대신 '준비 중' */
  soon?: boolean
  /** 화면이 아니라 단추(D-569 어느 화면에나 있는 위쪽 단추) — [이 화면 열기] 없음 */
  noLink?: boolean
}

export interface GuideGroup {
  key: string
  title: string
  rows: GuideRow[]
}

function rowsOf(items: ModuleDefinition[], marketingOpen: boolean, basic: boolean): GuideRow[] {
  const out: GuideRow[] = []
  const tops = items.filter((m) => !m.parent)
  for (const m of tops) {
    out.push({ key: m.key, label: m.label, path: m.path, hint: m.hint, soon: m.status === 'soon' || m.status === 'next' })
    for (const c of items.filter((x) => x.parent === m.key)) out.push({ key: c.key, label: c.label, path: c.path, hint: c.hint, nested: true, soon: c.key.startsWith('up-') })
    if (m.key === 'marketing' && marketingOpen) for (const s of MARKETING_GUIDE_LIST) if (!(basic && s.basicHidden)) out.push({ key: s.key, label: s.label, path: s.path, nested: true })
  }
  return out
}

export function guideGroupsFor(opts: { advanced: boolean; pilot: boolean; caps: ReadonlySet<string>; basic: boolean; pilotMarketing: boolean }): GuideGroup[] {
  const { pilot, basic } = opts
  const menus = enabledModulesByGroup({ advanced: opts.advanced, pilot, caps: opts.caps }).map((g) => ({ key: g.group.key as string, title: g.group.title, rows: rowsOf(g.items, !pilot || opts.pilotMarketing, basic) }))
  // D-569 어느 화면에나 있는 위쪽 단추(찾기 · 종 · 화면 꾸미기 …) — 메뉴 묶음 뒤에 한 묶음
  const top: GuideRow[] = functionGuidesOf('top', { pilot, basic }).map(({ key, guide }) => ({ key, label: guide.label, path: '', noLink: true }))
  return top.length > 0 ? [...menus, { key: 'top', title: '어느 화면에나', rows: top }] : menus
}
