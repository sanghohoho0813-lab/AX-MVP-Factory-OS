/**
 * D-628 이 화면의 대화창은 오른쪽에 — 대표(2026-11-18): "대화창 방식은 전부 오른쪽에 띄우자 — 가운데는 작업창, 오른쪽에서 요청".
 *
 * 화면(모듈 · 특허 · 벤처 · 기업인증 · 마케팅 · AI 도우미)은 자기 대화창을 여기에 알린다(register). 오른쪽 판(SideDock)은
 * 판 안의 자리(slot)를 내주고, 화면은 그 자리로 대화창을 그려 보낸다(portal — 화면의 React 문맥 그대로).
 *
 *   PC  본문 옆에 붙일 폭이 되면(dock) 대화창이 있는 화면에서 저절로 열린다 — 닫으면 기억(다시 열지 않음) · 오른쪽 끝 [대화] 로 다시.
 *       좁은 PC(over)는 저절로 열지 않는다 — [대화] 를 눌러야.
 *   휴대폰(1024 아래)  오른쪽 아래 둥근 [대화] → 아래에서 올라오는 판.
 *
 * 한 화면에 여럿이면 보이는 것은 하나: 눌러서 연 AI 도우미 → 그 화면 대화창 → 그 화면 AI 도우미(대화창이 없는 화면).
 * [대화] 탭이 처음 보여 주는 것:
 *   대화창이 있는 화면(모듈 · 특허 · 벤처 · 기업인증 · 마케팅 — launcher) = 그 화면 대화창
 *   AI 도우미만 있는 화면(오늘 · 고객 관리 · 영업 관리 …)              = 예전 그대로 자유 대화 — [⋯] AI 도우미를 누르면 그 도우미가 판에
 *   판 머리의 그림 단추로 둘 사이를 오간다(그 화면에서만 · 이번 접속 동안).
 * 저장: 닫아 둔 것만 이 브라우저에(axmvp.ui.page_chat). 열림 · 시작은 이번 접속 동안만.
 */
import { useSyncExternalStore } from 'react'
import { closeDock, setDock } from './sideDock'

export type PageChatMode = 'dock' | 'over' | 'none'

/** 대화창 바탕 — 화면보다 살짝만 진하게(대화라고 보이게 · 너무 진하지 않게). 답 카드는 흰 판 · 내 질문은 파란 말풍선 */
export const CHAT_TINT = 'bg-slate-100'

export interface PageChatEntry {
  key: number
  /** 이 대화가 속한 곳 — 같은 곳 안에서 화면을 옮겨도 판이 열린 채('mod:policy-funding' · 'pv' · 'cert' · 'mk' · 'assist:…') */
  scope: string
  kind: 'chat' | 'assist'
  /** 붙일 폭이 되면 저절로 열까 */
  auto: boolean
  /** 닫혀 있을 때 여는 단추(오른쪽 끝 [대화] · 휴대폰 둥근 단추)를 보일까 */
  launcher: boolean
  /** 휴대폰에서 여는 단추를 눌렀을 때 — 자기 판을 따로 여는 대화(AI 도우미는 예전 판 그대로) */
  openPhone?: () => void
}

export interface PageChatState {
  entries: readonly PageChatEntry[]
  slot: HTMLElement | null
  /** 판을 열어 둔 곳(scope) — 그 곳의 대화창이 있는 화면에서만 판이 보인다 */
  open: string | null
  /** 눌러서 연 AI 도우미(등록 번호) — 그 화면 대화창 위에 */
  explicit: number | null
  /** 닫아 둔 것을 기억(저절로 열지 않는다) */
  closed: boolean
  /** 휴대폰 아래 판 */
  sheet: boolean
  /** 그림 단추로 처음 보이는 것에서 바꿔 둔 곳(scope) — 대화창이 있는 화면은 자유 대화로, AI 도우미만 있는 화면은 그 도우미로 */
  flipped: readonly string[]
  /** [대화 시작] 을 누른 곳(scope) */
  started: readonly string[]
  mode: PageChatMode
  /** 판이 지금 그려져 있는가(SideDock 이 알린다) */
  dockShown: boolean
}

export const PAGE_CHAT_KEY = 'axmvp.ui.page_chat'

export function parsePageChat(raw: string | null): { closed: boolean } {
  try {
    const v = raw ? (JSON.parse(raw) as { closed?: unknown }) : {}
    return { closed: v?.closed === true }
  } catch {
    return { closed: false }
  }
}

function readClosed(): boolean {
  try {
    return parsePageChat(window.localStorage.getItem(PAGE_CHAT_KEY)).closed
  } catch {
    return false
  }
}

function writeClosed(closed: boolean): void {
  try {
    // 고친 칸만 바꿔 쓴다(이 버전이 모르는 값은 그대로 — D-315)
    const prev = (JSON.parse(window.localStorage.getItem(PAGE_CHAT_KEY) ?? '{}') ?? {}) as Record<string, unknown>
    window.localStorage.setItem(PAGE_CHAT_KEY, JSON.stringify({ ...prev, closed }))
  } catch {
    /* 저장이 안 돼도 이번 화면에서는 바뀐다 */
  }
}

let state: PageChatState = {
  entries: [],
  slot: null,
  open: null,
  explicit: null,
  closed: typeof window === 'undefined' ? false : readClosed(),
  sheet: false,
  flipped: [],
  started: [],
  mode: typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'over' : 'none',
  dockShown: false,
}
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function set(patch: Partial<PageChatState>): void {
  let changed = false
  for (const k of Object.keys(patch) as (keyof PageChatState)[]) if (state[k] !== patch[k]) changed = true
  if (!changed) return
  state = { ...state, ...patch }
  emit()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === PAGE_CHAT_KEY || e.key === null) set({ closed: readClosed() })
  })
}

/**
 * 보이는 순서 — 눌러서 연 AI 도우미(4) → 그 화면 대화창(3) → 그 화면의 대화창으로 삼은 AI 도우미(2 — 여는 단추가 있는 것) → 그 밖의 AI 도우미(1).
 * 같으면 먼저 알린 것.
 */
function rankOf(e: PageChatEntry, explicit: number | null): number {
  if (e.key === explicit) return 4
  if (e.kind === 'chat') return 3
  return e.launcher ? 2 : 1
}

/** 지금 화면에서 보일 대화창(없으면 null) */
export function currentPageChat(s: PageChatState = state): PageChatEntry | null {
  let best: PageChatEntry | null = null
  for (const e of s.entries) if (!best || rankOf(e, s.explicit) > rankOf(best, s.explicit)) best = e
  return best
}

/** 이 화면의 본래 대화창 — 눌러서 연 AI 도우미를 빼고(그것을 닫으면 돌아갈 곳) */
export function basePageChat(s: PageChatState = state): PageChatEntry | null {
  return currentPageChat({ ...s, explicit: null })
}

let seq = 0
export function nextPageChatKey(): number {
  seq += 1
  return seq
}

/** [대화] 탭이 처음부터 이 화면 대화창을 보여 주는 화면인가 — 대화창(chat) · 그 화면의 대화창으로 삼은 AI 도우미(launcher). 아니면 자유 대화가 먼저 */
const pageFirst = (e: PageChatEntry) => e.kind === 'chat' || e.launcher

/** [대화] 탭이 지금 이 화면 대화창(또는 눌러서 연 AI 도우미)을 보여 주는가 — 아니면 자유 대화 */
export function pageChatView(s: PageChatState = state): boolean {
  const base = basePageChat(s)
  if (!base) return false
  if (s.explicit !== null && s.entries.some((e) => e.key === s.explicit)) return true
  const flipped = s.flipped.includes(base.scope)
  return pageFirst(base) ? !flipped : flipped
}

const without = (list: readonly string[], scope: string) => (list.includes(scope) ? list.filter((x) => x !== scope) : list)
const withScope = (list: readonly string[], scope: string) => (list.includes(scope) ? list : [...list, scope])
/** 이 화면 대화창이 보이게(자유 대화로 바꿔 둔 것을 푼다) */
function showPage(base: PageChatEntry): readonly string[] {
  return pageFirst(base) ? without(state.flipped, base.scope) : withScope(state.flipped, base.scope)
}

/** 그림 단추 — 이 화면 대화 ↔ 자유 대화 */
export function togglePageChatView(): void {
  const base = basePageChat()
  if (!base) return
  // 눌러서 연 AI 도우미가 떠 있으면 그것부터 내린다(자유 대화가 보이게)
  if (state.explicit !== null) {
    set({ explicit: null, flipped: pageFirst(base) ? withScope(state.flipped, base.scope) : without(state.flipped, base.scope) })
    return
  }
  set({ flipped: state.flipped.includes(base.scope) ? without(state.flipped, base.scope) : withScope(state.flipped, base.scope) })
}

/** 자유 대화를 보이게 — 머리줄 [○○ 로 대화](화면과 상관없이 고른 AI 와 대화) */
export function showFreeChat(): void {
  const base = basePageChat()
  if (!base) return
  set({ explicit: null, flipped: pageFirst(base) ? withScope(state.flipped, base.scope) : without(state.flipped, base.scope) })
}

/** 화면이 자기 대화창을 알린다 — 돌려주는 함수로 뺀다(화면을 떠날 때) */
export function registerPageChat(entry: PageChatEntry): () => void {
  set({ entries: [...state.entries.filter((e) => e.key !== entry.key), entry].sort((a, b) => a.key - b.key) })
  return () => {
    set({ entries: state.entries.filter((e) => e.key !== entry.key), ...(state.explicit === entry.key ? { explicit: null } : {}) })
  }
}

export function setPageChatSlot(el: HTMLElement | null): void {
  set({ slot: el })
}

/** SideDock 이 알린다 — 놓는 법 · 지금 그려져 있는지 */
export function setPageChatEnv(mode: PageChatMode, dockShown: boolean): void {
  set({ mode, dockShown })
}

const withStarted = (scope: string) => (state.started.includes(scope) ? state.started : [...state.started, scope])

/** [대화 시작] */
export function startPageChat(scope: string): void {
  set({ started: withStarted(scope) })
}

/**
 * 이 화면 대화창 열기 — PC 는 오른쪽 판 · 휴대폰은 아래 판.
 * start: 눌러서 연 것이면 시작 카드 없이 바로(누른 것이 시작이다).
 */
export function openPageChat(opts: { start?: boolean } = {}): void {
  const cur = currentPageChat()
  if (!cur) return
  if (state.mode === 'none') {
    if (cur.openPhone) cur.openPhone()
    else set({ sheet: true, ...(opts.start ? { started: withStarted(cur.scope) } : {}) })
    return
  }
  setDock({ tab: 'chat' })
  const base = basePageChat() ?? cur
  set({ open: base.scope, flipped: showPage(base), ...(opts.start ? { started: withStarted(cur.scope) } : {}) })
}

/** 붙일 폭이 될 때 저절로 — 닫아 둔 기억은 건드리지 않는다 */
export function autoOpenPageChat(scope: string): void {
  if (state.open === scope) return
  setDock({ tab: 'chat' })
  set({ open: scope, flipped: without(state.flipped, scope) })
}

/** 여는 단추([대화] · [대화로 묻기])를 눌렀다 — 닫아 둔 기억을 풀고 바로 시작 */
export function launchPageChat(): void {
  if (state.closed) {
    writeClosed(false)
    set({ closed: false })
  }
  openPageChat({ start: true })
}

/** 눌러서 연 AI 도우미를 판에(그 화면 대화창 위) — PC 만. 휴대폰은 부른 쪽이 예전 판을 연다 */
export function openAssistInDock(key: number): boolean {
  const e = state.entries.find((x) => x.key === key)
  if (!e || state.mode === 'none') return false
  setDock({ tab: 'chat' })
  const base = basePageChat()
  set({ explicit: key, open: (base ?? e).scope })
  return true
}

/**
 * 눌러서 연 AI 도우미 닫기 — 아래에 그 화면 대화창이 있으면 그리로 돌아간다.
 * 없으면(AI 도우미만 있는 화면) 이 도우미 때문에 열린 판은 내린다 — 머리줄에서 열어 둔 판(자유 대화)은 그대로 남는다.
 */
export function closeAssistInDock(key: number): void {
  if (state.explicit !== key) return
  const base = basePageChat()
  // 이 도우미가 곧 그 화면의 대화창(마케팅 유튜브 · 스레드 · 릴스)이면 닫기 = 판 닫기
  if (base && base.key === key && base.launcher) closePageDock()
  else if (base && pageFirst(base)) set({ explicit: null })
  else set({ explicit: null, open: null })
}

/** 판 닫기(X) — 대화창이 있는 화면에서 닫았으면 기억한다(다음부터 저절로 열지 않음) */
export function closePageDock(): void {
  const cur = basePageChat()
  closeDock()
  if (cur?.launcher && !state.closed) writeClosed(true)
  set({ open: null, explicit: null, sheet: false, closed: cur?.launcher ? true : state.closed })
}

export function closePageSheet(): void {
  set({ sheet: false })
  // D-638 휴대폰 아래 판을 닫으면 크게 보기도 처음으로
  setDock({ full: false })
}

/** 시험 · 로그아웃 — 처음으로 */
export function resetPageChat(): void {
  set({ open: null, explicit: null, sheet: false, flipped: [], started: [], closed: readClosed() })
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
const snapshot = () => state

export function usePageChat(): PageChatState {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

export function pageChatState(): PageChatState {
  return state
}
