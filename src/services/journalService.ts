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
  follow_up: '후속조치',
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

/** 오늘까지(또는 지난) 후속조치 중 미완료 — 홈의 "오늘 반드시" 계산에 쓴다 */
export function dueFollowUps(entries: JournalEntry[], today: string): JournalEntry[] {
  return entries
    .filter((e) => e.entryType === 'follow_up' && !e.completed && e.dueDate !== '' && e.dueDate <= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

/* ------------------------------------------------------------------ */
/* 공개 API                                                               */
/* ------------------------------------------------------------------ */

export async function listJournal(workspaceId: string | null): Promise<JournalEntry[]> {
  if (isLocal()) return readLocal()
  if (!workspaceId) throw new Error('선택된 워크스페이스가 없습니다.')
  const { data, error } = await getSupabaseClient()
    .from('ops_journal_entries')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return (data ?? []).map((r) => fromRow(r as Record<string, unknown>))
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

export async function updateJournalEntry(entry: JournalEntry, patch: Partial<JournalEntry>): Promise<JournalEntry> {
  const next = normalize({ ...entry, ...patch, updatedAt: nowIso() })
  if (patch.completed !== undefined) {
    next.completedAt = patch.completed ? (entry.completedAt ?? nowIso()) : null
  }
  if (isLocal()) {
    writeLocal(readLocal().map((e) => (e.id === next.id ? next : e)))
    return next
  }
  if (!entry.workspaceId || !entry.ownerId) throw new Error('로그인과 워크스페이스가 필요합니다.')
  const row = toRow(next, entry.workspaceId, entry.ownerId)
  const { data, error } = await getSupabaseClient()
    .from('ops_journal_entries')
    .update({
      entry_date: row.entry_date,
      entry_type: row.entry_type,
      content: row.content,
      client_id: row.client_id,
      project_id: row.project_id,
      service_key: row.service_key,
      due_date: row.due_date,
      pinned: row.pinned,
      completed: row.completed,
      completed_at: row.completed_at,
    })
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
