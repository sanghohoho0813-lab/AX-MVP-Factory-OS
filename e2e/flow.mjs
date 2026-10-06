/**
 * 흐름 잇기 (D-122) — 한 곳에서 한 일이 다음 화면으로 그대로 이어진다.
 *
 *   node e2e/flow.mjs <baseUrl>
 *
 * 지키려는 것
 *   1. 업체 상세 영업 카드에서 '계약 완료' → 확인 시트 → 계약 고객 · 수금 항목(받을 날) · 계약 정보 · 업무 시작
 *   2. 계약 단계를 '계약 전' 으로 되돌리면 영업 보드도 클로징으로(한 업체가 두 단계에 있지 않다)
 *   3. 계약 금액과 수금 항목이 다르면 계약 카드에 차이 한 줄
 *   4. 오늘 화면 — 영업자에게 줄 돈 · 받을 날 안 정한 수금 줄(누르면 그 화면으로)
 *   5. 미팅 기록 — 받기로 한 자료를 서류함 칸으로 · 나온 주제는 관심사로
 *   6. 고객 관리 새 업체 — 기본 잠재고객 · 같은 업체가 있으면 알림
 *   9. (D-124) 영업 관리에서 업체를 열고 뒤로 → 고객 관리가 아니라 영업 관리로
 *  10. (D-124) 세금 계산기 목록을 펼친 채 화면을 밀어도 목록이 닫히며 튀지 않는다(누르면 닫힘)
 *  11. (D-124) 창이 열려 있을 때 뒤로가기는 창만 닫는다 · 뒤로 오면 보던 자리 · 찾던 말 그대로
 *  12. (D-125) 전화 단추(오늘 약속 줄 · 영업 보드 카드) · 고객 관리 '다음 약속 지남' 보기 · 휴대폰 하단 '영업'
 *  14. (D-158) 확인할 것 — 오늘 칸 · 모두 보기 · 맞아요(정보 넣기 · 문구 복사) · 아니에요 · 업체 상세에서 다시 안 물음
 *  15. (D-159) 고객 관리 기본 '요즘 챙기는 순' · 휴대폰 카드 접힘(펼쳐보기 · 진행 % 없음 · 빈 곳 누르면 업체) · 오늘 할 일 번호 · 4건 넘으면 두 칸
 *  13. (D-155) 오늘 '안부 챙길 계약 고객' — 한 달 넘게 조용 · 계약 1주년 · 안부 카톡 · 연락했어요 · 다음에 · 성과 보고서 바로 열기
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
const clients = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '[]'), CLIENTS)
const one = async (page, id) => (await clients(page)).find((c) => c.id === id)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

for (const [w, mob] of [[1440, false], [390, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: mob, hasTouch: mob, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const tag = `(${w})`

  /* 4 오늘 화면 돈 줄 — 먼저 본다(뒤 단계에서 수금이 바뀌므로) */
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const notes = page.getByTestId('today-money-notes')
  check(`오늘: 영업자에게 줄 돈 줄이 있다 ${tag}`, (await notes.count()) === 1 && ((await notes.innerText()) ?? '').includes('영업자에게 줄 돈'), (await notes.innerText().catch(() => '없음')).slice(0, 100))
  await notes.getByRole('link', { name: /영업자에게 줄 돈/ }).click()
  await page.waitForURL(/\/ops\/agents/)
  check(`오늘: 누르면 영업자 정산으로 ${tag}`, page.url().includes('/ops/agents'))

  /* 1 영업 카드 → 계약 완료 시트 */
  await page.goto(BASE + '/ops/clients/cli_mirae', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const salesCard = page.getByTestId('client-sales-card')
  if (!(await salesCard.getByLabel('영업 단계').isVisible())) await salesCard.getByRole('button', { name: /영업/ }).first().click()
  await salesCard.getByLabel('영업 단계').selectOption('contracted')
  const sheet = page.getByTestId('contract-close')
  await sheet.waitFor()
  check(`계약 완료: 영업 카드에서도 확인 시트(바로 옮기지 않음) ${tag}`, (await one(page, 'cli_mirae')).status === 'waiting')
  await sheet.getByLabel('수금 항목 1 금액').fill('3,300,000')
  await sheet.getByRole('button', { name: '현금', exact: true }).click()
  const ventureChip = sheet.getByRole('button', { name: '벤처인증', exact: true })
  if ((await ventureChip.getAttribute('aria-pressed')) !== 'true') await ventureChip.click()
  await page.getByTestId('contract-close-save').click()
  await page.waitForTimeout(800)
  const m = await one(page, 'cli_mirae')
  check(`계약 완료: 계약 고객 · 영업 단계 계약 완료 ${tag}`, m.status === 'active' && m.sales?.stage === 'contracted', JSON.stringify({ s: m.status, st: m.sales?.stage }))
  check(`계약 완료: 수금 항목 330만 · 받을 날 있음 ${tag}`, m.fees.length === 1 && m.fees[0].amount === 3_300_000 && /^\d{4}-\d{2}-\d{2}$/.test(m.fees[0].dueDate), JSON.stringify(m.fees))
  check(`계약 완료: 계약 정보(현금 · 330만 · 계약일) ${tag}`, m.contract.kind === 'cash' && m.contract.cashAmount === 3_300_000 && /^\d{4}-\d{2}-\d{2}$/.test(m.contract.signedAt), JSON.stringify(m.contract))
  check(`계약 완료: 고른 업무(벤처인증)가 진행 중 ${tag}`, m.services.venture.status === 'in_progress')
  check(`계약 완료: 시트가 닫혔다 ${tag}`, (await page.getByTestId('contract-close').count()) === 0)

  /* 2 계약 단계 되돌리기 → 영업은 클로징 */
  // D-140: 회사명 옆 계약 상태 배지 하나(PC · 휴대폰 같음)
  {
    await page.getByTestId('stage-badge').click()
    await page.getByTestId('stage-menu').getByRole('menuitemradio', { name: '계약 전' }).click()
    await page.waitForTimeout(600)
    const back = await one(page, 'cli_mirae')
    check(`계약 단계를 계약 전으로 → 영업은 클로징(두 단계에 있지 않다) ${tag}`, back.status === 'waiting' && back.sales?.stage === 'closing', JSON.stringify({ s: back.status, st: back.sales?.stage }))
  }

  /* 3 계약 · 수금 차이 */
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const h = await one(page, 'cli_hansol')
  const feeSum = h.fees.reduce((s, f) => s + (f.amount ?? 0), 0)
  if (h.contract.cashAmount && h.contract.cashAmount !== feeSum) {
    check(`계약 카드: 계약 금액과 수금 항목 차이 한 줄 ${tag}`, (await page.getByTestId('contract-gap').count()) === 1)
  } else {
    check(`계약 카드: 같으면 차이 줄이 없다 ${tag}`, (await page.getByTestId('contract-gap').count()) === 0)
  }

  /* 5 미팅 기록 → 서류함 칸 · 관심사 */
  await page.goto(BASE + '/sales/meeting?client=cli_mirae&round=2', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const rec = page.getByTestId('meeting-recorder')
  await rec.getByLabel('미팅에서 나온 말 · 메모').fill('가지급금 정리가 필요하다고 하셨고 주주명부와 정관을 보내 주기로 함')
  await rec.getByRole('button', { name: '메모 정리하기' }).click()
  const slots = page.getByTestId('meeting-doc-slots')
  check(`미팅 기록: 서류함에 칸 만들기(주주명부 · 정관) ${tag}`, (await slots.count()) === 1 && ((await slots.innerText()) ?? '').includes('주주명부') && ((await slots.innerText()) ?? '').includes('정관'))
  await rec.getByRole('button', { name: '기록 저장' }).click()
  await page.waitForTimeout(700)
  const after = await one(page, 'cli_mirae')
  check(`미팅 기록: 서류함 칸이 생겼다 ${tag}`, after.customDocuments.some((d) => d.label === '주주명부') && after.customDocuments.some((d) => d.label === '정관'), JSON.stringify(after.customDocuments.map((d) => d.label)))
  check(`미팅 기록: 나온 주제(가지급금)가 관심사로 ${tag}`, (after.sales?.interests ?? []).includes('가지급금'), JSON.stringify(after.sales?.interests))

  /* 6 고객 관리 새 업체 */
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /등록/ }).first().click()
  const nameBox = page.getByLabel('업체명')
  await nameBox.fill('한솔테크(주)')
  check(`새 업체: 같은 업체가 있으면 알린다 ${tag}`, (await page.getByTestId('new-client-dupe').count()) === 1)
  await nameBox.fill(`새잠재상사${w}`)
  check(`새 업체: 기본은 잠재고객 ${tag}`, (await page.locator('form').getByRole('button', { name: /^잠재고객/ }).getAttribute('aria-pressed')) === 'true')
  await page.getByRole('button', { name: '등록하고 열기' }).click()
  await page.waitForURL(/\/ops\/clients\/[^?]+$/)
  const made = (await clients(page)).find((c) => c.companyName === `새잠재상사${w}`)
  check(`새 업체: 잠재고객(계약 전 · 영업 잠재 고객)으로 들어간다 ${tag}`, made?.status === 'waiting' && made?.sales?.stage === 'lead', JSON.stringify({ s: made?.status, st: made?.sales?.stage }))

  /* 7 (4묶음) 서류 탭 — 지금 필요 없는 안 받은 서류는 설명 줄 없이 · 받음을 켜면 펼쳐진다 */
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=docs', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const main = (await page.locator('main').innerText()) ?? ''
  // D-146: 대표자 휴대폰번호는 서류가 아니다(개요 연락처) — 서류함에 없다
  check(`서류 탭: 대표자 휴대폰번호 칸 없음(D-146) ${tag}`, !main.includes('대표자 휴대폰번호'))
  check(`서류 탭: 지금 필요 없는 안 받은 서류는 설명 줄을 접는다 ${tag}`, main.includes('공동인증서 전달') && !main.includes('비밀번호는 이 시스템에 저장하지 마세요'))
  check(`서류 탭: 지금 필요한 서류는 설명까지 ${tag}`, main.includes('대부분의 기관이 3개월 이내 발급본을'))
  await page.getByLabel('공동인증서 전달 받음').check()
  await page.waitForTimeout(500)
  check(`서류 탭: 받음을 켜면 그 줄이 펼쳐진다(메모 칸) ${tag}`, ((await page.locator('main').innerText()) ?? '').includes('비밀번호는 이 시스템에 저장하지 마세요'))

  /* 8 (4묶음) 할 일 프리셋 — 이미 적은 글이 있으면 앞에 붙는다 */
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: '할 일 적기' }).first().click()
  const box = page.getByLabel('할 일 내용', { exact: true }).first()
  {
    await box.fill('김대표 서류')
    await page.getByRole('button', { name: '통화', exact: true }).first().click()
    check(`할 일 프리셋: 적은 글 앞에 붙는다 ${tag}`, (await box.inputValue()).startsWith('대표님 통화 — ') && (await box.inputValue()).includes('김대표 서류'), await box.inputValue())
  }

  /* 9 (D-124) 영업 관리 → 업체 → 뒤로 */
  const path = () => new URL(page.url()).pathname + new URL(page.url()).search
  await page.goto(BASE + '/sales', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.getByTestId('sales-card').filter({ visible: true }).first().getByRole('button').first().click()
  await page.waitForURL(/\/ops\/clients\//)
  await page.waitForTimeout(300)
  const backBtn = page.getByTestId('client-back')
  check(`뒤로: 영업 관리에서 연 업체는 '영업 관리로' 단추 ${tag}`, ((await backBtn.innerText()) ?? '').includes('영업 관리로'), await backBtn.innerText())
  const current = await page.locator('[aria-current="page"]').filter({ visible: true }).allInnerTexts()
  check(`뒤로: 메뉴는 영업 관리에 머문다(고객 관리로 바뀌지 않음) ${tag}`, (mob || current.some((t) => t.includes('영업'))) && !current.some((t) => t.includes('고객')), current.join())
  await page.locator('[role="tab"]').filter({ visible: true }).nth(2).click() // D-144: 맞춤 추천 · 개요 다음 — 서류 탭
  await page.waitForURL(/tab=/)
  await backBtn.click()
  await page.waitForURL((u) => u.pathname.startsWith('/sales'))
  check(`뒤로: 탭을 바꾼 뒤에도 단추는 영업 관리로 ${tag}`, new URL(page.url()).pathname.startsWith('/sales'), page.url())
  await page.getByTestId('sales-card').filter({ visible: true }).first().getByRole('button').first().click()
  await page.waitForURL(/\/ops\/clients\//)
  await page.goBack()
  await page.waitForTimeout(400)
  check(`뒤로: 브라우저 · 휴대폰 뒤로가기도 영업 관리로 ${tag}`, new URL(page.url()).pathname.startsWith('/sales'), page.url())
  await page.goto(BASE + '/sales/meeting?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.locator('main a[href="/ops/clients/cli_hansol"]').filter({ visible: true }).first().click()
  await page.waitForURL(/\/ops\/clients\/cli_hansol/)
  await page.goBack()
  await page.waitForTimeout(400)
  check(`뒤로: 미팅 준비에서 연 업체 → 뒤로 → 그 미팅 준비로 ${tag}`, path().startsWith('/sales/meeting?client=cli_hansol'), path())
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  check(`뒤로: 고객 관리에서 연 업체는 그대로 '고객 관리 현황' ${tag}`, ((await page.getByTestId('client-back').innerText()) ?? '').includes('고객 관리'))

  /* 10 (D-124) 세금 계산기 목록 — 밀면 안 닫힘 · 누르면 닫힘 (휴대폰) */
  if (mob) {
    await page.goto(BASE + '/tools/tax', { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const picker = page.getByTestId('tax-picker')
    await picker.click()
    await page.waitForTimeout(200)
    const list = page.locator('#tax-picker-list')
    const box = await list.boundingBox()
    // 목록 바로 아래(목록 밖)에서 손가락으로 위로 민다
    const y = Math.min(840, Math.round((box?.y ?? 0) + (box?.height ?? 0) + 30))
    const cdp = await ctx.newCDPSession(page)
    const y0 = await page.evaluate(() => window.scrollY)
    await cdp.send('Input.synthesizeScrollGesture', { x: 200, y: y > 60 ? y : 600, yDistance: -250, gestureSourceType: 'touch', speed: 600 })
    await page.waitForTimeout(400)
    const y1 = await page.evaluate(() => window.scrollY)
    check(`세금 계산기: 목록을 펼친 채 밀어도 목록은 그대로 ${tag}`, (await list.count()) === 1, `scroll ${y0} → ${y1}`)
    check(`세금 계산기: 민 만큼만 움직인다(튀지 않음) ${tag}`, y1 >= y0 && y1 - y0 <= 400, `scroll ${y0} → ${y1}`)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(200)
    const hb = await page.locator('h1').first().boundingBox()
    await page.touchscreen.tap(200, Math.round((hb?.y ?? 80) + (hb?.height ?? 20) / 2))
    await page.waitForTimeout(300)
    check(`세금 계산기: 목록 밖을 누르면 닫힘 ${tag}`, (await list.count()) === 0)
  }

  /* 11 (D-124) 뒤로가기 — 창만 닫기 · 보던 자리 · 찾던 말 (앱 안에서 옮겨 다닌 기록이어야 한다 — goto 는 문서를 새로 연다) */
  const inApp = async (href) => {
    await page.evaluate((h) => { const a = document.querySelector(`a[href="${h}"]`); a?.click() }, href)
    await page.waitForURL((u) => u.pathname === href.split('?')[0])
    await page.waitForTimeout(400)
  }
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await inApp('/ops/clients')
  await page.getByRole('button', { name: /등록/ }).first().click()
  await page.getByLabel('업체명').waitFor()
  await page.goBack()
  await page.waitForTimeout(400)
  check(`뒤로가기: 새 업체 창만 닫고 고객 관리에 머문다 ${tag}`, (await page.getByLabel('업체명').count()) === 0 && new URL(page.url()).pathname === '/ops/clients', page.url())
  if (mob) {
    await page.getByRole('button', { name: '메뉴 열기' }).click()
    await page.getByRole('button', { name: '메뉴 닫기' }).waitFor()
    await page.goBack()
    await page.waitForTimeout(400)
    check(`뒤로가기: 서랍 메뉴만 닫는다 ${tag}`, (await page.getByRole('button', { name: '메뉴 닫기' }).count()) === 0 && new URL(page.url()).pathname === '/ops/clients', page.url())
    await page.locator('main').getByText('한솔테크(주)').filter({ visible: true }).first().click()
    await page.waitForURL(/\/ops\/clients\/cli_hansol/)
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: '더보기' }).first().click()
    await page.waitForTimeout(300)
    const sheets = () => page.locator('[role="dialog"][aria-modal="true"]').count()
    const opened = await sheets()
    await page.goBack()
    await page.waitForTimeout(400)
    check(`뒤로가기: 더보기 시트만 닫고 업체 화면에 머문다 ${tag}`, opened >= 1 && (await sheets()) === 0 && new URL(page.url()).pathname === '/ops/clients/cli_hansol', `${opened} → ${await sheets()} ${page.url()}`)
  }
  // '저장 안 한 내용' 막기가 있는 화면(크레탑 등록)에서도 뒤로가기는 열린 창만 닫는다
  await page.goto(BASE + '/sales/board', { waitUntil: 'networkidle' })
  await page.getByTestId('board-cretop-intake').click()
  await page.waitForURL(/\/sales\/new/)
  await page.waitForTimeout(400)
  const opener = mob ? page.getByRole('button', { name: '메뉴 열기' }) : page.getByRole('button', { name: /빠른 이동|찾기/ }).first()
  if (await opener.count()) {
    await opener.click()
    await page.waitForTimeout(300)
    const dialogs = () => page.locator('[role="dialog"][aria-modal="true"], [aria-label="메뉴 닫기"]').count()
    const before = await dialogs()
    await page.goBack()
    await page.waitForTimeout(400)
    check(`뒤로가기: 크레탑 등록 화면에서도 열린 창만 닫는다 ${tag}`, before >= 1 && (await dialogs()) === 0 && new URL(page.url()).pathname === '/sales/new', `${before} → ${await dialogs()} ${page.url()}`)
  }
  // 보던 자리
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const want = Math.min(900, await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight - 10))
  await page.evaluate((y) => window.scrollTo(0, y), want)
  await page.waitForTimeout(300)
  const atY = await page.evaluate(() => window.scrollY)
  await page.evaluate(() => { const a = document.querySelector('a[href="/ops/calendar"]'); a?.click() })
  await page.waitForURL(/\/ops\/calendar/)
  await page.waitForTimeout(300)
  check(`새 화면은 맨 위에서 ${tag}`, (await page.evaluate(() => window.scrollY)) === 0)
  await page.goBack()
  await page.waitForTimeout(1200)
  const backY = await page.evaluate(() => window.scrollY)
  check(`뒤로 오면 보던 자리 ${tag}`, atY > 100 && Math.abs(backY - atY) <= 40, `${atY} → ${backY}`)
  // 찾던 말
  await inApp('/ops/clients')
  const search = page.getByRole('searchbox').or(page.getByPlaceholder(/찾기|검색/)).filter({ visible: true }).first()
  await search.fill('한솔')
  await page.waitForTimeout(600)
  check(`찾기: 찾던 말이 주소에 ${tag}`, new URL(page.url()).searchParams.get('q') === '한솔', page.url())
  await page.locator('main').getByText('한솔테크(주)').filter({ visible: true }).first().click()
  await page.waitForURL(/\/ops\/clients\/cli_hansol/)
  await page.goBack()
  await page.waitForTimeout(500)
  check(`찾기: 업체를 열었다 뒤로 와도 찾던 말 그대로 ${tag}`, (await search.inputValue()) === '한솔', await search.inputValue())

  /* 12 (D-125) */
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const appt = page.getByTestId('today-appointments')
  if (await appt.count()) {
    const calls = appt.getByTestId('call-button')
    check(`전화: 오늘 약속 줄에 전화 단추(tel:) ${tag}`, (await calls.count()) >= 1 && ((await calls.first().getAttribute('href')) ?? '').startsWith('tel:'))
  }
  await page.goto(BASE + '/sales/board', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check(`전화: 영업 보드 카드에 전화 단추 ${tag}`, (await page.getByTestId('sales-card').getByTestId('call-button').count()) >= 1)
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const allList = await clients(page)
  const todayStr = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
  const lateNames = allList.filter((c) => c.archivedAt == null && c.nextActionDueDate && c.nextActionDueDate < todayStr).map((c) => c.companyName)
  const seg = page.getByTestId('client-segment')
  if (await seg.count()) await seg.getByRole('button', { name: /전체/ }).click()
  // D-126: 휴대폰에서는 보기 · 정렬이 '거르기' 뒤에 접혀 있다
  const tg = page.getByTestId('client-filters-toggle')
  if ((await tg.isVisible()) && (await tg.getAttribute('aria-expanded')) !== 'true') await tg.click()
  await page.getByLabel('업체 보기 조건').selectOption('late')
  await page.waitForTimeout(400)
  const listText = (await page.locator('main').innerText()) ?? ''
  check(`고객 관리: '다음 약속 지남' 보기 — 약속 지난 업체가 보인다 ${tag}`, lateNames.length > 0 && lateNames.every((n) => listText.includes(n)), lateNames.join(','))
  await page.getByLabel('업체 보기 조건').selectOption('all')
  if (mob) {
    await page.locator('nav[aria-label="주요 화면"]').getByText('영업', { exact: true }).click()
    await page.waitForURL(/\/sales\/board/)
    await page.waitForTimeout(500)
    check(`휴대폰 하단: '영업' 을 누르면 영업 보드 · 불이 켜진다 ${tag}`, (await page.locator('nav[aria-label="주요 화면"] [aria-current="page"]').innerText()).includes('영업'))
  }

  check(`JS 오류 없음 ${tag}`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* 13 (D-155) 계약 고객 돌봄 */
for (const [w, mob] of [[1440, false], [390, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: mob, hasTouch: mob, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const tag = `(${w})`
  const T = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
  const shift = (ymd, n) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
  // 한솔: 계약 1주년 14일 앞(최근 서류 받음) · 다움: 45일째 조용(메모뿐) · 나머지 계약 고객: 어제 챙김
  await page.evaluate(({ k, T, ann, quietAt, recent }) => {
    const list = JSON.parse(localStorage.getItem(k))
    for (const c of list) {
      if (c.status !== 'active') continue
      c.activity = [{ id: `a-${c.id}`, kind: 'document', text: '서류 받음', serviceKey: null, at: `${recent}T01:00:00Z` }]
      c.notes_list = []
      delete c.care
    }
    const h = list.find((c) => c.id === 'cli_hansol')
    h.contract = { ...(h.contract ?? {}), signedAt: ann }
    const d = list.find((c) => c.id === 'cli_daum')
    d.activity = []
    d.notes_list = [{ id: 'n-q', text: '전화 드림', pinned: false, createdAt: `${quietAt}T01:00:00Z`, updatedAt: `${quietAt}T01:00:00Z` }]
    d.contract = { ...(d.contract ?? {}), signedAt: `${T.slice(0, 4)}-01-15` <= T ? `${T.slice(0, 4)}-01-15` : `${Number(T.slice(0, 4)) - 1}-12-15` }
    localStorage.setItem(k, JSON.stringify(list))
  }, { k: CLIENTS, T, ann: `${Number(T.slice(0, 4)) - 1}-${shift(T, 14).slice(5)}`, quietAt: shift(T, -45), recent: shift(T, -1) })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const care = page.getByTestId('today-care')
  const row = (id) => care.locator(`[data-testid="care-row"][data-client="${id}"]`)
  check(`돌봄: 오늘에 '안부 챙길 계약 고객' 칸 ${tag}`, (await care.count()) === 1)
  check(`돌봄: 1주년 업체가 먼저 · 14일 남음 ${tag}`, (await care.getByTestId('care-row').first().getAttribute('data-client')) === 'cli_hansol' && (await row('cli_hansol').getAttribute('data-reason')) === 'anniversary' && (await row('cli_hansol').innerText()).includes('14일 남음'), await care.innerText().catch(() => ''))
  check(`돌봄: 45일째 조용한 업체 · 마지막 메모 ${tag}`, (await row('cli_daum').getAttribute('data-reason')) === 'quiet' && (await row('cli_daum').getByTestId('care-text').innerText()).includes('45일째 조용') && (await row('cli_daum').innerText()).includes('메모'))
  check(`돌봄: 어제 챙긴 업체는 없음 ${tag}`, (await care.getByTestId('care-row').count()) === 2, await care.getByTestId('care-row').count())
  await row('cli_daum').getByTestId('care-kakao').click()
  await page.waitForTimeout(200)
  const msg = await page.evaluate(() => navigator.clipboard.readText())
  check(`돌봄: 안부 카톡 문구 복사 — 대표님 · 안부 ${tag}`, msg.startsWith('안녕하세요,') && msg.includes('안부 여쭙니다') && !/수수료|성공보수|영업자/.test(msg), msg.slice(0, 120))
  await row('cli_daum').getByTestId('care-contacted').click()
  await page.waitForTimeout(500)
  const daum = await one(page, 'cli_daum')
  check(`돌봄: [연락했어요] → 줄 사라짐 · 업체 기록에 오늘 연락 · 활동 기록 ${tag}`, (await row('cli_daum').count()) === 0 && daum.care?.lastContactAt === T && daum.activity?.[0]?.kind === 'care', JSON.stringify(daum.care))
  await row('cli_hansol').getByTestId('care-report').click()
  await page.waitForURL(/\/ops\/clients\/cli_hansol\?report=1/)
  await page.getByTestId('report-preview').waitFor({ timeout: 5000 }).catch(() => {})
  check(`돌봄: [성과 보고서] → 업체 상세에서 보고서가 바로 열림 ${tag}`, await page.getByTestId('report-preview').isVisible())
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check(`돌봄: 보고서를 닫으면 주소에서 report 빠짐 ${tag}`, !page.url().includes('report=1') && !(await page.getByTestId('report-preview').isVisible()), page.url())
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await row('cli_hansol').getByTestId('care-snooze').click()
  await page.waitForTimeout(500)
  const hansol = await one(page, 'cli_hansol')
  check(`돌봄: [다음에] → 줄 사라짐 · 14일 뒤까지(1주년 마지막 날보다 앞) ${tag}`, (await page.getByTestId('today-care').count()) === 0 && hansol.care?.snoozeUntil === shift(T, 14), JSON.stringify(hansol.care))
  check(`돌봄: 다 챙기면 칸이 사라짐 ${tag}`, (await page.getByTestId('today-care').count()) === 0)
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(`돌봄: 가로 넘침 0 · JS 오류 0 ${tag}`, over <= 0 && errors.length === 0, `${over} ${errors.join(' | ')}`)
  await ctx.close()
}

/* 14 (D-158) 확인할 것 — 프로그램이 준비한 것에 맞다 · 아니다만 */
for (const [w, mob] of [[1440, false], [390, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: mob, hasTouch: mob, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const tag = `(${w})`
  const T = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
  // 한솔: 자료에서 읽은 매출 후보 하나 · 납세증명서(1개월) 이미 만료
  await page.evaluate(({ k, T }) => {
    const list = JSON.parse(localStorage.getItem(k))
    const h = list.find((c) => c.id === 'cli_hansol')
    h.factInbox = [{ id: 'fi-e2e', key: 'revenue', value: '1200000000', source: 'document', asOf: '2025-12-31', ref: '재무제표', foundAt: `${T}T00:00:00Z` }]
    h.customDocuments = [...(h.customDocuments ?? []), { id: 'cd-e2e', key: 'customdoc_tax158', label: '납세증명서', validMonths: 1, sensitive: false }]
    h.documents = { ...(h.documents ?? {}), customdoc_tax158: { received: true, issuedAt: '2026-08-01', fileName: '납세.pdf' } }
    localStorage.setItem(k, JSON.stringify(list))
  }, { k: CLIENTS, T })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const box = page.getByTestId('today-decide')
  check(`확인할 것: 오늘에 칸 · 위 셋까지 ${tag}`, (await box.count()) === 1 && (await box.getByTestId('decision').count()) <= 3 && (await box.getByTestId('decision').count()) >= 1)
  await box.getByTestId('today-decide-all').click()
  await page.waitForURL(/\/ops\/decide/)
  await page.waitForTimeout(500)
  const fact = page.locator('[data-testid="decision"][data-kind="fact"][data-client="cli_hansol"]').first()
  check(`확인할 것 화면: 한솔 매출 정보 '맞나요?' ${tag}`, (await fact.count()) === 1 && (await fact.innerText()).includes('맞나요'), await page.getByTestId('decision-list').innerText().catch(() => ''))
  await fact.getByTestId('decision-yes').click()
  await page.waitForTimeout(600)
  const h1 = await one(page, 'cli_hansol')
  check(`[맞아요] → 업체 정보로 · 후보 빠짐 · 줄 사라짐 ${tag}`, (h1.factInbox ?? []).length === 0 && (await page.locator('[data-testid="decision"][data-kind="fact"][data-client="cli_hansol"]').count()) === 0, JSON.stringify(h1.factValues ?? {}).slice(0, 200))
  const doc = page.locator('[data-testid="decision"][data-kind="doc"][data-client="cli_hansol"]').first()
  check(`서류 기한: 납세증명서 새로 받기 ${tag}`, (await doc.count()) === 1 && (await doc.innerText()).includes('납세증명서'))
  await doc.getByTestId('decision-yes').click()
  await page.waitForTimeout(500)
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  check(`[요청 문구 복사] → 카톡 문구 복사 · 다시 묻지 않음 ${tag}`, clip.includes('납세증명서') && (await page.locator('[data-testid="decision"][data-kind="doc"][data-client="cli_hansol"]').count()) === 0 && !!(await one(page, 'cli_hansol')).decided, clip.slice(0, 80))
  const next = page.getByTestId('decision').first()
  if (await next.count()) {
    const id = await next.getAttribute('data-client')
    const before = await page.getByTestId('decision').count()
    await next.getByTestId('decision-no').click()
    await page.waitForTimeout(500)
    check(`[아니에요] → 줄 하나 줄어듦 · 그 업체에 답 남음 ${tag}`, (await page.getByTestId('decision').count()) === before - 1 && Object.values((await one(page, id)).decided ?? {}).some((x) => x.a === 'no'))
  }
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check(`업체 상세 맞춤 추천: 답한 것은 다시 안 물음 ${tag}`, !(await page.getByTestId('smart-tab').innerText()).includes('납세증명서 새로 받기'))
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(`확인할 것: 가로 넘침 0 · 오류 0 ${tag}`, over <= 0 && errors.length === 0, `${over} ${errors.join(' | ')}`)
  await ctx.close()
}

/* 15 (D-159) 고객 관리 요즘 순 · 접힌 카드 · 오늘 할 일 번호 · 두 칸 */
for (const [w, mob] of [[1440, false], [390, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: mob, hasTouch: mob, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const tag = `(${w})`
  const T = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const ids0 = await page.getByTestId('client-card').evaluateAll((els) => els.map((e) => e.getAttribute('data-client-id')))
  const lastId = ids0[ids0.length - 1]
  // 맨 뒤 업체에 오늘 통화 다섯 번 — 요즘 챙기는 순이면 맨 위로
  await page.evaluate(({ k, id, T }) => {
    const list = JSON.parse(localStorage.getItem(k))
    const c = list.find((x) => x.id === id)
    c.activity = [...(c.activity ?? []), ...[1, 2, 3, 4, 5].map((i) => ({ id: `e2e-act-${i}`, kind: 'note', text: '통화', serviceKey: null, at: `${T}T0${i}:00:00.000Z` }))]
    localStorage.setItem(k, JSON.stringify(list))
  }, { k: CLIENTS, id: lastId, T })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  if (mob) {
    const toggle = page.getByTestId('client-filters-toggle')
    if (await toggle.count()) await toggle.click()
  }
  const sel = page.getByLabel('업체 정렬 기준')
  check(`고객 관리: 기본 정렬 '요즘 챙기는 순' ${tag}`, (await sel.inputValue()) === 'active' && (await sel.locator('option:checked').innerText()).includes('요즘 챙기는 순'))
  const ids1 = await page.getByTestId('client-card').evaluateAll((els) => els.map((e) => e.getAttribute('data-client-id')))
  check(`요즘 순: 오늘 다섯 번 챙긴 업체가 맨 위 ${tag}`, ids1[0] === lastId, `${lastId} → ${ids1.slice(0, 3).join()}`)
  const cardsText = await page.getByTestId('client-card').allInnerTexts()
  check(`카드: 진행 % 없음 ${tag}`, !cardsText.some((t) => /진행\s*\d+%/.test(t)), cardsText[0]?.slice(0, 200))
  const card = page.locator('[data-testid="client-card"][data-client-id="cli_hansol"]')
  if (mob) {
    const h0 = (await card.boundingBox()).height
    check(`휴대폰 카드: 처음엔 접힘 — 사업자등록번호 안 보임 · 펼쳐보기 단추 ${tag}`, !(await card.innerText()).includes('사업자등록번호') && (await card.getByTestId('card-toggle').isVisible()))
    check(`휴대폰 카드: 이름 · 년차 · 다음 약속 · 진행 중이 보임 ${tag}`, /년차/.test(await card.innerText()) && (await card.getByTestId('card-doing').count()) === 1, await card.innerText())
    await card.getByTestId('card-toggle').click()
    await page.waitForTimeout(200)
    const h1 = (await card.boundingBox()).height
    check(`펼쳐보기 → 사업자등록번호 · 업무 조각 · 카드가 길어짐(${Math.round(h0)} → ${Math.round(h1)}) ${tag}`, (await card.innerText()).includes('사업자등록번호') && (await card.locator('[data-chip-status]').count()) > 0 && h1 > h0 * 1.4)
    await card.getByTestId('card-toggle').click()
    await page.waitForTimeout(200)
    // 이름 · 펼쳐보기 말고 빈 곳(진행 중 줄)을 누르면 업체 상세로
    await card.getByTestId('card-doing').click()
    await page.waitForURL(/\/ops\/clients\/cli_hansol/)
    check(`휴대폰 카드: 빈 곳 누르면 업체 상세 ${tag}`, page.url().includes('/ops/clients/cli_hansol'))
  } else {
    check(`PC 카드: 접지 않음 — 사업자등록번호 보임 · 펼쳐보기 없음 ${tag}`, (await card.innerText()).includes('사업자등록번호') && !(await card.getByTestId('card-toggle').isVisible()))
  }

  // 오늘 할 일 여섯 건 — 적은 순서로 번호 · 4건 넘으면 두 칸 · 동그라미 단추 없음
  await page.evaluate(({ T }) => {
    const k = 'axmvp.v1.ops_journal_entries'
    const list = JSON.parse(localStorage.getItem(k) ?? '[]').filter((e) => !(e.entryType === 'follow_up' && e.dueDate === T))
    const order = [3, 1, 6, 2, 5, 4]
    for (const n of order) list.push({ id: `e2e-t${n}`, workspaceId: null, userId: null, entryDate: T, entryType: 'follow_up', content: `할 일 ${n}번째로 적음`, clientId: null, dueDate: T, completed: false, pinned: false, createdAt: `${T}T0${n}:00:00.000Z`, updatedAt: `${T}T0${n}:00:00.000Z` })
    localStorage.setItem(k, JSON.stringify(list))
  }, { T })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const grid = page.getByTestId('today-todo-grid').last()
  const g = await grid.evaluate((el) => ({ d: getComputedStyle(el).display, c: getComputedStyle(el).gridTemplateColumns.split(' ').length, n: el.children.length }))
  check(`오늘 할 일: 여섯 건이면 두 칸 그리드 ${tag}`, g.d === 'grid' && g.c === 2 && g.n >= 6, g)
  const rows = await grid.locator('li').allInnerTexts()
  const mine = rows.filter((t) => t.includes('번째로 적음')).map((t) => t.replace(/\s+/g, ' ').trim())
  check(`오늘 할 일: 적은 순서대로 번호 1~6 ${tag}`, mine.length === 6 && mine.every((t, i) => t.includes(`할 일 ${i + 1}번째로 적음`) && parseInt(t, 10) === parseInt(mine[0], 10) + i), mine)
  check(`오늘 할 일: 왼쪽 동그라미 단추 없음 — 줄마다 단추 하나 ${tag}`, (await grid.locator('li').first().locator('button').count()) === 1)
  await grid.locator('li').filter({ hasText: '할 일 2번째로 적음' }).getByRole('button').click()
  await page.waitForTimeout(300)
  const sheet = await page.getByRole('dialog').innerText().catch(() => '')
  check(`할 일 누르면 진행 중 · 완료 · 내일로 · 지우기 ${tag}`, ['진행 중', '완료', '내일', '삭제'].every((x) => sheet.includes(x)) || ['진행 중', '완료', '내일', '지우기'].every((x) => sheet.includes(x)), sheet.slice(0, 200))
  await page.keyboard.press('Escape')
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(`D-159: 가로 넘침 0 · 오류 0 ${tag}`, over <= 0 && errors.length === 0, `${over} ${errors.join(' | ')}`)
  await ctx.close()
}

await browser.close()
console.log(`\n흐름 잇기: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
