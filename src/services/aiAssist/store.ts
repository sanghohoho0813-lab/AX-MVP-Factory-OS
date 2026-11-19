/**
 * AI 도우미 — 고른 공급자 · 모델과 지난 답(이 브라우저 · 이 사람만).
 * 'axmvp.' 키라 로그인 경계에서 사람마다 금고로 옮겨진다(D-162). 못 읽으면 기본값으로 — 화면은 그대로 그린다.
 *
 * D-629 모델 고르는 방식 둘 — 대표(2026-11-18): "단순 질문에 비싼 모델을 쓸 이유가 없다 · 모델도 실시간으로 바꿀 수 있게".
 *   자동(auto)   고른 모델이 없다 — 물음은 가장 싼 모델 · 일을 시킬 때는 좋은 모델(요청마다 callAssist 가 정한다 · autoModel.ts). 한 번도 안 고른 계정의 기본
 *   직접(manual) 고른 모델 그대로(예전 방식) — 예전에 저장된 { provider, model } 은 모두 직접 고른 것으로 읽는다
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

/** D-629 모델 고르는 방식 — 자동(요청마다 정함) · 직접(고른 모델 그대로) */
export type ModelMode = 'auto' | 'manual'
/** 저장 모양 — 방식을 고른 모델과 함께 적는다. 예전 { provider, model } 은 mode 가 없다(= 직접) */
type StoredChoice = { mode?: ModelMode; provider?: ProviderId; model?: string }
/** D-629 자동이 방금 고른 모델을 모델 고르기 판에 알리는 이름 */
export const AUTO_EVENT = 'axmvp:ai-auto'

const ALL_PROVIDERS: readonly ProviderId[] = ['gemini', 'openai', 'anthropic']
let onlyProviders: readonly ProviderId[] | null = null

/**
 * D-257 이 화면에서 고를 수 있는 AI 회사 — 팀장(대표가 팀장 화면으로 볼 때도)은 ['gemini'] · 대표는 null(셋 다).
 * 화면 맨 위(AppShell)에서 그리기 전에 정한다. 고른 것이 그 밖이면 고른 것 없음(= 서버 기본 Gemini)으로 읽는다.
 */
export function setAllowedProviders(list: readonly ProviderId[] | null): void {
  if ((onlyProviders?.join() ?? '*') !== (list?.join() ?? '*')) epoch += 1
  onlyProviders = list
}
export function allowedProviders(): readonly ProviderId[] {
  return onlyProviders ?? ALL_PROVIDERS
}

/** D-629 화면이 다른 계정 모양(대표 ↔ 팀장 · 고객 화면)으로 바뀐 횟수 — 기억해 둔 서버 모델 목록을 그때 다시 받는다 */
let epoch = 0
export function accountEpoch(): number {
  return epoch
}

let cheapOnly = false
/**
 * D-614 내부 팀장(대표가 팀장 화면으로 볼 때도) — 대표 지시 "제미나이 · 지피티(출력) · 클로드 각각 가장 싼 모델만".
 * 모델 고르기에 회사마다 가장 싼 모델(서버 목록의 tier cheap) 하나만 보인다. 서버도 다른 모델을 가장 싼 것으로 바꿔 부른다.
 */
export function setCheapOnly(on: boolean): void {
  if (cheapOnly !== on) epoch += 1
  cheapOnly = on
}
export function isCheapOnly(): boolean {
  return cheapOnly
}

/**
 * D-629 자동이 '일을 시킬 때 좋은 모델' 로 올려 써도 되는 화면인가 — 대표 화면만.
 * 팀장(회사마다 가장 싼 모델 하나) · 구독 고객(Gemini · 사용량을 단계로 셈) 화면은 자동이어도 늘 예전 기본(가장 싼 모델) 그대로다.
 * 더 비싼 모델을 팀장 · 고객에게 여는 것은 대표에게 먼저 묻는 일이라 여기서 열지 않는다(서버도 팀장은 가장 싼 모델로 바꿔 부른다).
 */
export function autoUpgradeAllowed(): boolean {
  return onlyProviders === null && !cheapOnly
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

/** 저장을 못 한 브라우저(저장 공간 막힘)에서도 방금 고른 것이 다음 질문부터 쓰이게 — 이 화면에서만 기억 */
let unsaved: { v: StoredChoice | null } | null = null

function stored(): StoredChoice | null {
  if (unsaved) return unsaved.v
  try {
    const v = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? 'null') as StoredChoice | null
    return v && typeof v === 'object' ? v : null
  } catch {
    // 못 읽으면 기본값(자동)
    return null
  }
}

/** 직접 고른 모델 — 자동이면 null(그때 쓸 모델은 요청마다 callAssist 가 정한다) */
export function readChoice(): AiChoice | null {
  const v = stored()
  if (!v || v.mode === 'auto') return null
  // D-614 가장 싼 모델만 쓰는 계정 — 이 브라우저에 예전에 고른 비싼 모델이 남아 있으면 기본(가장 싼 Gemini)으로 읽는다(고른 기록은 지우지 않음)
  if (cheapOnly && cheapIds && !cheapIds.has(String(v.model))) return null
  if (v.provider && allowedProviders().includes(v.provider) && typeof v.model === 'string' && v.model) return { provider: v.provider, model: v.model }
  return null
}

/** D-629 지금 방식 — 직접 고른 모델이 있으면(이 화면에서 쓸 수 있는 것) 직접, 없으면 자동 */
export function readMode(): ModelMode {
  return readChoice() ? 'manual' : 'auto'
}

/** 모델을 고르면 직접 · null 이면 자동으로 — 방식을 고른 모델과 함께 적는다. 바로 다음 질문부터 쓰인다(다시 읽지 않아도) */
export function saveChoice(c: AiChoice | null): void {
  const v: StoredChoice = c ? { mode: 'manual', provider: c.provider, model: c.model } : { mode: 'auto' }
  try {
    localStorage.setItem(CHOICE_KEY, JSON.stringify(v))
    unsaved = null
  } catch {
    // 저장 못 해도 이번 화면에서는 그대로 쓴다
    unsaved = { v }
  }
  try {
    window.dispatchEvent(new CustomEvent(CHOICE_EVENT, { detail: c }))
  } catch {
    // 알림을 못 보내도 이 도우미는 그대로
  }
}

/** D-629 자동이 방금 고른 것 — 모델 고르기 판의 '방금: 좋은 모델로 답함' 한 줄(이 화면에서만 · 저장 안 함) */
export interface AutoPick {
  weight: 'light' | 'heavy'
  provider: ProviderId
  model: string
  at: number
}
let lastAuto: AutoPick | null = null
export function lastAutoPick(): AutoPick | null {
  return lastAuto
}
export function noteAutoPick(p: AutoPick | null): void {
  lastAuto = p
  try {
    window.dispatchEvent(new Event(AUTO_EVENT))
  } catch {
    // 알림을 못 보내도 판을 다시 열면 보인다
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

/* ------------------------------------------------------------------ */
/* D-638 묻는 중 — 화면을 떠나도 · 휴대폰이 탭을 버려도 다시 열면 답을 받아 온다 */
/* ------------------------------------------------------------------ */

export const PENDING_KEY = 'axmvp.ai.pending.v1'
/** 묻는 중 한 줄 — 받아 오면 이 정보로 지난 답(HistoryEntry)을 만든다 */
export type PendingAsk = Omit<HistoryEntry, 'run' | 'done'> & { rid: string; at: string; owner: string }

const liveOwnerNow = (): string => {
  try {
    return localStorage.getItem('axmvp.vault.live') ?? ''
  } catch {
    return ''
  }
}

function readPending(): PendingAsk[] {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]') as unknown
    if (!Array.isArray(v)) return []
    const now = Date.now()
    return (v as PendingAsk[]).filter((p) => p && typeof p.rid === 'string' && typeof p.scope === 'string' && typeof p.assistId === 'string' && now - Date.parse(p.at) < 30 * 60_000).slice(-20)
  } catch {
    return []
  }
}
function writePending(list: PendingAsk[]) {
  try {
    if (list.length) localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-20)))
    else localStorage.removeItem(PENDING_KEY)
  } catch {
    /* 저장이 안 되면 이번 화면에서만 기다린다 */
  }
}
/** 묻기 시작 — 요청 번호 · 화면 묶음 · 자료 지문 · 링크를 적어 둔다(지금 사람 이름표와 함께) */
export function addPending(p: Omit<PendingAsk, 'at' | 'owner'>): void {
  writePending([...readPending().filter((x) => x.rid !== p.rid), { ...p, at: new Date().toISOString(), owner: liveOwnerNow() }])
}
export function removePending(rid: string): void {
  writePending(readPending().filter((x) => x.rid !== rid))
}
/** 이 화면 묶음에서 아직 답을 못 받은 것(30분 안 · 지금 사람 것만) */
export function pendingFor(scope: string): PendingAsk[] {
  const owner = liveOwnerNow()
  return readPending().filter((p) => p.scope === scope && p.owner === owner)
}
/** D-638 지난 답 넣기 — 묻는 사이 계정(금고)이 바뀌었으면 넣지 않는다(다른 사람 기록에 섞이지 않게) */
export function pushHistoryIfOwner(e: HistoryEntry, owner: string): boolean {
  if (liveOwnerNow() !== owner) return false
  pushHistory(e)
  return true
}
export const currentOwner = liveOwnerNow
