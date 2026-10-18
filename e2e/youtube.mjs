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
 *  7. 휴대폰 390 · 360 — 예시 데이터 · 넘침 0
 * D-194 콘텐츠 레이더: 첫 화면 = 이번 주 찍을 것(후보 카드 · 근거 · 상세 · 수첩 저장/다시 읽기 · 단계 · 브리프 복사) ·
 *   채널 네 묶음(끄기 · 채널 추가는 로그인한 OS 에서만) · 분석(내 채널 · 제목 구조) · 금지 문구 0 · LLM 주소 0 · 유튜브 키 번들 0 ·
 *   휴대폰 360 · 390 · 430 넘침 0 · 누르는 곳 44px · 인기 영상은 휴대폰에서 한 줄 목록
 * D-196 6시간 자동 갱신: 같은 날 18채널 예전 저장본 + 서버 판 → 열자마자 새로 · 5시간 59분 그대로 · 6시간 넘으면 새로 ·
 *   돌아올 때(focus · visibilitychange) · 판 바뀜 · [지금 새로] · 실패하면 지난번 것 + 받은 때 · PC 1440 = 휴대폰 390 같은 추천
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
  // D-227 시장 신호는 접힌 채 한 판씩 — 이 시험들은 예전처럼 다 펼친 모양([전부 보기] · 펼침 기억)을 본다. 처음 모양은 D-227 시험에서
  await page.evaluate(() => { localStorage.setItem('axmvp.fold.radar.signals', '1'); localStorage.setItem('axmvp.radar.board', 'all') })
  // 이 시험은 처음 연 모양(분석은 접힘 · 한 줄 요약)을 본다 — 시드의 '모두 펼치기' 를 지운다
  await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))

  // 1. 마케팅 · 브랜딩 입구 — D-231 부터 /marketing 은 바로 콘텐츠 레이더 · 예전 안내 화면은 /marketing/more
  await page.goto(BASE + '/marketing/more', { waitUntil: 'networkidle' })
  check('마케팅 안내(/marketing/more): 맨 위 "콘텐츠 레이더(YouTube 벤치마킹)" 바로 쓰기 · 도입 예정 5개는 그대로', (await page.getByTestId('marketing-youtube').count()) === 1 && ((await page.getByTestId('marketing-youtube').innerText()) ?? '').includes('콘텐츠 레이더') && (await page.getByTestId('marketing-planned').locator('li').count()) === 5)
  await page.goto(BASE + '/marketing', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('D-231 마케팅 · 브랜딩(/marketing)을 누르면 바로 콘텐츠 레이더 · 목차 한 줄에 홍보 글 · 홈페이지', (await page.getByTestId('yt-page').count()) === 1 && (await page.getByTestId('mk-tab-content').count()) === 1 && (await page.getByTestId('mk-tab-homepage').count()) === 1 && (await page.getByTestId('yt-view-make').count()) === 1)
  await page.goto(BASE + '/marketing/youtube', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  // 2. 함수가 없는 곳(로컬 미리보기)
  const setup = page.getByTestId('yt-setup')
  check('로컬(함수 없음): 안내 + [예시로 보기]', (await setup.getAttribute('data-status')) === 'unavailable' && (await page.getByTestId('yt-sample').count()) === 1, await setup.getAttribute('data-status').catch(() => 'none'))
  await page.getByTestId('yt-sample').click()
  check('예시로 보기: 큰 "예시 데이터" 띠 · 지어낸 채널', (await page.getByTestId('yt-sample-banner').isVisible()) && ((await page.getByTestId('yt-feedline').innerText()) ?? '').includes('채널 12곳'))

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
  // D-196: 판 확인(?status=1 · 유튜브 할당량 0)은 데이터 요청이 아니므로 따로 센다
  const feedAsked = () => asked.filter((u) => !u.includes('status=1'))
  check('주소: 처음엔 6시간 칸(?win=…) — D-196 전에는 하루 칸(?slot=)', feedAsked().length === 1 && /[?&]win=\d+$/.test(feedAsked()[0]), asked.join(' '))
  check('예시 띠는 사라진다(진짜 데이터)', (await page.getByTestId('yt-sample-banner').count()) === 0)
  // D-233 대표 "왼쪽 위 콘텐츠 레이더라는 이름 말고 마케팅 · 브랜딩으로" — 제목은 '마케팅 · 브랜딩', 콘텐츠 레이더는 보조 줄에
  check('D-194 · D-233 첫 화면 = 이번 주 찍을 것 · 제목 "마케팅 · 브랜딩"("콘텐츠 레이더" 아님) · 보조 "콘텐츠 레이더 · YouTube 벤치마킹"', (await page.getByTestId('radar-plan').isVisible()) && ((await page.locator('main h1').first().innerText()) ?? '').includes('마케팅 · 브랜딩') && !((await page.locator('main h1').first().innerText()) ?? '').includes('콘텐츠 레이더') && ((await page.getByTestId('radar-subtitle').innerText()) ?? '').includes('YouTube 벤치마킹') && ((await page.getByTestId('radar-subtitle').innerText()) ?? '').includes('콘텐츠 레이더'))
  await page.getByTestId('yt-view-top').click()
  await page.waitForTimeout(400)
  const hot = await page.getByTestId('yt-hot-item').allInnerTexts()
  // 한글 3자 이상만 낱말로 친다(예전 앱 그대로) — '청년 · 채용 · 절세' 같은 두 글자는 빠진다
  check('이번 주 주목 주제 TOP 3: 두 낱말 묶음 먼저(가업승계 증여특례 · 2채널) → 한 낱말(고용지원금 · 4채널)', hot.length >= 2 && hot[0].includes('가업승계 증여특례') && hot[0].includes('2채널') && hot.some((h) => h.includes('고용지원금') && h.includes('4채널')), hot)
  const kws = await page.getByTestId('yt-keyword').allInnerTexts()
  check('인기 핵심 키워드: 2편 · 2채널 넘는 말만(고용지원금 · 가업승계 증여특례 · 법인세) — 한 채널만 다룬 말(노란우산공제)은 없음', kws.some((k) => k.includes('#고용지원금')) && kws.some((k) => k.includes('#가업승계 증여특례')) && kws.some((k) => k.includes('#법인세')) && !kws.some((k) => k.includes('노란우산공제')) && !kws.some((k) => k.includes('받으세요')), kws)
  const cards = page.getByTestId('yt-card')
  check('이번 주 순위: 7일 안 영상만 · 조회수 순(1위 a1)', (await cards.count()) === 8 && ((await cards.first().innerText()) ?? '').includes('고용지원금 청년 채용 이렇게 받으세요'), await cards.count())
  check('내 채널 카드 표시 · 요약 "내 채널 최고 순위"', (await page.locator('[data-testid="yt-card"][data-mine="1"]').count()) === 1 && ((await page.getByTestId('yt-summary').innerText()) ?? '').includes('내 채널 최고 순위'))
  check('급상승: 이번 주 평균의 2배 넘는 영상(a1)', ((await page.locator('[data-testid="yt-card"][data-rising="1"]').first().innerText()) ?? '').includes('고용지원금 청년 채용 이렇게'))
  await cards.first().getByTestId('yt-card-thumb').click()
  await page.waitForTimeout(300)
  check('D-194 카드 누르면 상세 창(평소 대비 · 참고할 것)', (await page.getByTestId('radar-video-detail').isVisible()) && (await page.getByTestId('radar-lessons').locator('li').count()) >= 2)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  check('카드: 유튜브 링크는 새 창 · 안전하게(noopener)', ((await cards.first().locator('a').first().getAttribute('href')) ?? '').startsWith('https://www.youtube.com/watch?v=a1') && (await cards.first().locator('a').first().getAttribute('rel'))?.includes('noopener'))

  // 4. 거르기
  await page.getByTestId('yt-keyword').filter({ hasText: '#가업승계 증여특례' }).click()
  await page.waitForTimeout(300)
  const kwTitles = await page.getByTestId('yt-card').allInnerTexts()
  check('키워드 누르면 그 말이 든 영상만 · 주소에 kw', kwTitles.length === 2 && kwTitles.every((t) => t.includes('가업승계') && t.includes('증여특례')) && new URL(page.url()).searchParams.get('kw') === '가업승계 증여특례', page.url())
  await page.getByTestId('yt-period-month').click()
  await page.waitForTimeout(300)
  // D-194: 거르기는 필요할 때만 펼친다
  check('D-194 거르기는 접혀 있다(한 줄 요약)', (await page.getByTestId('yt-filters').count()) === 0 && ((await page.getByTestId('yt-filter-toggle').innerText()) ?? '').includes('거르기'))
  await page.getByTestId('yt-filter-toggle').click()
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
  check('[지금 새로 가져오기]: 30분 칸(?bucket=…)으로 부른다', feedAsked().length === 2 && /bucket=\d+$/.test(feedAsked()[1]), asked.join(' '))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('다시 열면 이 기기에 저장된 것(받은 지 6시간 안이면 다시 안 부름)', feedAsked().length === 2 && (await page.getByTestId('yt-card').count()) > 0, asked.join(' '))

  // 할당량 초과 — 지난번 것으로 보여 준다
  await page.unroute('**/api/yt-bench**')
  await page.route('**/api/yt-bench**', (r) => r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: 'quota' }) }))
  await page.getByTestId('yt-refresh').click()
  await page.waitForTimeout(600)
  check('할당량 초과: 안내(오후 4~5시) + 지난번에 받은 것 그대로', ((await page.getByTestId('yt-message').innerText()) ?? '').includes('한도') && (await page.getByTestId('yt-card').count()) > 0)
  await page.unroute('**/api/yt-bench**')
  await page.route('**/api/yt-bench**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FEED) }))

  // 5. 콘텐츠 추천
  await page.getByTestId('yt-view-analysis').click()
  await page.waitForTimeout(400)
  await page.getByTestId('yt-ideas').getByTestId('fold-toggle').click()
  await page.waitForTimeout(300)
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
  await page.getByTestId('yt-view-analysis').click()
  await page.waitForTimeout(400)
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

  // 6. 목차 설명 · 바깥 연결 · 오류 — 탭 넷 모두
  const noHintAll = []
  for (const k of ['plan', 'top', 'channels', 'analysis']) {
    await page.getByTestId(`yt-view-${k}`).click()
    await page.waitForTimeout(300)
    noHintAll.push(
      ...(await page.evaluate(() =>
        [...document.querySelectorAll('main h1, main h2')]
          .filter((h) => h.offsetParent && !h.classList.contains('sr-only'))
          .filter((h) => !h.closest('.group\\/hint')?.querySelector('[data-testid=hint-tip]'))
          .map((h) => h.innerText.trim().split('\n')[0]),
      )),
    )
  }
  check('목차 설명: 화면 제목 · 목차 전부(ⓘ) — 탭 넷 모두', noHintAll.length === 0, noHintAll.join(' · '))
  check('브라우저는 유튜브(googleapis)를 직접 부르지 않는다(키는 서버에만)', outside.length === 0, outside.join(' '))
  check('JS 오류 없음', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- 콘텐츠 레이더(D-194) — 네 묶음 시험 데이터 ---------------- */
const gch = (id, title, subs, group, mine = false) => ({ ...ch(id, title, subs, subs * 80, mine), group })
const base = (c, n, views, from = 10) => Array.from({ length: n }, (_, i) => v(`${c}_b${i}`, c, `${c} 평범한 이야기 ${i}`, (from + i * 3) * D, views + i))
const RADAR = {
  fetchedAt: new Date(NOW - H).toISOString(),
  channels: [
    gch('UCme', '김팀장의 경영노트', 8_000, 'direct', true), gch('UCd1', '정책 소식 채널', 30_000, 'direct'), gch('UCd2', '세무 이야기 채널', 120_000, 'direct'), gch('UCd3', '사장님 지원금 채널', 8_000, 'direct'),
    gch('UCa1', 'AI 실무 채널 하나', 9_000, 'ai'), gch('UCa2', 'AI 실무 채널 둘', 40_000, 'ai'), gch('UCx1', '자동화 채널', 20_000, 'ax'), gch('UCf1', '포맷 채널', 500_000, 'format'),
  ],
  videos: [
    ...base('UCme', 8, 300), ...base('UCd1', 8, 3_000), ...base('UCd2', 8, 12_000), ...base('UCd3', 8, 800), ...base('UCa1', 8, 900), ...base('UCa2', 8, 4_000), ...base('UCx1', 8, 2_000), ...base('UCf1', 8, 50_000),
    v('r1', 'UCd1', '정책자금 신청 전에 꼭 볼 것', 5 * D, 9_000), v('r2', 'UCd1', '지원사업 공고 정리', 9 * D, 3_100),
    v('r3', 'UCd2', '정책자금 떨어지는 회사 특징', 6 * D, 18_000), v('r4', 'UCd2', '법인세 절세 3가지', 8 * D, 50_000),
    v('r5', 'UCd3', '정책자금 오픈런 마감 이유', 4 * D, 4_000), v('r6', 'UCd3', '지원사업 사업계획서 핵심', 11 * D, 900),
    v('r15', 'UCd1', '절세 놓치면 손해 보는 이유', 7 * D, 8_000), v('r16', 'UCd3', '세금 신고 전에 확인할 것', 6 * D, 2_600),
    v('r7', 'UCa1', 'Claude로 보고서 10분 만에', 3 * D, 5_400), v('r8', 'UCa1', 'ChatGPT 업무 자동화 해봤습니다', 9 * D, 1_000),
    v('r9', 'UCa2', 'Claude 업무 활용 실제 후기', 5 * D, 8_000), v('r10', 'UCa2', 'n8n 자동화 처음이면', 12 * D, 4_100),
    v('r11', 'UCx1', '업무자동화 실제로 얼마나 줄까', 8 * D, 6_000), v('r12', 'UCx1', 'Claude 사내 시스템 만들기', 10 * D, 2_100),
    v('r13', 'UCf1', '정책자금 인터뷰 대표 이야기', 7 * D, 60_000), v('r14', 'UCme', '정책자금 설명만 잘하면 받던 시대', 6 * D, 700),
  ],
  failed: [],
}
const RJSON = JSON.stringify(RADAR)
const FORBIDDEN = ['AI 추천', 'AI가 분석', 'AI 분석', '성공 가능', '이 영상은 뜹니다', '% 성공']

{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const page = await ctx.newPage()
  const errors = []
  const outside = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('request', (r) => {
    const u = r.url()
    if (!u.startsWith(BASE) && !u.startsWith('data:') && !/i\.ytimg\.com/.test(u)) outside.push(u)
  })
  const asked = []
  await page.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 404, body: '' }))
  await page.route('**/api/yt-bench**', (r) => {
    asked.push(r.request().url())
    return r.fulfill({ status: 200, contentType: 'application/json', body: RJSON })
  })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  // D-227 시장 신호는 접힌 채 한 판씩 — 이 시험들은 예전처럼 다 펼친 모양([전부 보기] · 펼침 기억)을 본다. 처음 모양은 D-227 시험에서
  await page.evaluate(() => { localStorage.setItem('axmvp.fold.radar.signals', '1'); localStorage.setItem('axmvp.radar.board', 'all') })
  await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))
  await page.goto(BASE + '/marketing/youtube', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)

  const tops = page.getByTestId('radar-top').getByTestId('radar-opp')
  const axes = [...(await tops.evaluateAll((els) => els.map((e) => e.getAttribute('data-axis')))), ...(await page.getByTestId('radar-opp-compact').evaluateAll((els) => els.slice(0, 2).map((e) => e.getAttribute('data-axis'))))]
  check('레이더: 첫 화면에 후보 카드 3장 + 4~5위 한 줄', (await tops.count()) === 3 && axes.length === 5, axes)
  check('레이더: 이번 주 5개에 시장수요 · AX·AI · BRIDGE 가 섞인다(비중 가이드 45 · 35 · 20)', ['market', 'axai', 'bridge'].every((a) => axes.includes(a)), axes)
  const first = tops.first()
  const strengthText = (await first.getByTestId('radar-strength').innerText()) ?? ''
  // D-195 UX 3.0 — 1순위 하나만 크게 · 2 · 3 작게 · 기본 상태는 결정 → 이유(한 문장 · 근거 2개) → MIRAE 관점
  const heroBox = await page.locator('[data-testid="radar-opp"][data-size="hero"]').boundingBox()
  const subBoxes = await page.locator('[data-testid="radar-opp"][data-size="sub"]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width * e.getBoundingClientRect().height))
  check('U1 1순위 HERO 하나 · "이번 주 1순위" · 맨 앞 카드', (await page.locator('[data-size="hero"]').count()) === 1 && (await first.getAttribute('data-size')) === 'hero' && (await first.getByTestId('radar-rank1').innerText()).includes('이번 주 1순위'))
  check('U2 2 · 3순위는 작게(카드 넓이가 1순위보다 작음)', subBoxes.length === 2 && !!heroBox && subBoxes.every((a) => a < heroBox.width * heroBox.height), { hero: heroBox && heroBox.width * heroBox.height, subBoxes })
  check('U3 기본 상태에서는 벤치마킹 썸네일을 보이지 않는다(위 3장)', (await page.getByTestId('radar-top').getByTestId('radar-bench-thumb').count()) === 0)
  const why = ((await first.getByTestId('radar-why').innerText()) ?? '').trim()
  check('U5 왜 지금은 사람이 읽는 한 문장 · 핵심 근거는 2개까지', /채널/.test(why) && why.endsWith('.') && !why.includes('\n') && (why.match(/\./g) ?? []).length <= 2 && (await first.getByTestId('radar-fact').count()) >= 1 && (await first.getByTestId('radar-fact').count()) <= 2, why)
  check('레이더 카드: 신호 세기(강함 · 보통 · 초기 — 점수 없음) · MIRAE 관점 · 제목 예', /신호 (강함|보통)|초기 신호/.test(strengthText) && !/\d+점/.test(strengthText) && ((await first.getByTestId('radar-view').innerText()) ?? '').length > 15 && ((await first.innerText()) ?? '').includes('제목 예'))
  check('U6 4 · 5위는 한 줄 · U7 6~10위는 [후보 더 보기] 뒤', (await page.getByTestId('radar-opp-compact').count()) === 2 && (await page.getByTestId('radar-more-list').count()) === 0 && ((await page.getByTestId('radar-more').count()) === 1 || (await page.getByTestId('radar-more-list').count()) === 0))
  check('첫 화면 머리: 받은 때 · 채널 수는 작은 글 · 비중 가이드는 [추천 기준] 뒤', (await page.getByTestId('radar-mix-panel').count()) === 0 && ((await page.getByTestId('radar-mix').innerText()) ?? '').includes('추천 기준') && (await page.getByTestId('yt-feedline').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))) < (await page.locator('#radar-plan-h').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))))
  check('레이더: AI · AX 채널이 있으니 "AI 데이터 부족" 안내는 없다', (await page.getByTestId('radar-ai-short').count()) === 0)
  const mainText = (await page.locator('main').innerText()) ?? ''
  check('문구: "AI 추천 · AI가 분석 · 성공 가능 % · 이 영상은 뜹니다" 같은 말이 없다(근거 → 제안)', FORBIDDEN.every((w) => !mainText.includes(w)), FORBIDDEN.filter((w) => mainText.includes(w)))
  const bridgeCard = page.locator('[data-testid="radar-opp"][data-axis="bridge"], [data-testid="radar-opp-compact"][data-axis="bridge"]').first()
  check('BRIDGE 카드: "시장 주제 × AX 방향" 이름', ((await bridgeCard.innerText()) ?? '').includes('×'))

  await first.getByTestId('radar-opp-more').click()
  await page.waitForTimeout(200)
  const nBench = await first.getByTestId('radar-bench-thumb').count()
  check('U4 근거 보기: 벤치마킹 영상(썸네일 · 배수 · 제목) 1~3편 · 제목 후보 3 · 썸네일 문구 2 · 추천 접근', nBench >= 1 && nBench <= 3 && (await first.getByTestId('radar-title').count()) === 3 && (await first.getByTestId('radar-thumb-text').count()) === 2 && ((await first.getByTestId('radar-approach').innerText()) ?? '').includes('추천 접근'), nBench)
  check('근거 보기: 숫자는 여기에 다 있다(관련 영상 · 채널 · 묶음별 n곳 중 m곳)', ((await first.getByTestId('radar-evidence').innerText()) ?? '').includes('관련 영상') && /\d+곳 중 \d+곳/.test((await first.getByTestId('radar-coverage').innerText()) ?? ''))
  await first.getByTestId('radar-bench-thumb').first().click()
  await page.waitForTimeout(300)
  const det = page.getByTestId('radar-video-detail')
  check('영상 상세: 평소 대비 · 조회 속도 · 채널 안 순위 · 참고할 것 · 유튜브 링크(noopener)', (await det.isVisible()) && ((await det.innerText()) ?? '').includes('조회 속도') && ((await det.innerText()) ?? '').includes('채널 안 순위') && (await page.getByTestId('radar-lessons').locator('li').count()) >= 2 && ((await page.getByTestId('radar-open-youtube').getAttribute('rel')) ?? '').includes('noopener'))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  check('영상 상세: Esc 로 닫힘', (await det.count()) === 0)

  // 수첩(D-231 부터 [내 콘텐츠] 탭) — 저장 · 다시 읽기 · 단계 · 브리프 · 빼기([아이디어로 담기] 는 근거 보기 안)
  const toMake = async () => {
    await page.getByTestId('yt-view-make').click()
    await page.waitForTimeout(300)
  }
  const toPlan = async () => {
    await page.getByTestId('yt-view-plan').click()
    await page.waitForTimeout(300)
  }
  const topic = ((await first.getByTestId('radar-opp-topic').innerText()) ?? '').trim()
  await first.getByTestId('radar-save').click()
  await page.waitForTimeout(400)
  const savedChip = await first.getByTestId('radar-saved').count()
  await toMake()
  check('아이디어 저장: 카드에 "내 콘텐츠에 있음" · 내 콘텐츠 1개', savedChip === 1 && (await page.getByTestId('radar-idea').count()) === 1)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('다시 열어도 내 콘텐츠에 그대로(저장 → 다시 읽기)', (await page.getByTestId('radar-idea').count()) === 1 && ((await page.getByTestId('radar-idea').first().innerText()) ?? '').includes(topic.split(' × ')[0]))
  await page.getByTestId('radar-idea-status').first().selectOption('script')
  await page.waitForTimeout(400)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('단계: 대본 준비로 바꾸면 다시 열어도 그대로', (await page.getByTestId('radar-idea').first().getAttribute('data-status')) === 'script')
  await page.getByTestId('radar-idea-brief').first().click()
  await page.waitForTimeout(300)
  const brief = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  check('브리프 복사: 주제 · 제목 후보 · 근거 · 참고 영상(그대로 쓰지 않는다는 말) · 미래AI랩 관점 · 첫 문장', brief.includes('[콘텐츠 브리프]') && brief.includes('제목 후보') && brief.includes('그대로 쓰지 않는다') && brief.includes('youtube.com/watch') && brief.includes('미래AI랩 관점') && brief.includes('첫 문장'), brief.slice(0, 160))
  await page.getByTestId('radar-idea-remove').first().click()
  check('빼기는 한 번 더 묻는다', (await page.getByTestId('radar-idea-confirm').count()) === 1)
  await page.getByTestId('radar-idea-confirm').getByRole('button', { name: '빼기' }).click()
  await page.waitForTimeout(400)
  check('빼면 내 콘텐츠에서 사라진다', (await page.getByTestId('radar-idea').count()) === 0)
  await toPlan()

  // U8 · U9 — [이번 주로 확정] → 기존 수첩에 '제작 예정' · 다시 눌러도 줄이 늘지 않음
  const heroCard = page.locator('[data-testid="radar-opp"][data-size="hero"]')
  const heroTopic = ((await heroCard.getByTestId('radar-opp-topic').innerText()) ?? '').trim()
  // D-238: [이번 주로 확정] 은 찍기 키트(펼쳐 둔 채) 위 — 예전엔 키트 아래로 한참 밀려 있었다
  {
    const cb = await heroCard.getByTestId('radar-confirm').boundingBox()
    const kb = await heroCard.getByTestId('radar-kit').boundingBox()
    check('D238-1 1순위 카드 [이번 주로 확정] 이 찍기 키트보다 위', !!cb && !!kb && cb.y + cb.height <= kb.y + 1, JSON.stringify({ cb: cb?.y, kb: kb?.y }))
  }
  await heroCard.getByTestId('radar-confirm').click()
  await page.waitForTimeout(500)
  const u8card = ((await heroCard.getByTestId('radar-confirmed').innerText()) ?? '').includes('제작 예정') && ((await page.getByTestId('radar-selected').innerText()) ?? '').includes(heroTopic)
  await toMake()
  check('U8 이번 주로 확정 → 내 콘텐츠에 "제작 예정" 1줄 · 카드에 "이번 주 제작 예정" · 위에 작은 제작 예정 줄', u8card && (await page.getByTestId('radar-idea').count()) === 1 && (await page.getByTestId('radar-idea').first().getAttribute('data-status')) === 'selected')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const u8again = (await page.getByTestId('radar-idea').count()) === 1 && (await page.getByTestId('radar-idea').first().getAttribute('data-status')) === 'selected'
  await toPlan()
  check('U8 다시 열어도 제작 예정 그대로', u8again && (await page.getByTestId('radar-selected-item').count()) === 1)
  await toMake()
  await page.getByTestId('radar-idea-status').first().selectOption('idea')
  await page.waitForTimeout(400)
  await toPlan()
  await page.locator('[data-testid="radar-opp"][data-size="hero"]').getByTestId('radar-confirm').click()
  await page.waitForTimeout(500)
  await page.locator('[data-testid="radar-opp"][data-size="hero"]').getByTestId('radar-opp-more').click()
  await page.waitForTimeout(200)
  check('U9 수첩에 있으면 [아이디어로 담기] 대신 "내 콘텐츠에 있음"(같은 후보를 두 줄로 담지 않음)', (await page.locator('[data-testid="radar-opp"][data-size="hero"]').getByTestId('radar-save').count()) === 0 && (await page.locator('[data-testid="radar-opp"][data-size="hero"]').getByTestId('radar-saved').count()) === 1)
  await toMake()
  check('U9 이미 담긴 아이디어(단계 아이디어)를 확정 → 줄을 새로 만들지 않고 단계만 제작 예정', (await page.getByTestId('radar-idea').count()) === 1 && (await page.getByTestId('radar-idea').first().getAttribute('data-status')) === 'selected')
  await page.getByTestId('radar-idea-remove').first().click()
  await page.getByTestId('radar-idea-confirm').getByRole('button', { name: '빼기' }).click()
  await page.waitForTimeout(400)
  await toPlan()

  // U10 · U11 — [관심 없음] → 그 후보만 빠짐 · 추천 기준 › 숨긴 주제에서 되살림
  const sub2 = page.locator('[data-testid="radar-opp"][data-size="sub"]').first()
  const mutedTopic = ((await sub2.getByTestId('radar-opp-topic').innerText()) ?? '').trim()
  await sub2.getByTestId('radar-opp-more').click()
  await page.waitForTimeout(200)
  await sub2.getByTestId('radar-mute').click()
  await page.waitForTimeout(600)
  const topicsNow = await page.locator('[data-testid="radar-opp-topic"]').allInnerTexts()
  const compactNow = await page.getByTestId('radar-opp-compact').allInnerTexts()
  check('U10 관심 없음 → 그 후보가 후보 목록에서 사라짐 · "숨긴 주제 1"', !topicsNow.map((t) => t.trim()).includes(mutedTopic) && !compactNow.some((t) => t.includes(mutedTopic)) && ((await page.getByTestId('radar-muted-chip').innerText()) ?? '').includes('1'), { mutedTopic, topicsNow })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('U10 다시 열어도 숨긴 그대로(설정 저장)', !(await page.locator('[data-testid="radar-opp-topic"]').allInnerTexts()).map((t) => t.trim()).includes(mutedTopic))
  await page.getByTestId('radar-muted-chip').click()
  await page.waitForTimeout(200)
  check('U11 추천 기준 › 숨긴 주제에 그 후보 하나', (await page.getByTestId('radar-muted-row').count()) === 1 && ((await page.getByTestId('radar-muted-row').innerText()) ?? '').includes(mutedTopic.split(' × ')[0]))
  await page.getByTestId('radar-unmute').click()
  await page.waitForTimeout(600)
  check('U11 다시 보기 → 후보로 돌아온다 · 숨긴 주제 0', (await page.locator('[data-testid="radar-opp-topic"]').allInnerTexts()).map((t) => t.trim()).includes(mutedTopic) && (await page.getByTestId('radar-muted-chip').count()) === 0)
  await page.getByTestId('radar-mix').click()
  await page.waitForTimeout(200)

  // 시장 신호
  check('시장 신호: 급상승 주제 · 평소보다 터진 영상(🔥 평소보다 n배)', (await page.getByTestId('radar-rising-row').count()) >= 1 && (await page.getByTestId('radar-breakouts').getByTestId('radar-breakout-chip').count()) >= 1)
  check('시장 신호: 첫 화면에는 각 4개까지(나머지는 더 보기) · 후보보다 작은 제목', (await page.getByTestId('radar-rising-row').count()) <= 4 && (await page.getByTestId('radar-breakouts').getByTestId('radar-video-row').count()) <= 4 && (await page.locator('#radar-signals-h').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))) < (await page.locator('#radar-plan-h').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))))

  // 비중 가이드 — 시장 100 이면 앞 3장이 시장수요
  await page.getByTestId('radar-mix').click()
  const panel = page.getByTestId('radar-mix-panel')
  await panel.getByLabel('시장수요 비중').fill('100')
  await panel.getByLabel('AX · AI 비중').fill('0')
  await panel.getByLabel('BRIDGE 비중').fill('0')
  await panel.getByRole('button', { name: '적용' }).click()
  await page.waitForTimeout(400)
  const mAxes = await page.getByTestId('radar-top').getByTestId('radar-opp').evaluateAll((els) => els.map((e) => e.getAttribute('data-axis')))
  check('비중 가이드: 시장 100 · 나머지 0 → 앞 3장 시장수요(가이드는 바꿀 수 있다)', mAxes.length === 3 && mAxes.every((a) => a === 'market'), mAxes)
  await page.getByTestId('radar-mix').click()
  await page.getByTestId('radar-mix-panel').getByRole('button', { name: /기본값/ }).click()
  await page.getByTestId('radar-mix-panel').getByRole('button', { name: '적용' }).click()
  await page.waitForTimeout(300)

  // 채널 — 네 묶음 · 끄기 · 채널 추가(로컬은 안내)
  await page.getByTestId('yt-view-channels').click()
  await page.waitForTimeout(400)
  check('채널: 네 묶음(직접 경쟁 · AI 실무 · AX · 포맷) · 채널마다 묶음 고르기', ['direct', 'ai', 'ax', 'format'].every(() => true) && (await page.getByTestId('radar-group-direct').count()) === 1 && (await page.getByTestId('radar-group-ai').count()) === 1 && (await page.getByTestId('radar-group-ax').count()) === 1 && (await page.getByTestId('radar-group-format').count()) === 1 && (await page.locator('[data-testid="yt-channel-row"][data-group="ai"]').count()) === 2)
  for (const g of ['ai', 'ax']) {
    const rows = page.locator(`[data-testid="yt-channel-row"][data-group="${g}"]`)
    for (let k = 0; k < (await rows.count()); k += 1) await rows.nth(k).getByTestId('radar-ch-toggle').click()
  }
  await page.waitForTimeout(400)
  check('채널 끄기: 끈 채널은 "꺼 둠" 으로', (await page.locator('[data-testid="yt-channel-row"][data-enabled="0"]').count()) === 3)
  await page.getByTestId('yt-view-plan').click()
  await page.waitForTimeout(400)
  check('AI · AX 채널을 모두 끄면 "AI 벤치마킹 데이터가 부족합니다" · AX·AI 카드는 억지로 만들지 않는다', (await page.getByTestId('radar-ai-short').count()) === 1 && (await page.locator('[data-testid^="radar-opp"][data-axis="axai"]').count()) === 0)
  await page.getByTestId('yt-view-channels').click()
  await page.waitForTimeout(300)
  const offRows = page.locator('[data-testid="yt-channel-row"][data-enabled="0"]')
  while ((await offRows.count()) > 0) await offRows.first().getByTestId('radar-ch-toggle').click()
  await page.getByTestId('radar-add-channel').getByTestId('fold-toggle').click()
  await page.getByTestId('radar-add-input').fill('https://www.youtube.com/@someone')
  await page.getByTestId('radar-add-check').click()
  await page.waitForTimeout(400)
  check('채널 추가: 로컬(로그인 없음)에서는 안내만 · 서버에 묻지 않는다(할당량 0)', ((await page.getByTestId('radar-add-msg').innerText()) ?? '').includes('로그인') && !asked.some((u) => u.includes('resolve=') || u.includes('extra=')), asked.filter((u) => u.includes('resolve') || u.includes('extra')))

  // 분석 — 내 채널 · 제목 구조
  await page.getByTestId('yt-view-analysis').click()
  await page.waitForTimeout(400)
  check('분석: 내 채널(최근 20편) · "시청 지속시간 · 노출 클릭률은 YouTube Analytics 연결 예정"(어림하지 않음)', ((await page.getByTestId('radar-mine').innerText()) ?? '').includes('평소 조회수') && ((await page.getByTestId('radar-analytics-note').innerText()) ?? '').includes('YouTube Analytics 연결 예정'))
  check('분석: 이번 달 잘된 제목 구조(접힘 · 한 줄 요약)', (await page.getByTestId('radar-patterns').count()) === 1)

  // R13 · R14 — 번들 검사
  // 게이트는 시험 파일을 e2e/.gate/ 로 떠서 돌린다 — 번들은 저장소 맨 위(dist/)에서 찾는다
  const distDir = [join(process.cwd(), 'dist', 'assets'), fileURLToPath(new URL('../dist/assets/', import.meta.url))].find((d) => existsSync(d))
  const js = distDir ? readdirSync(distDir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(distDir, f), 'utf8')).join('\n') : ''
  check('번들 찾음(dist/assets)', js.length > 0, distDir)
  const LLM = ['api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com', 'chat/completions', '/v1/messages']
  check('R13 LLM 호출 0: 번들에 OpenAI · Claude · Gemini API 주소가 없다 · 화면이 바깥(유튜브 썸네일 말고)을 부르지 않는다', LLM.every((h) => !js.includes(h)) && outside.length === 0, [LLM.filter((h) => js.includes(h)), outside.slice(0, 3)])
  check('R14 유튜브 키 번들 0: 구글 API 키 모양(AIza…) 없음 · googleapis 유튜브 주소 없음(서버만 부름)', !/AIza[0-9A-Za-z_-]{35}/.test(js) && !js.includes('googleapis.com/youtube'))
  check('레이더: JS 오류 없음', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-197 경제 · 경영 · AI 집중 · 사이드 급상승 · 기본/내 추가 채널 ---------------- */
const nch = (id, title, subs, group, note) => ({ ...gch(id, title, subs, group), note })
const FOCUS = {
  fetchedAt: new Date(NOW - H).toISOString(),
  channels: [
    { ...gch('UCme', '김팀장의 경영노트', 8_000, 'direct', true), note: '내 채널 — 벤치마킹과 견줄 기준' },
    nch('UCd1', '정책 소식 채널', 30_000, 'direct', '정책자금 · 지원사업 소식 — 대표님 관심 주제'),
    nch('UCd2', '세무 이야기 채널', 120_000, 'direct', '절세 · 세금 신고 — 세금 주제 수요'),
    nch('UCd3', '경제 읽어주는 채널', 60_000, 'direct', '금리 · 경기 · 부동산 — 경제 흐름'),
    nch('UCa1', 'AI 실무 하나', 9_000, 'ai', 'Claude · ChatGPT 업무 활용 — 작은 채널'),
    nch('UCa2', 'AI 실무 둘', 40_000, 'ai', 'AI 도구 실무 후기 — 설명 방식'),
    nch('UCa3', 'AI 실무 셋', 20_000, 'ai', '새 AI 도구 빠른 후기'),
    nch('UCx1', '자동화 채널', 20_000, 'ax', '업무자동화 · 사내 시스템'),
    nch('UCf1', '대담 채널', 500_000, 'format', '전문가 인터뷰 · 대담 포맷 — 구성 참고'),
    nch('UCo1', '생활 채널', 100_000, 'direct', '생활 · 일상 — 포맷 참고'),
  ],
  videos: [
    ...base('UCme', 8, 300), ...base('UCd1', 8, 3_000), ...base('UCd2', 8, 12_000), ...base('UCd3', 8, 6_000), ...base('UCa1', 8, 900), ...base('UCa2', 8, 4_000), ...base('UCa3', 8, 2_000), ...base('UCx1', 8, 2_000), ...base('UCf1', 8, 50_000), ...base('UCo1', 8, 5_000),
    // 경제
    v('e1', 'UCd3', '금리 인하, 중소기업 대출 이자 얼마나 줄까', 4 * D, 20_000), v('e2', 'UCd1', '금리 오르면 정책자금 이자는?', 3 * D, 3_500), v('e3', 'UCd2', '금리 동결, 법인 대출 어떻게', 7 * D, 14_000),
    v('e4', 'UCd1', '환율 1500원, 수입 원가 이렇게 바뀝니다', 6 * D, 9_000), v('e5', 'UCd2', '사옥을 살까 임대할까', 5 * D, 30_000),
    // 경영
    v('b1', 'UCd1', '정책자금 신청 전에 꼭 볼 것', 5 * D, 9_000), v('b2', 'UCd2', '정책자금 떨어지는 회사 특징', 6 * D, 18_000), v('b3', 'UCd3', '정책자금 오픈런 마감 이유', 4 * D, 7_000), v('b4', 'UCd2', '법인세 절세 3가지', 8 * D, 50_000),
    // AI
    v('c1', 'UCa1', 'Claude로 보고서 10분 만에', 3 * D, 5_400), v('c2', 'UCa2', 'Claude 업무 활용 실제 후기', 5 * D, 8_000), v('c3', 'UCa3', '클로드 오퍼스 써보니', 4 * D, 4_000),
    v('g1', 'UCa1', 'ChatGPT 업무 자동화 해봤습니다', 9 * D, 1_000), v('g2', 'UCa2', '챗GPT로 견적서 만들기', 10 * D, 4_000),
    v('x1', 'UCa2', 'Codex로 사내 도구 만들기', 6 * D, 9_000), v('x2', 'UCa3', '코덱스 실무 후기', 8 * D, 3_000),
    // 새 AI 이름(분류표 밖) — AI · AX 채널 세 곳
    v('s1', 'UCa1', 'Spark 써보니 달라진 점', 2 * D, 900), v('s2', 'UCa2', 'Spark 로 회의 정리', 3 * D, 3_000), v('s3', 'UCx1', '새로 나온 Spark 후기', 4 * D, 1_500),
    // 기타 — 크게 터진 것(사이드) · 평범한 것(어디에도 없음)
    v('o1', 'UCo1', '다이어트 브이로그 30일 결과', 6 * D, 60_000), v('o2', 'UCd3', '다이어트 브이로그 2주 차', 5 * D, 6_000), v('o3', 'UCo1', '주말 캠핑 다녀왔습니다', 8 * D, 5_100),
    v('i1', 'UCf1', '앞으로 10년 이렇게 바뀝니다 (김교수 풀버전)', 7 * D, 500_000),
  ],
  failed: [],
}
const FJSON = JSON.stringify(FOCUS)

for (const vp of [{ width: 1440, height: 900, tag: 'PC' }, { width: 390, height: 844, tag: '390', mobile: true }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'ko-KR', ...(vp.mobile ? { isMobile: true, hasTouch: true } : {}) })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 404, body: '' }))
  await page.route('**/api/yt-bench**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: FJSON }))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  // D-227 시장 신호는 접힌 채 한 판씩 — 이 시험들은 예전처럼 다 펼친 모양([전부 보기] · 펼침 기억)을 본다. 처음 모양은 D-227 시험에서
  await page.evaluate(() => { localStorage.setItem('axmvp.fold.radar.signals', '1'); localStorage.setItem('axmvp.radar.board', 'all') })
  await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))
  await page.goto(BASE + '/marketing/youtube', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const T = vp.tag
  const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  const tops = await page.evaluate(() => ['radar-top', 'radar-signals', 'radar-side'].map((id) => Math.round((document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect().top ?? -1) + scrollY)))
  check(`F ${T} 첫 화면 순서: 이번 주 찍을 것 TOP → 경제 · 경영 · AI 시장 신호 → 사이드 급상승`, tops[0] >= 0 && tops[0] < tops[1] && tops[1] < tops[2] && ((await page.locator('#radar-signals-h').innerText()) ?? '').includes('경제 · 경영 · AI 시장 신호'), tops)
  const domainsOfCards = await page.locator('[data-testid="radar-opp"], [data-testid="radar-opp-compact"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-domain')))
  check(`F11 ${T} 후보 카드는 모두 경제 · 경영 · AI(기타 없음) · 다이어트 · 캠핑 카드 없음`, domainsOfCards.length >= 3 && domainsOfCards.every((d) => ['economy', 'business', 'ai'].includes(d)) && !/다이어트|캠핑/.test((await page.getByTestId('radar-plan').locator('[data-testid="radar-opp-topic"]').allInnerTexts()).join()), domainsOfCards)
  const dc = async (d) => Number((await page.getByTestId(`radar-domain-${d}`).getAttribute('data-count')) ?? -1)
  const econText = (await page.getByTestId('radar-domain-economy').innerText()) ?? ''
  check(`F1 · F2 ${T} 지금 강한 흐름: 경제(금리 → 중소기업 대출 · 정책자금 금리) · 경영(정책자금) · AI(Claude) 칸이 데이터로 채워짐`, (await dc('economy')) >= 1 && econText.includes('금리') && econText.includes('정책자금 금리') && (await dc('business')) >= 1 && ((await page.getByTestId('radar-domain-business').innerText()) ?? '').includes('정책자금') && (await dc('ai')) >= 1, econText.replace(/\n/g, ' | '))
  const kws = await page.getByTestId('radar-ai-kw').evaluateAll((els) => els.map((e) => e.getAttribute('data-kw')))
  const vendors = await page.getByTestId('radar-ai-vendor').evaluateAll((els) => els.map((e) => e.getAttribute('data-vendor')))
  const aiText = (await page.getByTestId('radar-ai-keywords').innerText()) ?? ''
  check(`F4 · F5 · F6 · F7 · F10 ${T} AI 핵심 키워드: Claude · ChatGPT · Codex 는 회사별로 따로 / 영상이 없는 Astra · Sol · Gemini 는 칸이 없다 · 점수 없음`, kws.includes('claude') && kws.includes('chatgpt') && kws.includes('codex') && kws.includes('opus') && !kws.includes('astra') && !kws.includes('sol') && !kws.includes('gemini') && vendors.join() === 'openai,anthropic' && !/\d+\s*점/.test(aiText) && aiText.includes('채널'), { kws, vendors })
  check(`F17 ${T} 새 AI 키워드 후보: Spark(AI · AX 3채널) — 저절로 넣지 않는다는 말`, ((await page.getByTestId('radar-ai-new').innerText()) ?? '').includes('Spark') && ((await page.getByTestId('radar-ai-new').innerText()) ?? '').includes('저절로 넣지 않습니다'))
  const sideTitles = (await page.getByTestId('radar-side-row').allInnerTexts()).join(' | ')
  check(`F12 · F14 ${T} 사이드 급상승: 다이어트(평소의 12배) · 전문가 인터뷰(10배 · "전문가 인터뷰" 꼬리표) · 포맷 참고 문장`, (await page.getByTestId('radar-side-row').count()) === 2 && sideTitles.includes('다이어트') && sideTitles.includes('풀버전') && (await page.locator('[data-testid="radar-side-format"][data-format="interview"]').count()) === 1 && (await page.getByTestId('radar-side-notes').count()) === 2, sideTitles)
  check(`F13 ${T} 평범한 기타 영상(캠핑)은 사이드 · 메인 신호 어디에도 없다 · Spark 영상도 사이드에 없음`, !sideTitles.includes('캠핑') && !sideTitles.includes('Spark') && !((await page.getByTestId('radar-signals').innerText()) ?? '').includes('캠핑'))
  const size = await page.evaluate(() => {
    const f = (s) => parseFloat(getComputedStyle(document.querySelector(s)).fontSize)
    const h = (s) => document.querySelector(s)?.getBoundingClientRect().height ?? 0
    return { plan: f('#radar-plan-h'), signals: f('#radar-signals-h'), side: f('#radar-side-h'), hero: h('[data-testid="radar-opp"][data-size="hero"]'), sideBox: h('[data-testid="radar-side"]') }
  })
  check(`${T} SIDE 가 TOP 보다 커 보이지 않는다: 제목 글자 TOP > 시장 신호 > 사이드 · 사이드 칸 높이 < 1순위 카드`, size.plan > size.signals && size.signals > size.side && size.sideBox < size.hero, size)
  // 왜 추천됐나요
  const hero = page.locator('[data-testid="radar-opp"][data-size="hero"]')
  await hero.getByTestId('radar-why-rec').click()
  await page.waitForTimeout(200)
  const whyItems = await hero.getByTestId('radar-why-item').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-id')}:${e.getAttribute('data-met')}`))
  check(`${T} [왜 추천됐나요?] → 다섯 가지 맞음/아님(여러 채널 · 평소보다 잘됨 · 늘어남 · 작은 채널 · 경제·경영·AI) · 점수 없음`, whyItems.length === 5 && whyItems[4] === 'domain:1' && !/\d+\s*점/.test((await hero.getByTestId('radar-why-panel').innerText()) ?? ''), whyItems)
  await hero.getByTestId('radar-why-rec').click()
  await page.getByTestId('radar-mix').click()
  await page.waitForTimeout(200)
  const crit = (await page.getByTestId('radar-criteria-list').innerText()) ?? ''
  check(`${T} 추천 기준: 여러 채널 반복 · 평소보다 잘됨 · 늘어남 · 작은 채널 · 경제·경영·AI — 점수 없음`, ['최근 여러 채널에서 반복', '채널 평소보다 잘됨', '최근 2주에 늘어남', '작은 채널에서도 터짐', '경제 · 경영 · AI 주제', '점수를 매기지 않습니다'].every((w) => crit.includes(w)), crit.slice(0, 200))
  await page.getByTestId('radar-mix').click()
  // 사이드 영상 상세 — [기본 벤치마킹] · 영역 · 형식
  await page.getByTestId('radar-side-row').filter({ hasText: '풀버전' }).locator('button').click()
  await page.waitForTimeout(300)
  check(`F15 ${T} 영상 상세: [기본 벤치마킹] 표시 · 영역 · 기타 · 형식 · 전문가 인터뷰`, ((await page.getByTestId('radar-detail-source').innerText()) ?? '').includes('기본 벤치마킹') && (await page.getByTestId('radar-detail-source').getAttribute('data-added')) === '0' && ((await page.getByTestId('radar-detail-tags').innerText()) ?? '').includes('영역 · 기타') && ((await page.getByTestId('radar-detail-tags').innerText()) ?? '').includes('형식 · 전문가 인터뷰'))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  check(`${T} 첫 화면 넘침 0`, (await over()) <= 0, await over())
  // 채널 — 기본 벤치마킹(왜 보나) · 내가 추가한 채널
  await page.getByTestId('yt-view-channels').click()
  await page.waitForTimeout(400)
  check(`F16 ${T} 채널: "기본 벤치마킹 채널" 10곳(내 채널 포함) · 채널마다 "왜 보나" 한 줄 · "내가 추가한 채널" 0곳(빈 안내)`, (await page.getByTestId('radar-default-channels').getAttribute('data-count')) === '10' && (await page.getByTestId('radar-ch-note').count()) === 10 && (await page.getByTestId('radar-added-channels').getAttribute('data-count')) === '0' && (await page.getByTestId('radar-added-empty').isVisible()) && (await page.locator('[data-testid="yt-channel-row"][data-source="default"]').count()) === 10)
  check(`${T} 채널 화면 넘침 0`, (await over()) <= 0, await over())
  // 인기 탭 — 핵심 키워드 / 기타 급상승
  await page.getByTestId('yt-view-top').click()
  await page.waitForTimeout(400)
  const core = await page.getByTestId('yt-keyword').allInnerTexts()
  const other = await page.getByTestId('yt-keyword-other').allInnerTexts()
  check(`${T} 인기 탭: 핵심 키워드(정책자금 · 클로드 …)와 기타 급상승(다이어트 …)이 나뉜다`, core.some((k) => /정책자금|클로드|금리/.test(k)) && !core.some((k) => /다이어트|브이로그/.test(k)) && other.some((k) => /다이어트|브이로그/.test(k)), { core, other })
  check(`${T} 인기 탭 넘침 0 · JS 오류 0`, (await over()) <= 0 && errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-198 숫자 뒤 영상 목록 — PC 마우스 올리면 목록 · 누르면 고정 / 휴대폰 누르면 창 ---------------- */
{
  const lastNum = (t) => {
    const hot = t.match(/터진 영상 (\d+)/)
    if (hot) return Number(hot[1])
    const ps = [...t.matchAll(/(\d+)편/g)]
    return ps.length ? Number(ps[ps.length - 1][1]) : null
  }
  for (const vp of [{ width: 1440, height: 900, tag: 'PC' }, { width: 390, height: 844, tag: '390', mobile: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'ko-KR', ...(vp.mobile ? { isMobile: true, hasTouch: true } : {}) })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 404, body: '' }))
    await page.route('**/api/yt-bench**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: FJSON }))
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await page.evaluate(seedScript())
    // D-227 시장 신호는 접힌 채 한 판씩 — 이 시험들은 예전처럼 다 펼친 모양([전부 보기] · 펼침 기억)을 본다. 처음 모양은 D-227 시험에서
    await page.evaluate(() => { localStorage.setItem('axmvp.fold.radar.signals', '1'); localStorage.setItem('axmvp.radar.board', 'all') })
    await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))
    await page.goto(BASE + '/marketing/youtube', { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    const T = vp.tag
    const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    // 숫자가 쓰인 곳마다 목록이 붙었나 — 글 속 숫자(…편 · 터진 영상 n) = 목록 길이
    const peeks = await page.getByTestId('radar-plan').getByTestId('radar-peek').evaluateAll((els) => els.map((e) => ({ kind: e.getAttribute('data-kind'), n: Number(e.getAttribute('data-count')), text: e.textContent ?? '', h: e.getBoundingClientRect().height })))
    const kinds = new Set(peeks.map((x) => x.kind))
    const mismatch = peeks.filter((x) => lastNum(x.text) !== null && lastNum(x.text) !== x.n)
    check(`D198 ${T} 숫자마다 영상 목록이 붙었다(후보 근거 · 지금 강한 흐름 · AI 키워드 · 터진 영상 · 업무 흐름 · 새 키워드 · 급상승) · 글 속 숫자 = 목록 길이`, ['fact', 'domain', 'domain-hot', 'ai-kw', 'ai-kw-hot', 'ai-new', 'rising', 'rising-hot'].every((k) => kinds.has(k)) && ((await page.getByTestId('radar-ai-flow').count()) === 0 || kinds.has('ai-flow')) && peeks.every((x) => x.n > 0) && mismatch.length === 0, { kinds: [...kinds], mismatch: mismatch.slice(0, 4) })
    const claude = page.locator('[data-testid="radar-ai-kw"][data-kw="claude"] [data-testid="radar-peek"][data-kind="ai-kw"]')
    const claudeText = (await claude.innerText()) ?? ''
    const [cCh, cVid] = (claudeText.match(/(\d+)개 채널 · (\d+)편/) ?? []).slice(1).map(Number)
    if (!vp.mobile) {
      // 마우스 올리기 → 떠 있는 목록
      await claude.scrollIntoViewIfNeeded()
      await claude.hover()
      await page.waitForTimeout(400)
      const panel = page.getByTestId('radar-peek-panel')
      const rows = await panel.getByTestId('radar-peek-row').count()
      const basis = (await panel.getByTestId('radar-peek-basis').innerText()) ?? ''
      const titles = (await panel.getByTestId('radar-peek-row').allInnerTexts()).join(' | ')
      check(`D198 ${T} AI 키워드 'Claude ${cCh}개 채널 · ${cVid}편' 에 마우스를 올리면 그 영상 ${cVid}편이 바로 뜬다(채널 ${cCh}곳 · 제목에 Claude/클로드)`, (await panel.getAttribute('data-mode')) === 'hover' && rows === cVid && basis.includes(`채널 ${cCh}곳`) && basis.includes(`영상 ${cVid}편`) && (await panel.getByTestId('radar-peek-row').evaluateAll((els) => els.every((e) => /claude|클로드/i.test(e.textContent ?? '')))), { rows, basis, titles: titles.slice(0, 160) })
      const box = await panel.boundingBox()
      check(`D198 ${T} 떠 있는 목록이 화면 안에(잘리지 않음)`, !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width && box.y + box.height <= vp.height, box)
      // 목록 위로 마우스를 옮겨도 닫히지 않는다 → 밖으로 빼면 닫힌다
      await panel.getByTestId('radar-peek-row').first().hover()
      await page.waitForTimeout(300)
      const stay = await page.getByTestId('radar-peek-panel').count()
      await page.mouse.move(5, 450)
      await page.waitForTimeout(450)
      check(`D198 ${T} 목록으로 마우스를 옮겨도 그대로 · 밖으로 빼면 닫힘`, stay === 1 && (await page.getByTestId('radar-peek-panel').count()) === 0)
      // 터진 영상 배지 — 터진 것만
      const hotBadge = page.locator('[data-testid="radar-peek"][data-kind="domain-hot"]').first()
      const hotN = lastNum((await hotBadge.innerText()) ?? '')
      await hotBadge.hover()
      await page.waitForTimeout(400)
      const hotRows = await page.getByTestId('radar-peek-panel').getByTestId('radar-peek-row').count()
      const hotChips = await page.getByTestId('radar-peek-panel').getByTestId('radar-breakout-chip').count()
      check(`D198 ${T} '터진 영상 ${hotN}' 에 올리면 터진 영상 ${hotN}편만(모두 🔥 평소보다 n배)`, hotN !== null && hotRows === hotN && hotChips === hotN, { hotN, hotRows, hotChips })
      await page.mouse.move(5, 450)
      await page.waitForTimeout(400)
      // 누르면 고정 — 마우스를 빼도 남고, Esc · 바깥 · 닫기로 닫힘
      const fact = page.locator('[data-testid="radar-opp"][data-size="hero"] [data-testid="radar-peek"][data-kind="fact"]').first()
      await fact.click()
      await page.mouse.move(5, 450)
      await page.waitForTimeout(450)
      const pinned = page.getByTestId('radar-peek-panel')
      check(`D198 ${T} 숫자를 누르면 목록이 고정(마우스를 빼도 남음) · 닫기 단추`, (await pinned.count()) === 1 && (await pinned.getAttribute('data-mode')) === 'pinned' && (await page.getByTestId('radar-peek-close').count()) === 1 && Number(await pinned.getAttribute('data-count')) === Number(await fact.getAttribute('data-count')))
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
      const escClosed = (await page.getByTestId('radar-peek-panel').count()) === 0
      await fact.click()
      await page.waitForTimeout(200)
      await page.mouse.click(5, 450)
      await page.waitForTimeout(200)
      check(`D198 ${T} Esc · 바깥을 누르면 고정 목록이 닫힌다`, escClosed && (await page.getByTestId('radar-peek-panel').count()) === 0)
      // 목록의 영상을 누르면 영상 상세
      await claude.click()
      await page.waitForTimeout(250)
      const firstTitle = ((await page.getByTestId('radar-peek-panel').getByTestId('radar-peek-row').first().getAttribute('aria-label')) ?? '').replace(/ — 자세히$/, '')
      await page.getByTestId('radar-peek-panel').getByTestId('radar-peek-row').first().click()
      await page.waitForTimeout(300)
      check(`D198 ${T} 목록의 영상을 누르면 그 영상 상세 창(목록은 닫힘)`, (await page.getByTestId('radar-video-detail').isVisible()) && ((await page.getByTestId('radar-video-detail').innerText()) ?? '').includes(firstTitle) && (await page.getByTestId('radar-peek-panel').count()) === 0, firstTitle)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
      // [근거 보기] 안 숫자도
      await page.locator('[data-testid="radar-opp"][data-size="hero"]').getByTestId('radar-opp-more').click()
      await page.waitForTimeout(200)
      const ev = page.locator('[data-testid="radar-opp"][data-size="hero"] [data-testid="radar-evidence"] [data-testid="radar-peek"][data-kind="related"]')
      const evN = lastNum((await ev.innerText()) ?? '')
      await ev.hover()
      await page.waitForTimeout(400)
      check(`D198 ${T} [근거 보기] '관련 영상 ${evN}편(30일)' 에 올리면 ${evN}편`, evN !== null && (await page.getByTestId('radar-peek-panel').getByTestId('radar-peek-row').count()) === evN)
      await page.mouse.move(5, 450)
      await page.waitForTimeout(400)
    } else {
      // 휴대폰 — 누르면 창(떠 있는 목록 대신) · 영상 누르면 상세
      check(`D198 ${T} 숫자 단추는 손가락으로 누를 만큼(44px)`, peeks.every((x) => x.h >= 43.5), peeks.filter((x) => x.h < 43.5).slice(0, 4))
      await claude.scrollIntoViewIfNeeded()
      await claude.tap()
      await page.waitForTimeout(400)
      const sheet = page.getByTestId('radar-peek-sheet')
      const rows = await sheet.getByTestId('radar-peek-row').count()
      check(`D198 ${T} AI 키워드 'Claude ${cCh}개 채널 · ${cVid}편' 을 누르면 영상 ${cVid}편 창 · 떠 있는 목록은 없음`, (await sheet.isVisible()) && rows === cVid && (await page.getByTestId('radar-peek-panel').count()) === 0 && ((await sheet.getByTestId('radar-peek-basis').innerText()) ?? '').includes(`채널 ${cCh}곳`), { rows, cVid })
      check(`D198 ${T} 영상 목록 창이 열려도 가로 넘침 0`, (await over()) <= 0, await over())
      await sheet.getByTestId('radar-peek-row').first().tap()
      await page.waitForTimeout(400)
      check(`D198 ${T} 창의 영상을 누르면 영상 상세(목록 창은 닫힘)`, (await page.getByTestId('radar-video-detail').isVisible()) && (await page.getByTestId('radar-peek-sheet').count()) === 0)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
    }
    // 분석 탭 '단어로 본 주목 주제' 도
    await page.getByTestId('yt-view-analysis').click()
    await page.waitForTimeout(400)
    if ((await page.getByTestId('yt-ideas').getAttribute('data-open')) !== '1') await page.getByTestId('yt-ideas').getByTestId('fold-toggle').click()
    await page.waitForTimeout(300)
    const tp = page.locator('[data-testid="yt-topic"] [data-testid="radar-peek"][data-kind="topic"]').first()
    if ((await tp.count()) > 0) {
      const tCh = Number(((await tp.innerText()) ?? '').match(/(\d+)개 채널/)?.[1] ?? -1)
      if (vp.mobile) await tp.tap()
      else await tp.click()
      await page.waitForTimeout(350)
      const host = vp.mobile ? page.getByTestId('radar-peek-sheet') : page.getByTestId('radar-peek-panel')
      check(`D198 ${T} 분석 탭 주목 주제 'n개 채널' 도 그 영상 목록(채널 수 맞음)`, ((await host.getByTestId('radar-peek-basis').innerText()) ?? '').includes(`채널 ${tCh}곳`) && (await host.getByTestId('radar-peek-row').count()) === Number(await tp.getAttribute('data-count')), tCh)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
    } else check(`D198 ${T} 분석 탭 주목 주제(예시 피드에 주제가 있다)`, false)
    check(`D198 ${T} 넘침 0 · JS 오류 0`, (await over()) <= 0 && errors.length === 0, errors.join(' | '))
    await ctx.close()
  }
}

/* ---------------- 휴대폰 360 · 390 · 430 ---------------- */
for (const width of [360, 390, 430]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 404, body: '' }))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  // D-227 시장 신호는 접힌 채 한 판씩 — 이 시험들은 예전처럼 다 펼친 모양([전부 보기] · 펼침 기억)을 본다. 처음 모양은 D-227 시험에서
  await page.evaluate(() => { localStorage.setItem('axmvp.fold.radar.signals', '1'); localStorage.setItem('axmvp.radar.board', 'all') })
  await page.goto(BASE + '/marketing/youtube', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const over = async () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (width === 390) {
    await page.getByTestId('yt-sample').tap()
    await page.waitForTimeout(500)
    check(`${width} 예시 데이터: 후보 카드 · 넘침 0`, (await page.getByTestId('radar-opp').count()) >= 1 && (await over()) <= 0, await over())
  }
  await page.route('**/api/yt-bench**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: RJSON }))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const order = await page.evaluate(() => {
    const a = document.querySelector('[data-testid="radar-opp"]')?.getBoundingClientRect().top ?? 1e9
    const b = document.querySelector('[data-testid="radar-signals"]')?.getBoundingClientRect().top ?? 0
    return a < b
  })
  check(`${width} 이번 주 찍을 것: 후보 카드가 먼저(이유 → 관련 영상) · 넘침 0`, order && (await over()) <= 0, await over())
  await page.getByTestId('radar-opp-more').first().tap()
  await page.waitForTimeout(200)
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('main button, main a, main select, main input')]
      .filter((e) => e.offsetParent)
      .map((e) => ({ t: (e.innerText || e.getAttribute('aria-label') || e.tagName).slice(0, 24), r: e.getBoundingClientRect() }))
      .filter((x) => x.r.height < 44 || x.r.width < 44)
      .map((x) => `${x.t}(${Math.round(x.r.width)}×${Math.round(x.r.height)})`),
  )
  check(`${width} 누르는 곳 44px 이상(후보 · 펼친 카드 · 신호 · 수첩)`, small.length === 0, small.slice(0, 6).join(' · '))
  check(`${width} 펼친 카드 넘침 0`, (await over()) <= 0, await over())
  await page.getByTestId('radar-bench-thumb').first().tap()
  await page.waitForTimeout(300)
  check(`${width} 영상 상세 창 넘침 0`, (await page.getByTestId('radar-video-detail').isVisible()) && (await over()) <= 0, await over())
  await page.keyboard.press('Escape')
  await page.getByTestId('yt-view-top').tap()
  await page.waitForTimeout(300)
  const list = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-testid="yt-card"]')].slice(0, 2).map((e) => e.getBoundingClientRect())
    const thumb = document.querySelector('[data-testid="yt-card-thumb"]')?.getBoundingClientRect()
    return cards.length === 2 && cards[1].top > cards[0].top && !!thumb && thumb.width < window.innerWidth * 0.5
  })
  check(`${width} 인기 영상: 휴대폰은 한 줄 목록(썸네일 왼쪽 · PC 카드를 줄이지 않음) · 넘침 0`, list && (await over()) <= 0, await over())
  for (const k of ['channels', 'analysis']) {
    await page.getByTestId(`yt-view-${k}`).tap()
    await page.waitForTimeout(300)
    check(`${width} ${k}: 넘침 0`, (await over()) <= 0, await over())
  }
  check(`${width}: JS 오류 없음`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-196 6시간 자동 갱신 · 채널 구성 판 · PC/휴대폰 같은 추천 ---------------- */
{
  const REV_NEW = '2-33-newrev'
  const REV_OLD = '2-18-oldrev'
  const H6 = 6 * H
  const KEY = 'axmvp.yt.feed.v1'
  // Production PC 에 남아 있던 것 흉내 — 예전 18채널 데이터
  const OLD18 = (at) => ({
    fetchedAt: new Date(at).toISOString(),
    channels: Array.from({ length: 18 }, (_, i) => ch(`UCold${String(i).padStart(2, '0')}`, `예전 채널 ${i + 1}`, 10_000, 1_000_000)),
    videos: [v('o1', 'UCold00', '예전 정책자금 영상', 2 * D, 9_000), v('o2', 'UCold01', '예전 정책자금 사례', 3 * D, 4_000), v('o3', 'UCold02', '예전 정책자금 신청', 4 * D, 3_000)],
    failed: [],
  })
  /** 서버 흉내 — status 는 지금 판(유튜브 안 부름) · 데이터는 RADAR + 판 · 판이 다르면 409(실제 서버와 같은 규칙) */
  const serve = async (page, o) => {
    const log = []
    await page.route('**/api/yt-bench**', (r) => {
      const u = new URL(r.request().url())
      log.push(u.search)
      if (u.searchParams.has('status')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true, keyName: 'YOUTUBE_API_KEY', channels: 33, feedRevision: REV_NEW }) })
      if (o.fail) return r.fulfill({ status: 504, contentType: 'application/json', body: JSON.stringify({ error: 'timeout' }) })
      const rev = u.searchParams.get('rev')
      if (rev && rev !== REV_NEW) return r.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'revision', feedRevision: REV_NEW }) })
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...RADAR, fetchedAt: new Date(Date.now() - (o.lag ?? 0)).toISOString(), feedRevision: REV_NEW }) })
    })
    return log
  }
  const dataAsks = (log) => log.filter((q) => !q.includes('status=1'))
  const open = async (vp, mobile, cache, o = {}) => {
    const ctx = await browser.newContext({ viewport: vp, locale: 'ko-KR', ...(mobile ? { isMobile: true, hasTouch: true } : {}) })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 404, body: '' }))
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await page.evaluate(seedScript())
    // D-227 시장 신호는 접힌 채 한 판씩 — 이 시험들은 예전처럼 다 펼친 모양([전부 보기] · 펼침 기억)을 본다. 처음 모양은 D-227 시험에서
    await page.evaluate(() => { localStorage.setItem('axmvp.fold.radar.signals', '1'); localStorage.setItem('axmvp.radar.board', 'all') })
    await page.evaluate(([k, val]) => (val ? localStorage.setItem(k, val) : localStorage.removeItem(k)), [KEY, cache ? JSON.stringify(cache) : ''])
    const log = await serve(page, o)
    await page.goto(BASE + '/marketing/youtube', { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    return { ctx, page, errors, log }
  }
  const line = async (page) => ((await page.getByTestId('yt-feedline').innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ')
  const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY)
  const RN = RADAR.channels.length

  // 1~3 같은 날 18채널 예전 저장본(예전 모양 { slot, feed }) · 서버는 새 판 → 열자마자 새 데이터
  {
    const at = Date.now() - H
    const { ctx, page, errors, log } = await open({ width: 1440, height: 900 }, false, { slot: new Date().toISOString().slice(0, 10), feed: OLD18(at) })
    const s = await stored(page)
    const l = await line(page)
    check(`D-196 1~3 같은 날 18채널 예전 저장본 + 서버 판(33채널) → 열자마자 새로 받음 → "채널 ${RN}곳"(18곳 아님) · 저장본 { 받은 때 · 판 · 데이터 }`, l.includes(`채널 ${RN}곳`) && !l.includes('채널 18곳') && s?.feedRevision === REV_NEW && typeof s?.fetchedAt === 'number' && s?.feed?.channels?.length === RN, [l, log])
    check('D-196 1~3 묻는 순서: 판 확인(status · 할당량 0) → 6시간 칸 + 판(?win=…&rev=…) 한 번', log[0] === '?status=1' && dataAsks(log).length === 1 && new RegExp(`^\\?win=\\d+&rev=${REV_NEW}$`).test(dataAsks(log)[0]), log)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    check('D-196 새로고침 → 방금 받은 것(6시간 안 · 판 같음) 그대로 · 데이터 요청 늘지 않음', dataAsks(log).length === 1 && (await line(page)).includes(`채널 ${RN}곳`), log)
    // 9 [지금 새로 가져오기] — 6시간 안이어도 30분 칸
    await page.getByTestId('yt-refresh').click()
    await page.waitForTimeout(800)
    check('D-196 9 [지금 새로 가져오기] → 6시간과 상관없이 30분 칸(?bucket=…&rev=…)', dataAsks(log).length === 2 && new RegExp(`^\\?bucket=\\d+&rev=${REV_NEW}$`).test(dataAsks(log)[1]), log)
    check('D-196 1~3 · 9 JS 오류 없음', errors.length === 0, errors.join(' | '))
    await ctx.close()
  }

  // 4 5시간 59분 → 그대로
  {
    const at = Date.now() - H6 + 60_000
    const { ctx, page, log } = await open({ width: 1440, height: 900 }, false, { fetchedAt: at, feedRevision: REV_NEW, feed: { ...RADAR, fetchedAt: new Date(at).toISOString() } })
    check('D-196 4 5시간 59분 된 저장본(판 같음) → 그대로 씀 · 데이터 요청 0(판 확인만)', dataAsks(log).length === 0 && log.length === 1 && (await page.getByTestId('radar-plan').count()) === 1, log)
    await ctx.close()
  }
  // 5 6시간 넘음 → 새로
  {
    const at = Date.now() - H6 - 60_000
    const { ctx, page, log } = await open({ width: 1440, height: 900 }, false, { fetchedAt: at, feedRevision: REV_NEW, feed: OLD18(at) })
    check('D-196 5 6시간 1분 된 저장본 → 열자마자 새로 받음', dataAsks(log).length === 1 && (await line(page)).includes(`채널 ${RN}곳`), log)
    await ctx.close()
  }
  // 7 판이 바뀜 → 1시간 전 것이어도 새로
  {
    const at = Date.now() - H
    const { ctx, page, log } = await open({ width: 1440, height: 900 }, false, { fetchedAt: at, feedRevision: REV_OLD, feed: OLD18(at) })
    check('D-196 7 판이 바뀜(예전 판 저장본 · 1시간 전) → 바로 새로 받음', dataAsks(log).length === 1 && (await line(page)).includes(`채널 ${RN}곳`), log)
    await ctx.close()
  }
  // 10 저절로 받기 실패 → 지난번 것 + 받은 때
  {
    const at = Date.now() - H6 - H
    const { ctx, page, log, errors } = await open({ width: 1440, height: 900 }, false, { fetchedAt: at, feedRevision: REV_NEW, feed: OLD18(at) }, { fail: true })
    const msg = (await page.getByTestId('yt-message').innerText().catch(() => '')) ?? ''
    const l = await line(page)
    check('D-196 10 6시간 넘었는데 받기 실패 → 빈 화면 아님: 지난번 데이터(채널 18곳) 그대로 · "지난번 받은 데이터로 보여드리고 있습니다." · 받은 때', dataAsks(log).length === 1 && l.includes('채널 18곳') && (await page.getByTestId('yt-views').count()) === 1 && msg.includes('지난번 받은 데이터로 보여드리고 있습니다.') && msg.includes('받은 때'), [msg, l])
    check('D-196 10 실패해도 JS 오류 없음', errors.length === 0, errors.join(' | '))
    await ctx.close()
  }
  // 6 열어 둔 채로 6시간이 지남 → 돌아오면 새로(PC focus · 휴대폰 visibilitychange)
  for (const [label, vp, mobile, evt] of [
    ['PC focus', { width: 1440, height: 900 }, false, 'focus'],
    ['휴대폰 390 visibilitychange', { width: 390, height: 844 }, true, 'visibilitychange'],
  ]) {
    const o = { lag: H6 - 5_000 }
    const { ctx, page, log } = await open(vp, mobile, null, o)
    const fire = () => page.evaluate((e) => (e === 'focus' ? window : document).dispatchEvent(new Event(e)), evt)
    const first = dataAsks(log).length
    o.lag = 0
    await fire()
    await page.waitForTimeout(400)
    const early = dataAsks(log).length
    await page.waitForTimeout(5_500)
    await fire()
    await page.waitForTimeout(800)
    check(`D-196 6 ${label}: 열어 둔 채로 6시간이 지나면 돌아올 때 새로 받음(열 때 1 · 6시간 전에 돌아옴 1 그대로 · 지난 뒤 돌아옴 2)`, first === 1 && early === 1 && dataAsks(log).length === 2, log)
    await fire()
    await fire()
    await page.waitForTimeout(600)
    check(`D-196 6 ${label}: 곧바로 여러 번 돌아와도 더 받지 않음 · 판 확인도 10분에 한 번(시계로 계속 묻지 않음)`, dataAsks(log).length === 2 && log.filter((q) => q === '?status=1').length === 1, log)
    await ctx.close()
  }

  // 11 PC 1440 = PC 휴대폰 폭(390) = 휴대폰 390 — 같은 데이터 · 같은 설정이면 같은 추천
  const picks = async (page) => {
    if (await page.getByTestId('radar-more').count()) await page.getByTestId('radar-more').click()
    await page.waitForTimeout(200)
    return page.evaluate(() => {
      const t = (sel) => [...document.querySelectorAll(sel)].map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim())
      return {
        top: t('[data-testid="radar-top"] [data-testid="radar-opp-topic"]'),
        axes: [...document.querySelectorAll('[data-testid="radar-opp"], [data-testid="radar-opp-compact"]')].map((e) => e.getAttribute('data-axis')),
        rest: t('[data-testid="radar-opp-compact"]'),
        rising: t('[data-testid="radar-rising-row"]'),
        breakouts: t('[data-testid="radar-breakouts"] [data-testid="radar-breakout-chip"]'),
      }
    })
  }
  const seen = []
  for (const [vp, mobile] of [
    [{ width: 1440, height: 900 }, false],
    [{ width: 390, height: 844 }, false],
    [{ width: 390, height: 844 }, true],
  ]) {
    const { ctx, page } = await open(vp, mobile, null)
    seen.push(await picks(page))
    await ctx.close()
  }
  const same = seen.every((x) => JSON.stringify(x) === JSON.stringify(seen[0]))
  check('D-196 11 같은 데이터 · 같은 설정 → PC 1440 · PC 를 휴대폰 폭(390)으로 · 휴대폰 390 의 1~3순위 · 4위부터 · 축 · 급상승 · 터진 영상이 모두 같다(화면 폭은 배치만)', same && seen[0].top.length === 3 && seen[0].rest.length >= 2 && seen[0].rising.length >= 1 && seen[0].breakouts.length >= 1, same ? seen[0].top : seen.map((x) => x.top))
}

// D-227 — 대표 "한 페이지에 너무 많으면 역효과 · 길을 잃지 않게 · 펼치기/접어두기 · 토스처럼 다음 단계". 처음 연 모양(시드의 '모두 펼치기' 없음)
for (const vp of [{ width: 1440, height: 900, tag: 'PC' }, { width: 390, height: 844, tag: '390', mobile: true }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'ko-KR', ...(vp.mobile ? { isMobile: true, hasTouch: true } : {}) })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 404, body: '' }))
  await page.route('**/api/yt-bench**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: FJSON }))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))
  await page.goto(BASE + '/marketing/youtube', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const T = vp.tag
  const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  const steps = page.getByTestId('radar-steps')
  check(`D227-1 ${T} 길잡이 — 단계 3개(주제 고르기 → 이번 주로 확정 → 찍고 올리기) · 지금 1단계 · '지금 할 일' 한 줄`, (await steps.locator('li').count()) === 3 && (await steps.getAttribute('data-current')) === 'pick' && /지금 할 일/.test(await page.getByTestId('radar-guide-next').innerText()))
  const fold = page.getByTestId('radar-signals-fold')
  const sum = (await page.getByTestId('radar-signals-summary').innerText()).replace(/\s+/g, ' ')
  check(`D227-2 ${T} 시장 신호는 처음에 접혀 있고(판 0개) 한 줄 요약(가장 센 흐름 · 흐름 · AI 키워드 · 급상승 · 터진 영상 · 사이드)만`, (await fold.getAttribute('data-open')) === '0' && (await page.getByTestId('radar-board-pick').count()) === 0 && /가장 센 흐름/.test(sum) && /흐름 \d+/.test(sum) && /AI 키워드 \d+/.test(sum) && /급상승 \d+/.test(sum) && /터진 영상 \d+/.test(sum) && /사이드 \d+/.test(sum), sum)
  await fold.getByTestId('fold-toggle').click()
  const boards = page.getByTestId('radar-board-pick').getByTestId('mk-pick')
  const keys = await boards.evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
  const n = async () => ({ flow: await page.getByTestId('radar-domain-economy').count(), ai: await page.getByTestId('radar-ai-keywords').count(), hot: await page.getByTestId('radar-rising').count(), side: await page.getByTestId('radar-side').count() })
  const first = await n()
  check(`D227-3 ${T} 펼치면 판 고르기 5칸(흐름 · AI · 급상승 · 사이드 · 전부) · 처음엔 '지금 강한 흐름' 한 판만`, keys.join() === 'flow,ai,hot,side,all' && first.flow === 1 && first.ai + first.hot + first.side === 0, { keys, first })
  await page.locator('[data-testid="radar-board-pick"] [data-key="ai"]').click()
  const ai = await n()
  await page.locator('[data-testid="radar-board-pick"] [data-key="hot"]').click()
  const hot = await n()
  const hotBreak = await page.getByTestId('radar-breakouts').count()
  await page.locator('[data-testid="radar-board-pick"] [data-key="side"]').click()
  const side = await n()
  check(`D227-4 ${T} 판을 누르면 그 판만(AI → 급상승 · 터진 영상 → 사이드)`, ai.ai === 1 && ai.flow + ai.hot + ai.side === 0 && hot.hot === 1 && hotBreak === 1 && hot.flow + hot.ai + hot.side === 0 && side.side === 1 && side.flow + side.ai + side.hot === 0, { ai, hot, side })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const back = await n()
  check(`D227-5 ${T} 새로고침해도 펼침 · 고른 판(사이드) 기억`, (await page.getByTestId('radar-signals-fold').getAttribute('data-open')) === '1' && back.side === 1 && back.flow + back.ai + back.hot === 0, back)
  await page.locator('[data-testid="radar-board-pick"] [data-key="all"]').click()
  const all = await n()
  const order = await page.evaluate(() => ['radar-domain-economy', 'radar-ai-keywords', 'radar-rising', 'radar-side'].map((id) => Math.round(document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect().top ?? -1)))
  check(`D227-6 ${T} [전부 보기] — 예전처럼 네 판이 한 화면에(흐름 → AI → 급상승 → 사이드 순) · 지운 기능 0`, all.flow === 1 && all.ai === 1 && all.hot === 1 && all.side === 1 && order.every((y, i) => i === 0 || y > order[i - 1]), { all, order })
  const tabs = await page.locator('[data-testid^="yt-view-"]').evaluateAll((els) => els.map((e) => ({ k: e.dataset.testid, svg: e.querySelectorAll('svg').length, on: e.getAttribute('aria-selected') === 'true', img: getComputedStyle(e).backgroundImage })))
  check(`D227-7 ${T} 화면 탭 5개(D-231 내 콘텐츠 더함) 모두 아이콘 · 고른 탭은 빨강 그라데이션`, tabs.length === 5 && tabs.every((t) => t.svg >= 1) && tabs.filter((t) => t.on).length === 1 && /gradient/.test(tabs.find((t) => t.on)?.img ?? ''), tabs)
  const pickH = await boards.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
  const labelW = await page.locator('[data-testid="radar-board-pick"] [data-testid="mk-pick"] .t-body').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)))
  check(`D227-8 ${T} 판 칸 44px 이상 · 이름 칸 짜부라짐 0(폭 ≥ 90) · 가로 넘침 0 · 오류 0`, pickH.every((h) => h >= 44) && labelW.every((w) => w >= 90) && (await over()) <= 0 && errs.length === 0, { pickH, labelW, over: await over(), errs })
  await ctx.close()
}

// D-231 — 대표 "미래AI랩 관점 강조 · 어떤 제목 · 어떤 내용으로 찍을지 예시까지 한 번에 · 몇 분 안에 판단 · 만든 것 / 만들 것 일정 · 체크리스트 ·
// 홍보 글과 연동 · 마케팅 브랜딩을 누르면 바로 레이더, 홍보 글 · 홈페이지도 같은 목차". 스크린샷: SHOTS231=<폴더>
const SHOT231 = process.env.SHOTS231 || ''
for (const vp of [{ width: 1440, height: 900, tag: 'PC' }, { width: 390, height: 844, tag: '390', mobile: true }, { width: 360, height: 780, tag: '360', mobile: true }]) {
  // 한국 시각으로 — '오늘' 은 브라우저 지역 날짜(appClock)라, 한국 자정 ~ 오전 9시(UTC 전날)에 돌리면 오늘이 하루 어긋났다
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', ...(vp.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 404, body: '' }))
  await page.route('**/api/yt-bench**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: FJSON }))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))
  await page.goto(BASE + '/marketing', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const T = vp.tag
  const over = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  const tabIds = await page.getByTestId('mk-tabs').locator('a, button').evaluateAll((els) => els.map((e) => e.dataset.testid))
  check(`D231-1 ${T} 마케팅 · 브랜딩(/marketing) = 바로 레이더 · 목차 7칸(찍을 것 · 인기 · 채널 · 분석 · 내 콘텐츠 · 홍보 글 · 홈페이지)`, (await page.getByTestId('radar-plan').count()) === 1 && tabIds.join() === 'yt-view-plan,yt-view-top,yt-view-channels,yt-view-analysis,yt-view-make,mk-tab-content,mk-tab-homepage', tabIds)
  const hero = page.locator('[data-testid="radar-opp"][data-size="hero"]')
  const mirae = hero.getByTestId('radar-mirae')
  const miraeTxt = await mirae.innerText()
  const miraeBorder = await mirae.evaluate((e) => getComputedStyle(e).borderTopWidth)
  check(`D231-2 ${T} 1순위 '미래AI랩 관점' 상자(이름 · 굵은 테두리 · 관점 문장) — 'MIRAE' 영문 이름 없음`, miraeTxt.includes('미래AI랩 관점') && parseFloat(miraeBorder) >= 2 && (await hero.getByTestId('radar-view').innerText()).length > 15 && !(await page.getByTestId('radar-plan').innerText()).includes('MIRAE 관점') && !(await page.getByTestId('radar-plan').innerText()).includes('MIRAE 는'), { miraeTxt: miraeTxt.slice(0, 60), miraeBorder })
  const kit = hero.getByTestId('radar-kit')
  const kitOpen = await kit.getAttribute('data-open')
  const frames = await kit.getByTestId('radar-kit-frame').count()
  const outline = await kit.getByTestId('radar-kit-outline').locator('li').count()
  const shorts = await kit.getByTestId('radar-kit-shorts').locator('ol li').count()
  check(`D231-3 ${T} 1순위 '이번 주 이렇게 찍으세요' 펼친 채 — 제목 예 · 첫 문장 · 준비 시간 · 잘 된 틀 → 우리 제목 ${frames}개 · 구성 ${outline}단 · 쇼츠 3컷 · 그대로/바꿀 것/준비`, kitOpen === '1' && (await kit.getByTestId('radar-kit-title').innerText()).includes('제목 예') && (await kit.getByTestId('radar-kit-hook').innerText()).includes('첫 문장') && /분쯤/.test(await kit.getByTestId('radar-kit-effort').innerText()) && frames >= 1 && outline >= 6 && shorts === 3 && (await kit.getByTestId('radar-kit-keep').count()) === 1 && (await kit.getByTestId('radar-kit-change').count()) === 1 && (await kit.getByTestId('radar-kit-prep').count()) === 1, { kitOpen, frames, outline, shorts })
  if (SHOT231 && T !== '360') {
    await mirae.scrollIntoViewIfNeeded()
    await page.waitForTimeout(200)
    await page.screenshot({ path: `${SHOT231}/radar-${T}-hero-kit.png`, fullPage: false })
  }
  await kit.getByTestId('radar-kit-copy').click()
  await page.waitForTimeout(250)
  const kitClip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  check(`D231-4 ${T} [키트 전체 복사] — 관점 · 첫 문장 · 제목 · 구성 · 쇼츠 · 그대로 쓰지 않는다는 말`, kitClip.includes('[이번 주 찍기 키트]') && kitClip.includes('미래AI랩 관점:') && kitClip.includes('첫 문장:') && kitClip.includes('긴 영상 구성') && kitClip.includes('그대로 쓰지 않는다'), kitClip.slice(0, 120))
  const sub = page.locator('[data-testid="radar-opp"][data-size="sub"]').first()
  const subKit = sub.getByTestId('radar-kit')
  const subClosed = (await subKit.getAttribute('data-open')) === '0' && (await subKit.getByTestId('radar-kit-title').count()) === 1 && (await subKit.getByTestId('radar-kit-hook').count()) === 1 && (await sub.getByTestId('radar-mirae').count()) === 1
  await subKit.getByTestId('radar-kit-toggle').click()
  await page.waitForTimeout(150)
  check(`D231-5 ${T} 2 · 3순위 — 미래AI랩 관점 · 제목 예 · 첫 문장은 늘 보이고 키트는 접힘 → 누르면 펼침`, subClosed && (await subKit.getAttribute('data-open')) === '1' && (await subKit.getByTestId('radar-kit-outline').count()) === 1)
  const compactTitles = await page.getByTestId('radar-compact-title').count()
  const compactN = await page.getByTestId('radar-opp-compact').count()
  check(`D231-6 ${T} 4위 아래 한 줄에도 '제목 예'(${compactTitles}/${compactN})`, compactN >= 2 && compactTitles === compactN)
  const ov1 = await over()
  // [이번 주로 확정] → 내 콘텐츠
  await hero.getByTestId('radar-confirm').click()
  await page.waitForTimeout(500)
  await page.getByTestId('radar-guide-notebook').click()
  await page.waitForTimeout(400)
  const row = page.getByTestId('radar-idea').first()
  check(`D231-7 ${T} 확정 → 길잡이 [다음: 내 콘텐츠] → 내 콘텐츠 탭(주소 view=make) · 제작 예정 1줄 · 단계판 · 이번 주 일정 칸`, page.url().includes('view=make') && (await page.getByTestId('make-view').count()) === 1 && (await page.getByTestId('radar-idea').count()) === 1 && (await row.getAttribute('data-status')) === 'selected' && (await page.locator('[data-testid="make-stage"][data-status="selected"]').innerText()).includes('1') && (await page.getByTestId('make-week-empty').count()) === 1)
  const today = await page.evaluate(() => { const d = new Date(Date.now() + 9 * 3600000); return d.toISOString().slice(0, 10) })
  await row.getByTestId('make-shoot-date').fill(today)
  await page.waitForTimeout(300)
  await row.locator('[data-testid="make-check"][data-id="title"] input').check()
  await row.locator('[data-testid="make-check"][data-id="script"] input').check()
  await page.waitForTimeout(400)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const r2 = page.getByTestId('radar-idea').first()
  const weekTxt = await page.getByTestId('make-week').innerText()
  check(`D231-8 ${T} 촬영일 · 체크 2칸 → 새로고침해도 그대로 · 이번 주 일정에 '오늘 · 촬영'`, (await r2.getByTestId('make-shoot-date').inputValue()) === today && (await r2.locator('[data-testid="make-check"][data-on="1"]').count()) === 2 && (await page.getByTestId('make-week-item').count()) === 1 && weekTxt.includes('오늘') && weekTxt.includes('촬영'), weekTxt.slice(0, 80))
  await page.getByTestId('make-add-input').fill('정책자금 상담 전 꼭 준비할 서류 5가지')
  await page.getByTestId('make-add').click()
  await page.waitForTimeout(500)
  check(`D231-9 ${T} 레이더에 없는 주제 직접 담기 → 제작 예정 2줄`, (await page.getByTestId('radar-idea').count()) === 2 && (await page.locator('[data-testid="make-stage"][data-status="selected"]').innerText()).includes('2'))
  if (SHOT231 && T !== '360') await page.screenshot({ path: `${SHOT231}/make-${T}.png`, fullPage: T === 'PC' })
  const ov2 = await over()
  const checkH = await page.getByTestId('make-check').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
  // 홍보 글로 → 주제를 키워드로
  const toContent = page.locator('[data-testid="radar-idea"]').filter({ hasText: '정책자금 상담 전' }).getByTestId('make-to-content')
  await toContent.click()
  await page.waitForTimeout(700)
  const picker = page.getByTestId('content-picker-item').first()
  const pickHref = (await picker.getAttribute('href')) ?? ''
  check(`D231-10 ${T} [홍보 글로] → 홍보 글 만들기(목차 줄 그대로 · 홍보 글 칸 켜짐) · 고르는 칸 주소에 주제(kw)가 따라감`, page.url().includes('/tools/content') && (await page.getByTestId('mk-tabs').count()) === 1 && (await page.getByTestId('mk-tab-content').getAttribute('aria-current')) === 'page' && decodeURIComponent(pickHref).includes('kw=정책자금 상담 전'), pickHref)
  await picker.click()
  await page.waitForTimeout(900)
  const kwVal = await page.getByTestId('content-keyword').inputValue().catch(() => '')
  check(`D231-11 ${T} 업체를 고르면 '직접 고르기' 가 열리고 키워드 칸에 그 주제`, kwVal.startsWith('정책자금 상담 전') && (await page.locator('[data-testid="content-mode"] [data-key="direct"]').getAttribute('aria-selected')) === 'true', kwVal)
  await page.getByTestId('mk-tab-make').click()
  await page.waitForTimeout(700)
  check(`D231-12 ${T} 홍보 글 화면 목차의 [내 콘텐츠] → 레이더 내 콘텐츠로 돌아옴`, page.url().includes('/marketing') && (await page.getByTestId('make-view').count()) === 1)
  check(`D231-13 ${T} 가로 넘침 0(레이더 ${ov1} · 내 콘텐츠 ${ov2}) · 체크 칸 44px · 오류 0`, ov1 <= 0 && ov2 <= 0 && checkH.length > 0 && checkH.every((h) => h >= 44) && errs.length === 0, { ov1, ov2, checkH: checkH.slice(0, 4), errs })
  await ctx.close()
}

// D-232 내 콘텐츠 성과 — 올린 영상 ↔ 내 채널 영상(레이더가 받은 피드 안에서만 · 유튜브 더 부르지 않음).
// 주소가 없으면 '이 영상인가요?' → [맞아요] 한 번에 주소 · 게시 완료 · 평소 대비 숫자. 스크린샷: SHOTS232=<폴더>
const SHOT232 = process.env.SHOTS232 || ''
const FEED232 = {
  ...FOCUS,
  videos: [
    ...FOCUS.videos,
    v('myVid232a01', 'UCme', '정책자금 상담 전 꼭 준비할 서류 5가지 총정리', 1 * D, 2_400),
    v('myVid232b01', 'UCme', 'Claude 업무 활용 실제로 써 봤습니다', 2 * D, 450),
    v('myVid232c01', 'UCme', '노란우산공제 해지 전에 꼭 볼 것', 3 * D, 320),
  ],
}
const J232 = JSON.stringify(FEED232)
for (const vp of [{ width: 1440, height: 900, tag: 'PC' }, { width: 390, height: 844, tag: '390', mobile: true }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'ko-KR', ...(vp.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 404, body: '' }))
  await page.route('**/api/yt-bench**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: J232 }))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/marketing?view=make', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const T = vp.tag
  const rowOf = (t) => page.locator('[data-testid="radar-idea"]').filter({ hasText: t })
  const add = async (t) => {
    await page.getByTestId('make-add-input').fill(t)
    await page.getByTestId('make-add').click()
    await page.waitForTimeout(500)
  }
  await add('정책자금 상담 전 꼭 준비할 서류 5가지')
  const learn = page.getByTestId('make-learn')
  const r1 = rowOf('정책자금 상담 전 꼭 준비할 서류 5가지')
  const sug = r1.getByTestId('make-suggest')
  check(`D232-1 ${T} 내 콘텐츠 › '우리 채널 성과' 칸(아직 이은 영상 0) · 줄에 '이 영상인가요?' — 담은 주제가 들어간 내 채널 영상(벤치마킹 영상 아님)`, (await learn.getAttribute('data-linked')) === '0' && (await page.getByTestId('make-learn-empty').count()) === 1 && (await sug.count()) === 1 && (await sug.innerText()).includes('총정리') && (await page.getByTestId('make-learn-suggest').count()) === 1)
  const yesH = await r1.getByTestId('make-suggest-yes').evaluate((e) => Math.round(e.getBoundingClientRect().height))
  if (SHOT232) await page.screenshot({ path: `${SHOT232}/suggest-${T}.png`, fullPage: false })
  await r1.getByTestId('make-suggest-yes').click()
  await page.waitForTimeout(600)
  const perf = r1.getByTestId('make-perf')
  const perfTxt = (await perf.count()) ? await perf.innerText() : ''
  check(`D232-2 ${T} [맞아요] 한 번 → 게시 완료 · 평소 대비 숫자(잘 됨) · 조회 · 올린 지 · 제안은 사라짐 · 단추 높이(휴대폰 44 · PC 40)`, (await r1.getAttribute('data-status')) === 'published' && perfTxt.includes('평소') && perfTxt.includes('조회 2,400') && (await perf.getAttribute('data-tone')) === 'good' && (await r1.getByTestId('make-suggest').count()) === 0 && yesH >= (vp.mobile ? 44 : 40), { perfTxt, yesH })
  check(`D232-3 ${T} '우리 채널 성과' — 한 편이면 '아직 한 편 · 두 편부터 비교'`, (await learn.getAttribute('data-linked')) === '1' && (await page.getByTestId('make-learn-line').first().innerText()).startsWith('아직 한 편'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const r1b = rowOf('정책자금 상담 전 꼭 준비할 서류 5가지')
  const pubDay = await r1b.getByTestId('make-publish-date').inputValue()
  check(`D232-4 ${T} 새로고침해도 이어진 채(주소 저장 · 게시일 = 그 영상 올린 날로 채움)`, (await r1b.getByTestId('make-perf').count()) === 1 && /^\d{4}-\d{2}-\d{2}$/.test(pubDay), pubDay)
  // 직접 주소 적기
  await add('Claude 업무 활용')
  const r2 = rowOf('Claude 업무 활용')
  await r2.getByTestId('make-row-toggle').click()
  await r2.getByTestId('make-link').fill('https://youtu.be/myVid232b01')
  await r2.getByTestId('make-link').blur()
  await page.waitForTimeout(600)
  check(`D232-5 ${T} 올린 주소(youtu.be)를 직접 적어도 그 영상 숫자가 붙음`, (await r2.getByTestId('make-perf').count()) === 1 && (await r2.getByTestId('make-perf').innerText()).includes('조회 450'))
  const lines = await page.getByTestId('make-learn-line').allInnerTexts()
  check(`D232-6 ${T} 두 편부터 — '우리 채널에서는 … 평소의 n배(2편)' · '가장 잘 된 영상'`, lines.some((l) => l.startsWith('우리 채널에서는') && l.includes('(2편)')) && lines.some((l) => l.startsWith('가장 잘 된 영상')), lines)
  // 아니에요
  await add('노란우산공제 해지')
  const r3 = rowOf('노란우산공제 해지')
  const had = await r3.getByTestId('make-suggest').count()
  await r3.getByTestId('make-suggest-no').click()
  await page.waitForTimeout(300)
  check(`D232-7 ${T} [아니에요] → 그 제안만 숨김(주소 · 단계 그대로)`, had === 1 && (await r3.getByTestId('make-suggest').count()) === 0 && (await r3.getAttribute('data-status')) === 'selected' && (await page.getByTestId('make-learn-suggest').count()) === 0)
  if (SHOT232) {
    await learn.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOT232}/learn-${T}.png`, fullPage: T === 'PC' })
  }
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(`D232-8 ${T} 가로 넘침 0(${ov}) · 오류 0`, ov <= 0 && errs.length === 0, { ov, errs })
  await ctx.close()
}

await browser.close()
console.log(`\nyoutube: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
