/**
 * qa:modfirst — MOD-1 나머지 모듈 첫 화면 · 아는 값 · 업체 바뀜 · 실패 알림.
 *
 *   P  정책자금 첫 화면: 주 단추 [이 업체 진단하기](AI 자리 단추보다 앞) · 상황 예시 3개 → 누르면 그 업체로 바로 진단 + 가정 칩
 *   E  고용지원금: 상황 예시 4개가 원래 대시보드보다 위 · 채용 진단을 업체로 열면(예시 없이) 직원 수가 채워져 있음
 *   L  연구소: 상황 예시 2개 · 설립 가능성 체크 — 화면 안에서 업체를 바꾸면 앞 업체 답이 남지 않고 뒤 업체 이름으로 저장되지 않음
 *   S  창업감면: 상황 예시 3개 · 업체 없이 누르면 예시 가정만 얹어 열림
 *   G  지원사업: 공고 지우기가 실패하면 알림 · 공고는 그대로
 *   M  390 · 360 아주 큰 글자 — 넘침 0
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.MODFIRST_SHOTS ?? ''
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
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(seedScript())
const clients = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') || '[]').map((c) => ({ id: c.id, name: c.companyName, emp: c.employeeCount ?? null })))
const A = clients.find((c) => c.id === 'cli_hansol') ?? clients[0]
const B = clients.find((c) => c.id !== A.id)
/** 화면 안에서 주소만 바꾸기(새로 고침 없이) — 업체 고르기와 같은 길 */
const spaGo = (url) => page.evaluate((u) => {
  history.pushState({}, '', u)
  window.dispatchEvent(new PopStateEvent('popstate'))
}, url)

/* ---- P 정책자금 ---- */
{
  await page.goto(`${BASE}/tools/policy-funding?client=${A.id}`, { waitUntil: 'networkidle' })
  const go = page.getByTestId('pf-diagnose-go')
  await go.waitFor({ timeout: 10000 })
  const order = await page.evaluate(() => {
    const g = document.querySelector('[data-testid="pf-diagnose-go"]')
    const s = document.querySelector('[data-testid="ai-soon"]')
    return g && s ? !!(g.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) : null
  })
  check('P1 정책자금 첫 화면 주 단추 [이 업체 진단하기] · 그 업체 주소 · AI 자리 단추보다 앞', (await go.innerText()).includes('이 업체 진단하기') && (await go.getAttribute('href')).includes(`client=${A.id}`) && order === true, { order })
  const chips = await page.getByTestId('module-preset').evaluateAll((els) => els.map((e) => e.dataset.preset))
  check('P2 상황 예시 3개(운전자금 · 시설자금 · 청년 채용)', JSON.stringify(chips) === JSON.stringify(['policy-working', 'policy-facility', 'policy-hiring']), chips)
  check('P3 상황 예시 제목에 업체 이름', (await page.getByTestId('module-presets').innerText()).includes(`${A.name} 숫자로`))
  await shot(page, 'P1-policy-1440')
  await page.locator('[data-testid="module-preset"][data-preset="policy-working"]').click()
  await page.waitForURL(/\/tools\/policy-funding\/diagnosis/, { timeout: 10000 })
  await page.getByTestId('pf-preset-note').waitFor({ timeout: 10000 })
  check('P4 누르면 그 업체로 진단 화면 · 가정(운전자금) 칩', page.url().includes(`client=${A.id}`) && (await page.getByTestId('pf-preset-note').innerText()).includes('운전자금'), await page.getByTestId('pf-preset-note').innerText())
  await page.goto(`${BASE}/tools/policy-funding`, { waitUntil: 'networkidle' })
  await page.getByTestId('pf-diagnose-go').waitFor()
  check('P5 업체 없이 열면 [진단하기] · 업체를 고르라는 한 줄', (await page.getByTestId('pf-diagnose-go').innerText()).trim() === '진단하기' && (await page.getByTestId('module-presets').innerText()).includes('업체를 먼저 고르면'))
}

/* ---- E 고용지원금 ---- */
{
  await page.goto(`${BASE}/tools/employment?client=${A.id}`, { waitUntil: 'networkidle' })
  await page.getByTestId('module-presets').waitFor({ timeout: 10000 })
  const chips = await page.getByTestId('module-preset').evaluateAll((els) => els.map((e) => e.dataset.preset))
  const yPresets = (await page.getByTestId('module-presets').boundingBox())?.y ?? 9e9
  const yLink = (await page.getByText('고객 관리 업체와 연결').first().boundingBox())?.y ?? 0
  check('E1 고용지원금 상황 예시 4개 · 원래 대시보드보다 위', chips.length === 4 && chips.includes('emp-youth') && yPresets < yLink, { chips, yPresets, yLink })
  await page.goto(`${BASE}/tools/employment/diagnosis?client=${A.id}`, { waitUntil: 'networkidle' })
  const size = page.locator('input[placeholder="피보험자 수"]').first()
  await size.waitFor({ timeout: 10000 })
  const v = await size.inputValue()
  const empNum = String(A.emp ?? '').match(/\d+/)?.[0] ?? ''
  check(`E2 채용 진단을 업체로 열면(예시 없이) 직원 수가 채워져 있음(${A.name} 기록 '${A.emp ?? '-'}' → ${v})`, empNum ? v === empNum : true, { v, emp: A.emp })
  check('E3 예시 없이 열었으면 가정 칩 없음(진단은 누를 때)', (await page.getByTestId('emp-preset-note').count()) === 0)
}

/* ---- L 연구소 ---- */
{
  // 연구소는 업체를 물고 오면 업체 목록(추가)으로 간다(예전 그대로) — 한눈에 보기는 업체 없이
  await page.goto(`${BASE}/tools/labcare`, { waitUntil: 'networkidle' })
  await page.getByTestId('module-presets').waitFor({ timeout: 10000 })
  check('L1 연구소 한눈에 보기 맨 위 상황 예시 2개', (await page.getByTestId('module-preset').count()) === 2)
  await page.goto(`${BASE}/tools/labcare/assessment?client=${A.id}`, { waitUntil: 'networkidle' })
  const proj = page.locator('input[placeholder="예) 추천엔진 정확도 고도화 연구"]').first()
  await proj.waitFor({ timeout: 10000 })
  await proj.fill('A사 과제 — 배차 추천 정확도')
  await page.waitForTimeout(600)
  await spaGo(`/tools/labcare/assessment?client=${B.id}`)
  await page.waitForTimeout(1200)
  const projB = await page.locator('input[placeholder="예) 추천엔진 정확도 고도화 연구"]').first().inputValue()
  const saved = await page.evaluate(([a, b]) => ({ a: JSON.parse(localStorage.getItem(`axmvp.tools.labcare.assessForm.${a}`) || '{}'), b: JSON.parse(localStorage.getItem(`axmvp.tools.labcare.assessForm.${b}`) || '{}') }), [A.id, B.id])
  check('L2 업체를 바꾸면 앞 업체가 적은 과제명이 뒤 업체 화면에 남지 않음', projB !== 'A사 과제 — 배차 추천 정확도', projB)
  check('L3 뒤 업체 저장 칸에 앞 업체 답 · 이름이 들어가지 않음(앞 업체 것은 앞 업체에 그대로)', saved.b.projectName !== 'A사 과제 — 배차 추천 정확도' && saved.b.companyName !== A.name && saved.a.projectName === 'A사 과제 — 배차 추천 정확도', { a: [saved.a.companyName, saved.a.projectName], b: [saved.b.companyName, saved.b.projectName] })
}

/* ---- S 창업감면 ---- */
{
  await page.goto(`${BASE}/tools/startup-tax`, { waitUntil: 'networkidle' })
  await page.getByTestId('module-presets').waitFor({ timeout: 10000 })
  check('S1 창업감면 상황 예시 3개', (await page.getByTestId('module-preset').count()) === 3)
  await page.locator('[data-testid="module-preset"][data-preset="startup-convert"]').click()
  await page.waitForURL(/\/tools\/startup-tax/, { timeout: 10000 })
  await page.waitForTimeout(800)
  check('S2 업체 없이 누르면 예시 가정(법인전환)만 얹어 판정 화면', /법인전환|법인으로/.test(await page.locator('main').innerText()), page.url())
}

/* ---- G 지원사업 지우기 실패 ---- */
{
  const now = new Date().toISOString()
  await page.evaluate((at) => {
    const list = JSON.parse(localStorage.getItem('axmvp.module.grants.notices') || '[]')
    list.push({ id: 'gn_modfirst', clientId: '', createdAt: at, updatedAt: at, data: { title: '시험 공고 — 지우기 실패', agency: '시험', operator: '', category: 'money', applyStart: '', applyEnd: '', deadlineKind: 'always', amountText: '', target: '', summary: '', url: '', rules: {}, source: 'manual', published: false } })
    localStorage.setItem('axmvp.module.grants.notices', JSON.stringify(list))
  }, now)
  await page.goto(`${BASE}/grants?open=gn_modfirst`, { waitUntil: 'networkidle' })
  await page.getByTestId('notice-delete').waitFor({ timeout: 10000 })
  await page.getByTestId('notice-delete').click()
  // 저장소 쓰기를 일부러 막는다(인터넷 끊김 · 저장 공간 가득 참과 같은 실패)
  await page.evaluate(() => {
    const orig = Storage.prototype.setItem
    window.__restoreSet = () => (Storage.prototype.setItem = orig)
    Storage.prototype.setItem = function (k, v) {
      if (String(k).includes('grants.notices')) throw new Error('QuotaExceededError')
      return orig.call(this, k, v)
    }
  })
  await page.getByTestId('notice-delete-yes').click()
  await page.waitForTimeout(600)
  const toast = (await page.locator('[role="status"], [data-testid="toast"]').allInnerTexts().catch(() => [])).join(' | ')
  const still = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.module.grants.notices') || '[]').some((n) => n.id === 'gn_modfirst'))
  check('G1 공고 지우기가 실패하면 알림(조용히 묻히지 않음) · 공고는 그대로', toast.includes('지우지 못했습니다') && still, { toast, still })
  await page.evaluate(() => window.__restoreSet?.())
}

/* ---- M 휴대폰 ---- */
for (const [w, scale] of [[390, ''], [360, 'extra_large']]) {
  const m = await ctx.newPage()
  await m.setViewportSize({ width: w, height: 844 })
  await m.goto(BASE + '/', { waitUntil: 'networkidle' })
  await m.evaluate((s) => {
    const k = 'axmvp.ui.preferences'
    const p = JSON.parse(localStorage.getItem(k) || '{}')
    if (s) p.textScale = s
    else delete p.textScale
    localStorage.setItem(k, JSON.stringify(p))
  }, scale)
  const over = []
  for (const u of [`/tools/policy-funding?client=${A.id}`, `/tools/employment?client=${A.id}`, '/tools/labcare', '/tools/startup-tax']) {
    await m.goto(BASE + u, { waitUntil: 'networkidle' })
    await m.getByTestId('module-presets').waitFor({ timeout: 10000 }).catch(() => {})
    const o = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (o > 0) over.push([u, o])
  }
  await m.goto(`${BASE}/tools/policy-funding?client=${A.id}`, { waitUntil: 'networkidle' })
  await m.getByTestId('module-presets').scrollIntoViewIfNeeded().catch(() => {})
  await shot(m, `M-policy-${w}${scale ? '-xl' : ''}`)
  check(`M ${w}${scale ? ' 아주 큰 글자' : ''} — 네 모듈 첫 화면 넘침 0`, over.length === 0, over)
  await m.close()
}

check('오류 0', errors.length === 0, errors)
await browser.close()
console.log(`\nmodfirst: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
