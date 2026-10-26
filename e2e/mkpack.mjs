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
// D-253 6개 → 10개(레이더 후보가 그만큼 있을 때) — 예시 데이터 후보 수만큼, 10개를 넘지 않게
const KEYS_N = await keys.count()
check(`H1 첫 화면 = 이번 주 키워드 단추 ${KEYS_N}개(6개 넘게 · 10개까지) · 1번이 맨 앞(빨간 칸) · 마지막 번호 = 개수`, KEYS_N > 6 && KEYS_N <= 10 && (await keys.first().innerText()).trim().startsWith('1') && (await keys.last().innerText()).trim().startsWith(String(KEYS_N)), KEYS_N)
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
await keys.first().click()
await page.getByTestId('mk-pack').waitFor({ timeout: 8000 })
const url1 = new URL(page.url())
check('P1 키워드 누르면 → 묶음 화면(?pack=키) · 주제 · 추천 제목', url1.searchParams.get('pack') === firstKey && (await page.getByTestId('mk-pack-topic').innerText()).includes(firstTopic) && (await page.getByTestId('mk-pack-headline').innerText()).startsWith('추천 제목'), { url: page.url(), firstTopic })
const secs = page.getByTestId('mk-pack-section')
check('P2 7칸 바로(제목 · 유튜브 · 릴스 · 블로그 · 카드뉴스 · 올릴 때 글 · 발행 전 확인) · 칸 이동 칩 7', (await secs.evaluateAll((els) => els.map((e) => e.getAttribute('data-sec')).join())) === 'titles,video,shorts,blog,cards,upload,checks' && (await page.getByTestId('mk-pack-chip').count()) === 7)
// D-253 대표 "AI 는 누를 때만" — 키워드를 눌러도 AI 를 부르지 않는다. 모델을 고르고 [AI로 다 쓰기] 를 눌러야 세 갈래
await page.waitForTimeout(1500)
check('P3a 키워드를 눌러도 AI 를 부르지 않음 — 규칙 초안만(유튜브 대본 오프닝 · 블로그 표) · 상태 \'아직\' · 모델 고르기 단추가 AI 단추 옆', packCalls().length === before && (await page.getByTestId('mk-pack-ai').getAttribute('data-state')) === 'idle' && (await page.locator('[data-sec="video"]').innerText()).includes('0:00 오프닝') && (await page.locator('[data-sec="blog"]').innerText()).includes('| --- | --- |') && (await page.locator('[data-testid="mk-pack-section"][data-ai="1"]').count()) === 0 && (await page.getByTestId('mk-pack-ai').getByTestId('model-pick').count()) === 1 && (await page.getByTestId('mk-pack-ai-run').innerText()).includes('AI로 다 쓰기'), { calls: packCalls().length - before })
await shot(page, 'P-pack-idle')
// 모델 고르기 — Claude 로 바꾸면 그 모델로 부른다
await page.getByTestId('mk-pack-ai').getByTestId('model-pick').click()
await page.getByTestId('model-pick-panel').waitFor()
await page.locator('[data-testid="ai-assist-settings"] [data-provider="anthropic"]').click()
await page.locator('[data-testid="ai-assist-model-option"][data-model="claude-haiku-5-5"]').click()
await page.waitForTimeout(200)
check('P3b 모델 고르기 → Claude 로 바꾸면 단추에 그 모델', (await page.getByTestId('mk-pack-ai').getByTestId('model-pick').getAttribute('data-model')) === 'claude-haiku-5-5')
await page.getByTestId('mk-pack-ai').getByTestId('model-pick').click()
delayMs = 2500
{ const l289 = page.getByTestId('mk-pack-ai-run'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
await page.waitForTimeout(300)
check('P3 누른 뒤 AI 를 기다리는 동안에도 규칙 초안이 다 보임 · 칸마다 \'AI가 쓰는 중\'', (await page.getByTestId('mk-pack-ai').getAttribute('data-state')) === 'running' && (await page.locator('[data-sec="video"]').innerText()).includes('0:00 오프닝') && (await page.locator('[data-sec="blog"]').getByTestId('mk-pack-origin').innerText()).includes('쓰는 중'))
await shot(page, 'P-pack-running')
await aiDone(page)
delayMs = 0
const calls = packCalls().slice(before)
const ids = calls.map((c) => (c.sys.match(/\((radar\.pack\.[a-z]+)/) ?? [])[1]).sort()
check('P4 [AI로 다 쓰기] → AI 세 갈래를 동시에(유튜브 · 릴스 묶음 · 블로그) 한 번씩 · 고른 모델(Claude)로', ids.join() === 'radar.pack.blog,radar.pack.short,radar.pack.video' && calls.every((c) => c.provider === 'anthropic'), { ids, providers: calls.map((c) => c.provider) })
await page.waitForFunction(() => document.querySelectorAll('[data-testid="mk-pack-section"][data-ai="1"]').length === 6, null, { timeout: 8000 })
const vText = await page.locator('[data-sec="video"]').innerText()
check('P5 AI 글로 6칸이 바뀜 · 발행 전 확인은 규칙(AI 아님) · 구간 제목에 "제목" 이 있어도 대본 칸', (await page.locator('[data-sec="checks"]').getAttribute('data-ai')) === '0' && vText.includes('AI 대본 오프닝') && vText.includes('제목 짓는 법') && (await page.locator('[data-sec="titles"]').innerText()).includes('AI 제목 1'))
check('P6 추천 제목 = AI 확정 제목 · 준비물 · 블로그 태그(next) 칸', (await page.getByTestId('mk-pack-headline').innerText()).includes('AI 확정 제목') && vText.includes('찍기 전 준비물') && (await page.locator('[data-sec="blog"]').innerText()).includes('AI태그1, AI태그2'))
check('P7 AI 상태 — 다 씀 · 모델 이름 · [AI로 다시 쓰기]', (await page.getByTestId('mk-pack-ai').getAttribute('data-state')) === 'done' && (await page.getByTestId('mk-pack-ai-run').innerText()).includes('다시 쓰기'))
const vUser = calls.find((c) => c.sys.includes('(radar.pack.video'))?.user ?? ''
check('P8 보낸 자료 — 고른 키워드 · 채널 설계 기준 · 규칙 초안 뼈대 · 규칙집(쓰지 않는 말 · 빈칸 규칙)', ['[자료 · 고른 키워드', '[자료 · 채널 설계 기준', '[자료 · 규칙 초안 뼈대', '[규칙집]', '쓰지 않는 말', '[공식 자료 확인'].every((t) => vUser.includes(t)) && vUser.includes(firstTopic), vUser.slice(0, 600))
check('P9 보낸 자료에 업체 · 사람 이름 · 전화 없음(레이더 · 미래AI랩 자료만)', !/010-\d|@[a-z]+\.(com|kr)/.test(vUser) && !vUser.includes('공구 마모'), vUser.slice(0, 200))
await shot(page, 'P-pack-ai')

/* ---------------- W 왜 이 키워드? · 관련 영상 — 빨간 머리 상자 안 펼쳐보기/접기(D-253) ---------------- */
const whyToggle = page.getByTestId('mk-pack-why-toggle')
check('W1 빨간 머리 상자에 [왜 이 키워드? · 관련 영상 펼쳐보기] · 처음엔 접힘', (await whyToggle.count()) === 1 && (await whyToggle.getAttribute('aria-expanded')) === 'false' && (await page.getByTestId('mk-pack-why').count()) === 0 && (await whyToggle.innerText()).includes('펼쳐보기'))
await whyToggle.click()
await page.waitForTimeout(250)
const why = page.getByTestId('mk-pack-why')
const vids = await why.getByTestId('mk-pack-videos').locator('li').count()
const whyTxt = await why.innerText().catch(() => '')
check(`W2 펼치면 머리 상자 안에 — 왜 지금 · 이렇게 말해요 · 숫자 근거 · 관련 영상 ${vids}편(3편 넘게) · ×배`, (await page.getByTestId('mk-pack').locator('[data-testid="mk-pack-why"]').count()) === 1 && whyTxt.includes('왜 지금') && whyTxt.includes('이렇게 말해요') && whyTxt.includes('관련 영상') && vids > 3 && /×|배/.test(whyTxt) && (await whyToggle.innerText()).includes('접기'), { vids, whyTxt: whyTxt.slice(0, 160) })
await shot(page, 'W-pack-why')
await whyToggle.click()
await page.waitForTimeout(150)
check('W3 [접기] → 다시 접힘', (await page.getByTestId('mk-pack-why').count()) === 0 && (await whyToggle.getAttribute('aria-expanded')) === 'false')

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
const dialogs = []
page.on('dialog', (d) => {
  dialogs.push(d.message())
  void d.dismiss()
})
await page.getByTestId('mk-pack-save').click()
await page.waitForTimeout(800)
check('R2a 같은 묶음을 다시 저장 — 묻지 않음(대본이 같음)', dialogs.length === 0, dialogs)
check('R2 다시 열면 AI 를 다시 부르지 않음 · 남겨 둔 AI 글 그대로 · [내 콘텐츠에서 보기]', packCalls().length === n0 && (await page.locator('[data-testid="mk-pack-section"][data-ai="1"]').count()) === 6 && (await page.getByTestId('mk-pack-open-idea').count()) === 1, { n0, now: packCalls().length })
await page.goBack()
await page.getByTestId('mk-home').waitFor({ timeout: 5000 })
check('R3 휴대폰 뒤로 가기(브라우저 뒤로) → 첫 화면 키워드', (await page.getByTestId('mk-pack').count()) === 0 && (await page.getByTestId('mk-key').count()) === KEYS_N)
await page.goForward()
await page.getByTestId('mk-pack').waitFor()
await page.getByTestId('mk-pack-back').click()
await page.getByTestId('mk-home').waitFor({ timeout: 5000 })
check('R4 [← 이번 주 키워드] → 첫 화면', (await page.getByTestId('mk-pack').count()) === 0)
await page.locator(`[data-testid="mk-key"][data-key="${firstKey}"]`).click()
await page.getByTestId('mk-pack').waitFor()
const n1 = packCalls().length
{ const l289 = page.getByTestId('mk-pack-ai-run'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
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
{ const l289 = page.getByTestId('mk-pack-ai-run'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
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
{ const l289 = page.getByTestId('mk-pack-ai-run'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
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
const nD = packCalls().length
await page.getByTestId('mk-custom-go').click()
await page.getByTestId('mk-pack').waitFor()
await page.waitForTimeout(800)
check('D2a 직접 주제도 누르기 전에는 AI 를 부르지 않음', packCalls().length === nD && (await page.getByTestId('mk-pack-ai').getAttribute('data-state')) === 'idle')
{ const l289 = page.getByTestId('mk-pack-ai-run'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
await aiDone(page)
check("D2 직접 주제 → 같은 묶음 · '직접 고른 주제' · [AI로 다 쓰기] 도 같이", (await page.getByTestId('mk-pack-topic').innerText()).includes('가업승계 2027') && (await page.getByTestId('mk-pack').innerText()).includes('직접 고른 주제') && (await page.locator('[data-testid="mk-pack-section"][data-ai="1"]').count()) === 6 && new URL(page.url()).searchParams.get('pack') === 'custom:가업승계 2027 달라지는 점')
check('D3 직접 주제에는 레이더 근거 칸 · [왜 이 키워드?] 단추 없음', (await page.getByTestId('mk-pack-why').count()) === 0 && (await page.getByTestId('mk-pack-why-toggle').count()) === 0)
// 내 콘텐츠 탭에서 같은 이름으로 담아 둔 주제 → 첫 화면에서 직접 주제로 묶음 → 담기 = 그 줄에(두 줄 안 생김)
await page.goto(BASE + '/marketing?view=make', { waitUntil: 'networkidle' })
await page.getByTestId('make-add-input').fill('창업감면 3년 차 확인')
await page.getByTestId('make-add').click()
await page.waitForTimeout(800)
await openHome(page)
await page.getByTestId('mk-custom-input').fill('창업감면 3년 차 확인')
await page.getByTestId('mk-custom-go').click()
await page.getByTestId('mk-pack').waitFor()
await aiDone(page)
await page.getByTestId('mk-pack-save').click()
await page.waitForTimeout(800)
await page.goto(BASE + '/marketing?view=make', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const sameRows = page.locator('[data-testid="radar-idea"]').filter({ hasText: '창업감면 3년 차 확인' })
check('D5 내 콘텐츠에 같은 이름 주제가 있으면 그 줄에 담음 — 줄 하나 · 대본 준비', (await sameRows.count()) === 1 && (await sameRows.first().getAttribute('data-status')) === 'script', await sameRows.count())
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
check('D4 목록에 없는 키워드 주소 → 안내 + [이번 주 키워드 보기] → 첫 화면', (await page.getByTestId('mk-key').count()) === KEYS_N)
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
  check(`M ${tag}: 첫 화면 넘침 0 · 키워드 단추 ${KEYS_N}개 모두 44px 이상`, (await overflowX(mp)) <= 0 && h.length === KEYS_N && h.every((x) => x >= 44), { over: await overflowX(mp), h })
  await shot(mp, `M-${w}${big ? '-big' : ''}-home`)
  await mp.getByTestId('mk-key').first().click()
  await mp.getByTestId('mk-pack').waitFor()
  await aiDone(mp)
  // 휴대폰에서도 펼쳐보기 — 머리 상자 안 관련 영상이 넘치지 않게
  await mp.getByTestId('mk-pack-why-toggle').click()
  await mp.waitForTimeout(200)
  check(`M ${tag}: [왜 이 키워드? · 관련 영상] 펼쳐도 넘침 0`, (await mp.getByTestId('mk-pack-why').count()) === 1 && (await overflowX(mp)) <= 0, await overflowX(mp))
  await shot(mp, `M-${w}${big ? '-big' : ''}-why`)
  await mp.getByTestId('mk-pack-why-toggle').click()
  const navOver = await mp.getByTestId('mk-pack-nav').evaluate((n) => n.scrollWidth > n.clientWidth)
  check(`M ${tag}: 묶음 화면 넘침 0(칸 칩은 그 줄 안에서만 밀림) · 칸 7`, (await overflowX(mp)) <= 0 && navOver && (await mp.getByTestId('mk-pack-section').count()) === 7, await overflowX(mp))
  await shot(mp, `M-${w}${big ? '-big' : ''}-pack`)
  check(`M ${tag}: JS 오류 0`, errs.length === 0, errs.join(' | '))
  await m.close()
}

/* ---------------- D-267 · D-295 고정 키워드 5개(공고 칩) · 이번 주 키워드 10개(유튜브만) · 기준 한 줄 · 지난주와 비교 · 휴대폰 2열 ---------------- */
{
  const kst = (off = 0) => new Date(Date.now() + 9 * 3_600_000 + off * 86_400_000).toISOString().slice(0, 10)
  const d8 = (off) => kst(off).replace(/-/g, '')
  const item = (id, nm, realm, posted, end) => ({ pblancId: id, pblancNm: nm, jrsdInsttNm: '중소벤처기업부', excInsttNm: '', reqstBeginEndDe: `${d8(posted)} ~ ${d8(end)}`, pldirSportRealmLclasCodeNm: realm, trgetNm: '중소기업', bsnsSumryCn: '', pblancUrl: `https://www.bizinfo.go.kr/x?pblancId=${id}`, hashtags: '', creatPnttm: `${kst(posted)} 10:00:00` })
  const items = [
    item('G1', '2026 중소기업 정책자금 융자 4차 공고', '금융', -1, 5),
    item('G2', '신용보증 특례 지원 공고', '금융', -3, 20),
    item('G3', '지역 이차보전 지원사업', '금융', -5, 30),
    item('G4', '청년 채용 인건비 지원사업', '인력', -2, 25),
    item('G5', '중장년 일자리 장려금 참여기업 모집', '인력', 0, 40),
    item('G6', '지난달 정책자금 공고', '금융', -20, 10),
    item('S1', '2026 소상공인 경영개선 지원사업 모집', '경영', -1, 4),
    item('S2', '소상공인 디지털 전환 바우처', '경영', -4, 30),
    item('C1', '벤처기업 확인 설명회', '기술', -2, 9),
  ]
  const c = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const p = await c.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  await wire(p)
  await p.route('**/api/grants-feed*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fetchedAt: new Date().toISOString(), count: items.length, items }) }))
  await p.goto(BASE + '/', { waitUntil: 'networkidle' })
  await p.evaluate(seedScript())
  // 지난주 목록(이 브라우저 기록) — 지금 목록과 다르게
  const monday = (date) => {
    const t = Date.parse(`${date}T00:00:00Z`)
    const dow = new Date(t).getUTCDay()
    return new Date(t - ((dow + 6) % 7) * 86_400_000).toISOString().slice(0, 10)
  }
  const lastMon = new Date(Date.parse(`${monday(kst())}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10)
  await p.evaluate((lm) => localStorage.setItem('axmvp.mk.week_keys.v1', JSON.stringify({ [lm]: ['market:policy_fund', 'axai:claude', 'market:지난주만'] })), lastMon)
  await openHome(p)
  await p.waitForTimeout(800)
  const keyIds = await p.getByTestId('mk-key').evaluateAll((els) => els.map((e) => e.dataset.key))
  const fixedIds = await p.getByTestId('mk-fixed-key').evaluateAll((els) => els.map((e) => e.dataset.key))
  const fixedNames = (await p.getByTestId('mk-fixed-key').allInnerTexts()).map((t) => t.split('\n')[0].trim())
  const noteOf = async (key) => (await p.locator(`[data-testid="mk-fixed-key"][data-key="${key}"] [data-testid="mk-key-note"]`).innerText().catch(() => '')) ?? ''
  // D-295 대표: 정책자금 · 고용지원금 · 기업인증은 새 공고가 떴다고 이번 주 키워드에 올리지 말고 고정 키워드로(정부지원금 · 정부지원사업까지 5개)
  check('K1 고정 키워드 5개 — 정책자금 · 고용지원금 · 기업인증 · 정부지원금 · 정부지원사업(늘 그 자리)', JSON.stringify(fixedNames) === JSON.stringify(['정책자금', '고용지원금', '기업인증', '정부지원금', '정부지원사업']) && JSON.stringify(fixedIds) === JSON.stringify(['notice:policy_fund', 'notice:employ_subsidy', 'notice:certification', 'notice:sme_subsidy', 'notice:grant_program']), { fixedNames, fixedIds })
  check('K2 고정 키워드 칩 = 이번 주 새 공고 수(지난달 공고는 안 셈 · 1건도 · 없으면 칩 대신 짧은 설명)', (await noteOf('notice:policy_fund')) === '새 공고 3건' && (await noteOf('notice:employ_subsidy')) === '새 공고 2건' && (await noteOf('notice:sme_subsidy')) === '새 공고 2건' && (await noteOf('notice:certification')) === '새 공고 1건' && (await noteOf('notice:grant_program')) === '', { pf: await noteOf('notice:policy_fund'), cert: await noteOf('notice:certification') })
  const FIXED_TOPICS = ['policy_fund', 'employ_subsidy', 'certification', 'sme_subsidy', 'grant_program']
  check('K3 이번 주 키워드 10개는 유튜브에서 뜨는 주제만 — 고정 키워드 주제 · 공고 키워드 0(경영 × AI 다리 주제도)', keyIds.length === 10 && !keyIds.some((k) => k.startsWith('notice:') || FIXED_TOPICS.includes(k.split(':')[1])), keyIds)
  const basis = (await p.getByTestId('mk-basis').innerText()) ?? ''
  check('K4 기준 한 줄 — 이번 주 키워드: 벤치마킹 채널 최근 2주 · 고정 키워드 칩: 기업마당 이번 주(날짜) 새 공고 · 받는 때', basis.includes('최근 2주') && basis.includes('기업마당 이번 주') && /\d+\/\d+~\d+\/\d+/.test(basis) && basis.includes('6시간마다') && basis.includes('아침 9시'), basis)
  const change = (await p.getByTestId('mk-change').innerText().catch(() => '')) ?? ''
  const isNew = async (key) => (await p.locator(`[data-testid="mk-key"][data-key="${key}"] [data-testid="mk-key-new"]`).count()) === 1
  const newCount = await p.locator('[data-testid="mk-key"] [data-testid="mk-key-new"]').count()
  check('K5 지난주와 비교 한 줄 · 지난주에 없던 키워드에만 "새로"(Claude 는 지난주에도 있어 없음 · 정책자금은 빠진 것)', change.startsWith('지난주와 비교: 새로') && change.includes('빠진 것') && newCount > 0 && !(await isNew('axai:claude')), change)
  await shot(p, 'K-home')
  const k3 = p.locator('[data-testid="mk-fixed-key"][data-key="notice:sme_subsidy"]')
  await k3.click()
  await p.getByTestId('mk-pack').waitFor()
  await aiDone(p)
  await p.getByTestId('mk-pack-why-toggle').click()
  await p.waitForTimeout(200)
  const why = (await p.getByTestId('mk-pack-notices').innerText().catch(() => '')) ?? ''
  check('K6 고정 키워드(정부지원금) 누르면 묶음 — 왜 지금(이번 주 새 공고 2건 · 곧 마감) · 실제 공고 이름 · 마감 · [공고] 링크', why.includes('새로 2건') && why.includes('2026 소상공인 경영개선 지원사업 모집') && why.includes('마감') && (await p.getByTestId('mk-pack-notices').getByRole('link', { name: /공고/ }).count()) >= 2, why.slice(0, 300))
  const packAll = (await p.getByTestId('mk-pack').innerText()) ?? ''
  check('K7 묶음 머리 "고정 키워드" · 첫 문장 이번 주 공고 수(금액은 짓지 않음)', packAll.includes('고정 키워드') && packAll.includes('이번 주에만 정부지원금 공고가 2건') && !/\d+\s*억\s*원/.test(packAll), packAll.slice(0, 200))
  await shot(p, 'K-pack')
  await p.goBack()
  await p.getByTestId('mk-home').waitFor({ timeout: 10000 })
  await p.locator('[data-testid="mk-fixed-key"][data-key="notice:policy_fund"]').click()
  await p.getByTestId('mk-pack').waitFor()
  await aiDone(p)
  const pfText = (await p.getByTestId('mk-pack').innerText()) ?? ''
  const copied = await p.evaluate(() => document.querySelector('[data-testid="mk-pack"]')?.textContent ?? '')
  check('K8 고정 키워드 정책자금 묶음 — 이번 주 공고 근거(기업마당)', (pfText + copied).includes('이번 주 새 공고 3건(기업마당)') || (pfText + copied).includes('2026 중소기업 정책자금 융자 4차 공고'), pfText.slice(0, 120))
  await p.goBack()
  await p.getByTestId('mk-home').waitFor({ timeout: 10000 })
  await p.locator('[data-testid="mk-fixed-key"][data-key="notice:grant_program"]').click()
  await p.getByTestId('mk-pack').waitFor()
  await aiDone(p)
  const gpText = (await p.getByTestId('mk-pack').innerText()) ?? ''
  check('K8b 이번 주 새 공고가 없는 고정 키워드(정부지원사업)도 묶음이 열림 — 늘 찾는 본업 주제', gpText.includes('고정 키워드') && gpText.includes('정부지원사업'), gpText.slice(0, 160))
  // 휴대폰 — 고정 키워드 · 이번 주 키워드 모두 2열 · 넘침 0
  await p.setViewportSize({ width: 390, height: 844 })
  await p.goBack()
  await p.getByTestId('mk-home').waitFor({ timeout: 10000 })
  await p.waitForTimeout(400)
  const cols = (sel) => p.locator(sel).evaluateAll((els) => new Set(els.slice(0, 4).map((e) => Math.round(e.getBoundingClientRect().left))).size)
  check('K9 휴대폰 390 — 고정 키워드 · 이번 주 키워드 2열(1 2 / 3 4) · 넘침 0', (await overflowX(p)) <= 0 && (await cols('[data-testid="mk-fixed-key"]')) === 2 && (await cols('[data-testid="mk-key"]')) === 2, { ov: await overflowX(p), f: await cols('[data-testid="mk-fixed-key"]'), k: await cols('[data-testid="mk-key"]') })
  await shot(p, 'K-390')
  check('K JS 오류 0', errs.length === 0, errs.join(' | '))
  await c.close()
}

await browser.close()
console.log(`\nqa:mkpack: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
