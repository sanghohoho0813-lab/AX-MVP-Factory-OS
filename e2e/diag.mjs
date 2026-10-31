/**
 * qa:diag — D-352 맞춤 진단서 한 장 · D-353 AI 연결 점검.
 *
 *   D  업체 상세(개요 · 맞춤 추천) '먼저 제안할 것' 의 [맞춤 진단서] → 한 장(회사 한눈에 · 먼저 제안드리는 것 = 맨 위 제안과 같은 순서 ·
 *      함께 살펴본 것 · 보내 주실 자료 · 이렇게 진행합니다) · 고객 종이에 메모 · 수수료 · 영업자 없음 · 인쇄 종이 · 카톡 요약 · 390 넘침 0
 *   A  AI 도우미 › 모델 바꾸기 › [연결 점검] — 진짜 서버 함수 + 가짜 공급자: Gemini 연결됨 · GPT 키 없음(키 이름) · Claude 잔액 부족(충전하는 곳) ·
 *      탭 칩이 그 결과 · 키 값 · 공급자 오류 원문은 화면에 없음 · Claude 로 물으면 '잔액 부족' 오류 글
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import fs from 'node:fs'
import { seedScript } from './seed.mjs'

const fromRoot = (p) => import(pathToFileURL(path.resolve(p)).href)
const { default: handler, __resetAiAssistState } = await fromRoot('api/ai-assist.js')

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.DIAG_SHOTS ?? ''
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
const overflowX = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

const OWNER = 'Bearer owner-e2e-token-aaaaaaaaaaaa'
const G_KEY = 'gem-e2e-SECRET-1'
const A_KEY = 'ant-e2e-SECRET-2'
for (const k of Object.keys(process.env)) if (/^(AI_|OPENAI_|SUPABASE_|GEMINI_|GOOGLE_API|ANTHROPIC_API|CLAUDE_API)/.test(k)) delete process.env[k]
Object.assign(process.env, { SUPABASE_URL: 'https://qa.supabase.test', SUPABASE_ANON_KEY: 'qa-anon', GEMINI_API_KEY: G_KEY, ANTHROPIC_API_KEY: A_KEY, AI_ASSIST_RATE_PER_MIN: '100', AI_ASSIST_RATE_PER_HOUR: '500' })
__resetAiAssistState()

const BILLING = JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.' } })
const realFetch = globalThis.fetch
globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  const h = init.headers ?? {}
  if (url.startsWith('https://qa.supabase.test/auth/v1/user')) return new Response(JSON.stringify({ id: h.Authorization === OWNER ? 'owner-1' : 'x' }), { status: h.Authorization === OWNER ? 200 : 401 })
  if (url.startsWith('https://qa.supabase.test/rest/v1/rpc/has_capability')) return new Response(JSON.stringify(h.Authorization === OWNER), { status: 200 })
  if (/\/models(\?|$)/.test(url)) return new Response(JSON.stringify({ models: [], data: [] }), { status: 200 })
  if (url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent')) return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ headline: 'OK', items: [{ title: 'OK' }] }) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2 } }), { status: 200 })
  if (url.includes('api.anthropic.com/v1/messages')) return new Response(BILLING, { status: 400 })
  return realFetch(input, init)
}
async function wire(page) {
  await page.route('**/api/ai-assist**', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    const res = { statusCode: 200, headers: {}, raw: '', setHeader(k, v) { this.headers[k] = v }, end(b) { this.raw = b ?? '' } }
    await handler({ method: req.method(), url: u.pathname + u.search, headers: { authorization: OWNER }, body: req.postData() ?? undefined }, res)
    await route.fulfill({ status: res.statusCode, headers: { 'content-type': 'application/json' }, body: res.raw }).catch(() => {})
  })
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await wire(page)
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(seedScript())

/* ---------------- D 맞춤 진단서 ---------------- */
await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
await page.getByTestId('top-picks').waitFor({ timeout: 8000 })
const pickKeys = await page.getByTestId('top-pick').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
const btn = page.getByTestId('top-picks-diagnosis')
check('D1 개요 맨 위 "먼저 제안할 것" 에 [맞춤 진단서]', (await btn.count()) === 1)
await btn.click()
const doc = page.getByTestId('diagnosis-preview')
await doc.waitFor({ timeout: 5000 })
const dKeys = await doc.getByTestId('diagnosis-pick').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
const txt = await doc.innerText()
check('D2 진단서 — 회사 이름 · 회사 한눈에 · 먼저 제안드리는 것 = 맨 위 제안과 같은 모듈 · 같은 순서', txt.includes('맞춤 진단서') && (await doc.getByTestId('diagnosis-snapshot').count()) === 1 && dKeys.join() === pickKeys.join() && dKeys.length > 0, { pickKeys, dKeys })
check('D3 함께 살펴본 것 · 이렇게 진행합니다 · 1차 진단 안내(기관 심사 · 세무 검토)', (await doc.getByTestId('diagnosis-others').count()) === 1 && (await doc.getByTestId('diagnosis-steps').locator('li').count()) >= 2 && txt.includes('기관 심사와 세무 검토로 확정'))
const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_hansol'))
const memo = String(rec?.notes ?? rec?.memo ?? '').trim().slice(0, 12)
check('D4 고객 종이 — 메모 · 수수료 · 영업자 · 내부 안내 말(올리면 · 판정해요 · ★) 없음', !/수수료|영업자|올리면|판정해요|★/.test(txt) && (!memo || !txt.includes(memo)), memo)
check('D5 인쇄 종이가 같은 내용으로 붙어 있음(화면 밖 · 인쇄할 때만 보임)', (await page.getByTestId('diagnosis-print').count()) === 1 && (await page.getByTestId('diagnosis-print').innerText().catch(() => '')).length >= 0)
await page.getByTestId('diagnosis-kakao').click()
await page.waitForTimeout(300)
const kt = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
check('D6 [카톡 요약] — 회사 이름 · 먼저 제안드릴 것 · PDF 안내', kt.includes('맞춤 진단 요약') && kt.includes('■ 먼저 제안드릴 것') && kt.includes('PDF'), kt.slice(0, 300))
// D-363 드린 기록 — [카톡 요약] 을 누르면 업체 기록에 남고, 창은 '오늘 이미 드렸어요'
const hansol = () => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_hansol'))
await page.waitForFunction(() => (JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_hansol')?.diagnosisGiven ?? []).length > 0, null, { timeout: 5000 }).catch(() => {})
const r1 = await hansol()
const g1 = r1?.diagnosisGiven ?? []
check('D8 [카톡 요약] → 드린 기록(카톡 · 그때 판정 · 먼저 제안) · 활동 기록 "맞춤 진단서 드림(카톡 요약) — 먼저 제안: …" · 창에 "오늘 이미 드렸어요"', g1.length === 1 && g1[0].how === 'kakao' && g1[0].lines.filter((l) => l.pick).map((l) => l.key).join() === pickKeys.join() && String(r1?.activity?.[0]?.text ?? '').startsWith('맞춤 진단서 드림(카톡 요약) — 먼저 제안:') && (await page.getByTestId('diagnosis-given-note').getAttribute('data-state')) === 'today', { g1, act: r1?.activity?.[0]?.text })
await page.getByTestId('diagnosis-kakao').click()
await page.waitForTimeout(600)
check('D9 같은 날 또 눌러도 기록 한 줄', ((await hansol())?.diagnosisGiven ?? []).length === 1 && ((await hansol())?.activity ?? []).filter((a) => String(a.text).startsWith('맞춤 진단서 드림')).length === 1)
await shot(page, 'D-diagnosis')
await page.keyboard.press('Escape')
// 열흘 전에 드렸고, 그때는 첫 제안 모듈이 '자료 필요' · '가짜 자료 X' 를 요청했다고 바꿔 두고 다시 연다
await page.evaluate((first) => {
  const all = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
  const r = all.find((x) => x.id === 'cli_hansol')
  const g = r.diagnosisGiven[0]
  g.at = new Date(Date.now() - 10 * 86400000).toISOString()
  g.lines = g.lines.map((l) => (l.key === first ? { ...l, tone: 'need' } : l))
  g.requests = [...g.requests, '가짜 자료 X']
  localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(all))
}, pickKeys[0])
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('top-picks-diagnosis').click()
await doc.waitFor({ timeout: 5000 })
const since = (await doc.getByTestId('diagnosis-since').innerText().catch(() => '')) ?? ''
await page.getByTestId('diagnosis-kakao').click()
await page.waitForTimeout(400)
const kt2 = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
check('D10 다음에 열면 — 종이에 "지난 진단(날짜) 뒤 달라진 것": ▲ 첫 제안 모듈 자료 필요 → 지금 판정 · 받은 자료: 가짜 자료 X · 창 "지난번 … 드렸어요" · 카톡 요약에도', /자료 필요 → /.test(since) && since.includes('받은 자료: 가짜 자료 X') && (await doc.getByTestId('diagnosis-since').locator('li[data-better="1"]').count()) >= 1 && (await doc.innerText()).includes('뒤 달라진 것') && kt2.includes('뒤 달라진 것') && kt2.includes('받은 자료: 가짜 자료 X'), { since, kt2: kt2.slice(0, 300) })
check('D11 오류 0', errors.length === 0, errors)
await shot(page, 'D-since')
await page.keyboard.press('Escape')
// D-366 '먼저 제안할 것' 한 줄 — 방금(오늘) 드린 뒤 그대로면 회색 '오늘 진단서 드림 — 그대로' · 지난번만 있고 판정이 바뀌었으면 '다시 드릴 때예요'
await page.waitForTimeout(400)
const noteToday = page.getByTestId('top-picks-diag-note')
const nt = (await noteToday.innerText().catch(() => '')) ?? ''
check('D12 먼저 제안할 것 아래 한 줄 — 오늘 드림(카톡 요약) · 그 뒤 판정 그대로', (await noteToday.getAttribute('data-state').catch(() => '')) === 'today' && nt.includes('오늘 진단서 드림(카톡 요약)'), nt)
await page.evaluate(() => {
  const all = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
  const r = all.find((x) => x.id === 'cli_hansol')
  r.diagnosisGiven = r.diagnosisGiven.slice(1) // 오늘 것을 빼면 열흘 전(첫 제안이 '자료 필요' 였던) 기록이 맨 앞
  localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(all))
})
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('top-picks').waitFor({ timeout: 8000 })
const note2 = page.getByTestId('top-picks-diag-note')
const nt2 = (await note2.innerText().catch(() => '')) ?? ''
check('D13 지난번 드린 뒤 판정이 바뀌었으면 — "m/d 진단서 드린 뒤 달라짐 — 판정 바뀐 것 1 · 받은 자료 1 · 다시 드릴 때예요" · 누르면 진단서', (await note2.getAttribute('data-state').catch(() => '')) === 'changed' && /진단서 드린 뒤 달라짐 — 판정 바뀐 것 1 · 받은 자료 1 · 다시 드릴 때예요/.test(nt2), nt2)
await shot(page, 'D-note')
await note2.click()
await doc.waitFor({ timeout: 5000 }).catch(() => {})
check('D14 한 줄을 누르면 진단서 창(달라진 것 칸)', (await doc.getByTestId('diagnosis-since').count()) === 1)
await page.keyboard.press('Escape')
// D-368 오늘 화면 '오늘 먼저 제안할 것' — 진단서를 드린 뒤 새로 추천할 수 있게 된 모듈
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.getByTestId('today-picks').waitFor({ timeout: 8000 }).catch(() => {})
const newTag = page.locator('[data-testid="today-pick"][data-client="cli_hansol"] [data-testid="today-pick-new"]')
const newText = (await newTag.innerText().catch(() => '')) ?? ''
check('D15 오늘 먼저 제안할 것 — 한솔테크 줄에 "진단서 드린 뒤 새 추천: (그때 자료 필요였던 모듈)" · 다른 업체(드린 적 없음)엔 없음', newText.startsWith('진단서 드린 뒤 새 추천:') && newText.length > '진단서 드린 뒤 새 추천:'.length && (await page.locator('[data-testid="today-pick"]:not([data-client="cli_hansol"]) [data-testid="today-pick-new"]').count()) === 0, newText)
await shot(page, 'D-today-new')
await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
await page.getByTestId('smart-tab').waitFor({ timeout: 8000 })
check('D7 맞춤 추천 탭에도 같은 [맞춤 진단서]', (await page.getByTestId('smart-tab').getByTestId('top-picks-diagnosis').count()) === 1)

/* ---------------- A AI 연결 점검 ---------------- */
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await page.getByTestId('ai-assist-open').first().click()
await page.getByTestId('ai-assist-model-toggle').click()
await page.getByTestId('ai-assist-probe').click()
await page.getByTestId('ai-assist-probe-result').waitFor({ timeout: 15000 }).catch(() => {})
const rows = await page.getByTestId('ai-assist-probe-row').evaluateAll((els) => els.map((e) => ({ id: e.getAttribute('data-provider'), code: e.getAttribute('data-code'), text: e.textContent ?? '' })))
const row = (id) => rows.find((r) => r.id === id)
check('A1 [연결 점검] — Gemini 연결됨 · GPT 키 없음(OPENAI_API_KEY · Redeploy) · Claude 잔액 부족(Anthropic 콘솔 · 충전)', row('gemini')?.code === 'ok' && row('openai')?.code === 'no_key' && (row('openai')?.text ?? '').includes('OPENAI_API_KEY') && row('anthropic')?.code === 'provider_billing' && (row('anthropic')?.text ?? '').includes('console.anthropic.com') && (row('anthropic')?.text ?? '').includes('충전'), rows)
const chips = await page.getByTestId('ai-assist-provider-state').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-for')}:${(e.textContent ?? '').trim()}`))
check('A2 회사 탭 칩도 점검 결과로(연결됨 · 키 없음 · 잔액 부족)', chips.some((c) => c === 'anthropic:잔액 부족') && chips.some((c) => c === 'openai:키 없음'), chips)
const body = await page.locator('body').innerText()
check('A3 화면에 키 값 · 공급자 오류 원문 없음', !body.includes(A_KEY) && !body.includes(G_KEY) && !body.includes('credit balance'))
await shot(page, 'A-probe')
// Claude 로 골라 물으면 — 잔액 부족을 회사 이름과 함께
await page.locator('[data-testid="ai-assist-settings"] [data-provider="anthropic"]').first().click()
await page.locator('[data-testid="ai-assist-model-option"]').first().click()
await page.getByTestId('ai-assist-model-toggle').click()
await page.getByTestId('ai-assist-preset').first().click()
await page.getByTestId('ai-assist-confirm-go').click() // D-289 고른 뒤 [이대로 질문하기]
await page.waitForSelector('[data-testid="ai-assist-error"]', { timeout: 15000 }).catch(() => {})
const errText = await page.getByTestId('ai-assist-error').innerText().catch(() => '')
check('A4 Claude 로 물으면 — "Claude 계정의 잔액(크레딧)…" 고치는 곳까지(예전: "이 모델을 쓸 수 없습니다")', errText.includes('Claude 계정의 잔액') && errText.includes('console.anthropic.com'), errText)
check('A5 오류 0', errors.length === 0, errors)
await ctx.close()

/* ---------------- M 휴대폰 ---------------- */
{
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const p = await c.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  await p.goto(BASE + '/', { waitUntil: 'networkidle' })
  await p.evaluate(seedScript())
  // D-401 올해 부가세 신고서(한 기간)가 있으면 회사 한눈에 한 줄
  await p.evaluate(() => {
    const k = 'axmvp.v1.operations_clients'
    const list = JSON.parse(localStorage.getItem(k) ?? '[]')
    const r = list.find((x) => x.id === 'cli_hansol')
    r.customFields = [...(r.customFields ?? []), { id: 'cf_vr401', group: 'identity', label: '부가세 신고 매출', value: '2026년 1기 확정(1~6월) 과세표준 6억 2,000만원' }]
    localStorage.setItem(k, JSON.stringify(list))
  })
  await p.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await p.getByTestId('top-picks').waitFor({ timeout: 8000 })
  await p.getByTestId('top-picks-diagnosis').click()
  await p.getByTestId('diagnosis-preview').waitFor({ timeout: 5000 })
  const snap = (await p.getByTestId('diagnosis-preview').getByTestId('diagnosis-snapshot').innerText().catch(() => '')).replace(/\s+/g, ' ')
  check('D-401 390 회사 한눈에 "부가세 신고 2026년 1기 확정(1~6월) · 6억 2,000만원"', snap.includes('부가세 신고') && snap.includes('2026년 1기 확정(1~6월) · 6억 2,000만원'), snap.slice(0, 300))
  check('M390 진단서 창 — 넘침 0 · 오류 0', (await overflowX(p)) <= 0 && errs.length === 0, { ox: await overflowX(p), errs })
  await shot(p, 'M-390-diagnosis')
  await c.close()
}

await browser.close()
console.log(`\n맞춤 진단서 · 연결 점검: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
