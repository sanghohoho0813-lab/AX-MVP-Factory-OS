/**
 * 모듈 전 화면 순회 (D-95) — 도구 7개의 모든 목차 화면을 1440·390 에서, 업체 없이·업체로(?client=) 연다.
 *   - 화면 오류(pageerror)·콘솔 오류·실패한 요청·4xx/5xx 가 없는지
 *   - 가로로 넘치지 않는지 · 본문이 비지 않았는지 · 오류 울타리(screen-error)가 서지 않았는지
 *   - 오류 울타리: 크레탑 화면 조각을 일부러 끊으면 한 번 새로고침 → '새 버전' 안내 · 사이드바는 남음 · 옮기면 풀림
 *
 *   node e2e/modules.mjs http://localhost:4390
 */
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  if (!ok) console.log(`FAIL  ${name}${detail ? ' ' + detail : ''}`)
}

const SECTIONS = {
  tax: ['calculators'],
  'startup-tax': ['judge', 'report'],
  cretop: ['analyze', 'core-check', 'extractor'],
  employment: ['dashboard', 'companies', 'board', 'diagnosis', 'roster', 'schedule', 'wage', 'simulator', 'programs', 'settings'],
  labcare: ['dashboard', 'tasks', 'clients', 'assessment', 'setup-docs', 'org-diagram', 'notes', 'changes', 'survey', 'check', 'inspection', 'tax', 'reports', 'resources', 'settings'],
  'policy-funding': ['dashboard', 'diagnosis', 'customers', 'report'],
  'sales-kit': ['briefing', 'prospecting', 'companies', 'followup', 'meeting', 'reports', 'packages', 'pipeline', 'analytics', 'content', 'education', 'strategies', 'updates', 'settings'],
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

for (const [w, h, mob] of [[1440, 900, false], [390, 844, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'ko-KR', isMobile: mob, hasTouch: mob })
  const page = await ctx.newPage()
  let bucket = []
  page.on('pageerror', (e) => bucket.push('화면 오류 ' + String(e).slice(0, 160)))
  page.on('console', (m) => {
    if (m.type() === 'error') bucket.push('콘솔 ' + m.text().slice(0, 160))
  })
  page.on('requestfailed', (r) => {
    if (!/supabase|favicon/.test(r.url())) bucket.push('요청 실패 ' + r.url().slice(0, 120))
  })
  page.on('response', (r) => {
    if (r.status() >= 400 && !/favicon/.test(r.url())) bucket.push(`HTTP ${r.status()} ${r.url().slice(0, 120)}`)
  })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  for (const [tool, secs] of Object.entries(SECTIONS)) {
    for (const s of secs) {
      for (const q of ['', '?client=cli_hansol']) {
        bucket = []
        const path = `/tools/${tool}/${s}${q}`
        await page.goto(BASE + path, { waitUntil: 'networkidle' })
        await page.waitForTimeout(400)
        const r = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
          err: !!document.querySelector('[data-testid="screen-error"]'),
          text: (document.querySelector('main')?.innerText ?? '').trim().length,
        }))
        check(`${w} ${path}: 오류 없음`, bucket.length === 0 && !r.err, bucket.slice(0, 3).join(' | '))
        check(`${w} ${path}: 가로로 넘치지 않음`, r.sw <= r.cw + 1, `${r.sw}/${r.cw}`)
        check(`${w} ${path}: 본문이 있다`, r.text >= 20, String(r.text))
      }
    }
  }
  await ctx.close()
}

/* ---- 오류 울타리 ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const cut = /CretopPage-[^/]*\.js$/
  await page.route(cut, (route) => route.abort())
  // 새로고침은 '페이지 읽기(load)' 로 센다 — 목차 이동(주소만 바뀜)은 세지 않는다
  let loads = 0
  page.on('load', () => {
    loads += 1
  })
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '크레탑 분석기' }).click()
  await page.waitForTimeout(3000)
  const panel = page.getByTestId('screen-error')
  check('울타리: 화면 조각을 못 받으면 한 번만 새로고침한다 (무한 새로고침 없음)', loads === 1, String(loads))
  check('울타리: 그래도 안 되면 새 버전 안내가 본문 자리에 선다', (await panel.count()) === 1 && (await panel.innerText()).includes('새 버전'))
  check('울타리: 사이드바·머리줄은 남는다', (await page.getByRole('navigation', { name: '주 메뉴' }).count()) === 1)
  await page.unroute(cut)
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '세금 계산기' }).click()
  await page.waitForTimeout(800)
  check('울타리: 다른 화면으로 옮기면 풀린다', (await panel.count()) === 0 && (await page.locator('main').innerText()).includes('세금 계산기'))
  await ctx.close()
}

/* ---- 서류 PDF 읽기 (PDF 글자 읽기 6.x) · 인쇄 모양 ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  // 사업자등록증 모양의 글자 PDF 를 그 자리에서 만든다 (홈택스 PDF 처럼 글자가 들어 있는 PDF)
  const pdfPath = join(tmpdir(), 'axmvp-bizreg-sample.pdf')
  await page.setContent(`<html><body style="font-family:'Noto Sans KR',sans-serif;font-size:14px;line-height:2">
    <h2>사업자등록증</h2><div>(법인사업자)</div><div>등록번호 : 214-88-01234</div><div>법인명(단체명) : 주식회사 대한정밀</div>
    <div>대 표 자 : 홍길동</div><div>개 업 연 월 일 : 2019 년 03 월 02 일</div><div>법인등록번호 : 110111-1234567</div>
    <div>사업장 소재지 : 서울특별시 강남구 테헤란로 123</div></body></html>`)
  await page.pdf({ path: pdfPath, format: 'A4' })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: '서류에서 불러오기' }).first().click()
  await page.waitForTimeout(300)
  const dlg = page.getByRole('dialog', { name: '서류에서 정보 불러오기' })
  await dlg.locator('input[type="file"]').setInputFiles(pdfPath)
  const read = await page
    .waitForFunction(() => /214-?88-?01234/.test(document.querySelector('[aria-label="서류에서 정보 불러오기"]')?.textContent ?? '') || /214-?88-?01234/.test([...document.querySelectorAll('[aria-label="서류에서 정보 불러오기"] input')].map((i) => i.value).join(' ')), null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false)
  const dlgText = (await dlg.innerText().catch(() => '')) + ' ' + (await dlg.locator('input').evaluateAll((xs) => xs.map((x) => x.value).join(' ')).catch(() => ''))
  check('서류 PDF: 사업자등록증 PDF 에서 등록번호를 읽는다', read, dlgText.slice(0, 160).replace(/\n/g, ' '))
  check('서류 PDF: 상호도 읽는다', /대한정밀/.test(dlgText))
  check('서류 PDF: 읽는 동안 화면 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '))

  // 인쇄 — 창업감면 결과서: 인쇄하면 결과서만 나오고 메뉴·머리줄은 빠진다
  await page.goto(BASE + '/tools/startup-tax/judge', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '1분 판정하기' }).click()
  await page.waitForTimeout(600)
  await page.goto(BASE + '/tools/startup-tax/report', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.emulateMedia({ media: 'print' })
  const printed = await page.evaluate(() => {
    const vis = (el) => !!el && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none'
    return {
      sheet: vis(document.querySelector('.print-document')),
      nav: vis(document.querySelector('nav[aria-label="주 메뉴"]')),
      text: (document.querySelector('.print-document')?.textContent ?? '').length,
    }
  })
  check('인쇄: 창업감면 결과서가 인쇄된다', printed.sheet && printed.text > 200, JSON.stringify(printed))
  check('인쇄: 사이드바 메뉴는 인쇄되지 않는다', !printed.nav, JSON.stringify(printed))
  await page.pdf({ path: join(tmpdir(), 'axmvp-startup-print.pdf'), format: 'A4' })
  await page.emulateMedia({ media: 'screen' })

  // 인쇄 — 정책자금 리포트: '문서 영역' 표시가 없는 원본 화면도 빈 종이가 아니라 리포트가 찍힌다 (D-95)
  await page.goto(BASE + '/tools/policy-funding/diagnosis?sample=1&client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: '고객으로 저장하기' }).first().click()
  await page.waitForTimeout(600)
  await page.goto(BASE + '/tools/policy-funding/report?cid=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.emulateMedia({ media: 'print' })
  const pf = await page.evaluate(() => {
    const vis = (el) => !!el && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none'
    const head = [...document.querySelectorAll('main span')].find((x) => x.textContent.includes('정책자금 상담 리포트'))
    return { head: vis(head), nav: vis(document.querySelector('nav[aria-label="주 메뉴"]')), header: vis(document.querySelector('header')), moduleNav: vis(document.querySelector('[data-testid="module-nav"]')) }
  })
  check('인쇄: 정책자금 리포트가 빈 종이가 아니라 리포트로 찍힌다', pf.head, JSON.stringify(pf))
  check('인쇄: 정책자금 리포트에 OS 메뉴·머리줄·모듈 목차는 안 찍힌다', !pf.nav && !pf.header && !pf.moduleNav, JSON.stringify(pf))
  await page.emulateMedia({ media: 'screen' })
  await ctx.close()
}

/* ---- 브라우저 저장 공간이 가득 찼을 때 — 조용히 사라지지 않고 띠로 알린다 (D-95) ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/tools/employment/companies?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  // 저장소를 끝까지 채운다
  await page.evaluate(() => {
    for (const size of [262144, 16384, 1024, 64, 4, 1]) {
      const chunk = 'x'.repeat(size)
      for (let k = 0; k < 100000; k += 1) {
        try {
          localStorage.setItem('zz_fill_' + size + '_' + k, chunk)
        } catch {
          break
        }
      }
    }
  })
  await page.getByRole('button', { name: '업체 저장' }).last().click()
  await page.waitForTimeout(1200)
  const notice = page.getByTestId('storage-full')
  check('저장 공간 가득 참: 저장 실패를 띠로 알린다 (예전: 조용히 사라짐)', (await notice.count()) === 1 && (await notice.innerText()).includes('백업'))
  check('저장 공간 가득 참: 백업 받으러 가는 길', (await notice.getByRole('link', { name: /백업 내려받으러/ }).count()) === 1)
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('zz_fill_')) localStorage.removeItem(k)
  })
  await ctx.close()
}

await browser.close()
console.log(`\n모듈 전 화면: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
