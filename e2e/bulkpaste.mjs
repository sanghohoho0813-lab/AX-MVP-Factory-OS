/**
 * qa:bulkpaste — D-582 여러 업체 한 번에 등록(엑셀에서 복사해 붙여넣기).
 *
 *   B1 빈 화면(업체 0): [첫 업체 등록] 옆 [엑셀 목록 붙여넣기] · 쓸모없는 안내 줄 없음
 *   B2 붙여넣으면 '이렇게 읽었어요' — 제목 줄 · 칸 고르개 · 등록할 곳/겹치는 곳/이름 없는 줄 · 미리 보기
 *   B3 회사 이름 칸을 '쓰지 않음' 으로 바꾸면 등록을 막고 알려 줌 → 되돌리면 다시
 *   B4 어떤 업체인지 고르기 전에는 등록 단추가 꺼져 있음 → [계약 고객] → [n곳 등록] → 목록에 카드 n장 · 저장된 값
 *   B5 [더보기] › [여러 업체 한 번에 등록] — 같은 목록을 또 붙여넣으면 이미 있는 곳은 건너뛰고 새 곳만 · [잠재고객] → 영업 보드 잠재 칸
 *   B6 휴대폰 390 — 옆 넘침 0 · 40px 보다 작은 단추 0
 *   B7 /ops/clients?bulk=1 로 바로 열림(고객 첫 화면 '엑셀 목록 붙여넣기')
 *   B8 [더보기] › [업체 목록 엑셀 파일로] — CSV 파일 하나(제목 줄 · 한글 안 깨지게 BOM · 업체 수만큼)
 *   N1 영업 보드 칸 이름 '1차 미팅 예정' · '1차 미팅 완료' 가 잘리지 않음
 *
 *   node e2e/bulkpaste.mjs <baseUrl> [사진 폴더]
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'

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
    console.log('FAIL ', n, d === undefined ? '' : JSON.stringify(d).slice(0, 400))
  }
}
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

const EMPTY_SEED = `
  localStorage.setItem('axmvp.onboarding.prefs', ${JSON.stringify(JSON.stringify({ tutorialVersion: 99, autoShowEnabled: false, snoozedUntilDate: '' }))});
  localStorage.setItem('axmvp.v1.operations_clients', '[]');
  localStorage.setItem('axmvp.v1.ops_journal_entries', '[]');
  localStorage.setItem('axmvp.v1.customer_events', '[]');
  localStorage.setItem('axmvp.chatfirst.v1', JSON.stringify({ all: 'direct' }));
`
// 엑셀에서 복사한 모양(탭 · 제목 줄 · 칸 순서 뒤섞임) — 4곳 + 목록 안에서 겹치는 1줄 + 회사 이름 없는 1줄
const PASTE_1 = ['대표자\t상호\t사업자등록번호\t전화번호', '김한솔\t한솔정밀(주)\t123-45-67890\t010-1111-2222', '이다움\t다움에너지\t2208162517\t02-123-4567', '박셋\t셋째산업\t\t', '최넷\t넷째기업 주식회사\t333-22-11111\t010-3333-4444', '김한솔\t주식회사 한솔정밀\t123-45-67890\t010-1111-2222', '무명\t\t\t010-9999-9999'].join('\n')
const PASTE_2 = ['한솔정밀(주)\t김한솔\t123-45-67890', '다움에너지\t이다움\t', '다섯째상사\t오다섯\t555-55-55555'].join('\n')

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', acceptDownloads: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(EMPTY_SEED)
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') || '[]'))

/* ---------------- B1 빈 화면 ---------------- */
await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
const emptyText = ((await page.getByTestId('clients-empty').innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
const mainText = ((await page.locator('main').innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
check('B1 업체 0 — 빈 화면에 [첫 업체 등록] 과 [엑셀 목록 붙여넣기] · "업무 조각을 누르면…" 줄은 없음', emptyText.includes('첫 업체 등록') && (await page.getByTestId('clients-empty-bulk').count()) === 1 && !mainText.includes('업무 조각을 누르면'), emptyText.slice(0, 160))
await shot(page, 'bulk-01-empty')

/* ---------------- B2 붙여넣기 → 이렇게 읽었어요 ---------------- */
await page.getByTestId('clients-empty-bulk').click()
await page.waitForTimeout(300)
const sheet = page.getByTestId('bulk-paste')
check('B2 창이 열림 — 처음에는 붙여넣는 칸 하나만(읽은 결과 · 고르기 칸 없음) · 등록 단추 꺼짐', (await sheet.count()) === 1 && (await page.getByTestId('bulk-paste-cols').count()) === 0 && (await page.getByTestId('bulk-paste-kind').count()) === 0 && (await page.getByTestId('bulk-paste-submit').isDisabled()))
await shot(page, 'bulk-02-open')
await page.getByTestId('bulk-paste-text').fill(PASTE_1)
await page.waitForTimeout(300)
const cols = await page.getByTestId('bulk-paste-col').evaluateAll((els) => els.map((e) => e.value))
const sum = page.getByTestId('bulk-paste-summary')
const sumText = (await sum.innerText().catch(() => '')) ?? ''
check(
  'B2 제목 줄을 알아봄 · 칸 4개를 맞게 찾음(대표 · 회사 · 사업자등록번호 · 전화) · 등록할 곳 4 · 겹치는 곳 1 · 이름 없는 줄 1',
  (await page.getByTestId('bulk-paste-header').isChecked()) && cols.join() === 'contactName,companyName,businessNumber,contactPhone' && (await sum.getAttribute('data-add')) === '4' && (await sum.getAttribute('data-repeats')) === '1' && sumText.includes('회사 이름이 없는 줄 1'),
  { cols, sumText },
)
const rows = await page.getByTestId('bulk-paste-row').evaluateAll((els) => els.map((e) => (e.textContent ?? '').replace(/\s+/g, ' ')))
check('B2 미리 보기 4줄 — 번호는 000-00-00000 모양으로(2208162517 → 220-81-62517)', rows.length === 4 && rows[1].includes('다움에너지') && rows[1].includes('220-81-62517') && rows[0].includes('010-1111-2222'), rows)
await shot(page, 'bulk-03-read')

/* ---------------- B3 회사 이름 칸이 없으면 막는다 ---------------- */
await page.locator('[data-testid="bulk-paste-col"][data-col="1"]').selectOption('skip')
await page.waitForTimeout(200)
check('B3 회사 이름 칸을 "쓰지 않음" 으로 → 알려 주고 등록 단추 꺼짐 · 고르기 칸도 숨음', (await page.getByTestId('bulk-paste-nocompany').count()) === 1 && (await page.getByTestId('bulk-paste-submit').isDisabled()) && (await page.getByTestId('bulk-paste-kind').count()) === 0)
await page.locator('[data-testid="bulk-paste-col"][data-col="1"]').selectOption('companyName')
await page.waitForTimeout(200)
check('B3 되돌리면 다시 등록할 곳 4', (await page.getByTestId('bulk-paste-summary').getAttribute('data-add')) === '4')

/* ---------------- B4 고르고 등록 ---------------- */
check('B4 어떤 업체인지 고르기 전 — 등록 단추 꺼짐', await page.getByTestId('bulk-paste-submit').isDisabled())
await page.locator('[data-testid="bulk-paste-kind"][data-value="contract"]').click()
const btnText = ((await page.getByTestId('bulk-paste-submit').innerText()) ?? '').trim()
check('B4 [계약 고객] 을 고르면 단추가 "4곳 등록"', btnText === '4곳 등록' && !(await page.getByTestId('bulk-paste-submit').isDisabled()), btnText)
await page.getByTestId('bulk-paste-submit').click()
await page.waitForTimeout(1200)
const after1 = await stored()
const hansol = after1.find((r) => r.companyName === '한솔정밀(주)')
const set3 = after1.find((r) => r.companyName === '셋째산업')
check(
  'B4 등록 뒤 — 창 닫힘 · 카드 4장 · 저장 4곳(대표 · 전화 · 번호 그대로 · 빈 칸은 빈 채) · 계약 고객 · 알림 한 줄',
  (await page.getByTestId('bulk-paste').count()) === 0 && (await page.getByTestId('client-card').count()) === 4 && after1.length === 4 && hansol?.contactName === '김한솔' && hansol?.contactPhone === '010-1111-2222' && hansol?.businessNumber === '123-45-67890' && hansol?.status === 'active' && !hansol?.sales && set3?.businessNumber === '' && ((await page.getByTestId('toast-stack').innerText().catch(() => '')) ?? '').includes('4곳을 계약 고객으로 등록'),
  { n: after1.length, hansol: hansol && { c: hansol.contactName, p: hansol.contactPhone, b: hansol.businessNumber, s: hansol.status } },
)
await shot(page, 'bulk-04-done')

/* ---------------- B5 더보기 → 또 붙여넣기(이미 있는 곳은 건너뜀) → 잠재고객 ---------------- */
await page.locator('[data-guide="fn-clients-tools"]').first().click()
await page.waitForTimeout(300)
await page.getByTestId('clients-bulk').click()
await page.waitForTimeout(300)
await page.getByTestId('bulk-paste-text').fill(PASTE_2)
await page.waitForTimeout(300)
const sum2 = page.getByTestId('bulk-paste-summary')
const cols2 = await page.getByTestId('bulk-paste-col').evaluateAll((els) => els.map((e) => e.value))
check('B5 제목 줄 없는 목록 — 모양으로 칸을 찾음 · 이미 있는 2곳은 건너뛰고 새 곳 1', !(await page.getByTestId('bulk-paste-header').isChecked()) && cols2.join() === 'companyName,contactName,businessNumber' && (await sum2.getAttribute('data-add')) === '1' && (await sum2.getAttribute('data-dupes')) === '2', { cols2, t: await sum2.innerText() })
await page.getByTestId('bulk-paste-skips').locator('summary').click()
const skipsText = ((await page.getByTestId('bulk-paste-skips').innerText()) ?? '').replace(/\n/g, ' ')
check('B5 [건너뛰는 곳 보기] — 어느 업체를 왜 건너뛰는지', skipsText.includes('한솔정밀(주)') && skipsText.includes('다움에너지') && skipsText.includes('이미 있음'), skipsText.slice(0, 200))
await page.locator('[data-testid="bulk-paste-kind"][data-value="prospect"]').click()
await page.getByTestId('bulk-paste-submit').click()
await page.waitForTimeout(1200)
const after2 = await stored()
const five = after2.find((r) => r.companyName === '다섯째상사')
check('B5 [잠재고객] 으로 1곳 — 저장 5곳 · 계약 전(영업 칸 있음 · 잠재 단계)', after2.length === 5 && five?.status === 'waiting' && five?.sales?.stage === 'lead', five && { s: five.status, st: five.sales?.stage })
/* ---------------- B8 업체 목록 엑셀 파일로(D-584) ---------------- */
await page.locator('[data-guide="fn-clients-tools"]').first().click()
await page.waitForTimeout(300)
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.getByTestId('clients-csv').click()])
const csvBuf = readFileSync(await dl.path())
const csvText = csvBuf.toString('utf8')
const csvLines = csvText.replace(/^﻿/, '').trim().split('\r\n')
check(
  'B8 [업체 목록 엑셀 파일로] — 파일 이름 업체목록-날짜.csv · 맨 앞 BOM · 제목 줄 · 업체 5줄 · 잠재고객 구분',
  /^업체목록-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.suggestedFilename()) && csvBuf[0] === 0xef && csvBuf[1] === 0xbb && csvBuf[2] === 0xbf && csvLines[0] === '회사명,대표자,전화,사업자등록번호,업종,구분,다음 할 일,기한,등록일' && csvLines.length === 6 && csvText.includes('다섯째상사,오다섯,,555-55-55555,,잠재고객') && csvText.includes('한솔정밀(주),김한솔,010-1111-2222,123-45-67890,,계약 고객'),
  { name: dl.suggestedFilename(), lines: csvLines.slice(0, 3) },
)

await page.goto(BASE + '/sales/board', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const leadCol = ((await page.locator('[data-testid="sales-board"] [data-sales-col="lead"]').innerText().catch(() => '')) ?? '').replace(/\n/g, ' ')
check('B5 영업 보드 잠재 고객 칸에 방금 등록한 곳', leadCol.includes('다섯째상사'), leadCol.slice(0, 160))

/* ---------------- N1 영업 보드 칸 이름이 잘리지 않음 ---------------- */
const heads = await page.locator('[data-testid="sales-board"] [data-stage-head] h2').evaluateAll((els) => els.map((e) => ({ t: (e.textContent ?? '').trim(), cut: e.scrollWidth > e.clientWidth + 1, ellipsis: getComputedStyle(e).textOverflow === 'ellipsis' })))
check('N1 영업 보드(1440) 칸 이름 6개 — "1차 미팅 예정" · "1차 미팅 완료" 가 끝까지 보임(잘림 0)', heads.length === 6 && heads.some((h) => h.t === '1차 미팅 예정') && heads.some((h) => h.t === '1차 미팅 완료') && heads.every((h) => !h.cut && !h.ellipsis), heads)
await shot(page, 'bulk-05-board')

/* ---------------- B6 휴대폰 390 ---------------- */
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
const mp = await m.newPage()
mp.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
await mp.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await mp.evaluate(EMPTY_SEED)
await mp.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
await mp.waitForTimeout(700)
await mp.getByTestId('clients-empty-bulk').click()
await mp.waitForTimeout(300)
await mp.getByTestId('bulk-paste-text').fill(PASTE_1)
await mp.waitForTimeout(300)
const over = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const small = await mp.locator('[role="dialog"] button, [role="dialog"] select, [role="dialog"] summary').evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 40 }).map((e) => (e.textContent ?? '').trim().slice(0, 14)))
check('B6 휴대폰 390 — 붙여넣은 뒤 옆 넘침 0 · 40px 보다 작은 단추 · 고르개 0 · 등록할 곳 4', over <= 0 && small.length === 0 && (await mp.getByTestId('bulk-paste-summary').getAttribute('data-add')) === '4', { over, small })
if (SHOTS) await mp.screenshot({ path: `${SHOTS}/bulk-06-390.png` })

/* ---------------- B7 주소로 바로 열기(첫 화면 '엑셀 목록 붙여넣기' 가 이 주소로 온다) ---------------- */
await mp.goto(BASE + '/ops/clients?bulk=1', { waitUntil: 'networkidle' })
await mp.waitForTimeout(700)
check('B7 /ops/clients?bulk=1 → 붙여넣는 창이 바로 열림', (await mp.getByTestId('bulk-paste').count()) === 1 && (await mp.getByTestId('bulk-paste-text').count()) === 1)

check('JS 오류 없음', errors.length === 0, errors.slice(0, 3))
console.log(`\nqa:bulkpaste: ${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail > 0 ? 1 : 0)
