/**
 * 업체가 많을 때 (D-479) — 300곳이어도 화면이 바로 뜨고, 긴 목록은 나눠 그리고, 숫자는 그대로인지
 *
 *   node e2e/many.mjs <baseUrl>
 *
 * 왜 필요한가:
 *   업체 1,000곳이면 고객 관리 · 오늘 · 확인할 것이 카드 · 판정을 한 번에 그리느라 몇 초씩 멈췄다(D-479).
 *   지금은 긴 목록을 처음 몇십 개만 그리고 아래로 내리면 이어서, 판정은 나눠 계산한 뒤 한 번에 보여 준다.
 *   그 약속 — 처음 개수 · '아래로 내리면 n곳 더 보여요' 숫자 · 내리면 늘어남 · 숫자 띠와 목록이 같은 수 · 견본(5곳)은 예전 그대로 — 을 지킨다.
 *
 * 판정:
 *   1. 고객 관리 — 카드 40장 · '아래로 내리면 n곳 더' 의 n = 전체 − 40 · 내리면 늘어남 · 맞춤 추천 띠가 붙음
 *   2. 오늘 — '확인할 것' 숫자 = 확인할 것 모두 보기의 전체 수
 *   3. 확인할 것 모두 보기 — 40건 · 'n건 더' · 내리면 늘어남 · 종류를 바꾸면 처음부터 · [모두 맞아요] 는 그 종류 전부
 *   4. 영업 관리 보드 · 영업자 정산 — 칸마다 나눠 그림('더 보여요')
 *   5. 견본 업체만 — 나눠 그리는 표시 없음(예전 그대로) · 휴대폰 390 도 40장 · JS 오류 0
 */

import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const N = 300
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) { pass++; console.log('PASS ', n) }
  else { fail++; console.log('FAIL ', n, d ?? '') }
}

/** 한솔테크 기록을 N곳 복제(진행 단계는 셋을 돌아가며) */
const cloneScript = (n) => `(() => {
  const k = 'axmvp.v1.operations_clients'
  const list = JSON.parse(localStorage.getItem(k) || '[]')
  const base = list.find((r) => r.id === 'cli_hansol') || list[0]
  const extra = []
  for (let i = 0; i < ${n}; i++) {
    const bn = String(1000000000 + i * 7919).slice(0, 10)
    extra.push({ ...JSON.parse(JSON.stringify(base)), id: 'cli_many_' + i, companyName: '많은업체' + i + '(주)', businessNumber: bn.slice(0, 3) + '-' + bn.slice(3, 5) + '-' + bn.slice(5), status: ['active', 'lead', 'contracted'][i % 3] })
  }
  localStorage.setItem(k, JSON.stringify([...list, ...extra]))
  return list.length + extra.length
})()`

const num = (s) => Number((String(s).match(/(\d[\d,]*)/) ?? [])[1]?.replace(/,/g, '') ?? NaN)
const toBottom = async (page) => {
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(350)
  }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const errors = []

/* ---------------- 300곳 · PC ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const total = await page.evaluate(cloneScript(N))

  // 1. 고객 관리
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.getByTestId('client-card').first().waitFor({ timeout: 20000 })
  const cards0 = await page.getByTestId('client-card').count()
  const more0 = await page.getByTestId('clients-more').innerText().catch(() => '')
  check(`고객 관리 ${total}곳: 처음 카드 40장`, cards0 === 40, `카드 ${cards0}`)
  check(`고객 관리: '아래로 내리면 n곳 더 보여요' n = ${total} − 40`, /아래로 내리면 \d+곳 더 보여요/.test(more0) && num(more0) === total - 40, more0)
  await toBottom(page)
  const cards1 = await page.getByTestId('client-card').count()
  check('고객 관리: 아래로 내리면 카드가 늘어남', cards1 >= 80, `카드 ${cards0} → ${cards1}`)
  const recoOk = await page
    .waitForFunction(() => [...document.querySelectorAll('[data-testid="card-reco"]')].some((el) => el.textContent.trim().length > 0), null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false)
  check('고객 관리: 나눠 계산한 맞춤 추천 띠가 카드에 붙음', recoOk)

  // 2. 오늘 — '확인할 것' 숫자
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  const todayBox = page.getByTestId('today-decide')
  await todayBox.waitFor({ timeout: 25000 }).catch(() => {})
  const todayHead = await page.locator('#today-decide-title').innerText().catch(() => '')
  // 접는 목차 제목 = '확인할 것' + 숫자 칩
  const todayCount = todayHead.replace('확인할 것', '')
  check('오늘: 업체가 많아도 \'확인할 것\' 칸이 뜸', (await todayBox.count()) === 1, todayHead)

  // 3. 확인할 것 모두 보기
  await page.goto(BASE + '/ops/decide', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => /\d+곳에서 [\d,]+건/.test(document.querySelector('[data-testid="decide-summary"]')?.textContent ?? ''), null, { timeout: 25000 }).catch(() => {})
  const summary = await page.getByTestId('decide-summary').innerText()
  const allN = num(summary.split('곳에서')[1] ?? '')
  check('확인할 것 모두 보기: 다 모은 뒤 \'n곳에서 m건\'', /\d+곳에서 [\d,]+건/.test(summary), summary)
  check('오늘 \'확인할 것\' 숫자 = 모두 보기 전체 수', num(todayCount) === allN, `오늘 ${todayCount} · 모두 보기 ${allN}`)
  const d0 = await page.getByTestId('decision').count()
  const dm = await page.getByTestId('decision-more-list').innerText().catch(() => '')
  check('확인할 것 모두 보기: 처음 40건', d0 === Math.min(40, allN), `${d0}건`)
  check('확인할 것 모두 보기: \'아래로 내리면 n건 더\' n = 전체 − 40', allN <= 40 || num(dm) === allN - 40, dm)
  await toBottom(page)
  const d1 = await page.getByTestId('decision').count()
  check('확인할 것 모두 보기: 아래로 내리면 늘어남', allN <= 40 || d1 >= 80, `${d0} → ${d1}`)
  // 종류 칩 — 처음 40건부터 · 한 번에 처리는 그 종류 전부
  const kinds = await page.locator('[data-testid^="decide-kind-"]').evaluateAll((els) => els.map((e) => ({ id: e.getAttribute('data-testid'), t: e.textContent })))
  const bulkKinds = ['fact', 'module', 'stale', 'next', 'autofill']
  const big = kinds.filter((k) => k.id !== 'decide-kind-all').map((k) => ({ ...k, n: num(k.t.replace(/^\D*/, '')) })).sort((a, b) => b.n - a.n)
  const pick = big.find((k) => bulkKinds.includes(k.id.replace('decide-kind-', '')) && k.n > 40) ?? big[0]
  if (pick) {
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.getByTestId(pick.id).click()
    await page.waitForTimeout(400)
    const k0 = await page.getByTestId('decision').count()
    check(`확인할 것: 종류(${pick.t.trim()})를 바꾸면 처음 40건부터`, k0 === Math.min(40, pick.n), `${k0}건`)
    const bulk = await page.getByTestId('decide-bulk-yes').innerText().catch(() => '')
    if (bulk) check('확인할 것: [이 n건 모두 맞아요] 는 그 종류 전부(그린 40건만이 아님)', num(bulk) >= Math.min(pick.n, 2) && num(bulk) <= pick.n && (pick.n <= 40 || num(bulk) > 40), `${bulk} · 종류 ${pick.n}`)
  }

  // 4. 영업 관리 보드 · 영업자 정산
  await page.goto(BASE + '/sales/board', { waitUntil: 'networkidle' })
  await page.getByTestId('sales-board').waitFor({ timeout: 15000 }).catch(() => {})
  const boardMore = await page.getByTestId('sales-board').getByTestId('list-more').count()
  check('영업 관리 보드: 업체가 많은 칸은 나눠 그림(\'더 보여요\')', boardMore >= 1, `더 보여요 ${boardMore}칸`)
  await page.goto(BASE + '/ops/agents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const paidBoxes = await page.locator('input[type="checkbox"][aria-label$="영업자 지급 완료"]').count()
  const agentMore = await page.getByTestId('list-more').first().innerText().catch(() => '')
  check('영업자 정산: 한 사람 항목은 40건씩', /아래로 내리면 \d+건 더 보여요/.test(agentMore) && paidBoxes <= 40 * 3, `${paidBoxes}줄 · ${agentMore}`)
  await ctx.close()
}

/* ---------------- 견본 업체만 — 예전 그대로 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.getByTestId('client-card').first().waitFor({ timeout: 15000 })
  check('견본 업체: 고객 관리에 \'더 보여요\' 없음', (await page.getByTestId('clients-more').count()) === 0)
  await page.goto(BASE + '/ops/decide', { waitUntil: 'networkidle' })
  const s = await page.getByTestId('decide-summary').innerText()
  check('견본 업체: 확인할 것이 바로(모으는 중 없이) · \'더 보여요\' 없음', /\d+곳에서 \d+건/.test(s) && (await page.getByTestId('decision-more-list').count()) === 0, s)
  await page.goto(BASE + '/ops/agents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check('견본 업체: 영업자 정산에 \'더 보여요\' 없음', (await page.getByTestId('list-more').count()) === 0)
  await ctx.close()
}

/* ---------------- 300곳 · 휴대폰 390 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(cloneScript(N))
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.getByTestId('client-card').first().waitFor({ timeout: 20000 })
  const c = await page.getByTestId('client-card').count()
  const sw = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
  check('휴대폰 390: 고객 관리 카드 40장 · \'더 보여요\' · 옆으로 넘침 없음', c === 40 && (await page.getByTestId('clients-more').count()) === 1 && sw, `카드 ${c}`)
  await ctx.close()
}

check('JS 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | '))
await browser.close()
console.log(`\n업체가 많을 때: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
