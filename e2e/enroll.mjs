/**
 * 명부 → 직원 → 참여신청 기한 → 오늘 (D-138).
 *
 *  1440 · 360(아주 큰 글자) 두 폭에서
 *   명부(CSV) 올리기 → '청년도약 참여신청 기한' 칸(기한 안 2명 · 오래된 사람 없음) → 직원으로 등록 → 다시 눌러도 겹치지 않음
 *   → 업체 기록에 붙이기(기한 2건) → 오늘 '놓치면 끝나는 기한'(7일 안 1건) → 고용지원금 직원 카드 '참여신청 D-N'
 *   → 고용지원금 대시보드 '오늘 바로 해야 할 일' 이 아직 안 지난 기한을 '기한 초과' 로 세지 않음. 가로 넘침 0 · 오류 0.
 *
 *  날짜는 오늘 기준으로 만든다(입사 1개월 전 · 3개월 − 2일 전 · 3년 전) — 언제 돌려도 같은 결과.
 *
 *   node e2e/enroll.mjs http://localhost:4390
 */
import { chromium } from 'playwright'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' ' + detail}`)
}

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const now = new Date()
const monthsAgo = (m, plusDays = 0) => {
  const d = new Date(now.getFullYear(), now.getMonth() - m, now.getDate() + plusDays)
  return ymd(d)
}
const HIRE_RECENT = monthsAgo(1) // 기한까지 약 2개월
const HIRE_URGENT = monthsAgo(3, 2) // 3개월 − 2일 → 기한 D-2 안팎(7일 안)
const HIRE_OLD = monthsAgo(36)
const dir = mkdtempSync(join(tmpdir(), 'enroll-'))
const CSV = join(dir, 'roster.csv')
writeFileSync(
  CSV,
  ['성명,주민등록번호,자격취득일,고용보험', `최근청년,980310-1******,${HIRE_RECENT},가입`, `급한청년,010203-3******,${HIRE_URGENT},가입`, `오래된청년,000510-4******,${HIRE_OLD},가입`, '박노인,650501-1******,2015-01-01,가입'].join('\n'),
)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const vp of [
  { tag: '1440', w: 1440, h: 900, s: 'default' },
  { tag: '360 아주 큰 글자', w: 360, h: 780, s: 'extra_large' },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate((s) => localStorage.setItem('axmvp.ui.text_scale', JSON.stringify(s)), vp.s)
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)

  await page.goto(BASE + '/tools/employment/roster?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.getByLabel('명부 파일').setInputFiles(CSV)
  await page.waitForTimeout(1500)
  const panel = await page.getByTestId('youth-enroll').innerText().catch(() => '')
  check(`${vp.tag} 명부: 참여신청 기한 칸에 기한 안 2명`, panel.includes('참여신청 기한 2명') && panel.includes('최근청년') && panel.includes('급한청년'), panel.slice(0, 200))
  check(`${vp.tag} 명부: 3년 전 입사자는 기한 칸에 없음`, !panel.includes('오래된청년'))
  check(`${vp.tag} 명부: 가로 넘침 없음`, (await overflow()) <= 0)

  await page.getByTestId('youth-enroll-register').click()
  await page.waitForTimeout(1200)
  const done1 = await page.getByTestId('youth-enroll-done').innerText().catch(() => '')
  check(`${vp.tag} 등록: 2명을 청년도약 직원(준비)으로`, done1.startsWith('2명을 청년도약 직원(준비)으로 등록'), done1)
  await page.getByTestId('youth-enroll-register').click()
  await page.waitForTimeout(1200)
  const done2 = await page.getByTestId('youth-enroll-done').innerText().catch(() => '')
  check(`${vp.tag} 등록: 다시 눌러도 겹치지 않음`, done2.startsWith('0명') && done2.includes('이미 있는 2명은 건너뜀'), done2)

  await page.getByRole('button', { name: /기록에 붙이기/ }).first().click()
  await page.waitForTimeout(1500)
  check(`${vp.tag} 붙이기: 기한 2건이 달력에`, (await page.locator('body').innerText()).includes('기한 2건이 달력에 올라갔습니다'))

  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const hard = await page.getByTestId('today-hard-deadlines').innerText().catch(() => '')
  check(`${vp.tag} 오늘: 놓치면 끝나는 기한에 급한청년(7일 안)만`, hard.includes('놓치면 끝나는 기한 1건') && hard.includes('급한청년') && !hard.includes('최근청년'), hard)
  check(`${vp.tag} 오늘: 가로 넘침 없음`, (await overflow()) <= 0)

  await page.goto(BASE + '/tools/employment/companies?cid=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  await page.getByTestId('emp-orig').getByRole('button', { name: /직원 \(\d+\)/ }).first().click()
  await page.waitForTimeout(600)
  const badges = await page.getByTestId('enroll-badge').allInnerTexts()
  check(`${vp.tag} 직원 카드: 두 사람 모두 '참여신청 D-N (MM/DD까지)'`, badges.length === 2 && badges.every((b) => /^참여신청 D-\d+ \(\d\d\/\d\d까지\)$/.test(b)), badges.join(' | '))
  check(`${vp.tag} 직원 카드: 가로 넘침 없음`, (await overflow()) <= 0)

  await page.goto(BASE + '/tools/employment/dashboard', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const dash = await page.locator('main').innerText()
  check(`${vp.tag} 고용 대시보드: 아직 안 지난 기한은 '기한 초과' 로 세지 않음`, !dash.includes('기한 초과'))
  check(`${vp.tag} 페이지 오류 없음`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(`\nenroll: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
