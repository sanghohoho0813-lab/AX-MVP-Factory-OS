/**
 * qa:ventureplan — D-246 벤처 사업계획서 쓰기(기업인증 › 벤처 · ?plan=1). 실행: npm run qa:ventureplan -- http://localhost:4390 [사진 폴더]
 *  - 벤처 '무엇을 준비하나요?' · 다른 작업 → 사업계획서 쓰기 · 돌아가기
 *  - 재료: 명세서(MD) 올리기 → 요약 · 청구항 수 · 되돌리기 / AX · 메모 저장
 *  - 회사 기록으로 채우기(기술명 · 연구조직 · 지식재산권 출원중 · 핵심 요약 지식재산권 문장) · 이미 적은 칸은 그대로
 *  - 칸: 문장 틀 · 글자 수 · 넘음 · 체크박스 · 상태(확인함 · 사이트에 넣음) · 복사 · 새로고침해도 그대로
 *  - 점검 · 그 칸으로 · 한 장(MD) 내려받기 · 제출 전 확인 '사업계획' 줄
 *  - AI 초안(대표 · 서버 흉내): 여섯 묶음 차례로 · 고친 칸은 덮지 않고 새 안 · 실패한 묶음만 다시 · 확인할 점
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

  // AI — 재료 없으면 막는다
  await page.getByTestId('vplan-ai-open').click()
  check('AI: 재료 없으면 막고 재료 넣기로', (await page.getByTestId('vplan-ai-need').count()) === 1 && (await page.getByTestId('vplan-ai-run').count()) === 0)
  await page.getByTestId('vplan-ai-open').click()

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

  // AI 초안(서버 흉내) — 고친 칸은 덮지 않음 · g2 한 번 실패 → 다시
  const sent = []
  let g2Calls = 0
  const body = (id) => '본문 ' + id + ' — 특허의 신호 정규화부가 MVP 의 휴대폰 진동 입력으로 구현됩니다.'
  const ITEMS = {
    'venture.p1': [
      { title: 'development_background', body: body('배경'), tag: '많은 사람들이 겪고 있는 문제임', detail: '불량률 숫자 출처 확인' },
      { title: 'competitiveness_strategy', body: body('경쟁력'), tag: '기존제품 대비 고성능, 기존 제품 대비 편리함', detail: '' },
    ],
    'venture.p2': [{ title: 'technology_progress', body: body('경과') }, { title: 'technology_plan_3y', body: body('3년') }],
    'venture.g1': [{ title: 'market_target', body: body('시장') }, { title: 'competitor_analysis', body: body('경쟁사') }],
    'venture.g2': [{ title: 'market_entry_progress', body: body('진입 경과') }, { title: 'market_entry_plan_3y', body: body('진입 3년') }],
    'venture.x': [{ title: 'entrepreneurship_example', body: body('기업가') }, { title: 'financing_plan', body: body('자금'), tag: '영업이익, 정부지원(창업지원)' }],
    'venture.sum': ['tech_name', 'tech_summary', 'core_problem', 'core_solution', 'core_market', 'core_diff', 'core_marketing', 'core_growth'].map((id) => ({ title: id, body: id === 'tech_name' ? 'AI 가 고른 이름' : body(id) })),
  }
  await page.route('**/api/ai-assist', async (route) => {
    const req = JSON.parse(route.request().postData() || '{}')
    sent.push(req)
    if (req.assistId === 'venture.g2' && g2Calls++ === 0) return route.fulfill({ status: 504, contentType: 'text/html', body: '<html>timeout</html>' })
    const run = { requestId: req.requestId, assistId: req.assistId, page: req.page, provider: 'gemini', model: 'test-model', status: 'succeeded', structured: { headline: 'x', items: ITEMS[req.assistId] ?? [] }, raw: '', usage: { input: 1, output: 1, total: 2 }, estimatedCostUsd: null, ms: 5, sent: { userChars: 1, rows: 1, rowsCut: 0 }, createdAt: new Date().toISOString() }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, run }) })
  })
  await page.getByTestId('vplan-ai-open').click()
  await page.getByTestId('vplan-ai-run').click()
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="vplan-ai-row"][data-phase="done"], [data-testid="vplan-ai-row"][data-phase="fail"]').length === 6, null, { timeout: 20000 })
  await page.waitForTimeout(600)
  const phases = await page.getByTestId('vplan-ai-row').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-key')}:${e.getAttribute('data-phase')}`))
  check('AI: 여섯 묶음 차례로(p1 → … → sum) · g2 만 실패 · 나머지 씀', sent.map((r) => r.assistId).join() === 'venture.p1,venture.p2,venture.g1,venture.g2,venture.x,venture.sum' && phases.join() === 'p1:done,p2:done,g1:done,g2:fail,x:done,sum:done', phases)
  const p1 = sent[0]
  check('AI 보낸 것: page venture · 명세서 재료 · AX · 이번 칸 규칙 · 출원 그대로 규칙', p1.page === 'venture' && JSON.stringify(p1.context.sections[0].rows).includes('공구 마모 예측') && JSON.stringify(p1.context.sections[1].rows).includes('휴대폰 진동 입력') && p1.context.rules.some((r) => r.startsWith('칸 development_background')) && p1.context.rules.some((r) => r.includes('출원 상태 그대로')))
  check('AI 보낸 것: 앞 묶음 결과가 다음 묶음의 "이미 쓴 칸" 으로', JSON.stringify(sent[1].context.sections[3].rows).includes('본문 경쟁력'))
  check('AI: 못 쓴 묶음만 다시 단추', (await page.getByTestId('vplan-ai-retry').count()) === 1)
  await page.getByTestId('vplan-ai-retry').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="vplan-ai-row"][data-key="g2"]')?.getAttribute('data-phase') === 'done', null, { timeout: 15000 })
  check('AI: 다시 → g2 씀 · 7번째 요청은 g2 하나', sent.length === 7 && sent[6].assistId === 'venture.g2')
  check('AI: 확인해 달라는 점(본문 아님) 보임', /불량률 숫자 출처 확인/.test(await page.getByTestId('vplan-ai-asks').innerText()))
  await shot(page, 'vplan-05-ai')
  await page.getByTestId('vplan-tab-problem').click()
  await page.waitForTimeout(300)
  const bg3 = page.locator('[data-testid="vplan-field"][data-id="development_background"]')
  check('AI: 사람이 쓴 개발 배경은 그대로 · 새 안은 따로 · 체크도 그대로', (await bg3.getByTestId('vplan-text').inputValue()) === humanText.slice(0, 900) && (await bg3.getByTestId('vplan-suggestion').count()) === 1 && (await bg3.locator('input[type="checkbox"]:checked').count()) === 2, { text: (await bg3.getByTestId('vplan-text').inputValue()).slice(0, 80), sug: await bg3.getByTestId('vplan-suggestion').count(), checks: await bg3.locator('input[type="checkbox"]:checked').count() })
  const cs = page.locator('[data-testid="vplan-field"][data-id="competitiveness_strategy"]')
  check('AI: 빈 칸은 AI 글 · 체크 2(선택지에 있는 것만) · "AI 초안" 표시', (await cs.getByTestId('vplan-text').inputValue()) === body('경쟁력') && (await cs.locator('input[type="checkbox"]:checked').count()) === 2 && /AI 초안/.test(await cs.innerText()), { text: (await cs.getByTestId('vplan-text').inputValue()).slice(0, 80), checks: await cs.locator('input[type="checkbox"]:checked').count() })
  await bg3.getByTestId('vplan-suggestion-open').click()
  await bg3.getByTestId('vplan-suggestion-take').click()
  await page.waitForTimeout(800)
  check('새 안 → [이 안으로 바꾸기] → 칸이 바뀌고 새 안 사라짐 · 사이트에 넣음 내려감(다시 넣어야 하니까)', (await bg3.getByTestId('vplan-text').inputValue()) === body('배경') && (await bg3.getByTestId('vplan-suggestion').count()) === 0 && (await bg3.getAttribute('data-status')) === '')
  await page.getByTestId('vplan-tab-summary').click()
  await page.waitForTimeout(200)
  check('AI: 사람이 고친 기술명은 덮지 않음', (await page.locator('[data-testid="vplan-field"][data-id="tech_name"] [data-testid="vplan-input"]').inputValue()) === '공구 마모 예측 교체시점 서비스' && (await page.locator('[data-testid="vplan-field"][data-id="tech_name"] [data-testid="vplan-suggestion"]').count()) === 1)
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
