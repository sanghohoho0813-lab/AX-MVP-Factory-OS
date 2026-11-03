/**
 * D-259 · D-260 영상 대본 받아 적기 · 우리 회사 버전 — 부르기 · 진행 상태를 화면 밖(이 모듈)에 둔다.
 * 영상 창을 닫았다 다시 열어도(같은 접속) 받는 중 · 받은 구간이 그대로 보이고, 닫은 사이에 온 답도 저장된다.
 * D-516 작업공간 기록에도 — 다른 기기에서 같은 영상을 열면 다시 받아 적지 않고 그 대본 · 우리 버전이 보인다.
 *   대본: 영상 하나가 길어(2시간 · 구간마다 줄 수백) 영상마다 한 줄(marketing / transcript_<영상>) + 목록 한 줄(marketing / transcripts · 시각만).
 *   우리 버전: 한 줄(marketing / adapts) — 콘텐츠 묶음 · 이렇게 찍으세요와 같은 길(keyedSync).
 *   [처음부터 다시 받기] 는 빈 대본(더 나중 시각)으로 남긴다 — 다른 기기의 옛 대본이 되살아나지 않게(지우지 않는다).
 */
import { AssistError, callAssist, type AssistAnswer } from '../aiAssist/client'
import { newRequestId, readChoice } from '../aiAssist/store'
import type { AssistContext } from '../aiAssist/context'
import { listRows, saveRow } from '../moduleData'
import { cloudKeyedOn, deviceNow, keyedCloudSync, keyedRowId, loadKeyed, mergeKeyed, saveKeyed, type KeyedRowSpec } from './keyedSync'
import {
  ADAPT_KEY,
  STUDY_KEEP,
  TRANSCRIPT_KEY,
  TRANSCRIPT_PARALLEL,
  adaptsOf,
  canTranscribe,
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
  const doc: TranscriptDoc = { id, title: base.title, duration: base.duration, at: new Date().toISOString(), model: model || prev?.model || '', parts, device: deviceNow() }
  memT.set(id, doc)
  const kept = writeStore(TRANSCRIPT_KEY, keepLatest(readStore(TRANSCRIPT_KEY, parseTranscripts), id, doc))
  if (!kept) setRun(id, (r) => ({ ...r, storeFull: true }))
  pushStudy()
}

/* ------------------------------------------------------------------ */
/* D-516 클라우드 — 다른 기기에서 받은 대본 · 만든 우리 버전 가져오기 · 올리기       */
/* ------------------------------------------------------------------ */

/** 우리 버전 한 줄 — 콘텐츠 묶음 · 이렇게 찍으세요와 같은 길 */
export const ADAPT_ROW: KeyedRowSpec<AdaptSaved> = { module: 'marketing', bucket: 'adapts', rowPrefix: 'mkadapts_', field: 'adapts', max: STUDY_KEEP, parse: adaptsOf }

const adaptCloud = keyedCloudSync<AdaptSaved>({
  ...ADAPT_ROW,
  local: () => mergeKeyed(readStore(ADAPT_KEY, parseAdapts), Object.fromEntries(memA), STUDY_KEEP),
  running: () => new Set([...runs].filter(([, r]) => r.adapting).map(([id]) => id)),
  adopt: (next, keys) => {
    for (const k of keys) memA.set(k, next[k])
    writeStore(ADAPT_KEY, next)
  },
  changed: emit,
})

/** 대본 목록 한 줄 — 영상마다 마지막으로 받은 시각만(글은 영상마다 따로) */
export interface TranscriptIndex {
  at: string
  title: string
  /** 받은 구간 수(0 = 처음부터 다시 받기로 비운 대본) */
  parts: number
}
export function transcriptIndexOf(v: unknown): Record<string, TranscriptIndex> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, TranscriptIndex> = {}
  for (const [id, x0] of Object.entries(v as Record<string, unknown>)) {
    const x = x0 as Record<string, unknown>
    if (!canTranscribe(id) || !x || typeof x.at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(x.at)) continue
    out[id] = { at: x.at, title: typeof x.title === 'string' ? x.title.slice(0, 200) : '', parts: Number.isInteger(x.parts) ? Number(x.parts) : 0 }
  }
  return out
}
export const TRANSCRIPT_INDEX_ROW: KeyedRowSpec<TranscriptIndex> = { module: 'marketing', bucket: 'transcripts', rowPrefix: 'mkvsidx_', field: 'videos', max: STUDY_KEEP, parse: transcriptIndexOf }

/** 영상마다 한 줄 — 칸(bucket)을 영상마다 나눠 열 때 그 영상 글만 읽는다 */
export const transcriptBucket = (id: string) => `transcript_${id}`
export const transcriptRowId = (ws: string | null, id: string) => keyedRowId(`mkvs_${id}_`, ws)

async function loadTranscriptCloud(ws: string, id: string): Promise<TranscriptDoc | null> {
  const rows = await listRows(ws, 'marketing', transcriptBucket(id))
  const row = rows.find((r) => r.id === transcriptRowId(ws, id))
  if (!row) return null
  return parseTranscripts(JSON.stringify({ [id]: (row.data as { doc?: unknown }).doc ?? null }))[id] ?? null
}
async function saveTranscriptCloud(ws: string, doc: TranscriptDoc): Promise<void> {
  await saveRow(ws, 'marketing', transcriptBucket(doc.id), { id: transcriptRowId(ws, doc.id), data: { doc } as unknown as Record<string, unknown> })
}

/** 이 기기 전부 — 이번 접속에서 받은 것 + 이 브라우저에 남긴 것(같은 영상은 더 나중 것) */
function localDocs(): Record<string, TranscriptDoc> {
  const all = readStore(TRANSCRIPT_KEY, parseTranscripts)
  for (const [k, v] of memT) if (!all[k] || v.at >= all[k].at) all[k] = v
  return all
}

let studyWs: string | null = null
let tFailed = false
let tChain: Promise<void> = Promise.resolve()
let tWaiting = false

const setTFailed = (v: boolean) => {
  if (tFailed === v) return
  tFailed = v
  emit()
}

async function transcriptsOnce(ws: string): Promise<void> {
  tWaiting = false
  const idx = await loadKeyed(ws, TRANSCRIPT_INDEX_ROW)
  const busy = new Set([...runs].filter(([, r]) => r.running > 0).map(([id]) => id))
  // 1) 가져오기 — 클라우드 쪽이 더 나중인 영상만 그 영상 줄을 읽는다(받는 중인 영상은 빼고)
  let adopted = false
  for (const [id, e] of Object.entries(idx)) {
    if (busy.has(id)) continue
    const mine = localDocs()[id]
    if (mine && mine.at >= e.at) continue
    const doc = await loadTranscriptCloud(ws, id)
    if (!doc || (mine && doc.at <= mine.at) || busy.has(id)) continue
    memT.set(id, doc)
    writeStore(TRANSCRIPT_KEY, keepLatest(readStore(TRANSCRIPT_KEY, parseTranscripts), id, doc))
    adopted = true
  }
  if (adopted) emit()
  // 2) 올리기 — 이 기기에만 있거나 이 기기 쪽이 나중인 영상(최근 STUDY_KEEP 개만)
  const mine = Object.values(localDocs())
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, STUDY_KEEP)
  const next: Record<string, TranscriptIndex> = { ...idx }
  let changed = false
  for (const d of mine) {
    const e = idx[d.id]
    if (!/^\d{4}-\d{2}-\d{2}T/.test(d.at) || (e && e.at >= d.at)) continue
    await saveTranscriptCloud(ws, d)
    next[d.id] = { at: d.at, title: d.title, parts: d.parts.filter((p) => p.status === 'done').length }
    changed = true
  }
  if (changed) await saveKeyed(ws, TRANSCRIPT_INDEX_ROW, mergeKeyed({}, next, STUDY_KEEP))
}

function queueTranscripts(ws: string): Promise<void> {
  if (tWaiting) return tChain
  tWaiting = true
  tChain = tChain
    .then(() => transcriptsOnce(ws))
    .then(
      () => setTFailed(false),
      () => {
        tWaiting = false
        setTFailed(true)
      },
    )
  return tChain
}

/** 새 대본 구간 · 우리 버전이 생겼을 때 — 열린 작업공간이 있을 때만 */
function pushStudy(): void {
  if (studyWs) void queueTranscripts(studyWs)
}

/** 마케팅 화면을 열 때 · 돌아올 때 · 인터넷이 다시 될 때 — ws 가 null 이면(팀장 화면 보기 등) 이후 올리지 않는다 */
export function openStudySync(ws: string | null): Promise<void> {
  studyWs = cloudKeyedOn(ws) ? ws : null
  if (!studyWs) {
    setTFailed(false)
    return adaptCloud.open(null)
  }
  return Promise.all([queueTranscripts(studyWs), adaptCloud.open(studyWs)]).then(() => undefined)
}

/** 클라우드에 올리지 못한 채 이 기기에만 있음(연결되면 다시) */
export const studyCloudFailed = () => tFailed || adaptCloud.failed()

const TRANSCRIPT_MESSAGE: Record<string, string> = {
  provider_rejected: '이 영상은 받아 적지 못했어요 — 비공개 · 연령 제한 · 실시간 방송이거나 너무 길 수 있어요. 유튜브에서 직접 확인해 주세요.',
  provider_unreachable: '이 구간은 시간이 오래 걸려 멈췄어요 — [못 받은 구간 다시] 를 눌러 주세요.',
  rate_limited: '한꺼번에 너무 많이 불러 잠시 막혔어요 — 1분 뒤 [못 받은 구간 다시] 를 눌러 주세요.',
}

/** 서버가 '조금 전에 많이 눌렀어요'(1분 10번)로 막으면 그 구간만 한 번 다시(1분 뒤) */
export const STUDY_RATE_RETRY_MS = 65_000

/** 대본 받아 적기 — 받을 구간만(only) 또는 아직 못 받은 구간 전부 · 세 구간씩 동시에 */
export function startTranscript(v: { id: string; title: string; durationSec: number }, context: AssistContext, only?: readonly Segment[], rateRetryMs = STUDY_RATE_RETRY_MS): void {
  if (studyRun(v.id).running > 0) return
  const have = transcriptOf(v.id)
  const all = transcriptSegments(v.durationSec)
  const todo = (only ?? all).filter((s) => !have?.parts.some((p) => p.start === s.start && p.status === 'done'))
  if (!todo.length) return
  const base = { title: v.title, duration: v.durationSec }
  const choice = readChoice()
  setRun(v.id, (r) => ({ ...r, running: todo.length, total: todo.length }))
  const queue = [...todo]
  const call = (seg: Segment) => callAssist({ requestId: newRequestId(), assistId: 'radar.transcript', page: 'radar', choice, context, video: { id: v.id, start: seg.start, end: seg.end } })
  // 서버가 '1분 10번' 으로 막으면(긴 영상 · 셋 동시에) 그 구간만 1분 뒤 한 번 더
  const callOnce = (seg: Segment) =>
    call(seg).catch((e: unknown) => {
      if (!(e instanceof AssistError) || e.code !== 'rate_limited') throw e
      return new Promise<void>((ok) => setTimeout(ok, rateRetryMs)).then(() => call(seg))
    })
  const next = (): Promise<void> => {
    const seg = queue.shift()
    if (!seg) return Promise.resolve()
    return callOnce(seg)
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

/** 다시 받기 — 남긴 대본을 비우고 처음부터(D-516 빈 대본을 더 나중 시각으로 남긴다 — 다른 기기의 옛 대본이 되살아나지 않게) */
export function resetTranscript(id: string): void {
  const prev = transcriptOf(id)
  const empty: TranscriptDoc = { id, title: prev?.title ?? '', duration: prev?.duration ?? 0, at: new Date().toISOString(), model: '', parts: [], device: deviceNow() }
  memT.set(id, empty)
  writeStore(TRANSCRIPT_KEY, keepLatest(readStore(TRANSCRIPT_KEY, parseTranscripts), id, empty))
  emit()
  pushStudy()
}

/** 우리 회사 버전 만들기 — 고른 모델 그대로(대표 지시: 모델 고르기) */
export function startAdapt(id: string, context: AssistContext, withTranscript: boolean): Promise<AssistAnswer | null> {
  if (studyRun(id).adapting) return Promise.resolve(null)
  setRun(id, (r) => ({ ...r, adapting: true, adaptError: '' }))
  return callAssist({ requestId: newRequestId(), assistId: 'radar.adapt', page: 'radar', choice: readChoice(), context })
    .then((run) => {
      const a = run.structured
      if (!a || !a.items.length) throw new AssistError('provider_error', 'AI 답을 칸으로 나누지 못했어요 — 다시 눌러 주세요.')
      const saved: AdaptSaved = { at: run.createdAt || new Date().toISOString(), model: run.model, answer: a, withTranscript, device: deviceNow() }
      memA.set(id, saved)
      const kept = writeStore(ADAPT_KEY, keepLatest(readStore(ADAPT_KEY, parseAdapts), id, saved))
      setRun(id, (r) => ({ ...r, adapting: false, storeFull: r.storeFull || !kept }))
      adaptCloud.push()
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
