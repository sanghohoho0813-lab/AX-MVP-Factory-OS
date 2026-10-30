/**
 * D-315 꾸미기 지키기 — 새 버전이 나와 화면이 다시 열려도(배포 뒤 새로 고침) 대표가 꾸며 둔 것이 그대로인지.
 *
 *  K1 화면 꾸미기(오늘) — 메모 칸 맨 위 · 숫자 칸 계속 숨김 → 새로 고침 → 그대로
 *  K2 다음 버전에서 생길 칸 · 지금 화면에 없는 칸의 저장 자리 — 다른 칸을 옮겨도 지워지지 않음
 *  K3 [모두 접기] → 새로 고침 → 접힌 그대로(예전에는 기본으로 펼쳐지는 칸이 다시 펼쳐졌다)
 *  K4 글자 크기 · 테마 → 새로 고침 → 그대로 · 이 버전이 모르는 값은 다른 설정을 바꿔도 지워지지 않음
 *  K5 휴대폰 아래 메뉴 고른 것 → 새로 고침 → 그대로
 *
 *   node e2e/keepui.mjs http://localhost:4390
 */
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
const check = (name, ok, detail) => {
  if (ok) {
    pass++
    console.log('PASS ', name)
  } else {
    fail++
    console.log('FAIL ', name, detail === undefined ? '' : typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(seedScript())
// 시드가 켜 둔 '모두 펼치기' 는 이 시험에서 쓰지 않는다
await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))

const order = () => page.evaluate(() => [...document.querySelectorAll('[data-arrange-item]')].map((e) => e.getAttribute('data-arrange-item')))
const store = (k) => page.evaluate((key) => localStorage.getItem(key), k)

/* ---- K1 · K2 화면 꾸미기 ---- */
{
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.getByTestId('today-kpis').waitFor({ timeout: 10000 })
  await page.getByTestId('arrange-open').click()
  await page.getByTestId('arrange-list').waitFor()
  await page.locator('[data-arrange-row="capture"]').getByTestId('arrange-top').click()
  await page.locator('[data-arrange-row="kpis"] [data-vis="off"]').click()
  await page.getByTestId('arrange-done').click()
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const o = await order()
  check('K1 오늘 — 메모 칸 맨 위 · 숫자 칸 숨김이 새로 고쳐도 그대로', o[0] === 'capture' && !o.includes('kpis'), o)
  // 다음 버전에서 생길 칸(future-card) · 지금 이 화면에 없는 칸이 저장 순서에 있다고 하고 — 다른 칸을 옮긴다
  await page.evaluate(() => {
    const k = 'axmvp.ui.layout.today'
    const l = JSON.parse(localStorage.getItem(k) ?? '{}')
    l.order = ['future-card', ...(l.order ?? [])]
    localStorage.setItem(k, JSON.stringify(l))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByTestId('arrange-open').click()
  await page.getByTestId('arrange-list').waitFor()
  await page.locator('[data-arrange-row="todos"]').getByTestId('arrange-top').click()
  await page.getByTestId('arrange-done').click()
  const saved = JSON.parse((await store('axmvp.ui.layout.today')) ?? '{}')
  check('K2 지금 화면에 없는 칸(future-card)의 저장 자리가 다른 칸을 옮겨도 남는다', Array.isArray(saved.order) && saved.order.includes('future-card') && saved.order.includes('capture') && (saved.off ?? []).includes('kpis'), saved)
  const o2 = await order()
  check('K2 옮긴 것(할 일 맨 위)은 바로 · 메모 칸은 그다음 · 숫자 칸은 여전히 숨김', o2[0] === 'todos' && o2[1] === 'capture' && !o2.includes('kpis'), o2)
}

/* ---- K3 [모두 접기] ---- */
{
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const openCount = () => page.locator('[data-testid="fold-toggle"][aria-expanded="true"]').count()
  // D-357 업체 상세 목차는 처음엔 모두 접힘 — 하나를 펼쳐 둔 뒤 [모두 접기]
  if ((await openCount()) === 0) {
    await page.locator('[data-testid="fold-toggle"]').first().click()
    await page.waitForTimeout(200)
  }
  const before = await openCount()
  await page.getByTestId('fold-all-close').first().click()
  await page.waitForTimeout(300)
  const closed = await openCount()
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const after = await openCount()
  check(`K3 업체 상세 [모두 접기](펼친 칸 ${before} → ${closed}) → 새로 고쳐도 접힌 그대로(${after}) · 'closed' 로 기억`, before > 0 && closed === 0 && after === 0 && (await store('axmvp.fold.all')) === 'closed', { before, closed, after })
  // 하나만 펼치면 그것만 펼친 채로 기억
  await page.locator('[data-testid="fold-toggle"]').first().click()
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('K3 [모두 접기] 뒤 하나만 펼치면 그것만 펼친 채로 기억', (await openCount()) === 1, await openCount())
  await page.getByTestId('fold-all-open').first().click()
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('K3 [모두 펼치기] → 새로 고쳐도 모두 펼침', (await openCount()) >= Math.max(before, 2) && (await store('axmvp.fold.all')) === 'open', await openCount())
}

/* ---- K4 글자 크기 · 테마 ---- */
{
  await page.evaluate(() => {
    localStorage.setItem('axmvp.ui.preferences', JSON.stringify({ textScale: 'large', theme: 'navy-gold', themeChosen: true, motion: 'full', featureVisibility: 'core', futureOption: 'kept', updatedAt: 'x' }))
  })
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const scale = await page.evaluate(() => document.documentElement.getAttribute('data-text-scale'))
  const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
  check('K4 저장한 글자 크기(크게) · 테마(네이비 골드)가 새로 열어도 그대로', scale === 'large' && theme === 'navy-gold', { scale, theme })
  // 다른 설정 하나(글자 크기)를 바꿔도 이 버전이 모르는 칸(futureOption)은 그대로
  await page.getByRole('radio', { name: /매우 크게/ }).first().click()
  await page.waitForTimeout(400)
  const raw = JSON.parse((await store('axmvp.ui.preferences')) ?? '{}')
  check('K4 글자 크기를 바꿔도 테마 · 이 버전이 모르는 칸은 그대로', raw.textScale === 'extra_large' && raw.theme === 'navy-gold' && raw.futureOption === 'kept', raw)
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('axmvp.ui.preferences') ?? '{}')
    p.textScale = 'default'
    localStorage.setItem('axmvp.ui.preferences', JSON.stringify(p))
  })
}

/* ---- K5 휴대폰 아래 메뉴 ---- */
{
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
  const p2 = await phone.newPage()
  await p2.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await p2.evaluate(seedScript())
  await p2.evaluate(() => localStorage.setItem('axmvp.ui.mobile_nav.v1', JSON.stringify(['today', 'client-ops', 'money'])))
  await p2.goto(BASE + '/', { waitUntil: 'networkidle' })
  await p2.waitForTimeout(800)
  await p2.reload({ waitUntil: 'networkidle' })
  await p2.waitForTimeout(800)
  const bar = ((await p2.locator('nav[aria-label*="아래"], [data-testid="mobile-nav"]').first().innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ')
  check('K5 휴대폰 아래 메뉴 — 고른 칸(오늘 · 고객 · 매출)이 새로 고쳐도 그대로', bar.includes('오늘') && bar.includes('고객') && bar.includes('매출') && !bar.includes('일정'), bar.slice(0, 120))
  await phone.close()
}

check('오류 0', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(`\nkeep-ui e2e: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
