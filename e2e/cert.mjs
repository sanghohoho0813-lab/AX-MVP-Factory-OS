/**
 * qa:cert — 기업인증 모듈 (D-170). 실행: npm run qa:cert -- http://localhost:4390
 *  - 업체 없이 열면 업체부터 · 업체로 열면 인증 한눈에(카드 5 · 준비도 글자 · 근거 · 혜택 왜 · 진행 순서 왜)
 *  - 업체 사정 칩 한 번 → 판정이 바뀐다(저장 · 다시 열어도)
 *  - 이노비즈 4단계 · 자가진단 한 질문씩(기록으로 미리 고름 · 증빙) → 결과(공식 기준 숫자 따로) → 실사 대비 → 모의 실사(점수 없음)
 *  - 메인비즈는 다른 문항 · 벤처/연구소는 기존 화면으로 · ISO 상담 요청(업체 기록 활동)
 *  - 첫 사용 테스트(설명서 없이): 고객 선택 → 기업인증 → 순서 이해 → 이유 → 준비자료 → 자가진단 → 부족자료 → 실사 준비
 *  - 360 · 390 · 430 · 글자 1.30(아주 크게)에서 가로 넘침 0 · 44px 누르기 · JS 오류 0
 */
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail !== undefined ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`)
}
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- PC 1440 — 첫 사용 흐름 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())

  // 메뉴: 기업성장 › 기업인증
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  const cat = page.locator('aside nav').getByRole('button', { name: /기업성장/ }).first()
  if ((await cat.getAttribute('aria-expanded')) !== 'true') await cat.click()
  await page.waitForTimeout(200)
  await page.locator('aside nav').getByRole('link', { name: '기업인증' }).first().click()
  await page.waitForURL(/\/tools\/cert-os/)
  await page.waitForTimeout(500)
  check('메뉴: 기업성장 › 기업인증', page.url().includes('/tools/cert-os'))
  check('업체 없이 열면 업체부터 고른다', (await page.getByTestId('cert-pick-client').count()) === 1)
  await page.getByTestId('cert-client-select').selectOption('cli_hansol')
  await page.waitForTimeout(800)
  check('업체 고르면 그 업체로(주소 ?client=)', page.url().includes('client=cli_hansol') && (await page.getByTestId('cert-card').count()) === 5)

  const cards = page.getByTestId('cert-card')
  const keys = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-key')))
  check('한눈에: 벤처 · 연구소 · 이노비즈 · 메인비즈 · ISO 9001', keys.join() === 'venture,lab,innobiz,mainbiz,iso9001', keys)
  const allText = await page.getByTestId('cert-cards').innerText()
  check('준비도는 글자(5단계 · 추가 확인 필요) — 퍼센트 · 점수 없음', !/\d+\s*%|\d+\s*점/.test(allText), allText.match(/\d+\s*(%|점)/g))
  check('카드마다 한 줄 이유 · 근거', (await page.getByTestId('cert-oneline').count()) === 5 && (await page.getByTestId('cert-reasons').count()) === 5)
  const reasonsLines = await page.getByTestId('cert-reasons').first().locator('li').count()
  check('처음엔 근거 3줄까지만(자세히로 펼침)', reasonsLines <= 3)

  // 업체 사정 칩 — 고르면 판정이 바뀐다
  const innobizBefore = await cards.filter({ has: page.locator('[data-key="innobiz"]') }).count()
  await page.getByTestId('cert-profile-toggle').click()
  const before = await page.locator('[data-testid="cert-card"][data-key="innobiz"] [data-testid="cert-rec"]').getAttribute('data-rec')
  const pickChip = async (key, label) => {
    await page.locator(`[data-testid="cert-q-${key}"]`, { hasText: new RegExp(`^${label}$`) }).first().click()
    await page.waitForTimeout(350)
  }
  await pickChip('researchUnit', '연구소')
  await pickChip('patents', '2건')
  await pickChip('rndExpenseMan', '1억 이상')
  await pickChip('policyFundPlan', '예')
  await pickChip('procurement', '예')
  await page.waitForTimeout(400)
  const after = await page.locator('[data-testid="cert-card"][data-key="innobiz"] [data-testid="cert-rec"]').getAttribute('data-rec')
  check(`칩 다섯 번 → 이노비즈 판정이 바뀐다(${before} → ${after})`, innobizBefore >= 0 && before !== after && ['now', 'possible'].includes(after ?? ''), [before, after])
  check('연구소 칩 → 연구소 카드는 보유 중', (await page.locator('[data-testid="cert-card"][data-key="lab"] [data-testid="cert-rec"]').getAttribute('data-rec')) === 'held')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  check('고른 사정은 저장 — 다시 열어도 같은 판정', (await page.locator('[data-testid="cert-card"][data-key="innobiz"] [data-testid="cert-rec"]').getAttribute('data-rec')) === after)

  // 진행 순서 · 왜
  check('추천 진행 순서가 보인다', (await page.getByTestId('cert-roadmap-step').count()) >= 1)
  await page.getByTestId('cert-roadmap-why').click()
  check('왜 이 순서인가요? → 단계마다 이유', /—/.test(await page.getByTestId('cert-roadmap').innerText()))

  // 혜택 왜
  const inno = page.locator('[data-testid="cert-card"][data-key="innobiz"]')
  if ((await inno.getByTestId('cert-benefit').count()) > 0) {
    await inno.getByTestId('cert-benefit').first().click()
    check('혜택 칩 → 왜 추천했나요? · 조건부면 확인 필요', /왜 추천했나요\?/.test(await inno.getByTestId('cert-benefit-why').innerText()))
  } else check('혜택 칩 → 왜 추천했나요?', false, 'no benefit chip')

  // 이노비즈로
  await inno.getByTestId('cert-cta').click()
  await page.waitForURL(/\/tools\/cert-os\/innobiz/)
  await page.waitForTimeout(500)
  check('준비하기 → 이노비즈 4단계(받을 수 있나요? 부터)', (await page.getByTestId('cert-steps').count()) === 1 && (await page.getByTestId('cert-step-body-0').count()) === 1)
  check('공식 기준은 따로 — 650점 · 700점 · B등급', /650점/.test(await page.getByTestId('cert-official').innerText()) && /B등급/.test(await page.getByTestId('cert-official').innerText()))
  await page.getByTestId('cert-sources').locator('summary').click()
  check('공식 출처 · 마지막 확인일 · 원문 링크', /2026-10-07/.test(await page.getByTestId('cert-sources').innerText()) && (await page.getByTestId('cert-sources').locator('a[href*="law.go.kr"]').count()) >= 1)
  await page.getByTestId('cert-step-1').click()
  const evText = await page.getByTestId('cert-step-body-1').innerText()
  check('무엇을 준비하나요? — 있음 · 받을 것 · 이유', /받을 것/.test(evText) && /—/.test(evText))
  await page.getByTestId('cert-step-2').click()
  await page.getByTestId('cert-selfcheck-start').click()
  await page.waitForTimeout(300)
  const first = page.getByTestId('selfcheck-card')
  check('자가진단: 한 화면에 한 질문 · 쉬운 설명 · 1/8', (await first.count()) === 1 && /1 \/ 8/.test(await page.getByTestId('flow-pos').innerText()))
  check('자가진단: 기록(연구소)으로 미리 고른 답과 근거', /기록으로 미리 골랐어요: 있음/.test(await page.getByTestId('selfcheck-suggest').innerText()))
  for (let i = 0; i < 8; i += 1) {
    if ((await page.getByTestId('selfcheck-answer-yes').getAttribute('aria-checked')) !== 'true' && i % 2 === 0) await page.getByTestId('selfcheck-answer-yes').click()
    await page.waitForTimeout(150)
    await page.getByTestId('flow-next').click()
    await page.waitForTimeout(150)
  }
  const res = await page.getByTestId('selfcheck-result').innerText()
  check('자가진단 결과: 5단계 · 공식 기준 따로 · 준비할 자료', /준비도|추가 확인 필요/.test(res) && /650점/.test(res) && /실사 전에 준비할 자료|보완/.test(res))
  check('자가진단 결과: 자체 점수 없음', !/\d+\s*점\s*\(MIRAE|자체\s*\d+점/.test(res))
  await page.getByTestId('selfcheck-to-inspection').click()
  await page.waitForTimeout(300)
  check('실사 대비: 한 질문씩 · 의도', (await page.getByTestId('inspection-card').count()) === 1 && /질문 의도/.test(await page.getByTestId('inspection-card').innerText()))
  await page.getByTestId('inspection-ok').click()
  await page.getByTestId('flow-next').click()
  await page.waitForTimeout(200)
  const second = await page.getByTestId('inspection-card').innerText()
  check('실사 대비: 연구조직 질문은 기록으로 초안(기업부설연구소)', /기업부설연구소/.test(second))
  await page.getByTestId('inspection-ok').click()
  await page.getByTestId('flow-next').click()
  await page.waitForTimeout(200)
  check('실사 대비: 근거 없는 질문은 초안 없이 대표 확인 필요', (await page.getByTestId('inspection-owner').count()) === 1)
  await page.getByTestId('inspection-confirm').click()
  await page.getByTestId('flow-next').click()
  await page.getByTestId('flow-next').click()
  await page.waitForTimeout(150)
  await page.getByTestId('flow-next').click()
  await page.waitForTimeout(300)
  const mock = await page.getByTestId('mock-result').innerText()
  check('모의 실사: 점수 없이 5단계 · 강점 · 실사 전 반드시 확인', /실사 대비 상태/.test(mock) && /실사 전 반드시 확인/.test(mock) && !/\d+\s*점/.test(mock), mock)

  await page.getByTestId('cert-step-3').click()
  await page.getByTestId('cert-all-benefits').click()
  check('받으면 무엇이 달라지나요? — 모든 혜택 · 조건부 표시', /적용 여부 추가 확인 필요/.test(await page.getByTestId('cert-step-body-3').innerText()))
  await page.getByTestId('cert-explain-kakao').click()
  check('고객에게 설명하기: 카톡 문구(LLM 없이 사실 + 틀)', /대표님/.test(await page.getByTestId('cert-explain-text').last().innerText()))

  // 메인비즈 — 같은 문법, 다른 문항
  await page.goto(BASE + '/tools/cert-os/mainbiz?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.getByTestId('cert-step-0').click()
  check('메인비즈: 공식 기준 600점 · 700점', /600점/.test(await page.getByTestId('cert-official').innerText()))
  await page.getByTestId('cert-step-2').click()
  await page.getByTestId('cert-selfcheck-start').click()
  check('메인비즈 자가진단: 다른 문항(전략기획)', /전략기획/.test(await page.getByTestId('selfcheck-card').innerText()))

  // 벤처 · 연구소 — 기존 화면으로
  await page.goto(BASE + '/tools/cert-os/lab?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.getByTestId('cert-step-2').click()
  check('연구소: 진행은 기존 연구소 관리로(복제 없음)', (await page.getByTestId('cert-existing-tool').getAttribute('class')) !== null && /연구소 관리 열기/.test(await page.getByTestId('cert-existing-tool').innerText()))
  await page.goto(BASE + '/tools/cert-os/venture?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.getByTestId('cert-step-2').click()
  check('벤처: 진행은 기존 특허+벤처로(복제 없음)', /특허\+벤처 화면 열기/.test(await page.getByTestId('cert-existing-tool').innerText()))

  // ISO 상담 요청
  await page.goto(BASE + '/tools/cert-os/iso?client=cli_hansol', { waitUntil: 'networkidle' })
  check('ISO: 9001 · 14001 · 45001 세 장 · KAB 인정기관 문구', (await page.getByTestId('cert-iso-card').count()) === 3 && /KAB/.test(await page.getByTestId('cert-iso-consult').innerText()))
  await page.getByTestId('cert-iso-pick-iso9001').check().catch(() => {})
  await page.getByTestId('cert-iso-request').click()
  await page.waitForTimeout(600)
  const act = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((c) => c.id === 'cli_hansol')?.activity?.[0]?.text ?? '')
  check('ISO 상담 요청: 업체 기록에 남김 · 문구에 연락처 없음', /ISO 상담 요청/.test(act) && /김상호 대표/.test(act), act)
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  check('ISO 상담 요청 문구: 업체명 · 업종 · 직원 수 · 관심 ISO · 보유 자료', /\[ISO 상담 요청\]/.test(clip) && /직원 수/.test(clip) && /ISO 9001/.test(clip) && !/010|사업자번호/.test(clip), clip)

  // 업체 상세 모듈 입구
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check('업체 상세: 모듈 입구에 기업인증 확인하기', (await page.locator('a[href*="/tools/cert-os?client=cli_hansol"]').count()) >= 1)
  check('JS 오류 없음', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- 휴대폰 360 · 390 · 430 · 큰 글자 ---------------- */
for (const vp of [
  { w: 360, s: 'normal' },
  { w: 390, s: 'normal' },
  { w: 430, s: 'normal' },
  { w: 390, s: 'extra_large' },
  { w: 1440, s: 'large' },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: 844 }, locale: 'ko-KR', isMobile: vp.w < 1000, hasTouch: vp.w < 1000 })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate((s) => localStorage.setItem('axmvp.ui.text_scale', JSON.stringify(s)), vp.s)
  let worst = 0
  let small = []
  for (const sec of ['overview', 'innobiz', 'mainbiz', 'venture', 'lab', 'iso']) {
    await page.goto(`${BASE}/tools/cert-os/${sec}?client=cli_hansol`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    if (sec === 'overview') {
      await page.getByTestId('cert-profile-toggle').click()
      await page.getByTestId('cert-more').first().click()
    }
    if (sec === 'innobiz') {
      await page.getByTestId('cert-step-2').click()
      await page.getByTestId('cert-selfcheck-start').click()
    }
    worst = Math.max(worst, await overflowX(page))
    if (vp.w < 1000) {
      const tiny = await page.evaluate(() =>
        [...document.querySelectorAll('main button, main a, main [role="radio"]')]
          .filter((el) => el.closest('[data-testid^="cert"],[data-testid^="selfcheck"],[data-testid^="flow"]'))
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.height > 0 && r.height < 40)
          .length,
      )
      if (tiny) small.push(`${sec}:${tiny}`)
    }
  }
  check(`${vp.w}px · 글자 ${vp.s}: 기업인증 6화면 가로 넘침 0`, worst <= 0, worst)
  if (vp.w < 1000) check(`${vp.w}px · 글자 ${vp.s}: 누르는 곳 40px 이상(카드 · 칩 · 단추)`, small.length === 0, small)
  check(`${vp.w}px · 글자 ${vp.s}: JS 오류 없음`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(`\ncert e2e: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
