/**
 * 업체 ↔ 전문 모듈 연동 계약 (D-618) — 업체에서 모듈로 넘어갈 때 '다시 넣기' 가 없어야 한다.
 *
 * 대표: "고객 회사를 누르고 연구소 설립 가능성을 누르면 처음에 무슨 등록을 하게 돼 있다 · 답이 모듈과 따로 논다 ·
 *        서류도 고객 관리에 넣어 놨으면 모듈이 먼저 끌고 와야 한다 · 앞으로 생길 모듈도 그렇게."
 *
 *  A. 도구함에 있는 모든 모듈(새로 생기는 모듈도 저절로 포함) — `?client=` 로 열면
 *       ① 등록 창 · 고르기 창이 뜨지 않는다  ② 그 업체 이름이 화면에 있다  ③ 화면 오류 0
 *  B. 판정이 있는 모듈 — 모듈 첫 화면의 '이 업체' 한 줄 = 업체 맞춤 추천 카드의 글(같은 규칙)
 *  C. 연구소 — 카드 [연구소 설립 가능성] → 설립 가능성 체크로 바로(등록 창 0) · 맨 위 '지금 판정' = 카드 글 ·
 *              모듈에서 답하면 카드도 같은 글로 바뀜 · [설립서류 관리로 보내기] → 등록 없이 그 업체 서류 ·
 *              서류함에 받아 둔 서류는 '서류함에 있음 · 완료' · 바꾼 상태는 새로 고쳐도 그대로
 *  D. 고용지원금 — `?client=` 첫 화면에 '업체 정보' 등록 창 0 · 업체 목록에 그 업체가 올라가 있음
 *  F · G. 창업감면 · 정책자금(D-620) — 판정기 · 진단 화면에서 답하면 카드가 그 결과 그대로 · 붙인 뒤에는 이 브라우저에 답이 없어도 같은 글 ·
 *              다른 기기의 모듈도 붙여 둔 답으로 열림 · 붙이기 전 '이 기기에만 있어요' / 붙인 뒤 '업체 기록에 붙어 있어요' 한 줄(D-621)
 *  H. 고객 관리 목록 · 오늘(D-621) — 모듈에서 답한 뒤 새로 고치지 않고 돌아와도 카드 추천 띠 · 먼저 제안할 것이 그 판정
 *  E. 다른 기기(D-619) — 설립 가능성 체크를 [업체 기록에 붙이기] 하면 답도 같이 붙음 → 이 브라우저에 답이 없어도
 *              카드 · 모듈이 같은 글 · 붙인 뒤에도 카드 = 모듈 · 그 기기에서 고치면 고친 답이 먼저 · 390
 *
 *   node e2e/link.mjs http://localhost:4390 [사진 폴더]
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'
import { openTools } from './pageTools.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.argv[3] ?? ''
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ' ' + (typeof detail === 'string' ? detail : JSON.stringify(detail))}`)
}
const KEY = 'axmvp.v1.operations_clients'
const CID = 'cli_hansol'
const NAME = '한솔테크'
const flat = (t) => (t ?? '').replace(/\s+/g, ' ').trim()

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
const shot = async (name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` })
}
const go = async (path, wait = 1300) => {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(wait)
}
/**
 * 다시 적게 하는 창(등록 · 고르기 양식) 수 — 화면을 덮는 창 가운데 입력 칸이 셋 이상인 것.
 * 그 업체의 내용을 보여 주는 창(지원사업 '이 업체에 맞는 공고' 같은 것)과 알림 줄은 세지 않는다.
 */
const openDialogs = () =>
  page.evaluate(() => {
    const seen = (el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 200 && r.height > 150 && cs.visibility !== 'hidden' && cs.display !== 'none'
    }
    const isForm = (el) => el.querySelectorAll('input:not([type=hidden]), select, textarea').length >= 3
    const roles = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"]')].filter((el) => seen(el) && isForm(el))
    // 옮겨 온 모듈의 창은 role 이 없다 — 화면을 덮는 반투명 막(고정 위치 · 화면 크기)으로도 알아본다
    const veils = [...document.querySelectorAll('main div, .hr-orig div, .lab-orig div')].filter((el) => {
      const cs = getComputedStyle(el)
      if (cs.position !== 'fixed') return false
      const r = el.getBoundingClientRect()
      return r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9 && /rgba\(.+,\s*0\.[2-9]/.test(cs.backgroundColor) && isForm(el) && !roles.some((d) => d.contains(el) || el.contains(d))
    })
    return roles.length + veils.length
  })

await go('/')
await page.evaluate(seedScript())
// 대표가 겪은 업체처럼: 설립 3년 안 법인 · 대표 포함 3명
await page.evaluate((k) => {
  const list = JSON.parse(localStorage.getItem(k) ?? '[]')
  const r = list.find((x) => x.id === 'cli_hansol')
  const t = r.payload ?? r
  const d = new Date()
  d.setFullYear(d.getFullYear() - 2)
  t.establishedAt = d.toISOString().slice(0, 10)
  t.employeeCount = '3명(대표 포함)'
  localStorage.setItem(k, JSON.stringify(list))
}, KEY)

/* ───────── A. 모든 모듈 — 등록 창 0 · 업체 이름 · 오류 0 ───────── */
await go('/tools')
const hub = await page.locator('main a[href^="/tools/"]').evaluateAll((as) => [...new Set(as.map((a) => '/' + a.getAttribute('href').split('?')[0].split('/').slice(1, 3).join('/')))])
const modules = [...new Set([...hub, '/grants'])].filter((p) => p !== '/tools/')
check('A. 도구함에서 모듈 주소를 읽음(6곳 이상 — 새 모듈도 저절로 들어옴)', modules.length >= 6, modules.join(' '))
for (const path of modules) {
  const before = errors.length
  await go(`${path}?client=${CID}`)
  const text = flat(await page.locator('body').innerText().catch(() => ''))
  const dialogs = await openDialogs()
  check(`A. ${path} — 업체로 열면 등록 · 고르기 창 0 · 업체 이름이 화면에 · 화면 오류 0`, dialogs === 0 && text.includes(NAME) && errors.length === before && !text.includes('화면을 찾지 못했습니다'), { dialogs, hasName: text.includes(NAME), errors: errors.slice(before) })
}

/* ───────── B. 모듈 첫 화면 '이 업체' 한 줄 = 맞춤 추천 카드 ───────── */
await go(`/ops/clients/${CID}?tab=smart`, 1600)
const smartText = flat(await page.locator('main').innerText())
for (const path of ['/tools/policy-funding', '/tools/startup-tax', '/tools/employment', '/tools/labcare']) {
  await go(`${path}?client=${CID}`)
  const head = page.getByTestId('module-client-focus-headline')
  if (!(await head.count())) {
    // 첫 화면이 곧 판정 화면인 모듈(창업감면)은 한 줄이 없다 — 업체 이름만 확인(A)
    console.log(`INFO  ${path}: 첫 화면에 '이 업체' 한 줄 없음(판정 화면이 바로 열리는 모듈)`)
    continue
  }
  const h = flat(await head.first().innerText())
  check(`B. ${path} — 모듈의 '이 업체' 한 줄이 맞춤 추천 카드와 같은 글`, h.length > 5 && smartText.includes(h), h)
}

/* ───────── C. 연구소 ───────── */
await go(`/ops/clients/${CID}?tab=smart`, 1600)
const labCard = page.locator('main a[href*="/tools/labcare"]').first()
const cardText = flat(await labCard.innerText())
const cardHref = await labCard.getAttribute('href')
check('C. 맞춤 추천 연구소 카드 → 설립 가능성 체크 주소(모듈 첫 화면 · 등록 창이 아님)', (cardHref ?? '').startsWith('/tools/labcare/assessment'), cardHref)
await shot('link-01-card')
await labCard.click()
await page.getByTestId('lab-verdict-top').waitFor({ timeout: 10000 }).catch(() => {})
await page.waitForTimeout(700)
const top1 = flat(await page.getByTestId('lab-verdict-top-headline').innerText().catch(() => ''))
check('C. 카드를 누르면 등록 창 없이 설립 가능성 체크 · 맨 위 "지금 판정" 한 줄이 카드와 같은 글', (await openDialogs()) === 0 && top1.length > 5 && cardText.includes(top1), { top1, cardText: cardText.slice(0, 120) })
const pre = flat(await page.locator('main').innerText())
check('C. 회사명 · 업종 · 설립일은 업체 기록에서 채워져 있음(다시 안 적음)', (await page.locator('input[placeholder*="오로라테크"]').inputValue()).includes(NAME) && pre.includes('업체 기록에서 채웠습니다') && pre.includes('창업 3년 이내'), pre.slice(0, 200))
await page.evaluate(() => window.scrollTo(0, 0))
await shot('link-02-assess-top')
// 모듈에서 답한다 — 규모 소기업 · 후보 1명(석사 · 공학 · 전담)
await page.locator('select').filter({ hasText: '규모를 고르세요' }).first().selectOption({ label: '소기업' })
const nameBox = page.locator('input[placeholder*="홍길동"], input[placeholder*="이름"]').first()
if (await nameBox.count()) await nameBox.fill('김연구')
const eduSel = page.locator('select').filter({ hasText: '석사' }).first()
await eduSel.selectOption({ label: '석사' })
await page.waitForTimeout(600)
const top2 = flat(await page.getByTestId('lab-verdict-top-headline').innerText())
const badge2 = flat(await page.getByTestId('lab-verdict-top-badge').innerText())
check('C. 모듈에서 답하면(규모 · 후보자) 맨 위 한 줄이 바뀜 — "…만 넣으면" 이 아니라 판정 이름으로', top2 !== top1 && top2.startsWith(badge2) && !top2.includes('만 넣으면'), { top1, top2, badge2 })
await go(`/ops/clients/${CID}?tab=smart`, 1600)
const cardText2 = flat(await page.locator('main a[href*="/tools/labcare"]').first().innerText())
check('C. 업체 맞춤 추천 카드도 모듈에서 답한 그 판정으로 — 같은 글(따로 놀지 않음)', cardText2.includes(top2), { top2, cardText2: cardText2.slice(0, 140) })
await shot('link-03-card-after')
// D-618 AI 도우미에 연구소를 물으면 — 답 위에 같은 판정 줄(카드 · 모듈과 같은 글). AI 서버가 없어도(이 시험처럼) 판정 줄은 바로 보인다
await openTools(page)
await page.getByTestId('ai-assist-ask-chip').first().click()
await page.getByTestId('ai-assist-ask').fill('연구소 3년 내 법인인데 설립 가능한지')
await page.getByTestId('ai-assist-ask-send').click()
await page.getByTestId('ask-verdict-pin').waitFor({ timeout: 8000 }).catch(() => {})
const pinHead = flat(await page.getByTestId('ask-verdict-headline').first().innerText().catch(() => ''))
const pinKey = await page.getByTestId('ask-verdict-row').first().getAttribute('data-key').catch(() => '')
const pinHref = (await page.getByTestId('ask-verdict-open').first().getAttribute('href').catch(() => '')) ?? ''
check('C. AI 도우미에 연구소를 물으면 답 위에 "이 업체 판정" — 카드 · 모듈과 같은 글 · 그 모듈로 가는 단추', pinKey === 'labcare' && pinHead.length > 5 && pinHead.includes(top2) && cardText2.includes(pinHead) && pinHref.startsWith('/tools/labcare/assessment'), { pinKey, pinHead, top2, pinHref })
await shot('link-06-ask-pin')
await page.getByTestId('ai-assist-running').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {})
await page.getByTestId('ai-assist-ask').fill('이 업체 지난달에 뭐 했어?')
await page.getByTestId('ai-assist-ask-send').click()
await page.waitForTimeout(700)
check('C. 모듈을 묻지 않은 질문에는 판정 줄을 붙이지 않음', (await page.getByTestId('ask-verdict-pin').count()) === 0, '')
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
// 설립서류 관리로 — 등록 창 없이 그 업체 서류 · 서류함에 있는 것은 완료
await go(`/tools/labcare/assessment?client=${CID}`)
await page.getByRole('button', { name: /설립서류 관리로 보내기/ }).click()
await page.waitForTimeout(1500)
const setupText = flat(await page.locator('main').innerText())
const fromBox = await page.getByTestId('setupdoc-from-box').count()
check('C. [설립서류 관리로 보내기] → 등록 창 없이 그 업체 서류 화면 · 서류함에 받아 둔 사업자등록증은 "서류함에 있음"', new URL(page.url()).pathname.endsWith('/setup-docs') && (await openDialogs()) === 0 && setupText.includes(NAME) && fromBox >= 1, { url: page.url().replace(BASE, ''), fromBox })
await shot('link-04-setup-docs')
// 견본용 임의 '완료' 가 아니라 — 서류함에 없는 필수 서류(중소기업확인서)는 준비중에서 시작 · 바꾸면 남는다
const smeSelect = () => page.locator('p', { hasText: '중소기업확인서 사본 및 유효기간 확인' }).first().locator('xpath=ancestor::div[contains(@class,"justify-between")][1]//select')
await smeSelect().scrollIntoViewIfNeeded().catch(() => {})
const sme0 = await smeSelect().inputValue().catch(() => '')
await smeSelect().selectOption({ label: '고객 요청중' }).catch(() => {})
await page.waitForTimeout(900)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const sme1 = await smeSelect().inputValue().catch(() => '')
check('C. 서류함에 없는 서류는 "준비중" 에서 시작(임의 완료 0) · 바꾼 상태는 새로 고쳐도 그대로', sme0 === '준비중' && sme1 === '고객 요청중', { sme0, sme1 })
await go(`/tools/labcare/clients?client=${CID}`)
check('C. 연구소 업체 목록 — 그 업체가 등록 창 없이 올라가 있음(업체 화면으로 바로)', (await openDialogs()) === 0 && flat(await page.locator('main').innerText()).includes(NAME) && page.url().includes('cid='), page.url().replace(BASE, ''))

/* ───────── D. 고용지원금 ───────── */
await go(`/tools/employment?client=${CID}`, 2000)
const empText = flat(await page.locator('body').innerText())
check('D. 고용지원금 — 업체로 열면 "업체 정보" 등록 창 0 · 그 업체 화면(이름이 보임)', (await openDialogs()) === 0 && !empText.includes('주식회사 표기 위치') && empText.includes(NAME), { dialogs: await openDialogs() })
await shot('link-05-employment')
// 업체 서류 — 고객 관리 서류함에 받아 둔 것(사업자등록증)은 다시 받지 않는다: '서류함에 있음' · 제출완료로 시작
await page.getByRole('button', { name: /업체 서류/ }).first().click().catch(() => {})
await page.waitForTimeout(700)
const empBox = await page.getByTestId('emp-doc-from-box').count()
const empDocsText = flat(await page.locator('main').innerText())
check('D. 고용지원금 업체 서류 — 서류함에 받아 둔 사업자등록증은 "서류함에 있음"(다시 안 받음) · 없는 서류는 미요청 그대로', empBox >= 1 && empDocsText.includes('사업자등록증') && empDocsText.includes('미요청'), { empBox })
await shot('link-07-employment-docs')
await go('/tools/employment/companies', 1500)
const empList = flat(await page.locator('main').innerText())
check('D. 고용지원금 업체 목록 — 그 업체가 등록 창 없이 올라가 있음', empList.includes(NAME), empList.slice(0, 200))

/* ───────── E. 다른 기기 · 같이 쓰는 사람 화면(D-619) ─────────
 * 설립 가능성 체크에 답한 것은 그 브라우저에 남는다 — [업체 기록에 붙이기] 를 누르면 답도 업체 기록에 같이 붙어,
 * 그 답이 없는 다른 기기(여기서는 이 브라우저에 남긴 답만 지워 흉내)의 카드 · 모듈도 같은 글이 된다. */
const FORM_KEY = `axmvp.tools.labcare.assessForm.${CID}`
await go(`/tools/labcare/assessment?client=${CID}`, 1500)
const topE = flat(await page.getByTestId('lab-verdict-top-headline').innerText())
const syncBefore = await page.getByTestId('lab-answers-sync').getAttribute('data-state').catch(() => '')
check('E. 답만 하고 붙이지 않았으면 "지금 답은 이 기기에만 있어요" 한 줄(무엇을 누르면 되는지)', syncBefore === 'device' && flat(await page.getByTestId('lab-answers-sync').innerText()).includes('기록에 붙이기'), syncBefore)
await page.getByTestId('lab-os-attach').getByTestId('tool-attach-quick').click()
await page.getByTestId('tool-attach-go').waitFor({ timeout: 10000 }).catch(() => {})
await page.waitForTimeout(500)
const syncAfter = await page.getByTestId('lab-answers-sync').getAttribute('data-state').catch(() => '')
const topAfterAttach = flat(await page.getByTestId('lab-verdict-top-headline').innerText())
check('E. [업체 기록에 붙이기] → "이 답은 업체 기록에 붙어 있어요" · 적던 화면은 그대로(다시 열리지 않음 · 붙임 알림 남음)', syncAfter === 'record' && topAfterAttach === topE && (await page.getByTestId('tool-attach-go').count()) === 1 && (await page.getByTestId('lab-from-record').count()) === 0, { syncAfter, topAfterAttach })
await page.getByTestId('lab-answers-sync').scrollIntoViewIfNeeded()
await shot('link-07-attached')
const stored = await page.evaluate(([k, id]) => {
  const rec = JSON.parse(localStorage.getItem(k) ?? '[]').find((c) => c.id === id)
  const r = (rec?.toolResults ?? []).find((x) => x.toolKey === 'labcare' && x.data?.kind === 'assess')
  return { hasForm: Boolean(r?.data?.form), edu: r?.data?.form?.candidates?.[0]?.education ?? '', size: r?.data?.form?.companySize ?? '', sized: r?.data?.form?.sizeConfirmed === true }
}, [KEY, CID])
check('E. 업체 기록에 답이 같이 붙음(규모 소기업 · 후보자 석사)', stored.hasForm && stored.edu === '석사' && stored.size === '소기업' && stored.sized, stored)
await go(`/ops/clients/${CID}?tab=smart`, 1600)
const cardAttached = flat(await page.locator('main a[href*="/tools/labcare"]').first().innerText())
check('E. 붙인 뒤에도 카드 = 모듈 맨 위 한 줄(예전에는 판정 이름만 보였음)', cardAttached.includes(topE), { topE, card: cardAttached.slice(0, 140) })
// 다른 기기 — 이 브라우저에 남긴 답이 없다(업체 기록은 클라우드로 같이 온다)
await page.evaluate((k) => localStorage.removeItem(k), FORM_KEY)
await go(`/ops/clients/${CID}?tab=smart`, 1600)
const cardFar = flat(await page.locator('main a[href*="/tools/labcare"]').first().innerText())
check('E. 다른 기기(이 브라우저에 답 없음) — 카드가 업체 기록에 붙은 답으로 같은 판정 글', cardFar.includes(topE) && !cardFar.includes('만 넣으면'), { topE, card: cardFar.slice(0, 140) })
await shot('link-08-far-card')
await page.locator('main a[href*="/tools/labcare"]').first().click()
await page.getByTestId('lab-verdict-top').waitFor({ timeout: 10000 }).catch(() => {})
await page.getByTestId('lab-from-record').waitFor({ timeout: 8000 }).catch(() => {})
await page.waitForTimeout(500)
const topFar = flat(await page.getByTestId('lab-verdict-top-headline').innerText())
const farEdu = await page.locator('select').filter({ hasText: '석사' }).first().inputValue().catch(() => '')
const farSize = await page.getByTestId('lab-size').inputValue().catch(() => '')
check('E. 다른 기기 — 모듈도 붙여 둔 답으로 열림(후보자 석사 · 규모 소기업 그대로 · 다시 안 적음) · "업체 기록에 붙여 둔 답으로 열었어요" 한 줄 · 등록 창 0', topFar === topE && farEdu === '석사' && farSize === '소기업' && (await page.getByTestId('lab-from-record').count()) === 1 && (await openDialogs()) === 0, { topFar, topE, farEdu, farSize })
await page.evaluate(() => window.scrollTo(0, 0))
await shot('link-09-far-module')
// 그 기기에서 답을 고치면 — 고친 답이 새것(이 기기에만 · 다시 붙이라고 알림)
await page.locator('select').filter({ hasText: '석사' }).first().selectOption({ label: '박사' })
await page.waitForTimeout(600)
const topEdit = flat(await page.getByTestId('lab-verdict-top-headline').innerText())
const syncEdit = await page.getByTestId('lab-answers-sync').getAttribute('data-state').catch(() => '')
await go(`/ops/clients/${CID}?tab=smart`, 1600)
const cardEdit = flat(await page.locator('main a[href*="/tools/labcare"]').first().innerText())
check('E. 그 기기에서 답을 고치면 고친 답이 먼저(카드 = 고친 화면의 한 줄) · "이 기기에만" 으로 바뀜', syncEdit === 'device' && cardEdit.includes(topEdit), { syncEdit, topEdit, card: cardEdit.slice(0, 140) })
// 390 — 새 한 줄 때문에 옆으로 넘치지 않는다
const phone = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'ko-KR', storageState: await ctx.storageState() })
const pp = await phone.newPage()
pp.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
await pp.goto(`${BASE}/tools/labcare/assessment?client=${CID}`, { waitUntil: 'networkidle' })
await pp.getByTestId('lab-answers-sync').waitFor({ timeout: 10000 }).catch(() => {})
await pp.getByTestId('lab-answers-sync').scrollIntoViewIfNeeded().catch(() => {})
const over = await pp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
check('E. 390 — 붙이기 안내 한 줄이 보이고 옆으로 넘치지 않음', (await pp.getByTestId('lab-answers-sync').count()) === 1 && over <= 1, { over })
if (SHOTS) await pp.screenshot({ path: `${SHOTS}/link-10-phone-sync.png` })
await phone.close()

/* ───────── F · G. 창업감면 · 정책자금 — 모듈에서 답하면 카드도 같은 글(D-620) ─────────
 * 연구소(C · E)와 같은 계약을 나머지 판정 모듈에도: 판정기 · 진단 화면에서 답한 것이 카드에 같은 글로 돌아오고,
 * [기록에 붙이기] 뒤에는 이 브라우저에 답이 없어도(다른 기기) 같은 글. */
const insight = async (key) => {
  await go(`/ops/clients/${CID}?tab=smart`, 1700)
  return flat(await page.locator(`[data-testid="smart-insight"][data-key="${key}"]`).first().innerText().catch(() => ''))
}
const dropLocal = (prefix) => page.evaluate((px) => Object.keys(localStorage).filter((k) => k.startsWith(px)).forEach((k) => localStorage.removeItem(k)), prefix)

// F. 창업감면 — 판정기에서 '기존 사업 양수'(창업으로 보지 않는 경우)라고 답한다
const stCard0 = await insight('startup-tax')
await go(`/tools/startup-tax/judge?client=${CID}`)
await page.getByRole('button', { name: '기존 사업 양수', exact: true }).first().click()
await page.getByRole('button', { name: '1분 판정하기' }).first().click()
await page.getByTestId('startup-tax-oneline').waitFor({ timeout: 8000 }).catch(() => {})
const stModule = flat(await page.getByTestId('startup-tax-oneline').innerText().catch(() => ''))
const syncOf = async (id) => ({ n: await page.getByTestId(id).count(), state: await page.getByTestId(id).first().getAttribute('data-state').catch(() => ''), text: flat(await page.getByTestId(id).first().innerText().catch(() => '')) })
const stSync1 = await syncOf('startup-answers-sync')
check('F. 창업감면 — 답만 하고 붙이기 전: "지금 답은 이 기기에만 있어요" 한 줄(D-621)', stSync1.n === 1 && stSync1.state === 'device' && stSync1.text.includes('이 기기에만'), stSync1)
const stCard1 = await insight('startup-tax')
check('F. 창업감면 — 판정기에서 답하면 카드가 판정기의 한 줄 결론 그대로(예전에는 카드가 업체 기록만 보고 따로 판정)', stModule.length > 5 && stCard1.includes(stModule) && !stCard0.includes(stModule) && !stCard1.includes('창업 형태(새로 창업'), { stModule, card0: stCard0.slice(0, 90), card1: stCard1.slice(0, 120) })
await shot('link-11-startup-card')
await go(`/tools/startup-tax/judge?client=${CID}`)
await page.getByRole('button', { name: '1분 판정하기' }).first().click()
await page.getByTestId('tool-attach-quick').first().click()
await page.getByTestId('tool-attach-go').waitFor({ timeout: 10000 }).catch(() => {})
await page.waitForTimeout(300)
const stSync2 = await syncOf('startup-answers-sync')
check('F. 창업감면 — 붙인 뒤: "✓ 이 답은 업체 기록에 붙어 있어요"(D-621)', stSync2.n === 1 && stSync2.state === 'record' && stSync2.text.includes('업체 기록에 붙어'), stSync2)
await shot('link-14-startup-sync')
await dropLocal('axmvp.tools.startupTax.client.')
const stCardFar = await insight('startup-tax')
check('F. 창업감면 — [기록에 붙이기] 뒤에는 이 브라우저에 답이 없어도(다른 기기) 카드가 같은 글', stCardFar.includes(stModule), stCardFar.slice(0, 140))
await go(`/tools/startup-tax/judge?client=${CID}`)
const stNote = flat(await page.getByTestId('tool-prefill-note').innerText().catch(() => ''))
await page.getByRole('button', { name: '1분 판정하기' }).first().click()
await page.waitForTimeout(600)
const stModuleFar = flat(await page.getByTestId('startup-tax-oneline').innerText().catch(() => ''))
check('F. 창업감면 — 다른 기기의 판정기도 붙여 둔 답으로 열림(다시 안 고름 · 한 줄 안내) · 같은 결론', stModuleFar === stModule && stNote.includes('붙여 둔 판정 답') && (await openDialogs()) === 0, { stModuleFar, stNote: stNote.slice(0, 80) })

// G. 정책자금 — 진단 화면: 그대로 [진단 결과 보기] → 카드와 같은 가능성 · 1순위 기관. 매출을 답하면 카드도 따라 바뀐다
const pfRead = async () => {
  await page.getByRole('button', { name: '진단 결과 보기' }).first().click()
  await page.getByTestId('pf-likelihood').waitFor({ timeout: 8000 }).catch(() => {})
  // 결과 맨 위 줄 — '진행 가능성 보통 1순위 · 기술보증기금 · …'(가능성 칸 바로 옆에 1순위 기관)
  const m = /진행 가능성\s*(높음|보통|낮음)\s*1순위\s*·\s*([^\s·]+)/.exec(flat(await page.getByTestId('pf-orig').innerText().catch(() => '')))
  return { level: m?.[1] ?? '', agency: m?.[2] ?? '', t: m?.[0] ?? '' }
}
await go(`/tools/policy-funding/diagnosis?client=${CID}`)
const pf0 = await pfRead()
const pfSync0 = await syncOf('pf-answers-sync')
const pfCard0 = await insight('policy-funding')
check('G. 정책자금 — 아무것도 고르지 않은 진단(업체 기록으로만 채움)에는 "이 기기에만" 줄 없음(D-621)', pfSync0.n === 0, pfSync0)
check('G. 정책자금 — 진단 화면을 그대로 연 결과 = 카드(같은 가능성 · 같은 1순위 기관)', pf0.level !== '' && pf0.agency !== '' && pfCard0.includes(`진행 가능성 ${pf0.level} · 추천 기관 ${pf0.agency}`), { pf0: pf0.t.slice(0, 80), card: pfCard0.slice(0, 80) })
await go(`/tools/policy-funding/diagnosis?client=${CID}`)
await page.getByRole('button', { name: '30억 이상', exact: true }).first().click()
const pf1 = await pfRead()
const pfSync1 = await syncOf('pf-answers-sync')
check('G. 정책자금 — 매출을 답하고 붙이기 전: "지금 답은 이 기기에만 있어요" 한 줄(D-621)', pfSync1.n === 1 && pfSync1.state === 'device', pfSync1)
await shot('link-12-policy-module')
const pfCard1 = await insight('policy-funding')
check('G. 정책자금 — 진단 화면에서 매출을 답하면 카드도 그 결과로(1순위 기관 · "매출을 알면 더 정확해요" 없음)', pf1.agency !== '' && pfCard1.includes(`진행 가능성 ${pf1.level} · 추천 기관 ${pf1.agency}`) && !pfCard1.includes('매출을 알면'), { pf1: pf1.t.slice(0, 80), card: pfCard1.slice(0, 110) })
await shot('link-13-policy-card')
await go(`/tools/policy-funding/diagnosis?client=${CID}`)
await pfRead()
await page.getByTestId('pf-attach').getByTestId('tool-attach-quick').click()
await page.getByTestId('tool-attach-go').waitFor({ timeout: 10000 }).catch(() => {})
await page.waitForTimeout(400)
const pfSync2 = await syncOf('pf-answers-sync')
check('G. 정책자금 — 붙인 뒤: "✓ 이 답은 업체 기록에 붙어 있어요"(D-621)', pfSync2.n === 1 && pfSync2.state === 'record', pfSync2)
await page.getByTestId('pf-answers-sync').scrollIntoViewIfNeeded().catch(() => {})
await shot('link-15-policy-sync')
await dropLocal('axmvp.tools.policyFunding.')
const pfCardFar = await insight('policy-funding')
check('G. 정책자금 — [기록에 붙이기] 뒤에는 이 브라우저에 답이 없어도(다른 기기) 카드가 같은 글', pf1.agency !== '' && pfCardFar.includes(`진행 가능성 ${pf1.level} · 추천 기관 ${pf1.agency}`) && !pfCardFar.includes('매출을 알면'), pfCardFar.slice(0, 120))
await go(`/tools/policy-funding/diagnosis?client=${CID}`, 1800)
const pfFar = await pfRead()
const pfFarSaved = await page.evaluate((id) => JSON.parse(localStorage.getItem(`axmvp.tools.policyFunding.${id}`) ?? '{}').lastYearRevenue ?? '', CID)
check('G. 정책자금 — 다른 기기의 진단 화면도 붙여 둔 답으로 열림(매출 다시 안 고름) · 같은 결과', pfFar.agency !== '' && pfFar.agency === pf1.agency && pfFar.level === pf1.level && pfFarSaved === '30억 이상' && (await openDialogs()) === 0, { pfFar: pfFar.t.slice(0, 80), pfFarSaved })

/* ───────── H. 고객 관리 목록 · 오늘 — 모듈에서 답한 뒤 새로 고치지 않고 돌아와도 추천 띠가 그 판정(D-621) ─────────
 * 목록은 업체마다 판정을 기억해 둔다(D-479). 모듈에서 답해 판정이 바뀌면 기억해 둔 옛 띠가 남으면 안 된다.
 * 견본 업체를 '설립 2년 법인' 으로 바꿔(창업감면 = 검토해 볼 만함) 판정기에서 '기존 사업 양수' 라고 답한다 → 띠에서 창업감면이 빠져야 한다. */
{
  const c2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  await c2.addInitScript(
    seedScript() +
      `;(() => { const k = '${KEY}'; const a = JSON.parse(localStorage.getItem(k)); const i = a.findIndex((x) => x.id === '${CID}'); a[i] = JSON.parse(JSON.stringify(a[i]).split('2019-03-02').join('2024-12-01')); localStorage.setItem(k, JSON.stringify(a)) })();`,
  )
  const p2 = await c2.newPage()
  p2.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  // 화면 안에서 옮기기(새로 고침 없이) — 주소만 바꾸고 화면 틀에 알린다
  const hop = async (path, wait = 2200) => {
    await p2.evaluate((p) => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')) }, path)
    await p2.waitForTimeout(wait)
  }
  const chips = () => p2.locator(`[data-client-id="${CID}"] [data-testid="card-reco"]`).first().evaluate((el) => [...el.children].slice(1).map((c) => c.textContent.trim())).catch(() => [])
  await p2.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await p2.waitForTimeout(2200)
  const before = await chips()
  await hop(`/tools/startup-tax/judge?client=${CID}`)
  await p2.getByRole('button', { name: '기존 사업 양수', exact: true }).first().click()
  await p2.getByRole('button', { name: '1분 판정하기' }).first().click()
  await p2.getByTestId('startup-tax-oneline').waitFor({ timeout: 8000 }).catch(() => {})
  await hop('/ops/clients')
  const after = await chips()
  check('H. 고객 관리 목록 — 모듈에서 답한 뒤 새로 고치지 않고 돌아와도 카드 추천 띠가 그 판정(창업감면 빠짐 · 나머지 그대로)', before.includes('창업감면') && !after.includes('창업감면') && after.length === before.length - 1, { before, after })
  await hop('/')
  const picks = flat(await p2.getByTestId('today-picks').innerText().catch(() => ''))
  check('H. 오늘 "먼저 제안할 것" 도 같은 판정(창업감면 없음)', picks.includes(NAME) && !picks.includes('창업감면'), picks.slice(0, 160))
  await c2.close()
}

check('화면 오류(pageerror) 0', errors.length === 0, errors.slice(0, 3))
await browser.close()
console.log(`\nlink: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
