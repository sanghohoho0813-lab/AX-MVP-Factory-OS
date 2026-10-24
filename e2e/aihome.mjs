/**
 * qa:aihome — AI-1 · AI-2 AI 전략실 업체 첫 화면 "이 회사에 어떤 도움을 줄까요?".
 *
 * 브라우저 → /api/ai-run 은 진짜 서버 함수(api/ai-run.js)를 이 프로세스에서 부른다. 밖(Supabase 로그인 · 권한 · AI 공급자)만 가짜.
 * 처음 쓰는 사람처럼(접힘 기억 없음) 본다.
 *
 *   H  첫 화면 — 물음 · 추천 하나(이유 한 줄) · 목적 단추 3개 · 작업 10가지는 '다른 작업' 안(지운 것 없음)
 *   D  업체 서류함에 아직 안 넣은 서류 N개 → [서류 넣기] → 그 서류가 미리 골라진 창(신분증 같은 개인 정보 칸은 빼고)
 *   R  답을 못 받음(서버는 다 씀 · 화면엔 504) → 같은 내용으로 다시 → 같은 요청 번호 → 서버가 쓴 답을 그대로(AI 1번)
 *      내용을 바꿔 다시 → 새 요청 번호
 *   N  AX 채택 → 추천이 'MVP 구체화'(AX 방향이 확정되어 있어 …)
 *   M  390 · 360 아주 큰 글자 — 넘침 0 · 추천 단추가 첫 화면 안
 */
import { chromium } from 'playwright'
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { seedScript } from './seed.mjs'

const fromRoot = (p) => import(pathToFileURL(path.resolve(p)).href)
const { default: handler, __resetAiRunState } = await fromRoot('api/ai-run.js')
const { SKILLS } = await fromRoot('api/_ai/skills.js')

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.AIHOME_SHOTS ?? ''
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
const shot = async (page, name, fullPage = false) => {
  if (!SHOTS) return
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage })
}

const KEY = 'sk-test-AIHOME-e2e-secret-112233'
const OWNER = 'Bearer owner-e2e-token-bbbbbbbbbbbb'
for (const k of Object.keys(process.env)) if (/^(AI_|OPENAI_|SUPABASE_)/.test(k)) delete process.env[k]
Object.assign(process.env, { SUPABASE_URL: 'https://qa.supabase.test', SUPABASE_ANON_KEY: 'qa-anon', OPENAI_API_KEY: KEY, AI_BASE_URL: 'https://api.openai.test/v1', AI_MODEL_CHEAP: 'm-cheap', AI_MODEL_STANDARD: 'm-standard', AI_MODEL_DEEP: 'm-deep', AI_RATE_PER_MIN: '100', AI_RATE_PER_HOUR: '500' })
__resetAiRunState()

/** AI 공급자에 간 요청 */
const llm = []
const realFetch = globalThis.fetch
globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  const h = init.headers ?? {}
  if (url.startsWith('https://qa.supabase.test/auth/v1/user')) return new Response(JSON.stringify({ id: h.Authorization === OWNER ? 'owner-1' : 'x' }), { status: h.Authorization === OWNER ? 200 : 401 })
  if (url.startsWith('https://qa.supabase.test/rest/v1/rpc/has_capability')) return new Response(JSON.stringify(h.Authorization === OWNER), { status: 200 })
  if (url.startsWith('https://api.openai.test/v1/chat/completions')) {
    const body = JSON.parse(String(init.body ?? '{}'))
    const sys = String(body.messages?.[0]?.content ?? '')
    const name = /^\[스킬\] (.+)$/m.exec(sys)?.[1]
    const skill = Object.entries(SKILLS).find(([, s]) => s.name === name)?.[0] ?? 'UNKNOWN'
    llm.push(skill)
    const content = JSON.stringify(SKILLS[skill]?.example ?? {})
    return new Response(JSON.stringify({ model: body.model, choices: [{ message: { content }, finish_reason: 'stop' }], usage: { prompt_tokens: 1800, completion_tokens: 600 } }), { status: 200 })
  }
  return realFetch(input, init)
}

/** 화면이 보낸 요청(요청 번호를 본다) · lose = 서버는 끝까지 쓰고 화면엔 504(답을 못 받음) */
const posts = []
let lose = 0
async function wireApi(page) {
  await page.route('**/api/ai-run**', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (req.method() === 'POST') posts.push(JSON.parse(req.postData() ?? '{}'))
    const res = { statusCode: 200, headers: {}, raw: '', setHeader(k, v) { this.headers[k] = v }, end(b) { this.raw = b ?? '' } }
    await handler({ method: req.method(), url: u.pathname + u.search, headers: { authorization: OWNER }, body: req.postData() ?? undefined }, res)
    if (req.method() === 'POST' && lose > 0) {
      lose -= 1
      return route.fulfill({ status: 504, headers: { 'content-type': 'text/plain' }, body: 'An error occurred with your deployment FUNCTION_INVOCATION_TIMEOUT' })
    }
    await route.fulfill({ status: res.statusCode, headers: { 'content-type': 'application/json' }, body: res.raw })
  })
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await wireApi(page)
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(seedScript())
// 처음 쓰는 사람처럼 — 접힘을 모두 펼쳐 두는 시험용 기억을 뺀다
await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))
const ls = (key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '[]'), key)
const runs = () => ls('axmvp.v1.owner_ai.runs')
const waitRuns = async (n, ms = 15000) => {
  const t = Date.now()
  while (Date.now() - t < ms) {
    if ((await runs()).length >= n) return true
    await page.waitForTimeout(150)
  }
  return false
}
const toastText = async () => (await page.locator('[role="status"], [data-testid="toast"]').allInnerTexts().catch(() => [])).join(' | ')

/* ---- 고객 하나 고르기(서류함에 사업자등록증 · 재무제표 · 신분증) ---- */
await page.goto(BASE + '/ai', { waitUntil: 'networkidle' })
await page.getByTestId('case-quick').waitFor()
const pickId = (await page.getByTestId('case-quick-client').evaluateAll((els) => els.map((e) => e.dataset.id)))[0]
await page.evaluate((id) => {
  const k = 'axmvp.v1.operations_clients'
  const list = JSON.parse(localStorage.getItem(k) || '[]')
  const at = new Date().toISOString()
  const doc = (fileName) => ({ received: true, issuedAt: '', fileName, fileSize: 2048, storagePath: `ws/${id}/${fileName}`, uploadedAt: at })
  const c = list.find((x) => x.id === id)
  c.documents = { ...(c.documents ?? {}), businessRegistration: doc('사업자등록증.pdf'), financialStatements: doc('재무제표_2025.pdf'), idCard: doc('대표_신분증.jpg') }
  localStorage.setItem(k, JSON.stringify(list))
}, pickId)
await page.reload({ waitUntil: 'networkidle' })
await page.locator(`[data-testid="case-quick-client"][data-id="${pickId}"]`).click()
await page.waitForURL(/\/ai\/cases\//, { timeout: 10000 })
await page.getByTestId('case-workspace').waitFor()

/* ---- H 첫 화면 ---- */
{
  check("H1 첫 물음 '이 회사에 어떤 도움을 줄까요?'", (await page.getByTestId('case-ask').innerText()).includes('이 회사에 어떤 도움을 줄까요?'))
  const next = page.getByTestId('case-next')
  check('H2 추천 하나 — 기록이 없으니 AX 전략 분석 · 이유 한 줄', (await next.getAttribute('data-action-next')) === 'ax' && (await page.getByTestId('case-next-why').innerText()).includes('아직 분석 기록이 없어 AX 전략 분석부터'), await next.innerText())
  check('H3 추천 단추는 주 단추 하나(AX 전략 분석)', (await page.getByTestId('case-next-go').count()) === 1 && (await page.getByTestId('case-next-go').innerText()).includes('AX 전략 분석'))
  const purposes = await page.getByTestId('case-purpose').evaluateAll((els) => els.map((e) => e.dataset.purpose))
  check('H4 목적 단추 3개(정책자금 · 지원사업 · 특허 · 벤처 · 제안서 — 추천과 겹치는 AX 는 뺌)', JSON.stringify(purposes) === JSON.stringify(['funding', 'patent', 'proposal']), purposes)
  check("H5 작업 10가지는 '다른 작업' 안에 접혀 있음(처음 화면 단추가 적음)", (await page.locator('[data-action]:visible').count()) === 0)
  const choices = await page.locator('[data-testid="case-workspace"] section, [data-testid="case-workspace"] div').first().evaluate(() => {
    const box = document.querySelector('[data-testid="case-ask"]')?.closest('section, div.flex.flex-col.gap-3')
    return box ? [...box.querySelectorAll('button')].filter((b) => b.offsetParent !== null && !b.closest('[data-testid="case-more"] [hidden]')).length : -1
  })
  console.log(`  (첫 화면 이 칸에서 보이는 단추 ${choices}개 — 추천 1 · 목적 3 · 서류 넣기 1 · 다른 작업 펼치기 1 · 모델)`)
  await page.getByTestId('case-more').locator('button').first().click()
  check('H6 펼치면 작업 10가지 · ChatGPT 붙여넣기 그대로(지운 것 없음)', (await page.locator('[data-action]:visible').count()) === 10 && (await page.getByTestId('paste-chatgpt-open').isVisible()))
  await page.getByTestId('case-more').locator('button').first().click()
  await shot(page, 'H1-first-1440')
}

/* ---- D 서류함 → 자료 ---- */
{
  const hint = page.getByTestId('case-docs-hint')
  const shownCount = Number((await page.getByTestId('case-docs-count').innerText().catch(() => '0')).replace(/\D/g, ''))
  check(`D1 서류함에 아직 안 넣은 서류 ${shownCount}개 알림(올려 둔 사업자등록증 · 재무제표 포함)`, (await hint.isVisible()) && shownCount >= 2, await hint.innerText().catch(() => ''))
  await page.getByTestId('case-docs-add').click()
  const dlg = page.getByRole('dialog', { name: '업체 서류함에서 가져오기' })
  await dlg.waitFor()
  const rows = await dlg.locator('label').evaluateAll((els) => els.map((e) => ({ t: e.innerText.trim(), on: !!e.querySelector('input')?.checked })))
  const names = rows.map((r) => r.t)
  check('D2 [서류 넣기] → 서류함 창 · 안 넣은 서류가 모두 미리 골라져 있음 · 신분증(개인 정보)은 목록에 없음', rows.length === shownCount && rows.every((r) => r.on) && names.includes('사업자등록증.pdf') && names.includes('재무제표_2025.pdf') && !names.some((t) => t.includes('신분증')) && (await dlg.getByRole('button', { name: `${shownCount}개 가져오기` }).isEnabled()), rows)
  await shot(page, 'D1-docs-dialog')
  await dlg.getByRole('button', { name: '닫기' }).first().click()
}

/* ---- R 답을 못 받고 다시 눌러도 AI 1번 ---- */
{
  await page.getByTestId('case-next-go').click()
  await page.getByTestId('ai-run').waitFor()
  lose = 1
  const p0 = posts.length
  await page.getByTestId('ai-run').click()
  await page.waitForFunction(() => !document.querySelector('[data-testid="ai-run"]')?.hasAttribute('disabled'), null, { timeout: 15000 })
  await page.waitForTimeout(300)
  const t1 = await toastText()
  check('R1 답을 못 받음(504) → 알림 · 창은 그대로 · 결과 0', (await page.getByTestId('ai-run').isVisible()) && (await runs()).length === 0 && llm.length === 1, { t1, llm: llm.length })
  await page.getByTestId('ai-run').click()
  await waitRuns(1)
  await page.waitForTimeout(400)
  const ids = posts.slice(p0).map((p) => p.requestId)
  check('R2 같은 내용으로 다시 → 같은 요청 번호 → 서버가 쓴 답을 그대로(AI 호출 모두 1번 · 결과 1줄)', ids.length === 2 && ids[0] === ids[1] && llm.length === 1 && (await runs()).length === 1, { ids, llm: llm.length })
  check("R3 '같은 요청이라 앞서 만든 결과를 그대로' 알림", (await toastText()).includes('앞서 만든 결과'), await toastText())
}

/* ---- N 채택 → 다음 추천 ---- */
{
  await page.getByTestId('eval-adopt').first().click()
  // 채택하면 '기억에 넣기' 창 — 그대로 저장
  await page.getByTestId('memory-save').waitFor({ timeout: 5000 })
  await page.getByTestId('memory-save').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="case-next"]')?.getAttribute('data-action-next') === 'mvp', null, { timeout: 10000 }).catch(() => {})
  check("N1 AX 채택 → 추천 'MVP 구체화' · 'AX 방향이 확정되어 있어 MVP 구체화를 추천합니다'", (await page.getByTestId('case-next').getAttribute('data-action-next')) === 'mvp' && (await page.getByTestId('case-next-why').innerText()).includes('AX 방향이 확정되어 있어 MVP 구체화를 추천합니다'))
  check('N2 목적 단추에 AX 다시 보임(다시 분석할 수 있게)', (await page.getByTestId('case-purpose').evaluateAll((els) => els.map((e) => e.dataset.purpose))).includes('ax'))

  // 내용을 바꿔 다시 누르면 새 요청 번호(같은 번호면 앞의 답이 돌아온다)
  await page.getByTestId('case-next-go').click()
  await page.getByTestId('ai-run').waitFor()
  lose = 1
  const p0 = posts.length
  const l0 = llm.length
  await page.getByTestId('ai-run').click()
  await page.waitForFunction(() => !document.querySelector('[data-testid="ai-run"]')?.hasAttribute('disabled'), null, { timeout: 15000 })
  await page.getByTestId('ai-ask').fill('견적 자동 작성 쪽으로')
  await page.getByTestId('ai-run').click()
  await waitRuns(2)
  const ids = posts.slice(p0).map((p) => p.requestId)
  check('N3 실패 뒤 내용을 바꿔 다시 → 새 요청 번호(새로 씀)', ids.length === 2 && ids[0] !== ids[1] && llm.length - l0 === 2, { ids, n: llm.length - l0 })
  await page.waitForTimeout(300)
  check("N4 MVP 결과가 검토 전이면 '채택하면 다음 단계(제안서)' · 검토 전 1개", (await page.getByTestId('case-next-why').innerText()).includes('MVP 구체화 결과를 채택하면 다음 단계(제안서)') && (await page.getByTestId('case-next-pending').innerText().catch(() => '')).includes('검토 전 결과 1개'))
}

/* ---- M 휴대폰 ---- */
const caseUrl = page.url()
for (const [w, scale] of [[390, ''], [360, 'extra_large']]) {
  const m = await ctx.newPage()
  await wireApi(m)
  await m.setViewportSize({ width: w, height: 844 })
  await m.goto(BASE + '/', { waitUntil: 'networkidle' })
  await m.evaluate((s) => {
    const k = 'axmvp.ui.preferences'
    const prefs = JSON.parse(localStorage.getItem(k) || '{}')
    if (s) prefs.textScale = s
    else delete prefs.textScale
    localStorage.setItem(k, JSON.stringify(prefs))
  }, scale)
  await m.goto(caseUrl, { waitUntil: 'networkidle' })
  await m.getByTestId('case-next-go').waitFor()
  const over = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  const box = await m.getByTestId('case-next-go').boundingBox()
  const y = Math.round((box?.y ?? 0) + (await m.evaluate(() => window.scrollY)))
  const fs0 = await m.evaluate(() => getComputedStyle(document.documentElement).fontSize)
  check(`M ${w}${scale ? ' 아주 큰 글자' : ''} — 넘침 0 · 추천 단추 위치 ${y}px(글자 ${fs0})`, over <= 0 && !!box, { over, y })
  await m.evaluate(() => document.querySelector('[data-testid="case-ask"]')?.scrollIntoView({ block: 'start' }))
  await m.waitForTimeout(200)
  await shot(m, `M-${w}${scale ? '-xl' : ''}`)
  await m.close()
}

check('오류 0', errors.length === 0, errors)
await browser.close()
console.log(`\naihome: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
