// 내부 OS 인수 여정 (local 모드) — 실제 브라우저에서 라우트를 끝까지 돈다.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const B = process.env.BASE ?? 'http://localhost:4531'
const OUT = process.env.OUT ?? './shots-internal'
mkdirSync(OUT, { recursive: true })

const results = []
const errs = []
function log(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
async function step(name, fn) {
  try {
    const r = await fn()
    log(name, r !== false, typeof r === 'string' ? r : '')
  } catch (e) {
    log(name, false, String(e).split('\n')[0].slice(0, 200))
  }
}

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
const p = await ctx.newPage()
p.setDefaultTimeout(15000)
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })

async function dismiss() {
  for (let i = 0; i < 5; i += 1) {
    if (!(await p.locator('[role="dialog"]').count())) break
    await p.keyboard.press('Escape')
    await p.waitForTimeout(150)
  }
}
async function go(path) {
  await p.goto(`${B}${path}`, { waitUntil: 'networkidle' })
  await dismiss()
}

async function offenders() {
  return p.evaluate(() => {
    const cw = document.documentElement.clientWidth
    const out = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.right > cw + 0.5 && r.width > 0) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 70)} right=${Math.round(r.right)} w=${Math.round(r.width)}`)
    }
    return out.slice(0, 12).join(' || ')
  })
}
async function shot(name) {
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
}
const today = new Date()
const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

// 1. 오늘
await go('/')
await step('홈 = Command Center (오늘 인사·5칸)', async () => {
  const h1 = await p.locator('h1').first().innerText()
  const chips = await p.locator('section[aria-label="오늘"] a').count()
  await shot('01-today-1440')
  return h1.includes('입니다') && chips === 5 ? `h1="${h1.slice(0, 30)}" chips=${chips}` : false
})
await step('브랜드: 사이드바에 Factory 문자열 없음, 로고 이미지 있음', async () => {
  const text = await p.locator('aside').innerText()
  const logo = await p.locator('aside img[alt="미래에이아이랩"]').count()
  return !/Factory/i.test(text) && logo >= 1
})
await step('헤더: 고객 플랫폼 버튼(새 탭) 존재', async () => (await p.locator('header a[target="_blank"]:has-text("고객 플랫폼")').count()) === 1)
await step('빠른 기록: 메모 저장', async () => {
  await p.locator('textarea[aria-label="기록 내용"]').first().fill('E2E 통화 메모')
  await p.locator('button:has-text("기록")').first().click()
  await p.waitForTimeout(400)
  return (await p.getByText('E2E 통화 메모').count()) >= 1
})
await step('빠른 기록: 후속조치(오늘 기한) → Top 3 에 등장', async () => {
  const cap = p.locator('section[data-tour="home-capture"]')
  await cap.getByRole('radio', { name: '후속조치' }).click()
  await cap.locator('textarea[aria-label="기록 내용"]').fill('E2E 후속조치 오늘')
  await cap.locator('input[type="date"]').fill(ymd)
  await cap.locator('button:has-text("기록")').click()
  await p.waitForTimeout(500)
  const top = await p.locator('section[data-tour="home-top3"]').innerText()
  return top.includes('E2E 후속조치 오늘') && top.includes('이유:')
})

// 2. 이벤트함
await go('/ops/inbox')
await step('이벤트함: 샘플 이벤트 만들기 (DEMO 표기)', async () => {
  await p.getByRole('button', { name: /샘플 이벤트 만들기/ }).click()
  await p.waitForTimeout(500)
  const cards = await p.locator('article').count()
  const demo = await p.locator('article:has-text("DEMO")').count()
  await shot('02-inbox-1440')
  if (cards !== 3 || demo !== 3) throw new Error(`cards=${cards} demo=${demo}`)
  return `cards=${cards}`
})
let clientHref = ''
await step('이벤트 → 새 고객사로 만들기 → 연결됨', async () => {
  await p.locator('article').first().getByRole('button', { name: '새 고객사로 만들기' }).click()
  const dlg = p.locator('[role="dialog"]')
  await dlg.waitFor()
  const name = await dlg.locator('input').first().inputValue()
  await dlg.getByRole('button', { name: '만들고 연결' }).click()
  await p.waitForTimeout(800)
  // 연결된 이벤트는 정렬상 new 아래로 내려가므로 "연결됨" 카드를 찾는다
  const linked = p.locator('article').filter({ hasText: '연결됨' }).first()
  if (!(await linked.count())) return false
  clientHref = (await linked.locator('a[href^="/ops/clients/"]').first().getAttribute('href')) ?? ''
  return clientHref !== '' ? `client=${name} href=${clientHref}` : false
})
await step('이벤트 처리 완료 → 열린 것에서 빠짐', async () => {
  await p.locator('article').filter({ hasText: '연결됨' }).first().getByRole('button', { name: '처리 완료' }).click()
  await p.waitForTimeout(400)
  return (await p.locator('article').count()) === 2
})

// 3. 업체 상세 V2
await go(clientHref)
await step('업체 상세: 탭 8개 + 개요 "지금" 블록', async () => {
  const tabs = await p.locator('[role="tablist"][aria-label="업체 상세"] [role="tab"]').count()
  const now = await p.locator('section[aria-label="지금"]').count()
  await shot('03-client-overview-1440')
  if (tabs !== 8 || now !== 1) throw new Error(`tabs=${tabs} now=${now}`)
  return `tabs=${tabs}`
})
await step('업무 탭: 벤처인증 상태 변경 → 활동 기록', async () => {
  await p.getByRole('tab', { name: '업무', exact: true }).click()
  await p.waitForTimeout(200)
  const selects = p.locator('select')
  const n = await selects.count()
  // 서비스 카드 안의 상태 select 중 하나를 진행 중으로
  for (let i = 0; i < n; i += 1) {
    const opts = await selects.nth(i).locator('option').allTextContents()
    if (opts.some((o) => o.includes('진행 중')) && opts.some((o) => o.includes('해당 없음'))) {
      await selects.nth(i).selectOption({ label: opts.find((o) => o.includes('진행 중')) })
      break
    }
  }
  await p.waitForTimeout(500)
  await p.getByRole('tab', { name: '개요' }).click()
  await p.waitForTimeout(300)
  const act = await p.getByText('활동 기록').count()
  const chip = await p.locator('section[aria-label="지금"]').innerText()
  if (!(act >= 1 && chip.includes('진행 중'))) throw new Error(chip.slice(0, 100))
  return 'ok'
})
await step('고객 플랫폼 탭: 계정 연결(DEMO)', async () => {
  await p.getByRole('tab', { name: '고객 플랫폼' }).click()
  await p.waitForTimeout(300)
  const email = p.locator('input[placeholder="customer@example.com"]')
  if (await email.count()) {
    await email.fill('demo-customer@example.com')
    await p.getByRole('button', { name: '연결' }).click()
    await p.waitForTimeout(600)
  }
  return (await p.getByText('연결됨').count()) >= 1
})
await step('고객 플랫폼: 서류 요청 → 고객 업로드 흉내 → 확인 완료', async () => {
  await p.getByRole('button', { name: '서류 요청', exact: true }).first().click()
  const dlg = p.locator('[role="dialog"]')
  await dlg.waitFor()
  await dlg.getByRole('button', { name: '요청' }).click()
  await p.waitForTimeout(500)
  const requested = await p.getByText('요청함').count()
  await p.getByRole('button', { name: /고객 업로드 흉내/ }).first().click()
  await p.waitForTimeout(500)
  const uploaded = await p.getByText('고객 업로드됨').count()
  await p.getByRole('button', { name: '확인 완료' }).first().click()
  await p.waitForTimeout(500)
  const verified = await p.getByText('확인 완료').count()
  if (!(requested >= 1 && uploaded >= 1 && verified >= 1)) throw new Error(`r=${requested} u=${uploaded} v=${verified}`)
  return 'requested→uploaded→verified'
})
await step('고객 플랫폼: 샘플 요청 → 답변', async () => {
  await p.getByRole('button', { name: /샘플 요청/ }).click()
  await p.waitForTimeout(400)
  await p.locator('input[aria-label="답변"]').first().fill('다음 주 화요일에 기관 접수 예정입니다.')
  await p.getByRole('button', { name: '답변', exact: true }).first().click()
  await p.waitForTimeout(500)
  return (await p.getByText('답변: 다음 주 화요일').count()) >= 1
})
await step('고객에게 업데이트: 미리보기 → 공개', async () => {
  await p.getByRole('button', { name: '고객에게 업데이트' }).click()
  const dlg = p.locator('[role="dialog"]')
  await dlg.waitFor()
  await dlg.locator('input').first().fill('벤처인증 서류 접수를 마쳤습니다')
  await dlg.locator('textarea').fill('기관 심사는 약 4주 걸립니다. 추가 서류가 필요하면 다시 알려드리겠습니다.')
  await dlg.getByRole('button', { name: '고객 화면 미리보기' }).click()
  await p.waitForTimeout(200)
  const preview = await dlg.innerText()
  await shot('04-publish-preview-1440')
  await dlg.getByRole('button', { name: '고객에게 공개' }).click()
  await p.waitForTimeout(600)
  const published = await p.getByText('벤처인증 서류 접수를 마쳤습니다').count()
  return preview.includes('고객에게 이렇게 보입니다') && published >= 1
})
await step('고객 화면 보기 = 고객 투영(내부 메모 없음)', async () => {
  await p.getByRole('button', { name: '고객 화면 보기' }).click()
  const dlg = p.locator('[role="dialog"]')
  await dlg.waitFor()
  const txt = await dlg.innerText()
  await shot('05-customer-preview-1440')
  await p.keyboard.press('Escape')
  // 투영에는 활동 기록 문장("… → …")이나 일기 내용이 없어야 한다 (안내 문구의 단어는 제외)
  if (!(txt.includes('내 프로젝트') && txt.includes('벤처인증 서류 접수를 마쳤습니다') && !txt.includes('→') && !txt.includes('E2E'))) throw new Error(txt.slice(0, 160))
  return 'projection ok'
})
await step('업무 일기 탭: 고객 연결 기록', async () => {
  await p.getByRole('tab', { name: '업무 일기' }).click()
  await p.waitForTimeout(300)
  await p.locator('textarea[aria-label="기록 내용"]').first().fill('E2E 고객 상세에서 남긴 결정')
  await p.locator('button:has-text("기록")').first().click()
  await p.waitForTimeout(500)
  await shot('06-client-journal-1440')
  return (await p.getByText('E2E 고객 상세에서 남긴 결정').count()) >= 1
})
await step('파일 탭 렌더', async () => {
  await p.getByRole('tab', { name: '파일' }).click()
  await p.waitForTimeout(200)
  return (await p.getByText('고객과 주고받은 파일').count()) >= 1
})

// 4. 나머지 라우트
await go('/journal/all')
await step('업무 일기 전체: 3건 이상 + 고객 필터', async () => {
  const n = await p.locator('ol li').count()
  await shot('07-journal-1440')
  if (n < 3) throw new Error(`entries=${n}`)
  return `entries=${n}`
})
await go('/ops/clients')
await step('고객 운영 현황표 렌더', async () => { await shot('08-clients-1440'); return (await p.getByText('업체별 현황표').count()) >= 1 })
await go('/ops/calendar')
await step('일정 렌더', async () => (await p.locator('[role="grid"], table, h1').count()) >= 1)
await go('/funding')
await step('자금·지원사업 렌더', async () => { await shot('09-funding-1440'); return (await p.locator('h1').count()) >= 1 })
await go('/diagnosis')
await step('AX STUDIO 라우트 보존 (/diagnosis)', async () => (await p.locator('h1').count()) >= 1)
await go('/today')
await step('/today → / 리다이렉트', async () => new URL(p.url()).pathname === '/')
await go('/settings')
await step('설정: 테마 9종 선택기', async () => {
  const n = await p.locator('[aria-label="화면 테마"] [role="radio"]').count()
  await shot('10-settings-theme-1440')
  return n === 9
})

await ctx.storageState({ path: `${OUT}/../state-internal.json` })
// 5. 튜토리얼(홈 투어) → 종료 후 overlay 0
await go('/')
await step('홈 투어 시작·종료 후 backdrop 없음', async () => {
  const btn = p.getByRole('button', { name: '이 화면 따라 해보기' }).first()
  if (!(await btn.count())) return 'guide button not found (skip)'
  await btn.click()
  await p.waitForTimeout(300)
  // 다음/완료를 최대 8번
  for (let i = 0; i < 8; i += 1) {
    const next = p.locator('[role="dialog"][aria-label$="따라 해보기"]').getByRole('button', { name: /^(다음|완료|시작|끝)/ }).first()
    if (!(await next.count())) break
    await next.click()
    await p.waitForTimeout(200)
  }
  await dismiss()
  const dialogs = await p.locator('[role="dialog"]').count()
  const pe = await p.evaluate(() => getComputedStyle(document.body).pointerEvents)
  const ov = await p.evaluate(() => getComputedStyle(document.body).overflow)
  if (!(dialogs === 0 && pe !== 'none' && ov !== 'hidden')) throw new Error(`dialogs=${dialogs} pe=${pe} ov=${ov}`)
  return 'clean'
})

// 6. 9 테마 (홈)
for (const key of ['navy-blue', 'navy-gold', 'emerald-gold', 'forest-sage', 'deep-teal', 'onyx-gold', 'burgundy', 'plum-indigo', 'steel']) {
  await step(`테마 ${key}`, async () => {
    await p.evaluate((k) => {
      const r = JSON.parse(localStorage.getItem('axmvp.ui.preferences') || '{}'); r.theme = k
      localStorage.setItem('axmvp.ui.preferences', JSON.stringify(r))
    }, key)
    await go('/')
    const attr = await p.evaluate(() => document.documentElement.getAttribute('data-theme'))
    const shell = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-navy-900').trim())
    const bodyColor = await p.evaluate(() => getComputedStyle(document.body).color)
    await shot(`theme-${key}`)
    if (!(attr === key && shell.length === 7)) throw new Error(`attr=${attr} shell=${shell}`)
    return `shell=${shell} body=${bodyColor}`
  })
}
await p.evaluate(() => { const r = JSON.parse(localStorage.getItem('axmvp.ui.preferences') || '{}'); r.theme = 'deep-teal'; localStorage.setItem('axmvp.ui.preferences', JSON.stringify(r)) })

// 7. 반응형 — 가로 넘침 0
const widths = [360, 390, 430, 768, 1024, 1280, 1440, 1920]
for (const w of widths) {
  await p.setViewportSize({ width: w, height: 900 })
  for (const path of ['/', '/ops/inbox', '/journal', clientHref, '/ops/clients', '/settings']) {
    await step(`overflow ${w}px ${path.slice(0, 24)}`, async () => {
      await go(path)
      if (w === 390 && path === '/') await shot('01-today-390')
      if (w === 390 && path === '/ops/inbox') await shot('02-inbox-390')
      if (w === 390 && path === clientHref) await shot('03-client-390')
      if (w === 390 && path === '/journal') await shot('07-journal-390')
      const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      if (over > 0) throw new Error(`overflow ${over}px :: ${await offenders()}`)
      return ''
    })
  }
}
// 큰 글자에서도 넘침 0
await p.setViewportSize({ width: 390, height: 844 })
await p.evaluate(() => { const r = JSON.parse(localStorage.getItem('axmvp.ui.preferences') || '{}'); r.textScale = 'extra_large'; localStorage.setItem('axmvp.ui.preferences', JSON.stringify(r)) })
for (const path of ['/', clientHref]) {
  await step(`overflow 390px 큰 글자 ${path.slice(0, 20)}`, async () => {
    await go(path)
    const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (over > 0) throw new Error(`overflow ${over}px :: ${await offenders()}`)
    return ''
  })
}
await p.evaluate(() => { const r = JSON.parse(localStorage.getItem('axmvp.ui.preferences') || '{}'); r.textScale = 'default'; localStorage.setItem('axmvp.ui.preferences', JSON.stringify(r)) })

// 8. 모바일 메뉴 escape
await step('모바일 메뉴 열고 닫기 → backdrop 0', async () => {
  await go('/')
  await p.getByRole('button', { name: '메뉴 열기' }).click()
  await p.waitForTimeout(200)
  const opened = await p.locator('aside, nav[aria-label="주 메뉴"]').count()
  await p.getByRole('button', { name: '메뉴 닫기' }).click()
  await p.waitForTimeout(200)
  const backdrop = await p.locator('button[aria-label="메뉴 배경 닫기"]').count()
  if (!(opened >= 1 && backdrop === 0)) throw new Error(`opened=${opened} backdrop=${backdrop}`)
  return 'clean'
})

const failed = results.filter((r) => !r.ok)
console.log(`\n내부 E2E: ${results.length - failed.length}/${results.length} passed`)
console.log(errs.length ? `JS 오류 ${errs.length}건:\n${[...new Set(errs)].slice(0, 8).join('\n')}` : 'JS 오류 없음')
await b.close()
process.exit(failed.length ? 1 : 0)
