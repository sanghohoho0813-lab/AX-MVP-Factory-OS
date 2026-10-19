/**
 * 대표 AI 작업실 V1 시험 — 서버 함수(api/ai-run) · 스킬 서재 · 화면 엔진(업체 · 기억 · 맥락 · 결과 · 제안서 · 화면 기획 · 사용량 · Partner 다리).
 *
 * 서버 함수는 진짜 코드를 부르고, 밖으로 나가는 것(Supabase 로그인 · 권한 RPC · AI 공급자)만 가짜 fetch 로 바꾼다.
 * 화면 흐름(runSkill)도 진짜 코드 → '/api/ai-run' → 서버 함수 → 가짜 공급자로 끝까지 이어 본다.
 */
import handler, { __resetAiRunState } from '../../../api/ai-run.js'
import { SKILLS, COMMON_RULES } from '../../../api/_ai/skills.js'
import { aiConfig, buildPrompt, extractJson, scrubDeep, validate } from '../../../api/_ai/core.js'
import { SKILL_META, QUICK_ACTIONS } from '../ownerAi/skillCatalog'
import { emptyCase, findDuplicates, makeMaterial, sameMaterial, normalizeCompany, newUuid, caseClash, findCaseForClient } from '../ownerAi/caseUtil'
import { buildAiContext, caseSnapshot, UNKNOWN } from '../ownerAi/context'
import { renderStructured, revisedText, runSummary, PATENT_WARNING, fundingBasis } from '../ownerAi/render'
import { proposeFromRun, contextDiff, applyContext } from '../ownerAi/memory'
import { ownerAiRepo, OwnerAiDuplicateError } from '../ownerAi/repo'
import { runSkill, evaluate, saveContext, saveRevision, pasteChatGpt, latestSnapshot, patchCase, type CaseBundle } from '../ownerAi/workflow'
import { monthUsage } from '../ownerAi/usage'
import { parsePartnerHandoff } from '../ownerAi/partnerBridge'
import { proposalFrom, qaProposal, roughMeasure, layoutPage, applyFix, proofreadInput } from '../ownerAi/proposal'
import { frontFrom } from '../ownerAi/front'
import { emptyContext, type AiRun, type SkillId } from '../ownerAi/types'
import { normalizeClientOps } from '../clientOpsService'
import type { ClientOpsRecord } from '../../types/clientOps'

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
/* 가짜 바깥(Supabase · AI 공급자)                                       */
/* ------------------------------------------------------------------ */

const KEY = 'sk-test-OWNERAI-secret-123456'
const OWNER = 'Bearer owner-token-aaaaaaaaaaaaaaaaaaaa'
const PILOT = 'Bearer pilot-token-bbbbbbbbbbbbbbbbbbbb'
const NODB = 'Bearer nodb-token-cccccccccccccccccccc'

type Reply = { status: number; body: unknown }
let llmCalls: { model: string; body: Record<string, unknown> }[] = []
let llmReply: (body: Record<string, unknown>) => Reply = () => ({ status: 200, body: {} })
let llmDelay = 0

const realFetch = globalThis.fetch
globalThis.fetch = (async (input: unknown, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
  const url = String(input)
  const headers = init?.headers ?? {}
  if (url.startsWith('https://qa.supabase.test/auth/v1/user')) {
    const a = headers.Authorization
    if (a === OWNER) return new Response(JSON.stringify({ id: 'owner-1' }), { status: 200 })
    if (a === PILOT) return new Response(JSON.stringify({ id: 'pilot-1' }), { status: 200 })
    if (a === NODB) return new Response(JSON.stringify({ id: 'nodb-1' }), { status: 200 })
    return new Response('{}', { status: 401 })
  }
  if (url.startsWith('https://qa.supabase.test/rest/v1/rpc/has_capability')) {
    const a = headers.Authorization
    if (a === NODB) return new Response(JSON.stringify({ code: 'PGRST202' }), { status: 404 })
    return new Response(JSON.stringify(a === OWNER), { status: 200 })
  }
  if (url.startsWith('https://api.openai.test/v1/chat/completions')) {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
    llmCalls.push({ model: String(body.model), body })
    if (headers.Authorization !== `Bearer ${KEY}`) return new Response('{"error":"bad key"}', { status: 401 })
    if (llmDelay) await new Promise((r) => setTimeout(r, llmDelay))
    const r = llmReply(body)
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), { status: r.status })
  }
  if (url.startsWith('/api/ai-run')) {
    // 화면 흐름 시험: 브라우저 → 서버 함수(같은 프로세스)
    const res = mkRes()
    await handler({ method: init?.method ?? 'GET', url, headers: { authorization: OWNER, ...(init?.headers ?? {}) }, body: init?.body }, res)
    return new Response(res.raw, { status: res.statusCode, headers: { 'content-type': res.headers['content-type'] ?? 'application/json' } })
  }
  return realFetch(input as RequestInfo, init as RequestInit)
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

const ENV_BASE: Record<string, string> = {
  SUPABASE_URL: 'https://qa.supabase.test',
  SUPABASE_ANON_KEY: 'qa-anon-key',
  OPENAI_API_KEY: KEY,
  AI_BASE_URL: 'https://api.openai.test/v1',
  AI_MODEL_CHEAP: 'm-cheap',
  AI_MODEL_STANDARD: 'm-standard',
  AI_MODEL_DEEP: 'm-deep',
}
function setEnv(over: Record<string, string | undefined> = {}) {
  for (const k of Object.keys(process.env)) if (/^(AI_|OPENAI_|SUPABASE_|VITE_OPENAI)/.test(k)) delete process.env[k]
  for (const [k, v] of Object.entries({ ...ENV_BASE, ...over })) if (v !== undefined) process.env[k] = v
  __resetAiRunState()
}

async function post(body: Record<string, unknown>, auth = OWNER) {
  const res = mkRes()
  await handler({ method: 'POST', url: '/api/ai-run', headers: auth ? { authorization: auth } : {}, body: JSON.stringify(body) }, res)
  return res
}

const okReply = (skill: SkillId) => (): Reply => ({ status: 200, body: { model: 'm-served', choices: [{ message: { content: JSON.stringify(SKILLS[skill].example) }, finish_reason: 'stop' }], usage: { prompt_tokens: 1200, completion_tokens: 300 } } })
const reqId = () => newUuid()
const CASE = 'case_qa_test_01'

/* ------------------------------------------------------------------ */
/* 스킬 서재                                                             */
/* ------------------------------------------------------------------ */

{
  const server = Object.values(SKILLS) as { id: string; version: number; tier: string; active: boolean; systemInstruction: string[]; outputSchema: unknown; example: unknown; createdAt: string; updatedAt: string; name: string; description: string }[]
  const same = server.length === Object.keys(SKILL_META).length && server.every((s) => {
    const m = SKILL_META[s.id as SkillId]
    return m && m.version === s.version && m.tier === s.tier && m.name === s.name
  })
  check('S1 스킬 서재 — 화면 목록과 서버 스킬이 같은 id · 판 · 단계 · 이름(13개)', same && server.length === 13, server.map((s) => `${s.id}:${s.version}:${s.tier}`))
  check('S2 스킬 메타데이터 — id · name · version · description · systemInstruction(줄 배열) · outputSchema · active · createdAt · updatedAt', server.every((s) => s.id && s.name && s.version >= 1 && s.description && Array.isArray(s.systemInstruction) && s.systemInstruction.length >= 2 && s.outputSchema && typeof s.active === 'boolean' && /^\d{4}-\d{2}-\d{2}$/.test(s.createdAt) && s.updatedAt))
  check('S3 예시 JSON 이 출력 형식 검사를 통과(모델이 따라 쓸 틀이 틀리지 않음)', server.every((s) => validate(s.outputSchema, s.example).ok), server.filter((s) => !validate(s.outputSchema, s.example).ok).map((s) => [s.id, validate(s.outputSchema, s.example).errors]))
  const p = SKILLS.AX_PENGUIN.systemInstruction.join('\n')
  const steps = ['회사가 실제로 돈을 벌고 있는 방식', '사람이 반복해서 하는 업무', '현재 데이터가 존재하는 위치', '비효율 · 병목', 'AI 가 실제로 개입할 수 있는 지점', '도입 난이도', 'MVP 가능 범위', '사업성', '실제 사용할 가능성', '정책기관에서 설명하기 좋은', '벤처 · 특허 · 정책자금으로 이어질', '과도한 AI 포장 여부']
  check('S4 AX_PENGUIN — 12단계 순서 그대로', steps.every((s, i) => p.indexOf(s) >= 0 && (i === 0 || p.indexOf(s) > p.indexOf(steps[i - 1]))), steps.filter((s) => p.indexOf(s) < 0))
  check('S5 특허 — 경고 문구 그대로(예시 · 지시)', SKILLS.PATENT_IDEA.example.warning === PATENT_WARNING && SKILLS.PATENT_IDEA.systemInstruction.join('').includes(PATENT_WARNING))
  check('S6 공통 규칙 — 숫자 지어내지 않음 · 미확인 · JSON 만', COMMON_RULES.join('\n').includes('근거 없는 숫자') && COMMON_RULES.join('\n').includes('미확인') && COMMON_RULES.join('\n').includes('JSON'))
  check('S7 빠른 작업 10가지 = 대표 지시 순서', QUICK_ACTIONS.map((q) => q.label).join('|') === 'AX 전략 분석|AX 아이템 발굴|MVP 구체화|특허 아이디어|벤처 사업계획|정책자금 · 지원 전략|제안서 구성|AX 화면 기획|동료 전달문구|자유 AI 작업')
  check('S8 단계 — 깊게: AX 전략 · 특허 · 벤처 · 자금 / 빠르게: 동료 문구 · 기억 정리 · 맞춤법 · 자료 요약', ['AX_PENGUIN', 'PATENT_IDEA', 'VENTURE_PLAN', 'FUNDING_STRATEGY'].every((s) => SKILL_META[s as SkillId].tier === 'deep') && ['CONSULTANT_MESSAGE', 'CONTEXT_UPDATE', 'PROOFREAD', 'SNAPSHOT_EXTRACT'].every((s) => SKILL_META[s as SkillId].tier === 'cheap'))
}

/* ------------------------------------------------------------------ */
/* 서버 함수                                                             */
/* ------------------------------------------------------------------ */

async function serverTests() {
  // 키 없음
  setEnv({ OPENAI_API_KEY: undefined })
  {
    const st = mkRes()
    await handler({ method: 'GET', url: '/api/ai-run?status=1', headers: { authorization: OWNER } }, st)
    check('A1 키 없음 — 상태: 설정 안 됨 · 빠진 이름만(값 없음)', st.statusCode === 200 && st.body.configured === false && (st.body.missing as string[]).some((m) => m.includes('OPENAI_API_KEY')) && !st.raw.includes('m-deep'), st.body)
    const r = await post({ requestId: reqId(), skillId: 'CONSULTANT_MESSAGE', caseId: CASE, input: {}, context: {} })
    check('A2 키 없음 — 실행: 503 "AI 기능 설정이 필요합니다." · 공급자 안 부름', r.statusCode === 503 && r.body.code === 'setup_needed' && r.body.message === 'AI 기능 설정이 필요합니다.' && llmCalls.length === 0, r.body)
  }
  // VITE_ 이름의 키는 읽지 않는다(번들에 들어가는 이름)
  setEnv({ OPENAI_API_KEY: undefined, VITE_OPENAI_API_KEY: KEY })
  {
    const r = await post({ requestId: reqId(), skillId: 'CONSULTANT_MESSAGE', caseId: CASE, input: {}, context: {} })
    check('A3 VITE_OPENAI_API_KEY 는 읽지 않음 — 설정 필요 그대로', r.statusCode === 503 && r.body.code === 'setup_needed' && aiConfig().key === '')
  }
  setEnv()
  {
    const r1 = await post({ requestId: reqId(), skillId: 'CONSULTANT_MESSAGE', caseId: CASE, input: {}, context: {} }, '')
    const r2 = await post({ requestId: reqId(), skillId: 'CONSULTANT_MESSAGE', caseId: CASE, input: {}, context: {} }, 'Bearer short')
    check('A4 로그인 없음 · 이상한 토큰 — 401', r1.statusCode === 401 && r2.statusCode === 401 && r1.body.code === 'login_required')
    const r3 = await post({ requestId: reqId(), skillId: 'CONSULTANT_MESSAGE', caseId: CASE, input: {}, context: {} }, PILOT)
    check('A5 팀장(권한 없음) — 403 · 공급자 안 부름(직접 불러도 막힘)', r3.statusCode === 403 && r3.body.code === 'forbidden' && llmCalls.length === 0, r3.body)
    const st = mkRes()
    await handler({ method: 'GET', url: '/api/ai-run?status=1', headers: { authorization: PILOT } }, st)
    check('A6 팀장 — 설정 상태도 못 봄(403)', st.statusCode === 403)
    const r4 = await post({ requestId: reqId(), skillId: 'CONSULTANT_MESSAGE', caseId: CASE, input: {}, context: {} }, NODB)
    check('A7 DB 0021 전(권한 함수 없음) — 403 db_setup_needed', r4.statusCode === 403 && r4.body.code === 'db_setup_needed', r4.body)
  }
  setEnv({ SUPABASE_URL: undefined, SUPABASE_ANON_KEY: undefined })
  {
    const r = await post({ requestId: reqId(), skillId: 'CONSULTANT_MESSAGE', caseId: CASE, input: {}, context: {} })
    check('A8 Supabase 설정 없음 — 503 setup_needed(권한을 확인할 수 없으면 열지 않음)', r.statusCode === 503 && r.body.code === 'setup_needed')
  }

  // 빠르게(cheap) — 동료 문구
  setEnv()
  llmCalls = []
  llmReply = okReply('CONSULTANT_MESSAGE')
  {
    const r = await post({ requestId: reqId(), skillId: 'CONSULTANT_MESSAGE', caseId: CASE, contextVersion: 2, input: { options: { length: '300' } }, context: { company: { name: '한빛정밀(주)', fields: [] } } })
    const run = r.body.run as Record<string, unknown>
    check('B1 빠르게 — AI_MODEL_CHEAP 로 · JSON 응답 요청 · 결과 구조 · 토큰', r.statusCode === 200 && llmCalls.length === 1 && llmCalls[0].model === 'm-cheap' && (llmCalls[0].body.response_format as { type: string }).type === 'json_object' && run.status === 'succeeded' && (run.usage as { input: number }).input === 1200 && run.tier === 'cheap' && run.contextVersion === 2, r.body)
    check('B2 응답에 키 · 공급자 주소 없음 · 모델은 실제로 쓴 이름', !r.raw.includes(KEY) && !r.raw.includes('api.openai') && run.model === 'm-served')
    check('B3 가격을 정하지 않았으면 비용 null(지어내지 않음)', run.estimatedCostUsd === null)
  }
  setEnv({ AI_PRICE_DEEP: '2.5,10' })
  llmCalls = []
  llmReply = okReply('AX_PENGUIN')
  {
    const r = await post({ requestId: reqId(), skillId: 'AX_PENGUIN', caseId: CASE, input: { task: '영업 업무 먼저' }, context: { company: { name: '한빛정밀(주)', fields: [{ label: '업종', value: '정밀기계' }] } } })
    const run = r.body.run as Record<string, unknown>
    const sys = String(((llmCalls[0]?.body.messages as { content: string }[]) ?? [])[0]?.content ?? '')
    check('B4 깊게 — AX 전략은 AI_MODEL_DEEP · 출력 한도 깊게 · 12단계 지시가 붙음', llmCalls[0]?.model === 'm-deep' && llmCalls[0].body.max_completion_tokens === 12000 && sys.includes('12. 과도한 AI 포장 여부') && run.skillVersion === 1, llmCalls[0]?.body.max_completion_tokens)
    check('B5 가격을 정했으면 비용 계산(USD · 1200×2.5 + 300×10 / 100만)', Math.abs(Number(run.estimatedCostUsd) - (1200 * 2.5 + 300 * 10) / 1e6) < 1e-9, run.estimatedCostUsd)
  }

  // 개인정보 · 비밀 — 보내기 전에 지움
  setEnv()
  llmCalls = []
  llmReply = okReply('FREE_CHAT')
  {
    await post({
      requestId: reqId(),
      skillId: 'FREE_CHAT',
      caseId: CASE,
      input: { task: '대표 주민번호 900101-1234567 확인하고 비밀번호: hunter2 로 로그인' },
      context: { company: { name: 'X', fields: [] }, materials: [{ title: '메모', kind: 'memo', text: `키 ${KEY} 계좌번호 110-123-456789 연락 010-1234-5678 공동인증서 비밀번호 abc!23` }] },
    })
    const sent = JSON.stringify(llmCalls[0]?.body ?? {})
    check('C1 보내는 글에 주민번호 · 비밀번호 · 키 · 계좌 · 휴대폰 · 인증서 비밀번호 없음', !/900101-1234567|hunter2|sk-test-OWNERAI|110-123-456789|010-1234-5678|abc!23/.test(sent) && sent.includes('[가림:주민번호]'), sent.slice(0, 600))
  }

  // 중복 클릭 — 같은 요청 번호는 한 번만 부른다
  setEnv()
  llmCalls = []
  llmReply = okReply('AX_IDEA')
  llmDelay = 60
  {
    const id = reqId()
    const body = { requestId: id, skillId: 'AX_IDEA', caseId: CASE, input: {}, context: {} }
    const [a, b] = await Promise.all([post(body), post(body)])
    const c = await post(body)
    check('D1 두 번 · 세 번 눌러도 공급자 1번 · 같은 결과(과금 한 번)', llmCalls.length === 1 && a.statusCode === 200 && b.statusCode === 200 && c.statusCode === 200 && (a.body.run as { requestId: string }).requestId === id && JSON.stringify(a.body.run) === JSON.stringify(c.body.run) && (b.body.replayed === true || a.body.replayed === true) && c.body.replayed === true, { calls: llmCalls.length })
    const d = await post({ ...body, skillId: 'AX_MVP' })
    check('D2 같은 요청 번호로 다른 작업 — 409', d.statusCode === 409 && d.body.code === 'request_conflict')
  }
  llmDelay = 0

  // 형식 실패 → 원문 보관
  setEnv()
  llmCalls = []
  llmReply = () => ({ status: 200, body: { choices: [{ message: { content: '죄송하지만 JSON 이 아닌 글입니다. 추천: 견적 자동화' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5 } } })
  {
    const r = await post({ requestId: reqId(), skillId: 'AX_PENGUIN', caseId: CASE, input: {}, context: {} })
    const run = r.body.run as Record<string, unknown>
    check('E1 형식 실패 — 200 · parse_fallback · 원문 보관 · 구조 null(앱이 깨지지 않음)', r.statusCode === 200 && run.status === 'parse_fallback' && run.structured === null && String(run.raw).includes('견적 자동화'), run)
  }
  llmReply = () => ({ status: 200, body: { choices: [{ message: { content: '```json\n' + JSON.stringify({ oneLine: 'x' }) + '\n```' } }], usage: {} } })
  {
    const r = await post({ requestId: reqId(), skillId: 'AX_PENGUIN', caseId: CASE, input: {}, context: {} })
    check('E2 필요한 칸이 빠지면(추천 · 차선 없음) parse_fallback', (r.body.run as { status: string }).status === 'parse_fallback' && ((r.body.run as { parseErrors: string[] }).parseErrors ?? []).some((e) => e.includes('recommended')))
  }

  // 공급자 오류
  setEnv()
  llmCalls = []
  llmReply = () => ({ status: 500, body: '{"error":{"message":"internal secret trace sk-live-xyz"}}' })
  {
    const id = reqId()
    const r = await post({ requestId: id, skillId: 'AX_IDEA', caseId: CASE, input: {}, context: {} })
    check('F1 공급자 500 — 502 · 사람 말 · 원문 · 비밀 없음', r.statusCode === 502 && r.body.code === 'provider_error' && !r.raw.includes('secret trace') && !r.raw.includes('sk-live'), r.raw)
    llmReply = okReply('AX_IDEA')
    const again = await post({ requestId: id, skillId: 'AX_IDEA', caseId: CASE, input: {}, context: {} })
    check('F2 실패한 뒤 같은 번호로 다시 시도 — 이번엔 부름(재시도 가능)', again.statusCode === 200 && llmCalls.length === 2)
  }
  setEnv({ OPENAI_API_KEY: 'sk-wrong-key-zzzzzzzzzz' })
  {
    const r = await post({ requestId: reqId(), skillId: 'AX_IDEA', caseId: CASE, input: {}, context: {} })
    check('F3 공급자 401(키 틀림) — 503 provider_auth · 키 글자 없음', r.statusCode === 503 && r.body.code === 'provider_auth' && !r.raw.includes('sk-wrong'))
  }
  setEnv({ AI_RATE_PER_MIN: '2' })
  llmReply = okReply('CONSULTANT_MESSAGE')
  {
    const a = await post({ requestId: reqId(), skillId: 'CONSULTANT_MESSAGE', caseId: CASE, input: {}, context: {} })
    const b = await post({ requestId: reqId(), skillId: 'CONSULTANT_MESSAGE', caseId: CASE, input: {}, context: {} })
    const c = await post({ requestId: reqId(), skillId: 'CONSULTANT_MESSAGE', caseId: CASE, input: {}, context: {} })
    check('F4 속도 제한 — 1분에 2번 뒤 429 · Retry-After', a.statusCode === 200 && b.statusCode === 200 && c.statusCode === 429 && c.headers['retry-after'] === '60' && c.body.code === 'rate_limited')
  }
  setEnv()
  {
    const big = await post({ requestId: reqId(), skillId: 'AX_IDEA', caseId: CASE, input: {}, context: { materials: [{ title: 'x', kind: 'memo', text: '가'.repeat(300_000) }] } })
    check('F5 너무 큰 요청 — 413', big.statusCode === 413 && big.body.code === 'too_large')
    const bad = await post({ requestId: 'x', skillId: 'NOPE', caseId: 'bad', input: {}, context: {} })
    check('F6 이상한 요청(스킬 · 번호 · Case) — 400', bad.statusCode === 400)
    const get = mkRes()
    await handler({ method: 'GET', url: '/api/ai-run', headers: { authorization: OWNER } }, get)
    check('F7 GET(상태 아님) — 405', get.statusCode === 405)
  }

  // 프롬프트 — 예산 안 · 자료부터 줄임
  {
    const mats = Array.from({ length: 8 }, (_, i) => ({ title: `자료${i}`, kind: 'intro', text: '회사 소개 '.repeat(2000) }))
    const p = buildPrompt(SKILLS.CONSULTANT_MESSAGE, { company: { name: 'X', fields: [] }, materials: mats }, { task: 't' }, 'cheap', COMMON_RULES)
    const d = buildPrompt(SKILLS.AX_PENGUIN, { company: { name: 'X', fields: [] }, materials: mats }, { task: 't' }, 'deep', COMMON_RULES)
    check('G1 프롬프트 예산 — 빠르게 9천자 · 깊게 3만자 안(자료를 줄여서)', p.user.length <= 9500 && d.user.length <= 31000 && d.user.length > p.user.length, [p.user.length, d.user.length])
    check('G2 JSON 꺼내기 — 코드블록 · 앞뒤 말', extractJson('여기\n```json\n{"a":1}\n```')?.a === 1 && extractJson('결과: {"b":2} 끝')?.b === 2 && extractJson('없음') === null)
    check('G3 서버 정리 — 깊은 묶음 안의 주민번호까지', JSON.stringify(scrubDeep({ a: [{ b: '800101-2345678' }] })).includes('[가림:주민번호]'))
  }
}

/* ------------------------------------------------------------------ */
/* 화면 엔진                                                             */
/* ------------------------------------------------------------------ */

const TODAY = '2026-10-14'

async function engineTests() {
  const at = '2026-10-14T09:00:00.000Z'
  const c1 = { ...emptyCase({ companyName: '(주)한빛정밀', at }), bizNo: '1234567890', homepageUrl: 'https://www.hanbit.co.kr' }
  const client = normalizeClientOps({ id: 'cli_hb', companyName: '한빛정밀 주식회사', businessNumber: '123-45-67890', representativeName: '김한빛', establishedAt: '2019-03-02', employeeCount: '12', industry: '정밀기계', businessAddress: '경기도 화성시 1', createdAt: at, updatedAt: at } as unknown as Partial<ClientOpsRecord>)
  {
    const d1 = findDuplicates({ name: '한빛정밀', bizNo: '123-45-67890' }, [c1], [client])
    check('H1 중복 업체 — 사업자번호 같음(Case · 고객 둘 다) · 강함', d1.length === 2 && d1.every((d) => d.strong && d.reason.includes('사업자번호')), d1)
    const d2 = findDuplicates({ name: '한빛', url: 'hanbit.co.kr/about' }, [c1], [])
    check('H2 중복 업체 — 홈페이지 같음(www · 경로 달라도)', d2.length === 1 && d2[0].reason.includes('홈페이지'), d2)
    check('H3 회사 이름 맞추기 — (주) · 주식회사 · 띄어쓰기', normalizeCompany('(주)한빛 정밀') === normalizeCompany('한빛정밀 주식회사'))
    check('H4 다른 회사는 중복 아님', findDuplicates({ name: '대성산업' }, [c1], [client]).length === 0)
    // D-219: 네이버 블로그 · 스마트스토어처럼 여러 회사가 나눠 쓰는 주소는 첫 칸까지 같아야 같은 회사
    const blogCase = { ...c1, id: 'blog1', companyName: '그린로직스', bizNo: '', homepageUrl: 'https://blog.naver.com/greenlogis' }
    check('D-219 중복 업체 — 같은 블로그 주소(blog.naver.com)여도 블로그 이름이 다르면 다른 회사', findDuplicates({ name: '한빛식품', url: 'blog.naver.com/hanbitfood' }, [blogCase], []).length === 0, findDuplicates({ name: '한빛식품', url: 'blog.naver.com/hanbitfood' }, [blogCase], []))
    check('D-219 중복 업체 — 같은 블로그(m. 주소 · 대소문자 달라도)는 홈페이지 같음', findDuplicates({ name: '그린', url: 'https://m.blog.naver.com/GreenLogis' }, [blogCase], []).some((d) => d.reason.includes('홈페이지')))
  }
  {
    const m = makeMaterial({ kind: 'memo', title: '메모', text: '대표 900101-1234567 비밀번호: qwer1234 매출 50억' }, at)
    check('I1 자료 저장 전 — 주민번호 · 비밀번호 지움(원문 저장 안 함) · 다른 내용은 그대로', !m.text.includes('900101-1234567') && !m.text.includes('qwer1234') && m.text.includes('매출 50억'), m.text)
    const titled = makeMaterial({ kind: 'memo', title: '대표 김○○(900101-1234567) 공동인증서 비밀번호 abc!23', text: '배차가 힘듦' }, at)
    check('I1b 제목도 저장 전에 지움(메모 첫 줄을 제목으로 쓸 때)', !titled.title.includes('1234567') && !titled.title.includes('abc!23') && titled.title.includes('대표'), titled.title)
    const roster = makeMaterial({ kind: 'other', title: '4대보험 사업장 가입자 명부.pdf', text: '피보험자 취득일 상실일 자격취득', fileName: '4대보험 사업장 가입자 명부.pdf' }, at)
    check('I2 4대보험 명부 — AI 에 보내지 않음 표시', !!roster.excluded)
    check('I3 같은 자료 — 글 지문으로 찾음', !!sameMaterial([m], makeMaterial({ kind: 'paste', title: '다른 이름', text: m.text }, at)))
  }
  {
    const snapEmpty = caseSnapshot(emptyCase({ companyName: '빈회사', at }), null, null, [], TODAY)
    const unknown = snapEmpty.filter((f) => !['name', 'relation'].includes(f.key))
    check('J1 Snapshot — 모르는 값은 모두 "미확인"(추측 안 함)', unknown.length === 11 && unknown.every((f) => f.value === UNKNOWN && !f.known), unknown.map((f) => `${f.label}:${f.value}`))
    const snap = caseSnapshot({ ...c1, clientId: client.id }, client, null, [], TODAY)
    const v = (k: string) => snap.find((f) => f.key === k)?.value
    check('J2 Snapshot — 이어 둔 고객 기록에서 업종 · 업력 · 대표자 · 직원수 · 출처', v('industry') === '정밀기계' && (v('years') ?? '').startsWith('7년') && v('ceo') === '김한빛' && v('employees') === '12명' && snap.find((f) => f.key === 'industry')?.source === '고객 관리', snap)
  }
  const adoptedRun: AiRun = {
    id: newUuid(), caseId: c1.id, skillId: 'AX_PENGUIN', skillVersion: 1, input: {}, structured: SKILLS.AX_PENGUIN.example, rendered: '', contextSnapshotId: null, contextVersion: 1, provider: 'openai', model: 'm', tier: 'deep', status: 'succeeded', evaluation: 'adopted', evaluationNote: '', adoptedPart: null, evaluatedAt: at, usage: { input: 1, output: 1, total: 2 }, estimatedCostUsd: null, requestId: newUuid(), createdBy: null, createdAt: at,
  }
  {
    const mats = [makeMaterial({ kind: 'intro', title: '회사소개서', text: '우리는 정밀 부품을 만듭니다. 문의 010-9999-8888' }, at), makeMaterial({ kind: 'other', title: '4대보험 명부', text: '피보험자 취득일 상실일 자격취득', fileName: '명부.xlsx' }, at)]
    const cc = { ...c1, clientId: client.id, requester: '박동료 팀장', materials: mats }
    const ctx = buildAiContext({ skill: 'AX_PENGUIN', c: cc, client, memory: { version: 3, content: { ...emptyContext(), axDirection: '견적 자동화' } }, runs: [adoptedRun], revisions: new Map(), today: TODAY })
    const s = JSON.stringify(ctx)
    check('K1 AI 묶음 — 대표자 이름 · 요청자 · 휴대폰 빼고 · 명부 빼고 · 소개서는 넣음', !s.includes('김한빛') && !s.includes('박동료') && !s.includes('010-9999-8888') && !s.includes('피보험자') && s.includes('정밀 부품') && ctx.materials.length === 1, s.slice(0, 500))
    check('K2 AI 묶음 — 기억 v3 · 채택한 결과 요약 · 업종 · 지역', ctx.memory.version === 3 && ctx.memory.fields.some((f) => f.value === '견적 자동화') && ctx.adopted.length === 1 && ctx.company.fields.some((f) => f.label === '업종') && ctx.company.fields.some((f) => f.label === '지역' && f.value === '경기'))
    const msg = buildAiContext({ skill: 'CONSULTANT_MESSAGE', c: cc, client, memory: null, runs: [adoptedRun], revisions: new Map(), today: TODAY })
    check('K3 동료 문구(빠르게) — 자료는 보내지 않고 채택한 결과만(토큰 아끼기)', msg.materials.length === 0 && msg.adopted.length === 1)
  }
  {
    const md = renderStructured('AX_PENGUIN', SKILLS.AX_PENGUIN.example)
    check('L1 결과 글 — AX 전략: 가장 추천 · 차선 · 12단계', md.includes('가장 추천') && md.includes('차선 1') && md.includes('12단계'))
    // D-219: 결과 글에 영어 칸 이름이 보이지 않게 · 스튜디오에서 고친 판도 글로
    const ctxMd = renderStructured('CONTEXT_UPDATE', { proposed: { oneLine: '수도권 물류', problems: '배차가 늦다' } })
    check('D-219 기억 정리 결과 — 한글 칸 이름(oneLine 아님)', ctxMd.includes('회사 한줄 정의: 수도권 물류') && ctxMd.includes('해결할 문제') && !ctxMd.includes('oneLine'), ctxMd)
    const snapMd = renderStructured('SNAPSHOT_EXTRACT', { summary: '요약', facts: [{ key: 'industry', value: '물류' }, { key: 'mainProblem', value: '배차' }] })
    check('D-219 자료 요약 결과 — 한글 칸 이름(industry · mainProblem 아님)', snapMd.includes('- 업종: 물류') && snapMd.includes('- 주요 문제: 배차') && !snapMd.includes('industry'), snapMd)
    const doc = { companyName: '그린로직스', purpose: 'AX 제안', audience: '대표', pages: [{ id: 'p1', title: '고친 제목 그린 로드맵', message: '핵심', bullets: ['정산 자동'], keyNumbers: [], visual: '' }] }
    check('D-219 고친 제안서(구조) → 글: 고친 제목이 나온다', revisedText('SANGHO_PROPOSAL', doc).includes('고친 제목 그린 로드맵'))
    const spec = { appName: '그린 배차 플러스', userType: '배차 담당', oneLine: '', kpis: [], navigation: [], dashboardTitle: '오늘 배차판', sections: [{ title: '배차 대기', items: ['3건'] }], table: { title: '', columns: [], rows: [] }, mobile1: { title: 'm1', purpose: '', blocks: [] }, mobile2: { title: 'm2', purpose: '', blocks: [] } }
    const ft = revisedText('AX_FRONT', spec)
    check('D-219 고친 화면 글(구조) → 글: 서비스 이름 · 대시보드 제목 · 구역', ft.includes('그린 배차 플러스') && ft.includes('오늘 배차판') && ft.includes('배차 대기'), ft)
    check('D-219 고친 글이 글이면 그대로', revisedText('FREE_CHAT', '손으로 고친 글') === '손으로 고친 글')
    check('L2 결과 글 — 특허는 경고가 맨 위', renderStructured('PATENT_IDEA', SKILLS.PATENT_IDEA.example).startsWith(`> ⚠ ${PATENT_WARNING}`))
    check('L3 자금 근거 — 다섯 가지 밖의 값은 "미확인"', fundingBasis('승인 확실') === '미확인' && fundingBasis('업체 사실') === '업체 사실')
    const fmd = renderStructured('FUNDING_STRATEGY', { oneLine: 'x', items: [{ title: '운전자금', detail: 'd', basis: '확실함', needsLatestCheck: true }] })
    check('L4 자금 결과 글 — [미확인] · 최신 자료 확인 필요', fmd.includes('[미확인]') && fmd.includes('최신 자료 확인 필요'))
  }
  {
    const part = { ...adoptedRun, evaluation: 'partially_adopted' as const, adoptedPart: { index: 1 }, structured: { ...SKILLS.AX_PENGUIN.example, alternatives: [{ ...SKILLS.AX_PENGUIN.example.recommended, title: '차선 AX', why: '이유2' }] } }
    const prop = proposeFromRun(part, emptyContext())
    check('M1 일부 채택(차선 1번) → 기억의 AX 방향 = 그 차선', (prop.axDirection ?? '').startsWith('차선 AX'), prop)
    const pat = proposeFromRun({ ...adoptedRun, skillId: 'PATENT_IDEA', structured: SKILLS.PATENT_IDEA.example, adoptedPart: { index: 0 } }, emptyContext())
    check('M2 특허 채택 → 특허 방향 + "변리사 검토 전"', (pat.patent ?? '').includes('변리사 검토 전'))
    const cur = { ...emptyContext(), oneLine: 'a' }
    const next = applyContext(cur, { oneLine: 'b', mvp: 'c' })
    check('M3 기억 비교 — 바뀐 칸만', contextDiff(cur, next).map((d) => d.key).join(',') === 'oneLine,mvp')
    check('M4 고친 글이 있으면 요약은 고친 글', runSummary(adoptedRun, '대표가 고친 결론') === '대표가 고친 결론')
  }

  // 저장소 + 흐름(화면 → 서버 함수 → 가짜 공급자 → 저장)
  setEnv()
  llmCalls = []
  llmReply = okReply('AX_PENGUIN')
  {
    const repo = ownerAiRepo({ workspaceId: null, userId: 'owner-1' })
    let c = await repo.saveCase({ ...emptyCase({ companyName: '동료요청 주식회사', relation: 'peer_request', at }) })
    const s1 = await saveContext(repo, { c, client: null, snapshots: [], runs: [], latestRevision: new Map() }, { ...emptyContext(), oneLine: '처음 기억' }, 'manual', '')
    c = s1.c
    let bundle: CaseBundle = { c, client: null, snapshots: [s1.snap], runs: [], latestRevision: new Map() }
    const rid = reqId()
    const r = await runSkill({ repo, bundle, skill: 'AX_PENGUIN', input: {}, requestId: rid, today: TODAY, userId: 'owner-1' })
    check('N1 흐름 — 화면 → 서버 함수 → 결과 저장(구조 · 글 · 기억 판 · 요청 번호) · 타임라인', r.run.status === 'succeeded' && r.run.rendered.includes('가장 추천') && r.run.contextVersion === 1 && r.run.contextSnapshotId === s1.snap.id && r.run.requestId === rid && r.c.activity[0].text.startsWith('AX 전략 분석 v1 생성'), r.run)
    const again = await runSkill({ repo, bundle, skill: 'AX_PENGUIN', input: {}, requestId: rid, today: TODAY, userId: 'owner-1' })
    const runs = await repo.listRuns(c.id)
    check('N2 같은 요청 번호로 또 — 공급자 1번 · 기록 1줄', llmCalls.length === 1 && runs.length === 1 && again.replayed === true, { calls: llmCalls.length, runs: runs.length })
    bundle = { ...bundle, c: r.c, runs }
    const ev = await evaluate(repo, bundle, runs[0], 'adopted', '좋음', null, s1.snap.content)
    check('N3 채택 — 평가 저장 · 타임라인 "채택" · 기억 제안(AX 방향)', ev.run.evaluation === 'adopted' && ev.c.activity[0].text.includes('채택') && !!ev.proposal.axDirection, ev.proposal)
    const s2 = await saveContext(repo, { ...bundle, c: ev.c }, applyContext(s1.snap.content, ev.proposal), `run:${runs[0].id}`, 'AX 채택')
    const snaps = await repo.listSnapshots(c.id)
    check('N4 기억 v2 저장 — v1 은 그대로(덮어쓰지 않음) · Case 판 번호 2', snaps.length === 2 && snaps[0].content.oneLine === '처음 기억' && snaps[1].version === 2 && s2.c.contextVersion === 2)
    const rv1 = await saveRevision(repo, { ...bundle, c: s2.c }, runs[0], { text: '고침1' }, '')
    const rv2 = await saveRevision(repo, { ...bundle, c: rv1.c }, runs[0], { text: '고침2' }, '오타')
    const revs = await repo.listRevisions(runs[0].id)
    check('N5 고친 글 — 1 · 2번 둘 다 남음', revs.length === 2 && revs[0].revisionNo === 1 && revs[1].revisionNo === 2 && rv2.c.activity[0].text.includes('2번째'))
    const rj = await evaluate(repo, { ...bundle, c: rv2.c }, runs[0], 'rejected', '', null, s2.snap.content)
    check('N6 폐기 — 평가 바뀜 · 기억 제안 없음', rj.run.evaluation === 'rejected' && Object.keys(rj.proposal).length === 0)
    const pasted = await pasteChatGpt(repo, { ...bundle, c: rj.c, snapshots: snaps }, 'AX_PENGUIN', 'ChatGPT 에서 가져온 결론: 견적 자동화', 'owner-1')
    check('N7 ChatGPT 붙여넣기 — 실행 기록(붙여넣기 · 토큰 0) · 타임라인', pasted.run.status === 'pasted' && pasted.run.tier === 'manual' && pasted.run.usage.total === 0 && pasted.c.activity[0].text.includes('ChatGPT'))
    const reloaded = ownerAiRepo({ workspaceId: null, userId: 'owner-1' })
    const back = await reloaded.getCase(c.id)
    check('N8 다시 열기(새 저장소 객체) — Case · 기억 · 기록 · 타임라인 그대로', !!back && back.contextVersion === 2 && (await reloaded.listRuns(c.id)).length === 2 && (await reloaded.listSnapshots(c.id)).length === 2 && back.activity.length >= 6)
    check('N9 최신 기억 = 마지막 판', latestSnapshot({ snapshots: snaps })?.version === 2)
    // D-219: 붙여넣은 ChatGPT 결과도 주민번호 · 인증서 비밀번호를 지우고 남긴다(예전엔 원문 그대로)
    const pastedPii = await pasteChatGpt(repo, { ...bundle, c: pasted.c, snapshots: snaps }, 'FREE_CHAT', '대표 김○○ 900101-1234567 · 공동인증서 비밀번호 abc!23 · 결론: 견적 자동화', 'owner-1')
    check('D-219 ChatGPT 붙여넣기 — 주민번호 · 비밀번호는 지우고 결론은 남긴다', !pastedPii.run.rendered.includes('1234567') && !pastedPii.run.rendered.includes('abc!23') && pastedPii.run.rendered.includes('견적 자동화'), pastedPii.run.rendered)
    // D-219: 같은 사업자번호 작업실 — 로컬도 DB 처럼 막고(이유를 말하는 오류) · 업체 탭은 그 작업실을 찾아 잇는다
    const bizA = await repo.saveCase({ ...emptyCase({ companyName: '사업자 같은 회사', relation: 'reviewed', ownerId: 'owner-1', at }), bizNo: '2208112345' })
    let dupErr: unknown = null
    try {
      await repo.saveCase({ ...emptyCase({ companyName: '사업자 같은 회사(2)', relation: 'reviewed', ownerId: 'owner-1', at }), bizNo: '2208112345' })
    } catch (e) {
      dupErr = e
    }
    check('D-219 같은 사업자번호로 새 작업실 — 막고 이유를 말한다(저장 실패 아님)', dupErr instanceof OwnerAiDuplicateError && String((dupErr as Error).message).includes('같은 사업자번호'), String(dupErr))
    const found = findCaseForClient(await repo.listCases(), { id: 'cli_same', businessNumber: '220-81-12345' })
    check('D-219 업체 탭 — 이은 작업실이 없어도 같은 사업자번호 작업실을 찾는다', !found.linked && found.sameBiz?.id === bizA.id, found)
    const linkedA = await patchCase(repo, bizA, (x) => ({ ...x, clientId: 'cli_same' }))
    check('D-219 업체 탭 — 이은 뒤엔 그 작업실을 바로 연다', findCaseForClient(await repo.listCases(), { id: 'cli_same', businessNumber: '2208112345' }).linked?.id === linkedA.id)
    check('D-219 보관한 작업실은 겹침으로 안 본다', caseClash([{ ...bizA, archivedAt: at }], { ...bizA, id: 'other' }) === null && caseClash([bizA], { ...bizA, id: 'other' })?.id === bizA.id)
  }
  setEnv({ OPENAI_API_KEY: undefined })
  {
    const repo = ownerAiRepo({ workspaceId: null, userId: 'owner-1' })
    const c = await repo.saveCase(emptyCase({ companyName: '키없음상사', at }))
    let err: { code?: string; message?: string } = {}
    try {
      await runSkill({ repo, bundle: { c, client: null, snapshots: [], runs: [], latestRevision: new Map() }, skill: 'AX_IDEA', input: {}, requestId: reqId(), today: TODAY, userId: 'owner-1' })
    } catch (e) {
      err = e as { code?: string; message?: string }
    }
    const after = await repo.getCase(c.id)
    check('N10 키 없음 — 화면에 "AI 기능 설정이 필요합니다." · 업체 데이터는 그대로(기록 0)', err.code === 'setup_needed' && err.message === 'AI 기능 설정이 필요합니다.' && !!after && (await repo.listRuns(c.id)).length === 0, err)
  }
  {
    const runs: AiRun[] = [
      { ...adoptedRun, tier: 'cheap', usage: { input: 100, output: 50, total: 150 }, estimatedCostUsd: 0.001, createdAt: '2026-10-02T00:00:00Z' },
      { ...adoptedRun, tier: 'deep', usage: { input: 1000, output: 500, total: 1500 }, estimatedCostUsd: null, createdAt: '2026-10-03T00:00:00Z', evaluation: 'rejected' },
      { ...adoptedRun, tier: 'manual', createdAt: '2026-10-04T00:00:00Z' },
      { ...adoptedRun, tier: 'deep', createdAt: '2026-09-30T00:00:00Z' },
    ]
    const u = monthUsage(runs, '2026-10')
    check('O1 사용량 — 이번 달 호출 2(붙여넣기 · 지난달 빼고) · 빠르게 1 · 깊게 1 · 토큰 · 비용 모르는 호출 1', u.calls === 2 && u.byTier.cheap === 1 && u.byTier.deep === 1 && u.inputTokens === 1100 && u.costUsd === 0.001 && u.costUnknownCalls === 1, u)
    // D-219: 한국 10월 1일 새벽(UTC 로는 9월 30일) 호출은 10월로 센다(예전: 지난달로 셈)
    const prevTz = process.env.TZ
    process.env.TZ = 'Asia/Seoul'
    const early: AiRun[] = [{ ...adoptedRun, tier: 'cheap', createdAt: '2026-09-30T16:30:00Z' }]
    check('D-219 사용량 — 한국 10월 1일 01:30 호출은 10월(UTC 9월 아님)', monthUsage(early, '2026-10').calls === 1 && monthUsage(early, '2026-09').calls === 0)
    if (prevTz === undefined) delete process.env.TZ
    else process.env.TZ = prevTz
  }
  {
    const j = parsePartnerHandoff(JSON.stringify({ event: 'ax_proposal_requested', company: { name: '협력테크', homepage: 'xx.kr', businessNumber: '111-22-33333' }, consultant: { name: '이동료' }, message: 'AX 봐주세요' }))
    const q = parsePartnerHandoff(new URLSearchParams('event=ax_proposal_requested&company=%ED%98%91%EB%A0%A5%ED%85%8C%ED%81%AC&requester=%EC%9D%B4%EB%8F%99%EB%A3%8C'))
    check('P1 Partner OS 다리 — JSON · 주소 둘 다 · 사업자번호 숫자만', j?.companyName === '협력테크' && j.bizNo === '1112233333' && j.requester === '이동료' && j.memo === 'AX 봐주세요' && q?.companyName === '협력테크' && q.requester === '이동료')
    check('P2 Partner OS 다리 — 다른 이벤트 · 이상한 글은 무시', parsePartnerHandoff(JSON.stringify({ event: 'other', company: { name: 'x' } })) === null && parsePartnerHandoff('그냥 글') === null)
  }
  {
    const doc = proposalFrom(SKILLS.SANGHO_PROPOSAL.example, '한빛정밀(주)')
    doc.pages.push(
      { id: 'p2', title: '[회사명] 소개', message: 'OOO 의 문제', bullets: ['매출 1000000원'], keyNumbers: [], visual: '' },
      { id: 'p3', title: '', message: '', bullets: [], keyNumbers: [], visual: '' },
      { id: 'p4', title: '페이지 제목', message: '㈜대성산업 사례', bullets: ['깨진 글자 �'], keyNumbers: [], visual: '' },
      { id: 'p5', title: '아주 긴 제목 '.repeat(12), message: 'm', bullets: Array.from({ length: 14 }, () => '본문 줄이 많아서 칸을 넘칩니다 본문 줄이 많아서 칸을 넘칩니다'), keyNumbers: [{ label: 'a', value: '1,234,567,890,123,456원', basis: '추정' }], visual: '' },
    )
    const qa = qaProposal(doc, roughMeasure)
    const kinds = new Set(qa.map((q) => `${q.page}:${q.kind}`))
    check('Q1 제안서 점검 — 자리표시자 · 숫자 표기 · 빈 페이지 · 회사명 불일치 · 제목 중복 · 이상한 문자 · 넘침', kinds.has('2:placeholder') && kinds.has('2:number_format') && kinds.has('3:empty') && kinds.has('4:company') && kinds.has('4:duplicate_title') && kinds.has('4:bad_char') && kinds.has('5:overflow'), [...kinds])
    check('Q2 정상 페이지(1쪽)는 문제 없음', !qa.some((q) => q.page === 1 && q.kind !== 'duplicate_title'), qa.filter((q) => q.page === 1))
    const lay = layoutPage(doc.pages[0], roughMeasure)
    check('Q3 배치 — 제목 · 메시지 · 본문 줄 · 핵심 수치 칸', lay.title.lines.length >= 1 && lay.numbers.length === 1 && lay.overflow.length === 0, lay.overflow)
    const fixed = applyFix(doc, { where: 'p1 제목', before: '페이지', after: '쪽' })
    const skip = applyFix(doc, { where: 'p1 제목', before: '없는 글', after: 'x' })
    check('Q4 맞춤법 적용 — 그 자리만 바꿈 · 없는 조각은 건너뜀(전체 재생성 없음)', fixed.applied && fixed.doc.pages[0].title.startsWith('쪽') && fixed.doc.pages[1] === doc.pages[1] && !skip.applied)
    check('Q5 맞춤법 검사 입력 — 위치 표시(p1 제목 · p2 본문1)', proofreadInput(doc).includes('p1 제목:') && proofreadInput(doc).includes('p2 본문1:'))
    const again = proposalFrom(JSON.parse(JSON.stringify(doc)), 'x')
    check('Q6 고친 제안서를 다시 읽어도 페이지 아이디 그대로', again.pages[1].id === 'p2' && again.companyName === '한빛정밀(주)')
  }
  {
    const f = frontFrom({ ...SKILLS.AX_FRONT.example, kpis: Array(9).fill({ label: 'k', value: '1' }), dashboard: { title: 'D', sections: [{ title: 's', kind: 'weird', items: ['a'] }] } })
    check('R1 화면 기획 — KPI 4개까지 · 이상한 구역 종류는 목록으로 · 모바일 2개', f.kpis.length === 4 && f.sections[0].kind === 'list' && !!f.mobile1.title && !!f.mobile2.title)
    check('R2 다듬은 명세를 다시 읽어도 같음', JSON.stringify(frontFrom(JSON.parse(JSON.stringify(f)))) === JSON.stringify(f))
  }
}

await serverTests()
await engineTests()
console.log(`\nownerAi: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
