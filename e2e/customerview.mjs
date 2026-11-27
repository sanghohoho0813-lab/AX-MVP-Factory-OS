/**
 * qa:customerview — D-683 고객 화면 보기(대표만 · 연습 모드). 진짜 권한 · 고객 실제 화면과 같은지는 qa:growthportal W15.
 *
 *   CV1 /customer-view — 고르기: 계약 고객 · 잠재고객 숫자 · 찾기 · 연결 전 표시
 *   CV2 연결 전 업체 — 고객이 보는 '연결된 프로젝트 없음' 그대로 · 안내 한 줄 · [연결되면 보일 화면] → 프로젝트 카드(준비 중)
 *   CV3 연결 · 서류 요청 · 보고서 발행 뒤 — 홈 '지금 할 일'(새 보고서 · 서류 올려 주세요) · 최근 보고서 '새 보고서' · 카드 '해야 할 일'
 *   CV4 프로젝트 — 탭 일곱 · 서류는 고객 말('올려 주세요' — 안쪽 말 '요청함' 0) · 고객 단추는 눌리지 않음
 *   CV5 보고서 — 본문 · [확인했어요] 안 눌림 · 확인 ≠ 검수 한 줄 · 내부 글 · 수수료 0
 *   CV6 [대표 화면으로] → 오늘 · 설정 '보는 화면' 에 [고객 화면] → 다시 고르기
 *   CV7 업체 탭 미리보기 창 [전체 화면으로 보기] → 그 업체 고객 화면
 *   CV8 390 — 넘침 0 · 탭 줄은 옆으로 밀림(화면은 안 넘침)
 *   CV9 JS 오류 0
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.argv[3] ?? ''
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
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
const shot = async (p, name, full = false) => {
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full })
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'] })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(seedScript())
await page.evaluate(() => {
  const k = 'axmvp.v1.operations_clients'
  const all = JSON.parse(localStorage.getItem(k) || '[]')
  for (const c of all) if (c.id === 'cli_hansol') c.notes = '수수료 300만원 협의(내부)'
  localStorage.setItem(k, JSON.stringify(all))
})
const frame = page.getByTestId('cv-frame')

// CV1
await page.goto(BASE + '/customer-view', { waitUntil: 'networkidle' })
await page.getByTestId('cv-picker').waitFor()
const groups = await page.getByTestId('cv-group').allInnerTexts()
check('CV1a 고르기 — 계약 고객 · 잠재고객 숫자', groups.length === 2 && /^계약 고객 \d+$/.test(groups[0]) && /^잠재고객 \d+$/.test(groups[1]), groups)
await page.getByTestId('cv-search').fill('한솔')
const found = await page.getByTestId('cv-client-row').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-client')}:${e.getAttribute('data-linked')}`))
check('CV1b 찾기 — 한솔테크 한 줄 · 연결 전', found.length === 1 && found[0] === 'cli_hansol:0', found)
await shot(page, 'cv-01-picker')

// CV2
await page.getByTestId('cv-client-row').first().click()
await frame.waitFor()
const f2 = (await frame.innerText()) ?? ''
check("CV2a 연결 전 — 고객이 보는 '아직 연결된 프로젝트가 없습니다' 그대로 · 띠에 업체 이름", (await frame.getAttribute('data-linked')) === '0' && f2.includes('아직 연결된 프로젝트가 없습니다') && ((await page.getByTestId('cv-banner').innerText()) ?? '').includes('한솔테크'), f2.slice(0, 200))
check('CV2b 안내 한 줄(연결 전)', (await page.getByTestId('cv-unlinked-note').count()) === 1)
await shot(page, 'cv-02-unlinked')
await page.getByTestId('cv-simulate').click()
await page.getByTestId('cv-project-card').waitFor()
check("CV2c [연결되면 보일 화면] → 프로젝트 카드 '준비 중'", ((await page.getByTestId('cv-project-card').innerText()) ?? '').includes('준비 중'))

// CV3 연결 · 서류 요청 · 보고서 발행(업체 탭)
await page.goto(BASE + '/ops/clients/cli_hansol?tab=portal', { waitUntil: 'networkidle' })
await page.getByPlaceholder('customer@example.com').fill('ceo@hansol.example')
await page.getByRole('button', { name: '연결', exact: true }).click()
await page.getByTestId('portal-usage').waitFor({ timeout: 10000 })
await page.getByRole('button', { name: '서류 요청' }).click()
await page.getByRole('dialog', { name: '고객에게 서류 요청' }).getByRole('button', { name: '요청', exact: true }).click()
await page.waitForTimeout(500)
await page.getByTestId('report-create').click()
await page.locator('[data-testid="report-period"][data-period="year"]').click().catch(() => {})
await page.getByTestId('report-make-draft').click()
await page.waitForFunction(() => document.querySelector('[data-testid="report-sheet"]')?.getAttribute('data-step') === 'edit')
const repTitle = await page.getByTestId('report-title').inputValue()
await page.getByTestId('report-publish').click()
await page.getByTestId('report-publish-go').click()
await page.getByTestId('report-done').waitFor()
await page.getByTestId('report-done-close').click()
// CV7 — 업체 탭 미리보기 창 → 전체 화면
await page.getByRole('button', { name: '고객 화면 보기' }).click()
await page.getByTestId('portal-cv-full').click()
await frame.waitFor({ timeout: 10000 })
check('CV7 업체 탭 미리보기 창 [전체 화면으로 보기] → 그 업체 고객 화면', page.url().includes('/customer-view?client=cli_hansol') && (await frame.getAttribute('data-linked')) === '1')
const todo = await page.getByTestId('cv-todo-item').allInnerTexts()
check("CV3a 홈 '지금 할 일' — 새 보고서 먼저 · 서류 올려 주세요 · 3개 이하", todo.length >= 2 && todo.length <= 3 && todo[0].includes(`새 보고서 · ${repTitle}`) && todo.some((t) => t.includes('서류 1개 올려 주세요')), todo)
check("CV3b 최근 보고서 '새 보고서' · 카드 '해야 할 일'", (await page.getByTestId('cv-recent-item').first().getAttribute('data-state')) === 'new' && ((await page.getByTestId('cv-project-card').innerText()) ?? '').includes('해야 할 일'))
await shot(page, 'cv-03-home', true)

// CV4 프로젝트
await page.getByTestId('cv-project-card').click()
await page.getByTestId('cv-project').waitFor()
const tabs = await page.getByTestId('cv-tab').evaluateAll((els) => els.map((e) => e.getAttribute('data-tab')).join(','))
check('CV4a 탭 일곱(홈페이지와 같은 차례)', tabs === 'todo,reports,progress,documents,updates,requests,results', tabs)
await page.locator('[data-testid="cv-tab"][data-tab="documents"]').click()
const docsTxt = (await frame.innerText()) ?? ''
const upload = page.getByRole('button', { name: '파일 올리기' }).first()
check("CV4b 서류는 고객 말('올려 주세요') · 안쪽 말('요청함' · '고객 업로드됨') 0 · [파일 올리기] 안 눌림", docsTxt.includes('올려 주세요') && !docsTxt.includes('요청함') && !docsTxt.includes('고객 업로드됨') && (await upload.isDisabled()), docsTxt.slice(0, 300))
await page.locator('[data-testid="cv-tab"][data-tab="reports"]').click()
await page.getByTestId('cv-report-item').first().waitFor()
await shot(page, 'cv-04-project-reports')

// CV5 보고서
await page.getByTestId('cv-report-item').first().click()
await page.getByTestId('cv-report-body').waitFor()
const body = (await page.getByTestId('cv-report-body').innerText()) ?? ''
const all5 = (await frame.innerText()) ?? ''
check('CV5 보고서 — 본문 · [확인했어요] 안 눌림 · 확인 ≠ 검수 · 내부 글 · 수수료 0', body.includes('지금 진행 중') && (await page.getByTestId('cv-ack').isDisabled()) && (await page.getByTestId('cv-ack').getAttribute('data-acked')) === '0' && all5.includes('계약 검수') && !all5.includes('300만원'), body.slice(0, 200))
await shot(page, 'cv-05-report', true)

// CV6 돌아가기 · 설정 '보는 화면'
await page.getByTestId('cv-back-owner').click()
await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 8000 }).catch(() => {})
check('CV6a [대표 화면으로] → 오늘', new URL(page.url()).pathname === '/')
await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
const cvBtn = page.locator('[data-testid="view-as-switch"] [data-view="customer"]').first()
await cvBtn.waitFor({ timeout: 8000 }).catch(() => {})
check("CV6b 설정 '보는 화면' 에 [고객 화면](팀장 보기가 없어도)", (await cvBtn.count()) >= 1)
if (await cvBtn.count()) {
  await cvBtn.click()
  await page.getByTestId('cv-picker').waitFor({ timeout: 8000 }).catch(() => {})
  check('CV6c [고객 화면] → 고르기 화면 · 스위치 [고객 화면] 켜짐', (await page.getByTestId('cv-picker').count()) === 1)
}

// CV8 390
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Seoul' })
const mp = await m.newPage()
mp.on('pageerror', (e) => errs.push(String(e)))
await mp.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
// 같은 기기(브라우저)처럼 — 앞 화면의 저장소를 그대로 옮긴다
const store = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]))))
await mp.evaluate((s) => { for (const [k, v] of Object.entries(JSON.parse(s))) localStorage.setItem(k, v) }, store)
const over = async () => mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
for (const [name, path] of [['홈', '/customer-view?client=cli_hansol'], ['프로젝트', '/customer-view?client=cli_hansol&view=project&tab=documents'], ['고르기', '/customer-view']]) {
  await mp.goto(BASE + path, { waitUntil: 'networkidle' })
  await mp.waitForTimeout(500)
  check(`CV8 390 ${name} — 옆 넘침 0`, (await over()) <= 0, await over())
  if (name === '홈') await shot(mp, 'cv-m-01-home', true)
  if (name === '프로젝트') await shot(mp, 'cv-m-02-project', true)
}
await m.close()

check('CV9 JS 오류 0', errs.length === 0, errs)
await browser.close()
console.log(`\nqa:customerview ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
