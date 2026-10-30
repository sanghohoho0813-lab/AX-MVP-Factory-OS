/**
 * qa:mkkit — D-351 이번 주 찍을 것 '이렇게 찍으세요' 를 채널 설계 기준(본업)에 맞춰.
 * 브라우저 → /api/ai-assist 는 진짜 서버 함수(가짜 공급자) — qa:mkweek 와 같은 방식.
 *
 *   B  AI 주제 카드(Claude 활용 등) — 펼치면 '내 본업으로 잇기' 칩(채널 설계 기준의 본업) · 제목에 본업 · 첫 문장 · 이렇게 말해요가 본업으로
 *   C  다른 본업 칩(정책자금)을 누르면 제목 · 첫 문장이 그 본업으로 · 새로 고쳐도 고른 본업 그대로
 *   M  시장 주제(정책자금 · 가업승계)는 그대로 — 본업인 주제는 칩 없음
 *   A  [AI로 내 채널에 맞게 추천] 두 번 눌러 확인 → radar.kit 한 번 · 보낸 자료에 채널 설계 기준 · 후보 · 고른 본업 →
 *      AI 추천(틀 · 제목 · 첫 문장 · 썸네일 · 구성) · 규칙 추천 / AI 추천 바꿔 보기 · 새로 고쳐도 AI 추천 남음
 *   P  390 넘침 0 · 오류 0
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import fs from 'node:fs'
import { seedScript } from './seed.mjs'

const fromRoot = (p) => import(pathToFileURL(path.resolve(p)).href)
const { default: handler, __resetAiAssistState } = await fromRoot('api/ai-assist.js')

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.MKKIT_SHOTS ?? ''
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) {
    pass++
    console.log('PASS ', n)
  } else {
    fail++
    console.log('FAIL ', n, d === undefined ? '' : String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700))
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

const llm = []
let failing = ''
/** 스레드 — 자료의 '1번 U … / 2번 T …' 순서 그대로 틀 글자를 붙인다(한 갈래는 일부러 순서를 섞어 자리 맞추기를 본다) */
const threadsAnswer = (user) => {
  const tpl = [...user.matchAll(/(\d)번 ([A-X]) /g)].map((m) => m[2]).slice(0, 3)
  const topic = (/소재: ([^\n]+)/.exec(user) ?? [])[1]?.trim().slice(0, 30) ?? ''
  const order = tpl.includes('D') ? [tpl[1], tpl[0], tpl[2]] : tpl
  return {
    headline: `스레드 ${topic}`,
    items: order.map((t) => ({
      title: `AI 스레드 첫 줄 ${t}`,
      tag: t,
      body: `AI 스레드 첫 줄 ${t} — ${topic}\n\n둘째 줄 — 대표님이 자주 묻는 것\n\n${t === 'G' ? '자세한 건 https://example.com 에서' : '이 셋 중 몇 번이 제일 급해? 1 / 2 / 3'}`,
      when: '고르기 쉬운 질문',
      detail: `본인 댓글 ${t}`,
      outline: ['[대괄호] 확인'],
    })),
    next: ['경영컨설팅'],
  }
}
const shortsAnswer = (user) => {
  const reels = /인스타 릴스/.test(user)
  const k = reels ? '릴스' : '쇼츠'
  return {
    headline: `AI ${k}`,
    items: [
      { title: `AI ${k} 첫마디 1`, tag: '리스트형', when: reels ? '약 22초' : '약 40초', body: `[0:00] AI ${k} 대본 1 첫마디\n[0:03] 둘째, 숫자 하나\n[0:20] 끝`, detail: `AI ${k} 캡션 1`, outline: ['#중소기업', '#대표님'] },
      { title: `AI ${k} 첫마디 2`, tag: '화면 시연형', when: reels ? '약 20초' : '약 45초', body: `[0:00] AI ${k} 대본 2 첫마디\n[0:05] 화면 보여 주기\n[0:30] 끝`, detail: `AI ${k} 캡션 2`, outline: ['#AI'] },
    ],
    next: ['[공식 자료 확인] 숫자'],
  }
}
const LONG = {
  headline: 'AI 확정 제목 — 1주일치 롱폼',
  items: [
    { title: '0:00 오프닝', tag: '유튜브 대본', body: 'AI 롱폼 오프닝 — 결론부터 말씀드릴게요.', outline: ['쇼츠로 자를 곳 — 결론 장면'] },
    { title: '1:30 ① 첫 번째', tag: '유튜브 대본', body: 'AI 롱폼 챕터 1' },
    { title: '제목 후보', tag: '제목', outline: ['AI 롱폼 제목 1', 'AI 롱폼 제목 2'] },
    { title: '썸네일 문구', tag: '제목', outline: ['AI 썸네일'] },
  ],
  next: ['노트북 화면 녹화'],
}
const KIT = (user) => {
  const core = (/본업: ([^,\n|]+?)\s*\|[^\n]*이 본업으로/.exec(user) ?? [])[1] ?? ''
  return {
    headline: `AI 는 미끼 — ${core || '본업'} 준비에 붙여 대표님이 얻는 것까지(AI 추천 관점)`,
    items: [
      { title: `AI 추천 제목 숫자형 — ${core} 3가지`, tag: '제목', when: '숫자형' },
      { title: `AI 추천 제목 질문형 — ${core}?`, tag: '제목', when: '질문형' },
      { title: `AI 추천 제목 방법형 — ${core} 순서`, tag: '제목', when: '방법형' },
      { title: '첫 문장', tag: '첫 문장', body: `AI 추천 첫 문장 — ${core}` },
      { title: '썸네일', tag: '썸네일', outline: ['AI 썸네일 하나', 'AI 썸네일 둘'] },
      { title: '구성', tag: '구성', outline: ['0:00 결과 먼저', '1:00 따라 하기'] },
    ],
  }
}
const answerFor = (sys, user) => {
  if (sys.includes('(radar.kit')) return KIT(user)
  if (sys.includes('(threads.write')) return threadsAnswer(user)
  if (sys.includes('(shorts.write')) return shortsAnswer(user)
  if (sys.includes('(radar.pack.video')) return LONG
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
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answerFor(sys, user)) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 2100, candidatesTokenCount: 320 } }), { status: 200 })
  }
  if (url.includes('api.anthropic.com/v1/messages')) {
    const body = JSON.parse(String(init.body ?? '{}'))
    const sys = String(body.system ?? '')
    const user = String(body.messages?.[0]?.content ?? '')
    llm.push({ provider: 'anthropic', sys, user })
    if (failing && sys.includes(`(${failing}`)) return new Response(JSON.stringify({ error: { message: 'busy' } }), { status: 529 })
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answerFor(sys, user)) }], usage: { input_tokens: 1500, output_tokens: 200 }, stop_reason: 'end_turn', model: body.model }), { status: 200 })
  }
  if (/\/models(\?|$)/.test(url)) return new Response(JSON.stringify({ models: [], data: [] }), { status: 200 })
  return realFetch(input, init)
}

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

async function openPlan(p) {
  await p.goto(BASE + '/marketing', { waitUntil: 'networkidle' })
  await p.waitForTimeout(500)
  const sample = p.getByTestId('yt-sample')
  if (await sample.count()) {
    await sample.first().click()
    await p.waitForTimeout(900)
  }
  await p.getByTestId('radar-plan').waitFor({ timeout: 10000 })
}
const kitCalls = () => llm.filter((x) => x.sys.includes('(radar.kit'))
const overflowX = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const twice = async (loc) => {
  await loc.click()
  await loc.page().waitForTimeout(450)
  await loc.click()
}
/** AI 주제 카드(첫 번째) */
const aiCard = (p) => p.getByTestId('radar-plan').locator('[data-testid="radar-opp"][data-axis="axai"]').first()
const openKit = async (card) => {
  const kit = card.getByTestId('radar-kit')
  if ((await kit.getAttribute('data-open')) !== '1') await kit.getByTestId('radar-kit-toggle').click()
  await card.page().waitForTimeout(250)
  return kit
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await wire(page)
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(seedScript())
await page.evaluate(() => {
  localStorage.removeItem('axmvp.ai.choice.v1')
  localStorage.removeItem('axmvp.mkkit.v1')
  localStorage.removeItem('axmvp.mkbrand.v1')
  localStorage.removeItem('axmvp.fold.all')
  localStorage.setItem('axmvp.fold.mk-more', '1')
})
await openPlan(page)

/* ---------------- B 본업으로 이은 규칙 추천 ---------------- */
let card = aiCard(page)
const topic = (await card.getByTestId('radar-opp-topic').innerText()).trim()
let kit = await openKit(card)
const chips = await kit.getByTestId('radar-kit-core').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-core')}:${e.getAttribute('data-on')}:${e.textContent}`))
const onCore = chips.find((c) => c.split(':')[1] === '1') ?? ''
const coreLabel = onCore.split(':').slice(2).join(':')
check('B1 AI 주제 카드 — 내 본업으로 잇기 칩(AX · 시제품 · 벤처 · 정책자금 …) · 하나가 골라져 있음', chips.length >= 4 && chips.some((c) => c.startsWith('ax:')) && chips.some((c) => c.startsWith('policy:')) && !!onCore, chips)
const view = await kit.getByTestId('radar-view').innerText()
const hook = await kit.getByTestId('radar-kit-hook').innerText()
const titles = await kit.getByTestId('radar-kit-titles').innerText()
check('B2 이렇게 말해요 · 첫 문장 · 제목이 본업으로(기능 소개로 끝내지 않음) · 제목 여섯', view.includes('기능 소개로 끝내지 않습니다') && hook.includes('기능 말고') && (titles.match(/·/g) ?? []).length >= 6 && (onCore.startsWith('ax:') || titles.includes(coreLabel)), { topic, coreLabel, view: view.slice(0, 120), hook, titles: titles.slice(0, 300) })
await shot(page, 'B-kit-rule')

/* ---------------- C 칩으로 다른 본업 ---------------- */
await kit.locator('[data-testid="radar-kit-core"][data-core="policy"]').click()
await page.waitForTimeout(300)
card = page.getByTestId('radar-plan').locator('[data-testid="radar-opp"]', { has: page.getByText(topic, { exact: true }) }).first()
kit = await openKit(card)
const t2 = await kit.getByTestId('radar-kit-titles').innerText()
const h2 = await kit.getByTestId('radar-kit-hook').innerText()
check('C1 [정책자금] 칩 → 제목 · 첫 문장이 정책자금으로 · 칩 켜짐', t2.includes('정책자금') && h2.includes('정책자금') && (await kit.locator('[data-testid="radar-kit-core"][data-core="policy"]').getAttribute('data-on')) === '1', { t2: t2.slice(0, 200), h2 })
await openPlan(page)
card = page.getByTestId('radar-plan').locator('[data-testid="radar-opp"]', { has: page.getByText(topic, { exact: true }) }).first()
kit = await openKit(card)
check('C2 새로 고쳐도 고른 본업(정책자금) 그대로', (await kit.locator('[data-testid="radar-kit-core"][data-core="policy"]').getAttribute('data-on')) === '1' && (await kit.getByTestId('radar-kit-hook').innerText()).includes('정책자금'))

/* ---------------- M 시장 주제는 그대로 ---------------- */
const marketCards = page.getByTestId('radar-plan').locator('[data-testid="radar-opp"][data-axis="market"]')
const mInfo = []
for (let i = 0; i < Math.min(3, await marketCards.count()); i++) {
  const c = marketCards.nth(i)
  const k = await openKit(c)
  mInfo.push({ topic: (await c.getByTestId('radar-opp-topic').innerText()).trim(), chips: await k.getByTestId('radar-kit-core').count(), hook: (await k.getByTestId('radar-kit-hook').innerText()).slice(0, 40) })
}
check('M1 시장 주제(정책자금 · 고용지원금 …)는 그대로 — 본업인 주제는 칩 없음 · 아닌 주제(가업승계)는 [주제 그대로] 가 켜진 채', mInfo.length > 0 && mInfo.every((m) => !m.hook.includes('기능 말고')) && mInfo.filter((m) => /정책자금|고용지원금/.test(m.topic)).every((m) => m.chips === 0), mInfo)

/* ---------------- A AI 추천 ---------------- */
card = page.getByTestId('radar-plan').locator('[data-testid="radar-opp"]', { has: page.getByText(topic, { exact: true }) }).first()
kit = await openKit(card)
const n0 = kitCalls().length
const run = kit.getByTestId('radar-kit-ai-run')
await run.click()
await page.waitForTimeout(400)
check("A1 한 번 누르면 확인(아직 안 부름)", kitCalls().length === n0)
delayMs = 600
await run.click()
await kit.getByTestId('radar-kit-ai-result').waitFor({ timeout: 15000 }).catch(() => {})
delayMs = 0
const sent = kitCalls().slice(n0)
const u = sent[0]?.user ?? ''
check('A2 radar.kit 한 번 · 보낸 자료에 채널 설계 기준 · 이 후보 · 고른 본업(정책자금 = 이 본업으로) · 규칙집 없이도 본업 목록', sent.length === 1 && u.includes('채널 설계 기준') && u.includes(topic) && /본업: 정책자금[^\n]*이 본업으로/.test(u) && u.includes('우리가 실제로 하는 일'), u.slice(0, 400))
const aiTxt = await kit.getByTestId('radar-kit-ai-result').innerText().catch(() => '')
check('A3 AI 추천 — 이렇게 말해요 · 첫 문장 · 제목(숫자형 · 질문형 · 방법형) · 썸네일 · 구성', aiTxt.includes('AI 추천 관점') && aiTxt.includes('AI 추천 첫 문장') && aiTxt.includes('숫자형') && aiTxt.includes('AI 추천 제목 질문형') && aiTxt.includes('AI 썸네일 하나') && aiTxt.includes('구성 2줄'), aiTxt.slice(0, 300))
await shot(page, 'A-kit-ai')
await kit.locator('[data-testid="radar-kit-tab"][data-tab="rule"]').click()
await page.waitForTimeout(200)
check('A4 [규칙 추천] 으로 바꿔 보기 → 규칙 제목 · 다시 [AI 추천]', (await kit.getByTestId('radar-kit-ai-result').count()) === 0 && (await kit.getByTestId('radar-kit-titles').count()) === 1)
await kit.locator('[data-testid="radar-kit-tab"][data-tab="ai"]').click()
await openPlan(page)
card = page.getByTestId('radar-plan').locator('[data-testid="radar-opp"]', { has: page.getByText(topic, { exact: true }) }).first()
kit = await openKit(card)
check('A5 새로 고쳐도 AI 추천 남음 · AI 다시 안 부름', (await kit.getByTestId('radar-kit-ai-result').count()) === 1 && kitCalls().length === n0 + 1)
check('A6 오류 0', errors.length === 0, errors)
await ctx.close()

/* ---------------- P 휴대폰 ---------------- */
{
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const p = await c.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  await wire(p)
  await p.goto(BASE + '/', { waitUntil: 'networkidle' })
  await p.evaluate(seedScript())
  await p.evaluate(() => { localStorage.removeItem('axmvp.fold.all'); localStorage.setItem('axmvp.fold.mk-more', '1') })
  await openPlan(p)
  const k = await openKit(aiCard(p))
  await k.scrollIntoViewIfNeeded()
  check('P1 390 — 칩 · AI 단추 · 제목 넘침 0 · 오류 0', (await overflowX(p)) <= 0 && (await k.getByTestId('radar-kit-core').count()) >= 4 && errs.length === 0, { ox: await overflowX(p), errs })
  await shot(p, 'P-390')
  await c.close()
}

await browser.close()
console.log(`\n이렇게 찍으세요 맞춤: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
