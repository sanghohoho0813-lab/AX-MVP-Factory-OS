/**
 * qa:growth — D-681 고객성장관리 P0 · 내부 OS(연습 모드 — 진짜 서버 규칙은 qa:db test-0033 · 고객 화면 왕복은 홈페이지 시험).
 *
 *   G1 업체 상세 › 고객 플랫폼 — 연결 전: 가입 안내 문구(가입 주소 · 내부 id 0) → [보냈어요] → '가입 안내 보냄 · 0일째'
 *   G2 이메일 연결 → '연결됨 · 아직 안 오심' · 연습용 표시 · 멈춤/끊기 단추
 *   G3 '고객에게 보낸 보고서' 판 — 처음엔 0편 · [보고서 만들기]
 *   G4 종류 · 기간 → [초안 만들기] → 칸 차례(지금 진행 중 · 끝낸 일 · 부탁 · 다음 계획) · 직원이 적은 다음 단계 = 꺼진 내부 글
 *   G5 [고객 화면으로 보기] — 내부 글 · 수수료 글 0 · 확인 ≠ 검수 안내
 *   G6 [고객 화면에 발행] → 한 번 더 묻기 → [발행] 두 번 눌러도 한 편 · 안내 문구 = 그 보고서 주소
 *   G7 목록 한 줄 — 경과 보고 · 발행일 · '아직 안 봄'
 *   G8 [고객 화면으로 보기](미리보기)는 기록 0(연습 모드 열람 기록 없음 · 보고서 줄 그대로)
 *   G9 [정정] — 고친 곳 한 줄 없으면 발행 꺼짐 → 적으면 2판 · 예전 판은 목록에서 접힘('정정 전 판 1개') · 저장소에 두 판 다 남음
 *   G10 [내리기] → 까닭 → 고객 화면에서 내림 · 줄은 지우지 않음(내림 표시 · 까닭은 내부에만)
 *   G11 잠시 멈춤 → 다시 켜기 · 끊기는 한 번 더 묻기(취소하면 그대로)
 *   G15 종류 넷 + [그 밖에] · 월간(이번 달/지난달 · 제목 'n월 월간 보고') · G16 연간(계약일부터 · 다음 1년 검토 꺼진 채 · 미리보기에 안 나감) · G17 계약일 없으면 최근 12개월(짐작 0)
 *   G12 오늘 화면 — 연습 모드에는 '고객 화면 챙길 것' 칩 0(방문 기록이 없어 거짓 알림을 만들지 않음)
 *   G13 390 — 탭 · 보고서 창 넘침 0 · 단추 40px 이상 · (D-691) '고객에게 추천' 판 · 고르기 창 · 가장 긴 제목 · 근거 · 올린 줄
 *   G14 JS 오류 0
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.argv[3] ?? ''
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) {
    pass++
    console.log('PASS ', n)
  } else {
    fail++
    console.log('FAIL ', n, d === undefined ? '' : String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700))
  }
}
const shot = async (p, name) => {
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false })
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'], timezoneId: 'Asia/Seoul' })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(seedScript())
// 직원이 적은 '다음 단계'(내부 글) · 수수료 메모 — 초안에서 꺼진 채 · 고객 화면에는 0 이어야 한다
await page.evaluate(() => {
  const k = 'axmvp.v1.operations_clients'
  const all = JSON.parse(localStorage.getItem(k) || '[]')
  for (const c of all) {
    if (c.id !== 'cli_hansol') continue
    c.services.venture = { ...(c.services.venture || {}), nextStep: '대표 개인 채무 확인 뒤 진행(내부)' }
    c.notes = '수수료 300만원 협의 — 내부'
  }
  localStorage.setItem(k, JSON.stringify(all))
})
const TAB = BASE + '/ops/clients/cli_hansol?tab=portal'
await page.goto(TAB, { waitUntil: 'networkidle' })
const reportsLs = () => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.portal_reports') || '[]'))

// G1 가입 안내
const invite = page.getByTestId('portal-invite')
await invite.waitFor()
check('G1a 연결 전 — 가입 안내 줄(아직 안 보냄)', (await invite.getAttribute('data-state')) === 'none')
await page.getByTestId('portal-invite-open').click()
const inviteText = await page.getByTestId('portal-invite-text').inputValue()
check('G1b 가입 안내 문구 — 가입 주소(next=/my-projects) · 내부 id 0 · 담당자가 연결한다는 말', inviteText.includes('/signup?next=') && !inviteText.includes('cli_hansol') && inviteText.includes('담당자가 회사와 연결'), inviteText)
await page.getByTestId('portal-invite-sent').click()
await page.waitForFunction(() => document.querySelector('[data-testid="portal-invite"]')?.getAttribute('data-state') === 'sent', null, { timeout: 8000 }).catch(() => {})
check("G1c [보냈어요] → '가입 안내 보냄 · 0일째'", ((await invite.innerText()) ?? '').includes('0일째'), await invite.innerText())

// G2 연결
await page.getByPlaceholder('customer@example.com').fill('ceo@hansol.example')
await page.getByRole('button', { name: '연결', exact: true }).click()
const usage = page.getByTestId('portal-usage')
await usage.waitFor({ timeout: 10000 })
const usageText = await usage.innerText()
check("G2a 연결 → '연결됨 · 아직 안 오심' · 연습용", (await usage.getAttribute('data-state')) === 'linked_unvisited' && usageText.includes('아직 안 오심') && usageText.includes('연습용'), usageText)
check('G2b 멈춤 · 끊기 단추', (await page.getByTestId('portal-pause').count()) === 1 && (await page.getByTestId('portal-revoke').count()) === 1)

// G3 보고서 판
const card = page.getByTestId('portal-reports')
await card.waitFor()
check('G3 보고서 판 — 처음엔 0편 · [보고서 만들기]', ((await card.innerText()) ?? '').includes('아직 보낸 보고서가 없어요') && (await page.getByTestId('report-create').count()) === 1)
await shot(page, 'growth-01-portal-tab')

// G4 초안
await page.getByTestId('report-create').click()
const sheet = page.getByTestId('report-sheet')
await sheet.waitFor()
check('G4a 처음 단계 = 종류 · 기간 고르기', (await sheet.getAttribute('data-step')) === 'setup')
await page.locator('[data-testid="report-period"][data-period="year"]').click()
await shot(page, 'growth-02-sheet-setup')
await page.getByTestId('report-make-draft').click()
await page.waitForFunction(() => document.querySelector('[data-testid="report-sheet"]')?.getAttribute('data-step') === 'edit')
const keys = await page.getByTestId('report-section').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')).join(','))
check('G4b 칸 차례 — 지금 진행 중 · 끝낸 일 · (자금) · 부탁 · 다음 계획', /^now,done,(money,)?ask,next$/.test(keys), keys)
const internal = page.locator('[data-testid="report-line"][data-internal="1"]')
const internalN = await internal.count()
const internalOn = await internal.evaluateAll((els) => els.filter((e) => e.getAttribute('data-on') === '1').length)
check('G4c 직원이 적은 다음 단계 = 꺼진 내부 글', internalN >= 1 && internalOn === 0, { internalN, internalOn })
const doneLines = await page.locator('[data-testid="report-section"][data-key="done"] [data-testid="report-line-text"]').evaluateAll((els) => els.map((e) => e.value))
check('G4d 끝낸 일에 올해 끝낸 업무(법인설립)', doneLines.some((t) => t.includes('법인') && t.includes('완료')), doneLines)
const sheetText = await sheet.innerText()
check('G4e 수수료 메모는 초안 어디에도 없음', !sheetText.includes('300만원'), '')
await shot(page, 'growth-03-sheet-edit')

// G5 미리보기
await page.getByTestId('report-preview-toggle').click()
const pv = page.getByTestId('report-preview')
await pv.waitFor()
const pvText = await pv.innerText()
check('G5 고객 화면으로 보기 — 내부 글 · 수수료 0 · 확인 ≠ 검수 안내', !pvText.includes('채무') && !pvText.includes('300만원') && pvText.includes('계약 검수') && pvText.includes('지금 진행 중'), pvText.slice(0, 300))
await shot(page, 'growth-04-sheet-preview')

// G6 발행(두 번 눌러도 한 편)
await page.getByTestId('report-publish').click()
await page.getByTestId('report-confirm').waitFor()
await page.getByTestId('report-publish-go').waitFor()
// 같은 순간 두 번(화면이 '올리는 중' 으로 바뀌기 전) — 서버 · 연습 모드 모두 같은 발행 번호라 한 편
await page.evaluate(() => {
  const b = document.querySelector('[data-testid="report-publish-go"]')
  b.click()
  b.click()
})
await page.getByTestId('report-done').waitFor({ timeout: 10000 })
const notice = await page.getByTestId('report-notice-text').inputValue()
const reps1 = await reportsLs()
check('G6a 두 번 눌러도 한 편', reps1.length === 1, reps1.length)
check('G6b 안내 문구 = 그 보고서 주소 · 금액 0', notice.includes(`/my-projects/reports/${reps1[0]?.id}`) && !/만원/.test(notice), notice)
check('G6c 발행한 글에 내부 글 0 · 켠 줄만', !JSON.stringify(reps1[0]?.sections ?? []).includes('채무') && (reps1[0]?.sections ?? []).every((s) => s.items.length > 0))
await shot(page, 'growth-05-published')
await page.getByTestId('report-done-close').click()

// G7 목록 줄
const row = page.getByTestId('report-row').first()
await row.waitFor()
const rowText = await row.innerText()
check("G7 목록 — 경과 보고 · 발행 · '아직 안 봄'", (await row.getAttribute('data-status')) === 'published' && rowText.includes('경과 보고') && rowText.includes('발행') && rowText.includes('아직 안 봄'), rowText)

// G8 미리보기는 기록 0
const before = JSON.stringify(await reportsLs())
await row.getByTestId('report-preview-open').click()
const rv = page.getByTestId('report-view')
await rv.waitFor()
check('G8 미리보기 — 고객 모양 · 저장된 보고서 그대로(기록 0)', ((await rv.innerText()) ?? '').includes('지금 진행 중') && JSON.stringify(await reportsLs()) === before)
await page.keyboard.press('Escape')
await rv.waitFor({ state: 'detached' }).catch(() => {})

// G9 정정
await row.getByTestId('report-correct').click()
await sheet.waitFor()
check('G9a 정정 창 — 고친 곳 한 줄 없으면 발행 꺼짐', (await page.getByTestId('report-publish').isDisabled()) && ((await page.getByRole('dialog').first().innerText()) ?? '').includes('2판'))
await page.getByTestId('report-correction').fill('법인설립 완료일을 바로잡았습니다')
const firstText = page.locator('[data-testid="report-line-text"]').first()
await firstText.fill(`${await firstText.inputValue()} (확인)`)
await page.getByTestId('report-publish').click()
await page.getByTestId('report-publish-go').click()
await page.getByTestId('report-done').waitFor()
await page.getByTestId('report-done-close').click()
await page.waitForFunction(() => document.querySelector('[data-testid="report-row"]')?.getAttribute('data-version') === '2', null, { timeout: 8000 }).catch(() => {})
const rows2 = await page.getByTestId('report-row').count()
const reps2 = await reportsLs()
const cardText2 = await card.innerText()
check("G9b 2판 · 정정 표시 · 예전 판은 목록에서 접힘('정정 전 판 1개')", rows2 === 1 && (await page.getByTestId('report-row').first().getAttribute('data-version')) === '2' && cardText2.includes('2판 · 정정') && cardText2.includes('정정 전 판 1개'), { rows2, cardText2: cardText2.slice(0, 300) })
check('G9c 저장소에 두 판 다 남음(1판 = 정정됨 · 2판 = 고친 곳 한 줄)', reps2.length === 2 && reps2.some((r) => r.version === 1 && r.status === 'superseded') && reps2.some((r) => r.version === 2 && r.status === 'published' && r.correctionNote.includes('바로잡')), reps2.map((r) => [r.version, r.status]))
await shot(page, 'growth-06-corrected')

// G10 내리기
const row2 = page.getByTestId('report-row').first()
await row2.getByTestId('report-withdraw').click()
await page.getByTestId('report-withdraw-reason').fill('내용 다시 확인 필요(내부)')
await page.getByTestId('report-withdraw-go').click()
await page.waitForFunction(() => document.querySelector('[data-testid="report-row"]')?.getAttribute('data-status') === 'withdrawn', null, { timeout: 8000 }).catch(() => {})
const reps3 = await reportsLs()
const row3Text = await page.getByTestId('report-row').first().innerText()
check('G10 내리기 — 줄은 남음 · 내림 표시 · 까닭은 내부에만', reps3.length === 2 && reps3.some((r) => r.status === 'withdrawn' && r.withdrawnReason === '내용 다시 확인 필요(내부)') && row3Text.includes('내림') && row3Text.includes('내부에만'), row3Text)

// G11 멈춤 → 다시 켜기 · 끊기 취소
await page.getByTestId('portal-pause').click()
await page.getByTestId('portal-resume').waitFor({ timeout: 8000 })
check('G11a 잠시 멈춤 → [다시 켜기]', (await usage.getAttribute('data-state')) === 'paused')
await page.getByTestId('portal-resume').click()
await page.getByTestId('portal-pause').waitFor({ timeout: 8000 })
await page.getByTestId('portal-revoke').click()
check('G11b 끊기는 한 번 더 묻기', (await page.getByTestId('portal-revoke-confirm').count()) === 1)
await page.getByTestId('portal-revoke-confirm').getByRole('button', { name: '취소' }).click()
check('G11c 취소하면 그대로(연결됨)', (await usage.getAttribute('data-state')) === 'linked_unvisited')

// G15~G17 (D-682) 월간 · 연간 보고
const kst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
await page.getByTestId('report-create').click()
await page.getByTestId('report-sheet').waitFor()
check('G15a 종류 칩 넷(경과 · 월간 · 상담 요약 · 연간) + [그 밖에]', (await page.getByTestId('report-kind').count()) === 4 && (await page.getByTestId('report-kind-more').count()) === 1, await page.getByTestId('report-kind').allInnerTexts())
await page.locator('[data-testid="report-kind"][data-kind="monthly"]').click()
const monPeriods = await page.getByTestId('report-period').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-period')}:${e.getAttribute('aria-pressed')}`))
const wantMon = Number(kst.slice(8, 10)) <= 7 ? 'last_month' : 'this_month'
check('G15b 월간 — 기간 둘(이번 달 · 지난달) · 1~7일은 지난달 · 그 뒤는 이번 달이 먼저', monPeriods.length === 2 && monPeriods.includes(`${wantMon}:true`), monPeriods)
await page.getByTestId('report-make-draft').click()
await page.waitForFunction(() => document.querySelector('[data-testid="report-sheet"]')?.getAttribute('data-step') === 'edit')
const monTitle = await page.getByTestId('report-title').inputValue()
check("G15c 월간 초안 제목 'n월 월간 보고'", /^\d{1,2}월 월간 보고$/.test(monTitle), monTitle)
await page.keyboard.press('Escape')
await page.getByTestId('report-sheet').waitFor({ state: 'detached' }).catch(() => {})
await page.getByTestId('report-create').click()
await page.locator('[data-testid="report-kind"][data-kind="annual"]').click()
const annPeriods = await page.getByTestId('report-period').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-period')}:${e.getAttribute('aria-pressed')}:${e.hasAttribute('disabled')}`))
check('G16a 연간 — 계약일이 있으면 "계약일부터" 가 먼저 · 최근 12개월도', annPeriods.join() === 'contract:true:false,last12:false:false', annPeriods)
await page.getByTestId('report-make-draft').click()
await page.waitForFunction(() => document.querySelector('[data-testid="report-sheet"]')?.getAttribute('data-step') === 'edit', null, { timeout: 15000 })
const annTitle = await page.getByTestId('report-title').inputValue()
const annKeys = await page.getByTestId('report-section').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
const reviewOn = await page.locator('[data-testid="report-section"][data-key="review"] [data-testid="report-line"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-on')))
check('G16b 연간 초안 — 제목에 계약일부터의 기간 · 칸(함께 한 일 · 다음 1년 검토 · 남은 것)', annTitle.startsWith('연간 보고 (2025.3/15 ~') && annKeys[0] === 'done' && annKeys.includes('review') && annKeys.at(-1) === 'limits', { annTitle, annKeys })
check('G16c 다음 1년 검토 줄은 맞춤 추천 판정에서 · 모두 꺼진 채', reviewOn.length >= 1 && reviewOn.every((x) => x === '0'), reviewOn)
await shot(page, 'growth-09-annual-edit')
await page.getByTestId('report-preview-toggle').click()
const annPv = (await page.getByTestId('report-preview').innerText()) ?? ''
check('G16d 고객 화면으로 보기 — 꺼진 검토 줄 · 빈 "남은 것" 칸 0 · 수수료 0', !annPv.includes('함께 검토해 볼 만해요') && !annPv.includes('남은 것') && !annPv.includes('300만원'), annPv.slice(0, 300))
await page.keyboard.press('Escape')
await page.getByTestId('report-sheet').waitFor({ state: 'detached' }).catch(() => {})
// 계약일을 비우면 — 계약일부터는 못 고름 · 최근 12개월 · 안내 한 줄(짐작 0)
await page.evaluate(() => {
  const k = 'axmvp.v1.operations_clients'
  const all = JSON.parse(localStorage.getItem(k) || '[]')
  for (const c of all) if (c.id === 'cli_hansol') c.contract = { ...(c.contract || {}), signedAt: '' }
  localStorage.setItem(k, JSON.stringify(all))
})
await page.goto(TAB, { waitUntil: 'networkidle' })
await page.getByTestId('report-create').click()
await page.locator('[data-testid="report-kind"][data-kind="annual"]').click()
const annNo = await page.getByTestId('report-period').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-period')}:${e.getAttribute('aria-pressed')}:${e.hasAttribute('disabled')}`))
check('G17 계약일이 없으면 "계약일부터" 꺼짐 · 최근 12개월 · 안내 한 줄', annNo.join() === 'contract:false:true,last12:true:false' && (await page.getByTestId('report-contract-missing').count()) === 1, annNo)
await shot(page, 'growth-10-annual-nocontract')
await page.keyboard.press('Escape')

// G18 (D-689) 고객에게 추천 — 연습 모드: 후보(맞는 공고 · 먼저 제안할 것) 판 · 직접 적기 · 금액 막힘 · 올리기 · 3개까지 · 내리기
await page.goto(TAB, { waitUntil: 'networkidle' })
await page.getByTestId('portal-recos').waitFor({ timeout: 10000 }).catch(() => {})
check("G18a 고객 플랫폼 탭 '고객에게 추천 0/3' · 빈 안내", (await page.getByTestId('portal-recos').getAttribute('data-count').catch(() => null)) === '0' && (await page.getByTestId('reco-empty').count()) === 1)
await page.getByTestId('reco-pick-open').click()
await page.getByTestId('reco-pick').waitFor({ timeout: 8000 }).catch(() => {})
await page.waitForTimeout(800)
const pickText = (await page.getByTestId('reco-pick').innerText().catch(() => '')) ?? ''
const cands = await page.getByTestId('reco-candidate').count()
await shot(page, 'growth-11-reco-pick')
check("G18b [추천 고르기] — '맞는 공고' · '먼저 제안할 것' 두 묶음 · [직접 적기] · 후보 글에 금액 0", pickText.includes('맞는 공고') && pickText.includes('먼저 제안할 것') && (await page.getByTestId('reco-manual').count()) === 1 && !/만원|억원/.test(pickText), { cands, pickText: pickText.slice(0, 300) })
if (cands > 0) {
  await page.getByTestId('reco-candidate').first().click()
  await page.getByTestId('reco-edit').waitFor({ timeout: 5000 }).catch(() => {})
  const t0 = await page.getByTestId('reco-edit-title').inputValue().catch(() => '')
  check('G18c 후보를 누르면 제목 · 근거가 채워진 고치기 칸 · 미리 보기', t0.length > 0 && (await page.getByTestId('reco-preview').count()) === 1, t0)
  await page.getByTestId('reco-show-go').click()
  await page.waitForTimeout(700)
} else {
  check('G18c (후보 없음 — 이 견본 업체에 맞는 후보가 없을 때) 빈 안내', (await page.getByTestId('reco-no-grants').count()) + (await page.getByTestId('reco-no-tasks').count()) >= 1)
  await page.keyboard.press('Escape')
}
const addLocal = async (title, reason) => {
  await page.getByTestId('reco-pick-open').click()
  await page.getByTestId('reco-manual').click()
  await page.getByTestId('reco-edit-title').fill(title)
  await page.getByTestId('reco-edit-reason').fill(reason)
}
await addLocal('수출 바우처 검토', '평가 90점 이상이면 유리해요')
const p18 = (await page.getByTestId('reco-edit-problem').innerText().catch(() => '')) ?? ''
check("G18d 근거에 점수('90점') → '금액 · 점수는 고객 화면에 쓰지 않아요' · [올리기] 꺼짐", p18.includes('점수') && !(await page.getByTestId('reco-show-go').isEnabled()), p18)
await page.getByTestId('reco-edit-reason').fill('해외 거래처가 있으면 함께 검토해 볼 만해요')
await page.getByTestId('reco-show-go').click()
await page.waitForTimeout(700)
while (Number(await page.getByTestId('portal-recos').getAttribute('data-count')) < 3) {
  await addLocal(`직원 교육 계획 ${Date.now() % 1000}`, '')
  await page.getByTestId('reco-show-go').click()
  await page.waitForTimeout(600)
}
await page.getByTestId('portal-recos').scrollIntoViewIfNeeded().catch(() => {})
await shot(page, 'growth-12-reco-card')
check('G18e 3/3 — [추천 고르기] 꺼짐 · 3개까지 안내 · 관심 기록 없음(연습 모드)', !(await page.getByTestId('reco-pick-open').isEnabled()) && (await page.getByTestId('reco-full').count()) === 1 && (await page.locator('[data-testid="reco-interest"][data-state="none"]').count()) === 3)
await page.getByTestId('reco-withdraw').first().click()
await page.getByTestId('reco-withdraw-go').click()
await page.waitForTimeout(600)
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.portal_recos') || '[]').map((r) => r.status).sort().join(','))
check('G18f [내리기] → 2/3 · 저장소에 줄은 남음(withdrawn) · [추천 고르기] 다시 켜짐', (await page.getByTestId('portal-recos').getAttribute('data-count')) === '2' && stored === 'shown,shown,withdrawn' && (await page.getByTestId('reco-pick-open').isEnabled()), stored)

// G12 오늘 화면 — 연습 모드 칩 0
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
check("G12 오늘 — 연습 모드에는 '고객 화면 챙길 것' 칩 0", (await page.getByTestId('today-portal-open').count()) === 0)

// G13 390
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Asia/Seoul' })
const mp = await m.newPage()
mp.on('pageerror', (e) => errs.push(String(e)))
await mp.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await mp.evaluate(seedScript())
await mp.goto(TAB, { waitUntil: 'networkidle' })
await mp.getByPlaceholder('customer@example.com').fill('ceo@hansol.example')
await mp.getByRole('button', { name: '연결', exact: true }).click()
await mp.getByTestId('portal-usage').waitFor({ timeout: 10000 })
const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
check('G13a 390 탭 — 옆 넘침 0', over <= 0, over)
await mp.getByTestId('report-create').scrollIntoViewIfNeeded()
await shot(mp, 'growth-07-m-tab')
await mp.getByTestId('report-create').click()
await mp.getByTestId('report-make-draft').click()
await mp.waitForFunction(() => document.querySelector('[data-testid="report-sheet"]')?.getAttribute('data-step') === 'edit')
const dlgOver = await mp.evaluate(() => {
  const d = document.querySelector('[role="dialog"]')
  if (!d) return -1
  let worst = 0
  for (const el of d.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.right > window.innerWidth + 1) worst = Math.max(worst, Math.round(r.right - window.innerWidth))
  }
  return worst
})
check('G13b 390 보고서 창 — 넘침 0', dlgOver === 0, dlgOver)
const small = await mp.evaluate(() =>
  [...document.querySelectorAll('[role="dialog"] button')]
    .filter((b) => b.offsetParent !== null && b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().height < 40 && !b.closest('[data-tiny-ok]'))
    .map((b) => (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 20)),
)
check('G13c 390 보고서 창 — 40px 아래 단추 0', small.length === 0, small)
const clipped = await mp.evaluate(() => [...document.querySelectorAll('[data-testid="report-line-text"]')].filter((t) => t.scrollWidth > t.clientWidth + 1 || t.scrollHeight > t.clientHeight + 2).map((t) => t.value.slice(0, 20)))
check('G13d 390 보고서 줄 — 긴 줄도 잘림 0(칸이 늘어남)', clipped.length === 0, clipped)
await shot(mp, 'growth-08-m-sheet')
// G13e~h (D-691) 390 '고객에게 추천' — 판 · 고르기 창 · 직접 적기(가장 긴 제목 80 · 근거 160) · 올린 줄
await mp.keyboard.press('Escape')
await mp.waitForTimeout(300)
const dlgCheck = () =>
  mp.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    if (!d) return { over: -1, small: [] }
    let over = 0
    for (const el of d.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.right > window.innerWidth + 1) over = Math.max(over, Math.round(r.right - window.innerWidth))
    }
    const small = [...d.querySelectorAll('button, input, textarea, select')]
      .filter((b) => b.offsetParent !== null && b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().height < 40 && !b.closest('[data-tiny-ok]'))
      .map((b) => (b.textContent || b.getAttribute('aria-label') || b.getAttribute('data-testid') || '').trim().slice(0, 20))
    return { over, small }
  })
await mp.getByTestId('portal-recos').scrollIntoViewIfNeeded()
const card0 = await mp.getByTestId('portal-recos').evaluate((box) => {
  const r = box.getBoundingClientRect()
  const small = [...box.querySelectorAll('button')].filter((b) => b.offsetParent !== null && b.getBoundingClientRect().height < 40).map((b) => (b.textContent ?? '').trim().slice(0, 20))
  return { right: Math.round(r.right), small }
})
check("G13e 390 '고객에게 추천' 판 — 넘침 0 · 40px 아래 단추 0", (await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0 && card0.right <= 390 && card0.small.length === 0, card0)
await mp.getByTestId('reco-pick-open').click()
await mp.getByTestId('reco-pick').waitFor({ timeout: 8000 })
await mp.waitForTimeout(600)
const pick390 = await dlgCheck()
await shot(mp, 'growth-13-m-reco-pick')
check('G13f 390 [추천 고르기] 창 — 넘침 0 · 40px 아래 단추 0', pick390.over === 0 && pick390.small.length === 0, pick390)
await mp.getByTestId('reco-manual').click()
const LONG_T = '중소기업 디지털 전환 지원사업과 스마트공장 고도화 · 수출 바우처까지 한 번에 검토하는 올해 상반기 준비 일정 정리'.slice(0, 80)
const LONG_R = '지난해 매출이 늘었고 해외 거래처 문의가 이어지고 있어 수출 쪽 지원을 먼저 보고, 생산 설비 교체 계획이 있어 스마트공장 고도화도 함께 검토해 볼 만해요. 서류는 담당자가 정리해 드려요 — 필요한 것만 따로 부탁드릴게요'.slice(0, 160)
await mp.getByTestId('reco-edit-title').fill(LONG_T)
await mp.getByTestId('reco-edit-reason').fill(LONG_R)
await mp.waitForTimeout(300)
const edit390 = await dlgCheck()
const prevClip = await mp.getByTestId('reco-preview').evaluate((box) => [...box.querySelectorAll('*')].filter((e) => e.children.length === 0 && (e.textContent ?? '').trim() && (e.scrollWidth > e.clientWidth + 1)).length)
await shot(mp, 'growth-14-m-reco-edit')
check('G13g 390 직접 적기 — 가장 긴 제목(80) · 근거(160)도 창 넘침 0 · 미리 보기 잘림 0 · 40px 아래 칸 0 · [올리기] 켜짐', edit390.over === 0 && edit390.small.length === 0 && prevClip === 0 && (await mp.getByTestId('reco-show-go').isEnabled()), { edit390, prevClip, t: LONG_T.length, r: LONG_R.length })
await mp.getByTestId('reco-show-go').click()
await mp.waitForTimeout(700)
await mp.getByTestId('portal-recos').scrollIntoViewIfNeeded()
const row390 = await mp.getByTestId('portal-recos').evaluate((box) => {
  const rows = [...box.querySelectorAll('[data-testid="reco-row"]')]
  return {
    rows: rows.length,
    wide: rows.filter((r) => r.getBoundingClientRect().right > window.innerWidth + 1).length,
    clipped: rows.flatMap((r) => [...r.querySelectorAll('*')]).filter((e) => e.children.length === 0 && (e.textContent ?? '').trim().length > 3 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow !== 'ellipsis').length,
    small: [...box.querySelectorAll('button')].filter((b) => b.offsetParent !== null && b.getBoundingClientRect().height < 40).map((b) => (b.textContent ?? '').trim().slice(0, 20)),
  }
})
await shot(mp, 'growth-15-m-reco-row', true)
check('G13h 390 올린 줄(긴 제목) — 줄 넘침 0 · 글 잘림 0 · 40px 아래 단추 0 · 옆 넘침 0', row390.rows >= 1 && row390.wide === 0 && row390.clipped === 0 && row390.small.length === 0 && (await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, row390)
await m.close()

check('G14 JS 오류 0', errs.length === 0, errs)
await browser.close()
console.log(`\nqa:growth ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
