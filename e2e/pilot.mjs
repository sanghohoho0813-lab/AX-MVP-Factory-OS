/**
 * 1인 Pilot 교차 시험 (D-162) — **진짜 RLS** 위에서 화면을 누른다.
 *
 *   로컬 PostgreSQL(axe2e: 마이그레이션 0001~0019 + pilot_provision.sql 그대로) ← PostgREST ← 브라우저
 *   로그인 · 보관함 응답만 흉내 내고, 표 읽기 · 쓰기 · RPC 는 모두 PostgREST 를 거쳐 DB 의 RLS 가 판단한다.
 *
 *   한 브라우저를 사람이 돌려 쓴다(저장소 재사용 시험): 대표 → 공개 사이트 가입자 → Pilot → (다시) Pilot → 대표
 *   [교차] 대표 업체 주소 · ?client=대표업체 · 검색 · 달력 · 오늘 · 알림 · 업무 일기 · 숨긴 화면 주소 · 뒤로 가기 · REST 직접 호출
 *   [흐름] 첫 업체 → 서류 올리기(읽기 · 회사정보) → 다음 약속 → 할 일 → 업무 일기 → 계약 · 수금 → 로그아웃 → 다시 로그인
 *   [휴대폰] 390 — 하단 메뉴 · 더보기 메뉴 · 화면 넘침
 *
 *   sudo node e2e/pilot.mjs [스크린샷 폴더]      (pg_ctlcluster 16 main start 먼저 · PostgREST 가 없으면 .cache 에 내려받는다)
 */
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const SHOTS = process.argv[2] ?? ''
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const REF = 'qapilot'
const PORT = Number(process.env.PILOT_PORT ?? 4537)
const PGRST_PORT = Number(process.env.PGRST_PORT ?? 4536)
const E2E_DB = process.env.AXE2E_DB ?? 'axe2e'
const BASE = `http://localhost:${PORT}`
const OUT = process.env.PILOT_OUT ?? 'dist-qa-pilot'
const SECRET = 'e2e-local-jwt-secret-at-least-32-characters-long'
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + (typeof detail === 'object' ? JSON.stringify(detail) : String(detail)).slice(0, 400)}`)
}

const OWNER = { id: '0e000000-0000-4000-8000-0000000000a1', email: 'owner@e2e.kr', password: 'owner-pass' }
const PILOT = { id: '0e000000-0000-4000-8000-0000000000b1', email: 'pilot@e2e.kr', password: 'pilot-pass' }
const OUTSIDER = { id: '0e000000-0000-4000-8000-0000000000c1', email: 'outsider@e2e.kr', password: 'outsider-pass' }
// D-562 외부 구독 고객 — supabase/manual/customer_provision.sql 그대로(이메일만 바꿔) 준비한다(아래 '고객 계정' 묶음)
const CUSTOMER = { id: '0e000000-0000-4000-8000-0000000000d1', email: 'customer@e2e.kr', password: 'customer-pass' }
const USERS = [OWNER, PILOT, OUTSIDER, CUSTOMER]
const OWNER_WS = '0e0000aa-0000-4000-8000-00000000000a'
const OWNER_CLIENT = 'owner-secret-1'
// D-171: 대표가 직접 만든 업무 항목(세무기장 · 모두의 창업 2차)도 팀장 화면 · 응답에 나오면 안 된다
const SECRETS = ['대표비밀', '김비밀', '111-22-33333', '010-1111-2222', '세무기장', '모두의 창업 2차']

// ---------- DB · PostgREST ----------
execSync('bash scripts/db-local/e2e-pilot-db.sh', { stdio: 'ignore' })
const sql = (q) => execSync(`su postgres -c "psql -At -q -d ${E2E_DB}"`, { input: q }).toString().trim()
const PILOT_WS = sql(`select id from public.workspaces where owner_id = '${PILOT.id}'`)
check('준비: pilot_provision.sql 로 Pilot 작업공간 하나 · 업체 0', PILOT_WS.length === 36 && sql(`select count(*) from public.operations_clients where workspace_id = '${PILOT_WS}'`) === '0', PILOT_WS)
check('준비: 0019 씨앗 — 대표 full · Pilot pilot · 가입자 없음', sql(`select string_agg(tier || ':' || user_id, ',' order by tier) from public.os_access`) === `full:${OWNER.id},pilot:${PILOT.id}`)
// D-171: 대표 작업공간에만 직접 만든 업무 항목 두 개(대표가 실제로 쓰는 이름 그대로)
sql(`insert into public.ops_custom_services (workspace_id, key, label, short_label, sort_order) values ('${OWNER_WS}', 'custom_d171tax', '세무기장', '세무기장', 101), ('${OWNER_WS}', 'custom_d171start', '모두의 창업 2차', '모두의 창업', 102) on conflict (workspace_id, key) do nothing`)
// D-195: 대표 작업공간의 콘텐츠 레이더 기록(수첩 아이디어 · 숨긴 주제) — 팀장에게는 화면도 REST 도 안 보여야 한다
sql(`insert into public.module_data (id, workspace_id, module_key, bucket, payload) values ('idea_qa_owner_mkt', '${OWNER_WS}', 'marketing', 'ideas', '{"topic":"대표비밀 콘텐츠 주제","status":"selected","key":"axai:claude"}'::jsonb), ('radarprefs_${OWNER_WS}', '${OWNER_WS}', 'marketing', 'radar_prefs', '{"muted":["axai:claude"]}'::jsonb) on conflict (id) do nothing`)
check('준비(D-195): 대표 작업공간에 콘텐츠 레이더 기록 2줄(수첩 · 설정)', sql(`select count(*) from public.module_data where workspace_id = '${OWNER_WS}' and module_key = 'marketing'`) === '2')
check('준비(D-171): 대표 작업공간에 직접 만든 업무 항목 2개', sql(`select count(*) from public.ops_custom_services where workspace_id = '${OWNER_WS}' and key like 'custom_d171%'`) === '2')

let PGRST = process.env.POSTGREST_BIN ?? '.cache/postgrest/postgrest'
if (!existsSync(PGRST)) {
  mkdirSync('.cache/postgrest', { recursive: true })
  execSync('curl -sSL -o .cache/postgrest/p.tar.xz https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz && tar xf .cache/postgrest/p.tar.xz -C .cache/postgrest')
  PGRST = '.cache/postgrest/postgrest'
}
const pgrst = spawn(PGRST, [], {
  stdio: 'ignore',
  detached: true,
  env: { ...process.env, PGRST_DB_URI: `postgres://authenticator:e2e-local@127.0.0.1:5432/${E2E_DB}`, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: SECRET, PGRST_SERVER_PORT: String(PGRST_PORT), PGRST_DB_POOL: '5' },
})

execSync(`npx vite build --outDir ${OUT} --emptyOutDir`, {
  stdio: 'ignore',
  env: { ...process.env, VITE_DATA_MODE: 'supabase', VITE_SUPABASE_URL: `https://${REF}.supabase.co`, VITE_SUPABASE_ANON_KEY: 'qa-anon' },
})
const server = spawn('npx', ['vite', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true })
const stop = () => {
  for (const p of [server, pgrst]) {
    try {
      process.kill(-p.pid)
    } catch {
      /* 이미 꺼짐 */
    }
  }
}
for (let i = 0; i < 60; i += 1) {
  try {
    const [a, b] = await Promise.all([fetch(BASE), fetch(`http://127.0.0.1:${PGRST_PORT}/`)])
    if (a.ok && b.status < 500) break
  } catch {
    /* 아직 */
  }
  await new Promise((r) => setTimeout(r, 250))
}

// ---------- 로그인 흉내(서명한 JWT 는 PostgREST 가 검증한다) ----------
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function jwt(u) {
  const h = b64({ alg: 'HS256', typ: 'JWT' })
  const p = b64({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })
  return `${h}.${p}.${createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`
}
/** 사람별 user_metadata(설정 › 내 정보에서 이름 · 직함 저장) — 로그인 · 새로 받기에도 그대로 */
const meta = new Map()
const userObj = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: meta.get(u.id) ?? {}, created_at: '2026-01-01T00:00:00Z' })
const sessionOf = (u) => ({ access_token: jwt(u), token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: `refresh-${u.id}`, user: userObj(u) })
const whoOf = (auth) => {
  const t = (auth ?? '').replace(/^Bearer /, '')
  return USERS.find((u) => jwt(u) === t) ?? null
}
const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })

// ---------- D-257 AI 도우미 서버 함수(진짜 api/ai-assist.js) — 로그인 확인은 위 흉내, 권한 RPC 는 진짜 PostgREST(DB 가 팀장인지 판단), AI 회사만 가짜 ----------
const { default: assistHandler } = await import(pathToFileURL(path.resolve('api/ai-assist.js')).href)
Object.assign(process.env, { SUPABASE_URL: `https://${REF}.supabase.co`, SUPABASE_ANON_KEY: 'qa-anon', GEMINI_API_KEY: 'gem-pilot-e2e-KEY', ANTHROPIC_API_KEY: 'ant-pilot-e2e-KEY', AI_ASSIST_RATE_PER_MIN: '100', AI_ASSIST_RATE_PER_HOUR: '500' })
const aiCalls = [] // { provider, sys, user }
const rpcCalls = [] // { who, fn, body }
// SAAS-2 서버는 로그인 등급을 60초 기억한다(gate.js) — 화면이 여는 순간 마케팅 열림을 물어(?status=1) 기억이 먼저 채워질 수 있어, '물은 적 있나' 는 지우지 않는 목록으로 본다
const rpcSeen = new Set()
const AI_ANSWER = { headline: '오늘은 서류 마감부터', items: [{ title: '서류 받기', tag: '마감', detail: '내일까지 받아야 신청할 수 있어요' }], next: ['오전에 전화'], caution: '' }
const realFetch = globalThis.fetch
globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  const h = init.headers ?? {}
  if (url.startsWith(`https://${REF}.supabase.co/auth/v1/user`)) {
    const u = whoOf(h.Authorization ?? h.authorization)
    return new Response(JSON.stringify(u ? { id: u.id } : {}), { status: u ? 200 : 401 })
  }
  if (url.startsWith(`https://${REF}.supabase.co/rest/v1/rpc/`)) {
    const fn = url.split('/rpc/')[1]
    rpcCalls.push({ who: whoOf(h.Authorization)?.email ?? 'anon', fn, body: init.body })
    rpcSeen.add(`${whoOf(h.Authorization)?.email ?? 'anon'}:${fn}`)
    return realFetch(`http://127.0.0.1:${PGRST_PORT}/rpc/${fn}`, { method: 'POST', headers: { Authorization: h.Authorization, 'Content-Type': 'application/json' }, body: init.body ?? '{}' })
  }
  if (url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent')) {
    const body = JSON.parse(String(init.body ?? '{}'))
    aiCalls.push({ provider: 'gemini', url, sys: String(body.systemInstruction?.parts?.[0]?.text ?? ''), user: String(body.contents?.[0]?.parts?.map((x) => x.text ?? '').join('\n') ?? '') })
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(AI_ANSWER) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 120 } }), { status: 200 })
  }
  if (url.includes('api.anthropic.com') || url.includes('api.openai.com')) {
    aiCalls.push({ provider: url.includes('anthropic') ? 'anthropic' : 'openai', url, sys: '', user: '' })
    return new Response('{}', { status: 500 })
  }
  return realFetch(input, init)
}
function mkRes() {
  const r = { statusCode: 200, raw: '', body: {}, setHeader() {}, end(b) { r.raw = b ?? ''; try { r.body = JSON.parse(r.raw) } catch { r.body = {} } } }
  return r
}
async function assistRoute(r) {
  const req = r.request()
  const u = new URL(req.url())
  const res = mkRes()
  await assistHandler({ method: req.method(), url: u.pathname + u.search, headers: { authorization: req.headers()['authorization'] ?? '' }, body: req.postData() ?? undefined }, res)
  return r.fulfill({ status: res.statusCode, contentType: 'application/json', body: res.raw })
}
/** 서버 함수를 직접(화면 없이) — 팀장 토큰으로 */
async function assistDirect(u, body) {
  const res = mkRes()
  await assistHandler({ method: 'POST', url: '/api/ai-assist', headers: { authorization: `Bearer ${jwt(u)}` }, body: JSON.stringify(body) }, res)
  return res
}

const uploads = []
let restLog = [] // { who, method, url, body }
let currentWho = null

async function route(r) {
  const req = r.request()
  const url = new URL(req.url())
  const path = decodeURIComponent(url.pathname)
  const method = req.method()
  const headers = req.headers()
  if (path === '/auth/v1/token') {
    const body = JSON.parse(req.postData() ?? '{}')
    const u = url.searchParams.get('grant_type') === 'refresh_token' ? USERS.find((x) => `refresh-${x.id}` === body.refresh_token) : USERS.find((x) => x.email === body.email && x.password === body.password)
    if (!u) return r.fulfill(json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400))
    return r.fulfill(json(sessionOf(u)))
  }
  if (path === '/auth/v1/user') {
    const u = whoOf(headers['authorization'])
    if (!u) return r.fulfill(json({ msg: 'no' }, 401))
    if (method === 'PUT') {
      const body = JSON.parse(req.postData() ?? '{}')
      if (body.data) {
        meta.set(u.id, { ...(meta.get(u.id) ?? {}), ...body.data })
        // 진짜 Supabase 처럼 auth.users 에도 남긴다(0020 의 팀장 이름이 여기서 읽는다)
        sql(`update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '${JSON.stringify(body.data).replace(/'/g, "''")}'::jsonb where id = '${u.id}'`)
      }
    }
    return r.fulfill(json(userObj(u)))
  }
  if (path === '/auth/v1/logout') return r.fulfill({ status: 204, body: '' })
  if (path.startsWith('/storage/v1/')) {
    if (method === 'POST' && path.startsWith('/storage/v1/object/client-documents/')) {
      uploads.push({ who: whoOf(headers['authorization'])?.email ?? 'anon', key: path.slice('/storage/v1/object/client-documents/'.length) })
      return r.fulfill(json({ Key: path.slice('/storage/v1/object/'.length) }))
    }
    if (method === 'POST' && path.startsWith('/storage/v1/object/sign/')) return r.fulfill(json({ signedURL: `/object/sign/x?token=t` }))
    return r.fulfill(json([]))
  }
  if (path.startsWith('/rest/v1/')) {
    const fwd = { ...headers }
    delete fwd['host']
    // 로그인 전에는 anon 키(qa-anon)가 실린다 — 진짜 JWT 가 아니면 떼어 anon 으로
    if (!whoOf(fwd['authorization'])) delete fwd['authorization']
    const target = `http://127.0.0.1:${PGRST_PORT}${path.slice('/rest/v1'.length)}${url.search}`
    const res = await r.fetch({ url: target, headers: fwd })
    const body = await res.text()
    restLog.push({ who: whoOf(fwd['authorization'])?.email ?? 'anon', method, url: path + url.search, body })
    return r.fulfill({ status: res.status(), headers: { ...res.headers(), 'access-control-allow-origin': '*' }, body })
  }
  return r.fulfill(json([]))
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } })
const errors = []

async function login(page, u) {
  currentWho = u
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByLabel('이메일').fill(u.email)
  await page.getByLabel('비밀번호').fill(u.password)
  await page.getByRole('button', { name: /^로그인/ }).click()
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {})
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(900)
}
async function logout(page) {
  const menu = page.getByRole('button', { name: '사용자 메뉴' })
  if (await menu.isVisible().catch(() => false)) {
    await menu.click()
    // D-290 왼쪽 아래에도 [로그아웃](sidebar-signout) — 여기서는 사용자 메뉴 안의 것
    await page.getByTestId('account-signout').click()
  } else {
    await page.getByRole('button', { name: '로그아웃' }).first().click()
  }
  await page.waitForURL((x) => x.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(600)
}
const bodyText = (page) => page.locator('body').innerText().catch(() => '')
const leaked = (t) => SECRETS.filter((s) => t.includes(s))
/** D-357 처음엔 접힌 목차(오늘 '바로 적기' · 맞춤 추천 '다음 행동' …) — 제목 줄을 눌러 펼친다(펼친 상태는 그 기기에 기억) */
async function openFoldIn(page, id) {
  const f = page.locator(`[data-fold="${id}"]`).first()
  await f.waitFor({ timeout: 8000 }).catch(() => {})
  if ((await f.getAttribute('data-open').catch(() => '1')) === '0') {
    await f.getByTestId('fold-toggle').first().click()
    await new Promise((r) => setTimeout(r, 300)) // 동시 보기 안쪽(frameLocator)은 waitForTimeout 이 없다
  }
}

async function go(page, p) {
  await page.goto(BASE + p, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
}
async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
}
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
async function searchFor(page, q) {
  await page.getByRole('button', { name: /^찾기|찾기$/ }).filter({ visible: true }).first().click()
  const box = page.getByPlaceholder('업체 이름 · 대표 · 전화번호 뒷자리 · 도구')
  await box.waitFor({ timeout: 5000 }).catch(() => {})
  await box.fill(q)
  await page.waitForTimeout(800)
  const t = (await page.getByRole('dialog', { name: '빠른 이동 검색' }).innerText().catch(() => '')) ?? ''
  await page.keyboard.press('Escape')
  return t
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  await ctx.route(`https://${REF}.supabase.co/**`, route)
  await ctx.route('**/api/ai-assist**', assistRoute)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))

  /* ================= 1. 대표 — 몇 달 쓴 자료가 보인다 ================= */
  await login(page, OWNER)
  // D-296 대표 "머리줄이 지저분 — 안내 영상 · 고객 플랫폼 · 대표/팀장 단추는 설정 안에서만, PC · Mobile 은 접어서"
  const hdr0 = (await page.locator('header').innerText()) ?? ''
  check('대표(D-185 · D-296): 안내 영상은 저절로 안 뜸 · 머리줄에 안내 영상 · 고객 플랫폼 · 대표/팀장 · 폭 단추 없음 · 보기 방식은 접힌 단추 하나', (await page.getByTestId('tutorial-dialog').count()) === 0 && (await page.getByTestId('tutorial-open').count()) === 0 && !hdr0.includes('고객 플랫폼') && (await page.locator('header [data-testid="view-as-switch"], header [data-testid="view-as-compact"], header [data-testid="content-width"], header [data-testid="device-switch"]').count()) === 0 && (await page.locator('header [data-testid="device-switch-compact"]').count()) === 1, hdr0.replace(/\n/g, '|'))
  await page.setViewportSize({ width: 1100, height: 900 })
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '사용자 메뉴' }).click()
  await page.getByTestId('tutorial-menu-open').click()
  await page.waitForTimeout(400)
  check('대표(D-185): 사용자 메뉴 [안내 영상 보기] 로 열림', (await page.getByTestId('tutorial-dialog').getAttribute('data-auto')) === '0')
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(300)
  await go(page, '/ops/clients')
  const ownerList = await bodyText(page)
  check('대표: 자기 업체가 보인다(대표비밀정밀)', ownerList.includes('대표비밀정밀'), ownerList.slice(0, 300))
  check('대표: 메뉴 그대로(잘 안 쓰는 기능 · 이 시스템 · 영업자 정산)', ['잘 안 쓰는 기능', '이 시스템', '영업자 정산'].every((s) => ownerList.includes(s)))
  await go(page, `/ops/clients/${OWNER_CLIENT}?tab=work`)
  const ownWork = await bodyText(page)
  check('대표(D-171): 내가 만든 업무 항목(세무기장 · 모두의 창업 2차)은 내 화면에 보인다', ownWork.includes('세무기장') && ownWork.includes('모두의 창업'), ownWork.slice(0, 300))
  check('대표(D-188): 내 화면 업무 탭에는 기본 6종(법인설립 · 특허 출원 · AX 기획 및 개발 …) 그대로', ['법인설립', '특허 출원', 'AX 기획 및 개발', '업종 추가'].every((w) => ownWork.includes(w)), ownWork.slice(0, 300))
  // P1 릴리스: 클라우드(진짜 RLS)에서 연구소 관리 기록 → 기업인증 판정 · 진행 기록 · 인증 완료가 DB 로
  sql(`insert into public.module_data (id, workspace_id, module_key, bucket, client_id, payload) values ('qa-lab-orig', '${OWNER_WS}', 'labcare', 'orig', null, '{"key":"pmsaas:clients:v1","value":[{"id":"${OWNER_CLIENT}","labType":"기업부설연구소","labName":"대표비밀연구소","certifiedDate":"2024-05-10","labRegistrationNumber":"2024-777","researcherCount":4}]}'::jsonb) on conflict (id) do nothing`)
  await go(page, `/tools/cert-os?client=${OWNER_CLIENT}&detail=1`)
  await page.waitForTimeout(900)
  check('클라우드(P1): 연구소 관리 기록 → 기업인증 연구소 보유(다시 묻지 않음)', (await page.locator('[data-testid="cert-hero"][data-key="lab"] [data-testid="cert-rec"], [data-testid="cert-row"][data-key="lab"] [data-testid="cert-rec"]').first().getAttribute('data-rec').catch(() => '')) === 'held')
  await go(page, `/tools/cert-os/innobiz?client=${OWNER_CLIENT}`)
  await page.waitForTimeout(700)
  await page.getByTestId('cert-step-2').click()
  // AX: 진행 기록은 접혀 있다(준비 중) — 펼치고 상태를 바꾼다
  if (!(await page.getByTestId('cert-life-box').evaluate((e) => e.open))) await page.getByTestId('cert-life-box').locator('summary').first().click()
  await page.getByTestId('cert-life-applied').click()
  await page.waitForTimeout(1200)
  check('클라우드(P1): 진행 상태 → module_data(cert-os/life) 대표 작업공간에 저장', sql(`select count(*) from public.module_data where workspace_id = '${OWNER_WS}' and module_key = 'cert-os' and bucket = 'life' and client_id = '${OWNER_CLIENT}'`) === '1')
  await page.getByTestId('cert-complete-open').click()
  await page.getByTestId('cert-complete-number').fill('260315-00999')
  await page.getByTestId('cert-complete-date').fill('2026-03-15')
  await page.getByTestId('cert-complete-fill').click()
  await page.getByTestId('cert-complete-save').click()
  // 저장이 DB 에 닿을 때까지 기다린다 — 예전에는 1.5초만 기다려서 시험 기계가 바쁠 때(다른 빌드 · 시험과 겹칠 때) 빈 값을 읽고 실패했다(2026-11-10)
  let certPay = {}
  let innoCred = []
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500)
    certPay = JSON.parse(sql(`select payload::text from public.operations_clients where id = '${OWNER_CLIENT}'`) || '{}')
    innoCred = (certPay.customFields ?? []).filter((f) => f.group === 'credential' && /이노비즈/.test(f.label))
    if (innoCred.length > 0 && i >= 2) break
  }
  check('클라우드(P1): 인증 완료 → 업체 기록(DB) 인증서 칸 1개 · 갱신 일정 3줄', innoCred.length === 1 && innoCred[0].value.includes('2029-03-14까지') && ((certPay.toolResults ?? []).find((t) => t.toolKey === 'cert-os')?.deadlines?.length ?? 0) === 3, JSON.stringify(innoCred))

  // D-180: 클라우드(진짜 RLS) — 앱이 특허를 저장해도 DB 에 있는 예전 벤처 기록은 그대로(서비스가 저장 전에 DB 를 한 번 읽고 잠긴 칸만 되돌린다)
  const LV = 'qa-legacy-venture'
  const lvPay = { clientName: '잠금시험', venture: { submittedAt: '2026-08-01', submissionNote: '예전 제출 메모' }, coreThread: { ventureSentence: '예전 벤처 문장' }, stages: { S14: { status: 'in_progress', note: '예전 S14 메모' } } }
  sql(`insert into public.consulting_projects (id, workspace_id, client_id, title, current_stage, payload) values ('${LV}', '${OWNER_WS}', '${OWNER_CLIENT}', '특허·MVP 잠금 시험', 'S14', '${JSON.stringify(lvPay)}'::jsonb) on conflict (id) do nothing`)
  await go(page, `/studio/${LV}?adv=1&tab=patent`)
  // 화면이 연 뒤 DB 의 벤처 기록이 달라진 상황(다른 기기 · 예전 화면) — 화면이 들고 있는 값으로 덮으면 안 된다
  sql(`update public.consulting_projects set payload = jsonb_set(jsonb_set(payload, '{venture,submittedAt}', '"2026-07-15"'), '{coreThread,ventureSentence}', '"DB 벤처 문장"') where id = '${LV}'`)
  const lvLogFrom = restLog.length
  await page.getByLabel('발명자 (실제 기여 기준)').fill('클라우드발명')
  await page.getByLabel('발명자 (실제 기여 기준)').press('Tab')
  await page.waitForTimeout(1800)
  const lv = JSON.parse(sql(`select payload::text from public.consulting_projects where id = '${LV}'`) || '{}')
  check('클라우드(D-180): 특허(발명자)는 DB 에 저장', lv.patent?.inventors === '클라우드발명', JSON.stringify(lv.patent ?? {}).slice(0, 200))
  check('클라우드(D-180): 같은 저장에서 DB 의 신청일 · 제출 메모 · 벤처 문장 · S14 상태/메모는 그대로', lv.venture?.submittedAt === '2026-07-15' && lv.venture?.submissionNote === '예전 제출 메모' && lv.coreThread?.ventureSentence === 'DB 벤처 문장' && lv.stages?.S14?.status === 'in_progress' && lv.stages?.S14?.note === '예전 S14 메모', JSON.stringify({ v: lv.venture?.submittedAt, n: lv.venture?.submissionNote, s: lv.coreThread?.ventureSentence, s14: lv.stages?.S14 }))
  const lvReq = restLog.slice(lvLogFrom).filter((x) => x.url.startsWith('/rest/v1/consulting_projects'))
  check('클라우드(D-180): 저장 한 번 = 읽기 1 · 쓰기 1(되풀이 없음)', lvReq.filter((x) => x.method === 'GET').length === 1 && lvReq.filter((x) => x.method === 'PATCH').length === 1, lvReq.map((x) => x.method).join(','))

  // D-181: 대표 — 고객 관리 '중소기업 고객 · 컨설턴트 고객'(클라우드 · payload 에 저장 · DB 변경 없음)
  await page.evaluate(() => localStorage.removeItem('axmvp.clients.type'))
  await go(page, '/ops/clients')
  check('대표(D-181): 고객 관리에 중소기업 고객 · 컨설턴트 고객 탭', (await page.getByTestId('client-type-tabs').count()) === 1 && /2/.test(await page.getByTestId('client-type-sme').innerText()) && /0/.test(await page.getByTestId('client-type-consultant').innerText()))
  await go(page, `/ops/clients/${OWNER_CLIENT}`)
  await page.getByRole('button', { name: '더보기' }).first().click()
  await page.getByTestId('more-client-type').click()
  await page.waitForTimeout(1200)
  check('대표(D-181): 컨설턴트 고객으로 옮기기 → DB payload clientType', sql(`select payload->>'clientType' from public.operations_clients where id = '${OWNER_CLIENT}'`) === 'consultant')
  await go(page, '/ops/clients')
  check('대표(D-181): 고객 관리 컨설턴트 쪽에 1 · 중소기업 쪽 1', /1/.test(await page.getByTestId('client-type-consultant').innerText()) && /1/.test(await page.getByTestId('client-type-sme').innerText()) && (await bodyText(page)).includes('대표비밀정밀'))
  await go(page, `/ops/clients/${OWNER_CLIENT}`)
  await page.getByRole('button', { name: '더보기' }).first().click()
  await page.getByTestId('more-client-type').click()
  await page.waitForTimeout(1200)
  check('대표(D-181): 되돌리면 DB payload 에서 표시가 지워짐', sql(`select coalesce(payload->>'clientType', '없음') from public.operations_clients where id = '${OWNER_CLIENT}'`) === '없음')
  await page.evaluate(() => localStorage.removeItem('axmvp.clients.type'))

  // 대표가 브라우저에 남긴 값(작성 중 메모 · 도구 입력) — 다음 사람에게 보이면 안 된다
  await page.evaluate(() => {
    localStorage.setItem('axmvp.qa.ownerDraft', '대표비밀 작성 중 메모')
    localStorage.setItem('planChecklist:대표비밀정밀', '{"memo":"대표비밀 체크"}')
    sessionStorage.setItem('axmvp.qa.ownerSession', '대표비밀 세션 값')
  })
  await logout(page)
  check('대표 로그아웃: 로그인 화면', page.url().includes('/login'))
  const afterOut = await page.evaluate(() => Object.keys(localStorage).filter((k) => !k.startsWith('axmvp.u.') && !k.startsWith('sb-') && /^(axmvp|planChecklist)/.test(k) && !['axmvp.schema_version', 'axmvp.staleChunkReloadAt', 'axmvp.grants.feed.v1', 'axmvp.auth.recent', 'axmvp.auth.switch_to'].includes(k)))
  check('대표 로그아웃: 사람별 값이 꺼내진 채 남지 않음(금고로)', afterOut.length === 0, afterOut.join(','))

  /* ================= 2. 공개 사이트 가입자 — 접근 목록에 없음 ================= */
  restLog = []
  await login(page, OUTSIDER)
  const outText = await bodyText(page)
  check('가입자: "이 계정은 쓸 수 없습니다" 화면', (await page.getByTestId('no-access').count()) === 1, outText.slice(0, 200))
  check('가입자: 대표 자료 0', leaked(outText).length === 0, leaked(outText).join())
  // D-579 방금 가입한 사람이 맨 먼저 보는 화면 — 무엇을 하면 되는지(이메일을 담당자에게 → 승인되면 다시 확인) · 내 이메일 · [복사] · 권한은 그대로
  const noAccessLook = {
    email: ((await page.getByTestId('no-access-email').innerText().catch(() => '')) ?? '').replace(/\s+/g, ' '),
    retry: await page.getByTestId('no-access-retry').count(),
    out: await page.getByTestId('no-access-signout').count(),
    title: ((await page.getByTestId('no-access').innerText().catch(() => '')) ?? '').trim(),
    px: await page.evaluate(() => Math.min(...[...document.querySelectorAll('h1, p')].map((el) => parseFloat(getComputedStyle(el).fontSize)))),
  }
  check('가입자(D-579): "아직 사용 승인 전" · 할 일 안내(이메일을 담당자에게) · 내 이메일 + [복사] · [승인됐는지 다시 확인] · [로그아웃] · 글자 16px 이상', /승인 전/.test(noAccessLook.title) && /담당자에게/.test(outText) && noAccessLook.email.includes(OUTSIDER.email) && noAccessLook.retry === 1 && noAccessLook.out === 1 && noAccessLook.px >= 16, JSON.stringify(noAccessLook))
  await shot(page, 'outsider-01-no-access')
  await go(page, `/ops/clients/${OWNER_CLIENT}`)
  check('가입자: 대표 업체 주소로 가도 접근 없음 화면', (await page.getByTestId('no-access').count()) === 1 && leaked(await bodyText(page)).length === 0)
  const outRest = await page.evaluate(async ([ref]) => {
    const s = JSON.parse(localStorage.getItem(`sb-${ref}-auth-token`) ?? '{}')
    const h = { apikey: 'qa-anon', Authorization: `Bearer ${s.access_token}`, 'content-type': 'application/json' }
    const a = await fetch(`https://${ref}.supabase.co/rest/v1/operations_clients?select=company_name`, { headers: h }).then((r) => r.text())
    const b = await fetch(`https://${ref}.supabase.co/rest/v1/rpc/create_workspace`, { method: 'POST', headers: h, body: JSON.stringify({ p_name: '몰래 작업공간' }) }).then((r) => r.status)
    return { a, b }
  }, [REF])
  check('가입자: REST 로 업체 표 직접 읽기 = 빈 목록', outRest.a === '[]', outRest.a)
  check('가입자: 작업공간 만들기(RPC) 막힘', outRest.b >= 400, String(outRest.b))
  check('가입자: 작업공간이 생기지 않음(DB)', sql(`select count(*) from public.workspaces where owner_id = '${OUTSIDER.id}'`) === '0')
  check('가입자: 이 사람 응답 어디에도 대표 자료 없음', restLog.every((x) => leaked(x.body).length === 0))
  await page.getByRole('button', { name: '로그아웃' }).first().click()
  await page.waitForURL((x) => x.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(500)

  /* ================= 3. Pilot — 같은 브라우저 · 처음 ================= */
  restLog = []
  await login(page, PILOT)
  // D-185: 팀장님 첫 로그인 → 안내 영상 창이 먼저(1편 · PC 는 가로 영상) · [오늘 하루 안 보기] · [앞으로 보지 않기]
  const tut = page.getByTestId('tutorial-dialog')
  await tut.waitFor({ timeout: 5000 }).catch(() => {})
  check('Pilot(D-185): 첫 로그인 → 안내 영상 창이 저절로 뜸', (await tut.count()) === 1 && (await tut.getAttribute('data-auto')) === '1')
  const vsrc = async (p) => (await p.getByTestId('tutorial-video').getAttribute('src').catch(() => '')) ?? ''
  check('Pilot(D-185): 1편부터 · PC 는 가로(16:9) 영상', (await page.getByTestId('tutorial-tab-part1').getAttribute('aria-selected')) === 'true' && (await page.getByTestId('tutorial-video').getAttribute('data-ratio')) === 'wide' && /part1-wide\.mp4$/.test(await vsrc(page)), await vsrc(page))
  check('Pilot(D-185): [오늘 하루 안 보기] · [앞으로 보지 않기] 단추', (await page.getByTestId('tutorial-hide-today').count()) === 1 && (await page.getByTestId('tutorial-hide-forever').count()) === 1)
  check('Pilot(D-185): 안내 영상 창에 대표 자료 0', leaked(await tut.innerText()).length === 0)
  await shot(page, 'pilot-00-tutorial')
  await page.getByTestId('tutorial-hide-today').click()
  await page.waitForTimeout(500)
  check('Pilot(D-185): 오늘 하루 안 보기 → 창 닫힘 · 다른 창도 없음', (await tut.count()) === 0 && (await page.locator('[role="dialog"]').count()) === 0)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  check('Pilot(D-185): 새로 열어도 오늘은 안 뜸', (await page.getByTestId('tutorial-dialog').count()) === 0)
  await go(page, '/settings')
  await page.getByTestId('settings-tutorial-open').click()
  await page.waitForTimeout(500)
  check('Pilot(D-185 · D-296): 설정 › 계정 · 보기 [안내 영상 보기] → 언제든 다시(숨기기 단추 없이)', (await tut.count()) === 1 && (await tut.getAttribute('data-auto')) === '0' && (await page.getByTestId('tutorial-hide-today').count()) === 0)
  await page.getByTestId('tutorial-tab-part2').click()
  await page.waitForTimeout(300)
  check('Pilot(D-185): 2편 고르면 2편 영상', /part2-wide\.mp4$/.test(await vsrc(page)), await vsrc(page))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check('Pilot(D-185): Esc 로 닫힘', (await tut.count()) === 0)
  // D-565 내부 팀장의 사용법 안내 — 전문 모듈 묶음까지 · [전체 안내 영상 보기] 로 같은 영상
  await go(page, '/guide')
  await page.waitForTimeout(600)
  const gGroupsP = await page.getByTestId('guide-group').evaluateAll((els) => els.map((e) => e.getAttribute('data-group')))
  check('Pilot(D-565) 사용법 안내: 묶음에 전문 모듈 있음 · 대표 전용 묶음(잘 안 쓰는 기능 · 이 시스템) 없음 · [전체 안내 영상 보기] 있음 · 대표 자료 0', gGroupsP.includes('modules') && !gGroupsP.includes('rare') && !gGroupsP.includes('about') && (await page.getByTestId('guide-tutorial').count()) === 1 && leaked(await bodyText(page)).length === 0, gGroupsP.join())
  await page.getByTestId('guide-tutorial').click()
  await page.waitForTimeout(400)
  check('Pilot(D-565): [전체 안내 영상 보기] → 안내 영상 창', (await tut.count()) === 1)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // D-282 팀장 오늘 화면 — 바로가기는 메뉴와 같은 권한(대표 전용 AI 전략실 · 특허 · 벤처 · 마케팅 없음) · KPI 에 '최근 AI 작업' 칸 없음
  await go(page, '/')
  // U2(2026-11-05) 바로가기는 처음엔 접힘 — 접힌 줄 이름 링크도 같은 목록(같은 권한)
  const uxTiles = await page.getByTestId('app-mini').evaluateAll((els) => els.map((e) => e.dataset.key))
  check('Pilot(D-282 · D-564): 바로가기 — 대표 전용(AI 전략실 · 특허 · 벤처) 없음 · 고객 관리 · 전체 도구 · 마케팅은 있음', uxTiles.includes('client-ops') && uxTiles.includes('tools') && uxTiles.includes('marketing') && !uxTiles.some((k) => ['ai-workspace', 'patent-venture'].includes(k)), uxTiles)
  check('Pilot(D-282): KPI — 최근 AI 작업 칸 없음 · 상담 대신 후속 약속 · 대표 자료 0', (await page.getByTestId('kpi-ai').count()) === 0 && (await page.getByTestId('kpi-follow').innerText()).includes('후속 약속') && leaked(await page.getByTestId('today-kpis').innerText()).length === 0)
  // 팀장 머리줄 — 5폭 × 글자 3단계에서 넘치지 않는다(D-296 안내 영상 단추는 머리줄에 없다)
  {
    const bad = []
    for (const w of [1024, 1280, 1366, 1440, 1920]) {
      await page.setViewportSize({ width: w, height: 900 })
      await page.waitForTimeout(250)
      for (const scale of ['default', 'large', 'extra_large']) {
        await page.evaluate((sc) => document.documentElement.setAttribute('data-text-scale', sc), scale)
        await page.waitForTimeout(150)
        const r = await page.evaluate(() => {
          const hdr = document.querySelector('header')
          const hb = hdr.getBoundingClientRect()
          const cut = [...hdr.querySelectorAll('a,button')].filter((e) => e.offsetParent !== null && e.getBoundingClientRect().right > hb.right + 1).length
          const tb = document.querySelector('header [data-testid="tutorial-open"]')
          return { over: hdr.scrollWidth - hdr.clientWidth, cut, btn: !!tb && tb.offsetParent !== null }
        })
        if (r.over > 0 || r.cut > 0 || r.btn) bad.push(`${w}/${scale} ${JSON.stringify(r)}`)
      }
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-text-scale', 'default'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(300)
    check('Pilot 머리줄(D-185 · D-296): 5폭 × 글자 3단계 넘침 0 · 안내 영상 단추 없음(설정에서)', bad.length === 0, bad.join(' | '))
  }
  const today = await bodyText(page)
  check('Pilot: 로그인하면 오늘 화면', !page.url().includes('/login') && (await page.getByTestId('no-access').count()) === 0, page.url())
  check('Pilot: 오늘 — "등록된 업체가 없습니다 · 첫 업체 등록"', (await page.getByTestId('today-first-client').count()) === 1 && today.includes('업체를 등록하면 일정 · 서류 · 업무 · 수금을 한곳에서 관리할 수 있습니다'))
  check('Pilot: 화면 어디에도 대표 이름(김상호) 없음 — 사이드바 · 머리줄 사용자 칸', !today.includes('김상호'), today.split('\n').filter((l) => l.includes('김상호')).join(' | '))
  check('Pilot: 오늘 화면에 대표 자료 0(할 일 · 약속 · 돈 · 상담신청)', leaked(today).length === 0, leaked(today).join())
  check('Pilot: 오늘 화면에 상담신청 칸 없음', !today.includes('새 상담신청') && !/\n상담신청\n/.test(today))
  const ls = await page.evaluate(() => ({ draft: localStorage.getItem('axmvp.qa.ownerDraft'), plan: localStorage.getItem('planChecklist:대표비밀정밀'), sess: sessionStorage.getItem('axmvp.qa.ownerSession'), all: JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => !k.startsWith('axmvp.u.')))) }))
  check('Pilot: 대표가 브라우저에 남긴 값이 안 보임(같은 브라우저)', ls.draft === null && ls.plan === null && ls.sess === null && leaked(ls.all).length === 0, JSON.stringify(ls).slice(0, 300))
  await shot(page, 'pilot-01-today-empty')

  // 메뉴
  const nav = (await page.locator('aside').first().innerText().catch(() => '')) ?? ''
  check('Pilot 메뉴: 잘 안 쓰는 기능 · 이 시스템 묶음 없음', !nav.includes('잘 안 쓰는 기능') && !nav.includes('이 시스템'), nav.replace(/\n/g, '|').slice(0, 400))
  check('Pilot 메뉴: 영업자 정산 · 1차 미팅 체크리스트 · 상담신청 없음', !nav.includes('영업자 정산') && !nav.includes('1차 미팅') && !nav.includes('상담신청'))
  check('Pilot 메뉴: 오늘 · 고객 관리 · 일정 · 매출 · 전문 모듈(기업성장 · 절세·재무) · 설정은 있음', ['오늘', '고객 관리', '매출', '기업성장', '절세·재무', '설정'].every((s) => nav.includes(s)), nav.replace(/\n/g, '|').slice(0, 400))
  check('메뉴(D-163): 정부지원사업 줄 없음 · 영업 묶음에 지원사업 알림 없음', !nav.includes('정부지원사업') && !/영업 관리\n지원사업 알림/.test(nav), nav.replace(/\n/g, '|').slice(0, 400))
  check('Pilot(D-164): 대표 ↔ 팀장 전환 단추 없음', (await page.getByTestId('view-as-switch').count()) === 0)
  await page.getByRole('button', { name: '사용자 메뉴' }).click().catch(() => {})
  check('Pilot(D-558): 사용자 메뉴에도 보는 화면 전환 없음', (await page.getByTestId('usermenu-viewas').count()) === 0)
  await page.keyboard.press('Escape')
  await page.mouse.click(5, 400)
  check('P3 Pilot 메뉴(D-564): 마케팅 · 브랜딩 있음(팀장 등급 계정에 화면을 연다 · 대표 자료는 아래 P9 · 화면 시험이 지킴)', nav.includes('마케팅 · 브랜딩'), nav.replace(/\n/g, '|').slice(0, 400))
  check('P3 Pilot 메뉴(D-206): 홍보 글 만들기 · 홈페이지 만들기 없음(대표 전용)', !nav.includes('홍보 글') && !nav.includes('홈페이지 만들기'))
  check('Pilot(D-164 · D-296): 머리줄 글자 크기 단추 없음 · 보기 방식은 접힌 단추 하나(눌러서 PC · Mobile · PC+Mobile)', (await page.locator('header [data-testid="text-scale-quick"]').count()) === 0 && (await page.locator('header [data-testid="device-switch-compact"]').count()) === 1 && (await page.locator('header [data-testid="device-switch"]').count()) === 0)
  check('Pilot 머리줄: 고객 플랫폼 링크 없음', (await page.locator('header').innerText()).includes('고객 플랫폼') === false)

  // 교차 — 대표 업체 · 숨긴 화면 주소
  for (const p of [`/ops/clients/${OWNER_CLIENT}`, `/ops/clients/${OWNER_CLIENT}?tab=docs`, `/ops/clients/${OWNER_CLIENT}?tab=fees`, `/tools/policy-funding?client=${OWNER_CLIENT}`, `/tools/tax?client=${OWNER_CLIENT}`, `/grants?client=${OWNER_CLIENT}`, '/ops/calendar', '/journal', '/ops/decide', '/money', '/sales/board', '/grants', '/tools', '/settings']) {
    await go(page, p)
    const t = await bodyText(page)
    check(`Pilot 교차: ${p} — 대표 자료 0`, leaked(t).length === 0, leaked(t).join())
  }
  await go(page, `/ops/clients/${OWNER_CLIENT}`)
  check('Pilot 교차: 대표 업체 주소 → "찾지 못했습니다"', /찾지 못|없는 업체|없습니다/.test(await bodyText(page)))
  for (const p of ['/ops/inbox', '/ops/agents', '/sales/first-meeting', '/getting-started', '/why', '/kpi', '/roadmap', '/studio', '/studio/spec-check', '/clients', '/ax/open?client=' + OWNER_CLIENT, '/website-studio', '/modules/tech-biz', '/funding', '/tools/review', '/ai', '/ai/new', '/ai/usage', '/ai/cases/case_qa_owner_01', '/ai/cases/case_qa_owner_01/proposal/x', '/patent-venture', '/patent-venture/plan?client=' + OWNER_CLIENT, '/patent-venture/spec-check', '/patent-venture/write']) {
    await go(page, p)
    check(`Pilot 주소 막힘: ${p}`, (await bodyText(page)).includes('화면을 찾지 못했습니다'), (await bodyText(page)).slice(0, 120))
  }
  await go(page, '/settings')
  const st = await bodyText(page)
  // D-163: 이름 · 직함 — 이메일 앞부분(pilot)을 이름으로 보이지 않고, 적은 이름이 사이드바 · 머리줄에
  check('Pilot 이름: 저장 전에는 이메일 앞부분을 이름으로 쓰지 않음', !(await page.locator('[data-testid="sidebar-account"]').innerText()).includes('pilot'), await page.locator('[data-testid="sidebar-account"]').innerText())
  await page.getByTestId('name-input').fill('최은혜')
  await page.getByTestId('title-input').fill('팀장')
  await page.getByTestId('name-save').click()
  await page.waitForTimeout(900)
  check('Pilot 이름: 설정에서 저장하면 사이드바에 "최은혜 팀장"', /최은혜\s*팀장/.test(await page.locator('[data-testid="sidebar-account"]').innerText()), await page.locator('[data-testid="sidebar-account"]').innerText())
  check('Pilot 설정: 내 정보 · 화면만(구성원 · 요금제 · 고객 이벤트 받는 곳 없음)', (await page.getByTestId('settings-pilot').count()) === 1 && !st.includes('구성원') && !st.includes('요금제') && !st.includes('받는 곳'), st.slice(0, 300))

  // 찾기 · 알림 종
  await go(page, '/')
  await page.getByRole('button', { name: /^찾기|찾기$/ }).filter({ visible: true }).first().click()
  const search = page.getByPlaceholder('업체 이름 · 대표 · 전화번호 뒷자리 · 도구')
  await search.waitFor({ timeout: 5000 }).catch(() => {})
  for (const q of ['대표비밀', '김비밀', '1111']) {
    await search.fill(q)
    await page.waitForTimeout(700)
    check(`Pilot 찾기: "${q}" → 대표 자료 0`, (await search.isVisible()) && leaked(await bodyText(page)).length === 0, leaked(await bodyText(page)).join())
  }
  // D-564 P4: 찾기(Ctrl+K) — 마케팅 · 브랜딩은 이제 나온다(팀장 화면) · 대표 자료는 나오지 않는다
  for (const q of ['마케팅', '유튜브', '콘텐츠 레이더']) {
    await search.fill(q)
    await page.waitForTimeout(700)
    const t = await bodyText(page)
    check(`P4 Pilot 찾기(D-564): "${q}" → 대표 자료 0${q === '마케팅' ? ' · 마케팅 · 브랜딩 화면은 찾아짐' : ''}`, (await search.isVisible()) && leaked(t).length === 0 && (q !== '마케팅' || t.includes('마케팅 · 브랜딩')), t.slice(0, 200))
  }
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /챙길 것/ }).first().click().catch(() => {})
  await page.waitForTimeout(500)
  check('Pilot 알림 종: 대표 경고 · 상담신청 0', leaked(await bodyText(page)).length === 0)
  await page.keyboard.press('Escape')

  // REST 를 직접 불러도(브라우저 개발자 도구로 하는 것과 같다)
  const direct = await page.evaluate(async ([ref, ws, cid]) => {
    const s = JSON.parse(localStorage.getItem(`sb-${ref}-auth-token`) ?? '{}')
    const h = { apikey: 'qa-anon', Authorization: `Bearer ${s.access_token}`, 'content-type': 'application/json', Prefer: 'return=representation' }
    const base = `https://${ref}.supabase.co/rest/v1`
    const out = {}
    for (const t of ['operations_clients', 'ops_journal_entries', 'module_data', 'customer_events', 'workspaces', 'workspace_members', 'profiles', 'os_access']) {
      out[t] = await fetch(`${base}/${t}?select=*`, { headers: h }).then((r) => r.text())
    }
    out.byId = await fetch(`${base}/operations_clients?id=eq.${cid}`, { headers: h }).then((r) => r.text())
    out.patch = await fetch(`${base}/operations_clients?id=eq.${cid}`, { method: 'PATCH', headers: h, body: JSON.stringify({ company_name: 'Pilot 이 고침' }) }).then((r) => r.text())
    out.del = await fetch(`${base}/operations_clients?id=eq.${cid}`, { method: 'DELETE', headers: h }).then((r) => r.text())
    out.insert = await fetch(`${base}/operations_clients`, { method: 'POST', headers: h, body: JSON.stringify({ id: 'pilot-into-owner', workspace_id: ws, company_name: '몰래 넣기' }) }).then((r) => r.status)
    out.ws2 = await fetch(`${base}/rpc/create_workspace`, { method: 'POST', headers: h, body: JSON.stringify({ p_name: '두 번째' }) }).then((r) => r.status)
    out.tier = await fetch(`${base}/os_access?user_id=eq.${s.user.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ tier: 'full' }) }).then((r) => r.status)
    out.mkt = await fetch(`${base}/module_data?module_key=eq.marketing&select=*`, { headers: h }).then((r) => r.text())
    out.mktById = await fetch(`${base}/module_data?id=eq.idea_qa_owner_mkt`, { headers: h }).then((r) => r.text())
    out.cases = await fetch(`${base}/company_cases?select=*`, { headers: h }).then((r) => r.text())
    out.runs = await fetch(`${base}/ai_runs?select=*`, { headers: h }).then((r) => r.text())
    out.caps = await fetch(`${base}/rpc/my_capabilities`, { method: 'POST', headers: h, body: '{}' }).then((r) => r.text())
    out.hasCap = await fetch(`${base}/rpc/has_capability`, { method: 'POST', headers: h, body: JSON.stringify({ p_cap: 'can_use_owner_ai_workspace' }) }).then((r) => r.text())
    out.caseIns = await fetch(`${base}/company_cases`, { method: 'POST', headers: h, body: JSON.stringify({ id: 'case_pilot_sneak_01', workspace_id: ws, owner_id: s.user.id, company_name: '몰래', relation: 'reviewed' }) }).then((r) => r.status)
    out.capIns = await fetch(`${base}/user_capabilities`, { method: 'POST', headers: h, body: JSON.stringify({ user_id: s.user.id, capability: 'can_use_owner_ai_workspace' }) }).then((r) => r.status)
    out.lvPatch = await fetch(`${base}/consulting_projects?id=eq.qa-legacy-venture`, { method: 'PATCH', headers: h, body: JSON.stringify({ payload: { venture: { submittedAt: '2099-01-01' } } }) }).then((r) => r.text())
    return out
  }, [REF, OWNER_WS, OWNER_CLIENT])
  check('AI Pilot REST: 대표 AI 전략실 업체 · 실행 기록 읽기 = []', direct.cases === '[]' && direct.runs === '[]', `${direct.cases} ${direct.runs}`)
  check('AI Pilot REST: 내 기능 권한 = [] · has_capability = false', direct.caps === '[]' && direct.hasCap === 'false', `${direct.caps} ${direct.hasCap}`)
  check('AI Pilot REST: AI 전략실 업체 넣기 · 자기 권한 넣기 막힘', direct.caseIns >= 400 && direct.capIns >= 400, `${direct.caseIns} ${direct.capIns}`)
  check('AI DB: 기능 권한은 대표 한 사람 · 대표 AI 업체 그대로', sql(`select string_agg(user_id::text, ',') from public.user_capabilities where capability = 'can_use_owner_ai_workspace'`) === OWNER.id && sql(`select count(*) from public.company_cases where id = 'case_pilot_sneak_01'`) === '0')
  check('Pilot REST(D-180 S8): 대표의 예전 벤처 기록 고치기 = 0줄 · DB 그대로', direct.lvPatch === '[]' && sql(`select payload->'venture'->>'submittedAt' from public.consulting_projects where id = 'qa-legacy-venture'`) === '2026-07-15', direct.lvPatch)
  check('Pilot REST: 표 8개 어디에도 대표 자료 없음', Object.entries(direct).filter(([k]) => !['patch', 'del', 'insert', 'ws2', 'tier'].includes(k)).every(([, v]) => leaked(String(v)).length === 0 && !String(v).includes(OWNER_WS)), JSON.stringify(direct).slice(0, 400))
  check('Pilot REST: 대표 업체 id 로 읽기 = []', direct.byId === '[]', direct.byId)
  check('P9 Pilot REST(D-195): 대표 콘텐츠 레이더 기록(module_data · marketing) 읽기 = [] · id 로도 []', direct.mkt === '[]' && direct.mktById === '[]', `${direct.mkt} ${direct.mktById}`)
  check('Pilot REST: 대표 업체 고치기 · 지우기 = 0줄', direct.patch === '[]' && direct.del === '[]', `${direct.patch} ${direct.del}`)
  check('Pilot REST: 대표 작업공간으로 업체 넣기 막힘', direct.insert >= 400, String(direct.insert))
  check('Pilot REST: 작업공간 하나 더 만들기 막힘', direct.ws2 >= 400, String(direct.ws2))
  check('Pilot REST: 자기 등급을 full 로 고치기 막힘', direct.tier >= 400 || sql(`select tier from public.os_access where user_id = '${PILOT.id}'`) === 'pilot', String(direct.tier))
  check('DB: 대표 업체 그대로(이름 · 줄 수)', sql(`select company_name from public.operations_clients where id = '${OWNER_CLIENT}'`) === '대표비밀정밀(주)' && sql(`select count(*) from public.operations_clients where workspace_id = '${OWNER_WS}'`) === '2')
  check('DB: Pilot 등급 그대로 pilot', sql(`select tier from public.os_access where user_id = '${PILOT.id}'`) === 'pilot')

  /* ================= 4. Pilot 실제 업무 흐름 ================= */
  await go(page, '/')
  await page.getByTestId('today-first-client-add').click()
  await page.waitForTimeout(600)
  check('흐름: 첫 업체 등록 → 등록 창이 바로 열림', await page.getByLabel('업체명').isVisible().catch(() => false))
  check('팀장(D-181): 등록 창에 고객 종류(중소기업 · 컨설턴트) 고르기 없음', (await page.getByTestId('new-client-type').count()) === 0)
  await page.getByLabel('업체명').fill('은혜테스트정밀(주)')
  await page.getByLabel('대표자·담당자').fill('박은혜')
  await page.getByRole('button', { name: '등록하고 열기' }).click()
  await page.waitForURL(/\/ops\/clients\/[^/?]+/, { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(900)
  const pc = sql(`select id from public.operations_clients where workspace_id = '${PILOT_WS}' and company_name = '은혜테스트정밀(주)'`)
  check('흐름: 업체가 Pilot 작업공간에 저장(DB)', pc.length > 0, pc)
  check('흐름: 등록하면 그 업체 화면', page.url().includes(`/ops/clients/${pc}`), page.url())
  check('팀장(D-181): 등록한 업체는 중소기업(표시 없음 · DB 에 clientType 없음)', (await page.getByTestId('client-type-badge').count()) === 0 && sql(`select coalesce(payload->>'clientType', '없음') from public.operations_clients where id = '${pc}'`) === '없음')
  await page.getByRole('button', { name: '더보기' }).first().click()
  await page.waitForTimeout(400)
  check('팀장(D-181): 업체 더보기에 "컨설턴트 고객으로 옮기기" 없음', (await page.getByTestId('more-client-type').count()) === 0 && (await page.getByTestId('more-report').count()) === 1)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await shot(page, 'pilot-02-first-client')

  // 서류 올리기 → 읽기 → 회사 정보
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([{ name: '사업자등록증.txt', mimeType: 'text/plain', buffer: Buffer.from(['사업자등록증', '(법인사업자)', '등록번호 : 124-81-00998', '법인명(단체명) : 은혜테스트정밀(주)', '대표자 : 박은혜', '개업연월일 : 2023 년 01 월 10 일', '사업장 소재지 : 경기도 파주시 탄현면 평화로 3', '업태 : 제조업', '종목 : 정밀기계'].join('\n'), 'utf8') }])
  await page.getByTestId('smart-placed').waitFor({ timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1200)
  const pay = JSON.parse(sql(`select payload::text from public.operations_clients where id = '${pc}'`) || '{}')
  check('흐름: 서류 → 사업자번호 · 설립일 바로 입력(DB)', String(pay.businessNumber ?? '').replace(/\D/g, '') === '1248100998' && pay.establishedAt === '2023-01-10', JSON.stringify({ b: pay.businessNumber, e: pay.establishedAt }))
  const biz = pay.documents?.businessRegistration
  check('흐름: 서류함에 들어감 · 보관 경로가 Pilot 작업공간 폴더', !!biz?.fileName && String(biz?.storagePath ?? '').startsWith(`${PILOT_WS}/`), JSON.stringify(biz))
  check('흐름: 올린 파일이 모두 Pilot 폴더로(대표 폴더 0)', uploads.length > 0 && uploads.every((u) => u.key.startsWith(`${PILOT_WS}/`) && u.who === PILOT.email), JSON.stringify(uploads))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await shot(page, 'pilot-03-after-upload')
  // 다음 약속(일정) — D-357 '다음 행동 추천' 은 접혀 있다(제목 줄을 눌러 펼친다)
  await openFoldIn(page, 'smart.steps')
  const step = page.getByTestId('smart-step-next').first()
  if (await step.isVisible().catch(() => false)) {
    await step.click()
    await page.waitForTimeout(900)
  }
  const pay2 = JSON.parse(sql(`select payload::text from public.operations_clients where id = '${pc}'`) || '{}')
  check('흐름: 다음 약속 걸기 → 날짜가 생김(DB)', !!(pay2.nextActionDueDate || sql(`select next_action_due_date from public.operations_clients where id = '${pc}'`)), JSON.stringify({ a: pay2.nextAction, d: pay2.nextActionDueDate }))

  // 계약 · 수금
  await go(page, `/ops/clients/${pc}?tab=fees`)
  await page.getByTestId('plan-open').first().click()
  await page.waitForTimeout(300)
  const sheet = page.getByTestId('contract-plan')
  await sheet.getByTestId('plan-total').getByRole('button', { name: '500만원', exact: true }).click()
  await sheet.getByTestId('plan-paid').getByRole('button', { name: /^전액 500만원/ }).click()
  await page.getByTestId('plan-save').click()
  await page.waitForTimeout(1000)
  const fees = JSON.parse(sql(`select coalesce(payload->'fees','[]')::text from public.operations_clients where id = '${pc}'`) || '[]')
  check('흐름: 계약 · 수금 저장(DB 500만원)', fees.reduce((s, f) => s + (Number(f.amount) || 0), 0) === 5000000, JSON.stringify(fees).slice(0, 300))
  await shot(page, 'pilot-04-fees')

  // 할 일 · 업무 일기(오늘)
  await go(page, '/')
  await page.getByRole('button', { name: '할 일 적기' }).first().click()
  await page.getByLabel('할 일 내용').fill('은혜테스트정밀 서류 받기')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(900)
  await openFoldIn(page, 'today.capture')
  await page.getByLabel('기록 내용').first().fill('은혜테스트정밀 박대표와 통화 — 다음 주 방문')
  await page.getByRole('button', { name: /^기록$/ }).first().click()
  await page.waitForTimeout(900)
  const jr = sql(`select string_agg(content, ' | ' order by content) from public.ops_journal_entries where workspace_id = '${PILOT_WS}'`)
  check('흐름: 할 일 · 업무 일기가 Pilot 작업공간에 저장(DB)', jr.includes('서류 받기') && jr.includes('박대표와 통화'), jr)
  check('흐름: 대표 업무 일기에 섞이지 않음(DB)', !sql(`select coalesce(string_agg(content, '|'), '') from public.ops_journal_entries where workspace_id = '${OWNER_WS}'`).includes('은혜'))
  await openFoldIn(page, 'today.agenda') // 돈 칸(미수금)은 '다가오는 마감 · 약속' 안
  const todayAfter = await bodyText(page)
  check('흐름: 오늘 화면에 내 할 일 · 기록', todayAfter.includes('서류 받기') && todayAfter.includes('박대표와 통화') && leaked(todayAfter).length === 0)
  await shot(page, 'pilot-05-today-after')
  check('팀장(D-171): 오늘 돈 칸 이름이 "미수금"("못 받은 내 돈" 아님)', todayAfter.includes('미수금') && !todayAfter.includes('못 받은 내 돈'))

  // D-187(클라우드 · 진짜 RLS): 팀장이 새 업체 등록 창에 사업자등록증만 넣으면 칸이 채워지고, 등록하면 서류함 · 회사 정보까지
  await go(page, '/ops/clients?new=1')
  await page.getByLabel('등록할 업체 서류 고르기').setInputFiles([{ name: '사업자등록증_은혜서류.txt', mimeType: 'text/plain', buffer: Buffer.from(['사업자등록증', '(법인사업자)', '등록번호 : 305-88-12340', '법인명(단체명) : 은혜서류정밀', '대표자 : 최서류', '개업연월일 : 2022 년 07 월 01 일', '사업장 소재지 : 경기도 수원시 영통구 광교로 7', '업태 : 제조업', '종목 : 정밀부품'].join('\n'), 'utf8') }])
  await page.getByTestId('new-client-from-doc-companyName').waitFor({ timeout: 20000 }).catch(() => {})
  check('팀장(D-187): 서류만 넣어도 업체명 · 대표자 · 사업자번호가 채워짐', (await page.getByLabel('업체명').inputValue()) === '은혜서류정밀' && (await page.getByLabel('대표자·담당자').inputValue()) === '최서류' && (await page.getByLabel('사업자등록번호').inputValue()) === '305-88-12340')
  const upBefore = uploads.length
  await page.getByRole('button', { name: '등록하고 열기' }).click()
  await page.waitForURL(/\/ops\/clients\/[^/?]+/, { timeout: 15000 }).catch(() => {})
  await page.getByTestId('smart-placed').waitFor({ timeout: 25000 }).catch(() => {})
  await page.waitForTimeout(1200)
  const dc = sql(`select id from public.operations_clients where workspace_id = '${PILOT_WS}' and company_name = '은혜서류정밀'`)
  const dpay = JSON.parse(sql(`select payload::text from public.operations_clients where id = '${dc}'`) || '{}')
  check('팀장(D-187): 업체가 팀장 작업공간에 저장 · 사업자번호 · 설립일 · 주소까지(DB)', dc.length > 0 && String(dpay.businessNumber ?? '') === '305-88-12340' && dpay.establishedAt === '2022-07-01' && String(dpay.businessAddress ?? '').includes('수원시'), JSON.stringify({ dc, b: dpay.businessNumber, e: dpay.establishedAt }))
  const dbiz = dpay.documents?.businessRegistration
  const newUps = uploads.slice(upBefore)
  check('팀장(D-187): 넣은 서류가 다시 고르지 않아도 서류함에 · 팀장 폴더로만 올라감', !!dbiz?.fileName && String(dbiz?.storagePath ?? '').startsWith(`${PILOT_WS}/`) && newUps.length === 1 && newUps.every((u) => u.key.startsWith(`${PILOT_WS}/`) && u.who === PILOT.email), JSON.stringify({ dbiz, newUps }))
  check('팀장(D-187): 대표 작업공간 업체 수 그대로 2', sql(`select count(*) from public.operations_clients where workspace_id = '${OWNER_WS}'`) === '2')
  await shot(page, 'pilot-05b-new-client-docs')
  await go(page, `/ops/clients/${pc}?tab=work`)
  const pWork = await bodyText(page)
  check('팀장(D-171): 업무 탭에 대표가 만든 항목(세무기장 · 모두의 창업 2차) 없음', leaked(pWork).length === 0, leaked(pWork).join())
  const BUILTIN_WORDS = ['법인설립', '업종 추가', '특허 출원', '벤처인증 (혁신성장유형)', 'AX 기획 및 개발', '정책자금 · 정부지원금']
  check('팀장(D-188): 업무 탭에 기본 6종 없음 · "아직 업무 항목이 없습니다" 안내', BUILTIN_WORDS.every((w) => !pWork.includes(w)) && (await page.getByTestId('work-empty').count()) === 1, BUILTIN_WORDS.filter((w) => pWork.includes(w)).join())
  const pkBefore = sql(`select coalesce(payload::text, '') from public.operations_clients where id = '${pc}'`)
  await page.getByRole('button', { name: '업무 항목 추가' }).first().click()
  await page.waitForTimeout(800)
  const pCat = await bodyText(page)
  check('팀장(D-171): 업무 항목 창 — 대표 항목 없음 · 상품표 40개에서 고르기', leaked(pCat).length === 0 && (await page.getByTestId('service-pkg').count()) === 40, leaked(pCat).join())
  const pkgNames = await page.getByTestId('service-pkg').allInnerTexts()
  check('팀장(D-188): 상품표 40개 이름에 "패키지" 없음 · 기본 6종 칸(고정) 없음', pkgNames.length === 40 && pkgNames.every((n) => !n.includes('패키지')) && (await page.getByTestId('service-builtins').count()) === 0, pkgNames.filter((n) => n.includes('패키지')).join())
  await page.getByTestId('service-pkg').filter({ hasText: '기업부설연구소 설립' }).first().click()
  await page.waitForTimeout(900)
  check('팀장(D-188): 상품표에서 누르면 팀장 작업공간에 업무 항목 생김(DB)', sql(`select count(*) from public.ops_custom_services where workspace_id = '${PILOT_WS}' and label = '기업부설연구소 설립' and not archived`) === '1' && sql(`select count(*) from public.ops_custom_services where workspace_id = '${OWNER_WS}' and label = '기업부설연구소 설립'`) === '0')
  await page.getByRole('button', { name: '닫기' }).first().click().catch(() => {})
  await page.waitForTimeout(600)
  await go(page, `/ops/clients/${pc}?tab=work`)
  const pWork2 = await bodyText(page)
  check('팀장(D-188): 업무 탭에 고른 항목(기업부설연구소 설립)이 보이고 기본 6종은 여전히 없음', pWork2.includes('기업부설연구소 설립') && BUILTIN_WORDS.every((w) => !pWork2.includes(w)) && (await page.getByTestId('work-empty').count()) === 0)
  check('팀장(D-188): 업무 탭을 열고 저장해도 업체 기록의 기본 6종 칸은 그대로(DB)', ['incorporation', 'businessScope', 'patent', 'venture', 'ax', 'policyFund'].every((k) => JSON.parse(sql(`select payload::text from public.operations_clients where id = '${pc}'`) || '{}').services?.[k] !== undefined) && pkBefore.length > 0)
  await shot(page, 'pilot-06-work-items')

  // D-246 → D-257: 팀장 — 기업인증 › 벤처 사업계획서 쓰기 · AI 판도 열림(Gemini 만)
  await go(page, `/tools/cert-os/venture?client=${pc}&plan=1`)
  await page.waitForTimeout(900)
  check('팀장(D-257): 벤처 사업계획서 쓰기 화면 열림 · AI 판 단추 있음(대표 지시 — Gemini 만) · 대표 자료 0', (await page.getByTestId('vplan').count()) === 1 && (await page.getByTestId('vplan-ai-open').count()) === 1 && leaked(await bodyText(page)).length === 0, (await bodyText(page)).slice(0, 200))

  // SAAS-1: 팀장 — 설정 › 내 브랜드 · AI 설정 → 저장(진짜 DB · 팀장 작업공간) → 이후 AI 지시문이 이 설정으로(대표 개인 정보 0)
  await go(page, '/settings')
  await page.getByTestId('brand-settings').waitFor({ timeout: 10000 }).catch(() => {})
  await page.waitForFunction(() => document.querySelector('[data-testid="brand-settings"]')?.getAttribute('data-ready') === '1', null, { timeout: 10000 }).catch(() => {})
  await page.getByTestId('brand-name').fill('은혜컨설턴트')
  await page.getByTestId('brand-company').fill('은혜경영')
  await page.getByTestId('brand-industry').fill('정책자금 컨설팅')
  await page.getByTestId('brand-tone').fill('쉬운 말 · 과장 없이')
  await page.getByTestId('brand-more').click()
  await page.getByTestId('brand-facts').fill('경력 5년 · 상담 80곳')
  const brandPreview = (await page.getByTestId('brand-preview').innerText()) ?? ''
  await page.getByTestId('brand-save').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="brand-save"]')?.textContent?.includes('저장됨'), null, { timeout: 10000 }).catch(() => {})
  const brandRow = JSON.parse(sql(`select coalesce((select payload::text from public.module_data where workspace_id = '${PILOT_WS}' and module_key = 'brand' and bucket = 'profile' limit 1), '{}')`) || '{}')
  const brandElsewhere = sql(`select count(*) from public.module_data where module_key = 'brand' and workspace_id <> '${PILOT_WS}'`)
  check('팀장(SAAS-1): 설정 › 내 브랜드 · AI 설정 — 미리보기 "은혜컨설턴트(은혜경영)" · 저장 → 팀장 작업공간에만(DB) · 다른 작업공간 0', brandPreview.includes('은혜컨설턴트(은혜경영)') && brandRow.name === '은혜컨설턴트' && brandRow.facts === '경력 5년 · 상담 80곳' && brandElsewhere === '0', { brandRow, brandElsewhere })
  await shot(page, 'pilot-saas1-brand')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.querySelector('[data-testid="brand-settings"]')?.getAttribute('data-ready') === '1', null, { timeout: 10000 }).catch(() => {})
  check('팀장(SAAS-1): 새로 고쳐도 적은 그대로(클라우드에서 다시 읽음)', (await page.getByTestId('brand-name').inputValue()) === '은혜컨설턴트' && (await page.getByTestId('brand-save').innerText()).includes('저장됨'))

  // D-257: 팀장 — 오늘 AI 도우미 띠 → 질문 단추 → 진짜 서버 함수 · 진짜 DB(my_os_access = pilot) → Gemini 로만
  aiCalls.length = 0
  rpcCalls.length = 0
  await go(page, '/')
  const pBar = page.getByTestId('ai-assist-bar').first()
  check('팀장(D-257): 오늘 화면에 AI 도우미 띠', (await pBar.count()) === 1)
  await page.getByTestId('ai-assist-chip').first().click()
  await page.getByTestId('ai-assist-confirm-go').click() // D-289 고른 뒤 [이대로 질문하기]
  await page.getByTestId('ai-assist-result').first().waitFor({ timeout: 15000 }).catch(() => {})
  const pRes = await page.getByTestId('ai-assist-result').first().innerText().catch(() => '')
  const gem = aiCalls.filter((c) => c.provider === 'gemini')
  check('팀장(D-257): 질문 단추 한 번 → 답 · Gemini 로만 감 · 서버가 DB 에 등급을 물어 팀장으로 판단(my_os_access)', pRes.includes('서류 마감부터') && gem.length === 1 && aiCalls.length === 1 && rpcSeen.has(`${PILOT.email}:my_os_access`), { n: aiCalls.length, rpc: rpcCalls.map((c) => `${c.who}:${c.fn}`).join(), pRes: pRes.slice(0, 80) })
  check('팀장(D-257 · SAAS-1): 지시문 첫 줄이 팀장 설정(은혜컨설턴트(은혜경영)) · 확인된 사실 · "사용자 본인이 보냈다" · 대표 이름 · 회사 0 · 보낸 자료에 대표 자료 0', (gem[0]?.sys ?? '').includes('은혜컨설턴트(은혜경영)의 업무 비서') && (gem[0]?.sys ?? '').includes('경력 5년 · 상담 80곳') && (gem[0]?.sys ?? '').includes('컨설턴트(사용자) 본인이 보냈다') && !/김상호|김팀장|미래AI랩/.test(gem[0]?.sys ?? '') && leaked(gem[0]?.user ?? '').length === 0, leaked(gem[0]?.user ?? '').join())
  await page.getByTestId('ai-assist-model-toggle').first().click()
  await page.waitForTimeout(500)
  const tabs = await page.locator('[data-testid="ai-assist-settings"] [role="tab"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-provider')))
  check('팀장(D-257): 모델 바꾸기 — 회사 탭은 Gemini 하나(GPT · Claude 없음)', tabs.join() === 'gemini', tabs.join())
  await shot(page, 'pilot-07-ai-gemini')
  await page.keyboard.press('Escape')
  const d1 = await assistDirect(PILOT, { requestId: 'pilot-direct-000001', assistId: 'today.top3', page: 'today', choice: { provider: 'anthropic' }, context: { title: '오늘', today: '2026-10-21', sections: [] } })
  const d2 = await assistDirect(PILOT, { requestId: 'pilot-direct-000002', assistId: 'radar.top5', page: 'radar', context: { title: '마케팅', today: '2026-10-21', sections: [] } })
  const d3 = await assistDirect(OUTSIDER, { requestId: 'pilot-direct-000003', assistId: 'today.top3', page: 'today', context: { title: '오늘', today: '2026-10-21', sections: [] } })
  check('팀장(D-257 · D-564) 서버 직접: Claude 고르면 403 provider_not_allowed · 장부 비밀값이 없는 동안 마케팅 단추 403 usage_setup_needed(셀 수 없으면 열지 않음) · 등급 없는 가입자 403 · AI 회사 안 부름', d1.statusCode === 403 && d1.body.code === 'provider_not_allowed' && d2.statusCode === 403 && d2.body.code === 'usage_setup_needed' && d3.statusCode === 403 && aiCalls.length === 1, { d1: d1.body.code, d2: d2.body.code, d3: d3.body.code, n: aiCalls.length })

  // D-258: 팀장 — OS 안 오른쪽 판 AI 대화 → 진짜 서버 함수(side.chat) → Gemini 로만 · 보낸 것에 대표 자료 0
  await page.getByTestId('side-ai-button').click()
  await page.getByTestId('side-ai-dock-chat').click()
  await page.getByTestId('side-dock').waitFor({ timeout: 8000 }).catch(() => {})
  await page.getByTestId('dock-chat-input').fill('정책자금 신청 순서 알려 줘')
  await page.getByTestId('dock-chat-input').press('Enter')
  await page.getByTestId('dock-answer').first().waitFor({ timeout: 15000 }).catch(() => {})
  const dockAns = await page.getByTestId('dock-answer').first().innerText().catch(() => '')
  const gem2 = aiCalls.filter((c) => c.provider === 'gemini')
  check('팀장(D-258 · SAAS-1): 오른쪽 판 AI 대화 → 판 안에 답 · Gemini 로만 · 팀장 설정 첫 줄 · 대표 이름 0 · 보낸 것에 대표 자료 0', dockAns.includes('서류 마감부터') && gem2.length === 2 && aiCalls.length === 2 && gem2[1].sys.includes('은혜컨설턴트(은혜경영)의 업무 비서') && !/김상호|김팀장|미래AI랩/.test(gem2[1].sys) && gem2[1].user.includes('정책자금 신청 순서') && leaked(gem2[1].user).length === 0, { n: aiCalls.length, dockAns: dockAns.slice(0, 80) })
  await shot(page, 'pilot-08-dock-chat')
  await page.getByTestId('dock-close').click()

  // D-188 → D-290: [개발자에게 피드백] 은 설정 › 계정 · 보기 안으로(왼쪽 아래는 이름 · 로그아웃만) — 메뉴 '설정' 줄에 '새 설문'
  const side = (await page.locator('aside').first().innerText()) ?? ''
  const freshDot = page.locator('aside [data-testid="settings-feedback-fresh"]').first()
  check('팀장(D-188 · D-290): 사이드바 버전 글자 없음 · 아래에 피드백 단추 없음 · 메뉴 설정 줄에 "새 설문"', !side.includes('v0.1.0') && !side.includes('컨설팅 운영 · AX 스튜디오') && (await page.locator('aside [data-testid="feedback-open"]').count()) === 0 && (await freshDot.count()) === 1, side.replace(/\n/g, '|').slice(-160))
  await go(page, '/settings')
  const fbBtn = page.locator('[data-testid="settings-feedback"] [data-testid="feedback-open"]').first()
  await shot(page, 'pilot-d290-settings')
  check('팀장(D-290): 설정 › 계정 · 보기 — [개발자에게 피드백] · 새 설문 표시 · 고객 플랫폼 · 대표/팀장 전환 · 계정 바꾸기 없음', (await fbBtn.count()) === 1 && (await fbBtn.getAttribute('data-fresh')) === '1' && (await fbBtn.innerText()).includes('개발자에게 피드백') && (await page.getByTestId('settings-portal-link').count()) === 0 && (await page.getByTestId('settings-view-as').count()) === 0 && (await page.getByTestId('settings-account-switch').count()) === 0)
  await fbBtn.click()
  await page.waitForURL(/\/feedback$/, { timeout: 10000 })
  await page.waitForTimeout(600)
  check('팀장(D-188): 설문 9문항(1~5점 4 · 여러 개 3 · 하나 1 · 직접 쓰기 1) · 보내기는 답하기 전 꺼짐', (await page.getByTestId('feedback-q').count()) === 9 && (await page.locator('[data-testid="feedback-q"][data-kind="rating"]').count()) === 4 && (await page.locator('[data-testid="feedback-q"][data-kind="multi"]').count()) === 3 && (await page.getByTestId('feedback-send').isDisabled()))
  const q = (i) => page.getByTestId('feedback-q').nth(i)
  await q(0).getByRole('radio', { name: '4점' }).click()
  await q(4).getByRole('button', { name: '고객 관리', exact: true }).click()
  await q(4).getByRole('button', { name: '서류 올리기', exact: true }).click()
  await q(5).getByRole('button', { name: '휴대폰에서 쓰기 불편' }).click()
  await q(7).getByRole('button', { name: '서류함', exact: true }).click()
  await page.getByLabel(/그 밖에 하고 싶은 말/).fill('업체 상세에서 서류 탭이 바로 보였으면 좋겠어요')
  check('팀장(D-188): 답한 질문 수 5 / 9 · 여러 개 고르기 두 개 다 켜짐', /5\s*\/\s*9/.test(await page.getByTestId('feedback-count').innerText()) && (await q(4).locator('[aria-pressed="true"]').count()) === 2)
  await shot(page, 'pilot-07a-feedback-form')
  {
    const vp0 = page.viewportSize()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(400)
    check('팀장(D-188): 설문 휴대폰 390 — 가로 넘침 0 · 보내기 단추 화면 안', (await overflowX(page)) <= 0 && (await page.getByTestId('feedback-send').isVisible()))
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/pilot-07b-feedback-390.png` })
    await page.setViewportSize(vp0)
    await page.waitForTimeout(300)
  }
  await page.getByTestId('feedback-send').click()
  await page.getByTestId('feedback-sent').waitFor({ timeout: 15000 }).catch(() => {})
  const fbRow = JSON.parse(sql(`select coalesce((select payload::text from public.module_data where workspace_id = '${PILOT_WS}' and module_key = 'feedback' and bucket = 'responses' order by created_at desc limit 1), '{}')`) || '{}')
  check('팀장(D-188): 보내면 "보냈어요" · 팀장 작업공간에 저장(DB) · 답 그대로 · 대표 작업공간엔 없음', (await page.getByTestId('feedback-sent').count()) === 1 && fbRow.answers?.easy === 4 && JSON.stringify(fbRow.answers?.used) === JSON.stringify(['고객 관리', '서류 올리기']) && fbRow.answers?.first === '서류함' && String(fbRow.answers?.note ?? '').includes('서류 탭') && fbRow.readAt === null && sql(`select count(*) from public.module_data where workspace_id = '${OWNER_WS}' and module_key = 'feedback'`) === '0', JSON.stringify(fbRow).slice(0, 300))
  check('팀장(D-188): 내가 보낸 피드백 — "아직 안 읽음"', ((await page.getByTestId('feedback-history').innerText()) ?? '').includes('아직 안 읽음'))
  await shot(page, 'pilot-07-feedback-sent')
  await go(page, '/feedback/inbox')
  check('팀장(D-188): 받은 피드백함 주소는 막힘(대표만)', (await bodyText(page)).includes('화면을 찾지 못했습니다'))
  await go(page, '/')
  check('팀장(D-188 · D-290): 보낸 뒤 메뉴 설정 줄 "새 설문" 표시 사라짐', (await page.locator('aside a[href="/settings"]').count()) >= 1 && (await page.locator('aside [data-testid="settings-feedback-fresh"]').count()) === 0)
  await go(page, '/ops/clients')
  const pHub = await bodyText(page)
  check('팀장(D-171): 고객 관리 — "잠재고객" 칸 · 돈 칸은 "미수금"', pHub.includes('잠재고객') && pHub.includes('미수금') && !pHub.includes('못 받은 내 돈'), pHub.slice(0, 300))
  check('팀장(D-181): 고객 관리에 중소기업 · 컨설턴트 고객 탭 없음 · 내 업체는 그대로 보임', (await page.getByTestId('client-type-tabs').count()) === 0 && !pHub.includes('컨설턴트 고객') && pHub.includes('은혜테스트정밀'))
  // D-182: 영업 보드 새 잠재고객 — 팀장 화면에는 '어디로 분류할까요?' 도 · 카드의 '컨설턴트' 표시도 없다
  await go(page, '/sales/board')
  const npBtn = page.getByRole('button', { name: /새 잠재고객/ })
  if (await npBtn.count()) {
    await npBtn.first().click()
    await page.waitForTimeout(400)
  }
  check('팀장(D-182): 영업 보드 새 잠재고객 창에 "어디로 분류할까요?" 없음', (await npBtn.count()) > 0 && (await page.getByRole('dialog').count()) === 1 && (await page.getByTestId('prospect-client-type').count()) === 0 && (await page.getByTestId('sales-card-consultant').count()) === 0)

  await go(page, '/ops/calendar')
  const cal = await bodyText(page)
  check('흐름: 일정 달력 — 내 업체만(대표 자료 0)', leaked(cal).length === 0 && (cal.includes('은혜테스트정밀') || cal.includes('서류 받기')), cal.slice(0, 200))
  await go(page, '/journal')
  check('흐름: 찾기 — 내 업체는 찾힌다(찾기가 실제로 돈다)', (await searchFor(page, '은혜테스트')).includes('은혜테스트정밀'))
  check('흐름: 찾기 — 대표 업체는 안 찾힌다', leaked(await searchFor(page, '대표비밀')).length === 0)
  check('흐름: 업무 일기 — 내 기록만', (await bodyText(page)).includes('박대표와 통화') && leaked(await bodyText(page)).length === 0)

  check('Pilot 세션 전체: REST 응답 어디에도 대표 자료 · 대표 작업공간 id 없음', restLog.filter((x) => x.who === PILOT.email).every((x) => leaked(x.body).length === 0 && !x.body.includes(OWNER_WS) && !x.url.includes(OWNER_WS)), restLog.filter((x) => leaked(x.body).length > 0 || x.body.includes(OWNER_WS)).map((x) => x.url).join(' '))
  check('Pilot 세션 전체: 요청 수(참고)', restLog.length > 20, String(restLog.length))

  // 로그아웃 → 뒤로 가기 → 다시 로그인
  await page.evaluate(() => localStorage.setItem('axmvp.qa.pilotDraft', '은혜 작성 중'))
  await logout(page)
  await page.goBack().catch(() => {})
  await page.waitForTimeout(900)
  const back = await bodyText(page)
  check('로그아웃 뒤 뒤로 가기: 자료가 다시 보이지 않음(로그인 화면)', !back.includes('은혜테스트정밀') && leaked(back).length === 0 && page.url().includes('/login'), page.url())
  await login(page, PILOT)
  await go(page, '/ops/clients')
  const again = await bodyText(page)
  check('다시 로그인: 내 업체 그대로 · 대표 업체 없음', again.includes('은혜테스트정밀') && leaked(again).length === 0, again.slice(0, 200))
  check('다시 로그인: 이름 "최은혜 팀장" 그대로', /최은혜\s*팀장/.test(await page.locator('[data-testid="sidebar-account"]').innerText()))
  check('다시 로그인: 내가 남긴 브라우저 값이 돌아옴', (await page.evaluate(() => localStorage.getItem('axmvp.qa.pilotDraft'))) === '은혜 작성 중')
  await logout(page)

  /* ================= 5. 대표 다시 — Pilot 것이 섞이지 않고 내 값은 돌아온다 ================= */
  await login(page, OWNER)
  await go(page, '/ops/clients')
  const own2 = await bodyText(page)
  check('대표 다시: 내 업체 그대로 · Pilot 업체 없음', own2.includes('대표비밀정밀') && !own2.includes('은혜테스트정밀'), own2.slice(0, 200))
  const ownLs = await page.evaluate(() => ({ d: localStorage.getItem('axmvp.qa.ownerDraft'), p: localStorage.getItem('planChecklist:대표비밀정밀'), pd: localStorage.getItem('axmvp.qa.pilotDraft') }))
  check('대표 다시: 내 브라우저 값 돌아옴 · Pilot 값 안 보임', ownLs.d === '대표비밀 작성 중 메모' && ownLs.p !== null && ownLs.pd === null, JSON.stringify(ownLs))
  check('대표 다시: 찾기 — 내 업체는 찾힌다(같은 시험이 대표에게는 보인다는 대조)', (await searchFor(page, '대표비밀')).includes('대표비밀정밀'))
  check('대표 다시: 찾기 — Pilot 업체는 안 찾힌다', !(await searchFor(page, '은혜테스트')).includes('은혜테스트정밀'))
  await go(page, '/journal')
  check('대표 다시: 업무 일기에 Pilot 기록 없음', !((await page.locator('main').innerText()) ?? '').includes('은혜테스트정밀') && !((await page.locator('main').innerText()) ?? '').includes('박대표와 통화'))

  /* ---------- INT-1 동시 저장 보호(진짜 DB) — 화면을 연 사이 다른 곳(다른 창 · 다른 사람)이 고친 업체를 이 화면 저장이 덮어쓰지 않는다 ---------- */
  {
    const typeOf = () => sql(`select coalesce(payload->>'clientType','') from public.operations_clients where id = '${OWNER_CLIENT}'`) || 'sme'
    const contactOf = () => sql(`select coalesce(payload->>'contactName','') from public.operations_clients where id = '${OWNER_CLIENT}'`)
    const toggleType = async () => {
      await page.getByRole('button', { name: /더보기/ }).first().click()
      await page.getByTestId('more-client-type').click()
      await page.waitForTimeout(1500)
      return (await page.locator('[role="status"]').allInnerTexts().catch(() => [])).join(' | ')
    }
    await go(page, `/ops/clients/${OWNER_CLIENT}`)
    await page.waitForTimeout(800)
    const t0 = typeOf()
    const c0 = contactOf()
    sql(`update public.operations_clients set payload = jsonb_set(payload, '{contactName}', '"다른 곳에서 고친 담당자"') where id = '${OWNER_CLIENT}'`)
    // D-547(SYNC-2) 예전(INT-1)에는 막고 '먼저 고쳐서…' 알림 뒤 다시 눌러야 했다 — 지금은 서로 다른 칸이면 둘 다 살려 합쳐 저장
    const toastC = await toggleType()
    check('안정(INT-1 → D-547): 화면을 연 사이 다른 곳이 담당자를 고친 업체 — 덮어쓰지 않고 합쳐서 저장(진짜 DB) · "합쳐서 저장" 알림 · 고객 종류도 저장', toastC.includes('합쳐서 저장') && contactOf() === '다른 곳에서 고친 담당자' && typeOf() !== t0, JSON.stringify({ toastC, c: contactOf(), t: typeOf(), t0 }))
    await page.waitForTimeout(800)
    await toggleType()
    check('안정(INT-1 → D-547): 같은 창에서 이어서 저장(되돌림)은 막히지 않음 · 다른 곳 담당자 그대로', typeOf() === t0 && contactOf() === '다른 곳에서 고친 담당자', JSON.stringify({ t: typeOf(), t0, c: contactOf() }))
    sql(`update public.operations_clients set payload = jsonb_set(payload, '{contactName}', '"두 번째로 고친 담당자"') where id = '${OWNER_CLIENT}'`)
    await page.waitForTimeout(800)
    await toggleType()
    check('안정(INT-1 → D-547): 한 번 더 다른 곳이 고쳐도 다시 합쳐 저장 · 덮어쓰기 0', typeOf() !== t0 && contactOf() === '두 번째로 고친 담당자', JSON.stringify({ t: typeOf(), t0, c: contactOf() }))
    await page.waitForTimeout(800)
    await toggleType()
    sql(`update public.operations_clients set payload = jsonb_set(payload, '{contactName}', '${JSON.stringify(c0)}') where id = '${OWNER_CLIENT}'`)
  }

  /* ---------- D-184: 계정 바꾸기 — 이 기기에서 로그인했던 계정(이메일 · 이름만) → 비밀번호만 넣고 대표 ↔ 팀장 ---------- */
  {
    const store = await page.evaluate(() => ({ recent: localStorage.getItem('axmvp.auth.recent') ?? '', all: JSON.stringify(Object.entries(localStorage)) + JSON.stringify(Object.entries(sessionStorage)) }))
    const recent = JSON.parse(store.recent || '[]')
    check('계정(D-184): 이 기기 계정 목록 = 대표 · 팀장 둘(접근 없는 가입자는 남기지 않음)', recent.map((r) => r.email).sort().join() === [OWNER.email, PILOT.email].sort().join(), store.recent)
    check('계정(D-184): 남긴 칸은 이메일 · 이름 · 직함 · 시각뿐', recent.every((r) => Object.keys(r).sort().join() === 'at,email,name,title'), store.recent)
    check('계정(D-184): 브라우저 저장소 어디에도 비밀번호 없음', USERS.every((u) => !store.all.includes(u.password)))
    const switchVia = async (who) => {
      await page.getByRole('button', { name: '사용자 메뉴' }).click()
      const sw = page.getByTestId('account-switch-to')
      const info = { n: await sw.count(), email: await sw.first().getAttribute('data-email').catch(() => ''), text: await sw.first().innerText().catch(() => ''), out: await page.getByTestId('account-signout').count() }
      if (who === PILOT) await shot(page, 'acct-01-owner-menu')
      await sw.first().click()
      await page.waitForURL((x) => x.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {})
      // 로그인 화면이 다 그려질 때까지(바꿀 계정 이메일이 들어갈 때까지) — 시험 기계가 바쁠 때 0.7초로는 모자랐다
      await page.waitForFunction(() => !!document.getElementById('email')?.value, null, { timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(300)
      const pre = await page.evaluate(() => ({ email: document.getElementById('email')?.value ?? '', focus: document.activeElement?.id ?? '', text: document.body.innerText }))
      return { info, pre }
    }
    const toPilot = await switchVia(PILOT)
    check('계정(D-184): 대표 메뉴에 "최은혜 팀장 계정으로 바꾸기" 하나 · 로그아웃 하나', toPilot.info.n === 1 && toPilot.info.email === PILOT.email && /최은혜 팀장 계정으로 바꾸기/.test(toPilot.info.text) && toPilot.info.out === 1, JSON.stringify(toPilot.info))
    check('계정(D-184): 바꾸기 → 로그인 화면 · 팀장 이메일이 미리 들어감 · 비밀번호 칸에 커서', page.url().includes('/login') && toPilot.pre.email === PILOT.email && toPilot.pre.focus === 'password', JSON.stringify({ u: page.url(), e: toPilot.pre.email, f: toPilot.pre.focus }))
    check('계정(D-184): 로그인 화면 안내 "최은혜 팀장 계정으로 로그인합니다" · 계정 둘', toPilot.pre.text.includes('최은혜 팀장 계정으로 로그인합니다') && (await page.getByTestId('recent-account').count()) === 2)
    check('계정(D-184): 로그인 화면에 대표 자료 0(이메일 · 이름만)', leaked(toPilot.pre.text).length === 0, leaked(toPilot.pre.text).join())
    // D-578 로그인 화면 — PC 넓은 화면은 옆에 '무엇을 해 주는 프로그램인지' 세 줄 · 입력 글자 16px(아이폰 확대 없음) · 이름표 15px
    const loginLook = await page.evaluate(() => {
      const intro = document.querySelector('[data-testid="auth-intro"]')
      const px = (sel) => parseFloat(getComputedStyle(document.querySelector(sel)).fontSize)
      return { shown: !!intro && getComputedStyle(intro).display !== 'none', rows: intro?.querySelectorAll('li').length ?? 0, text: intro?.textContent ?? '', input: px('input#email'), label: px('label[for="email"]') }
    })
    check('로그인(D-578): PC 옆 소개 세 줄(고객 · 서류 / 일정 · 업무 / 마케팅) · 가격 · 원 0 · 입력 글자 16px 이상 · 이름표 15px 이상', loginLook.shown && loginLook.rows === 3 && /고객 · 서류/.test(loginLook.text) && /마케팅/.test(loginLook.text) && !/원|요금|무료/.test(loginLook.text) && loginLook.input >= 16 && loginLook.label >= 15, JSON.stringify({ ...loginLook, text: loginLook.text.slice(0, 40) }))
    await shot(page, 'acct-02-login-switch')
    currentWho = PILOT
    await page.getByLabel('비밀번호').fill(PILOT.password)
    await page.getByRole('button', { name: /^로그인/ }).click()
    await page.waitForURL((x) => !x.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {})
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(900)
    check('계정(D-184): 로그인하면 바꿀 계정 표시는 지움', (await page.evaluate(() => localStorage.getItem('axmvp.auth.switch_to'))) === null)
    await go(page, '/ops/clients')
    const asPilot = await bodyText(page)
    check('계정(D-184): 비밀번호만 넣고 팀장으로 — 팀장 업체만 · 대표 자료 0 · 이름 최은혜 팀장', asPilot.includes('은혜테스트정밀') && leaked(asPilot).length === 0 && /최은혜\s*팀장/.test(await page.locator('[data-testid="sidebar-account"]').innerText()), leaked(asPilot).join())
    // D-189: 팀장 메뉴에는 다른 계정으로 바꾸기가 없다(대표만 바꾼다) — 로그아웃만
    await page.getByRole('button', { name: '사용자 메뉴' }).click()
    await page.waitForTimeout(300)
    const pMenu = (await page.getByTestId('account-switch').first().innerText()) ?? ''
    check('계정(D-189): 팀장 메뉴에는 "김상호 대표 계정으로 바꾸기" 없음 · 다른 계정 줄 0 · 로그아웃만', (await page.getByTestId('account-switch-to').count()) === 0 && (await page.getByTestId('account-signout').count()) === 1 && !pMenu.includes('계정으로 바꾸기'), pMenu.replace(/\n/g, '|'))
    await shot(page, 'acct-03-pilot-menu')
    await page.getByTestId('account-signout').click()
    await page.waitForURL((x) => x.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(700)
    check('계정(D-189): 팀장 로그아웃 → 로그인 화면(바꿀 계정 미리 넣기 없음)', page.url().includes('/login') && (await page.evaluate(() => document.getElementById('email')?.value ?? '')) === '')
    currentWho = OWNER
    await page.locator('#email').fill(OWNER.email)
    await page.getByLabel('비밀번호').fill(OWNER.password)
    await page.getByRole('button', { name: /^로그인/ }).click()
    await page.waitForURL((x) => !x.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {})
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(900)
    await go(page, '/ops/clients')
    const backOwner = await bodyText(page)
    check('계정(D-184): 대표로 돌아옴 — 내 업체 그대로 · 팀장 업체 없음 · 내 브라우저 값 그대로', backOwner.includes('대표비밀정밀') && !backOwner.includes('은혜테스트정밀') && (await page.evaluate(() => localStorage.getItem('axmvp.qa.ownerDraft'))) === '대표비밀 작성 중 메모', backOwner.slice(0, 200))
  }

  /* ---------- D-168: 연구소 메뉴를 여러 번 오가도 화면이 멈추지 않는다(클라우드 모드에서 연구노트 뒤 멈춤) ---------- */
  {
    // D-552 맨 첫 주소는 대화창 — 목차를 오가는 시험이라 목차 화면(한눈에 보기)에서 시작
    await go(page, '/tools/labcare/dashboard')
    const labNames = ['한눈에 보기', '오늘 할 일', '업체 목록', '설립 가능성 체크', '설립서류 관리', '조직도·도면', '연구노트', '변경사항 관리', '활동조사 관리', '월간 점검', '현장조사 대비', '결과서', '안내문·자료실', '설정·백업']
    const labKey = { '한눈에 보기': 'dashboard', '오늘 할 일': 'tasks', '업체 목록': 'clients', '설립 가능성 체크': 'assessment', '설립서류 관리': 'setup-docs', '조직도·도면': 'org-diagram', '연구노트': 'notes', '변경사항 관리': 'changes', '활동조사 관리': 'survey', '월간 점검': 'check', '현장조사 대비': 'inspection', '결과서': 'reports', '안내문·자료실': 'resources', '설정·백업': 'settings' }
    const stuck = []
    for (const name of [...labNames, ...[...labNames].reverse()]) {
      await page.getByRole('link', { name, exact: true }).first().click()
      await page.waitForTimeout(450)
      const shown = await page.locator('[data-testid="lab-orig"]').getAttribute('data-section').catch(() => null)
      if (shown !== labKey[name]) stuck.push(`${name}→${shown}`)
    }
    check('연구소(D-168): 메뉴 28번 오가도 화면이 그 메뉴로 바뀐다(멈춤 없음)', stuck.length === 0, stuck.slice(0, 4).join(' · '))
  }

  /* ---------- D-188: 대표 — 받은 피드백함 · 빨간 숫자 · 종 · 읽음 ---------- */
  {
    await go(page, '/ops/clients')
    const oside = (await page.locator('aside').first().innerText()) ?? ''
    const unreadDot = page.locator('aside [data-testid="settings-feedback-unread"]').first()
    check('대표(D-188 · D-290): 사이드바 버전 글자 없음 · 메뉴 설정 줄에 새 피드백 1', !oside.includes('v0.1.0') && (await unreadDot.count()) === 1 && ((await unreadDot.innerText()) ?? '').trim() === '1', oside.replace(/\n/g, '|').slice(-160))
    await go(page, '/settings')
    const inboxBtn = page.locator('[data-testid="settings-feedback"] [data-testid="feedback-inbox-open"]').first()
    await shot(page, 'owner-d290-settings')
    check('대표(D-290 · SAAS-1): 설정 › 계정 · 보기 — [받은 피드백함] + 새 피드백 1 · 보는 화면(대표 ↔ 팀장) · 왼쪽 아래 로그아웃 하나 · 브랜드 칸 대신 "대표 AI 는 지금 기준 그대로" 안내', (await inboxBtn.count()) === 1 && (await inboxBtn.getAttribute('data-unread')) === '1' && (await page.locator('[data-testid="settings-view-as"] [data-testid="view-as-switch"]').count()) === 1 && (await page.locator('aside [data-testid="sidebar-signout"]').count()) === 1 && (await page.getByTestId('brand-owner-note').count()) === 1 && (await page.getByTestId('brand-settings').count()) === 0)
    await page.locator('header button[aria-label^="챙길 것"]').first().click()
    await page.waitForTimeout(300)
    const bellFb = page.getByTestId('bell-feedback')
    check('대표(D-188): 종에 "최은혜 팀장 — 새 피드백 1건"', (await bellFb.count()) === 1 && /최은혜.*새 피드백 1건/.test(await bellFb.innerText()), await bellFb.innerText().catch(() => ''))
    await bellFb.click()
    await page.waitForURL(/\/feedback\/inbox$/, { timeout: 10000 })
    await page.getByTestId('feedback-entry').first().waitFor({ timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(1200)
    const ent = page.getByTestId('feedback-entry').first()
    const entText = (await ent.innerText()) ?? ''
    check('대표(D-188): 받은 피드백함 — 보낸 사람 · 새로 표시 · 점수 · 고른 것 · 직접 쓴 말이 정리돼 보임', (await ent.getAttribute('data-fresh')) === '1' && entText.includes('최은혜') && entText.includes('고객 관리') && entText.includes('서류함') && entText.includes('서류 탭이 바로 보였으면'), entText.slice(0, 300))
    check('대표(D-188): 모아 보기 — 편한가 평균 4 / 5', ((await page.getByTestId('feedback-avg').first().innerText()) ?? '').includes('4 / 5'))
    // D-222 '몇 명' 이 아니라 응답 건수였다 — 한 사람이 두 번 보내면 '2명' 으로 보이던 것
    check('대표(D-222): 모아 보기 기준 — "(응답 1건 · 1명)"', /응답 1건 · 1명/.test((await page.getByTestId('feedback-basis').innerText().catch(() => '')) ?? ''), await page.getByTestId('feedback-basis').innerText().catch(() => 'none'))
    const readAt = sql(`select coalesce(payload->>'readAt', '') from public.module_data where workspace_id = '${PILOT_WS}' and module_key = 'feedback' order by created_at desc limit 1`)
    check('대표(D-188): 열면 읽음으로 적힘(DB readAt) · 사이드바 숫자 사라짐', readAt.length > 10 && (await page.locator('aside [data-testid="settings-feedback-unread"]').count()) === 0, readAt)
    await shot(page, 'owner-feedback-inbox')
  }

  /* ---------- D-164: 대표 → 최은혜 팀장 화면 바로 보기(다시 로그인 없이) ---------- */
  // D-296 머리줄 단추는 없앴다 — 설정 › 계정 · 보기 › 보는 화면에서만
  await go(page, '/settings')
  const vs = page.locator('[data-testid="settings-view-as"] [data-testid="view-as-switch"]')
  check('대표(D-164 · D-296): 머리줄에는 전환 단추 없음 · 설정 › 보는 화면에 [대표 | 최은혜 팀장]', (await page.locator('header [data-testid="view-as-switch"], header [data-testid="view-as-compact"]').count()) === 0 && (await vs.count()) === 1 && /최은혜\s*팀장/.test(await vs.innerText()), await vs.innerText().catch(() => ''))
  // D-558 대표: "팀장 비밀번호를 잊었다 — 이름을 누르면 그 아래에서 대표 ↔ 팀장 왔다 갔다" — 머리줄 사용자 메뉴 안(이름 바로 아래)에도 같은 전환
  await page.getByRole('button', { name: '사용자 메뉴' }).click()
  const mv = page.locator('[data-testid="usermenu-viewas"] [data-testid="view-as-switch"]')
  check('대표(D-558): 머리줄 사용자 메뉴 — 이름 아래 보는 화면 [대표 | 최은혜 팀장](닫힌 머리줄에는 그대로 없음)', (await mv.count()) === 1 && /최은혜\s*팀장/.test(await mv.innerText().catch(() => '')), await mv.innerText().catch(() => ''))
  await page.keyboard.press('Escape')
  await page.mouse.click(5, 400)
  restLog = []
  await vs.locator('[data-view="pilot"]').click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  await go(page, '/ops/clients')
  const pv = await bodyText(page)
  check('대표 → 팀장 화면: 팀장 업체(은혜테스트정밀)가 보인다', pv.includes('은혜테스트정밀'), pv.slice(0, 300))
  check('대표 → 팀장 화면: 대표 업체는 안 보인다(팀장 작업공간 자료만)', leaked(pv).length === 0, leaked(pv).join())
  check('대표 → 팀장 화면: "최은혜 팀장 화면을 보고 있습니다" 줄', (await page.getByTestId('viewing-pilot').count()) === 1)
  {
    const ec = sql(`select id from public.operations_clients where workspace_id = '${PILOT_WS}' and company_name = '은혜테스트정밀(주)'`)
    await go(page, `/ops/clients/${ec}?tab=work`)
    const vw = await bodyText(page)
    check('대표 → 팀장 화면(D-188): 업무 탭도 팀장처럼 — 기본 6종 없음 · 팀장이 고른 항목만', !vw.includes('특허 출원') && !vw.includes('AX 기획 및 개발') && vw.includes('기업부설연구소 설립'), vw.slice(0, 300))
    await go(page, '/feedback')
    await page.getByTestId('feedback-q').first().getByRole('radio', { name: '3점' }).click()
    check('대표 → 팀장 화면(D-188): 피드백 설문은 미리 보기만(보내기 꺼짐 · 안내)', (await page.getByTestId('feedback-viewing').count()) === 1 && (await page.getByTestId('feedback-send').isDisabled()))
    await go(page, '/ops/clients')
  }
  await shot(page, 'owner-as-pilot')
  // D-166: 휴대폰에서는 이 띠가 한 줄(대표가 폰에서 본 세 줄짜리 큰 띠)
  {
    const vp0 = page.viewportSize()
    await page.setViewportSize({ width: 390, height: 844 })
    await go(page, '/grants')
    const band = page.getByTestId('viewing-pilot')
    const bh = (await band.boundingBox())?.height ?? 999
    check('휴대폰(D-166): 팀장 화면 띠가 한 줄(56px 이하) · 돌아가기 단추 있음', bh <= 56 && (await band.getByRole('button').count()) === 1, String(bh))
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/owner-as-pilot-390.png` })
    await page.setViewportSize(vp0)
    await go(page, '/ops/clients')
  }
  const pnav = (await page.locator('aside').first().innerText()) ?? ''
  check('대표 → 팀장 화면: 메뉴가 팀장과 같다(영업자 정산 · 상담신청 · 이 시스템 없음)', !pnav.includes('영업자 정산') && !pnav.includes('상담신청') && !pnav.includes('이 시스템'), pnav.replace(/\n/g, '|').slice(0, 300))
  check('대표 → 팀장 화면: 이름 칸 "최은혜 팀장"', /최은혜\s*팀장/.test(await page.locator('[data-testid="sidebar-account"]').innerText()))
  check('P7 대표 → 팀장 화면(D-195): 마케팅 · 브랜딩 메뉴 없음', !pnav.includes('마케팅'), pnav.replace(/\n/g, '|').slice(0, 300))
  await go(page, '/ops/agents')
  check('대표 → 팀장 화면: 대표 전용 주소도 팀장처럼 막힘', (await bodyText(page)).includes('화면을 찾지 못했습니다'))
  check('AI 대표 → 팀장 화면: AI 전략실 메뉴 없음', !pnav.includes('AI 전략실'), pnav.replace(/\n/g, '|').slice(0, 300))
  {
    // D-257 대표가 팀장 화면으로 볼 때도 팀장과 같게 — AI 띠는 있고 회사는 Gemini 만
    await go(page, '/')
    const hasBar = (await page.getByTestId('ai-assist-bar').count()) >= 1
    await page.getByTestId('ai-assist-chip').first().click()
    await page.getByTestId('ai-assist-confirm-go').click() // D-289 고른 뒤 [이대로 질문하기]
    await page.getByTestId('ai-assist-model-toggle').first().waitFor({ timeout: 8000 }).catch(() => {})
    await page.getByTestId('ai-assist-model-toggle').first().click().catch(() => {})
    await page.waitForTimeout(500)
    const vt = await page.locator('[data-testid="ai-assist-settings"] [role="tab"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-provider')))
    check('AI 대표 → 팀장 화면(D-257): AI 도우미 띠 있음 · 회사 탭 Gemini 하나', hasBar && vt.join() === 'gemini', vt.join())
    await page.keyboard.press('Escape')
  }
  check('D-247 대표 → 팀장 화면: 특허 · 벤처 메뉴 없음', !pnav.includes('특허 · 벤처'), pnav.replace(/\n/g, '|').slice(0, 300))
  await go(page, '/ai')
  check('AI 대표 → 팀장 화면: /ai 막힘', (await bodyText(page)).includes('화면을 찾지 못했습니다') && (await page.getByTestId('case-workspace').count()) === 0)
  for (const p of ['/marketing', '/marketing/youtube', '/marketing/youtube?view=analysis']) {
    await go(page, p)
    const t = await bodyText(page)
    check(`P8 대표 → 팀장 화면(D-195): ${p} 막힘 · 대표 콘텐츠 기록 0`, t.includes('화면을 찾지 못했습니다') && (await page.getByTestId('yt-page').count()) === 0 && leaked(t).length === 0, t.slice(0, 120))
  }
  await go(page, '/settings')
  check('대표 → 팀장 화면: 설정 이름 칸 대신 안내(여기서 저장하면 대표 이름이 바뀌므로)', (await page.getByTestId('name-editor-viewing').count()) === 1 && (await page.getByTestId('name-input').count()) === 0)
  await go(page, '/')
  // 팀장 화면을 보는 동안 본문 위 띠의 [대표로 돌아가기] 한 번(D-296 머리줄 단추 대신)
  await page.getByTestId('viewing-pilot-back').click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  await go(page, '/ops/clients')
  const back2 = await bodyText(page)
  check('팀장 → 대표 화면: 대표 업체 다시 · 팀장 줄 없음 · 대표 메뉴', back2.includes('대표비밀정밀') && (await page.getByTestId('viewing-pilot').count()) === 0 && ((await page.locator('aside').first().innerText()) ?? '').includes('영업자 정산'))
  check('P1 대표(D-195): 마케팅 · 브랜딩 메뉴 보임', ((await page.locator('aside').first().innerText()) ?? '').includes('마케팅 · 브랜딩'))
  check('AI 대표: 사이드바에 AI 전략실', ((await page.locator('aside').first().innerText()) ?? '').includes('AI 전략실'))
  await go(page, '/ai')
  await page.getByTestId('case-new').waitFor({ timeout: 8000 }).catch(() => {})
  check('AI 대표: /ai 열림(업체 등록 단추 · 권한 막힘 안내 없음)', (await page.getByTestId('case-new').count()) === 1 && (await page.getByTestId('owner-ai-denied').count()) === 0 && (await page.getByTestId('owner-ai-db-setup').count()) === 0, (await bodyText(page)).slice(0, 200))
  await go(page, '/marketing/youtube')
  check('P2 대표(D-195): /marketing/youtube 열림(콘텐츠 레이더 화면)', (await page.getByTestId('yt-page').count()) === 1 && !(await bodyText(page)).includes('화면을 찾지 못했습니다'))
  check('대표 데이터 그대로(D-195): 대표 콘텐츠 레이더 기록 2줄 · 지워지거나 옮겨지지 않음', sql(`select count(*) from public.module_data where workspace_id = '${OWNER_WS}' and module_key = 'marketing'`) === '2')
  await go(page, '/ops/clients')
  check('DB(D-164): 팀장 작업공간 구성원 = 팀장(owner) · 대표(editor)', sql(`select string_agg(m.role::text, ',' order by m.role::text) from public.workspace_members m where m.workspace_id = '${PILOT_WS}'`) === 'editor,owner')
  check('DB(D-164): 팀장은 여전히 대표 작업공간 구성원 아님', sql(`select count(*) from public.workspace_members where workspace_id = '${OWNER_WS}' and user_id = '${PILOT.id}'`) === '0')

  // 대표 머리줄(전환 단추 · 보기 방식 단추가 함께) — 1024~1920 × 글자 3단계에서 옆으로 넘치지 않는다
  {
    const bad = []
    for (const w of [1024, 1280, 1366, 1440, 1920]) {
      await page.setViewportSize({ width: w, height: 900 })
      await page.waitForTimeout(250)
      for (const scale of ['default', 'large', 'extra_large']) {
        await page.evaluate((sc) => document.documentElement.setAttribute('data-text-scale', sc), scale)
        await page.waitForTimeout(150)
        const r = await page.evaluate(() => {
          const hdr = document.querySelector('header')
          const hb = hdr.getBoundingClientRect()
          const cut = [...hdr.querySelectorAll('a,button')].filter((e) => e.offsetParent !== null && e.getBoundingClientRect().right > hb.right + 1).length
          const sw = [...hdr.querySelectorAll('[data-testid="view-as-switch"],[data-testid="view-as-compact"]')].filter((e) => e.offsetParent !== null).length
          const dev = [...hdr.querySelectorAll('[data-testid="device-switch-compact"]')].filter((e) => e.offsetParent !== null).length
          return { over: hdr.scrollWidth - hdr.clientWidth, cut, sw, dev }
        })
        if (r.over > 0 || r.cut > 0 || r.sw !== 0 || r.dev !== 1) bad.push(`${w}/${scale} ${JSON.stringify(r)}`)
      }
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-text-scale', 'default'))
    check('대표 머리줄(D-164 · D-296): 5폭 × 글자 3단계 넘침 0 · 전환 단추 0 · 보기 방식 접힌 단추 늘 하나', bad.length === 0, bad.join(' | '))
    // 좁은 PC(1280) — 설정 › 보는 화면 → 팀장 화면 → 띠의 [대표로 돌아가기]
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.waitForTimeout(300)
    await go(page, '/settings')
    await page.locator('[data-testid="settings-view-as"] [data-testid="view-as-switch"] [data-view="pilot"]').click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    await go(page, '/ops/clients')
    const pv2 = await bodyText(page)
    check('대표 1280(D-164 · D-296): 설정에서 팀장 화면 · 대표 업체 안 보임', (await page.getByTestId('viewing-pilot').count()) === 1 && pv2.includes('은혜테스트정밀') && leaked(pv2).length === 0)
    await shot(page, 'owner-1280-viewing-pilot')
    await page.getByTestId('viewing-pilot-back').click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    await go(page, '/ops/clients')
    check('대표 1280(D-164): 다시 대표 화면', (await page.getByTestId('viewing-pilot').count()) === 0 && (await bodyText(page)).includes('대표비밀정밀'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(300)
  }

  /* ---------- D-164: 보기 방식 — PC+Mobile(같은 로그인 · 같은 자료) ---------- */
  // D-296 보기 방식은 접힌 단추 하나 — 눌러서 고른다
  await page.locator('header [data-testid="device-switch-compact"] button[aria-haspopup]').click()
  await page.locator('header [data-testid="device-switch-compact"] [data-mode="dual"]').click()
  await page.waitForTimeout(3500)
  const dualPc = page.frameLocator('[data-testid="dual-pc"] iframe')
  const dualMo = page.frameLocator('[data-testid="device-frame"] iframe')
  const dpcText = await dualPc.locator('body').innerText().catch(() => '')
  const dmoText = await dualMo.locator('body').innerText().catch(() => '')
  check('PC+Mobile: 양쪽 모두 로그인된 같은 자료(대표 업체)', dpcText.includes('대표비밀정밀') && dmoText.includes('대표비밀정밀'), `${dpcText.slice(0, 80)} || ${dmoText.slice(0, 80)}`)
  await shot(page, 'owner-dual')
  check('PC+Mobile: 휴대폰 칸은 진짜 390px · 안에 보기 단추 없음(재귀 없음)', (await dualMo.locator('body').evaluate(() => window.innerWidth)) === 390 && (await dualMo.locator('[data-testid="device-switch"]').count()) === 0)
  // 클라우드 저장 → 다른 쪽 화면도 새로 읽는다(손대지 않은 쪽만 새로 연다)
  await dualPc.locator('aside').getByRole('link', { name: '오늘' }).first().click()
  await page.waitForTimeout(3000)
  // D-192: 휴대폰 오늘 화면은 '무슨 일이 있었나요?' 가 접혀 시작한다 — 펼쳐 둔다(이 기기에 기억 → 새로 읽어도 펼친 채)
  const moCapture = dualMo.locator('[data-fold="today.capture"]')
  await moCapture.waitFor({ timeout: 8000 }).catch(() => {})
  if ((await moCapture.getAttribute('data-open').catch(() => '1')) === '0') {
    await moCapture.getByTestId('fold-toggle').click()
    await page.waitForTimeout(300)
  }
  const memo = '동시보기 확인 메모 ' + Date.now().toString().slice(-5)
  await openFoldIn(dualPc, 'today.capture')
  await dualPc.getByLabel('기록 내용').first().fill(memo)
  await dualPc.getByRole('button', { name: /^기록$/ }).first().click()
  let moSaw = false
  for (let i = 0; i < 16 && !moSaw; i += 1) {
    await page.waitForTimeout(500)
    moSaw = ((await dualMo.locator('body').innerText().catch(() => '')) ?? '').includes(memo)
  }
  check('PC+Mobile(클라우드): PC 쪽에서 적은 기록이 휴대폰 쪽에도 보인다', moSaw && sql(`select count(*) from public.ops_journal_entries where content = '${memo}'`) === '1')
  await page.locator('[data-testid="device-switch"] [data-mode="pc"]').first().click()
  await page.waitForTimeout(2500)
  await logout(page)
  await ctx.close()

  /* ================= 6. 휴대폰 390 — Pilot ================= */
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
  await m.route(`https://${REF}.supabase.co/**`, route)
  const mp = await m.newPage()
  mp.on('pageerror', (e) => errors.push(String(e)))
  await login(mp, PILOT)
  // D-185: 새 기기(휴대폰)에서 처음 → 다시 뜬다 · 세로(9:16) 영상 · [앞으로 보지 않기] 는 로그인 계정 정보에 남는다
  const mtut = mp.getByTestId('tutorial-dialog')
  await mtut.waitFor({ timeout: 5000 }).catch(() => {})
  check('390 Pilot(D-185): 휴대폰 첫 로그인 → 안내 영상 창 · 세로(9:16) 영상', (await mtut.count()) === 1 && (await mp.getByTestId('tutorial-video').getAttribute('data-ratio')) === 'tall' && /part1-tall\.mp4$/.test(await vsrc(mp)))
  check('390 Pilot(D-185): 안내 영상 창 가로 넘침 0 · 단추 높이 44 이상', (await overflowX(mp)) <= 0 && ((await mp.getByTestId('tutorial-hide-forever').boundingBox())?.height ?? 0) >= 44 && ((await mp.getByTestId('tutorial-close').boundingBox())?.height ?? 0) >= 44)
  const vbox = await mp.getByTestId('tutorial-video').boundingBox()
  check('390 Pilot(D-185): 영상이 화면 안에 들어옴', !!vbox && vbox.x >= 0 && vbox.x + vbox.width <= 391 && vbox.height > 300, JSON.stringify(vbox))
  const tabBox = await mp.getByTestId('tutorial-tab-part2').boundingBox()
  const btnBox = await mp.getByTestId('tutorial-hide-today').boundingBox()
  check('390 Pilot(D-185): 영상이 위 1편/2편 고르기 · 아래 단추를 덮지 않음 · 2편 고르기도 화면 안', !!vbox && !!tabBox && !!btnBox && vbox.y >= tabBox.y + tabBox.height - 1 && vbox.y + vbox.height <= btnBox.y + 1 && tabBox.x + tabBox.width <= 391, JSON.stringify({ vbox, tabBox, btnBox }))
  if (SHOTS) await mp.screenshot({ path: `${SHOTS}/pilot-m00-tutorial.png` })
  await mp.getByTestId('tutorial-hide-forever').click()
  await mp.waitForTimeout(1200)
  check('390 Pilot(D-185): 앞으로 보지 않기 → 닫힘 · 로그인 계정 정보에 남음', (await mtut.count()) === 0 && sql(`select raw_user_meta_data->>'tutorial_hidden' from auth.users where id = '${PILOT.id}'`) === 'true')
  check('390 Pilot(D-185 · D-296): 머리줄에 안내 영상 단추 없음(더보기 판 · 설정에서) · 머리줄 넘침 0', (await mp.locator('header [data-testid="tutorial-open"]').count()) === 0 && (await overflowX(mp)) <= 0)
  const bottom = (await mp.locator('nav').last().innerText().catch(() => '')) ?? ''
  check('390 Pilot: 하단 메뉴에 상담 없음', !bottom.includes('상담'), bottom.replace(/\n/g, '|'))
  check('390 Pilot: 오늘 화면 가로 넘침 0', (await overflowX(mp)) <= 0, String(await overflowX(mp)))
  const mTiles = await mp.getByTestId('app-mini').evaluateAll((els) => els.map((e) => e.dataset.key))
  check('390 Pilot(D-282 · D-564): 휴대폰 큰 아이콘 바로가기 — 대표 전용(AI 전략실 · 특허 · 벤처) 없음 · 마케팅은 있음', mTiles.length >= 4 && mTiles.includes('marketing') && !mTiles.some((k) => ['ai-workspace', 'patent-venture'].includes(k)), mTiles)
  await shot(mp, 'pilot-m01-today')
  await mp.getByRole('button', { name: /더보기|메뉴/ }).last().click().catch(() => {})
  await mp.waitForTimeout(500)
  const drawer = await bodyText(mp)
  check('390 Pilot: 메뉴 열어도 숨긴 묶음 없음', !drawer.includes('잘 안 쓰는 기능') && !drawer.includes('이 시스템') && !drawer.includes('영업자 정산'))
  check('P3 390 Pilot(D-564): 휴대폰 메뉴에 마케팅 · 브랜딩 있음', drawer.includes('마케팅'), drawer.replace(/\n/g, '|').slice(0, 300))
  await shot(mp, 'pilot-m02-menu')
  // D-184: 휴대폰 서랍에 로그아웃(예전에는 휴대폰에서 로그아웃할 곳이 없었다) — 이 기기에는 팀장 계정 하나뿐이라 '바꾸기' 줄은 없다
  check('390 Pilot(D-184): 서랍에 로그아웃 단추 · 다른 계정 줄 없음(이 기기엔 팀장만)', (await mp.getByTestId('account-signout').count()) === 1 && (await mp.getByTestId('account-switch-to').count()) === 0)
  check('390 Pilot(D-184): 서랍의 로그아웃 단추 높이 44 이상', ((await mp.getByTestId('account-signout').boundingBox())?.height ?? 0) >= 44)
  await mp.keyboard.press('Escape')
  await go(mp, '/ops/clients')
  check('390 Pilot: 업체 목록 — 내 업체만 · 넘침 0', (await bodyText(mp)).includes('은혜테스트정밀') && leaked(await bodyText(mp)).length === 0 && (await overflowX(mp)) <= 0)
  await shot(mp, 'pilot-m03-clients')
  await go(mp, `/ops/clients/${pc}`)
  check('390 Pilot: 업체 상세 넘침 0 · 고객 화면 · 컨설팅 탭 없음', (await overflowX(mp)) <= 0 && (await mp.getByRole('tab', { name: /고객 화면|컨설팅/ }).count()) === 0)
  await shot(mp, 'pilot-m04-detail')
  await go(mp, `/ops/clients/${OWNER_CLIENT}`)
  check('390 Pilot: 대표 업체 주소 — 대표 자료 0', leaked(await bodyText(mp)).length === 0)
  // D-184: 서랍 → 로그아웃 → 로그인 화면에 이 기기 계정(팀장) · 누르면 이메일 · 이 기기에서 지우기
  await mp.getByRole('button', { name: /더보기|메뉴/ }).last().click().catch(() => {})
  await mp.waitForTimeout(500)
  await mp.getByTestId('account-signout').click()
  await mp.waitForURL((x) => x.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {})
  // 로그인 화면의 '이 기기 계정' 줄은 조금 늦게 그려진다(여럿 돌 때 700ms 로는 모자랐다) — 나올 때까지 기다린다
  await mp.getByTestId('recent-account').first().waitFor({ timeout: 10000 }).catch(() => {})
  await mp.waitForTimeout(300)
  check('390(D-184): 서랍 로그아웃 → 로그인 화면 · 이 기기 계정 1개(팀장)', mp.url().includes('/login') && (await mp.getByTestId('recent-account').count()) === 1 && (await mp.getByTestId('recent-account').getAttribute('data-email')) === PILOT.email)
  check('390(D-184): 로그인 화면 넘침 0', (await overflowX(mp)) <= 0, String(await overflowX(mp)))
  const loginLook390 = await mp.evaluate(() => {
    const intro = document.querySelector('[data-testid="auth-intro"]')
    return { hidden: !intro || getComputedStyle(intro).display === 'none', input: parseFloat(getComputedStyle(document.querySelector('input#email')).fontSize) }
  })
  check('390(D-578): 로그인 화면 — 소개 줄 없이 로그인 칸 먼저 · 입력 글자 16px 이상(누를 때 화면이 확대되지 않게)', loginLook390.hidden && loginLook390.input >= 16, JSON.stringify(loginLook390))
  await mp.getByTestId('recent-account').click()
  await mp.waitForTimeout(300)
  check('390(D-184): 계정 누르면 이메일이 들어가고 비밀번호 칸에 커서', (await mp.locator('#email').inputValue()) === PILOT.email && (await mp.evaluate(() => document.activeElement?.id)) === 'password')
  await shot(mp, 'pilot-m05-login-accounts')
  await mp.getByTestId('recent-forget').click()
  await mp.waitForTimeout(300)
  check('390(D-184): 이 기기에서 지우기 → 목록에서 빠지고 이메일 칸도 비움', (await mp.getByTestId('recent-account').count()) === 0 && (await mp.locator('#email').inputValue()) === '')
  await mp.reload({ waitUntil: 'networkidle' })
  check('390(D-184): 새로 열어도 지운 그대로', (await mp.getByTestId('recent-accounts').count()) === 0)
  await m.close()

  // D-185: 다른 기기(새 브라우저 · PC)에서도 [앞으로 보지 않기] 그대로 — 저절로 안 뜨고 머리줄로는 볼 수 있다
  const c3 = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  await c3.route(`https://${REF}.supabase.co/**`, route)
  const p3 = await c3.newPage()
  p3.on('pageerror', (e) => errors.push(String(e)))
  await login(p3, PILOT)
  await p3.waitForTimeout(800)
  check('Pilot(D-185): 다른 기기에서도 앞으로 보지 않기 그대로 — 저절로 안 뜸', (await p3.getByTestId('tutorial-dialog').count()) === 0)
  await go(p3, '/settings')
  await p3.getByTestId('settings-tutorial-open').click()
  await p3.waitForTimeout(400)
  check('Pilot(D-185 · D-296): 그래도 설정 › [안내 영상 보기] 로는 열린다', (await p3.getByTestId('tutorial-dialog').count()) === 1)
  await c3.close()

  /* ================= 7. SAAS-2 — 사용량 장부 · 이용 권한(진짜 DB 장부 0022 · 진짜 RLS) ================= */
  // SAAS-2.1 지금 팀장은 '내부 계정'(pilot_provision 이 권한 줄을 넣음) — 장부를 켜도 마케팅은 닫힌 채, 일반 AI 는 한도 없이 기록만.
  //   구독 고객으로 바꾸면(대표가 SQL 한 줄) 그때 마케팅 · 한도가 열린다.
  const USAGE_SECRET = 'pilot-e2e-usage-secret-0123456789abcdef'
  check('SAAS-2 준비 전: 장부 설정 없음(위 P1~P4 — 팀장 마케팅 화면은 열림 · 마케팅 AI 는 닫힘 · 일반 AI 예전처럼이 이 상태)', sql(`select count(*) from public.ai_usage_config`) === '0')
  check('SAAS-2.1 pilot_provision(D-564): 팀장 권한 줄 = 내부 계정(internal · 마케팅 AI 포함)', sql(`select kind || ':' || plan || ':' || marketing from public.ai_entitlements where user_id = '${PILOT.id}'`) === 'internal:internal:true')
  check('SAAS-2.1 위 P1~P4 팀장 일반 AI(장부 설정 전) — 장부 줄 0 · 예전처럼 답함', sql(`select count(*) from public.ai_usage_ledger`) === '0')
  sql(`insert into public.ai_usage_config (id, secret_hash, default_monthly_units) values (1, sha256(convert_to('${USAGE_SECRET}', 'UTF8')), 12) on conflict (id) do update set secret_hash = excluded.secret_hash, default_monthly_units = excluded.default_monthly_units`)
  process.env.AI_USAGE_SECRET = USAGE_SECRET
  const c4 = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  await c4.route(`https://${REF}.supabase.co/**`, route)
  await c4.route('**/api/ai-assist**', assistRoute)
  const p4 = await c4.newPage()
  p4.on('pageerror', (e) => errors.push(String(e)))
  await login(p4, PILOT)
  await p4.waitForTimeout(800)
  // 본문(main)만 — 왼쪽 위 제품 이름(MIRAE AI LAB OS)은 이 서비스 이름이라 대표 개인 정보가 아니다
  const OWNER_WORDS = /김상호|김팀장|미래AI랩|MIRAE|경영노트|AX Fit|3분 진단/
  const mainText = (pg) => pg.locator('main').innerText().catch(() => '')
  // D-555 AX 는 대표만 하는 컨설팅 — 접힌 칸까지(textContent) 'AX' 낱말을 찾는다
  const AXW = /.{0,24}(?<![A-Za-z])AX(?![A-Za-z]).{0,24}/g
  const axIn = async (pg) => ((await pg.locator('main').evaluate((el) => el.textContent ?? '').catch(() => '')).match(AXW) ?? [])
  const todayCtx = { title: '오늘', today: '2026-10-25', sections: [] }
  check('SAAS-2.1 내부 팀장(D-564): 왼쪽 메뉴에 마케팅 · 브랜딩', (await p4.locator('aside a[href="/marketing"]').count()) >= 1, await p4.locator('aside').innerText().catch(() => ''))
  const inRun = await assistDirect(PILOT, { requestId: 'req-saas21-int-000001', assistId: 'today.top3', page: 'today', context: todayCtx })
  check('SAAS-2.1 내부 팀장 일반 AI → 200 · DB 장부에 기록(internal · general · 정산)', inRun.statusCode === 200 && sql(`select kind || ':' || feature || ':' || status from public.ai_usage_ledger where request_id = 'req-saas21-int-000001'`) === 'internal:general:settled', `${inRun.statusCode} ${inRun.raw.slice(0, 160)}`)
  const inMk = await assistDirect(PILOT, { requestId: 'req-saas21-int-000002', assistId: 'radar.top5', page: 'radar', context: { title: '콘텐츠 레이더', today: '2026-10-25', sections: [] } })
  check('SAAS-2.1 내부 팀장 마케팅 AI(D-564) → 200 · DB 장부에 기록(internal · marketing · 정산) — 장부가 있으면 반드시 센다', inMk.statusCode === 200 && sql(`select kind || ':' || feature || ':' || status from public.ai_usage_ledger where request_id = 'req-saas21-int-000002'`) === 'internal:marketing:settled', `${inMk.statusCode} ${inMk.raw.slice(0, 160)}`)
  await go(p4, '/settings')
  await p4.getByTestId('ai-usage-numbers').waitFor({ timeout: 8000 }).catch(() => {})
  check('SAAS-2.1 내부 팀장: 설정에 "내부 계정(한도 없이 기록만)"', (await p4.getByTestId('ai-usage').getAttribute('data-kind').catch(() => '')) === 'internal' && ((await p4.getByTestId('ai-usage-numbers').innerText().catch(() => '')) ?? '').includes('내부 계정(한도 없이 기록만)'), await p4.getByTestId('ai-usage').innerText().catch(() => ''))
  await shot(p4, 'saas21-internal-settings')

  // 구독 고객으로 바꾼다(대표가 SQL Editor 에서 할 한 줄) — 시험 DB 만: 내부 기록은 지우고 0 부터
  sql(`delete from public.ai_usage_ledger where user_id = '${PILOT.id}'`)
  sql(`update public.ai_entitlements set kind = 'customer', plan = 'test', marketing = true, monthly_units = 12, active_until = now() + interval '30 days' where user_id = '${PILOT.id}'`)
  await go(p4, '/')
  check('SAAS-2 구독 고객(마케팅 포함): 왼쪽 메뉴에 마케팅 · 브랜딩', (await p4.locator('aside a[href="/marketing"]').count()) >= 1, await p4.locator('aside').innerText().catch(() => ''))
  await go(p4, '/marketing/threads')
  const mkTabs = await p4.getByTestId('mk-tabs').locator('[data-testid^="mk-tab-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))
  check('SAAS-2 팀장: 스레드 화면 열림 · 만들기 칸은 스레드 · 릴스/틱톡만(홍보 글 · 홈페이지 없음)', (await p4.getByTestId('thr-page').count()) === 1 && mkTabs.includes('mk-tab-threads') && mkTabs.includes('mk-tab-shorts') && !mkTabs.includes('mk-tab-content') && !mkTabs.includes('mk-tab-homepage'), mkTabs.join())
  const thrText = await mainText(p4)
  check('SAAS-2 팀장: 스레드 화면에 대표 이름 · 회사 · 대표 사실 0 · 대표 예시 글 단추 없음', !OWNER_WORDS.test(thrText) && !thrText.includes('100억') && (await p4.getByTestId('thr-use-example').count()) === 0, (thrText.match(OWNER_WORDS) ?? []).join())
  await shot(p4, 'saas2-pilot-threads')
  const thrAx = await axIn(p4)
  check('D-555 구독 고객: 스레드 화면(접힌 칸 · 주제 태그 · 바꿔쓰기 표 · 점검 포함)에 AX 0', thrAx.length === 0, thrAx.slice(0, 6))
  // 화면에서 AI 로 바로 쓰기(D-289 두 번 누르기) — 고객 AI 도 켜져 있고, 부르면 DB 장부에 한 줄
  aiCalls.length = 0
  await p4.locator('[data-testid="thr-qs-chip"]').first().click()
  const qsAi = p4.getByTestId('thr-qs-ai')
  const qsEnabled = (await qsAi.count()) === 1 && !(await qsAi.isDisabled())
  if (qsEnabled) {
    await qsAi.click()
    await p4.waitForTimeout(450)
    await qsAi.click()
  }
  for (let i = 0; i < 30 && aiCalls.length === 0; i += 1) await p4.waitForTimeout(500)
  await p4.waitForTimeout(1500) // 정산까지
  const uiRows = sql(`select count(*) || ':' || coalesce(sum(units), 0) from public.ai_usage_ledger where user_id = '${PILOT.id}' and assist_id = 'threads.write' and status = 'settled'`)
  check('D-555 구독 고객: 스레드 AI 지시문에 AX 0 · 컨설팅 글 규칙은 감', aiCalls.length === 1 && !/(?<![A-Za-z])AX(?![A-Za-z])/.test(aiCalls[0]?.sys ?? '') && (aiCalls[0]?.sys ?? '').includes('[컨설팅 글 규칙'), ((aiCalls[0]?.sys ?? '').match(AXW) ?? []).slice(0, 4))
  check('SAAS-2 팀장 화면: 스레드 [AI로 바로 쓰기] 켜짐 → AI 한 번 · 지시문에 대표 이름 0 · DB 장부에 정산 1줄(글 쓰기 2단위)', qsEnabled && aiCalls.length === 1 && !OWNER_WORDS.test(aiCalls[0]?.sys ?? '') && uiRows === '1:2', `${qsEnabled} n=${aiCalls.length} ${uiRows}`)
  sql(`delete from public.ai_usage_ledger where user_id = '${PILOT.id}'`) // 아래 한도 시험을 0 부터(시험 DB 만)
  await go(p4, '/marketing/shorts')
  const shtAx = await axIn(p4)
  check('D-555 구독 고객: 릴스 · 틱톡 화면(접힌 칸 포함)에 AX 0', shtAx.length === 0, shtAx.slice(0, 6))
  check('SAAS-2 팀장: 릴스 · 틱톡 화면 열림 · 대표 이름 0', (await p4.getByTestId('sht-page').count()) === 1 && !OWNER_WORDS.test(await mainText(p4)), ((await mainText(p4)).match(OWNER_WORDS) ?? []).join())
  await go(p4, '/marketing')
  await p4.waitForTimeout(800)
  const ytText = await mainText(p4)
  check('SAAS-2 팀장: 콘텐츠 레이더 열림 · 대표 이름 · 대표 채널 0 · 대표 레이더 기록 0', (await p4.getByTestId('yt-page').count()) === 1 && !OWNER_WORDS.test(ytText) && leaked(ytText).length === 0 && (await p4.locator('[data-testid="yt-card"][data-mine="1"]').count()) === 0, (ytText.match(OWNER_WORDS) ?? []).join())
  await shot(p4, 'saas2-pilot-radar')
  const ytAx = await axIn(p4)
  check('D-555 구독 고객: 콘텐츠 레이더 첫 화면(접힌 칸 포함)에 AX 0', ytAx.length === 0, ytAx.slice(0, 6))
  for (const v of ['plan', 'channels']) {
    await go(p4, `/marketing/youtube?view=${v}`)
    await p4.waitForTimeout(800)
    const vAx = await axIn(p4)
    check(`D-555 구독 고객: 레이더 ?view=${v}(접힌 칸 포함)에 AX 0`, vAx.length === 0, vAx.slice(0, 6))
  }
  for (const pth of ['/tools/content', '/tools/homepage', '/marketing/more', '/patent-venture']) {
    await go(p4, pth)
    check(`SAAS-2 팀장: ${pth} 는 열려도 그대로 닫힘`, (await bodyText(p4)).includes('화면을 찾지 못했습니다'))
  }
  await go(p4, '/settings')
  await p4.getByTestId('ai-usage-numbers').waitFor({ timeout: 8000 }).catch(() => {})
  check('SAAS-2 팀장: 설정 › 이번 달 AI 사용량 0 / 12(DB 장부 값)', ((await p4.getByTestId('ai-usage-numbers').innerText().catch(() => '')) ?? '').startsWith('0 / 12'), await p4.getByTestId('ai-usage').innerText().catch(() => ''))
  await shot(p4, 'saas2-pilot-settings')

  const mkCtx = { title: '콘텐츠 레이더', today: '2026-10-25', sections: [{ name: '후보', rows: [{ ref: 'o1', 주제: '정책자금 금리' }] }] }
  aiCalls.length = 0
  const s1 = await assistDirect(PILOT, { requestId: 'req-saas2-e2e-000001', assistId: 'radar.top5', page: 'radar', context: mkCtx, brand: { name: '은혜컨설턴트', company: '은혜경영', facts: '경력 5년 · 상담 80곳' } })
  const ledgerRow = sql(`select user_id || ':' || status || ':' || units from public.ai_usage_ledger where request_id = 'req-saas2-e2e-000001'`)
  check('SAAS-2 팀장 AI: 마케팅 단추 → 200 · DB 장부에 팀장 줄 하나(정산 · 2단위) · AI 지시문에 대표 이름 0 · 팀장 설정', s1.statusCode === 200 && ledgerRow === `${PILOT.id}:settled:2` && aiCalls.length === 1 && !OWNER_WORDS.test(aiCalls[0].sys) && aiCalls[0].sys.includes('은혜컨설턴트(은혜경영)'), `${s1.statusCode} ${ledgerRow} ${s1.raw.slice(0, 200)}`)
  const again2 = await assistDirect(PILOT, { requestId: 'req-saas2-e2e-000001', assistId: 'radar.top5', page: 'radar', context: mkCtx })
  check('SAAS-2 팀장 AI: 같은 요청 번호 다시 → AI 다시 안 부름 · 장부 줄 그대로 하나', again2.statusCode === 200 && aiCalls.length === 1 && sql(`select count(*) from public.ai_usage_ledger where request_id = 'req-saas2-e2e-000001'`) === '1')
  for (let i = 2; i <= 6; i += 1) await assistDirect(PILOT, { requestId: `req-saas2-e2e-00000${i}`, assistId: 'radar.top5', page: 'radar', context: mkCtx })
  const over = await assistDirect(PILOT, { requestId: 'req-saas2-e2e-000007', assistId: 'radar.top5', page: 'radar', context: mkCtx })
  check('SAAS-2 팀장 AI: 한도 12단위를 다 쓰면 429 quota_exceeded · AI 안 부름 · 장부 합계 12', over.statusCode === 429 && over.body.code === 'quota_exceeded' && aiCalls.length === 6 && sql(`select sum(units) from public.ai_usage_ledger where user_id = '${PILOT.id}' and status <> 'released'`) === '12', `${over.statusCode} ${over.raw.slice(0, 160)} n=${aiCalls.length}`)
  check('D-555 구독 고객: 레이더 AI 지시문에 AX 0', aiCalls.length >= 1 && aiCalls.every((c) => !/(?<![A-Za-z])AX(?![A-Za-z])/.test(c.sys)), aiCalls.map((c) => (c.sys.match(AXW) ?? []).slice(0, 2)))
  const ownRun = await assistDirect(OWNER, { requestId: 'req-saas2-e2e-owner01', assistId: 'radar.top5', page: 'radar', context: mkCtx })
  check('D-555 대표 계정: 레이더 AI 지시문에 [컨설팅 · AX 글 규칙] 그대로', (aiCalls.at(-1)?.sys ?? '').includes('[컨설팅 · AX 글 규칙') && (aiCalls.at(-1)?.sys ?? '').includes('AX 뜻 ='))
  check('SAAS-2 대표 AI: 장부에 대표 줄 0(대표는 세지 않음) · 대표 마케팅 그대로', ownRun.statusCode === 200 && sql(`select count(*) from public.ai_usage_ledger where user_id = '${OWNER.id}'`) === '0')
  await go(p4, '/settings')
  await p4.getByTestId('ai-usage-numbers').waitFor({ timeout: 8000 }).catch(() => {})
  check('SAAS-2 팀장: 다 쓴 뒤 설정에 12 / 12', ((await p4.getByTestId('ai-usage-numbers').innerText().catch(() => '')) ?? '').startsWith('12 / 12'))
  // SAAS-2.1 이용 기한이 끝난 구독자 — 일반 · 마케팅 모두 AI 0 · 설정에 '구독 확인'
  sql(`delete from public.ai_usage_ledger where user_id = '${PILOT.id}'`)
  sql(`update public.ai_entitlements set active_until = now() - interval '1 day' where user_id = '${PILOT.id}'`)
  aiCalls.length = 0
  const exp1 = await assistDirect(PILOT, { requestId: 'req-saas21-exp-000001', assistId: 'today.top3', page: 'today', context: todayCtx })
  const exp2 = await assistDirect(PILOT, { requestId: 'req-saas21-exp-000002', assistId: 'radar.top5', page: 'radar', context: mkCtx })
  check('SAAS-2.1 기한 끝난 구독자: 일반 · 마케팅 둘 다 403 subscription_inactive · AI 0 · 장부 줄 0', exp1.statusCode === 403 && exp1.body.code === 'subscription_inactive' && exp2.statusCode === 403 && exp2.body.code === 'subscription_inactive' && aiCalls.length === 0 && sql(`select count(*) from public.ai_usage_ledger where user_id = '${PILOT.id}'`) === '0', `${exp1.raw.slice(0, 120)} ${exp2.raw.slice(0, 120)}`)
  await go(p4, '/settings')
  await p4.getByTestId('ai-usage-inactive').waitFor({ timeout: 8000 }).catch(() => {})
  check('SAAS-2.1 기한 끝난 구독자(D-564): 설정에 "구독을 확인해 주세요" · 마케팅 화면은 메뉴에 남음(AI 단추는 서버가 403 — 위)', (await p4.getByTestId('ai-usage-inactive').count()) === 1 && (await p4.locator('aside a[href="/marketing"]').count()) >= 1, await p4.getByTestId('ai-usage').innerText().catch(() => ''))
  await shot(p4, 'saas21-inactive-settings')
  // SAAS-2.1 마케팅이 빠진 요금제 — 일반 AI 는 세고 200 · 마케팅은 403
  sql(`update public.ai_entitlements set active_until = now() + interval '30 days', marketing = false where user_id = '${PILOT.id}'`)
  const nm1 = await assistDirect(PILOT, { requestId: 'req-saas21-nom-000001', assistId: 'today.top3', page: 'today', context: todayCtx })
  const nm2 = await assistDirect(PILOT, { requestId: 'req-saas21-nom-000002', assistId: 'radar.top5', page: 'radar', context: mkCtx })
  check('SAAS-2.1 마케팅 빠진 요금제: 일반 AI 200 · 장부에 customer 줄 · 마케팅 403 marketing_not_included', nm1.statusCode === 200 && sql(`select kind || ':' || feature || ':' || status from public.ai_usage_ledger where request_id = 'req-saas21-nom-000001'`) === 'customer:general:settled' && nm2.statusCode === 403 && nm2.body.code === 'marketing_not_included', `${nm1.raw.slice(0, 120)} ${nm2.raw.slice(0, 120)}`)
  sql(`update public.ai_entitlements set marketing = true where user_id = '${PILOT.id}'`)
  // 휴대폰 390 — 열린 마케팅 화면도 넘침 0
  await p4.setViewportSize({ width: 390, height: 844 })
  for (const pth of ['/marketing/threads', '/marketing/shorts', '/marketing']) {
    await go(p4, pth)
    check(`SAAS-2 팀장 390: ${pth} 가로 넘침 0`, (await overflowX(p4)) <= 0, String(await overflowX(p4)))
    await shot(p4, `saas2-pilot-m${pth.replace(/\//g, '-')}`)
  }
  await c4.close()
  delete process.env.AI_USAGE_SECRET

  // D-485 화면 꾸미기를 계정에(진짜 RLS) — PC 에서 숨기면 빈 휴대폰도 숨김 · 팀장은 대표 꾸미기를 받지 않음
  {
    const layoutOff = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('axmvp.ui.layout.today') ?? '{}').off ?? [] } catch { return [] } })
    const cA = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
    const pa = await cA.newPage()
    pa.on('pageerror', (e) => errors.push(String(e)))
    await cA.route(`https://${REF}.supabase.co/**`, route)
    await login(pa, OWNER)
    await go(pa, '/')
    await pa.getByTestId('arrange-open').click()
    await pa.locator('[data-arrange-row="assist"] [data-vis="off"]').click()
    await pa.getByTestId('arrange-done').click()
    await pa.waitForTimeout(2500)
    const cloud = sql(`select coalesce(payload->'layouts'->'today'->>'off', '') from public.ui_preferences where user_id = '${OWNER.id}'`)
    check('D-485 대표 PC 에서 칸 숨김 → 클라우드 설정(ui_preferences · 본인 줄)에 기록', cloud.includes('assist'), cloud)
    await cA.close()
    const cB = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
    const pb = await cB.newPage()
    pb.on('pageerror', (e) => errors.push(String(e)))
    await cB.route(`https://${REF}.supabase.co/**`, route)
    await login(pb, OWNER)
    await go(pb, '/')
    await pb.waitForTimeout(2000)
    const offPhone = await layoutOff(pb)
    check('D-485 빈 휴대폰(저장소 없음)에서 대표 로그인 → 같은 꾸미기(AI 도우미 칸 숨김)', offPhone.includes('assist') && (await pb.locator('[data-arrange-item="assist"]').count()) === 0, JSON.stringify(offPhone))
    await cB.close()
    const cC = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
    const pcx = await cC.newPage()
    pcx.on('pageerror', (e) => errors.push(String(e)))
    await cC.route(`https://${REF}.supabase.co/**`, route)
    await login(pcx, PILOT)
    await go(pcx, '/')
    await pcx.waitForTimeout(1500)
    const offPilot = await layoutOff(pcx)
    const pilotSeesOwner = sql(`set role authenticated; set request.jwt.claims = '{"sub":"${PILOT.id}","role":"authenticated"}'; select count(*) from public.ui_preferences where user_id = '${OWNER.id}';`).split('\n').pop()
    check('D-485 팀장 로그인 → 대표 꾸미기를 받지 않음 · 팀장은 대표 줄을 못 읽음(RLS)', !offPilot.includes('assist') && pilotSeesOwner === '0', `${JSON.stringify(offPilot)} rows=${pilotSeesOwner}`)
    await cC.close()
  }

  // ---------- D-562 외부 구독 고객 계정 — 전문 모듈 묶음은 메뉴 · 주소 · 찾기에서 닫힌다(대표 · 내부 팀장은 그대로) ----------
  {
    sql(`insert into auth.users (id, email) values ('${CUSTOMER.id}', '${CUSTOMER.email}') on conflict do nothing`)
    sql(readFileSync('supabase/manual/customer_provision.sql', 'utf8').replace('여기에_고객_이메일@example.com', CUSTOMER.email).replace("'고객 작업공간'", "'시범 고객'"))
    const cws = sql(`select id from public.workspaces where owner_id = '${CUSTOMER.id}'`)
    check('고객(D-562) 준비: customer_provision.sql → pilot 등급 · audience = customer · 그 사람만 구성원인 작업공간 하나 · 업체 0', sql(`select tier || ':' || audience from public.os_access where user_id = '${CUSTOMER.id}'`) === 'pilot:customer' && cws.length === 36 && sql(`select count(*) from public.workspace_members where workspace_id = '${cws}'`) === '1' && sql(`select count(*) from public.operations_clients where workspace_id = '${cws}'`) === '0', cws)
    check('고객(D-562): 내부 팀장 줄은 그대로 internal(팀장 화면 · 메뉴는 위 시험 그대로)', sql(`select audience from public.os_access where user_id = '${PILOT.id}'`) === 'internal')
    const cK = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
    const pk = await cK.newPage()
    pk.on('pageerror', (e) => errors.push(String(e)))
    await cK.route(`https://${REF}.supabase.co/**`, route)
    await login(pk, CUSTOMER)
    // D-565 내부 팀장용 안내 영상(전문 모듈 소개)은 외부 고객에게 저절로 뜨지 않는다
    check('고객(D-565): 첫 로그인에 팀장용 안내 영상 창이 뜨지 않음', (await pk.getByTestId('tutorial-dialog').count()) === 0)
    await go(pk, '/')
    await pk.waitForTimeout(1200)
    const navK = (await pk.locator('aside').first().innerText().catch(() => '')) ?? ''
    check('고객 메뉴(D-562): 전문 모듈 묶음(기업성장 · 절세·재무 · 모듈 전체) 없음 · 영업자 정산 · 1차 미팅 체크리스트 없음', !navK.includes('전문 모듈') && !navK.includes('기업성장') && !navK.includes('절세·재무') && !navK.includes('모듈 전체') && !navK.includes('영업자 정산') && !navK.includes('1차 미팅'), navK.replace(/\n/g, '|').slice(0, 400))
    check('고객 메뉴(D-562): 오늘 · 확인할 것 · 일정 · 고객 관리 · 영업 관리 · 매출 · 설정은 있음', ['오늘', '확인할 것', '일정', '고객 관리', '영업 관리', '매출', '설정'].every((x) => navK.includes(x)), navK.replace(/\n/g, '|').slice(0, 400))
    const todayK = (await pk.locator('main').innerText().catch(() => '')) ?? ''
    check('고객(D-562): 오늘 화면에 대표 자료 0', leaked(todayK).length === 0, leaked(todayK).join())
    await shot(pk, 'customer-01-today')
    const closed = []
    for (const u of ['/tools', '/modules', '/tools/policy-funding', '/tools/tax', '/tools/employment', '/tools/startup-tax', '/tools/labcare', '/tools/cretop', '/ops/agents', '/sales/first-meeting']) {
      await go(pk, u)
      await pk.waitForTimeout(350)
      const t = (await pk.locator('main').innerText().catch(() => '')) ?? ''
      if (!t.includes('화면을 찾지 못했습니다')) closed.push(u)
    }
    check('고객 주소(D-562): 전문 모듈 · 도구 · 영업자 정산 · 1차 미팅 체크리스트 주소는 "화면을 찾지 못했습니다"(10곳)', closed.length === 0, closed.join())
    const openK = []
    for (const u of ['/ops/clients', '/ops/calendar', '/ops/decide', '/sales/board', '/money', '/settings']) {
      await go(pk, u)
      await pk.waitForTimeout(350)
      const t = (await pk.locator('main').innerText().catch(() => '')) ?? ''
      if (t.includes('화면을 찾지 못했습니다') || leaked(t).length) openK.push(u)
    }
    check('고객 주소(D-562): 고객 관리 · 일정 · 확인할 것 · 영업 관리 · 매출 · 설정은 열림 · 대표 자료 0', openK.length === 0, openK.join())
    await go(pk, '/ops/clients')
    await shot(pk, 'customer-02-clients')
    const restK = await pk.evaluate(async ([ref, ownerWs]) => {
      const tok = JSON.parse(Object.entries(localStorage).find(([k]) => k.includes('auth-token'))?.[1] ?? '{}').access_token
      const r = await fetch(`https://${ref}.supabase.co/rest/v1/operations_clients?select=id&workspace_id=eq.${ownerWs}`, { headers: { apikey: 'qa-anon', Authorization: `Bearer ${tok}` } })
      return r.ok ? (await r.json()).length : -1
    }, [REF, OWNER_WS])
    check('고객 REST(D-562 · 진짜 RLS): 대표 작업공간 업체 0건', restK === 0, restK)

    // ---------- D-563 고객 계정 = 기본 OS 만 — 업체를 등록하고 서류를 올려도 화면 안에 전문 모듈로 가는 길이 없다 ----------
    const HID = ['/modules', '/tools/policy-funding', '/tools/employment', '/tools/labcare', '/grants', '/tools/cert-os', '/tools/tax', '/tools/startup-tax', '/tools/cretop', '/upcoming']
    /** 지금 화면 본문 — 닫힌 주소로 가는 링크 · 전문 모듈을 약속하는 말 */
    const deadEnds = (pg) =>
      pg.evaluate((hid) => {
        const hidden = (x) => x === '/tools' || hid.some((b) => x === b || x.startsWith(b + '/'))
        const main = document.querySelector('main')
        const links = [...(main?.querySelectorAll('a[href]') ?? [])].map((el) => new URL(el.href).pathname).filter(hidden)
        const words = ((main?.innerText ?? '').match(/모듈|판정|진단서|말하기 대본|지원사업 알림|상황 예시|설계서|체험/g) ?? [])
        return { links, words }
      }, HID)
    await go(pk, '/')
    await pk.waitForTimeout(600)
    // D-567 고객 첫 화면(업체 0곳) — '어디서 시작할까요?' 두 갈래(고객 모으기 · 내 고객 정리) · 없는 것(모듈 · 예상 금액)을 약속하지 않음
    const welK = ((await pk.getByTestId('today-first-client').innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
    check('고객(D-567) 첫 화면: "어디서 시작할까요?" · 고객 모으기부터 [마케팅 시작하기] · 내 고객 정리부터 [첫 업체 등록] · 먼저 내 이름 · 회사 적기 · 사용법 안내', (await pk.getByTestId('today-first-client').getAttribute('data-variant')) === 'welcome' && ['어디서 시작할까요', '고객 모으기부터', '마케팅 시작하기', '내 고객 정리부터', '첫 업체 등록', '내 이름 · 회사 적기', '사용법 안내'].every((w) => welK.includes(w)), welK.slice(0, 300))
    check('고객(D-563 · D-567): 첫 화면 안내가 모듈 · 예상 금액 · 판정을 약속하지 않음 · 대표 자료 0', !/모듈|예상 금액|판정/.test(welK) && leaked(welK).length === 0, welK.slice(0, 200))
    await shot(pk, 'customer-01b-welcome')
    // 휴대폰에서도 두 갈래가 한 칸씩 · 넘침 0 · 큰 단추(44px 이상)
    await pk.setViewportSize({ width: 390, height: 844 })
    await pk.waitForTimeout(500)
    const welBtn = await pk.getByTestId('today-welcome-marketing-go').boundingBox()
    check('고객 390(D-567): 첫 화면 두 갈래 — 가로 넘침 0 · [마케팅 시작하기] 높이 44px 이상', (await overflowX(pk)) <= 0 && !!welBtn && welBtn.height >= 44, { over: await overflowX(pk), h: welBtn?.height })
    await shot(pk, 'customer-01c-welcome-390')
    // D-575 첫 화면에서 바로 글자 키우기 — 누르면 '크게' · 휴대폰 옆 넘침 0 · 두 번 더 누르면 처음으로
    const scaleBtn = pk.getByTestId('today-welcome-scale').getByTestId('text-scale-quick')
    const scale0 = await scaleBtn.getAttribute('data-scale').catch(() => '')
    await scaleBtn.click().catch(() => {})
    await pk.waitForTimeout(400)
    const scale1 = await scaleBtn.getAttribute('data-scale').catch(() => '')
    const overBig = await overflowX(pk)
    await scaleBtn.click().catch(() => {})
    await pk.waitForTimeout(300)
    const overHuge = await overflowX(pk)
    await shot(pk, 'customer-01d-welcome-390-large')
    await scaleBtn.click().catch(() => {})
    await pk.waitForTimeout(300)
    check('고객 390(D-575): 첫 화면 [글자 크기] 단추 — 누르면 한 단계 커짐 · 크게 · 매우 크게에서도 가로 넘침 0 · 세 번 누르면 처음으로', !!scale0 && scale1 !== scale0 && overBig <= 0 && overHuge <= 0 && (await scaleBtn.getAttribute('data-scale').catch(() => '')) === scale0, { scale0, scale1, overBig, overHuge })
    await pk.setViewportSize({ width: 1440, height: 900 })
    await pk.waitForTimeout(400)
    await pk.getByTestId('today-welcome-marketing-go').click()
    await pk.waitForTimeout(900)
    check('고객(D-567): [마케팅 시작하기] → 마케팅 첫 화면(내 채널 알려 주기 칸)', pk.url().endsWith('/marketing') && (await pk.getByTestId('mk-start').count()) === 1, pk.url())
    await go(pk, '/')
    await pk.waitForTimeout(600)
    await pk.getByTestId('today-first-client-add').click()
    await pk.waitForTimeout(600)
    await pk.getByLabel('업체명').fill('고객시범상사(주)')
    await pk.getByLabel('대표자·담당자').fill('한고객')
    await pk.getByRole('button', { name: '등록하고 열기' }).click()
    await pk.waitForURL(/\/ops\/clients\/[^/?]+/, { timeout: 15000 }).catch(() => {})
    await pk.waitForTimeout(900)
    const kc = sql(`select id from public.operations_clients where workspace_id = '${cws}' and company_name = '고객시범상사(주)'`)
    check('고객(D-563): 첫 업체가 고객 작업공간에 저장(DB) · 그 업체 화면', kc.length > 0 && pk.url().includes(`/ops/clients/${kc}`), `${kc} ${pk.url()}`)
    await pk.getByTestId('client-upload').click()
    await pk.getByLabel('서류 파일 고르기').setInputFiles([{ name: '사업자등록증.txt', mimeType: 'text/plain', buffer: Buffer.from(['사업자등록증', '(법인사업자)', '등록번호 : 220-81-62517', '법인명(단체명) : 고객시범상사(주)', '대표자 : 한고객', '개업연월일 : 2022 년 03 월 02 일', '사업장 소재지 : 서울특별시 금천구 가산디지털1로 1', '업태 : 제조업', '종목 : 정밀기계'].join('\n'), 'utf8') }])
    await pk.getByTestId('smart-placed').waitFor({ timeout: 20000 }).catch(() => {})
    await pk.waitForTimeout(1200)
    const payK = JSON.parse(sql(`select payload::text from public.operations_clients where id = '${kc}'`) || '{}')
    check('고객(D-563): 서류 올리기는 그대로 — 사업자번호 · 설립일 바로 입력 · 서류함 보관 경로가 고객 작업공간', String(payK.businessNumber ?? '').replace(/\D/g, '') === '2208162517' && payK.establishedAt === '2022-03-02' && String(payK.documents?.businessRegistration?.storagePath ?? '').startsWith(`${cws}/`), JSON.stringify({ b: payK.businessNumber, e: payK.establishedAt, p: payK.documents?.businessRegistration?.storagePath }))
    await pk.keyboard.press('Escape')
    await pk.waitForTimeout(400)
    await go(pk, `/ops/clients/${kc}?tab=smart`)
    await pk.waitForTimeout(1200)
    const recoK = await deadEnds(pk)
    check(
      '고객(D-563) 맞춤 추천 탭: 먼저 제안할 것 · 모듈별 판정 · 맞춤 상담 · 맞는 지원사업 칸 없음 · 닫힌 주소 링크 0 · 모듈을 약속하는 말 0',
      (await pk.getByTestId('top-picks').count()) === 0 && (await pk.getByTestId('smart-insights').count()) === 0 && (await pk.locator('#module-verdicts').count()) === 0 && recoK.links.length === 0 && recoK.words.length === 0 && (await pk.getByTestId('smart-tab').count()) === 1,
      JSON.stringify(recoK),
    )
    check('고객(D-563) 맞춤 추천 탭: 서류 올리기 · 올린 서류 읽은 결과는 그대로 보임', (await pk.getByTestId('smart-upload').count()) === 1 && (await pk.getByTestId('smart-batch').count()) === 1)
    await shot(pk, 'customer-03-detail-reco')
    await go(pk, `/ops/clients/${kc}?tab=smart&talk=1`)
    await pk.waitForTimeout(900)
    const talkK = await deadEnds(pk)
    check('고객(D-563): 말하기 대본 주소(?talk=1)로 와도 대본 창이 뜨지 않음 · 화면은 그대로', talkK.words.length === 0 && (await pk.getByTestId('smart-tab').count()) === 1 && (await pk.locator('[data-testid^="talk-"]').count()) === 0, JSON.stringify(talkK))
    await go(pk, `/ops/clients/${kc}?tab=overview`)
    await pk.waitForTimeout(1200)
    const overK = await deadEnds(pk)
    const overText = (await pk.locator('main').innerText().catch(() => '')) ?? ''
    check('고객(D-563) 개요 탭: "전문 모듈 열기" 카드 · 먼저 제안할 것 없음 · 닫힌 주소 링크 0 · 회사 기본 정보는 그대로', !overText.includes('전문 모듈 열기') && (await pk.getByTestId('top-picks').count()) === 0 && overK.links.length === 0 && overK.words.length === 0 && overText.includes('회사 기본 정보') && overText.includes('220'), JSON.stringify(overK))
    await shot(pk, 'customer-04-detail-overview')
    await go(pk, `/ops/clients/${kc}?tab=docs`)
    await pk.waitForTimeout(1000)
    const docsK = await deadEnds(pk)
    check('고객(D-563) 서류 탭: "이 서류를 쓰는 도구" 줄 없음 · 닫힌 주소 링크 0 · 서류 칸은 그대로', (await pk.locator('[data-testid^="doc-tools-"]').count()) === 0 && docsK.links.length === 0 && ((await pk.locator('main').innerText().catch(() => '')) ?? '').includes('사업자등록증'), JSON.stringify(docsK))
    const leftK = []
    for (const u of ['/', '/ops/decide', '/ops/clients', '/ops/calendar', '/sales/board', '/money', '/settings', `/ops/clients/${kc}?tab=work`, `/ops/clients/${kc}?tab=journal`]) {
      await go(pk, u)
      await pk.waitForTimeout(700)
      const d = await deadEnds(pk)
      if (d.links.length) leftK.push(`${u} → ${d.links.join(',')}`)
    }
    check('고객(D-563): 열린 화면 9곳(오늘 · 확인할 것 · 고객 관리 · 일정 · 영업 · 매출 · 설정 · 업무 · 업무 일기) 본문에 닫힌 주소 링크 0', leftK.length === 0, leftK.join(' | '))
    await go(pk, '/settings')
    await pk.waitForTimeout(600)
    check('고객(D-563) 설정: "모듈 첫 화면" 칸 없음', (await pk.getByTestId('settings-chatfirst').count()) === 0)
    await go(pk, '/')
    await pk.waitForTimeout(900)
    await pk.getByTestId('home-ask').first().click().catch(() => {})
    await pk.waitForTimeout(500)
    const guideK = (await pk.getByTestId('home-ask-guide').innerText().catch(() => '')) ?? ''
    const todayK2 = (await pk.locator('main').innerText().catch(() => '')) ?? ''
    check('고객(D-563) 오늘: 대화창 안내가 "그 업체 자료로 답해요"(모듈 판정을 약속하지 않음) · 빈 화면 안내는 사라짐 · 대표 자료 0', guideK.includes('그 업체 자료로 답해요') && !guideK.includes('모듈') && !todayK2.includes('등록된 업체가 없습니다') && leaked(todayK2).length === 0, `${guideK} / ${leaked(todayK2).join()}`)
    const wordsToday = todayK2.match(/모듈|판정|진단서|말하기 대본|받을 수 있는 것|지원사업 알림/g) ?? []
    check('고객(D-563) 오늘: 처음 시작 카드 · 권하는 질문 · 본문에 모듈 · 판정 · 진단서 · "받을 수 있는 것" 0', wordsToday.length === 0 && todayK2.includes('처음 시작'), wordsToday.join())
    await shot(pk, 'customer-05-today-after')

    // ---------- D-565 사용법 안내 — 고객에게는 고객 메뉴만 · 없는 기능을 약속하지 않는 글 · 팀장용 영상 단추 없음 ----------
    check('고객 메뉴(D-565): 사용법 안내 있음', navK.includes('사용법 안내'), navK.replace(/\n/g, '|').slice(0, 400))
    await go(pk, '/guide')
    await pk.waitForTimeout(700)
    const gGroupsK = await pk.getByTestId('guide-group').evaluateAll((els) => els.map((e) => e.getAttribute('data-group')))
    const gAllK = []
    for (let g = 0; g < gGroupsK.length; g += 1) {
      await pk.getByTestId('guide-group').nth(g).click()
      await pk.waitForTimeout(120)
      const n = await pk.getByTestId('guide-row').count()
      for (let i = 0; i < n; i += 1) {
        const r = pk.getByTestId('guide-row').nth(i)
        await r.getByTestId('guide-row-toggle').click()
        gAllK.push(`${await r.getAttribute('data-key')}: ${((await r.innerText()) ?? '').replace(/\n/g, ' ')}`)
      }
    }
    const gBadK = gAllK.filter((x) => /모듈|판정|예상 금액|진단서/.test(x) || leaked(x).length > 0)
    check('고객(D-565) 사용법 안내: 묶음은 오늘 · 고객 · 영업 · 설정 + 어느 화면에나(전문 모듈 없음) · 모든 줄 글에 모듈 · 판정 · 예상 금액 0 · 대표 자료 0', gGroupsK.join() === 'today,clients,sales,settings,top' && gAllK.length >= 10 && gBadK.length === 0, `${gGroupsK.join()} / ${gAllK.length}줄 / ${gBadK.join(' || ').slice(0, 300)}`)
    check('고객(D-565) 사용법 안내: 닫힌 화면(홍보 글 · 홈페이지 · 모듈) 줄 없음 · 팀장용 [전체 안내 영상] · 팀장용 설문 링크 없음', !gAllK.some((x) => /^(mk-content|mk-homepage|tools|cat-)/.test(x)) && (await pk.getByTestId('guide-tutorial').count()) === 0 && (await pk.getByTestId('guide-feedback').count()) === 0, gAllK.map((x) => x.split(':')[0]).join())
    await shot(pk, 'customer-05b-guide')
    await go(pk, '/settings')
    await pk.waitForTimeout(500)
    check('고객(D-565) 설정: 팀장용 "안내 영상" 줄 없음', (await pk.getByTestId('settings-tutorial').count()) === 0)
    await pk.locator('aside [data-guide="client-ops"]').first().hover()
    await pk.waitForTimeout(900)
    const cardK = ((await pk.getByTestId('menu-guide-card').innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
    check('고객(D-565): 메뉴에 마우스 → 안내 카드 · 고객용 글(제도 · 모듈 약속 없음)', cardK.includes('무엇을 하나요') && !/모듈|제도|판정/.test(cardK), cardK.slice(0, 240))
    await pk.mouse.move(900, 500)

    // ---------- D-564 고객 계정 마케팅 · 브랜딩 — 화면은 열리고, 대표 채널 · AX · AI 기본 주제 없이 '내 채널부터' ----------
    check('고객 메뉴(D-564): 마케팅 · 브랜딩 있음(대표 전용에서 풀림)', navK.includes('마케팅 · 브랜딩'), navK.replace(/\n/g, '|').slice(0, 400))
    // 위에서 사용법 안내 · 설정을 다녀왔다 — 처음 시작 카드는 오늘 화면에 있다
    await go(pk, '/')
    await pk.getByTestId('today-firstuse').waitFor({ timeout: 8000 }).catch(() => {})
    const headK0 = ((await pk.locator('header').first().innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
    const stepsFirst = ((await pk.getByTestId('today-firstuse').innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
    check('고객(D-564) 오늘: 이름을 아직 안 적었으면 처음 시작 카드가 "다음: 내 이름 · 회사 적기"', (await pk.getByTestId('today-firstuse').getAttribute('data-next').catch(() => '')) === 'me' && stepsFirst.includes('내 이름 · 회사 적기'), `${stepsFirst.slice(0, 200)} / 머리줄: ${headK0.slice(0, 120)}`)
    await go(pk, '/marketing')
    await pk.getByTestId('mk-start').waitFor({ timeout: 8000 }).catch(() => {})
    const mkK = await mainText(pk)
    const mkAxK = await axIn(pk)
    check('고객 마케팅(D-564): /marketing 열림 · "먼저 내 채널을 알려 주세요" 칸 · 대표 이름 · 채널 0 · 대표 자료 0', !mkK.includes('화면을 찾지 못했습니다') && (await pk.getByTestId('mk-start').count()) === 1 && !OWNER_WORDS.test(mkK) && leaked(mkK).length === 0, (mkK.match(OWNER_WORDS) ?? []).join())
    check('고객 마케팅(D-564): 첫 화면(접힌 칸 포함)에 AX 0', mkAxK.length === 0, mkAxK.slice(0, 6))
    check('고객 마케팅(D-566): 첫 설정 칸이 보이는 동안에는 시작 길 카드가 겹쳐 나오지 않음', (await pk.getByTestId('mk-path').count()) === 0)
    await shot(pk, 'customer-06-marketing-start')
    await go(pk, '/marketing/youtube?view=plan')
    await pk.waitForTimeout(900)
    const planK = await mainText(pk)
    check('고객 마케팅(D-564): 이번 주 찍을 것 — AI 키워드 판 · AI 주제 줄 없음(스스로 AI 분야를 고르기 전) · 대표 이름 0 · AX 0', (await pk.getByTestId('radar-ai-keywords').count()) === 0 && (await pk.locator('[data-testid="radar-opp"][data-axis="axai"], [data-testid="radar-opp"][data-axis="bridge"]').count()) === 0 && !OWNER_WORDS.test(planK) && (await axIn(pk)).length === 0, `${(planK.match(OWNER_WORDS) ?? []).join()} ai-board=${await pk.getByTestId('radar-ai-keywords').count()}`)
    await shot(pk, 'customer-07-marketing-plan')
    // 첫 칸에 이름 · 회사 · 분야 + 관심 분야 하나 → 저장 → 칸이 사라지고 머리줄 이름이 내 이름으로
    await go(pk, '/marketing')
    await pk.getByTestId('mk-start').waitFor({ timeout: 8000 }).catch(() => {})
    await pk.getByTestId('mk-start-save').click()
    check('고객 마케팅(D-564): 아무것도 안 적고 저장 → 안내 한 줄(저장 안 함)', ((await pk.getByTestId('mk-start-hint').innerText().catch(() => '')) ?? '').includes('하나만 적어도'), await pk.getByTestId('mk-start-hint').innerText().catch(() => ''))
    await pk.getByTestId('mk-start-name').fill('박고객')
    await pk.getByTestId('mk-start-company').fill('고객경영연구소')
    await pk.getByTestId('mk-start-industry').fill('정책자금 컨설팅')
    const chipK = pk.locator('[data-testid="mk-start-chip"]:not([data-id="ai_tools"]):not([data-id="automation"])').first()
    const chipId = await chipK.getAttribute('data-id')
    await chipK.click()
    await pk.getByTestId('mk-start-save').click()
    await pk.waitForTimeout(1800)
    const brandK = sql(`select payload::text from public.module_data where workspace_id = '${cws}' and module_key = 'brand' limit 1`)
    const prefsK = sql(`select coalesce(string_agg(payload::text, ' '), '') from public.module_data where workspace_id = '${cws}' and module_key = 'marketing'`)
    check('고객 마케팅(D-564): [저장하고 시작] → 내 브랜드(이름 · 회사 · 분야)와 관심 분야가 고객 작업공간에 저장(DB) · 칸은 사라짐', ['박고객', '고객경영연구소', '정책자금 컨설팅'].every((x) => brandK.includes(x)) && prefsK.includes(String(chipId)) && (await pk.getByTestId('mk-start').count()) === 0, `${brandK.slice(0, 200)} / ${chipId} / ${prefsK.slice(0, 160)}`)
    const headK = ((await pk.locator('header').first().innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
    check('고객(D-564): 머리줄 이름이 "사용자" 가 아니라 방금 적은 이름', headK.includes('박고객') && !headK.includes('사용자'), headK.slice(0, 160))
    check('고객(D-564): 대표 작업공간의 내 브랜드 · 마케팅 기록은 그대로(다른 작업공간에 쓰지 않음)', sql(`select count(*) from public.module_data where workspace_id = '${OWNER_WS}' and module_key = 'brand' and payload::text like '%박고객%'`) === '0')
    // D-566 처음 시작 길 — 내 채널을 적었으니 1/5 · 다음은 '이번 주 주제 하나 고르기'(왜 한 줄 · 큰 단추 하나)
    await pk.getByTestId('mk-path').waitFor({ timeout: 8000 }).catch(() => {})
    const pathK = ((await pk.getByTestId('mk-path').innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
    check('고객 마케팅(D-566): 시작 길 카드 — "고객 모으기 시작 1/5" · 다음: 이번 주 주제 하나 고르기 · 왜 한 줄 · 큰 단추 하나 · 걸음 5개(첫 걸음 ✓)', (await pk.getByTestId('mk-path').getAttribute('data-mode')) === 'steps' && (await pk.getByTestId('mk-path').getAttribute('data-next')) === 'topic' && pathK.includes('고객 모으기 시작 1/5') && pathK.includes('이번 주 주제 하나 고르기') && ((await pk.getByTestId('mk-path-why').innerText()) ?? '').length >= 20 && (await pk.getByTestId('mk-path-go').count()) === 1 && (await pk.getByTestId('mk-path-step').count()) === 5 && (await pk.locator('[data-testid="mk-path-step"][data-step="channel"]').getAttribute('data-done')) === '1', pathK.slice(0, 260))
    check('고객 마케팅(D-566): 시작 길 카드에 대표 이름 · 채널 0 · 어려운 말(롱폼 · 썸네일 · 스레드 · 릴스) 0', !OWNER_WORDS.test(pathK) && !/롱폼|썸네일|벤치마킹|해시태그|스레드|릴스/.test(pathK), pathK.slice(0, 200))
    await shot(pk, 'customer-08-marketing-after')
    await pk.getByTestId('mk-path-go').click()
    await pk.waitForTimeout(900)
    check('고객 마케팅(D-566): 큰 단추 → 이번 주 주제 화면', pk.url().includes('/marketing/youtube') && pk.url().includes('view=plan') && !((await mainText(pk)) ?? '').includes('화면을 찾지 못했습니다'), pk.url())
    // D-571 고객 모으기 기초 7가지 — 시작 길 카드의 작은 줄에서 → 한 가지 읽고 [읽었어요] → 카드에 '1/7 읽음'
    await go(pk, '/marketing')
    await pk.getByTestId('mk-path-basics').waitFor({ timeout: 8000 }).catch(() => {})
    await pk.getByTestId('mk-path-basics').getByRole('link').click()
    await pk.getByTestId('mk-basics').waitFor({ timeout: 8000 }).catch(() => {})
    await pk.waitForTimeout(500)
    const basK = ((await mainText(pk)) ?? '').replace(/\n/g, ' ')
    check('고객(D-571): 시작 길 카드 → 기초 7가지 화면 · 일곱 줄 · 첫째가 펼쳐짐 · 대표 자료 · 모듈 · 판정 0', new URL(pk.url()).pathname === '/marketing/basics' && (await pk.getByTestId('mk-basic').count()) === 7 && (await pk.locator('[data-testid="mk-basic"][data-open="1"]').getAttribute('data-key')) === 'who' && leaked(basK).length === 0 && !/모듈|판정|예상 금액/.test(basK), basK.slice(0, 200))
    await shot(pk, 'customer-08b-basics')
    await pk.getByTestId('mk-basic-read').click()
    await pk.waitForTimeout(400)
    await go(pk, '/marketing')
    await pk.getByTestId('mk-path-basics').waitFor({ timeout: 8000 }).catch(() => {})
    check('고객(D-571): [읽었어요] → 다음 것이 펼쳐지고 · 시작 길 카드에 "1/7 읽음"', ((await pk.getByTestId('mk-path-basics').innerText().catch(() => '')) ?? '').includes('1/7 읽음'), await pk.getByTestId('mk-path-basics').innerText().catch(() => ''))
    // D-574 마케팅 → 고객 DB 고리 — 한 편이라도 올린 뒤부터 '이번 달 새로 적은 고객 · 글을 보고 온 곳' + [잠재고객으로 적어 두기](진짜 RLS — 내 작업공간 것만 센다)
    check('고객(D-574): 아직 올린 글이 없으면 시작 길 카드에 "글을 보고 연락이 왔나요?" 줄 없음(처음 보는 사람에게 말 줄이기)', (await pk.getByTestId('mk-path-leads').count()) === 0)
    const cwsLead = sql(`select id from public.workspaces where owner_id = '${CUSTOMER.id}'`)
    sql(`insert into public.module_data (id, workspace_id, module_key, bucket, payload) values ('thr_qa_cust_posted', '${cwsLead}', 'marketing', 'threads', '{"body":"정책자금, 올해 달라진 점 한 가지만 먼저 확인하세요.","topic":"정책자금 달라지는 점","status":"posted","postedOn":"2026-11-10","source":"hand","savedAt":"2026-11-10T00:00:00.000Z"}')`)
    await go(pk, '/marketing')
    await pk.getByTestId('mk-path-leads').waitFor({ timeout: 8000 }).catch(() => {})
    const lead0 = { all: await pk.getByTestId('mk-path-leads').getAttribute('data-all').catch(() => ''), content: await pk.getByTestId('mk-path-leads').getAttribute('data-content').catch(() => '') }
    check('고객(D-574): 글 한 편을 올린 뒤 → "이번 달 새로 적은 고객 1곳 · 글을 보고 온 곳 0곳" + [잠재고객으로 적어 두기](대표 업체는 세지 않음)', lead0.all === '1' && lead0.content === '0' && (await pk.getByTestId('mk-path-lead-add').count()) === 1, lead0)
    await shot(pk, 'customer-08c-lead-line')
    await pk.getByTestId('mk-path-lead-add').click()
    await pk.getByTestId('prospect-from-content').waitFor({ timeout: 8000 }).catch(() => {})
    const srcOptions = await pk.getByLabel('유입 경로').locator('option').allInnerTexts().catch(() => [])
    check('고객(D-574): [잠재고객으로 적어 두기] → 영업 관리 등록 창 · 안내 한 줄 · 유입 경로에 글 경로 넷이 먼저(블로그 · 유튜브 · 인스타 · 스레드)', new URL(pk.url()).pathname === '/sales/board' && (await pk.getByTestId('prospect-from-content').count()) === 1 && srcOptions.slice(1, 5).join() === '블로그,유튜브,인스타,스레드' && srcOptions.includes('소개'), srcOptions.join())
    await shot(pk, 'customer-08d-lead-form')
    await pk.getByLabel('회사명 *').fill('글보고온상사')
    await pk.getByLabel('유입 경로').selectOption('스레드')
    await pk.getByRole('button', { name: '잠재고객 등록' }).click()
    await pk.waitForTimeout(1500)
    check('고객(D-574): 등록 → DB 에 내 작업공간 잠재고객 1줄(유입 경로 = 스레드)', sql(`select count(*) from public.operations_clients where workspace_id = '${cwsLead}' and company_name = '글보고온상사'`) === '1' && sql(`select payload::text from public.operations_clients where workspace_id = '${cwsLead}' and company_name = '글보고온상사'`).includes('스레드'), sql(`select count(*) from public.operations_clients where workspace_id = '${cwsLead}'`))
    await go(pk, '/marketing')
    await pk.getByTestId('mk-path-leads').waitFor({ timeout: 8000 }).catch(() => {})
    const lead1 = { all: await pk.getByTestId('mk-path-leads').getAttribute('data-all').catch(() => ''), content: await pk.getByTestId('mk-path-leads').getAttribute('data-content').catch(() => '') }
    check('고객(D-574): 마케팅으로 돌아오면 "새로 적은 고객 2곳 · 글을 보고 온 곳 1곳"', lead1.all === '2' && lead1.content === '1', lead1)
    await go(pk, '/')
    await pk.waitForTimeout(900)
    const stepsAfter = ((await pk.getByTestId('today-firstuse').innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
    const meDone = await pk.locator('[data-testid="today-firstuse-step"][data-step="me"]').getAttribute('data-done').catch(() => '')
    const nextAfter = await pk.getByTestId('today-firstuse').getAttribute('data-next').catch(() => '')
    check('고객(D-564) 오늘: 이름 · 회사를 적은 뒤에는 "내 이름 · 회사 적기" 가 끝남(✓ · 다음 단계로 — 카드가 다 끝나 사라졌어도 통과)', meDone === '1' || (nextAfter !== 'me' && !stepsAfter.includes('다음: 내 이름')), `${meDone} ${nextAfter} ${stepsAfter.slice(0, 200)}`)
    await pk.setViewportSize({ width: 390, height: 844 })
    await go(pk, '/marketing')
    await pk.waitForTimeout(700)
    check('고객 390(D-564): 마케팅 첫 화면 가로 넘침 0', (await overflowX(pk)) <= 0, String(await overflowX(pk)))
    await shot(pk, 'customer-09-marketing-390')
    await pk.setViewportSize({ width: 1440, height: 900 })
    await cK.close()
    // 출시 목록 L-5: 이용약관 · 개인정보처리방침 초안 — 로그인 없이 열리고(초안 띠), 검토 전에는 로그인 화면에 링크가 없다
    {
      const cL = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ko-KR' })
      const pl = await cL.newPage()
      pl.on('pageerror', (e) => errors.push(String(e)))
      await cL.route(`https://${REF}.supabase.co/**`, route)
      await pl.goto(`${BASE}/privacy`, { waitUntil: 'networkidle' })
      await pl.waitForTimeout(600)
      const lt = (await pl.getByTestId('legal-page').innerText().catch(() => '')) ?? ''
      check('약관 초안(L-5 · 클라우드): 로그인하지 않아도 /privacy 열림 · 초안 띠 · 대표 자료 0', (await pl.getByTestId('legal-page').count()) === 1 && (await pl.getByTestId('legal-draft').count()) === 1 && lt.includes('개인정보처리방침') && leaked(lt).length === 0, lt.slice(0, 120))
      await pl.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
      await pl.waitForTimeout(600)
      check('약관 초안(L-5): 법률 검토 전에는 로그인 화면에 약관 링크를 걸지 않음', (await pl.getByLabel('이메일').count()) === 1 && (await pl.getByTestId('auth-legal').count()) === 0)
      await cL.close()
    }
    // 대표 화면은 그대로 — 전문 모듈 묶음이 보인다(고객 로그인 뒤 같은 브라우저 묶음에서도)
    const cO = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
    const po = await cO.newPage()
    po.on('pageerror', (e) => errors.push(String(e)))
    await cO.route(`https://${REF}.supabase.co/**`, route)
    await login(po, OWNER)
    await go(po, '/')
    await po.waitForTimeout(1200)
    const navO = (await po.locator('aside').first().innerText().catch(() => '')) ?? ''
    check('대표 메뉴(D-562): 전문 모듈 · 영업자 정산 · 1차 미팅 체크리스트 그대로', ['전문 모듈', '영업자 정산', '1차 미팅'].every((x) => navO.includes(x)), navO.replace(/\n/g, '|').slice(0, 400))
    await go(po, `/ops/clients/${OWNER_CLIENT}?tab=overview`)
    await po.getByTestId('top-picks').waitFor({ timeout: 8000 }).catch(() => {})
    const overO = (await po.locator('main').innerText().catch(() => '')) ?? ''
    check('대표 업체 화면(D-563): 먼저 제안할 것 · "전문 모듈 열기" 카드 그대로', (await po.getByTestId('top-picks').count()) === 1 && overO.includes('전문 모듈 열기'), overO.replace(/\n/g, '|').slice(0, 300))
    await go(po, `/ops/clients/${OWNER_CLIENT}?tab=smart`)
    await po.waitForTimeout(1200)
    const smartO = (await po.locator('main').innerText().catch(() => '')) ?? ''
    check('대표 맞춤 추천(D-563): 모듈별 판정 · 맞춤 상담 · 맞는 지원사업 칸 그대로', (await po.locator('#module-verdicts').count()) === 1 && ['모듈별 판정', '맞춤 상담', '맞는 지원사업'].every((x) => smartO.includes(x)), smartO.replace(/\n/g, '|').slice(0, 300))
    await cO.close()
  }

  // ---------- D-568 출시 목록 L-4: 고객 문의 · 화면 오류 → 대표 받은함 → 답장 → 고객 화면(진짜 RLS · 0025) ----------
  {
    const open = async (u) => {
      const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
      const pg = await c.newPage()
      // 아래에서 일부러 내는 오류는 세지 않는다
      pg.on('pageerror', (e) => {
        if (!String(e).includes('e2e 일부러 낸 오류')) errors.push(String(e))
      })
      await c.route(`https://${REF}.supabase.co/**`, route)
      await login(pg, u)
      return [c, pg]
    }
    const attack = (pg) =>
      pg.evaluate(async ([ref]) => {
        const tok = JSON.parse(Object.entries(localStorage).find(([k]) => k.includes('auth-token'))?.[1] ?? '{}').access_token
        const h = { apikey: 'qa-anon', Authorization: `Bearer ${tok}`, 'content-type': 'application/json' }
        const base = `https://${ref}.supabase.co/rest/v1`
        const inbox = await fetch(`${base}/rpc/support_inbox`, { method: 'POST', headers: h, body: '{}' }).then(async (r) => (r.ok ? (await r.json()).length : -1))
        const rows = await fetch(`${base}/support_messages?select=user_id`, { headers: h }).then(async (r) => (r.ok ? await r.json() : []))
        const reply = await fetch(`${base}/rpc/support_reply`, { method: 'POST', headers: h, body: JSON.stringify({ p_id: '00000000-0000-0000-0000-000000000000', p_reply: 'x' }) }).then((r) => r.status)
        const read = await fetch(`${base}/rpc/support_mark_read`, { method: 'POST', headers: h, body: JSON.stringify({ p_ids: [] }) }).then((r) => r.status)
        const ins = await fetch(`${base}/support_messages`, { method: 'POST', headers: h, body: JSON.stringify({ kind: 'question', body: '직접 넣기' }) }).then((r) => r.status)
        const upd = await fetch(`${base}/support_messages?kind=eq.question`, { method: 'PATCH', headers: h, body: JSON.stringify({ reply: '내가 쓴 답' }) }).then((r) => r.status)
        const del = await fetch(`${base}/support_messages?kind=eq.question`, { method: 'DELETE', headers: h }).then((r) => r.status)
        return { inbox, users: [...new Set(rows.map((x) => x.user_id))], reply, read, ins, upd, del }
      }, [REF])
    const blocked = (a) => a.inbox === 0 && [a.reply, a.read, a.ins, a.upd, a.del].every((st) => st >= 400)
    check('문의(D-568) 준비: 0025 적용 · 처음에는 0줄', sql(`select count(*) from public.support_messages`) === '0')

    // (1) 고객: 팀장용 설문 대신 [문의하기] → 보내기 → 화면 오류 자동
    let [cS, ps] = await open(CUSTOMER)
    await go(ps, '/settings')
    await ps.waitForTimeout(900)
    const setK = ((await ps.getByTestId('settings-pilot').innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
    check('고객(D-568) 설정: 팀장용 [개발자에게 피드백] 없음 · [문의하기] 있음 · 줄 이름도 "문의하기"(설문이라는 말 없음)', (await ps.getByTestId('feedback-open').count()) === 0 && (await ps.getByTestId('support-open').count()) >= 1 && setK.includes('문의하기') && !setK.includes('개발자에게 피드백') && !setK.includes('설문'), setK.slice(0, 300))
    // D-570 고객 화면은 처음에 단순하게 — [모델 · ○○] 단추는 기본 숨김 · 설정에서 [보이기] 를 고르면 나온다(AI 는 그대로)
    await go(ps, '/')
    await ps.waitForTimeout(1200)
    const pickOff = await ps.getByTestId('model-picker').count()
    await go(ps, '/settings')
    await ps.waitForTimeout(700)
    await ps.locator('[data-testid="settings-model-pick-option"][data-value="show"]').click()
    await go(ps, '/')
    await ps.waitForTimeout(1200)
    const pickOn = await ps.getByTestId('model-picker').count()
    await go(ps, '/settings')
    await ps.waitForTimeout(700)
    await ps.locator('[data-testid="settings-model-pick-option"][data-value="hide"]').click()
    await go(ps, '/')
    await ps.waitForTimeout(1200)
    check('고객(D-570): 오늘 화면에 [모델 · ○○] 단추가 기본으로 없음 → 설정 [보이기] → 나옴 → [숨기기] → 다시 없음', pickOff === 0 && pickOn >= 1 && (await ps.getByTestId('model-picker').count()) === 0, { pickOff, pickOn })
    // D-572 약관 · 안내 글이 약속한 '언제든 내 자료를 통째로' — 고객 설정에 [전체 내려받기] · 받은 파일에는 내 작업공간 것만
    await go(ps, '/settings')
    const expBtn = ps.getByTestId('settings-export')
    await expBtn.waitFor({ timeout: 8000 }).catch(() => {})
    await expBtn.scrollIntoViewIfNeeded().catch(() => {})
    await shot(ps, 'customer-09-settings-export')
    let expFile = null
    try {
      const [dl] = await Promise.all([ps.waitForEvent('download', { timeout: 20000 }), expBtn.click()])
      expFile = JSON.parse(readFileSync(await dl.path(), 'utf8'))
    } catch (e) {
      expFile = { error: String(e).slice(0, 120) }
    }
    const expText = JSON.stringify(expFile)
    check(
      '고객(D-572) 설정: [내 자료 내려받기] 칸 · [전체 내려받기] → 파일 하나(3판) · 대표 작업공간 것(업체 · 대표비밀 주제) 0',
      (await ps.getByTestId('settings-originals').count()) === 1 && expFile?.version === 3 && Array.isArray(expFile?.clients) && !expText.includes(OWNER_WS) && !expText.includes('대표비밀'),
      { version: expFile?.version, clients: expFile?.clients?.length, error: expFile?.error },
    )
    // D-575 고객 계정으로 여는 나머지 화면 한 바퀴 — 열림 · 대표 글 0 · 휴대폰 옆 넘침 0(사진으로도 남긴다)
    const sweep = []
    const sweepErrors = []
    const onErr = (e) => sweepErrors.push(String(e).slice(0, 120))
    ps.on('pageerror', onErr)
    for (const [name, path] of [['calendar', '/ops/calendar'], ['sales', '/sales/board'], ['money', '/money'], ['decide', '/ops/decide'], ['clients', '/ops/clients'], ['threads', '/marketing/threads'], ['shorts', '/marketing/shorts']]) {
      await ps.setViewportSize({ width: 1440, height: 900 })
      await go(ps, path)
      await ps.waitForTimeout(900)
      const t = ((await ps.locator('main').innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
      await shot(ps, `customer-10-${name}`)
      await ps.setViewportSize({ width: 390, height: 844 })
      await ps.waitForTimeout(500)
      const over = await overflowX(ps)
      await shot(ps, `customer-10-${name}-390`)
      sweep.push({ name, ok: t.length > 20 && !t.includes('화면을 찾지 못했습니다') && !OWNER_WORDS.test(t) && !/미래경영지원센터|미래에이아이랩/.test(t), over })
    }
    // 영업 관리의 나머지 탭(미팅 준비 · 상품·제안 · 전략)은 사진과 알림 줄만 — 고객에게 그대로 열어 둘지는 대표가 정한다(보고 🚨)
    for (const [name, path] of [['sales-meeting', '/sales/meeting'], ['sales-proposal', '/sales/proposal'], ['sales-strategy', '/sales/strategy']]) {
      await ps.setViewportSize({ width: 1440, height: 900 })
      await go(ps, path)
      await ps.waitForTimeout(900)
      const t = ((await ps.locator('main').innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
      await shot(ps, `customer-11-${name}`)
      console.log(`INFO  고객 화면 ${path}: 글자 ${t.length} · 대표 낱말 ${OWNER_WORDS.test(t) ? (t.match(OWNER_WORDS)?.[0] ?? '') : '0'} · 찾지 못함 ${t.includes('화면을 찾지 못했습니다') ? '예' : '아니요'}`)
      // D-577 고객에게 드리는 문서(방문 리포트)의 '담당' 줄 — 대표 회사 이름이 아니라 내 브랜드의 회사
      if (name === 'sales-proposal') {
        const staff = t.match(/담당: [^■━]{0,60}/)?.[0] ?? ''
        check('고객(D-577) 상품·제안 방문 리포트: "담당" 줄에 대표 회사 이름(미래경영지원센터 · 미래에이아이랩) 0 · 내 브랜드의 회사가 붙음', !/미래경영지원센터|미래에이아이랩/.test(t) && staff.includes('고객경영연구소'), staff)
      }
    }
    ps.off('pageerror', onErr)
    await ps.setViewportSize({ width: 1440, height: 900 })
    check('고객(D-575) 화면 한 바퀴(일정 · 영업 · 매출 · 확인할 것 · 고객 관리 · 스레드 · 릴스): 전부 열림 · 대표 이름 · 채널 0 · 390 옆 넘침 0 · 화면 오류 0', sweep.every((x) => x.ok && x.over <= 1) && sweepErrors.length === 0, { bad: sweep.filter((x) => !x.ok || x.over > 1), sweepErrors })
    await go(ps, '/settings')
    await ps.waitForTimeout(700)
    await go(ps, '/feedback')
    await ps.waitForTimeout(900)
    check('고객(D-568): /feedback(팀장용 설문) 주소 → 문의하기로', new URL(ps.url()).pathname === '/support' && (await ps.getByTestId('support-page').count()) === 1, ps.url())
    await go(ps, '/guide')
    await ps.getByTestId('guide-support').waitFor({ timeout: 8000 }).catch(() => {})
    await ps.getByTestId('guide-support').click()
    await ps.getByTestId('support-text').waitFor({ timeout: 8000 })
    await ps.waitForTimeout(500)
    check('고객(D-568) 문의하기: 첫 화면은 적는 칸 하나 + [보내기](빈 칸이면 못 누름) · 아직 보낸 것 없음', (await ps.getByTestId('support-send').isDisabled()) && (await ps.getByTestId('support-empty').count()) === 1 && leaked((await mainText(ps)) ?? '').length === 0)
    await shot(ps, 'customer-10-support')
    const ASK = '서류를 올렸는데 칸에 안 들어가요. 어떻게 하나요?'
    await ps.getByTestId('support-text').fill(ASK)
    await ps.getByTestId('support-send').click()
    await ps.getByTestId('support-sent').waitFor({ timeout: 8000 }).catch(() => {})
    await ps.getByTestId('support-row').first().waitFor({ timeout: 8000 }).catch(() => {})
    const rowS = sql(`select kind || '|' || body || '|' || (read_at is null)::text from public.support_messages where user_id = '${CUSTOMER.id}' and kind = 'question'`)
    check('고객(D-568): [보내기] → "보냈어요" · 목록 1건(보냈어요) · DB 에 고객 계정으로 한 줄(안 읽음)', (await ps.getByTestId('support-sent').count()) === 1 && (await ps.getByTestId('support-row').count()) === 1 && (await ps.getByTestId('support-row').first().getAttribute('data-status')) === 'sent' && rowS === `question|${ASK}|true`, rowS)
    await shot(ps, 'customer-11-support-sent')
    await go(ps, '/ops/clients')
    await ps.waitForTimeout(700)
    await ps.evaluate(() => {
      setTimeout(() => {
        throw new Error('e2e 일부러 낸 오류 010-9999-8888')
      }, 0)
    })
    await ps.waitForTimeout(2200)
    const errS = sql(`select body || '|' || (context->>'path') || '|' || (context->>'source') from public.support_messages where user_id = '${CUSTOMER.id}' and kind = 'error'`)
    check('고객(D-568) 화면 오류: 운영자에게 자동으로 한 줄 — 전화번호는 가려서 · 화면 주소 · 잡힌 곳(업체 자료 0)', errS.includes('e2e 일부러 낸 오류 (숫자)') && !errS.includes('9999') && errS.endsWith('|/ops/clients|window'), errS)
    const atkC = await attack(ps)
    check('고객 공격(D-568 · 진짜 RLS): 받은함 0줄 · 답장 · 읽음 · 직접 넣기 · 고치기 · 지우기 막힘 · 자기 글만 읽힘', blocked(atkC) && atkC.users.join() === CUSTOMER.id, JSON.stringify(atkC))
    await cS.close()

    // (2) 내부 팀장: 고객 글은 안 보이고, 받은함 · 답장도 막힌다. 팀장용 설문은 그대로
    let [cT, pt] = await open(PILOT)
    await go(pt, '/settings')
    await pt.waitForTimeout(900)
    check('내부 팀장(D-568) 설정: [개발자에게 피드백] 그대로 · 모델 숨기기 줄 없음(고객 화면에만)', (await pt.getByTestId('feedback-open').count()) >= 1 && (await pt.getByTestId('settings-model-pick').count()) === 0)
    await go(pt, '/')
    await pt.waitForTimeout(1200)
    check('내부 팀장(D-570): 오늘 화면의 [모델 · ○○] 단추는 예전 그대로', (await pt.getByTestId('model-picker').count()) >= 1)
    const atkP = await attack(pt)
    check('내부 팀장 공격(D-568 · 진짜 RLS): 고객 문의 0줄 · 받은함 0줄 · 답장 · 읽음 · 직접 쓰기 막힘', blocked(atkP) && !atkP.users.includes(CUSTOMER.id), JSON.stringify(atkP))
    await cT.close()

    // (3) 대표: 종 · 메뉴 숫자 → 받은 피드백함 [문의 · 오류] 탭 → 열면 읽음 → 답장
    let [cW, pw] = await open(OWNER)
    await go(pw, '/')
    await pw.waitForTimeout(1500)
    const dotW = pw.locator('aside [data-testid="settings-feedback-unread"]').first()
    check('대표(D-568): 메뉴 설정 줄 숫자에 새 문의 · 오류 2', (await dotW.count()) === 1 && ((await dotW.innerText()) ?? '').trim() === '2', await dotW.innerText().catch(() => ''))
    await pw.locator('header button[aria-label^="챙길 것"]').first().click()
    await pw.waitForTimeout(300)
    const bellS = pw.getByTestId('bell-support')
    check('대표(D-568): 종에 "새로 온 문의 1건 · 화면 오류 1건"', (await bellS.count()) === 1 && /문의 1건 · 화면 오류 1건/.test(await bellS.innerText()), await bellS.innerText().catch(() => ''))
    await bellS.click()
    await pw.waitForURL(/\/feedback\/inbox\?tab=support$/, { timeout: 10000 }).catch(() => {})
    await pw.getByTestId('support-inbox-entry').first().waitFor({ timeout: 10000 }).catch(() => {})
    await pw.waitForTimeout(1200)
    const inboxText = ((await pw.getByTestId('support-inbox').innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
    check('대표(D-568) 받은함: 탭 둘(팀장 의견 · 문의 · 오류) · 고객 문의 + 화면 오류 2건 · 보낸 사람 이메일 · "구독 고객" · 새로 표시', (await pw.getByTestId('inbox-tabs').count()) === 1 && (await pw.getByTestId('support-inbox-entry').count()) === 2 && inboxText.includes(ASK) && inboxText.includes('e2e 일부러 낸 오류 (숫자)') && inboxText.includes(CUSTOMER.email) && inboxText.includes('구독 고객') && inboxText.includes('새로'), inboxText.slice(0, 400))
    const readN = sql(`select count(*) from public.support_messages where read_at is not null`)
    check('대표(D-568): 열면 읽음으로 적힘(DB 2줄) · 메뉴 숫자 사라짐', readN === '2' && (await pw.locator('aside [data-testid="settings-feedback-unread"]').count()) === 0, readN)
    await shot(pw, 'owner-support-inbox')
    const qCard = pw.locator('[data-testid="support-inbox-entry"][data-kind="question"]').first()
    await qCard.getByTestId('support-inbox-reply-open').click()
    const ANSWER = '서류함에서 그 파일의 [무슨 서류?] 를 눌러 칸을 골라 주세요.'
    await qCard.getByTestId('support-inbox-reply-text').fill(ANSWER)
    await qCard.getByTestId('support-inbox-reply-send').click()
    await pw.waitForTimeout(1500)
    const replyDb = sql(`select coalesce(reply, '') || '|' || body || '|' || (seen_at is null)::text from public.support_messages where kind = 'question'`)
    check('대표(D-568): 답장 → DB 에 답장만 적힘(보낸 글은 그대로) · 화면에 보낸 답장', replyDb === `${ANSWER}|${ASK}|true` && (await pw.getByTestId('support-inbox-reply').count()) >= 1, replyDb)
    await pw.getByTestId('inbox-tab-feedback').click()
    await pw.waitForTimeout(600)
    check('대표(D-568): [팀장 의견] 탭 — 예전 받은 피드백함 그대로(팀장이 보낸 의견)', (await pw.getByTestId('feedback-entry').count()) >= 1 && (await pw.getByTestId('support-inbox').count()) === 0)
    await pw.setViewportSize({ width: 390, height: 844 })
    await go(pw, '/feedback/inbox?tab=support')
    await pw.waitForTimeout(900)
    check('대표 390(D-568): 받은 문의 · 오류 가로 넘침 0', (await overflowX(pw)) <= 0 && (await pw.getByTestId('support-inbox-entry').count()) === 2, String(await overflowX(pw)))
    await shot(pw, 'owner-support-inbox-390')
    await cW.close()

    // (4) 고객: 메뉴에 '답장' → 문의하기에 운영자 답장 → 본 것으로
    ;[cS, ps] = await open(CUSTOMER)
    await go(ps, '/')
    await ps.waitForTimeout(1500)
    check('고객(D-568): 메뉴 설정 줄에 "답장" 표시', (await ps.locator('aside [data-testid="settings-support-reply"]').count()) === 1)
    await go(ps, '/support')
    await ps.getByTestId('support-reply').first().waitFor({ timeout: 8000 }).catch(() => {})
    await ps.waitForTimeout(1200)
    const replyText = ((await ps.getByTestId('support-list').innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
    const seenDb = sql(`select (seen_at is not null)::text from public.support_messages where kind = 'question'`)
    check('고객(D-568) 문의하기: 운영자 답장이 보임 · "새 답장" · 본 것으로 적힘(DB) · 자동으로 전해진 오류 1건(접힘)', replyText.includes(ANSWER) && replyText.includes('새 답장') && seenDb === 'true' && ((await ps.getByTestId('support-errors').innerText().catch(() => '')) ?? '').includes('1건'), `${replyText.slice(0, 200)} seen=${seenDb}`)
    await shot(ps, 'customer-12-support-reply')
    await ps.setViewportSize({ width: 390, height: 844 })
    await go(ps, '/support')
    await ps.waitForTimeout(900)
    check('고객 390(D-568): 문의하기 가로 넘침 0 · 본 뒤에는 "답장" 표시 사라짐', (await overflowX(ps)) <= 0 && (await ps.locator('[data-testid="settings-support-reply"]').count()) === 0, String(await overflowX(ps)))
    await shot(ps, 'customer-13-support-390')
    await cS.close()
  }

  check('화면 오류(pageerror) 0', errors.length === 0, errors.slice(0, 3).join(' | '))
} finally {
  await browser.close()
  stop()
}
console.log(`\npilot e2e: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
