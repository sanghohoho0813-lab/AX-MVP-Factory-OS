/**
 * 고객 목록에서 바로 고치기 — 브라우저 인수 시험.
 *
 *   node e2e/board.mjs <baseUrl>
 *
 * 지키려는 것
 *   1. 업무가 15개로 늘어도 가로로 밀 일이 없다 (표를 버린 이유)
 *   2. 목록에서 바꾼 상태가 업체 기록에 실제로 저장된다 (화면용 사본이 아니다)
 *   3. '해당 없음' 은 가로선으로 지워지고, 다시 되돌릴 수 있다
 */

import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log('PASS ', name) }
  else { fail++; console.log('FAIL ', name, detail ?? '') }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
page.on('pageerror', (e) => check('JS 오류 없음', false, String(e).slice(0, 160)))

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(seedScript())
await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

// 가로 넘침 없음
const of = await page.evaluate(() => ({ d: document.documentElement.scrollWidth, w: window.innerWidth }))
check('가로 스크롤 없음', of.d <= of.w + 1, `${of.d} > ${of.w}`)

// 업무 조각을 눌러 상태 시트를 연다
const chip = page.getByRole('button', { name: /^특허/ }).first()
await chip.click()
await page.waitForTimeout(400)
check('상태 시트가 열린다', await page.getByRole('dialog').isVisible())
check('해당 없음 선택지가 있다', await page.getByRole('button', { name: /해당 없음/ }).first().isVisible())

await page.getByRole('button', { name: /해당 없음/ }).first().click()
await page.waitForTimeout(600)
check('시트가 닫힌다', (await page.getByRole('dialog').count()) === 0)

// 조각이 가로선으로 지워졌는지
const struck = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'))
  const el = btns.find((b) => (b.textContent || '').trim().startsWith('특허'))
  if (!el) return null
  return getComputedStyle(el).textDecorationLine
})
check('해당 없음은 가로선으로 지운다', String(struck).includes('line-through'), String(struck))

// 새로고침해도 남아 있는지 (실제 저장)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(700)
const stored = await page.evaluate(() => {
  const raw = localStorage.getItem('axmvp.v1.operations_clients')
  if (!raw) return null
  const list = JSON.parse(raw)
  const c = list.find((r) => r.id === 'cli_hansol')
  return c?.services?.patent?.status ?? null
})
check('새로고침 뒤에도 저장돼 있다', stored === 'not_applicable', String(stored))

/*
 * 다시 되돌릴 수 있는지.
 * '해당 없음' 은 앞으로 볼 일 없는 항목이라 카드에서 접힌다. 되돌리려면 [그 외 N] 을 펴야 하는데,
 * 그 단추가 카드 안에 바로 있어서 한 번이면 닿는다 — 그 경로가 실제로 열리는지 확인한다.
 */
// 접힘 단추는 무엇이 접혔는지 그대로 말한다 — '완료 2 · 시작 전 1'
const more = page.getByRole('button', { name: /^(완료|시작 전|해당 없음)\s*\d+/ }).first()
check('접힌 조각을 펼 수 있는 단추가 있다', (await more.count()) > 0)
check('단추가 무엇이 접혔는지 말한다', /완료|시작 전|해당 없음/.test((await more.textContent()) ?? ''), (await more.textContent()) ?? '')
await more.click()
await page.waitForTimeout(400)
check('펴면 해당 없음 조각이 다시 보인다', (await page.getByRole('button', { name: /^특허/ }).count()) > 0)
await page.getByRole('button', { name: /^특허/ }).first().click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /진행 중/ }).first().click()
await page.waitForTimeout(600)
const back = await page.evaluate(() => {
  const list = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
  return list.find((r) => r.id === 'cli_hansol')?.services?.patent?.status ?? null
})
check('해당 없음에서 다시 바꿀 수 있다', back === 'in_progress', String(back))

// 수금 시트
await page.getByRole('button', { name: /^미수금/ }).first().click()
await page.waitForTimeout(400)
check('수금 시트가 열린다', await page.getByRole('dialog').isVisible())
check('수금 항목 넣기 칸이 있다', await page.getByRole('button', { name: '넣기' }).isVisible())
await page.getByRole('button', { name: '닫기' }).first().click().catch(() => page.keyboard.press('Escape'))
await page.waitForTimeout(300)

// 15개까지 늘려도 가로로 넘치지 않는지
await page.evaluate(() => {
  const raw = localStorage.getItem('axmvp.v1.custom_services')
  const extra = Array.from({ length: 9 }, (_, i) => ({
    id: `cs${i}`, workspaceId: null, key: `custom_extra${i}`, label: `추가업무${i + 1}`,
    shortLabel: `추가${i + 1}`, description: '', accent: 'ops', recurring: false,
    requiredDocuments: [], enabled: true, order: 100 + i,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  }))
  localStorage.setItem('axmvp.v1.custom_services', JSON.stringify(extra))
  void raw
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const chips = await page.evaluate(() => document.querySelectorAll('button').length)
const of2 = await page.evaluate(() => ({ d: document.documentElement.scrollWidth, w: window.innerWidth }))
check('업무 15개에서도 가로 스크롤 없음', of2.d <= of2.w + 1, `${of2.d} > ${of2.w} (버튼 ${chips}개)`)

/* ---------------- 계약 단계 · 업체 삭제 ---------------- */
await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

// 계약 단계 선택기
await page.getByRole('button', { name: '더보기' }).first().click()
await page.waitForTimeout(400)
const opts = await page.evaluate(() => {
  const sel = Array.from(document.querySelectorAll('select')).find((s) => s.previousSibling || true)
  const all = Array.from(document.querySelectorAll('select'))
  const stage = all.find((s) => Array.from(s.options).some((o) => o.textContent === '계약 전'))
  void sel
  return stage ? Array.from(stage.options).map((o) => o.textContent) : null
})
check('계약 단계 3가지', JSON.stringify(opts) === JSON.stringify(['계약 전','계약 완료','계약 종료']), JSON.stringify(opts))

// 삭제 — 1차
await page.getByRole('button', { name: '업체 삭제' }).click()
await page.waitForTimeout(400)
check('1차 확인이 뜬다', await page.getByText('이 업체를 삭제할까요?').isVisible())
check('무엇이 사라지는지 알려준다', await page.getByText(/업무 .*개의 진행 상태/).isVisible())
await page.getByRole('button', { name: '네, 다음으로' }).click()
await page.waitForTimeout(400)
check('2차 확인이 뜬다', await page.getByText('마지막 확인').first().isVisible())

const disabled = await page.getByRole('button', { name: /영구 삭제/ }).isDisabled()
check('이름을 적기 전에는 못 누른다', disabled)
await page.getByLabel('확인을 위해 업체 이름 입력').fill('틀린이름')
await page.waitForTimeout(200)
check('틀린 이름이면 여전히 못 누른다', await page.getByRole('button', { name: /영구 삭제/ }).isDisabled())
await page.getByLabel('확인을 위해 업체 이름 입력').fill('한솔테크(주)')
await page.waitForTimeout(200)
check('이름이 맞으면 눌린다', !(await page.getByRole('button', { name: /영구 삭제/ }).isDisabled()))
await page.getByRole('button', { name: /영구 삭제/ }).click()
await page.waitForTimeout(900)
check('목록으로 돌아온다', page.url().endsWith('/ops/clients'))
const left = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').some((r) => r.id === 'cli_hansol'))
check('실제로 지워졌다', left === false)


await browser.close()
console.log(`\n목록 바로 고치기 · 계약 단계 · 삭제: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
