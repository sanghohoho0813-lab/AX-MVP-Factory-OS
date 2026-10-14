/**
 * 대표 AI 작업실 서버 함수 — 브라우저는 AI 공급자를 직접 부르지 않는다. 키는 여기(서버 환경변수)에만 있다.
 *
 *   GET  /api/ai-run?status=1   설정 상태(키 · 모델 이름 값은 빼고 '있다/없다' 만)
 *   POST /api/ai-run            { requestId, skillId, caseId, contextVersion, input, context } → 결과(구조 JSON · 토큰 · 비용)
 *
 * 문지기(순서대로)
 *   1) 로그인(Supabase JWT) — 없으면 401
 *   2) 기능 권한 has_capability('can_use_owner_ai_workspace') — 대표만. 팀장 · 직원 · 가입자는 403(직접 불러도)
 *   3) 속도 제한(사람마다 분 · 시간 · 깊게 하루) — 429
 *   4) 같은 요청 번호(requestId)는 한 번만 부른다 — 두 번 눌려도 결과 하나, 과금 한 번
 *   5) 보내기 전에 개인정보 · 비밀을 한 번 더 지운다
 * 오류 응답에는 공급자 원문 · 키 · 모델 값을 넣지 않는다.
 */
import { SKILLS, COMMON_RULES, skillOf } from './_ai/skills.js'
import { ERROR_TEXT, ProviderError, aiConfig, buildPrompt, callProvider, costOf, extractJson, publicStatus, scrubDeep, validate } from './_ai/core.js'

const CAP = 'can_use_owner_ai_workspace'
const SUPA_URL_NAMES = ['SUPABASE_URL', 'VITE_SUPABASE_URL']
const SUPA_ANON_NAMES = ['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY']
const MAX_BODY = 256 * 1024

function envAny(names) {
  for (const n of names) {
    const v = process.env[n]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function fail(res, status, code, extra = {}) {
  send(res, status, { ok: false, code, message: ERROR_TEXT[code] || ERROR_TEXT.provider_error, ...extra })
}

/* ---------------- 로그인 · 권한(짧게 기억) ---------------- */

const authCache = new Map()

async function whoCan(req) {
  const raw = (req.headers && (req.headers.authorization || req.headers.Authorization)) || ''
  const m = /^Bearer\s+([\w.-]{20,4096})$/.exec(String(raw))
  if (!m) return { ok: false, status: 401, code: 'login_required' }
  const base = envAny(SUPA_URL_NAMES).replace(/\/+$/, '')
  const anon = envAny(SUPA_ANON_NAMES)
  if (!base || !anon) return { ok: false, status: 503, code: 'setup_needed', missing: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] }
  const token = m[1]
  const hit = authCache.get(token)
  if (hit && hit.until > Date.now()) return hit.value
  let value
  try {
    const ur = await fetch(`${base}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } })
    const u = ur.ok ? await ur.json() : null
    if (!u || typeof u.id !== 'string' || !u.id) value = { ok: false, status: 401, code: 'login_required' }
    else {
      const cr = await fetch(`${base}/rest/v1/rpc/has_capability`, {
        method: 'POST',
        headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_cap: CAP }),
      })
      if (cr.status === 404) value = { ok: false, status: 403, code: 'db_setup_needed' }
      else {
        const can = cr.ok ? await cr.json() : false
        value = can === true ? { ok: true, userId: u.id } : { ok: false, status: 403, code: 'forbidden' }
      }
    }
  } catch {
    return { ok: false, status: 503, code: 'setup_needed' }
  }
  authCache.set(token, { until: Date.now() + 60_000, value })
  if (authCache.size > 200) authCache.delete(authCache.keys().next().value)
  return value
}

/* ---------------- 속도 제한 · 같은 요청 한 번만 ---------------- */

const hits = new Map()
const inflight = new Map()
const IDEM_TTL = 15 * 60_000

function limits() {
  const n = (name, d) => {
    const v = Number(process.env[name])
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : d
  }
  return { perMin: n('AI_RATE_PER_MIN', 6), perHour: n('AI_RATE_PER_HOUR', 60), deepPerDay: n('AI_RATE_DEEP_PER_DAY', 40) }
}

function rateCheck(userId, tier, now) {
  const lim = limits()
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

/** 시험용 — 기억한 것 비우기 */
export function __resetAiRunState() {
  authCache.clear()
  hits.clear()
  inflight.clear()
}

/* ---------------- 요청 읽기 ---------------- */

async function readBody(req) {
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

const ID_RE = /^[A-Za-z0-9_-]{8,80}$/
const CASE_RE = /^case_[A-Za-z0-9_-]{6,64}$/

/* ---------------- 한 번 부르기 ---------------- */

async function runOnce(cfg, skill, body) {
  const tier = skill.tier
  const context = scrubDeep(body.context || {})
  const input = scrubDeep(body.input || {})
  const { system, user, sent } = buildPrompt(skill, context, input, tier, COMMON_RULES)
  const out = await callProvider(cfg, tier, system, user)
  const parsed = extractJson(out.content)
  const checked = parsed ? validate(skill.outputSchema, parsed) : { ok: false, value: null, errors: ['JSON 아님'] }
  const status = checked.ok ? 'succeeded' : 'parse_fallback'
  return {
    requestId: body.requestId,
    skillId: skill.id,
    skillVersion: skill.version,
    tier,
    provider: cfg.provider,
    model: out.model,
    status,
    structured: checked.ok ? checked.value : null,
    raw: checked.ok ? '' : String(out.content || '').slice(0, 20000),
    parseErrors: checked.ok ? [] : checked.errors.slice(0, 8),
    usage: { input: out.usage.input, output: out.usage.output, total: out.usage.input + out.usage.output },
    estimatedCostUsd: costOf(cfg, tier, out.usage),
    finish: out.finish,
    sent,
    contextVersion: Number.isFinite(Number(body.contextVersion)) ? Number(body.contextVersion) : null,
    caseId: body.caseId,
    createdAt: new Date().toISOString(),
  }
}

export default async function handler(req, res) {
  const method = String(req.method || 'GET').toUpperCase()
  const url = new URL(req.url || '/', 'http://local')

  if (method === 'GET' && url.searchParams.get('status') === '1') {
    const who = await whoCan(req)
    if (!who.ok) return fail(res, who.status, who.code, who.missing ? { missing: who.missing } : {})
    const cfg = aiConfig()
    return send(res, 200, { ok: true, ...publicStatus(cfg), limits: limits(), skills: Object.values(SKILLS).filter((s) => s.active).map((s) => ({ id: s.id, version: s.version, tier: s.tier })) })
  }
  if (method !== 'POST') return fail(res, 405, 'bad_request')

  const who = await whoCan(req)
  if (!who.ok) return fail(res, who.status, who.code, who.missing ? { missing: who.missing } : {})

  const { value: body, tooLarge } = await readBody(req)
  if (tooLarge) return fail(res, 413, 'too_large')
  if (!body || typeof body !== 'object') return fail(res, 400, 'bad_request')
  const skill = skillOf(body.skillId)
  if (!skill || typeof body.requestId !== 'string' || !ID_RE.test(body.requestId) || typeof body.caseId !== 'string' || !CASE_RE.test(body.caseId)) {
    return fail(res, 400, 'bad_request')
  }

  const cfg = aiConfig()
  if (cfg.missing.length > 0 || !cfg.models[skill.tier]) return fail(res, 503, 'setup_needed', { missing: cfg.missing })

  // 같은 요청 번호 — 이미 부르고 있거나 부른 것이 있으면 그 결과를 그대로(공급자를 다시 부르지 않는다)
  const now = Date.now()
  for (const [k, v] of inflight) if (now - v.at > IDEM_TTL) inflight.delete(k)
  const idemKey = `${who.userId}:${body.requestId}`
  const prev = inflight.get(idemKey)
  if (prev) {
    if (prev.skillId !== skill.id || prev.caseId !== body.caseId) return fail(res, 409, 'request_conflict')
    try {
      const run = await prev.promise
      return send(res, 200, { ok: true, replayed: true, run })
    } catch (e) {
      const code = e instanceof ProviderError ? e.code : 'provider_error'
      return fail(res, e instanceof ProviderError ? e.status : 502, code)
    }
  }

  const rate = rateCheck(who.userId, skill.tier, now)
  if (!rate.ok) {
    res.setHeader('Retry-After', String(rate.retryAfter))
    return fail(res, 429, 'rate_limited', { retryAfter: rate.retryAfter })
  }

  const promise = runOnce(cfg, skill, body)
  inflight.set(idemKey, { at: now, promise, skillId: skill.id, caseId: body.caseId })
  if (inflight.size > 500) inflight.delete(inflight.keys().next().value)
  try {
    const run = await promise
    return send(res, 200, { ok: true, replayed: false, run })
  } catch (e) {
    // 실패한 요청은 같은 번호로 다시 시도할 수 있게 지운다
    inflight.delete(idemKey)
    const code = e instanceof ProviderError ? e.code : 'provider_error'
    return fail(res, e instanceof ProviderError ? e.status : 502, code)
  }
}
