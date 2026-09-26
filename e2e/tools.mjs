/**
 * 도구함 이식 시험 (D-88) — 옮겨 온 도구 여섯 개가 실제로 돌고, 결과가 업체 기록에 붙는지.
 *
 *  1440  도구함 화면(카드·검토중·자리만) → 창업감면 판정(입력→판정→업체에 붙이기) → 업체 상세에 보이는지
 *        → 크레탑(붙여넣기→분석) → 정책자금(샘플→진단) → 영업 도구(대본·전략·가격표·주제)
 *        → 고용지원금·연구소 화면이 열리고 제목이 맞는지 → 도입 검토중 화면
 *  390   도구함·창업감면·크레탑·정책자금이 가로로 넘치지 않는지
 *
 *   node e2e/tools.mjs http://localhost:4390
 */
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' ' + detail}`)
}

const SEBANG = [
  '기업명 세방형(주)', '요약 손익계산서 단위:백만원', '구분 2023 2024 2025', '매출액 6000 6200 6397', '영업이익 90 95 104', '당기순이익 150 180 202',
  '요약 재무상태표 단위:백만원', '구분 2023 2024 2025', '자산총계 12000 11500 11000', '부채총계 9800 10100 8740', '자본총계 2200 1400 1000', '유동자산 3000 2900 2801', '유동부채 9500 9800 10000',
  '재무비율 단위:%', '구분 2023 2024 2025', '부채비율 445.45 721.43 874.00', '유동비율 31.58 29.59 28.01', '이자보상배수 0.75 0.61 0.52',
].join('\n')

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())

  // 도구함
  await page.goto(BASE + '/tools', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  for (const k of ['tax', 'startup-tax', 'cretop', 'employment', 'labcare', 'policy-funding']) {
    check(`도구함: ${k} 카드가 누를 수 있다`, (await page.locator(`a[data-tool="${k}"]`).count()) === 1)
  }
  check('도구함: 영업 도구 모음은 카드 대신 옮겨 간 곳 안내(D-118)', (await page.locator('a[data-tool="sales-kit"]').count()) === 0 && ((await page.getByTestId('tools-moved').innerText()) ?? '').includes('영업 › 영업 관리'))
  check('도구함: 기업인증 OS 는 누를 수 없다', (await page.locator('div[data-tool="cert-os"]').count()) === 1)
  check('사이드바: 도입 검토중 줄이 없다 · 영업 관리가 있다 (D-118)', !(await page.getByRole('navigation', { name: '주 메뉴' }).innerText()).includes('도입 검토중') && (await page.getByRole('navigation', { name: '주 메뉴' }).innerText()).includes('영업 관리'))

  // 창업감면 판정기
  await page.goto(BASE + '/tools/startup-tax', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: '법인사업자', exact: true }).click()
  // 원본 판정기는 날짜를 연·월·일 드롭다운으로 고른다
  const pickDate = async (group, y, m, d) => {
    const g = page.getByRole('group', { name: group })
    await g.getByLabel('연도').selectOption(String(y))
    await g.getByLabel('월').selectOption(String(m))
    await g.getByLabel('일').selectOption(String(d))
  }
  await pickDate('② 대표자 생년월일', 1995, 3, 1)
  await pickDate('③ 창업일', 2025, 1, 15)
  await page.getByRole('button', { name: '아니오', exact: true }).first().click()
  await page.getByRole('button', { name: '제조업', exact: true }).click()
  await page.getByRole('button', { name: '완전 신규 창업', exact: true }).click()
  await page.getByRole('button', { name: '1분 판정하기' }).click()
  await page.waitForTimeout(400)
  const oneline = page.getByTestId('startup-tax-oneline')
  check('창업감면: 판정 한 줄이 나온다', (await oneline.count()) === 1)
  check('창업감면: 청년·비과밀·제조·신규 → 감면 가능성 높음', (await page.locator('body').innerText()).includes('감면 가능성 높음'))
  // 업체에 붙이기
  await page.getByTestId('tool-attach-open').click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /한솔테크/ }).first().click()
  await page.getByTestId('tool-attach-confirm').click()
  await page.waitForTimeout(600)
  check('창업감면: 붙인 뒤 보러 가기 링크', (await page.getByRole('link', { name: /한솔테크\(주\) 에 붙음/ }).count()) === 1)
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const tr = page.getByTestId('tool-results')
  check('업체 상세: 도구 결과 칸에 창업감면 판정', (await tr.count()) === 1 && (await tr.innerText()).includes('창업감면 판정'))
  await tr.getByRole('button', { name: '요약 보기' }).first().click()
  await page.waitForTimeout(200)
  check('업체 상세: 요약을 펴면 카톡용 요약이 보인다', (await tr.innerText()).includes('[창업감면 사전진단 결과]'))

  // 크레탑 — 원본 분석 앱(개요·재무상세·주식가치·제안·요약) 그대로 (D-93)
  await page.goto(BASE + '/tools/cretop', { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '텍스트 붙여넣기' }).click()
  await page.getByLabel('크레탑 원문').fill(SEBANG)
  await page.getByTestId('cretop-run').click()
  await page.waitForTimeout(700)
  const mini = page.getByTestId('cretop-mini')
  check('크레탑: 회사명을 읽는다', (await mini.innerText()).includes('세방형'))
  check('크레탑: 핵심지표에 부채비율 874 · 유동비율 28.01', (await mini.innerText()).includes('874%') && (await mini.innerText()).includes('28.01%'))
  check('크레탑: 종합 진단 요약이 나온다', (await mini.innerText()).includes('종합 진단 요약'))
  const miniTab = async (k) => { await page.locator(`[data-testid="cretop-mini-tabs"] button[data-tab="${k}"]`).click(); await page.waitForTimeout(400); return page.locator('#mini-results').innerText() }
  check('크레탑 재무상세: 3개년 추이·5대 재무비율', /3개년 핵심 추이/.test(await miniTab('detail')) && (await page.locator('#mini-results').innerText()).includes('5대 재무비율'))
  check('크레탑 주식가치: 예상 주식가치', (await miniTab('value')).includes('예상 주식가치'))
  // D-109: 세금 계산기 09(비상장주식 가치평가)와 같은 식 — 순자산(자산 110억 − 부채 87.4억) 40% + 순손익가치 60%, 최저 한도 80%
  await page.getByPlaceholder('예: 50,000').fill('200000')
  await page.waitForTimeout(300)
  const svFinal = await page.getByTestId('stock-value-final').innerText()
  check('크레탑 주식가치: 1주당 10,100원 · 기업가치 20.2억 (손으로 푼 값)', svFinal.includes('10,100') && svFinal.includes('2,020,000,000'), svFinal.replace(/\n/g, ' '))
  const svTable = await page.getByTestId('stock-value-table').innerText()
  check('크레탑 주식가치: 표에 순자산 11,300 · 순손익가치 9,300 · 최저 한도 9,040', svTable.includes('11,300원') && svTable.includes('9,300원') && svTable.includes('9,040원') && svTable.includes('최저 한도'))
  check('크레탑 주식가치: 예전 간이식(손익3:자산2) 문구가 없다', !svTable.includes('손익3') && !(await page.locator('#mini-results').innerText()).includes('간이 계산'))
  await page.getByTestId('stock-value-cond-toggle').click()
  await page.waitForTimeout(200)
  await page.getByTestId('stock-value-cond').getByLabel('법인 구분').selectOption('특수법인')
  await page.waitForTimeout(200)
  check('크레탑 주식가치: 법인 구분을 특수법인으로 → 순자산 100% = 11,300원', (await page.getByTestId('stock-value-final').innerText()).includes('11,300'))
  await page.getByTestId('stock-value-cond').getByRole('button', { name: '원문 값으로 되돌리기' }).click()
  await page.waitForTimeout(200)
  check('크레탑 주식가치: 원문 값으로 되돌리면 다시 10,100원', (await page.getByTestId('stock-value-final').innerText()).includes('10,100'))
  const recoText = await miniTab('reco')
  check('크레탑 제안: 우선순위 추천과 미팅 질문', recoText.includes('추천 컨설팅 우선순위') && recoText.includes('선택하기'))
  await page.locator('#mini-results').getByRole('button', { name: /선택하기/ }).first().click()
  await page.waitForTimeout(300)
  const sumText = await miniTab('summary')
  check('크레탑 요약: 미팅 전 30초 브리핑 + 고른 제안 항목이 요약에 들어간다', sumText.includes('미팅 전 30초 브리핑') && !sumText.includes('아직 미팅에서 제안할 항목을 선택하지 않았습니다'))
  await page.getByTestId('cretop-mini-menu').click()
  await page.waitForTimeout(400)
  check('크레탑: 분석 이력에 남는다(모듈 기록)', (await page.getByTestId('cretop-mini-history').innerText()).includes('세방형'))
  await page.keyboard.press('Escape')

  // D-94: PDF 로 올려도 재무제표 연도가 '?' 없이 뜬다 (원본과 같은 pdf.js 4 계열로 글자를 뽑는다)
  await page.goto(BASE + '/tools/cretop', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByLabel('크레탑 보고서 파일').setInputFiles(new URL('./fixtures/cretop-sample.pdf', import.meta.url).pathname)
  // D-94: 추출이 끝나면 ‘재무진단 실행’ 을 누르지 않아도 바로 진단된다
  const autoRan = await page
    .waitForFunction(() => (document.querySelector('#mini-results')?.textContent ?? '').trim().length > 40, null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false)
  check('크레탑 PDF: 올리면 실행 단추 없이 바로 진단된다', autoRan)
  await page.waitForTimeout(600)
  const pdfDetail = await miniTab('detail')
  const qYears = (pdfDetail.match(/(^|\n)\?(\n|$)/g) || []).length
  check('크레탑 PDF: 재무 상세에 연도 ? 가 없다', qYears === 0 && pdfDetail.includes('2024년') && pdfDetail.includes('2022년'), `?=${qYears}`)
  check('크레탑 PDF: 제조원가·이익잉여금 표도 읽힌다', /제조원가/.test(pdfDetail) && /이익잉여금/.test(pdfDetail))
  await page.goto(BASE + '/tools', { waitUntil: 'networkidle' })

  // 정책자금
  await page.goto(BASE + '/tools/policy-funding/diagnosis?sample=1', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('정책자금: 샘플로 결론이 나온다', (await page.getByTestId('pf-conclusion').innerText()).includes('검토하는 것이'))
  check('정책자금: 추천 기관 3곳 (원본 결과 화면)', (await page.getByTestId('pf-agencies').locator('[data-agency-rank]').count()) === 3)

  // 고용지원금 · 연구소 — 열리고 제목이 맞는지 (세부는 각자의 단위 테스트가 지킨다)
  await page.goto(BASE + '/tools/employment', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check('고용지원금: 화면이 열린다 (원본 고용지원금 Pro 화면)', (await page.getByRole('heading', { level: 1 }).innerText()).includes('고용지원금') && (await page.getByTestId('emp-orig').count()) === 1)
  await page.goto(BASE + '/tools/labcare', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check('연구소: 화면이 열린다 (원본 대시보드 + 고객 운영 연결)', (await page.getByTestId('lab-module-eyebrow').innerText()).includes('연구소') && (await page.getByTestId('lab-orig').count()) === 1 && (await page.getByTestId('module-dashboard').count()) === 1)

  /* ---- D-91: 모듈 2단 목차 · 모듈 대시보드가 OS 업체를 본다 ---- */
  await page.goto(BASE + '/tools/employment', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const modNav = page.getByTestId('module-nav')
  check('모듈 목차: 넓은 화면에 모듈 목차가 선다', (await modNav.count()) === 1)
  check('모듈 목차: 고용지원금 10화면이 다 걸린다', (await modNav.locator('a[data-section]').count()) === 10, String(await modNav.locator('a[data-section]').count()))
  check('모듈 목차: 지금 보는 화면이 표시된다', (await modNav.locator('a[aria-current="page"]').getAttribute('data-section')) === 'dashboard')
  const dash = page.getByTestId('module-dashboard')
  check('모듈 대시보드: 첫 화면이 대시보드', (await dash.count()) === 1)
  const dashText = await dash.innerText()
  check('모듈 대시보드: OS 업체 수를 센다(모듈이 명단을 따로 갖지 않는다)', /업체[\s\S]{0,40}5곳/.test(dashText), dashText.slice(0, 200))
  check('모듈 대시보드: 서류가 빠진 업체를 이름으로 알려 준다', dashText.includes('4대보험 가입자 명부'), dashText.slice(0, 300))
  check('모듈 대시보드: 업체 이름이 실제 OS 업체다', dashText.includes('한솔테크'), dashText.slice(0, 300))

  // 목차에서 다른 화면으로 — 주소가 바뀌고 내용도 바뀐다
  await modNav.locator('a[data-section="wage"]').click()
  await page.waitForTimeout(600)
  check('모듈 목차: 누르면 그 화면 주소로 간다', page.url().includes('/tools/employment/wage'), page.url())
  check('모듈 목차: 급여 계산기 화면이 뜬다', (await page.locator('main').innerText()).includes('급여'))

  // 목차의 모든 화면이 진짜 화면이다 (자리만 잡아 둔 칸이 없다)
  await page.goto(BASE + '/tools/cretop/core-check', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.getByTestId('cretop-core-sample').click()
  await page.waitForTimeout(600)
  check('크레탑 핵심지표 검수: 샘플로 지표가 뜬다', (await page.getByTestId('cretop-core-rows').locator('li').count()) >= 3, String(await page.getByTestId('cretop-core-rows').locator('li').count()))
  await page.goto(BASE + '/tools/cretop/extractor', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.getByTestId('cretop-extract-sample').click()
  await page.waitForTimeout(600)
  check('크레탑 숫자 추출기: 샘플에서 줄을 뽑는다', (await page.getByTestId('cretop-extract-rows').locator('li').count()) >= 5, String(await page.getByTestId('cretop-extract-rows').locator('li').count()))
  check('크레탑 숫자 추출기: CSV 단추', (await page.getByTestId('cretop-extract-csv').count()) === 1)

  // 창업감면 결과서 — 판정 화면에서 적은 것으로 만들어진다
  await page.goto(BASE + '/tools/startup-tax/report', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const stReport = (await page.getByTestId('startup-report').count()) === 1
  check('창업감면 결과서: 판정이 있으면 결과서, 없으면 그렇게 말한다', stReport || (await page.getByTestId('startup-report-empty').count()) === 1)

  // 모르는 화면 키 → 첫 화면
  await page.goto(BASE + '/tools/employment/없는화면', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('모듈 목차: 모르는 주소는 첫 화면으로', (await page.getByTestId('module-dashboard').count()) === 1)

  /* ---- D-93: 고용지원금 — 원본 고용지원금 Pro 화면 그대로 · 업체는 고객 운영 업체에서 고른다 ---- */
  await page.goto(BASE + '/tools/employment/companies', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('고용지원금 업체 관리: 처음에는 업체를 고르라고 한다 (샘플 없음)', (await page.getByTestId('emp-empty').count()) === 1)
  await page.getByTestId('emp-add-company').click()
  await page.waitForTimeout(300)
  const empPickOpts = await page.getByTestId('emp-client-pick').locator('option').allInnerTexts()
  check('업체 추가: 고객 운영 업체 5곳에서 고른다', empPickOpts.length === 6 && empPickOpts.some((o) => o.includes('한솔테크')), empPickOpts.join(','))
  await page.getByTestId('emp-client-pick').selectOption('cli_hansol')
  await page.getByRole('button', { name: '업체 저장' }).click()
  await page.waitForTimeout(900)
  check('업체 추가: 그 업체 화면으로 (주소에 업체)', page.url().includes('/tools/employment/companies?cid=cli_hansol'), page.url())
  const empApp = page.getByTestId('emp-orig')
  check('업체 화면: 고객 운영 기록의 이름·사업자번호가 보인다', (await empApp.innerText()).includes('한솔테크') && (await empApp.innerText()).includes('123-45-67890'))
  check('업체 화면: 원본 버튼(고객 보고서·내부 보고서·수수료 정산)', (await empApp.getByRole('button', { name: /고객 보고서/ }).count()) >= 1 && (await empApp.getByRole('button', { name: /수수료 정산/ }).count()) >= 1)
  await empApp.getByRole('button', { name: /직원 \(0\)/ }).click()
  await page.waitForTimeout(300)
  await empApp.getByRole('button', { name: '+ 직원 추가' }).first().click()
  await page.waitForTimeout(400)
  const empModal = page.locator('#hr-orig-portal')
  await empModal.getByPlaceholder('홍길동').fill('김청년')
  await empModal.locator('input[type=date]').first().fill('2026-03-02')
  await empModal.getByRole('button', { name: '직원 저장' }).click()
  await page.waitForTimeout(900)
  const detailText = await empApp.innerText()
  check('직원 추가: 목록에 뜬다', detailText.includes('김청년'), detailText.slice(0, 160))
  check('직원 추가: 청년도약 회차표가 붙어 예상 잔여액 720만 원', detailText.includes('720만'), detailText.slice(0, 300))

  // D-99: 내려받는 고객 보고서(HTML)도 지금 테마색 — 새 창·파일에는 OS 색 변수가 없어 만드는 순간 16진수로 넣는다
  {
    const brand600 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-brand-600').trim().toLowerCase())
    await empApp.getByRole('button', { name: /고객 보고서/ }).first().click()
    await page.waitForTimeout(400)
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /HTML 저장/ }).click()])
    const { readFile } = await import('node:fs/promises')
    const html = (await readFile(await dl.path(), 'utf8')).toLowerCase()
    check('고객 보고서 HTML: 지금 테마 강조색이 들어 있다', brand600.startsWith('#') && html.includes(brand600), brand600)
    check('고객 보고서 HTML: 원본 파랑(#2563eb)이 남지 않았다', !html.includes('#2563eb'), String((html.match(/#2563eb/g) || []).length))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }

  // 진행 보드 — 같은 사람이 준비중 칸에
  await page.goto(BASE + '/tools/employment/board', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  check('진행 보드: 원본 보드에 그 사람이 선다', (await page.getByTestId('emp-orig').innerText()).includes('김청년'))

  // 다시 열어도 남아 있다 (모듈 기록에 저장)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  check('저장: 새로고침해도 직원이 남는다', (await page.getByTestId('emp-orig').innerText()).includes('김청년'))
  await page.goto(BASE + '/tools/employment/companies', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  check('저장: 업체 목록에 한솔테크가 남는다', (await page.getByTestId('emp-orig').innerText()).includes('한솔테크') && (await page.getByTestId('emp-empty').count()) === 0)

  // 대시보드 — 원본 '이번 달 업무 현황' + 고객 운영 연결
  await page.goto(BASE + '/tools/employment', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  check('대시보드: 원본 이번 달 업무 현황', (await page.getByTestId('emp-orig').innerText()).includes('이번 달 업무 현황'))
  check('대시보드: 고객 운영 업체와 연결 칸', (await page.getByTestId('module-dashboard').count()) === 1)

  // 원본 화면 안에서 화면을 옮기면 주소가 따라 바뀐다
  await page.getByTestId('emp-orig').getByRole('button', { name: /진행 보드 보기/ }).first().click()
  await page.waitForTimeout(700)
  check('원본 안 이동: 주소가 진행 보드로', page.url().includes('/tools/employment/board'), page.url())

  // 채용 진단 · 급여 계산기 · 시뮬레이터 · 지원금 관리 · 설정 — 원본 화면
  for (const [sec, word] of [['diagnosis', '채용 예정 진단'], ['wage', '급여'], ['simulator', '시뮬레이터'], ['programs', '청년일자리도약장려금'], ['settings', '전체 글자 크기']]) {
    await page.goto(BASE + '/tools/employment/' + sec, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    check(`원본 화면: ${sec}`, (await page.getByTestId('emp-orig').innerText()).includes(word), (await page.getByTestId('emp-orig').innerText()).slice(0, 120))
  }
  check('설정: 화면 잠금(PIN)은 없다', !(await page.getByTestId('emp-orig').innerText()).includes('화면 잠금'))
  // D-94: Ctrl+K 는 OS 전체 검색 하나만 연다 (원본 검색창이 같이 열리지 않는다)
  await page.goto(BASE + '/tools/employment', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(500)
  check('Ctrl+K: OS 검색만 뜬다', (await page.getByPlaceholder('업체 이름 · 대표 · 전화번호 뒷자리 · 도구').count()) === 1 && (await page.getByPlaceholder('업체명, 직원명, 지원금명으로 검색…').count()) === 0)
  await page.keyboard.press('Escape')

  /* ---- D-92: 연구소 — 원본 화면 그대로 · 고객사는 고객 운영 업체에서 고른다 ---- */
  await page.goto(BASE + '/tools/labcare/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  check('연구소 고객사: 원본 고객사 관리 화면이 선다', (await page.getByRole('heading', { level: 1 }).innerText()).includes('고객사 관리'))
  await page.getByTestId('lab-client-add').click()
  await page.waitForTimeout(300)
  const pickOpts = await page.getByTestId('lab-client-pick').locator('option').allInnerTexts()
  check('연구소 고객사: 고를 수 있는 업체는 고객 운영 업체 (5곳)', pickOpts.length === 6 && pickOpts.includes('한솔테크(주)'), pickOpts.join(','))
  await page.getByTestId('lab-client-pick').selectOption('cli_hansol')
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await page.waitForTimeout(900)
  check('연구소 고객사: 고른 업체가 목록에 선다', (await page.locator('[data-client="cli_hansol"]:visible').count()) === 1)
  await page.goto(BASE + '/tools/labcare/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  check('연구소 고객사: 새로고침해도 남는다 (모듈 기록)', (await page.locator('[data-client="cli_hansol"]:visible').count()) === 1)
  await page.locator('[data-client="cli_hansol"]:visible a').first().click()
  await page.waitForTimeout(900)
  check('연구소 고객사 상세: 원본 상세 화면이 ?cid= 로 열린다', page.url().includes('cid=cli_hansol') && (await page.getByRole('heading', { level: 1 }).innerText()).includes('한솔테크'), page.url())

  // 월간 점검 → 원본 리포트로 넘어가고, 업체 기록에 붙이는 단추가 그 업체로 잡혀 있다
  await page.goto(BASE + '/tools/labcare/check', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.getByTestId('lab-check-picker').getByText('한솔테크(주)').click()
  await page.waitForTimeout(900)
  await page.getByRole('button', { name: '점검 제출 및 위험도 저장' }).click()
  await page.waitForTimeout(1200)
  check('월간 점검: 제출하면 원본 월간 리포트로 간다', page.url().includes('/tools/labcare/reports') && (await page.getByRole('heading', { level: 1 }).innerText()).includes('월간 사후관리 리포트'), page.url())
  check('월간 리포트: 고객 운영 업체 기록에 붙일 수 있다', (await page.getByTestId('lab-os-attach').innerText()).includes('한솔테크'))

  // 변경사항 — 원본 30일 기한 + 업체 달력으로 보내는 단추
  await page.goto(BASE + '/tools/labcare/changes', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  check('변경사항: 원본 화면 (변경 확인 요청문 단추가 빨간색)', (await page.getByRole('button', { name: /변경 확인 요청문 만들기/ }).evaluate((el) => getComputedStyle(el).backgroundColor)) === 'rgb(220, 38, 38)')
  check('변경사항: 고른 업체 기한을 업체 기록으로 보낼 수 있다', (await page.getByTestId('lab-os-attach').count()) === 1)

  // 나머지 원본 화면이 모두 선다
  for (const [sec, title] of [['tasks', '오늘 할 일'], ['assessment', '설립 가능성'], ['setup-docs', '설립서류'], ['notes', '연구노트'], ['survey', '활동조사'], ['inspection', '현장조사'], ['reports', '고객 리포트'], ['resources', '안내문'], ['settings', '설정']]) {
    await page.goto(BASE + '/tools/labcare/' + sec, { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    check(`연구소 ${sec}: 원본 화면이 선다`, (await page.getByTestId('lab-orig').count()) === 1 && (await page.getByRole('heading', { level: 1 }).innerText()).includes(title), await page.getByRole('heading', { level: 1 }).innerText())
  }

  // 조직도·도면 — 원본 FloorPlanner
  await page.goto(BASE + '/tools/labcare/org-diagram', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('조직도: 도면 편집기가 선다 (원본 FloorPlanner)', (await page.getByTestId('lab-floorplanner').locator('svg').count()) >= 1)

  /* ---- D-92: 정책자금 — 원본 화면 · 고객은 고객 운영 업체 ---- */
  await page.goto(BASE + '/tools/policy-funding/diagnosis?client=cli_hansol&sample=1', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  check('정책자금 진단: 업체에서 열면 저장할 업체가 그 업체로 골라져 있다', (await page.getByTestId('pf-save-client').inputValue()) === 'cli_hansol')
  check('정책자금 진단: 결과를 업체 기록에 붙이는 단추', (await page.getByTestId('pf-attach').count()) === 1)
  await page.getByTestId('pf-save-consult').click()
  await page.waitForTimeout(900)
  await page.goto(BASE + '/tools/policy-funding/customers', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  const pfList = page.getByTestId('pf-customer-list')
  check('정책자금 상담: 원본 고객 관리 대시보드에 업체가 올라온다', (await pfList.innerText()).includes('한솔테크'), (await pfList.innerText()).slice(0, 160))
  check('정책자금 상담: 1순위 기관이 붙는다', /기술보증기금|중소벤처기업진흥공단|신용보증기금/.test(await pfList.innerText()), (await pfList.innerText()).slice(0, 200))
  await page.goto(BASE + '/tools/policy-funding/customers?cid=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  await page.locator('select[data-stage-for="cli_hansol"]').selectOption('서류 요청')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await page.waitForTimeout(900)
  await page.goto(BASE + '/tools/policy-funding/customers', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  check('정책자금 상담: 단계가 남는다 (모듈 기록)', (await page.getByTestId('pf-customer-list').innerText()).includes('서류 요청'))

  await page.goto(BASE + '/tools/policy-funding/report', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  check('정책자금 리포트: 고객을 고르는 칸이 선다', (await page.getByTestId('pf-report-picker').innerText()).includes('한솔테크'))
  await page.getByTestId('pf-report-picker').getByText('한솔테크(주)').click()
  await page.waitForTimeout(1000)
  check('정책자금 리포트: 저장한 진단으로 원본 리포트가 나온다', (await page.getByTestId('pf-report').count()) === 1 && (await page.getByTestId('pf-report').innerText()).includes('한솔테크'))
  check('정책자금 리포트: 필요 서류가 나온다', (await page.getByTestId('pf-report-docs').locator('li').count()) >= 5)

  await page.goto(BASE + '/tools/policy-funding', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('정책자금 대시보드: 상담 칸이 붙는다', (await page.getByTestId('pf-dashboard-extra').count()) === 1)

  /* ---- D-93: 영업 — 원본 영업 OS 화면 그대로 · 고객은 고객 운영 업체에서 고른다 ---- */
  for (const [sec, title] of [['briefing', '오늘의 브리핑'], ['prospecting', '신규 고객 등록·발굴'], ['companies', '고객사 관리'], ['followup', '다음 연락 관리'], ['meeting', '미팅 준비'], ['reports', '리포트/제안서'], ['packages', '컨설팅 상품'], ['pipeline', '영업 진행 현황'], ['analytics', '성과 분석'], ['content', '콘텐츠 전략'], ['education', '교육 아카이브'], ['strategies', '절세전략'], ['updates', '법령/공고'], ['settings', '설정']]) {
    await page.goto(BASE + '/tools/sales-kit/' + sec, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    check(`영업 ${sec}: 원본 화면이 선다`, (await page.getByTestId('sales-orig').count()) === 1 && (await page.getByRole('heading', { level: 1 }).innerText()).includes(title), await page.getByRole('heading', { level: 1 }).innerText())
  }
  await page.goto(BASE + '/tools/sales-kit/briefing', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: '+ 고객 등록' }).first().click()
  await page.waitForTimeout(400)
  const salesPick = await page.getByTestId('sales-client-pick').locator('option').allInnerTexts()
  check('영업 고객 등록: 업체는 고객 운영 업체에서 고른다 (5곳)', salesPick.length === 6 && salesPick.includes('한솔테크(주)'), salesPick.join(','))
  await page.getByTestId('sales-client-pick').selectOption('cli_hansol')
  await page.getByRole('button', { name: '고객 저장' }).click()
  await page.waitForTimeout(900)
  check('영업 고객 등록: 저장하면 신규 고객 발굴 화면으로', page.url().includes('/tools/sales-kit/prospecting') && (await page.getByTestId('sales-orig').innerText()).includes('한솔테크'), page.url())
  await page.goto(BASE + '/tools/sales-kit/briefing', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  // D-94: 샘플 고객이 없으니 브리핑 칸은 '고객' 하나 (예전 '실제 고객 · 샘플 고객')
  check('영업: 새로고침해도 남는다 (모듈 기록) · 브리핑 고객 1명', /고객\s*1\s*명/.test(await page.getByTestId('sales-orig').innerText()) && !(await page.getByTestId('sales-orig').innerText()).includes('샘플 고객'))
  check('영업 브리핑: 고객 운영 업체와 연결된 대시보드', (await page.getByTestId('module-dashboard').count()) === 1)
  await page.goto(BASE + '/tools/sales-kit/strategies', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /절세전략 시작하기/ }).click().catch(() => undefined)
  await page.waitForTimeout(400)
  check('영업 절세전략: 원본 전략 카드', (await page.getByTestId('sales-orig').innerText()).includes('가업승계'))

  /* ---- D-91 6단계: 모듈 잠금 (잠김 · 체험 · 열림) ---- */
  await page.goto(BASE + '/tools', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const accessList = page.getByTestId('module-access-list')
  check('모듈 잠금: 목차가 여러 칸인 모듈만 판다', (await accessList.locator('[data-module]').count()) >= 5, String(await accessList.locator('[data-module]').count()))
  await accessList.locator('[data-module="labcare"] button[data-act="lock"]').click()
  await page.waitForTimeout(700)
  check('모듈 잠금: 잠그면 잠김으로 바뀐다', (await accessList.locator('[data-module="labcare"]').innerText()).includes('잠김'), (await accessList.locator('[data-module="labcare"]').innerText()).slice(0, 80))

  await page.goto(BASE + '/tools/labcare', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('모듈 잠금: 잠겨도 첫 화면은 보인다', (await page.getByTestId('module-dashboard').count()) === 1)
  check('모듈 잠금: 잠겼다고 띠로 알려 준다', (await page.getByTestId('module-locked-banner').count()) === 1)

  await page.goto(BASE + '/tools/labcare/notes', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('모듈 잠금: 다른 화면은 승인 화면이 대신 선다', (await page.getByTestId('module-locked').count()) === 1)
  check('모듈 잠금: 결제가 없다고 적는다', (await page.getByTestId('module-locked').innerText()).includes('결제는 아직'), (await page.getByTestId('module-locked').innerText()).slice(0, 120))
  await page.getByTestId('module-trial').click()
  await page.waitForTimeout(900)
  check('모듈 잠금: 체험을 시작하면 화면이 열린다', (await page.getByTestId('lab-orig').count()) === 1)

  await page.goto(BASE + '/tools', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  check('모듈 잠금: 체험 남은 날을 적는다', /체험 \d+일 남음/.test(await page.getByTestId('module-access-list').locator('[data-module="labcare"]').innerText()), (await page.getByTestId('module-access-list').locator('[data-module="labcare"]').innerText()).slice(0, 80))
  await page.getByTestId('module-access-list').locator('[data-module="labcare"] button[data-act="open"]').click()
  await page.waitForTimeout(700)
  {
    // D-94: 열린 모듈에는 ‘체험’(열림 → 체험으로 내려감)·‘열기’(아무 일 없음) 단추가 없다
    const row = page.getByTestId('module-access-list').locator('[data-module="labcare"]')
    check('모듈 잠금: 열린 모듈에는 체험·열기 단추가 없고 모듈로 가기가 있다', (await row.locator('button[data-act="trial"], button[data-act="open"]').count()) === 0 && (await row.locator('[data-act="go"]').count()) === 1)
  }

  /* ---- D-89: 업체에서 도구 열기 → 결과·기한이 그 업체로 ---- */
  // 업체 상세에 '이 업체로 도구 열기' 줄이 있고, 거기서 연 도구에는 업체 띠가 뜬다
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('업체 상세: 이 업체로 도구 열기 줄', (await page.getByTestId('client-tools').locator('a[data-tool]').count()) >= 5)
  await page.getByTestId('client-tools').locator('a[data-tool="employment"]').click()
  await page.waitForTimeout(900)
  // D-94: 이미 고용지원금에 있는 업체면 그 업체 화면으로 바로 간다
  check('업체에서 연 도구: 주소에 업체가 붙고 그 업체 화면으로 간다', page.url().includes('client=cli_hansol') && page.url().includes('cid=cli_hansol'), page.url())
  const banner = page.getByTestId('tool-client-banner')
  check('업체에서 연 도구: 업체 띠가 뜬다', (await banner.count()) === 1 && (await banner.innerText()).includes('한솔테크'), (await banner.innerText().catch(() => '없음')).slice(0, 80))
  check('업체에서 연 도구: 업체로 돌아가는 길', (await banner.getByRole('link', { name: /업체로 돌아가기/ }).count()) === 1)

  // 회차 일정 → 한 번 눌러 붙이고, 기한이 달력에 뜨는지
  await page.goto(BASE + '/tools/employment/schedule?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByLabel('입사일').fill('2026-03-02')
  await page.waitForTimeout(400)
  const quick = page.getByTestId('tool-attach-quick').first()
  check('업체에서 연 도구: 고르는 단계 없이 그 업체로', (await quick.innerText()).includes('한솔테크'), await quick.innerText())
  await quick.click()
  await page.waitForTimeout(800)
  check('붙인 뒤: 보러 가기 링크', (await page.getByRole('link', { name: /한솔테크\(주\) 에 붙음/ }).count()) === 1)

  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const results = (await page.getByTestId('tool-results').innerText()) ?? ''
  check('업체 상세: 회차 일정 결과가 붙었다', results.includes('회차 일정'))
  check('업체 상세: 기한이 달력에 올라갔다고 알려 준다', /기한 \d+건이 달력에 있습니다/.test(results), results.slice(0, 160))
  await page.goto(BASE + '/ops/calendar', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const calText = (await page.locator('main').innerText()) ?? ''
  check('달력: 도구 기한 종류가 생겼다', calText.includes('도구 기한'), calText.slice(0, 200))

  /* ---- D-90: 업체별 도구 연동 · 없는 서류 표시 ---- */
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const toolsBox = page.getByTestId('client-tools')
  check('업체 상세: 도구별 카드로 보인다', (await toolsBox.locator('a[data-tool]').count()) >= 6)
  const missingBanner = page.getByTestId('client-tools-missing')
  check('업체 상세: 없는 서류를 이름으로 알려 준다', (await missingBanner.count()) === 1 && (await missingBanner.innerText()).includes('4대보험 가입자 명부'), (await missingBanner.innerText().catch(() => '없음')).slice(0, 120))
  check('업체 상세: 막힌 도구는 빨갛게 표시된다', (await toolsBox.locator('a[data-tool][data-ready="no"]').count()) >= 3)
  check('업체 상세: 세금 계산기는 서류 없이도 준비됨', (await toolsBox.locator('a[data-tool="tax"][data-ready="yes"]').count()) === 1)
  check('업체 상세: 고용지원금 카드에 무엇이 없는지 적혀 있다', (await toolsBox.locator('a[data-tool="employment"]').innerText()).includes('4대보험 가입자 명부'))

  // 서류함 탭 — 이 서류를 쓰는 도구
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=docs', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const docTools = page.getByTestId('doc-tools-payrollRoster')
  check('서류함: 4대보험 명부 칸에 쓰는 도구를 적는다', (await docTools.count()) === 1 && (await docTools.innerText()).includes('고용지원금'), (await docTools.innerText().catch(() => '없음')).slice(0, 80))

  // 업체 정보로 폼이 채워지는지 (창업감면) — 앞 단계에서 적어 둔 값은 비우고 본다
  await page.evaluate(() => localStorage.removeItem('axmvp.tools.startupTax'))
  await page.goto(BASE + '/tools/startup-tax?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const note = page.getByTestId('tool-prefill-note')
  check('창업감면: 업체 기록에서 채웠다고 알려 준다', (await note.count()) === 1 && (await note.innerText()).includes('업체 기록에서 채웠습니다'), (await note.innerText().catch(() => '없음')).slice(0, 120))
  const dateOf = (group) => page.getByRole('group', { name: group }).getAttribute('data-value')
  check('창업감면: 창업일이 설립일(2019-03-02)로 채워졌다', (await dateOf('③ 창업일')) === '2019-03-02', await dateOf('③ 창업일'))
  check('창업감면: 대표 생년월일도 채워졌다', (await dateOf('② 대표자 생년월일')) === '1978-05-10', await dateOf('② 대표자 생년월일'))
  check('창업감면: 법인번호가 있으니 법인사업자로', (await page.getByRole('button', { name: '법인사업자', exact: true }).getAttribute('aria-pressed')) === 'true')
  // 서류함에 파일이 없으면 크레탑이 그렇게 말한다
  await page.goto(BASE + '/tools/cretop?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('크레탑: 서류함에 보고서가 없으면 그렇게 말한다', (await page.getByTestId('cretop-docbox-missing').count()) === 1)

  // 세금 계산기도 같은 단추로 붙는다 (D-89)
  await page.goto(BASE + '/tools/tax?c=t6&client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const taxQuick = page.getByTestId('tool-attach-quick').first()
  check('세금 계산기: 업체를 물고 오면 붙이기 단추', (await taxQuick.count()) === 1 && (await taxQuick.innerText()).includes('한솔테크'), await taxQuick.innerText().catch(() => '없음'))
  await taxQuick.click()
  await page.waitForTimeout(800)
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  check('업체 상세: 세금 계산 결과도 붙는다', (await page.getByTestId('tool-results').innerText()).includes('퇴직'), (await page.getByTestId('tool-results').innerText()).slice(0, 120))

  // 전역 검색에서 도구 찾기 (이름이 아닌 말로)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(300)
  await page.getByPlaceholder(/검색/).fill('부채비율')
  await page.waitForTimeout(400)
  check('검색: 부채비율 → 크레탑 분석기', (await page.locator('body').innerText()).includes('크레탑 분석기'))
  await page.keyboard.press('Escape')

  // 도입 검토중
  await page.goto(BASE + '/tools/review', { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  check('도입 검토중: 검토중인 도구가 없다고 적힌다 (D-118)', (await page.locator('body').innerText()).includes('검토중인 도구가 없습니다'))

  check('1440: 화면 오류 0', errors.length === 0, errors.join(' | ').slice(0, 300))
  await ctx.close()
}

/* ---------------- 390 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  for (const p of ['/tools', '/tools/startup-tax', '/tools/cretop', '/tools/policy-funding/diagnosis?sample=1', '/tools/sales-kit/meeting', '/tools/sales-kit/briefing', '/tools/employment', '/tools/employment/roster', '/tools/labcare', '/tools/labcare/notes', '/tools/review', '/tools/cretop?client=cli_hansol']) {
    await page.goto(BASE + p, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    const w = await page.evaluate(() => document.documentElement.scrollWidth)
    check(`390 ${p}: 가로 넘침 없음`, w <= 390, `${w}px`)
  }
  // D-94: 크레탑 하단 탭이 화면에 붙어 따라오고, 맨 아래 내용을 가리지 않는다
  await page.goto(BASE + '/tools/cretop', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '텍스트 붙여넣기' }).click()
  await page.getByLabel('크레탑 원문').fill(SEBANG)
  await page.getByTestId('cretop-run').click()
  await page.waitForTimeout(900)
  await page.locator('[data-testid="cretop-mini-tabs"] button[data-tab="summary"]').click()
  await page.waitForTimeout(400)
  const tabsTopAtStart = await page.evaluate(() => document.querySelector('[data-testid="cretop-mini-tabs"]').getBoundingClientRect().top)
  check('390 크레탑: 하단 탭이 처음부터 화면 안에 보인다', tabsTopAtStart < 844, String(Math.round(tabsTopAtStart)))
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(300)
  const gap = await page.evaluate(() => { const t = document.querySelector('[data-testid="cretop-mini-tabs"]').getBoundingClientRect(); const r = document.querySelector('#mini-results'); const last = (r.lastElementChild || r).getBoundingClientRect(); return Math.round(t.top - last.bottom) })
  check('390 크레탑: 맨 아래까지 내리면 마지막 내용이 탭 위에 온전히 보인다', gap >= 0, `${gap}px`)
  await ctx.close()
}

/* D-109: 크레탑 주식가치 → 세금 계산기 09 로 같은 값 넘기기 · 휴대폰 계산기 펼쳐 고르기 */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/tools/cretop', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '텍스트 붙여넣기' }).click()
  await page.getByLabel('크레탑 원문').fill(SEBANG)
  await page.getByTestId('cretop-run').click()
  await page.waitForTimeout(800)
  await page.locator('[data-testid="cretop-mini-tabs"] button[data-tab="value"]').click()
  await page.waitForTimeout(300)
  await page.getByPlaceholder('예: 50,000').fill('200000')
  await page.waitForTimeout(200)
  await page.getByTestId('stock-value-open-tax').click()
  await page.waitForTimeout(800)
  check('주식가치 → 세금 계산기 09 로 간다', page.url().includes('/tools/tax?c=t3'), page.url())
  const taxOut = await page.locator('[data-block="v_out"]').innerText().catch(() => '')
  check('세금 계산기 09: 넘겨받은 값으로 같은 1주당 10,100원 · 20.2억', taxOut.includes('10,100원') && taxOut.includes('2,020,000,000원'), taxOut.replace(/\n/g, ' ').slice(0, 200))
  check('세금 계산기 09: 발행주식수 · 자산총계가 넘어왔다', (await page.locator('#v_shares').inputValue()) === '200,000' && (await page.locator('#v_asset').inputValue()) === '11,000,000,000')
  // 휴대폰: 9개를 옆으로 밀지 않고 펼쳐서 고른다
  const picker = page.getByTestId('tax-picker')
  check('390 세금 계산기: 칩 줄 대신 펼치기 단추', (await picker.isVisible()) && !(await page.locator('nav[aria-label="계산기 목록"]').isVisible()))
  check('390 세금 계산기: 지금 계산기 이름이 단추에', (await picker.innerText()).includes('비상장주식 가치평가'))
  await picker.click()
  await page.waitForTimeout(200)
  const items = page.locator('#tax-picker-list button')
  check('390 세금 계산기: 펼치면 9개가 한 번에', (await items.count()) === 9 && (await picker.getAttribute('aria-expanded')) === 'true')
  const listBox = await page.locator('#tax-picker-list').boundingBox()
  check('390 세금 계산기: 목록이 옆으로 넘치지 않음', !!listBox && listBox.width <= 390 && (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390)
  await items.filter({ hasText: '상속세' }).first().click()
  await page.waitForTimeout(400)
  check('390 세금 계산기: 고르면 그 계산기로 · 목록은 닫힘', page.url().includes('c=t2') || (await page.locator('h2').first().innerText()).includes('상속세'), page.url())
  check('390 세금 계산기: 고른 뒤 목록 닫힘', (await page.locator('#tax-picker-list').count()) === 0 && (await picker.innerText()).includes('상속세'))
  await ctx.close()
}

/* D-111: 크레탑 주식가치 — 고친 값은 회사별로 기억 · 업체 기록에 붙일 때 요약에 들어간다 · 계산기 목록 Esc/바깥 닫기 */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/tools/cretop?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: '텍스트 붙여넣기' }).click()
  await page.getByLabel('크레탑 원문').fill(SEBANG)
  await page.getByTestId('cretop-run').click()
  await page.waitForTimeout(800)
  const tab = async (k) => { await page.locator(`[data-testid="cretop-mini-tabs"] button[data-tab="${k}"]`).click(); await page.waitForTimeout(350) }
  await tab('value')
  await page.getByPlaceholder('예: 50,000').fill('200000')
  await page.getByTestId('stock-value-cond-toggle').click()
  await page.getByTestId('stock-value-cond').getByLabel('법인 구분').selectOption('특수법인')
  await page.waitForTimeout(300)
  await tab('reco')
  await tab('value')
  const kept = await page.getByTestId('stock-value-final').innerText()
  check('주식가치 기억: 다른 탭에 갔다 와도 발행주식수 · 법인 구분(특수 → 11,300원)이 남는다', kept.includes('11,300') && (await page.getByPlaceholder('예: 50,000').inputValue()) === '200000', kept.replace(/\n/g, ' '))
  const quick = page.getByTestId('tool-attach-quick').first()
  await quick.click()
  await page.waitForTimeout(400)
  // 예시 원문(세방형)과 업체(한솔테크)가 달라 '다른 회사 결과' 확인이 먼저 뜬다 — 그래도 붙인다
  const mismatch = page.getByRole('button', { name: '그래도 붙이기' })
  check('업체 기록 붙이기: 다른 회사 원문이면 한 번 더 묻는다', (await mismatch.count()) === 1)
  await mismatch.click()
  await page.waitForTimeout(900)
  const saved = await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]')
    const c = list.find((r) => r.id === 'cli_hansol')
    const t = (c?.toolResults ?? []).filter((x) => x.toolKey === 'cretop').pop()
    return t ? { summary: t.summary, sv: t.data?.stockValue ?? null } : null
  })
  check('업체 기록 붙이기: 요약에 예상 주식가치(1주당 11,300원 · 특수법인)가 들어간다', !!saved && saved.summary.includes('예상 주식가치') && saved.summary.includes('11,300원') && saved.summary.includes('특수법인'), (saved?.summary ?? '없음').slice(-240))
  check('업체 기록 붙이기: 데이터에도 1주당 · 기업가치 · 주식수', saved?.sv?.perShare === 11300 && saved?.sv?.total === 2260000000 && saved?.sv?.shares === 200000, JSON.stringify(saved?.sv))
  // 되돌리면 요약도 원문 값으로
  check('붙인 뒤: 펼쳐 둔 평가 조건 칸이 접히지 않는다', (await page.getByTestId('stock-value-cond').count()) === 1)
  await page.getByTestId('stock-value-cond').getByRole('button', { name: '원문 값으로 되돌리기' }).click()
  await page.waitForTimeout(300)
  check('되돌리기: 다시 10,100원', (await page.getByTestId('stock-value-final').innerText()).includes('10,100'))

  // D-112: 고친 평가 조건은 분석 이력(클라우드)에도 — 이 브라우저 기억을 지워도(다른 기기처럼) 다시 분석하면 돌아온다
  await page.getByTestId('stock-value-cond').getByLabel('법인 구분').selectOption('부동산과다보유법인')
  await page.waitForTimeout(1500)
  await page.evaluate(() => localStorage.removeItem('mini_stock_value_v1'))
  await page.goto(BASE + '/tools/cretop?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: '텍스트 붙여넣기' }).click()
  await page.getByLabel('크레탑 원문').fill(SEBANG)
  await page.getByTestId('cretop-run').click()
  await page.waitForTimeout(900)
  await tab('value')
  await page.waitForTimeout(400)
  const back = await page.getByTestId('stock-value-final').innerText()
  // 부동산과다 60:40 → 11,300 × 0.6 + 9,300 × 0.4 = 10,500원
  check('다른 기기처럼 지워도: 이력에서 발행주식수 · 법인 구분(부동산과다 10,500원)이 돌아온다', back.includes('10,500') && back.includes('부동산과다'), back.replace(/\n/g, ' '))
  await ctx.close()

  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const mp = await m.newPage()
  await mp.goto(BASE + '/tools/tax', { waitUntil: 'networkidle' })
  await mp.getByTestId('tax-picker').click()
  await mp.waitForTimeout(200)
  await mp.keyboard.press('Escape')
  await mp.waitForTimeout(200)
  check('390 세금 계산기: Esc 로 목록 닫힘', (await mp.locator('#tax-picker-list').count()) === 0)
  await mp.getByTestId('tax-picker').click()
  await mp.waitForTimeout(200)
  await mp.locator('h2').first().click()
  await mp.waitForTimeout(200)
  check('390 세금 계산기: 바깥을 누르면 목록 닫힘', (await mp.locator('#tax-picker-list').count()) === 0)
  await m.close()
}

/* D-113: 휴대폰 크레탑 — 입력 칸 접기 · 기본정보 2칸 · 핵심지표 3칸 · 인증 2칸 · 제목 한 줄 / 고용지원금 안내 접힘 / 영업 숫자 3칸 */
{
  const RICH = ['기업명 세방형(주)', '사업자번호 771-81-00284', '법인번호 131111-0435121', '대표자 이승욱', '종업원수 8명', '설립일 2016-01-15', '결산월 12월', '기업유형 일반법인', '기업규모 소기업', '주소 서울 강남구 논현로142길 23 (논현동)', '표준산업분류(10차) (J59113) 광고영화및비디오물제작업', '주요제품 영상물제작, 광고대행서비스', SEBANG].join('\n')
  const cols = (loc) => loc.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
  for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const mob = vp.width < 500
    const tag = mob ? '390' : '1440'
    const ctx = await browser.newContext({ viewport: vp, isMobile: mob, hasTouch: mob, locale: 'ko-KR' })
    const page = await ctx.newPage()
    await page.goto(BASE + '/tools/cretop', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '텍스트 붙여넣기' }).click()
    await page.getByLabel('크레탑 원문').fill(RICH)
    await page.getByTestId('cretop-run').click()
    await page.waitForTimeout(900)
    check(`${tag} 크레탑: 분석 뒤 입력 칸은 한 줄로 접힌다`, (await page.getByTestId('cretop-input-collapsed').count()) === 1 && (await page.getByLabel('크레탑 원문').count()) === 0)
    await page.getByTestId('cretop-input-collapsed').click()
    await page.waitForTimeout(200)
    check(`${tag} 크레탑: 누르면 다시 펼쳐 새로 분석할 수 있다`, (await page.getByTestId('cretop-run').count()) === 1)
    await page.getByRole('button', { name: /접기/ }).first().click()
    const core = await cols(page.getByTestId('cretop-core-grid'))
    const info = await cols(page.getByTestId('cretop-basic-info'))
    if (mob) {
      check('390 크레탑: 핵심지표 3칸', core === 3, String(core))
      check('390 크레탑: 기본정보 2칸 · 주소는 한 줄 다 씀', info === 2 && (await page.locator('[data-testid="cretop-basic-info"] [data-wide="1"]').first().evaluate((el) => getComputedStyle(el).gridColumnStart)) === '1', String(info))
      check('390 크레탑: 인증 칩 2칸', (await cols(page.getByTestId('cretop-cert-chips'))) === 2)
      const h2 = await page.locator('#mini-results h2').first().evaluate((el) => ({ h: el.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(el).fontSize) }))
      check('390 크레탑: 구역 제목이 두 줄로 쪼개지지 않는다', h2.h < h2.lh * 1.8, JSON.stringify(h2))
      const clipped = await page.locator('[data-core-card]').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.getAttribute('data-core-card')))
      check('390 크레탑: 지표 칸 글자가 칸 밖으로 넘치지 않는다', clipped.length === 0, clipped.join(','))
      check('390 크레탑: 가로 넘침 없음', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390)
    } else {
      check('1440 크레탑: 핵심지표는 넓게(4칸 이상)', core >= 4, String(core))
    }
    await page.locator('[data-testid="cretop-mini-tabs"] button[data-tab="summary"]').click()
    await page.waitForTimeout(400)
    const sumCore = await cols(page.getByTestId('cretop-core-grid'))
    check(`${tag} 크레탑 요약: 핵심지표 ${mob ? '3칸' : '여러 칸'}`, mob ? sumCore === 3 : sumCore >= 4, String(sumCore))

    await page.goto(BASE + '/tools/employment/companies', { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const guideOpen = (await page.getByRole('button', { name: /안내 접기/ }).count()) > 0
    check(`${tag} 고용지원금: 안내는 ${mob ? '접힌 한 줄로 시작' : '펼친 채로 시작'}`, mob ? !guideOpen && (await page.getByRole('button', { name: /안내 펼치기/ }).count()) > 0 : guideOpen)
    if (mob) {
      await page.getByRole('button', { name: /안내 펼치기/ }).first().click()
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForTimeout(400)
      check('390 고용지원금: 펼친 것을 기억한다(새로고침 뒤에도)', (await page.getByRole('button', { name: /안내 접기/ }).count()) > 0)
    }
    await page.goto(BASE + '/tools/sales-kit/pipeline', { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const sk = await cols(page.getByTestId('sales-kpi-grid'))
    check(`${tag} 영업 진행현황: 숫자 칸 ${mob ? '3' : '6'}칸`, sk === (mob ? 3 : 6), String(sk))
    await ctx.close()
  }
}

await browser.close()
console.log(`\n도구함(도구·붙이기·업체 연동·서류 부족·기한·검색): ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
