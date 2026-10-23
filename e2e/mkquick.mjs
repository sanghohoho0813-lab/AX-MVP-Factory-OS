/**
 * MUX-2 주제 하나 → 바로 쓰기(스레드 · 릴스 · 틱톡) + 감사에서 찾은 P0 고침.
 *
 *   node e2e/mkquick.mjs <baseUrl>
 *
 *  Q  스레드: 이번 주 키워드 칩 · 추천 형식(규칙) · [AI로 바로 쓰기] 하나 → 1안이 글 칸에 · 다른 안 · 쓰던 글은 덮지 않음 ·
 *     직접 고른 틀은 칩이 덮지 않음 · 고르기는 '형식 직접 고르기' 안(접힘 — 지운 것 없음)
 *  S  릴스 · 틱톡: 같은 흐름 · 플랫폼 바꾸면 추천도 바뀜
 *  P  묶음 화면 → [스레드 글 쓰기] → 주제 · 추천 형식이 채워진 채로 · 예시 데이터는 이번 주 키워드로 두지 않음
 *  M  실측(클릭 · 타자 · AI 단추 위치) · 360/390/430/큰 글자 넘침 0
 *  D  예전 주소(?tab=) 그대로
 *  X  특허·MVP 저장 실패 → 적은 내용 그대로 + [다시 저장] · AX 고객사 '운영 파일' 은 이어진 업체로만 · 자체점검 문구
 * AI 는 진짜 api/ai-assist.js 를 같은 프로세스에서 부르고 공급자 응답만 가짜(호출 수를 센다).
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { seedScript, SEED_PROJECT_ID } from './seed.mjs'

const fromRoot = (p) => import(pathToFileURL(path.resolve(p)).href)
const { default: handler, __resetAiAssistState } = await fromRoot('api/ai-assist.js')

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) {
    pass++
    console.log('PASS ', n)
  } else {
    fail++
    console.log('FAIL ', n, d === undefined ? '' : String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600))
  }
}

const OWNER = 'Bearer owner-e2e-token-aaaaaaaaaaaa'
for (const k of Object.keys(process.env)) if (/^(AI_|OPENAI_|SUPABASE_|GEMINI_|GOOGLE_API|ANTHROPIC_API|CLAUDE_API)/.test(k)) delete process.env[k]
Object.assign(process.env, { SUPABASE_URL: 'https://qa.supabase.test', SUPABASE_ANON_KEY: 'qa-anon', GEMINI_API_KEY: 'gem-e2e-SECRET-1', AI_ASSIST_RATE_PER_MIN: '100', AI_ASSIST_RATE_PER_HOUR: '500' })
__resetAiAssistState()

const TH = {
  headline: '고용지원금',
  items: [
    { title: '직원 뽑기 전에 이것부터.', tag: 'A', body: '직원 뽑기 전에 이것부터.\n고용지원금은 채용 뒤엔 못 받는 게 있어.\n\n쓸 사람?', when: '쓸 사람?', detail: '', outline: ['[신청 시기 원문 확인]'] },
    { title: '2안 첫 줄', tag: 'G', body: '2안 첫 줄\n둘째 줄\n\n1년 / 2년 / 3년', when: '고르기 쉬운 질문', detail: '', outline: [] },
    { title: '3안 첫 줄', tag: 'P', body: '3안 첫 줄\n둘째 줄', when: '자료 나눔', detail: '', outline: [] },
  ],
  next: [],
}
const SH = {
  headline: '고용지원금',
  items: [
    { title: '대본 1', tag: 'list', body: '[0:00] 고용지원금, 이거 모르면 손해예요\n[0:03] 딱 세 가지만 보세요.\n[0:06] 첫째, 채용 전에 신청\n[0:12] 둘째, 4대보험\n[0:18] 셋째, 6개월 유지', when: '약 25초', detail: '채용 전에 볼 것 세 가지', outline: ['#고용지원금', '#채용', '#중소기업'] },
    { title: '대본 2', tag: 'talk', body: '[0:00] 대표님, 고용지원금 언제 신청해요?\n[0:03] 채용 전에요.', when: '약 10초', detail: '캡션 2', outline: ['#고용지원금'] },
  ],
  next: ['[요건 원문 확인]'],
}
const llm = []
const realFetch = globalThis.fetch
globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  const h = init.headers ?? {}
  if (url.startsWith('https://qa.supabase.test/auth/v1/user')) return new Response(JSON.stringify({ id: h.Authorization === OWNER ? 'owner-1' : 'x' }), { status: h.Authorization === OWNER ? 200 : 401 })
  if (url.startsWith('https://qa.supabase.test/rest/v1/rpc/has_capability')) return new Response(JSON.stringify(h.Authorization === OWNER), { status: 200 })
  if (url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent')) {
    const body = JSON.parse(String(init.body ?? '{}'))
    const sys = String(body.systemInstruction?.parts?.[0]?.text ?? '')
    const user = String(body.contents?.[0]?.parts?.[0]?.text ?? '')
    llm.push({ sys, user })
    const ans = sys.includes('(shorts.write') ? SH : TH
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(ans) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 2000, candidatesTokenCount: 300 } }), { status: 200 })
  }
  if (/\/models(\?|$)/.test(url)) return new Response(JSON.stringify({ models: [], data: [] }), { status: 200 })
  return realFetch(input, init)
}
async function wire(page) {
  await page.route('**/api/ai-assist**', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    const res = { statusCode: 200, headers: {}, raw: '', setHeader(k, v) { this.headers[k] = v }, end(b) { this.raw = b ?? '' } }
    await handler({ method: req.method(), url: u.pathname + u.search, headers: { authorization: OWNER }, body: req.postData() ?? undefined }, res)
    await route.fulfill({ status: res.statusCode, headers: { 'content-type': 'application/json' }, body: res.raw })
  })
}
const overflowX = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const yOf = (p, id) => p.getByTestId(id).evaluate((e) => Math.round(e.getBoundingClientRect().top + window.scrollY))
const WEEK = ['고용지원금', '가업승계 · 증여', '정책자금']
/** 예전 화면(main f808cfc)에서 같은 폭 · 같은 글자 크기로 잰 [AI로 글 쓰기] 단추 위치(px, 페이지 맨 위부터) — 2026-10-23 실측 */
const BEFORE_Y = { 'threads 360': 2517, 'shorts 360': 2223, 'threads 390': 2410, 'shorts 390': 2223, 'threads 430': 2221, 'shorts 430': 2098, 'threads 360-large': 3735, 'shorts 360-large': 3337 }
/** 이번 주 키워드(콘텐츠 레이더가 받은 것)를 이 브라우저에 — 그 주 월요일 기준 */
const seedWeek = (p, topics = WEEK) =>
  p.evaluate((ts) => {
    const d = new Date()
    const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
    const week = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`
    localStorage.setItem('mirae.mk.weekTopics.v1', JSON.stringify({ week, topics: ts }))
  }, topics)
const clearDrafts = (p) =>
  p.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (/mirae\.(threads|shorts)\.draft|axmvp\.fold\.(thr|sht)\.formats|axmvp\.fold\.all/.test(k)) localStorage.removeItem(k)
  })

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => void d.accept())
await wire(page)
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(seedScript())
await clearDrafts(page)
await seedWeek(page)

/* ---------------- Q 스레드 ---------------- */
await page.goto(BASE + '/marketing/threads', { waitUntil: 'networkidle' })
await page.getByTestId('thr-qs').waitFor({ timeout: 15000 })
const weekChips = await page.locator('[data-testid="thr-qs-week"] [data-testid="thr-qs-chip"]').allInnerTexts()
check('Q1 첫 화면 — 맨 위 "무엇에 대해 쓸까요?" · 이번 주 키워드 칩 3개(레이더) · 우리 분야 칩 · 주제 없으면 [AI로 바로 쓰기] 잠김', /무엇에 대해 쓸까요/.test(await page.getByTestId('thr-qs').innerText()) && weekChips.join('|') === WEEK.join('|') && (await page.locator('[data-testid="thr-qs-ours"] [data-testid="thr-qs-chip"]').count()) >= 3 && (await page.getByTestId('thr-qs-ai').isDisabled()), weekChips)
const primAbove = (p, pre) =>
  p.evaluate((pr) => {
    const ed = document.getElementById(`${pr}-editor`)?.getBoundingClientRect().top ?? Infinity
    return [...document.querySelectorAll('main button.bg-brand-600')].filter((b) => b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().top < ed).map((b) => b.getAttribute('data-testid'))
  }, pre)
const thrPrim = await primAbove(page, 'thr')
check('Q2 고르기(반응 · 틀 23가지 · 태그)는 지우지 않고 "형식 직접 고르기" 안에 접힘 · 글 칸 위의 주 단추(진한 단추)는 [AI로 바로 쓰기] 하나', (await page.getByTestId('thr-choose').getAttribute('data-open')) === '0' && (await page.getByTestId('thr-goal-reply').count()) === 0 && thrPrim.join() === 'thr-qs-ai', thrPrim)
let clicks = 0
await page.locator('[data-testid="thr-qs-week"] [data-testid="thr-qs-chip"]').first().click()
clicks++
const recLabel = await page.getByTestId('thr-qs-rec-label').innerText()
const recKey = /· ([A-X]) /.exec(recLabel)?.[1] ?? ''
check('Q3 칩 하나 → 추천 형식 한 줄(반응 · 틀 이름) · 이유 · 자료 없는 주제라 P(자료 나눔) 아님', !!recKey && recKey !== 'P' && /추천 형식/.test(await page.getByTestId('thr-qs-rec').innerText()) && (await page.getByTestId('thr-qs-topic').inputValue()) === '고용지원금', recLabel)
const before = llm.length
await page.getByTestId('thr-qs-ai').click()
clicks++
await page.getByTestId('thr-ai-drafts').waitFor({ timeout: 20000 })
await page.waitForTimeout(200)
const call = llm.slice(before).find((x) => x.sys.includes('(threads.write'))
check('Q4 [AI로 바로 쓰기] 한 번 → 1안이 글 칸에 바로 · 다른 안 3개(1안 · 2안 · 3안) · AI 호출 1번', /직원 뽑기 전에 이것부터/.test(await page.getByTestId('thr-body').inputValue()) && (await page.getByTestId('thr-ai-draft').count()) === 3 && /1안/.test(await page.getByTestId('thr-ai-draft').first().innerText()) && llm.length - before === 1)
check('Q5 AI 에 보낸 자료 — 추천한 틀 · 소재 · 주제 태그(정부지원사업)', !!call && call.user.includes(`고른틀: ${recKey} `) && /소재: 고용지원금/.test(call.user) && /정부지원사업/.test(call.user), call?.user.slice(0, 400))
check('Q6 1안의 확인할 것 · 규칙 검사가 바로 보임', /신청 시기 원문 확인/.test(await page.getByTestId('thr-checks').innerText()) && (await page.getByTestId('thr-lint').count()) === 1)
console.log(`MEASURE threads-after pc clicks=${clicks + 1} typed=0 (마케팅 목차 [스레드] 1 + 칩 1 + AI 1)`)
// 쓰던 글은 덮지 않는다
await page.getByTestId('thr-body').fill('대표님이 직접 고친 글')
await page.getByTestId('thr-qs-ai').click()
await page.waitForTimeout(600)
check('Q7 글 칸에 쓴 것이 있으면 다시 눌러도 덮지 않음(다른 안만 새로)', (await page.getByTestId('thr-body').inputValue()) === '대표님이 직접 고친 글' && (await page.getByTestId('thr-ai-draft').count()) === 3)
// 형식 바꾸기 → 펼쳐지고, 직접 고른 틀은 칩이 덮지 않는다
await page.getByTestId('thr-qs-change').click()
await page.waitForTimeout(300)
check('Q8 [형식 바꾸기] → "형식 직접 고르기" 펼침 · 추천한 틀이 골라져 있음', (await page.getByTestId('thr-choose').getAttribute('data-open')) === '1' && (await page.getByTestId(`thr-tpl-${recKey}`).getAttribute('aria-pressed')) === 'true')
await page.getByTestId('thr-goal-share').click()
await page.getByTestId('thr-tpl-B').click()
await page.locator('[data-testid="thr-qs-ours"] [data-testid="thr-qs-chip"]').first().click()
await page.waitForTimeout(150)
check('Q9 직접 고른 틀(B)은 다른 주제 칩을 눌러도 그대로 · "고른 형식" 으로 보임', /고른 형식/.test(await page.getByTestId('thr-qs-rec').innerText()) && /· B /.test(await page.getByTestId('thr-qs-rec-label').innerText()) && (await page.getByTestId('thr-tpl-B').getAttribute('aria-pressed')) === 'true')

/* ---------------- S 릴스 · 틱톡 ---------------- */
await page.goto(BASE + '/marketing/shorts', { waitUntil: 'networkidle' })
await page.getByTestId('sht-qs').waitFor({ timeout: 15000 })
const shtPrim = await primAbove(page, 'sht')
check('S1 첫 화면 — 어디에(칩 2) · 주제 · 이번 주 키워드 칩 · 고르기는 접힘(지운 것 없음) · 대본 칸 위 주 단추는 [AI로 바로 쓰기] 하나', shtPrim.join() === 'sht-qs-ai' && (await page.locator('[data-testid="sht-qs-platform"] [role="radio"]').count()) === 2 && (await page.locator('[data-testid="sht-qs-week"] [data-testid="sht-qs-chip"]').count()) === 3 && (await page.getByTestId('sht-choose').getAttribute('data-open')) === '0' && (await page.getByTestId('sht-qs-ai').isDisabled()))
clicks = 0
await page.locator('[data-testid="sht-qs-week"] [data-testid="sht-qs-chip"]').first().click()
clicks++
check('S2 틱톡 · 고용지원금 → 추천 "많이 보이게 · 리스트형"', /많이 보이게 · 리스트형/.test(await page.getByTestId('sht-qs-rec-label').innerText()), await page.getByTestId('sht-qs-rec-label').innerText())
const sb = llm.length
await page.getByTestId('sht-qs-ai').click()
clicks++
await page.getByTestId('sht-ai-drafts').waitFor({ timeout: 20000 })
await page.waitForTimeout(200)
const scall = llm.slice(sb).find((x) => x.sys.includes('(shorts.write'))
check('S3 [AI로 바로 쓰기] → 1안 대본 · 캡션 · 해시태그가 칸에 · 다른 안 2개 · 호출 1번 · 보낸 자료에 추천 형식', /이거 모르면 손해예요/.test(await page.getByTestId('sht-script').inputValue()) && (await page.getByTestId('sht-tags').inputValue()) === '#고용지원금 #채용 #중소기업' && (await page.getByTestId('sht-ai-draft').count()) === 2 && llm.length - sb === 1 && !!scall && /고른형식: 리스트형/.test(scall.user) && /목적: 많이 보이게/.test(scall.user), scall?.user.slice(0, 300))
console.log(`MEASURE shorts-after pc clicks=${clicks + 1} typed=0 (마케팅 목차 [릴스 · 틱톡] 1 + 칩 1 + AI 1)`)
await page.getByTestId('sht-new').click()
await page.waitForTimeout(150)
await page.locator('[data-testid="sht-qs-week"] [data-testid="sht-qs-chip"]').first().click()
await page.getByTestId('sht-qs-platform-reels').click()
await page.waitForTimeout(150)
check('S4 릴스로 바꾸면 추천도 릴스 형식으로(금지형 · 자료 없는 주제라 댓글형 아님)', /금지형/.test(await page.getByTestId('sht-qs-rec-label').innerText()) && !/댓글형/.test(await page.getByTestId('sht-qs-rec-label').innerText()), await page.getByTestId('sht-qs-rec-label').innerText())
await page.getByTestId('sht-qs-topic').fill('벤처기업확인 셀프 체크리스트')
await page.locator('[data-testid="sht-qs-ours"] [data-testid="sht-qs-chip"]').first().click()
await page.waitForTimeout(150)
check('S5 나눠 줄 점검표가 있는 주제(벤처) + 릴스 → 댓글 받기 · 댓글형 글자 영상', /댓글 받기 · 댓글형/.test(await page.getByTestId('sht-qs-rec-label').innerText()), await page.getByTestId('sht-qs-rec-label').innerText())

/* ---------------- P 묶음 → 스레드 ---------------- */
await page.evaluate(() => localStorage.removeItem('mirae.mk.weekTopics.v1'))
await page.goto(BASE + '/marketing', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /예시로 보기/ }).first().click()
await page.getByTestId('mk-key').first().waitFor({ timeout: 15000 })
const keyTopic = (await page.getByTestId('mk-key').first().innerText()).split('\n').map((x) => x.trim()).filter((x) => x && !/^\d+$/.test(x))[0] ?? ''
await page.getByTestId('mk-key').first().click()
await page.getByTestId('mk-pack').waitFor({ timeout: 15000 })
const packTopic = (await page.getByTestId('mk-pack-topic').innerText()).trim()
check('P1 묶음 화면에 "같은 주제로 다른 채널" — 스레드 · 릴스 · 틱톡 단추', (await page.getByTestId('mk-pack-to-threads').count()) === 1 && (await page.getByTestId('mk-pack-to-shorts').count()) === 1, keyTopic)
check('P2 예시 데이터(유튜브 연결 전)는 이번 주 키워드 칩으로 두지 않음', (await page.evaluate(() => localStorage.getItem('mirae.mk.weekTopics.v1'))) === null)
await clearDrafts(page)
await page.getByTestId('mk-pack-to-threads').click()
await page.getByTestId('thr-qs').waitFor({ timeout: 15000 })
await page.waitForTimeout(200)
check('P3 [스레드 글 쓰기] → 주제가 채워짐 · 추천 형식이 정해짐 · 주소의 주제는 지움 · 바로 [AI로 바로 쓰기] 가능', (await page.getByTestId('thr-qs-topic').inputValue()) === packTopic && /추천 형식/.test(await page.getByTestId('thr-qs-rec').innerText()) && !page.url().includes('topic=') && !(await page.getByTestId('thr-qs-ai').isDisabled()), packTopic)
await page.goBack({ waitUntil: 'networkidle' })
await page.getByTestId('mk-pack').waitFor({ timeout: 15000 }).catch(() => {})
await page.getByTestId('mk-pack-to-shorts').click()
await page.getByTestId('sht-qs').waitFor({ timeout: 15000 })
check('P4 [릴스 · 틱톡 대본 쓰기] → 주제 · 추천 형식', (await page.getByTestId('sht-qs-topic').inputValue()) === packTopic && /추천 형식/.test(await page.getByTestId('sht-qs-rec').innerText()))
console.log('MEASURE pack->threads clicks=3 typed=0 (키워드 1 + 스레드 글 쓰기 1 + AI 1)')

/* ---------------- D 예전 주소 ---------------- */
const deep = []
for (const [u, id] of [
  ['/marketing/threads?tab=records', 'thr-records'],
  ['/marketing/threads?tab=library', 'thr-library'],
  ['/marketing/threads?tab=routine', 'thr-routine'],
  ['/marketing/shorts?tab=records', 'sht-records'],
  ['/marketing/shorts?tab=guide', 'sht-guide'],
]) {
  await page.goto(BASE + u, { waitUntil: 'networkidle' })
  deep.push((await page.getByTestId(id).waitFor({ timeout: 8000 }).then(() => true).catch(() => false)) ? '' : u)
}
check('D1 예전 주소(기록표 · 틀 · 10분 · 공식) 그대로 열림', deep.every((x) => !x), deep)
check('D2 PC — JS 오류 0', errors.length === 0, errors)

/* ---------------- M 휴대폰 · 큰 글자 ---------------- */
for (const [w, scale] of [[360, ''], [390, ''], [430, ''], [360, 'extra_large']]) {
  const tag = `${w}${scale ? '-large' : ''}`
  const m = await browser.newContext({ viewport: { width: w, height: 820 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const mp = await m.newPage()
  const errs = []
  mp.on('pageerror', (e) => errs.push(String(e)))
  mp.on('dialog', (d) => void d.accept())
  await wire(mp)
  await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
  await mp.evaluate(seedScript())
  await clearDrafts(mp)
  await seedWeek(mp)
  if (scale) await mp.evaluate((s) => localStorage.setItem('axmvp.ui.preferences', JSON.stringify({ ...JSON.parse(localStorage.getItem('axmvp.ui.preferences') ?? '{}'), textScale: s })), scale)
  for (const [kind, pre] of [['threads', 'thr'], ['shorts', 'sht']]) {
    await mp.goto(`${BASE}/marketing/${kind}`, { waitUntil: 'networkidle' })
    await mp.getByTestId(`${pre}-qs`).waitFor({ timeout: 15000 })
    await mp.locator(`[data-testid="${pre}-qs-week"] [data-testid="${pre}-qs-chip"]`).first().click()
    const aiY = await yOf(mp, `${pre}-qs-ai`)
    const pageH = await mp.evaluate(() => document.documentElement.scrollHeight)
    await mp.getByTestId(`${pre}-qs-ai`).click()
    await mp.getByTestId(`${pre}-ai-drafts`).waitFor({ timeout: 20000 })
    await mp.waitForTimeout(250)
    const btnH = await mp.locator(`[data-testid="${pre}-qs-ai"], [data-testid="${pre}-qs-chip"]`).evaluateAll((xs) => xs.map((x) => Math.round(x.getBoundingClientRect().height)))
    const was = BEFORE_Y[`${kind} ${tag}`]
    console.log(`MEASURE ${kind}-after ${tag} aiButtonY=${aiY} pageH=${pageH} (before ${was})`)
    check(`M ${tag} ${kind}: 넘침 0 · AI 단추 · 칩 44px 이상 · 1안이 칸에 · AI 단추가 예전보다 35% 넘게 위(${was} → ${aiY}px)`, (await overflowX(mp)) <= 0 && btnH.every((h) => h >= 44) && (await mp.getByTestId(pre === 'thr' ? 'thr-body' : 'sht-script').inputValue()).length > 0 && aiY < was * 0.65, { over: await overflowX(mp), btnH, aiY, was })
  }
  check(`M ${tag}: JS 오류 0`, errs.length === 0, errs)
  await m.close()
}

/* ---------------- X 감사에서 찾은 P0 ---------------- */
// X1 특허·MVP 프로젝트 — 저장이 실패해도 적은 내용은 화면에 그대로(예전: 서버 값으로 덮어씀) · [다시 저장]
await page.goto(`${BASE}/studio/${SEED_PROJECT_ID}`, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: '프로젝트 설정' }).click()
const titleInput = page.getByLabel('프로젝트 이름')
await titleInput.waitFor({ timeout: 8000 })
await page.evaluate(() => {
  const orig = Storage.prototype.setItem
  window.__restoreSet = () => (Storage.prototype.setItem = orig)
  Storage.prototype.setItem = function (k, v) {
    if (String(k).includes('consulting_projects')) throw new DOMException('quota', 'QuotaExceededError')
    return orig.call(this, k, v)
  }
})
await titleInput.fill('저장 실패 시험 — 적은 이름')
await titleInput.press('Enter')
await page.getByTestId('cs-save-failed').waitFor({ timeout: 8000 }).catch(() => {})
check('X1 특허·MVP 저장 실패 → "적은 내용은 그대로" 알림 · 적은 이름이 칸에 남음(서버 값으로 덮지 않음)', (await page.getByTestId('cs-save-failed').count()) === 1 && (await titleInput.inputValue()) === '저장 실패 시험 — 적은 이름')
await page.evaluate(() => window.__restoreSet())
await page.keyboard.press('Escape')
await page.waitForTimeout(200)
await page.getByTestId('cs-save-retry').click()
await page.waitForTimeout(600)
const savedTitle = await page.evaluate(() => (JSON.parse(localStorage.getItem('axmvp.v1.consulting_projects') ?? '[]').find((p) => p.id === 'proj_hansol') ?? {}).title)
check('X2 [다시 저장] → 저장됨 · 알림 사라짐', (await page.getByTestId('cs-save-failed').count()) === 0 && savedTitle === '저장 실패 시험 — 적은 이름', savedTitle)
// X3 AX 고객사 '운영 파일' — 이어진 업체가 있을 때만 · 그 업체로
let orgs = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.organizations') ?? '[]').filter((o) => !o.archivedAt).map((o) => ({ id: o.id, link: o.clientOpsId ?? '' })))
if (!orgs.length) {
  // 시험 기기에는 AX 고객사가 없을 수 있다 — 고객사 하나를 만들어 둔다(고객사 화면이 읽는 모양 그대로)
  await page.evaluate(() => {
    const now = new Date().toISOString()
    const org = { id: 'org_mux_e2e', name: '먹스 시험 고객사', businessRegistrationNumber: '', industry: '제조', subIndustry: '', businessType: 'corporation', foundedAt: null, employeeCount: null, annualRevenue: null, region: '서울', address: '', website: '', primaryContact: { name: '담당', position: '', phone: '', email: '' }, status: 'active', healthStatus: 'healthy', notes: '', createdAt: now, updatedAt: now, archivedAt: null }
    localStorage.setItem('axmvp.v1.organizations', JSON.stringify([...JSON.parse(localStorage.getItem('axmvp.v1.organizations') ?? '[]'), org]))
  })
  orgs.push({ id: 'org_mux_e2e', link: '' })
}
if (orgs.length >= 1) {
  const o = orgs[0]
  await page.evaluate((id) => {
    const list = JSON.parse(localStorage.getItem('axmvp.v1.organizations') ?? '[]')
    localStorage.setItem('axmvp.v1.organizations', JSON.stringify(list.map((x) => (x.id === id ? { ...x, clientOpsId: undefined } : x))))
  }, o.id)
  await page.goto(`${BASE}/clients/${o.id}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const noLink = (await page.getByTestId('org-ops-file').count()) === 0
  await page.evaluate((id) => {
    const list = JSON.parse(localStorage.getItem('axmvp.v1.organizations') ?? '[]')
    localStorage.setItem('axmvp.v1.organizations', JSON.stringify(list.map((x) => (x.id === id ? { ...x, clientOpsId: 'cli_hansol' } : x))))
  }, o.id)
  await page.goto(`${BASE}/clients/${o.id}`, { waitUntil: 'networkidle' })
  await page.getByTestId('org-ops-file').click()
  await page.waitForURL(/\/ops\/clients\/cli_hansol/, { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(500)
  check('X3 AX 고객사 "운영 파일" — 이어진 업체가 없으면 단추 없음 · 있으면 그 업체 화면(업체를 찾을 수 없음 아님)', noLink && /\/ops\/clients\/cli_hansol/.test(page.url()) && !/찾을 수 없/.test(await page.locator('main').innerText()), { noLink, url: page.url() })
} else {
  check('X3 AX 고객사 목록이 비어 있음 — 시험할 고객사 없음', false, orgs)
}
check('X4 PC 마지막까지 JS 오류 0', errors.length === 0, errors)

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
