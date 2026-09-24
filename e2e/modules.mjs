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

await browser.close()
console.log(`\n모듈 전 화면: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
