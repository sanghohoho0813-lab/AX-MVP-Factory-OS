/**
 * 지원사업 공고 · 보낸 기록 저장 (D-141).
 *
 *  - 공고: 모듈 기록 `grants/notices` (업체와 상관없는 줄). 보낸 기록: `grants/sent` (업체마다).
 *  - 공개(가망고객 화면): 클라우드 모드에서는 `portal_grant_notices` 표에 **공개해도 되는 칸만** 복사해 둔다.
 *    가망고객은 `portal_grant_notices()` 함수로만 읽는다 — 내부 표를 읽지 않는다.
 *    표가 아직 없으면(대표가 SQL 을 실행하기 전) 조용히 건너뛰고, 내부 화면은 그대로 쓴다.
 *  - 알림 신청: 클라우드 모드는 `portal_grant_alert_request()` → 고객 이벤트('상담 신청', 출처 grant_finder)
 *    → 내부 '잠재고객 상담신청' 함. 로컬 모드는 이 브라우저의 이벤트함에 바로 넣는다.
 */
import { getDataModeConfig } from '../../data/dataMode'
import { getSupabaseClient } from '../../lib/supabase/client'
import { generateId } from '../../storage/localStore'
import { nowIso } from '../../lib/appClock'
import { deleteRow, listRows, saveRow } from '../moduleData'
import { recordLocalEvent } from '../customerBridgeService'
import { normalizeNotice, type GrantNotice } from './grantMatch'

const MODULE = 'grants'
const NOTICES = 'notices'
const SENT = 'sent'

const isCloud = () => getDataModeConfig().mode === 'supabase'

export async function listNotices(workspaceId: string | null): Promise<GrantNotice[]> {
  const rows = await listRows(workspaceId, MODULE, NOTICES)
  return rows.map((r) => normalizeNotice({ ...r.data, createdAt: r.createdAt, updatedAt: r.updatedAt }, r.id, r.updatedAt)).filter((n): n is GrantNotice => n !== null)
}

/** 같은 공고(제목 · 마감이 같음)를 두 번 넣지 않는다 */
export function sameNotice(a: Pick<GrantNotice, 'title' | 'applyEnd'>, b: Pick<GrantNotice, 'title' | 'applyEnd'>): boolean {
  const k = (s: string) => s.replace(/\s+/g, '').replace(/[[\]()·,.]/g, '')
  return k(a.title) === k(b.title) && a.applyEnd === b.applyEnd
}

export async function saveNotice(workspaceId: string | null, input: Omit<GrantNotice, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string }): Promise<GrantNotice> {
  const id = input.id ?? `gn_${generateId()}`
  const now = nowIso()
  const clean = normalizeNotice({ ...input, createdAt: input.createdAt ?? now, updatedAt: now }, id, now)
  if (!clean) throw new Error('공고 이름을 적어 주세요.')
  const { id: _id, ...data } = clean
  void _id
  await saveRow(workspaceId, MODULE, NOTICES, { id, data: data as unknown as Record<string, unknown> })
  await syncPublic(workspaceId, clean).catch(() => undefined)
  return clean
}

/** 여러 개 한꺼번에(기업마당 파일 · 예시) — 이미 있는 공고는 건너뛴다 */
export async function addNotices(workspaceId: string | null, drafts: Omit<GrantNotice, 'id' | 'createdAt' | 'updatedAt'>[], existing: readonly GrantNotice[]): Promise<{ added: number; skipped: number }> {
  let added = 0
  let skipped = 0
  const have = [...existing]
  for (const d of drafts) {
    if (have.some((x) => sameNotice(x, d))) {
      skipped += 1
      continue
    }
    const saved = await saveNotice(workspaceId, d)
    have.push(saved)
    added += 1
  }
  return { added, skipped }
}

export async function removeNotice(workspaceId: string | null, notice: GrantNotice): Promise<void> {
  await deleteRow(workspaceId, MODULE, NOTICES, notice.id)
  // 공개 사본은 지우지 않고 '내림' 으로 둔다(추가만 원칙)
  await syncPublic(workspaceId, { ...notice, published: false }).catch(() => undefined)
}

/* ------------------------------------------------------------------ */
/* 공개 사본                                                             */
/* ------------------------------------------------------------------ */

/** 가망고객에게 보여도 되는 칸만 — 내부 메모 · 출처 · 누가 넣었는지는 빼고 */
export function publicPayload(n: GrantNotice): Record<string, unknown> {
  return {
    id: n.id,
    title: n.title,
    agency: n.agency,
    operator: n.operator,
    category: n.category,
    applyStart: n.applyStart,
    applyEnd: n.applyEnd,
    deadlineKind: n.deadlineKind,
    amountText: n.amountText,
    target: n.target,
    summary: n.summary.slice(0, 600),
    url: n.url,
    rules: n.rules,
    source: 'manual',
    published: true,
    updatedAt: n.updatedAt,
  }
}

function missingPortalTable(message: string): boolean {
  return /portal_grant_notices/.test(message) && /(does not exist|not find|schema cache|Could not find)/i.test(message)
}

export type PublicSyncState = 'local' | 'synced' | 'no_table'

let lastSync: PublicSyncState = 'local'
export const publicSyncState = () => lastSync

async function syncPublic(workspaceId: string | null, n: GrantNotice): Promise<void> {
  if (!isCloud() || !workspaceId) {
    lastSync = 'local'
    return
  }
  const { error } = await getSupabaseClient()
    .from('portal_grant_notices')
    .upsert({ id: n.id, workspace_id: workspaceId, payload: publicPayload(n), is_published: n.published && n.source !== 'example', updated_at: nowIso() })
  if (error) {
    if (missingPortalTable(error.message)) {
      lastSync = 'no_table'
      return
    }
    throw error
  }
  lastSync = 'synced'
}

/** 공개 화면이 읽는 공고 — 로그인 없이. 클라우드는 함수로만, 로컬은 이 브라우저 기록에서 공개한 것만 */
export async function listPublicNotices(): Promise<{ notices: GrantNotice[]; ready: boolean }> {
  if (isCloud()) {
    const { data, error } = await getSupabaseClient().rpc('portal_grant_notices')
    if (error) return { notices: [], ready: false }
    const list = (Array.isArray(data) ? data : []) as unknown[]
    const now = nowIso()
    return {
      notices: list
        .map((raw, i) => {
          const r = raw as Record<string, unknown>
          return normalizeNotice({ ...r, published: true }, typeof r.id === 'string' ? r.id : `pub_${i}`, now)
        })
        .filter((n): n is GrantNotice => n !== null),
      ready: true,
    }
  }
  const all = await listNotices(null)
  return { notices: all.filter((n) => n.published), ready: true }
}

/* ------------------------------------------------------------------ */
/* 가망고객 알림 신청                                                     */
/* ------------------------------------------------------------------ */

export interface AlertRequest {
  companyName: string
  name: string
  phone: string
  email: string
  industry: string
  /** 사람 말 조건 — '경기 파주시 · 제조업 · 1~3년' */
  conditions: string
  /** 링크 뒤 값(구간) — 잠재고객 기록에 그대로 */
  query: string
  /** 맞는 공고 제목 몇 개 */
  titles: string[]
  fitCount: number
  /** 영업자가 보낸 링크로 들어왔으면 그 표시 */
  from: string
  consent: boolean
}

export function alertPayload(r: AlertRequest): Record<string, unknown> {
  const titles = r.titles.slice(0, 5).map((t) => t.slice(0, 80))
  return {
    company_name: r.companyName.trim().slice(0, 60),
    representative_name: r.name.trim().slice(0, 30),
    phone: r.phone.trim().slice(0, 30),
    email: r.email.trim().slice(0, 80),
    industry: r.industry.trim().slice(0, 40),
    program: '지원사업 알림',
    message: `지원사업 알림 신청 — ${r.conditions.slice(0, 120)}${r.fitCount ? ` · 맞는 공고 ${r.fitCount}건` : ''}${titles.length ? ` (${titles.slice(0, 3).join(' / ')})` : ''}`.slice(0, 300),
    grant_query: r.query.slice(0, 500),
    grant_titles: titles,
    grant_fit_count: r.fitCount,
    ...(r.from ? { referrer_code: r.from.slice(0, 40) } : {}),
    consent: true,
  }
}

export function validateAlert(r: AlertRequest): string {
  if (!r.companyName.trim()) return '회사 이름을 적어 주세요.'
  if (!r.phone.trim() && !r.email.trim()) return '연락처(휴대폰 또는 이메일)를 하나는 적어 주세요.'
  if (r.phone.trim() && !/^[\d\-\s+()]{8,20}$/.test(r.phone.trim())) return '휴대폰 번호를 다시 확인해 주세요.'
  if (r.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim())) return '이메일을 다시 확인해 주세요.'
  if (!r.consent) return '연락을 받으려면 개인정보 수집 · 이용에 동의해 주세요.'
  return ''
}

export async function submitAlertRequest(r: AlertRequest): Promise<void> {
  const problem = validateAlert(r)
  if (problem) throw new Error(problem)
  const payload = alertPayload(r)
  if (isCloud()) {
    const { error } = await getSupabaseClient().rpc('portal_grant_alert_request', { p_payload: payload })
    if (error) throw new Error('지금은 신청을 받지 못했습니다. 잠시 뒤 다시 눌러 주세요.')
    return
  }
  recordLocalEvent({ eventType: 'consultation_requested', sourceType: 'grant_finder', sourceId: `gf-${Date.now().toString(36)}`, priority: 'high', payload })
}

/* ------------------------------------------------------------------ */
/* 보낸 기록 (업체마다)                                                  */
/* ------------------------------------------------------------------ */

export type SentChannel = 'kakao' | 'portal' | 'link'

export const SENT_CHANNEL_LABEL: Record<SentChannel, string> = { kakao: '카톡 문구', portal: '고객 화면', link: '찾기 링크' }

export interface SentRecord {
  id: string
  clientId: string
  noticeIds: string[]
  channel: SentChannel
  at: string
}

export async function listSent(workspaceId: string | null): Promise<SentRecord[]> {
  const rows = await listRows(workspaceId, MODULE, SENT)
  return rows
    .map((r) => ({
      id: r.id,
      clientId: r.clientId,
      noticeIds: Array.isArray(r.data.noticeIds) ? (r.data.noticeIds as unknown[]).filter((x): x is string => typeof x === 'string') : [],
      channel: (['kakao', 'portal', 'link'] as const).includes(r.data.channel as SentChannel) ? (r.data.channel as SentChannel) : 'kakao',
      at: typeof r.data.at === 'string' ? r.data.at : r.createdAt,
    }))
    .sort((a, b) => b.at.localeCompare(a.at))
}

export async function recordSent(workspaceId: string | null, clientId: string, noticeIds: string[], channel: SentChannel): Promise<SentRecord> {
  const at = nowIso()
  const row = await saveRow(workspaceId, MODULE, SENT, { clientId, data: { noticeIds, channel, at } })
  return { id: row.id, clientId, noticeIds, channel, at }
}

/** 이 업체에 이 공고를 이미 알렸나 → 마지막으로 알린 때 */
export function sentAt(sent: readonly SentRecord[], clientId: string, noticeId: string): string {
  return sent.find((s) => s.clientId === clientId && s.noticeIds.includes(noticeId))?.at ?? ''
}
