/**
 * 세금 계산기 05 · 06 상황 예시 시험 (D-243 · 로드맵 5단계 남은 것 '계산기 2').
 *
 *  1440  가족 주주 업체 › 맞춤 추천 › 상황 예시 — 계산기 5가지(무이자 대여 · 채무면제 · 증여 · 자녀만 증자 · 대표만 감자)가 절세로
 *        · 펼치면 그 자리에서 결론(가족 몫 · 한도) · [모듈에서 이어서] → 그 계산기 · 그 탭이 같은 가정으로 열림
 *        · 계산기 칸 = 주주명부(이름 · 구분 · 주식 수) + 상황 값(10억) · 결과 = 업체 상세에서 본 숫자 · 주소의 preset 은 한 번 쓰고 지움
 *        · 넣은 가정 칩 · [가정 빼기] · 칸을 고치면 그 칩은 사라짐 · '상황 예시로 바로' 단추로 같은 계산기 다른 상황
 *        · 06 증자: 자녀 줄 신주 20% · 인수가 = 액면가 · 시가 = 09 식 · 06 감자: 대표 줄 30%
 *        · 주주명부 없는 업체: 상황 값만 넣고 '주주명부가 없어' 안내 · 업체 없이 연 계산기엔 상황 단추 없음
 *  D-244  처음 연 06 [가정 빼기] → 업체 주주명부(예시 주주로 안 바뀜) · 직접 적은 칸을 상황 단추가 바꿔도 [가정 빼기]로 돌아옴
 *  360 · 390 × 1.0 · 1.30  가로 넘침 0 · 상황 단추 · 가정 빼기 44px · 단추 글자 넘침 0
 *
 *   node e2e/calcpreset.mjs http://localhost:4390 [스크린샷 폴더]
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.argv[3] ?? ''
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' ' + detail}`)
}

const NOW = '2026-09-01T00:00:00.000Z'
const yes = { a: 'yes', at: NOW }
const FAM = {
  id: 'cli_fam',
  companyName: '(주)가족정밀',
  corporateNumber: '110111-1111111',
  representativeName: '김대표',
  establishedAt: '2010-03-02',
  representativeBirth: '1962-01-01',
  businessCategory: '제조업',
  businessItem: '정밀기계 부품',
  businessAddress: '경기도 화성시 동탄대로 1',
  employeeCount: '20',
  status: 'active',
  taxProfile: { par: '5000', vAsset: '5,000,000,000', vDebt: '2,000,000,000', vInc0: '300,000,000', vInc1: '350,000,000', vInc2: '400,000,000' },
  shareholderRegister: [
    { id: 'h1', name: '김대표', relation: 'ceo', shares: 60000, acquirePrice: 5000 },
    { id: 'h2', name: '이배우', relation: 'spouse', shares: 25000, acquirePrice: 5000 },
    { id: 'h3', name: '김자녀', relation: 'child', shares: 15000, acquirePrice: 5000 },
  ],
  decided: { 'scn.lendToCorp': yes, 'scn.giftToCorp': yes, 'scn.succession': yes },
  createdAt: NOW,
  updatedAt: NOW,
}
const NOREG = { id: 'cli_noreg', companyName: '(주)명부없음', corporateNumber: '110111-2222222', establishedAt: '2020-01-01', status: 'active', createdAt: NOW, updatedAt: NOW }

async function seed(page) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(
    (rows) => {
      const k = 'axmvp.v1.operations_clients'
      const list = JSON.parse(localStorage.getItem(k) ?? '[]').filter((r) => !rows.some((x) => x.id === r.id))
      list.push(...rows)
      localStorage.setItem(k, JSON.stringify(list))
      for (const key of Object.keys(localStorage)) if (key.startsWith('axmvp.tax.')) localStorage.removeItem(key)
    },
    [FAM, NOREG],
  )
}

const row = (page, id) => page.locator(`[data-testid="scenario-row"][data-id="${id}"]`)
async function expand(page, id) {
  if ((await row(page, id).count()) === 0 && (await page.getByTestId('scenario-more').count())) await page.getByTestId('scenario-more').click()
  const r = row(page, id)
  if ((await r.getByTestId('scenario-detail').count()) === 0) await r.getByTestId('scenario-toggle').click()
  await r.getByTestId('scenario-detail').waitFor()
  return r
}
const lineV = (page, block, k) => page.locator(`[data-block="${block}"] [data-line][data-k="${k}"]`).getAttribute('data-v')
const rowsOf = (page, id) =>
  page.locator(`table[data-rows="${id}"] tbody tr`).evaluateAll((trs) =>
    trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.querySelector('input,select') ? td.querySelector('input,select').value : td.textContent.trim()))),
  )
async function openCalc(page, path) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.locator('[data-block]').first().waitFor({ timeout: 15000 })
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await seed(page)
  await page.goto(`${BASE}/ops/clients/cli_fam?tab=smart`, { waitUntil: 'networkidle' })
  await page.getByTestId('smart-scenarios').waitFor({ timeout: 15000 })
  if (await page.getByTestId('scenario-more').count()) await page.getByTestId('scenario-more').click()
  const ids = ['calc-t7-loan', 'calc-t7-forgive', 'calc-t7-gift', 'calc-t8-issue', 'calc-t8-reduce']
  const fits = await Promise.all(ids.map((id) => row(page, id).getAttribute('data-fit').catch(() => null)))
  check('맞춤 추천 › 가족 주주 업체(대표 답 "예") — 계산기 05 · 06 상황 5가지가 모두 "맞음"', fits.every((f) => f === 'fit'), fits.join(','))

  const loanRow = await expand(page, 'calc-t7-loan')
  const head = await loanRow.getByTestId('scenario-headline').innerText()
  const amount = await loanRow.getByTestId('scenario-amount').innerText()
  const lines = await loanRow.getByTestId('scenario-lines').innerText()
  check('펼치면 그 자리에서 결론 — "비과세 — 가족 주주 몫이 가장 커도 1,150만원" · 한도 36억 2,319만원 · 배우자 · 자녀 줄', head.includes('비과세 — 가족 주주 몫이 가장 커도 1,150만원') && amount.includes('한도 36억 2,319만원') && lines.includes('이배우') && lines.includes('김자녀'), `${head} | ${amount}`)
  const href = (await loanRow.getByTestId('scenario-open').getAttribute('href')) ?? ''
  check('[세금 계산기 05에서 이어서] → 세금 계산기 05 · 무상대여 탭 · 같은 업체 · 같은 상황', (await loanRow.getByTestId('scenario-open').innerText()).includes('세금 계산기 05에서 이어서') && href.includes('/tools/tax') && href.includes('m=calc') && href.includes('c=t7') && href.includes('s=w1') && href.includes('client=cli_fam') && href.includes('preset=calc-t7-loan'), href)

  await loanRow.getByTestId('scenario-open').click()
  await page.locator('[data-block="w1_out"]').waitFor({ timeout: 15000 })
  await page.getByTestId('calc-preset-note').waitFor()
  check('계산기가 열리면 주소의 preset 은 지움(새로고침해도 다시 덮지 않게)', !page.url().includes('preset=') && page.url().includes('c=t7'), page.url())
  const t7rows = await rowsOf(page, 'w_share_rows')
  check('05 주주 표 = 주주명부 — 김대표 지배주주 60,000 · 이배우 · 김자녀 친족 · 나머지 줄은 D~J', t7rows[0][0] === '김대표' && t7rows[0][1] === '지배주주' && t7rows[0][2] === '60,000' && t7rows[1][0] === '이배우' && t7rows[1][1] === '지배주주의 친족' && t7rows[2][0] === '김자녀' && t7rows[3][0] === 'D' && t7rows.length === 10, JSON.stringify(t7rows.slice(0, 4)))
  check('상황 값 — 대여원금 1,000,000,000(쉼표) · 이율 4.6%는 계산기 기본 그대로', (await page.locator('#w1_principal').inputValue()) === '1,000,000,000' && (await page.locator('#w1_rate').inputValue()) === '4.6')
  const gain = await lineV(page, 'w1_out', '특정법인의 이익(대여원금×적정이자율)')
  const limit = await lineV(page, 'w1_out', '과세되지 않는 대여원금 한도')
  check('계산기 결과 = 업체 상세에서 본 숫자 — 이익 46,000,000원 · 한도 3,623,188,406원(= 36억 2,319만원)', gain === '46,000,000원' && limit === '3,623,188,406원', `${gain} · ${limit}`)
  const noteText = await page.getByTestId('calc-preset-note').innerText()
  const chips = await page.getByTestId('preset-chip').allInnerTexts()
  check('넣은 가정 칩 — "빌려준 돈 10억원" · "이자 없이"(업체 숫자인 주주명부는 칩에 없음)', JSON.stringify(chips) === JSON.stringify(['빌려준 돈 10억원', '이자 없이']) && noteText.includes('이 업체 숫자로 바로 계산했어요'), JSON.stringify(chips))
  const prefillNote = await page.locator('text=이 업체 기록(절세 설계 현황 · 주주명부)에서 채웠습니다').first().innerText()
  check('업체 기록에서 채운 칸 이름 — 주주명부(주식 수 · 관계)', prefillNote.includes('주주명부(주식 수 · 관계)'), prefillNote)
  const btns = await page.getByTestId('calc-preset').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))
  check('이 계산기 상황 예시 단추 — 05 는 3가지(무이자 대여 · 채무면제 · 증여)', JSON.stringify(btns) === JSON.stringify(['calc-t7-loan', 'calc-t7-forgive', 'calc-t7-gift']), JSON.stringify(btns))

  // [가정 빼기] → 넣기 전 값(처음 연 계산기면 계산기 예시 50억) · 주주 표(업체 숫자)는 그대로
  await page.getByTestId('preset-clear').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="calc-preset-note"]')?.getAttribute('data-cleared') === '1')
  check('[가정 빼기] → 대여원금이 상황 예시 전 값(계산기 예시 5,000,000,000)으로 · 주주 표(업체 숫자)는 그대로', (await page.locator('#w1_principal').inputValue()) === '5,000,000,000' && (await rowsOf(page, 'w_share_rows'))[0][0] === '김대표')
  // 상황 단추로 다시 → 10억 · 칸을 고치면 그 칩은 사라진다(대표 값) — 다른 칩은 그대로
  await page.locator('[data-testid="calc-preset"][data-id="calc-t7-loan"]').click()
  await page.waitForFunction(() => document.querySelector('#w1_principal')?.value === '1,000,000,000')
  check('상황 단추를 다시 누르면 같은 가정이 다시 들어감(칩 2개)', (await page.getByTestId('preset-chip').count()) === 2)
  await page.locator('#w1_principal').fill('2,000,000,000')
  const chips2 = await page.getByTestId('preset-chip').allInnerTexts()
  check('대여원금을 직접 고치면 "빌려준 돈" 칩이 사라지고 "이자 없이" 만 남음', JSON.stringify(chips2) === JSON.stringify(['이자 없이']), JSON.stringify(chips2))
  await page.getByTestId('preset-clear').click()
  check('직접 고친 칸은 [가정 빼기] 해도 그대로(2,000,000,000)', (await page.locator('#w1_principal').inputValue()) === '2,000,000,000')

  // 같은 계산기의 다른 상황 — 채무면제
  await page.locator('[data-testid="calc-preset"][data-id="calc-t7-forgive"]').click()
  await page.locator('[data-block="w2_out"]').waitFor()
  await page.waitForFunction(() => document.querySelector('#w2_amount')?.value === '300,000,000')
  check('상황 단추 "채무면제 3억" → 채무면제 탭 · 면제액 300,000,000 · 소득금액 = 결산 순손익 400,000,000 · 주소에 preset 없음', (await page.locator('#w2_income').inputValue()) === '400,000,000' && page.url().includes('s=w2') && !page.url().includes('preset='), page.url())
  const net = await lineV(page, 'w2_out', '정산증여액')
  check('채무면제 결과 줄(정산증여액)이 원 단위로 계산됨', /^[\d,]+원$/.test(net ?? ''), net)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/calc-1440-t7-forgive.png`, fullPage: false })

  // 새로고침 — 적은 값은 남고, 상황 알림은 다시 뜨지 않음
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('[data-block="w2_out"]').waitFor()
  check('새로고침해도 칸 값은 남음(업체별 저장) · 상황 알림은 다시 덮지 않음', (await page.locator('#w2_amount').inputValue()) === '300,000,000' && (await page.getByTestId('calc-preset-note').count()) === 0)
  // D-244 상황 단추가 업체 숫자로 다시 채운 칸(예전에 직접 적은 소득금액)도 [가정 빼기]로 돌아옴
  await page.locator('#w2_income').fill('123,456,789')
  await page.locator('#w2_income').blur()
  await page.waitForTimeout(200)
  await page.locator('[data-testid="calc-preset"][data-id="calc-t7-forgive"]').click()
  await page.waitForFunction(() => document.querySelector('#w2_income')?.value === '400,000,000')
  await page.getByTestId('preset-clear').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="calc-preset-note"]')?.getAttribute('data-cleared') === '1')
  check('직접 적은 소득금액(123,456,789)을 상황 단추가 업체 숫자로 바꿔도 [가정 빼기]로 돌아옴', (await page.locator('#w2_income').inputValue()) === '123,456,789', await page.locator('#w2_income').inputValue())

  // 06 증자 — 자녀 줄 신주 20% · 인수가 = 액면가
  await openCalc(page, '/tools/tax?client=cli_fam&m=calc&c=t8&s=x1&preset=calc-t8-issue')
  await page.getByTestId('calc-preset-note').waitFor()
  const x1 = await rowsOf(page, 'x1_rows')
  const kid = x1.find((r) => r[0] === '김자녀')
  const fair = Number((await page.locator('#x1_fair').inputValue()).replace(/,/g, ''))
  check('06 증자 — 주주 표 = 주주명부 · 김자녀 신주 20,000(10만 주의 20%) · 인수가 5,000(액면가) · 시가 = 09 식(액면가보다 큼)', x1.length === 3 && kid && kid[3] === '20,000' && (await page.locator('#x1_issue').inputValue()) === '5,000' && fair > 5000, JSON.stringify(x1))
  const judge = await page.locator('table[data-table="x1_judge"] tbody tr').allInnerTexts()
  check('06 증자 판정 표에 김자녀 한 줄', judge.length === 1 && judge[0].includes('김자녀'), judge.join(' | '))
  // D-244 처음 연 06 에서 [가정 빼기] — 주주 표는 이 업체 주주명부(신주만 0) · 계산기 예시 주주(김XX)로 바뀌지 않음
  await page.getByTestId('preset-clear').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="calc-preset-note"]')?.getAttribute('data-cleared') === '1')
  const x1c = await rowsOf(page, 'x1_rows')
  check('06 처음 연 계산기에서 [가정 빼기] → 주주 표는 업체 주주명부 그대로 · 김자녀 신주 0 · 예시 주주(김XX) 없음', x1c.length === 3 && x1c.every((r) => !r[0].includes('XX')) && x1c.find((r) => r[0] === '김자녀')?.[3] === '0', JSON.stringify(x1c))
  const btn8 = await page.getByTestId('calc-preset').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))
  check('06 상황 단추 — 자녀만 증자 · 대표만 감자', JSON.stringify(btn8) === JSON.stringify(['calc-t8-issue', 'calc-t8-reduce']), JSON.stringify(btn8))
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/calc-1440-t8-issue.png`, fullPage: false })
  await page.locator('[data-testid="calc-preset"][data-id="calc-t8-reduce"]').click()
  await page.locator('table[data-table="x2_judge"]').waitFor()
  await page.waitForFunction(() => document.querySelector('#x2_redeem')?.value === '5,000')
  const x2 = await rowsOf(page, 'x2_rows')
  const judge2 = await page.locator('table[data-table="x2_judge"] tbody tr').allInnerTexts()
  check('06 감자 — 김대표 줄 감자 18,000(6만 주의 30%) · 감자대가 5,000 · 지분이 늘어나는 이배우 · 김자녀 두 줄', x2[0][0] === '김대표' && x2[0][3] === '18,000' && judge2.length === 2 && judge2.some((t) => t.includes('이배우')) && judge2.some((t) => t.includes('김자녀')), JSON.stringify(x2[0]) + ' ' + judge2.join(' | '))

  // 주주명부 없는 업체 — 상황 값만 · 안내
  await openCalc(page, '/tools/tax?client=cli_noreg&m=calc&c=t7&s=w1&preset=calc-t7-loan')
  await page.getByTestId('calc-preset-note').waitFor()
  const nr = await page.getByTestId('calc-preset-note').innerText()
  check('주주명부 없는 업체 — "주주명부(주식 수)가 없어 상황 값만" 안내(D-335 조사 하나) · 대여원금 10억은 들어감 · 주주 표는 계산기 예시(A)', nr.includes('주주명부(주식 수)가 없어 상황 값만') && (await page.locator('#w1_principal').inputValue()) === '1,000,000,000' && (await rowsOf(page, 'w_share_rows'))[0][0] === 'A', nr)

  // 업체 없이 연 계산기 — 상황 단추 없음
  await openCalc(page, '/tools/tax?m=calc&c=t7')
  check('업체 없이 연 계산기엔 "상황 예시로 바로" 단추가 없음(업체 숫자로 계산할 수 없어서)', (await page.getByTestId('calc-presets').count()) === 0)
  check('1440 페이지 오류 0', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- 360 · 390 × 1.0 · 1.30 ---------------- */
for (const width of [360, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await seed(page)
  for (const scale of ['default', 'extra_large']) {
    await openCalc(page, '/tools/tax?client=cli_fam&m=calc&c=t8&s=x1&preset=calc-t8-issue')
    await page.getByTestId('calc-preset-note').waitFor()
    await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
    await page.waitForTimeout(150)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    const sizes = await page.locator('[data-testid="calc-preset"], [data-testid="preset-clear"]').evaluateAll((els) => els.map((e) => ({ h: Math.round(e.getBoundingClientRect().height), spill: e.scrollWidth - e.clientWidth })))
    check(`${width} · ${scale} — 가로 넘침 0 · 상황 단추 · 가정 빼기 44px 이상 · 단추 글자 넘침 0`, over <= 0 && sizes.length === 3 && sizes.every((s) => s.h >= 44 && s.spill <= 1), `${over} ${JSON.stringify(sizes)}`)
  }
  check(`${width} 페이지 오류 0`, errors.length === 0, errors.join(' | '))
  if (SHOTS) {
    for (const scale of ['default', 'extra_large']) {
      await openCalc(page, '/tools/tax?client=cli_fam&m=calc&c=t8&s=x1&preset=calc-t8-issue')
      await page.getByTestId('calc-preset-note').waitFor()
      await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
      await page.waitForTimeout(150)
      await page.getByTestId('calc-preset-note').scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${SHOTS}/calc-${width}-${scale}.png`, fullPage: false })
    }
  }
  await ctx.close()
}

await browser.close()
console.log(`\ncalcpreset: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
