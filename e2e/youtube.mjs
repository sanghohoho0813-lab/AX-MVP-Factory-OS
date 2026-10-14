/**
 * 유튜브 벤치마킹 (D-193) — 브라우저 인수 시험.
 *
 *   node e2e/youtube.mjs <baseUrl>
 *
 * 서버 함수(/api/yt-bench)는 시험 데이터로 흉내 낸다(유튜브 키 · 바깥 연결 없이).
 *  1. 마케팅 · 브랜딩 맨 위 '유튜브 벤치마킹' → 화면
 *  2. 함수가 없는 곳(로컬) → 안내 + [예시로 보기] · 키가 없으면 키 넣는 법 3단계
 *  3. 받은 데이터 → 받은 때 · 채널 수 · 못 받은 채널 · 이번 주 주목 주제 · 인기 키워드 · 순위 카드(내 채널 · 급상승)
 *  4. 키워드 · 기간 · 종류 · 채널 · TOP N 거르기 / 주소에 하루 칸(slot) · [지금 새로 가져오기]는 30분 칸(bucket) / 다시 열면 저장된 것
 *  5. 콘텐츠 추천(주목 주제 · 제목 아이디어 복사) · 채널 · 분석(채널 현황 · 내 채널 비교 · 접힌 분석 + 한 줄 요약) · CSV
 *  6. 'AI' 라는 말 없음 · 브라우저가 유튜브(googleapis)를 직접 부르지 않음 · 목차 설명 · 오류 0
 *  7. 휴대폰 390 · 360 — 예시 데이터 · 넘침 0 · 카드 두 줄
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

const H = 3_600_000
const D = 24 * H
const NOW = Date.now()
const iso = (ago) => new Date(NOW - ago).toISOString()
const ch = (id, title, subs, views, mine = false) => ({ id, handle: `@${id}`, title, customUrl: `@${id}`, thumb: '', subs, videoCount: 120, views, mine })
const v = (id, c, t, ago, views, d = 700) => ({ id, ch: c, t, at: iso(ago), d, v: views, l: Math.round(views * 0.03), c: Math.round(views * 0.004) })

/** 시험 데이터 — 채널 4곳(내 채널 1) · 영상 16편 */
const FEED = {
  fetchedAt: new Date(NOW - 2 * H).toISOString(),
  channels: [ch('UCme', '김팀장의 경영노트', 8_000, 900_000, true), ch('UCa', '세무 알려주는 채널', 150_000, 30_000_000), ch('UCb', '사장님 돈 공부', 60_000, 6_000_000), ch('UCc', '정책 소식통', 20_000, 2_000_000)],
  videos: [
    v('a1', 'UCa', '고용지원금 청년 채용 이렇게 받으세요', 1 * D, 120_000),
    v('b1', 'UCb', '고용지원금 청년 채용 실제 사례', 2 * D, 40_000),
    v('c1', 'UCc', '고용지원금 청년 채용 바뀐 점', 3 * D, 15_000, 90),
    v('me1', 'UCme', '고용지원금 상담 사례 공개', 2 * D, 9_000),
    v('a2', 'UCa', '가업승계 증여특례 한눈에', 4 * D, 30_000, 1500),
    v('b2', 'UCb', '가업승계 증여특례 실제 사례', 5 * D, 22_000),
    v('c2', 'UCc', '법인세 절세 체크리스트', 6 * D, 8_000, 50),
    v('a3', 'UCa', '법인세 절세 실제 사례', 6 * D, 11_000),
    v('b3', 'UCb', '부가세 신고 마감 정리', 12 * D, 50_000),
    v('c3', 'UCc', '부가세 신고 실수 모음', 15 * D, 7_000, 120),
    v('a4', 'UCa', '노란우산공제 해지 전에', 20 * D, 60_000),
    v('me2', 'UCme', '노란우산공제 실제 상담', 22 * D, 3_000, 160),
    v('a5', 'UCa', '퇴직연금 중간정산 정리', 120 * D, 300_000, 2000),
    v('b4', 'UCb', '퇴직연금 수령 방법', 150 * D, 90_000),
    v('c4', 'UCc', '정책자금 신청 서류', 200 * D, 5_000),
    v('me3', 'UCme', '정책자금 상담 후기', 300 * D, 2_000, 45),
  ],
  failed: ['@세무사'],
  units: 59,
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- PC 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', acceptDownloads: true })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const outside = []
  page.on('request', (r) => {
    if (/googleapis\.com/.test(r.url())) outside.push(r.url())
  })
  await page.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 404, body: '' }))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  // 이 시험은 처음 연 모양(분석은 접힘 · 한 줄 요약)을 본다 — 시드의 '모두 펼치기' 를 지운다
  await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))

  // 1. 마케팅 · 브랜딩 입구
  await page.goto(BASE + '/marketing', { waitUntil: 'networkidle' })
  check('마케팅: 맨 위 "유튜브 벤치마킹" 바로 쓰기 · 도입 예정 5개는 그대로', (await page.getByTestId('marketing-youtube').count()) === 1 && (await page.getByTestId('marketing-planned').locator('li').count()) === 5)
  await page.getByTestId('marketing-youtube').click()
  await page.waitForURL(/\/marketing\/youtube/)
  await page.waitForTimeout(800)

  // 2. 함수가 없는 곳(로컬 미리보기)
  const setup = page.getByTestId('yt-setup')
  check('로컬(함수 없음): 안내 + [예시로 보기]', (await setup.getAttribute('data-status')) === 'unavailable' && (await page.getByTestId('yt-sample').count()) === 1, await setup.getAttribute('data-status').catch(() => 'none'))
  await page.getByTestId('yt-sample').click()
  check('예시로 보기: 큰 "예시 데이터" 띠 · 지어낸 채널', (await page.getByTestId('yt-sample-banner').isVisible()) && ((await page.getByTestId('yt-feedline').innerText()) ?? '').includes('채널 8곳'))

  // 키가 없을 때
  await page.route('**/api/yt-bench**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'no_key' }) }))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('키 없음: 안내 + 키 넣는 법 3단계(YOUTUBE_API_KEY) + 예시로 보기', (await page.getByTestId('yt-setup').getAttribute('data-status')) === 'no_key' && ((await page.getByTestId('yt-key-steps').innerText()) ?? '').includes('YOUTUBE_API_KEY') && (await page.getByTestId('yt-key-steps').locator('li').count()) === 3)
  await page.unroute('**/api/yt-bench**')

  // 3. 받은 데이터
  const asked = []
  await page.route('**/api/yt-bench**', (r) => {
    asked.push(r.request().url())
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FEED) })
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const line = (await page.getByTestId('yt-feedline').innerText()) ?? ''
  check('받은 데이터: 받은 때 · 채널 4곳 · 영상 16편 · 못 받은 채널(@세무사)', line.includes('받은 때') && line.includes('채널 4곳') && line.includes('영상 16편') && line.includes('@세무사'), line)
  check('주소: 처음엔 하루 칸(?slot=오늘 날짜)', asked.length === 1 && /slot=\d{4}-\d{2}-\d{2}$/.test(asked[0]), asked.join(' '))
  check('예시 띠는 사라진다(진짜 데이터)', (await page.getByTestId('yt-sample-banner').count()) === 0)
  const hot = await page.getByTestId('yt-hot-item').allInnerTexts()
  // 한글 3자 이상만 낱말로 친다(예전 앱 그대로) — '청년 · 채용 · 절세' 같은 두 글자는 빠진다
  check('이번 주 주목 주제 TOP 3: 두 낱말 묶음 먼저(가업승계 증여특례 · 2채널) → 한 낱말(고용지원금 · 4채널)', hot.length >= 2 && hot[0].includes('가업승계 증여특례') && hot[0].includes('2채널') && hot.some((h) => h.includes('고용지원금') && h.includes('4채널')), hot)
  const kws = await page.getByTestId('yt-keyword').allInnerTexts()
  check('인기 핵심 키워드: 2편 · 2채널 넘는 말만(고용지원금 · 가업승계 증여특례 · 법인세) — 한 채널만 다룬 말(노란우산공제)은 없음', kws.some((k) => k.includes('#고용지원금')) && kws.some((k) => k.includes('#가업승계 증여특례')) && kws.some((k) => k.includes('#법인세')) && !kws.some((k) => k.includes('노란우산공제')) && !kws.some((k) => k.includes('받으세요')), kws)
  const cards = page.getByTestId('yt-card')
  check('이번 주 순위: 7일 안 영상만 · 조회수 순(1위 a1)', (await cards.count()) === 8 && ((await cards.first().innerText()) ?? '').includes('고용지원금 청년 채용 이렇게 받으세요'), await cards.count())
  check('내 채널 카드 표시 · 요약 "내 채널 최고 순위"', (await page.locator('[data-testid="yt-card"][data-mine="1"]').count()) === 1 && ((await page.getByTestId('yt-summary').innerText()) ?? '').includes('내 채널 최고 순위'))
  check('급상승: 이번 주 평균의 2배 넘는 영상(a1)', ((await page.locator('[data-testid="yt-card"][data-rising="1"]').first().innerText()) ?? '').includes('고용지원금 청년 채용 이렇게'))
  check('카드: 유튜브 링크는 새 창 · 안전하게(noopener)', ((await cards.first().locator('a').first().getAttribute('href')) ?? '').startsWith('https://www.youtube.com/watch?v=a1') && (await cards.first().locator('a').first().getAttribute('rel'))?.includes('noopener'))

  // 4. 거르기
  await page.getByTestId('yt-keyword').filter({ hasText: '#가업승계 증여특례' }).click()
  await page.waitForTimeout(300)
  const kwTitles = await page.getByTestId('yt-card').allInnerTexts()
  check('키워드 누르면 그 말이 든 영상만 · 주소에 kw', kwTitles.length === 2 && kwTitles.every((t) => t.includes('가업승계') && t.includes('증여특례')) && new URL(page.url()).searchParams.get('kw') === '가업승계 증여특례', page.url())
  await page.getByTestId('yt-period-month').click()
  await page.waitForTimeout(300)
  check('기간 바꾸면 키워드는 풀린다 · 이번 달 = 30일 안(12편)', !page.url().includes('kw=') && (await page.getByTestId('yt-card').count()) === 12, await page.getByTestId('yt-card').count())
  await page.getByTestId('yt-type-short').click()
  await page.waitForTimeout(300)
  check('쇼츠만(3분 이하): 이번 달 쇼츠 4편', (await page.getByTestId('yt-card').count()) === 4, await page.getByTestId('yt-card').count())
  await page.getByTestId('yt-type-all').click()
  await page.getByTestId('yt-channel').selectOption('UCa')
  await page.waitForTimeout(300)
  const onlyA = await page.getByTestId('yt-card').allInnerTexts()
  check('채널 고르기: 그 채널 영상만(이번 달 4편)', onlyA.length === 4 && onlyA.every((t) => t.includes('세무 알려주는 채널')), onlyA.length)
  await page.getByTestId('yt-channel').selectOption('')
  await page.getByTestId('yt-period-year').click()
  await page.getByTestId('yt-topn').selectOption('20')
  await page.waitForTimeout(300)
  check('올해 · TOP 20: 365일 안 16편 모두', (await page.getByTestId('yt-card').count()) === 16)
  await page.getByTestId('yt-period-shorts').click()
  await page.waitForTimeout(300)
  check('쇼츠 칸: 90일 안 쇼츠만 · 롱폼/쇼츠 거르기는 숨김', (await page.getByTestId('yt-card').count()) === 4 && (await page.getByTestId('yt-type-long').count()) === 0)

  await page.getByTestId('yt-refresh').click()
  await page.waitForTimeout(600)
  check('[지금 새로 가져오기]: 30분 칸(?bucket=…)으로 부른다', asked.length === 2 && /bucket=\d+$/.test(asked[1]), asked.join(' '))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('다시 열면 이 기기에 저장된 것(같은 하루 칸이면 다시 안 부름)', asked.length === 2 && (await page.getByTestId('yt-card').count()) > 0, asked.length)

  // 할당량 초과 — 지난번 것으로 보여 준다
  await page.unroute('**/api/yt-bench**')
  await page.route('**/api/yt-bench**', (r) => r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'quota' }) }))
  await page.getByTestId('yt-refresh').click()
  await page.waitForTimeout(600)
  check('할당량 초과: 안내(오후 4~5시) + 지난번에 받은 것 그대로', ((await page.getByTestId('yt-message').innerText()) ?? '').includes('한도') && (await page.getByTestId('yt-card').count()) > 0)
  await page.unroute('**/api/yt-bench**')
  await page.route('**/api/yt-bench**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FEED) }))

  // 5. 콘텐츠 추천
  await page.getByTestId('yt-view-ideas').click()
  await page.waitForTimeout(400)
  const topics = page.getByTestId('yt-topic')
  check('콘텐츠 추천: 이번 주 · 이번 달 주목 주제(1위 가업승계 증여특례 · 2개 채널 · 대표 영상)', (await topics.count()) >= 3 && ((await topics.first().innerText()) ?? '').includes('가업승계 증여특례') && ((await topics.first().innerText()) ?? '').includes('2개 채널') && ((await topics.first().innerText()) ?? '').includes('가업승계 증여특례 한눈에'), await topics.count())
  check('제목 아이디어 3개씩 · 대본 만들기(AI) 단추 없음', (await topics.first().getByTestId('yt-idea').count()) === 3 && !/AI/.test((await page.locator('main').innerText()) ?? ''))
  const firstIdea = ((await topics.first().getByTestId('yt-idea').first().innerText()) ?? '').replace(/\s*복사\s*$/, '').trim()
  await topics.first().getByTestId('yt-idea-copy').first().click()
  await page.waitForTimeout(300)
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  check('제목 [복사] → 그 제목이 복사된다', clip === firstIdea && clip.includes('가업승계 증여특례'), { clip, firstIdea })

  // 채널 · 분석
  await page.getByTestId('yt-view-channels').click()
  await page.waitForTimeout(400)
  const rows = await page.getByTestId('yt-channel-row').allInnerTexts()
  check('채널 현황: 4곳 · 구독자 많은 순 · 구독자당 조회수', rows.length === 4 && rows[0].includes('세무 알려주는 채널') && rows[0].includes('구독자당 200.0회'), rows[0])
  check('내 채널 vs 벤치마킹 평균: 4줄', ((await page.getByTestId('yt-compare').innerText()) ?? '').includes('최근 30일 업로드'))
  const wdSum = (await page.getByTestId('yt-weekday').getByTestId('fold-summary').innerText().catch(() => '')) ?? ''
  check('잘 되는 요일: 접혀 있어도 한 줄 요약(1위 ○요일 · 평균)', (await page.getByTestId('yt-weekday').getAttribute('data-open')) === '0' && /1위 .요일 · 평균/.test(wdSum), wdSum)
  await page.getByTestId('yt-length').getByTestId('fold-toggle').click()
  check('영상 길이별: 펼치면 구간마다 평균 · 1위 표시', ((await page.getByTestId('yt-length').innerText()) ?? '').includes('1~3분(쇼츠)') && ((await page.getByTestId('yt-length').innerText()) ?? '').includes('1위'))

  // CSV
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('yt-csv').click()])
  const path = await dl.path()
  const { readFileSync } = await import('node:fs')
  const csv = readFileSync(path, 'utf8')
  check('CSV: 파일 이름 · 한글 깨짐 방지(BOM) · 16편', /^youtube-benchmark-\d{8}\.csv$/.test(dl.suggestedFilename()) && csv.startsWith('﻿채널,제목') && csv.trim().split('\n').length === 17, dl.suggestedFilename())

  // 6. 목차 설명 · 바깥 연결 · 오류
  const noHint = await page.evaluate(() =>
    [...document.querySelectorAll('main h1, main h2')]
      .filter((h) => h.offsetParent && !h.classList.contains('sr-only'))
      .filter((h) => !h.closest('.group\\/hint')?.querySelector('[data-testid=hint-tip]'))
      .map((h) => h.innerText.trim().split('\n')[0]),
  )
  check('목차 설명: 화면 제목 · 목차 전부(ⓘ)', noHint.length === 0, noHint.join(' · '))
  check('브라우저는 유튜브(googleapis)를 직접 부르지 않는다(키는 서버에만)', outside.length === 0, outside.join(' '))
  check('JS 오류 없음', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- 휴대폰 ---------------- */
for (const width of [390, 360]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/marketing/youtube', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.getByTestId('yt-sample').tap()
  await page.waitForTimeout(500)
  const over = async () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  const cols = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('[data-testid="yt-card"]')].slice(0, 3).map((e) => Math.round(e.getBoundingClientRect().top))
    return cs[0] === cs[1] && cs[1] !== cs[2]
  })
  check(`${width}: 카드 두 줄(2열) · 넘침 0`, cols && (await over()) <= 0, await over())
  const chip = await page.getByTestId('yt-period-week').boundingBox()
  check(`${width}: 기간 단추 누르기 쉬운 높이(40px 이상)`, !!chip && chip.height >= 40, JSON.stringify(chip))
  for (const k of ['ideas', 'channels']) {
    await page.getByTestId(`yt-view-${k}`).tap()
    await page.waitForTimeout(300)
    check(`${width} ${k}: 넘침 0`, (await over()) <= 0, await over())
  }
  check(`${width}: JS 오류 없음`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(`\nyoutube: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
