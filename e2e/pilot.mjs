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
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))

  /* ================= 1. 대표 — 몇 달 쓴 자료가 보인다 ================= */
  await login(page, OWNER)
  await go(page, '/ops/clients')
  const ownerList = await bodyText(page)
  check('대표: 자기 업체가 보인다(대표비밀정밀)', ownerList.includes('대표비밀정밀'), ownerList.slice(0, 300))
  check('대표: 메뉴 그대로(잘 안 쓰는 기능 · 이 시스템 · 영업자 정산)', ['잘 안 쓰는 기능', '이 시스템', '영업자 정산'].every((s) => ownerList.includes(s)))
  await go(page, `/ops/clients/${OWNER_CLIENT}?tab=work`)
  const ownWork = await bodyText(page)
  check('대표(D-171): 내가 만든 업무 항목(세무기장 · 모두의 창업 2차)은 내 화면에 보인다', ownWork.includes('세무기장') && ownWork.includes('모두의 창업'), ownWork.slice(0, 300))
  // P1 릴리스: 클라우드(진짜 RLS)에서 연구소 관리 기록 → 기업인증 판정 · 진행 기록 · 인증 완료가 DB 로
  sql(`insert into public.module_data (id, workspace_id, module_key, bucket, client_id, payload) values ('qa-lab-orig', '${OWNER_WS}', 'labcare', 'orig', null, '{"key":"pmsaas:clients:v1","value":[{"id":"${OWNER_CLIENT}","labType":"기업부설연구소","labName":"대표비밀연구소","certifiedDate":"2024-05-10","labRegistrationNumber":"2024-777","researcherCount":4}]}'::jsonb) on conflict (id) do nothing`)
  await go(page, `/tools/cert-os?client=${OWNER_CLIENT}`)
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

  // 대표가 브라우저에 남긴 값(작성 중 메모 · 도구 입력) — 다음 사람에게 보이면 안 된다
  await page.evaluate(() => {
    localStorage.setItem('axmvp.qa.ownerDraft', '대표비밀 작성 중 메모')
    localStorage.setItem('planChecklist:대표비밀정밀', '{"memo":"대표비밀 체크"}')
    sessionStorage.setItem('axmvp.qa.ownerSession', '대표비밀 세션 값')
  })
  await logout(page)
  check('대표 로그아웃: 로그인 화면', page.url().includes('/login'))
  const afterOut = await page.evaluate(() => Object.keys(localStorage).filter((k) => !k.startsWith('axmvp.u.') && !k.startsWith('sb-') && /^(axmvp|planChecklist)/.test(k) && !['axmvp.schema_version', 'axmvp.staleChunkReloadAt', 'axmvp.grants.feed.v1'].includes(k)))
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
  const today = await bodyText(page)
  check('Pilot: 로그인하면 오늘 화면', !page.url().includes('/login') && (await page.getByTestId('no-access').count()) === 0, page.url())
  check('Pilot: 오늘 — "등록된 업체가 없습니다 · 첫 업체 등록"', (await page.getByTestId('today-first-client').count()) === 1 && today.includes('업체를 등록하면 일정 · 서류 · 업무 · 수금을 한곳에서 관리할 수 있습니다'))
  check('Pilot: 화면 어디에도 대표 이름(김상호) 없음 — 사이드바 · 머리줄 사용자 칸', !today.includes('김상호'), today.split('\n').filter((l) => l.includes('김상호')).join(' | '))
  check('Pilot: 안내 창이 저절로 뜨지 않음', (await page.locator('[role="dialog"]').count()) === 0)
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
  for (const p of ['/ops/inbox', '/ops/agents', '/sales/first-meeting', '/getting-started', '/why', '/kpi', '/roadmap', '/studio', '/clients', '/ax/open?client=' + OWNER_CLIENT, '/website-studio', '/modules/tech-biz', '/funding', '/tools/review']) {
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
    return out
  }, [REF, OWNER_WS, OWNER_CLIENT])
  check('Pilot REST: 표 8개 어디에도 대표 자료 없음', Object.entries(direct).filter(([k]) => !['patch', 'del', 'insert', 'ws2', 'tier'].includes(k)).every(([, v]) => leaked(String(v)).length === 0 && !String(v).includes(OWNER_WS)), JSON.stringify(direct).slice(0, 400))
  check('Pilot REST: 대표 업체 id 로 읽기 = []', direct.byId === '[]', direct.byId)
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
  await page.getByLabel('업체명').fill('은혜테스트정밀(주)')
  await page.getByLabel('대표자·담당자').fill('박은혜')
  await page.getByRole('button', { name: '등록하고 열기' }).click()
  await page.waitForURL(/\/ops\/clients\/[^/?]+/, { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(900)
  const pc = sql(`select id from public.operations_clients where workspace_id = '${PILOT_WS}' and company_name = '은혜테스트정밀(주)'`)
  check('흐름: 업체가 Pilot 작업공간에 저장(DB)', pc.length > 0, pc)
  check('흐름: 등록하면 그 업체 화면', page.url().includes(`/ops/clients/${pc}`), page.url())
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
  await go(page, `/ops/clients/${pc}?tab=work`)
  const pWork = await bodyText(page)
  check('팀장(D-171): 업무 탭에 대표가 만든 항목(세무기장 · 모두의 창업 2차) 없음', leaked(pWork).length === 0, leaked(pWork).join())
  await page.getByRole('button', { name: '업무 항목 추가' }).click()
  await page.waitForTimeout(800)
  const pCat = await bodyText(page)
  check('팀장(D-171): 업무 항목 창 — 대표 항목 없음 · 상품표 40개에서 고르기', leaked(pCat).length === 0 && (await page.getByTestId('service-pkg').count()) === 40, leaked(pCat).join())
  await page.getByRole('button', { name: '닫기' }).first().click().catch(() => {})
  await go(page, '/ops/clients')
  const pHub = await bodyText(page)
  check('팀장(D-171): 고객 관리 — "잠재고객" 칸 · 돈 칸은 "미수금"', pHub.includes('잠재고객') && pHub.includes('미수금') && !pHub.includes('못 받은 내 돈'), pHub.slice(0, 300))

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
  await go(page, '/ops/agents')
  check('대표 → 팀장 화면: 대표 전용 주소도 팀장처럼 막힘', (await bodyText(page)).includes('화면을 찾지 못했습니다'))
  await go(page, '/settings')
  check('대표 → 팀장 화면: 설정 이름 칸 대신 안내(여기서 저장하면 대표 이름이 바뀌므로)', (await page.getByTestId('name-editor-viewing').count()) === 1 && (await page.getByTestId('name-input').count()) === 0)
  await go(page, '/')
  await page.locator('header [data-testid="view-as-switch"] [data-view="owner"]').click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  await go(page, '/ops/clients')
  const back2 = await bodyText(page)
  check('팀장 → 대표 화면: 대표 업체 다시 · 팀장 줄 없음 · 대표 메뉴', back2.includes('대표비밀정밀') && (await page.getByTestId('viewing-pilot').count()) === 0 && ((await page.locator('aside').first().innerText()) ?? '').includes('영업자 정산'))
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
  const bottom = (await mp.locator('nav').last().innerText().catch(() => '')) ?? ''
  check('390 Pilot: 하단 메뉴에 상담 없음', !bottom.includes('상담'), bottom.replace(/\n/g, '|'))
  check('390 Pilot: 오늘 화면 가로 넘침 0', (await overflowX(mp)) <= 0, String(await overflowX(mp)))
  await shot(mp, 'pilot-m01-today')
  await mp.getByRole('button', { name: /더보기|메뉴/ }).last().click().catch(() => {})
  await mp.waitForTimeout(500)
  const drawer = await bodyText(mp)
  check('390 Pilot: 메뉴 열어도 숨긴 묶음 없음', !drawer.includes('잘 안 쓰는 기능') && !drawer.includes('이 시스템') && !drawer.includes('영업자 정산'))
  await shot(mp, 'pilot-m02-menu')
  await mp.keyboard.press('Escape')
  await go(mp, '/ops/clients')
  check('390 Pilot: 업체 목록 — 내 업체만 · 넘침 0', (await bodyText(mp)).includes('은혜테스트정밀') && leaked(await bodyText(mp)).length === 0 && (await overflowX(mp)) <= 0)
  await shot(mp, 'pilot-m03-clients')
  await go(mp, `/ops/clients/${pc}`)
  check('390 Pilot: 업체 상세 넘침 0 · 고객 화면 · 컨설팅 탭 없음', (await overflowX(mp)) <= 0 && (await mp.getByRole('tab', { name: /고객 화면|컨설팅/ }).count()) === 0)
  await shot(mp, 'pilot-m04-detail')
  await go(mp, `/ops/clients/${OWNER_CLIENT}`)
  check('390 Pilot: 대표 업체 주소 — 대표 자료 0', leaked(await bodyText(mp)).length === 0)
  await m.close()

  check('화면 오류(pageerror) 0', errors.length === 0, errors.slice(0, 3).join(' | '))
} finally {
  await browser.close()
  stop()
}
console.log(`\npilot e2e: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
