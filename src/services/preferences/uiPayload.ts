/**
 * D-485 · D-486 로그인한 사람의 클라우드 설정 한 줄(ui_preferences.payload — 본인만 읽고 쓰는 표)을 여러 기능이 함께 쓴다.
 * 화면 꾸미기(layouts) · 미룬 할 일 흔적(todoTrail)이 같은 줄에 있으므로, 고쳐 쓰기는 한 줄로 줄 세운다 —
 * 쓰기 직전에 다시 읽고 자기 칸만 바꿔서, 한 기능이 다른 기능의 칸을 옛 값으로 덮지 않게.
 * 표를 새로 만들거나 고치지 않는다(DB 변경 0).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type UiPayload = Record<string, unknown>
const TABLE = 'ui_preferences'

export async function readUiPayload(client: SupabaseClient, userId: string, workspaceId: string): Promise<{ ok: boolean; payload: UiPayload | null }> {
  try {
    const { data, error } = await client.from(TABLE).select('payload').eq('user_id', userId).eq('workspace_id', workspaceId).maybeSingle()
    if (error) return { ok: false, payload: null }
    const p = (data as { payload?: unknown } | null)?.payload
    return { ok: true, payload: p && typeof p === 'object' ? (p as UiPayload) : null }
  } catch {
    return { ok: false, payload: null }
  }
}

const queues = new Map<string, Promise<unknown>>()

/**
 * 줄 세워 고쳐 쓰기 — patch 가 지금 클라우드 값(못 읽었으면 부르지 않음)을 받아 새 값을 돌려준다. null 이면 쓰지 않는다.
 * 실패해도 던지지 않는다(다음에 맞출 때 다시 보낸다).
 */
export function patchUiPayload(client: SupabaseClient, userId: string, workspaceId: string, patch: (current: UiPayload) => UiPayload | null): Promise<void> {
  const key = `${userId}|${workspaceId}`
  const prev = queues.get(key) ?? Promise.resolve()
  const job = prev
    .catch(() => undefined)
    .then(async () => {
      const { ok, payload } = await readUiPayload(client, userId, workspaceId)
      if (!ok) return
      const next = patch(payload ?? {})
      if (!next) return
      await client.from(TABLE).upsert({ user_id: userId, workspace_id: workspaceId, payload: next }, { onConflict: 'user_id,workspace_id' })
    })
    .catch(() => undefined)
  queues.set(key, job)
  return job
}
