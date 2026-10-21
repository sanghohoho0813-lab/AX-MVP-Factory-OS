/**
 * D-256 왼쪽 메뉴 폭 — 대표: "경계선에 마우스 갖다 대고 왼쪽 · 오른쪽으로 하면 목차 칸이 줄었다 커졌다 · 아예 사라졌다".
 *
 *   넓게(full)   200~440px — 경계선을 끌어 정한 폭(안 끌었으면 예전 그대로 256 · 큰 화면 288)
 *   아이콘(icons) 80px    — 예전 [사이드바 접기] 와 같은 모양
 *   숨김(hidden)  0px     — 왼쪽 끝 작은 탭(▶)이나 경계선을 다시 끌면 돌아온다
 * 끌다가 손을 놓은 자리로 정한다: 40px 안 → 숨김 · 150px 안 → 아이콘 · 그 밖 → 그 폭(200~440 안으로).
 * 본문은 늘 768px 이상 남긴다 — 노트북(1024px)에서는 예전 폭(256)보다 넓어지지 않는다(큰 모니터에서 넓혀 둔 폭도 줄여 보임). 좁히기 · 숨기기는 그대로.
 * 키보드: 경계선에 초점 → ←/→ 24px 씩(200 아래로 더 가면 아이콘 → 숨김), Home 숨김 · End 가장 넓게.
 * 저장은 이 브라우저(로그인한 사람별 금고 — 다른 화면 설정과 같은 칸). 다른 창에서 바꾸면 따라간다. PC(1024px~)에서만.
 */
import { useSyncExternalStore } from 'react'

export type NavMode = 'full' | 'icons' | 'hidden'
export interface NavSize {
  mode: NavMode
  /** 넓게일 때 폭. null = 끈 적 없음(예전 폭 그대로) — 아이콘 · 숨김에서 돌아올 때도 이 폭으로 */
  width: number | null
}

const KEY = 'axmvp.ui.nav.size'
export const NAV_ICONS = 80
export const NAV_MIN = 200
export const NAV_MAX = 440
/** 끌기 문턱 — 이보다 왼쪽에서 놓으면 숨김 · 아이콘 */
export const HIDE_BELOW = 40
export const ICONS_BELOW = 150
const STEP = 24
const DEFAULT: NavSize = { mode: 'full', width: null }

/** 본문(머리줄 포함)이 이보다 좁아지게는 메뉴를 넓히지 않는다 — 1024px 화면은 예전 폭(256)까지만(실측: 본문 705px 에서 머리줄이 24px 넘쳤다) */
export const MAIN_MIN = 768
const clampWidth = (w: number, max = NAV_MAX) => Math.round(Math.min(Math.max(NAV_MIN, max), Math.max(NAV_MIN, w)))

/** 이 화면 폭에서 메뉴가 넓어질 수 있는 끝 */
export function navMaxFor(viewport: number): number {
  return Math.max(NAV_MIN, Math.min(NAV_MAX, Math.round(viewport) - MAIN_MIN))
}

export function parseNavSize(raw: string | null): NavSize {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<NavSize>) : {}
    const mode: NavMode = v.mode === 'icons' || v.mode === 'hidden' ? v.mode : 'full'
    const width = typeof v.width === 'number' && Number.isFinite(v.width) ? clampWidth(v.width) : null
    return { mode, width }
  } catch {
    return DEFAULT
  }
}

/** 끄는 중 손 자리(화면 왼쪽에서 px) → 메뉴 크기. 넓게의 폭은 끈 자리 그대로(200~max 안) */
export function sizeAtDrag(x: number, cur: NavSize, max = NAV_MAX): NavSize {
  if (!(x >= HIDE_BELOW)) return { mode: 'hidden', width: cur.width }
  if (x < ICONS_BELOW) return { mode: 'icons', width: cur.width }
  return { mode: 'full', width: clampWidth(x, max) }
}

/** 키보드 한 칸 — dir -1 = 왼쪽(좁게) · +1 = 오른쪽(넓게). shown = 지금 화면에 보이는 폭(px) */
export function stepNav(cur: NavSize, dir: -1 | 1, shown: number, max = NAV_MAX): NavSize {
  if (dir < 0) {
    if (cur.mode === 'hidden') return cur
    if (cur.mode === 'icons') return { mode: 'hidden', width: cur.width }
    if (shown <= NAV_MIN) return { mode: 'icons', width: cur.width }
    return { mode: 'full', width: clampWidth(shown - STEP, max) }
  }
  if (cur.mode === 'hidden') return { mode: 'icons', width: cur.width }
  if (cur.mode === 'icons') return { mode: 'full', width: cur.width }
  return { mode: 'full', width: clampWidth(shown + STEP, max) }
}

/** 지금 그릴 폭(px). 넓게인데 끈 적 없으면 null(예전 클래스 폭) */
export function navPx(s: NavSize): number | null {
  if (s.mode === 'hidden') return 0
  if (s.mode === 'icons') return NAV_ICONS
  return s.width
}

function read(): NavSize {
  try {
    return parseNavSize(window.localStorage.getItem(KEY))
  } catch {
    return DEFAULT
  }
}

let size: NavSize = typeof window === 'undefined' ? DEFAULT : read()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  // 다른 창 · 로그인 바뀜(저장소 금고)에서 값이 바뀌면 따라간다
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) {
      size = read()
      emit()
    }
  })
}

/** save=false — 끄는 동안(손을 놓을 때 한 번만 저장) */
export function setNavSize(next: NavSize, save = true): void {
  if (next.mode === size.mode && next.width === size.width && !save) return
  size = next
  if (save) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* 저장이 안 돼도 이번 화면에서는 바뀐다 */
    }
  }
  emit()
}

/** [사이드바 접기 · 펼치기] — 넓게 ↔ 아이콘(숨김이면 넓게로) */
export function toggleNavIcons(): void {
  setNavSize({ mode: size.mode === 'full' ? 'icons' : 'full', width: size.width })
}

/** 숨김에서 다시 보이기 */
export function showNav(): void {
  setNavSize({ mode: 'full', width: size.width })
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
const snapshot = () => size

export function useNavSize(): NavSize {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
