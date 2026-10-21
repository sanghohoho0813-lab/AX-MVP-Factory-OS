/**
 * qa:sideai — D-254 AI 옆 창(왼쪽 메뉴 맨 아래 [ChatGPT 옆에 띄우기]).
 * 대표: "모니터가 하나라서 OS 를 보면서 ChatGPT 를 옆에 띄워 놓고 싶다".
 * 밖(ChatGPT · Claude · Gemini)은 이 상자에서 못 가므로 가짜 쪽 하나로 바꿔 받는다 — 창이 열리는 자리 · 이름 · OS 비키기만 본다.
 *
 *   S1 PC 왼쪽 메뉴 아래에 단추(글자 그대로) · 휴대폰에는 없음
 *   S2 누르면 판 — AI 셋 · 폭 셋 · 기본 ChatGPT · 보통
 *   S3 [옆에 열기] → 창 하나(이름 mirae-side-ai) · 화면 오른쪽 · OS 본문이 그만큼 왼쪽으로 비킴 · 가로 넘침 0
 *   S4 Claude 로 바꾸면 같은 창이 Claude 로(창이 둘이 되지 않음)
 *   S5 [닫기] → 창 닫힘 · 비킨 여백 0 / 사용자가 창을 직접 닫아도 여백 0
 *   S6 팝업이 막히면 푸는 법 안내
 *   S7 [OS 도 왼쪽 창으로] → 같은 주소의 OS 창이 왼쪽에
 *   S8 고른 AI · 폭은 다시 열어도 기억
 *   S10 머리줄은 그대로 — 1024 · 1440 · 1600 · 1920 · 2300 에서 머리줄 넘침 0(머리줄에 두었을 때 넘쳤다)
 *   S11 메뉴를 접어도 아이콘으로 남고 판이 화면 안에 열린다
 * D-256 대표: "주소창도 적을 수 있게 · 구글 기본" · "목차 칸 경계선을 끌어 줄였다 커졌다 · 아예 사라졌다"
 *   A1~A6 주소 칸 — 주소 → 같은 옆 창이 그리로 · 검색어 → 구글 검색 · javascript: 는 검색으로(실행 안 됨) · 비우면 구글 ·
 *         바로 가기(기업마당) · 폭만 바꾸면 보던 곳 그대로 · 단추 이름이 띄운 곳으로
 *   R1~R9 메뉴 경계선 — 끌어 넓히기 · 아이콘 · 숨김(펼치기 탭) · 다시 열어도 기억 · 탭 → 기억한 폭 · 키보드 · 두 번 누르면 원래 폭 ·
 *         숨김에서 끌어 꺼내기 · 1024 화면은 본문 768px 남김 · 넘침 0
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.SIDEAI_SHOTS ?? ''
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
  await page.waitForTimeout(250)
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) })
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, screen: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
// 밖 사이트(AI · 구글 · 네이버 · 기업마당 …) 대신 가짜 쪽 — 어느 주소로 열렸는지만 본다
const outside = (u) => !u.href.startsWith(new URL(BASE).origin)
await ctx.route(outside, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: `<html><body><h1>${new URL(r.request().url()).host}</h1></body></html>` }))
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(seedScript())
await page.evaluate(() => localStorage.removeItem('axmvp.ui.side_ai'))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

const btn = page.getByTestId('side-ai-button')
const btnBox = await btn.boundingBox()
check('S1 PC 왼쪽 메뉴 아래에 [ChatGPT 옆에 띄우기] 단추(글자 그대로)', (await btn.isVisible()) && (await btn.getAttribute('aria-label')).includes('ChatGPT') && (await btn.innerText()).includes('ChatGPT 옆에 띄우기') && btnBox.x < 300 && btnBox.y > 600, btnBox)
await btn.click()
const panel = page.getByTestId('side-ai-panel')
await panel.waitFor()
const services = await page.getByTestId('side-ai-service').evaluateAll((els) => els.map((e) => `${e.dataset.id}:${e.getAttribute('aria-checked')}`))
const widths = await page.getByTestId('side-ai-width').evaluateAll((els) => els.map((e) => `${e.dataset.id}:${e.getAttribute('aria-checked')}`))
const sites = await page.getByTestId('side-ai-site').evaluateAll((els) => els.map((e) => e.dataset.id))
check('S2 판 — 넷(ChatGPT 기본 · Claude · Gemini · Google) · 폭 셋(보통 기본) · 주소 칸 · 바로 가기 넷 · 열기 · OS 왼쪽 창 · 단축키 안내', services.join() === 'chatgpt:true,claude:false,gemini:false,google:false' && (await page.getByTestId('side-ai-address').count()) === 1 && sites.join() === 'naver,bizinfo,kstartup,hometax' && widths.join() === 'third:false,twofifths:true,half:false' && (await page.getByTestId('side-ai-open').count()) === 1 && (await page.getByTestId('side-ai-os-left').count()) === 1 && (await panel.innerText()).includes('Win+'), { services, widths, sites })
await shot(page, 'S2-panel')

const [popup] = await Promise.all([ctx.waitForEvent('page'), page.getByTestId('side-ai-open').click()])
await popup.waitForLoadState()
await page.waitForTimeout(300)
const name = await popup.evaluate(() => window.name)
const reserve = Number((await page.locator('[data-side-reserve]').getAttribute('data-side-reserve').catch(() => '0')) ?? 0)
const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
check(`S3 [옆에 열기] → ChatGPT 창 하나(이름 mirae-side-ai) · OS 본문 오른쪽 ${reserve}px 비킴 · 가로 넘침 0 · 단추가 '열림'`, popup.url().startsWith('https://chatgpt.com/') && name === 'mirae-side-ai' && reserve > 0 && over <= 0 && (await btn.getAttribute('data-open')) === '1', { url: popup.url(), name, reserve, over })
await shot(page, 'S3-reserved')

const pagesBefore = ctx.pages().length
await page.locator('[data-testid="side-ai-service"][data-id="claude"]').click()
await page.waitForTimeout(800)
check('S4 Claude 로 바꾸면 같은 창이 Claude 로 — 창이 늘지 않음', popup.url().startsWith('https://claude.ai/') && ctx.pages().length === pagesBefore, { url: popup.url(), pages: ctx.pages().length })

// D-256 주소 칸 — 같은 옆 창이 그리로(창이 늘지 않음)
const go = async (text) => {
  await page.getByTestId('side-ai-address').fill(text)
  await page.getByTestId('side-ai-go').click()
}
const dialogs = []
popup.on('dialog', (d) => {
  dialogs.push(d.message())
  void d.dismiss()
})
await go('naver.com')
await popup.waitForURL('https://naver.com/**', { timeout: 5000 }).catch(() => {})
check('A1 주소 칸 "naver.com" → 같은 옆 창이 https://naver.com · 창이 늘지 않음 · 단추 "naver.com 옆 창 열림"', popup.url() === 'https://naver.com/' && ctx.pages().length === pagesBefore && (await btn.innerText()).includes('naver.com 옆 창 열림'), { url: popup.url(), pages: ctx.pages().length, btn: await btn.innerText() })
await page.getByTestId('side-ai-address').fill('청년도약 장려금 2026')
await page.getByTestId('side-ai-address').press('Enter')
await popup.waitForURL('https://www.google.com/search**', { timeout: 5000 }).catch(() => {})
check('A2 검색어(띄어쓰기 · 한글) + Enter → 구글 검색 · 단추 "Google 검색"', popup.url().startsWith('https://www.google.com/search?q=') && decodeURIComponent(new URL(popup.url()).searchParams.get('q') ?? '') === '청년도약 장려금 2026' && (await btn.innerText()).includes('Google 검색'), popup.url())
await go('javascript:alert(document.domain)')
await page.waitForTimeout(600)
check('A3 "javascript:…" → 실행하지 않고 구글 검색으로 · 경고창 0', popup.url().startsWith('https://www.google.com/search?q=javascript') && dialogs.length === 0, { url: popup.url(), dialogs })
await go('')
await popup.waitForURL('https://www.google.com/', { timeout: 5000 }).catch(() => {})
check('A4 비우고 [열기] → Google(www.google.com)', popup.url() === 'https://www.google.com/' && (await btn.innerText()).includes('Google 옆 창 열림'), popup.url())
await page.locator('[data-testid="side-ai-site"][data-id="bizinfo"]').click()
await popup.waitForURL('https://www.bizinfo.go.kr/**', { timeout: 5000 }).catch(() => {})
check('A5 바로 가기 [기업마당] → bizinfo.go.kr · 단추 "기업마당 옆 창 열림"', popup.url() === 'https://www.bizinfo.go.kr/' && (await btn.innerText()).includes('기업마당 옆 창 열림'), popup.url())
await page.locator('[data-testid="side-ai-width"][data-id="third"]').click()
await page.waitForTimeout(700)
check('A6 폭만 바꾸면 보던 곳(기업마당) 그대로 · 창이 늘지 않음', popup.url() === 'https://www.bizinfo.go.kr/' && ctx.pages().length === pagesBefore, { url: popup.url(), pages: ctx.pages().length })
await page.locator('[data-testid="side-ai-width"][data-id="twofifths"]').click()
await shot(page, 'A-address')

await page.getByTestId('side-ai-close').click()
await page.waitForTimeout(400)
check('S5a [닫기] → 창 닫힘 · 비킨 여백 0', popup.isClosed() && (await page.locator('[data-side-reserve]').count()) === 0 && (await btn.getAttribute('data-open')) === '0')

const [popup2] = await Promise.all([ctx.waitForEvent('page'), page.getByTestId('side-ai-open').click()])
await popup2.waitForLoadState()
await popup2.close()
await page.waitForTimeout(1800)
check('S5b 사용자가 AI 창을 직접 닫아도 → 여백 0 · 단추 원래대로', (await page.locator('[data-side-reserve]').count()) === 0 && (await btn.getAttribute('data-open')) === '0')

// 팝업 막힘 — 브라우저가 새 창을 주지 않는 경우
await page.evaluate(() => {
  window.__realOpen = window.open
  window.open = () => null
})
await page.getByTestId('side-ai-open').click()
await page.waitForTimeout(200)
check('S6 팝업이 막히면 → "팝업 차단 → 항상 허용" 안내', (await page.getByTestId('side-ai-blocked').count()) === 1 && (await page.getByTestId('side-ai-blocked').innerText()).includes('항상 허용'))
await shot(page, 'S6-blocked')
await page.evaluate(() => {
  window.open = window.__realOpen
})

const [osWin] = await Promise.all([ctx.waitForEvent('page'), page.getByTestId('side-ai-os-left').click()])
await osWin.waitForLoadState()
check('S7 [OS 도 왼쪽 창으로] → 같은 OS 주소의 새 창(이름 mirae-os-left) · 안내 한 줄', new URL(osWin.url()).origin === new URL(BASE).origin && (await osWin.evaluate(() => window.name)) === 'mirae-os-left' && (await page.getByTestId('side-ai-os-note').count()) === 1)
await osWin.close()

await page.locator('[data-testid="side-ai-width"][data-id="half"]').click()
await page.reload({ waitUntil: 'networkidle' })
await page.getByTestId('side-ai-button').click()
const kept = await page.getByTestId('side-ai-service').evaluateAll((els) => els.filter((e) => e.getAttribute('aria-checked') === 'true').map((e) => e.dataset.id))
const keptW = await page.getByTestId('side-ai-width').evaluateAll((els) => els.filter((e) => e.getAttribute('aria-checked') === 'true').map((e) => e.dataset.id))
check('S8 다시 열어도 고른 AI(Claude) · 폭(반반) 기억 · 단추 이름도 Claude', kept.join() === 'claude' && keptW.join() === 'half' && (await page.getByTestId('side-ai-button').getAttribute('aria-label')).includes('Claude'), { kept, keptW })
await page.keyboard.press('Escape')
await page.waitForTimeout(150)
check('S8b Esc 로 판 닫힘', (await page.getByTestId('side-ai-panel').count()) === 0)
// 메뉴 접기 → 아이콘만 · 판은 화면 안
await page.getByRole('button', { name: '사이드바 접기' }).click()
await page.waitForTimeout(400)
await page.getByTestId('side-ai-button').click()
const pb = await page.getByTestId('side-ai-panel').boundingBox()
check('S11 메뉴를 접어도 아이콘 단추 · 판이 화면 안에 열림', (await page.getByTestId('side-ai-button').innerText()).trim() === '' && pb && pb.x >= 0 && pb.y >= 0 && pb.x + pb.width <= 1440 && pb.y + pb.height <= 900, pb)
await shot(page, 'S11-collapsed')
await page.keyboard.press('Escape')
await page.getByRole('button', { name: '사이드바 펼치기' }).click()

// D-256 메뉴 경계선 끌기
const aside = page.locator('aside[data-nav-mode]')
const asideW = async () => Math.round((await aside.boundingBox())?.width ?? -1)
const mode = async () => aside.getAttribute('data-nav-mode')
const pageOver = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const handle = page.getByTestId('nav-resize')
const drag = async (toX) => {
  const hb = await handle.boundingBox()
  await page.mouse.move(hb.x + hb.width / 2, hb.y + 300)
  await page.mouse.down()
  for (const f of [0.3, 0.6, 1]) await page.mouse.move(hb.x + hb.width / 2 + (toX - (hb.x + hb.width / 2)) * f, hb.y + 320, { steps: 4 })
  await page.mouse.up()
  await page.waitForTimeout(350)
}
await page.waitForTimeout(300)
const w0 = await asideW()
const hb0 = await handle.boundingBox()
check(`R1 메뉴 오른쪽 경계에 끄는 손잡이(세로 전체 · 마우스 모양 ↔) — 지금 폭 ${w0}px(예전 그대로)`, w0 === 288 && hb0 && Math.abs(hb0.x + hb0.width / 2 - w0) <= 2 && hb0.height >= 800 && (await handle.evaluate((e) => getComputedStyle(e).cursor)) === 'col-resize', { w0, hb0 })
await drag(360)
const w1 = await asideW()
const r2 = { w1, mode: await mode(), btn: await page.getByTestId('side-ai-button').innerText(), over: await pageOver(), hdr: await page.evaluate(() => document.querySelector('header').scrollWidth - document.querySelector('header').clientWidth), fit: await page.locator('header').getAttribute('data-fit') }
check(`R2 끌어 넓히기 → ${w1}px(360 근처) · 메뉴 이름 그대로 · 머리줄 · 화면 넘침 0(자리가 모자라면 넓은 찾기 칸부터 단추로 · 지금 단계 ${r2.fit})`, Math.abs(w1 - 360) <= 3 && r2.mode === 'full' && r2.btn.includes('옆에 띄우기') && r2.over <= 0 && r2.hdr <= 0, r2)
await shot(page, 'R2-wide')
await drag(100)
check('R3 왼쪽으로(150px 안) → 아이콘만(80px) · 단추 글자 없음', (await asideW()) === 80 && (await mode()) === 'icons' && (await page.getByTestId('side-ai-button').innerText()).trim() === '', await asideW())
await drag(8)
const navLinks = await page.getByRole('navigation', { name: '주 메뉴' }).count()
check('R4 왼쪽 끝까지 → 메뉴 사라짐(0px) · 왼쪽 끝 [메뉴 다시 보이기] 탭 · 넘침 0', (await asideW()) === 0 && (await mode()) === 'hidden' && navLinks === 0 && (await page.getByTestId('nav-show').isVisible()) && (await pageOver()) <= 0, { w: await asideW(), navLinks })
await shot(page, 'R4-hidden')
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(400)
check('R5 다시 열어도 숨김 그대로(이 브라우저에 기억)', (await mode()) === 'hidden' && (await page.getByTestId('nav-show').isVisible()))
await page.getByTestId('nav-show').click()
await page.waitForTimeout(350)
check('R6 [메뉴 다시 보이기] → 끌어 둔 폭(360) 그대로 돌아옴', Math.abs((await asideW()) - 360) <= 3 && (await mode()) === 'full' && (await page.getByTestId('nav-show').count()) === 0, await asideW())
await handle.focus()
await page.keyboard.press('ArrowLeft')
await page.waitForTimeout(300)
const wk = await asideW()
await page.keyboard.press('End')
await page.waitForTimeout(300)
const wEnd = await asideW()
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
check(`R7 키보드 — ← 24px(${wk}) · End 가장 넓게(${wEnd}) · Enter 원래 폭(288)`, Math.abs(wk - 336) <= 3 && wEnd === 440 && (await asideW()) === 288, { wk, wEnd, back: await asideW() })
await drag(250)
await handle.dblclick()
await page.waitForTimeout(350)
check('R8 손잡이 두 번 누르면 원래 폭(288)', (await asideW()) === 288 && (await mode()) === 'full', await asideW())
await handle.focus()
await page.keyboard.press('Home')
await page.waitForTimeout(300)
const hidW = await asideW()
await drag(300)
check('R9 숨긴 뒤 왼쪽 끝 경계선을 끌어 바로 꺼내기(300px)', hidW === 0 && Math.abs((await asideW()) - 300) <= 3 && (await mode()) === 'full', { hidW, w: await asideW() })
await page.getByTestId('side-ai-button').click()
const pb2 = await page.getByTestId('side-ai-panel').boundingBox()
check('R10 넓힌 메뉴에서도 옆 창 판이 메뉴 오른쪽 · 화면 안', pb2 && pb2.x >= 300 && pb2.x + pb2.width <= 1440 && pb2.y >= 0, pb2)
await page.keyboard.press('Escape')
await handle.dblclick()
check('PC JS 오류 0', errors.length === 0, errors.join(' | '))
await ctx.close()

// D-258 OS 안 오른쪽 판 — AI 대화(서버 함수는 가짜 답) · 웹(Google igu · 기업마당 안에 · 막는 곳은 옆 창)
{
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, screen: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  await c.route(outside, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: `<html><head><meta charset="utf-8"></head><body><h1 id="host">${new URL(r.request().url()).host}</h1><p id="q">${new URL(r.request().url()).searchParams.get('q') ?? ''}</p></body></html>` }))
  const posts = []
  let failNext = 0
  await c.route('**/api/ai-assist**', async (r) => {
    const req = r.request()
    if (req.method() === 'GET') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, providers: [{ id: 'gemini', label: 'Gemini', configured: true, keyName: 'GEMINI_API_KEY', checked: false, models: [{ id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', note: '', price: null, verified: null, tier: 'cheap' }] }], defaultChoice: { provider: 'gemini', model: 'gemini-3.1-flash-lite' } }) })
    }
    const body = JSON.parse(req.postData() ?? '{}')
    posts.push(body)
    if (failNext > 0) {
      failNext--
      return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'provider_busy' }) })
    }
    const n = posts.length
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, run: { requestId: body.requestId, assistId: body.assistId, page: body.page, provider: 'gemini', model: 'gemini-3.1-flash-lite', status: 'succeeded', structured: { headline: `답 ${n} — 정책자금은 진단 → 서류 → 신청 순서예요.`, items: [{ title: '1단계 진단', detail: '기업 상황을 먼저 봅니다. (공식 확인 필요)' }, { title: '보낼 문자', body: `대표님 안녕하세요 ${n}` }], next: ['필요 서류 알려 줘', '기한은 언제야'], caution: '' }, raw: '', usage: { input: 10, output: 10, total: 20 }, estimatedCostUsd: 0, ms: 5, sent: { userChars: 1, rows: 0, rowsCut: 0 }, createdAt: new Date().toISOString() } }),
    })
  })
  const p = await c.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e)))
  await p.goto(BASE + '/', { waitUntil: 'networkidle' })
  await p.evaluate(seedScript())
  await p.evaluate(() => ['axmvp.ui.side_dock', 'axmvp.ui.side_dock.chat', 'axmvp.ui.nav.size'].forEach((k) => localStorage.removeItem(k)))
  await p.goto(BASE + '/', { waitUntil: 'networkidle' })
  await p.waitForTimeout(500)
  const geo = () =>
    p.evaluate(() => {
      const d = document.querySelector('[data-testid="side-dock"]')
      const r = d ? d.getBoundingClientRect() : null
      const m = document.querySelector('main').getBoundingClientRect()
      const h = document.querySelector('header')
      return { dock: r ? Math.round(r.width) : 0, dockX: r ? Math.round(r.x) : null, mode: d ? d.dataset.mode : '', mainRight: Math.round(m.right), main: Math.round(m.width), over: document.documentElement.scrollWidth - document.documentElement.clientWidth, hdr: h.scrollWidth - h.clientWidth, pad: getComputedStyle(document.documentElement).getPropertyValue('--dock-w').trim() }
    })

  await p.getByTestId('side-ai-button').click()
  await p.getByTestId('side-ai-inside').waitFor()
  check('D1 판 맨 위 "OS 안에서 열기" — [AI 대화] · [Google 검색]', (await p.getByTestId('side-ai-dock-chat').isVisible()) && (await p.getByTestId('side-ai-dock-web').isVisible()))
  await shot(p, 'D1-panel')
  await p.getByTestId('side-ai-dock-chat').click()
  await p.getByTestId('side-dock').waitFor()
  await p.waitForTimeout(300)
  let g = await geo()
  check(`D2 [AI 대화] → 새 창 없이 오른쪽 판(${g.dock}px · 옆에 붙임) · 본문이 판 왼쪽에서 끝남(본문 ${g.main}px) · 화면 · 머리줄 넘침 0 · 판 위 메뉴 판 닫힘`, g.mode === 'dock' && g.dock === 384 && g.mainRight <= g.dockX + 1 && g.over <= 0 && g.hdr <= 0 && c.pages().length === 1 && (await p.getByTestId('side-ai-panel').count()) === 0, g)
  const starters = await p.getByTestId('dock-starter').count()
  check('D3 처음 — "무엇이든 물어보세요" · 예시 질문 4개 · 모델 고르기 단추', (await p.getByTestId('dock-chat-empty').isVisible()) && starters === 4 && (await p.getByTestId('dock-model').isVisible()), starters)
  await shot(p, 'D3-chat-empty')
  await p.getByTestId('dock-starter').nth(1).click()
  await p.getByTestId('dock-answer').first().waitFor()
  const a1 = await p.getByTestId('dock-answer').first().innerText()
  check('D4 예시 질문 한 번 → side.chat(page side)로 묻고 판 안에 답 · 핵심 · 단계 · 복사할 글 · 모델 이름 · 이어 묻기 칩', posts.length === 1 && posts[0].assistId === 'side.chat' && posts[0].page === 'side' && posts[0].ask.includes('정책자금') && a1.includes('답 1') && a1.includes('1단계 진단') && a1.includes('대표님 안녕하세요 1') && a1.includes('gemini-3.1-flash-lite') && (await p.getByTestId('dock-next').count()) === 2, { posts: posts.length, a1 })
  await p.getByTestId('dock-chat-input').fill('고용지원금은?')
  await p.getByTestId('dock-chat-input').press('Enter')
  await p.getByTestId('dock-answer').nth(1).waitFor()
  const ctx2 = posts[1]?.context ?? {}
  check('D5 질문 칸 + Enter → 두 번째 답 · 앞선 대화 1줄 · 지금 보는 화면 이름만 보냄(회사 기록 없음)', posts.length === 2 && posts[1].ask === '고용지원금은?' && ctx2.sections?.[0]?.name === '앞선 대화' && ctx2.sections[0].rows.length === 1 && ctx2.sections.length === 1 && (ctx2.facts ?? []).length === 1 && ctx2.facts[0].startsWith('지금 보고 있는 화면'), ctx2)
  await p.getByTestId('dock-next').last().click()
  await p.getByTestId('dock-answer').nth(2).waitFor()
  check('D6 이어 묻기 칩 → 세 번째 질문으로 바로', posts.length === 3 && posts[2].ask === '기한은 언제야', posts.map((x) => x.ask))
  failNext = 1
  await p.getByTestId('dock-chat-input').fill('실패해 볼 질문')
  await p.getByTestId('dock-chat-send').click()
  await p.getByTestId('dock-error').waitFor()
  const errText = await p.getByTestId('dock-error').innerText()
  await p.getByTestId('dock-retry').click()
  await p.waitForFunction(() => document.querySelectorAll('[data-testid="dock-answer"]').length === 4)
  check('D7 AI 가 붐비면 사람 말로 · [다시] → 같은 질문으로 답', errText.includes('붐비') && posts.length === 5 && posts[4].ask === '실패해 볼 질문', { errText, n: posts.length })
  // 알림이 판에 가리지 않게 — 복사 알림은 판 왼쪽에
  await p.getByTestId('dock-copy').first().click()
  const toast = p.getByText(/복사했어요|복사하지 못했어요/).first()
  await toast.waitFor()
  const tb = await toast.boundingBox()
  g = await geo()
  check('D8 복사 알림이 판에 가리지 않음(판 왼쪽)', tb && tb.x + tb.width <= g.dockX + 1, { tb, dockX: g.dockX })
  await shot(p, 'D8-chat-answers')
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForTimeout(500)
  check('D9 다시 열어도 판 · 대화(4개 답) 그대로', (await p.getByTestId('side-dock').isVisible()) && (await p.getByTestId('dock-answer').count()) === 4 && (await p.getByTestId('dock-turn').count()) === 5)

  // 웹
  await p.locator('[data-testid="dock-tab"][data-id="web"]').click()
  const frame = p.getByTestId('dock-web-frame')
  await frame.waitFor()
  const src0 = await frame.getAttribute('src')
  const inner = p.frameLocator('[data-testid="dock-web-frame"]')
  await inner.locator('#host').waitFor()
  check('D10 [웹] → 판 안에 Google(igu=1 · 다른 곳 안에 들어가는 Google 주소)', src0 === 'https://www.google.com/webhp?igu=1' && (await inner.locator('#host').innerText()) === 'www.google.com', src0)
  await p.getByTestId('dock-web-address').fill('청년도약 장려금 2026')
  await p.getByTestId('dock-web-address').press('Enter')
  await p.waitForFunction(() => (document.querySelector('[data-testid="dock-web-frame"]')?.getAttribute('src') ?? '').includes('/search?'))
  const src1 = await frame.getAttribute('src')
  await inner.locator('#q', { hasText: '청년도약' }).waitFor()
  check('D11 검색어 + Enter → 판 안에서 Google 검색(새 창 없음)', src1.startsWith('https://www.google.com/search?') && src1.includes('igu=1') && decodeURIComponent(new URL(src1).searchParams.get('q')) === '청년도약 장려금 2026' && (await inner.locator('#q').innerText()) === '청년도약 장려금 2026' && c.pages().length === 1, src1)
  await p.locator('[data-testid="dock-web-site"][data-id="bizinfo"]').click()
  await p.waitForTimeout(300)
  check('D12 바로 가기 [기업마당] → 판 안에(막지 않는 곳)', (await frame.getAttribute('src')) === 'https://www.bizinfo.go.kr/' && c.pages().length === 1)
  await shot(p, 'D12-web-bizinfo')
  const [pop1] = await Promise.all([c.waitForEvent('page'), p.locator('[data-testid="dock-web-side"][data-id="naver"]').click()])
  await pop1.waitForLoadState()
  await p.waitForTimeout(300)
  const withSide = await p.evaluate(() => ({ dock: document.querySelectorAll('[data-testid="side-dock"]').length, reserve: Number(document.querySelector('[data-side-reserve]')?.getAttribute('data-side-reserve') ?? 0), over: document.documentElement.scrollWidth - document.documentElement.clientWidth }))
  check('D13 [네이버 ↗](막는 곳) → 옆 창으로 · 옆 창이 오른쪽을 차지하는 동안 판은 비켜 줌(겹치지 않음) · 넘침 0', pop1.url() === 'https://www.naver.com/' && withSide.dock === 0 && withSide.reserve > 0 && withSide.over <= 0, { url: pop1.url(), withSide })
  await pop1.close()
  await p.getByTestId('side-dock').waitFor({ timeout: 5000 })
  check('D14 옆 창을 닫으면 판이 돌아오고 보던 곳(기업마당) 그대로', (await p.getByTestId('dock-web-frame').getAttribute('src')) === 'https://www.bizinfo.go.kr/' && (await p.locator('[data-side-reserve]').count()) === 0)
  await p.getByTestId('dock-web-address').fill('chatgpt.com')
  const [pop2] = await Promise.all([c.waitForEvent('page'), p.getByTestId('dock-web-go').click()])
  await pop2.waitForLoadState()
  check('D14b 주소 칸 "chatgpt.com" → 판에 넣지 않고 옆 창이 ChatGPT 로', pop2.url() === 'https://chatgpt.com/', pop2.url())
  await pop2.close()
  await p.getByTestId('side-dock').waitFor({ timeout: 5000 })
  await p.waitForTimeout(200)
  const dlg = []
  p.on('dialog', (d) => {
    dlg.push(d.message())
    d.dismiss()
  })
  await p.getByTestId('dock-web-address').fill('javascript:alert(1)')
  await p.getByTestId('dock-web-go').click()
  await p.waitForTimeout(300)
  const srcJs = await frame.getAttribute('src')
  check('D15 "javascript:…" → 실행 안 함 · Google 검색으로', srcJs.startsWith('https://www.google.com/search?') && dlg.length === 0, srcJs)
  const sb = await frame.getAttribute('sandbox')
  check('D16 판 안 사이트는 OS 화면을 바꾸지 못함(sandbox 에 top 이동 없음)', sb.includes('allow-scripts') && !sb.includes('allow-top-navigation'), sb)

  // 폭 — 끌기 · 키보드 · 두 번 누르기
  const hd = await p.getByTestId('dock-resize').boundingBox()
  await p.mouse.move(hd.x + hd.width / 2, hd.y + 300)
  await p.mouse.down()
  await p.mouse.move(hd.x + hd.width / 2 + 40, hd.y + 300, { steps: 4 })
  await p.mouse.move(hd.x + hd.width / 2 + 60, hd.y + 300, { steps: 2 })
  await p.mouse.up()
  await p.waitForTimeout(200)
  g = await geo()
  const dragged = g.dock
  await p.getByTestId('dock-resize').focus()
  await p.keyboard.press('ArrowRight')
  await p.waitForTimeout(100)
  const keyed = (await geo()).dock
  await p.keyboard.press('Home')
  await p.waitForTimeout(100)
  const homed = await geo()
  check(`D17 경계선 끌기 60px → ${dragged}px · 키보드 → 24px 좁게 · Home 320 · 본문이 따라 넓어짐 · 넘침 0`, dragged === 324 && keyed === 320 && homed.dock === 320 && homed.mainRight <= homed.dockX + 1 && homed.over <= 0, { dragged, keyed, homed })
  await p.getByTestId('dock-resize').dblclick()
  await p.waitForTimeout(150)
  check('D18 두 번 누르면 처음 폭(이 화면에서는 384 — 본문 768 남김)', (await geo()).dock === 384)
  check('D19 판 JS 오류 0', errs.length === 0, errs.join(' | '))

  // 좁은 PC — 덮어 띄움 · 휴대폰 — 없음 · 닫기
  await p.setViewportSize({ width: 1280, height: 800 })
  await p.waitForTimeout(300)
  g = await geo()
  check(`D20 1280 화면(메뉴 288) — 본문을 줄이지 않고 판을 덮어 띄움(${g.mode}) · 본문 비킴 0 · 넘침 0`, g.mode === 'over' && g.pad === '0px' && g.over <= 0 && g.hdr <= 0, g)
  await shot(p, 'D20-over-1280')
  await p.setViewportSize({ width: 1440, height: 900 })
  await p.getByTestId('dock-close').click()
  await p.waitForTimeout(200)
  g = await geo()
  check('D21 [닫기] → 판 없음 · 본문 비킴 0 · 다시 열어도 닫힘', g.dock === 0 && g.pad === '0px' && g.over <= 0, g)
  await p.reload({ waitUntil: 'networkidle' })
  check('D21b 다시 열어도 닫혀 있음', (await p.getByTestId('side-dock').count()) === 0)
  await c.close()

  const mc = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const mpg = await mc.newPage()
  await mpg.goto(BASE + '/', { waitUntil: 'networkidle' })
  await mpg.evaluate(seedScript())
  await mpg.evaluate(() => localStorage.setItem('axmvp.ui.side_dock', JSON.stringify({ open: true, tab: 'chat', width: 420 })))
  await mpg.goto(BASE + '/', { waitUntil: 'networkidle' })
  await mpg.waitForTimeout(400)
  const mo = await mpg.evaluate(() => ({ dock: document.querySelectorAll('[data-testid="side-dock"]').length, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }))
  check('D22 휴대폰(390) — 열어 둔 기억이 있어도 판 없음 · 넘침 0', mo.dock === 0 && mo.over <= 0, mo)
  await mc.close()
}

// 머리줄은 그대로 — 단추를 메뉴로 옮긴 까닭(머리줄에 두면 1024 · 1440 · 1600 · 1900 에서 넘쳤다)
const hdr = []
for (const width of [1024, 1440, 1600, 1920, 2300]) {
  const c = await browser.newContext({ viewport: { width, height: 900 }, locale: 'ko-KR' })
  const p = await c.newPage()
  await p.goto(BASE + '/', { waitUntil: 'networkidle' })
  await p.evaluate(seedScript())
  await p.goto(BASE + '/', { waitUntil: 'networkidle' })
  await p.waitForTimeout(400)
  const r = await p.evaluate(() => {
    const h = document.querySelector('header')
    return { hdr: h.scrollWidth - h.clientWidth, page: document.documentElement.scrollWidth - document.documentElement.clientWidth, fit: h.dataset.fit }
  })
  const vis = await p.getByTestId('side-ai-button').isVisible()
  hdr.push({ width, ...r, vis })
  await c.close()
}
check('S10 머리줄 넘침 0 · 화면 넘침 0 · 단추는 어느 폭에서나 메뉴에 보임 · 메뉴 기본 폭이면 머리줄에서 빼는 것 없음(1024 · 1440 · 1600 · 1920 · 2300)', hdr.every((h) => h.hdr <= 0 && h.page <= 0 && h.vis && h.fit === '0'), hdr)

// 노트북(1024) — 메뉴를 끝까지 넓혀도 본문 768px 남김(예전 폭 256 까지) · 큰 화면에서 넓혀 둔 440 도 줄여 보임
{
  const c = await browser.newContext({ viewport: { width: 1024, height: 768 }, locale: 'ko-KR' })
  const p = await c.newPage()
  await p.goto(BASE + '/', { waitUntil: 'networkidle' })
  await p.evaluate(seedScript())
  await p.evaluate(() => localStorage.setItem('axmvp.ui.nav.size', JSON.stringify({ mode: 'full', width: 440 })))
  await p.goto(BASE + '/', { waitUntil: 'networkidle' })
  await p.waitForTimeout(400)
  const r = await p.evaluate(() => ({ aside: Math.round(document.querySelector('aside[data-nav-mode]').getBoundingClientRect().width), main: Math.round(document.querySelector('main').getBoundingClientRect().width), over: document.documentElement.scrollWidth - document.documentElement.clientWidth }))
  check(`R11 1024 화면 — 넓혀 둔 440 도 ${r.aside}px 로(본문 ${r.main}px) · 넘침 0`, r.aside === 256 && r.over <= 0, r)
  await c.close()
}

// 휴대폰에는 없음(앱을 오가는 편이 빠르다)
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
const mp = await m.newPage()
await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
await mp.evaluate(seedScript())
await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
await mp.waitForTimeout(500)
const mVisible = await mp.getByTestId('side-ai-button').isVisible().catch(() => false)
const mOver = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
check('S9 휴대폰(390) — 단추 없음 · 넘침 0', !mVisible && mOver <= 0, { mVisible, mOver })
await m.close()

await browser.close()
console.log(`\nqa:sideai: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
