/**
 * D-271 명세서 휴지통 — 대표: "지우더라도 그 기록은 좀 남아 있게 · 실수로 지웠으면 다 날아가면 너무 아까우니까 ·
 *   나중에 청소한다 생각하고 지울 수도 있게 · 완벽하게 지우려면 두 번 확인 · 글자를 그대로 넣게까지 빡세게 할 필요는 없고".
 * 지우면 초안 기록에 trashedAt 만 붙인다(DB 변경 없음 · 같은 기록) — 목록 · 진행판 · 벤처 재료에서는 빠지고 휴지통에서 되살린다.
 * 영구 삭제만 기록을 없앤다.
 */

export const trashedAtOf = (data: unknown): string => {
  const v = data && typeof data === 'object' ? (data as Record<string, unknown>).trashedAt : ''
  return typeof v === 'string' ? v : ''
}

export const isTrashed = (data: unknown): boolean => !!trashedAtOf(data)

/** 휴지통에 없는 것 */
export function liveRows<T extends { data: unknown }>(rows: readonly T[] | null | undefined): T[] {
  return (rows ?? []).filter((r) => !isTrashed(r.data))
}

/** 휴지통에 있는 것 — 최근에 지운 것부터 */
export function trashRows<T extends { data: unknown }>(rows: readonly T[] | null | undefined): T[] {
  return (rows ?? []).filter((r) => isTrashed(r.data)).sort((a, b) => trashedAtOf(b.data).localeCompare(trashedAtOf(a.data)))
}

export const withTrash = <D extends Record<string, unknown>>(data: D, at: string): D => ({ ...data, trashedAt: at })

export function withoutTrash<D extends Record<string, unknown>>(data: D): D {
  const next = { ...data } as Record<string, unknown>
  delete next.trashedAt
  return next as D
}
