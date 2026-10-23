/**
 * qa:specwrite — D-248 특허 명세서 쓰기(특허 · 벤처 › 명세서 쓰기). 실행: npm run qa:specwrite -- http://localhost:4390 [사진 폴더]
 *  - 특허 · 벤처 첫 화면 카드 → 목록 → 회사 고르고 새 명세서 → 주소(draft · client)
 *  - 1 아이디어: 명칭 도우미 · 영문 · 다섯 질문 · 권리축 7줄 · 명칭 점검
 *  - 2 구성요소: 권리축으로 뼈대(110~160 · S110~) · 이름 바꾸기 · 시스템 이름 · 종속항 씨앗 · 다시 만들기는 한 번 더 묻기
 *  - 3 도면: 4장 · 도 1 블록도/도 2 순서도 그림 · 도면의 간단한 설명(도 1은 · 도 2는) · 부호의 설명 · 대표도
 *  - 4 청구항: 뼈대(시스템 · 종속 · 방법) → 고쳐 쓰기 · 5 본문: 뼈대 넣고 고치기 · 글자 수
 *  - 6 점검: 고쳐야 할 것 0(초안 + 명세서 점검) · MD 내려받기(영문 이름 · 입력 주의 · 식별항목) · 벤처 사업계획서 재료로(같은 회사) · 이미 있으면 한 번 더 묻기
 *  - 새로고침해도 그대로 · AI 초안(서버 흉내): 다섯 묶음 차례 · 한 번 실패 → 못 쓴 묶음만 다시 · 고친 칸은 새 안 · 구체적인 내용 앞+뒤 · 청구항 새 안 바꾸기
 *  - AI 전략실 특허 아이디어 가져오기(빈 칸만) · 목록 · 지우기는 한 번 더 묻기
 *  - 360 · 390 · 430 · 글자 아주 크게에서 가로 넘침 0 · JS 오류 0
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { seedScript } from './seed.mjs'

// D-252 AI 판이 기본 화면 — 칸을 직접 고치는 예전 시험은 [직접 고치기] 로 바꾼 뒤에(주소에 step 이 있으면 이미 직접 고치기)
const toEdit = async (p) => {
  const t = p.getByTestId('spec-view-edit')
  if ((await t.count()) && (await t.getAttribute('aria-selected')) !== 'true') {
    await t.click()
    await p.waitForTimeout(150)
  }
}


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

// 시험용 발명(실제 고객 발명 아님)
const IDEA = {
  problem: '가공 현장에서 공구 교체 시점을 작업자의 감으로 정해 불량과 과잉 교체가 반복된다.',
  prior: '종래에는 정해진 사용 시간이 지나면 공구를 일괄 교체하였다.',
  distinct: '공구별 진동 특성을 기준값과 비교해 마모 단계를 나누고 다음 작업 일정에 맞춰 교체 시점을 산출한다.',
  flow: '진동 수집 → 측정항목 정규화 → 마모 지수 갱신 → 마모 단계 판정 → 교체 알림 → 교체 결과 재반영',
  point: '마모 지수의 누적 갱신과 작업 일정을 함께 써서 교체 시점을 정하는 연결',
}
const AXIS = {
  input: '공구의 진동신호를 수집하는',
  process: '진동신호를 측정항목으로 정규화하는',
  state: '측정항목으로 공구별 마모 지수를 누적 갱신하는',
  judge: '마모 지수와 기준값을 비교하여 마모 단계를 판정하는',
  output: '마모 단계와 작업 일정으로 교체 시점을 산출하여 알리는',
  feedback: '교체 결과를 기준값에 다시 반영하는',
  link: '누적 갱신한 마모 지수와 작업 일정을 함께 써서 교체 시점을 산출',
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- PC 1440 ---------------- */
let draftUrl = ''
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())

  // 입구 — 특허 · 벤처 [자세히](예전 첫 화면) 첫 카드 · D-250 첫 화면은 대화창
  await page.goto(BASE + '/patent-venture/more', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const cards = await page.locator('[data-testid^="pv-card-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))
  check('특허 · 벤처: 카드 셋 — 명세서 쓰기가 맨 앞', cards.join() === 'pv-card-write,pv-card-plan,pv-card-spec', cards)
  await page.getByTestId('pv-write-open').click()
  await page.waitForURL(/\/patent-venture\/write$/)
  await page.getByTestId('spec-list').waitFor()
  check('명세서 쓰기 → 목록(아직 없음) · 회사 고르기 · 새 명세서', (await page.getByTestId('spec-row').count()) === 0 && (await page.getByTestId('spec-new-client').count()) === 1)
  await page.getByTestId('spec-new-client').selectOption(CLIENT)
  await page.getByTestId('spec-new').click()
  await page.waitForURL(/draft=/)
  await page.getByTestId('spec-editor').waitFor()
  await toEdit(page)
  draftUrl = page.url()
  check('새 명세서 → 주소에 draft · client · 1 아이디어부터', draftUrl.includes(`client=${CLIENT}`) && (await page.getByTestId('spec-tab-idea').getAttribute('aria-selected')) === 'true' && (await page.getByTestId('spec-editor').getAttribute('data-progress')) === '1/6')
  check('대표(로컬): AI 전략실에서 가져오기 · AI 초안 단추', (await page.getByTestId('spec-import-open').count()) === 1 && (await page.getByTestId('spec-ai-open').count()) === 1)
  await shot(page, 'spec-01-new')

  // 1 아이디어
  await page.getByText('명칭 만들기 도우미').click()
  await page.getByTestId('spec-tf-target').fill('공구 진동정보')
  await page.getByTestId('spec-tf-judge').fill('마모상태 판정')
  await page.getByTestId('spec-tf-result').fill('교체시점 산출')
  check('명칭 도우미: [무엇] 기반 [판단] 및 [결과] 시스템 및 방법', (await page.getByTestId('spec-tf-preview').innerText()) === '공구 진동정보 기반 마모상태 판정 및 교체시점 산출 시스템 및 방법')
  await page.getByTestId('spec-tf-use').click()
  check('명칭 점검: 영문 없으면 알림', /영문/.test(await page.getByTestId('spec-title-issues').innerText()))
  await page.getByTestId('spec-title-en').fill('SYSTEM AND METHOD FOR DETERMINING TOOL WEAR AND REPLACEMENT TIME BASED ON VIBRATION DATA')
  for (const [k, v] of Object.entries(IDEA)) await page.getByTestId(`spec-idea-${k}`).fill(v)
  for (const [k, v] of Object.entries(AXIS)) await page.getByTestId(`spec-axis-${k}`).fill(v)
  await page.getByTestId('spec-axis-link').blur()
  await page.waitForTimeout(1300)
  check('명칭 · 영문 다 쓰면 명칭 점검 0 · 저장됨', (await page.getByTestId('spec-title-issues').count()) === 0 && (await page.getByTestId('spec-save-state').getAttribute('data-state')) === 'saved')
  check('지금 할 것 → 2 구성요소', /2 구성요소/.test(await page.getByTestId('spec-next-go').innerText()))
  await shot(page, 'spec-02-idea')

  // 2 구성요소 · 단계
  await page.getByTestId('spec-next-go').click()
  await page.getByTestId('spec-step-parts').waitFor()
  await page.getByTestId('spec-skeleton').click()
  await page.waitForTimeout(200)
  const nos = await page.getByTestId('spec-comp-no').evaluateAll((els) => els.map((e) => e.value))
  const steps = await page.getByTestId('spec-step-text').evaluateAll((els) => els.map((e) => e.value))
  check('권리축 → 구성요소 110~160 · 단계 6개(~하는)', nos.join() === '110,120,130,140,150,160' && steps.length === 6 && steps.every((s) => s.endsWith('는')), { nos, steps })
  await page.getByTestId('spec-comp-name').nth(3).fill('마모판정부')
  await page.getByTestId('spec-system-name').fill('공구관리 시스템')
  await page.getByTestId('spec-seed-add').click()
  await page.getByTestId('spec-seed').first().locator('select').selectOption('140')
  await page.getByTestId('spec-seed-text').first().fill('마모 단계를 정상 · 주의 · 교체의 세 단계로 나누는')
  await page.getByTestId('spec-seed-text').first().blur()
  await page.getByTestId('spec-skeleton-redo').click()
  check('다시 만들기는 한 번 더 묻기', (await page.getByTestId('spec-skeleton-redo-yes').count()) === 1)
  await page.getByRole('button', { name: '취소' }).click()
  check('취소하면 고친 이름 그대로', (await page.getByTestId('spec-comp-name').nth(3).inputValue()) === '마모판정부')
  await shot(page, 'spec-03-parts')

  // 3 도면
  await page.getByTestId('spec-tab-figures').click()
  await page.getByTestId('spec-step-figures').waitFor()
  // D-249: 그림은 SVG 글을 이미지로(같은 글이 PNG · 제출 준비 묶음에 들어간다)
  const svgOf = async (n) => decodeURIComponent(((await page.getByTestId(`spec-fig-${n}-img`).getAttribute('src')) ?? '').split(',').slice(1).join(','))
  const fig1Svg = await svgOf(1)
  const fig2Text = await svgOf(2)
  const fig1Boxes = (fig1Svg.match(/<rect /g) ?? []).length
  const fig1Loaded = await page.getByTestId('spec-fig-1-img').evaluate((img) => img.complete && img.naturalWidth > 0)
  check('도 1 블록도: 바탕 + 시스템 + 구성요소 6 상자(그림 열림) · 도 2 순서도: 시작 · S110 · 끝', fig1Boxes === 8 && (await page.getByTestId('spec-fig-1').getAttribute('data-boxes')) === '6' && fig1Loaded && /시작/.test(fig2Text) && /S110/.test(fig2Text) && /끝/.test(fig2Text), { fig1Boxes, fig1Loaded })
  const desc = await page.getByTestId('spec-fig-desc').innerText()
  check('도면의 간단한 설명: 도 1은 … 블록도이다 · 도 2는 … 순서도이다 · 도 3 마모판정부', /도 1은 본 발명의 일 실시예에 따른 공구관리 시스템\(100\)의 전체 구성을 나타낸 블록도이다/.test(desc) && /도 2는 .*순서도이다/.test(desc) && /마모판정부\(140\)/.test(desc), desc.slice(0, 300))
  check('부호의 설명: 100 시스템 · 140 마모판정부', /100: 공구관리 시스템/.test(await page.getByTestId('spec-signs').innerText()) && /140: 마모판정부/.test(await page.getByTestId('spec-signs').innerText()))
  const [png] = await Promise.all([page.waitForEvent('download'), page.getByTestId('spec-fig-1-png').click()])
  check('도 1 그림 PNG 내려받기', png.suggestedFilename() === 'fig1-draft.png')
  await shot(page, 'spec-04-figures')

  // 4 청구항
  await page.getByTestId('spec-tab-claims').click()
  await page.getByTestId('spec-step-claims').waitFor()
  const sk = await page.getByTestId('spec-claims-skeleton').innerText()
  check('청구항 뼈대 셋 — 시스템 독립항(;를 포함하는) · 종속항(상기 마모판정부는) · 방법(컴퓨터에 의해 수행되는 방법으로서)', /;를 포함하는 공구 진동정보 기반 마모상태 판정 및 교체시점 산출 시스템\./.test(sk) && /청구항 1에 있어서, 상기 마모판정부는 마모 단계를/.test(sk) && /컴퓨터에 의해 수행되는 방법으로서/.test(sk), sk.slice(0, 300))
  await page.getByTestId('spec-claims-edit').click()
  check('[고쳐 쓰기] → 청구항 3칸 고칠 수 있음', (await page.getByTestId('spec-claim').count()) === 3)
  await shot(page, 'spec-05-claims')

  // 5 본문
  await page.getByTestId('spec-tab-body').click()
  await page.getByTestId('spec-step-body').waitFor()
  check('본문 일곱 칸 · 처음엔 뼈대 그대로', (await page.getByTestId('spec-section').count()) === 7 && (await page.locator('[data-testid="spec-section"] [data-testid="spec-section-state"]').first().innerText()) === '뼈대 그대로')
  for (const k of ['field', 'background', 'problem', 'effect']) await page.locator(`[data-testid="spec-section"][data-key="${k}"] [data-testid="spec-section-fill"]`).click()
  const field = await page.locator('[data-testid="spec-section"][data-key="field"] [data-testid="spec-section-text"]').inputValue()
  check('뼈대 넣고 고치기 → 기술분야 "본 발명은 … 에 관한 것이다." · 글자 수', field === '본 발명은 공구 진동정보 기반 마모상태 판정 및 교체시점 산출 시스템 및 방법에 관한 것이다.' && /자$/.test(await page.locator('[data-testid="spec-section"][data-key="field"] [data-testid="spec-section-state"]').innerText()), field)
  await page.locator('[data-testid="spec-section"][data-key="effect"] [data-testid="spec-section-text"]').blur()
  await page.waitForTimeout(1300)
  check('진행 6/6 · 지금 할 것 → 내보내기', (await page.getByTestId('spec-editor').getAttribute('data-progress')) === '6/6' && /내보내기/.test(await page.getByTestId('spec-next-go').innerText()), await page.getByTestId('spec-editor').getAttribute('data-progress'))

  // 6 점검 · 내보내기
  await page.getByTestId('spec-tab-check').click()
  await page.getByTestId('spec-step-check').waitFor()
  check('점검: 고쳐야 할 것 0(초안 + 명세서 점검)', (await page.getByTestId('spec-check-summary').getAttribute('data-errors')) === '0', await page.getByTestId('spec-check-summary').innerText())
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('spec-md-download').click()])
  const md = readFileSync(await dl.path(), 'utf8')
  check('MD: 영문 파일 이름 · 입력 주의 · 명칭 한글{영문} 한 줄 · 청구항 · 대표도', /^patent-spec-\d{8}\.md$/.test(dl.suggestedFilename()) && md.startsWith('입력 주의') && md.includes('\n공구 진동정보 기반 마모상태 판정 및 교체시점 산출 시스템 및 방법{SYSTEM AND METHOD') && md.includes('**[청구항 3]**') && /\*\*\[대표도\]\*\*\n도 1/.test(md) && /^\[0001\] /m.test(md), dl.suggestedFilename())
  await page.getByTestId('spec-numbered').uncheck()
  await page.waitForTimeout(300)
  await page.getByText('미리 보기').last().click()
  check('문단 번호 끄면 미리 보기에서 [0001] 사라짐', !/\[0001\]/.test(await page.getByTestId('spec-md-preview').innerText()))
  await page.getByTestId('spec-numbered').check()
  await shot(page, 'spec-06-check')

  // 벤처 사업계획서 재료로
  await page.getByTestId('spec-venture-send').click()
  await page.getByTestId('spec-venture-open').waitFor({ timeout: 5000 })
  check('벤처 재료로 보내기 → [사업계획서 쓰기로]', (await page.getByTestId('spec-venture-open').count()) === 1)
  await page.waitForTimeout(800)
  await page.goto(BASE + `/patent-venture/plan?client=${CLIENT}`, { waitUntil: 'networkidle' })
  await page.getByTestId('vplan').waitFor()
  await page.getByTestId('vplan-tab-mat').click()
  await page.waitForTimeout(300)
  const mat = await page.getByTestId('vplan-mat-patent').inputValue()
  check('사업계획서 재료(특허)에 명세서 요약 — 명칭 · 독립 청구항', mat.startsWith('[발명의 명칭] 공구 진동정보 기반') && mat.includes('[독립 청구항 1]') && !mat.includes('[0001]'), mat.slice(0, 200))
  await page.goto(draftUrl, { waitUntil: 'networkidle' })
  await page.getByTestId('spec-editor').waitFor()
  await toEdit(page)
  check('새로고침(다시 열기)해도 그대로 — 명칭 · 6/6', (await page.getByTestId('spec-editor-title').innerText()).startsWith('공구 진동정보 기반') && (await page.getByTestId('spec-editor').getAttribute('data-progress')) === '6/6')
  await page.getByTestId('spec-tab-idea').click()
  await page.getByTestId('spec-title').fill('공구 진동정보 기반 마모 예측 시스템 및 방법')
  await page.getByTestId('spec-title').blur()
  await page.waitForTimeout(1200)
  await page.getByTestId('spec-tab-check').click()
  await page.getByTestId('spec-venture-send').click()
  check('명칭을 바꿔 다시 보내면 "바꿀까요?" 한 번 더 묻기', (await page.getByTestId('spec-venture-ask').count()) === 1)
  await page.getByTestId('spec-venture-yes').click()
  await page.waitForTimeout(600)

  // AI 초안(서버 흉내)
  const sent = []
  let cCalls = 0
  const ITEMS = {
    'spec.a': [
      { title: 'field', body: 'AI 기술분야' },
      { title: 'background', body: 'AI 배경', detail: '종래 기술 출처 확인' },
      { title: 'problem', body: 'AI 과제' },
      { title: 'effect', body: 'AI 효과' },
    ],
    'spec.b': [{ title: 'solution', body: '## AI 해결 수단\n\n**첫** 문단' }, { title: 'abstract', body: 'AI 요약' }],
    'spec.c': [{ title: 'detail', body: 'AI 구성 앞부분 — 데이터 수집부(110)는 …' }],
    'spec.d': [{ title: 'detail2', body: 'AI 흐름 뒷부분 — 도 2를 참조하면 …' }],
    'spec.e': [{ title: 'claims', body: '청구항 1. AI 시스템 독립항.\n\n청구항 2. 청구항 1에 있어서, AI 종속항.\n\n청구항 3. AI 방법 독립항.' }],
  }
  await page.route('**/api/ai-assist', async (route) => {
    const req = JSON.parse(route.request().postData() || '{}')
    sent.push(req)
    if (req.assistId === 'spec.c' && cCalls++ === 0) return route.fulfill({ status: 504, contentType: 'text/html', body: '<html>timeout</html>' })
    const run = { requestId: req.requestId, assistId: req.assistId, page: req.page, provider: 'gemini', model: 'test-model', status: 'succeeded', structured: { headline: 'x', items: ITEMS[req.assistId] ?? [] }, raw: '', usage: { input: 1, output: 1, total: 2 }, estimatedCostUsd: null, ms: 5, sent: { userChars: 1, rows: 1, rowsCut: 0 }, createdAt: new Date().toISOString() }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, run }) })
  })
  await page.getByTestId('spec-ai-open').click()
  await page.getByTestId('spec-ai').waitFor()
  check('AI 초안 → 5 본문 단계에 판 열림', (await page.getByTestId('spec-tab-body').getAttribute('aria-selected')) === 'true')
  await page.getByTestId('spec-ai-run').click()
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="spec-ai-row"][data-phase="done"], [data-testid="spec-ai-row"][data-phase="fail"]').length === 5, null, { timeout: 20000 })
  await page.waitForTimeout(500)
  const phases = await page.getByTestId('spec-ai-row').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-key')}:${e.getAttribute('data-phase')}`))
  check('AI: 다섯 묶음 차례로(a → e) · c 만 실패', sent.map((r) => r.assistId).join() === 'spec.a,spec.b,spec.c,spec.d,spec.e' && phases.join() === 'a:done,b:done,c:fail,d:done,e:done', phases)
  const a = sent[0]
  check('AI 보낸 것: page patent · 구성요소(마모판정부 140) · 권리축 · 규칙(AI 라 부르지 않음 · 부호 그대로)', a.page === 'patent' && JSON.stringify(a.context.sections).includes('마모판정부') && JSON.stringify(a.context.sections).includes('경쟁사가 피하기 어려운 연결관계') && a.context.rules.some((r) => r.includes('AI · 인공지능')) && a.context.rules.some((r) => r.includes('이름과 부호를 그대로')))
  await page.getByTestId('spec-ai-retry').click()
  await page.waitForFunction(() => document.querySelector('[data-testid="spec-ai-row"][data-key="c"]')?.getAttribute('data-phase') === 'done', null, { timeout: 15000 })
  check('AI: 못 쓴 묶음만 다시 → c 만(6번째 요청)', sent.length === 6 && sent[5].assistId === 'spec.c')
  check('AI: 확인해 달라는 점 따로', /종래 기술 출처 확인/.test(await page.getByTestId('spec-ai-asks').innerText()))
  await page.waitForTimeout(500)
  const sec = (k) => page.locator(`[data-testid="spec-section"][data-key="${k}"]`)
  check('AI: 사람이 넣은 기술분야는 그대로 · 새 안 따로', (await sec('field').getByTestId('spec-section-text').inputValue()).startsWith('본 발명은 공구 진동정보 기반 마모 예측') === false && (await sec('field').getByTestId('spec-sug-field').count()) === 1)
  check('AI: 빈 칸(해결 수단)은 AI 글 · 마크다운 지움', (await sec('solution').getByTestId('spec-section-text').inputValue()) === 'AI 해결 수단\n\n첫 문단')
  const detail = await sec('detail').getByTestId('spec-section-text').inputValue()
  check('AI: 구체적인 내용 = 앞(c) + 뒤(d) 한 칸 · 다시 받아도 겹치지 않음', detail === 'AI 구성 앞부분 — 데이터 수집부(110)는 …\n\nAI 흐름 뒷부분 — 도 2를 참조하면 …', detail)
  await sec('field').getByTestId('spec-sug-field-use').click()
  await page.waitForTimeout(300)
  check('새 안 → [이 안으로 바꾸기] → 칸이 바뀌고 새 안 사라짐', (await sec('field').getByTestId('spec-section-text').inputValue()) === 'AI 기술분야' && (await sec('field').getByTestId('spec-sug-field').count()) === 0)
  await shot(page, 'spec-07-ai')
  await page.getByTestId('spec-tab-claims').click()
  check('AI: 고친 청구항(고쳐 쓰기)은 그대로 · 청구항 새 안', (await page.getByTestId('spec-claim').count()) === 3 && (await page.getByTestId('spec-claims-sug').count()) === 1)
  await page.getByTestId('spec-claims-sug-use').click()
  await page.waitForTimeout(300)
  const claims = await page.getByTestId('spec-claim').evaluateAll((els) => els.map((e) => e.value))
  check('청구항 새 안으로 바꾸기 → 머리(청구항 n.) 떼고 3개', claims.join('|') === 'AI 시스템 독립항.|청구항 1에 있어서, AI 종속항.|AI 방법 독립항.', claims)
  await page.unroute('**/api/ai-assist')

  // AI 전략실에서 가져오기 — 회사 없는 새 명세서
  await page.evaluate(() => {
    const at = new Date().toISOString()
    localStorage.setItem('axmvp.v1.owner_ai.cases', JSON.stringify([{ id: 'case_spec_e2e', companyName: '시험 정밀', relation: 'contracted', bizNo: '', clientId: null, ownerId: null, workspaceId: null, materials: [], facts: {}, activity: [], createdAt: at, updatedAt: at, archivedAt: null, contextVersion: 0 }]))
    localStorage.setItem('axmvp.v1.owner_ai.runs', JSON.stringify([{ id: 'run_spec_e2e', caseId: 'case_spec_e2e', skillId: 'PATENT_IDEA', skillVersion: 1, input: {}, structured: { ideas: [{ title: '용접 비드 영상 기반 결함 판정 시스템 및 방법', problem: '용접 결함을 사람이 눈으로 본다', priorArt: '샘플 검사', coreIdea: '비드 폭 변화를 기준선과 비교', distinct: ['라인별 기준선'], dataFlow: ['촬영', '판정'], procedure: ['비드 영상을 촬영한다', '결함을 판정한다'], independentClaim: '비드 폭 변화와 라인별 기준선을 함께 써서 판정', dependentClaims: ['결함을 세 단계로 나누는'] }] }, rendered: '', status: 'succeeded', createdAt: at }]))
  })
  await page.getByTestId('spec-back-list').click()
  await page.getByTestId('spec-list').waitFor()
  await page.getByTestId('spec-new-client').selectOption('')
  await page.getByTestId('spec-new').click()
  await page.waitForURL(/draft=/)
  await page.getByTestId('spec-editor').waitFor()
  await toEdit(page)
  check('회사 없이 새 명세서 → 주소에 client 없음', !page.url().includes('client='))
  await page.getByTestId('spec-import-open').click()
  await page.getByTestId('spec-import-case').selectOption('case_spec_e2e')
  await page.getByTestId('spec-import-use').first().click()
  await page.waitForTimeout(600)
  check('AI 전략실 아이디어 → 명칭 · 문제 · 연결관계(빈 칸만) · 1 아이디어', (await page.getByTestId('spec-title').inputValue()) === '용접 비드 영상 기반 결함 판정 시스템 및 방법' && (await page.getByTestId('spec-idea-problem').inputValue()) === '용접 결함을 사람이 눈으로 본다' && (await page.getByTestId('spec-axis-link').inputValue()) === '비드 폭 변화와 라인별 기준선을 함께 써서 판정')
  await page.getByTestId('spec-tab-parts').click()
  const st2 = await page.getByTestId('spec-step-text').evaluateAll((els) => els.map((e) => e.value))
  check('처리 절차 → 방법 단계(~하는) · 종속항 씨앗', st2.join() === '비드 영상을 촬영하는,결함을 판정하는' && (await page.getByTestId('spec-seed-text').first().inputValue()) === '결함을 세 단계로 나누는', st2)
  await page.getByTestId('spec-tab-check').click()
  check('회사 없는 명세서: 벤처로 보낼 때 회사 고르기', (await page.getByTestId('spec-venture-client').count()) === 1)
  await page.getByTestId('spec-back-list').click()
  await page.getByTestId('spec-list').waitFor()
  check('목록 두 건(명칭 · 회사 · n/6단계)', (await page.getByTestId('spec-row').count()) === 2 && /한솔테크/.test(await page.getByTestId('spec-list').innerText()))
  await page.getByTestId('spec-row-remove').first().click()
  check('지우기는 한 번 더 묻기', (await page.getByTestId('spec-row-remove-yes').count()) === 1)
  await page.getByTestId('spec-row-remove-yes').click()
  await page.waitForTimeout(500)
  check('지우면 한 건', (await page.getByTestId('spec-row').count()) === 1)
  await shot(page, 'spec-08-list')
  check('PC: 가로 넘침 0 · JS 오류 0', (await overflowX(page)) <= 0 && errors.length === 0, errors)
  await ctx.close()
}

/* ---------------- 휴대폰 ---------------- */
for (const width of [360, 390, 430]) {
  const ctx = await browser.newContext({ viewport: { width, height: 860 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/patent-venture/write', { waitUntil: 'networkidle' })
  await page.getByTestId('spec-new-client').selectOption(CLIENT)
  await page.getByTestId('spec-new').click()
  await page.getByTestId('spec-editor').waitFor()
  await toEdit(page)
  await page.getByTestId('spec-title').fill('공구 진동정보 기반 마모상태 판정 및 교체시점 산출 시스템 및 방법')
  for (const [k, v] of Object.entries(AXIS)) await page.getByTestId(`spec-axis-${k}`).fill(v)
  await page.getByTestId('spec-tab-parts').click()
  await page.getByTestId('spec-skeleton').click()
  const bad = []
  for (const scale of ['', 'extra_large']) {
    if (scale) await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
    for (const t of ['idea', 'parts', 'figures', 'claims', 'body', 'check']) {
      await page.getByTestId(`spec-tab-${t}`).click()
      await page.waitForTimeout(250)
      const o = await overflowX(page)
      if (o > 0) bad.push(`${t}${scale ? '+큰글자' : ''}:${o}`)
      if (width === 390 && !scale && (t === 'parts' || t === 'figures')) await shot(page, `spec-09-${t}-390`)
    }
  }
  check(`${width}: 여섯 단계 · 글자 아주 크게까지 가로 넘침 0`, bad.length === 0, bad)
  const tabsH = await page.getByTestId('spec-tabs').evaluate((e) => e.getBoundingClientRect().height)
  check(`${width}: 단계 탭 두 줄 안(높이 ${Math.round(tabsH)})`, tabsH < 200, tabsH)
  check(`${width}: JS 오류 0`, errors.length === 0, errors)
  await ctx.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
