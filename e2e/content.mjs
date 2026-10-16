/**
 * 홍보 글 만들기 시험 (D-203) — 이상한 AI 식 콘텐츠 흐름을 우리 OS 에(업체 기록 → 먼저 만들 것 → 글 → 보관함). 규칙 · LLM 0.
 *
 *  1440  업체 고르기 → 홍보 정보(업체 기록 · 홈페이지 하는 일 · 대표 전화 · 담당자 휴대폰 안 씀) → 먼저 만들 것 3(키워드 먼저 · 인증 근거)
 *        키워드 → 낱말 누르면 블로그로 · 주제 고르기 → 블로그(점검: 대괄호 · 키워드) · 전체 복사(클립보드) · 다른 안
 *        보관함 저장 · 같은 글 두 번 안 넣음 · 고쳐서 2판 · 새로고침해도 그대로 · 즐겨찾기 · 같은 주제로 짧은 영상
 *        카톡 혜택 = (광고) · 밤 9시 안내 · 격식 있게(합니다) · 홍보 정보 고치기 → 키워드 따라감 · 공격 글은 글자로만 · 광고 규정 말 알림
 *        업체 기록에 붙이기(다시 열기 주소) · AI 작업실 자료로(대표) · 지우기(한 번 더 묻기) · 업체 상세 [홍보 글 만들기] 입구
 *        대표 전화 없는 가게 → 휴대폰 번호 안 들어감 · [대표 전화] 로 비움
 *  390 · 360  가로 넘침 0 · 누르는 것 44px · 먼저 만들 것 → 결과
 *  D-207  이 칸만 채우면 · 주제 전략 · 체험단 가이드(대가 표시) · 쇼츠 30~60초 · 카드뉴스 광고 유형 · 검색량 붙여 넣기 · 한 달 계획
 *  D-208  상황 예시 12(지금 때 · 묶음 탭 · 고친 글 남음 · 묶음 모두 저장 · 말투) · 한 달 치 한 번에 · 업체 일정에 올릴 날(달력) ·
 *         계획 칸 만듦/올림 · 올렸어요 · 거르기 · 새로고침해도 진행 중 계획 · 홈페이지로 바로 가기 · 휴대폰 넘침 0
 *
 *   node e2e/content.mjs http://localhost:4390 [--shots <dir>]
 */
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const shotsAt = process.argv.indexOf('--shots')
const SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : null
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ' ' + JSON.stringify(detail).slice(0, 400)}`)
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const NOW = '2026-09-01T00:00:00.000Z'
const FULL = {
  id: 'cli_site',
  companyName: '한솔정밀(주)',
  representativeName: '김한솔',
  contactName: '박담당',
  businessNumber: '1234567890',
  establishedAt: '2014-03-02',
  businessCategory: '제조업',
  businessItem: '정밀 금속부품, 금형, 시제품 가공',
  businessAddress: '경기도 화성시 동탄산단 6길 15',
  employeeCount: '42',
  companyPhone: '031-123-4567',
  contactPhone: '010-9999-8888',
  contactEmail: 'hello@hansol.co.kr',
  status: 'active',
  factValues: { certifications: '벤처기업, 이노비즈, ISO 9001', patents: '금형 냉각 구조', researchLab: '인정(2019)' },
  createdAt: NOW,
  updatedAt: NOW,
}
const NOPHONE = { id: 'cli_food', companyName: '맛나식당', businessCategory: '음식점업', businessItem: '한식', businessAddress: '서울특별시 마포구 망원로 3', contactPhone: '010-2222-3333', status: 'active', createdAt: NOW, updatedAt: NOW }
// 홈페이지(D-202)를 만들어 둔 업체 — '하는 일' 을 업체와 확인함(견본 표시 없음)
const SITE_ROW = {
  id: 'site_row_1',
  clientId: 'cli_site',
  data: { doc: { v: 1, industry: 'manufacturing', theme: { palette: 'forest', font: 'sans', corner: 'round' }, seo: { title: '', description: '' }, blocks: [{ id: 's1', type: 'services', props: { title: '주요 사업', intro: '', items: [{ name: '정밀가공', desc: '' }, { name: '금형 수리', desc: '' }] } }], createdAt: NOW, updatedAt: NOW } },
  createdAt: NOW,
  updatedAt: NOW,
}

async function seed(page) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(
    ([rows, site]) => {
      const k = 'axmvp.v1.operations_clients'
      const list = JSON.parse(localStorage.getItem(k) ?? '[]').filter((r) => !rows.some((x) => x.id === r.id))
      list.push(...rows)
      localStorage.setItem(k, JSON.stringify(list))
      for (const key of Object.keys(localStorage)) if (key.startsWith('axmvp.module.content') || key.startsWith('axmvp.module.homepage')) localStorage.removeItem(key)
      localStorage.setItem('axmvp.module.homepage.site', JSON.stringify([site]))
    },
    [[FULL, NOPHONE], SITE_ROW],
  )
}

const items = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.module.content.items') ?? '[]'))
const resultText = (page) => page.getByTestId('content-blocks').innerText()

const browser = await chromium.launch()
const errors = []

/* ================================================================== */
/* PC 1440                                                             */
/* ================================================================== */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errors.push(`console ${m.text()}`))
  await seed(page)

  // 1 업체 고르기
  await page.goto(BASE + '/tools/content', { waitUntil: 'networkidle' })
  await page.getByTestId('content-picker').waitFor()
  await page.getByTestId('content-picker-search').fill('한솔정밀')
  const pick = page.getByTestId('content-picker-item').filter({ hasText: '한솔정밀(주)' })
  check('1 업체 고르기 — 찾기로 한솔정밀(주)', (await pick.count()) === 1)
  await pick.click()
  await page.getByTestId('content-studio').waitFor()
  check('1 업체로 열림(?client=)', /\/tools\/content\/build\?client=cli_site/.test(page.url()), page.url())

  // 2 홍보 정보
  const prof = await page.getByTestId('content-profile').innerText()
  check('2 홍보 정보 — 제조 · 대표 상품(업체 기록) · 하는 일(홈페이지) · 지역 · 대표 전화 · 강점(인증 · 특허)', /제조/.test(prof) && prof.includes('정밀 금속부품') && prof.includes('정밀가공 · 금형 수리') && /홈페이지/.test(prof) && prof.includes('경기 화성시') && prof.includes('031-123-4567') && prof.includes('특허 1건'), prof)
  check('2 담당자 휴대폰은 화면 어디에도 안 씀', !(await page.content()).includes('010-9999-8888'))

  // 3 먼저 만들 것
  const picks = page.getByTestId('content-pick')
  const pickKeys = await picks.evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
  check('3 먼저 만들 것 3개 — 키워드 먼저 · 업체 소개(인증 근거) · 플레이스', pickKeys.length === 3 && pickKeys[0] === 'keywords' && pickKeys.includes('trust') && pickKeys.includes('place'), pickKeys)
  check('3 소개 추천의 까닭 = 업체 기록의 인증', /벤처기업 인증/.test(await picks.filter({ hasText: '업체 소개' }).innerText()))
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/content-pc-top.png`, fullPage: false })

  // 4 키워드 (먼저 만들 것 1번)
  await picks.first().click()
  await page.getByTestId('content-result').waitFor()
  check('4 누르면 바로 키워드 글', (await page.getByTestId('content-result').getAttribute('data-kind')) === 'keywords')
  const words = await page.getByTestId('content-word').allInnerTexts()
  check('4 키워드 — 지역 + 대표 상품 · 추천 · 견적 · 우리 이름', ['화성 정밀 금속부품', '화성 정밀 금속부품 추천', '정밀 금속부품 견적', '한솔정밀(주) 후기'].every((w) => words.includes(w)), words.slice(0, 12))
  check('4 검색량은 짐작하지 않는다는 안내', /검색량/.test(await page.getByTestId('content-checks').innerText()))
  check("4 결과 글에 'AI' 라는 말 0", !/\bAI\b/.test(await resultText(page)))
  await page.getByTestId('content-word').filter({ hasText: /^화성 정밀 금속부품 추천$/ }).click()
  check('4 낱말 누르기 → 블로그 · 키워드 칸에 그 말', (await page.locator('[data-testid="content-kind"][data-kind="blog"]').getAttribute('aria-pressed')) === 'true' && (await page.getByTestId('content-keyword').inputValue()) === '화성 정밀 금속부품 추천')

  // 5 블로그 — 고르는 기준
  await page.locator('[data-testid="content-topic"][data-type="choose"] input').check()
  await page.getByTestId('content-make').click()
  await wait(300)
  const title1 = await page.getByTestId('content-result-title').innerText()
  const blog = await resultText(page)
  check('5 블로그 — 제목에 키워드 · 기준 5가지 · 진행 순서 · 대표 전화 · 해시태그', title1.includes('화성 정밀 금속부품 추천') && /5\. /.test(blog) && blog.includes('이렇게 진행해요') && blog.includes('전화 031-123-4567') && blog.includes('#한솔정밀'), title1)
  const chk = await page.getByTestId('content-checks').innerText()
  check('5 점검 — [대괄호] 채우기(꼭) · 키워드 횟수 · 글자 수', /\[대괄호\] \d+곳/.test(chk) && /키워드 "화성 정밀 금속부품 추천"/.test(chk) && /자\(공백 포함\)/.test(chk), chk)

  // 6 전체 복사
  await page.getByTestId('content-copy').click()
  await wait(300)
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  check('6 전체 복사 — 제목으로 시작 · 해시태그로 끝 · 화면 설명(hint)은 안 들어감', clip.startsWith(title1) && /#\S+$/.test(clip.trim()) && !clip.includes('첫 문단'), clip.slice(0, 80))

  // 7 다른 안
  await page.getByTestId('content-again').click()
  await wait(300)
  const title2 = await page.getByTestId('content-result-title').innerText()
  check('7 다른 안 → 다른 제목', title2 !== title1 && title2.includes('화성 정밀 금속부품 추천'), [title1, title2])

  // 8 보관함 저장 · 같은 글 두 번 안 넣음
  await page.getByTestId('content-save').click()
  await wait(500)
  check('8 보관함에 저장 — 1편 · 이 업체 · 1판', (await items(page)).filter((r) => r.clientId === 'cli_site').length === 1 && (await page.getByTestId('content-archive-item').count()) === 1 && /보관함 · 1판/.test(await page.getByTestId('content-result').innerText()))
  await page.getByTestId('content-make').click()
  await wait(300)
  await page.getByTestId('content-save').click()
  await wait(500)
  check('8 같은 글을 다시 만들어 저장 → 두 번 안 넣음', (await items(page)).length === 1 && (await page.getByTestId('content-archive-item').count()) === 1)

  // 9 고쳐서 2판
  await page.getByTestId('content-edit').click()
  const area = page.getByTestId('content-block-input').nth(1)
  await area.fill((await area.inputValue()) + ' 저희는 도면을 받은 날 바로 회신합니다.')
  await page.getByTestId('content-save').click()
  await wait(600)
  const rows = await items(page)
  check('9 고친 판으로 저장 → 같은 사슬 2판(1판도 남음) · 목록은 한 줄 · 2판 표시', rows.length === 2 && new Set(rows.map((r) => r.data.rootId)).size === 1 && (await page.getByTestId('content-archive-item').count()) === 1 && /2판/.test(await page.getByTestId('content-archive').innerText()))

  // 10 새로고침해도 그대로 · 열면 고친 글
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('content-studio').waitFor()
  await page.getByTestId('content-archive-open').first().click()
  await wait(300)
  check('10 새로고침 → 보관함에서 열면 고친 2판', (await resultText(page)).includes('도면을 받은 날 바로 회신합니다') && /보관함 · 2판/.test(await page.getByTestId('content-result').innerText()))

  // 11 즐겨찾기
  await page.getByTestId('content-fav').first().click()
  await wait(400)
  check('11 즐겨찾기 켜짐 · 저장됨', (await page.getByTestId('content-fav').first().getAttribute('aria-pressed')) === 'true' && (await items(page)).some((r) => r.data.favorite === true))

  // 12 같은 주제로 짧은 영상
  await page.locator('[data-testid="content-chain-kind"][data-kind="shorts"]').click()
  await wait(300)
  const sh = await resultText(page)
  check('12 같은 주제로 → 짧은 영상 대본(0:00 - 0:03 · 나레이션/자막/장면 · 마무리에 회사 · 대표 전화)', (await page.getByTestId('content-result').getAttribute('data-kind')) === 'shorts' && sh.includes('0:00 - 0:03') && sh.includes('나레이션:') && sh.includes('자막:') && sh.includes('장면:') && sh.includes('한솔정밀(주) · 031-123-4567'))

  // 13 카톡 혜택 = (광고)
  await page.locator('[data-testid="content-kind"][data-kind="kakao"]').click()
  await page.locator('[data-testid="content-purpose"][data-purpose="event"]').click()
  await page.getByTestId('content-make').click()
  await wait(300)
  check('13 카톡 혜택 — 맨 앞 (광고) · 혜택 · 기간 비움 · 밤 9시 안내', (await page.getByTestId('content-block').first().locator('p.whitespace-pre-wrap').innerText()).startsWith('(광고) ') && (await resultText(page)).includes('[시작일]') && /밤 9시/.test(await page.getByTestId('content-checks').innerText()))

  // 14 격식 있게
  await page.locator('[data-testid="content-tone"][data-tone="formal"]').click()
  await wait(500)
  const formal = await resultText(page)
  check('14 격식 있게 → 화면의 글도 바로 "합니다" · 문장 끝 "~요." 0 · 저장됨', /드립니다|입니다|합니다/.test(formal) && !/[가-힣]요\.(\s|$)/.test(formal.replace(/세요\./g, '')) && (await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.module.content.profile') ?? '[]')[0]?.data?.overrides?.tone)) === 'formal', formal.slice(0, 200))
  await page.locator('[data-testid="content-tone"][data-tone="friendly"]').click()
  await wait(300)

  // 15 홍보 정보 고치기 → 키워드 따라감
  await page.getByTestId('content-profile-edit').click()
  await page.getByTestId('content-ov-item').fill('정밀가공 부품')
  await page.getByTestId('content-ov-area').fill('동탄')
  await page.getByTestId('content-ov-save').click()
  await wait(500)
  await page.locator('[data-testid="content-kind"][data-kind="blog"]').click()
  check('15 홍보 정보 고치기 → 카드에 반영 · 직접 고른 키워드도 지역 · 상품 부분이 따라감(화성 정밀 금속부품 추천 → 동탄 정밀가공 부품 추천)', (await page.getByTestId('content-profile').innerText()).includes('정밀가공 부품') && (await page.getByTestId('content-keyword').inputValue()) === '동탄 정밀가공 부품 추천', await page.getByTestId('content-keyword').inputValue())

  // 16 공격 글 · 광고 규정 말
  await page.getByTestId('content-make').click()
  await wait(300)
  await page.getByTestId('content-edit').click()
  await page.getByTestId('content-block-input').nth(1).fill('<img src=x onerror="window.__pwn=1"> 업계 최고 1위, 100% 보장')
  await wait(200)
  const ck = await page.getByTestId('content-checks').innerText()
  check('16 광고 규정 말(최고 · 1위 · 100% · 보장) → 알림', /'최고'/.test(ck) && /'1위'|1위/.test(ck) && /100%/.test(ck), ck)
  await page.getByTestId('content-edit').click()
  await wait(200)
  check('16 공격 글은 글자로만(그림 요소 0 · 실행 0)', (await page.locator('[data-testid="content-blocks"] img').count()) === 0 && (await page.evaluate(() => window.__pwn)) === undefined)

  // 17 업체 기록에 붙이기
  await page.getByTestId('content-make').click()
  await wait(300)
  await page.getByTestId('tool-attach-quick').click()
  await wait(900)
  const attached = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_site')?.toolResults?.find((t) => t.toolKey === 'content'))
  check('17 업체 기록에 붙음 — 홍보 글 · 다시 열기 주소', /^홍보 글/.test(attached?.title ?? '') && attached?.openPath === '/tools/content/build?client=cli_site', attached)

  // 18 지우기(한 번 더 묻기)
  await page.getByTestId('content-save').click()
  await wait(500)
  const before = await page.getByTestId('content-archive-item').count()
  await page.getByTestId('content-del').first().click()
  check('18 지우기 → 한 번 더 묻기', /되돌릴 수 없어요/.test(await page.getByRole('dialog').innerText()))
  await page.getByRole('dialog').getByRole('button', { name: '지우기' }).click()
  await wait(600)
  check('18 지우면 보관함에서 빠짐', (await page.getByTestId('content-archive-item').count()) === before - 1)

  // 19 AI 작업실 자료로(대표)
  await page.getByTestId('content-make').click()
  await wait(900)
  const pcShift = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.scrollTop > 0 && !['auto', 'scroll'].includes(getComputedStyle(e).overflowY)).length)
  check('19 결과로 내려갈 때 창만 굴림(PC · 밀린 바깥 상자 0)', pcShift === 0, pcShift)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/content-pc-result.png`, fullPage: false })
  const aiTitle = await page.getByTestId('content-result-title').innerText()
  await page.getByTestId('content-to-ai').click()
  await page.waitForURL(/tab=ai/, { timeout: 8000 }).catch(() => {})
  await wait(1200)
  check('19 AI 작업실에서 다듬기 → 업체 상세 AI 작업실 탭 · 자료에 "홍보 글 · 제목"', /\/ops\/clients\/cli_site\?tab=ai/.test(page.url()) && (await page.content()).includes(`홍보 글 · ${aiTitle}`), page.url())

  // 20 업체 상세 입구
  await page.goto(BASE + '/ops/clients/cli_site', { waitUntil: 'networkidle' })
  check('20 업체 상세 모듈 입구에 홍보 글 [만들기]', (await page.locator('a[href*="/tools/content/build?client=cli_site"]').count()) >= 1)

  // 21 대표 전화 없는 가게
  await page.goto(BASE + '/tools/content/build?client=cli_food', { waitUntil: 'networkidle' })
  await page.getByTestId('content-studio').waitFor()
  check('21 가게 — 대표 전화 "비어 있어요" · 음식 업종', /비어 있어요/.test(await page.getByTestId('content-profile').innerText()) && /음식/.test(await page.getByTestId('content-profile').innerText()))
  await page.locator('[data-testid="content-kind"][data-kind="place"]').click()
  await page.getByTestId('content-make').click()
  await wait(300)
  const place = await resultText(page)
  check('21 플레이스 소개 — 휴대폰 번호 안 들어감 · [대표 전화] 로 비움 · 음식 주의 안내', !place.includes('010-2222-3333') && place.includes('[대표 전화]') && /건강/.test(await page.getByTestId('content-checks').innerText()))

  /* ---------------- D-207 마케팅 규칙 ---------------- */
  await page.goto(BASE + '/tools/content/build?client=cli_site', { waitUntil: 'networkidle' })
  await page.getByTestId('content-studio').waitFor()
  const gapKeys = await page.getByTestId('content-profile-gap').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
  check('D1 이 칸만 채우면 — 차별점이 맨 앞(업체 기록에 없음)', gapKeys[0] === 'differ', gapKeys)
  await page.getByTestId('content-profile-gaps').click()
  await page.getByTestId('content-ov-differ').fill('도면 받은 날 바로 견적을 회신해요')
  await page.getByTestId('content-ov-objection').fill('소량 주문도 받아 줄까')
  await page.getByTestId('content-ov-save').click()
  await wait(500)
  const gapKeys2 = await page.getByTestId('content-profile-gap').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
  check('D1 차별점 · 망설이는 점 채움 → 안내에서 빠지고 홍보 정보 카드에 보임', !gapKeys2.includes('differ') && !gapKeys2.includes('objection') && (await page.getByTestId('content-profile').innerText()).includes('도면 받은 날 바로 견적을 회신해요'), gapKeys2)

  await page.locator('[data-testid="content-kind"][data-kind="blog"]').click()
  await page.locator('[data-testid="content-topic"][data-type="choose"] input').check()
  check('D2 고른 주제에 전략 한 줄', /전략 · /.test(await page.getByTestId('content-topic-strategy').innerText()))
  await page.getByTestId('content-make').click()
  await wait(300)
  const brand = await resultText(page)
  check('D2 우리 블로그 글 — 사진 자리 · 한눈에 정리 표 · 차별점 · 망설이는 점 풀기 · 점검에 소제목/사진 자리', /\(사진 자리:/.test(brand) && brand.includes('확인할 것 | 이유') && brand.includes('도면 받은 날 바로 견적을 회신해요') && brand.includes('소량 주문도 받아 줄까') && /사진 자리 \d+곳/.test(await page.getByTestId('content-checks').innerText()), brand.slice(0, 300))
  await page.locator('[data-testid="content-blogtype-btn"][data-value="review"]').click()
  check('D3 체험단 가이드 고르면 단추 말도 바뀜', /체험단 가이드 만들기/.test(await page.getByTestId('content-make').innerText()))
  await page.getByTestId('content-make').click()
  await wait(300)
  const guide = await resultText(page)
  check('D3 체험단 가이드 — 제목 · 꼭 넣을 키워드 · 찍을 사진 · 대가 표시(공정위) · 점검에 대가 표시', /^체험단 가이드 · 한솔정밀\(주\)/.test(await page.getByTestId('content-result-title').innerText()) && guide.includes('꼭 넣을 키워드') && guide.includes('찍어 주세요') && guide.includes('제공받아') && /대가/.test(await page.getByTestId('content-checks').innerText()), guide.slice(0, 200))
  await page.locator('[data-testid="content-blogtype-btn"][data-value="brand"]').click()

  await page.locator('[data-testid="content-kind"][data-kind="shorts"]').click()
  await page.locator('[data-testid="content-shortlen-btn"][data-value="30-60"]').click()
  await page.getByTestId('content-make').click()
  await wait(300)
  check('D4 쇼츠 30~60초 — 6구간 · 0:38 - 0:45 · 점검에 전체 약 45초', (await resultText(page)).includes('0:38 - 0:45') && /약 45초/.test(await page.getByTestId('content-checks').innerText()))

  await page.locator('[data-testid="content-kind"][data-kind="cards"]').click()
  await page.locator('[data-testid="content-adtype-btn"][data-value="objection"]').click()
  await page.getByTestId('content-make').click()
  await wait(300)
  check('D5 카드뉴스 걱정 풀기 — 표지에 손님이 망설이는 점', (await resultText(page)).includes('소량 주문도 받아 줄까, 걱정되시죠?'))
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/content-pc-adtype.png`, fullPage: false })

  await page.locator('[data-testid="content-kind"][data-kind="keywords"]').click()
  await page.getByTestId('content-make').click()
  await wait(300)
  await page.getByTestId('content-volume-input').fill('연관키워드\t월간검색수(PC)\t월간검색수(모바일)\n화성 금형\t1,230\t4,560\n화성 정밀가공\t< 10\t< 10\n동탄 시제품 제작\t300\t2,100')
  await page.getByTestId('content-volume-run').click()
  const vrows = await page.getByTestId('content-volume-row').allInnerTexts()
  check('D6 검색량 붙여 넣기 → 많이 찾는 순(화성 금형 5,790 → 동탄 시제품 제작 → 화성 정밀가공 < 10)', vrows.length === 3 && vrows[0].includes('화성 금형') && vrows[0].includes('5,790') && vrows[1].includes('동탄 시제품 제작') && vrows[2].includes('< 10'), vrows)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/content-pc-volume.png`, fullPage: false })
  await page.getByTestId('content-volume-pick').nth(1).click()
  await wait(400)
  check('D6 "이 말로 글" → 그 키워드로 블로그 글', (await page.getByTestId('content-result').getAttribute('data-kind')) === 'blog' && (await page.getByTestId('content-result-title').innerText()).includes('동탄 시제품 제작') && (await page.getByTestId('content-keyword').inputValue()) === '동탄 시제품 제작')

  await page.getByTestId('content-plan-toggle').click()
  check('D7 한 달 계획 — 주 2회 8개', (await page.getByTestId('content-plan-slot').count()) === 8)
  await page.locator('[data-testid="content-plan-per"][data-value="4"]').click()
  check('D7 주 4회 16개', (await page.getByTestId('content-plan-slot').count()) === 16)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/content-pc-plan.png`, fullPage: false })
  const slot = page.getByTestId('content-plan-slot').nth(1)
  const slotKind = await slot.getAttribute('data-kind')
  await slot.click()
  await wait(400)
  check('D7 계획 하나 누르면 바로 그 글', (await page.getByTestId('content-result').getAttribute('data-kind')) === slotKind, slotKind)

  check('22 화면 오류 0', errors.length === 0, errors)
  await ctx.close()
}

/* ================================================================== */
/* D-208 상황 예시 · 한 달 치 · 올렸어요                                   */
/* ================================================================== */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`D208 pageerror ${e.message}`))
  await seed(page)
  await page.goto(BASE + '/tools/content/build?client=cli_site', { waitUntil: 'networkidle' })
  await page.getByTestId('content-situations').waitFor()
  const sitKeys = await page.getByTestId('content-situation').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
  const nowText = await page.getByTestId('content-situation-now').allInnerTexts()
  check('D1 상황 예시 12가지 · 지금 때(이번 달 이야기)가 맨 앞', sitKeys.length === 12 && sitKeys[0] === 'season' && nowText.length >= 1 && /11월/.test(nowText[0]), { sitKeys, nowText })
  if (SHOTS) await page.getByTestId('content-situations').screenshot({ path: `${SHOTS}/content-d208-situations.png` })

  // 이사 · 확장 → 묶음 3편
  await page.locator('[data-testid="content-situation"][data-key="move"]').click()
  await page.getByTestId('content-pack').waitFor()
  const tabs = await page.getByTestId('content-pack-tab').allInnerTexts()
  const kakao = await resultText(page)
  check('D2 누르면 묶음 3편(카톡 · 블로그 · 카드뉴스) · 카톡은 (광고) · 새 주소는 [대괄호] · 지금 주소 · 물어 채울 것', tabs.length === 3 && /카톡/.test(tabs[0]) && /블로그/.test(tabs[1]) && /카드뉴스/.test(tabs[2]) && kakao.includes('(광고) 한솔정밀(주) 새 주소 안내') && kakao.includes('[새 주소]') && kakao.includes('경기도 화성시 동탄산단 6길 15') && /옮기는 날짜/.test(await page.getByTestId('content-pack-fill').innerText()), { tabs, kakao: kakao.slice(0, 120) })
  // 카톡을 고치고 블로그로 넘어갔다 돌아오면 고친 글이 남는다
  await page.getByTestId('content-edit').click()
  await page.getByTestId('content-block-input').first().fill('(광고) 한솔정밀(주) 새 주소 안내\n\n11월 3일부터 동탄2로 30에서 만나요.')
  await page.getByTestId('content-pack-tab').nth(1).click()
  await wait(300)
  check('D3 탭 넘기기 → 블로그 · 제목에 키워드', (await page.getByTestId('content-result').getAttribute('data-kind')) === 'blog' && /화성 정밀 금속부품/.test(await page.getByTestId('content-result-title').innerText()))
  await page.getByTestId('content-pack-tab').nth(0).click()
  await wait(300)
  check('D4 다시 카톡으로 → 고친 글이 남아 있음', (await resultText(page)).includes('동탄2로 30'))
  const n0 = (await items(page)).length
  await page.getByTestId('content-pack-save-all').click()
  await wait(900)
  const its = await items(page)
  const moved = its.filter((x) => x.data?.input?.situation === 'move' || x.input?.situation === 'move')
  const savedTabs = await page.getByTestId('content-pack-tab').evaluateAll((els) => els.map((e) => e.getAttribute('data-saved')))
  check('D5 묶음 모두 저장 → 보관함 3편 · 상황 표시 · 고친 카톡 그대로 · 탭마다 저장됨 · 단추 잠김', its.length - n0 === 3 && moved.length === 3 && JSON.stringify(its).includes('동탄2로 30') && savedTabs.every((x) => x === '1') && (await page.getByTestId('content-pack-save-all').isDisabled()), { added: its.length - n0, moved: moved.length, savedTabs })
  check("D6 보관함 줄에 '이사 안내'", (await page.getByTestId('content-archive').innerText()).includes('이사 안내'))
  // 말투 격식 → 묶음이 새 말투로
  await page.locator('[data-testid="content-situation"][data-key="event"]').click()
  await page.getByTestId('content-pack').waitFor()
  await page.locator('[data-testid="content-tone"][data-tone="formal"]').click()
  await wait(500)
  const formal = await resultText(page)
  check('D7 말투 격식 있게 → 묶음 글도 "입니다" · 묶음은 그대로', formal.includes('입니다') && !/예요\./.test(formal) && (await page.getByTestId('content-pack-tab').count()) === 3, formal.slice(0, 160))
  await page.locator('[data-testid="content-tone"][data-tone="friendly"]').click()
  await wait(300)

  // 한 달 치 한 번에
  await page.getByTestId('content-plan-toggle').click()
  const before8 = (await items(page)).length
  await page.getByTestId('content-plan-make-all').click()
  await wait(1500)
  const after8 = await items(page)
  const planned = after8.filter((x) => (x.data?.input?.planDate ?? x.input?.planDate))
  const states = await page.getByTestId('content-plan-slot').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))
  check('D8 한 달 치 8편 한 번에 → 보관함에 올릴 날 8개 · 칸마다 만듦 · 올림 0/8', after8.length - before8 === 8 && planned.length === 8 && states.length === 8 && states.every((x) => x === 'made') && /올림 0\/8/.test(await page.getByTestId('content-plan-progress').innerText()), { added: after8.length - before8, states })
  await page.getByTestId('content-plan-attach').getByTestId('tool-attach-quick').click()
  await wait(900)
  const tr = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_site')?.toolResults?.find((t) => t.title === '홍보 글 한 달 계획'))
  check('D9 업체 일정에 올릴 날 걸기 → 기록에 계획 · 올릴 날 8개(달력 · 오늘)', tr?.deadlines?.length === 8 && tr.deadlines.every((d) => /^홍보 글 올리기 · /.test(d.title) && /^\d{4}-\d{2}-\d{2}$/.test(d.date)), tr?.deadlines?.slice(0, 2))
  // 칸 누르면 그 글 → 올렸어요
  await page.getByTestId('content-plan-slot').first().click()
  await wait(400)
  await page.getByTestId('content-posted').click()
  await wait(600)
  const st2 = await page.getByTestId('content-plan-slot').first().getAttribute('data-state')
  check('D10 계획 칸 → 만든 글이 열림 · 올렸어요 → 칸이 올림 · 올림 1/8', st2 === 'posted' && /올림 1\/8/.test(await page.getByTestId('content-plan-progress').innerText()) && (await page.getByTestId('content-posted').getAttribute('aria-pressed')) === 'true', st2)
  await page.locator('[data-testid="content-archive-filter"][data-value="posted"]').click()
  const postedRows = await page.getByTestId('content-archive-item').count()
  await page.locator('[data-testid="content-archive-filter"][data-value="todo"]').click()
  const todoRows = await page.getByTestId('content-archive-item').count()
  check('D11 보관함 거르기 — 올린 글 1 · 아직 안 올림 = 나머지', postedRows === 1 && todoRows === (await items(page)).length - 1, { postedRows, todoRows })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('content-plan').waitFor()
  check('D12 새로고침해도 진행 중 계획 · 올림 1/8 그대로', /올림 1\/8/.test(await page.getByTestId('content-plan-progress').innerText()))
  // 보관함 줄에서 올림 되돌리기
  await page.getByTestId('content-archive-posted').filter({ has: page.locator('svg') }).first().waitFor()
  const pressed = page.locator('[data-testid="content-archive-posted"][aria-pressed="true"]')
  await pressed.first().click()
  await wait(500)
  check('D13 보관함 줄에서 올림 → 아직(되돌리기)', (await pressed.count()) === 0 && /올림 0\/8/.test(await page.getByTestId('content-plan-progress').innerText()))
  if (SHOTS) {
    await page.getByTestId('content-plan-toggle').click()
    await page.getByTestId('content-plan').screenshot({ path: `${SHOTS}/content-d208-plan.png` })
  }
  await page.getByTestId('content-to-site').click()
  await page.waitForURL(/\/tools\/homepage\/build\?client=cli_site/)
  check('D14 홍보 글 → 이 업체 홈페이지로 바로', /\/tools\/homepage\/build\?client=cli_site/.test(page.url()), page.url())
  await ctx.close()
}

/* ================================================================== */
/* 휴대폰 390 · 360                                                     */
/* ================================================================== */
for (const width of [390, 360]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${width} pageerror ${e.message}`))
  await seed(page)
  await page.goto(BASE + '/tools/content/build?client=cli_site', { waitUntil: 'networkidle' })
  await page.getByTestId('content-studio').waitFor()
  const over = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(`M${width} 첫 화면 가로 넘침 0`, (await over()) <= 0, await over())
  if (SHOTS && width === 390) await page.screenshot({ path: `${SHOTS}/content-m390-top.png`, fullPage: false })
  // D-208 상황 예시 — 휴대폰은 6개 + 더 보기 · 묶음 탭 · 넘침 0
  const visSit = await page.locator('[data-testid="content-situation"]:visible').count()
  await page.getByTestId('content-situation-more').click()
  const visSit2 = await page.locator('[data-testid="content-situation"]:visible').count()
  await page.locator('[data-testid="content-situation"][data-key="holiday"]').click()
  await page.getByTestId('content-pack').waitFor()
  await wait(400)
  const tabH = await page.getByTestId('content-pack-tab').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
  check(`M${width} D-208 상황 6개 → 더 보기 12개 · 묶음 탭 44px · 가로 넘침 0`, visSit === 6 && visSit2 === 12 && tabH.every((h) => h >= 44) && (await over()) <= 0, { visSit, visSit2, tabH })
  if (SHOTS && width === 390) await page.getByTestId('content-pack').screenshot({ path: `${SHOTS}/content-m390-pack.png` })
  await page.getByTestId('content-pick').nth(1).click()
  await page.getByTestId('content-result').waitFor()
  await wait(500)
  check(`M${width} 먼저 만들 것 → 결과 · 가로 넘침 0`, (await over()) <= 0, await over())
  // 결과로 내려갈 때 창만 굴러야 한다(바깥 상자가 밀리면 머리줄이 아래로 내려옴)
  const shifted = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.scrollTop > 0 && getComputedStyle(e).overflowY !== 'auto' && getComputedStyle(e).overflowY !== 'scroll').map((e) => e.tagName + '.' + String(e.className).slice(0, 40)).slice(0, 3))
  check(`M${width} 결과로 내려갈 때 창만 굴림(밀린 바깥 상자 0)`, shifted.length === 0 && (await page.evaluate(() => window.scrollY)) > 100, shifted)
  const small = await page.locator('[data-testid="content-studio"] button:visible, [data-testid="content-studio"] a:visible').evaluateAll((els) =>
    els
      .map((e) => ({ t: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 20), h: Math.round(e.getBoundingClientRect().height) }))
      .filter((x) => x.h > 0 && x.h < 36),
  )
  check(`M${width} 누르는 것 36px 이상(낱말 칩 36 · 단추 44)`, small.length === 0, small)
  if (SHOTS && width === 390) await page.screenshot({ path: `${SHOTS}/content-m390-result.png`, fullPage: false })
  // D-207 — 한 달 계획 · 광고 유형 · 쇼츠 길이 · 검색량 칸도 휴대폰에서 넘침 0
  await page.getByTestId('content-plan-toggle').click()
  await page.locator('[data-testid="content-plan-per"][data-value="4"]').click()
  await page.locator('[data-testid="content-kind"][data-kind="cards"]').click()
  await wait(200)
  check(`M${width} 한 달 계획 · 광고 유형 펼쳐도 가로 넘침 0`, (await over()) <= 0 && (await page.getByTestId('content-plan-slot').count()) === 16, await over())
  if (SHOTS && width === 390) {
    await page.getByTestId('content-plan').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOTS}/content-m390-plan.png`, fullPage: false })
    await page.getByTestId('content-adtype').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOTS}/content-m390-adtype.png`, fullPage: false })
  }
  await page.locator('[data-testid="content-kind"][data-kind="keywords"]').click()
  await page.getByTestId('content-make').click()
  await wait(300)
  await page.getByTestId('content-volume-input').fill('아주 긴 키워드가 들어와도 줄이 넘치지 않아야 하는 동탄 정밀 금속부품 시제품 가공\t1,230\t45,600')
  await page.getByTestId('content-volume-run').click()
  check(`M${width} 검색량 정리(긴 키워드) 가로 넘침 0`, (await over()) <= 0, await over())
  const small2 = await page.locator('[data-testid="content-studio"] button:visible').evaluateAll((els) => els.map((e) => ({ t: (e.textContent || '').trim().slice(0, 20), h: Math.round(e.getBoundingClientRect().height) })).filter((x) => x.h > 0 && x.h < 36))
  check(`M${width} D-207 새 단추도 36px 이상`, small2.length === 0, small2)
  await ctx.close()
}
check('23 휴대폰 화면 오류 0', errors.length === 0, errors)

await browser.close()
console.log(`\n홍보 글 만들기 e2e: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
