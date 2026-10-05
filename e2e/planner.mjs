/**
 * 일정 달력 — 쉬는 날 · 바로 적기 · 반복 (D-139).
 *
 *  1440  2026년 10월로 → '2026년 공휴일 넣기' → 10/5 대체공휴일 · 10/9 한글날 빨간 날짜 · 영업일 20일
 *        → 10/12 를 두 번 눌러 바로 적기 · 매월 4번(주말이면 앞 영업일) → 할 일 4줄(12/12 토 → 12/11)
 *        → 10/20 부터 2일 '회사 휴무' → 영업일 18일 → 10/21 표시 지우기 → 19일
 *        → 날짜 칸(큰 달력)에도 쉬는 날 빨간 날짜 · 오류 0
 *  360 아주 큰 글자  빨간 날짜 · 이름 · 두 번 눌러 적기 창 · 가로 넘침 0
 *
 *   node e2e/planner.mjs http://localhost:4390
 */
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.argv[3] ?? ''
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' ' + detail}`)
}

async function goMonth(page, y, m) {
  for (let i = 0; i < 40; i++) {
    const cur = await page.locator('main').getByText(/^\d{4}년 \d{1,2}월$/).first().innerText()
    const [cy, cm] = cur.match(/\d+/g).map(Number)
    if (cy === y && cm === m) return true
    await page.getByRole('button', { name: cy * 12 + cm < y * 12 + m ? '다음 달' : '이전 달' }).click()
    await page.waitForTimeout(80)
  }
  return false
}
const cell = (page, d) => page.locator(`main button[data-date="${d}"]`)
// 오늘 칸은 '오늘' 모양(흰 숫자 · 처음부터 골라 둠)이라 — 시험할 날은 오늘이 아닌 날로 고른다
const TODAY_KST = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
const notToday = (...days) => days.find((d) => d !== TODAY_KST) ?? days[0]
const OFF_WEEKDAY = notToday('2026-10-05', '2026-10-09')
const TAP_DAY = OFF_WEEKDAY
const OFF_NAME = OFF_WEEKDAY === '2026-10-05' ? '대체공휴일' : '한글날'
const summary = (page) => page.getByTestId('calendar-month-summary').innerText()

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  // 쉬는 날(10/9 한글날)에 걸린 업체 마감 하나 — 수금 예정일을 옮겨 둔다
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    for (const c of list) for (const f of c.fees ?? []) if (f.id === 'fee4') f.dueDate = '2026-10-09'
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(list))
  })
  await page.goto(BASE + '/ops/calendar', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('달력: 2026년 10월로', await goMonth(page, 2026, 10))

  // 공휴일 넣기
  await page.getByTestId('holiday-import-open').click()
  await page.waitForTimeout(300)
  const list = await page.getByTestId('holiday-import').innerText()
  check('공휴일 넣기: 2026년 20일 · 대체공휴일 · ★ 음력 확인 안내', list.includes('대체공휴일(개천절)') && list.includes('한글날') && list.includes('정부 발표로 한 번 확인') && (await page.getByTestId('holiday-import').locator('input[type=checkbox]').count()) === 20)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/holiday-import-1440.png` })
  await page.getByTestId('holiday-import-save').click()
  await page.waitForTimeout(700)
  check('공휴일 넣기: 넣었다고 알림', (await page.locator('body').innerText()).includes('쉬는 날 20일을 표시했습니다'))
  check('쉬는 날: 10/5 대체공휴일 · 10/9 한글날 · 10/3 개천절(토)', (await cell(page, '2026-10-05').getAttribute('data-off')) === 'true' && (await cell(page, '2026-10-09').getAttribute('data-off')) === 'true' && (await cell(page, '2026-10-03').getAttribute('data-off')) === 'true' && (await cell(page, '2026-10-06').getAttribute('data-off')) === null)
  check('쉬는 날: 칸 안에 이름', (await cell(page, '2026-10-05').innerText()).includes('대체공휴일'))
  const look = await cell(page, OFF_WEEKDAY).evaluate((el) => ({ bg: getComputedStyle(el).backgroundImage, num: getComputedStyle(el.querySelector('span')).color, sun: getComputedStyle(document.querySelector('main button[data-date="2026-10-04"] span')).color }))
  check('쉬는 날: 빗금 없이 날짜 숫자만 일요일처럼 빨간 글자', look.bg === 'none' && look.num === look.sun, JSON.stringify(look))
  check('영업일: 10월 20일 · 평일 쉬는 날 2일', (await summary(page)).includes('영업일 20일') && (await summary(page)).includes('평일 쉬는 날 2일'), await summary(page))
  check('공휴일 넣기: 다 넣으면 단추가 사라진다', (await page.getByTestId('holiday-import-open').count()) === 0)
  await cell(page, '2026-10-09').click()
  await page.waitForTimeout(200)
  const warn = await page.getByTestId('picked-off-deadline').innerText().catch(() => '')
  check('쉬는 날 마감: 10/9 한글날에 걸린 수금 → 전 영업일 10월 8일(목)까지 챙기라고', warn.includes('쉬는 날에 걸린 업체 마감이 1건') && warn.includes('10월 8일(목)'), warn)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/calendar-oct-1440.png`, fullPage: true })

  // 두 번 눌러 바로 적기 · 매월 반복
  await cell(page, '2026-10-12').click()
  await cell(page, '2026-10-12').click()
  await page.waitForTimeout(300)
  check('바로 적기: 고른 날을 한 번 더 누르면 적기 창', (await page.getByTestId('calendar-quick-sheet').count()) === 1)
  await page.getByLabel('할 일 내용').fill('급여 증빙 요청')
  await page.getByTestId('calendar-quick-sheet').getByRole('button', { name: '매월' }).click()
  await page.getByTestId('calendar-quick-sheet').getByRole('button', { name: '4번' }).click()
  const pv = await page.getByTestId('quick-repeat-preview').innerText()
  check('반복 미리보기: 10/12 · 11/12 · 12/11(12/12 토 → 앞 영업일) · 1/12', pv.includes('10월 12일') && pv.includes('11월 12일') && pv.includes('12월 11일') && pv.includes('1월 12일'), pv)
  await page.waitForTimeout(500)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/quick-todo-1440.png` })
  await page.getByTestId('quick-save-todo').click()
  await page.waitForTimeout(800)
  const made = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]').filter((x) => x.content === '급여 증빙 요청').map((x) => x.dueDate).sort())
  check('반복: 할 일 4줄이 날짜마다', made.join() === '2026-10-12,2026-11-12,2026-12-11,2027-01-12', made.join())
  check('반복: 창이 닫히고 알림', (await page.getByTestId('calendar-quick-sheet').count()) === 0 && (await page.locator('body').innerText()).includes('할 일 4개를 넣었습니다'))

  // 쉬는 날 직접 표시 — 2일 연속 · 지우기
  await cell(page, '2026-10-20').click()
  await page.getByTestId('picked-quick-off').click()
  await page.waitForTimeout(300)
  await page.getByTestId('calendar-quick-sheet').getByRole('button', { name: '회사 휴무' }).click()
  await page.getByTestId('calendar-quick-sheet').getByRole('button', { name: '2일' }).click()
  check('쉬는 날: 기간 미리보기', (await page.getByTestId('quick-off-preview').innerText()).includes('10월 20일(화) ~ 10월 21일(수)'))
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/quick-off-1440.png` })
  await page.getByTestId('quick-save-off').click()
  await page.waitForTimeout(700)
  check('쉬는 날: 10/20 · 10/21 표시 · 영업일 18일', (await cell(page, '2026-10-21').getAttribute('data-off')) === 'true' && (await summary(page)).includes('영업일 18일'), await summary(page))
  check('쉬는 날: 고른 날 아래에 이름', (await page.getByTestId('picked-day-off').innerText()).includes('회사 휴무'))
  await cell(page, '2026-10-21').click()
  await page.getByTestId('picked-quick-off').click()
  await page.waitForTimeout(300)
  await page.getByTestId('quick-off-existing').getByRole('button', { name: '표시 지우기' }).click()
  await page.waitForTimeout(700)
  check('쉬는 날: 지우면 표시가 없어지고 영업일 19일', (await cell(page, '2026-10-21').getAttribute('data-off')) === null && (await summary(page)).includes('영업일 19일'), await summary(page))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  // 큰 달력(날짜 칸)에도 빨간 날짜
  await page.getByTestId('calendar-quick-open').click()
  await page.waitForTimeout(300)
  await page.getByLabel('할 일 날짜').click()
  await page.waitForTimeout(300)
  const big = page.getByTestId('big-calendar')
  check('큰 달력: 쉬는 날 빨간 글자 · 이름', (await big.locator('[data-day="2026-10-09"]').getAttribute('data-off')) === 'true' && (await big.locator('[data-day="2026-10-09"]').getAttribute('class'))?.includes('text-weekday-sun') === true && ((await big.locator('[data-day="2026-10-09"]').getAttribute('aria-label')) ?? '').includes('한글날'))
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/big-calendar-1440.png` })
  check('JS 오류 없음', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- 360 아주 큰 글자 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(() => localStorage.setItem('axmvp.ui.text_scale', JSON.stringify('extra_large')))
  await page.goto(BASE + '/ops/calendar', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await goMonth(page, 2026, 10)
  await page.getByTestId('holiday-import-open').click()
  await page.waitForTimeout(300)
  await page.getByTestId('holiday-import-save').click()
  await page.waitForTimeout(700)
  check('360: 빨간 날짜 · 달력 아래 이 달 쉬는 날 목록', (await cell(page, '2026-10-09').getAttribute('data-off')) === 'true' && (await page.getByTestId('month-days-off').innerText()).includes('10/9 한글날'))
  check('360: 가로 넘침 없음', (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0)
  await page.getByTestId('month-days-off').scrollIntoViewIfNeeded()
  await page.waitForTimeout(2500)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/calendar-oct-360.png` })
  await cell(page, TAP_DAY).click()
  await cell(page, TAP_DAY).click()
  await page.waitForTimeout(300)
  check('360: 두 번 눌러 적기 창', (await page.getByTestId('calendar-quick-sheet').count()) === 1)
  check('360: 적기 창 가로 넘침 없음', (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/quick-todo-360.png` })
  await page.getByTestId('calendar-quick-sheet').getByRole('tab', { name: '쉬는 날' }).click()
  await page.waitForTimeout(200)
  check('360: 쉬는 날 탭에 이미 표시된 이름', (await page.getByTestId('quick-off-existing').innerText()).includes(OFF_NAME))
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/quick-off-360.png` })
  check('360: JS 오류 없음', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(`\nplanner: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
