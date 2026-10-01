/**
 * 지원사업 매칭 알림 (D-141).
 *
 *  1440  빈 화면 → 공고 글 붙여넣기 → 읽기(제목 · 마감 · 조건) → 찾기 화면에도 보이기 → 저장
 *        → '맞는 업체 2곳 (계약 1 · 잠재 1)' · 서울 업체는 빠짐
 *        → 예시 6개 · 갈래 칩 · 지역 고르기(서울이면 경기 공고 사라짐)
 *        → 오늘: '맞는 업체에 알릴 공고' → 공고 창: 맞는 업체 · 이유 · [카톡 문구 복사] → 보낸 기록 · 오늘에서 그 업체 빠짐
 *        → 업체별: 잠재고객 → 맞는 공고 · 찾기 링크 복사(조건 구간만 · 연락처 없음)
 *        → 업체 상세 개요 '맞는 지원사업'
 *        → 가망고객 찾기 화면(로그인 없음): 링크 그대로 열면 조건 · 공개 공고만(예시 없음) · 이유
 *          → 알림 신청(동의 없으면 막힘) → 내부 '잠재고객 상담신청' 함에 들어옴
 *  390 아주 큰 글자  알림 화면 · 공고 창 · 찾기 화면 처음부터 칩 세 번 → 결과 · 가로 넘침 0
 *
 *   node e2e/grants.mjs http://localhost:4390
 */
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ' ' + JSON.stringify(detail).slice(0, 300)}`)
}

// 앱은 한국 시간으로 오늘을 센다
const kst = (offset = 0) => new Date(Date.now() + 9 * 3600_000 + offset * 86_400_000).toISOString().slice(0, 10)
const dot = (ymd) => ymd.replace(/-/g, '.')
const END = kst(3)

const PASTE = `[경기] 2026년 파주시 중소기업 스마트공장 구축 지원사업 공고
소관부처·지자체 경기도 파주시
사업수행기관 파주시 기업지원과
신청기간 ${dot(kst(-10))} ~ ${dot(END)}
사업개요 제조 현장 자동화 설비 도입 비용을 지원합니다. 기업당 최대 5,000만원 이내
지원대상 파주시 소재 제조업 중소기업 (창업 10년 이내, 상시 근로자 5명 이상)
https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=PBLN_TEST`

/** 업체 셋을 지원사업 조건이 보이게 고친다 — 계약 고객(파주) · 잠재고객(파주) · 서울 업체 */
function prepClients() {
  const list = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
  for (const c of list) {
    if (c.id === 'cli_hansol') Object.assign(c, { businessAddress: '경기도 파주시 문산읍 돈유1로 12', industry: '제조업 · 소프트웨어', establishedAt: '2019-03-02', employeeCount: '12명(대표 포함)' })
    if (c.id === 'cli_mirae') Object.assign(c, { businessAddress: '경기도 파주시 탄현면 평화로 3', industry: '바이오 제조', establishedAt: '2022-01-10', employeeCount: '6' })
    if (c.id === 'cli_seon') Object.assign(c, { businessAddress: '서울특별시 강남구 테헤란로 1' })
  }
  localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(list))
}

const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const clip = (page) => page.evaluate(() => navigator.clipboard.readText())

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- 1440 ---------------- */
let finderLink = ''
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(prepClients)

  // 메뉴 → 지원사업 알림
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: '지원사업 알림' }).first().click()
  await page.waitForURL(/\/grants$/)
  await page.waitForTimeout(400)
  check('메뉴: 영업 묶음에 지원사업 알림', page.url().endsWith('/grants'))
  check('빈 화면: 공고 넣기 · 예시 넣기', (await page.getByTestId('grant-examples').count()) === 1)

  // 붙여넣기 → 읽기
  await page.getByTestId('grant-add-open').click()
  await page.locator('#grant-paste').fill(PASTE)
  const t0 = Date.now()
  await page.getByTestId('grant-read').click()
  await page.getByTestId('grant-read-done').waitFor()
  check('붙여넣기: 제목을 읽음', (await page.locator('#grant-title').inputValue()).startsWith('[경기] 2026년 파주시 중소기업 스마트공장'))
  check('붙여넣기: 소관', (await page.locator('#grant-agency').inputValue()) === '경기도 파주시')
  check('붙여넣기: 마감일', (await page.locator('#grant-end').inputValue()) === END, await page.locator('#grant-end').inputValue())
  check('붙여넣기: 조건 줄(지역 · 업력 · 업종 · 직원)', /경기 파주시.*창업 10년 이내.*제조 업종.*직원 5명 이상/.test(await page.getByTestId('grant-rules-toggle').innerText()), await page.getByTestId('grant-rules-toggle').innerText())
  await page.getByTestId('grant-publish').check()
  await page.getByTestId('grant-save').click()
  await page.getByTestId('grant-row').first().waitFor()
  const took = Date.now() - t0
  check(`공고 넣기: 읽기 → 저장 ${took}ms`, took < 15000)
  const reach = await page.getByTestId('grant-reach').first().innerText()
  check('공고: 맞는 업체 2곳 (계약 1 · 잠재 1)', /맞는 업체 2곳 \(계약 1 · 잠재 1\)/.test(reach), reach)
  check('공고: 이번주/D-3 마감 파란 글자', ['week', 'soon', 'tomorrow'].includes(await page.getByTestId('grant-deadline').first().getAttribute('data-state')))

  // 예시 6개 → 7개
  await page.goto(BASE + '/grants', { waitUntil: 'networkidle' })
  check('예시 단추는 공고가 있으면 안 보임', (await page.getByTestId('grant-examples').count()) === 0)
  await page.evaluate(() => {
    // 예시는 빈 화면에서만 넣으므로, 시험에서는 공고를 잠깐 숨기지 않고 서비스로 넣는다
  })
  // 빈 화면 단추를 쓰려면 비워야 한다 — 대신 직접 적기로 한 개 더 (상시 · 서울)
  await page.getByTestId('grant-add-open').click()
  await page.getByTestId('grant-mode-manual').click()
  await page.locator('#grant-title').fill('서울 소상공인 온라인 판로 지원')
  await page.locator('#grant-agency').fill('서울특별시')
  await page.getByTestId('grant-kind-always').click()
  await page.getByTestId('grant-rules-toggle').click()
  await page.getByTestId('grant-sido-서울').click()
  await page.getByTestId('grant-publish').check()
  await page.getByTestId('grant-save').click()
  await page.waitForTimeout(500)
  check('직접 적기: 2개', (await page.getByTestId('grant-row').count()) === 2)
  const rows = await page.getByTestId('grant-list').innerText()
  check('목록: 마감 급한 순(날짜 → 상시)', rows.indexOf('파주시') < rows.indexOf('서울 소상공인'), rows)

  // 지역
  await page.getByTestId('grant-region').selectOption('서울')
  await page.waitForTimeout(300)
  const seoul = await page.getByTestId('grant-list').innerText()
  check('지역 서울: 경기 공고 사라짐 · 서울 공고 남음', !seoul.includes('파주시') && seoul.includes('서울 소상공인'))
  check('지역은 주소에 남는다', page.url().includes('r=%EC%84%9C%EC%9A%B8') || decodeURIComponent(page.url()).includes('r=서울'))
  await page.getByTestId('grant-region').selectOption('')
  await page.waitForTimeout(200)

  // 갈래 칩
  await page.getByTestId('grant-cat-rnd').click()
  await page.waitForTimeout(200)
  check('갈래 개발: 스마트공장만', (await page.getByTestId('grant-row').count()) === 1)
  await page.getByTestId('grant-cat-all').click()

  // 오늘 — 맞는 업체에 알릴 공고
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const today1 = (await page.getByTestId('today-grants').count()) ? await page.getByTestId('today-grants').innerText() : ''
  check('오늘: 맞는 업체에 알릴 공고(파주 스마트공장)', /스마트공장/.test(today1) && /한솔테크/.test(today1) && /미래바이오랩/.test(today1), today1)
  await page.getByTestId('today-grants').getByRole('link').first().click()
  await page.getByTestId('notice-sheet').waitFor()
  check('오늘 → 공고 창 바로 열림', true)

  // 공고 창 — 맞는 업체 · 이유 · 카톡 문구
  const sheet = page.getByTestId('notice-sheet')
  check('공고 창: 맞는 업체 2곳', /맞는 업체 2곳/.test(await sheet.getByTestId('notice-reach').innerText()))
  const hansol = sheet.locator('[data-testid="notice-client"][data-client="cli_hansol"]')
  check('공고 창: 계약 고객 한솔테크 조건 맞음', (await hansol.getByTestId('grant-verdict').getAttribute('data-verdict')) === 'fit')
  check('공고 창: 서울 업체(선한식품) 없음', (await sheet.locator('[data-client="cli_seon"]').count()) === 0)
  await hansol.getByRole('button', { name: '맞는 이유 보기' }).click()
  const reasons = await hansol.getByTestId('grant-reasons').innerText()
  check('이유: 지역 · 업력 · 업종 · 직원', /지역 · 경기 파주시 — 경기 파주시/.test(reasons) && /창업 10년 이내/.test(reasons) && /제조/.test(reasons) && /12명/.test(reasons), reasons)
  await hansol.getByTestId('notice-copy').click()
  await page.waitForTimeout(400)
  const msg = await clip(page)
  check('카톡 문구: 업체 · 공고 · 마감 · 원문', /한솔테크\(주\) 대표님/.test(msg) && /스마트공장/.test(msg) && /마감:/.test(msg) && /bizinfo\.go\.kr/.test(msg), msg)
  check('카톡 문구: AI 라는 말 없음', !/AI 분석|인공지능이/.test(msg))
  check('보낸 기록: 알림 보냄 날짜', (await hansol.getByTestId('notice-sent').count()) === 1)
  await page.keyboard.press('Escape')

  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const today2 = (await page.getByTestId('today-grants').count()) ? await page.getByTestId('today-grants').innerText() : ''
  check('오늘: 알린 업체(한솔테크)는 빠지고 잠재고객만 남음', !/한솔테크/.test(today2) && /미래바이오랩/.test(today2), today2)

  // 업체별 — 잠재고객
  await page.goto(BASE + '/grants?view=clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.getByTestId('grant-kind-filter-prospect').click()
  const prow = page.locator('[data-testid="grant-client-row"][data-client="cli_mirae"]')
  check('업체별: 잠재고객 미래바이오랩 맞음 1', /맞음 1/.test(await prow.getByTestId('grant-client-fit').innerText()))
  await prow.click()
  await page.getByTestId('client-sheet').waitFor()
  check('업체 창: 맞는 공고 목록', (await page.getByTestId('grant-match').count()) >= 1)
  await page.getByTestId('client-grants-link').click()
  await page.waitForTimeout(300)
  finderLink = await clip(page)
  check('찾기 링크: 조건 구간만(지역 · 업종 · 업력)', /\/grants\/find\?/.test(finderLink) && decodeURIComponent(finderLink).includes('r=경기') && decodeURIComponent(finderLink).includes('c=파주시'), finderLink)
  check('찾기 링크: 연락처 · 사업자번호 없음', !/010|phone|bizNo/.test(decodeURIComponent(finderLink)))
  await page.getByTestId('client-grants-copy').click()
  await page.waitForTimeout(300)
  const all = await clip(page)
  check('업체 한 통 문구: 건수 · 링크', /조건이 맞는 사업 1건/.test(all) && all.includes('/grants/find?'), all)
  await page.keyboard.press('Escape')

  // 업체 상세
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const card = (await page.getByTestId('detail-grants').count()) ? await page.getByTestId('detail-grants').innerText() : ''
  check('업체 상세: 맞는 지원사업 카드', /조건 맞음 1건/.test(card) && /스마트공장/.test(card), card)

  // 가망고객 찾기 화면 — 같은 브라우저(로컬 모드는 이 브라우저 기록이 공개 목록)
  const pub = await ctx.newPage()
  pub.on('pageerror', (e) => errors.push(String(e)))
  await pub.goto(finderLink.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: 'networkidle' })
  await pub.waitForTimeout(500)
  check('찾기: 로그인 없이 열림 · 회사 이름', /미래바이오랩 대표님 회사에 맞는 지원사업/.test(await pub.getByTestId('finder-title').innerText()))
  check('찾기: 고른 조건 요약', /경기 파주시/.test(await pub.getByTestId('finder-summary').innerText()))
  const frows = await pub.getByTestId('finder-list').innerText()
  check('찾기: 공개 공고(스마트공장)만 · 서울 공고 없음', /스마트공장/.test(frows) && !/서울 소상공인/.test(frows), frows)
  check('찾기: 내부 메뉴 · 업체 목록 없음', (await pub.getByText('고객 관리').count()) === 0)
  await pub.getByTestId('finder-row').first().locator('button').first().click()
  check('찾기: 이유 펼침', (await pub.getByTestId('finder-detail').count()) === 1)
  await pub.getByTestId('finder-alert-open').click()
  await pub.locator('#finder-company').fill('새봄식품')
  await pub.locator('#finder-phone').fill('010-5555-6666')
  await pub.getByTestId('finder-alert-submit').click()
  check('신청: 동의 없으면 막힘', /동의/.test(await pub.getByRole('alert').innerText()))
  await pub.getByTestId('finder-consent').check()
  await pub.getByTestId('finder-alert-submit').click()
  await pub.getByTestId('finder-done').waitFor()
  check('신청: 완료 표시', true)
  await pub.close()

  await page.goto(BASE + '/ops/inbox', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const inbox = await page.locator('main').innerText()
  check('상담신청함: 지원사업 알림 신청 도착', /상담을 신청했습니다 · 지원사업 알림/.test(inbox) && /새봄식품/.test(inbox), inbox.slice(0, 400))
  // 새 업체로 만들기 → 잠재고객(유입: 지원사업 찾기) · 고른 조건 그대로 → 맞는 공고 바로 계산
  const evCard = page.locator('li, article, section').filter({ hasText: '새봄식품' }).filter({ has: page.getByRole('button', { name: '새 업체로 만들기' }) }).last()
  await evCard.getByRole('button', { name: '새 업체로 만들기' }).click()
  await page.getByRole('button', { name: '만들고 연결' }).click()
  await page.waitForTimeout(1200)
  const lead = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((c) => c.companyName === '새봄식품'))
  check('상담신청 → 잠재고객: 유입 지원사업 찾기 · 조건 · 주소', lead?.status === 'waiting' && lead?.sales?.source === '지원사업 찾기' && decodeURIComponent(lead?.sales?.grantQuery ?? '').includes('r=경기') && lead?.businessAddress === '경기 파주시', { status: lead?.status, sales: lead?.sales && { source: lead.sales.source, q: lead.sales.grantQuery }, addr: lead?.businessAddress })
  check('상담신청 → 잠재고객: 연락처', lead?.contactPhone === '010-5555-6666')
  await page.goto(BASE + '/grants?view=clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const leadRow = page.getByTestId('grant-client-row').filter({ hasText: '새봄식품' })
  check('새 잠재고객도 맞는 공고 계산(업력 구간 · 지역)', (await leadRow.count()) === 1 && /맞음 1|확인/.test(await leadRow.innerText()), (await leadRow.count()) ? await leadRow.innerText() : '')

  // 예시 공고 — 빈 작업 공간에서 넣으면 6개 · 비공개
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('axmvp.module.grants.')) localStorage.removeItem(k)
  })
  await page.goto(BASE + '/grants', { waitUntil: 'networkidle' })
  await page.getByTestId('grant-examples').click()
  await page.waitForTimeout(800)
  check('예시: 6개 · [예시] 표시', (await page.getByTestId('grant-row').count()) === 6 && (await page.getByTestId('grant-list').innerText()).includes('[예시]'))
  const pub2 = await ctx.newPage()
  await pub2.goto(BASE + '/grants/find?r=경기&i=제조업&y=3-6', { waitUntil: 'networkidle' })
  await pub2.waitForTimeout(400)
  check('예시 공고는 찾기 화면에 안 나감', (await pub2.getByTestId('finder-row').count()) === 0)
  await pub2.close()

  check('1440: 오류 0', errors.length === 0, errors)
  check('1440: 가로 넘침 0', (await overflowX(page)) <= 0)
  await ctx.close()
}

/* ---------------- 390 아주 큰 글자 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(prepClients)
  await page.evaluate(() => localStorage.setItem('axmvp.ui.text_scale', 'extra_large'))
  await page.goto(BASE + '/grants', { waitUntil: 'networkidle' })
  await page.getByTestId('grant-add-open').click()
  await page.locator('#grant-paste').fill(PASTE)
  await page.getByTestId('grant-read').click()
  await page.getByTestId('grant-publish').check()
  await page.getByTestId('grant-save').click()
  await page.getByTestId('grant-row').first().waitFor()
  await page.waitForTimeout(300)
  check('390: 공고 넣기 → 목록', (await page.getByTestId('grant-row').count()) === 1)
  check('390: 알림 화면 가로 넘침 0', (await overflowX(page)) <= 0, await overflowX(page))
  await page.getByTestId('grant-row').first().click()
  await page.getByTestId('notice-sheet').waitFor()
  await page.waitForTimeout(400)
  const box = await page.getByTestId('notice-sheet').boundingBox()
  check('390: 공고 창이 화면 안', box && box.x >= 0 && box.x + box.width <= 390, box)
  await page.keyboard.press('Escape')

  // 찾기 화면 처음부터 — 칩 세 번
  await page.goto(BASE + '/grants/find', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check('390 찾기: 처음에는 조건 칸이 열려 있음', (await page.getByTestId('finder-form').count()) === 1)
  await page.getByTestId('finder-sido').selectOption('경기')
  await page.locator('#finder-city, [data-testid="finder-city"]').first().fill('파주시')
  await page.getByTestId('finder-industry').getByRole('button', { name: '제조업' }).click()
  await page.getByTestId('finder-years').getByRole('button', { name: '3~7년' }).click()
  await page.getByTestId('finder-apply').click()
  await page.waitForTimeout(300)
  const rowsM = await page.getByTestId('finder-row').count()
  check('390 찾기: 칩 세 번 → 맞는 공고 1', rowsM === 1, rowsM)
  check('390 찾기: 직원 수 모르면 확인 필요', (await page.getByTestId('finder-row').first().getAttribute('data-verdict')) === 'check')
  check('390 찾기: 주소에 조건이 남음(공유 가능)', decodeURIComponent(page.url()).includes('r=경기') && decodeURIComponent(page.url()).includes('y=3-6'))
  check('390 찾기: 가로 넘침 0', (await overflowX(page)) <= 0, await overflowX(page))
  const cta = await page.getByTestId('finder-alert-open').boundingBox()
  check('390 찾기: 알림 받기 단추 화면 안 · 44px 이상', cta && cta.y + cta.height <= 844 && cta.height >= 44, cta)
  check('390: 오류 0', errors.length === 0, errors)
  await ctx.close()
}

await browser.close()
console.log(`\ngrants e2e: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
