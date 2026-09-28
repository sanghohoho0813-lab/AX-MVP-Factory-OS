/**
 * 업체 상세 성숙화 시험 (D-129) — 업체를 열면 서류 · 회사 정보 · 진행 상태가 가장 적은 누름으로.
 *
 *  1440  탭 순서(개요 → 서류 → 업무 → 업무 일기 → 고객 플랫폼 → 수금) · 컨설팅 · 자금·지원은 '더 보기' 로
 *        · 예전 ?tab=files 주소는 서류로 · 개요에 돈 숫자 칸이 없다 · 서류 목록에 번호 · 주소 칸이 없다
 *        · 인정서 텍스트를 올리면 '인증서' 후보 → 모두 확인 → 회사 기본 정보 인증서 묶음 · 다시 올려도 칸이 늘지 않는다
 *        · 대표자 성별은 고른 것만(남/여) — 카드에 '김대표 · 남 · 만 N세'
 *        · 현황 카드: 빈 곳 눌러 열기 · 안의 단추(조각 · 돈 · 서류 올리기)는 제 일 · 계약 배지 · 사업자등록번호 · 상태 칩 색
 *  360 · 390 · 430 × 1.0 · 1.30  상세 탭 · 현황 목록 가로 넘침 0 · 삭제 확인(체크) 폰에서
 *
 *   node e2e/detail.mjs http://localhost:4390
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

const LAB = {
  name: '연구소인정서.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from(['연구개발전담부서 인정서', '업체명 : 한솔테크(주)', '인정번호 : 2024-1234', '인정일 : 2024년 3월 5일', '위 기업의 연구개발전담부서를 인정합니다.', '한국산업기술진흥협회장'].join('\n'), 'utf8'),
}

const record = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_hansol'))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())

  // 탭 순서 · 숨은 탭
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const tabs = await page.getByRole('tab').allInnerTexts()
  check('탭 순서: 개요 → 서류 → 업무 → 업무 일기 → 고객 플랫폼 → 수금', JSON.stringify(tabs.map((t) => t.split('\n')[0].trim())) === JSON.stringify(['개요', '서류', '업무', '업무 일기', '고객 플랫폼', '수금']), JSON.stringify(tabs))
  const main = (await page.locator('main').innerText()) ?? ''
  check('개요: 돈 숫자 칸(못 받은 내 돈)을 되풀이하지 않는다', !main.includes('못 받은 내 돈'))
  check('개요: 없는 서류 칸이 없다', !/없는 서류\s*\d/.test(main))

  // 숨긴 탭은 '더 보기' 로 간다 · 주소로도 열린다
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=consulting', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('컨설팅: 주소로 열면 그 탭만 잠깐 보인다(데이터 그대로)', (await page.getByRole('tab', { name: '컨설팅' }).count()) === 1)
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=files', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('예전 ?tab=files → 서류 탭', (await page.getByRole('tab', { name: '서류', selected: true }).count()) === 1)
  check('서류 탭 안에 고객과 주고받은 파일', (await page.getByTestId('client-shared-files').count()) === 1)
  const docsText = (await page.locator('main').innerText()) ?? ''
  check('서류 목록: 사업자등록번호 · 법인등록번호 · 사업장 주소 칸이 없다', !/(^|\n)\s*(사업자등록번호|법인등록번호|사업장 주소)\s*(\n|$)/.test(docsText) && (await page.locator('[data-file-input="businessNumber"], [data-file-input="corporateNumber"], [data-file-input="businessAddress"]').count()) === 0)
  check('예전 파일(법인인감증명서.pdf)이 그대로 있다', docsText.includes('법인인감증명서.pdf'))
  const seal = page.locator('[data-file-actions="법인인감증명서"]').first()
  check('파일 단추: 미리보기 · 새 창 · 내려받기(교체는 클라우드 시험에서)', (await seal.getByRole('button', { name: '법인인감증명서 미리보기' }).count()) === 1 && (await seal.getByRole('button', { name: '법인인감증명서 새 창에서 열기' }).count()) === 1 && (await seal.getByRole('button', { name: '법인인감증명서 내려받기' }).count()) === 1, String(await page.locator('[data-file-actions]').evaluateAll((els) => els.map((e) => e.getAttribute('data-file-actions') + ':' + e.textContent))))
  const rec0 = await record(page)
  check('예전 기록: 사업자등록번호 · 법인등록번호 값은 그대로', rec0.businessNumber === '123-45-67890' && rec0.corporateNumber === '134511-0022334')

  // 서류 → 회사 정보 (인정서)
  await page.getByRole('button', { name: '한꺼번에 올리기' }).first().click()
  await page.getByLabel('서류 파일 고르기').setInputFiles(LAB)
  const pick = page.getByLabel('연구소인정서.txt 칸 고르기')
  await pick.waitFor({ timeout: 15000 })
  if ((await pick.inputValue()) === '') await pick.selectOption('__new__')
  const newLabel = page.getByLabel('연구소인정서.txt 새 칸 이름')
  if ((await newLabel.count()) === 1 && (await newLabel.inputValue()) === '') await newLabel.fill('연구개발전담부서 인정서')
  await page.getByRole('button', { name: /고른 것 전부 올리기/ }).click()
  await page.waitForTimeout(1200)
  await page.keyboard.press('Escape').catch(() => {})
  const r1 = await record(page)
  check('올리기: 확인 전에는 회사 정보에 칸이 없다(자동 확정 없음)', !(r1.customFields ?? []).some((f) => f.label === '연구개발전담부서'))
  check('올리기: 인증서 후보가 확인 필요로 남는다', (r1.factInbox ?? []).some((c) => c.key === 'cf:연구개발전담부서' && c.group === 'credential'), JSON.stringify(r1.factInbox))

  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const inbox = page.getByTestId('fact-inbox')
  const row = inbox.locator('[data-fact="cf:연구개발전담부서"]')
  const rowText = (await row.innerText().catch(() => '')) ?? ''
  check('개요: 자료에서 찾은 정보 — 연구개발전담부서 · 인정번호 · 출처 인증서', rowText.includes('연구개발전담부서') && rowText.includes('2024-1234') && rowText.includes('인증서'), rowText)
  await page.getByTestId('fact-accept-all').click()
  await page.waitForTimeout(900)
  const r2 = await record(page)
  const field = (r2.customFields ?? []).filter((f) => f.label === '연구개발전담부서')
  check('확인: 회사 기본 정보 · 인증서 묶음에 칸 하나', field.length === 1 && field[0].group === 'credential' && field[0].value.includes('2024-1234') && field[0].value.includes('한국산업기술진흥협회'), JSON.stringify(field))
  const shown = (await page.locator('main').innerText()) ?? ''
  check('개요: 회사 기본 정보에 연구개발전담부서가 보인다', shown.includes('연구개발전담부서') && shown.includes('인정번호 2024-1234'))

  // 다시 올려도 칸이 늘지 않고 묻지 않는다
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=docs', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: '한꺼번에 올리기' }).first().click()
  await page.getByLabel('서류 파일 고르기').setInputFiles(LAB)
  const pick2 = page.getByLabel('연구소인정서.txt 칸 고르기')
  await pick2.waitFor({ timeout: 15000 })
  if ((await pick2.inputValue()) === '') await pick2.selectOption('__new__')
  const nl2 = page.getByLabel('연구소인정서.txt 새 칸 이름')
  if ((await nl2.count()) === 1 && (await nl2.inputValue()) === '') await nl2.fill('연구개발전담부서 인정서')
  await page.getByRole('button', { name: /고른 것 전부 올리기/ }).click()
  await page.waitForTimeout(1200)
  const r3 = await record(page)
  check('같은 인정서 다시: 칸은 하나 · 묻지 않는다', (r3.customFields ?? []).filter((f) => f.label === '연구개발전담부서').length === 1 && !(r3.factInbox ?? []).some((c) => c.key === 'cf:연구개발전담부서' && c.status !== 'confirmed' && c.status !== 'dismissed' && !(r3.factMeta?.['cf:연구개발전담부서'])) )
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('같은 인정서 다시: 확인 카드에 연구개발전담부서가 없다', (await page.locator('[data-fact="cf:연구개발전담부서"]').count()) === 0)

  // 대표자 성별 — 고른 것만
  const fillEmpty = page.getByRole('button', { name: /아직 안 적은 \d+칸 채우기/ })
  if ((await fillEmpty.count()) > 0) await fillEmpty.first().click()
  const rest = page.getByRole('button', { name: /^나머지 \d+칸 보기/ })
  if ((await rest.count()) > 0) await rest.first().click()
  const genderBtn = page.getByRole('button', { name: '대표자 성별 입력' })
  check('회사 기본 정보: 대표자 성별 칸이 있다(비어 있음 — 이름으로 짐작하지 않는다)', (await genderBtn.count()) === 1)
  await genderBtn.click()
  await page.getByRole('group', { name: '대표자 성별' }).getByRole('button', { name: '남' }).click()
  await page.waitForTimeout(700)
  const r4 = await record(page)
  check('대표자 성별: 고른 값(male)만 저장', r4.representativeGender === 'male', String(r4.representativeGender))

  // 현황 카드
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const hc = page.locator('[data-testid="client-card"][data-client-id="cli_hansol"]')
  const hcText = (await hc.innerText()) ?? ''
  check('카드: 이름 옆 계약 배지(혼합 계약)', ((await hc.locator('[data-contract-badge]').innerText().catch(() => '')) ?? '').trim() === '혼합 계약')
  check('카드: 대표자 줄 — 김대표 · 남 · 만 N세', /김대표 · 남 · 만 \d+세/.test(hcText), hcText.slice(0, 200))
  check("카드: '사업자' 가 아니라 '사업자등록번호'", /사업자등록번호\s+123-45-67890/.test(hcText), hcText.slice(0, 300))
  const chips = await hc.locator('[data-chip-status]').evaluateAll((els) => els.map((e) => ({ s: e.getAttribute('data-chip-status'), t: e.textContent, bg: getComputedStyle(e).backgroundColor })))
  const late = chips.find((c) => c.t.includes('기한 지남'))
  const wait = chips.find((c) => c.s === 'waiting_client')
  const painted = (c) => !!c && c.bg !== 'rgba(0, 0, 0, 0)' && c.bg !== 'rgb(255, 255, 255)'
  check('상태 칩: 기한 지남 = 글자 + 빨간 바탕', painted(late), JSON.stringify(chips))
  check('상태 칩: 고객 대기 = 글자 + 다른 바탕', painted(wait) && wait.bg !== late?.bg && wait.t.includes('고객 대기'), JSON.stringify(chips))
  // 진행 중(기한 안 지남) — 다른 업체 카드에서
  const allChips = await page.locator('[data-chip-status="in_progress"]').evaluateAll((els) => els.map((e) => ({ t: e.textContent, bg: getComputedStyle(e).backgroundColor })))
  const prog = allChips.find((c) => c.t.includes('진행 중'))
  check('상태 칩: 진행 중 = 글자 + 호박색 바탕(기한 지남과 다름)', painted(prog) && prog.bg !== late?.bg && prog.bg !== wait?.bg, JSON.stringify(allChips))
  await hc.getByRole('button', { name: /^완료 \d+/ }).first().click()
  await page.waitForTimeout(300)
  const done = await hc.locator('[data-chip-status="done"]').evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor))
  check('상태 칩: 완료 = 브랜드 파랑 바탕', done.length > 0 && done.every((bg) => bg !== 'rgba(0, 0, 0, 0)' && bg !== prog?.bg), JSON.stringify(done))

  // 안의 단추는 제 일 — 서류 올리기는 시트, 조각은 상태 바꾸기(업체로 가지 않는다)
  await hc.getByRole('button', { name: '한솔테크(주) 서류 올리기' }).click()
  await page.waitForTimeout(500)
  check('안의 단추: 서류 올리기 → 시트(업체로 넘어가지 않음)', page.url().endsWith('/ops/clients') && (await page.getByText('서류 한꺼번에 올리기').count()) >= 1, page.url())
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  if ((await page.getByText('서류 한꺼번에 올리기').count()) > 0) await page.getByRole('button', { name: '닫기' }).first().click()
  await page.waitForTimeout(300)
  const money = hc.getByRole('button', { name: /^못 받은 내 돈/ })
  if ((await money.count()) === 1) {
    await money.click()
    await page.waitForTimeout(500)
    check('안의 단추: 돈 → 입금 시트(업체로 넘어가지 않음)', page.url().endsWith('/ops/clients') && (await page.getByRole('dialog').count()) >= 1, page.url())
    await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
  }
  // 조각 → 상태 바꾸기(업체로 넘어가지 않음)
  await hc.locator('[data-chip-status]').first().click()
  await page.waitForTimeout(400)
  check('안의 단추: 상태 조각 → 상태 바꾸기(업체로 넘어가지 않음)', page.url().endsWith('/ops/clients'), page.url())
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  // 빈 곳 누르기
  const box = await hc.boundingBox()
  await page.mouse.click(box.x + box.width - 12, box.y + box.height / 2)
  await page.waitForTimeout(600)
  check('카드 빈 곳을 누르면 업체가 열린다', page.url().includes('/ops/clients/cli_hansol'), page.url())
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const name = page.locator('[data-testid="client-card"][data-client-id="cli_hansol"]').getByRole('button', { name: /한솔테크\(주\)/ }).first()
  await name.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(600)
  check('키보드: 이름 단추 Enter 로 연다', page.url().includes('/ops/clients/cli_hansol'), page.url())

  check('JS 오류 없음', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- 360 · 390 · 430 × 1.0 · 1.30 ---------------- */
for (const width of [360, 390, 430]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  for (const scale of ['default', 'extra_large']) {
    const bad = []
    for (const path of ['/ops/clients', '/ops/clients/cli_hansol', '/ops/clients/cli_hansol?tab=docs', '/ops/clients/cli_hansol?tab=work', '/ops/clients/cli_hansol?tab=fees']) {
      await page.goto(BASE + path, { waitUntil: 'networkidle' })
      await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
      await page.waitForTimeout(450)
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      if (over > 1) bad.push(`${path} +${over}`)
    }
    check(`${width} ${scale}: 현황 · 상세(개요 · 서류 · 업무 · 수금) 가로 넘침 0`, bad.length === 0, bad.join(' | '))
    const smallTabs = await page.getByRole('tab').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => e.textContent))
    check(`${width} ${scale}: 탭 44px`, smallTabs.length === 0, smallTabs.join('|'))
  }
  if (width === 390) {
    // 폰에서 삭제 — 이름을 적지 않고 체크 하나
    await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: '더보기' }).first().click()
    await page.getByRole('button', { name: '업체 삭제' }).click()
    await page.waitForTimeout(300)
    check('390 삭제 1차: 대신 보관하기를 권한다', (await page.getByTestId('delete-archive-instead').count()) === 1)
    await page.getByRole('button', { name: '네, 다음으로' }).click()
    await page.waitForTimeout(300)
    const btn = page.getByRole('button', { name: '이 업체 영구 삭제' })
    check('390 삭제 2차: 체크 전에는 못 누른다', await btn.isDisabled())
    const cb = page.getByTestId('delete-confirm-check')
    const h = await cb.evaluate((el) => (el.closest('label') ?? el).getBoundingClientRect().height)
    check('390 삭제 2차: 확인 칸 누르는 면 44px', h >= 43.5, String(h))
    await cb.check()
    await btn.click()
    await page.waitForTimeout(900)
    const gone = await page.evaluate(() => !JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').some((r) => r.id === 'cli_hansol'))
    check('390 삭제: 실제로 지워지고 목록으로', gone && page.url().endsWith('/ops/clients'), page.url())
  }
  await ctx.close()
}

await browser.close()
console.log(`\n업체 상세: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
