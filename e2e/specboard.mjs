/**
 * qa:specboard — D-252 명세서 AI 작업판(AI 가 다 쓰는 명세서). 실행: npm run qa:specboard -- http://localhost:4390 [사진 폴더]
 *  - D-261 새 명세서 = 회사 고르기 + 단추 한 번 → 만들자마자 처음부터 끝까지(전부 써줘를 또 누르지 않음) · 다 쓰면 맨 위에 내려받기
 *  - 새 명세서 → AI 작업판이 먼저(대표) · 모델 고르기 단추 · 칸 여섯(접어 둠) · 타자 칠 칸 0
 *  - [전부 써줘] 한 번 → 아이디어 → 조사 → 구성 → 본문 a~d → 청구항 → 점검대로 고치기 차례로 · 칸마다 결과
 *  - 아이디어 후보 3 · 추천 1번이 바로 들어감 · 다른 것 고르기(한 번 더 묻기 · 구성 이후 비움 · 되돌리기)
 *  - 조사: 검색 근거 · 출처 · KIPRIS 검색어 · 청구항 묶음에 차별화가 감
 *  - 쓰는 중에 목록으로 나갔다 와도 그 사이 받은 글이 들어감 · 다시 부르지 않음
 *  - [직접 고치기] = 예전 단계 화면 · ?step= 으로 열어도 대표는 작업판 먼저(D-261) · 자료 넣기(파일 → 읽은 글만)
 *  - 360 · 390 넘침 0 · JS 오류 0
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
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

// 시험용 발명(실제 고객 발명 아님)
const IDEAS = [
  { title: '공구 진동정보 기반 마모 단계 판정 및 교체시점 산출 시스템 및 방법', body: 'SYSTEM AND METHOD FOR JUDGING TOOL WEAR STAGE AND SCHEDULING REPLACEMENT BASED ON VIBRATION', detail: '상담 메모의 공구 교체 불량 이야기에서 나왔습니다.', outline: ['① 현재 문제: 공구 교체 시점을 감으로 정해 불량과 과잉 교체가 반복된다', '기존 방식: 정해진 사용 시간이 지나면 일괄 교체한다', '진동 특성을 기준값과 비교해 마모 단계를 나눈다', '진동 수집 → 정규화 → 마모 지수 갱신 → 판정 → 교체 알림 → 결과 재반영', '마모 지수 누적 갱신과 작업 일정을 함께 써서 교체 시점을 정하는 연결'] },
  { title: '작업지시 데이터 기반 설비 가동 순서 추천 시스템 및 방법', body: 'SYSTEM AND METHOD FOR RECOMMENDING EQUIPMENT RUN ORDER', detail: '납기 지연 이야기에서 나왔습니다.', outline: ['납기가 겹치면 설비 순서를 사람이 정한다', '엑셀로 순서를 짠다', '작업지시와 설비 상태를 함께 본다', '작업지시 수집 → 설비 상태 → 순서 점수 → 추천 → 실행 결과 반영', '설비 상태와 납기를 함께 쓴 순서 점수'] },
  { title: '불량 사진 기반 공정 원인 분류 시스템 및 방법', body: '불량 사진 영문', detail: '(추정 — 대표 확인)', outline: ['불량 원인을 사람이 추정한다', '경험으로 판단한다', '사진 특징과 공정 기록을 잇는다', '사진 → 특징 → 공정 기록 매칭 → 원인 → 알림 → 재반영', '사진 특징과 공정 기록의 연결'] },
]
const PARTS = [
  ...['input', 'process', 'state', 'judge', 'output', 'feedback', 'link'].map((k, i) => ({ title: `axis.${k}`, body: ['공구의 진동신호를 수집하는', '진동신호를 측정항목으로 정규화한다', '마모 지수를 누적 갱신하는', '마모 지수와 기준값을 비교하여 마모 단계를 판정하는', '교체 시점을 산출하여 알리는', '교체 결과를 기준값에 다시 반영하는', '누적 갱신한 마모 지수와 작업 일정을 함께 써서 교체 시점을 산출하는'][i] })),
  { title: 'system', body: '공구 마모 예측 시스템' },
  { title: 'comp', detail: '진동 수집부', body: '공구의 진동신호를 수집하는' },
  { title: 'comp', detail: '정규화부', body: '진동신호를 측정항목으로 정규화하는' },
  { title: 'comp', detail: '마모지수 갱신부', body: '마모 지수를 누적 갱신하는' },
  { title: 'comp', detail: '마모 판정부', body: '마모 단계를 판정하는' },
  { title: 'comp', detail: '교체시점 산출부', body: '작업 일정과 함께 교체 시점을 산출하는' },
  { title: 'step', body: 'S110 진동신호를 수집하는' },
  { title: 'step', body: '진동신호를 정규화하는' },
  { title: 'step', body: '마모 지수를 갱신하는' },
  { title: 'step', body: '마모 단계를 판정하는' },
  { title: 'step', body: '교체 시점을 산출하는' },
  { title: 'seed', detail: '마모 판정부', body: '마모 단계를 세 단계로 나누는' },
  { title: 'seed', detail: '교체시점 산출부', body: '다음 작업 일정의 빈 시간에 교체를 배치하는' },
]
let bodyRound = 0
const answer = (id) => {
  switch (id) {
    case 'spec.idea':
      return { headline: '1번 — 상담 메모에 나온 문제와 바로 이어집니다', items: IDEAS.map((x) => ({ ...x, tag: '아이디어' })), next: ['진동 데이터를 실제로 모으는지 확인'] }
    case 'spec.research':
      return {
        headline: '그대로 가도 되지만 작업 일정 연결을 독립항에 꼭 넣으세요',
        items: [
          { tag: '검색어', title: 'KIPRIS 검색어', outline: ['공구 마모 AND 진동', 'tool wear vibration', 'B23Q 17/09'] },
          { tag: '비슷한 기술', title: '진동 기반 공구 수명 예측', detail: '진동 RMS 로 수명을 추정하는 방식이 널리 알려져 있습니다.' },
          { tag: '차별화', title: '작업 일정과 마모 지수를 함께 쓰는 교체 시점 산출', detail: '독립항 1 에 일정 연결을 넣습니다.' },
          { tag: '위험', title: '단순 임계값 비교만으로는 진보성이 약함', detail: '누적 갱신 방식을 구체적으로.' },
        ],
        next: ['KIPRIS 에서 B23Q 17/09 최근 3년 확인'],
      }
    case 'spec.parts':
      return { headline: '진동 → 마모 지수 → 교체 시점', items: PARTS }
    case 'spec.a':
      return { headline: 'a', items: [{ title: 'field', body: `본 발명은 공구 마모 판정 시스템에 관한 것이다.${bodyRound > 1 ? ' (2차)' : ''}` }, { title: 'background', body: '종래에는 정해진 사용 시간이 지나면 공구를 교체하였다.', detail: '종래 기술 출처 확인' }, { title: 'problem', body: '본 발명은 교체 시점을 산출하는 것을 목적으로 한다.' }, { title: 'effect', body: '불필요한 교체를 줄일 수 있다.' }] }
    case 'spec.b':
      return { headline: 'b', items: [{ title: 'solution', body: '상기 목적을 달성하기 위한 본 발명의 일 실시예에 따른 시스템은 …' }, { title: 'abstract', body: `본 발명은 공구 마모 판정 시스템에 관한 것으로, ${'진동신호를 수집하고 마모 지수를 갱신한다. '.repeat(18)}` }] }
    case 'spec.c':
      return { headline: 'c', items: [{ title: 'detail', body: '이하, 첨부된 도면을 참조하여 진동 수집부(110)를 설명한다.' }] }
    case 'spec.d':
      return { headline: 'd', items: [{ title: 'detail2', body: '도 2 를 참조하면, 단계 S110 에서 …' }] }
    case 'spec.e':
      return { headline: 'e', items: [{ title: 'claims', body: '청구항 1. 공구의 진동신호를 수집하는 진동 수집부; 작업 일정과 함께 교체 시점을 산출하는 교체시점 산출부;를 포함하는 공구 마모 예측 시스템.\n\n청구항 2. 청구항 1에 있어서, 마모 단계를 세 단계로 나누는 것을 특징으로 하는 공구 마모 예측 시스템.\n\n청구항 3. 진동신호를 수집하는 단계; 교체 시점을 산출하는 단계;를 포함하는 공구 마모 예측 방법.' }] }
    case 'spec.fix':
      return { headline: '요약을 다듬었습니다', items: [{ title: 'abstract', body: '본 발명은 공구 진동정보 기반 마모 판정 시스템에 관한 것으로, 마모 지수를 누적 갱신하여 교체 시점을 산출한다.', detail: '요약 첫 문장' }] }
    default:
      return { headline: '', items: [] }
  }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const sent = []
let delayMs = 30
async function routeAi(page) {
  await page.route('**/api/ai-assist**', async (route) => {
    if (route.request().method() !== 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, providers: [{ id: 'gemini', label: 'Gemini', configured: true, keyName: 'GEMINI_API_KEY', models: [{ id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', note: '빠르게', tier: 'cheap', price: { in: 0.1, out: 0.4 } }, { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', note: '보통', tier: 'standard', price: { in: 0.3, out: 2.5 } }] }, { id: 'openai', label: 'OpenAI', configured: true, keyName: 'OPENAI_API_KEY', models: [{ id: 'gpt-5.4-mini', label: 'GPT 5.4 Mini', note: '보통', tier: 'standard', price: { in: 0.4, out: 1.6 } }] }], defaultChoice: { provider: 'gemini', model: 'gemini-3.1-flash-lite' } }) })
    const req = JSON.parse(route.request().postData() || '{}')
    sent.push(req)
    if (req.assistId === 'spec.a') bodyRound += 1
    await new Promise((r) => setTimeout(r, delayMs))
    const research = req.assistId === 'spec.research'
    const run = { requestId: req.requestId, assistId: req.assistId, page: req.page, provider: 'gemini', model: 'test-model', status: 'succeeded', structured: answer(req.assistId), raw: '', usage: { input: 1, output: 1, total: 2 }, estimatedCostUsd: null, ms: 5, sent: { userChars: 1, rows: 1, rowsCut: 0 }, createdAt: new Date().toISOString(), grounded: research, sources: research ? [{ title: 'KIPRIS 공구 마모', url: 'https://www.kipris.or.kr/example-1' }, { title: '논문 · 진동 기반 수명', url: 'https://example.org/paper' }] : [] }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, run }) })
  })
}
const waitIdle = (page, timeout = 30000) => page.waitForFunction(() => document.querySelector('[data-testid="spec-board"]')?.getAttribute('data-busy') === 'no', null, { timeout })

{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', acceptDownloads: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const dialogs = []
  page.on('dialog', (d) => {
    dialogs.push(d.message())
    void d.accept()
  })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await routeAi(page)

  await page.goto(BASE + '/patent-venture/write', { waitUntil: 'networkidle' })
  // 고른 모델(GPT)은 이 브라우저에 기억된 것 — 새 명세서도 그 모델로 쓴다
  await page.evaluate(() => localStorage.setItem('axmvp.ai.choice.v1', JSON.stringify({ provider: 'openai', model: 'gpt-5.4-mini' })))
  await page.reload({ waitUntil: 'networkidle' })
  const listTyping = await page.locator('[data-testid="spec-new-ai"] textarea, [data-testid="spec-new-ai"] input[type="text"]').count()
  check('B0 새 명세서 칸 — 회사 고르기 + 단추 하나 · 타자 칠 칸 0 · 견본은 작은 글자 단추로', (await page.getByTestId('spec-new-ai').isVisible()) && listTyping === 0 && (await page.getByTestId('spec-sample').isVisible()), listTyping)
  await page.getByTestId('spec-new-client').selectOption(CLIENT)
  check('B0b 회사를 고르면 단추에 그 회사 이름 — "○○ 명세서 AI 로 처음부터 끝까지"', /한솔테크.*처음부터 끝까지/.test(await page.getByTestId('spec-new').innerText()), await page.getByTestId('spec-new').innerText())
  await shot(page, 'B-start', false)
  await page.getByTestId('spec-new').click()
  await page.waitForURL(/draft=/)
  await page.getByTestId('spec-board').waitFor()
  await page.waitForFunction(() => document.querySelector('[data-testid="spec-board"]')?.getAttribute('data-busy') === 'yes', null, { timeout: 8000 }).catch(() => {})
  check('B1 단추 한 번으로 바로 처음부터 끝까지 쓰기 시작([전부 써줘] 를 또 누르지 않음) · AI 작업판 먼저 · 단계 칸 안 보임 · 주소에서 auto 지움', (await page.getByTestId('spec-board').getAttribute('data-busy')) === 'yes' && (await page.getByTestId('spec-view-ai').getAttribute('aria-selected')) === 'true' && (await page.getByTestId('spec-tabs').count()) === 0 && !page.url().includes('auto=1'), page.url())
  check('B7 쓰는 중 — 맨 위에 진행 줄(8단계 이상) · "AI 가 쓰는 중"', (await page.getByTestId('spec-board-row').count()) >= 8 && /쓰는 중/.test(await page.getByTestId('spec-board-head').innerText()))
  check('B2 칸 여섯은 [칸별로 보기] 안에 접혀 있음 · 모델 고르기 단추', (await page.getByTestId('spec-card').count()) === 0 && (await page.getByTestId('spec-cards-toggle').isVisible()) && (await page.getByTestId('model-pick').count()) === 1)
  const typing = await page.locator('[data-testid="spec-board"] textarea, [data-testid="spec-board"] input[type="text"]').count()
  check('B3 작업판에 타자 칠 칸 0', typing === 0, typing)
  check('B5 회사 기록이 재료로 보임', /기록 \d+줄/.test(await page.getByTestId('spec-board-sources').innerText()))
  await shot(page, 'B-running')
  await waitIdle(page)
  await page.waitForTimeout(500)
  await page.getByTestId('spec-cards-toggle').click()
  const order = sent.map((r) => r.assistId).join()
  check('B8 차례 — 아이디어 → 조사 → 구성 → 본문 a~d → 청구항 → 점검대로 고치기', order === 'spec.idea,spec.research,spec.parts,spec.a,spec.b,spec.c,spec.d,spec.e,spec.fix', order)
  check('B9 고른 모델로 부름(GPT)', sent.every((r) => r.choice?.provider === 'openai' && r.choice?.model === 'gpt-5.4-mini'), sent.map((r) => r.choice))
  const phases = await page.getByTestId('spec-board-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-phase')))
  check('B10 단계 줄 모두 다 씀', phases.every((p) => p === 'done'), phases)
  const ideaCtx = JSON.stringify(sent[0].context)
  check('B11 아이디어 자료 = 회사 기록(업종 등) · 이름 · 연락처 없음', /업종|종목|설립/.test(ideaCtx) && !/010-\d{4}-\d{4}/.test(ideaCtx), ideaCtx.slice(0, 300))
  check('B12 추천 1번이 명칭 · 영문으로 바로 들어감', (await page.getByTestId('spec-board-title').innerText()).includes('공구 진동정보 기반 마모 단계 판정') && (await page.getByTestId('spec-board-title').innerText()).includes('{SYSTEM AND METHOD FOR JUDGING'))
  const ideas = await page.getByTestId('spec-idea').evaluateAll((els) => els.map((e) => e.getAttribute('data-current')))
  check('B13 지금 쓰는 것은 위에 하나(추천 표시) · 다른 후보 2개만 아래(겹치지 않음)', ideas.join() === 'no,no' && /추천/.test(await page.getByTestId('spec-board-title').innerText()), ideas)
  check('B14 조사: 검색 근거 2곳 · 출처 링크 · KIPRIS 검색어', (await page.getByTestId('spec-research-grounded').getAttribute('data-grounded')) === 'yes' && (await page.locator('[data-testid="spec-research-sources"] a').count()) === 2 && /B23Q 17\/09/.test(await page.getByTestId('spec-research-words').innerText()))
  const eCtx = JSON.stringify(sent.find((r) => r.assistId === 'spec.e').context)
  check('B15 청구항 묶음에 조사의 차별화가 감', eCtx.includes('조사에서 나온 차별화') && eCtx.includes('작업 일정과 마모 지수를 함께'))
  check('B16 구성: 구성요소 5개 · 부호 110~150 · 단계 · 종속항', /진동 수집부\(110\)/.test(await page.getByTestId('spec-board-parts').innerText()) && /교체시점 산출부\(150\)/.test(await page.getByTestId('spec-board-parts').innerText()) && /단계 5개 · 종속항 씨앗 2개/.test(await page.getByTestId('spec-board-parts').innerText()))
  const body = await page.locator('[data-testid="spec-board-body"] li').evaluateAll((els) => els.map((e) => e.getAttribute('data-has')))
  check('B17 본문 7칸 모두 씀', body.length === 7 && body.every((x) => x === 'yes'), body)
  check('B18 청구항 3개', /청구항 3개/.test(await page.getByTestId('spec-board-claims').innerText()))
  check('B19 점검대로 고치기 — 걸린 것(요약 400자 넘음)을 보냄', JSON.stringify(sent.find((r) => r.assistId === 'spec.fix')?.context ?? '').includes('요약이'))
  check('B20 AI 가 확인해 달라는 점 따로', /종래 기술 출처 확인/.test(await page.getByTestId('spec-board-asks').innerText()))
  const doneCards = await page.getByTestId('spec-card').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-card')}:${e.getAttribute('data-done')}`))
  check('B21 칸 다섯 이상 다 됨 표시', doneCards.filter((x) => x.endsWith(':yes')).length >= 5, doneCards)
  await shot(page, 'B-done')
  await page.getByTestId('spec-cards-toggle').click()
  check('B21b 다 쓰면 맨 위에 "다 썼어요" · 명칭 · 청구항 수 · [MD 내려받기] · [제출 준비 묶음] (칸을 열지 않아도)', /다 썼어요/.test(await page.getByTestId('spec-board-head').innerText()) && (await page.getByTestId('spec-board-done-download').isVisible()) && (await page.getByTestId('spec-board-done-pack').isVisible()) && /청구항 3개/.test(await page.getByTestId('spec-board').innerText()))
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.getByTestId('spec-board-done-download').click()])
  check('B21c 맨 위 [MD 내려받기] 한 번에 파일', !!dl && /\.md$/.test(dl.suggestedFilename()), dl?.suggestedFilename())
  await shot(page, 'B-finished', false)
  // 모델 고르기 — 다 쓴 뒤에도 바꿀 수 있음
  await page.getByTestId('model-pick').click()
  await page.getByTestId('model-pick-panel').waitFor()
  await page.locator('[data-testid="ai-assist-settings"] [data-provider="gemini"]').click()
  await page.locator('[data-testid="ai-assist-model-option"][data-model="gemini-3.8-flash"]').click()
  await page.waitForTimeout(200)
  check('B6 모델 고르기 → 바꾸면 단추에 그 모델 · 이 브라우저에 기억', (await page.getByTestId('model-pick').getAttribute('data-model')) === 'gemini-3.8-flash' && (await page.evaluate(() => Object.keys(localStorage).some((k) => k.includes('ai.choice') && localStorage.getItem(k).includes('gemini-3.8-flash')))))
  await page.getByTestId('model-pick').click()
  await page.getByTestId('spec-cards-toggle').click()

  // 직접 고치기 = 예전 단계 화면에 AI 글이 그대로
  await page.locator('[data-testid="spec-card-edit"][data-card="body"]').click()
  await page.getByTestId('spec-tabs').waitFor()
  check('B22 [직접 고치기] → 예전 단계 화면(본문) · AI 글이 칸에', (await page.getByTestId('spec-tab-body').getAttribute('aria-selected')) === 'true' && (await page.locator('[data-testid="spec-section"][data-key="field"] [data-testid="spec-section-text"]').inputValue()).startsWith('본 발명은 공구 마모 판정'))
  await page.getByTestId('spec-view-ai').click()
  await page.getByTestId('spec-board').waitFor()
  await page.getByTestId('spec-cards-toggle').click()

  // 다른 아이디어로 바꾸기 → 한 번 더 묻고 · 구성 이후 비움 · 되돌리기
  dialogs.length = 0
  await page.getByTestId('spec-idea-use').first().click()
  await page.waitForTimeout(400)
  check('B23 다른 아이디어 → 한 번 더 묻기 · 명칭 바뀜 · 구성 비움', dialogs.length === 1 && (await page.getByTestId('spec-board-title').innerText()).includes('작업지시 데이터 기반') && (await page.getByTestId('spec-board-parts').count()) === 0, dialogs)
  await page.getByRole('button', { name: '되돌리기' }).first().click()
  await page.waitForTimeout(400)
  check('B24 되돌리기 → 앞 아이디어 · 구성 · 본문 그대로', (await page.getByTestId('spec-board-title').innerText()).includes('공구 진동정보 기반') && (await page.getByTestId('spec-board-parts').count()) === 1)

  // 쓰는 중에 나갔다 오기 — 본문만 다시(천천히)
  delayMs = 700
  const before = sent.length
  await page.locator('[data-testid="spec-card-run"][data-card="body"]').click()
  await page.waitForTimeout(300)
  const url = page.url()
  await page.getByTestId('spec-back-list').click()
  await page.getByTestId('spec-list').waitFor()
  await page.waitForTimeout(3600)
  // 화면 안에서 다시 열기(목록 → 같은 명세서) — 나가 있는 동안 쓴 글이 붙는다
  const draftId = new URL(url).searchParams.get('draft')
  await page.locator(`[data-testid="spec-row-open"][href*="${draftId}"]`).click()
  await page.getByTestId('spec-board').waitFor()
  await page.waitForTimeout(600)
  delayMs = 30
  check('B25 쓰는 중에 목록으로 나갔다 와도 네 번(a~d)만 부름 · 다시 안 부름', sent.slice(before).map((r) => r.assistId).join() === 'spec.a,spec.b,spec.c,spec.d', sent.slice(before).map((r) => r.assistId))

  // ?step= 으로 열면 단계 화면
  const draft = new URL(url).searchParams.get('draft')
  await page.goto(`${BASE}/patent-venture/write?draft=${draft}&client=${CLIENT}&step=claims`, { waitUntil: 'networkidle' })
  await page.getByTestId('spec-editor').waitFor()
  await page.getByTestId('spec-board').waitFor()
  const boardFirst = (await page.getByTestId('spec-tabs').count()) === 0
  await page.getByTestId('spec-view-edit').click()
  check('B26 ?step= (진행판 [이어서 하기]) 로 열어도 대표는 AI 작업판 먼저(타자 칸 없음) · [직접 고치기] 를 누르면 그 단계(청구항)', boardFirst && (await page.getByTestId('spec-tab-claims').getAttribute('aria-selected')) === 'true')
  await page.getByTestId('spec-tab-body').click()
  const field2 = await page.locator('[data-testid="spec-section"][data-key="field"] [data-testid="spec-section-text"]').inputValue()
  check('B27 새로 열어도 나가 있는 동안 쓴 AI 글이 저장돼 있음(본문 2차)', field2.includes('(2차)'), field2.slice(0, 80))
  await page.getByTestId('spec-view-ai').click()
  await page.getByTestId('spec-board').waitFor()
  await page.getByTestId('spec-cards-toggle').click()

  // 자료 넣기 — 글 파일 → 읽은 글만 · 개인정보 가림 (한글 파일 이름은 버퍼로 — 이 시험 기계는 LANG 이 비어 경로가 깨짐)
  await page.getByTestId('spec-board-file-input').setInputFiles({ name: '현장메모.txt', mimeType: 'text/plain', buffer: Buffer.from('공구 교체를 감으로 합니다. 담당자 연락처 010-1234-5678. 불량이 한 달에 20건 나옵니다.') })
  await page.waitForTimeout(800)
  check('B28 자료 넣기 → 올린 자료 1개', /올린 자료 1개/.test(await page.getByTestId('spec-board-mats').innerText()))
  const before2 = sent.length
  await page.locator('[data-testid="spec-card-run"][data-card="idea"]').click()
  await waitIdle(page)
  const ideaCtx2 = JSON.stringify(sent[before2].context)
  check('B29 다음 아이디어 내줘에 올린 자료가 감 · 휴대폰 번호는 가림', ideaCtx2.includes('공구 교체를 감으로') && !ideaCtx2.includes('010-1234-5678'), ideaCtx2.slice(0, 200))
  check('B30 이미 명칭이 있으면 후보만 바뀌고 명칭은 그대로', (await page.getByTestId('spec-board-title').innerText()).includes('공구 진동정보 기반'))
  check('B31 JS 오류 0', errors.length === 0, errors)
  await ctx.close()
}

/* ---------------- 휴대폰 ---------------- */
for (const width of [360, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await routeAi(page)
  await page.goto(BASE + '/patent-venture/write', { waitUntil: 'networkidle' })
  await page.getByTestId('spec-new-client').selectOption(CLIENT)
  await page.getByTestId('spec-new').click()
  await page.getByTestId('spec-board').waitFor()
  await page.waitForTimeout(1500)
  await waitIdle(page)
  await page.waitForTimeout(400)
  check(`M${width} 작업판 넘침 0 · JS 오류 0`, (await overflowX(page)) <= 0 && errors.length === 0, { o: await overflowX(page), errors })
  await shot(page, `M-${width}-board`)
  await ctx.close()
}

await browser.close()
console.log(`\nqa:specboard: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
