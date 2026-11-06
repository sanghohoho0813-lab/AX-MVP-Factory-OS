/**
 * qa:overwritten — D-550 SYNC-5 '다른 기기 때문에 덮인 내용' 보기 · 되돌리기 · 클라우드 흉내(Supabase 응답을 흉내 낸 진짜 화면).
 *
 *   모듈 화면 위 알림 줄 → [덮이기 전 내용 보기 · 되돌리기] → 설정 › 데이터 탭 · 그 판으로 바로
 *   판 — 덮인 내용 n개 · 처음 5개 · [더 보기] · 종류 · 기록 이름 · 업체 · 덮인 때
 *   [지금 내용과 무엇이 달라요?] → 고친 곳 n군데 · 그때 / 지금 · 지워진 기록은 '다시 만들어요'
 *   [되돌리기] → 한 번 더 묻기 → 취소하면 아무것도 안 바뀜 · 되돌리면 원래 줄 = 그때 내용 · 지금 내용은 보관(맨 위) · 되돌린 때 표시 · 끝 한 줄 [열어 보기]
 *   지워진 기록 되돌리기 → 같은 id 로 다시 만듦
 *   보관된 것이 없으면 판 없음 · 알림 줄이 데려오면 '없어요' 한 줄
 *   팀장 설정에도 · 휴대폰 390 넘침 0 · 단추 40px · module_data 지우기 0 · JS 오류 0
 *   (진짜 DB · RLS 위의 되돌리기 규칙은 qa:modconflict R1~R7 이 본다)
 *
 *   node e2e/overwritten-cloud.mjs      (dist-qa-overwritten 로 따로 빌드 · 4584)
 */
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const REF = 'qaproject'
const PORT = 4584
const BASE = `http://localhost:${PORT}`
const OUT = 'dist-qa-overwritten'
const SHOTS = '/tmp/claude-0/overwritten'
mkdirSync(SHOTS, { recursive: true })
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 600)}`)
}

if (!process.env.QA_SKIP_BUILD) {
  execSync(`npx vite build --outDir ${OUT} --emptyOutDir`, {
    stdio: 'ignore',
    env: { ...process.env, VITE_DATA_MODE: 'supabase', VITE_SUPABASE_URL: `https://${REF}.supabase.co`, VITE_SUPABASE_ANON_KEY: 'qa-anon' },
  })
}
const server = spawn('npx', ['vite', 'preview', '--outDir', OUT, '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true })
const stop = () => {
  try {
    process.kill(-server.pid)
  } catch {
    /* 이미 꺼짐 */
  }
}
for (let i = 0; i < 40; i += 1) {
  try {
    if ((await fetch(BASE)).ok) break
  } catch {
    /* 아직 */
  }
  await new Promise((r) => setTimeout(r, 250))
}

const WS = '11111111-1111-4111-8111-111111111111'
const OWNER = '00000000-0000-4000-8000-000000000001'
const CID = 'cli_ow'
const session = {
  access_token: 'qa.' + Buffer.from(JSON.stringify({ sub: OWNER, role: 'authenticated', exp: 4102444800 })).toString('base64url') + '.sig',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  refresh_token: 'qa-refresh',
  user: { id: OWNER, aud: 'authenticated', role: 'authenticated', email: 'owner-test@miraeailab.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
}
const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
const clients = [{ id: CID, workspace_id: WS, company_name: '되돌림정밀(주)', status: 'active', next_action: '', next_action_due_date: null, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-10-20T00:00:00Z', payload: { documents: {}, customDocuments: [] } }]

/** 흉내 낸 module_data 표 — 화면이 쓰는 거르기만(eq · like · order · limit) */
function seed() {
  const t = (h, m) => new Date(Date.UTC(2026, 10, 6, h, m)).toISOString()
  const rows = [
    { id: 'd1', workspace_id: WS, module_key: 'patent-draft', bucket: 'draft', client_id: CID, payload: { draft: { title: '스마트 화분 관리 시스템', claims: ['휴대폰에서 고친 청구항'] } }, created_at: t(0, 0), updated_at: t(5, 0) },
    { id: 'ow_d1_a', workspace_id: WS, module_key: 'patent-draft', bucket: 'draft.overwritten', client_id: CID, payload: { originalId: 'd1', originalUpdatedAt: t(4, 0), replacedAt: t(5, 0), data: { draft: { title: '스마트 화분 관리 시스템', claims: ['PC 에서 쓴 청구항'] } } }, created_at: t(5, 0), updated_at: t(5, 0) },
    // 원래 줄이 지워진 보관
    { id: 'ow_c9_a', workspace_id: WS, module_key: 'policy-funding', bucket: 'consults.overwritten', client_id: CID, payload: { originalId: 'c9', originalUpdatedAt: t(3, 0), replacedAt: t(4, 0), data: { stage: 'consult', memo: '지워진 상담 메모', nextAction: '서류 받기' } }, created_at: t(4, 0), updated_at: t(4, 0) },
  ]
  // 더 보기를 보려고 오래된 보관 5개
  for (let i = 0; i < 5; i += 1) {
    rows.push({ id: `cx${i}`, workspace_id: WS, module_key: 'cretop', bucket: 'analyses', client_id: null, payload: { company: `분석${i}`, ts: '' }, created_at: t(0, i), updated_at: t(1, i) })
    rows.push({ id: `ow_cx${i}`, workspace_id: WS, module_key: 'cretop', bucket: 'analyses.overwritten', client_id: null, payload: { originalId: `cx${i}`, originalUpdatedAt: t(0, i), replacedAt: t(1, i), data: { company: `분석${i}`, ts: '예전' } }, created_at: t(1, i), updated_at: t(1, i) })
  }
  return rows
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } })
async function newCtx(viewport, { access = 'full', empty = false } = {}) {
  const table = empty ? [] : seed()
  const log = { patch: [], post: [], del: [] }
  const ctx = await browser.newContext({ viewport, locale: 'ko-KR', ...(viewport.width < 768 ? { isMobile: true, hasTouch: true } : {}) })
  await ctx.addInitScript(([ref, s, ws]) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s))
    localStorage.setItem('axmvp.active_workspace', ws)
    localStorage.setItem('axmvp.onboarding.prefs', '{"tutorialVersion":1,"autoShowEnabled":false,"firstSeenAt":"2026-01-01T00:00:00.000Z","lastShownDate":"2099-01-01","snoozedUntilDate":"2099-12-31","completedChapterIds":["system"],"lastOpenedChapterId":"system","selectedLearningPath":"ax","guideMode":"core","updatedAt":"2026-01-01T00:00:00.000Z"}')
  }, [REF, session, WS])
  const matches = (r, params) => {
    for (const [k, raw] of params) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue
      const [op, ...rest] = raw.split('.')
      const v = rest.join('.')
      const cell = r[k] == null ? '' : String(r[k])
      if (op === 'eq' && cell !== v) return false
      if (op === 'like' || op === 'ilike') {
        const re = new RegExp('^' + v.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*') + '$')
        if (!re.test(cell)) return false
      }
    }
    return true
  }
  await ctx.route(`https://${REF}.supabase.co/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = decodeURIComponent(url.pathname)
    const method = req.method()
    if (p.endsWith('/auth/v1/token')) return route.fulfill(json(session))
    if (p.endsWith('/auth/v1/user')) return route.fulfill(json(session.user))
    if (p.endsWith('/rest/v1/rpc/my_os_access')) return route.fulfill(json(access))
    if (p.includes('/rest/v1/workspace_members')) return route.fulfill(json([{ workspace_id: WS, user_id: OWNER, role: 'owner', workspaces: { id: WS, name: '미래AI랩', owner_id: OWNER, created_at: '2026-01-01T00:00:00Z' } }]))
    if (p.includes('/rest/v1/workspaces')) return route.fulfill(json([{ id: WS, name: '미래AI랩', owner_id: OWNER, created_at: '2026-01-01T00:00:00Z' }]))
    if (p.includes('/rest/v1/operations_clients')) return route.fulfill(json(method === 'GET' ? clients : []))
    if (p.endsWith('/rest/v1/module_data')) {
      const params = [...url.searchParams.entries()]
      if (method === 'GET') {
        let list = table.filter((r) => matches(r, params))
        const order = url.searchParams.get('order')
        if (order) {
          const [col, dir] = order.split('.')
          list = [...list].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (dir === 'desc' ? -1 : 1))
        }
        const limit = Number(url.searchParams.get('limit') ?? 0)
        if (limit) list = list.slice(0, limit)
        return route.fulfill(json(list))
      }
      if (method === 'POST') {
        const body = JSON.parse(req.postData() ?? '{}')
        const now = new Date().toISOString()
        const items = (Array.isArray(body) ? body : [body]).map((b) => ({ created_at: now, updated_at: now, ...b }))
        for (const it of items) {
          if (table.some((r) => r.id === it.id)) return route.fulfill(json({ message: 'duplicate key' }, 409))
        }
        table.push(...items)
        log.post.push(...items)
        return route.fulfill(json(items, 201))
      }
      if (method === 'PATCH') {
        const body = JSON.parse(req.postData() ?? '{}')
        const hit = table.filter((r) => matches(r, params))
        const now = new Date(Date.now() + 1000).toISOString()
        for (const r of hit) Object.assign(r, body, { updated_at: body.updated_at ? now : r.updated_at })
        log.patch.push({ params: Object.fromEntries(params), body, n: hit.length })
        return route.fulfill(json(hit))
      }
      if (method === 'DELETE') {
        log.del.push(req.url())
        return route.fulfill(json([]))
      }
    }
    return route.fulfill(json([]))
  })
  return { ctx, table, log }
}

const errors = []
// ---------- 1) 알림 줄 → 설정 › 데이터 ----------
const A = await newCtx({ width: 1440, height: 900 })
const page = await A.ctx.newPage()
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(`${BASE}/tools/policy-funding`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.evaluate(() => window.dispatchEvent(new CustomEvent('axmvp:module-overwrote', { detail: { moduleKey: 'policy-funding', bucket: 'consults' } })))
const notice = page.getByTestId('module-overwrote')
await notice.waitFor({ timeout: 5000 })
await page.getByTestId('module-overwrote-open').click()
await page.waitForURL(/\/settings\?tab=data&focus=overwritten/, { timeout: 5000 })
const panel = page.getByTestId('overwritten-panel')
await panel.waitFor({ timeout: 8000 })
await page.waitForTimeout(500)
const pbox = await panel.boundingBox()
check('1 알림 줄 [덮이기 전 내용 보기 · 되돌리기] → 설정 › 데이터 탭 · 그 판이 화면 안 · 알림 줄 닫힘', !!pbox && pbox.y >= 0 && pbox.y < 900 && (await page.locator('nav[aria-label="설정 메뉴"] [aria-current="page"]').innerText()).includes('데이터') && (await page.getByTestId('module-overwrote').count()) === 0, pbox)

// ---------- 2) 판 · 목록 ----------
const ptext = await panel.innerText()
check('2 판 제목 — 다른 기기 때문에 덮인 내용 7개 · 처음 5개만', /다른 기기 때문에 덮인 내용 7개/.test(ptext) && (await page.getByTestId('overwritten-item').count()) === 5, ptext.slice(0, 200))
const first = page.getByTestId('overwritten-item').first()
const ftext = await first.innerText()
check('2b 첫 줄 — 특허 명세서 · 스마트 화분 관리 시스템 · 업체 이름 · 다른 기기 저장에 덮임 · [열어 보기] · [되돌리기]', /특허 명세서 · 스마트 화분 관리 시스템/.test(ftext) && /되돌림정밀\(주\)/.test(ftext) && /다른 기기 저장에 덮임/.test(ftext) && /열어 보기/.test(ftext), ftext)
await page.getByTestId('overwritten-more').click()
check('2c [2개 더 보기] → 7개 모두', (await page.getByTestId('overwritten-item').count()) === 7)

// ---------- 3) 달라진 곳 ----------
await first.getByTestId('overwritten-diff').locator('summary').click()
await page.waitForTimeout(500)
const dtext = await first.getByTestId('overwritten-diff').innerText()
check('3 [지금 내용과 무엇이 달라요?] → 고친 곳 1군데 · 그때 PC 청구항 / 지금 휴대폰 청구항', /고친 곳 1군데/.test(dtext) && /그때\s*PC 에서 쓴 청구항/.test(dtext) && /지금\s*휴대폰에서 고친 청구항/.test(dtext), dtext)
const second = page.getByTestId('overwritten-item').nth(1)
await second.getByTestId('overwritten-diff').locator('summary').click()
await page.waitForTimeout(500)
check('3b 지워진 기록 — 되돌리면 다시 만들어요', /지워져 있어요/.test(await second.getByTestId('overwritten-diff').innerText()))
await page.screenshot({ path: `${SHOTS}/pc-panel.png`, fullPage: false })

// ---------- 4) 되돌리기 — 취소 ----------
await first.getByTestId('overwritten-restore').click()
const dialog = page.getByRole('dialog')
await dialog.waitFor({ timeout: 5000 })
const dtxt = await dialog.innerText()
check('4 한 번 더 묻기 — 무엇을 · 언제 내용으로 · 지금 내용은 보관 · 다른 기기 새로 고침 안내', /그때 내용으로 되돌릴까요/.test(dtxt) && /스마트 화분 관리 시스템/.test(dtxt) && /지금 내용은 지우지 않고/.test(dtxt) && /새로 고친 뒤/.test(dtxt), dtxt)
await page.screenshot({ path: `${SHOTS}/pc-confirm.png` })
await dialog.getByRole('button', { name: '취소' }).click()
await page.waitForTimeout(300)
check('4b 취소 → 아무것도 안 바뀜(저장 0)', A.log.patch.length === 0 && A.log.post.length === 0, A.log)

// ---------- 5) 되돌리기 ----------
await first.getByTestId('overwritten-restore').click()
await page.getByRole('dialog').waitFor({ timeout: 5000 })
await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
await page.getByTestId('overwritten-done').waitFor({ timeout: 8000 })
await page.waitForTimeout(400)
const done = await page.getByTestId('overwritten-done').innerText()
const d1 = A.table.find((r) => r.id === 'd1')
const keptNow = A.table.find((r) => r.bucket === 'draft.overwritten' && r.payload?.reason === 'restore')
check('5 되돌리기 → 원래 줄 = 그때 내용(PC) · 지금 내용(휴대폰)은 보관(restore)', d1.payload.draft.claims[0] === 'PC 에서 쓴 청구항' && keptNow?.payload?.data?.draft?.claims?.[0] === '휴대폰에서 고친 청구항', { d1: d1.payload, keptNow: keptNow?.payload })
check('5b 판 확인하며 덮음(updated_at 같을 때만) · 보관 줄에 되돌린 때', A.log.patch.some((x) => x.params.id === 'eq.d1' && /^eq\./.test(x.params.updated_at ?? '')) && !!A.table.find((r) => r.id === 'ow_d1_a').payload.restoredAt, A.log.patch.map((x) => x.params))
check('5c 끝 한 줄 — 되돌렸어요 · 바로 전 내용은 맨 위에 보관 · [열어 보기 →] 명세서', /되돌렸어요/.test(done) && /맨 위에 보관/.test(done) && (await page.getByTestId('overwritten-done').locator('a').getAttribute('href'))?.includes('/patent-venture/write?draft=d1'), done)
const top = await page.getByTestId('overwritten-item').first().innerText()
const restoredRow = page.getByTestId('overwritten-item').filter({ hasText: '다른 기기 저장에 덮임' }).filter({ hasText: '스마트 화분' })
check('5d 목록 다시 읽음 — 8개 · 맨 위 = 되돌리기 바로 전 내용 · 되돌린 판에 "이 내용으로 되돌림"', /덮인 내용 8개/.test(await panel.innerText()) && /되돌리기 바로 전 내용/.test(top) && /이 내용으로 되돌림/.test(await restoredRow.first().innerText()), top)
await page.screenshot({ path: `${SHOTS}/pc-done.png` })

// ---------- 6) 지워진 기록 되돌리기 → 다시 만듦 ----------
const gone = page.getByTestId('overwritten-item').filter({ hasText: '정책자금 상담 기록' }).first()
await gone.getByTestId('overwritten-restore').click()
await page.getByRole('dialog').getByRole('button', { name: '되돌리기' }).click()
await page.waitForTimeout(800)
const c9 = A.table.find((r) => r.id === 'c9')
check('6 지워진 기록 → 같은 id 로 다시 만듦(그때 메모) · 끝 한 줄 "다시 만들었어요"', c9?.bucket === 'consults' && c9?.payload?.memo === '지워진 상담 메모' && /다시 만들었어요/.test(await page.getByTestId('overwritten-done').innerText()), c9)
check('6b module_data 지우기 0', A.log.del.length === 0, A.log.del)

// ---------- 7) 보관된 것이 없으면 ----------
const E = await newCtx({ width: 1440, height: 900 }, { empty: true })
const ep = await E.ctx.newPage()
ep.on('pageerror', (e) => errors.push(String(e)))
await ep.goto(`${BASE}/settings?tab=data`, { waitUntil: 'networkidle' })
await ep.waitForTimeout(900)
check('7 보관된 것이 없으면 데이터 탭에 판 없음(첫 화면 짧게)', (await ep.getByTestId('overwritten-panel').count()) === 0 && (await ep.getByTestId('settings-export').count()) === 1)
await ep.goto(`${BASE}/settings?tab=data&focus=overwritten`, { waitUntil: 'networkidle' })
await ep.getByTestId('overwritten-empty').waitFor({ timeout: 5000 })
check('7b 알림 줄이 데려오면 "보관된 내용이 없어요" 한 줄', /보관된 내용이 없어요/.test(await ep.getByTestId('overwritten-empty').innerText()))
await E.ctx.close()

// ---------- 8) 팀장 설정 ----------
const P = await newCtx({ width: 1440, height: 900 }, { access: 'pilot' })
const pp = await P.ctx.newPage()
pp.on('pageerror', (e) => errors.push(String(e)))
await pp.goto(`${BASE}/settings`, { waitUntil: 'networkidle' })
await pp.waitForTimeout(1000)
check('8 팀장 설정(한 화면)에도 덮인 내용 판', (await pp.getByTestId('settings-pilot').count()) === 1 && (await pp.getByTestId('overwritten-panel').count()) === 1)
await P.ctx.close()

// ---------- 9) 휴대폰 390 ----------
const M = await newCtx({ width: 390, height: 844 })
const mp = await M.ctx.newPage()
mp.on('pageerror', (e) => errors.push(String(e)))
await mp.goto(`${BASE}/settings?tab=data&focus=overwritten`, { waitUntil: 'networkidle' })
await mp.getByTestId('overwritten-panel').waitFor({ timeout: 8000 })
await mp.waitForTimeout(600)
const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const rb = await mp.getByTestId('overwritten-restore').first().boundingBox()
check('9 휴대폰 390 — 가로 넘침 0 · [되돌리기] 40px 넘게 · 화면 안', over <= 0 && !!rb && rb.height >= 40 && rb.x + rb.width <= 390, { over, rb })
await mp.getByTestId('overwritten-item').first().getByTestId('overwritten-diff').locator('summary').click()
await mp.waitForTimeout(500)
await mp.screenshot({ path: `${SHOTS}/phone-panel.png` })
check('9b 휴대폰 펼친 뒤도 넘침 0', (await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0)
await M.ctx.close()

const realErrors = errors.filter((e) => !/tesseract\.js@.*worker\.min\.js/.test(e))
check('10 JS 오류 없음', realErrors.length === 0, realErrors.join(' | '))

await browser.close()
stop()
console.log(`\n덮인 내용 되돌리기(클라우드): ${pass} passed, ${fail} failed  (스크린샷: ${SHOTS})`)
if (fail > 0) process.exit(1)
