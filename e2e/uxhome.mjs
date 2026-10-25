/**
 * qa:uxhome — D-282 UI/UX 고도화(기능 · 데이터 · 권한 그대로, 보이는 모양만).
 *
 *   K  오늘 KPI 다섯 칸 — 화면이 센 숫자 그대로(오늘 할 일 = 제목 숫자 · 진행 중 고객사 = 보관 안 한 업체) · 누르면 그 목록
 *   L  바로가기 — 메뉴 줄 순서 · 주소 그대로 · 고객 관리 옆 계약 고객 수 · 누르면 그 화면
 *   S  사이드바 — 기능 색 아이콘 칸 · 지금 화면 강조 · 접으면 손을 올렸을 때 이름표(읽는 기계용 이름도)
 *   M  휴대폰 390 · 360 아주 큰 글자 — 큰 아이콘 바로가기가 KPI 위 · 아래 메뉴 5칸 + 더보기 그대로 · 넘침 0
 *   A  AI 전략실 — 회사 한눈에 '확인 필요 n칸' 접힘 → 펼치면 13칸 · 기억 · 자료 · 기록 탭 · 목적 카드 아이콘
 *   P  특허 · 벤처 — 회사 전 다섯 단계(회사 고르기가 지금) · 회사 고르면 준비 현황 안 다섯 단계(명세서 · 점검 · 사업계획서 칸 이름 · 상태 그대로)
 *   G  마케팅 — 목차 두 줄(콘텐츠 레이더 · 만들기) · 한 번에 나오는 형식 4 · 390 넘침 0
 *   T  화면 제목 아이콘 — 메뉴 이름인 화면(고객 관리)에는 있고, 업체 상세(업체 이름)에는 없음
 *   U  UXS-1 화면 문법 — AI 전략실 · 업체 작업실 · 특허 · 벤처 · 영업 보드가 같은 순서(머리 → 요약 → 지금 할 일 → 본문 판) ·
 *      머리 배경 그림 · '지금 할 일' 은 한 화면에 하나 · 요약 숫자 칸은 한 판(칸마다 상자 없음) · 휴대폰은 머리 → 지금 할 일 → 요약 · 넘침 0
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.UXHOME_SHOTS ?? ''
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
const num = (t) => Number((/(\d+)/.exec(t ?? '') ?? [])[1] ?? NaN)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(seedScript())
await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))
const clientsLs = () => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') || '[]'))

/* ---- K KPI ---- */
{
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.getByTestId('today-kpis').waitFor({ timeout: 10000 })
  await page.waitForTimeout(600)
  const ids = await page.getByTestId('today-kpis').locator('[data-testid^="kpi-"]').evaluateAll((els) => els.map((e) => e.dataset.testid))
  check('K1 KPI 다섯 칸(오늘 처리할 업무 · 진행 중 고객사 · 확인 필요 항목 · 최근 AI 작업 · 상담 · 후속)', JSON.stringify(ids) === '["kpi-todo","kpi-clients","kpi-decide","kpi-ai","kpi-follow"]', ids)
  const h1 = await page.locator('main h1').first().innerText()
  const todo = num(await page.getByTestId('kpi-todo').locator('strong').innerText())
  check('K2 오늘 처리할 업무 = 제목의 오늘 할 일 수(같은 셈)', todo === (/(\d+)건/.test(h1) ? num(h1) : 0), { h1, todo })
  const live = (await clientsLs()).filter((c) => !c.archivedAt).length
  const kc = num(await page.getByTestId('kpi-clients').locator('strong').innerText())
  check(`K3 진행 중 고객사 = 보관 안 한 업체 수(${live}) · 계약 · 잠재로 나눠 적음`, kc === live && /계약 \d+곳 · 잠재 \d+곳/.test(await page.getByTestId('kpi-clients').innerText()), kc)
  check("K4 최근 AI 작업 — 기록 없으면 '0건 · 지난 7일 실행 없음'(지어낸 숫자 없음)", (await page.getByTestId('kpi-ai').innerText()).includes('0건') && (await page.getByTestId('kpi-ai').innerText()).includes('지난 7일 실행 없음'))
  check('K5 상담 · 후속 — 새 상담신청 · 업체 약속 수를 함께 적음', /새 상담신청 \d+ · 업체 약속 \d+/.test(await page.getByTestId('kpi-follow').innerText()), await page.getByTestId('kpi-follow').innerText())
  const yK = (await page.getByTestId('today-kpis').boundingBox())?.y ?? 9e9
  const yTodo = (await page.locator('#today-todo-card').boundingBox())?.y ?? 0
  check('K6 KPI 는 할 일 칸보다 위(첫 화면에)', yK < yTodo && yK < 1000, { yK, yTodo })
  await shot(page, 'K-today-1440')
  await page.getByTestId('kpi-decide').click()
  await page.waitForURL(/\/ops\/decide/, { timeout: 8000 }).catch(() => {})
  check('K7 확인 필요 항목 → 확인할 것 화면', page.url().includes('/ops/decide'), page.url())
}

/* ---- L 바로가기 ---- */
{
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.getByTestId('app-launcher').waitFor({ timeout: 10000 })
  const tiles = await page.getByTestId('app-tile').evaluateAll((els) => els.map((e) => ({ k: e.dataset.key, h: e.getAttribute('href'), t: e.innerText })))
  check('L1 바로가기 8칸 — 고객 관리 · AI 전략실 · 특허 · 벤처 · 자금 · 지원사업 · 영업 관리 · 마케팅 · 브랜딩 · 일정 · 전체 도구', tiles.map((x) => x.k).join() === 'client-ops,ai-workspace,patent-venture,cat-growth,sales,marketing,calendar,tools', tiles.map((x) => x.k))
  check('L2 주소는 메뉴와 같음', tiles.map((x) => x.h).join() === '/ops/clients,/ai,/patent-venture,/modules/growth,/sales/board,/marketing,/ops/calendar,/tools', tiles.map((x) => x.h))
  const contract = (await clientsLs()).filter((c) => !c.archivedAt && c.status !== 'waiting').length
  check(`L3 고객 관리 칸에 계약 고객 수(${contract}) — 메뉴 숫자와 같음`, tiles[0].t.includes(String(contract)) && (await page.locator('aside [data-nav-badge="clients"]').first().innerText()).trim() === String(contract), tiles[0].t)
  await page.locator('[data-testid="app-tile"][data-key="cat-growth"]').click()
  await page.waitForURL(/\/modules\/growth/, { timeout: 8000 }).catch(() => {})
  check('L4 자금 · 지원사업 → 기업성장 모듈(정책자금 · 고용 · 연구소 · 공고)', page.url().includes('/modules/growth'), page.url())
}

/* ---- S 사이드바 ---- */
{
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  const link = page.locator('aside nav a[href="/ops/clients"]').first()
  const tileCls = await link.locator('span.size-8').first().getAttribute('class')
  check('S1 메뉴 줄 아이콘 칸(32px) · 지금 화면 강조(aria-current) · 흰 칸', (tileCls ?? '').includes('size-8') && (await link.getAttribute('aria-current')) === 'page' && (tileCls ?? '').includes('bg-white/20'), tileCls)
  const other = await page.locator('aside nav a[href="/ops/calendar"] span.size-8').first().getAttribute('class')
  check('S2 다른 줄은 기능 색 옅은 칸(일정 = 청록)', (other ?? '').includes('bg-teal-400/15') && (other ?? '').includes('text-teal-300'), other)
  await page.getByRole('button', { name: '사이드바 접기' }).click()
  await page.waitForTimeout(400)
  const cLink = page.locator('aside nav a[href="/ops/calendar"]').first()
  await cLink.hover()
  await page.waitForTimeout(250)
  const tip = page.getByTestId('nav-tip')
  check("S3 접은 메뉴에 손을 올리면 이름표 '일정' · 링크 이름도 '일정'", (await tip.isVisible()) && (await tip.innerText()).trim() === '일정' && (await cLink.getAttribute('aria-label')) === '일정')
  await shot(page, 'S-collapsed-tip')
  await page.getByRole('button', { name: '사이드바 펼치기' }).click()
  await page.waitForTimeout(300)
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
  await m.goto(BASE + '/', { waitUntil: 'networkidle' })
  await m.getByTestId('today-kpis').waitFor({ timeout: 10000 }).catch(() => {})
  const over = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  const yL = (await m.getByTestId('today-launcher').boundingBox())?.y ?? 9e9
  const yK = (await m.getByTestId('today-kpis').boundingBox())?.y ?? 0
  const n = await m.getByTestId('app-tile').count()
  const bottom = await m.locator('nav[aria-label="주요 화면"]').locator('a, button').count()
  check(`M ${w}${scale ? ' 아주 큰 글자' : ''} — 큰 아이콘 바로가기(${n}칸)가 KPI 위 · 아래 메뉴 6칸(5 + 더보기) 그대로 · 넘침 0`, over <= 0 && yL < yK && n === 8 && bottom === 6, { over, yL, yK, n, bottom })
  await shot(m, `M-today-${w}${scale ? '-xl' : ''}`)
  await m.evaluate(() => {
    const k = 'axmvp.ui.preferences'
    const p = JSON.parse(localStorage.getItem(k) || '{}')
    delete p.textScale
    localStorage.setItem(k, JSON.stringify(p))
  })
  await m.close()
}

/* ---- A AI 전략실 ---- */
let caseUrl = ''
{
  await page.goto(BASE + '/ai', { waitUntil: 'networkidle' })
  await page.getByTestId('case-quick').waitFor()
  await page.getByTestId('case-quick-client').first().click()
  await page.waitForURL(/\/ai\/cases\//, { timeout: 10000 })
  await page.getByTestId('case-workspace').waitFor()
  caseUrl = new URL(page.url()).pathname
  await page.waitForTimeout(500)
  const missing = page.getByTestId('snapshot-missing')
  const hiddenBefore = await page.locator('[data-snapshot][data-missing]').evaluateAll((els) => els.filter((e) => e.offsetParent === null).length)
  check("A1 회사 한눈에 — 모르는 칸은 '확인 필요 n칸(미확인)' 한 줄로 접힘 · 13칸은 그대로 있음", (await missing.isVisible()) && /확인 필요 \d+칸/.test(await missing.innerText()) && hiddenBefore > 0 && (await page.locator('[data-snapshot]').count()) === 13, { hiddenBefore })
  await missing.click()
  const hiddenAfter = await page.locator('[data-snapshot]').evaluateAll((els) => els.filter((e) => e.offsetParent === null).length)
  check('A2 펼치면 13칸 모두 보임', hiddenAfter === 0, hiddenAfter)
  const tabs = await page.locator('[data-side-tab]').evaluateAll((els) => els.map((e) => e.dataset.sideTab))
  check('A3 오른쪽 칸 탭 — 기억 · 자료 · 기록(처음은 기억)', tabs.join() === 'memory,materials,timeline' && (await page.locator('#case-side-memory').isVisible()) && !(await page.locator('#case-side-materials').isVisible()))
  await page.locator('[data-side-tab="materials"]').click()
  check('A4 자료 탭 → 자료 칸(파일 · 홈페이지 · 붙여넣기 · 메모) 보임 · 기억 칸 숨김', (await page.getByTestId('material-memo').isVisible()) && !(await page.locator('#case-side-memory').isVisible()))
  await page.locator('[data-side-tab="timeline"]').click()
  check('A5 기록 탭 → 타임라인', await page.getByTestId('case-timeline').isVisible())
  const purposeIcons = await page.getByTestId('case-purpose').evaluateAll((els) => els.map((e) => !!e.querySelector('svg')))
  check('A6 목적 카드 3개 — 각각 아이콘', purposeIcons.length === 3 && purposeIcons.every(Boolean), purposeIcons)
  await shot(page, 'A-case-1440')
}

/* ---- P 특허 · 벤처 ---- */
{
  await page.goto(BASE + '/patent-venture', { waitUntil: 'networkidle' })
  await page.getByTestId('pv-steps').waitFor({ timeout: 10000 })
  const st = await page.getByTestId('pv-steps').locator('li[data-step]').evaluateAll((els) => els.map((e) => `${e.dataset.step}:${e.dataset.state}`))
  check('P1 회사 고르기 전 — 다섯 단계 · 회사 고르기가 지금 단계', st.join() === 'company:current,idea:todo,spec:todo,check:todo,plan:todo', st)
  await page.goto(BASE + '/patent-venture?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.getByTestId('pv-brief').waitFor({ timeout: 10000 })
  const li = await page.getByTestId('pv-brief-steps').locator('li[data-step]').count()
  const brief = await page.getByTestId('pv-brief-step').evaluateAll((els) => els.map((e) => `${e.dataset.key}:${e.dataset.state}`))
  check('P2 회사를 고르면 준비 현황 안 다섯 단계 · 명세서 · 점검 · 사업계획서 칸 이름 · 상태 낱말 그대로 · 위 단계 줄은 없음', li === 5 && brief.join() === 'spec:todo,check:todo,plan:todo' && (await page.getByTestId('pv-steps').count()) === 0, { li, brief })
  await shot(page, 'P-brief-1440')
}

/* ---- G 마케팅 ---- */
{
  await page.goto(BASE + '/marketing', { waitUntil: 'networkidle' })
  await page.getByTestId('mk-tabs').waitFor({ timeout: 10000 })
  const t = await page.getByTestId('mk-tabs').innerText()
  check("G1 마케팅 목차 두 줄 — '콘텐츠 레이더' · '만들기'", t.includes('콘텐츠 레이더') && t.includes('만들기'))
  check('G2 이번 주 키워드 — 한 번에 나오는 형식 4(유튜브 대본 · 릴스 · 블로그 · 카드뉴스)', (await page.getByTestId('mk-formats').locator('li').count()) === 4)
  const m = await ctx.newPage()
  await m.setViewportSize({ width: 390, height: 844 })
  await m.goto(BASE + '/marketing', { waitUntil: 'networkidle' })
  await m.waitForTimeout(600)
  const over = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('G3 390 — 넘침 0', over <= 0, over)
  await shot(m, 'G-marketing-390')
  await m.close()
}

/* ---- T 화면 제목 아이콘 ---- */
{
  const tileNextToH1 = () => page.evaluate(() => {
    const h = document.querySelector('main h1')
    let box = h?.parentElement
    for (let i = 0; i < 3 && box; i++, box = box.parentElement) {
      if (box.querySelector(':scope > span > span.size-12, :scope > span.size-12')) return true
    }
    return false
  })
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const a = await tileNextToH1()
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const b = await tileNextToH1()
  check('T1 고객 관리 제목 앞 기능 아이콘 · 업체 상세(업체 이름 제목)에는 없음', a && !b, { a, b })
}

/* ---- U UXS-1 화면 문법 ---- */
{
  // [이름, 주소, 머리 그림, 요약, 지금 할 일, 본문 판, 요약이 숫자 칸(KpiCard) 줄인가]
  const screens = [
    ['AI 전략실', '/ai', 'ai', 'ai-summary', 'ai-next', 'case-list-panel', true],
    ['업체 작업실', caseUrl, 'ai', 'snapshot-fields', 'case-next', 'case-purposes', false],
    ['특허 · 벤처', '/patent-venture?client=cli_hansol', 'patent-venture', 'pv-brief', 'pv-next', 'chat-panel', false],
    ['영업 보드', '/sales/board', 'sales', 'sales-summary', 'sales-next', 'sales-board-panel', true],
  ]
  const layout = (pg, ids) =>
    pg.evaluate((ids) => {
      const top = (id) => {
        const el = document.querySelector(`[data-testid="${id}"]`)
        return el ? Math.round(el.getBoundingClientRect().top + scrollY) : null
      }
      const hero = document.querySelector('main [data-hero]')
      const art = hero?.querySelector('[data-hero-art]')
      const kpi = document.querySelector(`[data-testid="${ids[1]}"] > *`)
      return {
        hero: hero ? Math.round(hero.getBoundingClientRect().top + scrollY) : null,
        heroArt: hero?.dataset.hero ?? null,
        artShown: !!art && art.offsetWidth > 100 && /url\(/.test(getComputedStyle(art).backgroundImage),
        summary: top(ids[1]),
        next: top(ids[2]),
        panel: top(ids[3]),
        nextBars: document.querySelectorAll('main [data-frame="next"]').length,
        kpiBorder: kpi ? getComputedStyle(kpi).borderTopWidth : null,
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    }, ids)
  for (const [name, url, art, summary, next, panel, kpis] of screens) {
    await page.goto(BASE + url, { waitUntil: 'networkidle' })
    await page.getByTestId(next).waitFor({ timeout: 10000 })
    await page.waitForTimeout(400)
    const L = await layout(page, [art, summary, next, panel])
    check(
      `U ${name} 1440 — 머리(그림 '${art}') → 요약 → 지금 할 일 → 본문 판 순서 · 지금 할 일 하나${kpis ? ' · 숫자 칸은 한 판(칸 테두리 0)' : ''}`,
      L.heroArt === art && L.artShown && L.hero < L.summary && L.summary < L.next && L.next < L.panel && L.nextBars === 1 && (!kpis || L.kpiBorder === '0px') && L.over <= 0,
      L,
    )
  }
  const m = await ctx.newPage()
  await m.setViewportSize({ width: 390, height: 844 })
  for (const [name, url, art, summary, next, panel] of screens) {
    await m.goto(BASE + url, { waitUntil: 'networkidle' })
    await m.getByTestId(next).waitFor({ timeout: 10000 })
    await m.waitForTimeout(400)
    const L = await layout(m, [art, summary, next, panel])
    check(`U ${name} 390 — 머리 → 지금 할 일 → 요약 → 본문 판 · 그림 대신 옅은 빛 · 넘침 0`, L.hero < L.next && L.next < L.summary && L.summary < L.panel && !L.artShown && L.over <= 0, L)
  }
  await m.close()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.getByTestId('today-kpis').waitFor({ timeout: 10000 })
  const home = await page.evaluate(() => {
    const hero = document.querySelector('[data-testid="today-hero"]')
    const art = hero?.querySelector('[data-hero-art]')
    return { art: hero?.dataset.hero ?? null, shown: !!art && art.offsetWidth > 100 }
  })
  check("U 오늘 — 웰컴 띠에 머리 그림 'home'", home.art === 'home' && home.shown, home)
}

check('오류 0', errors.length === 0, errors)
await browser.close()
console.log(`\nuxhome: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
