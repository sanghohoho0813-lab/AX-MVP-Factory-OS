/**
 * D-251 콘텐츠 묶음 AI — 세 갈래를 동시에 부르고, 진행 상태 · 결과를 화면 밖(이 모듈)에 둔다.
 * 묶음 화면을 나갔다 들어와도(같은 접속) 쓰는 중 · 다 씀 · 실패가 그대로 보이고, 나간 사이에 온 답도 바로 보인다.
 * 결과는 이 브라우저(packStore · 사람별 금고)에도 남긴다 — 저장이 막혀도 이번 접속 동안은 메모리에 있다.
 * D-514 작업공간 기록(packSync · marketing / packs)에도 — 다른 기기에서 같은 키워드를 열면 다시 부르지 않고 그 글이 보인다.
 */
import { AssistError, callAssist } from '../aiAssist/client'
import { newRequestId, readChoice } from '../aiAssist/store'
import type { AssistContext } from '../aiAssist/context'
import { PACK_AI_PARTS, aiSections, type PackAiPart, type PackAiSaved } from './contentPack'
import { readPackStore, writePackStore, writePackStoreAll } from './packStore'
import { adoptPacks, cloudPacksOn, loadPacksCloud, mergePackStores, samePackStores, savePacksCloud, type PackStore } from './packSync'

export type PartState = 'idle' | 'running' | 'done' | 'error'

export interface PackRun {
  parts: Record<PackAiPart, PartState>
  errors: string[]
  /** 이 브라우저 저장 공간이 막혀 남기지 못함(이번 접속 동안은 보임) */
  storeFull: boolean
}

export const IDLE_RUN: PackRun = { parts: { video: 'idle', short: 'idle', blog: 'idle' }, errors: [], storeFull: false }

const runs = new Map<string, PackRun>()
const memory = new Map<string, PackAiSaved>()
const subs = new Set<() => void>()
let version = 0

const emit = () => {
  version += 1
  for (const f of subs) f()
}
const setRun = (key: string, fn: (r: PackRun) => PackRun) => {
  runs.set(key, fn(runs.get(key) ?? IDLE_RUN))
  emit()
}

export function subscribePackAi(f: () => void): () => void {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
export const packAiVersion = () => version
export const packRun = (key: string): PackRun => runs.get(key) ?? IDLE_RUN
export const isRunning = (key: string) => Object.values(packRun(key).parts).includes('running')

/** 이번 접속에서 쓴 것 먼저, 없으면 이 브라우저에 남긴 것 */
export function packSaved(key: string): PackAiSaved | null {
  return memory.get(key) ?? readPackStore()[key] ?? null
}

/* ------------------------------------------------------------------ */
/* D-514 클라우드 — 다른 기기에서 쓴 결과 가져오기 · 이 기기 결과 올리기         */
/* ------------------------------------------------------------------ */

/** 마케팅 화면이 열 때 알려 준 작업공간(팀장 화면 보기 · 브라우저 저장 모드면 null — 올리지 않는다) */
let cloudWs: string | null = null
let cloudFailed = false
let chain: Promise<void> = Promise.resolve()
/** 아직 시작하지 않은 맞추기가 줄에 있으면 또 넣지 않는다(그 일이 시작할 때 가장 새 결과를 읽는다) */
let waiting = false

const deviceNow = (): 'pc' | 'phone' => (typeof window !== 'undefined' && window.innerWidth < 640 ? 'phone' : 'pc')

/** 클라우드에 올리지 못한 채 이 기기에만 있음(연결되면 다시) */
export const packCloudFailed = () => cloudFailed

/** 이 기기 전부 — 이번 접속에서 쓴 것 + 이 브라우저에 남긴 것 */
const localAll = (): PackStore => mergePackStores(readPackStore(), Object.fromEntries(memory))

async function syncOnce(ws: string): Promise<void> {
  waiting = false
  const cloud = await loadPacksCloud(ws)
  // 1) 가져오기 — 이 기기에 없거나 클라우드 쪽이 나중인 키워드(지금 쓰는 중인 키워드는 빼고)
  const running = new Set([...runs.keys()].filter(isRunning))
  const { local, adopted } = adoptPacks(localAll(), cloud, running)
  if (adopted.length) {
    for (const k of adopted) memory.set(k, local[k])
    writePackStoreAll(local)
    emit()
  }
  // 2) 올리기 — 이 기기에만 있거나 이 기기 쪽이 나중인 것
  const merged = mergePackStores(cloud, localAll())
  if (!samePackStores(merged, cloud)) await savePacksCloud(ws, merged)
}

function queueSync(ws: string): Promise<void> {
  if (waiting) return chain
  waiting = true
  chain = chain
    .then(() => syncOnce(ws))
    .then(
      () => {
        if (cloudFailed) {
          cloudFailed = false
          emit()
        }
      },
      () => {
        waiting = false
        if (!cloudFailed) {
          cloudFailed = true
          emit()
        }
      },
    )
  return chain
}

/** 마케팅 화면을 열 때 · 돌아올 때 · 인터넷이 다시 될 때 — ws 가 null 이면(팀장 화면 보기 등) 이후 올리지 않는다 */
export function openPackSync(ws: string | null): Promise<void> {
  cloudWs = cloudPacksOn(ws) ? ws : null
  if (!cloudWs) {
    if (cloudFailed) {
      cloudFailed = false
      emit()
    }
    return Promise.resolve()
  }
  return queueSync(cloudWs)
}

/** 서버가 '조금 전에 많이 눌렀어요'(1분 10번)로 막으면 그 갈래만 한 번 다시(1분 뒤) */
export const RATE_RETRY_MS = 65_000

/** 세 갈래 동시에 — 이미 쓰는 중이면 그대로 둔다. headline = 규칙 초안 추천 제목(AI 가 확정 제목을 안 주면 이것) */
export function startPackAi(key: string, context: AssistContext, headline: string, retryMs = RATE_RETRY_MS): void {
  if (isRunning(key)) return
  const choice = readChoice()
  setRun(key, () => ({ parts: { video: 'running', short: 'running', blog: 'running' }, errors: [], storeFull: false }))
  const callPart = (p: (typeof PACK_AI_PARTS)[number], attempt: number) =>
    void callAssist({ requestId: newRequestId(), assistId: p.assistId, page: 'radar', choice, context })
      .then((run) => {
        const s = run.structured
        const got = s ? aiSections(p.part, (p.part === 'video' && s.headline?.trim()) || headline, s.items, s.next ?? []) : {}
        if (!Object.keys(got).length) throw new AssistError('provider_error', 'AI 답을 칸으로 나누지 못했습니다.')
        const prev = packSaved(key)
        const next: PackAiSaved = { at: run.createdAt || new Date().toISOString(), model: run.model, sections: { ...(prev?.sections ?? {}), ...got }, device: deviceNow() }
        memory.set(key, next)
        const kept = writePackStore(key, next)
        setRun(key, (r) => ({ ...r, parts: { ...r.parts, [p.part]: 'done' }, storeFull: r.storeFull || !kept }))
        if (cloudWs) void queueSync(cloudWs)
      })
      .catch((e: unknown) => {
        if (e instanceof AssistError && e.code === 'rate_limited' && attempt === 0) {
          setTimeout(() => callPart(p, 1), retryMs)
          return
        }
        const msg = e instanceof Error ? e.message : '다시 눌러 주세요.'
        setRun(key, (r) => ({ ...r, parts: { ...r.parts, [p.part]: 'error' }, errors: r.errors.includes(msg) ? r.errors : [...r.errors, msg] }))
      })
  for (const p of PACK_AI_PARTS) callPart(p, 0)
}

/** 첫 화면 'AI로 써 둠' — 이번 접속에서 쓴 것 + 이 브라우저에 남긴 것 */
export function packDoneKeys(): Set<string> {
  return new Set([...memory.keys(), ...Object.keys(readPackStore())])
}
