/**
 * qa:ventureplan — D-246 벤처 사업계획서 쓰기(기업인증 › 벤처 · ?plan=1). 실행: npm run qa:ventureplan -- http://localhost:4390 [사진 폴더]
 *  - 벤처 '무엇을 준비하나요?' · 다른 작업 → 사업계획서 쓰기 · 돌아가기
 *  - 재료: 명세서(MD) 올리기 → 요약 · 청구항 수 · 되돌리기 / AX · 메모 저장
 *  - 회사 기록으로 채우기(기술명 · 연구조직 · 지식재산권 출원중 · 핵심 요약 지식재산권 문장) · 이미 적은 칸은 그대로
 *  - 칸: 문장 틀 · 글자 수 · 넘음 · 체크박스 · 상태(확인함 · 사이트에 넣음) · 복사 · 새로고침해도 그대로
 *  - 점검 · 그 칸으로 · 한 장(MD) 내려받기 · 제출 전 확인 '사업계획' 줄
 *  - AI 초안(대표 · 서버 흉내): D-270 기획 방향 5개(순위 · 이유 · 제일 좋은 것 · 더 짜내기 · 고르기) → D-263 요약 전 3가지(시장조사 · 출원번호 · 기술인력 — 직접 넣기)
 *    → [요약 쓰기] 요약 → 자체점검 ① → [본문 쓰기] 본문 5묶음 → 자체점검 ②(절차마다 단추 · [전부 써줘] 없음)
 *    · 대표 /자체점검 정의 · 504 저절로 다시 · 답 모양 어긋남 다시 · 고친 칸은 덮지 않고 새 안 · 실패한 단계만 다시 · 확인할 점
 *  - 360 · 390 · 430 · 글자 아주 크게에서 가로 넘침 0 · JS 오류 0
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.argv[3] ?? ''
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail !== undefined ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 400)}` : ''}`)
}
const shot = async (page, name, full = true) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full })
}
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const CLIENT = 'cli_hansol'
const PLAN = `/tools/cert-os/venture?client=${CLIENT}&plan=1`

// 시험용 명세서(실제 발명 아님)
const SPEC_MD = [
  '【발명의 설명】', '【발명의 명칭】', '공구 마모 예측 기반 교체시점 산출 시스템 및 방법{SYSTEM AND METHOD FOR ESTIMATING TOOL REPLACEMENT TIME}',
  '【기술분야】', '[0001] 본 발명은 공구 진동정보로 마모를 예측하는 시스템에 관한 것이다.',
  '【발명의 내용】', '【해결하고자 하는 과제】', '[0002] 마모량을 예측하는 것을 목적으로 한다.',
  '【과제의 해결 수단】', '[0003] 시스템(500)은 신호 정규화부(510)와 마모판정부(530)를 포함한다.',
  '【발명의 효과】', '[0004] 교체 시점을 미리 알 수 있다.',
  '【부호의 설명】', '500: 공구관리 시스템', '510: 신호 정규화부',
  '【청구범위】', '【청구항 1】', '진동신호를 측정항목으로 변환하는 신호 정규화부;를 포함하는 시스템.', '【청구항 2】', '청구항 1에 있어서, 마모판정부를 더 포함하는 시스템.', '【청구항 3】', '진동신호를 변환하는 단계;를 포함하는 방법.',
  '【요약서】', '【요약】', '공구 마모를 예측한다.',
].join('\n')

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- PC 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())

  // 입구 — 벤처 '무엇을 준비하나요?' 에 사업계획서 쓰기
  await page.goto(BASE + `/tools/cert-os/venture?client=${CLIENT}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.getByTestId('cert-step-1').click()
  await page.waitForTimeout(250)
  check('입구 1: 벤처 2단계(무엇을 준비하나요?)에 "받지 않고 여기서 바로 쓸 수 있어요"', (await page.getByTestId('cert-venture-plan-row').count()) === 1 && /여기서 바로 쓸 수 있어요/.test(await page.getByTestId('cert-venture-plan-row').innerText()))
  check('입구 1: Primary 단추는 여전히 하나(모자란 자료 요청)', (await page.locator('main button.bg-brand-600:visible').count()) <= 1)
  await page.getByTestId('cert-venture-plan-step1').click()
  await page.waitForURL(/plan=1/)
  await page.waitForTimeout(500)
  check('입구 1 → 같은 주소에 plan=1 · 사업계획서 화면', page.url().includes(`/tools/cert-os/venture?client=${CLIENT}&plan=1`) && (await page.getByTestId('vplan').count()) === 1)
  check('탭 6개(재료 → 요약 → 핵심 요약 → [1] → [2] → 점검) · 재료 없으면 재료부터', (await page.locator('[data-testid^="vplan-tab-"]').count()) === 6 && (await page.getByTestId('vplan-tab-mat').getAttribute('aria-selected')) === 'true' && /재료/.test(await page.getByTestId('vplan-next').innerText()))
  check('대표(로컬)에는 AI 초안 단추', (await page.getByTestId('vplan-ai-open').count()) === 1)
  check('예전 화면(특허+벤처 · /studio) 링크 없음', !/특허\+벤처/.test(await page.locator('main').innerText()) && (await page.locator('main a[href*="/studio"]').count()) === 0)
  await shot(page, 'vplan-01-materials-empty')

  // AI — D-252 대표 화면은 AI 판이 처음부터 펼쳐져 있다 · 재료 없으면 막는다
  check('AI: 판이 처음부터 펼쳐짐 · 재료 없으면 막고 재료 넣기로', (await page.getByTestId('vplan-ai').count()) === 1 && (await page.getByTestId('vplan-ai-need').count()) === 1 && (await page.getByTestId('vplan-ai-run').count()) === 0)

  // 재료 — 명세서 MD 올리기
  await page.getByTestId('vplan-spec-input').setInputFiles({ name: 'spec-test.md', mimeType: 'text/markdown', buffer: Buffer.from(SPEC_MD, 'utf8') })
  await page.waitForTimeout(900)
  const mat = await page.getByTestId('vplan-mat-patent').inputValue()
  check('재료: 명세서 → 명칭 · 청구항 3(독립 2) · 문단 번호 뗀 요약', /청구항 3개\(독립 2개\)/.test(await page.getByTestId('vplan-spec-info').innerText()) && mat.startsWith('[발명의 명칭] 공구 마모 예측') && mat.includes('[독립 청구항 3]') && !mat.includes('[0001]'), mat.slice(0, 200))
  check('재료: 파일 이름만 남김', (await page.getByTestId('vplan-spec-file').innerText()) === 'spec-test.md')
  await page.getByTestId('vplan-mat-ax').fill('실제로 만든 것: 관리자 화면 · 휴대폰 진동 입력 · 마모 경고(시험 3곳)\n계획: 교체 주문 자동화')
  await page.getByTestId('vplan-mat-memo').fill('거래처 49곳(2026-06, 대표 확인)')
  await page.getByTestId('vplan-mat-memo').blur()
  await page.waitForTimeout(1500)
  check('재료: AX · 메모 저장됨 표시', /저장됨/.test(await page.getByTestId('vplan-part-mat').innerText()))
  await shot(page, 'vplan-02-materials')

  // 회사 기록으로 채우기
  await page.getByTestId('vplan-fact-fill').click()
  await page.waitForTimeout(900)
  await page.getByTestId('vplan-tab-summary').click()
  await page.waitForTimeout(200)
  const techName = await page.locator('[data-testid="vplan-field"][data-id="tech_name"] [data-testid="vplan-input"]').inputValue()
  check('채우기: 신청기술명 = 특허 명칭', techName === '공구 마모 예측 기반 교체시점 산출 시스템 및 방법', techName)
  await page.getByTestId('vplan-tab-problem').click()
  await page.waitForTimeout(200)
  const ip = await page.locator('[data-testid="vplan-field"][data-id="ip_records"] [data-testid="vplan-text"]').inputValue()
  check('채우기: 지식재산권 = 출원중 · 번호는 출원 뒤 · 권리자 회사', /^특허\(국내\) \/ 출원중 \/ 공구 마모 예측.*\(출원 뒤 입력\)/.test(ip), ip)
  // 이미 적은 칸은 그대로
  await page.locator('[data-testid="vplan-field"][data-id="tech_name"]').count()
  await page.getByTestId('vplan-tab-summary').click()
  await page.locator('[data-testid="vplan-field"][data-id="tech_name"] [data-testid="vplan-input"]').fill('공구 마모 예측 교체시점 서비스')
  await page.locator('[data-testid="vplan-field"][data-id="tech_name"] [data-testid="vplan-input"]').blur()
  await page.waitForTimeout(800)
  await page.getByTestId('vplan-fact-fill').click()
  await page.waitForTimeout(700)
  check('채우기 다시: 사람이 고친 기술명은 그대로', (await page.locator('[data-testid="vplan-field"][data-id="tech_name"] [data-testid="vplan-input"]').inputValue()) === '공구 마모 예측 교체시점 서비스')

  // 핵심 요약 — 문장 틀 · 지식재산권 문장
  await page.getByTestId('vplan-tab-core').click()
  await page.waitForTimeout(200)
  const coreIp = await page.locator('[data-testid="vplan-field"][data-id="core_ip"] [data-testid="vplan-text"]').inputValue()
  check('핵심 요약 지식재산권: 회사 기록 숫자로(실적은 빈칸 표시)', /특허출원 등 \d+건의 지식재산권과/.test(coreIp) && /［n］건의 기술개발/.test(coreIp), coreIp)
  const prob = page.locator('[data-testid="vplan-field"][data-id="core_problem"]')
  await prob.getByTestId('vplan-template').click()
  await page.waitForTimeout(1600)
  const tpl = await prob.getByTestId('vplan-text').inputValue()
  check('핵심 요약: [문장 틀 넣기] → 사이트 빈칸 문장 · 빈칸 남음 경고', /니즈\(문제\)가 있는데/.test(tpl) && /빈칸/.test(await prob.getByTestId('vplan-issues').innerText()))
  await shot(page, 'vplan-03-core')

  // [1] — 서술 칸 · 글자 수 · 넘음 · 체크 · 상태 · 복사
  await page.getByTestId('vplan-tab-problem').click()
  await page.waitForTimeout(200)
  const bg = page.locator('[data-testid="vplan-field"][data-id="development_background"]')
  const humanText = '거래처 공장에서 공구 교체 시점을 감으로 정해 불량이 반복됩니다. '.repeat(30).trim()
  await bg.getByTestId('vplan-text').fill(humanText)
  await page.waitForTimeout(1600)
  check('서술: 1,000자 넘으면 빨간 글자 수 · 넘음(막지는 않음)', (await bg.getAttribute('data-over')) === 'true' && /넘음/.test(await bg.getByTestId('vplan-count').innerText()) && (await bg.getByTestId('vplan-text').inputValue()).length > 1000)
  await bg.getByTestId('vplan-text').fill(humanText.slice(0, 900))
  await page.waitForTimeout(1600)
  check('서술: 줄이면 넘음 사라짐 · 저장됨', (await bg.getAttribute('data-over')) === 'false' && /저장됨/.test(await bg.getByTestId('vplan-save-state').innerText()))
  await bg.locator('label', { hasText: '자주 발생하는 문제임' }).click()
  await bg.locator('label', { hasText: '시급히 해결되어야 하는 문제임' }).click()
  await page.waitForTimeout(600)
  check('체크박스: 두 개 고름', (await bg.locator('input[type="checkbox"]:checked').count()) === 2)
  await bg.getByTestId('vplan-copy').click()
  await page.waitForTimeout(300)
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  check('복사: 칸 글 그대로(사이트에 붙일 것)', clip === humanText.slice(0, 900).trim(), clip.slice(0, 60))
  await bg.getByTestId('vplan-status-entered').click()
  await page.waitForTimeout(600)
  check('상태: [사이트에 넣음] 눌림', (await bg.getAttribute('data-status')) === 'entered')
  const orgSel = page.locator('[data-testid="vplan-field"][data-id="rd_org"] [data-testid="vplan-choice"]')
  check('연구개발 조직: 사이트 선택지 그대로(고르기)', (await orgSel.locator('option').count()) === 7)

  // 새로고침해도 그대로
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.getByTestId('vplan-tab-problem').click()
  await page.waitForTimeout(250)
  const bg2 = page.locator('[data-testid="vplan-field"][data-id="development_background"]')
  check('새로고침: 글 · 체크 2 · 사이트에 넣음 그대로', (await bg2.getByTestId('vplan-text').inputValue()) === humanText.slice(0, 900) && (await bg2.locator('input[type="checkbox"]:checked').count()) === 2 && (await bg2.getAttribute('data-status')) === 'entered')
  check('새로고침: 재료가 있으면 요약 탭부터', true)
  check('진행 줄: 서술 1/10 · 사이트에 넣음 1', /서술 1\/10/.test(await page.getByTestId('vplan-progress').innerText()) && /사이트에 넣음 1\//.test(await page.getByTestId('vplan-progress').innerText()))

  // 점검 · 그 칸으로 · MD
  await page.getByTestId('vplan-tab-check').click()
  await page.waitForTimeout(250)
  const warnRows = page.locator('[data-testid="vplan-check-row"][data-level="warn"]')
  check('점검: 빈칸 남은 핵심 요약 → 고칠 것', (await warnRows.count()) >= 1 && /핵심 요약 문제/.test(await page.getByTestId('vplan-check-warn').innerText()))
  await warnRows.first().getByRole('button', { name: '그 칸으로' }).click()
  await page.waitForTimeout(500)
  check('점검: [그 칸으로] → 그 탭 · 그 칸', (await page.getByTestId('vplan-tab-core').getAttribute('aria-selected')) === 'true')
  await page.getByTestId('vplan-tab-check').click()
  await page.waitForTimeout(200)
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('vplan-md').click()])
  const mdPath = await dl.path()
  const md = readFileSync(mdPath, 'utf8')
  check('한 장(MD): 파일 이름(영문 — 한글 이름은 일부 브라우저에서 download 로 바뀜) · 회사명 제목 · 사이트 순서 · 체크 · 글자 수', /^venture-plan-\d{8}\.md$/.test(dl.suggestedFilename()) && md.startsWith('# ') && md.indexOf('## 사업계획서 요약') < md.indexOf('## [1] 문제정의') && md.includes('체크: 시급히 해결되어야 하는 문제임 · 자주 발생하는 문제임') && /_\(\d{3}자\)_/.test(md), { name: dl.suggestedFilename(), head: md.slice(0, 120), checks: /체크: [^\n]*/.exec(md.slice(md.indexOf('개발 배경')))?.[0] })
  await shot(page, 'vplan-04-check')

  // AI 초안(서버 흉내) — D-263 요약 전 3가지(시장조사 · 출원번호 · 기술인력) → 요약 → 자체점검 ① → 본문 5묶음 → 자체점검 ②
  const sent = []
  let p2Calls = 0
  let g2Calls = 0
  let judgeSumCalls = 0
  let marketCalls = 0
  // 첫 시장조사는 검색 근거가 없어 숫자 없이 산식만(실제 모델이 그렇게 답했다 — D-263 모의 실행)
  const MARKET_EMPTY = [
    { title: 'tam', amount: '', detail: '검색 근거 없음 — 확인 필요 · 산식: 금형 · 기계가공 사업체 수 × 연 단가' },
    { title: 'sam', amount: '', detail: '검색 근거 없음 — 확인 필요' },
    { title: 'som', amount: '', detail: '3년 목표 고객 수 · 단가 없음 — 확인 필요' },
    { title: 'customer', detail: '공구 교체를 관리하는 제조 현장' },
  ]
  const SKILL = '/자체점검 — 대표정의표식: 숫자 하나라도 어긋나면 P0, 출원을 보유라고 쓰면 P0'
  const body = (id) => '본문 ' + id + ' — 특허의 신호 정규화부가 MVP 의 휴대폰 진동 입력으로 구현됩니다.'
  const ITEMS = {
    'venture.market': [
      { title: 'tam', amount: '1조 2,000억 원', detail: '국내 금속가공 제조업체 4만 곳 × 연 300만 원', tag: '통계청 광업제조업조사 2024', when: '2024' },
      { title: 'sam', amount: '1,800억 원', detail: '절삭 공구를 쓰는 중소 제조 6천 곳 × 연 300만 원', tag: '중소벤처기업부 2024', when: '2024' },
      { title: 'som', amount: '36억 원', detail: '3년 안 120곳 × 3,000만 원(추정)', tag: '회사 영업 계획', when: '2029' },
      { title: 'cagr', amount: '', detail: '검색 근거 없음 — 확인 필요' },
      { title: 'customer', body: '절삭 공구를 쓰는 중소 금속가공 업체' },
    ],
    'venture.p1': [
      { title: 'development_background', body: body('배경'), tag: '많은 사람들이 겪고 있는 문제임', detail: '불량률 숫자 출처 확인' },
      { title: 'competitiveness_strategy', body: body('경쟁력'), tag: '기존제품 대비 고성능, 기존 제품 대비 편리함', detail: '' },
    ],
    'venture.p2': [{ title: 'technology_progress', body: body('경과') }, { title: 'technology_plan_3y', body: body('3년') }],
    'venture.g1': [{ title: 'market_target', body: body('시장') }, { title: 'competitor_analysis', body: body('경쟁사') }],
    'venture.g2': [{ title: 'market_entry_progress', body: body('진입 경과') }, { title: 'market_entry_plan_3y', body: body('진입 3년') }],
    'venture.x': [{ title: 'entrepreneurship_example', body: body('기업가') }, { title: 'financing_plan', body: body('자금'), tag: '영업이익, 정부지원(창업지원)' }],
    // D-270 기획 방향 — 5개 · 견주기(후보 3 이 1순위) · 더 짜내기(새 2개)
    'venture.plan': [
      { title: '공구 마모 예측 현장 앱 — 중소 금속가공', outline: ['특허의 신호 정규화부가 MVP 의 휴대폰 진동 입력으로 구현됨', '절삭 공구를 쓰는 중소 금속가공 업체', '교체 시점을 진동으로 미리 알림', '시험 3곳 · 거래처 49곳', '3년 120곳', '실제 사용 고객 수 확인'], detail: '재료의 시험 3곳 · 메모의 거래처 49곳에서', amount: '86', tag: '1순위', when: '특허와 MVP 가 같은 이야기 · 시험 고객 있음' },
      { title: '공구 교체 일정 SaaS — 다품종 소량 공장', outline: ['마모 판정부가 일정 화면으로', '다품종 소량 생산 공장', '교체와 일정을 함께', '시험 1곳', '3년 60곳', '일정 기능은 계획'], detail: '메모', amount: '74', tag: '2순위', when: '일정 기능이 아직 계획' },
      { title: '설비 보전 데이터 플랫폼', outline: ['진동 데이터 수집', '설비 보전 팀', '데이터 통합', '증거 약함', '3년 확장', '특허와 거리'], detail: '메모', amount: '61', tag: '3순위', when: '특허와 MVP 가 따로 놂' },
      { title: '공구 재고 연동 서비스', outline: ['마모 예측 + 재고', '공구 유통사', '발주 시점', '없음', '유통 확장', '고객 없음'], detail: '메모', amount: '52', tag: '후보', when: '고객 없음' },
      { title: '작업자 안전 알림', outline: ['진동 이상 감지', '안전 관리자', '알림', '없음', '규제 수요', '특허와 무관'], detail: '메모', amount: '40', tag: '후보', when: '특허와 무관' },
    ],
    'venture.planRank': [{ title: '후보 1', amount: '88', tag: '2순위', when: '시험 고객은 있으나 차별이 약함' }, { title: '후보 2', amount: '93', tag: '1순위', when: '일정 연결이 경쟁사가 피하기 어려움' }, { title: '후보 3', amount: '60' }, { title: '후보 4', amount: '50' }, { title: '후보 5', amount: '35' }],
    'venture.planMore': [
      { title: '공구 마모 예측 + 교체 배치 대행 — 시험 고객 확장', outline: ['신호 정규화부 + 마모 판정부가 앱과 대행 서비스로', '시험 3곳의 거래처', '예측과 대행을 묶음', '시험 3곳', '3년 150곳', '대행 단가 확인'], detail: '시험 3곳에서', amount: '90', tag: '새 방향', when: '지금 고객에서 바로 넓힘' },
      { title: '금형 공장 전용 공구 수명 리포트', outline: ['마모 판정 리포트', '금형 공장', '리포트 자동화', '없음', '3년 40곳', '금형 고객 확인'], detail: '메모', amount: '58', tag: '새 방향', when: '다른 시장' },
    ],
    'venture.sum': ['tech_name', 'tech_summary', 'core_problem', 'core_solution', 'core_market', 'core_diff', 'core_marketing', 'core_growth'].map((id) => ({ title: id, body: id === 'tech_name' ? 'AI 가 고른 이름' : body(id) })),
  }
  const judgeItems = (req) => {
    if (String(req.context?.purpose ?? '').includes('요약')) {
      judgeSumCalls += 1
      return judgeSumCalls === 1
        ? [{ title: 'score', amount: '84', detail: 'A9 B8 C9 D7 E8 F7 G9 H9 I9 J9' }, { title: 'verdict', tag: 'P0', detail: '출원 중인데 "특허 보유" 로 읽힘', body: '차별성 칸을 출원 상태로 고침' }, { title: 'core_diff', body: 'JUDGE 고친 차별성 — 출원(10-2026-0012345) 중인 신호 정규화 구조로 기존 주기 교체와 다름' }]
        : [{ title: 'score', amount: '93', detail: 'A9 B9 C9 D9 E9 F9 G10 H9 I10 J10' }]
    }
    return [{ title: 'score', amount: '94', detail: 'A10 B9 C9 D9 E9 F10 G9 H10 I9 J10' }, { title: 'verdict', tag: '대표 확인', detail: '3년 고객 수 근거', body: '지금 거래처 49곳이 맞나요?' }, { title: 'market_target', body: 'JUDGE 고친 목표시장 — TAM 1조 2,000억 원 · SAM 1,800억 원 · SOM 36억 원(3년)' }]
  }
  // D-271 기획 대화 — 첫 번: 이해 · 의견 · 질문 / 대표가 한 번 답하면 '충분'
  const talkItems = (req) =>
    (JSON.stringify(req.context ?? '').match(/대표 답:/g) ?? []).length
      ? [{ tag: '의견', title: '중소 금속가공 현장 앱', detail: '시험 3곳이 있어 증거가 됨' }, { tag: '충분', title: '고객 · 핵심 기술 · 증거가 정해져 방향을 낼 수 있습니다' }]
      : [
          { tag: '이해', title: '절삭 공구 마모를 휴대폰 진동으로 알려 주는 MVP 를 가진 회사', detail: '명세서 · AX 재료' },
          { tag: '의견', title: '일반 설비 모니터링 플랫폼', detail: '너무 흔하고 특허와 거리가 멂' },
          { tag: '의견', title: '공구 마모 예측 현장 앱', detail: '특허와 MVP 가 같은 이야기 — 다만 고객이 정해져야' },
          { tag: '질문', title: '누구에게 먼저 파시겠어요?', detail: '목표 고객이 정해져야 줄거리가 섭니다', outline: ['중소 금속가공 업체', '대기업 협력사', '공구 유통사', '잘 모르겠어요 — AI 가 정해 주세요'] },
        ]
  await page.route('**/api/ai-assist', async (route) => {
    const req = JSON.parse(route.request().postData() || '{}')
    sent.push(req)
    if (req.assistId === 'venture.p2' && p2Calls++ === 0) return route.fulfill({ status: 504, contentType: 'text/html', body: '<html>timeout</html>' })
    const items = req.assistId === 'venture.talk' ? talkItems(req) : req.assistId === 'venture.judge' ? judgeItems(req) : req.assistId === 'venture.market' && marketCalls++ === 0 ? MARKET_EMPTY : req.assistId === 'venture.g2' && g2Calls++ < 3 ? [] : (ITEMS[req.assistId] ?? [])
    const run = { requestId: req.requestId, assistId: req.assistId, page: req.page, provider: 'gemini', model: 'test-model', status: 'succeeded', structured: { headline: 'x', items }, raw: '', usage: { input: 1, output: 1, total: 2 }, estimatedCostUsd: null, ms: 5, sent: { userChars: 1, rows: 1, rowsCut: 0 }, createdAt: new Date().toISOString(), grounded: req.assistId === 'venture.market' && marketCalls !== 2, sources: req.assistId === 'venture.market' && marketCalls !== 2 ? [{ title: '통계청', url: 'https://kosis.kr/x' }] : [] }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, run }) })
  })
  const row = (k) => page.locator(`[data-testid="vplan-ai-row"][data-key="${k}"]`)
  const planAiRow = (k) => page.locator(`[data-testid="vplan-plan-row"][data-key="${k}"]`)
  const vIdle = () => page.waitForFunction(() => !document.querySelector('[data-testid="vplan-ai"] button[disabled][data-testid^="vplan-plan-"]') && ![...document.querySelectorAll('[data-testid="vplan-plan-row"]')].some((e) => e.getAttribute('data-phase') === 'run'), null, { timeout: 20000 })

  // D-270 기획 방향 먼저 — 대표: "벤처도 마찬가지 · 기획이 제일 중요"
  // 대표 /자체점검 정의 — 기획 단추에도 같이 가야 한다(아래에서 한 번 더 저장해도 같음)
  await page.getByTestId('vplan-ai').getByTestId('judge-skill-open').click()
  await page.getByTestId('judge-skill-sheet').waitFor()
  await page.getByTestId('judge-skill-text').fill(SKILL)
  await page.getByTestId('judge-skill-save').click()
  await page.waitForTimeout(400)
  check('V0 재료가 있으면 차례 "기획 방향" · [AI 와 기획 시작] · [묻지 말고 방향 5개 내줘] · 요약 전 3가지 · 쓰기 단추 · [전부 써줘] 는 아직 없음', (await page.getByTestId('vplan-ai').getAttribute('data-phase')) === 'plan' && (await page.getByTestId('vplan-talk-start').isVisible()) && (await page.getByTestId('vplan-plan-run').isVisible()) && (await page.getByTestId('vplan-gate').count()) === 0 && (await page.getByTestId('vplan-ai-next').count()) === 0 && (await page.getByTestId('vplan-ai-run').count()) === 0 && /기획부터/.test(await page.getByTestId('vplan-ai-head').innerText()))
  check('V0b 방향을 고르기 전에는 [이것만 써줘] 도 막힘(시장조사만 됨)', (await row('p1').getByTestId('vplan-ai-one').isDisabled()) && /기획 방향부터/.test(await row('p1').innerText()) && !(await row('market').getByTestId('vplan-ai-one').isDisabled()))
  // D-271 기획 대화 — 의견 · 질문(누를 답) → 답 → '충분' → 그 대화대로 방향 5개
  { const l289 = page.getByTestId('vplan-talk-start'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.getByTestId('vplan-talk-option').first().waitFor({ timeout: 20000 })
  await vIdle()
  const vt1 = sent.filter((r) => r.assistId === 'venture.talk')
  const vOpts = await page.getByTestId('vplan-talk-option').allInnerTexts()
  check('V0c [AI 와 기획 시작] → 재료(명세서 · AX)를 읽고 회사 이해 · 의견 2(흔한 것 · 약한 점) · 질문 하나 · 누를 답 4개(마지막 "AI 가 정해 주세요") · 대표 /자체점검 정의 같이', vt1.length === 1 && !JSON.stringify(vt1[0].context).includes('대표 답:') && JSON.stringify(vt1[0].context).includes('휴대폰') && /휴대폰 진동/.test(await page.getByTestId('vplan-talk-understanding').innerText()) && /너무 흔하고/.test(await page.getByTestId('vplan-talk-opinions').innerText()) && /누구에게 먼저/.test(await page.getByTestId('vplan-talk-question').innerText()) && vOpts.length === 4 && /AI 가 정해/.test(vOpts[3]) && vt1[0].skill === SKILL && (await planAiRow('talk').getAttribute('data-model')) === 'test-model', vOpts)
  await shot(page, 'vplan-04t-talk')
  { const l289 = page.getByTestId('vplan-talk-option').first(); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.getByTestId('vplan-plan-option').first().waitFor({ timeout: 20000 })
  await vIdle()
  const vt2 = sent.filter((r) => r.assistId === 'venture.talk')
  const vPlanReq = sent.find((r) => r.assistId === 'venture.plan')
  check('V0d 답을 누르면 다음 부름에 "대표 답: 중소 금속가공 업체" → AI 가 "충분" → 기다리지 않고 그 대화대로 방향 5개(방향 자료에 기획 대화 · "대표 답을 반드시 따른다")', vt2.length === 2 && JSON.stringify(vt2[1].context).includes('대표 답: 중소 금속가공 업체') && (vPlanReq?.context?.sections ?? []).some((x) => x.name === '기획 대화' && JSON.stringify(x.rows).includes('대표 답: 중소 금속가공 업체')) && (vPlanReq?.context?.rules ?? []).some((r) => /대표 답을 반드시 따른다/.test(r)) && /기획 대화 1번/.test(await page.getByTestId('vplan-talk').innerText()), vt2.map((r) => r.assistId))
  const opts = await page.getByTestId('vplan-plan-option').evaluateAll((els) => els.map((e) => ({ picked: e.getAttribute('data-picked'), text: e.textContent })))
  check('V1 기획 방향 5개 — 1순위(86점) · 순위 이유 · 고객 · 회사 근거 · 1순위가 골라져 있음 · 모델 표시', opts.length === 5 && /1순위/.test(opts[0].text) && /86점/.test(opts[0].text) && /1순위인 이유 · 특허와 MVP 가 같은 이야기/.test(opts[0].text) && /고객 · 절삭 공구를 쓰는/.test(opts[0].text) && /회사 근거/.test(opts[0].text) && opts[0].picked === 'yes' && (await planAiRow('plan').getAttribute('data-model')) === 'test-model', opts.map((o) => o.text?.slice(0, 30)))
  await shot(page, 'vplan-05p-plans')
  { const l289 = page.getByTestId('vplan-plan-rank'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.waitForFunction(() => document.querySelector('[data-testid="vplan-plan-row"][data-key="planRank"]')?.getAttribute('data-phase') === 'done', null, { timeout: 20000 })
  const afterRank = await page.getByTestId('vplan-plan-option').evaluateAll((els) => els.map((e) => ({ picked: e.getAttribute('data-picked'), text: e.textContent })))
  check('V2 [이 중 제일 좋은 게 뭐야?] → 후보를 보내 견줌 → 일정 SaaS 93점이 1순위 · 골라짐', /공구 교체 일정 SaaS/.test(afterRank[0].text) && /93점/.test(afterRank[0].text) && afterRank[0].picked === 'yes' && /후보 5/.test(JSON.stringify(sent.find((r) => r.assistId === 'venture.planRank')?.context ?? '')), afterRank.map((o) => o.text?.slice(0, 20)))
  { const l289 = page.getByTestId('vplan-plan-more'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.waitForFunction(() => document.querySelector('[data-testid="vplan-plan-row"][data-key="planMore"]')?.getAttribute('data-phase') === 'done', null, { timeout: 20000 })
  const afterMore = await page.getByTestId('vplan-plan-option').evaluateAll((els) => els.map((e) => ({ fresh: e.getAttribute('data-fresh'), text: e.textContent })))
  check('V3 [자체점검으로 더 짜내기] → 새 방향 2개 "새로 · 자체점검" · 점수 순(90점 2순위) · 7개', afterMore.length === 7 && afterMore.filter((o) => o.fresh === 'yes').length === 2 && /교체 배치 대행/.test(afterMore[1].text) && /새로 · 자체점검/.test(afterMore[1].text), afterMore.map((o) => o.text?.slice(0, 20)))
  const planSkill = sent.filter((r) => /^venture\.plan/.test(r.assistId)).every((r) => r.skill === SKILL)
  check('V3b 기획 · 견주기 · 짜내기 모두 대표 /자체점검 정의를 같이 보냄', planSkill && sent.filter((r) => /^venture\.plan/.test(r.assistId)).length === 3)
  // 1순위가 아닌 '현장 앱'(3순위)을 골라 시작
  const pick = page.getByTestId('vplan-plan-option').filter({ hasText: '공구 마모 예측 현장 앱' })
  await pick.getByTestId('vplan-plan-pick').click()
  await page.getByTestId('vplan-plan-start').click()
  await page.getByTestId('vplan-gate').waitFor({ timeout: 10000 })
  check('V4 [이걸로 시작하자] → 고른 방향 띠 · 다음 차례 "요약 전 3가지" · [다른 방향으로]', (await page.getByTestId('vplan-ai').getAttribute('data-phase')) === 'gate' && /공구 마모 예측 현장 앱/.test(await page.getByTestId('vplan-plan-chosen').innerText()) && (await page.getByTestId('vplan-plan-back').isVisible()) && (await page.getByTestId('vplan-steps').getAttribute('data-phase')) === 'gate')
  await shot(page, 'vplan-05q-chosen', false)
  const planEnd = sent.length
  const mine = () => sent.slice(planEnd)
  check('AI 차례 9줄 — 시장조사 → 요약 → 자체점검 ① → 본문 5묶음 → 자체점검 ②', (await page.getByTestId('vplan-ai-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')).join())) === 'market,sum,judgeSum,p1,p2,g1,g2,x,judgeAll')
  check('요약 전 3가지 — 처음엔 다 모름(시장조사 · 출원번호 없음) · 요약 줄 "요약 전에 먼저" · [이것만 써줘] 막힘', (await page.getByTestId('vplan-gate').getAttribute('data-ok')) === 'no' && (await page.getByTestId('vplan-gate-market').getAttribute('data-ok')) === 'no' && (await page.getByTestId('vplan-gate-patent').getAttribute('data-ok')) === 'no' && /요약 전에 먼저/.test(await row('sum').innerText()) && (await row('sum').getByTestId('vplan-ai-one').isDisabled()))
  // 기술인력 — 칩 두 번(전담부서 · 2명)
  await page.locator('[data-testid="vplan-gate-org"][data-org="연구개발전담부서"]').click()
  await page.waitForTimeout(300)
  await page.locator('[data-testid="vplan-gate-staff"][data-n="2"]').click()
  await page.waitForTimeout(400)
  check('기술인력 — [연구개발전담부서] [2명] 두 번 누르면 ✓ · 조직 칸(사이트 선택지)에도 같은 값', (await page.getByTestId('vplan-gate-rd').getAttribute('data-ok')) === 'yes' && /연구개발전담부서 · 연구개발 인원 2명/.test(await page.getByTestId('vplan-gate-rd').innerText()))
  // 대표 /자체점검 정의 — 기획 단계 앞에서 붙여 넣었다
  check('자체점검 기준 — 대표 기준 붙여 넣고 저장 → 단추에 "대표 기준"', /자체점검 기준 · 대표 기준/.test(await page.getByTestId('vplan-ai').getByTestId('judge-skill-open').innerText()))
  await shot(page, 'vplan-05a-gate')
  // 출원번호 모르고 [AI로 시장조사] → 시장조사만 · 요약 쓰기 단추는 아직 없음
  check('요약 전 3가지가 다 안 되면 [요약 쓰기] 단추가 없음', (await page.getByTestId('vplan-ai-next').count()) === 0)
  { const l289 = page.getByTestId('vplan-gate-market-run'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.waitForFunction(() => document.querySelector('[data-testid="vplan-ai-row"][data-key="market"]')?.getAttribute('data-phase') === 'fail', null, { timeout: 20000 })
  await page.waitForTimeout(400)
  check('시장조사 숫자 · 출원번호를 모르면 시장조사만 하고 요약 앞에서 멈춤 — "요약 전에 먼저 — 시장조사 · 출원번호" · 다른 단계 안 부름', mine().map((r) => r.assistId).join() === 'venture.market' && /요약 전에 먼저 — 시장조사\(TAM · SAM · SOM\) · 출원번호/.test(await row('sum').innerText()) && (await row('p1').getAttribute('data-phase')) === '', { sent: mine().map((r) => r.assistId), sum: await row('sum').innerText() })
  check('숫자 없이 산식만 온 시장조사 — 다시 부르지 않고(1번) "TAM · SAM · SOM 숫자를 찾지 못했습니다" · 숫자 칸이 저절로 열리고 AI 산식이 보임', marketCalls === 1 && /TAM · SAM · SOM 숫자를 찾지 못했습니다/.test(await row('market').innerText()) && (await page.getByTestId('vplan-gate-market-form').isVisible()) && /AI 산식 · .*사업체 수 × 연 단가/.test(await page.getByTestId('vplan-gate-tam-basis').innerText()), { calls: marketCalls, row: await row('market').innerText() })
  await shot(page, 'vplan-05b-market-empty', false)
  // 두 번째 조사는 검색 근거 없이 AI 추정 숫자 → 대표가 한 번 확인해야 요약으로
  { const l289 = page.getByTestId('vplan-gate-market-run'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.waitForFunction(() => document.querySelector('[data-testid="vplan-ai-row"][data-key="market"]')?.getAttribute('data-phase') === 'done', null, { timeout: 15000 })
  await page.waitForTimeout(300)
  check('검색 근거 없는 AI 추정 숫자 — 시장조사 ✓ 아님 · "AI 추정 · 맞으면 [이 숫자로 확인]" · 숫자 칸 열림(새 숫자)', (await page.getByTestId('vplan-gate-market').getAttribute('data-ok')) === 'no' && /AI 추정\(검색 근거 없음\)/.test(await page.getByTestId('vplan-gate-market').innerText()) && (await page.getByTestId('vplan-gate-market-confirm').isVisible()) && (await page.getByTestId('vplan-gate-tam').inputValue()) === '1조 2,000억 원', await page.getByTestId('vplan-gate-market').innerText())
  await page.getByTestId('vplan-gate-market-confirm').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="vplan-gate-market"]')?.getAttribute('data-ok') === 'yes', null, { timeout: 15000 })
  await page.waitForTimeout(300)
  check('[이 숫자로 확인] → 시장조사 ✓ — TAM · SAM · SOM 숫자 · 대표 확인 숫자 · 시장조사는 대표 정의 안 보냄(자체점검 · 쓰기 단추만)', (await page.getByTestId('vplan-gate-market').getAttribute('data-ok')) === 'yes' && /TAM 1조 2,000억 원 · SAM 1,800억 원 · SOM 36억 원 · 대표 확인 숫자/.test(await page.getByTestId('vplan-gate-market').innerText()) && !mine()[0].skill && !mine()[1].skill && JSON.stringify(mine()[1].context).includes('거래처 49곳') && JSON.stringify(mine()[1].context).includes('고른 기획 방향'))
  await page.getByTestId('vplan-gate-patent-input').fill('10 2026 0012345')
  await page.getByTestId('vplan-gate-patent-save').click()
  await page.waitForTimeout(500)
  check('출원번호 직접 넣기 — 띄어 써도 10-2026-0012345 로 · 3/3 · 요약 막힘 풀림', (await page.getByTestId('vplan-gate').getAttribute('data-ok')) === 'yes' && /10-2026-0012345 · 직접 넣음/.test(await page.getByTestId('vplan-gate-patent').innerText()) && (await page.getByTestId('vplan-gate-count').innerText()) === '3/3' && !(await row('sum').getByTestId('vplan-ai-one').isDisabled()))
  // 이제 [요약 쓰기 — 자체점검 ① 까지] → 멈춤 → [요약 확인 — 본문 쓰기]
  const before = sent.length
  check('3가지가 다 되면 차례 "요약" · [요약 쓰기 — 자체점검 ① 까지]', (await page.getByTestId('vplan-ai').getAttribute('data-phase')) === 'sum' && /요약 쓰기 — 자체점검 ① 까지/.test(await page.getByTestId('vplan-ai-next').innerText()))
  { const l289 = page.getByTestId('vplan-ai-next'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.waitForFunction(() => document.querySelector('[data-testid="vplan-ai-next"]')?.getAttribute('data-step') === 'body' && !document.querySelector('[data-testid="vplan-ai-next"]')?.hasAttribute('disabled'), null, { timeout: 40000 })
  check('[요약 쓰기] → 요약 · 자체점검 ①(두 번) 까지만 쓰고 멈춤 · 다음 단추 "요약 확인 — 본문 5묶음 쓰기"', sent.slice(before).map((r) => r.assistId).join() === 'venture.sum,venture.judge,venture.judge' && /본문 5묶음 쓰기/.test(await page.getByTestId('vplan-ai-next').innerText()) && (await page.getByTestId('vplan-ai').getAttribute('data-phase')) === 'body', sent.slice(before).map((r) => r.assistId))
  await shot(page, 'vplan-05r-sum-done', false)
  { const l289 = page.getByTestId('vplan-ai-next'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('[data-testid="vplan-ai-row"]')]
    return rows.length === 9 && rows.every((e) => ['done', 'fail'].includes(e.getAttribute('data-phase') ?? '')) && !document.querySelector('[data-testid="vplan-ai-next"][disabled]')
  }, null, { timeout: 40000 })
  await page.waitForTimeout(600)
  const run2 = sent.slice(before)
  const phases = await page.getByTestId('vplan-ai-row').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-key')}:${e.getAttribute('data-phase')}`))
  check('AI: 요약 → 자체점검 ①(고친 뒤 다시 판정) → [본문 쓰기] 본문 5묶음 → 자체점검 ② · 시장조사 건너뜀 · g2 만 못 씀', run2.map((r) => r.assistId).join() === 'venture.sum,venture.judge,venture.judge,venture.p1,venture.p2,venture.p2,venture.g1,venture.g2,venture.g2,venture.g2,venture.x,venture.judge' && phases.join() === 'market:done,sum:done,judgeSum:done,p1:done,p2:done,g1:done,g2:fail,x:done,judgeAll:done', { sent: run2.map((r) => r.assistId), phases })
  const sumReq = run2[0]
  check('요약에 보낸 것 — 시장조사(TAM · 출처) · 출원번호(출원 중 · 등록 아님) · 연구개발 인원 2명 · 대표 정의', sumReq.context.sections.some((x) => x.name.startsWith('시장조사') && JSON.stringify(x.rows).includes('1조 2,000억 원') && JSON.stringify(x.rows).includes('통계청 광업제조업조사 2024')) && sumReq.context.facts.some((f) => f.includes('10-2026-0012345') && f.includes('등록 아님')) && sumReq.context.facts.some((f) => f.includes('연구개발 인원(확인): 2명')) && sumReq.skill === SKILL)
  const j1 = run2.filter((r) => r.assistId === 'venture.judge')
  check('자체점검 — 대표 정의 같이 감 · ① 은 요약 범위 · 두 번째 판정엔 자체점검이 고친 글이 들어감 · ② 는 전체', j1.length === 3 && j1.every((r) => r.skill === SKILL) && j1[0].context.purpose.includes('요약') && JSON.stringify(j1[1].context.sections).includes('JUDGE 고친 차별성') && j1[2].context.purpose.includes('전체'))
  check('잠깐 끊김(504) → 3초 쉬고 저절로 다시 · p2 씀(예전엔 실패로 멈춤)', run2.filter((r) => r.assistId === 'venture.p2').length === 2 && (await row('p2').getAttribute('data-phase')) === 'done')
  const g2s = run2.filter((r) => r.assistId === 'venture.g2')
  check('답 모양 어긋남 → 이름표를 알려 주고 두 번 더(ask) · 세 번 다 어긋나면 그 단계만 못 씀', g2s.length === 3 && !g2s[0].ask && g2s.slice(1).every((r) => /칸 id 그대로/.test(r.ask ?? '')), g2s.map((r) => r.ask ?? ''))
  const p1 = run2.find((r) => r.assistId === 'venture.p1')
  const secOf = (req, name) => req.context.sections.find((x) => x.name.startsWith(name))?.rows ?? []
  check('AI 보낸 것: page venture · 맨 앞 고른 기획 방향(현장 앱) · 명세서 재료 · AX · 이번 칸 규칙 · 출원 그대로 규칙 · "그 줄거리로"', p1.page === 'venture' && p1.context.sections[0].name.startsWith('고른 기획 방향') && JSON.stringify(p1.context.sections[0].rows).includes('공구 마모 예측 현장 앱') && JSON.stringify(secOf(p1, '특허 명세서')).includes('공구 마모 예측') && JSON.stringify(secOf(p1, 'AX · MVP')).includes('휴대폰 진동 입력') && p1.context.rules.some((r) => r.startsWith('칸 development_background')) && p1.context.rules.some((r) => r.includes('출원 상태 그대로')) && p1.context.rules.some((r) => r.includes('고른 기획 방향')))
  check('AI 보낸 것: 앞 묶음 결과가 다음 묶음의 "이미 쓴 칸" 으로', JSON.stringify(secOf(run2.filter((r) => r.assistId === 'venture.p2')[1], '이미 쓴 칸')).includes('본문 경쟁력'))
  check('V5 요약 · 자체점검에도 고른 기획 방향이 감', JSON.stringify(sumReq.context.sections[0]).includes('공구 마모 예측 현장 앱') && run2.filter((r) => r.assistId === 'venture.judge').every((r) => r.context.sections.some((x) => x.name.startsWith('고른 기획 방향'))))
  check('자체점검 ① 줄 — 93점 · 직접 고친 칸 · 고친 뒤 다시 판정 / ② 줄 — 94점', /93점/.test(await row('judgeSum').innerText()) && /차별점/.test(await row('judgeSum').innerText()) && /고친 뒤 다시 판정/.test(await row('judgeSum').innerText()) && /94점/.test(await row('judgeAll').innerText()), [await row('judgeSum').innerText(), await row('judgeAll').innerText()])
  check('판정 상자 — ② 94점 · 통과 · 자체점검이 고친 칸(목표시장) · 대표 기준 표시', (await page.getByTestId('vplan-judge').getAttribute('data-score')) === '94' && (await page.getByTestId('vplan-judge').getAttribute('data-pass')) === 'yes' && /목표시장/.test(await page.getByTestId('vplan-judge').innerText()) && /대표 기준/.test(await page.getByTestId('vplan-judge').innerText()))
  check('AI: 못 쓴 단계만 다시 단추', (await page.getByTestId('vplan-ai-retry').count()) === 1)
  { const l289 = page.getByTestId('vplan-ai-retry'); await l289.click(); await l289.page().waitForTimeout(450); await l289.click() } // D-289 AI 단추 두 번
  await page.waitForFunction(() => document.querySelector('[data-testid="vplan-ai-row"][data-key="g2"]')?.getAttribute('data-phase') === 'done', null, { timeout: 15000 })
  check('AI: 다시 → g2 씀 · 마지막 요청은 g2 하나', sent[sent.length - 1].assistId === 'venture.g2' && sent.length === before + run2.length + 1)
  check('AI: 확인해 달라는 점(본문 아님 · 자체점검의 대표 확인 질문) 보임', /불량률 숫자 출처 확인/.test(await page.getByTestId('vplan-ai-asks').innerText()) && /지금 거래처 49곳이 맞나요/.test(await page.getByTestId('vplan-ai-asks').innerText()))
  await shot(page, 'vplan-05-ai')
  await page.getByTestId('vplan-tab-problem').click()
  await page.waitForTimeout(300)
  const bg3 = page.locator('[data-testid="vplan-field"][data-id="development_background"]')
  check('AI: 사람이 쓴 개발 배경은 그대로 · 새 안은 따로 · 체크도 그대로', (await bg3.getByTestId('vplan-text').inputValue()) === humanText.slice(0, 900) && (await bg3.getByTestId('vplan-suggestion').count()) === 1 && (await bg3.locator('input[type="checkbox"]:checked').count()) === 2, { text: (await bg3.getByTestId('vplan-text').inputValue()).slice(0, 80), sug: await bg3.getByTestId('vplan-suggestion').count(), checks: await bg3.locator('input[type="checkbox"]:checked').count() })
  const cs = page.locator('[data-testid="vplan-field"][data-id="competitiveness_strategy"]')
  check('AI: 빈 칸은 AI 글 · 체크 2(선택지에 있는 것만) · "AI 초안" 표시', (await cs.getByTestId('vplan-text').inputValue()) === body('경쟁력') && (await cs.locator('input[type="checkbox"]:checked').count()) === 2 && /AI 초안/.test(await cs.innerText()), { text: (await cs.getByTestId('vplan-text').inputValue()).slice(0, 80), checks: await cs.locator('input[type="checkbox"]:checked').count() })
  const ip2 = await page.locator('[data-testid="vplan-field"][data-id="ip_records"] [data-testid="vplan-text"]').inputValue()
  check('출원번호 넣으면 지식재산권 칸 번호 자리("(출원 뒤 입력)" 첫 칸)에도 그 번호 · 일자 칸은 그대로', ip2.split(' / ')[3] === '10-2026-0012345' && ip2.split(' / ')[4] === '(출원 뒤 입력)', ip2)
  await bg3.getByTestId('vplan-suggestion-open').click()
  await bg3.getByTestId('vplan-suggestion-take').click()
  await page.waitForTimeout(800)
  check('새 안 → [이 안으로 바꾸기] → 칸이 바뀌고 새 안 사라짐 · 사이트에 넣음 내려감(다시 넣어야 하니까)', (await bg3.getByTestId('vplan-text').inputValue()) === body('배경') && (await bg3.getByTestId('vplan-suggestion').count()) === 0 && (await bg3.getAttribute('data-status')) === '')
  await page.getByTestId('vplan-tab-growth').click()
  await page.waitForTimeout(300)
  check('자체점검 ② 가 고친 목표시장 칸(AI 글이라 바로 고침)', (await page.locator('[data-testid="vplan-field"][data-id="market_target"] [data-testid="vplan-text"]').inputValue()).startsWith('JUDGE 고친 목표시장'))
  await page.getByTestId('vplan-tab-core').click()
  await page.waitForTimeout(300)
  check('자체점검 ① 이 고친 핵심 요약 차별성', (await page.locator('[data-testid="vplan-field"][data-id="core_diff"] [data-testid="vplan-text"]').inputValue()).startsWith('JUDGE 고친 차별성'))
  await page.getByTestId('vplan-tab-summary').click()
  await page.waitForTimeout(200)
  check('AI: 사람이 고친 기술명은 덮지 않음', (await page.locator('[data-testid="vplan-field"][data-id="tech_name"] [data-testid="vplan-input"]').inputValue()) === '공구 마모 예측 교체시점 서비스' && (await page.locator('[data-testid="vplan-field"][data-id="tech_name"] [data-testid="vplan-suggestion"]').count()) === 1)
  const BANNED = new RegExp(['\uC545\uB9C8', '\uC774\uC0C1\uD55C\\s*(?:\uB9C8\uCF00\uD305\\s*)?AI', 'Master v', 'Judge Scorecard', 'Red Flag'].join('|'), 'i')
  check('화면 어디에도 쓰지 않는 이름 · 출처 이름 없음(자체점검 · 대표 기준으로만)', !BANNED.test(await page.locator('body').innerText()) && /자체점검/.test(await page.getByTestId('vplan-ai').innerText()))
  check('다 씀 — 서술 10 · 핵심 요약 7', /서술 10\/10/.test(await page.getByTestId('vplan-progress').innerText()) && /핵심 요약 7\/7/.test(await page.getByTestId('vplan-progress').innerText()))
  await page.unroute('**/api/ai-assist')

  // 돌아가기 → 벤처 진행 · 제출 전 확인 '사업계획' 줄
  await page.getByTestId('vplan-back').click()
  await page.waitForURL((u) => !u.toString().includes('plan=1'))
  await page.waitForTimeout(500)
  check('돌아가기: 벤처 4단계 화면(plan 없음)', (await page.getByTestId('cert-workspace').count()) === 1 && (await page.getByTestId('vplan').count()) === 0)
  await page.getByTestId('cert-step-2').click()
  await page.waitForTimeout(250)
  const others = page.getByTestId('cert-other-actions').first()
  if ((await others.count()) && !(await others.evaluate((e) => e.open))) await others.locator('summary').click()
  const vcheck = page.getByTestId('cert-venture-check').or(page.getByTestId('cert-venture-check-more')).first()
  await vcheck.click()
  await page.waitForTimeout(300)
  const planRow = page.locator('[data-testid="cert-venture-gate-row"]', { hasText: '사업계획' })
  check('제출 전 확인: 다 쓴 사업계획서 → 사업계획 ✓(사이트 입력 n칸)', (await planRow.getAttribute('data-mark')) === 'ok' && /사업계획서 칸 모두 씀/.test(await planRow.innerText()), await planRow.innerText())
  check('PC: 가로 넘침 0 · JS 오류 0', (await overflowX(page)) <= 0 && errors.length === 0, errors)
  await ctx.close()
}

/* ---------------- 휴대폰 360 · 390 · 430 · 글자 아주 크게 ---------------- */
for (const w of [360, 390, 430]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 840 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  if (w === 390) await page.evaluate(() => document.documentElement.setAttribute('data-text-scale', 'extra_large'))
  await page.goto(BASE + PLAN, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  if (w === 390) await page.evaluate(() => document.documentElement.setAttribute('data-text-scale', 'extra_large'))
  const over = {}
  for (const t of ['mat', 'summary', 'core', 'problem', 'growth', 'check']) {
    await page.getByTestId(`vplan-tab-${t}`).click()
    await page.waitForTimeout(200)
    over[t] = await overflowX(page)
  }
  check(`${w}${w === 390 ? '(글자 아주 크게)' : ''}: 탭 6개 모두 가로 넘침 0`, Object.values(over).every((v) => v <= 0), over)
  const small = await page.locator('[data-testid="vplan"] button:visible').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 36).map((e) => e.textContent?.trim()))
  check(`${w}: 누르는 단추 높이(36px 이상)`, small.length === 0, small)
  if (w === 390) {
    await page.getByTestId('vplan-tab-problem').click()
    await page.waitForTimeout(200)
    await page.locator('[data-testid="vplan-field"]').first().evaluate((e) => e.scrollIntoView({ block: 'start' }))
    await page.evaluate(() => window.scrollBy(0, -70))
    await page.waitForTimeout(200)
    await shot(page, 'vplan-06-390-problem', false)
    await page.getByTestId('vplan-tab-mat').click()
    await page.waitForTimeout(200)
    await shot(page, 'vplan-07-390-materials', false)
  }
  check(`${w}: JS 오류 0`, errors.length === 0, errors)
  await ctx.close()
}

await browser.close()
console.log(`\nventureplan: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
