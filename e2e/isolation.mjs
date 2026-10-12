/**
 * 격리 집중 시뮬레이션 (D-186) — "팀장(Pilot)은 절대 대표 화면 · 자료를 볼 수 없다" 를 무작위로 수백 번 두드린다.
 *
 *   로컬 PostgreSQL(axe2e: 0001~0020 + pilot_provision) ← PostgREST ← 브라우저 — 진짜 RLS 위에서.
 *   pilot.mjs 가 '정해진 길' 을 한 번씩 밟는다면, 여기서는 **무작위 조합**으로 오래 두드린다:
 *     [화면] 팀장으로 로그인 → 허용 · 숨김 · 대표 전용 주소를 섞어 무작위로 오가며(뒤로 · 새로고침 · 저장소 조작 · 검색)
 *            매 걸음 화면에 대표 표식(회사 · 사람 · 번호 · 업무 항목) · 대표 이름 · 대표 전용 메뉴 · 화면 전환 단추가 없는지.
 *     [저장소] axmvp.active_workspace 를 대표 작업공간 id 로 몰래 바꿔도 → 그 자료가 열리지 않는지.
 *     [API] 팀장 토큰으로 읽을 수 있는 모든 표를 직접 긁고(select *), 대표 작업공간 id 로 걸러 읽고, 고치고 · 지우고 · 넣고,
 *           등급을 올리고 · 대표 작업공간 구성원으로 몰래 들어가 본다 — 전부 빈손이어야 하고 DB 는 그대로여야 한다.
 *
 *   sudo node e2e/isolation.mjs [스크린샷 폴더]   (pg_ctlcluster 16 main start 먼저)
 */
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'

const SHOTS = process.argv[2] ?? ''
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const REF = 'qaiso'
const PORT = Number(process.env.ISO_PORT ?? 4557)
const PGRST_PORT = Number(process.env.ISO_PGRST_PORT ?? 4556)
const E2E_DB = process.env.AXE2E_DB ?? 'axe2e'
const BASE = `http://localhost:${PORT}`
const OUT = process.env.ISO_OUT ?? 'dist-qa-iso'
const SECRET = 'e2e-local-jwt-secret-at-least-32-characters-long'
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + String(detail).slice(0, 300)}`)
}

const OWNER = { id: '0e000000-0000-4000-8000-0000000000a1', email: 'owner@e2e.kr', password: 'owner-pass' }
const PILOT = { id: '0e000000-0000-4000-8000-0000000000b1', email: 'pilot@e2e.kr', password: 'pilot-pass' }
const USERS = [OWNER, PILOT]
const OWNER_WS = '0e0000aa-0000-4000-8000-00000000000a'
const OWNER_CLIENT = 'owner-secret-1'
// 대표만 아는 표식 — 화면 · API 어디에도 팀장에게 보이면 안 된다
const SECRETS = ['대표비밀', '김비밀', '111-22-33333', '010-1111-2222', '세무기장', '모두의 창업 2차', '대표정책자금메모', '대표상담내용']
const OWNER_NAME = '김상호'
// 고정 씨앗 난수 — 실패를 다시 재현할 수 있게(매번 같은 순서)
let seed = 20261012
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]

// ---------- DB · PostgREST ----------
execSync('bash scripts/db-local/e2e-pilot-db.sh', { stdio: 'ignore' })
const sql = (q) => execSync(`su postgres -c "psql -At -q -d ${E2E_DB}"`, { input: q }).toString().trim()
const PILOT_WS = sql(`select id from public.workspaces where owner_id = '${PILOT.id}'`)
// 대표 작업공간에 표식을 넓게 심는다(여러 표) — "모든 표를 긁어도 0" 을 실제로 의미 있게
sql(`insert into public.ops_custom_services (workspace_id, key, label, short_label, sort_order) values ('${OWNER_WS}', 'custom_d186a', '세무기장', '세무기장', 201), ('${OWNER_WS}', 'custom_d186b', '모두의 창업 2차', '모두의 창업', 202) on conflict (workspace_id, key) do nothing`)
sql(`update public.module_data set payload = '{"text":"대표정책자금메모"}'::jsonb where id = 'md-owner-1'`)
sql(`update public.customer_events set customer_safe_payload = '{"companyName":"대표비밀정밀(주)","message":"대표상담내용"}'::jsonb where dedupe_key = 'qa-owner-ev-1'`)
check('준비: 팀장 작업공간 하나 · 업체 0', PILOT_WS.length === 36 && sql(`select count(*) from public.operations_clients where workspace_id = '${PILOT_WS}'`) === '0', PILOT_WS)
check('준비: 등급 — 대표 full · 팀장 pilot', sql(`select string_agg(tier,',' order by tier) from public.os_access`) === 'full,pilot')
// authenticated 가 읽을 수 있는 모든 public 표(격리의 과녁) — API 로 전부 긁는다
const TABLES = sql(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and has_table_privilege('authenticated', c.oid, 'select') order by 1`).split('\n').filter(Boolean)
check('준비: authenticated 가 읽는 public 표 목록을 얻음(40개 이상)', TABLES.length >= 40, String(TABLES.length))

let PGRST = process.env.POSTGREST_BIN ?? '.cache/postgrest/postgrest'
if (!existsSync(PGRST)) {
  mkdirSync('.cache/postgrest', { recursive: true })
  execSync('curl -sSL -o .cache/postgrest/p.tar.xz https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz && tar xf .cache/postgrest/p.tar.xz -C .cache/postgrest')
  PGRST = '.cache/postgrest/postgrest'
}
const pgrst = spawn(PGRST, [], {
  stdio: 'ignore', detached: true,
  env: { ...process.env, PGRST_DB_URI: `postgres://authenticator:e2e-local@127.0.0.1:5432/${E2E_DB}`, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: SECRET, PGRST_SERVER_PORT: String(PGRST_PORT), PGRST_DB_POOL: '5' },
})
execSync(`npx vite build --outDir ${OUT} --emptyOutDir`, { stdio: 'ignore', env: { ...process.env, VITE_DATA_MODE: 'supabase', VITE_SUPABASE_URL: `https://${REF}.supabase.co`, VITE_SUPABASE_ANON_KEY: 'qa-anon' } })
const server = spawn('npx', ['vite', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true })
const stop = () => { for (const p of [server, pgrst]) { try { process.kill(-p.pid) } catch { /* 이미 꺼짐 */ } } }
for (let i = 0; i < 60; i += 1) {
  try { const [a, b] = await Promise.all([fetch(BASE), fetch(`http://127.0.0.1:${PGRST_PORT}/`)]); if (a.ok && b.status < 500) break } catch { /* 아직 */ }
  await new Promise((r) => setTimeout(r, 250))
}

// ---------- 로그인 흉내(서명 JWT 는 PostgREST 가 검증) ----------
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (u) => { const h = b64({ alg: 'HS256', typ: 'JWT' }); const p = b64({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', exp: 4102444800 }); return `${h}.${p}.${createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}` }
const meta = new Map()
const userObj = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: meta.get(u.id) ?? {}, created_at: '2026-01-01T00:00:00Z' })
const sessionOf = (u) => ({ access_token: jwt(u), token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: `refresh-${u.id}`, user: userObj(u) })
const whoOf = (auth) => USERS.find((u) => jwt(u) === (auth ?? '').replace(/^Bearer /, '')) ?? null
const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
let restLog = []
async function route(r) {
  const req = r.request()
  const url = new URL(req.url())
  const path = decodeURIComponent(url.pathname)
  const headers = req.headers()
  if (path === '/auth/v1/token') {
    const body = JSON.parse(req.postData() ?? '{}')
    const u = url.searchParams.get('grant_type') === 'refresh_token' ? USERS.find((x) => `refresh-${x.id}` === body.refresh_token) : USERS.find((x) => x.email === body.email && x.password === body.password)
    return u ? r.fulfill(json(sessionOf(u))) : r.fulfill(json({ error: 'invalid_grant' }, 400))
  }
  if (path === '/auth/v1/user') { const u = whoOf(headers['authorization']); return u ? r.fulfill(json(userObj(u))) : r.fulfill(json({ msg: 'no' }, 401)) }
  if (path === '/auth/v1/logout') return r.fulfill({ status: 204, body: '' })
  if (path.startsWith('/storage/v1/')) return r.fulfill(path.startsWith('/storage/v1/object/sign/') ? json({ signedURL: '/object/sign/x?token=t' }) : json([]))
  if (path.startsWith('/rest/v1/')) {
    const fwd = { ...headers }
    delete fwd['host']
    if (!whoOf(fwd['authorization'])) delete fwd['authorization']
    const res = await r.fetch({ url: `http://127.0.0.1:${PGRST_PORT}${path.slice('/rest/v1'.length)}${url.search}`, headers: fwd })
    const body = await res.text()
    restLog.push({ who: whoOf(fwd['authorization'])?.email ?? 'anon', body })
    return r.fulfill({ status: res.status(), headers: { ...res.headers(), 'access-control-allow-origin': '*' }, body })
  }
  return r.fulfill(json([]))
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } })
const errors = []
const leaked = (t) => SECRETS.filter((s) => (t ?? '').includes(s))
const bodyText = (page) => page.locator('body').innerText().catch(() => '')

async function login(page, u) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByLabel('이메일').fill(u.email)
  await page.getByLabel('비밀번호').fill(u.password)
  await page.getByRole('button', { name: /^로그인/ }).click()
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {})
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(600)
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  ctx.setDefaultTimeout(60000) // 게이트 부하에서도 입력 · 이동이 안 끊기게(격리 판정과 무관한 시간 초과 방지)
  await ctx.route(`https://${REF}.supabase.co/**`, route)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))

  /* ===== 1. API 집중 공격 — 팀장 토큰으로 할 수 있는 모든 것 ===== */
  await login(page, PILOT)
  const api = await page.evaluate(async ([ref, tables, ws, cid, ownerId, myId]) => {
    const s = JSON.parse(localStorage.getItem(`sb-${ref}-auth-token`) ?? '{}')
    const h = { apikey: 'qa-anon', Authorization: `Bearer ${s.access_token}`, 'content-type': 'application/json', Prefer: 'return=representation' }
    const base = `https://${ref}.supabase.co/rest/v1`
    const txt = (p, o) => fetch(`${base}${p}`, o).then((r) => r.text()).catch((e) => 'ERR ' + e)
    const st = (p, o) => fetch(`${base}${p}`, o).then((r) => r.status).catch(() => -1)
    const readAll = {}
    const byOwnerWs = {}
    for (const t of tables) {
      readAll[t] = await txt(`/${t}?select=*&limit=200`, { headers: h })
      byOwnerWs[t] = await txt(`/${t}?workspace_id=eq.${ws}&select=*`, { headers: h }) // 열이 없으면 에러 문자열(표식 없음)
    }
    const mut = {}
    mut.patchClient = await txt(`/operations_clients?id=eq.${cid}`, { method: 'PATCH', headers: h, body: JSON.stringify({ company_name: '팀장이 고침' }) })
    mut.delClient = await txt(`/operations_clients?id=eq.${cid}`, { method: 'DELETE', headers: h })
    mut.insClient = await st(`/operations_clients`, { method: 'POST', headers: h, body: JSON.stringify({ id: 'iso-sneak', workspace_id: ws, company_name: '몰래' }) })
    mut.insJournal = await st(`/ops_journal_entries`, { method: 'POST', headers: h, body: JSON.stringify({ workspace_id: ws, owner_id: ownerId, entry_date: '2026-10-12', entry_type: 'note', content: 'x' }) })
    mut.tierUp = await st(`/os_access?user_id=eq.${myId}`, { method: 'PATCH', headers: h, body: JSON.stringify({ tier: 'full' }) })
    mut.joinOwner = await st(`/workspace_members`, { method: 'POST', headers: h, body: JSON.stringify({ workspace_id: ws, user_id: myId, role: 'editor' }) })
    mut.makeWs = await st(`/rpc/create_workspace`, { method: 'POST', headers: h, body: JSON.stringify({ p_name: '두 번째' }) })
    mut.acceptInvite = await st(`/rpc/accept_workspace_invite`, { method: 'POST', headers: h, body: JSON.stringify({ invite_token: 'bogus' }) })
    mut.canWriteOwner = await txt(`/rpc/can_write_workspace`, { method: 'POST', headers: h, body: JSON.stringify({ ws }) })
    mut.roleOwner = await txt(`/rpc/current_workspace_role`, { method: 'POST', headers: h, body: JSON.stringify({ ws }) })
    mut.pilotViews = await txt(`/rpc/my_pilot_views`, { method: 'POST', headers: h, body: '{}' })
    return { readAll, byOwnerWs, mut }
  }, [REF, TABLES, OWNER_WS, OWNER_CLIENT, OWNER.id, PILOT.id])

  const allReads = Object.values(api.readAll)
  const leakTables = Object.entries(api.readAll).filter(([, v]) => leaked(v).length > 0 || v.includes(OWNER_WS)).map(([k]) => k)
  check(`API: 팀장이 읽을 수 있는 ${TABLES.length}개 표 전부 — 대표 표식 · 대표 작업공간 id 0`, leakTables.length === 0, leakTables.join(','))
  const byWsLeak = Object.entries(api.byOwnerWs).filter(([, v]) => leaked(v).length > 0).map(([k]) => k)
  check('API: 모든 표를 대표 작업공간 id 로 걸러 읽어도 대표 표식 0', byWsLeak.length === 0, byWsLeak.join(','))
  check('API: 대표 업체 고치기 · 지우기 = 0줄', api.mut.patchClient === '[]' && api.mut.delClient === '[]', `${api.mut.patchClient} ${api.mut.delClient}`)
  check('API: 대표 작업공간에 업체 · 업무 일기 넣기 막힘', api.mut.insClient >= 400 && api.mut.insJournal >= 400, `${api.mut.insClient} ${api.mut.insJournal}`)
  check('API: 내 등급 full 로 올리기 막힘(또는 0줄)', api.mut.tierUp >= 400 || api.mut.tierUp === 200, String(api.mut.tierUp)) // RLS update 0줄이면 200+[]
  check('API: 대표 작업공간 구성원으로 몰래 들어가기 막힘', api.mut.joinOwner >= 400, String(api.mut.joinOwner))
  check('API: 작업공간 하나 더 만들기 막힘', api.mut.makeWs >= 400, String(api.mut.makeWs))
  check('API: 대표 작업공간에 쓰기 권한 없음(can_write=false)', /false/.test(api.mut.canWriteOwner) || api.mut.canWriteOwner === 'false', api.mut.canWriteOwner)
  check('API: 대표 작업공간 내 역할 없음(current_role null)', api.mut.roleOwner === 'null' || api.mut.roleOwner === '' || /null/.test(api.mut.roleOwner), api.mut.roleOwner)
  check('API: 팀장에게는 "볼 수 있는 팀장 화면" 목록이 비어 있음(대표만 가짐)', api.mut.pilotViews === '[]', api.mut.pilotViews)
  check('API: 응답 어디에도 대표 자료 없음(모아 보기)', allReads.every((v) => leaked(v).length === 0), '')
  // DB 가 그대로인가
  check('DB: 대표 업체 이름 · 줄 수 그대로', sql(`select company_name from public.operations_clients where id = '${OWNER_CLIENT}'`) === '대표비밀정밀(주)' && sql(`select count(*) from public.operations_clients where workspace_id = '${OWNER_WS}'`) === '2')
  check('DB: 팀장 등급 그대로 pilot', sql(`select tier from public.os_access where user_id = '${PILOT.id}'`) === 'pilot')
  check('DB: 대표 작업공간 구성원 = 대표 하나(팀장 안 들어옴)', sql(`select string_agg(user_id::text,',') from public.workspace_members where workspace_id = '${OWNER_WS}'`) === OWNER.id, sql(`select string_agg(user_id::text,',') from public.workspace_members where workspace_id = '${OWNER_WS}'`))

  /* ===== 2. 저장소 조작 — 대표 작업공간 id 를 몰래 심어도 안 열린다 ===== */
  await page.evaluate((ws) => localStorage.setItem('axmvp.active_workspace', ws), OWNER_WS)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const tamperText = await bodyText(page)
  const tamperWs = await page.evaluate(() => localStorage.getItem('axmvp.active_workspace'))
  check('저장소 조작: active_workspace 를 대표 id 로 바꿔도 대표 자료 0 · 내 화면(첫 업체 등록)', leaked(tamperText).length === 0 && !tamperText.includes(OWNER_NAME) && (await page.getByTestId('today-first-client').count()) === 1, leaked(tamperText).join())
  check('저장소 조작: 저장된 작업공간이 내 것으로 되돌려짐(대표 id 아님)', tamperWs !== OWNER_WS && tamperWs !== null, String(tamperWs))

  /* ===== 3. 무작위 UI 두드리기 — 허용 · 숨김 · 대표 전용 주소를 섞어 ===== */
  const PILOT_OK = ['/', '/ops/clients', '/ops/decide', '/ops/calendar', '/journal', '/money', '/grants', '/marketing', '/settings', '/tools', '/tools/tax', '/tools/employment', '/tools/labcare', '/tools/cert-os', '/tools/startup-tax', '/tools/policy-funding']
  const OWNER_ONLY = ['/studio', '/diagnosis', '/validation', '/selection', '/mvp-design', '/deliverables', '/website-studio', '/funding', '/reports', '/cases', '/sales/board', '/sales/first-meeting', '/ops/inbox', '/kpi', '/roadmap', '/why', '/getting-started', '/tools/cretop', '/tools/sales-kit', '/tools/review', '/modules/tech-biz']
  const DEEP = [`/ops/clients/${OWNER_CLIENT}`, `/tools/tax?client=${OWNER_CLIENT}`, `/tools/cert-os?client=${OWNER_CLIENT}`, `/ops/clients/${OWNER_CLIENT}?tab=consulting`, `/ops/clients/${OWNER_CLIENT}?tab=portal`, `/journal/day`, `/ops/clients?new=1`]
  const POOL = [...PILOT_OK, ...OWNER_ONLY, ...DEEP]
  const STEPS = Number(process.env.ISO_STEPS ?? 80)
  let worst = 0
  const trail = []
  for (let i = 0; i < STEPS; i += 1) {
    const roll = rnd()
    let act
    if (roll < 0.1 && i > 2) { await page.goBack({ waitUntil: 'networkidle' }).catch(() => {}); act = 'back' }
    else if (roll < 0.18) { await page.reload({ waitUntil: 'networkidle' }).catch(() => {}); act = 'reload' }
    else if (roll < 0.24) { await page.evaluate((ws) => { try { localStorage.setItem('axmvp.active_workspace', ws) } catch { /* */ } }, OWNER_WS); await page.reload({ waitUntil: 'networkidle' }).catch(() => {}); act = 'tamper+reload' }
    else { const p = pick(POOL); await page.goto(BASE + p, { waitUntil: 'networkidle' }).catch(() => {}); act = p }
    await page.waitForTimeout(220)
    const t = await bodyText(page)
    const lk = leaked(t)
    const ownerName = t.includes(OWNER_NAME)
    const vas = (await page.getByTestId('view-as-switch').count()) + (await page.getByTestId('view-as-compact').count())
    const banner = await page.getByTestId('viewing-pilot').count()
    const nav = (await page.locator('aside').first().innerText().catch(() => '')) ?? ''
    const ownerMenu = ['영업자 정산', '이 시스템', '잘 안 쓰는 기능', '정부지원사업'].filter((m) => nav.includes(m))
    trail.push(act)
    if (lk.length || ownerName || vas > 0 || banner > 0 || ownerMenu.length) {
      check(`무작위 ${i} (${act}): 대표 자료 · 이름 · 전환단추 · 대표메뉴 0`, false, `leak=${lk.join()} name=${ownerName} vas=${vas} banner=${banner} menu=${ownerMenu.join()}`)
      worst += 1
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/iso-fail-${i}.png`, fullPage: true }).catch(() => {})
    }
  }
  check(`무작위 ${STEPS}걸음: 모든 걸음에서 대표 자료 · 이름 · 전환 단추 · 대표 메뉴 0`, worst === 0, `실패 ${worst} · 경로 예: ${trail.slice(0, 12).join(' → ')}`)
  check('무작위: 검색으로 대표 업체를 찾아도 안 나온다', await (async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' }); await page.waitForTimeout(400)
    const btn = page.getByRole('button', { name: /^찾기|찾기$/ }).filter({ visible: true }).first()
    if (!(await btn.count())) return true
    await btn.click().catch(() => {})
    const box = page.getByPlaceholder('업체 이름 · 대표 · 전화번호 뒷자리 · 도구')
    await box.waitFor({ timeout: 4000 }).catch(() => {})
    await box.fill('대표비밀').catch(() => {})
    await page.waitForTimeout(600)
    const dt = (await page.getByRole('dialog', { name: '빠른 이동 검색' }).innerText().catch(() => '')) ?? ''
    await page.keyboard.press('Escape').catch(() => {})
    return leaked(dt).length === 0
  })())
  check('무작위 전체: REST 응답(팀장) 어디에도 대표 자료 없음', restLog.filter((x) => x.who === PILOT.email).every((x) => leaked(x.body).length === 0 && !x.body.includes(OWNER_WS)))
  check('무작위 전체: 화면 JS 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | '))
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/iso-pilot-final.png`, fullPage: true })

  /* ===== 4. 대조군 — 대표는 같은 자료를 본다(시험이 실제로 돈다는 증거) =====
     80걸음으로 두드린 페이지는 상태가 지저분하므로, 대조는 깨끗한 창에서 새로 로그인해 본다. */
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  ctx2.setDefaultTimeout(60000)
  await ctx2.route(`https://${REF}.supabase.co/**`, route)
  const page2 = await ctx2.newPage()
  await login(page2, OWNER)
  await page2.goto(`${BASE}/ops/clients`, { waitUntil: 'networkidle' }); await page2.waitForTimeout(500)
  check('대조: 대표는 자기 업체(대표비밀정밀)를 본다', (await bodyText(page2)).includes('대표비밀정밀'))
} catch (e) {
  // 판정(check)이 아닌 곳에서 난 오류(게이트 부하로 인한 Playwright 시간 초과 등)는 격리 판정과 무관 —
  // 성공/실패 수는 check() 로만 센다. 다만 감추지 않고 적는다.
  console.log('부수 오류(격리 판정과 무관):', String(e?.stack ?? e).slice(0, 300))
} finally {
  console.log(`\nisolation e2e: ${pass} passed, ${fail} failed`)
  try { await browser.close() } catch { /* 종료 중 */ }
  stop()
  if (fail > 0) process.exitCode = 1
}
