/**
 * 대표 AI 작업실 서버 함수 — 브라우저는 AI 공급자를 직접 부르지 않는다. 키는 여기(서버 환경변수)에만 있다.
 *
 *   GET  /api/ai-run?status=1   설정 상태(키 · 모델 이름 값은 빼고 '있다/없다' 만)
 *   POST /api/ai-run            { requestId, skillId, caseId, contextVersion, input, context, choice? } → 결과(구조 JSON · 토큰 · 비용)
 *                               choice = { provider: 'gemini'|'openai'|'anthropic', model? } — 모델이 없으면 그 공급자의 빠르게/보통/깊게 모델(D-239),
 *                               있으면 모든 일에 그 모델(D-255 대표 "어디서든 내가 고른 모델로")
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
import { CONFIDENTIAL_RULES, guardOutput, scrubBrandDeep, secretIndex } from './_ai/guard.js'
import { ProviderError, aiConfig, buildPrompt, callProvider, skillKnowledge, costOf, extractJson, publicStatus, scrubDeep, validate } from './_ai/core.js'
import { __resetGateState, fail, limits, rateCheck, readBody, send, whoCan } from './_ai/gate.js'
import { __resetProviderCache, tierOf } from './_ai/providers.js'

const IDEM_TTL = 15 * 60_000
const inflight = new Map()

/** 시험용 — 기억한 것 비우기 */
export function __resetAiRunState() {
  __resetGateState()
  __resetProviderCache()
  inflight.clear()
}

const ID_RE = /^[A-Za-z0-9_-]{8,80}$/
const CASE_RE = /^case_[A-Za-z0-9_-]{6,64}$/

/* ---------------- 한 번 부르기 ---------------- */

/** D-264 서버만 가진 글(공통 규칙 · 스킬 지시) — 답에 통째로 나오면 막는다 */
let SECRETS = null
// D-272 AX 기준 문서도 통째로 옮겨 적지 못하게(서버만 가진 글)
const secrets = () => (SECRETS ??= secretIndex([...CONFIDENTIAL_RULES, ...COMMON_RULES, ...Object.values(SKILLS).flatMap((k) => k.systemInstruction), ...Object.values(SKILLS).map(skillKnowledge).filter(Boolean)]))

async function runOnce(cfg, skill, body) {
  const tier = skill.tier
  // D-264 업체 자료 · 입력에서도 쓰지 않는 이름 · 출처 이름을 지우고 보낸다
  const context = scrubBrandDeep(scrubDeep(body.context || {}))
  const input = scrubBrandDeep(scrubDeep(body.input || {}))
  const { system, user, sent } = buildPrompt(skill, context, input, tier, COMMON_RULES)
  const out = await callProvider(cfg, tier, system, user)
  const parsed = extractJson(out.content)
  const checked = parsed ? validate(skill.outputSchema, parsed) : { ok: false, value: null, errors: ['JSON 아님'] }
  const status = checked.ok ? 'succeeded' : 'parse_fallback'
  const known = `${JSON.stringify(context)}\n${JSON.stringify(input)}`
  const safe = checked.ok ? guardOutput(checked.value, secrets(), known) : { value: null, blocked: 0 }
  const safeRaw = checked.ok ? { value: '', blocked: 0 } : guardOutput(String(out.content || '').slice(0, 20000), secrets(), known)
  return {
    requestId: body.requestId,
    skillId: skill.id,
    skillVersion: skill.version,
    tier,
    provider: cfg.provider,
    model: out.model,
    status,
    structured: safe.value,
    raw: safeRaw.value,
    guarded: safe.blocked + safeRaw.blocked,
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
    // D-239: 화면에서 고른 공급자(?provider=gemini)로 상태를 본다 — 없으면 기본
    const cfg = aiConfig(url.searchParams.get('provider') ? { provider: url.searchParams.get('provider') } : undefined)
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

  const cfg = aiConfig(body.choice)
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
      console.warn(`[ai-run] 실패 문의번호=${String(body.requestId).slice(-6)} 작업=${skill.id} 오류=${code}`)
      return fail(res, e instanceof ProviderError ? e.status : 502, code, e instanceof ProviderError && e.provider ? { provider: e.provider } : {})
    }
  }

  // D-255 모델을 골랐으면 그 모델 값으로 센다(비싼 모델을 골라 놓고 '빠르게' 일로 깊게 하루 한도를 비켜 가지 않게)
  const rate = rateCheck(who.userId, cfg.pinned ? tierOf(cfg.provider || 'openai', cfg.pinned) : skill.tier, now)
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
    // NX-2 화면의 '문의 번호'(요청 번호 끝 6자리)로 함수 기록에서 찾는다 — 번호 · 작업 · 오류 갈래만
    console.warn(`[ai-run] 실패 문의번호=${String(body.requestId).slice(-6)} 작업=${skill.id} 오류=${code}`)
    return fail(res, e instanceof ProviderError ? e.status : 502, code, e instanceof ProviderError && e.provider ? { provider: e.provider } : {})
  }
}
