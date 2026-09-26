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
    return (data ?? []).map((row) => fromRow(row as Record<string, unknown>))
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
