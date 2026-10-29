/**
 * 세금 계산기 대조 시험 (D-85).
 *
 * 원본(배포본 HTML, e2e/fixtures/tax-original.html)과 우리 화면(/tools/tax)에 **같은 입력**을 넣고
 * 결과 줄(이름·값)과 표(칸 글자)가 **한 글자도 다르지 않은지** 본다.
 * 기본값 한 벌 + 계산기마다 값을 바꾼 한 벌.
 *
 *   node e2e/tax-parity.mjs http://localhost:4390
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const here = path.dirname(fileURLToPath(import.meta.url))
const ORIGINAL = 'file://' + path.join(here, 'fixtures', 'tax-original.html')

let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' ' + detail}`)
}

/** 계산기 → 소탭 → 결과 칸 id · 표 id (원본 기준) */
const PLAN = [
  { calc: 't2', subs: [{ sub: 'main', blocks: ['s_personal', 's_corp'], tables: ['s_table'] }] },
  { calc: 't6', subs: [{ sub: 'p1', blocks: ['q_out'] }, { sub: 'p2', blocks: ['r_out'] }, { sub: 'p3', blocks: ['t_out'] }] },
  {
    calc: 't9',
    subs: [
      { sub: 'inc_a', blocks: ['inc_a_out1', 'inc_a_out2', 'inc_a_out3', 'inc_a_out4'] },
      { sub: 'inc_b', blocks: ['inc_b_out1', 'inc_b_out2', 'inc_b_out3', 'inc_b_out4'] },
      { sub: 'inc_cmp', blocks: ['inc_cmp_out'], tables: ['inc_cmp_table'] },
    ],
  },
  { calc: 't5', subs: [{ sub: 'j1', blocks: ['j_out'] }, { sub: 'j2', blocks: ['k_out'] }] },
  { calc: 't7', subs: [{ sub: 'w1', blocks: ['w1_out'], tables: ['w1_table'] }, { sub: 'w2', blocks: ['w2_out'], tables: ['w2_table'] }, { sub: 'w3', blocks: ['w3_out'], tables: ['w3_table'] }, { sub: 'w4', blocks: ['w4_out'], tables: ['w4_table'] }] },
  { calc: 't8', subs: [{ sub: 'x1', blocks: ['x1_summary'], tables: ['x1_judge'] }, { sub: 'x2', blocks: ['x2_summary'], tables: ['x2_judge'] }] },
  { calc: 't1', subs: [{ sub: 'main', blocks: ['g_out'], tables: ['g_table'] }] },
  { calc: 't4', subs: [{ sub: 'i1', blocks: ['h_out'] }, { sub: 'i2', blocks: ['h2_out'] }] },
  { calc: 't3', subs: [{ sub: 'main', blocks: ['v_out'] }] },
]

/** 값을 바꾼 두 번째 벌 — 각 계산기의 가지를 다르게 태운다 (줄 목록 입력은 건드리지 않는다) */
const VARIANT = {
  t2: { s_monthly: '3500000' },
  // D-225: 임원 퇴직 한도(r_)는 원본과 다르게 고친 곳 하나 — 2020년 뒤 취임이면 원본은 2020년 1월부터 세어 한도가 부푼다.
  //        원본과 같아야 하는 2019년 전 취임으로 대조하고, 2020년 뒤 취임은 단위 시험(test:taxplan D-225)이 바른 값을 지킨다
  t6: { q_pay: '250000000', q_corptax_base: '150000000', r_start: '2016-06-01', r_end: '2026-09-01', t_start: '2019-01-15', t_end: '2026-03-31', t_amount: '90000000' },
  t9: { inc_a_transferPrice: '60000', inc_a_isMajor: '소액주주', inc_a_basicDed: '여', inc_a_salary: '150000000', inc_a_dividend: '15000000', inc_b_dividend: '15000000', inc_b_under1yr: '1년미만', inc_b_isSme: '비중소기업' },
  t5: { j_price: '1200000000', j_rel: '특수관계없는자(타인)', j_major: '대주주 외(소액주주)', k_rel1: '배우자', k_prior2: '0' },
  t7: { w1_principal: '800000000', w2_amount: '50000000', w3_amount: '900000000', w4_ratio: '15' },
  t8: { x1_fair: '90000', x1_issue: '20000', x2_fair: '30000', x2_redeem: '10000' },
  t1: { g_principal: '350000000', g_years: '8', g_debt: '없음', g_corp: '20' },
  t4: { h_re: '4000000000', h_spouse: '아니오', h_skip: '할증30%', h_house_ok: '예', h_house_val: '500000000' },
  t3: { v_type: '부동산과다보유법인', v_re_fair: '2400000000', v_cap0: '100000000' },
}

const ORIGINAL_SUB_ID = { main: null }

/**
 * D-317 법 기준으로 고친 곳 — 원본(배포본)이 옛 세법이라 일부러 다르다. 바른 값은 단위 시험(test:mirae-os 'D-317')이 손계산으로 지킨다.
 *  t6/p1  개인 vs 법인 — 근로소득 기본세율을 2023년 이후 구간(1,400만 · 5,000만)으로
 *  t6/p3  퇴직소득세 — 퇴사일로 그해 법(2023년부터 근속연수공제 · 세율 구간) · 근속연수는 날짜까지
 *  t1     가지급금 — 법인세 적용세율 기본값 20 → 22(2026 사업연도 · 지방소득세 포함). 바꾼 값 벌은 양쪽 20 으로 맞춰 식을 대조한다
 *  t8     감자 · 증자 판정표의 법인세상당액 — 2026 사업연도 법인세율(10 · 20 · 22 · 25%). 위 요약 줄은 그대로 대조한다
 *  t5/j2  증여세 — 신고세액공제 3%(상증법 §69) 줄을 더함(D-323)
 *  t9     2026 소득세 — 배당가산율 11% → 10%(2024년 이후 지급분 · D-327). 기본값 벌(배당 1억)만 SKIP — 바꾼 값 벌은 배당을 2,000만 아래로 두어 식을 대조한다
 */
const LAW_FIX = new Set(['기본값|t6/p1', '바꾼 값|t6/p1', '기본값|t6/p3', '바꾼 값|t6/p3', '기본값|t1/main', '기본값|t5/j2', '바꾼 값|t5/j2', '기본값|t9/inc_a', '기본값|t9/inc_b', '기본값|t9/inc_cmp'])
const LAW_FIX_TABLES = new Set(['t8/x1/x1_judge', 't8/x2/x2_judge'])

async function readOriginal(page, blocks, tables) {
  return page.evaluate(
    ({ blocks, tables }) => {
      const out = { blocks: {}, tables: {} }
      for (const id of blocks) {
        const el = document.getElementById(id)
        out.blocks[id] = el ? [...el.querySelectorAll('.rline')].map((r) => [r.querySelector('.k')?.textContent ?? '', r.querySelector('.v')?.textContent ?? '']) : null
      }
      for (const id of tables ?? []) {
        const el = document.getElementById(id)
        out.tables[id] = el ? [...el.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '')) : null
      }
      return out
    },
    { blocks, tables },
  )
}

async function readOurs(page, blocks, tables) {
  return page.evaluate(
    ({ blocks, tables }) => {
      const out = { blocks: {}, tables: {} }
      for (const id of blocks) {
        const el = document.querySelector(`[data-block="${id}"]`)
        out.blocks[id] = el ? [...el.querySelectorAll('[data-line]')].map((r) => [r.getAttribute('data-k') ?? '', r.getAttribute('data-v') ?? '']) : null
      }
      for (const id of tables ?? []) {
        const el = document.querySelector(`[data-table="${id}"]`)
        out.tables[id] = el ? [...el.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '')) : null
      }
      return out
    },
    { blocks, tables },
  )
}

/** 원본에 값 넣기 — id 로 찾아 값을 바꾸고 input 이벤트를 쏜다 (원본 판넬이 input 을 듣는다) */
async function setOriginal(page, values) {
  await page.evaluate((values) => {
    for (const [id, v] of Object.entries(values)) {
      const el = document.getElementById(id)
      if (!el) throw new Error('원본에 없는 칸: ' + id)
      el.value = v
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }, values)
}

/** 우리 화면에 값 넣기 — 같은 id 의 칸에 fill/selectOption */
async function setOurs(page, values) {
  for (const [id, v] of Object.entries(values)) {
    const el = page.locator(`#${id}`)
    if ((await el.count()) !== 1) throw new Error('우리 화면에 없는 칸: ' + id)
    const tag = await el.evaluate((e) => e.tagName)
    if (tag === 'SELECT') await el.selectOption(v)
    else await el.fill(v)
  }
}

function diff(a, b) {
  const A = JSON.stringify(a)
  const B = JSON.stringify(b)
  if (A === B) return ''
  // 첫 다른 자리만 짧게
  let i = 0
  while (i < A.length && i < B.length && A[i] === B[i]) i += 1
  return `\n      원본: …${A.slice(Math.max(0, i - 40), i + 80)}\n      우리: …${B.slice(Math.max(0, i - 40), i + 80)}`
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
const orig = await ctx.newPage()
const ours = await ctx.newPage()
// 한 탭에서 계산기 화면을 수십 번 옮기면 시험 브라우저가 쓰레기를 늦게 치워 탭이 죽었다(2026-10-14 · tools 와 같은 까닭).
// 2초마다 정리한다 — 앱이 아니라 시험 브라우저 문제라 시험 쪽에서 정리한다(e2e/tools.mjs 와 같음).
for (const pg of [orig, ours]) {
  const gc = await ctx.newCDPSession(pg)
  setInterval(() => void gc.send('HeapProfiler.collectGarbage').catch(() => {}), 2000).unref()
}
await orig.goto(ORIGINAL)
await ours.goto(BASE + '/tools/tax', { waitUntil: 'networkidle' })
await ours.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('axmvp.tax.')).forEach((k) => localStorage.removeItem(k)))

/** 우리 화면에서 계산기·소탭 열기 — 값은 기억되므로(localStorage) 이동해도 남는다 */
async function openOurs(calc, sub) {
  await ours.goto(`${BASE}/tools/tax?c=${calc}${sub && sub !== 'main' ? `&s=${sub}` : ''}`, { waitUntil: 'networkidle' })
  await ours.waitForTimeout(150)
}

for (const round of ['기본값', '바꾼 값']) {
  for (const p of PLAN) {
    // 바꾼 값 벌: 계산기의 모든 칸을 먼저 양쪽에 넣는다 (소탭이 달라도 값은 한 벌이다)
    if (round === '바꾼 값') {
      const values = VARIANT[p.calc] ?? {}
      await setOriginal(orig, values)
      // 우리 화면은 소탭마다 칸이 보이므로 소탭을 돌며 그 소탭의 칸만 넣는다
      for (const s of p.subs) {
        await openOurs(p.calc, s.sub)
        const here = {}
        for (const [id, v] of Object.entries(values)) {
          if ((await ours.locator(`#${id}`).count()) === 1) here[id] = v
        }
        if (Object.keys(here).length > 0) await setOurs(ours, here)
      }
    }
    for (const s of p.subs) {
      if (LAW_FIX.has(`${round}|${p.calc}/${s.sub}`)) {
        console.log(`SKIP  ${round} · ${p.calc}/${s.sub} — 법 기준으로 고친 곳(D-317 · D-323 · D-327 · 단위 시험이 지킴)`)
        continue
      }
      await openOurs(p.calc, s.sub)
      const a = await readOriginal(orig, s.blocks, s.tables)
      const b = await readOurs(ours, s.blocks, s.tables)
      for (const id of s.blocks) {
        const d = diff(a.blocks[id], b.blocks[id])
        check(`${round} · ${p.calc}/${s.sub} · ${id} (${a.blocks[id]?.length ?? 0}줄)`, a.blocks[id] !== null && b.blocks[id] !== null && d === '', d)
      }
      for (const id of s.tables ?? []) {
        if (LAW_FIX_TABLES.has(`${p.calc}/${s.sub}/${id}`)) {
          console.log(`SKIP  ${round} · ${p.calc}/${s.sub} · 표 ${id} — 법 기준으로 고친 곳(D-317 · D-323 · D-327 · 단위 시험이 지킴)`)
          continue
        }
        const d = diff(a.tables[id], b.tables[id])
        check(`${round} · ${p.calc}/${s.sub} · 표 ${id} (${a.tables[id]?.length ?? 0}행)`, a.tables[id] !== null && b.tables[id] !== null && d === '', d)
      }
    }
  }
}

// 줄 목록(주주 추가) — 우리 화면에서 주주를 하나 더 넣어 표에 반영되는지 (원본과 같은 논리)
await openOurs('t8', 'x1')
await ours.getByRole('button', { name: '주주 추가' }).click()
await ours.waitForTimeout(200)
await ours.getByLabel('주주 4 주주명').fill('신규')
await ours.getByLabel('주주 4 실제 인수주식수(신주)').fill('1000')
await ours.waitForTimeout(200)
const judgeRows = await ours.locator('[data-table="x1_judge"] tbody tr').count()
check('줄 추가: 인수주식이 있는 새 주주가 판정표에 들어온다', judgeRows === 2, String(judgeRows))
await ours.getByRole('button', { name: '주주 4 지우기' }).click()
await ours.waitForTimeout(200)
check('줄 지우기: 지우면 판정표에서 빠진다', (await ours.locator('[data-table="x1_judge"] tbody tr').count()) === 1)

// 기억 — 새로고침해도 바꾼 값이 남는다
await openOurs('t1', 'main')
await ours.locator('#g_principal').fill('123456789')
await ours.waitForTimeout(200)
await ours.reload({ waitUntil: 'networkidle' })
check('기억: 새로고침해도 입력이 남는다', (await ours.locator('#g_principal').inputValue()).replace(/,/g, '') === '123456789')
await ours.getByRole('button', { name: '기본값으로' }).click()
await ours.waitForTimeout(200)
check('기본값으로: 되돌린다', (await ours.locator('#g_principal').inputValue()).replace(/,/g, '') === '1000000000')

await browser.close()
console.log(`\n세금 계산기 대조: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
