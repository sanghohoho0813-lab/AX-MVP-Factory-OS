/**
 * AI 도우미 서버 함수(D-239) — 화면마다 미리 만든 질문 단추를 누르면 여기로 온다. 브라우저는 AI 공급자를 직접 부르지 않는다.
 *
 *   GET  /api/ai-assist?status=1[&models=1]   공급자 · 모델 목록 · 기본 선택(키 · 주소 값은 빼고). models=1 이면 키로 모델 목록을 물어 '확인됨' 표시
 *   POST /api/ai-assist                       { requestId, assistId, page, choice:{provider, model}, context, ask?, skill? } → 결과(JSON · 토큰 · 비용)
 *     skill = D-263 대표가 정의한 /자체점검(자체점검 · 명세서/사업계획서 쓰기 단추에만 붙인다)
 *
 * 문지기는 AI 작업실과 같다(_ai/gate.js): 로그인 → 대표 권한 → 속도(도우미 몫 따로) → 같은 요청 번호는 한 번만 → 개인정보 한 번 더 지움.
 * 오류 응답에는 공급자 원문 · 키 · 주소를 넣지 않는다.
 * D-257 팀장(Pilot)도 연다 — 대표 지시 "일단은 Gemini 만": 모델 목록에 Gemini 만 · 다른 회사를 보내면 403(provider_not_allowed) ·
 *   대표 전용 화면(마케팅 radar · content) 단추는 403 · 지시문의 '대표' 는 이 화면을 쓰는 팀장으로 읽게 한 줄 더.
 * D-260 영상 단추(radar.transcript) — { video: { id, start, end } } 만 받아 서버가 YouTube 주소를 만들고 Gemini 에 영상 그대로 붙인다(구간 15분까지).
 */
import { ASSISTS, ASSIST_OUTPUT_SCHEMA, ASSIST_RULES, PACKS, RADAR_RULES, VIDEO_RULES, assistOf, assistSystem, buildAssistPrompt, topicPacks } from './_ai/assists.js'
import { CONFIDENTIAL_RULES, guardOutput, scrubBrand, scrubBrandDeep, secretIndex } from './_ai/guard.js'
import { IDEA_JUDGE, PATENT_JUDGE, VENTURE_JUDGE } from './_ai/judge.js'
import { ProviderError, extractJson, scrubDeep, scrubText, validate } from './_ai/core.js'
import { SKILL_MAX } from './_ai/judge.js'
import { __resetGateState, assistLimits, fail, rateCheck, readBody, send, whoCan } from './_ai/gate.js'
import { PROVIDERS, __resetProviderCache, callModel, cleanChoice, defaultChoice, priceOf, providerBase, providerKey, publicCatalog, tierModel, tierOf } from './_ai/providers.js'

const IDEM_TTL = 15 * 60_000
/** 팀장이 쓸 수 있는 AI 회사 · 못 여는 화면(대표 전용 마케팅) */
export const PILOT_PROVIDERS = new Set(['gemini'])
const PILOT_BLOCKED_PAGES = new Set(['radar', 'content', 'threads', 'shorts'])
const PILOT_NOTE = '[이 요청] 대표가 아니라 팀장(이 OS 를 함께 쓰는 컨설턴트)이 보냈다. 지시문 · 규칙의 "대표" 는 이 화면을 쓰는 팀장으로 읽고, 팀장이 바로 할 일로 쓴다.'

/** 팀장에게 보여 줄 모델 목록 — 허용된 회사만 · 기본도 그 안에서 */
function pilotCatalog(catalog) {
  const providers = catalog.providers.filter((p) => PILOT_PROVIDERS.has(p.id))
  const def = PILOT_PROVIDERS.has(catalog.defaultChoice.provider) ? catalog.defaultChoice : { provider: 'gemini', model: tierModel('gemini', 'cheap') }
  return { providers, defaultChoice: def }
}
const inflight = new Map()
const ID_RE = /^[A-Za-z0-9_-]{8,80}$/
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/
/** D-260 한 번에 받아 적는 구간 끝 길이(초) — 60초 안에 답하도록 화면은 10분씩 나눠 보낸다 */
export const VIDEO_SEGMENT_MAX = 900

/**
 * D-260 영상 단추 — 화면이 보낸 영상 번호 · 구간만 받는다. 주소는 서버가 YouTube 주소로만 만든다(다른 주소 · 파일은 못 보냄).
 * 틀리면 null(부른 쪽이 400).
 */
export function cleanVideo(v) {
  if (!v || typeof v !== 'object') return null
  const id = typeof v.id === 'string' ? v.id : ''
  const start = Number(v.start)
  const end = Number(v.end)
  if (!VIDEO_ID_RE.test(id) || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end - start > VIDEO_SEGMENT_MAX || end > 6 * 3600) return null
  return { uri: `https://www.youtube.com/watch?v=${id}`, start, end }
}

const clock = (sec) => {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = String(sec % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** 시험용 — 기억한 것 비우기 */
export function __resetAiAssistState() {
  __resetGateState()
  __resetProviderCache()
  inflight.clear()
}

function timeoutMs() {
  const v = Number(process.env.AI_TIMEOUT_MS)
  return Math.min(Math.max(Number.isFinite(v) && v > 0 ? v : 55000, 5000), 295000)
}

/** D-264 서버만 가진 글(지시 · 기준 문서 · 점검 기준) — 답에 통째로 나오면 막는다 */
let SECRETS = null
const secrets = () =>
  (SECRETS ??= secretIndex([
    ...Object.values(PACKS),
    ...CONFIDENTIAL_RULES,
    ...ASSIST_RULES,
    ...RADAR_RULES,
    ...VIDEO_RULES,
    ...VENTURE_JUDGE,
    ...PATENT_JUDGE,
    ...IDEA_JUDGE.patent,
    ...IDEA_JUDGE.venture,
    ...Object.values(ASSISTS).flatMap((a) => a.instruction),
  ]))

async function runOnce(assist, choice, body, role, video = null) {
  const key = providerKey(choice.provider)
  const base = providerBase(choice.provider)
  // D-264 화면 자료 · 물음 · 대표 기준에서도 쓰지 않는 이름 · 출처 이름을 지우고 보낸다
  const context = scrubBrandDeep(scrubDeep(body.context || {}))
  const ask = typeof body.ask === 'string' ? scrubBrand(scrubText(body.ask)).slice(0, 500) : ''
  // D-263 대표가 붙여 넣은 점검 기준 — 자체점검 · 명세서/사업계획서 쓰기 단추에만(다른 단추는 버림)
  const skill = (assist.judge || assist.final || assist.ideaJudge) && typeof body.skill === 'string' ? scrubBrand(scrubText(body.skill)).slice(0, SKILL_MAX) : ''
  // D-263 대화 단추 — 물어본 말로 기준 문서 장 고르기(물어본 말에 주제가 없으면 앞선 대화 끝부분으로 · 화면 제목은 늘 '특허 · 벤처' 라 쓰지 않음)
  const prev = Array.isArray(context.sections) ? context.sections.find((x) => /앞선\s*대화/.test(String(x?.name ?? ''))) : null
  const topicText = !assist.topicKb ? '' : topicPacks(ask).length ? ask : JSON.stringify(prev?.rows ?? '').slice(-2000)
  const sys = assistSystem(assist, { skill, topicText })
  const system = role === 'pilot' ? `${sys}\n\n${PILOT_NOTE}` : sys
  const built = buildAssistPrompt(assist, context, ask)
  const { sent } = built
  // D-260 영상 단추 — 맨 앞에 붙인 영상의 어느 구간인지(시각은 영상 처음부터)
  const user = video ? `${built.user}\n[영상] 맨 앞에 붙인 YouTube 영상\n[구간] ${clock(video.start)} ~ ${clock(video.end)} — 이 구간만(시각은 영상 처음부터 센 것)` : built.user
  const started = Date.now()
  // '생각' 토큰까지 세는 공급자가 있어 글 몫의 두 배를 상한으로
  const call = { provider: choice.provider, key, base, model: choice.model, system, user, maxOut: assist.maxOut * 2, timeoutMs: timeoutMs(), ...(video ? { video } : {}) }
  // D-252 조사 단추는 웹 검색을 붙여 본다 — 공급자 · 모델이 검색을 거절(400)하면 검색 없이 한 번 더(화면에 '검색 근거 없음')
  // D-260 영상은 화면을 낮은 해상도로 먼저(토큰 · 시간 ↓ — 받아 적기는 말이 중요) · 모델이 거절하면 기본 해상도로 한 번 더
  let out = null
  if (assist.research) {
    try {
      out = await callModel({ ...call, search: true })
    } catch (e) {
      if (!(e instanceof ProviderError) || e.code !== 'provider_rejected') throw e
    }
  }
  if (!out && video) {
    try {
      out = await callModel({ ...call, lowRes: true })
    } catch (e) {
      if (!(e instanceof ProviderError) || e.code !== 'provider_rejected') throw e
    }
  }
  if (!out) out = await callModel(call)
  const parsed = extractJson(out.content)
  const checked = parsed ? validate(ASSIST_OUTPUT_SCHEMA, parsed) : { ok: false, value: null, errors: ['JSON 아님'] }
  const price = priceOf(choice.provider, choice.model)
  // D-264 답 지키기 — 쓰지 않는 이름 · 출처 이름 바꾸기 + 지시 · 기준 문서 · 대표 기준을 통째로 옮긴 칸 막기(화면이 보낸 글은 세지 않음)
  const known = `${JSON.stringify(context)}\n${ask}`
  const own = skill ? secretIndex([skill]) : null
  const safe = checked.ok ? guardOutput(checked.value, secrets(), known, own) : { value: null, blocked: 0 }
  const safeRaw = checked.ok ? { value: '', blocked: 0 } : guardOutput(String(out.content || '').slice(0, 20000), secrets(), known, own)
  return {
    requestId: body.requestId,
    assistId: assist.id,
    assistVersion: assist.version,
    page: assist.page,
    provider: choice.provider,
    model: choice.model,
    servedModel: out.model,
    status: checked.ok ? 'succeeded' : 'parse_fallback',
    structured: safe.value,
    raw: safeRaw.value,
    guarded: safe.blocked + safeRaw.blocked,
    usage: { input: out.usage.input, output: out.usage.output, total: out.usage.input + out.usage.output },
    estimatedCostUsd: price ? Math.round(((out.usage.input * price.in + out.usage.output * price.out) / 1e6) * 1e6) / 1e6 : null,
    finish: out.finish,
    grounded: !!out.searched && Array.isArray(out.sources) && out.sources.length > 0,
    sources: Array.isArray(out.sources) ? out.sources : [],
    ms: Date.now() - started,
    sent,
    createdAt: new Date().toISOString(),
  }
}

export default async function handler(req, res) {
  const method = String(req.method || 'GET').toUpperCase()
  const url = new URL(req.url || '/', 'http://local')

  if (method === 'GET' && url.searchParams.get('status') === '1') {
    const who = await whoCan(req, { allowPilot: true })
    if (!who.ok) return fail(res, who.status, who.code, who.missing ? { missing: who.missing } : {})
    const full = await publicCatalog({ withLive: url.searchParams.get('models') === '1' })
    const catalog = who.role === 'pilot' ? pilotCatalog(full) : full
    const assists = Object.values(ASSISTS).filter((a) => who.role !== 'pilot' || !PILOT_BLOCKED_PAGES.has(a.page))
    return send(res, 200, { ok: true, role: who.role, ...catalog, limits: assistLimits(), assists: assists.map((a) => ({ id: a.id, page: a.page, version: a.version })) })
  }
  if (method !== 'POST') return fail(res, 405, 'bad_request')

  const who = await whoCan(req, { allowPilot: true })
  if (!who.ok) return fail(res, who.status, who.code, who.missing ? { missing: who.missing } : {})
  const pilot = who.role === 'pilot'

  const { value: body, tooLarge } = await readBody(req)
  if (tooLarge) return fail(res, 413, 'too_large')
  if (!body || typeof body !== 'object') return fail(res, 400, 'bad_request')
  const assist = assistOf(body.assistId)
  if (!assist || body.page !== assist.page || typeof body.requestId !== 'string' || !ID_RE.test(body.requestId)) return fail(res, 400, 'bad_request')

  if (pilot && PILOT_BLOCKED_PAGES.has(assist.page)) return fail(res, 403, 'forbidden')
  // D-260 영상 단추는 영상 번호 · 구간이 맞아야
  const video = assist.video ? cleanVideo(body.video) : null
  if (assist.video && !video) return fail(res, 400, 'bad_request')

  // 고른 것이 없으면 기본(Gemini 가장 싼 모델) · 공급자만 골랐으면 그 공급자의 가장 싼 모델
  const sent = cleanChoice(body.choice)
  if (pilot && sent && !PILOT_PROVIDERS.has(sent.provider)) return fail(res, 403, 'provider_not_allowed')
  const def = pilot && !PILOT_PROVIDERS.has(defaultChoice().provider) ? { provider: 'gemini', model: tierModel('gemini', 'cheap') } : defaultChoice()
  // D-260 영상을 직접 보는 것은 Gemini 만 된다 — 다른 회사를 골라 둬도 이 단추는 Gemini(고른 Gemini 모델이 있으면 그것)
  const provider = assist.video ? 'gemini' : sent ? sent.provider : def.provider
  const model = assist.video
    ? (sent && sent.provider === 'gemini' && sent.model) || (def.provider === 'gemini' ? def.model : tierModel('gemini', 'cheap'))
    : (sent && sent.model) || (provider === def.provider ? def.model : tierModel(provider, 'cheap'))
  const choice = { provider, model }
  if (!providerKey(choice.provider) || !providerBase(choice.provider)) {
    return fail(res, 503, 'setup_needed', { missing: [PROVIDERS[choice.provider].keyNames[0]], provider: choice.provider })
  }

  const now = Date.now()
  for (const [k, v] of inflight) if (now - v.at > IDEM_TTL) inflight.delete(k)
  const idemKey = `${who.userId}:${body.requestId}`
  const prev = inflight.get(idemKey)
  if (prev) {
    if (prev.assistId !== assist.id) return fail(res, 409, 'request_conflict')
    try {
      return send(res, 200, { ok: true, replayed: true, run: await prev.promise })
    } catch (e) {
      return fail(res, e instanceof ProviderError ? e.status : 502, e instanceof ProviderError ? e.code : 'provider_error')
    }
  }

  // D-244: 고른 모델의 단계로 센다 — 예전엔 모두 cheap 이라 깊게 하루 한도가 걸리지 않았다
  const rate = rateCheck(`${who.userId}:assist`, tierOf(choice.provider, choice.model), now, assistLimits())
  if (!rate.ok) {
    res.setHeader('Retry-After', String(rate.retryAfter))
    return fail(res, 429, 'rate_limited', { retryAfter: rate.retryAfter })
  }

  const promise = runOnce(assist, choice, body, who.role, video)
  inflight.set(idemKey, { at: now, promise, assistId: assist.id })
  if (inflight.size > 500) inflight.delete(inflight.keys().next().value)
  try {
    return send(res, 200, { ok: true, replayed: false, run: await promise })
  } catch (e) {
    inflight.delete(idemKey)
    return fail(res, e instanceof ProviderError ? e.status : 502, e instanceof ProviderError ? e.code : 'provider_error')
  }
}
