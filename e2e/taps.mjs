/**
 * qa:taps — D-525 휴대폰 상위 동선 몇 번 눌러야 하나(실측 · UX-6).
 *
 * 마스터 계획 기준 '핵심 업무 3번 안에 시작' — 말로 쓰지 않고 휴대폰(390)에서 실제로 눌러 센다.
 * 오늘(첫 화면)에서 출발해 아래 다섯 일을 끝까지 가 보고, 누른 수 · 도착했는지를 적는다. 3번을 넘으면 실패.
 *   1 고객에게 전화      [고객] → 카드 전화 단추(tel:)
 *   2 업체 서류 보기     [고객] → 업체 이름 → [서류] 탭
 *   3 오늘 일정 보기     [일정]
 *   4 미팅 메모 적기     [영업] → 카드 [미팅 준비] → 미팅 기록 칸
 *   5 마케팅 시작        [더보기] → [마케팅 · 브랜딩] → 대화창(무엇을 만들까요)
 *
 *   node e2e/taps.mjs <baseUrl>
 */
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) {
    pass++
    console.log('PASS ', n)
  } else {
    fail++
    console.log('FAIL ', n, d === undefined ? '' : JSON.stringify(d).slice(0, 300))
  }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(seedScript())

const nav = () => page.getByTestId('mobile-nav')
/** 한 번 누르기 — 센다 */
let taps = 0
const tap = async (loc) => {
  // 같은 이름이 숨은 메뉴(왼쪽 서랍)에도 있다 — 화면에 보이는 것만
  const one = loc.filter({ visible: true }).first()
  await one.waitFor({ state: 'visible', timeout: 8000 })
  await one.click()
  taps += 1
  await page.waitForTimeout(350)
}
const start = async () => {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  taps = 0
}
const results = []
const flow = async (name, run, arrived) => {
  await start()
  let ok = false
  let err = ''
  try {
    await run()
    ok = await arrived()
  } catch (e) {
    err = String(e).split('\n')[0].slice(0, 160)
  }
  results.push(`${name} ${taps}번${ok ? '' : ' (도착 못 함)'}`)
  check(`${name} — ${taps}번 눌러 도착(3번 안)`, ok && taps <= 3, { taps, ok, err })
}

// 1 고객에게 전화 — 전화 앱으로 넘어가지 않게 tel: 이동만 막는다
await flow(
  '고객에게 전화',
  async () => {
    await tap(nav().getByRole('link', { name: /^고객/ }))
    const call = page.getByTestId('client-card').getByTestId('call-button')
    await call.first().waitFor({ timeout: 8000 })
    await call.first().evaluate((a) => a.addEventListener('click', (e) => e.preventDefault(), { once: true }))
    await tap(call)
  },
  async () => /\/ops\/clients$/.test(new URL(page.url()).pathname) && ((await page.getByTestId('client-card').getByTestId('call-button').first().getAttribute('href')) ?? '').startsWith('tel:'),
)

// 2 업체 서류 보기
await flow(
  '업체 서류 보기',
  async () => {
    await tap(nav().getByRole('link', { name: /^고객/ }))
    await tap(page.getByTestId('client-card').first().locator('button').first())
    await tap(page.getByRole('tab', { name: /서류/ }))
  },
  async () => /\/ops\/clients\/[^/]+/.test(page.url()) && (await page.getByTestId('doc-shelf-wrap').count()) >= 1,
)

// 3 오늘 일정 보기
await flow(
  '오늘 일정 보기',
  async () => {
    await tap(nav().getByRole('link', { name: /^일정/ }))
  },
  async () => /\/ops\/calendar/.test(page.url()) && (await page.getByTestId('calendar-quick-open').count()) >= 1,
)

// 4 미팅 메모 적기
await flow(
  '미팅 메모 적기',
  async () => {
    await tap(nav().getByRole('link', { name: /^영업/ }))
    await tap(page.getByRole('link', { name: /미팅 준비$/ }))
  },
  async () => /\/sales\/meeting/.test(page.url()) && (await page.getByTestId('meeting-recorder').locator('textarea').count()) >= 1,
)

// 5 마케팅 시작
await flow(
  '마케팅 시작',
  async () => {
    await tap(page.getByTestId('mobile-more'))
    await tap(page.getByTestId('more-sheet').locator('[data-testid="more-tile"][data-key="marketing"]'))
  },
  async () => /\/marketing/.test(page.url()) && (await page.getByTestId('mk-ask-input').waitFor({ timeout: 10000 }).then(() => true).catch(() => false)),
)

console.log('\n휴대폰 390 누른 수:', results.join(' · '))
check('JS 오류 0', errors.length === 0, errors.slice(0, 3))
await browser.close()
console.log(`\nqa:taps: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
