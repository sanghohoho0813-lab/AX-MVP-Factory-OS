/**
 * 콘텐츠 레이더 — 클라우드 저장 시험 (D-222). 브라우저 저장 모드는 읽기가 실패하지 않아서
 * Supabase 를 흉내 낸 응답으로 진짜 화면의 단추를 누른다.
 *
 *   설정(radar_prefs)을 못 읽음 → 노란 띠 · [관심 없음] 을 눌러도 저장하지 않음(예전: 빈 설정으로 통째로 덮음)
 *   [다시 읽기] → 저장해 둔 설정(비중 60/25/15) 그대로 · 그 위에 숨긴 주제만 더해 저장
 *   수첩 목록을 못 읽음 → 담기를 막음(예전: 빈 목록으로 보고 또 담음)
 *   [이번 주로 확정] 을 빠르게 두 번 → 수첩에 한 줄(예전: 두 줄)
 *
 *   node e2e/radar-cloud.mjs            (dist-qa-radar 로 따로 빌드하고 4536 에 띄운다)
 */
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const REF = 'qaproject'
const PORT = 4536
const BASE = `http://localhost:${PORT}`
const OUT = 'dist-qa-radar'
const SHOTS = process.env.SHOTS ?? join(tmpdir(), 'shots-radar-cloud')
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

/* 레이더 데이터 — e2e/youtube.mjs 의 네 묶음 데이터와 같은 모양(후보 1 · 2 · 3 이 나오게) */
const H = 3_600_000
const D = 24 * H
const NOW = Date.now()
const iso = (ago) => new Date(NOW - ago).toISOString()
const ch = (id, title, subs, group, mine = false) => ({ id, handle: `@${id}`, title, customUrl: `@${id}`, thumb: '', subs, videoCount: 120, views: subs * 80, mine, group })
const v = (id, c, t, ago, views, d = 700) => ({ id, ch: c, t, at: iso(ago), d, v: views, l: Math.round(views * 0.03), c: Math.round(views * 0.004) })
const base = (c, n, views, from = 10) => Array.from({ length: n }, (_, i) => v(`${c}_b${i}`, c, `${c} 평범한 이야기 ${i}`, (from + i * 3) * D, views + i))
const REV = '2-8-radarcloud'
const RADAR = {
  fetchedAt: new Date(NOW - H).toISOString(),
  feedRevision: REV,
  channels: [
    ch('UCme', '김팀장의 경영노트', 8_000, 'direct', true), ch('UCd1', '정책 소식 채널', 30_000, 'direct'), ch('UCd2', '세무 이야기 채널', 120_000, 'direct'), ch('UCd3', '사장님 지원금 채널', 8_000, 'direct'),
    ch('UCa1', 'AI 실무 채널 하나', 9_000, 'ai'), ch('UCa2', 'AI 실무 채널 둘', 40_000, 'ai'), ch('UCx1', '자동화 채널', 20_000, 'ax'), ch('UCf1', '포맷 채널', 500_000, 'format'),
  ],
  videos: [
    ...base('UCme', 8, 300), ...base('UCd1', 8, 3_000), ...base('UCd2', 8, 12_000), ...base('UCd3', 8, 800), ...base('UCa1', 8, 900), ...base('UCa2', 8, 4_000), ...base('UCx1', 8, 2_000), ...base('UCf1', 8, 50_000),
    v('r1', 'UCd1', '정책자금 신청 전에 꼭 볼 것', 5 * D, 9_000), v('r2', 'UCd1', '지원사업 공고 정리', 9 * D, 3_100),
    v('r3', 'UCd2', '정책자금 떨어지는 회사 특징', 6 * D, 18_000), v('r4', 'UCd2', '법인세 절세 3가지', 8 * D, 50_000),
    v('r5', 'UCd3', '정책자금 오픈런 마감 이유', 4 * D, 4_000), v('r6', 'UCd3', '지원사업 사업계획서 핵심', 11 * D, 900),
    v('r15', 'UCd1', '절세 놓치면 손해 보는 이유', 7 * D, 8_000), v('r16', 'UCd3', '세금 신고 전에 확인할 것', 6 * D, 2_600),
    v('r7', 'UCa1', 'Claude로 보고서 10분 만에', 3 * D, 5_400), v('r8', 'UCa1', 'ChatGPT 업무 자동화 해봤습니다', 9 * D, 1_000),
    v('r9', 'UCa2', 'Claude 업무 활용 실제 후기', 5 * D, 8_000), v('r10', 'UCa2', 'n8n 자동화 처음이면', 12 * D, 4_100),
    v('r11', 'UCx1', '업무자동화 실제로 얼마나 줄까', 8 * D, 6_000), v('r12', 'UCx1', 'Claude 사내 시스템 만들기', 10 * D, 2_100),
    v('r13', 'UCf1', '정책자금 인터뷰 대표 이야기', 7 * D, 60_000), v('r14', 'UCme', '정책자금 설명만 잘하면 받던 시대', 6 * D, 700),
  ],
  failed: [],
}

/** 대표가 예전에 저장해 둔 설정 — 비중을 바꿔 두었다(빈 설정으로 덮이면 45/35/20 으로 돌아간다) */
const SAVED_MIX = { market: 60, axai: 25, bridge: 15 }
const PREFS_ID = `radarprefs_${WS}`

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/**
 * 서버 흉내. o.prefsDown / o.ideasDown 이 true 인 동안 그 묶음 읽기는 500.
 * o.ideaDelay 만큼 수첩 저장 응답을 늦춘다(두 번 누르기 시험).
 */
async function open(vp, o) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'ko-KR' })
  await ctx.addInitScript(([ref, s, ws]) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s))
    localStorage.setItem('axmvp.active_workspace', ws)
    localStorage.setItem('axmvp.onboarding.prefs', '{"tutorialVersion":1,"autoShowEnabled":false,"firstSeenAt":"2026-01-01T00:00:00.000Z","lastShownDate":"2099-01-01","snoozedUntilDate":"2099-12-31","completedChapterIds":["system"],"lastOpenedChapterId":"system","selectedLearningPath":"ax","guideMode":"core","updatedAt":"2026-01-01T00:00:00.000Z"}')
  }, [REF, session, WS])
  const writes = []
  const reads = { prefs: 0, ideas: 0 }
  const ideas = new Map()
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
      const bucket = url.searchParams.get('bucket') ?? ''
      if (method === 'GET' && bucket === 'eq.radar_prefs') {
        reads.prefs += 1
        if (o.prefsDown) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'upstream connect error' }) })
        return route.fulfill(json([{ id: PREFS_ID, workspace_id: WS, module_key: 'marketing', bucket: 'radar_prefs', client_id: null, payload: { overrides: {}, added: [], mix: SAVED_MIX, muted: [] }, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' }]))
      }
      if (method === 'GET' && bucket === 'eq.ideas') {
        reads.ideas += 1
        if (o.ideasDown) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'upstream connect error' }) })
        return route.fulfill(json([...ideas.values()]))
      }
      if (method === 'POST') {
        const body = JSON.parse(req.postData() ?? '{}')
        const row = Array.isArray(body) ? body[0] : body
        writes.push({ bucket: row.bucket, id: row.id, payload: row.payload })
        if (row.bucket === 'ideas') {
          if (o.ideaDelay) await new Promise((r) => setTimeout(r, o.ideaDelay))
          ideas.set(row.id, { ...row, created_at: row.updated_at })
        }
        const one = { ...row, created_at: row.updated_at }
        return route.fulfill(json(/object/.test(req.headers().accept ?? '') ? one : [one]))
      }
      return route.fulfill(json([]))
    }
    return route.fulfill(json([]))
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 404, body: '' }))
  await page.route('**/api/yt-bench**', (r) => {
    const u = new URL(r.request().url())
    if (u.searchParams.has('status')) return r.fulfill(json({ configured: true, keyName: 'YOUTUBE_API_KEY', channels: RADAR.channels.length, feedRevision: REV }))
    return r.fulfill(json({ ...RADAR, fetchedAt: new Date().toISOString() }))
  })
  await page.goto(BASE + '/marketing/youtube', { waitUntil: 'networkidle' })
  await page.getByTestId('radar-plan').waitFor({ timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(600)
  return { ctx, page, errors, writes, reads, o }
}
const prefsWrites = (w) => w.filter((x) => x.bucket === 'radar_prefs')
const ideaWrites = (w) => w.filter((x) => x.bucket === 'ideas')
const toastText = async (page) => (await page.locator('[role="status"], [data-testid="toast"]').allInnerTexts().catch(() => [])).join(' ')

try {
  /* ---------- 1 · 2 설정을 못 읽음 → 띠 · 저장 안 함 → 다시 읽기 → 저장해 둔 설정 위에 ---------- */
  // ONLY=notebook — 수첩 시험(3 · 4)만(예전 코드로 되돌려 빨간불을 볼 때)
  for (const [label, vp] of process.env.ONLY === 'notebook' ? [] : [['PC 1440', { width: 1440, height: 900 }], ['휴대폰 390', { width: 390, height: 844 }]]) {
    const { ctx, page, errors, writes, reads, o } = await open(vp, { prefsDown: true })
    const banner = page.getByTestId('radar-prefs-failed')
    check(`D-222 1 ${label}: 설정 읽기 실패 → 노란 띠 "설정을 읽지 못했습니다" + [다시 읽기]`, (await banner.isVisible().catch(() => false)) && ((await banner.innerText().catch(() => '')) ?? '').includes('읽지 못했습니다') && (await page.getByTestId('radar-prefs-retry').count()) === 1, reads)
    await page.screenshot({ path: join(SHOTS, `d222-prefs-failed-${vp.width}.png`), fullPage: false })

    const sub = page.locator('[data-testid="radar-opp"][data-size="sub"]').first()
    await sub.getByTestId('radar-opp-more').click()
    await page.waitForTimeout(200)
    await sub.getByTestId('radar-mute').click()
    await page.waitForTimeout(500)
    const t = await toastText(page)
    check(`D-222 1 ${label}: 못 읽은 채 [관심 없음] → 저장 요청 0(예전: 빈 설정으로 덮어 비중 · 더한 채널 · 숨긴 주제가 사라짐) · 안내`, prefsWrites(writes).length === 0 && t.includes('읽지 못했습니다'), { writes: prefsWrites(writes).length, t })

    o.prefsDown = false
    await page.getByTestId('radar-prefs-retry').click()
    await page.waitForTimeout(800)
    check(`D-222 2 ${label}: [다시 읽기] → 띠 사라짐 · 다시 읽음`, (await banner.count()) === 0 && reads.prefs >= 2, reads)

    const sub2 = page.locator('[data-testid="radar-opp"][data-size="sub"]').first()
    const topic = ((await sub2.getByTestId('radar-opp-topic').innerText()) ?? '').trim()
    // 첫 번째 [관심 없음] 이 막혔으니 같은 카드가 펼쳐진 채로 있다
    if (!(await sub2.getByTestId('radar-mute').isVisible().catch(() => false))) await sub2.getByTestId('radar-opp-more').click()
    await page.waitForTimeout(200)
    await sub2.getByTestId('radar-mute').click()
    await page.waitForTimeout(800)
    const pw = prefsWrites(writes)
    const last = pw[pw.length - 1]?.payload
    check(`D-222 2 ${label}: 다시 읽은 뒤 [관심 없음] → 저장해 둔 비중(60/25/15) 그대로 + 숨긴 주제 1`, pw.length === 1 && JSON.stringify(last?.mix) === JSON.stringify(SAVED_MIX) && last?.muted?.length === 1 && ((await page.getByTestId('radar-muted-chip').innerText().catch(() => '')) ?? '').includes('1'), { topic, last })
    check(`D-222 1~2 ${label}: JS 오류 없음`, errors.length === 0, errors)
    await ctx.close()
  }

  /* ---------- 3 수첩 목록을 못 읽음 → 담기 막음 ---------- */
  {
    const { ctx, page, errors, writes } = await open({ width: 1440, height: 900 }, { ideasDown: true })
    await page.locator('[data-testid="radar-opp"][data-size="hero"]').getByTestId('radar-confirm').click()
    await page.waitForTimeout(600)
    const t = await toastText(page)
    check('D-222 3 수첩 목록을 못 읽음 → [이번 주로 확정] 저장 요청 0 · "내 콘텐츠를 읽지 못했습니다 — 새로고침"(예전: 빈 목록으로 보고 이미 있는 주제를 또 담음)', ideaWrites(writes).length === 0 && t.includes('내 콘텐츠를 읽지 못했습니다'), { n: ideaWrites(writes).length, t })
    check('D-222 3 JS 오류 없음', errors.length === 0, errors)
    await ctx.close()
  }

  /* ---------- 4 [이번 주로 확정] 빠르게 두 번 → 수첩 한 줄 ---------- */
  {
    const { ctx, page, errors, writes } = await open({ width: 1440, height: 900 }, { ideaDelay: 900 })
    const btn = page.locator('[data-testid="radar-opp"][data-size="hero"]').getByTestId('radar-confirm')
    await btn.click()
    await btn.click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(1800)
    const ids = new Set(ideaWrites(writes).map((w) => w.id))
    check('D-222 4 [이번 주로 확정] 을 저장 중에 또 누름 → 수첩 줄 1개(예전: 서로 다른 줄 2개)', ids.size === 1, ideaWrites(writes))
    check('D-222 4 확정 표시 · JS 오류 없음', (await page.locator('[data-testid="radar-opp"][data-size="hero"]').getByTestId('radar-confirmed').count()) === 1 && errors.length === 0, errors)
    await ctx.close()
  }
} finally {
  await browser.close()
  stop()
}
console.log(`\nradar-cloud: ${pass} passed, ${fail} failed  (스크린샷: ${SHOTS})`)
process.exit(fail ? 1 : 0)
