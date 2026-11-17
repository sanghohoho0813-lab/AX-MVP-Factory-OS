/**
 * AI 도우미 — 고른 공급자 · 모델과 지난 답(이 브라우저 · 이 사람만).
 * 'axmvp.' 키라 로그인 경계에서 사람마다 금고로 옮겨진다(D-162). 못 읽으면 기본값으로 — 화면은 그대로 그린다.
 */
import type { AssistRun, ProviderId } from './client'
import type { AssistSection } from './context'

const CHOICE_KEY = 'axmvp.ai.choice.v1'
const HISTORY_KEY = 'axmvp.ai.history.v1'
const PER_PAGE = 6
/** D-244 모델을 바꾸면 같은 화면의 다른 AI 도우미도 따라 바꾸게 알리는 이름 */
export const CHOICE_EVENT = 'axmvp:ai-choice'

export interface AiChoice {
  provider: ProviderId
  model: string
}

const ALL_PROVIDERS: readonly ProviderId[] = ['gemini', 'openai', 'anthropic']
let onlyProviders: readonly ProviderId[] | null = null

/**
 * D-257 이 화면에서 고를 수 있는 AI 회사 — 팀장(대표가 팀장 화면으로 볼 때도)은 ['gemini'] · 대표는 null(셋 다).
 * 화면 맨 위(AppShell)에서 그리기 전에 정한다. 고른 것이 그 밖이면 고른 것 없음(= 서버 기본 Gemini)으로 읽는다.
 */
export function setAllowedProviders(list: readonly ProviderId[] | null): void {
  onlyProviders = list
}
export function allowedProviders(): readonly ProviderId[] {
  return onlyProviders ?? ALL_PROVIDERS
}

let cheapOnly = false
/**
 * D-614 내부 팀장(대표가 팀장 화면으로 볼 때도) — 대표 지시 "제미나이 · 지피티(출력) · 클로드 각각 가장 싼 모델만".
 * 모델 고르기에 회사마다 가장 싼 모델(서버 목록의 tier cheap) 하나만 보인다. 서버도 다른 모델을 가장 싼 것으로 바꿔 부른다.
 */
export function setCheapOnly(on: boolean): void {
  cheapOnly = on
}
export function isCheapOnly(): boolean {
  return cheapOnly
}

let cheapIds: ReadonlySet<string> | null = null
/** 서버 목록을 받을 때마다 가장 싼 모델(tier cheap) 이름을 기억한다 — 가장 싼 것만 쓰는 계정에서 예전에 고른 비싼 모델을 걸러 낸다 */
export function noteCheapModels(providers: readonly { models: readonly { id: string; tier?: string | null }[] }[]): void {
  const ids = providers.flatMap((p) => p.models.filter((m) => m.tier === 'cheap').map((m) => m.id))
  if (!ids.length) return
  const changed = !cheapIds || ids.length !== cheapIds.size || ids.some((id) => !cheapIds!.has(id))
  cheapIds = new Set(ids)
  // 이미 열린 화면(모델 단추 · 도우미)도 걸러 낸 선택으로 다시 그리게
  if (changed && cheapOnly) {
    try {
      window.dispatchEvent(new CustomEvent(CHOICE_EVENT, { detail: readChoice() }))
    } catch {
      // 알림을 못 보내도 부를 때는 readChoice 가 거른다
    }
  }
}

export function readChoice(): AiChoice | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? 'null') as AiChoice | null
    // D-614 가장 싼 모델만 쓰는 계정 — 이 브라우저에 예전에 고른 비싼 모델이 남아 있으면 기본(가장 싼 Gemini)으로 읽는다(고른 기록은 지우지 않음)
    if (v && cheapOnly && cheapIds && !cheapIds.has(v.model)) return null
    if (v && allowedProviders().includes(v.provider) && typeof v.model === 'string' && v.model) return v
  } catch {
    // 못 읽으면 기본값
  }
  return null
}

export function saveChoice(c: AiChoice | null): void {
  try {
    if (c) localStorage.setItem(CHOICE_KEY, JSON.stringify(c))
    else localStorage.removeItem(CHOICE_KEY)
  } catch {
    // 저장 못 해도 이번 화면에서는 그대로 쓴다
  }
  try {
    window.dispatchEvent(new CustomEvent(CHOICE_EVENT, { detail: c }))
  } catch {
    // 알림을 못 보내도 이 도우미는 그대로
  }
}

export interface HistoryEntry {
  /** 화면 묶음 열쇠(page 또는 page:모듈) */
  scope: string
  assistId: string
  label: string
  ask: string
  /** 보낸 자료의 지문 — 지금 자료와 다르면 '자료가 바뀌었어요' */
  hash: string
  run: AssistRun
  /** ref → 화면 주소(이 브라우저에만) */
  links?: Record<string, string>
  /** D-241 ref → 원래 번호(업체 · 후보 · 콘텐츠) */
  ids?: Record<string, string>
  /** D-241 이어 쓰기(예: 고른 기획으로 대본) — 무엇을 이어 썼는지 · 다시 만들 때 같은 자료로 */
  follow?: FollowMeta
  /** D-244 별칭(영업자 A) → 실제 이름(이 브라우저에만) */
  aliases?: Record<string, string>
  /** D-244 [할 일로 넣기] 를 마친 항목('item:0' · 'next:1') — 판을 다시 열어도 같은 할 일을 또 넣지 않게 */
  done?: string[]
}

export interface FollowMeta {
  /** 이어 쓴 대상 이름(예: 기획 제목) */
  title: string
  /** 화면 저장소의 번호(예: 내 콘텐츠 줄 번호) */
  targetId?: string
  /** 덧붙여 보낸 자료 한 묶음 — 다시 만들기 · 더 좋은 모델로 다시에 그대로 */
  section: AssistSection
}

function readAll(): HistoryEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as HistoryEntry[]
    return Array.isArray(v) ? v.filter((e) => e && typeof e.scope === 'string' && e.run && typeof e.run.createdAt === 'string') : []
  } catch {
    return []
  }
}

/**
 * D-626 [직접 물어보기] 를 이어서 — 이 화면에서 방금 물은 것 · 받은 답을 다음 질문에 '앞선 대화' 로 같이 보낸다.
 * 최근 5번 · 6시간 안 · [새로 묻기] 를 누른 뒤의 것만(오래된 대화가 엉뚱하게 섞이지 않게). 오래된 것부터.
 */
export const CARRY_TURNS = 5
export const CARRY_WINDOW_MS = 6 * 3600_000
export function askCarry(entries: readonly HistoryEntry[], from = '', now = Date.now()): { 질문: string; 답: string }[] {
  return entries
    .filter((e) => e.assistId.endsWith('.ask') && !e.follow && e.ask && e.run.createdAt > from && now - Date.parse(e.run.createdAt) < CARRY_WINDOW_MS)
    .sort((a, b) => a.run.createdAt.localeCompare(b.run.createdAt))
    .slice(-CARRY_TURNS)
    .map((e) => {
      const a = e.run.structured
      const body = a ? [a.headline, ...(a.items ?? []).slice(0, 6).map((i) => [i.title, i.detail].filter(Boolean).join(' — '))].filter(Boolean).join(' / ') : e.run.raw
      return { 질문: e.ask.slice(0, 300), 답: String(body ?? '').slice(0, 700) }
    })
}

export function historyOf(scope: string): HistoryEntry[] {
  return readAll()
    .filter((e) => e.scope === scope)
    .sort((a, b) => b.run.createdAt.localeCompare(a.run.createdAt))
}

export function pushHistory(e: HistoryEntry): void {
  const all = readAll()
  const mine = [e, ...all.filter((x) => x.scope === e.scope && x.run.requestId !== e.run.requestId)].slice(0, PER_PAGE)
  const others = all.filter((x) => x.scope !== e.scope)
  // 화면이 많아도 저장 공간을 다 쓰지 않게 — 전체 60개까지
  const next = [...mine, ...others].sort((a, b) => b.run.createdAt.localeCompare(a.run.createdAt)).slice(0, 60)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
  } catch {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(mine))
    } catch {
      // 가득 차면 이번 답은 화면에만
    }
  }
}

/** D-244 이 답의 이 항목은 했음 — 저장된 지난 답에 적는다. 고친 답(없으면 null) */
export function markDone(requestId: string, key: string): HistoryEntry | null {
  const all = readAll()
  const hit = all.find((x) => x.run.requestId === requestId)
  if (!hit) return null
  if (!(hit.done ?? []).includes(key)) hit.done = [...(hit.done ?? []), key].slice(-100)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all))
  } catch {
    // 가득 차면 이번 화면에서만 기억
  }
  return hit
}

/** 자료 지문 — 같은 자료면 같은 글자(짧게) */
export function contextHash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

export function newRequestId(): string {
  try {
    return `as_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`
  } catch {
    return `as_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
  }
}
