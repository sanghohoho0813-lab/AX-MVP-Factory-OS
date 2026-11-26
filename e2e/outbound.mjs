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

// ---------------------------------------------------------------- D-658 새 상담 신청 첫 인사 · D-660 업체 머리 '지금 할 것'
{
  const lead = base('c_lead', '홍길동', { contactName: '홍길동', representativeName: '', nextAction: '상담 신청 — 연락드리기', nextActionDueDate: '2026-11-24', status: 'waiting' })
  const { ctx: c4, page: p4 } = await open({ width: 1440, height: 900 }, [CLIENTS[0], CLIENTS[2], lead])
  const chip = p4.getByTestId('today-notices-open')
  await chip.waitFor({ timeout: 10_000 })
  await chip.click()
  const sheet4 = p4.getByTestId('notice-sheet')
  await sheet4.waitFor()
  const first = sheet4.getByTestId('notice-row').first()
  await first.getByTestId('notice-peek').click()
  const helloText = await first.getByTestId('notice-text').innerText()
  check(
    "N1 D-658 상담 신청 링크로 들어온 곳 — 맨 위 '첫 인사' · '새 상담 신청 · 오늘 들어옴' · 감사 · 통화 편한 시간 · 3건",
    (await chip.innerText()).trim() === '보낼 안내 3건' && (await first.getAttribute('data-kind')) === 'hello' && /첫 인사/.test(await first.innerText()) && /새 상담 신청 · 오늘 들어옴/.test(await first.innerText()) &&
      helloText.startsWith('안녕하세요, 홍길동님.') && /상담 신청해 주셔서 감사합니다/.test(helloText) && /통화 편하신 시간/.test(helloText),
    helloText,
  )
  if (SHOTS) await p4.screenshot({ path: join(SHOTS, 'outbound-hello-pc.png') })
  await first.getByTestId('notice-sent').click()
  await p4.waitForTimeout(700)
  const leadRec = (await stored(p4)).find((c) => c.id === 'c_lead')
  check("N2 [보냈어요] → 'hello:날짜' 로 남고 목록에서 빠짐 · 할 일('상담 신청 — 연락드리기')은 그대로(통화는 사람이 끝낸다)", leadRec?.notices?.['hello:2026-11-24'] === '2026-11-24' && leadRec.nextAction === '상담 신청 — 연락드리기' && (await sheet4.getByTestId('notice-row').count()) === 2, leadRec?.notices)
  await p4.keyboard.press('Escape')
  // 업체 화면 — D-667 알약 하나('일 순서 안내' 줄 자리 · 글자 수 그대로). 여럿이면 '지금 할 것 n' → 목록 판
  await p4.goto(BASE + '/ops/clients/c_docs?tab=overview', { waitUntil: 'networkidle' })
  const now = p4.getByTestId('client-now')
  await now.waitFor({ timeout: 8000 }).catch(() => {})
  const nowText = (await now.innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
  const guideText = (await p4.getByTestId('step-guide').innerText().catch(() => '')).replace(/\s+/g, ' ')
  check(
    "N3 D-660 · D-667 업체 '지금 할 것' — 알약 하나 '지금 할 것 2'(3일 넘은 요청이 있어 빨간 글자) · '일 순서 안내' 줄 자리에(그 글은 화면 읽기 전용으로)",
    nowText === '지금 할 것 2' && (await now.getAttribute('data-kind')) === 'many' && /text-danger-700/.test((await now.locator('span').first().getAttribute('class')) ?? '') &&
      (await p4.getByTestId('step-guide').getByTestId('client-now').count()) === 1 && /sr-only/.test((await p4.getByTestId('step-count').getAttribute('class')) ?? ''),
    `${nowText} | ${guideText}`,
  )
  if (SHOTS) await p4.screenshot({ path: join(SHOTS, 'client-now-pc.png') })
  await now.click()
  const nowSheet = p4.getByTestId('client-now-sheet')
  await nowSheet.waitFor({ timeout: 5000 }).catch(() => {})
  const sheetText = (await nowSheet.innerText().catch(() => '')).replace(/\s+/g, ' ')
  check("N3b 누르면 판 — 보낼 안내 1건 [문구 보기] · 서류 요청 4일째 0/2 [서류함에서 보기]", /보낼 안내 1건 문구 보기/.test(sheetText) && /서류 요청 4일째 0\/2 서류함에서 보기/.test(sheetText), sheetText)
  if (SHOTS) { await p4.waitForTimeout(600); await p4.screenshot({ path: join(SHOTS, 'client-now-sheet-pc.png') }) }
  await nowSheet.getByTestId('now-docreq').click()
  await p4.waitForTimeout(500)
  const pill4 = p4.getByTestId('client-now')
  check(
    "N4 [서류 요청 …] → 서류 탭 · 그 탭에서는 서류 두 가지를 세지 않음(요청한 서류 판이 같은 줄) → 알약은 '보낼 안내 1' 하나",
    new URL(p4.url()).searchParams.get('tab') === 'docs' && (await p4.getByTestId('client-now-sheet').count()) === 0 && (await p4.getByTestId('doc-req-row').count()) === 1 &&
      (await pill4.innerText().catch(() => '')).replace(/\s+/g, ' ').trim() === '보낼 안내 1' && (await pill4.getAttribute('data-kind')) === 'notices',
    await pill4.innerText().catch(() => ''),
  )
  // 하나뿐이면 누르자마자 그 판(목록 판을 거치지 않음)
  await pill4.click()
  const s5 = p4.getByTestId('notice-sheet')
  await s5.waitFor()
  const rows5 = await s5.getByTestId('notice-row').count()
  await s5.getByTestId('notice-sent').first().click()
  await p4.waitForTimeout(800)
  const emptyLine = await s5.getByTestId('notice-empty').count()
  await p4.keyboard.press('Escape')
  await p4.waitForTimeout(300)
  const docsRec = (await stored(p4)).find((c) => c.id === 'c_docs')
  check(
    "N5 하나뿐인 알약 → 바로 문구 판(이 업체 것만 1줄) · [보냈어요] → 다시 부탁한 날이 서류함 요청에 · 판은 '다 보냈어요' 로 남고 · 알약은 사라지고 그 자리는 다시 '일 순서 안내'",
    rows5 === 1 && emptyLine === 1 && docsRec?.docRequests?.[0]?.resentAt === '2026-11-24' && (await p4.getByTestId('client-now').count()) === 0 && !/sr-only/.test((await p4.getByTestId('step-count').getAttribute('class')) ?? '') &&
      /일 순서 안내/.test(await p4.getByTestId('step-count').innerText()) && /오늘 다시|다시 보냄|오늘/.test(await p4.getByTestId('doc-req-row').innerText()),
    { rows5, emptyLine, req: docsRec?.docRequests?.[0], row: await p4.getByTestId('doc-req-row').innerText().catch(() => '') },
  )
  await p4.goto(BASE + '/ops/clients/c_meet', { waitUntil: 'networkidle' })
  await p4.waitForTimeout(600)
  check("N6 다른 업체(내일 미팅) — '보낼 안내 1' 알약 하나", (await p4.getByTestId('client-now').innerText().catch(() => '')).replace(/\s+/g, ' ').trim() === '보낼 안내 1' && (await p4.getByTestId('client-now').getAttribute('data-kind')) === 'notices')
  await p4.goto(BASE + '/ops/clients/c_lead', { waitUntil: 'networkidle' })
  await p4.waitForTimeout(600)
  check("N7 첫 인사를 보낸 잠재고객 — 알약 없음 · 그 자리는 '일 순서 안내'", (await p4.getByTestId('client-now').count()) === 0 && /일 순서 안내/.test(await p4.getByTestId('step-count').innerText().catch(() => '')))
  // 390 — 줄이 옆으로 넘치지 않음
  await p4.setViewportSize({ width: 390, height: 844 })
  await p4.goto(BASE + '/ops/clients/c_meet?tab=overview', { waitUntil: 'networkidle' })
  await p4.waitForTimeout(600)
  const over4 = await p4.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('N8 390 — 옆 넘침 0 · 알약 높이 36px 이상', over4 <= 0 && ((await p4.getByTestId('client-now').boundingBox())?.height ?? 0) >= 36, String(over4))
  if (SHOTS) await p4.screenshot({ path: join(SHOTS, 'client-now-390.png') })
  await c4.close()
}

// ---------------------------------------------------------------- D-666 서류 받았다고 알리기(받은 것 · 남은 것 한 줄 — 사흘째 독촉과 겹치지 않음)
{
  const slug = 'abcdefghij0123456789'
  const got = base('c_got', '(주)서류도착', {
    representativeName: '정도착',
    uploadHint: { slug, until: '2026-12-08' },
    docRequests: [{ id: 'r5', sentAt: '2026-11-20', sentAtIso: '2026-11-20T01:00:00.000Z', title: '서류 요청', items: [{ label: '대표님 생년월일', where: '', doneAt: '2026-11-24' }, { label: '주주 구성 메모', where: '' }] }],
  })
  const { ctx: c5, page: p5 } = await open({ width: 390, height: 844 }, [got])
  const chip = p5.getByTestId('today-notices-open')
  await chip.waitFor({ timeout: 10_000 })
  await chip.click()
  const sheet = p5.getByTestId('notice-sheet')
  await sheet.waitFor()
  const rows = sheet.getByTestId('notice-row')
  const row = rows.first()
  await row.getByTestId('notice-peek').click()
  const text = await row.getByTestId('notice-text').innerText()
  check(
    "N9 D-666 부탁한 서류 하나가 들어온 날 — 한 줄만('받았다고 알리기' · 4일째 독촉 줄은 따로 안 뜸) · '서류 1가지 받음 · 남은 1가지'",
    (await rows.count()) === 1 && (await row.getAttribute('data-kind')) === 'got' && /받았다고 알리기/.test(await row.innerText()) && /서류 1가지 받음 · 남은 1가지/.test(await row.getByTestId('notice-title').innerText()),
    await row.innerText(),
  )
  check(
    'N10 문구 — 잘 받았습니다 · 받은 서류 · 아직 남은 서류 · 올리기 주소(끝인사 앞) · 수수료 · OS 이름 0',
    text.startsWith('안녕하세요, 정도착 대표님.') && /보내 주신 서류 잘 받았습니다/.test(text) && /받은 서류\n1\. 대표님 생년월일/.test(text) && /아직 남은 서류\n1\. 주주 구성 메모/.test(text) &&
      text.includes(`/up/${slug}`) && text.indexOf(`/up/${slug}`) < text.indexOf('편하실 때 보내 주세요') && !/MIRAE|수수료/.test(text),
    text,
  )
  const over5 = await p5.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('N11 390 — 문구를 펼친 판 옆 넘침 0', over5 <= 0, String(over5))
  if (SHOTS) { await p5.waitForTimeout(700); await p5.screenshot({ path: join(SHOTS, 'outbound-got-390.png') }) }
  await row.getByTestId('notice-sent').click()
  await p5.waitForTimeout(800)
  const rec5 = (await stored(p5)).find((c) => c.id === 'c_got')
  check(
    "N12 [보냈어요] → 'got:요청:받은 수' 로 남고 · 남은 것을 같이 부탁했으니 그 요청의 다시 부탁한 날도 오늘 · 목록에서 빠짐",
    rec5?.notices?.['got:r5:1'] === '2026-11-24' && rec5.docRequests?.[0]?.resentAt === '2026-11-24' && (await sheet.getByTestId('notice-row').count()) === 0,
    JSON.stringify({ n: rec5?.notices, r: rec5?.docRequests?.[0]?.resentAt }),
  )
  await p5.keyboard.press('Escape')
  await p5.goto(BASE + '/ops/clients/c_got?tab=overview', { waitUntil: 'networkidle' })
  await p5.waitForTimeout(600)
  const now5 = (await p5.getByTestId('client-now').innerText().catch(() => '')).replace(/\s+/g, ' ')
  check("N13 업체 화면 — 보낼 안내는 없고 알약 하나 '서류 요청함'(기다린 날을 오늘부터 다시 셈 · 1/2 는 누르면 서류함에)", now5.trim() === '서류 요청함' && (await p5.getByTestId('client-now').getAttribute('data-kind')) === 'docreq', now5)
  await c5.close()
}

check('O12 JS 오류 0', errs.length === 0, errs)
await browser.close()
console.log(`\noutbound: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
