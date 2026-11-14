/**
 * SAAS-2 고객별 AI 사용량 · 마케팅 고객판 시험.
 *
 *  1) 사용량 장부 흐름 — 서버 함수(api/ai-assist)는 진짜 코드, 밖(Supabase 로그인 · 권한 · 장부 RPC · AI 회사)만 가짜 fetch.
 *     가짜 장부는 0022 함수와 같은 판단(new · retry · inflight · done · quota)을 메모리로 흉내 낸다 — 진짜 DB 판단은 scripts/db-local/test-0022.
 *     한도 초과 · 같은 요청 번호 · 동시에 두 번 · 다시 시도 · AI 실패 · 장부 끊김 · 대표 계정(세지 않음)을 본다.
 *  2) 마케팅 고객판 — 서버 지시문(단추 · 규칙 · 실측 공식) · 화면 자료(레이더 · 묶음 · 스레드 · 숏폼 · 남의 영상 기획)에 대표 개인 정보 0.
 *  3) 메뉴 스위치 — 서버가 연 계정만 레이더 · 스레드 · 릴스/틱톡 주소가 열리고, 홍보 글 · 홈페이지 · 다른 대표 화면은 그대로 닫힘.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import handler, { MARKETING_PAGES, __resetAiAssistState } from '../../../api/ai-assist.js'
import { ASSISTS, assistSystem } from '../../../api/_ai/assists.js'
import { OWNER_IDENTITY_WORDS, cleanBrand, customerize } from '../../../api/_ai/brand.js'
import { OWNER_FACT_MARKERS, customerOutput, customerPack, stripOwnerContext } from '../../../api/_ai/customerMarketing.js'
import { MK_KNOWLEDGE } from '../../../api/_ai/mkKnowledge.js'
import { usageUnits } from '../../../api/_ai/usage.js'
import { __setBrandForTest, normalizeBrand } from '../brandProfile'
import { __setMarketingCustomerForTest, customerBrief, mkText } from '../marketing/persona'
import { radarBundle, packBundle } from '../aiAssist/marketingBuilders'
import { customSource, makePack, packRules, PACK_RULES } from '../marketing/contentPack'
import { threadsContext } from '../marketing/threads'
import { shortsContext, exampleOf, SHORT_FORMATS } from '../marketing/shorts'
import { adaptContext } from '../marketing/videoStudy'
import { KIM_FACTS, ourFactsList, unknownNumbers } from '../marketing/snsRules'
import { DEFAULT_BRIEF, defaultBrief } from '../marketing/radarStore'
import { withoutOwnerChannel, type YtFeed } from '../marketing/ytBench'
import { presetOf } from '../aiAssist/presets'
import { isCustomerMarketingPath, pilotMarketingScreens, pilotMarketingState, setPilotMarketing, setPilotMarketingScreens } from '../../config/pilotMarketing'
import { enabledModulesByGroup, isPilotHiddenPath } from '../../config/moduleRegistry'
import type { RadarVideo } from '../marketing/ytRadar'
import { HOWTO_NOTE, POSTING_HOWTO } from '../../content/postingHowTo'
import { CLIENTS_CSV_HEADER, PASTE_MAX_ROWS, bulkExtrasLine, bulkSummaryLine, clientsCsv, dropTitleRows, guessColumns, planBulk, rowsFromTable, splitPaste, tidyEmail } from '../clientBulkPaste'
import { BULK_FILE_ACCEPT, BULK_FILE_MAX_BYTES, bulkFileKind, decodeTableBytes, firstSheetOfText, readBulkFile } from '../clientBulkFile'
import { makeSimpleXlsx } from './xlsxFixture'
import { guideKeyForPath } from '../../content/screenGuideKey'
import { HOME_HOWTO, HOME_HOWTO_NOTE } from '../../content/homeScreenHowTo'
import { hasSavedSignIn } from '../../app/shellChunks'
import { BIO_CHANNELS, bioBlanks, bioDrafts, bioInputFromBrand, josa, type BioInput } from '../marketing/profileBio'
import { consultLint } from '../marketing/consultRules'
import { normalizeClientOps } from '../clientOpsService'
import { guideGroupsFor } from '../../content/guideGroups'
import { searchScreens, squashForSearch } from '../../content/screenSearch'
import { WHATS_NEW, WHATS_NEW_MAX, whatsNewDateLabel, whatsNewFor } from '../../content/whatsNew'
import { IN_APP_LABEL, externalOpenUrl, hasOneTimeToken, inAppBrowserOf } from '../../lib/inAppBrowser'
import { CONTACT_PATHS, CONTACT_PATH_AFTER, CONTACT_PATH_NOTE } from '../../content/contactPathHowTo'

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

/* ---- 가짜 장부 · 이용 권한(0022 판단 흉내 — 진짜 판단은 scripts/db-local/test-0022) ---- */
type Row = { units: number; status: 'reserved' | 'settled' | 'released'; assist: string; feature: string; kind: string }
type Acct = { kind: 'internal' | 'customer'; plan: string; marketing: boolean; active: boolean }
let ledger = new Map<string, Row>()
let limit = 20
/** null = 권한 줄 없음(고객 · 쓸 수 없음) */
let acct: Acct | null = { kind: 'customer', plan: 'growth', marketing: true, active: true }
let ledgerMode: 'ok' | 'not_configured' | 'down' = 'ok'
/** my_ai_access — ok · missing(0022 적용 전) · error(닿지 못함) */
let accessMode: 'ok' | 'missing' | 'error' = 'ok'
/** D-564 os_access.audience(0024) — none(칸 없음 · 0024 전) · internal · customer · down(닿지 못함) */
let audienceMode: 'none' | 'internal' | 'customer' | 'down' = 'none'
let audienceAsked = 0
let configured = true
let settleFails = 0
let ledgerCalls: { fn: string; args: Record<string, unknown> }[] = []
const used = () => [...ledger.values()].filter((r) => r.status !== 'released').reduce((n, r) => n + r.units, 0)
const accountOf = () => {
  const a = acct ?? { kind: 'customer' as const, plan: 'none', marketing: false, active: false }
  return { ...a, limit: a.kind === 'internal' ? null : limit }
}
function reserve(a: Record<string, unknown>) {
  const id = String(a.p_request_id)
  const units = Number(a.p_units)
  const acc = accountOf()
  const lim = acc.limit
  const row = ledger.get(id)
  if (row) {
    if (row.assist !== a.p_assist_id) return { state: 'conflict' }
    if (row.status === 'reserved') return { state: 'inflight' }
    if (row.status === 'settled') return { state: 'done' }
  }
  if (acc.kind === 'customer' && !acc.active) return { state: 'inactive' }
  if (a.p_feature === 'marketing' && !acc.marketing) return { state: 'not_entitled' }
  if (acc.kind === 'customer' && lim !== null && used() + units > lim) return { state: 'quota', used: used(), limit: lim }
  if (row) {
    row.status = 'reserved'
    row.units = units
    return { state: 'retry', used: used(), limit: lim }
  }
  ledger.set(id, { units, status: 'reserved', assist: String(a.p_assist_id), feature: String(a.p_feature), kind: acc.kind })
  return { state: 'new', used: used(), limit: lim }
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
  if (url.includes('/rest/v1/os_access?select=audience')) {
    audienceAsked += 1
    if (audienceMode === 'down') throw new Error('network down')
    if (audienceMode === 'none') return json({ code: '42703', message: 'column os_access.audience does not exist' }, 400)
    return json([{ audience: audienceMode }])
  }
  if (url.includes('/rest/v1/rpc/my_ai_access')) {
    ledgerCalls.push({ fn: 'my_ai_access', args: body })
    if (accessMode === 'missing') return json({ code: 'PGRST202', message: 'Could not find the function public.my_ai_access' }, 404)
    if (accessMode === 'error') throw new Error('network down')
    return json({ ...accountOf(), configured, used: used(), month: '2026-10' })
  }
  const m = /\/rest\/v1\/rpc\/(ai_usage_\w+)$/.exec(url)
  if (m) {
    ledgerCalls.push({ fn: m[1], args: body })
    if (ledgerMode === 'down') throw new Error('network down')
    if (ledgerMode === 'not_configured') return json({ code: 'P0001', message: 'ai_usage_not_configured' }, 400)
    if (body.p_secret !== SECRET) return json({ code: 'P0001', message: 'ai_usage_bad_secret' }, 400)
    if (m[1] === 'ai_usage_reserve') return json(reserve(body))
    const row = ledger.get(String(body.p_request_id))
    if (m[1] === 'ai_usage_settle') {
      if (settleFails > 0) {
        settleFails -= 1
        return json({ message: 'db hiccup' }, 503)
      }
      const n = row && row.status !== 'settled' ? 1 : 0
      if (n && row) row.status = 'settled'
      return json({ settled: n, used: used(), limit: accountOf().limit })
    }
    if (m[1] === 'ai_usage_release') {
      const n = row && row.status === 'reserved' ? 1 : 0
      if (n && row) row.status = 'released'
      return json({ released: n, used: used(), limit: accountOf().limit })
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
  acct = { kind: 'customer', plan: 'growth', marketing: true, active: true }
  ledgerMode = 'ok'
  accessMode = 'ok'
  configured = true
  settleFails = 0
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
  ledger.set(id2, { units: 2, status: 'reserved', assist: 'threads.write', feature: 'marketing', kind: 'customer' })
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

  // SAAS-2.2 되돌린 요청을 같은 번호로 다시 할 때도 그 자리에서 기한 · 마케팅 · 한도를 다시 본다
  setEnv()
  providerFails = true
  const idR = rid()
  await post({ requestId: idR, assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  providerFails = false
  const again2 = async () => {
    __resetAiAssistState()
    calls = []
    return post({ requestId: idR, assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  }
  acct = { kind: 'customer', plan: 'growth', marketing: true, active: false }
  const rExp = await again2()
  acct = { kind: 'customer', plan: 'basic', marketing: false, active: true }
  const rNoMk = await again2()
  acct = { kind: 'customer', plan: 'growth', marketing: true, active: true }
  limit = 1
  const rQuota = await again2()
  limit = 20
  const rOk = await again2()
  check('U10b 되돌린 요청 다시 — 그 사이 기한 끝남 403 · 마케팅 빠짐 403 · 한도 줄어 429(AI 0 · 줄은 released) → 다 맞으면 200 · 한 번만 셈', rExp.statusCode === 403 && rExp.body.code === 'subscription_inactive' && rNoMk.statusCode === 403 && rNoMk.body.code === 'marketing_not_included' && rQuota.statusCode === 429 && rOk.statusCode === 200 && provider().length === 1 && ledger.get(idR)?.status === 'settled' && used() === 2, { e: rExp.body.code, m: rNoMk.body.code, q: rQuota.statusCode, ok: rOk.statusCode, row: ledger.get(idR) })

  setEnv()
  limit = 3
  await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  calls = []
  const over = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  check('U11 한도를 넘으면 — 429 quota_exceeded · 이번 달 사용량 · AI 안 부름 · 장부에 남지 않음', over.statusCode === 429 && over.body.code === 'quota_exceeded' && over.body.used === 2 && over.body.limit === 3 && provider().length === 0 && ledger.size === 1, over.body)
  const small = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: { title: '오늘', today: '2026-10-25', sections: [] } }, PILOT)
  check('U12 남은 1단위로 빠른 정리 단추(1단위)는 됨 — 한도는 단위로', small.statusCode === 200 && used() === 3, { s: small.statusCode, used: used() })

  const TODAY = { title: '오늘', today: '2026-10-25', sections: [] }
  const INTERNAL: Acct = { kind: 'internal', plan: 'internal', marketing: false, active: true }

  setEnv()
  ledgerMode = 'down'
  const down = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: TODAY }, PILOT)
  check('U13 고객 — 장부에 닿지 못하면 503 usage_unreachable · AI 안 부름(세지 않고 쓰는 일 없음)', down.statusCode === 503 && down.body.code === 'usage_unreachable' && provider().length === 0, down.body)

  setEnv()
  const own = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX }, OWNER)
  const ownSt = await status(OWNER)
  check('U14 대표 계정 — 장부를 부르지 않음 · 마케팅 그대로 · 지시문 예전 그대로(김팀장 기준)', own.statusCode === 200 && ledgerCalls.length === 0 && ownSt.body.marketing === true && ownSt.body.usage === null && JSON.stringify(provider()[0]?.body ?? '').includes('김팀장'), { s: own.statusCode, l: ledgerCalls.map((c) => c.fn) })

  setEnv(false)
  const noSecret = await status(PILOT)
  const mk = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  const plain = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: TODAY }, PILOT)
  check('U15 비밀값 빠짐(환경변수 설정 오류) — 마케팅 닫힘(상태 · 직접 호출 403) · 고객의 다른 AI 도 503(기록 없이 실행 0)', noSecret.body.marketing === false && !(noSecret.body.assists as { page: string }[]).some((a) => MARKETING_PAGES.has(a.page)) && mk.statusCode === 403 && mk.body.code === 'usage_setup_needed' && plain.statusCode === 503 && plain.body.code === 'usage_setup_needed' && provider().length === 0 && fnCalls('ai_usage_reserve').length === 0, { m: noSecret.body.marketing, mk: mk.body.code, p: plain.statusCode, n: provider().length })
  acct = INTERNAL
  calls = []
  const plainIn = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: TODAY }, PILOT)
  check('U15b 같은 상황 · 내부 팀장의 일반 AI 는 예전처럼 200(업무가 멈추지 않음) · 예약 안 부름', plainIn.statusCode === 200 && provider().length === 1 && fnCalls('ai_usage_reserve').length === 0, { s: plainIn.statusCode, b: plainIn.body.code })

  setEnv()
  ledgerMode = 'not_configured'
  const nc = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  const nc2 = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: TODAY }, PILOT)
  check('U16 비밀값이 DB 와 다름 · DB 설정 줄 없음 — 고객 마케팅 · 일반 둘 다 503 · AI 안 부름', nc.statusCode === 503 && nc.body.code === 'usage_setup_needed' && nc2.statusCode === 503 && nc2.body.code === 'usage_setup_needed' && provider().length === 0, { nc: nc.body.code, nc2: nc2.statusCode })
  configured = false
  ledgerMode = 'ok'
  const ncSt = await status(PILOT)
  const nc3 = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: TODAY }, PILOT)
  check('U16b 장부 설정 줄이 없다고 권한 조회가 알려 주면 — 상태 마케팅 닫힘 · 고객 일반 503 · 예약 시도도 안 함', ncSt.body.marketing === false && ncSt.body.usage === null && nc3.statusCode === 503 && nc3.body.code === 'usage_setup_needed' && fnCalls('ai_usage_reserve').length === 2 && provider().length === 0, { st: ncSt.body.marketing, s: nc3.statusCode, r: fnCalls('ai_usage_reserve').length })
  acct = INTERNAL
  ledgerMode = 'not_configured'
  configured = true
  calls = []
  const ncIn = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: TODAY }, PILOT)
  check('U16c 같은 상황 · 내부 팀장 일반 AI 는 예전처럼 200(예약 실패는 서버 기록에만)', ncIn.statusCode === 200 && provider().length === 1, { s: ncIn.statusCode, b: ncIn.body.code })

  setEnv()
  const pat = await post({ requestId: rid(), assistId: 'spec.talk', page: 'patent', context: MK_CTX }, PILOT)
  check('U17 특허 명세서(대표 회사 기준)는 장부가 있어도 고객에게 403 forbidden · 장부 안 부름', pat.statusCode === 403 && ledgerCalls.length === 0, { s: pat.statusCode, b: pat.body.code })

  /* ---- 1b. 장부가 고장 나도 고객이 세지 않고 쓰는 길 0(SAAS-2.1 ①) ---- */
  setEnv()
  accessMode = 'error'
  const ae = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: TODAY }, PILOT)
  const aeSt = await status(PILOT)
  check('F1 권한 조회(my_ai_access)가 닿지 못하면 — 503 usage_unreachable · AI 0 · 상태 마케팅 닫힘', ae.statusCode === 503 && ae.body.code === 'usage_unreachable' && provider().length === 0 && aeSt.body.marketing === false, { s: ae.statusCode, b: ae.body.code, st: aeSt.body.marketing })

  setEnv()
  acct = INTERNAL
  ledgerMode = 'down'
  const inDown = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: TODAY }, PILOT)
  check('F2 내부 팀장 · 장부 끊김 · 일반 AI — 예전처럼 200(호환)', inDown.statusCode === 200 && provider().length === 1 && fnCalls('ai_usage_reserve').length === 1, { s: inDown.statusCode, b: inDown.body.code })
  acct = { ...INTERNAL, marketing: true }
  calls = []
  const inMk = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  check('F3 내부 팀장이라도 마케팅은 세야만 — 장부 끊김이면 503 · AI 0', inMk.statusCode === 503 && inMk.body.code === 'usage_unreachable' && provider().length === 0, { s: inMk.statusCode, b: inMk.body.code })

  setEnv()
  accessMode = 'missing'
  const lg = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: TODAY }, PILOT)
  const lgMk = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  const lgSt = await status(PILOT)
  check('F4 0022 적용 전(지금 운영 · 권한 함수 없음 · 0024 도 없음) — 내부 팀장 일반 AI 는 예전처럼 · D-564 마케팅 AI 도 200(세지 않음 · 예약 안 부름) · 상태 마케팅 열림', lg.statusCode === 200 && lgMk.statusCode === 200 && fnCalls('ai_usage_reserve').length === 0 && lgSt.body.marketing === true && (lgSt.body.assists as { page: string }[]).some((a) => MARKETING_PAGES.has(a.page)), { g: lg.statusCode, m: lgMk.statusCode, c: lgMk.body.code, st: lgSt.body.marketing })
  // D-564 0024(고객 구분)만 먼저 들어온 운영 — 외부 고객은 장부 없이 어떤 AI 도 못 쓴다
  setEnv()
  accessMode = 'missing'
  audienceMode = 'customer'
  calls = []
  const lcG = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: TODAY }, PILOT)
  const lcM = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  const lcSt = await status(PILOT)
  check('F4b 장부 없음 + 외부 고객(0024 만) — 일반 · 마케팅 둘 다 503 usage_setup_needed · AI 0 · 상태 마케팅 닫힘', lcG.statusCode === 503 && lcG.body.code === 'usage_setup_needed' && lcM.statusCode === 503 && lcM.body.code === 'usage_setup_needed' && provider().length === 0 && lcSt.body.marketing === false, { g: lcG.statusCode, m: lcM.statusCode, st: lcSt.body.marketing })
  setEnv()
  accessMode = 'missing'
  audienceMode = 'down'
  calls = []
  const ldG = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: TODAY }, PILOT)
  const ldM = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  const ldSt = await status(PILOT)
  check('F4c 장부 없음 + 누구인지 못 물음 — 팀장 일반 AI 는 예전처럼 200 · 마케팅은 503(모르면 열지 않음) · 상태 마케팅 닫힘', ldG.statusCode === 200 && ldM.statusCode === 503 && ldM.body.code === 'usage_unreachable' && provider().length === 1 && ldSt.body.marketing === false, { g: ldG.statusCode, m: ldM.statusCode, c: ldM.body.code, st: ldSt.body.marketing })
  setEnv()
  accessMode = 'missing'
  audienceMode = 'internal'
  audienceAsked = 0
  calls = []
  const liM = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  const liM2 = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  const liSys = String((provider()[0]?.body as { systemInstruction?: { parts?: { text?: string }[] } } | undefined)?.systemInstruction?.parts?.[0]?.text ?? JSON.stringify(provider()[0]?.body ?? ''))
  check('F4d 장부 없음 + 내부 팀장(0024 있음 · internal) — 마케팅 200 · Gemini 로만 · 대표 이름 · 채널 0 · 누구인지는 60초에 한 번만 물음', liM.statusCode === 200 && liM2.statusCode === 200 && provider().length === 2 && provider().every((c) => c.url.includes('generativelanguage')) && !/김상호|김팀장의 경영노트/.test(liSys) && audienceAsked === 1, { m: liM.statusCode, n: provider().length, asked: audienceAsked })
  audienceMode = 'none'

  setEnv()
  acct = INTERNAL
  const inOk = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: TODAY }, PILOT)
  const inRes = fnCalls('ai_usage_reserve')[0]?.args
  const inSt = await status(PILOT)
  check('F5 내부 팀장 · 장부 정상 — 일반 AI 도 장부에 기록(feature general · kind internal) · 한도 없음(limit null)', inOk.statusCode === 200 && inRes?.p_feature === 'general' && [...ledger.values()][0]?.kind === 'internal' && [...ledger.values()][0]?.status === 'settled' && (inOk.body.run as { quota?: { limit: number | null } }).quota?.limit === null && (inSt.body.usage as { kind: string; limit: number | null } | null)?.kind === 'internal' && (inSt.body.usage as { limit: number | null }).limit === null, { s: inOk.statusCode, inRes, u: inSt.body.usage })

  /* ---- 1c. AI 는 됐는데 정산이 실패해도 장부에서 빠지지 않음(SAAS-2.1 ②) ---- */
  setEnv()
  settleFails = 3
  const sid = rid()
  const sf = await post({ requestId: sid, assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  check('S1 정산이 세 번 다 실패 — 답은 그대로 200 · 정산 3번 시도 · 예약 줄이 센 채로 남음(사용량 2) · 되돌리지 않음', sf.statusCode === 200 && fnCalls('ai_usage_settle').length === 3 && fnCalls('ai_usage_release').length === 0 && ledger.get(sid)?.status === 'reserved' && used() === 2 && (sf.body.run as { quota: unknown }).quota === null, { s: sf.statusCode, settle: fnCalls('ai_usage_settle').length, row: ledger.get(sid), q: (sf.body.run as { quota?: unknown })?.quota })
  limit = 3
  const after = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  check('S2 정산 못 한 예약도 한도에 들어감 — 다음 요청이 한도(3)를 넘으면 429(정산 실패로 공짜 사용 0)', after.statusCode === 429 && after.body.code === 'quota_exceeded' && after.body.used === 2, after.body)
  setEnv()
  settleFails = 2
  const sid2 = rid()
  const sf2 = await post({ requestId: sid2, assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  check('S3 정산이 두 번 실패 후 세 번째에 성공 — settled · 답에 사용량', sf2.statusCode === 200 && fnCalls('ai_usage_settle').length === 3 && ledger.get(sid2)?.status === 'settled' && (sf2.body.run as { quota?: { used: number } }).quota?.used === 2, { s: sf2.statusCode, row: ledger.get(sid2) })

  /* ---- 1d. 이용 권한 — 유료 구독자에게만 마케팅(SAAS-2.1 ③) ---- */
  setEnv()
  acct = { kind: 'customer', plan: 'basic', marketing: false, active: true }
  const ne = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  const neSt = await status(PILOT)
  const nePlain = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: TODAY }, PILOT)
  check('E1 마케팅이 빠진 요금제 — 마케팅 403 marketing_not_included · 메뉴 닫힘 · 일반 AI 는 장부에 세고 200', ne.statusCode === 403 && ne.body.code === 'marketing_not_included' && neSt.body.marketing === false && !(neSt.body.assists as { page: string }[]).some((a) => MARKETING_PAGES.has(a.page)) && nePlain.statusCode === 200 && fnCalls('ai_usage_reserve').length === 1, { mk: ne.body.code, st: neSt.body.marketing, p: nePlain.statusCode })

  setEnv()
  acct = { kind: 'customer', plan: 'growth', marketing: true, active: false }
  const ex = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: TODAY }, PILOT)
  const exMk = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  const exSt = await status(PILOT)
  check('E2 이용 기한 끝난 구독자 — 일반 · 마케팅 둘 다 403 subscription_inactive · AI 0 · 상태 마케팅 닫힘 · active false', ex.statusCode === 403 && ex.body.code === 'subscription_inactive' && exMk.statusCode === 403 && exMk.body.code === 'subscription_inactive' && provider().length === 0 && exSt.body.marketing === false && (exSt.body.usage as { active: boolean } | null)?.active === false, { s: ex.body.code, mk: exMk.body.code, st: exSt.body.usage })

  setEnv()
  acct = null
  const none = await post({ requestId: rid(), assistId: 'today.top3', page: 'today', context: TODAY }, PILOT)
  check('E3 권한 줄이 아예 없는 계정(가입만 함) — 403 subscription_inactive · AI 0', none.statusCode === 403 && none.body.code === 'subscription_inactive' && provider().length === 0, none.body)

  setEnv()
  acct = { kind: 'customer', plan: 'growth', marketing: true, active: true }
  const okMk = await post({ requestId: rid(), assistId: 'radar.top5', page: 'radar', context: MK_CTX, brand: BRAND }, PILOT)
  check('E4 마케팅 포함 구독자 — 예약에 feature marketing · 200', okMk.statusCode === 200 && fnCalls('ai_usage_reserve')[0]?.args.p_feature === 'marketing', { s: okMk.statusCode, a: fnCalls('ai_usage_reserve')[0]?.args })

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

  /* ---- 4. 메뉴 스위치(D-564 — 화면은 팀장 등급이면 열림 · AI 단추는 서버 답) ---- */
  setPilotMarketingScreens(false)
  setPilotMarketing('open')
  const closedBefore = ['/marketing', '/marketing/youtube', '/marketing/threads', '/marketing/shorts'].every((p) => isPilotHiddenPath(p))
  setPilotMarketing('closed')
  setPilotMarketingScreens(true)
  const opened = ['/marketing', '/marketing/youtube', '/marketing/threads', '/marketing/shorts'].every((p) => !isPilotHiddenPath(p))
  const stillClosed = ['/tools/content', '/tools/homepage', '/marketing/more', '/patent-venture', '/ai', '/ops/agents', '/studio'].every((p) => isPilotHiddenPath(p)) && !isCustomerMarketingPath('/marketingx') && !isCustomerMarketingPath('/marketing/more')
  const menu = enabledModulesByGroup({ pilot: true }).flatMap((g) => g.items.map((m) => m.key))
  check('N1 대표가 팀장 화면으로 볼 때(화면 스위치 꺼짐) — 서버가 AI 를 열어도 마케팅 주소 모두 닫힘', closedBefore)
  check('N2 팀장 등급 계정(화면 스위치 켜짐) — 서버 AI 답이 닫힘이어도 레이더 · 스레드 · 릴스/틱톡 주소 열림 · 메뉴에 마케팅 · 브랜딩 줄', opened && menu.includes('marketing') && pilotMarketingScreens() && pilotMarketingState() === 'closed', menu)
  check('N3 열려도 홍보 글 · 홈페이지 · 예전 안내 · 다른 대표 화면은 닫힌 채', stillClosed && !menu.includes('agents') && !menu.includes('patent-venture'))
  setPilotMarketingScreens(false)
  check('N4 화면 스위치를 끄면 다시 닫힘(메뉴 · 주소)', isPilotHiddenPath('/marketing/threads') && !enabledModulesByGroup({ pilot: true }).some((g) => g.items.some((m) => m.key === 'marketing')))
  setPilotMarketing('unknown')

  /* ---- 5. D-562 외부 구독 고객 — 전문 모듈 묶음은 메뉴 · 주소에서 닫힌다(대표 · 내부 팀장은 그대로) ---- */
  const { setCustomerAudience, isCustomerAudience } = await import('../../config/customerAudience')
  const { isCustomerHiddenPath } = await import('../../config/moduleRegistry')
  const groupsOf = (pilot: boolean) => enabledModulesByGroup({ pilot }).map((g) => g.group.key)
  const TOOL_PATHS = ['/tools', '/modules', '/tools/policy-funding', '/tools/tax', '/tools/employment', '/tools/startup-tax', '/tools/labcare', '/tools/cretop']
  const KEEP_PATHS = ['/', '/ops/clients', '/ops/clients/abc', '/ops/calendar', '/ops/decide', '/sales/board', '/money', '/settings']
  check('K1 평소(내부 팀장) — 전문 모듈 묶음이 메뉴에 있고 도구 주소가 열림', !isCustomerAudience() && groupsOf(true).includes('modules') && TOOL_PATHS.every((p) => !isPilotHiddenPath(p)), groupsOf(true))
  setCustomerAudience(true)
  check('K2 고객 계정 — 전문 모듈 묶음째 메뉴에서 빠짐 · 오늘 · 고객 · 영업 · 설정 묶음은 그대로', !groupsOf(true).includes('modules') && ['today', 'clients', 'sales', 'settings'].every((k) => groupsOf(true).includes(k as never)), groupsOf(true))
  check('K3 고객 계정 — 전문 모듈 · 도구 주소 8곳 모두 닫힘 · 고객 관리 · 일정 · 영업 관리 · 매출 · 설정 주소는 열림', TOOL_PATHS.every((p) => isPilotHiddenPath(p) && isCustomerHiddenPath(p)) && KEEP_PATHS.every((p) => !isPilotHiddenPath(p)), TOOL_PATHS.filter((p) => !isPilotHiddenPath(p)).concat(KEEP_PATHS.filter((p) => isPilotHiddenPath(p))))
  check('K4 고객 계정 — 영업자 정산 · 1차 미팅 체크리스트도 닫힘(대표 전용 줄)', isPilotHiddenPath('/ops/agents') && isPilotHiddenPath('/sales/first-meeting') && !enabledModulesByGroup({ pilot: true }).some((g) => g.items.some((m) => m.key === 'agents' || m.key === 'first-meeting')))
  check('K5 대표 화면(pilot 아님)은 값이 켜져 있어도 전문 모듈 · 영업자 정산 · 1차 미팅 체크리스트 그대로', groupsOf(false).includes('modules') && enabledModulesByGroup({ pilot: false }).some((g) => g.items.some((m) => m.key === 'agents')) && enabledModulesByGroup({ pilot: false }).some((g) => g.items.some((m) => m.key === 'first-meeting')))
  setPilotMarketingScreens(true)
  check('K6 고객 계정 + 마케팅 화면 열림(D-564 — 팀장 등급이면 열린다) — 레이더 · 스레드 · 릴스 주소는 열리고 전문 모듈은 닫힌 채', ['/marketing', '/marketing/threads', '/marketing/shorts'].every((p) => !isPilotHiddenPath(p)) && isPilotHiddenPath('/tools'))
  setPilotMarketingScreens(false)
  setCustomerAudience(false)
  check('K7 값을 끄면 원래대로(내부 팀장 메뉴 · 주소)', groupsOf(true).includes('modules') && !isPilotHiddenPath('/tools'))

  // ---------- D-563 고객 계정 = 기본 OS 만 — 화면 안에서 전문 모듈로 가는 길도 같이 닫힌다 ----------
  const { customerEntitlements, openEntitlements, CUSTOMER_PLAN_KEY } = await import('../entitlements')
  const { featureUsable } = await import('../../lib/entitlementsStore')
  const { MODULE_CATALOG, FEATURE_CATALOG, BASE_MODULE_KEY } = await import('../../config/productCatalog')
  const { ruleAnswer } = await import('../homeAsk/homeAsk')
  const { basicFlow, CLIENT_FLOW } = await import('../../content/flowSteps')
  const cent = customerEntitlements('2026-11-10')
  const expert = MODULE_CATALOG.filter((m) => m.key !== BASE_MODULE_KEY && !m.includedInBase)
  const TOOL_KEYS = ['policy-funding', 'employment', 'labcare', 'cert-os', 'tax', 'startup-tax', 'cretop', 'homepage', 'content']
  check(
    'K8 고객 요금제(D-563) — 기본 OS 만: 전문 모듈 전부 못 씀 · 기본 OS 와 카탈로그 밖 화면은 그대로',
    CUSTOMER_PLAN_KEY === 'BASIC' && expert.length >= 6 && expert.every((m) => !cent.module(m.key).usable) && cent.module(BASE_MODULE_KEY).usable && cent.feature('없는-기능').usable,
    expert.filter((m) => cent.module(m.key).usable).map((m) => m.key).join(),
  )
  check(
    'K9 고객 요금제 — 도구 9개(정책자금 · 고용 · 연구소 · 인증 · 절세 · 창업감면 · 크레탑 · 홈페이지 · 홍보 글) 모두 못 씀 · 대표(기본값)는 모두 씀',
    TOOL_KEYS.every((k) => FEATURE_CATALOG.some((f) => f.key === k) && !cent.feature(k).usable) && TOOL_KEYS.every((k) => openEntitlements('2026-11-10').feature(k).usable),
    TOOL_KEYS.filter((k) => cent.feature(k).usable).join(),
  )
  const open = openEntitlements('2026-11-10')
  const grantsBefore = featureUsable(open, 'grants')
  setCustomerAudience(true)
  const grantsCustomer = featureUsable(cent, 'grants')
  const policyCustomer = featureUsable(cent, 'policy-funding')
  setCustomerAudience(false)
  check('K10 지원사업 알림 — 평소엔 요금제와 상관없이 열림 · 고객 계정에서만 닫힘 · 값을 끄면 다시 열림', grantsBefore && !grantsCustomer && !policyCustomer && featureUsable(open, 'grants'), `${grantsBefore}/${grantsCustomer}/${policyCustomer}`)
  const baseIn = { question: '한솔 뭐부터?', intents: [] as never[], focus: [{ id: 'c1', name: '한솔테크(주)', picks: [], missingDocs: [] }], today: { overdue: 0, todos: [], hardDue: [], appointments: [] }, nearNames: [] }
  const ansBasic = ruleAnswer({ ...baseIn, basic: true })
  const ansFull = ruleAnswer(baseIn)
  const textOf = (a: { headline?: string; items?: { title?: string; detail?: string }[]; next?: string[] }) => [a.headline ?? '', ...(a.items ?? []).flatMap((x) => [x.title ?? '', x.detail ?? '']), ...(a.next ?? [])].join(' | ')
  check(
    'K11 오늘 대화창 규칙 답 — 고객 계정은 모듈 판정 · 진단서를 약속하지 않음(업체 화면 열기는 그대로) · 대표 답은 예전 그대로',
    !/모듈|판정|진단서/.test(textOf(ansBasic)) && ansBasic.links.c1 === '/ops/clients/c1?tab=smart' && (ansBasic.items ?? []).length === 1 && /모듈/.test(textOf(ansFull)) && /진단서/.test(textOf(ansFull)),
    textOf(ansBasic),
  )
  const { firstUseSteps } = await import('../firstUse')
  const { homeSuggestions } = await import('../homeAsk/homeAsk')
  const fuBasic = firstUseSteps({ clients: [], journal: [], ideas: 0, marketing: false, basic: true })
  const fuFull = firstUseSteps({ clients: [], journal: [], ideas: 0, marketing: false })
  const sugIn = { appointments: [{ clientId: 'c1', clientName: '한솔', daysLeft: 0 }], freshDocs: [{ clientId: 'c2', clientName: '다음' }], recos: [], overdueMoney: 0, hasTodos: false }
  const sugBasic = homeSuggestions({ ...sugIn, basic: true }).map((x) => x.text).join(' | ')
  const sugFull = homeSuggestions(sugIn).map((x) => x.text).join(' | ')
  check(
    'K13 처음 시작 카드 · 대화창 권하는 질문 — 고객 계정은 모듈 · 제안 · 받을 수 있는 것을 약속하지 않음(단계 수는 같음) · 대표는 예전 그대로',
    fuBasic.length === fuFull.length && fuBasic.every((x) => !`${x.title}${x.note}`.includes('모듈')) && fuFull.some((x) => x.note.includes('모듈')) && !/제안|받을 수 있는 것/.test(sugBasic) && sugBasic.includes('다음에 할 일 정리해 줘') && sugFull.includes('받을 수 있는 것 정리해 줘') && sugFull.includes('제안할까요'),
    `${fuBasic.map((x) => x.note).join('/')} || ${sugBasic}`,
  )
  // D-564 고객 계정 — 이름 · 회사를 아직 안 적었으면 처음 시작 카드 맨 앞에 '내 이름 · 회사 적기'(고객에게 가는 글 서명)
  const fuUnnamed = firstUseSteps({ clients: [], journal: [], ideas: 0, marketing: true, basic: true, named: false })
  const fuNamed = firstUseSteps({ clients: [], journal: [], ideas: 0, marketing: true, basic: true, named: true })
  check(
    'K14 처음 시작(D-564) — named 를 주면 맨 앞에 "내 이름 · 회사 적기"(설정으로) · 안 주면(대표 · 내부 팀장) 예전 단계 그대로 · 마케팅을 연 계정은 끝에 "첫 콘텐츠"',
    fuUnnamed[0].key === 'me' && fuUnnamed[0].done === false && fuUnnamed[0].href === '/settings' && fuNamed[0].key === 'me' && fuNamed[0].done === true && fuUnnamed.length === fuFull.length + 2 && fuUnnamed[fuUnnamed.length - 1].key === 'content' && fuFull.every((x) => x.key !== 'me'),
    fuUnnamed.map((x) => `${x.key}:${x.done}`).join(','),
  )
  // D-565 메뉴 안내 — 고객 계정에 보이는 메뉴의 글은 없는 것(전문 모듈 · 판정 · 예상 금액)을 약속하지 않는다 · 모든 메뉴에 네 칸 글
  const { menuGuide, hasMenuGuide, MARKETING_GUIDE_LIST } = await import('../../content/menuGuide')
  const { MODULES } = await import('../../config/moduleRegistry')
  const { menuVideo } = await import('../../config/menuVideos')
  const { shouldAutoOpenTutorial } = await import('../tutorialPrefs')
  const customerMenus = ['today', 'decide', 'calendar', 'client-ops', 'sales', 'money', 'marketing', 'settings', 'help', ...MARKETING_GUIDE_LIST.filter((x) => !x.basicHidden).map((x) => x.key)]
  const badBasic = customerMenus.filter((k) => /모듈|판정|예상 금액|제도를 먼저/.test(Object.values(menuGuide(k, { basic: true })).join(' ')))
  const thin = MODULES.filter((m) => m.enabled).filter((m) => Object.values(menuGuide(m.key, { label: m.label, hint: m.hint })).some((x) => x.trim().length < 8))
  const unwritten = MODULES.filter((m) => m.enabled && !m.key.startsWith('up-') && !hasMenuGuide(m.key)).map((m) => m.key)
  check(
    'K15 메뉴 안내(D-565) — 고객 계정 글에 모듈 · 판정 · 예상 금액 0 · 켜진 메뉴 전부 네 칸 글(8자 이상) · 출시 예정 항목 말고는 따로 쓴 글 · 대표 글은 그대로(고객 관리 "맞는 제도")',
    badBasic.length === 0 && thin.length === 0 && unwritten.length === 0 && menuGuide('client-ops').next.includes('맞는 제도') && !menuGuide('client-ops', { basic: true }).next.includes('제도'),
    `basic=${badBasic.join()} thin=${thin.map((m) => m.key).join()} unwritten=${unwritten.join()}`,
  )
  const autoIn = { access: 'pilot', prefs: {}, today: '2026-11-10', hiddenInAccount: false, shownThisSession: false } as const
  check(
    'K16 안내 영상(D-565) — 외부 구독 고객에게는 내부 팀장용 영상을 저절로 띄우지 않음 · 내부 팀장은 예전처럼 · 메뉴 영상은 화면 안 파일만(바깥 주소 0 · 지금은 비어 있음)',
    shouldAutoOpenTutorial({ ...autoIn, customer: true }) === false && shouldAutoOpenTutorial({ ...autoIn }) === true && shouldAutoOpenTutorial({ ...autoIn, customer: false }) === true && menuVideo('client-ops') === null,
  )
  // 출시 목록 L-5 이용약관 · 개인정보처리방침 초안 — 검토 전에는 링크를 걸지 않고(ready false) · 금액을 지어내지 않고 · 개인정보처리방침에 꼭 있어야 할 칸
  const { LEGAL, TERMS, PRIVACY } = await import('../../content/legal')
  const flat = (d: typeof TERMS) => [d.intro, ...d.sections.flatMap((x) => [x.title, ...x.body])].join('\n')
  const pv = flat(PRIVACY)
  check(
    'K17 약관 초안(L-5) — 검토 전(ready false) · 금액(원) 0 · 개인정보처리방침에 수집 항목 · 보유 기간 · 처리 위탁 · 국외 이전 · 이용자 권리 · 보호책임자 · 주민등록번호를 저장하지 않는다는 말',
    LEGAL.ready === false && !/[0-9][0-9,]*\s*원/.test(flat(TERMS) + pv) && ['수집하는 개인정보', '보유 기간', '처리 위탁', '국외 이전', '이용자의 권리', '보호책임자', '주민등록번호'].every((w) => pv.includes(w)) && TERMS.sections.length >= 10 && PRIVACY.sections.length >= 8,
    `${TERMS.sections.length}/${PRIVACY.sections.length}`,
  )
  // 출시 목록 L-4(D-568) 문의 · 화면 오류 — 보내는 글에 긴 숫자 · 이메일 0 · 주소는 길만 · 새 버전 조각 오류와 잡음은 안 보냄
  const sp = await import('../support')
  const err = new TypeError("Cannot read properties of undefined (reading 'name') — 010-1234-5678 kim@example.com 사업자 123-45-67890")
  const rep = sp.errorReport(err, { path: '/ops/clients/abc?q=김비밀#x', source: 'screen', build: 'index-AbCd.js', viewport: '390x844', agent: 'UA' })
  check(
    'K18 화면 오류 알리기(D-568) — 전화 · 사업자번호 · 이메일 가림 · 화면 주소는 물음표 앞까지만 · 오류 이름 남음 · 새 버전 조각 오류 · 끊김 잡음은 안 보냄',
    !!rep && !/\d{3}-\d{4}-\d{4}|\d{3}-\d{2}-\d{5}|@example/.test(rep.body + JSON.stringify(rep.context)) && rep.body.includes('(숫자)') && rep.body.includes('(이메일)') && rep.body.startsWith('TypeError') && rep.context.path === '/ops/clients/abc' && rep.context.source === 'screen' &&
      sp.errorReport(new Error('Failed to fetch dynamically imported module: /assets/x.js'), { path: '/', source: 'screen' }) === null &&
      sp.errorReport(new TypeError('Failed to fetch'), { path: '/', source: 'promise' }) === null &&
      sp.errorReport(new Error('ResizeObserver loop limit exceeded'), { path: '/', source: 'window' }) === null &&
      sp.errorReport(null, { path: '/', source: 'window' }) === null,
    rep ? `${rep.body.slice(0, 60)} | ${rep.context.path}` : 'null',
  )
  const msg = (over: Record<string, unknown>) => sp.toMessage({ id: 'm1', kind: 'question', body: '글', context: { path: '/a', n: 3 }, created_at: '2026-11-10T01:00:00Z', read_at: null, reply: null, replied_at: null, seen_at: null, ...over })
  check(
    'K19 문의 상태(D-568) — 보냄 → 읽음 → 답장 · 안 본 답장만 셈 · 운영자 안 읽은 수 · 표 없음(0025 전) 구분 · 하루 한도 말 · 모르는 종류는 문의로',
    sp.messageStatus(msg({})).key === 'sent' && sp.messageStatus(msg({ read_at: 'x' })).key === 'read' && sp.messageStatus(msg({ read_at: 'x', reply: '답' })).key === 'replied' &&
      sp.unseenReplies([msg({ reply: '답' }), msg({ reply: '답', seen_at: 'x' }), msg({})]).length === 1 &&
      sp.inboxUnread([sp.toInboxMessage({ id: 'a', read_at: null }), sp.toInboxMessage({ id: 'b', read_at: 'x' })]) === 1 &&
      sp.toInboxMessage({ author_audience: 'customer' }).audience === 'customer' && sp.toInboxMessage({ author_audience: 'x' }).audience === 'internal' &&
      msg({ kind: 'weird' }).kind === 'question' && msg({}).context.n === '3' &&
      sp.isMissingError({ code: 'PGRST205', message: '' }) && sp.isMissingError({ code: '', message: 'Could not find the function public.support_send' }) && !sp.isMissingError({ code: '42501', message: 'permission denied' }) &&
      sp.sendFailReason({ message: 'support_rate_limited' }) === 'limit' && sp.sendFailReason({ code: '42501', message: 'support_not_allowed' }) === 'denied' && sp.sendFailReason({ code: 'PGRST202', message: '' }) === 'missing' && sp.sendFailReason({ message: 'boom' }) === 'failed' &&
      sp.sendFailText('limit').includes('내일') && sp.cleanPath('/a/b?x=1#y') === '/a/b' && sp.scrubText('가 1234567 나') === '가 (숫자) 나' && sp.scrubText('12345 글 2026-11-10') === '12345 글 (숫자)',
  )
  // D-569 기능 안내 — 화면 안 주요 기능(fn-…)에도 네 칸 글 · 화면에 단 열쇠는 전부 글이 있음 · 고객 글에 없는 것을 약속하지 않음
  const { FUNCTION_GUIDES, functionGuidesOf } = await import('../../content/functionGuide')
  const { CLIENT_DETAIL_TABS } = await import('../../config/clientDetailTabs')
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '__tests__' ? [] : walk(join(dir, e.name))) : /\.tsx$/.test(e.name) ? [join(dir, e.name)] : []))
  const usedFn = new Set<string>()
  for (const f of walk('src')) {
    const text = readFileSync(f, 'utf8')
    for (const m of text.matchAll(/data-guide="(fn-[a-z-]+)/g)) usedFn.add(m[1])
    // 중괄호 안(조건에 따라 다른 열쇠)은 그 안의 열쇠를 전부
    for (const b of text.matchAll(/data-guide=\{([^}]*)\}/g)) for (const m of b[1].matchAll(/['`](fn-[a-z-]+)/g)) usedFn.add(m[1])
  }
  for (const t of CLIENT_DETAIL_TABS) usedFn.add(`fn-client-${t.key}`)
  for (const k of ['revenue', 'cost', 'subs']) usedFn.add(`fn-money-${k}`)
  for (const k of ['board', 'meeting', 'proposal', 'strategy']) usedFn.add(`fn-sales-tab-${k}`)
  usedFn.delete('fn-sales-tab-')
  usedFn.delete('fn-client-')
  usedFn.delete('fn-money-')
  const fnKeys = Object.keys(FUNCTION_GUIDES)
  const fnMissing = [...usedFn].filter((k) => !FUNCTION_GUIDES[k])
  const fnThin = fnKeys.filter((k) => (['what', 'why', 'effect', 'next'] as const).some((x) => FUNCTION_GUIDES[k][x].length < 12) || !FUNCTION_GUIDES[k].label)
  const menuKeys = new Set(['top', ...enabledModulesByGroup({ advanced: true, pilot: false }).flatMap((g) => g.items.map((m) => m.key)), ...MARKETING_GUIDE_LIST.map((x) => x.key)])
  const fnNoMenu = fnKeys.filter((k) => !menuKeys.has(FUNCTION_GUIDES[k].menu))
  const fnBadBasic = fnKeys.filter((k) => !FUNCTION_GUIDES[k].hiddenForPilot && !FUNCTION_GUIDES[k].onlyOwner && !FUNCTION_GUIDES[k].basicHidden).filter((k) => /모듈|판정|예상 금액|제도/.test(Object.values(menuGuide(k, { basic: true })).join(' ')))
  check(
    'K20 기능 안내(D-569) — 화면에 단 열쇠(fn-…)는 전부 글이 있음 · 네 칸 12자 이상 · 메뉴에 이어짐 · 고객 글에 모듈 · 판정 · 제도 0 · 팀장에게 없는 탭(고객 플랫폼 · 컨설팅 · AI 전략실)은 팀장 안내에서 빠짐 · 대표 글은 그대로',
    fnMissing.length === 0 && fnThin.length === 0 && fnNoMenu.length === 0 && fnBadBasic.length === 0 && usedFn.size >= 50 && functionGuidesOf('sales').length === 5 &&
      !functionGuidesOf('client-ops', { pilot: true }).some((x) => ['fn-client-portal', 'fn-client-consulting', 'fn-client-ai'].includes(x.key)) &&
      !functionGuidesOf('client-ops', { pilot: true, basic: true }).some((x) => x.key === 'fn-client-funding') &&
      functionGuidesOf('client-ops').length === CLIENT_DETAIL_TABS.length + 8 && functionGuidesOf('decide').length === 2 && functionGuidesOf('calendar').length === 3 && functionGuidesOf('today').length === 4 && functionGuidesOf('mk-threads').length === 5 && functionGuidesOf('mk-plan').length === 1 && functionGuidesOf('mk-shorts').length === 1 && functionGuidesOf('mk-week').length === 2 && functionGuidesOf('mk-make').length === 2 && functionGuidesOf('mk-top').length === 1 && functionGuidesOf('mk-basics').length === 4 && functionGuidesOf('settings', { pilot: true, basic: true }).some((x) => x.key === 'fn-export') && functionGuidesOf('settings', { pilot: true, basic: true }).some((x) => x.key === 'fn-textscale') && menuGuide('fn-client-smart').what.includes('제도') && !menuGuide('fn-client-smart', { basic: true }).what.includes('제도') && hasMenuGuide('fn-search'),
    `missing=${fnMissing.join()} thin=${fnThin.join()} nomenu=${fnNoMenu.join()} basic=${fnBadBasic.join()} used=${usedFn.size}`,
  )
  const bf = basicFlow(CLIENT_FLOW)
  check(
    'K12 업체 일 순서 안내 — 고객 계정 문장에 모듈 0 · 단계 수 · 순서는 같음 · 원래 문장은 그대로',
    bf.steps.length === CLIENT_FLOW.steps.length && bf.steps.every((st, i2) => st.key === CLIENT_FLOW.steps[i2].key) && bf.steps.every((st) => !st.why.includes('모듈')) && CLIENT_FLOW.steps.some((st) => st.why.includes('모듈')),
    bf.steps.filter((st) => st.why.includes('모듈')).map((st) => st.key).join(),
  )

  /* K22 — D-583 올리는 법(채널별 걸음) — 쉬운 말 · 짧은 걸음 */
  {
    const all = Object.values(POSTING_HOWTO)
    const text = all.map((h) => [h.label, h.need, h.tip, ...h.steps].join(' ')).join(' ') + HOWTO_NOTE
    const longStep = all.flatMap((h) => h.steps.map((s2) => ({ k: h.key, s: s2 }))).filter((x) => x.s.length > 48)
    check(
      'K22 올리는 법 — 다섯 채널(스레드 · 릴스 · 틱톡 · 쇼츠 · 유튜브) · 걸음 4 ~ 5개 · 한 걸음 48자 안 · 어려운 말(롱폼 · 썸네일 · 캡션 · 해시태그 · 포맷 · 훅 · 벤치마킹) 0 · 마지막 걸음은 올렸다고 표시',
      all.length === 5 && all.every((h) => h.steps.length >= 4 && h.steps.length <= 5 && h.need.length > 5 && h.tip.length > 10) && longStep.length === 0 && !/롱폼|썸네일|캡션|해시태그|포맷|훅|벤치마킹/.test(text) && all.filter((h) => h.key !== 'youtube').every((h) => h.steps[h.steps.length - 1].includes('올렸어요')) && POSTING_HOWTO.youtube.steps[4].includes('게시 완료'),
      JSON.stringify({ n: all.length, longStep }),
    )
  }

  /* K21 — D-582 여러 업체 한 번에 등록(엑셀에서 붙여넣기) */
  {
    // ① 제목 줄 있는 엑셀 복사(탭) — 칸 순서가 뒤섞여도 제목으로 찾는다
    const t1 = splitPaste('전화번호\t상호\t대표자\t사업자등록번호\t업종\r\n010-1234-5678\t한솔테크(주)\t김한솔\t123-45-67890\t제조업\r\n02-123-4567\t다움에너지\t이다움\t2208162517\t\r\n\r\n')
    const g1 = guessColumns(t1)
    const r1 = rowsFromTable(t1, g1)
    check(
      'K21 붙여넣기 — 제목 줄(탭): 칸 순서와 상관없이 회사 · 대표 · 전화 · 사업자등록번호 · 업종 · 번호는 000-00-00000 으로 · 빈 줄 버림',
      g1.header && g1.columns.join() === 'contactPhone,companyName,contactName,businessNumber,industry' && r1.rows.length === 2 && r1.rows[0].companyName === '한솔테크(주)' && r1.rows[0].contactName === '김한솔' && r1.rows[0].contactPhone === '010-1234-5678' && r1.rows[0].businessNumber === '123-45-67890' && r1.rows[0].industry === '제조업' && r1.rows[1].businessNumber === '220-81-62517',
      JSON.stringify({ g1, rows: r1.rows }),
    )
    // ② 제목 줄 없음 — 칸 안의 모양으로(사업자등록번호 · 전화 · 사람 이름 · 회사 말)
    const t2 = splitPaste('김한솔\t한솔테크(주)\t123-45-67890\t010-1234-5678\n이다움\t다움에너지 주식회사\t\t02-123-4567\n박셋\t셋째산업\t111-22-33333\t')
    const g2 = guessColumns(t2)
    const r2 = rowsFromTable(t2, g2)
    check('K21 붙여넣기 — 제목 줄 없음: 모양으로 칸을 찾음(첫 줄을 제목으로 먹지 않음 · 3곳)', !g2.header && g2.columns.join() === 'contactName,companyName,businessNumber,contactPhone' && r2.rows.length === 3 && r2.rows[2].companyName === '셋째산업', JSON.stringify(g2))
    // ③ 회사 이름이 '대표' 로 시작해도 제목 줄로 보지 않는다(첫 업체가 통째로 빠지면 안 된다)
    const t3 = splitPaste('대표상사\t김대표\n이름테크\t박이름')
    const g3 = guessColumns(t3)
    check('K21 붙여넣기 — "대표상사" · "이름테크" 는 제목 줄이 아님(2곳 그대로)', !g3.header && rowsFromTable(t3, g3).rows.length === 2 && rowsFromTable(t3, g3).rows[0].companyName === '대표상사', JSON.stringify(g3))
    // ④ 한 줄에 한 곳(이름만) · 쉼표(CSV · 따옴표 안 쉼표)
    const t4 = splitPaste('가나상사\n다라마트\n바사식당')
    const r4 = rowsFromTable(t4, guessColumns(t4))
    const t5 = splitPaste('회사명,대표,전화\n"한솔, 테크",김한솔,010-1234-5678\n다움에너지,이다움,')
    const r5 = rowsFromTable(t5, guessColumns(t5))
    check('K21 붙여넣기 — 이름만 한 줄씩 3곳 · CSV 는 따옴표 안 쉼표를 한 칸으로', r4.rows.length === 3 && r4.rows[1].companyName === '다라마트' && r5.rows.length === 2 && r5.rows[0].companyName === '한솔, 테크' && r5.rows[0].contactPhone === '010-1234-5678', JSON.stringify({ r4: r4.rows, r5: r5.rows }))
    // ⑤ 틀린 번호는 넣지 않는다 · 회사 이름이 빈 줄은 뺀다 · 한도
    const t6 = splitPaste('상호\t사업자번호\t연락처\n가나상사\t12345\t전화없음\n\t111-22-33333\t010-0000-0000')
    const r6 = rowsFromTable(t6, guessColumns(t6))
    const many = splitPaste(Array.from({ length: PASTE_MAX_ROWS + 5 }, (_, i) => `업체${i + 1}상사`).join('\n'))
    const r7 = rowsFromTable(many, guessColumns(many))
    check('K21 붙여넣기 — 열 자리가 아닌 번호 · 전화 모양이 아닌 글은 비움 · 이름 없는 줄 뺌 · 한 번에 200곳(넘는 줄 수 알림)', r6.rows.length === 1 && r6.rows[0].businessNumber === '' && r6.rows[0].contactPhone === '' && r6.noName === 1 && r7.rows.length === PASTE_MAX_ROWS && r7.over === 5, JSON.stringify({ r6, over: r7.over }))
    // ⑦ D-584 업체 목록 내려받기(CSV) — 제목 줄 · 쉼표/따옴표 감싸기 · 식으로 읽히는 첫 글자 막기 · 보관한 업체 빼기 · 그대로 붙여넣으면 다시 읽힘
    {
      const mk7 = (id: string, companyName: string, extra: Record<string, unknown> = {}) => normalizeClientOps({ id, workspaceId: 'w', companyName, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...extra })
      const recs = [
        mk7('a', '한솔, 테크(주)', { contactName: '김한솔', contactPhone: '010-1111-2222', businessNumber: '123-45-67890', industry: '제조업', nextAction: '서류 "받기"', nextActionDueDate: '2026-11-20' }),
        mk7('b', '다움에너지', { status: 'waiting', contactPhone: '+82-10-3333-4444' }),
        mk7('c', '보관한상사', { archivedAt: '2026-11-02T00:00:00Z' }),
        mk7('d', '=1+1상사'),
      ]
      const { csv, count } = clientsCsv(recs)
      const lines = csv.trim().split('\r\n')
      const back = splitPaste(csv)
      const gBack = guessColumns(back)
      const rBack = rowsFromTable(back, gBack)
      const quotedName = csv.includes('"한솔, 테크(주)"')
      const doubledQuote = csv.includes('"서류 ""받기"""')
      const guarded = csv.includes("'=1+1상사") && csv.includes("'+82-10-3333-4444")
      check(
        "K21 내려받기(CSV) — 제목 줄 11칸 · 보관한 업체 빼고 3곳 · 쉼표 든 이름은 따옴표 · 따옴표는 두 번 · = + 로 시작하면 앞에 ' · 잠재고객 구분 · 그대로 붙여넣으면 3곳 다시 읽힘(회사 · 대표 · 전화 · 번호 · 업종)",
        lines[0] === CLIENTS_CSV_HEADER.join(',') && CLIENTS_CSV_HEADER.length === 11 && count === 3 && lines.length === 4 && !csv.includes('보관한상사') && quotedName && doubledQuote && guarded && csv.includes(',잠재고객,') && gBack.header && gBack.columns.slice(0, 5).join() === 'companyName,contactName,contactPhone,businessNumber,industry' && rBack.rows.length === 3 && rBack.rows.some((r) => r.companyName === '한솔, 테크(주)' && r.contactName === '김한솔' && r.businessNumber === '123-45-67890' && r.industry === '제조업'),
        JSON.stringify({ lines, g: gBack, n: rBack.rows.length, quotedName, doubledQuote, guarded }),
      )
    }
    // ⑥ 이미 있는 업체 · 목록 안에서 겹치는 줄은 건너뛴다(번호가 서로 다르면 다른 회사)
    const mkRec = (id: string, companyName: string, businessNumber: string) => normalizeClientOps({ id, workspaceId: 'w', companyName, businessNumber, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z' })
    const existing = [mkRec('a', '한솔테크', '123-45-67890'), mkRec('b', '(주)다움에너지', '')]
    const t8 = splitPaste('한솔테크(주)\t123-45-67890\n다움에너지\t\n새로운상사\t999-88-77777\n주식회사 새로운상사\t999-88-77777\n새로운상사\t555-44-33333\n넷째기업\t')
    const p8 = planBulk(rowsFromTable(t8, guessColumns(t8)).rows, existing)
    const line8 = bulkSummaryLine(p8, { noName: 0, over: 0 })
    check(
      'K21 붙여넣기 — 이미 있는 업체 2곳 건너뜀(번호 · 이름) · 목록 안 같은 번호 1곳 건너뜀 · 이름은 같아도 번호가 다르면 따로 등록 · 한 줄 요약',
      p8.dupes.length === 2 && p8.repeats.length === 1 && p8.add.map((r) => r.companyName).join() === '새로운상사,새로운상사,넷째기업' && line8.includes('등록할 곳 3') && line8.includes('이미 있어 건너뛸 곳 2') && line8.includes('목록 안에서 겹치는 곳 1'),
      JSON.stringify({ add: p8.add.map((r) => [r.companyName, r.businessNumber]), dupes: p8.dupes.length, repeats: p8.repeats.length, line8 }),
    )
  }

  /* K23 — D-585 엑셀 파일 그대로(여러 업체 등록 창 [엑셀 파일 고르기]) */
  {
    const asFile = (name: string, buf: ArrayBuffer | Uint8Array, type = '') => {
      const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
      return { name, type, size: bytes.byteLength, arrayBuffer: async () => bytes.slice().buffer as ArrayBuffer }
    }
    // ① 엑셀 — 표 위에 제목 · 날짜 줄이 있어도 제목 줄부터 읽는다
    const xlsx = await makeSimpleXlsx([
      ['거래처 목록', '', '', ''],
      ['2026년 11월', '', '', ''],
      ['회사명', '대표자', '전화', '사업자등록번호'],
      ['한솔테크(주)', '김한솔', '010-1234-5678', '123-45-67890'],
      ['다움에너지', '이다움', '02-123-4567', ''],
      ['셋째상사', '', '', '555-44-33333'],
    ])
    const f1 = await readBulkFile(asFile('거래처.xlsx', xlsx))
    const t1 = f1.ok ? splitPaste(f1.text) : []
    const g1 = guessColumns(t1)
    const r1 = rowsFromTable(t1, g1)
    check(
      'K23 파일 — 엑셀(.xlsx): 표 위 제목 2줄을 빼고 제목 줄부터 · 3곳 · 칸을 알아서 · 한 줄 안내(파일 이름 · 줄 수 · 뺀 줄)',
      f1.ok && f1.rows === 4 && g1.header && g1.columns.join() === 'companyName,contactName,contactPhone,businessNumber' && r1.rows.length === 3 && r1.rows[0].businessNumber === '123-45-67890' && f1.note.includes('거래처.xlsx') && f1.note.includes('4줄') && f1.note.includes('2줄(제목)은 뺐어요'),
      JSON.stringify({ f1, g1 }),
    )
    // ② 옛 한글 방식(EUC-KR) CSV — 엑셀에서 'CSV(쉼표로 분리)' 로 저장한 파일
    const euc = Uint8Array.of(0xc8, 0xb8, 0xbb, 0xe7, 0xb8, 0xed, 0x2c, 0xc0, 0xfc, 0xc8, 0xad, 0x0a, 0xc7, 0xd1, 0xbc, 0xd6, 0x2c, 0x30, 0x32, 0x2d, 0x31, 0x32, 0x33, 0x2d, 0x34, 0x35, 0x36, 0x37)
    const f2 = await readBulkFile(asFile('목록.csv', euc, 'text/csv'))
    const t2 = f2.ok ? splitPaste(f2.text) : []
    const r2 = rowsFromTable(t2, guessColumns(t2))
    // ③ 이 프로그램이 내려받은 CSV(맨 앞 BOM)를 그대로 다시 고르기
    const { csv } = clientsCsv([normalizeClientOps({ id: 'x', workspaceId: 'w', companyName: '한솔, 테크(주)', contactName: '김한솔', contactPhone: '010-1111-2222', businessNumber: '123-45-67890', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z' })])
    const f3 = await readBulkFile(asFile('업체목록-2026-11-11.csv', new TextEncoder().encode(`﻿${csv}`)))
    const t3 = f3.ok ? splitPaste(f3.text) : []
    const r3 = rowsFromTable(t3, guessColumns(t3))
    check(
      'K23 파일 — 옛 한글 방식 CSV 도 깨지지 않게(회사명 · 전화) · 내려받은 CSV(BOM · 따옴표 안 쉼표)를 다시 고르면 그대로 1곳',
      f2.ok && r2.rows.length === 1 && r2.rows[0].companyName === '한솔' && r2.rows[0].contactPhone === '02-123-4567' && f3.ok && r3.rows.length === 1 && r3.rows[0].companyName === '한솔, 테크(주)' && r3.rows[0].businessNumber === '123-45-67890' && decodeTableBytes(Uint8Array.of(0xff, 0xfe, 0x41, 0x00)) === 'A',
      JSON.stringify({ f2, r2: r2.rows, f3, r3: r3.rows }),
    )
    // ④ 못 읽는 파일은 까닭을 말한다(막지 않고 붙여넣기로 안내) — 형식 · 크기 · 깨진 엑셀 · 빈 파일
    const bad1 = await readBulkFile(asFile('사진.png', Uint8Array.of(1, 2, 3)))
    const bad2 = await readBulkFile({ name: '큰목록.csv', type: 'text/csv', size: BULK_FILE_MAX_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(0) })
    const bad3 = await readBulkFile(asFile('깨진.xlsx', Uint8Array.of(0x50, 0x4b, 0x03, 0x04, 0, 0, 0)))
    const bad4 = await readBulkFile(asFile('빈.csv', new TextEncoder().encode('\n\n')))
    check(
      'K23 파일 — 못 읽는 파일: 형식(.png) · 5MB 넘음 · 깨진 엑셀 · 빈 파일 모두 까닭 한 줄(파일 이름 포함) · 받는 확장자 5가지',
      !bad1.ok && bad1.reason.includes('사진.png') && !bad2.ok && bad2.reason.includes('너무 커요') && !bad3.ok && bad3.reason.includes('붙여넣어') && !bad4.ok && bad4.reason.includes('빈.csv') && BULK_FILE_ACCEPT.split(',').length === 5 && bulkFileKind('a.XLSX') === 'xlsx' && bulkFileKind('a.xls') === 'xls' && bulkFileKind('a.tsv') === 'text' && bulkFileKind('a.hwp') === null,
      JSON.stringify({ bad1, bad2, bad3, bad4 }),
    )
    // ⑤ 제목 줄이 없는 표 · 첫 줄이 이미 제목 줄인 표는 한 줄도 버리지 않는다 · 시트 이름이 붙은 글은 첫 시트만
    const noHead = splitPaste('한솔테크(주)\t123-45-67890\n회사명\t전화\n다움\t02-123-4567')
    const headFirst = splitPaste('회사명\t전화\n한솔\t02-123-4567')
    const sheet = firstSheetOfText('[거래처]\n회사명\t전화\n한솔\t02-1\n\n[메모]\n아무 글')
    check(
      'K23 파일 — 번호가 먼저 나오면 제목 줄 없는 표(버린 줄 0) · 첫 줄이 제목 줄이면 그대로 · 시트 이름 붙은 글은 첫 시트만(2장 · 이름)',
      dropTitleRows(noHead).dropped === 0 && dropTitleRows(headFirst).dropped === 0 && dropTitleRows(splitPaste('목록\t\n회사명\t전화\n한솔\t02-123-4567')).dropped === 1 && sheet.sheets === 2 && sheet.name === '거래처' && sheet.body === '회사명\t전화\n한솔\t02-1' && firstSheetOfText('회사명\t전화').sheets === 1,
      JSON.stringify({ a: dropTitleRows(noHead).dropped, b: dropTitleRows(headFirst).dropped, sheet }),
    )
  }

  /* K24 — D-586 휴대폰 '이 화면 안내'(머리줄 화면 이름 → 그 화면 안내 열쇠) */
  {
    const k = (p: string, q = '') => guideKeyForPath(p, q)
    check(
      'K24 화면 안내 열쇠 — 마케팅 안 화면은 주소 · ?view= 로(스레드 · 릴스 · 기초 · 유튜브 주제/남의 영상/내 콘텐츠 · 홍보 글 · 홈페이지) · 마케팅 첫 화면은 마케팅',
      k('/marketing/threads') === 'mk-threads' && k('/marketing/shorts') === 'mk-shorts' && k('/marketing/basics') === 'mk-basics' && k('/marketing/youtube') === 'mk-plan' && k('/marketing/youtube', '?view=plan') === 'mk-plan' && k('/marketing/youtube', '?view=top') === 'mk-top' && k('/marketing/youtube', '?view=channels') === 'mk-top' && k('/marketing/youtube', '?view=make&x=1') === 'mk-make' && k('/tools/content') === 'mk-content' && k('/tools/homepage/abc') === 'mk-homepage' && k('/marketing') === 'marketing',
      JSON.stringify([k('/marketing/threads'), k('/marketing/youtube'), k('/marketing/youtube', '?view=top'), k('/marketing'), k('/tools/content')]),
    )
    // 왼쪽 메뉴에 보이는 화면은 전부 열쇠가 있고, 그 열쇠로 네 칸 글이 나온다(빈 칸 0) — 업체 화면(깊은 주소)도 고객 관리 안내
    const menus = enabledModulesByGroup({ advanced: true, pilot: false }).flatMap((g) => g.items).filter((m) => m.path && m.path.startsWith('/'))
    const holes = menus.filter((m) => {
      const key = k(m.path.split('?')[0], m.path.includes('?') ? `?${m.path.split('?')[1]}` : '')
      if (!key) return true
      const g = menuGuide(key, { label: m.label, hint: m.hint })
      return !g.what || !g.why || !g.effect || !g.next
    })
    const clientKey = k('/ops/clients/abc123')
    check(
      'K24 화면 안내 열쇠 — 메뉴에 보이는 화면 전부 열쇠 · 네 칸 글(빈 칸 0) · 업체 화면(깊은 주소) = 고객 관리 안내 + 이 화면 안 기능 8개 이상(고객 계정에도 6개 이상)',
      menus.length >= 20 && holes.length === 0 && clientKey === 'client-ops' && functionGuidesOf('client-ops', { pilot: false, basic: false }).length >= 8 && functionGuidesOf('client-ops', { pilot: true, basic: true }).length >= 6,
      JSON.stringify({ n: menus.length, holes: holes.map((m) => m.path).slice(0, 8), clientKey, fns: functionGuidesOf('client-ops', { pilot: true, basic: true }).length }),
    )
  }

  /* K25 — D-587 홈 화면에 넣는 법(기기별 걸음) · 매니페스트 */
  {
    const all = HOME_HOWTO.flatMap((h) => [h.need, h.tip, ...h.steps]).join(' ')
    const manifest = JSON.parse(readFileSync(join(process.cwd(), 'public/manifest.webmanifest'), 'utf8')) as { display: string; start_url: string; short_name: string; icons: Array<{ src: string; sizes: string; purpose?: string }> }
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')
    const iconFiles = ['public/apple-touch-icon.png', ...manifest.icons.map((i) => `public${i.src}`)].map((f) => readFileSync(join(process.cwd(), f)))
    const isPng = (b: Buffer) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
    check(
      'K25 홈 화면에 넣는 법 — 세 기기(아이폰 · 갤럭시 · PC) · 걸음 3 ~ 4개 · 한 걸음 60자 안 · 휴대폰 둘은 [홈 화면에 추가] · 카카오톡에서 연 화면 안내 · 알림 한 줄',
      HOME_HOWTO.map((h) => h.key).join() === 'iphone,android,pc' && HOME_HOWTO.every((h) => h.steps.length >= 3 && h.steps.length <= 4 && h.steps.every((s) => s.length <= 60) && h.need.length > 0 && h.tip.length > 0) && HOME_HOWTO.filter((h) => h.key !== 'pc').every((h) => h.steps.join(' ').includes('[홈 화면에 추가]') && h.tip.includes('카카오톡')) && HOME_HOWTO_NOTE.includes('비슷한 말') && !/PWA|매니페스트|설치/.test(all),
      JSON.stringify(HOME_HOWTO.map((h) => [h.key, h.steps.length, Math.max(...h.steps.map((s) => s.length))])),
    )
    check(
      'K25 매니페스트 — 브라우저에서 그대로 열림(display browser — 로그인 유지) · 시작 주소 / · 짧은 이름 12자 안 · 아이콘 192 · 512(PNG 파일 있음) · index.html 에 manifest · 애플 아이콘 · 이름',
      manifest.display === 'browser' && manifest.start_url === '/' && manifest.short_name.length <= 12 && manifest.icons.some((i) => i.sizes === '192x192') && manifest.icons.some((i) => i.sizes === '512x512') && manifest.icons.some((i) => i.purpose === 'maskable') && iconFiles.every(isPng) && html.includes('<link rel="manifest" href="/manifest.webmanifest" />') && html.includes('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />') && html.includes('apple-mobile-web-app-title') && !html.includes('apple-mobile-web-app-capable'),
      JSON.stringify({ d: manifest.display, n: manifest.short_name, icons: manifest.icons.map((i) => i.sizes) }),
    )
  }

  /* K26 — D-588 프로필 소개 글(채널별 초안 세 가지 · 규칙) */
  {
    const full: BioInput = { name: '박 컨설턴트', field: '정책자금 컨설팅', helps: '정책자금 · 고용지원금 · 기업부설연구소', audience: '제조업 중소기업 대표', contact: '문의는 프로필 링크로', fact: '2015년부터 중소기업 상담' }
    const sns = bioDrafts(full, 'sns')
    const tik = bioDrafts(full, 'tiktok')
    const yt = bioDrafts(full, 'youtube')
    const allText = [...sns, ...tik, ...yt].map((d) => d.text).join('\n')
    check(
      'K26 프로필 소개 글 — 채널 셋(150 · 80 · 1,000자) · 초안 세 가지씩 서로 다름 · 전부 한도 안 · 이름 · 분야 · 고객 · 연락 받는 길이 들어감 · [대괄호] 0 · 부풀리는 말 0',
      BIO_CHANNELS.map((c) => `${c.key}:${c.limit}`).join() === 'sns:150,tiktok:80,youtube:1000' && [sns, tik, yt].every((ds) => ds.length === 3 && new Set(ds.map((d) => d.text)).size === 3 && ds.every((d) => !d.over && d.length === [...d.text].length)) && sns.every((d) => d.length <= 150 && d.text.includes('박 컨설턴트') && d.text.includes('문의는 프로필 링크로')) && tik.every((d) => d.length <= 80) && yt[0].text.includes('제조업 중소기업 대표를 위한 정책자금 컨설팅 채널입니다.') && yt[0].text.includes('2015년부터 중소기업 상담') && !allText.includes('[') && consultLint(allText).length === 0,
      JSON.stringify({ sns: sns.map((d) => [d.key, d.length, d.over]), tik: tik.map((d) => [d.length, d.text]), yt: yt.map((d) => d.length) }),
    )
    // 빈 칸은 [대괄호] 로 — 지어내지 않는다 · 어느 칸이 비었는지 알려 준다(사실 한 줄은 비워도 됨)
    const empty: BioInput = { name: '', field: '', helps: '', audience: '', contact: '', fact: '' }
    const e1 = bioDrafts(empty, 'sns')
    const partial = bioDrafts({ ...empty, name: '이 대표', helps: '절세' }, 'sns')
    check(
      'K26 프로필 소개 글 — 빈 칸은 [이름] · [분야] · [도와주는 일] · [주요 고객] · [연락 받는 길] 로(숫자 · 경력을 지어내지 않음) · 빈 칸 이름 5개 · 사실 한 줄은 빠져도 됨',
      e1.every((d) => d.text.includes('[이름]') && d.text.includes('[연락 받는 길]')) && e1[0].text.includes('[주요 고객]') && e1[1].text.includes('[도와주는 일]') && e1[1].text.includes('[분야]') && !/\d/.test(e1.map((d) => d.text).join('')) && bioBlanks(empty).length === 5 && bioBlanks(full).length === 0 && bioBlanks({ ...full, fact: '' }).length === 0 && partial[2].text.includes('이 대표가 하나씩') && partial[1].text.includes('· 절세'),
      JSON.stringify({ e: e1.map((d) => d.text), blanks: bioBlanks(empty), p: partial[2].text }),
    )
    // 길면 덜 중요한 것부터 뺀다(사실 한 줄 → 도와주는 일 수) · 그래도 넘으면 넘는다고 표시 · 조사(받침) · 내 브랜드에서 재료
    const longFact = bioDrafts({ ...full, fact: `${'2015년부터 중소기업 대표님들과 정책자금 · 고용지원금 · 연구소 설립을 함께 준비해 온 사람입니다. '.repeat(2)}정말 긴 소개` }, 'sns')
    const tooLong = bioDrafts({ ...full, contact: '문의는 '.padEnd(170, '가') }, 'sns')
    const fromBrand = bioInputFromBrand({ name: '', company: '○○경영컨설팅', industry: '노무 컨설팅', specialties: '고용지원금, 취업규칙', audience: '소상공인 사장님', tone: '', intro: '', facts: '공인노무사 · 2012년 개업', avoid: '', ending: '궁금한 점은 댓글로 남겨 주세요.', benchmarks: '' })
    check(
      'K26 프로필 소개 글 — 긴 사실 한 줄은 빼고 한도 안 · 연락 받는 길이 너무 길면 "넘어요" 표시 · 조사(을/를 · 이/가 · 받침 없으면 라면) · 내 브랜드에서 재료(댓글 인사는 연락 받는 길로 안 씀 · 사실 첫 줄)',
      longFact.every((d) => !d.over && d.length <= 150 && !d.text.includes('정말 긴 소개')) && tooLong.every((d) => d.over) && josa('대표', '을', '를') === '대표를' && josa('사장님', '을', '를') === '사장님을' && josa('[이름]', '이', '가') === '[이름]이(가)' && bioDrafts({ ...full, audience: '소상공인 사장님' }, 'sns')[2].text.startsWith('소상공인 사장님이라면,') && sns[2].text.startsWith('제조업 중소기업 대표라면,') && fromBrand.name === '○○경영컨설팅' && fromBrand.contact === '' && fromBrand.fact === '공인노무사' && fromBrand.helps === '고용지원금, 취업규칙' && bioDrafts(fromBrand, 'sns')[1].text.includes('· 취업규칙'),
      JSON.stringify({ lf: longFact.map((d) => [d.length, d.over, d.text.includes('정말 긴 소개')]), tl: tooLong.map((d) => d.over), j: [josa('대표', '을', '를'), josa('사장님', '을', '를'), josa('[이름]', '이', '가')], a: bioDrafts({ ...full, audience: '소상공인 사장님' }, 'sns')[2].text.slice(0, 20), b: sns[2].text.slice(0, 20), c: bioDrafts(fromBrand, 'sns')[1].text, fromBrand }),
    )
  }

  /* K27 — D-589 바로 보이는 첫 화면(index.html) */
  {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')
    const app = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8')
    const root = /<div id="root">([\s\S]*?)<\/div>\s*<script>/.exec(html)?.[1] ?? ''
    check(
      'K27 첫 화면 — #root 안에 로고 · 제품 이름 · 불러오는 중 · 느릴 때 안내(처음엔 숨김) · 모양(.boot)은 index.html 안에(스크립트 · 스타일 파일 없이 그려짐) · 앱의 불러오는 중 화면도 같은 모양 · 밖에서 불러오는 것 0',
      root.includes('data-testid="boot-splash"') && root.includes('불러오는 중…') && root.includes('/favicon.svg') && /id="boot-slow" hidden/.test(root) && html.includes('.boot {') && html.includes("getElementById('boot-slow')") && app.includes('className="boot"') && app.includes('className="boot-msg"') && !/https?:\/\//.test(root),
      root.slice(0, 200),
    )
  }

  /* K28 — D-590 로그인 화면 가볍게(앱 뼈대 · 화면 틀을 첫 조각에서 떼기) */
  {
    const src = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
    const staticImports = (code: string) => [...code.matchAll(/^import\s+(?!type\b)[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1])
    const app = staticImports(src('src/App.tsx'))
    const supa = staticImports(src('src/app/SupabaseApp.tsx'))
    const routes = staticImports(src('src/app/appRouteChildren.tsx'))
    const chunks = src('src/app/shellChunks.ts')
    const heavy = (list: string[]) => list.filter((p) => /layout\/AppShell|appRouteChildren|toolClientContext|ModuleRoute|chat\/ChatFirst|pages\/AxOpenPage|pages\/EmptyModulePage/.test(p))
    check(
      'K28 첫 조각(App.tsx)은 앱 뼈대 · 화면 목록을 바로 받지 않음 · 로그인 앱(SupabaseApp)은 뼈대를 바로 받지 않음 · 화면 목록은 화면 틀을 바로 받지 않음(전부 필요할 때) · 뼈대와 함께 받는 조각 4개',
      heavy(app).length === 0 && !supa.some((p) => /layout\/AppShell/.test(p)) && heavy(routes).length === 0 && (chunks.match(/import\('/g) ?? []).length === 4 && /layout\/AppShell/.test(chunks) && /toolClientContext/.test(chunks) && /ModuleRoute/.test(chunks) && /ChatFirst/.test(chunks),
      JSON.stringify({ app: heavy(app), supa: supa.filter((p) => /AppShell/.test(p)), routes: heavy(routes) }),
    )
    // 로그인해 둔 브라우저만 미리 받는다 — 저장된 로그인 표(sb-…-auth-token)의 이름만 본다(값은 읽지 않는다)
    const store = new Map<string, string>()
    const g = globalThis as unknown as { localStorage?: unknown }
    const before = g.localStorage
    g.localStorage = { get length() { return store.size }, key: (i: number) => [...store.keys()][i] ?? null, getItem: (k: string) => store.get(k) ?? null }
    const none = hasSavedSignIn()
    store.set('axmvp.ui.preferences', '{}')
    const other = hasSavedSignIn()
    store.set('sb-abcdefghijklmnop-auth-token', '{"x":1}')
    const signed = hasSavedSignIn()
    g.localStorage = { get length(): number { throw new Error('막힘') }, key: () => null }
    const blocked = hasSavedSignIn()
    g.localStorage = before
    check('K28 미리 받기 — 로그인 표가 없으면 안 받음 · 다른 저장 값만 있어도 안 받음 · sb-…-auth-token 이 있으면 받음 · 저장 공간이 막혀도 죽지 않음(안 받음)', none === false && other === false && signed === true && blocked === false, JSON.stringify({ none, other, signed, blocked }))
  }

  /* K29 — D-591 여러 업체 등록: 이메일 · 주소 칸 */
  {
    // ① 제목 줄로 — 이메일 · 주소(소재지) 칸을 찾아 업체 줄에 넣는다 · 이메일 모양이 아니면 비운다
    const t1 = splitPaste('상호\t대표자\tE-mail\t소재지\n한솔테크(주)\t김한솔\thansol@example.com\t경기도 성남시 분당구 판교로 1\n다움에너지\t이다움\t메일없음\t\n')
    const g1 = guessColumns(t1)
    const r1 = rowsFromTable(t1, g1)
    // ② 제목 줄 없이 모양으로 — 주소 칸이 회사 이름으로 잡히지 않고, '서울정밀(주)' 같은 이름은 주소로 잡히지 않는다
    const t2 = splitPaste('서울정밀(주)\t서울특별시 강남구 테헤란로 12\tkim@seoul.co.kr\t02-123-4567\n경기산업\t경기 화성시 동탄대로 5\tlee@gg.kr\t031-111-2222\n부산상사\t부산광역시 해운대구 센텀로 9\tpark@bs.kr\t051-333-4444')
    const g2 = guessColumns(t2)
    const r2 = rowsFromTable(t2, g2)
    check(
      'K29 이메일 · 주소 — 제목 줄(E-mail · 소재지)로 찾음 · 이메일 모양이 아니면 비움 / 제목 줄 없이 모양으로(주소 칸 ≠ 회사 이름 · "서울정밀(주)" ≠ 주소) · 3곳 다 이메일 · 주소 · 전화',
      g1.header && g1.columns.join() === 'companyName,contactName,contactEmail,businessAddress' && r1.rows[0].contactEmail === 'hansol@example.com' && r1.rows[0].businessAddress === '경기도 성남시 분당구 판교로 1' && r1.rows[1].contactEmail === '' && r1.rows[1].businessAddress === '' && !g2.header && g2.columns.join() === 'companyName,businessAddress,contactEmail,contactPhone' && r2.rows.length === 3 && r2.rows[0].companyName === '서울정밀(주)' && r2.rows[2].businessAddress === '부산광역시 해운대구 센텀로 9' && r2.rows[1].contactEmail === 'lee@gg.kr',
      JSON.stringify({ g1, r1: r1.rows, g2, r2: r2.rows.map((r) => [r.companyName, r.businessAddress, r.contactEmail]) }),
    )
    // ③ 요약 아래 한 줄 · 이메일 다듬기 · 내려받은 CSV 를 다시 읽어도 이메일 · 주소가 돌아온다
    const recs = [normalizeClientOps({ id: 'm', workspaceId: 'w', companyName: '메일상사', contactEmail: 'ceo@mail.kr', businessAddress: '대전 유성구 대학로 99, 3층', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z' })]
    const { csv } = clientsCsv(recs)
    const back = splitPaste(csv)
    const gb = guessColumns(back)
    const rb = rowsFromTable(back, gb)
    check(
      'K29 이메일 · 주소 — 요약 아래 한 줄(이메일 n곳 · 주소 n곳) · 없으면 빈 글 · 이메일 다듬기 · 내려받은 CSV(제목 줄 11칸 · 쉼표 든 주소는 따옴표)를 다시 읽으면 이메일 · 주소 그대로',
      bulkExtrasLine(r2.rows) === '이메일 3곳 · 주소 3곳도 같이 넣어요' && bulkExtrasLine(r1.rows) === '이메일 1곳 · 주소 1곳도 같이 넣어요' && bulkExtrasLine(rowsFromTable(splitPaste('가나상사\n다라마트'), guessColumns(splitPaste('가나상사\n다라마트'))).rows) === '' && tidyEmail(' a@b.co ') === 'a@b.co' && tidyEmail('a@b') === '' && tidyEmail('없음') === '' && CLIENTS_CSV_HEADER.length === 11 && csv.includes('"대전 유성구 대학로 99, 3층"') && rb.rows.length === 1 && rb.rows[0].contactEmail === 'ceo@mail.kr' && rb.rows[0].businessAddress === '대전 유성구 대학로 99, 3층',
      JSON.stringify({ csv, gb, rb: rb.rows }),
    )
  }

  /* K30 — D-592 찾기에서 화면 · 기능 이름으로도 */
  {
    const { setCustomerAudience } = await import('../../config/customerAudience')
    const owner = guideGroupsFor({ advanced: true, pilot: false, caps: new Set(), basic: false, pilotMarketing: false })
    const find = (groups: ReturnType<typeof guideGroupsFor>, opts: { pilot?: boolean; basic?: boolean }, q: string) => searchScreens(q, groups, opts)
    const o = (q: string) => find(owner, {}, q)
    check(
      'K30 찾기 화면 · 기능(대표) — "스레드" 첫 줄 = 스레드 화면 · "프로필소개"(붙여 써도) → 프로필 소개 글 만들기(기초 7가지 화면) · "엑셀" → 여러 업체 등록(고객 관리) · "정산" → 영업자 정산 · "홈 화면" → 넣는 법(사용법 안내) · "찾기" → 안내 글 · 한 글자 · 빈 말 · 없는 말은 0 · 여섯 줄까지',
      o('스레드')[0]?.path === '/marketing/threads' && o('스레드')[0]?.kind === 'screen' &&
        o('프로필소개')[0]?.label === '프로필 소개 글 만들기' && o('프로필소개')[0]?.path === '/marketing/basics' && o('프로필 소개')[0]?.sublabel.includes('고객 모으기 기초 7가지') &&
        o('엑셀')[0]?.path === '/ops/clients' && o('엑셀')[0]?.kind === 'function' &&
        o('정산')[0]?.path === '/ops/agents' &&
        o('홈 화면')[0]?.path === '/guide' && o('홈 화면')[0]?.label === '휴대폰 홈 화면에 넣는 법' &&
        o('찾기')[0]?.path === '/guide?m=fn-search' &&
        o('글').length === 0 && o('  ').length === 0 && o('없는말없는말').length === 0 && o('서류').length <= 6 && o('서류').length >= 3 &&
        squashForSearch('프로필 소개 · 글(만들기)') === '프로필소개글만들기',
      JSON.stringify({ a: o('스레드').map((h) => h.path), b: o('프로필소개'), c: o('엑셀'), d: o('정산'), e: o('홈 화면'), f: o('찾기'), n: o('서류').length }),
    )
    setCustomerAudience(true)
    setPilotMarketingScreens(true)
    const cust = guideGroupsFor({ advanced: false, pilot: true, caps: new Set(), basic: true, pilotMarketing: true })
    const c = (q: string) => find(cust, { pilot: true, basic: true }, q)
    const all = ['스레드', '일정', '서류', '엑셀', '프로필', '내려받기', '오늘', '고객', '영업', '매출', '설정', '문의', '마케팅', '유튜브', '릴스'].flatMap((q) => c(q))
    check(
      'K30 찾기 화면 · 기능(고객 계정) — 닫힌 것(정책자금 · 정산 · 체크리스트 · 절세 · 연구소 · 홈페이지 만들기)은 0 · 열린 것(스레드 · 일정 · 엑셀 · 프로필)은 찾아짐 · 가는 주소가 전부 열린 주소 · 설명 글에 모듈 · 판정 · 예상 금액 0',
      ['정책자금', '정산', '체크리스트', '절세', '연구소', '고용지원금', '홈페이지 만들기', '크레탑'].every((q) => c(q).length === 0) &&
        c('스레드')[0]?.path === '/marketing/threads' && c('일정')[0]?.path === '/ops/calendar' && c('엑셀')[0]?.path === '/ops/clients' && c('프로필')[0]?.path === '/marketing/basics' &&
        all.length >= 15 && all.every((h) => !isPilotHiddenPath(h.path.split('?')[0])) && all.every((h) => !/모듈|판정|예상 금액/.test(`${h.label} ${h.sublabel}`)),
      JSON.stringify({ closed: ['정책자금', '정산', '체크리스트', '절세', '연구소', '고용지원금', '홈페이지 만들기', '크레탑'].map((q) => [q, c(q).map((h) => h.label)]), bad: all.filter((h) => isPilotHiddenPath(h.path.split('?')[0]) || /모듈|판정|예상 금액/.test(`${h.label} ${h.sublabel}`)) }),
    )
    setCustomerAudience(false)
    setPilotMarketingScreens(false)
  }

  /* K31 — D-593 새로 생긴 것 */
  {
    const { setCustomerAudience } = await import('../../config/customerAudience')
    setCustomerAudience(true)
    setPilotMarketingScreens(true)
    const closedForCustomer = WHATS_NEW.filter((x) => x.path && isPilotHiddenPath(x.path.split('?')[0]))
    setPilotMarketingScreens(false)
    const closedNoMarketing = whatsNewFor({ marketingOpen: false }).filter((x) => x.path && isPilotHiddenPath(x.path.split('?')[0]))
    setCustomerAudience(false)
    const ids = WHATS_NEW.map((x) => x.id)
    const sorted = [...WHATS_NEW].sort((a, b) => b.date.localeCompare(a.date)).map((x) => x.id)
    const bad = WHATS_NEW.filter((x) => /모듈|판정|예상 금액|롱폼|썸네일|벤치마킹|캡션|해시태그|포맷|훅/.test(`${x.title} ${x.how} ${x.cta ?? ''}`) || x.title.length < 8 || x.how.length < 12 || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) || (x.path !== undefined && !x.path.startsWith('/')))
    check(
      'K31 새로 생긴 것(D-593) — 열 개까지 · 최근 것이 위 · 열쇠 겹침 0 · 고객 글(모듈 · 판정 · 예상 금액 · 업계 말 0) · 갈 화면은 전부 고객에게 열린 주소 · 마케팅이 닫힌 계정에는 마케팅 줄 빠짐(닫힌 주소 0) · 날짜 "11월 11일"',
      WHATS_NEW.length >= 5 && WHATS_NEW.length <= WHATS_NEW_MAX && new Set(ids).size === ids.length && ids.join() === sorted.join() && bad.length === 0 && closedForCustomer.length === 0 && closedNoMarketing.length === 0 &&
        whatsNewFor({ marketingOpen: false }).every((x) => !x.marketing) && whatsNewFor({ marketingOpen: true }).length === WHATS_NEW.length && whatsNewFor({ marketingOpen: false }).length < WHATS_NEW.length &&
        whatsNewDateLabel('2026-11-11') === '11월 11일' && whatsNewDateLabel('2026-01-05') === '1월 5일' && whatsNewDateLabel('언젠가') === '언젠가' && hasMenuGuide('fn-whats-new'),
      JSON.stringify({ n: WHATS_NEW.length, bad: bad.map((x) => x.id), closed: closedForCustomer.map((x) => x.id), closed2: closedNoMarketing.map((x) => x.id), order: ids.join() === sorted.join() }),
    )
  }

  /* K32 — D-594 앱 안 브라우저(카카오톡 · 네이버 · 인스타그램 …) 알아보기 · 바깥 브라우저로 여는 길 */
  {
    const UA = {
      kakaoIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5',
      kakaoAnd: 'Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36;KAKAOTALK 2410850',
      naver: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.6.5)',
      insta: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 337.0.3.23.54 (iPhone15,2; iOS 17_5; ko_KR; ko; scale=3.00; 1179x2556; 612345678)',
      threads: 'Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 Barcelona 337.0.0.30.109 Android',
      fb: 'Mozilla/5.0 (Linux; Android 14; SM-S918N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.31.107;]',
      line: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.9.0',
      safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      chrome: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      samsung: 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
      pc: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      ipadLine: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15 Outline/1.0',
    }
    const kinds = Object.fromEntries(Object.entries(UA).map(([k, ua]) => [k, inAppBrowserOf(ua)]))
    const href = 'https://os.example.com/login?next=%2Fops%2Fclients'
    const kUrl = externalOpenUrl('kakaotalk', href, UA.kakaoIos)
    const aUrl = externalOpenUrl('naver', href, UA.naver)
    check(
      'K32 앱 안 브라우저(D-594) — 카카오톡(아이폰 · 갤럭시) · 네이버 · 인스타그램 · 스레드 · 페이스북 · 라인은 알아봄 · 사파리 · 크롬 · 삼성 인터넷 · PC · 빈 글은 아님("Outline" 은 라인이 아님) · 이름표 6개 · 카카오톡은 앱이 주는 길(주소 그대로 감쌈) · 갤럭시의 다른 앱은 크롬으로 여는 길 · 아이폰의 다른 앱은 길 없음(null) · http(s) 아닌 주소는 null',
      kinds.kakaoIos === 'kakaotalk' && kinds.kakaoAnd === 'kakaotalk' && kinds.naver === 'naver' && kinds.insta === 'instagram' && kinds.threads === 'threads' && kinds.fb === 'facebook' && kinds.line === 'line' &&
        kinds.safari === null && kinds.chrome === null && kinds.samsung === null && kinds.pc === null && kinds.ipadLine === null && inAppBrowserOf('') === null &&
        Object.keys(IN_APP_LABEL).length === 6 && Object.values(IN_APP_LABEL).every((x) => x.length >= 2) &&
        kUrl === `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}` && decodeURIComponent(kUrl.split('url=')[1]) === href &&
        aUrl === 'intent://os.example.com/login?next=%2Fops%2Fclients#Intent;scheme=https;package=com.android.chrome;end' &&
        externalOpenUrl('instagram', href, UA.insta) === null && externalOpenUrl('line', href, UA.line) === null &&
        externalOpenUrl('kakaotalk', 'javascript:alert(1)', UA.kakaoIos) === null && externalOpenUrl('naver', 'file:///etc/passwd', UA.naver) === null,
      JSON.stringify({ kinds, kUrl, aUrl }),
    )
    check(
      'K32 한 번만 쓰는 표가 붙은 주소(비밀번호 재설정 · 이메일 확인 · code)에서는 안내하지 않음 — 표가 든 주소를 넘기거나 복사하게 하지 않는다 · 보통 주소(로그인 · 초대 · ?next=)는 그대로 안내',
      hasOneTimeToken('https://os.example.com/reset-password#access_token=abc&refresh_token=def&type=recovery') && hasOneTimeToken('https://os.example.com/auth/callback?code=xyz') && hasOneTimeToken('https://os.example.com/#type=recovery') && hasOneTimeToken('https://os.example.com/x?token_hash=1&type=signup') &&
        !hasOneTimeToken('https://os.example.com/login') && !hasOneTimeToken('https://os.example.com/login?next=%2Fops%2Fclients') && !hasOneTimeToken('https://os.example.com/join/abcd1234') && !hasOneTimeToken('https://os.example.com/guide?m=fn-search') && !hasOneTimeToken('https://os.example.com/marketing/youtube?view=plan&type=recoveryx'),
    )
  }

  /* K33 — D-595 링크 미리보기 그림 */
  {
    const html = readFileSync('index.html', 'utf8')
    const meta = (prop: string) => new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`).exec(html)?.[1] ?? ''
    const png = readFileSync('public/og-image.png')
    const isPng = png.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
    const w = png.readUInt32BE(16)
    const h = png.readUInt32BE(20)
    check(
      'K33 링크 미리보기(D-595) — 그림 주소가 통째로(https · 운영 주소 · /og-image.png) · 가로 1200 세로 630(머리 글과 파일이 같음) · PNG · 300KB 아래 · 제목 · 설명 · 큰 그림 카드 · 그림 설명 글',
      meta('og:image') === 'https://os.miraeailab.com/og-image.png' && meta('og:image:width') === '1200' && meta('og:image:height') === '630' && isPng && w === 1200 && h === 630 && png.length > 10_000 && png.length < 300_000 &&
        meta('og:title').length > 3 && meta('og:description').length > 10 && meta('twitter:card') === 'summary_large_image' && meta('og:image:alt').length > 5,
      JSON.stringify({ image: meta('og:image'), w, h, bytes: png.length, isPng }),
    )
  }

  /* K34 — D-596 연락 받는 길 만드는 법 */
  {
    const all = CONTACT_PATHS.flatMap((c) => [c.label, c.fit, c.need, ...c.steps, c.bioLine, c.tip]).join('\n')
    const bad = CONTACT_PATHS.filter((c) => c.steps.length < 3 || c.steps.length > 5 || c.steps.some((s) => s.length < 12 || s.length > 70) || c.fit.length < 10 || c.need.length < 5 || c.tip.length < 10 || !c.bioLine.startsWith('문의'))
    // 프로필 소개 글에 넣었을 때: '문의: 문의…' 처럼 겹치지 않고, 채울 곳은 [대괄호] 로 남는다
    const bioWith = (line: string) => bioDrafts({ name: '박 컨설턴트', field: '정책자금 컨설팅', helps: '정책자금', audience: '제조업 대표', contact: line, fact: '' }, 'youtube')[0].text
    check(
      'K34 연락 받는 길 만드는 법(D-596) — 세 가지(오픈채팅 · 채널 · 전화) · 길마다 3~5걸음(한 줄에 한 동작) · 이런 분께 · 준비물 · 알아 두면 · 업계 말 0 · 가짜 번호를 그대로 넣지 않음(채울 곳은 [대괄호]) · 소개 글에 넣어도 "문의" 가 겹치지 않음 · 앱이 바뀔 때 한 줄 · 다음 길(잠재고객) 한 줄',
      CONTACT_PATHS.length === 3 && CONTACT_PATHS.map((c) => c.key).join() === 'openchat,channel,phone' && bad.length === 0 && !/롱폼|썸네일|벤치마킹|캡션|해시태그|포맷|훅|DM|CTA/.test(all) &&
        !/010-\d{4}-\d{4}/.test(CONTACT_PATHS.map((c) => c.bioLine).join()) && CONTACT_PATHS.find((c) => c.key === 'phone')!.bioLine.includes('[전화번호]') && CONTACT_PATHS.find((c) => c.key === 'channel')!.bioLine.includes('[채널 이름]') &&
        CONTACT_PATHS.every((c) => !/문의[:：]\s*문의/.test(bioWith(c.bioLine)) && bioWith(c.bioLine).includes(c.bioLine)) && CONTACT_PATH_NOTE.includes('비슷한 말') && CONTACT_PATH_AFTER.includes('잠재고객') && hasMenuGuide('fn-mk-contact'),
      JSON.stringify({ bad: bad.map((c) => c.key), sample: bioWith(CONTACT_PATHS[0].bioLine).slice(-60) }),
    )
  }

  console.log(`\nsaas-usage: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

void run().catch((e) => {
  console.error(e)
  process.exit(1)
})
