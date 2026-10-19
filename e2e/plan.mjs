/**
 * 상황별 한 장 설계서 시험 (D-242 · 로드맵 7단계 — '청년 2명 채용' = 고용지원금 합계 + 세액공제 + 정책자금 힌트 + 추천 행동 → 업체에 붙이기).
 *
 *  1440  숫자가 다 있는 업체 › 맞춤 추천 › 상황별 한 장 설계서
 *        · 맞는 상황이 먼저(연구소 — 업종 · 직원 근거) · 청년 채용은 '확인' — 예/아니요 하나 · '예' 라면 받을 설계를 미리 보여 줌
 *        · 청년 2명 → 1년 안 받을 돈 = 고용지원금 1,440만 + 세액공제 2,900만 = 4,340만 · 3년 합계 · 정책자금(대출)은 따로
 *        · 5명으로 바꾸면 그 숫자로 다시 · '예' → 맞음(업체 기록 · 상황 예시도 같이 열림)
 *        · 진행 순서 체크 하나 빼고 [업체에 붙이기] → 도구 결과 한 줄 · 할 일 4개(달력) · 다음 할 일이 비면 첫 행동 · 두 번 붙지 않음
 *        · 한 장 인쇄(인쇄하는 동안만 종이) · 요약 복사 · 모듈 화면 링크(같은 업체 · 같은 가정)
 *        · 아니요 → 안 맞음(설계 숨김) · 답 바꾸기 · 빈 업체 → 받을 숫자 요청 문구
 *  D-244 · 창업 5년 안 채용 — 창업감면(판정만 · 판정됨) + 청년 채용 같은 금액 · 세액공제 창업 확인 두 줄 · 창업감면 판정으로 이어서
 *        · 고르지 않은 채 맨 앞 상황에 '아니요' 해도 그 상황에 머묾(답 바꾸기 보임) · 다시 붙이면 같은 할 일은 다시 안 걸림
 *        · 인쇄 — 휴대폰처럼 print() 가 바로 돌아와도 다 찍은 뒤(afterprint)에 종이를 치움
 *  360 · 390 × 1.0 · 1.30  가로 넘침 0 · 화면 밖 글자 0 · 누르는 것 44px
 *
 *   node e2e/plan.mjs http://localhost:4390 [스크린샷 폴더]
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
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' ' + detail}`)
}

const NOW = '2026-09-01T00:00:00.000Z'
const FULL = {
  id: 'cli_plan',
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
  factValues: { netIncome: '400,000,000', revenue: '5,000,000,000' },
  createdAt: NOW,
  updatedAt: NOW,
}
const EMPTY = { id: 'cli_plan_empty', companyName: '빈칸상사', status: 'active', createdAt: NOW, updatedAt: NOW }

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
    [FULL, EMPTY],
  )
}

const record = (page, id) => page.evaluate((cid) => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === cid), id)

async function openSmart(page, id) {
  await page.goto(`${BASE}/ops/clients/${id}?tab=smart`, { waitUntil: 'networkidle' })
  await page.getByTestId('plan-body').waitFor({ timeout: 15000 })
}

const body = (page) => page.getByTestId('plan-body')
const pick = (page, id) => page.locator(`[data-testid="plan-pick"][data-id="${id}"]`)
const attr = (page, a) => body(page).getAttribute(a)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await seed(page)
  await openSmart(page, 'cli_plan')

  // 1. 고르는 판 — 맞는 상황이 먼저
  const picks = await page.getByTestId('plan-pick').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-id')}:${e.getAttribute('data-fit')}`))
  check('고르는 판 4가지 · 맞는 상황(연구소 — 제조 · 직원 12명 · 연구소 없음)이 먼저 · 채용 · 창업 5년 안 채용은 확인', picks.join(',') === 'lab-start:fit,hire-youth:ask,hire-senior:ask,startup-hire:ask', picks.join(','))
  check('처음엔 맞는 상황(연구소 2명)으로 바로 설계 · 왜 이 업체에', (await attr(page, 'data-plan')) === 'lab-start' && (await page.getByTestId('plan-fit').innerText()).includes('왜 이 업체에') && (await page.getByTestId('plan-total-amount').innerText()).includes('2,000만원'))
  if (SHOTS) await page.getByTestId('situation-plan').screenshot({ path: `${SHOTS}/plan-1440-lab.png` })

  // 2. 청년 채용 — 확인(예/아니요) + 미리 보는 설계
  await pick(page, 'hire-youth').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="plan-body"]')?.getAttribute('data-plan') === 'hire-youth')
  check('청년 채용 — 계획은 기록에 없어 예/아니요 하나만 묻고, 아래에 "예" 라면 받을 설계', (await page.getByTestId('plan-ask').innerText()).includes('청년(만 15~34세)을 새로 뽑을 계획') && (await page.getByTestId('plan-total').count()) === 1)
  const blocks = await page.getByTestId('plan-block').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-key')}:${e.getAttribute('data-state')}`))
  check('한 장에 세 모듈 — 고용지원금 · 통합고용세액공제 · 정책자금(모두 계산됨)', blocks.join(',') === 'subsidy:ok,credit:ok,policy:ok', blocks.join(','))
  const total = await page.getByTestId('plan-total').innerText()
  check(
    '청년 2명 — 1년 안 약 4,340만원(고용지원금 1,440만 + 세액공제 2,900만) · 3년 합계 · 정책자금(대출)은 따로',
    (await attr(page, 'data-first')) === '43400000' && total.includes('약 4,340만원') && total.includes('최대 1,440만원') && total.includes('2,900만원') && total.includes('3년 합계') && total.includes('정책자금(대출)은 따로'),
    total,
  )
  const sub = page.locator('[data-testid="plan-block"][data-key="subsidy"]')
  check('고용지원금 — 청년일자리도약장려금 1명 720만 × 2명 · 받는 때 회차 · 수도권 조건 ★', (await sub.innerText()).includes('720만원 × 2명') && (await sub.innerText()).includes('받는 때:') && (await sub.innerText()).includes('수도권은 취업애로'))
  const subHref = (await sub.getByTestId('plan-block-open').getAttribute('href')) ?? ''
  check('고용지원금 → 채용 진단이 같은 업체 · 같은 가정으로 열림(preset=emp-youth)', subHref.includes('/tools/employment/diagnosis') && subHref.includes('client=cli_plan') && subHref.includes('preset=emp-youth'), subHref)
  const credHref = (await page.locator('[data-testid="plan-block"][data-key="credit"]').getByTestId('plan-block-open').getAttribute('href')) ?? ''
  check('세액공제 → 명부 진단(같은 업체)', credHref.startsWith('/tools/employment/roster') && credHref.includes('client=cli_plan'), credHref)
  if (SHOTS) await page.getByTestId('situation-plan').screenshot({ path: `${SHOTS}/plan-1440-youth2.png` })

  // 3. 사람 수 → 그 숫자로 다시
  await page.locator('[data-testid="plan-count"][data-n="5"]').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="plan-body"]')?.getAttribute('data-count') === '5')
  check('5명 → 1년 안 1억 850만원(720만 × 5 + 1,450만 × 5) · 제목 청년 5명 채용', (await attr(page, 'data-first')) === '108500000' && (await page.getByTestId('plan-total').innerText()).includes('청년 5명 채용'))
  check('사람 수 칩 눌림 표시(aria-pressed)', (await page.locator('[data-testid="plan-count"][data-n="5"]').getAttribute('aria-pressed')) === 'true')

  // 4. '예' → 맞음 · 업체 기록 · 상황 예시도 같이
  await page.getByTestId('plan-answer-yes').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="plan-body"]')?.getAttribute('data-fit') === 'fit', null, { timeout: 10000 })
  check('"예" → 맞음(대표 답) · 업체 기록 scn.hireYouth · 상황 예시 청년 채용도 맞음으로', (await page.getByTestId('plan-fit').innerText()).includes('대표 답') && (await record(page, 'cli_plan'))?.decided?.['scn.hireYouth']?.a === 'yes' && (await page.locator('[data-testid="scenario-row"][data-id="emp-youth"]').count()) === 1)
  check('답한 뒤에도 고른 상황 · 사람 수 그대로(청년 5명)', (await attr(page, 'data-plan')) === 'hire-youth' && (await attr(page, 'data-count')) === '5')

  // 4-0. D-244 창업 5년 안 채용 — 창업감면 + 청년 채용(같은 금액) · 세액공제에 창업 확인 두 줄
  await pick(page, 'startup-hire').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="plan-body"]')?.getAttribute('data-plan') === 'startup-hire')
  const sBlocks = await page.getByTestId('plan-block').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-key')}:${e.getAttribute('data-state')}`))
  const sBox = page.locator('[data-testid="plan-block"][data-key="startup"]')
  const sText = await sBox.innerText()
  check('창업 5년 안 채용 — 청년 \'예\' 답으로 맞음 · 근거에 설립 · 5년 안', (await attr(page, 'data-fit')) === 'fit' && (await page.getByTestId('plan-fit').innerText()).includes('5년 안'))
  check('한 장 — 창업감면 → 고용지원금 → 세액공제 → 정책자금(모두 계산 · 판정됨)', sBlocks.join(',') === 'startup:ok,subsidy:ok,credit:ok,policy:ok', sBlocks.join(','))
  check('창업감면 — 판정됨 배지 · 판정기 결론 · 감면 기간 2023~2027년 · 금액 없음(판정만)', sText.includes('판정됨') && sText.includes('감면 기간: 2023~2027년') && (await sBox.getByTestId('plan-block-amount').count()) === 0, sText.slice(0, 200))
  check('1년 안 = 청년 1명 채용과 같은 돈(720만 + 1,450만) · 창업감면은 판정만 표시', (await attr(page, 'data-first')) === '21700000' && (await page.getByTestId('plan-total').innerText()).includes('창업감면은 판정만'))
  check('세액공제 — 창업감면과 같은 해 · 이월 ★ 두 줄', (await page.locator('[data-testid="plan-block"][data-key="credit"]').innerText()).includes('중복 배제') && (await page.locator('[data-testid="plan-block"][data-key="credit"]').innerText()).includes('이월'))
  const sHref = (await sBox.getByTestId('plan-block-open').getAttribute('href')) ?? ''
  check('창업감면 → 창업감면 판정이 같은 업체 · 신규 창업 가정으로(preset=startup-new)', sHref.includes('/tools/startup-tax') && sHref.includes('client=cli_plan') && sHref.includes('preset=startup-new'), sHref)
  check('결산 전 할 일 — 세무사에게 창업감면 · 늘어난 인원 함께', (await page.locator('[data-testid="plan-action"][data-id="tax"]').innerText()).includes('창업감면'))
  if (SHOTS) await page.getByTestId('situation-plan').screenshot({ path: `${SHOTS}/plan-1440-startup.png` })

  // 4-1. 아래 상황 예시 줄 → '한 장 설계서로' — 위 설계서가 그 상황으로 · 그 자리로
  await pick(page, 'lab-start').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="plan-body"]')?.getAttribute('data-plan') === 'lab-start')
  const empRow = page.locator('[data-testid="scenario-row"][data-id="emp-youth"]')
  if ((await empRow.getByTestId('scenario-detail').count()) === 0) await empRow.getByTestId('scenario-toggle').click()
  check('상황 예시(청년 채용) 펼치면 [한 장 설계서로] · 설계서 없는 상황(절세)엔 없음', (await empRow.getByTestId('scenario-plan').count()) === 1 && (await page.locator('[data-testid="scenario-row"][data-module="tax"] [data-testid="scenario-plan"]').count()) === 0)
  await empRow.getByTestId('scenario-plan').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="plan-body"]')?.getAttribute('data-plan') === 'hire-youth')
  await page.waitForTimeout(700)
  const planTop = await page.getByTestId('situation-plan').evaluate((e) => e.getBoundingClientRect().top)
  check('[한 장 설계서로] → 설계서가 청년 채용(5명 그대로)으로 바뀌고 화면 위쪽으로', (await attr(page, 'data-count')) === '5' && planTop >= 0 && planTop < 450, String(planTop))

  // 5. 진행 순서 — 하나 빼고 붙이기
  const actions = await page.getByTestId('plan-action').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))
  check('이렇게 진행해요 — 뽑기 전 참여신청 → 계약 · 4대보험 → 6개월 뒤 1차 신청 → 결산 전 세무사 → 정책자금', actions.join(',') === 'apply,contract,round1,tax,policy', actions.join(','))
  await page.locator('[data-testid="plan-action"][data-id="round1"]').click()
  check('체크 하나 빼면 단추 "할 일 4개"', (await page.getByTestId('plan-attach').innerText()).includes('할 일 4개'))
  const before = (await record(page, 'cli_plan')).toolResults?.length ?? 0
  await page.getByTestId('plan-attach').click()
  await page.getByTestId('plan-attached').waitFor({ timeout: 10000 })
  const rec = await record(page, 'cli_plan')
  const tr = rec.toolResults[0]
  check(
    '업체에 붙이기 → 도구 결과 한 줄(상황별 설계서 · 청년 5명 채용) · 할 일 4개(todo) · 빼 둔 1차 신청은 없음',
    rec.toolResults.length === before + 1 && tr.toolKey === 'situation-plan' && tr.title === '상황별 설계서 · 청년 5명 채용' && tr.deadlines.length === 4 && tr.deadlines.every((d) => d.todo) && !tr.deadlines.some((d) => d.title.includes('1차')),
    JSON.stringify(tr?.deadlines),
  )
  check('요약에 금액 · 진행 순서 · 가정(고객에게 보여 줄 수 있는 글)', tr.summary.includes('1년 안에 받을 수 있는 돈') && tr.summary.includes('■ 이렇게 진행해요') && tr.summary.includes('보장하지 않아요'))
  check('업체 다음 할 일이 비어 있었으면 첫 행동(참여신청)으로', (rec.nextAction ?? '').includes('참여신청'), rec.nextAction)
  check('붙인 뒤 단추는 "붙였어요"(두 번 붙지 않음)', (await page.getByTestId('plan-attach').isDisabled()) && (await page.getByTestId('plan-attach').innerText()).includes('붙였어요'))
  // 6. 한 장 인쇄 — 찍는 동안만 종이
  // D-244: 휴대폰 크롬처럼 print() 가 바로 돌아오는 브라우저 — 종이는 다 찍은 뒤(afterprint)에 치운다
  await page.evaluate(() => {
    window.__printed = ''
    window.print = () => {
      window.__printed = document.querySelector('[data-testid="plan-print-sheet"]')?.textContent ?? 'none'
    }
  })
  check('인쇄 전에는 인쇄 종이가 없음(다른 인쇄를 막지 않게)', (await page.getByTestId('plan-print-sheet').count()) === 0)
  await page.getByTestId('plan-print').click()
  const printed = await page.evaluate(() => window.__printed)
  const keptWhilePrinting = (await page.getByTestId('plan-print-sheet').count()) === 1
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await page.waitForTimeout(100)
  check('한 장 인쇄 — 업체 · 상황 · 1년 안 금액 · 진행 순서 · 가정이 찍힘 · 찍는 동안 종이 남음 · 다 찍으면(afterprint) 치움', printed.includes('한솔정밀(주) — 청년 5명 채용') && printed.includes('1억') && printed.includes('이렇게 진행해요') && printed.includes('※') && keptWhilePrinting && (await page.getByTestId('plan-print-sheet').count()) === 0, { p: printed.slice(0, 120), keptWhilePrinting })
  // 7. 요약 복사
  await page.getByTestId('plan-copy').click()
  await page.waitForTimeout(300)
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  check('요약 복사 — 카톡에 붙일 한 장 글', clip.startsWith('[상황별 설계서] 한솔정밀(주) — 청년 5명 채용') && clip.includes('■ 고용지원금'), clip.slice(0, 80))
  // 8. 도구 결과에서 보기
  await page.getByTestId('plan-attached-go').click()
  await page.getByTestId('tool-results').waitFor({ timeout: 10000 })
  check('도구 결과에서 보기 → 개요 탭 도구 결과에 설계서 · 할 일 4건 표시', (await page.locator('[data-tool-group="situation-plan"]').innerText()).includes('상황별 설계서 · 청년 5명 채용') && (await page.locator('[data-tool-group="situation-plan"]').innerText()).includes('할 일 4건'))

  // 9. 아니요 → 안 맞음 · 답 바꾸기
  await openSmart(page, 'cli_plan')
  await pick(page, 'hire-senior').click()
  await page.getByTestId('plan-answer-no').click()
  await page.getByTestId('plan-nofit').waitFor({ timeout: 10000 })
  check('만 60세 이상 "아니요" → 안 맞음(대표 답) · 설계 · 합계 숨김', (await page.getByTestId('plan-nofit').innerText()).includes('대표 답') && (await page.getByTestId('plan-total').count()) === 0 && (await page.getByTestId('plan-attach').count()) === 0)
  await page.getByTestId('plan-undo').click()
  await page.getByTestId('plan-ask').waitFor({ timeout: 10000 })
  check('답 바꾸기 → 다시 묻기 · 업체 기록에서 답 지움', (await record(page, 'cli_plan'))?.decided?.['scn.hireSenior'] === undefined)

  // 9-1. D-244 다시 붙이기 — 같은 할 일(같은 날 · 같은 일)은 다시 걸지 않음
  await pick(page, 'hire-youth').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="plan-body"]')?.getAttribute('data-plan') === 'hire-youth')
  const beforeAgain = (await record(page, 'cli_plan')).toolResults.filter((r) => r.toolKey === 'situation-plan').flatMap((r) => r.deadlines).length
  await page.getByTestId('plan-attach').click()
  await page.getByTestId('plan-attached').waitFor({ timeout: 10000 })
  const afterAgain = (await record(page, 'cli_plan')).toolResults.filter((r) => r.toolKey === 'situation-plan').flatMap((r) => r.deadlines).length
  const againMsg = await page.getByTestId('plan-attached').innerText()
  check('청년 2명으로 다시 붙이기 — 앞서 건 4개(참여신청 · 계약 · 세무사 · 정책자금)는 다시 안 걸고 새 1차 신청(2명 금액) 1개만', afterAgain - beforeAgain === 1 && againMsg.includes('할 일 1개'), `${beforeAgain}→${afterAgain} ${againMsg}`)

  // 10. 빈 업체 — 받을 숫자 요청 문구
  await openSmart(page, 'cli_plan_empty')
  // 10-0. D-244 고르지 않은 채 맨 앞 상황(청년 채용)에 '아니요' — 다른 상황으로 넘어가지 않고 안 맞음 · 답 바꾸기
  check('빈 업체 — 맨 앞은 청년 채용(묻기)', (await attr(page, 'data-plan')) === 'hire-youth' && (await page.getByTestId('plan-ask').count()) === 1)
  await page.getByTestId('plan-answer-no').click()
  await page.getByTestId('plan-nofit').waitFor({ timeout: 10000 })
  check("고르지 않고 '아니요' → 그 상황(청년 채용)에 머묾 · 안 맞음 · 답 바꾸기 보임", (await attr(page, 'data-plan')) === 'hire-youth' && (await page.getByTestId('plan-undo').count()) === 1)
  await page.getByTestId('plan-undo').click()
  await page.getByTestId('plan-ask').waitFor({ timeout: 10000 })
  await pick(page, 'hire-youth').click()
  const pol = page.locator('[data-testid="plan-block"][data-key="policy"]')
  check('빈 업체 — 정책자금은 "받으면 같이 봐요"(짐작 안 함)', (await pol.getAttribute('data-state')) === 'need')
  await page.getByTestId('plan-request').click()
  const dlg = page.getByRole('dialog')
  await dlg.waitFor()
  const reqText = await dlg.locator('textarea').inputValue()
  await page.keyboard.press('Escape')
  check('빠진 숫자 요청 문구 — 대표님께 · 설계서 확인용 · 주민등록번호 요청 없음', reqText.includes('대표님') && reqText.includes('설계서') && !reqText.includes('주민등록번호'), reqText.slice(0, 120))

  check('페이지 오류 0', errors.length === 0, errors.slice(0, 2).join(' | '))
  await ctx.close()
}

/* ---------------- 360 · 390 × 1.0 · 1.30 ---------------- */
for (const width of [360, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await seed(page)
  await openSmart(page, 'cli_plan')
  // D-244: 창업 5년 안 채용(창업감면 칸이 더 길다)도 같이 잰다
  for (const planId of ['hire-youth', 'startup-hire'])
  for (const scale of ['default', 'extra_large']) {
    if ((await attr(page, 'data-plan')) !== planId) {
      await pick(page, planId).click()
      await page.waitForFunction((id) => document.querySelector('[data-testid="plan-body"]')?.getAttribute('data-plan') === id, planId)
    }
    await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
    await page.waitForTimeout(400)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    check(`${width} ${planId} ${scale}: 설계서 가로 넘침 0`, over <= 1, String(over))
    const wide = await page.getByTestId('situation-plan').locator('*').evaluateAll((els) => {
      const W = document.documentElement.clientWidth
      return els
        .filter((e) => {
          const b = e.getBoundingClientRect()
          return b.width > 0 && (b.right > W + 1 || b.left < -1)
        })
        .map((e) => (e.textContent || '').trim().slice(0, 20))
    })
    check(`${width} ${planId} ${scale}: 화면 밖으로 나간 글자 0`, wide.length === 0, wide.slice(0, 4).join('|'))
    const small = await page
      .getByTestId('plan-body')
      .locator('button, a, summary, label')
      .evaluateAll((els) =>
        els
          .filter((e) => {
            const b = e.getBoundingClientRect()
            return b.width > 0 && b.height > 0 && b.height < 43.5
          })
          .map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)),
      )
    check(`${width} ${planId} ${scale}: 누르는 것 44px`, small.length === 0, small.slice(0, 6).join('|'))
  }
  // 사진은 잰 뒤에 따로 — 요소 사진을 찍는 동안 바뀐 화면을 재면 칩 높이가 잠깐 작게 잡혔다
  if (SHOTS) {
    await page.evaluate(() => document.documentElement.setAttribute('data-text-scale', 'extra_large'))
    await page.waitForTimeout(400)
    await page.getByTestId('situation-plan').screenshot({ path: `${SHOTS}/plan-${width}-startup-extra_large.png` })
    await pick(page, 'hire-youth').click()
    await page.waitForFunction(() => document.querySelector('[data-testid="plan-body"]')?.getAttribute('data-plan') === 'hire-youth')
    for (const scale of ['default', 'extra_large']) {
      await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
      await page.waitForTimeout(400)
      await page.getByTestId('situation-plan').screenshot({ path: `${SHOTS}/plan-${width}-${scale}.png` })
    }
  }
  await ctx.close()
}

await browser.close()
console.log(`\nplan: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
