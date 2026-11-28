/**
 * D-680 마케팅 ↔ 고객사 — 고객 사례를 글에 쓸 때의 확인 단계(LINK-4).
 *
 *   node e2e/clientcase.mjs <baseUrl> [사진 폴더]
 *
 *  C  스레드 쓰기: 들어오면 사례 단추 · 확인 줄 0(평소엔 아무것도 안 그림) → [더 보기] › 사실 목록 › [내 고객 사례 넣기] →
 *     업체 찾기 → 이름을 가린 한 줄(회사 이름 · 대표 이름 · 번호 0) → 재료 빼기 → [사실 목록에 넣기] → 사실 칸 · 주제 칸
 *  G  고객 이름 확인: 주제에 고객 이름 → 확인 줄 → [가리기] → '한 ○○ 회사' · 글 칸에서 회사 · 대표 · 전화 →
 *     [지우기] · [허락받았어요](한 번 더 묻기) → 업체 기록에 날짜 · 활동 기록 → [허락 취소] · [고객 이름 아님]
 *  L  고객사 → 마케팅: 업체 [더보기] › [이 업체 사례로 글 쓰기] → 그 업체로 판이 열림(주소 값은 지워짐) ·
 *     [사례 공개 허락받음으로 적기] → 글 쓰기 화면이 허락받은 고객으로 보여 줌
 *  S  릴스 · 틱톡 쓰기에서도 같은 단추 · 같은 확인 줄
 *  M  390 휴대폰 — 넘침 0 · 단추 40px · 글자 15px
 * 로컬 견본 데이터(seed)로 돈다 — AI 는 부르지 않는다(규칙만).
 */
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'
import { openQsMore } from './support/mkOpen.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.argv[3] ?? ''
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) {
    pass++
    console.log('PASS ', n)
  } else {
    fail++
    console.log('FAIL ', n, d === undefined ? '' : String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700))
  }
}
const shot = async (p, name, full = false) => {
  if (!SHOTS) return
  // 판이 떠오르는 움직임이 끝난 뒤에 찍는다
  await p.waitForTimeout(450)
  await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full })
}
const CLIENTS_KEY = 'axmvp.v1.operations_clients'
const clientOf = (p, id) => p.evaluate(([k, i]) => JSON.parse(localStorage.getItem(k) ?? '[]').find((c) => c.id === i) ?? null, [CLIENTS_KEY, id])
const clearDrafts = (p) =>
  p.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (/mirae\.(threads|shorts)\.draft|axmvp\.fold\.(thr|sht)/.test(k)) localStorage.removeItem(k)
  })
const overflowX = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
const openFacts = async (p, pre) => {
  await openQsMore(p, pre)
  const box = p.getByTestId(`${pre}-facts-box`)
  if (!(await box.evaluate((e) => e.open))) await box.locator('summary').click()
}
const hits = (p, pre) =>
  p.locator(`[data-testid="${pre}-case-hit"]`).evaluateAll((els) => els.map((e) => ({ kind: e.getAttribute('data-kind'), consent: e.getAttribute('data-consent'), text: e.querySelector('[data-testid$="-case-text"]')?.textContent?.trim() ?? '' })))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(seedScript())
// 들어왔을 때 모양을 보려고 [모두 펼치기] 는 끈다
await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))
await clearDrafts(page)
const today = await page.evaluate(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})
const dayText = `${Number(today.slice(5, 7))}월 ${Number(today.slice(8, 10))}일`

/* ---------------- C 사례 넣기 ---------------- */
await page.goto(BASE + '/marketing/threads', { waitUntil: 'networkidle' })
await page.getByTestId('thr-qs').waitFor({ timeout: 15000 })
check('C1 들어오면 사례 단추 · 고객 이름 확인 줄 · 판이 없다(평소에는 아무것도 그리지 않음)', (await page.getByTestId('thr-case-open').isVisible().catch(() => false)) === false && (await page.getByTestId('thr-case-guard').count()) === 0 && (await page.getByTestId('thr-case-pick').count()) === 0)
await openFacts(page, 'thr')
const openBtn = page.getByTestId('thr-case-open')
check('C2 [더 보기] › 사실 목록 안에 [내 고객 사례 넣기] 하나 · 안내 열쇠(fn-mk-case)', (await openBtn.count()) === 1 && (await openBtn.isVisible()) && (await openBtn.getAttribute('data-guide')) === 'fn-mk-case' && (await openBtn.innerText()).includes('내 고객 사례 넣기'))
await shot(page, 'c2-facts-open')
await openBtn.click()
await page.getByTestId('thr-case-pick').waitFor({ timeout: 5000 })
const rows0 = await page.getByTestId('thr-case-client').allInnerTexts()
check('C3 판 — 업체 찾기 칸 + 업체 목록(5줄까지) · 내 고객 관리의 업체', rows0.length === 5 && rows0.some((t) => t.includes('한솔테크')) && (await page.getByTestId('thr-case-search').count()) === 1 && (await page.getByTestId('thr-case-more').count()) === 0, rows0)
await shot(page, 'c3-pick')
await page.getByTestId('thr-case-search').fill('한솔 테크')
const rows1 = await page.getByTestId('thr-case-client').allInnerTexts()
check('C4 이름으로 찾기(띄어 써도) → 한 곳', rows1.length === 1 && rows1[0].includes('한솔테크'), rows1)
await page.getByTestId('thr-case-client').first().click()
await page.getByTestId('thr-case-preview').waitFor({ timeout: 5000 })
const line0 = (await page.getByTestId('thr-case-line').innerText()).trim()
const SECRET = ['한솔', '김대표', '123-45', '67890', '010', '12명', '2019']
check('C5 미리 보기 — 이름을 가린 한 줄(업종 · 규모대 · 업력대 · 함께 한 일) · 회사 이름 · 대표 · 번호 · 정확한 수 0', line0.startsWith('[고객 사례 · 이름 가림] 소프트웨어 개발 회사(직원 10명대 · 창업 7~15년) — 함께 한 일: ') && line0.includes('(마침)') && SECRET.every((x) => !line0.includes(x)), line0)
const partKeys = await page.locator('[data-testid="thr-case-part"]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-part')}:${e.getAttribute('aria-pressed')}`))
check('C6 재료 칩 — 아는 것만(주소가 없는 업체는 지역 칩 없음) · 모두 켜진 채 · 4개 이하', partKeys.join() === 'industry:true,size:true,age:true', partKeys)
await shot(page, 'c5-preview')
await page.locator('[data-testid="thr-case-part"][data-part="size"]').click()
const line1 = (await page.getByTestId('thr-case-line').innerText()).trim()
await page.locator('[data-testid="thr-case-part"][data-part="size"]').click()
const line2 = (await page.getByTestId('thr-case-line').innerText()).trim()
check('C7 칩을 누르면 그 재료가 빠지고 · 다시 누르면 돌아온다', !line1.includes('직원 10명대') && line1.includes('창업 7~15년') && line2 === line0, line1)
await page.getByTestId('thr-case-insert').click()
await page.getByTestId('thr-case-preview').waitFor({ state: 'detached', timeout: 5000 })
const facts1 = await page.getByTestId('thr-facts').inputValue()
const topic1 = await page.getByTestId('thr-qs-topic').inputValue()
check('C8 [사실 목록에 넣기] → 판 닫힘 · 사실 칸에 그 한 줄 · 비어 있던 주제 칸에 사례 주제(이름 없음) · 확인 줄은 안 뜸', facts1 === line0 && topic1.startsWith('소프트웨어 개발 회사 ') && topic1.endsWith('진행 이야기') && (await page.getByTestId('thr-case-guard').count()) === 0, { facts1, topic1 })
await page.getByTestId('thr-case-open').click()
await page.getByTestId('thr-case-search').fill('우일')
await page.getByTestId('thr-case-client').first().click()
const lineW = (await page.getByTestId('thr-case-line').innerText()).trim()
check('C9 주소가 있는 업체 — 시 · 도까지만(충남) · 시 · 군 · 번지 · 대표 이름 0', lineW.includes('충남 기계 부품 회사') && !lineW.includes('보령') && !lineW.includes('대해로') && !lineW.includes('장정순') && !lineW.includes('우일'), lineW)
await page.getByTestId('thr-case-insert').click()
await page.getByTestId('thr-case-preview').waitFor({ state: 'detached', timeout: 5000 })
const facts2 = await page.getByTestId('thr-facts').inputValue()
check('C10 한 번 더 넣으면 아래 줄에 덧붙는다(앞 줄 · 적어 둔 주제는 그대로)', facts2 === `${line0}\n${lineW}` && (await page.getByTestId('thr-qs-topic').inputValue()) === topic1, facts2)

/* ---------------- G 고객 이름 확인 ---------------- */
await page.getByTestId('thr-qs-topic').fill('한솔테크(주) 벤처인증 후기')
await page.getByTestId('thr-case-guard').waitFor({ timeout: 5000 })
const g1 = await hits(page, 'thr')
check('G1 주제에 내 고객 이름 → [AI로 쓰기] 아래 확인 줄 하나("한솔테크(주)" · 허락 전)', g1.length === 1 && g1[0].kind === 'company' && g1[0].consent === '0' && g1[0].text.includes('"한솔테크(주)"') && g1[0].text.includes('내 고객 이름이에요') && (await page.getByTestId('thr-case-guard').getAttribute('data-at')) === 'start', g1)
await shot(page, 'g1-guard-start')
await page.getByTestId('thr-case-hide').click()
const topic2 = await page.getByTestId('thr-qs-topic').inputValue()
check('G2 [가리기] → 주제가 "한 소프트웨어 개발 회사 …" 로 · 확인 줄 사라짐', topic2 === '한 소프트웨어 개발 회사 벤처인증 후기' && (await page.getByTestId('thr-case-guard').count()) === 0, topic2)
await page.getByTestId('thr-hand').click()
await page.getByTestId('thr-body').waitFor({ timeout: 5000 })
await page.getByTestId('thr-body').fill('우일산업이 특허를 냈어요. 장정순 대표님은 처음엔 망설이셨죠.\n문의는 010-2345-6789 로. 미래를 준비하는 회사라면 꼭 보세요.')
await page.waitForTimeout(200)
const g3 = await hits(page, 'thr')
const guards = await page.locator('[data-testid="thr-case-guard"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-at')))
check('G3 글 칸 — 회사 이름 · 대표 이름(호칭까지) · 고객 전화를 찾는다 · "미래를" 은 고객 이름이 아니다 · 확인 줄은 규칙 검사 위 한 곳', g3.length === 3 && g3.filter((h) => h.kind === 'company' && h.text.includes('"우일산업"')).length === 1 && g3.filter((h) => h.kind === 'person' && h.text.includes('"장정순 대표님"')).length === 1 && g3.filter((h) => h.kind === 'number' && h.text.includes('010-2345-6789')).length === 1 && guards.join() === 'edit', { g3, guards })
await shot(page, 'g3-guard-edit', true)
const numRow = page.locator('[data-testid="thr-case-hit"][data-kind="number"]')
check('G4 번호 줄 — [지우기] 만(허락 단추 없음)', (await numRow.getByTestId('thr-case-hide').innerText()).includes('지우기') && (await numRow.getByTestId('thr-case-consent').count()) === 0 && (await numRow.getByTestId('thr-case-skip').count()) === 0)
await numRow.getByTestId('thr-case-hide').click()
const body1 = await page.getByTestId('thr-body').inputValue()
check('G5 [지우기] → 번호만 사라지고 다른 글 · 다른 이름은 그대로', !body1.includes('010-2345-6789') && body1.includes('우일산업이') && body1.includes('장정순 대표님은') && body1.includes('문의는 로.'), body1)
const coRow = page.locator('[data-testid="thr-case-hit"][data-kind="company"]')
await coRow.getByTestId('thr-case-consent').click()
const ask = (await page.getByTestId('thr-case-ask').innerText()).trim()
check('G6 [허락받았어요] → 바로 적지 않고 한 번 더 묻는다(업체 이름 · 오늘 날짜로 남는다)', ask.includes('우일산업') && ask.includes('허락받았나요') && !(await clientOf(page, 'cli_wooil')).caseConsent, ask)
await shot(page, 'g6-ask')
await page.getByTestId('thr-case-no').click()
check('G7 [취소] → 아무것도 적지 않음', (await page.getByTestId('thr-case-ask').count()) === 0 && !(await clientOf(page, 'cli_wooil')).caseConsent)
await coRow.getByTestId('thr-case-consent').click()
await page.getByTestId('thr-case-yes').click()
await page.waitForFunction(() => document.querySelectorAll('[data-testid="thr-case-hit"][data-consent="1"]').length === 2, null, { timeout: 8000 }).catch(() => {})
const w1 = await clientOf(page, 'cli_wooil')
const g8 = await hits(page, 'thr')
check('G8 [네, 받았어요] → 업체 기록에 오늘 날짜 · 활동 기록 한 줄 · 그 업체의 회사 · 대표 이름이 "허락받은 고객" 으로', w1.caseConsent?.at === today && w1.activity?.[0]?.text?.includes('사례 공개 허락받음') && g8.length === 2 && g8.every((h) => h.consent === '1' && h.text.includes(`허락받은 고객이에요(${dayText})`)), { consent: w1.caseConsent, act: w1.activity?.[0]?.text, g8 })
await shot(page, 'g8-consented', true)
check('G9 허락받은 줄 — [가리기] · [허락 취소] 만', (await coRow.getByTestId('thr-case-hide').count()) === 1 && (await coRow.getByTestId('thr-case-revoke').count()) === 1 && (await coRow.getByTestId('thr-case-consent').count()) === 0)
await coRow.getByTestId('thr-case-revoke').click()
await page.waitForFunction(() => document.querySelectorAll('[data-testid="thr-case-hit"][data-consent="0"]').length === 2, null, { timeout: 8000 }).catch(() => {})
const w2 = await clientOf(page, 'cli_wooil')
check('G10 [허락 취소] → 업체 기록에서 허락이 지워지고 · 활동 기록에 남고 · 다시 허락 전으로', !w2.caseConsent && w2.activity?.[0]?.text?.includes('사례 공개 허락 취소') && (await hits(page, 'thr')).every((h) => h.consent === '0'), { c: w2.caseConsent, act: w2.activity?.[0]?.text })
await coRow.getByTestId('thr-case-skip').click()
const g11 = await hits(page, 'thr')
check('G11 [고객 이름 아님] → 그 줄만 넘김(글은 그대로) · 다른 줄은 남는다', g11.length === 1 && g11[0].kind === 'person' && (await page.getByTestId('thr-body').inputValue()).includes('우일산업이'), g11)
await page.locator('[data-testid="thr-case-hit"][data-kind="person"]').getByTestId('thr-case-hide').click()
const body2 = await page.getByTestId('thr-body').inputValue()
check('G12 사람 이름 [가리기] → "대표님은" · 확인 줄 사라짐', body2.includes('대표님은 처음엔') && !body2.includes('장정순') && (await page.getByTestId('thr-case-guard').count()) === 0, body2)

/* ---------------- L 고객사 → 마케팅 ---------------- */
await clearDrafts(page)
await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
await page.getByTestId('client-more').click()
const moreCase = page.getByTestId('more-case')
check('L1 업체 [더보기] 에 [이 업체 사례로 글 쓰기(이름 가림)] · [사례 공개 허락받음으로 적기]', (await moreCase.innerText()).includes('이 업체 사례로 글 쓰기') && (await page.getByTestId('more-case-consent').innerText()).includes('사례 공개 허락받음으로 적기') && (await moreCase.getAttribute('data-guide')) === 'fn-client-case')
await shot(page, 'l1-more')
await moreCase.click()
await page.getByTestId('thr-case-preview').waitFor({ timeout: 15000 })
const lineL = (await page.getByTestId('thr-case-line').innerText()).trim()
check('L2 누르면 스레드 쓰기가 그 업체로 열린 판과 함께 · 주소의 case 값은 지워짐 · 업체를 다시 고르지 않음', new URL(page.url()).pathname === '/marketing/threads' && !page.url().includes('case=') && lineL === line0 && (await page.getByTestId('thr-case-preview').innerText()).includes('한솔테크'), { url: page.url(), lineL })
await shot(page, 'l2-from-client')
await page.getByTestId('thr-case-insert').click()
await page.getByTestId('thr-case-preview').waitFor({ state: 'detached', timeout: 5000 })
const topicL = await page.getByTestId('thr-qs-topic').inputValue()
await openFacts(page, 'thr')
check('L3 [사실 목록에 넣기] → 주제 · 사실이 채워져 [AI로 완성 글 쓰기] 만 누르면 되는 모양', topicL.startsWith('소프트웨어 개발 회사 ') && (await page.getByTestId('thr-facts').inputValue()) === line0, topicL)
// 탭(기록표)을 다녀와도 판이 다시 뜨지 않는다 — 주소 값은 한 번만 쓴다
await page.getByRole('tab', { name: '기록표' }).click()
await page.waitForTimeout(300)
await page.getByRole('tab', { name: '쓰기' }).click()
await page.getByTestId('thr-qs').waitFor({ timeout: 8000 })
await page.waitForTimeout(400)
check('L3b 기록표 탭을 다녀와도 사례 판이 다시 열리지 않는다 · 넣어 둔 주제는 그대로', (await page.getByTestId('thr-case-preview').count()) === 0 && (await page.getByTestId('thr-case-pick').count()) === 0 && (await page.getByTestId('thr-qs-topic').inputValue()) === topicL)
await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
await page.getByTestId('client-more').click()
await page.getByTestId('more-case-consent').click()
await page.waitForTimeout(500)
const h1 = await clientOf(page, 'cli_hansol')
await page.getByTestId('client-more').click()
const consentLabel = (await page.getByTestId('more-case-consent').innerText()).trim()
check('L4 업체에서 [사례 공개 허락받음으로 적기] → 기록에 오늘 날짜 · 활동 기록 · 단추가 "허락 취소(오늘 받음)" 으로', h1.caseConsent?.at === today && h1.activity?.[0]?.text?.includes('사례 공개 허락받음') && consentLabel.includes('사례 공개 허락 취소') && consentLabel.includes(dayText), { c: h1.caseConsent, consentLabel })
await clearDrafts(page)
await page.goto(BASE + '/marketing/threads', { waitUntil: 'networkidle' })
await page.getByTestId('thr-qs-topic').fill('한솔테크 벤처인증 후기')
await page.getByTestId('thr-case-guard').waitFor({ timeout: 5000 })
const gL = await hits(page, 'thr')
check('L5 글 쓰기 화면이 그 허락을 안다 — "한솔테크" 는 허락받은 고객(날짜) · [허락받았어요] 대신 [허락 취소]', gL.length === 1 && gL[0].consent === '1' && gL[0].text.includes(dayText) && (await page.getByTestId('thr-case-revoke').count()) === 1 && (await page.getByTestId('thr-case-consent').count()) === 0, gL)
await page.getByTestId('thr-case-open').count()
await openFacts(page, 'thr')
await page.getByTestId('thr-case-open').click()
const consentedRow = await page.locator('[data-testid="thr-case-client"]', { hasText: '한솔테크' }).innerText()
check('L6 사례 판 목록에도 "허락받음" 표시', consentedRow.includes('허락받음'), consentedRow)
await page.getByRole('button', { name: '닫기' }).click()

/* ---------------- S 릴스 · 틱톡 ---------------- */
await clearDrafts(page)
await page.goto(BASE + '/marketing/shorts', { waitUntil: 'networkidle' })
await page.getByTestId('sht-qs').waitFor({ timeout: 15000 })
const s0 = (await page.getByTestId('sht-case-open').isVisible().catch(() => false)) === false && (await page.getByTestId('sht-case-guard').count()) === 0
await openFacts(page, 'sht')
await page.getByTestId('sht-case-open').click()
await page.getByTestId('sht-case-search').fill('다움')
await page.getByTestId('sht-case-client').first().click()
const lineS = (await page.getByTestId('sht-case-line').innerText()).trim()
await page.getByTestId('sht-case-insert').click()
await page.getByTestId('sht-case-preview').waitFor({ state: 'detached', timeout: 5000 })
check('S1 릴스 · 틱톡 — 들어오면 0 · 같은 단추 · 같은 판 → 사실 칸 · 주제 칸(회사 이름 0)', s0 && lineS.startsWith('[고객 사례 · 이름 가림] 신재생에너지 회사') && !lineS.includes('다움') && (await page.getByTestId('sht-facts').inputValue()) === lineS && (await page.getByTestId('sht-qs-topic').inputValue()).startsWith('신재생에너지 회사 '), lineS)
await page.getByTestId('sht-qs-topic').fill('다움에너지 정책자금 이야기')
await page.getByTestId('sht-case-guard').waitFor({ timeout: 5000 })
await page.getByTestId('sht-case-hide').click()
check('S2 릴스 · 틱톡 주제의 고객 이름 → 확인 줄 → [가리기]', (await page.getByTestId('sht-qs-topic').inputValue()) === '한 신재생에너지 회사 정책자금 이야기' && (await page.getByTestId('sht-case-guard').count()) === 0, await page.getByTestId('sht-qs-topic').inputValue())
await page.getByTestId('sht-hand').click()
await page.getByTestId('sht-script').waitFor({ timeout: 5000 })
await page.getByTestId('sht-script').fill('[0:00] 선한식품 사례예요.')
await page.waitForTimeout(200)
const gS = await hits(page, 'sht')
check('S3 대본 칸의 고객 이름도 짚는다(규칙 검사 위)', gS.length === 1 && gS[0].text.includes('"선한식품"') && (await page.getByTestId('sht-case-guard').getAttribute('data-at')) === 'edit', gS)

check('E1 화면 오류 0', errors.length === 0, errors)
await ctx.close()

/* ---------------- W · P 결과 글 보기(D-691) — 1주일치 · 유튜브 묶음 ---------------- */
{
  const oc = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', acceptDownloads: true })
  await oc.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const op = await oc.newPage()
  const oerr = []
  op.on('pageerror', (e) => oerr.push(String(e)))
  await op.goto(BASE + '/', { waitUntil: 'networkidle' })
  await op.evaluate(seedScript())
  await op.evaluate(() => localStorage.removeItem('axmvp.fold.all'))
  const clip = () => op.evaluate(() => navigator.clipboard.readText())
  const setClip = (t) => op.evaluate((x) => navigator.clipboard.writeText(x), t)
  // 1주일치는 그 주(월요일) 묶음 — 내 콘텐츠의 '1주일치 프로젝트' 로 여는 주소(AI 를 부르지 않는다)
  const start = await op.evaluate(() => {
    const d = new Date()
    const ymd = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    const w = (d.getDay() + 6) % 7
    const m = new Date(d)
    m.setDate(d.getDate() - w)
    if (w > 1) m.setDate(m.getDate() + 7)
    return ymd(m)
  })
  await op.evaluate((s) => localStorage.setItem('axmvp.mkweek.v1', JSON.stringify({ [s]: { at: new Date().toISOString(), model: '', start: s, topics: ['한솔테크 벤처인증 후기', '정책자금 × AI 업무', '고용지원금 × AI'] } })), start)
  await op.goto(BASE + `/marketing?view=plan&week=1&start=${start}&from=make`, { waitUntil: 'networkidle' })
  await op.getByTestId('mk-week').waitFor({ timeout: 15000 })
  const wg = op.getByTestId('mk-week-case-guard')
  await wg.waitFor({ timeout: 8000 })
  const w1 = await hits(op, 'mk-week')
  check(
    'W1 1주일치 — 짝 주제에 내 고객 이름 → 묶음 위 확인 줄(output) · "복사 · 내려받기에는 가린 채로" · [가리기] 없음 · [허락받았어요] · [고객 이름 아님]',
    (await wg.getAttribute('data-at')) === 'output' && w1.length === 1 && w1[0].text.includes('"한솔테크"') && (await op.getByTestId('mk-week-case-output').innerText()).includes('가린 채로') && (await op.getByTestId('mk-week-case-hide').count()) === 0 && (await op.getByTestId('mk-week-case-consent').count()) === 1 && (await op.getByTestId('mk-week-case-skip').count()) === 1,
    w1,
  )
  await shot(op, 'w1-week-guard')
  const tools = op.getByTestId('mk-week-tools')
  if (!(await tools.evaluate((e) => e.open))) await tools.locator('summary').click()
  await setClip('')
  await op.getByTestId('mk-week-copy-all').click()
  await op.waitForTimeout(300)
  const wc = await clip()
  check('W2 [전체 복사] → 고객 이름은 "한 소프트웨어 개발 회사" 로 가린 채 · 나머지 글은 그대로', wc.includes('한 소프트웨어 개발 회사 벤처인증 후기') && !wc.includes('한솔테크') && wc.includes('정책자금 × AI 업무') && wc.startsWith('1주일치 콘텐츠'), wc.slice(0, 300))
  const [dl] = await Promise.all([op.waitForEvent('download'), op.getByTestId('mk-week-download').click()])
  const { readFileSync } = await import('node:fs')
  const dtext = readFileSync(await dl.path(), 'utf8')
  check('W3 [텍스트 파일로] 도 가린 채', dtext.includes('한 소프트웨어 개발 회사 벤처인증 후기') && !dtext.includes('한솔테크'), dtext.slice(0, 200))
  await op.getByTestId('mk-week-tab').filter({ hasText: '유튜브 긴 영상' }).click()
  await setClip('')
  await op.getByTestId('mk-week-long').getByRole('button', { name: '복사' }).first().click()
  await op.waitForTimeout(300)
  check('W4 카드 [복사] 도 같은 규칙(이름이 없는 글은 그대로)', (await clip()).length > 20 && !(await clip()).includes('한솔테크'))
  await op.getByTestId('mk-week-case-skip').click()
  await op.waitForTimeout(200)
  await setClip('')
  await op.getByTestId('mk-week-copy-all').click()
  await op.waitForTimeout(300)
  check('W5 [고객 이름 아님] → 확인 줄 사라짐 · 그 낱말은 복사에 그대로(이 화면에서만 넘김)', (await op.getByTestId('mk-week-case-guard').count()) === 0 && (await clip()).includes('한솔테크 벤처인증 후기'))

  // 유튜브 묶음 — 직접 고른 주제(custom:)에 고객 이름 · 번호
  await op.goto(BASE + `/marketing?view=plan&pack=${encodeURIComponent('custom:한솔테크(주) 벤처인증 후기 123-45-67890')}`, { waitUntil: 'networkidle' })
  await op.getByTestId('mk-pack').waitFor({ timeout: 15000 })
  const pg = op.getByTestId('mk-pack-case-guard')
  await pg.waitFor({ timeout: 8000 })
  const p1 = await hits(op, 'mk-pack')
  const p1co = p1.filter((h) => h.kind === 'company')
  check('P1 유튜브 묶음 — 직접 고른 주제의 고객 이름 · 사업자번호 → 확인 줄(output) · 같은 회사의 두 모양("한솔테크(주)" · "한솔테크") · 같은 번호의 두 모양은 한 줄씩(D-691) · [가리기] · [지우기] 없음', (await pg.getAttribute('data-at')) === 'output' && p1co.length === 1 && p1co[0].text.startsWith('"한솔테크(주)" · "한솔테크"') && p1.filter((h) => h.kind === 'number').length === 1 && p1.some((h) => h.kind === 'number' && h.text.startsWith('"123-45-67890"')) && (await op.getByTestId('mk-pack-case-hide').count()) === 0, p1)
  await shot(op, 'p1-pack-guard')
  await setClip('')
  await op.getByTestId('mk-pack-copy-all').click()
  await op.waitForTimeout(300)
  const pc = await clip()
  check('P2 [전체 복사] → 고객 이름은 가리고 · 사업자번호는 지운 채', pc.length > 100 && !pc.includes('한솔테크') && pc.includes('한 소프트웨어 개발 회사') && !pc.includes('123-45-67890') && !pc.includes('1234567890'), pc.slice(0, 300))
  await setClip('')
  await op.getByTestId('mk-pack-copy').first().click()
  await op.waitForTimeout(300)
  check('P3 [이 칸 복사] 도 가린 채', !(await clip()).includes('한솔테크'))
  // 같은 회사의 두 모양은 한 줄(D-691) — 허락은 업체마다 하나
  const pco = op.locator('[data-testid="mk-pack-case-hit"][data-kind="company"]').first()
  await pco.getByTestId('mk-pack-case-consent').click()
  await op.getByTestId('mk-pack-case-yes').click()
  await op.waitForFunction(() => document.querySelector('[data-testid="mk-pack-case-hit"][data-kind="company"]')?.getAttribute('data-consent') === '1', null, { timeout: 8000 }).catch(() => {})
  await setClip('')
  await op.getByTestId('mk-pack-copy-all').click()
  await op.waitForTimeout(300)
  const pc2 = await clip()
  const hs = await clientOf(op, 'cli_hansol')
  const pcons = await op.locator('[data-testid="mk-pack-case-hit"][data-kind="company"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-consent')))
  check('P4 [허락받았어요] → [네, 받았어요] → 업체 기록에 날짜 · 그 회사의 줄 모두 허락받음 · 그 뒤 복사에는 회사 이름 그대로 · 번호는 여전히 지움', hs.caseConsent?.at === today && pc2.includes('한솔테크') && !pc2.includes('123-45-67890') && pcons.length >= 1 && pcons.every((c) => c === '1'), { c: hs.caseConsent, pcons, head: pc2.slice(0, 160) })
  check('E3 결과 글 보기 화면 오류 0', oerr.length === 0, oerr)
  await oc.close()
}

/* ---------------- M 390 휴대폰 ---------------- */
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', hasTouch: true, isMobile: true, deviceScaleFactor: SHOTS ? 2 : 1 })
const mp = await m.newPage()
const merr = []
mp.on('pageerror', (e) => merr.push(String(e)))
await mp.goto(BASE + '/', { waitUntil: 'networkidle' })
await mp.evaluate(seedScript())
await mp.evaluate(() => localStorage.removeItem('axmvp.fold.all'))
await clearDrafts(mp)
await mp.goto(BASE + '/marketing/threads', { waitUntil: 'networkidle' })
await mp.getByTestId('thr-qs').waitFor({ timeout: 15000 })
await mp.getByTestId('thr-qs-topic').fill('농업회사법인 한솔테크(주) 와 우일산업 장정순 대표님 010-2345-6789 사례')
await mp.getByTestId('thr-case-guard').waitFor({ timeout: 5000 })
await mp.getByTestId('thr-case-guard').scrollIntoViewIfNeeded()
const mg = await mp.getByTestId('thr-case-guard').evaluate((box) => {
  const btns = [...box.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().height))
  const fonts = [...box.querySelectorAll('p, span, button')].filter((e) => e.textContent?.trim() && e.children.length === 0).map((e) => parseFloat(getComputedStyle(e).fontSize))
  const texts = [...box.querySelectorAll('[data-testid$="-case-text"]')].map((e) => Math.round(e.getBoundingClientRect().width))
  const r = box.getBoundingClientRect()
  return { minBtn: Math.min(...btns), minFont: Math.min(...fonts), minText: Math.min(...texts), right: Math.round(r.right), rows: box.querySelectorAll('[data-testid$="-case-hit"]').length }
})
check('M1 390 확인 줄 — 넘침 0 · 단추 40px 이상 · 글자 15px 이상 · 글 줄 폭 200px 이상(짜부라지지 않음) · 처음 세 줄 + [1개 더 보기]', (await overflowX(mp)) <= 0 && mg.minBtn >= 40 && mg.minFont >= 15 && mg.minText >= 200 && mg.right <= 390 && mg.rows === 3 && (await mp.getByTestId('thr-case-hits-more').innerText()).includes('1개 더 보기'), mg)
await shot(mp, 'm1-guard-390', true)
await mp.getByTestId('thr-case-hits-more').click()
check('M1b [1개 더 보기] → 네 줄 모두 · 넘침 0', (await mp.locator('[data-testid="thr-case-hit"]').count()) === 4 && (await overflowX(mp)) <= 0)
await openFacts(mp, 'thr')
await mp.getByTestId('thr-case-open').click()
await mp.getByTestId('thr-case-pick').waitFor({ timeout: 5000 })
const mpick = await mp.getByTestId('thr-case-pick').evaluate((box) => ({ minBtn: Math.min(...[...box.querySelectorAll('button, input')].map((b) => Math.round(b.getBoundingClientRect().height))), right: Math.round(box.getBoundingClientRect().right) }))
await shot(mp, 'm2-pick-390')
await mp.getByTestId('thr-case-client').first().click()
await mp.getByTestId('thr-case-preview').waitFor({ timeout: 5000 })
const mfoot = await mp.evaluate(() => {
  const foot = document.querySelector('[data-testid="sheet-footer"]')
  const last = [...foot.querySelectorAll('button')].pop().getBoundingClientRect()
  return Math.round(foot.getBoundingClientRect().bottom - last.bottom)
})
const mprev = await mp.getByTestId('thr-case-preview').evaluate((box) => ({ minFont: Math.min(...[...box.querySelectorAll('p, button')].map((e) => parseFloat(getComputedStyle(e).fontSize))), right: Math.round(box.getBoundingClientRect().right), chips: Math.min(...[...box.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().height)), 99) }))
check('M2 390 판(업체 고르기 · 미리 보기) — 넘침 0 · 칸 · 단추 40px 이상 · 글자 15px 이상 · 맨 아래 단추가 화면 끝에 붙지 않음(12px 이상)', (await overflowX(mp)) <= 0 && mpick.minBtn >= 40 && mpick.right <= 390 && mprev.minFont >= 15 && mprev.right <= 390 && mprev.chips >= 40 && mfoot >= 12, { mpick, mprev, mfoot })
await shot(mp, 'm3-preview-390')
check('E2 휴대폰 화면 오류 0', merr.length === 0, merr)
await m.close()
await browser.close()

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
