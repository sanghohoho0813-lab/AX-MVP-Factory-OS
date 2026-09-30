/**
 * 큰 달력 시험 (D-131) — OS 의 날짜 칸을 누르면 일요일부터 시작하는 큰 달력이 뜬다.
 *
 *  1440  창(수금 빠른 시트) 안의 날짜 칸 → 큰 달력이 창 위에 · 요일 일~토 · 날짜를 고르면 업체 기록에 저장
 *        · Esc 는 달력만 닫는다(아래 창은 그대로) · 직접 적기 · 없는 날짜(2월 30일)는 다시 묻는다 · 지우기
 *        · 업체 상세 수금 탭의 날짜 칸도 같은 달력
 *  390 · 360(1.30배)  아래에서 올라오는 달력 · 날짜 칸 44px · 가로 넘침 0
 *
 *   node e2e/calendar.mjs http://localhost:4390
 */
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' ' + detail}`)
}
const fee2 = (page) =>
  page.evaluate(() => {
    const r = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((x) => x.id === 'cli_hansol')
    return (r.fees ?? r.payload?.fees ?? []).find((f) => f.id === 'fee2')
  })

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.locator('[data-testid="client-card"][data-client-id="cli_hansol"]').getByRole('button', { name: /^못 받은 내 돈/ }).click()
  await page.waitForTimeout(400)
  const sheet = page.getByRole('dialog').first()
  const due = page.getByLabel('성공보수 받기로 한 날', { exact: true })
  check('수금 빠른 시트가 열린다', (await sheet.count()) === 1 && (await due.count()) === 1)
  const before = await due.inputValue()
  await due.click()
  const cal = page.getByTestId('big-calendar')
  check('날짜 칸을 누르면 큰 달력(브라우저 달력 아님)', (await cal.count()) === 1)
  check('요일: 일 월 화 수 목 금 토', (await page.getByTestId('big-calendar-week').innerText()).replace(/\s+/g, '') === '일월화수목금토')
  check('달력 머리에 무슨 날짜 칸인지 · 지금 값', ((await cal.innerText()) ?? '').includes('성공보수 받기로 한 날') && ((await page.getByTestId('big-calendar-selected').innerText()) ?? '').includes('년'))
  const zOk = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="big-calendar"]')
    const top = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)
    return !!c && !!top && c.contains(top)
  })
  check('달력이 창 위에 뜬다', zOk)
  // 같은 달의 20일(또는 다른 날)을 고른다
  const [y, m] = before.split('-').map(Number)
  const target = `${y}-${String(m).padStart(2, '0')}-${before.endsWith('-20') ? '21' : '20'}`
  await page.locator(`[data-day="${target}"]`).click()
  await page.waitForTimeout(700)
  check('날짜를 고르면 칸에 들어가고 달력은 닫힌다', (await due.inputValue()) === target && (await cal.count()) === 0, await due.inputValue())
  check('업체 기록(수금 받기로 한 날)에 저장된다', (await fee2(page))?.dueDate === target, JSON.stringify(await fee2(page)))

  // Esc 는 달력만
  await due.click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('Esc 는 달력만 닫는다(수금 시트는 그대로)', (await cal.count()) === 0 && (await page.getByLabel('성공보수 받기로 한 날', { exact: true }).count()) === 1)

  // 직접 적기 · 없는 날짜
  await due.click()
  await cal.getByLabel('날짜 직접 적기').fill('20260230')
  await cal.getByRole('button', { name: '적용' }).click()
  check('없는 날짜(2월 30일)는 넣지 않고 다시 묻는다', ((await cal.innerText()) ?? '').includes('날짜를 읽지 못했습니다') && (await due.inputValue()) === target)
  await cal.getByLabel('날짜 직접 적기').fill('2026.12.1')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(600)
  check('직접 적기: 2026.12.1 → 2026-12-01', (await due.inputValue()) === '2026-12-01' && (await fee2(page))?.dueDate === '2026-12-01')

  // 월 · 연 넘기기
  await due.click()
  await cal.getByRole('button', { name: '다음 달' }).click()
  check('다음 달: 2027년 1월', ((await page.getByTestId('big-calendar-year').innerText()) ?? '').includes('2027') && ((await page.getByTestId('big-calendar-month').innerText()) ?? '').includes('1월'))
  await cal.getByRole('button', { name: '닫기', exact: true }).last().click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // 업체 상세 수금 탭 — 같은 달력
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=fees', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  // D-140: 수금 항목의 날짜 칸은 '고치기' 를 눌러야 나온다
  await page.getByRole('button', { name: /고치기$/ }).first().click()
  await page.waitForTimeout(200)
  const any = page.getByTestId('fee-editor').locator('input[type="date"]').first()
  await any.click()
  check('업체 상세 수금 탭의 날짜 칸도 큰 달력', (await cal.count()) === 1)
  await page.keyboard.press('Escape')
  check('JS 오류 없음', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- 390 · 360(1.30배) ---------------- */
for (const [width, scale] of [
  [390, 'default'],
  [360, 'extra_large'],
]) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=fees', { waitUntil: 'networkidle' })
  await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
  await page.waitForTimeout(500)
  // D-140: 수금 항목의 날짜 칸은 '고치기' 를 눌러야 나온다
  await page.getByRole('button', { name: /고치기$/ }).first().click()
  await page.getByTestId('fee-editor').locator('input[type="date"]').first().click()
  const cal = page.getByTestId('big-calendar')
  check(`${width} ${scale}: 큰 달력이 뜬다`, (await cal.count()) === 1)
  const box = await cal.locator('[role="dialog"]').boundingBox()
  check(`${width} ${scale}: 아래에서 올라온다(화면 폭 그대로)`, !!box && Math.round(box.width) === width && box.y + box.height >= 790, JSON.stringify(box))
  const small = await cal.locator('button').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 43.5).map((e) => e.textContent?.trim()))
  check(`${width} ${scale}: 날짜 · 단추 44px`, small.length === 0, small.join('|'))
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(`${width} ${scale}: 가로 넘침 0`, over <= 1, String(over))
  await ctx.close()
}

await browser.close()
console.log(`\n큰 달력: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
