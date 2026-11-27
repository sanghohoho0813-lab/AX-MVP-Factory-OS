/**
 * qa:renewal — D-684 계약 끝나는 날 · 재계약 챙기기(연습 모드). 진짜 DB 위 '고객 화면 챙길 것' [열기] → 연간 보고는 qa:growthportal W16.
 *
 *   N1 업체 › 계약 [계약 고치기] — 계약일 · [1년 계약] → 끝나는 날 = 계약일 + 1년 하루 전 · 저장 → 카드 '…까지 · n일 남음' · 활동 기록 '끝나는 날'
 *   N2 끝나는 날이 계약일보다 앞 → 안내 한 줄 · [저장] 꺼짐
 *   N3 오늘 '안부 챙길 계약 고객' — 재계약 줄(1주년 줄과 겹치지 않음) · [재계약 문구] 복사(끝나는 날 · 수수료 0)
 *   N4 [연락했어요] → 줄 빠짐 · 7일 뒤 다시 · 새로 고쳐도 그대로
 *   N5 고객 플랫폼 탭 — 연결 → '재계약 전 연간 보고' 줄(보고 공백 줄은 대신 빠짐) · ?make=annual → 보고서 창 연간 · 계약일부터 · 주소 값 지움
 *   N6 [재계약했어요] → 새 끝나는 날 고르기(지금 기간과 같은 1년이 먼저 · [2년]) → 저장 → 줄 빠짐 · 계약 칸 새 기간 · 활동 기록 '재계약 — …'
 *   N7 미리 재계약해도 끝나는 계약의 연간 보고 줄은 남음 · 계약 칸 '재계약 — 이번 계약은 …부터예요'
 *   N8 영업 → 계약 완료 창 '계약 기간' [1년] → 끝나는 날 들어감 · 안 고르면 빈 칸(짐작 0)
 *   N9 390 — 안부 줄 · 재계약 창 · 계약 창 넘침 0 · 단추 40px 이상
 *   N10 JS 오류 0
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.argv[3] ?? ''
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) {
    pass++
    console.log('PASS ', n)
  } else {
    fail++
    console.log('FAIL ', n, d === undefined ? '' : String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700))
  }
}
const CLIENTS = 'axmvp.v1.operations_clients'
const one = async (p, id) => (await p.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), CLIENTS)).find((c) => c.id === id)
const shift = (ymd, n) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const plusYears = (ymd, n) => { const d = new Date(Date.UTC(+ymd.slice(0, 4) + n, +ymd.slice(5, 7) - 1, +ymd.slice(8, 10))); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10) }

const browser = await chromium.launch()
const errs = []
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'] })
const page = await ctx.newPage()
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
const shot = async (p, name, full = false) => {
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full })
}
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(seedScript())
const T = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
// 다른 계약 고객은 어제 챙김(안부 줄이 한솔 하나만 뜨게) · 한솔 내부 메모에 수수료
await page.evaluate(({ k, recent }) => {
  const list = JSON.parse(localStorage.getItem(k))
  for (const c of list) {
    if (c.status !== 'active') continue
    c.activity = [{ id: `a-${c.id}`, kind: 'document', text: '서류 받음', serviceKey: null, at: `${recent}T01:00:00Z` }]
    c.notes_list = []
    delete c.care
  }
  const h = list.find((c) => c.id === 'cli_hansol')
  h.notes = '수수료 300만원 협의(내부)'
  h.contract = { signedAt: '', kind: 'cash', cashAmount: 5_000_000, policies: [], note: '' }
  localStorage.setItem(k, JSON.stringify(list))
}, { k: CLIENTS, recent: shift(T, -1) })

// N1
const signed = shift(T, -335)
const ends = plusYears(signed, 1) // T + 29 (평년 기준 · 윤년이 끼면 30)
const left = Math.round((Date.parse(`${ends}T00:00:00Z`) - Date.parse(`${T}T00:00:00Z`)) / 86_400_000)
await page.goto(BASE + '/ops/clients/cli_hansol?tab=overview', { waitUntil: 'networkidle' })
const openFold = async (p) => {
  const f = p.getByTestId('fold-contract')
  await f.waitFor({ timeout: 10000 })
  if (!(await p.getByTestId('contract-card').first().isVisible().catch(() => false))) await f.locator('button, summary').first().click()
  await p.getByTestId('contract-card').first().waitFor({ timeout: 5000 })
}
await openFold(page)
const card = page.getByTestId('contract-card').first()
await card.getByRole('button', { name: /계약 (고치기|정보 적기)/ }).click()
const field = page.getByTestId('contract-ends-field')
await field.waitFor()
await page.locator('input[type="date"]').first().fill(signed)
await field.locator('[data-testid="contract-ends-years"][data-years="1"]').click()
const endVal = await field.getByLabel('계약 끝나는 날').inputValue()
check('N1a [1년 계약] → 끝나는 날 = 계약일 + 1년 하루 전', endVal === ends, { endVal, ends })
await page.waitForTimeout(600)
await shot(page, 'rn-01-contract-sheet')
await page.getByRole('button', { name: '저장', exact: true }).click()
await page.waitForTimeout(600)
const h1 = await one(page, 'cli_hansol')
const endsTxt = (await card.getByTestId('contract-ends').innerText().catch(() => '')) ?? ''
check(`N1b 저장 → 업체 기록 끝나는 날 · 카드 '${ends}까지 · ${left}일 남음'(60일 안이라 주의 색)`, h1.contract.endsAt === ends && h1.contract.signedAt === signed && endsTxt === `${ends}까지 · ${left}일 남음` && (await card.getByTestId('contract-ends').getAttribute('data-tone')) === 'soon', { c: h1.contract, endsTxt })
// 접으면 요약 줄이 보인다(펼쳐 둔 동안에는 요약을 안 그림)
await page.getByTestId('fold-contract').locator('button, summary').first().click()
await page.waitForTimeout(300)
const foldSum = (await page.getByTestId('fold-contract').getByTestId('fold-summary').innerText().catch(() => '')) ?? ''
await openFold(page)
check(`N1d 접힌 '계약' 줄에도 '계약 끝 …(${left}일 남음)'`, foldSum.includes(`계약 끝 ${Number(ends.slice(5, 7))}/${Number(ends.slice(8, 10))}(${left}일 남음)`), foldSum)
check("N1c 활동 기록 '끝나는 날' 한 줄", (h1.activity ?? []).some((a) => a.kind === 'contract' && a.text.includes(`끝나는 날 ${ends}`)), h1.activity?.slice(0, 2))

// N2
await card.getByRole('button', { name: /계약 고치기/ }).click()
await field.waitFor()
await field.getByLabel('계약 끝나는 날').fill(shift(signed, -1))
check('N2 끝나는 날이 계약일보다 앞 → 안내 한 줄 · [저장] 꺼짐', (await page.getByTestId('contract-ends-wrong').count()) === 1 && (await page.getByRole('button', { name: '저장', exact: true }).isDisabled()))
await page.getByRole('button', { name: '취소', exact: true }).click()
await page.waitForTimeout(300)

// N3
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const care = page.getByTestId('today-care')
if ((await care.count()) && !(await care.getByTestId('care-row').first().isVisible().catch(() => false))) await care.getByRole('button').first().click().catch(() => {})
const row = care.locator('[data-testid="care-row"][data-client="cli_hansol"]')
await row.waitFor({ timeout: 8000 }).catch(() => {})
const rowText = (await row.innerText().catch(() => '')) ?? ''
check(`N3a 재계약 줄 — 1주년 줄 대신 하나 · '${left}일 남음' · 재계약 이야기`, (await row.getAttribute('data-reason').catch(() => '')) === 'renewal' && (await row.count()) === 1 && rowText.includes(`${left}일 남음`) && rowText.includes('재계약 이야기'), rowText)
await row.getByTestId('care-kakao').click()
await page.waitForTimeout(200)
const msg = await page.evaluate(() => navigator.clipboard.readText())
check('N3b [재계약 문구] — 끝나는 날 · 다음 계약 기간 · 수수료 0', msg.startsWith('안녕하세요,') && msg.includes(`${Number(ends.slice(5, 7))}/${Number(ends.slice(8, 10))}에 마무리됩니다`) && msg.includes('다음 계약 기간') && !/수수료|300만원/.test(msg), msg.slice(0, 200))
await shot(page, 'rn-02-today-care')

// N4
await row.getByTestId('care-contacted').click()
await page.waitForTimeout(600)
const h4 = await one(page, 'cli_hansol')
check('N4a [연락했어요] → 줄 빠짐 · 연락 기록 · 7일 뒤 다시', (await row.count()) === 0 && h4.care?.lastContactAt === T && h4.care?.snoozeUntil === shift(T, 7), h4.care)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(400)
check('N4b 새로 고쳐도 그대로(7일 동안 0)', (await page.locator('[data-testid="care-row"][data-client="cli_hansol"]').count()) === 0)

// N5 고객 플랫폼 탭 — 연결 → 재계약 전 연간 보고 줄 · ?make=annual
await page.goto(BASE + '/ops/clients/cli_hansol?tab=portal', { waitUntil: 'networkidle' })
await page.getByPlaceholder('customer@example.com').fill('ceo@hansol.example')
await page.getByRole('button', { name: '연결', exact: true }).click()
await page.getByTestId('portal-usage').waitFor({ timeout: 10000 })
await page.waitForTimeout(400)
const fus = await page.getByTestId('portal-followup').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-rule')}|${e.textContent}`))
check("N5a '재계약 전 연간 보고' 줄 — 끝나는 날 · 남은 날(보고 공백 줄은 대신 빠짐)", fus.some((f) => f.startsWith('renewal_report|') && f.includes(`${left}일 남음`) && f.includes('연간 보고')) && !fus.some((f) => f.startsWith('report_gap|')), fus)
await page.goto(BASE + '/ops/clients/cli_hansol?tab=portal&make=annual', { waitUntil: 'networkidle' })
const sheet = page.getByTestId('report-sheet')
await sheet.waitFor({ timeout: 10000 }).catch(() => {})
const kindOn = await page.locator('[data-testid="report-kind"][aria-pressed="true"]').getAttribute('data-kind').catch(() => '')
const periodOn = await page.locator('[data-testid="report-period"][aria-pressed="true"]').getAttribute('data-period').catch(() => '')
check('N5b ?make=annual → 보고서 창이 연간 · 계약일부터로 바로 · 주소 값은 지움', (await sheet.count()) === 1 && kindOn === 'annual' && periodOn === 'contract' && !page.url().includes('make='), { kindOn, periodOn, url: page.url() })
await page.waitForTimeout(600)
await shot(page, 'rn-03-report-annual')
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
if (await sheet.count()) await page.getByRole('button', { name: /닫기|취소/ }).first().click().catch(() => {})

// N6 [재계약했어요] — 7일 미루기를 지우고 다시
await page.evaluate((k) => { const l = JSON.parse(localStorage.getItem(k)); const h = l.find((c) => c.id === 'cli_hansol'); delete h.care.snoozeUntil; localStorage.setItem(k, JSON.stringify(l)) }, CLIENTS)
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const row6 = page.locator('[data-testid="care-row"][data-client="cli_hansol"]')
if (!(await row6.isVisible().catch(() => false))) await page.getByTestId('today-care').getByRole('button').first().click().catch(() => {})
await row6.getByTestId('care-renewed').click()
const rs = page.getByTestId('renew-sheet')
await rs.waitFor()
const y1 = plusYears(shift(ends, 1), 1)
const y2 = plusYears(shift(ends, 1), 2)
const pre1 = await page.getByLabel('새 계약 끝나는 날').inputValue()
check('N6a 재계약 창 — 새 계약 시작(끝 다음 날) · 지금과 같은 1년이 먼저', pre1 === y1 && ((await rs.innerText()) ?? '').includes(shift(ends, 1)) && (await rs.locator('[data-testid="renew-years"][data-years="1"]').getAttribute('aria-pressed')) === 'true', { pre1, y1 })
await rs.locator('[data-testid="renew-years"][data-years="2"]').click()
await page.waitForTimeout(600)
await shot(page, 'rn-04-renew-sheet')
await page.getByTestId('renew-save').click()
await page.waitForTimeout(700)
const h6 = await one(page, 'cli_hansol')
check("N6b 저장 → 줄 빠짐 · 끝나는 날 2년 뒤 · 이번 계약 시작 · 활동 기록 '재계약 — …'",
  (await row6.count()) === 0 && h6.contract.endsAt === y2 && h6.contract.termFrom === shift(ends, 1) && h6.contract.signedAt === signed && h6.activity?.[0]?.text === `재계약 — ${shift(ends, 1)} ~ ${y2}`, { c: h6.contract, a: h6.activity?.[0] })

// N7 미리 재계약 — 고객 플랫폼 탭 연간 보고 줄은 남음 · 계약 칸 안내
await page.goto(BASE + '/ops/clients/cli_hansol?tab=portal', { waitUntil: 'networkidle' })
await page.getByTestId('portal-usage').waitFor({ timeout: 10000 })
await page.waitForTimeout(400)
const fus7 = await page.getByTestId('portal-followup').evaluateAll((els) => els.map((e) => e.getAttribute('data-rule')))
check('N7a 미리 재계약해도 끝나는 계약의 연간 보고 줄은 남음', fus7.includes('renewal_report'), fus7)
await page.goto(BASE + '/ops/clients/cli_hansol?tab=overview', { waitUntil: 'networkidle' })
await openFold(page)
await page.getByTestId('contract-card').first().getByRole('button', { name: /계약 고치기/ }).click()
await page.getByTestId('contract-ends-field').waitFor()
const f7 = (await page.getByTestId('contract-ends-field').innerText()) ?? ''
check(`N7b 계약 창 — 끝나는 날 ${y2} · '재계약 — 이번 계약은 …부터예요'`, (await page.getByLabel('계약 끝나는 날').inputValue()) === y2 && f7.includes(`이번 계약은 ${shift(ends, 1)}부터예요`), f7)
await page.getByRole('button', { name: '취소', exact: true }).click()

// N8 영업 → 계약 완료 '계약 기간'
await page.goto(BASE + '/ops/clients/cli_mirae', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const salesCard = page.getByTestId('client-sales-card')
if (!(await salesCard.getByLabel('영업 단계').isVisible())) await salesCard.getByRole('button', { name: /영업/ }).first().click()
await salesCard.getByLabel('영업 단계').selectOption('contracted')
const close = page.getByTestId('contract-close')
await close.waitFor()
const termChips = await page.getByTestId('contract-close-term').locator('button').evaluateAll((els) => els.map((e) => `${e.textContent}:${e.getAttribute('aria-pressed')}`))
check("N8a 계약 완료 창 '계약 기간' — 정하지 않음(먼저) · 1년 · 2년", termChips.join() === '정하지 않음:true,1년:false,2년:false', termChips)
await page.getByTestId('contract-close-term').locator('[data-years="1"]').click()
const closeSigned = await close.locator('input[type="date"]').first().inputValue()
await page.getByTestId('contract-close-save').click()
await page.waitForTimeout(800)
const m8 = await one(page, 'cli_mirae')
check('N8b [1년] → 끝나는 날 = 계약일 + 1년 하루 전', m8.contract.endsAt === plusYears(closeSigned, 1) && m8.status === 'active', m8.contract)
const daum = await one(page, 'cli_daum')
check('N8c 기간을 안 적은 업체는 끝나는 날 빈 칸(짐작 0) · 재계약 줄 0', (daum.contract?.endsAt ?? '') === '')

// N9 390
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
const mp = await m.newPage()
mp.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
await mp.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
const store = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]))))
await mp.evaluate((s) => { for (const [k, v] of Object.entries(JSON.parse(s))) localStorage.setItem(k, v) }, store)
// 한솔을 다시 끝나기 10일 전으로(재계약 전)
await mp.evaluate(({ k, e }) => { const l = JSON.parse(localStorage.getItem(k)); const h = l.find((c) => c.id === 'cli_hansol'); h.contract = { ...h.contract, endsAt: e, termFrom: '' }; delete h.care; localStorage.setItem(k, JSON.stringify(l)) }, { k: CLIENTS, e: shift(T, 10) })
const over = async () => mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
await mp.waitForTimeout(500)
const mrow = mp.locator('[data-testid="care-row"][data-client="cli_hansol"]')
if (!(await mrow.isVisible().catch(() => false))) await mp.getByTestId('today-care').getByRole('button').first().click().catch(() => {})
await mrow.waitFor({ timeout: 8000 }).catch(() => {})
const btnH = await mrow.locator('button, a').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
check('N9a 390 안부 재계약 줄 — 급함(7일 밖이라 아님) · 넘침 0 · 단추 40px 이상', (await over()) <= 0 && btnH.length >= 5 && btnH.every((x) => x >= 40), { over: await over(), btnH })
await shot(mp, 'rn-m-01-today', false)
await mrow.getByTestId('care-renewed').click()
await mp.getByTestId('renew-sheet').waitFor()
await mp.waitForTimeout(400)
check('N9b 390 재계약 창 — 넘침 0', (await over()) <= 0, await over())
await mp.waitForTimeout(600)
await shot(mp, 'rn-m-02-renew')
await mp.keyboard.press('Escape')
await mp.goto(BASE + '/ops/clients/cli_hansol?tab=overview', { waitUntil: 'networkidle' })
await openFold(mp)
await mp.getByTestId('contract-card').first().getByRole('button', { name: /계약 고치기/ }).click()
await mp.getByTestId('contract-ends-field').waitFor()
await mp.waitForTimeout(400)
check('N9c 390 계약 창 — 넘침 0', (await over()) <= 0, await over())
await mp.waitForTimeout(600)
await shot(mp, 'rn-m-03-contract')
await m.close()

check('N10 JS 오류 0', errs.length === 0, errs)
await browser.close()
console.log(`\nqa:renewal ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
