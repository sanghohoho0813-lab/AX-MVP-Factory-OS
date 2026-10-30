/**
 * qa:mkweek — D-346 마케팅 첫 화면 [1주일치 콘텐츠 한 번에 만들기] → 롱폼 1 · 릴스/쇼츠 3 · 스레드 7(+예비 2).
 *
 * 브라우저 → /api/ai-assist 는 진짜 서버 함수(api/ai-assist.js)를 이 프로세스에서 부른다(qa:mkpack 과 같은 방식).
 * 밖으로 나가는 것만 가짜: Supabase 로그인 확인 · 권한 RPC · AI 공급자(Gemini · Claude).
 *
 *   H  첫 화면 키워드 위에 단추 하나(롱폼 1 · 릴스 · 쇼츠 3 · 스레드 7) · 한 번 누르면 '이대로 1주일치 만들기'(아직 안 부름)
 *   G  두 번째 → ?week=1 · 여섯 갈래 동시(롱폼 radar.pack.video 1 · 릴스/틱톡 shorts.write 2 · 스레드 threads.write 3)
 *      보낸 자료: 롱폼 = 짝 1 + 이번 주 계획 · 쇼츠 = 짝 1(틱톡 · 같은 주 롱폼) / 짝 2(릴스) · 스레드 = 짝 1 · 2 · 3 + 글마다 요일 · 목적 · 틀 ·
 *      쇼츠 · 스레드 자료에 레이더 숫자(근거) 없음
 *   V  결과: 롱폼 AI 확정 제목 · 쇼츠 ①②③ AI · 스레드 월~일 7 AI(같은 틀 자리) · 예비 · 달력 7일(롱폼 수 · 쇼츠 화/목/토) · 점검(링크 글 → 고칠 곳)
 *   C  전체 복사 · 텍스트 파일 · 롱폼을 내 콘텐츠에 담기
 *   R  다시 열면 AI 다시 안 부름 · 첫 화면 단추 'AI로 써 둠' · 한 번에 열림 · [AI로 다시 쓰기] 는 여섯 갈래 다시
 *   E  쇼츠 갈래 실패 → 그 글만 초안 + 이유 · 나머지 AI
 *   M  360 · 390 · 430 · 큰 글자 — 가로 넘침 0 · JS 오류 0
 *
 * D-348 주제 = 짝 셋(본업 = 고정 키워드 × 미끼 = 이번 주 AI 흐름) — 여섯 갈래 모두 채널 설계 기준 · 접목 · 규칙집(AI 는 미끼, 끝은 본업)
 * D-349 모으기 — AI 결과가 내 콘텐츠(롱폼) · 릴스 · 틱톡 기록표(3) · 스레드 기록표(7)에 저절로 · 다시 써도 줄이 늘지 않음 ·
 *       이 브라우저 저장을 지워도 클라우드 사본으로 돌아옴 · 예전 휴대폰(이 브라우저에만 남은 주)을 열면 올리고 모음(AI 다시 안 부름)
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import fs from 'node:fs'
import { seedScript } from './seed.mjs'

const fromRoot = (p) => import(pathToFileURL(path.resolve(p)).href)
const { default: handler, __resetAiAssistState } = await fromRoot('api/ai-assist.js')

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.MKWEEK_SHOTS ?? ''
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
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full })
}

const OWNER = 'Bearer owner-e2e-token-aaaaaaaaaaaa'
for (const k of Object.keys(process.env)) if (/^(AI_|OPENAI_|SUPABASE_|GEMINI_|GOOGLE_API|ANTHROPIC_API|CLAUDE_API)/.test(k)) delete process.env[k]
Object.assign(process.env, { SUPABASE_URL: 'https://qa.supabase.test', SUPABASE_ANON_KEY: 'qa-anon', GEMINI_API_KEY: 'gem-e2e-SECRET-1', ANTHROPIC_API_KEY: 'ant-e2e-SECRET-2', AI_ASSIST_RATE_PER_MIN: '100', AI_ASSIST_RATE_PER_HOUR: '500' })
__resetAiAssistState()

const llm = []
let failing = ''
/** 스레드 — 자료의 '1번 U … / 2번 T …' 순서 그대로 틀 글자를 붙인다(한 갈래는 일부러 순서를 섞어 자리 맞추기를 본다) */
const threadsAnswer = (user) => {
  const tpl = [...user.matchAll(/(\d)번 ([A-X]) /g)].map((m) => m[2]).slice(0, 3)
  const topic = (/소재: ([^\n]+)/.exec(user) ?? [])[1]?.trim().slice(0, 30) ?? ''
  const order = tpl.includes('D') ? [tpl[1], tpl[0], tpl[2]] : tpl
  return {
    headline: `스레드 ${topic}`,
    items: order.map((t) => ({
      title: `AI 스레드 첫 줄 ${t}`,
      tag: t,
      body: `AI 스레드 첫 줄 ${t} — ${topic}\n\n둘째 줄 — 대표님이 자주 묻는 것\n\n${t === 'G' ? '자세한 건 https://example.com 에서' : '이 셋 중 몇 번이 제일 급해? 1 / 2 / 3'}`,
      when: '고르기 쉬운 질문',
      detail: `본인 댓글 ${t}`,
      outline: ['[대괄호] 확인'],
    })),
    next: ['경영컨설팅'],
  }
}
const shortsAnswer = (user) => {
  const reels = /인스타 릴스/.test(user)
  const k = reels ? '릴스' : '쇼츠'
  return {
    headline: `AI ${k}`,
    items: [
      { title: `AI ${k} 첫마디 1`, tag: '리스트형', when: reels ? '약 22초' : '약 40초', body: `[0:00] AI ${k} 대본 1 첫마디\n[0:03] 둘째, 숫자 하나\n[0:20] 끝`, detail: `AI ${k} 캡션 1`, outline: ['#중소기업', '#대표님'] },
      { title: `AI ${k} 첫마디 2`, tag: '화면 시연형', when: reels ? '약 20초' : '약 45초', body: `[0:00] AI ${k} 대본 2 첫마디\n[0:05] 화면 보여 주기\n[0:30] 끝`, detail: `AI ${k} 캡션 2`, outline: ['#AI'] },
    ],
    next: ['[공식 자료 확인] 숫자'],
  }
}
const LONG = {
  headline: 'AI 확정 제목 — 1주일치 롱폼',
  items: [
    { title: '0:00 오프닝', tag: '유튜브 대본', body: 'AI 롱폼 오프닝 — 결론부터 말씀드릴게요.', outline: ['쇼츠로 자를 곳 — 결론 장면'] },
    { title: '1:30 ① 첫 번째', tag: '유튜브 대본', body: 'AI 롱폼 챕터 1' },
    { title: '제목 후보', tag: '제목', outline: ['AI 롱폼 제목 1', 'AI 롱폼 제목 2'] },
    { title: '썸네일 문구', tag: '제목', outline: ['AI 썸네일'] },
  ],
  next: ['노트북 화면 녹화'],
}
const answerFor = (sys, user) => {
  if (sys.includes('(threads.write')) return threadsAnswer(user)
  if (sys.includes('(shorts.write')) return shortsAnswer(user)
  if (sys.includes('(radar.pack.video')) return LONG
  return { headline: '기타', items: [{ title: '기타' }] }
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
    llm.push({ provider: 'gemini', sys, user })
    if (failing && sys.includes(`(${failing}`)) return new Response(JSON.stringify({ error: { message: 'busy' } }), { status: 503 })
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answerFor(sys, user)) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 2100, candidatesTokenCount: 320 } }), { status: 200 })
  }
  if (url.includes('api.anthropic.com/v1/messages')) {
    const body = JSON.parse(String(init.body ?? '{}'))
    const sys = String(body.system ?? '')
    const user = String(body.messages?.[0]?.content ?? '')
    llm.push({ provider: 'anthropic', sys, user })
    if (failing && sys.includes(`(${failing}`)) return new Response(JSON.stringify({ error: { message: 'busy' } }), { status: 529 })
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answerFor(sys, user)) }], usage: { input_tokens: 1500, output_tokens: 200 }, stop_reason: 'end_turn', model: body.model }), { status: 200 })
  }
  if (/\/models(\?|$)/.test(url)) return new Response(JSON.stringify({ models: [], data: [] }), { status: 200 })
  return realFetch(input, init)
}

let delayMs = 0
async function wire(page) {
  await page.route('**/api/ai-assist**', async (route) => {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs))
    const req = route.request()
    const u = new URL(req.url())
    const res = { statusCode: 200, headers: {}, raw: '', setHeader(k, v) { this.headers[k] = v }, end(b) { this.raw = b ?? '' } }
    await handler({ method: req.method(), url: u.pathname + u.search, headers: { authorization: OWNER }, body: req.postData() ?? undefined }, res)
    await route.fulfill({ status: res.statusCode, headers: { 'content-type': 'application/json' }, body: res.raw })
  })
}

async function openHome(p) {
  await p.goto(BASE + '/marketing', { waitUntil: 'networkidle' })
  await p.waitForTimeout(500)
  const sample = p.getByTestId('yt-sample')
  if (await sample.count()) {
    await sample.first().click()
    await p.waitForTimeout(900)
  }
  await p.getByTestId('mk-home').waitFor({ timeout: 10000 })
}
const weekCalls = () => llm.filter((x) => /\((radar\.pack\.video|shorts\.write|threads\.write)/.test(x.sys))
const idOf = (c) => (c.sys.match(/\((radar\.pack\.video|shorts\.write|threads\.write)/) ?? [])[1]
const weekDone = (p) => p.waitForSelector('[data-testid="mk-week-ai"]:not([data-state="running"])', { timeout: 25000 })
const overflowX = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const twice = async (loc) => {
  await loc.click()
  await loc.page().waitForTimeout(450)
  await loc.click()
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', acceptDownloads: true })
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await wire(page)
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(seedScript())
await page.evaluate(() => {
  localStorage.removeItem('axmvp.ai.choice.v1')
  localStorage.removeItem('axmvp.mkweek.v1')
})

/* ---------------- H 첫 화면 단추 ---------------- */
await openHome(page)
const open = page.getByTestId('mk-week-open')
const keysTop = (await page.getByTestId('mk-keys').boundingBox())?.y ?? 0
check('H1 첫 화면 이번 주 키워드 위에 [1주일치 콘텐츠 한 번에 만들기] — 롱폼 1 · 릴스 · 쇼츠 3 · 스레드 7', (await open.count()) === 1 && ((await open.boundingBox())?.y ?? 9999) < keysTop && ['1주일치 콘텐츠 한 번에 만들기', '롱폼 1', '릴스 · 쇼츠 3', '스레드 7'].every(async () => true) && (await open.innerText()).includes('스레드 7') && (await open.innerText()).includes('롱폼 1'), await open.innerText())
await shot(page, 'H-home')
// 고정 키워드(본업) 이름들 — 짝의 앞쪽이 이 가운데 하나여야
const fixedText = await page.getByTestId('mk-fixed').innerText().catch(() => '')
const n0 = weekCalls().length
await open.click()
await page.waitForTimeout(500)
check("H2 한 번 누르면 '이대로 1주일치 만들기'(두 번 눌러 확인) · 아직 AI 안 부름 · 첫 화면 그대로", (await open.innerText()).includes('이대로 1주일치 만들기') && weekCalls().length === n0 && (await page.getByTestId('mk-week').count()) === 0, await open.innerText())

/* ---------------- G 두 번째 → 여섯 갈래 ---------------- */
delayMs = 1500
await page.waitForTimeout(200)
await open.click()
await page.getByTestId('mk-week').waitFor({ timeout: 8000 })
await page.waitForTimeout(300)
check('G1 ?week=1 · 1주일치 화면 · 쓰는 중에도 초안이 다 보임(롱폼 · 쇼츠 3 · 스레드 7)', new URL(page.url()).searchParams.get('week') === '1' && (await page.getByTestId('mk-week-ai').getAttribute('data-state')) === 'running' && (await page.getByTestId('mk-week-long').count()) === 1 && (await page.locator('[data-testid="mk-week-short"]:not([data-n="0"])').count()) === 3 && (await page.locator('[data-testid="mk-week-thread"]:not([data-day="0"])').count()) === 7)
await shot(page, 'G-running')
const pairs = await page.locator('[data-testid="mk-week-topics"] li > span:nth-child(2)').evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim()))
const coreOf = (l) => l.split(' × ')[0]
const hookOf = (l) => l.split(' × ').slice(1).join(' × ')
check('G1b 짝 셋 = 본업(고정 키워드) × 미끼(이번 주 AI 흐름) · 본업은 서로 다름', pairs.length === 3 && pairs.every((l) => l.includes(' × ') && fixedText.includes(coreOf(l))) && new Set(pairs.map(coreOf)).size === 3, { pairs, fixedText: fixedText.slice(0, 200) })
await weekDone(page)
delayMs = 0
const calls = weekCalls().slice(n0)
const ids = calls.map(idOf).sort()
check('G2 여섯 갈래 동시 — 롱폼 1(radar.pack.video) · 숏폼 2(shorts.write) · 스레드 3(threads.write)', ids.join() === 'radar.pack.video,shorts.write,shorts.write,threads.write,threads.write,threads.write', ids)
const longU = calls.find((c) => idOf(c) === 'radar.pack.video')?.user ?? ''
check('G3 롱폼 자료 — 짝 1 본업 · 미끼 · 접목 · 채널 설계 기준 · 규칙집(AI 는 미끼, 끝은 본업) · 이번 주 계획(쇼츠로 자를 곳)', longU.includes(coreOf(pairs[0])) && longU.includes(hookOf(pairs[0])) && longU.includes('[자료 · 접목') && longU.includes('[자료 · 채널 설계 기준') && longU.includes('[규칙집]') && longU.includes('AI 는 미끼, 끝은 본업') && longU.includes('이번 주 계획') && longU.includes('쇼츠로 자를 곳'), longU.slice(0, 500))
const sh = calls.filter((c) => idOf(c) === 'shorts.write').map((c) => c.user)
const shTik = sh.find((u) => u.includes('틱톡 · 유튜브 쇼츠')) ?? ''
const shReels = sh.find((u) => u.includes('인스타 릴스')) ?? ''
check('G4 쇼츠 자료 — 짝 1 · 틱톡/쇼츠 · 같은 주 롱폼(링크는 고정 댓글) / 짝 2 · 릴스 · 둘 다 관점 · 채널 설계 기준 · 접목 · 규칙집 · 레이더 숫자(근거) 없음', shTik.includes(pairs[0]) && shTik.includes('같은주롱폼') && shReels.includes(pairs[1]) && sh.every((u) => u.includes('이번 주 주제') && u.includes('[자료 · 채널 설계 기준') && u.includes('[자료 · 접목') && u.includes('AI 는 미끼, 끝은 본업') && !u.includes('근거_우리만')), sh.map((u) => u.slice(0, 200)))
const th = calls.filter((c) => idOf(c) === 'threads.write').map((c) => c.user)
const tplOf = (u) => [...u.matchAll(/(\d)번 ([A-X]) /g)].map((m) => m[2]).join('')
check('G5 스레드 자료 — 짝 셋 · 글마다 요일 목적 · 틀(ETX / DGQ / ISP) · 채널 설계 기준 · 접목 · 레이더 숫자 없음', th.map(tplOf).sort().join() === ['DGQ', 'ETX', 'ISP'].sort().join() && pairs.every((t) => th.some((u) => u.includes(t))) && th.every((u) => u.includes('저장 · 공유') || u.includes('관계 · 팔로워')) && th.every((u) => u.includes('[자료 · 채널 설계 기준') && u.includes('[자료 · 접목') && !u.includes('근거_우리만')), th.map(tplOf))

/* ---------------- V 결과 ---------------- */
await page.waitForFunction(() => document.querySelectorAll('[data-testid="mk-week-thread"][data-ai="1"]').length === 9, null, { timeout: 8000 }).catch(() => {})
check('V1 롱폼 = AI 확정 제목 · 대본 · 제목 후보', (await page.getByTestId('mk-week-long').getAttribute('data-ai')) === '1' && (await page.getByTestId('mk-week-long-title').innerText()).includes('AI 확정 제목') && (await page.getByTestId('mk-week-long').innerText()).includes('AI 롱폼 챕터 1') && (await page.getByTestId('mk-week-long').innerText()).includes('AI 롱폼 제목 1'))
const shortTxt = await page.locator('[data-testid="mk-week-short"]:not([data-n="0"])').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-n')}:${e.getAttribute('data-ai')}:${(e.textContent ?? '').includes('AI 쇼츠 대본 1') ? 's1' : (e.textContent ?? '').includes('AI 쇼츠 대본 2') ? 's2' : (e.textContent ?? '').includes('AI 릴스 대본 1') ? 'r1' : '?'}`))
check('V2 쇼츠 ① ② = 짝 1 틱톡 · 쇼츠 대본 1 · 2 / ③ = 짝 2 릴스 대본 1 · 다른 버전 = 릴스 대본 2', shortTxt.join() === '1:1:s1,2:1:s2,3:1:r1' && ((await page.locator('[data-testid="mk-week-short"][data-n="0"]').textContent()) ?? '').includes('AI 릴스 대본 2'), shortTxt)
const thr = await page.locator('[data-testid="mk-week-thread"]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-day')}${(/AI 스레드 첫 줄 ([A-X])/.exec(e.textContent ?? '') ?? [])[1] ?? '?'}`))
check('V3 스레드 월~일 7 + 예비 2 — 요일 자리마다 그 틀의 글(답 순서가 섞여도) · 모두 AI', thr.join() === '1E,2T,3X,4D,5G,6Q,7I,0S,0P' && (await page.locator('[data-testid="mk-week-thread"][data-ai="1"]').count()) === 9, thr)
const cal = await page.getByTestId('mk-week-day').evaluateAll((els) => els.map((e) => e.textContent ?? ''))
check('V4 달력 7일 — 수요일 롱폼 · 화 쇼츠① · 목 쇼츠② · 토 릴스③ · 매일 스레드', cal.length === 7 && cal[2].includes('유튜브 롱폼') && cal[1].includes('쇼츠 ①') && cal[3].includes('쇼츠 ②') && cal[5].includes('릴스 ③') && cal.every((d) => d.includes('스레드')), cal)
const lintLine = await page.getByTestId('mk-week-lint').innerText()
check("V5 점검 — 이번 주 글 11개 중 통과 · 링크가 든 금요일 스레드는 '고칠 곳'", lintLine.includes('이번 주 글 11개') && (await page.locator('[data-testid="mk-week-thread"][data-day="5"]').getAttribute('data-bad')) !== '0' && (await page.locator('[data-testid="mk-week-thread"][data-day="1"]').getAttribute('data-bad')) === '0' && /고칠 곳 [1-9]/.test(lintLine), lintLine)
await page.locator('[data-testid="mk-week-day"][data-day="3"] button').first().click()
await page.waitForFunction(() => { const el = document.getElementById('mk-week-long'); if (!el) return false; const b = el.getBoundingClientRect(); return b.top < window.innerHeight && b.bottom > 0 }, null, { timeout: 5000 }).catch(() => {})
check('V6 달력의 [유튜브 롱폼] 누르면 롱폼 칸으로', await page.evaluate(() => { const b = document.getElementById('mk-week-long')?.getBoundingClientRect(); return !!b && b.top < window.innerHeight && b.bottom > 0 }))
await page.evaluate(() => window.scrollTo({ top: 0 }))
await shot(page, 'V-week', true)

/* ---------------- C 복사 · 파일 · 내 콘텐츠 ---------------- */
await page.getByTestId('mk-week-copy-all').click()
await page.waitForTimeout(300)
const all = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
check('C1 [전체 복사] — 기간 · 짝 셋 · 롱폼 · 쇼츠 ①②③ · 스레드 일곱 요일 · 예비', all.startsWith('1주일치 콘텐츠 — ') && pairs.every((t) => all.includes(t)) && all.includes('AI 확정 제목') && all.includes('쇼츠 ①') && all.includes('릴스 ③') && (all.match(/■ 스레드 /g) ?? []).length === 9 && all.includes('AI 스레드 첫 줄 I'), all.slice(0, 300))
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.getByTestId('mk-week-download').click()])
const dlPath = dl ? await dl.path().catch(() => null) : null
const dlText = dlPath ? fs.readFileSync(dlPath, 'utf8') : ''
check('C2 [텍스트 파일로] → week-content-YYYY-MM-DD.txt(영문 이름 — 한글 이름을 바꾸는 브라우저가 있다) · 전체와 같은 글', !!dl && /^week-content-\d{4}-\d{2}-\d{2}\.txt$/.test(dl.suggestedFilename()) && dlText === all, dl?.suggestedFilename())
 
/* ---------------- D-349 목록으로 모으기 ---------------- */
await page.waitForSelector('[data-testid="mk-week-collect"][data-state="done"]', { timeout: 10000 }).catch(() => {})
const collectTxt = await page.getByTestId('mk-week-collect').innerText().catch(() => '')
check("C3 AI 결과를 목록에 모았다는 줄 — 내 콘텐츠 · 롱폼 1 · 릴스 · 틱톡 3 · 스레드 7 · [롱폼을 내 콘텐츠에 담기] 는 따로 안 보임(이미 모음)", collectTxt.includes('모아 뒀어요') && collectTxt.includes('롱폼 1') && collectTxt.includes('릴스 · 틱톡 3') && collectTxt.includes('스레드 7') && (await page.getByTestId('mk-week-save-long').count()) === 0, collectTxt)
const recCount = async (base, list, item) => {
  await page.goto(BASE + base, { waitUntil: 'networkidle' })
  await page.getByTestId(list).waitFor({ timeout: 8000 }).catch(() => {})
  return page.locator(`[data-testid="${list}"] [data-testid="${item}"]`).evaluateAll((els) => els.map((e) => e.textContent ?? ''))
}
await page.getByTestId('mk-week-collect-threads').click()
await page.waitForURL(/\/marketing\/threads\?tab=records/, { timeout: 5000 }).catch(() => {})
await page.getByTestId('thr-rec-drafts').waitFor({ timeout: 8000 }).catch(() => {})
const thrRows = await page.locator('[data-testid="thr-rec-drafts"] [data-testid="thr-rec-item"]').evaluateAll((els) => els.map((e) => e.textContent ?? ''))
check('C4 [스레드 7] → 스레드 기록표 · 쓰다 둔 글 7(AI 글 · 예비 빼고)', thrRows.length === 7 && thrRows.every((t) => t.includes('AI 스레드 첫 줄') || /\d+\/\d+\(/.test(t)), thrRows.map((t) => t.slice(0, 60)))
await shot(page, 'C-threads-records')
const shRows = await recCount('/marketing/shorts?tab=records', 'sht-rec-drafts', 'sht-rec-item')
check('C5 릴스 · 틱톡 기록표 · 쓰다 둔 대본 3(쇼츠 ① ② · 릴스 ③ · 다른 버전은 빼고)', shRows.length === 3, shRows.map((t) => t.slice(0, 60)))
await page.goto(BASE + '/marketing?week=1', { waitUntil: 'networkidle' })
await page.getByTestId('mk-week').waitFor({ timeout: 8000 })
await page.getByTestId('mk-week-collect-long').click()
await page.waitForURL(/view=make/, { timeout: 5000 }).catch(() => {})
await page.waitForTimeout(800)
const makeTxt = await page.locator('main').innerText().catch(() => '')
check('C6 [내 콘텐츠 · 롱폼 1] → 내 콘텐츠에 AI 확정 제목 줄(대본 준비)', new URL(page.url()).searchParams.get('view') === 'make' && makeTxt.includes('AI 확정 제목'), makeTxt.slice(0, 300))
await shot(page, 'C-make')

/* ---------------- R 다시 열기 · 다시 쓰기 ---------------- */
await openHome(page)
check("R1 첫 화면 단추가 '1주일치 콘텐츠 보기 · AI로 써 둠'", (await open.getAttribute('data-done')) === '1' && (await open.innerText()).includes('1주일치 콘텐츠 보기') && (await open.innerText()).includes('AI로 써 둠'))
const n1 = weekCalls().length
await open.click()
await page.getByTestId('mk-week').waitFor({ timeout: 5000 })
await page.waitForTimeout(1200)
check('R2 써 둔 주는 한 번에 열림(확인 없이) · AI 다시 안 부름 · 남긴 글 그대로', weekCalls().length === n1 && (await page.locator('[data-testid="mk-week-thread"][data-ai="1"]').count()) === 9 && (await page.getByTestId('mk-week-ai').getAttribute('data-state')) === 'done')
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('mk-week').waitFor({ timeout: 8000 })
await page.waitForTimeout(800)
check('R3 새로 고쳐도(이 브라우저에 남김) AI 글 그대로 · 다시 안 부름', weekCalls().length === n1 && (await page.locator('[data-testid="mk-week-thread"][data-ai="1"]').count()) === 9 && (await page.getByTestId('mk-week-long').getAttribute('data-ai')) === '1')
await twice(page.getByTestId('mk-week-run'))
await weekDone(page)
check('R4 [AI로 다시 쓰기] → 여섯 갈래 다시 한 번씩', weekCalls().length === n1 + 6, weekCalls().length - n1)
await page.waitForSelector('[data-testid="mk-week-collect"][data-state="done"]', { timeout: 10000 }).catch(() => {})
const phoneStore = await page.evaluate(() => localStorage.getItem('axmvp.mkweek.v1'))
const thrAgain = await recCount('/marketing/threads?tab=records', 'thr-rec-drafts', 'thr-rec-item')
const shAgain = await recCount('/marketing/shorts?tab=records', 'sht-rec-drafts', 'sht-rec-item')
check('R5 다시 써도 목록 줄이 늘지 않음(같은 주 같은 자리 = 같은 줄) — 스레드 7 · 대본 3', thrAgain.length === 7 && shAgain.length === 3, [thrAgain.length, shAgain.length])
// 이 브라우저 저장만 지우면 — 클라우드 사본(이 시험은 로컬 모드라 모듈 기록)에서 돌아온다 = 다른 기기에서 열 때와 같은 길
await page.evaluate(() => localStorage.removeItem('axmvp.mkweek.v1'))
const n2 = weekCalls().length
await page.goto(BASE + '/marketing?week=1', { waitUntil: 'networkidle' })
await page.getByTestId('mk-week').waitFor({ timeout: 8000 })
await page.waitForFunction(() => document.querySelectorAll('[data-testid="mk-week-thread"][data-ai="1"]').length === 9, null, { timeout: 8000 }).catch(() => {})
check('R6 이 브라우저 저장을 지워도 클라우드 사본으로 AI 글 그대로 · AI 다시 안 부름', weekCalls().length === n2 && (await page.locator('[data-testid="mk-week-thread"][data-ai="1"]').count()) === 9 && (await page.getByTestId('mk-week-long').getAttribute('data-ai')) === '1')

/* ---------------- E 한 갈래 실패 ---------------- */
failing = 'shorts.write'
await page.evaluate(() => {
  localStorage.removeItem('axmvp.mkweek.v1')
  for (const k of Object.keys(localStorage)) if (k.startsWith('axmvp.module.marketing.weeks')) localStorage.removeItem(k)
})
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('mk-week').waitFor({ timeout: 8000 })
await page.waitForTimeout(600)
check('E0 이 브라우저 · 클라우드 사본을 다 지우고 다시 열면 초안(AI 아님)', (await page.getByTestId('mk-week-ai').getAttribute('data-state')) === 'idle' && (await page.locator('[data-testid="mk-week-thread"][data-ai="1"]').count()) === 0)
await twice(page.getByTestId('mk-week-run'))
await weekDone(page)
await page.waitForTimeout(300)
const err = await page.getByTestId('mk-week-error').innerText().catch(() => '')
check('E1 숏폼 갈래만 실패 → 이유(쇼츠 ① ② · 릴스 ③) · 쇼츠는 초안 그대로(빈 칸 아님) · 롱폼 · 스레드는 AI', err.includes('쇼츠 ① ②') && err.includes('릴스 ③') && (await page.locator('[data-testid="mk-week-short"][data-ai="1"]').count()) === 0 && (await page.locator('[data-testid="mk-week-short"][data-n="1"]').innerText()).length > 40 && (await page.getByTestId('mk-week-long').getAttribute('data-ai')) === '1' && (await page.locator('[data-testid="mk-week-thread"][data-ai="1"]').count()) === 9, err)
failing = ''
check('E2 오류 0', errors.length === 0, errors)
await ctx.close()

/* ---------------- P 예전 휴대폰 — 이 브라우저에만 남은 주를 열면 올리고 모음 ---------------- */
{
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const p = await c.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  await wire(p)
  await p.goto(BASE + '/', { waitUntil: 'networkidle' })
  await p.evaluate(seedScript())
  await p.evaluate((v) => v && localStorage.setItem('axmvp.mkweek.v1', v), phoneStore)
  const n3 = weekCalls().length
  await openHome(p)
  await p.waitForFunction(() => Object.keys(localStorage).some((k) => k.startsWith('axmvp.module.marketing.weeks')), null, { timeout: 8000 }).catch(() => {})
  await p.waitForTimeout(800)
  const up = await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('axmvp.module.marketing.weeks')).map((k) => JSON.parse(localStorage.getItem(k) || '[]').length))
  await p.goto(BASE + '/marketing/threads?tab=records', { waitUntil: 'networkidle' })
  await p.getByTestId('thr-rec-drafts').waitFor({ timeout: 8000 }).catch(() => {})
  const rows = await p.locator('[data-testid="thr-rec-drafts"] [data-testid="thr-rec-item"]').count()
  check('P1 예전 휴대폰 결과(이 브라우저에만) → 화면을 열면 클라우드로 올리고 스레드 7을 목록에 · AI 다시 안 부름 · 오류 0', !!phoneStore && up.length === 1 && up[0] === 1 && rows === 7 && weekCalls().length === n3 && errs.length === 0, { up, rows, calls: weekCalls().length - n3, errs })
  await c.close()
}

/* ---------------- M 휴대폰 · 큰 글자 ---------------- */
for (const [w, scale] of [[360, 'extra_large'], [390, ''], [430, 'large']]) {
  const c = await browser.newContext({ viewport: { width: w, height: 800 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const p = await c.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  await wire(p)
  await p.goto(BASE + '/', { waitUntil: 'networkidle' })
  await p.evaluate(seedScript())
  await p.evaluate((s) => { const k = 'axmvp.ui.preferences'; const pr = JSON.parse(localStorage.getItem(k) || '{}'); if (s) pr.textScale = s; localStorage.setItem(k, JSON.stringify(pr)) }, scale)
  await openHome(p)
  const o = p.getByTestId('mk-week-open')
  check(`M${w} 첫 화면 단추 넘침 0`, (await o.count()) === 1 && (await overflowX(p)) <= 0)
  await twice(o)
  await p.getByTestId('mk-week').waitFor({ timeout: 8000 })
  await weekDone(p)
  await p.waitForTimeout(500)
  await p.waitForSelector('[data-testid="mk-week-collect"][data-state="done"]', { timeout: 10000 }).catch(() => {})
  check(`M${w}${scale ? ` ${scale}` : ''} 1주일치 화면 가로 넘침 0 · 오류 0 · 글 7 + 3 · 모은 줄 보임`, (await p.getByTestId('mk-week-collect').count()) === 1 && (await overflowX(p)) <= 0 && errs.length === 0 && (await p.locator('[data-testid="mk-week-thread"]:not([data-day="0"])').count()) === 7 && (await p.locator('[data-testid="mk-week-short"]:not([data-n="0"])').count()) === 3, { ox: await overflowX(p), errs })
  await shot(p, `M-${w}`, w === 390)
  await c.close()
}

if (process.env.MKWEEK_DUMP) fs.writeFileSync(process.env.MKWEEK_DUMP, JSON.stringify(llm.map((x) => ({ id: idOf(x), user: x.user })), null, 1))
await browser.close()
console.log(`\n1주일치 한 번에: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
