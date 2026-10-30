/**
 * D-346 1주일치 한 번에 — 여섯 갈래(롱폼 · 쇼츠 둘 · 스레드 셋)를 동시에 부르고, 진행 상태 · 결과를 화면 밖(이 모듈)에 둔다.
 * 화면을 나갔다 들어와도(같은 접속) 쓰는 중 · 다 씀 · 실패가 그대로 보이고, 결과는 이 브라우저(사람별 금고)에 주마다 남긴다.
 * 콘텐츠 묶음 AI(packAi)와 같은 길 — 서버가 '1분에 많이' 로 막으면 그 갈래만 1분 뒤 한 번 더.
 * D-349 답이 온 갈래마다 클라우드에도 남기고 내 콘텐츠 · 릴스 · 스레드 목록으로 모은다(weekCollect) — 한 줄로 차례차례(늦게 간 저장이 새 것을 덮지 않게).
 * 화면을 열 때 클라우드 쪽이 새것이면 그것을 쓰고, 이 브라우저에만 있던 주(예전 휴대폰 결과)는 클라우드로 올리고 모은다.
 */
import { AssistError, callAssist } from '../aiAssist/client'
import { newRequestId, readChoice } from '../aiAssist/store'
import { collectWeek, loadWeeksCloud, saveWeekCloud } from './weekCollect'
import { WEEK_PARTS, WEEK_STORE_KEY, parseWeekStore, partResult, putWeekStore, type WeekPart, type WeekRequest, type WeekSaved } from './weekPlan'

/** D-350 stopped = [멈추기] 로 멈춘 갈래(다 쓴 갈래는 그대로 남는다) */
export type WeekPartState = 'idle' | 'running' | 'done' | 'error' | 'stopped'

export interface WeekRun {
  parts: Record<WeekPart, WeekPartState>
  errors: string[]
  storeFull: boolean
  /** D-350 쓰기를 마친 때(멈춘 것 빼고) — 다른 화면에 있었으면 '다 썼어요' 알림 */
  finishedAt?: number
  /** D-350 그 알림을 봤나(1주일치 화면을 열었거나 닫기) */
  seen?: boolean
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

/** D-350 어느 화면에서든 띄울 1주일치 — 쓰는 중이거나, 다 썼는데 아직 안 본 주(가장 최근) */
export function activeWeekRun(): { start: string; run: WeekRun } | null {
  const xs = [...runs.entries()].filter(([s, r]) => weekRunning(s) || (r.finishedAt && !r.seen)).sort((a, b) => b[0].localeCompare(a[0]))
  return xs.length ? { start: xs[0][0], run: xs[0][1] } : null
}
export function markWeekSeen(start: string): void {
  const r = runs.get(start)
  if (r && r.finishedAt && !r.seen) setRun(start, (x) => ({ ...x, seen: true }))
}

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

/* ------------------------------------------------------------------ */
/* D-349 클라우드 · 목록으로 모으기                                         */
/* ------------------------------------------------------------------ */

export interface WeekSync {
  state: 'idle' | 'saving' | 'done' | 'error'
  /** 목록에 있게 된 줄(새로 · 같음 · 고친 것 그대로 · 올린 것) */
  idea: number
  shorts: number
  threads: number
  /** 대표가 고친 글이라 덮지 않은 줄 */
  kept: number
}
export const IDLE_SYNC: WeekSync = { state: 'idle', idea: 0, shorts: 0, threads: 0, kept: 0 }
const syncs = new Map<string, WeekSync>()
/** D-350 클라우드에서 마지막으로 읽은 주들(내 콘텐츠 '1주일치 묶음' — 이 브라우저에 4주만 남겨도 지난 주들이 보이게) */
const cloudWeeks = new Map<string, WeekSaved>()

/** D-350 만든 주 전부 — 이번 접속 · 이 브라우저 · 클라우드 가운데 같은 주는 가장 새것, 최근 주 먼저 */
export function allWeeks(): WeekSaved[] {
  const out = new Map<string, WeekSaved>()
  for (const w of [...cloudWeeks.values(), ...Object.values(readWeekStore()), ...memory.values()]) {
    const had = out.get(w.start)
    if (!had || w.at >= had.at) out.set(w.start, w)
  }
  return [...out.values()].sort((a, b) => b.start.localeCompare(a.start))
}
const syncIds = new Map<string, { idea: Set<string>; shorts: Set<string>; threads: Set<string>; kept: Set<string> }>()
let chain: Promise<void> = Promise.resolve()
export const weekSync = (start: string): WeekSync => syncs.get(start) ?? IDLE_SYNC

/** 차례차례 — 앞 일이 실패해도 다음 일은 한다 */
function queue(start: string, job: () => Promise<void>): Promise<void> {
  syncs.set(start, { ...weekSync(start), state: 'saving' })
  emit()
  chain = chain.then(job).then(
    () => {
      syncs.set(start, { ...weekSync(start), state: 'done' })
      emit()
    },
    () => {
      syncs.set(start, { ...weekSync(start), state: 'error' })
      emit()
    },
  )
  return chain
}

async function saveAndCollect(ws: string | null, next: WeekSaved, prev: WeekSaved | null, parts?: readonly WeekPart[]): Promise<void> {
  await saveWeekCloud(ws, next)
  const got = await collectWeek(ws, next, prev, parts)
  const ids = syncIds.get(next.start) ?? { idea: new Set<string>(), shorts: new Set<string>(), threads: new Set<string>(), kept: new Set<string>() }
  for (const k of ['idea', 'shorts', 'threads'] as const) for (const id of got.ids[k]) ids[k].add(id)
  for (const id of got.keptIds) ids.kept.add(id)
  syncIds.set(next.start, ids)
  syncs.set(next.start, { state: weekSync(next.start).state, idea: ids.idea.size, shorts: ids.shorts.size, threads: ids.threads.size, kept: ids.kept.size })
}

/**
 * 화면을 열 때 한 번 — 클라우드가 새것이면 그것을 쓰고, 이 브라우저에만 있던(또는 더 새) 주는 올리고 모은다.
 * 이번 주는 한 번 더 모아 본다(같은 글이면 쓰지 않는다 · 다른 기기에서 모으다 끊긴 것도 채운다).
 */
export async function openWeekSync(ws: string | null, current: string): Promise<void> {
  let cloud: WeekSaved[]
  try {
    cloud = await loadWeeksCloud(ws)
  } catch {
    return
  }
  cloudWeeks.clear()
  for (const w of cloud) cloudWeeks.set(w.start, w)
  const local = readWeekStore()
  const byStart = new Map(cloud.map((w) => [w.start, w]))
  let adopted = false
  for (const w of cloud) {
    const mine = memory.get(w.start) ?? local[w.start]
    if (!weekRunning(w.start) && (!mine || w.at > mine.at)) {
      memory.set(w.start, w)
      writeWeekStore(w)
      adopted = true
    }
  }
  if (adopted) emit()
  const jobs: Promise<void>[] = []
  for (const w of Object.values({ ...local, ...Object.fromEntries(memory) })) {
    const up = byStart.get(w.start)
    if (!up || w.at > up.at) jobs.push(queue(w.start, () => saveAndCollect(ws, w, up ?? null)))
    else if (w.start === current && !weekRunning(w.start)) jobs.push(queue(w.start, () => collectOnly(ws, weekSaved(w.start) ?? w)))
  }
  await Promise.all(jobs)
}

async function collectOnly(ws: string | null, w: WeekSaved): Promise<void> {
  const got = await collectWeek(ws, w, null)
  const ids = { idea: new Set(got.ids.idea), shorts: new Set(got.ids.shorts), threads: new Set(got.ids.threads), kept: new Set(got.keptIds) }
  syncIds.set(w.start, ids)
  syncs.set(w.start, { state: weekSync(w.start).state, idea: ids.idea.size, shorts: ids.shorts.size, threads: ids.threads.size, kept: ids.kept.size })
}

export const WEEK_RATE_RETRY_MS = 65_000

export interface WeekAiOptions {
  retryMs?: number
  /** 작업공간 — 주면 답이 온 갈래마다 클라우드 · 목록으로 모은다(팀장 화면 보기 · 저장 안 함이면 주지 않는다) */
  ws?: string | null
}

/** D-350 주마다 지금 쓰는 차례 — [멈추기] 를 누르면 끊고(늦게 온 답은 버린다) · 1분 뒤 다시 부르기도 취소 */
const ctls = new Map<string, { ac: AbortController; timers: Set<ReturnType<typeof setTimeout>>; gen: number }>()
let gens = 0

/** 쓰는 중인 갈래를 멈춘다 — 이미 다 쓴 갈래는 그대로 남고 목록에도 모인다 */
export function stopWeekAi(start: string): void {
  const c = ctls.get(start)
  if (!c || !weekRunning(start)) return
  c.ac.abort()
  for (const t of c.timers) clearTimeout(t)
  ctls.delete(start)
  setRun(start, (x) => ({ ...x, parts: Object.fromEntries(Object.entries(x.parts).map(([k, v]) => [k, v === 'running' ? 'stopped' : v])) as Record<WeekPart, WeekPartState>, finishedAt: undefined, seen: true }))
}

/** 마지막 갈래가 끝났으면 '다 썼어요' 알림 자리(다른 화면에서 보게) */
const finishIfDone = (start: string) => setRun(start, (x) => (Object.values(x.parts).includes('running') ? x : { ...x, finishedAt: Date.now(), seen: false }))

/** 여섯 갈래를 동시에 — 이미 쓰는 중이면 그대로 둔다. 다시 쓰면 그 주 결과를 새로 채운다(답이 온 갈래부터 바뀐다).
 * 화면을 나가도(뒤로 가기 · 고객 관리 · 특허 등 다른 메뉴) 이 모듈에서 계속 돈다 — 멈추는 것은 [멈추기] 뿐. */
export function startWeekAi(start: string, topics: readonly string[], requests: readonly WeekRequest[], opts: WeekAiOptions = {}): void {
  const retryMs = opts.retryMs ?? WEEK_RATE_RETRY_MS
  if (weekRunning(start) || requests.length === 0) return
  const choice = readChoice()
  const ctl = { ac: new AbortController(), timers: new Set<ReturnType<typeof setTimeout>>(), gen: ++gens }
  ctls.set(start, ctl)
  const live = () => ctls.get(start)?.gen === ctl.gen && !ctl.ac.signal.aborted
  setRun(start, () => ({ parts: { ...allParts('idle'), ...Object.fromEntries(requests.map((r) => [r.part, 'running'])) }, errors: [], storeFull: false }))
  const call = (r: WeekRequest, attempt: number) =>
    void callAssist({ requestId: newRequestId(), assistId: r.assistId, page: r.page, choice, context: r.context, signal: ctl.ac.signal })
      .then((run) => {
        if (!live()) return
        const got = run.structured ? partResult(r.part, run.structured, r.headline) : null
        if (!got) throw new AssistError('provider_error', 'AI 답을 칸으로 나누지 못했습니다.')
        // 다시 쓰기 — 같은 주라도 주제가 바뀌었으면 예전 갈래 결과를 섞지 않는다
        const prev = weekSaved(start)
        const same = prev && prev.topics.join('|') === topics.join('|')
        const next: WeekSaved = { ...(same ? prev : {}), at: run.createdAt || new Date().toISOString(), model: run.model, start, topics: [...topics], ...got }
        memory.set(start, next)
        const kept = writeWeekStore(next)
        setRun(start, (x) => ({ ...x, parts: { ...x.parts, [r.part]: 'done' }, storeFull: x.storeFull || !kept }))
        finishIfDone(start)
        // 같은 주제로 다시 쓴 것이면 예전 AI 글과 비교해 고친 글을 지킨다(주제가 바뀌었으면 예전 글은 비교 대상이 아님)
        if (opts.ws !== undefined) void queue(start, () => saveAndCollect(opts.ws ?? null, next, same ? prev : null, [r.part]))
      })
      .catch((e: unknown) => {
        if (!live()) return
        if (e instanceof AssistError && e.code === 'rate_limited' && attempt === 0) {
          const t = setTimeout(() => {
            ctl.timers.delete(t)
            if (live()) call(r, 1)
          }, retryMs)
          ctl.timers.add(t)
          return
        }
        const label = WEEK_PARTS.find((p) => p.part === r.part)?.label ?? r.part
        const msg = `${label}: ${e instanceof Error ? e.message : '다시 눌러 주세요.'}`
        setRun(start, (x) => ({ ...x, parts: { ...x.parts, [r.part]: 'error' }, errors: x.errors.includes(msg) ? x.errors : [...x.errors, msg] }))
        finishIfDone(start)
      })
  for (const r of requests) call(r, 0)
}
