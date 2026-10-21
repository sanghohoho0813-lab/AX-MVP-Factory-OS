/**
 * qa:sideai — D-254 AI 옆 창(머리줄 [ChatGPT 옆에]).
 * 대표: "모니터가 하나라서 OS 를 보면서 ChatGPT 를 옆에 띄워 놓고 싶다".
 * 밖(ChatGPT · Claude · Gemini)은 이 상자에서 못 가므로 가짜 쪽 하나로 바꿔 받는다 — 창이 열리는 자리 · 이름 · OS 비키기만 본다.
 *
 *   S1 PC 머리줄에 단추 · 휴대폰에는 없음
 *   S2 누르면 판 — AI 셋 · 폭 셋 · 기본 ChatGPT · 보통
 *   S3 [옆에 열기] → 창 하나(이름 mirae-side-ai) · 화면 오른쪽 · OS 본문이 그만큼 왼쪽으로 비킴 · 가로 넘침 0
 *   S4 Claude 로 바꾸면 같은 창이 Claude 로(창이 둘이 되지 않음)
 *   S5 [닫기] → 창 닫힘 · 비킨 여백 0 / 사용자가 창을 직접 닫아도 여백 0
 *   S6 팝업이 막히면 푸는 법 안내
 *   S7 [OS 도 왼쪽 창으로] → 같은 주소의 OS 창이 왼쪽에
 *   S8 고른 AI · 폭은 다시 열어도 기억
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.SIDEAI_SHOTS ?? ''
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
const shot = async (page, name) => {
  if (!SHOTS) return
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.waitForTimeout(250)
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) })
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, screen: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
// 밖 AI 사이트 대신 가짜 쪽 — 어느 주소로 열렸는지만 본다
for (const host of ['https://chatgpt.com/**', 'https://claude.ai/**', 'https://gemini.google.com/**']) {
  await ctx.route(host, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: `<html><body><h1>${new URL(r.request().url()).host}</h1></body></html>` }))
}
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(seedScript())
await page.evaluate(() => localStorage.removeItem('axmvp.ui.side_ai'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

const btn = page.getByTestId('side-ai-button')
check('S1 PC 머리줄에 [ChatGPT 옆에] 단추', (await btn.isVisible()) && (await btn.getAttribute('aria-label')).includes('ChatGPT'))
await btn.click()
const panel = page.getByTestId('side-ai-panel')
await panel.waitFor()
const services = await page.getByTestId('side-ai-service').evaluateAll((els) => els.map((e) => `${e.dataset.id}:${e.getAttribute('aria-checked')}`))
const widths = await page.getByTestId('side-ai-width').evaluateAll((els) => els.map((e) => `${e.dataset.id}:${e.getAttribute('aria-checked')}`))
check('S2 판 — AI 셋(ChatGPT 기본) · 폭 셋(보통 기본) · 열기 · OS 왼쪽 창 · 단축키 안내', services.join() === 'chatgpt:true,claude:false,gemini:false' && widths.join() === 'third:false,twofifths:true,half:false' && (await page.getByTestId('side-ai-open').count()) === 1 && (await page.getByTestId('side-ai-os-left').count()) === 1 && (await panel.innerText()).includes('Win+'), { services, widths })
await shot(page, 'S2-panel')

const [popup] = await Promise.all([ctx.waitForEvent('page'), page.getByTestId('side-ai-open').click()])
await popup.waitForLoadState()
await page.waitForTimeout(300)
const name = await popup.evaluate(() => window.name)
const reserve = Number((await page.locator('[data-side-reserve]').getAttribute('data-side-reserve').catch(() => '0')) ?? 0)
const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
check(`S3 [옆에 열기] → ChatGPT 창 하나(이름 mirae-side-ai) · OS 본문 오른쪽 ${reserve}px 비킴 · 가로 넘침 0 · 단추가 '열림'`, popup.url().startsWith('https://chatgpt.com/') && name === 'mirae-side-ai' && reserve > 0 && over <= 0 && (await btn.getAttribute('data-open')) === '1', { url: popup.url(), name, reserve, over })
await shot(page, 'S3-reserved')

const pagesBefore = ctx.pages().length
await page.locator('[data-testid="side-ai-service"][data-id="claude"]').click()
await page.waitForTimeout(800)
check('S4 Claude 로 바꾸면 같은 창이 Claude 로 — 창이 늘지 않음', popup.url().startsWith('https://claude.ai/') && ctx.pages().length === pagesBefore, { url: popup.url(), pages: ctx.pages().length })

await page.getByTestId('side-ai-close').click()
await page.waitForTimeout(400)
check('S5a [닫기] → 창 닫힘 · 비킨 여백 0', popup.isClosed() && (await page.locator('[data-side-reserve]').count()) === 0 && (await btn.getAttribute('data-open')) === '0')

const [popup2] = await Promise.all([ctx.waitForEvent('page'), page.getByTestId('side-ai-open').click()])
await popup2.waitForLoadState()
await popup2.close()
await page.waitForTimeout(1800)
check('S5b 사용자가 AI 창을 직접 닫아도 → 여백 0 · 단추 원래대로', (await page.locator('[data-side-reserve]').count()) === 0 && (await btn.getAttribute('data-open')) === '0')

// 팝업 막힘 — 브라우저가 새 창을 주지 않는 경우
await page.evaluate(() => {
  window.__realOpen = window.open
  window.open = () => null
})
await page.getByTestId('side-ai-open').click()
await page.waitForTimeout(200)
check('S6 팝업이 막히면 → "팝업 차단 → 항상 허용" 안내', (await page.getByTestId('side-ai-blocked').count()) === 1 && (await page.getByTestId('side-ai-blocked').innerText()).includes('항상 허용'))
await shot(page, 'S6-blocked')
await page.evaluate(() => {
  window.open = window.__realOpen
})

const [osWin] = await Promise.all([ctx.waitForEvent('page'), page.getByTestId('side-ai-os-left').click()])
await osWin.waitForLoadState()
check('S7 [OS 도 왼쪽 창으로] → 같은 OS 주소의 새 창(이름 mirae-os-left) · 안내 한 줄', new URL(osWin.url()).origin === new URL(BASE).origin && (await osWin.evaluate(() => window.name)) === 'mirae-os-left' && (await page.getByTestId('side-ai-os-note').count()) === 1)
await osWin.close()

await page.locator('[data-testid="side-ai-width"][data-id="half"]').click()
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('side-ai-button').click()
const kept = await page.getByTestId('side-ai-service').evaluateAll((els) => els.filter((e) => e.getAttribute('aria-checked') === 'true').map((e) => e.dataset.id))
const keptW = await page.getByTestId('side-ai-width').evaluateAll((els) => els.filter((e) => e.getAttribute('aria-checked') === 'true').map((e) => e.dataset.id))
check('S8 다시 열어도 고른 AI(Claude) · 폭(반반) 기억 · 단추 이름도 Claude', kept.join() === 'claude' && keptW.join() === 'half' && (await page.getByTestId('side-ai-button').getAttribute('aria-label')).includes('Claude'), { kept, keptW })
await page.keyboard.press('Escape')
await page.waitForTimeout(150)
check('S8b Esc 로 판 닫힘', (await page.getByTestId('side-ai-panel').count()) === 0)
check('PC JS 오류 0', errors.length === 0, errors.join(' | '))
await ctx.close()

// 휴대폰에는 없음(앱을 오가는 편이 빠르다)
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
const mp = await m.newPage()
await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
await mp.evaluate(seedScript())
await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
await mp.waitForTimeout(500)
const mVisible = await mp.getByTestId('side-ai-button').isVisible().catch(() => false)
const mOver = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
check('S9 휴대폰(390) — 단추 없음 · 넘침 0', !mVisible && mOver <= 0, { mVisible, mOver })
await m.close()

await browser.close()
console.log(`\nqa:sideai: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
