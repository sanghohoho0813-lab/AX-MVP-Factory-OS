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
const ctx = await browser.newContext({
  viewport: { width: 390, height: 900 },
  isMobile: true,
  hasTouch: true,
  // 복사한 내용을 실제로 읽어 확인하기 위해
  permissions: ['clipboard-read', 'clipboard-write'],
})
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

/* ---------------- 계약 정보 · 해 드린 일 ---------------- */
{
  // 한솔테크 — 현금 + 보험 혼합, 2025-03-15 계약
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const main = (await page.locator('main').innerText()) ?? ''
  check('계약: 언제 계약했는지 보인다', main.includes('2025-03-15'), main.slice(0, 200))
  // 오늘 날짜에 따라 달라지므로 모양만 확인한다
  check('계약: 몇 달째인지 보인다', /\d+년 \d+개월째 \(\d+개월\)|\d+개월째/.test(main))
  check('계약: 어떤 방식인지 보인다', main.includes('현금 + 보험'))
  check('계약: 얼마인지 보인다', main.includes('현금 3,000,000원') && main.includes('월납 750,000원'), main.slice(0, 300))

  // 보험 건별은 눌러야 나온다 — 한눈에 보는 줄을 길게 만들지 않기 위해서다
  check('계약: 보험 자세히는 접혀 있다', !main.includes('CEO플랜 종신'))
  const detail = page.getByRole('button', { name: /보험 2건 자세히/ }).first()
  check('계약: [보험 2건 자세히] 가 있다', (await detail.count()) > 0)
  await detail.click()
  await page.waitForTimeout(300)
  const opened = (await page.locator('main').innerText()) ?? ''
  check('계약: 보험사·상품명이 나온다', opened.includes('삼성생명') && opened.includes('CEO플랜 종신'))
  check('계약: 월납보험료가 건별로 나온다', opened.includes('500,000원') && opened.includes('250,000원'))
  check('계약: 언제 가입했는지 나온다', opened.includes('2025-04-01'))
  check('계약: 납입기간이 나온다', opened.includes('10년납'))

  // 고쳐 쓰면 저장된다
  await page.getByRole('button', { name: '계약 고치기' }).first().click()
  await page.waitForTimeout(500)
  check('계약 고치기: 시트가 열린다', (await page.getByRole('dialog').count()) > 0)
  // 적는 동안 자리점이 찍힌다 — 숫자만 쳐도 4,500,000 으로 보인다
  await page.getByLabel('현금 계약 금액').fill('4500000')
  await page.waitForTimeout(200)
  check('계약 고치기: 금액에 자리점이 찍힌다', (await page.getByLabel('현금 계약 금액').inputValue()) === '4,500,000', await page.getByLabel('현금 계약 금액').inputValue())
  await page.getByRole('button', { name: '저장', exact: true }).first().click()
  await page.waitForTimeout(900)
  const after = (await page.locator('main').innerText()) ?? ''
  check('계약 수정: 화면에 바로 반영된다', after.includes('현금 4,500,000원'), after.slice(0, 200))
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((r) => r.id === 'cli_hansol'),
  )
  const savedContract = saved?.contract ?? saved?.payload?.contract
  check('계약 수정: 저장된다', savedContract?.cashAmount === 4_500_000, JSON.stringify(savedContract))
  check('계약 수정: 활동 기록에 남는다', (saved?.activity ?? saved?.payload?.activity ?? []).some((a) => a.kind === 'contract'))

  // 우일산업 — 해 드린 일 4건, 최근 것이 위로
  await page.goto(BASE + '/ops/clients/cli_wooil', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const w = (await page.locator('main').innerText()) ?? ''
  check('해 드린 일: 카드가 있다', w.includes('해 드린 일'))
  check('해 드린 일: 끝낸 건수를 센다', w.includes('끝낸 일 4건'), w.slice(0, 300))
  check('해 드린 일: 언제 끝냈는지 보인다', w.includes('2026-09-02') && w.includes('2024-11-08'))
  check('해 드린 일: 최근 것이 위', w.indexOf('2026-09-02') < w.indexOf('2024-11-08'))
  // '지금 하는 일' 은 맨 위 '지금 할 일' 카드에 이미 있다 — 여기서 되풀이하지 않는다
  check('해 드린 일: 지금 하는 일을 되풀이하지 않는다', !w.includes('지금 하는 일'))
  check('계약: 현금만이면 월납 줄이 없다', w.includes('현금 8,000,000원') && !w.includes('월납'))

  // 목록에서도 계약한 지 얼마나 됐는지 보인다
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const list = (await page.locator('main').innerText()) ?? ''
  check('목록: 계약 개월수가 보인다', /계약 \d+년 \d+개월째|계약 \d+개월째/.test(list), list.slice(0, 300))
}

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


/* ── 번호 서식과 복사 선택 ── */
{
  // 기록에 하이픈 없이 들어 있는 업체(우일산업: 3138112508 · 설립일 20020216)
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const board = (await page.locator('main').innerText()) ?? ''
  check('목록: 사업자번호에 하이픈이 붙는다', board.includes('313-81-12508'), board.includes('3138112508') ? '날것이 그대로 보임' : '')
  check('목록: 날것 설립일을 찍지 않는다', !board.includes('20020216'))
  check('목록: 업력을 읽어 보여 준다', /25년차/.test(board))

  await page.goto(BASE + '/ops/clients/cli_wooil', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const profile = (await page.locator('main').innerText()) ?? ''
  check('상세: 번호가 하이픈 모양으로 보인다', /313\s*-\s*81\s*-\s*12508/.test(profile), profile.slice(0, 160))
  check('상세: 날것 설립일을 찍지 않는다', !profile.includes('20020216') && profile.includes('2002-02-16'), profile.slice(0, 120))

  /*
   * 조각마다 따로 복사.
   * 신청서 입력칸이 [ ]-[ ]-[ ] 로 나뉘어 있으면 조각을 하나씩 붙여야 한다.
   * 세 조각이 각각 제 값만 복사하는지 클립보드를 실제로 읽어 확인한다.
   */
  for (const [seg, label] of [['313', '앞'], ['81', '가운데'], ['12508', '뒤']]) {
    const btn = page.getByRole('button', { name: `사업자등록번호 ${seg} 만 복사` }).first()
    check(`조각 복사: ${label} 조각 단추가 있다`, (await btn.count()) > 0)
    await btn.click()
    await page.waitForTimeout(350)
    const got = await page.evaluate(() => navigator.clipboard.readText())
    check(`조각 복사: ${label} 조각만 들어간다`, got === seg, got)
  }

  /*
   * 법인등록번호는 앞 6자리·뒤 7자리 두 조각이다 — 주민등록번호와 같은 모양이고,
   * 신청서 칸도 그렇게 나뉘어 있다. 두 조각이 따로 복사되는지 본다.
   */
  const corp = (await page.locator('main').innerText()) ?? ''
  check('법인등록번호: 앞뒤로 나뉘어 보인다', /110111\s*-\s*1234567/.test(corp), corp.slice(0, 160))
  for (const [seg, label] of [['110111', '앞 6자리'], ['1234567', '뒤 7자리']]) {
    const btn = page.getByRole('button', { name: `법인등록번호 ${seg} 만 복사` }).first()
    check(`법인등록번호: ${label} 단추가 있다`, (await btn.count()) > 0)
    await btn.click()
    await page.waitForTimeout(350)
    const got = await page.evaluate(() => navigator.clipboard.readText())
    check(`법인등록번호: ${label}만 들어간다`, got === seg, got)
  }

  // 보이는 그대로 전체 복사
  const shown = page.getByRole('button', { name: '사업자등록번호 전체 복사' }).first()
  check('복사: [전체] 선택지가 있다', (await shown.count()) > 0)
  await shown.click()
  await page.waitForTimeout(400)
  const asIs = await page.evaluate(() => navigator.clipboard.readText())
  check('복사: 전체는 보이는 그대로', asIs === '313-81-12508', asIs)

  // 숫자만 복사
  const digitsBtn = page.getByRole('button', { name: /사업자등록번호 숫자만 복사/ }).first()
  check('복사: [숫자만] 선택지가 있다', (await digitsBtn.count()) > 0)
  await digitsBtn.click()
  await page.waitForTimeout(400)
  const plain = await page.evaluate(() => navigator.clipboard.readText())
  check('복사: 숫자만 고르면 하이픈이 빠진다', plain === '3138112508', plain)

  // 전체 복사도 두 가지
  await page.getByRole('button', { name: '전체 복사' }).first().click()
  await page.waitForTimeout(400)
  const allAsIs = await page.evaluate(() => navigator.clipboard.readText())
  check('전체 복사: 기본은 하이픈 포함', allAsIs.includes('313-81-12508'), allAsIs.slice(0, 80))
  await page.getByRole('button', { name: '숫자만' }).first().click()
  await page.waitForTimeout(400)
  const allPlain = await page.evaluate(() => navigator.clipboard.readText())
  check('전체 복사: 숫자만 판도 있다', allPlain.includes('3138112508') && !allPlain.includes('313-81-12508'), allPlain.slice(0, 80))
}

await browser.close()
console.log(`\n목록 바로 고치기 · 계약 단계 · 삭제: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
