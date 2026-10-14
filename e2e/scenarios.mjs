/**
 * 상황 예시로 바로 설계 시험 (D-199 · 로드맵 5단계 '계산기는 상황 예시로').
 *
 *  1440  숫자가 다 있는 업체 › 맞춤 추천 › 상황 예시 23가지 · 바로 설계된 것 먼저 · 처음 6개 · 더 보기 · 모듈 칩으로 거르기
 *        · 누르면 그 자리에서 설계(결과 · 필요한 숫자 ✓ · 업체 기록에서 채운 값 · 가정 ★) · 한 번에 하나만 펼침
 *        · [다음 약속으로] → 업체 다음 약속
 *        · [모듈에서 이어서] → 절세 · 창업감면 · 정책자금 · 연구소 · 고용지원금 화면이 같은 가정으로 열려 바로 결과
 *          (업체 상세에서 본 결론 = 모듈 화면 결론 · 주소의 preset 은 한 번 쓰고 지움)
 *        빈 업체 › 받을 것만 말함(짐작 안 함) · 빠진 것 요청 문구(상황 하나 · 한 번에) · 주민등록번호 받지 않음
 *  360 · 390 × 1.0 · 1.30  가로 넘침 0 · 누르는 것 44px · 펼친 설계도 넘침 0
 *
 *   node e2e/scenarios.mjs http://localhost:4390
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

const NOW = '2026-09-01T00:00:00.000Z'
const FULL = {
  id: 'cli_scen',
  companyName: '한솔정밀(주)',
  representativeName: '김한솔',
  contactName: '김한솔',
  establishedAt: '2023-03-02',
  businessCategory: '제조업',
  businessItem: '정밀기계 부품',
  businessAddress: '경기도 화성시 동탄대로 1',
  representativeBirth: '1990-05-05',
  employeeCount: '12',
  status: 'active',
  taxProfile: { monthlySalary: '5,000,000', retainedEarnings: '800,000,000', ceoStartDate: '2023-03-02', par: '5000', loanBalance: '120,000,000', children: '2', estateRealEstate: '1,500,000,000' },
  shareholderRegister: [
    { id: 'h1', name: '김한솔', relation: 'ceo', shares: 8000, acquirePrice: 5000 },
    { id: 'h2', name: '김다온', relation: 'child', shares: 2000, acquirePrice: 5000 },
  ],
  factValues: { totalAssets: '3,000,000,000', totalLiabilities: '1,200,000,000', netIncome: '400,000,000', revenue: '5,000,000,000' },
  createdAt: NOW,
  updatedAt: NOW,
}
const EMPTY = { id: 'cli_scen_empty', companyName: '빈칸상사', status: 'active', createdAt: NOW, updatedAt: NOW }

async function seed(page) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(
    ([a, b]) => {
      const k = 'axmvp.v1.operations_clients'
      const list = JSON.parse(localStorage.getItem(k) ?? '[]').filter((r) => r.id !== a.id && r.id !== b.id)
      list.push(a, b)
      localStorage.setItem(k, JSON.stringify(list))
    },
    [FULL, EMPTY],
  )
}

const record = (page, id) => page.evaluate((cid) => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === cid), id)

async function openSmart(page, id) {
  await page.goto(`${BASE}/ops/clients/${id}?tab=smart`, { waitUntil: 'networkidle' })
  await page.getByTestId('smart-scenarios').waitFor({ timeout: 15000 })
}

const row = (page, id) => page.locator(`[data-testid="scenario-row"][data-id="${id}"]`)

/** 그 상황을 펼친다(처음 6개 밖이면 더 보기부터) */
async function expand(page, id) {
  if ((await row(page, id).count()) === 0 && (await page.getByTestId('scenario-more').count())) await page.getByTestId('scenario-more').click()
  const r = row(page, id)
  if ((await r.getByTestId('scenario-detail').count()) === 0) await r.getByTestId('scenario-toggle').click()
  await r.getByTestId('scenario-detail').waitFor()
  return r
}

async function dialogText(page) {
  const d = page.getByRole('dialog')
  await d.waitFor()
  const t = await d.locator('textarea').inputValue()
  await page.keyboard.press('Escape')
  await d.waitFor({ state: 'detached' }).catch(() => {})
  return t
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await seed(page)
  await openSmart(page, 'cli_scen')

  const box = page.getByTestId('smart-scenarios')
  const count = Number(await box.getAttribute('data-count'))
  const ready = Number(await box.getAttribute('data-ready'))
  check('맞춤 추천에 상황 예시 23가지 · 바로 설계됨 15가지 넘게(숫자가 다 있는 업체)', count === 23 && ready >= 15, `${count} · ${ready}`)
  check('바로 설계됨 n가지 글자', (await page.getByTestId('scenario-ready-count').innerText()).includes(`바로 설계됨 ${ready}가지`))
  const first = await page.getByTestId('scenario-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))
  check('처음엔 6개 · 바로 설계된 것 먼저', first.length === 6 && first.every((s) => s === 'ready'), first.join(','))
  await page.getByTestId('scenario-more').click()
  check('상황 더 보기 → 23개 전부', (await page.getByTestId('scenario-row').count()) === 23)

  // 모듈 칩으로 거르기
  await page.locator('[data-testid="scenario-filter"][data-module="employment"]').click()
  const mods = await page.getByTestId('scenario-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-module')))
  check('고용지원금 칩 → 4개 · 모두 고용지원금', mods.length === 4 && mods.every((m) => m === 'employment'), mods.join(','))
  check('칩이 눌림 표시(aria-pressed)', (await page.locator('[data-testid="scenario-filter"][data-module="employment"]').getAttribute('aria-pressed')) === 'true')
  await page.locator('[data-testid="scenario-filter"][data-module="all"]').click()

  // 누르면 그 자리에서 설계
  const cash = await expand(page, 'tax-cash-1e')
  const cashHead = (await cash.getByTestId('scenario-headline').innerText()).trim()
  const cashLines = await cash.locator('[data-testid="scenario-lines"] li').allInnerTexts()
  check('절세 1억 — 순부담 금액 · 펼친 곳에 머리글을 다시 쓰지 않음', (await cash.getByTestId('scenario-amount').innerText()).startsWith('순부담') && cashLines.every((l) => l.trim() !== cashHead), cashLines.join(' | '))
  const needOk = await cash.getByTestId('scenario-need').evaluateAll((els) => els.map((e) => e.getAttribute('data-ok')))
  check('필요한 숫자 모두 ✓(업체 기록에 다 있음)', needOk.length >= 3 && needOk.every((x) => x === '1'), needOk.join(''))
  check('업체 기록에서 채운 값 알림(자산 · 순이익)', (await cash.getByTestId('scenario-filled').innerText()).includes('자산'))
  check('[절세에서 이어서] 주소 — 이 업체 · 이 상황', ((await cash.getByTestId('scenario-open').getAttribute('href')) ?? '').endsWith('/tools/tax?client=cli_scen&preset=tax-cash-1e'))
  await expand(page, 'emp-youth')
  check('한 번에 하나만 펼침', (await page.getByTestId('scenario-detail').count()) === 1 && (await cash.getByTestId('scenario-detail').count()) === 0)
  const youthHead = (await row(page, 'emp-youth').getByTestId('scenario-headline').innerText()).trim()
  const startupHead = (await row(page, 'startup-new').getByTestId('scenario-headline').innerText()).trim()
  const policyHead = (await row(page, 'policy-working').getByTestId('scenario-headline').innerText()).trim()
  // '연간 약 2,000만원' → '2,000만원'
  const labAmount = ((await row(page, 'lab-two').getByTestId('scenario-amount').innerText()).match(/[\d,]+만원/) ?? [''])[0]

  // 다음 약속으로
  await (await expand(page, 'tax-cash-1e')).getByTestId('scenario-next').click()
  await page.waitForTimeout(600)
  check('[다음 약속으로] → 업체 다음 약속에 그 상황', ((await record(page, 'cli_scen'))?.nextAction ?? '').includes('대표가 1억 가져오기'))

  // 모듈에서 이어서 — 절세
  await (await expand(page, 'tax-cash-1e')).getByTestId('scenario-open').click()
  await page.getByTestId('tax-preset-note').waitFor({ timeout: 15000 })
  await page.waitForTimeout(500)
  check('절세 설계가 그 상황 문장으로 열림 · 결과 바로', (await page.getByTestId('plan-text').inputValue()) === '1억 현금화하고 싶어' && (await page.getByTestId('plan-glance').count()) >= 1)
  check('절세 — 상황 예시 알림 · 업체 기록에서 채움(저장은 누를 때만)', (await page.getByTestId('tax-preset-note').innerText()).includes('대표가 1억 가져오기') && (await page.getByTestId('tax-preset-note').innerText()).includes('업체 기록에서 채움'))
  // 업체 상세 머리글: '세후 1억원 — 추천 주식 팔기(자기주식 등) · 순부담 2,703만원' → 추천 방법 이름
  const best = (cashHead.match(/추천 (.+?)(?:\(| ·|$)/)?.[1] ?? '').trim()
  check('업체 상세에서 본 결론 = 절세 설계 결론(같은 추천 방법)', best.length >= 2 && (await page.getByTestId('plan-glance').first().innerText()).includes(best), `${cashHead} | ${best}`)
  check('주소의 preset 은 한 번 쓰고 지움(새로고침해도 칸을 덮지 않음)', !page.url().includes('preset='), page.url())

  // 창업감면
  await page.goto(`${BASE}/tools/startup-tax?client=cli_scen&preset=startup-new`, { waitUntil: 'networkidle' })
  await page.getByTestId('startup-preset-note').waitFor({ timeout: 15000 })
  const oneline = (await page.getByTestId('startup-tax-oneline').innerText()).trim()
  check('창업감면 — 바로 판정 · 업체 상세 결론과 같은 한 줄', oneline.length > 0 && oneline === startupHead, `${oneline} | ${startupHead}`)

  // 정책자금
  await page.goto(`${BASE}/tools/policy-funding/diagnosis?client=cli_scen&preset=policy-working`, { waitUntil: 'networkidle' })
  await page.getByTestId('pf-preset-note').waitFor({ timeout: 15000 })
  await page.locator('#result').waitFor({ timeout: 10000 })
  const agency = policyHead.split('추천 기관 ')[1] ?? ''
  check('정책자금 — 바로 진단 · 같은 추천 기관', !!agency && (await page.locator('#result').innerText()).includes(agency), policyHead)

  // 연구소
  await page.goto(`${BASE}/tools/labcare/tax?client=cli_scen&preset=lab-two`, { waitUntil: 'networkidle' })
  await page.getByTestId('lab-preset-note').waitFor({ timeout: 15000 })
  const payroll = await page.getByLabel('연구전담요원 인건비 합계').inputValue()
  check('연구소 — 연구원 2명 인건비 8,000만원이 칸에 · 바로 계산(업체 상세와 같은 연간 약 2,000만원)', payroll.replace(/\D/g, '') === '80000000' && (await page.locator('body').innerText()).includes(`연간 약 ${labAmount}`), `${payroll} | ${labAmount}`)

  // 고용지원금
  await page.goto(`${BASE}/tools/employment/diagnosis?client=cli_scen&preset=emp-youth`, { waitUntil: 'networkidle' })
  await page.getByTestId('emp-preset-note').waitFor({ timeout: 15000 })
  await page.getByText('가능성 높음', { exact: false }).first().waitFor({ timeout: 10000 })
  const top = youthHead.split(' — ')[1] ?? ''
  check('고용지원금 — 청년 1명 바로 진단 · 같은 1순위 지원금', !!top && (await page.locator('body').innerText()).includes(top), youthHead)
  check('고용지원금 — 회사 규모 칸에 이 업체 직원 수(12)', (await page.getByPlaceholder('피보험자 수').inputValue()) === '12')
  // 고용지원금에 아직 등록 안 한 업체라도 상황 예시로 열면 등록 창이 결과를 가리지 않는다(D-94 등록 창은 업체 입구로 열 때만)
  await page.waitForTimeout(600)
  check('고용지원금 — 업체 등록 창이 진단 결과를 가리지 않음', !(await page.getByText('🏢 업체 정보').first().isVisible().catch(() => false)))

  // 빈 업체 — 짐작하지 않고 받을 것을 말한다
  await openSmart(page, 'cli_scen_empty')
  const eb = page.getByTestId('smart-scenarios')
  check('빈 업체 — 바로 설계됨 0 · 절세는 모두 받으면 설계', Number(await eb.getAttribute('data-ready')) === 0)
  await page.getByTestId('scenario-more').click()
  const taxStates = await page.locator('[data-testid="scenario-row"][data-module="tax"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))
  check('빈 업체 — 절세 상황은 하나도 결과를 내지 않음', taxStates.length === 11 && taxStates.every((s) => s !== 'ready'), taxStates.join(','))
  const ec = await expand(page, 'tax-cash-1e')
  check('빈 업체 — 금액 없음 · 필요한 숫자 ✗(주주명부 · 배당 가능한 이익)', (await ec.getByTestId('scenario-amount').count()) === 0 && (await ec.locator('[data-testid="scenario-need"][data-ok="0"]').count()) >= 2)
  await ec.getByTestId('scenario-request').click()
  const one = await dialogText(page)
  check('빠진 것 요청 문구(상황 하나) — 회사 이름 · 주주명부 · 그 상황 확인용', one.includes('빈칸상사') && one.includes('주주명부') && one.includes('대표가 1억 가져오기 확인용'), one.slice(0, 200))
  await page.getByTestId('scenario-request-all').click()
  const all = await dialogText(page)
  check(
    '한 번에 요청 문구 — 같은 자료 한 줄 · 모듈 이름만 · 주민등록번호 받지 않음',
    (all.match(/^\d+\. 최근 재무제표/gm) ?? []).length === 1 && !all.includes('대표가 1억 가져오기') && all.includes('주민등록번호는 받지 않습니다'),
    all.slice(0, 300),
  )

  check('화면 오류 0', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

/* ---------------- 360 · 390 × 1.0 · 1.30 ---------------- */
for (const width of [360, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await seed(page)
  await openSmart(page, 'cli_scen')
  await page.getByTestId('scenario-more').click()
  await expand(page, 'tax-treasury')
  for (const scale of ['default', 'extra_large']) {
    await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
    await page.waitForTimeout(400)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    check(`${width} ${scale}: 상황 예시(펼침 포함) 가로 넘침 0`, over <= 1, String(over))
    const wide = await page.getByTestId('smart-scenarios').locator('*').evaluateAll((els) => {
      const W = document.documentElement.clientWidth
      return els
        .filter((e) => {
          const b = e.getBoundingClientRect()
          return b.width > 0 && (b.right > W + 1 || b.left < -1)
        })
        .map((e) => (e.textContent || '').trim().slice(0, 20))
    })
    check(`${width} ${scale}: 화면 밖으로 나간 글자 0`, wide.length === 0, wide.slice(0, 4).join('|'))
    const small = await page
      .getByTestId('smart-scenarios')
      .locator('button, a')
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
console.log(`\n상황 예시: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
