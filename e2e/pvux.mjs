/**
 * qa:pvux — D-249 특허 · 벤처 진행판 · 명세서 쓰기 길잡이. 실행: npm run qa:pvux -- http://localhost:4390 [사진 폴더]
 *  - [자세히](/patent-venture/more · D-250 첫 화면은 대화창): 처음이면 순서 안내(명세서 → 점검 → 사업계획서) + [견본으로 연습] · 도구 카드 셋 그대로
 *  - 견본 → 1~4단계 채워진 연습 초안 · 주소 step=idea · 견본 표시
 *  - 1 아이디어: [예시 보기] · 마케팅 말/짧은 답 알림 · 권리축 '~하는' 끝맺음 한 줄/한 번에 고치기 · [되돌리기]
 *  - 2 구성요소: 지우기 → 알림 [되돌리기] → 그대로 살아남 · 3 도면: 줄이기 → 되돌리기
 *  - 5 본문: 권장 길이 막대(빈칸 · 뼈대 그대로 · 알맞음 · 긴 편)
 *  - 6 점검: 제출 준비 묶음 ZIP(spec.md · fig1 · fig2 PNG · checklist.txt) · 확인표 미리 보기 · 회사 고르기
 *  - PC 넓은 화면: 오른쪽 고정판(진행 · 단계로 가기 · 고칠 것 · 지금 할 것) · 내려도 따라옴
 *  - 진행판: 회사 줄 · 단계 점 · [이어서 하기] → 그 단계 바로(step=) · 숫자 칩
 *  - 사업계획서 재료: 같은 회사 명세서 → [이 명세서를 재료로](파일 없이) · 진행판에 '특허 재료 있음'
 *  - 목록 지우기 → [되돌리기]로 되살림 · 주소 step=claims 로 바로 열기
 *  - 휴대폰 360 · 390 · 430 · 글자 아주 크게: 고정 단계 줄(이전 · n/6 · 다음 · 내려도 위에 붙음) · 가로 넘침 0 · JS 오류 0
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { seedScript } from './seed.mjs'

// D-252 AI 판이 기본 화면 — 칸을 직접 고치는 예전 시험은 [직접 고치기] 로 바꾼 뒤에(D-261 주소에 step 이 있어도 대표는 AI 판 먼저 — step 은 [직접 고치기] 를 누르면 열릴 탭)
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
const undoLast = async (page) => {
  const btn = page.getByTestId('toast-stack').getByTestId('toast-action').last()
  await btn.waitFor({ timeout: 4000 })
  const label = await btn.innerText()
  await btn.click()
  await page.waitForTimeout(250)
  return label
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- PC 1440 ---------------- */
let sampleId = ''
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())

  // 첫 화면 — 처음이면 순서 안내
  await page.goto(BASE + '/patent-venture/more', { waitUntil: 'networkidle' })
  await page.getByTestId('pv-empty').waitFor()
  const flow = await page.getByTestId('pv-flow').locator('li').allInnerTexts()
  check('처음: 순서 안내 셋(명세서 쓰기 → 점검 · 내보내기 → 벤처 사업계획서) · 진행판은 아직 없음', flow.length === 3 && /특허 명세서 쓰기/.test(flow[0]) && /점검/.test(flow[1]) && /벤처 사업계획서/.test(flow[2]) && (await page.getByTestId('pv-board').count()) === 0, flow)
  const cards = await page.locator('[data-testid^="pv-card-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))
  check('도구 카드 셋 그대로(명세서 쓰기 · 사업계획서 · 명세서 점검) · 안내 한 줄', cards.join() === 'pv-card-write,pv-card-plan,pv-card-spec' && /기업인증 › 벤처기업/.test(await page.getByTestId('pv-note').innerText()), cards)
  await shot(page, 'pvux-01-home-empty')

  // 견본으로 연습
  await page.getByTestId('pv-empty-sample').click()
  await page.waitForURL(/\/patent-venture\/write\?draft=.*step=idea/)
  await page.getByTestId('spec-editor').waitFor()
  await toEdit(page)
  sampleId = new URL(page.url()).searchParams.get('draft') ?? ''
  check('견본 → 주소 step=idea · 1 아이디어 탭 · 5/6단계 · 견본 표시 · 명칭 채워짐', (await page.getByTestId('spec-tab-idea').getAttribute('aria-selected')) === 'true' && (await page.getByTestId('spec-editor').getAttribute('data-progress')) === '5/6' && /견본/.test(await page.getByTestId('spec-editor').innerText()) && (await page.getByTestId('spec-title').inputValue()).startsWith('공구 진동정보'))
  check('PC 넓은 화면: 오른쪽 고정판 보임 · 작은 화면 단계 줄 숨김', await page.getByTestId('spec-rail').isVisible() && !(await page.getByTestId('spec-bar').isVisible()))

  // 예시 보기
  check('예시는 처음엔 닫힘', (await page.getByTestId('spec-idea-ex-problem').count()) === 0)
  await page.getByTestId('spec-idea-examples').click()
  await page.getByTestId('spec-axis-examples').click()
  check('[예시 보기] → 다섯 질문 · 권리축 일곱 줄마다 예시', (await page.locator('[data-testid^="spec-idea-ex-"]').count()) === 5 && (await page.locator('[data-testid^="spec-axis-ex-"]').count()) === 7 && /진동신호를 수집하는/.test(await page.getByTestId('spec-axis-ex-input').innerText()))

  // 아이디어 답 알림
  const problem0 = await page.getByTestId('spec-idea-problem').inputValue()
  await page.getByTestId('spec-idea-problem').fill('혁신적인 최고의 공구 관리')
  check("마케팅 말 → '사실로 적어 주세요' 알림", /사실로/.test(await page.getByTestId('spec-idea-hint-problem').innerText()))
  await page.getByTestId('spec-idea-problem').fill('불량이 많다')
  check("짧은 답 → '한 문장만 더' 알림", /한 문장만 더/.test(await page.getByTestId('spec-idea-hint-problem').innerText()))
  await page.getByTestId('spec-idea-problem').fill(problem0)
  check('제대로 쓰면 알림 없음', (await page.getByTestId('spec-idea-hint-problem').count()) === 0)

  // 권리축 끝맺음
  await page.getByTestId('spec-axis-input').fill('공구의 진동신호를 수집한다.')
  check("한 줄: '~한다' → '~하는' 고친 안 보여 줌", /공구의 진동신호를 수집하는/.test(await page.getByTestId('spec-axis-fix-input').innerText()) && (await page.getByTestId('spec-axis-fix-banner').count()) === 0)
  await page.getByTestId('spec-axis-fix-use-input').click()
  check('[이렇게 고치기] → 그 줄만 고침', (await page.getByTestId('spec-axis-input').inputValue()) === '공구의 진동신호를 수집하는' && (await page.getByTestId('spec-axis-fix-input').count()) === 0)
  await page.getByTestId('spec-axis-input').fill('공구의 진동신호를 수집한다')
  await page.getByTestId('spec-axis-judge').fill('마모 단계 판정')
  check('두 줄 이상 → 맨 위 [한 번에 고치기] 띠', /2개/.test(await page.getByTestId('spec-axis-fix-banner').innerText()))
  await shot(page, 'pvux-02-idea-coach')
  await page.getByTestId('spec-axis-fix-all').click()
  check('[한 번에 고치기] → 두 줄 다 ~하는', (await page.getByTestId('spec-axis-input').inputValue()) === '공구의 진동신호를 수집하는' && (await page.getByTestId('spec-axis-judge').inputValue()) === '마모 단계 판정을 수행하는')
  const undoLabel = await undoLast(page)
  check('알림 [되돌리기] → 고치기 전 글로', undoLabel.includes('되돌리기') && (await page.getByTestId('spec-axis-input').inputValue()) === '공구의 진동신호를 수집한다' && (await page.getByTestId('spec-axis-judge').inputValue()) === '마모 단계 판정')
  await page.getByTestId('spec-axis-fix-all').click()
  await page.getByTestId('spec-axis-judge').fill('마모 지수와 기준값을 비교하여 마모 단계를 판정하는')
  await page.getByTestId('spec-axis-judge').blur()

  // 2 구성요소 — 지우기 → 되돌리기
  await page.getByTestId('spec-rail-parts').click()
  await page.getByTestId('spec-step-parts').waitFor()
  const names0 = await page.getByTestId('spec-comp-name').evaluateAll((els) => els.map((e) => e.value))
  await page.getByTestId('spec-comp-remove').nth(3).click()
  const names1 = await page.getByTestId('spec-comp-name').evaluateAll((els) => els.map((e) => e.value))
  check('오른쪽 판 [2 구성요소 · 단계] → 그 단계 · 지우면 바로 5개', names0.length === 6 && names1.length === 5 && !names1.includes('마모판정부'), { names0, names1 })
  await undoLast(page)
  const names2 = await page.getByTestId('spec-comp-name').evaluateAll((els) => els.map((e) => e.value))
  check('[되돌리기] → 마모판정부 제자리(6개 · 순서 그대로)', names2.join() === names0.join(), names2)
  await page.getByTestId('spec-seed-remove').first().click()
  await undoLast(page)
  check('종속항 씨앗 지우기 → 되돌리기', (await page.getByTestId('spec-seed').count()) === 2)

  // 3 도면 — 줄이기 → 되돌리기
  await page.getByTestId('spec-tab-figures').click()
  await page.getByTestId('spec-fig-count').selectOption('5')
  await page.getByTestId('spec-fig-subject').nth(4).fill('교체 결과 재반영 화면')
  await page.getByTestId('spec-fig-subject').nth(4).blur()
  await page.getByTestId('spec-fig-count').selectOption('3')
  check('도면 5 → 3장', (await page.getByTestId('spec-fig-row').count()) === 3)
  await undoLast(page)
  check('되돌리기 → 5장 · 도 5에 적은 글 그대로', (await page.getByTestId('spec-fig-row').count()) === 5 && (await page.getByTestId('spec-fig-subject').nth(4).inputValue()) === '교체 결과 재반영 화면')
  check('도면 그림: 이미지 둘 다 열림(도 1 상자 6)', (await page.getByTestId('spec-fig-1').getAttribute('data-boxes')) === '6' && (await page.getByTestId('spec-fig-2-img').evaluate((img) => img.complete && img.naturalWidth > 0)))
  await shot(page, 'pvux-03-figures')

  // 5 본문 — 길이 막대
  await page.getByTestId('spec-rail-body').click()
  await page.getByTestId('spec-step-body').waitFor()
  const meter = (k) => page.locator(`[data-testid="spec-section"][data-key="${k}"] [data-testid="spec-section-meter"]`)
  check('빈 칸 → 막대 "아직 비었음" · 권장 범위 표시', (await meter('field').getAttribute('data-state')) === 'empty' && /권장 30~200자/.test(await meter('field').innerText()))
  await page.locator('[data-testid="spec-section"][data-key="field"] [data-testid="spec-section-fill"]').click()
  check('뼈대 넣기 → "뼈대 그대로 — 고쳐 써 주세요"', (await meter('field').getAttribute('data-state')) === 'skeleton')
  await page.locator('[data-testid="spec-section"][data-key="field"] [data-testid="spec-section-text"]').fill('본 발명은 공구 진동정보를 이용하여 공구의 마모상태를 판정하고 교체시점을 산출하는 시스템 및 방법에 관한 것이다.')
  check('고쳐 쓰면 → 알맞음', (await meter('field').getAttribute('data-state')) === 'ok')
  await page.locator('[data-testid="spec-section"][data-key="abstract"] [data-testid="spec-section-text"]').fill('가'.repeat(420))
  check('요약 420자 → 긴 편(400자 넘음)', (await meter('abstract').getAttribute('data-state')) === 'long')
  await page.locator('[data-testid="spec-section"][data-key="abstract"] [data-testid="spec-section-text"]').fill('')
  await page.locator('[data-testid="spec-section"][data-key="abstract"] [data-testid="spec-section-text"]').blur()
  // 오른쪽 판 — 내려도 따라옴
  await page.evaluate(() => window.scrollTo(0, 2400))
  await page.waitForTimeout(200)
  const railTop = await page.getByTestId('spec-rail').locator('> div').evaluate((el) => el.getBoundingClientRect().top)
  check('본문을 내려도 오른쪽 판이 화면 위에 붙어 있음', railTop >= 60 && railTop <= 100, railTop)
  await shot(page, 'pvux-04-body-meter', false)

  // 6 점검 — 제출 준비 묶음
  await page.getByTestId('spec-tab-check').click()
  await page.getByTestId('spec-step-check').waitFor()
  await page.getByText('제출 전 확인표 미리 보기').click()
  check('제출 전 확인표 미리 보기 — 명칭 · 청구항 · 도면 · 손으로 볼 것', await page.getByTestId('spec-checklist').evaluate((el) => el.textContent ?? '').then((t) => /특허로 제출 전 확인표/.test(t) && /발명의 명칭: 공구 진동정보/.test(t) && /도면: 5장/.test(t) && (t.match(/\[ \]/g) ?? []).length === 7))
  const [zip] = await Promise.all([page.waitForEvent('download'), page.getByTestId('spec-pack').click()])
  const zipPath = await zip.path()
  const bytes = readFileSync(zipPath)
  const asText = bytes.toString('latin1')
  const utf = bytes.toString('utf8')
  const pngCount = (asText.match(/\x89PNG/g) ?? []).length
  check('ZIP 받기 → patent-pack-날짜.zip · spec.md · fig1 · fig2 PNG · checklist.txt', /^patent-pack-\d{8}\.zip$/.test(zip.suggestedFilename()) && ['spec.md', 'fig1-draft.png', 'fig2-draft.png', 'checklist.txt'].every((n) => asText.includes(n)) && pngCount === 2, { name: zip.suggestedFilename(), pngCount })
  check('묶음 안 명세서 · 확인표 글(한글) 그대로', utf.includes('[발명의 명칭]') && utf.includes('특허로 제출 전 확인표') && utf.includes('공구 진동정보 기반'))
  await shot(page, 'pvux-05-check-pack')
  // 회사 고르기 → 진행판 줄이 회사로
  await page.getByTestId('spec-venture-client').selectOption(CLIENT)
  await page.waitForURL(new RegExp(`client=${CLIENT}`))
  await page.waitForTimeout(400)

  // 진행판
  await page.goto(BASE + '/patent-venture/more', { waitUntil: 'networkidle' })
  await page.getByTestId('pv-board').waitFor()
  const row = page.locator(`[data-testid="pv-row"][data-key="${CLIENT}"]`)
  check('진행판: 회사 줄 하나 · 견본(연습용) 이름이 아닌 회사 이름 · 명세서 쓰는 중', (await page.getByTestId('pv-row').count()) === 1 && (await row.count()) === 1 && (await row.getAttribute('data-stage')) === 'spec' && !/견본\(연습용\)/.test(await row.getByTestId('pv-row-name').innerText()))
  check('줄 안 단계 점: 명세서 · 점검 · 사업계획서 아직', (await row.getByTestId('pv-row-flow').locator('[data-done="1"]').count()) === 0)
  check('숫자 칩: 진행 중 1', (await page.getByTestId('pv-sum-active').getAttribute('data-n')) === '1')
  const nextHref = await row.getByTestId('pv-row-next').getAttribute('href')
  check('[이어서 하기] 주소 = 그 명세서 · 그 회사 · 5 본문', nextHref.includes(`draft=${sampleId}`) && nextHref.includes(`client=${CLIENT}`) && nextHref.endsWith('step=body'), nextHref)
  await shot(page, 'pvux-06-board')
  await row.getByTestId('pv-row-next').click()
  await page.getByTestId('spec-editor').waitFor()
  await toEdit(page)
  await page.getByTestId('spec-step-body').waitFor()
  check('[이어서 하기] → 5 본문 탭 바로', (await page.getByTestId('spec-tab-body').getAttribute('aria-selected')) === 'true')

  // 주소 step=claims
  await page.goto(`${BASE}/patent-venture/write?draft=${sampleId}&client=${CLIENT}&step=claims`, { waitUntil: 'networkidle' })
  await page.getByTestId('spec-editor').waitFor()
  await toEdit(page)
  await page.getByTestId('spec-step-claims').waitFor()
  check('주소 step=claims → 4 청구항 바로', (await page.getByTestId('spec-tab-claims').getAttribute('aria-selected')) === 'true')
  await page.goto(`${BASE}/patent-venture/write?draft=${sampleId}&step=oops`, { waitUntil: 'networkidle' })
  await page.getByTestId('spec-editor').waitFor()
  await toEdit(page)
  check('주소 step 이상한 값 → 평소처럼(명칭 있으면 2 구성요소)', (await page.getByTestId('spec-tab-parts').getAttribute('aria-selected')) === 'true')

  // 사업계획서 재료 ← 같은 회사 명세서
  await page.goto(`${BASE}/patent-venture/plan?client=${CLIENT}`, { waitUntil: 'networkidle' })
  await page.getByTestId('vplan').waitFor()
  if ((await page.getByTestId('vplan-part-mat').count()) === 0) await page.getByTestId('vplan-tab-mat').click()
  await page.getByTestId('vplan-spec-drafts').waitFor()
  check('재료: 이 회사 명세서 1건 — 파일 없이 바로', (await page.getByTestId('vplan-spec-draft').count()) === 1 && /공구 진동정보/.test(await page.getByTestId('vplan-spec-draft').innerText()))
  await page.getByTestId('vplan-spec-draft-use').click()
  await page.waitForTimeout(500)
  const mat = await page.getByTestId('vplan-mat-patent').inputValue()
  check('[이 명세서를 재료로] → 특허 재료에 명칭 · 청구항 · 파일 이름 자리에 "명세서 쓰기 · …"', /공구 진동정보 기반/.test(mat) && /청구항/.test(mat) && /명세서 쓰기 · 공구 진동정보/.test(await page.getByTestId('vplan-spec-file').innerText()) && /청구항 \d+개/.test(await page.getByTestId('vplan-spec-info').innerText()), mat.slice(0, 200))
  await shot(page, 'pvux-07-plan-material')
  await page.goto(BASE + '/patent-venture/more', { waitUntil: 'networkidle' })
  await page.getByTestId('pv-board').waitFor()
  check('진행판: 사업계획서 칸에 "특허 재료 있음"', /특허 재료 있음/.test(await page.locator(`[data-testid="pv-row"][data-key="${CLIENT}"]`).getByTestId('pv-row-plan').innerText()))

  // 목록 지우기 → 되돌리기
  await page.goto(BASE + '/patent-venture/write', { waitUntil: 'networkidle' })
  await page.getByTestId('spec-list').waitFor()
  check('목록: 견본 표시 · 진행 막대', /견본 · 연습용/.test(await page.getByTestId('spec-row').first().innerText()) && (await page.getByTestId('spec-row').first().getAttribute('data-sample')) === '1')
  await page.getByTestId('spec-row-remove').first().click()
  await page.getByTestId('spec-row-remove-yes').click()
  await page.waitForTimeout(300)
  check('지우기 → 목록 0', (await page.getByTestId('spec-row').count()) === 0)
  await undoLast(page)
  await page.waitForTimeout(300)
  check('[되돌리기] → 되살아남(같은 명세서)', (await page.getByTestId('spec-row').count()) === 1 && ((await page.getByTestId('spec-row-open').first().getAttribute('href')) ?? '').includes(sampleId))

  check('PC: JS 오류 0', errors.length === 0, errors)
  await ctx.close()
}

/* ---------------- 휴대폰 ---------------- */
for (const [width, scale] of [
  [390, ''],
  [360, 'extra_large'],
  [430, ''],
]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  if (scale) await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
  const tag = `${width}${scale ? ' 글자 아주 크게' : ''}`
  await page.goto(BASE + '/patent-venture/more', { waitUntil: 'networkidle' })
  if (scale) await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
  await page.getByTestId('pv-empty').waitFor()
  check(`${tag}: 첫 화면 가로 넘침 0`, (await overflowX(page)) <= 0, await overflowX(page))
  if (width === 390) await shot(page, 'pvux-11-home-390')
  await page.getByTestId('pv-empty-sample').click()
  await page.getByTestId('spec-editor').waitFor()
  await toEdit(page)
  if (scale) await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
  check(`${tag}: 단계 줄 보임 · 오른쪽 판 숨김 · 1/6`, (await page.getByTestId('spec-bar').isVisible()) && !(await page.getByTestId('spec-rail').isVisible()) && /1\/6/.test(await page.getByTestId('spec-bar-title').innerText()))
  await page.evaluate(() => window.scrollTo(0, 1500))
  await page.waitForTimeout(200)
  const barTop = await page.getByTestId('spec-bar').evaluate((el) => el.getBoundingClientRect().top)
  const headBottom = await page.locator('header').first().evaluate((el) => el.getBoundingClientRect().bottom)
  check(`${tag}: 내려도 단계 줄이 머리줄 바로 아래 붙음`, Math.abs(barTop - headBottom) <= 2, { barTop, headBottom })
  let maxOver = 0
  const over = []
  for (let i = 0; i < 5; i += 1) {
    const o = await overflowX(page)
    if (o > maxOver) maxOver = o
    if (o > 0) over.push(i)
    await page.getByTestId('spec-bar-next').click()
    await page.waitForTimeout(250)
  }
  check(`${tag}: [다음] 다섯 번 → 6/6 내보내기 · 단계마다 가로 넘침 0`, /6\/6/.test(await page.getByTestId('spec-bar-title').innerText()) && (await page.getByTestId('spec-tab-check').getAttribute('aria-selected')) === 'true' && maxOver <= 0 && (await overflowX(page)) <= 0, { maxOver, over })
  check(`${tag}: 마지막 단계에서 [다음] 꺼짐 · [이전] 켜짐`, (await page.getByTestId('spec-bar-next').isDisabled()) && !(await page.getByTestId('spec-bar-prev').isDisabled()))
  const barBox = await page.getByTestId('spec-bar').boundingBox()
  // 글자 아주 크게는 rem 이 1.3배 — 같은 줄 수면 높이도 1.3배
  check(`${tag}: 단계 줄 높이 ${scale ? 100 : 80}px 이하(줄 셋 · 단추 하나 높이)`, barBox && barBox.height <= (scale ? 100 : 80), barBox)
  if (width === 390) {
    await page.evaluate(() => window.scrollTo(0, 0))
    await shot(page, 'pvux-12-check-390')
    await page.getByTestId('spec-bar-prev').click()
    await page.evaluate(() => window.scrollTo(0, 900))
    await page.waitForTimeout(200)
    await shot(page, 'pvux-13-body-390-bar', false)
  }
  if (scale) {
    await page.getByTestId('spec-tab-idea').click()
    await page.getByTestId('spec-idea-examples').click()
    await page.getByTestId('spec-axis-input').fill('공구의 진동신호를 수집한다')
    await page.getByTestId('spec-axis-judge').fill('마모 단계 판정')
    check(`${tag}: 1 아이디어 예시 · 고치기 띠 열어도 가로 넘침 0`, (await overflowX(page)) <= 0, await overflowX(page))
    await shot(page, 'pvux-14-idea-360-xl')
  }
  await page.goto(BASE + '/patent-venture/more', { waitUntil: 'networkidle' })
  if (scale) await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
  await page.getByTestId('pv-board').waitFor()
  check(`${tag}: 진행판 가로 넘침 0`, (await overflowX(page)) <= 0, await overflowX(page))
  if (width === 360) await shot(page, 'pvux-15-board-360-xl')
  check(`${tag}: JS 오류 0`, errors.length === 0, errors)
  await ctx.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
