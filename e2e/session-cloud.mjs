/**
 * 로그인 · 작업공간 — 클라우드 시험 (D-223). Supabase 응답을 흉내 내고 진짜 화면을 연다.
 *
 *   1 탭을 다시 볼 때(라이브러리가 '로그인됨' 신호를 다시 보냄) — 다른 탭이 고른 작업공간(팀장)으로 이 탭이 옮겨 가지 않는다 ·
 *     그 사이 권한 확인이 실패해도 쓰던 화면이 '연결에 실패했습니다' 로 덮이지 않는다
 *   2 [최은혜 팀장] 을 눌렀다가 '이 페이지를 나가시겠습니까?' 에서 취소 → 화면도 저장도 대표 작업공간 그대로
 *   3 팀장 화면 — 팀장님이 이름을 저장하지 않았으면(서버 'Pilot') 사이드바 · 머리줄에 'Pilot' 대신 '팀장님'
 *   4 초대 링크(/join/코드)로 왔다가 로그인한 사람 → 그 초대 화면으로(예전: 홈)
 *
 *   node e2e/session-cloud.mjs            (dist-qa-session 으로 따로 빌드하고 4537 에 띄운다)
 */
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const REF = 'qaproject'
const PORT = 4537
const BASE = `http://localhost:${PORT}`
const OUT = 'dist-qa-session'
const SHOTS = process.env.SHOTS ?? join(tmpdir(), 'shots-session-cloud')
mkdirSync(SHOTS, { recursive: true })
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ' ' + JSON.stringify(detail)}`)
}

execSync(`npx vite build --outDir ${OUT} --emptyOutDir`, {
  stdio: 'ignore',
  env: { ...process.env, VITE_DATA_MODE: 'supabase', VITE_SUPABASE_URL: `https://${REF}.supabase.co`, VITE_SUPABASE_ANON_KEY: 'qa-anon' },
})
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
    const r = await fetch(BASE)
    if (r.ok) break
  } catch {
    /* 아직 */
  }
  await new Promise((r) => setTimeout(r, 250))
}

const WS = '11111111-1111-4111-8111-111111111111'
const WS2 = '22222222-2222-4222-8222-222222222222'
const OWNER = '00000000-0000-4000-8000-000000000001'
const PILOT = '00000000-0000-4000-8000-000000000002'
const session = {
  access_token: 'qa.' + Buffer.from(JSON.stringify({ sub: OWNER, role: 'authenticated', exp: 4102444800 })).toString('base64url') + '.sig',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  refresh_token: 'qa-refresh',
  user: { id: OWNER, aud: 'authenticated', role: 'authenticated', email: 'owner-test@miraeailab.com', app_metadata: {}, user_metadata: { name: '김상호' }, created_at: '2026-01-01T00:00:00Z' },
}
const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
const ONBOARD = '{"tutorialVersion":1,"autoShowEnabled":false,"firstSeenAt":"2026-01-01T00:00:00.000Z","lastShownDate":"2099-01-01","snoozedUntilDate":"2099-12-31","completedChapterIds":["system"],"lastOpenedChapterId":"system","selectedLearningPath":"ax","guideMode":"core","updatedAt":"2026-01-01T00:00:00.000Z"}'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/** o.ws: 처음 고른 작업공간 · o.accessDown: true 인 동안 권한 확인 500 */
async function open(o) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  await ctx.addInitScript(([ref, s, ws, onboard]) => {
    if (!sessionStorage.getItem('qa.inited')) {
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s))
      localStorage.setItem('axmvp.active_workspace', ws)
      localStorage.setItem('axmvp.onboarding.prefs', onboard)
      sessionStorage.setItem('qa.inited', '1')
    }
  }, [REF, session, o.ws, ONBOARD])
  const seen = { access: 0, user: 0, ws: [] }
  await ctx.route(`https://${REF}.supabase.co/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = decodeURIComponent(url.pathname)
    // 어느 작업공간을 읽는지 — 표 이름과 상관없이 workspace_id=eq.… 를 모은다
    const w = (url.searchParams.get('workspace_id') ?? '').replace(/^eq\./, '')
    if (path.includes('/rest/v1/') && w) seen.ws.push(w)
    if (path.endsWith('/auth/v1/token')) return route.fulfill(json(session))
    if (path.endsWith('/auth/v1/user')) {
      seen.user += 1
      return route.fulfill(json(session.user))
    }
    if (path.endsWith('/rest/v1/rpc/my_os_access')) {
      seen.access += 1
      if (o.accessDown) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'upstream connect error' }) })
      return route.fulfill(json('full'))
    }
    if (path.endsWith('/rest/v1/rpc/my_pilot_views')) return route.fulfill(json([{ workspace_id: WS2, workspace_name: '팀장 작업공간', person_name: 'Pilot', person_title: '' }]))
    if (path.endsWith('/rest/v1/rpc/my_capabilities')) return route.fulfill(json([]))
    if (path.includes('/rest/v1/workspace_members')) {
      return route.fulfill(json([
        { workspace_id: WS, user_id: OWNER, role: 'owner', workspaces: { id: WS, name: '미래AI랩', owner_id: OWNER, created_at: '2026-01-01T00:00:00Z' } },
        { workspace_id: WS2, user_id: OWNER, role: 'admin', workspaces: { id: WS2, name: '팀장 작업공간', owner_id: PILOT, created_at: '2026-02-01T00:00:00Z' } },
      ]))
    }
    if (path.includes('/rest/v1/workspaces')) return route.fulfill(json([{ id: WS, name: '미래AI랩', owner_id: OWNER, created_at: '2026-01-01T00:00:00Z' }]))
    return route.fulfill(json([]))
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  return { ctx, page, errors, seen }
}
const toggleVisibility = (page) =>
  page.evaluate(async () => {
    const set = (v) => {
      Object.defineProperty(document, 'visibilityState', { value: v, configurable: true })
      Object.defineProperty(document, 'hidden', { value: v === 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    set('hidden')
    await new Promise((r) => setTimeout(r, 300))
    set('visible')
  })
/** 새로 열지 않고 이 탭 안에서 다른 화면으로 */
const go = async (page, path) => {
  await page.evaluate((p) => {
    history.pushState({}, '', p)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await page.waitForTimeout(1200)
}
const ready = (page) => page.locator('aside').first().waitFor({ timeout: 20000 }).catch(() => {})

try {
  /* ---------- 1 탭을 다시 볼 때 ---------- */
  {
    const o = { ws: WS, accessDown: false }
    const { ctx, page, errors, seen } = await open(o)
    await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
    await ready(page)
    await page.waitForTimeout(800)
    const accessBefore = seen.access
    // 다른 탭에서 [최은혜 팀장] 을 누른 것처럼 — 고른 작업공간이 팀장 쪽으로 바뀌고, 권한 확인도 잠깐 끊긴다
    await page.evaluate((ws2) => localStorage.setItem('axmvp.active_workspace', ws2), WS2)
    o.accessDown = true
    await toggleVisibility(page)
    // 다른 탭이 열리거나 토큰을 새로 받으면 라이브러리가 탭끼리 '로그인됨' 을 알린다 — 그 알림을 그대로 흉내
    await page.evaluate(([ref, s]) => new BroadcastChannel(`sb-${ref}-auth-token`).postMessage({ event: 'SIGNED_IN', session: s }), [REF, session])
    await page.waitForTimeout(2500)
    const body = (await page.locator('body').innerText()) ?? ''
    check('D-223 1 다시 볼 때 시작 확인을 처음부터 다시 돌리지 않음(권한 확인 요청 늘지 않음)', seen.access === accessBefore, { accessBefore, after: seen.access })
    check('D-223 1 권한 확인이 끊겨도 쓰던 화면 그대로(연결 실패 화면으로 덮이지 않음 · 사이드바 있음)', !body.includes('연결에 실패') && !body.includes('작업공간 정보를 불러오지 못했습니다') && (await page.locator('aside').count()) > 0, body.slice(0, 160))
    await page.screenshot({ path: join(SHOTS, 'd223-after-signal.png') })
    check('D-223 1 다른 탭이 팀장 작업공간을 골라도 이 탭은 대표 화면(팀장 화면 띠 없음)', (await page.getByTestId('viewing-pilot').count()) === 0)
    // 이 탭 안에서 다른 화면으로 갔다 오면 → 읽는 작업공간도 그대로
    seen.ws.length = 0
    await go(page, '/money')
    await go(page, '/ops/clients/new')
    check('D-223 1 그 뒤 이 탭에서 읽는 자료도 대표 작업공간(팀장 작업공간을 읽지 않음)', seen.ws.length > 0 && seen.ws.every((w) => w === WS), [...new Set(seen.ws)])
    check('D-223 1 JS 오류 없음', errors.length === 0, errors)
    await ctx.close()
  }

  /* ---------- 1b 권한 확인이 멀쩡해도 — 다른 탭이 고른 팀장 작업공간으로 조용히 옮겨 가지 않는다 ---------- */
  {
    const { ctx, page, errors, seen } = await open({ ws: WS, accessDown: false })
    await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
    await ready(page)
    await page.waitForTimeout(800)
    await page.evaluate((ws2) => localStorage.setItem('axmvp.active_workspace', ws2), WS2)
    await page.evaluate(([ref, s]) => new BroadcastChannel(`sb-${ref}-auth-token`).postMessage({ event: 'SIGNED_IN', session: s }), [REF, session])
    await page.waitForTimeout(2000)
    seen.ws.length = 0
    await go(page, '/money')
    check('D-223 1b 다른 탭이 팀장 작업공간을 고른 뒤 신호가 와도 — 팀장 화면 띠 없음 · 이 탭은 대표 자료만 읽음(예전: 새로 열지 않은 채 팀장 작업공간으로)', (await page.getByTestId('viewing-pilot').count()) === 0 && seen.ws.length > 0 && seen.ws.every((w) => w === WS), [...new Set(seen.ws)])
    check('D-223 1b JS 오류 없음', errors.length === 0, errors)
    await ctx.close()
  }

  /* ---------- 2 [최은혜 팀장] → '나가시겠습니까?' 에서 취소 ---------- */
  {
    const { ctx, page, errors, seen } = await open({ ws: WS })
    // D-296 대표 ↔ 팀장 전환은 설정 › 계정 · 보기에서만(머리줄 단추는 없앴다)
    await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
    await ready(page)
    await page.waitForTimeout(800)
    // 저장하지 않은 글이 있는 화면처럼
    await page.evaluate(() => window.addEventListener('beforeunload', (e) => { e.preventDefault(); e.returnValue = '' }))
    await page.locator('body').click({ position: { x: 700, y: 400 } })
    let asked = 0
    page.on('dialog', (d) => {
      asked += 1
      void d.dismiss()
    })
    await page.locator('[data-testid="settings-view-as"] [data-testid="view-as-switch"] [data-view="pilot"]').first().click()
    await page.waitForTimeout(1500)
    seen.ws.length = 0
    await go(page, '/money')
    await go(page, '/ops/clients/new')
    check('D-223 2 [최은혜 팀장] → 나가기 확인 창이 떴고 [취소]', asked >= 1, asked)
    check('D-223 2 취소하면 이 화면은 대표 작업공간 그대로(팀장 화면 띠 없음 · 읽는 자료도 대표 쪽)', (await page.getByTestId('viewing-pilot').count()) === 0 && seen.ws.length > 0 && seen.ws.every((w) => w === WS), [...new Set(seen.ws)])
    check('D-223 2 JS 오류 없음', errors.length === 0, errors)
    await ctx.close()
  }

  /* ---------- 3 팀장 화면 — 이름을 저장하지 않은 팀장 ---------- */
  {
    const { ctx, page, errors } = await open({ ws: WS2 })
    await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
    await ready(page)
    await page.waitForTimeout(800)
    await page.screenshot({ path: join(SHOTS, 'd223-pilot-view-name.png') })
    const side = (await page.locator('aside').first().innerText()) ?? ''
    const head = (await page.locator('header').first().innerText()) ?? ''
    check('D-223 3 팀장 화면 — 사이드바 · 머리줄에 "Pilot" 대신 "팀장님"', !/\bPilot\b/.test(side) && !/\bPilot\b/.test(head) && (side + head).includes('팀장님'), { side: side.slice(-80), head: head.slice(0, 160) })
    check('D-223 3 JS 오류 없음', errors.length === 0, errors)
    await ctx.close()
  }

  /* ---------- 4 초대 링크로 왔다가 로그인 ---------- */
  {
    const { ctx, page, errors } = await open({ ws: WS })
    await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
    await ready(page)
    await page.evaluate(() => sessionStorage.setItem('axmvp.pending_invite', 'qa-invite-123'))
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    const body = (await page.locator('body').innerText()) ?? ''
    check('D-223 4 초대 링크로 왔던 사람이 로그인 화면에 오면 → 그 초대 화면(/join/코드)', page.url().endsWith('/join/qa-invite-123') && body.includes('작업공간 초대'), page.url())
    check('D-223 4 JS 오류 없음', errors.length === 0, errors)
    await ctx.close()
  }
} finally {
  await browser.close()
  stop()
}
console.log(`\nsession-cloud: ${pass} passed, ${fail} failed  (스크린샷: ${SHOTS})`)
process.exit(fail ? 1 : 0)
