/**
 * D-239 AI 도우미 시험 — 공급자 세 곳(Gemini 기본 · GPT · Claude) · 서버 함수(api/ai-assist) · 질문 단추 서재 · 화면 자료 묶음(개인정보 빼기).
 *
 * 서버 함수는 진짜 코드를 부르고, 밖으로 나가는 것(Supabase 로그인 · 권한 RPC · 세 공급자)만 가짜 fetch 로 바꾼다.
 */
import handler, { __resetAiAssistState } from '../../../api/ai-assist.js'
import runHandler, { __resetAiRunState } from '../../../api/ai-run.js'
import { ASSISTS, ASSIST_EXAMPLE, ASSIST_OUTPUT_SCHEMA, ASSIST_RULES, RADAR_RULES, assistSystem, buildAssistPrompt } from '../../../api/_ai/assists.js'
import { MODEL_CATALOG, PROVIDER_ORDER, defaultChoice, cleanChoice, catalogOf } from '../../../api/_ai/providers.js'
import { aiConfig, validate } from '../../../api/_ai/core.js'
import { ASSIST_PRESETS } from '../aiAssist/presets'
import { safeText, personNames, RefBook, clientRow, normRef } from '../aiAssist/context'
import { betterModel, dueFromWhen, isSamePage, refLabel, todoText } from '../aiAssist/actions'
import type { AssistStatus } from '../aiAssist/client'
import { DEFAULT_BRIEF, SCRIPT_MAX, aiPlanInput, ideaFromOpportunity, normalizeBrief, normalizeIdea, type ContentIdea } from '../marketing/radarStore'
import { prepareFeed } from '../marketing/ytBench'
import { radarPlan, radarVideos } from '../marketing/ytRadar'
import { sampleFeed } from '../marketing/ytSample'
import { agentsBundle, clientsBundle, inboxBundle, maskStaff, moduleBundle, radarBundle, salesBundle } from '../aiAssist/builders'
import { contextHash } from '../aiAssist/store'
import { normalizeClientOps } from '../clientOpsService'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { CustomerEvent } from '../../types/bridge'

let passed = 0
let failed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1
    console.log('PASS ', name)
  } else {
    failed += 1
    console.log('FAIL ', name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 1500))
  }
}

/* ------------------------------------------------------------------ */
/* 가짜 바깥                                                             */
/* ------------------------------------------------------------------ */

const OWNER = 'Bearer owner-token-aaaaaaaaaaaaaaaaaaaa'
const PILOT = 'Bearer pilot-token-bbbbbbbbbbbbbbbbbbbb'
const G_KEY = 'gem-test-KEY-998877'
const A_KEY = 'ant-test-KEY-665544'
const O_KEY = 'sk-test-ASSIST-332211'
const ANSWER = { headline: '오늘은 한솔정밀 서류부터', items: [{ title: '한솔정밀 서류 받기', ref: 'c1', tag: '마감', detail: '내일까지' }], next: ['전화'], caution: '' }

type Call = { url: string; headers: Record<string, string>; body: Record<string, unknown> }
let calls: Call[] = []
let reply: (c: Call) => { status: number; body: unknown } = () => ({ status: 200, body: {} })

const okFor = (url: string) => {
  if (url.includes(':generateContent')) return { candidates: [{ content: { parts: [{ text: JSON.stringify(ANSWER) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200, thoughtsTokenCount: 50 } }
  if (url.includes('/messages')) return { content: [{ type: 'text', text: '```json\n' + JSON.stringify(ANSWER) + '\n```' }], usage: { input_tokens: 900, output_tokens: 150 }, stop_reason: 'end_turn', model: 'claude-haiku-5-5' }
  return { model: 'x', choices: [{ message: { content: JSON.stringify(ANSWER) }, finish_reason: 'stop' }], usage: { prompt_tokens: 800, completion_tokens: 100 } }
}

globalThis.fetch = (async (input: unknown, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
  const url = String(input)
  const headers = init?.headers ?? {}
  if (url.startsWith('https://qa.supabase.test/auth/v1/user')) {
    if (headers.Authorization === OWNER) return new Response(JSON.stringify({ id: 'owner-1' }), { status: 200 })
    if (headers.Authorization === PILOT) return new Response(JSON.stringify({ id: 'pilot-1' }), { status: 200 })
    return new Response('{}', { status: 401 })
  }
  if (url.startsWith('https://qa.supabase.test/rest/v1/rpc/has_capability')) return new Response(JSON.stringify(headers.Authorization === OWNER), { status: 200 })
  const c: Call = { url, headers, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {} }
  if (/models(\?|$)/.test(url) && (init?.method ?? 'GET') === 'GET') {
    calls.push(c)
    if (url.includes('generativelanguage')) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-3.1-flash-lite', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-9-preview', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-3.1-flash-lite-tts', supportedGenerationMethods: ['generateContent'] }, { name: 'models/text-embedding', supportedGenerationMethods: ['embedContent'] }] }), { status: 200 })
    return new Response(JSON.stringify({ data: [] }), { status: 200 })
  }
  calls.push(c)
  const r = reply(c)
  return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), { status: r.status })
}) as typeof fetch

type MockRes = { statusCode: number; headers: Record<string, string>; raw: string; body: Record<string, unknown>; setHeader: (k: string, v: string) => void; end: (b?: string) => void }
function mkRes(): MockRes {
  const r: MockRes = {
    statusCode: 200,
    headers: {},
    raw: '',
    body: {},
    setHeader(k, v) {
      r.headers[k.toLowerCase()] = v
    },
    end(b) {
      r.raw = b ?? ''
      try {
        r.body = JSON.parse(r.raw)
      } catch {
        r.body = {}
      }
    },
  }
  return r
}

function setEnv(over: Record<string, string | undefined> = {}) {
  for (const k of Object.keys(process.env)) if (/^(AI_|OPENAI_|SUPABASE_|GEMINI_|GOOGLE_API|GOOGLE_GENERATIVE|ANTHROPIC_API|CLAUDE_API|VITE_)/.test(k)) delete process.env[k]
  for (const [k, v] of Object.entries({ SUPABASE_URL: 'https://qa.supabase.test', SUPABASE_ANON_KEY: 'qa-anon', GEMINI_API_KEY: G_KEY, ANTHROPIC_API_KEY: A_KEY, AI_GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta', ...over })) if (v !== undefined) process.env[k] = v
  __resetAiAssistState()
  __resetAiRunState()
  calls = []
  reply = (c) => ({ status: 200, body: okFor(c.url) })
}

let seq = 0
const rid = () => `req-assist-${String(++seq).padStart(6, '0')}`
async function post(body: Record<string, unknown>, auth = OWNER) {
  const res = mkRes()
  await handler({ method: 'POST', url: '/api/ai-assist', headers: auth ? { authorization: auth } : {}, body: JSON.stringify(body) }, res)
  return res
}
async function get(url: string, auth = OWNER) {
  const res = mkRes()
  await handler({ method: 'GET', url, headers: { authorization: auth } }, res)
  return res
}
const CTX = { title: '오늘 할 일', today: '2026-10-19 (월)', sections: [{ name: '할 일', rows: [{ ref: 'c1', 할일: '한솔정밀 대표 010-1234-5678 에게 서류 요청', 기한: '2026-10-19' }] }] }

/* ------------------------------------------------------------------ */
/* 1. 서재 · 모델 목록                                                    */
/* ------------------------------------------------------------------ */

{
  const server = Object.values(ASSISTS) as { id: string; page: string; label: string; kind: string; maxOut: number; instruction: string[] }[]
  const same = server.length === ASSIST_PRESETS.length && server.every((s) => ASSIST_PRESETS.some((p) => p.id === s.id && p.page === s.page && p.label === s.label && p.kind === s.kind))
  check(`L1 질문 단추 서재 — 화면 이름표와 서버 지시문이 같은 id · 화면 · 이름 · 종류(${server.length}개)`, same && server.length >= 40, server.filter((s) => !ASSIST_PRESETS.some((p) => p.id === s.id && p.label === s.label)).map((s) => s.id))
  const pages = new Set(server.map((s) => s.page))
  check('L2 화면 12곳 — 오늘 · 영업 · 고객 관리 · 상담신청 · 정산 · 매출비용 · 일정 · 지원사업 · 업체 상세 · 모듈 · 마케팅 · 홍보 글', ['today', 'sales', 'clients', 'inbox', 'agents', 'money', 'calendar', 'grants', 'client', 'module', 'radar', 'content'].every((p) => pages.has(p)), [...pages])
  check('L3 대표가 말한 단추 그대로 — 곧 줄 정산 · 올해 총 지급 · 여러 달 연락 안 된 곳 · 가장 큰 비용 · 1년 지출 · 전환 가능성 · TOP5 기획 · 급상승 참고 · 내 콘텐츠 · 블로그 · 플레이스 · 오늘 제일 중요한 것', ['agents.soon', 'agents.year', 'clients.quiet', 'money.top', 'money.year', 'inbox.rank', 'radar.top5', 'rising.ref', 'mine.detail', 'content.blog', 'content.place', 'today.top3', 'module.all'].every((id) => id in ASSISTS))
  check('L4 공통 규칙 — 자료 밖 숫자 지어내지 않음 · OS 계산 그대로 · 개인정보 안 씀 · JSON 만', /지어|만들지 않/.test(ASSIST_RULES.join('\n')) && ASSIST_RULES.join('\n').includes('OS 가 규칙으로 계산') && ASSIST_RULES.join('\n').includes('개인정보') && ASSIST_RULES.join('\n').includes('JSON'))
  check('L5 출력 틀(예시)이 검사를 통과', validate(ASSIST_OUTPUT_SCHEMA, ASSIST_EXAMPLE).ok)
  check('L6 공급자 세 곳 · 순서 Gemini 먼저', PROVIDER_ORDER.join() === 'gemini,openai,anthropic' && PROVIDER_ORDER.every((p) => MODEL_CATALOG[p as keyof typeof MODEL_CATALOG].length >= 3))
  setEnv({ GEMINI_API_KEY: undefined, ANTHROPIC_API_KEY: undefined })
  check('L7 기본 선택 — 키가 없어도 Gemini 의 가장 싼 모델(빠르게 칸)', JSON.stringify(defaultChoice()) === JSON.stringify({ provider: 'gemini', model: 'gemini-3.1-flash-lite' }), defaultChoice())
  setEnv({ GEMINI_API_KEY: undefined, AI_DEFAULT_PROVIDER: undefined })
  check('L8 Gemini 키가 없고 Claude 키만 있으면 기본은 Claude 가장 싼 모델', defaultChoice().provider === 'anthropic' && defaultChoice().model === 'claude-haiku-5-5', defaultChoice())
  setEnv({ AI_DEFAULT_PROVIDER: 'openai', AI_DEFAULT_MODEL: 'gpt-5-nano' })
  check('L9 AI_DEFAULT_PROVIDER · AI_DEFAULT_MODEL 로 기본을 바꿀 수 있음', defaultChoice().provider === 'openai' && defaultChoice().model === 'gpt-5-nano')
  setEnv({ AI_MODELS_GEMINI: 'gemini-9-pro, bad model!, gemini-3.1-flash-lite' })
  const g = catalogOf('gemini')
  check('L10 AI_MODELS_GEMINI 로 새 모델을 앞에 더함(이상한 이름은 버림 · 같은 것 한 번)', g[0].id === 'gemini-9-pro' && !g.some((m) => m.id.includes(' ')) && g.filter((m) => m.id === 'gemini-3.1-flash-lite').length === 1)
  check('L11 화면이 보낸 선택 검사 — 모르는 회사 · 이상한 모델 이름은 버림', cleanChoice({ provider: 'evil' }) === null && cleanChoice({ provider: 'gemini', model: 'x y' })?.model === '' && cleanChoice({ provider: 'GEMINI', model: 'gemini-3.8-flash' })?.provider === 'gemini')
}

/* ------------------------------------------------------------------ */
/* 2. 서버 함수                                                          */
/* ------------------------------------------------------------------ */

async function serverTests() {
  setEnv()
  {
    const st = await get('/api/ai-assist?status=1')
    const providers = st.body.providers as { id: string; configured: boolean; models: { id: string }[] }[]
    check('S1 상태 — 세 회사 · Gemini/Claude 키 있음 · GPT 없음 · 키 값 · 주소 없음', st.statusCode === 200 && providers.length === 3 && providers[0].configured && !providers[1].configured && providers[2].configured && !st.raw.includes(G_KEY) && !st.raw.includes(A_KEY) && !st.raw.includes('googleapis'), st.raw.slice(0, 300))
    const live = await get('/api/ai-assist?status=1&models=1')
    const gem = (live.body.providers as { id: string; models: { id: string; verified: boolean | null }[] }[])[0]
    check('S2 키로 모델 확인 — 목록에 있는 것만 ✓ · 새 모델은 더함 · TTS · 임베딩은 뺌', gem.models.find((m) => m.id === 'gemini-3.1-flash-lite')?.verified === true && gem.models.some((m) => m.id === 'gemini-9-preview') && !gem.models.some((m) => /tts|embedding/.test(m.id)), gem.models.map((m) => `${m.id}:${m.verified}`))
  }
  {
    const r = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: CTX })
    const call = calls.find((c) => c.url.includes(':generateContent'))
    const sent = JSON.stringify(call?.body ?? {})
    check('S3 기본(선택 없음) → Gemini 가장 싼 모델로 부름 · 답 정리됨', r.statusCode === 200 && (r.body.run as { provider: string }).provider === 'gemini' && (call?.url ?? '').includes('/models/gemini-3.1-flash-lite:generateContent') && (r.body.run as { status: string }).status === 'succeeded', r.raw.slice(0, 400))
    check('S4 키는 머리줄(x-goog-api-key)로만 — 주소 · 응답에 키 없음', call?.headers['x-goog-api-key'] === G_KEY && !(call?.url ?? '').includes(G_KEY) && !r.raw.includes(G_KEY))
    check('S5 보내기 전에 휴대폰 번호 지움 · JSON 으로 달라고 요청', !sent.includes('1234-5678') && sent.includes('[가림:휴대폰]') && sent.includes('application/json'), sent.slice(0, 300))
    check('S6 비용 — 가격표로 계산(입력 1000 · 출력 250 → $0.0006)', (r.body.run as { estimatedCostUsd: number }).estimatedCostUsd === 0.000625, r.body.run)
    check('S7 규칙 · 단추 지시문이 system 에(사용자 글과 따로)', JSON.stringify(call?.body.systemInstruction ?? '').includes('오늘 꼭 해야 하는 것 3개') && !JSON.stringify(call?.body.contents ?? '').includes('오늘 꼭 해야 하는 것 3개'))
  }
  {
    calls = []
    const r = await post({ requestId: rid(), assistId: 'money.top', page: 'money', choice: { provider: 'anthropic' }, context: CTX })
    const call = calls.find((c) => c.url.includes('/messages'))
    check('S8 Claude 고름(모델 안 정함) → Claude 가장 싼 모델 · 코드블록 안 JSON 도 읽음', r.statusCode === 200 && call?.body.model === 'claude-haiku-5-5' && call?.headers['x-api-key'] === A_KEY && (r.body.run as { structured: { headline: string } }).structured.headline === ANSWER.headline, r.raw.slice(0, 300))
  }
  {
    calls = []
    const r = await post({ requestId: rid(), assistId: 'money.top', page: 'money', choice: { provider: 'openai', model: 'gpt-5-nano' }, context: CTX })
    check('S9 GPT 고름 · 키 없음 → 503 설정 필요 + 넣을 이름 OPENAI_API_KEY · 공급자 안 부름', r.statusCode === 503 && r.body.code === 'setup_needed' && JSON.stringify(r.body.missing) === '["OPENAI_API_KEY"]' && calls.length === 0, r.body)
  }
  setEnv({ OPENAI_API_KEY: O_KEY, AI_OPENAI_BASE_URL: 'https://api.openai.test/v1' })
  {
    const r = await post({ requestId: rid(), assistId: 'agents.year', page: 'agents', choice: { provider: 'openai', model: 'gpt-5.4-mini' }, context: CTX })
    const call = calls.find((c) => c.url.includes('/chat/completions'))
    check('S10 GPT 키 넣은 뒤 — 고른 모델로 · JSON 응답 요청', r.statusCode === 200 && call?.body.model === 'gpt-5.4-mini' && JSON.stringify(call?.body.response_format) === '{"type":"json_object"}' && call?.headers.Authorization === `Bearer ${O_KEY}`)
  }
  setEnv()
  {
    const r1 = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: CTX }, '')
    const r2 = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: CTX }, PILOT)
    check('S11 로그인 없음 401 · 팀장 403 · 공급자 안 부름(직접 불러도 막힘)', r1.statusCode === 401 && r2.statusCode === 403 && r2.body.code === 'forbidden' && calls.length === 0)
    const r3 = await post({ requestId: rid(), assistId: 'today.top3', page: 'money', context: CTX })
    const r4 = await post({ requestId: 'x', assistId: 'today.top3', page: 'today', context: CTX })
    const r5 = await post({ requestId: rid(), assistId: 'no.such', page: 'today', context: CTX })
    check('S12 단추와 화면이 다름 · 이상한 요청 번호 · 없는 단추 → 400', r3.statusCode === 400 && r4.statusCode === 400 && r5.statusCode === 400)
  }
  {
    const id = rid()
    const [a, b] = await Promise.all([post({ requestId: id, assistId: 'today.top3', page: 'today', context: CTX }), post({ requestId: id, assistId: 'today.top3', page: 'today', context: CTX })])
    const n = calls.filter((c) => c.url.includes(':generateContent')).length
    check('S13 같은 요청 번호 두 번(두 번 눌림) → 공급자 1번 · 답 하나', a.statusCode === 200 && b.statusCode === 200 && n === 1 && (a.body.replayed === true || b.body.replayed === true), { n })
  }
  setEnv({ AI_ASSIST_RATE_PER_MIN: '3' })
  {
    const rs = []
    for (let i = 0; i < 4; i++) rs.push(await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: CTX }))
    check('S14 속도 — 1분에 정한 수를 넘으면 429 · 다시 시도 시각', rs[2].statusCode === 200 && rs[3].statusCode === 429 && rs[3].headers['retry-after'] === '60', rs.map((r) => r.statusCode))
  }
  setEnv()
  {
    reply = () => ({ status: 401, body: { error: { message: `bad key ${G_KEY}` } } })
    const r = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: CTX })
    check('S15 공급자 401 → 503 provider_auth · 원문 · 키 없음', r.statusCode === 503 && r.body.code === 'provider_auth' && !r.raw.includes('bad key') && !r.raw.includes(G_KEY))
    reply = () => ({ status: 200, body: { candidates: [{ content: { parts: [{ text: '정리 못한 글입니다' }] } }], usageMetadata: {} } })
    const r2 = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: CTX })
    check('S16 JSON 이 아니면 parse_fallback · 받은 글 그대로', r2.statusCode === 200 && (r2.body.run as { status: string; raw: string }).status === 'parse_fallback' && (r2.body.run as { raw: string }).raw.includes('정리 못한 글'))
    reply = () => ({ status: 404, body: {} })
    const r3 = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', choice: { provider: 'gemini', model: 'gemini-old-gone' }, context: CTX })
    check('S17 없어진 모델(404) → 502 provider_rejected — 화면은 "다른 모델을 골라 주세요"', r3.statusCode === 502 && r3.body.code === 'provider_rejected')
  }
  setEnv({ VITE_GEMINI_API_KEY: 'should-not-read', GEMINI_API_KEY: undefined, ANTHROPIC_API_KEY: undefined })
  {
    const r = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: CTX })
    check('S18 VITE_ 이름의 키는 읽지 않음(번들에 들어가는 이름) → 설정 필요', r.statusCode === 503 && r.body.code === 'setup_needed')
  }
  // AI 작업실도 고른 회사로
  setEnv()
  {
    const st = mkRes()
    await runHandler({ method: 'GET', url: '/api/ai-run?status=1&provider=gemini', headers: { authorization: OWNER } }, st)
    check('S19 AI 작업실 — OpenAI 설정 없이 Gemini 키만 있어도 설정 완료(빠르게 · 보통 · 깊게)', st.statusCode === 200 && st.body.configured === true && st.body.provider === 'gemini' && JSON.stringify(st.body.tiers) === '{"cheap":true,"standard":true,"deep":true}', st.body)
    const cfg = aiConfig({ provider: 'anthropic' })
    check('S20 AI 작업실 Claude 고름 → 빠르게 Haiku · 보통 Sonnet · 깊게 Opus', cfg.models.cheap === 'claude-haiku-5-5' && cfg.models.standard === 'claude-sonnet-5-5' && cfg.models.deep === 'claude-opus-5-5')
    const legacy = (() => {
      setEnv({ GEMINI_API_KEY: undefined, ANTHROPIC_API_KEY: undefined, OPENAI_API_KEY: O_KEY, AI_MODEL_CHEAP: 'm-c', AI_MODEL_STANDARD: 'm-s', AI_MODEL_DEEP: 'm-d' })
      return aiConfig()
    })()
    check('S21 예전 OpenAI 설정(AI_MODEL_*)이 다 있으면 예전 그대로', legacy.legacy === true && legacy.models.deep === 'm-d' && legacy.missing.length === 0)
  }
}

/* ------------------------------------------------------------------ */
/* 3. 화면 자료 묶음 — 개인정보 빼기 · ref                                  */
/* ------------------------------------------------------------------ */

function rec(over: Partial<ClientOpsRecord> & Record<string, unknown>): ClientOpsRecord {
  return normalizeClientOps({ id: `c-${Math.random().toString(36).slice(2, 8)}`, workspaceId: null, companyName: '한솔정밀(주)', status: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...over })
}

function bundleTests() {
  const today = '2026-10-19'
  check('B1 자유 글 — 주민번호 · 휴대폰 · 이메일 가리고 그 업체 사람 이름은 (이름)', (() => {
    const t = safeText('김대표님 010-2222-3333 kim@x.com 850101-1234567 통화함', ['김대표'])
    return !t.includes('3333') && !t.includes('kim@x.com') && !t.includes('1234567') && t.includes('(이름)') && !t.includes('김대표')
  })())
  const r = rec({ representativeName: '김철수', contactName: '이영희', contactPhone: '010-9999-8888', contactEmail: 'lee@corp.kr', businessNumber: '123-45-67890', businessAddress: '경기도 화성시 동탄대로 1', notes: '김철수 대표와 통화 010-9999-8888 — 정책자금 관심', industry: '제조' })
  const book = new RefBook()
  const row = clientRow(book, r, { today })
  const text = JSON.stringify(row)
  check('B2 업체 한 줄 — 대표 · 담당자 이름 · 전화 · 이메일 · 사업자번호 · 상세 주소 없음 · 시/도만', !/김철수|이영희|9999|lee@corp|123-45|동탄대로/.test(text) && text.includes('경기') && row.ref === 'c1' && book.links.c1 === `/ops/clients/${r.id}`, text)
  { const pn = personNames(rec({ representativeName: '박대표', contactName: '최과장', status: 'waiting', sales: { stage: 'lead', source: '', referrer: '정소개', interests: [], concern: '', expectedFee: null, history: [], movedAt: '2026-10-01T00:00:00Z' } as never })); check('B3 personNames — 대표 · 담당자 · 소개한 사람', ['박대표', '최과장', '정소개'].every((n) => pn.includes(n)), pn) }
  check('B4 도구 기한 제목의 직원 이름 가림(청년도약 참여신청 — 홍길동)', maskStaff('청년도약 참여신청 — 홍길동') === '청년도약 참여신청 — (직원)')
  const quiet = rec({ companyName: '조용한상사', status: 'waiting', notes_list: [{ id: 'n1', text: '3월에 가업승계 상담 — 다시 연락 약속', pinned: false, createdAt: '2026-03-02T00:00:00Z', updatedAt: '2026-03-02T00:00:00Z' }] })
  const fresh = rec({ companyName: '최근상사', status: 'waiting', activity: [{ kind: 'note', text: '전화', at: '2026-10-18T00:00:00Z' }] as never })
  const cb = clientsBundle([fresh, quiet], today, undefined, 'prospect')
  const rows = cb.context.sections[0].rows
  check('B5 고객 관리 — 오래 조용한 곳이 먼저 · 그때 메모가 같이 감(여러 달 연락 안 된 곳 질문)', rows[0].업체 === '조용한상사' && JSON.stringify(rows[0].메모).includes('가업승계'), rows.map((x) => x.업체))
  const s = salesBundle([rec({ companyName: '클로징상사', status: 'waiting', sales: { stage: 'closing', expectedFee: 5_000_000, source: '소개', referrer: '', interests: ['정책자금'], concern: '', history: [], movedAt: '2026-10-01T00:00:00Z' } as never })], today)
  check('B6 영업 관리 — 단계 · 예상 수수료(만원) · 관심', JSON.stringify(s.context.sections[0].rows[0]).includes('500만원') && JSON.stringify(s.context.sections[0].rows[0]).includes('정책자금'))
  const ev: CustomerEvent = { id: 'e1', workspaceId: null, portalClientLinkId: null, operationsClientId: null, profileId: null, eventType: 'consultation_requested', sourceType: 'web', sourceId: 's', dedupeKey: 'd', payloadVersion: 1, payload: { company_name: '새싹기업', name: '홍길동', phone: '010-1111-2222', email: 'a@b.c', message: '정책자금 상담 원해요 010-1111-2222' }, priority: 'normal', status: 'new', occurredAt: '2026-10-10T00:00:00Z', receivedAt: '2026-10-10T00:00:00Z', handledAt: null, handlingNote: '', createdAt: '2026-10-10T00:00:00Z', updatedAt: '2026-10-10T00:00:00Z' } as CustomerEvent
  const ib = JSON.stringify(inboxBundle([ev], [], today).context)
  check('B7 상담신청 — 회사 · 문의는 보내고 이름 · 전화 · 이메일 칸은 읽지도 않음', ib.includes('새싹기업') && ib.includes('정책자금 상담') && !/홍길동|1111-2222|a@b\.c/.test(ib), ib.slice(0, 400))
  const agentRec = rec({ companyName: '정산상사', fees: [{ id: 'f1', label: '정책자금 성공보수', amount: 10_000_000, dueDate: '2026-11-01', receivedAt: '2026-10-01', agentName: '박영업', agentFee: 2_000_000, agentPaidAt: null }] as never })
  const ab = agentsBundle([agentRec], today)
  check('B8 영업자 정산 — 영업자별 줄 돈 · 항목 · 올해 준 돈', JSON.stringify(ab.context).includes('박영업') && JSON.stringify(ab.context).includes('200만원') && (ab.context.facts ?? []).some((f) => f.includes('올해')))
  const mb = moduleBundle({ today, records: [rec({ companyName: '모듈상사', employeeCount: '12' })], features: ['employment', 'labcare'], notices: [], usable: () => true, title: '고용 · 연구소' })
  check('B9 전문 모듈 → 고객 전체 — 업체 × 모듈 판정(규칙 계산 그대로) · 그 모듈만', mb.context.sections[0].rows.every((x) => ['고용지원금', '기업부설연구소', '연구소'].some((l) => String(x.모듈).includes(l)) || String(x.모듈).length > 0) && (mb.context.facts ?? []).some((f) => f.includes('규칙 계산')))
  check('B10 자료 지문 — 같은 자료면 같은 값 · 다르면 다른 값', contextHash('{"a":1}') === contextHash('{"a":1}') && contextHash('{"a":1}') !== contextHash('{"a":2}'))
  const big = { title: 't', today, sections: [{ name: '많음', rows: Array.from({ length: 400 }, (_, i) => ({ ref: `c${i + 1}`, 메모: '가'.repeat(500) })) }] }
  const pr = buildAssistPrompt(ASSISTS['clients.quiet'], big, '')
  check('B11 프롬프트 예산 — 4만 자 안 · 줄인 건수 표시', pr.user.length <= 41000 && pr.sent.rowsCut > 0 && pr.user.includes('줄임'), { len: pr.user.length, cut: pr.sent.rowsCut })
}

/* ------------------------------------------------------------------ */
/* D-241 답 → 다음 단계 · 레이더 기획을 내 채널 기준으로                       */
/* ------------------------------------------------------------------ */

function d241Tests() {
  // 번호(ref) — 모델이 모양을 조금 바꿔 돌려줘도 같은 번호로
  check('N1 normRef — " C3 " · "[c3]" · "#c3" · "c-3" → c3', ['c3', ' C3 ', '[c3]', '#c3', 'c-3', '(c3).'].every((r) => normRef(r) === 'c3'), ['c3', ' C3 ', '[c3]', '#c3', 'c-3', '(c3).'].map(normRef))
  check('N2 normRef — 번호 모양이 아니면 빈 글(없는 번호로 잇지 않음)', ['abc', 'c12345', '', '3', 'https://x', 'c 3 4'].every((r) => normRef(r) === '') && normRef(3) === '' && normRef(null) === '')
  { const book = new RefBook(); const r1 = book.ref('o', 'market:정책자금'); const r2 = book.ref('c', 'cli_1', '/ops/clients/cli_1'); const again = book.ref('o', 'market:정책자금'); check('N3 RefBook.ids — 번호 → 원래 번호(후보 키 · 업체 번호) · 같은 키는 같은 번호', r1 === 'o1' && again === 'o1' && book.ids.o1 === 'market:정책자금' && book.ids.c1 === 'cli_1' && r2 === 'c1' && !('o1' in book.links), book.ids) }

  // 이동 단추 이름 · 같은 화면이면 안 냄
  check('L1 단추 이름 — c 업체 열기 · g 공고 보기 · e 상담신청 보기 · t 업무 일기에서 보기 · i 내 콘텐츠에서 보기 · v 영상 보기 · 그 밖 열어 보기',
    refLabel('c2') === '업체 열기' && refLabel('g1') === '공고 보기' && refLabel('e4') === '상담신청 보기' && refLabel('t1') === '업무 일기에서 보기' && refLabel('i3') === '내 콘텐츠에서 보기' && refLabel('v9') === '영상 보기' && refLabel('o1') === '열어 보기')
  check('L2 같은 화면 — /marketing 을 /marketing?view=make 에서 누르면 같은 화면(D-239 마케팅 "열어 보기" 가 판만 닫던 것)', isSamePage('/marketing', { pathname: '/marketing', search: '?view=make' }))
  check('L3 다른 화면 — 내 콘텐츠 줄(?idea=) · 다른 주소 · 바깥 주소는 같은 화면 아님',
    !isSamePage('/marketing?view=make&idea=x1', { pathname: '/marketing', search: '?view=make' }) && !isSamePage('/ops/clients/a', { pathname: '/', search: '' }) && !isSamePage('https://youtu.be/x', { pathname: '/', search: '' }) && isSamePage('/marketing?view=make', { pathname: '/marketing', search: '?view=make&p=week' }))

  // 할 일로 넣기 — 기한 · 글
  const T = '2026-10-19'
  check('D1 기한 — 날짜가 있으면 그날 · 지났으면 오늘 · 내일 · 모레 · 다음 주 · 그 밖 오늘',
    dueFromWhen('2026-10-25 마감', T) === '2026-10-25' && dueFromWhen('2026.11.3', T) === '2026-11-03' && dueFromWhen('2026-10-01', T) === T && dueFromWhen('내일 오전', T) === '2026-10-20' && dueFromWhen('모레', T) === '2026-10-21' && dueFromWhen('다음 주 중', T) === '2026-10-26' && dueFromWhen('', T) === T && dueFromWhen(undefined, T) === T,
    [dueFromWhen('2026.11.3', T), dueFromWhen('다음 주 중', T)])
  check('D2 할 일 글 — 짧은 제목엔 설명 첫 문장을 붙이고 · 긴 제목은 그대로 · 200자 안',
    todoText({ title: '한솔 전화', detail: '서류 보완 안내. 다음 주 접수.' }) === '한솔 전화 — 서류 보완 안내.' && todoText({ title: '한솔정밀 정책자금 서류 보완 요청하기', detail: '자세히' }) === '한솔정밀 정책자금 서류 보완 요청하기' && todoText({ title: '가'.repeat(300) }).length === 200)

  // 더 잘 쓰는 모델로 다시
  const st = (configured: boolean): AssistStatus => ({ defaultChoice: { provider: 'gemini', model: 'g-cheap' }, providers: [{ id: 'gemini', label: 'Gemini', configured, keyName: 'GEMINI_API_KEY', checked: false, models: [{ id: 'g-cheap', label: '싼', note: '', price: null, verified: null, tier: 'cheap' }, { id: 'g-std', label: '보통', note: '', price: null, verified: null, tier: 'standard' }, { id: 'g-deep', label: '깊게', note: '', price: null, verified: null, tier: 'deep' }] }] })
  check('M1 더 잘 쓰는 모델 — 빠르게 → 보통 → 깊게 · 가장 위면 없음 · 키 없으면 없음 · 목록에 없는 모델은 빠르게로 보고 보통',
    betterModel(st(true), { provider: 'gemini', model: 'g-cheap' })?.model === 'g-std' && betterModel(st(true), { provider: 'gemini', model: 'g-std' })?.model === 'g-deep' && betterModel(st(true), { provider: 'gemini', model: 'g-deep' }) === null && betterModel(st(false), { provider: 'gemini', model: 'g-cheap' }) === null && betterModel(st(true), { provider: 'gemini', model: 'other' })?.model === 'g-std' && betterModel(null, { provider: 'gemini', model: 'g-cheap' }) === null)

  // 서버 — 마케팅 규칙 · 대본 단추 · '자료에 없음' 채우기 금지
  const radarSys = assistSystem(ASSISTS['radar.top5'])
  check('S1 마케팅 단추 지시문에 [마케팅 규칙](채널 설계 기준 · 내 채널 다음 편 · 후보 번호 · 미래AI랩 일 · 상투어 금지) — 다른 화면엔 없음',
    RADAR_RULES.every((r: string) => radarSys.includes(r)) && !assistSystem(ASSISTS['today.top3']).includes('[마케팅 규칙]') && radarSys.includes('채널 설계 기준') && radarSys.includes('N분 컷'))
  check('S2 [대본 끝까지 쓰기] — 서버 · 화면 단추 같은 이름 · 글쓰기 · 레이더 · 구간별 대사 · 공식 자료 확인 칸',
    ASSISTS['radar.script']?.page === 'radar' && ASSISTS['radar.script']?.kind === 'write' && ASSIST_PRESETS.some((p) => p.id === 'radar.script' && p.label === ASSISTS['radar.script'].label && p.kind === 'write') && ASSISTS['radar.script'].instruction.join(' ').includes('[공식 자료 확인'))
  check('S3 공통 규칙 — 모르는 칸은 비워 둠("자료에 없음" 으로 채우지 않음) · 없는 번호를 만들지 않음', ASSIST_RULES.some((r: string) => r.includes('빈 글로 둔다')) && ASSIST_RULES.some((r: string) => r.includes('없는 번호를 만들지 않고')) && !ASSIST_RULES.some((r: string) => r.includes('모르면 "자료에 없음"')))
  check('S4 TOP5 기획 — 후보 번호를 ref 로 · next 는 비움(화면에 담기 · 대본 단추)', ASSISTS['radar.top5'].instruction.join(' ').includes('ref = 고른 후보 번호') && ASSISTS['radar.top5'].instruction.join(' ').includes('next 는 비워'))

  // 레이더 자료 — 채널 설계 기준 · 내 채널 · 후보 번호 · 찍기 키트
  const NOW = Date.parse('2026-10-19T00:00:00Z')
  const prep = prepareFeed(sampleFeed(NOW), NOW)
  const vids = radarVideos(prep, { now: NOW })
  const plan = radarPlan(prep, { now: NOW }, vids)
  const mine = vids.filter((v) => v.mine)
  const brief = { ...DEFAULT_BRIEF, avoid: '연예 · 코인 · 주식 종목 추천은 다루지 않는다' }
  const idea = normalizeIdea({ ...ideaFromOpportunity(plan.picks[0]), savedAt: '2026-10-18T00:00:00Z', status: 'selected', memo: '화요일 촬영', script: '0:00 오프닝 …' }, 'idea_1') as ContentIdea
  const rb = radarBundle({ today: T, view: 'plan', plan, rising: [], breakouts: [], videos: vids, ideas: [idea], mine, brief })
  const sec = (n: string) => rb.context.sections.find((x) => x.name.startsWith(n))
  check('R1 레이더 자료 맨 앞 — 채널 설계 기준(대표가 고친 값 그대로 · 8칸)', rb.context.sections[0].name.startsWith('채널 설계 기준') && rb.context.sections[0].rows.length === 8 && JSON.stringify(rb.context.sections[0]).includes('코인'), rb.context.sections[0].rows.length)
  check('R2 내 채널 최근 영상 · 내 채널 숫자 한 줄(facts)', !!sec('내 채널 최근 영상') && (sec('내 채널 최근 영상')?.rows.length ?? 0) === Math.min(20, mine.length) && (rb.context.facts ?? []).some((f) => f.startsWith('내 채널')), { mine: mine.length })
  const cand = sec('이번 주 찍을 후보')
  check('R3 후보 — o1… 번호 · 주소 없음(같은 화면) · ids 로 후보 키 · 찍기 키트(첫 문장 · 구성 · 쇼츠 3컷)',
    !!cand && cand.rows[0].ref === 'o1' && !('o1' in rb.links) && rb.ids?.o1 === plan.picks[0].key && 'Hook' !== '' && typeof cand.rows[0].첫문장_규칙 === 'string' && Array.isArray(cand.rows[0].구성_규칙) && Array.isArray(cand.rows[0].쇼츠3컷_규칙),
    cand?.rows[0])
  const mineSec = sec('내 콘텐츠')
  check('R4 내 콘텐츠 줄 — i1 → /marketing?view=make&idea=번호(그 줄이 펼쳐짐) · 대본 있음 표시', !!mineSec && rb.links.i1 === '/marketing?view=make&idea=idea_1' && rb.ids?.i1 === 'idea_1' && String(mineSec.rows[0].대본).startsWith('있음'), mineSec?.rows[0])
  const rb0 = radarBundle({ today: T, view: 'plan', plan, rising: [], breakouts: [], videos: vids, ideas: [], mine: [], brief: null })
  check('R5 기준을 안 고쳤으면 기본값(김팀장의 경영노트) · 내 채널 영상 없으면 그렇다고 한 줄', JSON.stringify(rb0.context.sections[0]).includes('김팀장의 경영노트') && (rb0.context.facts ?? []).some((f) => f.includes('아직 없다')))

  // AI 기획 → 내 콘텐츠
  const opp = plan.picks[0]
  const item = { title: '정책자금 거절된 회사의 공통점 3가지', tag: '롱폼', detail: '상담에서 본 실수', outline: ['0:00 오프닝', '1:00 사례'], body: '대표님, 정책자금이 거절되는 회사에는 공통점이 있습니다.' }
  const fresh = aiPlanInput(item, opp, [], '10/19')
  check('P1 새 기획(후보에서) — 그 후보 키로 · 제작 예정 · 제목 후보 맨 앞 · 첫 문장 · 메모에 [AI 기획] 구성',
    !fresh.existed && fresh.input.key === opp.key && fresh.input.status === 'selected' && fresh.input.titleCandidates[0] === item.title && fresh.input.hook.startsWith('대표님') && (fresh.input.memo ?? '').startsWith('[AI 기획 10/19] 롱폼') && (fresh.input.memo ?? '').includes('- 1:00 사례'), fresh.input)
  const merged = aiPlanInput(item, opp, [idea], '10/19')
  check('P2 같은 후보가 이미 있으면 그 줄에 합침 — 새 줄 안 생김 · 옛 메모 남김 · 첫 문장은 있던 것 그대로',
    merged.existed && merged.input.id === 'idea_1' && (merged.input.memo ?? '').includes('화요일 촬영') && (merged.input.memo ?? '').startsWith('[AI 기획') && merged.input.titleCandidates[0] === item.title && merged.input.status === 'selected', merged.input)
  const scripted = { ...idea, status: 'script' as const }
  check('P3 이미 대본 준비 · 촬영 · 게시면 단계를 되돌리지 않음', aiPlanInput(item, opp, [scripted], '10/19').input.status === 'script')
  const other = normalizeIdea({ ...ideaFromOpportunity(plan.picks[1] ?? opp), key: 'custom:x', topic: '다른 줄', savedAt: '2026-10-18T00:00:00Z', status: 'idea', memo: '' }, 'idea_2') as ContentIdea
  check('P4 답이 내 콘텐츠 줄(i#)을 가리키면 그 줄에(targetId)', aiPlanInput(item, null, [idea, other], '10/19', 'idea_2').input.id === 'idea_2')
  const custom = aiPlanInput({ title: '직접 기획' }, null, [], '10/19')
  check('P5 후보 없는 기획 — 직접 담음 줄 · 제작 예정', !custom.existed && custom.input.source === 'custom' && custom.input.topic === '직접 기획' && custom.input.status === 'selected')

  // 채널 설계 기준 · 대본 칸 저장 모양
  const nb = normalizeBrief({ tone: '  짧게  ', avoid: 'x'.repeat(500) })
  check('B1 채널 설계 기준 — 빈 것은 null(기본값 씀) · 일부만 고치면 나머지는 기본값 · 300자 안', normalizeBrief({}) === null && normalizeBrief(null) === null && nb?.tone === '짧게' && nb?.channel === DEFAULT_BRIEF.channel && nb?.avoid.length === 300, nb)
  const big = normalizeIdea({ ...ideaFromOpportunity(opp), savedAt: '2026-10-18T00:00:00Z', script: '가'.repeat(SCRIPT_MAX + 50) }, 'idea_3') as ContentIdea
  check('B2 내 콘텐츠 대본 칸 — 저장 · 2만 자에서 자름 · 예전 줄은 빈 대본', big.script.length === SCRIPT_MAX && (normalizeIdea({ ...ideaFromOpportunity(opp), savedAt: '2026-10-18T00:00:00Z' }, 'idea_4') as ContentIdea).script === '')
}

await serverTests()
bundleTests()
d241Tests()
console.log(`\naiAssist: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
