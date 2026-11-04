/**
 * qa:restore — D-530 백업 불러오기가 다른 작업공간 업체를 옮기거나 지우지 않는지(SAFE-1 · SAFE-2) — **진짜 RLS** 위에서.
 *
 *   로컬 PostgreSQL(axe2e: e2e-pilot-db.sh — 대표 작업공간 · 팀장 작업공간 · 대표는 0020 으로 팀장 작업공간 편집자) ← PostgREST ← 브라우저
 *   로그인만 흉내 내고 표 읽기 · 쓰기는 PostgREST 를 거쳐 DB 의 RLS · 트리거가 판단한다. 결과는 화면이 아니라 **DB 를 직접 읽어** 본다.
 *
 *   R1 대표 화면 [백업 내려받기] → 3판 파일(작업공간 id 포함)
 *   R2 팀장 화면으로 바꿔 그 파일을 [백업 불러오기] → '다른 작업공간 파일' 한 줄 · 합치기/바꾸기 막힘 → DB: 대표 업체는 대표 작업공간에 그대로
 *      (예전 코드에서는 여기서 [합치기] 를 누르면 대표 업체가 팀장 작업공간으로 옮겨졌다 — 이 시험을 예전 커밋에서 돌리면 R2 가 빨갛게 된다)
 *   R3 작업공간 표시가 없는 예전 파일(같은 업체 id) → 합치기 → 다른 작업공간 업체는 넣지 않음 · DB 그대로
 *   R4 같은 예전 파일로 [전부 바꾸기] → 넣을 업체 0 → 막힘 · 팀장 업체 안 지워짐
 *   R5 대표 화면 같은 작업공간 파일로 [전부 바꾸기] → 지워질 업체 이름을 먼저 보여 줌(DB 그대로) → [정말 바꾸기] → 그때 지움
 *   R6 화면을 거치지 않은 REST 직접 upsert(같은 id · 다른 작업공간) — 0023(SAFE-2)이 있으면 DB 가 막는다
 *
 *   sudo node e2e/restore-guard.mjs      (pg_ctlcluster 16 main start 먼저)
 */
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const REF = 'qarestore'
const PORT = Number(process.env.RESTORE_PORT ?? 4547)
const PGRST_PORT = Number(process.env.PGRST_PORT ?? 4546)
const E2E_DB = process.env.AXE2E_DB ?? 'axe2e'
const BASE = `http://localhost:${PORT}`
const OUT = process.env.RESTORE_OUT ?? 'dist-qa-restore'
const SECRET = 'e2e-local-jwt-secret-at-least-32-characters-long'
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ' — ' + (typeof detail === 'object' ? JSON.stringify(detail) : String(detail)).slice(0, 400)}`)
}

const OWNER = { id: '0e000000-0000-4000-8000-0000000000a1', email: 'owner@e2e.kr', password: 'owner-pass' }
const PILOT = { id: '0e000000-0000-4000-8000-0000000000b1', email: 'pilot@e2e.kr', password: 'pilot-pass' }
const USERS = [OWNER, PILOT]
const OWNER_WS = '0e0000aa-0000-4000-8000-00000000000a'

execSync('bash scripts/db-local/e2e-pilot-db.sh', { stdio: 'ignore', env: { ...process.env, AXE2E_DB: E2E_DB } })
const sql = (q) => execSync(`su postgres -c "psql -At -q -d ${E2E_DB}"`, { input: q }).toString().trim()
const PILOT_WS = sql(`select id from public.workspaces where owner_id = '${PILOT.id}'`)
sql(`insert into public.operations_clients (id, workspace_id, company_name, status, payload) values ('pilot-c1', '${PILOT_WS}', '은혜테스트정밀(주)', 'active', '{}'::jsonb) on conflict (id) do nothing`)
const wsOf = (id) => sql(`select workspace_id from public.operations_clients where id = '${id}'`)
const countIn = (ws) => Number(sql(`select count(*) from public.operations_clients where workspace_id = '${ws}'`))
check('준비: 대표 작업공간 업체 2 · 팀장 작업공간 업체 1 · 대표는 팀장 작업공간 편집자(0020)', countIn(OWNER_WS) === 2 && countIn(PILOT_WS) === 1 && sql(`select role from public.workspace_members where workspace_id = '${PILOT_WS}' and user_id = '${OWNER.id}'`) === 'editor')
const LOCK = sql(`select count(*) from pg_trigger where tgname = 'zz_workspace_id_lock' and tgrelid = 'public.operations_clients'::regclass`) === '1'

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
for (let i = 0; i < 80; i += 1) {
  try {
    const [a, b] = await Promise.all([fetch(BASE), fetch(`http://127.0.0.1:${PGRST_PORT}/`)])
    if (a.ok && b.status < 500) break
  } catch {
    /* 아직 */
  }
  await new Promise((r) => setTimeout(r, 250))
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function jwt(u) {
  const h = b64({ alg: 'HS256', typ: 'JWT' })
  const p = b64({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })
  return `${h}.${p}.${createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`
}
const userObj = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' })
const sessionOf = (u) => ({ access_token: jwt(u), token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: `refresh-${u.id}`, user: userObj(u) })
const whoOf = (auth) => USERS.find((u) => jwt(u) === (auth ?? '').replace(/^Bearer /, '')) ?? null
const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })

async function route(r) {
  const req = r.request()
  const url = new URL(req.url())
  const path = decodeURIComponent(url.pathname)
  const headers = req.headers()
  if (path === '/auth/v1/token') {
    const body = JSON.parse(req.postData() ?? '{}')
    const u = url.searchParams.get('grant_type') === 'refresh_token' ? USERS.find((x) => `refresh-${x.id}` === body.refresh_token) : USERS.find((x) => x.email === body.email && x.password === body.password)
    if (!u) return r.fulfill(json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400))
    return r.fulfill(json(sessionOf(u)))
  }
  if (path === '/auth/v1/user') {
    const u = whoOf(headers['authorization'])
    return r.fulfill(u ? json(userObj(u)) : json({ msg: 'no' }, 401))
  }
  if (path === '/auth/v1/logout') return r.fulfill({ status: 204, body: '' })
  if (path.startsWith('/storage/v1/')) return r.fulfill(json([]))
  if (path.startsWith('/rest/v1/')) {
    const fwd = { ...headers }
    delete fwd['host']
    if (!whoOf(fwd['authorization'])) delete fwd['authorization']
    const res = await r.fetch({ url: `http://127.0.0.1:${PGRST_PORT}${path.slice('/rest/v1'.length)}${url.search}`, headers: fwd })
    return r.fulfill({ status: res.status(), headers: { ...res.headers(), 'access-control-allow-origin': '*' }, body: await res.text() })
  }
  return r.fulfill(json([]))
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } })
const errors = []
const TMP = `${OUT}-files`
mkdirSync(TMP, { recursive: true })
const SHOTS = process.env.RESTORE_SHOTS ?? ''
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

async function go(page, p) {
  await page.goto(BASE + p, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
}
async function viewAs(page, which) {
  await go(page, '/settings')
  const vs = page.locator('[data-testid="settings-view-as"] [data-testid="view-as-switch"]')
  await vs.locator(`[data-view="${which}"]`).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1200)
}
async function openMore(page) {
  await go(page, '/ops/clients')
  await page.getByRole('button', { name: /더보기/ }).filter({ visible: true }).first().click()
  await page.waitForTimeout(300)
}
/** [백업 불러오기] 에 파일을 넣고 창이 뜰 때까지 */
async function openRestore(page, file) {
  await openMore(page)
  const input = page.locator('input[type="file"][accept*="json"]')
  await input.setInputFiles(file)
  await page.getByRole('dialog', { name: '백업 불러오기' }).waitFor({ timeout: 8000 })
}
const dlg = (page) => page.getByRole('dialog', { name: '백업 불러오기' })
const enabled = async (loc) => (await loc.count()) > 0 && (await loc.isEnabled())

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', acceptDownloads: true })
  await ctx.route(`https://${REF}.supabase.co/**`, route)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))

  // 로그인(대표)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByLabel('이메일').fill(OWNER.email)
  await page.getByLabel('비밀번호').fill(OWNER.password)
  await page.getByRole('button', { name: /^로그인/ }).click()
  await page.waitForURL((x) => !x.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(900)
  await viewAs(page, 'owner')

  /* R1 대표 화면에서 백업 내려받기 */
  await openMore(page)
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByTestId('clients-export').click()])
  const ownerFile = `${TMP}/owner-backup.json`
  await dl.saveAs(ownerFile)
  const file = JSON.parse(readFileSync(ownerFile, 'utf8'))
  check('R1 대표 [백업 내려받기] → 3판 · 대표 작업공간 id · 대표 업체 2곳', file.version === 3 && file.workspace?.workspaceId === OWNER_WS && file.clients?.length === 2, { v: file.version, ws: file.workspace?.workspaceId, n: file.clients?.length })
  await page.keyboard.press('Escape').catch(() => {})

  /* R2 팀장 화면에서 대표 파일 불러오기 */
  await viewAs(page, 'pilot')
  await openRestore(page, ownerFile)
  const src = page.getByTestId('restore-source')
  const srcKind = (await src.getAttribute('data-source').catch(() => null)) ?? ''
  const mergeOn = await enabled(dlg(page).getByRole('button', { name: '지금 데이터와 합치기' }))
  const replaceOn = await enabled(dlg(page).getByRole('button', { name: '백업 내용으로 전부 바꾸기' }))
  await shot(page, 'restore-other-workspace')
  check('R2 팀장 화면에 대표 파일 → "다른 작업공간 파일" 한 줄 · 합치기 · 바꾸기 둘 다 막힘', srcKind === 'other-mine' && !mergeOn && !replaceOn, { srcKind, mergeOn, replaceOn })
  // 예전 코드처럼 단추가 살아 있으면 눌러 본다 — 그때 DB 에서 무슨 일이 생기는지가 '수정 전' 의 재현이다
  if (mergeOn) {
    await dlg(page).getByRole('button', { name: '지금 데이터와 합치기' }).click()
    await page.waitForTimeout(2500)
  }
  check('R2 DB: 대표 업체 2곳은 대표 작업공간에 그대로 · 팀장 작업공간은 1곳 그대로', wsOf('owner-secret-1') === OWNER_WS && wsOf('owner-secret-2') === OWNER_WS && countIn(PILOT_WS) === 1 && countIn(OWNER_WS) === 2, { s1: wsOf('owner-secret-1'), s2: wsOf('owner-secret-2'), pilot: countIn(PILOT_WS), owner: countIn(OWNER_WS) })
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(300)

  /* R3 작업공간 표시가 없는 예전 파일(같은 업체 id) → 합치기 */
  const legacy = { format: 'ax-client-ops', version: 2, exportedAt: file.exportedAt, count: 2, clients: file.clients.map((c) => ({ ...c, workspaceId: null })), toolInputs: {} }
  const legacyFile = `${TMP}/legacy-backup.json`
  writeFileSync(legacyFile, JSON.stringify(legacy))
  await openRestore(page, legacyFile)
  const legacyKind = (await page.getByTestId('restore-source').count()) ? await page.getByTestId('restore-source').getAttribute('data-source') : 'none'
  await dlg(page).getByRole('button', { name: '지금 데이터와 합치기' }).click()
  await page.waitForTimeout(2500)
  const body3 = await page.locator('body').innerText()
  check('R3 예전 파일 합치기 → 출처 모름(줄 없음) · "다른 작업공간에 있는 업체 2곳은 넣지 않았어요"', legacyKind === 'none' && /다른 작업공간에 있는 업체 2곳은 넣지 않았어요/.test(body3), { legacyKind, toast: body3.match(/복원했습니다[^\n]*/)?.[0] })
  check('R3 DB: 대표 업체는 대표 작업공간 그대로 · 팀장 작업공간 1곳 그대로', wsOf('owner-secret-1') === OWNER_WS && wsOf('owner-secret-2') === OWNER_WS && countIn(PILOT_WS) === 1)

  /* R4 같은 예전 파일 → 전부 바꾸기 → 넣을 업체 0 → 막힘 */
  await openRestore(page, legacyFile)
  await dlg(page).getByRole('button', { name: '백업 내용으로 전부 바꾸기' }).click()
  await page.waitForTimeout(1500)
  const note4 = (await page.getByTestId('restore-note').innerText().catch(() => '')) ?? ''
  check('R4 예전 파일 전부 바꾸기 → "넣을 수 있는 업체가 없어요" · 지울 확인 창 없음', /넣을 수 있는 업체가 없어요/.test(note4) && (await page.getByTestId('restore-removed').count()) === 0, note4)
  check('R4 DB: 팀장 업체(은혜테스트정밀) 안 지워짐 · 대표 업체 그대로', wsOf('pilot-c1') === PILOT_WS && countIn(PILOT_WS) === 1 && countIn(OWNER_WS) === 2)
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(300)

  /* R5 대표 화면 · 같은 작업공간 파일에서 한 곳을 뺀 것 → 전부 바꾸기 → 지워질 업체를 먼저 보여 줌 → 정말 바꾸기 */
  await viewAs(page, 'owner')
  const oneLess = { ...file, count: 1, clients: file.clients.filter((c) => c.id === 'owner-secret-1') }
  const oneLessFile = `${TMP}/owner-one-less.json`
  writeFileSync(oneLessFile, JSON.stringify(oneLess))
  await openRestore(page, oneLessFile)
  check('R5 같은 작업공간 파일 → 출처 줄 없음 · 두 단추 살아 있음', (await page.getByTestId('restore-source').count()) === 0 && (await enabled(dlg(page).getByRole('button', { name: '백업 내용으로 전부 바꾸기' }))))
  await dlg(page).getByRole('button', { name: '백업 내용으로 전부 바꾸기' }).click()
  await page.getByTestId('restore-removed').waitFor({ timeout: 8000 }).catch(() => {})
  const removedText = (await page.getByTestId('restore-removed').innerText().catch(() => '')) ?? ''
  await shot(page, 'restore-replace-confirm')
  check('R5 첫 누름: "1곳이 지워져요 · 대표비밀상사" 를 먼저 보여 줌 · DB 는 아직 그대로', /1곳이 지워져요/.test(removedText) && removedText.includes('대표비밀상사') && countIn(OWNER_WS) === 2, removedText)
  await page.getByTestId('restore-replace-confirm').click()
  await page.waitForTimeout(2500)
  check('R5 [정말 바꾸기] → 그때 지움(대표 작업공간 1곳) · 팀장 작업공간은 그대로', countIn(OWNER_WS) === 1 && wsOf('owner-secret-1') === OWNER_WS && countIn(PILOT_WS) === 1, { owner: countIn(OWNER_WS), pilot: countIn(PILOT_WS) })

  /* R6 화면을 거치지 않은 REST 직접 upsert — 같은 id 를 다른 작업공간으로 */
  const res = await fetch(`http://127.0.0.1:${PGRST_PORT}/operations_clients`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt(OWNER)}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ id: 'owner-secret-1', workspace_id: PILOT_WS, company_name: '대표비밀정밀(주)', status: 'active', payload: {} }]),
  })
  const moved = wsOf('owner-secret-1') === PILOT_WS
  if (LOCK) check('R6 (0023 있음) REST 직접 upsert 로 다른 작업공간에 옮기기 → DB 가 막음 · 대표 작업공간 그대로', !res.ok && !moved, { status: res.status, now: wsOf('owner-secret-1') })
  else console.log(`INFO  R6 (0023 없음) REST 직접 upsert → ${res.status} · ${moved ? '옮겨짐 — DB 장치(0023)가 필요한 이유' : '옮겨지지 않음'}`)

  check('JS 오류 0', errors.length === 0, errors.slice(0, 3))
} catch (e) {
  check('실행 중 오류 없음', false, String(e).slice(0, 400))
} finally {
  await browser.close()
  stop()
}
console.log(`\nqa:restore: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
