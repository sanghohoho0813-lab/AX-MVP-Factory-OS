/**
 * D-514 콘텐츠 묶음 AI 결과 — 다른 기기에서도 그대로(다시 부르지 않게).
 *
 * AI 로 쓴 7칸(제목 · 대본 · 블로그 …)은 이 브라우저(axmvp.mkpack.v1 · 사람별 금고)에만 있었다.
 * PC 에서 [AI로 다 쓰기] 를 눌러 두고 휴대폰으로 같은 키워드를 열면 규칙 초안만 보였고, 다시 부르면 사용량이 또 들었다. 이제:
 *  - 작업공간 기록(module_data · marketing / packs) 한 줄에 키워드별 결과를 최근 12개만 둔다 — 이 브라우저와 같은 한도 · 새 표 없음(DB 변경 없음).
 *  - 마케팅 화면을 열 때 · 다른 창에 갔다 돌아올 때 맞춘다: 같은 키워드는 더 나중에 쓴 것이 이긴다.
 *    클라우드 쪽이 나중이면 이 브라우저로 가져오고, 이 브라우저에만 있던(예전에 쓴) 결과는 클라우드로 올린다.
 *  - AI 답이 한 갈래씩 올 때마다 올린다(차례차례 — 늦게 간 저장이 새 것을 덮지 않게).
 * D-515 맞추는 길은 keyedSync 로 모았다('이렇게 찍으세요' AI 추천도 같은 길) — 여기는 묶음 결과의 이름 · 한도 · 표지만.
 * 규칙 계산 — AI 아님. 브라우저 저장 모드(클라우드 아님)에서는 예전처럼 브라우저에만.
 */
import { PACK_STORE_MAX, packStoreOf, type PackAiSaved } from './contentPack'
import { adoptKeyed, cloudKeyedOn, keyedRowId, loadKeyed, mergeKeyed, saveKeyed, sameKeyed, type KeyedRowSpec } from './keyedSync'

export const PACKS_MODULE = 'marketing'
export const PACKS_BUCKET = 'packs'

export type PackStore = Record<string, PackAiSaved>

/** 묶음 결과 한 줄의 이름 · 한도 · 모양 */
export const PACK_ROW: KeyedRowSpec<PackAiSaved> = { module: PACKS_MODULE, bucket: PACKS_BUCKET, rowPrefix: 'mkpacks_', field: 'packs', max: PACK_STORE_MAX, parse: packStoreOf }

/** 같은지 볼 때 — 같은 시각이어도 칸 수가 다르면 다름(한 갈래 더 온 것) */
export const packSig = (x: PackAiSaved): string => `${x.at}|${Object.keys(x.sections).length}`

/** 작업공간마다 한 줄 — 행 id 에 작업공간을 넣어 다른 작업공간과 겹치지 않게 */
export const packsRowId = (ws: string | null): string => keyedRowId(PACK_ROW.rowPrefix, ws)

/** 클라우드에 올릴 수 있는가 — 클라우드 모드 · 작업공간이 있을 때만(팀장 화면 보기는 부르는 쪽이 막는다) */
export const cloudPacksOn = cloudKeyedOn

/** 클라우드의 묶음 결과 — 아직 한 줄도 없으면 빈 칸 · 못 읽으면 throw */
export const loadPacksCloud = (ws: string): Promise<PackStore> => loadKeyed(ws, PACK_ROW)
export const savePacksCloud = (ws: string, store: PackStore): Promise<void> => saveKeyed(ws, PACK_ROW, store)

/** 두 곳을 합친다 — 같은 키워드는 더 나중에 쓴 것 · 최근 max 개만 */
export const mergePackStores = (a: PackStore, b: PackStore, max = PACK_STORE_MAX): PackStore => mergeKeyed(a, b, max)

/** 같은 키워드 · 같은 시각 · 같은 칸 수면 같은 것으로 본다 */
export const samePackStores = (a: PackStore, b: PackStore): boolean => sameKeyed(a, b, packSig)

/** 클라우드에서 가져올 것 — 이 브라우저에 없거나 클라우드 쪽이 더 나중인 키워드(지금 쓰는 중인 키워드는 빼고) */
export const adoptPacks = (local: PackStore, cloud: PackStore, running: ReadonlySet<string>, max = PACK_STORE_MAX): { local: PackStore; adopted: string[] } => adoptKeyed(local, cloud, running, max)
