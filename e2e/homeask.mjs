/**
 * qa:homeask — D-497 오늘 맨 위 대화창(미니 LLM).
 *
 * 브라우저 → /api/ai-assist 는 진짜 서버 함수(api/ai-assist.js)를 이 프로세스에서 부른다(Playwright route) · 공급자(Gemini)는 가짜.
 *
 *  1440  맨 위(숫자 칸보다 위) · 큰 글 · 안내 · 질문 세 줄 · 모델 고르기 · 빈 칸이면 보내기 막힘
 *        → "한솔테크 1차 미팅 정책자금" → home.chat 으로 · 보낸 자료에 그 업체 OS 모듈 판정 · 서류함 · 대표 이름 · 전화 0 → AI 답 · [열기] → 그 업체
 *        → 질문 세 줄 한 번 누르면 바로 답 · 👎 너무 길어요 → 다음 요청 [규칙집] 에 '너무 길다' · 👍 → 예시
 *        → [+] 업체 고르기 → 이름 없이 물어도 그 업체 자료 · 질문 속 이름 조각을 별명으로 배움 → 다음엔 고르지 않아도 그 업체
 *        → 새로 고쳐도 대화 그대로 · [대화 지우기] → 되돌리기
 *        → AI 키가 없으면 '자료로 바로 정리했어요(규칙)' + 먼저 제안할 것(AI 라는 말 없음)
 *        → 화면 꾸미기로 숨김 → 새로 고쳐도 숨김 → 다시 보이기
 *  390   넘침 0 · 빈 입력 한 줄 · 보내기 40px · 답 넘침 0
 *
 *   node e2e/homeask.mjs http://localhost:4390
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { seedScript } from './seed.mjs'

const fromRoot = (p) => import(pathToFileURL(path.resolve(p)).href)
const { default: handler, __resetAiAssistState } = await fromRoot('api/ai-assist.js')

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) pass++
  else fail++
  console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${c || d === undefined ? '' : ' ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500)}`)
}

const OWNER = 'Bearer owner-e2e-token-aaaaaaaaaaaa'
const G_KEY = 'gem-e2e-SECRET-445566'
function setEnv(over = {}) {
  for (const k of Object.keys(process.env)) if (/^(AI_|OPENAI_|SUPABASE_|GEMINI_|GOOGLE_API|ANTHROPIC_API|CLAUDE_API)/.test(k)) delete process.env[k]
  for (const [k, v] of Object.entries({ SUPABASE_URL: 'https://qa.supabase.test', SUPABASE_ANON_KEY: 'qa-anon', GEMINI_API_KEY: G_KEY, AI_ASSIST_RATE_PER_MIN: '100', AI_ASSIST_RATE_PER_HOUR: '500', ...over })) if (v !== undefined) process.env[k] = v
  __resetAiAssistState()
}

const llm = []
const HOME_ANSWER = {
  headline: '한솔테크는 정책자금부터 — 매출 자료만 받으면 바로 신청 순서를 잡을 수 있어요.',
  items: [
    { title: '정책자금 — 검토해 볼 만함', tag: '정책자금', ref: 'c1', detail: '업력 7년 · 직원 12명이라 지역신용보증재단부터 맞아요' },
    { title: '첫마디', body: '대표님, 운전자금이 필요하신 시기부터 여쭤봐도 될까요?' },
    { title: '받아 올 서류', outline: ['재무제표 3년', '국세 납세증명서'] },
  ],
  next: ['맞춤 진단서 한 장 드리기'],
  caution: '',
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
    const ans = sys.includes('(home.chat') ? HOME_ANSWER : { headline: '오늘은 서류 마감부터', items: [], next: [] }
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(ans) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 2100, candidatesTokenCount: 320 } }), { status: 200 })
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
const lastTurn = (page) => page.getByTestId('home-ask-turn').last()
// 화면에는 최근 2개만 보이므로(지난 대화는 접힘) 개수 대신 '마지막 질문 = 방금 물은 것 · 답이 옴' 으로 기다린다
async function ask(page, q) {
  await page.getByTestId('home-ask-input').fill(q)
  await page.getByTestId('home-ask-send').click()
  await page.waitForFunction((text) => {
    const t = [...document.querySelectorAll('[data-testid="home-ask-turn"]')].at(-1)
    return !!t && t.querySelector('[data-testid="home-ask-q"]')?.textContent?.trim() === text && t.getAttribute('data-status') !== 'pending'
  }, q, { timeout: 20000 })
  await page.waitForTimeout(200)
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await wire(page)
  setEnv()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('axmvp.home.ask') || k === 'axmvp.ai.choice.v1') localStorage.removeItem(k) })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  const box = page.getByTestId('home-ask')
  check('맨 위 대화창 하나', (await box.count()) === 1)
  const order = await page.evaluate(() => [...document.querySelectorAll('[data-arrange-item]')].map((e) => e.getAttribute('data-arrange-item')))
  check('화면 꾸미기 칸 중 맨 처음(숫자 칸 · AI 도우미보다 위)', order[0] === 'ask' && order.indexOf('assist') > 0, order)
  check('큰 글 · 안내 글', /무엇을 도와드릴까요/.test(await box.innerText()) && /업체 이름과 함께 물어보면/.test(await page.getByTestId('home-ask-guide').innerText()))
  const chips = await page.getByTestId('home-ask-chip').allInnerTexts()
  check('지금 자료에 맞춘 질문 세 줄(아이콘)', chips.length === 3 && (await page.getByTestId('home-ask-chip').first().getAttribute('data-icon')) !== null, chips)
  check('빈 칸이면 보내기 막힘 · PC 는 모델 고르기 · [+]', (await page.getByTestId('home-ask-send').isDisabled()) && (await page.getByTestId('home-ask-model').isVisible()) && (await page.getByTestId('home-ask-plus').isVisible()))

  // 업체 이름과 함께 묻기 → home.chat · 그 업체 자료
  await ask(page, '한솔테크 1차 미팅 가는데 정책자금 어떻게 제안할까?')
  const call = llm.at(-1)
  check('home.chat 지시문으로 공급자 한 번', llm.length === 1 && call.sys.includes('(home.chat'), llm.length)
  check('보낸 자료: 물어본 업체 · 회사 · OS 모듈 판정 · 서류함 + 오늘', call.user.includes('[자료 · 물어본 업체 · 회사') && call.user.includes('[자료 · 물어본 업체 · OS 모듈 판정(규칙 계산)') && call.user.includes('한솔테크') && call.user.includes('[자료 · 오늘 ·'), call.user.slice(0, 600))
  check('보낸 자료에 대표 이름 · 휴대폰 번호 0', !call.user.includes('김대표') && !call.user.includes('010-2345-6789') && !call.user.includes('010-9876-5432'))
  check('보낸 자료: 업체를 물었으면 고객 전체 목록은 안 보냄', !call.user.includes('[자료 · 고객 ·'))
  const t1 = lastTurn(page)
  check('AI 답 · 모델 이름 · 헤드라인 · 첫마디 글', (await t1.getAttribute('data-status')) === 'ai' && /AI 답/.test(await t1.getByTestId('home-ask-source').innerText()) && /정책자금부터/.test(await t1.getByTestId('home-ask-headline').innerText()) && /운전자금이 필요하신/.test(await t1.innerText()))
  check('이 업체 자료로: 한솔테크(주)', /한솔테크/.test(await t1.getByTestId('home-ask-clients').innerText()))
  check('질문 세 줄은 대화가 생기면 접힘', (await page.getByTestId('home-ask-suggest').count()) === 0)
  await t1.getByTestId('home-ask-ref').first().click()
  await page.waitForURL(/\/ops\/clients\/cli_hansol/)
  check('[열기] → 그 업체', page.url().includes('/ops/clients/cli_hansol'))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('다른 화면에 다녀와도 대화 그대로', (await page.getByTestId('home-ask-turn').count()) === 1)

  // 👎 너무 길어요 → 다음 요청에 말하기 규칙 · 👍 → 예시
  await lastTurn(page).getByTestId('home-ask-down').click()
  await lastTurn(page).locator('[data-testid="home-ask-reason"][data-reason="tooLong"]').click()
  await ask(page, '오늘 제일 중요한 것 3개만')
  const call2 = llm.at(-1)
  check('👎 너무 길어요 → 다음 요청 [규칙집] 에 짧게', call2.user.includes('[규칙집]') && call2.user.includes('너무 길다'), call2.user.slice(-800))
  check('업체 없는 질문 → 오늘 · 고객 전체 자료', call2.user.includes('[자료 · 오늘 · 밀린 할 일') || call2.user.includes('[자료 · 오늘 · 오늘 할 일'))
  check('이어지는 질문 — 앞선 대화도 보냄', call2.user.includes('[자료 · 앞선 대화'))
  await lastTurn(page).getByTestId('home-ask-up').click()
  await ask(page, '그럼 다움에너지는?')
  check('👍 → 다음 요청에 좋다고 한 답의 예', llm.at(-1).user.includes('좋다고 한 답의 예'))

  // [+] 업체 고르기 → 이름 없이 물어도 그 업체 · 이름 조각을 별명으로
  await page.getByTestId('home-ask-plus').click()
  await page.getByTestId('home-ask-pick-open').click()
  await page.getByTestId('home-ask-pick').selectOption('cli_daum')
  check('고른 업체 칩', /다움에너지/.test(await page.getByTestId('home-ask-pinned').innerText()))
  await ask(page, '에너지 회사 미팅 뭐 준비해?')
  check('고른 업체 자료로 물음(이름이 질문에 없어도)', llm.at(-1).user.includes('[자료 · 물어본 업체 · 회사') && llm.at(-1).user.includes('다움에너지'))
  await page.getByTestId('home-ask-pinned').getByRole('button', { name: '업체 빼기' }).click()
  await ask(page, '에너지 쪽 서류 뭐 받아야 해?')
  check('배운 별명 — 고르지 않아도 "에너지" → 다움에너지', /다움에너지/.test(await lastTurn(page).getByTestId('home-ask-clients').innerText().catch(() => '')), await lastTurn(page).innerText())

  // 새로 고쳐도 · 지우기 · 되돌리기
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const olderText = await page.getByTestId('home-ask-older').innerText().catch(() => '')
  const older = Number(/지난 대화 (\d+)개 보기/.exec(olderText)?.[1] ?? 0)
  check('새로 고쳐도 대화 그대로(최근 2개 + 지난 대화 보기)', (await page.getByTestId('home-ask-turn').count()) === 2 && older >= 3, olderText)
  await page.getByTestId('home-ask-older').click()
  check('지난 대화 펼치기 → 전부', (await page.getByTestId('home-ask-turn').count()) === older + 2)
  await page.getByTestId('home-ask-clear').click()
  await page.waitForTimeout(200)
  check('대화 지우기 → 질문 세 줄로', (await page.getByTestId('home-ask-turn').count()) === 0 && (await page.getByTestId('home-ask-suggest').count()) === 1)
  await page.getByRole('button', { name: '되돌리기' }).click()
  await page.waitForTimeout(200)
  check('되돌리기 → 대화가 돌아옴', (await page.getByTestId('home-ask-turn').count()) >= 2)

  // 질문 세 줄 한 번 누르면 바로
  await page.getByTestId('home-ask-clear').click()
  const before = llm.length
  await page.getByTestId('home-ask-chip').first().click()
  await page.waitForFunction(() => document.querySelector('[data-testid="home-ask-turn"]')?.getAttribute('data-status') === 'ai', null, { timeout: 20000 })
  check('질문 세 줄 — 한 번 누르면 바로 답', llm.length === before + 1)

  // AI 키가 없으면 규칙으로 정리
  setEnv({ GEMINI_API_KEY: undefined })
  await ask(page, '다움에너지 미팅 준비 — 무엇을 먼저 제안할까?')
  const rt = lastTurn(page)
  const rtext = await rt.innerText()
  check("AI 키 없음 → '자료로 바로 정리했어요(규칙)' · 까닭 · 먼저 제안할 것", (await rt.getAttribute('data-status')) === 'rule' && /자료로 바로 정리했어요/.test(rtext) && /AI 연결/.test(rtext) && /다움에너지/.test(await rt.getByTestId('home-ask-headline').innerText()), rtext.slice(0, 400))
  check("규칙 답 본문에는 'AI' 라는 말 없음(출처 줄 빼고)", !/AI/.test(await rt.getByTestId('home-ask-headline').innerText()) && (await rt.getByTestId('home-ask-item').count()) >= 1)
  setEnv()

  // 화면 꾸미기로 숨김
  await page.getByTestId('arrange-open').click()
  await page.getByTestId('arrange-list').waitFor()
  await page.locator('[data-arrange-row="ask"] [data-vis="off"]').click()
  await page.getByTestId('arrange-done').click()
  await page.waitForTimeout(300)
  check('화면 꾸미기 → 대화창 숨김', (await page.getByTestId('home-ask').count()) === 0)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('새로 고쳐도 숨김 그대로', (await page.getByTestId('home-ask').count()) === 0)
  await page.getByTestId('arrange-open').click()
  await page.getByTestId('arrange-list').waitFor()
  await page.locator('[data-arrange-row="ask"] [data-vis="show"]').click()
  await page.getByTestId('arrange-done').click()
  await page.waitForTimeout(300)
  check('다시 보이기', (await page.getByTestId('home-ask').count()) === 1)
  check('1440: 오류 0', errors.length === 0, errors)
  await ctx.close()
}

/* ---------------- 390 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await wire(page)
  setEnv()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const ox = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('390: 대화창 보임 · 넘침 0', (await page.getByTestId('home-ask').count()) === 1 && (await ox()) <= 0, await ox())
  const ib = await page.getByTestId('home-ask-input').boundingBox()
  const sb = await page.getByTestId('home-ask-send').boundingBox()
  check('390: 빈 입력은 한 줄(안내 글이 칸을 키우지 않음) · 보내기 40px', ib && ib.height <= 48 && sb && sb.width >= 39.5 && sb.height >= 39.5, { ib, sb })
  check('390: 질문 줄 누르기 높이 40px 이상', (await page.getByTestId('home-ask-chip').first().boundingBox()).height >= 39.5)
  await ask(page, '한솔테크 미팅 준비')
  check('390: 답 · 넘침 0', (await page.getByTestId('home-ask-answer').count()) === 1 && (await ox()) <= 0, await ox())
  check('390: 오류 0', errors.length === 0, errors)
  await ctx.close()
}

await browser.close()
console.log(`\nqa:homeask: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
