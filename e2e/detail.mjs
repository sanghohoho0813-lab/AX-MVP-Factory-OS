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
  check('탭 순서: 맞춤 추천 → 개요 → 서류 → 업무 → 업무 일기 → 고객 플랫폼 → 수금(D-144)', JSON.stringify(tabs.map((t) => t.split('\n')[0].trim())) === JSON.stringify(['맞춤 추천', '개요', '서류', '업무', '업무 일기', '고객 플랫폼', '수금']), JSON.stringify(tabs))
  check('개요: 처음 열면 개요 · 맨 위가 회사 정보(D-144)', (await page.getByRole('tab', { name: /^개요/, selected: true }).count()) === 1 && (await page.evaluate(() => { const c = document.querySelector('[data-testid="overview-company"]'); const n = document.querySelector('main section, main [data-testid="overview-company"]'); return !!c && c.getBoundingClientRect().top < 700 })))
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
  check('파일 단추: 미리보기 · 새 창 · 내려받기 · 파일 교체(로컬 모드는 잠김 — 교체는 클라우드 시험에서)', (await seal.getByRole('button', { name: '법인인감증명서 미리보기' }).count()) === 1 && (await seal.getByRole('button', { name: '법인인감증명서 새 창에서 열기' }).count()) === 1 && (await seal.getByRole('button', { name: '법인인감증명서 내려받기' }).count()) === 1 && (await seal.getByRole('button', { name: '법인인감증명서 파일 교체' }).isDisabled()), String(await page.locator('[data-file-actions]').evaluateAll((els) => els.map((e) => e.getAttribute('data-file-actions') + ':' + e.textContent))))
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
  // D-144: 사람이 칸을 골라 올린 인정서(글자 파일)는 확실 — 바로 회사 기본 정보 · 인증서 묶음에 들어간다
  const field = (r1.customFields ?? []).filter((f) => f.label === '연구개발전담부서')
  check('올리기: 확실한 인정서는 바로 회사 정보 · 인증서 묶음에(D-144)', field.length === 1 && field[0].group === 'credential' && field[0].value.includes('2024-1234') && field[0].value.includes('한국산업기술진흥협회'), JSON.stringify(r1.customFields))
  check('올리기: 바로 넣은 것은 확인함에 남지 않는다', !(r1.factInbox ?? []).some((c) => c.key === 'cf:연구개발전담부서'), JSON.stringify(r1.factInbox))
  await page.getByRole('tab', { name: /맞춤 추천/ }).click()
  await page.waitForTimeout(900)
  const batch = (await page.getByTestId('smart-batch').innerText().catch(() => '')) ?? ''
  check('맞춤 추천: 방금 올린 서류 — 바로 넣은 정보에 연구개발전담부서', batch.includes('바로 넣은 정보') && batch.includes('연구개발전담부서'), batch.slice(0, 300))

  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const shown = (await page.getByTestId('overview-company').innerText()) ?? ''
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
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  check('같은 인정서 다시: 확인 카드에 연구개발전담부서가 없다', (await page.locator('[data-fact="cf:연구개발전담부서"]').count()) === 0)

  // 대표자 성별 — 고른 것만(회사 정보는 개요 맨 위)
  await page.getByRole('tab', { name: /^개요/ }).click()
  await page.waitForTimeout(500)
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

/* ---------------- D-144 서류 올리기 한 번 → 바로 입력 · 표시 · 모듈 판정 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  // 업종만 적혀 있는 업체 — 주소 · 설립일 · 사업자번호 없음
  const BIZ = {
    name: '사업자등록증.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(['사업자등록증', '(법인사업자)', '등록번호 : 124-81-00998', '법인명(단체명) : 미래바이오랩', '대표자 : 이대표', '개업연월일 : 2023 년 01 월 10 일', '법인등록번호 : 110111-1234567', '사업장 소재지 : 경기도 파주시 탄현면 평화로 3', '업태 : 제조업', '종목 : 바이오 시약'].join('\n'), 'utf8'),
  }
  const ROSTER = {
    name: '사업장가입자명부.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(['4대보험 사업장 가입자 명부', '사업장명: 미래바이오랩', '발급일시 2026.09.20', '성명 주민등록번호 국민연금 건강보험 산재보험 고용보험', '980310-1234567 홍길동', '2026-08-05 2026-08-05 2026-08-05 2026-08-05', '860201-2345678 김영희', '2020-03-01 2020-03-01 - -'].join('\n'), 'utf8'),
  }
  const UNKNOWN = { name: '메모.txt', mimeType: 'text/plain', buffer: Buffer.from('회의 메모 — 다음 주 화요일 다시 연락', 'utf8') }
  const rec = () => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_mirae'))

  await page.goto(BASE + '/ops/clients/cli_mirae', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('머리줄: 서류 올리기 단추', (await page.getByTestId('client-upload').count()) === 1)
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([BIZ, ROSTER, UNKNOWN])
  // D-146: 남김없이 전부 올리고 창이 닫힌다 — 모르는 서류는 '기타 · 확인 필요' 칸으로, 어디에 넣었는지 맞춤 추천에 보인다
  await page.getByTestId('smart-placed').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  const placedText = (await page.getByTestId('smart-placed').innerText()) ?? ''
  check('읽자마자: 3개 모두 서류함에 · 어디 넣었는지 보임 · 모르는 1개는 기타 · 확인 필요(D-146)', /서류함에 넣은 곳 3개/.test(placedText) && /확인 필요 1/.test(placedText) && placedText.includes('메모.txt') && placedText.includes('사업자등록증'), placedText)
  const r = await rec()
  const labelOf = (x, key) => (x.customDocuments ?? []).find((d) => d.key === key)?.label ?? key
  const filed = Object.entries(r.documents).filter(([, d]) => d.fileName).map(([k, d]) => `${labelOf(r, k)}=${d.fileName}`)
  check('서류함: 올린 3개가 모두 칸에 있음(D-146)', filed.length === 3 && filed.includes('businessRegistration=사업자등록증.txt') && filed.some((x) => x.startsWith('기타 · 확인 필요') && x.endsWith('=메모.txt')) && filed.some((x) => x.endsWith('=사업장가입자명부.txt')), filed.join(' | '))
  check('바로 입력: 사업자번호 · 설립일 · 주소(빈 칸이었던 것)', r.businessNumber.replace(/\D/g, '') === '1248100998' && r.establishedAt === '2023-01-10' && r.businessAddress.includes('파주시'), JSON.stringify({ b: r.businessNumber, e: r.establishedAt, a: r.businessAddress }))
  check('바로 입력: 명부 재직 인원 → 직원 수', String(r.employeeCount).includes('2') || String(r.employeeCount).includes('1'), String(r.employeeCount))
  check('명부: 고용지원금 명부 진단이 저절로 붙음', (r.toolResults ?? []).some((t) => t.toolKey === 'employment' && t.title === '4대보험 명부 진단'))
  check('명부: 주민등록번호 뒷자리를 남기지 않음', !JSON.stringify(r).includes('1234567') || !JSON.stringify(r.toolResults).includes('1234567'))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check('올린 뒤: 맞춤 추천 탭으로', (await page.getByRole('tab', { name: /맞춤 추천/, selected: true }).count()) === 1)
  const batch = (await page.getByTestId('smart-batch').innerText()) ?? ''
  check('맞춤 추천: 방금 올린 서류 — 바로 넣은 정보 · 명부 진단', batch.includes('바로 넣은 정보') && batch.includes('사업자등록번호') && batch.includes('4대보험 명부'), batch.slice(0, 400))
  const ins = await page.getByTestId('smart-insight').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-key')}:${e.getAttribute('data-tone')}`))
  check('모듈별 판정: 정책자금 · 고용지원금 · 창업감면 · 지원사업 …', ['policy-funding', 'employment', 'startup-tax', 'grants'].every((k) => ins.some((x) => x.startsWith(k + ':'))), ins.join())
  check('모듈별 판정: 정책자금은 서류만으로 판정(정보 부족 아님)', ins.some((x) => x.startsWith('policy-funding:') && !x.endsWith(':need')), ins.join())
  check('모듈별 판정: 고용지원금은 명부로 판정', ins.some((x) => x.startsWith('employment:') && !x.endsWith(':need')), ins.join())
  check('다음 행동 추천이 있다', (await page.getByTestId('smart-step').count()) >= 1)
  await page.getByTestId('smart-step-next').first().click()
  await page.waitForTimeout(600)
  const r2 = await rec()
  check('다음 행동 → 다음 약속으로 한 번에', r2.nextAction !== r.nextAction && r2.nextActionDueDate !== '', `${r2.nextAction} ${r2.nextActionDueDate}`)

  // 다른 값이 있으면 덮지 않고 묻는다(사진 · 다른 주소)
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const before = (await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((x) => x.id === 'cli_hansol'))).businessNumber
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([{ ...BIZ, name: '한솔-사업자등록증.txt', buffer: Buffer.from(BIZ.buffer.toString('utf8').replace('미래바이오랩', '한솔테크(주)'), 'utf8') }])
  await page.getByTestId('smart-batch').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  const after = (await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((x) => x.id === 'cli_hansol'))).businessNumber
  check('다른 값: 이미 적힌 사업자번호(123-45-67890)는 덮지 않음', after === before && before === '123-45-67890', `${before} → ${after}`)
  const notes = await page.getByTestId('fact-note').allInnerTexts()
  check('다른 값: 확인할 정보에 "지금 적힌 값과 달라요" 표시', notes.some((t) => t.includes('지금 적힌 값과 달라요')), notes.join(' | '))
  check('D-144 오류 0', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-146 서류 분류 — 제목으로 칸 · 겹치면 번호 칸 · 지우기 · 다시 분류 ---------------- */
for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const tag = `(${width})`
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const rec = () => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_mirae'))
  const labelOf = (x, key) => (x.customDocuments ?? []).find((d) => d.key === key)?.label ?? key
  const filed = (x) => Object.entries(x.documents).filter(([, d]) => d.fileName).map(([k, d]) => `${labelOf(x, k)}=${d.fileName}`)
  const txt = (name, lines) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(lines.join('\n'), 'utf8') })
  const GRAD = txt('scan_001.txt', ['졸 업 증 명 서', '성명 : 이대표', '위 사람은 본교 디자인학과를 졸업하였음을 증명합니다.', '2026년 9월 1일'])
  const BIZ1 = txt('사업자등록증_2025.txt', ['사업자등록증', '(법인사업자)', '등록번호 : 124-81-00998', '법인명(단체명) : 미래바이오랩'])
  const BIZ2 = txt('사업자등록증_최신.txt', ['사 업 자 등 록 증', '(법인사업자)', '등록번호 : 124-81-00998', '법인명(단체명) : 미래바이오랩'])

  // 1) 폴더째(같은 서류 둘 · 칸이 없는 서류) — 덮지 않고 전부
  await page.goto(BASE + '/ops/clients/cli_mirae', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([GRAD, BIZ1, BIZ2])
  await page.getByTestId('smart-placed').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  check(`올린 뒤: 겹친 서류는 '하나 지우세요' 안내 ${tag}`, ((await page.getByTestId('smart-placed').innerText()) ?? '').includes('하나 지우세요'))
  const r1 = await rec()
  const f1 = filed(r1)
  check(`제목으로 칸: 졸업증명서는 신분증 칸이 아니라 '졸업증명서' 새 칸 ${tag}`, f1.includes('졸업증명서=scan_001.txt') && !f1.some((x) => x.startsWith('representativeId=')), f1.join(' | '))
  check(`겹치면 번호 칸: 사업자등록증 둘 다 남음(덮지 않음) ${tag}`, f1.includes('businessRegistration=사업자등록증_2025.txt') && f1.includes('사업자등록증 (2)=사업자등록증_최신.txt'), f1.join(' | '))

  // 2) 서류 탭에서 오래된 쪽 지우기 — 한 번 더 묻는다
  await page.goto(BASE + '/ops/clients/cli_mirae?tab=docs', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const dupKey = (r1.customDocuments ?? []).find((d) => d.label === '사업자등록증 (2)')?.key
  check(`서류 탭: 번호 칸이 보인다 ${tag}`, ((await page.locator('main').innerText()) ?? '').includes('사업자등록증 (2)'))
  await page.getByTestId('doc-remove-businessRegistration').click()
  check(`파일 지우기: 바로 지우지 않고 묻는다 ${tag}`, (await page.getByTestId('doc-remove-businessRegistration-yes').count()) === 1 && (await rec()).documents.businessRegistration.fileName !== '')
  await page.getByTestId('doc-remove-businessRegistration-yes').click()
  await page.waitForTimeout(600)
  const r2 = await rec()
  check(`파일 지우기: 오래된 사업자등록증만 빠지고 최신은 남음 ${tag}`, r2.documents.businessRegistration.fileName === '' && r2.documents[dupKey]?.fileName === '사업자등록증_최신.txt', filed(r2).join(' | '))

  // 3) 서류 다시 분류 — 예전에 엉뚱한 칸에 들어간 파일(중소기업 확인서 칸에 졸업장 · 신분증 칸에 재무제표)
  await page.evaluate(() => {
    const all = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    const x = all.find((r) => r.id === 'cli_mirae')
    x.documents.smeCertificate = { ...x.documents.smeCertificate, received: true, fileName: '대학교_졸업증명서.pdf', issuedAt: '2020-01-01' }
    x.documents.representativeId = { ...x.documents.representativeId, received: true, fileName: '표준재무제표증명_2025.pdf' }
    x.documents.healthInsurance = { ...x.documents.healthInsurance, received: true, fileName: 'IMG_0001.jpg' }
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(all))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check(`다시 분류 전: 중소기업 확인서 만료 표시(엉킨 상태) ${tag}`, ((await page.locator('main').innerText()) ?? '').includes('만료됨'))
  await page.getByTestId('doc-resort').click()
  await page.getByTestId('resort-sheet').waitFor()
  await page.waitForFunction(() => !document.querySelector('[data-testid="resort-reading"]'), null, { timeout: 15000 })
  const moves = await page.getByTestId('resort-move').allInnerTexts()
  check(`다시 분류: 졸업증명서 · 재무제표 2개만 옮기자고 함(근거 없는 IMG 는 그대로) ${tag}`, moves.length === 2 && moves.some((t) => t.includes('졸업증명서.pdf') && t.includes('중소기업 확인서')) && moves.some((t) => t.includes('재무제표') && t.includes('최근 3개년 재무제표')), moves.join(' || '))
  await page.getByTestId('resort-apply').click()
  await page.waitForTimeout(800)
  const r3 = await rec()
  const f3 = filed(r3)
  check(`다시 분류 후: 졸업증명서는 졸업증명서 칸(이미 하나 있어 (2)) · 재무제표는 재무제표 칸 · 엉뚱한 칸은 비워짐 ${tag}`, f3.includes('졸업증명서 (2)=대학교_졸업증명서.pdf') && f3.includes('졸업증명서=scan_001.txt') && f3.includes('financialStatements=표준재무제표증명_2025.pdf') && !r3.documents.smeCertificate.fileName && !r3.documents.representativeId.fileName && r3.documents.healthInsurance.fileName === 'IMG_0001.jpg', f3.join(' | '))
  check(`다시 분류 후: 중소기업 확인서 '만료됨' 사라짐 ${tag}`, !((await page.locator('main').innerText()) ?? '').includes('만료됨'))
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(`가로 넘침 0 ${tag}`, over <= 0, String(over))
  check(`D-146 오류 0 ${tag}`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-147 서류함 — 시스템 파일 · 같은 파일 · 유효기간 · 기타 칸 옮기기 · 손볼 것 · 읽다 닫기 ---------------- */
for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const tag = `(${width})`
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const rec = () => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_mirae'))
  const labelOf = (x, key) => (x.customDocuments ?? []).find((d) => d.key === key)?.label ?? key
  const filed = (x) => Object.entries(x.documents).filter(([, d]) => d.fileName).map(([k, d]) => `${labelOf(x, k)}=${d.fileName}`)
  const txt = (name, lines) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(lines.join('\n'), 'utf8') })
  const SEAL = txt('인감.txt', ['법인인감증명서', '상호 : 미래바이오랩', '발급일자 : 2026년 05월 01일'])
  const MEMO = txt('스캔0003.txt', ['회의 메모 — 다음 주 다시 연락'])
  const JUNK = [txt('Thumbs.db', ['x']), txt('desktop.ini', ['[.ShellClassInfo]']), txt('~$계획서.txt', ['tmp'])]

  await page.goto(BASE + '/ops/clients/cli_mirae', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([SEAL, MEMO, ...JUNK])
  await page.getByTestId('smart-placed').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  const r1 = await rec()
  const f1 = filed(r1)
  check(`시스템 파일: Thumbs.db · desktop.ini · ~$ 임시 파일은 올리지 않음 ${tag}`, f1.length === 2 && !f1.some((x) => /Thumbs|desktop\.ini|~\$/.test(x)), f1.join(' | '))
  const sealCell = (r1.customDocuments ?? []).find((d) => d.label === '법인인감증명서')
  check(`알려진 서류 새 칸: 법인인감증명서 · 유효기간 3개월 · 발급일 ${tag}`, sealCell?.validMonths === 3 && r1.documents[sealCell.key]?.issuedAt === '2026-05-01', JSON.stringify({ sealCell, st: sealCell && r1.documents[sealCell.key] }))

  // 같은 파일을 한 번 더
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([SEAL])
  await page.waitForFunction(() => /이름 · 크기가 같은 파일/.test(document.querySelector('[data-testid="smart-placed"]')?.textContent ?? ''), null, { timeout: 20000 })
  check(`같은 파일: 올리되 '이름 · 크기가 같은 파일이 이미 있어요' 표시 ${tag}`, true)

  // 서류 탭 — 손볼 것 한 줄
  await page.goto(BASE + '/ops/clients/cli_mirae?tab=docs', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const shelf = (await page.getByTestId('doc-shelf').innerText()) ?? ''
  check(`손볼 것: 만료 · 무슨 서류인지 확인 · 겹친 서류 ${tag}`, /만료 [1-9]/.test(shelf) && /무슨 서류인지 확인 1/.test(shelf) && /겹친 서류 1묶음/.test(shelf), shelf)
  await page.getByTestId('shelf-other').click()
  await page.waitForTimeout(700)
  const otherKey = (r1.customDocuments ?? []).find((d) => d.label.startsWith('기타 · 확인 필요'))?.key
  const inView = await page.evaluate((k) => { const el = document.getElementById(`doc-card-${k}`); if (!el) return false; const b = el.getBoundingClientRect(); return b.top < window.innerHeight && b.bottom > 0 }, otherKey)
  check(`손볼 것: '무슨 서류인지 확인' 누르면 그 칸으로 ${tag}`, inView)

  // 기타 칸 — 무슨 서류인지 고르기 → 맞는 칸으로
  await page.getByLabel(/무슨 서류인지 고르기/).first().selectOption({ label: '중소기업 확인서' })
  await page.waitForTimeout(700)
  const r2 = await rec()
  check(`기타 칸 옮기기: 중소기업 확인서 칸으로 · 기타 칸 없어짐 ${tag}`, r2.documents.smeCertificate?.fileName === '스캔0003.txt' && !(r2.customDocuments ?? []).some((d) => d.label.startsWith('기타 · 확인 필요')), filed(r2).join(' | '))
  check(`옮긴 뒤: '무슨 서류인지 확인' 칩 사라짐 ${tag}`, (await page.getByTestId('shelf-other').count()) === 0)

  // 읽는 중에 닫기 — 남은 파일은 올리지 않는다
  const PDF = (await import('node:fs')).readFileSync('e2e/fixtures/cretop-sample.pdf')
  const many = Array.from({ length: 12 }, (_, i) => ({ name: `보고서${i + 1}.pdf`, mimeType: 'application/pdf', buffer: PDF }))
  const before = filed(await rec()).length
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles(many)
  await page.getByRole('button', { name: '멈추고 닫기' }).waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: '멈추고 닫기' }).click()
  await page.waitForTimeout(6000)
  const after = filed(await rec()).length
  check(`읽다가 닫기: 멈추고 하나도 올리지 않음 ${tag}`, after === before && (await page.getByRole('dialog').count()) === 0, `${before} → ${after}`)

  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(`가로 넘침 0 ${tag}`, over <= 0, String(over))
  check(`D-147 오류 0 ${tag}`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-148 직접 만든 칸 만료 → 오늘 · 요청 문구 / 빈 새 칸은 확실한 것만에 안 들어감 ---------------- */
for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const tag = `(${width})`
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  // 직접 만든 칸 — 곧 만료(법인인감증명서 3개월 · 발급 7-10 → 10-10, 오늘 화면은 14일 안) · 이미 만료(납세증명서 1개월 · 발급 8-01 → 9-01)
  await page.evaluate(() => {
    const all = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    const x = all.find((r) => r.id === 'cli_mirae')
    x.documents = x.documents ?? {}
    x.customDocuments = [...(x.customDocuments ?? []), { id: 'cd_seal', key: 'customdoc_seal148', label: '법인인감증명서', validMonths: 3, sensitive: false }, { id: 'cd_tax', key: 'customdoc_tax148', label: '납세증명서', validMonths: 1, sensitive: false }]
    x.documents.customdoc_seal148 = { received: true, issuedAt: '2026-07-10', fileName: '인감.pdf', fileSize: 10, storagePath: '', note: '', updatedAt: null }
    x.documents.customdoc_tax148 = { received: true, issuedAt: '2026-08-01', fileName: '납세.pdf', fileSize: 10, storagePath: '', note: '', updatedAt: null }
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(all))
  })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const agenda = (await page.getByTestId('agenda-row').allInnerTexts()).join(' | ')
  check(`오늘: 직접 만든 칸 법인인감증명서 만료가 다가오는 기한에 ${tag}`, agenda.includes('법인인감증명서'), agenda.slice(0, 400))
  // D-149: 맞춤 추천 다음 행동에 '서류함 정리하기' → 열기 누르면 서류 탭
  await page.goto(BASE + '/ops/clients/cli_mirae?tab=smart', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const stepTexts = await page.getByTestId('smart-step').allInnerTexts()
  const shelfIdx = stepTexts.findIndex((t) => t.includes('서류함 정리하기'))
  check(`맞춤 추천: 다음 행동에 '서류함 정리하기 — 만료' ${tag}`, shelfIdx >= 0 && /만료 [1-9]/.test(stepTexts[shelfIdx]), stepTexts.join(' || ').slice(0, 400))
  if (shelfIdx >= 0) await page.getByTestId('smart-step').nth(shelfIdx).getByRole('link', { name: /열기/ }).click()
  await page.waitForTimeout(600)
  check(`맞춤 추천: 서류함 정리하기 → 서류 탭 ${tag}`, (await page.getByRole('tab', { name: /^서류/, selected: true }).count()) === 1)
  await page.goto(BASE + '/ops/clients/cli_mirae?tab=docs', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const shelf = (await page.getByTestId('doc-shelf').innerText()) ?? ''
  check(`서류 탭 손볼 것: 만료(납세증명서) ${tag}`, /만료 [1-9]/.test(shelf), shelf)
  await page.getByRole('button', { name: '서류 요청 문구' }).first().click()
  await page.waitForTimeout(400)
  const msg = (await page.getByRole('dialog').locator('textarea').inputValue()) ?? ''
  check(`서류 요청 문구: 만료된 납세증명서 새 발급본도 ${tag}`, msg.includes('납세증명서') && msg.includes('새 발급본'), msg.slice(0, 300))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // 한꺼번에 올리기 — 확실한 서류를 '새 칸' 으로 바꾸고 이름을 비우면 '확실한 것만' 에 안 들어간다(예전: 다른 칸을 덮음)
  await page.getByRole('button', { name: '한꺼번에 올리기' }).click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([{ name: '사업자등록증.txt', mimeType: 'text/plain', buffer: Buffer.from('사업자등록증\n등록번호 : 124-81-00998', 'utf8') }])
  await page.waitForTimeout(1200)
  await page.getByLabel('사업자등록증.txt 칸 고르기').selectOption('__new__')
  await page.waitForTimeout(200)
  const nameBox = page.getByLabel('사업자등록증.txt 새 칸 이름')
  if (await nameBox.count()) await nameBox.fill('')
  await page.waitForTimeout(200)
  const sureBtn = page.getByRole('button', { name: /^확실한 것만 올리기/ })
  check(`빈 이름 새 칸: '확실한 것만 올리기' 가 막힘(다른 칸 덮지 않음) ${tag}`, await sureBtn.isDisabled())
  await page.getByTestId('bulk-close').click()
  await page.waitForTimeout(300)
  const r = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((x) => x.id === 'cli_mirae'))
  check(`빈 이름 새 칸: 납세증명서 칸 파일 그대로 ${tag}`, r.documents.customdoc_tax148.fileName === '납세.pdf')

  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(`가로 넘침 0 ${tag}`, over <= 0, String(over))
  check(`D-148 오류 0 ${tag}`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-145 맞춤 상담 ---------------- */
for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  await page.getByTestId('advisor').waitFor({ timeout: 15000 })
  const groups = await page.getByTestId('advisor-group').count()
  check(`${width} 상담 목차: 다섯 묶음 · 처음엔 첫 묶음만 펼침`, groups === 5 && (await page.getByTestId('advisor-q').count()) === 2, `${groups}`)
  await page.getByTestId('advisor-group').nth(1).click()
  await page.locator('[data-testid="advisor-q"][data-q="policy"]').click()
  await page.waitForTimeout(300)
  const pol = (await page.locator('[data-testid="advisor-answer"][data-q="policy"]').innerText().catch(() => '')) ?? ''
  check(`${width} 상담: 버튼 하나로 정책자금 답(결론 · 순서 · 열기)`, /정책자금/.test(pol) && (/진행 가능성/.test(pol) || /알아야 판정/.test(pol)), pol.slice(0, 200))
  await page.getByTestId('advisor-input').fill('배당이랑 급여 중에 뭐가 나아?')
  await page.getByTestId('advisor-send').click()
  await page.waitForTimeout(300)
  check(`${width} 직접 묻기: 가장 가까운 질문(급여 · 배당)으로 답`, (await page.locator('[data-testid="advisor-answer"][data-q="salary"]').count()) === 1)
  await page.getByTestId('advisor-input').fill('오늘 날씨 어때')
  await page.getByTestId('advisor-send').click()
  await page.waitForTimeout(300)
  const sug = page.getByTestId('advisor-suggest').last()
  check(`${width} 정해 둔 답이 없으면: 비슷한 질문 · AI 자리`, (await sug.locator('button').count()) > 0 && (await page.getByTestId('advisor').getByTestId('ai-soon').count()) === 1)
  await sug.locator('button').first().click()
  await page.waitForTimeout(300)
  check(`${width} 비슷한 질문 누르면 바로 답`, (await page.getByTestId('advisor-answer').count()) === 4)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('advisor').waitFor({ timeout: 15000 })
  check(`${width} 다시 열어도 대화가 남음(이 업체)`, (await page.getByTestId('advisor-question').count()) === 4)
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(`${width} 상담 가로 넘침 0`, over <= 1, String(over))
  await page.getByTestId('advisor-clear').click()
  check(`${width} 대화 지우기`, (await page.getByTestId('advisor-question').count()) === 0)
  check(`${width} 상담 오류 0`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-154 성과 보고서 한 장 ---------------- */
for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const year = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 4)
  await page.evaluate((y) => {
    const list = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    const c = list.find((x) => x.id === 'cli_hansol')
    c.fundingApplications = [{ id: 'rp1', programName: '수출바우처', institution: 'KOTRA', status: 'selected', applyDueDate: '', submittedAt: `${y}-03-02`, resultAt: `${y}-04-10`, requestedAmount: null, approvedAmount: 30000000, executedAmount: 30000000, executedAt: `${y}-05-20`, note: '내부 메모 보이면 안 됨', createdAt: `${y}-03-01T00:00:00Z`, updatedAt: `${y}-03-01T00:00:00Z` }]
    c.notes_list = [{ id: 'nn', text: '비밀 메모 보이면 안 됨', pinned: false, createdAt: `${y}-01-01T00:00:00Z`, updatedAt: `${y}-01-01T00:00:00Z` }]
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(list))
  }, year)
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '더보기' }).first().click()
  await page.getByTestId('more-report').click()
  await page.getByTestId('report-preview').waitFor()
  const prev = await page.getByTestId('report-preview').innerText()
  const tile = await page.getByTestId('report-preview').getByTestId('report-tile-확보한 자금').innerText()
  check(`${width} 성과 보고서: 업체 · 머리 숫자 3,000만원 · 한 사업 한 줄(선정 → 입금 30,000,000원)`, prev.includes('한솔테크') && tile.trim() === '3,000만원' && prev.includes('30,000,000원') && /선정 \d+\/\d+ → 입금/.test(prev) && (prev.match(/수출바우처/g) ?? []).length === 1, `${tile} | ${prev.slice(0, 300)}`)
  check(`${width} 성과 보고서: 수수료 · 메모 · 영업자 없음`, !/보이면 안 됨|성공보수|수수료|영업자/.test(prev))
  await page.getByTestId('report-period-contract').click()
  await page.waitForTimeout(200)
  check(`${width} 기간 바꾸기: 계약 뒤 전체`, (await page.getByTestId('report-preview').innerText()).includes('계약 뒤 전체 함께 만든 성과'))
  await page.getByTestId('report-kakao').click()
  await page.waitForTimeout(300)
  const k = await page.evaluate(() => navigator.clipboard.readText())
  check(`${width} 카톡 요약: 확보한 자금 3,000만원`, k.includes('확보한 자금(입금): 3,000만원') && !k.includes('보이면 안 됨'), k)
  // 인쇄 모양: 인쇄용 종이만 보이고 내용이 같다
  await page.emulateMedia({ media: 'print' })
  const printVisible = await page.getByTestId('report-print').isVisible()
  const printText = await page.getByTestId('report-print').innerText()
  await page.emulateMedia({ media: 'screen' })
  check(`${width} 인쇄: 보고서 종이가 찍힘 · 같은 금액`, printVisible && printText.includes('30,000,000원'), printText.slice(0, 120))
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(`${width} 성과 보고서 가로 넘침 0 · 오류 0`, over <= 1 && errors.length === 0, `${over} ${errors.join(' | ')}`)
  await ctx.close()
}

await browser.close()
console.log(`\n업체 상세: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
