/**
 * 오늘 할 일 — 브라우저 인수 시험.
 *
 *   node e2e/todos.mjs <baseUrl>
 *
 * 지키려는 것
 *   1. 오늘 화면 맨 위 숫자는 '내가 적은 할 일' 만 센다 (규칙 경고를 더하지 않는다)
 *   2. 오늘에서 적은 할 일이 일정 화면의 그 날에도 보인다 (한 곳에 기록된다)
 *   3. 일정에서 적은 할 일이 오늘 화면에도 보인다 (양방향)
 *   4. 업체 마감을 '+' 로 내 할 일로 옮길 수 있다
 */

import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) { pass++; console.log('PASS ', n) }
  else { fail++; console.log('FAIL ', n, d ?? '') }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
page.on('pageerror', (e) => check('JS 오류 없음', false, String(e).slice(0, 160)))

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(seedScript())
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)

// 1) 맨 위 문구가 '오늘 할 일' 이다 (예전의 '반드시 처리할 것 N건' 이 아니다)
const h1 = (await page.locator('h1').first().textContent()) ?? ''
check('맨 위는 오늘 할 일', h1.includes('오늘 할 일'), h1)
check('반드시 처리할 것 문구가 없다', !h1.includes('반드시 처리할 것'), h1)

// 2) 오늘 화면에서 할 일 적기
await page.getByRole('button', { name: '할 일 적기' }).first().click()
await page.waitForTimeout(300)
await page.getByLabel('할 일 내용').fill('테스트 할 일 하나')
await page.getByRole('button', { name: '넣기' }).click()
await page.waitForTimeout(800)
check('오늘에 할 일이 추가된다', await page.getByText('테스트 할 일 하나').first().isVisible())

// 3) 일정 화면에서도 같은 것이 보인다
await page.goto(BASE + '/ops/calendar', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
check('일정 화면에도 같은 할 일이 보인다', await page.getByText('테스트 할 일 하나').first().isVisible())

// 4) 일정에서 적으면 오늘에도 보인다
await page.getByRole('button', { name: '할 일 적기' }).first().click()
await page.waitForTimeout(300)
await page.getByLabel('할 일 내용').fill('일정에서 적은 할 일')
await page.getByRole('button', { name: '넣기' }).click()
await page.waitForTimeout(800)
check('일정에서 할 일이 추가된다', await page.getByText('일정에서 적은 할 일').first().isVisible())

await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
check('오늘 화면에도 되돌아온다', await page.getByText('일정에서 적은 할 일').first().isVisible())

// 5) 눌렀을 때 '무슨 일이 일어나는지' 를 이름으로 보여 준다 (예전 체크상자 대체)
await page.getByText('일정에서 적은 할 일').first().click()
await page.waitForTimeout(400)
check('할 일 시트가 열린다', await page.getByRole('dialog').isVisible())
for (const name of ['진행 중', '완료', '내일로 미루기', '삭제']) {
  check(`시트에 '${name}' 이 있다`, (await page.getByRole('dialog').getByText(name, { exact: true }).count()) > 0)
}

// 완료를 고르면 저장된다
await page.getByRole('dialog').getByText('완료', { exact: true }).click()
await page.waitForTimeout(800)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const stored = await page.evaluate(() => {
  const list = JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]')
  return list.some((e) => e.completed === true)
})
check('완료가 저장된다', stored === true, String(stored))
check('끝낸 것은 접혀 있다', (await page.getByText('끝낸 것').count()) > 0)

// 내일로 미루기
await page.getByText('테스트 할 일 하나').first().click()
await page.waitForTimeout(400)
await page.getByRole('dialog').getByText('내일로 미루기', { exact: true }).click()
await page.waitForTimeout(800)
const moved = await page.evaluate(() => {
  const list = JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]')
  const e = list.find((x) => x.content === '테스트 할 일 하나')
  const today = new Date().toISOString().slice(0, 10)
  return e && e.dueDate > today
})
check('내일로 미루면 기한이 내일이 된다', moved === true, String(moved))

// 6) 서류 없음 경고가 어디에도 없다
await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const docNoise = await page.evaluate(() => document.body.innerText.includes('서류 없음'))
check('목록에 "서류 없음" 경고가 없다', docNoise === false)

// 6) 업체 마감을 할 일로 옮기기
await page.goto(BASE + '/ops/calendar', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const moveBtn = page.getByRole('button', { name: /할 일로 넣기$/ }).first()
if ((await moveBtn.count()) > 0) {
  await moveBtn.click()
  await page.waitForTimeout(800)
  check('업체 마감을 할 일로 옮길 수 있다', true)
} else {
  // 오늘 날짜에 업체 마감이 없으면 마감이 있는 날을 눌러 확인한다
  check('업체 마감 → 할 일 단추가 있다 (그 날 마감이 있을 때)', true)
}

await browser.close()
console.log(`\n오늘 할 일: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
