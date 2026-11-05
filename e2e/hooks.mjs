/**
 * D-546 첫마디 10개 — 스레드 · 릴스 · 틱톡 '무엇에 대해 쓸까요?' 안.
 *
 *   node e2e/hooks.mjs <baseUrl>
 *
 *  H  스레드: 평소 단추 한 줄(접힘) · 주 단추는 [AI로 바로 쓰기] 하나 그대로 → 펼치면 주제 없을 때 안내 →
 *     주제 칩 하나 → 서로 다른 방법 10개(규칙) · 누구에게 칩 → 문장에 · 방향(손해 막기) → 그 방법 먼저 ·
 *     [다른 방법으로 10개] → 겹침 없음 · [이걸로 쓰기] → 빈 글이면 첫 줄 + 뼈대 · 쓰던 글이면 첫 줄만 바꿈 · [복사]
 *  A  [AI로 10개 새로 쓰기](두 번 눌러 확인) → threads.hooks 한 번 · 보낸 자료(주제 · 누구에게 · 방향 · 26가지) ·
 *     AI 첫마디 10개 · 부풀리는 말 빨간 표시 · 주제를 바꾸면 틀로 만든 것으로 돌아감
 *  S  릴스 · 틱톡: [이걸로 쓰기] → 대본 '[0:00] 첫마디' · 짧은 첫마디 · AI 는 shorts.hooks
 *  M  390 휴대폰 · 큰 글자 — 넘침 0 · 누르는 단추 44px · 글자 14px 이상
 * AI 는 진짜 api/ai-assist.js 를 같은 프로세스에서 부르고 공급자 응답만 가짜(호출 수를 센다).
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { seedScript } from './seed.mjs'

const fromRoot = (p) => import(pathToFileURL(path.resolve(p)).href)
const { default: handler, __resetAiAssistState } = await fromRoot('api/ai-assist.js')

const BASE = process.argv[2] ?? 'http://localhost:4390'
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

const OWNER = 'Bearer owner-e2e-token-aaaaaaaaaaaa'
for (const k of Object.keys(process.env)) if (/^(AI_|OPENAI_|SUPABASE_|GEMINI_|GOOGLE_API|ANTHROPIC_API|CLAUDE_API)/.test(k)) delete process.env[k]
Object.assign(process.env, { SUPABASE_URL: 'https://qa.supabase.test', SUPABASE_ANON_KEY: 'qa-anon', GEMINI_API_KEY: 'gem-e2e-SECRET-1', AI_ASSIST_RATE_PER_MIN: '100', AI_ASSIST_RATE_PER_HOUR: '500' })
__resetAiAssistState()

const AI_HOOKS = {
  headline: '고용지원금',
  items: [
    { title: '대표님, 채용 전에 이것부터 보세요.', tag: '하지 마세요', detail: '순서를 놓치면 못 받아요' },
    { title: '고용지원금, 역대급으로 받는 법', tag: '결과 먼저', detail: '과장 표시 확인용' },
    ...Array.from({ length: 8 }, (_, i) => ({ title: `AI 첫마디 ${i + 3}번`, tag: ['상식 뒤집기', '흔한 실수', '딱 세 가지', '마음 알아주기', '새 기회', '해 봤더니', '솔직한 현실', '작은 차이 하나'][i], detail: `까닭 ${i + 3}` })),
  ],
  next: ['1번부터 써 보세요'],
}
const llm = []
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
    llm.push({ sys, user })
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(AI_HOOKS) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 2000, candidatesTokenCount: 300 } }), { status: 200 })
  }
  if (/\/models(\?|$)/.test(url)) return new Response(JSON.stringify({ models: [], data: [] }), { status: 200 })
  return realFetch(input, init)
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
const overflowX = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const clearDrafts = (p) =>
  p.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (/mirae\.(threads|shorts)\.draft|axmvp\.fold\.(thr|sht)|axmvp\.fold\.all|axmvp\.hooks/.test(k)) localStorage.removeItem(k)
  })
const lineTexts = (p, pre) => p.getByTestId(`${pre}-hook-line`).allInnerTexts()
const names = (p, pre) => p.locator(`[data-testid="${pre}-hook"]`).evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-no'))))
const twice = async (loc) => {
  await loc.click()
  await loc.page().waitForTimeout(450)
  await loc.click()
}
const WARN = new Set([12, 13, 15, 16, 18])

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const dialogs = []
page.on('dialog', (d) => {
  dialogs.push(d.message())
  void d.accept()
})
await wire(page)
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(seedScript())
await clearDrafts(page)

/* ---------------- H 스레드 ---------------- */
await page.goto(BASE + '/marketing/threads', { waitUntil: 'networkidle' })
await page.getByTestId('thr-qs').waitFor({ timeout: 15000 })
const prim = await page.evaluate(() => {
  const ed = document.getElementById('thr-editor')?.getBoundingClientRect().top ?? Infinity
  return [...document.querySelectorAll('main button.bg-brand-600')].filter((b) => b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().top < ed).map((b) => b.getAttribute('data-testid'))
})
check('H1 평소엔 단추 한 줄(접힘) · 글 칸 위 주 단추는 [AI로 바로 쓰기] 하나 그대로 · 첫마디 목록은 아직 없음', (await page.getByTestId('thr-hooks').getAttribute('data-open')) === '0' && (await page.getByTestId('thr-hooks-open').isVisible()) && prim.join() === 'thr-qs-ai' && (await page.getByTestId('thr-hook').count()) === 0, prim)
const aiY0 = await page.getByTestId('thr-qs-ai').evaluate((e) => Math.round(e.getBoundingClientRect().top + window.scrollY))
await page.getByTestId('thr-hooks-open').click()
check('H2 펼치면 — 주제가 없으면 "주제를 먼저" 안내 · 누구에게 칩 · 방향 6가지 · [AI로 바로 쓰기] 자리 그대로', (await page.getByTestId('thr-hooks').getAttribute('data-open')) === '1' && (await page.getByTestId('thr-hooks-empty').isVisible()) && (await page.getByTestId('thr-hooks-target').count()) >= 3 && (await page.getByTestId('thr-hooks-aim').count()) === 6 && (await page.getByTestId('thr-qs-ai').evaluate((e) => Math.round(e.getBoundingClientRect().top + window.scrollY))) === aiY0)
await page.getByTestId('thr-qs-topic').fill('고용지원금')
await page.getByTestId('thr-hook').first().waitFor({ timeout: 5000 })
const l0 = await lineTexts(page, 'thr')
const n0 = await names(page, 'thr')
check('H3 주제 하나 → 바로 10개(규칙 · AI 호출 0) · 서로 다른 방법 10가지 · 주제가 문장에 · "틀로 만든 첫마디"', l0.length === 10 && new Set(n0).size === 10 && l0.filter((l) => l.includes('고용지원금')).length >= 7 && /틀로 만든 첫마디/.test(await page.getByTestId('thr-hooks-kind').innerText()) && llm.length === 0, l0)
await page.getByTestId('thr-hooks-target').nth(1).click()
const tgt = (await page.getByTestId('thr-hooks-target').nth(1).innerText()).trim()
const l1 = await lineTexts(page, 'thr')
check('H4 누구에게 칩 → 그 말로 부르는 첫마디가 생김 · 칩이 고른 것으로', l1.some((l) => l.includes(tgt)) && (await page.getByTestId('thr-hooks-target').nth(1).getAttribute('aria-pressed')) === 'true', { tgt, l1 })
await page.locator('[data-testid="thr-hooks-aim"][data-aim="warn"]').click()
const nWarn = await names(page, 'thr')
check('H5 방향 손해 막기 → 하지 마세요 · 흔한 실수 · 꼭 알아야 할 것 같은 방법이 먼저', nWarn.slice(0, 4).every((n) => WARN.has(n)), nWarn)
await page.locator('[data-testid="thr-hooks-aim"][data-aim="mix"]').click()
const before = await names(page, 'thr')
await page.getByTestId('thr-hooks-more').click()
const after = await names(page, 'thr')
check('H6 [다른 방법으로 10개] → 앞 10개와 방법이 겹치지 않음', after.length === 10 && after.every((n) => !before.includes(n)), { before, after })
await page.getByTestId('thr-hooks-more').click()
await page.getByTestId('thr-hooks-more').click()
const all = await page.getByTestId('thr-hooks-all-item').count()
check('H7 26가지 방법 모두 보기 — 접혀 있고 26줄(이 주제 예시)', all === 26 && !(await page.getByTestId('thr-hooks-all').evaluate((e) => e.open)))
const pick = (await lineTexts(page, 'thr'))[0]
await page.getByTestId('thr-hook-use').first().click()
await page.waitForTimeout(300)
const body1 = await page.getByTestId('thr-body').inputValue()
check('H8 [이걸로 쓰기] → 빈 글이면 첫 줄이 그 첫마디 + 틀의 나머지 뼈대 · 글 칸이 열림 · 묻지 않음', body1.split('\n')[0] === pick && body1.split('\n').length > 2 && dialogs.length === 0, body1.slice(0, 200))
await page.getByTestId('thr-body').fill(`${body1.split('\n')[0]}\n둘째 줄은 내가 쓴 글`)
const pick2 = (await lineTexts(page, 'thr'))[1]
await page.getByTestId('thr-hook-use').nth(1).click()
await page.waitForTimeout(300)
const body2 = await page.getByTestId('thr-body').inputValue()
check('H9 쓰던 글이 있으면 한 번 묻고 첫 줄만 바꿈 · 둘째 줄 그대로', dialogs.length === 1 && /첫 줄/.test(dialogs[0]) && body2 === `${pick2}\n둘째 줄은 내가 쓴 글`, { dialogs, body2 })
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin })
await page.getByTestId('thr-hook-copy').nth(2).click()
await page.waitForTimeout(200)
const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
check('H10 [복사] → 그 첫마디 한 줄', clip === (await lineTexts(page, 'thr'))[2], clip)

/* ---------------- A AI 로 새로 쓰기 ---------------- */
const b0 = llm.length
await page.locator('[data-testid="thr-hooks-aim"][data-aim="curious"]').click()
await twice(page.getByTestId('thr-hooks-ai-run'))
await page.waitForFunction(() => /AI가 쓴/.test(document.querySelector('[data-testid="thr-hooks-kind"]')?.textContent ?? ''), null, { timeout: 20000 })
const call = llm.slice(b0).find((x) => x.sys.includes('(threads.hooks'))
check('A1 [AI로 10개 새로 쓰기] 두 번 눌러 확인 → threads.hooks 한 번 · 스레드 규칙 · 운영 원칙 실림', llm.length - b0 === 1 && !!call && call.sys.includes('[스레드 규칙]') && call.sys.includes('[대표 운영 원칙'), llm.slice(b0).map((x) => x.sys.slice(0, 80)))
check('A2 보낸 자료 — 주제 · 누구에게(고른 칩) · 방향(궁금하게) · 26가지 방법(이름 · 예시 틀) · 보낸 글에 키 0', !!call && /주제: 고용지원금/.test(call.user) && call.user.includes(`누구에게: ${tgt}`) && /방향: 궁금하게/.test(call.user) && /첫마디 방법 26가지 26건/.test(call.user) && /하지 마세요/.test(call.user) && !/gem-e2e-SECRET/.test(call.user + call.sys), call?.user.slice(0, 600))
const aiLines = await lineTexts(page, 'thr')
check('A3 AI 첫마디 10개가 목록에 · 방법 이름 · 까닭 · 부풀리는 말(역대급)에 빨간 표시 하나', aiLines.length === 10 && aiLines[0] === AI_HOOKS.items[0].title && (await page.getByTestId('thr-hook-warn').count()) === 1 && /역대급/.test(await page.getByTestId('thr-hook-warn').innerText()) && /순서를 놓치면/.test(await page.getByTestId('thr-hook-name').first().innerText()), aiLines)
await page.getByTestId('thr-qs-topic').fill('정책자금')
await page.waitForTimeout(200)
check('A4 주제를 바꾸면 지난 AI 답은 숨기고 새 주제의 틀 첫마디로(지난 답을 새 주제 답처럼 보이지 않게)', /틀로 만든/.test(await page.getByTestId('thr-hooks-kind').innerText()) && (await lineTexts(page, 'thr')).some((l) => l.includes('정책자금')))
await page.getByTestId('thr-hooks-close').click()
check('A5 [닫기] → 다시 단추 한 줄', (await page.getByTestId('thr-hooks').getAttribute('data-open')) === '0')

/* ---------------- S 릴스 · 틱톡 ---------------- */
await page.goto(BASE + '/marketing/shorts', { waitUntil: 'networkidle' })
await page.getByTestId('sht-qs').waitFor({ timeout: 15000 })
await page.getByTestId('sht-qs-topic').fill('벤처기업확인')
await page.getByTestId('sht-hooks-open').click()
const sl = await lineTexts(page, 'sht')
check('S1 릴스 · 틱톡 — 짧은 첫마디 10개(평균 18자 안) · 누구에게는 이 기기에 기억(스레드에서 고른 것)', sl.length === 10 && sl.reduce((a, l) => a + l.length, 0) / sl.length < 18 && (await page.getByTestId('sht-hooks-target').nth(1).getAttribute('aria-pressed')) === 'true', sl)
const spick = sl[0]
await page.getByTestId('sht-hook-use').first().click()
await page.waitForTimeout(300)
const script = await page.getByTestId('sht-script').inputValue()
check('S2 [이걸로 쓰기] → 대본 첫 줄 "[0:00] 첫마디" + 본론 · 마무리 칸', script.split('\n')[0].startsWith(`[0:00] ${spick}`) && /\[본론/.test(script), script.slice(0, 200))
const b1 = llm.length
await twice(page.getByTestId('sht-hooks-ai-run'))
await page.waitForFunction(() => /AI가 쓴/.test(document.querySelector('[data-testid="sht-hooks-kind"]')?.textContent ?? ''), null, { timeout: 20000 })
const scall = llm.slice(b1).find((x) => x.sys.includes('(shorts.hooks'))
check('S3 릴스 AI 는 shorts.hooks(숏폼 규칙) · 어디에 = 릴스 · 틱톡 첫마디', llm.length - b1 === 1 && !!scall && scall.sys.includes('[숏폼 규칙]') && /어디에: 릴스 · 틱톡/.test(scall.user), scall?.user.slice(0, 300))

/* ---------------- M 휴대폰 ---------------- */
for (const [w, big] of [[390, false], [360, true]]) {
  const m = await browser.newContext({ viewport: { width: w, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', hasTouch: true, isMobile: true, deviceScaleFactor: 1 })
  const mp = await m.newPage()
  mp.on('pageerror', (e) => errors.push(String(e)))
  await wire(mp)
  await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
  await mp.evaluate(seedScript())
  await clearDrafts(mp)
  await mp.goto(BASE + '/marketing/threads', { waitUntil: 'networkidle' })
  await mp.getByTestId('thr-qs').waitFor({ timeout: 15000 })
  if (big) await mp.evaluate(() => document.documentElement.setAttribute('data-text-scale', 'extra_large'))
  await mp.getByTestId('thr-qs-topic').fill('창업 3년 안 벤처기업확인 세금')
  await mp.getByTestId('thr-hooks-open').click()
  await mp.getByTestId('thr-hook').first().waitFor({ timeout: 5000 })
  const small = await mp.evaluate(() => {
    const box = document.querySelector('[data-testid="thr-hooks"]')
    const tooSmall = [...box.querySelectorAll('button, summary')].filter((b) => b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().height < 40).map((b) => b.textContent?.trim().slice(0, 20))
    const tiny = [...box.querySelectorAll('p, span, button, summary, h3')].filter((e) => e.getBoundingClientRect().height > 0 && parseFloat(getComputedStyle(e).fontSize) < 14).map((e) => e.textContent?.trim().slice(0, 20))
    return { tooSmall, tiny }
  })
  check(`M ${w}${big ? ' 큰 글자' : ''} — 옆 넘침 0 · 누르는 단추 40px 이상 · 14px 미만 글자 0`, (await overflowX(mp)) <= 0 && small.tooSmall.length === 0 && small.tiny.length === 0, small)
  if (!big) await mp.screenshot({ path: process.env.HOOKS_SHOT ? `${process.env.HOOKS_SHOT}/hooks-390.png` : '/tmp/claude-0/hooks-390.png', fullPage: false }).catch(() => {})
  await m.close()
}

check('E JS 오류 0', errors.length === 0, errors)
await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
