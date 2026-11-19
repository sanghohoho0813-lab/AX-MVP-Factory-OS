/**
 * D-258 OS 안 오른쪽 판 — 대표: "새 창 말고 안에서 띄우는 건 안 돼? GPT 뿐만 아니라 제미나이든 구글이든".
 *
 * 실측(2026-10-21 · 응답 머리 X-Frame-Options / frame-ancestors): ChatGPT(SAMEORIGIN) · Gemini(DENY) · Claude(SAMEORIGIN) ·
 * 네이버(DENY) · Bing(SAMEORIGIN) · Perplexity(DENY) · K-Startup(자기 사이트만) 은 다른 사이트 안에 못 들어간다 — 사이트가 막는다.
 * 그래서 안에서 되는 것만 안에서:
 *   AI 대화   — Gemini 를 우리 서버(/api/ai-assist · side.chat)로 불러 판 안에서 대화(대표는 고른 모델 · 팀장은 Gemini 만)
 *   웹        — Google 은 igu=1 주소로 안에 들어간다(막지 않음) · 기업마당 · 홈택스도 막지 않는다. 막는 곳은 [옆 창으로] 로 연다.
 * 판 폭은 끌어서(320~720) · 이 브라우저에 기억. PC(1024px~)에서만.
 * D-638 대표(2026-11-19) "절반 정도까지 되면 더 안 늘어난다 — 100% 로 다 대화창으로 · 본인이 원하는 비율로 자유롭게":
 *   끌면 메뉴 오른쪽 끝까지(본문이 768px 아래로 줄지 않는 데서 멈추고 · 그 뒤로는 판이 본문 위로 넓어진다) ·
 *   머리 [크게] 단추 = 메뉴 오른쪽 전부를 대화창으로(full) · 다시 누르면 원래 폭. 휴대폰 아래 판도 [크게] 면 화면 전체.
 */
import { useSyncExternalStore } from 'react'
import { MAIN_MIN } from './navWidth'

export type DockTab = 'chat' | 'web'
export interface DockState {
  open: boolean
  tab: DockTab
  width: number
  /** 웹 탭에 지금 띄운 주소(판 안 iframe) */
  webUrl: string
  /** D-638 크게 보기 — PC 는 메뉴 오른쪽 전부 · 휴대폰 아래 판은 화면 전체 */
  full: boolean
}

const KEY = 'axmvp.ui.side_dock'
export const DOCK_MIN = 320
/** D-638 끌어서 넓힐 수 있는 끝(실제로는 화면 폭 · 메뉴가 먼저 막는다) */
export const DOCK_MAX = 2400
/** 본문을 비켜 세우며 붙일 때 바라는 폭이 남는 자리보다 이만큼까지 크면 남는 자리에 맞춘다(처음 폭 420 이 1366 노트북의 342 자리에서 본문을 덮지 않게) */
const FIT_SLACK = 96
const DOCK_DEFAULT = 420
export const GOOGLE_FRAME_HOME = 'https://www.google.com/webhp?igu=1'

/** 안에 못 들어가는 곳(사이트가 막음 — 실측). 주소 끝 일치 */
export const FRAME_BLOCKED_HOSTS = ['chatgpt.com', 'openai.com', 'claude.ai', 'gemini.google.com', 'naver.com', 'bing.com', 'perplexity.ai', 'copilot.microsoft.com', 'k-startup.go.kr', 'duckduckgo.com', 'youtube.com', 'kakao.com', 'daum.net']

const clampWidth = (w: number) => Math.round(Math.min(DOCK_MAX, Math.max(DOCK_MIN, w)))

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/** 이 주소를 판 안에 띄울 수 있는가 — 알려진 막는 곳이면 false(그 밖은 해 보고 안 보이면 [옆 창으로]) */
export function canFrame(url: string): boolean {
  const h = hostOf(url)
  if (!h) return false
  if (!/^https?:$/.test(new URL(url).protocol)) return false
  if ((h === 'www.google.com' || h === 'google.com') && !/[?&]igu=1(&|$)/.test(url)) return false
  return !FRAME_BLOCKED_HOSTS.some((b) => h === b || h.endsWith(`.${b}`))
}

/**
 * 판 안에 띄울 주소로 — Google 이면 igu=1 을 붙여 안에 들어가게(검색 · 첫 화면 모두). 그 밖은 그대로.
 * http(s) 가 아니면 null(부른 쪽이 막는다).
 */
export function frameUrlOf(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  const h = u.hostname.toLowerCase()
  if (h === 'google.com' || h === 'www.google.com') {
    u.hostname = 'www.google.com'
    u.protocol = 'https:'
    if (u.pathname === '/' || u.pathname === '') u.pathname = '/webhp'
    u.searchParams.set('igu', '1')
  }
  return u.href
}

/**
 * 판을 어떻게 놓을까 — 화면 폭 · 지금 메뉴 폭 · 바라는 폭으로.
 *   dock  본문 옆에 붙인다(본문이 판만큼 비킨다) — 본문이 768px(머리줄이 넘치지 않는 폭 · 실측) 이상 남을 때만
 *         D-638 바라는 폭이 남는 자리보다 크게 끌었으면 판은 그 폭으로 넓어지고 본문은 768px 에서 멈춘다(reserve = 본문이 비키는 만큼)
 *   over  본문 위에 덮어 띄운다(1024~ 좁은 PC · 메뉴를 넓혀 둔 때 · 크게 보기) — 본문은 그대로
 *   none  휴대폰 · 태블릿(1024 아래) — 그리지 않는다
 * full(D-638 크게 보기) — 메뉴 오른쪽 전부를 판으로(over).
 */
export function dockLayout(viewport: number, nav: number, want: number, full = false): { mode: 'dock' | 'over' | 'none'; width: number; reserve: number; full: boolean } {
  const v = Math.round(viewport)
  if (!Number.isFinite(v) || v < 1024) return { mode: 'none', width: 0, reserve: 0, full: false }
  const avail = Math.max(DOCK_MIN, v - Math.max(0, nav))
  if (full) return { mode: 'over', width: avail, reserve: 0, full: true }
  const room = v - Math.max(0, nav) - MAIN_MIN
  if (room >= DOCK_MIN) {
    // 남는 자리 안(조금 넘쳐도) — 예전처럼 남는 자리에 맞춰 붙인다
    if (want <= room + FIT_SLACK) {
      const w = Math.round(Math.max(DOCK_MIN, Math.min(want, room)))
      return { mode: 'dock', width: w, reserve: w, full: false }
    }
    // 더 넓게 끌었다 — 본문은 768px 에서 멈추고 판이 본문 위로 넓어진다(메뉴 오른쪽 끝까지)
    const w = Math.round(Math.min(want, avail))
    return { mode: 'dock', width: w, reserve: Math.round(room), full: false }
  }
  const w = Math.round(Math.max(DOCK_MIN, Math.min(want, v - 48)))
  return { mode: 'over', width: w, reserve: 0, full: false }
}

/* ------------------------------------------------------------------ */
/* AI 대화 기록 — 이 브라우저(사람별 금고가 로그인마다 바꿔 끼운다)          */
/* ------------------------------------------------------------------ */

export interface DockTurn {
  id: string
  at: string
  q: string
  status: 'pending' | 'done' | 'error'
  headline?: string
  items?: { title: string; detail?: string; body?: string }[]
  next?: string[]
  caution?: string
  model?: string
  error?: string
}

export const DOCK_CHAT_KEY = 'axmvp.ui.side_dock.chat'
export const DOCK_CHAT_MAX = 30

/** 저장된 대화 읽기 — 모양이 틀린 줄은 버리고, 기다리던 중 닫힌 것은 '답을 받지 못함' 으로 */
export function parseDockChat(raw: string | null): DockTurn[] {
  try {
    const v = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(v)) return []
    const str = (x: unknown, max: number) => (typeof x === 'string' ? x.slice(0, max) : undefined)
    const out: DockTurn[] = []
    for (const t of v as Record<string, unknown>[]) {
      if (!t || typeof t !== 'object' || typeof t.id !== 'string' || typeof t.q !== 'string') continue
      const status = t.status === 'done' ? 'done' : 'error'
      const items = Array.isArray(t.items)
        ? (t.items as Record<string, unknown>[]).filter((i) => i && typeof i.title === 'string').slice(0, 12).map((i) => ({ title: String(i.title).slice(0, 300), detail: str(i.detail, 2000), body: str(i.body, 12000) }))
        : undefined
      out.push({
        id: t.id,
        at: typeof t.at === 'string' ? t.at : '',
        q: t.q.slice(0, 4000),
        status,
        headline: str(t.headline, 2000),
        items,
        next: Array.isArray(t.next) ? (t.next as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 6) : undefined,
        caution: str(t.caution, 1000),
        model: str(t.model, 120),
        error: status === 'error' ? (str(t.error, 300) ?? '답을 받지 못했어요 — 다시 물어봐 주세요') : undefined,
      })
    }
    return out.slice(-DOCK_CHAT_MAX)
  } catch {
    return []
  }
}

/** 이어지는 질문으로 읽게 — 앞선 대화 몇 줄(질문 · 답 첫 줄)만 보낸다 */
export function dockChatContext(turns: readonly DockTurn[], today: string, screen: string): { title: string; today: string; purpose: string; sections: { name: string; rows: { q: string; a: string }[] }[]; facts: string[] } {
  const done = turns.filter((t) => t.status === 'done').slice(-4)
  return {
    title: 'AI 대화',
    today,
    purpose: 'OS 안 오른쪽 판에서 묻는 업무 대화',
    sections: done.length ? [{ name: '앞선 대화', rows: done.map((t) => ({ q: t.q.slice(0, 300), a: (t.headline ?? '').slice(0, 300) })) }] : [],
    facts: screen ? [`지금 보고 있는 화면: ${screen}`] : [],
  }
}

export function parseDock(raw: string | null): DockState {
  const base: DockState = { open: false, tab: 'chat', width: DOCK_DEFAULT, webUrl: GOOGLE_FRAME_HOME, full: false }
  try {
    const v = raw ? (JSON.parse(raw) as Partial<DockState>) : {}
    return {
      open: v.open === true,
      tab: v.tab === 'web' ? 'web' : 'chat',
      width: typeof v.width === 'number' && Number.isFinite(v.width) ? clampWidth(v.width) : DOCK_DEFAULT,
      webUrl: typeof v.webUrl === 'string' && frameUrlOf(v.webUrl) && canFrame(frameUrlOf(v.webUrl) as string) ? (frameUrlOf(v.webUrl) as string) : GOOGLE_FRAME_HOME,
      full: v.full === true,
    }
  } catch {
    return base
  }
}

function read(): DockState {
  try {
    return parseDock(window.localStorage.getItem(KEY))
  } catch {
    return parseDock(null)
  }
}

let state: DockState = typeof window === 'undefined' ? parseDock(null) : read()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) {
      state = read()
      emit()
    }
  })
}

/** save=false — 끄는 동안(손을 놓을 때 한 번만 저장) */
export function setDock(patch: Partial<DockState>, save = true): void {
  const next = { ...state, ...patch }
  if (patch.width !== undefined) next.width = clampWidth(patch.width)
  state = next
  if (save) {
    try {
      // D-638 크게 보기는 기억하지 않는다 — 다음에 저절로 열리는 판이 본문을 통째로 덮지 않게(이번 화면에서만)
      window.localStorage.setItem(KEY, JSON.stringify({ ...state, full: false }))
    } catch {
      /* 저장이 안 돼도 이번 화면에서는 바뀐다 */
    }
  }
  emit()
}

export function openDock(tab: DockTab, webUrl?: string): void {
  const url = webUrl ? frameUrlOf(webUrl) : null
  setDock({ open: true, tab, ...(url ? { webUrl: url } : {}) })
}

export function closeDock(): void {
  // D-638 닫으면 크게 보기도 처음으로 — 다음에 열 때 본문을 통째로 덮지 않게
  setDock({ open: false, full: false })
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
const snapshot = () => state

export function useDock(): DockState {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
