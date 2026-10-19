/**
 * qa:assist — D-239 AI 도우미(화면마다 질문 단추) 끝까지 이어 보기.
 *
 * 브라우저 → /api/ai-assist 는 진짜 서버 함수(api/ai-assist.js)를 이 프로세스에서 부른다(Playwright route).
 * 밖으로 나가는 것만 가짜: Supabase 로그인 확인 · 권한 RPC · AI 공급자 세 곳(Gemini · GPT · Claude).
 *
 *   0  키 없음 → '키가 아직 없어요' + 넣을 이름(GEMINI_API_KEY) · 공급자 안 부름
 *   A  오늘 → [오늘 제일 중요한 것 3개만] 한 번 → 답 · 기본은 Gemini 가장 싼 모델 · 보낸 자료에 사람 이름 · 전화 없음 · [열어 보기] → 업체
 *   B  모델 바꾸기 → Claude Haiku → 다음 질문은 Claude 로 · 새로고침해도 기억 · 지난 답
 *   C  화면마다 띠: 영업 · 고객 관리 · 정산 · 매출비용 · 일정 · 고용지원금(고객 전체) · 기업성장 모듈 · 업체 상세 맞춤 추천 · 내 콘텐츠
 *   D  블로그 · 플레이스 홍보 글: 이름 · '미래AI랩으로 만들기' → 같은 자리 · 블로그 글 한 번에(규칙집이 같이 감) → 보관함에 저장 → 보관함에 쌓임
 *   F  D-241 답 → 다음 단계: 번호 단추 이름(업체 열기) · [할 일로 넣기] → 오늘 목록 · 마케팅 TOP5 기획에 채널 설계 기준 · 내 채널이 감 ·
 *      [내 콘텐츠에 담기] → 그 줄 펼쳐 보기 · [이 기획으로 대본 끝까지] → [더 잘 쓰는 모델로 다시] → [내 콘텐츠에 저장] → 대본 칸 · 기준 고치면 다음 기획에
 *   E  360/390 넘침 0 · 판 열어도 넘침 0 · JS 오류 0 · 키 노출 0
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import fs from 'node:fs'
import { seedScript } from './seed.mjs'

const fromRoot = (p) => import(pathToFileURL(path.resolve(p)).href)
const { default: handler, __resetAiAssistState } = await fromRoot('api/ai-assist.js')

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.ASSIST_SHOTS ?? ''
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
const shot = async (page, name) => {
  if (!SHOTS) return
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.waitForTimeout(500) // 판 열림(0.38초) · 색 바뀜이 끝난 뒤에 찍는다
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) })
}

const OWNER = 'Bearer owner-e2e-token-aaaaaaaaaaaa'
const G_KEY = 'gem-e2e-SECRET-445566'
const A_KEY = 'ant-e2e-SECRET-778899'
function setEnv(over = {}) {
  for (const k of Object.keys(process.env)) if (/^(AI_|OPENAI_|SUPABASE_|GEMINI_|GOOGLE_API|ANTHROPIC_API|CLAUDE_API)/.test(k)) delete process.env[k]
  for (const [k, v] of Object.entries({ SUPABASE_URL: 'https://qa.supabase.test', SUPABASE_ANON_KEY: 'qa-anon', GEMINI_API_KEY: G_KEY, ANTHROPIC_API_KEY: A_KEY, AI_ASSIST_RATE_PER_MIN: '100', AI_ASSIST_RATE_PER_HOUR: '500', ...over })) if (v !== undefined) process.env[k] = v
  __resetAiAssistState()
}

/** 공급자에 간 요청 */
const llm = []
const answerFor = (sys) => {
  // D-241 마케팅 — TOP5 기획(후보 번호 o1 · o2 · 번호 없는 것 하나) · 고른 기획 대본
  if (sys.includes('(radar.script')) return { headline: '고용지원금, 이것 하나 놓쳐서 1,200만원 못 받습니다', items: [{ title: '0:00 오프닝', body: '대표님, 고용지원금은 신청 기한 하나 때문에 통째로 놓치는 경우가 많습니다.', outline: ['자막: 기한 하나로 놓친 지원금'] }, { title: '1:00 실제 상담 사례', body: '지난달 상담한 제조업 대표님 이야기입니다. 직원을 뽑고 석 달이 지나 신청하셨는데…', outline: ['화면: 기한 표'] }, { title: '제목 후보', outline: ['고용지원금 놓치는 회사의 공통점', '직원 뽑고 이 날짜 넘기면 끝', '고용지원금 기한 체크리스트'] }], next: ['상담 사례 숫자 확인'], caution: '' }
  if (sys.includes('(radar.top5')) return { headline: '이번 주는 지원금 기한 실수부터', items: [{ title: '정책자금 거절된 회사의 공통점 3가지', tag: '롱폼', ref: 'o1', detail: '상담에서 자주 본 실수', outline: ['0:00 오프닝', '1:00 실제 상담 사례', '4:00 확인 순서'], body: '대표님, 정책자금이 거절되는 회사에는 공통점이 있습니다.' }, { title: '고용지원금 놓치는 회사 — 이 날짜 하나', tag: '쇼츠', ref: 'o2', detail: '기한 실수', outline: ['0:00 질문', '0:15 기한', '0:40 마무리'], body: '직원 뽑고 이 날짜 넘기면 지원금은 끝입니다.' }, { title: '번호 없는 기획', tag: '롱폼', detail: '참고' }], next: [], caution: '' }
  if (sys.includes('content.blog')) return { headline: '블로그 글 1편을 만들었어요', items: [{ title: '정책자금, 신청 전에 이것부터 확인하세요', tag: '실패 · 손해 피하기', outline: ['왜 떨어질까', '확인할 3가지', '정리'], body: '정책자금은 서류보다 순서가 먼저입니다.\n\n1. 업력과 매출을 먼저 봅니다.\n2. 신용과 체납을 확인합니다.\n3. 사업계획을 숫자로 씁니다.' }], next: ['제목 후보: 정책자금 떨어지는 이유 3가지'], caution: '후기 출처가 비어 있어요' }
  if (sys.includes('money.')) return { headline: '가장 큰 비용은 정기 결제입니다', items: [{ title: '노션 팀 요금', amount: '월 3만원', detail: '1년이면 36만원' }], next: [], caution: '' }
  return { headline: '오늘은 서류 마감부터', items: [{ title: '서류 받기', ref: 'c1', tag: '마감', detail: '내일까지 받아야 신청할 수 있어요' }, { title: '미수금 확인', tag: '돈', detail: '받을 날이 지났어요' }], next: ['오전에 전화'], caution: '' }
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
    llm.push({ provider: 'gemini', url, sys, user: String(body.contents?.[0]?.parts?.[0]?.text ?? ''), key: h['x-goog-api-key'] })
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answerFor(sys)) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 2100, candidatesTokenCount: 320 } }), { status: 200 })
  }
  if (url.includes('api.anthropic.com/v1/messages')) {
    const body = JSON.parse(String(init.body ?? '{}'))
    llm.push({ provider: 'anthropic', url, model: body.model, sys: String(body.system ?? ''), user: String(body.messages?.[0]?.content ?? ''), key: h['x-api-key'] })
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answerFor(String(body.system ?? ''))) }], usage: { input_tokens: 1500, output_tokens: 200 }, stop_reason: 'end_turn', model: body.model }), { status: 200 })
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

/** 로컬 미리보기에는 유튜브 함수가 없다 — 레이더는 [예시로 보기] 를 눌러야 후보가 생긴다 */
async function openRadar(p) {
  await p.goto(BASE + '/marketing', { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
  const sample = p.getByTestId('yt-sample')
  if (await sample.count()) {
    await sample.first().click()
    await p.waitForTimeout(900)
  }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await wire(page)
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(seedScript())
await page.evaluate(() => localStorage.removeItem('axmvp.ai.choice.v1'))

/* ---------------- 0 키 없음 ---------------- */
setEnv({ GEMINI_API_KEY: undefined, ANTHROPIC_API_KEY: undefined })
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
check('0 오늘: AI 도우미 띠(대표 계정)', (await page.getByTestId('ai-assist-bar').count()) === 1)
await page.getByTestId('ai-assist-chip').first().click()
await page.getByTestId('ai-assist-error').waitFor({ timeout: 8000 })
const err0 = await page.getByTestId('ai-assist-error').innerText()
check("0 키 없음 → '키가 아직' + 넣을 이름 GEMINI_API_KEY · 공급자 안 부름", /키가 아직/.test(err0) && err0.includes('GEMINI_API_KEY') && llm.length === 0, err0)
await page.keyboard.press('Escape')

/* ---------------- A 오늘 ---------------- */
setEnv()
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.getByTestId('ai-assist-chip').filter({ hasText: '오늘 제일 중요한 것 3개만' }).click()
await page.getByTestId('ai-assist-result').waitFor({ timeout: 10000 })
const call = llm.at(-1)
check('A1 한 번 누르면 답 — 한 줄 결론 · 항목 2개 · 바로 할 일', (await page.getByTestId('ai-assist-headline').innerText()).includes('서류 마감') && (await page.getByTestId('ai-assist-item').count()) === 2)
check('A2 기본 = Gemini 가장 싼 모델(gemini-3.1-flash-lite) · 키는 머리줄로', call?.provider === 'gemini' && call.url.includes('/models/gemini-3.1-flash-lite:generateContent') && call.key === G_KEY, call?.url)
check('A3 보낸 자료 — 오늘 화면 자료(할 일 · 기한 · 약속)가 감 · 대표자 이름 · 휴대폰 없음', call.user.includes('[화면] 오늘 할 일') && !/김대표|장정순|010-2345-6789|010-9876-5432/.test(call.user), call.user.slice(0, 500))
check('A4 단추 지시문 · 공통 규칙이 system 에', call.sys.includes('오늘 꼭 해야 하는 것 3개만') && call.sys.includes('[자료] 에 있는 것만 사실로'))
const meta = await page.getByTestId('ai-assist-meta').innerText()
check('A5 답 아래 — 회사 · 모델 · 걸린 시간 · 토큰 · 비용(원) · 보낸 줄', /Gemini · gemini-3\.1-flash-lite/.test(meta) && /토큰 2,420/.test(meta) && /보낸 줄 \d+/.test(meta), meta)
await shot(page, 'A-today-answer')
const refLink = page.getByTestId('ai-assist-ref').first()
if (await refLink.count()) {
  await refLink.click()
  await page.waitForTimeout(600)
  check('A6 [열어 보기] → 그 업체 화면 · 판 닫힘', /\/ops\/clients\//.test(page.url()) && (await page.getByTestId('ai-assist-panel').count()) === 0, page.url())
} else check('A6 [열어 보기] 링크(ref c1 → 업체)', false)
check('A7 화면 · 저장소에 키 없음', !(await page.content()).includes(G_KEY) && !(await page.evaluate(() => JSON.stringify(localStorage))).includes(G_KEY))

/* ---------------- B 모델 바꾸기 · 기억 · 지난 답 ---------------- */
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await page.getByTestId('ai-assist-open').first().click()
await page.getByTestId('ai-assist-model-toggle').click()
await page.getByTestId('ai-assist-settings').locator('[data-provider="anthropic"]').click()
await page.getByTestId('ai-assist-model-option').filter({ hasText: 'Claude Haiku 5.5' }).click()
await shot(page, 'B-model-settings')
check('B1 모델 줄 — Claude Haiku 5.5 로 바뀜 · 기본으로 단추', (await page.getByTestId('ai-assist-model-label').innerText()).includes('Claude Haiku 5.5') && (await page.getByTestId('ai-assist-model-reset').count()) === 1)
check('B2 GPT 는 키 없음 표시 · 고를 수 없음', /키 없음/.test(await page.getByTestId('ai-assist-settings').locator('[data-provider="openai"]').innerText()))
await page.getByTestId('ai-assist-preset').filter({ hasText: '놓치면 끝나는 것만' }).click()
await page.waitForFunction(() => document.querySelector('[data-testid="ai-assist-result"]')?.getAttribute('data-assist') === 'today.deadline', null, { timeout: 10000 })
check('B3 다음 질문은 Claude 로(claude-haiku-5-5)', llm.at(-1)?.provider === 'anthropic' && llm.at(-1)?.model === 'claude-haiku-5-5' && llm.at(-1)?.key === A_KEY)
await page.keyboard.press('Escape')
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await page.getByTestId('ai-assist-open').first().click()
await page.waitForTimeout(400)
check('B4 새로고침해도 고른 모델 기억 · 지난 답 2개', (await page.getByTestId('ai-assist-model-label').innerText()).includes('Claude Haiku 5.5') && (await page.getByTestId('ai-assist-history').locator('li').count()) >= 2)
await page.getByTestId('ai-assist-model-toggle').click()
await page.getByTestId('ai-assist-model-reset').click()
check('B5 기본(가장 싼 Gemini)으로 되돌리기', (await page.getByTestId('ai-assist-model-label').innerText()).includes('Gemini 3.1 Flash-Lite'))
await page.keyboard.press('Escape')

/* ---------------- C 화면마다 띠 ---------------- */
const pages = [
  ['/sales/board', '영업 관리', 'sales.brief'],
  ['/ops/clients', '고객 관리', null],
  ['/ops/agents', '영업자 정산', 'agents.soon'],
  ['/money', '매출 · 비용', 'money.top'],
  ['/ops/calendar', '일정', 'calendar.week'],
  ['/tools/employment', '고용지원금 · 고객 전체', 'module.all'],
  ['/modules/growth', '기업성장 모듈', 'module.all'],
  ['/marketing?view=make', '마케팅 · 내 콘텐츠', 'mine.detail'],
]
for (const [p, label, first] of pages) {
  await page.goto(BASE + p, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const bar = page.getByTestId('ai-assist-bar').first()
  const ok = (await bar.count()) === 1 && (!first || (await bar.getByTestId('ai-assist-chip').first().getAttribute('data-assist')) === first)
  check(`C ${label}: 띠 · 첫 질문 ${first ?? '(구분에 따라)'}`, ok, await bar.count())
  await shot(page, `C-bar-${p.replace(/[^a-z]+/g, '-')}`)
  if (p === '/tools/employment') {
    // 대표 예시 화면 — 원래 대시보드가 길어서 띠가 아래에 있으면 안 보인다
    const y = (await bar.boundingBox())?.y ?? 9999
    check('C 고용지원금 › 한눈에 보기: 띠가 화면 맨 위(첫 화면 안 · 원래 대시보드 위)', y < 500, y)
  }
}
await page.goto(BASE + '/money', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
check("C 매출 · 비용: 예전 '준비 중' 단추 대신 실제 단추", (await page.getByTestId('ai-soon').filter({ hasText: '이 달 비용 정리해 보기' }).count()) === 0)
await page.getByTestId('ai-assist-chip').filter({ hasText: '가장 큰 비용 TOP5' }).click()
await page.getByTestId('ai-assist-result').waitFor({ timeout: 10000 })
check('C 매출 · 비용 [가장 큰 비용 TOP5] → 정기 결제 · 비용 자료가 감', llm.at(-1)?.user.includes('[자료 · 정기 결제') && llm.at(-1)?.sys.includes('money.top'))
await page.keyboard.press('Escape')
// 업체 상세 맞춤 추천
await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
check('C 업체 상세: 머리줄 [AI 도우미](어느 탭에서나)', (await page.getByTestId('ai-assist-open').count()) >= 1)
await page.getByTestId('ai-assist-open').first().click()
await page.waitForTimeout(400)
check('C 업체 상세 AI 판 — 한 장 요약 · 다음 할 일 · 미팅 질문 10개 · 제안 순서', (await page.getByTestId('ai-assist-preset').evaluateAll((els) => els.map((e) => e.getAttribute('data-assist')))).join() === 'client.brief,client.next,client.meeting,client.pitch')
await page.getByTestId('ai-assist-preset').first().click()
await page.getByTestId('ai-assist-result').waitFor({ timeout: 10000 })
await shot(page, 'C-client-answer')
check('C 업체 상세 [한 장 요약] → 이 업체 자료 · OS 모듈 판정이 감 · 대표 이름 · 전화 없음', llm.at(-1)?.user.includes('[자료 · OS 모듈 판정') && llm.at(-1)?.user.includes('한솔') && !/김대표|010-2345-6789/.test(llm.at(-1)?.user ?? ''), (llm.at(-1)?.user ?? '').slice(0, 400))
await page.keyboard.press('Escape')

/* ---------------- D 블로그 · 플레이스 홍보 글 ---------------- */
await page.goto(BASE + '/tools/content', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const tab = await page.getByTestId('mk-tab-content').innerText()
check("D1 목차 이름 '블로그 · 플레이스 홍보 글 만들기' + 아래 '(키워드 · 플레이스 · 블로그 등)'", tab.includes('블로그 · 플레이스 홍보 글 만들기') && tab.includes('(키워드 · 플레이스 · 블로그 등)'), tab)
await page.getByTestId('trial-mirae').click()
await page.waitForURL(/trial=trial_miraeailab/, { timeout: 8000 })
await page.waitForTimeout(800)
check("D2 '미래AI랩으로 만들기' → 늘 같은 자리(trial_miraeailab)", page.url().includes('trial=trial_miraeailab'))
await page.getByTestId('ai-assist-chip').filter({ hasText: '블로그 글 한 번에' }).click()
await page.getByTestId('ai-assist-body').first().waitFor({ timeout: 10000 })
await shot(page, 'D-blog-answer')
const blogCall = llm.at(-1)
check('D3 블로그 글 한 번에 — 규칙집(요청문 · 제목 각도 17 · 쓰지 말 말)이 같이 감 · 미래AI랩 소개', blogCall.user.includes('[규칙집]') && blogCall.user.includes('제목 각도 17개') && blogCall.user.includes('쓰지 말 말') && blogCall.user.includes('미래AI랩:'), blogCall.user.slice(-800))
await page.getByTestId('ai-assist-save').first().click()
await page.waitForTimeout(800)
check('D4 [보관함에 저장] → 저장됨', /저장됨/.test(await page.getByTestId('ai-assist-save').first().innerText()))
await page.keyboard.press('Escape')
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const body = await page.locator('main').innerText()
check('D5 새로고침 뒤 보관함에 그 글이 쌓여 있음(미래AI랩 자리)', body.includes('정책자금, 신청 전에 이것부터 확인하세요'), body.slice(0, 300))
await page.goto(BASE + '/tools/content', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.getByTestId('trial-mirae').click()
await page.waitForTimeout(800)
check("D6 다시 '미래AI랩으로 만들기' → 새로 만들지 않고 같은 자리(글 그대로)", (await page.locator('main').innerText()).includes('정책자금, 신청 전에 이것부터 확인하세요'))

/* ---------------- F D-241 답 → 다음 단계 ---------------- */
// F1~F4 오늘: 번호 단추 이름 · [할 일로 넣기]
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
await page.getByTestId('ai-assist-chip').filter({ hasText: '오늘 제일 중요한 것 3개만' }).click()
await page.getByTestId('ai-assist-result').waitFor({ timeout: 10000 })
const refText = await page.getByTestId('ai-assist-ref').first().innerText()
check("F1 번호 단추는 무엇이 열리는지 — c1 → '업체 열기'(예전 '열어 보기')", refText.includes('업체 열기') && !refText.includes('열어 보기'), refText)
const item1 = page.getByTestId('ai-assist-item').first()
check('F2 일하는 화면 답 한 줄마다 [할 일로 넣기] · 바로 할 일에도 [할 일로]', (await page.locator('[data-testid="ai-assist-item"] [data-action="todo"]').count()) === 2 && (await page.locator('[data-testid="ai-assist-next"] [data-action="todo-next"]').count()) === 1)
await item1.locator('[data-action="todo"]').click()
await item1.getByTestId('ai-assist-action-go').waitFor({ timeout: 8000 })
const todo = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]').find((x) => String(x.content).startsWith('서류 받기')))
check('F3 [할 일로 넣기] → 업무 일기 할 일(답의 업체 c1 에 붙음 · 기한 오늘 · 제목 + 설명 첫 문장)', !!todo && todo.entryType === 'follow_up' && !!todo.clientId && todo.dueDate === todo.entryDate && todo.content === '서류 받기 — 내일까지 받아야 신청할 수 있어요', todo)
check("F4 한 번 누르면 '할 일에 넣음'(다시 안 눌림) · 옆에 [오늘 할 일에서 보기]", (await item1.locator('[data-action="todo"]').isDisabled()) && /할 일에 넣음/.test(await item1.locator('[data-action="todo"]').innerText()) && /오늘 할 일에서 보기/.test(await item1.getByTestId('ai-assist-action-go').innerText()))
await shot(page, 'F-today-todo')
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
check('F5 판을 닫으면 오늘 목록에 그 할 일이 바로 있음(새로고침 없이)', (await page.locator('main').innerText()).includes('서류 받기 — 내일까지 받아야'))

// F6~ 마케팅: TOP5 기획 → 담기 · 대본
await openRadar(page)
await page.getByTestId('ai-assist-chip').filter({ hasText: 'TOP5' }).click()
await page.waitForFunction(() => document.querySelector('[data-testid="ai-assist-result"]')?.getAttribute('data-assist') === 'radar.top5', null, { timeout: 10000 })
const plan5 = llm.at(-1)
check('F6 TOP5 기획 지시문에 [마케팅 규칙](채널 설계 기준 · 내 채널 다음 편 · 미래AI랩 일 · 상투어 금지)', plan5.sys.includes('[마케팅 규칙]') && plan5.sys.includes('채널 설계 기준') && plan5.sys.includes('N분 컷'), plan5.sys.slice(0, 300))
check('F7 보낸 자료 맨 앞 — 채널 설계 기준(김팀장의 경영노트) · 내 채널 최근 영상 · 후보 번호 o1 · 찍기 키트', plan5.user.includes('[자료 · 채널 설계 기준') && plan5.user.includes('김팀장의 경영노트') && plan5.user.includes('[자료 · 내 채널 최근 영상') && /o1/.test(plan5.user) && plan5.user.includes('첫문장_규칙'), plan5.user.slice(0, 600))
check("F8 마케팅 답에는 판만 닫던 '열어 보기' 가 없음 · 할 일 단추 대신 [내 콘텐츠에 담기] · [이 기획으로 대본 끝까지] 가 줄마다", (await page.getByTestId('ai-assist-ref').count()) === 0 && (await page.locator('[data-testid="ai-assist-item"] [data-action="take"]').count()) === 3 && (await page.locator('[data-testid="ai-assist-item"] [data-action="script"]').count()) === 3 && (await page.locator('[data-testid="ai-assist-item"] [data-action="todo"]').count()) === 0)
await shot(page, 'F-radar-top5-actions')
const take1 = page.getByTestId('ai-assist-item').first()
await take1.locator('[data-action="take"]').click()
await take1.getByTestId('ai-assist-action-go').waitFor({ timeout: 8000 })
check("F9 [내 콘텐츠에 담기] → '내 콘텐츠에 담음' · [내 콘텐츠에서 보기]", /내 콘텐츠에 담음/.test(await take1.locator('[data-action="take"]').innerText()) && /내 콘텐츠에서 보기/.test(await take1.getByTestId('ai-assist-action-go').innerText()))
await take1.getByTestId('ai-assist-action-go').click()
await page.waitForTimeout(1200)
const focusRow = page.locator('[data-testid="radar-idea"][data-focus="1"]')
const focusText = (await focusRow.count()) ? await focusRow.innerText() : ''
const memoVal = (await focusRow.count()) ? await focusRow.getByTestId('radar-idea-memo').inputValue() : ''
check('F10 내 콘텐츠로 와서 그 줄이 펼쳐져 있음 — 제목 후보 맨 앞에 AI 제목 · 메모에 [AI 기획] 구성 · 제작 예정', page.url().includes('view=make') && page.url().includes('idea=') && (await focusRow.count()) === 1 && focusText.includes('정책자금 거절된 회사의 공통점 3가지') && memoVal.includes('[AI 기획') && memoVal.includes('- 1:00 실제 상담 사례') && (await focusRow.getAttribute('data-status')) !== 'idea', { url: page.url(), memoVal })
await shot(page, 'F-make-focus')

// 대본 끝까지 → 더 잘 쓰는 모델로 다시 → 저장
await openRadar(page)
await page.getByTestId('ai-assist-chip').filter({ hasText: 'TOP5' }).click()
await page.waitForFunction(() => document.querySelector('[data-testid="ai-assist-result"]')?.getAttribute('data-assist') === 'radar.top5', null, { timeout: 10000 })
await page.getByTestId('ai-assist-item').nth(1).locator('[data-action="script"]').click()
await page.waitForFunction(() => document.querySelector('[data-testid="ai-assist-result"]')?.getAttribute('data-assist') === 'radar.script', null, { timeout: 10000 })
const scr = llm.at(-1)
check('F11 [이 기획으로 대본 끝까지] → 같은 판에서 대본 단추 · 고른 기획이 자료 맨 앞(제목 · 구성 · 후보 찍기 키트)', scr.sys.includes('(radar.script') && scr.user.indexOf('[자료 · 고른 기획') >= 0 && scr.user.indexOf('[자료 · 고른 기획') < scr.user.indexOf('[자료 · 채널 설계 기준') && scr.user.includes('고용지원금 놓치는 회사 — 이 날짜 하나') && scr.user.includes('구성_규칙'), scr.user.slice(0, 500))
check('F12 대본 답 — 구간별 대사(0:00 오프닝 · 1:00 사례) · 제목 후보 · 판 제목에 고른 기획', (await page.getByTestId('ai-assist-body').count()) >= 2 && (await page.getByTestId('ai-assist-result').innerText()).includes('대본 끝까지 쓰기 · 고용지원금 놓치는 회사'))
await shot(page, 'F-script-answer')
const better = page.getByTestId('ai-assist-better')
check('F13 [더 잘 쓰는 모델로 다시] — 지금(Flash-Lite) 한 단계 위 Gemini 3.8 Flash', (await better.count()) === 1 && (await better.getAttribute('data-model')) === 'gemini-3.8-flash', await better.count())
const nBefore = llm.length
await better.click()
await page.waitForFunction((n) => document.querySelectorAll('[data-testid="ai-assist-history"] li').length >= n, 4, { timeout: 10000 })
await page.waitForTimeout(400)
const re = llm.at(-1)
check('F14 다시 만든 대본은 보통 모델로 · 같은 고른 기획 그대로 · 고른 모델 설정은 안 바뀜', llm.length === nBefore + 1 && re.url.includes('/models/gemini-3.8-flash:generateContent') && re.user.includes('[자료 · 고른 기획') && (await page.getByTestId('ai-assist-model-label').innerText()).includes('Flash-Lite'), re.url)
await page.getByTestId('ai-assist-result-actions').locator('[data-action="save-script"]').click()
await page.getByTestId('ai-assist-result-actions').getByTestId('ai-assist-action-go').waitFor({ timeout: 8000 })
await page.getByTestId('ai-assist-result-actions').getByTestId('ai-assist-action-go').click()
await page.waitForTimeout(1200)
const sRow = page.locator('[data-testid="radar-idea"][data-focus="1"]')
const sText = (await sRow.count()) ? await sRow.getByTestId('make-script').innerText() : ''
check("F15 [이 대본을 내 콘텐츠에 저장] → 그 기획 줄 · 단계 '대본 준비' · 대본 칸에 대사 · 체크 '대본 · 첫 문장'", (await sRow.count()) === 1 && (await sRow.getAttribute('data-status')) === 'script' && sText.includes('고용지원금은 신청 기한 하나 때문에') && (await sRow.locator('[data-testid="make-check"][data-id="script"]').getAttribute('data-on')) === '1', sText.slice(0, 200))
await shot(page, 'F-make-script')

// 채널 설계 기준 고치기 → 다음 기획에
await openRadar(page)
const brief = page.getByTestId('radar-brief')
if ((await brief.getAttribute('data-open')) !== '1') await brief.getByTestId('fold-toggle').click()
await brief.locator('textarea[data-brief="avoid"]').fill('코인 · 주식 종목 추천 · 연예 이야기는 다루지 않는다')
await page.getByTestId('radar-brief-save').click()
await page.waitForTimeout(800)
await brief.scrollIntoViewIfNeeded()
await shot(page, 'F-brief')
await page.getByTestId('ai-assist-chip').filter({ hasText: 'TOP5' }).click()
await page.getByTestId('ai-assist-result').waitFor({ timeout: 10000 })
check('F16 채널 설계 기준을 고치면 다음 기획 자료에 그대로(새로고침 없이)', llm.at(-1).user.includes('코인 · 주식 종목 추천 · 연예 이야기는 다루지 않는다'))
await page.keyboard.press('Escape')
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(800)
check("F17 새로고침해도 고친 기준 그대로 · '직접 고친 기준'", (await page.getByTestId('radar-brief').locator('textarea[data-brief="avoid"]').inputValue()).includes('코인') || (await page.getByTestId('radar-brief').innerText()).includes('직접 고친 기준'))

/* ---------------- E 휴대폰 ---------------- */
for (const w of [360, 390]) {
  const m = await browser.newContext({ viewport: { width: w, height: 800 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const mp = await m.newPage()
  mp.on('pageerror', (e) => errors.push(String(e)))
  await wire(mp)
  await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
  await mp.evaluate(seedScript())
  for (const p of ['/', '/money', '/ops/clients', '/ops/agents']) {
    await mp.goto(BASE + p, { waitUntil: 'networkidle' })
    await mp.waitForTimeout(500)
    const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(`E ${w} ${p}: 띠 있음 · 넘침 0`, (await mp.getByTestId('ai-assist-bar').count()) === 1 && over <= 0, over)
  }
  await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
  await mp.waitForTimeout(400)
  await mp.getByTestId('ai-assist-chip').first().click()
  await mp.getByTestId('ai-assist-result').waitFor({ timeout: 10000 })
  await mp.waitForTimeout(800)
  const wide = await mp.evaluate(() => [...document.querySelectorAll('[data-testid="ai-assist-panel"] *')].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).length)
  check(`E ${w} 판 열고 답까지 — 화면 밖으로 나간 칸 0`, wide === 0, wide)
  if (w === 390) await shot(mp, 'E-390-panel')
  // D-241 마케팅 답(줄마다 담기 · 대본 단추)도 휴대폰 폭 안에
  await mp.keyboard.press('Escape')
  await openRadar(mp)
  await mp.getByTestId('ai-assist-chip').first().click()
  await mp.getByTestId('ai-assist-result').waitFor({ timeout: 10000 })
  await mp.waitForTimeout(800)
  const wideR = await mp.evaluate(() => [...document.querySelectorAll('[data-testid="ai-assist-panel"] *')].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).length)
  check(`E ${w} 마케팅 답 + 다음 단계 단추 — 화면 밖으로 나간 칸 0`, wideR === 0, wideR)
  if (w === 390) await shot(mp, 'E-390-radar')
  await m.close()
}
check('E JS 오류 0', errors.length === 0, errors.join(' | '))

await browser.close()
console.log(`\nqa:assist: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
