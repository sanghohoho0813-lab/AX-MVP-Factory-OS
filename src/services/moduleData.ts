/**
 * 모듈이 쌓는 기록 (D-91).
 *
 * 원본 OS 들은 저마다 데이터를 들고 있었다 — 고용지원금은 직원·회차, 연구소는 연구과제·연구노트,
 * 세일즈는 리드·교육·법령. 그 기록들이 이 OS 안에 살 자리를 만든다.
 *
 * 원칙
 *  - **업체(회사)는 만들지 않는다.** 업체는 이 OS 의 고객 운영 하나뿐이다(`operations_clients`).
 *    모듈 기록은 `clientId` 로 그 업체를 가리킨다. 명단이 두 벌로 갈라지지 않게.
 *  - 모듈마다 상자 하나(`moduleKey`), 상자 안에 갈래(`bucket`) 별로 줄(row)이 쌓인다.
 *  - 로컬 모드: 이 브라우저(localStorage). 클라우드 모드: 추가 전용 표 `module_data`
 *    (`supabase/module_data.sql` — 대표가 실행할 때까지는 브라우저에 쌓이고, 실행하면 클라우드로 간다).
 *  - 주민등록번호·비밀번호는 여기에 들어오지 않는다. 그런 값은 애초에 만들지 않는다.
 */

import { getDataModeConfig } from '../data/dataMode'
import { announceStorageFull, isQuotaError, StorageFullError } from '../storage/storageFull'
import { getSupabaseClient } from '../lib/supabase/client'
import { generateId } from '../storage/localStore'
import { nowIso } from '../lib/appClock'

const PREFIX = 'axmvp.module.'

/** D-535 이 창이 마지막으로 본 판(줄 id → updated_at). 서버가 고칠 때마다 updated_at 을 서버 시각으로 바꾼다(트리거) */
const rowVersions = new Map<string, string>()
/** D-535 같은 줄 저장은 부른 순서대로 하나씩(앞 저장이 끝나 새 판을 기억한 뒤 다음 저장) — 이 창 스스로와 '충돌' 하지 않게 */
const rowChains = new Map<string, Promise<unknown>>()
/** D-535 다른 기기가 먼저 고친 판을 덮기 전에 보관해 두는 갈래 이름 — 같은 모듈 안 `<갈래>.overwritten` */
export const OVERWRITTEN_SUFFIX = '.overwritten'
export const MODULE_OVERWROTE_EVENT = 'axmvp:module-overwrote'

export interface ModuleRow {
  id: string
  /** 어느 업체의 기록인가 (업체와 상관없는 것은 '') */
  clientId: string
  /** 내용 — 갈래마다 모양이 다르다 */
  data: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

function keyOf(moduleKey: string, bucket: string, workspaceId: string | null): string {
  return `${PREFIX}${moduleKey}.${bucket}${workspaceId ? `.${workspaceId}` : ''}`
}

function isCloud(): boolean {
  return getDataModeConfig().mode === 'supabase'
}

/* ------------------------------------------------------------------ */
/* 브라우저 저장 (로컬 모드 · 클라우드 표가 아직 없을 때의 대비)            */
/* ------------------------------------------------------------------ */

/** localStorage 가 없는 곳(시험·서버)에서는 이 세션 메모리에만 담는다 */
const memory = new Map<string, string>()
/** 저장 공간이 차서 메모리에만 들고 있는 칸 — 읽을 때 메모리 것이 최신이다 */
const overflowKeys = new Set<string>()

function rawGet(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined' || overflowKeys.has(key)) return memory.get(key) ?? null
    return localStorage.getItem(key)
  } catch {
    return memory.get(key) ?? null
  }
}

function rawSet(key: string, value: string): void {
  if (typeof localStorage === 'undefined') {
    memory.set(key, value)
    return
  }
  try {
    localStorage.setItem(key, value)
    overflowKeys.delete(key)
  } catch (cause) {
    // D-95: 전에는 여기서 조용히 메모리에만 담아 '저장된 척' 했다 — 새로고침하면 사라졌다.
    // 지금 창에서는 계속 쓰게 메모리에 두되, 저장 못 한 것은 알린다(OS 띠 + 부른 쪽에 오류).
    memory.set(key, value)
    overflowKeys.add(key)
    if (isQuotaError(cause)) {
      announceStorageFull(key)
      throw new StorageFullError()
    }
    throw cause
  }
}

function readLocal(key: string): ModuleRow[] {
  try {
    const raw = rawGet(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as ModuleRow[]).filter((r) => r && typeof r.id === 'string') : []
  } catch {
    return []
  }
}

function writeLocal(key: string, rows: ModuleRow[]): void {
  rawSet(key, JSON.stringify(rows))
}

/* ------------------------------------------------------------------ */
/* 클라우드 저장 (있으면 쓰고, 없으면 조용히 브라우저로)                   */
/* ------------------------------------------------------------------ */

/** 표가 아직 없는지 (대표가 SQL 을 아직 실행하지 않은 상태) */
function missingTable(message: string): boolean {
  return /module_data/.test(message) && /(does not exist|not find|schema cache)/i.test(message)
}

async function cloudList(workspaceId: string, moduleKey: string, bucket: string): Promise<ModuleRow[] | null> {
  try {
    const { data, error } = await getSupabaseClient()
      .from('module_data')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('module_key', moduleKey)
      .eq('bucket', bucket)
      .order('updated_at', { ascending: false })
    if (error) {
      if (missingTable(error.message)) return null
      throw error
    }
    const rows = (data ?? []).map((row) => fromRow(row as Record<string, unknown>))
    // D-535 이 창이 읽은 판을 기억 — 나중에 고쳐 저장할 때 '그새 다른 기기가 고쳤나' 를 이 판과 견준다
    for (const r of rows) rowVersions.set(r.id, r.updatedAt)
    return rows
  } catch (cause) {
    if (cause instanceof Error && missingTable(cause.message)) return null
    throw cause
  }
}

function fromRow(row: Record<string, unknown>): ModuleRow {
  const payload = (row.payload ?? {}) as Record<string, unknown>
  return {
    id: String(row.id ?? generateId()),
    clientId: typeof row.client_id === 'string' ? row.client_id : '',
    data: payload,
    createdAt: typeof row.created_at === 'string' ? row.created_at : nowIso(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : nowIso(),
  }
}

/* ------------------------------------------------------------------ */
/* 바깥에서 쓰는 것                                                      */
/* ------------------------------------------------------------------ */

export async function listRows(
  workspaceId: string | null,
  moduleKey: string,
  bucket: string,
): Promise<ModuleRow[]> {
  if (isCloud() && workspaceId) {
    const cloud = await cloudList(workspaceId, moduleKey, bucket)
    if (cloud) return cloud
  }
  return readLocal(keyOf(moduleKey, bucket, workspaceId))
}

/** D-521 내보내기용 — 어느 상자 · 갈래의 줄인지까지 */
export interface WorkspaceModuleRow extends ModuleRow {
  moduleKey: string
  bucket: string
}

/**
 * D-521 이 작업공간의 모듈 기록 전부(작업공간 전체 내보내기 — 읽기만).
 * 클라우드 모드가 아니거나 서버 표가 아직 없으면 null — 그때 모듈 기록은 이 브라우저에 있고 백업의 도구 입력값 칸에 이미 담긴다.
 * 1000줄씩 끝까지 읽는다(안전 상한 50,000줄). 서버가 이 작업공간 구성원에게만 준다(RLS).
 */
export async function listWorkspaceRows(workspaceId: string | null): Promise<WorkspaceModuleRow[] | null> {
  if (!isCloud() || !workspaceId) return null
  const PAGE = 1000
  const out: WorkspaceModuleRow[] = []
  for (let from = 0; from < 50_000; from += PAGE) {
    const { data, error } = await getSupabaseClient()
      .from('module_data')
      .select('*')
      .eq('workspace_id', workspaceId)
      // 고정 순서(id) — 내보내는 사이 다른 기기가 저장해도 쪽이 밀려 줄이 겹치거나 빠지지 않게
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      if (missingTable(error.message)) return null
      throw error
    }
    const rows = (data ?? []) as Record<string, unknown>[]
    out.push(...rows.map((row) => ({ ...fromRow(row), moduleKey: String(row.module_key ?? ''), bucket: String(row.bucket ?? '') })))
    if (rows.length < PAGE) break
  }
  return out
}

export async function saveRow(
  workspaceId: string | null,
  moduleKey: string,
  bucket: string,
  input: { id?: string; clientId?: string; data: Record<string, unknown> },
): Promise<ModuleRow> {
  const now = nowIso()
  const row: ModuleRow = {
    id: input.id ?? generateId(),
    clientId: input.clientId ?? '',
    data: input.data,
    createdAt: now,
    updatedAt: now,
  }

  if (isCloud() && workspaceId) {
    try {
      const { data, error } = await getSupabaseClient()
        .from('module_data')
        .upsert({
          id: row.id,
          workspace_id: workspaceId,
          module_key: moduleKey,
          bucket,
          client_id: row.clientId || null,
          payload: row.data,
          updated_at: now,
        })
        .select()
        .single()
      if (error) {
        if (!missingTable(error.message)) throw error
      } else if (data) {
        return fromRow(data as Record<string, unknown>)
      }
    } catch (cause) {
      if (!(cause instanceof Error && missingTable(cause.message))) throw cause
    }
  }

  const key = keyOf(moduleKey, bucket, workspaceId)
  const rows = readLocal(key)
  const at = rows.findIndex((r) => r.id === row.id)
  if (at >= 0) rows[at] = { ...rows[at], ...row, createdAt: rows[at].createdAt }
  else rows.unshift(row)
  writeLocal(key, rows)
  return row
}

/**
 * D-535 고쳐 저장하기 — 다른 기기의 고침을 **알림 없이 지우지 않는다**(점검 A3).
 *
 * 예전 saveRow 는 줄을 통째로 덮었다(나중에 저장한 쪽이 이김 · 알림 없음). PC 와 휴대폰에서 같은 기록을 고치면 한쪽 고침이 조용히 사라졌다.
 * 이 함수는 저장을 막지 않는다(저장이 새로 실패하는 길을 만들지 않는다). 대신
 *   1. 이 창이 읽은 판 그대로면 → 그 판에만 고쳐 쓴다(보통 이 길 — 요청 하나).
 *   2. 그새 다른 기기가 고쳤으면 → 그 판을 같은 모듈의 `<갈래>.overwritten` 에 **보관해 두고** 내 것을 저장한다 + OS 띠로 알린다.
 *      보관 줄은 백업(전체 내보내기 · 모듈 기록)에 그대로 담긴다. 보관을 못 하면 덮지 않고 오류를 낸다(두 판 모두 지킨다).
 *   3. 그 줄이 그새 지워졌으면 → 다시 만든다(내 글을 잃지 않게).
 *   이 창이 그 줄을 읽은 적이 없으면(새 줄 · 처음) → 예전 saveRow 그대로.
 * 로컬 모드(브라우저 하나)는 예전 그대로.
 */
export async function saveRowChecked(
  workspaceId: string | null,
  moduleKey: string,
  bucket: string,
  input: { id?: string; clientId?: string; data: Record<string, unknown> },
): Promise<ModuleRow> {
  const id = input.id
  if (!id || !isCloud() || !workspaceId) return saveRow(workspaceId, moduleKey, bucket, input)
  const prev = rowChains.get(id) ?? Promise.resolve()
  const run = prev.catch(() => undefined).then(() => saveCheckedNow(workspaceId, moduleKey, bucket, { ...input, id }))
  const tail = run.catch(() => undefined)
  rowChains.set(id, tail)
  void tail.then(() => {
    if (rowChains.get(id) === tail) rowChains.delete(id)
  })
  return run
}

async function saveCheckedNow(
  workspaceId: string,
  moduleKey: string,
  bucket: string,
  input: { id: string; clientId?: string; data: Record<string, unknown> },
): Promise<ModuleRow> {
  const base = rowVersions.get(input.id)
  if (!base) {
    const row = await saveRow(workspaceId, moduleKey, bucket, input)
    rowVersions.set(row.id, row.updatedAt)
    return row
  }
  const db = getSupabaseClient()
  const now = nowIso()
  const { data, error } = await db
    .from('module_data')
    .update({ client_id: input.clientId || null, payload: input.data, updated_at: now })
    .eq('id', input.id)
    .eq('workspace_id', workspaceId)
    .eq('updated_at', base)
    .select()
    .maybeSingle()
  if (error) {
    if (missingTable(error.message)) return saveRow(workspaceId, moduleKey, bucket, input)
    throw error
  }
  if (data) {
    const row = fromRow(data as Record<string, unknown>)
    rowVersions.set(row.id, row.updatedAt)
    return row
  }
  // 0줄 — 판이 바뀌었거나(다른 기기가 먼저 고침) 줄이 없다(지워짐)
  const { data: cur, error: readError } = await db.from('module_data').select('*').eq('id', input.id).eq('workspace_id', workspaceId).maybeSingle()
  if (readError) throw readError
  if (cur) {
    const theirs = cur as Record<string, unknown>
    const keepId = `ow_${input.id}_${Date.now().toString(36)}`.slice(0, 120)
    const { error: keepError } = await db.from('module_data').insert({
      id: keepId,
      workspace_id: workspaceId,
      module_key: moduleKey,
      bucket: `${bucket}${OVERWRITTEN_SUFFIX}`,
      client_id: typeof theirs.client_id === 'string' ? theirs.client_id : null,
      payload: { originalId: input.id, originalUpdatedAt: theirs.updated_at ?? '', replacedAt: now, data: theirs.payload ?? {} },
    })
    if (keepError) {
      throw new Error('다른 기기에서 먼저 고친 내용이 있어 저장하지 않았어요(그 내용을 보관하지 못했어요) — 새로 고친 뒤 다시 저장해 주세요.')
    }
    announceOverwrote(moduleKey, bucket)
  }
  const row = await saveRow(workspaceId, moduleKey, bucket, input)
  rowVersions.set(row.id, row.updatedAt)
  return row
}

function announceOverwrote(moduleKey: string, bucket: string): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(MODULE_OVERWROTE_EVENT, { detail: { moduleKey, bucket } }))
  } catch {
    /* 알림을 못 보내도 보관 · 저장은 끝났다 */
  }
}

export async function deleteRow(
  workspaceId: string | null,
  moduleKey: string,
  bucket: string,
  id: string,
): Promise<void> {
  if (isCloud() && workspaceId) {
    try {
      const { error } = await getSupabaseClient().from('module_data').delete().eq('id', id).eq('workspace_id', workspaceId)
      if (error && !missingTable(error.message)) throw error
      if (!error) return
    } catch (cause) {
      if (!(cause instanceof Error && missingTable(cause.message))) throw cause
    }
  }
  const key = keyOf(moduleKey, bucket, workspaceId)
  writeLocal(key, readLocal(key).filter((r) => r.id !== id))
}

/**
 * 이 모듈의 한 갈래를 통째로 바꾼다 (가져오기·되돌리기용).
 * D-120: 새 줄을 먼저 넣고(같은 id 는 고쳐 쓰고) 그다음 새 목록에 없는 줄만 지운다 —
 * 예전에는 먼저 다 지우고 넣어서, 넣기가 실패하면 갈래가 통째로 비었다.
 */
export async function replaceRows(
  workspaceId: string | null,
  moduleKey: string,
  bucket: string,
  rows: ModuleRow[],
): Promise<void> {
  if (isCloud() && workspaceId) {
    try {
      const client = getSupabaseClient()
      let usable = true
      if (rows.length > 0) {
        const { error } = await client.from('module_data').upsert(
          rows.map((r) => ({
            id: r.id,
            workspace_id: workspaceId,
            module_key: moduleKey,
            bucket,
            client_id: r.clientId || null,
            payload: r.data,
            updated_at: r.updatedAt,
          })),
          { onConflict: 'id' },
        )
        if (error && !missingTable(error.message)) throw error
        if (error) usable = false
      }
      if (usable) {
        let del = client.from('module_data').delete().eq('workspace_id', workspaceId).eq('module_key', moduleKey).eq('bucket', bucket)
        if (rows.length > 0) del = del.not('id', 'in', `(${rows.map((r) => `"${r.id.replace(/"/g, '')}"`).join(',')})`)
        const { error: delError } = await del
        if (delError && !missingTable(delError.message)) throw delError
        if (!delError) return
      }
    } catch (cause) {
      if (!(cause instanceof Error && missingTable(cause.message))) throw cause
    }
  }
  writeLocal(keyOf(moduleKey, bucket, workspaceId), rows)
}

/** 화면에서 바로 쓰기 좋은 모양 — id 와 내용만 */
export function rowData<T>(row: ModuleRow): T & { id: string; clientId: string } {
  return { ...(row.data as T), id: row.id, clientId: row.clientId }
}
