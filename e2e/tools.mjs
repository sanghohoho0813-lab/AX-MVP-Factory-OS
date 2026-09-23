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
  check('도구함: 영업 도구 모음은 검토중 배지', (await page.locator('a[data-tool="sales-kit"]').innerText()).includes('검토중'))
  check('도구함: 기업인증 OS 는 누를 수 없다', (await page.locator('div[data-tool="cert-os"]').count()) === 1)
  check('사이드바: 도구함에 다섯 도구 + 도입 검토중', (await page.getByRole('navigation', { name: '주 메뉴' }).innerText()).includes('도입 검토중'))

  // 창업감면 판정기
  await page.goto(BASE + '/tools/startup-tax', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: '법인사업자', exact: true }).click()
  await page.getByLabel('② 대표자 생년월일').fill('1995-03-01')
  await page.getByLabel('③ 창업일').fill('2025-01-15')
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

  // 크레탑
  await page.goto(BASE + '/tools/cretop', { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  await page.getByLabel('크레탑 원문').fill(SEBANG)
  await page.getByTestId('cretop-run').click()
  await page.waitForTimeout(500)
  check('크레탑: 회사명을 읽는다', (await page.getByTestId('cretop-company').innerText()).includes('세방형'))
  const preview = page.getByTestId('cretop-preview')
  check('크레탑: 부채비율 874 · 유동비율 28.01', (await preview.locator('[data-k="debtRatio"]').innerText()).includes('874') && (await preview.locator('[data-k="currentRatio"]').innerText()).includes('28.01'))
  check('크레탑: 1차 미팅 포인트가 나온다', (await page.getByTestId('cretop-points').locator('li').count()) >= 3)

  // 정책자금
  await page.goto(BASE + '/tools/policy-funding/diagnosis?sample=1', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('정책자금: 샘플로 결론이 나온다', (await page.getByTestId('pf-conclusion').innerText()).includes('검토하는 것이'))
  check('정책자금: 추천 기관 3곳', (await page.getByTestId('pf-agencies').locator('span', { hasText: /^[123]순위 / }).count()) === 3)

  // 영업 도구
  await page.goto(BASE + '/tools/sales-kit/meeting', { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  await page.getByLabel('회사명').fill('한솔테크')
  await page.getByLabel('업종').selectOption('제조업')
  await page.getByLabel('대표 나이').fill('58')
  await page.getByLabel('업력').fill('18')
  await page.getByRole('button', { name: '가지급금 있음' }).click()
  await page.waitForTimeout(200)
  check('영업: 1차 미팅 대본이 가지급금 테마', (await page.getByTestId('sales-plan').innerText()).includes('가지급금'))
  await page.goto(BASE + '/tools/sales-kit/strategies', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check('영업: 대표 58세·업력 18년 → 가업승계 전략 1순위', (await page.getByTestId('sales-strategies').locator('> div').first().innerText()).includes('가업승계'))
  await page.goto(BASE + '/tools/sales-kit/packages', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check('영업: 가격표 40줄', (await page.getByTestId('sales-packages').locator('tbody tr').count()) === 40)
  await page.goto(BASE + '/tools/sales-kit/reports', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check('영업: 제안 주제 5분류', (await page.getByTestId('sales-weapons').locator('> div').count()) === 5)

  // 고용지원금 · 연구소 — 열리고 제목이 맞는지 (세부는 각자의 단위 테스트가 지킨다)
  await page.goto(BASE + '/tools/employment', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check('고용지원금: 화면이 열린다', (await page.getByRole('heading', { level: 1 }).innerText()).includes('고용지원금'))
  await page.goto(BASE + '/tools/labcare', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check('연구소: 화면이 열린다', (await page.getByRole('heading', { level: 1 }).innerText()).includes('연구소'))

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

  /* ---- D-91 2단계: 고용지원금 업체 관리 · 진행 보드 · 시뮬레이터 · 지원금 관리 ---- */
  await page.goto(BASE + '/tools/employment/companies', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const empCos = page.getByTestId('emp-companies')
  check('고용지원금 업체 관리: OS 업체가 그대로 선다', (await empCos.locator('button[data-client]').count()) === 5, String(await empCos.locator('button[data-client]').count()))

  await empCos.locator('button[data-client="cli_hansol"]').click()
  await page.waitForTimeout(500)
  check('업체 한 곳: 대상자 화면으로 들어간다', (await page.getByTestId('emp-company-detail').count()) === 1)
  await page.getByTestId('emp-add').click()
  await page.waitForTimeout(300)
  await page.getByLabel('이름').fill('김청년')
  await page.getByLabel('입사일').fill('2026-03-02')
  await page.getByTestId('emp-save').click()
  await page.waitForTimeout(800)
  const empList = page.getByTestId('emp-list')
  check('대상자 넣기: 목록에 뜬다', (await empList.innerText()).includes('김청년'), (await empList.innerText()).slice(0, 120))
  check('대상자 넣기: 지원금 회차표가 붙는다', (await page.getByTestId('emp-rounds').locator('button').count()) === 3, String(await page.getByTestId('emp-rounds').locator('button').count()))
  check('대상자 넣기: 회차 신청일은 입사일 + 개월', (await page.getByTestId('emp-rounds').innerText()).includes('2026.9.2'), (await page.getByTestId('emp-rounds').innerText()).slice(0, 120))

  // 회차 지급 체크 → 남은 예정액이 줄어든다
  const beforeRemain = await page.getByTestId('emp-company-detail').innerText()
  await page.getByTestId('emp-rounds').locator('button').first().click()
  await page.waitForTimeout(700)
  const afterRemain = await page.getByTestId('emp-company-detail').innerText()
  check('회차 받음 체크: 받은 돈이 늘고 남은 돈이 준다', beforeRemain !== afterRemain && afterRemain.includes('360만'), afterRemain.slice(0, 160))

  // 고객 보고서 — 대상자 현황이 글로 나온다
  const rep = await page.getByTestId('emp-report').innerText()
  check('고객 보고서: 업체·대상자·회차가 글로 나온다', rep.includes('한솔테크') && rep.includes('김청년') && rep.includes('1차'), rep.slice(0, 160))

  // 진행 보드 — 같은 대상자가 단계 칸에 선다
  await page.goto(BASE + '/tools/employment/board', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const board = page.getByTestId('emp-board')
  check('진행 보드: 7단계 칸', (await board.locator('[data-column]').count()) === 7, String(await board.locator('[data-column]').count()))
  check('진행 보드: 준비중 칸에 그 사람이 있다', (await board.locator('[data-column="preparing"]').innerText()).includes('김청년'))
  await board.locator('[data-column="preparing"]').getByLabel('김청년 단계 옮기기').selectOption('submitted')
  await page.waitForTimeout(800)
  check('진행 보드: 단계를 옮기면 그 칸으로 간다', (await board.locator('[data-column="submitted"]').innerText()).includes('김청년'), (await board.locator('[data-column="submitted"]').innerText()).slice(0, 80))

  // 대시보드에 이 모듈의 대상자 칸이 붙는다
  await page.goto(BASE + '/tools/employment', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const extra = page.getByTestId('emp-dashboard-extra')
  check('모듈 대시보드: 고용지원금 칸이 붙는다', (await extra.count()) === 1)
  check('모듈 대시보드: 대상자 수를 센다', (await extra.innerText()).includes('1명'), (await extra.innerText()).slice(0, 160))

  // 수령액 시뮬레이터
  await page.goto(BASE + '/tools/employment/simulator', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.getByLabel('채용 인원').fill('2')
  await page.getByLabel('입사일').fill('2026-03-02')
  await page.waitForTimeout(500)
  const sim = page.getByTestId('emp-simulator')
  check('시뮬레이터: 2명이면 1440만 원', (await sim.innerText()).includes('1,440만'), (await sim.innerText()).slice(0, 200))
  check('시뮬레이터: 월별로 나눠 보여 준다', (await page.getByTestId('emp-sim-months').locator('li').count()) === 3, String(await page.getByTestId('emp-sim-months').locator('li').count()))

  // 지원금 관리 — 끄면 고르는 칸에서 빠진다
  await page.goto(BASE + '/tools/employment/programs', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  check('지원금 관리: 기본 15종', (await page.getByTestId('emp-program-list').locator('li').count()) === 15, String(await page.getByTestId('emp-program-list').locator('li').count()))
  await page.locator('button[data-program="youth_jump"]').click()
  await page.waitForTimeout(700)
  check('지원금 관리: 끄면 안 쓴다로 바뀐다', (await page.locator('button[data-program="youth_jump"]').innerText()).includes('안 쓴다'))
  await page.goto(BASE + '/tools/employment/simulator', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const opts = await page.getByLabel('지원금 종류').locator('option').allInnerTexts()
  check('지원금 관리: 끈 지원금은 고르는 칸에서 빠진다', !opts.includes('청년일자리도약장려금'), opts.slice(0, 3).join(','))
  await page.goto(BASE + '/tools/employment/programs', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.locator('button[data-program="youth_jump"]').click()
  await page.waitForTimeout(600)

  /* ---- D-91 3단계: 연구소 고객사 · 오늘 할 일 · 연구노트 · 활동조사 · 현장조사 · 리포트 ---- */
  await page.goto(BASE + '/tools/labcare/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  check('연구소 고객사: OS 업체가 그대로 선다', (await page.getByTestId('lab-clients').locator('button[data-client]').count()) === 5)
  await page.getByTestId('lab-clients').locator('button[data-client="cli_hansol"]').click()
  await page.waitForTimeout(500)
  await page.getByLabel('연구소 이름').fill('한솔기술연구소')
  await page.getByLabel('인정일').fill('2024-05-02')
  await page.getByTestId('lab-researcher-add').click()
  await page.waitForTimeout(200)
  await page.getByLabel('1번째 연구원 이름').fill('박연구')
  await page.getByLabel('1번째 연구원 직책').fill('연구소장')
  check('연구소 고객사: 전담 1명이면 모자란다고 말한다', (await page.getByTestId('lab-researcher-warn').innerText()).includes('2명'), await page.getByTestId('lab-researcher-warn').innerText())
  await page.getByTestId('lab-info-save').click()
  await page.waitForTimeout(800)
  await page.goto(BASE + '/tools/labcare/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  check('연구소 고객사: 적은 것이 목록에 남는다', (await page.getByTestId('lab-clients').innerText()).includes('기업부설연구소'), (await page.getByTestId('lab-clients').innerText()).slice(0, 200))

  await page.goto(BASE + '/tools/labcare/tasks', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const labTasks = page.getByTestId('lab-task-list')
  check('연구소 오늘 할 일: 노트 없음이 맨 앞', (await labTasks.locator('li').first().innerText()).includes('연구노트'), (await labTasks.locator('li').first().innerText()).slice(0, 80))
  check('연구소 오늘 할 일: 활동조사도 잡힌다', (await labTasks.innerText()).includes('활동조사'))

  // 연구노트 — 과제 만들고 초안까지
  await page.goto(BASE + '/tools/labcare/notes?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.getByTestId('lab-project-add').click()
  await page.waitForTimeout(300)
  await page.getByLabel('과제명').fill('열처리 공정 개선')
  await page.getByLabel('제품 서비스').fill('자동차 부품 열처리')
  await page.getByTestId('lab-project-save').click()
  await page.waitForTimeout(800)
  await page.getByLabel('연구활동').fill('열처리 온도 구간을 세 단계로 나누어 시험하고 경도 변화를 측정했다')
  await page.getByLabel('관련성').fill('자동차 부품 열처리 공정의 불량률을 낮추기 위한 활동')
  await page.waitForTimeout(300)
  await page.getByTestId('lab-note-draft').click()
  await page.waitForTimeout(600)
  const noteText = await page.getByTestId('lab-note-text').innerText()
  check('연구노트: 초안이 만들어진다', noteText.includes('열처리 공정 개선') && noteText.includes('1. 이번 달 연구개발 활동'), noteText.slice(0, 120))
  await page.getByTestId('lab-note-audit').click()
  await page.waitForTimeout(500)
  check('연구노트: 실사 보완이 붙는다', (await page.getByTestId('lab-note-text').innerText()).includes('[실사 대응 보완]'))
  await page.getByTestId('lab-note-save').click()
  await page.waitForTimeout(800)
  check('연구노트: 저장하면 목록에 남는다', (await page.getByTestId('lab-note-list').innerText()).includes('한솔테크'), (await page.getByTestId('lab-note-list').innerText()).slice(0, 120))

  // 활동조사 — 제출 완료로 바꾸면 오늘 할 일에서 빠진다
  await page.goto(BASE + '/tools/labcare/survey', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  check('활동조사: 연구소 정보를 적은 업체만 나온다', (await page.getByTestId('lab-survey-list').locator('li').count()) === 1, String(await page.getByTestId('lab-survey-list').locator('li').count()))
  await page.locator('select[data-client="cli_hansol"]').selectOption('제출 완료')
  await page.waitForTimeout(800)
  await page.goto(BASE + '/tools/labcare/tasks', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('활동조사: 제출하면 오늘 할 일에서 빠진다', !(await page.getByTestId('lab-task-list').innerText()).includes('활동조사 미제출'), (await page.getByTestId('lab-task-list').innerText()).slice(0, 200))

  // 현장조사 — 체크가 업체별로 남는다
  await page.goto(BASE + '/tools/labcare/inspection?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  check('현장조사: 핵심 항목이 빠졌다고 알려 준다', (await page.getByTestId('lab-inspection-urgent').count()) === 1)
  await page.locator('input[data-item="namecard"]').check()
  await page.waitForTimeout(700)
  await page.goto(BASE + '/tools/labcare/inspection?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('현장조사: 체크가 그 업체에 남는다', await page.locator('input[data-item="namecard"]').isChecked())

  // 고객 리포트 — 이 모듈이 아는 것이 글로 모인다
  await page.goto(BASE + '/tools/labcare/reports?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const labReport = await page.getByTestId('lab-report-text').innerText()
  check('연구소 리포트: 업체·연구소·노트·현장조사가 한 장에', labReport.includes('한솔기술연구소') && labReport.includes('열처리 공정 개선') && labReport.includes('/12'), labReport.slice(0, 200))

  // 조직도 — 연구소 고객사에 적어 둔 사람이 그려진다
  await page.goto(BASE + '/tools/labcare/org-diagram?client=cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('조직도: 적어 둔 연구소장이 그려진다', (await page.getByTestId('lab-org').innerText()).includes('박연구'), (await page.getByTestId('lab-org').innerText()).slice(0, 200))
  check('조직도: 도면 편집기는 아직 없다고 적는다', (await page.getByTestId('lab-floorplan-note').count()) === 1)

  /* ---- D-91 4단계: 정책자금 상담 고객 관리 · 인쇄 리포트 ---- */
  await page.goto(BASE + '/tools/policy-funding/diagnosis?client=cli_hansol&sample=1', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.getByTestId('pf-save-consult').click()
  await page.waitForTimeout(900)
  await page.goto(BASE + '/tools/policy-funding/customers', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const pfList = page.getByTestId('pf-customer-list')
  check('정책자금 상담: 업체가 1차 상담 완료로 올라온다', (await pfList.innerText()).includes('한솔테크'), (await pfList.innerText()).slice(0, 160))
  check('정책자금 상담: 1순위 기관이 붙는다', /기술보증기금|중소벤처기업진흥공단|신용보증기금/.test(await pfList.innerText()), (await pfList.innerText()).slice(0, 200))
  await page.locator('select[data-stage-for="cli_hansol"]').selectOption('서류 요청')
  await page.waitForTimeout(700)
  await page.goto(BASE + '/tools/policy-funding/customers', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  check('정책자금 상담: 단계가 남는다', (await page.getByTestId('pf-customer-list').innerText()).includes('서류 요청'))

  await page.goto(BASE + '/tools/policy-funding/report', { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const pfReport = page.getByTestId('pf-report')
  check('정책자금 리포트: 저장한 진단으로 한 장이 나온다', (await pfReport.count()) === 1)
  check('정책자금 리포트: 추천 기관 3곳', (await page.getByTestId('pf-report-agencies').locator('> li').count()) === 3, String(await page.getByTestId('pf-report-agencies').locator('> li').count()))
  check('정책자금 리포트: 필요 서류가 나온다', (await page.getByTestId('pf-report-docs').locator('li').count()) >= 5)

  await page.goto(BASE + '/tools/policy-funding', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('정책자금 대시보드: 상담 칸이 붙는다', (await page.getByTestId('pf-dashboard-extra').count()) === 1)

  /* ---- D-91 5단계: 영업 발굴·고객사·다음 연락·파이프라인·성과·자료 ---- */
  await page.goto(BASE + '/tools/sales-kit/prospecting', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('영업 발굴: 아직 안 만난 업체가 선다', (await page.getByTestId('sales-prospect-list').locator('li').count()) === 5, String(await page.getByTestId('sales-prospect-list').locator('li').count()))
  await page.locator('button[data-start="cli_hansol"]').click()
  await page.waitForTimeout(900)
  check('영업 발굴: 시작하면 목록에서 빠진다', (await page.getByTestId('sales-prospect-list').locator('li').count()) === 4, String(await page.getByTestId('sales-prospect-list').locator('li').count()))

  await page.goto(BASE + '/tools/sales-kit/companies', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('영업 고객사: 첫 연락 단계로 뜬다', (await page.getByTestId('sales-company-list').innerText()).includes('첫 연락'), (await page.getByTestId('sales-company-list').innerText()).slice(0, 160))
  await page.locator('div[data-client="cli_hansol"] button').first().click()
  await page.waitForTimeout(400)
  await page.getByLabel('한솔테크(주) 예상 수수료').fill('3000000')
  await page.getByLabel('한솔테크(주) 다음 연락').fill('2026-09-01')
  await page.locator('body').click()
  await page.waitForTimeout(900)

  await page.goto(BASE + '/tools/sales-kit/followup', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('영업 다음 연락: 지난 연락으로 잡힌다', (await page.locator('[data-group="over"]').innerText()).includes('한솔테크'), (await page.locator('[data-group="over"]').innerText()).slice(0, 120))

  await page.goto(BASE + '/tools/sales-kit/pipeline', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const pipe = page.getByTestId('sales-pipeline')
  check('영업 보드: 6단계 + 보류 칸', (await pipe.locator('[data-column]').count()) === 7, String(await pipe.locator('[data-column]').count()))
  check('영업 보드: 잠재 고객 칸에 있다', (await pipe.locator('[data-column="lead"]').innerText()).includes('한솔테크'))
  check('영업 보드: 예상 수수료가 합쳐진다', (await pipe.innerText()).includes('300만'), (await pipe.innerText()).slice(0, 200))

  await page.goto(BASE + '/tools/sales-kit/analytics', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('영업 성과: 퍼널 6칸', (await page.getByTestId('sales-funnel').locator('li').count()) === 6)
  check('영업 성과: CSV 단추', (await page.getByTestId('sales-csv').count()) === 1)

  await page.goto(BASE + '/tools/sales-kit/content', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.locator('button[data-topic="고용지원금"]').click()
  await page.waitForTimeout(300)
  check('영업 콘텐츠: 주제를 고르면 제목이 바뀐다', (await page.getByTestId('sales-content-title').innerText()).includes('지원금'), await page.getByTestId('sales-content-title').innerText())
  await page.getByLabel('벤치마킹 문구').fill('무조건 해야 합니다')
  await page.waitForTimeout(300)
  check('영업 콘텐츠: 벤치마킹 제목 후보', (await page.getByTestId('sales-bench').innerText()).includes('먼저 확인해야 할'))

  await page.goto(BASE + '/tools/sales-kit/education', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.getByLabel('교육 제목').fill('가업승계 실무 교육')
  await page.getByTestId('sales-education-save').click()
  await page.waitForTimeout(800)
  check('영업 교육: 기록이 남는다', (await page.getByTestId('sales-education-list').innerText()).includes('가업승계 실무 교육'))

  await page.goto(BASE + '/tools/sales-kit/updates', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.getByLabel('공고 제목').fill('2026년 정책자금 공고')
  await page.getByLabel('주제').selectOption('정책자금')
  await page.getByTestId('sales-update-save').click()
  await page.waitForTimeout(800)
  check('영업 법령·공고: 기록과 연락 문구', (await page.getByTestId('sales-update-list').innerText()).includes('2026년 정책자금 공고') && (await page.getByTestId('sales-update-list').innerText()).includes('연락 문구'))

  await page.goto(BASE + '/tools/sales-kit', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('영업 브리핑: 영업 칸이 붙는다', (await page.getByTestId('sales-dashboard-extra').count()) === 1)

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
  check('모듈 잠금: 체험을 시작하면 화면이 열린다', (await page.getByTestId('lab-notes').count()) === 1)

  await page.goto(BASE + '/tools', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  check('모듈 잠금: 체험 남은 날을 적는다', /체험 \d+일 남음/.test(await page.getByTestId('module-access-list').locator('[data-module="labcare"]').innerText()), (await page.getByTestId('module-access-list').locator('[data-module="labcare"]').innerText()).slice(0, 80))
  await page.getByTestId('module-access-list').locator('[data-module="labcare"] button[data-act="open"]').click()
  await page.waitForTimeout(700)

  /* ---- D-89: 업체에서 도구 열기 → 결과·기한이 그 업체로 ---- */
  // 업체 상세에 '이 업체로 도구 열기' 줄이 있고, 거기서 연 도구에는 업체 띠가 뜬다
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('업체 상세: 이 업체로 도구 열기 줄', (await page.getByTestId('client-tools').locator('a[data-tool]').count()) >= 5)
  await page.getByTestId('client-tools').locator('a[data-tool="employment"]').click()
  await page.waitForTimeout(900)
  check('업체에서 연 도구: 주소에 업체가 붙는다', page.url().includes('/tools/employment?client=cli_hansol'), page.url())
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
  check('창업감면: 창업일이 설립일(2019-03-02)로 채워졌다', (await page.getByLabel('③ 창업일').inputValue()) === '2019-03-02', await page.getByLabel('③ 창업일').inputValue())
  check('창업감면: 대표 생년월일도 채워졌다', (await page.getByLabel('② 대표자 생년월일').inputValue()) === '1978-05-10', await page.getByLabel('② 대표자 생년월일').inputValue())
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
  check('도입 검토중: 영업 도구 모음과 이유', (await page.locator('body').innerText()).includes('왜 검토중인가'))

  check('1440: 화면 오류 0', errors.length === 0, errors.join(' | ').slice(0, 300))
  await ctx.close()
}

/* ---------------- 390 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  for (const p of ['/tools', '/tools/startup-tax', '/tools/cretop', '/tools/policy-funding/diagnosis?sample=1', '/tools/sales-kit/meeting', '/tools/employment', '/tools/employment/roster', '/tools/labcare', '/tools/labcare/notes', '/tools/review', '/tools/cretop?client=cli_hansol']) {
    await page.goto(BASE + p, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    const w = await page.evaluate(() => document.documentElement.scrollWidth)
    check(`390 ${p}: 가로 넘침 없음`, w <= 390, `${w}px`)
  }
  await ctx.close()
}

await browser.close()
console.log(`\n도구함(도구·붙이기·업체 연동·서류 부족·기한·검색): ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
