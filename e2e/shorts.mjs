/**
 * D-273 마케팅 · 브랜딩 › 릴스 · 틱톡 — 대표 "릴스 틱톡 파트도 따로 · 60대도 쓸 수 있게 쉽고 간편하게".
 * 브라우저 → /api/ai-assist 는 진짜 서버 함수(api/ai-assist.js)를 이 프로세스에서 부른다(qa:mkpack 과 같은 방식). 밖으로 나가는 것만 가짜.
 *
 *   N  목차 — 마케팅 목차에 [릴스 · 틱톡] · 켜짐 · 안쪽 칸 3개 · "이것만 지키면 돼요" 4줄
 *   W  ① 어디에(2) ② 무엇을(2 · 플랫폼마다 이름이 다름) ③ 맞는 형식만 → 예시 대본 → 길이 · 첫마디 · 규칙 검사 고칠 것 0
 *      인사로 시작 · 많이 보이게에 상담 안내 → 고칠 것 · 릴스로 바꾸면 형식 · 캡션 기준이 바뀜(시연은 25초판)
 *   A  [AI로 대본 2개 쓰기] → shorts.write(숏폼 규칙 · 숏폼 공식 · 사실 목록 · 고른 플랫폼 · 형식) → 2개 · [이 대본으로 고치기] → 캡션 · 해시태그 · 확인할 것
 *   S  저장 · 올렸어요 → 기록표 · 숫자 → 점수(좋아요 + 댓글×3) · 저장 · 공유율 · 형식별 평균 · 새로고침해도 남음 · 지우기 한 번 더 묻기
 *   G  형식 · 공식 — 형식 5 · [이 형식으로 만들기] → 만들기 칸에 그 형식
 *   M  360 · 390 · 430 · 큰 글자 — 넘침 0 · 고르기 단추 44px 이상 · JS 오류 0
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import fs from 'node:fs'
import { seedScript } from './seed.mjs'

const fromRoot = (p) => import(pathToFileURL(path.resolve(p)).href)
const { default: handler, __resetAiAssistState } = await fromRoot('api/ai-assist.js')

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.SHORTS_SHOTS ?? ''
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
const shot = async (page, name, full = true) => {
  if (!SHOTS) return
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full })
}

const OWNER = 'Bearer owner-e2e-token-aaaaaaaaaaaa'
for (const k of Object.keys(process.env)) if (/^(AI_|OPENAI_|SUPABASE_|GEMINI_|GOOGLE_API|ANTHROPIC_API|CLAUDE_API)/.test(k)) delete process.env[k]
Object.assign(process.env, { SUPABASE_URL: 'https://qa.supabase.test', SUPABASE_ANON_KEY: 'qa-anon', GEMINI_API_KEY: 'gem-e2e-SECRET-1', ANTHROPIC_API_KEY: 'ant-e2e-SECRET-2', AI_ASSIST_RATE_PER_MIN: '100', AI_ASSIST_RATE_PER_HOUR: '500' })
__resetAiAssistState()

const llm = []
const ANSWER = {
  headline: '창업 3년 안 벤처확인 세금 — 숏폼',
  items: [
    { title: '창업 3년 안이면,', tag: '리스트형', when: '약 35초', body: '[0:00] 창업 3년 안이면,  (화면 큰 글자: 창업 3년 안)\n[0:02] 이거 모르면 세금 더 내요.\n[0:05] 딱 두 가지만 보세요.\n[0:08] 첫째, 시점. 3년 안에 확인받아야 해요.\n[0:18] 둘째, 근거. [특허 출원 여부 확인]\n[0:30] 둘 다 걸리면 지금 따져 볼 때예요.', detail: '창업 3년 안 대표님만 (요건 충족 시 · 결과는 확인기관이 정합니다)', outline: ['#벤처기업확인', '#창업', '#세금'] },
    { title: '이거 아직 손으로 해요?', tag: '화면 시연형', when: '약 40초', body: '[0:00] 이거 아직 손으로 해요?\n[0:03] 주문서 보고 엑셀 두 번.\n[0:30] 프로필에서 3분 진단부터 해 보세요.', detail: '매일 반복되는 일 하나부터', outline: ['#AX', '#업무자동화', '#중소기업'] },
  ],
  next: ['[특허 출원 여부 확인]', '실제로 만든 화면인지'],
}
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
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(ANSWER) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 2100, candidatesTokenCount: 320 } }), { status: 200 })
  }
  if (url.includes('api.anthropic.com/v1/messages')) {
    const body = JSON.parse(String(init.body ?? '{}'))
    const sys = String(body.system ?? '')
    llm.push({ sys, user: String(body.messages?.[0]?.content ?? '') })
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(ANSWER) }], usage: { input_tokens: 1500, output_tokens: 200 }, stop_reason: 'end_turn', model: body.model }), { status: 200 })
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
const lintKeys = (p, level) => p.locator(`[data-testid="sht-lint"] li${level ? `[data-level="${level}"]` : ''}`).evaluateAll((xs) => xs.map((x) => x.getAttribute('data-key')))
const open = async (p, q = '') => {
  await p.goto(`${BASE}/marketing/shorts${q}`, { waitUntil: 'networkidle' })
  await p.getByTestId('sht-page').waitFor({ timeout: 15000 })
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => void d.accept())
await wire(page)
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(seedScript())
await page.evaluate(() => localStorage.removeItem('mirae.shorts.draft.v1'))

/* ---------------- N 목차 ---------------- */
await open(page)
const tabLink = page.getByTestId('mk-tab-shorts')
check('N1 마케팅 목차에 [릴스 · 틱톡] · 이 화면에서 켜짐 · 스레드와 따로', (await tabLink.count()) === 1 && (await tabLink.getAttribute('aria-current')) === 'page' && (await page.getByTestId('mk-tab-threads').count()) === 1)
check('N2 안쪽 칸 3개(오늘 만들 영상 · 기록표 · 형식 · 공식) · "이것만 지키면 돼요" 4줄', (await page.locator('[data-testid^="sht-tab-"]').count()) === 3 && (await page.locator('[data-testid="sht-basics"] li').count()) === 4)
await shot(page, 'pc-write-empty', false)

/* ---------------- W 만들기 ---------------- */
await page.getByTestId('sht-platform-tiktok').click()
await page.getByTestId('sht-aim-reach').click()
await page.waitForFunction(() => document.querySelectorAll('[data-testid="sht-formats"] [data-testid^="sht-format-"]').length === 4, null, { timeout: 5000 }).catch(() => {})
const fmts = await page.locator('[data-testid="sht-formats"] [data-testid^="sht-format-"]').evaluateAll((xs) => xs.map((x) => x.getAttribute('data-testid')))
check('W1 틱톡 · 많이 보이게 → 형식 4개(리스트 · 대화 · 시연 · 금지)', fmts.join() === 'sht-format-list,sht-format-talk,sht-format-demo,sht-format-ban', fmts)
await page.getByTestId('sht-format-list').click()
check('W2 형식 고르면 왜 되나 · [예시 대본으로 시작]', /저장 · 공유 1위/.test(await page.getByTestId('sht-format-detail').innerText()))
await page.getByTestId('sht-use-example').click()
await page.waitForTimeout(200)
check('W3 예시 대본 · 캡션 · 해시태그가 칸에 · 약 N초 · 첫마디 N자', /창업 3년 안이면/.test(await page.getByTestId('sht-script').inputValue()) && /확인기관/.test(await page.getByTestId('sht-caption').inputValue()) && /#벤처기업확인/.test(await page.getByTestId('sht-tags').inputValue()) && /약 3\d초 · 첫마디 \d+자/.test(await page.getByTestId('sht-seconds').innerText()))
check('W4 예시 대본 규칙 검사 — 고칠 것 0', (await lintKeys(page, 'bad')).length === 0, await lintKeys(page, 'bad'))
await page.getByTestId('sht-script').fill('[0:00] 합격률 30% 비결\n[0:03] AX 는 큰 가점 요소예요')
await page.waitForTimeout(150)
check('W4b 대표 운영 원칙(가점) 고칠 것 · 사실 목록에 없는 숫자(30%) 알림', (await lintKeys(page, 'bad')).includes('gajeom') && (await lintKeys(page, 'warn')).includes('numbers'))
await page.getByTestId('sht-use-example').click()
await page.waitForTimeout(150)
await shot(page, 'pc-write-example')
const ex = await page.getByTestId('sht-script').inputValue()
await page.getByTestId('sht-script').fill('안녕하세요 김팀장입니다.\n' + ex + '\n[0:40] 상담은 프로필 링크에서')
await page.waitForTimeout(150)
const bad = await lintKeys(page, 'bad')
check('W5 인사로 시작 · 많이 보이게에 상담 안내 → 고칠 것(greet · cta)', bad.includes('greet') && bad.includes('cta'), bad)
await page.getByTestId('sht-script').fill(ex)
await page.getByTestId('sht-platform-reels').click()
await page.waitForFunction(() => document.querySelectorAll('[data-testid="sht-formats"] [data-testid^="sht-format-"]').length === 2, null, { timeout: 5000 }).catch(() => {})
const rf = await page.locator('[data-testid="sht-formats"] [data-testid^="sht-format-"]').evaluateAll((xs) => xs.map((x) => x.getAttribute('data-testid')))
check('W6 릴스로 바꾸면 — 리스트형은 빠지고(형식 칸 비움) 릴스 많이 보이게 형식(시연 25초판 · 금지형)', rf.join() === 'sht-format-demo,sht-format-ban' && (await page.getByTestId('sht-format-detail').count()) === 0, rf)
check('W7 릴스 기준으로 다시 검사 — 35초 → 길이 알림(20~25초)', (await lintKeys(page, 'warn')).includes('length'))
await page.getByTestId('sht-aim-convert').click()
await page.waitForFunction(() => document.querySelectorAll('[data-testid="sht-formats"] [data-testid^="sht-format-"]').length === 1, null, { timeout: 5000 }).catch(() => {})
check('W8 릴스 · 댓글 받기 → 댓글형 글자 영상만', (await page.locator('[data-testid="sht-formats"] [data-testid^="sht-format-"]').count()) === 1 && (await page.getByTestId('sht-format-comment').count()) === 1)
await page.getByTestId('sht-format-comment').click()
check('W8b 댓글형 → 나눠 줄 자료(체크리스트 카드 6장)', (await page.getByTestId('sht-share-card').count()) === 6)
await page.getByTestId('sht-aim-reach').click()
await page.getByTestId('sht-format-demo').click()
await page.getByTestId('sht-use-example').click()
await page.waitForTimeout(150)
check('W9 릴스 화면 시연은 25초판(끝에 권유 없이) · 고칠 것 0', !/진단/.test(await page.getByTestId('sht-script').inputValue()) && (await lintKeys(page, 'bad')).length === 0)

/* ---------------- A AI 대본 ---------------- */
await page.getByTestId('sht-platform-tiktok').click()
await page.getByTestId('sht-aim-reach').click()
await page.getByTestId('sht-format-list').click()
await page.getByTestId('sht-topic-pick').first().click()
await page.getByTestId('sht-ai').click()
await page.getByTestId('sht-ai-drafts').waitFor({ timeout: 20000 })
const call = llm.find((x) => x.sys.includes('(shorts.write'))
check('A1 AI 대본 2개 · 형식 · 길이 · 고칠 것 수', (await page.getByTestId('sht-ai-draft').count()) === 2 && /리스트형/.test(await page.getByTestId('sht-ai-draft').first().innerText()) && /약 \d+초 · 고칠 것 \d/.test(await page.getByTestId('sht-ai-draft').first().innerText()))
check('A2 서버 지시 — 대표 운영 원칙(먼저) · 숏폼 규칙 · 기준 문서(숏폼 공식 · 사실 목록) · 스레드 · 마케팅 규칙 없음', !!call && call.sys.includes('[대표 운영 원칙') && call.sys.indexOf('[대표 운영 원칙') < call.sys.indexOf('[숏폼 규칙]') && call.sys.includes('[숏폼 규칙]') && call.sys.includes('[기준 문서]') && /김팀장 사실 목록/.test(call.sys) && !call.sys.includes('[스레드 규칙]') && !call.sys.includes('[마케팅 규칙]'))
check('A3 보낸 자료 — 틱톡 · 많이 보이게 · 리스트형 · 소재', !!call && /플랫폼: 틱톡 · 유튜브 쇼츠/.test(call.user) && /목적: 많이 보이게/.test(call.user) && /고른형식: 리스트형/.test(call.user) && /소재: 창업 3년 안 벤처확인 세금/.test(call.user), call?.user.slice(0, 400))
await shot(page, 'pc-ai-drafts')
await page.getByTestId('sht-ai-use').first().click()
await page.waitForTimeout(200)
check('A4 [이 대본으로 고치기] → 대본 · 캡션 · 해시태그 · 확인할 것', /둘 다 걸리면/.test(await page.getByTestId('sht-script').inputValue()) && /확인기관/.test(await page.getByTestId('sht-caption').inputValue()) && (await page.getByTestId('sht-tags').inputValue()) === '#벤처기업확인 #창업 #세금' && /특허 출원/.test(await page.getByTestId('sht-checks').innerText()))

/* ---------------- S 저장 · 기록표 ---------------- */
await page.getByTestId('sht-save').click()
await page.waitForTimeout(400)
await page.getByTestId('sht-tab-records').click()
await page.getByTestId('sht-records').waitFor()
await page.locator('[data-testid="sht-rec-drafts"] [data-testid="sht-rec-item"]').first().waitFor({ timeout: 5000 }).catch(() => {})
check('S1 [저장] → 만들다 둔 영상 1', (await page.locator('[data-testid="sht-rec-drafts"] [data-testid="sht-rec-item"]').count()) === 1)
await page.getByTestId('sht-rec-open').first().click()
await page.getByTestId('sht-posted').click()
await page.getByTestId('sht-records').waitFor()
await page.waitForTimeout(300)
const item = page.locator('[data-testid="sht-rec-list"] [data-testid="sht-rec-item"]').first()
check('S2 [올렸어요] → 올린 영상 1 · 틱톡 · 리스트형', (await page.locator('[data-testid="sht-rec-list"] [data-testid="sht-rec-item"]').count()) === 1 && /틱톡/.test(await item.innerText()) && /리스트형/.test(await item.innerText()))
for (const [k, v] of [['views', '1000'], ['likes', '20'], ['comments', '5'], ['saves', '3'], ['shares', '2'], ['inquiries', '1']]) {
  await item.getByTestId(`sht-stat-${k}`).fill(v)
  await item.getByTestId(`sht-stat-${k}`).blur()
  await page.waitForTimeout(120)
}
await page.waitForTimeout(300)
const sc = await page.getByTestId('sht-rec-score').first().innerText()
check('S3 숫자 → 점수 35(20 + 5×3) · 저장 · 공유율 0.5% · 형식별 평균 35', /점수 35/.test(sc) && /0\.5%/.test(sc) && /평균 35/.test(await page.getByTestId('sht-rec-formats').innerText()), sc)
await shot(page, 'pc-records')
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('sht-records').waitFor()
check('S4 새로고침해도 남음', (await page.locator('[data-testid="sht-stat-likes"]').first().inputValue()) === '20')
await page.getByTestId('sht-rec-del').first().click()
await page.getByTestId('sht-rec-del-confirm').waitFor({ timeout: 5000 }).catch(() => {})
check('S5 지우기 → 한 번 더 묻기', (await page.getByTestId('sht-rec-del-confirm').count()) === 1 && (await page.locator('[data-testid="sht-rec-item"]').count()) === 1)
await page.getByTestId('sht-rec-del-yes').click()
await page.waitForFunction(() => document.querySelectorAll('[data-testid="sht-rec-item"]').length === 0, null, { timeout: 5000 }).catch(() => {})
check('S6 [지우기] → 0개 · 빈 안내', (await page.locator('[data-testid="sht-rec-item"]').count()) === 0 && /아직 올린 영상이 없어요/.test(await page.getByTestId('sht-records').innerText()))

/* ---------------- G 형식 · 공식 ---------------- */
await page.getByTestId('sht-tab-guide').click()
await page.getByTestId('sht-guide').waitFor()
check('G1 형식 5 · 플랫폼 두 칸 · 댓글 받기 조건 4줄', (await page.getByTestId('sht-guide-card').count()) === 5 && (await page.locator('[data-testid="sht-comment-works"] li').count()) === 4)
await shot(page, 'pc-guide', false)
await page.locator('[data-testid="sht-guide-card"][data-key="comment"]').locator('xpath=ancestor::article').getByTestId('sht-guide-use').click()
await page.getByTestId('sht-write').waitFor()
check('G2 [이 형식으로 만들기] → 릴스 · 댓글 받기 · 댓글형 골라짐', (await page.getByTestId('sht-platform-reels').getAttribute('aria-checked')) === 'true' && (await page.getByTestId('sht-aim-convert').getAttribute('aria-checked')) === 'true' && (await page.getByTestId('sht-format-comment').getAttribute('aria-pressed')) === 'true')
await page.getByTestId('sht-tab-guide').click()
await page.getByTestId('sht-guide').waitFor()
check('G4 형식 · 공식 — 이렇게 말고 → 이렇게 표 · 나눠 줄 자료', (await page.locator('[data-testid="sht-rewrites"] li').count()) >= 10 && (await page.getByTestId('sht-guide-share-card').count()) === 6)
await page.getByTestId('sht-tab-write').click()
await page.getByTestId('sht-topic').fill('매일 반복되는 일 하나 화면으로 바꾸기')
await page.getByTestId('sht-to-threads').click()
await page.getByTestId('thr-page').waitFor()
check('G5 [같은 소재로 스레드 글] → 스레드 화면 · 소재가 채워짐', (await page.getByTestId('thr-topic').inputValue()) === '매일 반복되는 일 하나 화면으로 바꾸기')
check('G3 PC — JS 오류 0', errors.length === 0, errors)

/* ---------------- M 휴대폰 ---------------- */
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
  if (scale) await mp.evaluate((s) => localStorage.setItem('axmvp.ui.text_scale', JSON.stringify(s)), scale)
  await open(mp)
  await mp.getByTestId('sht-platform-tiktok').click()
  await mp.getByTestId('sht-aim-reach').click()
  await mp.getByTestId('sht-format-list').click()
  await mp.getByTestId('sht-use-example').click()
  await mp.waitForTimeout(250)
  const hs = await mp.locator('[data-testid^="sht-platform-"], [data-testid^="sht-aim-"], [data-testid^="sht-tab-"]').evaluateAll((xs) => xs.map((x) => Math.round(x.getBoundingClientRect().height)))
  check(`M ${tag}: 만들기 — 넘침 0 · 고르기 단추 · 안쪽 칸 44px 이상`, (await overflowX(mp)) <= 0 && hs.every((h) => h >= 44), { over: await overflowX(mp), hs })
  if (w === 390 && !scale) await shot(mp, 'm390-write')
  if (scale) await shot(mp, 'm360-large-write')
  await mp.getByTestId('sht-posted').click()
  await mp.getByTestId('sht-records').waitFor()
  await mp.waitForTimeout(250)
  check(`M ${tag}: 기록표 — 넘침 0 · 숫자 칸 6개`, (await overflowX(mp)) <= 0 && (await mp.locator('[data-testid^="sht-stat-"]').count()) === 6, await overflowX(mp))
  if (w === 390 && !scale) await shot(mp, 'm390-records')
  await mp.getByTestId('sht-tab-guide').click()
  await mp.waitForTimeout(200)
  check(`M ${tag}: 형식 · 공식 — 넘침 0 · JS 오류 0`, (await overflowX(mp)) <= 0 && errs.length === 0, { over: await overflowX(mp), errs })
  await m.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
