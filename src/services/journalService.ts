/**
 * 업무 일기 저장소 — 통화·결정·후속조치·막힘·성과·아이디어를 시간축으로 남긴다.
 *
 * local 모드는 localStorage, supabase 모드는 ops_journal_entries(owner 본인만 RLS).
 * 고객에게는 어떤 경로로도 노출되지 않는다(고객 투영 RPC 는 이 테이블을 읽지 않는다).
 */

import { getDataModeConfig } from '../data/dataMode'
import { getSupabaseClient } from '../lib/supabase/client'
import { nowIso, todayLocalDate } from '../lib/appClock'
import { generateId, notifyStoreChanged, readJson, STORAGE_KEYS, writeJson } from '../storage/localStore'
import type { JournalEntry, JournalEntryType } from '../types/bridge'

export const JOURNAL_TYPES: JournalEntryType[] = ['note', 'call', 'decision', 'follow_up', 'blocker', 'win', 'idea']

export const JOURNAL_TYPE_LABEL: Record<JournalEntryType, string> = {
  note: '메모',
  call: '통화',
  decision: '결정',
  follow_up: '할 일',
  blocker: '막힘',
  win: '성과',
  idea: '아이디어',
}

/**
 * 종류별 색 — 기본은 무채색이다.
 * 막힘(빨강)·성과(초록)만 색을 갖는다. 일곱 종류를 전부 다른 색으로 칠하면
 * 기록 목록이 색종이처럼 보여 정작 막힌 건이 눈에 띄지 않는다.
 */
export const JOURNAL_TYPE_CLASS: Record<JournalEntryType, string> = {
  note: 'bg-slate-100 text-slate-600',
  call: 'bg-slate-100 text-slate-600',
  decision: 'bg-slate-100 text-slate-600',
  follow_up: 'bg-slate-100 text-slate-600',
  blocker: 'bg-danger-50 text-danger-700',
  win: 'bg-success-50 text-success-700',
  idea: 'bg-slate-100 text-slate-600',
}

export function isJournalType(v: unknown): v is JournalEntryType {
  return typeof v === 'string' && (JOURNAL_TYPES as string[]).includes(v)
}

export type JournalRange = 'today' | 'week' | 'all'

export interface JournalFilter {
  range: JournalRange
  clientId?: string | null
  type?: JournalEntryType | null
  /** 후속조치 중 아직 안 끝난 것만 */
  openFollowUpsOnly?: boolean
}

export interface CreateJournalInput {
  content: string
  entryType?: JournalEntryType
  entryDate?: string
  clientId?: string | null
  projectId?: string | null
  serviceKey?: string | null
  dueDate?: string
  pinned?: boolean
}

/* ------------------------------------------------------------------ */
/* 정규화                                                                */
/* ------------------------------------------------------------------ */

function normalize(value: Partial<JournalEntry>): JournalEntry {
  const now = nowIso()
  return {
    id: value.id ?? generateId(),
    workspaceId: value.workspaceId ?? null,
    ownerId: value.ownerId ?? null,
    entryDate: value.entryDate ?? todayLocalDate(),
    entryType: isJournalType(value.entryType) ? value.entryType : 'note',
    content: typeof value.content === 'string' ? value.content : '',
    clientId: value.clientId ?? null,
    projectId: value.projectId ?? null,
    serviceKey: value.serviceKey ?? null,
    dueDate: value.dueDate ?? '',
    pinned: value.pinned === true,
    completed: value.completed === true,
    completedAt: value.completedAt ?? null,
    createdAt: value.createdAt ?? now,
    updatedAt: value.updatedAt ?? now,
  }
}

function fromRow(row: Record<string, unknown>): JournalEntry {
  return normalize({
    id: String(row.id),
    workspaceId: (row.workspace_id as string) ?? null,
    ownerId: (row.owner_id as string) ?? null,
    entryDate: String(row.entry_date ?? ''),
    entryType: row.entry_type as JournalEntryType,
    content: String(row.content ?? ''),
    clientId: (row.client_id as string) ?? null,
    projectId: (row.project_id as string) ?? null,
    serviceKey: (row.service_key as string) ?? null,
    dueDate: (row.due_date as string) ?? '',
    pinned: row.pinned === true,
    completed: row.completed === true,
    completedAt: (row.completed_at as string) ?? null,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  })
}

function toRow(entry: JournalEntry, workspaceId: string, ownerId: string) {
  return {
    id: entry.id,
    workspace_id: workspaceId,
    owner_id: ownerId,
    entry_date: entry.entryDate,
    entry_type: entry.entryType,
    content: entry.content,
    client_id: entry.clientId,
    project_id: entry.projectId,
    service_key: entry.serviceKey,
    due_date: entry.dueDate || null,
    pinned: entry.pinned,
    completed: entry.completed,
    completed_at: entry.completedAt,
  }
}

/* ------------------------------------------------------------------ */
/* 로컬                                                                  */
/* ------------------------------------------------------------------ */

function isLocal(): boolean {
  return getDataModeConfig().mode === 'local'
}

function readLocal(): JournalEntry[] {
  return readJson<Partial<JournalEntry>[]>(STORAGE_KEYS.journalEntries, []).map(normalize)
}

function writeLocal(entries: JournalEntry[]): void {
  writeJson(STORAGE_KEYS.journalEntries, entries)
  notifyStoreChanged()
}

/* ------------------------------------------------------------------ */
/* 순수 도우미 (테스트 가능)                                              */
/* ------------------------------------------------------------------ */

/** YYYY-MM-DD 문자열에서 n 일 전 날짜 */
/**
 * '내일로 미루기' 의 새 기한 (D-122) — 오늘 기준 내일, 단 기한이 이미 더 뒤면 그 다음 날.
 * 예전에는 늘 오늘+1 이라, 달력에서 10/5 할 일을 미루면 9/27 로 당겨졌다.
 */
export function postponedDue(dueDate: string, today: string): string {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && dueDate > today ? dueDate : today
  return shiftDate(base, 1)
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** 이번 주 월요일 (한국 기준 주 시작) */
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = dt.getDay() // 0=일
  const back = dow === 0 ? 6 : dow - 1
  return shiftDate(date, -back)
}

export function applyJournalFilter(entries: JournalEntry[], filter: JournalFilter, today: string): JournalEntry[] {
  const start = filter.range === 'today' ? today : filter.range === 'week' ? weekStart(today) : null
  return entries
    .filter((e) => (start === null ? true : e.entryDate >= start && e.entryDate <= today))
    .filter((e) => (filter.clientId ? e.clientId === filter.clientId : true))
    .filter((e) => (filter.type ? e.entryType === filter.type : true))
    .filter((e) => (filter.openFollowUpsOnly ? e.entryType === 'follow_up' && !e.completed : true))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (a.entryDate !== b.entryDate) return b.entryDate.localeCompare(a.entryDate)
      return b.createdAt.localeCompare(a.createdAt)
    })
}

/** 오늘까지(또는 지난) 할 일 중 미완료 — 오늘 화면의 맨 위 */
export function dueFollowUps(entries: JournalEntry[], today: string): JournalEntry[] {
  return entries
    .filter((e) => e.entryType === 'follow_up' && !e.completed && e.dueDate !== '' && e.dueDate <= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

/**
 * 어떤 날의 할 일 — 달력의 그 날 칸과 그날 목록이 함께 쓴다.
 * 기한이 그 날인 것만 본다(지난 것은 오늘 화면에서 따로 챙긴다).
 */
export function todosOn(entries: JournalEntry[], date: string): JournalEntry[] {
  return entries
    .filter((e) => e.entryType === 'follow_up' && e.dueDate === date)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return a.createdAt.localeCompare(b.createdAt)
    })
}

/**
 * 자주 쓰는 할 일 문구.
 *
 * 컨설팅은 같은 동작이 업체만 바꿔 가며 반복된다 — 서류를 달라 하고, 접수하고,
 * 결과를 알리고, 잔금을 청구한다. 매번 처음부터 타자를 치면 기록을 안 남기게
 * 되므로, 한 번 눌러 넣고 뒷말만 고치게 한다. (문구는 시작점일 뿐 그대로
 * 저장되지 않는다 — 사람이 고쳐서 넣는다.)
 */
export const TODO_PRESETS: { label: string; text: string }[] = [
  { label: '통화', text: '대표님 통화 — ' },
  { label: '서류 요청', text: '서류 요청 문자 보내기 — ' },
  { label: '서류 확인', text: '받은 서류 확인하고 보관 — ' },
  { label: '신청서', text: '신청서 초안 쓰기 — ' },
  { label: '접수', text: '기관 접수 — ' },
  { label: '결과 확인', text: '진행 결과 확인 — ' },
  { label: '보고', text: '진행 상황 보고 보내기 — ' },
  { label: '청구', text: '잔금 청구 — ' },
]

/* ------------------------------------------------------------------ */
/* 공개 API                                                               */
/* ------------------------------------------------------------------ */

export async function listJournal(workspaceId: string | null): Promise<JournalEntry[]> {
  if (isLocal()) return readLocal()
  if (!workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  // D-122: 예전에는 새 것 1000건에서 끊겨, 몇 달 쓰면 오래된 업체 기록 · 오래 밀린 할 일이 조용히 사라졌다.
  // 1000건씩 끝까지 읽는다(안전 상한 20,000건).
  const PAGE = 1000
  const out: JournalEntry[] = []
  for (let from = 0; from < 20_000; from += PAGE) {
    const { data, error } = await getSupabaseClient()
      .from('ops_journal_entries')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) throw error
    const rows = data ?? []
    out.push(...rows.map((r) => fromRow(r as Record<string, unknown>)))
    if (rows.length < PAGE) break
  }
  return out
}

export async function createJournalEntry(
  workspaceId: string | null,
  ownerId: string | null,
  input: CreateJournalInput,
): Promise<JournalEntry> {
  const content = input.content.trim()
  if (!content) throw new Error('내용을 입력해 주세요.')
  const entry = normalize({
    content,
    entryType: input.entryType ?? 'note',
    entryDate: input.entryDate ?? todayLocalDate(),
    clientId: input.clientId ?? null,
    projectId: input.projectId ?? null,
    serviceKey: input.serviceKey ?? null,
    dueDate: input.dueDate ?? '',
    pinned: input.pinned === true,
    workspaceId,
    ownerId,
  })
  if (isLocal()) {
    writeLocal([entry, ...readLocal()])
    return entry
  }
  if (!workspaceId || !ownerId) throw new Error('로그인과 워크스페이스가 필요합니다.')
  const { data, error } = await getSupabaseClient()
    .from('ops_journal_entries')
    .insert(toRow(entry, workspaceId, ownerId))
    .select()
    .single()
  if (error) throw error
  return fromRow(data as Record<string, unknown>)
}

/** 고친 칸 → 표 칸 이름 (D-122: 고친 칸만 보낸다) */
const PATCH_COLUMNS: Partial<Record<keyof JournalEntry, keyof ReturnType<typeof toRow>>> = {
  entryDate: 'entry_date',
  entryType: 'entry_type',
  content: 'content',
  clientId: 'client_id',
  projectId: 'project_id',
  serviceKey: 'service_key',
  dueDate: 'due_date',
  pinned: 'pinned',
  completed: 'completed',
}

export async function updateJournalEntry(entry: JournalEntry, patch: Partial<JournalEntry>): Promise<JournalEntry> {
  // D-122: 로컬은 저장된 가장 새 값 위에 얹는다 — 화면이 들고 있던 예전 사본으로 덮지 않게
  const base = isLocal() ? (readLocal().find((e) => e.id === entry.id) ?? entry) : entry
  const next = normalize({ ...base, ...patch, updatedAt: nowIso() })
  if (patch.completed !== undefined) {
    next.completedAt = patch.completed ? (base.completedAt ?? nowIso()) : null
  }
  if (isLocal()) {
    writeLocal(readLocal().map((e) => (e.id === next.id ? next : e)))
    return next
  }
  if (!entry.workspaceId || !entry.ownerId) throw new Error('로그인과 워크스페이스가 필요합니다.')
  const row = toRow(next, entry.workspaceId, entry.ownerId)
  // D-122: 고친 칸만 보낸다. 예전에는 모든 칸을 화면의 사본으로 보내서, 고정한 뒤 목록이 다시 읽히기 전에
  // '완료' 를 누르면 고정이 풀렸다.
  const update: Record<string, unknown> = {}
  for (const key of Object.keys(patch) as (keyof JournalEntry)[]) {
    const col = PATCH_COLUMNS[key]
    if (col) update[col] = row[col]
  }
  if (patch.completed !== undefined) update.completed_at = row.completed_at
  if (Object.keys(update).length === 0) return entry
  const { data, error } = await getSupabaseClient()
    .from('ops_journal_entries')
    .update(update)
    .eq('id', entry.id)
    .select()
    .single()
  if (error) throw error
  return fromRow(data as Record<string, unknown>)
}

export async function deleteJournalEntry(entry: JournalEntry): Promise<void> {
  if (isLocal()) {
    writeLocal(readLocal().filter((e) => e.id !== entry.id))
    return
  }
  const { error } = await getSupabaseClient().from('ops_journal_entries').delete().eq('id', entry.id)
  if (error) throw error
}
