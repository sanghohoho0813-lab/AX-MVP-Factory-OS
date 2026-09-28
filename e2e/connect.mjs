/**
 * 모듈 ↔ 업체 잇기 시험 (D-134) — 모듈이 따로 노는 앱이 아니라 업체 기록의 한 부분처럼.
 *
 *  1440  세금 계산기를 업체로 열면 그 업체 숫자로 채워짐(01 급여 · 09 주식가치 = 절세 설계와 같은 1주 가치)
 *        · 업체 기록에 붙이면 '다음 할 일도 걸까요?' → 3일 뒤로 걸면 달력 · 업체 다음 할 일 · 활동 기록
 *        · 보러 가기 → 업체 상세의 도구 결과로 · 결과는 모듈마다 한 묶음(지난 결과 접힘) · 만든 화면 다시 열기
 *        · 모듈 입구 줄에 '지난번 결과 · 다시 계산하기'
 *  D-135  업체 → AX 고객사 열기(없으면 업체 정보로 만듦 · 두 번 열어도 하나) · 업체 상세 AX 프로젝트 카드 · 창업감면 생년월일 → 업체 정보
 *  390 · 360(1.30배)  업체 상세 결과 · 모듈 입구 · 할 일 상자 — 가로 넘침 0
 *
 *   node e2e/connect.mjs http://localhost:4390
 */
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' ' + detail}`)
}
const KEY = 'axmvp.v1.operations_clients'
const setup = (page) =>
  page.evaluate((k) => {
    const list = JSON.parse(localStorage.getItem(k) ?? '[]')
    const r = list.find((x) => x.id === 'cli_hansol')
    const t = r.payload ?? r
    t.taxProfile = { monthlySalary: '8,000,000', ceoStartDate: '2010-03-02', loanBalance: '3억', retainedEarnings: '20억', vAsset: '50억', vDebt: '20억', vInc0: '4억', vInc1: '5억', vInc2: '6억', par: '5000' }
    t.shareholderRegister = [
      { id: 'a', name: '김대표', relation: 'ceo', shares: 60000, acquirePrice: 5000 },
      { id: 'b', name: '이배우', relation: 'spouse', shares: 25000, acquirePrice: 5000 },
      { id: 'd', name: '박이사', relation: 'executive', shares: 15000, acquirePrice: 5000 },
    ]
    t.nextAction = ''
    t.nextActionDueDate = ''
    localStorage.setItem(k, JSON.stringify(list))
  }, KEY)
const rec = (page) =>
  page.evaluate((k) => {
    const r = JSON.parse(localStorage.getItem(k)).find((x) => x.id === 'cli_hansol')
    return r.payload ?? r
  }, KEY)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await setup(page)

  await page.goto(BASE + '/tools/tax?client=cli_hansol&m=calc&c=t2', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  check('계산기 01: 업체로 열면 대표 월 급여로 채움', (await page.locator('#s_monthly').inputValue()) === '8,000,000', await page.locator('#s_monthly').inputValue())
  const note = (await page.getByTestId('tool-prefill-note').innerText().catch(() => '')) ?? ''
  check('계산기 01: 어디서 채웠는지 한 줄', note.includes('절세 설계 현황') && note.includes('대표 월 급여'), note)

  await page.getByTestId('tool-attach-quick').first().click()
  await page.waitForTimeout(700)
  const fu = page.getByTestId('tool-followup')
  check('붙이면 다음 할 일도 묻는다(모듈별 추천 글)', (await fu.count()) === 1 && (await fu.getByLabel('다음 할 일').inputValue()) === '절세 방안 설명 미팅')
  await fu.getByRole('button', { name: '3일 뒤' }).click()
  await page.getByTestId('tool-followup-hang').click()
  await page.waitForTimeout(700)
  const r1 = await rec(page)
  const dl = r1.toolResults[0].deadlines
  const in3 = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 3); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` })
  check('할 일 걸기: 결과의 기한(할 일)으로 · 3일 뒤', dl.length === 1 && dl[0].title === '절세 방안 설명 미팅' && dl[0].todo === true && dl[0].date === in3, JSON.stringify(dl))
  check('할 일 걸기: 비어 있던 업체 다음 할 일에도', r1.nextAction === '절세 방안 설명 미팅' && r1.nextActionDueDate === in3, `${r1.nextAction} ${r1.nextActionDueDate}`)
  check('할 일 걸기: 상자는 닫힌다', (await fu.count()) === 0)
  check('결과: 만든 화면 주소를 기억', r1.toolResults[0].openPath === '/tools/tax?client=cli_hansol&m=calc&c=t2', r1.toolResults[0].openPath)

  await page.goto(BASE + '/tools/tax?client=cli_hansol&m=calc&c=t3', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  check('계산기 09: 회사 이름 · 자산 · 부채로 채움', (await page.locator('#v_name').inputValue()) === '한솔테크(주)' && (await page.locator('#v_asset').inputValue()) === '5,000,000,000')
  check('계산기 09: 예시 부동산 값은 남지 않음(0)', ['0', ''].includes((await page.locator('#v_re_book').inputValue()).trim()), await page.locator('#v_re_book').inputValue())
  const main09 = (await page.locator('main').innerText()) ?? ''
  check('계산기 09: 1주 가치 44,000원 = 절세 설계와 같은 숫자', main09.includes('44,000원'), main09.slice(0, 0))
  await page.getByTestId('tool-attach-quick').first().click()
  await page.waitForTimeout(700)
  await page.getByTestId('tool-followup').getByRole('button', { name: '괜찮습니다' }).click()
  await page.getByTestId('tool-attach-go').click()
  await page.waitForTimeout(1200)
  check('보러 가기: 업체 상세의 도구 결과로(서류 탭 아님)', page.url().endsWith('/ops/clients/cli_hansol#tool-results'), page.url())
  const inView = await page.evaluate(() => { const r = document.getElementById('tool-results')?.getBoundingClientRect(); return !!r && r.top < window.innerHeight && r.bottom > 0 })
  check('보러 가기: 도구 결과가 화면에 보인다', inView)
  const tr = page.getByTestId('tool-results')
  check('도구 결과: 모듈마다 한 묶음 · 지난 결과 1개는 접힘', (await tr.locator('[data-tool-group="tax"]').count()) === 1 && ((await tr.getByTestId('tool-result-older').first().innerText()) ?? '').includes('지난 결과 1개') && (await tr.locator('[data-latest="false"]').count()) === 0)
  await tr.getByTestId('tool-result-older').first().click()
  check('도구 결과: 지난 결과 펼치기', (await tr.locator('[data-latest="false"]').count()) === 1)
  check('도구 결과: 만든 화면 다시 열기(09 계산기)', (await tr.getByTestId('tool-result-open').first().getAttribute('href')) === '/tools/tax?client=cli_hansol&m=calc&c=t3')
  const row = page.getByTestId('client-tools').locator('a[data-tool="tax"]')
  const rowText = (await row.innerText()) ?? ''
  check('모듈 입구: 지난번 결과 · 다시 계산하기', rowText.includes('지난번') && rowText.includes('44,000원') && rowText.includes('다시 계산하기'), rowText.replace(/\n/g, ' | '))
  await tr.getByTestId('tool-result-open').first().click()
  await page.waitForTimeout(800)
  check('다시 열기: 그 계산기 · 그 업체로 열린다', page.url().includes('c=t3') && page.url().includes('client=cli_hansol') && (await page.locator('#v_name').inputValue()) === '한솔테크(주)')

  await page.goto(BASE + '/ops/calendar', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  check('달력: 건 할 일이 뜬다', ((await page.locator('main').innerText()) ?? '').includes('절세 방안 설명 미팅'))
  check('JS 오류 없음', errors.length === 0, errors.join(' | '))
  await ctx.close()
}


/* ---------------- D-135 업체 ↔ AX 스튜디오 · 사실 되돌림 (1440) ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await setup(page)
  const orgs = () => page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.endsWith('.organizations')); return k ? JSON.parse(localStorage.getItem(k) ?? '[]') : [] })
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const axRow = page.getByTestId('client-tools').locator('a[data-feature="clients"]')
  check('업체 상세: 모듈 입구에 AX 프로젝트 줄', (await axRow.count()) === 1 && ((await axRow.innerText()) ?? '').includes('AX 프로젝트'))
  check('업체 상세: 이어진 AX 고객사가 없으면 AX 프로젝트 카드는 없다', (await page.getByTestId('ax-projects').count()) === 0)
  await page.goto(BASE + '/ax/open?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const o1 = (await orgs()).filter((o) => o.clientOpsId === 'cli_hansol')
  check('AX 열기: 업체 정보로 AX 고객사를 만든다(사업자번호 · 업종 · 끈)', o1.length === 1 && o1[0].name === '한솔테크(주)' && o1[0].businessRegistrationNumber === '123-45-67890', JSON.stringify(o1.map((o) => [o.name, o.businessRegistrationNumber])))
  check('AX 열기: 그 고객사 화면으로 · 업체 기록으로 돌아가는 줄', page.url().endsWith(`/clients/${o1[0]?.id}`) && (await page.getByTestId('org-client-link').count()) === 1, page.url())
  await page.goto(BASE + '/ax/open?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  check('AX 열기: 두 번 열어도 고객사는 하나', (await orgs()).filter((o) => o.clientOpsId === 'cli_hansol' || o.name === '한솔테크(주)').length === 1 && page.url().endsWith(`/clients/${o1[0]?.id}`))
  // 프로젝트 하나(AX 스튜디오에서 만든 것처럼)
  await page.evaluate((orgId) => {
    const k = Object.keys(localStorage).find((x) => x.endsWith('.organizations')).replace(/organizations$/, 'projects')
    const list = JSON.parse(localStorage.getItem(k) ?? '[]')
    const now = new Date().toISOString()
    list.push({ id: 'prj_ax1', projectCode: 'AX-2026-901', organizationId: orgId, name: '생산계획 AX MVP', projectType: 'ax', objective: '작업지시 자동화', currentStage: 'diagnosis', currentMvpLevel: 0, targetMvpLevel: 2, status: 'active', healthStatus: 'healthy', progress: 0, ownerId: 'u1', fundingRequired: false, targetInstitutions: [], targetFundingAmount: null, startDate: null, dueDate: null, nextAction: '대표 진단 설문', nextActionDueDate: null, riskSummary: '', createdAt: now, updatedAt: now, archivedAt: null })
    localStorage.setItem(k, JSON.stringify(list))
  }, o1[0]?.id)
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const axCard = page.getByTestId('ax-projects')
  const axText = (await axCard.innerText().catch(() => '')) ?? ''
  check('업체 상세: AX 프로젝트 카드(이름 · 단계 · 다음)', axText.includes('생산계획 AX MVP') && axText.includes('다음:'), axText.slice(0, 200))
  check('업체 상세: 프로젝트 · 고객사로 가는 길', (await axCard.locator('a[data-ax-project="prj_ax1"]').getAttribute('href')) === '/projects/prj_ax1' && (await page.getByTestId('ax-org-open').getAttribute('href')) === `/clients/${o1[0]?.id}`)

  // 창업감면: 판정에 적은 대표 생년월일 → 업체 정보로
  await page.goto(BASE + '/tools/startup-tax?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: '1분 판정하기' }).click()
  await page.waitForTimeout(800)
  const birthBtn = page.getByTestId('fact-send-representativeBirth').or(page.getByTestId('fact-sent-representativeBirth'))
  check('창업감면: 판정에 쓴 대표 생년월일을 업체 정보로(또는 같음)', (await birthBtn.count()) >= 1)
  check('창업감면: 원본 예시 날짜(1980-01-01)는 보내지 않는다', !(((await page.locator('main').innerText()) ?? '').includes('1980.01.01 — 업체 정보로')))
  check('JS 오류 없음(AX · 사실)', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- 390 · 360(1.30배) ---------------- */
for (const [width, scale] of [
  [390, 'default'],
  [360, 'extra_large'],
]) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await setup(page)
  await page.goto(BASE + '/tools/tax?client=cli_hansol&m=calc&c=t2', { waitUntil: 'networkidle' })
  await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
  await page.waitForTimeout(600)
  await page.getByTestId('tool-attach-quick').first().click()
  await page.waitForTimeout(700)
  const fu = page.getByTestId('tool-followup')
  const small = await fu.locator('button').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 43.5).map((e) => e.textContent?.trim()))
  check(`${width} ${scale}: 할 일 상자 단추 44px`, (await fu.count()) === 1 && small.length === 0, small.join('|'))
  let over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(`${width} ${scale}: 계산기 · 할 일 상자 가로 넘침 0`, over <= 1, String(over))
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
  await page.waitForTimeout(700)
  over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(`${width} ${scale}: 업체 상세(결과 · 모듈 입구) 가로 넘침 0`, over <= 1 && (await page.getByTestId('tool-results').count()) === 1, String(over))
  await ctx.close()
}

await browser.close()
console.log(`\n모듈 ↔ 업체 잇기: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
