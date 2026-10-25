/**
 * SAAS-2 고객별 AI 사용량(서버) — 대표가 아닌 계정(팀장 · 구독 고객)의 AI 요청을 DB 장부(0022)로 센다.
 *
 * 순서: AI 를 부르기 전에 예약(한도 · 같은 요청 번호 · 동시 호출을 DB 가 차례로 판단) → 답하면 정산(토큰 · 비용) → 실패하면 되돌림.
 *  - 장부 함수는 고객 로그인(JWT)으로 부르되, 서버 비밀값(AI_USAGE_SECRET)을 같이 보낸다 — 고객이 직접 불러 공짜로 정산 · 되돌리기를 못 한다.
 *  - 비밀값이 없으면(대표가 아직 0022 를 적용하지 않음) 장부를 쓰지 않는다: 예전처럼(마케팅은 고객에게 닫힌 채).
 *  - 장부에 닿지 못하면(네트워크 · 시간 초과) 고객 AI 를 부르지 않는다(세지 않고 쓰는 일이 없게).
 *  - 대표 계정은 부르지 않는다(대표 AI 는 예전 그대로).
 * service_role 키는 쓰지 않는다(브라우저 · git 금지 원칙 — 서버도 anon 키 + 그 사람 로그인만).
 */

const SUPA_URL_NAMES = ['SUPABASE_URL', 'VITE_SUPABASE_URL']
const SUPA_ANON_NAMES = ['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY']
const TIMEOUT_MS = 4000

function envAny(names) {
  for (const n of names) {
    const v = process.env[n]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

/** 서버 비밀값 — 24자 이상일 때만 장부를 쓴다 */
export function usageSecret() {
  const v = process.env.AI_USAGE_SECRET
  return typeof v === 'string' && v.trim().length >= 24 ? v.trim() : ''
}

export function usageReady() {
  return !!usageSecret()
}

/**
 * 요청 한 번의 단위 — 모델 단계(빠르게 1 · 보통 3 · 깊게 10) × 글 쓰기 단추 2배.
 * 한도는 단위로 센다(요금제마다 월 단위 — 0022 ai_usage_limits · 기본값).
 */
export function usageUnits(assist, tier) {
  const base = tier === 'deep' ? 10 : tier === 'standard' ? 3 : 1
  return assist && assist.kind === 'write' ? base * 2 : base
}

async function rpc(name, token, args) {
  const base = envAny(SUPA_URL_NAMES).replace(/\/+$/, '')
  const anon = envAny(SUPA_ANON_NAMES)
  if (!base || !anon) return { status: 0, body: null }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(`${base}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: ctrl.signal,
    })
    let body = null
    try {
      body = await r.json()
    } catch {
      body = null
    }
    return { status: r.status, body }
  } catch {
    return { status: 0, body: null }
  } finally {
    clearTimeout(timer)
  }
}

const notConfigured = (body) => /ai_usage_not_configured|ai_usage_bad_secret/.test(JSON.stringify(body ?? ''))

/**
 * 예약 — { ok: true, used, limit } 또는 { ok: false, code, used?, limit? }
 *   code: usage_setup_needed(0022 · 비밀값 없음/틀림) · quota_exceeded · request_in_progress · request_done · request_conflict · usage_unreachable
 */
export async function reserveUsage(token, { requestId, assistId, tier, units, workspaceId }) {
  const secret = usageSecret()
  if (!secret) return { ok: false, code: 'usage_setup_needed' }
  const r = await rpc('ai_usage_reserve', token, { p_secret: secret, p_request_id: requestId, p_assist_id: assistId, p_tier: tier, p_units: units, p_workspace: workspaceId || null })
  if (r.status === 404 || notConfigured(r.body)) return { ok: false, code: 'usage_setup_needed' }
  if (r.status !== 200 || !r.body || typeof r.body !== 'object') return { ok: false, code: 'usage_unreachable' }
  const { state, used, limit } = r.body
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)
  if (state === 'new' || state === 'retry') return { ok: true, used: n(used), limit: n(limit) }
  if (state === 'quota') return { ok: false, code: 'quota_exceeded', used: n(used), limit: n(limit) }
  if (state === 'inflight') return { ok: false, code: 'request_in_progress' }
  if (state === 'done') return { ok: false, code: 'request_done' }
  if (state === 'conflict') return { ok: false, code: 'request_conflict' }
  return { ok: false, code: 'usage_unreachable' }
}

/** 정산 — 답을 받았을 때. 실패해도 고객에게는 답을 준다(예약이 10분 뒤 센 데서 빠지는 것보다 덜 세는 쪽이 안전하다고 보지 않는다 — 한 번 더 시도) */
export async function settleUsage(token, requestId, run) {
  const secret = usageSecret()
  if (!secret) return null
  const args = {
    p_secret: secret,
    p_request_id: requestId,
    p_tokens_in: run?.usage?.input ?? null,
    p_tokens_out: run?.usage?.output ?? null,
    p_cost_usd: typeof run?.estimatedCostUsd === 'number' ? run.estimatedCostUsd : null,
  }
  for (let i = 0; i < 2; i += 1) {
    const r = await rpc('ai_usage_settle', token, args)
    if (r.status === 200 && r.body) return r.body
  }
  return null
}

/** 되돌림 — AI 가 실패했을 때(고객 한도에서 빼 준다) */
export async function releaseUsage(token, requestId) {
  const secret = usageSecret()
  if (!secret) return null
  for (let i = 0; i < 2; i += 1) {
    const r = await rpc('ai_usage_release', token, { p_secret: secret, p_request_id: requestId })
    if (r.status === 200 && r.body) return r.body
  }
  return null
}

/** 내 이번 달 사용량(상태 표시용) — 장부가 없으면 null */
export async function myUsage(token) {
  const r = await rpc('my_ai_usage', token, {})
  if (r.status !== 200 || !r.body || typeof r.body !== 'object') return null
  return { configured: !!r.body.configured, used: Number(r.body.used) || 0, limit: Number(r.body.limit) || 0, month: String(r.body.month || '') }
}
