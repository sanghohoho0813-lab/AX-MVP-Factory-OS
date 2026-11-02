/**
 * D-497 오늘 대화창 — 대화 · 묻는 중 · 평가 · 별명을 화면 밖(이 모듈)에 둔다.
 * 답을 기다리는 사이 다른 화면으로 가도 답은 여기로 와서 저장되고, 오늘로 돌아오면 그대로 보인다(오른쪽 판 AI 대화와 같은 방식).
 * 저장은 이 기기(axmvp.home.ask.* — 사람별 금고로 옮겨짐 · 대표 ↔ 팀장 섞이지 않음).
 */
import { useSyncExternalStore } from 'react'
import { callAssist, type AssistAnswer } from '../aiAssist/client'
import { newRequestId, readChoice } from '../aiAssist/store'
import type { AssistBundle } from '../aiAssist/context'
import { EMPTY_FEEDBACK, parseFeedback, preferenceRules, priorTurnsSection, withFeedback, type DownReason, type HomeFeedback, type PlanChip, type RuleAnswer } from './homeAsk'
import type { ChatDoc, DocCompany } from './homeDocs'
import type { TalkAnswer } from './homeTalk'

export const HOME_ASK_KEY = 'axmvp.home.ask.v1'
export const HOME_FB_KEY = 'axmvp.home.ask.fb.v1'
export const HOME_ALIAS_KEY = 'axmvp.home.ask.alias.v1'
const MAX_TURNS = 20

export interface HomeTurn {
  id: string
  at: string
  q: string
  clientIds: string[]
  /** pending 묻는 중 · ai AI 가 답함 · rule 규칙으로 정리(AI 연결 없음 · 실패) */
  status: 'pending' | 'ai' | 'rule'
  answer?: AssistAnswer
  links?: Record<string, string>
  model?: string
  /** rule 일 때 까닭(AI 연결 오류 문구) — 연결이 없어서가 아니라 고른 것이면 '' */
  why?: string
  rated?: 'up' | 'down'
  /** D-498 이 질문과 함께 올린 서류(이름 · 종류) · 서류의 회사 · 저장했나 — 파일 자체는 메모리(pendingDocs)에만 */
  docs?: { names: string[]; labels: string[]; company?: DocCompany | null; saved?: 'client' | 'new' }
  /** D-499 답에서 이미 할 일로 넣은 것(다음에 할 일 번호) — 다시 눌러 같은 할 일이 두 번 생기지 않게 */
  todoDone?: number[]
  /** D-501 물어본 업체에 맞는 상황 예시(최대 3) — 누르면 그 업체 숫자로 모듈이 열린다 */
  plans?: PlanChip[]
  /** D-502 질문에서 읽은 업체 사정(상황 질문의 답 · 아직 업체에 없는 것만) — [업체에 기록] 한 번 */
  talk?: { clientId: string; company: string; answers: TalkAnswer[]; saved?: boolean }
}

export interface HomeAskState {
  turns: HomeTurn[]
  busy: boolean
}

const read = <T,>(key: string, parse: (raw: string | null) => T, fallback: T): T => {
  try {
    return parse(localStorage.getItem(key))
  } catch {
    return fallback
  }
}
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* 저장 공간이 가득 차도 이번 접속 동안은 보인다 */
  }
}

export function parseTurns(raw: string | null): HomeTurn[] {
  try {
    const v = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(v)) return []
    return v
      .filter((t): t is HomeTurn => !!t && typeof t === 'object' && typeof (t as HomeTurn).id === 'string' && typeof (t as HomeTurn).q === 'string')
      // 묻는 중에 닫았던 것은 '다시 묻기' 로 보이게(답이 영영 안 오는 회색 줄이 남지 않게)
      .map((t) => (t.status === 'pending' ? { ...t, status: 'rule' as const, why: '답을 받기 전에 화면을 닫았어요 — 다시 물어봐 주세요.', answer: t.answer ?? { headline: '답을 받지 못했어요.', items: [] } } : t))
      .slice(-MAX_TURNS)
  } catch {
    return []
  }
}

const parseAliases = (raw: string | null): Record<string, string> => {
  const v = raw ? (JSON.parse(raw) as unknown) : {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k, id]) => k.length >= 2 && typeof id === 'string').slice(-200)) as Record<string, string>
}

let state: HomeAskState = { turns: typeof window === 'undefined' ? [] : read(HOME_ASK_KEY, parseTurns, []), busy: false }
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const set = (patch: Partial<HomeAskState>) => {
  state = { ...state, ...patch }
  emit()
}
function commit(fn: (cur: HomeTurn[]) => HomeTurn[]) {
  const turns = fn(state.turns).slice(-MAX_TURNS)
  write(HOME_ASK_KEY, turns)
  set({ turns })
}

/** 지금 꺼내 놓은 사람 — 묻는 사이 계정이 바뀌면 답을 버린다 */
const liveOwner = () => read('axmvp.vault.live', (r) => r ?? '', '')
const uid = () => `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

export const homeFeedback = (): HomeFeedback => read(HOME_FB_KEY, parseFeedback, EMPTY_FEEDBACK)
export const homeAliases = (): Record<string, string> => read(HOME_ALIAS_KEY, parseAliases, {})
export function addAliases(list: readonly string[], clientId: string): void {
  if (!list.length) return
  write(HOME_ALIAS_KEY, { ...homeAliases(), ...Object.fromEntries(list.map((a) => [a, clientId])) })
}

export interface AskPlan {
  question: string
  clientIds: string[]
  /** AI 를 부를 수 있나(대표 · 팀장) */
  canAI: boolean
  /** D-498 함께 올린 서류(읽기 끝난 것) */
  docs?: readonly ChatDoc[]
  /** 보낼 자료 · 규칙 답 — 묻는 순간 만든다(판정 엔진은 이때 받는다) */
  prepare: () => Promise<{ bundle: AssistBundle; rule: RuleAnswer; docCompany?: DocCompany | null; plans?: PlanChip[]; talk?: HomeTurn['talk'] }>
}

/** D-498 질문마다 올린 파일(메모리에만 — 새로 고치면 사라진다 · 저장하면 지운다) */
const pendingDocs = new Map<string, ChatDoc[]>()
export const docsOfTurn = (id: string): ChatDoc[] => pendingDocs.get(id) ?? []

/** 서류를 업체 서류함 · 새 업체 등록으로 넘긴 뒤 — 같은 파일을 두 번 넘기지 않게 */
export function markDocsSaved(id: string, how: 'client' | 'new'): void {
  pendingDocs.delete(id)
  commit((cur) => cur.map((t) => (t.id === id && t.docs ? { ...t, docs: { ...t.docs, saved: how } } : t)))
}

/** 묻기 — 묻는 중이면 무시. AI 가 안 되면(연결 없음 · 오류) 규칙으로 정리한 답을 같은 자리에 */
export async function askHome(plan: AskPlan): Promise<void> {
  const q = plan.question.trim()
  if (!q || state.busy) return
  const id = uid()
  const owner = liveOwner()
  const before = state.turns
  const docs = (plan.docs ?? []).filter((d) => d.status === 'done')
  if (docs.length) pendingDocs.set(id, [...docs])
  commit((cur) => [...cur, { id, at: new Date().toISOString(), q, clientIds: plan.clientIds, status: 'pending', ...(docs.length ? { docs: { names: docs.map((d) => d.file.name), labels: docs.map((d) => d.label) } } : {}) }])
  set({ busy: true })
  const finish = (patch: Partial<HomeTurn>) => {
    if (liveOwner() !== owner) return
    commit((cur) => cur.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }
  let rule: RuleAnswer | null = null
  try {
    const prep = await plan.prepare()
    rule = prep.rule
    // 서류의 회사(등록된 업체 · 새 업체) — 답 아래 [서류함에 넣기 · 새 업체로 등록] 단추가 쓴다
    if (docs.length && prep.docCompany !== undefined) {
      const company = prep.docCompany
      commit((cur) => cur.map((t) => (t.id === id && t.docs ? { ...t, docs: { ...t.docs, company }, clientIds: company?.clientId && !t.clientIds.includes(company.clientId) ? [company.clientId, ...t.clientIds].slice(0, 3) : t.clientIds } : t)))
    }
    // 맞는 상황 예시 — AI 답이든 규칙 정리든 답 아래 같은 단추
    if (prep.plans?.length || prep.talk?.answers.length) {
      const extra: Partial<HomeTurn> = { ...(prep.plans?.length ? { plans: prep.plans } : {}), ...(prep.talk?.answers.length ? { talk: prep.talk } : {}) }
      commit((cur) => cur.map((t) => (t.id === id ? { ...t, ...extra } : t)))
    }
    if (!plan.canAI) {
      finish({ status: 'rule', answer: prep.rule, links: prep.rule.links, why: '' })
      return
    }
    const prior = priorTurnsSection(before.map((t) => ({ q: t.q, headline: t.answer?.headline })))
    const rules = preferenceRules(homeFeedback())
    const context = {
      ...prep.bundle.context,
      sections: [...prep.bundle.context.sections.slice(0, prior ? 11 : 12), ...(prior ? [prior] : [])],
      rules: [...(prep.bundle.context.rules ?? []), ...rules],
    }
    const run = await callAssist({ requestId: newRequestId(), assistId: 'home.chat', page: 'today', choice: readChoice(), context, ask: q })
    const s = run.structured
    finish({ status: 'ai', answer: s ?? { headline: run.raw.slice(0, 2000), items: [] }, links: prep.bundle.links, model: run.servedModel || run.model })
  } catch (e) {
    const why = e instanceof Error && e.message ? e.message : 'AI 연결을 확인해 주세요'
    finish({ status: 'rule', answer: rule ?? { headline: '답을 만들지 못했어요. 잠시 뒤 다시 물어봐 주세요.', items: [] }, links: rule?.links ?? {}, why })
  } finally {
    set({ busy: false })
  }
}

/** 👍 · 👎 — 다음 답의 말하기 규칙으로 쌓인다 */
export function rateTurn(id: string, vote: { up: true } | { up: false; reason: DownReason }): void {
  const t = state.turns.find((x) => x.id === id)
  if (!t) return
  write(HOME_FB_KEY, withFeedback(homeFeedback(), vote.up ? { up: true, q: t.q, headline: t.answer?.headline ?? '' } : vote))
  commit((cur) => cur.map((x) => (x.id === id ? { ...x, rated: vote.up ? 'up' : 'down' } : x)))
}

/** D-502 말한 사정을 업체에 기록했다 */
export function markTalkSaved(id: string): void {
  commit((cur) => cur.map((t) => (t.id === id && t.talk ? { ...t, talk: { ...t.talk, saved: true } } : t)))
}

/** D-499 '다음에 할 일' 한 줄을 할 일로 넣었다 */
export function markTodoDone(id: string, index: number): void {
  commit((cur) => cur.map((t) => (t.id === id ? { ...t, todoDone: [...new Set([...(t.todoDone ?? []), index])] } : t)))
}

export function clearHomeTurns(): HomeTurn[] {
  const prev = state.turns
  commit(() => [])
  return prev
}
export function restoreHomeTurns(turns: readonly HomeTurn[]): void {
  commit(() => [...turns])
}

/** 오늘로 돌아올 때 — 묻는 중이 아니면 저장된 대화를 다시 읽는다(다른 계정 · 다른 창에서 바뀐 것) */
export function syncHomeTurns(): void {
  if (state.busy) return
  const turns = read(HOME_ASK_KEY, parseTurns, [])
  if (JSON.stringify(turns) !== JSON.stringify(state.turns)) set({ turns })
}

const subscribe = (f: () => void) => {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
const snapshot = () => state
export function useHomeAsk(): HomeAskState {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
