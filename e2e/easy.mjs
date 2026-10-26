/**
 * 쉽고 튼튼하게 (D-120) — 브라우저 인수 시험.
 *
 *   node e2e/easy.mjs <baseUrl>
 *
 * 지키려는 것
 *   1. 50~60대도 — 글자 크기를 머리줄에서 바로 바꾸고, 모든 글(예전 13px 고정 포함)이 따라 커진다 · 흐린 글자가 진해졌다
 *   2. 머리줄이 어느 폭 · 어느 글자 크기에서도 옆으로 넘치지 않는다(설정 · 계정 단추가 밀려나지 않는다)
 *   3. 다음 약속 — 업체 상세에서 바로 정하고, 일정(달력) · 오늘 화면에 뜬다 · 잠재 고객은 1차 미팅 예정으로
 *   4. 머리줄 찾기가 고객 관리 업체를 대표 이름 · 전화 뒷자리로 찾는다
 *   5. 미팅 메모는 차수를 바꿔도 남고, 저장한 뒤에만 비워진다
 *   6. 설정 '고급 운영 기능 보기' 를 끄면(기본) 검증 · 기관 전략 · 사례가 목차에 없다
 *   7. 조건에 맞는 업체가 없으면 빈 화면 대신 안내
 *   8. D-192 목차 — 처음엔 핵심만 펼치고 나머지는 접힘 · 목차에 마우스를 올리면(휴대폰은 ⓘ) 무슨 칸인지 ·
 *      모두 펼치기/접기 · 이 기기에 기억 · 화면 목차 전부에 설명 · 휴대폰 넘침 0
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
const plusDays = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const clients = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]'))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---- 1. 글자 · 대비 ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)

  // D-164: 머리줄 글자 크기 단추는 뺐다(대표: 설정에 있으니) — 글자 크기는 설정 › 화면에서
  check('글자 크기: 머리줄에 단추가 없다(설정에 있다)', (await page.locator('header [data-testid="text-scale-quick"]').count()) === 0 && (await page.locator('header').getByText('글자 크기').count()) === 0)
  const scaleAt = () => page.evaluate(() => document.documentElement.getAttribute('data-text-scale') ?? 'default')
  const pickScale = async (label) => {
    await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
    await page.getByRole('main').getByRole('radiogroup', { name: '글자 크기' }).first().getByRole('radio', { name: new RegExp(label) }).first().click()
    await page.waitForTimeout(200)
    await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
  }
  const metaSize = await page.locator('.t-meta').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  check('글자: 배지 · 메타 글자 14px 이상(기본)', metaSize >= 14, String(metaSize))
  const gray = await page.evaluate(() => {
    const el = document.createElement('span')
    el.className = 'text-slate-400'
    el.textContent = 'x'
    document.body.appendChild(el)
    const c = getComputedStyle(el).color
    const ref = document.createElement('span')
    ref.className = 'text-slate-500'
    document.body.appendChild(ref)
    const r = getComputedStyle(ref).color
    el.remove()
    ref.remove()
    return { c, r }
  })
  check('대비: 흐린 회색 글자가 한 단계 진하다(slate-400 → 500 색)', gray.c === gray.r, JSON.stringify(gray))
  // 예전 13px 고정이던 글(업체 카드) — 글자 크기를 따라 커지는가
  const probe = page.locator('[class*="text-[0.875rem]"]').first()
  const s1 = await probe.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  await pickScale('^크게')
  const s2 = await page.locator('[class*="text-[0.875rem]"]').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  check('글자 크기: 설정에서 크게 · 예전 고정 글자도 커진다', (await scaleAt()) === 'large' && s2 > s1 + 1, `${s1} → ${s2}`)
  await page.reload({ waitUntil: 'networkidle' })
  check('글자 크기: 새로고침해도 남는다', (await scaleAt()) === 'large')
  await pickScale('^기본')
  check('글자 크기: 다시 기본', (await scaleAt()) === 'default')

  // 목차 — 고급 기능은 기본으로 빠져 있다 (D-127: 분야 줄을 펼쳐서 본다 — 기관 전략은 기업성장(D-163), 검증 · 사례는 AX 스튜디오)
  const openCats = async () => {
    // D-136: AX 스튜디오는 '잘 안 쓰는 기능' 묶음 안 — 묶음부터 편다
    for (const name of [/기업성장/, /잘 안 쓰는 기능/, /AX 스튜디오/]) {
      const b = page.locator('aside nav').getByRole('button', { name })
      if ((await b.getAttribute('aria-expanded')) !== 'true') await b.click()
    }
    await page.waitForTimeout(200)
  }
  await openCats()
  const nav = (await page.locator('aside nav').innerText()) ?? ''
  check('목차: 기본은 검증 · 기관 전략 · 사례 없음 · AX 스튜디오(한글)', !nav.includes('기관 전략') && !nav.includes('사례') && !/\n검증\n/.test(nav) && nav.includes('AX 스튜디오'), nav.slice(0, 400))
  await page.evaluate(() => {
    const k = 'axmvp.ui.preferences'
    const p = JSON.parse(localStorage.getItem(k) ?? '{}')
    localStorage.setItem(k, JSON.stringify({ ...p, featureVisibility: 'advanced' }))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await openCats()
  const nav2 = (await page.locator('aside nav').innerText()) ?? ''
  check('목차: 고급 기능을 켜면 사례가 보인다(D-167: 기관 전략은 숨김)', !nav2.includes('기관 전략') && nav2.includes('사례'), nav2.slice(0, 400))
  await page.evaluate(() => {
    const k = 'axmvp.ui.preferences'
    const p = JSON.parse(localStorage.getItem(k) ?? '{}')
    localStorage.setItem(k, JSON.stringify({ ...p, featureVisibility: 'core' }))
  })

  // 빈 결과 안내
  await page.goto(BASE + '/ops/clients', { waitUntil: 'networkidle' })
  await page.getByPlaceholder(/업체명/).first().fill('없는회사이름쯤')
  await page.waitForTimeout(300)
  check('고객 목록: 맞는 업체가 없으면 안내 + 조건 풀기', (await page.getByTestId('clients-empty-filter').count()) === 1)
  await page.getByRole('button', { name: '조건 모두 풀기' }).click()
  await page.waitForTimeout(200)
  check('고객 목록: 조건을 풀면 다시 보인다', (await page.getByTestId('clients-empty-filter').count()) === 0)

  // 찾기 — 고객 관리 업체를 대표 이름 · 전화 뒷자리로
  await page.keyboard.press('Control+k')
  const input = page.getByPlaceholder('업체 이름 · 대표 · 전화번호 뒷자리 · 도구')
  await input.fill('김대표')
  await page.waitForTimeout(400)
  const res = (await page.locator('[role="dialog"]').innerText()) ?? ''
  check('찾기: 대표 이름으로 고객 관리 업체', res.includes('고객 관리') && res.includes('한솔테크'), res.slice(0, 200))
  await input.fill('6789')
  await page.waitForTimeout(300)
  check('찾기: 전화 뒷자리로', ((await page.locator('[role="dialog"]').innerText()) ?? '').includes('한솔테크'))
  await page.keyboard.press('Escape')

  check('JS 오류 없음 (글자 · 목차 · 찾기)', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---- 2. 머리줄 — 어느 폭 · 어느 글자 크기에서도 넘치지 않는다 ---- */
{
  const bad = []
  // D-201: 1600 · 1700 더(머리줄 [폭] 단추 · 1700~1800 에서 넘치던 것 바로잡음)
  for (const w of [360, 1024, 1280, 1366, 1440, 1600, 1700, 1920]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: 'ko-KR' })
    const page = await ctx.newPage()
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await page.evaluate(seedScript())
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    for (const scale of ['default', 'large', 'extra_large']) {
      await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
      await page.waitForTimeout(120)
      const r = await page.evaluate(() => {
        const hdr = document.querySelector('header')
        const hb = hdr.getBoundingClientRect()
        const cut = [...hdr.querySelectorAll('a,button')].filter((e) => e.offsetParent !== null && e.getBoundingClientRect().right > hb.right + 1).length
        const title = hdr.querySelector('.t-card')
        const tw = title && title.offsetParent ? title.getBoundingClientRect().width : 999
        return { over: hdr.scrollWidth - hdr.clientWidth, cut, tw }
      })
      if (r.over > 0 || r.cut > 0 || r.tw < 40) bad.push(`${w}/${scale} ${JSON.stringify(r)}`)
    }
    await ctx.close()
  }
  check('머리줄: 8폭 × 3글자 크기 모두 넘침 0 · 단추 밀림 0 · 휴대폰 제목 자리 있음', bad.length === 0, bad.join(' | '))
}

/* ---- 3. 다음 약속 · 일정 · 오늘 ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(() => {
    const k = 'axmvp.v1.operations_clients'
    const l = JSON.parse(localStorage.getItem(k))
    const r = l.find((c) => c.id === 'cli_mirae')
    r.nextAction = ''
    r.nextActionDueDate = ''
    r.sales = { stage: 'lead', source: '소개', referrer: '', interests: [], concern: '', expectedFee: null, history: [], movedAt: new Date().toISOString() }
    localStorage.setItem(k, JSON.stringify(l))
  })
  await page.goto(BASE + '/ops/clients/cli_mirae', { waitUntil: 'networkidle' })
  const ns = page.getByTestId('next-step').first()
  await ns.waitFor()
  check('다음 약속: 업체 상세 지금 할 일에서 정하기', ((await ns.innerText()) ?? '').includes('아직 정하지 않았습니다'))
  await page.getByTestId('next-step-edit').first().click()
  await page.getByRole('button', { name: '1차 미팅' }).first().click()
  await page.getByRole('button', { name: '내일' }).first().click()
  check('다음 약속: 잠재 고객 + 1차 미팅 + 날짜 → 1차 미팅 예정으로 옮기기(켜짐)', await page.getByRole('checkbox', { name: /1차 미팅 예정/ }).isChecked())
  await page.getByTestId('next-step-save').first().click()
  await page.waitForTimeout(500)
  const rec = (await clients(page)).find((c) => c.id === 'cli_mirae')
  check('다음 약속: 저장 — 1차 미팅 · 내일 · 1차 미팅 예정', rec.nextAction === '1차 미팅' && rec.nextActionDueDate === plusDays(1) && rec.sales.stage === 'm1sched', JSON.stringify({ a: rec.nextAction, d: rec.nextActionDueDate, s: rec.sales?.stage }))
  check('다음 약속: 화면에 사람 말로(… · 내일)', ((await page.getByTestId('next-step').first().innerText()) ?? '').includes('내일'))

  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const ap = (await page.getByTestId('today-appointments').innerText().catch(() => '')) ?? ''
  check('오늘: 업체 약속에 내일 1차 미팅 · 미팅 준비 링크', ap.includes('미래바이오랩') && ap.includes('1차 미팅') && ap.includes('내일') && ap.includes('미팅 준비'), ap.slice(0, 300))

  await page.goto(BASE + '/ops/calendar', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const cal = (await page.locator('main').innerText()) ?? ''
  // D-158: '다음 약속' 종류 이름은 '일정' 으로
  check('일정: 일정 종류 · 달력 칸에 무슨 일인지(1차 미팅) · 다음 약속이란 종류 이름 없음', cal.includes('일정') && cal.includes('1차 미팅') && !cal.includes('다음 약속'), '')

  // 미팅 메모 — 차수를 바꿔도 남고, 저장한 뒤에만 비워진다
  await page.goto(BASE + '/sales/meeting?client=cli_mirae&round=1', { waitUntil: 'networkidle' })
  const memo = page.getByTestId('meeting-recorder').locator('textarea')
  await memo.fill('가지급금 정리 관심. 재무제표 보내 주기로 함.')
  await page.getByTestId('meeting-rounds').getByRole('button', { name: '2차 미팅' }).click()
  await page.waitForTimeout(200)
  await page.getByTestId('meeting-rounds').getByRole('button', { name: '1차 미팅' }).click()
  await page.waitForTimeout(200)
  check('미팅 메모: 차수를 바꿨다 와도 적은 글이 남는다', (await page.getByTestId('meeting-recorder').locator('textarea').inputValue()).includes('가지급금'))
  await page.getByRole('button', { name: '메모 정리하기' }).click()
  check('미팅 메모: 받을 자료가 있으면 자료 요청 카톡', ((await page.getByTestId('meeting-analysis').innerText()) ?? '').includes('자료 요청 카톡'))
  await page.getByRole('button', { name: '기록 저장' }).click()
  await page.waitForTimeout(500)
  const saved = (await clients(page)).find((c) => c.id === 'cli_mirae')
  check('미팅 메모: 저장됨 · 저장 뒤 비워짐(다음 차수로)', (saved.sales.meetings ?? []).length === 1 && (await page.evaluate(() => sessionStorage.getItem('axmvp.meetingDraft.cli_mirae.1'))) === null)

  // 잘못된 주소
  await page.goto(BASE + '/sales/meeting?client=nope', { waitUntil: 'networkidle' })
  check('미팅 준비: 없는 업체 주소면 안내', (await page.getByTestId('client-missing').count()) === 1)

  check('JS 오류 없음 (약속 · 미팅)', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---- 4. 휴대폰 — 서랍에 글자 크기 · 영업 보드 단추 이름 ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/sales/board', { waitUntil: 'networkidle' })
  const heads = (await page.locator('main').innerText()) ?? ''
  check('휴대폰 영업 보드: 단추 이름이 다 보인다(크레탑으로 등록 · 새 잠재고객)', heads.includes('크레탑으로 등록') && heads.includes('새 잠재고객'))
  await page.getByRole('button', { name: '메뉴 열기' }).click()
  await page.waitForTimeout(300)
  // D-158 · D-164: 서랍 · 머리줄 모두 글자 크기 단추 없음 — 설정 › 화면에만
  check('휴대폰: 서랍 · 머리줄에 글자 크기 단추 없음(설정에 있다)', (await page.getByTestId('text-scale-quick').count()) === 0)
  await ctx.close()
}

/* ---- 5. D-192 목차 접기 · 목차 설명(PC) ---- */
const clearFolds = (page) =>
  page.evaluate(() => {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const k = localStorage.key(i)
      if (k && k.startsWith('axmvp.fold.')) localStorage.removeItem(k)
    }
  })
const foldState = (page, id) => page.evaluate((x) => document.querySelector(`[data-fold="${x}"]`)?.getAttribute('data-open') ?? 'none', id)
/** 화면 목차(h2) 가운데 설명이 없는 것 — 달 이름처럼 목차가 아닌 글자는 뺀다 */
const headsWithoutHint = (page) =>
  page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body
    return [...main.querySelectorAll('h2')]
      .filter((h) => h.offsetParent && !h.closest('[role=dialog]') && !h.classList.contains('sr-only') && !h.querySelector('select'))
      .filter((h) => !h.closest('.group\\/hint')?.querySelector('[data-testid=hint-tip]'))
      .map((h) => h.innerText.trim().split('\n')[0])
  })
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await clearFolds(page)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)

  // 오늘 — 마감 · 약속 · 확인할 것 · 빠른 기록(PC)은 펼침, 상담신청 · 영업 · 안부는 접힘
  const today = {
    agenda: await foldState(page, 'today.agenda'),
    decide: await foldState(page, 'today.decide'),
    capture: await foldState(page, 'today.capture'),
    events: await foldState(page, 'today.events'),
    sales: await foldState(page, 'today.sales'),
    care: await foldState(page, 'today.care'),
  }
  check('D-192 오늘: 마감 · 약속 · 확인할 것 · 빠른 기록은 펼침, 상담신청 · 영업 · 안부는 접힘', today.agenda === '1' && today.decide === '1' && today.capture === '1' && today.events === '0' && today.sales === '0' && ['0', 'none'].includes(today.care), JSON.stringify(today))
  check('D-192 오늘: 접힌 목차도 숫자는 보인다(상담신청 3)', ((await page.getByTestId('today-events').getByTestId('fold-toggle').innerText()) ?? '').replace(/\s+/g, ' ').includes('상담신청 3'))
  check("D-192 오늘: 늘 깔리던 설명 글이 없다('프로그램이 먼저 준비했어요' 는 목차 설명으로)", !((await page.locator('main').innerText()) ?? '').includes('프로그램이 먼저 준비했어요'))

  // 마우스를 올리면 설명 — 펼치기 전에 무슨 칸인지
  const salesHead = page.getByTestId('today-sales').getByTestId('fold-toggle')
  check('D-192 오늘: 설명은 처음엔 숨김', !(await page.getByTestId('today-sales').getByTestId('hint-tip').isVisible()))
  await salesHead.hover()
  await page.waitForTimeout(200)
  const tip = page.getByTestId('today-sales').getByTestId('hint-tip')
  const tipBox = await tip.boundingBox()
  check('D-192 오늘: 목차에 마우스를 올리면 설명이 바로 뜬다(영업)', (await tip.isVisible()) && ((await tip.innerText()) ?? '').includes('영업'), await tip.innerText().catch(() => ''))
  check('D-192 오늘: 설명 창이 화면 밖으로 나가지 않는다', !!tipBox && tipBox.x >= 0 && tipBox.x + tipBox.width <= 1440, JSON.stringify(tipBox))
  check('D-192 오늘: 마우스를 올려도 접힌 채(펼칠지 말지는 내가)', (await foldState(page, 'today.sales')) === '0')

  // 누르면 펼침 · 이 기기에 기억
  await salesHead.click()
  await page.waitForTimeout(200)
  check('D-192 오늘: 목차를 누르면 펼친다', (await foldState(page, 'today.sales')) === '1' && ((await page.getByTestId('today-sales').innerText()) ?? '').includes('진행 중'))
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('D-192 오늘: 펼친 것은 다시 열어도 펼친 채(이 기기에 기억)', (await foldState(page, 'today.sales')) === '1')
  check('D-192 오늘: 화면 목차 전부에 설명', (await headsWithoutHint(page)).length === 0, (await headsWithoutHint(page)).join(' · '))

  // 업체 상세 개요 — 회사 정보만 펼침, 나머지는 한 줄(숫자 · 요약)
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const ov = {
    company: await foldState(page, 'overview.company'),
    numbers: await foldState(page, 'overview.numbers'),
    contract: await foldState(page, 'overview.contract'),
    history: await foldState(page, 'overview.history'),
    tools: await foldState(page, 'overview.tools'),
  }
  check('D-192 개요: 회사 기본 정보만 펼침 · 숫자 · 계약 · 해 드린 일 · 전문 모듈은 접힘', ov.company === '1' && ov.numbers === '0' && ov.contract === '0' && ov.history === '0' && ov.tools === '0', JSON.stringify(ov))
  const cSum = (await page.getByTestId('fold-contract').getByTestId('fold-summary').innerText().catch(() => '')) ?? ''
  check('D-192 개요: 접힌 계약 목차 옆에 한 줄 요약(펼치지 않고도 금액 · 몇 달째)', /원/.test(cSum) && /개월|년/.test(cSum), cSum)
  check("D-192 개요: '번호는 조각마다 따로 복사' 설명은 목차 설명으로", !((await page.locator('main').innerText()) ?? '').includes('조각마다'))
  await page.getByTestId('fold-company').getByTestId('hint-dot').click()
  check("D-192 개요: ⓘ 를 누르면 설명(회사 기본 정보 → '조각마다 따로 복사')", ((await page.getByTestId('fold-company').getByTestId('hint-tip').innerText().catch(() => '')) ?? '').includes('조각마다'))
  check('D-192 개요: 화면 목차 전부에 설명', (await headsWithoutHint(page)).length === 0, (await headsWithoutHint(page)).join(' · '))

  // 모두 펼치기 · 모두 접기
  await page.getByTestId('fold-all-open').first().click()
  await page.waitForTimeout(300)
  const allOpen = await page.evaluate(() => [...document.querySelectorAll('[data-fold]')].every((e) => e.getAttribute('data-open') === '1'))
  check('D-192 개요: [모두 펼치기] → 목차 전부 펼침', allOpen)
  await page.goto(BASE + '/ops/clients/cli_hansol?tab=smart', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check('D-192 모두 펼치기는 다른 화면에도 이어진다(맞춤 추천 탭)', await page.evaluate(() => [...document.querySelectorAll('[data-fold]')].every((e) => e.getAttribute('data-open') === '1')))
  await page.getByTestId('fold-all-close').first().click()
  await page.waitForTimeout(300)
  check('D-192 맞춤 추천: [모두 접기] → 목차 전부 접힘 · 맨 위 "먼저 제안할 것" 은 그대로', (await page.evaluate(() => [...document.querySelectorAll('[data-fold]')].every((e) => e.getAttribute('data-open') === '0'))) && (await page.getByTestId('top-picks').isVisible()))
  check('D-192 맞춤 추천: 맨 위는 그대로 "먼저 제안할 것"', (await page.evaluate(() => document.querySelector('[data-testid="smart-tab"]')?.firstElementChild?.getAttribute('data-testid'))) === 'top-picks')
  // '모듈별 판정 n개 →' 는 접혀 있어도 펼쳐서 데려간다
  await page.getByTestId('top-picks-all').click()
  await page.waitForTimeout(500)
  check("D-192 맞춤 추천: '모듈별 판정 n개' 를 누르면 그 목차가 펼쳐진 채로", (await foldState(page, 'smart.verdicts')) === '1' && (await page.getByTestId('smart-insight').count()) >= 5)
  check('D-192 맞춤 추천: 화면 목차 전부에 설명', (await headsWithoutHint(page)).length === 0, (await headsWithoutHint(page)).join(' · '))

  // 다른 화면 — 목차 설명
  for (const r of ['/ops/clients', '/ops/clients/cli_hansol?tab=docs', '/ops/clients/cli_hansol?tab=work', '/ops/clients/cli_hansol?tab=fees', '/sales/board', '/ops/calendar', '/grants', '/journal', '/ops/decide']) {
    await page.goto(BASE + r, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    const miss = await headsWithoutHint(page)
    check(`D-192 ${r}: 화면 목차 전부에 설명`, miss.length === 0, miss.join(' · '))
  }
  check('D-192 JS 오류 없음', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

/* ---- 6. D-192 휴대폰(390 · 360) — ⓘ 누르기 · 넘침 0 · 머리줄 한 줄 ---- */
for (const width of [390, 360]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, locale: 'ko-KR', isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await clearFolds(page)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  check(`D-192 ${width} 오늘: 휴대폰은 빠른 기록도 접힘(화면이 짧게)`, (await foldState(page, 'today.capture')) === '0')
  const dot = page.getByTestId('today-sales').getByTestId('hint-dot')
  const db = await dot.boundingBox()
  check(`D-192 ${width}: ⓘ 는 누르기 쉬운 크기(44px)`, !!db && db.width >= 44 && db.height >= 44, JSON.stringify(db))
  await dot.tap()
  await page.waitForTimeout(200)
  const tip = page.getByTestId('today-sales').getByTestId('hint-tip')
  const tb = await tip.boundingBox()
  check(`D-192 ${width}: ⓘ 를 누르면 설명이 뜨고 화면 안에 들어간다`, (await tip.isVisible()) && !!tb && tb.x >= 0 && tb.x + tb.width <= width, JSON.stringify(tb))
  await dot.tap()
  await page.waitForTimeout(200)
  check(`D-192 ${width}: ⓘ 를 한 번 더 누르면 닫힌다`, !(await tip.isVisible()))
  // 머리줄 한 줄 — '모두 보기' 가 제목과 같은 줄
  const sameLine = await page.evaluate(() => {
    const f = document.querySelector('[data-fold="today.agenda"]')
    const t = f?.querySelector('[data-testid="fold-toggle"]')?.getBoundingClientRect()
    const a = f?.querySelector('a')?.getBoundingClientRect()
    return !!t && !!a && Math.abs(t.top + t.height / 2 - (a.top + a.height / 2)) < 12
  })
  check(`D-192 ${width} 오늘: 목차 줄 하나에 제목 · ⓘ · '모두 보기'`, sameLine)
  for (const r of ['/', '/ops/clients/cli_hansol', '/ops/clients/cli_hansol?tab=smart']) {
    await page.goto(BASE + r, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    check(`D-192 ${width} ${r}: 옆으로 넘침 0`, over <= 0, String(over))
  }
  await ctx.close()
}

/* ---- 7. D-201 PC 본문 폭 — 머리줄 [폭] 한 번에 좁게 → 보통 → 넓게 · 글자 크기는 그대로 · 설정 › 화면과 같은 값 ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1000 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
  const mainW = () => page.evaluate(() => Math.round(document.querySelector('main').getBoundingClientRect().width))
  const fontPx = () => page.evaluate(() => getComputedStyle(document.querySelector('main h1') ?? document.body).fontSize)
  // D-296 대표 "머리줄이 지저분" — [폭] 단추는 머리줄에서 빼고 설정 › 화면에서만 고른다
  const f0 = await fontPx()
  check('D-201 · D-296 1920: 머리줄에 [폭] 단추 없음 · 처음엔 보통 · 본문 1,280px', (await page.locator('header [data-testid="content-width"]').count()) === 0 && (await mainW()) === 1280, String(await mainW()))
  const pickWidth = async (w) => {
    await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
    if ((await page.getByTestId('settings-content-width').count()) === 0) {
      const tab = page.getByRole('tab', { name: /화면/ }).first()
      if (await tab.count()) await tab.click()
    }
    await page.getByTestId('settings-content-width').locator(`[data-width="${w}"]`).click()
    await page.goto(BASE + '/ops/clients/cli_hansol', { waitUntil: 'networkidle' })
    return mainW()
  }
  const wWide = await pickWidth('wide')
  const wNarrow = await pickWidth('narrow')
  check('D-201 설정 › 화면에서 넓게(예전 폭) · 좁게(1,100px)', wWide > 1500 && wNarrow === 1100, `${wWide} · ${wNarrow}`)
  check('D-201 폭을 바꿔도 글자 크기는 그대로', (await fontPx()) === f0, `${f0} → ${await fontPx()}`)
  await page.reload({ waitUntil: 'networkidle' })
  check('D-201 고른 폭은 새로고침해도 남는다(좁게)', (await mainW()) === 1100)
  const wBack = await pickWidth('normal')
  check('D-201 설정에서 보통으로 → 1,280px', wBack === 1280, String(wBack))
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('D-201 1920: 옆으로 넘침 0', over <= 0, String(over))
  await ctx.close()
  const small = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const sp = await small.newPage()
  await sp.goto(BASE + '/', { waitUntil: 'networkidle' })
  check('D-201 1440: 머리줄에 [폭] 단추 없음(설정에는 있다)', !(await sp.getByTestId('content-width').isVisible().catch(() => false)))
  await small.close()
}

await browser.close()
console.log(`\neasy: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
