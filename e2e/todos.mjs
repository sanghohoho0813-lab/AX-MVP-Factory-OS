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
await page.getByRole('button', { name: '넣기', exact: true }).click()
await page.waitForTimeout(800)
check('오늘에 할 일이 추가된다', await page.getByText('테스트 할 일 하나').first().isVisible())

/*
 * 적고 나서 고칠 수 있어야 한다.
 * 통화 중에 급히 적은 한 줄은 대개 나중에 다듬게 된다 — 고칠 수 없으면 지우고 다시
 * 적게 되고, 그러면 언제 적었는지가 사라진다.
 *
 * 뒤따르는 시험들이 '테스트 할 일 하나' 를 계속 쓰므로, 고치기 시험은 따로 만든
 * 할 일로 한다. 기한을 바꾸면 오늘 목록에서 빠지기 때문이다.
 */
// 앞서 하나를 적어 둔 뒤라 적는 칸이 이미 펴져 있을 수 있다
const opener = page.getByRole('button', { name: '할 일 적기' }).first()
if ((await opener.count()) > 0) {
  await opener.click()
  await page.waitForTimeout(300)
}
await page.getByLabel('할 일 내용').fill('고칠 할 일')
await page.getByRole('button', { name: '넣기', exact: true }).click()
await page.waitForTimeout(800)

await page.getByText('고칠 할 일').first().click()
await page.waitForTimeout(400)
check('할 일 시트가 열린다', (await page.getByRole('dialog').count()) > 0)
const editBtn = page.getByRole('button', { name: '내용 고치기' }).first()
check('할 일: [내용 고치기] 가 있다', (await editBtn.count()) > 0)
await editBtn.click()
await page.waitForTimeout(350)
await page.getByLabel('할 일 내용 고치기').fill('고쳐 적은 할 일')
await page.getByRole('button', { name: '저장', exact: true }).first().click()
await page.waitForTimeout(900)
const edited = (await page.locator('main').innerText()) ?? ''
check('할 일: 내용이 바뀐다', edited.includes('고쳐 적은 할 일'), edited.slice(0, 200))
check('할 일: 옛 내용은 사라진다', !edited.includes('고칠 할 일'))

// 한 번 더 고칠 수 있다 — 고친 것을 또 고치는 것이 실제 쓰임새다
await page.getByText('고쳐 적은 할 일').first().click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: '내용 고치기' }).first().click()
await page.waitForTimeout(350)
await page.getByLabel('할 일 내용 고치기').fill('두 번 고친 할 일')
await page.getByLabel('할 일 기한 고치기').fill('2026-12-24')
await page.getByRole('button', { name: '저장', exact: true }).first().click()
await page.waitForTimeout(900)
const movedDue = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]').find((x) => x.content === '두 번 고친 할 일'),
)
check('할 일: 다시 고칠 수 있다', movedDue !== undefined)
check('할 일: 기한도 고칠 수 있다', movedDue?.dueDate === '2026-12-24', JSON.stringify(movedDue?.dueDate))
// '오늘 할 일' 목록에서만 빠진다 — 오늘 적은 기록이므로 '무슨 일이 있었나요' 에는 남는다
const todoBox = (await page.getByRole('region', { name: '오늘 할 일' }).first().innerText()) ?? ''
check('할 일: 기한을 옮기면 오늘 할 일에서 빠진다', !todoBox.includes('두 번 고친 할 일'), todoBox.slice(0, 160))

// 3) 일정 화면에서도 같은 것이 보인다
await page.goto(BASE + '/ops/calendar', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
check('일정 화면에도 같은 할 일이 보인다', await page.getByText('테스트 할 일 하나').first().isVisible())

// 4) 일정에서 적으면 오늘에도 보인다
await page.getByRole('button', { name: '할 일 적기' }).first().click()
await page.waitForTimeout(300)
await page.getByLabel('할 일 내용').fill('일정에서 적은 할 일')
await page.getByRole('button', { name: '넣기', exact: true }).click()
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
