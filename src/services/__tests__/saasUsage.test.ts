/**
 * SAAS-2 고객별 AI 사용량 · 마케팅 고객판 시험.
 *
 *  1) 사용량 장부 흐름 — 서버 함수(api/ai-assist)는 진짜 코드, 밖(Supabase 로그인 · 권한 · 장부 RPC · AI 회사)만 가짜 fetch.
 *     가짜 장부는 0022 함수와 같은 판단(new · retry · inflight · done · quota)을 메모리로 흉내 낸다 — 진짜 DB 판단은 scripts/db-local/test-0022.
 *     한도 초과 · 같은 요청 번호 · 동시에 두 번 · 다시 시도 · AI 실패 · 장부 끊김 · 대표 계정(세지 않음)을 본다.
 *  2) 마케팅 고객판 — 서버 지시문(단추 · 규칙 · 실측 공식) · 화면 자료(레이더 · 묶음 · 스레드 · 숏폼 · 남의 영상 기획)에 대표 개인 정보 0.
 *  3) 메뉴 스위치 — 서버가 연 계정만 레이더 · 스레드 · 릴스/틱톡 주소가 열리고, 홍보 글 · 홈페이지 · 다른 대표 화면은 그대로 닫힘.
 */
import handler, { MARKETING_PAGES, __resetAiAssistState } from '../../../api/ai-assist.js'
import { ASSISTS, assistSystem } from '../../../api/_ai/assists.js'
import { OWNER_IDENTITY_WORDS, cleanBrand, customerize } from '../../../api/_ai/brand.js'
import { OWNER_FACT_MARKERS, customerOutput, customerPack, stripOwnerContext } from '../../../api/_ai/customerMarketing.js'
import { MK_KNOWLEDGE } from '../../../api/_ai/mkKnowledge.js'
import { usageUnits } from '../../../api/_ai/usage.js'
import { __setBrandForTest, normalizeBrand } from '../brandProfile'
import { __setMarketingCustomerForTest, customerBrief, mkText } from '../marketing/persona'
import { radarBundle, packBundle } from '../aiAssist/builders'
import { customSource, makePack, packRules, PACK_RULES } from '../marketing/contentPack'
import { threadsContext } from '../marketing/threads'
import { shortsContext, exampleOf, SHORT_FORMATS } from '../marketing/shorts'
import { adaptContext } from '../marketing/videoStudy'
import { KIM_FACTS, ourFactsList, unknownNumbers } from '../marketing/snsRules'
import { DEFAULT_BRIEF, defaultBrief } from '../marketing/radarStore'
import { withoutOwnerChannel, type YtFeed } from '../marketing/ytBench'
import { presetOf } from '../aiAssist/presets'
import { isCustomerMarketingPath, setPilotMarketing } from '../../config/pilotMarketing'
import { enabledModulesByGroup, isPilotHiddenPath } from '../../config/moduleRegistry'
import type { RadarVideo } from '../marketing/ytRadar'

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

const OWNER = 'Bearer owner-token-aaaaaaaaaaaaaaaaaaaa'
const PILOT = 'Bearer pilot-token-bbbbbbbbbbbbbbbbbbbb'
const SECRET = 'qa-usage-secret-0123456789abcdef'
const ANSWER = { headline: '김팀장의 경영노트 다음 편', items: [{ title: '미래AI랩 관점으로 — 정책자금 3가지', ref: '', tag: '롱폼', detail: '김팀장이 직접 말하기' }], next: [], caution: '' }

/* ---- 가짜 장부(0022 판단 흉내) ---- */
type Row = { units: number; status: 'reserved' | 'settled' | 'released'; assist: string }
let ledger = new Map<string, Row>()
let limit = 20
let ledgerMode: 'ok' | 'not_configured' | 'down' = 'ok'
let ledgerCalls: { fn: string; args: Record<string, unknown> }[] = []
const used = () => [...ledger.values()].filter((r) => r.status !== 'released').reduce((n, r) => n + r.units, 0)
function reserve(a: Record<string, unknown>) {
  const id = String(a.p_request_id)
  const units = Number(a.p_units)
  const row = ledger.get(id)
  if (row) {
    if (row.assist !== a.p_assist_id) return { state: 'conflict' }
    if (row.status === 'reserved') return { state: 'inflight' }
    if (row.status === 'settled') return { state: 'done' }
    if (used() + units > limit) return { state: 'quota', used: used(), limit }
    row.status = 'reserved'
    row.units = units
    return { state: 'retry', used: used(), limit }
  }
  if (used() + units > limit) return { state: 'quota', used: used(), limit }
  ledger.set(id, { units, status: 'reserved', assist: String(a.p_assist_id) })
  return { state: 'new', used: used(), limit }
}

type Call = { url: string; body: Record<string, unknown> }
let calls: Call[] = []
let providerFails = false
let providerDelayMs = 0
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status })
globalThis.fetch = (async (input: unknown, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
  const url = String(input)
  const headers = init?.headers ?? {}
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
  if (url.startsWith('https://qa.supabase.test/auth/v1/user')) {
    if (headers.Authorization === OWNER) return json({ id: 'owner-1' })
    if (headers.Authorization === PILOT) return json({ id: 'pilot-1' })
    return json({}, 401)
  }
  if (url.includes('/rest/v1/rpc/has_capability')) return json(headers.Authorization === OWNER)
  if (url.includes('/rest/v1/rpc/my_os_access')) return json(headers.Authorization === OWNER ? 'full' : headers.Authorization === PILOT ? 'pilot' : 'none')
  const m = /\/rest\/v1\/rpc\/(ai_usage_\w+|my_ai_usage)$/.exec(url)
  if (m) {
    ledgerCalls.push({ fn: m[1], args: body })
    if (ledgerMode === 'down') throw new Error('network down')
    if (m[1] === 'my_ai_usage') return json(ledgerMode === 'ok' ? { configured: true, used: used(), limit, month: '2026-10-01' } : { configured: false, used: 0, limit: 0, month: '2026-10-01' })
    if (ledgerMode === 'not_configured') return json({ code: 'P0001', message: 'ai_usage_not_configured' }, 400)
    if (body.p_secret !== SECRET) return json({ code: 'P0001', message: 'ai_usage_bad_secret' }, 400)
    if (m[1] === 'ai_usage_reserve') return json(reserve(body))
    const row = ledger.get(String(body.p_request_id))
    if (m[1] === 'ai_usage_settle') {
      const n = row && row.status === 'reserved' ? 1 : 0
      if (n && row) row.status = 'settled'
      return json({ settled: n, used: used(), limit })
    }
    if (m[1] === 'ai_usage_release') {
      const n = row && row.status === 'reserved' ? 1 : 0
      if (n && row) row.status = 'released'
      return json({ released: n, used: used(), limit })
    }
  }
  calls.push({ url, body })
  if (url.includes(':generateContent')) {
    if (providerDelayMs) await new Promise((r) => setTimeout(r, providerDelayMs))
    if (providerFails) return json({ error: { message: 'boom' } }, 500)
    return json({ candidates: [{ content: { parts: [{ text: JSON.stringify(ANSWER) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 300 } })
  }
  return json({})
}) as typeof fetch

type MockRes = { statusCode: number; raw: string; body: Record<string, unknown>; setHeader: (k: string, v: string) => void; end: (b?: string) => void }
function mkRes(): MockRes {
  const r: MockRes = {
    statusCode: 200,
    raw: '',
    body: {},
    setHeader() {},
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
function setEnv(secret = true) {
  for (const k of Object.keys(process.env)) if (/^(AI_|OPENAI_|SUPABASE_|GEMINI_|GOOGLE_API|ANTHROPIC_API|VITE_)/.test(k)) delete process.env[k]
  Object.assign(process.env, { SUPABASE_URL: 'https://qa.supabase.test', SUPABASE_ANON_KEY: 'qa-anon', GEMINI_API_KEY: 'gem-test-KEY-1', AI_GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta', ...(secret ? { AI_USAGE_SECRET: SECRET } : {}) })
  __resetAiAssistState()
  calls = []
  ledgerCalls = []
  ledger = new Map()
  limit = 20
  ledgerMode = 'ok'
  providerFails = false
  providerDelayMs = 0
}
let seq = 0
const rid = () => `req-usage-${String(++seq).padStart(6, '0')}`
async function post(body: Record<string, unknown>, auth: string) {
  const res = mkRes()
  await handler({ method: 'POST', url: '/api/ai-assist', headers: { authorization: auth }, body: JSON.stringify(body) }, res)
  return res
}
async function status(auth: string) {
  const res = mkRes()
  await handler({ method: 'GET', url: '/api/ai-assist?status=1', headers: { authorization: auth } }, res)
  return res
}
const provider = () => calls.filter((c) => c.url.includes(':generateContent'))
const fnCalls = (fn: string) => ledgerCalls.filter((c) => c.fn === fn)
const ownerHits = (text: string, allow: string[] = []) => [...OWNER_IDENTITY_WORDS, ...OWNER_FACT_MARKERS].filter((w) => !allow.includes(w) && text.includes(w))
const BRAND = { name: '최은혜', company: '은혜경영', industry: '정책자금 컨설팅', specialties: '정책자금 · 고용지원금', tone: '쉬운 말', facts: '경력 5년 · 상담 80곳', ending: '궁금한 점은 댓글로 남겨 주세요', intro: '서류부터 신청까지 한 번에' }
const MK_CTX = { title: '콘텐츠 레이더', today: '2026-10-25', purpose: '김팀장(미래AI랩) 채널', facts: [...KIM_FACTS, '이번 주 키워드 정책자금'], sections: [{ name: '후보', rows: [{ ref: 'o1', 주제: '정책자금 금리', 미래AI랩관점_규칙: '우리 관점' }, { ref: 'o2', 주제: '고용지원금' }] }] }

async function run() {
  /* ---- 1. 사용량 장부 흐름 ---- */
  check('U1 단위 — 빠르게 1 · 보통 3 · 깊게 10, 글 쓰기 단추 2배', usageUnits({ kind: 'list' }, 'cheap') === 1 && usageUnits({ kind: 'list' }, 'standard') === 3 && usageUnits({ kind: 'list' }, 'deep') === 10 && usageUnits({ kind: 'write' }, 'cheap') === 2 && usageUnits({ kind: 'write' }, 'deep') === 20)

  setEnv()
  const st = await status(PILOT)
  check('U2 상태 — 장부가 준비된 고객 계정은 마케팅 열림 · 이번 달 사용량 · 마케팅 단추 목록에 있음', st.statusCode === 200 && st.body.marketing === true && (st.body.usage as { limit: number } | null)?.limit === 20 && (st.body.assists as { page: string }[]).some((a) => a.page === 'radar') && !(st.body.assists as { page: string }[]).some((a) => a.page === 'patent'), st.body)

  const id1 = rid()
  const r1 = await post({ requestId: id1, assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  const res1 = fnCalls('ai_usage_reserve')[0]?.args
  check('U3 고객 마케팅 요청 — 예약(글 쓰기 2단위 · 요청 번호 · 단추) → AI 한 번 → 정산 한 번 · 답에 이번 달 사용량', r1.statusCode === 200 && res1?.p_units === 2 && res1?.p_request_id === id1 && res1?.p_assist_id === 'radar.top5' && provider().length === 1 && fnCalls('ai_usage_settle').length === 1 && ledger.get(id1)?.status === 'settled' && (r1.body.run as { quota?: { used: number } }).quota?.used === 2, { s: r1.statusCode, b: r1.raw.slice(0, 300), res1 })
  const settled = fnCalls('ai_usage_settle')[0]?.args
  check('U4 정산에 토큰 · 비용(서버가 잰 값) · 비밀값은 서버 환경변수에서만', settled?.p_tokens_in === 1200 && settled?.p_tokens_out === 300 && settled?.p_secret === SECRET && !JSON.stringify(r1.body).includes(SECRET), settled)

  calls = []
  ledgerCalls = []
  const again = await post({ requestId: id1, assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  check('U5 같은 요청 번호를 다시 보내면(같은 서버) — 기억한 답을 다시 줌 · AI · 장부 다시 안 부름(두 번 세지 않음)', again.statusCode === 200 && provider().length === 0 && fnCalls('ai_usage_reserve').length === 0 && used() === 2, { s: again.statusCode, n: provider().length, l: ledgerCalls.length })

  __resetAiAssistState()
  calls = []
  const other = await post({ requestId: id1, assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  check('U6 같은 요청 번호가 다른 서버로 가도(메모리 없음) — 장부가 "이미 끝남" · 409 request_done · AI 안 부름 · 사용량 그대로', other.statusCode === 409 && other.body.code === 'request_done' && provider().length === 0 && used() === 2, other.body)

  const id2 = rid()
  ledger.set(id2, { units: 2, status: 'reserved', assist: 'threads.write' })
  const busy = await post({ requestId: id2, assistId: 'threads.write', page: 'threads', context: MK_CTX, brand: BRAND }, PILOT)
  check('U7 다른 서버에서 같은 요청이 도는 중 — 409 request_in_progress · AI 안 부름(동시 호출 두 번 세지 않음)', busy.statusCode === 409 && busy.body.code === 'request_in_progress' && provider().length === 0, busy.body)
  ledger.delete(id2)

  setEnv()
  providerDelayMs = 30
  const id3 = rid()
  const [p1, p2] = await Promise.all([post({ requestId: id3, assistId: 'shorts.write', page: 'shorts', context: MK_CTX, brand: BRAND }, PILOT), post({ requestId: id3, assistId: 'shorts.write', page: 'shorts', context: MK_CTX, brand: BRAND }, PILOT)])
  check('U8 같은 요청 번호로 동시에 두 번(두 번 누름) — AI 한 번 · 예약 한 번 · 둘 다 같은 답', p1.statusCode === 200 && p2.statusCode === 200 && provider().length === 1 && fnCalls('ai_usage_reserve').length === 1 && used() === 2, { a: p1.statusCode, b: p2.statusCode, n: provider().length, r: fnCalls('ai_usage_reserve').length })

  setEnv()
  providerFails = true
  const id4 = rid()
  const bad = await post({ requestId: id4, assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  check('U9 AI 회사가 실패하면 — 예약을 되돌림(사용량 0) · 정산 안 함', bad.statusCode >= 500 && fnCalls('ai_usage_release').length === 1 && fnCalls('ai_usage_settle').length === 0 && used() === 0 && ledger.get(id4)?.status === 'released', { s: bad.statusCode, rel: fnCalls('ai_usage_release').length, used: used() })
  providerFails = false
  __resetAiAssistState()
  calls = []
  const retry = await post({ requestId: id4, assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  check('U10 실패한 요청을 같은 번호로 다시 시도 — 장부가 "다시" 로 받아 한 번만 셈(2단위)', retry.statusCode === 200 && provider().length === 1 && used() === 2 && ledger.get(id4)?.status === 'settled', { s: retry.statusCode, used: used() })

  setEnv()
  limit = 3
  await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  calls = []
  const over = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  check('U11 한도를 넘으면 — 429 quota_exceeded · 이번 달 사용량 · AI 안 부름 · 장부에 남지 않음', over.statusCode === 429 && over.body.code === 'quota_exceeded' && over.body.used === 2 && over.body.limit === 3 && provider().length === 0 && ledger.size === 1, over.body)
  const small = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: { title: '오늘', today: '2026-10-25', sections: [] } }, PILOT)
  check('U12 남은 1단위로 빠른 정리 단추(1단위)는 됨 — 한도는 단위로', small.statusCode === 200 && used() === 3, { s: small.statusCode, used: used() })

  setEnv()
  ledgerMode = 'down'
  const down = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: { title: '오늘', today: '2026-10-25', sections: [] } }, PILOT)
  check('U13 장부에 닿지 못하면 — 503 usage_unreachable · AI 안 부름(세지 않고 쓰는 일 없음)', down.statusCode === 503 && down.body.code === 'usage_unreachable' && provider().length === 0, down.body)

  setEnv()
  const own = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX }, OWNER)
  const ownSt = await status(OWNER)
  check('U14 대표 계정 — 장부를 부르지 않음 · 마케팅 그대로 · 지시문 예전 그대로(김팀장 기준)', own.statusCode === 200 && ledgerCalls.length === 0 && ownSt.body.marketing === true && ownSt.body.usage === null && JSON.stringify(provider()[0]?.body ?? '').includes('김팀장'), { s: own.statusCode, l: ledgerCalls.map((c) => c.fn) })

  setEnv(false)
  const noSecret = await status(PILOT)
  const mk = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  const plain = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: { title: '오늘', today: '2026-10-25', sections: [] } }, PILOT)
  check('U15 비밀값 없음(대표가 SQL 적용 전) — 고객 마케팅 닫힘(상태 · 직접 호출 403 usage_setup_needed) · 다른 AI 는 예전처럼(장부 안 부름)', noSecret.body.marketing === false && !(noSecret.body.assists as { page: string }[]).some((a) => MARKETING_PAGES.has(a.page)) && mk.statusCode === 403 && mk.body.code === 'usage_setup_needed' && plain.statusCode === 200 && ledgerCalls.length === 0, { m: noSecret.body.marketing, mk: mk.body.code, p: plain.statusCode })

  setEnv()
  ledgerMode = 'not_configured'
  const nc = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  const nc2 = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: { title: '오늘', today: '2026-10-25', sections: [] } }, PILOT)
  const ncSt = await status(PILOT)
  check('U16 비밀값은 있는데 DB 설정이 없음 · 틀림 — 마케팅 403 usage_setup_needed · 다른 AI 는 예전처럼 · 상태도 닫힘', nc.statusCode === 403 && nc.body.code === 'usage_setup_needed' && nc2.statusCode === 200 && ncSt.body.marketing === false, { nc: nc.body.code, nc2: nc2.statusCode, st: ncSt.body.marketing })

  setEnv()
  const pat = await post({ requestId: rid(), assistId: 'spec.talk', page: 'patent', context: MK_CTX }, PILOT)
  check('U17 특허 명세서(대표 회사 기준)는 장부가 있어도 고객에게 403 forbidden · 장부 안 부름', pat.statusCode === 403 && ledgerCalls.length === 0, { s: pat.statusCode, b: pat.body.code })

  /* ---- 2. 마케팅 고객판 — 서버 ---- */
  setEnv()
  const mk2 = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  const sent = JSON.stringify(provider()[0]?.body ?? '')
  check('M1 고객 레이더 요청 — AI 로 간 지시문 · 자료에 대표 이름 · 대표 사실 0 · 그 사람(최은혜 · 은혜경영) 있음', mk2.statusCode === 200 && ownerHits(sent, ['최은혜']).length === 0 && sent.includes('최은혜(은혜경영)의 업무 비서') && sent.includes('경력 5년'), ownerHits(sent, ['최은혜']))
  check('M2 화면 자료에 섞여 온 대표 사실 줄(옛 기본값)은 빼고 · 고객 줄(이번 주 키워드)은 남김', !sent.includes('100억') && sent.includes('이번 주 키워드 정책자금') && sent.includes('고용지원금'), sent.slice(0, 200))
  const out = JSON.stringify(mk2.body.run)
  check('M3 답에 대표 이름이 나와도 화면에는 그 사람 이름 · 회사로(마지막 그물)', !out.includes('김팀장') && !out.includes('미래AI랩') && out.includes('최은혜') && out.includes('은혜경영'), out.slice(0, 300))

  const mkAssists = Object.values(ASSISTS).filter((a) => MARKETING_PAGES.has(a.page))
  const leaks: string[] = []
  for (const a of mkAssists)
    for (const b of [null, cleanBrand(BRAND)]) {
      const s = assistSystem(a, { customer: { brand: b } })
      const w = ownerHits(s, b ? ['최은혜'] : [])
      if (w.length || s.includes('카드뉴스')) leaks.push(`${a.id}:${[...w, s.includes('카드뉴스') ? '카드뉴스' : ''].join('/')}`)
    }
  check(`M4 마케팅 단추 ${mkAssists.length}개 × (설정 없음 · 있음) — 고객 지시문에 대표 이름 · 대표 사실 · 카드뉴스 0`, mkAssists.length >= 20 && leaks.length === 0, leaks.slice(0, 8))
  const ownerSys = mkAssists.map((a) => assistSystem(a, {})).join('\n')
  check('M5 대표 계정 마케팅 지시문은 그대로 — 김팀장 화자 · 운영 원칙 · 사실 목록 · 카드뉴스', ownerSys.includes('화자 = 김팀장') && ownerSys.includes('대표 운영 원칙') && ownerSys.includes('김팀장이었습니다') && ownerSys.includes('카드뉴스'))
  const thr = assistSystem(ASSISTS['threads.write'], { customer: { brand: cleanBrand(BRAND) } })
  check('M6 고객 스레드 지시문 — 실측 공식(틀 카드 · 첫 줄 기법 · 끝 방식)은 남고 대표 완성 예시 · 대표 계정 운영안은 빠짐', thr.includes('틀 카드') && thr.includes('첫 줄 기법') && thr.includes('끝 방식') && !thr.includes('운영안') && !thr.includes('완성 글'))
  const longCust = customerPack(MK_KNOWLEDGE.mk_long)
  check('M7 실측 공식 고객판 — 대표 롱폼 완성 기획(대표 고객 사례 · "9년째 … 김팀장입니다") 장째 빠짐 · 공식 줄은 남음', !longCust.includes('폐기물') && !longCust.includes('9년째') && longCust.includes('업그레이드된 롱폼 공식') && longCust.length > 1000, longCust.length)
  check('M8 고객 본인 이름이 대표 측 이름(최은혜)과 같아도 그 사람 첫 줄 · [내 브랜드] 는 바뀌지 않음', thr.includes('컨설턴트 최은혜(은혜경영)의 업무 비서') && thr.includes('- 부르는 이름(화자): 최은혜'))
  check('M9 이름 바꾸기 한 번에 — 회사 이름에 MIRAE 가 들어가도 두 번 바뀌지 않음', customerize('미래AI랩 · MIRAE · 김팀장', { company: 'MIRAE컨설팅', name: '박' }) === 'MIRAE컨설팅 · MIRAE컨설팅 · 박')
  const stripped = stripOwnerContext({ facts: ['미래AI랩 대표 9년', '내 사실'], rules: ['김팀장이었습니다'], sections: [{ name: 'x', rows: [{ a: '최은혜 팀장' }, { a: '고객 줄' }] }] }, { name: '최은혜' })
  check('M10 자료 거르기 — 대표 줄은 빼고(바꿔 쓰지 않음) · 고객 자기 이름 줄은 남김', stripped.removed === 2 && stripped.context.facts.length === 1 && stripped.context.rules.length === 0 && stripped.context.sections[0].rows.length === 2, stripped)
  check('M11 답 그물 — 대표 이름만 바꾸고 다른 글은 그대로', JSON.stringify(customerOutput({ a: ['김팀장의 경영노트', '미래AI랩'], b: 3 }, { name: '박', company: 'A사' })) === JSON.stringify({ a: ['A사', 'A사'], b: 3 }))

  /* ---- 3. 마케팅 고객판 — 화면 자료 ---- */
  __setBrandForTest('ws-c', normalizeBrand(BRAND))
  __setMarketingCustomerForTest(true)
  const today = '2026-10-25'
  const rb = radarBundle({ today, view: 'plan', plan: null, rising: [], breakouts: [], videos: [], ideas: [], mine: [], brief: null })
  const src = customSource('정책자금 금리')
  const pack = src ? makePack(src) : null
  const pb = pack ? packBundle({ today, pack }) : null
  const th = threadsContext({ goal: '', template: '', topic: '정책자금', tag: '', facts: '', reference: '', recent: [], today })
  const sh = shortsContext({ platform: 'tiktok', aim: '', format: '', topic: '정책자금', facts: '', recent: [], today })
  const video = { id: 'abc', title: '정책자금 3가지', channelName: '남의 채널', durationSec: 600, views: 1000, url: '', isShort: false, ageDays: 3, ratio: 3.2, adjusted: 3.2, tier: 'breakout', likeRate: 1.2, channelSubs: 1000, viewsPerSub: 1, likes: 10, comments: 1 } as unknown as RadarVideo
  const ad = adaptContext({ v: video, lessons: [], brief: null, transcript: null, today })
  const clientText = JSON.stringify([rb.context, pb?.context, th, sh, ad, pack?.sections])
  check('C1 고객 화면 자료(레이더 · 묶음 · 스레드 · 숏폼 · 남의 영상 기획 · 규칙 초안) — 대표 이름 · 대표 사실 0 · 그 사람 회사 있음', ownerHits(clientText, ['최은혜']).length === 0 && clientText.includes('은혜경영'), ownerHits(clientText, ['최은혜']))
  check('C2 고객 묶음에 카드뉴스 칸 없음 · 규칙집에 카드뉴스 · 김팀장 끝인사 없음(대표 규칙집은 그대로)', !!pack && !pack.sections.some((x) => x.id === 'cards') && !packRules().join('\n').includes('카드뉴스') && !packRules().join('\n').includes('김팀장') && PACK_RULES.join('\n').includes('카드뉴스'))
  check('C3 고객 기본 채널 기준 = 그 사람 브랜드(김팀장의 경영노트 아님)', defaultBrief().channel.includes('은혜경영') && defaultBrief().ending === BRAND.ending && customerBrief().host.startsWith('최은혜') && !JSON.stringify(defaultBrief()).includes('경영노트'))
  check('C4 고객 사실 목록 = 그 사람 "확인된 사실" 칸 · 숫자 대조도 그 목록으로(대표 숫자 9년은 모르는 숫자)', ourFactsList().join('|') === '경력 5년|상담 80곳' && unknownNumbers('경력 5년 · 9년', '').join() === '9년')
  check('C5 고객 단추 이름 — "미래AI랩 맞춤" → "내 채널 맞춤" · 카드뉴스 없음', presetOf('radar.top5')?.label === '내 채널 맞춤 이번 주 TOP5 기획' && !(presetOf('bench.copy')?.label ?? '').includes('미래AI랩'), presetOf('radar.top5')?.label)
  const talk = SHORT_FORMATS.find((f) => f.key === 'talk')
  check('C6 숏폼 대화형 예시로 시작 — "김팀장:" 줄이 그 사람 이름으로', !!talk && !exampleOf(talk, 'tiktok').script.includes('김팀장') && exampleOf(talk, 'tiktok').script.includes('최은혜:'))
  check('C7 화면 글 — MIRAE 관점 · 김팀장 → 우리 · 그 사람', mkText('MIRAE 가 미리 골라 둔 채널') === '내가 미리 골라 둔 채널' && !mkText('MIRAE AX형').includes('MIRAE'))
  const feed: YtFeed = { fetchedAt: '', failed: [], channels: [{ id: 'own', handle: '@김팀장의경영노트', title: '김팀장의 경영노트', customUrl: '@김팀장의경영노트', thumb: '', subs: 1, videoCount: 1, views: 1, mine: true }, { id: 'x', handle: '@yoido', title: '여의도', customUrl: '@yoido', thumb: '', subs: 1, videoCount: 1, views: 1, mine: false }], videos: [{ id: 'v1', ch: 'own' }, { id: 'v2', ch: 'x' }] as unknown as YtFeed['videos'] }
  const cf = withoutOwnerChannel(feed)
  check('C8 고객 레이더 — 대표 채널(내 채널 표시)은 채널 · 영상에서 빠짐 · 다른 채널은 그대로', cf.channels.map((c) => c.id).join() === 'x' && cf.videos.length === 1)

  __setMarketingCustomerForTest(false)
  const ownerRb = JSON.stringify(radarBundle({ today, view: 'plan', plan: null, rising: [], breakouts: [], videos: [], ideas: [], mine: [], brief: null }).context)
  check('C9 대표 계정 화면 자료 · 기본값은 그대로(미래AI랩 소개 · 김팀장의 경영노트 · 사실 목록 · 단추 이름)', ownerRb.includes('미래AI랩') && defaultBrief() === DEFAULT_BRIEF && ourFactsList() === KIM_FACTS && presetOf('radar.top5')?.label === '미래AI랩 맞춤 이번 주 TOP5 기획' && mkText('MIRAE 관점') === 'MIRAE 관점')
  __setBrandForTest(null, null)

  /* ---- 4. 메뉴 스위치 ---- */
  setPilotMarketing('unknown')
  const closedBefore = ['/marketing', '/marketing/youtube', '/marketing/threads', '/marketing/shorts'].every((p) => isPilotHiddenPath(p))
  setPilotMarketing('open')
  const opened = ['/marketing', '/marketing/youtube', '/marketing/threads', '/marketing/shorts'].every((p) => !isPilotHiddenPath(p))
  const stillClosed = ['/tools/content', '/tools/homepage', '/marketing/more', '/patent-venture', '/ai', '/ops/agents', '/studio'].every((p) => isPilotHiddenPath(p)) && !isCustomerMarketingPath('/marketingx') && !isCustomerMarketingPath('/marketing/more')
  const menu = enabledModulesByGroup({ pilot: true }).flatMap((g) => g.items.map((m) => m.key))
  check('N1 서버가 열기 전에는 고객에게 마케팅 주소 모두 닫힘', closedBefore)
  check('N2 서버가 연 계정 — 레이더 · 스레드 · 릴스/틱톡 주소 열림 · 메뉴에 마케팅 · 브랜딩 줄', opened && menu.includes('marketing'), menu)
  check('N3 열려도 홍보 글 · 홈페이지 · 예전 안내 · 다른 대표 화면은 닫힌 채', stillClosed && !menu.includes('agents') && !menu.includes('patent-venture'))
  setPilotMarketing('closed')
  check('N4 닫히면 다시 닫힘(메뉴 · 주소)', isPilotHiddenPath('/marketing/threads') && !enabledModulesByGroup({ pilot: true }).some((g) => g.items.some((m) => m.key === 'marketing')))
  setPilotMarketing('unknown')

  console.log(`\nsaas-usage: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

void run().catch((e) => {
  console.error(e)
  process.exit(1)
})
