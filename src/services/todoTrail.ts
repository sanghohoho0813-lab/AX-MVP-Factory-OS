/**
 * D-486 미룬 할 일 흔적 — 대표: "밀린 할 일을 [오늘로 바꾸기] 하면 11/2 로 옮겨지고 11/1 에는 아무것도 없었던 것처럼 된다.
 * 최초에 적었던 날짜에도 그대로 표시 — 연한 노랑 · 주황으로 살짝, 보자마자 알 수 있게."
 *
 *  - 할 일을 더 나중 날로 옮길 때(오늘로 · 내일로 · 끌어 옮기기 · 기한 고치기) 떠난 날을 할 일 id 에 적어 둔다.
 *  - 달력은 그 날에 옅은 주황 '흔적' 을 그린다(→ 옮긴 날). 할 일 자체는 하나 그대로(숫자 · 할 일 수에는 안 셈).
 *  - 기억: 이 기기(axmvp.todo.trail — 사람별 금고로 옮겨진다) + 로그인했으면 내 클라우드 설정(본인만 · services/preferences/trailSync).
 *    업무 일기 표는 고치지 않는다(DB 변경 0).
 */
import { useSyncExternalStore } from 'react'
import { readRaw, writeRaw } from '../storage/localStore'
import type { JournalEntry } from '../types/bridge'

export interface TrailItem {
  /** 이 할 일이 있다가 떠난 날들(YYYY-MM-DD, 오래된 것부터) */
  from: string[]
  /** 마지막으로 적은 때(ISO) */
  at: string
}
export type TodoTrail = Record<string, TrailItem>

const KEY = 'axmvp.todo.trail'
export const TRAIL_CHANGED_EVENT = 'axmvp:todo-trail'
const DATE = /^\d{4}-\d{2}-\d{2}$/
/** 할 일 하나에 남기는 흔적 수 — 며칠씩 밀려도 달력이 흔적으로 덮이지 않게 */
const MAX_FROM = 8
/** 이보다 오래 손대지 않은 흔적은 정리한다 */
const KEEP_DAYS = 180

const EMPTY: TodoTrail = {}
let cache: TodoTrail | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function parseTrail(v: unknown): TodoTrail {
  const out: TodoTrail = {}
  if (!v || typeof v !== 'object') return out
  for (const [id, it] of Object.entries(v as Record<string, unknown>)) {
    if (!it || typeof it !== 'object') continue
    const raw = (it as { from?: unknown }).from
    const from = Array.isArray(raw) ? [...new Set(raw.filter((d): d is string => typeof d === 'string' && DATE.test(d)))].sort().slice(-MAX_FROM) : []
    const at = (it as { at?: unknown }).at
    if (from.length) out[id] = { from, at: typeof at === 'string' ? at : '' }
  }
  return out
}

export function readTrail(): TodoTrail {
  if (cache) return cache
  try {
    const raw = readRaw(KEY)
    cache = raw ? parseTrail(JSON.parse(raw)) : EMPTY
  } catch {
    cache = EMPTY
  }
  return cache
}

function writeTrail(next: TodoTrail, quiet = false) {
  cache = next
  try {
    writeRaw(KEY, JSON.stringify(next))
  } catch {
    // 기억만 못 할 뿐 이번 화면에서는 보인다
  }
  emit()
  if (!quiet && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(TRAIL_CHANGED_EVENT))
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === KEY) {
      cache = null
      emit()
    }
  })
}

export function useTodoTrail(): TodoTrail {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    readTrail,
    () => EMPTY,
  )
}

/** 할 일이 지금 놓인 날(기한, 없으면 적은 날) */
export const todoDay = (e: Pick<JournalEntry, 'dueDate' | 'entryDate'>): string => (DATE.test(e.dueDate) ? e.dueDate : e.entryDate)

/**
 * 할 일을 fromDate → toDate 로 옮겼다. 더 나중 날로 옮길 때만 떠난 날을 흔적으로 남긴다.
 * 흔적이 있던 날로 다시 당겨 오면 그 날 흔적은 지운다(그날에 할 일이 있으니까).
 */
export function recordMove(id: string, fromDate: string, toDate: string, now = new Date()): void {
  if (!id || !DATE.test(fromDate) || !DATE.test(toDate) || fromDate === toDate) return
  const cur = readTrail()
  const item = cur[id]
  let from = item ? [...item.from] : []
  if (toDate > fromDate) from.push(fromDate)
  from = [...new Set(from.filter((d) => d !== toDate))].sort().slice(-MAX_FROM)
  const next: TodoTrail = {}
  const cutoff = new Date(now.getTime() - KEEP_DAYS * 86_400_000).toISOString()
  for (const [k, v] of Object.entries(cur)) if (k !== id && v.at >= cutoff) next[k] = v
  if (from.length) next[id] = { from, at: now.toISOString() }
  if (JSON.stringify(next) === JSON.stringify(cur)) return
  writeTrail(next)
}

/** 다른 기기에서 적은 흔적을 이 기기에 */
export function applyTrail(next: TodoTrail): void {
  writeTrail(next, true)
}

/** 두 기기의 흔적 맞추기 — 날짜는 합친다(흔적이 사라지지 않게). toLocal · toCloud: 그쪽에 새로 적어야 하면 true */
export function mergeTrail(local: TodoTrail, cloud: TodoTrail): { merged: TodoTrail; toLocal: boolean; toCloud: boolean } {
  const merged: TodoTrail = {}
  for (const id of new Set([...Object.keys(local), ...Object.keys(cloud)])) {
    const a = local[id]
    const b = cloud[id]
    const from = [...new Set([...(a?.from ?? []), ...(b?.from ?? [])])].sort().slice(-MAX_FROM)
    const at = [a?.at ?? '', b?.at ?? ''].sort().pop() ?? ''
    if (from.length) merged[id] = { from, at }
  }
  const same = (x: TodoTrail) => JSON.stringify(Object.entries(x).sort()) === JSON.stringify(Object.entries(merged).sort())
  return { merged, toLocal: !same(local), toCloud: !same(cloud) }
}

export interface TrailGhost {
  entry: JournalEntry
  /** 지금 놓인 날(옮겨 간 날) */
  movedTo: string
}

/** 날짜 → 그날 하려다 옮긴 할 일(지금 있는 할 일만 · 지금 그날에 놓인 것은 빼고) */
export function ghostsByDate(trail: TodoTrail, entries: readonly JournalEntry[]): Map<string, TrailGhost[]> {
  const map = new Map<string, TrailGhost[]>()
  for (const e of entries) {
    if (e.entryType !== 'follow_up') continue
    const t = trail[e.id]
    if (!t) continue
    const now = todoDay(e)
    for (const d of t.from) {
      if (d === now) continue
      const list = map.get(d)
      const g = { entry: e, movedTo: now }
      if (list) list.push(g)
      else map.set(d, [g])
    }
  }
  return map
}

/** 'M/D' */
export const shortDay = (d: string): string => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
