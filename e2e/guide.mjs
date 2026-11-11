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
 *  G23 (D-598) 안내 카드 더 빨리(처음 0.25초 · 바로 옆 칸 0.08초) · 네 칸 앞 작은 아이콘 · 칸 사이 간격 — 카드 · 사용법 안내 · 휴대폰 안내 세 곳
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
// D-598 카드를 본 직후 다른 안내 칸으로 옮기면 0.08초 만에 그 카드가 뜬다 — '떠나면 닫힘' 은 안내 칸이 없는 빈 자리로 옮겨 본다
const emptySpot = () => page.evaluate(() => {
  for (const [x, y] of [[800, 500], [1000, 860], [640, 880], [1380, 520], [900, 120], [1200, 300]]) {
    const el = document.elementFromPoint(x, y)
    if (!el || !el.closest('[data-guide]')) return [x, y]
  }
  return [6, 894]
})
const moveAway = async () => { const [x, y] = await emptySpot(); await page.mouse.move(x, y) }

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
await moveAway()
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
    // 네 칸(무엇 · 왜 · 효과 · 앞으로)만 센다 — D-569 '이 화면 안에서 할 수 있는 것' 목록은 따로(G8)
    const parts = await r.locator('[data-testid="guide-what"] > dd, [data-testid="guide-why"] > dd, [data-testid="guide-effect"] > dd, [data-testid="guide-next"] > dd').evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()))
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
// '이 화면은' 안내 칸(ScreenGuide)은 메뉴 안내 카드와 다른 것 — 마우스를 올려도 카드가 뜨지 않는다
await page.goto(BASE + '/tools/content', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const sg = page.locator('[data-testid="mk-guide"]').first()
if (await sg.count()) {
  await sg.hover({ position: { x: 60, y: 14 } })
  await page.waitForTimeout(900)
  check('G5 마케팅 화면의 "이 화면은" 칸에 마우스 → 메뉴 안내 카드가 뜨지 않음(이름표가 겹치지 않음)', (await card.count()) === 0, await card.getAttribute('data-key').catch(() => ''))
} else check('G5 "이 화면은" 칸이 있음', false, '홍보 글 화면에 mk-guide 없음')
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

/* G8 — D-569 화면 안 주요 기능에도 같은 카드(위쪽 단추 · 업체 화면 탭) + 사용법 안내 화면에 모아 보기 */
// 위에서 바로가기를 보려고 내려갔다 — 맨 위로 올려 둔다(스크롤하면 카드가 닫히는 것이 맞다 — 올린 뒤에 스크롤이 끼지 않게)
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(400)
await page.mouse.move(700, 880)
const search = page.locator('header [data-guide="fn-search"]').first()
await search.hover()
await card.waitFor({ timeout: 4000 }).catch(() => {})
await page.waitForTimeout(300)
const sText = ((await card.innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
check('G8 머리줄 [찾기] 에 마우스 → 기능 안내(이름 "찾기" + 네 칸)', (await card.getAttribute('data-key').catch(() => '')) === 'fn-search' && sText.includes('찾기') && ['무엇을 하나요', '왜 있나요', '쓰면 이렇게 돼요', '앞으로'].every((x) => sText.includes(x)), sText.slice(0, 200))
await page.mouse.move(700, 880)
const arr = page.locator('[data-guide="fn-arrange"]').first()
await arr.hover()
await card.waitFor({ timeout: 4000 }).catch(() => {})
await page.waitForTimeout(300)
check('G8 [화면 꾸미기] 에 마우스 → 기능 안내', (await card.getAttribute('data-key').catch(() => '')) === 'fn-arrange')
await shot(page, 'guide-05-fn-arrange')
await arr.click()
await page.waitForTimeout(400)
check('G8 카드가 떠 있어도 누르면 화면 꾸미기 창이 열림(누름을 가로채지 않음)', (await page.getByRole('dialog').count()) >= 1 && (await card.count()) === 0)
await page.keyboard.press('Escape')
await page.goto(BASE + '/ops/clients/cli_hansol?tab=overview', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
const docsTab = page.locator('[role="tab"][data-guide="fn-client-docs"]').first()
await docsTab.hover()
await card.waitFor({ timeout: 4000 }).catch(() => {})
await page.waitForTimeout(300)
const db = await card.boundingBox()
const dtb = await docsTab.boundingBox()
const dText = ((await card.innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
check('G8 업체 화면 [서류] 탭에 마우스 → 기능 안내 · 카드는 탭 아래', (await card.getAttribute('data-key').catch(() => '')) === 'fn-client-docs' && dText.includes('서류') && !!db && !!dtb && db.y >= dtb.y + dtb.height, { db, dtb, t: dText.slice(0, 80) })
await shot(page, 'guide-06-fn-client-tab')
const tabKeys = await page.locator('[role="tablist"][aria-label="업체 상세"] [role="tab"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-guide') || ''))
check(`G8 업체 화면 탭 ${tabKeys.length}개 전부에 안내 열쇠`, tabKeys.length >= 6 && tabKeys.every((k) => k.startsWith('fn-client-')), tabKeys)
await docsTab.click()
await page.waitForTimeout(500)
check('G8 탭을 누르면 그 탭으로 감 · 카드 닫힘', page.url().includes('tab=docs') && (await card.count()) === 0, page.url())
await page.goto(BASE + '/guide', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.locator('[data-testid="guide-group"][data-group="top"]').click()
await page.waitForTimeout(300)
const topRows = await page.getByTestId('guide-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
await page.getByTestId('guide-row').first().getByTestId('guide-row-toggle').click()
const topPanel = ((await page.getByTestId('guide-panel').innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
check('G8 사용법 안내 — [어느 화면에나] 묶음: 위쪽 단추 5개 이상 · 펼치면 네 칸(화면 열기 · 영상 자리는 없음)', topRows.length >= 5 && topRows.every((k) => (k ?? '').startsWith('fn-')) && topPanel.includes('무엇을 하나요') && !topPanel.includes('이 화면 열기') && (await page.getByTestId('guide-video').count()) === 0, { topRows, p: topPanel.slice(0, 120) })
await page.goto(BASE + '/guide?m=client-ops', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const fnList = await page.getByTestId('guide-function').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
check('G8 사용법 안내 — 고객 관리 줄 아래 "이 화면 안에서 할 수 있는 것"(업체 화면 탭 6개 이상)', fnList.length >= 6 && fnList.includes('fn-client-docs') && fnList.includes('fn-client-fees'), fnList)
await shot(page, 'guide-07-functions')

/* G9 — D-573 기능 안내 넓히기: 글 쓰기 단추 · 첫마디 · 대화창 [+] · 서류 올리기에도 같은 카드 · 사용법 안내에 모임 */
check('G9 사용법 안내 — 고객 관리 줄에 [서류 올리기] · [서류 요청 문구] 도', fnList.includes('fn-docs-upload') && fnList.includes('fn-docs-request'), fnList)
async function hoverCard(path, sel, prep) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  if (prep) await prep()
  const el = page.locator(sel).first()
  if ((await page.locator(sel).count()) === 0) return 'none'
  await el.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.mouse.move(3, 3)
  await el.hover()
  await card.waitFor({ timeout: 3000 }).catch(() => {})
  return (await card.getAttribute('data-key').catch(() => '')) ?? ''
}
const kWrite = await hoverCard('/marketing/threads', '[data-guide="fn-mk-write"]')
const writeText = ((await card.innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
await shot(page, 'guide-08-fn-write')
const kFirst = await hoverCard('/marketing/threads', '[data-guide="fn-mk-firstline"]')
const kScript = await hoverCard('/marketing/shorts', '[data-guide="fn-mk-script"]')
check('G9 스레드 [AI로 완성 글 쓰기] · [첫마디 10개 먼저 보기] · 릴스 [AI로 완성 대본 쓰기] 에 마우스 → 기능 안내(어려운 말 0)', kWrite === 'fn-mk-write' && kFirst === 'fn-mk-firstline' && kScript === 'fn-mk-script' && !/롱폼|썸네일|벤치마킹|캡션|해시태그|포맷|훅/.test(writeText), { kWrite, kFirst, kScript })
const kPlus = await hoverCard('/', '[data-guide="fn-ask-plus"]', async () => {
  await page.getByTestId('home-ask').click().catch(() => {})
  await page.waitForTimeout(300)
})
check('G9 오늘 대화창 [+] 에 마우스 → 기능 안내', kPlus === 'fn-ask-plus', kPlus)
await page.locator('[data-guide="fn-ask-plus"]').first().click()
await page.waitForTimeout(300)
check('G9 [+] 를 누르면 고르기 판이 열림 · 카드 닫힘(누름을 가로채지 않음)', (await page.getByTestId('home-ask-menu').count()) === 1 && (await card.count()) === 0)
await page.keyboard.press('Escape')
await page.goto(BASE + '/guide?m=mk-threads', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const mkFn = await page.getByTestId('guide-function').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
check('G9 사용법 안내 — 스레드 줄 아래에 글 쓰기 기능 2개', mkFn.includes('fn-mk-write') && mkFn.includes('fn-mk-firstline'), mkFn)
/* G10 — D-576 영업 관리 탭 · AI 도우미 · 오늘 [오늘 정리하기] 에도 기능 안내 */
const kTab = await hoverCard('/sales/board', '[data-guide="fn-sales-tab-meeting"]')
const tabKeys2 = await page.locator('[data-testid="sales-tabs"] a').evaluateAll((els) => els.map((e) => e.getAttribute('data-guide') || ''))
check('G10 영업 관리 탭 4개 전부 안내 열쇠 · [미팅 준비] 에 마우스 → 기능 안내', kTab === 'fn-sales-tab-meeting' && tabKeys2.length === 4 && tabKeys2.every((k) => k.startsWith('fn-sales-tab-')), { kTab, tabKeys2 })
const kWrap = await hoverCard('/', '[data-guide="fn-today-wrap"]')
check('G10 오늘 [오늘 정리하기] 에 마우스 → 기능 안내', kWrap === 'fn-today-wrap', kWrap)

/* G11 — D-580 마우스 안내 카드 켜기 · 끄기(설정 › 계정 · 보기 · 기본 켬 · 꺼도 사용법 안내 화면에는 그대로) */
const ghOption = (v) => page.locator(`[data-testid="settings-guide-hover-option"][data-value="${v}"]`)
await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
const ghDefault = await ghOption('on').getAttribute('aria-checked').catch(() => '')
await ghOption('off').click()
await page.waitForTimeout(200)
const ghOffChecked = await ghOption('off').getAttribute('aria-checked')
if (SHOTS) await page.getByTestId('settings-guide-hover').screenshot({ path: `${SHOTS}/guide-09-hover-toggle.png` }).catch(() => {})
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.mouse.move(3, 3)
await page.locator('aside [data-guide="calendar"]').first().hover()
await page.waitForTimeout(1300)
const ghOffMenu = await card.count()
await page.locator('[data-guide="fn-today-wrap"]').first().scrollIntoViewIfNeeded()
await page.mouse.move(3, 3)
await page.locator('[data-guide="fn-today-wrap"]').first().hover()
await page.waitForTimeout(1300)
const ghOffFn = await card.count()
await page.goto(BASE + '/guide', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const ghGuideRows = await page.getByTestId('guide-row-toggle').count()
await page.reload({ waitUntil: 'networkidle' })
await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const ghKept = await ghOption('off').getAttribute('aria-checked')
await ghOption('on').click()
await page.waitForTimeout(200)
const kBack = await hoverCard('/', '[data-guide="fn-today-wrap"]')
check('G11 설정 › 마우스 안내 카드: 기본 켜기 → [끄기] → 메뉴 · 단추에 올려도 카드 0 · 사용법 안내 화면 글은 그대로 · 새로 고쳐도 끈 채 → [켜기] → 다시 뜸', ghDefault === 'true' && ghOffChecked === 'true' && ghOffMenu === 0 && ghOffFn === 0 && ghGuideRows >= 3 && ghKept === 'true' && kBack === 'fn-today-wrap', { ghDefault, ghOffChecked, ghOffMenu, ghOffFn, ghGuideRows, ghKept, kBack })

/* G12 — 마케팅 남은 화면(기초 7가지 · 내 콘텐츠 · 남의 인기 영상)에도 기능 안내 · 사용법 안내 화면에 모임 */
const kRead = await hoverCard('/marketing/basics', '[data-guide="fn-mk-basic-read"]')
const readText = ((await card.innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
const kStages = await hoverCard('/marketing/youtube?view=make', '[data-guide="fn-mk-stages"]', async () => {
  const fold = page.getByTestId('mk-make-long')
  if ((await fold.getAttribute('data-open').catch(() => '')) === '0') await fold.getByTestId('fold-toggle').first().click()
  await page.waitForTimeout(300)
})
const stagesText = ((await card.innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
const kLook = await hoverCard('/marketing/youtube?view=top', '[data-guide="fn-mk-look"]')
await page.goto(BASE + '/guide?m=mk-make', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const mkFn2 = await page.getByTestId('guide-function').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
check('G12 기초 7가지 [읽었어요] · 내 콘텐츠 단계 숫자판 · 남의 인기 영상 탭에 마우스 → 기능 안내(어려운 말 0) · 사용법 안내 내 콘텐츠 줄 아래 2개', kRead === 'fn-mk-basic-read' && kStages === 'fn-mk-stages' && kLook === 'fn-mk-look' && mkFn2.includes('fn-mk-stages') && mkFn2.includes('fn-mk-add') && !/롱폼|썸네일|벤치마킹|캡션|해시태그|포맷|훅/.test(readText + stagesText), { kRead, kStages, kLook, mkFn2 })

/* G13 — D-583 올리는 법(스레드 · 릴스/틱톡/쇼츠 · 기초 7가지 아래) — 접힌 한 줄 → 채널별 걸음 */
const howto = async (path, id) => {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const box = page.getByTestId(id)
  const closed = (await box.count()) === 1 && !(await box.evaluate((e) => e.open))
  await page.getByTestId(`${id}-toggle`).scrollIntoViewIfNeeded()
  await page.getByTestId(`${id}-toggle`).click()
  await page.waitForTimeout(200)
  return { box, closed }
}
const hThr = await howto('/marketing/threads', 'thr-howto')
const thrSteps = await page.getByTestId('thr-howto-step').allInnerTexts()
const hSht = await howto('/marketing/shorts', 'sht-howto')
const shtTabs = await page.getByTestId('sht-howto-tab').allInnerTexts()
await page.locator('[data-testid="sht-howto-tab"][data-key="tiktok"]').click()
await page.waitForTimeout(150)
const tikSteps = await page.getByTestId('sht-howto-step').allInnerTexts()
const hBas = await howto('/marketing/basics', 'mk-basics-howto')
const basTabs = await page.getByTestId('mk-basics-howto-tab').allInnerTexts()
await page.locator('[data-testid="mk-basics-howto-tab"][data-key="youtube"]').click()
await page.waitForTimeout(150)
const ytSteps = await page.getByTestId('mk-basics-howto-step').allInnerTexts()
const howText = [...thrSteps, ...tikSteps, ...ytSteps, await hBas.box.innerText()].join(' ')
check(
  'G13 올리는 법: 세 화면 모두 처음엔 접힘 → 스레드 5걸음([게시] · [올렸어요]) · 릴스/틱톡/쇼츠 탭 3 → 틱톡 4걸음([업로드]) · 기초 화면 탭 5 → 유튜브 긴 영상([게시 완료]) · 어려운 말 0',
  hThr.closed && hSht.closed && hBas.closed && thrSteps.length === 5 && thrSteps.join(' ').includes('[게시]') && thrSteps[4].includes('[올렸어요]') && shtTabs.length === 3 && tikSteps.length === 4 && tikSteps.join(' ').includes('[업로드]') && basTabs.length === 5 && ytSteps.join(' ').includes('[게시 완료]') && !/롱폼|썸네일|벤치마킹|캡션|해시태그|포맷|훅/.test(howText),
  { closed: [hThr.closed, hSht.closed, hBas.closed], thr: thrSteps.length, shtTabs, tik: tikSteps.length, basTabs },
)
await shot(page, 'guide-09-howto')

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

/* G13 휴대폰 — 올리는 법 펼침 */
await mp.goto(BASE + '/marketing/shorts', { waitUntil: 'networkidle' })
await mp.waitForTimeout(700)
await mp.getByTestId('sht-howto-toggle').scrollIntoViewIfNeeded()
await mp.getByTestId('sht-howto-toggle').click()
await mp.waitForTimeout(250)
const howOver = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const howSmall = await mp.locator('[data-testid="sht-howto"] summary, [data-testid="sht-howto"] button').evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 40 }).map((e) => (e.textContent ?? '').trim().slice(0, 12)))
const howFont = await mp.locator('[data-testid="sht-howto"] *').evaluateAll((els) => Math.min(...els.filter((e) => [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize))))
check('G13 휴대폰 390: 올리는 법 펼침 — 옆 넘침 0 · 40px 보다 작은 단추 0 · 글자 15px 이상', howOver <= 0 && howSmall.length === 0 && howFont >= 15, { howOver, howSmall, howFont })
if (SHOTS) await mp.screenshot({ path: `${SHOTS}/guide-10-howto-390.png`, fullPage: true }).catch(() => {})

/* G14 휴대폰 '이 화면 안내'(D-586) — 머리줄 화면 이름을 누르면 그 화면 안내 창 */
await mp.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
await mp.waitForTimeout(700)
const titleBtn = mp.getByTestId('screen-title-guide')
const titleBox = await titleBtn.boundingBox()
const hdrOver = await mp.locator('header').first().evaluate((el) => el.scrollWidth - el.clientWidth)
await titleBtn.tap()
await mp.waitForFunction(() => document.querySelector('[data-testid="screen-guide"]'), null, { timeout: 8000 }).catch(() => {})
const scrG = mp.getByTestId('screen-guide')
const scrText = ((await scrG.innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
const scrFns = await mp.getByTestId('screen-guide-function').count()
const scrOver = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const scrSmall = await mp.locator('[role="dialog"] button, [role="dialog"] a').evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 40 }).map((e) => (e.textContent ?? e.getAttribute('aria-label') ?? '').trim().slice(0, 16)))
check(
  'G14 휴대폰: 머리줄 화면 이름(44px 이상 · 머리줄 넘침 0)을 누르면 "이 화면 안내" — 고객 관리 · 네 칸 · 이 화면 안 기능 6개 이상 · 옆 넘침 0 · 40px 보다 작은 단추 0',
  !!titleBox && titleBox.height >= 44 && hdrOver <= 1 && (await scrG.getAttribute('data-key')) === 'client-ops' && scrText.includes('고객 관리') && ['무엇을 하나요', '왜 있나요', '쓰면 이렇게 돼요', '앞으로'].every((w) => scrText.includes(w)) && scrFns >= 6 && scrOver <= 0 && scrSmall.length === 0,
  { h: titleBox?.height, hdrOver, key: await scrG.getAttribute('data-key').catch(() => null), scrFns, scrOver, scrSmall, t: scrText.slice(0, 120) },
)
if (SHOTS) await mp.screenshot({ path: `${SHOTS}/guide-11-screen-guide-390.png` }).catch(() => {})
await mp.getByTestId('screen-guide-more').tap()
await mp.waitForTimeout(700)
check('G14 [사용법 안내에서 더 보기] → 사용법 안내 화면 · 고객 관리 줄이 펼쳐진 채 · 창은 닫힘', mp.url().includes('/guide?m=client-ops') && (await mp.locator('[data-testid="guide-row"][data-key="client-ops"]').getAttribute('data-open')) === '1' && (await mp.getByTestId('screen-guide').count()) === 0, mp.url())
// 마케팅 안 화면은 그 화면 안내(스레드) · 닫기 → 화면 그대로
await mp.goto(BASE + '/marketing/threads', { waitUntil: 'networkidle' })
await mp.waitForTimeout(700)
await mp.getByTestId('screen-title-guide').tap()
await mp.waitForFunction(() => document.querySelector('[data-testid="screen-guide"]'), null, { timeout: 8000 }).catch(() => {})
const thrKey = await mp.getByTestId('screen-guide').getAttribute('data-key').catch(() => null)
const thrLabel = ((await mp.getByTestId('screen-guide-label').innerText().catch(() => '')) ?? '').trim()
const thrGuide = ((await mp.getByTestId('screen-guide').innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
await mp.locator('[role="dialog"] button[aria-label="닫기"]').tap()
await mp.waitForTimeout(300)
check('G14 스레드 화면에서는 스레드 안내(어려운 말 0) · 닫으면 화면 그대로', thrKey === 'mk-threads' && thrLabel === '스레드' && !/롱폼|썸네일|벤치마킹|캡션|해시태그|포맷/.test(thrGuide) && (await mp.getByTestId('screen-guide').count()) === 0 && mp.url().endsWith('/marketing/threads'), { thrKey, thrLabel })

/* G15 홈 화면에 넣는 법(D-587) — 사용법 안내 화면 접힌 한 줄 · 기기 탭 · 매니페스트 · 아이콘 */
await mp.goto(BASE + '/guide', { waitUntil: 'networkidle' })
await mp.waitForTimeout(700)
const hh = mp.getByTestId('home-howto')
const hhClosed = (await hh.count()) === 1 && !(await hh.evaluate((el) => el.open))
await mp.getByTestId('home-howto-toggle').scrollIntoViewIfNeeded()
await mp.getByTestId('home-howto-toggle').tap()
await mp.waitForTimeout(250)
const hhTabs = await mp.getByTestId('home-howto-tab').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
await mp.locator('[data-testid="home-howto-tab"][data-key="iphone"]').tap()
await mp.waitForTimeout(150)
const hhIphone = await mp.getByTestId('home-howto-step').allInnerTexts()
await mp.locator('[data-testid="home-howto-tab"][data-key="android"]').tap()
await mp.waitForTimeout(150)
const hhAndroid = await mp.getByTestId('home-howto-step').allInnerTexts()
const hhOver = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const hhSmall = await mp.locator('[data-testid="home-howto"] summary, [data-testid="home-howto"] button').evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 40 }).length)
check(
  'G15 사용법 안내 › 홈 화면에 넣는 법: 처음엔 접힘 → 탭 3(아이폰 · 갤럭시 · PC) · 아이폰 4걸음([공유] · [홈 화면에 추가]) · 갤럭시 4걸음 · 390 넘침 0 · 40px 보다 작은 단추 0',
  hhClosed && hhTabs.join() === 'iphone,android,pc' && hhIphone.length === 4 && hhIphone.join(' ').includes('[공유]') && hhIphone.join(' ').includes('[홈 화면에 추가]') && hhAndroid.length === 4 && hhAndroid.join(' ').includes('[홈 화면에 추가]') && hhOver <= 0 && hhSmall === 0,
  { hhClosed, hhTabs, i: hhIphone.length, a: hhAndroid.length, hhOver, hhSmall },
)
if (SHOTS) await mp.screenshot({ path: `${SHOTS}/guide-12-home-howto-390.png`, fullPage: true }).catch(() => {})
const pwa = await mp.evaluate(async () => {
  const link = document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? ''
  const apple = document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') ?? ''
  const m = link ? await fetch(link).then((r) => r.json()).catch(() => null) : null
  const types = []
  for (const src of [apple, ...(m?.icons ?? []).map((i) => i.src)]) types.push(await fetch(src).then((r) => (r.ok ? (r.headers.get('content-type') ?? '') : `HTTP ${r.status}`)).catch(() => 'ERR'))
  return { link, apple, display: m?.display, start: m?.start_url, icons: (m?.icons ?? []).length, types }
})
check('G15 매니페스트 · 아이콘이 실제로 내려옴 — display browser · 시작 주소 / · 아이콘 3 · 전부 image/png', pwa.link === '/manifest.webmanifest' && pwa.apple === '/apple-touch-icon.png' && pwa.display === 'browser' && pwa.start === '/' && pwa.icons === 3 && pwa.types.length === 4 && pwa.types.every((t) => t.startsWith('image/png')), pwa)

/* G16 프로필 소개 글 만들기(D-588) — 기초 7가지 화면 접힌 한 줄 · 칸 채우기 · 채널 탭 · 글자 수 · 복사 */
await mp.goto(BASE + '/marketing/basics', { waitUntil: 'networkidle' })
await mp.waitForTimeout(700)
const bio = mp.getByTestId('mk-bio')
const bioClosed = (await bio.count()) === 1 && !(await bio.evaluate((el) => el.open))
await mp.getByTestId('mk-bio-toggle').scrollIntoViewIfNeeded()
await mp.getByTestId('mk-bio-toggle').tap()
await mp.waitForTimeout(250)
const bioBlank0 = ((await mp.getByTestId('mk-bio-blanks').innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
const bioEmptyText = (await mp.getByTestId('mk-bio-text').allInnerTexts()).join('\n')
const fillBio = async (key, v) => {
  await mp.locator(`[data-testid="mk-bio-input"][data-key="${key}"]`).fill(v)
}
await fillBio('name', '박 컨설턴트')
await fillBio('field', '정책자금 컨설팅')
await fillBio('helps', '정책자금 · 고용지원금 · 기업부설연구소')
await fillBio('audience', '제조업 중소기업 대표')
await fillBio('contact', '문의는 프로필 링크로')
await mp.waitForTimeout(200)
const bioTexts = await mp.getByTestId('mk-bio-text').allInnerTexts()
const bioCounts = await mp.getByTestId('mk-bio-count').allInnerTexts()
check(
  'G16 기초 7가지 › 프로필 소개 글: 처음엔 접힘 → 빈 칸은 [대괄호] · 어느 칸을 채울지 한 줄 → 다섯 칸 채우면 초안 3개(이름 · 연락 받는 길 · [대괄호] 0) · 글자 수 n / 150자 · 빈 칸 안내 사라짐',
  bioClosed && bioBlank0.includes('이름 · 회사') && bioEmptyText.includes('[이름]') && bioTexts.length === 3 && bioTexts.every((t) => t.includes('박 컨설턴트') && t.includes('문의는 프로필 링크로') && !t.includes('[')) && bioCounts.length === 3 && bioCounts.every((c) => /^\d+ \/ 150자$/.test(c.trim())) && (await mp.getByTestId('mk-bio-blanks').count()) === 0,
  { bioClosed, bioBlank0: bioBlank0.slice(0, 80), bioTexts: bioTexts.map((t) => t.slice(0, 40)), bioCounts },
)
await mp.locator('[data-testid="mk-bio-tab"][data-key="tiktok"]').tap()
await mp.waitForTimeout(150)
const tikCounts = (await mp.getByTestId('mk-bio-count').allInnerTexts()).map((c) => Number(c.trim().split(' ')[0]))
await mp.locator('[data-testid="mk-bio-tab"][data-key="youtube"]').tap()
await mp.waitForTimeout(150)
const ytFirst = ((await mp.getByTestId('mk-bio-text').first().innerText()) ?? '').trim()
await mp.getByTestId('mk-bio-copy').first().tap()
await mp.waitForTimeout(300)
const copyLabel = ((await mp.getByTestId('mk-bio-copy').first().innerText()) ?? '').trim()
// 부풀리는 말을 적으면 빨갛게 알려 준다
await fillBio('fact', '상담 250건 이상')
await mp.waitForTimeout(200)
const bioWarn = ((await mp.getByTestId('mk-bio-warns').innerText().catch(() => '')) ?? '').trim()
const bioOver = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const bioSmall = await mp.locator('[data-testid="mk-bio"] summary, [data-testid="mk-bio"] button, [data-testid="mk-bio"] input').evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 40 }).length)
const bioFont = await mp.locator('[data-testid="mk-bio"] *').evaluateAll((els) => Math.min(...els.filter((e) => [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize))))
check(
  'G16 틱톡 탭은 80자 안 · 유튜브 탭 첫 줄 "…를 위한 … 채널입니다." · [복사] 누르면 "복사했어요" · 부풀리는 말(250건 이상)은 빨갛게 · 390 넘침 0 · 40px 보다 작은 칸 0 · 글자 15px 이상',
  tikCounts.length === 3 && tikCounts.every((n) => n > 0 && n <= 80) && ytFirst.startsWith('제조업 중소기업 대표를 위한 정책자금 컨설팅 채널입니다.') && copyLabel.includes('복사했어요') && bioWarn.length > 0 && bioOver <= 0 && bioSmall === 0 && bioFont >= 15,
  { tikCounts, ytFirst: ytFirst.slice(0, 50), copyLabel, bioWarn: bioWarn.slice(0, 60), bioOver, bioSmall, bioFont },
)
if (SHOTS) await mp.screenshot({ path: `${SHOTS}/guide-13-bio-390.png`, fullPage: true }).catch(() => {})

/* G17 바로 보이는 첫 화면(D-589) — 스크립트를 받기 전에도 로고 · 불러오는 중 · 앱이 뜨면 사라짐 */
{
  const nojs = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', javaScriptEnabled: false })
  const np = await nojs.newPage()
  await np.goto(BASE + '/', { waitUntil: 'load' })
  const splash = np.getByTestId('boot-splash')
  const splashText = ((await splash.innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
  const splashBox = await splash.boundingBox()
  const markBox = await np.locator('.boot-mark').boundingBox()
  const msgFont = await np.locator('.boot-msg').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  const slowHidden = await np.locator('#boot-slow').evaluate((el) => el.hidden)
  check(
    'G17 스크립트 없이 연 첫 화면(390): 가운데 로고 · 제품 이름 · "불러오는 중…"(16px) · 화면을 꽉 채움 · 느릴 때 안내 줄은 처음엔 숨김',
    splashText.includes('MIRAE AI LAB OS') && splashText.includes('불러오는 중') && !!splashBox && splashBox.height >= 800 && !!markBox && Math.abs(markBox.x + markBox.width / 2 - (splashBox.x + splashBox.width / 2)) <= 2 && msgFont >= 16 && slowHidden === true,
    { splashText, h: splashBox?.height, mark: markBox, msgFont, slowHidden },
  )
  if (SHOTS) await np.screenshot({ path: `${SHOTS}/guide-14-boot-splash-390.png` }).catch(() => {})
  await nojs.close()
  await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
  await mp.waitForTimeout(500)
  check('G17 앱이 뜨면 첫 화면은 사라짐(남아 있지 않음) · 느릴 때 안내 줄도 없음', (await mp.getByTestId('boot-splash').count()) === 0 && (await mp.locator('#boot-slow').count()) === 0 && (await mp.locator('header').count()) >= 1)
}

/* G18 찾기에서 화면 · 기능 이름으로도(D-592) — 메뉴 이름 · 화면 안 기능 이름 → 그 화면으로 · 붙여 써도 · 휴대폰에서도 */
{
  const sp = await ctx.newPage()
  sp.on('pageerror', (e) => errors.push(String(e)))
  await sp.goto(BASE + '/', { waitUntil: 'networkidle' })
  await sp.waitForTimeout(600)
  await sp.keyboard.press('Control+k')
  const box = sp.getByPlaceholder('업체 · 대표 · 전화번호 뒷자리 · 화면 이름')
  await box.waitFor({ timeout: 5000 })
  const dlg = sp.getByRole('dialog', { name: '빠른 이동 검색' })
  const ask = async (q) => {
    await box.fill(q)
    await sp.waitForTimeout(450)
    return { groups: await sp.getByTestId('search-group').allInnerTexts(), text: (await dlg.innerText().catch(() => '')) ?? '' }
  }
  const a1 = await ask('스레드')
  check('G18 찾기 "스레드" → [화면 · 기능] 묶음 · 첫 줄 스레드 화면(무엇을 하는 곳인지 한 줄) · 화면 안 기능(올리는 법)도', a1.groups.includes('화면 · 기능') && /화면 · 기능\s+스레드\s+스레드\(짧은 글/.test(a1.text) && a1.text.includes("'스레드' 화면 안"), a1.text.slice(0, 260))
  if (SHOTS) await sp.screenshot({ path: `${SHOTS}/guide-18-search.png` }).catch(() => {})
  const a2 = await ask('프로필소개')
  const a3 = await ask('엑셀')
  const a4 = await ask('홈 화면')
  check(
    'G18 찾기 — 붙여 쓴 "프로필소개" → 프로필 소개 글 만들기(기초 7가지 화면 안) · "엑셀" → 여러 업체 등록(고객 관리 화면 안) · "홈 화면" → 넣는 법(사용법 안내 화면 안)',
    a2.text.includes('프로필 소개 글 만들기') && a2.text.includes("'고객 모으기 기초 7가지' 화면 안") && a3.text.includes('엑셀 목록 붙여넣기') && a3.text.includes("'고객 관리' 화면 안") && a4.text.includes('휴대폰 홈 화면에 넣는 법') && a4.text.includes("'사용법 안내' 화면 안"),
    [a2.text, a3.text, a4.text].map((t) => t.slice(0, 120)).join(' ## '),
  )
  const a5 = await ask('부채비율')
  const a6 = await ask('없는말없는말')
  const a7 = await ask('글')
  check('G18 찾기 — 예전 길 그대로("부채비율" → 전문 모듈 크레탑 분석기) · 없는 말은 "일치하는 항목이 없습니다" · 한 글자는 화면 · 기능을 찾지 않음', a5.text.includes('크레탑 분석기') && a6.text.includes('일치하는 항목이 없습니다') && !a7.groups.includes('화면 · 기능'), [a5.text, a6.text, a7.groups.join()].map((t) => t.slice(0, 100)).join(' ## '))
  await box.fill('프로필 소개')
  await sp.waitForTimeout(450)
  await sp.keyboard.press('Enter')
  await sp.waitForTimeout(900)
  check('G18 찾기 — Enter 한 번에 그 화면으로(/marketing/basics) · 창 닫힘 · 프로필 소개 글 만들기 줄이 있음', new URL(sp.url()).pathname === '/marketing/basics' && (await dlg.count()) === 0 && (await sp.getByTestId('mk-bio').count()) === 1, sp.url())
  await sp.close()
  // 휴대폰(390) — 머리줄 [찾기] → 같은 묶음 · 누르면 그 화면 · 옆 넘침 0
  await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
  await mp.waitForTimeout(500)
  await mp.getByRole('button', { name: /^찾기|찾기$/ }).filter({ visible: true }).first().click()
  const mbox = mp.getByPlaceholder('업체 · 대표 · 전화번호 뒷자리 · 화면 이름')
  await mbox.waitFor({ timeout: 5000 })
  await mbox.fill('일정')
  await mp.waitForTimeout(450)
  const mg = await mp.getByTestId('search-group').allInnerTexts()
  const mo = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  await mp.getByRole('dialog', { name: '빠른 이동 검색' }).getByRole('button', { name: /^일정/ }).first().click()
  await mp.waitForTimeout(800)
  check('G18 휴대폰(390) 찾기 "일정" → [화면 · 기능] · 누르면 일정 화면(/ops/calendar) · 옆 넘침 0', mg.includes('화면 · 기능') && new URL(mp.url()).pathname === '/ops/calendar' && mo <= 1, `${mg.join()} ${mp.url()} over=${mo}`)
}

/* G19 새로 생긴 것(D-593) — 사용법 안내 화면의 접힌 한 줄 → 최근 것부터 한 줄씩 · 누르면 그 화면 · 390 */
{
  await mp.goto(BASE + '/guide', { waitUntil: 'networkidle' })
  await mp.waitForTimeout(600)
  const wn = mp.getByTestId('whats-new')
  const folded = (await wn.count()) === 1 && !(await wn.evaluate((d) => d.open))
  const sum = ((await mp.getByTestId('whats-new-toggle').innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ')
  await mp.getByTestId('whats-new-toggle').click()
  await mp.waitForTimeout(300)
  const items = await mp.getByTestId('whats-new-item').count()
  const first = ((await mp.getByTestId('whats-new-item').first().innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ')
  const m = await mp.evaluate(() => {
    const box = document.querySelector('[data-testid="whats-new"]')
    const els = [...box.querySelectorAll('p, a, span, summary')]
    return {
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      small: [...box.querySelectorAll('a, summary')].filter((e) => e.getBoundingClientRect().height < 40).length,
      minFont: Math.min(...els.map((e) => parseFloat(getComputedStyle(e).fontSize))),
      text: box.innerText,
    }
  })
  check(
    'G19 사용법 안내 › 새로 생긴 것(390): 처음엔 접힌 한 줄("최근 n가지") → 펼치면 5~10줄 · 줄마다 날짜(n월 n일) · 이렇게 써 보세요 · 옆 넘침 0 · 40px 보다 작은 칸 0 · 글자 14px 이상 · 모듈 · 판정 · 예상 금액 0',
    folded && /새로 생긴 것 — 최근 \d+가지/.test(sum) && items >= 5 && items <= 10 && /\d+월 \d+일/.test(first) && m.over <= 1 && m.small === 0 && m.minFont >= 14 && !/모듈|판정|예상 금액/.test(m.text),
    JSON.stringify({ folded, sum, items, first: first.slice(0, 80), over: m.over, small: m.small, minFont: m.minFont }),
  )
  if (SHOTS) await mp.screenshot({ path: `${SHOTS}/guide-19-whatsnew-390.png` }).catch(() => {})
  const bulkGo = mp.locator('[data-testid="whats-new-item"][data-key="bulk-email-address"]').getByTestId('whats-new-go')
  const goText = ((await bulkGo.innerText().catch(() => '')) ?? '').trim()
  await bulkGo.click()
  await mp.waitForTimeout(1200)
  check('G19 새로 생긴 것 › [엑셀 목록 넣어 보기] → 고객 관리의 붙여넣는 창이 바로 열림(?bulk=1)', goText.includes('엑셀 목록 넣어 보기') && new URL(mp.url()).pathname === '/ops/clients' && (await mp.getByTestId('bulk-paste-text').count()) === 1, `${goText} ${mp.url()}`)
  await mp.keyboard.press('Escape').catch(() => {})
  // PC — 접힌 줄에 마우스 → 기능 안내 카드
  const wp = await ctx.newPage()
  wp.on('pageerror', (e) => errors.push(String(e)))
  await wp.goto(BASE + '/guide', { waitUntil: 'networkidle' })
  await wp.waitForTimeout(600)
  await wp.getByTestId('whats-new-toggle').hover()
  await wp.waitForTimeout(900)
  const wcard = wp.getByTestId('menu-guide-card')
  check('G19 PC: [새로 생긴 것] 줄에 마우스 → 기능 안내 카드(fn-whats-new) · [홈 화면에 넣는 법] 줄도(fn-home-howto)', (await wcard.getAttribute('data-key').catch(() => '')) === 'fn-whats-new' && (await wp.getByTestId('home-howto-toggle').getAttribute('data-guide')) === 'fn-home-howto', await wcard.getAttribute('data-key').catch(() => ''))
  await wp.close()
}

/* G20 카카오톡 안에서 열렸을 때(D-594) — '홈 화면에 넣는 법' 안에 '먼저 다른 브라우저로' · 평소 브라우저에서는 없음 */
{
  const KAKAO_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5'
  const kc = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', hasTouch: true, isMobile: true, userAgent: KAKAO_UA })
  const kp = await kc.newPage()
  kp.on('pageerror', (e) => errors.push(String(e)))
  await kp.goto(BASE + '/guide', { waitUntil: 'networkidle' })
  await kp.waitForTimeout(600)
  await kp.getByTestId('home-howto-toggle').click()
  await kp.waitForTimeout(300)
  const note = kp.getByTestId('home-howto-inapp')
  const nt = ((await note.innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ')
  const openHref = (await kp.getByTestId('home-howto-inapp-open').getAttribute('href').catch(() => '')) ?? ''
  const km = await kp.evaluate(() => {
    const box = document.querySelector('[data-testid="home-howto-inapp"]')
    return {
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      small: [...box.querySelectorAll('a, button')].filter((e) => e.getBoundingClientRect().height < 40).length,
      minFont: Math.min(...[...box.querySelectorAll('p, a, button, span')].map((e) => parseFloat(getComputedStyle(e).fontSize))),
    }
  })
  check(
    'G20 카카오톡 안(390) › 홈 화면에 넣는 법: "지금 카카오톡 안에서 열렸어요" · 여기서는 넣을 수 없다는 한 줄 · [다른 브라우저로 열기] = 카카오톡이 주는 길(지금 주소 그대로) · [주소 복사] · 옆 넘침 0 · 40px 보다 작은 칸 0 · 글자 15px 이상',
    (await note.getAttribute('data-kind').catch(() => '')) === 'kakaotalk' && nt.includes('카카오톡 안') && nt.includes('홈 화면에 넣을 수 없어요') && openHref === `kakaotalk://web/openExternal?url=${encodeURIComponent(BASE + '/guide')}` && (await kp.getByTestId('home-howto-inapp-copy').count()) === 1 && km.over <= 1 && km.small === 0 && km.minFont >= 15,
    JSON.stringify({ nt: nt.slice(0, 120), openHref, ...km }),
  )
  if (SHOTS) await kp.screenshot({ path: `${SHOTS}/guide-20-inapp-390.png` }).catch(() => {})
  await kc.close()
  // 평소 브라우저(이 시험의 휴대폰 화면) — 안내가 없다
  await mp.goto(BASE + '/guide', { waitUntil: 'networkidle' })
  await mp.waitForTimeout(500)
  await mp.getByTestId('home-howto-toggle').click()
  await mp.waitForTimeout(300)
  check('G20 평소 브라우저에서는 앱 안 안내가 없음(넣는 법만)', (await mp.getByTestId('home-howto-inapp').count()) === 0 && (await mp.getByTestId('home-howto-tabs').count()) === 1)
}

/* G21 링크 미리보기 그림(D-595) — 주소를 카카오톡 · 문자로 보냈을 때 카드에 뜨는 그림이 실제로 내려온다 */
{
  const og = await mp.evaluate(async () => {
    const meta = (p) => document.querySelector(`meta[property="${p}"]`)?.getAttribute('content') ?? ''
    const r = await fetch('/og-image.png')
    const buf = new Uint8Array(await r.arrayBuffer())
    const dv = new DataView(buf.buffer)
    return { status: r.status, type: r.headers.get('content-type') ?? '', bytes: buf.length, w: buf.length > 24 ? dv.getUint32(16) : 0, h: buf.length > 24 ? dv.getUint32(20) : 0, image: meta('og:image'), title: meta('og:title'), desc: meta('og:description') }
  })
  check(
    'G21 링크 미리보기: 머리 글에 그림 주소(https · /og-image.png) · 제목 · 설명 · /og-image.png 가 그림으로 내려옴(200 · image/png · 1200×630 · 300KB 아래)',
    og.status === 200 && og.type.includes('image/png') && og.w === 1200 && og.h === 630 && og.bytes < 300_000 && /^https:\/\/.+\/og-image\.png$/.test(og.image) && og.title.length > 3 && og.desc.length > 10,
    JSON.stringify(og),
  )
}

/* G22 연락 받는 길 만드는 법(D-596) — 기초 7가지 화면 아래 접힌 한 줄 → 길 고르기 → 걸음 → [소개 글에 이 줄 넣기] → 프로필 소개 글 칸에 들어감 */
{
  await mp.goto(BASE + '/marketing/basics', { waitUntil: 'networkidle' })
  await mp.waitForTimeout(600)
  const box = mp.getByTestId('mk-contact')
  const folded = (await box.count()) === 1 && !(await box.evaluate((d) => d.open))
  await mp.getByTestId('mk-contact-toggle').click()
  await mp.waitForTimeout(300)
  const tabs = await mp.getByTestId('mk-contact-tab').allInnerTexts()
  const steps1 = await mp.getByTestId('mk-contact-step').count()
  const line1 = ((await mp.getByTestId('mk-contact-bio-line').innerText().catch(() => '')) ?? '').trim()
  await mp.locator('[data-testid="mk-contact-tab"][data-key="phone"]').click()
  await mp.waitForTimeout(200)
  const steps3 = await mp.getByTestId('mk-contact-step').count()
  const line3 = ((await mp.getByTestId('mk-contact-bio-line').innerText().catch(() => '')) ?? '').trim()
  const cm = await mp.evaluate(() => {
    const el = document.querySelector('[data-testid="mk-contact"]')
    return {
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      small: [...el.querySelectorAll('a, button, summary')].filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 40 && e.tagName !== 'A' }).length,
      minFont: Math.min(...[...el.querySelectorAll('p, span, button, a, summary')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => parseFloat(getComputedStyle(e).fontSize))),
      lead: el.querySelector('[data-testid="mk-contact-lead"]')?.getAttribute('href') ?? '',
    }
  })
  check(
    'G22 기초 7가지 › 연락 받는 길 만드는 법(390): 처음엔 접힘 → 길 셋(카카오톡 오픈채팅 · 카카오톡 채널 · 전화 · 문자) · 오픈채팅 5걸음 · 프로필에 적을 한 줄 · 전화 탭은 3걸음 · 채울 곳은 [대괄호] · 잠재고객으로 적는 길 · 옆 넘침 0 · 작은 단추 0 · 글자 15px 이상',
    folded && tabs.join('|') === '카카오톡 오픈채팅|카카오톡 채널|전화 · 문자' && steps1 === 5 && line1.startsWith('문의는 프로필 링크') && steps3 === 3 && line3.includes('[전화번호]') && cm.lead === '/sales/board?new=1&from=content' && cm.over <= 1 && cm.small === 0 && cm.minFont >= 15,
    JSON.stringify({ folded, tabs, steps1, line1, steps3, line3, ...cm }),
  )
  if (SHOTS) await mp.screenshot({ path: `${SHOTS}/guide-22-contact-390.png` }).catch(() => {})
  // [소개 글에 이 줄 넣기] → 위의 프로필 소개 글 만들기가 펼쳐지고 '연락 받는 길' 칸에 그 줄 · 초안에도 들어감
  await mp.locator('[data-testid="mk-contact-tab"][data-key="openchat"]').click()
  await mp.waitForTimeout(200)
  await mp.getByTestId('mk-contact-use').click()
  await mp.waitForTimeout(700)
  const bioOpen = await mp.getByTestId('mk-bio').evaluate((d) => d.open)
  const contactVal = await mp.locator('[data-testid="mk-bio-input"][data-key="contact"]').inputValue().catch(() => '')
  const draft1 = ((await mp.getByTestId('mk-bio-text').first().innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ')
  check('G22 [소개 글에 이 줄 넣기] → 프로필 소개 글 만들기가 펼쳐짐 · "연락 받는 길" 칸에 그 줄 · 초안 첫 번째에도 그 줄 · 다른 칸은 그대로', bioOpen && contactVal === '문의는 프로필 링크(카카오톡 1:1)로' && draft1.includes('문의는 프로필 링크(카카오톡 1:1)로'), JSON.stringify({ bioOpen, contactVal, draft1: draft1.slice(0, 120) }))
}

/* G23 안내 카드 더 빨리 · 네 칸 아이콘(D-598) — 처음 0.25초(지나가는 마우스는 여전히 거름) · 카드를 본 직후 옆 칸은 0.08초 ·
 *     무엇 · 왜 · 효과 · 앞으로 앞에 작은 아이콘 · 칸 사이 간격 — 마우스 카드 · 사용법 안내 화면 · 휴대폰 '이 화면 안내' 세 곳 같게 */
{
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await moveAway()
  await page.waitForTimeout(1300) // 카드를 본 지 1초가 지난 '처음' 상태
  const appear = async (key) => {
    const t0 = Date.now()
    await row(key).hover()
    for (let i = 0; i < 60; i++) {
      if ((await card.getAttribute('data-key').catch(() => null)) === key) return Date.now() - t0
      await page.waitForTimeout(15)
    }
    return -1
  }
  const cold = await appear('calendar')
  const warm = await appear('client-ops')
  const icons = await card.locator('[data-testid="guide-sec-icon"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-k')))
  const gaps = await card.locator('[data-testid="guide-sec"]').evaluateAll((els) => els.slice(1).map((e, i) => Math.round(e.getBoundingClientRect().top - els[i].getBoundingClientRect().bottom)))
  const tones = await card.locator('[data-testid="guide-sec-icon"]').evaluateAll((els) => new Set(els.map((e) => getComputedStyle(e).color)).size)
  await shot(page, 'guide-23-card-icons')
  await moveAway()
  check(
    'G23 안내 카드 더 빨리(D-598) — 처음 0.2~0.45초(예전 0.45초 넘게) · 바로 옆 칸 0.25초 안 · 네 칸 아이콘(무엇 · 왜 · 효과 · 앞으로 순 · 모양은 다르고 색은 한 가지) · 칸 사이 10px 이상',
    cold >= 200 && cold <= 450 && warm >= 0 && warm <= 250 && icons.join() === 'what,why,effect,next' && gaps.length === 3 && gaps.every((g) => g >= 10) && tones === 1,
    { cold, warm, icons, gaps, tones },
  )
  await page.goto(BASE + '/guide', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByTestId('guide-row').first().getByTestId('guide-row-toggle').click()
  await page.waitForTimeout(250)
  const pageIcons = await page.getByTestId('guide-panel').first().locator('[data-testid="guide-sec-icon"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-k')).join())
  await shot(page, 'guide-23-page-icons')
  await mp.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await mp.waitForTimeout(600)
  await mp.getByTestId('screen-title-guide').tap()
  await mp.waitForFunction(() => document.querySelector('[data-testid="screen-guide"]'), null, { timeout: 8000 }).catch(() => {})
  const sheetIcons = await mp.getByTestId('screen-guide').locator('[data-testid="guide-sec-icon"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-k')).join())
  const sheetOver = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  await shot(mp, 'guide-23-sheet-icons-390')
  await mp.keyboard.press('Escape').catch(() => {})
  check('G23 사용법 안내 화면 · 휴대폰 "이 화면 안내" 도 같은 네 아이콘 · 휴대폰 옆 넘침 0', pageIcons === 'what,why,effect,next' && sheetIcons === 'what,why,effect,next' && sheetOver <= 0, { pageIcons, sheetIcons, sheetOver })
}

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
