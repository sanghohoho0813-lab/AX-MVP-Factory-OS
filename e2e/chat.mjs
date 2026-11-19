/**
 * qa:chat — D-250 특허 · 벤처 · 기업인증 대화창. 실행: npm run qa:chat -- http://localhost:4390 [사진 폴더]
 * D-628(2026-11-18 대표 지시) 대화창은 오른쪽 판(휴대폰은 아래 판)으로 — 가운데는 작업 화면(머리 · 단계 · 준비 현황 / 인증 한눈에).
 *   처음(대화 없음)은 시작 카드 → [대화 시작] → 질문칸 · 큰 단추 4. 답 단추를 누르면 가운데가 바뀌고 판은 열린 채.
 *
 * 브라우저 → /api/ai-assist 는 진짜 서버 함수(api/ai-assist.js)를 이 프로세스에서 부른다(Playwright route).
 * 밖으로 나가는 것만 가짜: Supabase 로그인 확인 · 권한 RPC · AI 공급자(Gemini).
 *
 *   A 특허 · 벤처: 처음 화면(무엇을 도와드릴까요? · 질문창 · 큰 단추 4) · [사용 방법] 8단계 · [자세히] → 예전 진행판 → [대화창으로]
 *     단추 → 바로 답(AI 안 부름) · [견본으로 연습] → 명세서 쓰기 → 돌아오면 대화 그대로 · [이어서 쓰기]
 *     D-636 [자세히] · [대화창으로] · [견본으로 연습] 으로 옮기는 2초 동안 오른쪽 판이 한 번도 사라지거나 비지 않음(50ms 마다 · 바뀔 때마다 · 그려질 때마다)
 *     쓴 질문 → AI 답(pv.chat · 작업 단추 붙음 · 발명 본문 안 감) · [AI로 더 자세히] · AI 실패 → 정해진 답 + 알림
 *     📎 명세서 파일 → 점검 답 · 답 복사 · 대화 지우기 → [되돌리기] · 회사 바꾸면 그 회사 대화
 *   B 기업인증: 목차 · 순서 띠 없이 대화창만 · 회사 없으면 '회사 고르기' · 단추 4 → 답 · [전체 판정 보기] → 예전 '인증 한눈에'(?detail=1)
 *     요청 문구 · 카톡 문구 복사 · 쓴 질문 → AI 답(cert.chat) + [벤처 자세히]
 *   C 휴대폰 360 · 390 · 430 · 글자 아주 크게: 넘침 0 · 질문창이 아래 메뉴에 가리지 않음 · 단추 줄 한 줄 · 사진
 *   D JS 오류 0 · 키 노출 0
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import fs from 'node:fs'
import { seedScript } from './seed.mjs'
import { openChat } from './pageTools.mjs'

/** D-627 모듈 목차는 [목차] 단추 하나(서랍) — 목차 줄 수를 세고 서랍을 닫는다 */
async function navCount(page) {
  const open = page.getByTestId('module-menu-open')
  if (!(await open.count())) return 0
  await open.click()
  await page.getByTestId('module-nav').waitFor({ timeout: 3000 }).catch(() => {})
  const n = await page.locator('[data-testid="module-nav"] [data-section]:visible').count()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  return n
}
/** 서랍을 열어 그 줄의 주소를 읽고 닫는다 */
async function navHref(page, key) {
  await page.getByTestId('module-menu-open').click()
  const href = await page.locator(`[data-testid="module-nav"] [data-section="${key}"]`).first().getAttribute('href').catch(() => null)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  return href
}

const fromRoot = (p) => import(pathToFileURL(path.resolve(p)).href)
const { default: handler, __resetAiAssistState } = await fromRoot('api/ai-assist.js')

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.argv[3] ?? ''
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true })
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
const shot = async (page, name, full = false) => {
  if (!SHOTS) return
  await page.waitForTimeout(700) // 판 열림 · 부드러운 내림이 끝난 뒤
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full })
}
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

const OWNER = 'Bearer owner-e2e-token-aaaaaaaaaaaa'
const G_KEY = 'gem-e2e-SECRET-chat-112233'
function setEnv(over = {}) {
  for (const k of Object.keys(process.env)) if (/^(AI_|OPENAI_|SUPABASE_|GEMINI_|GOOGLE_API|ANTHROPIC_API|CLAUDE_API)/.test(k)) delete process.env[k]
  for (const [k, v] of Object.entries({ SUPABASE_URL: 'https://qa.supabase.test', SUPABASE_ANON_KEY: 'qa-anon', GEMINI_API_KEY: G_KEY, AI_ASSIST_RATE_PER_MIN: '100', AI_ASSIST_RATE_PER_HOUR: '500', ...over })) if (v !== undefined) process.env[k] = v
  __resetAiAssistState()
}

/** 공급자에 간 요청 */
const llm = []
const answerFor = (sys) => {
  if (sys.includes('(pv.chat')) return { headline: '청구항부터 정리하세요', items: [{ title: '청구항 1 다듬기', tag: '먼저', detail: '독립항 하나에 핵심 구성요소만' }, { title: '도면 2 확인', detail: '구성요소 번호와 맞는지' }], next: ['본문 5단계 쓰기'], caution: '' }
  if (sys.includes('(cert.chat')) return { headline: '벤처는 연구개발 기업 유형부터 보세요', items: [{ title: '연구개발비 비율 확인', tag: '확인', detail: '매출 대비 비율이 기준을 넘는지' }], next: ['재무제표 3년 받기'], caution: '최종 기준은 공식 공고로 확인' }
  return { headline: '답', items: [], next: [], caution: '' }
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
    llm.push({ sys, user: String(body.contents?.[0]?.parts?.[0]?.text ?? '') })
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answerFor(sys)) }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1800, candidatesTokenCount: 200 } }), { status: 200 })
  }
  if (/\/models(\?|$)/.test(url)) return new Response(JSON.stringify({ models: [], data: [] }), { status: 200 })
  return realFetch(input, init)
}

const sentBodies = []
async function wire(page) {
  await page.route('**/api/ai-assist**', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (req.method() === 'POST') sentBodies.push(req.postData() ?? '')
    const res = { statusCode: 200, headers: {}, raw: '', setHeader(k, v) { this.headers[k] = v }, end(b) { this.raw = b ?? '' } }
    await handler({ method: req.method(), url: u.pathname + u.search, headers: { authorization: OWNER }, body: req.postData() ?? undefined }, res)
    await route.fulfill({ status: res.statusCode, headers: { 'content-type': 'application/json' }, body: res.raw })
  })
}

const CLIENT = 'cli_hansol'
/** 처음 쓰는 사람처럼 — 시드의 '화면만' · 닫아 둔 기억을 지운다(오른쪽 대화창이 저절로 열리는 길을 본다) */
const fresh = (page) =>
  page.evaluate(() => {
    localStorage.removeItem('axmvp.chatfirst.v1')
    localStorage.removeItem('axmvp.ui.page_chat')
    localStorage.removeItem('axmvp.ui.side_dock')
  })
/** 오른쪽 판 — 그려져 있는지 · 어느 대화창인지 */
const dockOf = (page) =>
  page.evaluate(() => {
    const d = document.querySelector('[data-testid="side-dock"]')
    return d ? { on: true, chat: d.getAttribute('data-page-chat'), mode: d.getAttribute('data-mode') } : { on: false }
  })
/** 보이는 글자 수(빈칸 · 화면 읽기 전용 글 빼고) */
const visibleChars = (page, sel) =>
  page.evaluate((q) => {
    const root = document.querySelector(q)
    if (!root) return -1
    let n = 0
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let t
    while ((t = w.nextNode())) {
      const x = t.textContent.replace(/\s+/g, '')
      const el = t.parentElement
      if (!x || !el || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) || el.closest('[aria-hidden="true"],.sr-only')) continue
      const r = document.createRange()
      r.selectNodeContents(t)
      if ([...r.getClientRects()].some((c) => c.width > 1 && c.height > 1)) n += x.length
    }
    return n
  }, sel)
/**
 * D-636 화면을 옮기는 사이 오른쪽 판이 잠깐이라도 사라지거나 비는지 — 누르기 전에 건다(watchDock).
 * 50ms 마다 + DOM 이 바뀔 때마다 + 그려지는 판(rAF)마다 적는다. dockGaps 는 옮긴 뒤 ms 동안 더 지켜본 다음 적은 것을 돌려준다.
 */
const watchDock = (page) =>
  page.evaluate(() => {
    const w = (window.__dockWatch = { t0: performance.now(), polls: 0, gone: [], empty: [], stop: null })
    const rec = (src) => {
      const t = Math.round(performance.now() - w.t0)
      if (src === 'poll') w.polls++
      const d = document.querySelector('[data-testid="side-dock"]')
      // 판 안의 대화창 자리(slot) → 화면이 그려 보낸 칸(host) → 그 안의 대화창
      if (!d) w.gone.push(`${src}@${t}`)
      else if (!(d.querySelector('[data-testid="page-chat-slot"]')?.firstElementChild?.childElementCount > 0)) w.empty.push(`${src}@${t}`)
    }
    const mo = new MutationObserver(() => rec('dom'))
    mo.observe(document.body, { childList: true, subtree: true })
    const iv = setInterval(() => rec('poll'), 50)
    let raf = requestAnimationFrame(function frame() {
      rec('frame')
      raf = requestAnimationFrame(frame)
    })
    w.stop = () => {
      mo.disconnect()
      clearInterval(iv)
      cancelAnimationFrame(raf)
    }
  })
const dockGaps = async (page, ms = 2000) => {
  await page.waitForTimeout(ms)
  return page.evaluate(() => {
    const w = window.__dockWatch
    w.stop()
    return { polls: w.polls, gone: w.gone.slice(0, 8), goneN: w.gone.length, empty: w.empty.slice(0, 8), emptyN: w.empty.length }
  })
}
const noGap = (g) => g.polls >= 30 && g.goneN === 0 && g.emptyN === 0
const turns = (page) => page.getByTestId('chat-turn').count()
const lastAnswer = (page) => page.getByTestId('chat-answer').last()
const toastText = async (page) => {
  const t = page.getByTestId('toast-stack')
  await t.waitFor({ timeout: 4000 })
  return t.innerText()
}
const waitTurns = async (page, n) => {
  await page.waitForFunction((k) => document.querySelectorAll('[data-testid="chat-turn"]').length >= k, n, { timeout: 8000 })
  await page.waitForTimeout(150)
}
const ask = async (page, text) => {
  const before = await turns(page)
  await page.getByTestId('chat-input').last().fill(text)
  await page.getByTestId('chat-input').last().press('Enter')
  await waitTurns(page, before + 1)
  await page.waitForFunction(() => !document.querySelector('[data-testid="chat-turn"][data-status="pending"]'), null, { timeout: 10000 })
  await page.waitForTimeout(150)
}

setEnv()
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const errors = []

/* ================= A 특허 · 벤처 (PC 1440) ================= */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`pv: ${e}`))
  await wire(page)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await fresh(page)

  await page.goto(BASE + '/patent-venture', { waitUntil: 'networkidle' })
  await page.getByTestId('pv-chat-page').waitFor()
  // D-628 가운데 = 작업 화면(머리 · 회사 고르기 · 다섯 단계) · 대화창은 오른쪽 판에 저절로(시작 카드)
  await page.getByTestId('side-dock').waitFor({ timeout: 8000 }).catch(() => {})
  const dock0 = await dockOf(page)
  const card = page.getByTestId('chat-start-card')
  const cardText = await card.innerText().catch(() => '')
  const startChars = await visibleChars(page, '[data-testid="side-dock"]')
  check(`A0 가운데 = 작업 화면(대화창 없음 · 회사 칸 · 다섯 단계) · 오른쪽 판 저절로 · 시작 카드(무엇을 도와드릴까요? · [대화 시작]) ${startChars}자 ≤ 60`, (await page.locator('main [data-testid="chat-hero"], main [data-testid="chat-input"]').count()) === 0 && (await page.locator('main [data-testid="page-client"]').count()) === 1 && (await page.locator('main [data-testid="pv-steps"]').count()) === 1 && dock0.on && dock0.chat === 'pv' && dock0.mode === 'dock' && /무엇을 도와드릴까요/.test(cardText) && /대화 시작/.test(cardText) && startChars > 0 && startChars <= 60, { dock0, cardText, startChars })
  await shot(page, 'pv-start-pc')
  await page.getByTestId('chat-start').click()
  const hero = page.getByTestId('chat-hero')
  await hero.waitFor()
  const starters = await hero.getByTestId('chat-starter').allInnerTexts()
  check('A1 [대화 시작] → 무엇을 도와드릴까요? · 질문창(커서) · 큰 단추 4(어디까지 · 쓰기 · 점검 · 사업계획서)', (await hero.count()) === 1 && /무엇을 도와드릴까요/.test(await hero.innerText()) && starters.length === 4 && /어디까지/.test(starters[0]) && /사업계획서/.test(starters[3]) && (await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))) === 'chat-input', starters)
  check('A2 제목 하나(특허 · 벤처) · 가운데 [자세히] · 대화창 [사용 방법] · 회사 칸(대화창 1 · 가운데 1)', (await page.locator('h1:visible').allInnerTexts()).join('|') === '특허 · 벤처' && (await page.getByTestId('chat-guide-open').count()) === 1 && (await page.locator('main [data-testid="chat-detail"]').getAttribute('href')) === '/patent-venture/more' && (await page.locator('[data-testid="side-dock"] [data-testid="chat-client"]').count()) === 1, await page.locator('h1:visible').allInnerTexts())
  check('A3 대표 화면: 보내기 단추 = AI에게 묻기(보라) · AI 연결됨 안내', (await page.getByTestId('chat-send').getAttribute('data-ai')) === '1' && /AI 연결됨/.test(await page.getByTestId('chat-mode').innerText()))
  const words = await visibleChars(page, '[data-testid="pv-chat-page"]')
  check(`A4 가운데 첫 화면 글자 수 ${words}자 — 200자 이하(D-627 한도)`, words > 0 && words <= 200, words)
  await shot(page, 'pv-hero-pc')

  // 사용 방법
  await page.getByTestId('chat-guide-open').click()
  const guide = page.getByTestId('chat-guide')
  await guide.waitFor()
  const steps = await guide.locator('li').count()
  check('A5 [사용 방법] 8단계(회사 고르기 → 단추 → 그냥 물어보기 → 답 아래 단추 → 순서 → 견본 → 자세히 → 알아 둘 것)', steps === 8 && /견본/.test(await guide.innerText()), steps)
  await shot(page, 'pv-guide-pc')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('A6 Esc → 사용 방법 닫힘', (await page.getByTestId('chat-guide').count()) === 0)

  // 자세히 → 예전 화면 → 대화창으로
  await watchDock(page)
  await page.locator('main [data-testid="chat-detail"]').click()
  await page.getByTestId('pv-home').waitFor()
  check('A7 가운데 [자세히] → 예전 진행판(빈 화면 안내 · 도구 카드 그대로)', page.url().endsWith('/patent-venture/more') && (await page.getByTestId('pv-empty').count()) === 1 && (await page.locator('[data-testid^="pv-card-"]').count()) >= 3, await page.locator('[data-testid^="pv-card-"]').count())
  const gapMore = await dockGaps(page)
  check(`A7a D-636 [자세히] 로 옮기는 2초 동안 오른쪽 판이 한 번도 사라지거나 비지 않음(50ms 마다 ${gapMore.polls}번 · 바뀔 때마다 · 그려질 때마다)`, noGap(gapMore), gapMore)
  await watchDock(page)
  await page.getByTestId('pv-back-chat').click()
  await page.getByTestId('pv-chat-page').waitFor()
  await page.getByTestId('chat-hero').waitFor({ timeout: 6000 }).catch(() => {})
  check('A8 [대화창으로] → 특허 · 벤처 첫 화면 · 오른쪽 대화창이 열린 채(질문칸 그대로)', new URL(page.url()).pathname === '/patent-venture' && (await dockOf(page)).chat === 'pv' && (await page.getByTestId('chat-hero').count()) === 1)
  const gapBack = await dockGaps(page)
  check(`A8a D-636 [대화창으로] 돌아오는 2초 동안도 판이 그대로(50ms 마다 ${gapBack.polls}번)`, noGap(gapBack), gapBack)

  // 회사 고르기
  await page.getByTestId('chat-client').selectOption(CLIENT)
  await page.waitForURL(/client=cli_hansol/)
  await page.waitForTimeout(300)
  check('A9 대화창에서 회사 고르기 → 주소 ?client= · 그 회사 처음 화면 · 가운데 회사 칸도 같은 회사 · 준비 현황', (await page.getByTestId('chat-hero').count()) === 1 && (await page.getByTestId('page-client').inputValue()) === CLIENT && (await page.locator('main [data-testid="pv-brief"]').count()) === 1)

  // 단추 → 바로 답
  const llm0 = llm.length
  await page.getByTestId('chat-hero').getByTestId('chat-starter').first().click()
  await waitTurns(page, 1)
  let a = lastAnswer(page)
  check('A10 [지금 어디까지 했나요?] → 바로 답(AI 안 부름) · 시작 전 · [새 명세서 쓰기][견본으로 연습]', (await a.getAttribute('data-source')) === 'rule' && (await a.getAttribute('data-topic')) === 'status' && llm.length === llm0 && (await a.getByTestId('chat-action').count()) === 2, await a.innerText())
  check('A11 질문 · 답이 쌓이면 질문창은 판 맨 아래(단추 줄 · 질문창) · 큰 단추 칸은 사라짐', (await page.getByTestId('chat-dock').getByTestId('chat-starter').count()) === 4 && (await page.getByTestId('chat-dock').getByTestId('chat-input').count()) === 1 && (await page.getByTestId('chat-hero').count()) === 0)
  check('A12 바로 답 아래 [AI로 더 자세히](대표)', (await a.getByTestId('chat-ai-more').count()) === 1)
  await shot(page, 'pv-turn1-pc')

  // 견본으로 연습 → 명세서 쓰기 → 돌아오기
  // D-636 넘어가는 사이 오른쪽 판이 사라지면 안 된다(예전에는 '불러오는 중…' 동안 0.3~1초 사라졌다가 같은 대화로 다시 떴다)
  await watchDock(page)
  await a.locator('[data-testid="chat-action"][data-id="sample"]').click()
  await page.waitForURL(/\/patent-venture\/write\?/)
  const writeUrl = new URL(page.url())
  check('A13 [견본으로 연습] → 명세서 쓰기(그 회사 · 1단계)', writeUrl.searchParams.get('client') === CLIENT && writeUrl.searchParams.get('step') === 'idea' && !!writeUrl.searchParams.get('draft'), page.url())
  const gapWrite = await dockGaps(page)
  check(`A13a D-636 명세서 쓰기로 넘어가는 2초 동안 오른쪽 판이 한 번도 사라지거나 비지 않음(50ms 마다 ${gapWrite.polls}번 · 바뀔 때마다 · 그려질 때마다)`, noGap(gapWrite), gapWrite)
  // D-628 답 단추로 다른 특허 · 벤처 화면에 가도 오른쪽 판은 열린 채 같은 대화
  check('A13b 명세서 쓰기 화면에서도 오른쪽 판이 열린 채 대화 그대로(1개) · 그 화면에 여는 단추는 따로 없음', (await dockOf(page)).chat === 'pv' && (await turns(page)) === 1 && (await page.getByTestId('page-chat-launch').count()) === 0, await dockOf(page))
  await shot(page, 'pv-write-pc')
  const draftId = writeUrl.searchParams.get('draft')
  await page.goto(`${BASE}/patent-venture?client=${CLIENT}`, { waitUntil: 'networkidle' })
  await page.getByTestId('chat-turns').waitFor()
  check('A14 돌아오면 오른쪽 판에 대화 그대로(1개 · 시작 카드 없이)', (await turns(page)) === 1 && (await page.getByTestId('chat-start-card').count()) === 0 && (await dockOf(page)).chat === 'pv')
  await page.getByTestId('chat-dock').locator('[data-testid="chat-starter"][data-id="write"]').click()
  await waitTurns(page, 2)
  a = lastAnswer(page)
  const open = a.locator('[data-testid="chat-action"][data-id="open"]')
  check('A15 [특허 명세서 쓰기] → 견본 n/6단계 · [이어서 쓰기] 그 초안으로', /단계/.test(await a.getByTestId('chat-answer-title').innerText()) && ((await open.getAttribute('href')) ?? '').includes(`draft=${draftId}`), await a.innerText())

  // 쓴 질문 → AI
  const llm1 = llm.length
  await ask(page, '이 회사 명세서 다음에 뭐 해야 돼?')
  a = lastAnswer(page)
  const aiText = await a.innerText()
  check('A16 쓴 질문 → AI 답(✨ AI 답 · 모델 이름 · 제목 · 다음)', (await a.getAttribute('data-source')) === 'ai' && /AI 답/.test(aiText) && /청구항부터/.test(aiText) && (await a.getByTestId('chat-answer-next').count()) === 1 && llm.length === llm1 + 1, aiText)
  check('A17 AI 는 특허 · 벤처 대화 질문(pv.chat)으로 · 화면 page=patent', llm.at(-1).sys.includes('(pv.chat') && JSON.parse(sentBodies.at(-1)).page === 'patent', JSON.parse(sentBodies.at(-1) || '{}').page)
  check('A18 AI 답 아래에도 작업 단추(질문 주제 = 진행 → [이어서 …])', (await a.getByTestId('chat-action').count()) >= 1, await a.getByTestId('chat-action').allInnerTexts())
  const userSent = llm.at(-1).user
  check('A19 AI 에 간 자료: 견본 명칭 · 구성요소 이름은 가고 발명 본문(아이디어 문장)은 안 감', userSent.includes('공구 진동정보') && !userSent.includes('작업자의 감으로') && !userSent.includes(G_KEY), userSent.slice(0, 300))
  await shot(page, 'pv-ai-pc')

  // AI로 더 자세히
  const firstRule = page.getByTestId('chat-answer').first()
  { const l289 = firstRule.getByTestId('chat-ai-more'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await waitTurns(page, 4)
  await page.waitForFunction(() => !document.querySelector('[data-testid="chat-turn"][data-status="pending"]'), null, { timeout: 10000 })
  check('A20 [AI로 더 자세히] → 같은 질문을 AI 로 다시(질문 끝에 표시)', /AI로 더 자세히/.test(await page.getByTestId('chat-q').last().innerText()) && (await lastAnswer(page).getAttribute('data-source')) === 'ai')

  // AI 실패 → 정해진 답
  setEnv({ GEMINI_API_KEY: undefined })
  await ask(page, '벤처 사업계획서 어떻게 써?')
  a = lastAnswer(page)
  const err = await page.getByTestId('chat-error').last().innerText()
  check('A21 AI 실패 → 알림(정해진 답) + 정해진 답 카드(사업계획서)', /정해진 답/.test(err) && (await a.getAttribute('data-source')) === 'rule' && (await a.getAttribute('data-topic')) === 'plan', err)
  setEnv()

  // 파일 점검
  const md = '# 공구 마모 판정 시스템\n\n【발명의 명칭】\n공구 진동정보 기반 마모상태 판정 시스템\n\n【청구범위】\n【청구항 1】\n진동 센서부; 및 판정부를 포함하는 시스템.\n'
  await page.getByTestId('chat-file-input').setInputFiles({ name: 'tool-wear.md', mimeType: 'text/markdown', buffer: Buffer.from(md, 'utf8') })
  await waitTurns(page, 6)
  a = lastAnswer(page)
  check('A22 📎 명세서 파일 → 점검 답(고칠 것 · 확인할 것) · [점검 화면에서 자세히]', /📎 tool-wear\.md/.test(await page.getByTestId('chat-q').last().innerText()) && (await a.getAttribute('data-topic')) === 'check' && /고칠 것|확인할 것/.test(await a.getByTestId('chat-answer-title').innerText()), await a.innerText())

  // 복사
  await a.getByTestId('chat-copy').click()
  check('A23 답 복사 → 알림', /답 복사했어요/.test(await toastText(page)))

  // 회사 바꾸기 → 그 회사 대화
  const n = await turns(page)
  await page.getByTestId('chat-client').selectOption('')
  await page.waitForTimeout(400)
  check('A24 회사 바꾸면(전체) 그 쪽 대화 — 처음 화면', (await page.getByTestId('chat-hero').count()) === 1)
  await page.getByTestId('chat-client').selectOption(CLIENT)
  await page.waitForTimeout(400)
  check('A25 다시 그 회사 → 대화 그대로', (await turns(page)) === n, { n, now: await turns(page) })

  // 지우기 → 되돌리기
  await page.getByTestId('chat-clear').click()
  await page.waitForTimeout(250)
  check('A26 대화 지우기 → 처음 화면', (await page.getByTestId('chat-hero').count()) === 1)
  await page.getByTestId('toast-stack').getByTestId('toast-action').last().click()
  await page.waitForTimeout(300)
  check('A27 [되돌리기] → 대화 되살아남', (await turns(page)) === n)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('chat-turns').waitFor()
  check('A28 새로고침해도 대화 그대로', (await turns(page)) === n)
  await shot(page, 'pv-turns-pc', true)
  await ctx.close()
}

/* ================= B 기업인증 (PC 1440) ================= */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`cert: ${e}`))
  await wire(page)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await fresh(page)

  // 회사 없음
  await page.goto(BASE + '/tools/cert-os', { waitUntil: 'networkidle' })
  await page.getByTestId('cert-pick-client').waitFor()
  await page.getByTestId('side-dock').waitFor({ timeout: 8000 }).catch(() => {})
  const certStart = await visibleChars(page, '[data-testid="side-dock"]')
  const certCenter = await visibleChars(page, 'main')
  check(`B0 가운데 = 업체 고르기(인증 한눈에) · 대화창은 오른쪽 판에 저절로 · 시작 카드 ${certStart}자 ≤ 60`, (await page.locator('main [data-testid="chat-hero"], main [data-testid="chat-input"]').count()) === 0 && (await dockOf(page)).chat === 'cert' && (await page.getByTestId('chat-start-card').count()) === 1 && certStart > 0 && certStart <= 60, { certStart, dock: await dockOf(page) })
  await shot(page, 'cert-start-pc')
  await openChat(page)
  check('B1 회사 없이: [대화 시작] → 대화창 · 회사 칸 "회사 고르기" · 목차는 [목차] 단추 안(펼친 목차 없음)', (await page.getByTestId('chat-hero').count()) === 1 && /회사 고르기/.test(await page.getByTestId('chat-client').locator('option').first().innerText()) && (await page.locator('[data-section]:visible').count()) === 0)
  await page.getByTestId('chat-starter').first().click()
  await waitTurns(page, 1)
  let a = lastAnswer(page)
  check('B2 회사 없이 단추 → "어느 회사?" + [회사 고르기]', /회사/.test(await a.getByTestId('chat-answer-title').innerText()) && (await a.locator('[data-testid="chat-action"][data-id="pick"]').count()) === 1)
  await a.locator('[data-testid="chat-action"][data-id="pick"]').click()
  await page.waitForTimeout(400)
  check('B3 [회사 고르기] → 회사 칸에 초점', await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'chat-client'))
  await page.getByTestId('chat-client').selectOption(CLIENT)
  await page.waitForURL(/client=cli_hansol/)
  await page.waitForTimeout(500)
  await page.getByTestId('cert-hero').first().waitFor({ timeout: 8000 }).catch(() => {})
  check('B4 회사 고르면 → 주소 ?client= · 대화창은 그 회사 처음 화면 · 가운데는 그 회사 인증 한눈에(제목 하나)', (await page.getByTestId('chat-hero').count()) === 1 && (await page.locator('h1:visible').count()) === 1 && /한솔.*기업인증/.test(await page.locator('h1:visible').first().innerText()) && (await page.locator('main [data-testid="cert-hero"]').count()) >= 1, await page.locator('h1:visible').allInnerTexts())
  check(`B5 회사 고르기 전 가운데 첫 화면 글자 수 ${certCenter}자 — 200자 이하`, certCenter > 0 && certCenter <= 200, certCenter)
  await shot(page, 'cert-hero-pc')

  // 단추 4
  const dock = () => page.locator('[data-testid="chat-starter"]')
  await dock().nth(0).click()
  await waitTurns(page, 1)
  a = lastAnswer(page)
  check('B6 [받을 수 있는 인증] → 인증별 판정 줄 · [전체 판정 보기] 또는 (판정 못 함이면) [확인 질문에 답하기]', (await a.getAttribute('data-topic')) === 'can' && (await a.getByTestId('chat-answer-lines').locator('li').count()) >= 4 && (await a.locator('[data-testid="chat-action"][data-id="all"], [data-testid="chat-action"][data-id="ask"]').count()) === 1, await a.innerText())
  /** 눌러서 대화 한 줄 늘 때까지 */
  const tapNew = async (loc) => {
    const n0 = await turns(page)
    await loc.click()
    await waitTurns(page, n0 + 1)
    return lastAnswer(page)
  }
  const chip = (ans) => ans.locator('[data-testid="chat-action"][data-id^="ask-"]').first()
  a = await tapNew(page.getByTestId('chat-dock').locator('[data-testid="chat-starter"][data-id="docs"]'))
  check('B7 [빠진 서류] → 서류 답', (await a.getAttribute('data-topic')) === 'docs', await a.innerText())
  if (await chip(a).count()) {
    // 1순위가 없으면 인증을 고르는 칩 → 그 인증 서류
    const label = (await chip(a).innerText()).replace(/\s*서류$/, '').trim()
    a = await tapNew(chip(a))
    check(`B7b 1순위 없음 → [${label} 서류] 칩 → 그 인증 서류 답(AI 안 부름)`, (await a.getAttribute('data-topic')) === 'docs' && (await a.getAttribute('data-source')) === 'rule' && (await a.getByTestId('chat-answer-title').innerText()).includes(label), await a.innerText())
  }
  a = await tapNew(page.getByTestId('chat-dock').locator('[data-testid="chat-starter"][data-id="next"]'))
  check('B8 [다음에 할 일] → 순서 답(정보 모자라면 [확인 질문에 답하기])', (await a.getAttribute('data-topic')) === 'next' && (await a.getByTestId('chat-action').count()) >= 1, await a.innerText())
  a = await tapNew(page.getByTestId('chat-dock').locator('[data-testid="chat-starter"][data-id="explain"]'))
  if (await chip(a).count()) a = await tapNew(chip(a))
  const kakao = a.locator('[data-testid="chat-action"][data-id="kakao"]')
  await kakao.click()
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  check('B9 [대표님께 보낼 설명](→ 인증 칩) → [카톡 문구 복사] → 클립보드에 회사 이름', /카톡 문구 복사했어요/.test(await toastText(page)) && clip.includes('한솔'), clip.slice(0, 120))

  // 쓴 질문 → AI
  const llm0 = llm.length
  await ask(page, '이 회사 벤처 받을 수 있어?')
  a = lastAnswer(page)
  check('B10 쓴 질문 → AI 답(cert.chat · page=cert) + [벤처 자세히]', (await a.getAttribute('data-source')) === 'ai' && llm.length === llm0 + 1 && llm.at(-1).sys.includes('(cert.chat') && JSON.parse(sentBodies.at(-1)).page === 'cert' && (await a.locator('[data-testid="chat-action"][data-id="open"]').count()) === 1, await a.innerText())
  check('B11 AI 에 간 자료: OS 규칙 판정 · 회사 이름 · 키 노출 없음', llm.at(-1).user.includes('인증 판정') && llm.at(-1).user.includes('한솔') && !llm.at(-1).user.includes(G_KEY))
  await shot(page, 'cert-ai-pc')

  // 벤처 자세히 → 그 인증 화면(목차 있음)
  await a.locator('[data-testid="chat-action"][data-id="open"]').click()
  await page.waitForURL(/\/tools\/cert-os\/venture/)
  await page.waitForTimeout(500)
  const turnsAtVenture = await turns(page)
  check('B12 [벤처 자세히] → 가운데가 벤처 화면(목차 그대로 — [목차] 서랍) · 오른쪽 판은 열린 채 대화 그대로', (await navCount(page)) >= 5 && (await dockOf(page)).chat === 'cert' && turnsAtVenture >= 5, { turnsAtVenture, dock: await dockOf(page) })
  await page.goBack({ waitUntil: 'networkidle' })
  await page.getByTestId('cert-page').waitFor()

  // 전체 판정 보기 → 예전 인증 한눈에
  await page.getByTestId('chat-answer').first().locator('[data-testid="chat-action"][data-id="all"], [data-testid="chat-action"][data-id="ask"]').click()
  await page.waitForURL(/detail=1/)
  await page.getByTestId('cert-hero').first().waitFor()
  check('B13 [전체 판정 보기 · 확인 질문에 답하기] → 예전 "인증 한눈에"(1순위 · 목차 그대로 — [목차] 서랍)', (await page.getByTestId('cert-hero').count()) >= 1 && (await navCount(page)) >= 5)
  await page.goto(`${BASE}/tools/cert-os?client=${CLIENT}`, { waitUntil: 'networkidle' })
  await page.getByTestId('cert-hero').first().waitFor()
  await page.getByTestId('chat-turns').waitFor({ timeout: 8000 }).catch(() => {})
  check('B14 맨 첫 주소의 가운데가 곧 같은 화면(인증 한눈에 — 예전 [자세히]) · 오른쪽 판에 대화 그대로', (await page.locator('main [data-testid="cert-hero"]').count()) >= 1 && (await dockOf(page)).chat === 'cert' && (await turns(page)) >= 4)
  const navFirst = await navHref(page, 'overview')
  // ?detail=1 주소에서는 저절로 열지 않는다 — 오른쪽 끝 [대화] 로 그 회사 대화를 연다(예전 [대화창으로])
  await page.goto(`${BASE}/tools/cert-os?client=${CLIENT}&detail=1`, { waitUntil: 'networkidle' })
  await page.getByTestId('cert-hero').first().waitFor()
  await page.waitForTimeout(600)
  const quiet = !(await dockOf(page)).on
  const pill = await page.getByTestId('page-chat-launch').count()
  check("B14b 목차 '인증 한눈에'는 ?detail=1 그대로 · 그 주소에서는 판이 저절로 안 열림 · 오른쪽 끝 [대화] 있음", (navFirst ?? '').includes('detail=1') && quiet && pill === 1, { navFirst, quiet, pill })
  await page.getByTestId('page-chat-launch').click()
  await page.getByTestId('chat-turns').waitFor({ timeout: 6000 }).catch(() => {})
  check('B14c [대화] → 그 회사 대화창 · 대화 그대로(주소 그대로)', page.url().includes(`client=${CLIENT}`) && (await dockOf(page)).chat === 'cert' && (await turns(page)) >= 4)
  await page.goto(`${BASE}/tools/cert-os?client=${CLIENT}`, { waitUntil: 'networkidle' })
  await page.getByTestId('chat-guide-open').waitFor()
  await page.getByTestId('chat-guide-open').click()
  check('B15 [사용 방법] 7단계', (await page.getByTestId('chat-guide').locator('li').count()) === 7)
  await page.keyboard.press('Escape')
  await shot(page, 'cert-turns-pc', true)
  await ctx.close()
}

/* ================= C 휴대폰 ================= */
const PHONE_DETECT = `(() => {
  const wide = []
  for (const el of document.querySelectorAll('[data-testid^="chat"] *, [data-testid^="chat"]')) {
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    const cs = getComputedStyle(el)
    if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.textOverflow === 'ellipsis') continue
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()
    if (own && cs.whiteSpace === 'nowrap' && el.scrollWidth > el.clientWidth + 2) wide.push(own.slice(0, 16) + ' ' + el.clientWidth + '<' + el.scrollWidth)
  }
  return wide.slice(0, 5)
})()`
for (const [w, scale] of [[360, ''], [390, ''], [430, ''], [360, 'extra_large']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${w}${scale}: ${e}`))
  await wire(page)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const tag = `${w}${scale ? '-xl' : ''}`
  for (const [mod, url, testid] of [['pv', `/patent-venture?client=${CLIENT}`, 'pv-chat-page'], ['cert', `/tools/cert-os?client=${CLIENT}`, 'cert-page']]) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' })
    if (scale) await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
    await page.getByTestId(testid).waitFor()
    await page.waitForTimeout(300)
    // D-628 휴대폰 — 가운데는 작업 화면 · 둥근 [대화](44px 이상 · 아래 메뉴 위) → 아래 판
    const centerOx = await overflowX(page)
    const fab = await page.getByTestId('page-chat-launch').evaluate((el) => {
      const r = el.getBoundingClientRect()
      const nav = [...document.querySelectorAll('nav')].map((n) => n.getBoundingClientRect()).filter((q) => q.bottom >= window.innerHeight - 2 && q.top > window.innerHeight / 2)[0]
      return { w: Math.round(r.width), h: Math.round(r.height), aboveNav: nav ? r.bottom <= nav.top + 1 : true }
    })
    check(`C ${tag} ${mod} 가운데: 작업 화면(대화창 없음) · 가로 넘침 0 · 둥근 [대화] 44px 이상 · 아래 메뉴 위`, centerOx <= 1 && (await page.locator('main [data-testid="chat-input"]').count()) === 0 && fab.w >= 44 && fab.h >= 44 && fab.aboveNav, { centerOx, fab })
    await shot(page, `${mod}-screen-${tag}`)
    await openChat(page)
    await page.waitForTimeout(450)
    const heroOx = await overflowX(page)
    const sel = await page.getByTestId('chat-client').boundingBox()
    check(`C ${tag} ${mod} 처음: 가로 넘침 0 · 회사 칸 넓게(화면 폭 70% 이상)`, heroOx <= 1 && sel && sel.width >= w * 0.7, { heroOx, sel: sel?.width })
    await shot(page, `${mod}-hero-${tag}`)
    // 단추 둘 → 대화
    await page.getByTestId('chat-hero').getByTestId('chat-starter').nth(0).click()
    await waitTurns(page, 1)
    await page.getByTestId('chat-dock').getByTestId('chat-starter').nth(1).click()
    await waitTurns(page, 2)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(250)
    const geo = await page.evaluate(() => {
      const dock = document.querySelector('[data-testid="chat-dock"]').getBoundingClientRect()
      const inputEl = document.querySelector('[data-testid="chat-dock"] [data-testid="chat-input"]')
      const input = inputEl.getBoundingClientRect()
      // D-628 대화창은 아래 판 안 — 판이 아래 메뉴를 덮는다. 질문창이 화면 안에 있고 그 자리에 실제로 질문창이 보이는지(무엇에도 안 가림)를 본다
      const top = document.elementFromPoint(input.left + input.width / 2, input.top + input.height / 2)
      const chips = [...document.querySelectorAll('[data-testid="chat-dock"] [data-testid="chat-starter"]')].map((b) => b.getBoundingClientRect().top)
      return { dockH: dock.height, inputBottom: input.bottom, uncovered: top === inputEl, rows: new Set(chips.map((t) => Math.round(t))).size, vh: window.innerHeight }
    })
    const wide = await page.evaluate(PHONE_DETECT)
    const ox = await overflowX(page)
    check(`C ${tag} ${mod} 대화: 질문창이 화면 안 · 아래 메뉴 · 다른 것에 안 가림 · 단추 한 줄 · 아래 묶음 높이 화면의 ${Math.round((geo.dockH / geo.vh) * 100)}%(≤ 30%) · 넘침 0 · 칸보다 넓은 글 0`, geo.inputBottom <= geo.vh && geo.uncovered && geo.rows === 1 && geo.dockH <= geo.vh * 0.3 && ox <= 1 && wide.length === 0, { geo, ox, wide })
    await shot(page, `${mod}-turns-${tag}`)
  }
  await ctx.close()
}

/* ================= D ================= */
check(`D JS 오류 0`, errors.length === 0, errors.slice(0, 3))
check('D 공급자 키가 화면 · 요청 어디에도 없음', !sentBodies.some((b) => b.includes(G_KEY)))

await browser.close()
console.log(`\nqa:chat ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
