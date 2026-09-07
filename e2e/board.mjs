/**
 * 고객 목록에서 바로 고치기 — 브라우저 인수 시험.
 *
 *   node e2e/board.mjs <baseUrl>
 *
 * 지키려는 것
 *   1. 업무가 15개로 늘어도 가로로 밀 일이 없다 (표를 버린 이유)
 *   2. 목록에서 바꾼 상태가 업체 기록에 실제로 저장된다 (화면용 사본이 아니다)
 *   3. '해당 없음' 은 가로선으로 지워지고, 다시 되돌릴 수 있다
 */

import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('PASS ', name) }
  else { fail++; console.log('FAIL ', name, detail ?? '') }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
page.on('pageerror', (e) => check('JS 오류 없음', false, String(e).slice(0, 160)))

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(seedScript())
await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

// 가로 넘침 없음
const of = await page.evaluate(() => ({ d: document.documentElement.scrollWidth, w: window.innerWidth }))
check('가로 스크롤 없음', of.d <= of.w + 1, `${of.d} > ${of.w}`)

// 업무 조각을 눌러 상태 시트를 연다
const chip = page.getByRole('button', { name: /^특허/ }).first()
await chip.click()
await page.waitForTimeout(400)
check('상태 시트가 열린다', await page.getByRole('dialog').isVisible())
check('해당 없음 선택지가 있다', await page.getByRole('button', { name: /해당 없음/ }).first().isVisible())

await page.getByRole('button', { name: /해당 없음/ }).first().click()
await page.waitForTimeout(600)
check('시트가 닫힌다', (await page.getByRole('dialog').count()) === 0)

// 조각이 가로선으로 지워졌는지
const struck = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'))
  const el = btns.find((b) => (b.textContent || '').trim().startsWith('특허'))
  if (!el) return null
  return getComputedStyle(el).textDecorationLine
})
check('해당 없음은 가로선으로 지운다', String(struck).includes('line-through'), String(struck))

// 새로고침해도 남아 있는지 (실제 저장)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(700)
const stored = await page.evaluate(() => {
  const raw = localStorage.getItem('axmvp.v1.operations_clients')
  if (!raw) return null
  const list = JSON.parse(raw)
  const c = list.find((r) => r.id === 'cli_hansol')
  return c?.services?.patent?.status ?? null
})
check('새로고침 뒤에도 저장돼 있다', stored === 'not_applicable', String(stored))

// 다시 되돌릴 수 있는지
await page.getByRole('button', { name: /^특허/ }).first().click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /진행 중/ }).first().click()
await page.waitForTimeout(600)
const back = await page.evaluate(() => {
  const list = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
  return list.find((r) => r.id === 'cli_hansol')?.services?.patent?.status ?? null
})
check('해당 없음에서 다시 바꿀 수 있다', back === 'in_progress', String(back))

// 수금 시트
await page.getByRole('button', { name: /^미수금/ }).first().click()
await page.waitForTimeout(400)
check('수금 시트가 열린다', await page.getByRole('dialog').isVisible())
check('수금 항목 넣기 칸이 있다', await page.getByRole('button', { name: '넣기' }).isVisible())
await page.getByRole('button', { name: '닫기' }).first().click().catch(() => page.keyboard.press('Escape'))
await page.waitForTimeout(300)

// 15개까지 늘려도 가로로 넘치지 않는지
await page.evaluate(() => {
  const raw = localStorage.getItem('axmvp.v1.custom_services')
  const extra = Array.from({ length: 9 }, (_, i) => ({
    id: `cs${i}`, workspaceId: null, key: `custom_extra${i}`, label: `추가업무${i + 1}`,
    shortLabel: `추가${i + 1}`, description: '', accent: 'ops', recurring: false,
    requiredDocuments: [], enabled: true, order: 100 + i,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  }))
  localStorage.setItem('axmvp.v1.custom_services', JSON.stringify(extra))
  void raw
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const chips = await page.evaluate(() => document.querySelectorAll('button').length)
const of2 = await page.evaluate(() => ({ d: document.documentElement.scrollWidth, w: window.innerWidth }))
check('업무 15개에서도 가로 스크롤 없음', of2.d <= of2.w + 1, `${of2.d} > ${of2.w} (버튼 ${chips}개)`)

await browser.close()
console.log(`\n목록 바로 고치기: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
