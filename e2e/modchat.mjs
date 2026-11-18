/**
 * qa:modchat — D-552 모듈 대화창(9곳) · 예시 질문 · 직접 눌러서 하기 · 대화창 같이 / 화면만 고르기.
 * D-628(2026-11-18 대표 지시) 대화창은 오른쪽 판으로 — 가운데는 늘 작업 화면, 오른쪽에서 묻는다.
 *
 *   C1  9곳 맨 첫 주소 → 가운데 = 작업 화면(대화창 아님) · 오른쪽 판이 저절로 열림(붙는 폭) · 시작 카드(하는 일 한 줄 · [대화 시작])
 *       → [대화 시작] → 질문칸에 커서 · 큰 단추 4 · 이렇게 물어보세요 4 · 직접 눌러서 하기 · [대화로 묻기] 없음(열려 있으니) · 넘침 0
 *   C2  예시를 누르면 질문창에 들어갈 뿐(보내지 않음) · 질문창에 커서
 *   C3  업체 없이 판정 → '어느 업체 일인가요?' · 업체 고르면 그 업체 판정 · 답 단추 → 가운데가 그 업체 화면으로 · 판은 열린 채 대화 그대로
 *   C4  세금 계산기 — 쓴 질문(AI 실패) → 정해진 답(계산기 이름) · 단추 → 가운데가 그 계산기 · 판은 그대로
 *   C5  직접 눌러서 하기 → 가운데가 그 목차 화면 · 판을 닫으면 [⋯] 안 [대화로 묻기] → 다시 열림(주소 그대로) · ?chat=1 주소 → 열림
 *   C6  이 화면을 열면 '화면만' → 새로 고쳐도 판이 저절로 안 열림 · 오른쪽 끝 [대화] · 다시 '대화창 같이'
 *   C7  설정 › 내 설정 '오른쪽 대화창' 화면만 → 9곳 모두 저절로 안 열림 · 대화창 같이 → 다시 열림
 *   C8  업체 · 상황 예시 · 목차 · 계산기 주소는 저절로 열지 않는다(맞춤 추천 · 오늘 [열기] — 가운데 화면만 · 오른쪽 끝 [대화] 는 있음)
 *   C9  지원사업 — 마감 임박 · 공고 넣는 법 답
 *   C10 휴대폰 390 · 360 — 9곳 가운데 = 작업 화면 · 둥근 [대화](44px 이상 · 아래 메뉴 위) → 아래 판 · 넘침 0 · 질문창 · 큰 단추가 판 안
 *   C11 누를 수 있는 것 손가락 커서(예시 · 직접 눌러서 하기 · 고르기 · [대화 시작] · [대화])
 *   C12 D-627 글자 수 한도 — '이렇게 물어보세요' · '직접 눌러서 하기' 는 처음엔 한 줄 단추(칸은 그려 두고 숨김) · 하는 일 한 줄 30자 안
 *   D1  닫으면 기억 — 판 X → 새로 고쳐도 안 열림 · [대화] 로 다시 열면 그 뒤로는 다시 저절로
 *   D2  좁은 PC(1100 · 덮어 띄우는 폭) — 저절로 열지 않는다 · [대화] 를 누르면 본문 위에 뜬다
 *   D3  대화 칸 바탕이 화면보다 살짝 진하다 · 답 카드는 흰 판 · 내 질문은 말풍선(테마색) · 질문창은 판 맨 아래
 *   D4  시작 카드 글자 60자 이하(판 전체 — 탭 이름 포함)
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { seedScript } from './seed.mjs'
import { chatOpen, openChat, openTools } from './pageTools.mjs'

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
// 시드는 예전 시험들을 위해 '화면만' — 이 시험은 처음 쓰는 사람처럼 아무것도 고르지 않은 상태
const fresh = (p) =>
  p.evaluate(() => {
    localStorage.removeItem('axmvp.chatfirst.v1')
    localStorage.removeItem('axmvp.ui.page_chat')
    localStorage.removeItem('axmvp.ui.side_dock')
  })
await fresh(page)
const A = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') || '[]').find((c) => c.id === 'cli_hansol'))

const overflowX = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
/** D-627 접힌 한 줄 단추를 편다(이미 펼쳤으면 그대로) */
const openFold = async (p, id) => {
  const btn = p.getByTestId(id).first()
  await btn.waitFor({ timeout: 8000 }).catch(() => {})
  if ((await btn.getAttribute('aria-expanded').catch(() => 'true')) !== 'true') await btn.click()
}
const openExamples = (p) => openFold(p, 'chat-examples-open')
const openDirect = (p) => openFold(p, 'modchat-direct-open')
/** 가운데(본문)에 대화창이 있는가 — D-628 뒤로는 늘 0 이어야 한다 */
const chatInMain = async (p) => (await p.locator('main [data-testid="modchat"]').count()) > 0
/** 오른쪽 판 — 그려져 있는지 · 어느 대화창인지 · 놓는 법 */
const dockOf = (p) =>
  p.evaluate(() => {
    const d = document.querySelector('[data-testid="side-dock"]')
    return d ? { on: true, chat: d.getAttribute('data-page-chat'), mode: d.getAttribute('data-mode'), tab: d.getAttribute('data-tab') } : { on: false }
  })
/** 저절로 열리길 기다린다(안 열리면 그대로) */
const settle = async (p, want = true) => {
  await p
    .waitForFunction((w) => !!document.querySelector('[data-testid="side-dock"]') === w, want, { timeout: want ? 6000 : 1200 })
    .catch(() => {})
  await p.waitForTimeout(150)
}
/** 판 안 보이는 글자 수(빈칸 빼고 · 화면 읽기 전용 글 빼고) */
const dockChars = (p, sel = '[data-testid="side-dock"]') =>
  p.evaluate((s) => {
    const root = document.querySelector(s)
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
      if ([...r.getClientRects()].some((q) => q.width > 1 && q.height > 1)) n += x.length
    }
    return n
  }, sel)

/* ---- C1 9곳: 가운데 작업 화면 + 오른쪽 대화창 ---- */
{
  const bad = []
  const startChars = []
  for (const [k, url, title] of MODS) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' })
    await settle(page)
    const dock = await dockOf(page)
    const inMain = await chatInMain(page)
    const h1 = (await page.locator('main h1').first().innerText().catch(() => '')).trim()
    const card = await page.getByTestId('chat-start-card').count()
    const sub = (await page.getByTestId('chat-start-sub').innerText().catch(() => '')).trim()
    const chars = await dockChars(page)
    startChars.push([k, chars])
    const openBtn = await page.getByTestId('chatfirst-open').count()
    const launcher = await page.getByTestId('page-chat-launch').count()
    await shot(page, `pc-${k}-start`)
    await page.getByTestId('chat-start').click().catch(() => {})
    await page.getByTestId('chat-input').waitFor({ timeout: 4000 }).catch(() => {})
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
    const mod = await page.locator('[data-testid="side-dock"] [data-testid="modchat"]').getAttribute('data-module').catch(() => null)
    const starters = await page.getByTestId('chat-starter').count()
    const examples = await page.getByTestId('chat-example').count()
    const direct = await page.getByTestId('modchat-direct-item').count()
    const ox = await overflowX(page)
    if (!dock.on || dock.chat !== `mod:${k}` || dock.mode !== 'dock' || inMain || !h1 || card !== 1 || sub.length < 15 || openBtn !== 0 || launcher !== 0 || focused !== 'chat-input' || mod !== k || starters !== 4 || examples !== 4 || direct < 1 || ox > 0)
      bad.push({ k, title, dock, inMain, h1: h1.slice(0, 12), card, sub: sub.slice(0, 20), openBtn, launcher, focused, mod, starters, examples, direct, ox })
    await shot(page, `pc-${k}`)
  }
  check('C1 9곳 맨 첫 주소 → 가운데 작업 화면 · 오른쪽 판 저절로(붙는 폭) · 시작 카드(하는 일 한 줄) → [대화 시작] → 질문칸 커서 · 큰 단추 4 · 예시 4 · 직접 눌러서 하기 · 넘침 0', bad.length === 0, bad)
  const over = startChars.filter(([, n]) => n < 20 || n > 60)
  check(`D4 시작 카드 — 판 전체 글자 60자 이하(9곳 ${startChars.map(([, n]) => n).join(' · ')})`, over.length === 0, over)
}

/* ---- C2 예시 → 질문창 ---- */
{
  await page.goto(BASE + '/tools/policy-funding', { waitUntil: 'networkidle' })
  await settle(page)
  // C12 하는 일 한 줄은 30자 안
  const sub = (await page.getByTestId('chat-start-sub').innerText()).trim()
  await openChat(page)
  // C12 처음엔 예시 · 직접 칸이 숨어 있다(누르면 보임)
  const hidden0 = !(await page.getByTestId('chat-example').first().isVisible()) && !(await page.getByTestId('modchat-direct-item').first().isVisible())
  await openExamples(page)
  await openDirect(page)
  const shown1 = (await page.getByTestId('chat-example').first().isVisible()) && (await page.getByTestId('modchat-direct-item').first().isVisible())
  check('C12 D-627 하는 일 한 줄 30자 안 · 예시 · 직접 칸은 처음엔 숨김 → 한 줄 단추를 누르면 보임', sub.length >= 15 && sub.length <= 32 && hidden0 && shown1, { sub, hidden0, shown1 })
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
  await openChat(page)
  await page.getByTestId('chat-starter').first().click()
  const t1 = await page.getByTestId('chat-answer-title').last().innerText()
  check('C3a 업체 없이 [이 업체 받을 수 있나요?] → 어느 업체 일인가요?', t1.includes('어느 업체'), t1)
  await page.getByTestId('chat-client').selectOption(A.id)
  await page.getByTestId('chat-starter').first().click()
  const last = page.getByTestId('chat-turn').last()
  const t2 = await last.getByTestId('chat-answer-title').innerText()
  const lines = await last.getByTestId('chat-answer-lines').innerText()
  check('C3b 업체 고르면 그 업체 정책자금 판정(기관 · 준비 서류)', t2.includes(A.companyName) && t2.includes('정책자금') && /기관|서류/.test(lines), `${t2} | ${lines.slice(0, 120)}`)
  // D3 대화 칸 모양 — 바탕 살짝 진하게 · 답 카드 흰 판 · 내 질문 말풍선 · 질문창은 판 맨 아래
  const look = await page.evaluate(() => {
    const rgb = (el) => (el ? getComputedStyle(el).backgroundColor : '')
    const area = document.querySelector('[data-testid="dock-chat-area"]')
    const body = document.body
    const ans = document.querySelector('[data-testid="chat-answer"]')
    const q = document.querySelector('[data-testid="chat-q"]')
    const dock = document.querySelector('[data-testid="side-dock"]').getBoundingClientRect()
    const comp = document.querySelector('[data-testid="chat-composer"]').getBoundingClientRect()
    const lum = (c) => {
      const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c)
      return m ? (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3 : -1
    }
    return { area: rgb(area), areaLum: lum(rgb(area)), ans: rgb(ans), q: rgb(q), qLum: lum(rgb(q)), page: rgb(body), bottomGap: Math.round(dock.bottom - comp.bottom), grad: getComputedStyle(area).backgroundImage }
  })
  check('D3 대화 칸 바탕이 흰 판보다 살짝만 진함(밝기 225~250) · 그라데이션 없음 · 답 카드 흰 판 · 내 질문은 진한 말풍선 · 질문창이 판 맨 아래(60px 안)', look.areaLum >= 225 && look.areaLum < 250 && look.grad === 'none' && look.ans === 'rgb(255, 255, 255)' && look.qLum >= 0 && look.qLum < 140 && look.bottomGap >= 0 && look.bottomGap <= 60, look)
  await shot(page, 'pc-policy-answer')
  const action = last.getByTestId('chat-action').first()
  const href = await action.getAttribute('href')
  const turns0 = await page.getByTestId('chat-turn').count()
  await action.click()
  await page.waitForURL(/client=/, { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(500)
  const dock = await dockOf(page)
  check('C3c 답 단추 → 가운데가 정책자금 화면(그 업체) · 가운데에 대화창 없음 · 오른쪽 판은 열린 채 대화 그대로', page.url().includes('/tools/policy-funding') && page.url().includes(`client=${A.id}`) && !(await chatInMain(page)) && (await page.getByTestId('tool-client-banner').count()) === 1 && dock.on && dock.chat === 'mod:policy-funding' && (await page.getByTestId('chat-turn').count()) === turns0, { url: `${href} → ${page.url()}`, dock })
  await shot(page, 'pc-policy-after-action')
  // 돌아오면 고른 업체 · 대화가 남아 있다
  await page.goto(BASE + '/tools/policy-funding', { waitUntil: 'networkidle' })
  await settle(page)
  const kept = await page.getByTestId('chat-client').inputValue().catch(() => '')
  check('C3d 다시 오면 고른 업체 · 앞 대화 그대로(시작 카드 없이 바로 대화)', kept === A.id && (await page.getByTestId('chat-turn').count()) >= 1 && (await page.getByTestId('chat-start-card').count()) === 0, kept)
  await page.getByTestId('chat-clear').click().catch(() => {})
}

/* ---- C4 세금 계산기 쓴 질문 ---- */
{
  await page.goto(BASE + '/tools/tax', { waitUntil: 'networkidle' })
  await openChat(page)
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
  check('C4c 누르면 가운데가 그 계산기 화면 · 오른쪽 판은 그대로', page.url().includes('c=t6') && !(await chatInMain(page)) && (await dockOf(page)).chat === 'mod:tax' && (await page.getByTestId('chat-turn').count()) >= 1, page.url())
  await page.getByTestId('chat-clear').click().catch(() => {})
}

/* ---- C5 직접 눌러서 하기 → 목차 화면 → 닫기 → [대화로 묻기] ---- */
{
  await page.goto(BASE + '/tools/labcare', { waitUntil: 'networkidle' })
  await openChat(page)
  await openDirect(page)
  const item = page.getByTestId('modchat-direct-item').nth(1)
  const id = await item.getAttribute('data-id')
  await item.click()
  await page.waitForURL(new RegExp(`/tools/labcare/${id}`), { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(400)
  // D-627 모듈 목차는 [목차] 단추 하나(누르면 서랍)
  const navOn = await page.getByTestId('module-menu-open').count()
  check('C5a 직접 눌러서 하기 → 가운데가 그 목차 화면([목차] 단추 그대로) · 판은 열린 채', page.url().includes(`/tools/labcare/${id}`) && !(await chatInMain(page)) && navOn > 0 && (await dockOf(page)).chat === 'mod:labcare', page.url())
  // 열려 있는 동안에는 [대화로 묻기] 가 없다 → 판을 닫으면 [⋯] 안에 생긴다 → 누르면 다시 열린다(주소는 그대로)
  const openWhileOn = await page.getByTestId('chatfirst-open').count()
  await page.getByTestId('dock-close').click()
  await settle(page, false)
  const closed = !(await dockOf(page)).on
  const launcher = await page.getByTestId('page-chat-launch').count()
  const open = page.getByTestId('chatfirst-open')
  const openN = await open.count()
  await shot(page, 'pc-closed-with-launcher')
  const urlBefore = page.url()
  await openTools(page)
  if (openN) await open.click()
  await settle(page)
  check('C5b 판을 닫으면 오른쪽 끝 [대화] · [⋯] 안 [대화로 묻기] → 다시 열림(주소 그대로 · 바로 질문칸)', openWhileOn === 0 && closed && launcher === 1 && openN === 1 && page.url() === urlBefore && (await dockOf(page)).chat === 'mod:labcare' && (await page.getByTestId('chat-input').isVisible()), { openWhileOn, closed, launcher, openN, url: page.url() })
  // ?chat=1 주소는 '화면만' 을 골랐어도 · 목차 화면에서도 연다
  await page.evaluate(() => localStorage.setItem('axmvp.chatfirst.v1', JSON.stringify({ all: 'direct' })))
  await page.goto(BASE + '/tools/labcare/dashboard?chat=1', { waitUntil: 'networkidle' })
  await settle(page)
  check('C5d ?chat=1 주소 → 대화창이 열린다(화면만을 골랐어도 · 목차 화면에서도)', (await dockOf(page)).chat === 'mod:labcare' && (await page.getByTestId('chat-input').isVisible().catch(() => false)), await dockOf(page))
  await fresh(page)
  // 더 보기(세금 계산기는 11칸)
  await page.goto(BASE + '/tools/tax', { waitUntil: 'networkidle' })
  await openChat(page)
  await openDirect(page)
  const before = await page.getByTestId('modchat-direct-item').count()
  await page.getByTestId('modchat-direct-more').click()
  const after = await page.getByTestId('modchat-direct-item').count()
  check('C5c 세금 계산기 직접 눌러서 하기 — 처음 6칸 · [더 보기] 로 결과 찾기 + 계산기 9종 + 기준표', before === 6 && after === 11, { before, after })
}

/* ---- D1 닫으면 기억 ---- */
{
  await page.goto(BASE + '/tools/startup-tax', { waitUntil: 'networkidle' })
  await settle(page)
  const auto0 = (await dockOf(page)).on
  await page.getByTestId('dock-close').click()
  await page.reload({ waitUntil: 'networkidle' })
  await settle(page, false)
  const after = (await dockOf(page)).on
  await page.goto(BASE + '/tools/tax', { waitUntil: 'networkidle' })
  await settle(page, false)
  const other = (await dockOf(page)).on
  const launcher = page.getByTestId('page-chat-launch')
  const pill = await launcher.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { right: Math.round(window.innerWidth - r.right), h: Math.round(r.height), w: Math.round(r.width), text: el.innerText.trim() }
  })
  await launcher.click()
  await settle(page)
  const reopened = (await dockOf(page)).chat === 'mod:tax' && (await page.getByTestId('chat-input').isVisible())
  await page.reload({ waitUntil: 'networkidle' })
  await settle(page)
  const again = (await dockOf(page)).on
  check('D1 닫으면 기억 — X → 새로 고쳐도 · 다른 모듈도 안 열림 · 오른쪽 끝 세로 [대화](44px 이상) → 바로 질문칸 · 그 뒤로는 다시 저절로', auto0 && !after && !other && pill.text === '대화' && pill.h >= 44 && pill.right <= 40 && reopened && again, { auto0, after, other, pill, reopened, again })
}

/* ---- C6 이 화면을 열면: 화면만 ---- */
{
  await page.goto(BASE + '/tools/employment', { waitUntil: 'networkidle' })
  await openChat(page)
  await openDirect(page)
  await page.getByTestId('modchat-mode-direct').click()
  await page.reload({ waitUntil: 'networkidle' })
  await settle(page, false)
  const old = !(await dockOf(page)).on && !(await chatInMain(page))
  const btn = await page.getByTestId('chatfirst-open').count()
  const pill = await page.getByTestId('page-chat-launch').count()
  const others = []
  for (const u of ['/tools/policy-funding', '/tools/tax']) {
    await page.goto(BASE + u, { waitUntil: 'networkidle' })
    await settle(page)
    others.push((await dockOf(page)).on)
  }
  check("C6a 고용지원금만 '화면만' → 새로 고쳐도 판이 안 열림 · [대화로 묻기] · 오른쪽 끝 [대화] 있음 · 다른 모듈은 저절로 열림", old && btn === 1 && pill === 1 && others.every(Boolean), { old, btn, pill, others })
  await page.goto(BASE + '/tools/employment', { waitUntil: 'networkidle' })
  await openTools(page)
  await page.getByTestId('chatfirst-open').click()
  await settle(page)
  await openDirect(page)
  await page.getByTestId('modchat-mode-chat').click()
  await page.goto(BASE + '/tools/employment', { waitUntil: 'networkidle' })
  await settle(page)
  check("C6b [대화로 묻기] → '대화창 같이' 로 바꾸면 다시 맨 첫 주소에서 저절로 열림", (await dockOf(page)).chat === 'mod:employment')
}

/* ---- C7 설정 › 내 설정 ---- */
{
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
  const box = page.getByTestId('settings-chatfirst')
  await box.waitFor({ timeout: 8000 }).catch(() => {})
  await shot(page, 'pc-settings')
  const labels = (await box.innerText()).replace(/\s+/g, ' ')
  await box.locator('[data-mode="direct"]').click()
  const checked = await box.locator('[data-mode="direct"]').getAttribute('aria-checked')
  const shown = []
  for (const [, url] of MODS) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' })
    await settle(page, false)
    shown.push((await dockOf(page)).on)
  }
  check("C7a 설정 '화면만' → 9곳 모두 판이 저절로 안 열림(글: 대화창 같이 · 화면만)", checked === 'true' && shown.every((x) => !x) && labels.includes('대화창 같이') && labels.includes('화면만'), { shown, labels: labels.slice(0, 80) })
  // 한 곳만 대화창 같이 → 설정에 '따로 고른 곳' 한 줄
  await page.goto(BASE + '/tools/cretop?chat=1', { waitUntil: 'networkidle' })
  await settle(page)
  await openChat(page)
  await openDirect(page)
  await page.getByTestId('modchat-mode-chat').click()
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
  const own = await page.getByTestId('settings-chatfirst-own').innerText().catch(() => '')
  check('C7b 한 곳만 따로 고르면 설정에 한 줄(크레탑 분석 · 대화창 같이)', own.includes('크레탑') && own.includes('대화창 같이'), own)
  await page.getByTestId('settings-chatfirst').locator('[data-mode="chat"]').click()
  const back = []
  for (const [, url] of MODS) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' })
    await settle(page)
    back.push((await dockOf(page)).on)
  }
  check("C7c 설정 '대화창 같이' → 9곳 다시 저절로 열림 · 따로 고른 줄 사라짐", back.every(Boolean), back)
}

/* ---- C8 깊은 주소는 저절로 열지 않는다 ---- */
{
  const deep = [`/tools/policy-funding?client=${A.id}`, `/tools/employment?client=${A.id}&preset=youth`, '/tools/tax?m=calc&c=t2', '/tools/tax?m=basis', '/grants?view=notices', '/tools/labcare/dashboard', '/tools/startup-tax?direct=1']
  const bad = []
  for (const u of deep) {
    await page.goto(BASE + u, { waitUntil: 'networkidle' })
    await settle(page, false)
    const d = await dockOf(page)
    const pill = await page.getByTestId('page-chat-launch').count()
    if (d.on || (await chatInMain(page)) || pill !== 1) bad.push({ u, d, pill })
  }
  check('C8 업체 · 상황 예시 · 계산기 · 기준표 · 공고 · 목차 주소는 가운데 화면만(판이 저절로 안 열림) · 오른쪽 끝 [대화] 는 있음', bad.length === 0, bad)
  // 업체로 연 화면 옆의 대화창은 그 업체로(다시 고르게 하지 않는다 — D-618)
  await page.goto(BASE + `/tools/policy-funding?client=${A.id}`, { waitUntil: 'networkidle' })
  await openChat(page)
  const picked = await page.getByTestId('chat-client').inputValue().catch(() => '')
  check('C8b 업체로 연 화면에서 [대화] → 대화창의 회사가 그 업체로 골라져 있음', picked === A.id, picked)
}

/* ---- C9 지원사업 ---- */
{
  await page.goto(BASE + '/grants', { waitUntil: 'networkidle' })
  await openChat(page)
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
  await settle(page)
  const cur = async (loc) => loc.evaluate((el) => getComputedStyle(el).cursor)
  const cStart = await cur(page.getByTestId('chat-start'))
  await openChat(page)
  const c = [cStart, await cur(page.getByTestId('chat-example').first()), await cur(page.getByTestId('modchat-direct-item').first()), await cur(page.getByTestId('modchat-mode-direct')), await cur(page.getByTestId('chat-starter').first())]
  await page.getByTestId('dock-close').click()
  await settle(page, false)
  c.push(await cur(page.getByTestId('page-chat-launch')))
  check('C11 [대화 시작] · 예시 · 직접 눌러서 하기 · 고르기 · 큰 단추 · 오른쪽 끝 [대화] — 손가락 커서', c.every((x) => x === 'pointer'), c)
  await fresh(page)
}

check('C-err PC 화면 오류 0', errors.length === 0, errors)

/* ---- D2 좁은 PC(덮어 띄우는 폭) ---- */
{
  const n = await browser.newContext({ viewport: { width: 1100, height: 900 }, locale: 'ko-KR' })
  const p = await n.newPage()
  await p.route('**/api/ai-assist**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"x"}' }))
  await p.goto(BASE + '/', { waitUntil: 'networkidle' })
  await p.evaluate(seedScript())
  await fresh(p)
  await p.goto(BASE + '/tools/policy-funding', { waitUntil: 'networkidle' })
  await settle(p, false)
  const auto = (await dockOf(p)).on
  const pill = await p.getByTestId('page-chat-launch').count()
  await p.getByTestId('page-chat-launch').click()
  await settle(p)
  const d = await dockOf(p)
  const ox = await overflowX(p)
  await shot(p, 'pc1100-over')
  check('D2 좁은 PC 1100 — 저절로 열지 않는다 · 오른쪽 끝 [대화] → 본문 위에 덮어 뜬다(over) · 넘침 0', !auto && pill === 1 && d.on && d.mode === 'over' && d.chat === 'mod:policy-funding' && ox <= 0, { auto, pill, d, ox })
  await n.close()
}

/* ---- C10 휴대폰 ---- */
for (const w of [390, 360]) {
  const m = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 780 }, locale: 'ko-KR', hasTouch: true, isMobile: true })
  const p = await m.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.route('**/api/ai-assist**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"x"}' }))
  await p.goto(BASE + '/', { waitUntil: 'networkidle' })
  await p.evaluate(seedScript())
  await fresh(p)
  const bad = []
  for (const [k, url] of MODS) {
    await p.goto(BASE + url, { waitUntil: 'networkidle' })
    const fabLoc = p.getByTestId('page-chat-launch')
    await fabLoc.waitFor({ timeout: 8000 }).catch(() => {})
    // 가운데는 작업 화면 · 판은 저절로 뜨지 않는다 · 둥근 [대화] 는 아래 메뉴 위 오른쪽 · 44px 이상
    const inMain = await chatInMain(p)
    const sheet0 = await p.getByTestId('page-chat-sheet').count()
    const fab = await fabLoc
      .evaluate((el) => {
        const r = el.getBoundingClientRect()
        const nav = [...document.querySelectorAll('nav')].map((n) => n.getBoundingClientRect()).filter((q) => q.bottom >= window.innerHeight - 2 && q.top > window.innerHeight / 2)[0]
        return { w: Math.round(r.width), h: Math.round(r.height), aboveNav: nav ? r.bottom <= nav.top + 1 : true, right: Math.round(window.innerWidth - r.right), text: el.innerText.trim() }
      })
      .catch(() => null)
    const ox0 = await overflowX(p)
    if (w === 390 && ['policy-funding', 'tax'].includes(k)) await shot(p, `m390-${k}-screen`)
    await fabLoc.click().catch(() => {})
    await p.getByTestId('chat-input').waitFor({ timeout: 6000 }).catch(() => {})
    await p.waitForTimeout(450)
    const ox = await overflowX(p)
    const vh = p.viewportSize().height
    const inputBox = await p.getByTestId('chat-input').boundingBox().catch(() => null)
    const starterBox = await p.getByTestId('chat-starter').first().boundingBox().catch(() => null)
    const inputBottom = inputBox ? inputBox.y + inputBox.height : 9999
    const starterTop = starterBox?.y ?? 9999
    await openExamples(p)
    await openDirect(p)
    // 넓은 글자가 칸보다 넓어 잘리는 곳(예시 칩 · 직접 칸 이름)
    const clipped = await p.evaluate(() => [...document.querySelectorAll('[data-testid="chat-example"], [data-testid="modchat-direct-item"]')].filter((el) => el.scrollWidth > el.clientWidth + 1).length)
    const tint = await p.evaluate(() => getComputedStyle(document.querySelector('[data-testid="page-chat-sheet"] > div')).backgroundColor)
    if (inMain || sheet0 !== 0 || !fab || fab.w < 44 || fab.h < 44 || !fab.aboveNav || fab.right > 24 || fab.text !== '대화' || ox0 > 0 || ox > 0 || inputBottom > vh || starterTop > vh || clipped > 0 || tint === 'rgb(255, 255, 255)')
      bad.push({ k, inMain, sheet0, fab, ox0, ox, inputBottom: Math.round(inputBottom), starterTop: Math.round(starterTop), clipped, tint })
    if (w === 390 && ['policy-funding', 'tax', 'content', 'grants'].includes(k)) await shot(p, `m390-${k}`)
  }
  // 휴대폰에서 답 하나
  await p.goto(BASE + '/tools/startup-tax', { waitUntil: 'networkidle' })
  await openChat(p)
  await p.getByTestId('chat-client').selectOption(A.id)
  await p.getByTestId('chat-starter').first().click()
  const t = await p.getByTestId('chat-answer-title').last().innerText().catch(() => '')
  const oxAns = await overflowX(p)
  if (w === 390) await shot(p, 'm390-answer')
  // 답 단추 → 판이 닫히고(가운데 화면이 보이게) 그 화면으로
  await p.getByTestId('chat-clear').click().catch(() => {})
  await p.getByTestId('page-chat-sheet-close').click()
  await p.waitForTimeout(250)
  const closed = (await p.getByTestId('page-chat-sheet').count()) === 0 && (await p.getByTestId('page-chat-launch').count()) === 1
  check(`C10 휴대폰 ${w} — 9곳 가운데 작업 화면 · 둥근 [대화](44px↑ · 아래 메뉴 위) → 아래 판(바탕 살짝 진함) · 넘침 0 · 질문창 · 큰 단추가 화면 안 · 잘린 칸 0 · 답 카드 넘침 0 · 닫으면 [대화] 다시 · 오류 0`, bad.length === 0 && t.includes('창업감면') && oxAns <= 0 && closed && errs.length === 0, { bad, t, oxAns, closed, errs })
  await m.close()
}

void chatOpen
await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
