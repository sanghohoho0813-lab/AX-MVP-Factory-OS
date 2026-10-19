/**
 * 길잡이 시험 (D-235) — 대표 "어딜 클릭해서 들어가더라도 지금 어디 안에 있는지 · 딱딱 순서대로 · 각 단계가 무엇을 위한 것인지 · 소제목마다 ?".
 *
 *  1440  경로 줄(업체 · 모듈 · 영업 · 마케팅) · 앞 칸 누르면 그 단계 · 마지막 칸은 지금 자리
 *        · 업체 일 순서 6단계(다음 · 이전 · 화면 끝 다음 · 순서 밖 탭 · 설명 접기 기억)
 *        · 모듈 순서(업체를 들고 다음 화면) · 영업 순서 · 모듈 첫 화면 '이렇게 쓰세요'
 *        · ? 설명(마우스 올리면 뜸 · 화면 안)
 *  360 · 390  경로 줄 · 단계 안내 가로 넘침 0 · 단추 44px · ? 설명 화면 안
 *
 *   node e2e/wayfinding.mjs http://localhost:4390
 */
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ' ' + JSON.stringify(detail).slice(0, 400)}`)
}

const crumbs = (page) => page.getByTestId('crumb').evaluateAll((els) => els.map((e) => ({ text: e.textContent.trim(), link: !!e.querySelector('a'), last: e.getAttribute('data-last') })))
const crumbText = async (page) => (await crumbs(page)).map((c) => c.text).join(' › ')
const guide = (page) => page.getByTestId('step-guide').first()
const go = async (page, path) => {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
}
/** 탭을 옮긴 뒤 단계 안내가 그 단계로 바뀔 때까지(맞춤 추천 탭은 판정 계산이 많아 0.5초 안에 다 그려지지 않을 때가 있다) */
const settle = (page, step) => page.waitForFunction((s) => document.querySelector('[data-testid="step-guide"]')?.getAttribute('data-step') === s, step, { timeout: 5000 }).then(() => page.waitForTimeout(300)).catch(() => {})
const over = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())

  // 경로 줄 — 업체 화면
  await go(page, '/ops/clients/cli_hansol?tab=smart')
  const c1 = await crumbs(page)
  check('W1 업체 화면 경로 줄 = 고객 관리 › 한솔테크(주) › 맞춤 추천 · 앞 두 칸은 누를 곳 · 마지막은 지금 자리', c1.map((c) => c.text).join(' › ') === '고객 관리 › 한솔테크(주) › 맞춤 추천' && c1[0].link && c1[1].link && !c1[2].link && c1[2].last === '1', c1)
  check('W1 오늘 화면은 경로 줄 없음', await (async () => { await go(page, '/'); return (await page.getByTestId('crumbs').count()) === 0 })())

  // 업체 일 순서 — 다음 · 이전
  await go(page, '/ops/clients/cli_hansol?tab=smart')
  const g = guide(page)
  check('W2 맞춤 추천 = 업체 일 순서 3 / 6단계 · 무엇을 위한 단계인지 한 문장', (await g.getAttribute('data-index')) === '3' && (await g.getAttribute('data-total')) === '6' && /맞춤 추천 — .+/.test(await page.getByTestId('step-why').innerText()), await g.innerText())
  await page.getByTestId('step-next-top').click()
  await settle(page, 'work')
  check('W2 [다음: 업무 진행] → 업무 탭 · 4 / 6 · 경로 줄 끝 = 업무', /tab=work/.test(page.url()) && (await guide(page).getAttribute('data-index')) === '4' && (await crumbText(page)).endsWith('› 업무'), [page.url(), await crumbText(page)])
  await page.getByTestId('step-prev').click()
  await settle(page, 'smart')
  check('W2 [이전] → 맞춤 추천으로 돌아옴', /tab=smart/.test(page.url()) && (await guide(page).getAttribute('data-index')) === '3', page.url())

  // 화면 끝 '다음 단계'
  await go(page, '/ops/clients/cli_hansol?tab=docs')
  const bottom = page.getByTestId('step-next-bottom')
  await bottom.scrollIntoViewIfNeeded()
  const yBefore = await page.evaluate(() => window.scrollY)
  await bottom.click()
  await page.waitForTimeout(900)
  check('W3 서류 탭 끝 [다음: 회사 정보 확인] → 개요 · 화면 맨 위로', !/tab=/.test(page.url()) && (await guide(page).getAttribute('data-index')) === '2' && (await page.evaluate(() => window.scrollY)) < Math.max(80, yBefore), [page.url(), yBefore, await page.evaluate(() => window.scrollY)])
  check('W3 첫 단계(서류)에는 [이전] 없음 · 마지막 단계(수금)에는 화면 끝 다음 없음', await (async () => {
    await go(page, '/ops/clients/cli_hansol?tab=docs')
    const noPrev = (await page.getByTestId('step-prev').count()) === 0
    await go(page, '/ops/clients/cli_hansol?tab=fees')
    return noPrev && (await page.getByTestId('step-next-bottom').count()) === 0 && (await page.getByTestId('step-next-top').count()) === 0
  })())

  // 순서 밖 탭
  await go(page, '/ops/clients/cli_hansol?tab=journal')
  check('W4 업무 일기 = 순서 밖(번호 없이 언제 여는지) · 고객에게 안 보인다는 말', (await guide(page).getAttribute('data-step')) === 'aside' && /고객에게는 보이지 않아요/.test(await guide(page).innerText()), await guide(page).innerText())
  await page.getByTestId('step-first').click()
  await page.waitForTimeout(500)
  check('W4 [순서대로: 1단계 서류 올리기] → 서류 탭', /tab=docs/.test(page.url()), page.url())

  // 설명 접기 — 기억
  await page.getByTestId('step-min').click()
  await page.waitForTimeout(300)
  const minOn = (await guide(page).getAttribute('data-min')) === '1' && (await page.getByTestId('step-why').count()) === 0 && (await page.getByTestId('step-next-top').count()) === 1
  await go(page, '/ops/clients/cli_hansol?tab=smart')
  const minKept = (await guide(page).getAttribute('data-min')) === '1' && /맞춤 추천/.test(await guide(page).innerText())
  await page.getByTestId('step-min').click()
  await page.waitForTimeout(300)
  check('W5 [설명 접기] → 한 줄(몇 번째 · 이름 · 다음 단추)만 · 다른 탭에서도 접힌 채 · 다시 펼치기', minOn && minKept && (await page.getByTestId('step-why').count()) === 1, { minOn, minKept })

  // 업체로 연 모듈 — 경로 줄 가운데 탭 · 모듈 순서
  await go(page, '/ops/clients/cli_hansol?tab=smart')
  await go(page, '/tools/employment/roster?client=cli_hansol')
  const emp = await crumbText(page)
  check('W6 맞춤 추천에서 연 모듈 = 고객 관리 › 한솔테크(주) › 맞춤 추천 › 고용지원금 관리 › 4대보험 명부 진단', emp === '고객 관리 › 한솔테크(주) › 맞춤 추천 › 고용지원금 관리 › 4대보험 명부 진단', emp)
  const mg = guide(page)
  const nextHref = await page.getByTestId('step-next-top').getAttribute('href')
  check('W6 고용지원금 순서 2 / 5 · [다음: 회차 일정] 은 업체를 들고(?client=)', (await mg.getAttribute('data-index')) === '2' && (await mg.getAttribute('data-total')) === '5' && nextHref === '/tools/employment/schedule?client=cli_hansol', [await mg.innerText(), nextHref])
  await page.getByTestId('step-next-top').click()
  await page.waitForTimeout(700)
  check('W6 누르면 회차 일정 · 3 / 5 · 경로 줄 끝 = 회차 일정', /\/tools\/employment\/schedule\?client=cli_hansol/.test(page.url()) && (await guide(page).getAttribute('data-index')) === '3' && (await crumbText(page)).endsWith('회차 일정'), [page.url(), await crumbText(page)])
  // 경로 줄 칸을 누르면 그 단계로
  await page.getByTestId('crumb').nth(2).locator('a').click()
  await page.waitForTimeout(700)
  check('W7 경로 줄 [맞춤 추천] 을 누르면 그 업체 맞춤 추천 탭으로', /\/ops\/clients\/cli_hansol\?tab=smart/.test(page.url()), page.url())
  await go(page, '/ops/clients/cli_hansol?tab=journal')
  await go(page, '/tools/employment/roster?client=cli_hansol')
  check('W7 업무 일기에서 왔으면 가운데 칸 없이 업체 › 모듈', (await crumbText(page)) === '고객 관리 › 한솔테크(주) › 고용지원금 관리 › 4대보험 명부 진단', await crumbText(page))
  await go(page, '/tools/employment')
  check('W7 순서 밖 화면(한눈에 보기) — 언제 여는지 + [순서대로: 1단계 채용 진단]', (await guide(page).getAttribute('data-step')) === 'aside' && (await page.getByTestId('step-first').getAttribute('href')) === '/tools/employment/diagnosis', await guide(page).innerText())

  // 영업 순서
  await go(page, '/sales/meeting')
  check('W8 영업 › 영업 관리 › 미팅 준비 · 영업 순서 2 / 3 · 이전 영업 보드 · 다음 상품 · 제안', (await crumbText(page)) === '영업 › 영업 관리 › 미팅 준비' && (await guide(page).getAttribute('data-index')) === '2' && (await page.getByTestId('step-prev').getAttribute('href')) === '/sales/board' && (await page.getByTestId('step-next-top').getAttribute('href')) === '/sales/proposal', [await crumbText(page), await guide(page).innerText()])

  // 모듈 첫 화면 — 이렇게 쓰세요
  await go(page, '/modules/growth')
  const steps = page.getByTestId('module-guide').locator('li')
  check('W9 기업성장 모듈 첫 화면 — 이렇게 쓰세요 세 걸음 · 1번은 고객 관리로', (await steps.count()) === 3 && (await steps.first().locator('a').getAttribute('href')) === '/ops/clients', await page.getByTestId('module-guide').innerText())

  // 마케팅 경로 줄
  await go(page, '/tools/content/build?client=cli_hansol')
  check('W10 마케팅 — 영업 › 마케팅 · 브랜딩 › 홍보 글 만들기 › 한솔테크(주)', (await crumbText(page)).startsWith('영업 › 마케팅 · 브랜딩 › 블로그 · 플레이스 홍보 글 만들기 › 한솔테크(주)'), await crumbText(page))

  // ? 설명 — 마우스를 올리면 뜨고 화면 안
  await go(page, '/ops/clients/cli_hansol?tab=smart')
  const dots = await page.getByTestId('hint-dot').count()
  const dot = page.getByTestId('hint-dot').first()
  await dot.scrollIntoViewIfNeeded()
  await dot.hover()
  await page.waitForTimeout(400)
  const tip = page.getByTestId('hint-tip').first()
  const box = await tip.boundingBox()
  check('W11 맞춤 추천 소제목에 ? 여러 개 · 마우스를 올리면 설명이 뜨고 화면 안', dots >= 5 && (await tip.isVisible()) && !!box && box.x >= 0 && box.x + box.width <= 1440, { dots, box })
  const pagesDots = {}
  for (const p of ['/', '/tools', '/sales/meeting', '/tools/tax', '/modules/growth']) {
    await go(page, p)
    pagesDots[p] = await page.getByTestId('hint-dot').count()
  }
  check('W11 오늘 · 모듈 · 미팅 준비 · 세금 계산기 · 모듈 첫 화면 모두 ? 있음', Object.values(pagesDots).every((n) => n >= 1), pagesDots)

  check('W12 화면 오류 0', errors.length === 0, errors.slice(0, 3))
  await ctx.close()
}

/* ---------------- 휴대폰 ---------------- */
for (const width of [360, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 820 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const bad = []
  for (const p of ['/ops/clients/cli_hansol?tab=smart', '/ops/clients/cli_hansol?tab=journal', '/tools/employment/roster?client=cli_hansol', '/sales/meeting', '/modules/growth', '/tools/content/build?client=cli_hansol']) {
    await go(page, p)
    const o = await over(page)
    const crumbRight = await page.getByTestId('crumbs').evaluate((n) => Math.max(...[...n.querySelectorAll('li')].map((li) => li.getBoundingClientRect().right))).catch(() => 0)
    const btnH = await page.locator('[data-testid="step-guide"] a, [data-testid="step-guide"] button').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)))
    if (o > 1 || crumbRight > width + 1 || btnH.some((h) => h < 44)) bad.push({ p, o, crumbRight, btnH })
  }
  check(`M${width} 경로 줄 · 단계 안내 — 가로 넘침 0 · 경로 줄 화면 안 · 단계 단추 44px 이상`, bad.length === 0, bad)
  await go(page, '/ops/clients/cli_hansol?tab=smart')
  const dot = page.getByTestId('hint-dot').first()
  await dot.scrollIntoViewIfNeeded()
  await dot.tap()
  await page.waitForTimeout(400)
  const tip = page.getByTestId('hint-tip').first()
  const box = await tip.boundingBox()
  check(`M${width} ? 를 누르면 설명이 뜨고 화면 밖으로 안 나감`, (await tip.isVisible()) && !!box && box.x >= 0 && box.x + box.width <= width, box)
  check(`M${width} 화면 오류 0`, errors.length === 0, errors.slice(0, 3))
  await ctx.close()
}

await browser.close()
console.log(`\n길잡이 e2e: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
