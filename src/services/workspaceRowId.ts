/**
 * D-538 작업공간마다 다른 줄 id — 예전에 작업공간과 상관없이 같던 id(자체점검 기준 `self-check` · 스레드 이번 주 참고 `wk_<주>`)를 작업공간별로.
 *
 * 왜: 모듈 기록(module_data)의 id 는 DB 전체에서 하나다. 두 작업공간에 모두 쓸 수 있는 사람(대표 — 팀장 화면)이 같은 id 로 저장하면
 *     그 줄이 다른 작업공간으로 **옮겨졌고**(0023 전 — 대표 기록이 팀장 작업공간에 섞임), 0023 뒤에는 **그 저장이 막힌다**.
 *     팀장 본인은 대표가 먼저 만든 같은 id 줄을 고칠 수 없어(RLS) 처음부터 저장이 안 됐다.
 * 방법: 클라우드 줄 id 끝에 작업공간 표시를 붙인다. 브라우저 저장(작업공간 없음)은 예전 id 그대로 — 겹칠 일이 없다.
 * 예전 줄은 지우지 않는다 — 읽을 때 이 작업공간 줄이 없으면 예전 줄(같은 작업공간 안에 있던 것만)을 쓴다.
 */
export const workspaceTag = (ws: string): string => ws.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)

/** 작업공간이 있으면 `<base>_<작업공간>` · 없으면(브라우저 저장) `<base>` */
export function workspaceRowId(base: string, ws: string | null | undefined): string {
  const tag = ws ? workspaceTag(ws) : ''
  return tag ? `${base}_${tag}` : base
}

/**
 * 이 작업공간 줄 → 없으면 예전 줄(base · legacy 순서).
 * rows 는 이미 이 작업공간으로 걸러진 목록(listRows) — 다른 작업공간의 예전 줄은 들어오지 않는다.
 */
export function pickScopedRow<T extends { id: string }>(rows: readonly T[], base: string, ws: string | null | undefined, ...legacy: string[]): T | undefined {
  const own = rows.find((r) => r.id === workspaceRowId(base, ws))
  if (own) return own
  for (const id of [base, ...legacy]) {
    const old = rows.find((r) => r.id === id)
    if (old) return old
  }
  return undefined
}
