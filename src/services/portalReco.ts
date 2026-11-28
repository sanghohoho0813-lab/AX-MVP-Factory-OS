/**
 * D-689 고객 화면 '담당자가 추천해요' — 내부 OS 쪽 데이터(0036 portal_recommendations · portal_recommendation_interest).
 *
 *  - 읽기: 작업공간 구성원은 표를 직접 읽는다(RLS · 0026 허락 문 그대로).
 *  - 쓰기: 올리기 · 내리기는 서버 함수만(portal_show_recommendation · portal_withdraw_recommendation) — 업체마다 3개까지 · 올리기 번호로 두 번 눌러도 한 건.
 *  - [관심 있어요] 는 고객 계정만 남긴다(여기서 쓰지 않는다 · 쓸 수도 없다).
 *  - 0036 을 아직 넣지 않았거나 되돌렸으면 isRecoOff — 화면은 그 칸을 숨기고 예전 그대로.
 *  - 연습 모드(로컬): 추천을 이 브라우저에 — 고객 관심 기록은 없다(고객 계정이 없으므로).
 */
import { getDataModeConfig } from '../data/dataMode'
import { getSupabaseClient } from '../lib/supabase/client'
import { generateId, notifyStoreChanged, readJson, STORAGE_KEYS, writeJson } from '../storage/localStore'
import { nowIso } from '../lib/appClock'
import { RECO_LIMIT, refKey, type RecoKind, type RecoSourceRef } from './portalRecoRules'

export interface PortalReco {
  id: string
  clientId: string
  kind: RecoKind
  title: string
  reason: string
  deadline: string | null
  linkUrl: string | null
  sourceRef: RecoSourceRef | null
  status: 'shown' | 'withdrawn'
  shownAt: string
  withdrawnAt: string | null
  clientKey: string
}

export interface PortalRecoInterest {
  linkId: string
  recId: string
  clientId: string
  interestedAt: string
}

export interface ShowRecoInput {
  clientKey: string
  kind: RecoKind
  title: string
  reason: string
  deadline: string | null
  linkUrl: string | null
  sourceRef: RecoSourceRef | null
}

const isLocal = () => getDataModeConfig().mode === 'local'
const str = (v: unknown, f = '') => (typeof v === 'string' ? v : f)
const nul = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null)

/** 0036 이 없거나 되돌린 상태인가 — 함수 · 표가 없거나, 실행 · 읽기 권한이 거둬졌을 때 */
export function isRecoOff(cause: unknown): boolean {
  const o = cause as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown } | null
  const msg = [o?.message, o?.code, o?.details, o?.hint].filter((v) => typeof v === 'string').join(' ') || String(cause)
  return (
    /could not find the (?:function|table)|schema cache|PGRST20[25]|42883|42P01|relation .*portal_recommendation.* does not exist/i.test(msg) ||
    /permission denied for function portal_(?:recommendations|recommendation_interest|show_recommendation|withdraw_recommendation)\b/i.test(msg) ||
    /permission denied for table portal_recommendation(?:s|_interest)\b/i.test(msg)
  )
}

/** 서버가 돌려준 막힌 까닭을 사람 말로(한국어로 적어 던진 것은 그대로) */
export function recoErrorText(cause: unknown, fallback: string): string {
  const o = cause as { message?: unknown; code?: unknown } | null
  const msg = typeof o?.message === 'string' ? o.message : ''
  if (/[가-힣]/.test(msg)) return msg
  if (o?.code === '42501' || /not allowed|permission denied/i.test(msg)) return '이 업체에 추천을 올릴 권한이 없어요.'
  if (o?.code === 'P0002' || /not found/i.test(msg)) return '그 업체 · 추천을 찾지 못했어요 — 새로 불러온 뒤 다시 해 주세요.'
  return fallback
}

function refOf(v: unknown): RecoSourceRef | null {
  const o = v as { type?: unknown; id?: unknown } | null
  if (!o || typeof o.type !== 'string' || typeof o.id !== 'string') return null
  if (o.type !== 'grant' && o.type !== 'insight' && o.type !== 'manual') return null
  return { type: o.type, id: o.id }
}

function recoFromRow(r: Record<string, unknown>): PortalReco {
  return {
    id: str(r.id),
    clientId: str(r.operations_client_id),
    kind: str(r.kind) === 'grant' ? 'grant' : 'task',
    title: str(r.title),
    reason: str(r.reason),
    deadline: nul(r.deadline),
    linkUrl: nul(r.link_url),
    sourceRef: refOf(r.source_ref),
    status: str(r.status) === 'withdrawn' ? 'withdrawn' : 'shown',
    shownAt: str(r.shown_at),
    withdrawnAt: nul(r.withdrawn_at),
    clientKey: str(r.client_key),
  }
}

const RECO_COLS = 'id, operations_client_id, kind, title, reason, deadline, link_url, source_ref, status, shown_at, withdrawn_at, client_key'

/* ------------------------------------------------------------------ */
/* 연습 모드(로컬)                                                        */
/* ------------------------------------------------------------------ */

const local = {
  all: () => readJson<PortalReco[]>(STORAGE_KEYS.portalRecos, []),
  write(next: PortalReco[]) {
    writeJson(STORAGE_KEYS.portalRecos, next)
    notifyStoreChanged()
  },
}

function localShow(clientId: string, input: ShowRecoInput): { id: string; created: boolean } {
  const all = local.all()
  const same = all.find((r) => r.clientKey === input.clientKey)
  if (same) return { id: same.id, created: false }
  const shown = all.filter((r) => r.clientId === clientId && r.status === 'shown')
  const dup = input.sourceRef ? shown.find((r) => refKey(r.sourceRef) === refKey(input.sourceRef)) : undefined
  if (dup) return { id: dup.id, created: false }
  if (shown.length >= RECO_LIMIT) throw new Error(`고객 화면에는 추천을 ${RECO_LIMIT}개까지 올려요 — 하나를 내린 뒤 올려 주세요.`)
  const id = generateId()
  local.write([
    {
      id,
      clientId,
      kind: input.kind,
      title: input.title.trim(),
      reason: input.reason.trim(),
      deadline: input.deadline,
      linkUrl: input.linkUrl,
      sourceRef: input.sourceRef,
      status: 'shown',
      shownAt: nowIso(),
      withdrawnAt: null,
      clientKey: input.clientKey,
    },
    ...all,
  ])
  return { id, created: true }
}

/* ------------------------------------------------------------------ */
/* 읽기                                                                  */
/* ------------------------------------------------------------------ */

/** 이 업체에 올린 추천(내린 것 포함 · 최근 것 먼저) */
export async function listClientRecos(workspaceId: string | null, clientId: string): Promise<PortalReco[]> {
  if (isLocal()) return local.all().filter((r) => r.clientId === clientId).sort((a, b) => b.shownAt.localeCompare(a.shownAt))
  if (!workspaceId) throw new Error('선택된 작업공간이 없습니다.')
  const { data, error } = await getSupabaseClient()
    .from('portal_recommendations')
    .select(RECO_COLS)
    .eq('workspace_id', workspaceId)
    .eq('operations_client_id', clientId)
    .order('shown_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []).map((r) => recoFromRow(r as Record<string, unknown>))
}

/** 작업공간 전체 — 지금 올라와 있는 추천(오늘 화면 · 고객 화면 보기용 · 가벼운 칸) */
export async function listShownRecos(workspaceId: string | null): Promise<PortalReco[]> {
  if (isLocal()) return local.all().filter((r) => r.status === 'shown')
  if (!workspaceId) return []
  const { data, error } = await getSupabaseClient()
    .from('portal_recommendations')
    .select(RECO_COLS)
    .eq('workspace_id', workspaceId)
    .eq('status', 'shown')
    .order('shown_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return (data ?? []).map((r) => recoFromRow(r as Record<string, unknown>))
}

/** 고객 계정이 누른 [관심 있어요](이 업체 또는 작업공간 전체) — 연습 모드는 0 */
export async function listRecoInterests(workspaceId: string | null, clientId?: string): Promise<PortalRecoInterest[]> {
  if (isLocal() || !workspaceId) return []
  let q = getSupabaseClient()
    .from('portal_recommendation_interest')
    .select('portal_client_link_id, recommendation_id, operations_client_id, interested_at')
    .eq('workspace_id', workspaceId)
  if (clientId) q = q.eq('operations_client_id', clientId)
  const { data, error } = await q.order('interested_at', { ascending: false }).limit(2000)
  if (error) throw error
  return (data ?? []).map((r) => {
    const x = r as Record<string, unknown>
    return { linkId: str(x.portal_client_link_id), recId: str(x.recommendation_id), clientId: str(x.operations_client_id), interestedAt: str(x.interested_at) }
  })
}

/* ------------------------------------------------------------------ */
/* 쓰기 — 서버 함수만                                                      */
/* ------------------------------------------------------------------ */

export async function showReco(workspaceId: string | null, clientId: string, input: ShowRecoInput): Promise<{ id: string; created: boolean }> {
  if (isLocal()) return localShow(clientId, input)
  if (!workspaceId) throw new Error('선택된 작업공간이 없습니다.')
  const { data, error } = await getSupabaseClient().rpc('portal_show_recommendation', {
    p_workspace_id: workspaceId,
    p_client_id: clientId,
    p_client_key: input.clientKey,
    p_kind: input.kind,
    p_title: input.title,
    p_reason: input.reason,
    p_deadline: input.deadline,
    p_link_url: input.linkUrl,
    p_source_ref: input.sourceRef ?? {},
  })
  if (error) throw error
  const d = (data ?? {}) as Record<string, unknown>
  return { id: str(d.id), created: d.created === true }
}

export async function withdrawReco(recId: string): Promise<void> {
  if (isLocal()) {
    const all = local.all()
    const r = all.find((x) => x.id === recId)
    if (!r || r.status !== 'shown') throw new Error('이미 내린 추천입니다 — 새로 불러온 뒤 다시 해 주세요.')
    local.write(all.map((x) => (x.id === recId ? { ...x, status: 'withdrawn' as const, withdrawnAt: nowIso() } : x)))
    return
  }
  const { error } = await getSupabaseClient().rpc('portal_withdraw_recommendation', { p_rec_id: recId })
  if (error) throw error
}
