/**
 * 튼튼하게 (D-122) — 저장이 실패해도 적은 것이 남고, 한 번 스쳐서는 지워지지 않는다.
 *
 *   node e2e/steady.mjs <baseUrl>
 *
 * 저장 실패는 브라우저 저장소 쓰기를 일부러 막아 흉내 낸다(window.__failKey 에 적힌 키만).
 *
 * 지키려는 것
 *   1. 수금 항목 — 저장이 실패하면 적은 금액이 그대로 · 되면 비워진다 · 소수점 붙여넣기는 100배가 되지 않는다
 *   2. 수금 항목 삭제는 한 번 더 묻고, 지우면 무엇을 얼마 지웠는지 활동 기록에 남는다
 *   3. 계약 정보 시트 — 저장이 실패하면 닫히지 않는다
 *   4. 메모 — 수정 · 삭제 단추에 글자, 삭제는 한 번 더 묻는다, 빈 글로는 저장되지 않는다
 *   5. 업무 기록(업체) — 저장이 실패하면 적은 글이 남는다
 *   6. 오늘 화면 기록 — 수정 · 고정 · 삭제에 글자, 삭제는 확인 창
 *   7. 할 일 시트 — 삭제는 한 번 더 묻는다 · 미래 할 일을 미루면 앞당겨지지 않는다
 *   8. 서류 칸 · 지원사업 삭제도 묻는다
 *   9. (2묶음) 영업 단계를 옮기면 '되돌리기' · 달력 '할 일로 넣기' 글자 · 업체 상세 탭 줄 '›' ·
 *      전략 목록 12 + 더 보기 · 정산 체크 칸 '지급' 글자
 */

import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) { pass++; console.log('PASS ', n) }
  else { fail++; console.log('FAIL ', n, d ?? '') }
}
const CLIENTS = 'axmvp.v1.operations_clients'
const JOURNAL = 'axmvp.v1.ops_journal_entries'
const clients = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '[]'), CLIENTS)
const journal = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '[]'), JOURNAL)
const failOn = (page, key) => page.evaluate((k) => { window.__failKey = k }, key)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

for (const [w, mob] of [[1440, false], [390, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: mob, hasTouch: mob, locale: 'ko-KR' })
  // 저장 실패 흉내 — 이 키에 쓰는 것만 막는다
  await ctx.addInitScript(() => {
    const orig = Storage.prototype.setItem
    Storage.prototype.setItem = function (k, v) {
      if (window.__failKey && k === window.__failKey) throw new Error('저장 실패(시험)')
      return orig.call(this, k, v)
    }
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const tag = `(${w})`

  /* 1 · 2 수금 */
  await page.goto(BASE + '/ops/clients/cli_daum?tab=fees', { waitUntil: 'networkidle' })
  const amount = page.locator('#fee-new-amount')
  await amount.waitFor()
  await amount.fill('3,300,000.00')
  check(`수금: 소수점 붙여넣기는 100배가 되지 않는다 ${tag}`, (await amount.inputValue()) === '3,300,000', await amount.inputValue())
  const before = (await clients(page)).find((c) => c.id === 'cli_daum').fees.length
  await failOn(page, CLIENTS)
  await page.getByRole('button', { name: '추가', exact: true }).click()
  await page.waitForTimeout(700)
  check(`수금: 저장이 실패하면 적은 금액이 남는다 ${tag}`, (await amount.inputValue()) === '3,300,000', await amount.inputValue())
  await failOn(page, null)
  await page.getByRole('button', { name: '추가', exact: true }).click()
  await page.waitForTimeout(700)
  const afterAdd = (await clients(page)).find((c) => c.id === 'cli_daum').fees
  check(`수금: 되면 저장 · 칸이 비워진다 ${tag}`, afterAdd.length === before + 1 && afterAdd.some((f) => f.amount === 3_300_000) && (await amount.inputValue()) === '', `${before} → ${afterAdd.length}`)

  const del = page.getByTestId('fee-delete').first()
  await del.click()
  check(`수금 삭제: 한 번 더 묻는다(아직 그대로) ${tag}`, (await page.getByTestId('fee-delete-yes').count()) === 1 && (await clients(page)).find((c) => c.id === 'cli_daum').fees.length === afterAdd.length)
  await page.getByTestId('fee-delete-yes').click()
  await page.waitForTimeout(600)
  const afterDel = (await clients(page)).find((c) => c.id === 'cli_daum')
  check(`수금 삭제: 지우면 하나 줄고 활동 기록에 남는다 ${tag}`, afterDel.fees.length === afterAdd.length - 1 && afterDel.activity.some((a) => a.text.startsWith('수금 항목 삭제')), afterDel.activity[0]?.text)

  /* 3 계약 정보 시트 */
  await page.goto(BASE + '/ops/clients/cli_daum', { waitUntil: 'networkidle' })
  const contractBtn = page.getByRole('button', { name: /계약 (정보 )?(적기|고치기)/ }).first()
  if ((await contractBtn.count()) > 0) {
    await contractBtn.click()
    const sheet = page.getByRole('dialog')
    await sheet.waitFor()
    await failOn(page, CLIENTS)
    await sheet.getByRole('button', { name: '저장', exact: true }).click()
    await page.waitForTimeout(700)
    check(`계약 시트: 저장이 실패하면 닫히지 않는다 ${tag}`, await sheet.isVisible())
    await failOn(page, null)
    await sheet.getByRole('button', { name: '저장', exact: true }).click()
    await page.waitForTimeout(700)
    check(`계약 시트: 되면 닫힌다 ${tag}`, (await page.getByRole('dialog').count()) === 0)
  } else {
    check(`계약 시트: 여는 단추가 있다 ${tag}`, false)
  }

  /* 4 · 5 기록 탭 — 업무 기록 · 메모 */
  await page.goto(BASE + '/ops/clients/cli_daum?tab=journal', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const cap = page.locator('textarea').first()
  await cap.fill('시험 기록 — 저장 실패해도 남아야 함')
  await failOn(page, JOURNAL)
  await page.getByRole('button', { name: '기록', exact: true }).first().click()
  await page.waitForTimeout(600)
  check(`업체 기록: 저장이 실패하면 적은 글이 남는다 ${tag}`, (await cap.inputValue()).includes('저장 실패해도'))
  await failOn(page, null)
  await page.getByRole('button', { name: '기록', exact: true }).first().click()
  await page.waitForTimeout(600)
  check(`업체 기록: 되면 저장 · 비워진다 ${tag}`, (await cap.inputValue()) === '' && (await journal(page)).some((j) => j.content.includes('저장 실패해도')))

  const memo = page.getByPlaceholder(/대표님 통화/)
  await memo.fill('시험 메모 하나')
  await page.getByRole('button', { name: '메모 추가' }).click()
  await page.waitForTimeout(500)
  const noteLi = page.locator('li', { hasText: '시험 메모 하나' })
  check(`메모: 수정 · 삭제 단추에 글자 ${tag}`, (await noteLi.getByRole('button', { name: '수정' }).count()) === 1 && (await noteLi.getByRole('button', { name: '삭제' }).count()) === 1)
  await noteLi.getByRole('button', { name: '수정' }).click()
  // 고치는 동안에는 글이 칸 안에 있다 — 칸이 있는 줄로 찾는다
  const editLi = page.locator('li').filter({ has: page.locator('textarea') }).filter({ has: page.getByRole('button', { name: '취소' }) }).last()
  const editBox = editLi.locator('textarea')
  await editBox.fill('   ')
  check(`메모: 빈 글로는 저장되지 않는다 ${tag}`, await editLi.getByRole('button', { name: '저장' }).isDisabled())
  await editBox.fill('시험 메모 하나 (고침)')
  await failOn(page, CLIENTS)
  await editLi.getByRole('button', { name: '저장' }).click()
  await page.waitForTimeout(700)
  await failOn(page, null)
  check(`메모: 수정 저장이 실패하면 고치던 칸이 남는다 ${tag}`, (await page.locator('textarea').evaluateAll((els) => els.some((e) => e.value.includes('(고침)')))))
  await editLi.getByRole('button', { name: '저장' }).click()
  await page.waitForTimeout(600)
  const noteLi2 = page.locator('li', { hasText: '시험 메모 하나 (고침)' })
  await noteLi2.getByRole('button', { name: '삭제' }).click()
  check(`메모: 삭제는 한 번 더 묻는다 ${tag}`, ((await noteLi2.innerText()) ?? '').includes('이 메모를 지울까요?'))
  await noteLi2.getByRole('button', { name: '지우기' }).click()
  await page.waitForTimeout(600)
  check(`메모: 지우면 사라진다 ${tag}`, (await page.locator('li', { hasText: '시험 메모 하나 (고침)' }).count()) === 0)

  /* 6 오늘 화면 기록 */
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const qc = page.getByPlaceholder(/무슨 일이 있었나요/).first()
  await qc.fill('오늘 시험 기록')
  await page.getByRole('button', { name: '기록', exact: true }).first().click()
  await page.waitForTimeout(600)
  const row = page.locator('li', { hasText: '오늘 시험 기록' }).first()
  check(`오늘 기록: 수정 · 고정 · 삭제에 글자 ${tag}`, (await row.getByRole('button', { name: '수정' }).count()) === 1 && (await row.getByRole('button', { name: '고정' }).count()) === 1 && (await row.getByRole('button', { name: '삭제' }).count()) === 1)
  await row.getByRole('button', { name: '삭제' }).click()
  const dlg = page.getByRole('dialog')
  check(`오늘 기록: 삭제는 확인 창 ${tag}`, (await dlg.count()) === 1 && ((await dlg.innerText()) ?? '').includes('오늘 시험 기록'))
  await dlg.getByRole('button', { name: '취소' }).click()
  check(`오늘 기록: 취소하면 그대로 ${tag}`, (await journal(page)).some((j) => j.content === '오늘 시험 기록'))

  /* 7 할 일 시트 — 삭제 묻기 · 미래 할 일 미루기 */
  const future = await page.evaluate((k) => {
    const d = new Date()
    d.setDate(d.getDate() + 10)
    const p = (x) => String(x).padStart(2, '0')
    const due = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    const list = JSON.parse(localStorage.getItem(k) ?? '[]')
    const now = new Date().toISOString()
    list.unshift({ id: 'j_future', workspaceId: null, ownerId: null, entryDate: due, entryType: 'follow_up', content: '열흘 뒤 할 일', clientId: null, projectId: null, serviceKey: null, dueDate: due, pinned: false, completed: false, completedAt: null, createdAt: now, updatedAt: now })
    localStorage.setItem(k, JSON.stringify(list))
    return due
  }, JOURNAL)
  await page.goto(BASE + '/ops/calendar', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  if ((await page.locator(`[data-date="${future}"]`).count()) === 0) {
    await page.getByRole('button', { name: '다음 달' }).first().click()
    await page.waitForTimeout(300)
  }
  await page.locator(`[data-date="${future}"]`).first().click()
  await page.waitForTimeout(300)
  await page.getByLabel('선택한 날짜').getByText('열흘 뒤 할 일').first().click()
  const sheet = page.getByRole('dialog')
  await sheet.getByText('삭제', { exact: true }).click()
  check(`할 일 시트: 삭제는 한 번 더 묻는다 ${tag}`, (await page.getByTestId('todo-delete-confirm').count()) === 1 && (await journal(page)).some((j) => j.id === 'j_future'))
  await sheet.getByText('내일로 미루기', { exact: true }).click()
  await page.waitForTimeout(600)
  const moved = (await journal(page)).find((j) => j.id === 'j_future')
  check(`할 일: 미래 할 일을 미루면 앞당겨지지 않는다(그 다음 날) ${tag}`, !!moved && moved.dueDate > future, `${future} → ${moved?.dueDate}`)

  /* 8 서류 칸 · 지원사업 */
  await page.goto(BASE + '/ops/clients/cli_daum?tab=funding', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const fundDel = page.getByRole('button', { name: '삭제', exact: true }).first()
  if ((await fundDel.count()) > 0) {
    const n0 = (await clients(page)).find((c) => c.id === 'cli_daum').fundingApplications.length
    await fundDel.click()
    check(`지원사업 삭제: 한 번 더 묻는다 ${tag}`, (await page.getByRole('button', { name: '지우기' }).count()) >= 1 && (await clients(page)).find((c) => c.id === 'cli_daum').fundingApplications.length === n0)
  } else {
    check(`지원사업: 시드에 신청 건이 있다 ${tag}`, false)
  }

  /* 9 (2묶음) 영업 단계 되돌리기 · 달력 '할 일로 넣기' 글자 · 탭 줄 '›' · 전략 목록 12 + 더 보기 · 정산 '지급' 글자 */
  await page.goto(BASE + '/sales/board', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const sel = page.locator('select[aria-label="미래바이오랩 영업 단계"]:visible').first()
  if ((await sel.count()) === 0) {
    // 좁은 화면 보드는 단계를 골라서 본다 — 잠재 고객 칸
    await page.getByRole('button', { name: /잠재 고객/ }).first().click().catch(() => {})
    await page.waitForTimeout(300)
  }
  await page.locator('select[aria-label="미래바이오랩 영업 단계"]:visible').first().selectOption('lost')
  await page.waitForTimeout(500)
  const undoBtn = page.getByTestId('toast-action')
  check(`영업 단계: 옮기면 '되돌리기' 가 뜬다 ${tag}`, (await undoBtn.count()) >= 1 && ((await undoBtn.first().innerText()) ?? '').includes('되돌리기'))
  await undoBtn.first().click()
  await page.waitForTimeout(600)
  const back = (await clients(page)).find((c) => c.id === 'cli_mirae')
  check(`영업 단계: 되돌리기를 누르면 원래 단계로 ${tag}`, (back.sales?.stage ?? 'lead') !== 'lost', back.sales?.stage)

  await page.goto(BASE + '/ops/calendar', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const todoBtns = page.getByRole('button', { name: /할 일로 넣기$/ })
  if ((await todoBtns.count()) > 0) {
    check(`달력: '할 일로 넣기' 가 글자로 보인다 ${tag}`, ((await todoBtns.first().innerText()) ?? '').includes('할 일로 넣기'))
  }

  if (mob) {
    await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    check(`업체 상세 휴대폰: 오른쪽에 탭이 더 있다는 '›' ${tag}`, (await page.locator('[role="tablist"][aria-label="업체 상세"]').locator('xpath=..').getByTestId('scroll-more').count()) === 1)
  }

  await page.goto(BASE + '/sales/strategy', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check(`전략: 처음엔 12개 + 더 보기 ${tag}`, (await page.getByTestId('library-list').locator('> li').count()) === 12 && ((await page.getByTestId('library-more').innerText()) ?? '').includes('64개 더 보기'))
  await page.getByTestId('library-more').click()
  check(`전략: 더 보기를 누르면 76개 전부 ${tag}`, (await page.getByTestId('library-list').locator('> li').count()) === 76)

  await page.goto(BASE + '/ops/agents', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check(`정산: 체크 칸에 '지급' 글자 ${tag}`, (await page.locator('main label', { hasText: '지급' }).count()) >= 1)

  check(`JS 오류 없음 ${tag}`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(`\n튼튼하게: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
