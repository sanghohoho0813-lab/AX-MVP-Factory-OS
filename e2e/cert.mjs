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

  /* ================= P1 — 연구소 연결 · 사실 확인 저장 · 진행 기록 · 갱신 · 실사 요약 · 근거 · 자료 요청 · 만료 · 빈 업체 ================= */
  const recOf = (id) => page.evaluate((cid) => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((c) => c.id === cid), id)
  // A — 연구소 관리(labcare) 기록이 있으면 묻지 않는다
  await page.evaluate(() => {
    const now = new Date().toISOString()
    localStorage.setItem('axmvp.module.labcare.orig', JSON.stringify([{ id: 'lr1', clientId: '', data: { key: 'pmsaas:clients:v1', value: [{ id: 'cli_wooil', labType: '기업부설연구소', certifiedDate: '2024-05-10', labRegistrationNumber: '2024-123', labName: '우일연구소', researcherCount: 4 }] }, createdAt: now, updatedAt: now }]))
  })
  await page.goto(BASE + '/tools/cert-os?client=cli_wooil', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  check('A 연구소 관리 기록 → 연구소 카드 보유 중(다시 묻지 않음)', (await page.locator('[data-testid="cert-card"][data-key="lab"] [data-testid="cert-rec"]').getAttribute('data-rec')) === 'held')
  await page.getByTestId('cert-profile-toggle').click()
  check('A 연구조직 · 연구원 수 질문 없음(이미 앎)', (await page.locator('[data-testid="cert-q-researchUnit"]').count()) === 0 && (await page.locator('[data-testid="cert-q-researchers"]').count()) === 0)
  // B — 특허 칩 → 판정에 바로, 회사 정보에는 [확인 저장] 눌러야
  await page.locator('[data-testid="cert-q-patents"]', { hasText: /^2건$/ }).first().click()
  await page.waitForTimeout(500)
  const beforeFact = (await recOf('cli_wooil'))?.factValues?.patents ?? ''
  check('B 칩만 고르면 회사 정보(사실 창고)는 그대로', beforeFact !== '2건' && (await page.getByTestId('cert-facts-confirm').count()) === 1, beforeFact)
  await page.getByTestId('cert-facts-save').click()
  await page.waitForTimeout(700)
  const wf = await recOf('cli_wooil')
  check('B [회사 정보에 확인된 사실로 저장] → 특허 2건 · 확인됨 · 활동 기록', wf.factValues?.patents === '2건' && wf.factMeta?.patents?.status === 'confirmed' && wf.activity?.[0]?.text?.includes('기업인증에서 확인한 사실'), { v: wf.factValues, m: wf.factMeta?.patents })
  check('B 저장하면 확인 단추가 사라진다', (await page.getByTestId('cert-facts-confirm').count()) === 0)
  // 근거
  await page.goto(BASE + '/tools/cert-os/innobiz?client=cli_wooil', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByTestId('cert-basis').locator('summary').click()
  const basis = await page.getByTestId('cert-basis-item').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-state')}:${e.textContent}`))
  check('근거: 연구조직 ✓ 연구소 관리 기록 · 특허 ✓(확인 저장 뒤) · 모르는 것은 ?', basis.some((b) => b.startsWith('confirmed') && b.includes('연구소 관리')) && basis.some((b) => b.startsWith('confirmed') && b.includes('특허')) && basis.some((b) => b.startsWith('missing')), basis)
  // 자료 요청
  await page.getByTestId('cert-step-1').click()
  const wantDocs = await page.locator('[data-testid="cert-evidence"][data-have="false"]').count()
  const docsBefore = (await recOf('cli_wooil'))?.customDocuments?.length ?? 0
  await page.getByTestId('cert-request-docs').click()
  await page.waitForTimeout(700)
  const docsAfter = (await recOf('cli_wooil'))?.customDocuments?.length ?? 0
  const reqClip = await page.evaluate(() => navigator.clipboard.readText())
  const listed = (reqClip.match(/^\d+\. /gm) ?? []).length
  check('자료 요청: 받을 것만 문구(화면의 받을 것과 같은 수) · 서류함에 없는 칸만 새로', docsAfter > docsBefore && docsAfter - docsBefore <= wantDocs && listed === wantDocs && /부탁드립니다/.test(reqClip), { wantDocs, listed, docsBefore, docsAfter })
  await page.getByTestId('cert-request-docs').click()
  await page.waitForTimeout(600)
  check('자료 요청: 다시 눌러도 칸이 겹치지 않음', ((await recOf('cli_wooil'))?.customDocuments?.length ?? 0) === docsAfter)
  // C — 진행 기록 → 인증 완료 → 갱신 일정 → 다음 할 일
  await page.getByTestId('cert-step-2').click()
  await page.getByTestId('cert-life-applied').click()
  await page.waitForTimeout(600)
  check('C 상태 칩 → 신청 · 활동 기록 한 줄', (await page.getByTestId('cert-life-status').innerText()) === '신청' && (await recOf('cli_wooil')).activity?.[0]?.text === '이노비즈 진행 — 신청')
  await page.getByTestId('cert-complete-open').click()
  await page.getByTestId('cert-complete-number').fill('260315-00123')
  check('C 인증 완료 기록: 인증일 없으면 저장 못 함(날짜를 만들지 않음)', await page.getByTestId('cert-complete-save').isDisabled())
  await page.getByTestId('cert-complete-date').fill('2026-03-15')
  await page.getByTestId('cert-complete-fill').click()
  check('C 인증일 + 3년 채우기(누를 때만) → 2029-03-14', (await page.getByTestId('cert-complete-valid').inputValue()) === '2029-03-14')
  await page.getByTestId('cert-complete-save').click()
  await page.waitForTimeout(900)
  const wc = await recOf('cli_wooil')
  const cred = (wc.customFields ?? []).find((f) => f.group === 'credential' && /이노비즈/.test(f.label))
  const tr = (wc.toolResults ?? []).find((t) => t.toolKey === 'cert-os' && /이노비즈/.test(t.title))
  check('C 회사 정보 인증서 칸 · 번호 · 2029-03-14까지', !!cred && cred.value.includes('260315-00123') && cred.value.includes('2029-03-14까지'), cred)
  check('C 갱신 일정: 갱신 준비 시기(D-120) · 갱신 서류 준비(D-90, 할 일) · 유효기간 끝', !!tr && tr.deadlines.length === 3 && tr.deadlines[0].date === '2028-11-14' && tr.deadlines[1].date === '2028-12-14' && tr.deadlines[1].todo === true && tr.deadlines[2].hard === true, tr?.deadlines)
  check('C 완료 뒤: 진행 기록 인증 완료 · 갱신 줄 · 다음 할 일 1~3(정책자금 먼저)', (await page.getByTestId('cert-life-status').innerText()) === '인증 완료' && (await page.getByTestId('cert-renewal').count()) === 1 && (await page.getByTestId('cert-after-item').count()) >= 1 && (await page.getByTestId('cert-after-item').count()) <= 3 && /정책자금/.test(await page.getByTestId('cert-after-item').first().innerText()))
  await page.goto(BASE + '/tools/cert-os?client=cli_wooil', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('C 한눈에: 이노비즈 보유 중', (await page.locator('[data-testid="cert-card"][data-key="innobiz"] [data-testid="cert-rec"]').getAttribute('data-rec')) === 'held')
  await page.goto(BASE + '/tools/cert-os/innobiz?client=cli_wooil', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('C 다시 열면 실제 진행 단계부터(진행 기록이 있으니)', (await page.getByTestId('cert-step-body-2').count()) === 1 && (await page.getByTestId('cert-life').getAttribute('data-status')) === 'certified')
  check("K 다음 할 일마다 이유 한 줄('이노비즈 취득 완료 + …')", /이노비즈 취득 완료/.test(await page.getByTestId('cert-after-because').first().innerText()))
  // D — P2 메인비즈 실사 준비 패키지(3분 요약이 자란 것)
  await page.goto(BASE + '/tools/cert-os/mainbiz?client=cli_wooil', { waitUntil: 'networkidle' })
  await page.getByTestId('cert-step-2').click()
  check('D 실제 진행: 실사 준비하기 · 자가진단 · 제출 전 최종 확인 — Primary 는 하나', (await page.getByTestId('cert-prep-actions').locator('button').count()) === 3 && (await page.getByTestId('cert-prep-actions').locator('button.bg-brand-600').count()) === 1)
  await page.getByTestId('cert-prep-pack').click()
  await page.waitForTimeout(300)
  const packText = await page.getByTestId('cert-pack').innerText()
  const nq = await page.getByTestId('pack-question').count()
  check('D 실사 준비 패키지: 업체 핵심정보 · 예상 핵심질문 5~8 · 가져갈 자료 · 전날 체크 · 대표 확인', ['업체 핵심정보', '예상 핵심질문', '가져갈 자료', '실사 전날 체크', '대표님께 확인할 것'].every((w) => packText.includes(w)) && nq >= 5 && nq <= 8, { nq })
  const bases = await page.getByTestId('sourced-line').evaluateAll((els) => els.map((e) => e.getAttribute('data-basis') ?? ''))
  check('D 문장마다 근거(빈 근거 0) · 점수 · 퍼센트 없음', bases.length > 0 && bases.every((b) => b.trim().length > 0) && !/\d+\s*%|\d+\s*점\s*\(/.test(packText), bases.length)
  await page.getByTestId('pack-question').first().locator('summary').click()
  check('D 질문을 누르면 말하기 가이드(묻는 이유 · 핵심 답 · 대표 확인)', /묻는 이유/.test(await page.getByTestId('pack-question').first().innerText()) && /핵심 답/.test(await page.getByTestId('pack-question').first().innerText()))
  await page.getByTestId('pack-copy').click()
  await page.waitForTimeout(200)
  check('D 복사: 한 장 글(내부)', /\[내부\] .*메인비즈 실사 준비/.test(await page.evaluate(() => navigator.clipboard.readText())))
  await page.getByTestId('cert-handoff-copy').click()
  await page.waitForTimeout(200)
  const hand = await page.evaluate(() => navigator.clipboard.readText())
  check('D AI로 다듬기: 구조 자료 복사 · 지어내지 말 것 · 이 업체만', /cert-handoff\/1/.test(hand) && /꼭 지킬 것/.test(hand) && /만들지 마세요/.test(hand) && !/한솔|다움/.test(hand), hand.slice(0, 200))
  const askBefore = await page.getByTestId('owner-ask-item').count()
  await page.getByTestId('owner-ask-send').click()
  await page.waitForTimeout(200)
  const askMsg = await page.evaluate(() => navigator.clipboard.readText())
  check('D 대표에게 질문 보내기: □ 목록 카톡 문구', askMsg.startsWith('대표님, ') && askMsg.split('\n').filter((l) => l.startsWith('□ ')).length === askBefore, { askBefore })
  // 실사 질문에서 온 대표 확인(3번째 — 앞 둘은 신청 자격)에 답을 적는다
  const askedQ = (await page.getByTestId('owner-ask-item').nth(2).innerText()).split('\n').find((l) => l.length > 3)
  await page.getByTestId('owner-answer-open').nth(2).click()
  await page.getByTestId('owner-answer-input').fill('작년 고객 불만 처리 기록을 월별로 정리해 둠')
  await page.getByTestId('owner-answer-save').click()
  await page.waitForTimeout(600)
  const askTexts = () => page.getByTestId('owner-ask-item').evaluateAll((els) => els.map((e) => e.innerText))
  check('D 대표 답 적기 → 그 질문은 목록에서 빠짐', !(await askTexts()).some((t) => t.includes(askedQ)), askedQ)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('cert-step-2').click()
  await page.getByTestId('cert-prep-pack').click()
  await page.waitForTimeout(300)
  check('D 대표 답은 저장됨(다시 열어도 빠져 있고 근거 "대표 답")', !(await askTexts()).some((t) => t.includes(askedQ)) && (await page.locator('[data-testid="sourced-line"][data-basis^="대표 답"]').count()) >= 1)
  await page.getByTestId('pack-close').click()
  // 제출 전 최종 확인
  await page.getByTestId('cert-gate-open').click()
  await page.waitForTimeout(300)
  const gateText = await page.getByTestId('cert-gate').innerText()
  check("D 제출 전 최종 확인: '제출 준비 가능' / '먼저 확인 필요' · 반드시 확인 4 · 보완 권장 4 · 퍼센트 없음", ['제출 준비 가능', '먼저 확인 필요'].includes(await page.getByTestId('cert-gate-verdict').innerText()) && (await page.getByTestId('cert-gate-item').count()) === 8 && (await page.locator('[data-testid="cert-gate-item"][data-level="must"]').count()) === 4 && /반드시 확인/.test(gateText) && /보완 권장/.test(gateText) && !/%/.test(gateText))
  const haveDocs = await page.locator('[data-testid="submit-doc"][data-have="true"]').count()
  const needDocs = await page.locator('[data-testid="submit-doc"][data-have="false"]').count()
  if (needDocs > 0) {
    await page.getByTestId('cert-gate-request').click()
    await page.waitForTimeout(600)
    const gateReq = await page.evaluate(() => navigator.clipboard.readText())
    check('I 제출자료: 서류함에 있는 것은 다시 요청 안 함(요청 줄 = △ 수)', (gateReq.match(/^\d+\. /gm) ?? []).length === needDocs && (haveDocs === 0 || /다시 안 주셔도/.test(gateReq)), { haveDocs, needDocs })
  } else check('I 제출자료: 모두 있음', haveDocs > 0)
  check('D 공식 기준은 따로(접힘)', (await page.getByTestId('cert-gate-official').count()) === 1)
  await page.getByTestId('cert-gate-close').click()
  // 벤처 준비 패키지
  await page.goto(BASE + '/tools/cert-os/venture?client=cli_wooil', { waitUntil: 'networkidle' })
  await page.getByTestId('cert-step-2').click()
  await page.getByTestId('cert-venture-pack').click()
  await page.waitForTimeout(300)
  const states = await page.getByTestId('venture-section').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))
  check('J 벤처 준비 패키지: 9칸 · ✓/△/? · 해결 문제는 대표 확인(지어내지 않음)', states.length === 9 && states.every((x) => ['ok', 'partly', 'ask'].includes(x)) && (await page.locator('[data-testid="venture-section"][data-id="problem"]').getAttribute('data-state')) === 'ask', states)
  // 고객용 진단 요약
  await page.goto(BASE + '/tools/cert-os?client=cli_wooil', { waitUntil: 'networkidle' })
  await page.getByTestId('cert-summary-open').click()
  await page.waitForTimeout(300)
  const sumText = await page.getByTestId('cert-summary-preview').innerText()
  check('L 고객용 진단 요약: 검토 · 추천 · 이유 · 준비 · 자료 · 혜택 · 순서 · 유의', ['검토한 인증', '유의사항'].every((w) => sumText.includes(w)) && (await page.getByTestId('cert-summary-section').count()) >= 5)
  check('L 고객용 요약에 내부 정보 없음(실사 · 대표 답 · 체납 · 내부 · 점수)', !/실사|대표 답|체납|내부|650|700점|%/.test(sumText), sumText.slice(0, 400))
  await page.getByTestId('cert-summary-copy').click()
  await page.waitForTimeout(200)
  check('L 복사 · 인쇄 종이(같은 내용)', /기업인증 진단 요약/.test(await page.evaluate(() => navigator.clipboard.readText())) && (await page.getByTestId('cert-summary-print').count()) === 1)
  await page.keyboard.press('Escape')
  // E — 만료된 인증은 보유 중으로 안 보인다
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    const c = list.find((x) => x.id === 'cli_wooil')
    c.customFields = [...(c.customFields ?? []), { id: 'cf_v', group: 'credential', label: '벤처기업확인서', value: '확인번호 20230101 · 확인일 2023-01-01 · 2025-12-31까지' }]
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(list))
  })
  await page.goto(BASE + '/tools/cert-os?client=cli_wooil', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const vCard = page.locator('[data-testid="cert-card"][data-key="venture"]')
  check('E 벤처 만료(2025-12-31): 보유 중 아님 · 이전 인증 만료 표시', (await vCard.getByTestId('cert-rec').getAttribute('data-rec')) !== 'held' && (await vCard.getByTestId('cert-expired').count()) === 1 && /이전 인증 만료/.test(await vCard.getByTestId('cert-oneline').innerText()))
  // F — 빈 업체: 날짜 · 사실을 만들지 않는다
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    const now = new Date().toISOString()
    list.push({ ...list[0], id: 'cli_empty', companyName: '빈상사', representativeName: '', businessNumber: '', corporateNumber: '', establishedAt: '', industry: '', businessCategory: '', businessItem: '', employeeCount: '', customFields: [], factValues: {}, factMeta: {}, factInbox: [], documents: {}, customDocuments: [], toolResults: [], activity: [], fees: [], sales: null, createdAt: now, updatedAt: now })
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(list))
  })
  await page.goto(BASE + '/tools/cert-os/innobiz?client=cli_empty', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.getByTestId('cert-basis').locator('summary').click()
  const fStates = await page.getByTestId('cert-basis-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))
  check('F 빈 업체: 근거 전부 모름 · 갱신 줄 없음 · 추가 확인 필요', fStates.length > 0 && fStates.every((x) => x === 'missing') && (await page.getByTestId('cert-renewal').count()) === 0 && (await page.getByTestId('cert-rec').first().getAttribute('data-rec')) === 'need_info', fStates)
  check('공식 출처: 상이 표시는 없고 미확인 1가지만(Kibo 항목별 배점)', (await page.getByTestId('cert-conflict').count()) === 0)

  // P1 릴리스 — 확인서 PDF 로 들어온 인증(회사 정보 인증서 칸)은 진행 기록 없이도 인증 완료로 · 고쳐 저장해도 칸 1개
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    const c = list.find((x) => x.id === 'cli_daum')
    c.customFields = [...(c.customFields ?? []).filter((f) => !/이노비즈/.test(f.label)), { id: 'cf_ib', group: 'credential', label: '이노비즈', value: '확인번호 260315-00123 · 확인일 2026-03-15 · 2029-03-14까지 · 중소벤처기업부' }]
    localStorage.setItem('axmvp.v1.operations_clients', JSON.stringify(list))
  })
  await page.goto(BASE + '/tools/cert-os/innobiz?client=cli_daum', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByTestId('cert-step-2').click()
  check('릴리스: 확인서로 들어온 이노비즈 → 진행 기록 인증 완료(회사 정보) · 갱신 줄', (await page.getByTestId('cert-life-done').getAttribute('data-source')) === 'profile' && (await page.getByTestId('cert-renewal').count()) === 1)
  await page.getByTestId('cert-life-edit').click()
  check('릴리스: 고치기 칸에 확인서 값이 미리(번호 · 인증일 · 끝날짜)', (await page.getByTestId('cert-complete-number').inputValue()) === '260315-00123' && (await page.getByTestId('cert-complete-date').inputValue()) === '2026-03-15' && (await page.getByTestId('cert-complete-valid').inputValue()) === '2029-03-14')
  await page.getByTestId('cert-complete-save').click()
  await page.waitForTimeout(800)
  await page.getByTestId('cert-life-edit').click()
  await page.getByTestId('cert-complete-save').click()
  await page.waitForTimeout(800)
  const daum = await recOf('cli_daum')
  const ibFields = (daum.customFields ?? []).filter((f) => f.group === 'credential' && /이노비즈/.test(f.label))
  check('릴리스: 두 번 저장해도 인증서 칸 1개(기관 남음) · 갱신 결과 1개', ibFields.length === 1 && ibFields[0].value.includes('중소벤처기업부') && (daum.toolResults ?? []).filter((t) => t.toolKey === 'cert-os').length === 1, { ibFields, n: (daum.toolResults ?? []).filter((t) => t.toolKey === 'cert-os').length })

  // 업체 상세 모듈 입구
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check('업체 상세: 모듈 입구에 기업인증 확인하기', (await page.locator('a[href*="/tools/cert-os?client=cli_hansol"]').count()) >= 1)
  check('JS 오류 없음', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---------------- 휴대폰 360 · 390 · 430 · 큰 글자 ---------------- */
for (const vp of [
  ...[360, 390, 430].flatMap((w) => ['normal', 'large', 'extra_large'].map((s) => ({ w, s }))),
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
  const tinyNow = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('main button, main a, main [role="radio"], main summary')]
        .filter((el) => el.closest('[data-testid^="cert"],[data-testid^="selfcheck"],[data-testid^="flow"],[data-testid^="venture"],[data-testid^="owner"],[data-testid^="pack"],[data-testid^="submit"]'))
        .map((el) => [el.getBoundingClientRect(), (el.getAttribute('data-testid') || el.textContent || '').trim().slice(0, 20)])
        .filter(([r]) => r.width > 0 && r.height > 0 && r.height < 43.5)
        .map(([r, t]) => `${t}(${Math.round(r.height)})`),
    )

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
      worst = Math.max(worst, await overflowX(page))
      await page.getByTestId('cert-step-2').click()
      await page.getByTestId('cert-prep-pack').click()
      await page.getByTestId('pack-question').first().locator('summary').click()
      worst = Math.max(worst, await overflowX(page))
      if (vp.w < 1000) { const t = await tinyNow(); if (t.length) small.push(`pack:${t.join(',')}`) }
      await page.getByTestId('pack-close').click()
      await page.getByTestId('cert-gate-open').click()
    }
    if (sec === 'venture') {
      await page.getByTestId('cert-step-2').click()
      await page.getByTestId('cert-venture-pack').click()
    }
    worst = Math.max(worst, await overflowX(page))
    if (vp.w < 1000) {
      const tiny = await tinyNow()
      if (tiny.length) small.push(`${sec}:${tiny.join(',')}`)
    }
  }
  check(`${vp.w}px · 글자 ${vp.s}: 기업인증 6화면 가로 넘침 0`, worst <= 0, worst)
  if (vp.w < 1000) check(`${vp.w}px · 글자 ${vp.s}: 누르는 곳 44px 이상(카드 · 칩 · 단추)`, small.length === 0, small)
  check(`${vp.w}px · 글자 ${vp.s}: JS 오류 없음`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(`\ncert e2e: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
