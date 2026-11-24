/**
 * qa:record — D-654 미팅 녹음 요약(대표만) 끝까지 이어 보기.
 *
 * 브라우저 → /api/ai-assist 는 진짜 서버 함수(api/ai-assist.js)를 이 프로세스에서 부른다(Playwright route).
 * 밖으로 나가는 것만 가짜: Supabase 로그인 확인 · 권한 RPC · Gemini. 마이크는 크롬 시험용 가짜 장치(삐 소리).
 * 조각 길이는 시험에서만 2.5초(전역 __recChunkMs) — 평소에는 2분.
 *
 *   R1 미팅 메모 탭 — 처음엔 [녹음해서 적기] 한 줄(보라 테두리 · 판 없음)
 *   R2 누르면 동의 안내('녹음해도 될까요?' · 녹음은 남기지 않음) · [취소] → 다시 한 줄 · AI 호출 0
 *   R3 [동의 받았어요 · 녹음 시작] → 녹음 중 · 시각이 흐름 · 조각마다 받아 적기(Gemini 에 소리 inlineData · 글 앞 · [녹음] n번째 조각) · 다른 회사 0
 *   R4 [멈추고 정리] → 정리 1번(소리 없이 · 받아 적은 말이 [자료]) → 메모 칸에 '[녹음 정리 · n분 녹음]' + 직원 18명 · 2차 미팅 · 할 일
 *   R5 메모 칸 [기록] → 업무 일기 + 업체 기록(직원 수 · 다음 약속) — 미팅 메모 기존 길 그대로
 *   R6 받아 적은 글 전체(접힘) · 시각 · 말한 사람 · [복사]
 *   R7 저장소(localStorage · sessionStorage)에 소리 원본 · base64 0
 *   R8 받아 적기 실패(AI 붐빔) → '못 받아 적은 1구간 다시' → 누르면 그 구간만 다시 → 정리
 *   R9 [버리기] 한 번은 '정말 버리기' 로만 · 두 번째에 버림 → 정리 호출 0 · 다시 한 줄
 *   R10 390 — 녹음 판 · 메모 칸 옆 넘침 0 · 단추 40px 이상
 *   R11 JS 오류 0
 */
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { seedScript } from './seed.mjs'

const fromRoot = (p) => import(pathToFileURL(path.resolve(p)).href)
const { default: handler, __resetAiAssistState } = await fromRoot('api/ai-assist.js')

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.argv[3] ?? ''
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
const shot = async (page, name) => {
  if (!SHOTS) return
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.mouse.move(2, 2)
  await page.waitForTimeout(900)
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) })
}

const OWNER = 'Bearer owner-e2e-token-aaaaaaaaaaaa'
const G_KEY = 'gem-e2e-SECRET-445566'
for (const k of Object.keys(process.env)) if (/^(AI_|OPENAI_|SUPABASE_|GEMINI_|GOOGLE_API|ANTHROPIC_API|CLAUDE_API)/.test(k)) delete process.env[k]
Object.assign(process.env, { SUPABASE_URL: 'https://qa.supabase.test', SUPABASE_ANON_KEY: 'qa-anon', GEMINI_API_KEY: G_KEY, AI_ASSIST_RATE_PER_MIN: '200', AI_ASSIST_RATE_PER_HOUR: '2000' })
__resetAiAssistState()

/** 공급자에 간 요청 */
const llm = []
/** 받아 적기 실패를 흉내 낼 조각 번호(없으면 -1) */
let failIndex = -1
const HEARD = [
  [{ title: '0:00', tag: '대표님', body: '직원은 지금 18명이고 작년 매출이 52억 정도 됩니다' }],
  [{ title: '0:01', tag: '컨설턴트', body: '청년 채용 계획은 있으세요?' }, { title: '0:02', tag: '대표님', body: '네 청년 2명 뽑을 예정이에요' }],
  [{ title: '0:00', tag: '대표님', body: '다음 주 화요일 오후 2시에 2차 미팅 하시죠' }],
]
const SUMMARY = {
  headline: '청년 채용 · 고용지원금 상담',
  items: [
    { title: '직원 18명', tag: '숫자', when: '0:00' },
    { title: '작년 매출 52억', tag: '숫자', when: '0:00' },
    { title: '청년 2명 뽑을 예정', tag: '사정', when: '2:31' },
    { title: '다음 주 화요일 오후 2시 2차 미팅', tag: '약속', when: '5:00' },
    { title: '4대보험 가입자 명부 받기', tag: '할 일' },
  ],
  next: ['4대보험 가입자 명부 받기'],
  caution: '',
}
const realFetch = globalThis.fetch
globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  const h = init.headers ?? {}
  if (url.startsWith('https://qa.supabase.test/auth/v1/user')) return new Response(JSON.stringify({ id: 'owner-1' }), { status: h.Authorization === OWNER ? 200 : 401 })
  if (url.startsWith('https://qa.supabase.test/rest/v1/rpc/has_capability')) return new Response(JSON.stringify(h.Authorization === OWNER), { status: 200 })
  if (url.startsWith('https://qa.supabase.test/rest/v1/rpc/my_os_access')) return new Response(JSON.stringify('full'), { status: 200 })
  if (url.startsWith('https://qa.supabase.test/')) return new Response(JSON.stringify({ code: 'PGRST202', message: 'not here' }), { status: 404 })
  if (url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent')) {
    const body = JSON.parse(String(init.body ?? '{}'))
    const sys = String(body.systemInstruction?.parts?.[0]?.text ?? '')
    const parts = body.contents?.[0]?.parts ?? []
    const audio = parts.find((p) => p.inlineData)?.inlineData ?? null
    const text = String(parts.find((p) => typeof p.text === 'string')?.text ?? '')
    const idx = Number((/(\d+)번째 조각/.exec(text) ?? [])[1] ?? 0) - 1
    llm.push({ url, sys, text, audio: audio ? { mime: audio.mimeType, bytes: Math.floor((audio.data.length * 3) / 4) } : null, first: parts[0] && parts[0].inlineData ? 'audio' : 'text', idx })
    if (sys.includes('(meeting.transcribe') && idx === failIndex) return new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status: 503 })
    const answer = sys.includes('(meeting.transcribe') ? { headline: '미팅 조각', items: HEARD[Math.max(0, idx) % HEARD.length], next: [], caution: '' } : sys.includes('(meeting.summary') ? SUMMARY : { headline: '?', items: [] }
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 120 } }), { status: 200 })
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

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] })

async function openMemo(viewport) {
  const ctx = await browser.newContext({ viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['microphone', 'clipboard-read', 'clipboard-write'] })
  await ctx.addInitScript(() => {
    globalThis.__recChunkMs = 2500
  })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  await wire(page)
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart&talk=1', { waitUntil: 'networkidle' })
  await page.getByTestId('talk-sheet').waitFor({ timeout: 10000 })
  await page.locator('[data-testid="talk-tab"][data-key="memo"]').click()
  await page.getByTestId('talk-memo').waitFor()
  return { ctx, page, errs }
}

/* ---------------- R1 · R2 ---------------- */
const { ctx, page, errs } = await openMemo({ width: 1440, height: 900 })
const rec = page.getByTestId('rec')
const openBtn = page.getByTestId('rec-open')
check('R1 미팅 메모 탭 — 처음엔 [녹음해서 적기] 한 줄(판 없음) · 기능 안내 열쇠', (await openBtn.count()) === 1 && (await rec.getAttribute('data-phase')) === 'idle' && (await openBtn.getAttribute('data-guide')) === 'fn-meeting-record')
await openBtn.click()
const consent = await page.getByTestId('rec-consent').innerText()
check('R2 누르면 동의 안내 — 녹음해도 될까요? · 녹음은 남기지 않음', /녹음해도 될까요/.test(consent) && /녹음은 남기지 않/.test(consent), consent)
await page.getByTestId('rec-cancel').click()
check('R2-1 [취소] → 다시 한 줄 · AI 호출 0', (await rec.getAttribute('data-phase')) === 'idle' && llm.length === 0)

/* ---------------- R3 · R4 ---------------- */
await openBtn.click()
await page.getByTestId('rec-start').click()
await page.getByTestId('rec-live').waitFor({ timeout: 8000 })
await page.waitForTimeout(1500)
const t1 = await page.getByTestId('rec-time').innerText()
await shot(page, 'record-live-pc')
// 두 조각(2.5초씩)이 받아 적힐 때까지
await page.waitForFunction(() => Number(document.querySelector('[data-testid="rec-progress"]')?.getAttribute('data-done') ?? 0) >= 2, null, { timeout: 20000 }).catch(() => {})
const t2 = await page.getByTestId('rec-time').innerText()
const heardCalls = llm.filter((c) => c.sys.includes('(meeting.transcribe'))
check(
  'R3 녹음 중 — 시각이 흐름 · 조각마다 받아 적기 · Gemini 에 소리가 글 앞(inlineData · audio/webm · 1KB 넘음) · 글에 [녹음] n번째 조각 · 다른 회사 0',
  t1 !== t2 && heardCalls.length >= 2 && heardCalls.every((c) => c.first === 'audio' && /^audio\/(webm|ogg|mp4)$/.test(c.audio?.mime ?? '') && c.audio.bytes > 1000 && /\[녹음\] .*번째 조각/.test(c.text)) && llm.every((c) => c.url.includes('generativelanguage')),
  { t1, t2, heard: heardCalls.map((c) => ({ mime: c.audio?.mime, bytes: c.audio?.bytes, idx: c.idx })) },
)
const before = llm.length
await page.getByTestId('rec-stop').click()
await page.getByTestId('rec-done').waitFor({ timeout: 30000 })
const sumCalls = llm.slice(before).filter((c) => c.sys.includes('(meeting.summary'))
const memoBox = page.getByTestId('talk-memo').locator('textarea[aria-label="기록 내용"]')
const memoText = await memoBox.inputValue()
check(
  'R4 [멈추고 정리] → 정리 1번(소리 없이 글만 · 받아 적은 말이 감) → 메모 칸에 [녹음 정리 · n분 녹음] + 직원 18명 · 2차 미팅 · 할 일',
  sumCalls.length === 1 && sumCalls[0].audio === null && sumCalls[0].text.includes('직원은 지금 18명') && /^\[녹음 정리 · \d+분 녹음\] 청년 채용/.test(memoText) && memoText.includes('· 직원 18명') && memoText.includes('· 다음 주 화요일 오후 2시 2차 미팅') && memoText.includes('· 할 일: 4대보험 가입자 명부 받기'),
  { sum: sumCalls.length, memoText },
)
await shot(page, 'record-done-pc')

/* ---------------- R6 ---------------- */
await page.getByTestId('rec-heard').locator('summary').click()
const heardText = await page.getByTestId('rec-heard-text').innerText()
await page.getByTestId('rec-heard-copy').click()
const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''))
check('R6 받아 적은 글 전체 — 시각 · 말한 사람 · 조각 순서대로 · [복사] = 보이는 글', /^\[0:0\d\] 대표님: 직원은 지금 18명/.test(heardText) && heardText.includes('컨설턴트: 청년 채용 계획은') && clip.trim() === heardText.trim(), heardText.slice(0, 300))

/* ---------------- R7 ---------------- */
const stores = await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))
check('R7 저장소에 소리 원본 0 — base64 소리 머리(GkXf · T2dn · AAAA) · 긴 base64 덩어리 없음', !/GkXf[A-Za-z0-9+/]{200}|T2dnUw[A-Za-z0-9+/]{200}|[A-Za-z0-9+/]{4000}/.test(stores), stores.length)

/* ---------------- R5 ---------------- */
const journalBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]').filter((e) => e.clientId === 'cli_hansol').length)
await page.getByTestId('talk-memo').getByRole('button', { name: '기록', exact: true }).click()
await page.locator('[data-testid="talk-memo-talk"][data-saved="1"]').waitFor({ timeout: 10000 }).catch(() => {})
await page.waitForTimeout(500)
const hr = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((c) => c.id === 'cli_hansol') ?? {})
const journalAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]').filter((e) => e.clientId === 'cli_hansol').length)
check('R5 메모 칸 [기록] → 업무 일기 한 줄 + 업체 기록(직원 18명 · 다음 할 일 2차 미팅) — 미팅 메모 기존 길 그대로', journalAfter === journalBefore + 1 && hr.employeeCount === '18명' && /2차 미팅/.test(hr.nextAction ?? '') && !!hr.nextActionDueDate, { journalBefore, journalAfter, e: hr.employeeCount, n: hr.nextAction, d: hr.nextActionDueDate })

/* ---------------- R8 실패 → 다시 ---------------- */
await page.getByTestId('rec-again').click()
failIndex = 0
await page.getByTestId('rec-start').click()
await page.getByTestId('rec-live').waitFor({ timeout: 8000 })
await page.waitForTimeout(3200)
await page.getByTestId('rec-stop').click()
await page.getByTestId('rec-done').waitFor({ timeout: 45000 })
const retryBtn = page.getByTestId('rec-retry')
const retryShown = (await retryBtn.count()) === 1 ? await retryBtn.innerText() : ''
const errText = (await page.getByTestId('rec-error').count()) ? await page.getByTestId('rec-error').first().innerText() : ''
failIndex = -1
const beforeRetry = llm.length
if (retryShown) await retryBtn.click()
await page.waitForFunction(() => document.querySelector('[data-testid="rec"]')?.getAttribute('data-phase') === 'done' && !document.querySelector('[data-testid="rec-retry"]'), null, { timeout: 30000 }).catch(() => {})
await page.waitForTimeout(400)
const afterRetry = llm.slice(beforeRetry)
check(
  'R8 받아 적기 실패(AI 붐빔) → [못 받아 적은 1구간 다시] · 오류 한 줄 → 누르면 그 구간만 다시 받아 적고 정리',
  /못 받아 적은 1구간/.test(retryShown) && !!errText && afterRetry.filter((c) => c.sys.includes('(meeting.transcribe')).length === 1 && afterRetry.filter((c) => c.sys.includes('(meeting.summary')).length === 1 && (await page.getByTestId('rec-retry').count()) === 0,
  { retryShown, errText, after: afterRetry.map((c) => (c.sys.includes('(meeting.summary') ? 'sum' : `tr${c.idx}`)) },
)

/* ---------------- R9 버리기 ---------------- */
await page.getByTestId('rec-again').click()
await page.getByTestId('rec-start').click()
await page.getByTestId('rec-live').waitFor({ timeout: 8000 })
await page.waitForTimeout(800)
await page.getByTestId('rec-discard').click()
const ask = await page.getByTestId('rec-discard').innerText()
const stillRec = (await rec.getAttribute('data-phase')) === 'recording'
const beforeDiscard = llm.filter((c) => c.sys.includes('(meeting.summary')).length
await page.getByTestId('rec-discard').click()
await page.waitForTimeout(3500)
check(
  "R9 [버리기] 한 번은 '정말 버리기' 로만(녹음 계속) · 두 번째에 버림 → 다시 한 줄 · 정리 호출 0",
  ask === '정말 버리기' && stillRec && (await rec.getAttribute('data-phase')) === 'idle' && llm.filter((c) => c.sys.includes('(meeting.summary')).length === beforeDiscard ,
  { ask, stillRec },
)
check('R11 JS 오류 0(PC)', errs.length === 0, errs)
await ctx.close()

/* ---------------- R10 390 ---------------- */
{
  const m = await openMemo({ width: 390, height: 844 })
  await m.page.getByTestId('rec-open').click()
  await m.page.getByTestId('rec-start').click()
  await m.page.getByTestId('rec-live').waitFor({ timeout: 8000 })
  await m.page.waitForTimeout(800)
  const geo = await m.page.evaluate(() => {
    const sheet = document.querySelector('[data-testid="talk-sheet"]')
    const box = document.querySelector('[data-testid="rec"]').getBoundingClientRect()
    const btns = [...document.querySelectorAll('[data-testid="rec"] button')].map((b) => Math.round(b.getBoundingClientRect().height))
    return { over: document.documentElement.scrollWidth - window.innerWidth, sheetOver: sheet ? sheet.scrollWidth - sheet.clientWidth : 0, right: Math.round(box.right), btns }
  })
  await shot(m.page, 'record-live-390')
  await m.page.getByTestId('rec-stop').click()
  await m.page.getByTestId('rec-done').waitFor({ timeout: 30000 })
  await m.page.waitForTimeout(900)
  const memoInView = await m.page.evaluate(() => {
    const t = document.querySelector('[data-testid="talk-memo"] textarea[aria-label="기록 내용"]')
    if (!t) return null
    const r = t.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: window.innerHeight, text: t.value.slice(0, 20) }
  })
  const toastOver = await m.page.getByText('녹음을 정리해 아래 메모 칸에').count()
  check('R10-1 390 — 정리가 끝나면 메모 칸이 화면 안으로(넣은 글이 보임) · 창 제목 · [기록] 을 가리는 알림 0', !!memoInView && memoInView.top >= 0 && memoInView.top < memoInView.h - 40 && memoInView.text.startsWith('[녹음 정리') && toastOver === 0, { memoInView, toastOver })
  await shot(m.page, 'record-done-390')
  check('R10 390 — 녹음 판 · 메모 칸 옆 넘침 0 · 판이 화면 안 · 단추 40px 이상', geo.over <= 0 && geo.sheetOver <= 0 && geo.right <= 390 && geo.btns.every((h) => h >= 40), geo)
  check('R11 JS 오류 0(390)', m.errs.length === 0, m.errs)
  await m.ctx.close()
}

await browser.close()
console.log(`\nrecord: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
