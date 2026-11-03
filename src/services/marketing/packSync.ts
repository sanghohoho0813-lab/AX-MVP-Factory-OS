/**
 * D-514 콘텐츠 묶음 AI 결과 — 다른 기기에서도 그대로(다시 부르지 않게).
 *
 * AI 로 쓴 7칸(제목 · 대본 · 블로그 …)은 이 브라우저(axmvp.mkpack.v1 · 사람별 금고)에만 있었다.
 * PC 에서 [AI로 다 쓰기] 를 눌러 두고 휴대폰으로 같은 키워드를 열면 규칙 초안만 보였고, 다시 부르면 사용량이 또 들었다. 이제:
 *  - 작업공간 기록(module_data · marketing / packs) 한 줄에 키워드별 결과를 최근 12개만 둔다 — 이 브라우저와 같은 한도 · 새 표 없음(DB 변경 없음).
 *  - 마케팅 화면을 열 때 · 다른 창에 갔다 돌아올 때 맞춘다: 같은 키워드는 더 나중에 쓴 것이 이긴다.
 *    클라우드 쪽이 나중이면 이 브라우저로 가져오고, 이 브라우저에만 있던(예전에 쓴) 결과는 클라우드로 올린다.
 *  - AI 답이 한 갈래씩 올 때마다 올린다(차례차례 — 늦게 간 저장이 새 것을 덮지 않게).
 * 규칙 계산 — AI 아님. 브라우저 저장 모드(클라우드 아님)에서는 예전처럼 브라우저에만.
 */
import { listRows, saveRow } from '../moduleData'
import { getDataModeConfig } from '../../data/dataMode'
import { PACK_STORE_MAX, packStoreOf, type PackAiSaved } from './contentPack'

export const PACKS_MODULE = 'marketing'
export const PACKS_BUCKET = 'packs'

const wsTag = (ws: string | null) => (ws ?? 'local').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40) || 'local'
/** 작업공간마다 한 줄 — 행 id 에 작업공간을 넣어 다른 작업공간과 겹치지 않게 */
export const packsRowId = (ws: string | null): string => `mkpacks_${wsTag(ws)}`

export type PackStore = Record<string, PackAiSaved>

/** 클라우드에 올릴 수 있는가 — 클라우드 모드 · 작업공간이 있을 때만(팀장 화면 보기는 부르는 쪽이 막는다) */
export function cloudPacksOn(ws: string | null | undefined): ws is string {
  return !!ws && getDataModeConfig().mode === 'supabase'
}

/** 클라우드의 묶음 결과 — 아직 한 줄도 없으면 빈 칸 · 못 읽으면 throw(부르는 쪽이 '못 맞춤' 으로 다룬다) */
export async function loadPacksCloud(ws: string): Promise<PackStore> {
  const rows = await listRows(ws, PACKS_MODULE, PACKS_BUCKET)
  const row = rows.find((r) => r.id === packsRowId(ws))
  return row ? packStoreOf((row.data as { packs?: unknown }).packs) : {}
}

export async function savePacksCloud(ws: string, store: PackStore): Promise<void> {
  await saveRow(ws, PACKS_MODULE, PACKS_BUCKET, { id: packsRowId(ws), data: { packs: store } as unknown as Record<string, unknown> })
}

/* ------------------------------------------------------------------ */
/* 맞추기 — 순수 함수                                                     */
/* ------------------------------------------------------------------ */

/** 두 곳을 합친다 — 같은 키워드는 더 나중에 쓴 것 · 최근 max 개만 */
export function mergePackStores(a: PackStore, b: PackStore, max = PACK_STORE_MAX): PackStore {
  const out: PackStore = { ...a }
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

/** 같은 키워드 · 같은 시각이면 같은 것으로 본다(글을 통째로 비교하지 않는다 — 시각은 AI 답마다 새로) */
export function samePackStores(a: PackStore, b: PackStore): boolean {
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every((k) => b[k] && b[k].at === a[k].at && Object.keys(b[k].sections).length === Object.keys(a[k].sections).length)
}

/**
 * 클라우드에서 가져올 것 — 이 브라우저에 없거나 클라우드 쪽이 더 나중인 키워드(지금 쓰는 중인 키워드는 빼고).
 * 돌려주는 local = 가져온 것까지 넣은 이 브라우저 칸(최근 max 개).
 */
export function adoptPacks(local: PackStore, cloud: PackStore, running: ReadonlySet<string>, max = PACK_STORE_MAX): { local: PackStore; adopted: string[] } {
  const take: PackStore = {}
  for (const [k, v] of Object.entries(cloud)) {
    if (running.has(k)) continue
    const mine = local[k]
    if (!mine || v.at > mine.at) take[k] = v
  }
  const next = mergePackStores(local, take, max)
  return { local: next, adopted: Object.keys(take).filter((k) => next[k] === take[k]) }
}
