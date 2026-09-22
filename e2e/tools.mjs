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
  await page.getByRole('button', { name: '신규 창업', exact: true }).click()
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
  check('업체 상세: 활동 기록에도 남는다', (await page.locator('body').innerText()).includes('창업감면 판정 ·'))

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
  await page.goto(BASE + '/tools/policy-funding?sample=1', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('정책자금: 샘플로 결론이 나온다', (await page.getByTestId('pf-conclusion').innerText()).includes('검토하는 것이'))
  check('정책자금: 추천 기관 3곳', (await page.getByTestId('pf-agencies').locator('> div').count()) === 3)

  // 영업 도구
  await page.goto(BASE + '/tools/sales-kit', { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  await page.getByLabel('회사명').fill('한솔테크')
  await page.getByLabel('업종').selectOption('제조업')
  await page.getByLabel('대표 나이').fill('58')
  await page.getByLabel('업력').fill('18')
  await page.getByRole('button', { name: '가지급금 있음' }).click()
  await page.waitForTimeout(200)
  check('영업: 1차 미팅 대본이 가지급금 테마', (await page.getByTestId('sales-plan').innerText()).includes('가지급금'))
  await page.getByRole('tab', { name: '전략 추천' }).click()
  await page.waitForTimeout(200)
  check('영업: 대표 58세·업력 18년 → 가업승계 전략 1순위', (await page.getByTestId('sales-strategies').locator('> div').first().innerText()).includes('가업승계'))
  await page.getByRole('tab', { name: '상품 가격표' }).click()
  await page.waitForTimeout(200)
  check('영업: 가격표 40줄', (await page.getByTestId('sales-packages').locator('tbody tr').count()) === 40)
  await page.getByRole('tab', { name: /제안 주제/ }).click()
  await page.waitForTimeout(200)
  check('영업: 제안 주제 5분류', (await page.getByTestId('sales-weapons').locator('> div').count()) === 5)

  // 고용지원금 · 연구소 — 열리고 제목이 맞는지 (세부는 각자의 단위 테스트가 지킨다)
  await page.goto(BASE + '/tools/employment', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check('고용지원금: 화면이 열린다', (await page.getByRole('heading', { level: 1 }).innerText()).includes('고용지원금'))
  await page.goto(BASE + '/tools/labcare', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  check('연구소: 화면이 열린다', (await page.getByRole('heading', { level: 1 }).innerText()).includes('연구소'))

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
  for (const p of ['/tools', '/tools/startup-tax', '/tools/cretop', '/tools/policy-funding?sample=1', '/tools/sales-kit', '/tools/employment', '/tools/labcare', '/tools/review']) {
    await page.goto(BASE + p, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    const w = await page.evaluate(() => document.documentElement.scrollWidth)
    check(`390 ${p}: 가로 넘침 없음`, w <= 390, `${w}px`)
  }
  await ctx.close()
}

await browser.close()
console.log(`\n도구함 이식(여섯 도구·붙이기·검토중): ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
