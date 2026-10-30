/**
 * qa:firstscreen — 📐 화면 원칙(2026-10-30 대표 "첫 화면에 많은 것 금지") 지키기.
 *
 * 메뉴 · 목차를 눌러 들어간 첫 화면의 길이(문서 높이 ÷ 화면 높이)를 PC 1440 · 휴대폰 390 에서 잰다.
 * 접기는 기본값으로(시험 자료의 [모두 펼치기] 를 지우고) — 대표가 처음 여는 그대로.
 * 화면마다 한도(지금 길이 + 여유)를 넘으면 실패 — 새 기능이 첫 화면을 다시 길게 만들면 여기서 걸린다.
 * 한도를 올려야 하면 접기 · 탭 · 다음 단계로 줄일 수 없는지 먼저 본다.
 *
 *   node e2e/firstscreen.mjs <baseUrl> [--shots <dir>]
 */
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const si = process.argv.indexOf('--shots')
const SHOTS = si > 0 ? process.argv[si + 1] : ''

/** [이름, 주소, PC 한도, 휴대폰 한도] — 2026-10-30 D-357 · D-358 뒤 길이 + 여유(창업감면 D-361 · 고용지원금 D-362 · 연구소 D-367 에서 줄임) */
const SCREENS = [
  ['오늘', '/', 2.6, 3.6],
  ['고객 관리', '/ops/clients', 2.4, 3.1],
  ['업체 개요', '/ops/clients/cli_hansol', 2.5, 3.9],
  ['맞춤 추천', '/ops/clients/cli_hansol?tab=smart', 2.4, 3.9],
  ['서류', '/ops/clients/cli_hansol?tab=docs', 2.8, 5.0],
  ['일정', '/ops/calendar', 1.6, 2.1],
  ['영업 관리', '/sales/board', 2.5, 2.7],
  ['매출 · 비용', '/money', 2.0, 2.6],
  ['지원사업', '/grants', 1.4, 1.5],
  ['상담신청', '/ops/inbox', 1.6, 2.2],
  ['특허 · 벤처', '/patent-venture', 1.4, 1.7],
  ['전문 모듈', '/tools', 2.0, 3.6],
  ['정책자금', '/tools/policy-funding', 1.7, 2.5],
  ['고용지원금', '/tools/employment', 2.0, 3.0],
  ['연구소', '/tools/labcare', 2.2, 3.0],
  ['창업감면', '/tools/startup-tax', 2.0, 2.8],
  ['세금 계산기', '/tools/tax', 3.2, 4.0],
  ['기업인증', '/tools/cert-os', 1.4, 1.4],
  ['크레탑', '/tools/cretop', 1.8, 2.1],
  ['마케팅', '/marketing', 1.7, 2.4],
  ['내 콘텐츠', '/marketing?view=make', 1.7, 2.6],
  ['1주일치', '/marketing?week=1', 1.9, 2.8],
  ['스레드', '/marketing/threads', 2.5, 3.5],
  ['릴스 · 틱톡', '/marketing/shorts', 2.6, 3.7],
  ['홍보 글', '/tools/content', 1.6, 2.1],
  ['홈페이지', '/tools/homepage', 1.6, 2.1],
]

let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) {
    pass++
    console.log('PASS ', n)
  } else {
    fail++
    console.log('FAIL ', n, d === undefined ? '' : String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300))
  }
}

const browser = await chromium.launch()
for (const vp of [
  { tag: 'PC', width: 1440, height: 900, col: 2 },
  { tag: '휴대폰', width: 390, height: 844, col: 3 },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.width < 768, hasTouch: vp.width < 768 })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(seedScript())
  await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))
  const rows = []
  for (const s of SCREENS) {
    const [name, path] = s
    const limit = s[vp.col]
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(700)
    const ratio = await page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight)
    rows.push(`${name} ${ratio.toFixed(1)}`)
    check(`${vp.tag} ${name} 첫 화면 ${ratio.toFixed(1)}배 ≤ ${limit}배`, ratio <= limit + 0.05, path)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp.tag}-${name.replace(/[^가-힣a-z0-9]+/gi, '_')}.png`, fullPage: true })
  }
  console.log(`${vp.tag}: ${rows.join(' · ')}`)
  if (vp.tag === '휴대폰') {
    // D-369 휴대폰 전문 모듈 — 모듈마다 기능 3개 먼저 · [n개 더 보기] 로 전부(PC 는 처음부터 전부)
    await page.goto(BASE + '/tools', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    const growth = page.locator('[data-module-card="growth"]')
    const visibleFeat = () => growth.locator('[data-feature]:visible').count()
    const before = await visibleFeat()
    await growth.getByTestId('module-card-more').click()
    await page.waitForTimeout(200)
    const after = await visibleFeat()
    check('휴대폰 전문 모듈: 기능 3개 먼저 → [n개 더 보기] 누르면 전부(단추는 사라짐)', before === 3 && after > 3 && (await growth.getByTestId('module-card-more').count()) === 0, { before, after })
  }
  check(`${vp.tag} JS 오류 0`, errs.length === 0, errs)
  await ctx.close()
}
await browser.close()
console.log(`\nfirstscreen: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
