/**
 * qa:nextstep — NX-1 · NX-2 오늘 '먼저 제안할 것' · 영업 새 잠재고객 · AI 오류 문의 번호.
 *
 *   T  오늘 화면 맨 위 '오늘 먼저 제안할 것' — 처음 쓰는 사람(접힘 기억 없음)에게도 보임 · 업체마다 모듈 칩 · [맞춤 추천 보기] → 그 업체 맞춤 추천 탭
 *      '오늘 정리하기' 는 그대로(보조 단추) · 예전 '먼저 제안할 업체 n곳' 링크도 그대로
 *   S  영업 '새 잠재고객' — 같은 이름의 업체가 있으면 먼저 알림(열기 링크) · 다른 업체면 그대로 등록
 *      업체는 만들어졌는데 영업 칸 저장만 실패 → 창 · 적은 내용 그대로 · 다시 누르면 같은 업체로 저장(업체 1개)
 *   A  AI 도우미 오류(서버 504) → 문의 번호 6자리(요청 번호 끝)
 *   M  390 · 360 아주 큰 글자 — 오늘 화면 넘침 0 · 추천 카드 위치
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.NEXTSTEP_SHOTS ?? ''
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
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) })
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
const posts = []
await ctx.route('**/api/ai-assist**', async (r) => {
  const req = r.request()
  if (req.method() === 'GET') {
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, role: 'owner', providers: [{ id: 'gemini', label: 'Gemini', configured: true, keyName: 'GEMINI_API_KEY', checked: false, models: [{ id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', note: '', price: null, verified: null, tier: 'cheap' }] }], defaultChoice: { provider: 'gemini', model: 'gemini-3.1-flash-lite' } }) })
  }
  posts.push(JSON.parse(req.postData() ?? '{}'))
  return r.fulfill({ status: 504, contentType: 'text/plain', body: 'An error occurred with your deployment FUNCTION_INVOCATION_TIMEOUT' })
})
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(seedScript())
// 처음 쓰는 사람처럼 — 접힘을 모두 펼쳐 두는 시험용 기억을 뺀다
await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))
const toastText = async (p = page) => (await p.locator('[role="status"], [data-testid="toast"]').allInnerTexts().catch(() => [])).join(' | ')
const clientsLs = () => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') || '[]'))

/* ---- T 오늘 ---- */
{
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  const card = page.getByTestId('today-picks')
  await card.waitFor({ timeout: 10000 }).catch(() => {})
  const picks = await page.getByTestId('today-pick').evaluateAll((els) => els.map((e) => ({ id: e.dataset.client, chips: [...e.querySelectorAll('[data-testid="today-pick-chip"]')].map((c) => c.textContent?.trim()) })))
  check('T1 오늘 화면 맨 위 "오늘 먼저 제안할 것" — 처음 쓰는 사람에게도 보임 · 업체마다 모듈 칩', (await card.isVisible()) && picks.length >= 1 && picks.every((p) => p.chips.length >= 1), picks)
  const yCard = (await card.boundingBox())?.y ?? 9e9
  const yTodos = (await page.locator('#todos').boundingBox())?.y ?? 0
  check('T2 할 일 칸보다 위(아침 첫 화면에 바로)', yCard < yTodos, { yCard, yTodos })
  const closeBtn = page.getByRole('button', { name: /오늘 정리하기/ }).first()
  const cls = (await closeBtn.getAttribute('class')) ?? ''
  check("T3 '오늘 정리하기' 는 그대로 있고 보조 단추(주 단추 색 아님)", (await closeBtn.count()) === 1 && !cls.includes('bg-brand-600'), cls.slice(0, 120))
  await shot(page, 'T1-today-1440')
  const first = picks[0]?.id
  await page.locator(`[data-testid="today-pick"][data-client="${first}"] [data-testid="today-pick-go"]`).click()
  await page.waitForURL(new RegExp(`/ops/clients/${first}`), { timeout: 10000 })
  await page.waitForTimeout(800)
  check('T4 [맞춤 추천 보기] → 그 업체 맞춤 추천 탭', page.url().includes('tab=smart') && (await page.locator('[role="tab"][aria-selected="true"]').first().innerText()).includes('맞춤'), page.url())
}

/* ---- S 영업 새 잠재고객 ---- */
{
  const existing = (await clientsLs()).find((c) => !c.archivedAt)
  await page.goto(BASE + '/sales/board?new=1', { waitUntil: 'networkidle' })
  const dlg = page.getByRole('dialog', { name: '새 잠재고객' })
  await dlg.waitFor({ timeout: 10000 })
  const nameInput = dlg.locator('label', { hasText: /회사명|이름\(회사명\)/ }).locator('input').first()
  await nameInput.fill(existing.companyName.replace(/\(주\)|㈜|주식회사/g, '').trim())
  await page.waitForTimeout(300)
  const dupe = page.getByTestId('prospect-dupe')
  check(`S1 같은 이름의 업체(${existing.companyName})가 있으면 먼저 알림 · 그 업체 열기 링크`, (await dupe.isVisible()) && (await dupe.locator('a').getAttribute('href')) === `/ops/clients/${existing.id}`, await dupe.innerText().catch(() => ''))
  await shot(page, 'S1-prospect-dupe')
  await nameInput.fill('새벽물류 시험상사')
  await page.waitForTimeout(200)
  check('S2 다른 이름이면 알림 없음', (await dupe.count()) === 0)
  await dlg.locator('label', { hasText: '대표 고민 한 줄' }).locator('input').fill('배차가 너무 오래 걸림')
  await dlg.locator('label', { hasText: '예상 수임료' }).locator('input').fill('300')
  // 업체 만들기는 되고 영업 칸 저장만 실패하게 — 고객 저장 두 번째 쓰기를 막는다
  await page.evaluate(() => {
    const orig = Storage.prototype.setItem
    let n = 0
    window.__restoreSet = () => (Storage.prototype.setItem = orig)
    Storage.prototype.setItem = function (k, v) {
      if (k === 'axmvp.v1.operations_clients' && ++n === 2) throw new Error('QuotaExceededError')
      return orig.call(this, k, v)
    }
  })
  const before = (await clientsLs()).filter((c) => c.companyName === '새벽물류 시험상사').length
  await dlg.getByRole('button', { name: '잠재고객 등록' }).click()
  await page.waitForTimeout(800)
  const t1 = await toastText()
  const kept = await dlg.locator('label', { hasText: '대표 고민 한 줄' }).locator('input').inputValue().catch(() => '')
  check('S3 영업 칸 저장만 실패 → 창 · 적은 내용 그대로(예전엔 창이 닫히며 사라짐) · 안내', (await dlg.isVisible()) && kept === '배차가 너무 오래 걸림' && t1.includes('적은 내용은 그대로'), { t1, kept })
  await page.evaluate(() => window.__restoreSet?.())
  await dlg.getByRole('button', { name: '잠재고객 등록' }).click()
  await page.waitForTimeout(800)
  const after = (await clientsLs()).filter((c) => c.companyName === '새벽물류 시험상사')
  check('S4 다시 누르면 같은 업체로 저장 — 업체 1개(두 번 생기지 않음) · 고민 · 수임료 저장', before === 0 && after.length === 1 && after[0].sales?.concern === '배차가 너무 오래 걸림' && after[0].sales?.expectedFee === 3_000_000 && !(await dlg.isVisible()), { n: after.length, sales: after[0]?.sales })
}

/* ---- A AI 도우미 오류 문의 번호 ---- */
{
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.getByTestId('ai-assist-chip').first().click()
  await page.getByTestId('ai-assist-confirm-go').click() // D-289 고른 뒤 [이대로 질문하기]
  await page.getByTestId('ai-assist-error').waitFor({ timeout: 10000 })
  const ref = (await page.getByTestId('ai-assist-error-ref').innerText().catch(() => '')) ?? ''
  const id = posts.at(-1)?.requestId ?? ''
  check('A1 AI 오류(504) → 문의 번호 6자리 = 보낸 요청 번호 끝(서버 기록과 같은 번호)', !!id && ref.includes(`문의 번호 ${id.slice(-6)}`), { ref, id })
  await shot(page, 'A1-ai-error-ref')
}

/* ---- M 휴대폰 ---- */
for (const [w, scale] of [[390, ''], [360, 'extra_large']]) {
  const m = await ctx.newPage()
  await m.setViewportSize({ width: w, height: 844 })
  await m.goto(BASE + '/', { waitUntil: 'networkidle' })
  await m.evaluate((s) => {
    localStorage.removeItem('axmvp.fold.all')
    const k = 'axmvp.ui.preferences'
    const p = JSON.parse(localStorage.getItem(k) || '{}')
    if (s) p.textScale = s
    else delete p.textScale
    localStorage.setItem(k, JSON.stringify(p))
  }, scale)
  await m.goto(BASE + '/', { waitUntil: 'networkidle' })
  await m.getByTestId('today-picks').waitFor({ timeout: 10000 }).catch(() => {})
  const over = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  const b = await m.getByTestId('today-picks').boundingBox()
  const y = b ? Math.round(b.y + (await m.evaluate(() => window.scrollY))) : -1
  const n = await m.getByTestId('today-pick').count()
  check(`M ${w}${scale ? ' 아주 큰 글자' : ''} — 넘침 0 · 추천 카드 위치 ${y}px · 휴대폰은 2곳까지(${n})`, over <= 0 && y > 0 && n <= 2, { over, y, n })
  await m.getByTestId('today-picks').scrollIntoViewIfNeeded().catch(() => {})
  await shot(m, `M-today-${w}${scale ? '-xl' : ''}`)
  await m.close()
}

check('오류 0', errors.length === 0, errors)
await browser.close()
console.log(`\nnextstep: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
