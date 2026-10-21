/**
 * 대표 AI 작업실 — 서버 쪽 공통(설정 · 개인정보 지우기 · 결과 검사 · 프롬프트 · 공급자 · 비용).
 *
 * 비밀 키는 서버 환경변수에서만 읽는다. VITE_ 로 시작하는 이름은 읽지 않는다 — 번들에 들어가는 이름이라서.
 * 공급자는 세 곳(Gemini · GPT · Claude — providers.js). 예전 설정(AI_PROVIDER=openai + AI_MODEL_*)이 다 있으면 그대로 쓰고,
 * 아니면 화면에서 고른 공급자(없으면 기본 Gemini)의 빠르게/보통/깊게 모델을 쓴다(D-239).
 */
import { PROVIDERS, ProviderError, callModel, cleanChoice, configuredProviders, defaultChoice, priceOf, providerBase, providerKey, tierModel } from './providers.js'

export { ProviderError }

export const TIERS = ['cheap', 'standard', 'deep']

function env(names) {
  for (const n of names) {
    if (n.startsWith('VITE_')) continue
    const v = process.env[n]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

/** "0.15,0.6" → { in: 0.15, out: 0.6 } (USD · 100만 토큰당). 없거나 이상하면 null — 비용을 지어내지 않는다 */
function parsePrice(v) {
  const m = /^\s*([0-9]+(?:\.[0-9]+)?)\s*,\s*([0-9]+(?:\.[0-9]+)?)\s*$/.exec(v || '')
  return m ? { in: Number(m[1]), out: Number(m[2]) } : null
}

const DEFAULT_MAX_OUT = { cheap: 1500, standard: 5000, deep: 12000 }
const CONTEXT_BUDGET = { cheap: 9000, standard: 18000, deep: 30000 }

/** 예전 설정(OpenAI 하나 · 단계별 모델 이름)이 모두 들어 있으면 그 설정 */
function legacyConfig() {
  const provider = (env(['AI_PROVIDER']) || 'openai').toLowerCase()
  const key = env(['OPENAI_API_KEY', 'AI_API_KEY'])
  const baseRaw = env(['AI_BASE_URL']) || 'https://api.openai.com/v1'
  const base = /^https:\/\/[^\s/]+(\/[^\s]*)?$/.test(baseRaw) ? baseRaw.replace(/\/+$/, '') : ''
  const fallback = env(['AI_MODEL'])
  const models = {}
  const prices = {}
  for (const t of TIERS) {
    const T = t.toUpperCase()
    models[t] = env([`AI_MODEL_${T}`]) || fallback
    prices[t] = parsePrice(env([`AI_PRICE_${T}`]))
  }
  const missing = []
  if (provider !== 'openai') missing.push('AI_PROVIDER(지금은 openai 만)')
  if (!key) missing.push('OPENAI_API_KEY')
  if (!base) missing.push('AI_BASE_URL(https 주소)')
  for (const t of TIERS) if (!models[t]) missing.push(`AI_MODEL_${t.toUpperCase()}`)
  return { provider, key, base, models, prices, missing }
}

/**
 * choice = 화면에서 고른 { provider, model }(없으면 기본). 예전 OpenAI 설정이 완전하고 고른 것이 없거나 OpenAI 면 예전 그대로.
 * 고른 공급자에 키가 없으면 missing 에 그 키 이름 — 다른 공급자로 몰래 바꾸지 않는다.
 */
export function aiConfig(choiceIn) {
  const maxOut = {}
  for (const t of TIERS) {
    const n = Number(env([`AI_MAX_OUTPUT_${t.toUpperCase()}`]))
    maxOut[t] = Number.isFinite(n) && n >= 256 && n <= 64000 ? Math.floor(n) : DEFAULT_MAX_OUT[t]
  }
  const timeoutMs = Math.min(Math.max(Number(env(['AI_TIMEOUT_MS'])) || 55000, 5000), 295000)
  const choice = cleanChoice(choiceIn)
  // D-255 대표 "AI 작업실도 내가 고른 모델로" — 화면에서 모델까지 골랐으면 빠르게 · 보통 · 깊게 모두 그 모델(안 골랐으면 전처럼 단계별)
  const pinned = choice && choice.model ? choice.model : ''
  const legacy = legacyConfig()
  if (legacy.missing.length === 0 && (!choice || choice.provider === 'openai')) {
    if (!pinned) return { ...legacy, maxOut, timeoutMs, legacy: true }
    const models = Object.fromEntries(TIERS.map((t) => [t, pinned]))
    const prices = Object.fromEntries(TIERS.map((t) => [t, priceOf('openai', pinned) || legacy.prices[t]]))
    return { ...legacy, models, prices, maxOut, timeoutMs, legacy: true, pinned }
  }

  const anyKey = configuredProviders()
  const provider = choice ? choice.provider : anyKey.includes(defaultChoice().provider) ? defaultChoice().provider : anyKey[0] || defaultChoice().provider
  const key = providerKey(provider)
  const base = providerBase(provider)
  const models = {}
  const prices = {}
  for (const t of TIERS) {
    models[t] = pinned || tierModel(provider, t)
    prices[t] = (!pinned && provider === 'openai' && parsePrice(env([`AI_PRICE_${t.toUpperCase()}`]))) || priceOf(provider, models[t])
  }
  const missing = []
  if (!key) missing.push(anyKey.length === 0 && !choice ? 'GEMINI_API_KEY(또는 OPENAI_API_KEY · ANTHROPIC_API_KEY)' : PROVIDERS[provider].keyNames[0])
  if (!base) missing.push(`${PROVIDERS[provider].baseNames[0]}(https 주소)`)
  return { provider, key, base, models, prices, maxOut, timeoutMs, missing, legacy: false, pinned }
}

/** 화면에 알려도 되는 설정 상태(키 · 모델 이름 값은 빼고) */
export function publicStatus(cfg) {
  const tiers = {}
  for (const t of TIERS) tiers[t] = !!(cfg.key && cfg.base && cfg.models[t])
  return {
    configured: cfg.missing.length === 0,
    provider: cfg.provider,
    tiers,
    missing: cfg.missing,
    priced: Object.fromEntries(TIERS.map((t) => [t, !!cfg.prices[t]])),
  }
}

/* ------------------------------------------------------------------ */
/* 개인정보 · 비밀 지우기 — 화면에서 한 번(privacyFilter) 거르고 서버에서 또 거른다     */
/* ------------------------------------------------------------------ */

const SCRUB = [
  // D-244: 이메일 먼저(안의 숫자가 다른 규칙에 걸리지 않게) — 화면 privacyFilter 와 같은 모양
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[가림:이메일]'],
  [/\b\d{6}\s*-\s*[1-8]\d{6}\b/g, '[가림:주민번호]'],
  // D-244: 주민번호 다른 모양 — 여러 하이픈 · 가림(*) · 붙은 13자리(앞 6자리가 날짜) · 6자리 공백 7자리(화면 stripRrn 과 같은 모양)
  [/(?<![A-Za-z0-9_./])\d{6}\s*[-‐‑‒–—―−－]\s*[0-9*xX●•○#]{7}(?![0-9A-Za-z*●•○#_])/g, '[가림:주민번호]'],
  [/(?<![A-Za-z0-9_./-])\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[0-9]\d{6}(?![A-Za-z0-9_./])/g, '[가림:주민번호]'],
  [/(?<![A-Za-z0-9_./])\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\s+[0-9][0-9*]{6}(?![0-9A-Za-z*_])/g, '[가림:주민번호]'],
  [/((?:공동인증서\s*(?:비밀번호|비번|암호)?|인증서\s*(?:비밀번호|비번|암호)|비밀번호|비번|패스워드|암호|password|passwd|pwd)\s*[:：=]?\s*)(\S+)/gi, '$1[가림:비밀번호]'],
  [/\b(sk-[A-Za-z0-9_-]{8,}|sb_secret_[A-Za-z0-9_-]+|AKIA[0-9A-Z]{12,}|ghp_[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})\b/g, '[가림:키]'],
  [/((?:api[_ -]?key|secret|token|service_role)\s*[:：=]\s*)(\S+)/gi, '$1[가림:키]'],
  [/\b(?:\d{4}[- ]){3}\d{4}\b/g, '[가림:카드]'],
  [/(계좌(?:번호)?\s*[:：]?\s*)([0-9][0-9-]{8,20}[0-9])/g, '$1[가림:계좌]'],
  // D-244: +82 국제 번호(휴대폰 · 유선) — 휴대폰 규칙보다 먼저
  [/\+\s*82[\s-]*(?:\(0\)[\s-]*|0)?\d{1,2}[\s-]*\d{3,4}[\s-]*\d{4}(?!\d)/g, '[가림:전화]'],
  [/\b01[016789]\s*-?\s*\d{3,4}\s*-?\s*\d{4}\b/g, '[가림:휴대폰]'],
  // D-244: 유선 전화(02 · 031~064 · 070 · 050x) — 사업자번호(123-45-67890) · 날짜 · 금액은 모양이 달라 걸리지 않는다
  [/(?<![\d-])0(?:2|3[1-3]|4[1-4]|5[1-5]|6[1-4]|70|50\d)\s*[-.)]?\s*\d{3,4}\s*[-.]?\s*\d{4}(?!\d)/g, '[가림:전화]'],
]

export function scrubText(s) {
  let out = String(s)
  for (const [re, rep] of SCRUB) out = out.replace(re, rep)
  return out
}

export function scrubDeep(v, depth = 0) {
  if (depth > 8) return null
  if (typeof v === 'string') return scrubText(v)
  if (Array.isArray(v)) return v.slice(0, 200).map((x) => scrubDeep(x, depth + 1))
  if (v && typeof v === 'object') {
    const o = {}
    for (const [k, x] of Object.entries(v).slice(0, 200)) o[k] = scrubDeep(x, depth + 1)
    return o
  }
  return typeof v === 'number' || typeof v === 'boolean' ? v : null
}

/* ------------------------------------------------------------------ */
/* 결과 검사 — 필요한 칸이 있는지 · 모양(글 · 목록 · 묶음) · 가벼운 고쳐 담기                */
/* ------------------------------------------------------------------ */

export function validate(schema, value, path = '') {
  const errors = []
  const fix = (sch, v, p) => {
    if (!sch) return v
    if (sch.type === 'string') {
      if (typeof v === 'string') return v
      if (typeof v === 'number' || typeof v === 'boolean') return String(v)
      if (v == null) return ''
      if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' || typeof x === 'number').join('\n')
      errors.push(`${p}: 글이 아님`)
      return ''
    }
    if (sch.type === 'number') {
      const n = typeof v === 'number' ? v : Number(v)
      return Number.isFinite(n) ? n : 0
    }
    if (sch.type === 'boolean') return v === true || v === 'true'
    if (sch.type === 'array') {
      const arr = Array.isArray(v) ? v : v == null || v === '' ? [] : [v]
      return arr.slice(0, 60).map((x, i) => fix(sch.items, x, `${p}[${i}]`))
    }
    if (sch.type === 'object') {
      if (!v || typeof v !== 'object' || Array.isArray(v)) {
        errors.push(`${p || '결과'}: 묶음이 아님`)
        return {}
      }
      const o = {}
      for (const k of sch.required || []) if (!(k in v) || v[k] == null || v[k] === '') errors.push(`${p ? p + '.' : ''}${k}: 없음`)
      for (const [k, x] of Object.entries(v)) o[k] = sch.props && sch.props[k] ? fix(sch.props[k], x, `${p ? p + '.' : ''}${k}`) : x
      return o
    }
    return v
  }
  const out = fix(schema, value, path)
  return { ok: errors.length === 0, value: out, errors }
}

/** 모델 글 → JSON(코드블록 · 앞뒤 말이 붙어도) */
export function extractJson(text) {
  if (typeof text !== 'string') return null
  let t = text.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t)
  if (fence) t = fence[1]
  const a = t.indexOf('{')
  const b = t.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  try {
    return JSON.parse(t.slice(a, b + 1))
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* 프롬프트 — 필요한 것만, 예산 안에서                                              */
/* ------------------------------------------------------------------ */

const clip = (s, n) => {
  const t = String(s ?? '').trim()
  return t.length > n ? `${t.slice(0, n)}…(줄임)` : t
}

function lines(title, rows) {
  const body = rows.filter(Boolean)
  return body.length ? [`[${title}]`, ...body, ''] : []
}

/**
 * context(화면이 만든 최소 묶음) + input(작업 요청) → 사용자 메시지 글. 예산을 넘으면 자료 글부터 줄인다.
 * 돌려주는 sent 는 시험 · 기록용(몇 글자를 보냈나).
 */
export function buildPrompt(skill, context, input, tier, commonRules) {
  const c = context && typeof context === 'object' ? context : {}
  const budget = CONTEXT_BUDGET[tier] || CONTEXT_BUDGET.standard
  const company = c.company && typeof c.company === 'object' ? c.company : {}
  const fieldRows = (arr, n = 400) => (Array.isArray(arr) ? arr : []).slice(0, 40).map((f) => (f && f.label ? `- ${clip(f.label, 40)}: ${clip(f.value || '미확인', n)}` : null))
  const head = [
    ...lines('업체 자료', [company.name ? `- 회사명: ${clip(company.name, 120)}` : null, ...fieldRows(company.fields)]),
    ...lines(`지금까지의 기억${c.memory && c.memory.version ? ` v${c.memory.version}` : ''}`, fieldRows(c.memory && c.memory.fields, 900)),
    ...lines('OS 진단(규칙 계산 결과)', (Array.isArray(c.diagnosis) ? c.diagnosis : []).slice(0, 20).map((d) => `- ${clip(d, 300)}`)),
    ...lines('대표가 채택한 결과', (Array.isArray(c.adopted) ? c.adopted : []).slice(0, 8).map((r) => (r ? `- ${clip(r.skill, 40)}${r.version ? ` v${r.version}` : ''}${r.partial ? '(일부 채택)' : ''}: ${clip(r.summary, 900)}` : null))),
    ...lines('최근 결과(참고)', (Array.isArray(c.recent) ? c.recent : []).slice(0, 4).map((r) => (r ? `- ${clip(r.skill, 40)}: ${clip(r.summary, 400)}` : null))),
  ]
  const ask = input && typeof input === 'object' ? input : {}
  const opts = ask.options && typeof ask.options === 'object' ? Object.entries(ask.options).slice(0, 12).map(([k, v]) => `- ${clip(k, 30)}: ${clip(typeof v === 'string' || typeof v === 'number' ? v : JSON.stringify(v), 3000)}`) : []
  // 맞춤법 검사는 제안서 글 전체가 작업 요청이다(위치 표시 붙은 줄들) — 그만큼 더 받는다
  const taskMax = skill.id === 'PROOFREAD' ? 12000 : 4000
  const task = [...lines('작업 요청', [ask.task ? clip(ask.task, taskMax) : '- (따로 요청 없음 — 이 스킬의 기본 작업)', ...opts])]
  const used = head.join('\n').length + task.join('\n').length
  const mats = Array.isArray(c.materials) ? c.materials.slice(0, 12) : []
  let left = Math.max(0, budget - used)
  const matRows = []
  for (let i = 0; i < mats.length; i++) {
    const m = mats[i]
    if (!m || !m.text) continue
    const share = Math.floor(left / Math.max(1, mats.length - i))
    const take = Math.max(0, Math.min(6000, share) - 40)
    if (take < 120) break
    const row = `- ${clip(m.title || '자료', 60)}(${clip(m.kind || '기타', 20)}): ${clip(m.text, take)}`
    matRows.push(row)
    left -= row.length
  }
  const user = [...head, ...lines('자료(필요한 부분만)', matRows), ...task].join('\n').trim()
  const system = [...commonRules, '', `[스킬] ${skill.name} (${skill.id} v${skill.version})`, ...skill.systemInstruction, '', '[출력 형식] 아래 JSON 과 같은 키로, JSON 하나만:', JSON.stringify(skill.example)].join('\n')
  return { system, user, sent: { systemChars: system.length, userChars: user.length, materials: matRows.length } }
}

/* ------------------------------------------------------------------ */
/* 공급자 — 세 곳 같은 모양(providers.js)                                         */
/* ------------------------------------------------------------------ */

export async function callProvider(cfg, tier, system, user) {
  if (!cfg.key || !cfg.base || !cfg.models[tier]) throw new ProviderError('setup_needed', 503)
  // 예전 OpenAI 설정은 출력 상한을 그대로(시험이 본다) · 새 공급자는 '생각' 토큰 몫까지 두 배
  const maxOut = cfg.legacy ? cfg.maxOut[tier] : cfg.maxOut[tier] * 2
  return callModel({ provider: cfg.provider, key: cfg.key, base: cfg.base, model: cfg.models[tier], system, user, maxOut, timeoutMs: cfg.timeoutMs })
}

export function costOf(cfg, tier, usage) {
  const p = cfg.prices[tier]
  if (!p) return null
  return Math.round(((usage.input * p.in + usage.output * p.out) / 1e6) * 1e6) / 1e6
}

/** 사람에게 보일 오류 문장(비밀 · 원문 없음) */
export const ERROR_TEXT = {
  setup_needed: 'AI 기능 설정이 필요합니다.',
  db_setup_needed: 'AI 작업실 DB 설정이 필요합니다(0021).',
  login_required: '다시 로그인해 주세요.',
  forbidden: '이 기능을 쓸 권한이 없습니다.',
  provider_not_allowed: '팀장 계정은 지금 Gemini 모델만 쓸 수 있습니다.',
  rate_limited: '요청이 너무 잦습니다. 잠시 뒤 다시 눌러 주세요.',
  bad_request: '요청 모양이 맞지 않습니다.',
  too_large: '보낼 자료가 너무 많습니다. 자료를 줄여 주세요.',
  request_conflict: '같은 요청 번호로 다른 작업이 왔습니다. 새로 눌러 주세요.',
  provider_auth: 'AI 키를 확인해 주세요(설정 필요).',
  provider_busy: 'AI 쪽이 혼잡하거나 사용 한도에 닿았습니다. 잠시 뒤 다시 시도해 주세요.',
  provider_rejected: 'AI 설정(모델 이름)을 확인해 주세요.',
  provider_unreachable: 'AI 응답을 받지 못했습니다(시간 초과 또는 연결 문제). 다시 시도해 주세요.',
  provider_error: 'AI 쪽 오류로 결과를 받지 못했습니다. 다시 시도해 주세요.',
  auth_unreachable: '로그인 확인이 늦어 멈췄습니다. 잠시 뒤 다시 시도해 주세요.',
}
