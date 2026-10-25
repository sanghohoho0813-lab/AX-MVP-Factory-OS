/**
 * PV-1 · PV-2 특허 · 벤처 첫 화면 — 회사 준비 현황 · 이미 있는 자료 · 다음 할 일 하나(규칙) + 대화창 AI 한 번만.
 *
 *   node e2e/pvhome.mjs <baseUrl>
 *
 *  H  회사를 고르면 묻지 않아도 세 칸(명세서 → 점검 → 사업계획서) · 이미 있는 자료 · 다음 할 일 주 단추 하나 · 주의 2줄
 *     → [AI로 명세서 초안 쓰기] 한 번에 명세서(열자마자 AI) · 돌아오면 '명세서 이어 쓰기' · 회사 안 고르면 '이어서 할 회사'
 *  P  자세히(/more) 사업계획서 칸 — 업체에서 열었으면 그 회사가 골라진 채로
 *  C  대화창 [AI에게 묻기] 를 연달아 눌러도 AI 는 한 번
 *  M  360/390/430/아주 큰 글자 넘침 0 · 주 단추 44px
 * AI 는 진짜 api/ai-assist.js 를 같은 프로세스에서(공급자 응답만 가짜 · 호출 수를 센다). 명세서 AI 는 부르지 않게 막는다.
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { seedScript } from './seed.mjs'

const fromRoot = (p) => import(pathToFileURL(path.resolve(p)).href)
const { default: handler, __resetAiAssistState } = await fromRoot('api/ai-assist.js')

const BASE = process.argv[2] ?? 'http://localhost:4390'
const CLIENT = 'cli_hansol'
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
const llm = []
const realFetch = globalThis.fetch
globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  const h = init.headers ?? {}
  if (url.startsWith('https://qa.supabase.test/auth/v1/user')) return new Response(JSON.stringify({ id: h.Authorization === OWNER ? 'owner-1' : 'x' }), { status: h.Authorization === OWNER ? 200 : 401 })
  if (url.startsWith('https://qa.supabase.test/rest/v1/rpc/has_capability')) return new Response(JSON.stringify(h.Authorization === OWNER), { status: 200 })
  if (url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent')) {
    const body = JSON.parse(String(init.body ?? '{}'))
    llm.push({ sys: String(body.systemInstruction?.parts?.[0]?.text ?? '') })
    // 답이 늦게 오게 — 그 사이 또 눌러 본다
    await new Promise((r) => setTimeout(r, 900))
    const ans = { headline: '명세서 2단계까지', items: [{ title: '다음은 구성요소', body: '구성요소 · 단계를 채우면 됩니다.', tag: '', when: '', detail: '', outline: [] }], next: [] }
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(ans) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 } }), { status: 200 })
  }
  if (/\/models(\?|$)/.test(url)) return new Response(JSON.stringify({ models: [], data: [] }), { status: 200 })
  return realFetch(input, init)
}
async function wire(page) {
  await page.route('**/api/ai-assist**', async (route) => {
    const req = route.request()
    const body = req.postData() ?? ''
    // 명세서 AI(열자마자 쓰기)는 이 시험에서 부르지 않는다 — 주소 · 기록만 본다
    if (/spec\.|"assistId":"(spec|patent)/.test(body)) return route.fulfill({ status: 503, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'e2e: 명세서 AI 는 이 시험에서 막음' }) })
    const u = new URL(req.url())
    const res = { statusCode: 200, headers: {}, raw: '', setHeader(k, v) { this.headers[k] = v }, end(b) { this.raw = b ?? '' } }
    await handler({ method: req.method(), url: u.pathname + u.search, headers: { authorization: OWNER }, body: body || undefined }, res)
    await route.fulfill({ status: res.statusCode, headers: { 'content-type': 'application/json' }, body: res.raw })
  })
}
const overflowX = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const drafts = (p) => p.evaluate(() => Object.keys(localStorage).filter((k) => /patent-draft/.test(k)).flatMap((k) => { try { const v = JSON.parse(localStorage.getItem(k) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] } }))
/** 대화창 위의 주 단추(진한 단추) */
const primAbove = (p) =>
  p.evaluate(() => {
    const hero = document.querySelector('[data-testid="chat-hero"], [data-testid="chat-turns"]')?.getBoundingClientRect().top ?? Infinity
    return [...document.querySelectorAll('main button.bg-brand-600, main a.bg-brand-600')].filter((b) => b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().top < hero).map((b) => b.getAttribute('data-testid'))
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
await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))

/* ---------------- H 회사 준비 현황 ---------------- */
await page.goto(`${BASE}/patent-venture?client=${CLIENT}`, { waitUntil: 'networkidle' })
await page.getByTestId('pv-brief').waitFor({ timeout: 15000 })
const states = await page.getByTestId('pv-brief-step').evaluateAll((xs) => xs.map((x) => `${x.getAttribute('data-key')}:${x.getAttribute('data-state')}`))
check('H1 회사를 고르면 묻지 않아도 준비 현황 — 명세서 · 점검 · 사업계획서 세 칸(모두 아직, 글로도 "아직")', states.join() === 'spec:todo,check:todo,plan:todo' && (await page.getByTestId('pv-brief-steps').innerText()).split('아직').length - 1 === 3, states)
check('H2 이미 있는 자료(회사 기록 n줄 · 서류함) · AI 가 알아서 읽음', /회사 기록 \d+줄/.test(await page.getByTestId('pv-brief-have').innerText()) && /알아서 읽어요/.test(await page.getByTestId('pv-brief-have').innerText()), await page.getByTestId('pv-brief-have').innerText())
check('H3 다음 할 일 주 단추 하나 = [AI로 명세서 초안 쓰기] · 대화창 위 진한 단추는 이것뿐 · 주의 2줄(초안은 사람이 정함 · 출원번호는 기록에 있는 것만)', (await page.getByTestId('pv-brief-next').innerText()).includes('AI로 명세서 초안 쓰기') && (await primAbove(page)).join() === 'pv-brief-next' && (await page.locator('[data-testid="pv-brief-cautions"] li').count()) === 2 && /출원번호/.test(await page.getByTestId('pv-brief-cautions').innerText()), await primAbove(page))
check('H4 대화창 · 큰 단추 4개는 그대로 아래에(지운 것 없음)', (await page.getByTestId('chat-hero').getByTestId('chat-starter').count()) === 4)
const before = (await drafts(page)).length
{ const l289 = page.getByTestId('pv-brief-next'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
await page.waitForURL(/\/patent-venture\/write\?/, { timeout: 10000 })
const wurl = new URL(page.url())
check('H5 [AI로 명세서 초안 쓰기] → [이대로 질문하기](D-289) → 그 회사 새 명세서 · 열자마자 AI(auto=1) — 예전엔 [특허 명세서 쓰기] → [새 명세서 쓰기] 두 번', wurl.searchParams.get('client') === CLIENT && wurl.searchParams.get('auto') === '1' && !!wurl.searchParams.get('draft') && (await drafts(page)).length === before + 1, page.url())
console.log('MEASURE pv-new-spec clicks=2 (D-289 확인 한 번 더 · before D-282 2)')
const draftId = wurl.searchParams.get('draft')
await page.goto(`${BASE}/patent-venture?client=${CLIENT}`, { waitUntil: 'networkidle' })
await page.getByTestId('pv-brief').waitFor({ timeout: 15000 })
await page.waitForTimeout(300)
check('H6 돌아오면 명세서 칸 "진행 중 n/6단계" · 다음 할 일 [명세서 이어 쓰기] 가 그 명세서로', (await page.locator('[data-testid="pv-brief-step"][data-key="spec"]').getAttribute('data-state')) === 'doing' && /\/6단계/.test(await page.locator('[data-testid="pv-brief-step"][data-key="spec"]').innerText()) && (await page.getByTestId('pv-brief-next').innerText()).includes('명세서 이어 쓰기'), await page.getByTestId('pv-brief').innerText())
await page.getByTestId('pv-brief-next').click() // [명세서 이어 쓰기] 는 화면 이동이라 한 번(D-289 — AI 를 바로 부르는 것만 두 번)
await page.waitForURL(/\/patent-venture\/write\?/, { timeout: 10000 })
check('H7 [명세서 이어 쓰기] → 그 명세서(같은 draft)', new URL(page.url()).searchParams.get('draft') === draftId, page.url())
await page.goto(`${BASE}/patent-venture`, { waitUntil: 'networkidle' })
await page.getByTestId('pv-resume').waitFor({ timeout: 15000 }).catch(() => {})
check('H8 회사를 안 고르면 "이어서 할 회사" — 한솔테크 줄 · [이 회사 보기] → 그 회사 준비 현황', (await page.getByTestId('pv-resume-row').count()) >= 1 && /한솔/.test(await page.getByTestId('pv-resume').innerText()))
await page.getByTestId('pv-resume-go').first().click()
await page.getByTestId('pv-brief').waitFor({ timeout: 10000 }).catch(() => {})
check('H9 → ?client= 로 준비 현황', new URL(page.url()).searchParams.get('client') === CLIENT && (await page.getByTestId('pv-brief').count()) === 1, page.url())

/* ---------------- P 자세히 — 사업계획서 회사 ---------------- */
await page.goto(`${BASE}/patent-venture/more?client=${CLIENT}`, { waitUntil: 'networkidle' })
await page.getByTestId('pv-plan-client').waitFor({ timeout: 10000 })
check('P1 업체에서 열었으면 사업계획서 회사가 이미 골라짐 · [사업계획서 쓰기] 바로 — 예전엔 회사를 다시 고름', (await page.getByTestId('pv-plan-client').inputValue()) === CLIENT && !(await page.getByTestId('pv-plan-open').isDisabled()))
await page.getByTestId('pv-plan-open').click()
await page.waitForURL(/\/patent-venture\/plan\?client=/, { timeout: 10000 })
check('P2 [사업계획서 쓰기] 한 번 → 그 회사 사업계획서', new URL(page.url()).searchParams.get('client') === CLIENT)
console.log('MEASURE pv-plan-from-more actions=1 (before 2: 회사 고르기 + 쓰기)')
await page.goto(`${BASE}/patent-venture/more`, { waitUntil: 'networkidle' })
check('P3 회사 없이 열면 그대로 "회사 고르기"', (await page.getByTestId('pv-plan-client').inputValue()) === '' && (await page.getByTestId('pv-plan-open').isDisabled()))

/* ---------------- C 대화창 AI 한 번만 ---------------- */
await page.goto(`${BASE}/patent-venture?client=${CLIENT}`, { waitUntil: 'networkidle' })
await page.getByTestId('chat-input').fill('이 회사 명세서 다음에 뭐 해?')
const n0 = llm.length
await page.getByTestId('chat-send').evaluate((b) => {
  b.click()
  b.click()
  b.click()
})
await page.getByTestId('chat-turn').first().waitFor({ timeout: 10000 })
await page.waitForFunction(() => !document.querySelector('[data-testid="chat-pending"]'), null, { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(400)
check('C1 [AI에게 묻기] 를 세 번 연달아 눌러도 AI 호출 1번 · 질문 1개', llm.length - n0 === 1 && (await page.getByTestId('chat-turn').count()) === 1, { calls: llm.length - n0, turns: await page.getByTestId('chat-turn').count() })
check('C2 PC — JS 오류 0', errors.length === 0, errors)

/* ---------------- M 휴대폰 · 큰 글자 ---------------- */
for (const [w, scale] of [[360, ''], [390, ''], [430, ''], [360, 'extra_large']]) {
  const tag = `${w}${scale ? '-large' : ''}`
  const m = await browser.newContext({ viewport: { width: w, height: 820 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const mp = await m.newPage()
  const errs = []
  mp.on('pageerror', (e) => errs.push(String(e)))
  await wire(mp)
  await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
  await mp.evaluate(seedScript())
  if (scale) await mp.evaluate((s) => localStorage.setItem('axmvp.ui.preferences', JSON.stringify({ ...JSON.parse(localStorage.getItem('axmvp.ui.preferences') ?? '{}'), textScale: s })), scale)
  await mp.goto(`${BASE}/patent-venture?client=${CLIENT}`, { waitUntil: 'networkidle' })
  await mp.getByTestId('pv-brief').waitFor({ timeout: 15000 })
  const nextH = await mp.getByTestId('pv-brief-next').evaluate((e) => Math.round(e.getBoundingClientRect().height))
  const nextY = await mp.getByTestId('pv-brief-next').evaluate((e) => Math.round(e.getBoundingClientRect().top + window.scrollY))
  console.log(`MEASURE pv-next-button ${tag} y=${nextY}`)
  check(`M ${tag}: 넘침 0 · 다음 할 일 단추 44px 이상 · 첫 화면 안(${nextY}px) · JS 오류 0`, (await overflowX(mp)) <= 0 && nextH >= 44 && nextY < 820 * (scale ? 1.4 : 1) && errs.length === 0, { over: await overflowX(mp), nextH, nextY, errs })
  await m.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
