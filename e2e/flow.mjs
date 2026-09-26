/**
 * 흐름 잇기 (D-122) — 한 곳에서 한 일이 다음 화면으로 그대로 이어진다.
 *
 *   node e2e/flow.mjs <baseUrl>
 *
 * 지키려는 것
 *   1. 업체 상세 영업 카드에서 '계약 완료' → 확인 시트 → 계약 고객 · 수금 항목(받을 날) · 계약 정보 · 업무 시작
 *   2. 계약 단계를 '계약 전' 으로 되돌리면 영업 보드도 클로징으로(한 업체가 두 단계에 있지 않다)
 *   3. 계약 금액과 수금 항목이 다르면 계약 카드에 차이 한 줄
 *   4. 오늘 화면 — 영업자에게 줄 돈 · 받을 날 안 정한 수금 줄(누르면 그 화면으로)
 *   5. 미팅 기록 — 받기로 한 자료를 서류함 칸으로 · 나온 주제는 관심사로
 *   6. 고객 관리 새 업체 — 기본 잠재고객 · 같은 업체가 있으면 알림
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
const CLIENTS = 'axmvp.v1.operations_clients'
const clients = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '[]'), CLIENTS)
const one = async (page, id) => (await clients(page)).find((c) => c.id === id)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

for (const [w, mob] of [[1440, false], [390, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: mob, hasTouch: mob, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const tag = `(${w})`

  /* 4 오늘 화면 돈 줄 — 먼저 본다(뒤 단계에서 수금이 바뀌므로) */
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const notes = page.getByTestId('today-money-notes')
  check(`오늘: 영업자에게 줄 돈 줄이 있다 ${tag}`, (await notes.count()) === 1 && ((await notes.innerText()) ?? '').includes('영업자에게 줄 돈'), (await notes.innerText().catch(() => '없음')).slice(0, 100))
  await notes.getByRole('link', { name: /영업자에게 줄 돈/ }).click()
  await page.waitForURL(/\/ops\/agents/)
  check(`오늘: 누르면 영업자 정산으로 ${tag}`, page.url().includes('/ops/agents'))

  /* 1 영업 카드 → 계약 완료 시트 */
  await page.goto(BASE + '/ops/clients/cli_mirae', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const salesCard = page.getByTestId('client-sales-card')
  if (!(await salesCard.getByLabel('영업 단계').isVisible())) await salesCard.getByRole('button', { name: /영업/ }).first().click()
  await salesCard.getByLabel('영업 단계').selectOption('contracted')
  const sheet = page.getByTestId('contract-close')
  await sheet.waitFor()
  check(`계약 완료: 영업 카드에서도 확인 시트(바로 옮기지 않음) ${tag}`, (await one(page, 'cli_mirae')).status === 'waiting')
  await sheet.getByLabel('수금 항목 1 금액').fill('3,300,000')
  await sheet.getByRole('button', { name: '현금', exact: true }).click()
  const ventureChip = sheet.getByRole('button', { name: '벤처인증', exact: true })
  if ((await ventureChip.getAttribute('aria-pressed')) !== 'true') await ventureChip.click()
  await page.getByTestId('contract-close-save').click()
  await page.waitForTimeout(800)
  const m = await one(page, 'cli_mirae')
  check(`계약 완료: 계약 고객 · 영업 단계 계약 완료 ${tag}`, m.status === 'active' && m.sales?.stage === 'contracted', JSON.stringify({ s: m.status, st: m.sales?.stage }))
  check(`계약 완료: 수금 항목 330만 · 받을 날 있음 ${tag}`, m.fees.length === 1 && m.fees[0].amount === 3_300_000 && /^\d{4}-\d{2}-\d{2}$/.test(m.fees[0].dueDate), JSON.stringify(m.fees))
  check(`계약 완료: 계약 정보(현금 · 330만 · 계약일) ${tag}`, m.contract.kind === 'cash' && m.contract.cashAmount === 3_300_000 && /^\d{4}-\d{2}-\d{2}$/.test(m.contract.signedAt), JSON.stringify(m.contract))
  check(`계약 완료: 고른 업무(벤처인증)가 진행 중 ${tag}`, m.services.venture.status === 'in_progress')
  check(`계약 완료: 시트가 닫혔다 ${tag}`, (await page.getByTestId('contract-close').count()) === 0)

  /* 2 계약 단계 되돌리기 → 영업은 클로징 */
  const stageSel = page.locator('select:visible', { has: page.locator('option', { hasText: '계약 전' }) }).first()
  if ((await stageSel.count()) > 0) {
    await stageSel.selectOption({ label: '계약 전' })
    await page.waitForTimeout(600)
    const back = await one(page, 'cli_mirae')
    check(`계약 단계를 계약 전으로 → 영업은 클로징(두 단계에 있지 않다) ${tag}`, back.status === 'waiting' && back.sales?.stage === 'closing', JSON.stringify({ s: back.status, st: back.sales?.stage }))
  } else {
    // 휴대폰에서는 더보기 시트 안에 있다
    await page.getByRole('button', { name: '더보기' }).first().click()
    await page.waitForTimeout(300)
    await page.locator('select:visible', { has: page.locator('option', { hasText: '계약 전' }) }).first().selectOption({ label: '계약 전' })
    await page.waitForTimeout(600)
    const back = await one(page, 'cli_mirae')
    check(`계약 단계를 계약 전으로 → 영업은 클로징(두 단계에 있지 않다) ${tag}`, back.status === 'waiting' && back.sales?.stage === 'closing', JSON.stringify({ s: back.status, st: back.sales?.stage }))
    await page.keyboard.press('Escape')
  }

  /* 3 계약 · 수금 차이 */
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const h = await one(page, 'cli_hansol')
  const feeSum = h.fees.reduce((s, f) => s + (f.amount ?? 0), 0)
  if (h.contract.cashAmount && h.contract.cashAmount !== feeSum) {
    check(`계약 카드: 계약 금액과 수금 항목 차이 한 줄 ${tag}`, (await page.getByTestId('contract-gap').count()) === 1)
  } else {
    check(`계약 카드: 같으면 차이 줄이 없다 ${tag}`, (await page.getByTestId('contract-gap').count()) === 0)
  }

  /* 5 미팅 기록 → 서류함 칸 · 관심사 */
  await page.goto(BASE + '/sales/meeting?client=cli_mirae&round=2', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const rec = page.getByTestId('meeting-recorder')
  await rec.getByLabel('미팅에서 나온 말 · 메모').fill('가지급금 정리가 필요하다고 하셨고 주주명부와 정관을 보내 주기로 함')
  await rec.getByRole('button', { name: '메모 나눠 보기' }).click()
  const slots = page.getByTestId('meeting-doc-slots')
  check(`미팅 기록: 서류함에 칸 만들기(주주명부 · 정관) ${tag}`, (await slots.count()) === 1 && ((await slots.innerText()) ?? '').includes('주주명부') && ((await slots.innerText()) ?? '').includes('정관'))
  await rec.getByRole('button', { name: '기록 저장' }).click()
  await page.waitForTimeout(700)
  const after = await one(page, 'cli_mirae')
  check(`미팅 기록: 서류함 칸이 생겼다 ${tag}`, after.customDocuments.some((d) => d.label === '주주명부') && after.customDocuments.some((d) => d.label === '정관'), JSON.stringify(after.customDocuments.map((d) => d.label)))
  check(`미팅 기록: 나온 주제(가지급금)가 관심사로 ${tag}`, (after.sales?.interests ?? []).includes('가지급금'), JSON.stringify(after.sales?.interests))

  /* 6 고객 관리 새 업체 */
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /등록/ }).first().click()
  const nameBox = page.getByLabel('업체명')
  await nameBox.fill('한솔테크(주)')
  check(`새 업체: 같은 업체가 있으면 알린다 ${tag}`, (await page.getByTestId('new-client-dupe').count()) === 1)
  await nameBox.fill(`새잠재상사${w}`)
  check(`새 업체: 기본은 잠재고객 ${tag}`, (await page.locator('form').getByRole('button', { name: /^잠재고객/ }).getAttribute('aria-pressed')) === 'true')
  await page.getByRole('button', { name: '등록하고 열기' }).click()
  await page.waitForURL(/\/ops\/clients\/[^?]+$/)
  const made = (await clients(page)).find((c) => c.companyName === `새잠재상사${w}`)
  check(`새 업체: 잠재고객(계약 전 · 영업 잠재 고객)으로 들어간다 ${tag}`, made?.status === 'waiting' && made?.sales?.stage === 'lead', JSON.stringify({ s: made?.status, st: made?.sales?.stage }))

  check(`JS 오류 없음 ${tag}`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(`\n흐름 잇기: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
