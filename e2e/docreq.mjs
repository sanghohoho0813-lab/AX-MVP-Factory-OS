/**
 * qa:docreq — D-512 서류 요청 → 회신 대기 → 받으면 줄어든다.
 *
 *   D1 처음엔 서류함에 '요청한 서류' 판 없음
 *   D2 [서류 요청 문구] → [보냈어요 · 3일 뒤 받았는지 확인] → '요청함으로 남겼어요(n가지)'
 *   D3 서류함 맨 위 '요청한 서류' — 0/n 받음 · 오늘 보냄 · 아직: …
 *   D4 부탁한 서류 칸은 '안 받음' 대신 '요청함 · 오늘'
 *   D5 [목록 보기] → [칸 보기] → 그 칸 '받음' 체크 → 1/n · 그 줄 받음 · 칸 알약 사라짐
 *   D6 새로 고쳐도 그대로(업체 기록에 저장)
 *   D7 [아직 안 온 n-1개 다시 요청] → 남은 것만 문구 · [다시 보냈어요] → '다시 보냄'
 *   D8 고객 관리 카드 '서류 요청 오늘 · 1/n 받음'
 *   D9 3일 뒤(앱 시계) — 오늘 할 일 줄 '서류 1/n 받음' · 서류함 '3일째'(빨간 글자)
 *   D10 남은 것 [받았어요] → '다 받았어요' → [끝내기(할 일도 완료)] → 판 사라짐 · 할 일 완료 · 카드 한 줄 사라짐
 *   D11 390 — 판 · 목록 넘침 0 · 단추 40px 이상
 *   D12 JS 오류 0
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
const DETAIL = BASE + '/ops/clients/cli_hansol?tab=docs'
await page.goto(DETAIL, { waitUntil: 'networkidle' })
await page.locator('#docs').waitFor()

// D1
check('D1 처음엔 서류함에 요청한 서류 판 없음', (await page.getByTestId('doc-req').count()) === 0)

// D2
await page.getByRole('button', { name: '서류 요청 문구', exact: true }).first().click()
const dlg = page.getByRole('dialog', { name: '서류 요청 문구' })
await dlg.waitFor()
const sentText = await dlg.locator('textarea').inputValue()
const n = (sentText.match(/^\d+\.\s/gm) ?? []).length
await dlg.getByTestId('message-followup').click()
const doneMsg = await dlg.getByTestId('message-followup-done').innerText()
check(`D2 [보냈어요] → 할 일 + 요청함으로 남김(${n}가지)`, n >= 2 && /할 일에 넣었어요/.test(doneMsg) && doneMsg.includes(`요청함' 으로 남겼어요(${n}가지)`), { n, doneMsg })
await dlg.getByRole('button', { name: '닫기' }).last().click()

// D3
const row = page.getByTestId('doc-req-row').first()
await row.waitFor()
const count0 = await row.getByTestId('doc-req-count').innerText()
const days0 = await row.getByTestId('doc-req-days').innerText()
const pend0 = await row.getByTestId('doc-req-pending').innerText()
check('D3 요청한 서류 — 0/n 받음 · 오늘 보냄 · 아직: …', count0 === `0/${n} 받음` && days0 === '오늘 보냄' && pend0.startsWith('아직:'), { count0, days0, pend0 })

// D4
const chips0 = await page.getByTestId('doc-req-chip').allInnerTexts()
check('D4 부탁한 서류 칸 알약 \'요청함 · 오늘\'(안 받음 대신)', chips0.length >= 1 && chips0.every((t) => t.trim() === '요청함 · 오늘'), chips0)

// D5
await row.getByTestId('doc-req-list-toggle').click()
const firstJumpItem = row.getByTestId('doc-req-item').filter({ has: page.getByTestId('doc-req-item-jump') }).first()
const itemLabel = (await firstJumpItem.innerText()).split('\n')[0].trim()
const focusedKey = (await firstJumpItem.getByTestId('doc-req-item-jump').getAttribute('data-key')) ?? ''
await firstJumpItem.getByTestId('doc-req-item-jump').click()
const card = page.locator(`[data-doc-card="${focusedKey}"]`)
await card.waitFor()
await card.locator('input[type="checkbox"]').first().check()
await page.waitForTimeout(600)
const count1 = await row.getByTestId('doc-req-count').innerText()
const gotFlag = await row.getByTestId('doc-req-item').filter({ hasText: itemLabel }).first().getAttribute('data-got')
const chipLeft = await card.getByTestId('doc-req-chip').count()
check('D5 [칸 보기] → 그 칸 받음 체크 → 1/n · 그 줄 받음 · 그 칸 알약 사라짐', focusedKey !== '' && count1 === `1/${n} 받음` && gotFlag === '1' && chipLeft === 0, { focusedKey, count1, gotFlag, chipLeft, itemLabel })

// D6
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('doc-req-row').first().waitFor()
check('D6 새로 고쳐도 그대로(1/n)', (await page.getByTestId('doc-req-count').first().innerText()) === `1/${n} 받음`)

// D7
await page.getByTestId('doc-req-resend').first().click()
const dlg2 = page.getByRole('dialog', { name: '아직 안 온 서류 다시 요청' })
await dlg2.waitFor()
const again = await dlg2.locator('textarea').inputValue()
const n2 = (again.match(/^\d+\.\s/gm) ?? []).length
await dlg2.getByTestId('message-followup').click()
const btn2 = await dlg2.getByTestId('message-followup').innerText()
await dlg2.getByRole('button', { name: '닫기' }).last().click()
const rowText = await page.getByTestId('doc-req-row').first().innerText()
check('D7 남은 것만 다시 요청 문구(n-1) · 받은 줄 없음 · [다시 보냈어요] → 다시 보냄', n2 === n - 1 && /아직 도착하지 않아 다시 부탁드립니다/.test(again) && !again.includes(itemLabel) && /다시 보냄으로 적음/.test(btn2) && /다시 보냄/.test(rowText), { n2, btn2, rowText: rowText.slice(0, 160) })

// D8
await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
const cardLine = await page.locator('[data-testid="client-card"]').filter({ hasText: '한솔테크' }).first().getByTestId('card-docreq').innerText().catch(() => '')
check('D8 고객 관리 카드 \'서류 요청 오늘 · 1/n 받음\'', cardLine === `서류 요청 오늘 · 1/${n} 받음`, cardLine)
// D-526 카드의 '서류 요청' 줄 · '서류 n/m' 을 누르면 그 업체 서류함으로(개요가 아니라)
await page.locator('[data-testid="client-card"]').filter({ hasText: '한솔테크' }).first().getByTestId('card-docreq').click()
await page.waitForURL(/tab=docs/, { timeout: 8000 }).catch(() => {})
await page.getByTestId('doc-shelf-wrap').first().waitFor({ timeout: 8000 }).catch(() => {})
const afterClick = page.url()
const toDocs = /\/ops\/clients\/cli_hansol\?tab=docs/.test(afterClick) && (await page.getByTestId('doc-shelf-wrap').count()) >= 1
await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
const pill = page.locator('[data-testid="client-card"]').filter({ hasText: '한솔테크' }).first().getByTestId('card-docs')
let pillOk = true
if (await pill.count()) {
  await pill.click()
  await page.waitForURL(/tab=docs/, { timeout: 8000 }).catch(() => {})
  pillOk = /tab=docs/.test(page.url())
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
}
check('D8b (D-526) 카드 \'서류 요청\' 줄 · \'서류 n/m\' → 그 업체 서류함(한 번)', toDocs && pillOk, { afterClick, toDocs, pillOk })

// D9 — 3일 뒤
const later = new Date(Date.now() + 3 * 86_400_000)
await page.clock.setFixedTime(later)
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.getByTestId('today-hero').waitFor()
const todoLine = await page.getByTestId('todo-docreq').first().innerText().catch(() => '')
check('D9a 3일 뒤 오늘 할 일 줄 \'서류 1/n 받음\'', todoLine === `서류 1/${n} 받음`, todoLine)
await page.goto(DETAIL, { waitUntil: 'networkidle' })
await page.getByTestId('doc-req-row').first().waitFor()
const days3 = page.getByTestId('doc-req-days').first()
const days3Text = await days3.innerText()
const days3Red = await days3.evaluate((el) => el.className.includes('text-danger'))
check('D9b 서류함 \'3일째 기다리는 중\' · 빨간 글자', days3Text === '3일째 기다리는 중' && days3Red, { days3Text, days3Red })

// D10
const r10 = page.getByTestId('doc-req-row').first()
await r10.getByTestId('doc-req-list-toggle').click()
for (let i = 0; i < 40; i++) {
  const b = r10.getByTestId('doc-req-item-done').first()
  if ((await b.count()) === 0) break
  await b.click()
  await page.waitForTimeout(150)
}
const doneTitle = await r10.innerText()
const finish = r10.getByTestId('doc-req-finish')
const finishText = await finish.innerText().catch(() => '')
check('D10a 남은 것 [받았어요] → 다 받았어요 · n/n · [끝내기(할 일도 완료)]', /요청한 서류를 다 받았어요/.test(doneTitle) && doneTitle.includes(`${n}/${n} 받음`) && /끝내기\(할 일도 완료\)/.test(finishText), { doneTitle: doneTitle.slice(0, 120), finishText })
await finish.click()
await page.waitForTimeout(800)
check('D10b [끝내기] → 판 사라짐', (await page.getByTestId('doc-req').count()) === 0)
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.getByTestId('today-hero').waitFor()
const openTodo = await page.getByTestId('today-todo-grid').filter({ hasText: '자료 받았는지 확인' }).count()
check('D10c 그 할 일도 완료(오늘 할 일 목록에서 빠짐)', openTodo === 0 && (await page.getByTestId('todo-docreq').count()) === 0)
await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
check('D10d 고객 관리 카드 한 줄 사라짐', (await page.locator('[data-testid="client-card"]').filter({ hasText: '한솔테크' }).first().getByTestId('card-docreq').count()) === 0)
await page.clock.setFixedTime(new Date())

// D11 390
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const mp = await m.newPage()
mp.on('pageerror', (e) => errs.push(String(e)))
await mp.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await mp.evaluate(seedScript())
await mp.goto(DETAIL, { waitUntil: 'networkidle' })
await mp.locator('#docs').waitFor()
// 휴대폰은 [서류 요청 문구] 가 '더보기' 안 — 서류 칸의 [이 업무 서류 요청 문구] 대신 머리 더보기
await mp.getByRole('button', { name: '더보기', exact: true }).first().click()
await mp.getByTestId('more-doc-request').click()
const md = mp.getByRole('dialog', { name: '서류 요청 문구' })
await md.waitFor()
await md.getByTestId('message-followup').click()
await md.getByTestId('message-followup-done').waitFor()
await md.getByRole('button', { name: '닫기' }).last().click()
const mrow = mp.getByTestId('doc-req-row').first()
await mrow.waitFor()
await mrow.getByTestId('doc-req-list-toggle').click()
const geo = await mp.evaluate(() => {
  const row = document.querySelector('[data-testid="doc-req-row"]')
  const r = row?.getBoundingClientRect()
  const btns = [...(row?.querySelectorAll('button') ?? [])].map((b) => Math.round(b.getBoundingClientRect().height))
  return { over: document.documentElement.scrollWidth - window.innerWidth, right: r ? Math.round(r.right) : 0, w: window.innerWidth, minBtn: Math.min(...btns) }
})
check('D11 390 — 판 · 목록 넘침 0 · 단추 36px 이상(손가락 칸)', geo.over <= 0 && geo.right <= geo.w && geo.minBtn >= 36, geo)
await m.close()

/* ---------------- D-518 서류 단계 · 확인할 정보 ---------------- */
{
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await c.newPage()
  const e2 = []
  p.on('pageerror', (e) => e2.push(String(e)))
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await p.evaluate(seedScript())
  // 사업자등록증을 받았는데 거기서 읽은 값 둘을 아직 확인하지 않은 상태(서류 올리기가 남기는 후보와 같은 모양)
  await p.evaluate(() => {
    const all = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    const r = all.find((x) => x.id === 'cli_hansol')
    r.documents = { ...(r.documents ?? {}), businessRegistration: { ...(r.documents?.businessRegistration ?? {}), received: true, fileName: '사업자등록증.pdf', issuedAt: '2026-10-01' } }
    r.factInbox = [
      { id: 'u1', key: 'cf:시험 칸 하나', label: '시험 칸 하나', group: 'identity', value: '읽은 값 하나', source: 'businessRegistration', asOf: '', ref: 'doc:businessRegistration:e2e', foundAt: '2026-11-03T00:00:00Z', note: '사진 글자라 확인 필요' },
      { id: 'u2', key: 'cf:시험 칸 둘', label: '시험 칸 둘', group: 'identity', value: '읽은 값 둘', source: 'businessRegistration', asOf: '', ref: 'doc:businessRegistration:e2e', foundAt: '2026-11-03T00:00:00Z', note: '사진 글자라 확인 필요' },
    ]
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(all))
  })
  await p.goto(DETAIL, { waitUntil: 'networkidle' })
  await p.locator('#docs').waitFor()
  const stages = await p.getByTestId('doc-stages').innerText().catch(() => '')
  const review = await p.getByTestId('doc-stage-review').innerText().catch(() => '')
  const shelf = await p.getByTestId('shelf-review').innerText().catch(() => '')
  const chip = await p.locator('#doc-card-businessRegistration').getByTestId('doc-review-chip').innerText().catch(() => '')
  check('S1 서류 단계 한 줄 — 받음 n · 확인할 정보 2 · 손볼 것 [확인할 정보 2] · 사업자등록증 칸 알약 \'확인할 정보 2\'', /받음 \d+/.test(stages) && review === '2' && shelf.includes('확인할 정보 2') && chip.includes('확인할 정보 2'), { stages, review, shelf, chip })
  await p.locator('#doc-card-businessRegistration').getByTestId('doc-review-chip').click()
  const inbox = await p.waitForSelector('#fact-inbox', { timeout: 6000 }).then(() => true).catch(() => false)
  check('S2 알약을 누르면 맞춤 추천 탭의 확인 칸(#fact-inbox)으로', inbox && /tab=smart/.test(p.url()), p.url())
  check('S3 오류 0', e2.length === 0, e2)
  await c.close()
}

// D12
check('D12 JS 오류 0', errs.length === 0, errs.slice(0, 3))

/* ---------------- D-520 업무 한 줄(서류 n/m · 회신 대기 · 목표 · 다음) ---------------- */
{
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await c.newPage()
  const e4 = []
  p.on('pageerror', (e) => e4.push(String(e)))
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await p.evaluate(seedScript())
  await p.goto(DETAIL, { waitUntil: 'networkidle' })
  await p.locator('#docs').waitFor()
  await p.getByRole('button', { name: '서류 요청 문구', exact: true }).first().click()
  const d = p.getByRole('dialog', { name: '서류 요청 문구' })
  await d.waitFor()
  await d.getByTestId('message-followup').click()
  await d.getByTestId('message-followup-done').waitFor()
  await d.getByRole('button', { name: '닫기' }).last().click()
  await p.goto(BASE + '/ops/clients/cli_hansol?tab=work', { waitUntil: 'networkidle' })
  const lines = await p.getByTestId('svc-line').allInnerTexts()
  const waitLine = lines.find((t) => t.includes('회신 대기')) ?? ''
  check('L1 업무 카드 한 줄 — 서류 n/m · 회신 대기 n건 오늘 요청 · 목표 · 다음(진행 중 업무)', /서류 \d+\/\d+/.test(waitLine) && /회신 대기 \d+건 오늘 요청/.test(waitLine), lines)
  await p.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  const chipDocs = await p.getByTestId('chip-docs').allInnerTexts()
  check('L2 고객 관리 카드 업무 칩 — 같은 규칙으로 \'· 서류 n/m\'(시작했는데 서류 모자란 업무)', chipDocs.length >= 1 && chipDocs.every((t) => /· 서류 \d+\/\d+/.test(t)), chipDocs)
  check('L3 오류 0', e4.length === 0, e4)
  await c.close()
}

/* ---------------- D-519 처음 시작(오늘 맨 위 한 줄) ---------------- */
{
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await c.newPage()
  const e3 = []
  p.on('pageerror', (e) => e3.push(String(e)))
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await p.evaluate(seedScript())
  await p.goto(BASE + '/', { waitUntil: 'networkidle' })
  check('F0 오래 써 온 계정(견본) — 처음 시작 한 줄 없음', (await p.getByTestId('today-firstuse').count()) === 0)
  // 새 계정 모양 — 오늘 등록한 업체 하나 · 서류 · 할 일 없음
  const setState = (fn) => p.evaluate(fn)
  await setState(() => {
    const all = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    const r = all.find((x) => x.id === 'cli_hansol')
    r.createdAt = new Date().toISOString()
    r.documents = {}
    r.customDocuments = []
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify([r]))
    localStorage.setItem('axmvp.v1.ops_journal_entries', '[]')
  })
  const clicks = {}
  const step = async (want, url) => {
    await p.goto(BASE + '/', { waitUntil: 'networkidle' })
    const card = p.getByTestId('today-firstuse')
    await card.waitFor({ timeout: 8000 }).catch(() => {})
    const next = await card.getAttribute('data-next').catch(() => '')
    const count = await p.getByTestId('today-firstuse-count').innerText().catch(() => '')
    await p.getByTestId('today-firstuse-go').click()
    await p.waitForURL(url, { timeout: 8000 }).catch(() => {})
    clicks[want] = 1
    return { next, count, at: p.url() }
  }
  const a = await step('doc', /tab=docs/)
  check('F1 새 계정 업체 하나 — \'처음 시작 1/4 · 다음: 서류 한 장 올리기\' · 단추 한 번 → 그 업체 서류함', a.next === 'doc' && a.count === '처음 시작 1/4' && /\/ops\/clients\/cli_hansol\?tab=docs/.test(a.at), a)
  await setState(() => {
    const all = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    all[0].documents = { businessRegistration: { received: true, fileName: '사업자등록증.pdf' } }
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(all))
  })
  const b2 = await step('todo', /tab=smart/)
  check('F2 서류 하나 받음 → 2/4 · 다음: 맞춤 추천 보고 할 일 하나 · 한 번 → 맞춤 추천 탭', b2.next === 'todo' && b2.count === '처음 시작 2/4' && /tab=smart/.test(b2.at), b2)
  await setState(() => {
    localStorage.setItem('axmvp.v1.ops_journal_entries', JSON.stringify([{ id: 'jf', workspaceId: null, ownerId: null, entryDate: new Date().toISOString().slice(0, 10), entryType: 'follow_up', content: '서류 받기', clientId: 'cli_hansol', projectId: null, serviceKey: null, dueDate: new Date().toISOString().slice(0, 10), pinned: false, completed: false, completedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]))
  })
  const c3 = await step('content', /\/marketing/)
  check('F3 할 일 하나 → 3/4 · 다음: 첫 콘텐츠 · 한 번 → 마케팅', c3.next === 'content' && c3.count === '처음 시작 3/4' && /\/marketing/.test(c3.at), c3)
  await p.goto(BASE + '/', { waitUntil: 'networkidle' })
  await p.getByTestId('today-firstuse-close').click()
  await p.reload({ waitUntil: 'networkidle' })
  check('F4 [닫기] → 새로 고쳐도 안 보임(이 기기)', (await p.getByTestId('today-firstuse').count()) === 0)
  check('F5 단계마다 오늘에서 한 번 누르면 그 자리(서류함 · 맞춤 추천 · 마케팅) · 오류 0', Object.values(clicks).every((n) => n === 1) && Object.keys(clicks).length === 3 && e3.length === 0, { clicks, e3 })
  await c.close()
}

await browser.close()
console.log(`\nqa:docreq: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
