/**
 * D-300 홈페이지 만들기 AI 도우미 시험 — 대표 "홈페이지 만들기에도 AI 단추".
 * 브라우저 → /api/ai-assist 는 진짜 서버 함수(api/ai-assist.js)를 이 프로세스에서 부른다(qa:threads 와 같은 방식). 밖으로 나가는 것만 가짜.
 *
 *  1440  초안 → 머리 띠 아래 AI 도우미 판(문구 · 자주 묻는 질문 · 검색 정보 단추 · 직접 묻기 · 모델)
 *        [홈페이지 문구 다시 쓰기] → 보낸 자료(회사 · 업종 · 지금 블록 · 견본 표시 / 대표 이름 · 사업자번호 · 전화 · 메일 0) · 답마다 [이 블록에 넣기]
 *        첫 화면 [이 블록에 넣기] → 미리보기 큰 문구 바뀜 · 견본 표시 빠짐 · [되돌리기] 로 돌아감 · 하는 일 → 목록 3줄
 *        [자주 묻는 질문 5개] → 블록이 없으면 만들어 넣음 · [검색 정보에 넣기] → 검색 제목 · 직접 묻기 → site.ask · 고른 모델(Claude)
 *        서버 — 팀장(pilot) 은 site 단추 403(대표 전용 화면)
 *  390   AI 도우미 띠 · 가로 넘침 0
 *
 *   node e2e/siteai.mjs http://localhost:4390
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import fs from 'node:fs'
import { seedScript } from './seed.mjs'

const fromRoot = (p) => import(pathToFileURL(path.resolve(p)).href)
const { default: handler, __resetAiAssistState } = await fromRoot('api/ai-assist.js')

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.SITEAI_SHOTS ?? ''
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const OWNER = 'Bearer owner-e2e-token-aaaaaaaaaaaa'
const PILOT = 'Bearer pilot-e2e-token-bbbbbbbbbbbb'
for (const k of Object.keys(process.env)) if (/^(AI_|OPENAI_|SUPABASE_|GEMINI_|GOOGLE_API|ANTHROPIC_API|CLAUDE_API)/.test(k)) delete process.env[k]
Object.assign(process.env, { SUPABASE_URL: 'https://qa.supabase.test', SUPABASE_ANON_KEY: 'qa-anon', GEMINI_API_KEY: 'gem-e2e-SECRET-1', ANTHROPIC_API_KEY: 'ant-e2e-SECRET-2', AI_ASSIST_RATE_PER_MIN: '100', AI_ASSIST_RATE_PER_HOUR: '500' })
__resetAiAssistState()

/** 단추마다 가짜 답 — 요청 줄([요청] …)로 고른다 */
const ANSWERS = {
  '홈페이지 문구 다시 쓰기': {
    headline: '화성 정밀 부품 · 금형을 한곳에서',
    items: [
      { title: '도면 한 장이면\n시제품부터 양산까지', tag: '첫 화면', body: '화성 동탄산단에서 정밀 금속부품 · 금형 · 시제품 가공을 한곳에서 합니다.' },
      { title: '12년 정밀 가공 회사', tag: '회사 소개', body: '한솔정밀은 정밀 금속부품과 금형을 만드는 회사입니다. 시제품 가공부터 양산 준비까지 한곳에서 맡습니다.' },
      { title: '하는 일', tag: '하는 일', outline: ['정밀 가공 — 금속부품을 도면대로', '금형 — 설계부터 제작까지', '시제품 — 소량도 빠르게'] },
      { title: '도면이 있으면 바로 상담', tag: '연락 권유', body: '전화 한 통이면 일정과 방법을 알려 드려요.' },
    ],
    next: ['설립 연도 확인'],
  },
  '자주 묻는 질문 5개': {
    headline: '처음 맡기는 손님이 묻는 것',
    items: [
      { title: '소량 시제품도 맡길 수 있나요?', body: '네, 한 개부터 상담할 수 있어요. 수량에 맞는 방법을 알려 드려요.' },
      { title: '도면이 없으면 어떻게 하나요?', body: '샘플이나 사진으로도 상담할 수 있어요. 자세한 것은 상담 때 정확히 알려 드려요.' },
    ],
    next: [],
  },
  '검색 제목 · 설명 3가지': {
    headline: '첫째를 추천',
    items: [{ title: '한솔정밀 | 화성 정밀 부품 · 금형', detail: '화성 동탄산단에서 정밀 금속부품 · 금형 · 시제품 가공을 한곳에서.', tag: '지역 + 하는 일' }],
    next: [],
  },
  '홈페이지 — 직접 물어본 것에 답': { headline: '첫 화면 문구는 짧을수록 좋아요', items: [{ title: '도면 한 장이면 시작', detail: '짧은 안' }], next: [] },
}

const llm = []
const answerFor = (user) => {
  const req = /\[요청\]\s*([^\n]+)/.exec(user)?.[1] ?? ''
  const key = Object.keys(ANSWERS).find((k) => req.includes(k)) ?? '홈페이지 — 직접 물어본 것에 답'
  return ANSWERS[key]
}
const realFetch = globalThis.fetch
globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  const h = init.headers ?? {}
  if (url.startsWith('https://qa.supabase.test/auth/v1/user')) {
    const who = h.Authorization === OWNER ? 'owner-1' : h.Authorization === PILOT ? 'pilot-1' : ''
    return new Response(JSON.stringify({ id: who || 'x' }), { status: who ? 200 : 401 })
  }
  if (url.startsWith('https://qa.supabase.test/rest/v1/rpc/has_capability')) return new Response(JSON.stringify(h.Authorization === OWNER), { status: 200 })
  if (url.startsWith('https://qa.supabase.test/rest/v1/rpc/my_os_access')) return new Response(JSON.stringify(h.Authorization === PILOT ? 'pilot' : 'full'), { status: 200 })
  if (url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent')) {
    const body = JSON.parse(String(init.body ?? '{}'))
    const sys = String(body.systemInstruction?.parts?.[0]?.text ?? '')
    const user = String(body.contents?.[0]?.parts?.[0]?.text ?? '')
    llm.push({ sys, user, provider: 'gemini', model: /models\/([^:]+):/.exec(url)?.[1] ?? '' })
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answerFor(user)) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 2100, candidatesTokenCount: 320 } }), { status: 200 })
  }
  if (url.includes('api.anthropic.com/v1/messages')) {
    const body = JSON.parse(String(init.body ?? '{}'))
    const user = String(body.messages?.[0]?.content ?? '')
    llm.push({ sys: String(body.system ?? ''), user, provider: 'anthropic', model: body.model })
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answerFor(user)) }], usage: { input_tokens: 1500, output_tokens: 200 }, stop_reason: 'end_turn', model: body.model }), { status: 200 })
  }
  if (/\/models(\?|$)/.test(url)) return new Response(JSON.stringify({ models: [], data: [] }), { status: 200 })
  return realFetch(input, init)
}
async function callServer(auth, body) {
  const res = { statusCode: 200, headers: {}, raw: '', setHeader(k, v) { this.headers[k] = v }, end(b) { this.raw = b ?? '' } }
  await handler({ method: 'POST', url: '/api/ai-assist', headers: { authorization: auth }, body: JSON.stringify(body) }, res)
  return { status: res.statusCode, body: res.raw ? JSON.parse(res.raw) : null }
}
async function wire(page) {
  await page.route('**/api/ai-assist**', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    const res = { statusCode: 200, headers: {}, raw: '', setHeader(k, v) { this.headers[k] = v }, end(b) { this.raw = b ?? '' } }
    await handler({ method: req.method(), url: u.pathname + u.search, headers: { authorization: OWNER }, body: req.postData() ?? undefined }, res)
    await route.fulfill({ status: res.statusCode, headers: { 'content-type': 'application/json' }, body: res.raw })
  })
}

const NOW = '2026-09-01T00:00:00.000Z'
const FULL = {
  id: 'cli_site',
  companyName: '한솔정밀(주)',
  representativeName: '김한솔',
  contactName: '박담당',
  businessNumber: '1234567890',
  establishedAt: '2014-03-02',
  businessCategory: '제조업',
  businessItem: '정밀 금속부품, 금형, 시제품 가공',
  businessAddress: '경기도 화성시 동탄산단 6길 15',
  employeeCount: '42',
  companyPhone: '031-123-4567',
  contactPhone: '010-9999-8888',
  contactEmail: 'hello@hansol.co.kr',
  status: 'active',
  factValues: { certifications: '벤처기업, 이노비즈, ISO 9001', patents: '금형 냉각 구조', researchLab: '인정(2019)' },
  createdAt: NOW,
  updatedAt: NOW,
}
async function seed(page) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate((row) => {
    const k = 'axmvp.v1.operations_clients'
    const list = JSON.parse(localStorage.getItem(k) ?? '[]').filter((r) => r.id !== row.id)
    list.push(row)
    localStorage.setItem(k, JSON.stringify(list))
    for (const key of Object.keys(localStorage)) if (key.startsWith('axmvp.module.homepage') || key === 'axmvp.ai.choice.v1' || key === 'axmvp.ai.history.v1') localStorage.removeItem(key)
  }, FULL)
}
const frameHtml = (page) => page.locator('[data-testid="site-frame"]').evaluate((f) => f.contentDocument?.documentElement.outerHTML ?? '')
const runPreset = async (page, label) => {
  await page.getByTestId('ai-assist-bar').getByTestId('ai-assist-open').click()
  await page.getByTestId('ai-assist-preset').filter({ hasText: label }).click()
  await page.getByTestId('ai-assist-confirm-go').click()
  await page.getByTestId('ai-assist-result').waitFor({ timeout: 10000 })
  await wait(200)
}
const act = (page, id) => page.locator(`[data-testid="ai-assist-action"][data-action="${id}"]`)

const browser = await chromium.launch()
const errors = []

{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('dialog', (d) => void d.accept())
  await wire(page)
  await seed(page)
  await page.goto(BASE + '/tools/homepage/build?client=cli_site', { waitUntil: 'networkidle' })
  await page.getByTestId('site-create').click()
  await page.getByTestId('site-builder').waitFor()
  await wait(600)

  const bar = page.getByTestId('ai-assist-bar')
  const chips = await bar.getByTestId('ai-assist-chip').allInnerTexts()
  check('S1 머리 띠 아래 AI 도우미 판 — 문구 · 자주 묻는 질문 · 검색 정보 단추 · 직접 묻기 · 모델 고르기', (await bar.count()) === 1 && chips.join('|') === '홈페이지 문구 다시 쓰기|자주 묻는 질문 5개|검색 제목 · 설명 3가지' && (await bar.getByTestId('ai-assist-ask-chip').count()) === 1 && (await bar.getByTestId('ai-assist-model-chip').count()) === 1, chips)
  await shot(page, 'site-ai-bar')

  // 문구 다시 쓰기
  const before = llm.length
  await runPreset(page, '홈페이지 문구 다시 쓰기')
  const sent = llm.length > before ? llm.at(-1) : null
  check('S2 [홈페이지 문구 다시 쓰기] → AI 한 번 · 보낸 자료에 회사 · 하는 일 · 지역 · 지금 블록(견본 그대로)', !!sent && llm.length - before === 1 && sent.user.includes('한솔정밀') && sent.user.includes('정밀 금속부품') && sent.user.includes('화성시') && sent.user.includes('견본 그대로'), sent?.user.slice(0, 300))
  check('S3 보낸 자료에 대표 이름 · 담당자 · 사업자번호 · 전화 · 휴대폰 · 메일 · 번지 0', !!sent && !/김한솔|박담당|1234567890|123-45-67890|031-123-4567|010-9999-8888|hello@hansol|6길 15/.test(sent.user + sent.sys))
  check('S4 답마다 [이 블록에 넣기](4개)', (await act(page, 'site-put').count()) === 4)
  await shot(page, 'site-ai-copy')
  await act(page, 'site-put').first().click()
  await wait(400)
  await page.keyboard.press('Escape')
  await wait(500)
  const html1 = await frameHtml(page)
  const heroRow = page.locator('[data-block-row][data-type="hero"]').first()
  check('S5 첫 화면 [이 블록에 넣기] → 미리보기 큰 문구 · 설명이 바뀜 · 첫 화면 블록이 열림', html1.includes('도면 한 장이면') && html1.includes('한곳에서 합니다') && (await heroRow.count()) === 1)
  await page.getByTestId('site-undo').click()
  await wait(500)
  check('S6 [되돌리기] → 견본 문구로 돌아감', !(await frameHtml(page)).includes('도면 한 장이면'))
  await page.getByTestId('site-redo').click()
  await wait(400)

  // 하는 일 — 지난 답 다시 열기 대신 다시 질문
  await runPreset(page, '홈페이지 문구 다시 쓰기')
  await act(page, 'site-put').nth(2).click()
  await wait(400)
  await page.keyboard.press('Escape')
  await wait(500)
  const html2 = await frameHtml(page)
  check('S7 하는 일 → 목록 3줄(이름 · 설명)', html2.includes('정밀 가공') && html2.includes('금속부품을 도면대로') && html2.includes('설계부터 제작까지') && html2.includes('소량도 빠르게'))

  // 자주 묻는 질문 — 블록이 없으면 만들어서
  const faqBefore = await page.locator('[data-block-row][data-type="faq"]').count()
  await runPreset(page, '자주 묻는 질문 5개')
  await act(page, 'site-faq-put').first().click()
  await wait(300)
  await act(page, 'site-faq-put').nth(1).click()
  await wait(300)
  await page.keyboard.press('Escape')
  await wait(500)
  const html3 = await frameHtml(page)
  check(`S8 [자주 묻는 질문에 넣기] 두 번 → 질문 2개(블록이 ${faqBefore ? '있으면 그 블록' : '없어서 새로 만들어'})`, (await page.locator('[data-block-row][data-type="faq"]').count()) === 1 && html3.includes('소량 시제품도 맡길 수 있나요?') && html3.includes('도면이 없으면 어떻게 하나요?'))

  // 검색 정보
  await runPreset(page, '검색 제목 · 설명 3가지')
  await act(page, 'site-seo-put').first().click()
  await wait(300)
  await page.keyboard.press('Escape')
  await wait(500)
  check('S9 [검색 정보에 넣기] → 홈페이지 <title> · 설명', (await frameHtml(page)).includes('<title>한솔정밀 | 화성 정밀 부품 · 금형</title>'))

  // 모델 바꾸고 직접 묻기
  await bar.getByTestId('ai-assist-model-chip').click()
  await page.getByTestId('model-pick-panel').locator('[data-provider="anthropic"]').click()
  await page.getByTestId('model-pick-panel').getByTestId('ai-assist-model-option').filter({ hasText: 'Claude Haiku 5.5' }).click()
  await page.keyboard.press('Escape')
  await bar.getByTestId('ai-assist-ask-chip').click()
  await page.getByTestId('ai-assist-panel').waitFor({ timeout: 5000 })
  const ph = await page.getByTestId('ai-assist-ask').getAttribute('placeholder')
  const b2 = llm.length
  await page.getByTestId('ai-assist-ask').fill('첫 화면 큰 문구를 더 짧게 세 가지')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.querySelector('[data-testid="ai-assist-result"]')?.getAttribute('data-assist') === 'site.ask', null, { timeout: 10000 }).catch(() => {})
  const asked = llm.length > b2 ? llm.at(-1) : null
  check('S10 직접 묻기 — 예가 홈페이지에 맞는 말 · site.ask · 고른 모델(claude-haiku-5-5) · 적은 말 그대로', /첫 화면/.test(ph ?? '') && !!asked && asked.model === 'claude-haiku-5-5' && asked.user.includes('[대표가 더 묻는 것] 첫 화면 큰 문구를 더 짧게 세 가지') && asked.user.includes('홈페이지 — 직접 물어본 것에 답'), { ph, m: asked?.model })
  await page.keyboard.press('Escape')
  check('S11 PC — JS 오류 0', errors.length === 0, errors)
  await ctx.close()
}

/* 서버 — 팀장 · 고객은 홈페이지 단추 막힘(대표 전용 화면) */
{
  const b = llm.length
  const r = await callServer(PILOT, { requestId: 'req-site-pilot-0001', assistId: 'site.copy', page: 'site', context: { title: 't', today: '2026-10-27', sections: [] } })
  check('S12 팀장(pilot)이 site.copy 를 부르면 403 · AI 호출 0', r.status === 403 && llm.length === b, r)
}

/* 휴대폰 390 */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  await wire(page)
  await seed(page)
  await page.goto(BASE + '/tools/homepage/build?client=cli_site', { waitUntil: 'networkidle' })
  await page.getByTestId('site-create').click()
  await page.getByTestId('site-builder').waitFor()
  await wait(500)
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('M1 390 — AI 도우미 띠 · 가로 넘침 0 · JS 오류 0', (await page.getByTestId('ai-assist-bar').count()) === 1 && over <= 0 && errs.length === 0, { over, errs })
  await shot(page, 'site-ai-390')
  await ctx.close()
}

await browser.close()
console.log(`\nsite-ai: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
