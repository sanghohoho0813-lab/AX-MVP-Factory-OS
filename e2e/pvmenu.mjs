/**
 * qa:pvmenu — D-247 메뉴 '특허 · 벤처'(기업인증 밖). 실행: npm run qa:pvmenu -- http://localhost:4390 [사진 폴더]
 *  - 사이드바 고객 묶음(AI 전략실 다음)에 '특허 · 벤처' · 누르면 첫 화면 · 불 켜짐
 *  - 첫 화면 = 대화창(D-250) · [자세히](/patent-venture/more): 벤처 사업계획서 쓰기(회사 고르기 → 쓰기) · 특허 명세서 점검 열기
 *  - /patent-venture/plan?client= 에서 쓴 칸 = 기업인증 › 벤처 › 사업계획서 쓰기의 같은 칸(같은 기록) · 새로고침해도 그대로
 *  - 돌아가기 → 특허 · 벤처 · 회사 없이 열면 고르기 · 명세서 점검(같은 화면, 돌아가기만 특허 · 벤처로)
 *  - 예전 입구 그대로: 기업인증 › 벤처 사업계획서 쓰기 · /studio/spec-check(돌아가기 특허·MVP)
 *  - 휴대폰 더보기 서랍에 '특허 · 벤처' · 360 · 390 · 430 · 글자 아주 크게에서 가로 넘침 0 · JS 오류 0
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.argv[3] ?? ''
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail !== undefined ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 400)}` : ''}`)
}
const shot = async (page, name, full = true) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full })
}
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const CLIENT = 'cli_hansol'
const MARK = '메뉴에서 쓴 기술명 D247'

// 시험용 명세서(실제 발명 아님)
const SPEC_MD = [
  '**[발명의 설명]**', '**[발명의 명칭]**', '공구 마모 예측 기반 교체시점 산출 시스템 및 방법{SYSTEM AND METHOD FOR ESTIMATING TOOL REPLACEMENT TIME}',
  '**[기술분야]**', '[0001] 본 발명은 공구 진동정보로 마모를 예측하는 시스템에 관한 것이다.',
  '**[해결하려는 과제]**', '[0002] 마모량을 예측하는 것을 목적으로 한다.',
  '**[과제의 해결 수단]**', '[0003] 시스템(100)은 데이터 수집부(110)와 판정부(120)를 포함한다.',
  '**[발명의 효과]**', '[0004] 교체 시점을 미리 알 수 있다.',
  '**[부호의 설명]**', '100: 공구관리 시스템', '110: 데이터 수집부', '120: 판정부',
  '**[청구항 1]**', '진동신호를 수집하는 데이터 수집부; 및 마모를 판정하는 판정부;를 포함하는 시스템.',
  '**[요약]**', '공구 마모를 예측한다.',
].join('\n')

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- PC 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })

  // 메뉴 자리 — 고객 묶음, AI 전략실 다음 · 상담신청 앞
  const nav = (await page.locator('aside').first().innerText()) ?? ''
  const at = (s) => nav.indexOf(s)
  check('메뉴: 고객 묶음에 "특허 · 벤처"(고객 관리 다음 · 잠재고객 상담신청 앞)', at('특허 · 벤처') > at('고객 관리') && at('고객 관리') >= 0 && at('특허 · 벤처') < at('잠재고객 상담신청'), nav.replace(/\n/g, '|').slice(0, 300))
  check('메뉴: AI 전략실이 있으면 그 바로 다음', at('AI 전략실') === -1 || at('특허 · 벤처') > at('AI 전략실'))
  await page.locator('aside').first().getByRole('link', { name: /특허 · 벤처/ }).click()
  await page.waitForURL(/\/patent-venture$/)
  await page.waitForTimeout(400)
  // D-250 첫 화면 = 대화창 · 예전 진행판 · 카드는 [자세히](/patent-venture/more)
  check('메뉴 → /patent-venture · 첫 화면 = 대화창', (await page.getByTestId('pv-chat-page').count()) === 1)
  check('메뉴 불 켜짐(지금 화면)', (await page.locator('aside').first().locator('a[aria-current="page"]').innerText()).includes('특허 · 벤처'))
  await page.getByTestId('chat-detail').click()
  await page.waitForURL(/\/patent-venture\/more$/)
  await page.getByTestId('pv-home').waitFor()
  check('[자세히] → 예전 첫 화면 · 카드 둘', (await page.getByTestId('pv-home').count()) === 1 && (await page.getByTestId('pv-card-plan').count()) === 1 && (await page.getByTestId('pv-card-spec').count()) === 1)
  check('[자세히]에서도 메뉴 불은 특허 · 벤처', (await page.locator('aside').first().locator('a[aria-current="page"]').innerText()).includes('특허 · 벤처'))
  check('첫 화면: 기업인증 › 벤처기업 안내 한 줄', /기업인증 › 벤처기업/.test(await page.getByTestId('pv-note').innerText()))
  check('회사 고르기 전에는 [사업계획서 쓰기] 꺼짐', await page.getByTestId('pv-plan-open').isDisabled())
  await shot(page, 'pv-01-home')

  // 회사 고르고 쓰기
  await page.getByTestId('pv-plan-client').selectOption(CLIENT)
  await page.getByTestId('pv-plan-open').click()
  await page.waitForURL(/\/patent-venture\/plan\?client=/)
  await page.waitForTimeout(800)
  check('쓰기 → /patent-venture/plan?client= · 사업계획서 화면', page.url().includes(`/patent-venture/plan?client=${CLIENT}`) && (await page.getByTestId('vplan').count()) === 1 && (await page.getByTestId('pv-plan-page').count()) === 1)
  check('제목: "… 벤처 사업계획서" · 돌아가기 "특허 · 벤처로"', /벤처 사업계획서/.test(await page.locator('main h1').first().innerText()) && /특허 · 벤처로/.test(await page.getByTestId('vplan-back').innerText()))
  check('여기서도 메뉴 불은 특허 · 벤처', (await page.locator('aside').first().locator('a[aria-current="page"]').innerText()).includes('특허 · 벤처'))
  await page.getByTestId('vplan-tab-summary').click()
  await page.waitForTimeout(200)
  const tech = page.locator('[data-testid="vplan-field"][data-id="tech_name"] [data-testid="vplan-input"]')
  await tech.fill(MARK)
  await tech.blur()
  await page.waitForTimeout(1500)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.getByTestId('vplan-tab-summary').click()
  await page.waitForTimeout(200)
  check('쓴 칸 → 새로고침해도 그대로', (await tech.inputValue()) === MARK, await tech.inputValue())
  await shot(page, 'pv-02-plan')

  // 같은 기록 — 기업인증 › 벤처 › 사업계획서 쓰기
  await page.goto(BASE + `/tools/cert-os/venture?client=${CLIENT}&plan=1`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.getByTestId('vplan-tab-summary').click()
  await page.waitForTimeout(200)
  check('기업인증 › 벤처 사업계획서 쓰기에도 같은 글(같은 기록)', (await tech.inputValue()) === MARK, await tech.inputValue())
  check('기업인증 안 돌아가기 말은 그대로 "벤처 진행으로"', /벤처 진행으로/.test(await page.getByTestId('vplan-back').innerText()))
  await page.goto(BASE + `/tools/cert-os/venture?client=${CLIENT}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.getByTestId('cert-step-1').click()
  await page.waitForTimeout(300)
  check('예전 입구 그대로: 기업인증 › 벤처 사업계획서 쓰기 단추', (await page.getByTestId('cert-venture-plan-open').count()) + (await page.getByTestId('cert-venture-plan-row').count()) + (await page.getByTestId('cert-venture-plan-step1').count()) >= 1)

  // 돌아가기 · 회사 없이
  await page.goto(BASE + `/patent-venture/plan?client=${CLIENT}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.getByTestId('vplan-back').click()
  await page.waitForURL(/\/patent-venture$/)
  await page.getByTestId('pv-chat-page').waitFor({ timeout: 5000 }).catch(() => {})
  check('돌아가기 → 특허 · 벤처 첫 화면(대화창)', (await page.getByTestId('pv-chat-page').count()) === 1)
  await page.goto(BASE + '/patent-venture/plan', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('회사 없이 열면 회사 고르기', (await page.getByTestId('pv-plan-pick').count()) === 1 && (await page.getByTestId('vplan').count()) === 0)

  // 명세서 점검
  await page.goto(BASE + '/patent-venture/more', { waitUntil: 'networkidle' })
  await page.getByTestId('pv-spec-open').click()
  await page.waitForURL(/\/patent-venture\/spec-check$/)
  await page.waitForTimeout(400)
  await page.locator('#spec-file').setInputFiles({ name: 'spec-test.md', mimeType: 'text/markdown', buffer: Buffer.from(SPEC_MD, 'utf8') })
  await page.waitForTimeout(900)
  check('명세서 점검 열기 → 파일 올리면 결과', (await page.locator('[data-summary]').count()) >= 1)
  check('명세서 점검 돌아가기 → 특허 · 벤처', (await page.getByTestId('spec-back').getAttribute('href')) === '/patent-venture' && /특허 · 벤처/.test(await page.getByTestId('spec-back').innerText()))
  check('명세서 점검에서도 메뉴 불은 특허 · 벤처', (await page.locator('aside').first().locator('a[aria-current="page"]').innerText()).includes('특허 · 벤처'))
  await shot(page, 'pv-03-spec', false)
  await page.goto(BASE + '/studio/spec-check', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check('예전 주소 /studio/spec-check 그대로(돌아가기 특허·MVP)', (await page.getByTestId('spec-back').getAttribute('href')) === '/studio' && /특허·MVP/.test(await page.getByTestId('spec-back').innerText()))
  check('PC: JS 오류 0', errors.length === 0, errors)
  await ctx.close()
}

/* ---------------- 휴대폰 ---------------- */
for (const width of [360, 390, 430]) {
  const ctx = await browser.newContext({ viewport: { width, height: 860 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  if (width === 390) {
    await page.locator('nav[aria-label="주요 화면"]').getByRole('button', { name: /더보기/ }).click()
    await page.waitForTimeout(400)
    // 더보기 서랍 안에서 찾는다 — 오늘 화면 본문에도 '특허 · 벤처' 링크가 생겨, 서랍 뒤에 가린 그 링크를 누르려다 멈췄다
    const link = page.getByTestId('more-sheet-wrap').getByRole('link', { name: /특허 · 벤처/ }).filter({ visible: true }).first()
    check('390: 더보기 서랍에 "특허 · 벤처"', (await link.count()) === 1)
    await link.click()
    await page.waitForURL(/\/patent-venture$/)
    await page.waitForTimeout(400)
    check('390: 서랍 → 첫 화면(대화창)', (await page.getByTestId('pv-chat-page').count()) === 1)
  }
  for (const scale of ['', 'extra_large']) {
    await page.goto(BASE + '/patent-venture', { waitUntil: 'networkidle' })
    if (scale) await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
    await page.waitForTimeout(300)
    const o0 = await overflowX(page)
    await page.goto(BASE + '/patent-venture/more', { waitUntil: 'networkidle' })
    if (scale) await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
    await page.waitForTimeout(300)
    const o1 = Math.max(o0, await overflowX(page))
    if (width === 390 && !scale) await shot(page, 'pv-04-home-390')
    await page.goto(BASE + `/patent-venture/plan?client=${CLIENT}`, { waitUntil: 'networkidle' })
    if (scale) await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
    await page.waitForTimeout(800)
    const o2 = await overflowX(page)
    if (width === 390 && !scale) await shot(page, 'pv-05-plan-390', false)
    check(`${width}${scale ? ' 글자 아주 크게' : ''}: 대화창 · 자세히 · 사업계획서 가로 넘침 0`, o1 <= 0 && o2 <= 0, { o1, o2 })
  }
  check(`${width}: JS 오류 0`, errors.length === 0, errors)
  await ctx.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
