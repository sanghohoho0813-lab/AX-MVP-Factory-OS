/**
 * qa:draftcloud — D-513 쓰던 글 다른 기기에서 이어 쓰기(클라우드 흉내 — 서버 한 벌을 PC · 휴대폰 두 기기가 같이 쓴다).
 *
 *   C1 PC 스레드에 글을 쓰면 잠깐 뒤 클라우드 한 줄(marketing / drafts · mkdraft_threads_<작업공간>)에 올라감 · 기기 PC
 *   C2 휴대폰(빈 브라우저)에서 스레드를 열면 PC 글이 그대로 · '다른 기기에서 쓰던 글을 이어서 열었어요 · … PC' · 되돌리기 없음(이 기기 글이 비어 있었음)
 *   C3 휴대폰에서 고치면 다시 올라감 · 기기 휴대폰
 *   C4 PC 로 돌아오면(창 다시 보임) 휴대폰 글로 · [이 기기 글로 되돌리기] → PC 글로 돌아오고 다시 올라감
 *   C5 인터넷이 끊기면(저장 500) '이 기기에만 남겼어요' 한 줄 · 새로 고쳐도(읽기도 실패) 글은 그대로 · 다시 되면 올라가고 한 줄 사라짐
 *   C6 주소로 주제를 들고 오면(?topic=) 클라우드 글로 바꾸지 않고 그 주제 글을 올림
 *   C7 릴스/틱톡 대본도 같은 길(PC → 휴대폰)
 *   C8 참고 글(남의 글)은 클라우드에 올라가지 않음 · 휴대폰 390 넘침 0 · JS 오류 0
 *   C9 (D-551) 시계가 1시간 빠른 PC — 휴대폰이 그 뒤 고친 글을 PC 로 돌아와도 예전 글로 덮지 않고 휴대폰 글을 가져옴 ·
 *      PC 가 서버와의 시계 차이(-1시간)를 재 두고, 그 뒤 적은 시각은 서버 시계로 맞춰 남김
 *   (흉내 서버는 저장할 때 updated_at 을 서버 시각으로 바꾼다 — 진짜 DB 트리거처럼)
 *
 *   node e2e/draft-cloud.mjs            (dist-qa-draft 로 따로 빌드하고 4537 에 띄운다)
 */
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'

const REF = 'qaproject'
/** SHOTS=폴더 를 주면 알림 · 실패 한 줄을 찍어 둔다(눈 확인용) */
const SHOTS = process.env.SHOTS ?? ''
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }).catch(() => {})
}
const PORT = 4537
const BASE = `http://localhost:${PORT}`
const OUT = 'dist-qa-draft'
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ' ' + JSON.stringify(detail).slice(0, 600)}`)
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
const OWNER = '00000000-0000-4000-8000-000000000001'
const session = {
  access_token: 'qa.' + Buffer.from(JSON.stringify({ sub: OWNER, role: 'authenticated', exp: 4102444800 })).toString('base64url') + '.sig',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 4102444800,
  refresh_token: 'qa-refresh',
  user: { id: OWNER, aud: 'authenticated', role: 'authenticated', email: 'owner-test@miraeailab.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
}
const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

/** 서버 한 벌 — 두 기기가 같이 쓴다. down 이면 module_data 읽기 · 쓰기 모두 500 */
const cloud = { rows: new Map(), down: false, writes: [], lastAt: 0 }
const draftRow = (kind) => cloud.rows.get(`mkdraft_${kind}_${WS}`)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

async function device(vp, mobile, skewMs = 0) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'ko-KR', isMobile: mobile, hasTouch: mobile })
  // D-551 기기 시계가 틀린 기기 — 이 기기의 Date 만 skewMs 만큼 어긋나게
  if (skewMs) {
    await ctx.addInitScript((off) => {
      const RealDate = Date
      class SkewDate extends RealDate {
        constructor(...a) {
          if (a.length === 0) super(RealDate.now() + off)
          else super(...a)
        }
        static now() {
          return RealDate.now() + off
        }
      }
      globalThis.Date = SkewDate
    }, skewMs)
  }
  await ctx.addInitScript(([ref, s, ws]) => {
    if (!localStorage.getItem(`sb-${ref}-auth-token`)) localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s))
    localStorage.setItem('axmvp.active_workspace', ws)
    localStorage.setItem('axmvp.onboarding.prefs', '{"tutorialVersion":1,"autoShowEnabled":false,"firstSeenAt":"2026-01-01T00:00:00.000Z","lastShownDate":"2099-01-01","snoozedUntilDate":"2099-12-31","completedChapterIds":["system"],"lastOpenedChapterId":"system","selectedLearningPath":"ax","guideMode":"core","updatedAt":"2026-01-01T00:00:00.000Z"}')
  }, [REF, session, WS])
  await ctx.route(`https://${REF}.supabase.co/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = decodeURIComponent(url.pathname)
    const method = req.method()
    if (path.endsWith('/auth/v1/token')) return route.fulfill(json(session))
    if (path.endsWith('/auth/v1/user')) return route.fulfill(json(session.user))
    if (path.endsWith('/rest/v1/rpc/my_os_access')) return route.fulfill(json('full'))
    if (path.includes('/rest/v1/workspace_members')) {
      return route.fulfill(json([{ workspace_id: WS, user_id: OWNER, role: 'owner', workspaces: { id: WS, name: '미래AI랩', owner_id: OWNER, created_at: '2026-01-01T00:00:00Z' } }]))
    }
    if (path.includes('/rest/v1/workspaces')) return route.fulfill(json([{ id: WS, name: '미래AI랩', owner_id: OWNER, created_at: '2026-01-01T00:00:00Z' }]))
    if (path.includes('/rest/v1/module_data')) {
      const bucket = (url.searchParams.get('bucket') ?? '').replace(/^eq\./, '')
      if (cloud.down) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'upstream connect error' }) })
      if (method === 'GET') return route.fulfill(json([...cloud.rows.values()].filter((r) => !bucket || r.bucket === bucket)))
      if (method === 'POST') {
        const body = JSON.parse(req.postData() ?? '{}')
        const row = Array.isArray(body) ? body[0] : body
        // 진짜 DB 처럼 서버 시각(트리거) — 기기 시계와 상관없이
        const serverNow = new Date(Math.max(Date.now(), cloud.lastAt + 1)).toISOString()
        cloud.lastAt = Date.parse(serverNow)
        const one = { ...row, updated_at: serverNow, created_at: cloud.rows.get(row.id)?.created_at ?? serverNow }
        cloud.rows.set(row.id, one)
        cloud.writes.push({ bucket: row.bucket, id: row.id, payload: row.payload })
        return route.fulfill(json(/object/.test(req.headers().accept ?? '') ? one : [one]))
      }
      return route.fulfill(json([]))
    }
    return route.fulfill(json([]))
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  return { ctx, page, errors }
}

/** 창을 숨겼다가 다시 보이게 — 다른 앱에 갔다 돌아온 것처럼 */
const refocus = (page) =>
  page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
const waitFor = async (fn, ms = 6000) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await fn()) return true
    await new Promise((r) => setTimeout(r, 150))
  }
  return false
}
const openThreads = async (page, q = '') => {
  await page.goto(`${BASE}/marketing/threads${q}`, { waitUntil: 'networkidle' })
  await page.getByTestId('thr-write').waitFor({ timeout: 15000 })
}
const startHand = async (page) => {
  if ((await page.getByTestId('thr-body').count()) === 0) await page.getByTestId('thr-hand').click()
  await page.getByTestId('thr-body').waitFor()
}

const errorsAll = []
try {
  const pc = await device({ width: 1440, height: 900 }, false)
  const ph = await device({ width: 390, height: 844 }, true)

  // C1
  await openThreads(pc.page)
  await startHand(pc.page)
  const PC_TEXT = 'PC 에서 쓰던 글 — 정책자금 바뀌는 점 세 가지'
  await pc.page.getByTestId('thr-body').fill(PC_TEXT)
  const up1 = await waitFor(() => draftRow('threads')?.payload?.draft?.body === PC_TEXT)
  check('C1 PC 에서 쓰면 잠깐 뒤 클라우드 한 줄에 올라감 · 기기 PC · 행 id 에 작업공간', up1 && draftRow('threads')?.payload?.device === 'pc' && draftRow('threads')?.bucket === 'drafts' && draftRow('threads')?.module_key === 'marketing', draftRow('threads'))

  // C2
  await openThreads(ph.page)
  await ph.page.getByTestId('thr-body').waitFor({ timeout: 8000 }).catch(() => {})
  const phBody = await ph.page.getByTestId('thr-body').inputValue().catch(() => '')
  const note = await ph.page.getByTestId('thr-sync-note').innerText().catch(() => '')
  await shot(ph.page, 'draft-phone-note')
  check('C2 휴대폰(빈 브라우저)에서 열면 PC 글이 그대로 · 이어서 열었어요 · PC · 되돌리기 없음', phBody === PC_TEXT && /다른 기기에서 쓰던 글을 이어서 열었어요 · .* PC/.test(note) && (await ph.page.getByTestId('thr-sync-undo').count()) === 0, { phBody, note })

  // C3
  const PH_TEXT = PC_TEXT + '\n휴대폰에서 덧붙인 줄'
  await ph.page.getByTestId('thr-body').fill(PH_TEXT)
  const up3 = await waitFor(() => draftRow('threads')?.payload?.draft?.body === PH_TEXT)
  check('C3 휴대폰에서 고치면 다시 올라감 · 기기 휴대폰', up3 && draftRow('threads')?.payload?.device === 'phone', draftRow('threads')?.payload)

  // C4
  await refocus(pc.page)
  const got4 = await waitFor(async () => (await pc.page.getByTestId('thr-body').inputValue()) === PH_TEXT)
  const note4 = await pc.page.getByTestId('thr-sync-note').innerText().catch(() => '')
  const undo4 = await pc.page.getByTestId('thr-sync-undo').count()
  await shot(pc.page, 'draft-pc-note')
  check('C4a PC 로 돌아오면 휴대폰 글로 · 휴대폰 표시 · [이 기기 글로 되돌리기]', got4 && /이어서 열었어요 · .* 휴대폰/.test(note4) && undo4 === 1, { note4, undo4 })
  await pc.page.getByTestId('thr-sync-undo').click()
  const back = await pc.page.getByTestId('thr-body').inputValue()
  const up4 = await waitFor(() => draftRow('threads')?.payload?.draft?.body === PC_TEXT && draftRow('threads')?.payload?.device === 'pc')
  check('C4b [되돌리기] → PC 글로 돌아오고 다시 올라감 · 알림 닫힘', back === PC_TEXT && up4 && (await pc.page.getByTestId('thr-sync-note').count()) === 0, { back })

  // C5
  cloud.down = true
  const OFF_TEXT = PC_TEXT + '\n인터넷이 끊긴 사이 적은 줄'
  await pc.page.getByTestId('thr-body').fill(OFF_TEXT)
  const failShown = await waitFor(async () => (await pc.page.getByTestId('thr-sync-failed').count()) === 1)
  const failText = await pc.page.getByTestId('thr-sync-failed').innerText().catch(() => '')
  await shot(pc.page, 'draft-pc-failed')
  check('C5a 저장 실패 → \'이 기기에만 남겼어요\' 한 줄 · 클라우드는 예전 글', failShown && /이 기기에만 남겼어요/.test(failText) && draftRow('threads')?.payload?.draft?.body === PC_TEXT, failText)
  await pc.page.reload({ waitUntil: 'networkidle' })
  await pc.page.getByTestId('thr-write').waitFor()
  await pc.page.getByTestId('thr-body').waitFor()
  const kept = await pc.page.getByTestId('thr-body').inputValue()
  check('C5b 새로 고쳐도(클라우드 읽기도 실패) 적은 글 그대로', kept === OFF_TEXT && (await pc.page.getByTestId('thr-sync-failed').count()) === 1, kept.slice(-20))
  cloud.down = false
  await pc.page.getByTestId('thr-body').fill(OFF_TEXT + '.')
  const up5 = await waitFor(() => draftRow('threads')?.payload?.draft?.body === OFF_TEXT + '.')
  const gone = await waitFor(async () => (await pc.page.getByTestId('thr-sync-failed').count()) === 0)
  check('C5c 다시 되면 올라가고 한 줄 사라짐', up5 && gone)

  // C6
  const before6 = draftRow('threads')?.payload?.draft?.body
  await openThreads(ph.page, '?topic=' + encodeURIComponent('고용지원금 신청 시기'))
  await ph.page.waitForTimeout(1500)
  const phBody6 = await ph.page.getByTestId('thr-body').inputValue().catch(() => '')
  const up6 = await waitFor(() => draftRow('threads')?.payload?.draft?.topic === '고용지원금 신청 시기')
  check('C6 주소로 주제를 들고 오면 클라우드 글로 바꾸지 않고 그 주제 글을 올림', before6 === OFF_TEXT + '.' && phBody6 !== OFF_TEXT + '.' && up6 && (await ph.page.getByTestId('thr-sync-note').count()) === 0, { phBody6: phBody6.slice(0, 30), topic: draftRow('threads')?.payload?.draft?.topic })

  // C7 릴스/틱톡
  await pc.page.goto(`${BASE}/marketing/shorts`, { waitUntil: 'networkidle' })
  await pc.page.getByTestId('sht-hand').click()
  const SH = '[0:00] PC 에서 쓴 대본 첫마디'
  await pc.page.getByTestId('sht-script').fill(SH)
  const up7 = await waitFor(() => draftRow('shorts')?.payload?.draft?.script === SH)
  await ph.page.goto(`${BASE}/marketing/shorts`, { waitUntil: 'networkidle' })
  await ph.page.getByTestId('sht-script').waitFor({ timeout: 8000 }).catch(() => {})
  const phSh = await ph.page.getByTestId('sht-script').inputValue().catch(() => '')
  check('C7 릴스/틱톡 대본도 PC → 클라우드 → 휴대폰 · 이어서 열었어요', up7 && phSh === SH && (await ph.page.getByTestId('sht-sync-note').count()) === 1, { phSh })

  // C8
  await openThreads(pc.page)
  if ((await pc.page.getByTestId('thr-choose').getAttribute('data-open')) !== '1') await pc.page.getByTestId('thr-choose').locator('button').first().click()
  await pc.page.getByTestId('thr-ref-box').locator('summary').click()
  const REF_TEXT = '남의 잘 된 글 — 올라가면 안 됨'
  await pc.page.getByTestId('thr-ref-box').locator('textarea').fill(REF_TEXT)
  await pc.page.getByTestId('thr-body').fill('참고 글 시험 본문')
  await waitFor(() => draftRow('threads')?.payload?.draft?.body === '참고 글 시험 본문')
  const leaked = cloud.writes.some((w) => JSON.stringify(w.payload).includes(REF_TEXT))
  const geo = await ph.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('C8a 참고 글(남의 글)은 클라우드에 올라가지 않음', !leaked)
  check('C8b 휴대폰 390 넘침 0', geo <= 0, geo)
  errorsAll.push(...pc.errors, ...ph.errors)

  // C9 D-551 시계가 1시간 빠른 PC(A) · 맞는 휴대폰(B) — 새 브라우저 둘
  const HOUR = 3600 * 1000
  const A = await device({ width: 1440, height: 900 }, false, HOUR)
  const B = await device({ width: 390, height: 844 }, true)
  await openThreads(A.page)
  await startHand(A.page)
  const A_TEXT = '시계 빠른 PC 에서 쓴 글'
  await A.page.getByTestId('thr-body').fill(A_TEXT)
  const upA = await waitFor(() => draftRow('threads')?.payload?.draft?.body === A_TEXT)
  const atA = draftRow('threads')?.payload?.at ?? ''
  await openThreads(B.page)
  await B.page.getByTestId('thr-body').waitFor({ timeout: 8000 }).catch(() => {})
  const B_TEXT = A_TEXT + '\n휴대폰이 그 뒤 고친 줄'
  await B.page.getByTestId('thr-body').fill(B_TEXT)
  const upB = await waitFor(() => draftRow('threads')?.payload?.draft?.body === B_TEXT)
  const atB = draftRow('threads')?.payload?.at ?? ''
  await refocus(A.page)
  const gotB = await waitFor(async () => (await A.page.getByTestId('thr-body').inputValue()) === B_TEXT)
  await A.page.waitForTimeout(1500)
  check('C9a 시계가 1시간 빠른 PC 로 돌아와도 휴대폰이 그 뒤 고친 글을 가져옴(예전 글로 덮지 않음 · 클라우드도 휴대폰 글)',
    upA && upB && gotB && draftRow('threads')?.payload?.draft?.body === B_TEXT && atA > atB, { upA, upB, gotB, atA, atB, now: draftRow('threads')?.payload?.draft?.body?.slice(-12) })
  const skewA = Number(await A.page.evaluate(() => localStorage.getItem('axmvp.clock.skew.v1')))
  check('C9b PC 가 서버와의 시계 차이를 잼(약 -1시간)', Math.abs(skewA + HOUR) < 10000, skewA)
  await A.page.getByTestId('thr-body').fill(B_TEXT + '\nPC 가 덧붙인 줄')
  await waitFor(() => /PC 가 덧붙인 줄/.test(draftRow('threads')?.payload?.draft?.body ?? ''))
  const atA2 = Date.parse(draftRow('threads')?.payload?.at ?? '')
  check('C9c 그 뒤 PC 가 적은 시각은 서버 시계로 맞춰 남김(실제 시각과 1분 안)', Math.abs(atA2 - Date.now()) < 60000, { at: draftRow('threads')?.payload?.at, real: new Date().toISOString() })
  errorsAll.push(...A.errors, ...B.errors)
  check('C8c JS 오류 0', errorsAll.length === 0, errorsAll.slice(0, 3))
} catch (e) {
  check('시험이 끝까지 돌았다', false, String(e).slice(0, 400))
} finally {
  await browser.close()
  stop()
}
console.log(`\nqa:draftcloud: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
