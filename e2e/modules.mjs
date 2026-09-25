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
          // D-98: 화면(또는 창) 밖으로 삐져나가 잘린 칸 — 문서는 안 넘쳐도 창 안에서 잘릴 수 있다.
          //   일부러 옆으로 미는 표·탭 줄(표·그림을 품었거나 한 줄 flex)은 뺀다
          clipped: (() => {
            const vw = document.documentElement.clientWidth
            const intended = (el) => {
              for (let a = el.parentElement; a; a = a.parentElement) {
                const cs = getComputedStyle(a)
                if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && a.scrollWidth > a.clientWidth) {
                  const strip = (x) => getComputedStyle(x).display.includes('flex') && getComputedStyle(x).flexDirection.startsWith('row') && getComputedStyle(x).flexWrap === 'nowrap'
                  return !!a.querySelector('table,svg,canvas') || strip(a) || (a.children.length === 1 && strip(a.children[0])) || a.scrollHeight <= a.clientHeight + 2
                }
              }
              return false
            }
            const out = []
            for (const el of document.body.querySelectorAll('input,select,textarea,button,a,span,p,div,td,th,h1,h2,h3,h4,label')) {
              const r = el.getBoundingClientRect()
              if (!r.width || !r.height || el.closest('aside,[aria-hidden="true"],.sr-only')) continue
              const own = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(el.tagName) || [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
              if (own && (r.right > vw + 2 || r.left < -2) && !intended(el)) out.push(`${el.tagName.toLowerCase()} "${(el.innerText || el.placeholder || '').trim().slice(0, 16)}"`)
            }
            return out
          })(),
        }))
        check(`${w} ${path}: 오류 없음`, bucket.length === 0 && !r.err, bucket.slice(0, 3).join(' | '))
        check(`${w} ${path}: 가로로 넘치지 않음`, r.sw <= r.cw + 1, `${r.sw}/${r.cw}`)
        check(`${w} ${path}: 본문이 있다`, r.text >= 20, String(r.text))
        check(`${w} ${path}: 화면 밖으로 잘린 칸 없음`, r.clipped.length === 0, r.clipped.slice(0, 3).join(' | '))
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

/* ---- 휴대폰 모듈 목차 서랍: Esc 로 닫히고 초점이 목차 단추로 돌아온다 (D-99) ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  for (const path of ['/tools/employment/dashboard', '/tools/sales-kit/briefing']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.getByTestId('module-menu-open').click()
    const sheet = page.locator('[role="dialog"][aria-label$="목차"]')
    const opened = (await sheet.count()) === 1
    const focusInSheet = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    const closed = (await sheet.count()) === 0
    const back = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
    check(`${path}: 목차 서랍이 열리면 초점이 서랍 안으로`, opened && focusInSheet)
    check(`${path}: Esc 로 닫히고 초점이 목차 단추로 돌아온다`, closed && back === 'module-menu-open', `${closed} ${back}`)
  }
  await ctx.close()
}

/* ---- 맨 위로 (D-100): 두 화면 넘게 내려가면 뜨고, 하단 메뉴·크레탑 하단 탭을 가리지 않으며, 누르면 맨 위 ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  for (const path of ['/ops/clients', '/tools/cretop/analyze']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    // 업체 100곳·긴 크레탑 보고서처럼 긴 화면을 흉내 낸다 (크레탑은 하단 탭이 붙은 칸 안을 길게)
    await page.evaluate(() => {
      const mini = document.querySelector('.cretop-mini')
      if (mini) mini.insertAdjacentHTML('afterbegin', '<div style="height:9000px"></div>')
      else document.body.style.minHeight = '9000px'
    })
    const atTop = await page.getByTestId('scroll-top').count()
    await page.evaluate(() => window.scrollTo(0, 5000))
    await page.waitForTimeout(250)
    const btn = page.getByTestId('scroll-top')
    const shown = (await btn.count()) === 1
    const box = shown ? await btn.boundingBox() : null
    const below = await page.evaluate(() => {
      const tops = [...document.querySelectorAll('.cretop-mini-tabs, nav.fixed')].map((e) => e.getBoundingClientRect()).filter((r) => r.top < window.innerHeight && r.bottom > window.innerHeight - 160).map((r) => r.top)
      return tops.length ? Math.min(...tops) : window.innerHeight
    })
    check(`${path}: 맨 위에서는 '맨 위로' 가 없다`, atTop === 0)
    check(`${path}: 내려가면 '맨 위로' 가 뜨고 하단 메뉴·탭을 가리지 않는다`, shown && box !== null && box.y + box.height <= below - 4, `${box && Math.round(box.y + box.height)} / ${Math.round(below)}`)
    if (shown) await btn.click()
    await page.waitForTimeout(900)
    if (path.includes('cretop')) check(`${path}: 크레탑 하단 탭이 화면 아래에 붙어 있다(시험이 제 구실을 하는지)`, below < 844 - 60, String(Math.round(below)))
    check(`${path}: 누르면 맨 위로 간다`, (await page.evaluate(() => window.scrollY)) === 0)
  }
  await ctx.close()
}

/* ---- 시연 데이터가 없으면 '샘플 체험' 단추를 세우지 않는다 (D-101) — 전에는 눌러도 '찾을 수 없습니다' 로 끝났다 ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  for (const path of ['/settings', '/getting-started']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    const n = await page.getByRole('button', { name: /샘플로 전체 흐름|샘플 전체 흐름|샘플 프로젝트로 체험/ }).count()
    check(`${path}: 시연 데이터가 없으면 '샘플 체험' 단추가 없다`, n === 0, String(n))
  }
  await ctx.close()
}

/* ---- 고객 설문(휴대폰) — 반복 표가 화면을 옆으로 밀지 않고, 예전 기본 안내문의 '법적 검토' 문장이 고객에게 안 보인다 (D-101) ---- */
{
  const now = new Date().toISOString()
  const opts = ['예', '아니오'].map((l, i) => ({ id: `o${i}`, label: l, value: `v${i}`, score: i, riskSignal: 'none', orderIndex: i }))
  const base = { helpText: '', example: '', category: 'workflow', scope: 'common', scoringDomain: 'none', expertRiskGrade: 'green', condition: null, sourceScope: 'common' }
  const dist = {
    id: 'dist-qa', projectId: 'proj-qa', organizationId: 'org-qa', blueprintId: 'bp-qa', respondentRole: 'worker', surveyTitle: '고객 설문 시험',
    blueprintSnapshot: [{ id: 's1', title: '거래처', description: '', orderIndex: 0, placements: [
      { ...base, id: 'p1', questionId: 'q1', questionCode: 'QA-1', questionText: '거래처가 있나요?', type: 'yes_no', options: opts, repeatTableColumns: [], required: true, orderIndex: 0 },
      { ...base, id: 'p2', questionId: 'q2', questionCode: 'QA-2', questionText: '주요 거래처를 적어 주세요.', type: 'repeat_table', options: [], required: false, orderIndex: 1,
        repeatTableColumns: [{ id: 'c1', label: '거래처명', fieldType: 'short_text', required: true, unit: '', orderIndex: 0 }, { id: 'c2', label: '월 주문 건수', fieldType: 'number', required: false, unit: '건', orderIndex: 1 }, { id: 'c3', label: '비고', fieldType: 'short_text', required: false, unit: '', orderIndex: 2 }] },
    ] }],
    recipientName: '홍길동', recipientPosition: '', recipientEmail: '', recipientPhone: '', accessToken: 'qa-survey-token-d101', status: 'issued',
    introMessage: '시험', consentRequired: true, expiresAt: null, issuedAt: now, firstOpenedAt: null, lastOpenedAt: null, submittedAt: null, revokedAt: null, createdAt: now, updatedAt: now,
    privacyNotice: '본 설문은 담당 컨설턴트가 귀사의 업무 진단을 위해 응답 내용을 내부적으로만 활용합니다. 수집 항목은 응답자 성명·직책·연락처 및 설문 응답이며, 실제 운영 전 개인정보 처리 문구는 법적 검토가 필요합니다.',
  }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
  await page.evaluate((d) => localStorage.setItem('axmvp.v1.survey_distributions', JSON.stringify([d])), dist)
  await page.goto(BASE + '/survey/' + dist.accessToken, { waitUntil: 'networkidle' })
  const privacy = await page.locator('main').innerText()
  check('고객 설문: 예전 기본 안내문의 \'법적 검토\' 문장이 고객에게 안 보인다', !privacy.includes('처리 문구는 법적 검토가 필요'), privacy.slice(0, 120))
  await page.locator('input[type=checkbox]').first().check()
  await page.getByRole('button', { name: '설문 시작' }).click()
  await page.waitForTimeout(400)
  const tableShown = (await page.locator('main table').count()) === 1
  const sw = await page.evaluate(() => document.documentElement.scrollWidth)
  check('고객 설문: 반복 표가 있는 화면이 휴대폰 폭(390)을 넘지 않는다', tableShown && sw <= 391, `${tableShown} ${sw}`)
  await ctx.close()
}

/* ---- 테마를 바꾸면 영업·크레탑이 새로고침 없이 따라간다 (D-98) ----
 * 모듈을 한 번 연 뒤(옛 테마로 팔레트를 읽음) 설정에서 테마를 바꾸고, 새로고침 없이(뒤로 가기) 돌아와
 * 화면에 옛 테마 강조색이 남았는지 센다. D-96·97 에서는 새로고침해야 바뀌었다 */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  const brandRgb = () =>
    page.evaluate(() => {
      const probe = document.createElement('i')
      document.body.appendChild(probe)
      const out = ['50', '500', '600', '700'].map((st) => {
        probe.style.color = `var(--color-brand-${st})`
        return getComputedStyle(probe).color
      })
      probe.remove()
      return out
    })
  const leftovers = (old) =>
    page.evaluate((old) => {
      const set = new Set(old)
      let n = 0
      const ex = []
      for (const el of document.querySelectorAll('main *')) {
        const cs = getComputedStyle(el)
        if (!el.getBoundingClientRect().width) continue
        for (const v of [cs.color, cs.backgroundColor, cs.borderTopColor]) {
          if (set.has(v)) {
            n += 1
            if (ex.length < 3) ex.push(`${el.tagName.toLowerCase()} "${(el.innerText || '').trim().slice(0, 14)}" ${v}`)
            break
          }
        }
      }
      return { n, ex }
    }, old)
  for (const path of ['/tools/sales-kit/briefing', '/tools/cretop/analyze']) {
    await page.evaluate(() => localStorage.setItem('axmvp.ui.preferences', JSON.stringify({ theme: 'deep-teal' })))
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const oldRgb = await brandRgb()
    const before = await leftovers(oldRgb)
    await page.click('header a[aria-label="설정"]')
    await page.waitForURL(/\/settings/)
    await page.getByRole('radio', { name: /버건디/ }).click()
    await page.waitForTimeout(200)
    await page.goBack()
    await page.waitForURL(new RegExp(path.replace(/\//g, '\\/')))
    await page.waitForTimeout(500)
    const after = await leftovers(oldRgb)
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    check(`${path}: 옛 테마에서는 테마색이 보였다(시험이 제 구실을 하는지)`, before.n > 0, String(before.n))
    check(`${path}: 테마를 바꾸고 새로고침 없이 돌아오면 옛 테마색 0`, theme === 'burgundy' && after.n === 0, `${theme} ${after.n} ${after.ex.join(' | ')}`)
  }
  await ctx.close()
}

/* ---- D-106: 홈페이지 회원가입 → 잠재고객 상담신청 에 뜬다 (빨간 숫자 +1 · 회사 이름 미리 채움) ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/ops/inbox', { waitUntil: 'networkidle' })
  const reqBadge = async () => Number(((await page.locator('aside [data-nav-badge="requests"]').innerText().catch(() => '0')) ?? '0').trim() || 0)
  const before = await reqBadge()
  // 운영에서는 DB 트리거가 넣는 한 줄 — 같은 모양으로 넣는다
  await page.evaluate(() => {
    const k = 'axmvp.v1.customer_events'
    const list = JSON.parse(localStorage.getItem(k) ?? '[]')
    const now = new Date().toISOString()
    list.unshift({ id: 'ev-signup-qa', workspaceId: null, portalClientLinkId: null, operationsClientId: null, profileId: 'p-signup', eventType: 'customer_signed_up', sourceType: 'auth_signup', sourceId: 'u-signup-qa', dedupeKey: 'auth_signup:u-signup-qa:customer_signed_up', payloadVersion: 1, payload: { name: '이고객', email: 'lee@customer.test', phone: '010-1234-5678', company_name: '새봄식품', signup_source: 'miraeailab.com' }, priority: 'medium', status: 'new', occurredAt: now, receivedAt: now, handledAt: null, handledBy: null, handlingNote: null, createdAt: now, updatedAt: now })
    localStorage.setItem(k, JSON.stringify(list))
  })
  await page.goto(BASE + '/ops/inbox', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const main = (await page.locator('main').innerText()) ?? ''
  check('회원가입: 상담신청에 뜬다 (종류 · 설명)', main.includes('회원가입') && main.includes('고객 플랫폼에 회원가입했습니다') && main.includes('새봄식품'), main.slice(0, 300))
  check('회원가입: 빨간 숫자가 하나 는다', (await reqBadge()) === before + 1, `${before} → ${await reqBadge()}`)
  const card = page.locator('article', { hasText: '고객 플랫폼에 회원가입했습니다' }).first()
  await card.getByRole('button', { name: /새 고객사로 만들기/ }).click()
  await page.waitForTimeout(300)
  const dlg = page.getByRole('dialog')
  const values = await dlg.locator('input').evaluateAll((els) => els.map((e) => e.value))
  check('회원가입: 새 고객사로 만들 때 회사 · 이름 · 연락처가 채워져 있다', values.includes('새봄식품') && values.some((v) => v.includes('010-1234-5678')), JSON.stringify(values))
  await page.keyboard.press('Escape')
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /챙길 것/ }).click()
  await page.waitForTimeout(300)
  check('회원가입: 머리줄 종에도 한글로 뜬다', ((await page.locator('header').innerText()) ?? '').includes('새봄식품 · 회원가입'))
  await ctx.close()
}

/* ---- D-107: 상담신청 종류별 보기 · N일째 대기 (1440 · 390) ---- */
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const mobile = vp.width < 500
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const tag = mobile ? '390' : '1440'
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(() => {
    const k = 'axmvp.v1.customer_events'
    const row = (id, eventType, daysAgo, payload) => {
      const at = new Date(Date.now() - daysAgo * 86_400_000).toISOString()
      return { id, workspaceId: null, portalClientLinkId: null, operationsClientId: null, profileId: null, eventType, sourceType: 'qa', sourceId: id, dedupeKey: `qa:${id}`, payloadVersion: 1, payload, priority: 'medium', status: 'new', occurredAt: at, receivedAt: at, handledAt: null, handledBy: null, handlingNote: null, createdAt: at, updatedAt: at }
    }
    localStorage.setItem(k, JSON.stringify([
      row('d107-su-old', 'customer_signed_up', 6, { name: '오래기다림', email: 'old@customer.test', company_name: '오래된가입' }),
      row('d107-su-new', 'customer_signed_up', 0, { name: '방금가입', email: 'new@customer.test', company_name: '방금가입사' }),
      row('d107-consult', 'consultation_requested', 3, { name: '상담고객', company_name: '상담요청사' }),
    ]))
  })
  await page.goto(BASE + '/ops/inbox', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const group = page.getByTestId('inbox-type-filter')
  check(`종류별(${tag}): 종류 칩 줄이 보인다`, await group.isVisible())
  const chipText = (await group.innerText()).replace(/\s+/g, ' ')
  check(`종류별(${tag}): 전부 3 · 상담 신청 1 · 회원가입 2`, /전부 3/.test(chipText) && /상담 신청 1/.test(chipText) && /회원가입 2/.test(chipText), chipText)
  const oldCard = page.locator('article', { hasText: '오래된가입' })
  check(`종류별(${tag}): 6일 기다린 가입에 빨간 "6일째 대기"`, (await oldCard.getByTestId('event-waiting').innerText()).includes('6일째 대기'))
  check(`종류별(${tag}): 3일 기다린 상담에 "3일째 대기"`, (await page.locator('article', { hasText: '상담요청사' }).getByTestId('event-waiting').innerText()).includes('3일째 대기'))
  check(`종류별(${tag}): 오늘 들어온 것은 대기 배지 없음`, (await page.locator('article', { hasText: '방금가입사' }).getByTestId('event-waiting').count()) === 0)
  await group.getByRole('button', { name: /회원가입/ }).click()
  await page.waitForTimeout(200)
  check(`종류별(${tag}): 회원가입만 누르면 2장`, (await page.locator('main article').count()) === 2 && (await page.locator('main article', { hasText: '상담요청사' }).count()) === 0)
  check(`종류별(${tag}): 주소에 남는다`, page.url().includes('type=customer_signed_up'), page.url())
  check(`종류별(${tag}): 누른 칩이 눌림으로 표시`, (await group.getByRole('button', { name: /회원가입/ }).getAttribute('aria-pressed')) === 'true')
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  check(`종류별(${tag}): 새로고침해도 회원가입만`, (await page.locator('main article').count()) === 2)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(`종류별(${tag}): 옆으로 밀리지 않음`, overflow <= 1, String(overflow))
  await page.getByTestId('inbox-type-filter').getByRole('button', { name: /전부/ }).click()
  await page.waitForTimeout(200)
  check(`종류별(${tag}): 전부로 돌아오면 3장`, (await page.locator('main article').count()) === 3 && !page.url().includes('type='))
  if (!mobile) {
    await page.goto(BASE + '/ops/inbox?type=nonsense', { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    check('종류별: 모르는 종류 주소는 전부로', (await page.locator('main article').count()) === 3)
  }
  await ctx.close()
}

/* ---- D-108: 휴대폰 하단 목차 — 순서 · 서랍과 같은 아이콘 색 · 고객사 수 · 상담신청 빨간 숫자 ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/ops/calendar', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const bar = page.locator('nav[aria-label="주요 화면"]')
  const labels = (await bar.locator('li').allInnerTexts()).map((t) => t.replace(/\d+/g, '').replace(/\s+/g, ''))
  check('하단 목차: 오늘 · 일정 · 고객 · 상담신청 · 더보기 순서', labels.join(',') === '오늘,일정,고객,상담신청,더보기', labels.join(','))
  const colors = await page.evaluate(() => {
    const probe = (v) => { const d = document.createElement('span'); d.style.color = `var(${v})`; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c }
    const icons = [...document.querySelectorAll('nav[aria-label="주요 화면"] li svg')].map((el) => getComputedStyle(el).color)
    return { icons, want: ['--color-nav-overview', '--color-nav-evidence', '--color-nav-ops', '--color-nav-alert'].map(probe) }
  })
  check('하단 목차: 아이콘 색이 서랍 메뉴와 같다 (오늘 · 일정 · 고객 · 상담신청)', colors.want.every((c, i) => colors.icons[i] === c), JSON.stringify(colors))
  check('하단 목차: 더보기도 회색이 아니다', colors.icons[4] !== 'rgb(148, 163, 184)' && new Set(colors.icons).size === 5, JSON.stringify(colors.icons))
  const clientBadge = bar.locator('[data-nav-badge="clients"]')
  // 서랍(햄버거) 메뉴의 고객 관리 숫자와 같아야 한다
  await page.locator('header').getByRole('button', { name: /메뉴/ }).first().click()
  await page.waitForTimeout(400)
  const drawerClients = (await page.locator('[role="dialog"] [data-nav-badge="clients"], aside [data-nav-badge="clients"]').last().innerText().catch(() => '')).trim()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('하단 목차: 고객 옆 고객사 수 = 서랍 메뉴 숫자', /^\d+$/.test(drawerClients) && (await clientBadge.innerText()).trim() === drawerClients, `${await clientBadge.innerText()} vs ${drawerClients}`)
  const fs = await clientBadge.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  check('하단 목차: 고객사 수 글자는 이름보다 작다', fs < 11, String(fs))
  const req = bar.locator('[data-nav-badge="requests"]')
  const n = Number((await req.innerText()).trim())
  check('하단 목차: 상담신청 빨간 숫자', n > 0 && (await req.evaluate((el) => getComputedStyle(el).backgroundColor)) !== 'rgba(0, 0, 0, 0)')
  check('하단 목차: 상담신청이 있으면 이름도 빨강', (await bar.getByText('상담신청', { exact: true }).evaluate((el) => getComputedStyle(el).color)) !== (await bar.getByText('오늘', { exact: true }).evaluate((el) => getComputedStyle(el).color)))
  check('하단 목차: 지금 화면(일정) 표시', (await bar.locator('a[aria-current="page"]').innerText()).includes('일정'))
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('하단 목차: 옆으로 밀리지 않음', overflow <= 1, String(overflow))
  await ctx.close()
}

/* ---- D-105: 고객 실사용 테스트 화면(/test) 휴대폰 — 동의 → 완료 체크 · 의견 → 제출, 옆으로 밀리지 않음 ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    const now = new Date().toISOString()
    const sc = (i, t) => ({ id: 'sc' + i, sourceScenarioId: '', sourceCriterionIds: [], title: t, description: '현장에서 실제로 해 보는 순서입니다. 휴대폰에서 긴 설명이 어떻게 보이는지 보려고 문장을 조금 길게 씁니다.', type: 'task', priority: 'high', targetRoles: [], preconditions: '관리자 계정으로 로그인한 상태', steps: ['메뉴에서 작업일지를 연다', '오늘 날짜로 새 일지를 만든다', '사진 두 장을 올리고 저장한다'], expectedResult: '저장 후 목록 맨 위에 오늘 일지가 보인다', measurementMethod: '', requiredEvidence: '', passRule: '3분 안에 도움 없이 끝내면 통과', required: true, status: 'ready', orderIndex: i, createdAt: now, updatedAt: now, archivedAt: null })
    localStorage.setItem('axmvp.v1.validation_workspaces', JSON.stringify([{ id: 'vw-qa', organizationId: 'org-qa', projectId: 'p-qa', title: '작업일지 앱 현장 검증 (휴대폰 시험)', scenarios: [sc(1, '작업일지 새로 쓰기'), sc(2, '지난 일지 찾아보기 (검색어 · 날짜로)')], createdAt: now, updatedAt: now }]))
    localStorage.setItem('axmvp.v1.validation_test_sessions', JSON.stringify([{ id: 'ts-qa', workspaceId: 'vw-qa', projectId: 'p-qa', accessToken: 'tok-qa-mobile', participantName: '박현장', scenarioIds: ['sc1', 'sc2'], status: 'active', consented: false, consentedAt: null, results: [], submittedAt: null, expiresAt: null, createdAt: now, updatedAt: now }]))
  })
  await page.goto(BASE + '/test/tok-qa-mobile', { waitUntil: 'networkidle' })
  const wide = () => page.evaluate(() => document.documentElement.scrollWidth)
  check('고객 테스트(휴대폰): 과제 두 개가 보인다', (await page.getByText('작업일지 새로 쓰기').count()) === 1 && (await page.getByText('지난 일지 찾아보기', { exact: false }).count()) === 1)
  check('고객 테스트(휴대폰): 옆으로 밀리지 않는다', (await wide()) <= 391, String(await wide()))
  const submit = page.getByRole('button', { name: /제출/ }).last()
  check('고객 테스트: 동의 전에는 제출할 수 없다', await submit.isDisabled())
  await page.locator('input[type=checkbox]').nth(0).check()
  await page.locator('input[type=checkbox]').nth(1).check()
  await page.locator('textarea').first().fill('사진 올리는 단추가 작아서 한 번 잘못 눌렀어요')
  check('고객 테스트: 제출 단추가 손가락 크기(44px 이상)', ((await submit.boundingBox())?.height ?? 0) >= 44)
  await submit.click()
  await page.waitForTimeout(600)
  check('고객 테스트: 제출하면 감사 화면', ((await page.locator('body').innerText()) ?? '').includes('제출이 완료되었습니다'))
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.validation_test_sessions'))[0])
  check('고객 테스트: 답이 저장된다(완료 · 의견)', saved.status === 'completed' && saved.consented === true && JSON.stringify(saved.results).includes('잘못 눌렀어요'), JSON.stringify(saved).slice(0, 200))
  check('고객 테스트: 화면 오류 없음', errs.length === 0, errs.join(' | '))
  await ctx.close()
}

/* ---- D-102: 도구함 아이콘 색 사다리 · 세금 계산기 짙은 색이 테마를 따라감 · 인쇄 · 첫 화면 파일 ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const seen = []
  page.on('response', async (res) => {
    if (res.url().endsWith('.js')) seen.push({ url: res.url(), text: await res.text().catch(() => '') })
  })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  // 모든 화면이 먼저 받는 첫 파일(index-*.js)에 샘플 체험 준비 코드·안내창이 없다 (전에는 862KB 중 약 230KB 가 이것이었다)
  const entry = seen.find((r) => /\/assets\/index-[^/]*\.js$/.test(r.url))
  check('첫 파일: 받았다(시험이 제 구실을 하는지)', !!entry && entry.text.length > 1000, entry && entry.url)
  check('첫 파일: 샘플 체험 준비 코드(작업실 서비스 묶음)가 없다', !!entry && !entry.text.includes('시연용 진단 질문을 찾을 수 없습니다'))
  check('첫 화면: 샘플 체험 준비 코드를 아예 받지 않는다', !seen.some((r) => r.text.includes('시연용 진단 질문을 찾을 수 없습니다')))
  check('첫 파일: 처음 사용 안내창 글이 없다', !!entry && !entry.text.includes('가이드 챕터'))
  await page.goto(BASE + '/getting-started', { waitUntil: 'networkidle' })
  await page.getByRole('main').getByRole('button', { name: /안내 다시 보기/ }).first().click()
  await page.waitForTimeout(800)
  check('처음 사용 가이드: 누르면 그때 불러와 열린다', (await page.getByRole('dialog').count()) >= 1)
  await page.keyboard.press('Escape')
  await page.evaluate(seedScript())

  const hues = []
  for (const theme of ['navy-blue', 'burgundy']) {
    await page.evaluate((t) => localStorage.setItem('axmvp.ui.preferences', JSON.stringify({ theme: t })), theme)
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    const ramp = await page.evaluate(() =>
      [...document.querySelectorAll('aside svg.nav-ramp')].map((el) => {
        const m = getComputedStyle(el).color.match(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)/)
        return m ? m.slice(1).map(Number) : null
      }),
    )
    const ok = ramp.length >= 7 && ramp.every(Boolean)
    const sameTone = ok && ramp.every((c) => c[0] === ramp[0][0] && c[1] === ramp[0][1])
    const steps = ok ? ramp.slice(1).map((c, i) => (c[2] - ramp[i][2] + 360) % 360) : []
    check(`${theme}: 도구함 아이콘 ${ramp.length}개가 밝기·채도는 같고`, sameTone, JSON.stringify(ramp[0]))
    check(`${theme}: 위에서 아래로 색상만 조금씩(한 칸 8~20°) 옮겨 간다`, steps.length > 0 && steps.every((d) => d >= 8 && d <= 20), steps.map((d) => d.toFixed(0)).join(','))
    hues.push(ok ? ramp[0][2] : -1)

    await page.goto(BASE + '/tools/tax', { waitUntil: 'networkidle' })
    await page.locator('button', { hasText: '특정법인' }).first().click()
    await page.waitForTimeout(300)
    const col = await page.evaluate(() => {
      const probe = document.createElement('i')
      document.body.appendChild(probe)
      probe.style.color = 'var(--color-navy-900)'
      const navy = getComputedStyle(probe).color
      probe.remove()
      const dark = [...document.querySelectorAll('[data-block]')].find((e) => getComputedStyle(e).color !== 'rgb(15, 23, 42)' && getComputedStyle(e).backgroundColor !== 'rgb(255, 255, 255)')
      const th = document.querySelector('table[data-table] th')
      const tab = document.querySelector('button[role="tab"][aria-selected="true"]')
      return { navy, dark: dark && getComputedStyle(dark).backgroundColor, th: th && getComputedStyle(th).backgroundColor, tab: tab && getComputedStyle(tab).backgroundColor }
    })
    check(`${theme}: 세금 계산기 짙은 결과 칸 = 사이드바와 같은 테마 짙은 색`, col.dark === col.navy, JSON.stringify(col))
    check(`${theme}: 고른 세부 탭도 같은 색`, col.tab === col.navy, JSON.stringify(col))
    check(`${theme}: 표 머리는 테마 짙은 색 계열(투명·옛 남색 아님)`, !!col.th && col.th !== 'rgba(0, 0, 0, 0)' && col.th !== 'rgb(30, 41, 59)', col.th)
    hues.push(col.dark)
  }
  check('테마를 바꾸면 아이콘 색·세금 계산기 짙은 색이 함께 바뀐다', hues[0] !== hues[2] && hues[1] !== hues[3], JSON.stringify(hues))

  // 인쇄 (A4 폭) — 제목이 찍히고, 짙은 바탕이 빠지지 않고, 긴 표가 오른쪽에서 잘리지 않는다
  await page.setViewportSize({ width: 794, height: 1123 })
  await page.emulateMedia({ media: 'print' })
  await page.waitForTimeout(200)
  const pr = await page.evaluate(() => {
    const h1 = document.querySelector('main h1')
    const t = document.querySelector('table[data-table]')
    return {
      title: h1 ? h1.getBoundingClientRect().width : 0,
      adjust: getComputedStyle(document.documentElement).printColorAdjust,
      tableFits: t ? t.scrollWidth <= t.parentElement.getBoundingClientRect().width + 1 : false,
      buttons: [...document.querySelectorAll('main button')].filter((b) => /기본값으로|업체 기록에 붙이기/.test(b.innerText) && b.getBoundingClientRect().width > 0).length,
    }
  })
  check('인쇄(세금 계산기): 화면 제목이 찍힌다', pr.title > 20, String(pr.title))
  check('인쇄: 바탕색을 빼지 않는다(짙은 칸 흰 글이 흰 종이에 사라지지 않게)', pr.adjust === 'exact', pr.adjust)
  check('인쇄(세금 계산기): 긴 표가 종이 폭 안에 들어온다', pr.tableFits)
  check('인쇄(세금 계산기): 화면용 단추(기본값으로·업체 기록에 붙이기)는 안 찍힌다', pr.buttons === 0, String(pr.buttons))
  await ctx.close()
}

await browser.close()
console.log(`\n모듈 전 화면: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
