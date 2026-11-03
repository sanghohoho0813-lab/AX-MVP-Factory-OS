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
 * 규칙 계산 — AI 아님. 브라우저 저장 모드(클라우드 아님)에서는 예전처럼 브라우저에만.
 */
import { listRows, saveRow } from '../moduleData'
import { getDataModeConfig } from '../../data/dataMode'

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

/** 클라우드의 쓰던 글 — 없으면 null · 못 읽으면 throw(부르는 쪽이 '못 읽음' 으로 다룬다) */
export async function loadCloudDraft<T>(workspaceId: string, kind: DraftKind, clean: (v: unknown) => T): Promise<DraftEnvelope<T> | null> {
  const rows = await listRows(workspaceId, DRAFT_MODULE, DRAFT_BUCKET)
  const row = rows.find((r) => r.id === draftRowId(kind, workspaceId))
  return row ? envelopeOf(row.data, clean) : null
}

export async function saveCloudDraft<T>(workspaceId: string, kind: DraftKind, env: DraftEnvelope<T>): Promise<void> {
  await saveRow(workspaceId, DRAFT_MODULE, DRAFT_BUCKET, { id: draftRowId(kind, workspaceId), data: { draft: env.draft, at: env.at, device: env.device } as unknown as Record<string, unknown> })
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
export function chooseDraft<T>(input: { local: T; localAt: string; cloud: DraftEnvelope<T> | null; blocked: boolean; same: (a: T, b: T) => boolean; empty: (d: T) => boolean }): DraftChoice {
  const { local, localAt, cloud, blocked, same, empty } = input
  if (!cloud) return empty(local) ? 'keep' : 'push'
  if (same(local, cloud.draft)) return 'keep'
  if (blocked) return 'push'
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
