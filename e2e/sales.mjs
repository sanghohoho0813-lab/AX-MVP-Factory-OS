/**
 * 영업 관리 (D-114) — 브라우저 인수 시험.
 *
 *   node e2e/sales.mjs <baseUrl>
 *
 * 지키려는 것
 *   1. 사이드바 영업 묶음은 '영업 관리' 한 줄만 늘었다 (영업 관리 · 영업자 정산 · 1차 미팅 체크리스트 자리)
 *   2. 영업 도구 모음에 쌓인 영업 기록이 한 번 옮겨 온다 (원본 줄은 그대로)
 *   3. 새 잠재고객 → '잠재 고객' 칸 · 고객 관리 '잠재고객' 에 보인다 · 메뉴 숫자(계약 고객)는 그대로
 *   4. '계약 완료' 로 옮기면 계약 고객이 되고 메뉴 숫자가 하나 는다
 *   5. 상담신청 → 새 고객사로 만들기 = 잠재고객(유입 '홈페이지 상담신청')
 *   6. 업체 상세 '영업' 칸 — 잠재고객이면 펼쳐져 있다
 *   7. 휴대폰 — 칸 고르기로 한 칸씩, 옆으로 넘치지 않는다
 *   8. 테마를 바꾸면 보드 강조색도 따라간다 (따로 칠한 색이 없다)
 */

import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) { pass++; console.log('PASS ', n) }
  else { fail++; console.log('FAIL ', n, d ?? '') }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/** 옛 영업 도구 모음 기록 — 한솔테크(계약 고객)는 제안 발송, 새로 넣는 계약 전 업체는 자료 요청 */
const legacyScript = () => {
  const k = 'axmvp.v1.operations_clients'
  const list = JSON.parse(localStorage.getItem(k) ?? '[]')
  const now = new Date().toISOString()
  list.push({ id: 'cli_legacy_lead', workspaceId: null, companyName: '옛영업상사', contactName: '정대표', status: 'waiting', createdAt: now, updatedAt: now })
  localStorage.setItem(k, JSON.stringify(list))
  localStorage.setItem('axmvp.module.sales-kit.accounts', JSON.stringify([
    { id: 'row1', clientId: 'cli_legacy_lead', data: { stage: 'docs_requested', dbSource: '소개', referrer: '박소개', interests: ['가지급금', '정관정비'], concern: '가지급금 정리', expectedFee: 600, memo: '옛 메모' }, createdAt: now, updatedAt: now },
  ]))
}

const clientsBadge = async (page) => ((await page.locator('aside [data-nav-badge="clients"]').innerText().catch(() => '')) ?? '').trim()

/* ---- 1440 ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(legacyScript)
  await page.goto(BASE + '/sales', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)

  check('주소: /sales → /sales/board', page.url().endsWith('/sales/board'), page.url())
  const salesGroup = await page.locator('aside nav').innerText()
  const i1 = salesGroup.indexOf('영업 관리')
  const i2 = salesGroup.indexOf('영업자 정산')
  const i3 = salesGroup.indexOf('1차 미팅 체크리스트')
  check('사이드바: 영업 묶음 = 영업 관리 · 영업자 정산 · 1차 미팅 체크리스트', i1 > 0 && i1 < i2 && i2 < i3, `${i1} ${i2} ${i3}`)
  check('사이드바: 영업 관리에 불이 켜진다', ((await page.locator('aside a[aria-current="page"]').innerText()) ?? '').includes('영업 관리'))
  check('사이드바: 영업 보드 · 미팅 준비 같은 줄을 따로 만들지 않았다', !salesGroup.includes('영업 보드') && !salesGroup.includes('미팅 준비'))

  // 옛 기록 옮기기
  const board = page.getByTestId('sales-board')
  const m1done = board.locator('[data-sales-col="m1done"]')
  check('옮기기: 옛 기록이 1차 미팅 완료 칸에 (자료 요청 → 1차 미팅 완료)', ((await m1done.innerText()) ?? '').includes('옛영업상사'), await m1done.innerText())
  check('옮기기: 유입 · 소개자 · 관심사 · 수임료가 카드에', /소개/.test(await m1done.innerText()) && (await m1done.innerText()).includes('박소개') && (await m1done.innerText()).includes('가지급금') && (await m1done.innerText()).includes('600만'), await m1done.innerText())
  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.module.sales-kit.accounts') ?? '[]').length)
  check('옮기기: 원본 줄은 그대로', rows === 1)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const dupCount = await page.getByTestId('sales-board').getByText('옛영업상사').count()
  check('옮기기: 새로고침해도 한 번만 (두 번 옮기지 않는다)', dupCount === 1, String(dupCount))
  const act = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients')).find((c) => c.id === 'cli_legacy_lead').activity.filter((a) => a.text.includes('영업 도구 모음 기록 옮김')).length)
  check('옮기기: 활동 기록도 한 줄만', act === 1, String(act))

  // 계약 고객은 계약 완료 칸
  check('보드: 영업 칸 없던 계약 고객은 계약 완료 칸', ((await board.locator('[data-sales-col="contracted"]').innerText()) ?? '').includes('한솔테크'))
  check('보드: 여섯 칸 + 보류 · 이탈', (await page.locator('[data-sales-col]').count()) >= 8)

  // 새 잠재고객
  const before = await clientsBadge(page)
  await page.getByRole('button', { name: /새 잠재고객/ }).click()
  const dlg = page.getByRole('dialog', { name: '새 잠재고객' })
  await dlg.getByLabel('회사명 *').fill('보드시험테크')
  await dlg.getByLabel('대표자·담당자').fill('한시험')
  await dlg.getByLabel('유입 경로').selectOption('소개')
  await dlg.getByLabel('예상 수임료 (만원)').fill('300')
  await dlg.getByRole('button', { name: '절세' }).click()
  await dlg.getByRole('button', { name: '잠재고객 등록' }).click()
  await page.waitForTimeout(700)
  const leadCol = board.locator('[data-sales-col="lead"]')
  check('새 잠재고객: 잠재 고객 칸에 뜬다', ((await leadCol.innerText()) ?? '').includes('보드시험테크'), await leadCol.innerText())
  check('새 잠재고객: 메뉴 숫자(계약 고객)는 그대로', (await clientsBadge(page)) === before, `${before} → ${await clientsBadge(page)}`)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients')).find((c) => c.companyName === '보드시험테크'))
  check('새 잠재고객: 계약 전 · 영업 칸 · 수임료 원 단위', stored?.status === 'waiting' && stored?.sales?.stage === 'lead' && stored.sales.expectedFee === 3_000_000 && stored.sales.interests.includes('절세'), JSON.stringify(stored?.sales))

  // 고객 관리 — 잠재고객 보기
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: /^고객 관리/ }).click()
  await page.waitForTimeout(600)
  const seg = page.getByTestId('client-segment')
  check('고객 관리: 계약 고객 · 잠재고객 · 전체', ((await seg.innerText()) ?? '').replace(/\s+/g, ' ').includes('계약 고객') && (await seg.innerText()).includes('잠재고객'))
  await seg.getByRole('button', { name: /잠재고객/ }).click()
  await page.waitForTimeout(300)
  const mainText = (await page.locator('main').innerText()) ?? ''
  check('고객 관리: 잠재고객 보기에 새 업체 · 옛 업체 · 단계 표시', mainText.includes('보드시험테크') && mainText.includes('옛영업상사') && mainText.includes('잠재 · 잠재 고객') && !mainText.includes('한솔테크'), mainText.slice(0, 400))
  await seg.getByRole('button', { name: /계약 고객/ }).click()
  await page.waitForTimeout(300)
  const contractText = (await page.locator('main').innerText()) ?? ''
  const contractNum = Number(((await seg.getByRole('button', { name: /계약 고객/ }).innerText()) ?? '').replace(/\D/g, ''))
  check('고객 관리: 계약 고객 보기 = 메뉴 숫자', contractNum === Number(await clientsBadge(page)) && !contractText.includes('보드시험테크'), `${contractNum} vs ${await clientsBadge(page)}`)
  await seg.getByRole('button', { name: /전체/ }).click()

  // 업체 상세 — 영업 칸 (잠재고객은 펼쳐져 있다)
  await page.goto(BASE + `/ops/clients/${stored.id}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const card = page.getByTestId('client-sales-card')
  check('업체 상세: 영업 칸이 펼쳐져 있다(잠재고객)', await card.getByLabel('영업 단계').isVisible())
  await card.getByLabel('소개한 사람').fill('김소개')
  await card.getByRole('button', { name: '영업 정보 저장' }).click()
  await page.waitForTimeout(500)
  const saved = await page.evaluate((id) => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients')).find((c) => c.id === id), stored.id)
  check('업체 상세: 영업 정보 저장', saved.sales.referrer === '김소개' && saved.activity[0].text.includes('소개자'), JSON.stringify(saved.sales))
  await card.getByLabel('영업 단계').selectOption('m1sched')
  await page.waitForTimeout(500)
  const s2 = await page.evaluate((id) => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients')).find((c) => c.id === id), stored.id)
  check('업체 상세: 단계 옮김 → 이력', s2.sales.stage === 'm1sched' && s2.sales.history.length === 2)

  // 보드에서 계약 완료로
  await page.goto(BASE + '/sales/board', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const before2 = Number(await clientsBadge(page))
  await page.getByTestId('sales-board').getByLabel('보드시험테크 영업 단계').selectOption('contracted')
  await page.waitForTimeout(900)
  const s3 = await page.evaluate((id) => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients')).find((c) => c.id === id), stored.id)
  check('계약 완료: 계약함(진행 중) · 계약일 채움', s3.status === 'active' && /^\d{4}-\d{2}-\d{2}$/.test(s3.contract.signedAt), JSON.stringify({ st: s3.status, c: s3.contract.signedAt }))
  check('계약 완료: 계약 완료 칸으로', ((await page.getByTestId('sales-board').locator('[data-sales-col="contracted"]').innerText()) ?? '').includes('보드시험테크'))
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: /^일정/ }).click()
  await page.waitForTimeout(700)
  check('계약 완료: 메뉴 숫자(계약 고객)가 하나 는다', Number(await clientsBadge(page)) === before2 + 1, `${before2} → ${await clientsBadge(page)}`)

  // 상담신청 → 새 고객사 = 잠재고객
  await page.goto(BASE + '/ops/inbox', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const ev = page.locator('article', { hasText: '새길바이오' }).first()
  await ev.getByRole('button', { name: /새 고객사로 만들기/ }).click()
  await page.waitForTimeout(300)
  const linkDlg = page.getByRole('dialog')
  check('상담신청: 잠재고객으로 등록된다는 안내', ((await linkDlg.innerText()) ?? '').includes('잠재고객'))
  await linkDlg.getByRole('button', { name: '만들고 연결' }).click()
  await page.waitForTimeout(900)
  const fromInbox = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients')).find((c) => c.companyName === '새길바이오'))
  check('상담신청: 새 고객사 = 계약 전 · 잠재 고객 · 유입 홈페이지 상담신청', fromInbox?.status === 'waiting' && fromInbox?.sales?.stage === 'lead' && fromInbox.sales.source === '홈페이지 상담신청', JSON.stringify({ st: fromInbox?.status, s: fromInbox?.sales }))

  // 테마 — 보드의 강조색(고른 칸 · 버튼)은 테마 brand 색을 따른다
  await page.goto(BASE + '/sales/board', { waitUntil: 'networkidle' })
  const btnColor = async () => page.getByRole('button', { name: /새 잠재고객/ }).evaluate((el) => getComputedStyle(el).backgroundColor)
  const c1 = await btnColor()
  const cur = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), cur === 'forest-sage' ? 'burgundy' : 'forest-sage')
  await page.waitForTimeout(250)
  const c2 = await btnColor()
  check('테마: 테마를 바꾸면 보드 버튼 색도 바뀐다', c1 !== c2, `${c1} → ${c2}`)

  check('JS 오류 없음 (1440)', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---- 390 휴대폰 ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(legacyScript)
  await page.goto(BASE + '/sales/board', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const picker = page.getByTestId('sales-stage-picker')
  check('휴대폰: 칸 고르기 8개', (await picker.getByRole('button').count()) === 8)
  await picker.getByRole('button', { name: /1차 미팅 완료/ }).click()
  await page.waitForTimeout(200)
  check('휴대폰: 고른 칸의 업체만', ((await page.locator('main').innerText()) ?? '').includes('옛영업상사'))
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('휴대폰: 옆으로 넘치지 않는다', overflow <= 1, String(overflow))
  const eyebrow = ((await page.locator('header').innerText()) ?? '').replace(/\s+/g, ' ')
  check('휴대폰: 머리줄 영업 › 영업 관리', eyebrow.includes('영업') && eyebrow.includes('영업 관리'), eyebrow.slice(0, 120))
  check('JS 오류 없음 (390)', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---- D-114 2단계: 미팅 준비 (1440) ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(() => {
    const k = 'axmvp.v1.operations_clients'
    const list = JSON.parse(localStorage.getItem(k) ?? '[]')
    const now = new Date().toISOString()
    list.push({ id: 'cli_meet', workspaceId: null, companyName: '미팅정밀', contactName: '김대표', industry: '금속 제조', employeeCount: '26', establishedAt: '2008-03-02', status: 'waiting', createdAt: now, updatedAt: now,
      sales: { stage: 'm1sched', source: '소개', referrer: '', interests: ['가업승계'], concern: '장남 승계', expectedFee: null, history: [{ at: now, from: null, to: 'm1sched' }], movedAt: now, ceoAge: 58, revenueM: 3500 } })
    localStorage.setItem(k, JSON.stringify(list))
  })
  await page.goto(BASE + '/sales/board', { waitUntil: 'networkidle' })
  const tabs = page.getByTestId('sales-tabs')
  check('미팅 준비: 영업 관리 안의 탭 — 영업 보드 · 미팅 준비', ((await tabs.innerText()) ?? '').includes('영업 보드') && (await tabs.innerText()).includes('미팅 준비'))
  await page.getByTestId('sales-board').getByRole('link', { name: '미팅정밀 미팅 준비' }).click()
  await page.waitForTimeout(600)
  check('미팅 준비: 보드 카드에서 그 고객으로 열린다', page.url().includes('/sales/meeting?client=cli_meet') && (await page.getByLabel('미팅 준비할 고객').inputValue()) === 'cli_meet', page.url())
  check('미팅 준비: 사이드바는 그대로 영업 관리 (탭은 목차에 없다)', ((await page.locator('aside a[aria-current="page"]').innerText()) ?? '').includes('영업 관리') && !((await page.locator('aside nav').innerText()) ?? '').includes('미팅 준비'))
  const score1 = Number(((await page.getByTestId('lead-score').innerText()) ?? '').replace(/\D/g, ''))
  check('미팅 준비: 리드 점수 20~88', score1 >= 20 && score1 <= 88, String(score1))
  const main1 = (await page.locator('main').innerText()) ?? ''
  check('미팅 준비: 전략 TOP3 — 가업승계 먼저', main1.includes('먼저 볼 전략 TOP3') && main1.indexOf('가업승계') > 0)
  check('미팅 준비: 1차 미팅 예정 → 1차 대본이 먼저 (질문 · 오프닝 · 요청 자료)', ((await page.getByTestId('meeting-rounds').getByRole('button', { name: '1차 미팅' }).getAttribute('aria-pressed')) === 'true') && main1.includes('오프닝') && /질문 \d+개/.test(main1) && main1.includes('미팅정밀'))
  for (const [name, word] of [['첫 연락', '전화 대본'], ['2차 미팅', '핵심 이슈 TOP3'], ['3차 클로징', '가격 이야기']]) {
    await page.getByTestId('meeting-rounds').getByRole('button', { name }).click()
    await page.waitForTimeout(150)
    check(`미팅 준비: ${name} 대본`, ((await page.getByTestId('meeting-plan').innerText()) ?? '').includes(word))
  }
  // 고객 정보 고치면 점수가 바뀐다
  await page.getByRole('button', { name: /고객 정보 — 점수 · 대본 재료/ }).click()
  await page.getByRole('button', { name: '가지급금 있음' }).click()
  await page.getByRole('button', { name: '고객 정보 저장' }).click()
  await page.waitForTimeout(500)
  const score2 = Number(((await page.getByTestId('lead-score').innerText()) ?? '').replace(/\D/g, ''))
  check('미팅 준비: 체크를 켜고 저장하면 점수가 오른다', score2 > score1, `${score1} → ${score2}`)
  // 미팅 기록 — 1차
  await page.getByTestId('meeting-rounds').getByRole('button', { name: '1차 미팅' }).click()
  const rec = page.getByTestId('meeting-recorder')
  await rec.getByLabel('미팅에서 나온 말 · 메모').fill('가지급금 정리는 관심 있는데 비용이 부담되고 세무사랑 상의해볼게요')
  await rec.getByRole('button', { name: '메모 나눠 보기' }).click()
  const an = (await page.getByTestId('meeting-analysis').innerText()) ?? ''
  check('미팅 기록: 반응 · 망설임 · 주제를 나눈다', an.includes('신중·부담 반응 추정') && an.includes('비용/수임료 부담') && an.includes('가지급금'), an.slice(0, 200))
  await rec.getByRole('button', { name: '기록 저장' }).click()
  await page.waitForTimeout(700)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients')).find((c) => c.id === 'cli_meet'))
  check('미팅 기록: 저장 — 미팅 목록 · 1차 미팅 완료로 · 다음 할 일 · 체크 유지', saved.sales.meetings?.length === 1 && saved.sales.stage === 'm1done' && saved.nextAction.startsWith('2차 미팅 준비') && saved.sales.flags?.gajigeup === true, JSON.stringify({ st: saved.sales.stage, n: saved.nextAction }))
  check('미팅 기록: 저장 뒤 2차 대본으로 넘어간다', ((await page.getByTestId('meeting-rounds').getByRole('button', { name: '2차 미팅' }).getAttribute('aria-pressed')) === 'true'))
  // 업체 상세 → 미팅 준비 링크
  await page.goto(BASE + '/ops/clients/cli_meet', { waitUntil: 'networkidle' })
  await page.getByTestId('client-sales-card').getByRole('link', { name: '미팅 준비' }).click()
  await page.waitForTimeout(500)
  check('업체 상세 영업 칸 → 미팅 준비 (그 고객)', page.url().includes('client=cli_meet'))
  const act = saved.activity.map((a) => a.text).join(' | ')
  check('활동 기록: 고객 정보 수정 · 미팅 기록 · 단계 옮김', act.includes('영업 고객 정보 수정') && act.includes('1차 미팅 기록') && act.includes('1차 미팅 예정 → 1차 미팅 완료'), act.slice(0, 300))
  check('JS 오류 없음 (미팅 준비)', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---- 미팅 준비 390 ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/sales/meeting', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('미팅 준비 390: 옆으로 넘치지 않는다', overflow <= 1, String(overflow))
  check('미팅 준비 390: 차수 네 칸이 한 줄', (await page.getByTestId('meeting-rounds').getByRole('button').count()) === 4)
  await ctx.close()
}

await browser.close()
console.log(`\nsales: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
