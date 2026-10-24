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
import { existsSync, mkdirSync } from 'node:fs'
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
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + String(detail).slice(0, 400)}`)
}

const OWNER = { id: '0e000000-0000-4000-8000-0000000000a1', email: 'owner@e2e.kr', password: 'owner-pass' }
const PILOT = { id: '0e000000-0000-4000-8000-0000000000b1', email: 'pilot@e2e.kr', password: 'pilot-pass' }
const OUTSIDER = { id: '0e000000-0000-4000-8000-0000000000c1', email: 'outsider@e2e.kr', password: 'outsider-pass' }
const USERS = [OWNER, PILOT, OUTSIDER]
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
    await page.getByRole('button', { name: '로그아웃' }).click()
  } else {
    await page.getByRole('button', { name: '로그아웃' }).first().click()
  }
  await page.waitForURL((x) => x.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(600)
}
const bodyText = (page) => page.locator('body').innerText().catch(() => '')
const leaked = (t) => SECRETS.filter((s) => t.includes(s))
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
  check('대표(D-185): 안내 영상은 저절로 안 뜸(팀장님 계정만) · 머리줄 [안내 영상] 단추는 있음', (await page.getByTestId('tutorial-dialog').count()) === 0 && (await page.getByTestId('tutorial-open').count()) === 1)
  // 좁은 PC(1100) — 대표 머리줄은 자리가 없어 단추를 숨기고, 사용자 메뉴의 [안내 영상 보기] 로 연다
  await page.setViewportSize({ width: 1100, height: 900 })
  await page.waitForTimeout(300)
  const tutHidden = !(await page.getByTestId('tutorial-open').isVisible())
  await page.getByRole('button', { name: '사용자 메뉴' }).click()
  await page.getByTestId('tutorial-menu-open').click()
  await page.waitForTimeout(400)
  check('대표(D-185): 1100px — 머리줄 단추 대신 사용자 메뉴 [안내 영상 보기] 로 열림', tutHidden && (await page.getByTestId('tutorial-dialog').getAttribute('data-auto')) === '0')
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
  await page.waitForTimeout(1500)
  const certPay = JSON.parse(sql(`select payload::text from public.operations_clients where id = '${OWNER_CLIENT}'`) || '{}')
  const innoCred = (certPay.customFields ?? []).filter((f) => f.group === 'credential' && /이노비즈/.test(f.label))
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
  await page.getByTestId('tutorial-open').click()
  await page.waitForTimeout(500)
  check('Pilot(D-185): 머리줄 [안내 영상] → 언제든 다시(숨기기 단추 없이)', (await tut.count()) === 1 && (await tut.getAttribute('data-auto')) === '0' && (await page.getByTestId('tutorial-hide-today').count()) === 0)
  await page.getByTestId('tutorial-tab-part2').click()
  await page.waitForTimeout(300)
  check('Pilot(D-185): 2편 고르면 2편 영상', /part2-wide\.mp4$/.test(await vsrc(page)), await vsrc(page))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check('Pilot(D-185): Esc 로 닫힘', (await tut.count()) === 0)
  // 팀장 머리줄([안내 영상] 단추가 늘 있다) — 5폭 × 글자 3단계에서 넘치지 않는다
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
          const tb = document.querySelector('[data-testid="tutorial-open"]')
          return { over: hdr.scrollWidth - hdr.clientWidth, cut, btn: !!tb && tb.offsetParent !== null }
        })
        // 아주 큰 글자 · 좁은 PC 에서는 머리줄이 덜 급한 단추(hdr-tight)를 접는다 — 그때는 사용자 메뉴의 [안내 영상 보기]
        if (r.over > 0 || r.cut > 0 || (!r.btn && scale === 'default')) bad.push(`${w}/${scale} ${JSON.stringify(r)}`)
      }
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-text-scale', 'default'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(300)
    check('Pilot 머리줄(D-185): 5폭 × 글자 3단계 넘침 0 · 기본 글자에서는 [안내 영상] 단추 보임', bad.length === 0, bad.join(' | '))
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
  check('P3 Pilot 메뉴(D-195): 마케팅 · 브랜딩 없음(대표 전용)', !nav.includes('마케팅'), nav.replace(/\n/g, '|').slice(0, 400))
  check('P3 Pilot 메뉴(D-206): 홍보 글 만들기 · 홈페이지 만들기 · 콘텐츠 레이더 없음(대표 전용)', !nav.includes('홍보 글') && !nav.includes('홈페이지 만들기') && !nav.includes('콘텐츠 레이더'))
  check('Pilot(D-164): 머리줄 글자 크기 단추 없음 · 보기 방식(PC · Mobile · PC+Mobile) 단추 있음', (await page.locator('header [data-testid="text-scale-quick"]').count()) === 0 && (await page.locator('header [data-testid="device-switch"]').count()) === 1)
  check('Pilot 머리줄: 고객 플랫폼 링크 없음', (await page.locator('header').innerText()).includes('고객 플랫폼') === false)

  // 교차 — 대표 업체 · 숨긴 화면 주소
  for (const p of [`/ops/clients/${OWNER_CLIENT}`, `/ops/clients/${OWNER_CLIENT}?tab=docs`, `/ops/clients/${OWNER_CLIENT}?tab=fees`, `/tools/policy-funding?client=${OWNER_CLIENT}`, `/tools/tax?client=${OWNER_CLIENT}`, `/grants?client=${OWNER_CLIENT}`, '/ops/calendar', '/journal', '/ops/decide', '/money', '/sales/board', '/grants', '/tools', '/settings']) {
    await go(page, p)
    const t = await bodyText(page)
    check(`Pilot 교차: ${p} — 대표 자료 0`, leaked(t).length === 0, leaked(t).join())
  }
  await go(page, `/ops/clients/${OWNER_CLIENT}`)
  check('Pilot 교차: 대표 업체 주소 → "찾지 못했습니다"', /찾지 못|없는 업체|없습니다/.test(await bodyText(page)))
  for (const p of ['/ops/inbox', '/ops/agents', '/sales/first-meeting', '/getting-started', '/why', '/kpi', '/roadmap', '/studio', '/studio/spec-check', '/clients', '/ax/open?client=' + OWNER_CLIENT, '/website-studio', '/modules/tech-biz', '/funding', '/tools/review', '/marketing', '/marketing/youtube', '/marketing/youtube?view=analysis', '/marketing/youtube?view=channels&p=month', '/ai', '/ai/new', '/ai/usage', '/ai/cases/case_qa_owner_01', '/ai/cases/case_qa_owner_01/proposal/x', '/patent-venture', '/patent-venture/plan?client=' + OWNER_CLIENT, '/patent-venture/spec-check', '/patent-venture/write']) {
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
  // D-195 P4: 찾기(Ctrl+K)로도 마케팅 · 콘텐츠 레이더가 안 나온다
  for (const q of ['마케팅', '유튜브', '콘텐츠 레이더']) {
    await search.fill(q)
    await page.waitForTimeout(700)
    const t = await bodyText(page)
    check(`P4 Pilot 찾기: "${q}" → 마케팅 · 콘텐츠 레이더 결과 0`, (await search.isVisible()) && !t.includes('마케팅 · 브랜딩') && !t.includes('콘텐츠 레이더') && (await page.locator('a[href^="/marketing"]').count()) === 0, t.slice(0, 200))
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
  // 다음 약속(일정)
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
  await page.getByLabel('기록 내용').first().fill('은혜테스트정밀 박대표와 통화 — 다음 주 방문')
  await page.getByRole('button', { name: /^기록$/ }).first().click()
  await page.waitForTimeout(900)
  const jr = sql(`select string_agg(content, ' | ' order by content) from public.ops_journal_entries where workspace_id = '${PILOT_WS}'`)
  check('흐름: 할 일 · 업무 일기가 Pilot 작업공간에 저장(DB)', jr.includes('서류 받기') && jr.includes('박대표와 통화'), jr)
  check('흐름: 대표 업무 일기에 섞이지 않음(DB)', !sql(`select coalesce(string_agg(content, '|'), '') from public.ops_journal_entries where workspace_id = '${OWNER_WS}'`).includes('은혜'))
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

  // D-257: 팀장 — 오늘 AI 도우미 띠 → 질문 단추 → 진짜 서버 함수 · 진짜 DB(my_os_access = pilot) → Gemini 로만
  aiCalls.length = 0
  rpcCalls.length = 0
  await go(page, '/')
  const pBar = page.getByTestId('ai-assist-bar').first()
  check('팀장(D-257): 오늘 화면에 AI 도우미 띠', (await pBar.count()) === 1)
  await page.getByTestId('ai-assist-chip').first().click()
  await page.getByTestId('ai-assist-result').first().waitFor({ timeout: 15000 }).catch(() => {})
  const pRes = await page.getByTestId('ai-assist-result').first().innerText().catch(() => '')
  const gem = aiCalls.filter((c) => c.provider === 'gemini')
  check('팀장(D-257): 질문 단추 한 번 → 답 · Gemini 로만 감 · 서버가 DB 에 등급을 물어 팀장으로 판단(my_os_access)', pRes.includes('서류 마감부터') && gem.length === 1 && aiCalls.length === 1 && rpcCalls.some((c) => c.who === PILOT.email && c.fn === 'my_os_access'), { n: aiCalls.length, rpc: rpcCalls.map((c) => `${c.who}:${c.fn}`).join(), pRes: pRes.slice(0, 80) })
  check('팀장(D-257): 지시문에 "팀장이 보냈다" 한 줄 · 보낸 자료에 대표 자료 0', (gem[0]?.sys ?? '').includes('팀장(이 OS 를 함께 쓰는 컨설턴트)') && leaked(gem[0]?.user ?? '').length === 0, leaked(gem[0]?.user ?? '').join())
  await page.getByTestId('ai-assist-model-toggle').first().click()
  await page.waitForTimeout(500)
  const tabs = await page.locator('[data-testid="ai-assist-settings"] [role="tab"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-provider')))
  check('팀장(D-257): 모델 바꾸기 — 회사 탭은 Gemini 하나(GPT · Claude 없음)', tabs.join() === 'gemini', tabs.join())
  await shot(page, 'pilot-07-ai-gemini')
  await page.keyboard.press('Escape')
  const d1 = await assistDirect(PILOT, { requestId: 'pilot-direct-000001', assistId: 'today.top3', page: 'today', choice: { provider: 'anthropic' }, context: { title: '오늘', today: '2026-10-21', sections: [] } })
  const d2 = await assistDirect(PILOT, { requestId: 'pilot-direct-000002', assistId: 'radar.top5', page: 'radar', context: { title: '마케팅', today: '2026-10-21', sections: [] } })
  const d3 = await assistDirect(OUTSIDER, { requestId: 'pilot-direct-000003', assistId: 'today.top3', page: 'today', context: { title: '오늘', today: '2026-10-21', sections: [] } })
  check('팀장(D-257) 서버 직접: Claude 고르면 403 provider_not_allowed · 대표 전용 마케팅 단추 403 · 등급 없는 가입자 403 · AI 회사 안 부름', d1.statusCode === 403 && d1.body.code === 'provider_not_allowed' && d2.statusCode === 403 && d3.statusCode === 403 && aiCalls.length === 1, { d1: d1.body.code, d2: d2.body.code, d3: d3.body.code, n: aiCalls.length })

  // D-258: 팀장 — OS 안 오른쪽 판 AI 대화 → 진짜 서버 함수(side.chat) → Gemini 로만 · 보낸 것에 대표 자료 0
  await page.getByTestId('side-ai-button').click()
  await page.getByTestId('side-ai-dock-chat').click()
  await page.getByTestId('side-dock').waitFor({ timeout: 8000 }).catch(() => {})
  await page.getByTestId('dock-chat-input').fill('정책자금 신청 순서 알려 줘')
  await page.getByTestId('dock-chat-input').press('Enter')
  await page.getByTestId('dock-answer').first().waitFor({ timeout: 15000 }).catch(() => {})
  const dockAns = await page.getByTestId('dock-answer').first().innerText().catch(() => '')
  const gem2 = aiCalls.filter((c) => c.provider === 'gemini')
  check('팀장(D-258): 오른쪽 판 AI 대화 → 판 안에 답 · Gemini 로만 · 팀장 한 줄 · 보낸 것에 대표 자료 0', dockAns.includes('서류 마감부터') && gem2.length === 2 && aiCalls.length === 2 && gem2[1].sys.includes('팀장(이 OS 를 함께 쓰는 컨설턴트)') && gem2[1].user.includes('정책자금 신청 순서') && leaked(gem2[1].user).length === 0, { n: aiCalls.length, dockAns: dockAns.slice(0, 80) })
  await shot(page, 'pilot-08-dock-chat')
  await page.getByTestId('dock-close').click()

  // D-188: 사이드바 아래 — 버전 글자 대신 [개발자에게 피드백](이번 회차 아직이면 '새 설문')
  const side = (await page.locator('aside').first().innerText()) ?? ''
  const fbBtn = page.locator('aside [data-testid="feedback-open"]').first()
  check('팀장(D-188): 사이드바 아래 버전 글자(컨설팅 운영 · AX 스튜디오 · v0.1.0) 없음 · [개발자에게 피드백] · 새 설문 표시', !side.includes('v0.1.0') && !side.includes('컨설팅 운영 · AX 스튜디오') && (await fbBtn.count()) === 1 && (await fbBtn.getAttribute('data-fresh')) === '1' && (await fbBtn.innerText()).includes('개발자에게 피드백'), side.replace(/\n/g, '|').slice(-160))
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
  check('팀장(D-188): 보낸 뒤 사이드바 "새 설문" 표시 사라짐', (await page.locator('aside [data-testid="feedback-open"]').first().getAttribute('data-fresh')) === '0')
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
    const toastC = await toggleType()
    check('안정(INT-1): 화면을 연 사이 다른 곳이 고친 업체 — 이 화면 저장이 덮어쓰지 않음(진짜 DB) · 알림', toastC.includes('먼저 고쳐서') && contactOf() === '다른 곳에서 고친 담당자' && typeOf() === t0, JSON.stringify({ toastC, c: contactOf(), t: typeOf(), t0 }))
    await page.waitForTimeout(800)
    await toggleType()
    check('안정(INT-1): 새로 불러온 뒤 다시 누르면 저장 · 다른 곳이 고친 담당자도 그대로', typeOf() !== t0 && contactOf() === '다른 곳에서 고친 담당자', JSON.stringify({ t: typeOf(), t0, c: contactOf() }))
    await toggleType()
    check('안정(INT-1): 같은 창에서 이어서 저장은 막히지 않음(되돌림)', typeOf() === t0, JSON.stringify({ t: typeOf(), t0 }))
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
      await page.waitForTimeout(700)
      const pre = await page.evaluate(() => ({ email: document.getElementById('email')?.value ?? '', focus: document.activeElement?.id ?? '', text: document.body.innerText }))
      return { info, pre }
    }
    const toPilot = await switchVia(PILOT)
    check('계정(D-184): 대표 메뉴에 "최은혜 팀장 계정으로 바꾸기" 하나 · 로그아웃 하나', toPilot.info.n === 1 && toPilot.info.email === PILOT.email && /최은혜 팀장 계정으로 바꾸기/.test(toPilot.info.text) && toPilot.info.out === 1, JSON.stringify(toPilot.info))
    check('계정(D-184): 바꾸기 → 로그인 화면 · 팀장 이메일이 미리 들어감 · 비밀번호 칸에 커서', page.url().includes('/login') && toPilot.pre.email === PILOT.email && toPilot.pre.focus === 'password', JSON.stringify({ u: page.url(), e: toPilot.pre.email, f: toPilot.pre.focus }))
    check('계정(D-184): 로그인 화면 안내 "최은혜 팀장 계정으로 로그인합니다" · 계정 둘', toPilot.pre.text.includes('최은혜 팀장 계정으로 로그인합니다') && (await page.getByTestId('recent-account').count()) === 2)
    check('계정(D-184): 로그인 화면에 대표 자료 0(이메일 · 이름만)', leaked(toPilot.pre.text).length === 0, leaked(toPilot.pre.text).join())
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
    await go(page, '/tools/labcare')
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
    const inboxBtn = page.locator('aside [data-testid="feedback-inbox-open"]').first()
    check('대표(D-188): 사이드바 아래 버전 글자 없음 · [받은 피드백함] + 새 피드백 1', !oside.includes('v0.1.0') && (await inboxBtn.count()) === 1 && (await inboxBtn.getAttribute('data-unread')) === '1', oside.replace(/\n/g, '|').slice(-160))
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
    check('대표(D-188): 열면 읽음으로 적힘(DB readAt) · 사이드바 숫자 사라짐', readAt.length > 10 && (await page.locator('aside [data-testid="feedback-inbox-open"]').first().getAttribute('data-unread')) === '0', readAt)
    await shot(page, 'owner-feedback-inbox')
  }

  /* ---------- D-164: 대표 → 최은혜 팀장 화면 바로 보기(다시 로그인 없이) ---------- */
  await go(page, '/ops/clients')
  const vs = page.locator('header [data-testid="view-as-switch"]')
  check('대표(D-164): 머리줄에 [대표 | 최은혜 팀장] 단추', (await vs.count()) === 1 && /최은혜\s*팀장/.test(await vs.innerText()), await vs.innerText().catch(() => ''))
  restLog = []
  await vs.locator('[data-view="pilot"]').click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
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
  await page.locator('header [data-testid="view-as-switch"] [data-view="owner"]').click()
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
          return { over: hdr.scrollWidth - hdr.clientWidth, cut, sw }
        })
        if (r.over > 0 || r.cut > 0 || r.sw !== 1) bad.push(`${w}/${scale} ${JSON.stringify(r)}`)
      }
    }
    await page.evaluate(() => document.documentElement.setAttribute('data-text-scale', 'default'))
    check('대표 머리줄(D-164): 5폭 × 글자 3단계 넘침 0 · 전환 단추 늘 하나', bad.length === 0, bad.join(' | '))
    // 좁은 PC(1280) — 단추 하나 → 고르기 창 → 팀장 화면 → 다시 대표
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.waitForTimeout(300)
    const vc = page.locator('header [data-testid="view-as-compact"]')
    await vc.locator('button[aria-haspopup]').click()
    await shot(page, 'owner-1280-viewas-menu')
    await vc.locator('[data-view="pilot"]').click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    const pv2 = await bodyText(page)
    check('대표 1280(D-164): 단추 하나로 팀장 화면 · 대표 업체 안 보임', (await page.getByTestId('viewing-pilot').count()) === 1 && pv2.includes('은혜테스트정밀') && leaked(pv2).length === 0)
    await vc.locator('button[aria-haspopup]').click()
    await vc.locator('[data-view="owner"]').click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    await go(page, '/ops/clients')
    check('대표 1280(D-164): 다시 대표 화면', (await page.getByTestId('viewing-pilot').count()) === 0 && (await bodyText(page)).includes('대표비밀정밀'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(300)
  }

  /* ---------- D-164: 보기 방식 — PC+Mobile(같은 로그인 · 같은 자료) ---------- */
  await page.locator('header [data-testid="device-switch"] [data-mode="dual"]').click()
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
  check('390 Pilot(D-185): 머리줄 [안내 영상] 단추(휴대폰은 아이콘) 44 이상 · 머리줄 넘침 0', ((await mp.getByTestId('tutorial-open').boundingBox())?.height ?? 0) >= 44 && (await overflowX(mp)) <= 0)
  const bottom = (await mp.locator('nav').last().innerText().catch(() => '')) ?? ''
  check('390 Pilot: 하단 메뉴에 상담 없음', !bottom.includes('상담'), bottom.replace(/\n/g, '|'))
  check('390 Pilot: 오늘 화면 가로 넘침 0', (await overflowX(mp)) <= 0, String(await overflowX(mp)))
  await shot(mp, 'pilot-m01-today')
  await mp.getByRole('button', { name: /더보기|메뉴/ }).last().click().catch(() => {})
  await mp.waitForTimeout(500)
  const drawer = await bodyText(mp)
  check('390 Pilot: 메뉴 열어도 숨긴 묶음 없음', !drawer.includes('잘 안 쓰는 기능') && !drawer.includes('이 시스템') && !drawer.includes('영업자 정산'))
  check('P3 390 Pilot(D-195): 휴대폰 메뉴 · 하단 메뉴에 마케팅 없음', !drawer.includes('마케팅') && !bottom.includes('마케팅'))
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
  await mp.waitForTimeout(700)
  check('390(D-184): 서랍 로그아웃 → 로그인 화면 · 이 기기 계정 1개(팀장)', mp.url().includes('/login') && (await mp.getByTestId('recent-account').count()) === 1 && (await mp.getByTestId('recent-account').getAttribute('data-email')) === PILOT.email)
  check('390(D-184): 로그인 화면 넘침 0', (await overflowX(mp)) <= 0, String(await overflowX(mp)))
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
  await p3.getByTestId('tutorial-open').click()
  await p3.waitForTimeout(400)
  check('Pilot(D-185): 그래도 머리줄 [안내 영상] 으로는 열린다', (await p3.getByTestId('tutorial-dialog').count()) === 1)
  await c3.close()

  check('화면 오류(pageerror) 0', errors.length === 0, errors.slice(0, 3).join(' | '))
} finally {
  await browser.close()
  stop()
}
console.log(`\npilot e2e: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
