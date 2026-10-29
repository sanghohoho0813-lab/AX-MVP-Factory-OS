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
  await page.getByTestId('top-picks').waitFor({ timeout: 5000 }).catch(() => {})
  check('개요: 처음 열면 개요 · 맨 위 "먼저 제안할 것"(D-190) 바로 아래 회사 정보(D-144)', (await page.getByRole('tab', { name: /^개요/, selected: true }).count()) === 1 && (await page.evaluate(() => { const c = document.querySelector('[data-testid="overview-company"]'); const t = document.querySelector('[data-testid="top-picks"]'); return !!c && !!t && t.getBoundingClientRect().top < c.getBoundingClientRect().top && c.getBoundingClientRect().top < 900 })))
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
  // D-302 서류만으로 통합고용세액공제 — 명부 날짜로 작년 · 올해 매월 말 인원(고용보험 없는 김영희는 뺌) → 금액이 맞춤 추천에
  const empTr = (r.toolResults ?? []).find((t) => t.toolKey === 'employment' && t.title === '4대보험 명부 진단')
  const hcd = empTr?.data?.headcount
  check('D-302 명부: 작년 · 올해 매월 말 인원이 결과에 붙음(고용보험 없는 1명 뺌 · 지금 직원만 있는 명부)', !!hcd && hcd.counted === 1 && hcd.excluded.noEi === 1 && hcd.basis === 'current' && hcd.cur.total > hcd.prev.total, JSON.stringify(hcd))
  const empCard = (await page.locator('[data-testid="smart-insight"][data-key="employment"]').evaluate((el) => el.textContent ?? '').catch(() => '')) ?? ''
  check('D-302 · D-330 맞춤 추천 고용지원금: 세액공제 금액(2026 개편이면 1년 차 · 3년) · 명부 날짜로 셈 · 작년 퇴사자 주의', /세액공제 (1년 차 )?약 [\d,.]+(만원|억원)/.test(empCard) && empCard.includes('명부 날짜로 셈') && empCard.includes('작년에 그만둔 사람'), empCard.slice(0, 400))
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

/* ---------------- D-266 압축(.zip) 하나에 한글(.hwp · .hwpx) · 워드(.docx) — 대충 올려도 알아서 ---------------- */
{
  const { makeHwp, makeHwpx, makeDocx, makeZip, CP949 } = await import(new URL('./fixtures/office.mjs', import.meta.url).href)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const rec = () => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_mirae'))
  // 이름으로는 무엇인지 모르는 파일들 — 글을 읽어야 칸을 안다
  const BIZ = makeHwp({ lines: ['사 업 자 등 록 증', '(법인사업자)'], rows: [['등록번호', '124-81-00998'], ['법인명(단체명)', '미래바이오랩'], ['대표자', '이대표'], ['개업연월일', '2023 년 01 월 10 일'], ['사업장 소재지', '경기도 파주시 탄현면 평화로 3']] })
  const SHARE = makeHwpx({ lines: ['주주명부', '회사명 : 미래바이오랩'], rows: [['성명', '주식 수', '지분율'], ['이대표', '6,000', '60%'], ['이배우', '4,000', '40%']] })
  const ARTICLES = makeDocx({ lines: ['정 관', '제1장 총칙', '제1조(상호) 이 회사는 주식회사 미래바이오랩이라 한다.'] })
  const zip = makeZip([
    { name: '서류모음/', data: '' },
    { name: new Uint8Array(CP949['서류모음/스캔0003.hwp']), data: BIZ, deflate: true },
    { name: '서류모음/파일2.hwpx', data: SHARE, utf8: true },
    { name: '서류모음/받은 파일.docx', data: ARTICLES, utf8: true, deflate: true },
    { name: '__MACOSX/서류모음/._파일2.hwpx', data: 'mac', utf8: true },
  ])
  await page.goto(BASE + '/ops/clients/cli_mirae', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([{ name: '미래바이오랩 서류.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) }])
  const toast = await page.getByText(/미래바이오랩 서류\.zip 에서 서류 3개를 꺼냈어요/).first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false)
  check('Z1 압축 하나 → "서류 3개를 꺼냈어요"(맥 찌꺼기 파일 빼고)', toast)
  await page.getByTestId('smart-placed').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  const placed = (await page.getByTestId('smart-placed').innerText()) ?? ''
  const r = await rec()
  const labelOf = (x, key) => (x.customDocuments ?? []).find((d) => d.key === key)?.label ?? key
  const filed = Object.entries(r.documents).filter(([, d]) => d.fileName).map(([k, d]) => `${labelOf(r, k)}=${d.fileName}`)
  check('Z2 이름이 "스캔0003.hwp" 여도 한글 글을 읽어 사업자등록증 칸 · CP949 한글 이름 그대로', filed.includes('businessRegistration=스캔0003.hwp'), filed.join(' | '))
  check('Z3 "파일2.hwpx" → 주주명부 칸 · "받은 파일.docx" → 정관 칸(글 제목으로)', filed.includes('주주명부=파일2.hwpx') && filed.includes('정관=받은 파일.docx'), filed.join(' | '))
  check('Z4 서류함 3개 · 확인 필요 0(전부 글로 확실)', /서류함에 넣은 곳 3개/.test(placed) && !/확인 필요 [1-9]/.test(placed), placed.slice(0, 300))
  check('Z5 한글 표에서 바로 입력 — 사업자번호 · 설립일 · 주소', r.businessNumber.replace(/\D/g, '') === '1248100998' && r.establishedAt === '2023-01-10' && r.businessAddress.includes('파주시'), JSON.stringify({ b: r.businessNumber, e: r.establishedAt, a: r.businessAddress }))
  check('Z6 폴더 이름 남김 — "압축 이름/안의 폴더"', r.documents.businessRegistration?.folderPath === '미래바이오랩 서류/서류모음', r.documents.businessRegistration?.folderPath)
  await page.keyboard.press('Escape').catch(() => {})
  // 서류 탭 '한꺼번에 올리기' — 암호 걸린 한글 문서는 까닭을 보여 주고 이름으로 칸을 정한다
  await page.goto(BASE + '/ops/clients/cli_mirae?tab=docs', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: '한꺼번에 올리기' }).first().click()
  const LOCKED = makeHwp({ lines: ['비밀'], flags: 3 })
  await page.getByLabel('서류 파일 고르기').setInputFiles([{ name: '용역계약서.hwp', mimeType: 'application/x-hwp', buffer: Buffer.from(LOCKED) }, { name: '묶음.zip', mimeType: 'application/zip', buffer: Buffer.from(makeZip([{ name: '정관.docx', data: ARTICLES, utf8: true }])) }])
  await page.getByLabel('용역계약서.hwp 칸 고르기').waitFor({ timeout: 15000 })
  await page.getByLabel('정관.docx 칸 고르기').waitFor({ timeout: 15000 })
  await page.waitForTimeout(300)
  const notes = await page.getByTestId('bulk-item-from').allInnerTexts()
  check('Z7 암호 걸린 한글 문서 → "암호 … 파일 이름으로 칸을 정했어요"(멈추지 않음)', notes.some((t) => t.includes('암호') && t.includes('파일 이름으로')), notes)
  check('Z8 압축에서 꺼낸 파일 줄에 "묶음.zip 안에서 꺼냄" · 위에 압축 알림 한 줄', notes.some((t) => t.includes('묶음.zip 안에서 꺼냄')) && ((await page.getByTestId('bulk-archive-note').innerText().catch(() => '')) ?? '').includes('묶음.zip 에서 서류 1개를 꺼냈어요'), notes)
  const hint = (await page.getByRole('dialog').innerText()) ?? ''
  check('Z9 안내 글 — 한글 · 워드는 내용을 읽고 압축은 풀어서', hint.includes('한글(hwp · hwpx)') && hint.includes('압축(zip)은 풀어서'))
  if (process.env.D266_SHOTS) await page.screenshot({ path: `${process.env.D266_SHOTS}/bulk-zip-hwp.png` })
  await page.getByTestId('bulk-discard').click().catch(() => {})
  // 새 업체 등록 창 — 압축 안 한글 사업자등록증만 넣어도 업체명 · 대표자 · 사업자번호가 채워진다
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.getByTestId('clients-add').click()
  const NEWBIZ = makeHwp({ lines: ['사업자등록증', '(법인사업자)'], rows: [['등록번호', '305-88-12340'], ['법인명(단체명)', '새봄바이오랩'], ['대표자', '박새봄'], ['개업연월일', '2024 년 05 월 20 일']] })
  await page.getByLabel('등록할 업체 서류 고르기').setInputFiles([{ name: '새봄 서류.zip', mimeType: 'application/zip', buffer: Buffer.from(makeZip([{ name: '새봄/스캔.hwp', data: NEWBIZ, utf8: true, deflate: true }])) }])
  await page.getByTestId('new-client-from-doc-companyName').waitFor({ timeout: 20000 }).catch(() => {})
  await page.waitForFunction(() => !document.querySelector('[data-testid="new-client-docs-reading"]'), null, { timeout: 20000 }).catch(() => {})
  const val = (label) => page.locator('form').getByLabel(label, { exact: false }).first().inputValue()
  const got = { name: await page.locator('form input[required]').first().inputValue(), ceo: await val('대표자·담당자'), biz: await val('사업자등록번호') }
  const docList = (await page.getByTestId('new-client-docs-list').innerText().catch(() => '')) ?? ''
  check('Z10 새 업체 등록 창 — 압축 안 한글 사업자등록증만으로 업체명 · 대표자 · 사업자번호 · "새봄 서류.zip 안에서 꺼냄"', got.name === '새봄바이오랩' && got.ceo === '박새봄' && got.biz === '305-88-12340' && docList.includes('스캔.hwp') && docList.includes('새봄 서류.zip 안에서 꺼냄'), { got, docList })
  await page.screenshot({ path: process.env.D266_SHOTS ? `${process.env.D266_SHOTS}/new-client-zip.png` : '/tmp/claude-0/d266-new-client.png' })
  await page.getByRole('button', { name: '취소' }).click().catch(() => {})
  check('D-266 오류 0', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-301 옛 워드(.doc) · 옛 엑셀(.xls) — 대충 올려도 알아서(예전엔 이름으로만) ---------------- */
{
  const { makeDoc, makeXls } = await import(new URL('./fixtures/office.mjs', import.meta.url).href)
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const rec = () => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_mirae'))
  const BIZ = makeDoc({ lines: ['사 업 자 등 록 증', '(법인사업자)'], rows: [['등록번호', '124-81-00998'], ['법인명(단체명)', '미래바이오랩'], ['대표자', '이대표'], ['개업연월일', '2023 년 01 월 10 일'], ['사업장 소재지', '경기도 파주시 탄현면 평화로 3']], after: ['2023년 01월 12일'] })
  const ROSTER = makeXls({ name: '가입자명부', rows: [['사업장 가입자 명부'], ['사업장명', '미래바이오랩'], [], ['연번', '성명', '주민등록번호', '자격취득일'], [1, '김청년', '000301-3123456', '2026-03-02'], [2, '이선배', '850501-1234567', '2024-05-01']] })
  await page.goto(BASE + '/ops/clients/cli_mirae', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([
    { name: '스캔_0042.doc', mimeType: 'application/msword', buffer: Buffer.from(BIZ) },
    { name: '파일3.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from(ROSTER) },
  ])
  await page.getByTestId('smart-placed').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  const placed = (await page.getByTestId('smart-placed').innerText()) ?? ''
  const r = await rec()
  const filed = Object.entries(r.documents).filter(([, d]) => d.fileName).map(([k, d]) => `${k}=${d.fileName}`)
  check('L1 이름이 "스캔_0042.doc" 여도 옛 워드 글을 읽어 사업자등록증 칸 · "파일3.xls" → 4대보험 가입자 명부 칸', filed.includes('businessRegistration=스캔_0042.doc') && filed.includes('payrollRoster=파일3.xls'), filed.join(' | '))
  check('L2 확인 필요 0(전부 글로 확실)', /서류함에 넣은 곳 2개/.test(placed) && !/확인 필요 [1-9]/.test(placed), placed.slice(0, 300))
  check('L3 옛 워드 표에서 바로 입력 — 사업자번호 · 설립일 · 주소', r.businessNumber.replace(/\D/g, '') === '1248100998' && r.establishedAt === '2023-01-10' && r.businessAddress.includes('파주시'), JSON.stringify({ b: r.businessNumber, e: r.establishedAt, a: r.businessAddress }))
  check('L4 옛 엑셀 명부로 고용지원금 명부 진단이 저절로 붙음 · 주민번호 원본은 기록에 0', (r.toolResults ?? []).some((t) => t.toolKey === 'employment' && t.title === '4대보험 명부 진단') && !JSON.stringify(r).includes('000301-3123456') && !JSON.stringify(r).includes('850501-1234567'))
  if (process.env.D301_SHOTS) await page.screenshot({ path: `${process.env.D301_SHOTS}/old-doc-upload.png` })
  check('D-301 오류 0', errors.length === 0, errors.join(' | '))
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

  // D-181: 인증서에 찍힌 유효기간 끝 → 서류함 만료(발급일 + 개월이 아니라) · 발급일은 유효기간 끝이 아니라 시작
  const VENT = txt('벤처확인서.txt', ['벤처기업확인서', '기업명 : 미래바이오랩', '확인번호 : 20240501-01', '유효기간 : 2024.05.01 ~ 2027.04.30'])
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([VENT])
  await page.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_mirae')?.documents ?? {}).some((d) => d.fileName === '벤처확인서.txt'), null, { timeout: 20000 })
  await page.waitForTimeout(600)
  const rv = await rec()
  const [ventKey, ventDoc] = Object.entries(rv.documents).find(([, d]) => d.fileName === '벤처확인서.txt') ?? []
  check(`유효기간(D-181): 벤처기업확인서 → 서류함에 찍힌 끝 2027-04-30 · 발급일 2024-05-01 ${tag}`, ventDoc?.validUntil === '2027-04-30' && ventDoc?.issuedAt === '2024-05-01', JSON.stringify(ventDoc))
  await page.goto(BASE + '/ops/clients/cli_mirae?tab=docs', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const ventExpiry = (await page.getByTestId(`doc-compact-expiry-${ventKey}`).innerText().catch(() => '')) ?? ''
  check(`유효기간(D-181): 서류 탭에 '2027-04-30까지 유효 · 서류에 적힌 날짜' ${tag}`, /2027-04-30까지 유효/.test(ventExpiry) && /서류에 적힌 날짜/.test(ventExpiry), ventExpiry)
  await page.goto(BASE + '/ops/clients/cli_mirae', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

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

  // D-157: 읽는 중에 바깥을 눌러도 · 창을 닫아도 뒤에서 계속 올린다(40% 하다 바깥 한 번에 없던 일이 됐다 — 대표)
  const PDF = (await import('node:fs')).readFileSync('e2e/fixtures/cretop-sample.pdf')
  const few = Array.from({ length: 12 }, (_, i) => ({ name: `보고서${i + 1}.pdf`, mimeType: 'application/pdf', buffer: PDF }))
  const before = filed(await rec()).length
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles(few)
  await page.getByTestId('bulk-stop').waitFor({ timeout: 10000 })
  await page.getByTestId('modal-backdrop').click({ position: { x: 5, y: 5 } })
  await page.waitForTimeout(300)
  check(`읽는 중 바깥 누름: 창이 그대로 ${tag}`, (await page.getByRole('dialog').count()) === 1)
  await page.getByTestId('bulk-close').click()
  check(`창 닫기: 창은 숨고 화면 위에 '서류 … 중' 표시 ${tag}`, (await page.getByRole('dialog').count()) === 0 && (await page.getByTestId('bulk-minimized').isVisible()))
  await page.getByTestId('bulk-minimized').click({ timeout: 3000 })
  check(`표시를 누르면 창이 다시(하던 것 그대로 12개) ${tag}`, (await page.getByRole('dialog').count()) === 1 && (await page.getByTestId('bulk-item').count()) === 12)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  for (let i = 0; i < 60 && (await page.getByTestId('bulk-minimized').count()); i++) await page.waitForTimeout(500)
  const after = filed(await rec()).length
  check(`닫아도 끝까지: 12개 모두 서류함에 · 표시 사라짐 ${tag}`, after === before + 12 && (await page.getByTestId('bulk-minimized').count()) === 0, `${before} → ${after}`)
  // 일부러 [읽기 멈추기] 를 누른 때만 멈춘다
  const before2 = filed(await rec()).length
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles(few.map((f, i) => ({ ...f, name: `멈춤${i + 1}.pdf` })))
  await page.getByTestId('bulk-stop').waitFor({ timeout: 10000 })
  await page.getByTestId('bulk-stop').click()
  await page.waitForTimeout(5000)
  check(`[읽기 멈추기]: 하나도 올리지 않음 ${tag}`, filed(await rec()).length === before2 && (await page.getByRole('dialog').count()) === 0)

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
  // 직접 만든 칸 — 곧 만료(법인인감증명서 3개월 · 오늘 기준 3개월 전 + 10일에 발급 → 10일 뒤 만료, 오늘 화면은 14일 안) · 이미 만료(납세증명서 1개월 · 40일 전 발급)
  // D-181: 예전에는 날짜를 '2026-07-10' 으로 박아 두어 10-10 이 지나자 '다가오는' 이 아니게 되어 떨어졌다 — 오늘 기준으로 계산한다
  await page.evaluate(() => {
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const seal = new Date()
    seal.setDate(seal.getDate() + 10)
    seal.setMonth(seal.getMonth() - 3)
    const tax = new Date()
    tax.setDate(tax.getDate() - 40)
    const all = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    const x = all.find((r) => r.id === 'cli_mirae')
    x.documents = x.documents ?? {}
    x.customDocuments = [...(x.customDocuments ?? []), { id: 'cd_seal', key: 'customdoc_seal148', label: '법인인감증명서', validMonths: 3, sensitive: false }, { id: 'cd_tax', key: 'customdoc_tax148', label: '납세증명서', validMonths: 1, sensitive: false }]
    x.documents.customdoc_seal148 = { received: true, issuedAt: ymd(seal), fileName: '인감.pdf', fileSize: 10, storagePath: '', note: '', updatedAt: null }
    x.documents.customdoc_tax148 = { received: true, issuedAt: ymd(tax), fileName: '납세.pdf', fileSize: 10, storagePath: '', note: '', updatedAt: null }
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
  // D-166: 휴대폰은 머리 단추를 줄여 '서류 요청 문구' 가 더보기 안에 있다
  if (width < 640) {
    check(`휴대폰 머리에는 서류 요청 문구 단추가 숨는다 ${tag}`, (await page.getByRole('button', { name: '서류 요청 문구', exact: true }).filter({ visible: true }).count()) === 0)
    await page.locator('main').getByRole('button', { name: '더보기', exact: true }).first().click()
    await page.getByTestId('more-doc-request').click()
  } else await page.getByRole('button', { name: '서류 요청 문구' }).first().click()
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
  await page.getByTestId('bulk-discard').click()
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
  check(`${width} 정해 둔 답이 없으면: 비슷한 질문 · [AI에게 묻기](D-239 실제 AI)`, (await sug.locator('button').count()) > 0 && (await page.getByTestId('advisor').getByTestId('ai-assist-open').count()) === 1)
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
  // D-157: 업체 홈 더보기에도 '서류 한꺼번에 올리기'
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '더보기' }).first().click()
  await page.getByTestId('more-upload').click()
  await page.waitForTimeout(300)
  check(`${width} 더보기 → 서류 한꺼번에 올리기 창`, (await page.getByRole('dialog').filter({ hasText: '서류 한꺼번에 올리기' }).count()) === 1)
  await page.getByTestId('bulk-close').click()
  await page.waitForTimeout(200)
  check(`${width} 아무것도 안 넣고 닫으면 그냥 닫힘(표시 없음)`, (await page.getByTestId('bulk-minimized').count()) === 0 && (await page.getByRole('dialog').count()) === 0)
  await ctx.close()
}

/* ---------------- D-183 '확인할 것' 한 곳 — 올리기 기록 · 바로 넣은 값 · 기타 칸 · 겹친 서류 ---------------- */
for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const tag = `(${width})`
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const rec = () => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_mirae'))
  const txt = (name, lines) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(lines.join('\n'), 'utf8') })
  const BIZ = txt('사업자등록증.txt', ['사 업 자 등 록 증', '(법인사업자)', '등록번호 : 124-81-00998', '법인명(단체명) : 미래바이오랩', '대 표 자 : 이미래', '개업연월일 : 2023 년 01 월 10 일', '사업장 소재지 : 경기도 파주시 문발로 1'])
  const MEMO = txt('메모_0921.txt', ['회의 메모 — 다음 주 화요일 다시 연락'])
  const BIZ_OLD = txt('사업자등록증_예전.txt', ['사업자등록증', '(법인사업자)', '등록번호 : 124-81-00998', '법인명(단체명) : 미래바이오랩'])

  await page.goto(BASE + '/ops/clients/cli_mirae', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([BIZ, MEMO, BIZ_OLD])
  await page.getByTestId('smart-placed').waitFor({ timeout: 20000 })
  await page.waitForTimeout(700)
  const r = await rec()
  const log = (r.docUploads ?? [])[0]
  check(`D-183 올리기 기록이 업체에 남음 — 파일 3 · 넣은 곳 3 · 바로 넣은 값(사업자번호 · 설립일) ${tag}`, !!log && log.files === 3 && log.placed.length === 3 && log.entered.some((e) => e.key === 'businessNumber' && e.value.replace(/\D/g, '') === '1248100998') && log.entered.some((e) => e.key === 'establishedAt'), JSON.stringify(log).slice(0, 300))
  check(`D-183 올리기 기록에 파일 글자는 없음 ${tag}`, !JSON.stringify(r.docUploads).includes('회의 메모'))
  await page.keyboard.press('Escape')
  await page.reload({ waitUntil: 'networkidle' })
  await page.goto(BASE + '/ops/clients/cli_mirae?tab=smart', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const sb = page.getByTestId('smart-batch')
  check(`D-183 새로고침해도 맞춤 추천에 '지난번에 올린 서류 3개' ${tag}`, (await sb.count()) === 1 && (await sb.getAttribute('data-fresh')) === '0' && (await sb.innerText()).includes('지난번에 올린 서류 3개'), (await sb.innerText().catch(() => '')).slice(0, 120))
  // D-212: 못 올린 파일이 있던 올리기 — 창을 닫고 새로고침해도 맞춤 추천에 남고 [다시 올리기] 로 바로 올리기 창
  await page.evaluate(() => {
    const all = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    const r = all.find((x) => x.id === 'cli_mirae')
    r.docUploads[0].failed = [{ fileName: '2026년_법인등기부등본_최종본_스캔_아주아주긴파일이름_정말로긴이름.pdf', reason: '파일을 저장하지 못했습니다 — 잠시 뒤 다시 올려 주세요' }]
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(all))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const sf = page.getByTestId('smart-failed')
  const sfText = (await sf.innerText().catch(() => '')) ?? ''
  const sfW = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(`D-212 못 올린 파일 1개 — 맞춤 추천에 이름 · 까닭 · 넘침 0 ${tag}`, (await sf.count()) === 1 && (await sf.getAttribute('data-count')) === '1' && sfText.includes('못 올린 파일 1개') && sfText.includes('법인등기부등본') && sfText.includes('저장하지 못했습니다') && sfW <= 0, JSON.stringify({ sfText: sfText.slice(0, 160), sfW }))
  await page.getByTestId('smart-failed-retry').click()
  await page.waitForTimeout(400)
  check(`D-212 [다시 올리기] → 서류 올리기 창이 바로 열림 ${tag}`, (await page.getByLabel('서류 파일 고르기').count()) >= 1)
  await page.keyboard.press('Escape')

  // 확인할 것 — 새 종류 둘
  await page.goto(BASE + '/ops/decide', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  check(`D-183 확인할 것: '바로 넣은 값' · '서류함 정리' 종류 칩 ${tag}`, (await page.getByTestId('decide-kind-autofill').count()) === 1 && (await page.getByTestId('decide-kind-shelf').count()) === 1)
  await page.getByTestId('decide-kind-autofill').click()
  await page.waitForTimeout(300)
  const af = page.locator('[data-testid="decision"][data-kind="autofill"][data-client="cli_mirae"]').first()
  check(`D-183 바로 넣은 값: "서류에서 읽어 바로 넣은 값 N개 — 맞나요?" · 단추 '모두 맞아요' · '하나씩 다시 볼게요' ${tag}`, (await af.count()) === 1 && /바로 넣은 값 \d+개 — 맞나요/.test(await af.innerText()) && (await af.getByTestId('decision-yes').innerText()).includes('모두 맞아요') && (await af.getByTestId('decision-no').innerText()).includes('하나씩 다시 볼게요'))
  await af.getByTestId('decision-more').click()
  await page.waitForTimeout(200)
  const rows = (await af.getByTestId('decision-rows').innerText()) ?? ''
  check(`D-183 '자세히' → 넣은 값 하나하나(사업자번호 · 설립일 · 어느 파일) ${tag}`, rows.includes('124-81-00998') && rows.includes('2023-01-10') && rows.includes('사업자등록증.txt'), rows.slice(0, 200))
  await af.getByTestId('decision-no').click()
  await page.waitForTimeout(700)
  const r2 = await rec()
  check(`D-183 [하나씩 다시 볼게요] → 값을 비우고 '맞나요?' 로 하나씩 ${tag}`, r2.businessNumber === '' && r2.establishedAt === '' && ['businessNumber', 'establishedAt', 'representativeName', 'businessAddress'].every((k) => (r2.factInbox ?? []).some((c) => c.key === k && /다시 확인하기로 한 값/.test(c.note ?? ''))) && /확인할 정보/.test(await page.getByTestId('toast-stack').innerText()), JSON.stringify({ b: r2.businessNumber, e: r2.establishedAt }))
  await page.getByTestId('toast-stack').getByTestId('toast-action').first().click()
  await page.waitForTimeout(700)
  const r3 = await rec()
  check(`D-183 되돌리기 → 값 그대로 돌아옴 ${tag}`, r3.businessNumber.replace(/\D/g, '') === '1248100998' && r3.establishedAt === '2023-01-10', JSON.stringify({ b: r3.businessNumber, e: r3.establishedAt }))

  // 서류함 정리 — 기타 칸(이름으로 모름 → 고르기) · 겹친 사업자등록증(최신만)
  await page.getByTestId('decide-kind-shelf').click()
  await page.waitForTimeout(300)
  const shelfRows = page.locator('[data-testid="decision"][data-kind="shelf"][data-client="cli_mirae"]')
  const pick = shelfRows.filter({ hasText: '무슨 서류인가요' }).first()
  check(`D-183 기타 칸 '메모_0921.txt' — 무슨 서류인가요? · 고르기 전에는 옮기기 단추 꺼짐 ${tag}`, (await pick.count()) === 1 && (await pick.innerText()).includes('메모_0921.txt') && (await pick.getByTestId('decision-yes').isDisabled()))
  await pick.getByTestId('decision-choice').selectOption({ label: '법인등기부등본' })
  await pick.getByTestId('decision-yes').click()
  await page.waitForTimeout(700)
  const r4 = await rec()
  check(`D-183 고른 칸(법인등기부등본)으로 옮김 · 기타 칸 없어짐 ${tag}`, r4.documents.corporateRegistry?.fileName === '메모_0921.txt' && !(r4.customDocuments ?? []).some((c) => c.label.startsWith('기타')), JSON.stringify(r4.documents.corporateRegistry))
  const dup = shelfRows.filter({ hasText: '겹쳐 있어요' }).first()
  check(`D-183 겹친 사업자등록증 — 최신 것만 남길까요? ${tag}`, (await dup.count()) === 1 && /사업자등록증 2개가 겹쳐/.test(await dup.innerText()))
  await dup.getByTestId('decision-yes').click()
  await page.waitForTimeout(700)
  const r5 = await rec()
  const bizCells = Object.entries(r5.documents).filter(([, d]) => d.fileName && d.fileName.startsWith('사업자등록증'))
  check(`D-183 [최신 것만 남기기] → 사업자등록증 칸 하나 · (2) 칸 없어짐 ${tag}`, bizCells.length === 1 && bizCells[0][0] === 'businessRegistration' && !(r5.customDocuments ?? []).some((c) => /사업자등록증 \(\d\)/.test(c.label)), bizCells.map(([k, d]) => `${k}=${d.fileName}`).join())
  check(`D-183 서류함 정리 줄이 다 사라짐 · 가로 넘침 0 ${tag}`, (await shelfRows.count()) === 0 && (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0)
  check(`D-183 오류 0 ${tag}`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-187 새 업체 등록 창 — 서류만 넣어도 칸이 채워지고, 등록하면 서류함 · 분석까지 ---------------- */
for (const [w, h, tag] of [[1440, 900, 'PC'], [390, 844, '390']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const txt = (name, lines) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(lines.join('\n'), 'utf8') })
  const BIZ = txt('사업자등록증_새봄.txt', ['사업자등록증', '(법인사업자)', '등록번호 : 305-88-12340', '법인명(단체명) : 새봄바이오랩', '대표자 : 박새봄', '개업연월일 : 2024 년 05 월 20 일', '사업장 소재지 : 충청북도 청주시 흥덕구 오송생명로 5', '업태 : 제조업', '종목 : 진단 시약'])
  const ROSTER = txt('가입자명부_새봄.txt', ['4대보험 사업장 가입자 명부', '사업장명: 새봄바이오랩', '발급일시 2026.10.01', '성명 주민등록번호 국민연금 건강보험 산재보험 고용보험', '990412-1234567 정새봄', '2026-09-01 2026-09-01 2026-09-01 2026-09-01', '850707-2345678 한여름', '2025-03-01 2025-03-01 - -'])
  const MEMO = txt('통화메모.txt', ['다음 주 화요일 오후 2시 방문 — 정책자금 문의'])
  const all = () => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]'))
  const val = (label) => page.locator('form').getByLabel(label, { exact: false }).first().inputValue()
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth <= 0)

  // 1) 서류 셋(사업자등록증 · 명부 · 메모)을 넣으면 업체명 · 대표자 · 사업자번호가 채워진다
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.getByTestId('clients-add').click()
  check(`D-187 등록 창 맨 위에 '서류만 넣어도 칸이 채워집니다' ${tag}`, (await page.getByTestId('new-client-docs').count()) === 1 && (await page.getByTestId('new-client-docs').innerText()).includes('서류만 넣어도 칸이 채워집니다'))
  await page.getByLabel('등록할 업체 서류 고르기').setInputFiles([BIZ, ROSTER, MEMO])
  await page.getByTestId('new-client-from-doc-companyName').waitFor({ timeout: 20000 })
  await page.waitForFunction(() => !document.querySelector('[data-testid="new-client-docs-reading"]'), null, { timeout: 20000 })
  const name = await page.locator('form input[required]').first().inputValue()
  const ceo = await val('대표자·담당자')
  const biz = await val('사업자등록번호')
  check(`D-187 업체명 · 대표자 · 사업자번호가 서류로 채워짐 ${tag}`, name === '새봄바이오랩' && ceo === '박새봄' && biz === '305-88-12340', JSON.stringify({ name, ceo, biz }))
  check(`D-187 칸 밑에 '사업자등록증에서 채움' ${tag}`, ((await page.getByTestId('new-client-from-doc-companyName').innerText()) ?? '').includes('사업자등록증에서 채움'))
  check(`D-187 휴대폰번호는 서류로 채우지 않음 ${tag}`, (await val('휴대폰번호')) === '')
  const notes = await page.getByTestId('new-client-doc-note').allInnerTexts()
  check(`D-187 파일마다 무엇으로 읽었는지(사업자등록증 · 찾음 / 나머지는 서류함으로) ${tag}`, notes.length === 3 && /사업자등록증 — 업체명 · 대표자 · 사업자등록번호 찾음/.test(notes[0]) && notes.slice(1).every((n) => /서류함에 넣어요/.test(n)), notes.join(' | '))
  check(`D-187 등록 창 가로 넘침 0 ${tag}`, await noOverflow())
  if (tag === '390') await page.screenshot({ path: '/tmp/claude-0/d187-modal-390.png' })
  else await page.locator('form').screenshot({ path: '/tmp/claude-0/d187-modal-pc.png' })

  // 2) 등록하면 업체 상세에서 같은 파일을 서류함에 넣고 분석까지(다시 넣지 않아도)
  const before = (await all()).length
  await page.getByRole('button', { name: '등록하고 열기' }).click()
  await page.waitForURL(/\/ops\/clients\/[^/?]+/, { timeout: 15000 })
  await page.getByTestId('smart-placed').waitFor({ timeout: 25000 })
  await page.waitForTimeout(800)
  const list = await all()
  const made = list.find((r) => r.companyName === '새봄바이오랩')
  check(`D-187 업체 하나만 생김 ${tag}`, list.length === before + 1 && !!made, `${before} → ${list.length}`)
  const filed = made ? Object.values(made.documents).filter((d) => d.fileName).map((d) => d.fileName).sort() : []
  check(`D-187 넣은 서류 셋이 모두 서류함에(다시 고르지 않음) ${tag}`, JSON.stringify(filed) === JSON.stringify(['가입자명부_새봄.txt', '사업자등록증_새봄.txt', '통화메모.txt'].sort()), filed.join(', '))
  check(`D-187 등록 칸 값 그대로 · 서류에서 설립일 · 주소 · 대표자까지 ${tag}`, !!made && made.businessNumber === '305-88-12340' && made.contactName === '박새봄' && made.establishedAt === '2024-05-20' && made.businessAddress.includes('청주시'), JSON.stringify(made && { b: made.businessNumber, c: made.contactName, e: made.establishedAt, a: made.businessAddress }))
  check(`D-187 명부 진단(고용지원금)도 저절로 붙음 ${tag}`, !!made && (made.toolResults ?? []).some((t) => t.toolKey === 'employment'))
  check(`D-187 업체를 열면 맞춤 추천 탭(모듈 추천 먼저) ${tag}`, (await page.getByRole('tab', { name: /맞춤 추천/, selected: true }).count()) === 1)
  check(`D-187 등록하자마자 잠재고객 ${tag}`, !!made && made.status === 'waiting')
  // 새로 고쳐도 다시 올리지 않는다(넘긴 서류는 한 번만)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const again = (await all()).find((r) => r.id === made?.id)
  check(`D-187 새로 고쳐도 서류함이 늘지 않음 ${tag}`, !!again && Object.values(again.documents).filter((d) => d.fileName).length === 3 && (again.customDocuments ?? []).length === (made.customDocuments ?? []).length)
  if (tag === 'PC') await page.screenshot({ path: '/tmp/claude-0/d187-after-pc.png' })

  // 3) 크레탑 보고서만 넣어도 — 이름 · 대표자 · 사업자번호(검증 안 맞으면 알려 줌)
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.getByTestId('clients-add').click()
  const CRETOP = (await import('node:fs')).readFileSync(new URL('./fixtures/cretop-company.txt', import.meta.url), 'utf8')
  await page.getByLabel('등록할 업체 서류 고르기').setInputFiles([txt('크레탑_한빛정밀.txt', ['CRETOP 기업종합보고서', CRETOP, ...Array.from({ length: 12 }, (_, i) => `참고 ${i + 1}. 기업 개요 · 연혁 · 거래처 현황은 원문을 확인하세요.`)])])
  await page.getByTestId('new-client-from-doc-companyName').waitFor({ timeout: 25000 })
  await page.waitForFunction(() => !document.querySelector('[data-testid="new-client-docs-reading"]'), null, { timeout: 25000 })
  const cName = await page.locator('form input[required]').first().inputValue()
  // D-255 크레탑 견본의 번호(214-87-35291)는 국세청 검증 숫자가 안 맞는다 — 예전엔 그대로 채우고 작은 경고, 이제는 채우지 않고 후보 단추
  check(`D-187 크레탑만 넣어도 업체명 · 대표자 ${tag}`, cName.includes('한빛정밀') && (await val('대표자·담당자')) === '김한빛', JSON.stringify({ cName, c: await val('대표자·담당자') }))
  check(`D-187 크레탑 칸 밑에 '크레탑 보고서에서 채움' ${tag}`, ((await page.getByTestId('new-client-from-doc-companyName').innerText()) ?? '').includes('크레탑 보고서'))
  const bizChoices = page.getByTestId('new-client-choices-businessNumber')
  const picks = await bizChoices.getByTestId('new-client-choice').evaluateAll((els) => els.map((e) => e.textContent.trim()))
  const nts = (v) => {
    const d = v.replace(/\D/g, '').split('').map(Number)
    if (d.length !== 10) return false
    const w = [1, 3, 7, 1, 3, 7, 1, 3, 5]
    let sum = w.reduce((acc, k, i) => acc + d[i] * k, 0) + Math.floor((d[8] * 5) / 10)
    return (10 - (sum % 10)) % 10 === d[9]
  }
  check(`D-255 검증이 안 맞는 사업자번호 → 칸은 비워 두고 읽은 번호(214-87-35291) · 검증 맞는 후보 단추 ${picks.length}개 ${tag}`, (await val('사업자등록번호')) === '' && (await bizChoices.innerText()).includes('214-87-35291') && picks.length >= 1 && picks.every(nts), { picks, field: await val('사업자등록번호') })
  const want = picks.includes('214-87-35297') ? '214-87-35297' : picks[0]
  await bizChoices.getByTestId('new-client-choice').filter({ hasText: want }).first().click()
  await page.waitForTimeout(150)
  check(`D-255 후보를 누르면 그 번호로 채워짐 · 안내 사라짐 ${tag}`, (await val('사업자등록번호')) === want && (await page.getByTestId('new-client-choices-businessNumber').count()) === 0, await val('사업자등록번호'))
  // 취소하면 넣은 서류 · 서류로 채운 값은 버린다
  await page.getByRole('button', { name: '취소' }).click()
  await page.getByTestId('clients-add').click()
  check(`D-187 취소 뒤 다시 열면 서류 · 서류로 채운 값 없음 ${tag}`, (await page.locator('form input[required]').first().inputValue()) === '' && (await page.getByTestId('new-client-docs-list').count()) === 0)

  // 4) 사람이 먼저 적은 이름은 덮지 않는다 — '서류 값으로' 를 눌러야 바뀐다
  await page.locator('form input[required]').first().fill('봄바이오')
  await page.getByLabel('등록할 업체 서류 고르기').setInputFiles([{ ...BIZ, name: '사업자등록증_다시.txt' }])
  await page.getByTestId('new-client-differs-companyName').waitFor({ timeout: 20000 })
  check(`D-187 적어 둔 이름은 그대로 · '서류에는 새봄바이오랩' ${tag}`, (await page.locator('form input[required]').first().inputValue()) === '봄바이오' && ((await page.getByTestId('new-client-differs-companyName').innerText()) ?? '').includes('새봄바이오랩'))
  await page.getByTestId('new-client-differs-companyName').getByRole('button', { name: '서류 값으로' }).click()
  check(`D-187 [서류 값으로] → 새봄바이오랩 ${tag}`, (await page.locator('form input[required]').first().inputValue()) === '새봄바이오랩')
  // 같은 업체가 이미 있으면 — 그 업체 열기에 넣은 서류도 함께
  const dupe = page.getByTestId('new-client-dupe')
  check(`D-187 같은 업체 알림에 '넣은 서류 1개도 그 업체로' ${tag}`, (await dupe.count()) === 1 && ((await dupe.innerText()) ?? '').includes('넣은 서류 1개도 그 업체로'))
  // 서류 빼기 → 서류로 채운 값만 비움
  await page.getByRole('button', { name: '사업자등록증_다시.txt 빼기' }).click()
  await page.waitForTimeout(200)
  check(`D-187 서류를 빼면 서류로 채운 칸이 비워짐 ${tag}`, (await page.locator('form input[required]').first().inputValue()) === '' && (await val('사업자등록번호')) === '')
  await page.getByLabel('등록할 업체 서류 고르기').setInputFiles([{ ...BIZ, name: '사업자등록증_한번더.txt' }])
  await page.getByTestId('new-client-dupe').waitFor({ timeout: 20000 })
  await page.getByTestId('new-client-dupe').getByRole('link').click()
  await page.waitForURL(new RegExp(`/ops/clients/${made?.id}`), { timeout: 15000 })
  await page.getByTestId('smart-placed').waitFor({ timeout: 25000 })
  await page.waitForTimeout(600)
  const moved = (await all()).find((r) => r.id === made?.id)
  check(`D-187 '그 업체 열기' → 넣은 서류가 그 업체 서류함으로(업체는 새로 안 생김) ${tag}`, !!moved && Object.values(moved.documents).some((d) => d.fileName === '사업자등록증_한번더.txt') && (await all()).length === before + 1)
  check(`D-187 오류 0 ${tag}`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-190 먼저 제안할 것 — 업체 상세 맨 위 · 고객 관리 카드 추천 띠 · 추천 많은 순 ---------------- */
for (const [w, h, tag] of [[1440, 900, 'PC'], [390, 844, '390']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', ...(w < 500 ? { isMobile: true, hasTouch: true } : {}) })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())

  // 업체 상세 — 개요 맨 위
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  const top = page.getByTestId('top-picks')
  await top.waitFor({ timeout: 6000 })
  const picks = page.getByTestId('top-pick')
  const n = await picks.count()
  const tones = await picks.evaluateAll((els) => els.map((e) => e.getAttribute('data-tone')))
  check(`D-190 ${tag} 개요 맨 위 "이 업체에 먼저 제안할 것" — 1~3개 · 가능성 높음/검토해 볼 만함만`, n >= 1 && n <= 3 && tones.every((t) => t === 'good' || t === 'maybe') && (await top.innerText()).includes('이 업체에 먼저 제안할 것'), JSON.stringify(tones))
  check(`D-190 ${tag} 좋은 것 먼저(가능성 높음 → 검토해 볼 만함)`, tones.every((t, i) => i === 0 || !(t === 'good' && tones[i - 1] === 'maybe')))
  check(`D-190 ${tag} 'AI' 라고 부르지 않음`, !/AI/.test(await top.innerText()))
  check(`D-190 ${tag} 받으면 더 추천(빠진 서류) 칩`, (await page.getByTestId('top-picks-need').count()) === 1 && /명부|크레탑|주주명부|연구/.test(await page.getByTestId('top-picks-need').innerText()))
  check(`D-190 ${tag} 제안할 것이 있으면 카드 안 [서류 올리기]는 없음(머리줄과 겹치지 않게)`, (await page.getByTestId('top-picks-upload').count()) === 0)
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(`D-190 ${tag} 가로 넘침 0`, over <= 1, String(over))
  if (tag === '390') await page.screenshot({ path: '/tmp/claude-0/d190-detail-390.png' }).catch(() => {})

  // 맞춤 추천 탭으로 — 모든 판정
  await page.getByTestId('top-picks-all').click()
  // 맞춤 추천 탭은 따로 불러오는 화면이라 0.8~1.9초 걸린다(main · 이 판 같은 범위로 잼) — 고정 0.9초 대신 판정 목록이 뜰 때까지 기다린다
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="smart-insight"]').length >= 3, null, { timeout: 8000 }).catch(() => {})
  check(`D-190 ${tag} [모듈별 판정 n개] → 맞춤 추천 탭 · 판정 목록으로`, /tab=smart/.test(page.url()) && (await page.getByTestId('smart-insight').count()) >= 3, page.url())
  const firstSmart = await page.evaluate(() => document.querySelector('[data-testid="smart-tab"]')?.firstElementChild?.getAttribute('data-testid'))
  check(`D-190 ${tag} 맞춤 추천 탭도 맨 위가 "먼저 제안할 것"`, firstSmart === 'top-picks', String(firstSmart))
  const sameKeys = await page.evaluate(() => {
    const top = [...document.querySelectorAll('[data-testid="top-pick"]')].map((e) => e.getAttribute('data-key'))
    const good = [...document.querySelectorAll('[data-testid="smart-insight"]')].filter((e) => ['good', 'maybe'].includes(e.getAttribute('data-tone'))).map((e) => e.getAttribute('data-key')).slice(0, 3)
    return JSON.stringify(top) === JSON.stringify(good)
  })
  check(`D-190 ${tag} 맨 위 3개 = 아래 모듈별 판정의 좋은 것 3개(엔진 하나)`, sameKeys)

  // 누르면 그 모듈이 이 업체로
  const key = await picks.first().getAttribute('data-key')
  await picks.first().locator('a').click()
  await page.waitForURL(/\/(tools|grants)\//, { timeout: 8000 }).catch(() => {})
  check(`D-190 ${tag} 첫 제안(${key}) 누르면 그 모듈이 이 업체로 열림`, /client=cli_hansol/.test(page.url()) && /\/(tools|grants)/.test(page.url()), page.url())

  // 고객 관리 카드 — 추천 띠(휴대폰 접힌 카드에도) · 추천 많은 순
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const card = page.locator('[data-testid="client-card"][data-client-id="cli_hansol"]')
  const band = card.getByTestId('card-reco')
  check(`D-190 ${tag} 고객 관리 카드에 "추천" 띠 — ${tag === '390' ? '접힌 카드에서도 보임' : 'PC'}`, (await band.count()) === 1 && (await band.isVisible()) && /추천/.test(await band.innerText()), (await band.count()) ? await band.innerText() : 'none')
  check(`D-190 ${tag} 띠 칩은 많아야 3개(+n)`, (await band.locator('[data-reco], [data-testid="client-card-grants"]').count()) <= 3)
  const tg = page.getByTestId('client-filters-toggle')
  if ((await tg.count()) && (await tg.isVisible()) && (await tg.getAttribute('aria-expanded')) !== 'true') await tg.click()
  const sel = page.getByLabel('업체 정렬 기준')
  await sel.selectOption('reco')
  await page.waitForTimeout(700)
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="client-card"]')].map((c) => {
      const chips = [...c.querySelectorAll('[data-testid="card-reco"] [data-tone]')].map((x) => x.getAttribute('data-tone'))
      return chips.reduce((s, t) => s + (t === 'good' ? 2 : 1), 0)
    }),
  )
  check(`D-190 ${tag} '추천 많은 순' — 추천 점수 높은 업체가 위(띠 3개까지 보이는 점수 기준)`, order.length >= 2 && order.every((v, i) => i === 0 || v <= order[i - 1] || order[i - 1] >= 6), JSON.stringify(order))
  check(`D-190 ${tag} '추천 많은 순' 안내 문구`, /먼저 제안할 모듈/.test((await page.locator('main').innerText()) ?? ''))
  await sel.selectOption('active')
  check(`D-190 오류 0 ${tag}`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-191 추천에 금액(엔진이 계산한 것만) · 빠진 자료 → 요청 문구 ---------------- */
for (const [w, h, tag] of [[1440, 900, 'PC'], [390, 844, '390']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', ...(w < 500 ? { isMobile: true, hasTouch: true } : {}) })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())

  // 빠진 자료 → 요청 문구
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.getByTestId('top-picks').waitFor({ timeout: 6000 })
  const reqBtn = page.getByTestId('top-picks-request')
  check(`D-191 ${tag} '받으면 더 추천' 옆 [요청 문구] 단추`, (await reqBtn.count()) === 1 && (await reqBtn.isVisible()))
  await reqBtn.click()
  const ta = page.locator('[role="dialog"] textarea').first()
  await ta.waitFor({ timeout: 4000 })
  const text = await ta.inputValue()
  check(`D-191 ${tag} 요청 문구: 대표님 · 회사 이름 · 4대보험 명부(어디서 떼는지) · 무엇 확인용`, /^안녕하세요, .+ 대표님\./.test(text) && text.includes('한솔테크') && text.includes('4대보험 사업장 가입자 명부') && text.includes('4insure.or.kr') && /확인용/.test(text), text.slice(0, 300))
  check(`D-191 ${tag} 요청 문구: 크레탑은 빼고(저희가 조회) · 주민등록번호 요구 없음`, !text.includes('크레탑') && !/주민등록번호를 (보내|알려)/.test(text))
  check(`D-191 ${tag} 요청 문구 창 제목`, ((await page.locator('[role="dialog"]').first().innerText()) ?? '').includes('받을 자료 요청 문구'))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // 금액 — 명부 진단이 계산한 최대 지원금
  await page.evaluate(() => {
    const k = 'axmvp.v1.operations_clients'
    const list = JSON.parse(localStorage.getItem(k) ?? '[]')
    const r = list.find((x) => x.id === 'cli_hansol')
    r.toolResults = [...(r.toolResults ?? []), { id: 'tr-d191', toolKey: 'employment', title: '4대보험 명부 진단', verdict: 'candidates', verdictLabel: '후보 지원금 2건 · 확인 항목 1', summary: '[4대보험 명부 진단] 12명 중 재직 12명', data: { tab: 'roster', subsidyTotal: 14400000 }, deadlines: [], createdAt: new Date().toISOString(), publishedUpdateId: null }]
    localStorage.setItem(k, JSON.stringify(list))
  })
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.getByTestId('top-picks').waitFor({ timeout: 6000 })
  const emp = page.locator('[data-testid="top-pick"][data-key="employment"]')
  check(`D-191 ${tag} 명부 진단 뒤 고용지원금이 먼저 제안할 것에 · 금액 "최대 1,440만원 검토(1차 추정)"`, (await emp.count()) === 1 && /최대 1,440만원 검토\(1차 추정\)/.test(await emp.innerText()), (await emp.count()) ? await emp.innerText() : 'none')
  check(`D-191 ${tag} 금액은 계산한 모듈에만(정책자금 카드에는 금액 줄 없음)`, (await page.locator('[data-testid="top-pick"][data-key="policy-funding"] [data-testid="top-pick-amount"]').count()) === 0)
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  check(`D-191 ${tag} 맞춤 추천 탭 모듈별 판정에도 금액`, /최대 1,440만원/.test((await page.locator('[data-testid="smart-insight"][data-key="employment"]').innerText().catch(() => '')) ?? ''))
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(`D-191 ${tag} 가로 넘침 0`, over <= 1, String(over))
  check(`D-191 오류 0 ${tag}`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-209 서류 올리기 창 — 다른 탭으로 가도 남음 · 업체를 옮기면 새 화면 · 긴 파일 이름 · 폴더 보기 '확인 필요' ---------------- */
for (const [w, h, tag] of [[1440, 900, 'PC'], [390, 844, '390']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', ...(w < 500 ? { isMobile: true, hasTouch: true } : {}) })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=docs', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '한꺼번에 올리기' }).first().click()
  const LONG = '스캔_2026_10_16_사업장_현장_사진_모음_최종본_수정본_진짜최종_ABCDEFGHIJKLMNOPQRSTUVWXYZ.txt'
  await page.getByLabel('서류 파일 고르기').first().setInputFiles([{ name: LONG, mimeType: 'text/plain', buffer: Buffer.from('메모 — 무슨 서류인지 모름', 'utf8') }])
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="bulk-item"][data-status="ready"]').length === 1, null, { timeout: 15000 })
  const sheetOver = await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return d ? d.scrollWidth - d.clientWidth : -1 })
  check(`D-209 ${tag} 긴 파일 이름(밑줄로 이은 80자) — 올리기 창 가로 넘침 0`, sheetOver <= 1, String(sheetOver))
  // 창을 닫으면(고르던 것 있음) 숨기고 '올릴 서류' 알약 → 다른 탭으로 가도 알약 · 고르던 것 그대로
  await page.getByRole('dialog').getByRole('button', { name: '닫기' }).first().click()
  await page.getByTestId('bulk-minimized').waitFor()
  await page.getByRole('tab', { name: /^개요/ }).click()
  await page.waitForTimeout(400)
  const pillStays = (await page.getByTestId('bulk-minimized').count()) === 1
  await page.getByTestId('bulk-minimized').click().catch(() => {})
  await page.waitForTimeout(300)
  const kept = await page.locator('[data-testid="bulk-item"]').count()
  check(`D-209 ${tag} 한꺼번에 올리기 창을 숨기고 개요 탭으로 가도 → 알약 · 고르던 파일 그대로(예전: 사라짐)`, pillStays && kept === 1, JSON.stringify({ pillStays, kept }))
  await page.getByRole('dialog').getByRole('button', { name: /고른 것 전부 올리기/ }).click()
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="bulk-item"][data-status="done"]').length === 1, null, { timeout: 15000 })
  const doneOver = await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return d ? d.scrollWidth - d.clientWidth : 0 })
  check(`D-209 ${tag} 올린 뒤 '올림 · 기타 · 확인 필요 · 긴 이름' 배지도 넘침 0`, doneOver <= 1, String(doneOver))
  const r = await record(page)
  const up = Object.values(r.documents).find((d) => d?.fileName === LONG)
  check(`D-209 ${tag} 올린 파일에 올린 때(uploadedAt) 기록`, !!up?.uploadedAt, JSON.stringify(up))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // 폴더 보기 — 무슨 서류인지 모르는 파일은 '확인 필요' · 파일 창 제목(긴 이름) 넘침 0
  await page.getByRole('tab', { name: /^서류/ }).click()
  await page.getByTestId('doc-view-folder').click()
  await page.getByTestId('folder-grid').waitFor()
  const otherBadges = await page.getByTestId('folder-file-other').count()
  await page.locator('[data-testid="folder-file"]', { has: page.getByTestId('folder-file-other') }).first().click()
  await page.getByTestId('folder-file-sheet').waitFor()
  const sheetW = await page.evaluate(() => { const d = [...document.querySelectorAll('[role="dialog"]')].pop(); return d ? d.scrollWidth - d.clientWidth : -1 })
  const day = (await page.getByTestId('folder-file-sheet').innerText()).match(/올린 날\s*\n?\s*(\d{4}\.\d{2}\.\d{2})/)?.[1] ?? ''
  const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` })
  check(`D-209 ${tag} 폴더 보기 — 기타 칸 파일에 '확인 필요' · 파일 창(긴 제목) 넘침 0 · 올린 날 = 오늘(로컬)`, otherBadges >= 1 && sheetW <= 1 && day === today, JSON.stringify({ otherBadges, sheetW, day, today }))
  // D-212: 폴더 보기 파일 창에서 바로 '무슨 서류인가요?' — 목차 보기로 가지 않고 맞는 칸으로
  const kindSel = page.getByTestId('folder-file-sheet').locator('[data-testid^="doc-kind-"] select')
  const pickerShown = (await kindSel.count()) === 1
  let moved = false
  if (pickerShown) {
    const opt = await kindSel.locator('option').evaluateAll((os) => os.map((o) => o.value).find((v) => v && v !== '__type__'))
    if (opt) {
      await kindSel.selectOption(opt)
      await page.waitForTimeout(700)
      // 기타 표시가 하나 줄어든다(그 파일이 맞는 칸으로 갔다)
      moved = (await page.getByTestId('folder-file-other').count()) === otherBadges - 1
    }
  }
  check(`D-212 ${tag} 폴더 보기 파일 창에 '무슨 서류인가요?' · 고르면 기타 칸에서 빠짐 · 창 닫힘`, pickerShown && moved && (await page.getByTestId('folder-file-sheet').count()) === 0, JSON.stringify({ pickerShown, moved }))
  if (await page.getByTestId('folder-file-sheet').count()) await page.keyboard.press('Escape')
  await page.getByTestId('doc-view-list').click()
  // 업체를 옮기면 새 화면 — 열어 둔 창 · 고르던 칸이 다음 업체로 넘어가지 않는다
  await page.getByRole('button', { name: '한꺼번에 올리기' }).first().click()
  await page.getByRole('dialog').waitFor()
  const other = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((x) => x.id !== 'cli_hansol')?.id)
  await page.evaluate((id) => { history.pushState({}, '', `/ops/clients/${id}?tab=docs`); dispatchEvent(new PopStateEvent('popstate')) }, other)
  await page.waitForTimeout(900)
  const titles = await page.locator('[role="dialog"]').allInnerTexts()
  check(`D-209 ${tag} 다른 업체로 옮기면 앞 업체의 올리기 창이 따라오지 않음`, !!other && !titles.some((t) => t.includes('한솔테크(주) — 서류 한꺼번에 올리기')), JSON.stringify({ other, titles: titles.map((t) => t.slice(0, 40)) }))
  check(`D-209 ${tag} 오류 0`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-303 주주명부 올리기 → 주주표 · 총수 · 액면가 → 관계 모르는 주주는 골라 받기 → 절세 설계 ---------------- */
for (const vp of [{ tag: '1440', w: 1440, h: 900 }, { tag: '390', w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const T = '\t'
  const SH = {
    name: '주주명부_2026.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      [
        '주 주 명 부',
        '회사명: 한솔테크 주식회사 · 기준일: 2026년 3월 31일',
        '발행주식의 총수: 10,000주 / 1주의 금액: 5,000원',
        ['번호', '주주명', '주민등록번호', '주소', '주식수', '지분율', '비고'].join(T),
        ['1', '김대표', '750101-1234567', '부산광역시 해운대구 센텀로 77', '6,000', '60%', '대표이사'].join(T),
        ['2', '이배우', '780202-2345678', '부산광역시 해운대구 센텀로 77', '2,500', '25%', '배우자'].join(T),
        ['3', '박친구', '800303-1456789', '경기도 성남시 분당구 45', '1,500', '15%', ''].join(T),
        ['합계', '', '', '', '10,000', '100%', ''].join(T),
      ].join('\n'),
      'utf8',
    ),
  }
  const rec = () => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_hansol'))
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([SH])
  await page.getByTestId('smart-placed').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const r = await rec()
  check(`D-303 ${vp.tag} 주주명부 → 주주표 3명(대표 · 배우자 · 기타) · 총수 10,000 · 액면가 5,000`, (r.shareholderRegister ?? []).map((h) => `${h.name}:${h.shares}:${h.relation}`).join(',') === '김대표:6000:ceo,이배우:2500:spouse,박친구:1500:other' && r.taxProfile?.totalShares === '10000' && r.taxProfile?.par === '5000', JSON.stringify({ reg: r.shareholderRegister, tp: r.taxProfile }))
  check(`D-303 ${vp.tag} 주민번호 · 주주 주소는 기록에 0 · 4대보험 명부로 읽지 않음(직원 진단 안 붙음)`, !JSON.stringify(r).includes('1234567') && !JSON.stringify(r).includes('센텀로') && !(r.toolResults ?? []).some((t) => t.toolKey === 'employment' && t.createdAt > new Date(Date.now() - 600000).toISOString()))
  const entered = (await page.getByTestId('smart-entered').innerText().catch(() => '')) ?? ''
  check(`D-303 ${vp.tag} 맞춤 추천 '바로 넣은 정보' 에 주주명부 · 발행주식 총수 · 1주 액면가`, entered.includes('주주명부') && entered.includes('주주 3명') && entered.includes('발행주식 총수') && entered.includes('1주 액면가'), entered.slice(0, 300))
  // 확인할 것(맞춤 추천 안 '프로그램이 준비했어요') — 관계를 모르는 박친구
  const box = page.getByTestId('smart-decisions')
  if (!(await box.isVisible().catch(() => false))) await page.getByText('프로그램이 준비했어요', { exact: false }).first().click()
  await page.waitForTimeout(300)
  const q = page.locator('[data-testid="decision"]').filter({ hasText: '박친구' }).first()
  check(`D-303 ${vp.tag} 확인할 것: "주주 박친구 님은 대표와 어떤 관계인가요?" · 고르기 전에는 단추 꺼짐`, (await q.count()) === 1 && (await q.innerText()).includes('어떤 관계') && (await q.getByTestId('decision-yes').isDisabled()), (await q.innerText().catch(() => '')).slice(0, 200))
  await q.getByTestId('decision-choice').selectOption({ label: '자녀(성년)' })
  await q.getByTestId('decision-yes').click()
  await page.waitForTimeout(800)
  const r2 = await rec()
  check(`D-303 ${vp.tag} [이 관계로] → 박친구 = 자녀 · 질문 사라짐`, r2.shareholderRegister.find((h) => h.name === '박친구')?.relation === 'child' && (await page.locator('[data-testid="decision"]').filter({ hasText: '박친구' }).count()) === 0, JSON.stringify(r2.shareholderRegister))
  check(`D-303 ${vp.tag} 업체 상세 가로 넘침 0`, (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0)
  if (vp.tag === '1440') await page.getByTestId('smart-batch').screenshot({ path: '/tmp/claude-0/shot303-batch.png' }).catch(() => {})
  // 절세 설계 — 주주표가 그대로
  await page.goto(BASE + '/tools/tax?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const body = await page.locator('body').innerText()
  const vals = await page.locator('input').evaluateAll((els) => els.map((e) => e.value))
  check(`D-303 ${vp.tag} 절세 설계 주주명부에 세 사람 · 발행주식 총수`, ['김대표', '이배우', '박친구'].every((n) => vals.includes(n) || body.includes(n)) && (vals.some((v) => v.replace(/,/g, '') === '10000') || body.includes('10,000')), JSON.stringify(vals.filter(Boolean).slice(0, 20)))
  check(`D-303 ${vp.tag} 절세 설계 가로 넘침 0 · 오류 0`, (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0 && errors.length === 0, errors.join(' | '))
  if (vp.tag === '390') await page.screenshot({ path: '/tmp/claude-0/shot303-tax-390.png' }).catch(() => {})
  await ctx.close()
}

/* ---------------- D-304 등기부등본 · 임원퇴직금 규정 올리기 → 절세 현황(대표 취임일 · 액면가 · 총수 · 지급배수) ---------------- */
for (const vp of [{ tag: '1440', w: 1440, h: 900 }, { tag: '390', w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const REG = {
    name: '법인등기부등본.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(['등기사항전부증명서(말소사항 포함)', '상호 한솔테크 주식회사', '1주의 금액 금 5,000 원', '발행할 주식의 총수 100,000 주', '발행주식의 총수 20,000 주', '보통주식 20,000 주 금 100,000,000 원', '임원에 관한 사항', '대표이사 김대표 801231-1******', '2016 년 04 월 01 일 취임 2016 년 04 월 05 일 등기', '2019 년 04 월 01 일 중임 2019 년 04 월 03 일 등기', '회사성립연월일 2016 년 04 월 01 일'].join('\n'), 'utf8'),
  }
  const RULE = { name: '임원퇴직금지급규정.txt', mimeType: 'text/plain', buffer: Buffer.from(['임원퇴직금지급규정', '제3조 임원의 퇴직금 지급배수는 다음과 같다. 대표이사 3배, 이사 2배'].join('\n'), 'utf8') }
  const rec = () => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_hansol'))
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([REG, RULE])
  await page.getByTestId('smart-placed').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const r = await rec()
  check(`D-304 ${vp.tag} 등기부 → 대표 취임일 2016-04-01 · 액면가 5,000 · 총수 20,000 / 규정 → 지급배수 3`, r.taxProfile?.ceoStartDate === '2016-04-01' && r.taxProfile?.par === '5000' && r.taxProfile?.totalShares === '20000' && r.taxProfile?.retireMult === '3', JSON.stringify(r.taxProfile))
  const entered = (await page.getByTestId('smart-entered').innerText().catch(() => '')) ?? ''
  check(`D-304 ${vp.tag} 바로 넣은 정보: 대표 취임일(등기부 근거) · 액면가 · 총수 · 지급배수(세법 한도 2배로 계산)`, entered.includes('대표 취임일') && entered.includes('퇴직금 기산일(등기부') && entered.includes('1주 액면가') && entered.includes('발행주식 총수') && entered.includes('대표이사 3배') && entered.includes('세법 한도'), entered.slice(0, 400))
  check(`D-304 ${vp.tag} 주민번호는 기록에 0 · 업체 상세 넘침 0`, !JSON.stringify(r).includes('801231-1') && (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0)
  if (vp.tag === '1440') await page.getByTestId('smart-batch').screenshot({ path: '/tmp/claude-0/shot304-batch.png' }).catch(() => {})
  await page.goto(BASE + '/tools/tax?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const vals = await page.locator('input').evaluateAll((els) => els.map((e) => e.value))
  // 지급배수 칸은 '퇴직금 · 현금' 목표를 고를 때만 보인다 — 값은 위 업체 기록에서 확인했다
  check(`D-304 ${vp.tag} 절세 설계에 취임일 · 액면가 · 총수 그대로 · 오류 0`, vals.includes('2016-04-01') && vals.includes('5000') && vals.some((v) => v.replace(/,/g, '') === '20000') && errors.length === 0, JSON.stringify(vals.filter(Boolean).slice(0, 30)) + errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-305 재무제표 올리기 → 가지급금 잔액 · 배당 가능한 이익 · 직전 연도 순이익 → 맞춤 추천 '가지급금 해마다 손해' ---------------- */
for (const vp of [{ tag: '1440', w: 1440, h: 900 }, { tag: '390', w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const FS = {
    name: '표준재무제표증명_2025.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(['표준재무제표증명', '(단위 : 천원)', '제 9(당)기 2025년 12월 31일 현재', '재무상태표', '가지급금 80,000 60,000', '자산총계 3,200,000 2,900,000', '부채총계 1,100,000 1,000,000', '미처분이익잉여금 900,000 760,000', '손익계산서', 'Ⅰ. 매출액 5,400,000 4,800,000', 'Ⅹ. 당기순이익 150,000 120,000'].join('\n'), 'utf8'),
  }
  const rec = () => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_hansol'))
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([FS])
  await page.getByTestId('smart-placed').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const r = await rec()
  check(`D-305 ${vp.tag} 재무제표 → 가지급금 8천만 · 배당 가능한 이익 9억 · 직전 연도 순이익 1.2억`, r.taxProfile?.loanBalance === '80000000' && r.taxProfile?.retainedEarnings === '900000000' && r.taxProfile?.vInc1 === '120000000', JSON.stringify(r.taxProfile))
  const entered = (await page.getByTestId('smart-entered').innerText().catch(() => '')) ?? ''
  check(`D-305 ${vp.tag} 바로 넣은 정보: 가지급금 잔액 · 배당 가능한 이익 · 직전 연도 순이익(연도와 함께)`, entered.includes('가지급금') && entered.includes('2025년 말 8,000만원') && entered.includes('배당 가능 이익') && entered.includes('9억원') && entered.includes('2024년 1억 2,000만원'), entered.slice(0, 500))
  const tax = (await page.locator('[data-testid="smart-insight"][data-key="tax"]').evaluate((el) => el.textContent ?? '').catch(() => '')) ?? ''
  check(`D-305 ${vp.tag} 맞춤 추천 절세: 서류만으로 '가지급금 8,000만원 — 해마다 약 n만원 손해'`, tax.includes('가지급금 8,000만원') && /해마다 약 [\d,.]+(만원|억원) 손해/.test(tax), tax.slice(0, 300))
  check(`D-305 ${vp.tag} 넘침 0 · 오류 0`, (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0 && errors.length === 0, errors.join(' | '))
  if (vp.tag === '1440') {
    await page.getByTestId('smart-batch').screenshot({ path: '/tmp/claude-0/shot305-batch.png' }).catch(() => {})
    const picks = page.getByTestId('top-picks')
    if (await picks.count()) await picks.screenshot({ path: '/tmp/claude-0/shot305-picks.png' }).catch(() => {})
  }
  await ctx.close()
}

/* ---------------- D-306 납세증명서 · 지방세 납세증명서 · 4대보험 완납증명서 → 정책자금 판정 체납 '없음' ---------------- */
for (const vp of [{ tag: '1440', w: 1440, h: 900 }, { tag: '390', w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const doc = (name, lines) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(lines.join('\n'), 'utf8') })
  const NAT = doc('scan_101.txt', ['납세증명서', '(국세)', '납세자 : 한솔테크(주)', '위의 납세자는 국세 체납액이 없음을 증명합니다.'])
  const LOC = doc('scan_102.txt', ['지방세 납세증명서', '납세자 : 한솔테크(주)', '위 납세자는 지방세 체납액이 없음을 증명합니다.'])
  const INS = doc('scan_103.txt', ['4대보험 완납증명서', '사업장명 : 한솔테크(주)', '사회보험료 완납을 증명합니다.'])
  const pol = () => page.locator('[data-testid="smart-insight"][data-key="policy-funding"]').evaluate((el) => el.textContent ?? '').catch(() => '')
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  // '모듈별 판정' 은 접혀 있다(D-192) — 펼쳐서 본다
  if ((await page.locator('[data-testid="smart-insight"]').count()) === 0) await page.getByRole('button', { name: /모듈별 판정/ }).first().click()
  await page.waitForTimeout(400)
  const before = (await pol()) ?? ''
  check(`D-306 ${vp.tag} 서류 전: 정책자금 '있으면 더 정확: 체납 확인 — 국세 · 지방세 납세증명서 · 4대보험 완납증명서'`, before.includes('체납 확인 —') && before.includes('지방세 납세증명서'), before.slice(0, 300))
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([NAT, LOC, INS])
  await page.getByTestId('smart-placed').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  const placed = (await page.getByTestId('smart-placed').innerText().catch(() => '')) ?? ''
  check(`D-306 ${vp.tag} 스캔 이름이어도 세 칸으로(납세증명서 · 지방세 납세증명서 · 4대보험 완납증명서)`, ['→ 납세증명서', '→ 지방세 납세증명서', '→ 4대보험 완납증명서'].every((x) => placed.replace(/\s+/g, ' ').includes(x)), placed.slice(0, 300))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  const after = (await pol()) ?? ''
  check(`D-306 ${vp.tag} 서류 뒤: 정책자금에 '세금 체납 없음 · 4대보험 체납 없음' 근거 · 체납 확인 칩 사라짐`, after.includes('세금 체납 없음') && after.includes('4대보험 체납 없음') && !after.includes('체납 확인 —'), after.slice(0, 400))
  await page.goto(BASE + '/tools/policy-funding/diagnosis?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const note = (await page.getByTestId('tool-prefill-note').innerText().catch(() => '')) ?? ''
  check(`D-306 ${vp.tag} 정책자금 화면도 같은 근거로 채움(세금 · 4대보험 체납 없음)`, note.includes('세금 체납 없음(납세증명서)') && note.includes('4대보험 체납 없음(완납증명서)'), note.slice(0, 300))
  check(`D-306 ${vp.tag} 넘침 0 · 오류 0`, (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0 && errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-307 정책자금 가점(특허 · 연구소 · 벤처 · 이노비즈) — 업체 기록 → 맞춤 추천 · 정책자금 화면 ---------------- */
for (const vp of [{ tag: '1440', w: 1440, h: 900 }, { tag: '390', w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(() => {
    const all = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    const r = all.find((x) => x.id === 'cli_hansol')
    r.factValues = { ...(r.factValues ?? {}), certifications: '벤처기업, 이노비즈', patents: '특허 2건', researchLab: '기업부설연구소(2024 인정)', 'cf:여성기업': '확인일 2022-01-01 · 2025-01-01까지' }
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(all))
  })
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  if ((await page.locator('[data-testid="smart-insight"]').count()) === 0) await page.getByRole('button', { name: /모듈별 판정/ }).first().click()
  await page.waitForTimeout(400)
  const pol = (await page.locator('[data-testid="smart-insight"][data-key="policy-funding"]').evaluate((el) => el.textContent ?? '').catch(() => '')) ?? ''
  check(`D-307 ${vp.tag} 맞춤 추천 정책자금: "가점 특허, 연구소, 벤처기업, 이노비즈" · 만료된 여성기업은 따로 한 줄`, pol.includes('가점 특허, 연구소, 벤처기업, 이노비즈') && pol.includes('만료라 가점에서 뺀 인증: 여성기업(2025-01-01까지)') && !pol.includes('이노비즈 · 여성기업'), pol.slice(0, 500))
  if (vp.tag === '1440') await page.locator('[data-testid="smart-insight"][data-key="policy-funding"]').screenshot({ path: '/tmp/claude-0/shot307-card.png' }).catch(() => {})
  await page.goto(BASE + '/tools/policy-funding/diagnosis?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const note = (await page.getByTestId('tool-prefill-note').innerText().catch(() => '')) ?? ''
  check(`D-307 ${vp.tag} 정책자금 화면도 가점을 채움(특허 보유 · 기업부설연구소 보유 · 벤처기업 · 이노비즈)`, note.includes('가점(특허 보유 · 기업부설연구소 보유 · 벤처기업 · 이노비즈)'), note.slice(0, 300))
  check(`D-307 ${vp.tag} 넘침 0 · 오류 0`, (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0 && errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-310 4대보험 명부 → 정책자금 고용 증가 · 청년 고용(고용창출 자금) — 서류 올리기 한 번 ---------------- */
for (const vp of [{ tag: '1440', w: 1440, h: 900 }, { tag: '390', w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  // 작년엔 2명(2019 · 2024 입사) → 올해 2월 · 5월에 청년 2명 입사
  const ROSTER = {
    name: '사업장가입자명부_한솔.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      [
        '4대보험 사업장 가입자 명부',
        '사업장명: 한솔테크(주)',
        '발급일시 2026.10.20',
        '성명 주민등록번호 국민연금 건강보험 산재보험 고용보험',
        '800101-1234567 박민수',
        '2019-01-02 2019-01-02 2019-01-02 2019-01-02',
        '950505-2345678 이수진',
        '2024-03-01 2024-03-01 2024-03-01 2024-03-01',
        '980310-1234567 홍길동',
        '2026-02-02 2026-02-02 2026-02-02 2026-02-02',
        '010101-3234567 최하늘',
        '2026-05-04 2026-05-04 2026-05-04 2026-05-04',
      ].join('\n'),
      'utf8',
    ),
  }
  const pol = () => page.locator('[data-testid="smart-insight"][data-key="policy-funding"]').evaluate((el) => el.textContent ?? '').catch(() => '')
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  if ((await page.locator('[data-testid="smart-insight"]').count()) === 0) await page.getByRole('button', { name: /모듈별 판정/ }).first().click()
  await page.waitForTimeout(400)
  const before = (await pol()) ?? ''
  check(`D-310 ${vp.tag} 명부 전: 정책자금에 고용 증가 근거 없음`, before !== '' && !before.includes('고용 증가('), before.slice(0, 300))
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([ROSTER])
  await page.getByTestId('smart-placed').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  if ((await page.locator('[data-testid="smart-insight"]').count()) === 0) await page.getByRole('button', { name: /모듈별 판정/ }).first().click()
  await page.waitForTimeout(400)
  const after = (await pol()) ?? ''
  check(`D-310 ${vp.tag} 명부 뒤: 정책자금 '고용 증가(2025년 평균 2명 → 2026년 …) — 고용창출 자금 대상'`, /고용 증가\(2025년 평균 2명 → 2026년 (예상 )?[\d.]+명/.test(after) && after.includes('고용창출 자금 대상'), after.slice(0, 500))
  // 보고용 — 명부 전 · 뒤 판정 제목(추천 기관이 바뀌는지)
  console.log(`  D-310 ${vp.tag} 전: ${before.split('검토해 볼 만함').pop()?.split('체납')[0]?.trim().slice(0, 60)} / 뒤: ${after.split('검토해 볼 만함').pop()?.split('체납')[0]?.trim().slice(0, 60)}`)
  if (vp.tag === '1440') await page.locator('[data-testid="smart-insight"][data-key="policy-funding"]').screenshot({ path: '/tmp/claude-0/shot310-card.png' }).catch(() => {})
  if (vp.tag === '390') await page.locator('[data-testid="smart-insight"][data-key="policy-funding"]').screenshot({ path: '/tmp/claude-0/shot310-card-390.png' }).catch(() => {})
  await page.goto(BASE + '/tools/policy-funding/diagnosis?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const note = (await page.getByTestId('tool-prefill-note').innerText().catch(() => '')) ?? ''
  if (vp.tag === '390') await page.getByTestId('tool-prefill-note').screenshot({ path: '/tmp/claude-0/shot310-note-390.png' }).catch(() => {})
  check(`D-310 ${vp.tag} 정책자금 화면도 채움(강점 고용 증가 · 청년 고용 있음)`, note.includes('강점 고용 증가(4대보험 명부)') && note.includes('청년 고용 있음(4대보험 명부)'), note.slice(0, 400))
  check(`D-310 ${vp.tag} 넘침 0 · 오류 0`, (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0 && errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-311 부가세 과세표준증명 → 서류 칸 · 매출 · 정책자금 준비 서류(서류함으로 확보) ---------------- */
for (const vp of [{ tag: '1440', w: 1440, h: 900 }, { tag: '390', w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const VAT = {
    name: 'scan_201.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      [
        '부가가치세 과세표준증명',
        '상호(법인명) 한솔테크(주) 사업자등록번호 123-45-67890',
        '과세기간 2024년 01월 01일 ~ 2026년 06월 30일',
        '과세기간 신고구분 신고일 과세표준 납부할세액',
        '2024.01.01~2024.06.30 확정 2024.07.25 100,000,000 5,000,000',
        '2024.07.01~2024.12.31 확정 2025.01.24 140,000,000 7,000,000',
        '2025.01.01~2025.06.30 확정 2025.07.25 130,000,000 6,500,000',
        '2025.07.01~2025.12.31 확정 2026.01.25 154,000,000 7,700,000',
        '2026.01.01~2026.06.30 확정 2026.07.25 156,000,000 7,800,000',
        '위와 같이 증명합니다.',
        '2026년 10월 20일',
        '대전세무서장',
      ].join('\n'),
      'utf8',
    ),
  }
  const pol = () => page.locator('[data-testid="smart-insight"][data-key="policy-funding"]').evaluate((el) => el.textContent ?? '').catch(() => '')
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  if ((await page.locator('[data-testid="smart-insight"]').count()) === 0) await page.getByRole('button', { name: /모듈별 판정/ }).first().click()
  await page.waitForTimeout(400)
  const before = (await pol()) ?? ''
  check(`D-311 ${vp.tag} 올리기 전: 정책자금이 매출(재무제표 · 크레탑)을 달라고 함`, before.includes('매출(재무제표 · 크레탑)'), before.slice(0, 400))
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([VAT])
  await page.getByTestId('smart-placed').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  const placed = ((await page.getByTestId('smart-placed').innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ')
  check(`D-311 ${vp.tag} 스캔 이름이어도 '부가세 과세표준증명' 칸으로`, placed.includes('→ 부가세 과세표준증명'), placed.slice(0, 300))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  const batch = ((await page.getByTestId('smart-batch').innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ')
  check(`D-311 ${vp.tag} 바로 넣은 정보: 매출 2025년 2억 8,400만원(부가세 과세표준 · 2024년보다 +18%) · 2026년 6개월`, batch.includes('2025년 2억 8,400만원(부가세 과세표준 · 2024년보다 +18%)') && batch.includes('2026년 6개월 1억 5,600만원(작년 같은 기간보다 +20%)'), batch.slice(0, 600))
  if ((await page.locator('[data-testid="smart-insight"]').count()) === 0) await page.getByRole('button', { name: /모듈별 판정/ }).first().click()
  await page.waitForTimeout(400)
  const after = (await pol()) ?? ''
  check(`D-311 ${vp.tag} 정책자금: 매출을 더 달라고 하지 않음 · 준비 서류 줄`, !after.includes('매출(재무제표 · 크레탑)') && /준비 서류 \d+\/\d+ — 아직 /.test(after), after.slice(0, 500))
  if (vp.tag === '390') await page.getByTestId('smart-batch').screenshot({ path: '/tmp/claude-0/shot311-batch-390.png' }).catch(() => {})
  if (vp.tag === '1440') await page.locator('[data-testid="smart-insight"][data-key="policy-funding"]').screenshot({ path: '/tmp/claude-0/shot311-card.png' }).catch(() => {})
  await page.goto(BASE + '/tools/policy-funding/diagnosis?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const note = (await page.getByTestId('tool-prefill-note').innerText().catch(() => '')) ?? ''
  check(`D-311 ${vp.tag} 정책자금 화면: '준비 서류 n가지(서류함)' 채움`, /준비 서류 \d+가지\(서류함\)/.test(note), note.slice(0, 400))
  // 진단 결과(자료 체크)는 [진단 결과 보기] 를 눌러야 나온다
  await page.getByRole('button', { name: '진단 결과 보기' }).first().click()
  await page.waitForTimeout(1200)
  const main = ((await page.locator('main').innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ')
  const vatRow = /부가세과세표준증명원 확보/.test(main) && /사업자등록증 (요청 필요|확보)/.test(main)
  if (vp.tag === '390') await page.getByText('자료 체크 (부족 자료 자동 탐지)').first().locator('xpath=ancestor::*[.//ul][1]').screenshot({ path: '/tmp/claude-0/shot311-checks-390.png' }).catch(() => {})
  check(`D-311 ${vp.tag} 정책자금 화면 자료 체크: 부가세과세표준증명원 확보`, vatRow, (main.match(/자료 체크[\s\S]{0,400}/)?.[0] ?? main.slice(0, 200)))
  check(`D-311 ${vp.tag} 넘침 0 · 오류 0`, (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0 && errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-312 정책자금 판정 한 길로 — 상황 예시 = 맞춤 추천 카드(같은 근거) · 청년 채용 질문에 명부 힌트 ---------------- */
for (const vp of [{ tag: '1440', w: 1440, h: 900 }, { tag: '390', w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const ROSTER = {
    name: '사업장가입자명부_한솔.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      ['4대보험 사업장 가입자 명부', '사업장명: 한솔테크(주)', '발급일시 2026.10.20', '성명 주민등록번호 국민연금 건강보험 산재보험 고용보험',
        '800101-1234567 박민수', '2019-01-02 2019-01-02 2019-01-02 2019-01-02', '950505-2345678 이수진', '2024-03-01 2024-03-01 2024-03-01 2024-03-01',
        '980310-1234567 홍길동', '2026-02-02 2026-02-02 2026-02-02 2026-02-02', '010101-3234567 최하늘', '2026-05-04 2026-05-04 2026-05-04 2026-05-04'].join('\n'),
      'utf8',
    ),
  }
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([ROSTER])
  await page.getByTestId('smart-placed').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  if ((await page.locator('[data-testid="smart-insight"]').count()) === 0) await page.getByRole('button', { name: /모듈별 판정/ }).first().click()
  await page.waitForTimeout(400)
  const card = (await page.locator('[data-testid="smart-insight"][data-key="policy-funding"]').evaluate((el) => el.textContent ?? '').catch(() => '')) ?? ''
  // 카드 글은 제목 · 설명이 붙어 나온다 — 상황 예시 쪽 기관 이름이 카드 제목에 그대로 있는지로 본다
  await page.getByTestId('smart-scenarios').waitFor({ timeout: 15000 })
  const row = page.locator('[data-testid="scenario-row"][data-id="policy-working"]')
  if ((await row.count()) === 0 && (await page.getByTestId('scenario-more').count())) await page.getByTestId('scenario-more').click()
  await page.waitForTimeout(300)
  const head = (await row.getByTestId('scenario-headline').innerText().catch(() => '')) ?? ''
  const rowAgency = /추천 기관\s*([가-힣]+)/.exec(head)?.[1] ?? ''
  check(`D-312 ${vp.tag} 운전자금 상황 예시 = 맞춤 추천 정책자금 카드 추천 기관(${rowAgency})`, rowAgency !== '' && card.includes(`추천 기관 ${rowAgency}`), JSON.stringify({ card: card.slice(0, 80), scenario: head }))
  if ((await row.getByTestId('scenario-detail').count()) === 0) await row.getByTestId('scenario-toggle').click()
  await row.getByTestId('scenario-detail').waitFor({ timeout: 5000 }).catch(() => {})
  const detail = ((await row.innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ')
  check(`D-312 ${vp.tag} 상황 예시에도 '서류: 고용 증가(…)' · 체납 가정은 엔진대로`, detail.includes('서류: 고용 증가(') && detail.includes("'높음' 으로 보지 않았어요") && !detail.includes('문제없다고'), detail.slice(0, 600))
  await row.scrollIntoViewIfNeeded().catch(() => {})
  await page.locator('[role="status"] button[aria-label*="닫기"]').first().click({ timeout: 1000 }).catch(() => {})
  await row.screenshot({ path: `/tmp/claude-0/shot312-row-${vp.tag}.png` }).catch(() => {})
  if ((await page.locator('[data-testid="scenario-question"][data-q="hireYouth"]').count()) === 0 && (await page.getByTestId('scenario-questions-more').count())) await page.getByTestId('scenario-questions-more').click()
  const q = ((await page.locator('[data-testid="scenario-question"][data-q="hireYouth"]').innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ')
  check(`D-312 ${vp.tag} 청년 채용 질문 옆에 '명부: 고용 증가(2025년 평균 2명 → …, 청년 3명)'`, /명부: 고용 증가\(2025년 평균 2명 → 2026년 (예상 )?[\d.]+명, 청년 3명/.test(q), q.slice(0, 400))
  if (vp.tag === '390') await page.locator('[data-testid="scenario-question"][data-q="hireYouth"]').screenshot({ path: '/tmp/claude-0/shot312-q-390.png' }).catch(() => {})
  check(`D-312 ${vp.tag} 넘침 0 · 오류 0`, (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0 && errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-313 정책자금 신청 서류 요청 문구 — 서류함에 있는 것은 빼고 · 맞춤 추천 카드 · 맨 위 제안할 것 ---------------- */
for (const vp of [{ tag: '1440', w: 1440, h: 900 }, { tag: '390', w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  if ((await page.locator('[data-testid="smart-insight"]').count()) === 0) await page.getByRole('button', { name: /모듈별 판정/ }).first().click()
  await page.waitForTimeout(400)
  const card = page.locator('[data-testid="smart-insight"][data-key="policy-funding"]')
  const btn = card.getByTestId('smart-insight-request')
  check(`D-313 ${vp.tag} 정책자금 카드에 [아직 받을 서류 n가지 요청 문구]`, (await btn.count()) === 1 && /^아직 받을 서류 \d+가지 요청 문구$/.test(((await btn.innerText().catch(() => '')) ?? '').trim()), (await btn.innerText().catch(() => '')) ?? '')
  if (vp.tag === '390') await card.screenshot({ path: '/tmp/claude-0/shot313-card-390.png' }).catch(() => {})
  await btn.click()
  const dlg = page.locator('[role="dialog"]').first()
  await dlg.locator('textarea').first().waitFor({ timeout: 4000 })
  const title = ((await dlg.innerText().catch(() => '')) ?? '').split('\n')[0]
  const text = await dlg.locator('textarea').first().inputValue()
  check(`D-313 ${vp.tag} 창 제목 '정책자금 신청 서류 요청 문구' · 문구에 추천 기관 · 사업계획서는 저희가`, (await dlg.innerText()).includes('정책자금 신청 서류 요청 문구') && /한솔테크\(주\) 정책자금\(.+\) 신청을 준비하려고 합니다/.test(text) && text.includes('※ 사업계획서는 저희가'), `${title} | ${text.slice(0, 300)}`)
  check(`D-313 ${vp.tag} 서류함에 있는 사업자등록증 · 신분증은 문구에 없음 · 재무제표는 있음`, !text.includes('사업자등록증 사본') && !text.includes('대표자 신분증 사본') && text.includes('표준재무제표증명'), text.slice(0, 500))
  if (vp.tag === '390') await dlg.screenshot({ path: '/tmp/claude-0/shot313-dialog-390.png' }).catch(() => {})
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  // 개요 맨 위 '이 업체에 먼저 제안할 것' — 카드는 통째로 링크라 단추는 아래 줄에
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const pick = page.locator('[data-testid="top-pick-request"][data-key="policy-funding"]')
  const picked = (await page.locator('[data-testid="top-pick"][data-key="policy-funding"]').count()) === 1
  check(`D-313 ${vp.tag} 맨 위 제안할 것에 정책자금이 있으면 '정책자금 신청 서류 n가지 요청' 단추`, !picked || ((await pick.count()) === 1 && /정책자금 신청 서류 \d+가지 요청/.test((await pick.innerText()) ?? '')), `picked=${picked}`)
  if (picked) {
    await pick.click()
    const d2 = page.locator('[role="dialog"]').first()
    await d2.locator('textarea').first().waitFor({ timeout: 4000 })
    check(`D-313 ${vp.tag} 맨 위 단추도 같은 문구 창`, (await d2.innerText()).includes('정책자금 신청 서류 요청 문구') && (await d2.locator('textarea').first().inputValue()) === text)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    if (vp.tag === '390') await page.getByTestId('top-picks').screenshot({ path: '/tmp/claude-0/shot313-top-390.png' }).catch(() => {})
  }
  check(`D-313 ${vp.tag} 넘침 0 · 오류 0`, (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0 && errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-314 요청 문구를 보냈으면 — [보냈어요 · 3일 뒤 받았는지 확인] → 업무 일기 할 일(다음 약속은 그대로) ---------------- */
for (const vp of [{ tag: '1440', w: 1440, h: 900 }, { tag: '390', w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const before = await record(page)
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  if ((await page.locator('[data-testid="smart-insight"]').count()) === 0) await page.getByRole('button', { name: /모듈별 판정/ }).first().click()
  await page.waitForTimeout(400)
  await page.locator('[data-testid="smart-insight"][data-key="policy-funding"]').getByTestId('smart-insight-request').click()
  const dlg = page.locator('[role="dialog"]').first()
  await dlg.getByTestId('message-followup').waitFor({ timeout: 4000 })
  check(`D-314 ${vp.tag} 요청 문구 창에 [보냈어요 · 3일 뒤 받았는지 확인]`, ((await dlg.getByTestId('message-followup').innerText()) ?? '').includes('보냈어요 · 3일 뒤 받았는지 확인'))
  await dlg.getByTestId('message-followup').click()
  await dlg.getByTestId('message-followup-done').waitFor({ timeout: 4000 }).catch(() => {})
  const done = (await dlg.getByTestId('message-followup-done').innerText().catch(() => '')) ?? ''
  check(`D-314 ${vp.tag} 누르면 '할 일에 넣었어요 · 기한 MM/DD — 오늘 · 일정에 떠요' · 단추는 '할 일에 넣음'(다시 못 누름)`, /할 일에 넣었어요 · 기한 \d{2}\/\d{2}/.test(done) && (await dlg.getByTestId('message-followup').isDisabled()) && ((await dlg.getByTestId('message-followup').innerText()) ?? '').includes('할 일에 넣음'), done)
  if (vp.tag === '390') await dlg.screenshot({ path: '/tmp/claude-0/shot314-dialog-390.png' }).catch(() => {})
  const journal = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.ops_journal_entries') ?? '[]'))
  const mine = journal.filter((j) => j.clientId === 'cli_hansol' && j.entryType === 'follow_up' && String(j.content).startsWith('자료 받았는지 확인 — 표준재무제표증명'))
  const gap = mine[0] ? Math.round((Date.parse(mine[0].dueDate) - Date.parse(mine[0].entryDate)) / 86400000) : -1
  check(`D-314 ${vp.tag} 업무 일기 할 일 1건(이 업체 · 기한 3일 뒤 · '자료 받았는지 확인 — 표준재무제표증명 …')`, mine.length === 1 && gap === 3, JSON.stringify(mine[0] ?? journal.slice(0, 2)))
  const after = await record(page)
  check(`D-314 ${vp.tag} 다음 약속은 그대로(덮지 않음)`, after.nextAction === before.nextAction && after.nextActionDueDate === before.nextActionDueDate)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // 진행 상황 보고 문구에는 단추가 없다(요청이 아니다)
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  if (vp.tag === '1440') {
    await page.getByRole('button', { name: '진행 상황 보고' }).first().click()
  } else {
    await page.getByRole('button', { name: /더보기/ }).first().click()
    await page.getByRole('button', { name: '진행 상황 보고 문구' }).first().click()
  }
  await page.locator('[role="dialog"] textarea').first().waitFor({ timeout: 4000 })
  check(`D-314 ${vp.tag} 진행 상황 보고 문구에는 [보냈어요] 없음`, (await page.getByTestId('message-followup').count()) === 0)
  check(`D-314 ${vp.tag} 넘침 0 · 오류 0`, (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0 && errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- D-342 대표 원천징수영수증 올리기 → 대표 월 급여 → 절세 설계 · 맞춤 추천 퇴직금 · 서류함 칸 ---------------- */
for (const vp of [{ tag: '1440', w: 1440, h: 900 }, { tag: '390', w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const RCPT = {
    name: 'scan_0042.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      [
        '■ 소득세법 시행규칙 [별지 제24호서식(1)]',
        '[ √ ]근로소득 원천징수영수증',
        '[ ]근로소득 지급명세서',
        '징수의무자 ① 법인명(상 호) 한솔테크(주) ② 대 표 자(성 명) 김대표',
        '③ 사업자등록번호 123-45-67890 ⑤ 소 재 지(주소) 경기도 남양주시 진접읍 해밀예당1로 1',
        '소득자 ⑥ 성 명 김대표 ⑦ 주 민 등 록 번 호(외국인등록번호) 750101-1******',
        '⑧ 주 소 서울특별시 노원구 1',
        '⑪ 근무기간 2025.01.01~2025.12.31',
        '⑬ 급 여 86,400,000 86,400,000',
        '⑯ 계 86,400,000 86,400,000',
        '⑳ 비과세소득 계 2,400,000',
        '㉑ 총 급 여 (⑯, 다만 외국인단일세율 적용시 연간 근로소득) 84,000,000',
      ].join('\n'),
      'utf8',
    ),
  }
  const rec = () => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_hansol'))
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const before = await rec()
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles([RCPT])
  await page.getByTestId('smart-placed').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  const placed = (await page.getByTestId('smart-placed').innerText().catch(() => '')) ?? ''
  const entered = (await page.getByTestId('smart-entered').innerText().catch(() => '')) ?? ''
  check(`D-342 ${vp.tag} 파일 이름이 scan 이어도 서류함 '근로소득 원천징수영수증' 칸`, placed.includes('근로소득 원천징수영수증'), placed.slice(0, 300))
  check(`D-342 ${vp.tag} 바로 넣은 정보: 대표 월 급여 700만원 — 2025년 총급여 8,400만원 ÷ 12개월`, entered.includes('대표 월 급여') && entered.includes('월 700만원') && entered.includes('2025년 총급여 8,400만원 ÷ 12개월'), entered.slice(0, 400))
  if (vp.tag === '1440') await page.getByTestId('smart-batch').screenshot({ path: '/tmp/claude-0/shot342-batch.png' }).catch(() => {})
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  const r = await rec()
  check(`D-342 ${vp.tag} 업체 기록 절세 현황 대표 월 급여 7,000,000 · 주민번호 · 대표 집 주소 없음`, r.taxProfile?.monthlySalary === '7000000' && !JSON.stringify(r).includes('750101') && !JSON.stringify(r).includes('노원구'), JSON.stringify(r.taxProfile))
  const tax = (await page.locator('[data-testid="smart-insight"][data-key="tax"]').evaluate((el) => el.textContent ?? '').catch(() => '')) ?? ''
  check(`D-342 ${vp.tag} 맞춤 추천 절세: 대표 급여 없던 업체 → 영수증 하나로 퇴직금 한도 계산(설립일을 취임일로)`, !before.taxProfile?.monthlySalary && tax.includes('퇴직금 한도') && !tax.includes('대표 급여를 알면'), tax.slice(0, 200))
  if (vp.tag === '1440') await page.locator('[data-testid="smart-insight"][data-key="tax"]').screenshot({ path: '/tmp/claude-0/shot342-tax.png' }).catch(() => {})
  // 절세 설계 화면에 그 금액이 그대로
  await page.goto(BASE + '/tools/tax?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const vals = await page.locator('input').evaluateAll((els) => els.map((e) => e.value))
  check(`D-342 ${vp.tag} 절세 설계 '대표 월 급여' 칸에 7,000,000 · 넘침 0 · 오류 0`, vals.some((v) => v.replace(/,/g, '') === '7000000') && (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0 && errors.length === 0, JSON.stringify(vals.filter(Boolean).slice(0, 20)) + errors.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(`\n업체 상세: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
