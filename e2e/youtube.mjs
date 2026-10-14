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
  // 이 시험은 처음 연 모양(분석은 접힘 · 한 줄 요약)을 본다 — 시드의 '모두 펼치기' 를 지운다
  await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))

  // 1. 마케팅 · 브랜딩 입구
  await page.goto(BASE + '/marketing', { waitUntil: 'networkidle' })
  check('마케팅: 맨 위 "콘텐츠 레이더(YouTube 벤치마킹)" 바로 쓰기 · 도입 예정 5개는 그대로', (await page.getByTestId('marketing-youtube').count()) === 1 && ((await page.getByTestId('marketing-youtube').innerText()) ?? '').includes('콘텐츠 레이더') && (await page.getByTestId('marketing-planned').locator('li').count()) === 5)
  await page.getByTestId('marketing-youtube').click()
  await page.waitForURL(/\/marketing\/youtube/)
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
  check('주소: 처음엔 하루 칸(?slot=오늘 날짜)', asked.length === 1 && /slot=\d{4}-\d{2}-\d{2}$/.test(asked[0]), asked.join(' '))
  check('예시 띠는 사라진다(진짜 데이터)', (await page.getByTestId('yt-sample-banner').count()) === 0)
  check('D-194 첫 화면 = 이번 주 찍을 것(콘텐츠 레이더) · 제목 "콘텐츠 레이더" · 보조 "YouTube 벤치마킹"', (await page.getByTestId('radar-plan').isVisible()) && ((await page.locator('main h1').first().innerText()) ?? '').includes('콘텐츠 레이더') && ((await page.getByTestId('radar-subtitle').innerText()) ?? '').includes('YouTube 벤치마킹'))
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
  await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))
  await page.goto(BASE + '/marketing/youtube', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)

  const tops = page.getByTestId('radar-top').getByTestId('radar-opp')
  const axes = [...(await tops.evaluateAll((els) => els.map((e) => e.getAttribute('data-axis')))), ...(await page.getByTestId('radar-opp-compact').evaluateAll((els) => els.slice(0, 2).map((e) => e.getAttribute('data-axis'))))]
  check('레이더: 첫 화면에 후보 카드 3장 + 4~5위 한 줄', (await tops.count()) === 3 && axes.length === 5, axes)
  check('레이더: 이번 주 5개에 시장수요 · AX·AI · BRIDGE 가 섞인다(비중 가이드 45 · 35 · 20)', ['market', 'axai', 'bridge'].every((a) => axes.includes(a)), axes)
  const first = tops.first()
  const strengthText = (await first.getByTestId('radar-strength').innerText()) ?? ''
  check('레이더 카드: 신호 세기(강함 · 보통 · 초기 — 점수 없음) · 왜 지금 2줄 넘게 · 증거 · MIRAE 관점', /신호 (강함|보통)|초기 신호/.test(strengthText) && !/\d+점/.test(strengthText) && (await first.getByTestId('radar-why').locator('li').count()) >= 2 && ((await first.getByTestId('radar-evidence').innerText()) ?? '').includes('관련 영상') && ((await first.getByTestId('radar-view').innerText()) ?? '').length > 15)
  check('레이더: AI · AX 채널이 있으니 "AI 데이터 부족" 안내는 없다', (await page.getByTestId('radar-ai-short').count()) === 0)
  const mainText = (await page.locator('main').innerText()) ?? ''
  check('문구: "AI 추천 · AI가 분석 · 성공 가능 % · 이 영상은 뜹니다" 같은 말이 없다(근거 → 제안)', FORBIDDEN.every((w) => !mainText.includes(w)), FORBIDDEN.filter((w) => mainText.includes(w)))
  const bridgeCard = page.locator('[data-testid="radar-opp"][data-axis="bridge"], [data-testid="radar-opp-compact"][data-axis="bridge"]').first()
  check('BRIDGE 카드: "시장 주제 × AX 방향" 이름', ((await bridgeCard.innerText()) ?? '').includes('×'))

  await first.getByTestId('radar-opp-more').click()
  await page.waitForTimeout(200)
  check('카드 펼치기: 제목 후보 3 · 썸네일 문구 2 · 추천 접근 · 대표 벤치마킹', (await first.getByTestId('radar-title').count()) === 3 && (await first.getByTestId('radar-thumb-text').count()) === 2 && ((await first.getByTestId('radar-approach').innerText()) ?? '').includes('추천 접근') && (await first.getByTestId('radar-video-row').count()) >= 2)
  await first.getByTestId('radar-bench-thumb').first().click()
  await page.waitForTimeout(300)
  const det = page.getByTestId('radar-video-detail')
  check('영상 상세: 평소 대비 · 조회 속도 · 채널 안 순위 · 참고할 것 · 유튜브 링크(noopener)', (await det.isVisible()) && ((await det.innerText()) ?? '').includes('조회 속도') && ((await det.innerText()) ?? '').includes('채널 안 순위') && (await page.getByTestId('radar-lessons').locator('li').count()) >= 2 && ((await page.getByTestId('radar-open-youtube').getAttribute('rel')) ?? '').includes('noopener'))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  check('영상 상세: Esc 로 닫힘', (await det.count()) === 0)

  // 수첩 — 저장 · 다시 읽기 · 단계 · 브리프 · 빼기
  const topic = ((await first.getByTestId('radar-opp-topic').innerText()) ?? '').trim()
  await first.getByTestId('radar-save').click()
  await page.waitForTimeout(400)
  check('아이디어 저장: 카드에 "수첩에 있음" · 수첩 1개', (await first.getByTestId('radar-saved').count()) === 1 && (await page.getByTestId('radar-idea').count()) === 1)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('다시 열어도 수첩에 그대로(저장 → 다시 읽기)', (await page.getByTestId('radar-idea').count()) === 1 && ((await page.getByTestId('radar-idea').first().innerText()) ?? '').includes(topic.split(' × ')[0]))
  await page.getByTestId('radar-idea-status').first().selectOption('script')
  await page.waitForTimeout(400)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('단계: 대본 준비로 바꾸면 다시 열어도 그대로', (await page.getByTestId('radar-idea').first().getAttribute('data-status')) === 'script')
  await page.getByTestId('radar-idea-brief').first().click()
  await page.waitForTimeout(300)
  const brief = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  check('브리프 복사: 주제 · 제목 후보 · 근거 · 참고 영상(그대로 쓰지 않는다는 말)', brief.includes('[콘텐츠 브리프]') && brief.includes('제목 후보') && brief.includes('그대로 쓰지 않는다') && brief.includes('youtube.com/watch'), brief.slice(0, 120))
  await page.getByTestId('radar-idea-remove').first().click()
  check('빼기는 한 번 더 묻는다', (await page.getByTestId('radar-idea-confirm').count()) === 1)
  await page.getByTestId('radar-idea-confirm').getByRole('button', { name: '빼기' }).click()
  await page.waitForTimeout(400)
  check('빼면 수첩에서 사라진다', (await page.getByTestId('radar-idea').count()) === 0)

  // 시장 신호
  check('시장 신호: 급상승 주제 · 평소보다 터진 영상(🔥 평소보다 n배)', (await page.getByTestId('radar-rising-row').count()) >= 1 && (await page.getByTestId('radar-breakouts').getByTestId('radar-breakout-chip').count()) >= 1)

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

/* ---------------- 휴대폰 360 · 390 · 430 ---------------- */
for (const width of [360, 390, 430]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 404, body: '' }))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
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

await browser.close()
console.log(`\nyoutube: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
