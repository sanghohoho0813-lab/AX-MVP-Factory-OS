/**
 * AI 도우미 — 고른 공급자 · 모델과 지난 답(이 브라우저 · 이 사람만).
 * 'axmvp.' 키라 로그인 경계에서 사람마다 금고로 옮겨진다(D-162). 못 읽으면 기본값으로 — 화면은 그대로 그린다.
 */
import type { AssistRun, ProviderId } from './client'

const CHOICE_KEY = 'axmvp.ai.choice.v1'
const HISTORY_KEY = 'axmvp.ai.history.v1'
const PER_PAGE = 6

export interface AiChoice {
  provider: ProviderId
  model: string
}

export function readChoice(): AiChoice | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? 'null') as AiChoice | null
    if (v && (v.provider === 'gemini' || v.provider === 'openai' || v.provider === 'anthropic') && typeof v.model === 'string' && v.model) return v
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
}

function readAll(): HistoryEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as HistoryEntry[]
    return Array.isArray(v) ? v.filter((e) => e && typeof e.scope === 'string' && e.run && typeof e.run.createdAt === 'string') : []
  } catch {
    return []
  }
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
