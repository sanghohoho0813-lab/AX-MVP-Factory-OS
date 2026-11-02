/**
 * D-485 화면 꾸미기를 기기끼리 같게 — 로그인한 사람의 클라우드 설정(ui_preferences — 본인만 읽고 쓰는 표)에 둔다.
 *
 * 대표: "폰으로 보면 오늘 화면 꾸미기에서 숨겨 놓은 것들이 다시 보인다. PC 는 따르는데 모바일은 안 따른다. 앞으로도 계속 강제."
 *  - 표를 새로 만들지 않는다 — 이미 있는 ui_preferences.payload 안 layouts 에 화면별로(다른 칸은 그대로 두고 그 칸만 고쳐 쓴다).
 *  - 열 때 · 창으로 돌아올 때 클라우드와 맞추고(lib/pageLayout mergeLayout), 사람이 꾸미기를 바꾸면 곧 클라우드로 보낸다.
 *  - 클라우드를 못 읽으면 아무것도 덮지 않는다(이 기기 기억 그대로).
 *  - 대표 ↔ 팀장은 사람마다 다른 줄(user_id)이다 — 서로의 꾸미기는 보이지 않는다(RLS: user_id = auth.uid()).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { LAYOUT_CHANGED_EVENT, applyLayouts, localLayouts, mergeLayout, parseLayout, type PageLayout } from '../../lib/pageLayout'
import { patchUiPayload, readUiPayload, type UiPayload } from './uiPayload'

/** 창으로 돌아올 때 다시 맞추는 간격(너무 자주 묻지 않게) */
const PULL_GAP_MS = 15_000
const PUSH_DELAY_MS = 600

type Payload = UiPayload

function cloudLayouts(payload: Payload | null): Record<string, PageLayout> {
  const raw = payload?.layouts
  const out: Record<string, PageLayout> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [page, v] of Object.entries(raw as Record<string, unknown>)) out[page] = parseLayout(page, v)
  return out
}

export interface LayoutSyncDeps {
  now?: () => string
  /** 시험용 — 창 이벤트 대신 */
  target?: Pick<Window, 'addEventListener' | 'removeEventListener'> | null
  doc?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> | null
}

/** 한 번 맞추기(열 때 · 창으로 돌아올 때) — 시험에서도 부른다 */
export async function pullLayouts(client: SupabaseClient, userId: string, workspaceId: string, now = () => new Date().toISOString()): Promise<{ toLocal: string[]; toCloud: string[] }> {
  const { ok, payload } = await readUiPayload(client, userId, workspaceId)
  if (!ok) return { toLocal: [], toCloud: [] }
  const cloud = cloudLayouts(payload)
  const local = localLayouts()
  const at = now()
  const toLocal: Record<string, PageLayout> = {}
  const toCloud: Record<string, PageLayout> = {}
  for (const page of new Set([...Object.keys(local), ...Object.keys(cloud)])) {
    const m = mergeLayout(local[page], cloud[page], at)
    if (m.toLocal) toLocal[page] = m.merged
    if (m.toCloud) toCloud[page] = m.merged
  }
  if (Object.keys(toLocal).length) applyLayouts(toLocal)
  if (Object.keys(toCloud).length) await writePages(client, userId, workspaceId, toCloud)
  return { toLocal: Object.keys(toLocal), toCloud: Object.keys(toCloud) }
}

/**
 * 화면 몇 개의 꾸미기를 클라우드에 — payload 의 다른 칸 · 다른 화면은 그대로.
 * 사람이 방금 바꾼 것이 언제나 이긴다: 기기 시계가 늦어 클라우드 쪽 바꾼 때가 더 나중이면, 보내는 것의 바꾼 때를 그보다 1ms 뒤로 올린다
 * (예전에는 '클라우드가 더 새것' 으로 보고 방금 숨긴 칸을 되돌릴 수 있었다).
 */
function writePages(client: SupabaseClient, userId: string, workspaceId: string, pages: Record<string, PageLayout>): Promise<void> {
  return patchUiPayload(client, userId, workspaceId, (payload) => {
    const cloud = cloudLayouts(payload)
    const send: Record<string, PageLayout> = {}
    const bumped: Record<string, PageLayout> = {}
    for (const [page, l] of Object.entries(pages)) {
      const c = cloud[page]
      if (c?.at && (!l.at || c.at >= l.at)) {
        const t = Date.parse(c.at)
        send[page] = bumped[page] = { ...l, at: new Date((Number.isFinite(t) ? t : Date.now()) + 1).toISOString() }
      } else send[page] = l
    }
    if (Object.keys(bumped).length) applyLayouts(bumped)
    if (!Object.keys(send).length) return null
    const prev = (payload.layouts && typeof payload.layouts === 'object' ? payload.layouts : {}) as Record<string, unknown>
    return { ...payload, layouts: { ...prev, ...send } }
  })
}

/** 로그인 · 작업공간이 정해지면 켠다. 끄는 함수를 돌려준다 */
export function startLayoutSync(client: SupabaseClient, userId: string, workspaceId: string, deps: LayoutSyncDeps = {}): () => void {
  const now = deps.now ?? (() => new Date().toISOString())
  const win = deps.target === undefined ? (typeof window !== 'undefined' ? window : null) : deps.target
  const doc = deps.doc === undefined ? (typeof document !== 'undefined' ? document : null) : deps.doc
  let stopped = false
  let lastPull = 0
  let pending = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let chain: Promise<unknown> = Promise.resolve()
  // 한 번에 하나씩 — 맞추는 중에 보내기가 끼어들어 서로 덮지 않게
  const queue = (job: () => Promise<unknown>, evenIfStopped = false) => {
    chain = chain.then(() => (stopped && !evenIfStopped ? undefined : job())).catch(() => undefined)
    return chain
  }

  const pull = () => {
    lastPull = Date.now()
    return queue(() => pullLayouts(client, userId, workspaceId, now))
  }
  const flush = () => {
    timer = null
    const pages = [...pending]
    pending = new Set()
    if (!pages.length) return
    const local = localLayouts()
    const send: Record<string, PageLayout> = {}
    for (const p of pages) if (local[p]) send[p] = local[p]
    // 화면을 떠나며 끄는 순간 바꾼 것도 보낸다
    void queue(() => writePages(client, userId, workspaceId, send), true)
  }
  const onChanged = (e: Event) => {
    const page = (e as CustomEvent<string>).detail
    if (typeof page !== 'string') return
    pending.add(page)
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, PUSH_DELAY_MS)
  }
  const onBack = () => {
    if (doc && doc.visibilityState === 'hidden') return
    if (Date.now() - lastPull < PULL_GAP_MS) return
    void pull()
  }

  void pull()
  win?.addEventListener(LAYOUT_CHANGED_EVENT, onChanged)
  win?.addEventListener('focus', onBack)
  doc?.addEventListener('visibilitychange', onBack)
  return () => {
    stopped = true
    if (timer) {
      clearTimeout(timer)
      flush()
    }
    win?.removeEventListener(LAYOUT_CHANGED_EVENT, onChanged)
    win?.removeEventListener('focus', onBack)
    doc?.removeEventListener('visibilitychange', onBack)
  }
}
