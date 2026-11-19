/**
 * 대표 AI 전략실 V1 시험 — 서버 함수(api/ai-run) · 스킬 서재 · 화면 엔진(업체 · 기억 · 맥락 · 결과 · 제안서 · 화면 기획 · 사용량 · Partner 다리).
 *
 * 서버 함수는 진짜 코드를 부르고, 밖으로 나가는 것(Supabase 로그인 · 권한 RPC · AI 공급자)만 가짜 fetch 로 바꾼다.
 * 화면 흐름(runSkill)도 진짜 코드 → '/api/ai-run' → 서버 함수 → 가짜 공급자로 끝까지 이어 본다.
 */
import handler, { __resetAiRunState } from '../../../api/ai-run.js'
import { SKILLS, COMMON_RULES } from '../../../api/_ai/skills.js'
import { aiConfig, buildPrompt, extractJson, scrubDeep, skillKnowledge, skillKnowledgeAll, validate } from '../../../api/_ai/core.js'
import { KNOWLEDGE } from '../../../api/_ai/knowledge.js'
import { hasBanned, leakedChars, secretIndex } from '../../../api/_ai/guard.js'
import { SKILL_META, QUICK_ACTIONS, shownChoices, choicesToSend } from '../ownerAi/skillCatalog'
import { emptyCase, findDuplicates, makeMaterial, sameMaterial, normalizeCompany, newUuid, caseClash, findCaseForClient, clientsToStart } from '../ownerAi/caseUtil'
import { buildAiContext, caseSnapshot, UNKNOWN } from '../ownerAi/context'
import { renderStructured, revisedText, runSummary, runHeadline, PATENT_WARNING, fundingBasis, verdictLabel } from '../ownerAi/render'
import { listedRuns, runsBySkill, statusLabel, fmtShort } from '../../pages/ownerAi/parts/runStatus'
import { proposeFromRun, contextDiff, applyContext } from '../ownerAi/memory'
import { ownerAiRepo, OwnerAiDuplicateError } from '../ownerAi/repo'
import { runSkill, evaluate, saveContext, saveRevision, pasteChatGpt, latestSnapshot, patchCase, type CaseBundle } from '../ownerAi/workflow'
import { monthUsage } from '../ownerAi/usage'
import { parsePartnerHandoff } from '../ownerAi/partnerBridge'
import { proposalFrom, qaProposal, roughMeasure, layoutPage, applyFix, proofreadInput } from '../ownerAi/proposal'
import { frontFrom } from '../ownerAi/front'
import { caseNext, CASE_PURPOSES } from '../ownerAi/caseNext'
import { caseDocs, docsNotIn } from '../ownerAi/caseDocs'
import { emptyContext, TALK_SKILL_IDS, type AiRun, type SkillId } from '../ownerAi/types'
import { boardFor, historyFor, modeOfRun, nextStep, threadsOf, turnText, LEGACY_THREAD } from '../ownerAi/talk'
import { historyRows } from '../workChat/chatTypes'
import { askCarry } from '../aiAssist/store'
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
  check('S1 스킬 서재 — 화면 목록과 서버 스킬이 같은 id · 판 · 단계 · 이름(18개)', same && server.length === 18, server.map((s) => `${s.id}:${s.version}:${s.tier}`))
  check('S2 스킬 메타데이터 — id · name · version · description · systemInstruction(줄 배열) · outputSchema · active · createdAt · updatedAt', server.every((s) => s.id && s.name && s.version >= 1 && s.description && Array.isArray(s.systemInstruction) && s.systemInstruction.length >= 2 && s.outputSchema && typeof s.active === 'boolean' && /^\d{4}-\d{2}-\d{2}$/.test(s.createdAt) && s.updatedAt))
  check('S3 예시 JSON 이 출력 형식 검사를 통과(모델이 따라 쓸 틀이 틀리지 않음)', server.every((s) => validate(s.outputSchema, s.example).ok), server.filter((s) => !validate(s.outputSchema, s.example).ok).map((s) => [s.id, validate(s.outputSchema, s.example).errors]))
  // D-272 AX 전략 분석 = 대표 AX 기준 문서대로(예전 손으로 쓴 12단계 → 기준 문서의 16단계 · 적합성 판정 · 돈 KPI 3 · 12주 · 반론)
  const p = SKILLS.AX_PENGUIN.systemInstruction.join('\n')
  const steps = ['회사 현실', '핵심 병목', '업무 재설계', '데이터 기반', '방법 선택', '판단→행동→결과', '12주 실증', '현장 실행 넘기기', '기업가치 증거', '고객/파트너 접점', '방어력/단위 경제성/확장', '정부 관점', '투자자 관점', '자금 용도', '반론 검증', '후행 모듈']
  check('S4 AX_PENGUIN — 기준 문서의 16단계 순서 · 판정 넷 · 돈 KPI 3 · 12주 · 반론 질문 · 방법 여섯', steps.every((x, i) => p.indexOf(x) >= 0 && (i === 0 || p.indexOf(x) > p.indexOf(steps[i - 1]))) && ['FULL_GO', 'LITE', 'NO_GO_REDESIGN', 'INSUFFICIENT_DATA'].every((v) => p.includes(v)) && /cost.*revenue.*scale/.test(p) && p.includes('prove12w') && p.includes('challenges') && ['RULE', 'OPTIMIZATION', 'ML', 'RAG', 'LLM', 'HUMAN'].every((m) => p.includes(m)), steps.filter((x) => p.indexOf(x) < 0))
  {
    const ax = ['AX_PENGUIN', 'AX_IDEA', 'AX_MVP'] as const
    const pk = KNOWLEDGE.ax_strategy
    check('S4b AX 단추 셋(전략 분석 · 아이템 발굴 · MVP 구체화)은 기준 문서(ax_strategy)를 받음 · 동료 문구는 안 받음 · D-624 특허 아이디어는 ax 기준이 아니라 특허 기준 · 기준 문서는 적합성 판정 · 16단계 · 반론 · 출력 규격까지(개발 문서 14장 이후는 뺌)', ax.every((id) => (SKILLS[id] as { knowledge?: string[] }).knowledge?.includes('ax_strategy') && skillKnowledge(SKILLS[id]).length > 10000) && !skillKnowledge(SKILLS.CONSULTANT_MESSAGE) && !(SKILLS.PATENT_IDEA as { knowledge?: string[] }).knowledge?.includes('ax_strategy') && pk.includes('FULL_GO') && pk.includes('Company Reality') && pk.includes('실제 누가 반복적으로 사용합니까') && pk.includes('10초 요약') && !pk.includes('JSON 계약') && !pk.includes('구현 로드맵'))
    const sysAx = buildPrompt(SKILLS.AX_PENGUIN, { company: { name: 'X', fields: [] } }, {}, 'deep', COMMON_RULES).system
    const sysMsg = buildPrompt(SKILLS.CONSULTANT_MESSAGE, { company: { name: 'X', fields: [] } }, {}, 'cheap', COMMON_RULES).system
    check('S4c 프롬프트 — AX 전략 분석에 [기준 문서] 가 출력 형식 앞에 · 출처 이름(펭귄 등) 0 · 동료 문구에는 없음', sysAx.includes('[기준 문서]') && sysAx.lastIndexOf('[기준 문서]') < sysAx.lastIndexOf('[출력 형식]') && sysAx.includes('ELIMINATE') && !hasBanned(sysAx) && !/펭귄|PENGUIN/i.test(sysAx) && !sysMsg.includes('[기준 문서]'))
    const leak = pk.slice(2000, 2300)
    check('S4d 기준 문서를 통째로 옮겨 적으면 서버가 막음(서버만 가진 글로 셈)', leakedChars(leak, secretIndex([skillKnowledge(SKILLS.AX_PENGUIN)])) >= 200)
  }
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
    check('B4 깊게 — AX 전략은 AI_MODEL_DEEP · 출력 한도 깊게 · 기준 문서(적합성 판정 · 반론 질문)가 붙음 · 판 3(D-625)', llmCalls[0]?.model === 'm-deep' && llmCalls[0].body.max_completion_tokens === 12000 && sys.includes('[기준 문서]') && sys.includes('NO_GO_REDESIGN') && sys.includes('실제 누가 반복적으로 사용합니까') && run.skillVersion === SKILLS.AX_PENGUIN.version && run.skillVersion === 3, llmCalls[0]?.body.max_completion_tokens)
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
    // D-255 AI 전략실 '고객 관리에서 고르기' — 아직 작업실과 잇지 않은 고객만 · 최근 순 · 찾기
    const mk = (id: string, name: string, biz: string, upd: string, extra: Partial<ClientOpsRecord> = {}) => normalizeClientOps({ id, companyName: name, businessNumber: biz, contactName: `${name} 대표`, createdAt: at, updatedAt: upd, ...extra } as unknown as Partial<ClientOpsRecord>)
    const cl = [mk('a', '가람상사', '111-11-11111', '2026-10-10T00:00:00Z'), mk('b', '나래식품', '222-22-22222', '2026-10-12T00:00:00Z'), mk('c', '다온테크', '333-33-33333', '2026-10-11T00:00:00Z'), mk('d', '라온물산', '', '2026-10-13T00:00:00Z', { archivedAt: '2026-10-13T00:00:00Z' } as Partial<ClientOpsRecord>), mk('e', '마루건설', '555-55-55555', '2026-10-09T00:00:00Z')]
    const linkedCase = { ...emptyCase({ companyName: '가람상사', at }), clientId: 'a' }
    const bizCase = { ...emptyCase({ companyName: '마루', at }), bizNo: '5555555555' }
    const s1 = clientsToStart(cl, [linkedCase, bizCase])
    check('QS1 고르기 목록 — 이은 고객(가람) · 같은 사업자번호 작업실이 있는 고객(마루) · 보관한 고객(라온) 빼고 · 최근 순', s1.list.map((c) => c.id).join() === 'b,c' && s1.total === 2, s1.list.map((c) => c.id))
    check('QS2 찾기 — 회사명 · 대표 · 사업자번호 숫자 3자리 이상', clientsToStart(cl, [], '나래').list.map((c) => c.id).join() === 'b' && clientsToStart(cl, [], '다온테크 대표').list.map((c) => c.id).join() === 'c' && clientsToStart(cl, [], '333-3').list.map((c) => c.id).join() === 'c' && clientsToStart(cl, [], '없는회사').total === 0)
    check('QS3 많으면 8개까지(전체 수는 따로)', clientsToStart(Array.from({ length: 12 }, (_, i) => mk(`x${i}`, `회사${i}`, '', `2026-10-${String(10 + i).padStart(2, '0')}T00:00:00Z`)), []).list.length === 8 && clientsToStart(Array.from({ length: 12 }, (_, i) => mk(`x${i}`, `회사${i}`, '', at)), []).total === 12)
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
    const md = renderStructured('AX_PENGUIN', { ...SKILLS.AX_PENGUIN.example, verdict: 'LITE', thinking: Array.from({ length: 16 }, (_, i) => ({ step: i + 1, title: `단계${i + 1}`, finding: '판단' })) })
    check('L1 결과 글 — AX 전략: 판정(한글) · 가장 큰 문제 · 12주 · 가장 추천(방법 · AI 전에 먼저) · 차선 · 돈 KPI 3 · 16단계 · 반론 질문 · 지금 만들 것', md.includes('판정: 작게 시작') && md.includes('가장 큰 문제') && md.includes('12주에 증명할 것') && md.includes('가장 추천') && md.includes('- 방법:') && md.includes('AI 전에 먼저') && md.includes('차선 1') && md.includes('돈 KPI 3') && md.includes('16단계로 본 것') && md.includes('반론 질문') && md.includes('[P0 | P1 | P2]') && md.includes('지금 만들 것'), md)
    const old = renderStructured('AX_PENGUIN', { oneLine: '예전 결과', thinking: [{ step: 1, title: '돈 버는 방식', finding: '판단' }], recommended: { title: '견적 자동화', why: '이유' }, alternatives: [] })
    check('L1b 예전(판 1) 결과도 그대로 — 판정 · KPI 줄 없이 · "단계별로 본 것"', old.includes('견적 자동화') && !old.includes('판정') && !old.includes('돈 KPI') && old.includes('단계별로 본 것'), old)
    check('L1c 판정 글 — 넷 모두 한글 · 모르는 값은 그대로', verdictLabel('FULL_GO').startsWith('바로 진행') && verdictLabel('no go redesign').startsWith('지금은 만들지') && verdictLabel('INSUFFICIENT_DATA').startsWith('정보 부족') && verdictLabel('기타') === '기타')
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
    check('N1 흐름 — 화면 → 서버 함수 → 결과 저장(구조 · 글 · 기억 판 · 요청 번호) · 타임라인', r.run.status === 'succeeded' && r.run.rendered.includes('가장 추천') && r.run.contextVersion === 1 && r.run.contextSnapshotId === s1.snap.id && r.run.requestId === rid && r.c.activity[0].text.startsWith(`AX 전략 분석 v${SKILLS.AX_PENGUIN.version} 생성`), r.run)
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

/* AI-1 첫 질문 '이 회사에 어떤 도움을 줄까요?' — 추천 하나(규칙) · AI-2 서류함 → 자료 */
function caseFirstTests() {
  const r = (skillId: SkillId, evaluation: AiRun['evaluation'] = 'adopted', status: AiRun['status'] = 'succeeded') => ({ skillId, evaluation, status })
  const n0 = caseNext([])
  check('CN1 기록 없음 → AX 전략 분석 추천 · 이유 한 줄', n0.action === 'ax' && n0.why.includes('분석 기록이 없어') && n0.pending === 0, n0)
  const n1 = caseNext([r('AX_PENGUIN', 'draft')])
  check('CN2 AX 결과가 검토 전이면 여전히 AX · 채택하면 다음 단계 · 검토 전 1개', n1.action === 'ax' && n1.why.includes('채택하면') && n1.pending === 1, n1)
  const n2 = caseNext([r('AX_PENGUIN')])
  check("CN3 AX 채택 → 'AX 방향이 확정되어 있어 MVP 구체화를 추천'", n2.action === 'mvp' && n2.why === 'AX 방향이 확정되어 있어 MVP 구체화를 추천합니다', n2)
  check('CN3b MVP 결과가 검토 전이면 채택을 먼저(다음 단계 제안서)', caseNext([r('AX_PENGUIN'), r('AX_MVP', 'draft')]).why === 'MVP 구체화 결과를 채택하면 다음 단계(제안서)를 추천해 드려요')
  check('CN4 일부 채택도 정해진 것으로', caseNext([r('AX_PENGUIN', 'partially_adopted')]).action === 'mvp')
  check('CN5 폐기 · 실패한 결과는 안 셈', caseNext([r('AX_PENGUIN', 'rejected'), r('AX_PENGUIN', 'adopted', 'failed')]).action === 'ax')
  check('CN6 AX · MVP → 제안서 · 그다음 특허 · 벤처 · 끝으로 정책자금', caseNext([r('AX_PENGUIN'), r('AX_MVP')]).action === 'proposal' && caseNext([r('AX_PENGUIN'), r('AX_MVP'), r('SANGHO_PROPOSAL')]).action === 'patent' && caseNext([r('AX_PENGUIN'), r('AX_MVP'), r('SANGHO_PROPOSAL'), r('VENTURE_PLAN')]).action === 'funding')
  check('CN7 기억 정리 · 맞춤법 · 자료 요약은 결과 수에 안 셈', caseNext([r('CONTEXT_UPDATE', 'draft'), r('PROOFREAD', 'draft'), r('SNAPSHOT_EXTRACT', 'draft')]).pending === 0)
  check('CN8 목적 단추 4개가 모두 빠른 작업에 있음(누르면 같은 창)', CASE_PURPOSES.length === 4 && CASE_PURPOSES.every((p) => QUICK_ACTIONS.some((a) => a.key === p.key)), CASE_PURPOSES)
  const doc = (fileName: string, storagePath = 'ws/x/' + fileName) => ({ status: 'received', fileName, storagePath }) as never
  const client = {
    documents: { businessRegistration: doc('사업자등록증.pdf'), idCard: doc('신분증.jpg'), financialStatements: doc('재무제표.pdf', ''), custom_ir: doc('IR.pdf'), custom_secret: doc('명부.xlsx') },
    customDocuments: [{ key: 'custom_ir', label: 'IR 자료', sensitive: false }, { key: 'custom_secret', label: '직원 명부', sensitive: true }],
  } as never as Parameters<typeof caseDocs>[0]
  const docs = caseDocs(client)
  check('CD1 서류함에서 AI 자료로 가져올 것 — 사업자등록증 · IR(직접 만든 칸) · 신분증 · 개인 정보 칸 · 파일 없는 칸은 뺌', JSON.stringify(docs.map((d) => d.label)) === JSON.stringify(['사업자등록증.pdf', 'IR 자료']), docs.map((d) => d.label))
  const left = docsNotIn(docs, [{ source: '업체 서류함', title: 'IR 자료' }, { source: '직접 올림', title: '사업자등록증.pdf' }])
  check('CD2 이미 서류함에서 넣은 것은 빼고 센다(직접 올린 같은 이름은 따로)', left.length === 1 && left[0].key === 'businessRegistration', left.map((d) => d.key))
}

/* ------------------------------------------------------------------ */
/* D-624 AI 전략실 — 기준 문서 · 결과 줄                                      */
/* ------------------------------------------------------------------ */
function d624Tests() {
  type K = { knowledge?: string[] }
  const kn = (id: keyof typeof SKILLS) => (SKILLS[id] as K).knowledge ?? []
  // 1 어느 단추가 어느 기준 문서를 받나 — 특허 · 벤처 메뉴와 같은 기준
  check(
    'D624-1 기준 문서 — 특허 아이디어 = 특허 아이디어 기준 · 벤처 사업계획 = 벤처 사업계획서 기준 · 화면 기획 = AX 기준 · 제안서 · 자금 · 동료 문구 · 자유 질문 · 기억 정리 · 맞춤법 · 자료 요약은 없음',
    // D-625 판 3 — 특허는 + 정합성 규칙, 벤처는 + 공식 평가기준 · 증거 게이트 · 정합성 규칙(AX 기준 개정 부록)
    JSON.stringify(kn('PATENT_IDEA')) === '["patent_idea","ax_alignment"]' &&
      JSON.stringify(kn('VENTURE_PLAN')) === '["venture_plan","ax_venture","ax_alignment"]' &&
      JSON.stringify(kn('AX_FRONT')) === '["ax_strategy"]' &&
      (['SANGHO_PROPOSAL', 'FUNDING_STRATEGY', 'CONSULTANT_MESSAGE', 'FREE_CHAT', 'CONTEXT_UPDATE', 'PROOFREAD', 'SNAPSHOT_EXTRACT'] as const).every((id) => kn(id).length === 0),
    Object.fromEntries(Object.keys(SKILLS).map((id) => [id, kn(id as keyof typeof SKILLS)])),
  )
  check('D624-2 판이 올라감(실행 기록에 남아 판 1 결과와 나눠 볼 수 있게) — 화면 목록과 같은 판', (['PATENT_IDEA', 'VENTURE_PLAN', 'AX_FRONT'] as const).every((id) => SKILLS[id].version >= 2 && SKILL_META[id].version === SKILLS[id].version))
  const ctx = { company: { name: '그린로직스(주)', fields: [] } }
  const sysP = buildPrompt(SKILLS.PATENT_IDEA, ctx, {}, 'deep', COMMON_RULES).system
  const sysV = buildPrompt(SKILLS.VENTURE_PLAN, ctx, {}, 'deep', COMMON_RULES).system
  const sysF = buildPrompt(SKILLS.AX_FRONT, ctx, {}, 'standard', COMMON_RULES).system
  check(
    'D624-3 프롬프트 — 특허: [기준 문서] 에 5개 고정 질문 · 발명자 확인 / 벤처: 근거 없는 숫자 금지 · 9칸 그대로 / 화면: AX 기준 + 채택한 MVP 를 화면으로 · 셋 다 출력 형식 앞 · 쓰지 않는 이름 0',
    [sysP, sysV, sysF].every((t) => t.includes('[기준 문서]') && t.lastIndexOf('[기준 문서]') < t.lastIndexOf('[출력 형식]') && !hasBanned(t)) &&
      sysP.includes('5개 고정 질문') && sysP.includes('권리화 포인트') && sysP.includes('발명자') &&
      sysV.includes('근거 없이 생성하지 않는다') && sysV.includes('basic 회사 기본정보') &&
      sysF.includes('채택한 결과') && sysF.includes('basedOn') && sysF.includes('ELIMINATE'),
    { p: sysP.length, v: sysV.length, f: sysF.length },
  )
  // 비용 — 지시가 얼마나 늘었나(보고에 쓰는 숫자)
  console.log(`  지시 글자 수: 특허 ${sysP.length.toLocaleString()} · 벤처 ${sysV.length.toLocaleString()} · 화면 ${sysF.length.toLocaleString()} (기준 문서 특허 ${skillKnowledge(SKILLS.PATENT_IDEA).length.toLocaleString()} · 벤처 ${skillKnowledge(SKILLS.VENTURE_PLAN).length.toLocaleString()} · AX ${skillKnowledge(SKILLS.AX_FRONT).length.toLocaleString()})`)
  const ex = SKILLS.AX_FRONT.example as Record<string, unknown>
  check('D624-4 화면 기획 예시 JSON 에 바탕(basedOn) · 확인할 것 — 출력 형식 검사 통과', 'basedOn' in ex && Array.isArray(ex.unknowns) && validate(SKILLS.AX_FRONT.outputSchema, ex).ok)
  const front = { appName: '그린 배차', oneLine: '배차 · 정산 한 화면', basedOn: 'MVP 구체화 — 배차 추천 + 운임 정산표', kpis: [{ label: '배차 시간', value: '35분' }], dashboard: { title: '오늘', sections: [] }, mobile1: { title: 'm1', blocks: [] }, mobile2: { title: 'm2', blocks: [] }, unknowns: ['기사 앱 사용 여부'] }
  const md = renderStructured('AX_FRONT', front)
  const spec = frontFrom(front)
  const again = frontFrom({ ...spec, appName: '그린 배차 플러스' })
  check('D624-5 화면 기획 — 글에 바탕 · 확인할 것 줄 · 화면 스튜디오에서 고쳐도 바탕이 남음 · 예전 결과(바탕 없음)는 빈 칸', md.includes('- 바탕: MVP 구체화 — 배차 추천') && md.includes('확인할 것') && spec.basedOn.startsWith('MVP 구체화') && again.basedOn === spec.basedOn && revisedText('AX_FRONT', again).includes('바탕: MVP 구체화') && frontFrom({ appName: 'x', kpis: [], dashboard: {}, mobile1: {}, mobile2: {} }).basedOn === '', md)

  // 결과 줄 한 줄(펼치지 않아도 무엇이 나왔는지)
  const base = { adoptedPart: null, evaluation: 'draft' as const, status: 'succeeded' as const }
  const h1 = runHeadline({ ...base, skillId: 'AX_PENGUIN', structured: { oneLine: '배차 · 정산을 한 화면에', recommended: { title: '배차 자동 추천', why: '하루 3시간' } }, rendered: '' })
  const h2 = runHeadline({ ...base, skillId: 'AX_PENGUIN', structured: {}, rendered: '## 배차를 줄이는 물류 AX\n- 판정: 작게 시작' })
  const h3 = runHeadline({ ...base, status: 'pasted', skillId: 'FUNDING_STRATEGY', structured: {}, rendered: '\n\n**ChatGPT:** 스마트물류 바우처를 먼저 보세요.' })
  const h4 = runHeadline({ ...base, skillId: 'AX_MVP', structured: { mvpName: '', oneLine: '', features: [] }, rendered: '# 배차 추천 MVP\n필수 기능: 배차 추천' })
  check(
    'D624-6 결과 줄 한 줄 — 요약이 있으면 요약 · 칸이 비어 기호만 남으면 원문 첫 줄 · 붙여넣은 결과는 원문 첫 줄(# · ** 없이) · 140자 안',
    h1.startsWith('배차 · 정산을 한 화면에 / 추천: 배차 자동 추천') && h2 === '배차를 줄이는 물류 AX' && h3 === 'ChatGPT: 스마트물류 바우처를 먼저 보세요.' && h4 === '배차 추천 MVP' && runHeadline({ ...base, skillId: 'FREE_CHAT', structured: { answer: '가'.repeat(400) }, rendered: '' }).length === 140,
    { h1, h2, h3, h4 },
  )

  // 작업마다 묶기 · 상태 말
  const at = (m: number) => new Date(Date.UTC(2026, 10, 17, 0, m)).toISOString()
  const run = (id: string, skillId: SkillId, m: number, evaluation: AiRun['evaluation'] = 'draft', status: AiRun['status'] = 'succeeded') => ({ id, skillId, createdAt: at(m), evaluation, status }) as AiRun
  const runs = [run('a', 'AX_PENGUIN', 1, 'adopted'), run('b', 'AX_IDEA', 2), run('c', 'AX_PENGUIN', 5), run('d', 'PROOFREAD', 6), run('e', 'CONTEXT_UPDATE', 7, 'adopted'), run('f', 'CONTEXT_UPDATE', 8), run('g', 'FUNDING_STRATEGY', 9, 'draft', 'pasted')]
  const g = runsBySkill(listedRuns(runs))
  check(
    'D624-7 결과 묶기 — 작업마다 새것 먼저 · 맞춤법 · 반영한 기억 정리는 목록에서 뺌 · 상태 말(검토 전 · 결과 n개 · 붙여넣음)',
    JSON.stringify(g.get('AX_PENGUIN')?.map((r) => r.id)) === '["c","a"]' && !g.has('PROOFREAD') && JSON.stringify(g.get('CONTEXT_UPDATE')?.map((r) => r.id)) === '["f"]' &&
      statusLabel(g.get('AX_PENGUIN') ?? []) === '검토 전 · 결과 2개' && statusLabel(g.get('AX_IDEA') ?? []) === '검토 전' && statusLabel(g.get('FUNDING_STRATEGY') ?? []) === '붙여넣음 · 검토 전' &&
      statusLabel([run('h', 'AX_MVP', 3, 'adopted')]) === '채택' && /^11\/17 \d\d:\d\d$/.test(fmtShort(at(1))) && fmtShort('') === '',
    [...g].map(([k, v]) => [k, v.map((r) => r.id)]),
  )
}


/* ------------------------------------------------------------------ */
/* D-625 최신 AX 기준(11-04 개정 통합본) — 묶음 · 작업마다 잇기 · 퀵진단 4장       */
/* ------------------------------------------------------------------ */
async function d625Tests() {
  const ax = KNOWLEDGE.ax_strategy as string
  const pg = '펭귄'
  const clientA = '하나정보'
  const clientB = '\x4B\x50\x4A\x4B'
  // 1 묶음 — 새로 들어온 것(우선 원칙 · 12개 질문 · L1/L2/L3 · 증거 등급 · 게이트 · 출력 계약 · 정합성) · 개발 문서(부록 H · 14장 이후)는 빠짐
  check(
    'D625-1 AX 기준 묶음 — 우선 원칙(본업 손실 사건 먼저 · AX 아님 결론) · 개정 부록 A~G(12개 질문 · L1/L2/L3 · E0~E5 · G0~G8 · 출력 계약 · 정합성) · 부록 H · 운영 데이터 모델 장은 뺌',
    ax.includes('가장 큰 손실을 만드는 사건') && ax.includes('NO-AX/OTHER-TECH') && ax.includes('## A2. 프로젝트 시작 시 12개 질문') && /L1 OPERATIONS[\s\S]*L2 INDUSTRY ENGINE[\s\S]*L3 REUSABLE IP/.test(ax) &&
      ax.includes('E0 아이디어') && ax.includes('E5 다고객') && ['G0 본업 문제', 'G4 검증설계', 'G8 심사 재현성'].every((g) => ax.includes(g)) && ax.includes('# 부록 F.') && ax.includes('# 부록 G.') &&
      !ax.includes('# 부록 H.') && !ax.includes('# 14. 운영 OS 데이터 모델'),
    { chars: ax.length },
  )
  // 2 이름 가림 — 다른 고객사 이름 · 내부 명령 이름 · 인터넷 주소 · 그 회사 약어 0 (모든 묶음)
  const leaks = Object.entries(KNOWLEDGE).filter(([, v]) => [pg, clientA, clientB, 'http://', 'https://', 'SO·DE', 'SO/DE'].some((w) => (v as string).includes(w)) || hasBanned(v as string)).map(([k]) => k)
  check('D625-2 묶음 전부 — 다른 고객사 이름 0 · 내부 명령 이름 0 · 인터넷 주소 0 · 쓰지 않는 이름 0(사례는 사례 A · B 로)', leaks.length === 0 && ax.includes('사례 A') && ax.includes('사례 B'), leaks)
  // 3 퀵진단 묶음 — 4장 틀 그대로 · 단계 이름은 하는 일 이름으로
  const q = KNOWLEDGE.ax_quick as string
  check(
    'D625-3 퀵진단 4장 묶음 — PAGE 1~4 틀 · 통과 문장 · 자체 검수 8개 · 넘기기 줄은 "퀵진단(4장) → 상세 제안 → 정밀 분석" · 참고 출처 장은 뺌',
    ['PAGE 1', 'PAGE 2', 'PAGE 3', 'PAGE 4'].every((x) => q.includes(x)) && q.includes('통과 문장 형식') && q.includes('## 7. 퀵진단 자체 검수') && q.includes('퀵진단(4장) → 관심이 있으면 상세 제안(') && q.includes('정밀 분석(전체 16단계') && !q.includes('## 9.') && !q.includes('`'.repeat(1) + '/'),
    q.slice(q.indexOf('## 6.'), q.indexOf('## 6.') + 200),
  )
  // 4 작업마다 잇기 — 제안서는 '퀵진단 4장' 을 고를 때만 퀵진단 기준 · 일반은 없음 · 누출 색인에는 언제나
  const ctx = { company: { name: '그린로직스(주)', fields: [] } }
  // 지시문 안의 '[기준 문서]' 낱말이 아니라 서버가 붙이는 기준 문서 머리
  const KB_HEAD = '[기준 문서] 아래 기준대로 판단한다'
  const gen = buildPrompt(SKILLS.SANGHO_PROPOSAL, ctx, { options: { kind: 'general', pages: '5' } }, 'standard', COMMON_RULES)
  const quick = buildPrompt(SKILLS.SANGHO_PROPOSAL, ctx, { options: { kind: 'quick4' } }, 'standard', COMMON_RULES)
  const odd = buildPrompt(SKILLS.SANGHO_PROPOSAL, ctx, { options: { kind: 'toString' } }, 'standard', COMMON_RULES)
  const old = buildPrompt(SKILLS.SANGHO_PROPOSAL, ctx, { options: { pages: '8' } }, 'standard', COMMON_RULES)
  check(
    'D625-4 제안서 — 형식 "AX 퀵진단 4장" 일 때만 [기준 문서](4장 틀)가 붙음 · 일반 · 예전 요청(형식 없음) · 이상한 값은 안 붙음 · 출력 형식 앞 · 쓰지 않는 이름 0',
    quick.system.includes(KB_HEAD) && quick.system.includes('PAGE 2') && quick.system.lastIndexOf(KB_HEAD) < quick.system.lastIndexOf('[출력 형식]') && !hasBanned(quick.system) && !quick.system.includes(pg) &&
      [gen, odd, old].every((x) => !x.system.includes(KB_HEAD) && !x.system.includes('PAGE 2')) && quick.user.includes('kind: quick4'),
    { quick: quick.system.length, gen: gen.system.length },
  )
  check(
    'D625-5 누출 색인 — 고르기로만 받는 퀵진단 기준도 서버만 가진 글로 셈(통째로 옮기면 막힘) · skillKnowledge 는 고른 것만',
    skillKnowledgeAll(SKILLS.SANGHO_PROPOSAL).includes('PAGE 2') && !skillKnowledge(SKILLS.SANGHO_PROPOSAL).includes('PAGE 2') && leakedChars(q.slice(1500, 1800), secretIndex(Object.values(SKILLS).map((s) => skillKnowledgeAll(s)).filter(Boolean))) >= 200 &&
      skillKnowledge(SKILLS.SANGHO_PROPOSAL, 3 as unknown as Record<string, string>) === '',
  )
  // 6 지시문 — AX 전략 분석 판 3(우선 원칙 · NO_AX · L1/L2/L3 · E0~E5 · G0~G8 · 12개 질문 · RED) · 특허 · 벤처 정합성 · 벤처 공식 항목
  const sysAx = buildPrompt(SKILLS.AX_PENGUIN, ctx, {}, 'deep', COMMON_RULES).system
  const sysV = buildPrompt(SKILLS.VENTURE_PLAN, ctx, {}, 'deep', COMMON_RULES).system
  const sysP = buildPrompt(SKILLS.PATENT_IDEA, ctx, {}, 'deep', COMMON_RULES).system
  const sysF = buildPrompt(SKILLS.AX_FRONT, ctx, {}, 'standard', COMMON_RULES).system
  const sysM = buildPrompt(SKILLS.AX_MVP, ctx, {}, 'standard', COMMON_RULES).system
  check(
    'D625-6 지시문 — AX: 본업 핵심 문제 · NO_AX_OTHER_TECH · techLevel · oneSentence · evidence · gates 9개 · RED · UNKNOWN / MVP: 증명 사건 3개 / 화면: 콘셉트 시안 / 특허: 정합성 한 줄 / 벤처: 공식 평가 항목 criteria · 게이트 · 모두 쓰지 않는 이름 0',
    ['본업 핵심 문제', 'NO_AX_OTHER_TECH', 'techLevel', 'oneSentence', 'evidence', 'G0 본업 문제', 'G8 심사 재현성', 'RED:', 'UNKNOWN:', '개정 부록'].every((x) => sysAx.includes(x)) &&
      sysM.includes('proofEvents') && sysF.includes('콘셉트 시안') && sysP.includes('독립항의 주요 구성') && sysP.includes('# 부록 G.') &&
      sysV.includes('criteria') && sysV.includes('# 부록 C.') && sysV.includes('# 부록 E.') && sysV.includes('증거 게이트') &&
      [sysAx, sysV, sysP, sysF, sysM].every((t) => !hasBanned(t) && !t.includes(pg) && !t.includes(clientA)),
    { ax: sysAx.length, v: sysV.length, p: sysP.length, f: sysF.length },
  )
  console.log(`  D-625 지시 글자 수: AX 전략 ${sysAx.length.toLocaleString()} · 벤처 ${sysV.length.toLocaleString()} · 특허 ${sysP.length.toLocaleString()} · 화면 ${sysF.length.toLocaleString()} · 제안서 일반 ${gen.system.length.toLocaleString()} · 퀵진단 4장 ${quick.system.length.toLocaleString()}`)
  // 7 판 — 서버 = 화면 목록 · 바뀐 스킬은 판이 올라감
  const bumped = { AX_PENGUIN: 3, AX_IDEA: 3, AX_MVP: 3, AX_FRONT: 3, SANGHO_PROPOSAL: 2, PATENT_IDEA: 3, VENTURE_PLAN: 3 } as const
  check('D625-7 판 — 기준이 바뀐 7개 작업은 판이 올라감 · 서버와 화면 목록이 같은 판', Object.entries(bumped).every(([id, v]) => SKILLS[id as keyof typeof SKILLS].version === v && SKILL_META[id as SkillId].version === v))
  // 8 예시 JSON · 결과 글 — 새 칸이 검사를 통과하고 글에 나옴 · 예전 결과(새 칸 없음)는 그대로
  const exOk = (['AX_PENGUIN', 'AX_IDEA', 'AX_MVP', 'VENTURE_PLAN', 'SANGHO_PROPOSAL'] as const).every((id) => validate(SKILLS[id].outputSchema, SKILLS[id].example).ok)
  const axOut = { oneLine: '배차 손실부터', verdict: 'NO_AX_OTHER_TECH', primaryConstraint: '당일 배차 변경으로 공차 운행', evidence: 'E1 설계문서 — 회의록만', recommended: { title: '배차 규칙표', why: '규칙으로 충분', techLevel: 'L1 업무편의 — 범용 기능', oneSentence: '[주문 · 차량]을 [규칙 판정]해 [배차]를 바꿔 [공차율]을 개선' }, alternatives: [], thinking: [], gates: [{ id: 'G0', status: 'PASS', note: '현장 사건 1개' }, { id: 'G2', status: 'fail', note: '판정 원리 도식 없음' }, { id: 'G4', status: '', note: '' }] }
  const md = renderStructured('AX_PENGUIN', axOut)
  const mdOld = renderStructured('AX_PENGUIN', { oneLine: '예전', verdict: 'LITE', recommended: { title: 'x', why: 'y' }, alternatives: [], thinking: [] })
  const ideaMd = renderStructured('AX_IDEA', { oneLine: 'o', items: [{ title: '배차', idea: '규칙', techLevel: 'L2 업종 핵심 엔진' }] })
  const mvpMd = renderStructured('AX_MVP', { mvpName: 'm', oneLine: 'o', features: [], proofEvents: ['주문 30건 · 기준값 대비 공차율'] })
  const vMd = renderStructured('VENTURE_PLAN', { sections: {}, criteria: [{ area: '기술혁신성', item: '기술의 차별성', basis: '', gap: '경쟁 대안 비교표' }] })
  check(
    'D625-8 결과 글 — 판정 "AX 아님" · 증거 등급 · 기술 위상 · 한 문장 · 게이트(PASS → 통과 · fail → 미통과 · 빈 값 → 확인 필요) · 아이템 위상 · 증명할 사건 · 공식 항목 근거 없음/빈 곳 · 예전 결과엔 새 줄 없음',
    exOk && md.includes('AX 아님 — 다른 기술') && verdictLabel('NO-AX/OTHER-TECH').startsWith('AX 아님') && verdictLabel('no ax other tech').startsWith('AX 아님') && md.includes('- 지금 증거 등급: E1 설계문서') && md.includes('- 기술 위상: L1 업무편의') && md.includes('- 한 문장: [주문 · 차량]') &&
      md.includes('- G0 통과 — 현장 사건 1개') && md.includes('- G2 미통과 — 판정 원리') && md.includes('- G4 확인 필요') && !mdOld.includes('증거 게이트') && !mdOld.includes('증거 등급') &&
      ideaMd.includes('- 기술 위상: L2 업종 핵심 엔진') && mvpMd.includes('**증명할 사건**') && vMd.includes('[기술혁신성] 기술의 차별성 — 근거: 없음 · 빈 곳: 경쟁 대안 비교표'),
    md,
  )
  // 9 형식 고르기 — 퀵진단 4장이면 페이지 수 숨기고 보내지 않음 · 일반은 둘 다
  const prop = QUICK_ACTIONS.find((a) => a.key === 'proposal')!
  check(
    'D625-9 제안서 형식 고르기 — 처음엔 일반 제안서 + 페이지 수 · 퀵진단 4장을 고르면 페이지 수 숨김 · 보내는 값에도 없음',
    shownChoices(prop, { kind: 'general', pages: '5' }).map((c) => c.key).join() === 'kind,pages' && shownChoices(prop, { kind: 'quick4', pages: '5' }).map((c) => c.key).join() === 'kind' &&
      JSON.stringify(choicesToSend(prop, { kind: 'quick4', pages: '8' })) === '{"kind":"quick4"}' && JSON.stringify(choicesToSend(prop, { kind: 'general', pages: '8' })) === '{"kind":"general","pages":"8"}' &&
      prop.choices?.[0].initial === 'general',
  )
}

await serverTests()
await engineTests()
caseFirstTests()
d624Tests()
/* ---------------- D-626 기획 대화 ---------------- */
async function d626Tests() {
  const mk = (skillId: SkillId, at: string, task: string, structured: unknown, thread = 'th_aaaaaa01', extra: Partial<AiRun> = {}): AiRun => ({
    id: `r_${at}_${skillId}`, caseId: 'case_1', skillId, skillVersion: 1, input: { task, options: { thread, field: 'ax' } }, structured, rendered: structured ? renderStructured(skillId, structured) : '원문', contextSnapshotId: null, contextVersion: 0,
    provider: 'openai', model: 'm', tier: 'standard', status: 'succeeded', evaluation: 'draft', evaluationNote: '', adoptedPart: null, evaluatedAt: null, usage: { input: 1, output: 1, total: 2 }, estimatedCostUsd: 0, requestId: `q_${at}`, createdBy: null, createdAt: at, ...extra,
  })
  const board = { title: '그린 배차 AX', constraint: '배차 지연', coreValues: ['늦은 배차 줄이기'], moneyKpis: [{ name: '늦은 배차 건수', baseline: '', target: '절반', how: '배차 기록' }], process: { before: '전화', after: '추천' }, aiMethods: [{ job: '배차 추천', method: '규칙', why: '충분' }], notBuilding: ['기사 앱'], open: ['손실 금액 — 담당에게'], changed: [] }
  const t1 = mk('PLAN_TALK', '2026-11-17T01:00:00Z', '어디서 돈이 새지', { title: '배차 병목', answer: '배차 지연입니다', questions: ['손실 금액'], next: ['좁혀 줘'], keep: ['병목은 배차'] })
  const t2 = mk('PLAN_RESEARCH', '2026-11-17T01:05:00Z', '사례 찾아 줘', { answer: '사례가 적다', findings: [{ claim: '주선 수수료 구조', source: '통계', grade: 'A', kind: '시장 사실' }], unknowns: ['동종 수치'], searched: false, sources: [] })
  const t3 = mk('PLAN_TALK', '2026-11-17T01:10:00Z', '지표를 정하자', { answer: '늦은 배차 건수', keep: [] })
  const lock = mk('PLAN_LOCK', '2026-11-17T01:20:00Z', '굳혀 줘', board)
  const other = mk('PLAN_TALK', '2026-11-17T02:00:00Z', '특허 갈래', { answer: '기존 기술 중심' }, 'th_bbbbbb02')
  const old = mk('PLAN_TALK', '2026-11-16T00:00:00Z', '옛 대화', { answer: '답' }, '', { input: { task: '옛 대화' } })
  const ax = mk('AX_PENGUIN', '2026-11-17T00:30:00Z', '', { verdict: 'GO' })
  const all = [ax, t1, t2, t3, lock, other, old]

  const th = threadsOf(all)
  const main = th.find((t) => t.id === 'th_aaaaaa01')!
  check('D626-1 실행 → 대화 묶음(대화 번호마다 · 최근에 이어 간 것 먼저 · 다른 작업은 빼고 · 번호 없는 옛 줄은 한 묶음)', th.length === 3 && th[0].id === 'th_bbbbbb02' && main.turns.length === 4 && th.some((t) => t.id === LEGACY_THREAD) && !th.some((t) => t.turns.includes(ax)), th.map((t) => `${t.id}:${t.turns.length}`))
  check('D626-2 대화 제목 = 굳힌 판 이름 · 판 번호 · 최근 판', main.title === '그린 배차 AX' && main.boardVersion === 1 && main.board?.id === lock.id && main.prompt === null)
  const hist = historyFor(main.turns)
  check('D626-3 서버에 같이 보낼 앞 대화 — 오래된 것부터 · 물음 · 답 글 · 모드 이름', hist.length === 4 && hist[0].q === '어디서 돈이 새지' && hist[0].a.includes('배차 지연입니다') && hist[0].a.includes('정해진 것: 병목은 배차') && hist[1].mode === '리서치' && hist[1].a.includes('[A] 주선 수수료 구조') && hist[3].a.startsWith('기획서 판을 굳힘'), hist)
  check('D626-4 앞 대화는 최근 16번까지(길어지면 오래된 것부터 뺌)', historyFor(Array.from({ length: 30 }, (_, i) => mk('PLAN_TALK', `2026-11-17T03:${String(i).padStart(2, '0')}:00Z`, `q${i}`, { answer: `a${i}` }))).length === 16 && historyFor(Array.from({ length: 30 }, (_, i) => mk('PLAN_TALK', `2026-11-17T03:${String(i).padStart(2, '0')}:00Z`, `q${i}`, { answer: `a${i}` })))[0].q === 'q14')
  const bt = boardFor(lock)
  check('D626-5 지금 기획서 판 글 — 칸 이름 · 지표 지금 값 미확인 · 미정 · 고친 판이 있으면 그것', bt.includes('가장 큰 병목: 배차 지연') && bt.includes('늦은 배차 건수 — 지금 미확인 → 목표 절반') && bt.includes('아직 미정') && boardFor(lock, { ...board, constraint: '정산 오류' }).includes('가장 큰 병목: 정산 오류') && boardFor(null) === '', bt)
  check('D626-6 다음 걸음(규칙) — 세 번 주고받으면 판 · 판 뒤엔 자체점검 · 고칠 것이 나오면 판 다시 · 통과하면 프롬프트', nextStep({ turns: [t1, t2], board: null, judge: null, prompt: null }) === null && nextStep({ turns: [t1, t2, t3], board: null, judge: null, prompt: null })?.mode === 'lock' && nextStep(main)?.mode === 'judge'
    && nextStep({ ...main, judge: mk('PLAN_JUDGE', '2026-11-17T01:30:00Z', '', { verdict: 'FIX', attacks: [] }) })?.mode === 'lock'
    && nextStep({ ...main, judge: mk('PLAN_JUDGE', '2026-11-17T01:30:00Z', '', { verdict: 'GO', attacks: [] }) })?.mode === 'prompt'
    && nextStep({ ...main, judge: mk('PLAN_JUDGE', '2026-11-17T01:30:00Z', '', { verdict: 'GO', attacks: [] }), prompt: mk('DEV_PROMPT', '2026-11-17T01:40:00Z', '', { repoName: 'x', firstMessage: 'y', prompt: 'z' }) }) === null)
  check('D626-7 결과 목록 · 최근 결과에는 대화가 안 쌓임(대화 화면에서 봄) · 모드 찾기', listedRuns(all).length === 1 && listedRuns(all)[0].id === ax.id && TALK_SKILL_IDS.length === 5 && modeOfRun(lock) === 'lock' && turnText(mk('PLAN_TALK', '2026-11-17T04:00:00Z', 'x', null, 'th_aaaaaa01', { status: 'parse_fallback', rendered: '원문 그대로' })) === '원문 그대로')
  const ctx = buildAiContext({ skill: 'AX_MVP', c: emptyCase({ companyName: '그린로직스' }, '2026-11-17T00:00:00Z'), client: null, memory: null, runs: [{ ...lock, evaluation: 'adopted', evaluatedAt: '2026-11-17T01:25:00Z' }, t1, t3], revisions: new Map(), today: '2026-11-17' })
  check('D626-8 채택한 판은 다른 작업이 이어받음(대표가 채택한 결과) · 대화 한 번 한 번은 최근 결과에 안 감', ctx.adopted.some((a) => a.skill === '기획서 판' && a.summary.includes('병목: 배차 지연')) && ctx.recent.length === 0, ctx)
  const mem = proposeFromRun({ ...lock, evaluation: 'adopted' }, emptyContext())
  const memIp = proposeFromRun({ ...lock, evaluation: 'adopted', input: { task: '', options: { thread: 'th_aaaaaa01', field: 'ip' } } }, emptyContext())
  check('D626-9 판 채택 → 기억 제안(방향 칸 · 미정은 모르는 것 · 안 만드는 것은 결정) · 특허 · 벤처 기획이면 특허 방향 칸', String(mem.axDirection).includes('그린 배차 AX') && String(mem.unknowns).includes('손실 금액') && String(mem.decided).includes('안 만드는 것: 기사 앱') && String(memIp.patent).includes('그린 배차 AX') && memIp.axDirection === undefined, mem)

  // 서버 — 대화 스킬만 앞 대화 · 판을 받는다
  const p = buildPrompt(SKILLS.PLAN_JUDGE, { company: { name: '그린로직스', fields: [] } }, { task: '따져 줘', options: { field: 'ax' }, board: bt, history: hist }, 'deep', COMMON_RULES)
  check('D626-10 서버 — [지금 기획서 판] · [지금까지의 대화] 가 [작업 요청] 앞에 · 자체점검 기준 문서', p.user.indexOf('[지금 기획서 판') > 0 && p.user.indexOf('[지금까지의 대화') > p.user.indexOf('[지금 기획서 판') && p.user.indexOf('[작업 요청]') > p.user.indexOf('[지금까지의 대화') && p.user.includes('(리서치) 대표: 사례 찾아 줘') && p.system.includes('[기준 문서] 아래 기준대로 판단한다') && p.system.includes('STRATEGY 100'))
  const long = Array.from({ length: 40 }, (_, i) => ({ q: `물음 ${i} ${'가'.repeat(1400)}`, a: `답 ${i} ${'나'.repeat(2400)}`, mode: '이어서 묻기' }))
  const pl = buildPrompt(SKILLS.PLAN_TALK, { company: { name: '그린로직스', fields: [] } }, { task: '이어서', options: { field: 'ax' }, history: long }, 'standard', COMMON_RULES)
  check('D626-11 서버 — 대화가 길면 최근 것부터 채우고 오래된 것은 뺌(뺀 수를 알림 · 넘치지 않음)', pl.user.includes('물음 39') && !pl.user.includes('물음 0 ') && /앞의 \d+번은 길어서 뺐다/.test(pl.user) && pl.user.length < 20000, pl.user.length)
  const pf = buildPrompt(SKILLS.FREE_CHAT, { company: { name: '그린로직스', fields: [] } }, { task: 'x', history: hist, board: bt }, 'standard', COMMON_RULES)
  check('D626-12 서버 — 대화 스킬이 아닌 작업은 앞 대화를 보내도 쓰지 않음', !pf.user.includes('지금까지의 대화') && !pf.user.includes('지금 기획서 판'))
  check('D626-13 서버 — 갈래마다 기준 문서(AX = 전략 잠금 · 특허 · 벤처 = 네 갈래) · 쓰지 않는 이름 0', skillKnowledge(SKILLS.PLAN_TALK, { field: 'ax' }).includes('HYBRID STRATEGY LOCK') && skillKnowledge(SKILLS.PLAN_TALK, { field: 'ip' }).includes('4개 경로') && !skillKnowledge(SKILLS.PLAN_TALK, { field: 'ip' }).includes('HYBRID STRATEGY LOCK') && skillKnowledge(SKILLS.DEV_PROMPT, {}).includes('ASSET PREP BLOCK')
    && TALK_SKILL_IDS.every((id) => !hasBanned(skillKnowledgeAll(SKILLS[id])) && !hasBanned(SKILLS[id].systemInstruction.join('\n')) && !hasBanned(SKILLS[id].name)))
  check('D626-14 서버 — 리서치만 웹 검색을 붙임 · 모두 대화 스킬 표시', SKILLS.PLAN_RESEARCH.search === true && TALK_SKILL_IDS.every((id) => SKILLS[id].chat === true) && Object.values(SKILLS).filter((x: { search?: boolean }) => x.search).length === 1)

  // 대화창(특허 · 벤처 · 기업인증 · 모듈) · 화면마다 AI 도우미 [직접 물어보기] — 앞 대화 이어받기
  const turn = (i: number) => ({ id: `t${i}`, q: `질문 ${i}`, status: 'done' as const, a: { title: `답 ${i} 제목`, lines: [`답 ${i} 본문 줄`], tone: 'info' as const, actions: [], source: 'ai' as const } })
  const rows = historyRows(Array.from({ length: 9 }, (_, i) => turn(i)) as never)
  check('D626-15 대화창 — 앞 대화 최근 6번 · 답의 본문 줄까지 같이', rows.length === 6 && rows[0]['질문'] === '질문 3' && String(rows[5]['답']).includes('답 8 본문 줄'), rows)
  const now = Date.parse('2026-11-17T06:00:00Z')
  const he = (id: string, at: string, ask: string, headline: string, extra: Record<string, unknown> = {}) => ({ scope: 'marketing', assistId: id, label: '', ask, hash: '', run: { requestId: at, assistId: id, createdAt: at, structured: { headline, items: [{ title: '근거', detail: '자세히' }] }, raw: '' }, ...extra })
  const carry = askCarry([he('marketing.ask', '2026-11-17T05:50:00Z', '둘째', '둘째 답'), he('marketing.ask', '2026-11-17T05:40:00Z', '첫째', '첫째 답'), he('marketing.plan', '2026-11-17T05:45:00Z', '', '단추 답'), he('marketing.ask', '2026-11-16T05:00:00Z', '어제', '어제 답'), he('marketing.ask', '2026-11-17T05:55:00Z', '이어 쓴 것', '답', { follow: { title: 'x', section: { name: 'x', rows: [] } } })] as never, '', now)
  check('D626-16 → D-638 직접 물어보기 — 이 화면에서 방금 물은 것 + 가장 최근 단추 답 하나(오래된 것부터 · 이어 쓰기 · 6시간 지난 것 빼고)', carry.length === 3 && carry[0]['질문'] === '첫째' && carry[1]['질문'].startsWith('(단추)') && carry[1]['답'].includes('단추 답') && carry[2]['답'].includes('둘째 답 / 근거 — 자세히'), carry)
  const reCarry = askCarry([he('marketing.ask', '2026-11-17T05:50:00Z', '둘째', '둘째 답'), he('marketing.ask', '2026-11-17T05:40:00Z', '첫째', '첫째 답')] as never, '', now, '2026-11-17T05:50:00Z')
  check('D-638 [다시 만들기] — 다시 만드는 그 답 · 뒤 것은 앞선 대화에서 빠짐', reCarry.length === 1 && reCarry[0]['질문'] === '첫째', reCarry)
  const rawCarry = askCarry([{ ...he('marketing.ask', '2026-11-17T05:50:00Z', '셋째', ''), run: { requestId: 'r', assistId: 'marketing.ask', createdAt: '2026-11-17T05:50:00Z', structured: null, raw: '```json\n{"headline":"원문 답","items":[{"title":"가","detail":"나"}]}\n```' } }] as never, '', now)
  check('D-638 모양 검사에서 떨어진 답도 앞선 대화엔 읽은 글로(JSON 껍데기 0)', rawCarry.length === 1 && rawCarry[0]['답'].startsWith('원문 답') && !rawCarry[0]['답'].includes('{'), rawCarry)
  check('D626-17 [새로 묻기] 뒤에는 그 앞 질문을 이어받지 않음', askCarry([he('marketing.ask', '2026-11-17T05:50:00Z', '둘째', '둘째 답')] as never, '2026-11-17T05:55:00Z', now).length === 0)
}

await d625Tests()
await d626Tests()
console.log(`\nownerAi: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
