/**
 * D-217: 연구소 기록 저장 직전 합치기.
 *
 * 연구소 기록은 칸 하나(예: `pmsaas:notes:v1`)에 목록 전체를 담아 통째로 저장한다.
 * 예전에는 이 창이 가진 목록으로 그대로 덮어써서, 오래 열어 둔 다른 창 · 휴대폰 · 팀장이 그 사이 더한 기록을 지웠다.
 * 이제 저장 직전에 서버 값을 다시 읽어 id 로 합친다.
 *   - 이 창이 더했거나 고친 기록 → 이 창 것
 *   - 이 창이 손대지 않은 기록 → 서버 것(다른 곳에서 고쳤으면 고친 대로, 지웠으면 빠짐)
 *   - 서버에만 있는 기록 → 이 창이 한 번도 본 적 없으면 살린다(다른 곳에서 더한 것), 본 적 있으면 이 창이 지운 것이라 살리지 않는다
 * id 가 있는 기록 목록이 아니면(설정 · 표시 값) 예전처럼 이 창 값이 이긴다.
 * 순서는 서버 순서 그대로 두고 이 창에서 새로 적은 것을 뒤에 붙인다 — 연구소 기록은 새것을 뒤에 붙여 쌓으므로 적은 차례대로 보인다.
 */

type Item = { id: string } & Record<string, unknown>

export function isKeyedList(v: unknown): v is Item[] {
  return Array.isArray(v) && v.every((x) => !!x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string')
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * @param snap   이 창이 처음 읽어 온 값(손대지 않은 기록을 알아보는 기준)
 * @param local  지금 저장하려는 이 창의 값
 * @param remote 저장 직전에 다시 읽은 서버 값
 * @param seen   이 창이 한 번이라도 본 id(읽어 온 것 + 이 창이 적은 것)
 */
export function mergeKeyedList(snap: unknown, local: unknown, remote: unknown, seen: ReadonlySet<string>): unknown {
  if (!isKeyedList(local) || !isKeyedList(remote)) return local
  const snapById = new Map((isKeyedList(snap) ? snap : []).map((x) => [x.id, x]))
  const localById = new Map(local.map((x) => [x.id, x]))
  const remoteIds = new Set(remote.map((x) => x.id))
  const untouched = (l: Item) => {
    const s = snapById.get(l.id)
    return !!s && same(l, s)
  }
  const out: Item[] = []
  for (const r of remote) {
    const l = localById.get(r.id)
    if (l) out.push(untouched(l) ? r : l) // 이 창이 안 건드렸으면 다른 곳에서 고친 대로, 고쳤으면 이 창 것
    else if (!seen.has(r.id)) out.push(r) // 다른 곳에서 더한 것(이 창이 본 적 있으면 이 창이 지운 것)
  }
  for (const l of local) {
    if (remoteIds.has(l.id)) continue
    if (untouched(l)) continue // 이 창은 안 건드렸고 서버에 없음 → 다른 곳에서 지운 것
    out.push(l) // 이 창에서 새로 적은 것(또는 고쳤는데 다른 곳에서 지운 것 — 고친 쪽을 살린다)
  }
  return out
}
