/**
 * AI 서버 함수 공통 문지기 — 로그인(Supabase JWT) · 기능 권한(대표만) · 속도 제한 · 요청 읽기 · 응답.
 * api/ai-run.js(AI 작업실)와 api/ai-assist.js(화면마다 AI 도우미)가 같이 쓴다. 속도 제한은 사람마다 같은 칸을 센다(합쳐서 막는다).
 * D-257 AI 도우미만 팀장(Pilot · 서버 0019 my_os_access = 'pilot')도 연다 — role 'pilot' 으로 돌려주고, 어느 모델까지 되는지는 부른 쪽(ai-assist)이 정한다.
 *   AI 작업실(ai-run)은 그대로 대표 권한만(allowPilot 없이 부른다).
 */
import { ERROR_TEXT } from './core.js'

const CAP = 'can_use_owner_ai_workspace'
const SUPA_URL_NAMES = ['SUPABASE_URL', 'VITE_SUPABASE_URL']
const SUPA_ANON_NAMES = ['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY']
const MAX_BODY = 256 * 1024
const AUTH_TIMEOUT_MS = 4000

function envAny(names) {
  for (const n of names) {
    const v = process.env[n]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

export function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function fail(res, status, code, extra = {}) {
  send(res, status, { ok: false, code, message: ERROR_TEXT[code] || ERROR_TEXT.provider_error, ...extra })
}

/* ---------------- 로그인 · 권한(짧게 기억) ---------------- */

const authCache = new Map()

export async function whoCan(req, { allowPilot = false } = {}) {
  const raw = (req.headers && (req.headers.authorization || req.headers.Authorization)) || ''
  const m = /^Bearer\s+([\w.-]{20,4096})$/.exec(String(raw))
  if (!m) return { ok: false, status: 401, code: 'login_required' }
  const base = envAny(SUPA_URL_NAMES).replace(/\/+$/, '')
  const anon = envAny(SUPA_ANON_NAMES)
  if (!base || !anon) return { ok: false, status: 503, code: 'setup_needed', missing: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] }
  const token = m[1]
  const cacheKey = allowPilot ? `p:${token}` : token
  const hit = authCache.get(cacheKey)
  if (hit && hit.until > Date.now()) return hit.value
  let value
  // D-244: 로그인 · 권한 확인 두 번을 합쳐 4초까지 — 모델 대기(최대 55초)와 더해도 함수 한도(60초) 안
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), AUTH_TIMEOUT_MS)
  try {
    const ur = await fetch(`${base}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` }, signal: ctrl.signal })
    const u = ur.ok ? await ur.json() : null
    if (!u || typeof u.id !== 'string' || !u.id) value = { ok: false, status: 401, code: 'login_required' }
    else {
      const cr = await fetch(`${base}/rest/v1/rpc/has_capability`, {
        method: 'POST',
        headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_cap: CAP }),
        signal: ctrl.signal,
      })
      if (cr.status === 404) value = { ok: false, status: 403, code: 'db_setup_needed' }
      else {
        const can = cr.ok ? await cr.json() : false
        if (can === true) value = { ok: true, userId: u.id, role: 'owner' }
        else if (allowPilot) {
          // 대표 권한이 없으면 — 접근 등급이 'pilot'(서버가 정함 · 이메일로 비교하지 않음)일 때만 팀장으로 연다
          const ar = await fetch(`${base}/rest/v1/rpc/my_os_access`, {
            method: 'POST',
            headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: '{}',
            signal: ctrl.signal,
          })
          const access = ar.ok ? await ar.json() : null
          value = access === 'pilot' ? { ok: true, userId: u.id, role: 'pilot' } : { ok: false, status: 403, code: 'forbidden' }
        } else value = { ok: false, status: 403, code: 'forbidden' }
      }
    }
  } catch {
    // 시간 초과는 '설정 필요' 가 아니다(D-244)
    return ctrl.signal.aborted ? { ok: false, status: 504, code: 'auth_unreachable' } : { ok: false, status: 503, code: 'setup_needed' }
  } finally {
    clearTimeout(timer)
  }
  authCache.set(cacheKey, { until: Date.now() + 60_000, value })
  if (authCache.size > 200) authCache.delete(authCache.keys().next().value)
  return value
}

/* ---------------- 속도 제한 · 같은 요청 한 번만 ---------------- */

const hits = new Map()

export function limits() {
  const n = (name, d) => {
    const v = Number(process.env[name])
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : d
  }
  return { perMin: n('AI_RATE_PER_MIN', 6), perHour: n('AI_RATE_PER_HOUR', 60), deepPerDay: n('AI_RATE_DEEP_PER_DAY', 40) }
}

/** lim 을 주면 그 한도로(AI 도우미는 따로 센다 — 키는 'userId:assist') */
export function rateCheck(userId, tier, now, lim = limits()) {
  const list = (hits.get(userId) || []).filter((h) => now - h.at < 86_400_000)
  const inMin = list.filter((h) => now - h.at < 60_000).length
  const inHour = list.filter((h) => now - h.at < 3_600_000).length
  const deepDay = list.filter((h) => h.tier === 'deep').length
  if (inMin >= lim.perMin) return { ok: false, retryAfter: 60 }
  if (inHour >= lim.perHour) return { ok: false, retryAfter: 600 }
  if (tier === 'deep' && deepDay >= lim.deepPerDay) return { ok: false, retryAfter: 3600 }
  list.push({ at: now, tier })
  hits.set(userId, list)
  return { ok: true }
}

/** AI 도우미(화면마다 질문 단추) 한도 — 한 번에 짧게 여러 번 누르는 일이 많아 작업실보다 조금 넉넉히 */
export function assistLimits() {
  const n = (name, d) => {
    const v = Number(process.env[name])
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : d
  }
  return { perMin: n('AI_ASSIST_RATE_PER_MIN', 10), perHour: n('AI_ASSIST_RATE_PER_HOUR', 120), deepPerDay: n('AI_RATE_DEEP_PER_DAY', 40) }
}

/** 시험용 — 기억한 것 비우기 */
export function __resetGateState() {
  authCache.clear()
  hits.clear()
}

/* ---------------- 요청 읽기 ---------------- */

export async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      if (req.body.length > MAX_BODY) return { tooLarge: true }
      try {
        return { value: JSON.parse(req.body) }
      } catch {
        return { value: null }
      }
    }
    if (typeof req.body === 'object') {
      const size = JSON.stringify(req.body).length
      return size > MAX_BODY ? { tooLarge: true } : { value: req.body }
    }
  }
  if (typeof req.on !== 'function') return { value: null }
  return new Promise((resolve) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size <= MAX_BODY) chunks.push(c)
    })
    req.on('end', () => {
      if (size > MAX_BODY) return resolve({ tooLarge: true })
      try {
        resolve({ value: JSON.parse(Buffer.concat(chunks).toString('utf8')) })
      } catch {
        resolve({ value: null })
      }
    })
    req.on('error', () => resolve({ value: null }))
  })
}

