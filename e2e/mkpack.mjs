/**
 * qa:mkpack — D-251 마케팅 · 브랜딩 첫 화면(이번 주 키워드 단추만) → 키워드 하나 → 콘텐츠 묶음 한 번에.
 *
 * 브라우저 → /api/ai-assist 는 진짜 서버 함수(api/ai-assist.js)를 이 프로세스에서 부른다(Playwright route · qa:assist 와 같은 방식).
 * 밖으로 나가는 것만 가짜: Supabase 로그인 확인 · 권한 RPC · AI 공급자(Gemini · Claude).
 *
 *   H  첫 화면: 키워드 단추 6 · 직접 주제 · 사용 방법 4단계 · [자세히 보기] 는 접힘(예전 판 · AI 도우미 · 새로 가져오기 · 채널 설계 기준은 그 안에 다 있음)
 *   P  키워드 누르면 → 규칙 초안 7칸 바로 → AI 세 갈래 동시에(radar.pack.video · short · blog) → 6칸이 AI 글로 · 추천 제목 바뀜
 *      보낸 자료에 고른 키워드 · 채널 설계 기준 · 규칙 초안 뼈대 · 규칙집 · 시청자 글에 레이더 숫자 없음
 *   C  전체 복사 · 칸 복사 · [내 콘텐츠에 담기] → 내 콘텐츠 그 줄(대본 준비 · 대본 칸에 묶음) · 다시 열면 [내 콘텐츠에서 보기]
 *   R  다시 열면 AI 다시 안 부름(이 브라우저에 남음) · 첫 화면 'AI로 써 둠' · [AI로 다시 쓰기] 는 다시 부름 · 뒤로 가기 → 첫 화면
 *   E  한 갈래 실패 → 그 칸만 규칙 초안 + 이유 한 줄 · 나머지는 AI
 *   D  직접 주제 · 2자 미만 막힘 · 목록에 없는 키 → 안내 + 돌아가기
 *   M  360 · 390 · 430 · 큰 글자 — 가로 넘침 0 · 단추 44px · JS 오류 0
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import fs from 'node:fs'
import { seedScript } from './seed.mjs'

const fromRoot = (p) => import(pathToFileURL(path.resolve(p)).href)
const { default: handler, __resetAiAssistState } = await fromRoot('api/ai-assist.js')

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.MKPACK_SHOTS ?? ''
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) {
    pass++
    console.log('PASS ', n)
  } else {
    fail++
    console.log('FAIL ', n, d === undefined ? '' : String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600))
  }
}
const shot = async (page, name, full = false) => {
  if (!SHOTS) return
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full })
}

const OWNER = 'Bearer owner-e2e-token-aaaaaaaaaaaa'
for (const k of Object.keys(process.env)) if (/^(AI_|OPENAI_|SUPABASE_|GEMINI_|GOOGLE_API|ANTHROPIC_API|CLAUDE_API)/.test(k)) delete process.env[k]
Object.assign(process.env, { SUPABASE_URL: 'https://qa.supabase.test', SUPABASE_ANON_KEY: 'qa-anon', GEMINI_API_KEY: 'gem-e2e-SECRET-1', ANTHROPIC_API_KEY: 'ant-e2e-SECRET-2', AI_ASSIST_RATE_PER_MIN: '100', AI_ASSIST_RATE_PER_HOUR: '500' })
__resetAiAssistState()

/** 공급자에 간 요청 */
const llm = []
/** 이 갈래는 공급자가 모두 실패한다(E) */
let failing = ''
const ANSWERS = {
  'radar.pack.video': {
    headline: 'AI 확정 제목 — 채용 전에 꼭 볼 3가지',
    items: [
      { title: '0:00 오프닝', tag: '유튜브 대본', body: 'AI 대본 오프닝 — 대표님, 직원 뽑기 전에 이것부터 보세요.', outline: ['썸네일 문구 크게'] },
      { title: '3:30 체크포인트 2 — 제목 짓는 법', tag: '유튜브 대본', body: 'AI 대본 두 번째 — [공식 자료 확인: 신청 기간]' },
      { title: '제목 후보', tag: '제목', outline: ['AI 제목 1', 'AI 제목 2', 'AI 제목 3', 'AI 제목 4', 'AI 제목 5'] },
      { title: '썸네일 문구', tag: '제목', outline: ['AI 썸네일'] },
    ],
    next: ['노트북 화면 녹화'],
  },
  'radar.pack.short': {
    headline: 'AI 릴스',
    items: [
      { title: '① 핵심 셋 (50초)', tag: '릴스', body: 'AI 릴스 대본 — 0~3초 말: "뽑기 전에"' },
      { title: '캡션', tag: '릴스', body: 'AI 캡션 #채용 #중소기업 #대표님 #지원금 #미래AI랩' },
      { title: '카드뉴스 7장', tag: '카드뉴스', outline: ['1장 | AI 카드 표지 | 작은 글 | 그림'] },
      { title: '유튜브 설명란', tag: '올릴 때 글', body: 'AI 설명란' },
    ],
  },
  'radar.pack.blog': {
    headline: 'AI 블로그',
    items: [
      { title: '제목', tag: '블로그', body: 'AI 블로그 제목' },
      { title: '도입', tag: '블로그', body: 'AI 블로그 도입\n\n[사진: 상담 장면]' },
    ],
    next: ['AI태그1', 'AI태그2'],
  },
}
const answerFor = (sys) => {
  for (const [id, a] of Object.entries(ANSWERS)) if (sys.includes(`(${id}`)) return a
  return { headline: '기타', items: [{ title: '기타' }] }
}
const realFetch = globalThis.fetch
globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  const h = init.headers ?? {}
  if (url.startsWith('https://qa.supabase.test/auth/v1/user')) return new Response(JSON.stringify({ id: h.Authorization === OWNER ? 'owner-1' : 'x' }), { status: h.Authorization === OWNER ? 200 : 401 })
  if (url.startsWith('https://qa.supabase.test/rest/v1/rpc/has_capability')) return new Response(JSON.stringify(h.Authorization === OWNER), { status: 200 })
  if (url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent')) {
    const body = JSON.parse(String(init.body ?? '{}'))
    const sys = String(body.systemInstruction?.parts?.[0]?.text ?? '')
    const user = String(body.contents?.[0]?.parts?.[0]?.text ?? '')
    llm.push({ provider: 'gemini', sys, user })
    if (failing && sys.includes(`(${failing}`)) return new Response(JSON.stringify({ error: { message: 'busy' } }), { status: 503 })
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answerFor(sys)) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 2100, candidatesTokenCount: 320 } }), { status: 200 })
  }
  if (url.includes('api.anthropic.com/v1/messages')) {
    const body = JSON.parse(String(init.body ?? '{}'))
    const sys = String(body.system ?? '')
    llm.push({ provider: 'anthropic', sys, user: String(body.messages?.[0]?.content ?? '') })
    if (failing && sys.includes(`(${failing}`)) return new Response(JSON.stringify({ error: { message: 'busy' } }), { status: 529 })
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answerFor(sys)) }], usage: { input_tokens: 1500, output_tokens: 200 }, stop_reason: 'end_turn', model: body.model }), { status: 200 })
  }
  if (/\/models(\?|$)/.test(url)) return new Response(JSON.stringify({ models: [], data: [] }), { status: 200 })
  return realFetch(input, init)
}

/** AI 답을 늦춘다(쓰는 중 모양을 볼 때) */
let delayMs = 0
async function wire(page) {
  await page.route('**/api/ai-assist**', async (route) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
    const req = route.request()
    const u = new URL(req.url())
    const res = { statusCode: 200, headers: {}, raw: '', setHeader(k, v) { this.headers[k] = v }, end(b) { this.raw = b ?? '' } }
    await handler({ method: req.method(), url: u.pathname + u.search, headers: { authorization: OWNER }, body: req.postData() ?? undefined }, res)
    await route.fulfill({ status: res.statusCode, headers: { 'content-type': 'application/json' }, body: res.raw })
  })
}

/** 로컬 미리보기에는 유튜브 함수가 없다 — [예시로 보기] 를 눌러야 키워드가 생긴다 */
async function openHome(p) {
  await p.goto(BASE + '/marketing', { waitUntil: 'networkidle' })
  await p.waitForTimeout(500)
  const sample = p.getByTestId('yt-sample')
  if (await sample.count()) {
    await sample.first().click()
    await p.waitForTimeout(900)
  }
  await p.getByTestId('mk-home').waitFor({ timeout: 10000 })
}
const packCalls = () => llm.filter((x) => /\(radar\.pack\./.test(x.sys))
const aiDone = (p) => p.waitForSelector('[data-testid="mk-pack-ai"]:not([data-state="running"])', { timeout: 20000 })
const overflowX = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await wire(page)
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(seedScript())
// 처음 쓰는 사람 모양 — 접는 목차는 저마다 처음 상태(시드의 '모두 펼침' 빼기)
await page.evaluate(() => {
  localStorage.removeItem('axmvp.fold.all')
  localStorage.removeItem('axmvp.ai.choice.v1')
})

/* ---------------- H 첫 화면 ---------------- */
await openHome(page)
const keys = page.getByTestId('mk-key')
check('H1 첫 화면 = 이번 주 키워드 단추 6개 · 1번이 맨 앞(빨간 칸)', (await keys.count()) === 6 && (await keys.first().innerText()).trim().startsWith('1'), await keys.count())
const more = page.getByTestId('mk-more')
check('H2 예전 첫 화면(1순위 카드 · 시장 신호)은 [자세히 보기] 안 — 처음엔 접힘', (await more.getAttribute('data-open')) === '0' && (await page.getByTestId('radar-plan').count()) === 0)
check('H3 첫 화면에 AI 도우미 판 · 새로 가져오기 · CSV · 채널 설계 기준이 안 보임(그 안으로)', (await page.getByTestId('ai-assist-bar').count()) === 0 && (await page.getByTestId('yt-refresh').count()) === 0 && (await page.getByTestId('radar-brief').count()) === 0)
const chars = (await page.locator('main').innerText()).replace(/\s+/g, '').length
const firstKeyTop = (await keys.first().boundingBox())?.y ?? 9999
check('H4 첫 화면 글자 수 1,000자 아래(전: 2,656자) · 1번 키워드가 첫 화면 안(높이 1000)', chars < 1000 && firstKeyTop < 900, { chars, firstKeyTop })
console.log('     첫 화면 글자 수(PC):', chars)
await shot(page, 'H-home')
await page.getByTestId('mk-howto-toggle').click()
check('H5 [사용 방법] → 4단계 + [자세히 보기] 안내', (await page.getByTestId('mk-howto').locator('li').count()) === 5 && (await page.getByTestId('mk-howto').innerText()).includes('자세히 보기'))
await page.getByTestId('mk-howto-toggle').click()
await more.getByTestId('fold-toggle').first().click()
await page.waitForTimeout(400)
check('H6 [자세히 보기] 펼치면 예전 판 그대로 — 1순위 카드 · AI 도우미 · 새로 가져오기 · CSV · 채널 설계 기준(지운 것 없음)', (await page.getByTestId('radar-plan').isVisible()) && (await page.getByTestId('ai-assist-bar').count()) === 1 && (await page.getByTestId('yt-refresh').count()) === 1 && (await page.getByTestId('yt-csv').count()) === 1 && (await page.getByTestId('radar-brief').count()) === 1)
await more.getByTestId('fold-toggle').first().click()
await page.waitForTimeout(200)

/* ---------------- P 키워드 하나 → 묶음 ---------------- */
const firstKey = await keys.first().getAttribute('data-key')
const firstTopic = (await keys.first().innerText()).split('\n').map((s) => s.trim()).filter(Boolean)[1]
const before = packCalls().length
delayMs = 2500
await keys.first().click()
await page.getByTestId('mk-pack').waitFor({ timeout: 8000 })
const url1 = new URL(page.url())
check('P1 키워드 누르면 → 묶음 화면(?pack=키) · 주제 · 추천 제목', url1.searchParams.get('pack') === firstKey && (await page.getByTestId('mk-pack-topic').innerText()).includes(firstTopic) && (await page.getByTestId('mk-pack-headline').innerText()).startsWith('추천 제목'), { url: page.url(), firstTopic })
const secs = page.getByTestId('mk-pack-section')
check('P2 7칸 바로(제목 · 유튜브 · 릴스 · 블로그 · 카드뉴스 · 올릴 때 글 · 발행 전 확인) · 칸 이동 칩 7', (await secs.evaluateAll((els) => els.map((e) => e.getAttribute('data-sec')).join())) === 'titles,video,shorts,blog,cards,upload,checks' && (await page.getByTestId('mk-pack-chip').count()) === 7)
check('P3 AI 를 기다리는 동안에도 규칙 초안이 다 보임(유튜브 대본 오프닝 · 블로그 표) · 칸마다 \'AI가 쓰는 중\'', (await page.getByTestId('mk-pack-ai').getAttribute('data-state')) === 'running' && (await page.locator('[data-sec="video"]').innerText()).includes('0:00 오프닝') && (await page.locator('[data-sec="blog"]').innerText()).includes('| --- | --- |') && (await page.locator('[data-sec="blog"]').getByTestId('mk-pack-origin').innerText()).includes('쓰는 중'))
await shot(page, 'P-pack-running')
await aiDone(page)
delayMs = 0
const calls = packCalls().slice(before)
const ids = calls.map((c) => (c.sys.match(/\((radar\.pack\.[a-z]+)/) ?? [])[1]).sort()
check('P4 대표 계정 — 누르자마자 AI 세 갈래를 동시에(유튜브 · 릴스 묶음 · 블로그) 한 번씩', ids.join() === 'radar.pack.blog,radar.pack.short,radar.pack.video', ids)
await page.waitForFunction(() => document.querySelectorAll('[data-testid="mk-pack-section"][data-ai="1"]').length === 6, null, { timeout: 8000 })
const vText = await page.locator('[data-sec="video"]').innerText()
check('P5 AI 글로 6칸이 바뀜 · 발행 전 확인은 규칙(AI 아님) · 구간 제목에 "제목" 이 있어도 대본 칸', (await page.locator('[data-sec="checks"]').getAttribute('data-ai')) === '0' && vText.includes('AI 대본 오프닝') && vText.includes('제목 짓는 법') && (await page.locator('[data-sec="titles"]').innerText()).includes('AI 제목 1'))
check('P6 추천 제목 = AI 확정 제목 · 준비물 · 블로그 태그(next) 칸', (await page.getByTestId('mk-pack-headline').innerText()).includes('AI 확정 제목') && vText.includes('찍기 전 준비물') && (await page.locator('[data-sec="blog"]').innerText()).includes('AI태그1, AI태그2'))
check('P7 AI 상태 — 다 씀 · 모델 이름 · [AI로 다시 쓰기]', (await page.getByTestId('mk-pack-ai').getAttribute('data-state')) === 'done' && (await page.getByTestId('mk-pack-ai-run').innerText()).includes('다시 쓰기'))
const vUser = calls.find((c) => c.sys.includes('(radar.pack.video'))?.user ?? ''
check('P8 보낸 자료 — 고른 키워드 · 채널 설계 기준 · 규칙 초안 뼈대 · 규칙집(쓰지 않는 말 · 빈칸 규칙)', ['[자료 · 고른 키워드', '[자료 · 채널 설계 기준', '[자료 · 규칙 초안 뼈대', '[규칙집]', '쓰지 않는 말', '[공식 자료 확인'].every((t) => vUser.includes(t)) && vUser.includes(firstTopic), vUser.slice(0, 600))
check('P9 보낸 자료에 업체 · 사람 이름 · 전화 없음(레이더 · 미래AI랩 자료만)', !/010-\d|@[a-z]+\.(com|kr)/.test(vUser) && !vUser.includes('공구 마모'), vUser.slice(0, 200))
await shot(page, 'P-pack-ai')

/* ---------------- C 복사 · 내 콘텐츠 ---------------- */
await page.getByTestId('mk-pack-copy-all').click()
await page.waitForTimeout(300)
const all = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
check('C1 [전체 복사] — 주제 · 추천 제목 · 7칸 이름 · AI 글까지', all.startsWith(`[콘텐츠 묶음] ${firstTopic}`) && ['■ 제목 · 썸네일', '■ 유튜브 대본', '■ 릴스 · 쇼츠 대본', '■ 블로그 글', '■ 카드뉴스', '■ 올릴 때 글', '■ 발행 전 확인'].every((t) => all.includes(t)) && all.includes('AI 대본 오프닝'), all.slice(0, 200))
await page.locator('[data-sec="blog"]').getByTestId('mk-pack-copy').click()
await page.waitForTimeout(200)
const blogClip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
check('C2 [이 칸 복사] — 블로그 칸만', blogClip.startsWith('■ 블로그 글') && !blogClip.includes('■ 유튜브 대본'), blogClip.slice(0, 80))
await page.getByTestId('mk-pack-save').click()
await page.getByTestId('mk-pack-open-idea').waitFor({ timeout: 8000 })
check('C3 [내 콘텐츠에 담기] → [내 콘텐츠에서 보기] 로 바뀜 · 단추는 [대본 다시 저장]', (await page.getByTestId('mk-pack-save').innerText()).includes('다시 저장'))
await page.getByTestId('mk-pack-open-idea').click()
await page.waitForTimeout(1200)
const row = page.locator('[data-testid="radar-idea"][data-focus="1"]')
const script = (await row.count()) ? await row.getByTestId('make-script').innerText().catch(() => '') : ''
check("C4 내 콘텐츠 그 줄 — 단계 '대본 준비' · 대본 칸에 묶음 전체 · 체크 '대본'", (await row.count()) === 1 && (await row.getAttribute('data-status')) === 'script' && script.includes('[콘텐츠 묶음]') && script.includes('AI 대본 오프닝') && (await row.locator('[data-testid="make-check"][data-id="script"]').getAttribute('data-on')) === '1', script.slice(0, 120))

/* ---------------- R 다시 열기 · 뒤로 · 다시 쓰기 ---------------- */
await openHome(page)
check("R1 첫 화면 그 키워드에 'AI로 써 둠'", (await page.locator(`[data-testid="mk-key"][data-key="${firstKey}"]`).getByTestId('mk-key-ai').count()) === 1)
const n0 = packCalls().length
await page.locator(`[data-testid="mk-key"][data-key="${firstKey}"]`).click()
await page.getByTestId('mk-pack').waitFor()
await page.waitForTimeout(1200)
check('R2 다시 열면 AI 를 다시 부르지 않음 · 남겨 둔 AI 글 그대로 · [내 콘텐츠에서 보기]', packCalls().length === n0 && (await page.locator('[data-testid="mk-pack-section"][data-ai="1"]').count()) === 6 && (await page.getByTestId('mk-pack-open-idea').count()) === 1, { n0, now: packCalls().length })
await page.goBack()
await page.getByTestId('mk-home').waitFor({ timeout: 5000 })
check('R3 휴대폰 뒤로 가기(브라우저 뒤로) → 첫 화면 키워드', (await page.getByTestId('mk-pack').count()) === 0 && (await page.getByTestId('mk-key').count()) === 6)
await page.goForward()
await page.getByTestId('mk-pack').waitFor()
await page.getByTestId('mk-pack-back').click()
await page.getByTestId('mk-home').waitFor({ timeout: 5000 })
check('R4 [← 이번 주 키워드] → 첫 화면', (await page.getByTestId('mk-pack').count()) === 0)
await page.locator(`[data-testid="mk-key"][data-key="${firstKey}"]`).click()
await page.getByTestId('mk-pack').waitFor()
const n1 = packCalls().length
await page.getByTestId('mk-pack-ai-run').click()
await aiDone(page)
check('R5 [AI로 다시 쓰기] → 세 갈래 다시 한 번씩', packCalls().length === n1 + 3, packCalls().length - n1)
await page.getByTestId('mk-pack-back').click()
await page.getByTestId('mk-home').waitFor()

/* ---------------- L 쓰는 중에 나갔다 들어오기 ---------------- */
delayMs = 2500
const third = page.getByTestId('mk-key').nth(2)
const thirdKey = await third.getAttribute('data-key')
const nL = packCalls().length
await third.click()
await page.getByTestId('mk-pack').waitFor()
await page.waitForTimeout(400)
await page.getByTestId('mk-pack-back').click()
await page.getByTestId('mk-home').waitFor()
await page.waitForTimeout(3200)
await page.locator(`[data-testid="mk-key"][data-key="${thirdKey}"]`).click()
await page.getByTestId('mk-pack').waitFor()
await page.waitForFunction(() => document.querySelectorAll('[data-testid="mk-pack-section"][data-ai="1"]').length === 6, null, { timeout: 8000 }).catch(() => {})
check('L1 AI 가 쓰는 중에 첫 화면으로 나갔다 다시 들어와도 — 그 사이 온 AI 글이 보이고 · 다시 부르지 않음', (await page.locator('[data-testid="mk-pack-section"][data-ai="1"]').count()) === 6 && packCalls().length === nL + 3 && (await page.getByTestId('mk-pack-ai').getAttribute('data-state')) === 'done', { calls: packCalls().length - nL })
delayMs = 0
await page.getByTestId('mk-pack-back').click()
await page.getByTestId('mk-home').waitFor()

/* ---------------- E 한 갈래 실패 ---------------- */
failing = 'radar.pack.blog'
const second = page.getByTestId('mk-key').nth(1)
await second.click()
await page.getByTestId('mk-pack').waitFor()
await aiDone(page)
await page.waitForTimeout(300)
const errText = await page.getByTestId('mk-pack-ai-error').innerText().catch(() => '')
check('E1 블로그 갈래만 실패 → 이유 한 줄 · 블로그는 규칙 초안 그대로 · 나머지 5칸은 AI', errText.includes('규칙 초안 그대로') && (await page.locator('[data-sec="blog"]').getAttribute('data-ai')) === '0' && (await page.locator('[data-testid="mk-pack-section"][data-ai="1"]').count()) === 5 && (await page.locator('[data-part="blog"]').getAttribute('data-state')) === 'error', errText)
check('E2 실패해도 블로그 칸 글은 그대로 있음(빈 칸 아님)', (await page.locator('[data-sec="blog"]').innerText()).includes('한눈에 정리'))
await shot(page, 'E-pack-error')
failing = ''
await page.getByTestId('mk-pack-back').click()
await page.getByTestId('mk-home').waitFor()

/* ---------------- D 직접 주제 · 없는 키 ---------------- */
await page.getByTestId('mk-custom-input').fill('가')
check('D1 직접 주제 2자 미만 → [이 주제로 만들기] 막힘', await page.getByTestId('mk-custom-go').isDisabled())
await page.getByTestId('mk-custom-input').fill('가업승계 2027 달라지는 점')
await page.getByTestId('mk-custom-go').click()
await page.getByTestId('mk-pack').waitFor()
await aiDone(page)
check("D2 직접 주제 → 같은 묶음 · '직접 고른 주제' · AI 도 같이", (await page.getByTestId('mk-pack-topic').innerText()).includes('가업승계 2027') && (await page.getByTestId('mk-pack').innerText()).includes('직접 고른 주제') && (await page.locator('[data-testid="mk-pack-section"][data-ai="1"]').count()) === 6 && new URL(page.url()).searchParams.get('pack') === 'custom:가업승계 2027 달라지는 점')
check('D3 직접 주제에는 레이더 근거 칸 · 고른 이유 접기 없음', (await page.getByTestId('mk-pack-why').count()) === 0)
await page.goto(BASE + '/marketing?pack=market:없는주제', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const sample = page.getByTestId('yt-sample')
if (await sample.count()) await sample.first().click()
await page.getByTestId('mk-pack-missing').waitFor({ timeout: 8000 })
check('D4a 없는 키워드 → "이번 주 목록에 없어요" 안내', (await page.getByTestId('mk-pack-missing').innerText()).includes('목록에 없어요'))
await page.getByTestId('mk-pack-missing-back').click()
await page.getByTestId('mk-home').waitFor({ timeout: 5000 })
if (await page.getByTestId('yt-sample').count()) {
  await page.getByTestId('yt-sample').first().click()
  await page.waitForTimeout(900)
}
check('D4 목록에 없는 키워드 주소 → 안내 + [이번 주 키워드 보기] → 첫 화면', (await page.getByTestId('mk-key').count()) === 6)
check('PC JS 오류 0', errors.length === 0, errors.join(' | '))
await ctx.close()

/* ---------------- M 휴대폰 · 큰 글자 ---------------- */
for (const [w, big] of [[360, false], [390, false], [430, false], [390, true]]) {
  const m = await browser.newContext({ viewport: { width: w, height: 820 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const mp = await m.newPage()
  const errs = []
  mp.on('pageerror', (e) => errs.push(String(e)))
  await wire(mp)
  await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
  await mp.evaluate(seedScript())
  await mp.evaluate((b) => {
    localStorage.removeItem('axmvp.fold.all')
    if (b) document.documentElement.style.fontSize = '130%'
  }, big)
  await openHome(mp)
  if (big) await mp.evaluate(() => (document.documentElement.style.fontSize = '130%'))
  const tag = `${w}${big ? ' 큰 글자' : ''}`
  const h = await mp.getByTestId('mk-key').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
  check(`M ${tag}: 첫 화면 넘침 0 · 키워드 단추 6개 모두 44px 이상`, (await overflowX(mp)) <= 0 && h.length === 6 && h.every((x) => x >= 44), { over: await overflowX(mp), h })
  await shot(mp, `M-${w}${big ? '-big' : ''}-home`)
  await mp.getByTestId('mk-key').first().click()
  await mp.getByTestId('mk-pack').waitFor()
  await aiDone(mp)
  const navOver = await mp.getByTestId('mk-pack-nav').evaluate((n) => n.scrollWidth > n.clientWidth)
  check(`M ${tag}: 묶음 화면 넘침 0(칸 칩은 그 줄 안에서만 밀림) · 칸 7`, (await overflowX(mp)) <= 0 && navOver && (await mp.getByTestId('mk-pack-section').count()) === 7, await overflowX(mp))
  await shot(mp, `M-${w}${big ? '-big' : ''}-pack`)
  check(`M ${tag}: JS 오류 0`, errs.length === 0, errs.join(' | '))
  await m.close()
}

await browser.close()
console.log(`\nqa:mkpack: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
