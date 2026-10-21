/**
 * D-258 오른쪽 판 AI 대화 — 대화 · 묻는 중을 화면 밖(이 모듈)에 둔다.
 * 점검 결과: 답을 기다리는 사이 [웹] 탭으로 가거나 판을 닫으면 대화 칸이 사라져, 돌아왔을 때 '답을 받지 못했어요' 가 되고 온 답은 버려졌다.
 * 이제 판이 없어도 답은 여기로 와서 저장되고, 판을 다시 열면 그대로 보인다.
 * 계정을 바꾸면(금고가 키를 바꿔 끼움) 대화 칸이 다시 열릴 때 새로 읽고, 바꾸기 전에 물은 답은 새 사람 자리에 쓰지 않는다.
 */
import { useSyncExternalStore } from 'react'
import { callAssist } from './client'
import { newRequestId, readChoice } from './store'
import { DOCK_CHAT_KEY, DOCK_CHAT_MAX, dockChatContext, parseDockChat, type DockTurn } from '../../lib/sideDock'

export interface DockChatState {
  turns: DockTurn[]
  busy: boolean
}

function load(): DockTurn[] {
  try {
    return parseDockChat(localStorage.getItem(DOCK_CHAT_KEY))
  } catch {
    return []
  }
}

/** 지금 꺼내 놓은 사람(storageVault) — 묻는 사이 계정이 바뀌면 답을 버린다 */
function liveOwner(): string {
  try {
    return localStorage.getItem('axmvp.vault.live') ?? ''
  } catch {
    return ''
  }
}

let state: DockChatState = { turns: typeof window === 'undefined' ? [] : load(), busy: false }
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

function set(patch: Partial<DockChatState>) {
  state = { ...state, ...patch }
  emit()
}

function commit(fn: (cur: DockTurn[]) => DockTurn[]) {
  const turns = fn(state.turns).slice(-DOCK_CHAT_MAX)
  try {
    localStorage.setItem(DOCK_CHAT_KEY, JSON.stringify(turns))
  } catch {
    /* 저장 공간이 가득 차도 이번 접속 동안은 보인다 */
  }
  set({ turns })
}

const uid = () => `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`

/** 묻기 — 묻는 중이면 무시. screen = 지금 보는 화면 이름(그것만 보냄) */
export async function askDock(q: string, screen: string): Promise<void> {
  const question = q.trim()
  if (!question || state.busy) return
  const id = uid()
  const owner = liveOwner()
  const context = dockChatContext(state.turns, new Date().toLocaleDateString('sv-SE'), screen)
  commit((cur) => [...cur, { id, at: new Date().toISOString(), q: question, status: 'pending' }])
  set({ busy: true })
  try {
    const run = await callAssist({ requestId: newRequestId(), assistId: 'side.chat', page: 'side', choice: readChoice(), context, ask: question })
    const s = run.structured
    if (liveOwner() !== owner) return
    commit((cur) =>
      cur.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'done',
              headline: s?.headline || run.raw.slice(0, 2000),
              items: (s?.items ?? []).map((i) => ({ title: i.title, detail: i.detail, body: i.body })),
              next: s?.next ?? [],
              caution: s?.caution || undefined,
              model: run.model,
            }
          : t,
      ),
    )
  } catch (e) {
    if (liveOwner() !== owner) return
    const why = e instanceof Error && e.message ? e.message : 'AI 연결을 확인해 주세요'
    commit((cur) => cur.map((t) => (t.id === id ? { ...t, status: 'error', error: why } : t)))
  } finally {
    set({ busy: false })
  }
}

/** 지우기 · 되돌리기 */
export function setDockTurns(turns: readonly DockTurn[]): void {
  commit(() => [...turns])
}
export const dockTurns = (): readonly DockTurn[] => state.turns

/** 대화 칸이 열릴 때 — 묻는 중이 아니면 저장된 대화를 다시 읽는다(다른 계정 · 다른 창에서 바뀐 것) */
export function syncDockChat(): void {
  if (state.busy) return
  const turns = load()
  if (JSON.stringify(turns) !== JSON.stringify(state.turns)) set({ turns })
}

function subscribe(f: () => void): () => void {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
const snapshot = () => state

export function useDockChat(): DockChatState {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
