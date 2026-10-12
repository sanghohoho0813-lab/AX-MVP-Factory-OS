/**
 * 안내 영상을 언제 저절로 띄울까 (D-185).
 *
 * - 팀장님(Pilot) 계정으로 들어오면 앱이 열릴 때 먼저 영상을 띄운다.
 * - [오늘 하루 안 보기] — 오늘(한국 날짜)만 띄우지 않는다.
 * - [앞으로 보지 않기] — 이 사람에게는 다시 띄우지 않는다(로그인 계정 정보에도 남겨 다른 기기에서도).
 * - 한 번 띄운 뒤에는 같은 창(탭)에서 다시 띄우지 않는다 — 화면을 옮길 때마다 뜨면 일을 못 한다.
 * - 머리줄 [안내 영상] 으로는 언제든 다시 본다.
 *
 * 브라우저 키는 'axmvp.' 로 시작해 사람별 금고(D-162)로 나뉜다 — 대표가 끈 것이 팀장님 쪽에 번지지 않는다.
 * 이 파일은 계산 · 브라우저 저장만 한다.
 */

export const TUTORIAL_PREFS_KEY = 'axmvp.tutorial.v1'
export const TUTORIAL_SHOWN_KEY = 'axmvp.tutorial.autoshown'

export interface TutorialPrefs {
  /** 이 날(YYYY-MM-DD)에는 띄우지 않는다 */
  hiddenOn?: string
  /** 앞으로 띄우지 않는다 */
  never?: boolean
}

function storeOf(s: Storage | null | undefined, kind: 'local' | 'session'): Storage | null {
  if (s) return s
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function readTutorialPrefs(s?: Storage | null): TutorialPrefs {
  const st = storeOf(s, 'local')
  if (!st) return {}
  try {
    const raw = JSON.parse(st.getItem(TUTORIAL_PREFS_KEY) ?? '{}') as Record<string, unknown> | null
    if (!raw || typeof raw !== 'object') return {}
    const out: TutorialPrefs = {}
    if (typeof raw.hiddenOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.hiddenOn)) out.hiddenOn = raw.hiddenOn
    if (raw.never === true) out.never = true
    return out
  } catch {
    return {}
  }
}

function write(p: TutorialPrefs, s?: Storage | null): void {
  const st = storeOf(s, 'local')
  if (!st) return
  try {
    st.setItem(TUTORIAL_PREFS_KEY, JSON.stringify(p))
  } catch {
    /* 저장이 막혀도 이번 창에서는 닫힌다 */
  }
}

export function hideTutorialToday(today: string, s?: Storage | null): TutorialPrefs {
  const next = { ...readTutorialPrefs(s), hiddenOn: today }
  write(next, s)
  return next
}

export function hideTutorialForever(s?: Storage | null): TutorialPrefs {
  const next = { ...readTutorialPrefs(s), never: true }
  write(next, s)
  return next
}

/** 다시 저절로 뜨게(설정 · 시험용) */
export function resetTutorialPrefs(s?: Storage | null): void {
  write({}, s)
}

export interface AutoOpenInput {
  /** 내부 OS 접근 등급 — 'pilot' 만 저절로 띄운다 */
  access: string | null | undefined
  prefs: TutorialPrefs
  today: string
  /** 로그인 계정 정보에 '앞으로 보지 않기' 가 남아 있다(다른 기기에서 끈 것) */
  hiddenInAccount: boolean
  /** 이 창에서 이미 한 번 띄웠다 */
  shownThisSession: boolean
}

export function shouldAutoOpenTutorial(i: AutoOpenInput): boolean {
  if (i.access !== 'pilot') return false
  if (i.hiddenInAccount || i.prefs.never) return false
  if (i.prefs.hiddenOn === i.today) return false
  return !i.shownThisSession
}

export function wasShownThisSession(s?: Storage | null): boolean {
  const st = storeOf(s, 'session')
  try {
    return st?.getItem(TUTORIAL_SHOWN_KEY) === '1'
  } catch {
    return false
  }
}

export function markShownThisSession(s?: Storage | null): void {
  const st = storeOf(s, 'session')
  try {
    st?.setItem(TUTORIAL_SHOWN_KEY, '1')
  } catch {
    /* 무시 */
  }
}
