/**
 * 매출 · 비용 (D-142) + 오늘 할 일 PC 두 칸 · AI 자리 단추.
 *
 *  1440  메뉴 → 매출 · 비용 → 이 달 들어온 돈 · 들어올 예정(미수금 포함) · 앞으로 6달 · 시기 미정
 *        → 정기 결제(Claude $20 · 이틀 뒤) → 매달 28,000원 · 환율 1,500 → 30,000원 → 오늘 '3일 안 결제'
 *        → 비용 적기('2.8만' · 택시 · 오늘) → 비용 탭 · 분류 · 영업자 수수료 줄 · 엑셀(CSV) 내려받기 → 고치기 · 지우기(한 번 더 묻기)
 *        → 해지 → 해지한 것 · 오늘에서 빠짐 → 지난달로 넘기기
 *        → AI 단추: 누르면 '준비 중' 안내만 · 밖으로 나가는 요청 0
 *        → 오늘 할 일 PC 두 칸
 *  390 아주 큰 글자  매출 · 비용 세 탭 · 비용 적기 창 · 가로 넘침 0 · 오늘 할 일 한 칸
 *
 *   node e2e/money.mjs http://localhost:4390
 */
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ' ' + JSON.stringify(detail).slice(0, 300)}`)
}
const kst = (offset = 0) => new Date(Date.now() + 9 * 3600_000 + offset * 86_400_000).toISOString().slice(0, 10)
const TODAY = kst(0)
const inMonth = (d) => d.slice(0, 7) === TODAY.slice(0, 7)
// 이번 달 안에서 고른다(달 끝 · 달 초에도 시험이 흔들리지 않게)
const later = inMonth(kst(10)) ? kst(10) : null
const earlier = inMonth(kst(-5)) ? kst(-5) : null
const IN2 = kst(2)

function prep(t) {
  const list = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
  const h = list.find((c) => c.id === 'cli_hansol')
  h.fees = [
    { id: 'm1', kind: 'deposit', label: '계약금', amount: 5_000_000, dueDate: '', receivedAt: t.TODAY, agentFee: 500_000, agentName: '김영업', agentPaidAt: t.TODAY },
    ...(t.later ? [{ id: 'm2', kind: 'interim', label: '중도금', amount: 10_000_000, dueDate: t.later, receivedAt: null }] : []),
    ...(t.earlier ? [{ id: 'm3', kind: 'interim', label: '밀린 잔금', amount: 2_000_000, dueDate: t.earlier, receivedAt: null }] : []),
    { id: 'm4', kind: 'success', label: '성공보수', amount: 7_000_000, dueDate: '', receivedAt: null, conditionKind: 'funding_100m' },
  ]
  for (const c of list) if (c.id !== 'cli_hansol') c.fees = []
  localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(list))
}

const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const tile = async (page, i) => (await page.getByTestId('money-tiles').locator('> *').nth(i).innerText()).replace(/\s+/g, ' ')

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', acceptDownloads: true })
  const page = await ctx.newPage()
  const errors = []
  const outside = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('request', (r) => {
    if (/openai|anthropic|generativelanguage|api\.claude/i.test(r.url())) outside.push(r.url())
  })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(prep, { TODAY, later, earlier })

  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: '매출 · 비용' }).first().click()
  await page.waitForURL(/\/money/)
  await page.waitForTimeout(500)
  check('메뉴: 영업 묶음에 매출 · 비용', page.url().includes('/money'))

  // 매출
  check('들어온 돈 500만원', /들어온 돈 500만원/.test(await tile(page, 0)), await tile(page, 0))
  const expected = (later ? 10_000_000 : 0) + (earlier ? 2_000_000 : 0)
  const t1 = await tile(page, 1)
  check(`들어올 예정 ${expected / 10_000}만원${earlier ? ' · 그중 미수금 200만원' : ''}`, t1.includes(`${(expected / 10_000).toLocaleString('ko-KR')}만원`) && (!earlier || /그중 미수금 200만원/.test(t1)), t1)
  const kinds = await page.getByTestId('revenue-line').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')))
  check('매출 줄: 입금 완료 먼저 · 성공보수(조건 대기)는 없음', kinds[0] === 'received' && !(await page.getByTestId('revenue-list').innerText()).includes('성공보수'), kinds)
  check('앞으로 6달', (await page.getByTestId('money-outlook').locator('li').count()) === 6)
  check('시기 미정: 성공보수 700만(조건 대기)', /700만원/.test(await page.getByTestId('money-undated').innerText()))

  // 정기 결제
  await page.getByTestId('sub-open').click()
  await page.getByTestId('sub-presets').getByRole('button', { name: 'Claude' }).click()
  await page.getByTestId('sub-amount').fill('20')
  check('금액 읽기: $20 ≈ 28,000원', /\$20 ≈ 28,000원/.test(await page.getByTestId('sub-amount-read').innerText()), await page.getByTestId('sub-amount-read').innerText())
  await page.getByTestId('sub-day').selectOption(String(Number(IN2.slice(8, 10))))
  await page.getByTestId('sub-save').click()
  await page.waitForTimeout(400)
  await page.getByTestId('money-tab-subs').click()
  await page.getByTestId('sub-row').first().waitFor()
  check('정기 결제: 1개 · 다음 결제 D-2', (await page.getByTestId('sub-row').count()) === 1 && /D-2/.test(await page.getByTestId('sub-next').innerText()), await page.getByTestId('sub-next').innerText())
  check('매달 나가는 돈 28,000원 · 1년 336,000원', /28,000원/.test(await page.getByTestId('subs-summary').innerText()) && /336,000원/.test(await page.getByTestId('subs-summary').innerText()), await page.getByTestId('subs-summary').innerText())
  check('환율 (가정) 표시', /\(가정\)/.test(await page.getByTestId('rate-open').innerText()))
  await page.getByTestId('rate-open').click()
  await page.locator('#rate-input').fill('1500')
  await page.getByTestId('rate-save').click()
  await page.waitForTimeout(400)
  check('환율 1,500 → 매달 30,000원 · (가정) 사라짐', /30,000원/.test(await page.getByTestId('subs-summary').innerText()) && !/\(가정\)/.test(await page.getByTestId('rate-open').innerText()))

  // 오늘 — 3일 안 결제 · 두 칸
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const ch = (await page.getByTestId('today-charges').count()) ? await page.getByTestId('today-charges').innerText() : ''
  check('오늘: 3일 안 결제 Claude $20 · 2일 뒤', /Claude/.test(ch) && /\$20/.test(ch) && /2일 뒤/.test(ch), ch)
  const grid = await page.getByTestId('today-todo-grid').first().evaluate((el) => ({ d: getComputedStyle(el).display, c: getComputedStyle(el).gridTemplateColumns.split(' ').length }))
  check('오늘 할 일: PC 두 칸', grid.d === 'grid' && grid.c === 2, grid)
  const side = await page.getByTestId('today-side-grid').evaluate((el) => ({ d: getComputedStyle(el).display, c: getComputedStyle(el).gridTemplateColumns.split(' ').length }))
  check('오늘: 약속 · 결제 · 기한도 PC 두 칸', side.d === 'grid' && side.c === 2, side)

  // 비용 적기
  await page.goto(BASE + '/money?tab=cost', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.getByTestId('expense-open').click()
  await page.getByTestId('expense-amount').fill('2.8만')
  check('금액 읽기: 2.8만 → 28,000원', /28,000원/.test(await page.getByTestId('expense-amount-read').innerText()))
  await page.locator('#expense-name').fill('미팅 택시')
  await page.getByTestId('expense-cat-travel').click()
  await page.getByTestId('expense-client').selectOption('cli_hansol')
  const t0 = Date.now()
  await page.getByTestId('expense-save').click()
  await page.getByTestId('cost-list').waitFor()
  check(`비용 적기 저장 ${Date.now() - t0}ms`, true)
  const costText = await page.getByTestId('cost-list').innerText()
  check('비용 탭: 택시 28,000원 · 한솔테크', /미팅 택시/.test(costText) && /28,000원/.test(costText) && /한솔테크/.test(costText), costText)
  check('비용 탭: 정기 결제(Claude) · 영업자 수수료 줄', (await page.locator('[data-testid="cost-line"][data-source="subscription"]').count()) === (inMonth(IN2) ? 1 : 0) && (await page.locator('[data-testid="cost-line"][data-source="agent"]').count()) === 1)
  check('분류별: 수수료 · 교통', /수수료/.test(await page.getByTestId('cost-categories').innerText()) && /교통/.test(await page.getByTestId('cost-categories').innerText()))
  const t2 = await tile(page, 2)
  const costSum = 28_000 + 500_000 + (inMonth(IN2) ? 30_000 : 0)
  check('나간 돈 = 택시 + 수수료 (+ Claude)', t2.includes(`${costSum.toLocaleString('ko-KR')}원`), t2)

  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('cost-csv').click()])
  const csvPath = await dl.path()
  const fs = await import('node:fs')
  const csv = fs.readFileSync(csvPath, 'utf8')
  check('엑셀(CSV): 파일 이름 · 머리줄 · 택시 · 업체', dl.suggestedFilename() === `expenses-${TODAY.slice(0, 7)}.csv` && csv.includes('날짜,항목,분류') && csv.includes('미팅 택시') && csv.includes('한솔테크'), dl.suggestedFilename())

  // 다음 적기: 최근 이름 칩
  await page.getByTestId('expense-open').click()
  check('최근 쓴 이름 칩', /미팅 택시/.test(await page.getByTestId('expense-recent').innerText()))
  await page.keyboard.press('Escape')

  // 고치기 · 지우기
  await page.locator('[data-testid="cost-line"][data-source="expense"]').first().locator('button').click()
  await page.getByTestId('expense-delete').click()
  check('지우기: 한 번 더 묻기', (await page.getByTestId('expense-delete-yes').count()) === 1)
  await page.getByTestId('expense-delete-yes').click()
  await page.waitForTimeout(300)
  check('지운 뒤 택시 줄 없음', !(await page.locator('main').innerText()).includes('미팅 택시'))

  // AI 단추
  await page.getByTestId('ai-soon').first().click()
  await page.waitForTimeout(300)
  check('AI 단추: 누르면 준비 중 안내', /AI 연결 준비 중/.test(await page.locator('body').innerText()))
  const color = await page.getByTestId('ai-soon').first().evaluate((el) => getComputedStyle(el).backgroundImage)
  check('AI 단추: 보라색', /gradient/.test(color), color)

  // 해지
  await page.getByTestId('money-tab-subs').click()
  await page.getByTestId('sub-row').first().locator('button').click()
  await page.getByTestId('sub-cancel').click()
  await page.waitForTimeout(400)
  check('해지: 쓰는 중 목록에서 빠지고 해지한 것 1개', (await page.getByTestId('sub-row').count()) === 0 && /해지한 것 1개/.test(await page.locator('main').innerText()))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('해지 뒤 오늘에서 결제 줄 빠짐', (await page.getByTestId('today-charges').count()) === 0)

  // 지난달
  await page.goto(BASE + '/money', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '이전 달' }).click()
  await page.waitForTimeout(300)
  check('지난달로: 제목 · 이번 달로 단추', (await page.getByTestId('money-month-label').innerText()) !== `${TODAY.slice(0, 4)}년 ${Number(TODAY.slice(5, 7))}월` && (await page.getByRole('button', { name: '이번 달로' }).count()) === 1)

  // 다른 화면의 AI 자리
  for (const [path, label] of [['/journal', 'AI로 돌아보기'], ['/tools/policy-funding', 'AI로 사업계획서 초안'], ['/sales/meeting', 'AI로 미팅 질문 다듬기'], ['/sales/proposal', 'AI로 제안서 문장 다듬기']]) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    check(`AI 자리: ${path} '${label}'`, (await page.getByTestId('ai-soon').filter({ hasText: label }).count()) >= 1)
  }
  check('AI 단추를 눌러도 밖으로 나간 요청 0', outside.length === 0, outside)
  check('1440: 오류 0', errors.length === 0, errors)
  await ctx.close()
}

/* ---------------- 390 아주 큰 글자 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(prep, { TODAY, later, earlier })
  await page.evaluate(() => localStorage.setItem('axmvp.ui.text_scale', 'extra_large'))
  await page.goto(BASE + '/money', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('390 매출: 가로 넘침 0', (await overflowX(page)) <= 0, await overflowX(page))
  await page.getByTestId('expense-open').click()
  await page.getByTestId('expense-sheet').waitFor()
  await page.waitForTimeout(300)
  const box = await page.getByTestId('expense-save').boundingBox()
  check('390 비용 적기: 저장 단추 화면 안 · 44px', box && box.y + box.height <= 845 && box.height >= 43.5, box)
  await page.getByTestId('expense-amount').fill('15000')
  await page.locator('#expense-name').fill('점심')
  await page.getByTestId('expense-save').click()
  await page.waitForTimeout(400)
  await page.getByTestId('money-tab-cost').click()
  await page.waitForTimeout(300)
  check('390 비용: 적은 것 보임 · 넘침 0', /점심/.test(await page.getByTestId('cost-list').innerText()) && (await overflowX(page)) <= 0)
  await page.getByTestId('money-tab-subs').click()
  await page.waitForTimeout(300)
  check('390 정기 결제: 넘침 0', (await overflowX(page)) <= 0)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const g = await page.getByTestId('today-todo-grid').first().evaluate((el) => getComputedStyle(el).display)
  check('390 오늘 할 일: 한 칸(flex)', g === 'flex', g)
  check('390: 오류 0', errors.length === 0, errors)
  await ctx.close()
}

await browser.close()
console.log(`\nmoney e2e: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
