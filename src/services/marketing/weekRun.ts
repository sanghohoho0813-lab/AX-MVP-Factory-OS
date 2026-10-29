/**
 * D-346 1주일치 한 번에 — 여섯 갈래(롱폼 · 쇼츠 둘 · 스레드 셋)를 동시에 부르고, 진행 상태 · 결과를 화면 밖(이 모듈)에 둔다.
 * 화면을 나갔다 들어와도(같은 접속) 쓰는 중 · 다 씀 · 실패가 그대로 보이고, 결과는 이 브라우저(사람별 금고)에 주마다 남긴다.
 * 콘텐츠 묶음 AI(packAi)와 같은 길 — 서버가 '1분에 많이' 로 막으면 그 갈래만 1분 뒤 한 번 더.
 */
import { AssistError, callAssist } from '../aiAssist/client'
import { newRequestId, readChoice } from '../aiAssist/store'
import { WEEK_PARTS, WEEK_STORE_KEY, parseWeekStore, partResult, putWeekStore, type WeekPart, type WeekRequest, type WeekSaved } from './weekPlan'

export type WeekPartState = 'idle' | 'running' | 'done' | 'error'

export interface WeekRun {
  parts: Record<WeekPart, WeekPartState>
  errors: string[]
  storeFull: boolean
}

const allParts = (s: WeekPartState) => Object.fromEntries(WEEK_PARTS.map((p) => [p.part, s])) as Record<WeekPart, WeekPartState>
export const IDLE_WEEK: WeekRun = { parts: allParts('idle'), errors: [], storeFull: false }

const runs = new Map<string, WeekRun>()
const memory = new Map<string, WeekSaved>()
const subs = new Set<() => void>()
let version = 0
const emit = () => {
  version += 1
  for (const f of subs) f()
}
const setRun = (start: string, fn: (r: WeekRun) => WeekRun) => {
  runs.set(start, fn(runs.get(start) ?? IDLE_WEEK))
  emit()
}

export function subscribeWeek(f: () => void): () => void {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
export const weekVersion = () => version
export const weekRun = (start: string): WeekRun => runs.get(start) ?? IDLE_WEEK
export const weekRunning = (start: string) => Object.values(weekRun(start).parts).includes('running')

export function readWeekStore(): Record<string, WeekSaved> {
  try {
    return parseWeekStore(window.localStorage.getItem(WEEK_STORE_KEY))
  } catch {
    return {}
  }
}
function writeWeekStore(saved: WeekSaved): boolean {
  try {
    window.localStorage.setItem(WEEK_STORE_KEY, JSON.stringify(putWeekStore(readWeekStore(), saved)))
    return true
  } catch {
    return false
  }
}

/** 이번 접속에서 쓴 것 먼저, 없으면 이 브라우저에 남긴 것 */
export function weekSaved(start: string): WeekSaved | null {
  return memory.get(start) ?? readWeekStore()[start] ?? null
}

export const WEEK_RATE_RETRY_MS = 65_000

/** 여섯 갈래를 동시에 — 이미 쓰는 중이면 그대로 둔다. 다시 쓰면 그 주 결과를 새로 채운다(답이 온 갈래부터 바뀐다) */
export function startWeekAi(start: string, topics: readonly string[], requests: readonly WeekRequest[], retryMs = WEEK_RATE_RETRY_MS): void {
  if (weekRunning(start) || requests.length === 0) return
  const choice = readChoice()
  setRun(start, () => ({ parts: { ...allParts('idle'), ...Object.fromEntries(requests.map((r) => [r.part, 'running'])) }, errors: [], storeFull: false }))
  const call = (r: WeekRequest, attempt: number) =>
    void callAssist({ requestId: newRequestId(), assistId: r.assistId, page: r.page, choice, context: r.context })
      .then((run) => {
        const got = run.structured ? partResult(r.part, run.structured, r.headline) : null
        if (!got) throw new AssistError('provider_error', 'AI 답을 칸으로 나누지 못했습니다.')
        // 다시 쓰기 — 같은 주라도 주제가 바뀌었으면 예전 갈래 결과를 섞지 않는다
        const prev = weekSaved(start)
        const same = prev && prev.topics.join('|') === topics.join('|')
        const next: WeekSaved = { ...(same ? prev : {}), at: run.createdAt || new Date().toISOString(), model: run.model, start, topics: [...topics], ...got }
        memory.set(start, next)
        const kept = writeWeekStore(next)
        setRun(start, (x) => ({ ...x, parts: { ...x.parts, [r.part]: 'done' }, storeFull: x.storeFull || !kept }))
      })
      .catch((e: unknown) => {
        if (e instanceof AssistError && e.code === 'rate_limited' && attempt === 0) {
          setTimeout(() => call(r, 1), retryMs)
          return
        }
        const label = WEEK_PARTS.find((p) => p.part === r.part)?.label ?? r.part
        const msg = `${label}: ${e instanceof Error ? e.message : '다시 눌러 주세요.'}`
        setRun(start, (x) => ({ ...x, parts: { ...x.parts, [r.part]: 'error' }, errors: x.errors.includes(msg) ? x.errors : [...x.errors, msg] }))
      })
  for (const r of requests) call(r, 0)
}
