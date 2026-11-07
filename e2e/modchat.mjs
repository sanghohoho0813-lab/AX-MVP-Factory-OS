/**
 * qa:modchat — D-552 모듈 첫 화면 = 대화창(9곳) · 예시 질문 · 직접 눌러서 하기 · 대화창 / 바로 화면 고르기.
 *
 *   C1  9곳 맨 첫 주소 → 대화창(이 화면이 하는 일 한 줄 · 큰 단추 4 · 이렇게 물어보세요 4 · 직접 눌러서 하기) · [대화로 묻기] 없음 · '어느 업체 일로' 띠 없음
 *   C2  예시를 누르면 질문창에 들어갈 뿐(보내지 않음) · 질문창에 커서
 *   C3  업체 없이 판정 → '어느 업체 일인가요?' · 업체 고르면 그 업체 판정 · 답 단추 → 예전 화면(그 업체)
 *   C4  세금 계산기 — 쓴 질문(AI 실패) → 정해진 답(계산기 이름) · 단추 → 그 계산기
 *   C5  직접 눌러서 하기 → 그 목차 화면 · 예전 화면 위 [대화로 묻기] → 대화창
 *   C6  이 화면을 열면 '바로 화면' → 새로 고쳐도 예전 화면 · 다시 '대화창부터'
 *   C7  설정 › 내 설정 '모듈 첫 화면' 바로 화면 → 9곳 모두 예전 화면 · 대화창부터 → 다시 대화창
 *   C8  업체 · 상황 예시 · 목차 · 계산기 주소는 예전 화면 그대로(맞춤 추천 · 오늘 [열기])
 *   C9  지원사업 — 마감 임박 · 공고 넣는 법 답
 *   C10 휴대폰 390 · 360 — 9곳 넘침 0 · 질문창 · 큰 단추가 첫 화면 안
 *   C11 누를 수 있는 것 손가락 커서(예시 · 직접 눌러서 하기 · 고르기)
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.MODCHAT_SHOTS ?? ''
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
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full })
}

const MODS = [
  ['policy-funding', '/tools/policy-funding', '정책자금'],
  ['employment', '/tools/employment', '고용지원금'],
  ['labcare', '/tools/labcare', '기업부설연구소'],
  ['startup-tax', '/tools/startup-tax', '창업감면'],
  ['tax', '/tools/tax', '세금 계산기'],
  ['grants', '/grants', '지원사업'],
  ['cretop', '/tools/cretop', '크레탑'],
  ['content', '/tools/content', '홍보 글'],
  ['homepage', '/tools/homepage', '홈페이지'],
]

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
// AI 는 이 시험에서 늘 실패 — 정해진 답으로 떨어지는 길을 본다(진짜 AI 답 길은 qa:chat · qa:homeask)
await page.route('**/api/ai-assist**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: '시험 — AI 꺼 둠' }) }))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(seedScript())
// 시드는 예전 시험들을 위해 '바로 화면' — 이 시험은 처음 쓰는 사람처럼 아무것도 고르지 않은 상태
await page.evaluate(() => localStorage.removeItem('axmvp.chatfirst.v1'))
const A = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') || '[]').find((c) => c.id === 'cli_hansol'))

const overflowX = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const chatOn = async (p) => (await p.getByTestId('modchat').count()) > 0

/* ---- C1 9곳 대화창 ---- */
{
  const bad = []
  for (const [k, url, title] of MODS) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' })
    await page.getByTestId('modchat').waitFor({ timeout: 8000 }).catch(() => {})
    const mod = await page.getByTestId('modchat').getAttribute('data-module').catch(() => null)
    const sub = await page.getByTestId('chat-hero-sub').innerText().catch(() => '')
    const starters = await page.getByTestId('chat-starter').count()
    const examples = await page.getByTestId('chat-example').count()
    const direct = await page.getByTestId('modchat-direct-item').count()
    const head = await page.getByTestId('chat-head').innerText().catch(() => '')
    const openBtn = await page.getByTestId('chatfirst-open').count()
    const pick = await page.getByTestId('tool-client-pick').count()
    const detail = await page.getByTestId('chat-detail').getAttribute('href').catch(() => '')
    const ox = await overflowX(page)
    if (mod !== k || sub.length < 15 || starters !== 4 || examples !== 4 || direct < 1 || !head.includes(title.slice(0, 2)) || openBtn !== 0 || pick !== 0 || !detail?.includes('direct=1') || ox > 0)
      bad.push({ k, mod, sub: sub.slice(0, 20), starters, examples, direct, head: head.slice(0, 20), openBtn, pick, detail, ox })
    await shot(page, `pc-${k}`)
  }
  check('C1 9곳 맨 첫 주소 → 대화창(하는 일 한 줄 · 큰 단추 4 · 예시 4 · 직접 눌러서 하기 · 바로 화면 링크) · [대화로 묻기] · 업체 고르기 띠 없음 · 넘침 0', bad.length === 0, bad)
}

/* ---- C2 예시 → 질문창 ---- */
{
  await page.goto(BASE + '/tools/policy-funding', { waitUntil: 'networkidle' })
  const ex = page.getByTestId('chat-example').first()
  const exText = (await ex.innerText()).replace(/[“”"]/g, '').trim()
  await ex.click()
  const val = await page.getByTestId('chat-input').inputValue()
  const turns = await page.getByTestId('chat-turn').count()
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
  check('C2 예시를 누르면 질문창에 들어감 · 보내지 않음 · 질문창에 커서', val === exText && turns === 0 && focused === 'chat-input', { val, exText, turns, focused })
}

/* ---- C3 판정 · 업체 고르기 · 답 단추 ---- */
{
  await page.goto(BASE + '/tools/policy-funding', { waitUntil: 'networkidle' })
  await page.getByTestId('chat-starter').first().click()
  const t1 = await page.getByTestId('chat-answer-title').last().innerText()
  check('C3a 업체 없이 [이 업체 받을 수 있나요?] → 어느 업체 일인가요?', t1.includes('어느 업체'), t1)
  await page.getByTestId('chat-client').selectOption(A.id)
  await page.getByTestId('chat-starter').first().click()
  const last = page.getByTestId('chat-turn').last()
  const t2 = await last.getByTestId('chat-answer-title').innerText()
  const lines = await last.getByTestId('chat-answer-lines').innerText()
  check('C3b 업체 고르면 그 업체 정책자금 판정(기관 · 준비 서류)', t2.includes(A.companyName) && t2.includes('정책자금') && /기관|서류/.test(lines), `${t2} | ${lines.slice(0, 120)}`)
  const action = last.getByTestId('chat-action').first()
  const href = await action.getAttribute('href')
  await action.click()
  await page.waitForURL(/client=/, { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(500)
  check('C3c 답 단추 → 예전 정책자금 화면(그 업체) · 대화창 아님', page.url().includes('/tools/policy-funding') && page.url().includes(`client=${A.id}`) && !(await chatOn(page)), `${href} → ${page.url()}`)
  // 돌아오면 고른 업체 · 대화가 남아 있다
  await page.goto(BASE + '/tools/policy-funding', { waitUntil: 'networkidle' })
  const kept = await page.getByTestId('chat-client').inputValue().catch(() => '')
  check('C3d 다시 오면 고른 업체 · 앞 대화 그대로', kept === A.id && (await page.getByTestId('chat-turn').count()) >= 1, kept)
  await page.getByTestId('chat-clear').click().catch(() => {})
}

/* ---- C4 세금 계산기 쓴 질문 ---- */
{
  await page.goto(BASE + '/tools/tax', { waitUntil: 'networkidle' })
  await page.getByTestId('chat-client').selectOption(A.id)
  await page.getByTestId('chat-input').fill('퇴직금 3억 받으면 세금 얼마야?')
  await page.getByTestId('chat-send').click()
  const last = page.getByTestId('chat-turn').last()
  await last.getByTestId('chat-answer-title').waitFor({ timeout: 10000 }).catch(() => {})
  const title = await last.getByTestId('chat-answer-title').innerText().catch(() => '')
  const err = await last.getByTestId('chat-error').count()
  const href = await last.getByTestId('chat-action').first().getAttribute('href').catch(() => '')
  check('C4a 쓴 질문 — AI 가 안 되면 정해진 답(퇴직 계산기) · 까닭 한 줄', title.includes('퇴직') && err === 1, { title, err })
  check('C4b 단추 → 그 계산기를 그 업체로(m=calc · c=t6 · client)', !!href && href.includes('m=calc') && href.includes('c=t6') && href.includes(`client=${A.id}`), href)
  await last.getByTestId('chat-action').first().click()
  await page.waitForTimeout(600)
  check('C4c 누르면 예전 계산기 화면', page.url().includes('c=t6') && !(await chatOn(page)), page.url())
  await page.goto(BASE + '/tools/tax', { waitUntil: 'networkidle' })
  await page.getByTestId('chat-clear').click().catch(() => {})
}

/* ---- C5 직접 눌러서 하기 → 목차 화면 → [대화로 묻기] ---- */
{
  await page.goto(BASE + '/tools/labcare', { waitUntil: 'networkidle' })
  const item = page.getByTestId('modchat-direct-item').nth(1)
  const id = await item.getAttribute('data-id')
  await item.click()
  await page.waitForURL(new RegExp(`/tools/labcare/${id}`), { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(400)
  const navOn = await page.getByTestId('module-nav').count()
  check('C5a 직접 눌러서 하기 → 그 목차 화면(예전 화면 · 목차 그대로)', page.url().includes(`/tools/labcare/${id}`) && !(await chatOn(page)) && navOn > 0, page.url())
  const open = page.getByTestId('chatfirst-open')
  const openN = await open.count()
  await shot(page, 'pc-old-with-chat-button')
  if (openN) await open.click()
  await page.waitForTimeout(500)
  check('C5b 예전 화면 경로 줄 [대화로 묻기] → 대화창(?chat=1)', openN === 1 && page.url().includes('chat=1') && (await chatOn(page)), page.url())
  // 더 보기(세금 계산기는 11칸)
  await page.goto(BASE + '/tools/tax', { waitUntil: 'networkidle' })
  const before = await page.getByTestId('modchat-direct-item').count()
  await page.getByTestId('modchat-direct-more').click()
  const after = await page.getByTestId('modchat-direct-item').count()
  check('C5c 세금 계산기 직접 눌러서 하기 — 처음 6칸 · [더 보기] 로 결과 찾기 + 계산기 9종 + 기준표', before === 6 && after === 11, { before, after })
}

/* ---- C6 이 화면을 열면: 바로 화면 ---- */
{
  await page.goto(BASE + '/tools/employment', { waitUntil: 'networkidle' })
  await page.getByTestId('modchat-mode-direct').click()
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const old = !(await chatOn(page))
  const btn = await page.getByTestId('chatfirst-open').count()
  const others = []
  for (const u of ['/tools/policy-funding', '/tools/tax']) {
    await page.goto(BASE + u, { waitUntil: 'networkidle' })
    others.push(await chatOn(page))
  }
  check('C6a 고용지원금만 바로 화면 → 새로 고쳐도 예전 화면 · [대화로 묻기] 있음 · 다른 모듈은 대화창 그대로', old && btn === 1 && others.every(Boolean), { old, btn, others })
  await page.goto(BASE + '/tools/employment', { waitUntil: 'networkidle' })
  await page.getByTestId('chatfirst-open').click()
  await page.waitForTimeout(400)
  await page.getByTestId('modchat-mode-chat').click()
  await page.goto(BASE + '/tools/employment', { waitUntil: 'networkidle' })
  check('C6b [대화로 묻기] → 대화창부터로 바꾸면 다시 맨 첫 주소가 대화창', await chatOn(page))
}

/* ---- C7 설정 › 내 설정 ---- */
{
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
  const box = page.getByTestId('settings-chatfirst')
  await box.waitFor({ timeout: 8000 }).catch(() => {})
  await shot(page, 'pc-settings')
  await box.locator('[data-mode="direct"]').click()
  const checked = await box.locator('[data-mode="direct"]').getAttribute('aria-checked')
  const shown = []
  for (const [, url] of MODS) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' })
    shown.push(await chatOn(page))
  }
  check('C7a 설정 바로 화면 → 9곳 모두 예전 화면', checked === 'true' && shown.every((x) => !x), shown)
  // 한 곳만 대화창으로 → 설정에 '따로 고른 곳' 한 줄
  await page.goto(BASE + '/tools/cretop?chat=1', { waitUntil: 'networkidle' })
  await page.getByTestId('modchat-mode-chat').click()
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
  const own = await page.getByTestId('settings-chatfirst-own').innerText().catch(() => '')
  check('C7b 한 곳만 따로 고르면 설정에 한 줄(크레탑 분석 · 대화창부터)', own.includes('크레탑') && own.includes('대화창부터'), own)
  await page.getByTestId('settings-chatfirst').locator('[data-mode="chat"]').click()
  const back = []
  for (const [, url] of MODS) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' })
    back.push(await chatOn(page))
  }
  check('C7c 설정 대화창부터 → 9곳 다시 대화창 · 따로 고른 줄 사라짐', back.every(Boolean), back)
}

/* ---- C8 깊은 주소는 예전 화면 ---- */
{
  const deep = [`/tools/policy-funding?client=${A.id}`, `/tools/employment?client=${A.id}&preset=youth`, '/tools/tax?m=calc&c=t2', '/tools/tax?m=basis', '/grants?view=notices', '/tools/labcare/dashboard', '/tools/startup-tax?direct=1']
  const bad = []
  for (const u of deep) {
    await page.goto(BASE + u, { waitUntil: 'networkidle' })
    if (await chatOn(page)) bad.push(u)
  }
  check('C8 업체 · 상황 예시 · 계산기 · 기준표 · 공고 · 목차 · 바로 화면 주소는 예전 화면 그대로', bad.length === 0, bad)
}

/* ---- C9 지원사업 ---- */
{
  await page.goto(BASE + '/grants', { waitUntil: 'networkidle' })
  await page.getByTestId('chat-starter').nth(2).click()
  const t = await page.getByTestId('chat-answer-title').last().innerText()
  await page.getByTestId('chat-starter').nth(3).click()
  const t2 = await page.getByTestId('chat-answer-title').last().innerText()
  check('C9 지원사업 — 마감 임박 · 공고 넣는 법(정해진 답)', /마감|공고/.test(t) && t2.includes('공고'), `${t} | ${t2}`)
  await page.getByTestId('chat-clear').click().catch(() => {})
}

/* ---- C11 손가락 커서 ---- */
{
  await page.goto(BASE + '/tools/startup-tax', { waitUntil: 'networkidle' })
  const cur = async (loc) => loc.evaluate((el) => getComputedStyle(el).cursor)
  const c = [await cur(page.getByTestId('chat-example').first()), await cur(page.getByTestId('modchat-direct-item').first()), await cur(page.getByTestId('modchat-mode-direct')), await cur(page.getByTestId('chat-starter').first())]
  check('C11 예시 · 직접 눌러서 하기 · 고르기 · 큰 단추 — 손가락 커서', c.every((x) => x === 'pointer'), c)
}

check('C-err PC 화면 오류 0', errors.length === 0, errors)

/* ---- C10 휴대폰 ---- */
for (const w of [390, 360]) {
  const m = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 780 }, locale: 'ko-KR', hasTouch: true, isMobile: true })
  const p = await m.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.route('**/api/ai-assist**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"x"}' }))
  await p.goto(BASE + '/', { waitUntil: 'networkidle' })
  await p.evaluate(seedScript())
  await p.evaluate(() => localStorage.removeItem('axmvp.chatfirst.v1'))
  const bad = []
  for (const [k, url] of MODS) {
    await p.goto(BASE + url, { waitUntil: 'networkidle' })
    await p.getByTestId('modchat').waitFor({ timeout: 8000 }).catch(() => {})
    const ox = await overflowX(p)
    const vh = p.viewportSize().height
    const inputTop = (await p.getByTestId('chat-input').boundingBox().catch(() => null))?.y ?? 9999
    const starterTop = (await p.getByTestId('chat-starter').first().boundingBox().catch(() => null))?.y ?? 9999
    // 넓은 글자가 칸보다 넓어 잘리는 곳(예시 칩 · 직접 칸 이름)
    const clipped = await p.evaluate(() => [...document.querySelectorAll('[data-testid="chat-example"], [data-testid="modchat-direct-item"]')].filter((el) => el.scrollWidth > el.clientWidth + 1).length)
    if (ox > 0 || inputTop > vh || starterTop > vh || clipped > 0) bad.push({ k, ox, inputTop: Math.round(inputTop), starterTop: Math.round(starterTop), clipped })
    if (w === 390 && ['policy-funding', 'tax', 'content', 'grants'].includes(k)) await shot(p, `m390-${k}`)
  }
  // 휴대폰에서 답 하나
  await p.goto(BASE + '/tools/startup-tax', { waitUntil: 'networkidle' })
  await p.getByTestId('chat-client').selectOption(A.id)
  await p.getByTestId('chat-starter').first().click()
  const t = await p.getByTestId('chat-answer-title').last().innerText().catch(() => '')
  const oxAns = await overflowX(p)
  if (w === 390) await shot(p, 'm390-answer')
  await p.getByTestId('chat-clear').click().catch(() => {})
  check(`C10 휴대폰 ${w} — 9곳 넘침 0 · 질문창 · 큰 단추가 첫 화면 안 · 잘린 칸 0 · 답 카드 넘침 0 · 오류 0`, bad.length === 0 && t.includes('창업감면') && oxAns <= 0 && errs.length === 0, { bad, t, oxAns, errs })
  await m.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
