/**
 * D-681 고객성장관리 P0 — 내부 OS 쪽 데이터(0033 portal_reports · portal_receipts).
 *
 *  - 읽기: 작업공간 구성원은 표를 직접 읽는다(RLS · 0026 허락 문 그대로). 고객 계정 이메일은 연결(portal_client_links)에서.
 *  - 쓰기: 발행 · 정정 · 내리기는 서버 함수만(portal_publish_report · portal_withdraw_report) — 한 거래 · 발행 번호로 두 번 눌러도 한 건.
 *  - 열람 · 확인 기록은 여기서 쓰지 않는다(쓸 수도 없다) — 고객 화면(My MIRAE)이 고객 계정으로만 남긴다.
 *  - 미리보기: 고객 투영과 같은 함수(portal_preview_report) · 아무것도 기록하지 않는다.
 *  - 0033 을 아직 넣지 않았거나 되돌렸으면(함수 · 표 없음 · 실행 권한 없음) isGrowthOff — 화면은 그 칸을 숨기고 예전 그대로.
 *  - 연습 모드(로컬): 보고서를 이 브라우저에 — 고객 열람 기록은 없다(고객 계정이 없으므로).
 */
import { getDataModeConfig } from '../data/dataMode'
import { getSupabaseClient } from '../lib/supabase/client'
import { generateId, notifyStoreChanged, readJson, STORAGE_KEYS, writeJson } from '../storage/localStore'
import { nowIso } from '../lib/appClock'
import type { PortalReportKind } from './portalGrowthRules'

export type PortalReportStatus = 'published' | 'superseded' | 'withdrawn'

export interface PortalReportSection {
  key: string
  title: string
  items: { text: string; date?: string | null; tag?: string | null }[]
}

export interface PortalReport {
  id: string
  workspaceId: string | null
  clientId: string
  reportGroup: string
  version: number
  kind: PortalReportKind
  title: string
  periodStart: string | null
  periodEnd: string | null
  summary: string
  sections: PortalReportSection[]
  staffNote: string
  correctionNote: string
  status: PortalReportStatus
  supersedes: string | null
  supersededBy: string | null
  publishedAt: string
  withdrawnAt: string | null
  withdrawnReason: string | null
  clientKey: string
}

export interface PortalReceipt {
  linkId: string
  itemKind: 'home' | 'report'
  itemId: string
  itemVersion: number
  firstSeenAt: string
  lastSeenAt: string
  seenCount: number
  acknowledgedAt: string | null
}

export interface PublishReportInput {
  clientKey: string
  kind: PortalReportKind
  title: string
  periodStart: string | null
  periodEnd: string | null
  summary: string
  sections: PortalReportSection[]
  staffNote: string
  sourceRefs: { type: string; id: string; at?: string }[]
  supersedes?: string | null
  correctionNote?: string
}

const isLocal = () => getDataModeConfig().mode === 'local'

/** 0033 이 없거나 되돌린 상태인가 — 함수 · 표가 없거나, 0033 함수 실행 권한이 거둬졌을 때 */
export function isGrowthOff(cause: unknown): boolean {
  const o = cause as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown } | null
  const msg = [o?.message, o?.code, o?.details, o?.hint].filter((v) => typeof v === 'string').join(' ') || String(cause)
  return (
    /could not find the (?:function|table)|schema cache|PGRST20[25]|42883|42P01|relation .*portal_re(?:ports|ceipts).* does not exist/i.test(msg) ||
    /permission denied for function portal_(?:reports|report|mark_report_seen|acknowledge_report|mark_home|growth_summary|publish_report|withdraw_report|preview_reports|preview_report|link_accounts)\b/i.test(msg) ||
    /permission denied for table portal_re(?:ports|ceipts)\b/i.test(msg)
  )
}

/** 서버가 돌려준 막힌 까닭을 사람 말로(한국어로 적어 던진 것은 그대로) */
export function growthErrorText(cause: unknown, fallback: string): string {
  const o = cause as { message?: unknown; code?: unknown } | null
  const msg = typeof o?.message === 'string' ? o.message : ''
  if (/[가-힣]/.test(msg)) return msg
  if (o?.code === '42501' || /not allowed|permission denied/i.test(msg)) return '이 업체에 보고서를 낼 권한이 없어요.'
  if (o?.code === 'P0002' || /not found/i.test(msg)) return '그 업체 · 보고서를 찾지 못했어요 — 새로 불러온 뒤 다시 해 주세요.'
  return fallback
}

const str = (v: unknown, f = '') => (typeof v === 'string' ? v : f)
const nul = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null)

function sectionsOf(v: unknown): PortalReportSection[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s) => ({
      key: str(s.key),
      title: str(s.title),
      items: Array.isArray(s.items)
        ? (s.items as unknown[])
            .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object' && typeof (i as { text?: unknown }).text === 'string')
            .map((i) => ({ text: str(i.text), date: nul(i.date), tag: nul(i.tag) }))
        : [],
    }))
}

function reportFromRow(r: Record<string, unknown>): PortalReport {
  return {
    id: str(r.id),
    workspaceId: nul(r.workspace_id),
    clientId: str(r.operations_client_id),
    reportGroup: str(r.report_group),
    version: Number(r.version) || 1,
    kind: str(r.kind, 'progress') as PortalReportKind,
    title: str(r.title),
    periodStart: nul(r.period_start),
    periodEnd: nul(r.period_end),
    summary: str(r.summary),
    sections: sectionsOf(r.sections),
    staffNote: str(r.staff_note),
    correctionNote: str(r.correction_note),
    status: (['published', 'superseded', 'withdrawn'].includes(str(r.status)) ? str(r.status) : 'published') as PortalReportStatus,
    supersedes: nul(r.supersedes),
    supersededBy: nul(r.superseded_by),
    publishedAt: str(r.published_at),
    withdrawnAt: nul(r.withdrawn_at),
    withdrawnReason: nul(r.withdrawn_reason),
    clientKey: str(r.client_key),
  }
}

function receiptFromRow(r: Record<string, unknown>): PortalReceipt {
  return {
    linkId: str(r.portal_client_link_id),
    itemKind: str(r.item_kind) === 'home' ? 'home' : 'report',
    itemId: str(r.item_id),
    itemVersion: Number(r.item_version) || 1,
    firstSeenAt: str(r.first_seen_at),
    lastSeenAt: str(r.last_seen_at),
    seenCount: Number(r.seen_count) || 1,
    acknowledgedAt: nul(r.acknowledged_at),
  }
}

// 고객에게 보이지 않는 내부 칸(출처 · 내린 까닭)은 내부 화면에서만 쓴다 — 목록에는 출처를 싣지 않는다(무겁고 화면이 안 쓴다)
const REPORT_COLS =
  'id, workspace_id, operations_client_id, report_group, version, kind, title, period_start, period_end, summary, sections, staff_note, correction_note, status, supersedes, superseded_by, published_at, withdrawn_at, withdrawn_reason, client_key'

/* ------------------------------------------------------------------ */
/* 연습 모드(로컬)                                                        */
/* ------------------------------------------------------------------ */

const local = {
  reports: () => readJson<PortalReport[]>(STORAGE_KEYS.portalReports, []),
  write(next: PortalReport[]) {
    writeJson(STORAGE_KEYS.portalReports, next)
    notifyStoreChanged()
  },
}

function localPublish(clientId: string, input: PublishReportInput): { id: string; version: number; created: boolean } {
  const all = local.reports()
  const same = all.find((r) => r.clientKey === input.clientKey)
  if (same) return { id: same.id, version: same.version, created: false }
  let group = generateId()
  let version = 1
  if (input.supersedes) {
    const old = all.find((r) => r.id === input.supersedes && r.clientId === clientId)
    if (!old) throw new Error('그 보고서를 찾지 못했어요 — 새로 불러온 뒤 다시 해 주세요.')
    if (old.status !== 'published') throw new Error('이미 정정했거나 내린 보고서입니다 — 새로 불러온 뒤 다시 해 주세요.')
    if (!input.correctionNote?.trim()) throw new Error('무엇을 고쳤는지 한 줄 적어 주세요(고객에게 보입니다).')
    group = old.reportGroup
    version = old.version + 1
  }
  const id = generateId()
  const rep: PortalReport = {
    id,
    workspaceId: null,
    clientId,
    reportGroup: group,
    version,
    kind: input.kind,
    title: input.title.trim(),
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    summary: input.summary.trim(),
    sections: input.sections,
    staffNote: input.staffNote.trim(),
    correctionNote: input.supersedes ? (input.correctionNote ?? '').trim() : '',
    status: 'published',
    supersedes: input.supersedes ?? null,
    supersededBy: null,
    publishedAt: nowIso(),
    withdrawnAt: null,
    withdrawnReason: null,
    clientKey: input.clientKey,
  }
  local.write([rep, ...all.map((r) => (r.id === input.supersedes ? { ...r, status: 'superseded' as const, supersededBy: id } : r))])
  return { id, version, created: true }
}

/* ------------------------------------------------------------------ */
/* 읽기                                                                  */
/* ------------------------------------------------------------------ */

/** 이 업체에 발행한 보고서 전부(정정됨 · 내림 포함 · 최근 것 먼저) */
export async function listClientReports(workspaceId: string | null, clientId: string): Promise<PortalReport[]> {
  if (isLocal()) return local.reports().filter((r) => r.clientId === clientId).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  if (!workspaceId) throw new Error('선택된 작업공간이 없습니다.')
  const { data, error } = await getSupabaseClient()
    .from('portal_reports')
    .select(REPORT_COLS)
    .eq('workspace_id', workspaceId)
    .eq('operations_client_id', clientId)
    .order('published_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []).map((r) => reportFromRow(r as Record<string, unknown>))
}

/** 작업공간 전체 — 발행 중인 보고서(오늘 화면 후속 업무용 · 가벼운 칸만) */
export async function listPublishedReports(workspaceId: string | null): Promise<Pick<PortalReport, 'id' | 'clientId' | 'status' | 'publishedAt' | 'title' | 'periodEnd' | 'kind'>[]> {
  if (isLocal()) return local.reports().filter((r) => r.status === 'published')
  if (!workspaceId) return []
  const { data, error } = await getSupabaseClient()
    .from('portal_reports')
    .select('id, operations_client_id, status, published_at, title, period_end, kind')
    .eq('workspace_id', workspaceId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return (data ?? []).map((r) => {
    const x = r as Record<string, unknown>
    return { id: str(x.id), clientId: str(x.operations_client_id), status: 'published' as const, publishedAt: str(x.published_at), title: str(x.title), periodEnd: nul(x.period_end), kind: str(x.kind, 'progress') as PortalReportKind }
  })
}

/** 고객 계정이 남긴 열람 · 확인 기록(이 업체 또는 작업공간 전체) — 연습 모드는 0 */
export async function listReceipts(workspaceId: string | null, clientId?: string): Promise<PortalReceipt[]> {
  if (isLocal() || !workspaceId) return []
  let q = getSupabaseClient()
    .from('portal_receipts')
    .select('portal_client_link_id, item_kind, item_id, item_version, first_seen_at, last_seen_at, seen_count, acknowledged_at, operations_client_id')
    .eq('workspace_id', workspaceId)
  if (clientId) q = q.eq('operations_client_id', clientId)
  const { data, error } = await q.order('last_seen_at', { ascending: false }).limit(2000)
  if (error) throw error
  return (data ?? []).map((r) => receiptFromRow(r as Record<string, unknown>))
}

/** 작업공간 전체 기록을 업체별로(오늘 화면) — 연결 id → 업체 id 는 부르는 쪽이 연결 목록으로 잇는다 */
export async function listWorkspaceReceipts(workspaceId: string | null): Promise<PortalReceipt[]> {
  return listReceipts(workspaceId)
}

/** 이 업체에 연결된 고객 계정의 이메일(연결 id → 이메일) — 직원은 고객 프로필 표를 못 읽어 서버 함수로만. 연습 모드는 빈 칸 */
export async function listLinkAccounts(workspaceId: string | null, clientId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (isLocal() || !workspaceId) return out
  const { data, error } = await getSupabaseClient().rpc('portal_link_accounts', { p_workspace_id: workspaceId, p_client_id: clientId })
  if (error) throw error
  for (const x of (Array.isArray(data) ? data : []) as { link_id?: unknown; email?: unknown }[]) if (x.link_id) out.set(String(x.link_id), str(x.email))
  return out
}

/** 고객이 보는 모양 그대로(미리보기 — 기록 0). 연습 모드는 저장한 보고서를 같은 모양으로 */
export async function previewReport(reportId: string): Promise<Record<string, unknown>> {
  if (isLocal()) {
    const r = local.reports().find((x) => x.id === reportId)
    if (!r) throw new Error('보고서를 찾지 못했어요.')
    return {
      id: r.id, version: r.version, kind: r.kind, title: r.title, period_start: r.periodStart, period_end: r.periodEnd, summary: r.summary, status: r.status,
      published_at: r.publishedAt, corrected: r.version > 1, correction_note: r.correctionNote || null, sections: r.sections, staff_note: r.staffNote || null, seen_at: null, acknowledged_at: null,
    }
  }
  const { data, error } = await getSupabaseClient().rpc('portal_preview_report', { p_report_id: reportId })
  if (error) throw error
  return (data ?? {}) as Record<string, unknown>
}

/* ------------------------------------------------------------------ */
/* 쓰기 — 서버 함수만                                                      */
/* ------------------------------------------------------------------ */

export async function publishReport(workspaceId: string | null, clientId: string, input: PublishReportInput): Promise<{ id: string; version: number; created: boolean }> {
  if (isLocal()) return localPublish(clientId, input)
  if (!workspaceId) throw new Error('선택된 작업공간이 없습니다.')
  const { data, error } = await getSupabaseClient().rpc('portal_publish_report', {
    p_workspace_id: workspaceId,
    p_client_id: clientId,
    p_client_key: input.clientKey,
    p_kind: input.kind,
    p_title: input.title,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_summary: input.summary,
    p_sections: input.sections,
    p_staff_note: input.staffNote,
    p_source_refs: input.sourceRefs,
    p_supersedes: input.supersedes ?? null,
    p_correction_note: input.correctionNote ?? '',
  })
  if (error) throw error
  const d = (data ?? {}) as Record<string, unknown>
  return { id: str(d.id), version: Number(d.version) || 1, created: d.created === true }
}

export async function withdrawReport(reportId: string, reason: string): Promise<void> {
  if (isLocal()) {
    const all = local.reports()
    const r = all.find((x) => x.id === reportId)
    if (!r || r.status !== 'published') throw new Error('이미 내렸거나 정정한 보고서입니다 — 새로 불러온 뒤 다시 해 주세요.')
    local.write(all.map((x) => (x.id === reportId ? { ...x, status: 'withdrawn' as const, withdrawnAt: nowIso(), withdrawnReason: reason.trim() || null } : x)))
    return
  }
  const { error } = await getSupabaseClient().rpc('portal_withdraw_report', { p_report_id: reportId, p_reason: reason })
  if (error) throw error
}

/** 고객 화면 주소 — 로그인하면 그 보고서로(계정마다 연결 id 가 달라 보고서 id 만 쓴다) */
export function reportCustomerUrl(base: string, reportId: string): string {
  return `${base.replace(/\/+$/, '')}/my-projects/reports/${reportId}`
}
