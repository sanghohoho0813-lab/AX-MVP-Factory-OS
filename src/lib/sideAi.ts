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
 * D-261 대표: "AI 들 띄우면 잠깐 비켰다가 원상태로 돌아가 절반 이상이 가려진다 · 네이버는 잘 된다 · 현재 시각 나오는 데까지 침범하지 않게".
 *   - ChatGPT · Claude 는 Cross-Origin-Opener-Policy: same-origin, Gemini · Google 은 same-origin-allow-popups 를 보낸다(실측) —
 *     브라우저가 OS 와 옆 창 사이 연결을 끊어 OS 쪽에서는 창이 열려 있어도 '닫힘' 으로 보였고, 그래서 비켜 준 자리를 되돌렸다.
 *     이제 연 지 얼마 안 돼 '닫힘' 이 되면 끊긴 것(cut)으로 보고 자리를 그대로 둔다. 그 뒤로는 창이 닫혀도 알 수 없어 판에 [원래대로].
 *   - 옆 창 자리는 화면 끝이 아니라 이 OS 창 안 오른쪽, 머리줄 아래부터(sideRectIn) — 머리줄(시각 · 찾기)은 그대로 보이고 본문만 비킨다.
 * D-256 대표: "주소창도 적을 수 있게 · 구글 기본" — 팝업 창의 주소창은 브라우저가 고칠 수 없게 막아 두므로, 판의 주소 칸에
 *   주소(google.com · naver.com …)나 검색어를 적으면 같은 옆 창이 그리로 간다(주소가 아니면 구글 검색 · http/https 만).
 */
import { useSyncExternalStore } from 'react'

export type SideService = 'chatgpt' | 'claude' | 'gemini' | 'google'
export type SideWidth = 'third' | 'twofifths' | 'half'

export const SIDE_SERVICES: Record<SideService, { label: string; url: string }> = {
  chatgpt: { label: 'ChatGPT', url: 'https://chatgpt.com/' },
  claude: { label: 'Claude', url: 'https://claude.ai/new' },
  gemini: { label: 'Gemini', url: 'https://gemini.google.com/app' },
  google: { label: 'Google', url: 'https://www.google.com/' },
}
export const GOOGLE_HOME = 'https://www.google.com/'
/** 주소 칸 아래 바로 가기 — 컨설팅하며 자주 여는 곳 */
export const SIDE_SITES: { id: string; label: string; url: string }[] = [
  { id: 'naver', label: '네이버', url: 'https://www.naver.com/' },
  { id: 'bizinfo', label: '기업마당', url: 'https://www.bizinfo.go.kr/' },
  { id: 'kstartup', label: 'K-Startup', url: 'https://www.k-startup.go.kr/' },
  { id: 'hometax', label: '홈택스', url: 'https://www.hometax.go.kr/' },
]

/**
 * 주소 칸 글 → 열 주소. 비면 null(부른 쪽이 구글로).
 *   http(s):// 로 시작 → 그대로(http · https 만 · 깨진 주소면 검색) / 'naver.com/…' 처럼 점 있는 한 덩어리 → https:// 를 붙여 /
 *   그 밖(띄어쓰기 · 한글 · javascript: 같은 것) → 구글 검색. 다른 방식(javascript · data · file …)은 절대 열지 않는다.
 */
export function addressToUrl(input: string): string | null {
  const t = (input ?? '').trim()
  if (!t) return null
  const search = `https://www.google.com/search?q=${encodeURIComponent(t)}`
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t)
      return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : search
    } catch {
      return search
    }
  }
  if (/^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(:\d{2,5})?([/?#]\S*)?$/i.test(t)) {
    try {
      return new URL(`https://${t}`).href
    } catch {
      return search
    }
  }
  return search
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
export function reserveFor(win: { screenX: number; outerWidth: number; innerWidth: number; outerHeight?: number; innerHeight?: number }, side: Rect): number {
  const right = win.screenX + win.outerWidth
  const overlap = right - side.left
  if (!(overlap > 0) || side.left <= win.screenX) return 0
  // 화면 px(옆 창) → 이 페이지 px(본문 여백) — 브라우저를 확대해 두었으면 그만큼 나눈다
  const z = zoomOf(win)
  const px = Math.round((overlap - borderOf(win, z) / 2) / z)
  return Math.max(0, Math.min(px, Math.round(win.innerWidth - MIN_MAIN)))
}

/**
 * D-261 브라우저 확대 배율 — 바깥 폭(화면 px) ÷ 안쪽 폭(이 페이지 px). 몇 px 차이는 창 테두리(확대 아님).
 * 확대면 높이도 같은 비율로 줄어 위 머리(탭 · 주소창)가 0~200px 로 남는다 — 크롬 옆 패널 등으로 안쪽만 좁아진 것은 확대로 보지 않는다.
 */
export function zoomOf(win: { outerWidth: number; innerWidth: number; outerHeight?: number; innerHeight?: number }): number {
  const { outerWidth: ow, innerWidth: iw } = win
  if (!(ow > 0) || !(iw > 0) || Math.abs(ow - iw) <= 20) return 1
  const z = ow / iw
  if (!(z >= 0.25 && z <= 5)) return 1
  if (win.outerHeight && win.innerHeight) {
    const chrome = win.outerHeight - win.innerHeight * z
    if (chrome < 0 || chrome > 200) return 1
  }
  return z
}

/** 창 테두리(좌우 합) — 확대를 빼고 남은 차이가 20px 안일 때만(그 이상은 테두리가 아님) */
function borderOf(win: { outerWidth: number; innerWidth: number }, z: number): number {
  const diff = win.outerWidth - win.innerWidth * z
  return diff > 0 && diff <= 20 ? diff : 0
}

export interface WinBox {
  screenX: number
  screenY: number
  outerWidth: number
  outerHeight: number
  innerWidth: number
  innerHeight: number
}

/**
 * D-261 옆 창 자리 — 이 OS 창 안 오른쪽, 머리줄 아래(topInset · 이 페이지 px)부터 창 아래 끝까지. 화면(작업 영역) 밖으로는 나가지 않게.
 * 창 테두리는 좌우 차이의 반으로 본다(최대화면 0). 브라우저를 확대해 두었으면 페이지 px 를 화면 px 로 바꿔 잰다.
 */
export function sideRectIn(win: WinBox, screen: ScreenBox, width: SideWidth, topInset: number): Rect {
  const z = zoomOf(win)
  const edge = Math.round(borderOf(win, z) / 2)
  const innerRight = Math.round(win.screenX + win.outerWidth - edge)
  const innerW = Math.max(0, Math.round(win.outerWidth - edge * 2))
  const want = Math.round(innerW * SIDE_WIDTHS[width].ratio)
  const w = Math.min(Math.max(want, MIN_SIDE), Math.max(MIN_SIDE, innerW - MIN_SIDE))
  const sTop = Math.round(screen.top)
  const sBottom = Math.round(screen.top + screen.height)
  const sRight = Math.round(screen.left + screen.width)
  const contentTop = Math.round(win.screenY + Math.max(0, win.outerHeight - win.innerHeight * z - edge))
  const top = Math.max(sTop, Math.min(contentTop + Math.max(0, Math.round(topInset * z)), sBottom - 200))
  const bottom = Math.min(Math.round(win.screenY + win.outerHeight - edge), sBottom)
  const left = Math.max(Math.round(screen.left), Math.min(innerRight - w, sRight - w))
  return { left, top, width: w, height: Math.max(200, bottom - top) }
}

/** D-261 창을 열면 OS 와 연결을 끊는 곳(COOP) — 열려 있어도 OS 쪽에서는 '닫힘' 으로 보인다 */
const CUT_HOSTS = /(^|\.)(chatgpt\.com|openai\.com|claude\.ai|google\.com)$/i
export function cutsOpener(url: string): boolean {
  try {
    return CUT_HOSTS.test(new URL(url).hostname)
  } catch {
    return false
  }
}
/** '닫힘' 으로 보인 때가 연 지 이만큼 안이면 끊긴 것(진짜 닫은 것이 아님) — 끊는 곳은 늦게 열려도 20초, 그 밖은 3초(끊김은 첫 응답에서 일어난다) */
export function looksCut(url: string, openedAt: number, now: number): boolean {
  return now - openedAt < (cutsOpener(url) ? 20_000 : 3_000)
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
  /** 옆 창에 띄운 것(서비스 이름 · 'naver.com' · 'Google 검색') — 단추에 '… 옆 창 열림' */
  at: string
  /** D-261 옆 창이 OS 와 연결을 끊음(ChatGPT 등) — 열려 있는지 알 수 없어 [원래대로] 를 눌러야 자리를 되돌린다 */
  cut: boolean
}

function readPrefs(): Prefs {
  try {
    return parsePrefs(window.localStorage.getItem(KEY))
  } catch {
    return parsePrefs(null)
  }
}

let state: State = { ...(typeof window === 'undefined' ? parsePrefs(null) : readPrefs()), open: false, reserve: 0, blocked: false, at: '', cut: false }
const listeners = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
let sideWin: Window | null = null
/** 옆 창에 마지막으로 연 주소 — 폭만 바꿀 때는 보던 곳 그대로 */
let lastUrl = ''
let watch: ReturnType<typeof setInterval> | null = null
let openedAt = 0

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
  // 열려 있으면 바로 그 서비스로 · 폭만 바꾸면 보던 곳 그대로
  // 연결이 끊긴 창(cut)은 OS 가 다시 잡을 수 없다 — 새 창이 하나 더 생기므로 고른 것만 기억(다음에 열 때)
  if (!state.open || state.cut) return
  if (p.service || !lastUrl) openSideAi()
  else openInSide(lastUrl, state.at)
}

function screenBox(): ScreenBox {
  const s = window.screen as Screen & { availLeft?: number; availTop?: number }
  return { left: s.availLeft ?? 0, top: s.availTop ?? 0, width: s.availWidth || window.outerWidth, height: s.availHeight || window.outerHeight }
}

/** 머리줄 아래 끝(화면 안 px) — 옆 창은 여기부터 */
function headerBottom(): number {
  try {
    const h = document.querySelector('header')
    return h ? Math.max(0, Math.min(160, Math.round(h.getBoundingClientRect().bottom))) : 0
  } catch {
    return 0
  }
}

function sideRect(): Rect {
  return sideRectIn(window, screenBox(), state.width, headerBottom())
}

function startWatch() {
  if (watch) return
  // 옆 창을 사용자가 닫으면 비켜 준 여백을 되돌린다 — 단, 연 지 얼마 안 돼 '닫힘' 이면 그 사이트가 연결을 끊은 것(자리는 그대로)
  watch = setInterval(() => {
    if (sideWin && !sideWin.closed) return
    const cut = !!sideWin && looksCut(lastUrl, openedAt, Date.now())
    sideWin = null
    if (watch) clearInterval(watch)
    watch = null
    if (cut) set({ cut: true })
    else set({ open: false, reserve: 0, cut: false })
  }, 1200)
}

/** 옆에 열기 — 이미 열린 창이면 같은 창을 그 자리 · 서비스로. 막히면 blocked */
export function openSideAi(): boolean {
  return openInSide(SIDE_SERVICES[state.service].url, SIDE_SERVICES[state.service].label)
}

/** D-256 주소 칸 — 주소나 검색어로 같은 옆 창을 연다(비면 구글). label = 단추에 보일 이름(없으면 주소에서) */
export function openSideAddress(input: string, label?: string): boolean {
  const url = addressToUrl(input) ?? GOOGLE_HOME
  return openInSide(url, label || addressLabel(url))
}

/** 단추에 보일 이름 — 'naver.com' · 'Google 검색' · 'Google' */
export function addressLabel(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname === 'www.google.com') return u.pathname === '/search' ? 'Google 검색' : 'Google'
    return u.hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** D-258 판에서도 — 막는 사이트를 같은 옆 창으로 */
export function openInSide(url: string, label: string): boolean {
  const side = sideRect()
  const w = window.open(url, SIDE_WIN_NAME, featuresOf(side))
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
  lastUrl = url
  openedAt = Date.now()
  set({ open: true, blocked: false, reserve: reserveFor(window, side), at: label, cut: false })
  startWatch()
  return true
}

/** 옆 창을 앞으로(다른 창 뒤에 숨었을 때) — 연결이 끊긴 창(cut)은 OS 가 부를 수 없다(새 창이 하나 더 생기므로 하지 않음) */
export function focusSideAi(): boolean {
  if (state.cut) return false
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
  set({ open: false, reserve: 0, cut: false })
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
    set({ reserve: reserveFor(window, sideRect()) })
  })
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
export function useSideAi(): State {
  return useSyncExternalStore(subscribe, () => state, () => state)
}
