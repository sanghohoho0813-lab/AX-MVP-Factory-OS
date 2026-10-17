/**
 * 모듈 × 여러 상황 매트릭스 (D-224) — "모듈들 각각 다 여러 상황 가정해서 오류 없는지".
 *
 * 업체 유형 8가지(신생 개인 · 7년차 제조 법인 · 이름만 · 중견 · 이상값 · 지방 음식점 · 컨설턴트 고객 · 적자 무역)마다
 *   1 맞춤 추천 › 상황 예시를 모두 펼치고(물어보는 질문은 '예' 로 답해 더 연다) 펼친 설계에 깨진 글자가 없는지
 *   2 상황마다 [○○에서 이어서] 로 모듈을 그 상황 그대로 연다(preset)
 *   3 모듈 화면 전부(절세 · 창업감면 · 고용지원금 · 연구소 · 정책자금 · 크레탑 · 기업인증 · 홍보 글 · 홈페이지)를 그 업체로 연다
 *   4 업체 상세 탭 전부를 연다
 * 볼 것: 화면 오류(pageerror) 0 · 오류 울타리 0 · 'NaN · undefined · Infinity · [object Object]' 0 · 본문이 비지 않음.
 * 휴대폰 390 에서는 업체 3가지(제조 · 이상값 · 이름만)로 3 · 4 를 다시 열고 가로 넘침도 본다.
 *
 *   node e2e/matrix.mjs http://localhost:4390        (SHOTS=폴더 를 주면 실패 화면을 찍는다)
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.SHOTS ?? ''
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
let pass = 0
let fail = 0
const fails = []
function check(name, ok, detail) {
  if (ok) pass += 1
  else {
    fail += 1
    fails.push(name)
    console.log(`FAIL  ${name}${detail ? ' ' + String(detail).slice(0, 300) : ''}`)
  }
}

const NOW = '2026-10-01T00:00:00.000Z'
const base = (id, companyName, more) => ({ id, companyName, status: 'active', createdAt: NOW, updatedAt: NOW, ...more })
const ARCH = [
  base('mx_new', '새싹앱스튜디오', {
    representativeName: '박새싹', contactName: '박새싹', contactPhone: '010-1111-2222', businessNumber: '211-11-11111',
    establishedAt: '2026-07-01', businessCategory: '정보통신업', businessItem: '모바일 앱 개발', businessAddress: '서울특별시 마포구 월드컵북로 1',
    representativeBirth: '1998-02-02', employeeCount: '0', factValues: { revenue: '0' },
  }),
  base('mx_mfg', '대한정밀금속(주)', {
    representativeName: '이대한', contactName: '이대한', contactPhone: '010-3333-4444', businessNumber: '312-81-22222', corporateNumber: '134811-0099887',
    establishedAt: '2019-03-02', businessCategory: '제조업', businessItem: '금속 정밀가공 부품', businessAddress: '경기도 화성시 동탄산단로 22',
    representativeBirth: '1972-08-15', employeeCount: '32', clientType: 'client', contractStatus: 'contracted',
    taxProfile: { monthlySalary: '8,000,000', retainedEarnings: '1,500,000,000', ceoStartDate: '2019-03-02', par: '5000', loanBalance: '200,000,000', children: '2', estateRealEstate: '2,000,000,000' },
    shareholderRegister: [
      { id: 'h1', name: '이대한', relation: 'ceo', shares: 9000, acquirePrice: 5000 },
      { id: 'h2', name: '김배우', relation: 'spouse', shares: 1000, acquirePrice: 5000 },
    ],
    factValues: { revenue: '4,500,000,000', operatingProfit: '420,000,000', netIncome: '300,000,000', totalAssets: '6,000,000,000', totalLiabilities: '2,500,000,000' },
  }),
  base('mx_blank', '이름만상사', {}),
  base('mx_big', '한빛중공업(주)', {
    representativeName: '최한빛', corporateNumber: '110111-0001111', establishedAt: '1995-06-01', businessCategory: '제조업', businessItem: '산업기계',
    businessAddress: '서울특별시 강남구 테헤란로 100', representativeBirth: '1960-01-20', employeeCount: '420',
    factValues: { revenue: '90,000,000,000', operatingProfit: '6,000,000,000', netIncome: '4,200,000,000', totalAssets: '120,000,000,000', totalLiabilities: '70,000,000,000' },
  }),
  base('mx_weird', '아주아주긴이름의주식회사'.repeat(8) + ' (주)', {
    representativeName: '홍길동'.repeat(10), contactPhone: '010-0000-0000 / 02-000-0000 (내선 123) 오후만',
    establishedAt: '2031-01-01', businessCategory: '???', businessItem: '', businessAddress: '', representativeBirth: '1890-01-01',
    employeeCount: '많음', factValues: { revenue: 'abc', netIncome: '-999,999,999,999', totalAssets: '0', totalLiabilities: '-5' },
    taxProfile: { monthlySalary: '-1', retainedEarnings: '1e309', par: '0', children: '-3' },
  }),
  base('mx_food', '순천한상', {
    representativeName: '정순천', contactName: '정순천', establishedAt: '2010-05-01', businessCategory: '숙박 및 음식점업', businessItem: '한식 음식점',
    businessAddress: '전라남도 순천시 중앙로 5', representativeBirth: '1963-11-03', employeeCount: '4', factValues: { revenue: '320,000,000', netIncome: '40,000,000' },
  }),
  base('mx_consult', '동료컨설팅랩', {
    representativeName: '윤동료', clientType: 'consultant', establishedAt: '2022-02-02', businessCategory: '전문, 과학 및 기술 서비스업', businessItem: '경영 컨설팅',
    businessAddress: '부산광역시 해운대구 센텀로 9', representativeBirth: '1985-04-04', employeeCount: '1',
  }),
  base('mx_loss', '가온무역 주식회사', {
    representativeName: '한가온', corporateNumber: '110111-7654321', establishedAt: '2024-05-01', businessCategory: '도매 및 소매업', businessItem: '무역',
    businessAddress: '인천광역시 연수구 송도과학로 3', representativeBirth: '1981-03-03', employeeCount: '2',
    factValues: { revenue: '150,000,000', operatingProfit: '-5,000,000', netIncome: '-8,000,000' },
  }),
]

const MODULE_SCREENS = [
  '/tools/tax',
  '/tools/startup-tax/judge', '/tools/startup-tax/report',
  '/tools/employment/dashboard', '/tools/employment/diagnosis', '/tools/employment/simulator', '/tools/employment/roster',
  '/tools/labcare/dashboard', '/tools/labcare/assessment', '/tools/labcare/tax', '/tools/labcare/reports',
  '/tools/policy-funding/dashboard', '/tools/policy-funding/diagnosis', '/tools/policy-funding/report',
  '/tools/cretop/analyze',
  '/tools/cert-os/mainbiz', '/tools/cert-os/venture', '/tools/cert-os/lab',
  '/tools/content/build', '/tools/homepage/build',
]
const DETAIL_TABS = ['smart', 'overview', 'work', 'docs', 'funding', 'consulting', 'fees', 'journal']
const BAD = /\bNaN\b|undefined|Infinity|\[object Object\]/

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

async function newPage(vp, mobile) {
  const ctx = await browser.newContext({ viewport: vp, locale: 'ko-KR', ...(mobile ? { isMobile: true, hasTouch: true } : {}) })
  const page = await ctx.newPage()
  const bucket = []
  page.on('pageerror', (e) => bucket.push(String(e).slice(0, 200)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate((rows) => {
    const k = 'axmvp.v1.operations_clients'
    const list = JSON.parse(localStorage.getItem(k) ?? '[]').filter((r) => !rows.some((x) => x.id === r.id))
    list.push(...rows)
    localStorage.setItem(k, JSON.stringify(list))
  }, ARCH)
  return { ctx, page, bucket }
}

/** 한 화면을 열고 볼 것을 본다 */
async function inspect(page, bucket, label, path, { overflow = false } = {}) {
  bucket.length = 0
  if (page.isClosed()) return check(`${label} ${path}`, false, '시험 창이 닫혀 열지 못함')
  await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(500)
  const r = await page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body
    const text = main.innerText ?? ''
    return {
      text,
      len: text.trim().length,
      err: !!document.querySelector('[data-testid="screen-error"]'),
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }
  })
  const bad = r.text.match(BAD)
  const problems = []
  if (bucket.length) problems.push(`화면 오류 ${bucket.join(' | ')}`)
  if (r.err) problems.push('오류 울타리')
  if (bad) problems.push(`깨진 글자 "${bad[0]}" … ${r.text.slice(Math.max(0, r.text.indexOf(bad[0]) - 60), r.text.indexOf(bad[0]) + 40).replace(/\s+/g, ' ')}`)
  if (r.len < 20) problems.push(`본문이 거의 비었음(${r.len}자)`)
  if (overflow && r.sw > r.cw + 1) problems.push(`가로 넘침 ${r.sw}>${r.cw}`)
  check(`${label} ${path}`, problems.length === 0, problems.join(' · '))
  if (problems.length && SHOTS) await page.screenshot({ path: join(SHOTS, `mx-${label.replace(/[^\w가-힣]+/g, '_')}-${path.replace(/[^\w]+/g, '_')}.png`) }).catch(() => {})
  return r
}

let scenarioOpened = 0
let presetsVisited = 0
let screensVisited = 0

/* ---------------- PC 1440 — 업체 유형 8가지 ---------------- */
// 업체마다 새 창 — 한 창에서 100번 넘게 무거운 화면을 열면 시험 브라우저 메모리가 차서 창이 닫힌다(앱 문제 아님 · 따로 열면 정상)
for (const a of ARCH) {
  const { ctx, page, bucket } = await newPage({ width: 1440, height: 900 }, false)
  {
    const L = `[PC ${a.id}]`
    // 1 맞춤 추천 › 상황 예시 — 질문은 '예' 로 답해 더 연다
    bucket.length = 0
    await page.goto(`${BASE}/ops/clients/${a.id}?tab=smart`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    if (await page.getByTestId('scenario-questions-more').count()) await page.getByTestId('scenario-questions-more').click().catch(() => {})
    for (let i = 0; i < 10; i += 1) {
      const yes = page.locator('[data-testid="scenario-question"] [data-testid="scenario-answer-yes"]').first()
      if (!(await yes.count())) break
      await yes.click().catch(() => {})
      await page.waitForTimeout(900) // 두 번 눌림 막기(0.6초) 뒤
    }
    if (await page.getByTestId('scenario-more').count()) await page.getByTestId('scenario-more').click().catch(() => {})
    const ids = await page.locator('[data-testid="scenario-row"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))
    const hrefs = new Set()
    for (const id of ids) {
      const r = page.locator(`[data-testid="scenario-row"][data-id="${id}"]`)
      if ((await r.getByTestId('scenario-detail').count()) === 0) await r.getByTestId('scenario-toggle').click().catch(() => {})
      await r.getByTestId('scenario-detail').waitFor({ timeout: 3000 }).catch(() => {})
      const t = (await r.innerText().catch(() => '')) ?? ''
      const bad = t.match(BAD)
      check(`${L} 상황 예시 펼침 ${id}`, !bad && t.trim().length > 10, bad ? `"${bad[0]}" … ${t.replace(/\s+/g, ' ').slice(0, 200)}` : t.slice(0, 80))
      scenarioOpened += 1
      for (const h of await r.locator('[data-testid="scenario-open"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))) if (h) hrefs.add(h)
    }
    check(`${L} 맞춤 추천 화면 오류 0`, bucket.length === 0, bucket.join(' | '))
    // 2 상황 그대로 모듈 열기(preset)
    for (const h of hrefs) {
      await inspect(page, bucket, `${L} 상황→모듈`, h)
      presetsVisited += 1
    }
    // 3 모듈 화면 전부
    for (const s of MODULE_SCREENS) {
      await inspect(page, bucket, `${L} 모듈`, `${s}?client=${encodeURIComponent(a.id)}`)
      screensVisited += 1
    }
    // 4 업체 상세 탭 전부
    for (const t of DETAIL_TABS) {
      await inspect(page, bucket, `${L} 업체 상세`, `/ops/clients/${a.id}?tab=${t}`)
      screensVisited += 1
    }
  }
  await ctx.close()
}

/* ---------------- 휴대폰 390 — 제조 · 이상값 · 이름만 ---------------- */
for (const a of ARCH.filter((x) => ['mx_mfg', 'mx_weird', 'mx_blank'].includes(x.id))) {
  const { ctx, page, bucket } = await newPage({ width: 390, height: 844 }, true)
  {
    const L = `[390 ${a.id}]`
    for (const s of MODULE_SCREENS) {
      await inspect(page, bucket, `${L} 모듈`, `${s}?client=${encodeURIComponent(a.id)}`, { overflow: true })
      screensVisited += 1
    }
    for (const t of DETAIL_TABS) {
      await inspect(page, bucket, `${L} 업체 상세`, `/ops/clients/${a.id}?tab=${t}`, { overflow: true })
      screensVisited += 1
    }
  }
  await ctx.close()
}

await browser.close()
console.log(`\n업체 유형 ${ARCH.length} · 상황 예시 펼침 ${scenarioOpened} · 상황→모듈 ${presetsVisited} · 화면 ${screensVisited}`)
console.log(`matrix: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
