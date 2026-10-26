/**
 * 휴대폰 화면 점검 (D-166) — 실제처럼 긴 이름 · 많은 공고로 주요 화면 전부를 360 · 390 · 430 에서 연다.
 *
 *   node e2e/phone.mjs <baseUrl> [스크린샷 폴더]
 *
 * 왜 따로 있나:
 *   qa:real 은 '가로로 넘치는가 · 칸 밖으로 잘리는가' 를 본다. 그런데 대표가 휴대폰에서 본 지원사업 갈래 칩은
 *   넘치지도 잘리지도 않고 **칩이 줄어들어 글자가 서로 겹쳤다**(가로로 미는 줄 안이라 검사에서 빠졌다).
 *   여기서는 그런 것 — 글자가 자기 칸보다 넓은 것 · 아주 좁게 짜부라진 것 · 칩끼리 겹친 것 — 을 숫자로 잡는다.
 *
 * 판정(화면마다):
 *   1. 문서가 옆으로 넘치지 않는다
 *   2. 한 줄 글자(줄바꿈 없음)가 자기 칸보다 넓지 않다 — 말줄임(…) · 일부러 미는 줄 안의 표는 뺀다
 *   3. 4글자 넘는 글이 40px 보다 좁은 칸에 갇혀 세로로 늘어지지 않는다(짜부라짐)
 *   4. 가로 칩 줄의 칩이 서로 겹치지 않는다
 *   5. 화면 오류 · JS 오류 없음
 *
 * D-286 보기 방식(휴대폰에서도 PC · Mobile · PC+Mobile) — 서랍 세 칸 · PC 칸 하나(1200 배치) · 세로면 위 PC 아래 휴대폰 ·
 *   가로면 나란히 · Mobile 로 돌아오면 본 화면 · 휴대폰에서 고른 값은 PC 에 번지지 않음
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.argv[3] ?? ''
let pass = 0
let fail = 0
const check = (name, ok, detail) => {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ' — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail))}`)
}

// qa:real 의 긴 자료(긴 업체 이름 · 주소 · 많은 수금 줄)를 그대로 쓴다
const realSrc = fs.readFileSync(new URL('./real.mjs', import.meta.url), 'utf8')
const at = realSrc.indexOf('const LONG_DATA = `') + 'const LONG_DATA = `'.length
const LONG_DATA = realSrc.slice(at, realSrc.indexOf('`', at))

// 기업마당 공고 300건 — 갈래 여덟 · 긴 이름(실제처럼)
const ymd8 = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
const CATS = ['기술', '인력', '수출', '창업', '경영', '내수', '금융', '기타']
const FEED = Array.from({ length: 300 }, (_, i) => ({
  pblancId: `PBLN_${i}`,
  pblancNm: `2026년 ${['경기도', '서울특별시', '부산광역시', '전국'][i % 4]} 중소기업 ${['스마트공장 구축 고도화 지원사업', '수출바우처 해외마케팅 지원', '청년 인력 채용 장려금', '창업 초기 사업화 자금 지원(예비·초기창업패키지)'][i % 4]} ${i}차 공고`,
  jrsdInsttNm: '중소벤처기업부',
  excInsttNm: '중소기업기술정보진흥원',
  reqstBeginEndDe: `${ymd8(-5)} ~ ${ymd8((i % 40) + 1)}`,
  pldirSportRealmLclasCodeNm: CATS[i % CATS.length],
  trgetNm: '중소기업',
  bsnsSumryCn: '지원 내용',
  pblancUrl: `https://www.bizinfo.go.kr/x?pblancId=PBLN_${i}`,
  hashtags: '제조',
  creatPnttm: '',
}))

const SCREENS = [
  '/',
  '/ops/clients',
  '/ops/clients/cli_hansol',
  '/ops/clients/cli_hansol?tab=overview',
  '/ops/clients/cli_hansol?tab=work',
  '/ops/clients/cli_hansol?tab=docs',
  '/ops/clients/cli_hansol?tab=fees',
  '/ops/clients/cli_hansol?tab=funding',
  '/ops/calendar',
  '/ops/inbox',
  '/journal',
  '/ops/decide',
  '/money',
  '/sales/board',
  '/sales/meeting?client=cli_long_3&round=2',
  '/grants',
  '/grants?view=clients',
  '/grants?view=applying',
  '/tools',
  '/tools/policy-funding',
  '/tools/policy-funding/diagnosis?client=cli_hansol',
  '/tools/employment',
  '/tools/labcare/assessment?client=cli_hansol',
  '/tools/startup-tax/judge?client=cli_hansol',
  '/tools/cretop?client=cli_hansol',
  '/tools/tax?client=cli_hansol',
  '/tools/tax?m=calc&c=t9',
  '/settings',
]

const DETECT = `(() => {
  const vw = document.documentElement.clientWidth
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden' }
  const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()
  const inScroller = (el) => { let a = el.parentElement; while (a && a !== document.body) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll') return a; a = a.parentElement } return null }
  const wide = []
  const squish = []
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue
    const t = ownText(el)
    if (!t) continue
    const cs = getComputedStyle(el)
    if (cs.textOverflow === 'ellipsis' || cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue
    const r = el.getBoundingClientRect()
    // 2. 한 줄 글자가 자기 칸보다 넓다(겹침 · 삐져나옴)
    if (cs.whiteSpace === 'nowrap' && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && !el.closest('table')) wide.push(t.slice(0, 18) + ' ' + el.clientWidth + '<' + el.scrollWidth)
    // 3. 짜부라짐 — 4글자 넘는 글이 40px 보다 좁은 칸에서 세 줄 넘게
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4
    if (t.replace(/\\s/g, '').length > 4 && r.width < 40 && r.height > lh * 3) squish.push(t.slice(0, 18) + ' w=' + Math.round(r.width))
  }
  // 4. 칩 줄 — 이웃한 칩이 겹치면
  const overlap = []
  for (const row of document.querySelectorAll('[data-testid="grant-categories"], [role="tablist"]')) {
    const kids = [...row.children].filter(visible)
    for (let i = 1; i < kids.length; i++) {
      const a = kids[i - 1].getBoundingClientRect(), b = kids[i].getBoundingClientRect()
      if (Math.abs(a.top - b.top) < 4 && a.right > b.left + 1) overlap.push((kids[i].innerText || '').trim().slice(0, 10))
    }
  }
  return { sw: document.documentElement.scrollWidth, vw, wide: [...new Set(wide)].slice(0, 5), squish: [...new Set(squish)].slice(0, 5), overlap: overlap.slice(0, 5), err: !!document.querySelector('[data-testid="screen-error"]') }
})()`

const VIEWPORTS = [
  { tag: '390', width: 390 },
  { tag: '360', width: 360 },
  { tag: '430', width: 430 },
]

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: 844 }, locale: 'ko-KR', isMobile: true, hasTouch: true, deviceScaleFactor: SHOTS && vp.tag === '390' ? 2 : 1 })
  await ctx.route('**/api/grants-feed*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: FEED, fetchedAt: new Date().toISOString(), total: FEED.length }) }))
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(LONG_DATA)
  for (const path of SCREENS) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    const r = await page.evaluate(DETECT)
    check(`[${vp.tag}] ${path}: 옆으로 넘치지 않음 · 오류 없음`, r.sw <= r.vw + 1 && !r.err, `${r.sw}/${r.vw}${r.err ? ' 화면 오류' : ''}`)
    check(`[${vp.tag}] ${path}: 글자가 칸보다 넓지 않음 · 짜부라짐 · 칩 겹침 없음`, r.wide.length + r.squish.length + r.overlap.length === 0, { wide: r.wide, squish: r.squish, overlap: r.overlap })
    if (SHOTS && vp.tag === '390') await page.screenshot({ path: `${SHOTS}/${path.replace(/[/?=&]+/g, '_').replace(/^_|_$/g, '') || 'today'}.png`, fullPage: true })
  }
  // 지원사업 알림 — 갈래 칩이 줄어들지 않는다(대표가 휴대폰에서 본 겹침)
  await page.goto(BASE + '/grants', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const chips = await page.evaluate(() => [...document.querySelectorAll('[data-testid="grant-categories"] > button')].map((b) => ({ w: b.clientWidth, sw: b.scrollWidth, h: b.getBoundingClientRect().height })))
  check(`[${vp.tag}] 지원사업 갈래 칩: 다섯 개 이상 · 글자가 칩 안에 · 동그랗게 눌리지 않음`, chips.length >= 5 && chips.every((c) => c.sw <= c.w + 1 && c.w > c.h), chips.filter((c) => !(c.sw <= c.w + 1 && c.w > c.h)).concat([{ n: chips.length }]))
  check(`[${vp.tag}] JS 오류 없음`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}
/* ---- D-286 보기 방식 — 휴대폰에서도 PC · Mobile · PC+Mobile ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  // D-290 왼쪽 아래(서랍)는 이름 · 로그아웃만 — 보기 방식은 설정 › 계정 · 보기로
  await page.goto(BASE + '/sales/board', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '메뉴 열기' }).click()
  await page.waitForTimeout(400)
  const drawerBottom = await page.locator('[data-testid="sidebar-account"]:visible').first().evaluate((el) => el.parentElement?.innerText ?? '').catch(() => '')
  check('[D-290] 390 서랍 아래 — 이름 한 줄뿐(로컬 모드라 로그아웃 없음 · 보기 방식 · 대표/팀장 · 피드백 · 고객 플랫폼 없음)', (await page.getByTestId('drawer-device').count()) === 0 && (await page.locator('[data-testid="device-switch"]:visible').count()) === 0 && (await page.getByTestId('sidebar-portal-link').count()) === 0 && /김상호/.test(drawerBottom) && drawerBottom.trim().split('\n').filter(Boolean).length <= 2, drawerBottom)
  await page.keyboard.press('Escape')
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
  await page.getByTestId('settings-account-view').waitFor({ timeout: 10000 })
  const sw = page.getByTestId('settings-device').getByTestId('device-switch')
  const opts = await sw.locator('[data-mode]').evaluateAll((els) => els.map((e) => ({ m: e.dataset.mode, on: e.getAttribute('aria-checked'), clip: [...e.querySelectorAll('span')].some((t) => t.scrollWidth > t.clientWidth + 1) })))
  check('[보기 방식] 390 설정 › 계정 · 보기에 PC · Mobile · PC+Mobile · 지금은 Mobile · 글자 잘림 없음', opts.map((o) => o.m).join() === 'pc,mobile,dual' && opts.find((o) => o.m === 'mobile')?.on === 'true' && opts.every((o) => !o.clip), opts)
  await sw.locator('[data-mode="pc"]').click()
  await page.getByTestId('pc-stage').waitFor({ timeout: 10000 })
  await page.waitForTimeout(2500)
  const pcIn = page.frameLocator('[data-testid="pc-frame"] iframe')
  const pcW = await pcIn.locator('body').evaluate(() => innerWidth).catch(() => 0)
  const pcAside = await pcIn.locator('aside').first().isVisible().catch(() => false)
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  check('[보기 방식] PC — PC 칸 하나 · 안 화면은 PC 배치(폭 1200 · 사이드바 보임) · 휴대폰 폭에 맞춤(넘침 0) · 주소 그대로', pcW === 1200 && pcAside && over <= 0 && page.url().endsWith('/settings'), { pcW, pcAside, over, url: page.url() })
  await page.getByTestId('device-switch').locator('[data-mode="dual"]').click()
  await page.getByTestId('dual-view').waitFor({ timeout: 10000 })
  await page.waitForTimeout(3000)
  const lay = await page.evaluate(() => {
    const pc = document.querySelector('[data-testid="dual-pc"]')?.getBoundingClientRect()
    const ph = document.querySelector('[data-testid="device-frame"]')?.getBoundingClientRect()
    return { layout: document.querySelector('[data-testid="dual-view"]')?.getAttribute('data-layout'), pcBottom: pc ? Math.round(pc.bottom) : null, phTop: ph ? Math.round(ph.top) : null, phRight: ph ? Math.round(ph.right) : null, vw: innerWidth }
  })
  const moIn = page.frameLocator('[data-testid="device-frame"] iframe')
  const moW = await moIn.locator('body').evaluate(() => innerWidth).catch(() => 0)
  const moSw = await moIn.locator('[data-testid="device-switch"]').count().catch(() => -1)
  check('[보기 방식] PC+Mobile 세로 — 위 PC · 아래 휴대폰(안은 진짜 390) · 휴대폰 칸 안에 보기 단추 없음(재귀 없음) · 화면 안', lay.layout === 'stack' && lay.pcBottom <= lay.phTop && lay.phRight <= lay.vw && moW === 390 && moSw === 0, { ...lay, moW, moSw })
  await page.setViewportSize({ width: 844, height: 390 })
  await page.waitForTimeout(1500)
  const side = await page.evaluate(() => {
    const pc = document.querySelector('[data-testid="dual-pc"]')?.getBoundingClientRect()
    const ph = document.querySelector('[data-testid="device-frame"]')?.getBoundingClientRect()
    return { layout: document.querySelector('[data-testid="dual-view"]')?.getAttribute('data-layout'), pcRight: pc ? Math.round(pc.right) : null, phLeft: ph ? Math.round(ph.left) : null, phBottom: ph ? Math.round(ph.bottom) : null, vh: innerHeight }
  })
  check('[보기 방식] PC+Mobile 가로(844×390) — 왼쪽 PC · 오른쪽 휴대폰 · 화면 안', side.layout === 'side' && side.pcRight <= side.phLeft && side.phBottom <= side.vh, side)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(800)
  await page.getByTestId('device-switch').locator('[data-mode="mobile"]').first().click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  const back = { stage: await page.locator('[data-testid="dual-view"], [data-testid="pc-stage"]').count(), menu: await page.getByRole('button', { name: '메뉴 열기' }).count(), keys: await page.evaluate(() => [localStorage.getItem('axmvp.ui.device_view_narrow'), localStorage.getItem('axmvp.ui.device_view')]) }
  check("[보기 방식] Mobile — 본 화면으로(무대 없음 · 메뉴 단추) · 휴대폰 값만 'mobile' · PC 값은 손대지 않음", back.stage === 0 && back.menu === 1 && back.keys[0] === 'mobile' && back.keys[1] === null && page.url().endsWith('/settings'), back)
  check('[보기 방식] JS 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
  // 휴대폰에서 PC+Mobile 을 골라 둔 채 PC(1440)로 열어도 PC 는 늘 보던 화면
  const pc = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const pp = await pc.newPage()
  await pp.goto(BASE + '/', { waitUntil: 'networkidle' })
  await pp.evaluate(() => localStorage.setItem('axmvp.ui.device_view_narrow', 'dual'))
  await pp.goto(BASE + '/sales/board', { waitUntil: 'networkidle' })
  await pp.waitForTimeout(800)
  const pcState = { stage: await pp.locator('[data-testid="dual-view"], [data-testid="pc-stage"], [data-testid="mobile-stage"]').count(), on: await pp.locator('header [data-testid="device-switch-compact"] button[aria-haspopup]').getAttribute('aria-label').catch(() => null) }
  check('[보기 방식] 휴대폰에서 고른 값은 PC 에 번지지 않음(1440 — 무대 없음 · PC 선택)', pcState.stage === 0 && pcState.on === '보기 방식: PC', pcState)
  // D-290 PC 머리줄 — 자리가 있으면 'PC · Mobile · PC+Mobile' 글자 · 모자라면 글자부터 빼고 넓은 찾기 칸은 지킨다 · 넘침 0
  const hdrAt = async (w) => {
    await pp.setViewportSize({ width: w, height: 900 })
    await pp.waitForTimeout(500)
    return pp.evaluate(() => {
      const h = document.querySelector('header')
      const vis = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null)
      const sw = vis('header [data-testid="device-switch"]')[0]
      const cp = vis('header [data-testid="device-switch-compact"]')[0]
      return { w: innerWidth, fit: h?.dataset.fit, over: h ? h.scrollWidth - h.clientWidth : 99, sw: sw ? sw.innerText.replace(/\s+/g, ' ').trim() : null, compact: cp ? cp.innerText.trim() : null, wideSearch: vis('header .hdr-wide-search').length }
    })
  }
  const hdrs = [await hdrAt(1280), await hdrAt(1440), await hdrAt(1600), await hdrAt(1920)]
  // D-296 대표 "PC 랑 모바일 선택하는 건 접어 두고 클릭해서" — 모든 PC 폭에서 단추 하나(지금 이름 ▾)
  check('[D-290 · D-296] PC 머리줄 보기 방식 — 1280~1920 모두 접힌 단추 하나에 지금 이름(PC) · 세 단추 줄 없음 · 넓은 찾기 칸 유지(1440+) · 넘침 0', hdrs.every((h) => h.compact === 'PC' && h.sw === null && h.over <= 0) && hdrs.slice(1).every((h) => h.wideSearch === 1), hdrs)
  await pc.close()
  // 360 · 글자 '매우 크게' — 설정 세 칸 글자가 잘리지 않는다(아이콘을 빼고 글자만)
  const xl = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
  const xp = await xl.newPage()
  await xp.goto(BASE + '/', { waitUntil: 'networkidle' })
  await xp.evaluate(seedScript())
  await xp.evaluate(() => {
    const k = 'axmvp.ui.preferences'
    const v = JSON.parse(localStorage.getItem(k) || '{}')
    v.textScale = 'extra_large'
    localStorage.setItem(k, JSON.stringify(v))
  })
  await xp.goto(BASE + '/settings', { waitUntil: 'networkidle' })
  await xp.getByTestId('settings-device').waitFor({ timeout: 10000 })
  const xlOpts = await xp.getByTestId('settings-device').locator('[data-mode]').evaluateAll((els) => els.map((e) => ({ m: e.dataset.mode, clip: [...e.querySelectorAll('span')].some((t) => t.scrollWidth > t.clientWidth + 1), r: Math.round(e.getBoundingClientRect().right) })))
  const drawerRight = await xp.getByTestId('settings-device').evaluate((e) => Math.round(e.getBoundingClientRect().right))
  check('[보기 방식] 360 · 글자 매우 크게 — 설정 세 칸 글자 잘림 없음 · 칸 밖으로 안 나감 · 가로 넘침 0', xlOpts.length === 3 && xlOpts.every((o) => !o.clip && o.r <= drawerRight + 1) && (await xp.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, { xlOpts, drawerRight })
  await xl.close()
}

await browser.close()
console.log(`\n휴대폰 화면: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
