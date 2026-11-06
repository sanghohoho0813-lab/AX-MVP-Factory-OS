/**
 * D-513 쓰던 글(스레드 · 릴스/틱톡) — 다른 기기에서 이어 쓰기.
 *
 * 쓰던 글은 이 브라우저에만 있었다(mirae.threads.draft.v1 · mirae.shorts.draft.v1). PC 에서 쓰다 휴대폰으로 가면 빈 칸이었고,
 * 브라우저를 비우면 사라졌다. 이제:
 *  - 적을 때마다 브라우저에 먼저 남기고(예전 그대로 — 인터넷이 끊겨도 글은 남는다) 적은 시각도 같이 남긴다.
 *  - 잠깐 멈추면 작업공간 기록(module_data · marketing / drafts) 한 줄에 올린다 — 종류마다 한 줄, 새 표 없음(DB 변경 없음).
 *  - 화면을 열 때 · 다른 창에 갔다 돌아올 때 클라우드 쪽이 더 나중에 적은 글이면 그 글로 이어서 연다.
 *    이 기기에 다른 글이 있었으면 [이 기기 글로 되돌리기] 로 바로 돌아간다(지우지 않는다).
 *  - 주소로 주제를 들고 왔거나(같은 소재로) 이미 고치기 시작했으면 클라우드 글로 바꾸지 않고 지금 글을 올린다.
 * D-551 SYNC-3 '어느 쪽이 새것' 을 기기 시계가 아니라 **서버 판**으로 정한다 — 시계가 틀린 기기가 예전 글로 새 글을 덮지 않게.
 *  - 이 기기가 마지막으로 맞춘 클라우드 판(서버 updated_at)과 그때 이 기기 글의 적은 시각을 기억한다(synced).
 *  - 클라우드 판이 그대로면 → 이 기기 글이 새것(올림). 이 기기가 그 뒤 고치지 않았으면 → 클라우드 글이 새것(가져옴).
 *  - 둘 다 바뀌었을 때만 적은 시각을 견준다 — 이때도 저장할 때 잰 '서버와의 시계 차이' 로 맞춘 시각이라 기기 시계가 틀려도 덜 틀린다.
 *  - 기억이 없으면(예전 기록 · 처음) 예전 규칙 그대로.
 * 규칙 계산 — AI 아님. 브라우저 저장 모드(클라우드 아님)에서는 예전처럼 브라우저에만.
 */
import { listRows, saveRow } from '../moduleData'
import { getDataModeConfig } from '../../data/dataMode'
import { nowIso } from '../../lib/appClock'

export type DraftKind = 'threads' | 'shorts'
export type DraftDevice = 'pc' | 'phone'

export const DRAFT_MODULE = 'marketing'
export const DRAFT_BUCKET = 'drafts'

/** 작업공간마다 종류별 한 줄 — 행 id 는 작업공간을 넣어 다른 작업공간과 겹치지 않게 */
export const draftRowId = (kind: DraftKind, workspaceId: string | null): string => `mkdraft_${kind}_${workspaceId ?? 'local'}`

export interface DraftEnvelope<T> {
  draft: T
  /** 마지막으로 적은 시각(ISO) */
  at: string
  device: DraftDevice
}

/* ------------------------------------------------------------------ */
/* 이 기기 — 적은 시각                                                   */
/* ------------------------------------------------------------------ */

/** 쓰던 글을 마지막으로 고친 시각 — 'mirae.' 로 시작해 계정 금고(storageVault)에 같이 들어간다 */
export const localAtKey = (kind: DraftKind): string => `mirae.${kind}.draft.at.v1`

export function readLocalAt(kind: DraftKind): string {
  try {
    const v = localStorage.getItem(localAtKey(kind)) ?? ''
    return /^\d{4}-\d{2}-\d{2}T/.test(v) ? v : ''
  } catch {
    return ''
  }
}

export function writeLocalAt(kind: DraftKind, at: string): void {
  try {
    localStorage.setItem(localAtKey(kind), at)
  } catch {
    // 저장 공간이 없으면 이번 접속 동안만
  }
}

/* ------------------------------------------------------------------ */
/* D-551 마지막으로 맞춘 서버 판 · 시계 차이                                */
/* ------------------------------------------------------------------ */

/** 이 기기가 마지막으로 맞춘 클라우드 판 — 작업공간 · 서버 시각(updated_at) · 그때 이 기기 글의 적은 시각 */
export interface DraftSynced {
  ws: string
  serverAt: string
  localAt: string
}

/** 'mirae.' 로 시작해 계정 금고에 같이 들어간다(다른 계정에서 이어 쓰지 않게) */
export const syncedKey = (kind: DraftKind): string => `mirae.${kind}.draft.synced.v1`

export function readSynced(kind: DraftKind, ws: string): DraftSynced | null {
  try {
    const v = JSON.parse(localStorage.getItem(syncedKey(kind)) ?? 'null') as Partial<DraftSynced> | null
    if (!v || v.ws !== ws || typeof v.serverAt !== 'string' || !v.serverAt || typeof v.localAt !== 'string') return null
    return { ws: v.ws, serverAt: v.serverAt, localAt: v.localAt }
  } catch {
    return null
  }
}

export function writeSynced(kind: DraftKind, s: DraftSynced): void {
  try {
    localStorage.setItem(syncedKey(kind), JSON.stringify(s))
  } catch {
    // 저장 공간이 없으면 다음엔 예전 규칙으로
  }
}

/** 이 기기 시계와 서버 시계 차이(ms) — 기기마다 하나(계정과 상관없음) */
export const SKEW_KEY = 'axmvp.clock.skew.v1'
/** 이보다 크게 틀린 값은 잘못 잰 것으로 보고 버린다(7일) */
const SKEW_LIMIT = 7 * 24 * 3600 * 1000

/** 서버가 돌려준 시각으로 시계 차이를 잰다 — 보낸 때와 받은 때의 가운데를 서버 시각과 견준다 */
export function noteServerTime(serverIso: string, sentMs: number, gotMs: number): number | null {
  const server = Date.parse(serverIso)
  if (!Number.isFinite(server) || !Number.isFinite(sentMs) || !Number.isFinite(gotMs) || gotMs < sentMs) return null
  const skew = Math.round(server - (sentMs + gotMs) / 2)
  if (Math.abs(skew) > SKEW_LIMIT) return null
  try {
    localStorage.setItem(SKEW_KEY, String(skew))
  } catch {
    // 못 남기면 이번에는 보정 없이
  }
  return skew
}

export function clockSkew(): number {
  try {
    const v = Number(localStorage.getItem(SKEW_KEY))
    return Number.isFinite(v) && Math.abs(v) <= SKEW_LIMIT ? v : 0
  } catch {
    return 0
  }
}

/** 서버 시계로 맞춘 지금 — 적은 시각은 이것으로 남긴다(다른 기기와 견줄 때 덜 틀리게) */
export function serverNowIso(now: string = nowIso()): string {
  const t = Date.parse(now)
  return Number.isFinite(t) ? new Date(t + clockSkew()).toISOString() : now
}

/* ------------------------------------------------------------------ */
/* 클라우드 한 줄                                                         */
/* ------------------------------------------------------------------ */

/** 클라우드에 올릴 수 있는가 — 클라우드 모드 · 작업공간이 있을 때만(팀장 화면 보기는 부르는 쪽이 막는다) */
export function cloudDraftOn(workspaceId: string | null): boolean {
  return !!workspaceId && getDataModeConfig().mode === 'supabase'
}

/** 저장된 모양 다듬기 — 모양이 틀리면 null */
export function envelopeOf<T>(raw: unknown, clean: (v: unknown) => T): DraftEnvelope<T> | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Record<string, unknown>
  if (typeof v.at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(v.at) || !v.draft || typeof v.draft !== 'object') return null
  return { draft: clean(v.draft), at: v.at, device: v.device === 'phone' ? 'phone' : 'pc' }
}

/** D-551 클라우드 글 + 그 줄의 서버 판(updated_at) */
export type CloudDraft<T> = DraftEnvelope<T> & { serverAt?: string }

/** 클라우드의 쓰던 글 — 없으면 null · 못 읽으면 throw(부르는 쪽이 '못 읽음' 으로 다룬다) */
export async function loadCloudDraft<T>(workspaceId: string, kind: DraftKind, clean: (v: unknown) => T): Promise<CloudDraft<T> | null> {
  const rows = await listRows(workspaceId, DRAFT_MODULE, DRAFT_BUCKET)
  const row = rows.find((r) => r.id === draftRowId(kind, workspaceId))
  const env = row ? envelopeOf(row.data, clean) : null
  return env && row ? { ...env, serverAt: row.updatedAt } : env
}

/** 올리고 그 줄의 서버 판(updated_at)을 돌려준다 — 서버 시각으로 시계 차이도 잰다 */
export async function saveCloudDraft<T>(workspaceId: string, kind: DraftKind, env: DraftEnvelope<T>): Promise<string> {
  const sent = Date.parse(nowIso())
  const row = await saveRow(workspaceId, DRAFT_MODULE, DRAFT_BUCKET, { id: draftRowId(kind, workspaceId), data: { draft: env.draft, at: env.at, device: env.device } as unknown as Record<string, unknown> })
  noteServerTime(row.updatedAt, sent, Date.parse(nowIso()))
  return row.updatedAt
}

/* ------------------------------------------------------------------ */
/* 어느 글을 쓸까 — 순수 함수                                              */
/* ------------------------------------------------------------------ */

export type DraftChoice = 'cloud' | 'push' | 'keep'

/**
 *  - cloud: 클라우드 글로 바꾼다(다른 기기에서 더 나중에 적음)
 *  - push: 이 기기 글을 올린다(이 기기가 더 나중 · 주소로 주제를 들고 옴 · 이미 고치기 시작함)
 *  - keep: 그대로(같은 글 · 둘 다 비어 있음)
 */
export function chooseDraft<T>(input: {
  local: T
  localAt: string
  cloud: CloudDraft<T> | null
  blocked: boolean
  same: (a: T, b: T) => boolean
  empty: (d: T) => boolean
  /** D-551 이 기기가 마지막으로 맞춘 클라우드 판 — 없으면 예전 규칙(적은 시각 견주기) */
  synced?: Pick<DraftSynced, 'serverAt' | 'localAt'> | null
}): DraftChoice {
  const { local, localAt, cloud, blocked, same, empty, synced } = input
  if (!cloud) return empty(local) ? 'keep' : 'push'
  if (same(local, cloud.draft)) return 'keep'
  if (blocked) return 'push'
  // D-551 서버 판으로 — 기기 시계가 틀려도 맞게. 이 기기 글이 비었으면(새 기기 · 비움) 클라우드를 비우지 않게 아래 예전 규칙으로
  if (synced && cloud.serverAt && !empty(local)) {
    const cloudMoved = cloud.serverAt !== synced.serverAt
    const localMoved = localAt !== synced.localAt
    if (!cloudMoved) return 'push'
    if (!localMoved) return 'cloud'
    // 둘 다 고침 — 아래에서 적은 시각(서버 시계로 맞춘 값)을 견준다
  }
  if (empty(cloud.draft) && !empty(local)) return cloud.at > localAt ? 'cloud' : 'push'
  if (empty(local)) return empty(cloud.draft) ? 'keep' : 'cloud'
  return cloud.at > localAt ? 'cloud' : 'push'
}

/** 글을 비교할 때 — 칸 순서와 상관없이 같은 내용이면 같다 */
export function sameDraft(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b)
}
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v ?? null)
}

/** '11/3 14:20 휴대폰' — 이어서 연 글이 언제 · 어디서 적은 것인지 */
export function whenWhere(env: Pick<DraftEnvelope<unknown>, 'at' | 'device'>): string {
  const d = new Date(env.at)
  if (Number.isNaN(d.getTime())) return env.device === 'phone' ? '휴대폰' : 'PC'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm} ${env.device === 'phone' ? '휴대폰' : 'PC'}`
}
