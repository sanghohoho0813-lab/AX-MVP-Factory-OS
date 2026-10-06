/**
 * 계약 → 받은 돈 → 남은 돈 (D-140) — 대표 완료 기준 CASE 1 ~ 4 를 실제 화면에서.
 *
 *  CASE 1 (1440 · 390)  500만 → 전액 선금(추천) → 500만 입금 → 미수금 0 · 계약 중
 *  CASE 2 (1440 · 390)  1,500만 → 선금 500만 입금 → 잔금 1,000만 정책자금 1억원 이상 → 미수금 0 · 조건부 1,000만
 *                        → 정책자금 선정만으로는 조건 대기 · 실제 입금 1.2억 적으면 청구 가능 · 입금 확인(한 번 더 묻기) · 되돌리기
 *  CASE 3 (1440)        3,000만 → 직접 나누기(계약금 입금 · 중도금 날짜 · 성공보수 조건) → 입금 완료 · 받을 예정 · 조건 대기
 *  CASE 4 (1440)        예전 기록(한솔) — 입금 완료 그대로 · 날짜 지난 성공보수만 미수금 · 숫자 그대로
 *  회사명 옆 계약 상태 배지 → 계약 완료로 바꾸기 · 오른쪽 계약 단계 선택기 없음 · 가로 넘침 0 · 오류 0
 *
 *   node e2e/contract.mjs http://localhost:4390 [스크린샷 폴더]
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
const rec = (page, id) => page.evaluate((cid) => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === cid), id)
const tiles = async (page) => (await page.getByTestId('money-tiles').innerText()).replace(/\s+/g, ' ')
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

async function fresh(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  return { ctx, page, errors }
}

async function openPlan(page, id) {
  await page.goto(`${BASE}/ops/clients/${id}?tab=fees`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.getByTestId('plan-open').first().click()
  await page.waitForTimeout(300)
  return page.getByTestId('contract-plan')
}

for (const [w, h, tag] of [
  [1440, 900, 'PC'],
  [390, 844, '390'],
]) {
  /* ---------- CASE 1 ---------- */
  {
    const { ctx, page, errors } = await fresh(w, h)
    const t0 = Date.now()
    let clicks = 0
    const sheet = await openPlan(page, 'cli_wooil')
    clicks += 1
    check(`${tag} CASE 1: 수금 항목이 없으면 '계약금액 · 받은 돈 · 남은 돈 정하기' 하나`, (await page.getByTestId('plan-empty').count()) === 1)
    await sheet.getByTestId('plan-total').getByRole('button', { name: '500만원', exact: true }).click()
    clicks += 1
    const rec1 = await sheet.getByTestId('plan-method').getByRole('button', { name: /전액 선금/ }).getAttribute('aria-pressed')
    check(`${tag} CASE 1: 500만원은 '전액 선금' 이 추천으로 골라져 있다`, rec1 === 'true' && (await sheet.getByTestId('plan-method').innerText()).includes('추천'))
    await sheet.getByTestId('plan-paid').getByRole('button', { name: /^전액 500만원/ }).click()
    clicks += 1
    const pv = await page.getByTestId('plan-preview').innerText()
    check(`${tag} CASE 1: 미리보기 — 계약금(전액) 500만원 ✓ 오늘 입금`, pv.includes('계약금(전액)') && pv.includes('500만원') && pv.includes('오늘 입금'), pv)
    await page.waitForTimeout(600)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/case1-sheet-${tag}.png` })
    await page.getByTestId('plan-save').click()
    clicks += 1
    await page.waitForTimeout(700)
    const t = await tiles(page)
    check(`${tag} CASE 1: 계약금액 500만 · 입금 완료 500만 · 지금 받을 돈 0원 · 미수금 없음`, /계약금액 500만원/.test(t) && /입금 완료 500만원/.test(t) && /지금 받을 돈 0원 미수금 없음/.test(t), t)
    const r1 = await rec(page, 'cli_wooil')
    check(`${tag} CASE 1: 저장 — 계약 현금 500만 · 수금 1줄 입금 완료`, r1.contract.cashAmount === 5_000_000 && r1.fees.length === 1 && typeof r1.fees[0].receivedAt === 'string')
    check(`${tag} CASE 1: ${clicks}번 누르고 ${((Date.now() - t0) / 1000).toFixed(1)}초에 끝 (1분 안)`, clicks <= 6 && Date.now() - t0 < 60_000)
    check(`${tag} CASE 1: 가로 넘침 0`, (await overflow(page)) <= 0)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/case1-fees-${tag}.png`, fullPage: true })
    check(`${tag} CASE 1: 오류 0`, errors.length === 0, errors.join(' | '))
    await ctx.close()
  }

  /* ---------- CASE 2 ---------- */
  {
    const { ctx, page, errors } = await fresh(w, h)
    const t0 = Date.now()
    const sheet = await openPlan(page, 'cli_wooil')
    await sheet.getByTestId('plan-total').getByRole('button', { name: '1,500만원', exact: true }).click()
    check(`${tag} CASE 2: 1,500만원은 '선금 + 나머지 나중' 추천`, (await sheet.getByTestId('plan-method').getByRole('button', { name: /선금 \+ 나머지 나중/ }).getAttribute('aria-pressed')) === 'true')
    await sheet.getByTestId('plan-paid').getByRole('button', { name: '500만원', exact: true }).click()
    await sheet.getByTestId('plan-when').getByRole('button', { name: '정책자금 조달 후' }).click()
    await sheet.getByTestId('plan-when').getByRole('button', { name: '1억원 이상' }).click()
    const pv = await page.getByTestId('plan-preview').innerText()
    check(`${tag} CASE 2: 미리보기 — 계약금 500만 오늘 입금 · 잔금 1,000만 정책자금 1억원 이상 조달 시 · 조건 대기`, pv.includes('계약금') && pv.includes('오늘 입금') && pv.includes('잔금') && pv.includes('1,000만원') && pv.includes('정책자금 1억원 이상 조달 시') && pv.includes('조건 대기'), pv)
    await page.waitForTimeout(600)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/case2-sheet-${tag}.png` })
    await page.getByTestId('plan-save').click()
    await page.waitForTimeout(700)
    const t = await tiles(page)
    check(`${tag} CASE 2: 입금 500만 · 지금 받을 돈 0원 · 미수금 없음 · 조건부 1,000만(조건 대기)`, /입금 완료 500만원/.test(t) && /지금 받을 돈 0원 미수금 없음/.test(t) && /조건부 · 예정 1,000만원 조건 대기 1,000만원/.test(t), t)
    check(`${tag} CASE 2: 1분 안 (${((Date.now() - t0) / 1000).toFixed(1)}초)`, Date.now() - t0 < 60_000)
    const rest = page.locator('[data-testid="fee-line"]', { hasText: '잔금' })
    check(`${tag} CASE 2: 잔금 줄 — 정책자금 1억원 이상 조달 시 · [조건 대기]`, (await rest.innerText()).includes('정책자금 1억원 이상 조달 시') && (await rest.getByTestId('fee-state').getAttribute('data-state')) === 'waiting')
    const r2 = await rec(page, 'cli_wooil')
    const restFee = r2.fees.find((f) => f.label === '잔금')
    check(`${tag} CASE 2: 잔금에 날짜를 지어내지 않았다 · 계약금만 입금`, restFee.dueDate === '' && restFee.receivedAt === null && r2.fees.find((f) => f.label === '계약금').receivedAt !== null)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/case2-fees-${tag}.png`, fullPage: true })

    // 오늘 · 목록에서도 미수금이 아니다
    await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    const card = await page.locator('[data-testid="client-card"][data-client-id="cli_wooil"]').innerText()
    check(`${tag} CASE 2: 고객 목록 카드에 '못 받은 내 돈' 이 없다(조건 대기는 못 받은 돈 아님)`, !card.includes('못 받은 내 돈'), card.slice(0, 200))

    // 정책자금: 선정만 → 그대로 조건 대기 · 실제 입금 1.2억 → 청구 가능
    const setFunding = (exec) =>
      page.evaluate((e) => {
        const list = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
        const c = list.find((x) => x.id === 'cli_wooil')
        c.fundingApplications = [{ id: 'fx', programName: '중진공 운전자금', institution: '', status: 'selected', applyDueDate: '', submittedAt: null, resultAt: null, requestedAmount: 200000000, approvedAmount: 150000000, note: '', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', ...(e ? { executedAmount: e } : {}) }]
        localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(list))
      }, exec)
    await setFunding(null)
    await page.goto(BASE + '/ops/clients/cli_wooil?tab=fees', { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    check(`${tag} CASE 2: 정책자금 '선정 · 확정 1.5억' 만으로는 여전히 조건 대기`, (await page.locator('[data-testid="fee-line"]', { hasText: '잔금' }).getByTestId('fee-state').getAttribute('data-state')) === 'waiting')
    await setFunding(120_000_000)
    await page.goto(BASE + '/ops/clients/cli_wooil?tab=fees', { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    check(`${tag} CASE 2: 실제 입금 1.2억 적으면 잔금 청구 가능 · 지금 받을 돈 1,000만`, (await page.locator('[data-testid="fee-line"]', { hasText: '잔금' }).getByTestId('fee-state').getAttribute('data-state')) === 'claimable' && /지금 받을 돈 1,000만원 청구 가능/.test(await tiles(page)), await tiles(page))

    // 입금 확인 — 한 번 더 묻는다 · 되돌리기
    const line = page.locator('[data-testid="fee-line"]', { hasText: '잔금' })
    await line.getByRole('button', { name: '잔금 입금' }).click()
    const ask = await line.getByTestId('fee-confirm').innerText()
    check(`${tag} 입금 확인: '오늘(…) 10,000,000원 입금으로 처리할까요?' 한 번 더`, ask.includes('10,000,000원 입금으로 처리할까요'), ask)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/confirm-${tag}.png` })
    await line.getByRole('button', { name: '네, 입금 완료' }).click()
    await page.waitForTimeout(600)
    check(`${tag} 입금 확인: ✓ 입금 완료 · 입금 1,500만`, (await line.getByTestId('fee-received').count()) === 1 && /입금 완료 1,500만원/.test(await tiles(page)))
    await line.getByRole('button', { name: '잔금 입금 되돌리기' }).click()
    await line.getByRole('button', { name: '네, 지우기' }).click()
    await page.waitForTimeout(600)
    check(`${tag} 되돌리기: 입금 표시가 지워진다`, (await rec(page, 'cli_wooil')).fees.find((f) => f.label === '잔금').receivedAt === null)
    check(`${tag} CASE 2: 가로 넘침 0`, (await overflow(page)) <= 0)
    check(`${tag} CASE 2: 오류 0`, errors.length === 0, errors.join(' | '))
    await ctx.close()
  }
}

/* ---------- CASE 3 (PC) ---------- */
{
  const { ctx, page, errors } = await fresh(1440, 900)
  const sheet = await openPlan(page, 'cli_wooil')
  await sheet.getByTestId('plan-total').getByRole('button', { name: '3,000만원', exact: true }).click()
  await sheet.getByTestId('plan-method').getByRole('button', { name: /직접 나누기/ }).click()
  const split = sheet.getByTestId('plan-split')
  check('CASE 3: 직접 나누기 — 계약금 · 중도금 · 성공보수 1,000만씩 채워져 합계가 맞다', (await sheet.getByTestId('plan-split-sum').innerText()).includes('30,000,000원 / 계약 30,000,000원'))
  await split.getByRole('button', { name: '지금 받음' }).first().click()
  await page.waitForTimeout(600)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/case3-sheet-PC.png` })
  await page.getByTestId('plan-save').click()
  await page.waitForTimeout(700)
  const states = await page.getByTestId('fee-state').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))
  const received = await page.getByTestId('fee-received').count()
  check('CASE 3: 계약금 입금 완료 · 중도금 받을 예정 · 성공보수 조건 대기', received === 1 && states.join() === 'scheduled,waiting', states.join())
  const t = await tiles(page)
  check('CASE 3: 입금 1,000만 · 지금 받을 돈 0 · 조건부 · 예정 2,000만(조건 대기 1,000만 · 날짜 예정 1,000만)', /입금 완료 1,000만원/.test(t) && /지금 받을 돈 0원/.test(t) && /조건부 · 예정 2,000만원 조건 대기 1,000만원 · 날짜 예정 1,000만원/.test(t), t)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/case3-fees-PC.png`, fullPage: true })
  check('CASE 3: 오류 0', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------- CASE 4 + 계약 상태 배지 (PC · 390) ---------- */
for (const [w, h, tag] of [
  [1440, 900, 'PC'],
  [390, 844, '390'],
]) {
  const { ctx, page, errors } = await fresh(w, h)
  const before = await rec(page, 'cli_hansol')
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=fees', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const lines = await page.getByTestId('fee-line').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')))
  const byLabel = (l) => lines.find((x) => x.startsWith(l)) ?? ''
  check(`${tag} CASE 4: 예전 계약금 · 중도금은 입금 완료 그대로`, byLabel('계약금').includes('입금 완료') && byLabel('중도금').includes('입금 완료'), lines.join(' / '))
  check(`${tag} CASE 4: 받기로 한 날이 지난 성공보수는 미수금`, byLabel('성공보수').includes('미수금'), byLabel('성공보수'))
  const t = await tiles(page)
  check(`${tag} CASE 4: 숫자 — 입금 500만 · 지금 받을 돈 550만(그중 미수금 550만)`, /입금 완료 500만원/.test(t) && /지금 받을 돈 550만원 그중 미수금 550만원/.test(t), t)
  check(`${tag} CASE 4: 영업자 수수료는 값이 있을 때만 한 줄`, (await page.getByTestId('fees-agent').innerText()).includes('최영업'))
  const after = await rec(page, 'cli_hansol')
  check(`${tag} CASE 4: 화면을 열어도 예전 기록이 바뀌지 않는다`, JSON.stringify(after.fees) === JSON.stringify(before.fees))
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/case4-fees-${tag}.png`, fullPage: true })
  check(`${tag} CASE 4: 가로 넘침 0`, (await overflow(page)) <= 0)

  // 계약 상태 배지
  // D-157: 계약 고객은 '계약 완료'(계약 중이라는 말 없음)
  check(`${tag} 배지: 회사명 옆 '계약 완료'`, (await page.getByTestId('stage-badge').innerText()).includes('계약 완료') && !(await page.getByTestId('stage-badge').innerText()).includes('계약 중'))
  check(`${tag} 배지: 오른쪽에 두 번째 계약 단계 선택기가 없다`, (await page.locator('select').filter({ hasText: '계약 전' }).count()) === 0)
  await page.getByTestId('stage-badge').click()
  const opts = await page.getByTestId('stage-menu').getByRole('menuitemradio').allInnerTexts()
  check(`${tag} 배지: 계약 전 · 계약 완료 둘만`, opts.map((o) => o.trim()).join() === '계약 전,계약 완료', opts.join())
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stage-menu-${tag}.png` })
  await page.getByTestId('stage-menu').getByRole('menuitemradio', { name: '계약 전' }).click()
  await page.waitForTimeout(600)
  check(`${tag} 배지: 계약 전으로 바꾸면 저장 값 waiting`, (await rec(page, 'cli_hansol')).status === 'waiting' && (await page.getByTestId('stage-badge').innerText()).includes('계약 전'))
  await page.getByTestId('stage-badge').click()
  await page.getByTestId('stage-menu').getByRole('menuitemradio', { name: '계약 완료' }).click()
  await page.waitForTimeout(600)
  // 계약 전 → 계약 완료 는 바로 옮기지 않고 계약 완료 확인 창(금액 · 받을 날)을 띄운다(D-122 그대로)
  check(`${tag} 배지: 계약 전 → 계약 완료는 확인 창부터`, (await page.getByTestId('contract-close').count()) === 1)
  check(`${tag} CASE 4: 오류 0`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(`\ncontract: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
