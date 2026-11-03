/**
 * D-515 키별 AI 결과를 작업공간 기록 한 줄로 — 다른 기기에서도 그대로(다시 부르지 않게).
 * D-514(콘텐츠 묶음 · packSync)에서 쓴 길을 한 곳으로 모았다 — 묶음 결과 · '이렇게 찍으세요' AI 추천이 같이 쓴다.
 *
 *  - 작업공간 기록(module_data) 한 줄에 키별 결과를 최근 max 개만(이 브라우저와 같은 한도) — 새 표 없음(DB 변경 없음).
 *  - 맞추기: 같은 키는 더 나중에 쓴 것(at)이 이긴다. 클라우드 쪽이 나중이면 이 브라우저로 가져오고(지금 쓰는 중인 키는 빼고),
 *    이 브라우저에만 있던(또는 더 나중) 결과는 올린다. 같으면 다시 올리지 않는다.
 *  - 차례차례 — 늦게 간 저장이 새 것을 덮지 않게. 기다리는 맞추기는 하나만(시작할 때 가장 새 결과를 읽는다).
 * 규칙 계산 — AI 아님. 브라우저 저장 모드(클라우드 아님) · 팀장 화면 보기(부르는 쪽이 null)에서는 올리지 않는다.
 */
import { listRows, saveRow } from '../moduleData'
import { getDataModeConfig } from '../../data/dataMode'

export interface Stamped {
  /** 마지막으로 쓴 시각(ISO) */
  at: string
}
export type KeyedStore<T> = Record<string, T>

const wsTag = (ws: string | null) => (ws ?? 'local').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40) || 'local'
/** 작업공간마다 한 줄 — 행 id 에 작업공간을 넣어 다른 작업공간과 겹치지 않게 */
export const keyedRowId = (prefix: string, ws: string | null): string => `${prefix}${wsTag(ws)}`

/** 지금 이 기기 — 결과에 남겨 다른 기기에서 'PC에서 씀' 으로 보이게(폭 640 미만 = 휴대폰) */
export const deviceNow = (): 'pc' | 'phone' => (typeof window !== 'undefined' && window.innerWidth < 640 ? 'phone' : 'pc')

/** 다른 기기에서 쓴 결과면 한마디 — 같은 기기 · 모르면 아무것도 */
export function otherDeviceNote(device: 'pc' | 'phone' | undefined): string {
  if (!device || typeof window === 'undefined') return ''
  return device === deviceNow() ? '' : device === 'phone' ? '휴대폰에서 씀' : 'PC에서 씀'
}

/** 클라우드에 올릴 수 있는가 — 클라우드 모드 · 작업공간이 있을 때만 */
export function cloudKeyedOn(ws: string | null | undefined): ws is string {
  return !!ws && getDataModeConfig().mode === 'supabase'
}

/* ------------------------------------------------------------------ */
/* 맞추기 — 순수 함수                                                     */
/* ------------------------------------------------------------------ */

/** 두 곳을 합친다 — 같은 키는 더 나중에 쓴 것 · 최근 max 개만 */
export function mergeKeyed<T extends Stamped>(a: KeyedStore<T>, b: KeyedStore<T>, max: number): KeyedStore<T> {
  const out: KeyedStore<T> = { ...a }
  for (const [k, v] of Object.entries(b)) {
    const had = out[k]
    if (!had || v.at > had.at) out[k] = v
  }
  return Object.fromEntries(
    Object.entries(out)
      .sort((x, y) => y[1].at.localeCompare(x[1].at))
      .slice(0, max),
  )
}

/** 같은 키 · 같은 표지(기본: 시각)면 같은 것으로 본다 — 글을 통째로 비교하지 않는다(시각은 AI 답마다 새로) */
export function sameKeyed<T extends Stamped>(a: KeyedStore<T>, b: KeyedStore<T>, sig: (x: T) => string = (x) => x.at): boolean {
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every((k) => !!b[k] && sig(b[k]) === sig(a[k]))
}

/**
 * 클라우드에서 가져올 것 — 이 브라우저에 없거나 클라우드 쪽이 더 나중인 키(지금 쓰는 중인 키는 빼고).
 * 돌려주는 local = 가져온 것까지 넣은 이 브라우저 칸(최근 max 개).
 */
export function adoptKeyed<T extends Stamped>(local: KeyedStore<T>, cloud: KeyedStore<T>, running: ReadonlySet<string>, max: number): { local: KeyedStore<T>; adopted: string[] } {
  const take: KeyedStore<T> = {}
  for (const [k, v] of Object.entries(cloud)) {
    if (running.has(k)) continue
    const mine = local[k]
    if (!mine || v.at > mine.at) take[k] = v
  }
  const next = mergeKeyed(local, take, max)
  return { local: next, adopted: Object.keys(take).filter((k) => next[k] === take[k]) }
}

/* ------------------------------------------------------------------ */
/* 클라우드 한 줄                                                         */
/* ------------------------------------------------------------------ */

export interface KeyedRowSpec<T extends Stamped> {
  module: string
  bucket: string
  /** 행 id 앞 — 'mkpacks_' 처럼 */
  rowPrefix: string
  /** 한 줄 안에서 결과를 담는 칸 이름 — { packs: {...} } */
  field: string
  max: number
  /** 저장된 값 다듬기(깨진 값 · 모르는 칸은 버린다) */
  parse: (v: unknown) => KeyedStore<T>
}

/** 클라우드 결과 — 아직 한 줄도 없으면 빈 칸 · 못 읽으면 throw(부르는 쪽이 '못 맞춤' 으로 다룬다) */
export async function loadKeyed<T extends Stamped>(ws: string, spec: KeyedRowSpec<T>): Promise<KeyedStore<T>> {
  const rows = await listRows(ws, spec.module, spec.bucket)
  const row = rows.find((r) => r.id === keyedRowId(spec.rowPrefix, ws))
  return row ? spec.parse((row.data as Record<string, unknown>)[spec.field]) : {}
}

export async function saveKeyed<T extends Stamped>(ws: string, spec: KeyedRowSpec<T>, store: KeyedStore<T>): Promise<void> {
  await saveRow(ws, spec.module, spec.bucket, { id: keyedRowId(spec.rowPrefix, ws), data: { [spec.field]: store } })
}

/* ------------------------------------------------------------------ */
/* 맞추는 일 — 결과를 가진 모듈(packAi · kitAi)이 하나씩 만든다             */
/* ------------------------------------------------------------------ */

export interface KeyedSyncSpec<T extends Stamped> extends KeyedRowSpec<T> {
  /** 같은지 볼 때 쓰는 표지(기본: 시각) */
  sig?: (x: T) => string
  /** 이 기기 전부(이번 접속에서 쓴 것 + 이 브라우저에 남긴 것) */
  local: () => KeyedStore<T>
  /** 지금 AI 가 쓰는 중인 키 — 다른 기기 결과로 덮지 않는다 */
  running: () => ReadonlySet<string>
  /** 가져온 결과를 이 기기에 넣는다(메모리 · 이 브라우저) — next = 가져온 것까지 넣은 이 기기 칸 */
  adopt: (next: KeyedStore<T>, keys: string[]) => void
  /** 화면을 다시 그리게(가져옴 · 못 올림 표시가 바뀜) */
  changed: () => void
}

export interface KeyedSync {
  /** 마케팅 화면을 열 때 · 돌아올 때 · 인터넷이 다시 될 때 — ws 가 null 이면(팀장 화면 보기 등) 이후 올리지 않는다 */
  open: (ws: string | null) => Promise<void>
  /** 새 결과가 생겼을 때(AI 답) — 열린 작업공간이 있을 때만 올린다 */
  push: () => void
  /** 클라우드에 올리지 못한 채 이 기기에만 있음(연결되면 다시) */
  failed: () => boolean
}

export function keyedCloudSync<T extends Stamped>(spec: KeyedSyncSpec<T>): KeyedSync {
  let ws: string | null = null
  let failed = false
  let chain: Promise<void> = Promise.resolve()
  let waiting = false

  const setFailed = (v: boolean) => {
    if (failed === v) return
    failed = v
    spec.changed()
  }

  const once = async (target: string): Promise<void> => {
    waiting = false
    const cloud = await loadKeyed(target, spec)
    // 1) 가져오기
    const { local, adopted } = adoptKeyed(spec.local(), cloud, spec.running(), spec.max)
    if (adopted.length) {
      spec.adopt(local, adopted)
      spec.changed()
    }
    // 2) 올리기 — 이 기기에만 있거나 이 기기 쪽이 나중인 것
    const merged = mergeKeyed(cloud, spec.local(), spec.max)
    if (!sameKeyed(merged, cloud, spec.sig)) await saveKeyed(target, spec, merged)
  }

  const queue = (target: string): Promise<void> => {
    if (waiting) return chain
    waiting = true
    chain = chain
      .then(() => once(target))
      .then(
        () => setFailed(false),
        () => {
          waiting = false
          setFailed(true)
        },
      )
    return chain
  }

  return {
    open: (next) => {
      ws = cloudKeyedOn(next) ? next : null
      if (!ws) {
        setFailed(false)
        return Promise.resolve()
      }
      return queue(ws)
    },
    push: () => {
      if (ws) void queue(ws)
    },
    failed: () => failed,
  }
}
