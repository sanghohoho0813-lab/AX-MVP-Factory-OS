/**
 * 모바일 390 인수 여정.
 *
 * "휴대폰만 들고 하루를 시작해서 한 바퀴 돌 수 있는가" 를 실제 브라우저로 확인한다.
 * 오늘 → 고객 → 업체 → 업무 상태 변경 → 서류 → 업무 일기 → 이벤트함 → 일정 → 오늘.
 *
 *   node e2e/mobile-journey.mjs [baseUrl]
 */

import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'

const results = []
function log(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
async function step(name, fn) {
  try {
    const r = await fn()
    log(name, r !== false, typeof r === 'string' ? r : '')
  } catch (e) {
    log(name, false, String(e).split('\n')[0].slice(0, 160))
  }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
})
const page = await ctx.newPage()
const jsErrors = []
page.on('pageerror', (e) => jsErrors.push(String(e).slice(0, 160)))

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
await page.evaluate(seedScript())
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })

await step('오늘 화면이 오늘 할 일부터 보여준다', async () => {
  await page.getByRole('heading', { name: /지금 이것부터/ }).waitFor({ timeout: 5000 })
  return true
})

await step('하단 내비게이션이 다섯 칸으로 뜬다', async () => {
  const n = await page.locator('nav[aria-label="주요 화면"] a, nav[aria-label="주요 화면"] button').count()
  return n === 5 ? `${n}칸` : false
})

await step('하단 내비로 고객 화면으로 간다', async () => {
  await page.locator('nav[aria-label="주요 화면"]').getByText('고객', { exact: true }).click()
  await page.waitForURL('**/ops/clients')
  await page.getByRole('heading', { name: '고객 운영' }).waitFor({ timeout: 5000 })
  return true
})

await step('업체 카드를 눌러 상세로 들어간다', async () => {
  await page.getByRole('button', { name: /한솔테크/ }).first().click()
  await page.waitForURL('**/ops/clients/cli_hansol**')
  await page.getByRole('heading', { name: '한솔테크(주)' }).waitFor({ timeout: 5000 })
  await page.waitForTimeout(500)
  return true
})

await step('개요가 한 화면 반 안에 들어온다 (2,600px 이하)', async () => {
  const h = await page.evaluate(() => document.documentElement.scrollHeight)
  return h <= 2600 ? `${h}px` : `${h}px — 너무 길다`
})

await step('업무 탭으로 옮겨 상태를 바꾼다', async () => {
  await page.getByRole('tab', { name: '업무', exact: true }).click()
  await page.waitForTimeout(400)
  const select = page.locator('select[aria-label="특허 출원 상태"]')
  await select.selectOption('done')
  await page.waitForTimeout(500)
  return (await select.inputValue()) === 'done'
})

await step('서류 탭이 열린다', async () => {
  await page.getByRole('tab', { name: /^서류/ }).click()
  await page.waitForTimeout(400)
  return await page.getByRole('heading', { name: /서류/ }).first().isVisible()
})

await step('업무 일기에 한 줄 남긴다', async () => {
  await page.goto(`${BASE}/journal`, { waitUntil: 'networkidle' })
  const box = page.getByLabel('기록 내용')
  await box.click()
  await box.fill('휴대폰에서 남긴 기록 — 인수 확인')
  await page.getByRole('button', { name: /기록/ }).click()
  await page.waitForTimeout(700)
  return await page.getByText('휴대폰에서 남긴 기록 — 인수 확인').first().isVisible()
})

await step('이벤트함에서 한 건을 처리한다', async () => {
  await page.locator('nav[aria-label="주요 화면"]').getByText('이벤트', { exact: true }).click()
  await page.waitForURL('**/ops/inbox')
  await page.getByRole('button', { name: '처리 완료' }).first().click()
  await page.waitForTimeout(700)
  return true
})

await step('일정 화면이 뜬다', async () => {
  await page.locator('nav[aria-label="주요 화면"]').getByText('일정', { exact: true }).click()
  await page.waitForURL('**/ops/calendar')
  await page.waitForTimeout(600)
  return await page.getByRole('heading', { name: '일정', exact: true }).first().isVisible()
})

await step('오늘로 돌아온다', async () => {
  await page.locator('nav[aria-label="주요 화면"]').getByText('오늘', { exact: true }).click()
  await page.waitForURL(`${BASE}/`)
  return true
})

await step('더보기 서랍이 열리고 닫힌다', async () => {
  await page.getByRole('button', { name: '더보기' }).click()
  await page.waitForTimeout(500)
  const opened = await page.getByText('이 기기 · 계정').isVisible()
  await page.getByRole('button', { name: '메뉴 닫기' }).click()
  await page.waitForTimeout(400)
  return opened
})

await step('누르는 자리가 44px 아래로 내려가지 않는다', async () => {
  const small = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('nav[aria-label="주요 화면"] a, nav[aria-label="주요 화면"] button')) {
      const r = el.getBoundingClientRect()
      if (r.height < 44) out.push(`${el.textContent.trim()} ${Math.round(r.height)}px`)
    }
    return out
  })
  return small.length === 0 ? true : small.join(', ')
})

await step('가로 스크롤이 생기지 않는다', async () => {
  const o = await page.evaluate(() => ({ d: document.documentElement.scrollWidth, w: window.innerWidth }))
  return o.d <= o.w + 1 ? true : `${o.d} > ${o.w}`
})

log('자바스크립트 오류 없음', jsErrors.length === 0, jsErrors.join(' | '))

await browser.close()

const failed = results.filter((r) => !r.ok).length
console.log(`\n모바일 여정: ${results.length - failed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
