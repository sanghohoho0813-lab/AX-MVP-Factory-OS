/**
 * D-486 미룬 할 일 흔적을 기기끼리 같게 — 내 클라우드 설정(ui_preferences.payload.todoTrail · 본인만)에.
 * 열 때 · 창으로 돌아올 때 맞추고(날짜는 합친다), 이 기기에서 할 일을 옮기면 곧 보낸다. 못 읽으면 아무것도 덮지 않는다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { TRAIL_CHANGED_EVENT, applyTrail, mergeTrail, parseTrail, readTrail } from '../todoTrail'
import { patchUiPayload, readUiPayload } from './uiPayload'

const PULL_GAP_MS = 15_000
const PUSH_DELAY_MS = 600

export async function pullTrail(client: SupabaseClient, userId: string, workspaceId: string): Promise<{ toLocal: boolean; toCloud: boolean }> {
  const { ok, payload } = await readUiPayload(client, userId, workspaceId)
  if (!ok) return { toLocal: false, toCloud: false }
  const m = mergeTrail(readTrail(), parseTrail(payload?.todoTrail))
  if (m.toLocal) applyTrail(m.merged)
  if (m.toCloud) await pushTrail(client, userId, workspaceId)
  return { toLocal: m.toLocal, toCloud: m.toCloud }
}

function pushTrail(client: SupabaseClient, userId: string, workspaceId: string): Promise<void> {
  return patchUiPayload(client, userId, workspaceId, (payload) => {
    const m = mergeTrail(readTrail(), parseTrail(payload.todoTrail))
    if (m.toLocal) applyTrail(m.merged)
    return m.toCloud ? { ...payload, todoTrail: m.merged } : null
  })
}

export function startTrailSync(
  client: SupabaseClient,
  userId: string,
  workspaceId: string,
  deps: { target?: Pick<Window, 'addEventListener' | 'removeEventListener'> | null; doc?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> | null } = {},
): () => void {
  const win = deps.target === undefined ? (typeof window !== 'undefined' ? window : null) : deps.target
  const doc = deps.doc === undefined ? (typeof document !== 'undefined' ? document : null) : deps.doc
  let lastPull = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const pull = () => {
    lastPull = Date.now()
    void pullTrail(client, userId, workspaceId).catch(() => undefined)
  }
  const onChanged = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void pushTrail(client, userId, workspaceId)
    }, PUSH_DELAY_MS)
  }
  const onBack = () => {
    if (doc && doc.visibilityState === 'hidden') return
    if (Date.now() - lastPull < PULL_GAP_MS) return
    pull()
  }
  pull()
  win?.addEventListener(TRAIL_CHANGED_EVENT, onChanged)
  win?.addEventListener('focus', onBack)
  doc?.addEventListener('visibilitychange', onBack)
  return () => {
    if (timer) {
      clearTimeout(timer)
      void pushTrail(client, userId, workspaceId)
    }
    win?.removeEventListener(TRAIL_CHANGED_EVENT, onChanged)
    win?.removeEventListener('focus', onBack)
    doc?.removeEventListener('visibilitychange', onBack)
  }
}
