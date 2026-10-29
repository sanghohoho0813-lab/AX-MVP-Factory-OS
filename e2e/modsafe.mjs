/**
 * 모듈 안전 시험 (D-224) — 모듈마다 '이런 상황이면 어떻게 되나' 를 실제 화면에서.
 *
 *  정책자금  결과를 본 뒤 칸을 바꾸면 결과는 그대로 · 바꿨다고 알림 → 다시 진단하면 사라짐
 *            저장이 실패하면 '저장했습니다' 대신 실패 안내 · 다시 누르면 저장
 *  연구소    CSV 를 다시 올려도 인정번호 · 연구비가 지워지지 않고 CSV 칸만 바뀜
 *            점검 달을 고르면 그 달 기록을 불러옴 · 저장 실패면 화면 위 안내 + [지금 다시 저장]
 *            연구노트를 적다가 달을 바꾸면 한 번 묻고, 아니오면 그대로
 *  고용지원금 같은 명단을 두 번 붙여 넣으면 두 번째는 건너뜀 · 직원 서류 칸이 생김
 *            지원금을 바꾸면 회차가 새 지원금 것으로
 *            이름에 태그가 있어도 내부 보고서에서 글자로만 보임
 *  390      위 화면들이 가로로 넘치지 않음
 *  D-225    세금 계산기 '1억2천만' · '3억5천' 읽기 · 2020년 뒤 취임 임원 퇴직 한도(29개월) · 크레탑 추출기 글 바꾸면 끈 줄 풀림 ·
 *           크레탑 이력 ✕ 한 번 더 묻기 · 기업인증 저장 실패 알림
 *
 *   node e2e/modsafe.mjs http://localhost:4390    (SHOTS=폴더 면 스크린샷)
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.SHOTS || ''
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' ' + detail}`)
}
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: false })
}

/** 이 모듈 기록 칸에 쓰기를 막는다(저장 공간이 가득 찬 것처럼) — 다시 부르면 푼다 */
const blockWrites = (page, part) =>
  page.evaluate((p) => {
    const w = window
    if (!w.__realSetItem) w.__realSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (k, v) {
      if (p && String(k).includes(p)) {
        const e = new Error('quota')
        e.name = 'QuotaExceededError'
        throw e
      }
      return w.__realSetItem.call(this, k, v)
    }
  }, part)
const unblockWrites = (page) => blockWrites(page, '')

/** 고용지원금 직원 기록(모듈 기록에서 바로 읽는다) */
const employees = (page) =>
  page.evaluate(() => {
    const out = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i) ?? ''
      if (!k.includes('employment') || !k.includes('employees')) continue
      try {
        for (const r of JSON.parse(localStorage.getItem(k) ?? '[]')) out.push({ ...(r.data ?? r), companyId: r.clientId || r.data?.companyId })
      } catch {
        /* 다른 모양 */
      }
    }
    return out
  })

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', acceptDownloads: true })
  const page = await ctx.newPage()
  const gc = await ctx.newCDPSession(page)
  setInterval(() => void gc.send('HeapProfiler.collectGarbage').catch(() => {}), 2000).unref()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())

  /* ---------------- 정책자금 ---------------- */
  await page.goto(BASE + '/tools/policy-funding/diagnosis?client=cli_hansol&sample=1', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const resultText = async () => (await page.locator('#result').innerText().catch(() => '')) ?? ''
  const before = await resultText()
  check('정책자금: 예시로 결과가 선다', before.length > 50)
  check('정책자금: 처음에는 칸을 바꿨다는 안내가 없다', (await page.getByTestId('pf-stale').count()) === 0)
  const company = page.getByLabel('회사명 (선택)')
  await company.fill('바뀐회사D224')
  await page.waitForTimeout(300)
  check('D-224 정책자금: 결과를 본 뒤 칸을 바꾸면 안내가 뜬다', (await page.getByTestId('pf-stale').count()) === 1)
  await page.getByTestId('pf-stale').scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {})
  await shot(page, '01-pf-stale')
  await page.getByRole('button', { name: '진단 결과 보기' }).click()
  await page.waitForTimeout(700)
  check('D-224 정책자금: 다시 진단하면 안내가 사라진다', (await page.getByTestId('pf-stale').count()) === 0)
  // 저장 실패 → 실패 안내 · 다시 누르면 저장
  await blockWrites(page, 'policy-funding')
  await page.getByTestId('pf-save-consult').click()
  await page.waitForTimeout(600)
  check('D-224 정책자금: 저장이 실패하면 실패 안내(예전: 저장했습니다)', (await page.getByTestId('pf-save-failed').count()) === 1 && !(await page.getByTestId('pf-save-bar').innerText()).includes('저장했습니다'))
  await page.getByTestId('pf-save-bar').scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {})
  await shot(page, '02-pf-save-failed')
  await unblockWrites(page)
  if (await page.getByTestId('pf-save-consult').count()) await page.getByTestId('pf-save-consult').click()
  await page.waitForTimeout(600)
  check('D-224 정책자금: 다시 누르면 저장했습니다', (await page.getByTestId('pf-save-bar').innerText()).includes('저장했습니다'))

  /* ---------------- 연구소 ---------------- */
  await page.goto(BASE + '/tools/labcare/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.getByTestId('lab-client-add').click()
  await page.waitForTimeout(300)
  await page.getByTestId('lab-client-pick').selectOption('cli_hansol')
  const modal = page.locator('form').filter({ has: page.getByTestId('lab-client-pick') })
  const fieldBy = (label) => modal.locator('label', { hasText: label }).locator('xpath=following-sibling::input[1]')
  await fieldBy('연구소 인정번호').fill('2026-D224-01')
  await fieldBy('연구원 연간 인건비 합계').fill('80000000')
  await fieldBy('당해연도 연구개발비').fill('50000000')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await page.waitForTimeout(900)
  check('연구소: 고객사가 목록에 선다', (await page.locator('[data-client="cli_hansol"]:visible').count()) === 1)
  // 같은 업체를 CSV 로 다시 올린다(업종만 바꿈)
  const csv = join(tmpdir(), `lab-d224-${process.pid}.csv`)
  writeFileSync(csv, '﻿고객사명,업종,연구소유형,대표자,근로자수,연구원수,설립일,인정일,담당컨설턴트\n한솔테크(주),정밀 부품 제조업,기업부설연구소,,,,,,\n')
  let alertText = ''
  page.once('dialog', (d) => {
    alertText = d.message()
    void d.accept()
  })
  await page.locator('input[type="file"][accept*=".csv"]').setInputFiles(csv)
  await page.waitForTimeout(900)
  check('D-224 연구소 CSV: 이미 있던 업체는 CSV 칸만 고쳤다고 알린다', alertText.includes('이미 있던 1개') && alertText.includes('그대로'), alertText)
  await page.goto(BASE + '/tools/labcare/clients?cid=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  const detail = await page.locator('body').innerText()
  check('D-224 연구소 CSV: 인정번호가 남는다(예전: 통째로 바뀌어 사라짐)', detail.includes('2026-D224-01'), detail.slice(0, 200))
  check('D-224 연구소 CSV: CSV 에 적은 업종 · 유형은 바뀐다', detail.includes('정밀 부품 제조업') && detail.includes('기업부설연구소'))
  const payroll = await page.locator('input[type="number"]').first().inputValue().catch(() => '')
  check('D-224 연구소 CSV: 연구원 인건비가 남는다', payroll === '80000000', payroll)
  // 절세 기준: 세 칸을 고치면 예상 절세액이 따라온다(등록 때 적은 당해연도 연구개발비에 묶이지 않음)
  const estLine = async () => (await page.locator('p', { hasText: '예상 연간 절세 효과' }).innerText().catch(() => '')) ?? ''
  const est1 = await estLine()
  await page.locator('input[type="number"]').nth(1).fill('20000000')
  await page.getByRole('button', { name: /절세 기준 저장|저장됨/ }).click()
  await page.waitForTimeout(500)
  const est2 = await estLine()
  check('D-224 연구소 절세: 등록 때 당해연도 연구개발비(5천만)를 적었어도, 세 칸을 고쳐 저장하면 예상 절세액이 세 칸 합계(1억)로 바뀐다(예전: 그대로)', est1.includes('5,000만원') && est2.includes('10,000만원') && est2.includes('2,500만원'), `${est1} → ${est2}`)
  await page.locator('p', { hasText: '예상 연간 절세 효과' }).scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {})
  await shot(page, '03-lab-detail-after-csv')

  // 월간 점검 — 지난달 기록이 있으면 그 달을 고를 때 불러온다
  const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const now = new Date()
  const lastMonth = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  await page.goto(BASE + '/tools/labcare/check?cid=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const pickHansol = page.getByTestId('lab-check-picker').getByText('한솔테크(주)')
  if (await pickHansol.count()) {
    await pickHansol.click()
    await page.waitForTimeout(700)
  }
  await page.locator('input[type="month"]').fill(lastMonth)
  await page.waitForTimeout(300)
  check('연구소 점검: 기록이 없는 달은 불러왔다는 안내가 없다', (await page.getByTestId('lab-check-existing').count()) === 0)
  const memo = page.locator('textarea').first()
  await memo.fill('지난달 점검 메모 D224')
  await page.getByRole('button', { name: '점검 제출 및 위험도 저장' }).click()
  await page.waitForTimeout(1200)
  await page.goto(BASE + '/tools/labcare/check?cid=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  if (await page.getByTestId('lab-check-picker').getByText('한솔테크(주)').count()) {
    await page.getByTestId('lab-check-picker').getByText('한솔테크(주)').click()
    await page.waitForTimeout(700)
  }
  check('D-224 연구소 점검: 이번 달 메모는 지난달 메모를 옮겨 오지 않는다', (await page.locator('textarea').first().inputValue()) === '')
  await page.locator('input[type="month"]').fill(lastMonth)
  await page.waitForTimeout(400)
  check('D-224 연구소 점검: 지난달을 고르면 그 달 기록을 불러오고 알린다', (await page.getByTestId('lab-check-existing').count()) === 1 && (await page.locator('textarea').first().inputValue()) === '지난달 점검 메모 D224')
  await page.getByTestId('lab-check-existing').scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {})
  await shot(page, '04-lab-check-existing')

  // 저장 실패 → 화면 위 안내 · [지금 다시 저장]
  await blockWrites(page, 'labcare')
  await page.locator('textarea').first().fill('실패할 메모')
  await page.getByRole('button', { name: '점검 제출 및 위험도 저장' }).click()
  await page.waitForTimeout(1500)
  check('D-224 연구소: 저장이 실패하면 화면 위에 안내(예전: 아무 표시 없음)', (await page.getByTestId('lab-unsaved').count()) === 1)
  await shot(page, '05-lab-unsaved')
  await unblockWrites(page)
  if (await page.getByTestId('lab-unsaved').count()) await page.getByTestId('lab-unsaved').getByRole('button', { name: '지금 다시 저장' }).click()
  await page.waitForTimeout(1200)
  check('D-224 연구소: [지금 다시 저장] 이 되면 안내가 사라진다', (await page.getByTestId('lab-unsaved').count()) === 0)

  // 연구노트 — 적다가 달을 바꾸면 묻는다
  await page.goto(BASE + '/tools/labcare/notes', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const selects = page.locator('select')
  await selects.nth(0).selectOption('cli_hansol')
  await page.waitForTimeout(300)
  // D-224 과제가 없으면 이 화면에서 바로 만든다(예전: 만드는 곳이 없어 연구노트를 못 씀)
  check('D-224 연구노트: 과제가 없는 고객사면 과제 만들기 칸이 뜬다', (await page.getByTestId('lab-note-new-project').count()) === 1)
  await page.getByTestId('lab-note-new-project').scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {})
  await shot(page, '04b-lab-note-new-project')
  if (await page.getByTestId('lab-note-new-project').count()) {
    await page.getByLabel('연구과제 이름').fill('저염 소스 배합 개선 D224')
    await page.getByLabel('연결된 제품 · 서비스').fill('업소용 소스')
    await page.getByRole('button', { name: '과제 만들기' }).click()
    await page.waitForTimeout(500)
  }
  const projOpts = await selects.nth(1).locator('option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean))
  check('D-224 연구노트: 만든 과제가 골라져 있다', projOpts.length === 1 && (await selects.nth(1).inputValue()) === projOpts[0] && (await page.locator('body').innerText()).includes('업소용 소스'))
  if (projOpts.length) {
    const area = page.locator('textarea').first()
    await area.fill('이번 달 시제품 시험 3회 D224')
    let asked = ''
    page.once('dialog', (d) => {
      asked = d.message()
      void d.dismiss()
    })
    const monthBefore = await page.locator('input[type="month"]').inputValue()
    await page.locator('input[type="month"]').fill(lastMonth)
    await page.waitForTimeout(400)
    check('D-224 연구노트: 저장 안 하고 달을 바꾸면 한 번 묻는다', asked.includes('저장하지 않은 연구노트'), asked)
    check('D-224 연구노트: 아니오면 달 · 적은 글 그대로', (await page.locator('input[type="month"]').inputValue()) === monthBefore && (await area.inputValue()) === '이번 달 시제품 시험 3회 D224')
  } else {
    check('연구노트: 시험용 연구과제가 있다', false, '한솔테크 연구과제 없음 — 이 칸은 확인하지 못함')
  }

  /* ---------------- 고용지원금 ---------------- */
  await page.goto(BASE + '/tools/employment/companies', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.getByTestId('emp-add-company').click()
  await page.waitForTimeout(300)
  await page.getByTestId('emp-client-pick').selectOption('cli_hansol')
  await page.getByRole('button', { name: '업체 저장' }).click()
  await page.waitForTimeout(1000)
  const empApp = page.getByTestId('emp-orig')
  await empApp.getByRole('button', { name: /직원 \(/ }).first().click()
  await page.waitForTimeout(500)
  const baseCount = (await employees(page)).filter((e) => e.companyId === 'cli_hansol').length
  // 첫 줄은 머리줄(양식 그대로) — 둘째 줄부터 사람
  const paste = ['이름\t주민번호앞7자리\t입사일\t연락처\t이메일\t지원금ID', '김중복\t9901011\t2026-03-02\t010-1111-2222\t\tyouth_jump', '<img src=x onerror="window.__xss=1">\t9802022\t2026-04-01\t010-3333-4444\t\tyouth_jump'].join('\n')
  const bulk = async () => {
    await page.getByRole('button', { name: /일괄등록/ }).click()
    await page.waitForTimeout(300)
    await page.locator('textarea').last().fill(paste)
    await page.getByRole('button', { name: '데이터 확인' }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /명 등록하기/ }).click()
    await page.waitForTimeout(1200)
  }
  await bulk()
  const first = (await employees(page)).filter((e) => e.companyId === 'cli_hansol')
  check('고용 일괄등록: 두 명이 들어간다', first.length === baseCount + 2, `${baseCount} → ${first.length}`)
  const kim = first.find((e) => e.name === '김중복')
  check('D-224 고용 일괄등록: 직원 서류 칸이 생긴다(예전: 없음)', Array.isArray(kim?.employeeDocs) && kim.employeeDocs.length > 0, JSON.stringify(kim?.employeeDocs ?? null).slice(0, 80))
  await bulk()
  const second = (await employees(page)).filter((e) => e.companyId === 'cli_hansol')
  check('D-224 고용 일괄등록: 같은 명단을 또 붙이면 건너뛴다(예전: 둘씩 생김)', second.length === first.length, `${first.length} → ${second.length}`)
  check('D-224 고용 일괄등록: 건너뛰었다고 알린다', (await page.locator('body').innerText()).includes('건너뛰었습니다'))
  await shot(page, '06-emp-bulk-skip')

  // 지원금 바꾸기 — 회차가 새 지원금 것으로(예전: 처음 지원금 회차가 남아 일정 · D-day 가 틀림)
  // 기본으로는 청년도약 하나만 켜져 있다 → 지원금 관리에서 하나 더 켠다
  await page.goto(BASE + '/tools/employment/programs', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: 'OFF', exact: true }).first().click()
  await page.waitForTimeout(700)
  // D-334 예전에 저장된 지원금 표(계속고용 720만 시절) → '이것만 최신 기준으로' — 켜고 끈 것은 그대로
  const editStoredProgram = (amt) =>
    page.evaluate((a) => {
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i) ?? ''
        if (!k.includes('employment') || !k.includes('orig')) continue
        const rows = JSON.parse(localStorage.getItem(k) ?? '[]')
        const row = rows.find((r) => (r.data ?? r).key === 'programs')
        if (!row) continue
        const progs = (row.data ?? row).value
        if (a !== null) progs.senior_continue.totalAmount = a
        localStorage.setItem(k, JSON.stringify(rows))
        return { total: progs.senior_continue.totalAmount, on: Object.keys(progs).filter((id) => progs[id].enabled).sort().join() }
      }
      return null
    }, amt)
  const stored = await editStoredProgram(7_200_000)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const banner = await page.getByTestId('prog-outdated').innerText().catch(() => '')
  check('D-334 예전 지원금 표(계속고용 720만) → 최신 기준과 다르다는 띠 · 이름 · 옛 금액 → 새 금액', !!stored && banner.includes('고령자 계속고용 장려금(720만 → 1,080만)'), banner || JSON.stringify(stored))
  if (SHOTS) await page.getByTestId('prog-outdated').screenshot({ path: `${SHOTS}/07-prog-outdated.png` }).catch(() => {})
  page.once('dialog', (d) => d.accept())
  await page.getByTestId('prog-outdated-fix').click()
  await page.waitForTimeout(900)
  const after = await editStoredProgram(null)
  check('D-334 [이것만 최신 기준으로] → 1,080만 · 띠 사라짐 · 켜고 끈 것 그대로', after?.total === 10_800_000 && after.on === stored?.on && (await page.getByTestId('prog-outdated').count()) === 0, JSON.stringify({ stored, after }))
  await page.goto(BASE + '/tools/employment/companies?cid=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await empApp.getByRole('button', { name: /직원 \(/ }).first().click()
  await page.waitForTimeout(400)
  const kimBefore = (await employees(page)).find((e) => e.name === '김중복')
  await empApp.getByRole('button', { name: '📋 표' }).click()
  await page.waitForTimeout(400)
  await empApp.locator('tr', { hasText: '김중복' }).locator('button[title="고치기"]').first().click()
  await page.waitForTimeout(600)
  const progBtns = page.locator('button').filter({ hasText: /1인당 최대|월 최대/ })
  const names = await progBtns.allInnerTexts()
  const other = names.findIndex((t) => !t.includes('청년일자리도약'))
  if (other >= 0) await progBtns.nth(other).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: '직원 저장' }).click()
  await page.waitForTimeout(1000)
  const kimAfter = (await employees(page)).find((e) => e.name === '김중복')
  const rj = (e) => JSON.stringify((e?.rounds ?? []).map((r) => [r.label ?? '', r.amount ?? 0, r.offsetMonths ?? r.months ?? '']))
  check('D-224 고용 지원금 바꾸기: 회차가 새 지원금 것으로 다시 만들어진다', other >= 0 && kimBefore?.programId === 'youth_jump' && kimAfter?.programId !== 'youth_jump' && rj(kimAfter) !== rj(kimBefore) && (kimAfter?.rounds ?? []).length > 0, `${names.length}개 · ${kimBefore?.programId}→${kimAfter?.programId} ${rj(kimBefore).slice(0, 50)} → ${rj(kimAfter).slice(0, 50)}`)

  // 내부 보고서 — 이름의 태그가 글자로만
  await page.getByRole('button', { name: '📄 내부 보고서' }).click()
  await page.waitForTimeout(400)
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /HTML 보고서 다운로드/ }).click()])
  const html = readFileSync(await dl.path(), 'utf8')
  check('D-224 고용 내부 보고서: 이름의 태그가 글자로(&lt;img) · 실행되는 태그 없음', html.includes('&lt;img src=x onerror=') && !html.includes('<img src=x'), html.slice(html.indexOf('직원별'), html.indexOf('직원별') + 160))
  await page.keyboard.press('Escape')
  check('D-224 고용: 보고서를 만들어도 화면에서 태그가 실행되지 않는다', (await page.evaluate(() => window.__xss)) === undefined)

  check('오류 없이 끝남', errors.length === 0, errors.join(' | ').slice(0, 300))
  await ctx.close()
}

/* ---------------- D-225 창업감면 · 크레탑 · 기업인증 · 절세 ---------------- */
{
  const SEBANG = [
    '기업명 세방형(주)', '요약 손익계산서 단위:백만원', '구분 2023 2024 2025', '매출액 6000 6200 6397', '영업이익 90 95 104', '당기순이익 150 180 202',
    '요약 재무상태표 단위:백만원', '구분 2023 2024 2025', '자산총계 12000 11500 11000', '부채총계 9800 10100 8740', '자본총계 2200 1400 1000', '유동자산 3000 2900 2801', '유동부채 9500 9800 10000',
  ].join('\n')
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())

  // 세금 계산기 — 사람이 적는 금액 · 2020년 뒤 취임 임원의 퇴직 한도
  await page.goto(BASE + '/tools/tax?c=t6&s=p2', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.locator('#r_start').fill('2024-06-01')
  await page.locator('#r_end').fill('2026-10-17')
  await page.locator('#r_avg2').fill('1억2천만')
  await page.locator('#r_avg2').blur()
  await page.locator('#r_avg3').fill('3억5천')
  await page.locator('#r_avg3').blur()
  await page.waitForTimeout(400)
  const avg2 = await page.locator('#r_avg2').inputValue()
  const avg3 = await page.locator('#r_avg3').inputValue()
  check('D-225 계산기 금액 칸: 1억2천만 → 120,000,000 · 3억5천 → 350,000,000', avg2 === '120,000,000' && avg3 === '350,000,000', `${avg2} / ${avg3}`)
  const rOut = await page.locator('[data-block="r_out"]').innerText().catch(() => '')
  check('D-225 임원 퇴직 한도: 2024-06 취임 → 2020년 이후 29개월 · 정관 한도 58,000,000원', rOut.includes('29개월') && rOut.includes('58,000,000원'), rOut.replace(/\n/g, ' ').slice(0, 220))
  await page.locator('[data-block="r_out"]').scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {})
  await shot(page, '10-tax-retire-limit')

  // 크레탑 숫자 추출기 — 글을 바꾸면 끈 줄이 풀린다(새 보고서의 같은 자리 줄이 말없이 빠지지 않게)
  await page.goto(BASE + '/tools/cretop/extractor', { waitUntil: 'networkidle' })
  await page.getByTestId('cretop-extract-sample').click()
  await page.waitForTimeout(300)
  const box1 = page.getByTestId('cretop-extract-rows').locator('input[type="checkbox"]').first()
  const wasOn = await box1.isChecked().catch(() => false)
  await box1.click().catch(() => {})
  await page.waitForTimeout(150)
  const offNow = !(await box1.isChecked().catch(() => true))
  const area = page.getByLabel('크레탑 표 붙여넣기')
  await area.fill((await area.inputValue()) + '\n')
  await page.waitForTimeout(300)
  check('D-225 크레탑 추출기: 줄을 끈 뒤 글을 바꾸면 다시 켜짐(예전: 꺼진 채 CSV 에서 빠짐)', wasOn && offNow && (await box1.isChecked().catch(() => false)), JSON.stringify({ wasOn, offNow }))

  // 크레탑 이력 ✕ — 한 번 더 묻고, 취소면 그대로
  await page.goto(BASE + '/tools/cretop', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '텍스트 붙여넣기' }).click()
  await page.getByLabel('크레탑 원문').fill(SEBANG)
  await page.getByTestId('cretop-run').click()
  await page.waitForTimeout(900)
  await page.getByTestId('cretop-mini-menu').click()
  await page.waitForTimeout(400)
  const histText = () => page.getByTestId('cretop-mini-history').innerText().catch(() => '')
  const del = page.locator('[title="이력에서 지우기"]').first()
  let asked = ''
  page.once('dialog', (d) => {
    asked = d.message()
    void d.dismiss()
  })
  await del.click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(500)
  check('D-225 크레탑 이력 ✕: 한 번 더 묻고 [취소] 면 그대로(예전: 바로 지워짐)', asked.includes('지울까요') && (await histText()).includes('세방형'), asked || '묻지 않음')
  page.removeAllListeners('dialog')
  page.once('dialog', (d) => void d.accept())
  await del.click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(600)
  check('D-225 크레탑 이력 ✕ → [확인] 이면 지워짐', !(await histText()).includes('세방형'))
  page.removeAllListeners('dialog')

  // 기업인증 — 저장이 안 되면 알린다(예전: 실패를 삼키고 '✓ 확인했습니다' 만)
  await page.goto(BASE + '/tools/cert-os?client=cli_hansol&detail=1', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await blockWrites(page, 'cert-os')
  if (await page.getByTestId('cert-cta').count()) await page.getByTestId('cert-cta').first().click().catch(() => {})
  if (!(await page.getByTestId('cert-stepper').count())) await page.getByTestId('cert-ask-open').click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(300)
  await page.locator('[data-testid^="cert-q-"]').first().click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(800)
  const certBody = await page.locator('body').innerText()
  // 앱 전체의 저장 공간 오류 문구에도 '저장하지 못했습니다' 가 있어, 기업인증 안내 끝말('다시 눌러 주세요')까지 본다
  check('D-225 기업인증: 저장이 막히면 \'저장하지 못했… 다시 눌러 주세요\' 안내', /저장하지 못했[^\n]*다시 눌러 주세요/.test(certBody), certBody.match(/저장[^\n]{0,60}/)?.[0] ?? '안내 없음')
  await shot(page, '11-cert-save-failed')
  await unblockWrites(page)

  check('D-225 화면 오류 0', errors.length === 0, errors.join(' | ').slice(0, 300))
  await ctx.close()
}

/* ---------------- 390 — 넘침 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  for (const path of ['/tools/policy-funding/diagnosis?client=cli_hansol&sample=1', '/tools/labcare/check', '/tools/labcare/notes', '/tools/employment/companies?cid=cli_hansol']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    if (path.includes('policy')) {
      await page.getByLabel('회사명 (선택)').fill('휴대폰에서 바꾼 이름')
      await page.waitForTimeout(300)
    }
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(`390 ${path}: 옆으로 넘치지 않음`, over <= 1, String(over))
    if (path.includes('policy')) {
      await page.getByTestId('pf-stale').scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {})
      await shot(page, '07-390-pf-stale')
    }
  }
  await ctx.close()
}

await browser.close()
console.log(`\n모듈 안전: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
