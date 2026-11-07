/**
 * D-552 모듈 첫 화면 = 대화창(대표 "어느 파트를 가도 LLM 첫 화면 같은 느낌" · "직접 클릭하면서 하고 싶은 사람은 그렇게").
 *
 * 메뉴로 들어온 **맨 첫 주소**(`/tools/policy-funding` 처럼 뒤에 아무것도 없을 때)만 대화창을 보여 준다.
 *  - 목차 화면(`/tools/<모듈>/<화면>`) · 업체를 물고 온 주소(`?client=`) · 상황 예시(`?preset=`) 등 뒤에 무엇이 붙은 주소는 **예전 화면 그대로**
 *    (맞춤 추천 · 상황 예시 · 오늘 화면에서 누른 '열기' 가 한 번 더 누르지 않게).
 *  - `?chat=1` 은 언제나 대화창(예전 화면 위 [대화로 묻기]).
 *  - 사람마다 고를 수 있다: 모듈마다 · 전체(설정 › 내 설정) '대화창부터' / '바로 화면'. 처음은 대화창부터.
 * 규칙 계산 — 외부 호출 없음.
 */

export type ChatFirstKey = 'policy-funding' | 'employment' | 'labcare' | 'startup-tax' | 'tax' | 'grants' | 'cretop' | 'content' | 'homepage'

/** 대화창으로 시작하는 모듈 · 그 첫 주소 */
export const CHAT_FIRST_PATHS: Readonly<Record<ChatFirstKey, string>> = {
  'policy-funding': '/tools/policy-funding',
  employment: '/tools/employment',
  labcare: '/tools/labcare',
  'startup-tax': '/tools/startup-tax',
  tax: '/tools/tax',
  grants: '/grants',
  cretop: '/tools/cretop',
  content: '/tools/content',
  homepage: '/tools/homepage',
}

export const CHAT_FIRST_KEYS = Object.keys(CHAT_FIRST_PATHS) as ChatFirstKey[]

/** 화면에 쓰는 이름(설정 › 내 설정 · 메뉴와 같은 말) */
export const CHAT_FIRST_LABEL: Readonly<Record<ChatFirstKey, string>> = {
  'policy-funding': '정책자금',
  employment: '고용지원금',
  labcare: '기업부설연구소',
  'startup-tax': '창업감면',
  tax: '세금 계산기',
  grants: '지원사업',
  cretop: '크레탑 분석',
  content: '홍보 글',
  homepage: '홈페이지',
}

export type ChatFirstMode = 'chat' | 'direct'

export interface ChatFirstPrefs {
  /** 전체 기본(없으면 'chat') */
  all?: ChatFirstMode
  /** 모듈마다(있으면 전체보다 먼저) */
  mods?: Partial<Record<ChatFirstKey, ChatFirstMode>>
}

/** 'axmvp.' — 로그인한 사람별 금고에 같이 들어간다(같은 브라우저 다른 계정과 따로) */
export const CHAT_FIRST_KEY = 'axmvp.chatfirst.v1'
export const CHAT_FIRST_EVENT = 'axmvp:chatfirst'

const isMode = (v: unknown): v is ChatFirstMode => v === 'chat' || v === 'direct'

export function parseChatFirst(raw: string | null): ChatFirstPrefs {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw) as Record<string, unknown>
    if (!v || typeof v !== 'object') return {}
    const out: ChatFirstPrefs = {}
    if (isMode(v.all)) out.all = v.all
    if (v.mods && typeof v.mods === 'object') {
      const mods: Partial<Record<ChatFirstKey, ChatFirstMode>> = {}
      for (const k of CHAT_FIRST_KEYS) {
        const m = (v.mods as Record<string, unknown>)[k]
        if (isMode(m)) mods[k] = m
      }
      if (Object.keys(mods).length) out.mods = mods
    }
    return out
  } catch {
    return {}
  }
}

export function readChatFirst(): ChatFirstPrefs {
  try {
    return parseChatFirst(localStorage.getItem(CHAT_FIRST_KEY))
  } catch {
    return {}
  }
}

/**
 * 고친 칸만 바꿔 쓴다(이 버전이 모르는 값은 그대로 — D-315).
 * `clearMods` — 전체를 고를 때 모듈마다 고른 것(이 버전이 아는 9곳만)을 비워 전체 값을 따르게.
 */
export function writeChatFirst(next: ChatFirstPrefs & { clearMods?: boolean }): void {
  try {
    const prev = (JSON.parse(localStorage.getItem(CHAT_FIRST_KEY) ?? '{}') ?? {}) as Record<string, unknown>
    const mods: Record<string, unknown> = { ...((prev.mods as Record<string, unknown>) ?? {}), ...(next.mods ?? {}) }
    if (next.clearMods) for (const k of CHAT_FIRST_KEYS) delete mods[k]
    localStorage.setItem(CHAT_FIRST_KEY, JSON.stringify({ ...prev, ...(next.all ? { all: next.all } : {}), mods }))
  } catch {
    // 저장 공간이 막혀도 이번 화면은 고른 대로
  }
  try {
    window.dispatchEvent(new CustomEvent(CHAT_FIRST_EVENT))
  } catch {
    /* 시험 환경 */
  }
}

/** 이 모듈을 열 때 — 모듈마다 고른 것 → 전체 → 대화창부터 */
export function modeOf(prefs: ChatFirstPrefs, key: ChatFirstKey): ChatFirstMode {
  return prefs.mods?.[key] ?? prefs.all ?? 'chat'
}

/** 주소 → 대화창 모듈(아니면 null). 목차 화면(`/tools/x/y`)도 그 모듈로 본다 */
export function chatFirstKeyOf(pathname: string): ChatFirstKey | null {
  const p = pathname.replace(/\/+$/, '') || '/'
  for (const k of CHAT_FIRST_KEYS) {
    const base = CHAT_FIRST_PATHS[k]
    if (p === base || p.startsWith(`${base}/`)) return k
  }
  return null
}

/**
 * 지금 주소에서 대화창을 보여 줄까 — `?chat=1` 이면 언제나 · 맨 첫 주소(뒤에 아무것도 없음)면 고른 대로.
 * 목차 화면 · 업체 · 상황 예시 · 다른 칸이 붙은 주소는 예전 화면.
 */
export function chatShown(pathname: string, search: string, prefs: ChatFirstPrefs): boolean {
  const key = chatFirstKeyOf(pathname)
  if (!key) return false
  const q = new URLSearchParams(search)
  if (q.get('chat') === '1') return true
  const p = pathname.replace(/\/+$/, '')
  if (p !== CHAT_FIRST_PATHS[key]) return false
  if ([...q.keys()].length > 0) return false
  return modeOf(prefs, key) === 'chat'
}
