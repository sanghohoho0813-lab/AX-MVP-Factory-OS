/**
 * D-628 오른쪽 대화창 사진 — 눈으로 볼 것(통과/실패 없음).
 *   node e2e/dockchat-shots.mjs <baseUrl> <폴더>
 * PC 1440 · 휴대폰 390 에서 정책자금 · 특허 · 벤처 · 마케팅 유튜브: 처음(시작 카드) → [대화 시작] → 질문 하나.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const OUT = process.argv[3] ?? '.dockchat-out'
fs.mkdirSync(OUT, { recursive: true })

const SCREENS = [
  ['policy', '/tools/policy-funding'],
  ['pv', '/patent-venture'],
  ['youtube', '/marketing?view=plan'],
  ['mk-home', '/marketing'],
  ['cert', '/tools/cert-os'],
  ['threads', '/marketing/threads'],
]

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const vp of [
  { tag: 'pc', width: 1440, height: 900 },
  { tag: 'phone', width: 390, height: 844 },
]) {
  const phone = vp.width < 768
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: phone, hasTouch: phone, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  // AI 는 꺼 둔다 — 정해진 답 · 판 모양만 본다
  await page.route('**/api/ai-assist**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '사진 — AI 꺼 둠' }) }))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(() => {
    localStorage.removeItem('axmvp.chatfirst.v1')
    localStorage.removeItem('axmvp.fold.all')
  })
  for (const [name, url] of SCREENS) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    await page.screenshot({ path: path.join(OUT, `${vp.tag}-${name}-1-first.png`) })
    // 휴대폰 · 좁은 화면은 [대화] 단추로 연다
    const launch = page.getByTestId('page-chat-launch')
    if (await launch.isVisible().catch(() => false)) {
      await launch.click()
      await page.waitForTimeout(500)
    }
    const start = page.getByTestId('chat-start')
    if (await start.isVisible().catch(() => false)) {
      await start.click()
      await page.waitForTimeout(400)
    }
    await page.screenshot({ path: path.join(OUT, `${vp.tag}-${name}-2-started.png`) })
    const starter = page.getByTestId('chat-starter').first()
    if (await starter.isVisible().catch(() => false)) {
      await starter.click()
      await page.waitForTimeout(700)
      await page.screenshot({ path: path.join(OUT, `${vp.tag}-${name}-3-answer.png`) })
      await page.getByTestId('chat-clear').click().catch(() => {})
    }
    const sheetClose = page.getByTestId('page-chat-sheet-close')
    if (await sheetClose.isVisible().catch(() => false)) await sheetClose.click()
  }
  console.log(vp.tag, 'JS 오류', errs.length, errs.slice(0, 3))
  await ctx.close()
}
await browser.close()
console.log('사진:', OUT)
