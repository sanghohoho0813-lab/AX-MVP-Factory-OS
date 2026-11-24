/**
 * qa:outbound — D-653 오늘 고객에게 보낼 안내(알림톡 전 단계 · 외부 발송 0).
 *
 *   O1 오늘 머리 줄 '보낼 안내 6건'(내일 미팅 · 지난 돈 · 서류 4일째 · 오늘 돈 · 곧 돈 둘) — 내부 할 일(견적서 보내기)은 안 셈
 *   O2 누르면 아래 판 — 처음 5줄 + [1건 더 보기] · 순서(약속 → 지난 돈 → 서류 → 오늘 돈 → 곧 돈)
 *   O3 [문구 보기] — '김내일 대표님' · 내일 날짜(요일) · 오후 2시 · 2차 미팅
 *   O4 [문구 복사] — 복사된 글 = 보이는 글 · 알림 한 줄
 *   O5 입금 안내 문구에 영업자 이름 · 수수료 0 · 지난 돈은 빨간 글자
 *   O6 약속 [보냈어요] → 그 줄 빠짐(5건) · 업체 기록 notices · 활동 기록 '고객에게 안내 보냄'
 *   O7 [되돌리기] → 그 줄 다시(6건) · 기록 지움
 *   O8 서류 [보냈어요] → 그 요청의 다시 부탁한 날 = 오늘(서류함과 같은 기록) · 줄 빠짐
 *   O9 새로 고쳐도 그대로(업체 기록에 저장)
 *   O10 보낼 것이 없는 계정 — 단추 0
 *   O11 390 — 머리 줄에 단추 · 판 넘침 0 · 단추 40px 이상
 *   O12 JS 오류 0
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

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

const NOW = new Date('2026-11-24T09:00:00+09:00')
const base = (id, name, over = {}) => ({
  id,
  companyName: name,
  contactName: '',
  contactPhone: '010-1111-2222',
  representativeName: '',
  status: 'active',
  nextAction: '',
  nextActionDueDate: '',
  services: {},
  documents: {},
  fees: [],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...over,
})
const fee = (id, over) => ({ id, serviceKey: null, kind: 'deposit', label: '착수금', amount: 3_300_000, agentFee: null, agentName: '', agentPaidAt: null, dueDate: '', receivedAt: null, note: '', ...over })
const CLIENTS = [
  base('c_meet', '(주)내일미팅', { representativeName: '김내일', nextAction: '2차 미팅 · 오후 2시', nextActionDueDate: '2026-11-25' }),
  base('c_fee', '(주)입금지남', { representativeName: '박지남', fees: [fee('f_over', { dueDate: '2026-11-20', agentFee: 500_000, agentName: '최영업' })] }),
  base('c_docs', '(주)서류기다림', {
    representativeName: '이서류',
    docRequests: [{ id: 'r1', sentAt: '2026-11-20', sentAtIso: '2026-11-20T01:00:00.000Z', title: '서류 요청', items: [{ label: '대표님 생년월일', where: '' }, { label: '주주 구성 메모', where: '' }] }],
  }),
  base('c_today', '(주)오늘입금', { fees: [fee('f_today', { dueDate: '2026-11-24', label: '잔금', amount: 1_100_000 })] }),
  base('c_soon1', '(주)곧입금가', { fees: [fee('f_s1', { dueDate: '2026-11-25', label: '중도금' })] }),
  base('c_soon2', '(주)곧입금나', { fees: [fee('f_s2', { dueDate: '2026-11-26', label: '중도금' })] }),
  base('c_internal', '(주)내부할일', { nextAction: '견적서 보내기', nextActionDueDate: '2026-11-25' }),
]
const seed = (clients) => `
  localStorage.setItem('axmvp.onboarding.prefs', ${JSON.stringify(JSON.stringify({ tutorialVersion: 99, autoShowEnabled: false, snoozedUntilDate: '' }))});
  localStorage.setItem('axmvp.v1.operations_clients', ${JSON.stringify(JSON.stringify(clients))});
  localStorage.setItem('axmvp.chatfirst.v1', JSON.stringify({ all: 'direct' }));
`
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') || '[]'))

const browser = await chromium.launch()
const errs = []
const open = async (viewport, clients) => {
  const ctx = await browser.newContext({ viewport, permissions: ['clipboard-read', 'clipboard-write'], locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errs.push(String(e)))
  await page.clock.setFixedTime(NOW)
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(seed(clients))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.getByTestId('today-hero-line').waitFor()
  return { ctx, page }
}

// ---------------------------------------------------------------- PC
const { ctx, page } = await open({ width: 1440, height: 900 }, CLIENTS)
const btn = page.getByTestId('today-notices-open')
await btn.waitFor({ timeout: 10_000 })
check("O1 오늘 머리 줄 '보낼 안내 6건' — 내부 할 일은 안 셈", (await btn.innerText()).trim() === '보낼 안내 6건' && (await btn.getAttribute('data-count')) === '6', await btn.innerText())
await btn.click()
const sheet = page.getByTestId('notice-sheet')
await sheet.waitFor()
await page.waitForTimeout(800)
const rows = sheet.getByTestId('notice-row')
const kinds = await rows.evaluateAll((els) => els.map((e) => `${e.getAttribute('data-kind')}:${e.getAttribute('data-client')}`))
check(
  'O2 판 — 처음 5줄 + [1건 더 보기] · 순서 약속 → 지난 돈 → 서류 → 오늘 돈 → 곧 돈',
  kinds.join('|') === 'meet:c_meet|fee:c_fee|docs:c_docs|fee:c_today|fee:c_soon1' && (await sheet.getByTestId('notice-more').innerText()).trim() === '1건 더 보기',
  kinds,
)
if (SHOTS) await page.screenshot({ path: join(SHOTS, 'outbound-sheet-pc.png') })
const meetRow = rows.filter({ has: page.locator('[data-client="c_meet"]') }).first()
const meet = sheet.locator('[data-testid="notice-row"][data-client="c_meet"]')
await meet.getByTestId('notice-peek').click()
const meetText = await meet.getByTestId('notice-text').innerText()
check(
  "O3 [문구 보기] — '김내일 대표님' · 내일 11월 25일(수) 오후 2시 2차 미팅",
  meetText.startsWith('안녕하세요, 김내일 대표님.') && meetText.includes('내일 11월 25일(수) 오후 2시 2차 미팅 일정 확인차') && (await meet.getByTestId('notice-title').innerText()) === '내일 2차 미팅 · 오후 2시',
  meetText,
)
void meetRow
await meet.getByTestId('notice-copy').click()
await page.waitForTimeout(300)
const clip = await page.evaluate(() => navigator.clipboard.readText())
const toast1 = await page.getByTestId('toast-stack').innerText().catch(() => '')
check('O4 [문구 복사] — 복사된 글 = 보이는 글 · 알림', clip.replace(/\r/g, '') === meetText.replace(/\r/g, '') && /문구를 복사했어요/.test(toast1), { clip: clip.slice(0, 80), toast1 })
const feeRow = sheet.locator('[data-testid="notice-row"][data-client="c_fee"]')
await feeRow.getByTestId('notice-peek').click()
const feeText = await feeRow.getByTestId('notice-text').innerText()
const feeColor = await feeRow.getByTestId('notice-title').evaluate((e) => getComputedStyle(e).color)
check(
  'O5 입금 안내 — 지난 날 · 330만원 · 영업자 이름 · 수수료 0 · 지난 돈은 빨간 글자',
  feeText.includes('11월 20일(금) 입금 예정이었던 착수금 330만원 건이') && !feeText.includes('최영업') && !feeText.includes('50만원') &&
    (await feeRow.getByTestId('notice-title').innerText()) === '착수금 330만원 · 예정일 4일 지남' && /rgb\((1[5-9]\d|2\d\d), (\d|[1-7]\d), (\d|[1-7]\d)\)/.test(feeColor),
  { feeText, feeColor },
)
await meet.getByTestId('notice-sent').click()
await page.waitForFunction(() => !document.querySelector('[data-testid="notice-row"][data-client="c_meet"]'), null, { timeout: 8000 })
const afterMeet = await stored(page)
const recMeet = afterMeet.find((c) => c.id === 'c_meet')
check(
  "O6 약속 [보냈어요] → 그 줄 빠짐 · 업체 기록 notices['meet:2026-11-25'] · 활동 기록 '고객에게 안내 보냄' · 머리 줄 5건",
  recMeet?.notices?.['meet:2026-11-25'] === '2026-11-24' && recMeet.activity?.[0]?.kind === 'notice' && /고객에게 안내 보냄 — 내일 2차 미팅/.test(recMeet.activity[0].text) &&
    (await page.getByTestId('today-notices-open').innerText()).trim() === '보낼 안내 5건',
  { notices: recMeet?.notices, act: recMeet?.activity?.[0] },
)
await page.getByTestId('toast-action').filter({ hasText: '되돌리기' }).last().click()
await page.waitForFunction(() => !!document.querySelector('[data-testid="notice-row"][data-client="c_meet"]'), null, { timeout: 8000 })
const undone = (await stored(page)).find((c) => c.id === 'c_meet')
check(
  "O7 [되돌리기] → 그 줄 다시 · notices 지움 · 활동 기록 지움 · 6건",
  !undone?.notices?.['meet:2026-11-25'] && !(undone?.activity ?? []).some((a) => a.kind === 'notice') && (await page.getByTestId('today-notices-open').innerText()).trim() === '보낼 안내 6건',
  { notices: undone?.notices },
)
const docsRow = sheet.locator('[data-testid="notice-row"][data-client="c_docs"]')
await docsRow.getByTestId('notice-peek').click()
const docsText = await docsRow.getByTestId('notice-text').innerText()
await docsRow.getByTestId('notice-sent').click()
await page.waitForFunction(() => !document.querySelector('[data-testid="notice-row"][data-client="c_docs"]'), null, { timeout: 8000 })
const recDocs = (await stored(page)).find((c) => c.id === 'c_docs')
check(
  "O8 서류 [보냈어요] → 그 요청의 다시 부탁한 날 = 오늘(서류함과 같은 기록) · 남은 것만 다시 부탁하는 글",
  recDocs?.docRequests?.[0]?.resentAt === '2026-11-24' && docsText.includes('아래 2가지가 아직 도착하지 않아 다시 부탁드립니다') && docsText.includes('1. 대표님 생년월일'),
  { req: recDocs?.docRequests?.[0], docsText: docsText.slice(0, 160) },
)
await page.keyboard.press('Escape')
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('today-notices-open').waitFor()
check('O9 새로 고쳐도 그대로 — 5건(서류 보낸 것 빠짐)', (await page.getByTestId('today-notices-open').innerText()).trim() === '보낼 안내 5건')
await ctx.close()

// ---------------------------------------------------------------- 보낼 것 없음
{
  const { ctx: c2, page: p2 } = await open({ width: 1440, height: 900 }, [CLIENTS[6]])
  await p2.waitForTimeout(800)
  check('O10 보낼 것이 없는 계정 — 단추 0', (await p2.getByTestId('today-notices-open').count()) === 0)
  await c2.close()
}

// ---------------------------------------------------------------- 휴대폰 390
{
  const { ctx: c3, page: p3 } = await open({ width: 390, height: 844 }, CLIENTS)
  const b3 = p3.getByTestId('today-notices-open')
  await b3.waitFor({ timeout: 10_000 })
  const hb = await b3.boundingBox()
  await b3.click()
  await p3.getByTestId('notice-sheet').waitFor()
  await p3.waitForTimeout(900)
  const over = await p3.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  const small = await p3.getByTestId('notice-sheet').locator('button').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 40 && e.getAttribute('data-testid') !== 'notice-peek' && e.getAttribute('data-testid') !== 'notice-more').map((e) => e.textContent?.trim()))
  check('O11 390 — 머리 줄 단추가 첫 화면 안 · 판 옆 넘침 0 · 판 안 단추 40px 이상', !!hb && hb.y < 844 && over <= 0 && small.length === 0, { hb, over, small })
  if (SHOTS) await p3.screenshot({ path: join(SHOTS, 'outbound-sheet-390.png') })
  await p3.keyboard.press('Escape')
  await p3.waitForTimeout(400)
  if (SHOTS) await p3.screenshot({ path: join(SHOTS, 'outbound-today-390.png') })
  await c3.close()
}

check('O12 JS 오류 0', errs.length === 0, errs)
await browser.close()
console.log(`\noutbound: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
