/**
 * qa:homeask — D-497 오늘 맨 위 대화창(미니 LLM).
 *
 * 브라우저 → /api/ai-assist 는 진짜 서버 함수(api/ai-assist.js)를 이 프로세스에서 부른다(Playwright route) · 공급자(Gemini)는 가짜.
 *
 *  1440  맨 위(숫자 칸보다 위) · 큰 글 · 안내 · 질문 세 줄 · 모델 고르기 · 빈 칸이면 보내기 막힘
 *        → "한솔테크 1차 미팅 정책자금" → home.chat 으로 · 보낸 자료에 그 업체 OS 모듈 판정 · 서류함 · 대표 이름 · 전화 0 → AI 답 · [열기] → 그 업체
 *        → D-505 업체 상세 업무 일기에 적은 메모도 같은 카드 → [기록]
 *        → D-504 말한 다음 약속(다음 주 화요일 오후 2시 2차 미팅) → 다음 할 일 · 들은 말은 업무 일기 상담 메모
 *        → D-503 말한 숫자(작년 매출 52억 · 직원 18명) → [기록] → 회사 정보(상담 메모) · 달라지는 판정
 *        → D-502 말한 업체 사정(청년 뽑는대 · 가지급금 있대) → [업체에 기록] 한 번 → 새로 열린 상황 맨 앞
 *        → D-501 답 아래 '상황 예시로 바로 설계'(맞는 상황 · 질문의 모듈 먼저) → 누르면 그 업체 숫자로 모듈
 *        → D-499 답에서 한 번에: [서류 요청 문구 복사] · [이 글 복사] · 다음에 할 일 [할 일로](그 업체 · 내일)
 *        → 질문 세 줄 한 번 누르면 바로 답 · 👎 너무 길어요 → 다음 요청 [규칙집] 에 '너무 길다' · 👍 → 예시
 *        → [+] 업체 고르기 → 이름 없이 물어도 그 업체 자료 · 질문 속 이름 조각을 별명으로 배움 → 다음엔 고르지 않아도 그 업체
 *        → 새로 고쳐도 대화 그대로 · [대화 지우기] → 되돌리기
 *        → AI 키가 없으면 '자료로 바로 정리했어요(규칙)' + 먼저 제안할 것(AI 라는 말 없음)
 *        → D-498 서류 올리기: 등록된 업체 사업자등록증 → 임시 판정 · 답(대표 이름 · 번호 0) → [서류함에 넣기] → 그 업체 서류함 저장
 *          · 등록 안 된 회사 → [새 업체로 등록] → 등록 창에 서류 · 업체명 · AI 없으면 규칙 정리에 '이 서류에서 읽은 것'
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
// HOMEASK_SHOTS=<폴더> 면 첫 화면 · AI 답 · 휴대폰을 찍어 둔다(눈 확인용)
const SHOTS = process.env.HOMEASK_SHOTS ?? ''
const shot = async (loc, name) => { if (SHOTS) await loc.screenshot({ path: path.join(SHOTS, `${name}.png`) }) }
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
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'] })
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
  check('큰 글 · 안내 글', /무엇을 도와드릴까요/.test(await box.innerText()) && /업체 이름과 함께 물어보거나 서류를 올리면/.test(await page.getByTestId('home-ask-guide').innerText()))
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
  await shot(page.getByTestId('home-ask'), 'pc-ai-answer')
  check('질문 세 줄은 대화가 생기면 접힘', (await page.getByTestId('home-ask-suggest').count()) === 0)
  // D-499 답에서 한 번에 — 받아 올 서류 → 요청 문구 복사 · 다음에 할 일 → 할 일로
  await t1.getByTestId('home-ask-docreq').click()
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  check('D-499 [서류 요청 문구 복사] — 업체 이름 · 서류 목록이 든 카톡 문구', /한솔테크/.test(clip) && /- 재무제표 3년/.test(clip) && /- 국세 납세증명서/.test(clip), clip)
  await t1.getByTestId('home-ask-body-copy').first().click()
  check('D-499 [이 글 복사] — 첫마디 그대로', /운전자금이 필요하신/.test(await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')))
  const todoBtn = t1.getByTestId('home-ask-todo').first()
  await todoBtn.click()
  await page.waitForTimeout(400)
  const todo = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]').find((j) => /맞춤 진단서 한 장 드리기/.test(j.content)))
  const tomorrow = new Date(Date.now() + 9 * 3600_000 + 86_400_000).toISOString().slice(0, 10)
  check('D-499 [할 일로] → 할 일(그 업체 · 내일 기한 · 업체 이름 붙음) · 단추는 할 일에 넣음', !!todo && todo.clientId === 'cli_hansol' && todo.dueDate === tomorrow && /한솔테크/.test(todo.content) && (await todoBtn.innerText()).includes('할 일에 넣음') && (await todoBtn.isDisabled()), todo)
  await t1.getByTestId('home-ask-diag').click()
  await page.waitForURL(/\/ops\/clients\/cli_hansol/)
  const diagOpen = await page.getByTestId('diagnosis-snapshot').first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('D-499 [맞춤 진단서] 한 번 → 그 업체 진단서가 바로 열림 · 닫으면 주소에서 diag 빠짐', diagOpen && !page.url().includes('diag='), page.url())
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await t1.getByTestId('home-ask-ref').first().click()
  await page.waitForURL(/\/ops\/clients\/cli_hansol/)
  check('[열기] → 그 업체', page.url().includes('/ops/clients/cli_hansol'))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('다른 화면에 다녀와도 대화 그대로', (await page.getByTestId('home-ask-turn').count()) === 1)
  // D-501 답 아래 '상황 예시로 바로 설계' — 이 업체에 맞는 상황(최대 3) · 정책자금을 물었으면 정책자금 먼저 · 누르면 그 업체 숫자로 모듈
  const plans = t1.getByTestId('home-ask-plan')
  const planMods = await plans.evaluateAll((els) => els.map((e) => e.getAttribute('data-module')))
  check('D-501 상황 예시 단추 1~3개(새로 고쳐도 남음)', planMods.length >= 1 && planMods.length <= 3, planMods)
  check('D-501 정책자금을 물으면 정책자금 상황이 먼저(있으면)', !planMods.includes('policy-funding') || planMods[0] === 'policy-funding', planMods)
  check('D-501 AI 에도 같은 상황(금액은 엔진 값)', call.user.includes('맞는 상황 예시'), call.user.slice(0, 300))
  const planHref = await plans.first().getAttribute('href')
  await plans.first().click()
  await page.waitForURL(/preset=/)
  const presetShown = await page.getByTestId('preset-chip').first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false)
  check('D-501 누르면 그 업체 · 그 가정으로 모듈이 열림(넣은 가정 칩)', presetShown && page.url().includes('client=cli_hansol') && !!planHref && page.url().includes(planHref.split('?')[0]), page.url())
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

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

  // D-498 서류 올리기 — 등록된 업체(미래바이오랩) 사업자등록증 → 임시 판정 · 답 → [서류함에 넣기] → 그 업체 서류함
  const txt = (name, lines) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(lines.join('\n'), 'utf8') })
  const BIZ_OLD = txt('사업자등록증.txt', ['사업자등록증', '(법인사업자)', '등록번호 : 124-81-00998', '법인명(단체명) : 미래바이오랩', '대표자 : 이대표', '개업연월일 : 2023 년 01 월 10 일', '법인등록번호 : 110111-1234569', '사업장 소재지 : 경기도 파주시 탄현면 평화로 3', '업태 : 제조업', '종목 : 바이오 시약'])
  const BIZ_NEW = txt('새봄 사업자등록증.txt', ['사업자등록증', '(개인사업자)', '등록번호 : 214-86-12303', '상호 : 새봄식품', '대표자 : 박새봄', '개업연월일 : 2024 년 03 월 02 일', '사업장 소재지 : 강원특별자치도 춘천시 중앙로 10', '업태 : 제조업', '종목 : 떡류 제조'])
  await page.getByTestId('home-ask-clear').click()
  await page.getByTestId('home-ask-file').setInputFiles([BIZ_OLD])
  await page.waitForFunction(() => document.querySelector('[data-testid="home-ask-doc"]')?.getAttribute('data-status') === 'done', null, { timeout: 15000 })
  check('D-498 서류 칩 — 읽고 나면 종류(사업자등록증)', /사업자등록증/.test(await page.getByTestId('home-ask-doc').innerText()), await page.getByTestId('home-ask-doc').innerText())
  check('D-498 질문 없이 서류만으로도 보내기 가능', !(await page.getByTestId('home-ask-send').isDisabled()))
  await shot(page.getByTestId('home-ask'), 'pc-doc-chip')
  const before498 = llm.length
  await page.getByTestId('home-ask-send').click()
  await page.waitForFunction(() => { const t = [...document.querySelectorAll('[data-testid="home-ask-turn"]')].at(-1); return !!t && t.getAttribute('data-status') !== 'pending' }, null, { timeout: 30000 })
  await page.waitForTimeout(300)
  const dcall = llm.at(-1)
  check('D-498 서류만 보내면 묻는 말을 대신(사업자등록증 받았어 …)', /사업자등록증 받았어/.test(await lastTurn(page).getByTestId('home-ask-q').innerText()))
  check('D-498 보낸 자료: 방금 올린 서류(임시 판정) · 읽은 것 · 그 업체(미래바이오랩)', llm.length === before498 + 1 && dcall.user.includes('[자료 · 방금 올린 서류(아직 저장 전 · 임시 판정)') && dcall.user.includes('[자료 · 방금 올린 서류에서 읽은 것') && dcall.user.includes('미래바이오랩') && dcall.user.includes('[자료 · 물어본 업체 · OS 모듈 판정'), dcall.user.slice(0, 900))
  check('D-498 보낸 자료에 서류 속 대표 이름 · 사업자번호 · 법인번호 0', !dcall.user.includes('이대표') && !dcall.user.includes('124-81-00998') && !dcall.user.includes('1240100998') && !dcall.user.includes('110111-1234569'))
  check('D-498 질문 아래 올린 서류 줄', /사업자등록증/.test(await lastTurn(page).getByTestId('home-ask-turn-docs').innerText()))
  const save1 = lastTurn(page).getByTestId('home-ask-docsave-go')
  check('D-498 답 아래 [미래바이오랩 서류함에 넣기](등록된 업체)', (await save1.getAttribute('data-target')) === 'client' && /미래바이오랩 서류함에 넣기/.test(await save1.innerText()), await save1.innerText().catch(() => ''))
  await save1.click()
  await page.waitForURL(/\/ops\/clients\/cli_mirae/)
  const savedOk = await page.waitForFunction(() => { const r = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((x) => x.id === 'cli_mirae'); return !!r && Object.values(r.documents ?? {}).some((d) => d && d.received && /사업자등록증/.test(d.fileName ?? '')) }, null, { timeout: 20000 }).then(() => true).catch(() => false)
  check('D-498 → 그 업체 화면에서 서류함에 저장(사업자등록증 받음)', savedOk)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('D-498 돌아오면 [넘겼어요] 로(두 번 넘기지 않게)', /서류함으로 넘겼어요/.test(await lastTurn(page).getByTestId('home-ask-docsave').innerText()) && (await lastTurn(page).getByTestId('home-ask-docsave-go').count()) === 0)

  // 새 업체(새봄식품) → [새 업체로 등록] → 등록 창에 서류 · 업체명이 채워진 채
  await page.getByTestId('home-ask-file').setInputFiles([BIZ_NEW])
  await page.waitForFunction(() => document.querySelector('[data-testid="home-ask-doc"]')?.getAttribute('data-status') === 'done', null, { timeout: 15000 })
  await ask(page, '이 업체 정책자금 어떻게 제안할까?')
  const save2 = lastTurn(page).getByTestId('home-ask-docsave-go')
  check('D-498 등록 안 된 회사 → [새 업체로 등록 — 새봄식품]', (await save2.getAttribute('data-target')) === 'new' && /새 업체로 등록 — 새봄식품/.test(await save2.innerText()), await save2.innerText().catch(() => ''))
  await shot(page.getByTestId('home-ask'), 'pc-doc-answer')
  check('D-498 새 업체 자료도 보냄(임시 판정 · 등록된업체 아니요)', llm.at(-1).user.includes('새봄식품') && llm.at(-1).user.includes('아니요(새 업체)') && !llm.at(-1).user.includes('박새봄'))
  check('D-498 없는 업체 화면으로 가는 [열기] 없음', (await lastTurn(page).locator('[data-testid="home-ask-ref"][href*="chat_new"]').count()) === 0)
  await save2.click()
  await page.waitForURL(/\/ops\/clients\?new=1/)
  await page.getByTestId('new-client-docs').waitFor({ timeout: 10000 })
  // 넘긴 서류를 등록 창이 읽어 칸을 채울 때까지
  const regName = await page.waitForFunction(() => [...document.querySelectorAll('label')].find((l) => l.innerText.trim().startsWith('업체명'))?.querySelector('input')?.value ?? '', null, { timeout: 10000 }).then((h) => h.jsonValue()).catch(() => '')
  const modalText = await page.getByTestId('new-client-docs').innerText().catch(() => '')
  check('D-498 → 새 업체 등록 창: 넘긴 서류가 들어 있고 업체명이 채워짐', /새봄 사업자등록증/.test(modalText) && /새봄식품/.test(regName), { regName, modalText: modalText.slice(0, 200), labels: await page.evaluate(() => [...document.querySelectorAll('label')].map((l) => l.innerText.trim().split('\n')[0]).slice(0, 8)) })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  // AI 키가 없을 때 서류 → 규칙 정리에도 '이 서류에서 읽은 것'
  setEnv({ GEMINI_API_KEY: undefined })
  await page.getByTestId('home-ask-file').setInputFiles([BIZ_NEW])
  await page.waitForFunction(() => document.querySelector('[data-testid="home-ask-doc"]')?.getAttribute('data-status') === 'done', null, { timeout: 15000 })
  await ask(page, '새봄식품 무엇을 먼저 제안할까?')
  const rt2 = await lastTurn(page).innerText()
  check("D-498 AI 없이도 — 규칙 정리 맨 위 '이 서류에서 읽은 것'(업태 · 개업일 등)", (await lastTurn(page).getAttribute('data-status')) === 'rule' && /이 서류에서 읽은 것/.test(rt2) && /(개업|설립|업태|업종)/.test(rt2), rt2.slice(0, 500))
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

  // D-502 말한 업체 사정 → 상황 질문의 답 → [업체에 기록] 한 번 → 새로 열린 상황이 단추 맨 앞
  await ask(page, '한솔테크 대표님이 내년에 청년 2명 뽑는대, 가지급금도 좀 있대')
  const tcall = llm.at(-1)
  const tt = lastTurn(page)
  const talkKeys = await tt.getByTestId('home-ask-talk-item').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-key')}:${e.getAttribute('data-a')}`))
  check('D-502 이 말에서 알게 된 사정 — 청년 채용 계획 있음 · 가지급금 있음', talkKeys.includes('hireYouth:yes') && talkKeys.includes('loan:yes'), talkKeys)
  check('D-502 AI 에도 같은 사정(아직 기록 전)', tcall.user.includes('대화에서 알게 된 사정'), tcall.user.slice(0, 400))
  const firstTag = await tt.getByTestId('home-ask-plan').first().getByTestId('home-ask-plan-tag').innerText().catch(() => '')
  check('D-502 새로 맞게 된 상황이 단추 맨 앞(방금 말한 것)', firstTag.includes('방금 말한 것'), firstTag)
  const scnBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((c) => c.id === 'cli_hansol')?.decided?.['scn.hireYouth'] ?? null)
  check('D-502 누르기 전에는 업체에 안 적힘(최종 확인 한 번)', scnBefore === null, scnBefore)
  await shot(tt, 'pc-talk')
  await tt.getByTestId('home-ask-talk-save').click()
  await tt.locator('[data-testid="home-ask-talk"][data-saved="1"]').waitFor({ timeout: 8000 })
  const decided = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((c) => c.id === 'cli_hansol')?.decided ?? {})
  check('D-502 [한솔테크(주)에 기록] → 업체에 답이 남음(청년 채용 예 · 가지급금 예)', decided['scn.hireYouth']?.a === 'yes' && decided['scn.loan']?.a === 'yes', decided)
  await ask(page, '청년 2명 채용하면 얼마 받아? 한솔테크')
  const tt2 = lastTurn(page)
  check('D-502 이미 기록한 사정 · 가정 질문은 다시 기록하자고 안 함', (await tt2.getByTestId('home-ask-talk').count()) === 0)

  // D-503 말한 숫자 → 회사 정보(출처 '상담 메모') — 작년 매출 · 직원 수
  await ask(page, '한솔테크 작년 매출 52억이고 직원 18명이래')
  const tn = lastTurn(page)
  const numKeys = await tn.getByTestId('home-ask-talk-num').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-key')}=${e.getAttribute('data-value')}`))
  check('D-503 이 말에서 읽은 숫자 — 매출 52억 · 직원 18명', numKeys.includes('revenue=5200000000') && numKeys.includes('employeeCount=18명'), numKeys)
  check('D-503 AI 에도 같은 숫자(말한 숫자)', llm.at(-1).user.includes('말한 숫자'), llm.at(-1).user.slice(0, 300))
  await shot(tn, 'pc-talk-num')
  await tn.getByTestId('home-ask-talk-save').click()
  await tn.locator('[data-testid="home-ask-talk"][data-saved="1"]').waitFor({ timeout: 8000 })
  const hs = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((c) => c.id === 'cli_hansol') ?? {})
  check('D-503 [기록] → 회사 정보: 매출 52억(2025 · 상담 메모) · 직원 18명', hs.factValues?.revenue === '5200000000' && hs.factMeta?.revenue?.source === 'meeting' && hs.factMeta?.revenue?.asOf === String(Number(new Date().getFullYear()) - 1) && hs.employeeCount === '18명', { v: hs.factValues?.revenue, m: hs.factMeta?.revenue, e: hs.employeeCount })
  await ask(page, '한솔테크 직원 18명이고 작년 매출 52억')
  check('D-503 같은 숫자를 다시 말하면 다시 기록하자고 안 함', (await lastTurn(page).getByTestId('home-ask-talk').count()) === 0)

  // D-504 말한 다음 약속 → 업체 다음 할 일(날짜 · 무엇) + 들은 말은 업무 일기 '상담 메모'
  await ask(page, '한솔테크 다음 주 화요일 오후 2시에 2차 미팅 하기로 했어')
  const tx = lastTurn(page)
  const nxDate = await tx.getByTestId('home-ask-talk-next').getAttribute('data-date').catch(() => null)
  const nxText = await tx.getByTestId('home-ask-talk-next').innerText().catch(() => '')
  const todayIso = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  check('D-504 다음 약속 — 다음 주 화요일 · 2차 미팅 · 오후 2시', !!nxDate && nxDate > todayIso && new Date(`${nxDate}T00:00:00Z`).getUTCDay() === 2 && /2차 미팅 · 오후 2시/.test(nxText), { nxDate, nxText })
  await tx.getByTestId('home-ask-talk-save').click()
  await tx.locator('[data-testid="home-ask-talk"][data-saved="1"]').waitFor({ timeout: 8000 })
  await page.waitForTimeout(400)
  const hx = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((c) => c.id === 'cli_hansol') ?? {})
  check('D-504 [기록] → 한솔테크 다음 할 일 = 2차 미팅 · 오후 2시 · 그 날짜', hx.nextAction === '2차 미팅 · 오후 2시' && hx.nextActionDueDate === nxDate, { a: hx.nextAction, d: hx.nextActionDueDate })
  const memo = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]').find((j) => j.entryType === 'note' && /^상담 메모 — 한솔테크 다음 주 화요일/.test(j.content)))
  check('D-504 들은 말은 업무 일기에 상담 메모(그 업체 · 할 일 아님)', !!memo && memo.clientId === 'cli_hansol' && !memo.dueDate, memo)

  // D-505 업체 상세 › 업무 일기에 적은 메모도 같은 카드 → [기록] 한 번
  await page.goto(BASE + '/ops/clients/cli_mirae?tab=journal', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.locator('textarea[aria-label="기록 내용"]').first().fill('대표님이 장애인 1명 채용할 계획이래, 직원 9명이고 모레 방문하기로 했어')
  await page.getByRole('button', { name: '기록', exact: true }).first().click()
  const jt = page.getByTestId('journal-talk')
  const jtShown = await jt.waitFor({ timeout: 8000 }).then(() => true).catch(() => false)
  const jtKeys = jtShown ? await jt.locator('[data-key]').evaluateAll((els) => els.map((e) => e.getAttribute('data-key'))) : []
  check('D-505 업무 일기 메모 → 카드(장애인 채용 · 직원 9명 · 다음 약속)', jtShown && jtKeys.includes('hireDisabled') && jtKeys.includes('employeeCount') && (await jt.getByTestId('home-ask-talk-next').count()) === 1, jtKeys)
  await shot(jt, 'pc-journal-talk')
  await jt.getByTestId('home-ask-talk-save').click()
  await page.locator('[data-testid="journal-talk"][data-saved="1"]').waitFor({ timeout: 8000 })
  await page.waitForTimeout(400)
  const mr = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((c) => c.id === 'cli_mirae') ?? {})
  check('D-505 [미래바이오랩에 기록] → 상황 답 · 직원 수 · 다음 할 일(방문)', mr.decided?.['scn.hireDisabled']?.a === 'yes' && mr.employeeCount === '9명' && mr.nextAction === '방문' && !!mr.nextActionDueDate, { d: mr.decided?.['scn.hireDisabled'], e: mr.employeeCount, n: mr.nextAction })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
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
  // D-498 휴대폰에서도 서류 넣기 — 칩 · 넘침 0
  await page.getByTestId('home-ask-file').setInputFiles([{ name: '아주긴파일이름_사업자등록증_2026년_최신본_스캔.txt', mimeType: 'text/plain', buffer: Buffer.from('사업자등록증\n등록번호 : 214-86-12303\n상호 : 새봄식품\n개업연월일 : 2024 년 03 월 02 일', 'utf8') }])
  await page.waitForFunction(() => document.querySelector('[data-testid="home-ask-doc"]')?.getAttribute('data-status') === 'done', null, { timeout: 15000 })
  check('390: 서류 칩(긴 파일 이름) · 넘침 0', (await ox()) <= 0 && (await page.getByTestId('home-ask-doc').boundingBox()).width <= 360, await ox())
  await shot(page.getByTestId('home-ask'), 'phone-doc-chip')
  await page.getByTestId('home-ask-doc').getByRole('button').click()
  await ask(page, '한솔테크 미팅 준비')
  check('390: 답 · 넘침 0', (await page.getByTestId('home-ask-answer').count()) === 1 && (await ox()) <= 0, await ox())
  await shot(page, 'phone-ai-answer')
  // D-502 · D-503 휴대폰 — 말한 사정 · 숫자 카드 · 상황 단추 넘침 0 · [기록] 단추 누르기 높이
  await ask(page, '한솔테크 작년 매출 52억이고 직원 18명이래, 청년 2명 더 뽑는대, 다음 주 금요일 오후 3시에 방문하기로 했어')
  const pt = lastTurn(page)
  const ptCard = pt.getByTestId('home-ask-talk')
  check('390: 말한 사정 · 숫자 · 다음 약속 카드(사정 1 · 숫자 2 · 약속 1) · 넘침 0', (await ptCard.count()) === 1 && (await pt.getByTestId('home-ask-talk-item').count()) === 1 && (await pt.getByTestId('home-ask-talk-num').count()) === 2 && (await pt.getByTestId('home-ask-talk-next').count()) === 1 && (await ox()) <= 0, await ox())
  check('390: [기록] 단추 누르기 높이 40px 이상', (await pt.getByTestId('home-ask-talk-save').boundingBox()).height >= 39.5)
  await ptCard.scrollIntoViewIfNeeded()
  await shot(ptCard, 'phone-talk')
  check('390: 오류 0', errors.length === 0, errors)
  await ctx.close()
}

await browser.close()
console.log(`\nqa:homeask: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
