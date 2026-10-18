/**
 * 상황 예시로 바로 설계 시험 (D-199 · 로드맵 5단계 '계산기는 상황 예시로').
 *
 *  D-201 기준 바로잡기: 이 업체에 맞는 상황만 설계(왜 한 줄) · 물어보면 열리는 상황(예/아니요 → 업체 기록) · 받을 자료 · 안 맞는 상황(까닭)
 *        가연 인터내셔널 같은 작은 업체 — 대표 급여 800만 · 만 60세 채용 · 계약직 · 연구소를 설계하지 않는다
 *  1440  숫자가 다 있는 업체 › 맞춤 추천 › 맞는 상황 12가지 · 바로 설계된 것 먼저 · 처음 6개 · 더 보기 · 모듈 칩으로 거르기
 *        · 누르면 그 자리에서 설계(결과 · 필요한 숫자 ✓ · 업체 기록에서 채운 값 · 가정 ★) · 한 번에 하나만 펼침
 *        · [다음 약속으로] → 업체 다음 약속
 *        · [모듈에서 이어서] → 절세 · 창업감면 · 정책자금 · 연구소 · 고용지원금 화면이 같은 가정으로 열려 바로 결과
 *          (업체 상세에서 본 결론 = 모듈 화면 결론 · 주소의 preset 은 한 번 쓰고 지움)
 *        빈 업체 › 받을 것만 말함(짐작 안 함) · 빠진 것 요청 문구(상황 하나 · 한 번에) · 주민등록번호 받지 않음
 *  360 · 390 × 1.0 · 1.30  가로 넘침 0 · 누르는 것 44px · 펼친 설계도 넘침 0
 *
 *   node e2e/scenarios.mjs http://localhost:4390
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

const NOW = '2026-09-01T00:00:00.000Z'
const FULL = {
  id: 'cli_scen',
  companyName: '한솔정밀(주)',
  representativeName: '김한솔',
  contactName: '김한솔',
  establishedAt: '2023-03-02',
  businessCategory: '제조업',
  businessItem: '정밀기계 부품',
  businessAddress: '경기도 화성시 동탄대로 1',
  representativeBirth: '1990-05-05',
  employeeCount: '12',
  status: 'active',
  taxProfile: { monthlySalary: '5,000,000', retainedEarnings: '800,000,000', ceoStartDate: '2023-03-02', par: '5000', loanBalance: '120,000,000', children: '2', estateRealEstate: '1,500,000,000' },
  shareholderRegister: [
    { id: 'h1', name: '김한솔', relation: 'ceo', shares: 8000, acquirePrice: 5000 },
    { id: 'h2', name: '김다온', relation: 'child', shares: 2000, acquirePrice: 5000 },
  ],
  factValues: { totalAssets: '3,000,000,000', totalLiabilities: '1,200,000,000', netIncome: '400,000,000', revenue: '5,000,000,000' },
  createdAt: NOW,
  updatedAt: NOW,
}
const EMPTY = { id: 'cli_scen_empty', companyName: '빈칸상사', status: 'active', createdAt: NOW, updatedAt: NOW }
// D-201 대표 지적 업체 — 법인 · 무역 · 직원 2명 · 매출 1.5억 · 영업이익 적자 · 설립 2년 · 대표 만 45세 · 서울
const SMALL = {
  id: 'cli_scen_small',
  companyName: '가연인터내셔널 주식회사',
  corporateNumber: '110111-1234567',
  representativeName: '이가연',
  businessCategory: '도매 및 소매업',
  businessItem: '무역',
  establishedAt: '2024-05-01',
  employeeCount: '2',
  representativeBirth: '1981-03-03',
  businessAddress: '서울특별시 강남구 테헤란로 1',
  status: 'active',
  factValues: { revenue: '150,000,000', operatingProfit: '-5,000,000', netIncome: '-8,000,000' },
  createdAt: NOW,
  updatedAt: NOW,
}

async function seed(page) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(
    (rows) => {
      const k = 'axmvp.v1.operations_clients'
      const list = JSON.parse(localStorage.getItem(k) ?? '[]').filter((r) => !rows.some((x) => x.id === r.id))
      list.push(...rows)
      localStorage.setItem(k, JSON.stringify(list))
    },
    [FULL, EMPTY, SMALL],
  )
}

const record = (page, id) => page.evaluate((cid) => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === cid), id)

async function openSmart(page, id) {
  await page.goto(`${BASE}/ops/clients/${id}?tab=smart`, { waitUntil: 'networkidle' })
  await page.getByTestId('smart-scenarios').waitFor({ timeout: 15000 })
}

const row = (page, id) => page.locator(`[data-testid="scenario-row"][data-id="${id}"]`)

/** 그 상황을 펼친다(처음 6개 밖이면 더 보기부터) */
async function expand(page, id) {
  if ((await row(page, id).count()) === 0 && (await page.getByTestId('scenario-more').count())) await page.getByTestId('scenario-more').click()
  const r = row(page, id)
  if ((await r.getByTestId('scenario-detail').count()) === 0) await r.getByTestId('scenario-toggle').click()
  await r.getByTestId('scenario-detail').waitFor()
  return r
}

async function dialogText(page) {
  const d = page.getByRole('dialog')
  await d.waitFor()
  const t = await d.locator('textarea').inputValue()
  await page.keyboard.press('Escape')
  await d.waitFor({ state: 'detached' }).catch(() => {})
  return t
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await seed(page)
  await openSmart(page, 'cli_scen')

  // D-232 판정 넓히기 — 가지급금 1.2억이 있는 업체: 절세가 '가능성 높음' + 07 가지급금 계산기 금액 · 퇴직금 한도는 '그 밖에'
  const taxIns = page.locator('[data-testid="smart-insight"][data-key="tax"]')
  const taxTxt = await taxIns.innerText()
  check('D-232 모듈별 판정 › 절세 — 가지급금 1.2억 → 가능성 높음 · "해마다 약 n 손해" · 퇴직금 한도 · 세무사 검토 · [가지급금 정리 설계]', (await taxIns.getAttribute('data-tone')) === 'good' && /해마다 약 .+ 손해/.test(await taxIns.getByTestId('smart-insight-amount').innerText()) && taxTxt.includes('퇴직금 한도') && taxTxt.includes('세무사 검토') && taxTxt.includes('가지급금 정리 설계'), taxTxt.slice(0, 200))
  const taxHref = (await taxIns.getByRole('link').getAttribute('href')) ?? ''
  check('D-232 절세 판정 → 가지급금 정리 상황 예시로 열림(같은 업체 · preset=tax-loan)', taxHref.includes('/tools/tax') && taxHref.includes('client=cli_scen') && taxHref.includes('preset=tax-loan'), taxHref)

  const box = page.getByTestId('smart-scenarios')
  const count = Number(await box.getAttribute('data-count'))
  const ready = Number(await box.getAttribute('data-ready'))
  // D-209: '한솔정밀(주)' 은 이름으로 법인 — 계산기도 상황 예시처럼 법인으로 알아(사업자 구분 ✓) 연구소 2명 상황이 '바로 설계됨' 으로(8 → 9)
  check('D-201 맞춤 추천 › 이 업체에 맞는 상황 12가지 · 바로 설계됨 9가지(23가지를 다 붙이지 않음 · D-209 법인 판단 하나로)', count === 12 && ready === 9, `${count} · ${ready}`)
  check('맞는 상황 n가지 · 바로 설계됨 n가지 글자', (await page.getByTestId('scenario-ready-count').innerText()).includes(`맞는 상황 ${count}가지 · 바로 설계됨 ${ready}가지`))
  const whys = await page.getByTestId('scenario-why').allInnerTexts()
  check('D-201 맞는 상황마다 "왜 이 업체에" 한 줄 — 이 업체 숫자(이익 · 매출 · 설립일 …)', whys.length >= 6 && whys.every((w) => w.startsWith('왜 이 업체에:') && /\d/.test(w)), whys.slice(0, 3).join(' | '))
  const first = await page.getByTestId('scenario-row').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-fit')}/${e.getAttribute('data-state')}`))
  check('처음엔 6개 · 맞음 + 바로 설계된 것 먼저', first.length === 6 && first.every((s) => s === 'fit/ready'), first.join(','))
  await page.getByTestId('scenario-more').click()
  check('맞는 상황 더 보기 → 12개 전부(모두 맞음)', (await page.getByTestId('scenario-row').count()) === 12 && (await page.locator('[data-testid="scenario-row"][data-fit="fit"]').count()) === 12)

  // 모듈 칩으로 거르기(맞는 상황 안에서)
  await page.locator('[data-testid="scenario-filter"][data-module="tax"]').click()
  const mods = await page.getByTestId('scenario-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-module')))
  check('절세 칩 → 9개 · 모두 절세', mods.length === 9 && mods.every((m) => m === 'tax'), mods.join(','))
  check('칩이 눌림 표시(aria-pressed)', (await page.locator('[data-testid="scenario-filter"][data-module="tax"]').getAttribute('aria-pressed')) === 'true')
  await page.locator('[data-testid="scenario-filter"][data-module="all"]').click()

  // 물어보면 열리는 상황 — 같은 질문은 한 줄 · 처음엔 세 개만 · 예 → 그 자리에서 설계로
  check('D-201 질문은 처음에 세 개만(한꺼번에 묻지 않음) · 질문 더 보기', (await page.getByTestId('scenario-question').count()) === 3 && (await page.getByTestId('scenario-questions-more').count()) === 1)
  await page.getByTestId('scenario-questions-more').click()
  const qs = await page.getByTestId('scenario-question').evaluateAll((els) => els.map((e) => e.getAttribute('data-q')))
  check('D-201 물어보면 열리는 상황 — 질문 8개(청년 채용 질문 하나에 청년 채용 · 정책자금 청년 채용 둘)', qs.length === 8 && qs.includes('hireYouth') && qs.includes('hireSenior') && qs.includes('contract') && ((await page.locator('[data-testid="scenario-question"][data-q="hireYouth"]').innerText()).match(/청년/g) ?? []).length >= 3, qs.join(','))
  check('고용지원금 4가지는 맞음 목록에 없다(직원 나이 · 계약직은 기록에 없음 → 묻는다)', (await page.locator('[data-testid="scenario-row"][data-module="employment"]').count()) === 0)
  await page.locator('[data-testid="scenario-question"][data-q="hireYouth"]').getByTestId('scenario-answer-yes').click()
  await page.locator('[data-testid="scenario-row"][data-id="emp-youth"]').waitFor({ timeout: 10000 })
  check('"예" → 청년 채용 · 정책자금 청년 채용 둘 다 맞음으로(그 자리에서) · 업체 기록에 답', (await row(page, 'policy-hiring').count()) === 1 && (await record(page, 'cli_scen'))?.decided?.['scn.hireYouth']?.a === 'yes')
  check('맞음으로 온 까닭 — "대표 답"', (await row(page, 'emp-youth').getByTestId('scenario-why').innerText()).includes('대표 답'))
  // D-210 '예' 로 새로 맞게 된 상황 — 위쪽 목록에 조용히 생기지 않고, 펼쳐서 그 자리로 · '방금 열림'
  await page.locator('[data-testid="scenario-row"][data-fresh="1"] [data-testid="scenario-detail"]').waitFor({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(700)
  const fresh = await page.locator('[data-testid="scenario-row"][data-fresh="1"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')).sort())
  const openFresh = page.locator('[data-testid="scenario-row"][data-fresh="1"]:has([data-testid="scenario-detail"])')
  const inView = await openFresh.first().evaluate((e) => {
    const b = e.getBoundingClientRect()
    return b.top < window.innerHeight && b.bottom > 0
  }).catch(() => false)
  check('D-210 "예" → 새로 맞게 된 두 상황에 "방금 열림" · 그중 하나를 펼쳐 화면 안으로', fresh.join(',') === 'emp-youth,policy-hiring' && (await openFresh.count()) === 1 && inView && (await page.getByTestId('scenario-fresh').count()) === 2, `${fresh.join(',')} · ${inView}`)
  await page.waitForTimeout(500)
  await page.locator('[data-testid="scenario-question"][data-q="contract"]').getByTestId('scenario-answer-no').click()
  await page.waitForTimeout(500)
  await page.getByTestId('scenario-nofit').locator('summary').click()
  const noRows = await page.getByTestId('scenario-no-row').allInnerTexts()
  check('"아니요" → 안 맞는 상황에 까닭과 함께 · 가업승계(업력 3년) · 본점 이전(이미 밖)도 까닭', noRows.some((t) => t.includes('계약직') && t.includes('대표 답')) && noRows.some((t) => t.includes('업력 3년')) && noRows.some((t) => t.includes('과밀억제권역 밖')), noRows.join(' | '))
  // 답한 뒤 0.6초는 두 번 눌림 막기(D-210)로 다른 답 단추를 받지 않는다 — 그 뒤에 누른다(바쁜 PC 에서 흔들리던 것)
  await page.waitForTimeout(700)
  await page.locator('[data-testid="scenario-no-row"][data-id="emp-convert"]').getByTestId('scenario-undo').click()
  await page.waitForTimeout(500)
  check('[답 바꾸기] → 다시 묻는다', (await page.locator('[data-testid="scenario-question"][data-q="contract"]').count()) === 1 && (await record(page, 'cli_scen'))?.decided?.['scn.contract'] === undefined)
  // D-209 고용지원금 칩으로 거른 채 그 답을 바꾸면(고용지원금이 맞는 상황에서 빠짐) → 빈 목록에 갇히지 않고 전체로
  await page.locator('[data-testid="scenario-filter"][data-module="employment"]').click()
  const empRow = await expand(page, 'emp-youth')
  await page.waitForTimeout(700)
  await empRow.getByTestId('scenario-undo').click()
  await page.waitForTimeout(600)
  const rowsAfter = await page.getByTestId('scenario-row').count()
  check('D-209 거른 모듈이 맞는 상황에서 빠지면 → 전체 목록으로(빈 목록 · 칩 없음에 갇히지 않음)', rowsAfter >= 6 && (await page.locator('[data-testid="scenario-row"][data-module="employment"]').count()) === 0, String(rowsAfter))
  await page.waitForTimeout(700)
  await page.locator('[data-testid="scenario-question"][data-q="hireYouth"]').getByTestId('scenario-answer-yes').click()
  await page.locator('[data-testid="scenario-row"][data-id="emp-youth"]').waitFor({ timeout: 10000 })

  // 누르면 그 자리에서 설계
  const cash = await expand(page, 'tax-cash-1e')
  const cashHead = (await cash.getByTestId('scenario-headline').innerText()).trim()
  const cashLines = await cash.locator('[data-testid="scenario-lines"] li').allInnerTexts()
  check('절세 1억 — 순부담 금액 · 펼친 곳에 머리글을 다시 쓰지 않음', (await cash.getByTestId('scenario-amount').innerText()).startsWith('순부담') && cashLines.every((l) => l.trim() !== cashHead), cashLines.join(' | '))
  const needOk = await cash.getByTestId('scenario-need').evaluateAll((els) => els.map((e) => e.getAttribute('data-ok')))
  check('필요한 숫자 모두 ✓(업체 기록에 다 있음)', needOk.length >= 3 && needOk.every((x) => x === '1'), needOk.join(''))
  check('업체 기록에서 채운 값 알림(자산 · 순이익)', (await cash.getByTestId('scenario-filled').innerText()).includes('자산'))
  check('[절세에서 이어서] 주소 — 이 업체 · 이 상황', ((await cash.getByTestId('scenario-open').getAttribute('href')) ?? '').endsWith('/tools/tax?client=cli_scen&preset=tax-cash-1e'))
  await expand(page, 'emp-youth')
  check('한 번에 하나만 펼침', (await page.getByTestId('scenario-detail').count()) === 1 && (await cash.getByTestId('scenario-detail').count()) === 0)
  const youthHead = (await row(page, 'emp-youth').getByTestId('scenario-headline').innerText()).trim()
  const startupHead = (await row(page, 'startup-new').getByTestId('scenario-headline').innerText()).trim()
  const policyHead = (await row(page, 'policy-working').getByTestId('scenario-headline').innerText()).trim()
  // '연간 약 2,000만원' → '2,000만원'
  const labAmount = ((await row(page, 'lab-two').getByTestId('scenario-amount').innerText()).match(/[\d,]+만원/) ?? [''])[0]

  // 다음 약속으로
  await (await expand(page, 'tax-cash-1e')).getByTestId('scenario-next').click()
  await page.waitForTimeout(600)
  check('[다음 약속으로] → 업체 다음 약속에 그 상황', ((await record(page, 'cli_scen'))?.nextAction ?? '').includes('대표가 1억 가져오기'))

  // 모듈에서 이어서 — 절세
  await (await expand(page, 'tax-cash-1e')).getByTestId('scenario-open').click()
  await page.getByTestId('tax-preset-note').waitFor({ timeout: 15000 })
  await page.waitForTimeout(500)
  check('절세 설계가 그 상황 문장으로 열림 · 결과 바로', (await page.getByTestId('plan-text').inputValue()) === '1억 현금화하고 싶어' && (await page.getByTestId('plan-glance').count()) >= 1)
  check('절세 — 상황 예시 알림 · 업체 기록에서 채움(저장은 누를 때만)', (await page.getByTestId('tax-preset-note').innerText()).includes('대표가 1억 가져오기') && (await page.getByTestId('tax-preset-note').innerText()).includes('업체 기록에서 채움'))
  // 업체 상세 머리글: '세후 1억원 — 추천 주식 팔기(자기주식 등) · 순부담 2,703만원' → 추천 방법 이름
  const best = (cashHead.match(/추천 (.+?)(?:\(| ·|$)/)?.[1] ?? '').trim()
  check('업체 상세에서 본 결론 = 절세 설계 결론(같은 추천 방법)', best.length >= 2 && (await page.getByTestId('plan-glance').first().innerText()).includes(best), `${cashHead} | ${best}`)
  check('주소의 preset 은 한 번 쓰고 지움(새로고침해도 칸을 덮지 않음)', !page.url().includes('preset='), page.url())

  // 창업감면
  await page.goto(`${BASE}/tools/startup-tax?client=cli_scen&preset=startup-new`, { waitUntil: 'networkidle' })
  await page.getByTestId('startup-preset-note').waitFor({ timeout: 15000 })
  const oneline = (await page.getByTestId('startup-tax-oneline').innerText()).trim()
  check('창업감면 — 바로 판정 · 업체 상세 결론과 같은 한 줄', oneline.length > 0 && oneline === startupHead, `${oneline} | ${startupHead}`)
  const stChips = await page.getByTestId('startup-preset-note').getByTestId('preset-chip').allInnerTexts()
  check('D211 창업감면 — 넣은 가정 칩(새로 창업) · 업체 숫자는 칩에 없음', stChips.includes('새로 창업') && !stChips.some((c) => /직원|매출|주소/.test(c)), stChips)
  await page.getByTestId('startup-preset-note').getByTestId('preset-clear').click()
  await page.waitForTimeout(400)
  check('D211 창업감면 — [가정 빼기] → 알림이 \'가정을 뺐어요\' 로 · 칩 없음', (await page.getByTestId('startup-preset-note').getAttribute('data-cleared')) === '1' && (await page.getByTestId('preset-chip').count()) === 0)

  // 정책자금
  await page.goto(`${BASE}/tools/policy-funding/diagnosis?client=cli_scen&preset=policy-working`, { waitUntil: 'networkidle' })
  await page.getByTestId('pf-preset-note').waitFor({ timeout: 15000 })
  await page.locator('#result').waitFor({ timeout: 10000 })
  const agency = policyHead.split('추천 기관 ')[1] ?? ''
  check('정책자금 — 바로 진단 · 같은 추천 기관', !!agency && (await page.locator('#result').innerText()).includes(agency), policyHead)
  check('D-209 정책자금 — 주소의 preset 은 한 번 쓰고 지움(새로고침 · 다시 열기 주소가 그 가정을 또 덮지 않음)', !page.url().includes('preset='), page.url())
  const pfChips = await page.getByTestId('pf-preset-note').getByTestId('preset-chip').allInnerTexts()
  check('D211 정책자금 — 넣은 가정 칩(운전자금)', pfChips.join() === '운전자금', pfChips)
  await page.getByTestId('pf-preset-note').getByTestId('preset-clear').click()
  await page.waitForTimeout(500)
  check('D211 정책자금 — [가정 빼기] → \'가정을 뺐어요\' · 진단 결과는 다시 누를 때(자동 진단 안 함)', (await page.getByTestId('pf-preset-note').getAttribute('data-cleared')) === '1' && (await page.locator('#result').count()) === 0)

  // D-209 연구소 — 예전에 '중견기업' 을 골라 두었어도 상황 예시는 그 가정을 비우고 카드와 같은 숫자로
  await page.goto(`${BASE}/tools/labcare/tax?client=cli_scen`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '중견기업', exact: true }).first().click().catch(async () => page.getByText('중견기업', { exact: true }).first().click())
  await page.waitForTimeout(600)

  // 연구소
  await page.goto(`${BASE}/tools/labcare/tax?client=cli_scen&preset=lab-two`, { waitUntil: 'networkidle' })
  await page.getByTestId('lab-preset-note').waitFor({ timeout: 15000 })
  const payroll = await page.getByLabel('연구전담요원 인건비 합계').inputValue()
  check('연구소 — 연구원 2명 인건비 8,000만원이 칸에 · 바로 계산(업체 상세와 같은 연간 약 2,000만원)', payroll.replace(/\D/g, '') === '80000000' && (await page.locator('body').innerText()).includes(`연간 약 ${labAmount}`), `${payroll} | ${labAmount}`)
  const labChips = await page.getByTestId('lab-preset-note').getByTestId('preset-chip').allInnerTexts()
  check('D211 연구소 — 넣은 가정 칩(인건비 8,000만원 · 일반 R&D)', labChips.join('|') === '인건비 8,000만원|일반 R&D', labChips)
  // 칸을 직접 고치면 그 칸은 이제 대표 값 — 칩에서 빠지고, [가정 빼기] 도 그 칸은 그대로 둔다
  await page.getByLabel('연구 재료비·시약·부품비').fill('12000000')
  await page.getByLabel('연구전담요원 인건비 합계').fill('90000000')
  await page.waitForTimeout(400)
  const labChips2 = await page.getByTestId('lab-preset-note').getByTestId('preset-chip').allInnerTexts()
  check('D211 연구소 — 인건비를 직접 고치면 인건비 칩은 빠짐(일반 R&D 만 남음)', labChips2.join('|') === '일반 R&D', labChips2)
  await page.getByTestId('lab-preset-note').getByTestId('preset-clear').click()
  await page.waitForTimeout(400)
  check('D211 연구소 — [가정 빼기] 뒤에도 직접 고친 인건비 9,000만 · 재료비 1,200만은 그대로', (await page.getByLabel('연구전담요원 인건비 합계').inputValue()).replace(/\D/g, '') === '90000000' && (await page.getByLabel('연구 재료비·시약·부품비').inputValue()).replace(/\D/g, '') === '12000000' && (await page.getByTestId('lab-preset-note').getAttribute('data-cleared')) === '1')

  // D-209 가업승계 준비 — 카드처럼 첫째 자녀 · 지분 10% 로(예전: 받는 사람이 비어 '골라 주세요')
  await page.goto(`${BASE}/tools/tax?client=cli_scen&preset=tax-succession`, { waitUntil: 'networkidle' })
  await page.getByTestId('tax-preset-note').waitFor({ timeout: 15000 })
  await page.waitForTimeout(500)
  const giftTo = await page.getByLabel('받는 사람').first().inputValue().catch(() => '')
  check('D-209 절세 — 가업승계 준비 상황은 받는 사람(첫째 자녀 h2)이 골라진 채로 열림', giftTo === 'h2', giftTo)

  // 고용지원금
  await page.goto(`${BASE}/tools/employment/diagnosis?client=cli_scen&preset=emp-youth`, { waitUntil: 'networkidle' })
  await page.getByTestId('emp-preset-note').waitFor({ timeout: 15000 })
  await page.getByText('가능성 높음', { exact: false }).first().waitFor({ timeout: 10000 })
  const top = youthHead.split(' — ')[1] ?? ''
  check('고용지원금 — 청년 1명 바로 진단 · 같은 1순위 지원금', !!top && (await page.locator('body').innerText()).includes(top), youthHead)
  check('고용지원금 — 회사 규모 칸에 이 업체 직원 수(12)', (await page.getByPlaceholder('피보험자 수').inputValue()) === '12')
  const empChips = await page.getByTestId('emp-preset-note').getByTestId('preset-chip').allInnerTexts()
  check('D211 고용지원금 — 넣은 가정 칩(신규 채용 · 청년 · 만 29세 · 정규직) · 직원 수는 칩에 없음', empChips.join('|') === '신규 채용|청년|만 29세|정규직', empChips)
  await page.getByTestId('emp-preset-note').getByTestId('preset-clear').click()
  await page.waitForTimeout(600)
  check('D211 고용지원금 — [가정 빼기] → 나이 칸 비고 · 직원 수(12)는 남고 · 결과는 다시 누를 때', (await page.getByTestId('emp-preset-note').getAttribute('data-cleared')) === '1' && (await page.getByPlaceholder('피보험자 수').inputValue()) === '12' && (await page.getByPlaceholder('29').inputValue()) === '' && !(await page.getByText('가능성 높음', { exact: false }).first().isVisible().catch(() => false)))
  // 고용지원금에 아직 등록 안 한 업체라도 상황 예시로 열면 등록 창이 결과를 가리지 않는다(D-94 등록 창은 업체 입구로 열 때만)
  await page.waitForTimeout(600)
  check('고용지원금 — 업체 등록 창이 진단 결과를 가리지 않음', !(await page.getByText('🏢 업체 정보').first().isVisible().catch(() => false)))

  // 빈 업체 — 짐작하지 않고 받을 것을 말한다
  await openSmart(page, 'cli_scen_empty')
  const eb = page.getByTestId('smart-scenarios')
  check('빈 업체 — 맞는 상황 0(짐작해서 붙이지 않음) · 안내 한 줄', Number(await eb.getAttribute('data-count')) === 0 && (await page.getByTestId('scenario-fit-empty').count()) === 1)
  check('빈 업체 — 물어볼 것 · 받을 자료로만', Number(await eb.getAttribute('data-ask')) >= 5 && Number(await eb.getAttribute('data-data')) >= 10 && Number(await eb.getAttribute('data-no')) === 0)
  await page.getByTestId('scenario-data').locator('summary').click()
  await page.getByTestId('scenario-data-request').click()
  const all = await dialogText(page)
  check(
    '받을 자료 요청 문구 — 회사 이름 · 같은 자료 한 줄(재무제표 · 사업자등록증) · 주민등록번호 받지 않음',
    all.includes('빈칸상사') && (all.match(/^\d+\. 최근 재무제표/gm) ?? []).length === 1 && (all.match(/^\d+\. 사업자등록증 사본/gm) ?? []).length === 1 && all.includes('주민등록번호는 받지 않습니다'),
    all.slice(0, 300),
  )

  // D-201 대표 지적 업체 — 작은 무역 법인
  await openSmart(page, 'cli_scen_small')
  const sb = page.getByTestId('smart-scenarios')
  const smallIds = (await page.getByTestId('scenario-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))).sort()
  check('가연 같은 작은 업체 — 맞는 상황은 근거 있는 3개뿐(창업감면 · 본점 이전 · 운전자금)', Number(await sb.getAttribute('data-count')) === 3 && smallIds.join(',') === 'policy-working,startup-move,startup-new', smallIds.join(','))
  const bodyText = await sb.innerText()
  check('가연 — "세후 월 800만원" 은 설계되지 않음(맞음 목록에 없음)', (await row(page, 'tax-salary-net').count()) === 0 && (await row(page, 'tax-salary-rate').count()) === 0)
  if (await page.getByTestId('scenario-questions-more').count()) await page.getByTestId('scenario-questions-more').click()
  check('가연 — 만 60세 이상 · 계약직은 질문으로만(설계 안 함)', (await page.locator('[data-testid="scenario-question"][data-q="hireSenior"]').count()) === 1 && (await page.locator('[data-testid="scenario-question"][data-q="contract"]').count()) === 1 && (await row(page, 'emp-senior').count()) === 0)
  await page.getByTestId('scenario-nofit').locator('summary').click()
  const smallNo = await page.getByTestId('scenario-no-row').allInnerTexts()
  check('가연 — 대표 급여는 "이익이 모자라요" 까닭과 함께 안 맞음', smallNo.some((t) => t.includes('세후 월 800만원') && t.includes('영업이익') && t.includes('모자라요')), smallNo.join(' | ').slice(0, 300))
  check('가연 — 화면에 "바로 설계됨" 이 붙은 급여 · 고령자 줄 없음', !/세후 월 800만원[^\n]*바로 설계됨/.test(bodyText))

  check('화면 오류 0', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

/* ---------------- 360 · 390 × 1.0 · 1.30 ---------------- */
for (const width of [360, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await seed(page)
  await openSmart(page, 'cli_scen')
  await page.getByTestId('scenario-more').click()
  await expand(page, 'tax-treasury')
  for (const scale of ['default', 'extra_large']) {
    await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
    await page.waitForTimeout(400)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    check(`${width} ${scale}: 상황 예시(펼침 포함) 가로 넘침 0`, over <= 1, String(over))
    const wide = await page.getByTestId('smart-scenarios').locator('*').evaluateAll((els) => {
      const W = document.documentElement.clientWidth
      return els
        .filter((e) => {
          const b = e.getBoundingClientRect()
          return b.width > 0 && (b.right > W + 1 || b.left < -1)
        })
        .map((e) => (e.textContent || '').trim().slice(0, 20))
    })
    check(`${width} ${scale}: 화면 밖으로 나간 글자 0`, wide.length === 0, wide.slice(0, 4).join('|'))
    const small = await page
      .getByTestId('smart-scenarios')
      .locator('button, a')
      .evaluateAll((els) =>
        els
          .filter((e) => {
            const b = e.getBoundingClientRect()
            return b.width > 0 && b.height > 0 && b.height < 43.5
          })
          .map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)),
      )
    check(`${width} ${scale}: 누르는 것 44px`, small.length === 0, small.slice(0, 6).join('|'))
  }
  await ctx.close()
}

/* ---------------- D-210 휴대폰 — 답을 두 번 눌러도 한 번만(아래 질문이 손가락 밑으로 올라와도) ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await seed(page)
  await openSmart(page, 'cli_scen_small')
  if (await page.getByTestId('scenario-questions-more').count()) await page.getByTestId('scenario-questions-more').click()
  const qRow = (q) => page.locator(`[data-testid="scenario-question"][data-q="${q}"]`)
  const qIds = await page.getByTestId('scenario-question').evaluateAll((els) => els.map((e) => e.getAttribute('data-q')))
  const [q1, q2] = qIds
  const center = async (loc) => {
    await loc.evaluate((e) => e.scrollIntoView({ block: 'center' }))
    const b = await loc.boundingBox()
    return [b.x + b.width / 2, b.y + b.height / 2]
  }
  const answered = async () => Object.keys((await record(page, 'cli_scen_small'))?.decided ?? {}).filter((k) => k.startsWith('scn.'))
  const before = await answered()
  await page.waitForTimeout(300)
  const [x1, y1] = await center(qRow(q1).getByTestId('scenario-answer-yes'))
  await page.touchscreen.tap(x1, y1)
  // 첫 답으로 그 질문 줄이 빠지면 아래 질문이 올라온다 — 두 번째 손가락이 바로 그 '예' 에 닿은 경우
  await qRow(q1).waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
  const b2 = await qRow(q2).getByTestId('scenario-answer-yes').boundingBox()
  await page.touchscreen.tap(b2.x + b2.width / 2, b2.y + b2.height / 2)
  await page.waitForTimeout(1000)
  const after = await answered()
  check('D-210 390 — 첫 답 바로 뒤 올라온 아래 질문을 같이 누르지 않음(답 하나)', after.length === before.length + 1 && after.includes(`scn.${q1}`) && !after.includes(`scn.${q2}`), `${q1}/${q2} · ${before.join(',')} → ${after.join(',')}`)
  // 잠깐 뒤에는 다음 질문에 답할 수 있다(막힌 채로 남지 않음)
  const [x2, y2] = await center(qRow(q2).getByTestId('scenario-answer-yes'))
  await page.touchscreen.tap(x2, y2)
  await page.waitForTimeout(1000)
  check('D-210 390 — 조금 뒤 다음 질문은 정상으로 답해짐', (await answered()).includes(`scn.${q2}`))
  await ctx.close()
}

await browser.close()
console.log(`\n상황 예시: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
