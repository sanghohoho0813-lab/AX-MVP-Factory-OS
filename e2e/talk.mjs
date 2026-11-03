/**
 * qa:talk — D-508 말하기 대본(고객에게 이렇게 말하세요 · 미팅 대본 한 장).
 *
 *   T1 맞춤 추천 · 개요 '먼저 제안할 것' 머리에 [말하기 대본] → 창: 탭 = 미팅 순서 + 먼저 제안할 것(같은 순서)
 *   T2 미팅 순서 — 시작 → 먼저 여쭤볼 것 → 제안(같은 순서) → 받을 서류 → 마무리 · 다음 약속 · 수수료 · 영업자 · 업무 일기 말 0 · 'AI' 0
 *   T3 제안 탭 — 고객에게 이렇게 말하세요(판정 머리글 · 추천 기관) · 쉽게 말하면 · 대표님이 물으면 · 이렇게는 말하지 마세요 · 모듈 열기
 *   T4 대본 복사 · 이 말하기 복사(클립보드 글) · 인쇄 종이(미팅 순서)
 *   T5 모듈별 판정 카드 [이렇게 말하기] → 그 모듈 탭으로 바로(제안 밖 모듈은 맨 뒤 탭)
 *   T6 주소 ?talk=1 → 바로 열림 · 닫으면 주소에서 빠짐(영업 › 미팅 준비에서 이어 옴)
 *   T7 390 — 창 안 옆 넘침 0 · 탭 단추 40px 이상 · 오류 0
 *   T9 D-509 판정 카드 · 말하기 카드의 용어(인정이자 · 경정청구 …) 점선 밑줄 → 한 줄 뜻
 *   T10 오늘 › 업체 약속(오늘 · 내일 미팅 · 상담) [말하기 대본]
 *   T8 영업 › 미팅 준비 [판정 그대로 말하기 대본] → 업체 상세에서 바로 열림
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
    console.log('FAIL ', n, d === undefined ? '' : String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700))
  }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(seedScript())
await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
await page.getByTestId('top-picks').waitFor()

// T1
const pickKeys = await page.getByTestId('top-picks').getByTestId('top-pick').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
await page.getByTestId('top-picks-talk').click()
const sheet = page.getByTestId('talk-sheet')
await sheet.waitFor()
const tabKeys = await sheet.getByTestId('talk-tab').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
check('T1 [말하기 대본] → 창 · 탭 = 미팅 순서 + 먼저 제안할 것과 같은 순서', tabKeys[0] === 'script' && JSON.stringify(tabKeys.slice(1)) === JSON.stringify(pickKeys) && pickKeys.length > 0, { tabKeys, pickKeys })

// T2
const secIds = await sheet.getByTestId('talk-script-section').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))
const scriptText = await sheet.getByTestId('talk-script').innerText()
check(
  'T2 미팅 순서 — 시작 → 먼저 여쭤볼 것 → 제안(같은 순서) → 받을 서류 → 마무리 · 다음 약속',
  secIds[0] === 'open' && secIds[1] === 'ask' && pickKeys.every((k, i) => secIds[2 + i] === `pick-${k}`) && secIds.at(-1) === 'close' && scriptText.includes('다음 미팅은 언제가 편하세요?'),
  secIds,
)
check("T2-1 대본에 수수료 · 영업자 · 업무 일기 · 'AI' 말 0 · 확정이라고 말하지 않는다는 한 줄", !/수수료|영업자|업무 일기|\bAI\b/.test(scriptText) && scriptText.includes("'확정 · 무조건'이라고 말하지 않아요"), scriptText.slice(0, 300))
check('T2-2 먼저 여쭤볼 것 — 서류는 "받아 볼 수 있을까요?" · 정보(연구 인원 · 공간)는 서류처럼 묻지 않음', /받아 볼 수 있을까요\?/.test(scriptText) && !/(수|공간|활동)을 받아 볼/.test(scriptText), scriptText.slice(0, 500))

// T3
await sheet.getByTestId('talk-tab').nth(1).click()
const card = sheet.getByTestId('talk-card')
await card.waitFor()
const firstKey = pickKeys[0]
const head = (await page.getByTestId('top-picks').getByTestId('top-pick').first().innerText()).replace(/\s+/g, ' ')
const sayText = await card.getByTestId('talk-say').innerText()
const agency = /추천 기관 (\S+)/.exec(head)?.[1] ?? ''
check(
  'T3 제안 탭 — 고객에게 이렇게 말하세요(맨 위 카드와 같은 판정) · 쉽게 말하면 · 대표님이 물으면 ≥2 · 이렇게는 말하지 마세요',
  (await card.getAttribute('data-key')) === firstKey && sayText.startsWith('“대표님') && (firstKey !== 'policy-funding' || (agency && sayText.includes(agency))) && (await card.getByTestId('talk-easy').innerText()).length > 20 && (await card.getByTestId('talk-faq').locator('dt').count()) >= 2 && (await card.getByTestId('talk-avoid').innerText()).includes('말하지 마세요'),
  { firstKey, head, sayText },
)
const openHref = await card.getByTestId('talk-open-module').getAttribute('href')
check('T3-1 모듈 열기 — 이 업체로(주소에 client)', !!openHref && openHref.includes('cli_hansol'), openHref)

// T4 복사 · 인쇄 종이
await card.getByTestId('talk-copy').click()
await page.waitForTimeout(200)
const clip1 = await page.evaluate(() => navigator.clipboard.readText())
check('T4 이 말하기 복사 — [모듈] 고객에게 이렇게 말하세요 · 쉽게 말하면 · Q/A · 조심', /^\[.+\] 고객에게 이렇게 말하세요/.test(clip1) && clip1.includes('쉽게 말하면 —') && /\nQ\. .+\nA\. /.test(clip1) && clip1.includes('이렇게는 말하지 마세요'), clip1.slice(0, 200))
await sheet.getByTestId('talk-tab').first().click()
await page.getByTestId('talk-script-copy').click()
await page.waitForTimeout(200)
const clip2 = await page.evaluate(() => navigator.clipboard.readText())
check('T4-1 대본 복사 — [회사] 미팅 대본 · 1. 시작 · 마무리 · 주의 한 줄', /^\[한솔테크\(주\)\] 미팅 대본/.test(clip2) && /\n1\. 시작\n/.test(clip2) && clip2.includes('마무리 · 다음 약속') && clip2.includes('※ '), clip2.slice(0, 200))
check('T4-2 인쇄 종이 — 미팅 순서(같은 칸 수) · 화면에는 안 보임', (await page.getByTestId('talk-script-print').count()) === 1 && (await page.getByTestId('talk-script-print-section').count()) === secIds.length && !(await page.getByTestId('talk-script-print').isVisible()))
await page.keyboard.press('Escape')
await page.waitForTimeout(200)
check('T4-3 Esc 로 닫힘', (await page.getByTestId('talk-sheet').count()) === 0)

// T5 모듈별 판정 카드 [이렇게 말하기]
const verdictTalk = page.getByTestId('smart-insight-talk')
const vCount = await verdictTalk.count()
const vKeys = await page.getByTestId('smart-insight').evaluateAll((els) => els.filter((e) => e.querySelector('[data-testid="smart-insight-talk"]')).map((e) => e.getAttribute('data-key')))
const outside = vKeys.find((k) => !pickKeys.includes(k))
check('T5 모듈별 판정 카드에 [이렇게 말하기] — 말하기가 있는 모듈마다(크레탑 없음)', vCount >= 3 && !vKeys.includes('cretop'), vKeys)
if (outside) {
  await page.locator(`[data-testid="smart-insight"][data-key="${outside}"] [data-testid="smart-insight-talk"]`).click()
  await page.getByTestId('talk-sheet').waitFor()
  const tk = await page.getByTestId('talk-tab').evaluateAll((els) => els.map((e) => [e.getAttribute('data-key'), e.getAttribute('aria-selected')]))
  check('T5-1 제안 밖 모듈 → 맨 뒤 탭으로 바로 열림(그 모듈 말하기)', tk.at(-1)[0] === outside && tk.at(-1)[1] === 'true' && (await page.getByTestId('talk-card').getAttribute('data-key')) === outside, tk)
  await page.keyboard.press('Escape')
}

// T9 D-509 처음 보는 말 — 판정 카드 · 말하기 대본의 용어에 점선 밑줄 → 마우스를 올리면 · 누르면 한 줄 설명
const terms = page.getByTestId('smart-insights').getByTestId('term')
const termCount = await terms.count()
let hoverShown = false
let clickShown = false
let tipText = ''
if (termCount > 0) {
  const t0 = terms.first()
  await t0.scrollIntoViewIfNeeded()
  await t0.hover()
  await page.waitForTimeout(150)
  const tip = t0.locator('xpath=..').getByTestId('term-tip')
  hoverShown = await tip.isVisible()
  await page.mouse.move(5, 5)
  await t0.click()
  await page.mouse.move(5, 5)
  await page.waitForTimeout(150)
  clickShown = await tip.isVisible()
  tipText = await tip.innerText()
}
check('T9 판정 카드 용어 점선 밑줄 — 올리면 · 누르면 한 줄 뜻(용어 — 뜻)', termCount > 0 && hoverShown && clickShown && / — .{8,}/.test(tipText), { termCount, hoverShown, clickShown, tipText })
const insightUrl = page.url()
await page.getByTestId('top-picks-talk').click()
await page.getByTestId('talk-sheet').waitFor()
await page.getByTestId('talk-tab').nth(1).click()
const talkTerms = await page.getByTestId('talk-card').getByTestId('term').count()
check('T9-1 말하기 카드(쉽게 말하면 · 대표님이 물으면 · 근거)에도 용어 밑줄 · 누르면 화면이 넘어가지 않음', talkTerms > 0 && page.url() === insightUrl, { talkTerms })
await page.keyboard.press('Escape')

// T6 주소 ?talk=1
await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart&talk=1', { waitUntil: 'networkidle' })
await page.getByTestId('talk-sheet').waitFor({ timeout: 8000 }).catch(() => {})
const opened = (await page.getByTestId('talk-sheet').count()) === 1
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
check('T6 주소 ?talk=1 → 바로 열림 · 닫으면 주소에서 빠짐', opened && !page.url().includes('talk='), page.url())

// T6-1 개요 탭에서도
await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
const ovBtn = page.getByTestId('top-picks-talk')
const ovHas = (await ovBtn.count()) === 1
if (ovHas) await ovBtn.click()
check('T6-1 개요 탭 먼저 제안할 것에도 [말하기 대본]', ovHas && (await page.getByTestId('talk-sheet').count()) === 1)
await page.keyboard.press('Escape')

// T8 영업 › 미팅 준비 → 이 업체 판정 그대로 말하기 대본
await page.goto(BASE + '/sales/meeting?client=cli_hansol&round=1', { waitUntil: 'networkidle' })
const mt = page.getByTestId('meeting-talk')
const mtHas = (await mt.count()) === 1
if (mtHas) await mt.click()
await page.getByTestId('talk-sheet').waitFor({ timeout: 8000 }).catch(() => {})
check('T8 영업 › 미팅 준비 [판정 그대로 말하기 대본] → 업체 상세 맞춤 추천에서 대본 창이 바로', mtHas && (await page.getByTestId('talk-sheet').count()) === 1 && page.url().includes('/ops/clients/cli_hansol'), page.url())
await page.keyboard.press('Escape')

// T10 오늘 › 업체 약속 — 오늘 · 내일 미팅 · 상담이면 [말하기 대본](업무 약속은 없음)
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(() => {
  const k = 'axmvp.v1.operations_clients'
  const list = JSON.parse(localStorage.getItem(k) ?? '[]')
  const t = new Date()
  const tomorrow = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)
  const ymd = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  for (const c of list) if (c.id === 'cli_hansol') Object.assign(c, { nextAction: '2차 미팅 — 정책자금 · 연구소 제안', nextActionDueDate: ymd })
  localStorage.setItem(k, JSON.stringify(list))
})
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.getByTestId('today-appointments').waitFor({ timeout: 8000 }).catch(() => {})
const apptTalk = page.getByTestId('today-appointments').getByTestId('today-appt-talk')
const apptCount = await apptTalk.count()
const apptHref = apptCount ? await apptTalk.first().getAttribute('href') : ''
const allRows = await page.getByTestId('today-appointments').locator('li').count()
check('T10 오늘 › 업체 약속 — 내일 2차 미팅 줄에 [말하기 대본](그 업체 ?talk=1) · 미팅 아닌 약속엔 없음', apptCount === 1 && apptHref === '/ops/clients/cli_hansol?tab=smart&talk=1' && allRows >= 1, { apptCount, apptHref, allRows })
if (apptCount) {
  await apptTalk.first().click()
  await page.getByTestId('talk-sheet').waitFor({ timeout: 8000 }).catch(() => {})
  check('T10-1 누르면 그 업체 말하기 대본 창이 바로', (await page.getByTestId('talk-sheet').count()) === 1)
  await page.keyboard.press('Escape')
}

// T7 390
const ph = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
ph.on('pageerror', (e) => errs.push(String(e)))
await ph.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await ph.evaluate(seedScript())
await ph.goto(BASE + '/ops/clients/cli_hansol?tab=smart&talk=1', { waitUntil: 'networkidle' })
await ph.getByTestId('talk-sheet').waitFor()
const tabH = await ph.getByTestId('talk-tab').evaluateAll((els) => Math.min(...els.map((e) => e.getBoundingClientRect().height)))
const wide = await ph.getByTestId('talk-sheet').evaluate((el) => [...el.querySelectorAll('*')].filter((x) => x.getBoundingClientRect().right > window.innerWidth + 1).length)
await ph.getByTestId('talk-tab').nth(1).click()
const wide2 = await ph.getByTestId('talk-sheet').evaluate((el) => [...el.querySelectorAll('*')].filter((x) => x.getBoundingClientRect().right > window.innerWidth + 1).length)
const ovx = await ph.evaluate(() => document.documentElement.scrollWidth - innerWidth)
check('T7 390 — 창 안 화면 밖으로 나간 것 0(미팅 순서 · 제안 탭) · 탭 단추 40px 이상 · 옆 넘침 0', wide === 0 && wide2 === 0 && tabH >= 40 && ovx <= 0, { wide, wide2, tabH, ovx })
check('T7-1 화면 오류 0', errs.length === 0, errs)

await browser.close()
console.log(`\ntalk: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
