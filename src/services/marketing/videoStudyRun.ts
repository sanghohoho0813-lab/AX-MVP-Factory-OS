/**
 * D-259 · D-260 영상 대본 받아 적기 · 우리 회사 버전 — 부르기 · 진행 상태를 화면 밖(이 모듈)에 둔다.
 * 영상 창을 닫았다 다시 열어도(같은 접속) 받는 중 · 받은 구간이 그대로 보이고, 닫은 사이에 온 답도 저장된다.
 */
import { AssistError, callAssist, type AssistAnswer } from '../aiAssist/client'
import { newRequestId, readChoice } from '../aiAssist/store'
import type { AssistContext } from '../aiAssist/context'
import {
  ADAPT_KEY,
  TRANSCRIPT_KEY,
  TRANSCRIPT_PARALLEL,
  keepLatest,
  parseAdapts,
  parseTranscripts,
  partLines,
  transcriptSegments,
  type AdaptSaved,
  type Segment,
  type TranscriptDoc,
  type TranscriptPart,
} from './videoStudy'

export interface StudyRun {
  /** 대본: 받는 중인 구간 수 · 이번에 부른 구간 수 */
  running: number
  total: number
  /** 우리 버전 쓰는 중 */
  adapting: boolean
  adaptError: string
  /** 이 브라우저에 남기지 못함(이번 접속 동안은 보임) */
  storeFull: boolean
}

const IDLE: StudyRun = { running: 0, total: 0, adapting: false, adaptError: '', storeFull: false }
const runs = new Map<string, StudyRun>()
const memT = new Map<string, TranscriptDoc>()
const memA = new Map<string, AdaptSaved>()
const subs = new Set<() => void>()
let version = 0
const emit = () => {
  version += 1
  for (const f of subs) f()
}
const setRun = (id: string, fn: (r: StudyRun) => StudyRun) => {
  runs.set(id, fn(runs.get(id) ?? IDLE))
  emit()
}

export function subscribeStudy(f: () => void): () => void {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
export const studyVersion = () => version
export const studyRun = (id: string): StudyRun => runs.get(id) ?? IDLE

function readStore<T>(key: string, parse: (raw: string | null) => Record<string, T>): Record<string, T> {
  try {
    return parse(localStorage.getItem(key))
  } catch {
    return {}
  }
}
function writeStore(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function transcriptOf(id: string): TranscriptDoc | null {
  return memT.get(id) ?? readStore(TRANSCRIPT_KEY, parseTranscripts)[id] ?? null
}
export function adaptOf(id: string): AdaptSaved | null {
  return memA.get(id) ?? readStore(ADAPT_KEY, parseAdapts)[id] ?? null
}

/** 구간 하나를 넣는다(같은 구간은 바꿈) · 저장 */
function putPart(id: string, base: { title: string; duration: number }, part: TranscriptPart, model: string) {
  const prev = transcriptOf(id)
  const parts = [...(prev?.parts ?? []).filter((p) => p.start !== part.start), part].sort((a, b) => a.start - b.start)
  const doc: TranscriptDoc = { id, title: base.title, duration: base.duration, at: new Date().toISOString(), model: model || prev?.model || '', parts }
  memT.set(id, doc)
  const kept = writeStore(TRANSCRIPT_KEY, keepLatest(readStore(TRANSCRIPT_KEY, parseTranscripts), id, doc))
  if (!kept) setRun(id, (r) => ({ ...r, storeFull: true }))
}

const TRANSCRIPT_MESSAGE: Record<string, string> = {
  provider_rejected: '이 영상은 받아 적지 못했어요 — 비공개 · 연령 제한 · 실시간 방송이거나 너무 길 수 있어요. 유튜브에서 직접 확인해 주세요.',
  provider_unreachable: '이 구간은 시간이 오래 걸려 멈췄어요 — [못 받은 구간 다시] 를 눌러 주세요.',
}

/** 대본 받아 적기 — 받을 구간만(only) 또는 아직 못 받은 구간 전부 · 세 구간씩 동시에 */
export function startTranscript(v: { id: string; title: string; durationSec: number }, context: AssistContext, only?: readonly Segment[]): void {
  if (studyRun(v.id).running > 0) return
  const have = transcriptOf(v.id)
  const all = transcriptSegments(v.durationSec)
  const todo = (only ?? all).filter((s) => !have?.parts.some((p) => p.start === s.start && p.status === 'done'))
  if (!todo.length) return
  const base = { title: v.title, duration: v.durationSec }
  const choice = readChoice()
  setRun(v.id, (r) => ({ ...r, running: todo.length, total: todo.length }))
  const queue = [...todo]
  const next = (): Promise<void> => {
    const seg = queue.shift()
    if (!seg) return Promise.resolve()
    return callAssist({ requestId: newRequestId(), assistId: 'radar.transcript', page: 'radar', choice, context, video: { id: v.id, start: seg.start, end: seg.end } })
      .then((run) => {
        const s = run.structured
        const lines = partLines(s?.items, seg)
        if (!lines.length && !s?.headline) throw new AssistError('provider_error', '이 구간에서 말을 찾지 못했어요.')
        putPart(v.id, base, { ...seg, status: 'done', lines, headline: s?.headline || undefined }, run.model)
      })
      .catch((e: unknown) => {
        const code = e instanceof AssistError ? e.code : ''
        const msg = TRANSCRIPT_MESSAGE[code] ?? (e instanceof Error && e.message ? e.message : '받지 못했어요 — 다시 눌러 주세요.')
        putPart(v.id, base, { ...seg, status: 'error', lines: [], error: msg }, '')
      })
      .finally(() => setRun(v.id, (r) => ({ ...r, running: Math.max(0, r.running - 1) })))
      .then(next)
  }
  for (let k = 0; k < Math.min(TRANSCRIPT_PARALLEL, todo.length); k++) void next()
}

/** 다시 받기 — 남긴 대본을 비우고 처음부터 */
export function resetTranscript(id: string): void {
  memT.delete(id)
  const all = readStore(TRANSCRIPT_KEY, parseTranscripts)
  delete all[id]
  writeStore(TRANSCRIPT_KEY, all)
  emit()
}

/** 우리 회사 버전 만들기 — 고른 모델 그대로(대표 지시: 모델 고르기) */
export function startAdapt(id: string, context: AssistContext, withTranscript: boolean): Promise<AssistAnswer | null> {
  if (studyRun(id).adapting) return Promise.resolve(null)
  setRun(id, (r) => ({ ...r, adapting: true, adaptError: '' }))
  return callAssist({ requestId: newRequestId(), assistId: 'radar.adapt', page: 'radar', choice: readChoice(), context })
    .then((run) => {
      const a = run.structured
      if (!a || !a.items.length) throw new AssistError('provider_error', 'AI 답을 칸으로 나누지 못했어요 — 다시 눌러 주세요.')
      const saved: AdaptSaved = { at: run.createdAt || new Date().toISOString(), model: run.model, answer: a, withTranscript }
      memA.set(id, saved)
      const kept = writeStore(ADAPT_KEY, keepLatest(readStore(ADAPT_KEY, parseAdapts), id, saved))
      setRun(id, (r) => ({ ...r, adapting: false, storeFull: r.storeFull || !kept }))
      return a
    })
    .catch((e: unknown) => {
      setRun(id, (r) => ({ ...r, adapting: false, adaptError: e instanceof Error && e.message ? e.message : '다시 눌러 주세요.' }))
      return null
    })
}

/** 시험용 */
export function __resetStudy(): void {
  runs.clear()
  memT.clear()
  memA.clear()
  emit()
}
