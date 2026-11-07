/**
 * qa:packcloud — D-514 콘텐츠 묶음 AI 결과 다른 기기에서도(클라우드 흉내 — 서버 한 벌을 PC · 휴대폰 · 예전 PC 세 기기가 같이 쓴다).
 *
 *   K1 PC 에서 키워드 묶음 [AI로 다 쓰기] → 세 갈래 답이 오면 클라우드 한 줄(marketing / packs · mkpacks_<작업공간>)에 그 키워드 · 기기 PC · 칸 전부
 *   K2 휴대폰(빈 브라우저)에서 같은 키워드를 열면 AI 를 다시 부르지 않고 AI 글 그대로 · 'AI 가 쓴 글이에요 · … PC에서 씀' · [AI로 다시 쓰기]
 *   K3 휴대폰에서 다른 키워드를 AI 로 쓰면 올라감(기기 휴대폰 · 앞 키워드도 그대로) → PC 로 돌아오면(창 다시 보임) 그 키워드도 다시 안 부르고 보임
 *   K4 이 기능 전에 이 브라우저에만 있던 결과(예전 PC) → 마케팅 화면을 열면 클라우드로 올라감 · 다른 기기 결과는 이 브라우저로 들어옴
 *   K5 인터넷이 끊긴 채 AI 로 쓰면 글은 보이고 '이 기기에만 남겼어요' 한 줄 → 인터넷이 다시 되면 올라가고 한 줄 사라짐
 *   K6 클라우드 한 줄은 최근 12개까지 · 휴대폰 390 넘침 0 · JS 오류 0
 *   T  D-515 '이렇게 찍으세요' AI 추천도 같은 길 — PC 에서 [AI로 내 채널에 맞게 추천] → 클라우드 한 줄(marketing / kits · mkkits_<작업공간>) ·
 *      휴대폰에서 같은 후보를 펼치면 AI 다시 안 부르고 그 추천 · 'PC에서 씀' · 묶음 줄과 다른 줄
 *   V  D-516 영상 대본 · 우리 회사 버전 — PC 에서 받아 적기(3구간) · 우리 버전 → 영상마다 한 줄(transcript_<영상>) + 목록 한 줄 + 우리 버전 한 줄 ·
 *      휴대폰에서 같은 영상 → 다시 안 부르고 9줄 · 우리 버전 · 'PC에서 씀' · 휴대폰에서 [처음부터 다시 받기] → PC 로 돌아오면 휴대폰 대본으로
 *   X  D-521 작업공간 전체 내보내기 — 고객 관리 [백업 내려받기] 한 번 → 파일 하나에 업체 · 업무 일기(서버) · 모듈 기록(서버 전부) · 서류 파일 목록 ·
 *      서버에 쓰기 0 · 모듈 기록을 못 읽으면 나머지로 받고 '못 담은 것' 한 줄 · [백업 불러오기] 가 그 파일을 읽고 '보관용' 한 줄 ·
 *      D-528 설정 › 데이터 [전체 내려받기] 도 같은 파일
 *   I  D-523 보낸 초대 목록 · 취소 — 설정 › 작업공간: 기다리는 초대만 펴 둠(이메일 · 역할 · n일 남음) · 지난 초대(들어옴 · 취소 · 기한 지남) 접힘 ·
 *      토큰 칸은 읽지 않음 · [초대 취소] → 한 번 더 묻고 → 상태만 revoked(기다리는 것만) · 새 초대를 만들면 목록에 바로
 *
 *   node e2e/pack-cloud.mjs            (dist-qa-pack 으로 따로 빌드하고 4538 에 띄운다)
 */
import { mkTab } from './support/mkTabs.mjs'
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'

const REF = 'qaproject'
/** SHOTS=폴더 를 주면 휴대폰 화면 · 실패 한 줄을 찍어 둔다(눈 확인용) */
const SHOTS = process.env.SHOTS ?? ''
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }).catch(() => {})
}
const PORT = 4538
const BASE = `http://localhost:${PORT}`
const OUT = 'dist-qa-pack'
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
const ROW_ID = `mkpacks_${WS.replace(/[^a-zA-Z0-9]/g, '')}`
const KIT_ROW_ID = `mkkits_${WS.replace(/[^a-zA-Z0-9]/g, '')}`
const WSTAG = WS.replace(/[^a-zA-Z0-9]/g, '')
const feed = { on: false }
const VID = 'vidQAa1xxxx'
const FEED_NOW = Date.now()
const FEED = {
  fetchedAt: new Date(FEED_NOW - 2 * 3600_000).toISOString(),
  channels: [{ id: 'UCa', handle: '@UCa', title: '로뎀세무법인', customUrl: '@UCa', thumb: '', subs: 150_000, videoCount: 120, views: 30_000_000, mine: false }],
  videos: [{ id: VID, ch: 'UCa', t: '세무 기장 수수료 전부 공개합니다', at: new Date(FEED_NOW - 86400_000).toISOString(), d: 1421, v: 120_000, l: 3600, c: 480 }],
  failed: [],
  units: 20,
}
const ADAPT = {
  headline: '기장료 얼마가 적당할까 — 대표님이 손해 안 보는 기준 3가지',
  items: [
    { title: '제목 후보', tag: '제목', outline: ['기장료 이 정도면 적당합니다'] },
    { title: '첫 문장', tag: '첫 문장', body: '오늘은 기장료가 적당한지 판단하는 기준을 드립니다.' },
  ],
  next: [],
  caution: '',
}
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

/** 가짜 AI 답(갈래마다) — 브라우저가 부른 /api/ai-assist 를 여기서 받는다 */
const ANSWERS = {
  'radar.pack.video': {
    headline: 'AI 확정 제목 — 채용 전에 꼭 볼 3가지',
    items: [
      { title: '0:00 오프닝', tag: '유튜브 대본', body: 'AI 대본 오프닝 — 대표님, 직원 뽑기 전에 이것부터 보세요.' },
      { title: '제목 후보', tag: '제목', outline: ['AI 제목 1', 'AI 제목 2', 'AI 제목 3'] },
    ],
    next: ['노트북 화면 녹화'],
  },
  'radar.pack.short': {
    headline: 'AI 릴스',
    items: [
      { title: '① 핵심 셋 (50초)', tag: '릴스', body: 'AI 릴스 대본 — 0~3초 말: "뽑기 전에"' },
      { title: '유튜브 설명란', tag: '올릴 때 글', body: 'AI 설명란' },
    ],
  },
  'radar.pack.blog': {
    headline: 'AI 블로그',
    items: [
      { title: '제목', tag: '블로그', body: 'AI 블로그 제목' },
      { title: '도입', tag: '블로그', body: 'AI 블로그 도입' },
    ],
    next: ['AI태그1'],
  },
  'radar.kit': {
    headline: 'AI 추천 관점 — AI 는 미끼, 본업으로 대표님이 얻는 것까지',
    items: [
      { title: 'AI 추천 제목 숫자형 — 3가지', tag: '제목', when: '숫자형' },
      { title: 'AI 추천 제목 질문형 — 왜?', tag: '제목', when: '질문형' },
      { title: '첫 문장', tag: '첫 문장', body: 'AI 추천 첫 문장 — 결과부터 보여 드릴게요' },
      { title: '썸네일', tag: '썸네일', outline: ['AI 썸네일 하나'] },
      { title: '구성', tag: '구성', outline: ['0:00 결과 먼저'] },
    ],
  },
}

/** 서버 한 벌 — 세 기기가 같이 쓴다. down 이면 module_data 읽기 · 쓰기 모두 500 */
const cloud = { rows: new Map(), down: false, writes: [], clients: [], journal: [], events: [], mut: [], invites: [], inviteReads: [], invitePatches: [] }
const packsRow = () => cloud.rows.get(ROW_ID)
const kitsRow = () => cloud.rows.get(KIT_ROW_ID)
const cloudKits = () => kitsRow()?.payload?.kits ?? {}
const cloudPacks = () => packsRow()?.payload?.packs ?? {}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/** seed = 이 기능 전부터 이 브라우저에 있던 묶음 결과(axmvp.mkpack.v1) */
async function device(name, vp, mobile, seed = null) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: mobile, hasTouch: mobile })
  await ctx.addInitScript(([ref, s, ws, seedRaw]) => {
    if (!localStorage.getItem(`sb-${ref}-auth-token`)) localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s))
    localStorage.setItem('axmvp.active_workspace', ws)
    // '자세히 보기'(이번 주 후보 카드 · 이렇게 찍으세요)는 펼친 채
    localStorage.setItem('axmvp.fold.mk-more', '1')
    localStorage.setItem('axmvp.onboarding.prefs', '{"tutorialVersion":1,"autoShowEnabled":false,"firstSeenAt":"2026-01-01T00:00:00.000Z","lastShownDate":"2099-01-01","snoozedUntilDate":"2099-12-31","completedChapterIds":["system"],"lastOpenedChapterId":"system","selectedLearningPath":"ax","guideMode":"core","updatedAt":"2026-01-01T00:00:00.000Z"}')
    if (seedRaw && !sessionStorage.getItem('qa.seeded')) {
      localStorage.setItem('axmvp.mkpack.v1', seedRaw)
      sessionStorage.setItem('qa.seeded', '1')
    }
  }, [REF, session, WS, seed ? JSON.stringify(seed) : ''])
  const ai = []
  await ctx.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 404, body: '' }))
  // 영상 목록은 V 에서만(앞 시험은 예시 데이터로 — 이번 주 후보 카드)
  await ctx.route('**/api/yt-bench**', (r) => (feed.on ? r.fulfill(json(FEED)) : r.fallback()))
  await ctx.route('**/api/ai-assist**', async (route) => {
    const body = route.request().postDataJSON() ?? {}
    ai.push(body.assistId)
    const mm = (x) => `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`
    const st = body.video?.start ?? 0
    const tr = { headline: `구간 ${st}`, items: [{ title: mm(st), body: `${name} 구간${st} 첫 말` }, { title: mm(st + 30), body: `${name} 구간${st} 두 번째 말` }, { title: mm(st + 65), body: `${name} 구간${st} 세 번째 말` }], next: [], caution: '' }
    const a = body.assistId === 'radar.transcript' ? tr : body.assistId === 'radar.adapt' ? ADAPT : (ANSWERS[body.assistId] ?? { headline: '기타', items: [{ title: '기타' }] })
    const run = { requestId: body.requestId, assistId: body.assistId, page: body.page, provider: 'gemini', model: 'gemini-qa', status: 'succeeded', structured: a, raw: '', usage: { input: 1, output: 1, total: 2 }, estimatedCostUsd: null, ms: 5, sent: { userChars: 1, rows: 0, rowsCut: 0 }, createdAt: new Date().toISOString() }
    await route.fulfill(json({ ok: true, run }))
  })
  await ctx.route(`https://${REF}.supabase.co/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = decodeURIComponent(url.pathname)
    const method = req.method()
    if (path.endsWith('/auth/v1/token')) return route.fulfill(json(session))
    if (path.endsWith('/auth/v1/user')) return route.fulfill(json(session.user))
    if (path.endsWith('/rest/v1/rpc/my_os_access')) return route.fulfill(json('full'))
    if (path.endsWith('/rest/v1/rpc/my_capabilities')) return route.fulfill(json(['can_use_owner_ai_workspace']))
    if (path.includes('/rest/v1/workspace_members')) {
      return route.fulfill(json([{ workspace_id: WS, user_id: OWNER, role: 'owner', workspaces: { id: WS, name: '미래AI랩', owner_id: OWNER, created_at: '2026-01-01T00:00:00Z' } }]))
    }
    if (path.includes('/rest/v1/workspaces')) return route.fulfill(json([{ id: WS, name: '미래AI랩', owner_id: OWNER, created_at: '2026-01-01T00:00:00Z' }]))
    // D-529 상담신청(X) — 읽기만
    if (path.includes('/rest/v1/customer_events')) {
      if (method !== 'GET') cloud.mut.push(`${method} events`)
      return route.fulfill(json(method === 'GET' ? cloud.events : []))
    }
    // D-523 보낸 초대(I) — 읽기 · 취소(상태만) · 새 초대
    if (path.includes('/rest/v1/workspace_invites')) {
      if (method === 'GET') {
        cloud.inviteReads.push(url.searchParams.get('select') ?? '')
        const st = url.searchParams.get('status') ?? ''
        const rows = cloud.invites.filter((i) => (st === 'eq.pending' ? i.status === 'pending' : st === 'neq.pending' ? i.status !== 'pending' : true))
        return route.fulfill(json(rows))
      }
      if (method === 'PATCH') {
        const body = JSON.parse(req.postData() ?? '{}')
        const id = (url.searchParams.get('id') ?? '').replace(/^eq\./, '')
        const onlyPending = url.searchParams.get('status') === 'eq.pending'
        cloud.invitePatches.push({ id, body, onlyPending })
        const changed = []
        for (const inv of cloud.invites) if (inv.id === id && (!onlyPending || inv.status === 'pending')) { Object.assign(inv, body); changed.push({ id: inv.id }) }
        return route.fulfill(json(changed))
      }
      if (method === 'POST') {
        const body = JSON.parse(req.postData() ?? '{}')
        const row = Array.isArray(body) ? body[0] : body
        cloud.invites.unshift({ id: `inv-new-${cloud.invites.length}`, email: row.email, role: row.role, status: 'pending', expires_at: row.expires_at, created_at: new Date().toISOString() })
        return route.fulfill({ status: 201, contentType: 'application/json', body: '' })
      }
    }
    // D-521 내보내기(X) — 업체 · 업무 일기. 읽기 말고 다른 요청이 오면 적어 둔다(내보내기는 쓰기 0)
    if (path.includes('/rest/v1/operations_clients') || path.includes('/rest/v1/ops_journal_entries')) {
      const isJ = path.includes('ops_journal_entries')
      if (method !== 'GET') cloud.mut.push(`${method} ${isJ ? 'journal' : 'clients'}`)
      return route.fulfill(json(method === 'GET' ? (isJ ? cloud.journal : cloud.clients) : []))
    }
    if (path.includes('/rest/v1/module_data')) {
      const bucket = (url.searchParams.get('bucket') ?? '').replace(/^eq\./, '')
      if (cloud.down) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'upstream connect error' }) })
      if (method === 'GET') return route.fulfill(json([...cloud.rows.values()].filter((r) => !bucket || r.bucket === bucket)))
      if (method === 'POST') {
        const body = JSON.parse(req.postData() ?? '{}')
        const row = Array.isArray(body) ? body[0] : body
        const one = { ...row, created_at: row.updated_at }
        cloud.rows.set(row.id, one)
        cloud.writes.push({ bucket: row.bucket, id: row.id, payload: row.payload, device: name })
        return route.fulfill(json(/object/.test(req.headers().accept ?? '') ? one : [one]))
      }
      return route.fulfill(json([]))
    }
    return route.fulfill(json([]))
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  return { ctx, page, errors, ai }
}

const refocus = (page) =>
  page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
const waitFor = async (fn, ms = 8000) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await fn()) return true
    await new Promise((r) => setTimeout(r, 150))
  }
  return false
}
const KEY_A = 'custom:채용 지원금 바뀌는 점'
const KEY_B = 'custom:직원 뽑기 전 확인할 것'
const KEY_C = 'custom:예전에 써 둔 주제'
const KEY_D = 'custom:끊긴 사이 쓴 주제'
const openPack = async (page, key) => {
  await page.goto(`${BASE}/marketing?view=plan&pack=${encodeURIComponent(key)}`, { waitUntil: 'networkidle' })
  await page.getByTestId('mk-pack').waitFor({ timeout: 15000 })
}
const aiState = (page) => page.getByTestId('mk-pack-ai').getAttribute('data-state').catch(() => '')
const aiSections = (page) => page.locator('[data-testid="mk-pack-section"][data-ai="1"]').count()
const runAi = async (page) => {
  const b = page.getByTestId('mk-pack-ai-run')
  await b.click()
  await page.waitForTimeout(450)
  await b.click() // D-289 AI 단추 두 번(한 번 더 묻기)
}

/** 이번 주 후보 판 — 로컬 미리보기에는 유튜브 함수가 없어 [예시로 보기] 를 눌러야 후보가 생긴다 */
const openPlan = async (page) => {
  await page.goto(`${BASE}/marketing?view=plan`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const sample = page.getByTestId('yt-sample')
  if (await sample.count()) {
    await sample.first().click()
    await page.waitForTimeout(900)
  }
  await page.getByTestId('radar-plan').waitFor({ timeout: 10000 })
}
const kitOf = async (page, topic) => {
  const card = topic
    ? page.getByTestId('radar-plan').locator('[data-testid="radar-opp"]', { has: page.getByText(topic, { exact: true }) }).first()
    : page.getByTestId('radar-plan').locator('[data-testid="radar-opp"][data-axis="axai"]').first()
  const kit = card.getByTestId('radar-kit')
  if ((await kit.getAttribute('data-open')) !== '1') await kit.getByTestId('radar-kit-toggle').click()
  await page.waitForTimeout(250)
  return { card, kit }
}

const errorsAll = []
try {
  const pc = await device('pc', { width: 1440, height: 900 }, false)
  const ph = await device('phone', { width: 390, height: 844 }, true)

  // K1
  await openPack(pc.page, KEY_A)
  check('K1a 열 때는 AI 를 부르지 않음(누를 때만 — D-253 그대로)', pc.ai.length === 0 && (await aiState(pc.page)) === 'idle')
  await runAi(pc.page)
  const done1 = await waitFor(async () => (await aiState(pc.page)) === 'done')
  const up1 = await waitFor(() => Object.keys(cloudPacks()[KEY_A]?.sections ?? {}).length >= 4)
  const a1 = cloudPacks()[KEY_A]
  check('K1b AI 세 갈래 → 클라우드 한 줄(marketing / packs · 작업공간 행 id)에 그 키워드 · 기기 PC · 칸 4개 넘게', done1 && up1 && pc.ai.length === 3 && a1?.device === 'pc' && packsRow()?.bucket === 'packs' && packsRow()?.module_key === 'marketing' && packsRow()?.workspace_id === WS, { ai: pc.ai, sections: Object.keys(a1?.sections ?? {}), row: packsRow()?.id })

  // K2
  await openPack(ph.page, KEY_A)
  const done2 = await waitFor(async () => (await aiState(ph.page)) === 'done')
  const bar2 = await ph.page.getByTestId('mk-pack-ai').innerText().catch(() => '')
  const n2 = await aiSections(ph.page)
  await shot(ph.page, 'pack-phone-from-pc')
  check('K2a 휴대폰(빈 브라우저)에서 같은 키워드 → AI 다시 안 부르고 AI 글 그대로', done2 && ph.ai.length === 0 && n2 >= 4, { ai: ph.ai, n2 })
  check('K2b \'AI 가 쓴 글이에요 · … PC에서 씀\' · [AI로 다시 쓰기]', /AI 가 쓴 글이에요/.test(bar2) && /PC에서 씀/.test(bar2) && (await ph.page.getByTestId('mk-pack-ai-run').innerText()).includes('다시 쓰기'), bar2)
  const text2 = await ph.page.locator('[data-sec="video"]').innerText().catch(() => '')
  check('K2c 휴대폰 화면 글 = PC 에서 AI 가 쓴 글(대본 오프닝)', text2.includes('AI 대본 오프닝'), text2.slice(0, 80))

  // K3
  await openPack(ph.page, KEY_B)
  await runAi(ph.page)
  await waitFor(async () => (await aiState(ph.page)) === 'done')
  const up3 = await waitFor(() => cloudPacks()[KEY_B]?.device === 'phone' && Object.keys(cloudPacks()[KEY_B]?.sections ?? {}).length >= 4)
  check('K3a 휴대폰에서 다른 키워드 AI → 올라감 · 기기 휴대폰 · 앞 키워드(PC)도 그대로', up3 && cloudPacks()[KEY_A]?.device === 'pc', Object.keys(cloudPacks()))
  const pcBefore = pc.ai.length
  await pc.page.goto(`${BASE}/marketing?view=plan`, { waitUntil: 'networkidle' })
  await pc.page.waitForTimeout(400)
  await refocus(pc.page)
  const gotB = await waitFor(() => pc.page.evaluate((k) => Object.keys(JSON.parse(localStorage.getItem('axmvp.mkpack.v1') ?? '{}')).includes(k), KEY_B))
  await openPack(pc.page, KEY_B)
  const done3 = await waitFor(async () => (await aiState(pc.page)) === 'done')
  const bar3 = await pc.page.getByTestId('mk-pack-ai').innerText().catch(() => '')
  check('K3b PC 로 돌아오면 휴대폰에서 쓴 키워드도 이 브라우저로 · 열면 다시 안 부르고 \'휴대폰에서 씀\'', gotB && done3 && pc.ai.length === pcBefore && /휴대폰에서 씀/.test(bar3), { gotB, bar3, ai: pc.ai.length - pcBefore })

  // K4 예전 PC — 이 기능 전부터 이 브라우저에만 있던 결과
  const oldAt = '2026-10-20T03:00:00.000Z'
  const old = await device('old-pc', { width: 1280, height: 860 }, false, { [KEY_C]: { at: oldAt, model: 'gemini-old', sections: { blog: [{ label: '블로그 제목', text: '예전에 AI 로 쓴 블로그' }] } } })
  await old.page.goto(`${BASE}/marketing?view=plan`, { waitUntil: 'networkidle' })
  const up4 = await waitFor(() => cloudPacks()[KEY_C]?.at === oldAt)
  const in4 = await waitFor(() => old.page.evaluate(([a, b]) => { const s = Object.keys(JSON.parse(localStorage.getItem('axmvp.mkpack.v1') ?? '{}')); return s.includes(a) && s.includes(b) }, [KEY_A, KEY_B]))
  check('K4a 이 브라우저에만 있던 예전 결과 → 마케팅 화면을 열면 클라우드로 올라감(기기 표시 없음 그대로)', up4 && cloudPacks()[KEY_C]?.device === undefined && !!cloudPacks()[KEY_A] && !!cloudPacks()[KEY_B], Object.keys(cloudPacks()))
  check('K4b 다른 기기 결과(PC · 휴대폰)는 이 브라우저로 들어옴 · AI 다시 안 부름', in4 && old.ai.length === 0)
  await openPack(ph.page, KEY_C)
  const done4 = await waitFor(async () => (await aiState(ph.page)) === 'done')
  check('K4c 휴대폰에서도 예전 결과가 보임(AI 안 부름)', done4 && (await ph.page.locator('[data-sec="blog"]').innerText()).includes('예전에 AI 로 쓴 블로그') && ph.ai.length === 3, ph.ai.length)

  // K5 인터넷이 끊긴 채
  cloud.down = true
  await openPack(pc.page, KEY_D)
  await runAi(pc.page)
  await waitFor(async () => (await aiState(pc.page)) === 'done')
  const failShown = await waitFor(async () => (await pc.page.getByTestId('mk-pack-cloud-failed').count()) === 1)
  const failText = await pc.page.getByTestId('mk-pack-cloud-failed').innerText().catch(() => '')
  await shot(pc.page, 'pack-pc-failed')
  check('K5a 끊긴 채 AI → 글은 보이고 \'이 기기에만 남겼어요\' 한 줄 · 클라우드엔 아직 없음', failShown && /이 기기에만 남겼어요/.test(failText) && (await aiSections(pc.page)) >= 4 && !cloudPacks()[KEY_D], failText)
  cloud.down = false
  await pc.page.evaluate(() => window.dispatchEvent(new Event('online')))
  const up5 = await waitFor(() => Object.keys(cloudPacks()[KEY_D]?.sections ?? {}).length >= 4)
  const gone = await waitFor(async () => (await pc.page.getByTestId('mk-pack-cloud-failed').count()) === 0)
  check('K5b 인터넷이 다시 되면 올라가고 한 줄 사라짐', up5 && gone)

  // T '이렇게 찍으세요' AI 추천
  await openPlan(pc.page)
  const t0 = await kitOf(pc.page, '')
  const topic = (await t0.card.getByTestId('radar-opp-topic').innerText()).trim()
  const kitRun = t0.kit.getByTestId('radar-kit-ai-run')
  await kitRun.click()
  await pc.page.waitForTimeout(450)
  await kitRun.click()
  await t0.kit.getByTestId('radar-kit-ai-result').waitFor({ timeout: 15000 }).catch(() => {})
  const upT = await waitFor(() => Object.keys(cloudKits()).length === 1)
  const kitKey = Object.keys(cloudKits())[0] ?? ''
  check('T1 PC 에서 AI 추천 → 클라우드 한 줄(marketing / kits) · 그 후보 · 기기 PC · 묶음 줄과 다른 줄', upT && pc.ai.filter((x) => x === 'radar.kit').length === 1 && cloudKits()[kitKey]?.device === 'pc' && kitsRow()?.bucket === 'kits' && kitsRow()?.module_key === 'marketing' && KIT_ROW_ID !== ROW_ID && !!packsRow(), { topic, kitKey, row: kitsRow()?.id })
  await openPlan(ph.page)
  const t1 = await kitOf(ph.page, topic)
  const gotT = await waitFor(async () => (await t1.kit.getByTestId('radar-kit-ai-result').count()) === 1)
  const barT = await t1.kit.getByTestId('radar-kit-ai').innerText().catch(() => '')
  const txtT = await t1.kit.getByTestId('radar-kit-ai-result').innerText().catch(() => '')
  await shot(ph.page, 'kit-phone-from-pc')
  check('T2 휴대폰에서 같은 후보를 펼치면 AI 다시 안 부르고 그 추천 · \'PC에서 씀\'', gotT && ph.ai.filter((x) => x === 'radar.kit').length === 0 && /AI 추천이 있어요/.test(barT) && /PC에서 씀/.test(barT) && txtT.includes('AI 추천 첫 문장'), { barT, txt: txtT.slice(0, 120) })

  // V 영상 대본 · 우리 회사 버전
  const openTop = async (page) => {
    await page.goto(`${BASE}/marketing/youtube`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    await mkTab(page, 'yt-view-top')
    await page.waitForTimeout(400)
    await page.locator('[data-testid="yt-card"]').filter({ hasText: '세무 기장 수수료 전부 공개' }).first().getByTestId('yt-card-thumb').click()
    await page.getByTestId('radar-video-detail').waitFor()
  }
  const twice = async (loc) => {
    await loc.click()
    await loc.page().waitForTimeout(450)
    await loc.click()
  }
  const vsRow = () => cloud.rows.get(`mkvs_${VID}_${WSTAG}`)
  const vsIdx = () => cloud.rows.get(`mkvsidx_${WSTAG}`)?.payload?.videos ?? {}
  const adapts = () => cloud.rows.get(`mkadapts_${WSTAG}`)?.payload?.adapts ?? {}
  feed.on = true
  await openTop(pc.page)
  await twice(pc.page.getByTestId('vs-get'))
  await pc.page.waitForFunction(() => document.querySelectorAll('[data-testid="vs-lines"] li').length === 9, null, { timeout: 15000 })
  await twice(pc.page.getByTestId('vs-adapt-run'))
  await pc.page.getByTestId('vs-adapt-result').waitFor({ timeout: 10000 })
  const upV = await waitFor(() => vsIdx()[VID]?.parts === 3 && (vsRow()?.payload?.doc?.parts ?? []).filter((p) => p.status === 'done').length === 3 && !!adapts()[VID])
  check('V1 PC 받아 적기 3구간 · 우리 버전 → 영상마다 한 줄(transcript_<영상>) · 목록 한 줄(3구간) · 우리 버전 한 줄 · 기기 PC', upV && vsRow()?.bucket === `transcript_${VID}` && vsRow()?.payload?.doc?.device === 'pc' && adapts()[VID]?.device === 'pc' && pc.ai.filter((x) => x === 'radar.transcript').length === 3, { idx: vsIdx(), row: vsRow()?.id, adapt: Object.keys(adapts()) })
  const phBefore = ph.ai.length
  await openTop(ph.page)
  const gotV = await waitFor(async () => (await ph.page.locator('[data-testid="vs-lines"] li').count()) === 9)
  const countV = await ph.page.getByTestId('vs-count').innerText().catch(() => '')
  const metaV = await ph.page.getByTestId('vs-adapt-meta').innerText().catch(() => '')
  const firstV = await ph.page.locator('[data-testid="vs-lines"] li').first().innerText().catch(() => '')
  await ph.page.getByTestId('vs-transcript').scrollIntoViewIfNeeded().catch(() => {})
  await shot(ph.page, 'study-phone-from-pc')
  check('V2 휴대폰에서 같은 영상 → 다시 안 부르고 대본 9줄(PC 글) · 우리 버전 · \'PC에서 씀\'', gotV && ph.ai.length === phBefore && /PC에서 씀/.test(countV) && /PC에서 씀/.test(metaV) && firstV.includes('pc 구간0') && (await ph.page.getByTestId('vs-adapt-result').count()) === 1, { countV, metaV, firstV, ai: ph.ai.slice(phBefore) })
  ph.page.once('dialog', (d) => void d.accept())
  await ph.page.getByTestId('vs-reset').click()
  await ph.page.waitForFunction(() => document.querySelectorAll('[data-testid="vs-lines"] li').length === 9 && document.body.innerText.includes('phone 구간0'), null, { timeout: 15000 }).catch(() => {})
  const upV3 = await waitFor(() => vsRow()?.payload?.doc?.device === 'phone' && (vsRow()?.payload?.doc?.parts ?? []).filter((p) => p.status === 'done').length === 3)
  // 창으로 돌아올 때 맞추기는 15초에 한 번(D-350) — 그만큼 지난 뒤 돌아온 것처럼
  await pc.page.waitForTimeout(15500)
  await refocus(pc.page)
  const backV = await waitFor(async () => ((await pc.page.locator('[data-testid="vs-lines"] li').first().innerText().catch(() => '')) || '').includes('phone 구간0'), 10000)
  const countV3 = await pc.page.getByTestId('vs-count').innerText().catch(() => '')
  check('V3 휴대폰 [처음부터 다시 받기] → 새 대본이 올라감(기기 휴대폰) → PC 로 돌아오면 휴대폰 대본 · \'휴대폰에서 씀\'', upV3 && backV && /휴대폰에서 씀/.test(countV3), { upV3, backV, countV3 })

  // H 오늘 대화창이 배운 것
  const learnRow = () => cloud.rows.get(`homelearn_${WSTAG}`)?.payload?.learned ?? {}
  await pc.page.evaluate(() => {
    localStorage.setItem('axmvp.home.ask.alias.v1', JSON.stringify({ 해성: 'client-haesung', 미래랩: 'client-mirae' }))
    localStorage.setItem('axmvp.home.ask.fb.v1', JSON.stringify({ up: 3, down: { tooLong: 1 }, liked: [{ q: '정책자금 되나', headline: '세 가지 확인' }] }))
  })
  await pc.page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  const upH = await waitFor(() => learnRow()['alias:해성']?.client === 'client-haesung' && learnRow().fb?.fb?.up === 3)
  check('H1 PC 오늘을 열면 대화창이 배운 별명 · 평가(예전 기록)가 클라우드 한 줄(home / ask)로', upH && !!learnRow()['alias:미래랩'] && cloud.rows.get(`homelearn_${WSTAG}`)?.bucket === 'ask', learnRow())
  await ph.page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  const gotH = await waitFor(() => ph.page.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('axmvp.home.ask.alias.v1') ?? '{}')
    const f = JSON.parse(localStorage.getItem('axmvp.home.ask.fb.v1') ?? '{}')
    return a['해성'] === 'client-haesung' && a['미래랩'] === 'client-mirae' && f.up === 3 && f.down?.tooLong === 1
  }))
  check('H2 휴대폰 오늘을 열면 같은 별명 · 평가(다음 답의 말하기 규칙)가 이 기기로', gotH)

  // X D-521 작업공간 전체 내보내기
  const doc = (o) => ({ received: true, issuedAt: '2026-10-01', fileName: '', fileSize: 0, storagePath: '', note: '', updatedAt: '2026-10-02T01:00:00.000Z', ...o })
  cloud.clients = [{
    id: 'client-hansol', workspace_id: WS, company_name: '한솔정밀(주)', status: 'active', next_action: '', next_action_due_date: null,
    created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-02T00:00:00Z',
    payload: { documents: {
      businessRegistration: doc({ fileName: '사업자등록증.pdf', fileSize: 1200, storagePath: `${WS}/client-hansol/businessRegistration/a.pdf`, folderPath: '한솔/기본', uploadedAt: '2026-10-02T02:00:00.000Z' }),
      corporateRegistry: doc({ fileName: '등기부.pdf', fileSize: 3400, storagePath: `${WS}/client-hansol/corporateRegistry/b.pdf` }),
      smeCertificate: doc(),
    } },
  }]
  const jrow = (id, type, content, due = null) => ({ id, workspace_id: WS, owner_id: OWNER, entry_date: '2026-11-02', entry_type: type, content, client_id: 'client-hansol', project_id: null, service_key: null, due_date: due, pinned: false, completed: false, completed_at: null, created_at: '2026-11-02T01:00:00Z', updated_at: '2026-11-02T01:00:00Z' })
  cloud.journal = [jrow('j1', 'note', '상담 메모 — 청년 채용 계획'), jrow('j2', 'follow_up', '납세증명서 받기', '2026-11-06'), jrow('j3', 'call', '대표님 통화')]
  cloud.events = [{ id: 'ev1', workspace_id: WS, portal_client_link_id: null, operations_client_id: null, profile_id: null, event_type: 'consultation_requested', source_type: 'public_form', source_id: 's1', dedupe_key: 'd1', payload_version: 1, payload: { company: '새봄식품', name: '이대표' }, priority: 'normal', status: 'new', occurred_at: '2026-11-02T02:00:00Z', created_at: '2026-11-02T02:00:00Z', updated_at: '2026-11-02T02:00:00Z' }]
  for (const [id, name] of [['emp-1', '직원 김'], ['emp-2', '직원 이']]) {
    cloud.rows.set(id, { id, workspace_id: WS, module_key: 'employment', bucket: 'employees', client_id: 'client-hansol', payload: { name }, created_at: '2026-10-05T00:00:00Z', updated_at: '2026-10-05T00:00:00Z' })
  }
  const exportOnce = async () => {
    await pc.page.goto(`${BASE}/ops/clients`, { waitUntil: 'networkidle' })
    await pc.page.getByRole('button', { name: '더보기' }).first().click()
    const btn = pc.page.getByTestId('clients-export')
    await btn.waitFor({ timeout: 8000 })
    const [dl] = await Promise.all([pc.page.waitForEvent('download', { timeout: 15000 }), btn.click()])
    const fs = await import('node:fs')
    const text = fs.readFileSync(await dl.path(), 'utf8')
    const toast = await pc.page.getByText(/백업을 내려받았어요/).first().innerText({ timeout: 8000 }).catch(() => '')
    return { name: dl.suggestedFilename(), text, file: JSON.parse(text), toast }
  }
  const mutBefore = cloud.mut.length
  const writesBefore = cloud.writes.length
  const x1 = await exportOnce()
  const w = x1.file.workspace ?? {}
  check('X1a [백업 내려받기] 한 번 → 영문 이름 파일 하나 · 같은 형식 3판 · 업체 1곳', x1.name === `client-ops-workspace-${x1.name.slice(-15, -5)}.json` && x1.file.format === 'ax-client-ops' && x1.file.version === 3 && x1.file.clients?.length === 1, { name: x1.name, v: x1.file.version })
  check('X1b 업무 일기 3건(서버) · 모듈 기록 = 서버 줄 전부', w.mode === 'cloud' && w.journal?.length === 3 && w.moduleRows?.length === cloud.rows.size && w.summary?.modules?.employment === 2, { j: w.journal?.length, m: w.moduleRows?.length, cloud: cloud.rows.size })
  const f = (w.files ?? []).find((x) => x.slot === 'businessRegistration')
  check('X1c 서류 파일 목록 2개 — 업체 · 칸 이름 · 파일 · 폴더 · 저장 위치 · 받기만 한 칸은 빼고', w.files?.length === 2 && f?.company === '한솔정밀(주)' && f?.label === '사업자등록증' && f?.folderPath === '한솔/기본' && f?.storagePath.endsWith('a.pdf'), w.files)
  check('X1d 열어 볼 수 있는 주소 0 · 못 담은 것 0', !/signedUrl|token=|https?:\/\//i.test(JSON.stringify(w.files)) && (w.missing ?? []).length === 0, w.missing)
  check('X1e 다 받으면 한 줄 — 업체 · 업무 일기 · 상담신청 · 모듈 기록 · 서류 파일 목록', /업체 1곳 · 업무 일기 3건 · 상담신청 1건 · 모듈 기록 \d+줄 · 서류 파일 목록 2개/.test(x1.toast) && w.events?.length === 1 && w.summary?.events === 1, x1.toast)
  check('X1g (D-536) 한 줄 끝에 되살리기 범위 — "되살리기는 업체 · 입력값만(나머지는 보관용)"', /되살리기는 업체 · 입력값만\(나머지는 보관용\)/.test(x1.toast), x1.toast)
  check('X1f 내보내기는 서버에 쓰기 0', cloud.mut.length === mutBefore && cloud.writes.slice(writesBefore).every((x) => x.bucket !== 'employees'), cloud.mut.slice(mutBefore))
  cloud.down = true
  const x2 = await exportOnce().catch((e) => ({ file: {}, toast: String(e) }))
  cloud.down = false
  check('X2 모듈 기록을 못 읽으면 — 나머지(업체 · 업무 일기)로 받고 못 담은 것을 알림', x2.file.workspace?.missing?.includes('모듈 기록(서버)') && x2.file.workspace?.journal?.length === 3 && /못 담은 것: 모듈 기록/.test(x2.toast), { miss: x2.file.workspace?.missing, toast: x2.toast })
  // [백업 불러오기] — 같은 파일을 읽고 '보관용' 한 줄(합치지 않고 닫는다)
  const fs = await import('node:fs')
  const tmp = `/tmp/claude-0/ws-export-${Date.now()}.json`
  fs.writeFileSync(tmp, x1.text)
  await pc.page.getByRole('button', { name: '더보기' }).first().click()
  const [chooser] = await Promise.all([pc.page.waitForEvent('filechooser'), pc.page.getByRole('button', { name: '백업 불러오기' }).click()])
  await chooser.setFiles(tmp)
  const note = await pc.page.getByTestId('restore-ws-note').innerText({ timeout: 8000 }).catch(() => '')
  check('X3 [백업 불러오기] 가 3판 파일을 읽음 · 업무 일기 · 모듈 기록은 보관용이라고 한 줄', note.includes('업무 일기 3건') && note.includes('보관용'), note)
  await pc.page.getByRole('button', { name: '취소' }).click()
  fs.unlinkSync(tmp)
  // X4 D-528 설정 › 데이터에서도 같은 파일(업체를 그 자리에서 읽어서)
  await pc.page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' })
  await pc.page.getByRole('button', { name: '데이터' }).first().click()
  const sBtn = pc.page.getByTestId('settings-export')
  await sBtn.waitFor({ timeout: 8000 })
  const [sdl] = await Promise.all([pc.page.waitForEvent('download', { timeout: 15000 }), sBtn.click()])
  const sfile = JSON.parse(fs.readFileSync(await sdl.path(), 'utf8'))
  const stoast = await pc.page.getByText(/백업을 내려받았어요/).first().innerText({ timeout: 8000 }).catch(() => '')
  await shot(pc.page, 'd528-settings-export-pc')
  check('X4 (D-528) 설정 › 데이터 [전체 내려받기] → 같은 파일(3판 · 업체 1 · 업무 일기 3 · 상담신청 1 · 파일 목록 2) · 한 줄', sfile.version === 3 && sfile.clients?.length === 1 && sfile.workspace?.journal?.length === 3 && sfile.workspace?.events?.length === 1 && sfile.workspace?.files?.length === 2 && /업체 1곳/.test(stoast), { v: sfile.version, c: sfile.clients?.length, stoast })
  cloud.clients = []
  cloud.journal = []
  cloud.events = []
  cloud.rows.delete('emp-1')
  cloud.rows.delete('emp-2')

  // I D-523 보낸 초대 목록 · 취소
  const dayMs = 86400_000
  const iso = (ms) => new Date(Date.now() + ms).toISOString()
  cloud.invites = [
    { id: 'inv-open', email: 'teamlead@qa.kr', role: 'editor', status: 'pending', expires_at: iso(3 * dayMs + 3600_000), created_at: iso(-4 * dayMs) },
    { id: 'inv-late', email: 'late@qa.kr', role: 'viewer', status: 'pending', expires_at: iso(-dayMs), created_at: iso(-9 * dayMs) },
    { id: 'inv-in', email: 'joined@qa.kr', role: 'editor', status: 'accepted', expires_at: iso(2 * dayMs), created_at: iso(-5 * dayMs) },
    { id: 'inv-off', email: 'off@qa.kr', role: 'admin', status: 'revoked', expires_at: iso(2 * dayMs), created_at: iso(-6 * dayMs) },
  ]
  await pc.page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' })
  await pc.page.getByRole('button', { name: '작업공간' }).first().click()
  const sent = pc.page.getByTestId('sent-invites')
  await sent.waitFor({ timeout: 8000 }).catch(() => {})
  const rows = await pc.page.getByTestId('invite-row').allInnerTexts()
  check('I1 기다리는 초대만 펴 둠 — 이메일 · 역할 · 4일 남음(기한 지난 기다림은 지난 초대로)', rows.length === 1 && rows[0].includes('teamlead@qa.kr') && rows[0].includes('편집자') && /4일 남음/.test(rows[0]), rows)
  const pastClosed = (await pc.page.getByTestId('invite-past').count()) === 0
  await sent.getByRole('button', { name: /지난 초대/ }).click()
  const past = await pc.page.getByTestId('invite-past').innerText().catch(() => '')
  check('I2 지난 초대는 접혀 있다가 펴면 — 들어옴 · 취소함 · 기한 지남', pastClosed && past.includes('joined@qa.kr') && past.includes('들어옴') && past.includes('취소함') && past.includes('late@qa.kr') && past.includes('기한 지남'), past)
  await shot(pc.page, 'd523-invites-pc')
  check('I3 토큰(해시) 칸은 읽지 않음', cloud.inviteReads.length > 0 && cloud.inviteReads.every((q) => !/token/.test(q)), cloud.inviteReads)
  await pc.page.getByTestId('invite-revoke').click()
  const dlg = pc.page.getByRole('dialog')
  const askText = await dlg.innerText({ timeout: 5000 }).catch(() => '')
  await dlg.getByRole('button', { name: '초대 취소' }).click()
  const revoked = await waitFor(() => cloud.invites.find((i) => i.id === 'inv-open')?.status === 'revoked')
  const patch = cloud.invitePatches[0]
  // 흉내 서버가 고침을 받은 '바로 그 순간' 에는 화면이 아직 답을 못 받았다 — 알림이 뜰 때까지 기다린다(예전엔 바로 봐서 가끔 빨갛게)
  const revToast = await pc.page.getByText(/초대를 취소했어요/).first().waitFor({ timeout: 5000 }).then(() => true).catch(() => false)
  check('I4 [초대 취소] → 한 번 더 묻고 → 상태만 revoked(기다리는 것만 · 줄은 남음) · 취소했다는 알림', askText.includes('teamlead@qa.kr') && revoked && patch?.body?.status === 'revoked' && patch?.onlyPending === true && cloud.invites.length === 4 && revToast, { askText: askText.slice(0, 80), patch, revToast })
  const emptyNow = await waitFor(async () => (await pc.page.getByTestId('invite-row').count()) === 0 && (await sent.innerText()).includes('기다리는 초대가 없어요'))
  check('I5 취소하면 목록에서 빠지고 지난 초대로', emptyNow)
  await pc.page.locator('#invite-email').fill('new@qa.kr')
  await pc.page.getByRole('button', { name: '초대 코드 만들기' }).click()
  const added = await waitFor(async () => (await pc.page.getByTestId('invite-row').allInnerTexts()).some((t) => t.includes('new@qa.kr') && /7일 남음/.test(t)))
  check('I6 새 초대를 만들면 기다리는 초대에 바로(7일 남음) · 링크도 그대로', added && (await pc.page.getByTestId('invite-link').count()) === 1)
  await ph.page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' })
  await ph.page.getByRole('button', { name: '작업공간' }).first().click()
  await ph.page.getByTestId('invite-row').first().waitFor({ timeout: 8000 }).catch(() => {})
  await shot(ph.page, 'd523-invites-phone')
  const phOver = await ph.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('I7 휴대폰 390 보낸 초대 — 줄 보임 · 넘침 0', (await ph.page.getByTestId('invite-row').count()) >= 1 && phOver <= 0, phOver)
  cloud.invites = []

  // K6
  const n6 = Object.keys(cloudPacks()).length
  const writesByOld = cloud.writes.filter((w) => w.device === 'old-pc').length
  check('K6a 클라우드 한 줄 · 12개 넘지 않음 · 작업공간 줄은 하나', n6 >= 4 && n6 <= 12 && [...cloud.rows.keys()].filter((k) => k.startsWith('mkpacks_')).length === 1, { n6, rows: [...cloud.rows.keys()] })
  check('K6b 같은 내용이면 다시 올리지 않음(예전 PC 는 한 번만 올림)', writesByOld === 1, writesByOld)
  const geo = await ph.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('K6c 휴대폰 390 넘침 0', geo <= 0, geo)
  // E D-551 SYNC-4 보관 한도(12개)에서 밀려날 때 한 줄 — 꽉 찬 브라우저(클라우드는 잠깐 끊긴 채 — 이 브라우저 12개 그대로)
  const seed12 = {}
  for (let i = 0; i < 12; i += 1) seed12[`custom:예전 주제 ${i + 1}`] = { at: `2026-10-${String(10 + i).padStart(2, '0')}T03:00:00.000Z`, model: 'gemini-old', sections: { blog: [{ label: '블로그 제목', text: `예전 글 ${i + 1}` }] } }
  cloud.down = true
  const full = await device('full-pc', { width: 1280, height: 860 }, false, seed12)
  await openPack(full.page, 'custom:새로 쓰는 주제')
  const e0 = await full.page.getByTestId('ai-store-evicted').count()
  await runAi(full.page)
  const shownE = await waitFor(async () => (await full.page.getByTestId('ai-store-evicted').count()) === 1)
  const lineE = await full.page.getByTestId('ai-store-evicted').innerText().catch(() => '')
  await shot(full.page, 'd551-evicted')
  check("E1 꽉 찬(12개) 브라우저에서 새 묶음 AI → 한 줄 — 최근 12개까지만 · 가장 오래된 '예전 주제 1' 빠짐 · 담아 둔 글은 그대로(전에는 아무 말 없음)",
    e0 === 0 && shownE && /최근 12개까지만/.test(lineE) && /'예전 주제 1'/.test(lineE) && /그대로/.test(lineE), { e0, lineE })
  await full.page.getByTestId('ai-store-evicted-close').click()
  const keysE = await full.page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('axmvp.mkpack.v1') ?? '{}')))
  check('E2 닫으면 사라짐 · 이 브라우저는 12개(새 주제 들어오고 가장 오래된 것 빠짐)', (await full.page.getByTestId('ai-store-evicted').count()) === 0 && keysE.length === 12 && keysE.includes('custom:새로 쓰는 주제') && !keysE.includes('custom:예전 주제 1'), keysE)
  cloud.down = false

  errorsAll.push(...pc.errors, ...ph.errors, ...old.errors, ...full.errors)
  check('K6d JS 오류 0', errorsAll.length === 0, errorsAll.slice(0, 3))
} catch (e) {
  check('시험이 끝까지 돌았다', false, String(e).slice(0, 400))
} finally {
  await browser.close()
  stop()
}
console.log(`\nqa:packcloud: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
