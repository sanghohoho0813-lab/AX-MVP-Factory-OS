/**
 * qa:certai — D-252 기업인증 · 벤처 사업계획서 '타자 없이'. 대표: "하나하나 타자로 입력하는 건 절대 없어야 돼".
 * AI 는 이 상자에서 부를 수 없어 /api/ai-assist 를 흉내 낸다(보내는 것 · 받은 것을 넣는 것만 본다).
 *
 *   A 대표 확인 질문 — 보내는 카톡에 번호(□ 1.) · 답장 통째로 붙여 넣기 → 번호대로 나눠 넣기 · 번호 없으면 안내 · [AI로 나눠 보기](휴대폰 가림)
 *   B 실사 예상 질문 — [AI로 말할 답 쓰기] 한 번 → 질문마다 말할 답 · [대표 확인] 표시 · 고치기 · 복사 글 · 새로고침해도 그대로
 *   C 벤처 준비 칸 — 대표님 답장 붙여 넣기 → 칸마다 '대표 답'
 *   D 벤처 사업계획서 — AI 판이 처음부터 펼쳐짐 · 칸마다 [AI로 이 칸 쓰기](재료 없으면 재료로) → 그 칸 묶음만 씀
 *   E 휴대폰 390 — 붙여 넣기 판 · 말할 답 넘침 0
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.CERTAI_SHOTS ?? ''
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) {
    pass++
    console.log('PASS ', n)
  } else {
    fail++
    console.log('FAIL ', n, d === undefined ? '' : String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600))
  }
}
const shot = async (page, name) => {
  if (!SHOTS) return
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.waitForTimeout(250)
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })
}
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

const sent = []
const ANSWERS = {
  'cert.reply': () => ({ headline: '1개 질문에 답', items: [{ title: 'q1', ref: 'q1', body: 'AI 가 나눈 답 — 체납 없음' }], next: [] }),
  'cert.say': (req) => {
    const rows = req.context.sections.find((s) => s.name === '예상 질문')?.rows ?? []
    return { headline: '결론 먼저 짧게', items: rows.map((r, i) => ({ title: r.ref, ref: r.ref, body: i === 0 ? '저희 회사는 [대표 확인: 연구 인력 수]명이 전담으로 연구합니다.' : `말할 답 ${i + 1} — 확인된 사실로만 말씀드립니다.`, detail: '' })), next: ['연구 인력 수 확인'] }
  },
  'venture.p1': () => ({ headline: 'x', items: [{ title: 'development_background', body: 'AI 가 쓴 개발 배경 — 공구 마모 판정' }, { title: 'competitiveness_strategy', body: 'AI 가 쓴 경쟁력 — 진동 신호 정규화' }] }),
}
const mock = async (route) => {
  const req = JSON.parse(route.request().postData() || '{}')
  sent.push(req)
  const make = ANSWERS[req.assistId]
  const run = { requestId: req.requestId, assistId: req.assistId, page: req.page, provider: 'gemini', model: 'test-model', status: 'succeeded', structured: make ? make(req) : { headline: 'x', items: [] }, raw: '', usage: { input: 1, output: 1, total: 2 }, estimatedCostUsd: null, ms: 5, sent: { userChars: 1, rows: 1, rowsCut: 0 }, createdAt: new Date().toISOString() }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, run }) })
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- PC 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.route('**/api/ai-assist', mock)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())

  const openPack = async () => {
    await page.goto(BASE + '/tools/cert-os/mainbiz?client=cli_wooil', { waitUntil: 'networkidle' })
    await page.getByTestId('cert-step-2').click()
    await page.getByTestId('cert-other-actions').locator('summary').click()
    await page.getByTestId('cert-prep-pack-more').click()
    await page.waitForTimeout(400)
  }
  await openPack()

  // A 대표 확인 질문 — 답한 질문은 목록에서 빠지고 뒤의 질문이 올라온다(최대 8개라 개수가 아니라 글로 본다)
  const askTexts = () => page.getByTestId('owner-ask-item').evaluateAll((els) => els.map((e) => e.innerText.split('\n').find((l) => l.length > 3) ?? ''))
  const n0 = await page.getByTestId('owner-ask-item').count()
  const first2 = (await askTexts()).slice(0, 2)
  await page.getByTestId('owner-ask-send').click()
  await page.waitForTimeout(200)
  const msg = await page.evaluate(() => navigator.clipboard.readText())
  check(`A1 질문 보내기 문구에 번호(□ 1. …) ${n0}개 · "번호대로" 안내`, n0 >= 3 && msg.split('\n').filter((l) => /^□ \d+\. /.test(l)).length === n0 && msg.includes('번호대로'), msg.slice(0, 300))
  await page.getByTestId('owner-reply-open').click()
  await page.getByTestId('owner-reply-text').fill('[김대표] [오후 3:12] 안녕하세요\n[김대표] [오후 3:12] 1. 네 확인했습니다\n[김대표] [오후 3:13] 2. 작년부터 월별로 정리 중입니다\n감사합니다')
  await page.getByTestId('owner-reply-split').click()
  const picks = await page.getByTestId('owner-reply-pick').evaluateAll((els) => els.map((e) => e.innerText))
  check('A2 답장 통째로 → 번호대로 2개 · 카톡 머리 · 인사 걷어 냄', picks.length === 2 && (await page.getByTestId('owner-reply-result').getAttribute('data-how')) === 'number' && picks[0].includes('네 확인했습니다') && !picks.join().includes('오후 3:12'), picks)
  await shot(page, 'A2-reply-split')
  await page.getByTestId('owner-reply-save').click()
  await page.waitForTimeout(900)
  const after = await askTexts()
  const n1 = after.length
  check(`A3 [2개 넣기] → 답한 질문 2개(신청 자격)가 목록에서 빠짐 · 뒤 질문이 올라옴`, first2.every((q) => !after.includes(q)) && after.length >= 1, { first2, after })

  await page.getByTestId('owner-reply-open').click()
  const loose = Array.from({ length: n1 + 1 }, (_, i) => (i === 0 ? '체납 같은 건 없고요 담당 010-9999-8888 로 연락 주세요' : `기타 ${i}`)).join('\n')
  await page.getByTestId('owner-reply-text').fill(loose)
  await page.getByTestId('owner-reply-split').click()
  check('A4 번호도 없고 줄 수도 다르면 → 나누지 않고 안내(지어내지 않음)', (await page.getByTestId('owner-reply-none').count()) === 1 && (await page.getByTestId('owner-reply-pick').count()) === 0)
  await page.getByTestId('owner-reply-ai').click()
  await page.getByTestId('owner-reply-pick').first().waitFor({ timeout: 10000 })
  const rq = sent.find((r) => r.assistId === 'cert.reply')
  check('A5 [AI로 나눠 보기] → cert.reply · 보낸 질문 q1… · 답장의 휴대폰은 가려서 보냄 · 나눈 결과(AI 표시)', !!rq && rq.page === 'cert' && rq.context.sections[0].rows[0].ref === 'q1' && !JSON.stringify(rq.context).includes('010-9999-8888') && (await page.getByTestId('owner-reply-result').getAttribute('data-how')) === 'ai', rq?.context)
  await page.getByTestId('owner-reply-save').click()
  await page.waitForTimeout(900)
  check('A6 AI 로 나눈 답 넣기 → 그 질문(1번)도 목록에서 빠짐', !(await askTexts()).includes(after[0]), after[0])

  // B 실사 말할 답
  const nq = await page.getByTestId('pack-question').count()
  await page.getByTestId('pack-say-run').click()
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="pack-question"] [data-testid="pack-say"]').length > 0, null, { timeout: 15000 })
  const sq = sent.find((r) => r.assistId === 'cert.say')
  check(`B1 [AI로 말할 답 쓰기] 한 번 → cert.say(질문 ${nq}개 q1…) · 근거(핵심답근거 · 증빙) 같이 보냄`, !!sq && sq.context.sections.find((s) => s.name === '예상 질문').rows.length === nq && '핵심답근거' in sq.context.sections.find((s) => s.name === '예상 질문').rows[0])
  const q1 = page.getByTestId('pack-question').first()
  await q1.locator('summary').click()
  const sayText = await q1.getByTestId('pack-say-text').innerText()
  check('B2 질문을 열면 말할 답(AI 초안) · [대표 확인] 자리 빨간 안내', sayText.includes('[대표 확인: 연구 인력 수]') && /대표님께 물어 채워/.test(await q1.getByTestId('pack-say').innerText()), sayText)
  await shot(page, 'B2-say')
  await q1.getByTestId('pack-say-edit').click()
  await q1.locator('textarea').fill('저희 회사는 4명이 전담으로 연구합니다.')
  await q1.getByTestId('pack-say-save').click()
  await page.waitForTimeout(700)
  check('B3 고치기 → 저장 → 고친 답', (await q1.getByTestId('pack-say-text').innerText()) === '저희 회사는 4명이 전담으로 연구합니다.')
  await page.getByTestId('pack-copy').click()
  await page.waitForTimeout(200)
  const packTxt = await page.evaluate(() => navigator.clipboard.readText())
  check('B4 실사 준비 복사 글에 말할 답', packTxt.includes('말할 답: 저희 회사는 4명이 전담으로 연구합니다.') && packTxt.includes('말할 답 2'), packTxt.slice(0, 400))
  await openPack()
  await page.getByTestId('pack-question').first().locator('summary').click()
  check('B5 새로고침해도 말할 답 그대로 · 단추는 "다시 쓰기"', (await page.getByTestId('pack-question').first().getByTestId('pack-say-text').innerText()) === '저희 회사는 4명이 전담으로 연구합니다.' && /다시 쓰기/.test(await page.getByTestId('pack-say-run').innerText()))

  // C 벤처 준비 칸 — 답장 붙여 넣기
  await page.goto(BASE + '/tools/cert-os/venture?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.getByTestId('cert-step-0').click()
  await page.waitForTimeout(300)
  await page.getByTestId('cert-step0-venture').click()
  await page.getByTestId('venture-pack').waitFor()
  const askSecs = await page.locator('[data-testid="venture-section"]:not([data-state="ok"])').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))
  await page.getByTestId('venture-reply-open').click()
  await page.getByTestId('venture-reply-text').fill('1) 네 회사 정보와 같습니다\n2) 진동 센서로 공구 마모를 미리 알려 줍니다')
  await page.getByTestId('venture-reply-split').click()
  await page.getByTestId('venture-reply-save').click()
  await page.waitForTimeout(900)
  const fixed = await page.locator('[data-testid="venture-section"]').evaluateAll((els) => els.filter((e) => /대표 답 고치기/.test(e.innerText)).map((e) => e.getAttribute('data-id')))
  check(`C1 벤처 준비 칸 — 답장 붙여 넣기 → 칸 2개에 '대표 답'(${askSecs.slice(0, 2).join(' · ')})`, askSecs.length >= 2 && askSecs.slice(0, 2).every((id) => fixed.includes(id)), { askSecs, fixed })
  await shot(page, 'C1-venture-reply')

  // D 벤처 사업계획서 — AI 판 처음부터 · 칸마다 AI
  await page.goto(BASE + '/tools/cert-os/venture?client=cli_hansol&plan=1', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('D1 대표 화면 — AI 판이 처음부터 펼쳐짐 · [전부 써줘] 이름 · 재료 없으면 막음', (await page.getByTestId('vplan-ai').count()) === 1 && (await page.getByTestId('vplan-ai-need').count()) === 1 && /AI 판 접기/.test(await page.getByTestId('vplan-ai-open').innerText()))
  await page.getByTestId('vplan-tab-problem').click()
  await page.waitForTimeout(200)
  const fieldAi = page.locator('[data-testid="vplan-field"][data-id="development_background"] [data-testid="vplan-field-ai"]')
  check('D2 칸마다 [AI로 이 칸 쓰기]', (await page.getByTestId('vplan-field-ai').count()) >= 4 && (await fieldAi.count()) === 1)
  await fieldAi.click()
  await page.waitForTimeout(400)
  check('D3 재료 없이 누르면 → 재료 탭으로(지어내지 않게)', (await page.getByTestId('vplan-tab-mat').getAttribute('aria-selected')) === 'true' && !sent.some((r) => r.assistId?.startsWith('venture.')))
  await page.getByTestId('vplan-mat-ax').fill('실제로 만든 것: 진동 센서 앱 · 마모 경고')
  await page.getByTestId('vplan-mat-ax').blur()
  await page.waitForTimeout(1500)
  await page.getByTestId('vplan-tab-problem').click()
  await page.waitForTimeout(200)
  await fieldAi.click()
  await page.waitForFunction(() => (document.querySelector('[data-testid="vplan-field"][data-id="development_background"] [data-testid="vplan-text"]')?.value ?? '').includes('AI 가 쓴 개발 배경'), null, { timeout: 15000 })
  const vs = sent.filter((r) => r.assistId?.startsWith('venture.'))
  check('D4 [AI로 이 칸 쓰기] → 그 칸 묶음(venture.p1) 하나만 · 칸에 AI 글 · 같은 묶음 경쟁력 칸도', vs.length === 1 && vs[0].assistId === 'venture.p1' && (await page.locator('[data-testid="vplan-field"][data-id="competitiveness_strategy"] [data-testid="vplan-text"]').inputValue()).includes('AI 가 쓴 경쟁력'), vs.map((r) => r.assistId))
  check('D5 위 AI 판에도 그 묶음 "씀"', (await page.locator('[data-testid="vplan-ai-row"][data-key="p1"]').getAttribute('data-phase')) === 'done')
  await shot(page, 'D4-field-ai')
  check('PC 가로 넘침 0 · JS 오류 0', (await overflowX(page)) <= 0 && errors.length === 0, errors)
  await ctx.close()
}

/* ---------------- 휴대폰 390 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.route('**/api/ai-assist', mock)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/tools/cert-os/mainbiz?client=cli_wooil', { waitUntil: 'networkidle' })
  await page.getByTestId('cert-step-2').click()
  await page.getByTestId('cert-other-actions').locator('summary').click()
  await page.getByTestId('cert-prep-pack-more').click()
  await page.waitForTimeout(300)
  await page.getByTestId('owner-reply-open').click()
  await page.getByTestId('owner-reply-text').fill('1. 네\n2. 월별로 정리 중')
  await page.getByTestId('owner-reply-split').click()
  await page.getByTestId('pack-say-run').click()
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="pack-say"]').length > 0, null, { timeout: 15000 })
  await page.getByTestId('pack-question').first().locator('summary').click()
  await shot(page, 'E1-390')
  check('E1 휴대폰 390 — 답장 나누기 · 말할 답 · 가로 넘침 0', (await page.getByTestId('owner-reply-pick').count()) === 2 && (await overflowX(page)) <= 0)
  await ctx.close()
}

await browser.close()
console.log(`\nqa:certai: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
