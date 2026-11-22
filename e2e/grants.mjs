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
// D-556 사진 폴더(선택) — 세 번째 인자
const SHOTS = process.argv[3] ?? ''
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
  // D-163: 지원사업 알림은 전문 모듈 › 기업성장 안 — 기업성장 줄을 펴서 누른다
  {
    const cat = page.locator('aside nav').getByRole('button', { name: /기업성장/ }).first()
    if ((await cat.getAttribute('aria-expanded')) !== 'true') await cat.click()
    await page.waitForTimeout(200)
  }
  await page.locator('aside nav').getByRole('link', { name: '지원사업 알림' }).first().click()
  await page.waitForURL(/\/grants$/)
  await page.waitForTimeout(400)
  check('메뉴: 전문 모듈 › 기업성장 안에 지원사업 알림(D-163)', page.url().endsWith('/grants'))
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

  // D-168: 2차(금액) · 3차(선정 규모 · 행사) 거르기 — 색 띠 · 기준 직접 고르기 · 거른 공고 보기 · 브라우저에 기억
  check('거르기 띠: 접수 중 → ① → ② → ③', (await page.getByTestId('grant-funnel').count()) === 1 && /2개/.test(await page.getByTestId('grant-funnel-base').innerText()))
  check('금액 칩: 파주 공고 \'기업당 최대 5,000만원\' 읽음', /5,000만원|5천만원/.test(await page.locator('[data-testid="grant-row"]', { hasText: '파주시' }).getByTestId('grant-amount').innerText()))
  await page.getByTestId('grant-add-open').click()
  await page.getByTestId('grant-mode-manual').click()
  await page.locator('#grant-title').fill('2026 수출지원 사업설명회 참가 안내')
  await page.locator('#grant-agency').fill('KOTRA')
  await page.getByTestId('grant-kind-always').click()
  await page.getByTestId('grant-save').click()
  await page.waitForTimeout(500)
  check('3차: 설명회 공고는 기본 기준에서 거름(목록 2개 그대로)', (await page.getByTestId('grant-row').count()) === 2 && /2개/.test(await page.getByTestId('grant-funnel-3').innerText()), await page.getByTestId('grant-funnel-3').innerText())
  await page.getByTestId('grant-show-hidden').click()
  await page.waitForTimeout(200)
  const hiddenRow = page.locator('[data-testid="grant-row"][data-filtered="3"]')
  check('거른 공고 보기: 설명회가 \'3차에서 거름\' 표시로 보임', (await hiddenRow.count()) === 1 && /3차에서 거름 · 설명회/.test(await hiddenRow.innerText()), await hiddenRow.innerText().catch(() => ''))
  await page.getByTestId('grant-show-hidden').click()
  await page.getByTestId('grant-filter-open').click()
  await page.getByTestId('grant-filter-amount-10000').click()
  await page.waitForTimeout(200)
  check('기준 1억원 이상: 남는 공고 수가 바로 바뀜(5천만원 공고 거름)', /1개/.test(await page.getByTestId('grant-filter-left').innerText()), await page.getByTestId('grant-filter-left').innerText())
  await page.getByRole('button', { name: '이대로 보기' }).click()
  await page.waitForTimeout(200)
  check('기준 1억원: 목록에서 파주 공고 빠짐', !(await page.getByTestId('grant-list').innerText()).includes('파주시'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('기준은 다시 열어도 기억', /1억원 이상/.test(await page.getByTestId('grant-funnel-2').innerText()), await page.getByTestId('grant-funnel-2').innerText())
  await page.getByTestId('grant-filter-open').click()
  await page.getByTestId('grant-filter-reset').click()
  await page.getByRole('button', { name: '이대로 보기' }).click()
  await page.waitForTimeout(200)
  check('처음 기준으로: 파주 공고 다시 보임', (await page.getByTestId('grant-list').innerText()).includes('파주시'))

  // D-156: 오늘에 '맞는 업체에 알릴 공고(7일 안 마감)' 를 자동으로 띄우지 않는다
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('오늘: 맞는 공고 자동 알림 없음(D-156)', (await page.getByTestId('today-grants').count()) === 0)
  await page.goto(BASE + '/grants', { waitUntil: 'networkidle' })
  await page.getByTestId('grant-row').filter({ hasText: '스마트공장' }).first().click()
  await page.getByTestId('notice-sheet').waitFor()
  check('공고 목록 → 공고 창 열림', true)

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

  // D-156: 도전해 볼 만함 — 고른 공고만 마감을 챙긴다
  const hansolApps = async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((c) => c.id === 'cli_hansol')?.fundingApplications ?? []))
  const before = (await hansolApps()).length
  await hansol.getByTestId('challenge-toggle').click()
  await page.waitForTimeout(500)
  const picked = (await hansolApps()).find((a) => /스마트공장/.test(a.programName) && a.noticeId)
  check('도전 체크: 한솔테크에 지켜보는 중 한 건 · 공고 · 마감', !!picked && picked.status === 'watching' && /^\d{4}-\d{2}-\d{2}$/.test(picked.applyDueDate ?? '') && (await hansolApps()).length === before + 1, picked)
  check('도전 체크: 단추가 \'도전 체크됨 · 마감\' 으로', /도전 체크됨 · 마감/.test(await hansol.getByTestId('challenge-toggle').innerText()) && (await hansol.getByTestId('challenge-toggle').getAttribute('aria-pressed')) === 'true')
  await page.keyboard.press('Escape')
  await page.goto(BASE + '/ops/calendar', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const ym = picked?.applyDueDate?.slice(0, 7) ?? ''
  const nowYm = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })
  if (ym && ym !== nowYm) await page.getByRole('button', { name: '다음 달' }).click()
  await page.waitForTimeout(300)
  const dueCell = page.locator(`main button[data-date="${picked?.applyDueDate}"]`)
  check('도전 체크: 일정 달력 마감일 칸에 공고가 뜸', (await dueCell.innerText()).includes('스마트공장') || (await dueCell.innerText()).includes('한솔'), await dueCell.innerText().catch(() => ''))
  await page.goto(BASE + '/grants', { waitUntil: 'networkidle' })
  await page.getByTestId('grant-row').filter({ hasText: '스마트공장' }).first().click()
  await page.getByTestId('notice-sheet').waitFor()
  await page.getByTestId('notice-sheet').locator('[data-testid="notice-client"][data-client="cli_hansol"]').getByTestId('challenge-toggle').click()
  await page.waitForTimeout(500)
  check('체크 풀기: 한솔테크 신청 건 다시 없음', (await hansolApps()).length === before)
  await page.keyboard.press('Escape')

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
  // D-144: 맞는 지원사업 카드는 '맞춤 추천' 탭으로
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
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
  await page.evaluate(() => { const k = 'axmvp.ui.preferences'; const p = JSON.parse(localStorage.getItem(k) || '{}'); p.textScale = 'extra_large'; localStorage.setItem(k, JSON.stringify(p)) })
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

/* ---------------- D-143 기업마당 받아오기(서버 함수 흉내) ---------------- */
const ymd8 = (offset) => kst(offset).replace(/-/g, '')
function feedItems(n) {
  const items = [
    { pblancId: 'PBLN_P1', pblancNm: '2026 파주시 제조기업 스마트 전환 지원', jrsdInsttNm: '경기도 파주시', excInsttNm: '파주시 기업지원과', reqstBeginEndDe: `${ymd8(-5)} ~ ${ymd8(5)}`, pldirSportRealmLclasCodeNm: '기술', trgetNm: '파주시 소재 제조업 중소기업', bsnsSumryCn: '스마트 설비 도입 비용 지원', pblancUrl: 'https://www.bizinfo.go.kr/x?pblancId=PBLN_P1', hashtags: '제조,파주', creatPnttm: '' },
    { pblancId: 'PBLN_B1', pblancNm: '2026 부산 해양기업 판로 지원', jrsdInsttNm: '부산광역시', excInsttNm: '', reqstBeginEndDe: `${ymd8(-5)} ~ ${ymd8(9)}`, pldirSportRealmLclasCodeNm: '내수', trgetNm: '부산 소재 중소기업', bsnsSumryCn: '', pblancUrl: '', hashtags: '부산', creatPnttm: '' },
    { pblancId: 'PBLN_Y1', pblancNm: '2026 예비창업패키지 모집', jrsdInsttNm: '중소벤처기업부', excInsttNm: '', reqstBeginEndDe: `${ymd8(-5)} ~ ${ymd8(9)}`, pldirSportRealmLclasCodeNm: '창업', trgetNm: '예비창업자(사업자 등록이 없는 자)', bsnsSumryCn: '', pblancUrl: '', hashtags: '', creatPnttm: '' },
  ]
  for (let i = items.length; i < n; i += 1)
    items.push({ pblancId: `PBLN_G${i}`, pblancNm: `2026 전국 공통 지원사업 ${String(i).padStart(3, '0')}`, jrsdInsttNm: '중소벤처기업부', excInsttNm: '', reqstBeginEndDe: `${ymd8(-3)} ~ ${ymd8(10 + (i % 20))}`, pldirSportRealmLclasCodeNm: '경영', trgetNm: '중소기업', bsnsSumryCn: '', pblancUrl: '', hashtags: '', creatPnttm: '' })
  return items
}
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const calls = []
  let size = 120
  await page.route('**/api/grants-feed*', (route) => {
    const u = new URL(route.request().url())
    calls.push(u.search)
    const items = feedItems(size)
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fetchedAt: new Date().toISOString(), count: items.length, items }) })
  })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(prepClients)
  await page.goto(BASE + '/grants', { waitUntil: 'networkidle' })
  await page.getByTestId('grant-feed').waitFor()
  await page.waitForTimeout(500)
  check('기업마당: 받은 공고 수 · 다음 자동 갱신 9시', /기업마당 공고 120건/.test(await page.getByTestId('grant-feed').innerText()) && /매일 아침 9시/.test(await page.getByTestId('grant-feed').innerText()), await page.getByTestId('grant-feed').innerText())
  check('기업마당: 9시 칸(slot)을 붙여 부른다 — 캐시 키', calls.length === 1 && /slot=\d{4}-\d{2}-\d{2}/.test(calls[0]), calls)
  check('1,000건 대비: 처음엔 50개만 · 더 보기', (await page.getByTestId('grant-row').count()) === 50 && (await page.getByTestId('grant-more').count()) === 1)
  await page.getByTestId('grant-more').click()
  await page.waitForTimeout(200)
  check('더 보기 → 150개까지(남은 것 모두 120)', (await page.getByTestId('grant-row').count()) === 120)
  await page.getByTestId('grant-search').fill('파주')
  await page.waitForTimeout(300)
  const pajuRow = page.getByTestId('grant-row').filter({ hasText: '파주시 제조기업 스마트 전환' })
  check('찾기: 공고 이름으로 거름', (await page.getByTestId('grant-row').count()) === 1 && (await pajuRow.count()) === 1)
  check('맞춤: 파주 · 제조 업체 2곳에 맞음(지역 · 업종)', /맞는 업체 2곳/.test(await pajuRow.innerText()), await pajuRow.innerText())
  await page.getByTestId('grant-search').fill('전국 공통 지원사업 010')
  await page.waitForTimeout(300)
  check('전국 공통: 업체 조건 없는 공고는 맞는 업체로 세지 않음', /전국 공통 · 누구나/.test(await page.getByTestId('grant-row').first().innerText()))
  await page.getByTestId('grant-search').fill('부산 해양')
  await page.waitForTimeout(300)
  check('지역: 부산 공고는 경기 업체에 안 맞음', /맞는 업체 없음/.test(await page.getByTestId('grant-row').first().innerText()))
  await page.getByTestId('grant-search').fill('파주')
  await page.waitForTimeout(200)
  await pajuRow.click()
  await page.getByTestId('notice-sheet').waitFor()
  check('기업마당 공고: 고치기 · 지우기 없음(매일 새로 받음)', (await page.getByTestId('notice-feed-note').count()) === 1 && (await page.getByTestId('notice-edit').count()) === 0)
  check('기업마당 공고: 맞는 업체 2곳(+확인 필요) · 업체마다 카톡 문구', /맞는 업체 2곳/.test(await page.getByTestId('notice-reach').innerText()) && (await page.getByTestId('notice-copy').count()) === (await page.getByTestId('notice-client').count()), await page.getByTestId('notice-reach').innerText())
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  // 지금 새로 가져오기 — 캐시 없이 바로
  size = 130
  await page.getByTestId('grant-feed-refresh').click()
  await page.waitForTimeout(800)
  check('지금 새로 가져오기: fresh 로 한 번 더 부름 · 130건', calls.length === 2 && /fresh=/.test(calls[1]) && /기업마당 공고 130건/.test(await page.getByTestId('grant-feed').innerText()), { calls, t: await page.getByTestId('grant-feed').innerText() })

  // 다른 화면 — 다시 받지 않는다(같은 9시 칸이면 저장된 것)
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const cardGrant = page.getByTestId('client-card-grants')
  check('고객 관리: 업체 카드에 맞는 지원사업 N건', (await cardGrant.count()) >= 2, await cardGrant.count())
  check('고객 관리: 다시 받지 않음(같은 9시 칸)', calls.length === 2, calls)
  await cardGrant.first().click()
  await page.waitForURL(/\/grants\?view=clients&client=/)
  await page.getByTestId('client-sheet').waitFor()
  check('고객 관리 → 지원사업 알림 업체 창', (await page.getByTestId('client-grants-count').innerText()).includes('조건 맞음'))
  check('업체 창: 전국 공통은 접어 둠', (await page.getByTestId('client-grants-general').count()) === 1 && /전국 공통 공고 \d+건 보기/.test(await page.getByTestId('client-grants-general').innerText()))
  check('업체 창: 예비창업자 전용 공고는 안 나옴', !(await page.getByTestId('client-sheet').innerText()).includes('예비창업패키지'))

  await page.goto(BASE + '/sales/board', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('영업 보드: 잠재고객 카드에 맞는 지원사업', (await page.getByTestId('sales-card-grants').count()) >= 1, await page.getByTestId('sales-card-grants').count())

  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  check('맞춤 추천: 지원사업 판정 — 가능성 높은 지원사업 N건(마감 자동 표시 없음)', /가능성 높은 지원사업 \d+건/.test((await page.locator('[data-testid="smart-insight"][data-key="grants"]').innerText().catch(() => '')) ?? ''))
  check('업체 상세: 맞는 지원사업 카드에 기업마당 공고', (await page.getByTestId('detail-grants').innerText()).includes('파주시 제조기업 스마트 전환'))

  // 오늘 — '지금 이것부터' 없음, 다가오는 마감 · 약속
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('오늘: 지금 이것부터 없음', (await page.getByRole('heading', { name: /지금 이것부터/ }).count()) === 0)
  check('오늘: 다가오는 마감 · 약속', (await page.getByRole('heading', { name: /다가오는 마감 · 약속/ }).count()) === 1)
  const agendaText = await page.getByTestId('today-agenda').innerText()
  check('오늘: 막연한 문구 없음(다음 할 일이 비어 있습니다 등)', !/비어 ?있습니다|이유:/.test(agendaText), agendaText.slice(0, 200))
  const ar = page.getByTestId('agenda-row')
  if ((await ar.count()) > 1) {
    const labels = await ar.evaluateAll((els) => els.map((e) => e.querySelector('.t-meta')?.textContent ?? ''))
    check('오늘: 다가오는 일은 날짜 순', labels.length > 0, labels)
  }
  check('오늘: 기업마당 공고도 자동 알림 없음(D-156)', (await page.getByTestId('today-grants').count()) === 0)
  check('기업마당: 여러 화면 돌아도 부른 횟수 2(처음 + 지금 새로)', calls.length === 2, calls)

  // 찾기(가망고객) — 기업마당 공고도 · 꼭 맞는 것 먼저 · 전국 공통 접힘
  await page.goto(BASE + '/grants/find?r=%EA%B2%BD%EA%B8%B0&c=%ED%8C%8C%EC%A3%BC%EC%8B%9C&i=%EC%A0%9C%EC%A1%B0%EC%97%85&y=3-6', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const frows = await page.getByTestId('finder-row').allInnerTexts()
  check('찾기: 꼭 맞는 것만 위에(파주 제조)', frows.length >= 1 && frows.some((t) => t.includes('파주시 제조기업 스마트 전환')) && !frows.some((t) => t.includes('전국 공통 지원사업')), frows.slice(0, 5))
  check('찾기: 전국 공통은 접어 둠', /전국 공통 사업 \d+개 보기/.test(await page.getByTestId('finder-general').innerText()))
  check('찾기: 예비창업자 전용 · 부산 공고 안 나옴', !(await page.locator('main').innerText()).includes('예비창업패키지') && !(await page.locator('main').innerText()).includes('부산 해양'))
  check('기업마당 화면 오류 0', errors.length === 0, errors)
  await ctx.close()
}
{
  // 키가 없을 때 — 이유를 쉬운 말로 · 화면은 직접 넣은 공고로 돈다
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.route('**/api/grants-feed*', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'no_key' }) }))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/grants', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('키 없음: 무엇을 넣어야 하는지 알려 줌', /BIZINFO_API_KEY/.test(await page.getByTestId('grant-feed-message').innerText()))
  check('키 없음: 공고 넣기 · 예시는 그대로', (await page.getByTestId('grant-add-open').count()) === 1)
  check('390: 받아오기 줄 · 단추 화면 안 · 넘침 0', (await overflowX(page)) <= 0 && ((await page.getByTestId('grant-feed-refresh').boundingBox())?.height ?? 0) >= 44)
  check('키 없음: 오류 0', errors.length === 0, errors)
  await ctx.close()
}

/* ---------------- D-151 신청 준비 ---------------- */
{
  const DUE = kst(5)
  const APPLY = `[경기] 파주시 수출기업 해외인증 지원사업 공고
소관부처·지자체 경기도 파주시
신청기간 ${dot(kst(-3))} ~ ${dot(DUE)} 18:00
지원대상 파주시 소재 제조업 중소기업
제출서류
① 사업신청서 1부(서식 1)
② 사업자등록증 사본 1부
③ 국세 · 지방세 완납증명서 각 1부
④ 4대보험 가입자 명부
문의처 031-000-0000`
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(prepClients)
  // 한솔: 사업자등록증 있음 · 4대보험 명부는 오래돼 만료
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    for (const c of list) {
      if (c.id !== 'cli_hansol') continue
      c.documents = c.documents ?? {}
      c.documents.businessRegistration = { ...(c.documents.businessRegistration ?? {}), received: true, issuedAt: '2024-03-02', fileName: '사업자등록증.pdf' }
      c.documents.payrollRoster = { ...(c.documents.payrollRoster ?? {}), received: true, issuedAt: '2026-01-05', fileName: '명부.pdf' }
      c.fundingApplications = []
    }
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(list))
  })
  await page.goto(BASE + '/grants', { waitUntil: 'networkidle' })
  await page.getByTestId('grant-add-open').click()
  await page.locator('#grant-paste').fill(APPLY)
  await page.getByTestId('grant-read').click()
  await page.getByTestId('grant-read-done').waitFor()
  await page.getByTestId('grant-save').click()
  await page.getByTestId('grant-row').filter({ hasText: '해외인증' }).first().click()
  await page.getByTestId('notice-sheet').waitFor()
  const row = page.locator('[data-testid="notice-client"][data-client="cli_hansol"]')
  check('신청 준비: 맞는 업체 줄에 [신청 준비] 단추', (await row.getByTestId('notice-apply').count()) === 1)
  await row.getByTestId('notice-apply').click()
  await row.getByTestId('notice-applied').waitFor()
  const applied = await row.getByTestId('notice-applied').innerText()
  check('신청 준비: 누르면 바로 \'신청 준비 중 · 서류 1/5\'', /신청 준비 중 · 서류 1\/5/.test(applied), applied)
  check('신청 준비: 단추는 사라짐(두 번 안 만듦)', (await row.getByTestId('notice-apply').count()) === 0)

  await row.getByTestId('notice-applied').click()
  await page.waitForURL(/\/ops\/clients\/cli_hansol\?tab=funding/)
  await page.getByTestId('apply-checklist').waitFor()
  const states = await page.getByTestId('apply-doc').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))
  check('업체 상세: 낼 서류 5가지 · 있음 1 · 만료 1 · 없음 2 · 우리 1', JSON.stringify([...states].sort()) === JSON.stringify(['expired', 'manual_todo', 'missing', 'missing', 'ok']), states)
  check('업체 상세: 마감 시각 · 공고 서류 수', /낼 서류 1\/5/.test(await page.getByTestId('apply-count').innerText()) && /18:00/.test(await page.getByTestId('apply-count').innerText()), await page.getByTestId('apply-count').innerText())
  check('업체 상세: 탭 줄에 \'지원사업 신청\'', (await page.getByRole('tab', { name: /지원사업 신청/ }).count()) === 1)
  await page.getByLabel('사업신청서 준비됨').check()
  await page.waitForTimeout(400)
  check('체크: 사업신청서 준비됨 → 2/5', /낼 서류 2\/5/.test(await page.getByTestId('apply-count').innerText()))
  await page.getByTestId('apply-copy').click()
  await page.waitForTimeout(300)
  const msg = await clip(page)
  check('카톡 문구: 모자란 셋만 · 발급처 · 마감 시각', msg.includes('아래 서류를 보내 주세요.') && msg.includes('국세 완납증명서 (발급: 홈택스)') && msg.includes('4대보험 가입자 명부') && msg.includes('갖고 있는 것이 만료') && msg.includes('18:00') && !msg.includes('사업신청서') && msg.includes('이미 받은 서류: 사업자등록증 사본'), msg)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('apply-checklist').waitFor()
  check('다시 열어도: 체크 남음 2/5', /낼 서류 2\/5/.test(await page.getByTestId('apply-count').innerText()))

  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  // 맞춤 추천 탭은 따로 불러오는 화면(0.8~1.9초) — 결정 목록이 뜰 때까지 기다린다(D-204 flow 와 같은 고침)
  await page.getByTestId('smart-decisions').waitFor({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(300)
  const smart = await page.locator('main').innerText()
  check('맞춤 추천: 다음 행동 맨 위에 \'서류 3가지 받기 · 5일 남음\'', /해외인증 지원사업 공고 — 서류 3가지 받기 · 5일 남음/.test(smart), smart.split('\n').filter((l) => /받기|확인하기|정리하기/.test(l)).slice(0, 6))

  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const agenda = await page.getByTestId('agenda-row').allInnerTexts()
  check('오늘: 다가오는 마감에 \'서류 2/5 · 18:00 마감\'', agenda.some((t) => t.includes('해외인증') && t.includes('서류 2/5') && t.includes('18:00 마감')), agenda.slice(0, 8))

  await page.goto(BASE + '/grants', { waitUntil: 'networkidle' })
  await page.getByTestId('grant-row').filter({ hasText: '해외인증' }).first().click()
  await page.getByTestId('notice-sheet').waitFor()
  check('공고 다시 열면: 신청 준비 중 · 서류 2/5', /서류 2\/5/.test(await page.locator('[data-testid="notice-client"][data-client="cli_hansol"]').getByTestId('notice-applied').innerText()))

  // D-152: 서류함 밖에서 받은 서류 · 고객 화면 요청 · 접수 → 결과 발표 → 선정 → 성공보수 · 신청 진행판
  await page.evaluate(() => {
    const now = new Date().toISOString()
    localStorage.setItem('axmvp.v1.portal_client_links', JSON.stringify([{ id: 'lnk_hansol', operationsClientId: 'cli_hansol', profileId: 'p_hansol', status: 'active', displayName: '한솔테크', profileEmail: 'ceo@hansol.kr', linkedAt: now, createdAt: now, updatedAt: now }]))
  })
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=funding', { waitUntil: 'networkidle' })
  await page.getByTestId('apply-checklist').waitFor()
  await page.getByLabel('국세 완납증명서 받았어요').click()
  await page.waitForTimeout(400)
  check('받았어요: 카톡으로 받은 국세 완납증명서 → 3/5', /낼 서류 3\/5/.test(await page.getByTestId('apply-count').innerText()), await page.getByTestId('apply-count').innerText())
  await page.getByTestId('apply-portal').waitFor()
  check('고객 화면 요청: 연결된 업체는 \'고객 화면에 요청 (2가지)\'', /고객 화면에 요청 \(2가지\)/.test(await page.getByTestId('apply-portal').innerText()), await page.getByTestId('apply-portal').innerText())
  await page.getByTestId('apply-portal').click()
  await page.getByTestId('apply-portal-done').waitFor()
  const asked = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.portal_documents') ?? '[]').filter((d) => d.status === 'requested').map((d) => `${d.title}|${d.documentType}`).sort())
  check('고객 화면 요청: 지방세 완납 · 4대보험 명부(칸 이름으로) 두 건', JSON.stringify(asked) === JSON.stringify(['4대보험 가입자 명부|payrollRoster', '지방세 완납증명서|grant_apply']), asked)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('apply-checklist').waitFor()
  check('고객 화면 요청: 다시 열어도 두 번 요청하지 않음', (await page.getByTestId('apply-portal').count()) === 0 && (await page.getByTestId('apply-portal-done').count()) === 1)

  const RESULT = kst(40)
  await page.getByLabel('결과 발표 예정일', { exact: true }).fill(RESULT)
  await page.getByTestId('apply-submitted').click()
  await page.getByTestId('apply-waiting').waitFor()
  check('접수: 접수일 · 결과 발표 예정일 · 40일 남음', /결과 발표 .*40일 남음/.test(await page.getByTestId('apply-waiting').innerText()), await page.getByTestId('apply-waiting').innerText())
  check('접수 뒤에도 탭 줄에 \'지원사업 신청\'', (await page.getByRole('tab', { name: /지원사업 신청/ }).count()) === 1)

  await page.goto(BASE + '/grants?view=applying', { waitUntil: 'networkidle' })
  await page.getByTestId('apply-board').waitFor()
  const waitRows = await page.getByTestId('board-waiting').getByTestId('board-row').allInnerTexts()
  check('신청 진행판: 결과 기다림에 한솔 · 결과 발표 날짜', waitRows.some((t) => t.includes('해외인증') && t.includes('한솔테크') && t.includes('결과 발표')), waitRows)
  check('신청 진행판: 탭 이름에 건수', /신청 진행 \d+/.test(await page.getByTestId('grant-view-applying').innerText()))
  await page.getByTestId('board-waiting').getByTestId('board-row').filter({ hasText: '해외인증' }).first().getByRole('link').first().click()
  await page.waitForURL(/cli_hansol\?tab=funding/)
  await page.getByTestId('apply-selected').waitFor()
  await page.getByLabel('선정 금액', { exact: true }).fill('3천만')
  await page.getByTestId('apply-selected').click()
  await page.locator('[data-testid="apply-stage"][data-stage="selected"]').waitFor()
  check('선정: 성공보수 10% → \'300만원 수금에 걸기\'', /300만원 수금에 걸기/.test(await page.getByTestId('apply-fee').innerText()), await page.getByTestId('apply-fee').innerText())
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  // 맞춤 추천 탭은 따로 불러오는 화면(0.8~1.9초) — 결정 목록이 뜰 때까지 기다린다(D-204 flow 와 같은 고침)
  await page.getByTestId('smart-decisions').waitFor({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(300)
  check('맞춤 추천: \'선정 — 성공보수 수금에 걸기\'', (await page.locator('main').innerText()).includes('선정 — 성공보수 수금에 걸기'))
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=funding', { waitUntil: 'networkidle' })
  await page.getByTestId('apply-fee').click()
  await page.locator('[data-testid="apply-stage"][data-stage="fee-set"]').waitFor()
  const fee = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((c) => c.id === 'cli_hansol').fees.find((f) => /해외인증.*성공보수/.test(f.label)))
  check('성공보수: 수금에 300만원 · 조건 대기(받을 날 없음)', fee?.amount === 3_000_000 && fee?.kind === 'success' && fee?.conditionKind === 'custom' && !fee?.dueDate, fee)
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=fees', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check('수금 탭: 성공보수 줄 · 미수금 아님', (await page.locator('main').innerText()).includes('해외인증 지원사업 공고 성공보수'))

  // D-153: 지원금 입금 → 성공보수 받을 돈 · 고객에게 선정 소식 · 올해 성과
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=funding', { waitUntil: 'networkidle' })
  await page.locator('[data-testid="apply-stage"][data-stage="fee-set"]').waitFor()
  await page.getByTestId('apply-news-copy').click()
  await page.waitForTimeout(300)
  const news = await clip(page)
  check('고객 소식(카톡): 선정 · 선정 금액 · 성공보수는 안 보임', news.includes('선정되었습니다') && news.includes('30,000,000원') && !news.includes('성공보수'), news)
  await page.getByTestId('apply-news-post').click()
  await page.getByTestId('apply-news-posted').waitFor()
  const posted = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.portal_updates') ?? '[]').map((u) => `${u.category}|${u.title}|${u.status}`))
  check('고객 화면에 선정 소식 한 번(결과 · 공개)', posted.filter((t) => t.includes('해외인증') && t.startsWith('result|') && t.endsWith('|published')).length === 1, posted)
  await page.getByLabel('지원금 실제 입금액').fill('3천만')
  await page.getByTestId('apply-executed-save').click()
  await page.getByTestId('apply-executed').waitFor()
  const stageText = await page.locator('[data-testid="apply-stage"][data-stage="fee-set"]').innerText()
  check('지원금 입금 → 성공보수 \'지금 받을 돈\'', stageText.includes('지금 받을 돈') && /지원금 입금 .*3,000만원|지원금 입금 .*3천만원/.test(stageText), stageText)
  const met = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((c) => c.id === 'cli_hansol').fees.find((f) => /해외인증.*성공보수/.test(f.label))?.conditionMetAt)
  check('성공보수: 조건 충족일 = 입금일', typeof met === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(met), met)
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('[data-testid="apply-stage"][data-stage="fee-set"]').waitFor()
  check('다시 열어도: 고객 화면 소식 올림 표시(두 번 안 올림)', (await page.getByTestId('apply-news-posted').count()) === 1 && (await page.getByTestId('apply-news-post').count()) === 0)
  await page.goto(BASE + '/grants?view=applying', { waitUntil: 'networkidle' })
  await page.getByTestId('board-stats').waitFor()
  check('올해 성과: 선정 1건 · 선정 금액 3,000만원', /1건/.test(await page.getByTestId('stat-selected').innerText()) && /3,000만원|3천만원/.test(await page.getByTestId('stat-approved').innerText()), [await page.getByTestId('stat-selected').innerText(), await page.getByTestId('stat-approved').innerText()])
  check('신청 단계 화면 오류 0', errors.length === 0, errors)
  check('신청 준비 화면 오류 0', errors.length === 0, errors)
  await ctx.close()

  // 390 아주 큰 글자 — 체크 목록 넘침 0 · 체크 칸 44px
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', deviceScaleFactor: 2 })
  const mp = await m.newPage()
  await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
  await mp.evaluate(seedScript())
  await mp.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    const c = list.find((x) => x.id === 'cli_hansol')
    c.fundingApplications = [{ id: 'fa1', programName: '[경기] 아주 긴 이름의 파주시 수출기업 해외인증 · 해외규격 획득 지원사업 2차 추가 공고', institution: '경기도 파주시', status: 'preparing', applyDueDate: '', submittedAt: null, resultAt: null, requestedAmount: null, approvedAmount: null, note: '', noticeId: 'x', applyDueTime: '18:00', docs: [{ label: '사업신청서', done: false }, { label: '국세 · 지방세 완납증명서 및 4대 사회보험 완납증명서(신청일 기준 발급분)', done: false }, { label: '사업자등록증 사본', done: false }], createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }]
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(list))
    { const k = 'axmvp.ui.preferences'; const p = JSON.parse(localStorage.getItem(k) || '{}'); p.textScale = 'extra_large'; localStorage.setItem(k, JSON.stringify(p)) }
  })
  await mp.goto(BASE + '/ops/clients/cli_hansol?tab=funding', { waitUntil: 'networkidle' })
  await mp.getByTestId('apply-checklist').waitFor()
  const box = await mp.getByLabel('사업신청서 준비됨').evaluate((el) => el.closest('label').getBoundingClientRect().height)
  check('390: 체크 목록 가로 넘침 0 · 체크 줄 44px 이상', (await overflowX(mp)) <= 0 && box >= 44, { o: await overflowX(mp), box })
  await m.close()
}

/* ---------------- D-182: 오늘 · 확인할 것 '자세히' — 그 자리에서 공고 핵심만 ---------------- */
for (const [w, mob] of [[1440, false], [390, true]]) {
  const tag = `(${w})`
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: mob, hasTouch: mob, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(prepClients)
  await page.evaluate(({ start, end }) => {
    const now = new Date().toISOString()
    localStorage.setItem('axmvp.module.grants.notices', JSON.stringify([{
      id: 'gn_brief', clientId: '', createdAt: now, updatedAt: now,
      data: {
        title: '[경기] 파주 제조 현장 자동화 지원', agency: '경기도 파주시', operator: '파주시 기업지원과', category: 'money',
        applyStart: start, applyEnd: end, deadlineKind: 'date', amountText: '기업당 최대 5,000만원',
        target: '파주시 소재 제조업 중소기업(창업 10년 이내) — 총 20개사 선정',
        summary: '제조 현장 자동화 설비 도입 비용을 지원합니다.', url: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=PBLN_BRIEF',
        rules: { regions: ['경기'], cities: ['파주시'], industries: ['제조'] }, source: 'manual', published: false,
      },
    }]))
  }, { start: kst(-5), end: kst(4) })
  await page.goto(BASE + '/ops/decide', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const row = page.locator('[data-testid="decision"][data-kind="grant"][data-client="cli_hansol"]').first()
  check(`공고 자세히${tag}: 한솔 — 맞는 지원사업 줄 · '자세히' 는 다른 화면으로 가는 링크가 아니라 펼치기 단추`, (await row.count()) === 1 && (await row.getByTestId('decision-more').count()) === 1 && (await row.getByTestId('decision-more').getAttribute('aria-expanded')) === 'false' && (await row.locator('a', { hasText: '자세히' }).count()) === 0)
  const url0 = page.url()
  await row.getByTestId('decision-more').click()
  await page.waitForTimeout(300)
  const brief = row.getByTestId('decision-grant-brief')
  const text = (await brief.innerText()) ?? ''
  check(`공고 자세히${tag}: 누르면 그 자리에서 펼침(주소 그대로) · 단추는 '접기'`, page.url() === url0 && (await brief.count()) === 1 && (await row.getByTestId('decision-more').innerText()).includes('접기'))
  check(`공고 자세히${tag}: 지원 금액이 맨 앞 · 최대 5천만원`, /5[,]?000만원|5천만원/.test(await brief.getByTestId('grant-brief-amount').innerText()), await brief.getByTestId('grant-brief-amount').innerText())
  check(`공고 자세히${tag}: 접수 기간 · 마감 · 선정 20곳 · 지원 대상`, text.includes(kst(4).slice(5).replace('-', '.')) && /마감|D-/.test(text) && text.includes('선정 20곳') && text.includes('지원 대상'), text.slice(0, 300))
  check(`공고 자세히${tag}: 이 업체와 맞는 조건(지역 · 업종)`, /지역/.test(await brief.getByTestId('grant-brief-fits').innerText()) && /업종/.test(await brief.getByTestId('grant-brief-fits').innerText()))
  check(`공고 자세히${tag}: 공고 원문(새 창) · 다른 공고는 '이 업체 공고 더 보기' 로 따로`, (await brief.getByTestId('grant-brief-source').getAttribute('target')) === '_blank' && /PBLN_BRIEF/.test(await brief.getByTestId('grant-brief-source').getAttribute('href')) && /\/grants\?view=clients&client=cli_hansol/.test(await brief.getByTestId('grant-brief-more').getAttribute('href')))
  check(`공고 자세히${tag}: 펼쳐도 가로 넘침 0`, (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0)
  await row.getByTestId('decision-more').click()
  await page.waitForTimeout(200)
  check(`공고 자세히${tag}: 다시 누르면 접힘`, (await row.getByTestId('decision-grant-brief').count()) === 0)
  // 오늘 화면에 맞는 공고가 위 셋 안에 있으면 거기서도 같은 펼치기
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const todayRow = page.getByTestId('today-decide').locator('[data-testid="decision"][data-kind="grant"]').first()
  if (await todayRow.count()) {
    await todayRow.getByTestId('decision-more').click()
    await page.waitForTimeout(300)
    check(`공고 자세히${tag}: 오늘 화면에서도 그 자리에서 펼침`, page.url().endsWith('/') && (await todayRow.getByTestId('decision-grant-brief').count()) === 1)
  }
  // 더 보기 → 지원사업 알림(그 업체)
  await page.goto(BASE + '/ops/decide', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const row2 = page.locator('[data-testid="decision"][data-kind="grant"][data-client="cli_hansol"]').first()
  await row2.getByTestId('decision-more').click()
  await row2.getByTestId('grant-brief-more').click()
  await page.waitForURL(/\/grants\?view=clients/)
  check(`공고 자세히${tag}: '이 업체 공고 더 보기' → 지원사업 알림(그 업체)`, /client=cli_hansol/.test(page.url()))
  check(`공고 자세히${tag}: JS 오류 없음`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}


/* ---------------- D-556 한 가지만 갖추면 더 맞는 공고(벤처 확인 · 직원 수) ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(prepClients)
  // 한솔테크 — 인증을 안다(이노비즈만) · 직원 12명
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    for (const c of list) if (c.id === 'cli_hansol') c.factValues = { ...(c.factValues ?? {}), certifications: '이노비즈' }
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(list))
  })
  const paste = async (text) => {
    await page.goto(BASE + '/grants', { waitUntil: 'networkidle' })
    await page.getByTestId('grant-add-open').click()
    await page.locator('#grant-paste').fill(text)
    await page.getByTestId('grant-read').click()
    await page.getByTestId('grant-read-done').waitFor()
    const rules = await page.getByTestId('grant-rules-toggle').innerText()
    await page.getByTestId('grant-save').click()
    await page.waitForTimeout(500)
    return rules
  }
  const r1 = await paste(`[경기] 2026년 벤처기업 성장 바우처 공고
소관부처·지자체 경기도
신청기간 ${dot(kst(-3))} ~ ${dot(kst(20))}
사업개요 기업당 최대 3,000만원 이내
지원대상 경기도 소재 벤처기업 확인을 받은 제조업 중소기업`)
  const r2 = await paste(`[경기] 2026년 파주시 제조기업 고용 우수기업 지원
소관부처·지자체 경기도 파주시
신청기간 ${dot(kst(-3))} ~ ${dot(kst(25))}
사업개요 기업당 최대 2,000만원 이내
지원대상 파주시 소재 제조업 중소기업 (상시 근로자 20명 이상)`)
  check('D-556 준비: 공고 둘을 읽음(벤처기업 대상 · 직원 20명 이상)', /벤처/.test(r1) && /직원 20명 이상/.test(r2), `${r1} | ${r2}`)
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const fold = page.getByTestId('grants-whatif')
  await fold.waitFor({ timeout: 8000 }).catch(() => {})
  const sum = (await fold.count()) ? await fold.locator('summary').innerText() : ''
  check('D-556 업체 상세: 맞는 지원사업 아래 "한 가지만 갖추면 더 맞는 공고 2건 — 벤처 확인 +1 · 직원 20명 +1"(평소 접힘)', /한 가지만 갖추면 더 맞는 공고 2건/.test(sum) && /벤처 확인 \+1/.test(sum) && /직원 20명 \+1/.test(sum) && (await fold.evaluate((d) => d.open)) === false, sum)
  await fold.locator('summary').click()
  const keys = await page.getByTestId('grants-whatif-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
  const items = await page.getByTestId('grants-whatif-list').innerText()
  check('D-556 펼치면: 벤처 확인을 받으면 → 벤처 공고 · 직원이 20명이 되면(지금보다 8명 더) → 고용 공고', keys.includes('cert:venture') && keys.includes('employees:20') && /벤처기업 확인을 받으면/.test(items) && /벤처기업 성장 바우처/.test(items) && /직원이 20명이 되면\(지금보다 8명 더\)/.test(items) && /고용 우수기업/.test(items), items)
  const hrefs = await page.getByTestId('grants-whatif-next').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check('D-556 이어서 준비: 기업인증 › 벤처기업 · 고용지원금 청년 채용 상황(이 업체로)', hrefs.includes('/tools/cert-os/venture?client=cli_hansol') && hrefs.some((h) => /\/tools\/employment\/diagnosis\?client=cli_hansol&preset=emp-youth/.test(h ?? '')), hrefs)
  const main = await page.locator('main').innerText()
  check('D-556 맞춤 추천 지원사업 칸: 맞는 공고가 없을 때 "한 가지만 갖추면 공고가 더 맞아요"', /한 가지만 갖추면 공고가 더 맞아요 — 벤처 확인 \+1 · 직원 20명 \+1/.test(main), (main.match(/지원사업[^\n]*\n[^\n]*/g) ?? []).slice(0, 3))
  if (SHOTS) await page.getByTestId('detail-grants').screenshot({ path: `${SHOTS}/d556-whatif.png` }).catch(() => {})
  await page.getByTestId('grants-whatif-next').first().click()
  await page.waitForTimeout(800)
  check('D-556 [기업인증 › 벤처기업에서 준비] → 그 업체 벤처 화면', /\/tools\/cert-os\/venture\?client=cli_hansol/.test(page.url()), page.url())
  // D-557 기업인증 › 벤처 — 맨 위 한 줄 · '받으면 무엇이 달라지나요?' 칸
  const vLine = page.getByTestId('cert-grant-line')
  await vLine.waitFor({ timeout: 8000 }).catch(() => {})
  check('D-557 기업인증 › 벤처 맨 위: "벤처기업 확인을 받으면 지금 열린 지원사업 1건이 더 맞아요"', /벤처기업 확인을 받으면 지금 열린 지원사업 1건이 더 맞아요/.test(await vLine.innerText().catch(() => '')), await vLine.innerText().catch(() => ''))
  await page.getByTestId('cert-step-3').click()
  const gain = await page.getByTestId('cert-grant-gain').innerText().catch(() => '')
  check('D-557 기업인증 › 벤처 4단계: 받으면 더 맞는 공고 제목 · 선정 약속 아님', /벤처기업 확인을 받으면 1건이 더 맞아요/.test(gain) && /벤처기업 성장 바우처/.test(gain) && /선정을 약속하지 않아요/.test(gain), gain)
  // D-557 인증이 곧 끝나면 — 이노비즈 60일 뒤 끝 · 그 뒤에도 접수하는 이노비즈 공고
  await page.evaluate((until) => {
    const list = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    // 실제 서류 올리기(확인서 → 회사 정보 '인증서' 칸)와 같은 모양 — 기업인증 화면도 같은 칸을 읽는다
    for (const c of list) if (c.id === 'cli_hansol') c.customFields = [...(c.customFields ?? []).filter((f) => f.label !== '이노비즈'), { id: 'cf_inno', group: 'credential', label: '이노비즈', value: `확인번호 R-2023-0001 · 확인일 2023-01-02 · ${until}까지 · 중소벤처기업부` }]
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(list))
  }, kst(60))
  const r3 = await paste(`[경기] 2026년 이노비즈 기업 기술고도화 지원
소관부처·지자체 경기도
신청기간 ${dot(kst(-1))} ~ ${dot(kst(90))}
사업개요 기업당 최대 4,000만원 이내
지원대상 경기도 소재 이노비즈 인증 제조업 중소기업`)
  check('D-557 준비: 이노비즈 대상 공고를 읽음', /이노비즈/.test(r3), r3)
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const ren = page.getByTestId('grants-renewal-item')
  await ren.first().waitFor({ timeout: 8000 }).catch(() => {})
  const renText = (await ren.count()) ? await ren.first().innerText() : ''
  check('D-557 업체 상세: "이노비즈 인증이 …에 끝나요(60일 남음) — 갱신하지 않으면 공고 1건을 못 해요" · 공고 · 갱신 준비 주소', (await ren.first().getAttribute('data-cert').catch(() => '')) === 'innobiz' && new RegExp(`이노비즈 인증이 ${kst(60)}에 끝나요\\(60일 남음\\) — 갱신하지 않으면 공고 1건을 못 해요`).test(renText) && /이노비즈 기업 기술고도화/.test(renText) && (await page.getByTestId('grants-renewal-next').first().getAttribute('href')) === '/tools/cert-os/innobiz?client=cli_hansol', renText)
  if (SHOTS) await page.getByTestId('detail-grants').screenshot({ path: `${SHOTS}/d557-renewal.png` }).catch(() => {})
  await page.getByTestId('grants-renewal-next').first().click()
  await page.waitForTimeout(1200)
  const iLine = page.getByTestId('cert-grant-line')
  await iLine.waitFor({ timeout: 8000 }).catch(() => {})
  check('D-557 기업인증 › 이노비즈 맨 위: 빨간 갱신 줄', /갱신하지 않으면 공고 1건을 못 해요/.test(await iLine.innerText().catch(() => '')), await iLine.innerText().catch(() => ''))
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/d557-cert-innobiz.png` }).catch(() => {})
  check('D-556 화면 오류 0', errors.length === 0, errors)
  await ctx.close()
}

/* ---------------- D-623 맞는 공고 골라서 보내기(고르기 · 한 줄 의견 · 보낸 기록 · 보낼 곳만) ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(prepClients)
  const paste = async (text) => {
    await page.goto(BASE + '/grants', { waitUntil: 'networkidle' })
    await page.getByTestId('grant-add-open').click()
    await page.locator('#grant-paste').fill(text)
    await page.getByTestId('grant-read').click()
    await page.getByTestId('grant-read-done').waitFor()
    await page.getByTestId('grant-save').click()
    await page.waitForTimeout(500)
  }
  const mkNotice = (name, days, money) => `[경기] 2026년 파주시 ${name} 공고
소관부처·지자체 경기도 파주시
신청기간 ${dot(kst(-5))} ~ ${dot(kst(days))}
사업개요 기업당 최대 ${money} 이내
지원대상 파주시 소재 제조업 중소기업
https://www.bizinfo.go.kr/web/view.do?pblancId=PBLN_${days}`
  await paste(mkNotice('제조기업 설비 개선 지원', 4, '3,000만원'))
  await paste(mkNotice('수출 판로 개척 지원', 12, '2,000만원'))
  await paste(mkNotice('디자인 개발 지원', 25, '1,000만원'))

  // 업체별 — 아직 한 번도 안 알린 업체는 '보낼 곳만' 에 들어 있다
  await page.goto(BASE + '/grants?view=clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const hrow = page.locator('[data-testid="grant-client-row"][data-client="cli_hansol"]')
  check('D-623 업체별: 한솔테크 맞음 3', /맞음 3/.test(await hrow.getByTestId('grant-client-fit').innerText()))
  const due0 = Number((await page.getByTestId('grant-due-filter').innerText()).replace(/\D/g, ''))
  await page.getByTestId('grant-due-filter').click()
  check('D-623 보낼 곳만: 아직 한 번도 안 알린 한솔테크가 들어 있음', (await hrow.count()) === 1 && /아직 한 번도 안 알림/.test(await hrow.innerText()) && due0 >= 1, { due0 })
  await hrow.click()
  await page.getByTestId('client-sheet').waitFor()
  check('D-623 업체 창: [골라서 보내기] · 예전 [카톡 문구 복사] 도 그대로', (await page.getByTestId('client-grants-digest').count()) === 1 && (await page.getByTestId('client-grants-copy').count()) === 1)
  check('D-623 한 번도 안 알린 업체는 지난번 알림 줄 없음', (await page.getByTestId('grant-sent-last').count()) === 0)
  await page.getByTestId('client-grants-digest').click()
  await page.getByTestId('grant-digest').waitFor()
  const picked = () => page.locator('[data-testid="grant-digest-row"][data-picked="1"]').count()
  check('D-623 고르기 단계: 같은 창 안에서 바뀜(목록은 사라지고 창은 하나)', (await page.getByTestId('client-grants').count()) === 0 && (await page.getByTestId('client-sheet').count()) === 1)
  check('D-623 처음: 맞는 공고 3건이 골라져 있음 · 안내 한 줄', (await picked()) === 3 && /아직 한 번도 알리지 않은 업체/.test(await page.getByTestId('grant-digest-lead').innerText()), await page.getByTestId('grant-digest-lead').innerText())
  const order = await page.getByTestId('grant-digest-row').allInnerTexts()
  check('D-623 순서: 마감 급한 공고가 맨 위', /설비 개선/.test(order[0]) && /디자인 개발/.test(order[2]), order.map((t) => t.slice(0, 30)))
  // 하나 빼고 · 한 줄 의견 · 한마디 → 미리 보기 = 복사되는 글
  await page.getByTestId('grant-digest-row').nth(2).getByTestId('grant-digest-check').uncheck()
  check('D-623 하나 빼면 2건 · 뺀 공고는 의견 칸이 없음', (await picked()) === 2 && (await page.getByTestId('grant-digest-comment').count()) === 2 && /고른 공고 2건/.test(await page.getByTestId('grant-digest-count').innerText()))
  await page.getByTestId('grant-digest-comment').first().fill('설비 견적서만 받으면 바로 낼 수 있어요')
  await page.getByTestId('grant-digest-note').fill('지난주 미팅에서 말씀드린 건입니다.')
  await page.getByTestId('grant-digest-preview-toggle').click()
  const pv = await page.getByTestId('grant-digest-preview').innerText()
  check('D-623 미리 보기: 인사 · 한마디 · 2건 · 번호 · 의견 · 공고 주소', /한솔테크\(주\) 대표님, 안녕하세요/.test(pv) && pv.includes('지난주 미팅에서 말씀드린 건입니다.') && pv.includes('공고 2건을 골라') && /① .*설비 개선/.test(pv) && /② .*수출 판로/.test(pv) && pv.includes('· 제 의견: 설비 견적서만 받으면 바로 낼 수 있어요') && pv.includes('pblancId=PBLN_4') && !pv.includes('디자인 개발'), pv)
  check('D-623 미리 보기: 맞는 조건 · 지원 금액 · 선정을 약속하지 않음', pv.includes('· 지원: ') && pv.includes('· 맞는 조건: ') && pv.includes('선정 여부는 심사에서 정해집니다'), pv)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/d623-digest-pc.png` }).catch(() => {})
  await page.getByTestId('grant-digest-send').click()
  await page.getByTestId('client-grants').waitFor()
  await page.waitForTimeout(400)
  const copied = await clip(page)
  check('D-623 복사된 글 = 미리 보기', copied.replace(/\s+/g, ' ').trim() === pv.replace(/\s+/g, ' ').trim(), copied.slice(0, 200))
  check('D-623 보낸 뒤: 목록으로 돌아옴 · 지난번 알림 줄 · 새로 올라온 것 없음', /지난번 알림 \d+\/\d+/.test(await page.getByTestId('grant-sent-last').innerText()) && /새로 올라온 맞는 공고 없음/.test(await page.getByTestId('grant-sent-last').innerText()), await page.getByTestId('grant-sent-last').innerText())
  check('D-623 보낸 공고 줄에 "알림 보냄"', (await page.getByTestId('grant-match').filter({ hasText: '알림 보냄' }).count()) === 2)
  await page.getByTestId('grant-sent-toggle').click()
  const hist = await page.getByTestId('grant-sent-list').innerText()
  check('D-623 보낸 기록: 날짜 · 카톡 문구 · 공고 2건 · 이름 · 의견 · 한마디', /카톡 문구 · 공고 2건/.test(hist) && /설비 개선/.test(hist) && hist.includes('의견: 설비 견적서만 받으면 바로 낼 수 있어요') && hist.includes('한마디: 지난주 미팅에서 말씀드린 건입니다.'), hist)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/d623-history-pc.png` }).catch(() => {})
  const stored = await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith('axmvp.module.grants.sent'))
    const rows = JSON.parse(localStorage.getItem(k) ?? '[]')
    return rows.map((r) => r.data)
  })
  const rec = stored.find((d) => d.note)
  check('D-623 저장된 기록: 공고 id 2 · 그때 이름 · 적은 의견 1 · 한마디', rec && rec.noticeIds.length === 2 && Object.keys(rec.titles ?? {}).length === 2 && Object.keys(rec.comments ?? {}).length === 1 && rec.channel === 'kakao', rec)
  // 다시 열면 — 새로 올라온 것이 없어 아무것도 골라져 있지 않다(같은 공고를 또 보내지 않게)
  await page.getByTestId('client-grants-digest').click()
  await page.getByTestId('grant-digest').waitFor()
  check('D-623 다시 열면: 골라 둔 것 0 · 보내기 단추 꺼짐 · 보낸 공고에 날짜', (await picked()) === 0 && (await page.getByTestId('grant-digest-send').isDisabled()) && /새로 올라온 맞는 공고는 없어요/.test(await page.getByTestId('grant-digest-lead').innerText()) && (await page.locator('[data-testid="grant-digest-row"][data-bucket="sent"]').count()) === 2)
  await page.getByTestId('grant-digest-back').click()
  await page.getByTestId('client-grants').waitFor()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const due1 = Number((await page.getByTestId('grant-due-filter').innerText()).replace(/\D/g, ''))
  check('D-623 보낸 업체는 보낼 곳에서 빠짐', due1 === due0 - 1 && (await hrow.count()) === 0, { due0, due1 })

  // 사흘 전에 알린 것으로 돌리면 — 그 뒤에 넣은 공고(안 보낸 1건)가 '새로 올라온 공고' 로 뜬다
  await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.startsWith('axmvp.module.grants.sent'))
    const rows = JSON.parse(localStorage.getItem(k) ?? '[]')
    const at = new Date(Date.now() - 3 * 86_400_000).toISOString()
    for (const r of rows) r.data.at = at
    localStorage.setItem(k, JSON.stringify(rows))
  })
  await page.goto(BASE + '/grants?view=clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const fresh = await hrow.getByTestId('grant-client-fresh').innerText().catch(() => '')
  check('D-623 업체별 줄: "지난번 알린 뒤 새로 올라온 맞는 공고 1건"', /새로 올라온 맞는 공고 1건/.test(fresh), fresh)
  await hrow.click()
  await page.getByTestId('client-sheet').waitFor()
  check('D-623 업체 창: 지난번 알림 줄에 "그 뒤 새로 올라온 맞는 공고 1건"', /그 뒤 새로 올라온 맞는 공고 1건/.test(await page.getByTestId('grant-sent-last').innerText()))
  await page.getByTestId('client-grants-digest').click()
  await page.getByTestId('grant-digest').waitFor()
  const first = page.getByTestId('grant-digest-row').first()
  check('D-623 새로 올라온 1건만 골라져 있고 맨 위 · "새로 올라옴"', (await picked()) === 1 && (await first.getAttribute('data-bucket')) === 'fresh' && /디자인 개발/.test(await first.innerText()) && /새로 올라옴/.test(await first.innerText()), await first.innerText())
  await page.keyboard.press('Escape')

  // 업체 상세 › 맞춤 추천 — 같은 단추 · 같은 기록
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  await page.getByTestId('detail-grants').waitFor({ timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(600)
  const dg = page.getByTestId('detail-grants')
  check('D-623 업체 상세: [골라서 보내기] · 지난번 알림 줄', (await dg.getByTestId('client-grants-digest').count()) === 1 && /지난번 알림/.test(await dg.getByTestId('grant-sent-last').innerText().catch(() => '')))
  await dg.getByTestId('client-grants-digest').scrollIntoViewIfNeeded()
  await dg.getByTestId('client-grants-digest').click()
  check('D-623 업체 상세: 카드 안에서 고르기 단계로', (await dg.getByTestId('grant-digest').count()) === 1 && (await dg.locator('[data-testid="grant-digest-row"][data-picked="1"]').count()) === 1)
  check('D-623 화면 오류 0', errors.length === 0, errors)
  await ctx.close()

  // 390 — 고르기 단계 가로 넘침 0 · 누르는 칸 크기
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true, permissions: ['clipboard-read', 'clipboard-write'] })
  const mp = await m.newPage()
  const merr = []
  mp.on('pageerror', (e) => merr.push(String(e)))
  await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
  await mp.evaluate(seedScript())
  await mp.evaluate(prepClients)
  await mp.evaluate((today) => {
    // 공고 셋을 바로 넣는다(붙여넣기 길은 위 PC 에서 봤다)
    const mk = (id, title, end) => ({ id, clientId: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), data: { title, agency: '경기도 파주시', operator: '', category: 'money', applyStart: '', applyEnd: end, deadlineKind: 'date', amountText: '기업당 최대 3,000만원 이내', target: '파주시 소재 제조업 중소기업', summary: '', url: 'https://www.bizinfo.go.kr/web/view.do?pblancId=' + id, rules: { regions: ['경기'], cities: ['파주시'], withinYears: null, minYears: null, industries: ['제조'], excludeIndustries: [], minEmployees: null, maxEmployees: null, minRevenueM: null, maxRevenueM: null, sizes: [], youthCeo: false, womenCeo: false, certs: [], preStartupOnly: false }, source: 'paste', published: false } })
    const plus = (n) => new Date(new Date(today + 'T00:00:00Z').getTime() + n * 86_400_000).toISOString().slice(0, 10)
    localStorage.setItem('axmvp.module.grants.notices', JSON.stringify([mk('m1', '[경기] 2026년 파주시 중소 제조기업 스마트 설비 개선 및 공정 자동화 지원사업 참여기업 모집 공고', plus(4)), mk('m2', '[경기] 파주시 수출 판로 개척 지원', plus(12)), mk('m3', '[경기] 파주시 디자인 개발 지원', plus(25))]))
  }, kst(0))
  await mp.goto(BASE + '/grants?view=clients&client=cli_hansol', { waitUntil: 'networkidle' })
  await mp.getByTestId('client-sheet').waitFor({ timeout: 8000 }).catch(() => {})
  const hasBtn = await mp.getByTestId('client-grants-digest').count()
  if (hasBtn) {
    await mp.getByTestId('client-grants-digest').click()
    await mp.getByTestId('grant-digest').waitFor()
    await mp.getByTestId('grant-digest-comment').first().fill('긴 의견도 한 줄로 들어가는지 봅니다 — 설비 견적서와 사업자등록증만 준비하시면 됩니다')
    await mp.getByTestId('grant-digest-preview-toggle').click()
  }
  const box = hasBtn ? await mp.getByTestId('grant-digest-send').boundingBox() : null
  check('D-623 390: 고르기 단계 열림 · 3건 골라짐', hasBtn === 1 && (await mp.locator('[data-testid="grant-digest-row"][data-picked="1"]').count()) === 3)
  check('D-623 390: 가로 넘침 0', (await overflowX(mp)) <= 0, await overflowX(mp))
  check('D-623 390: 보내기 단추 높이 40px 이상', !!box && box.height >= 40, box)
  if (SHOTS) await mp.screenshot({ path: `${SHOTS}/d623-digest-390.png` }).catch(() => {})
  check('D-623 390: 화면 오류 0', merr.length === 0, merr)
  // D-645 대표님께 드릴 한 장 — 같은 판 안 다음 단계 · 공고마다 한 줄 · 종이 그대로 · 인쇄하면 보낸 기록에 '한 장' 한 번
  if (hasBtn) {
    await mp.getByTestId('grant-digest-note').fill('지난주 미팅에서 말씀드린 건입니다.')
    await mp.getByTestId('grant-digest-sheet').click()
    await mp.getByTestId('digest-sheet').waitFor()
    const rows = await mp.getByTestId('digest-sheet-row').allInnerTexts()
    check('D-645 390: 같은 창 안 다음 단계 · 고른 3건 · 공고마다 한 줄(마감 · 서류 n/m)', (await mp.getByTestId('grant-digest').count()) === 0 && (await mp.getByTestId('client-sheet').count()) === 1 && rows.length === 3 && rows.every((r) => /서류 \d+\/\d+/.test(r)) && /공고 3건/.test(await mp.getByTestId('digest-sheet-lead').innerText()), rows)
    check('D-645 390: 처음엔 종이 접힘(공고 줄 · 단추만)', (await mp.getByTestId('digest-sheet-paper').count()) === 0)
    await mp.getByTestId('digest-sheet-paper-toggle').click()
    const paper = await mp.getByTestId('digest-sheet-paper').innerText()
    check('D-645 390: 종이 — 업체 대표님께 · 건수 · 한마디 · 의견 · 신청 방법 · 선정 약속 0', /한솔테크\(주\) 대표님께/.test(paper) && paper.includes('맞는 지원사업 공고 3건') && paper.includes('지난주 미팅에서 말씀드린 건입니다.') && paper.includes('긴 의견도 한 줄로 들어가는지 봅니다') && paper.includes('신청 방법') && paper.includes('신청서 · 사업계획서는 저희가 같이 씁니다.') && paper.includes('선정 여부는 심사에서 정해집니다') && !/수수료/.test(paper) && !/AI(?!랩)/.test(paper), paper.slice(-400))
    check('D-645 390: 종이 펼쳐도 가로 넘침 0', (await overflowX(mp)) <= 0, await overflowX(mp))
    if (SHOTS) await mp.screenshot({ path: `${SHOTS}/d645-sheet-390.png`, fullPage: true }).catch(() => {})
    // 인쇄 — 종이만 보이고(머리줄 · 단추 0) 공고 3건
    await mp.emulateMedia({ media: 'print' })
    const printed = await mp.evaluate(() => {
      const solo = document.querySelector('body > .print-solo [data-testid="digest-sheet-doc"]')
      const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'
      return { solo: vis(solo), items: solo ? solo.querySelectorAll('[data-testid="digest-sheet-item"]').length : 0, step: vis(document.querySelector('[data-testid="digest-sheet"]')) }
    })
    await mp.emulateMedia({ media: 'screen' })
    check('D-645 인쇄 모양: 종이만 · 공고 3건 · 화면 단추 안 보임', printed.solo && printed.items === 3 && !printed.step, printed)
    await mp.evaluate(() => {
      window.__printed = 0
      window.print = () => {
        window.__printed += 1
      }
    })
    const sheetRows = () =>
      mp.evaluate(() => {
        const k = Object.keys(localStorage).find((x) => x.startsWith('axmvp.module.grants.sent'))
        return JSON.parse(localStorage.getItem(k ?? '') ?? '[]').map((r) => r.data).filter((d) => d.channel === 'sheet')
      })
    await mp.getByTestId('digest-sheet-print').click()
    await mp.getByTestId('digest-sheet-recorded').waitFor({ timeout: 4000 }).catch(() => {})
    await mp.getByTestId('digest-sheet-print').click()
    await mp.waitForTimeout(300)
    const sr = await sheetRows()
    check('D-645 [인쇄 · PDF로 저장] 두 번 → 인쇄 창 두 번 · 보낸 기록 "한 장" 은 한 번(공고 3 · 이름 · 의견 · 한마디)', (await mp.evaluate(() => window.__printed)) === 2 && sr.length === 1 && sr[0].noticeIds.length === 3 && Object.keys(sr[0].titles ?? {}).length === 3 && Object.keys(sr[0].comments ?? {}).length === 1 && sr[0].note === '지난주 미팅에서 말씀드린 건입니다.', sr)
    await mp.getByTestId('digest-sheet-back').click()
    await mp.getByTestId('grant-digest').waitFor()
    check('D-645 [고르기로] → 고른 것 · 의견 · 한마디 그대로', (await mp.locator('[data-testid="grant-digest-row"][data-picked="1"]').count()) === 3 && (await mp.getByTestId('grant-digest-comment').first().inputValue()).startsWith('긴 의견도') && (await mp.getByTestId('grant-digest-note').inputValue()) === '지난주 미팅에서 말씀드린 건입니다.')
    await mp.getByTestId('grant-digest-back').click()
    await mp.getByTestId('client-grants').waitFor()
    await mp.getByTestId('grant-sent-toggle').click().catch(() => {})
    const hist = await mp.getByTestId('grant-sent-list').innerText().catch(() => '')
    check('D-645 보낸 기록 줄: "한 장(인쇄 · PDF) · 공고 3건"', /한 장\(인쇄 · PDF\) · 공고 3건/.test(hist), hist)
    check('D-645 390: 화면 오류 0', merr.length === 0, merr)
  }
  await m.close()
}

/* ---------------- D-639 공고 원문 파일 올리기(진짜 PDF · 여러 쪽) ---------------- */
{
  const { writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const ymdParts = (ymd) => ymd.split('-').map(Number)
  const spaced = (ymd) => {
    const [y, m, d] = ymdParts(ymd)
    return `${y}. ${m}. ${d}.`
  }
  const START = kst(-5)
  const DUE = kst(12)
  // 부처 공고 원문 꼴 — 1쪽 표지(번호 줄 · 공고명 · 서명) · 2쪽 개요 · 자격 · 3쪽 기간 · 서류
  const html = `<html><head><meta charset="utf-8"><style>
    body{font-family:'WenQuanYi Zen Hei',sans-serif;font-size:14px;line-height:1.7;margin:48px}
    .pg{page-break-after:always} p{margin:0 0 6px}
  </style></head><body>
  <div class="pg">
    <p>경기도 공고 제2026 - 4410호</p>
    <p>2026년 경기도 제조기업 디지털전환 바우처 참여기업 모집 공고</p>
    <p>경기도 내 제조 중소기업의 디지털 전환을 돕기 위해 다음과 같이 참여기업을 모집합니다.</p>
    <p>${dot(START)}</p>
    <p>경기도지사</p>
  </div>
  <div class="pg">
    <p>1. 사업 개요</p>
    <p>❍ (지원규모) 총 40억원, 80개사 내외</p>
    <p>❍ (지원내용) 기업당 최대 4천만원 이내 바우처(자부담 30%)</p>
    <p>❍ (사업기간) 협약일 ~ ${spaced(kst(200))}</p>
    <p>2. 신청 자격</p>
    <p>❍ (지원대상) 경기도 소재 제조업 중소기업(상시 근로자 5명 이상)</p>
    <p>* 국세·지방세 체납 기업 제외</p>
    <p>❍ (우대사항) 여성기업 가점</p>
  </div>
  <div>
    <p>3. 신청 기간 및 방법</p>
    <p>❍ (신청기간) ${spaced(START)}(월) ~ ${spaced(DUE)}(금) 18:00까지</p>
    <p>❍ (신청방법) 누리집 온라인 접수</p>
    <p>4. 제출서류</p>
    <p>① 참여신청서 1부(서식 제1호)</p>
    <p>② 사업자등록증 사본 1부</p>
    <p>③ 국세·지방세 완납증명서 각 1부</p>
    <p>④ 4대보험 가입자 명부 1부</p>
    <p>5. 문의처</p>
    <p>❍ 경기도 산업정책과 031-000-0000</p>
  </div></body></html>`
  const maker = await browser.newPage()
  await maker.setContent(html, { waitUntil: 'load' })
  const pdfPath = join(tmpdir(), 'axmvp-d639-notice.pdf')
  writeFileSync(pdfPath, await maker.pdf({ format: 'A4' }))
  await maker.close()
  const txtPath = join(tmpdir(), 'axmvp-d639-empty.txt')
  writeFileSync(txtPath, '안내\n자세한 내용은 붙임 파일을 참고하시기 바랍니다.')

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(prepClients)
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    for (const c of list) if (c.id === 'cli_hansol') c.fundingApplications = []
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(list))
  })
  await page.goto(BASE + '/grants', { waitUntil: 'networkidle' })
  await page.getByTestId('grant-add-open').click()
  check('D639 공고 넣기: [공고 파일 올리기] 칸 · AI 준비 중 자리 없음', (await page.getByTestId('grant-doc-pick').count()) === 1 && !(await page.getByTestId('grant-add').innerText()).includes('AI로 공고 PDF'))

  // 읽을 것 없는 파일 → 까닭 한 줄 · 칸은 그대로
  await page.getByTestId('grant-doc-file').setInputFiles(txtPath)
  await page.getByRole('alert').filter({ hasText: '공고 글을 찾지 못했어요' }).waitFor({ timeout: 15000 })
  check('D639 읽을 것 없는 파일: 까닭 한 줄 · 고르기 칸 그대로', (await page.getByTestId('grant-doc-pick').count()) === 1 && (await page.getByTestId('notice-form').count()) === 0)

  const t0 = Date.now()
  await page.getByTestId('grant-doc-file').setInputFiles(pdfPath)
  await page.getByTestId('grant-doc-done').waitFor({ timeout: 30000 })
  const took = Date.now() - t0
  check(`D639 진짜 PDF 3쪽 읽기 ${took}ms(10초 안)`, took < 10000)
  check('D639 공고명: 번호 줄 · 서명이 아니라 공고 이름', (await page.locator('#grant-title').inputValue()) === '2026년 경기도 제조기업 디지털전환 바우처 참여기업 모집 공고', await page.locator('#grant-title').inputValue())
  check('D639 소관: 번호 줄 앞(경기도)', (await page.locator('#grant-agency').inputValue()) === '경기도', await page.locator('#grant-agency').inputValue())
  check('D639 기간: 시작 · 마감(사업기간은 안 읽음)', (await page.locator('#grant-start').inputValue()) === START && (await page.locator('#grant-end').inputValue()) === DUE, [await page.locator('#grant-start').inputValue(), await page.locator('#grant-end').inputValue()])
  const docs = (await page.getByTestId('grant-docs').inputValue()).split('\n')
  check('D639 제출 서류 칸: 다섯(국세 · 지방세 나눔)', JSON.stringify(docs) === JSON.stringify(['참여신청서', '사업자등록증 사본', '국세 완납증명서', '지방세 완납증명서', '4대보험 가입자 명부']), docs)
  const line = await page.getByTestId('grant-doc-line').innerText()
  check('D639 한 줄: 읽은 칸 · 제출 서류 5개 · 3쪽', line.includes('신청 기간') && line.includes('제출 서류 5개') && (await page.getByTestId('grant-doc-done').innerText()).includes('3쪽'), line)
  check('D639 못 찾은 칸 줄 없음', (await page.getByTestId('grant-doc-missing').count()) === 0)
  await page.getByTestId('grant-doc-where').click()
  const where = await page.getByTestId('grant-doc-found').innerText()
  check('D639 어디서 읽었나: 공고명 1쪽 · 대상 2쪽 · 기간 3쪽', /공고명 · 1쪽/.test(where) && /지원 대상 · 2쪽/.test(where) && /신청 기간 · 3쪽/.test(where), where)
  check('D639 조건 줄: 경기 · 제조 · 직원 5명 이상', /경기.*제조 업종.*직원 5명 이상/.test(await page.getByTestId('grant-rules-toggle').innerText()), await page.getByTestId('grant-rules-toggle').innerText())
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/d639-pc.png`, fullPage: false })

  await page.getByTestId('grant-save').click()
  await page.getByTestId('grant-row').filter({ hasText: '디지털전환 바우처' }).first().waitFor()
  await page.getByTestId('grant-row').filter({ hasText: '디지털전환 바우처' }).first().click()
  await page.getByTestId('notice-sheet').waitFor()
  const row = page.locator('[data-testid="notice-client"][data-client="cli_hansol"]')
  check('D639 저장 → 맞는 업체(파주 제조)에 [신청 준비]', (await row.getByTestId('notice-apply').count()) === 1)
  await row.getByTestId('notice-apply').click()
  await row.getByTestId('notice-applied').waitFor()
  check('D639 신청 준비: 파일에서 읽은 서류 5가지로 맞춰 봄', /서류 \d\/5/.test(await row.getByTestId('notice-applied').innerText()), await row.getByTestId('notice-applied').innerText())
  check('D639 화면 오류 0', errors.length === 0, errors)
  await ctx.close()

  // 휴대폰 390 — 고르기 칸 · 읽은 뒤 한 장 넘침 0
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const mp = await m.newPage()
  await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
  await mp.evaluate(seedScript())
  await mp.goto(BASE + '/grants', { waitUntil: 'networkidle' })
  await mp.getByTestId('grant-add-open').click()
  const pickBox = await mp.getByTestId('grant-doc-pick').boundingBox()
  check('D639 390: 고르기 칸 높이 44px 이상', (pickBox?.height ?? 0) >= 44, pickBox)
  await mp.getByTestId('grant-doc-file').setInputFiles(pdfPath)
  await mp.getByTestId('grant-doc-done').waitFor({ timeout: 30000 })
  check('D639 390: 읽은 뒤 가로 넘침 0', (await overflowX(mp)) <= 0, await overflowX(mp))
  if (SHOTS) await mp.screenshot({ path: `${SHOTS}/d639-390.png`, fullPage: false })
  await m.close()
}

/* ---------------- D-641 떨어진 신청 — 까닭 기록 · 다시 올라온 공고 · 다시 도전 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.route('**/api/grants-feed*', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'no_key' }) }))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(prepClients)
  await page.evaluate((today) => {
    const plus = (n) => new Date(new Date(today + 'T00:00:00Z').getTime() + n * 86_400_000).toISOString().slice(0, 10)
    const rules = { regions: ['경기'], cities: ['파주시'], withinYears: null, minYears: null, industries: ['제조'], excludeIndustries: [], minEmployees: null, maxEmployees: null, minRevenueM: null, maxRevenueM: null, sizes: [], youthCeo: false, womenCeo: false, certs: [], preStartupOnly: false }
    const mk = (id, title, end) => ({ id, clientId: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), data: { title, agency: '경기도 파주시', operator: '', category: 'money', applyStart: '', applyEnd: end, deadlineKind: 'date', amountText: '기업당 최대 3,000만원', target: '파주시 소재 제조업 중소기업', summary: '', url: 'https://www.bizinfo.go.kr/web/view.do?pblancId=' + id, rules, source: 'paste', published: false } })
    localStorage.setItem('axmvp.module.grants.notices', JSON.stringify([mk('rt1', '[경기] 2026년 파주시 스마트 설비 지원사업 모집 공고', plus(20)), mk('rt2', '[경기] 파주시 디자인 개발 지원', plus(25))]))
    const all = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    const r = all.find((x) => x.id === 'cli_hansol')
    r.fundingApplications = [...(r.fundingApplications ?? []), { id: 'rt-app', programName: '2025년 파주시 스마트 설비 지원사업', institution: '파주시', status: 'rejected', applyDueDate: plus(-345), submittedAt: plus(-350), resultAt: plus(-300), requestedAmount: null, approvedAmount: null, note: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(all))
  }, kst(0))
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=funding', { waitUntil: 'networkidle' })
  const rowR = page.getByTestId('reject-row')
  await rowR.waitFor({ timeout: 8000 })
  await rowR.getByTestId('retry-hit').waitFor({ timeout: 8000 })
  check('D641 떨어진 건: [떨어진 까닭 남기기] 한 줄 · 같은 사업 공고 "다시 올라왔어요" · [신청 준비]', (await rowR.getByTestId('reject-open').count()) === 1 && /다시 올라왔어요 — \[경기\] 2026년 파주시 스마트 설비/.test(await rowR.getByTestId('retry-hit').innerText()) && (await rowR.getByTestId('retry-prepare').count()) === 1, await rowR.innerText())
  check('D641 다른 사업 공고(디자인)는 다시 올라온 공고 아님', !(await rowR.innerText()).includes('디자인'))

  await rowR.getByTestId('reject-open').click()
  const form = page.getByTestId('reject-form')
  await form.waitFor()
  check('D641 처음엔 접힌 한 줄 → 누르면 까닭 넷 · 메모 · 다시 도전/접기', (await form.getByTestId('reject-reason').count()) === 4 && (await form.getByTestId('reject-plan').count()) === 2)
  await form.locator('[data-testid="reject-reason"][data-key="plan"]').click()
  await form.locator('[data-testid="reject-reason"][data-key="docs"]').click()
  await form.getByLabel('떨어진 까닭 메모').fill('발표 때 매출 근거 질문')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/d641-form-pc.png` }).catch(() => {})
  await form.getByTestId('reject-save').click()
  await page.getByTestId('reject-summary').waitFor()
  const sum = await page.getByTestId('reject-summary').innerText()
  check('D641 저장 → "지난번: 사업계획서 · 발표 · 서류 빠짐 · 늦음 — 메모 · n월 무렵 다시 도전"', /지난번: 사업계획서 · 발표 · 서류 빠짐 · 늦음 — '발표 때 매출 근거 질문'/.test(sum) && /\d+월 무렵 다시 도전/.test(sum), sum)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('reject-summary').waitFor()
  check('D641 새로 고쳐도 그대로(업체 기록에 저장)', (await page.getByTestId('reject-summary').innerText()) === sum)

  // 오늘 '확인할 것 모두 보기' — 다시 도전할까요?(지난 까닭 같이)
  await page.goto(BASE + '/ops/decide', { waitUntil: 'networkidle' })
  const dz = page.getByTestId('decision').filter({ hasText: '작년에 떨어진' })
  await dz.first().waitFor({ timeout: 8000 }).catch(() => {})
  check('D641 확인할 것: "작년에 떨어진 … 다시 올라왔어요 — 다시 도전할까요?"', (await dz.count()) === 1, await page.getByTestId('decision-title').allInnerTexts().catch(() => []))
  check('D641 같은 업체에 같은 공고를 "도전해 볼까요?" 로 또 묻지 않음(다른 파주 업체는 그대로)', (await page.locator('[data-testid="decision"][data-client="cli_hansol"]').filter({ hasText: '스마트 설비 지원사업 모집 공고 — 도전해 볼까요?' }).count()) === 0)

  // 1년 일정표 — 다시 올라온 공고 마감에 '다시 도전'
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart&year=1', { waitUntil: 'networkidle' })
  await page.getByTestId('year-plan').waitFor({ timeout: 8000 })
  const dueYm = kst(20).slice(0, 7)
  await page.locator(`[data-testid="year-month"][data-key="${dueYm}"] button`).first().click()
  const yItems = await page.getByTestId('year-month-items').innerText()
  check('D641 1년 일정표: 다시 올라온 공고 마감 · "다시 도전" · 까닭은 안 씀', /파주시 스마트 설비/.test(yItems) && yItems.includes('다시 도전') && !yItems.includes('매출 근거'), yItems)
  await page.keyboard.press('Escape')

  // [신청 준비] → 새 신청 건에 지난 까닭 · 이번엔 이것부터
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=funding', { waitUntil: 'networkidle' })
  await page.getByTestId('retry-prepare').click()
  await page.getByTestId('retry-of').first().waitFor({ timeout: 8000 })
  const of = await page.getByTestId('retry-of').first().innerText()
  check('D641 [신청 준비] → 새 건에 "다시 도전 — 지난번: …" · "이번엔: …" 두 줄', /다시 도전 — 지난번: 사업계획서 · 발표/.test(of) && (of.match(/이번엔:/g) ?? []).length === 2, of)
  check('D641 다시 신청 중이면 "다시 올라왔어요" 줄 사라짐', (await page.getByTestId('retry-hit').count()) === 0)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/d641-pc.png`, fullPage: true }).catch(() => {})
  check('D641 화면 오류 0', errors.length === 0, errors)
  await ctx.close()

  // 휴대폰 390 — 까닭 고르기 판 넘침 0 · 칩 높이
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const mp = await m.newPage()
  await mp.route('**/api/grants-feed*', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'no_key' }) }))
  await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
  await mp.evaluate(seedScript())
  await mp.evaluate(prepClients)
  await mp.evaluate((today) => {
    const plus = (n) => new Date(new Date(today + 'T00:00:00Z').getTime() + n * 86_400_000).toISOString().slice(0, 10)
    const all = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    const r = all.find((x) => x.id === 'cli_hansol')
    r.fundingApplications = [...(r.fundingApplications ?? []), { id: 'rt-app', programName: '2025년 파주시 스마트 설비 지원사업', institution: '파주시', status: 'rejected', applyDueDate: plus(-345), submittedAt: null, resultAt: plus(-300), requestedAmount: null, approvedAmount: null, note: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(all))
  }, kst(0))
  await mp.goto(BASE + '/ops/clients/cli_hansol?tab=funding', { waitUntil: 'networkidle' })
  await mp.getByTestId('reject-open').click()
  await mp.getByTestId('reject-form').waitFor()
  const chipBox = await mp.getByTestId('reject-reason').first().boundingBox()
  check('D641 390: 까닭 고르기 판 넘침 0 · 칩 높이 44px 이상', (await overflowX(mp)) <= 0 && (chipBox?.height ?? 0) >= 44, [await overflowX(mp), chipBox])
  if (SHOTS) await mp.screenshot({ path: `${SHOTS}/d641-390.png` }).catch(() => {})
  await m.close()
}

await browser.close()
console.log(`\ngrants e2e: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
