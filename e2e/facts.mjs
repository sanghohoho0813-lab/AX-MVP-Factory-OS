/**
 * 고객 사실 창고 시험 (D-128) — 자료는 한 번, 확인은 최소, 모듈은 다시 쓴다.
 *
 *  1440  업체에 크레탑 결과가 붙어 있으면 '자료에서 다음 정보를 찾았습니다' → 확인 전에는 정책자금이 매출을 모른다
 *        → [틀린 것만 고치기] 로 매출 고치고 주소는 빼기 → 숫자 · 인증에 '직접 적음 · 확인됨' · 영업이익 '크레탑 보고서 2025 · 확인됨'
 *        → 정책자금을 업체로 열면 매출 규모 · 작년 매출 · 순이익이 채워진다(다시 적지 않는다)
 *        → [나중에 확인] 은 막지 않고 한 줄로 접힌다 · 제출 전 확인 '모두 맞음'
 *  390   같은 카드가 넘치지 않고 단추가 44px
 *
 *   node e2e/facts.mjs http://localhost:4390
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

/** 한솔테크에 크레탑 결과 하나를 붙인다(업체 기록 저장소에 직접) */
const attachCretop = () => {
  const key = 'axmvp.v1.operations_clients'
  const list = JSON.parse(localStorage.getItem(key) ?? '[]')
  const c = list.find((x) => x.id === 'cli_hansol')
  c.toolResults = [
    {
      id: 'cr-e2e',
      toolKey: 'cretop',
      title: '크레탑 분석',
      verdict: null,
      verdictLabel: '',
      summary: '크레탑 요약',
      deadlines: [],
      createdAt: new Date().toISOString(),
      publishedUpdateId: null,
      data: {
        companyInfo: { companyName: '한솔테크(주)', ceoName: '박대표', address: '서울특별시 강남구 테헤란로 1, 한솔빌딩 5층', employees: '12명' },
        corePreview: {
          revenue: { value: 1234, unit: '백만원', eok: 12.34, year: 2025 },
          operatingProfit: { value: 120, unit: '백만원', eok: 1.2, year: 2025 },
          netIncome: { value: 80, unit: '백만원', eok: 0.8, year: 2025 },
        },
      },
    },
    ...(c.toolResults ?? []),
  ]
  localStorage.setItem(key, JSON.stringify(list))
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
  await page.evaluate(attachCretop)

  // 확인 전: 정책자금은 매출을 모른다(후보를 쓰지 않는다)
  await page.goto(BASE + '/tools/policy-funding/diagnosis?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const before = (await page.locator('main').innerText()) ?? ''
  check('확인 전: 정책자금이 자료 후보(매출)를 쓰지 않는다', !before.includes('매출 규모 · ') && !/작년 매출\(2025\)/.test(before), before.slice(0, 200))

  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const inbox = page.getByTestId('fact-inbox')
  const inboxText = (await inbox.innerText().catch(() => '')) ?? ''
  check('자료에서 다음 정보를 찾았습니다 — 카드가 뜬다', inboxText.includes('자료에서 다음 정보를 찾았습니다'), inboxText.slice(0, 120))
  check('후보: 매출 12억 3,400만원 · 크레탑 보고서 2025', inboxText.includes('12억 3,400만원') && inboxText.includes('크레탑 보고서 2025'), inboxText.slice(0, 300))
  check('후보: 지금 값과 같은 회사명은 묻지 않는다', !(await inbox.locator('[data-fact="companyName"]').count()))
  check('후보: 다르면 지금 적힌 값을 보여 준다(대표자 김대표 → 박대표)', ((await inbox.locator('[data-fact="representativeName"]').innerText().catch(() => '')) ?? '').includes('지금 적힌 값: 김대표'))

  // 나중에 확인 → 한 줄로 접힘 → 다시 펼침
  await page.getByTestId('fact-later').click()
  check('나중에 확인: 막지 않고 한 줄로 접힌다', (await page.getByTestId('fact-inbox-later').count()) === 1 && (await inbox.count()) === 0)
  await page.getByTestId('fact-inbox-later').getByRole('button', { name: '지금 확인하기' }).click()

  // 틀린 것만 고치기 — 매출 고치고 주소 빼기
  await page.getByTestId('fact-fix').click()
  await inbox.locator('[data-fact="revenue"] input').fill('12억 5,000만')
  await inbox.locator('[data-fact="businessAddress"]').getByRole('button', { name: '이건 빼기' }).click()
  await page.getByTestId('fact-save-fixes').click()
  await page.waitForTimeout(900)
  check('확인 뒤: 카드가 사라진다(더 물을 것 없음)', (await page.getByTestId('fact-inbox').count()) === 0 && (await page.getByTestId('fact-inbox-later').count()) === 0)
  const nums = (await page.getByTestId('fact-numbers').innerText()) ?? ''
  check('숫자 · 인증: 고친 매출 12억 5,000만원 · 직접 적음 · 확인됨', nums.includes('12억 5,000만원') && nums.includes('직접 적음 · 확인됨'), nums.slice(0, 300))
  check('숫자 · 인증: 영업이익 1억 2,000만원 · 크레탑 보고서 2025 · 확인됨', nums.includes('1억 2,000만원') && nums.includes('크레탑 보고서 2025 · 확인됨'), nums.slice(0, 300))
  const addr = await page.locator('[data-fact-note="businessAddress"]').count()
  check('뺀 주소: 업체 주소를 바꾸지 않았다', addr === 0 && !((await page.locator('main').innerText()) ?? '').includes('한솔빌딩 5층'))
  check('회사 정보: 대표자(박대표) 옆에 크레탑 보고서 · 확인됨', ((await page.locator('[data-fact-note="representativeName"]').innerText().catch(() => '')) ?? '').includes('크레탑 보고서 · 확인됨'))

  // 새로고침해도 다시 묻지 않는다
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('새로고침: 뺀 주소 · 고친 매출을 다시 묻지 않는다', (await page.getByTestId('fact-inbox').count()) === 0 && (await page.getByTestId('fact-inbox-later').count()) === 0)

  // 모듈이 다시 쓴다 — 정책자금
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('axmvp.tools.policyFunding')) localStorage.removeItem(k) })
  await page.goto(BASE + '/tools/policy-funding/diagnosis?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const note = (await page.locator('main').innerText()) ?? ''
  check('정책자금: 매출 규모 · 작년 매출(2025) · 순이익을 업체 기록에서 채웠다', note.includes('매출 규모') && note.includes('작년 매출') && note.includes('순이익') && note.includes('업체 기록에서 채웠습니다'), (note.match(/[^\n]*업체 기록에서 채웠습니다[^\n]*/) ?? [''])[0])

  // 숫자 직접 적기 — 예상값
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.getByTestId('fact-show-empty').click()
  await page.getByRole('button', { name: '+ 올해 예상 매출 적기' }).click()
  await page.locator('#fact-expectedRevenue').fill('15억')
  await page.getByTestId('fact-numbers').getByRole('button', { name: '저장' }).click()
  await page.waitForTimeout(700)
  const nums2 = (await page.getByTestId('fact-numbers').innerText()) ?? ''
  check('직접 적기: 올해 예상 매출 15억원 · 예상값', nums2.includes('15억원') && nums2.includes('직접 적음 · 예상값'), nums2.slice(0, 400))
  await page.getByTestId('fact-show-empty').click().catch(() => {})
  await page.getByRole('button', { name: '+ 자산 적기' }).click()
  await page.locator('#fact-totalAssets').fill('약 20억쯤')
  await page.getByTestId('fact-numbers').getByRole('button', { name: '저장' }).click()
  check('직접 적기: 못 읽는 금액은 저장하지 않고 다시 묻는다', ((await page.getByTestId('fact-numbers').getByRole('alert').innerText().catch(() => '')) ?? '').includes('금액을 읽지 못했습니다'))
  await page.getByTestId('fact-numbers').getByRole('button', { name: '취소' }).click()

  // 제출 전 확인 — 적어 둔 꼭 필요한 값
  const hard = page.getByTestId('fact-hard')
  check('제출 전 확인: 적어 둔 값 목록(사업자등록번호 등)', ((await hard.innerText().catch(() => '')) ?? '').includes('사업자등록번호'))
  await page.getByTestId('fact-confirm-entered').click()
  await page.waitForTimeout(700)
  check('모두 맞음: 사업자등록번호가 확인됨', ((await page.locator('[data-fact-note="businessNumber"]').innerText().catch(() => '')) ?? '').includes('확인됨'))

  check('JS 오류 없음', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- 390 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(attachCretop)
  for (const scale of ['default', 'extra_large']) {
    await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
    await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
    await page.waitForTimeout(500)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    check(`390 ${scale}: 가로 넘침 없음`, over <= 1, String(over))
    const small = await page.getByTestId('fact-inbox').locator('button').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => e.textContent))
    check(`390 ${scale}: 확인 카드 단추 44px`, small.length === 0, small.join('|'))
  }
  await ctx.close()
}

await browser.close()
console.log(`\n사실 창고: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
