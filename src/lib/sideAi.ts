/**
 * D-254 AI 옆 창 — 대표: "모니터가 하나라서 OS 를 보면서 ChatGPT 를 옆에 띄워 놓고 싶다(미니 창이라도)".
 *
 * ChatGPT · Claude · Gemini 는 보안 설정(X-Frame-Options · CSP frame-ancestors)으로 다른 사이트 안(iframe)에
 * 들어가지 않는다 — OS 화면 안에 넣는 것은 불가능. 그래서 브라우저 '팝업 창' 으로 화면 오른쪽에 붙여 연다.
 *  - 옆에 열기: 화면 오른쪽 1/3 · 40% · 1/2 자리에 그 서비스 창(이름 붙은 창 하나 — 다시 누르면 같은 창)
 *  - OS 는 겹치는 만큼 본문을 왼쪽으로 비켜 준다(오른쪽 여백) — 창이 닫히면 원래대로
 *  - OS 도 왼쪽 창으로: 이 화면을 왼쪽 나머지 자리에 새 창으로 — 두 창이 반반 딱 맞게(브라우저는 지금 창 크기를 못 바꾼다)
 *  - 팝업이 막히면 알려 준다(주소창 오른쪽 '팝업 차단' → 항상 허용)
 * 로그인 · 대화는 그 서비스 창에서 그대로 — OS 는 내용을 보내거나 읽지 않는다(LLM 호출 0 그대로).
 * 고른 서비스 · 폭은 이 브라우저에 기억.
 */
import { useSyncExternalStore } from 'react'

export type SideService = 'chatgpt' | 'claude' | 'gemini'
export type SideWidth = 'third' | 'twofifths' | 'half'

export const SIDE_SERVICES: Record<SideService, { label: string; url: string }> = {
  chatgpt: { label: 'ChatGPT', url: 'https://chatgpt.com/' },
  claude: { label: 'Claude', url: 'https://claude.ai/new' },
  gemini: { label: 'Gemini', url: 'https://gemini.google.com/app' },
}
export const SIDE_WIDTHS: Record<SideWidth, { label: string; ratio: number }> = {
  third: { label: '좁게(1/3)', ratio: 1 / 3 },
  twofifths: { label: '보통(40%)', ratio: 0.4 },
  half: { label: '반반(1/2)', ratio: 0.5 },
}
export const SIDE_WIN_NAME = 'mirae-side-ai'
export const OS_WIN_NAME = 'mirae-os-left'
const KEY = 'axmvp.ui.side_ai'
/** 옆 창이 이보다 좁으면 대화가 깨져 보인다 */
const MIN_SIDE = 380
/** OS 본문이 이보다 좁아지게는 비키지 않는다 */
const MIN_MAIN = 640

export interface ScreenBox {
  left: number
  top: number
  width: number
  height: number
}
export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/** 화면(작업 영역)에서 옆 창 · 왼쪽 OS 창 자리 — 오른쪽에 딱 붙이고 남는 왼쪽을 OS 에 */
export function sideLayout(screen: ScreenBox, width: SideWidth): { side: Rect; os: Rect } {
  const sw = Math.max(0, Math.round(screen.width))
  const want = Math.round(sw * SIDE_WIDTHS[width].ratio)
  const w = Math.min(Math.max(want, MIN_SIDE), Math.max(MIN_SIDE, sw - MIN_SIDE))
  const side = { left: Math.round(screen.left) + sw - w, top: Math.round(screen.top), width: w, height: Math.round(screen.height) }
  const os = { left: Math.round(screen.left), top: Math.round(screen.top), width: Math.max(0, sw - w), height: Math.round(screen.height) }
  return { side, os }
}

/**
 * 옆 창이 이 브라우저 창을 얼마나 덮는가 → 본문을 그만큼 왼쪽으로 비킨다(오른쪽 여백 px).
 * 창이 안 겹치면(다른 모니터 · 창을 줄여 둠) 0. 본문이 MIN_MAIN 보다 좁아지게는 비키지 않는다.
 */
export function reserveFor(win: { screenX: number; outerWidth: number; innerWidth: number }, side: Rect): number {
  const right = win.screenX + win.outerWidth
  const overlap = right - side.left
  if (!(overlap > 0) || side.left <= win.screenX) return 0
  const border = Math.max(0, win.outerWidth - win.innerWidth)
  const px = Math.round(overlap - border / 2)
  return Math.max(0, Math.min(px, win.innerWidth - MIN_MAIN))
}

/** 팝업 창 모양(window.open 세 번째 값) */
export function featuresOf(r: Rect): string {
  return `popup=yes,left=${r.left},top=${r.top},width=${r.width},height=${r.height}`
}

/* ------------------------------------------------------------------ */
/* 기억 · 상태                                                          */
/* ------------------------------------------------------------------ */

interface Prefs {
  service: SideService
  width: SideWidth
}
export function parsePrefs(raw: string | null): Prefs {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<Prefs>) : {}
    return {
      service: v.service && v.service in SIDE_SERVICES ? v.service : 'chatgpt',
      width: v.width && v.width in SIDE_WIDTHS ? v.width : 'twofifths',
    }
  } catch {
    return { service: 'chatgpt', width: 'twofifths' }
  }
}

interface State extends Prefs {
  /** 옆 창이 열려 있음(이 화면이 연 창) */
  open: boolean
  /** 본문 오른쪽 여백 px */
  reserve: number
  /** 마지막으로 팝업이 막힘 */
  blocked: boolean
}

function readPrefs(): Prefs {
  try {
    return parsePrefs(window.localStorage.getItem(KEY))
  } catch {
    return parsePrefs(null)
  }
}

let state: State = typeof window === 'undefined' ? { ...parsePrefs(null), open: false, reserve: 0, blocked: false } : { ...readPrefs(), open: false, reserve: 0, blocked: false }
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
let sideWin: Window | null = null
let watch: ReturnType<typeof setInterval> | null = null

function savePrefs() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ service: state.service, width: state.width }))
  } catch {
    /* 저장이 안 돼도 이번에는 그대로 */
  }
}

export function setSidePrefs(p: Partial<Prefs>): void {
  set(p)
  savePrefs()
  // 열려 있으면 바로 그 서비스 · 폭으로
  if (state.open) openSideAi()
}

function screenBox(): ScreenBox {
  const s = window.screen as Screen & { availLeft?: number; availTop?: number }
  return { left: s.availLeft ?? 0, top: s.availTop ?? 0, width: s.availWidth || window.outerWidth, height: s.availHeight || window.outerHeight }
}

function startWatch() {
  if (watch) return
  // 옆 창을 사용자가 닫으면 비켜 준 여백을 되돌린다
  watch = setInterval(() => {
    if (!sideWin || sideWin.closed) {
      sideWin = null
      if (watch) clearInterval(watch)
      watch = null
      set({ open: false, reserve: 0 })
    }
  }, 1200)
}

/** 옆에 열기 — 이미 열린 창이면 같은 창을 그 자리 · 서비스로. 막히면 blocked */
export function openSideAi(): boolean {
  const { side } = sideLayout(screenBox(), state.width)
  const w = window.open(SIDE_SERVICES[state.service].url, SIDE_WIN_NAME, featuresOf(side))
  if (!w) {
    set({ blocked: true })
    return false
  }
  sideWin = w
  try {
    w.moveTo(side.left, side.top)
    w.resizeTo(side.width, side.height)
  } catch {
    /* 다른 사이트 창 — 옮기기가 막혀도 연 자리 그대로 */
  }
  try {
    w.focus()
  } catch {
    /* 무시 */
  }
  set({ open: true, blocked: false, reserve: reserveFor(window, side) })
  startWatch()
  return true
}

/** 옆 창을 앞으로(다른 창 뒤에 숨었을 때) */
export function focusSideAi(): boolean {
  if (!sideWin || sideWin.closed) return openSideAi()
  try {
    sideWin.focus()
    return true
  } catch {
    return openSideAi()
  }
}

export function closeSideAi(): void {
  try {
    sideWin?.close()
  } catch {
    /* 무시 */
  }
  sideWin = null
  if (watch) clearInterval(watch)
  watch = null
  set({ open: false, reserve: 0 })
}

/** 이 화면을 왼쪽 나머지 자리에 새 창으로 — 옆 창과 반반 딱 맞게. 막히면 false */
export function openOsLeft(href: string): boolean {
  const { os } = sideLayout(screenBox(), state.width)
  const w = window.open(href, OS_WIN_NAME, featuresOf(os))
  if (!w) {
    set({ blocked: true })
    return false
  }
  set({ blocked: false })
  return true
}

/** 창 크기가 바뀌면 비켜 줄 여백도 다시 */
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    if (!state.open) return
    const { side } = sideLayout(screenBox(), state.width)
    set({ reserve: reserveFor(window, side) })
  })
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
export function useSideAi(): State {
  return useSyncExternalStore(subscribe, () => state, () => state)
}
