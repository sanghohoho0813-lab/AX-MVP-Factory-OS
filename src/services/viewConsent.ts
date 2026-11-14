/**
 * L-27 · D-608 대표가 팀장(컨설턴트) 화면을 볼 때 — 고객 자료는 팀장 본인이 허락한 동안만. 서버 0026(view_consent_*).
 *
 *  - 문은 DB 가 지킨다(RESTRICTIVE 정책) — 이 파일은 상태를 읽고 허락 · 닫기 · 요청 · 거절 함수를 부를 뿐이다.
 *  - 0026 전(함수 없음) · 되돌린 뒤(실행 권한 없음) · 로컬 모드 → 'missing' — 화면은 아무것도 그리지 않는다(지금과 같다).
 *  - 팀장(작업공간 주인): 대표 계정이 구성원일 때만 설정 칸이 보인다(외부 구독 고객은 대표가 구성원이 아니다 — 0024 → 안 보임).
 *  - 대표(full 구성원): 팀장 화면 보기 띠 아래 한 줄 — 허락 상태 · [허락 요청 보내기].
 */
import { getDataModeConfig } from '../data/dataMode'
import { getSupabaseClient } from '../lib/supabase/client'

export type ConsentDays = 1 | 7 | 30
export const CONSENT_DAYS: ConsentDays[] = [1, 7, 30]

export interface ConsentWindow {
  createdAt: string
  expiresAt: string
}

export interface ConsentHistoryItem {
  kind: 'grant' | 'request'
  createdAt: string
  /** grant: 끝나는 때 · 닫은 때 */
  expiresAt?: string
  revokedAt?: string
  /** request: 닫힌 때 · 까닭 */
  closedAt?: string
  closedReason?: 'granted' | 'declined' | ''
  /** 보낸 사람(요청) · 받은 사람(허락) 이름 */
  person: string
}

export type ConsentState =
  | { role: 'none' }
  | {
      role: 'owner'
      /** 이 작업공간 구성원인 대표 계정 수 — 0 이면 허락할 사람이 없다(설정 칸을 숨긴다) */
      viewers: number
      active: ConsentWindow | null
      request: { createdAt: string; by: string } | null
      history: ConsentHistoryItem[]
    }
  | {
      role: 'viewer'
      active: ConsentWindow | null
      request: { createdAt: string } | null
      lastClosed: { closedAt: string; closedReason: 'granted' | 'declined' | '' } | null
    }

/** 상태가 바뀌었다(허락 · 닫기 · 요청 · 거절) — 띠 · 설정 칸이 다시 읽는다 */
export const CONSENT_CHANGED = 'axmvp:view-consent-changed'

// ---------------------------------------------------------------- 규칙(순수)

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function windowOf(v: unknown): ConsentWindow | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const expiresAt = str(o.expiresAt)
  return expiresAt ? { createdAt: str(o.createdAt), expiresAt } : null
}

function reasonOf(v: unknown): 'granted' | 'declined' | '' {
  return v === 'granted' || v === 'declined' ? v : ''
}

/** 서버가 준 JSON → 화면이 쓰는 모양. 모르는 모양은 'none'(아무것도 안 그림) */
export function parseConsentState(raw: unknown): ConsentState {
  if (!raw || typeof raw !== 'object') return { role: 'none' }
  const o = raw as Record<string, unknown>
  if (o.role === 'owner') {
    const req = o.request && typeof o.request === 'object' ? (o.request as Record<string, unknown>) : null
    const history = Array.isArray(o.history)
      ? (o.history as unknown[])
          .filter((h): h is Record<string, unknown> => !!h && typeof h === 'object')
          .map((h): ConsentHistoryItem => ({
            kind: h.kind === 'grant' ? 'grant' : 'request',
            createdAt: str(h.createdAt),
            expiresAt: str(h.expiresAt) || undefined,
            revokedAt: str(h.revokedAt) || undefined,
            closedAt: str(h.closedAt) || undefined,
            closedReason: reasonOf(h.closedReason),
            person: str(h.to) || str(h.by) || '대표',
          }))
      : []
    return {
      role: 'owner',
      viewers: Number(o.viewers) || 0,
      active: windowOf(o.active),
      request: req && str(req.createdAt) ? { createdAt: str(req.createdAt), by: str(req.by) || '대표' } : null,
      history,
    }
  }
  if (o.role === 'viewer') {
    const req = o.request && typeof o.request === 'object' ? (o.request as Record<string, unknown>) : null
    const lc = o.lastClosed && typeof o.lastClosed === 'object' ? (o.lastClosed as Record<string, unknown>) : null
    return {
      role: 'viewer',
      active: windowOf(o.active),
      request: req && str(req.createdAt) ? { createdAt: str(req.createdAt) } : null,
      lastClosed: lc && str(lc.closedAt) ? { closedAt: str(lc.closedAt), closedReason: reasonOf(lc.closedReason) } : null,
    }
  }
  return { role: 'none' }
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/** '11월 21일(금) 오후 3시' — 한국 시각(Asia/Seoul) 기준. 분이 있으면 '오후 3시 20분' */
export function koWhen(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t + 9 * 60 * 60 * 1000)
  const h = d.getUTCHours()
  const m = d.getUTCMinutes()
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${WEEK[d.getUTCDay()]}) ${ampm} ${h12}시${m ? ` ${m}분` : ''}`
}

/** 남은 시간 한 마디 — '6일 남음' · '5시간 남음' · '곧 끝남' */
export function leftText(expiresAt: string, now = Date.now()): string {
  const ms = Date.parse(expiresAt) - now
  if (!Number.isFinite(ms) || ms <= 0) return '끝남'
  const hours = Math.floor(ms / 3_600_000)
  if (hours >= 24) return `${Math.floor(hours / 24)}일 남음`
  if (hours >= 1) return `${hours}시간 남음`
  return '곧 끝남'
}

/** 지난 기록 한 줄(팀장 설정 칸) */
export function historyLine(h: ConsentHistoryItem, now = Date.now()): string {
  if (h.kind === 'grant') {
    const until = h.expiresAt ? koWhen(h.expiresAt) : ''
    const state = h.revokedAt
      ? `${koWhen(h.revokedAt)}에 닫음`
      : h.expiresAt && Date.parse(h.expiresAt) <= now
        ? '기한이 지나 닫힘'
        : '지금 허락 중'
    return `${koWhen(h.createdAt)} · ${h.person}님께 허락(${until}까지) · ${state}`
  }
  const state = h.closedReason === 'granted' ? '허락함' : h.closedReason === 'declined' ? '거절함' : '답 기다림'
  return `${koWhen(h.createdAt)} · ${h.person}님이 허락 요청 · ${state}`
}

/** 함수가 없거나(0026 전) 실행 권한이 없으면(되돌림) 'missing' 으로 본다 */
export function isConsentMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  const code = String(error.code ?? '')
  return (
    code === '42883' || code === 'PGRST202' || code === '42501' ||
    /could not find the function|does not exist|schema cache|permission denied for function/i.test(String(error.message ?? ''))
  )
}

/** 화면에 보여 줄 실패 글(서버 글이 한국어면 그대로) */
export function consentErrorText(error: unknown): string {
  const msg = String((error as { message?: string })?.message ?? '')
  return /[가-힣]/.test(msg) ? msg : '잠깐 연결이 안 됐어요. 잠시 뒤 다시 눌러 주세요.'
}

// ---------------------------------------------------------------- 서버

export type ConsentLoad = { status: 'ready'; state: ConsentState } | { status: 'missing' } | { status: 'off' }

/** 같은 작업공간 상태 물음은 한 번으로 합친다 */
const inflight = new Map<string, Promise<ConsentLoad>>()
/** 0026 전(함수 없음)이면 한 시간 동안 다시 묻지 않는다 — 화면을 열 때마다 · 5분마다 404 를 쌓지 않게(새로 고치면 다시 묻는다) */
let missingUntil = 0
const MISSING_MS = 60 * 60 * 1000

export function loadConsent(workspaceId: string | null | undefined): Promise<ConsentLoad> {
  if (!workspaceId || getDataModeConfig().mode !== 'supabase') return Promise.resolve({ status: 'missing' })
  if (Date.now() < missingUntil) return Promise.resolve({ status: 'missing' })
  const hit = inflight.get(workspaceId)
  if (hit) return hit
  const run = (async (): Promise<ConsentLoad> => {
    try {
      const { data, error } = await getSupabaseClient().rpc('view_consent_state', { p_ws: workspaceId })
      if (error) {
        if (!isConsentMissing(error)) return { status: 'off' }
        missingUntil = Date.now() + MISSING_MS
        return { status: 'missing' }
      }
      return { status: 'ready', state: parseConsentState(data) }
    } catch {
      return { status: 'off' }
    } finally {
      setTimeout(() => inflight.delete(workspaceId), 0)
    }
  })()
  inflight.set(workspaceId, run)
  return run
}

async function call(fn: string, args: Record<string, unknown>): Promise<ConsentState> {
  const { data, error } = await getSupabaseClient().rpc(fn, args)
  if (error) throw error
  const state = parseConsentState(data)
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED))
  } catch {
    // 듣는 쪽이 없어도 된다
  }
  return state
}

export const grantConsent = (workspaceId: string, days: ConsentDays) => call('view_consent_grant', { p_ws: workspaceId, p_days: days })
export const revokeConsent = (workspaceId: string) => call('view_consent_revoke', { p_ws: workspaceId })
export const requestConsent = (workspaceId: string) => call('view_consent_request', { p_ws: workspaceId })
export const declineConsent = (workspaceId: string) => call('view_consent_decline', { p_ws: workspaceId })
