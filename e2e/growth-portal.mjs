/**
 * qa:growthportal — D-681 고객성장관리 P0 통합(진짜 RLS · 두 앱).
 *
 *   로컬 PostgreSQL(마이그레이션 전부 + 0033) ← PostgREST ← 내부 OS(대표) · 홈페이지 My MIRAE(고객) 두 화면.
 *   로그인 · 프로필 응답만 흉내 내고, 보고서 · 열람 · 확인 · 문의는 모두 서버 함수가 판단한다.
 *
 *   W1 고객 A1 첫 방문 — 성장 홈(프로젝트 카드) · 첫 방문 기록(서버)
 *   W2 대표 — 고객 플랫폼 탭 '사용 중'(A1 방문 반영) · 오늘 '고객 화면 챙길 것'(A2 첫 방문 없음 3일+)
 *   W3 대표 — 보고서 초안 → 내부 글 꺼짐 → 발행(서버에 내부 글 · 수수료 0) · 미리보기는 기록 0
 *   W4 고객 A1 — 홈 '지금 할 일' 에 새 보고서 · 최근 보고서 · 카드 '새 보고서 1' → 보고서 끝 1초 → 열어 봄(서버) · [확인했어요](서버) · 문의 → 내 요청(서버)
 *   W5 고객 A2(같은 회사 다른 계정) — 같은 보고서를 보지만 기록은 따로(A1 확인이 A2 에 안 보임)
 *   W6 고객 B(다른 회사) — 주소를 알아도 못 봄 · REST 로 A 의 연결 · 보고서 직접 불러도 막힘 · 표 직접 읽기 0
 *   W7 대표 — 고객 플랫폼 탭 'A1 열어 봄 · 확인' · 'A2 아직 안 봄' · 문의가 내부 요청함에
 *   W8 정정 — 대표 2판 → 고객 예전 주소는 '새 판 있음' → 새 판(확인은 새로) · 상세 '보고서' 탭
 *   W9 내리기 — 고객 주소 '내렸어요' · 홈 최근 보고서에서 빠짐 · 기록은 DB 에 남음
 *   W10 연결 멈춤 — 그 계정은 그 순간부터 프로젝트 · 보고서 0(서버) → 다시 켜면 돌아옴
 *   W11 되돌리기(rollback_0033) — 홈페이지 · OS 모두 예전 화면 그대로(보고서 칸만 숨음) → 0033 다시 → 돌아옴
 *   W12 390 — 홈 · 보고서 화면 넘침 0 · 단추 44px
 *   W14 (D-682) 월간 보고 발행 → 고객 홈 같은 이름 · 이번 달 보고를 낸 업체는 월말 보고 줄 0 · W2d 월말 7일 안이면 계약 고객마다 '이번 달 보고' 줄
 *   W15 (D-683) 대표 설정 [고객 화면] → 고르기 · 계정마다 대표가 보는 최근 보고서 = 고객 실제 화면 · 보고서 단추 안 눌림 · 기록 0 · 잠재고객 연결 전 화면 · 팀장은 막힘
 *   W16 (D-684) 계약 끝나는 날 20일 전 · 연간 보고 없음 → 오늘 '재계약 전 연간 보고' 줄(월말 줄 대신) · [열기] → 보고서 창 연간 · 계약일부터 · 안부 '재계약' 줄
 *   W17 (D-685) 공유 서류 · 결과 글 — 10일 전 공유(기록 전 공유 하나는 안 셈) → 오늘 '공유한 결과 자료 2개를 안 열어 보셨어요' → 고객 '결과' 탭 1초 → 결과 글 열람 · [열기] → 서류 열람(서버) →
 *       OS 탭 '열어 보심' · '열람 기록 전 공유' · 오늘 줄 빠짐 · 대표 · 다른 회사 고객은 기록 못 남김 · 0034 되돌리기 → 줄 숨음 · 고객 화면 그대로 → 다시
 *   W18 (D-686) 새로 공유한 서류 → 고객 홈 '지금 할 일' 새 결과 자료 1개 · 카드 · 대표 고객 화면 보기도 같게(계정마다 · 기록 0) → 결과 탭 '새 1' · 알약 → [열기] → 사라짐 → 홈에서도 빠짐 · 0035 되돌리기 → 표시만 숨음 → 다시
 *   W18h (D-688) 같은 말 — 새 자료가 있으면 카드 · 프로젝트 맨 위가 '확인할 일 없음' 대신 '새로 온 자료' · 대표 고객 화면 보기도 같게
 *   W13 JS 오류 0(두 앱)
 *
 *   node e2e/growth-portal.mjs [스크린샷 폴더]   (pg_ctlcluster 16 main start 먼저 · 홈페이지 저장소 ../mirae-ai-lab-homepage)
 */
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const SHOTS = process.argv[2] ?? ''
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const REF = 'qagrowth'
const DB = process.env.AXGROWTH_DB ?? 'axgrowth'
const PGRST_PORT = 4556
const OS_PORT = 4557
const HP_PORT = 4558
const OS = `http://localhost:${OS_PORT}`
const HP = `http://localhost:${HP_PORT}`
const HP_DIR = path.resolve(process.env.HOMEPAGE_DIR ?? '../mirae-ai-lab-homepage')
const OS_OUT = 'dist-qa-growth'
const HP_OUT = path.resolve(process.env.HP_OUT ?? path.join(os.tmpdir(), 'hp-dist-growth'))
const SECRET = 'e2e-local-jwt-secret-at-least-32-characters-long'
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ' — ' + (typeof detail === 'object' ? JSON.stringify(detail) : String(detail)).slice(0, 500)}`)
}

const OWNER = { id: '0e000000-0000-4000-8000-0000000000a1', email: 'owner@e2e.kr', password: 'owner-pass' }
const CA1 = { id: '0e000000-0000-4000-8000-00000000a0a1', email: 'ceo@hanbit.kr', password: 'a1' }
const CA2 = { id: '0e000000-0000-4000-8000-00000000a0a2', email: 'staff@hanbit.kr', password: 'a2' }
const CB1 = { id: '0e000000-0000-4000-8000-00000000b0b1', email: 'ceo@bada.kr', password: 'b1' }
// D-683 내부 팀장(0019 pilot_provision 그대로) — 고객 화면 보기가 막히는지
const PILOT = { id: '0e000000-0000-4000-8000-0000000000b1', email: 'pilot@e2e.kr', password: 'pilot-pass' }
const USERS = [OWNER, CA1, CA2, CB1, PILOT]
const OWNER_WS = '0e0000aa-0000-4000-8000-00000000000a'
const SECRETS = ['채무', '수수료', '300만원']

// ---------- DB ----------
execSync('bash scripts/db-local/e2e-pilot-db.sh', { stdio: 'ignore', env: { ...process.env, AXE2E_DB: DB } })
const sql = (q) => execSync(`su postgres -c "psql -At -q -v ON_ERROR_STOP=1 -d ${DB}"`, { input: q }).toString().trim()
const year = new Date().getFullYear()
sql(`
insert into auth.users (id, email) values ('${CA1.id}', '${CA1.email}'), ('${CA2.id}', '${CA2.email}'), ('${CB1.id}', '${CB1.email}') on conflict do nothing;
insert into public.profiles (id, email, display_name) values ('${CA1.id}', '${CA1.email}', '한빛 대표'), ('${CA2.id}', '${CA2.email}', '한빛 직원'), ('${CB1.id}', '${CB1.email}', '바다 대표') on conflict (id) do nothing;
insert into public.operations_clients (id, workspace_id, company_name, status, payload, created_at, updated_at) values
  ('growth-a', '${OWNER_WS}', '한빛정밀(주)', 'active', jsonb_build_object(
     'representativeName', '이한빛', 'contactEmail', '${CA1.email}', 'notes', '수수료 300만원 협의(내부)',
     'services', jsonb_build_object(
       'incorporation', jsonb_build_object('status', 'done', 'completedAt', '${year}-02-10T03:00:00Z'),
       'venture', jsonb_build_object('status', 'in_progress', 'nextStep', '대표 개인 채무 확인 뒤 진행(내부)'),
       'patent', jsonb_build_object('status', 'waiting_client'))), '${year}-01-05', now()),
  ('growth-b', '${OWNER_WS}', '바다상사', 'active', '{}'::jsonb, '${year}-01-06', now()),
  ('growth-c', '${OWNER_WS}', '새봄식품', 'waiting', '{}'::jsonb, '${year}-02-01', now());
select set_config('request.jwt.claim.sub', '${OWNER.id}', false);
set role authenticated;
insert into public.portal_client_links (workspace_id, operations_client_id, profile_id, consultant_name) values
  ('${OWNER_WS}', 'growth-a', '${CA1.id}', '김상호'),
  ('${OWNER_WS}', 'growth-a', '${CA2.id}', '김상호'),
  ('${OWNER_WS}', 'growth-b', '${CB1.id}', '김상호');
reset role;
update public.portal_client_links set linked_at = now() - interval '4 days' where profile_id = '${CA2.id}';
`)
const linkOf = (u) => sql(`select id from public.portal_client_links where profile_id = '${u.id}'`)
const LA1 = linkOf(CA1)
const LA2 = linkOf(CA2)
const LB1 = linkOf(CB1)
check('준비: 0033 들어감 · 연결 셋(A 두 계정 · B 한 계정)', sql(`select count(*) from pg_proc where proname = 'portal_publish_report'`) === '1' && [LA1, LA2, LB1].every((x) => x.length === 36), { LA1, LA2, LB1 })

// ---------- PostgREST · 두 앱 ----------
let PGRST = process.env.POSTGREST_BIN ?? '.cache/postgrest/postgrest'
if (!existsSync(PGRST)) {
  mkdirSync('.cache/postgrest', { recursive: true })
  execSync('curl -sSL -o .cache/postgrest/p.tar.xz https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz && tar xf .cache/postgrest/p.tar.xz -C .cache/postgrest')
  PGRST = '.cache/postgrest/postgrest'
}
const pgrst = spawn(PGRST, [], {
  stdio: 'ignore',
  detached: true,
  env: { ...process.env, PGRST_DB_URI: `postgres://authenticator:e2e-local@127.0.0.1:5432/${DB}`, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: SECRET, PGRST_SERVER_PORT: String(PGRST_PORT), PGRST_DB_POOL: '5' },
})
const supaEnv = { VITE_SUPABASE_URL: `https://${REF}.supabase.co`, VITE_SUPABASE_ANON_KEY: 'qa-anon' }
execSync(`npx vite build --outDir ${OS_OUT} --emptyOutDir`, { stdio: 'ignore', env: { ...process.env, ...supaEnv, VITE_DATA_MODE: 'supabase' } })
execSync(`npx vite build --outDir ${HP_OUT} --emptyOutDir`, { stdio: 'ignore', cwd: HP_DIR, env: { ...process.env, ...supaEnv } })
const osServer = spawn('npx', ['vite', 'preview', '--outDir', OS_OUT, '--port', String(OS_PORT), '--strictPort'], { stdio: 'ignore', detached: true })
const hpServer = spawn('npx', ['vite', 'preview', '--outDir', HP_OUT, '--port', String(HP_PORT), '--strictPort'], { stdio: 'ignore', detached: true, cwd: HP_DIR })
const stop = () => {
  for (const p of [osServer, hpServer, pgrst]) {
    try {
      process.kill(-p.pid)
    } catch {
      /* 이미 꺼짐 */
    }
  }
}
for (let i = 0; i < 80; i += 1) {
  try {
    const [a, b, c] = await Promise.all([fetch(OS), fetch(HP), fetch(`http://127.0.0.1:${PGRST_PORT}/`)])
    if (a.ok && b.ok && c.status < 500) break
  } catch {
    /* 아직 */
  }
  await new Promise((r) => setTimeout(r, 250))
}

// ---------- 로그인 흉내(서명한 JWT 는 PostgREST 가 검증) ----------
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

function makeRoute(app) {
  return async (r) => {
    const req = r.request()
    const url = new URL(req.url())
    const p = decodeURIComponent(url.pathname)
    const headers = req.headers()
    if (p === '/auth/v1/token') {
      const body = JSON.parse(req.postData() ?? '{}')
      const u = url.searchParams.get('grant_type') === 'refresh_token' ? USERS.find((x) => `refresh-${x.id}` === body.refresh_token) : USERS.find((x) => x.email === body.email && x.password === body.password)
      return u ? r.fulfill(json(sessionOf(u))) : r.fulfill(json({ error: 'invalid_grant' }, 400))
    }
    if (p === '/auth/v1/user') {
      const u = whoOf(headers['authorization'])
      return u ? r.fulfill(json(userObj(u))) : r.fulfill(json({ msg: 'no' }, 401))
    }
    if (p === '/auth/v1/logout') return r.fulfill({ status: 204, body: '' })
    // D-685 서명 주소(공유 서류 [열기]) — 파일 대신 빈 응답. 그 밖의 저장소 요청은 예전처럼 빈 목록
    if (p.startsWith('/storage/v1/object/sign/') && req.method() === 'POST') return r.fulfill(json({ signedURL: `${p.slice('/storage/v1'.length)}?token=e2e` }))
    if (p.startsWith('/storage/v1/')) return r.fulfill(json([]))
    // 홈페이지 회원 프로필 · 역할은 홈페이지 쪽 표(이 시험 DB 밖) — 가입을 마친 회원으로
    if (app === 'hp' && p === '/rest/v1/profiles') {
      const u = whoOf(headers['authorization'])
      return r.fulfill(json(u ? { id: u.id, email: u.email, display_name: u.email, onboarding_status: 'completed', member_type: 'ceo' } : null))
    }
    if (app === 'hp' && p === '/rest/v1/user_roles') return r.fulfill(json([]))
    if (p.startsWith('/rest/v1/')) {
      const fwd = { ...headers }
      delete fwd['host']
      if (!whoOf(fwd['authorization'])) delete fwd['authorization']
      const res = await r.fetch({ url: `http://127.0.0.1:${PGRST_PORT}${p.slice('/rest/v1'.length)}${url.search}`, headers: fwd })
      return r.fulfill({ status: res.status(), headers: { ...res.headers(), 'access-control-allow-origin': '*' }, body: await res.text() })
    }
    return r.fulfill(json([]))
  }
}
const rest = async (u, fn, body) => {
  const res = await fetch(`http://127.0.0.1:${PGRST_PORT}/rpc/${fn}`, { method: 'POST', headers: { authorization: `Bearer ${jwt(u)}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { status: res.status, body: await res.text() }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } })
const errors = []
const shot = async (page, name, full = false) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full })
}
async function hpContext(u, viewport = { width: 1440, height: 900 }, extra = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', ...extra })
  await ctx.route(`https://${REF}.supabase.co/**`, makeRoute('hp'))
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${REF}-auth-token`, JSON.stringify(sessionOf(u))])
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`hp:${u.email}: ${String(e)}`))
  return { ctx, page }
}
const hpGo = async (page, p) => {
  await page.goto(HP + p, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
}
const osGo = async (page, p) => {
  await page.goto(OS + p, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
}
const receipts = (who, kind = 'report') => sql(`select count(*) from public.portal_receipts where profile_id = '${who.id}' and item_kind = '${kind}'`)
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

try {
  // ---------- W1 고객 A1 첫 방문 ----------
  const a1 = await hpContext(CA1)
  await hpGo(a1.page, '/my-projects')
  const home = a1.page.getByTestId('growth-home')
  await home.waitFor({ timeout: 15000 })
  await a1.page.getByTestId('project-card').first().waitFor({ timeout: 10000 })
  check('W1a 고객 A1 — 성장 홈 · 프로젝트 카드 하나(한빛정밀)', (await a1.page.getByTestId('project-card').count()) === 1 && ((await a1.page.getByTestId('project-card').innerText()) ?? '').includes('한빛정밀'))
  await a1.page.waitForTimeout(500)
  check('W1b 첫 방문 기록(서버) — A1 만 · A2 · B 는 0', receipts(CA1, 'home') === '1' && receipts(CA2, 'home') === '0' && receipts(CB1, 'home') === '0')
  check('W1c 보고서 칸 켜짐 · 아직 보고서 0(최근 보고서 칸 없음)', (await home.getAttribute('data-growth')) === 'on' && (await a1.page.getByTestId('growth-recent').count()) === 0)

  // ---------- W2 대표 OS ----------
  const oc = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'] })
  await oc.route(`https://${REF}.supabase.co/**`, makeRoute('os'))
  const op = await oc.newPage()
  op.on('pageerror', (e) => errors.push(`os: ${String(e)}`))
  await op.goto(`${OS}/login`, { waitUntil: 'networkidle' })
  await op.getByLabel('이메일').fill(OWNER.email)
  await op.getByLabel('비밀번호').fill(OWNER.password)
  await op.getByRole('button', { name: /^로그인/ }).click()
  await op.waitForURL((x) => !x.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {})
  await op.waitForLoadState('networkidle')
  await osGo(op, '/')
  const chip = op.getByTestId('today-portal-open')
  await chip.waitFor({ timeout: 10000 }).catch(() => {})
  check("W2a 오늘 — '고객 화면 챙길 것' 칩(A2 연결 4일 · 첫 방문 없음)", (await chip.count()) === 1 && Number(await chip.getAttribute('data-count')) >= 1, await chip.count())
  if (await chip.count()) {
    await chip.click()
    const rows = op.getByTestId('today-portal-row')
    await rows.first().waitFor({ timeout: 5000 }).catch(() => {})
    const rules = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-rule')))
    // D-682 월말 7일 전부터는 계약 고객마다 '이번 달 보고' 줄도 뜬다(이 시험 날짜에 따라) — 첫 방문 없음은 늘 한빛정밀 하나
    const rowTexts = await rows.allInnerTexts()
    const kstDay = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
    const monthEnd = new Date(Date.UTC(Number(kstDay.slice(0, 4)), Number(kstDay.slice(5, 7)), 0)).toISOString().slice(0, 10)
    const inWindow = (Date.parse(monthEnd) - Date.parse(kstDay)) / 86400000 < 7
    const firstVisit = rules.filter((r) => r === 'first_visit').length
    const monthly = rules.filter((r) => r === 'monthly_review').length
    check('W2b 판 — 첫 방문 없음은 한빛정밀 한 줄 · 그 밖은 월말 보고 줄만', firstVisit === 1 && rowTexts.some((t) => t.includes('한빛정밀') && t.includes('안 오셨어요')) && rules.every((r) => r === 'first_visit' || r === 'monthly_review'), rules)
    check(`W2d 월말 보고 줄 — ${inWindow ? '월말 7일 안: 계약 고객 둘(보고 0) 모두' : '월말 7일 밖: 0'}`, inWindow ? monthly === 2 && rowTexts.some((t) => t.includes('바다상사') && t.includes('보고를 아직')) : monthly === 0, { rules, kstDay })
    await op.waitForTimeout(500) // 판이 다 열린 뒤에 찍는다(열리는 중간이면 반투명)
    await shot(op, 'os-01-today-portal')
    await op.keyboard.press('Escape')
  }
  await osGo(op, '/ops/clients/growth-a?tab=portal')
  const usage = op.getByTestId('portal-usage')
  await usage.waitFor({ timeout: 15000 })
  check("W2c 고객 플랫폼 탭 — '사용 중 · 최근 방문'(A1 방문이 서버에서 옴)", (await usage.getAttribute('data-state')) === 'active' && ((await usage.innerText()) ?? '').includes('최근 방문'), await usage.innerText())

  // ---------- W3 발행 ----------
  await op.getByTestId('report-create').click()
  await op.locator('[data-testid="report-period"][data-period="year"]').click()
  await op.getByTestId('report-make-draft').click()
  await op.waitForFunction(() => document.querySelector('[data-testid="report-sheet"]')?.getAttribute('data-step') === 'edit')
  const internalOn = await op.locator('[data-testid="report-line"][data-internal="1"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-on')))
  check('W3a 초안 — 직원이 적은 다음 단계(채무)는 꺼진 내부 글', internalOn.length >= 1 && internalOn.every((x) => x === '0'), internalOn)
  await op.getByTestId('report-staff-note').fill('이번 달도 수고 많으셨습니다. 서류만 챙겨 주시면 됩니다.')
  await op.getByTestId('report-publish').click()
  await op.getByTestId('report-publish-go').click()
  await op.getByTestId('report-done').waitFor({ timeout: 15000 })
  const R1 = sql(`select id from public.portal_reports where operations_client_id = 'growth-a' and version = 1`)
  const r1 = sql(`select sections::text || '|' || coalesce(staff_note, '') || '|' || jsonb_array_length(source_refs) from public.portal_reports where id = '${R1}'`)
  check('W3b 서버에 한 편 · 내부 글 · 수수료 0 · 출처 남음', R1.length === 36 && !SECRETS.some((s) => r1.includes(s)) && Number(r1.split('|').pop()) > 0, r1.slice(0, 300))
  const notice = await op.getByTestId('report-notice-text').inputValue()
  check('W3c 안내 문구 = 그 보고서 주소', notice.includes(`/my-projects/reports/${R1}`), notice)
  await op.getByTestId('report-done-close').click()
  await op.getByTestId('report-row').first().waitFor()
  await op.getByTestId('report-row').first().getByTestId('report-preview-open').click()
  await op.getByTestId('report-view').waitFor()
  check('W3d 대표 미리보기 — 고객 모양 · 열람 기록 0(서버)', ((await op.getByTestId('report-view').innerText()) ?? '').includes('담당자 한마디') && sql(`select count(*) from public.portal_receipts where item_kind = 'report'`) === '0')
  await op.keyboard.press('Escape')

  // ---------- W4 고객 A1 ----------
  await hpGo(a1.page, '/my-projects')
  await a1.page.getByTestId('growth-recent').waitFor({ timeout: 10000 })
  const todoTexts = await a1.page.getByTestId('growth-todo-item').allInnerTexts()
  check("W4a 홈 '지금 할 일' 맨 위 = 새 보고서 · 3개 이하", todoTexts.length >= 1 && todoTexts.length <= 3 && todoTexts[0].includes('새 보고서'), todoTexts)
  check("W4b 최근 보고서 '새 보고서' · 카드 '보고서 1 · 새 보고서 1'", (await a1.page.getByTestId('growth-recent-item').first().getAttribute('data-state')) === 'new' && ((await a1.page.getByTestId('project-reports-count').innerText()) ?? '').includes('새 보고서 1'))
  await shot(a1.page, 'hp-01-home', true)
  check('W4c 홈만 열어서는 열람 기록 0', receipts(CA1) === '0')
  await a1.page.getByTestId('growth-recent-item').first().click()
  const rp = a1.page.getByTestId('report-page')
  await rp.waitFor({ timeout: 10000 })
  const body = (await a1.page.getByTestId('report-body').innerText()) ?? ''
  check('W4d 보고서 — 고객 모양 · 내부 글 · 수수료 0 · 확인 ≠ 검수 안내', (await rp.getAttribute('data-state')) === 'published' && body.includes('지금 진행 중') && body.includes('담당자 한마디') && !SECRETS.some((s) => body.includes(s)) && ((await a1.page.getByTestId('report-ack-note').innerText()) ?? '').includes('계약 검수'), body.slice(0, 200))
  await a1.page.getByTestId('report-end').scrollIntoViewIfNeeded()
  await a1.page.waitForTimeout(1800)
  check('W4e 보고서 끝 1초 → 열어 봄(서버 · A1 한 줄)', receipts(CA1) === '1' && sql(`select count(*) from public.portal_receipts where item_kind = 'report' and acknowledged_at is not null`) === '0')
  await a1.page.getByTestId('report-ack').click()
  await a1.page.waitForFunction(() => document.querySelector('[data-testid="report-ack"]')?.getAttribute('data-acked') === '1', null, { timeout: 8000 }).catch(() => {})
  check('W4f [확인했어요] → 확인함(서버 시각 남음)', (await a1.page.getByTestId('report-ack').getAttribute('data-acked')) === '1' && sql(`select count(*) from public.portal_receipts where profile_id = '${CA1.id}' and acknowledged_at is not null`) === '1')
  await a1.page.getByTestId('report-ack').click({ force: true }).catch(() => {})
  check('W4g 다시 눌러도 한 줄 · 처음 확인 시각 그대로', receipts(CA1) === '1')
  await shot(a1.page, 'hp-02-report-acked', true)
  await a1.page.getByTestId('report-ask-open').click()
  await a1.page.getByTestId('report-ask-text').fill('다음 계획의 마감일을 조금 미룰 수 있을까요?')
  await a1.page.getByTestId('report-ask-send').click()
  await a1.page.getByTestId('report-ask-done').waitFor({ timeout: 8000 })
  check("W4h [이 보고서 문의] → 내 요청(서버 · '보고서 문의 · 제목')", sql(`select count(*) from public.portal_requests where portal_client_link_id = '${LA1}' and title like '보고서 문의 · %'`) === '1')

  // ---------- W5 같은 회사 다른 계정 ----------
  const a2 = await hpContext(CA2)
  await hpGo(a2.page, `/my-projects/reports/${R1}`)
  await a2.page.getByTestId('report-page').waitFor({ timeout: 10000 })
  check('W5 A2 — 같은 보고서를 봄 · A1 의 확인은 안 보임(따로 기록)', (await a2.page.getByTestId('report-page').getAttribute('data-state')) === 'published' && (await a2.page.getByTestId('report-ack').getAttribute('data-acked')) === '0')

  // ---------- W6 다른 회사 ----------
  const b1 = await hpContext(CB1)
  await hpGo(b1.page, `/my-projects/reports/${R1}`)
  await b1.page.getByTestId('report-page').waitFor({ timeout: 10000 })
  const bText = (await b1.page.locator('body').innerText()) ?? ''
  check('W6a B — 주소를 알아도 못 봄 · 회사 이름 · 제목 0', (await b1.page.getByTestId('report-page').getAttribute('data-state')) === 'missing' && !bText.includes('한빛') && !bText.includes('경과 보고 ('))
  const forged = await Promise.all([
    rest(CB1, 'portal_report', { p_link_id: LA1, p_report_id: R1 }),
    rest(CB1, 'portal_report', { p_link_id: LB1, p_report_id: R1 }),
    rest(CB1, 'portal_mark_report_seen', { p_link_id: LB1, p_report_id: R1 }),
    rest(CB1, 'portal_acknowledge_report', { p_link_id: LA1, p_report_id: R1 }),
  ])
  check('W6b B 가 REST 로 A 연결 · 보고서 직접 불러도 모두 막힘 · 기록 0', forged.every((x) => x.status >= 400 && !x.body.includes('한빛')) && receipts(CB1) === '0', forged.map((x) => x.status))
  const direct = await fetch(`http://127.0.0.1:${PGRST_PORT}/portal_reports?select=id,title`, { headers: { authorization: `Bearer ${jwt(CB1)}` } })
  const directBody = await direct.text()
  check('W6c 고객은 보고서 표를 직접 못 읽음(0줄)', direct.status === 200 && directBody === '[]', `${direct.status} ${directBody.slice(0, 80)}`)

  // ---------- W7 대표 표시 ----------
  await osGo(op, '/ops/clients/growth-a?tab=portal')
  await op.getByTestId('report-row').first().waitFor({ timeout: 10000 })
  const seen = await op.getByTestId('report-seen').evaluateAll((els) => els.map((e) => ({ t: e.textContent, s: e.getAttribute('data-seen'), a: e.getAttribute('data-ack') })))
  const sA1 = seen.find((x) => x.t.includes(CA1.email))
  const sA2 = seen.find((x) => x.t.includes(CA2.email))
  // A2 는 W5 에서 보고서를 끝까지 띄워 두었다(1초 넘게) → 열어 봄 · 확인은 A1 만
  check("W7a 대표 — 계정 이메일로 한 줄씩 · A1 '열어 봄 · 확인' · A2 '열어 봄 · 확인 전'", sA1?.s === '1' && sA1?.a === '1' && sA2?.s === '1' && sA2?.a === '0' && (sA2?.t ?? '').includes('확인 전'), seen)
  const accRows = await op.getByTestId('portal-account').evaluateAll((els) => els.map((e) => [e.getAttribute('data-email'), e.getAttribute('data-status')]))
  check('W7c 연결 계정 두 줄 — 이메일 · 연결됨(직원은 고객 프로필 표를 못 읽어도 서버 함수로)', accRows.length === 2 && accRows.every(([e, st]) => [CA1.email, CA2.email].includes(e) && st === 'active'), accRows)
  const reqText = (await op.locator('body').innerText()) ?? ''
  check('W7b 고객 문의가 이 탭의 고객 요청에', reqText.includes('보고서 문의 ·'))
  await shot(op, 'os-02-portal-seen', true)

  // ---------- W8 정정 ----------
  await op.getByTestId('report-row').first().getByTestId('report-correct').click()
  await op.getByTestId('report-correction').fill('끝낸 일 날짜를 바로잡았습니다')
  await op.getByTestId('report-publish').click()
  await op.getByTestId('report-publish-go').click()
  await op.getByTestId('report-done').waitFor({ timeout: 15000 })
  await op.getByTestId('report-done-close').click()
  const R2 = sql(`select id from public.portal_reports where operations_client_id = 'growth-a' and version = 2`)
  check('W8a 2판 발행 · 1판은 정정됨(서버 · 지우지 않음)', R2.length === 36 && sql(`select status from public.portal_reports where id = '${R1}'`) === 'superseded')
  await hpGo(a1.page, `/my-projects/reports/${R1}`)
  await a1.page.getByTestId('report-page').waitFor()
  check("W8b 고객 예전 주소 — '새 판 있음' · 본문 0", (await a1.page.getByTestId('report-page').getAttribute('data-state')) === 'superseded' && (await a1.page.getByTestId('report-body').count()) === 0)
  await shot(a1.page, 'hp-03-superseded')
  await a1.page.getByTestId('report-latest-link').click()
  await a1.page.waitForFunction(() => document.querySelector('[data-testid="report-page"]')?.getAttribute('data-state') === 'published', null, { timeout: 10000 })
  check('W8c [새 판 보기] → 2판 · 고친 곳 한 줄 · 확인은 새로(아직 안 함)', ((await a1.page.getByTestId('report-correction').innerText()) ?? '').includes('바로잡') && (await a1.page.getByTestId('report-ack').getAttribute('data-acked')) === '0')
  await hpGo(a1.page, `/my-projects/${LA1}?tab=reports`)
  await a1.page.getByTestId('project-reports').waitFor({ timeout: 10000 })
  check("W8d 프로젝트 상세 '보고서' 탭 — 2판 한 편(예전 판은 목록에 없음)", (await a1.page.getByTestId('project-report-item').count()) === 1)
  await shot(a1.page, 'hp-04-detail-reports')

  // ---------- W9 내리기 ----------
  await osGo(op, '/ops/clients/growth-a?tab=portal')
  await op.getByTestId('report-row').first().getByTestId('report-withdraw').click()
  await op.getByTestId('report-withdraw-reason').fill('수치 다시 확인(내부)')
  await op.getByTestId('report-withdraw-go').click()
  await op.waitForFunction(() => document.querySelector('[data-testid="report-row"]')?.getAttribute('data-status') === 'withdrawn', null, { timeout: 10000 }).catch(() => {})
  await hpGo(a1.page, `/my-projects/reports/${R2}`)
  await a1.page.getByTestId('report-page').waitFor()
  const wText = (await a1.page.locator('body').innerText()) ?? ''
  check("W9a 고객 — '내렸어요' · 본문 0 · 내린 까닭(내부) 0", (await a1.page.getByTestId('report-page').getAttribute('data-state')) === 'withdrawn' && !wText.includes('수치 다시 확인'))
  await hpGo(a1.page, '/my-projects')
  check('W9b 홈 — 최근 보고서에서 빠짐 · 기록은 DB 에 그대로(2편)', (await a1.page.getByTestId('growth-recent').count()) === 0 && sql(`select count(*) from public.portal_reports where operations_client_id = 'growth-a'`) === '2')

  // ---------- W10 연결 멈춤 ----------
  await osGo(op, '/ops/clients/growth-a?tab=portal')
  const rowA1 = op.locator(`[data-testid="portal-account"][data-email="${CA1.email}"]`)
  await rowA1.getByTestId('portal-pause').click()
  await rowA1.getByTestId('portal-resume').waitFor({ timeout: 10000 })
  check('W10a A1 줄만 멈춤 · A2 줄은 연결됨(서버)', sql(`select string_agg(profile_id || ':' || status, ',' order by profile_id) from public.portal_client_links where operations_client_id = 'growth-a'`) === `${CA1.id}:paused,${CA2.id}:active`)
  await hpGo(a1.page, '/my-projects')
  await hpGo(a2.page, '/my-projects')
  check('W10b 멈춘 A1 — 그 순간부터 프로젝트 0 · 가입한 이메일 안내 / A2 는 그대로', (await a1.page.getByTestId('growth-unlinked').count()) === 1 && (await a1.page.getByTestId('project-card').count()) === 0 && ((await a1.page.getByTestId('growth-unlinked').innerText()) ?? '').includes(CA1.email) && (await a2.page.getByTestId('project-card').count()) === 1)
  await shot(a1.page, 'hp-05-paused')
  await rowA1.getByTestId('portal-resume').click()
  await rowA1.getByTestId('portal-pause').waitFor({ timeout: 10000 })
  await hpGo(a1.page, '/my-projects')
  check('W10c 다시 켜면 A1 도 돌아옴', (await a1.page.getByTestId('project-card').count()) === 1)

  // ---------- W11 되돌리기 ----------
  execSync(`su postgres -c "psql -q -d ${DB}"`, { input: execSync('cat supabase/manual/rollback_0033.sql') })
  await hpGo(a1.page, '/my-projects')
  await a1.page.getByTestId('project-card').first().waitFor({ timeout: 10000 })
  check("W11a 되돌린 뒤 홈 — 프로젝트 카드 그대로 · 보고서 칸 꺼짐(오류 글 0)", (await a1.page.getByTestId('growth-home').getAttribute('data-growth')) === 'off' && (await a1.page.getByTestId('project-card').count()) === 1 && !((await a1.page.locator('body').innerText()) ?? '').includes('불러오지 못했'))
  await hpGo(a1.page, `/my-projects/${LA1}?tab=reports`)
  await a1.page.waitForTimeout(500)
  const tabs = await a1.page.locator('button').allInnerTexts()
  check("W11b 상세 — '보고서' 탭 숨음 · 지금 해야 할 일로", !tabs.some((t) => t.trim().startsWith('보고서')) && tabs.some((t) => t.includes('지금 해야 할 일')), tabs.slice(0, 8))
  await osGo(op, '/ops/clients/growth-a?tab=portal')
  await op.getByTestId('portal-usage').waitFor({ timeout: 10000 })
  check('W11c OS — 보고서 칸만 숨음 · 연결 · 서류 · 요청 칸은 그대로', (await op.getByTestId('portal-reports').count()) === 0 && (await op.getByTestId('portal-usage').getAttribute('data-state')) === 'off' && ((await op.locator('body').innerText()) ?? '').includes('고객과 주고받는 서류'))
  execSync(`su postgres -c "psql -q -d ${DB}"`, { input: execSync('cat supabase/migrations/20261127000033_customer_growth.sql') })
  await osGo(op, '/ops/clients/growth-a?tab=portal')
  await op.getByTestId('portal-reports').waitFor({ timeout: 10000 }).catch(() => {})
  check('W11d 0033 다시 → OS 보고서 칸 · 기록 그대로 돌아옴', (await op.getByTestId('portal-reports').count()) === 1 && (await op.getByTestId('report-row').count()) >= 1)

  // ---------- W14 (D-682) 월간 보고 → 고객 화면 이름 · 대표 오늘 줄 ----------
  await op.getByTestId('report-create').click()
  await op.locator('[data-testid="report-kind"][data-kind="monthly"]').click()
  await op.getByTestId('report-make-draft').click()
  await op.waitForFunction(() => document.querySelector('[data-testid="report-sheet"]')?.getAttribute('data-step') === 'edit')
  const monTitle = await op.getByTestId('report-title').inputValue()
  await op.getByTestId('report-publish').click()
  await op.getByTestId('report-publish-go').click()
  await op.getByTestId('report-done').waitFor({ timeout: 15000 })
  await op.getByTestId('report-done-close').click()
  check("W14a 월간 보고 발행 — 서버 종류 monthly · 제목 'n월 월간 보고'", sql(`select kind || '|' || title from public.portal_reports where operations_client_id = 'growth-a' and status = 'published' order by published_at desc limit 1`) === `monthly|${monTitle}` && /^\d{1,2}월 월간 보고$/.test(monTitle), monTitle)
  await hpGo(a1.page, '/my-projects')
  await a1.page.getByTestId('growth-recent').waitFor({ timeout: 10000 })
  const recent0 = (await a1.page.getByTestId('growth-recent-item').first().innerText()) ?? ''
  check("W14b 고객 홈 최근 보고서 — 같은 이름 '월간 보고'(OS · 홈페이지 같은 말)", recent0.includes(monTitle) && recent0.includes('월간 보고'), recent0)
  await osGo(op, '/')
  const chip2 = op.getByTestId('today-portal-open')
  let rules2 = []
  if (await chip2.count()) {
    await chip2.click()
    rules2 = await op.getByTestId('today-portal-row').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-rule')}|${e.textContent}`))
    await op.keyboard.press('Escape')
  }
  check('W14c 이번 달 보고를 낸 한빛정밀은 월말 보고 줄 0(바다상사만 남을 수 있음)', !rules2.some((r) => r.startsWith('monthly_review') && r.includes('한빛정밀')), rules2)
  await osGo(op, '/ops/clients/growth-a?tab=portal')
  await op.getByTestId('portal-reports').waitFor({ timeout: 10000 })

  // ---------- W12 390 ----------
  const m = await hpContext(CA2, { width: 390, height: 844 }, { deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  // 새 보고서 하나 더(대표) — 휴대폰 홈 · 보고서 화면
  await op.getByTestId('report-create').click()
  await op.getByTestId('report-make-draft').click()
  await op.getByTestId('report-publish').click()
  await op.getByTestId('report-publish-go').click()
  await op.getByTestId('report-done').waitFor({ timeout: 15000 })
  await op.getByTestId('report-done-close').click()
  await hpGo(m.page, '/my-projects')
  await m.page.getByTestId('growth-recent').waitFor({ timeout: 10000 })
  check('W12a 390 홈 — 넘침 0', (await overflowX(m.page)) <= 0, await overflowX(m.page))
  await shot(m.page, 'hp-m-01-home', true)
  await m.page.getByTestId('growth-recent-item').first().click()
  await m.page.getByTestId('report-body').waitFor({ timeout: 10000 })
  const ackH = (await m.page.getByTestId('report-ack').boundingBox())?.height ?? 0
  check('W12b 390 보고서 — 넘침 0 · [확인했어요] 44px 이상', (await overflowX(m.page)) <= 0 && ackH >= 44, { o: await overflowX(m.page), ackH })
  await shot(m.page, 'hp-m-02-report', true)

  // ---------- W15 (D-683) 대표가 보는 '고객 화면' = 고객이 실제로 보는 화면 · 기록 0 · 대표만 ----------
  const recOf = async (pg) => pg.getByTestId(pg === op ? 'cv-recent-item' : 'growth-recent-item').evaluateAll((els) => els.map((e) => `${(e.querySelector('span span') ?? e).textContent?.trim().slice(0, 40)}|${e.getAttribute('data-state')}`))
  // 고객 두 계정이 먼저 자기 홈을 연다(그 순간의 고객 화면) → 그 뒤 기록을 재고 → 대표가 같은 계정으로 본다
  const theirsOf = {}
  for (const u of [CA1, CA2]) {
    const ctxU = u === CA1 ? a1 : a2
    await hpGo(ctxU.page, '/my-projects')
    await ctxU.page.getByTestId('growth-recent').waitFor({ timeout: 10000 }).catch(() => {})
    theirsOf[u.id] = await recOf(ctxU.page)
  }
  await new Promise((r) => setTimeout(r, 1500))
  const before = sql(`select count(*) || ':' || coalesce(sum(seen_count), 0) from public.portal_receipts`)
  await osGo(op, '/settings')
  const cvSw = op.locator('[data-testid="view-as-switch"] [data-view="customer"]').first()
  check("W15a 대표 설정 '보는 화면' — 대표 · 팀장 · [고객 화면] 셋", (await cvSw.count()) === 1 && (await op.locator('[data-testid="view-as-switch"] [data-view="pilot"]').count()) >= 1)
  await cvSw.click()
  await op.getByTestId('cv-picker').waitFor({ timeout: 10000 })
  const groups = await op.getByTestId('cv-group').allInnerTexts()
  check('W15b 고르기 — 계약 고객 · 잠재고객(새봄식품 들어감)', groups.length === 2 && /잠재고객 [1-9]/.test(groups[1]), groups)
  for (const [u, link] of [[CA1, LA1], [CA2, LA2]]) {
    await osGo(op, `/customer-view?client=growth-a&as=${link}`)
    await op.getByTestId('cv-frame').waitFor({ timeout: 10000 })
    await op.getByTestId('cv-recent').waitFor({ timeout: 10000 }).catch(() => {})
    const mine = await recOf(op)
    const theirs = theirsOf[u.id]
    check(`W15c ${u === CA1 ? 'A1' : 'A2'} 계정으로 — 대표가 보는 최근 보고서(제목 · 새/확인 전/확인함) = 고객 실제 화면`, mine.length > 0 && JSON.stringify(mine) === JSON.stringify(theirs), { mine, theirs })
  }
  await op.getByTestId('cv-recent-item').first().click()
  await op.getByTestId('cv-report-body').waitFor({ timeout: 10000 })
  await op.waitForTimeout(1500)
  const cvText = (await op.getByTestId('cv-frame').innerText()) ?? ''
  check('W15d 대표 보고서 화면 — [확인했어요] 안 눌림 · 내부 글 · 수수료 · 안쪽 말 0', (await op.getByTestId('cv-ack').isDisabled()) && !SECRETS.some((x) => cvText.includes(x)) && !cvText.includes('고객 업로드됨'), cvText.slice(0, 200))
  // 고객 화면 쪽 방문 · 열람 기록은 고객이 들어올 때만 — 대표가 본 것은 0
  check('W15e 대표가 고객 화면 · 보고서를 열어도 열람 · 방문 기록 0(서버)', sql(`select count(*) || ':' || coalesce(sum(seen_count), 0) from public.portal_receipts`) === before, { before, after: sql(`select count(*) || ':' || coalesce(sum(seen_count), 0) from public.portal_receipts`) })
  await shot(op, 'os-03-customer-view-report', true)
  await osGo(op, '/customer-view?client=growth-c')
  await op.getByTestId('cv-frame').waitFor({ timeout: 10000 })
  check("W15f 잠재고객(연결 전) — 고객이 보는 '연결된 프로젝트 없음' · 안내 한 줄", (await op.getByTestId('cv-frame').getAttribute('data-linked')) === '0' && (await op.getByTestId('cv-unlinked').count()) === 1 && (await op.getByTestId('cv-unlinked-note').count()) === 1)
  await op.getByTestId('cv-back-owner').click()
  await op.waitForURL((u) => new URL(u).pathname === '/', { timeout: 8000 }).catch(() => {})
  check('W15g [대표로 돌아가기] → 오늘', new URL(op.url()).pathname === '/')
  // 내부 팀장 — 같은 주소로 와도 막힘 · 보는 화면에 [고객 화면] 0
  const pc = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  await pc.route(`https://${REF}.supabase.co/**`, makeRoute('os'))
  const pp = await pc.newPage()
  pp.on('pageerror', (e) => errors.push(`os-pilot: ${String(e)}`))
  await pp.goto(`${OS}/login`, { waitUntil: 'networkidle' })
  await pp.getByLabel('이메일').fill(PILOT.email)
  await pp.getByLabel('비밀번호').fill(PILOT.password)
  await pp.getByRole('button', { name: /^로그인/ }).click()
  await pp.waitForURL((x) => !x.pathname.startsWith('/login'), { timeout: 30000 }).catch(() => {})
  // 로그인 뒤 앱이 첫 화면으로 옮기는 중에 주소를 바꾸면 그 이동이 끊긴다(ERR_ABORTED) — 첫 화면이 다 뜬 뒤에 · 끊기면 한 번 더
  await pp.waitForLoadState('networkidle').catch(() => {})
  await pp.waitForTimeout(800)
  await pp.goto(`${OS}/customer-view?client=growth-a`, { waitUntil: 'networkidle' }).catch(async () => {
    await pp.waitForTimeout(1500)
    await pp.goto(`${OS}/customer-view?client=growth-a`, { waitUntil: 'networkidle' })
  })
  // 화면 조각이 늦게 올 수 있다 — 막힘 화면이 뜰 때까지(최대 15초)
  await pp.getByTestId('cv-page').waitFor({ timeout: 15000 }).catch(() => {})
  await pp.waitForTimeout(300)
  const pState = await pp.getByTestId('cv-page').getAttribute('data-state').catch(() => '')
  const pText = (await pp.locator('body').innerText()) ?? ''
  check("W15h 내부 팀장 — /customer-view 막힘('대표 계정에서만') · 대표 업체 이름 0", pState === 'blocked' && !pText.includes('한빛정밀'), { pState, t: pText.slice(0, 120) })
  await pp.goto(`${OS}/settings`, { waitUntil: 'networkidle' })
  check("W15i 내부 팀장 설정 — '보는 화면' [고객 화면] 0", (await pp.locator('[data-view="customer"]').count()) === 0)
  await pc.close()

  // ---------- W16 (D-684) 재계약 전 연간 보고 ----------
  const kst = (n) => new Date(Date.now() + 9 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10)
  const ENDS = kst(20)
  sql(`update public.operations_clients set payload = payload || jsonb_build_object('contract', jsonb_build_object('signedAt', '${kst(-345)}', 'kind', '', 'cashAmount', null, 'policies', '[]'::jsonb, 'note', '', 'endsAt', '${ENDS}', 'termFrom', '')) where id = 'growth-b'`)
  await osGo(op, '/')
  const chip3 = op.getByTestId('today-portal-open')
  await chip3.waitFor({ timeout: 10000 }).catch(() => {})
  let rules3 = []
  if (await chip3.count()) {
    await chip3.click()
    await op.getByTestId('today-portal-sheet').waitFor({ timeout: 5000 }).catch(() => {})
    rules3 = await op.getByTestId('today-portal-row').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-rule')}|${e.textContent}`))
  }
  const md = `${Number(ENDS.slice(5, 7))}/${Number(ENDS.slice(8, 10))}`
  check(`W16a 오늘 '고객 화면 챙길 것' — 바다상사 '계약 끝 ${md}(20일 남음) — 재계약 전에 연간 보고' · 바다상사 월말 · 보고 공백 줄은 대신 빠짐`,
    rules3.some((r) => r.startsWith('renewal_report|') && r.includes('바다상사') && r.includes(`계약 끝 ${md}(20일 남음)`)) && !rules3.some((r) => /^(monthly_review|report_gap)\|/.test(r) && r.includes('바다상사')), rules3)
  const renRow = op.locator('[data-testid="today-portal-row"][data-rule="renewal_report"]').filter({ hasText: '바다상사' })
  await renRow.getByTestId('today-portal-go').click()
  await op.getByTestId('report-sheet').waitFor({ timeout: 15000 }).catch(() => {})
  await op.waitForTimeout(500)
  const k3 = await op.locator('[data-testid="report-kind"][aria-pressed="true"]').getAttribute('data-kind').catch(() => '')
  const p3 = await op.locator('[data-testid="report-period"][aria-pressed="true"]').getAttribute('data-period').catch(() => '')
  check('W16b [열기] → 바다상사 고객 플랫폼 탭 · 보고서 창이 연간 · 계약일부터로 바로 · 주소 값(make) 지움', op.url().includes('/ops/clients/growth-b') && op.url().includes('tab=portal') && !op.url().includes('make=') && k3 === 'annual' && p3 === 'contract', { url: op.url(), k3, p3 })
  await shot(op, 'os-05-renewal-annual')
  await op.keyboard.press('Escape')
  await osGo(op, '/')
  const careRow = op.locator('[data-testid="care-row"][data-client="growth-b"]')
  // '안부 챙길 계약 고객' 은 접힌 채 시작한다(숫자만) — 펼친다
  const careFold = op.getByTestId('today-care')
  await careFold.waitFor({ timeout: 10000 }).catch(() => {})
  if (!(await careRow.isVisible().catch(() => false))) await careFold.locator('button').first().click().catch(() => {})
  await careRow.waitFor({ timeout: 8000 }).catch(() => {})
  check("W16c 오늘 '안부 챙길 계약 고객' — 바다상사 재계약 줄(20일 남음)", (await careRow.getAttribute('data-reason').catch(() => '')) === 'renewal' && ((await careRow.innerText().catch(() => '')) ?? '').includes('20일 남음'), (await careFold.innerText().catch(() => '칸 없음'))?.slice(0, 300))
  await shot(op, 'os-06-today-care-renewal')

  // ---------- W17 (D-685) 공유 서류 · 결과 글 열람 ----------
  const ago = (d) => new Date(Date.now() - d * 86_400_000).toISOString()
  sql(`
create or replace function public.portal_result_receipts_since() returns timestamptz language sql immutable as $f$ select '${ago(30)}'::timestamptz $f$;
update public.portal_client_links set updated_at = now() where id = '${LA1}';
insert into public.portal_documents (workspace_id, portal_client_link_id, operations_client_id, document_type, title, storage_path, file_name, source, visibility, status, created_at)
values ('${OWNER_WS}', '${LA1}', 'growth-a', 'etc', '예전 공유 자료', '${OWNER_WS}/clients/growth-a/old.pdf', 'old.pdf', 'internal', 'shared_with_customer', 'verified', '${ago(40)}'),
       ('${OWNER_WS}', '${LA1}', 'growth-a', 'etc', '벤처인증 확인서', '${OWNER_WS}/clients/growth-a/venture.pdf', 'venture.pdf', 'internal', 'shared_with_customer', 'verified', '${ago(10)}');
insert into public.portal_updates (workspace_id, portal_client_link_id, category, title, body, status, published_at)
values ('${OWNER_WS}', '${LA1}', 'result', '벤처인증을 받으셨어요', '확인서를 공유했습니다.', 'published', '${ago(9)}');
`)
  const docNew = sql(`select id from public.portal_documents where title = '벤처인증 확인서' and portal_client_link_id = '${LA1}'`)
  const resNew = sql(`select id from public.portal_updates where title = '벤처인증을 받으셨어요' and portal_client_link_id = '${LA1}'`)
  await osGo(op, '/')
  let rules4 = []
  const chip4 = op.getByTestId('today-portal-open')
  await chip4.waitFor({ timeout: 10000 }).catch(() => {})
  if (await chip4.count()) {
    await chip4.click()
    await op.getByTestId('today-portal-sheet').waitFor({ timeout: 5000 }).catch(() => {})
    rules4 = await op.getByTestId('today-portal-row').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-rule')}|${e.textContent}`))
    await op.keyboard.press('Escape')
  }
  check("W17a 오늘 — 한빛정밀 '공유한 결과 자료 2개를 안 열어 보셨어요(10일째)'(기록 전 공유 하나는 안 셈)", rules4.some((r) => r.startsWith('result_unseen|') && r.includes('한빛정밀') && r.includes('결과 자료 2개') && r.includes('10일째')), rules4)
  await osGo(op, '/ops/clients/growth-a?tab=portal')
  await op.getByTestId('portal-reports').waitFor({ timeout: 10000 }).catch(() => {})
  const st0 = await op.getByTestId('result-seen').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')).sort().join(','))
  check("W17b OS 탭 — 공유 서류 · 결과 글에 '아직 안 여심(n일째)' 둘 · '열람 기록 전 공유' 하나", st0 === 'before,unseen,unseen', st0)
  await op.getByTestId('result-seen').first().scrollIntoViewIfNeeded().catch(() => {})
  await op.waitForTimeout(300)
  await shot(op, 'os-06b-result-unseen')
  // 대표 · 다른 회사 고객은 기록을 못 남김(서버)
  const fakeO = await rest(OWNER, 'portal_mark_item_seen', { p_link_id: LA1, p_kind: 'document', p_item_id: docNew })
  const fakeB = await rest(CB1, 'portal_mark_item_seen', { p_link_id: LA1, p_kind: 'result', p_item_id: resNew })
  check('W17c 대표 · 다른 회사 고객(B1)이 A1 연결로 기록 남기기 막힘 · 기록 0', fakeO.status !== 200 && fakeB.status !== 200 && sql(`select count(*) from public.portal_receipts where item_kind in ('document', 'result')`) === '0', { o: fakeO.status, b: fakeB.status })
  // 고객 A1 — 결과 탭 1초 → 결과 글 · [열기] → 서류
  await hpGo(a1.page, `/my-projects/${LA1}?tab=results`)
  await a1.page.waitForTimeout(1800)
  check("W17d 고객 '결과' 탭이 1초 넘게 보이면 결과 글 열람 한 줄(서버) · 서류는 아직 0", receipts(CA1, 'result') === '1' && receipts(CA1, 'document') === '0', { r: receipts(CA1, 'result'), d: receipts(CA1, 'document') })
  const openBtn = a1.page.locator('li').filter({ hasText: '벤처인증 확인서' }).getByRole('button', { name: '열기' })
  await openBtn.click()
  await a1.page.waitForTimeout(1200)
  check('W17e [열기] → 공유 서류 열람 한 줄(서버) · 예전 공유는 안 연 채 0', receipts(CA1, 'document') === '1' && sql(`select count(*) from public.portal_receipts where item_kind = 'document' and item_id = '${docNew}'`) === '1')
  await shot(a1.page, 'hp-05-results-tab')
  await osGo(op, '/ops/clients/growth-a?tab=portal')
  await op.getByTestId('portal-reports').waitFor({ timeout: 10000 }).catch(() => {})
  const st1 = await op.getByTestId('result-seen').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-state')}|${e.textContent}`))
  check("W17f OS 탭 — 둘 다 '열어 보심 m/d' · 예전 공유는 '열람 기록 전 공유'", st1.filter((x) => x.startsWith('seen|') && x.includes('열어 보심')).length === 2 && st1.filter((x) => x.startsWith('before|')).length === 1, st1)
  await op.getByTestId('result-seen').first().scrollIntoViewIfNeeded().catch(() => {})
  await op.waitForTimeout(300)
  await shot(op, 'os-07-result-seen')
  await osGo(op, '/')
  let rules5 = []
  if (await op.getByTestId('today-portal-open').count()) {
    await op.getByTestId('today-portal-open').click()
    await op.getByTestId('today-portal-sheet').waitFor({ timeout: 5000 }).catch(() => {})
    rules5 = await op.getByTestId('today-portal-row').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-rule')}|${e.textContent}`))
    await op.keyboard.press('Escape')
  }
  check('W17g 열어 보시면 오늘 줄이 저절로 빠짐', !rules5.some((r) => r.startsWith('result_unseen|') && r.includes('한빛정밀')), rules5)
  // 0034 되돌리기 → 새 줄 숨음 · 고객 화면은 그대로 열림 → 다시 넣기 → 돌아옴(넣은 때는 그대로)
  execSync(`su postgres -c "psql -q -d ${DB}"`, { input: execSync('cat supabase/manual/rollback_0034.sql') })
  await osGo(op, '/ops/clients/growth-a?tab=portal')
  await op.getByTestId('portal-reports').waitFor({ timeout: 10000 }).catch(() => {})
  const offLines = await op.getByTestId('result-seen').count()
  await hpGo(a1.page, `/my-projects/${LA1}?tab=results`)
  await a1.page.waitForTimeout(1200)
  const hpOk = ((await a1.page.locator('body').innerText()) ?? '').includes('벤처인증 확인서')
  check('W17h 0034 되돌리기 → OS 새 줄 0 · 고객 결과 탭은 그대로 열림(오류 0)', offLines === 0 && hpOk && (await op.getByTestId('portal-reports').count()) === 1, { offLines, hpOk })
  execSync(`su postgres -c "psql -q -d ${DB}"`, { input: execSync('cat supabase/migrations/20261128000034_result_receipts.sql') })
  await osGo(op, '/ops/clients/growth-a?tab=portal')
  await op.getByTestId('portal-reports').waitFor({ timeout: 10000 }).catch(() => {})
  check('W17i 0034 다시 → 열어 보심 줄 돌아옴(기록 그대로 · 넣은 때 그대로)', (await op.getByTestId('result-seen').count()) === 3 && sql(`select public.portal_result_receipts_since() < now() - interval '29 days'`) === 't')

  // ---------- W18 (D-686) 고객 화면 '새 결과 자료' ----------
  // '지금 할 일' 은 3줄까지 — 앞선 시험이 남긴 새 보고서가 자리를 차지하지 않게 A1 이 보고서는 다 본 것으로(시험 DB)
  sql(`insert into public.portal_receipts (workspace_id, operations_client_id, portal_client_link_id, profile_id, item_kind, item_id, item_version)
select r.workspace_id, r.operations_client_id, '${LA1}', '${CA1.id}', 'report', r.id, r.version from public.portal_reports r where r.operations_client_id = 'growth-a' and r.status = 'published'
on conflict do nothing;`)
  sql(`insert into public.portal_documents (workspace_id, portal_client_link_id, operations_client_id, document_type, title, storage_path, file_name, source, visibility, status)
values ('${OWNER_WS}', '${LA1}', 'growth-a', 'etc', '세무 검토 결과', '${OWNER_WS}/clients/growth-a/tax.pdf', 'tax.pdf', 'internal', 'shared_with_customer', 'verified');`)
  const docTax = sql(`select id from public.portal_documents where title = '세무 검토 결과' and portal_client_link_id = '${LA1}'`)
  await hpGo(a1.page, '/my-projects')
  await a1.page.getByTestId('growth-todo').waitFor({ timeout: 10000 }).catch(() => {})
  const todoR = await a1.page.getByTestId('growth-todo-item').allInnerTexts()
  const cardR = (await a1.page.getByTestId('project-results-new').innerText().catch(() => '')) ?? ''
  check("W18a 고객 홈 — '지금 할 일' 새 결과 자료 1개 · 카드 '새 결과 자료 1'(이미 연 것 · 기록 전 공유는 안 셈)", todoR.some((t) => t.includes('새 결과 자료 1개')) && cardR.includes('새 결과 자료 1'), { todoR, cardR })
  // D-688 같은 말 — 할 일에 '새 결과 자료' 가 있는데 카드가 '확인할 일 없음' 이라고 하지 않는다
  const pill18 = (await a1.page.getByTestId('project-new-pill').innerText().catch(() => '')) ?? ''
  const card18 = (await a1.page.getByTestId('project-card').first().innerText().catch(() => '')) ?? ''
  // 휴대폰(390) — 카드 알약이 넘치지 않는지 · 사진
  await a1.page.setViewportSize({ width: 390, height: 844 })
  await a1.page.waitForTimeout(400)
  const over18 = await a1.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  await shot(a1.page, 'hp-06b-home-new-390', true)
  await a1.page.setViewportSize({ width: 1440, height: 900 })
  await shot(a1.page, 'hp-06-home-new-result')
  // 대표 '고객 화면 보기' — A1 계정은 같은 표시 · A2 계정은 없음(계정마다) · 기록 0
  const before18 = sql(`select count(*) from public.portal_receipts where item_kind in ('document', 'result')`)
  await osGo(op, `/customer-view?client=growth-a&as=${LA1}`)
  await op.getByTestId('cv-home').waitFor({ timeout: 10000 }).catch(() => {})
  const cvTodo = await op.getByTestId('cv-todo-item').allInnerTexts()
  const cvPill = (await op.getByTestId('cv-new-pill').innerText().catch(() => '')) ?? ''
  await op.getByTestId('cv-project-card').scrollIntoViewIfNeeded().catch(() => {})
  await shot(op, 'os-08-cv-new-pill')
  await osGo(op, `/customer-view?client=growth-a&as=${LA2}`)
  await op.getByTestId('cv-home').waitFor({ timeout: 10000 }).catch(() => {})
  const cvTodo2 = await op.getByTestId('cv-todo-item').allInnerTexts()
  check("W18b 대표 고객 화면 보기 — A1 계정 '새 결과 자료 1개'(고객 화면과 같게) · A2 계정은 없음 · 서버 기록 그대로", cvTodo.some((t) => t.includes('새 결과 자료 1개')) && !cvTodo2.some((t) => t.includes('새 결과 자료')) && sql(`select count(*) from public.portal_receipts where item_kind in ('document', 'result')`) === before18, { cvTodo, cvTodo2 })
  // 고객 — 할 일 누르면 결과 탭 · '새 1' · 알약 하나 → [열기] → 사라짐
  await a1.page.getByTestId('growth-todo-item').filter({ hasText: '새 결과 자료' }).first().click()
  await a1.page.waitForURL(/tab=results/, { timeout: 10000 }).catch(() => {})
  await a1.page.getByTestId('project-tab-results-new').waitFor({ timeout: 10000 }).catch(() => {})
  const badge = (await a1.page.getByTestId('project-tab-results-new').innerText().catch(() => '')) ?? ''
  const pills = await a1.page.getByTestId('result-new').count()
  const sum18 = (await a1.page.getByTestId('project-summary').innerText().catch(() => '')) ?? ''
  await a1.page.getByTestId('project-summary').scrollIntoViewIfNeeded().catch(() => {})
  await shot(a1.page, 'hp-07b-project-summary')
  check("W18c 할 일 → '결과' 탭 · 탭 '새 1' · '새' 알약 하나(새로 공유한 서류에만)", a1.page.url().includes('tab=results') && badge === '새 1' && pills === 1 && (await a1.page.locator('li').filter({ hasText: '세무 검토 결과' }).getByTestId('result-new').count()) === 1, { url: a1.page.url(), badge, pills })
  await shot(a1.page, 'hp-07-results-new')
  await a1.page.locator('li').filter({ hasText: '세무 검토 결과' }).getByRole('button', { name: '열기' }).click()
  await a1.page.waitForTimeout(1200)
  check("W18d [열기] → 알약 · 탭 '새' 사라짐 · 서버 열람 한 줄", (await a1.page.getByTestId('result-new').count()) === 0 && (await a1.page.getByTestId('project-tab-results-new').count()) === 0 && sql(`select count(*) from public.portal_receipts where item_kind = 'document' and item_id = '${docTax}'`) === '1')
  await hpGo(a1.page, '/my-projects')
  await a1.page.getByTestId('project-card').first().waitFor({ timeout: 10000 }).catch(() => {})
  const todoR2 = await a1.page.getByTestId('growth-todo-item').allInnerTexts()
  check("W18e 홈으로 돌아오면 '새 결과 자료' 할 일 · 카드 표시 0", !todoR2.some((t) => t.includes('새 결과 자료')) && (await a1.page.getByTestId('project-results-new').count()) === 0, todoR2)
  const card18b = (await a1.page.getByTestId('project-card').first().innerText().catch(() => '')) ?? ''
  check(
    "W18h 같은 말(D-688) — 새 자료가 있으면 카드 '새로 온 자료 1'(확인할 일 없음 0 · 390 넘침 0) · 프로젝트 맨 위 '새로 온 자료가 1개 있습니다 · 새 결과 자료 1개' · 대표 고객 화면 보기 카드도 같게 · 열고 나면 다시 '확인할 일 없음'",
    pill18 === '새로 온 자료 1' && !card18.includes('확인할 일 없음') && over18 <= 0 && sum18.includes('새로 온 자료가 1개 있습니다') && sum18.includes('새 결과 자료 1개') && cvPill === '새로 온 자료 1' &&
      (await a1.page.getByTestId('project-new-pill').count()) === 0 && card18b.includes('확인할 일 없음'),
    { pill18, card18, over18, sum18, cvPill, card18b },
  )
  // 0035 되돌리기 → 새 자료가 있어도 표시만 숨음(화면 그대로 · 오류 0) → 다시
  sql(`insert into public.portal_documents (workspace_id, portal_client_link_id, operations_client_id, document_type, title, storage_path, file_name, source, visibility, status)
values ('${OWNER_WS}', '${LA1}', 'growth-a', 'etc', '노무 검토 결과', '${OWNER_WS}/clients/growth-a/labor.pdf', 'labor.pdf', 'internal', 'shared_with_customer', 'verified');`)
  execSync(`su postgres -c "psql -q -d ${DB}"`, { input: execSync('cat supabase/manual/rollback_0035.sql') })
  await hpGo(a1.page, '/my-projects')
  await a1.page.getByTestId('project-card').first().waitFor({ timeout: 10000 }).catch(() => {})
  const offTodo = await a1.page.getByTestId('growth-todo-item').allInnerTexts()
  check("W18f 0035 되돌리기 → '새 결과 자료' 표시만 숨음 · 프로젝트 카드 · 보고서 칸 그대로", !offTodo.some((t) => t.includes('새 결과 자료')) && (await a1.page.getByTestId('project-card').count()) === 1 && (await a1.page.getByTestId('growth-home').getAttribute('data-growth')) === 'on', offTodo)
  execSync(`su postgres -c "psql -q -d ${DB}"`, { input: execSync('cat supabase/migrations/20261128000035_result_new.sql') })
  await hpGo(a1.page, '/my-projects')
  await a1.page.getByTestId('growth-todo').waitFor({ timeout: 10000 }).catch(() => {})
  check("W18g 0035 다시 → '새 결과 자료 1개' 돌아옴", (await a1.page.getByTestId('growth-todo-item').allInnerTexts()).some((t) => t.includes('새 결과 자료 1개')))

  check('W13 JS 오류 0(두 앱)', errors.length === 0, errors)
} catch (e) {
  check('시험 도중 멈춤', false, String(e?.stack ?? e).slice(0, 800))
} finally {
  await browser.close()
  stop()
}
console.log(`\nqa:growthportal ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
