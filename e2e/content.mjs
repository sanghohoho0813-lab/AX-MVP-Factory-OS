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
 *  D-226  색 — 홍보 정보 머리 띠(테마와 상관없이 보라) · 먼저 만들 것 · 형식 · 상황마다 색 아이콘 · 결과 색 띠 · 마케팅 첫 화면 색 띠 3 ·
 *         360/390 상황 이름 칸 짜부라짐 0
 *  D-228  글 재료(후기 · 한마디 · 혜택+끝나는 날 · 가격 · 말하는 사람) → 카드뉴스 · 카톡에 그대로 · 기한 지나면 빠짐 · 고친 글 사실 대조 ·
 *         다른 AI 도구 요청문(복사 · 사실 목록) → 받은 글 점검(주지 않은 혜택 · 지어낸 출처 · 업력 모순) → 보관함 · 검색량 등급 · 월 100 이상만 ·
 *         390 넘침 0 · 44px
 *  D-229  콘텐츠 작성 규칙집 — 브리프 6칸 줄(화자 이름 비면 노랑) · 흔한 반박 · 배송 · 교환 · 넣지 말 것 → 요청문 · 점검 ·
 *         요청문은 고른 채널로(길이 · 지역 · 마지막 제안) · 결과 아래 발행 전 검수표(자동 · 사람 체크) · 카드 5안 순서 · 기본 7장 · 360/390
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
/** D-227 '무엇을 만들까요' — 네 길(추천 · 상황 · 직접 · 한 달 계획) 중 하나만 펼친다. 이미 골랐으면 그대로 */
async function mode(page, key) {
  const b = page.locator(`[data-testid="content-mode"] [data-key="${key}"]`)
  if ((await b.getAttribute('aria-selected')) !== 'true') await b.click()
}
/** 한 달 계획 펼치기 — D-227 부터 '한 달 계획' 을 고르면 펼친 채로 열린다(접혀 있을 때만 누른다) */
async function planOpen(page) {
  await mode(page, 'plan')
  const t = page.getByTestId('content-plan-toggle')
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click()
}

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
  await mode(page, 'pick')
  await picks.first().click()
  await page.getByTestId('content-result').waitFor()
  check('4 누르면 바로 키워드 글', (await page.getByTestId('content-result').getAttribute('data-kind')) === 'keywords')
  const words = await page.getByTestId('content-word').allInnerTexts()
  check('4 키워드 — 지역 + 대표 상품 · 추천 · 견적 · 우리 이름', ['화성 정밀 금속부품', '화성 정밀 금속부품 추천', '정밀 금속부품 견적', '한솔정밀(주) 후기'].every((w) => words.includes(w)), words.slice(0, 12))
  check('4 검색량은 짐작하지 않는다는 안내', /검색량/.test(await page.getByTestId('content-checks').innerText()))
  check("4 결과 글에 'AI' 라는 말 0", !/\bAI\b/.test(await resultText(page)))
  await page.getByTestId('content-word').filter({ hasText: /^화성 정밀 금속부품 추천$/ }).click()
  await mode(page, 'direct')
  check('4 낱말 누르기 → 블로그 · 키워드 칸에 그 말', (await page.locator('[data-testid="content-kind"][data-kind="blog"]').getAttribute('aria-pressed')) === 'true' && (await page.getByTestId('content-keyword').inputValue()) === '화성 정밀 금속부품 추천')

  // 5 블로그 — 고르는 기준
  await mode(page, 'direct')
  await page.locator('[data-testid="content-topic"][data-type="choose"] input').check()
  await mode(page, 'direct')
  await page.getByTestId('content-make').click()
  await wait(300)
  const title1 = await page.getByTestId('content-result-title').innerText()
  const blog = await resultText(page)
  // D-229 규칙집 3-1 — 키워드로 시작 · 기준 2가지 + 정리 · 구분선 뒤 끝맺음 · 연락처 · 해시태그
  check('5 블로그 — 제목 맨 앞에 키워드 + 쉼표 · 기준 2가지 + 정리 · 구분선 · 대표 전화 · 해시태그', title1.startsWith('화성 정밀 금속부품 추천,') && /2\. /.test(blog) && !/3\. /.test(blog.split('정리 —')[0]) && blog.includes('정리 — 이 2가지만 기억하세요') && blog.includes('(구분선)') && blog.includes('전화 031-123-4567') && blog.includes('#한솔정밀'), title1)
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
  await mode(page, 'direct')
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
  check('12 같은 주제로 → 짧은 영상 대본(0:00 - 0:03 · 나레이션/자막/장면 · 끝은 요약 + 업체 말 한 줄)', (await page.getByTestId('content-result').getAttribute('data-kind')) === 'shorts' && sh.includes('0:00 - 0:03') && sh.includes('나레이션:') && sh.includes('자막:') && sh.includes('장면:') && sh.includes('한솔정밀(주)에 편하게'))

  // 13 카톡 혜택 = (광고)
  await mode(page, 'direct')
  await page.locator('[data-testid="content-kind"][data-kind="kakao"]').click()
  await mode(page, 'direct')
  await page.locator('[data-testid="content-purpose"][data-purpose="event"]').click()
  await mode(page, 'direct')
  await page.getByTestId('content-make').click()
  await wait(300)
  check('13 카톡 혜택 — 맨 앞 (광고) · 혜택 · 기간 비움 · 밤 9시 안내', (await page.getByTestId('content-block').first().locator('p.whitespace-pre-wrap').innerText()).startsWith('(광고) ') && (await resultText(page)).includes('[시작일]') && /밤 9시/.test(await page.getByTestId('content-checks').innerText()))

  // 14 격식 있게
  await mode(page, 'direct')
  await page.locator('[data-testid="content-tone"][data-tone="formal"]').click()
  await wait(500)
  const formal = await resultText(page)
  check('14 격식 있게 → 화면의 글도 바로 "합니다" · 문장 끝 "~요." 0 · 저장됨', /드립니다|입니다|합니다/.test(formal) && !/[가-힣]요\.(\s|$)/.test(formal.replace(/세요\./g, '')) && (await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.module.content.profile') ?? '[]')[0]?.data?.overrides?.tone)) === 'formal', formal.slice(0, 200))
  await mode(page, 'direct')
  await page.locator('[data-testid="content-tone"][data-tone="friendly"]').click()
  await wait(300)

  // 15 홍보 정보 고치기 → 키워드 따라감
  await page.getByTestId('content-profile-edit').click()
  await page.getByTestId('content-ov-item').fill('정밀가공 부품')
  await page.getByTestId('content-ov-area').fill('동탄')
  await page.getByTestId('content-ov-save').click()
  await wait(500)
  await mode(page, 'direct')
  await page.locator('[data-testid="content-kind"][data-kind="blog"]').click()
  await mode(page, 'direct')
  check('15 홍보 정보 고치기 → 카드에 반영 · 직접 고른 키워드도 지역 · 상품 부분이 따라감(화성 정밀 금속부품 추천 → 동탄 정밀가공 부품 추천)', (await page.getByTestId('content-profile').innerText()).includes('정밀가공 부품') && (await page.getByTestId('content-keyword').inputValue()) === '동탄 정밀가공 부품 추천', await page.getByTestId('content-keyword').inputValue())

  // 16 공격 글 · 광고 규정 말
  await mode(page, 'direct')
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
  check('16 [고치기 그만] → 고친 글은 그대로 남음(글자로) · "저장 전" 표시', (await resultText(page)).includes('업계 최고 1위') && (await page.getByTestId('content-unsaved').count()) === 1)

  // 17 업체 기록에 붙이기 — 고친 글이 남아 있으면 새로 만들기 전에 한 번 묻는다
  await mode(page, 'direct')
  await page.getByTestId('content-make').click()
  check('16 저장 전 고침이 있는데 [만들기] → 한 번 묻기', /저장하지 않은 고침/.test(await page.getByRole('dialog').innerText()))
  await page.getByRole('dialog').getByRole('button', { name: '고침 버리고 넘어가기' }).click()
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
  await mode(page, 'direct')
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
  await mode(page, 'direct')
  await page.locator('[data-testid="content-kind"][data-kind="place"]').click()
  await mode(page, 'direct')
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

  await mode(page, 'direct')
  await page.locator('[data-testid="content-kind"][data-kind="blog"]').click()
  await mode(page, 'direct')
  await page.locator('[data-testid="content-topic"][data-type="choose"] input').check()
  check('D2 고른 주제에 전략 한 줄', /전략 · /.test(await page.getByTestId('content-topic-strategy').innerText()))
  await mode(page, 'direct')
  await page.getByTestId('content-make').click()
  await wait(300)
  const brand = await resultText(page)
  check('D2 우리 블로그 글 — 사진 자리 · 표 1개(작성자 소개 표) · 차별점(다리 문장) · 망설이는 점 풀기 · 점검에 소제목/사진 자리', /\(사진 자리:/.test(brand) && brand.includes('항목 | 내용') && !brand.includes('확인할 것 | 이유') && brand.includes('이렇게 지켜요 — 도면 받은 날 바로 견적을 회신해요') && brand.includes('도면 받은 날 바로 견적을 회신해요') && brand.includes('소량 주문도 받아 줄까') && /사진 자리 \d+곳/.test(await page.getByTestId('content-checks').innerText()), brand.slice(0, 300))
  await mode(page, 'direct')
  await page.locator('[data-testid="content-blogtype-btn"][data-value="review"]').click()
  await mode(page, 'direct')
  check('D3 체험단 가이드 고르면 단추 말도 바뀜', /체험단 가이드 만들기/.test(await page.getByTestId('content-make').innerText()))
  await mode(page, 'direct')
  await page.getByTestId('content-make').click()
  await wait(300)
  const guide = await resultText(page)
  check('D3 체험단 가이드 — 제목 · 꼭 넣을 키워드 · 찍을 사진 · 대가 표시(공정위) · 점검에 대가 표시', /^체험단 가이드 · 한솔정밀\(주\)/.test(await page.getByTestId('content-result-title').innerText()) && guide.includes('꼭 넣을 키워드') && guide.includes('찍어 주세요') && guide.includes('제공받아') && /대가/.test(await page.getByTestId('content-checks').innerText()), guide.slice(0, 200))
  await mode(page, 'direct')
  await page.locator('[data-testid="content-blogtype-btn"][data-value="brand"]').click()

  await mode(page, 'direct')
  await page.locator('[data-testid="content-kind"][data-kind="shorts"]').click()
  await page.locator('[data-testid="content-shortlen-btn"][data-value="30-60"]').click()
  await mode(page, 'direct')
  await page.getByTestId('content-make').click()
  await wait(300)
  check('D4 쇼츠 30~60초 — 6구간 · 0:38 - 0:45 · 점검에 전체 약 45초', (await resultText(page)).includes('0:38 - 0:45') && /약 45초/.test(await page.getByTestId('content-checks').innerText()))

  await mode(page, 'direct')
  await page.locator('[data-testid="content-kind"][data-kind="cards"]').click()
  await page.locator('[data-testid="content-adtype-btn"][data-value="objection"]').click()
  await mode(page, 'direct')
  await page.getByTestId('content-make').click()
  await wait(300)
  check('D5 카드뉴스 걱정 풀기 — 표지에 손님이 망설이는 점', (await resultText(page)).includes('소량 주문도 받아 줄까, 걱정되시죠?'))
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/content-pc-adtype.png`, fullPage: false })

  await mode(page, 'direct')
  await page.locator('[data-testid="content-kind"][data-kind="keywords"]').click()
  await mode(page, 'direct')
  await page.getByTestId('content-make').click()
  await wait(300)
  await page.getByTestId('content-volume-input').fill('연관키워드\t월간검색수(PC)\t월간검색수(모바일)\n화성 금형\t1,230\t4,560\n화성 정밀가공\t< 10\t< 10\n동탄 시제품 제작\t300\t2,100')
  await page.getByTestId('content-volume-run').click()
  const vrows = await page.getByTestId('content-volume-row').allInnerTexts()
  check('D6 검색량 붙여 넣기 → 많이 찾는 순(화성 금형 5,790 → 동탄 시제품 제작 → 화성 정밀가공 < 10)', vrows.length === 3 && vrows[0].includes('화성 금형') && vrows[0].includes('5,790') && vrows[1].includes('동탄 시제품 제작') && vrows[2].includes('< 10'), vrows)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/content-pc-volume.png`, fullPage: false })
  await page.getByTestId('content-volume-pick').nth(1).click()
  await wait(400)
  await mode(page, 'direct')
  check('D6 "이 말로 글" → 그 키워드로 블로그 글', (await page.getByTestId('content-result').getAttribute('data-kind')) === 'blog' && (await page.getByTestId('content-result-title').innerText()).includes('동탄 시제품 제작') && (await page.getByTestId('content-keyword').inputValue()) === '동탄 시제품 제작')

  await planOpen(page)
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
  await mode(page, 'situation')
  await page.getByTestId('content-situations').waitFor()
  await mode(page, 'situation')
  const sitKeys = await page.getByTestId('content-situation').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
  const nowText = await page.getByTestId('content-situation-now').allInnerTexts()
  check('D1 상황 예시 12가지 · 지금 때(이번 달 이야기)가 맨 앞', sitKeys.length === 12 && sitKeys[0] === 'season' && nowText.length >= 1 && /11월/.test(nowText[0]), { sitKeys, nowText })
  await mode(page, 'situation')
  if (SHOTS) await page.getByTestId('content-situations').screenshot({ path: `${SHOTS}/content-d208-situations.png` })

  // 이사 · 확장 → 묶음 3편
  await mode(page, 'situation')
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
  await mode(page, 'situation')
  await page.locator('[data-testid="content-situation"][data-key="event"]').click()
  await page.getByTestId('content-pack').waitFor()
  await mode(page, 'direct')
  await page.locator('[data-testid="content-tone"][data-tone="formal"]').click()
  await wait(500)
  const formal = await resultText(page)
  check('D7 말투 격식 있게 → 묶음 글도 "입니다" · 묶음은 그대로', formal.includes('입니다') && !/예요\./.test(formal) && (await page.getByTestId('content-pack-tab').count()) === 3, formal.slice(0, 160))
  await mode(page, 'direct')
  await page.locator('[data-testid="content-tone"][data-tone="friendly"]').click()
  await wait(300)

  // 한 달 치 한 번에
  await planOpen(page)
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
  await mode(page, 'plan')
  await page.getByTestId('content-plan').waitFor()
  check('D12 새로고침해도 진행 중 계획 · 올림 1/8 그대로', /올림 1\/8/.test(await page.getByTestId('content-plan-progress').innerText()))
  // 보관함 줄에서 올림 되돌리기
  await page.getByTestId('content-archive-posted').filter({ has: page.locator('svg') }).first().waitFor()
  const pressed = page.locator('[data-testid="content-archive-posted"][aria-pressed="true"]')
  await pressed.first().click()
  await wait(500)
  check('D13 보관함 줄에서 올림 → 아직(되돌리기)', (await pressed.count()) === 0 && /올림 0\/8/.test(await page.getByTestId('content-plan-progress').innerText()))
  if (SHOTS) {
    await planOpen(page)
    await page.getByTestId('content-plan').screenshot({ path: `${SHOTS}/content-d208-plan.png` })
  }
  await page.getByTestId('content-to-site').click()
  await page.waitForURL(/\/tools\/homepage\/build\?client=cli_site/)
  check('D14 홍보 글 → 이 업체 홈페이지로 바로', /\/tools\/homepage\/build\?client=cli_site/.test(page.url()), page.url())

  /* ---- D-208 고침(게이트 뒤 코드 점검) ---- */
  // 음식점(이번 달 이야기 없음) 주 4회 — 16칸 모두 '만듦'(같은 글로 여겨 칸이 비던 것)
  await page.goto(BASE + '/tools/content/build?client=cli_food', { waitUntil: 'networkidle' })
  await planOpen(page)
  await page.locator('[data-testid="content-plan-per"][data-value="4"]').click()
  await page.getByTestId('content-plan-make-all').click()
  await wait(2500)
  const fStates = await page.getByTestId('content-plan-slot').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))
  check('D15 음식점 주 4회 한 달 치 — 16칸 모두 만듦 · 단추는 끝남', fStates.length === 16 && fStates.every((x) => x === 'made') && (await page.getByTestId('content-plan-make-all').isDisabled()), fStates)
  // 계획 칸을 누르면 그 글(올릴 날이 붙은 글)이 열림 → 보관함 글과 같음
  await page.getByTestId('content-plan-slot').nth(5).click()
  await wait(400)
  check('D16 만든 칸 → 그 글이 열림(보관함 · 판 표시)', (await page.getByTestId('content-result').count()) === 1 && /보관함/.test(await page.getByTestId('content-result').innerText()))
  // 묶음: 1편만 저장 → 고쳐서 새 판 → 탭 넘겼다 돌아와도 새 판
  await mode(page, 'situation')
  await page.locator('[data-testid="content-situation"][data-key="newItem"]').click()
  await page.getByTestId('content-pack').waitFor()
  await page.getByTestId('content-save').click()
  await wait(600)
  await page.getByTestId('content-edit').click()
  await page.getByTestId('content-block-input').first().fill('(광고) 맛나식당 새 소식\n\n새로 나온 것: 들기름 막국수')
  await page.getByTestId('content-save').click()
  await wait(700)
  await page.getByTestId('content-pack-tab').nth(1).click()
  await wait(300)
  await page.getByTestId('content-pack-tab').nth(0).click()
  await wait(300)
  const back = await page.getByTestId('content-result').innerText()
  check('D17 묶음 글을 고쳐 새 판으로 저장 → 탭을 넘겼다 와도 새 판(2판 · 고친 글)', back.includes('들기름 막국수') && /2판/.test(back), back.slice(0, 120))
  // 저장한 글을 고치던 중 '모두 저장' → 고침을 덮지 않고 먼저 저장하라고 알림
  await page.getByTestId('content-edit').click()
  await page.getByTestId('content-block-input').first().fill('(광고) 맛나식당 새 소식\n\n새로 나온 것: 메밀 전병')
  await page.getByTestId('content-pack-save-all').click()
  await wait(500)
  check('D18 고치던 중 [모두 저장] → 고친 글이 그대로 남음(덮지 않음)', (await page.getByTestId('content-block-input').first().inputValue()).includes('메밀 전병'))
  await page.getByTestId('content-edit').click()
  // 띄운 글을 지우면 결과 칸이 비어 지운 글을 되살리지 않음
  const openTitle = (await page.getByTestId('content-result-title').innerText()).trim()
  const row = page.getByTestId('content-archive-item').filter({ hasText: openTitle }).first()
  await row.getByTestId('content-del').click()
  await page.getByRole('dialog').getByRole('button', { name: '지우기' }).click()
  await wait(600)
  check('D19 띄운 글을 지우면 결과 칸이 비워짐', (await page.getByTestId('content-result').count()) === 0 && (await page.getByTestId('content-empty').count()) === 1)
  const smallChips = await page.getByTestId('content-archive-filter').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)).filter((h) => h < 44))
  check('D20 보관함 거르기 칩 44px 이상', smallChips.length === 0, smallChips)
  await ctx.close()
}


/* ================================================================== */
/* D-209 고친 글 지키기 · [대괄호] 한 번에 채우기 · 계획 다음 글               */
/* ================================================================== */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`D209 pageerror ${e.message}`))
  await seed(page)
  await page.goto(BASE + '/tools/content/build?client=cli_site', { waitUntil: 'networkidle' })
  await page.getByTestId('content-studio').waitFor()
  const dialog = () => page.getByRole('dialog')

  // G1 고친 글 → 다른 글 열기 전에 묻기 · [계속 고치기] 면 그대로
  await mode(page, 'direct')
  await page.getByTestId('content-make').click()
  await page.getByTestId('content-result').waitFor()
  await page.getByTestId('content-edit').click()
  await page.getByTestId('content-block-input').nth(1).fill('G1 고친 문장 — 지켜져야 함')
  const kind0 = await page.getByTestId('content-result').getAttribute('data-kind')
  await mode(page, 'pick')
  await page.getByTestId('content-pick').nth(1).click()
  const asked = /저장하지 않은 고침/.test(await dialog().innerText())
  await dialog().getByRole('button', { name: '계속 고치기' }).click()
  await wait(200)
  check('G1 고친 글이 있는데 다른 글(먼저 만들 것) → 묻기 · [계속 고치기] → 고친 글 그대로', asked && (await page.getByTestId('content-block-input').nth(1).inputValue()).includes('G1 고친 문장') && (await page.getByTestId('content-result').getAttribute('data-kind')) === kind0)
  // G2 [고치기 그만] 은 칸만 닫음 → 저장하면 고친 글이 보관함에
  await page.getByTestId('content-edit').click()
  await wait(150)
  const closedText = await resultText(page)
  await page.getByTestId('content-save').click()
  await wait(500)
  check('G2 [고치기 그만] → 고친 글이 화면에 남음 · 저장하면 고친 글이 보관함에(전에는 고치기 전 글이 저장됨)', closedText.includes('G1 고친 문장') && (await page.getByTestId('content-block-input').count()) === 0 && JSON.stringify(await items(page)).includes('G1 고친 문장'))
  // G3 보관함의 같은 글을 다시 눌러도 고치던 것이 날아가지 않음
  await page.getByTestId('content-edit').click()
  await page.getByTestId('content-block-input').nth(1).fill('G3 보관함 글 고치는 중')
  await page.getByTestId('content-archive-open').first().click()
  await wait(300)
  check('G3 띄운 글을 보관함에서 다시 눌러도 → 묻지 않고 고치던 것 그대로', (await dialog().count()) === 0 && (await page.getByTestId('content-block-input').nth(1).inputValue()) === 'G3 보관함 글 고치는 중')
  // [버리고 넘어가기] → 상황 묶음으로
  await mode(page, 'situation')
  await page.locator('[data-testid="content-situation"][data-key="event"]').click()
  await dialog().getByRole('button', { name: '고침 버리고 넘어가기' }).click()
  await page.getByTestId('content-pack').waitFor()

  // G4 [대괄호] 한 번에 채우기 — 묶음 3편 모두
  const fillCount0 = await page.getByTestId('content-checks').innerText()
  await page.getByTestId('content-fill-toggle').click()
  const names = await page.getByTestId('content-fill-input').evaluateAll((els) => els.map((e) => e.getAttribute('data-name')))
  for (let i = 0; i < names.length; i++) await page.getByTestId('content-fill-input').nth(i).fill(`채움${i}`)
  await page.getByTestId('content-fill-apply').click()
  await wait(300)
  const tabTexts = []
  for (let i = 0; i < 3; i++) {
    await page.getByTestId('content-pack-tab').nth(i).click()
    await wait(250)
    tabTexts.push(await resultText(page))
  }
  const holesLeft = tabTexts.map((t) => (t.match(/\[[^\]\n]{1,80}\]/g) ?? []).filter((m) => !/^\[\d+:\d{2} - \d+:\d{2}\]$|^\[\d+장\]$/.test(m)))
  check('G4 빈 칸 한 번에 채우기 → 묶음 3편의 [대괄호] 가 모두 바뀜(남은 빈 칸 0)', /\[대괄호\]/.test(fillCount0) && names.length >= 3 && holesLeft.every((h) => h.length === 0) && tabTexts.every((t) => t.includes('채움0') || t.includes('채움1')), { names, holesLeft })
  check('G4 채운 뒤 점검에 "[대괄호] 채우기" 없음', !/\[대괄호\] \d+곳/.test(await page.getByTestId('content-checks').innerText().catch(() => '')))
  // 저장 전에 다른 상황을 누르면 묻기(채운 것이 날아가지 않게)
  await mode(page, 'situation')
  await page.locator('[data-testid="content-situation"][data-key="holiday"]').click()
  const asked2 = (await dialog().count()) === 1
  await dialog().getByRole('button', { name: '계속 고치기' }).click()
  const n0 = (await items(page)).length
  await page.getByTestId('content-pack-save-all').click()
  await wait(900)
  const its = await items(page)
  check('G5 채운 묶음 저장 전 다른 상황 → 묻기 · [모두 저장] → 3편 모두 채운 글로 보관함에', asked2 && its.length - n0 === 3 && its.filter((r) => r.data?.input?.situation === 'event').length === 3 && its.filter((r) => r.data?.input?.situation === 'event').every((r) => /채움\d/.test(JSON.stringify(r.data?.blocks))), { asked2, added: its.length - n0 })

  // G6 짧은 영상 — 빈 칸을 다 채우면 "[대괄호] 채우기" 경고가 사라짐(칸 이름 [0:00 - 0:03] 을 빈 칸으로 세던 것)
  await mode(page, 'direct')
  await page.locator('[data-testid="content-kind"][data-kind="shorts"]').click()
  await mode(page, 'direct')
  await page.getByTestId('content-make').click()
  await page.getByTestId('content-result').waitFor()
  await wait(200)
  const shortHas = (await page.getByTestId('content-fill').count()) === 1
  if (shortHas) {
    await page.getByTestId('content-fill-toggle').click()
    const n = await page.getByTestId('content-fill-input').count()
    for (let i = 0; i < n; i++) await page.getByTestId('content-fill-input').nth(i).fill(`값${i}`)
    await page.getByTestId('content-fill-apply').click()
    await wait(300)
  }
  const shortChecks = await page.getByTestId('content-checks').innerText().catch(() => '')
  check('G6 짧은 영상 — 빈 칸 다 채우면 "[대괄호] n곳" 빨간 경고 없음 · 채우기 칸도 사라짐', !/\[대괄호\] \d+곳/.test(shortChecks) && (await page.getByTestId('content-fill').count()) === 0, shortChecks.slice(0, 160))
  if (SHOTS) await page.getByTestId('content-result').screenshot({ path: `${SHOTS}/content-d209-short-filled.png` })
  await page.getByTestId('content-save').click()
  await wait(400)

  // G7 상황 묶음 '없어요 — 이 줄 지우기'
  await mode(page, 'situation')
  await page.locator('[data-testid="content-situation"][data-key="open"]').click()
  await page.getByTestId('content-pack').waitFor()
  await page.getByTestId('content-fill-toggle').click()
  if (SHOTS) await page.getByTestId('content-fill').screenshot({ path: `${SHOTS}/content-d209-fill-pc.png` })
  const drops = await page.getByTestId('content-fill-drop').count()
  await page.getByTestId('content-fill-drop').first().check()
  await page.getByTestId('content-fill-apply').click()
  await wait(300)
  const afterDrop = await resultText(page)
  check('G7 "없으면 지워 주세요" 칸 — [없어요] 체크하면 그 줄이 지워짐', drops >= 1 && !/없으면 이 (줄|칸|장)/.test(afterDrop.split('\n').filter((l) => /혜택/.test(l)).join('\n')), afterDrop.slice(0, 200))
  await page.getByTestId('content-pack-save-all').click()
  await wait(800)

  // G8 한 달 계획 — 접어 둬도 '다음에 올릴 글' 한 줄 → 누르면 그 글
  await planOpen(page)
  await page.getByTestId('content-plan-make-all').click()
  await wait(1500)
  await page.getByTestId('content-plan-toggle').click()
  await wait(200)
  const nextTxt = await page.getByTestId('content-plan-next').innerText()
  await page.getByTestId('content-plan-next-open').click()
  await wait(400)
  check('G8 계획을 접어도 "다음에 올릴 글" 이 보임 → 누르면 그 글(보관함)', /다음에 올릴 글|오늘 올릴 글/.test(nextTxt) && /보관함/.test(await page.getByTestId('content-result').innerText()), nextTxt)
  if (SHOTS) await page.getByTestId('content-plan').screenshot({ path: `${SHOTS}/content-d209-plan-next.png` })
  await ctx.close()
}

/* ================================================================== */
/* D-221 한 달 계획 정보 · 다른 안 올릴 날 · 보관함 제목 · 메뉴로 나가면 묻기           */
/* ================================================================== */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`D221 pageerror ${e.message}`))
  await seed(page)
  await page.goto(BASE + '/tools/content/build?client=cli_site', { waitUntil: 'networkidle' })
  await page.getByTestId('content-studio').waitFor()
  // 주 4회 계획에서 둘째 칸(화요일) 하나만 — [다른 안] 으로 바꿔 저장
  await planOpen(page)
  await page.locator('[data-testid="content-plan-per"][data-value="4"]').click()
  await page.getByTestId('content-plan-slot').nth(1).click()
  await page.getByTestId('content-result').waitFor()
  await page.getByTestId('content-again').click()
  await wait(300)
  await page.getByTestId('content-save').click()
  await wait(700)
  const planned = (await items(page)).map((r) => r.data?.input ?? {}).filter((i) => i.planDate)
  check('D221 다른 안으로 바꿔 저장해도 올릴 날 · 계획(주 4회 · 시작 월요일)이 글에 남음', planned.length === 1 && planned[0].planPer === 4 && /^\d{4}-\d{2}-\d{2}$/.test(planned[0].planStart ?? ''), planned)
  await page.goto(BASE + '/tools/content/build?client=cli_site', { waitUntil: 'networkidle' })
  await mode(page, 'plan')
  await page.getByTestId('content-plan').waitFor()
  await planOpen(page)
  const planTxt = await page.getByTestId('content-plan').innerText()
  const st = await page.getByTestId('content-plan-slot').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))
  check('D221 다시 열어도 주 4회 계획 그대로 · 16칸 · 둘째 칸 만듦(화요일 글 하나만 저장해도 주 2회로 바뀌지 않음)', /주 4회 계획/.test(planTxt) && st.length === 16 && st[1] === 'made' && st.filter((x) => x === 'made').length === 1, { st, txt: planTxt.slice(0, 80) })
  if (SHOTS) await page.getByTestId('content-plan').screenshot({ path: `${SHOTS}/d221-plan4.png` })

  // 보관함 제목 — 제목 칸을 고쳐 저장하면 목록 제목도
  await mode(page, 'direct')
  await page.locator('[data-testid="content-kind"][data-kind="blog"]').click()
  await mode(page, 'direct')
  await page.getByTestId('content-make').click()
  await page.getByTestId('content-result').waitFor()
  await page.getByTestId('content-edit').click()
  await page.getByTestId('content-block-input').first().fill('동탄 시제품, 처음 맡기기 전에 볼 3가지')
  // 저장 전에 메뉴로 나가려 하면 묻는다
  await page.getByRole('link', { name: '일정', exact: true }).first().click()
  const ask = page.getByRole('dialog').filter({ hasText: '이 화면을 나가면' })
  await ask.waitFor({ timeout: 5000 }).catch(() => {})
  const asked = (await ask.count()) === 1 && /\/tools\/content\/build/.test(page.url())
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/d221-content-leave.png`, fullPage: false })
  if (asked) await ask.getByRole('button', { name: '계속 고치기' }).click()
  await wait(200)
  check('D221 고친 글을 저장하지 않고 메뉴(일정)를 누르면 묻는 창 · [계속 고치기] → 그 자리 · 고친 글 그대로', asked && /\/tools\/content\/build/.test(page.url()) && (await page.getByTestId('content-block-input').first().inputValue()) === '동탄 시제품, 처음 맡기기 전에 볼 3가지', page.url())
  await page.getByTestId('content-save').click()
  await wait(700)
  const arch1 = await page.getByTestId('content-archive-item').allInnerTexts()
  check('D221 저장 → 보관함 줄 · 결과 제목이 고친 제목', arch1.some((t) => t.includes('동탄 시제품, 처음 맡기기 전에 볼 3가지')) && (await page.getByTestId('content-result-title').innerText()) === '동탄 시제품, 처음 맡기기 전에 볼 3가지', arch1.slice(0, 3))
  await page.getByTestId('content-edit').click()
  await page.getByTestId('content-block-input').first().fill('동탄 시제품 맡기기 전 체크 3가지')
  await page.getByTestId('content-save').click()
  await wait(700)
  const arch2 = await page.getByTestId('content-archive-item').allInnerTexts()
  check('D221 고친 판으로 저장 → 보관함 제목도 새 제목(옛 제목 줄 없음)', arch2.some((t) => t.includes('동탄 시제품 맡기기 전 체크 3가지')) && !arch2.some((t) => t.includes('처음 맡기기 전에 볼 3가지')), arch2.slice(0, 3))
  // 저장한 뒤에는 메뉴로 바로 나감(묻지 않음)
  await page.getByRole('link', { name: '일정', exact: true }).first().click()
  await wait(600)
  check('D221 저장한 뒤 메뉴 → 묻지 않고 그 화면으로', !/\/tools\/content/.test(page.url()) && (await page.getByRole('dialog').count()) === 0, page.url())
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
  await mode(page, 'situation')
  const visSit = await page.locator('[data-testid="content-situation"]:visible').count()
  await mode(page, 'situation')
  await page.getByTestId('content-situation-more').click()
  await mode(page, 'situation')
  const visSit2 = await page.locator('[data-testid="content-situation"]:visible').count()
  await mode(page, 'situation')
  await page.locator('[data-testid="content-situation"][data-key="holiday"]').click()
  await page.getByTestId('content-pack').waitFor()
  await wait(400)
  const tabH = await page.getByTestId('content-pack-tab').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
  check(`M${width} D-208 상황 6개 → 더 보기 12개 · 묶음 탭 44px · 가로 넘침 0`, visSit === 6 && visSit2 === 12 && tabH.every((h) => h >= 44) && (await over()) <= 0, { visSit, visSit2, tabH })
  if (SHOTS && width === 390) await page.getByTestId('content-pack').screenshot({ path: `${SHOTS}/content-m390-pack.png` })
  // D-209 빈 칸 한 번에 채우기 — 휴대폰에서 넘침 0 · 입력 칸 44px
  await page.getByTestId('content-fill-toggle').click()
  const fillH = await page.locator('[data-testid="content-fill"] input, [data-testid="content-fill"] button').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)).filter((h) => h > 0 && h < 40))
  check(`M${width} D-209 빈 칸 채우기 펼침 — 가로 넘침 0 · 입력/단추 40px 이상`, (await over()) <= 0 && fillH.length === 0, { over: await over(), fillH })
  if (SHOTS && width === 390) await page.getByTestId('content-fill').screenshot({ path: `${SHOTS}/content-m390-fill.png` })
  await page.getByTestId('content-fill-toggle').click()
  await mode(page, 'pick')
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
  await planOpen(page)
  await page.locator('[data-testid="content-plan-per"][data-value="4"]').click()
  await wait(200)
  // D-227 한 달 계획과 직접 고르기는 따로 펼친다 — 계획 칸 수 · 넘침은 계획을 펼친 채로 잰다
  const planSlots = await page.getByTestId('content-plan-slot').count()
  const planOver = await over()
  if (SHOTS && width === 390) {
    await page.getByTestId('content-plan').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOTS}/content-m390-plan.png`, fullPage: false })
  }
  await mode(page, 'direct')
  await page.locator('[data-testid="content-kind"][data-kind="cards"]').click()
  await wait(200)
  check(`M${width} 한 달 계획 · 광고 유형 펼쳐도 가로 넘침 0`, planOver <= 0 && (await over()) <= 0 && planSlots === 16, { planOver, over: await over(), planSlots })
  if (SHOTS && width === 390) {
    await page.getByTestId('content-adtype').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOTS}/content-m390-adtype.png`, fullPage: false })
  }
  await mode(page, 'direct')
  await page.locator('[data-testid="content-kind"][data-kind="keywords"]').click()
  await mode(page, 'direct')
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

// D-226 — 색: 대표 "색이 안 들어가 눈에 하나도 안 들어온다 · 최소한 콘텐츠 레이더처럼". 테마(기본 오닉스 골드)와 상관없이 도구 색 · 글 종류마다 색
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page2 = await ctx.newPage()
  page2.on('pageerror', (e) => errors.push(`D226 pageerror ${e.message}`))
  // 바탕 그림(그라데이션) · 바탕색에서 가장 진한 채도 — oklch 의 C 값, rgb 는 HSL 채도를 0~0.4 로 맞춘다
  const chroma = (sel) =>
    page2.locator(sel).first().evaluate((el) => {
      const cs = getComputedStyle(el)
      const s = `${cs.backgroundImage} ${cs.backgroundColor}`
      let best = 0
      for (const m of s.matchAll(/oklch\(\s*([\d.]+%?)\s+([\d.]+)/g)) best = Math.max(best, Number(m[2]))
      for (const m of s.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)) {
        const [r, g, b] = [m[1], m[2], m[3]].map((x) => Number(x) / 255)
        const mx = Math.max(r, g, b)
        const mn = Math.min(r, g, b)
        best = Math.max(best, mx === 0 ? 0 : ((mx - mn) / mx) * 0.4)
      }
      return best
    })
  const bgs = (sel) => page2.locator(sel).evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor))
  await seed(page2)
  await page2.goto(BASE + '/tools/content/build?client=cli_site', { waitUntil: 'networkidle' })
  await page2.getByTestId('content-studio').waitFor()
  const theme = await page2.evaluate(() => document.documentElement.dataset.theme ?? '')
  const heroC = await chroma('[data-testid="content-profile"] > div')
  check(`K1 홍보 정보 머리 띠 — 테마(${theme || '기본'})와 상관없이 보라 그라데이션(채도 ${heroC.toFixed(2)})`, heroC > 0.12, heroC)
  check(
    'K1 머리 띠 숫자 — 보관함 · 올림 · 채운 칸',
    /0편/.test(await page2.getByTestId('content-stat-saved').innerText()) && /\d+\/7/.test(await page2.getByTestId('content-stat-filled').innerText()),
  )
  const pickBg = await bgs('[data-testid="content-pick"] > span:first-child > span[aria-hidden="true"]')
  check('K2 먼저 만들 것 3개 — 글 종류마다 다른 색 아이콘', pickBg.length === 3 && new Set(pickBg).size === 3, pickBg)
  await mode(page2, 'situation')
  const sitN = await page2.getByTestId('content-situation').count()
  await mode(page2, 'situation')
  const sitIco = await page2.locator('[data-testid="content-situation"] svg').count()
  await mode(page2, 'situation')
  const tagN = await page2.locator('[data-testid="content-situation"] .rounded-full.t-meta').count()
  check('K3 상황 12개 모두 색 아이콘 · 묶음(카톡 · 블로그 …) 색 꼬리표', sitN === 12 && sitIco >= 12 && tagN >= 24, { sitN, sitIco, tagN })
  await mode(page2, 'direct')
  const kindBg = await bgs('[data-testid="content-kind"] > span[aria-hidden="true"]')
  check('K4 직접 고르기 형식 7개 — 형식마다 색 아이콘(7가지 색)', kindBg.length === 7 && new Set(kindBg).size === 7, kindBg)
  check('K4 [만들기] 단추 — 테마 색이 아니라 보라 그라데이션', (await chroma('[data-testid="content-make"]')) > 0.12)
  await mode(page2, 'direct')
  await page2.locator('[data-testid="content-kind"][data-kind="cards"]').click()
  await mode(page2, 'direct')
  await page2.getByTestId('content-make').click()
  await page2.getByTestId('content-result-band').waitFor()
  check('K5 결과 위 글 종류 색 띠(카드뉴스)', (await page2.getByTestId('content-result-band').innerText()).includes('카드뉴스') && (await chroma('[data-testid="content-result-band"]')) > 0.01)
  await page2.goto(BASE + '/marketing', { waitUntil: 'networkidle' })
  const bandC = await Promise.all(['marketing-youtube', 'marketing-content', 'marketing-homepage'].map((id) => chroma(`[data-testid="${id}"] > span:first-child`)))
  const bandImg = await page2.locator('[data-testid="marketing-live"] a > span:first-child').evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundImage))
  check('K6 마케팅 첫 화면 바로 쓰기 3 — 도구마다 다른 색 띠(빨강 · 보라 · 초록)', bandC.every((c) => c > 0.09) && new Set(bandImg).size === 3, bandC)
  await ctx.close()

  for (const width of [390, 360]) {
    const c2 = await browser.newContext({ viewport: { width, height: 800 } })
    const p = await c2.newPage()
    p.on('pageerror', (e) => errors.push(`D226 m${width} ${e.message}`))
    await seed(p)
    await p.goto(BASE + '/tools/content/build?client=cli_site', { waitUntil: 'networkidle' })
    await p.getByTestId('content-studio').waitFor()
    await mode(p, 'situation')
    const labelW = await p.locator('[data-testid="content-situation"] .t-body').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0).map((e) => Math.round(e.getBoundingClientRect().width)))
    const heroBtn = await p.locator('[data-testid="content-to-site"], [data-testid="content-profile-edit"]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(`K7 ${width} 상황 이름 칸 짜부라짐 0(폭 ${Math.min(...labelW)}px ≥ 100) · 머리 띠 단추 44px · 가로 넘침 0`, labelW.length >= 6 && Math.min(...labelW) >= 100 && heroBtn.every((h) => h >= 44) && ov <= 0, { labelW, heroBtn, ov })
    await c2.close()
  }
  check('K8 D-226 화면 오류 0', !errors.some((e) => e.startsWith('D226')), errors.filter((e) => e.startsWith('D226')))
}

// D-227 — 대표 "한 페이지에 너무 많으면 역효과 · 길을 잃지 않게 · 펼치기/접어두기 · 토스처럼 다음 단계". 처음 쓰는 사람 모양(시드의 '모두 펼치기' 없음)
for (const vp of [{ width: 1440, height: 900, tag: 'PC' }, { width: 390, height: 844, tag: '390', mobile: true }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, ...(vp.mobile ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}) })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push(`D227 ${e.message}`))
  await seed(p)
  await p.evaluate(() => localStorage.removeItem('axmvp.fold.all'))
  await p.goto(BASE + '/tools/content/build?client=cli_site', { waitUntil: 'networkidle' })
  await p.getByTestId('content-studio').waitFor()
  const T = vp.tag
  const over = () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  const steps = p.getByTestId('content-steps')
  const state = () => steps.locator('li').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')).join(','))
  const modes = await p.getByTestId('content-mode').getByTestId('mk-pick').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-key')}:${e.getAttribute('aria-selected')}`))
  const shown = async () => ({ picks: await p.getByTestId('content-picks').count(), sit: await p.getByTestId('content-situations').count(), maker: await p.getByTestId('content-maker').count(), plan: await p.getByTestId('content-plan').count() })
  const s0 = await shown()
  check(`D227-C1 ${T} 길잡이 — 단계 3개(고르기 → 다듬기 → 저장 · 올리기) · 지금 1단계 · '무엇을 만들까요' 4길 중 추천만 펼침`, (await state()) === 'now,todo,todo' && /지금 할 일/.test(await p.getByTestId('content-next').innerText()) && modes.join() === 'pick:true,situation:false,direct:false,plan:false' && s0.picks === 1 && s0.sit + s0.maker + s0.plan === 0, { modes, s0 })
  const rows0 = await p.getByTestId('content-profile-row').count()
  const tgl = p.getByTestId('content-profile-toggle')
  const tglTxt = await tgl.innerText()
  await tgl.click()
  const rows1 = await p.getByTestId('content-profile-row').count()
  await tgl.click()
  check(`D227-C2 ${T} 홍보 정보 7칸은 접혀 있다(머리 띠 숫자 · '이 칸만 채우면' 은 그대로) → 누르면 7칸`, rows0 === 0 && rows1 === 7 && /7칸 보기/.test(tglTxt) && (await p.getByTestId('content-profile-gaps').count()) === 1 && (await p.getByTestId('content-stat-filled').count()) === 1, { rows0, rows1, tglTxt })
  check(`D227-C3 ${T} 보관함은 접혀 있고 제목 줄에 편수`, (await p.getByTestId('content-archive').getAttribute('data-open')) === '0' && /0편/.test(await p.getByTestId('content-archive-count').innerText()))
  await mode(p, 'situation')
  const s1 = await shown()
  await mode(p, 'direct')
  const s2 = await shown()
  await mode(p, 'plan')
  const s3 = await shown()
  const planOpenNow = await p.getByTestId('content-plan-toggle').getAttribute('aria-expanded')
  check(`D227-C4 ${T} 길을 바꾸면 그 판만(상황 → 직접 → 한 달 계획) · 한 달 계획은 고르자마자 펼침`, s1.sit === 1 && s1.picks + s1.maker + s1.plan === 0 && s2.maker === 1 && s2.picks + s2.sit + s2.plan === 0 && s3.plan === 1 && s3.picks + s3.sit + s3.maker === 0 && planOpenNow === 'true', { s1, s2, s3, planOpenNow })
  await mode(p, 'pick')
  await p.getByTestId('content-pick').nth(1).click()
  await p.getByTestId('content-result').waitFor()
  const st1 = await state()
  const next1 = await p.getByTestId('content-next').innerText()
  await p.getByTestId('content-save').click()
  await wait(600)
  const st2 = await state()
  const arch = await p.getByTestId('content-archive').getAttribute('data-open')
  await p.getByTestId('content-posted').click()
  await wait(500)
  const st3 = await state()
  check(`D227-C5 ${T} 글이 나오면 2단계(다듬기) → 저장하면 3단계 · 보관함이 저절로 펼쳐짐 → 올렸어요 표시하면 세 단계 모두 끝`, st1 === 'done,now,todo' && /보관함에 저장/.test(next1) && st2 === 'done,done,now' && arch === '1' && st3 === 'done,done,done', { st1, st2, st3, arch })
  await p.getByTestId('content-archive-toggle').click()
  check(`D227-C6 ${T} 띄운 글이 보관함 글이어도 [보관함] 을 누르면 접힘`, (await p.getByTestId('content-archive').getAttribute('data-open')) === '0')
  const pickH = await p.getByTestId('content-mode').getByTestId('mk-pick').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
  const labelW = await p.locator('[data-testid="content-mode"] [data-testid="mk-pick"] .t-body').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)))
  check(`D227-C7 ${T} 길 칸 44px 이상 · 이름 칸 짜부라짐 0(폭 ≥ 100) · 가로 넘침 0 · 오류 0`, pickH.every((h) => h >= 44) && labelW.every((w) => w >= 100) && (await over()) <= 0 && !errors.some((e) => e.startsWith('D227')), { pickH, labelW, over: await over(), errs: errors.filter((e) => e.startsWith('D227')) })
  await ctx.close()
}

// D-228 — 이상한AI 3차 관찰: 재료를 준 만큼만 쓰고, 바깥 AI 도구에는 사실 목록 · 넣지 말 것을 붙여 보내고, 받은 글은 사실과 대조한다
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push(`D228 ${e.message}`))
  await seed(p)
  await p.goto(BASE + '/tools/content/build?client=cli_site', { waitUntil: 'networkidle' })
  await p.getByTestId('content-studio').waitFor()
  // 안내에는 위 3개만 보이고 제목 줄에 모두 몇 개인지 — 재료 2칸(후기 · 한마디)을 채우면 2개 줄어든다
  const gapN = async () => Number(/· (\d+)개/.exec(await p.getByTestId('content-profile-gaps').innerText())?.[1] ?? -1)
  const gaps0 = await gapN()
  await p.getByTestId('content-profile-edit').click()
  await p.getByTestId('content-ov-material').scrollIntoViewIfNeeded()
  await p.getByTestId('content-ov-reviews').fill('네이버 후기 1,240개 · 평점 4.8')
  await p.getByTestId('content-ov-voice').fill('“납기를 하루도 안 넘겨요”')
  await p.getByTestId('content-ov-offer').fill('첫 견적 고객 시제품 1개 무상')
  await p.getByTestId('content-ov-offerUntil').fill('2099-12-31')
  await p.getByTestId('content-ov-price').fill('시제품 1개 5만 원부터')
  await p.getByTestId('content-ov-speaker').fill('대표 김한솔')
  await wait(900) // 창이 0.7초에 걸쳐 나타난다 — 다 뜬 뒤에 찍는다
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/content-pc-d228-material.png`, fullPage: false })
  await p.getByTestId('content-ov-save').click()
  await wait(500)
  const mat = await p.getByTestId('content-profile-material').innerText()
  const gaps1 = await gapN()
  check('D228-1 글 재료 칸 → 홍보 정보에 "적어 둔 것만" 줄(후기 · 한마디 따옴표 하나 · 혜택 끝나는 날 · 가격 · 말하는 사람) · 채운 3칸(후기 · 한마디 · 말하는 사람)은 안내에서 빠짐', mat.includes('네이버 후기 1,240개') && mat.includes('"납기를 하루도 안 넘겨요"') && mat.includes('첫 견적 고객 시제품 1개 무상(12월 31일까지)') && mat.includes('시제품 1개 5만 원부터') && mat.includes('대표 김한솔') && gaps0 >= 6 && gaps1 === gaps0 - 3, { mat, gaps0, gaps1 })

  await mode(p, 'direct')
  await p.locator('[data-testid="content-kind"][data-kind="cards"]').click()
  await p.locator('[data-testid="content-adtype-btn"][data-value="proof"]').click()
  await p.getByTestId('content-maker').getByRole('button', { name: '7장', exact: true }).click()
  await p.getByTestId('content-make').click()
  await wait(300)
  const cards = await resultText(p)
  check('D228-2 카드뉴스 기록 증명형 — 첫 장 후기 수 · 고객 한마디 장 · 마지막 장 혜택 + 끝나는 날', cards.includes('큰 글자: 네이버 후기 1,240개 · 평점 4.8') && cards.includes('"납기를 하루도 안 넘겨요"') && cards.includes('첫 견적 고객 시제품 1개 무상(12월 31일까지)'), cards.slice(0, 300))
  await mode(p, 'direct')
  await p.locator('[data-testid="content-kind"][data-kind="kakao"]').click()
  await p.locator('[data-testid="content-purpose"][data-purpose="event"]').click()
  await p.getByTestId('content-make').click()
  await wait(300)
  const ev = await resultText(p)
  check('D228-3 카톡 혜택 — 적어 둔 혜택 · 끝나는 날 그대로 · 시작일만 빈칸 · 가격 조건', ev.includes('첫 견적 고객 시제품 1개 무상') && ev.includes('[시작일] ~ 12월 31일') && ev.includes('가격 · 조건: 시제품 1개 5만 원부터'), ev.slice(0, 300))
  await p.getByTestId('content-edit').click()
  const inp = p.getByTestId('content-block-input').first()
  await inp.fill(`${await inp.inputValue()} 오늘만 30% 할인, 식품연구소에서 권장한 방법이에요.`)
  await wait(200)
  const chk = await p.getByTestId('content-checks').innerText()
  check('D228-4 고친 글도 사실 대조 — 홍보 정보에 없는 할인 · 오늘만 · 지어낸 출처를 알림', /30% 할인/.test(chk) && /오늘만/.test(chk) && /출처/.test(chk), chk.slice(0, 400))
  await p.getByTestId('content-edit').click()

  // 다른 AI 도구에 맡기기
  await p.getByTestId('content-ai-req').click()
  await p.getByTestId('content-ai-sheet').waitFor()
  await wait(900)
  const req = await p.getByTestId('content-ai-req-text').innerText()
  check('D228-5 요청문 — 업체 · 독자 · 알리는 것 · 화자(대표 김한솔) · 사실 목록(후기 · 혜택) · 넣지 마세요(정책자금 · 컨설팅) · 담당자 휴대폰 없음', /^업체: 한솔정밀\(주\)/.test(req) && req.includes('독자(보는 사람):') && req.includes('화자: 한솔정밀(주) 대표 김한솔') && req.includes('- 후기: 네이버 후기 1,240개 · 평점 4.8') && req.includes('- 이번 달 혜택: 첫 견적 고객 시제품 1개 무상(12월 31일까지)') && req.includes('정책자금') && req.includes('넣지 마세요') && !req.includes('010-9999-8888'), req)
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/content-pc-d228-request.png`, fullPage: false })
  await p.getByTestId('content-ai-req-copy').click()
  await wait(200)
  const clip = await p.evaluate(() => navigator.clipboard.readText())
  check('D228-6 [요청문 복사] → 클립보드에 요청문 그대로 · 쓰는 법 3줄', clip.trim() === req.trim() && (await p.getByTestId('content-ai-tips').locator('li').count()) === 3, clip.slice(0, 80))
  await p.getByTestId('content-ai-next').click()
  check('D228-7 [글을 받았으면 · 점검하기] → 2단계(받은 글 점검)', (await p.getByTestId('content-ai-sheet').getAttribute('data-stage')) === 'check' && (await p.getByTestId('content-ai-steps').getAttribute('data-current')) === 'check')
  const bad = '[주제 내용]\n10년 차 전문가가 직접 만든 부품이에요. 1,240명이 재구매! 무료 배송 · 선착순 100명 사은품 증정. 식품연구소에서 권장한 방법이에요.'
  await p.getByTestId('content-ai-check-input').fill(bad)
  await p.getByTestId('content-ai-check-run').click()
  const keys = await p.getByTestId('content-ai-check-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
  check('D228-8 받은 글 점검 — 대괄호 · 무료 배송 · 선착순 · 증정 · 지어낸 출처 · 업력 모순(10년 ≠ 12년) · 후기 수가 재구매 고객 수로', ['holes', 'policy-무료 배송', 'policy-선착순', 'policy-증정', 'source', 'years', 'reviews-meaning'].every((k) => keys.includes(k)) && Number(await p.getByTestId('content-ai-check-result').getAttribute('data-warn')) >= 7, keys)
  await wait(400)
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/content-pc-d228-check.png`, fullPage: false })
  // 창을 닫았다 열어도 붙여 넣은 글이 남는다
  await p.getByTestId('sheet-backdrop').getByRole('button', { name: '닫기', exact: true }).last().click()
  await p.getByTestId('content-ai-req').click()
  const kept = await p.getByTestId('content-ai-check-input').inputValue()
  check('D228-9 창을 닫았다 열어도 붙여 넣은 글 그대로 · 바로 점검 단계로', kept === bad && (await p.getByTestId('content-ai-sheet').getAttribute('data-stage')) === 'check')
  const good = '한솔정밀(주) 대표 김한솔입니다.\n2014년부터 화성에서 정밀 금속부품을 만들어 왔어요. 네이버 후기 1,240개 · 평점 4.8을 받았어요.\n이번 달은 첫 견적 고객 시제품 1개 무상이에요(12월 31일까지). 문의 031-123-4567'
  await p.getByTestId('content-ai-check-input').fill(good)
  await p.getByTestId('content-ai-check-run').click()
  check('D228-10 사실만 쓴 글 → 걸리는 곳 0', (await p.getByTestId('content-ai-check-result').getAttribute('data-warn')) === '0', await p.getByTestId('content-ai-check-result').innerText())
  const before = (await items(p)).length
  await p.getByTestId('content-ai-save').click()
  await p.getByTestId('content-ai-sheet').waitFor({ state: 'detached' })
  await wait(400)
  const after = await items(p)
  check('D228-11 [보관함에 저장] → 보관함 1편 늘고(블로그 · 첫 줄 제목) 결과 칸에 열림', after.length === before + 1 && after.some((x) => x.data.kind === 'blog' && x.data.title === '한솔정밀(주) 대표 김한솔입니다.') && (await p.getByTestId('content-result-title').innerText()) === '한솔정밀(주) 대표 김한솔입니다.', after.map((x) => x.data?.title))

  // 검색량 등급 · 월 100 이상만
  await mode(p, 'direct')
  await p.locator('[data-testid="content-kind"][data-kind="keywords"]').click()
  await p.getByTestId('content-make').click()
  await wait(300)
  await p.getByTestId('content-volume-input').fill('연관키워드\t월간검색수(PC)\t월간검색수(모바일)\n화성 금형\t1,230\t4,560\n화성 정밀가공\t< 10\t< 10\n동탄 시제품 제작\t40\t60\n화성 금형 수리\t20\t30')
  await p.getByTestId('content-volume-run').click()
  const tiers = await p.getByTestId('content-volume-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-tier')))
  const tierTxt = await p.getByTestId('content-volume-tier').allInnerTexts()
  const tip = await p.getByTestId('content-volume-tip').innerText()
  check('D228-12 검색량 등급 — 많이 찾음 · 보통(딱 100) · 적게 찾음 · 거의 안 찾음 + 100 아래 안내(2개)', tiers.join() === 'high,mid,low,tiny' && tierTxt.join() === '많이 찾음,보통,적게 찾음,거의 안 찾음' && tip.includes('2개'), { tiers, tierTxt, tip })
  await p.getByTestId('content-volume-min100').click()
  const after100 = await p.getByTestId('content-volume-row').count()
  check('D228-13 [월 100 이상만] → 2줄 · "4개 중 2개" · 다시 누르면 4줄', after100 === 2 && /4개 중 2개/.test(await p.getByTestId('content-volume-count').innerText()) && (await p.getByTestId('content-volume-min100').getAttribute('aria-pressed')) === 'true', after100)
  if (SHOTS) {
    await p.getByTestId('content-volume').scrollIntoViewIfNeeded()
    await wait(400)
    await p.screenshot({ path: `${SHOTS}/content-pc-d228-volume.png`, fullPage: false })
  }
  await p.getByTestId('content-volume-min100').click()
  const back = await p.getByTestId('content-volume-row').count()

  // 기한 지난 혜택
  await p.getByTestId('content-profile-edit').click()
  await p.getByTestId('content-ov-offerUntil').fill('2020-01-31')
  await p.getByTestId('content-ov-save').click()
  await wait(500)
  const gaps2 = await p.getByTestId('content-profile-gap').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
  const gapTxt = await p.getByTestId('content-profile-gaps').innerText()
  await mode(p, 'direct')
  await p.locator('[data-testid="content-kind"][data-kind="kakao"]').click()
  await p.locator('[data-testid="content-purpose"][data-purpose="event"]').click()
  await p.getByTestId('content-make').click()
  await wait(300)
  const ev2 = await resultText(p)
  check('D228-14 혜택 끝나는 날이 지나면 글에서 빠지고(카톡은 [혜택 내용] · [끝나는 날] 빈칸) "기한이 지났" 안내가 맨 앞', back === 4 && gaps2[0] === 'offer' && /기한이 지났/.test(gapTxt) && !ev2.includes('시제품 1개 무상') && ev2.includes('[혜택 내용') && ev2.includes('[끝나는 날]'), { gaps2, ev2: ev2.slice(0, 200) })
  await ctx.close()

  for (const vp of [390, 360]) {
    const c2 = await browser.newContext({ viewport: { width: vp, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    const m = await c2.newPage()
    m.on('pageerror', (e) => errors.push(`D228 m${vp} ${e.message}`))
    await seed(m)
    await m.goto(BASE + '/tools/content/build?client=cli_site', { waitUntil: 'networkidle' })
    await m.getByTestId('content-studio').waitFor()
    const over = () => m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    const heroH = await m.locator('[data-testid="content-to-site"], [data-testid="content-profile-edit"], [data-testid="content-ai-req"]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
    await m.getByTestId('content-profile-edit').click()
    await m.getByTestId('content-ov-material').scrollIntoViewIfNeeded()
    await wait(900)
    const sheetOver1 = await over()
    const dateW = await m.getByTestId('content-ov-offerUntil').evaluate((e) => Math.round(e.getBoundingClientRect().width))
    if (SHOTS && vp === 390) await m.screenshot({ path: `${SHOTS}/content-m390-d228-material.png`, fullPage: false })
    await m.getByTestId('sheet-backdrop').getByRole('button', { name: '닫기', exact: true }).last().click()
    await m.getByTestId('content-ai-req').click()
    await m.getByTestId('content-ai-sheet').waitFor()
    await wait(500) // 창이 뜨는 동안(살짝 커지는 움직임) 재면 1px 작게 나온다
    const preOver = await m.getByTestId('content-ai-req-text').evaluate((e) => e.scrollWidth - e.clientWidth)
    const btnH = await m.locator('[data-testid="content-ai-sheet"] button:visible').evaluateAll((els) => els.map((e) => ({ t: (e.textContent || '').trim().slice(0, 16), h: Math.round(e.getBoundingClientRect().height) })).filter((x) => x.h > 0 && x.h < 44))
    if (SHOTS && vp === 390) {
      await wait(400)
      await m.screenshot({ path: `${SHOTS}/content-m390-d228-request.png`, fullPage: false })
    }
    await m.getByTestId('content-ai-next').click()
    await m.getByTestId('content-ai-check-input').fill('아주아주긴띄어쓰기없는문장이들어와도옆으로넘치지않아야해요오늘만무료배송선착순증정식품연구소에서권장한방법이에요'.repeat(3))
    await m.getByTestId('content-ai-check-run').click()
    await wait(600)
    const resTop = await m.getByTestId('content-ai-check-result').evaluate((e) => Math.round(e.getBoundingClientRect().top))
    const sheetOver2 = await over()
    const kindH = await m.getByTestId('content-ai-kind-btn').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
    if (SHOTS && vp === 390) await m.screenshot({ path: `${SHOTS}/content-m390-d228-check.png`, fullPage: false })
    check(`D228-M${vp} 머리 띠 단추 3개 44px · 재료 칸(날짜 칸 ${dateW}px) · 요청문 · 받은 글 점검 — 가로 넘침 0 · 단추 44px · 점검하면 결과가 화면 안으로`, heroH.length === 3 && heroH.every((h) => h >= 44) && sheetOver1 <= 0 && dateW >= 140 && preOver <= 0 && btnH.length === 0 && sheetOver2 <= 0 && kindH.every((h) => h >= 44) && resTop < 844 - 80, { heroH, sheetOver1, dateW, preOver, btnH, sheetOver2, kindH, resTop })
    await c2.close()
  }
  check('D228-15 화면 오류 0', !errors.some((e) => e.startsWith('D228')), errors.filter((e) => e.startsWith('D228')))
}

// D-229 — 콘텐츠 작성 규칙집(1~3차 합본): 브리프 6칸 · 채널별 요청문 · 발행 전 검수표 · 카드 5안 순서
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errors.push(`D229 ${e.message}`))
  await seed(p)
  await p.goto(BASE + '/tools/content/build?client=cli_site', { waitUntil: 'networkidle' })
  await p.getByTestId('content-studio').waitFor()
  const slot = (k) => p.locator(`[data-testid="content-brief-slot"][data-key="${k}"]`)
  const keys0 = await p.getByTestId('content-brief-slot').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-key')}:${e.getAttribute('data-ok')}`))
  check('D229-1 브리프 6칸 줄 — 업체 · 독자 · 알리는 것 · 화자 · 사실 목록 · 넣지 말 것 · 화자 비면 노랑 · 재료 n/7', keys0.join() === 'company:1,target:1,item:1,speaker:0,facts:1,avoid:1' && /5\/6/.test(await p.getByTestId('content-brief').innerText()) && /재료 \d+\/7/.test(await p.getByTestId('content-brief').innerText()), keys0)
  await p.getByTestId('content-brief').click()
  await p.getByTestId('content-ov-rebuttal').fill('소량은 아무 데나 맡겨도 똑같다')
  await p.getByTestId('content-ov-shipping').fill('전국 택배 · 3만 원 이상 무료 배송')
  await p.getByTestId('content-ov-speaker').fill('대표 김한솔')
  await p.getByTestId('content-ov-avoid').fill('최저가, 다른 지점 이름')
  await p.getByTestId('content-ov-differ').fill('도면 받은 날 바로 회신해요')
  await wait(900)
  if (SHOTS) {
    await p.getByTestId('content-ov-avoid-section').scrollIntoViewIfNeeded()
    await p.screenshot({ path: `${SHOTS}/content-pc-d229-avoid.png`, fullPage: false })
  }
  await p.getByTestId('content-ov-save').click()
  await wait(500)
  check('D229-2 화자 · 이름을 적으면 6/6 · 넣지 말 것 줄에 업체가 막은 말 2개', (await slot('speaker').getAttribute('data-ok')) === '1' && /6\/6/.test(await p.getByTestId('content-brief').innerText()) && ((await slot('avoid').getAttribute('title')) ?? '').includes('2개'))
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/content-pc-d229-brief.png`, fullPage: false })

  // 블로그 결과 → 발행 전 검수표
  await mode(p, 'direct')
  await p.locator('[data-testid="content-kind"][data-kind="blog"]').click()
  const topicTxt = await p.locator('[data-testid="content-topic"][data-type="choose"]').innerText()
  await p.locator('[data-testid="content-topic"][data-type="choose"] input').check()
  await p.getByTestId('content-make').click()
  await wait(300)
  const blog = await resultText(p)
  check('D229-3 블로그 — 주제 칸도 2가지 · 흔한 반박으로 시작 · 다리 문장(차별점) · 가벼운 첫 행동 · 구분선', topicTxt.includes('2가지') && blog.includes('흔히 "소량은 아무 데나 맡겨도 똑같다" 라고들 하지만') && blog.includes('이렇게 지켜요 — 도면 받은 날 바로 회신해요') && blog.includes('도면 한 장만 먼저 보내 주셔도 검토해 드려요') && blog.includes('(구분선)'), blog.slice(0, 200))
  const rv = p.getByTestId('content-review')
  check('D229-4 결과 아래 발행 전 검수표 — 처음엔 접힘 · 요약(확인 · 사람 0/N)', (await rv.getAttribute('data-open')) === '0' && /사람 0\/\d+/.test(await p.getByTestId('content-review-sum').innerText()))
  await p.getByTestId('content-review-toggle').click()
  const states = await p.getByTestId('content-review-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))
  await p.getByTestId('content-review-check').first().check()
  const sum1 = await p.getByTestId('content-review-sum').innerText()
  check('D229-5 펼치면 자동(통과 · 확인)과 사람이 체크할 것 · 체크하면 숫자가 올라감', states.includes('pass') && states.includes('manual') && states.length >= 15 && /사람 1\//.test(sum1), { states, sum1 })
  if (SHOTS) {
    await rv.scrollIntoViewIfNeeded()
    await wait(300)
    await p.screenshot({ path: `${SHOTS}/content-pc-d229-review.png`, fullPage: false })
  }

  // 영상 — 제목에 지역 없음 · 썸네일 20~35자
  await mode(p, 'direct')
  await p.locator('[data-testid="content-kind"][data-kind="video"]').click()
  await p.getByTestId('content-make').click()
  await wait(300)
  const vTitle = await p.getByTestId('content-result-title').innerText()
  const vText = await resultText(p)
  const thumb = /썸네일 문구\n[^\n]*\n?([^\n]+)/.exec(vText)?.[1] ?? ''
  const vChecks = await p.getByTestId('content-checks').innerText()
  check('D229-6 긴 영상 — 제목 · 썸네일에 지역(화성 · 동탄) 없음 · 체크포인트 3 + 마무리 · 반전 문장 · 썸네일 경보 없음', !/화성|동탄/.test(vTitle) && /3:00 · 3\./.test(vText) && vText.includes('4:00 · 마무리') && vText.includes('여기까지는 기본이에요') && !/썸네일 문구가/.test(vChecks), { vTitle, thumb })

  // 카드 — 5안 순서 · 기본 7장
  await mode(p, 'direct')
  await p.locator('[data-testid="content-kind"][data-kind="cards"]').click()
  const ads = await p.getByTestId('content-adtype-btn').evaluateAll((els) => els.map((e) => e.getAttribute('data-value')))
  await p.locator('[data-testid="content-adtype-btn"][data-value="curious"]').click()
  await p.getByTestId('content-make').click()
  await wait(300)
  const cardPages = await p.getByTestId('content-block').evaluateAll((els) => els.filter((e) => /^\d장/.test((e.textContent || '').trim())).length)
  check('D229-7 카드뉴스 유형 — 규칙집 5안 순서(망설임 → 고민 → 전후 → 궁금증 → 기록) 다음 예전 2개 · 기본 7장 · 궁금증 표지', ads.join() === 'objection,problem,before,curious,proof,info,loss' && cardPages === 7 && (await resultText(p)).includes('고를 때 이것은 꼭 보래요'), { ads, cardPages })

  // 다른 AI 도구 요청문 — 채널별
  await p.getByTestId('content-ai-req').click()
  await p.getByTestId('content-ai-sheet').waitFor()
  const reqBlog = await p.getByTestId('content-ai-req-text').innerText()
  await p.locator('[data-testid="content-ai-channel-btn"][data-kind="video"]').click()
  const reqVideo = await p.getByTestId('content-ai-req-text').innerText()
  check('D229-8 요청문 — 블로그: 2,100~3,000자 · 키워드 제목 맨 앞 · 흔한 반박 · 배송 조건 · 업체가 막은 말 · 마지막 제안 / 영상으로 바꾸면 썸네일 20~35자 · 지역 빼기', reqBlog.includes('채널 · 종류: 네이버 블로그 글') && reqBlog.includes('2,100~3,000자') && reqBlog.includes('제목 맨 앞에') && reqBlog.includes('흔한 반박 1개: "소량은 아무 데나 맡겨도 똑같다"') && reqBlog.includes('배송 · 교환 조건: 전국 택배') && reqBlog.includes('"최저가"') && reqBlog.includes('끝: 도면 검토') && reqVideo.includes('썸네일 문구 20~35자') && reqVideo.includes('지역명은 제목 · 썸네일에 넣지 말고') && !reqVideo.includes('2,100~3,000자'), reqVideo)
  await wait(900)
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/content-pc-d229-request.png`, fullPage: false })
  await p.getByTestId('content-ai-next').click()
  check('D229-9 2단계 글 종류도 고른 채널(긴 영상 기획) 그대로', (await p.locator('[data-testid="content-ai-kind-btn"][data-kind="video"]').getAttribute('aria-pressed')) === 'true')
  await p.getByTestId('content-ai-check-input').fill('동네 맛집 5곳 총정리! 10명 중 8명이 모르는 최저가 비법. 11월 한정 특가, 연락처: 정보 없음')
  await p.getByTestId('content-ai-check-run').click()
  const keys = await p.getByTestId('content-ai-check-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
  await p.getByTestId('content-ai-review-toggle').click()
  const warnN = Number(await p.getByTestId('content-ai-review').getAttribute('data-warn'))
  check('D229-10 받은 글 점검 — 업체 모아 소개 · 통계형 · 업체가 막은 말 · 기한 없는 기간 한정 · 정보 없음 + 검수표 확인 표시', ['roundup', 'stat', 'avoid-최저가', 'month-limit', 'no-info'].every((k) => keys.includes(k)) && warnN >= 3, { keys, warnN })
  await ctx.close()

  for (const vp of [390, 360]) {
    const c2 = await browser.newContext({ viewport: { width: vp, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    const m = await c2.newPage()
    m.on('pageerror', (e) => errors.push(`D229 m${vp} ${e.message}`))
    await seed(m)
    await m.goto(BASE + '/tools/content/build?client=cli_site', { waitUntil: 'networkidle' })
    await m.getByTestId('content-studio').waitFor()
    const over = () => m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    const briefOver = await m.getByTestId('content-brief').evaluate((e) => e.scrollWidth - e.clientWidth)
    const briefH = await m.getByTestId('content-brief').evaluate((e) => Math.round(e.getBoundingClientRect().height))
    if (SHOTS && vp === 390) {
      await m.getByTestId('content-brief').scrollIntoViewIfNeeded()
      await m.screenshot({ path: `${SHOTS}/content-m390-d229-brief.png`, fullPage: false })
    }
    await mode(m, 'pick')
    await m.getByTestId('content-pick').nth(1).click()
    await m.getByTestId('content-result').waitFor()
    await m.getByTestId('content-review-toggle').click()
    const checkH = await m.getByTestId('content-review-check').evaluateAll((els) => els.map((e) => Math.round(e.closest('label').getBoundingClientRect().height)))
    const rvOver = await over()
    if (SHOTS && vp === 390) {
      await m.getByTestId('content-review').scrollIntoViewIfNeeded()
      await wait(300)
      await m.screenshot({ path: `${SHOTS}/content-m390-d229-review.png`, fullPage: false })
    }
    await m.getByTestId('content-ai-req').click()
    await m.getByTestId('content-ai-sheet').waitFor()
    await wait(900)
    const chH = await m.getByTestId('content-ai-channel-btn').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
    const sheetOver = await over()
    if (SHOTS && vp === 390) await m.screenshot({ path: `${SHOTS}/content-m390-d229-request.png`, fullPage: false })
    check(`D229-M${vp} 브리프 줄 넘침 0(높이 ${briefH}px ≥ 44) · 검수표 체크 줄 44px · 채널 단추 44px · 가로 넘침 0`, briefOver <= 0 && briefH >= 44 && checkH.length > 0 && checkH.every((h) => h >= 44) && chH.every((h) => h >= 44) && rvOver <= 0 && sheetOver <= 0, { briefOver, briefH, checkH, chH, rvOver, sheetOver })
    await c2.close()
  }
  check('D229-11 화면 오류 0', !errors.some((e) => e.startsWith('D229')), errors.filter((e) => e.startsWith('D229')))
}

await browser.close()
console.log(`\n홍보 글 만들기 e2e: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
