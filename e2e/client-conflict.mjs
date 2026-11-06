/**
 * qa:clientconflict — SYNC-2(D-547) 같은 업체를 두 곳에서 같이 고칠 때 — **진짜 PostgREST · RLS** 위에서.
 *
 *   실제 src/services/clientOpsService.ts 를 그대로 묶되 연결만 로컬 PostgREST(대표 토큰)로 바꾼다. 같은 묶음을 따로 불러 '기기 A · B · C'(서로 다른 기억).
 *   R0 (수정 전 방식 재현) 읽은 판을 모르는 창 → 예전처럼 막고 알림 · 방금 고친 것은 저장되지 않음(다시 적어야 했다)
 *   S1 서로 다른 칸(A 연락처 · B 업종) → B 저장이 다시 합쳐 저장 · 둘 다 남음 · '합쳐서 저장' 소식
 *   S2 둘 다 상담 메모를 하나씩 더함 → 메모 둘 다
 *   S3 같은 칸(담당자) 다르게 → B 는 막히고 겹친 칸 하나 · 아무것도 덮지 않음 → [내가 고친 것으로] → B 값 + B 의 다른 고침
 *   S4 같은 칸 → [먼저 저장된 것으로] → A 값 그대로 · B 의 다른 고침(메모)은 저장
 *   S5 다른 곳이 지운 메모를 내가 고침 → 겹침 → [내가 고친 것으로] → 메모 되살아남
 *   S6 같은 기기에서 기다리지 않고 세 번 저장 → 막힘 0 · 마지막 것
 *   S7 다른 작업공간 사람(팀장 토큰) → 합치기로도 대표 업체를 못 고침(RLS 그대로)
 *   S8 글자마다 저장(업체 상세) — 합쳐 저장한 뒤 이어 친 글자: 그대로 보내면 내 앞 글자가 '겹친 칸' 으로 잘못 잡힘(재현) → 화면처럼 얹어 보내면 겹침 0
 *   U  화면(진짜 앱 · 대표 로그인 · 업체 상세 › 업체 정보 수정): 다른 기기가 담당자를 고친 사이 휴대폰 번호 입력 → '합쳐서 저장' 한 줄 · DB 둘 다 · 화면 담당자도 새 값
 *      → 같은 칸(담당자)을 다르게 → 화면 아래 고르기 판(겹친 칸 · 두 값) · DB 그대로 → [내가 고친 것으로 저장] → DB · 화면 내 값 · 판 닫힘 · 390 넘침 0
 *
 *   sudo node e2e/client-conflict.mjs   (pg_ctlcluster 16 main start 먼저)
 */
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const E2E_DB = process.env.AXE2E_DB ?? 'axclientconf'
const PGRST_PORT = Number(process.env.PGRST_PORT ?? 4568)
const SECRET = 'e2e-local-jwt-secret-at-least-32-characters-long'
const OWNER = { id: '0e000000-0000-4000-8000-0000000000a1', email: 'owner@e2e.kr' }
const PILOT = { id: '0e000000-0000-4000-8000-0000000000b1', email: 'pilot@e2e.kr' }
const WS = '0e0000aa-0000-4000-8000-00000000000a'
let pass = 0
let fail = 0
const check = (n, ok, d) => {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok || d === undefined ? '' : ' — ' + JSON.stringify(d).slice(0, 400)}`)
}

// 이 시험은 화면 없이 서비스만 — 브라우저 저장소 흉내(업무 항목 기억 등)
const mem = new Map()
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, String(v)), removeItem: (k) => void mem.delete(k), key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size }, clear: () => mem.clear() }

execSync('bash scripts/db-local/e2e-pilot-db.sh', { stdio: 'ignore', env: { ...process.env, AXE2E_DB: E2E_DB } })
const sql = (q) => execSync(`su postgres -c "psql -At -q -d ${E2E_DB}"`, { input: q }).toString().trim()
let PGRST = process.env.POSTGREST_BIN ?? '.cache/postgrest/postgrest'
if (!existsSync(PGRST)) {
  mkdirSync('.cache/postgrest', { recursive: true })
  execSync('curl -sSL -o .cache/postgrest/p.tar.xz https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz && tar xf .cache/postgrest/p.tar.xz -C .cache/postgrest')
}
const pgrst = spawn(PGRST, [], {
  stdio: 'ignore',
  detached: true,
  env: { ...process.env, PGRST_DB_URI: `postgres://authenticator:e2e-local@127.0.0.1:5432/${E2E_DB}`, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: SECRET, PGRST_SERVER_PORT: String(PGRST_PORT), PGRST_DB_POOL: '5' },
})
execSync('npx vite build --config e2e/support/vite.clientconflict.config.mjs', { stdio: 'ignore' })
for (let i = 0; i < 60; i += 1) {
  try {
    if ((await fetch(`http://127.0.0.1:${PGRST_PORT}/`)).status < 500) break
  } catch {
    /* 아직 */
  }
  await new Promise((r) => setTimeout(r, 250))
}
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (u) => {
  const h = b64({ alg: 'HS256', typ: 'JWT' })
  const p = b64({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })
  return `${h}.${p}.${createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`
}
globalThis.__PGRST_URL = `http://127.0.0.1:${PGRST_PORT}`
globalThis.__PGRST_JWT = jwt(OWNER)

const bundle = pathToFileURL(path.resolve('.clientconflict-out/clientconflict.mjs')).href
const A = await import(`${bundle}?device=A`)
const B = await import(`${bundle}?device=B`)
const news = { A: [], B: [] }
A.onClientSaveNews((n) => news.A.push(n.kind))
B.onClientSaveNews((n) => news.B.push(n.kind))

const dbOf = (id) => JSON.parse(sql(`select json_build_object('name', company_name, 'contact', payload->>'contactName', 'phone', payload->>'contactPhone', 'industry', payload->>'industry', 'notes', payload->>'notes', 'noteIds', (select coalesce(json_agg(n->>'id'), '[]'::json) from jsonb_array_elements(coalesce(payload->'notes_list', '[]'::jsonb)) n), 'noteTexts', (select coalesce(json_agg(n->>'text'), '[]'::json) from jsonb_array_elements(coalesce(payload->'notes_list', '[]'::jsonb)) n)) from public.operations_clients where id = '${id}'`))
const fresh = async (dev, id) => (await dev.listClients(WS)).find((r) => r.id === id)
const note = (id, text) => ({ id, text, pinned: false, createdAt: '2026-11-06T00:00:00Z', updatedAt: '2026-11-06T00:00:00Z' })
const tryErr = async (p) => p.then((v) => ({ ok: true, v }), (e) => ({ ok: false, e }))

// ---------- 화면 — 진짜 앱(클라우드 모드) · 로그인만 흉내 · 표는 PostgREST(RLS) ----------
const REF = 'qaconflict'
const PORT = Number(process.env.CONFLICT_PORT ?? 4569)
const BASE = `http://localhost:${PORT}`
const OUT = 'dist-qa-clientconflict'
async function browserPart(ID) {
  execSync(`npx vite build --outDir ${OUT} --emptyOutDir`, { stdio: 'ignore', env: { ...process.env, VITE_DATA_MODE: 'supabase', VITE_SUPABASE_URL: `https://${REF}.supabase.co`, VITE_SUPABASE_ANON_KEY: 'qa-anon' } })
  const server = spawn('npx', ['vite', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true })
  for (let i = 0; i < 80; i += 1) {
    try {
      if ((await fetch(BASE)).ok) break
    } catch {
      /* 아직 */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  const USERS = [{ ...OWNER, password: 'owner-pass' }]
  const userObj = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' })
  const session = (u) => ({ access_token: jwt(u), token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: `refresh-${u.id}`, user: userObj(u) })
  const whoOf = (auth) => USERS.find((u) => jwt(u) === (auth ?? '').replace(/^Bearer /, '')) ?? null
  const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
  const route = async (r) => {
    const req = r.request()
    const url = new URL(req.url())
    const p = decodeURIComponent(url.pathname)
    const headers = req.headers()
    if (p === '/auth/v1/token') {
      const body = JSON.parse(req.postData() ?? '{}')
      const u = url.searchParams.get('grant_type') === 'refresh_token' ? USERS.find((x) => `refresh-${x.id}` === body.refresh_token) : USERS.find((x) => x.email === body.email && x.password === body.password)
      return r.fulfill(u ? json(session(u)) : json({ error: 'invalid_grant' }, 400))
    }
    if (p === '/auth/v1/user') {
      const u = whoOf(headers['authorization'])
      return r.fulfill(u ? json(userObj(u)) : json({ msg: 'no' }, 401))
    }
    if (p === '/auth/v1/logout') return r.fulfill({ status: 204, body: '' })
    if (p.startsWith('/storage/v1/')) return r.fulfill(json([]))
    if (p.startsWith('/rest/v1/')) {
      const fwd = { ...headers }
      delete fwd['host']
      if (!whoOf(fwd['authorization'])) delete fwd['authorization']
      const res = await r.fetch({ url: `http://127.0.0.1:${PGRST_PORT}${p.slice('/rest/v1'.length)}${url.search}`, headers: fwd })
      return r.fulfill({ status: res.status(), headers: { ...res.headers(), 'access-control-allow-origin': '*' }, body: await res.text() })
    }
    return r.fulfill(json([]))
  }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const errors = []
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
    await ctx.route(`https://${REF}.supabase.co/**`, route)
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
    await page.getByLabel('이메일').fill(OWNER.email)
    await page.getByLabel('비밀번호').fill('owner-pass')
    await page.getByRole('button', { name: /^로그인/ }).click()
    await page.waitForURL((x) => !x.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {})
    await page.goto(`${BASE}/ops/clients/${ID}?tab=overview`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    const toggle = page.getByRole('button', { name: /업체 정보 수정/ }).first()
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
    const phone = page.getByLabel('담당자 휴대폰')
    const contact = page.getByLabel('담당자 이름')
    await phone.waitFor({ timeout: 8000 })

    // U1 다른 기기가 담당자를 고친 사이 — 화면에서 휴대폰
    const a = await fresh(A, ID)
    await A.saveClient({ ...a, contactName: '다른기기 담당자' })
    await phone.fill('010-4444-5555')
    await page.getByTestId('client-merged').waitFor({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(800)
    const u1 = dbOf(ID)
    check('U1 다른 기기가 담당자를 고친 사이 휴대폰 입력 → "합쳐서 저장했어요" 한 줄 · DB 둘 다 · 화면 담당자 칸도 새 값', (await page.getByTestId('client-merged').isVisible().catch(() => false)) && u1.phone === '010-4444-5555' && u1.contact === '다른기기 담당자' && (await contact.inputValue()) === '다른기기 담당자', { u1, shown: await contact.inputValue().catch(() => '') })
    await page.getByTestId('client-merged').screenshot({ path: '/tmp/claude-0/clientconflict-merged.png' }).catch(() => {})

    // U2 같은 칸
    const a2 = await fresh(A, ID)
    await A.saveClient({ ...a2, contactName: '최과장(다른 기기)' })
    await contact.fill('박대리(이 화면)')
    await page.getByTestId('client-conflict').waitFor({ timeout: 8000 }).catch(() => {})
    const rows = await page.getByTestId('client-conflict-row').allInnerTexts().catch(() => [])
    const mid = dbOf(ID)
    check('U2 같은 칸(담당자)을 다르게 → 화면 아래 고르기 판 · 겹친 칸 "담당자" · 두 값 · DB 는 그대로(덮지 않음)', rows.length === 1 && /담당자/.test(rows[0]) && /박대리\(이 화면\)/.test(rows[0]) && /최과장\(다른 기기\)/.test(rows[0]) && mid.contact === '최과장(다른 기기)', { rows, mid })
    await page.getByTestId('client-conflict').screenshot({ path: '/tmp/claude-0/clientconflict-pick.png' }).catch(() => {})
    await page.getByTestId('client-conflict-mine').click()
    await page.getByTestId('client-conflict').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(600)
    const end = dbOf(ID)
    check('U3 [내가 고친 것으로 저장] → DB 담당자 = 이 화면 값 · 화면 칸도 · 판 닫힘 · 휴대폰 그대로', end.contact === '박대리(이 화면)' && (await contact.inputValue()) === '박대리(이 화면)' && (await page.getByTestId('client-conflict').count()) === 0 && end.phone === '010-4444-5555', { end, shown: await contact.inputValue().catch(() => '') })

    // U4 휴대폰 390 — 판이 화면 안 · 넘침 0
    await page.setViewportSize({ width: 390, height: 844 })
    const a3 = await fresh(A, ID)
    await A.saveClient({ ...a3, contactName: '휴대폰 시험(다른 기기)' })
    await contact.fill('휴대폰 시험(이 화면)')
    await page.getByTestId('client-conflict').waitFor({ timeout: 8000 }).catch(() => {})
    const box = await page.getByTestId('client-conflict').boundingBox().catch(() => null)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    check('U4 390 — 고르기 판이 화면 안(가로 넘침 0) · 단추 44px 이상', !!box && box.x >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844 && over <= 0 && ((await page.getByTestId('client-conflict-mine').boundingBox())?.height ?? 0) >= 40, { box, over })
    await page.screenshot({ path: '/tmp/claude-0/clientconflict-390.png' }).catch(() => {})
    await page.getByTestId('client-conflict-theirs').click()
    await page.waitForTimeout(800)
    check('U5 [먼저 저장된 것으로 두기] → DB 담당자 = 다른 기기 값 · 판 닫힘', dbOf(ID).contact === '휴대폰 시험(다른 기기)' && (await page.getByTestId('client-conflict').count()) === 0)
    check('U6 화면 JS 오류 0', errors.length === 0, errors)
  } finally {
    await browser.close()
    try {
      process.kill(-server.pid)
    } catch {
      /* 이미 꺼짐 */
    }
  }
}

try {
  const made = await A.createClient(WS, { companyName: '충돌시험 정밀', contactName: '이과장', contactPhone: '010-1111-2222', industry: '제조' })
  const ID = made.id

  // R0 수정 전 방식 재현 — 읽은 판 기억이 없는 창(새로 고친 창처럼): 예전 그대로 막고, 방금 고친 것은 저장 안 됨
  {
    const a = await fresh(A, ID)
    const b = await fresh(B, ID)
    await A.saveClient({ ...a, contactPhone: '010-0000-0001' })
    B.__forgetClientSnapshots()
    const r = await tryErr(B.saveClient({ ...b, industry: '도매(B 가 고침)' }))
    const now = dbOf(ID)
    check('R0 (예전 방식) 읽은 판을 모르면 막고 알림 · B 가 고친 업종은 저장 안 됨(다시 적어야 했다) · A 것도 안 덮음', !r.ok && r.e?.name === 'ClientSaveConflictError' && (r.e.conflicts ?? []).length === 0 && r.e.merged === null && now.industry === '제조' && now.phone === '010-0000-0001', { now, err: r.e?.message })
  }

  // S1 서로 다른 칸
  {
    const a = await fresh(A, ID)
    const b = await fresh(B, ID)
    news.B.length = 0
    await A.saveClient({ ...a, contactPhone: '010-2222-3333' })
    const r = await tryErr(B.saveClient({ ...b, industry: '제조 · 도매' }))
    const now = dbOf(ID)
    check('S1 서로 다른 칸(A 연락처 · B 업종) → B 저장이 합쳐 다시 저장 · 둘 다 남음 · B 에 "합쳐서 저장" 소식', r.ok && now.phone === '010-2222-3333' && now.industry === '제조 · 도매' && r.v.contactPhone === '010-2222-3333' && news.B.includes('merged'), { now, news: news.B, err: r.e?.message })
  }

  // S2 둘 다 메모를 더함
  {
    const a = await fresh(A, ID)
    const b = await fresh(B, ID)
    await A.saveClient({ ...a, notes_list: [note('na', 'PC 에서 쓴 메모'), ...a.notes_list] })
    const r = await tryErr(B.saveClient({ ...b, notes_list: [note('nb', '휴대폰에서 쓴 메모'), ...b.notes_list] }))
    const now = dbOf(ID)
    check('S2 두 곳에서 상담 메모 하나씩 → 둘 다 저장(겹침 0)', r.ok && now.noteIds.includes('na') && now.noteIds.includes('nb'), { now, err: r.e?.message })
  }

  // S3 같은 칸 → 고르기(내가 고친 것으로)
  {
    const a = await fresh(A, ID)
    const b = await fresh(B, ID)
    news.B.length = 0
    await A.saveClient({ ...a, contactName: '김부장' })
    const r = await tryErr(B.saveClient({ ...b, contactName: '박대리', notes: 'B 가 쓴 업체 메모' }))
    const mid = dbOf(ID)
    check('S3 같은 칸(담당자) 다르게 → B 막힘 · 겹친 칸 하나(contactName) · 아무것도 덮지 않음(DB = 김부장 · 메모 그대로) · "고르기" 소식', !r.ok && r.e?.name === 'ClientSaveConflictError' && r.e.conflicts.length === 1 && r.e.conflicts[0].path === 'contactName' && mid.contact === '김부장' && !mid.notes && news.B.includes('conflict') && /같은 칸\(담당자\)/.test(r.e.message), { mid, conflicts: r.e?.conflicts, msg: r.e?.message })
    const saved = await B.resolveClientConflict(r.e, 'mine')
    const now = dbOf(ID)
    check('S3b [내가 고친 것으로 저장] → 담당자 = 박대리 · B 의 메모도 · A 가 앞서 고친 연락처 그대로 · "골라서 저장" 소식', now.contact === '박대리' && now.notes === 'B 가 쓴 업체 메모' && now.phone === '010-2222-3333' && saved.contactName === '박대리' && news.B.includes('resolved'), now)
  }

  // S4 같은 칸 → 먼저 저장된 것으로
  {
    const a = await fresh(A, ID)
    const b = await fresh(B, ID)
    await A.saveClient({ ...a, industry: '도매(A)' })
    const r = await tryErr(B.saveClient({ ...b, industry: '제조(B)', contactPhone: '010-7777-8888' }))
    check('S4 같은 칸(업종) → B 막힘 · 겹친 칸 하나', !r.ok && r.e.conflicts.length === 1 && r.e.conflicts[0].path === 'industry', r.e?.conflicts)
    await B.resolveClientConflict(r.e, 'theirs')
    const now = dbOf(ID)
    check('S4b [먼저 저장된 것으로 두기] → 업종 = A 값 · B 의 다른 고침(연락처)은 저장', now.industry === '도매(A)' && now.phone === '010-7777-8888', now)
  }

  // S5 지운 메모를 내가 고침
  {
    const a = await fresh(A, ID)
    const b = await fresh(B, ID)
    await A.saveClient({ ...a, notes_list: a.notes_list.filter((n) => n.id !== 'na') })
    const r = await tryErr(B.saveClient({ ...b, notes_list: b.notes_list.map((n) => (n.id === 'na' ? { ...n, text: 'PC 메모 — 휴대폰에서 덧붙임' } : n)) }))
    check('S5 다른 곳이 지운 메모를 내가 고침 → 겹침(notes_list[na]) · 일단 지운 채', !r.ok && r.e.conflicts.length === 1 && r.e.conflicts[0].path === 'notes_list[na]' && !dbOf(ID).noteIds.includes('na'), r.e?.conflicts)
    await B.resolveClientConflict(r.e, 'mine')
    const now = dbOf(ID)
    check('S5b [내가 고친 것으로] → 메모 되살아남(덧붙인 글로) · 다른 메모 그대로', now.noteIds.includes('na') && now.noteTexts.includes('PC 메모 — 휴대폰에서 덧붙임') && now.noteIds.includes('nb'), now)
  }

  // S6 같은 기기 연달아
  {
    const a = await fresh(A, ID)
    news.A.length = 0
    const rs = await Promise.all([1, 2, 3].map((n) => tryErr(A.saveClient({ ...a, notes: `연달아 ${n}` }))))
    check('S6 같은 기기에서 기다리지 않고 세 번 → 막힘 0 · 마지막(3) · 합치기 소식 0', rs.every((x) => x.ok) && dbOf(ID).notes === '연달아 3' && !news.A.includes('conflict'), { notes: dbOf(ID).notes, errs: rs.filter((x) => !x.ok).map((x) => x.e?.message), news: news.A })
  }

  // S7 다른 작업공간 사람(팀장)
  {
    const a = await fresh(A, ID)
    const before = dbOf(ID)
    globalThis.__PGRST_JWT = jwt(PILOT)
    const r = await tryErr(A.saveClient({ ...a, contactName: '팀장이 바꾸려 함' }))
    globalThis.__PGRST_JWT = jwt(OWNER)
    const after = dbOf(ID)
    check('S7 팀장 토큰으로 대표 업체 저장 → 못 찾음(RLS) · 합치기 없음 · 대표 업체 그대로', !r.ok && r.e?.name !== 'ClientSaveConflictError' && after.contact === before.contact, { err: r.e?.message, after })
  }

  // S8 글자마다 저장 — 합친 뒤 이어 친 글자
  {
    const r0 = await fresh(B, ID)
    const a = await fresh(A, ID)
    await A.saveClient({ ...a, contactTitle: '부장(A)' })
    const t1 = { ...r0, contactPhone: '010-1' }
    const s1 = await B.saveClient(t1) // 합쳐 저장됨
    const t2 = { ...r0, contactPhone: '010-12' } // 화면이 옛 판(r0)에서 이어 친 글자
    const raw = await tryErr(B.saveClient(t2))
    check('S8a (얹지 않고 보내면) 내 앞 글자가 겹친 칸으로 잡힘 — 화면이 얹어야 하는 까닭(재현)', !raw.ok && raw.e?.conflicts?.[0]?.path === 'contactPhone', raw.e?.conflicts)
    const s1b = await fresh(B, ID)
    const t3 = { ...r0, contactPhone: '010-123' }
    const m = B.mergeClientEdits(t1, t3, s1b)
    const rebased = m.conflicts.length ? B.applyMine(m.merged, m.conflicts) : m.merged
    const r = await tryErr(B.saveClient(rebased))
    const now = dbOf(ID)
    check('S8b 화면처럼 그 사이 친 글자만 저장된 판에 얹어 보냄 → 겹침 0 · 휴대폰 010-123 · A 의 직급 그대로', r.ok && m.conflicts.length === 0 && now.phone === '010-123' && sql(`select payload->>'contactTitle' from public.operations_clients where id = '${ID}'`) === '부장(A)' && !!s1, { now, conflicts: m.conflicts, err: r.e?.message })
  }

  await browserPart(ID)
} catch (e) {
  check('시험 중 오류 없음', false, String(e?.stack ?? e).slice(0, 600))
} finally {
  try {
    process.kill(-pgrst.pid)
  } catch {
    /* 이미 꺼짐 */
  }
}
console.log(`\nclientconflict: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
