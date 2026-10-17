/**
 * 원본 연구소 OS 저장소 자리 (D-92).
 *
 * 원본(lib/storage.ts)은 모든 기록을 `read(key)` · `write(key)` 두 함수로 localStorage 에 넣었다.
 * 화면 코드는 그대로 두고, 이 두 함수만 여기로 돌린다:
 *   - 읽기는 메모리에서 바로 (원본처럼 동기로)
 *   - 쓰기는 메모리에 넣고, 뒤에서 모듈 기록(`moduleData` · `labcare/orig`)에 저장 — 클라우드면 다른 기기에서도 보인다
 * 연구소 화면을 열기 전에 `hydrateLabStore()` 가 한 번 다 읽어 온다.
 *
 * 업체(고객사)는 이 OS 의 고객 운영 업체다. 원본 고객사 기록에는 연구소 쪽 칸(유형·인정일·연구원 수…)만 남기고,
 * 회사명·대표자·주소·설립일은 고객 운영 기록을 그대로 비춘다(`osClientOf`).
 */

import { listRows, saveRow } from '../../../services/moduleData'
import { generateId } from '../../../storage/localStore'
import type { ClientOpsRecord } from '../../../types/clientOps'
import { isKeyedList, mergeKeyedList } from './mergeList'

const MODULE = 'labcare'
const BUCKET = 'orig'

const mem = new Map<string, unknown>()
const rowIdOf = new Map<string, string>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
/** D-217: 이 창이 처음 읽어 온 값 · 이 창이 본 id — 저장 직전 합치기의 기준 */
const snap = new Map<string, unknown>()
const seen = new Map<string, Set<string>>()
let workspace: string | null = null
let osClients: ClientOpsRecord[] = []
let hydratedFor: string | null | undefined
let hydratedAt = 0
/** 같은 화면을 다시 열 때 이만큼 지났으면(그리고 내보낼 쓰기가 없으면) 서버에서 새로 읽는다 */
const REFRESH_MS = 60_000
/** D-224 저장하지 못한 칸 — 예전에는 실패를 삼키고 같은 칸을 또 적을 때만 다시 저장해, 1분 뒤 다시 열면 메모리를 새로 읽어 적은 것이 사라졌다 */
const failed = new Map<string, number>()
const inflight = new Map<string, Promise<void>>()
const SAVE_EVENT = 'labcare:save-state'
const RETRY_MS = [3_000, 10_000, 30_000, 60_000]

function emitSaveState(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SAVE_EVENT))
}

/** 저장하지 못해 다시 시도 중인 칸 수 — 화면 위 안내에 쓴다 */
export function labUnsavedCount(): number {
  return failed.size
}

export function subscribeLabSave(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(SAVE_EVENT, cb)
  return () => window.removeEventListener(SAVE_EVENT, cb)
}

function schedule(key: string, ms: number): void {
  const prev = timers.get(key)
  if (prev) clearTimeout(prev)
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key)
      void persist(key)
    }, ms),
  )
}

function noteSeen(key: string, value: unknown): void {
  if (!isKeyedList(value)) return
  const s = seen.get(key) ?? new Set<string>()
  for (const x of value) s.add(x.id)
  seen.set(key, s)
}

export function storeRead<T>(key: string, fallback: T): T {
  const v = mem.get(key)
  return v === undefined || v === null ? fallback : (structuredCloneSafe(v) as T)
}

export function storeWrite<T>(key: string, value: T): void {
  mem.set(key, structuredCloneSafe(value))
  noteSeen(key, value)
  schedule(key, 250)
}

export function storeRemove(key: string): void {
  mem.delete(key)
  storeWrite(key, null)
}

export function storeKeys(): string[] {
  return [...mem.keys()].filter((k) => mem.get(k) !== null)
}

/** 저장 직전 서버 줄 — 이 창의 줄, 없으면 같은 칸의 다른 줄. 못 읽으면 undefined(그때는 예전처럼 이 창 값으로 저장) */
async function remoteRow(key: string, id: string): Promise<{ id: string; value: unknown } | null | undefined> {
  try {
    const rows = await listRows(workspace, MODULE, BUCKET)
    const row = rows.find((r) => r.id === id) ?? rows.find((r) => r.data.key === key)
    return row ? { id: row.id, value: row.data.value ?? null } : null
  } catch {
    return undefined
  }
}

/** 같은 칸 저장은 차례대로 — 앞 저장이 서버 값을 읽는 사이 뒤 저장이 끼어들어 서로 덮지 않게 */
function persist(key: string): Promise<void> {
  const run = (inflight.get(key) ?? Promise.resolve()).then(() => persistNow(key))
  inflight.set(key, run)
  void run.finally(() => {
    if (inflight.get(key) === run) inflight.delete(key)
  })
  return run
}

async function persistNow(key: string): Promise<void> {
  try {
    // D-165: 줄 id 를 저장 전에 정한다 — 첫 저장이 돌아오기 전에 또 저장하면 줄이 둘 생겼다
    let id = rowIdOf.get(key) ?? generateId()
    rowIdOf.set(key, id)
    let value: unknown = mem.get(key) ?? null
    // D-217: 그 사이 다른 창 · 기기가 저장했으면 id 로 합친다(이 창이 지운 것은 살리지 않음)
    // 연구소 기록은 늘 이 저장소 함수가 메모리를 읽고 고쳐 쓰므로, 메모리에 합쳐 넣은 기록은 이 창 화면도 그대로 쓴다
    if (isKeyedList(value)) {
      const remote = await remoteRow(key, id)
      if (remote) {
        // 다른 창이 먼저 만든 줄이면 그 줄에 — 같은 칸이 두 줄로 갈라져 서로의 저장을 못 보는 일이 없게
        if (remote.id !== id) {
          id = remote.id
          rowIdOf.set(key, id)
        }
        const s = seen.get(key) ?? new Set<string>()
        value = mergeKeyedList(snap.get(key), value, remote.value, s)
        // 저장을 기다리는 동안 이 창에서 또 적었으면 그것도 합친 값 위에 — 다음 저장이 다른 곳의 기록을 지우지 않게
        mem.set(key, structuredCloneSafe(mergeKeyedList(snap.get(key), mem.get(key) ?? null, remote.value, s)))
      }
    }
    await saveRow(workspace, MODULE, BUCKET, { id, clientId: '', data: { key, value } })
    // 저장한 값이 이제 서버 값 — 다음 저장은 이것을 기준으로(다른 곳에서 지운 기록이 이 창의 다음 저장으로 되살아나지 않게)
    snap.set(key, structuredCloneSafe(value))
    noteSeen(key, value)
    if (failed.delete(key)) emitSaveState()
  } catch {
    // 메모리 값은 그대로 두고 조금 뒤 다시 — 다시 시도 타이머가 있는 동안에는 화면을 다시 열어도 메모리를 지킨다
    const n = failed.get(key) ?? 0
    failed.set(key, n + 1)
    if (!timers.has(key)) schedule(key, RETRY_MS[Math.min(n, RETRY_MS.length - 1)])
    emitSaveState()
  }
}

/** 남은 쓰기를 바로 내보낸다 (백업·화면 떠나기 전에) */
export async function flushLabStore(): Promise<void> {
  const keys = [...new Set([...timers.keys(), ...failed.keys()])]
  for (const k of keys) {
    clearTimeout(timers.get(k))
    timers.delete(k)
  }
  await Promise.all(keys.map((k) => persist(k)))
}

function structuredCloneSafe<T>(v: T): T {
  if (v === undefined || v === null || typeof v !== 'object') return v
  try {
    return JSON.parse(JSON.stringify(v)) as T
  } catch {
    return v
  }
}

/** 고객 운영 업체 목록 (연구소 고객사가 비춰 보는 원본) */
export function osClientList(): ClientOpsRecord[] {
  return osClients
}
export function osClientOf(id: string): ClientOpsRecord | undefined {
  return osClients.find((c) => c.id === id)
}

export interface HydrateInput {
  workspaceId: string | null
  clients: ClientOpsRecord[]
  /** D-91 모듈 기록 — 처음 한 번 원본 모양으로 옮겨 온다 */
  legacy?: () => Promise<Record<string, unknown>>
}

/** 연구소 화면을 열기 전에 한 번 */
export async function hydrateLabStore(input: HydrateInput): Promise<void> {
  osClients = input.clients
  // D-217: 같은 화면을 다시 열면 1분이 지났고 내보낼 쓰기가 없을 때 새로 읽는다(예전: 한 번 읽으면 창을 닫을 때까지 옛 값)
  // D-224 저장 못 한 칸이 있거나 저장 중이면 메모리를 지킨다(새로 읽으면 그 기록이 사라진다)
  const pending = () => timers.size > 0 || failed.size > 0 || inflight.size > 0
  if (hydratedFor === input.workspaceId && mem.size > 0 && (pending() || Date.now() - hydratedAt < REFRESH_MS)) return
  workspace = input.workspaceId
  const rows = await listRows(workspace, MODULE, BUCKET)
  if (pending() && hydratedFor === input.workspaceId && mem.size > 0) return // 읽는 사이 적은 것이 있으면 지금 메모리를 지킨다
  mem.clear()
  rowIdOf.clear()
  snap.clear()
  seen.clear()
  for (const r of rows) {
    const key = typeof r.data.key === 'string' ? r.data.key : ''
    // 새것부터 온다 — 같은 칸이 둘이면(예전 겹친 줄) 새것을 쓴다
    if (!key || rowIdOf.has(key)) continue
    rowIdOf.set(key, r.id)
    if (r.data.value !== null && r.data.value !== undefined) {
      mem.set(key, r.data.value)
      snap.set(key, structuredCloneSafe(r.data.value))
      noteSeen(key, r.data.value)
    }
  }
  hydratedFor = workspace
  hydratedAt = Date.now()
  if (input.legacy && !mem.has('pmsaas:migrated:d91')) {
    try {
      const moved = await input.legacy()
      for (const [k, v] of Object.entries(moved)) {
        const cur = storeRead<unknown[]>(k, [])
        if (Array.isArray(v) && Array.isArray(cur) && cur.length === 0) storeWrite(k, v)
      }
    } catch {
      /* 옮기지 못해도 화면은 선다 */
    }
    storeWrite('pmsaas:migrated:d91', true)
  }
}

/** 시험·백업 되돌리기용 — 메모리를 통째로 갈아끼운다 */
export function resetLabStoreForTest(entries: Record<string, unknown>, clients: ClientOpsRecord[] = []): void {
  mem.clear()
  failed.clear()
  for (const [k, v] of Object.entries(entries)) mem.set(k, v)
  osClients = clients
  hydratedFor = undefined
}
