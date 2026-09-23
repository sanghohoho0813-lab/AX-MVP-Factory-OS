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
import type { ClientOpsRecord } from '../../../types/clientOps'

const MODULE = 'labcare'
const BUCKET = 'orig'

const mem = new Map<string, unknown>()
const rowIdOf = new Map<string, string>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
let workspace: string | null = null
let osClients: ClientOpsRecord[] = []
let hydratedFor: string | null | undefined

export function storeRead<T>(key: string, fallback: T): T {
  const v = mem.get(key)
  return v === undefined || v === null ? fallback : (structuredCloneSafe(v) as T)
}

export function storeWrite<T>(key: string, value: T): void {
  mem.set(key, structuredCloneSafe(value))
  const prev = timers.get(key)
  if (prev) clearTimeout(prev)
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key)
      void persist(key)
    }, 250),
  )
}

export function storeRemove(key: string): void {
  mem.delete(key)
  storeWrite(key, null)
}

export function storeKeys(): string[] {
  return [...mem.keys()].filter((k) => mem.get(k) !== null)
}

async function persist(key: string): Promise<void> {
  try {
    const row = await saveRow(workspace, MODULE, BUCKET, { id: rowIdOf.get(key), clientId: '', data: { key, value: mem.get(key) ?? null } })
    rowIdOf.set(key, row.id)
  } catch {
    /* 저장 실패는 다음 쓰기 때 다시 시도된다 */
  }
}

/** 남은 쓰기를 바로 내보낸다 (백업·화면 떠나기 전에) */
export async function flushLabStore(): Promise<void> {
  const keys = [...timers.keys()]
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
  if (hydratedFor === input.workspaceId && mem.size > 0) return
  workspace = input.workspaceId
  mem.clear()
  rowIdOf.clear()
  const rows = await listRows(workspace, MODULE, BUCKET)
  for (const r of rows) {
    const key = typeof r.data.key === 'string' ? r.data.key : ''
    if (!key) continue
    rowIdOf.set(key, r.id)
    if (r.data.value !== null && r.data.value !== undefined) mem.set(key, r.data.value)
  }
  hydratedFor = workspace
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
  for (const [k, v] of Object.entries(entries)) mem.set(k, v)
  osClients = clients
  hydratedFor = undefined
}
