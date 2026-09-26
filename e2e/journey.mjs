/**
 * 영업 흐름 한몸 (D-119) — 브라우저 인수 시험.
 *
 *   node e2e/journey.mjs <baseUrl>
 *
 * 지키려는 것
 *   1. 크레탑 한 번으로 잠재고객 등록 — 기본 정보 · 영업 칸 · 도구 결과 · 크레탑 이력까지, 그리고 1차 미팅 준비로
 *   2. 같은 업체(사업자번호 · 이름)면 새로 만들지 않고 붙인다 · ?client= 로 들어오면 그 업체에
 *   3. 미팅 준비 — 영업 흐름 여섯 걸음(할 일 자동 체크 · 계약 경로) · 크레탑 전략(차수별 질문)
 *   4. 작업실 도구가 이 업체로 열리고, 잠긴 모듈은 '잠김' 으로 보인다
 *   5. 크레탑 분석기 — 결과 막대에서 영업으로 · 제안 탭은 접어 두되 지우지 않았다
 *   6. 고객 상세에도 영업 흐름 · 390 에서 옆으로 넘치지 않는다
 */

import fs from 'node:fs'
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const CRETOP = fs.readFileSync(new URL('./fixtures/cretop-company.txt', import.meta.url), 'utf8')
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) { pass++; console.log('PASS ', n) }
  else { fail++; console.log('FAIL ', n, d ?? '') }
}
const clients = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]'))
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const plusDays = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---- 1440 ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check('오늘: 영업 묶음에 + 크레탑으로 등록', (await page.getByTestId('today-cretop-intake').count()) === 1)

  await page.goto(BASE + '/sales/board', { waitUntil: 'networkidle' })
  await page.getByTestId('board-cretop-intake').click()
  await page.waitForURL(/\/sales\/new/)
  check('영업 보드: 크레탑으로 등록 → /sales/new', page.url().endsWith('/sales/new'))
  check('사이드바: 영업 관리에 불(새 목차 없음)', ((await page.locator('aside a[aria-current="page"]').innerText()) ?? '').includes('영업 관리'))
  const before = (await clients(page)).length

  // ① 넣기 → ② 확인
  await page.getByRole('button', { name: '글 붙여넣기' }).click()
  await page.getByLabel('크레탑 보고서 글').fill(CRETOP)
  await page.getByRole('button', { name: '분석' }).click()
  await page.getByTestId('intake-company').waitFor()
  const comp = await page.getByTestId('intake-company').innerText()
  check('확인: 회사 · 사업자번호 · 대표(나이) · 직원 · 설립일', comp.includes('한빛정밀(주)') && comp.includes('214-87-35291') && comp.includes('김한빛 · 64세') && comp.includes('23명') && comp.includes('2008-04-15'), comp.slice(0, 300))
  const ins = await page.getByTestId('intake-insight').innerText()
  check('확인: 먼저 볼 것 · 추천 컨설팅 · 관심사', ins.includes('현금성 자산') && ins.includes('정책자금') && ins.includes('가업승계') && ins.includes('1차 미팅 때 물어볼 주제'), ins.slice(0, 300))
  check('확인: 같은 업체가 없으면 붙이기 안내가 없다', (await page.getByTestId('intake-match').count()) === 0)

  // ③ 등록
  await page.getByLabel('유입 경로').selectOption('소개')
  await page.getByLabel('1차 미팅 날짜').fill(plusDays(3))
  await page.getByLabel('담당자').fill('이실장')
  await page.getByTestId('intake-save').click()
  await page.waitForURL(/\/sales\/meeting\?client=/)
  const id = new URL(page.url()).searchParams.get('client')
  check('등록 → 미팅 준비 1차로', page.url().includes('round=1') && !!id, page.url())
  const list = await clients(page)
  const rec = list.find((c) => c.id === id)
  check('등록: 업체 하나 늘었다', list.length === before + 1)
  check('등록: 기본 정보 채움(사업자번호 · 대표 · 업종 · 직원 · 설립 · 주소)', rec.businessNumber === '214-87-35291' && rec.representativeName === '김한빛' && rec.industry.includes('제조업') && rec.employeeCount === '23명' && rec.establishedAt === '2008-04-15' && rec.businessAddress.startsWith('경기'), JSON.stringify({ b: rec.businessNumber, r: rec.representativeName, e: rec.employeeCount }))
  check('등록: 영업 칸 — 1차 미팅 예정 · 소개 · 관심사 · 대표 나이 · 매출', rec.sales.stage === 'm1sched' && rec.sales.source === '소개' && rec.sales.interests.includes('정책자금') && rec.sales.ceoAge === 64 && rec.sales.revenueM === 6704, JSON.stringify(rec.sales).slice(0, 200))
  check('등록: 다음 할 일 = 1차 미팅 · 날짜 · 담당자', rec.nextAction === '1차 미팅' && rec.nextActionDueDate === plusDays(3) && rec.contactName === '이실장' && rec.status === 'waiting')
  check('등록: 도구 결과(크레탑 분석) — 순위 26 · 진단 요약', rec.toolResults[0]?.toolKey === 'cretop' && rec.toolResults[0].data.ranked.length === 26 && rec.toolResults[0].data.diagnosis.length > 0)
  const hist = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.module.cretop.analyses') ?? '[]'))
  check('등록: 크레탑 분석 이력에도 이 업체로', hist.some((h) => h.clientId === id && h.data.company === '한빛정밀(주)'), JSON.stringify(hist.map((h) => h.clientId)))

  // 미팅 준비 — 영업 흐름 (D-121: 한 줄로 접혀 있다 → 펼치기)
  const journey = page.getByTestId('sales-journey')
  await journey.waitFor()
  const fold = (await journey.innerText()) ?? ''
  check('영업 흐름: 한 줄로 접혀 있다 — 지금 걸음 · 다음 할 일', (await journey.getAttribute('data-folded')) === '1' && fold.includes('1/6 1차 미팅 준비') && fold.includes('다음 할 일'), fold.slice(0, 120))
  await page.getByTestId('journey-unfold').click()
  check('영업 흐름: 지금 1차 미팅 준비', ((await journey.locator('[data-journey-step="prep"]').getAttribute('data-state')) ?? '') === 'now')
  const prep = page.getByTestId('journey-open')
  check('영업 흐름: 크레탑 분석 · 1차 미팅 날짜 자동 체크', (await prep.locator('[data-journey-task="크레탑 분석"]').getAttribute('data-done')) === '1' && (await prep.locator('[data-journey-task="1차 미팅 날짜"]').getAttribute('data-done')) === '1')
  check('영업 흐름: 1차 미팅 체크리스트(AX) 자리 — 준비 중', ((await prep.locator('[data-journey-task="1차 미팅 체크리스트 (AX)"]').innerText()) ?? '').includes('준비 중'))
  await journey.locator('[data-journey-step="m1"]').click()
  const tools = page.getByTestId('journey-open').locator('[data-journey-tool]')
  const toolKeys = await tools.evaluateAll((els) => els.map((e) => e.getAttribute('data-journey-tool')))
  check('작업실 도구: 1차 미팅 걸음에 정책자금 진단 · 주식가치 · 세금 계산기', toolKeys.includes('policy-funding') && toolKeys.includes('cretop-value') && toolKeys.includes('tax'), toolKeys.join())
  const href = await page.getByTestId('journey-open').locator('[data-journey-tool="policy-funding"] a').getAttribute('href')
  check('작업실 도구: 이 업체로 열린다', href === `/tools/policy-funding/diagnosis?client=${id}`, href)
  check('작업실 도구: 크레탑 근거를 이유로', ((await page.getByTestId('journey-open').locator('[data-journey-tool="policy-funding"]').innerText()) ?? '').includes('크레탑 · 정책자금'))

  // D-124: 계약 경로는 2차 · 3차 미팅에서 정한다 — 1차 미팅 준비 때는 안 보인다
  check('계약 경로: 1차 미팅 준비 때는 안 보인다', (await page.getByTestId('sales-path').count()) === 0 && !((await journey.innerText()) ?? '').includes('계약 경로'))

  // 미팅 준비 1차 = 크레탑 분석기 그대로 (D-121) — 등록 때 넣은 분석으로 바로 열린다
  const mc = page.getByTestId('meeting-cretop')
  await mc.getByTestId('cretop-result-bar').waitFor()
  check('1차: 크레탑 분석기가 들어 있다 — 이 업체 분석으로 시작', ((await mc.innerText()) ?? '').includes('한빛정밀') && (await mc.getByTestId('cretop-mini-tabs').count()) === 1)
  check('1차: 결과 막대 — 1장 요약 · 이 업체에 반영', (await mc.getByTestId('meeting-cretop-apply').count()) === 1)
  // D-123: 크레탑 탭을 바꿔도 페이지 맨 위로 튀지 않는다(분석기 첫머리까지만)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(200)
  await mc.getByTestId('cretop-mini-tabs').locator('[data-tab="reco"]').click()
  await page.waitForTimeout(500)
  const yAfter = await page.evaluate(() => window.scrollY)
  const miniTop = await mc.getByTestId('cretop-mini').evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
  check('크레탑 탭 바꾸기: 맨 위로 튀지 않고 분석기 첫머리 근처', yAfter > 300 && yAfter <= miniTop + 5, `scrollY ${yAfter} · 분석기 ${Math.round(miniTop)}`)
  await mc.getByTestId('cretop-mini-tabs').locator('[data-tab="overview"]').click()
  await page.waitForTimeout(300)
  check('1차: 옛 전략 목록 · 흩어진 카톡은 없다(한 묶음으로 접힘)', (await page.getByTestId('cretop-meeting').count()) === 0 && (await page.getByTestId('meeting-kakao').count()) === 0 && (await page.getByRole('button', { name: /카톡 문구/ }).count()) === 1)
  await page.getByTestId('meeting-rounds').getByRole('button', { name: '2차 미팅' }).click()
  await page.waitForTimeout(300)
  const fu = page.getByTestId('cretop-followup')
  const fu2 = (await fu.innerText()) ?? ''
  check('2차: 이어서 물을 것 = 크레탑 전략의 D 제안 연결', (await fu.locator('[data-cretop-pick]').count()) >= 1 && fu2.includes('D 제안 연결') && !fu2.includes('A 오프닝'), fu2.slice(0, 200))
  check('2차: 제안서 · 견적으로 잇기', ((await page.getByTestId('meeting-proposal-link').getAttribute('href')) ?? '') === `/sales/proposal?client=${id}`)
  await page.getByTestId('meeting-rounds').getByRole('button', { name: '3차 클로징' }).click()
  await page.waitForTimeout(300)
  check('3차: 이어서 물을 것 = E 다음 액션', ((await page.getByTestId('cretop-followup').innerText()) ?? '').includes('E 다음 액션'))

  // 모듈 잠금 — 감추지 않고 잠김
  await page.evaluate(() => {
    const now = new Date().toISOString()
    localStorage.setItem('axmvp.module.system.access', JSON.stringify([{ id: 'acc1', clientId: '', data: { moduleKey: 'policy-funding', state: 'locked', trialEndsAt: '' }, createdAt: now, updatedAt: now }]))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('journey-unfold').click()
  await page.getByTestId('sales-journey').locator('[data-journey-step="m1"]').click()
  await page.waitForTimeout(300)
  const lockedRow = await page.getByTestId('journey-open').locator('[data-journey-tool="policy-funding"]').innerText()
  check('모듈 잠금: 잠긴 도구는 보이되 잠김', lockedRow.includes('잠김'), lockedRow)
  await page.evaluate(() => localStorage.removeItem('axmvp.module.system.access'))

  // 고객 상세
  await page.goto(`${BASE}/ops/clients/${id}`, { waitUntil: 'networkidle' })
  await page.getByTestId('sales-journey').waitFor()
  check('고객 상세: 영업 흐름 카드', ((await page.getByTestId('sales-journey').innerText()) ?? '').includes('1차 미팅 준비'))

  // 같은 업체 — 새로 만들지 않고 붙인다
  await page.goto(BASE + '/sales/new', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '글 붙여넣기' }).click()
  await page.getByLabel('크레탑 보고서 글').fill(CRETOP)
  await page.getByRole('button', { name: '분석' }).click()
  await page.getByTestId('intake-match').waitFor()
  check('같은 업체: 이미 있는 업체 안내 · 기본은 붙이기', ((await page.getByTestId('intake-match').innerText()) ?? '').includes('한빛정밀(주)') && (await page.getByRole('radio', { name: '이 업체에 붙이기' }).getAttribute('aria-checked')) === 'true')
  check('같은 업체: 이미 적힌 칸은 그대로라고 보인다', ((await page.getByTestId('intake-company').innerText()) ?? '').includes('이미 있음 · 그대로'))
  const n2 = (await clients(page)).length
  await page.getByTestId('intake-save').click()
  await page.waitForURL(/\/sales\/meeting\?client=/)
  check('같은 업체: 업체 수 그대로 · 같은 업체로', (await clients(page)).length === n2 && new URL(page.url()).searchParams.get('client') === id)
  check('같은 업체: 이미 1차 미팅 예정이면 단계 그대로', (await clients(page)).find((c) => c.id === id).sales.stage === 'm1sched')

  // PDF 로 넣기 — 이 브라우저 안에서 글로 읽어 분석
  await page.goto(BASE + '/sales/new', { waitUntil: 'networkidle' })
  await page.getByLabel('크레탑 보고서 올리기').setInputFiles(new URL('./fixtures/cretop-sample.pdf', import.meta.url).pathname)
  await page.getByTestId('intake-company').waitFor({ timeout: 30000 })
  check('PDF: 올리면 바로 분석 → 확인 화면', ((await page.getByTestId('intake-company').innerText()) ?? '').includes('테스트산업(주)'))

  // ?client= — 그 업체에 붙인다
  await page.goto(BASE + '/sales/new?client=cli_mirae', { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  check('?client=: 그 업체에 붙인다는 안내', ((await page.getByTestId('intake-target').innerText()) ?? '').includes('미래바이오랩'))

  // 크레탑 분석기 — 제안 탭 정리 · 영업으로
  await page.goto(BASE + '/tools/cretop/analyze', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '텍스트 붙여넣기' }).click()
  await page.getByLabel('크레탑 원문').fill(CRETOP)
  await page.getByTestId('cretop-run').click()
  await page.getByTestId('cretop-result-bar').waitFor()
  check('크레탑 분석기: 결과 막대에 영업으로(잠재고객 등록 · 미팅 준비)', ((await page.getByTestId('cretop-to-sales').innerText()) ?? '').includes('미팅 준비'))
  // 하단 탭으로(새로고침하면 방금 결과가 사라진다 — 원본 동작)
  await page.getByTestId('cretop-mini-tabs').locator('[data-tab="reco"]').click()
  await page.waitForTimeout(400)
  check('제안 탭: 추천 기준은 접혀 있다', (await page.getByTestId('cretop-reco-settings').count()) === 1)
  const folded = await page.getByTestId('cretop-tier-folded').count()
  check('제안 탭: 조건 확인 · 가능성 낮음 등급은 접혀 있다(지우지 않음)', folded >= 1, String(folded))
  const moreBtn = page.getByTestId('cretop-tier-more')
  const recBefore = await page.getByRole('button', { name: '상세 보기' }).count()
  check('제안 탭: 많은 등급은 앞 6개 + 더 보기', (await moreBtn.count()) === 1 && ((await moreBtn.innerText()) ?? '').includes('더 보기'))
  await moreBtn.click()
  check('제안 탭: 더 보기를 누르면 전부(지우지 않음)', (await page.getByRole('button', { name: '상세 보기' }).count()) > recBefore)
  await page.getByRole('button', { name: '상세 보기' }).first().click()
  const mini = page.getByTestId('cretop-mini')
  check('제안 탭: 상세는 추천 이유 · 추천 멘트 · 차수별 질문 먼저', ((await mini.innerText()) ?? '').includes('대표에게 던질 질문 흐름 · 차수별') && ((await mini.innerText()) ?? '').includes('오프닝 · 1차'))
  const hiddenBefore = await mini.getByText('핵심 확인사항', { exact: true }).count()
  await page.getByTestId('cretop-detail-more').first().click()
  const shownAfter = await mini.getByText('핵심 확인사항', { exact: true }).count()
  check('제안 탭: 핵심 확인사항 · 기대 효과는 더 보기 안에', hiddenBefore === 0 && shownAfter >= 1, `${hiddenBefore} → ${shownAfter}`)
  await page.getByTestId('cretop-mini-tabs').locator('[data-tab="overview"]').click()
  await page.getByTestId('cretop-result-bar').waitFor()
  const n3 = (await clients(page)).length
  await page.getByTestId('cretop-to-sales').click()
  await page.waitForURL(/\/sales\/meeting\?client=/)
  check('크레탑 분석기 → 영업: 같은 업체(한빛정밀)에 붙이고 미팅 준비로', new URL(page.url()).searchParams.get('client') === id && (await clients(page)).length === n3)

  // D-124: 관심사는 1차 미팅 기록에서 확인 → 그 뒤에 보인다 · 계약 경로는 2차 미팅부터
  await page.goto(`${BASE}/sales/meeting?client=${id}&round=1`, { waitUntil: 'networkidle' })
  const rec1 = page.getByTestId('meeting-recorder')
  await rec1.getByLabel('미팅에서 나온 말 · 메모').fill('가지급금 정리에 관심 있고 정책자금도 알아보고 싶다고 하심. 재무제표 보내 주기로 함')
  await rec1.getByRole('button', { name: '메모 나눠 보기' }).click()
  const mi = page.getByTestId('meeting-interests')
  const onChips = await mi.locator('button[aria-pressed="true"]').allInnerTexts()
  check('1차 기록: 관심사 확인 줄 — 미리 적은 주제(정책자금) · 메모에 나온 주제(가지급금)가 켜져 있다', onChips.some((t) => t.includes('정책자금')) && onChips.some((t) => t.includes('가지급금')), onChips.join())
  await mi.getByRole('button', { name: /가업승계/ }).click()
  const want = (await mi.locator('button[aria-pressed="true"]').allInnerTexts()).map((t) => t.trim())
  await rec1.getByRole('button', { name: '기록 저장' }).click()
  await page.waitForTimeout(700)
  const r1 = (await clients(page)).find((c) => c.id === id)
  check('1차 기록: 확인한 관심사만 남는다 · 1차 미팅 완료로', r1.sales.stage === 'm1done' && r1.sales.interests.length === want.length && want.every((w) => r1.sales.interests.includes(w)), JSON.stringify({ st: r1.sales.stage, i: r1.sales.interests, want }))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('journey-unfold').click()
  check('1차 미팅 완료: 계약 경로는 아직 안 보인다', (await page.getByTestId('sales-path').count()) === 0)
  await page.goto(`${BASE}/sales/meeting?client=${id}&round=2`, { waitUntil: 'networkidle' })
  const rec2 = page.getByTestId('meeting-recorder')
  await rec2.getByLabel('미팅에서 나온 말 · 메모').fill('제안서 보고 긍정적. 비용은 한 번에 내는 쪽이 좋다고 함')
  await rec2.getByRole('button', { name: '메모 나눠 보기' }).click()
  check('2차 기록: 관심사 확인 줄은 1차에만', (await page.getByTestId('meeting-interests').count()) === 0)
  await rec2.getByRole('button', { name: '기록 저장' }).click()
  await page.waitForTimeout(700)
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('journey-unfold').click()
  const journey2 = page.getByTestId('sales-journey')
  check('2차 미팅: 계약 경로가 보인다', (await page.getByTestId('sales-path').count()) === 1)
  await page.getByTestId('sales-path').getByRole('button', { name: '현금 계약' }).click()
  await page.waitForTimeout(400)
  check('계약 경로: 현금 → 3차 · 클로징은 건너뛸 수 있음', (await journey2.locator('[data-journey-step="closing"]').getAttribute('data-state')) === 'optional' && ((await journey2.innerText()) ?? '').includes('2차 미팅에서 계약'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('journey-unfold').click()
  check('계약 경로: 새로고침해도 남는다', (await page.getByTestId('sales-path').getByRole('button', { name: '현금 계약' }).getAttribute('aria-pressed')) === 'true')

  // (마지막에 — 다른 회사 번호가 붙으므로 앞의 '같은 업체' 시험과 섞이지 않게) 1차 탭에서 바로 분석 — 다른 회사 보고서면 저절로 붙이지 않고, '이 업체에 반영' 을 누르면 붙인다
  await page.goto(BASE + '/sales/meeting?client=cli_mirae&round=1', { waitUntil: 'networkidle' })
  const mc2 = page.getByTestId('meeting-cretop')
  check('1차: 크레탑이 없는 업체는 보고서 넣기부터', (await mc2.getByRole('button', { name: '텍스트 붙여넣기' }).count()) === 1)
  await mc2.getByRole('button', { name: '텍스트 붙여넣기' }).click()
  await mc2.getByLabel('크레탑 원문').fill(CRETOP)
  await mc2.getByTestId('cretop-run').click()
  await mc2.getByTestId('cretop-result-bar').waitFor()
  await page.waitForTimeout(600)
  const m0 = (await clients(page)).find((c) => c.id === 'cli_mirae')
  check('1차: 다른 회사 보고서는 저절로 붙이지 않는다', !m0.toolResults.some((t) => t.toolKey === 'cretop'), JSON.stringify(m0.toolResults.map((t) => t.toolKey)))
  await mc2.getByTestId('meeting-cretop-apply').click()
  await page.waitForTimeout(600)
  const m1 = (await clients(page)).find((c) => c.id === 'cli_mirae')
  check("1차: '이 업체에 반영' 을 누르면 붙는다", m1.toolResults.some((t) => t.toolKey === 'cretop' && t.data.ranked.length === 26))
  const h2 = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.module.cretop.analyses') ?? '[]'))
  check('1차: 분석 이력은 한 번만(작업대가 남김)', h2.filter((h) => h.data.company === '한빛정밀(주)').length === 1, String(h2.length))

  check('JS 오류 없음 (1440)', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---- 390 ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/sales/new', { waitUntil: 'networkidle' })
  check('390: 넣기 화면 넘침 0', (await overflowX(page)) <= 0)
  await page.getByRole('button', { name: '글 붙여넣기' }).click()
  await page.getByLabel('크레탑 보고서 글').fill(CRETOP)
  await page.getByRole('button', { name: '분석' }).click()
  await page.getByTestId('intake-company').waitFor()
  check('390: 확인 화면 넘침 0', (await overflowX(page)) <= 0, String(await overflowX(page)))
  await page.getByTestId('intake-save').click()
  await page.waitForURL(/\/sales\/meeting\?client=/)
  await page.getByTestId('sales-journey').waitFor()
  await page.getByTestId('meeting-cretop').getByTestId('cretop-result-bar').waitFor()
  check('390: 미팅 준비 1차(크레탑 분석기) 넘침 0', (await overflowX(page)) <= 0, String(await overflowX(page)))
  await page.getByTestId('meeting-rounds').getByRole('button', { name: '2차 미팅' }).click()
  await page.getByTestId('cretop-followup').waitFor()
  check('390: 미팅 준비 2차(이어서 물을 것) 넘침 0', (await overflowX(page)) <= 0, String(await overflowX(page)))
  check('JS 오류 없음 (390)', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(`\njourney: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
