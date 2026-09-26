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

  const btn = page.getByTestId('text-scale-quick').first()
  check('글자 크기: 머리줄에 단추가 있다(기본)', (await btn.count()) === 1 && (await btn.getAttribute('data-scale')) === 'default')
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
  await btn.click()
  await page.waitForTimeout(200)
  const s2 = await probe.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  check('글자 크기: 한 번 누르면 크게 · 예전 고정 글자도 커진다', (await btn.getAttribute('data-scale')) === 'large' && s2 > s1 + 1, `${s1} → ${s2}`)
  await page.reload({ waitUntil: 'networkidle' })
  check('글자 크기: 새로고침해도 남는다', (await page.evaluate(() => document.documentElement.getAttribute('data-text-scale'))) === 'large')
  await page.getByTestId('text-scale-quick').first().click()
  await page.getByTestId('text-scale-quick').first().click()
  check('글자 크기: 매우 크게 → 다시 기본', (await page.evaluate(() => document.documentElement.getAttribute('data-text-scale'))) === 'default')

  // 목차 — 고급 기능은 기본으로 빠져 있다
  const nav = (await page.locator('aside nav').innerText()) ?? ''
  check('목차: 기본은 검증 · 기관 전략 · 사례 없음 · AX 스튜디오(한글)', !nav.includes('기관 전략') && !nav.includes('사례') && !/\n검증\n/.test(nav) && nav.includes('AX 스튜디오'), nav.slice(0, 400))
  await page.evaluate(() => {
    const k = 'axmvp.ui.preferences'
    const p = JSON.parse(localStorage.getItem(k) ?? '{}')
    localStorage.setItem(k, JSON.stringify({ ...p, featureVisibility: 'advanced' }))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('aside nav').getByRole('button', { name: /AX 스튜디오/ }).click().catch(() => {})
  await page.waitForTimeout(200)
  const nav2 = (await page.locator('aside nav').innerText()) ?? ''
  check('목차: 고급 기능을 켜면 기관 전략 · 사례가 보인다', nav2.includes('기관 전략') && nav2.includes('사례'), nav2.slice(0, 400))
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
  for (const w of [360, 1024, 1280, 1366, 1440, 1920]) {
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
  check('머리줄: 6폭 × 3글자 크기 모두 넘침 0 · 단추 밀림 0 · 휴대폰 제목 자리 있음', bad.length === 0, bad.join(' | '))
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
  check('일정: 다음 약속 종류 · 달력 칸에 무슨 일인지(1차 미팅)', cal.includes('다음 약속') && cal.includes('1차 미팅'), '')

  // 미팅 메모 — 차수를 바꿔도 남고, 저장한 뒤에만 비워진다
  await page.goto(BASE + '/sales/meeting?client=cli_mirae&round=1', { waitUntil: 'networkidle' })
  const memo = page.getByTestId('meeting-recorder').locator('textarea')
  await memo.fill('가지급금 정리 관심. 재무제표 보내 주기로 함.')
  await page.getByTestId('meeting-rounds').getByRole('button', { name: '2차 미팅' }).click()
  await page.waitForTimeout(200)
  await page.getByTestId('meeting-rounds').getByRole('button', { name: '1차 미팅' }).click()
  await page.waitForTimeout(200)
  check('미팅 메모: 차수를 바꿨다 와도 적은 글이 남는다', (await page.getByTestId('meeting-recorder').locator('textarea').inputValue()).includes('가지급금'))
  await page.getByRole('button', { name: '메모 나눠 보기' }).click()
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
  const drawerBtn = page.getByTestId('text-scale-quick').filter({ hasText: '글자' })
  check('휴대폰 서랍: 글자 크기 단추(지금 크기가 글로)', (await drawerBtn.count()) >= 1 && ((await drawerBtn.first().innerText()) ?? '').includes('글자 기본'))
  await ctx.close()
}

await browser.close()
console.log(`\neasy: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
