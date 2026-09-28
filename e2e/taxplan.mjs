/**
 * 절세 설계 시험 (D-130) — 원하는 결과를 적으면 세금 계산기 식으로 거꾸로 찾는다.
 *
 *  1440  업체 없이 연 세금 계산기는 계산기부터(예전 그대로) · 업체로 열면 '원하는 결과로 찾기' 부터
 *        · 업체 상세의 '절세 계산하기' 가 이 화면으로 온다
 *        · 현황(급여 · 주주명부 · 자산 · 순이익)을 적으면 1주 가치 · 대표 지분 · 급여 부담이 한 번에
 *        · "이번에 1억 현금화하고 싶어" → 알아들은 것 · 급여 · 배당 · 주식 · 퇴직금 비교 · 추천 · 근거
 *        · 같은 숫자로 계산기 열기(01 급여 · 03 소득세 배당) — 계산기 칸에 그 숫자가 들어 있다
 *        · 급여 실효 20% · 자녀 지분 10% 증여 · 상속 · 가지급금(갚을 돈 가져오기로 이어짐) · 퇴직금
 *        · [업체 기록에 저장] → 주주명부 · 절세 현황 · 결과 → 새로 열면 업체 기록에서 다시 읽는다
 *        · 계산기 모드의 '기록에 붙이기' 가 방금 저장한 주주명부를 지우지 않는다(예전 목록 덮어쓰기 막음)
 *  360 · 390 · 430 × 1.0 · 1.30  가로 넘침 0 · 누르는 것 44px
 *
 *   node e2e/taxplan.mjs http://localhost:4390
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

const record = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_hansol'))

/** 화면에서 현황을 적는다 — 상담 때 대표가 하는 그대로 */
async function fillNow(page) {
  const fill = (label, v) => page.getByLabel(label, { exact: true }).first().fill(v)
  await fill('대표 월 급여(지금)', '800만')
  await fill('대표 취임일(퇴직금 기산일)', '2015-03-02')
  await fill('가지급금 잔액', '3억')
  await fill('배당 가능한 이익(미처분이익잉여금)', '20억')
  for (const [n, rel, q] of [['김대표', 'ceo', '60000'], ['이배우', 'spouse', '25000'], ['김자녀', 'child', '0'], ['박이사', 'executive', '15000']]) {
    await page.getByTestId('holder-add').click()
    const i = await page.getByTestId('holder-row').count()
    await page.getByLabel(`주주 ${i} 이름`).fill(n)
    await page.getByLabel(`주주 ${i} 관계`).selectOption(rel)
    await page.getByLabel(`주주 ${i} 주식 수`).fill(q)
    if (rel !== 'child') await page.getByLabel(`주주 ${i} 1주 취득가`).fill('5000')
  }
  await fill('자산총계', '50억')
  await fill('부채총계', '20억')
  await fill('순이익 — 결산 연도', '6억')
  await fill('순이익 — 직전 연도', '5억')
  await fill('순이익 — 2년 전', '4억')
}

async function ask(page, text) {
  await page.getByTestId('plan-text').fill(text)
  await page.getByTestId('plan-find').click()
  await page.waitForTimeout(500)
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())

  await page.goto(BASE + '/tools/tax', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check('업체 없이 열면 계산기부터(예전 그대로)', (await page.getByTestId('tax-plan').count()) === 0 && (await page.locator('[data-block]').count()) > 0)
  check('두 칸: 원하는 결과로 찾기 · 계산기 9종', (await page.locator('[data-mode="plan"]').count()) === 1 && (await page.locator('[data-mode="calc"]').innerText()).includes('계산기 9종'))

  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const entry = page.locator('a[href*="/tools/tax?client=cli_hansol"]').first()
  check('업체 상세에 절세 입구가 있다', (await entry.count()) === 1)
  await page.goto(BASE + '/tools/tax?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('업체로 열면 원하는 결과로 찾기부터', (await page.getByTestId('tax-plan').count()) === 1 && (await page.locator('[data-mode="plan"][aria-selected="true"]').count()) === 1)

  await fillNow(page)
  await page.waitForTimeout(400)
  const now = (await page.getByTestId('plan-now-summary').innerText()) ?? ''
  check('현황: 1주 가치 44,000원 · 기업가치 44억 (09 식)', now.includes('1주당 가치 44,000원') && now.includes('44억원') && now.includes('09 비상장주식'), now)
  check('현황: 대표 김대표 지분 60% · 평가액 26억 4,000만원', now.includes('대표 김대표 지분 60.0%') && now.includes('26억 4,000만원'), now)
  check('현황: 대표 급여 실효부담 · 가지급금 해마다 손해', now.includes('실효부담') && now.includes('가지급금') && now.includes('손해'), now)

  // 1억 현금화
  await ask(page, '이번에 1억 현금화하고 싶어')
  check('문장: 알아들은 것 — 세후 1억 가져오기', ((await page.getByTestId('plan-heard').innerText()) ?? '').includes('세후 100,000,000원'))
  const cash = page.getByTestId('result-cash')
  check('현금 1억: 네 가지 방법을 모두 계산', (await cash.locator('[data-route]').count()) === 4, String(await cash.locator('[data-route]').count()))
  const best = (await page.getByTestId('route-best').innerText()) ?? ''
  check('현금 1억: 추천 — 주식 팔기 · 순부담 2,397만원', best.includes('주식 팔기') && best.includes('2,397만원'), best)
  const order = await cash.locator('[data-route]').evaluateAll((els) => els.map((e) => e.getAttribute('data-route')))
  check('현금 1억: 추천이 맨 위 · 퇴직금(퇴임 때만)은 뒤', order[0] === 'shareSale' && order.indexOf('retire') > order.indexOf('dividend'), order.join(','))
  const divCard = cash.locator('[data-route="dividend"]')
  check('현금 1억 · 배당: 다른 주주 몫 · 차등배당 주의', ((await divCard.innerText()) ?? '').includes('다른 주주도') && ((await divCard.innerText()) ?? '').includes('차등배당'))
  await divCard.getByText('계산 근거 보기').click()
  check('근거: 법 조항 · 어느 계산기', ((await divCard.innerText()) ?? '').includes('03 2026 소득세') && ((await divCard.innerText()) ?? '').includes('§14'))
  check('참고용 · 세무사 검토 문구', ((await page.getByTestId('tax-plan').innerText()) ?? '').includes('담당 세무사'))

  // 같은 숫자로 계산기 열기 — 배당(03 소득세)
  await divCard.getByRole('button', { name: /03 소득세\(1안\)에서 열기/ }).click()
  await page.waitForTimeout(700)
  check('계산기 열기: 03 소득세 1안으로 간다(업체는 그대로)', page.url().includes('c=t9') && page.url().includes('client=cli_hansol'), page.url())
  const dv = (await page.locator('#inc_a_dividend').inputValue()).replace(/,/g, '')
  check('계산기 열기: 배당 칸에 찾은 배당(155,077,000원)', dv === '155077000', dv)
  const t9sal = (await page.locator('#inc_a_salary').inputValue()).replace(/,/g, '')
  check('계산기 열기: 급여 칸에 지금 연봉(9,600만원)', t9sal === '96000000', t9sal)

  // 급여 실효 20%
  await page.locator('[data-mode="plan"]').click()
  await page.waitForTimeout(400)
  check('다시 원하는 결과로: 적은 현황이 그대로', ((await page.getByTestId('plan-now-summary').innerText()) ?? '').includes('44,000원'))
  await ask(page, '급여 실효세율 20%로')
  const sal = (await page.getByTestId('result-salary').innerText()) ?? ''
  check('급여 실효 20%: 월 7,467,000원 · 실효 20.0%', sal.includes('월 급여 7,467,000원') && sal.includes('20.0%'), sal.slice(0, 300))
  await page.getByTestId('result-salary').getByRole('button', { name: /01 급여 최적화에서 열기/ }).click()
  await page.waitForTimeout(600)
  const sm = (await page.locator('#s_monthly').inputValue()).replace(/,/g, '')
  check('계산기 열기: 01 급여 칸에 7,467,000원', page.url().includes('c=t2') && sm === '7467000', sm)
  const eff = await page.locator('[data-k="개인 실효부담률"]').getAttribute('data-v')
  check('계산기 열기: 01 계산기도 실효부담률 20.0%', eff === '20.0%', eff)

  // 증여 · 상속 · 가지급금 · 퇴직금
  await page.locator('[data-mode="plan"]').click()
  await page.waitForTimeout(400)
  await ask(page, '자녀에게 지분 10% 증여, 가업승계')
  await page.getByLabel('받는 사람').selectOption({ label: '김자녀 · 자녀(성년)' })
  await page.getByLabel('대표 부동산', { exact: true }).fill('15억')
  await page.getByLabel('대표 금융재산', { exact: true }).fill('3억')
  await page.getByLabel('자녀 수', { exact: true }).fill('2')
  await page.waitForTimeout(400)
  const gift = (await page.getByTestId('result-gift').innerText()) ?? ''
  check('증여 10%: 증여세 68,000,000원 · 대표 50% · 자녀 10%', gift.includes('증여세 68,000,000원') && gift.includes('50.0%') && gift.includes('10.0%'), gift.slice(0, 300))
  check('증여: 가업승계 과세특례는 계산기에 없다고 밝힌다', gift.includes('§30의6') && gift.includes('세무사'))
  const inh = (await page.getByTestId('result-inherit').innerText()) ?? ''
  check('상속: 지금 · 증여 후 10년 안 · 10년 뒤 비교', inh.includes('지금 상속되면') && inh.includes('10년 안에') && inh.includes('10년 뒤'), inh.slice(0, 300))
  await ask(page, '가지급금 3억 정리')
  const loan = (await page.getByTestId('result-loan').innerText()) ?? ''
  check('가지급금 3억: 해마다 손해 · 5년 · 10년', loan.includes('해마다') && loan.includes('10년'), loan.slice(0, 200))
  check('가지급금: 갚을 돈 3억 가져오기로 이어진다', (await page.getByLabel('대표 손에 남길 금액(세후)').inputValue()) === '3억원')
  await ask(page, '퇴직금 얼마까지 되나')
  const ret = (await page.getByTestId('result-retire').innerText()) ?? ''
  check('퇴직금: 한도 · 세후', ret.includes('한도') && ret.includes('세후'), ret.slice(0, 200))

  // 업체 기록에 저장 → 새로 열면 업체 기록에서
  await page.getByTestId('plan-save').click()
  await page.waitForTimeout(900)
  const saved = await record(page)
  check('저장: 주주명부 4명 · 대표 6만주', saved.shareholderRegister?.length === 4 && saved.shareholderRegister.find((r) => r.relation === 'ceo')?.shares === 60000, JSON.stringify(saved.shareholderRegister))
  check('저장: 절세 현황(급여 800만 · 자산 50억)', saved.taxProfile?.monthlySalary === '800만' && saved.taxProfile?.vAsset === '50억', JSON.stringify(saved.taxProfile))
  check('저장: 결과가 업체 기록에(절세 설계)', saved.toolResults?.[0]?.title?.includes('절세 설계') && saved.toolResults[0].summary.includes('추천'), saved.toolResults?.[0]?.summary?.slice(0, 200))
  await page.evaluate(() => localStorage.removeItem('axmvp.taxplan.cli_hansol'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  check('새로 열면: 업체 기록의 주주명부 · 현황으로 시작', (await page.getByTestId('holder-row').count()) === 4 && ((await page.getByTestId('plan-now-summary').innerText()) ?? '').includes('44,000원'))

  // 계산기 모드에서 결과 붙이기가 주주명부를 지우지 않는다
  await page.locator('[data-mode="calc"]').click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /기록에 붙이기/ }).first().click()
  await page.waitForTimeout(900)
  const after = await record(page)
  check('계산기 결과 붙이기 뒤에도 주주명부 · 현황이 남는다', after.shareholderRegister?.length === 4 && after.taxProfile?.monthlySalary === '800만' && after.toolResults.length > saved.toolResults.length, `${after.shareholderRegister?.length} ${after.toolResults.length}`)

  check('JS 오류 없음', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- 360 · 390 · 430 × 1.0 · 1.30 ---------------- */
for (const width of [360, 390, 430]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/tools/tax?client=cli_hansol', { waitUntil: 'networkidle' })
  await fillNow(page)
  await ask(page, '1억 현금화, 급여 실효 20%')
  await ask(page, '자녀에게 지분 10% 증여, 가업승계, 가지급금 3억, 퇴직금')
  await page.getByLabel('받는 사람').selectOption({ label: '김자녀 · 자녀(성년)' })
  for (const scale of ['default', 'extra_large']) {
    await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
    await page.waitForTimeout(500)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    check(`${width} ${scale}: 절세 설계 가로 넘침 0`, over <= 1, String(over))
    const small = await page
      .getByTestId('tax-plan')
      .locator('button, summary, select, input')
      .evaluateAll((els) =>
        els
          .filter((e) => {
            const b = e.getBoundingClientRect()
            return b.width > 0 && b.height > 0 && b.height < 43.5
          })
          .map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)),
      )
    check(`${width} ${scale}: 누르는 것 44px`, small.length === 0, small.slice(0, 6).join('|'))
  }
  await ctx.close()
}

await browser.close()
console.log(`\n절세 설계: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
