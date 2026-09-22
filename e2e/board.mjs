/**
 * 고객 목록에서 바로 고치기 — 브라우저 인수 시험.
 *
 *   node e2e/board.mjs <baseUrl>
 *
 * 지키려는 것
 *   1. 업무가 15개로 늘어도 가로로 밀 일이 없다 (표를 버린 이유)
 *   2. 목록에서 바꾼 상태가 업체 기록에 실제로 저장된다 (화면용 사본이 아니다)
 *   3. '해당 없음' 은 가로선으로 지워지고, 다시 되돌릴 수 있다
 */

import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('PASS ', name) }
  else { fail++; console.log('FAIL ', name, detail ?? '') }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 900 },
  isMobile: true,
  hasTouch: true,
  // 복사한 내용을 실제로 읽어 확인하기 위해
  permissions: ['clipboard-read', 'clipboard-write'],
})
const page = await ctx.newPage()
page.on('pageerror', (e) => check('JS 오류 없음', false, String(e).slice(0, 160)))

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(seedScript())
await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

// 가로 넘침 없음
const of = await page.evaluate(() => ({ d: document.documentElement.scrollWidth, w: window.innerWidth }))
check('가로 스크롤 없음', of.d <= of.w + 1, `${of.d} > ${of.w}`)

// 업무 조각을 눌러 상태 시트를 연다
const chip = page.getByRole('button', { name: /^특허/ }).first()
await chip.click()
await page.waitForTimeout(400)
check('상태 시트가 열린다', await page.getByRole('dialog').isVisible())
check('해당 없음 선택지가 있다', await page.getByRole('button', { name: /해당 없음/ }).first().isVisible())

await page.getByRole('button', { name: /해당 없음/ }).first().click()
await page.waitForTimeout(600)
check('시트가 닫힌다', (await page.getByRole('dialog').count()) === 0)

// 조각이 가로선으로 지워졌는지
const struck = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'))
  const el = btns.find((b) => (b.textContent || '').trim().startsWith('특허'))
  if (!el) return null
  return getComputedStyle(el).textDecorationLine
})
check('해당 없음은 가로선으로 지운다', String(struck).includes('line-through'), String(struck))

// 새로고침해도 남아 있는지 (실제 저장)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(700)
const stored = await page.evaluate(() => {
  const raw = localStorage.getItem('axmvp.v1.operations_clients')
  if (!raw) return null
  const list = JSON.parse(raw)
  const c = list.find((r) => r.id === 'cli_hansol')
  return c?.services?.patent?.status ?? null
})
check('새로고침 뒤에도 저장돼 있다', stored === 'not_applicable', String(stored))

/*
 * 다시 되돌릴 수 있는지.
 * '해당 없음' 은 앞으로 볼 일 없는 항목이라 카드에서 접힌다. 되돌리려면 [그 외 N] 을 펴야 하는데,
 * 그 단추가 카드 안에 바로 있어서 한 번이면 닿는다 — 그 경로가 실제로 열리는지 확인한다.
 */
// 접힘 단추는 무엇이 접혔는지 그대로 말한다 — '완료 2 · 시작 전 1'
const more = page.getByRole('button', { name: /^(완료|시작 전|해당 없음)\s*\d+/ }).first()
check('접힌 조각을 펼 수 있는 단추가 있다', (await more.count()) > 0)
check('단추가 무엇이 접혔는지 말한다', /완료|시작 전|해당 없음/.test((await more.textContent()) ?? ''), (await more.textContent()) ?? '')
await more.click()
await page.waitForTimeout(400)
check('펴면 해당 없음 조각이 다시 보인다', (await page.getByRole('button', { name: /^특허/ }).count()) > 0)
await page.getByRole('button', { name: /^특허/ }).first().click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /진행 중/ }).first().click()
await page.waitForTimeout(600)
const back = await page.evaluate(() => {
  const list = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
  return list.find((r) => r.id === 'cli_hansol')?.services?.patent?.status ?? null
})
check('해당 없음에서 다시 바꿀 수 있다', back === 'in_progress', String(back))

// 수금 시트
await page.getByRole('button', { name: /^못 받은 내 돈/ }).first().click()
await page.waitForTimeout(400)
check('수금 시트가 열린다', await page.getByRole('dialog').isVisible())
check('수금 항목 넣기 칸이 있다', await page.getByRole('button', { name: '넣기' }).isVisible())
await page.getByRole('button', { name: '닫기' }).first().click().catch(() => page.keyboard.press('Escape'))
await page.waitForTimeout(300)

// 15개까지 늘려도 가로로 넘치지 않는지
await page.evaluate(() => {
  const raw = localStorage.getItem('axmvp.v1.custom_services')
  const extra = Array.from({ length: 9 }, (_, i) => ({
    id: `cs${i}`, workspaceId: null, key: `custom_extra${i}`, label: `추가업무${i + 1}`,
    shortLabel: `추가${i + 1}`, description: '', accent: 'ops', recurring: false,
    requiredDocuments: [], enabled: true, order: 100 + i,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  }))
  localStorage.setItem('axmvp.v1.custom_services', JSON.stringify(extra))
  void raw
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const chips = await page.evaluate(() => document.querySelectorAll('button').length)
const of2 = await page.evaluate(() => ({ d: document.documentElement.scrollWidth, w: window.innerWidth }))
check('업무 15개에서도 가로 스크롤 없음', of2.d <= of2.w + 1, `${of2.d} > ${of2.w} (버튼 ${chips}개)`)

/* ---------------- 계약 정보 · 해 드린 일 ---------------- */
{
  // 한솔테크 — 현금 + 보험 혼합, 2025-03-15 계약
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const main = (await page.locator('main').innerText()) ?? ''
  check('계약: 언제 계약했는지 보인다', main.includes('2025-03-15'), main.slice(0, 200))
  // 오늘 날짜에 따라 달라지므로 모양만 확인한다
  check('계약: 몇 달째인지 보인다', /\d+년 \d+개월째 \(\d+개월\)|\d+개월째/.test(main))
  check('계약: 어떤 방식인지 보인다', main.includes('현금 + 보험'))
  check('계약: 얼마인지 보인다', main.includes('현금 3,000,000원') && main.includes('월납 750,000원'), main.slice(0, 300))

  // 보험 건별은 눌러야 나온다 — 한눈에 보는 줄을 길게 만들지 않기 위해서다
  check('계약: 보험 자세히는 접혀 있다', !main.includes('CEO플랜 종신'))
  const detail = page.getByRole('button', { name: /보험 2건 자세히/ }).first()
  check('계약: [보험 2건 자세히] 가 있다', (await detail.count()) > 0)
  await detail.click()
  await page.waitForTimeout(300)
  const opened = (await page.locator('main').innerText()) ?? ''
  check('계약: 보험사·상품명이 나온다', opened.includes('삼성생명') && opened.includes('CEO플랜 종신'))
  check('계약: 월납보험료가 건별로 나온다', opened.includes('500,000원') && opened.includes('250,000원'))
  check('계약: 언제 가입했는지 나온다', opened.includes('2025-04-01'))
  check('계약: 납입기간이 나온다', opened.includes('10년납'))

  // 고쳐 쓰면 저장된다
  await page.getByRole('button', { name: '계약 고치기' }).first().click()
  await page.waitForTimeout(500)
  check('계약 고치기: 시트가 열린다', (await page.getByRole('dialog').count()) > 0)
  // 적는 동안 자리점이 찍힌다 — 숫자만 쳐도 4,500,000 으로 보인다
  await page.getByLabel('현금 계약 금액').fill('4500000')
  await page.waitForTimeout(200)
  check('계약 고치기: 금액에 자리점이 찍힌다', (await page.getByLabel('현금 계약 금액').inputValue()) === '4,500,000', await page.getByLabel('현금 계약 금액').inputValue())
  await page.getByRole('button', { name: '저장', exact: true }).first().click()
  await page.waitForTimeout(900)
  const after = (await page.locator('main').innerText()) ?? ''
  check('계약 수정: 화면에 바로 반영된다', after.includes('현금 4,500,000원'), after.slice(0, 200))
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_hansol'),
  )
  const savedContract = saved?.contract ?? saved?.payload?.contract
  check('계약 수정: 저장된다', savedContract?.cashAmount === 4_500_000, JSON.stringify(savedContract))
  check('계약 수정: 활동 기록에 남는다', (saved?.activity ?? saved?.payload?.activity ?? []).some((a) => a.kind === 'contract'))

  // 우일산업 — 해 드린 일 4건, 최근 것이 위로
  await page.goto(BASE + '/ops/clients/cli_wooil', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const w = (await page.locator('main').innerText()) ?? ''
  check('해 드린 일: 카드가 있다', w.includes('해 드린 일'))
  check('해 드린 일: 끝낸 건수를 센다', w.includes('끝낸 일 4건'), w.slice(0, 300))
  check('해 드린 일: 언제 끝냈는지 보인다', w.includes('2026-09-02') && w.includes('2024-11-08'))
  check('해 드린 일: 최근 것이 위', w.indexOf('2026-09-02') < w.indexOf('2024-11-08'))
  // '지금 하는 일' 은 맨 위 '지금 할 일' 카드에 이미 있다 — 여기서 되풀이하지 않는다
  check('해 드린 일: 지금 하는 일을 되풀이하지 않는다', !w.includes('지금 하는 일'))
  check('계약: 현금만이면 월납 줄이 없다', w.includes('현금 8,000,000원') && !w.includes('월납'))

  // 목록에서도 계약한 지 얼마나 됐는지 보인다
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const list = (await page.locator('main').innerText()) ?? ''
  check('목록: 계약 개월수가 보인다', /계약 \d+년 \d+개월째|계약 \d+개월째/.test(list), list.slice(0, 300))
}

/* ---------------- 내 몫 통일 · 검색 · 계약 개월수 · 영업자 이름 (D-74~77) ---------------- */
{
  // 한솔 성공보수 550만 중 영업자 150만 → 내 몫 400만. 미수금 합계: 한솔 400 + 다움 200 + 선한 150 = 750만 (청구 900만)
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const hub = (await page.locator('main').innerText()) ?? ''
  const hubAll = (await page.locator('main').evaluate((el) => el.textContent)) ?? ''
  check('내 몫: 목록 카드가 청구액이 아니라 내 몫을 보여 준다', hub.includes('못 받은 내 돈 4,000,000원'), hub.slice(0, 400))
  check('내 몫: 목록 카드에 청구액 550만이 그대로 찍히지 않는다', !hub.includes('5,500,000원'))
  check('내 몫: 고객 운영 위 칸 합계도 내 몫(750만)', hub.includes('750만원'), hub.slice(0, 400))
  check('내 몫: 청구 기준(900만)은 힌트로 남긴다', hubAll.includes('청구 기준 900만원'), hubAll.slice(0, 300))

  // 검색 — 회사명 말고 직접 만든 칸 · 전화 뒷자리 · 법인번호
  const box = page.getByLabel('업체 검색')
  const visibleNames = async () => {
    const t = (await page.locator('main').innerText()) ?? ''
    return ['한솔테크', '다움에너지', '미래바이오랩', '선한식품', '우일산업'].filter((n) => t.includes(n))
  }
  await box.fill('김세무')
  await page.waitForTimeout(500)
  check('검색: 직접 만든 칸의 값으로 찾는다', JSON.stringify(await visibleNames()) === '["한솔테크"]', JSON.stringify(await visibleNames()))
  await box.fill('6789')
  await page.waitForTimeout(500)
  check('검색: 전화 뒷자리로 찾는다', JSON.stringify(await visibleNames()) === '["한솔테크"]', JSON.stringify(await visibleNames()))
  await box.fill('110111')
  await page.waitForTimeout(500)
  check('검색: 법인번호로 찾는다', JSON.stringify(await visibleNames()) === '["우일산업"]', JSON.stringify(await visibleNames()))
  await box.fill('최영업')
  await page.waitForTimeout(500)
  check('검색: 영업자 이름으로 찾는다', JSON.stringify(await visibleNames()) === '["한솔테크"]', JSON.stringify(await visibleNames()))
  await box.fill('')
  await page.waitForTimeout(400)

  // 상세 — 머리말에 계약 개월수, 개요에 내 몫, 수금 탭에 영업자 이름
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const head = (await page.locator('main').innerText()) ?? ''
  const headAll = (await page.locator('main').evaluate((el) => el.textContent)) ?? ''
  check('상세 머리말: 계약 종류와 개월수가 보인다', /현금 \+ 보험 · 1년( \d+개월)?째/.test(head), head.slice(0, 300))
  check('상세 개요: 못 받은 내 돈 400만', head.includes('못 받은 내 돈') && head.includes('400만원'), head.slice(0, 600))
  check('상세 개요: 청구 기준 550만 힌트', headAll.includes('청구 기준 550만원'), headAll.slice(0, 300))

  await page.goto(BASE + '/ops/clients/cli_hansol?tab=fees', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const feesTab = (await page.locator('main').innerText()) ?? ''
  const feesAll = (await page.locator('main').evaluate((el) => el.textContent)) ?? ''
  check('수금 탭: 영업자 이름이 항목에 보인다', feesTab.includes('최영업 몫 빼고'), feesTab.slice(0, 400))
  check('수금 탭: 영업자 수수료 칸 아래 누구에게 얼마', feesAll.includes('최영업 2,000,000원'), feesAll.slice(0, 300))
  const nameInput = page.getByLabel('성공보수 영업자 이름')
  check('수금 탭: 영업자 이름을 고칠 수 있다', (await nameInput.count()) === 1)
  await nameInput.fill('박영업')
  await page.waitForTimeout(600)
  const renamed = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_hansol'),
  )
  const f2 = (renamed?.fees ?? renamed?.payload?.fees ?? []).find((f) => f.id === 'fee2')
  check('수금 탭: 영업자 이름이 저장된다', f2?.agentName === '박영업', JSON.stringify(f2))
  await nameInput.fill('최영업')
  await page.waitForTimeout(400)

  // 오늘 — 위 칸도 내 몫
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const todayText = (await page.locator('main').innerText()) ?? ''
  check('오늘: 받아야 할 내 돈 칸이 내 몫(750만)', todayText.includes('받아야 할 내 돈') && todayText.includes('750만원'), todayText.slice(0, 400))
}

/* ---------------- 보기 필터 · 검색 근거 · 영업자 정산 · 입금일 고치기 (D-78~81) ---------------- */
{
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const names = async () => {
    const t = (await page.locator('main').innerText()) ?? ''
    return ['한솔테크', '다움에너지', '미래바이오랩', '선한식품', '우일산업'].filter((n) => t.includes(n))
  }
  const hubText = (await page.locator('main').innerText()) ?? ''
  check('카드: 계약 종류가 보인다', hubText.includes('현금 + 보험'), hubText.slice(0, 400))

  // 보기 — 무엇을 보일지
  const view = page.getByLabel('업체 보기 조건')
  check('보기: 고르는 칸이 있다', (await view.count()) === 1)
  await view.selectOption('insurance')
  await page.waitForTimeout(500)
  check('보기: 보험 계약만', JSON.stringify(await names()) === '["다움에너지"]', JSON.stringify(await names()))
  await view.selectOption('overdue')
  await page.waitForTimeout(500)
  // 시드의 예정일은 2026-09-04 기준이라 오늘(실제 날짜) 기준으로는 셋 다 지났다 — 연체 = 미수 셋
  const overdueNames = await names()
  check('보기: 연체 있음 — 예정일 지난 미수금이 있는 곳만', overdueNames.length === 3 && !overdueNames.includes('우일산업') && !overdueNames.includes('미래바이오랩'), JSON.stringify(overdueNames))
  await view.selectOption('unpaid')
  await page.waitForTimeout(500)
  const unpaidNames = await names()
  check('보기: 못 받은 돈 있음 — 셋', unpaidNames.length === 3 && unpaidNames.includes('선한식품'), JSON.stringify(unpaidNames))
  check('보기: 몇 곳인지 말한다', ((await page.locator('main').innerText()) ?? '').includes('3곳 찾음'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('보기: 새로고침해도 기억한다', (await view.inputValue()) === 'unpaid')
  await view.selectOption('all')
  await page.waitForTimeout(400)

  // 검색 근거 — 왜 나왔는지
  await page.getByLabel('업체 검색').fill('김세무')
  await page.waitForTimeout(500)
  const hitText = (await page.locator('main').innerText()) ?? ''
  check('검색 근거: 어느 칸이 맞았는지 카드에 보인다', hitText.includes('찾은 곳') && hitText.includes('담당 세무사') && hitText.includes('김세무'), hitText.slice(0, 400))
  await page.getByLabel('업체 검색').fill('한솔')
  await page.waitForTimeout(500)
  check('검색 근거: 회사명이 맞으면 말하지 않는다', !((await page.locator('main').innerText()) ?? '').includes('찾은 곳'))
  await page.getByLabel('업체 검색').fill('')
  await page.waitForTimeout(300)

  // 영업자 정산 — 최영업: 중도금 50만(고객 입금됨 → 줄 돈) · 성공보수 150만(입금 전)
  await page.goto(BASE + '/ops/agents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const led = (await page.locator('main').innerText()) ?? ''
  check('정산: 화면이 열린다', led.includes('영업자 정산') && led.includes('최영업'), led.slice(0, 300))
  check('정산: 지금 줄 돈 50만', led.includes('지금 줄 돈') && led.includes('50만원'), led.slice(0, 400))
  check('정산: 고객 입금 전 150만', led.includes('150만원'))
  const payBox = page.getByLabel('한솔테크(주) 중도금 영업자 지급 완료')
  check('정산: 줄 돈 항목에 지급 체크가 있다', (await payBox.count()) === 1)
  check('정산: 입금 전 항목은 체크할 수 없다', await page.getByLabel('한솔테크(주) 성공보수 영업자 지급 완료').isDisabled())
  await payBox.check()
  await page.waitForTimeout(700)
  const afterPay = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_hansol'),
  )
  const fee0 = (afterPay?.fees ?? afterPay?.payload?.fees ?? []).find((f) => f.id === 'fee0')
  check('정산: 지급 완료가 저장된다', typeof fee0?.agentPaidAt === 'string' && fee0.agentPaidAt.length === 10, JSON.stringify(fee0))
  const ledAfter = (await page.locator('main').innerText()) ?? ''
  check('정산: 지급하면 줄 돈이 0', ledAfter.includes('지급 ') && ledAfter.includes('0원'), ledAfter.slice(0, 300))

  // 입금일 고치기 — 체크한 날이 아니라 실제 들어온 날
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=fees', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const recvInput = page.getByLabel('계약금 입금일')
  check('입금일: 고치는 칸이 있다', (await recvInput.count()) === 1)
  await recvInput.fill('2026-08-20')
  await page.waitForTimeout(600)
  const fixed = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_hansol'),
  )
  const fee1 = (fixed?.fees ?? fixed?.payload?.fees ?? []).find((f) => f.id === 'fee1')
  check('입금일: 고친 날짜가 저장된다', fee1?.receivedAt === '2026-08-20', JSON.stringify(fee1?.receivedAt))
  check('수금 탭: 정산에서 체크한 지급이 여기서도 보인다', await page.getByLabel('중도금 영업자 지급 완료').isChecked())
  check('수금 탭: 입금 전 항목의 지급 체크는 잠겨 있다', await page.getByLabel('성공보수 영업자 지급 완료').isDisabled())
  check('수금 탭: 지급일 칸이 있다', (await page.getByLabel('중도금 영업자 지급일').count()) === 1)
}

/* ---------------- 서류함: 내려받기 · 직접 만든 칸 (D-82 · D-83) ---------------- */
{
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=docs', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const docs = (await page.locator('main').innerText()) ?? ''
  check('서류함: 직접 만든 칸이 기본 10종과 같이 보인다', docs.includes('법인인감증명서') && docs.includes('직접 만든 칸'), docs.slice(0, 400))

  // 내려받기 — 로컬 모드에서는 잠겨 있다(클라우드 연결 후 켜진다)
  const dl = page.getByRole('button', { name: '법인인감증명서 내려받기' })
  check('서류함: 올린 파일에 내려받기 단추가 있다', (await dl.count()) === 1)
  check('서류함: 로컬 모드에서는 내려받기가 잠긴다', await dl.isDisabled())
  check('서류함: 파일 없는 서류에는 내려받기가 없다', (await page.getByRole('button', { name: '중소기업 확인서 내려받기' }).count()) === 0)

  // 칸 만들기
  await page.getByLabel('새 서류 칸 이름').fill('국세완납증명서')
  await page.getByLabel('새 서류 칸 유효기간').fill('1')
  await page.getByRole('button', { name: '서류 칸 추가' }).click()
  await page.waitForTimeout(800)
  const added = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_hansol'),
  )
  const cds = added?.customDocuments ?? added?.payload?.customDocuments ?? []
  const made = cds.find((d) => d.label === '국세완납증명서')
  check('서류함: 만든 칸이 저장된다', made !== undefined, JSON.stringify(cds))
  check('서류함: 유효기간도 저장된다', made?.validMonths === 1)
  check('서류함: 키는 customdoc_ 로 시작한다', String(made?.key ?? '').startsWith('customdoc_'))
  check('서류함: 적는 칸이 비워진다', (await page.getByLabel('새 서류 칸 이름').inputValue()) === '')

  // 기본 서류와 똑같이 — 받음 체크 → 발급일·메모·파일 첨부
  await page.getByLabel('국세완납증명서 받음').check()
  await page.waitForTimeout(700)
  check('서류함: 만든 칸도 파일을 받는다', (await page.getByRole('button', { name: '국세완납증명서 파일 첨부' }).count()) === 1)
  const afterCheck = (await page.locator('main').innerText()) ?? ''
  check('서류함: 만든 칸에도 유효기간 안내가 나온다', afterCheck.includes('유효 1개월'), afterCheck.slice(0, 300))

  // 이름 고치기 — 키는 그대로
  await page.getByRole('button', { name: '이름 고치기' }).last().click()
  await page.waitForTimeout(400)
  await page.getByLabel('국세완납증명서 이름 고치기').fill('국세 완납증명서(최신)')
  await page.getByRole('button', { name: '저장', exact: true }).first().click()
  await page.waitForTimeout(800)
  const renamed = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_hansol'),
  )
  const rcds = renamed?.customDocuments ?? renamed?.payload?.customDocuments ?? []
  const after = rcds.find((d) => d.id === made.id)
  check('서류함: 이름이 바뀐다', after?.label === '국세 완납증명서(최신)', JSON.stringify(after))
  check('서류함: 이름을 고쳐도 키는 그대로', after?.key === made.key)

  // 칸 없애기 — 정의만 지우고 올린 것은 남긴다
  const beforeDelete = (await page.locator('main').innerText()) ?? ''
  check('서류함: 고친 이름이 화면에 보인다', beforeDelete.includes('국세 완납증명서(최신)'))
  await page.getByRole('button', { name: '칸 없애기' }).last().click()
  await page.waitForTimeout(800)
  const afterDelete = (await page.locator('main').innerText()) ?? ''
  check('서류함: 없애면 목록에서 빠진다', !afterDelete.includes('국세 완납증명서(최신)'), afterDelete.slice(0, 300))
  check('서류함: 다른 칸은 그대로 있다', afterDelete.includes('법인인감증명서'))
  const kept = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_hansol'),
  )
  const keptDocs = kept?.documents ?? kept?.payload?.documents ?? {}
  check('서류함: 없애도 그 칸에 적어 둔 것은 남는다', keptDocs[made.key]?.received === true, JSON.stringify(keptDocs[made.key]))
}

/* ---------------- 서류 한꺼번에 올리기 — 판별 · 재배치 · 새 칸 (D-84) ---------------- */
{
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const bulkBtn = page.getByRole('button', { name: '다움에너지 서류 올리기' })
  check('한꺼번에: 목록 카드에 서류 올리기 단추가 있다', (await bulkBtn.count()) === 1)
  await bulkBtn.click()
  await page.waitForTimeout(500)
  check('한꺼번에: 시트가 열린다', await page.getByRole('dialog').isVisible())

  const mk = (name, text) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') })
  await page.getByLabel('서류 파일 고르기').setInputFiles([
    mk('scan001.txt', '사업자등록증 (법인사업자)\n등록번호 : 123-45-67890\n법인명(단체명) : 다움에너지\n개업연월일 : 2021년 05월 01일\n사업장 소재지 : 대전\n업 태 : 제조업\n교부일자 : 2026년 08월 20일'),
    mk('등기부.txt', '등기사항전부증명서(말소사항 포함) - 법인\n등기번호 000123\n회사성립연월일 2021년 04월 28일\n임원에 관한 사항 대표이사 박대표\n2026년 09월 01일'),
    mk('seal.txt', '법인인감증명서\n상호 다움에너지\n발급일자 2026년 09월 12일'),
    mk('photo_7.txt', '아무 관계 없는 글자'),
  ])
  await page.waitForTimeout(2500)
  const sheet = (await page.getByRole('dialog').innerText()) ?? ''
  check('한꺼번에: 사업자등록증을 확실로 가린다', /scan001\.txt[\s\S]*확실/.test(sheet), sheet.slice(0, 400))
  check('한꺼번에: 발급일을 읽어 채운다', (await page.getByLabel('scan001.txt 발급일').inputValue()) === '2026-08-20')
  check('한꺼번에: 등기부등본 칸으로', (await page.getByLabel('등기부.txt 칸 고르기').inputValue()) === 'corporateRegistry')
  check('한꺼번에: 칸이 없는 인감증명서는 새 칸을 제안한다', (await page.getByLabel('seal.txt 칸 고르기').inputValue()) === '__new__' && (await page.getByLabel('seal.txt 새 칸 이름').inputValue()) === '법인인감증명서')
  check('한꺼번에: 모르는 파일은 안 고른 채로 둔다', (await page.getByLabel('photo_7.txt 칸 고르기').inputValue()) === '')
  check('한꺼번에: 확실 2 · 고른 것 3', sheet.includes('확실 2') && sheet.includes('고른 것 3'), sheet.slice(-200))

  // 모르는 파일을 사람이 재배치한다
  await page.getByLabel('photo_7.txt 칸 고르기').selectOption('representativeId')
  await page.waitForTimeout(300)
  check('한꺼번에: 재배치하면 고른 것이 4', ((await page.getByRole('dialog').innerText()) ?? '').includes('고른 것 4'))

  await page.getByRole('button', { name: /^고른 것 전부 올리기/ }).click()
  await page.waitForTimeout(1500)
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_daum'),
  )
  const docs = saved?.documents ?? saved?.payload?.documents ?? {}
  const cds = saved?.customDocuments ?? saved?.payload?.customDocuments ?? []
  check('한꺼번에: 사업자등록증 칸에 받음·이름·발급일', docs.businessRegistration?.received === true && docs.businessRegistration?.fileName === 'scan001.txt' && docs.businessRegistration?.issuedAt === '2026-08-20', JSON.stringify(docs.businessRegistration))
  check('한꺼번에: 등기부등본 칸에 발급일', docs.corporateRegistry?.issuedAt === '2026-09-01', JSON.stringify(docs.corporateRegistry))
  const sealCell = cds.find((d) => d.label === '법인인감증명서')
  check('한꺼번에: 새 칸이 만들어졌다', sealCell !== undefined, JSON.stringify(cds))
  check('한꺼번에: 새 칸에 파일이 붙었다', sealCell && docs[sealCell.key]?.fileName === 'seal.txt' && docs[sealCell.key]?.issuedAt === '2026-09-12', JSON.stringify(sealCell && docs[sealCell.key]))
  check('한꺼번에: 재배치한 파일도 그 칸에', docs.representativeId?.fileName === 'photo_7.txt')
  const done = (await page.getByRole('dialog').innerText()) ?? ''
  check('한꺼번에: 올린 것은 올림 표시', (done.match(/올림 ·/g) ?? []).length === 4, done.slice(-300))
  // 배경의 '모달 닫기' 가 아니라 아래 단추 (D-63: 이름은 부분 일치라 exact)
  await page.getByRole('button', { name: '닫기', exact: true }).last().click()
  await page.waitForTimeout(400)

  // 상세 서류함에서도 같은 단추 · 결과가 보인다
  await page.goto(BASE + '/ops/clients/cli_daum?tab=docs', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const docTab = (await page.locator('main').innerText()) ?? ''
  check('한꺼번에: 서류함에 한꺼번에 올리기 단추', (await page.getByRole('button', { name: '한꺼번에 올리기' }).count()) === 1)
  check('한꺼번에: 서류함에 올린 파일 이름이 보인다', docTab.includes('scan001.txt') && docTab.includes('seal.txt'), docTab.slice(0, 500))
  check('한꺼번에: 만든 칸이 서류함에 있다', docTab.includes('법인인감증명서') && docTab.includes('직접 만든 칸'))
}

/* ---------------- 계약 단계 · 업체 삭제 ---------------- */
await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

// 계약 단계 선택기
await page.getByRole('button', { name: '더보기' }).first().click()
await page.waitForTimeout(400)
const opts = await page.evaluate(() => {
  const sel = Array.from(document.querySelectorAll('select')).find((s) => s.previousSibling || true)
  const all = Array.from(document.querySelectorAll('select'))
  const stage = all.find((s) => Array.from(s.options).some((o) => o.textContent === '계약 전'))
  void sel
  return stage ? Array.from(stage.options).map((o) => o.textContent) : null
})
check('계약 단계 3가지', JSON.stringify(opts) === JSON.stringify(['계약 전','계약 완료','계약 종료']), JSON.stringify(opts))

// 삭제 — 1차
await page.getByRole('button', { name: '업체 삭제' }).click()
await page.waitForTimeout(400)
check('1차 확인이 뜬다', await page.getByText('이 업체를 삭제할까요?').isVisible())
check('무엇이 사라지는지 알려준다', await page.getByText(/업무 .*개의 진행 상태/).isVisible())
await page.getByRole('button', { name: '네, 다음으로' }).click()
await page.waitForTimeout(400)
check('2차 확인이 뜬다', await page.getByText('마지막 확인').first().isVisible())

const disabled = await page.getByRole('button', { name: /영구 삭제/ }).isDisabled()
check('이름을 적기 전에는 못 누른다', disabled)
await page.getByLabel('확인을 위해 업체 이름 입력').fill('틀린이름')
await page.waitForTimeout(200)
check('틀린 이름이면 여전히 못 누른다', await page.getByRole('button', { name: /영구 삭제/ }).isDisabled())
await page.getByLabel('확인을 위해 업체 이름 입력').fill('한솔테크(주)')
await page.waitForTimeout(200)
check('이름이 맞으면 눌린다', !(await page.getByRole('button', { name: /영구 삭제/ }).isDisabled()))
await page.getByRole('button', { name: /영구 삭제/ }).click()
await page.waitForTimeout(900)
check('목록으로 돌아온다', page.url().endsWith('/ops/clients'))
const left = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').some((r) => r.id === 'cli_hansol'))
check('실제로 지워졌다', left === false)


/* ── 번호 서식과 복사 선택 ── */
{
  // 기록에 하이픈 없이 들어 있는 업체(우일산업: 3138112508 · 설립일 20020216)
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const board = (await page.locator('main').innerText()) ?? ''
  check('목록: 사업자번호에 하이픈이 붙는다', board.includes('313-81-12508'), board.includes('3138112508') ? '날것이 그대로 보임' : '')
  check('목록: 날것 설립일을 찍지 않는다', !board.includes('20020216'))
  check('목록: 업력을 읽어 보여 준다', /25년차/.test(board))

  await page.goto(BASE + '/ops/clients/cli_wooil', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const profile = (await page.locator('main').innerText()) ?? ''
  check('상세: 번호가 하이픈 모양으로 보인다', /313\s*-\s*81\s*-\s*12508/.test(profile), profile.slice(0, 160))
  check('상세: 날것 설립일을 찍지 않는다', !profile.includes('20020216') && profile.includes('2002-02-16'), profile.slice(0, 120))

  /*
   * 조각마다 따로 복사.
   * 신청서 입력칸이 [ ]-[ ]-[ ] 로 나뉘어 있으면 조각을 하나씩 붙여야 한다.
   * 세 조각이 각각 제 값만 복사하는지 클립보드를 실제로 읽어 확인한다.
   */
  for (const [seg, label] of [['313', '앞'], ['81', '가운데'], ['12508', '뒤']]) {
    const btn = page.getByRole('button', { name: `사업자등록번호 ${seg} 만 복사` }).first()
    check(`조각 복사: ${label} 조각 단추가 있다`, (await btn.count()) > 0)
    await btn.click()
    await page.waitForTimeout(350)
    const got = await page.evaluate(() => navigator.clipboard.readText())
    check(`조각 복사: ${label} 조각만 들어간다`, got === seg, got)
  }

  /*
   * 법인등록번호는 앞 6자리·뒤 7자리 두 조각이다 — 주민등록번호와 같은 모양이고,
   * 신청서 칸도 그렇게 나뉘어 있다. 두 조각이 따로 복사되는지 본다.
   */
  const corp = (await page.locator('main').innerText()) ?? ''
  check('법인등록번호: 앞뒤로 나뉘어 보인다', /110111\s*-\s*1234567/.test(corp), corp.slice(0, 160))
  for (const [seg, label] of [['110111', '앞 6자리'], ['1234567', '뒤 7자리']]) {
    const btn = page.getByRole('button', { name: `법인등록번호 ${seg} 만 복사` }).first()
    check(`법인등록번호: ${label} 단추가 있다`, (await btn.count()) > 0)
    await btn.click()
    await page.waitForTimeout(350)
    const got = await page.evaluate(() => navigator.clipboard.readText())
    check(`법인등록번호: ${label}만 들어간다`, got === seg, got)
  }

  // 보이는 그대로 전체 복사
  const shown = page.getByRole('button', { name: '사업자등록번호 전체 복사' }).first()
  check('복사: [전체] 선택지가 있다', (await shown.count()) > 0)
  await shown.click()
  await page.waitForTimeout(400)
  const asIs = await page.evaluate(() => navigator.clipboard.readText())
  check('복사: 전체는 보이는 그대로', asIs === '313-81-12508', asIs)

  // 숫자만 복사
  const digitsBtn = page.getByRole('button', { name: /사업자등록번호 숫자만 복사/ }).first()
  check('복사: [숫자만] 선택지가 있다', (await digitsBtn.count()) > 0)
  await digitsBtn.click()
  await page.waitForTimeout(400)
  const plain = await page.evaluate(() => navigator.clipboard.readText())
  check('복사: 숫자만 고르면 하이픈이 빠진다', plain === '3138112508', plain)

  // 전체 복사도 두 가지
  await page.getByRole('button', { name: '전체 복사' }).first().click()
  await page.waitForTimeout(400)
  const allAsIs = await page.evaluate(() => navigator.clipboard.readText())
  check('전체 복사: 기본은 하이픈 포함', allAsIs.includes('313-81-12508'), allAsIs.slice(0, 80))
  await page.getByRole('button', { name: '숫자만' }).first().click()
  await page.waitForTimeout(400)
  const allPlain = await page.evaluate(() => navigator.clipboard.readText())
  check('전체 복사: 숫자만 판도 있다', allPlain.includes('3138112508') && !allPlain.includes('313-81-12508'), allPlain.slice(0, 80))
}

/* ---------------- 회사 기본 정보: 칸 직접 만들기 · 지우기 ---------------- */
{
  await page.goto(BASE + '/ops/clients/cli_wooil', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  // 네 묶음 모두에 칸을 만들 수 있다 — 아직 아무것도 안 적은 묶음(연락처)도
  for (const g of ['회사', '사람', '연락처', '인증서']) {
    check(`칸 추가: ${g} 묶음에 만들 수 있다`, (await page.getByRole('button', { name: `${g}에 칸 추가` }).count()) > 0)
  }

  // 만들기
  await page.getByRole('button', { name: '회사에 칸 추가' }).first().click()
  await page.waitForTimeout(300)
  await page.getByLabel('새 칸 이름').fill('공장 등록번호')
  await page.getByLabel('새 칸 내용').fill('충남-2019-0042')
  await page.getByRole('button', { name: '넣기' }).first().click()
  await page.waitForTimeout(800)
  const made = (await page.locator('main').innerText()) ?? ''
  check('칸 추가: 화면에 바로 보인다', made.includes('공장 등록번호') && made.includes('충남-2019-0042'), made.slice(0, 200))
  const savedNew = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_wooil'),
  )
  const cf = savedNew?.customFields ?? savedNew?.payload?.customFields ?? []
  check('칸 추가: 저장된다', cf.length === 1 && cf[0]?.label === '공장 등록번호' && cf[0]?.group === 'identity', JSON.stringify(cf))

  // 이름까지 고칠 수 있다 — 잘못 적은 이름 때문에 지웠다 다시 만들지 않게
  await page.getByRole('button', { name: '공장 등록번호 고치기' }).first().click()
  await page.waitForTimeout(300)
  await page.getByLabel('칸 이름').fill('공장등록번호')
  await page.getByRole('button', { name: '저장', exact: true }).first().click()
  await page.waitForTimeout(700)
  check('칸 고치기: 이름이 바뀐다', ((await page.locator('main').innerText()) ?? '').includes('공장등록번호'))

  // 없애기 — 한 번 더 묻는다
  await page.getByRole('button', { name: '공장등록번호 고치기' }).first().click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '칸 없애기' }).first().click()
  await page.waitForTimeout(250)
  check('칸 없애기: 한 번 더 묻는다', ((await page.locator('main').innerText()) ?? '').includes('칸을 없앨까요?'))
  await page.getByRole('button', { name: '네, 없앱니다' }).first().click()
  await page.waitForTimeout(800)
  check('칸 없애기: 화면에서 사라진다', !((await page.locator('main').innerText()) ?? '').includes('공장등록번호'))
  const afterGone = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_wooil'),
  )
  check('칸 없애기: 저장에서도 빠진다', (afterGone?.customFields ?? afterGone?.payload?.customFields ?? []).length === 0)

  /*
   * 표준 칸은 값만 비운다.
   * 담당자가 대표일 수도 있으니 담당자를 지울 수 있어야 한다 — 다만 칸까지 없애면
   * 나중에 담당자가 생겼을 때 다시 만들 길이 없다.
   */
  await page.getByRole('button', { name: '담당자 고치기' }).first().click()
  await page.waitForTimeout(300)
  check('표준 칸: [값 지우기] 가 있다', (await page.getByRole('button', { name: '값 지우기' }).count()) > 0)
  check('표준 칸: [칸 없애기] 는 없다', (await page.getByRole('button', { name: '칸 없애기' }).count()) === 0)
  await page.getByRole('button', { name: '값 지우기' }).first().click()
  await page.waitForTimeout(800)
  const wiped = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_wooil'),
  )
  check('표준 칸: 값이 비워진다', (wiped?.contactName ?? wiped?.payload?.contactName ?? '') === '', JSON.stringify(wiped?.contactName))
  // 빈 칸이 접혀 있으므로 펴야 다시 보인다 — 칸 자체는 살아 있다
  const expand = page.getByRole('button', { name: /아직 안 적은/ }).first()
  if (await expand.count()) { await expand.click(); await page.waitForTimeout(400) }
  check('표준 칸: 칸은 남아 다시 적을 수 있다', ((await page.locator('main').innerText()) ?? '').includes('담당자'))
}

/* ---------------- 목록 정렬 · 번호 ---------------- */
{
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const picker = page.locator('select[aria-label="업체 정렬 기준"]')
  check('정렬: 고르는 칸이 있다', (await picker.count()) > 0)
  const opts = await picker.locator('option').allInnerTexts()
  check('정렬: 네 가지', opts.length === 4 && opts.includes('가나다순') && opts.includes('업력순') && opts.includes('계약 오래된 순'), JSON.stringify(opts))

  const names = async () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('main li'))
        .map((li) => (li.querySelector('button span.truncate')?.textContent ?? '').trim())
        .filter((t) => t !== ''),
    )
  await picker.selectOption('name')
  await page.waitForTimeout(600)
  const sorted = await names()
  const expected = [...sorted].sort((a, b) => a.localeCompare(b, 'ko'))
  check('정렬: 가나다순으로 실제로 바뀐다', JSON.stringify(sorted) === JSON.stringify(expected), JSON.stringify(sorted))

  // 번호가 붙어 순서가 눈에 보인다
  const board = (await page.locator('main').innerText()) ?? ''
  check('정렬: 번호가 붙는다', /(^|\n)\s*1\s/.test(board) || board.includes('1 '), board.slice(0, 120))

  // 새로고침해도 고른 기준이 남는다
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('정렬: 새로고침해도 기억한다', (await picker.inputValue()) === 'name')
  await picker.selectOption('urgency')
  await page.waitForTimeout(500)
}

/* ---------------- 수금: 영업자 수수료 · 내 몫 · 이익률 ---------------- */
{
  await page.goto(BASE + '/ops/clients/cli_wooil?tab=fees', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  // 우일산업에는 수금 항목이 없으니 하나 넣는다 (2,000만원 · 영업자 200만 → 90%)
  await page.getByLabel('금액(원)').first().fill('20,000,000')
  await page.getByLabel('영업자 수수료').first().fill('2,000,000')
  await page.waitForTimeout(300)
  const live = (await page.locator('main').innerText()) ?? ''
  check('수금: 적는 동안 이익률이 보인다', live.includes('이익률 90%'), live.slice(0, 300))

  await page.getByRole('button', { name: '추가' }).first().click()
  await page.waitForTimeout(900)
  const after = (await page.locator('main').innerText()) ?? ''
  check('수금: 청구 합계', after.includes('2,000만원'), after.slice(0, 300))
  check('수금: 영업자 수수료 합계', after.includes('200만원'))
  check('수금: 내가 받는 돈', after.includes('1,800만원'))
  check('수금: 항목에 내 몫과 이익률', after.includes('18,000,000원') && after.includes('90%'))

  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_wooil'),
  )
  const fees = saved?.fees ?? saved?.payload?.fees ?? []
  check('수금: 수수료가 저장된다', fees[0]?.agentFee === 2_000_000, JSON.stringify(fees[0]))
  check('수금: 이익률은 저장하지 않는다 — 매번 계산한다', !JSON.stringify(fees[0] ?? {}).includes('margin'))
}

await browser.close()
console.log(`\n목록 바로 고치기 · 계약 단계 · 삭제: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
