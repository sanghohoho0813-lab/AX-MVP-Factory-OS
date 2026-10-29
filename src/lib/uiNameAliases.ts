/**
 * D-315 꾸미기 지키기 — 이름표가 바뀌어도 예전에 저장한 꾸미기가 그대로 이어지게(옛 이름 → 새 이름).
 * 목록 · 연결은 src/config/keepUiNames.json(scripts/qa-keep-ui.mjs 가 지킨다 — 이름표가 사라지면 연결을 적어야 시험이 녹색).
 */
import keep from '../config/keepUiNames.json'

type Aliases = Record<'layout' | 'fold' | 'nav' | 'theme', Record<string, string>>
const A = (keep as unknown as { aliases: Aliases }).aliases

/** 화면 꾸미기 칸 — 'page:옛id' → 새 id(연결이 없으면 그대로) */
export function layoutAlias(page: string, id: string): string {
  const to = A.layout[`${page}:${id}`]
  return to ? to.replace(`${page}:`, '') : id
}

/** 접기 — 이 id 로 바뀌기 전의 옛 id 들 */
export function foldOldIds(id: string): string[] {
  return Object.entries(A.fold)
    .filter(([, to]) => to === id)
    .map(([from]) => from)
}

/** 아래 메뉴 · 메뉴 key */
export function navAlias(key: string): string {
  return A.nav[key] ?? key
}

/** 테마 key */
export function themeAlias(key: string): string {
  return A.theme[key] ?? key
}
