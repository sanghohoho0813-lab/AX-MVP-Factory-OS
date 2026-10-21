/**
 * D-251 콘텐츠 묶음 AI — 세 갈래를 동시에 부르고, 진행 상태 · 결과를 화면 밖(이 모듈)에 둔다.
 * 묶음 화면을 나갔다 들어와도(같은 접속) 쓰는 중 · 다 씀 · 실패가 그대로 보이고, 나간 사이에 온 답도 바로 보인다.
 * 결과는 이 브라우저(packStore · 사람별 금고)에도 남긴다 — 저장이 막혀도 이번 접속 동안은 메모리에 있다.
 */
import { AssistError, callAssist } from '../aiAssist/client'
import { newRequestId, readChoice } from '../aiAssist/store'
import type { AssistContext } from '../aiAssist/context'
import { PACK_AI_PARTS, aiSections, type PackAiPart, type PackAiSaved } from './contentPack'
import { readPackStore, writePackStore } from './packStore'

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
/** 이번 접속에서 저절로 불러 본 키워드 — 실패해도 열 때마다 다시 부르지 않게 */
const autoTried = new Set<string>()
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

/** 처음 여는 키워드면 한 번만 true(대표 · 결과 없음 · 이번 접속에서 처음) */
export function takeAutoRun(key: string): boolean {
  if (autoTried.has(key) || packSaved(key)) return false
  autoTried.add(key)
  return true
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
        const next: PackAiSaved = { at: run.createdAt || new Date().toISOString(), model: run.model, sections: { ...(prev?.sections ?? {}), ...got } }
        memory.set(key, next)
        const kept = writePackStore(key, next)
        setRun(key, (r) => ({ ...r, parts: { ...r.parts, [p.part]: 'done' }, storeFull: r.storeFull || !kept }))
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
