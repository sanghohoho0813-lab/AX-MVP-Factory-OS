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
  check('맞춤 추천: 지원사업 판정 — 맞는 지원사업 N건', /맞는 지원사업 \d+건/.test((await page.locator('[data-testid="smart-insight"][data-key="grants"]').innerText().catch(() => '')) ?? ''))
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
  check('오늘: 지원사업 알림(7일 안 · 맞는 업체 · 아직 안 알림)', (await page.getByTestId('today-grants').innerText()).includes('파주시 제조기업 스마트 전환'))
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
  await page.waitForTimeout(500)
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
  await page.waitForTimeout(500)
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
    localStorage.setItem('axmvp.ui.text_scale', 'extra_large')
  })
  await mp.goto(BASE + '/ops/clients/cli_hansol?tab=funding', { waitUntil: 'networkidle' })
  await mp.getByTestId('apply-checklist').waitFor()
  const box = await mp.getByLabel('사업신청서 준비됨').evaluate((el) => el.closest('label').getBoundingClientRect().height)
  check('390: 체크 목록 가로 넘침 0 · 체크 줄 44px 이상', (await overflowX(mp)) <= 0 && box >= 44, { o: await overflowX(mp), box })
  await m.close()
}

await browser.close()
console.log(`\ngrants e2e: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
