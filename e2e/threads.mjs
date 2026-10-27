/**
 * D-273 마케팅 · 브랜딩 › 스레드 — 실측 공식 글쓰기 · 규칙 검사 · 기록표 · 틀 23가지 · 하루 10분.
 * 브라우저 → /api/ai-assist 는 진짜 서버 함수(api/ai-assist.js)를 이 프로세스에서 부른다(qa:mkpack 과 같은 방식). 밖으로 나가는 것만 가짜.
 *
 *   N  목차 — 마케팅 목차에 [스레드] · 이 화면에서 켜짐 · 안쪽 칸 4개 · 다른 마케팅 칸으로 이동
 *   W  반응 → 맞는 틀(답글 = P 먼저) → 틀 뼈대 · 예시 글로 시작 → 글자 수 · 규칙 검사 고칠 것 0 · 태그 자동
 *      링크 · 상담 안내 · 500자 넘김 → 고칠 것 · 빈 틀로 시작 → [대괄호] 알림
 *   A  [AI로 글 3개 쓰기] → threads.write(스레드 규칙 · 스레드 공식 · 사실 목록 · 고른 틀 · 참고 글 줄) → 글 3개 · [이 글로 고치기] → 확인할 것 · 본인 댓글
 *   S  저장 → 쓰다 둔 글 · [올렸어요] → 기록표 · 숫자 적기 → 점수 · 틀별 평균 · 새로고침해도 남음 · V 같은 달 두 번 → 고칠 것 · 지우기는 한 번 더 묻기
 *   K  쓰던 글은 새로고침해도 남음(참고 글은 안 남음)
 *   L  틀 23가지 — 반응으로 거르기 · [이 틀로 쓰기] → 쓰기 칸에 그 틀
 *   R  하루 10분 — 체크가 오늘 동안 남음 · 태그 검색은 새 창 주소 · 전문가 답글 틀
 *   M  360 · 390 · 430 · 큰 글자 — 네 칸 모두 가로 넘침 0 · 안쪽 칸 44px · JS 오류 0
 */
import { chromium } from 'playwright'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import fs from 'node:fs'
import { seedScript } from './seed.mjs'

const fromRoot = (p) => import(pathToFileURL(path.resolve(p)).href)
const { default: handler, __resetAiAssistState } = await fromRoot('api/ai-assist.js')

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.THREADS_SHOTS ?? ''
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
  headline: '창업 3년 안 벤처확인 세금',
  items: [
    { title: '창업 3년 안 된 대표님,', tag: 'B', body: '창업 3년 안 된 대표님,\n세금 더 내고 계실 수 있어요.\n\n벤처기업확인을 창업 3년 안에 받으면\n요건 충족 시 법인세·소득세 5년간 50% 감면.\n\n(결과는 확인기관이 정하고, 회사마다 달라요)\n\n창업 몇 년 차예요? 1년 / 2년 / 3년', when: '고르기 쉬운 질문', detail: '3분 진단은 프로필 링크에서', outline: ['[한 해 이익 1억 계산 다시 확인]', '고지 괄호 확인'] },
    { title: '컨설턴트인 내 밥줄인데, 그냥 풀게.', tag: 'U', body: '컨설턴트인 내 밥줄인데, 그냥 풀게.\n\n1. 업종 제한\n2. 유형\n3. 기술 근거\n\n저장해 두고 1번부터 체크해 봐.', when: '그냥 끝', detail: '', outline: [] },
    { title: '벤처기업확인 준비가 막막한 대표님.', tag: 'P', body: '벤처기업확인 준비가 막막한 대표님.\n\n필요한 대표님은 댓글에 "점검표" 남겨 줘.\nDM으로 보내 줄게.\n\n(결과는 확인기관이 정하고, 회사마다 달라)', when: '자료 나눔', detail: '', outline: [] },
  ],
  next: ['주제 태그: 벤처기업확인', '오전에 올리기'],
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
const lintKeys = (p, level) => p.locator(`[data-testid="thr-lint"] li${level ? `[data-level="${level}"]` : ''}`).evaluateAll((xs) => xs.map((x) => x.getAttribute('data-key')))
const open = async (p, q = '') => {
  await p.goto(`${BASE}/marketing/threads${q}`, { waitUntil: 'networkidle' })
  await p.getByTestId('thr-page').waitFor({ timeout: 15000 })
  // MUX-2 반응 · 틀 · 태그 고르기는 '형식 직접 고르기' 안(접힘) — 이 시험은 그 안을 보므로 펼친다(펼친 상태는 기억됨)
  const fold = p.getByTestId('thr-choose')
  if ((await fold.count()) && (await fold.getAttribute('data-open')) === '0') await fold.getByTestId('fold-toggle').click()
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
await page.evaluate(() => {
  localStorage.removeItem('mirae.threads.draft.v1')
  localStorage.removeItem('mirae.threads.routine.v1')
})

/* ---------------- N 목차 ---------------- */
await open(page)
const mkThreads = page.getByTestId('mk-tab-threads')
check('N1 마케팅 목차에 [스레드] · 이 화면에서 켜짐(aria-current)', (await mkThreads.count()) === 1 && (await mkThreads.getAttribute('aria-current')) === 'page')
check('N2 안쪽 칸 4개(오늘 쓸 글 · 기록표 · 틀 23가지 · 하루 10분) · 처음은 쓰기', (await page.locator('[role="tab"][data-testid^="thr-tab-"]').count()) === 4 && (await page.getByTestId('thr-tab-write').getAttribute('aria-selected')) === 'true')
const crumbs = await page.locator('nav[aria-label*="경로"], [data-testid="breadcrumbs"]').first().innerText().catch(() => '')
check('N3 경로 줄 — 마케팅 · 브랜딩 › 스레드', !crumbs || /스레드/.test(crumbs), crumbs)
await shot(page, 'pc-write-empty', false)

/* ---------------- H D-298 마우스를 올리면 바로 설명 · 색 ---------------- */
// 대표 "기록표 · 틀 23가지 · 하루 10분 — 뭘 위한 칸인지 모르겠다 · 마우스를 올리자마자 어떤 작업을 하는 곳인지" · "T 닿아라 · 판 깔기 — 확 안 와닿는다"
const inView = (loc) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= document.documentElement.clientWidth && r.top >= 0 && r.bottom <= innerHeight })
await page.getByTestId('thr-tab-records').hover()
await page.waitForTimeout(150)
const tabTip = page.getByTestId('thr-tabtip')
check('H1 안쪽 칸 [기록표] 에 마우스 → 바로 "조회 · 좋아요 숫자를 적는 곳" · 화면 안', (await tabTip.count()) === 1 && /조회 · 좋아요/.test(await tabTip.innerText()) && (await inView(tabTip)))
for (const [k, re] of [['library', /글의 모양 23가지/], ['routine', /매일 10분/], ['write', /글을 써 주는 곳/]]) {
  await page.getByTestId(`thr-tab-${k}`).hover()
  await page.waitForTimeout(120)
  check(`H1 ${k} 칸에 마우스 → 무엇을 하는 곳인지`, re.test(await page.getByTestId('thr-tabtip').innerText().catch(() => '')))
}
await page.mouse.move(5, 700)
await page.waitForTimeout(120)
check('H2 마우스를 떼면 설명 닫힘 · 지금 칸 한 줄(휴대폰도 보임) "오늘 쓸 글 — 주제만 고르면"', (await page.getByTestId('thr-tabtip').count()) === 0 && /오늘 쓸 글 — 주제만 고르면/.test(await page.getByTestId('thr-about').innerText()))
const tabColors = await page.locator('[role="tab"][data-testid^="thr-tab-"] svg').evaluateAll((xs) => xs.map((x) => getComputedStyle(x).color))
check('H3 안쪽 칸 그림마다 다른 색(4색)', new Set(tabColors).size === 4, tabColors)
check('H4 "우리 분야 주제 · 늘 그대로예요" — 매주 바뀌는지 바로 앎', /늘 그대로예요/.test(await page.getByTestId('thr-qs-ours-label').innerText()))

/* ---------------- W 쓰기 ---------------- */
await page.getByTestId('thr-goal-follow').hover()
await page.waitForTimeout(150)
check('H5 원하는 반응 [팔로워 모으기] 에 마우스 → 쉬운 설명(팔로우)', /팔로우/.test(await page.getByTestId('hover-tip').innerText().catch(() => '')))
await page.getByTestId('thr-goal-reply').click()
await page.getByTestId('thr-tpl-T').hover()
await page.waitForTimeout(150)
const tplTip = page.getByTestId('thr-tpltip')
check('H6 틀 [T 닿아라] 에 마우스 → 무슨 뜻인지 + 예시(데려다줘) · 화면 안', /T 닿아라/.test(await tplTip.innerText().catch(() => '')) && /내 손님을 부르는 글/.test(await tplTip.innerText()) && /예시\n?[\s\S]*데려다줘/.test(await tplTip.innerText()) && (await inView(tplTip)))
await page.mouse.move(5, 700)
const goalBg = await page.locator('[data-testid^="thr-goal-"]').evaluateAll((xs) => xs.map((x) => getComputedStyle(x).borderColor))
check('H7 원하는 반응 4개 — 색이 모두 다름', new Set(goalBg).size === 4, goalBg)
const picks = await page.locator('[data-testid="thr-picks"] [data-testid^="thr-tpl-"]').evaluateAll((xs) => xs.map((x) => x.getAttribute('data-testid')))
check('W1 답글 · 문의 → 맞는 틀 6개 · P(자료 나눔 조건) 먼저', picks.length === 6 && picks[0] === 'thr-tpl-P', picks)
await page.getByTestId('thr-tpl-P').click()
const detail = await page.getByTestId('thr-tpl-detail').innerText()
check('H8 고른 틀 상자 맨 위 — 쉽게 말하면 · 예시(휴대폰도 여기서)', /쉽게 말하면/.test(await page.getByTestId('thr-tpl-plain').innerText()) && /예시/.test(await page.getByTestId('thr-tpl-sample').innerText()))
check('W2 틀 뼈대 · 왜 되나 · 우리가 쓰면 · 주의(자료를 실제로 만든 뒤에만)', /막막한 사람 부르기/.test(detail) && /왜 되나/.test(detail) && /우리가 쓰면/.test(detail) && /실제로 만든 뒤에만/.test(detail), detail)
await page.getByTestId('thr-use-example').click()
await page.waitForTimeout(200)
const body1 = await page.getByTestId('thr-body').inputValue()
check('W3 [예시 글로 시작] → 글 칸에 우리 버전 예시 · 글자 수 표시 · 태그 자동(벤처기업확인)', /점검표/.test(body1) && /\d+ \/ 500자/.test(await page.getByTestId('thr-count').innerText()) && (await page.getByTestId('thr-tag-벤처기업확인').getAttribute('aria-checked')) === 'true')
check('W4 예시 글 규칙 검사 — 고칠 것 0 · 끝: 자료 나눔 조건', (await lintKeys(page, 'bad')).length === 0 && /끝: 자료 나눔 조건/.test(await page.getByTestId('thr-lint').innerText()))
// D-274 나눠 줄 자료 — P 틀이면 체크리스트 카드 6장(그림이 실제로 받아짐)
const cardRes = await page.request.get(BASE + '/sns/venture-check-01.png')
check('W4b P 틀 → 나눠 줄 자료(체크리스트 카드 6장 · 그림 받아짐 · 모두 내려받기 단추)', (await page.getByTestId('thr-share-card').count()) === 6 && cardRes.ok() && /image\/png/.test(cardRes.headers()['content-type'] ?? '') && (await page.getByTestId('thr-share-all').count()) === 1)
await page.getByTestId('thr-facts-box').locator('summary').click()
check('W4c 사실 목록(이것만 씀)이 화면에 · 1,650만 원 · 100억+ 포함', (await page.locator('[data-testid="thr-kim-facts"] li').count()) >= 8 && /1,650만 원/.test(await page.getByTestId('thr-kim-facts').innerText()) && /100억\+/.test(await page.getByTestId('thr-kim-facts').innerText()))
await page.getByTestId('thr-body').fill('AX 는 큰 가점 요소예요, 대표님.\n합격률 30% 올리는 법\n쓸 사람?')
await page.waitForTimeout(150)
check('W4d 대표 운영 원칙 — "큰 가점" 고칠 것 · 사실 목록에 없는 숫자(30%) 알림', (await lintKeys(page, 'bad')).includes('gajeom') && (await lintKeys(page, 'warn')).includes('numbers') && /30%/.test(await page.getByTestId('thr-lint').innerText()))
await page.getByTestId('thr-facts').fill('합격률 30%')
await page.waitForTimeout(150)
check('W4e 더 쓸 사실에 적으면 숫자 알림이 사라짐', !(await lintKeys(page, 'warn')).includes('numbers'))
await page.getByTestId('thr-facts').fill('')
await shot(page, 'pc-write-example')
await page.getByTestId('thr-body').fill(body1 + '\n자세한 건 https://litt.ly/kimteamjang\n상담 신청은 프로필에서')
await page.waitForTimeout(150)
const bad1 = await lintKeys(page, 'bad')
check('W5 본문 링크 · 상담 안내 → 고칠 것(link · sell)', bad1.includes('link') && bad1.includes('sell'), bad1)
await page.getByTestId('thr-body').fill('가'.repeat(510))
await page.waitForTimeout(150)
check('W6 500자 넘김 → 고칠 것 · 글자 수 빨간색', (await lintKeys(page, 'bad')).includes('len') && /510 \/ 500자/.test(await page.getByTestId('thr-count').innerText()) && /danger/.test((await page.getByTestId('thr-count').getAttribute('class')) ?? ''))
await page.getByTestId('thr-use-skeleton').click()
await page.waitForTimeout(150)
check('W7 [빈 틀로 시작] → 뼈대 [대괄호] 칸 · 대괄호 알림', /\[막막한 사람 부르기\]/.test(await page.getByTestId('thr-body').inputValue()) && (await lintKeys(page, 'warn')).includes('brackets'))

/* ---------------- A AI 글 3개 ---------------- */
await page.getByTestId('thr-qs-topic').fill('창업 3년 안 벤처기업확인 세금')
await page.getByTestId('thr-ref-box').locator('summary').click()
await page.getByTestId('thr-ref').fill('남의 글 첫 줄입니다\n남의 글 둘째 줄')
{ const l289 = page.getByTestId('thr-qs-ai'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
await page.getByTestId('thr-ai-drafts').waitFor({ timeout: 20000 })
const call = llm.find((x) => x.sys.includes('(threads.write'))
check('A1 AI 글 3개 · 틀 표시 · 글자 수 · 고칠 것 수', (await page.getByTestId('thr-ai-draft').count()) === 3 && /B 손해 \+ 숫자/.test(await page.getByTestId('thr-ai-draft').first().innerText()))
check('A2 서버 지시 — 대표 운영 원칙(먼저) · 스레드 규칙 · 스레드 공식(틀 라이브러리) · 사실 목록 · 마케팅(유튜브) 규칙 없음', !!call && call.sys.includes('[대표 운영 원칙') && call.sys.indexOf('[대표 운영 원칙') < call.sys.indexOf('[스레드 규칙]') && /눈에 띄게 해 주는 좋은 자료/.test(call.sys) && call.sys.includes('[스레드 규칙]') && call.sys.includes('[기준 문서]') && /자료 나눔 조건/.test(call.sys) && /김팀장 사실 목록/.test(call.sys) && !call.sys.includes('[마케팅 규칙]'))
check('A3 보낸 자료 — 고른 틀 P · 소재 · 참고 글 줄 · 최근 올린 글 칸', !!call && /고른틀: P 자료 나눔 조건/.test(call.user) && /소재: 창업 3년 안 벤처기업확인 세금/.test(call.user) && /참고 글/.test(call.user) && /남의 글 첫 줄입니다/.test(call.user) && /최근 올린 글/.test(call.user), call?.user.slice(0, 500))
check('A4 열쇠 · 비밀 글자가 화면에 없음', !/SECRET/.test(await page.locator('body').innerText()))
await shot(page, 'pc-ai-drafts')
await page.getByTestId('thr-ai-use').first().click()
await page.waitForTimeout(200)
check('A5 [이 글로 고치기] → 글 칸 · 본인 댓글 · 확인할 것 · 틀 B 로', /세금 더 내고/.test(await page.getByTestId('thr-body').inputValue()) && (await page.getByTestId('thr-comment').inputValue()) === '3분 진단은 프로필 링크에서' && /이익 1억/.test(await page.getByTestId('thr-checks').innerText()) && (await page.getByTestId('thr-tpl-B').count()) <= 1)
check('A6 AI 글 규칙 검사 — 고칠 것 0 · 끝 고르기 쉬운 질문', (await lintKeys(page, 'bad')).length === 0 && /고르기 쉬운 질문/.test(await page.getByTestId('thr-lint').innerText()))

/* ---------------- S 저장 · 기록표 ---------------- */
await page.getByTestId('thr-save').click()
await page.waitForTimeout(400)
await page.getByTestId('thr-tab-records').click()
await page.getByTestId('thr-records').waitFor()
await page.locator('[data-testid="thr-rec-drafts"] [data-testid="thr-rec-item"]').first().waitFor({ timeout: 5000 }).catch(() => {})
check('S1 [저장] → 기록표의 쓰다 둔 글 1', (await page.locator('[data-testid="thr-rec-drafts"] [data-testid="thr-rec-item"]').count()) === 1)
await page.getByTestId('thr-rec-open').first().click()
check('S2 [열어서 고치기] → 쓰기 칸에 그 글', /세금 더 내고/.test(await page.getByTestId('thr-body').inputValue()))
await page.getByTestId('thr-posted').click()
await page.getByTestId('thr-records').waitFor()
await page.waitForTimeout(300)
const item = page.locator('[data-testid="thr-rec-list"] [data-testid="thr-rec-item"]').first()
check('S3 [올렸어요] → 기록표(올린 글 1 · 쓰다 둔 글 0 · 오늘 날짜 · 쓰기 칸 비움)', (await page.locator('[data-testid="thr-rec-list"] [data-testid="thr-rec-item"]').count()) === 1 && (await page.locator('[data-testid="thr-rec-drafts"]').count()) === 0 && /올림/.test(await item.innerText()))
for (const [k, v] of [['views', '2400'], ['likes', '9'], ['replies', '4'], ['reposts', '1'], ['shares', '7'], ['inquiries', '1']]) {
  await item.getByTestId(`thr-stat-${k}`).fill(v)
  await item.getByTestId(`thr-stat-${k}`).blur()
  await page.waitForTimeout(120)
}
await page.waitForTimeout(300)
check('S4 숫자 적기 → 점수 44(9 + 4×3 + 1×2 + 7×3) · 틀별 평균 B 44 · 문의 1', /점수 44/.test(await page.getByTestId('thr-rec-score').first().innerText()) && /평균 44/.test(await page.locator('[data-testid="thr-rec-template"][data-key="B"]').innerText()) && /문의 1/.test(await page.getByTestId('thr-rec-templates').innerText()))
await shot(page, 'pc-records')
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('thr-records').waitFor()
check('S5 새로고침해도 기록 · 숫자 남음', (await page.locator('[data-testid="thr-stat-likes"]').first().inputValue()) === '9' && /점수 44/.test(await page.getByTestId('thr-rec-score').first().innerText()))
await page.getByTestId('thr-tab-write').click()
check('S6 올린 뒤 쓰기 칸은 비어 있음', (await page.getByTestId('thr-body').inputValue()) === '')
// V 같은 달 두 번
await page.getByTestId('thr-goal-reply').click()
await page.getByTestId('thr-tpl-V').click()
await page.getByTestId('thr-use-example').click()
await page.waitForTimeout(150)
check('S7 V(대놓고 영업) 예시 — 판매 검사 빼고 고칠 것 0', (await lintKeys(page, 'bad')).length === 0)
await page.getByTestId('thr-posted').click()
await page.getByTestId('thr-records').waitFor()
await page.getByTestId('thr-tab-write').click()
await page.getByTestId('thr-goal-reply').click()
await page.getByTestId('thr-tpl-V').click()
await page.getByTestId('thr-use-example').click()
await page.waitForTimeout(150)
check('S8 같은 달 V 두 번째 → 고칠 것(한 달에 한 번)', (await lintKeys(page, 'bad')).includes('v-month'))
await page.getByTestId('thr-new').click()
await page.getByTestId('thr-tab-records').click()
// 칸을 바꾼 직후 세면 0 이 나올 수 있다(게이트에서 S9 · S10 이 흔들린 까닭) — 기록표 줄이 그려진 뒤에 센다
await page.getByTestId('thr-records').waitFor()
await page.locator('[data-testid="thr-rec-item"]').first().waitFor()
const before = await page.locator('[data-testid="thr-rec-item"]').count()
await page.getByTestId('thr-rec-del').first().click()
await page.getByTestId('thr-rec-del-confirm').waitFor({ timeout: 5000 }).catch(() => {})
check(`S9 지우기 → 한 번 더 묻기(아직 안 지워짐 · ${before}줄)`, before >= 2 && (await page.getByTestId('thr-rec-del-confirm').count()) === 1 && (await page.locator('[data-testid="thr-rec-item"]').count()) === before, before)
await page.getByTestId('thr-rec-del-yes').click()
await page.waitForFunction((n) => document.querySelectorAll('[data-testid="thr-rec-item"]').length === n, before - 1, { timeout: 5000 }).catch(() => {})
check('S10 [지우기] 확인 → 한 줄 줄어듦', (await page.locator('[data-testid="thr-rec-item"]').count()) === before - 1)

/* ---------------- K 쓰던 글 남기기 ---------------- */
await page.getByTestId('thr-tab-write').click()
await page.getByTestId('thr-body').fill('솔직히 말하면, 나도 처음엔 몰랐어.\n쓰다 만 글')
await page.getByTestId('thr-ref-box').locator('summary').click()
await page.getByTestId('thr-ref').fill('남의 글')
await page.waitForTimeout(150)
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('thr-write').waitFor()
check('K1 쓰던 글은 새로고침해도 남음 · 참고 글(남의 글)은 안 남음', /쓰다 만 글/.test(await page.getByTestId('thr-body').inputValue()) && (await page.getByTestId('thr-ref').inputValue()) === '')

/* ---------------- L 틀 23가지 ---------------- */
await page.getByTestId('thr-tab-library').click()
await page.getByTestId('thr-library').waitFor()
await page.waitForFunction(() => document.querySelectorAll('[data-testid="thr-lib-card"]').length === 24, null, { timeout: 5000 }).catch(() => {})
check('L1 틀 카드 24장(A~X) + 쓰지 않는 Z · 첫 줄 10가지 · 끝 방식', (await page.getByTestId('thr-lib-card').count()) === 24 && /남의 말 얹기/.test(await page.getByTestId('thr-library').innerText()) && (await page.locator('[data-testid="thr-first-lines"] li').count()) === 10 && (await page.locator('[data-testid="thr-endings"] li').count()) === 8)
await shot(page, 'pc-library', false)
await page.getByTestId('thr-lib-filter-share').click()
await page.waitForFunction(() => document.querySelectorAll('[data-testid="thr-lib-card"]').length === 7, null, { timeout: 5000 }).catch(() => {})
const shareKeys = await page.getByTestId('thr-lib-card').evaluateAll((xs) => xs.map((x) => x.getAttribute('data-key')).join(''))
check('L2 공유 · 저장으로 거르기 → B · E · H · M · O · Q · U', shareKeys === 'BEHMOQU', shareKeys)
await page.locator('[data-testid="thr-lib-card"][data-key="U"]').locator('xpath=ancestor::article').getByTestId('thr-lib-use').click()
await page.getByTestId('thr-write').waitFor()
check('L3 [이 틀로 쓰기] → 쓰기 칸 · U 밥줄 공개 골라짐', (await page.getByTestId('thr-tpl-detail').innerText()).includes('U 밥줄 공개'))
await page.getByTestId('thr-tab-library').click()
await page.getByTestId('thr-library').waitFor()
check('L4 이렇게 말고 → 이렇게 표(가점 · 성공 약속 · 숙제 …)', (await page.locator('[data-testid="thr-rewrites"] li').count()) >= 10 && /눈에 띄게 해 주는 좋은 자료/.test(await page.getByTestId('thr-rewrites').innerText()))
await page.getByTestId('thr-tab-write').click()
await page.getByTestId('thr-qs-topic').fill('창업 3년 안 벤처확인 세금')
await page.getByTestId('thr-to-shorts').click()
await page.getByTestId('sht-page').waitFor()
check('L5 [같은 소재로 릴스 · 틱톡] → 릴스 · 틱톡 화면 · 소재가 채워짐 · 주소의 소재는 지움', (await page.getByTestId('sht-qs-topic').inputValue()) === '창업 3년 안 벤처확인 세금' && !page.url().includes('topic='))
await page.goBack({ waitUntil: 'networkidle' }).catch(() => {})
await page.goto(BASE + '/marketing/threads', { waitUntil: 'networkidle' })
await page.getByTestId('thr-page').waitFor()

/* ---------------- R 하루 10분 ---------------- */
await page.getByTestId('thr-tab-routine').click()
await page.getByTestId('thr-routine').waitFor()
await page.getByTestId('thr-routine-weekref').check()
await page.waitForTimeout(100)
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('thr-routine').waitFor()
const href = await page.getByTestId('thr-search-link').first().getAttribute('href')
check('R1 체크가 오늘 동안 남음 · 태그 검색은 새 창 스레드 검색 주소 · 전문가 답글 틀', (await page.getByTestId('thr-routine-weekref').isChecked()) && /^https:\/\/www\.threads\.com\/search\?q=/.test(href ?? '') && (await page.getByTestId('thr-search-link').first().getAttribute('target')) === '_blank' && /현장에서 보면/.test(await page.getByTestId('thr-expert').innerText()))
// D-275 인기 글은 매일 모으지 않는다 — 월요일 한 번 '이번 주 잘 터진 형식'(원문 없이 틀 · 첫 줄 · 끝)만
check('R1b 할 일 — 매일 훑기 없음 · 월요일 이번 주 형식 · 금요일 기록표', (await page.getByTestId('thr-routine-scan').count()) === 0 && /월요일/.test(await page.getByTestId('thr-routine-list').innerText()) && (await page.getByTestId('thr-weekref-item').count()) === 0)
await page.getByTestId('thr-weekref-add').click()
await page.getByTestId('thr-weekref-template').first().selectOption('P')
await page.getByTestId('thr-weekref-first').first().selectOption('대상 부르기')
await page.getByTestId('thr-weekref-ending').first().selectOption('material')
await page.getByTestId('thr-weekref-note').first().fill('자금 태그 · 답글이 많음')
await page.getByTestId('thr-weekref-save').click()
await page.waitForTimeout(400)
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('thr-routine').waitFor()
await page.locator('[data-testid="thr-weekref-item"]').first().waitFor({ timeout: 5000 }).catch(() => {})
check('R1c 이번 주 형식 저장 → 새로고침해도 남음(틀 P · 대상 부르기 · 자료 나눔 · 메모)', (await page.getByTestId('thr-weekref-item').count()) === 1 && (await page.getByTestId('thr-weekref-template').first().inputValue()) === 'P' && (await page.getByTestId('thr-weekref-ending').first().inputValue()) === 'material' && (await page.getByTestId('thr-weekref-note').first().inputValue()) === '자금 태그 · 답글이 많음')
await page.getByTestId('thr-tab-write').click()
await page.getByTestId('thr-write').waitFor()
await page.getByTestId('thr-goal-reply').click()
check('R1d 쓰기 칸 — 이번 주 잘 터진 형식(참고) 한 줄 · P 틀에 "이번 주 잘 됨"', /P 자료 나눔 조건/.test(await page.getByTestId('thr-week-hint').innerText()) && /이번 주 잘 됨/.test(await page.getByTestId('thr-tpl-P').innerText()) && !/이번 주 잘 됨/.test(await page.getByTestId('thr-tpl-A').innerText()))
const before2 = llm.length
{ const l289 = page.getByTestId('thr-qs-ai'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
await page.getByTestId('thr-ai-drafts').waitFor({ timeout: 20000 })
const wcall = llm.slice(before2).find((x) => x.sys.includes('(threads.write'))
check('R1e AI 에 이번 주 형식은 참고로만 — 자료 칸 이름 · 지시에 "기본은 이 공식"', !!wcall && /이번 주 잘 터진 형식\(참고만 — 기본은 우리 공식\)/.test(wcall.user) && /P 자료 나눔 조건/.test(wcall.user) && /기본은 이 공식/.test(wcall.sys), wcall?.user.slice(0, 400))
await page.getByTestId('thr-tab-routine').click()
await page.getByTestId('thr-routine').waitFor()
await shot(page, 'pc-routine', false)
check('R2 PC — JS 오류 0', errors.length === 0, errors)

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
  if (scale) await mp.evaluate((s) => localStorage.setItem('axmvp.ui.preferences', JSON.stringify({ ...JSON.parse(localStorage.getItem('axmvp.ui.preferences') ?? '{}'), textScale: s })), scale)
  await open(mp)
  await mp.getByTestId('thr-goal-reply').click()
  await mp.getByTestId('thr-tpl-P').click()
  await mp.getByTestId('thr-use-example').click()
  await mp.waitForTimeout(250)
  const tabsH = await mp.locator('[role="tab"][data-testid^="thr-tab-"]').evaluateAll((xs) => xs.map((x) => Math.round(x.getBoundingClientRect().height)))
  check(`M ${tag}: 쓰기 — 넘침 0 · 안쪽 칸 44px 이상`, (await overflowX(mp)) <= 0 && tabsH.every((h) => h >= 44), { over: await overflowX(mp), tabsH })
  if (w === 390 && !scale) await shot(mp, 'm390-write')
  if (scale) await shot(mp, 'm360-large-write')
  await mp.getByTestId('thr-posted').click()
  await mp.getByTestId('thr-records').waitFor()
  await mp.waitForTimeout(250)
  check(`M ${tag}: 기록표 — 넘침 0 · 숫자 칸 6개`, (await overflowX(mp)) <= 0 && (await mp.locator('[data-testid^="thr-stat-"]').count()) === 6, await overflowX(mp))
  if (w === 390 && !scale) await shot(mp, 'm390-records')
  await mp.getByTestId('thr-tab-library').click()
  await mp.waitForTimeout(200)
  // D-298 휴대폰은 마우스가 없어 눌러도 설명 상자가 뜨지 않는다(가리지 않게) — 대신 칸 줄 아래 '지금 칸' 한 줄 · 카드마다 쉽게 말하면
  check(`M ${tag}: 틀 23가지 — 넘침 0 · 눌러도 설명 상자 안 뜸 · 지금 칸 한 줄 · 카드마다 쉽게 말하면`, (await overflowX(mp)) <= 0 && (await mp.locator('[role="tooltip"][data-testid="thr-tabtip"]').count()) === 0 && /틀 23가지 — 잘 된 글의 모양/.test(await mp.getByTestId('thr-about').innerText()) && (await mp.getByTestId('thr-lib-plain').count()) === (await mp.getByTestId('thr-lib-card').count()), await overflowX(mp))
  await mp.getByTestId('thr-tab-routine').click()
  await mp.waitForTimeout(200)
  check(`M ${tag}: 하루 10분 — 넘침 0 · JS 오류 0`, (await overflowX(mp)) <= 0 && errs.length === 0, { over: await overflowX(mp), errs })
  if (w === 390 && !scale) await shot(mp, 'm390-routine')
  await m.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
