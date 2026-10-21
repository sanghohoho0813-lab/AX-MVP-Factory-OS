/**
 * AI 공급자 세 곳(Gemini · GPT · Claude) — 서버 전용. 키는 서버 환경변수에서만 읽는다(VITE_ 이름은 읽지 않는다).
 *
 * 모델 목록(MODEL_CATALOG)은 공식 가격표(2026-10-19 확인)를 옮긴 것이다. 공급자가 이름을 바꾸거나 새 모델을 내면
 *   - 환경변수 AI_MODELS_GEMINI · AI_MODELS_OPENAI · AI_MODELS_ANTHROPIC("id1,id2") 로 목록 앞에 더하고
 *   - 상태 확인(GET ?status=1&models=1)은 키로 공급자 목록을 직접 물어 '이 키로 확인됨' 을 붙인다.
 * 기본값은 Gemini 의 가장 싼 모델(대표 지시). AI_DEFAULT_PROVIDER · AI_DEFAULT_MODEL 로 바꿀 수 있다.
 */

function env(names) {
  for (const n of names) {
    if (n.startsWith('VITE_')) continue
    const v = process.env[n]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

const HTTPS = /^https:\/\/[^\s/]+(\/[^\s]*)?$/

export const PROVIDERS = {
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    keyNames: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
    baseNames: ['AI_GEMINI_BASE_URL'],
    base: 'https://generativelanguage.googleapis.com/v1beta',
  },
  openai: {
    id: 'openai',
    label: 'GPT',
    keyNames: ['OPENAI_API_KEY', 'AI_API_KEY'],
    baseNames: ['AI_OPENAI_BASE_URL', 'AI_BASE_URL'],
    base: 'https://api.openai.com/v1',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Claude',
    keyNames: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
    // ANTHROPIC_BASE_URL 은 다른 도구가 쓰는 이름이라 읽지 않는다
    baseNames: ['AI_ANTHROPIC_BASE_URL'],
    base: 'https://api.anthropic.com/v1',
  },
}

export const PROVIDER_ORDER = ['gemini', 'openai', 'anthropic']

/**
 * 가격은 USD · 100만 토큰당(입력, 출력). tier = 이 공급자에서 빠르게/보통/깊게 기본으로 쓰는 모델.
 * note 는 화면에 그대로 보인다.
 */
export const MODEL_CATALOG = {
  gemini: [
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', price: [0.25, 1.5], note: '가장 쌈 · 기본', tier: 'cheap' },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', price: [0.1, 0.4], note: '더 쌈 · 예전에 쓰던 키만 열림' },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', price: [0.3, 2.5], note: '싸고 조금 더 똑똑' },
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', price: [0.75, 3.75], note: '보통', tier: 'standard' },
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', price: [0.75, 3.75], note: '보통' },
    { id: 'gemini-4-argon', label: 'Gemini 4 Argon', price: [2, 10], note: '가장 똑똑 · 비쌈', tier: 'deep' },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (미리보기)', price: [2, 12], note: '깊게 · 비쌈' },
  ],
  openai: [
    { id: 'gpt-5-nano', label: 'GPT-5 nano', price: [0.05, 0.4], note: '가장 쌈', tier: 'cheap' },
    { id: 'gpt-6-luna', label: 'GPT-6 Luna', price: [0.1, 0.5], note: '싸고 새 모델' },
    { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', price: [0.75, 4.5], note: '보통', tier: 'standard' },
    { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', price: [2, 10], note: '똑똑 · 비쌈', tier: 'deep' },
    { id: 'gpt-6-astra', label: 'GPT-6 Astra', price: [10, 50], note: '가장 똑똑 · 아주 비쌈' },
  ],
  anthropic: [
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', price: [0.1, 0.5], note: '가장 쌈 · 빠름', tier: 'cheap' },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', price: [2, 10], note: '보통', tier: 'standard' },
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', price: [4, 20], note: '똑똑 · 비쌈', tier: 'deep' },
    { id: 'claude-fable-5-1', label: 'Claude Fable 5.1', price: [10, 50], note: '가장 똑똑 · 아주 비쌈' },
  ],
}

const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,79}$/

/** 환경변수로 더한 모델 + 기본 목록(같은 id 는 한 번) */
export function catalogOf(provider) {
  const base = MODEL_CATALOG[provider] || []
  const extra = env([`AI_MODELS_${provider.toUpperCase()}`])
    .split(',')
    .map((s) => s.trim())
    .filter((s) => MODEL_ID.test(s))
  const seen = new Set()
  const out = []
  for (const id of extra) {
    if (seen.has(id)) continue
    seen.add(id)
    const known = base.find((m) => m.id === id)
    out.push(known ? { ...known } : { id, label: id, price: null, note: '직접 더한 모델' })
  }
  for (const m of base) if (!seen.has(m.id)) out.push({ ...m })
  return out
}

export function providerKey(provider) {
  const p = PROVIDERS[provider]
  return p ? env(p.keyNames) : ''
}

export function providerBase(provider) {
  const p = PROVIDERS[provider]
  if (!p) return ''
  const raw = env(p.baseNames) || p.base
  return HTTPS.test(raw) ? raw.replace(/\/+$/, '') : ''
}

export function configuredProviders() {
  return PROVIDER_ORDER.filter((p) => !!providerKey(p) && !!providerBase(p))
}

export function tierModel(provider, tier) {
  const list = catalogOf(provider)
  const hit = list.find((m) => m.tier === tier) || list.find((m) => m.tier === 'cheap') || list[0]
  return hit ? hit.id : ''
}

/** 기본 선택 — AI_DEFAULT_PROVIDER/MODEL → 키가 있는 첫 공급자(Gemini 먼저) → Gemini */
export function defaultChoice() {
  const ready = configuredProviders()
  const want = env(['AI_DEFAULT_PROVIDER']).toLowerCase()
  const provider = PROVIDERS[want] ? want : ready[0] || 'gemini'
  const wantModel = env(['AI_DEFAULT_MODEL'])
  const model = wantModel && MODEL_ID.test(wantModel) ? wantModel : tierModel(provider, 'cheap')
  return { provider, model }
}

/** 화면이 보낸 선택이 쓸 만한가 — 알려진 공급자 · 모델 이름 모양만 본다(목록 밖 모델도 공급자가 판단) */
export function cleanChoice(choice) {
  if (!choice || typeof choice !== 'object') return null
  const provider = typeof choice.provider === 'string' ? choice.provider.toLowerCase() : ''
  if (!PROVIDERS[provider]) return null
  const model = typeof choice.model === 'string' && MODEL_ID.test(choice.model) ? choice.model : ''
  return { provider, model }
}

export function priceOf(provider, model) {
  const hit = catalogOf(provider).find((m) => m.id === model)
  return hit && Array.isArray(hit.price) ? { in: hit.price[0], out: hit.price[1] } : null
}

/**
 * D-244 모델 → 단계(cheap · standard · deep) — 속도 제한(깊게 하루 한도)을 세려고.
 * 목록에 단계가 있으면 그것, 없으면 가격(입력+출력)을 그 회사의 보통 · 깊게 모델과 견준다. 목록에 없거나 가격을 모르면 cheap.
 */
export function tierOf(provider, model) {
  const list = catalogOf(provider)
  const hit = list.find((m) => m.id === model)
  if (!hit) return 'cheap'
  if (hit.tier) return hit.tier
  if (!Array.isArray(hit.price)) return 'cheap'
  const cost = (p) => p[0] + p[1]
  const at = (t) => {
    const m = list.find((x) => x.tier === t && Array.isArray(x.price))
    return m ? cost(m.price) : Infinity
  }
  const c = cost(hit.price)
  return c >= at('deep') ? 'deep' : c >= at('standard') ? 'standard' : 'cheap'
}

/* ------------------------------------------------------------------ */
/* 키로 공급자에게 모델 목록 묻기(10분 기억) — 글 만드는 모델만 남긴다                       */
/* ------------------------------------------------------------------ */

const liveCache = new Map()

export function __resetProviderCache() {
  liveCache.clear()
}

const SKIP = /(tts|image|imagen|embed|live|audio|realtime|transcri|robotics|veo|lyria|omni|banana|search|moderation|whisper|dall-e|sora|computer-use|deep-research|antigravity|babbage|davinci|instruct)/i

export async function liveModels(provider) {
  const key = providerKey(provider)
  const base = providerBase(provider)
  if (!key || !base) return null
  const hit = liveCache.get(provider)
  if (hit && hit.until > Date.now()) return hit.ids
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  let ids = null
  try {
    let res
    if (provider === 'gemini') res = await fetch(`${base}/models?pageSize=1000`, { headers: { 'x-goog-api-key': key }, signal: ctrl.signal })
    else if (provider === 'anthropic') res = await fetch(`${base}/models?limit=1000`, { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, signal: ctrl.signal })
    else res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: ctrl.signal })
    if (res.ok) {
      const data = await res.json()
      if (provider === 'gemini') {
        ids = (Array.isArray(data.models) ? data.models : [])
          .filter((m) => m && typeof m.name === 'string' && (!Array.isArray(m.supportedGenerationMethods) || m.supportedGenerationMethods.includes('generateContent')))
          .map((m) => m.name.replace(/^models\//, ''))
          .filter((id) => /^gemini/i.test(id))
      } else {
        ids = (Array.isArray(data.data) ? data.data : []).map((m) => (m && typeof m.id === 'string' ? m.id : '')).filter(Boolean)
        if (provider === 'openai') ids = ids.filter((id) => /^(gpt|o\d|chatgpt)/i.test(id))
        if (provider === 'anthropic') ids = ids.filter((id) => /^claude/i.test(id))
      }
      ids = ids.filter((id) => MODEL_ID.test(id) && !SKIP.test(id)).slice(0, 200)
    }
  } catch {
    ids = null
  } finally {
    clearTimeout(timer)
  }
  liveCache.set(provider, { until: Date.now() + (ids ? 600_000 : 60_000), ids })
  return ids
}

/** 화면에 보낼 공급자 · 모델 목록(키 · 주소 값은 빼고) */
export async function publicCatalog({ withLive = false } = {}) {
  const ready = new Set(configuredProviders())
  const providers = []
  for (const id of PROVIDER_ORDER) {
    const list = catalogOf(id)
    let live = null
    if (withLive && ready.has(id)) live = await liveModels(id)
    const liveSet = live ? new Set(live) : null
    const models = list.map((m) => ({ id: m.id, label: m.label, note: m.note, price: m.price, tier: m.tier ?? null, verified: liveSet ? liveSet.has(m.id) : null }))
    if (live) for (const extra of live) if (!models.some((m) => m.id === extra)) models.push({ id: extra, label: extra, note: '이 키로 열리는 다른 모델', price: null, tier: null, verified: true })
    providers.push({ id, label: PROVIDERS[id].label, configured: ready.has(id), keyName: PROVIDERS[id].keyNames[0], models: models.slice(0, 40), checked: !!live })
  }
  return { providers, defaultChoice: defaultChoice() }
}

/* ------------------------------------------------------------------ */
/* 부르기 — 세 공급자를 같은 모양으로(글 · 끝난 까닭 · 실제 모델 · 토큰)                     */
/* ------------------------------------------------------------------ */

export class ProviderError extends Error {
  constructor(code, status) {
    super(code)
    this.code = code
    this.status = status
  }
}

function statusError(status) {
  if (status === 401 || status === 403) return new ProviderError('provider_auth', 503)
  if (status === 429 || status === 529) return new ProviderError('provider_busy', 503)
  if (status === 400 || status === 404) return new ProviderError('provider_rejected', 502)
  return new ProviderError('provider_error', 502)
}

/**
 * one call. json=true 면 JSON 한 덩어리를 달라고 공급자 기능으로도 요청한다(OpenAI · Gemini).
 * maxOut 은 '생각' 토큰까지 포함하는 공급자가 있어 넉넉히 넘긴다.
 */
/** D-252 검색 근거에서 고른 출처(웹 주소만 · 8개까지) */
function cleanSources(list) {
  const seen = new Set()
  const out = []
  for (const s of list) {
    const url = s && typeof s.url === 'string' ? s.url.trim() : ''
    if (!/^https?:\/\//.test(url) || seen.has(url)) continue
    seen.add(url)
    out.push({ title: String((s && s.title) || '').trim().slice(0, 120) || url.replace(/^https?:\/\//, '').slice(0, 60), url: url.slice(0, 500) })
    if (out.length >= 8) break
  }
  return out
}

/**
 * search=true(D-252 조사해줘) — 공급자의 웹 검색을 붙인다: Gemini google_search · Claude web_search. OpenAI 는 붙이지 않는다(searched=false).
 * 검색을 붙이면 JSON 모드는 끈다(함께 못 쓰는 모델이 있다) — 글에서 JSON 을 뽑는다.
 */
export async function callModel({ provider, key, base, model, system, user, maxOut, timeoutMs, json = true, search = false }) {
  const withSearch = search && (provider === 'gemini' || provider === 'anthropic')
  if (withSearch) json = false
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let res
  try {
    if (provider === 'gemini') {
      res = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: maxOut, ...(json ? { responseMimeType: 'application/json' } : {}) },
          ...(withSearch ? { tools: [{ google_search: {} }] } : {}),
        }),
        signal: ctrl.signal,
      })
    } else if (provider === 'anthropic') {
      res = await fetch(`${base}/messages`, {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: maxOut, system, messages: [{ role: 'user', content: user }], ...(withSearch ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }] } : {}) }),
        signal: ctrl.signal,
      })
    } else {
      res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          ...(json ? { response_format: { type: 'json_object' } } : {}),
          max_completion_tokens: maxOut,
        }),
        signal: ctrl.signal,
      })
    }
  } catch {
    throw new ProviderError('provider_unreachable', 502)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw statusError(res.status)
  let data
  try {
    data = await res.json()
  } catch {
    throw new ProviderError('provider_error', 502)
  }
  if (provider === 'gemini') {
    const cand = data && Array.isArray(data.candidates) ? data.candidates[0] : null
    const parts = cand && cand.content && Array.isArray(cand.content.parts) ? cand.content.parts : []
    const content = parts.filter((p) => p && typeof p.text === 'string' && !p.thought).map((p) => p.text).join('')
    const u = (data && data.usageMetadata) || {}
    const chunks = cand && cand.groundingMetadata && Array.isArray(cand.groundingMetadata.groundingChunks) ? cand.groundingMetadata.groundingChunks : []
    const sources = cleanSources(chunks.map((c) => ({ url: c && c.web && c.web.uri, title: c && c.web && c.web.title })))
    return {
      content,
      searched: withSearch,
      sources,
      finish: cand && cand.finishReason ? String(cand.finishReason) : '',
      model: typeof data.modelVersion === 'string' && data.modelVersion ? data.modelVersion : model,
      usage: { input: Number(u.promptTokenCount) || 0, output: (Number(u.candidatesTokenCount) || 0) + (Number(u.thoughtsTokenCount) || 0) },
    }
  }
  if (provider === 'anthropic') {
    const blocks = data && Array.isArray(data.content) ? data.content : []
    const content = blocks.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('')
    const u = (data && data.usage) || {}
    const found = blocks.filter((b) => b && b.type === 'web_search_tool_result' && Array.isArray(b.content)).flatMap((b) => b.content.map((r) => ({ url: r && r.url, title: r && r.title })))
    return {
      content,
      searched: withSearch,
      sources: cleanSources(found),
      finish: data && data.stop_reason ? String(data.stop_reason) : '',
      model: typeof data.model === 'string' && data.model ? data.model : model,
      usage: { input: Number(u.input_tokens) || 0, output: Number(u.output_tokens) || 0 },
    }
  }
  const choice = data && Array.isArray(data.choices) ? data.choices[0] : null
  const content = choice && choice.message && typeof choice.message.content === 'string' ? choice.message.content : ''
  const u = (data && data.usage) || {}
  return {
    content,
    searched: false,
    sources: [],
    finish: choice && choice.finish_reason ? String(choice.finish_reason) : '',
    model: typeof data.model === 'string' && data.model ? data.model : model,
    usage: { input: Number(u.prompt_tokens) || 0, output: Number(u.completion_tokens) || 0 },
  }
}
