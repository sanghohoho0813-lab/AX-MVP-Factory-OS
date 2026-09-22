/**
 * 껍데기 시험 — 메뉴 재분류(D-86) · 최상단 시계 · 로고 · 검색 자리(D-87).
 *
 * 사이드바는 1024px 이상에서만 보이고 휴대폰에서는 서랍으로 열린다. 그래서 두 폭에서 본다.
 *   node e2e/shell.mjs http://localhost:4390
 */
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' ' + detail}`)
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- 데스크톱 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)

  const nav = page.getByRole('navigation', { name: '주 메뉴' })
  const navText = (await nav.innerText()) ?? ''
  const at = (t) => navText.indexOf(t)
  check('메뉴: 오늘과 일정이 한 묶음', at('오늘') >= 0 && at('일정') > at('오늘') && at('일정') < at('고객 운영'), navText.slice(0, 160))
  check('메뉴: 도구함이 고객 다음', at('도구함') > at('고객 운영') && at('도구함') < at('가끔 쓰는 것'), navText.slice(0, 260))
  check('메뉴: 잘 안 쓰는 것은 접힌 묶음 안', at('가끔 쓰는 것') > 0 && at('컨설팅 작업실') === -1, navText.slice(0, 320))
  check('메뉴: 세금 계산기가 사이드바에 있다', at('세금 계산기') > 0)
  check('메뉴: AX STUDIO 는 그 아래', at('AX STUDIO') > at('가끔 쓰는 것'))
  check('메뉴: 설정이 맨 아래', at('설정') > at('이 시스템'))

  await nav.getByRole('button', { name: /가끔 쓰는 것/ }).click()
  await page.waitForTimeout(400)
  const opened = (await nav.innerText()) ?? ''
  check('메뉴: 펴면 넷이 다 나온다', ['컨설팅 작업실', '자금·지원사업', '오늘 기록', '주간 돌아보기'].every((t) => opened.includes(t)), opened.slice(0, 320))

  // 시계 — 날짜 + 초, 1초마다 움직인다
  const clock = page.locator('header [aria-label^="지금 "]:visible').first()
  const label = await clock.getAttribute('aria-label')
  check('시계: 날짜와 초까지', /^지금 \d{4}년 \d{1,2}월 \d{1,2}일 \([일월화수목금토]\) \d{2}:\d{2}:\d{2}$/.test(label ?? ''), String(label))
  const t1 = (await clock.innerText()) ?? ''
  check('시계: 화면에 초가 보인다', /\d{2}:\d{2}:\d{2}/.test(t1), t1)
  await page.waitForTimeout(1400)
  check('시계: 1초마다 움직인다', ((await clock.innerText()) ?? '') !== t1, t1)

  // 시계는 고객 플랫폼 단추 왼쪽
  const clockBox = await clock.boundingBox()
  const portalBox = await page.getByRole('link', { name: /고객 플랫폼/ }).first().boundingBox()
  check('시계: 고객 플랫폼 왼쪽에 있다', clockBox && portalBox && clockBox.x < portalBox.x, JSON.stringify({ clockBox, portalBox }))
  check('시계: 글자가 크다(16px 이상)', (await clock.locator('span').last().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))) >= 16)

  // 로고 1.5배 (32 → 48px)
  const logoH = await page.locator('aside img').first().evaluate((el) => el.getBoundingClientRect().height)
  check('로고: 48px 로 커졌다', Math.round(logoH) === 48, String(logoH))

  // 검색 — 왼쪽, 좁게
  const search = page.getByRole('button', { name: /검색/ }).first()
  const sBox = await search.boundingBox()
  const hBox = await page.locator('header').boundingBox()
  // 머리띠는 사이드바 오른쪽에서 시작하므로 가운데는 hBox.x + hBox.width / 2 다 (x 를 빼먹으면 늘 실패한다)
  check('검색: 머리띠 왼쪽 절반에 있다',
    sBox && hBox && sBox.x + sBox.width / 2 < hBox.x + hBox.width / 2,
    JSON.stringify({ search: sBox, headerMid: hBox && Math.round(hBox.x + hBox.width / 2) }))
  check('검색: 폭이 352px 이하', sBox && sBox.width <= 352, String(sBox?.width))

  // 도구함
  await page.goto(BASE + '/tools', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const tools = (await page.locator('main').innerText()) ?? ''
  check('도구함: 세금 계산기가 먼저', tools.indexOf('세금 계산기') > 0 && tools.indexOf('세금 계산기') < tools.indexOf('기업인증 OS'), tools.slice(0, 260))
  check('도구함: 앞으로 붙을 것을 적어 둔다', tools.includes('기업인증 OS') && tools.includes('크레탑 OS') && tools.includes('아직 없음'))
  check('도구함: 아직 없는 것은 누를 수 없다', (await page.getByRole('link', { name: /기업인증 OS/ }).count()) === 0)
  await page.getByRole('link', { name: /세금 계산기/ }).first().click()
  await page.waitForTimeout(700)
  check('도구함: 세금 계산기로 간다', page.url().includes('/tools/tax'), page.url())
  await ctx.close()
}

/* ---------------- 휴대폰 390 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)

  const clock = page.locator('header [aria-label^="지금 "]:visible').first()
  check('휴대폰 시계: 머리띠에 보인다', (await clock.count()) === 1)
  check('휴대폰 시계: 시각만 (날짜는 뺀다)', /^\d{2}:\d{2}:\d{2}$/.test(((await clock.innerText()) ?? '').trim()), (await clock.innerText()) ?? '')
  const title = (await page.locator('header').innerText()) ?? ''
  check('휴대폰: 화면 이름이 여전히 보인다', title.includes('오늘'), title)

  await page.getByRole('button', { name: '메뉴 열기' }).click()
  await page.waitForTimeout(500)
  const drawer = (await page.getByRole('navigation', { name: '주 메뉴' }).innerText()) ?? ''
  check('휴대폰 서랍: 같은 순서', drawer.indexOf('도구함') > drawer.indexOf('고객 운영') && drawer.indexOf('가끔 쓰는 것') > drawer.indexOf('도구함'), drawer.slice(0, 260))
  const logoH = await page.locator('img[alt]:visible').first().evaluate((el) => el.getBoundingClientRect().height)
  check('휴대폰 서랍: 로고도 48px', Math.round(logoH) === 48, String(logoH))
  await ctx.close()
}

await browser.close()
console.log(`\n껍데기(메뉴·시계·로고·검색): ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
