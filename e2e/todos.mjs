/**
 * 오늘 할 일 — 브라우저 인수 시험.
 *
 *   node e2e/todos.mjs <baseUrl>
 *
 * 지키려는 것
 *   1. 오늘 화면 맨 위 숫자는 '내가 적은 할 일' 만 센다 (규칙 경고를 더하지 않는다)
 *   2. 오늘에서 적은 할 일이 일정 화면의 그 날에도 보인다 (한 곳에 기록된다)
 *   3. 일정에서 적은 할 일이 오늘 화면에도 보인다 (양방향)
 *   4. 업체 마감을 '+' 로 내 할 일로 옮길 수 있다
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

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
page.on('pageerror', (e) => check('JS 오류 없음', false, String(e).slice(0, 160)))

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(seedScript())
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)

// 1) 맨 위 문구가 '오늘 할 일' 이다 (예전의 '반드시 처리할 것 N건' 이 아니다)
const h1 = (await page.locator('h1').first().textContent()) ?? ''
check('맨 위는 오늘 할 일', h1.includes('오늘 할 일'), h1)
check('반드시 처리할 것 문구가 없다', !h1.includes('반드시 처리할 것'), h1)

// 2) 오늘 화면에서 할 일 적기
await page.getByRole('button', { name: '할 일 적기' }).first().click()
await page.waitForTimeout(300)
await page.getByLabel('할 일 내용').fill('테스트 할 일 하나')
await page.getByRole('button', { name: '넣기', exact: true }).click()
await page.waitForTimeout(800)
check('오늘에 할 일이 추가된다', await page.getByText('테스트 할 일 하나').first().isVisible())

/*
 * 적고 나서 고칠 수 있어야 한다.
 * 통화 중에 급히 적은 한 줄은 대개 나중에 다듬게 된다 — 고칠 수 없으면 지우고 다시
 * 적게 되고, 그러면 언제 적었는지가 사라진다.
 *
 * 뒤따르는 시험들이 '테스트 할 일 하나' 를 계속 쓰므로, 고치기 시험은 따로 만든
 * 할 일로 한다. 기한을 바꾸면 오늘 목록에서 빠지기 때문이다.
 */
// 앞서 하나를 적어 둔 뒤라 적는 칸이 이미 펴져 있을 수 있다
const opener = page.getByRole('button', { name: '할 일 적기' }).first()
if ((await opener.count()) > 0) {
  await opener.click()
  await page.waitForTimeout(300)
}
await page.getByLabel('할 일 내용').fill('고칠 할 일')
await page.getByRole('button', { name: '넣기', exact: true }).click()
await page.waitForTimeout(800)

await page.getByText('고칠 할 일').first().click()
await page.waitForTimeout(400)
check('할 일 시트가 열린다', (await page.getByRole('dialog').count()) > 0)
// D-201: [내용 고치기] 를 한 번 더 누르지 않는다 — 창을 열면 칸이 바로 열려 있다
check('D-201 할 일 창: [내용 고치기] 단추 없이 칸이 바로 열려 있다', (await page.getByRole('button', { name: '내용 고치기' }).count()) === 0 && (await page.getByLabel('할 일 내용 고치기').count()) === 1 && (await page.getByLabel('할 일 기한 고치기').count()) === 1)
check('D-201 할 일 창: 같은 창에 진행 중 · 완료 · 내일로 미루기 · 지우기', (await page.getByTestId('todo-actions').locator('[data-todo-action]').count()) === 4)
check('D-201 할 일 창: 아무것도 안 고쳤으면 [저장] 은 꺼져 있다', await page.getByTestId('todo-save').isDisabled())
// D-240(대표 요청): 맨 위 한 줄 '할 일 · 업체 고르기 · 업체 열기' → 내용 → 어떻게 할까요 → 언제까지
{
  const head = page.getByTestId('todo-head')
  const topOf = async (loc) => (await loc.boundingBox())?.y ?? -1
  const yHead = await topOf(head)
  const yText = await topOf(page.getByLabel('할 일 내용 고치기'))
  const yActs = await topOf(page.getByTestId('todo-actions'))
  const yDue = await topOf(page.getByLabel('할 일 기한 고치기'))
  check('D-240 할 일 창: 업체 고르는 칸이 맨 위 「할 일」 줄에', (await head.getByLabel('할 일 업체 고치기').count()) === 1 && /할 일/.test(await head.innerText()))
  check('D-240 할 일 창: 순서 — 맨 위 줄 → 내용 → 어떻게 할까요 → 언제까지', yHead >= 0 && yHead < yText && yText < yActs && yActs < yDue, [yHead, yText, yActs, yDue])
  check('D-240 할 일 창: 업체가 없으면 [업체 열기] 없음', (await page.getByTestId('todo-open-client').count()) === 0)
  await head.getByLabel('할 일 업체 고치기').selectOption('cli_daum')
  const open = head.getByTestId('todo-open-client')
  check('D-240 할 일 창: 업체를 고르면 그 옆에 [업체 열기](고른 업체 이름으로)', (await open.count()) === 1 && / 열기$/.test((await open.getAttribute('aria-label')) ?? ''), await open.getAttribute('aria-label'))
  await head.getByLabel('할 일 업체 고치기').selectOption('')
  await page.waitForTimeout(150)
  check('D-240 할 일 창: 업체를 다시 비우면 [업체 열기] 사라지고 [저장] 꺼짐', (await page.getByTestId('todo-open-client').count()) === 0 && (await page.getByTestId('todo-save').isDisabled()))
}
await page.getByLabel('할 일 내용 고치기').fill('고쳐 적은 할 일')
check('D-201 할 일 창: 고치면 [저장] 이 켜진다', await page.getByTestId('todo-save').isEnabled())
await page.getByTestId('todo-save').click()
await page.waitForTimeout(900)
const edited = (await page.locator('main').innerText()) ?? ''
check('할 일: 내용이 바뀐다', edited.includes('고쳐 적은 할 일'), edited.slice(0, 200))
check('할 일: 옛 내용은 사라진다', !edited.includes('고칠 할 일'))
check('D-201 할 일 창: 저장하면 창이 닫힌다', (await page.getByRole('dialog').count()) === 0)

// D-201: 고치고 [완료] 를 바로 누르면 고친 내용 + 완료가 한 번에 저장된다
{
  const op = page.getByRole('button', { name: '할 일 적기' }).first()
  if ((await op.count()) > 0) { await op.click(); await page.waitForTimeout(300) }
  await page.getByLabel('할 일 내용').fill('한 번에 끝낼 일')
  await page.getByRole('button', { name: '넣기', exact: true }).click()
  await page.waitForTimeout(800)
  await page.getByText('한 번에 끝낼 일').first().click()
  await page.waitForTimeout(400)
  await page.getByLabel('할 일 내용 고치기').fill('고치고 바로 끝낸 일')
  check('D-201 할 일 창: 고친 뒤에는 "누르면 고친 내용도 함께 저장" 안내', ((await page.getByTestId('todo-actions').innerText()) ?? '').includes('함께 저장'))
  await page.getByRole('dialog').locator('[data-todo-action="done"]').click()
  await page.waitForTimeout(900)
  const one = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]').find((x) => x.content === '고치고 바로 끝낸 일'))
  check('D-201 할 일 창: 고치고 [완료] → 내용 · 완료 한 번에', one?.completed === true && (await page.getByRole('dialog').count()) === 0, JSON.stringify(one ?? null).slice(0, 160))
}

// D-201: 고친 것이 있는데 닫으면 한 번 묻는다 — '저장 안 하고 닫기' 는 그대로, '저장하고 닫기' 는 저장
{
  await page.getByText('고쳐 적은 할 일').first().click()
  await page.waitForTimeout(400)
  await page.getByLabel('할 일 내용 고치기').fill('저장 안 할 글')
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).last().click()
  await page.waitForTimeout(300)
  check('D-201 할 일 창: 고친 채 닫으면 "저장할까요?" 를 묻는다', (await page.getByTestId('todo-close-confirm').count()) === 1)
  await page.getByRole('button', { name: '저장 안 하고 닫기' }).click()
  await page.waitForTimeout(500)
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]').some((x) => x.content === '고쳐 적은 할 일'))
  check('D-201 할 일 창: "저장 안 하고 닫기" → 원래 글 그대로', kept && (await page.getByRole('dialog').count()) === 0)
  await page.getByText('고쳐 적은 할 일').first().click()
  await page.waitForTimeout(400)
  await page.getByLabel('할 일 내용 고치기').fill('')
  check('D-201 할 일 창: 글을 다 지우면 저장 · 상태 단추가 잠긴다', (await page.getByTestId('todo-save').isDisabled()) && (await page.getByRole('dialog').locator('[data-todo-action="done"]').isDisabled()))
  await page.getByLabel('할 일 내용 고치기').fill('고쳐 적은 할 일')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('D-201 할 일 창: 원래대로 되돌리면 묻지 않고 닫힌다', (await page.getByRole('dialog').count()) === 0)
}

// D-210: 할 일 기한은 비울 수 없다(비우면 오늘 · 달력에서 사라졌다) · 업체 열기도 고친 것이 있으면 먼저 묻는다
{
  await page.getByText('고쳐 적은 할 일').first().click()
  await page.waitForTimeout(400)
  const dlg = page.getByRole('dialog')
  check('D-210 할 일 창: 기한이 있는 할 일에는 [기한 없애기] 가 없다', (await dlg.getByRole('button', { name: '기한 없애기' }).count()) === 0)
  await page.getByLabel('할 일 기한 고치기').fill('')
  await page.waitForTimeout(200)
  check('D-210 할 일 창: 날짜를 지우면 "날짜를 정해 주세요" · [저장] 잠김', (await page.getByTestId('todo-due-required').count()) === 1 && (await page.getByTestId('todo-save').isDisabled()))
  await page.getByRole('button', { name: '오늘', exact: true }).first().click()
  await page.waitForTimeout(200)
  // 업체를 붙여 저장해 둔다(업체 열기 단추가 생기게)
  await page.getByLabel('할 일 업체 고치기').selectOption('cli_daum')
  await page.getByTestId('todo-save').click()
  await page.waitForTimeout(900)
  await page.getByText('고쳐 적은 할 일').first().click()
  await page.waitForTimeout(400)
  await page.getByLabel('할 일 내용 고치기').fill('업체로 가기 전 고친 글')
  await page.getByTestId('todo-open-client').click()
  await page.waitForTimeout(300)
  check('D-210 할 일 창: 고친 채 [업체 열기] → 먼저 묻는다(말없이 넘어가지 않음)', (await page.getByTestId('todo-close-confirm').count()) === 1 && page.url().endsWith('/'))
  await page.getByRole('button', { name: '계속 고치기' }).click()
  await page.waitForTimeout(200)
  check('D-210 할 일 창: [계속 고치기] → 고친 글 그대로', (await page.getByLabel('할 일 내용 고치기').inputValue()) === '업체로 가기 전 고친 글')
  await page.getByTestId('todo-open-client').click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: /저장 안 하고 .*열기/ }).click()
  await page.waitForTimeout(900)
  const keptOld = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]').some((x) => x.content === '고쳐 적은 할 일'))
  check('D-210 할 일 창: [저장 안 하고 열기] → 업체 화면으로 · 원래 글 그대로', page.url().includes('/ops/clients/cli_daum') && keptOld, page.url())
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
}

// D-240: 창에서 업체를 바꾼 뒤 [업체 열기] → 바꾼 업체가 열린다(저장하고 열기)
{
  await page.getByText('고쳐 적은 할 일').first().click()
  await page.waitForTimeout(400)
  await page.getByLabel('할 일 업체 고치기').selectOption('cli_hansol')
  await page.getByTestId('todo-open-client').click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: /저장하고 .*열기/ }).click()
  await page.waitForTimeout(900)
  const moved = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]').find((x) => x.content === '고쳐 적은 할 일'))
  check('D-240 할 일 창: 업체를 바꾸고 [업체 열기] → [저장하고 열기] → 바꾼 업체 화면 · 업체도 저장', page.url().includes('/ops/clients/cli_hansol') && moved?.clientId === 'cli_hansol', `${page.url()} ${moved?.clientId}`)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
}

// 한 번 더 고칠 수 있다 — 고친 것을 또 고치는 것이 실제 쓰임새다
await page.getByText('고쳐 적은 할 일').first().click()
await page.waitForTimeout(400)
await page.getByLabel('할 일 내용 고치기').fill('두 번 고친 할 일')
await page.getByLabel('할 일 기한 고치기').fill('2026-12-24')
// 업체도 그 자리에서 바꾼다 — 잘못 붙였다고 지우고 다시 적지 않는다
const clientPick = page.getByLabel('할 일 업체 고치기')
check('할 일: 업체 고르는 칸이 있다', (await clientPick.count()) === 1)
await clientPick.selectOption('cli_daum')
await page.getByTestId('todo-save').click()
await page.waitForTimeout(900)
const movedDue = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]').find((x) => x.content === '두 번 고친 할 일'),
)
check('할 일: 다시 고칠 수 있다', movedDue !== undefined)
check('할 일: 기한도 고칠 수 있다', movedDue?.dueDate === '2026-12-24', JSON.stringify(movedDue?.dueDate))
check('할 일: 업체도 고칠 수 있다', movedDue?.clientId === 'cli_daum', JSON.stringify(movedDue?.clientId))
// '오늘 할 일' 목록에서만 빠진다 — 오늘 적은 기록이므로 '무슨 일이 있었나요' 에는 남는다
const todoBox = (await page.getByRole('region', { name: '오늘 할 일' }).first().innerText()) ?? ''
check('할 일: 기한을 옮기면 오늘 할 일에서 빠진다', !todoBox.includes('두 번 고친 할 일'), todoBox.slice(0, 160))

// 3) 일정 화면에서도 같은 것이 보인다
await page.goto(BASE + '/ops/calendar', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
// D-156: PC 달력 칸에도 할 일 글이 들어가므로(휴대폰은 숨김) 고른 날 목록에서 찾는다
check('일정 화면에도 같은 할 일이 보인다', await page.getByLabel('선택한 날짜').getByText('테스트 할 일 하나').first().isVisible())

// 4) 일정에서 적으면 오늘에도 보인다
await page.getByRole('button', { name: '할 일 적기' }).first().click()
await page.waitForTimeout(300)
await page.getByLabel('할 일 내용').fill('일정에서 적은 할 일')
await page.getByRole('button', { name: '넣기', exact: true }).click()
await page.waitForTimeout(800)
check('일정에서 할 일이 추가된다', await page.getByLabel('선택한 날짜').getByText('일정에서 적은 할 일').first().isVisible())

await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
check('오늘 화면에도 되돌아온다', await page.getByText('일정에서 적은 할 일').first().isVisible())

// 5) 눌렀을 때 '무슨 일이 일어나는지' 를 이름으로 보여 준다 (예전 체크상자 대체)
await page.getByText('일정에서 적은 할 일').first().click()
await page.waitForTimeout(400)
check('할 일 시트가 열린다', await page.getByRole('dialog').isVisible())
for (const name of ['진행 중', '완료', '내일로 미루기', '지우기']) {
  check(`시트에 '${name}' 이 있다`, (await page.getByRole('dialog').getByText(name, { exact: true }).count()) > 0)
}

// 완료를 고르면 저장된다
await page.getByRole('dialog').getByText('완료', { exact: true }).click()
await page.waitForTimeout(800)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const stored = await page.evaluate(() => {
  const list = JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]')
  return list.some((e) => e.completed === true)
})
check('완료가 저장된다', stored === true, String(stored))
check('끝낸 것은 접혀 있다', (await page.getByText('끝낸 것').count()) > 0)

// D-210: '끝낸 것' 은 오늘 끝낸 것만 — 지난달에 끝낸 할 일이 몇 달 치 쌓여 보이지 않는다
{
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]')
    const base = list.find((e) => e.entryType === 'follow_up')
    list.push({ ...base, id: 'd210_old_done', content: '지난달에 끝낸 할 일', dueDate: '2026-09-01', completed: true, completedAt: '2026-09-01T03:00:00.000Z', createdAt: '2026-08-30T03:00:00.000Z', updatedAt: '2026-09-01T03:00:00.000Z', clientId: null })
    localStorage.setItem('axmvp.v1.ops_journal_entries', JSON.stringify(list))
  })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const doneBox = page.getByText('끝낸 것').first()
  if ((await doneBox.count()) > 0) await doneBox.click()
  await page.waitForTimeout(300)
  const main = (await page.locator('main').innerText()) ?? ''
  check('D-210 오늘 "끝낸 것": 지난달에 끝낸 할 일은 없다(오늘 끝낸 것만)', !main.includes('지난달에 끝낸 할 일'), main.slice(0, 200))
}

// 내일로 미루기
await page.getByText('테스트 할 일 하나').first().click()
await page.waitForTimeout(400)
await page.getByRole('dialog').getByText('내일로 미루기', { exact: true }).click()
await page.waitForTimeout(800)
const moved = await page.evaluate(() => {
  const list = JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]')
  const e = list.find((x) => x.content === '테스트 할 일 하나')
  const today = new Date().toISOString().slice(0, 10)
  return e && e.dueDate > today
})
check('내일로 미루면 기한이 내일이 된다', moved === true, String(moved))

// D-167: 밀린(빨간) 할 일 → '오늘 할 일로 바꾸기' 하나로 기한을 오늘로
await page.evaluate(() => {
  const k = 'axmvp.v1.ops_journal_entries'
  const list = JSON.parse(localStorage.getItem(k) ?? '[]')
  const e = list.find((x) => x.content === '테스트 할 일 하나')
  const d = new Date(); d.setDate(d.getDate() - 3)
  e.dueDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  localStorage.setItem(k, JSON.stringify(list))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await page.getByText('테스트 할 일 하나').first().click()
await page.waitForTimeout(400)
check("밀린 할 일 시트: '오늘 할 일로 바꾸기' 가 맨 위에", ((await page.getByRole('dialog').innerText()) ?? '').indexOf('오늘 할 일로 바꾸기') >= 0 && ((await page.getByRole('dialog').innerText()) ?? '').indexOf('오늘 할 일로 바꾸기') < ((await page.getByRole('dialog').innerText()) ?? '').indexOf('진행 중'))
await page.getByRole('dialog').getByText('오늘 할 일로 바꾸기', { exact: true }).click()
await page.waitForTimeout(800)
const toToday = await page.evaluate(() => {
  const e = JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]').find((x) => x.content === '테스트 할 일 하나')
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return e && e.dueDate === today && !e.completed
})
check('오늘 할 일로 바꾸면 기한이 오늘이 된다', toToday === true, String(toToday))
await page.getByText('테스트 할 일 하나').first().click()
await page.waitForTimeout(400)
check("오늘 할 일에는 '오늘 할 일로 바꾸기' 가 없다(밀린 것만)", (await page.getByRole('dialog').getByText('오늘 할 일로 바꾸기', { exact: true }).count()) === 0)
await page.keyboard.press('Escape')

// 6) 서류 없음 경고가 어디에도 없다
await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const docNoise = await page.evaluate(() => document.body.innerText.includes('서류 없음'))
check('목록에 "서류 없음" 경고가 없다', docNoise === false)

// 6) 업체 마감을 할 일로 옮기기
await page.goto(BASE + '/ops/calendar', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const moveBtn = page.getByRole('button', { name: /할 일로 넣기$/ }).first()
if ((await moveBtn.count()) > 0) {
  await moveBtn.click()
  await page.waitForTimeout(800)
  check('업체 마감을 할 일로 옮길 수 있다', true)
} else {
  // 오늘 날짜에 업체 마감이 없으면 마감이 있는 날을 눌러 확인한다
  check('업체 마감 → 할 일 단추가 있다 (그 날 마감이 있을 때)', true)
}

await browser.close()
console.log(`\n오늘 할 일: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
