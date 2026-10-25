/**
 * 보기 방식 — PC · Mobile · PC+Mobile (D-164, 마스터 규격 v2.9 Device View).
 *
 *   PC          지금 화면 그대로(전체 폭)
 *   Mobile      PC 브라우저 안에 진짜 390px 휴대폰 화면(같은 앱 · 같은 주소 · 같은 로그인 · 같은 자료)
 *   PC+Mobile   왼쪽 PC 화면 · 오른쪽 휴대폰 화면 — 주소가 서로 따라간다
 *
 * 휴대폰 화면은 별도 복제 화면이 아니라 같은 앱을 iframe 으로 다시 띄운 것이다(같은 출처라 로그인 · 저장소 공유).
 * iframe 안에서는 이 단추를 숨기고 다시 iframe 을 만들지 않는다(재귀 금지).
 *
 * D-286 휴대폰 · 태블릿(1024px 아래)에서도 고른다(대표 "폰에서도 PC 버전 · 모바일 · PC+모바일 동시에").
 *   좁은 화면은 고른 값을 따로 둔다(기본 = 모바일 = 지금 휴대폰 화면 그대로). PC 에서 고른 값과 섞이지 않는다.
 *   PC         PC 화면(1200px 배치)을 휴대폰 폭에 맞춰 줄여 보인다 — 두 손가락으로 벌리면 크게
 *   PC+Mobile  세로로 들면 위 PC · 아래 휴대폰, 가로로 들면 왼쪽 PC · 오른쪽 휴대폰
 *   단추는 휴대폰 서랍 메뉴(더보기) 아래와 보기 무대 위쪽 줄.
 */
import { useSyncExternalStore } from 'react'

export type DeviceMode = 'pc' | 'mobile' | 'dual'

const KEY = 'axmvp.ui.device_view'
/** D-286 좁은 화면(휴대폰 · 태블릿)에서 고른 값 — 기본은 'mobile'(지금 화면 그대로) */
const NARROW_KEY = 'axmvp.ui.device_view_narrow'
const MIN_DESKTOP = 1024

/** 이 창이 다른 화면 안(iframe)에 들어 있는가 */
export function inFrame(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/** 처음 열 때 주소의 ?frame= — 'pc' | 'mobile' (iframe 안에서만 뜻이 있다) */
export const FRAME_KIND: string | null = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('frame')

function readMode(): DeviceMode {
  try {
    const v = window.localStorage.getItem(KEY)
    return v === 'mobile' || v === 'dual' ? v : 'pc'
  } catch {
    return 'pc'
  }
}

function readNarrow(): DeviceMode {
  try {
    const v = window.localStorage.getItem(NARROW_KEY)
    return v === 'pc' || v === 'dual' ? v : 'mobile'
  } catch {
    return 'mobile'
  }
}

let mode: DeviceMode = typeof window === 'undefined' ? 'pc' : readMode()
let narrowMode: DeviceMode = typeof window === 'undefined' ? 'mobile' : readNarrow()
let desktop = typeof window === 'undefined' ? true : window.innerWidth >= MIN_DESKTOP
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  const mq = window.matchMedia?.(`(min-width: ${MIN_DESKTOP}px)`)
  mq?.addEventListener?.('change', (e) => {
    desktop = e.matches
    emit()
  })
  // 다른 창 · 로그인 바뀜(저장소 금고)에서 값이 바뀌면 따라간다
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === NARROW_KEY || e.key === null) {
      mode = readMode()
      narrowMode = readNarrow()
      emit()
    }
  })
}

export function setDeviceMode(next: DeviceMode): void {
  // 지금 화면 폭에 맞는 쪽에만 적는다 — PC 에서 고른 값과 휴대폰에서 고른 값은 따로
  if (desktop) mode = next
  else narrowMode = next
  try {
    window.localStorage.setItem(desktop ? KEY : NARROW_KEY, next)
  } catch {
    /* 저장이 안 돼도 이번 화면에서는 바뀐다 */
  }
  emit()
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export interface DeviceState {
  /** 지금 화면 폭 쪽에서 고른 값(PC 는 기본 'pc', 휴대폰 · 태블릿은 기본 'mobile') */
  mode: DeviceMode
  /** 보기 단추를 보일 수 있는가(iframe 밖이면 PC · 휴대폰 모두 — D-286) */
  available: boolean
  /** 지금 보기 무대(휴대폰 틀 · PC 칸 · 나란히)를 앱 대신 띄우는가 */
  staged: boolean
  /** 1024px 아래(휴대폰 · 태블릿) — 무대를 휴대폰에 맞게 그린다 */
  narrow: boolean
}

let cached: DeviceState = { mode, available: false, staged: false, narrow: false }
function snapshot(): DeviceState {
  const available = !inFrame()
  const narrow = !desktop
  const cur = narrow ? narrowMode : mode
  // PC 는 'pc' 가 본 화면, 휴대폰은 'mobile' 이 본 화면 — 그 밖을 고르면 무대
  const staged = available && (narrow ? cur !== 'mobile' : cur !== 'pc')
  if (cached.mode !== cur || cached.available !== available || cached.staged !== staged || cached.narrow !== narrow) cached = { mode: cur, available, staged, narrow }
  return cached
}

export function useDeviceView(): DeviceState {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

/** iframe 주소 — 같은 경로에 frame 표시만 붙인다 */
export function framedSrc(path: string, kind: 'pc' | 'mobile'): string {
  const u = new URL(path, window.location.origin)
  u.searchParams.set('frame', kind)
  return u.pathname + u.search + u.hash
}

/** 주소에서 frame 표시를 뗀다(동기화할 때 쓰는 경로) */
export function stripFrame(pathWithSearch: string): string {
  const u = new URL(pathWithSearch, 'http://x')
  u.searchParams.delete('frame')
  const q = u.searchParams.toString()
  return u.pathname + (q ? `?${q}` : '') + u.hash
}

/** 무대를 띄우지 않는 주소 — 공개 화면(설문 · 시험 · 지원사업 찾기) */
export function isStageExcluded(pathname: string): boolean {
  return /^\/(survey|test)\//.test(pathname) || pathname.startsWith('/grants/find')
}

/* 메시지 이름 — 같은 출처 · 부모 ↔ iframe 만 */
export const MSG_ROUTE = 'axmvp-route'
export const MSG_NAVIGATE = 'axmvp-navigate'
export const MSG_SAVED = 'axmvp-saved'
export const MSG_REFRESH = 'axmvp-refresh'
/** 클라우드 모드에서 자료를 썼을 때(창 안 이벤트) — 보기 무대의 다른 화면이 새로 읽게 */
export const CLOUD_WRITE_EVENT = 'axmvp-cloud-write'
