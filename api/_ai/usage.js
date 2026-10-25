/**
 * SAAS-2 고객별 AI 사용량(서버) — 대표가 아닌 계정(팀장 · 구독 고객)의 AI 요청을 DB 장부(0022)로 센다.
 *
 * 순서: AI 를 부르기 전에 예약(한도 · 같은 요청 번호 · 동시 호출을 DB 가 차례로 판단) → 답하면 정산(토큰 · 비용) → 실패하면 되돌림.
 *  - 장부 함수는 고객 로그인(JWT)으로 부르되, 서버 비밀값(AI_USAGE_SECRET)을 같이 보낸다 — 고객이 직접 불러 공짜로 정산 · 되돌리기를 못 한다.
 *  - 누가 내부 팀장(internal)이고 누가 구독 고객(customer)인지는 DB(0022 ai_entitlements)가 정한다 — 줄이 없으면 고객 · 쓸 수 없음.
 *  - 고객 · 마케팅 요청은 장부 예약이 성공해야만 AI 를 부른다(비밀값 없음 · DB 설정 오류 · 장부 끊김 · 권한 조회 실패 → 막음).
 *  - 내부 팀장의 일반 AI 만 장부가 고장 나도 예전처럼 쓴다(기록이 빠진 것은 서버 기록에 남김) — 지금 쓰는 팀장 업무가 멈추지 않게.
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
 * 한도는 단위로 센다(사람마다 월 단위 — 0022 ai_entitlements.monthly_units · 비면 기본값 ai_usage_config).
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
 * 내 이용 권한 · 이번 달 사용량(0022 my_ai_access) — 고객 요청마다 서버가 먼저 묻는다(비밀값 필요 없음 · 그 사람 것만).
 *   { state: 'ok', kind: 'internal'|'customer', plan, marketing, active, limit(내부 팀장은 null), used, configured, month }
 *   { state: 'missing' } — 함수가 없다(0022 적용 전 · 지금 운영): 고객 계정이 아직 있을 수 없으므로 pilot 은 예전처럼(내부 팀장)
 *   { state: 'error' }   — 닿지 못함 · 모르는 답: 내부 팀장인지 고객인지 모르므로 서버가 고객 AI 를 막는다(기록 없이 쓰는 길을 닫는다)
 */
export async function myAccess(token) {
  const r = await rpc('my_ai_access', token, {})
  if (r.status === 404 || /PGRST202|Could not find the function/i.test(JSON.stringify(r.body ?? ''))) return { state: 'missing' }
  const b = r.body
  if (r.status !== 200 || !b || typeof b !== 'object' || (b.kind !== 'internal' && b.kind !== 'customer')) return { state: 'error' }
  const num = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v))
  return {
    state: 'ok',
    kind: b.kind,
    plan: String(b.plan || 'none'),
    marketing: b.marketing === true,
    active: b.active === true,
    limit: num(b.limit),
    used: num(b.used) ?? 0,
    configured: b.configured === true,
    month: String(b.month || ''),
  }
}

/**
 * 예약 — { ok: true, used, limit } 또는 { ok: false, code, used?, limit? }
 *   code: usage_setup_needed(0022 설정 · 비밀값 없음/틀림) · usage_unreachable · quota_exceeded · request_in_progress · request_done ·
 *         request_conflict · subscription_inactive(고객 이용 기한 없음) · marketing_not_included(요금제에 마케팅 없음)
 */
export async function reserveUsage(token, { requestId, assistId, tier, units, workspaceId, feature = 'general' }) {
  const secret = usageSecret()
  if (!secret) return { ok: false, code: 'usage_setup_needed' }
  const r = await rpc('ai_usage_reserve', token, { p_secret: secret, p_request_id: requestId, p_assist_id: assistId, p_tier: tier, p_units: units, p_workspace: workspaceId || null, p_feature: feature })
  if (r.status === 404 || notConfigured(r.body)) return { ok: false, code: 'usage_setup_needed' }
  if (r.status !== 200 || !r.body || typeof r.body !== 'object') return { ok: false, code: 'usage_unreachable' }
  const { state, used, limit } = r.body
  const n = (v) => (Number.isFinite(Number(v)) && v !== null ? Number(v) : null)
  if (state === 'new' || state === 'retry') return { ok: true, used: n(used), limit: n(limit) }
  if (state === 'quota') return { ok: false, code: 'quota_exceeded', used: n(used), limit: n(limit) }
  if (state === 'inflight') return { ok: false, code: 'request_in_progress' }
  if (state === 'done') return { ok: false, code: 'request_done' }
  if (state === 'conflict') return { ok: false, code: 'request_conflict' }
  if (state === 'inactive') return { ok: false, code: 'subscription_inactive' }
  if (state === 'not_entitled') return { ok: false, code: 'marketing_not_included' }
  return { ok: false, code: 'usage_unreachable' }
}

const wait = (ms) => new Promise((ok) => setTimeout(ok, ms))
const RETRY_GAPS = [0, 250, 750]

/**
 * 정산 — 답을 받았을 때(토큰 · 비용). 세 번까지 다시 해 본다.
 * 끝내 실패해도 장부에서 빠지지 않는다 — 예약 줄 자체가 센 기록이다(0022: 예약도 센다 · 15분 뒤 자동 정산).
 * 고객에게는 답을 그대로 준다(이미 센 요청이라 손해가 없다). 빠진 것은 토큰 · 비용 칸뿐(나중에 같은 번호가 오면 채운다).
 */
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
  for (const gap of RETRY_GAPS) {
    if (gap) await wait(gap)
    const r = await rpc('ai_usage_settle', token, args)
    if (r.status === 200 && r.body && typeof r.body === 'object') return r.body
  }
  return null
}

/** 되돌림 — AI 가 실패했을 때(고객 한도에서 빼 준다). 세 번까지. 끝내 실패하면 15분 뒤 자동 정산(대표가 SQL 한 줄로 돌려줄 수 있음) */
export async function releaseUsage(token, requestId) {
  const secret = usageSecret()
  if (!secret) return null
  for (const gap of RETRY_GAPS) {
    if (gap) await wait(gap)
    const r = await rpc('ai_usage_release', token, { p_secret: secret, p_request_id: requestId })
    if (r.status === 200 && r.body && typeof r.body === 'object') return r.body
  }
  return null
}
