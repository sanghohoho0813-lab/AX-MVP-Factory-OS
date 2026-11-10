/**
 * D-565 메뉴 안내 — 메뉴마다 '무엇을 하나요 · 왜 있나요 · 쓰면 이렇게 돼요 · 앞으로' + 사용법 영상 자리.
 *
 *  G1 왼쪽 메뉴에 마우스 → 안내 카드(네 칸 · 영상 줄) · 떠나면 닫힘 · 지나가는 마우스에는 안 뜸
 *  G2 누르면 닫히고 그 칸을 떠날 때까지 다시 안 뜸 · Esc 로 닫힘 · 카드는 누름을 가로채지 않음 · 메뉴 글에 섞이지 않음
 *  G3 보이는 메뉴 줄 전부에 안내 열쇠 · 글이 비어 있지 않음
 *  G4 사용법 안내 화면 — 묶음 탭 · 한 번에 한 줄만 펼침 · 영상 자리 · [이 화면 열기] · ?m= 로 그 줄 펼침
 *  G5 마케팅 목차 · 오늘 바로가기에서도 카드(옆 칸을 가리지 않게 아래로)
 *  G6 휴대폰 390 — 사용법 안내 화면 넘침 0 · 마우스 카드 없음 · 작은 단추 0
 *  G7 이용약관 · 개인정보처리방침 초안 화면(/terms · /privacy) — 로그인 없이 · 초안 띠 · 금액 0
 *
 *   node e2e/guide.mjs http://localhost:4390 [사진 폴더]
 */
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.argv[3] ?? ''
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
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }).catch(() => {})
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(seedScript())
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

const card = page.getByTestId('menu-guide-card')
const row = (key) => page.locator(`aside [data-guide="${key}"]`).first()

/* G1 */
await row('client-ops').hover()
await page.waitForTimeout(150)
check('G1 지나가는 마우스(0.15초)에는 카드가 안 뜸', (await card.count()) === 0)
await page.waitForTimeout(700)
const t1 = (await card.innerText().catch(() => '')) ?? ''
check('G1 메뉴에 마우스 → 안내 카드: 이름 + 무엇을 하나요 · 왜 있나요 · 쓰면 이렇게 돼요 · 앞으로 + 영상 줄', (await card.count()) === 1 && (await card.getAttribute('data-key')) === 'client-ops' && ['고객 관리', '무엇을 하나요', '왜 있나요', '쓰면 이렇게 돼요', '앞으로', '사용법 영상'].every((w) => t1.includes(w)), t1.replace(/\n/g, ' | ').slice(0, 240))
const box = await card.boundingBox()
const rb = await row('client-ops').boundingBox()
check('G1 카드는 메뉴 줄 오른쪽 · 화면 안', !!box && !!rb && box.x >= rb.x + rb.width && box.x + box.width <= 1440 && box.y >= 0 && box.y + box.height <= 900, { box, rb })
const navText = (await page.locator('aside').first().innerText()) ?? ''
check('G2 카드 글은 메뉴(aside) 글에 섞이지 않음', !navText.includes('무엇을 하나요'))
await shot(page, 'guide-01-hover')
await page.mouse.move(800, 500)
await page.waitForTimeout(200)
check('G1 떠나면 닫힘', (await card.count()) === 0)

/* G2 */
await row('calendar').hover()
await page.waitForTimeout(800)
check('G2 다른 메뉴 → 그 메뉴 카드', (await card.getAttribute('data-key').catch(() => '')) === 'calendar')
await page.keyboard.press('Escape')
await page.waitForTimeout(150)
check('G2 Esc 로 닫힘', (await card.count()) === 0)
await page.mouse.move(800, 500)
await row('decide').hover()
await page.waitForTimeout(800)
const before = page.url()
await row('decide').click()
await page.waitForTimeout(1200)
check('G2 카드가 떠 있어도 누르면 그 화면으로 감(누름을 가로채지 않음) · 누른 뒤에는 닫힘', page.url() !== before && page.url().includes('/ops/decide') && (await card.count()) === 0, page.url())
await page.waitForTimeout(700)
check('G2 누른 칸에 마우스가 그대로 있어도 다시 뜨지 않음', (await card.count()) === 0)

/* G3 */
const keys = await page.locator('aside a[href], aside button[data-nav-category]').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height > 0).map((e) => ({ key: e.getAttribute('data-guide'), text: (e.textContent ?? '').trim().slice(0, 20), href: e.getAttribute('href') })))
const noGuide = keys.filter((k) => !k.key && k.href !== '/')
check(`G3 보이는 메뉴 줄 ${keys.length}개 전부에 안내 열쇠`, keys.length >= 12 && noGuide.length === 0, noGuide)

/* G4 */
await page.mouse.move(800, 500)
await row('help').click()
await page.waitForTimeout(900)
check('G4 메뉴 [사용법 안내] → /guide · 한 줄 설명', page.url().endsWith('/guide') && (await page.getByTestId('guide-page').count()) === 1 && ((await page.locator('main').innerText()) ?? '').includes('메뉴를 누르면'))
const groups = await page.getByTestId('guide-group').evaluateAll((els) => els.map((e) => e.getAttribute('data-group')))
check('G4 묶음 탭 — 오늘 · 고객 · 영업 · 설정 …(왼쪽 메뉴와 같은 묶음)', ['today', 'clients', 'sales', 'settings'].every((g) => groups.includes(g)), groups)
check('G4 첫 화면은 이름 줄만(펼친 줄 0 · 첫 묶음 메뉴만)', (await page.locator('[data-testid="guide-row"][data-open="1"]').count()) === 0 && (await page.getByTestId('guide-row').count()) <= 8, await page.getByTestId('guide-row').count())
await page.locator('[data-testid="guide-row"][data-key="today"] [data-testid="guide-row-toggle"]').click()
await page.waitForTimeout(250)
const p1 = (await page.getByTestId('guide-panel').innerText()) ?? ''
check('G4 줄을 누르면 네 칸 + 영상 자리(준비 중) + [이 화면 열기]', ['무엇을 하나요', '왜 있나요', '쓰면 이렇게 돼요', '앞으로', '사용법 영상 준비 중', '이 화면 열기'].every((w) => p1.includes(w)) && (await page.getByTestId('guide-video').getAttribute('data-ready')) === '0', p1.replace(/\n/g, ' | ').slice(0, 260))
await page.locator('[data-testid="guide-row"][data-key="decide"] [data-testid="guide-row-toggle"]').click()
await page.waitForTimeout(250)
check('G4 한 번에 한 줄만 펼침 · 주소에 ?m= 남음', (await page.locator('[data-testid="guide-row"][data-open="1"]').count()) === 1 && (await page.locator('[data-testid="guide-row"][data-open="1"]').getAttribute('data-key')) === 'decide' && page.url().includes('m=decide'), page.url())
await shot(page, 'guide-02-page')
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(600)
check('G4 새로 고쳐도 그 줄이 펼쳐진 채', (await page.locator('[data-testid="guide-row"][data-open="1"]').getAttribute('data-key').catch(() => '')) === 'decide')
await page.goto(BASE + '/guide?m=mk-threads', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
check('G4 ?m=mk-threads → 영업 묶음 · 스레드 줄 펼침(마케팅 안 화면)', (await page.locator('[data-testid="guide-row"][data-open="1"]').getAttribute('data-key').catch(() => '')) === 'mk-threads' && (await page.locator('[data-testid="guide-group"][aria-selected="true"]').getAttribute('data-group')) === 'sales')
await page.getByTestId('guide-go').click()
await page.waitForTimeout(900)
check('G4 [이 화면 열기] → 그 화면', page.url().includes('/marketing/threads'), page.url())
// 모든 묶음 · 모든 줄 — 글 네 칸이 비지 않음
await page.goto(BASE + '/guide', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const empty = []
let total = 0
for (let g = 0; g < (await page.getByTestId('guide-group').count()); g += 1) {
  await page.getByTestId('guide-group').nth(g).click()
  await page.waitForTimeout(120)
  const n = await page.getByTestId('guide-row').count()
  for (let i = 0; i < n; i += 1) {
    const r = page.getByTestId('guide-row').nth(i)
    await r.getByTestId('guide-row-toggle').click()
    const parts = await r.locator('[data-testid="guide-panel"] dd').evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()))
    total += 1
    if (parts.length !== 4 || parts.some((x) => x.length < 8)) empty.push(await r.getAttribute('data-key'))
  }
}
check(`G3 사용법 안내의 모든 줄 ${total}개 — 네 칸 글이 비지 않음`, total >= 30 && empty.length === 0, empty)

/* G5 */
await page.goto(BASE + '/marketing', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const tab = page.getByTestId('mk-tab-threads').first()
await tab.hover()
await page.waitForTimeout(800)
const cb = await card.boundingBox()
const tb = await tab.boundingBox()
check('G5 마케팅 목차 칸에 마우스 → 스레드 안내 · 카드는 칸 아래(옆 칸을 가리지 않음)', (await card.getAttribute('data-key').catch(() => '')) === 'mk-threads' && !!cb && !!tb && (cb.y >= tb.y + tb.height || cb.y + cb.height <= tb.y), { cb, tb })
await shot(page, 'guide-03-mk-tab')
await page.mouse.move(5, 890)
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
// 접힌 줄(이름 링크) · 펼친 줄(큰 칸) 어느 쪽이든
const mini = page.locator('[data-testid="app-mini"][data-guide], [data-testid="app-launcher"] [data-guide]').first()
if (await mini.count()) {
  await mini.scrollIntoViewIfNeeded()
  await mini.hover()
  await page.waitForTimeout(800)
  check('G5 오늘 바로가기에 마우스 → 그 메뉴 안내', (await card.count()) === 1 && (await card.getAttribute('data-key')) === (await mini.getAttribute('data-guide')))
} else check('G5 오늘 바로가기에 안내 열쇠', false, '바로가기 줄 없음')

/* G6 */
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', hasTouch: true, isMobile: true })
const mp = await m.newPage()
mp.on('pageerror', (e) => errors.push(String(e)))
await mp.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await mp.evaluate(seedScript())
await mp.goto(BASE + '/guide', { waitUntil: 'networkidle' })
await mp.waitForTimeout(700)
await mp.getByTestId('guide-row-toggle').first().click()
await mp.waitForTimeout(250)
const over = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const small = await mp.locator('[data-testid="guide-page"] button, [data-testid="guide-page"] a').evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 40 }).map((e) => (e.textContent ?? '').trim().slice(0, 16)))
check('G6 휴대폰 390: 사용법 안내 넘침 0 · 40px 보다 작은 단추 0 · 펼친 줄에 영상 자리', over <= 0 && small.length === 0 && (await mp.getByTestId('guide-video').count()) === 1, { over, small })
if (SHOTS) await mp.screenshot({ path: `${SHOTS}/guide-04-390.png`, fullPage: true }).catch(() => {})
await mp.getByTestId('guide-group').nth(1).tap()
await mp.waitForTimeout(700)
check('G6 휴대폰에는 마우스 카드가 없음(누를 때 뜨지 않음)', (await mp.getByTestId('menu-guide-card').count()) === 0)

/* G7 출시 목록 L-5 — 이용약관 · 개인정보처리방침 초안 화면(로그인 없이 · 초안 띠 · 가격을 지어내지 않음) */
for (const doc of ['terms', 'privacy']) {
  await mp.goto(`${BASE}/${doc}`, { waitUntil: 'networkidle' })
  await mp.waitForTimeout(500)
  const lt = (await mp.getByTestId('legal-page').innerText().catch(() => '')) ?? ''
  const lo = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(`G7 /${doc} 열림(390) — 제목 · 초안 띠 · 조항 8개 이상 · 넘침 0 · 금액(원) 0`, (await mp.getByTestId('legal-page').getAttribute('data-doc')) === doc && (await mp.getByTestId('legal-draft').count()) === 1 && (await mp.getByTestId('legal-section').count()) >= 8 && lo <= 0 && !/[0-9][0-9,]*\s*원/.test(lt), { n: await mp.getByTestId('legal-section').count(), lo })
}
await mp.getByTestId('legal-other').click()
await mp.waitForTimeout(500)
check('G7 개인정보처리방침 → [이용약관 보기] 로 오감', mp.url().endsWith('/terms') && (await mp.getByTestId('legal-page').getAttribute('data-doc')) === 'terms', mp.url())
if (SHOTS) await mp.screenshot({ path: `${SHOTS}/guide-05-terms-390.png` }).catch(() => {})

check('화면 오류 0', errors.length === 0, errors.slice(0, 3))
await browser.close()
console.log(`\nguide: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
