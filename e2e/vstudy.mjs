/**
 * qa:vstudy — D-259 · D-260 벤치마킹 영상 창 아래 [대본 받아 적기] · [AI로 우리 회사 버전 만들기] (대표만).
 * 대표: "영상 상세정보 딱 눌러보면 해당 롱폼영상 풀 대본도 같이" · "버튼 딱 클릭하면 … 우리 회사 정보에 맞게 딱 추천".
 * 유튜브 · AI 서버 함수는 가짜 답(바깥 연결 없이) — 화면이 무엇을 보내고 어떻게 보여 주는지만 본다.
 *
 *   V1 영상 창에 '영상 대본' · 'AI로 우리 회사 버전 만들기' 두 칸
 *   V2 [대본 받아 적기] → 23분 41초 영상을 10분씩 3구간 · 영상 번호 · 구간만 보냄(주소 아님) · 한 번에 셋까지
 *   V3 한 구간이 실패하면 받은 구간은 보이고 '못 받은 구간' 안내 → [못 받은 구간 다시] → 그 구간만 다시
 *   V4 줄은 시각 순 · 시각을 누르면 유튜브 그 자리(&t=) · 화면 글 표시 · 줄 수 · 구간 수
 *   V5 [대본 전체 복사]
 *   V6 [AI로 우리 회사 버전 만들기] → 받은 대본 · 채널 설계 기준 · 규칙집을 보냄 · 제목 · 썸네일 · 첫 문장 · 구성 · 쇼츠 칸
 *   V7 [내 콘텐츠에 담기] → 내 콘텐츠에 우리 제목 줄 · 대본 칸에 전체 · [내 콘텐츠에서 보기]
 *   V8 창을 닫았다 열어도 · 새로고침해도 대본 · 우리 버전 그대로(다시 부르지 않음)
 *   V9 예시 영상은 받아 적기 대신 안내 · 휴대폰 390 넘침 0 · JS 오류 0
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.VSTUDY_SHOTS ?? ''
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) {
    pass++
    console.log('PASS ', n)
  } else {
    fail++
    console.log('FAIL ', n, d === undefined ? '' : String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700))
  }
}
const shot = async (page, name, full = false) => {
  if (!SHOTS) return
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.waitForTimeout(250)
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full })
}

const H = 3_600_000
const D = 24 * H
const NOW = Date.now()
const iso = (ago) => new Date(NOW - ago).toISOString()
const ch = (id, title, subs, views, mine = false) => ({ id, handle: `@${id}`, title, customUrl: `@${id}`, thumb: '', subs, videoCount: 120, views, mine })
const vid = (k) => `vidQA${k}`.padEnd(11, 'x').slice(0, 11)
const v = (k, c, t, ago, views, d = 700) => ({ id: vid(k), ch: c, t, at: iso(ago), d, v: views, l: Math.round(views * 0.03), c: Math.round(views * 0.004) })
const TOP = vid('a1')
const FEED = {
  fetchedAt: new Date(NOW - 2 * H).toISOString(),
  channels: [ch('UCme', '김팀장의 경영노트', 8_000, 900_000, true), ch('UCa', '로뎀세무법인', 150_000, 30_000_000), ch('UCb', '사장님 돈 공부', 60_000, 6_000_000)],
  videos: [
    v('a1', 'UCa', '세무 기장 수수료 전부 공개합니다', 1 * D, 120_000, 1421),
    v('b1', 'UCb', '기장료 비교 실제 사례', 2 * D, 40_000),
    v('a2', 'UCa', '부가세 신고 마감 정리', 4 * D, 30_000),
    v('b2', 'UCb', '법인세 절세 체크리스트', 5 * D, 22_000),
    v('me1', 'UCme', '고용지원금 상담 사례 공개', 2 * D, 9_000),
    v('a3', 'UCa', '종합소득세 신고 실수 모음', 12 * D, 50_000),
    v('b3', 'UCb', '가업승계 증여특례 한눈에', 15 * D, 7_000),
    v('me2', 'UCme', '노란우산공제 실제 상담', 22 * D, 3_000),
  ],
  failed: [],
  units: 20,
}

const ADAPT = {
  headline: '기장료 얼마가 적당할까 — 대표님이 손해 안 보는 기준 3가지',
  items: [
    { title: '왜 잘 됐나', tag: '분석', outline: ['숫자를 공개해 궁금증을 만듦', '첫 10초에 수수료 표'] },
    { title: '제목 후보', tag: '제목', outline: ['기장료 이 정도면 적당합니다', '세무사 바꾸기 전에 꼭 볼 것', '기장료 아끼다 세금 더 냅니다', '월 기장료 표로 보는 기준', '기장 맡길 때 묻는 질문 3개'] },
    { title: '썸네일 문구', tag: '썸네일', outline: ['월 15만원이면 적당할까?', '기장료 표 공개', '바꾸기 전 3가지'] },
    { title: '첫 문장', tag: '첫 문장', body: '오늘은 우리 회사 기장료가 적당한지 3분 안에 판단하는 기준을 드립니다.' },
    { title: '구성 시간표', tag: '구성', outline: ['0:00 오프닝 — 기장료 얼마 내세요?', '1:00 왜 다 다를까', '3:00 기준 1 · 거래 건수', '6:00 기준 2 · 절세 상담', '9:00 마무리'] },
    { title: '우리가 보여 줄 재료', tag: '재료', outline: ['[실제 사례 — 기장료 바꾼 업체]', 'OS 절세 설계 화면'] },
    { title: '쇼츠로 자르기', tag: '쇼츠', outline: ['0~3초 기장료 얼마 내세요?', '3~20초 기준 하나'] },
    { title: '그대로 가져올 것 · 바꿀 것', tag: '차별', outline: ['숫자 공개 틀은 그대로', '세무사 홍보 대신 대표님 판단 기준으로'] },
  ],
  next: ['수수료 표', '상담 사례 한 건'],
  caution: '',
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

async function setup(ctx, opts = {}) {
  const posts = []
  const failOnce = new Set(opts.failOnce ?? [])
  await ctx.route('https://i.ytimg.com/**', (r) => r.fulfill({ status: 404, body: '' }))
  if (!opts.noFeed) await ctx.route('**/api/yt-bench**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FEED) }))
  await ctx.route('**/api/ai-assist**', async (r) => {
    const req = r.request()
    if (req.method() === 'GET') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, providers: [{ id: 'gemini', label: 'Gemini', configured: true, keyName: 'GEMINI_API_KEY', checked: false, models: [{ id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', note: '', price: null, verified: null, tier: 'cheap' }] }], defaultChoice: { provider: 'gemini', model: 'gemini-3.1-flash-lite' } }) })
    }
    const body = JSON.parse(req.postData() ?? '{}')
    posts.push({ ...body, at: Date.now() })
    const runOf = (structured) => ({ ok: true, run: { requestId: body.requestId, assistId: body.assistId, page: body.page, provider: 'gemini', model: 'gemini-3.1-flash-lite', status: 'succeeded', structured, raw: '', usage: { input: 1, output: 1, total: 2 }, estimatedCostUsd: 0, ms: 5, sent: { userChars: 1, rows: 0, rowsCut: 0 }, createdAt: new Date().toISOString() } })
    if (body.assistId === 'radar.transcript') {
      const s = body.video?.start ?? 0
      await new Promise((ok) => setTimeout(ok, 350))
      if (failOnce.has(s)) {
        failOnce.delete(s)
        return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'provider_unreachable' }) })
      }
      const mm = (x) => `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`
      const items = [
        { title: mm(s + 65), body: `구간${s} 세 번째 말` },
        { title: mm(s), body: `구간${s} 첫 말 — 기장 수수료 이야기` },
        { title: mm(s + 30), body: s === 0 ? '월 기장료 표' : `구간${s} 두 번째 말`, detail: s === 0 ? '화면 글' : '' },
      ]
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(runOf({ headline: `구간 ${s} 요약`, items, next: [], caution: '' })) })
    }
    if (body.assistId === 'radar.adapt') {
      await new Promise((ok) => setTimeout(ok, 200))
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(runOf(ADAPT)) })
    }
    return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'bad_request' }) })
  })
  return posts
}

const openTop = async (page) => {
  await page.getByTestId('yt-view-top').click()
  await page.waitForTimeout(400)
  const card = page.locator('[data-testid="yt-card"]').filter({ hasText: '세무 기장 수수료 전부 공개' }).first()
  await card.getByTestId('yt-card-thumb').click()
  await page.getByTestId('radar-video-detail').waitFor()
}

/* ---------------- PC 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const posts = await setup(ctx, { failOnce: [600] })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(() => ['axmvp.mk.transcript.v1', 'axmvp.mk.adapt.v1'].forEach((k) => localStorage.removeItem(k)))
  await page.goto(BASE + '/marketing/youtube', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await openTop(page)
  const study = page.getByTestId('video-study')
  check('V1 영상 창 아래 "영상 대본" · "AI로 우리 회사 버전 만들기" 두 칸 · 받기 전 안내(10분씩 3번)', (await study.isVisible()) && (await page.getByTestId('vs-get').isVisible()) && (await page.getByTestId('vs-adapt-run').isVisible()) && ((await page.getByTestId('vs-transcript').innerText()) ?? '').includes('10분씩 3번'))
  await shot(page, 'V1-detail-before')

  await page.getByTestId('vs-get').click()
  await page.getByTestId('vs-progress').waitFor({ timeout: 3000 }).catch(() => {})
  const progressSeen = (await page.getByTestId('vs-progress').count()) === 1
  await page.waitForFunction(() => !document.querySelector('[data-testid="vs-progress"]'), null, { timeout: 15000 })
  const tposts = posts.filter((p) => p.assistId === 'radar.transcript')
  const starts = tposts.map((p) => p.video?.start).sort((a, b) => a - b)
  const firstThree = tposts.slice(0, 3).map((p) => p.at)
  check('V2 [대본 받아 적기] → 진행 막대 · 10분씩 3구간(0 · 600 · 1200 ~ 1421) · 영상 번호 · 구간만 보냄(주소 아님) · 셋 동시에', progressSeen && tposts.length === 3 && starts.join() === '0,600,1200' && tposts.every((p) => p.video.id === TOP && p.page === 'radar' && !JSON.stringify(p).includes('youtube.com/watch')) && tposts.find((p) => p.video.start === 1200)?.video.end === 1421 && Math.max(...firstThree) - Math.min(...firstThree) < 300, { starts, n: tposts.length })
  // 점검: 받아 적기에 규칙집 · 채널 기준이 섞이면 '들린 그대로' 와 부딪힌다 — 영상 이름 · 채널 · 길이만
  check('V2b 받아 적기 자료는 영상 이름 · 채널 · 길이만(규칙집 · 채널 설계 기준 · 회사 소개 · 앞서 받은 대본 없음)', tposts.every((p) => p.context.sections.length === 1 && p.context.sections[0].name === '영상' && !p.context.rules && !p.context.facts && !JSON.stringify(p.context).includes('채널 설계 기준')), tposts.map((p) => p.context.sections.map((x) => x.name)))
  const failedNote = await page.getByTestId('vs-failed').innerText().catch(() => '')
  const lines1 = await page.getByTestId('vs-lines').locator('li').count()
  check('V3 한 구간(10:00~20:00)이 멈추면 받은 구간(6줄)은 보이고 그 구간만 안내', lines1 === 6 && failedNote.includes('10:00~20:00') && (await page.getByTestId('vs-retry').isVisible()), { lines1, failedNote })
  await page.getByTestId('vs-retry').click()
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="vs-lines"] li').length === 9, null, { timeout: 10000 })
  const t2 = posts.filter((p) => p.assistId === 'radar.transcript')
  check('V3b [못 받은 구간 다시] → 그 구간(600)만 다시 · 9줄 · 안내 사라짐', t2.length === 4 && t2[3].video.start === 600 && (await page.getByTestId('vs-failed').count()) === 0, t2.map((p) => p.video.start))
  const lineTexts = await page.getByTestId('vs-lines').locator('li').allInnerTexts()
  const firstHref = await page.getByTestId('vs-lines').locator('li a').first().getAttribute('href')
  const count = await page.getByTestId('vs-count').innerText()
  check('V4 시각 순(0:00 → 0:30 화면 글 → 1:05 → 10:00 …) · 시각을 누르면 유튜브 그 자리(&t=0s · 새 창) · 9줄 · 3/3 구간', lineTexts[0].startsWith('0:00') && lineTexts[1].includes('화면 글') && lineTexts[2].startsWith('1:05') && lineTexts[3].startsWith('10:00') && lineTexts[8].startsWith('21:05') && firstHref === `https://www.youtube.com/watch?v=${TOP}&t=0s` && count.includes('9줄') && count.includes('3/3 구간'), { lineTexts: lineTexts.slice(0, 4), firstHref, count })
  await shot(page, 'V4-transcript')
  await page.getByTestId('vs-copy').click()
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  check('V5 [대본 전체 복사] → "[대본] 제목" + "0:00  말" 줄', clip.startsWith('[대본] 세무 기장 수수료') && clip.includes('0:30  (화면 글) 월 기장료 표') && clip.split('\n').length === 10, clip.slice(0, 200))

  await page.getByTestId('vs-adapt-run').click()
  await page.getByTestId('vs-adapt-result').waitFor({ timeout: 10000 })
  const ap = posts.find((p) => p.assistId === 'radar.adapt')
  const secNames = (ap?.context?.sections ?? []).map((s) => s.name)
  const parts = await page.getByTestId('vs-adapt-part').evaluateAll((els) => els.map((e) => e.dataset.tag))
  check('V6 [AI로 우리 회사 버전 만들기] → 참고 영상 · 받은 대본(9줄) · 채널 설계 기준 · 규칙집을 보냄 · 우리 제목 · 8칸(분석 · 제목 · 썸네일 · 첫 문장 · 구성 · 재료 · 쇼츠 · 차별) · 준비물',
    !!ap && ap.page === 'radar' && !ap.video && secNames[0].startsWith('참고 영상') && secNames[1].startsWith('참고 영상 대본') && ap.context.sections[1].rows.length === 9 && secNames[2].startsWith('채널 설계 기준') && (ap.context.rules ?? []).length > 5 && ((await page.getByTestId('vs-adapt-headline').innerText()) ?? '').includes('기장료 얼마가 적당할까') && parts.join() === '분석,제목,썸네일,첫문장,구성,재료,쇼츠,차별' && ((await page.getByTestId('vs-adapt-result').innerText()) ?? '').includes('찍기 전 준비물'),
    { secNames, parts })
  await page.getByTestId('vs-adapt-result').scrollIntoViewIfNeeded()
  await shot(page, 'V6-adapt')
  await page.getByTestId('vs-adapt-save').click()
  await page.getByTestId('vs-adapt-open').waitFor({ timeout: 8000 })
  const href = await page.getByTestId('vs-adapt-open').getAttribute('href')
  check('V7 [내 콘텐츠에 담기] → [내 콘텐츠에서 보기](그 줄 주소)', !!href && href.startsWith('/marketing?view=make&idea='), href)

  // 창 닫았다 다시 열기 — 다시 부르지 않음
  const before = posts.length
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await openTop(page)
  check('V8 창을 닫았다 열어도 대본 9줄 · 우리 버전 그대로 · 다시 부르지 않음', (await page.getByTestId('vs-lines').locator('li').count()) === 9 && (await page.getByTestId('vs-adapt-result').isVisible()) && posts.length === before, posts.length - before)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await openTop(page)
  check('V8b 새로고침해도 그대로(이 브라우저에 남김) · 다시 부르지 않음 · [대본 받아 적기] 단추 대신 복사', (await page.getByTestId('vs-lines').locator('li').count()) === 9 && (await page.getByTestId('vs-adapt-result').isVisible()) && (await page.getByTestId('vs-get').count()) === 0 && (await page.getByTestId('vs-copy').isVisible()) && posts.length === before)
  // 내 콘텐츠로
  await page.keyboard.press('Escape')
  await page.goto(BASE + href, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const body = (await page.locator('main').innerText()) ?? ''
  check('V7b 내 콘텐츠에 우리 제목 줄 · 단계 대본 준비 · 참고 영상 제목', body.includes('기장료 얼마가 적당할까') && body.includes('대본') && body.includes('세무 기장 수수료 전부 공개'), body.slice(0, 300))
  await shot(page, 'V7-make', true)
  check('V9a PC JS 오류 0', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- 예시 영상 · 휴대폰 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ko-KR' })
  await setup(ctx, { noFeed: true })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/marketing/youtube', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.getByTestId('yt-sample').click()
  await page.waitForTimeout(500)
  await page.getByTestId('yt-view-top').click()
  await page.waitForTimeout(400)
  await page.getByTestId('yt-card').first().getByTestId('yt-card-thumb').click()
  await page.getByTestId('radar-video-detail').waitFor()
  check('V9 예시 영상은 [대본 받아 적기] 대신 안내 · 우리 버전은 그대로', (await page.getByTestId('vs-cannot').isVisible()) && (await page.getByTestId('vs-get').count()) === 0 && (await page.getByTestId('vs-adapt-run').isVisible()))
  await ctx.close()
}
for (const width of [390, 360]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  await setup(ctx)
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/marketing/youtube', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await openTop(page)
  await page.getByTestId('vs-get').click()
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="vs-lines"] li').length === 9, null, { timeout: 15000 })
  await page.getByTestId('vs-adapt-run').click()
  await page.getByTestId('vs-adapt-result').waitFor({ timeout: 10000 })
  const r = await page.evaluate(() => {
    const d = document.querySelector('[data-testid="radar-video-detail"]')
    const wideEls = [...(d?.querySelectorAll('[data-testid="video-study"] *') ?? [])].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'auto' && getComputedStyle(e).overflowY !== 'auto' && getComputedStyle(e).textOverflow !== 'ellipsis')
    return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, wide: wideEls.length, which: wideEls.map((e) => `${e.tagName}.${String(e.className).slice(0, 40)}:${(e.textContent || '').slice(0, 24)}`) }
  })
  await page.getByTestId('vs-adapt-result').scrollIntoViewIfNeeded()
  await shot(page, `V10-${width}`)
  check(`V10 휴대폰 ${width} — 대본 9줄 · 우리 버전 · 가로 넘침 0 · 칸 밖으로 나간 글 0(말줄임 … 은 제외) · 오류 0`, r.over <= 0 && r.wide === 0 && errs.length === 0, { ...r, errs })
  await ctx.close()
}

await browser.close()
console.log(`\nqa:vstudy: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
