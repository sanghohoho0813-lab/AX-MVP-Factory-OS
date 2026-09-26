/**
 * 껍데기 시험 — 메뉴 재분류(D-86) · 최상단 시계 · 로고 · 검색 자리(D-87).
 *
 * 사이드바는 1024px 이상에서만 보이고 휴대폰에서는 서랍으로 열린다. 그래서 두 폭에서 본다.
 *   node e2e/shell.mjs http://localhost:4390
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

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- 데스크톱 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)

  const nav = page.getByRole('navigation', { name: '주 메뉴' })
  const navText = (await nav.innerText()) ?? ''
  const at = (t) => navText.indexOf(t)
  check('메뉴: 오늘과 일정이 한 묶음', at('오늘') >= 0 && at('일정') > at('오늘') && at('일정') < at('고객 관리'), navText.slice(0, 160))
  check('메뉴: 이름 — 고객 관리 · 잠재고객 상담신청 (D-104)', at('고객 관리') > 0 && at('잠재고객 상담신청') > at('고객 관리') && at('고객 운영') === -1 && at('이벤트함') === -1, navText.slice(0, 200))
  check('메뉴: 영업이 고객 다음, 컨설팅 작업실(구 도구함)이 영업 다음', at('영업자 정산') > at('잠재고객 상담신청') && at('컨설팅 작업실') > at('영업자 정산') && at('도구함') === -1, navText.slice(0, 320))
  check('메뉴: 영업 묶음에 1차 미팅 체크리스트(준비 중)', at('1차 미팅 체크리스트') > at('영업자 정산') && navText.includes('준비 중'), navText.slice(0, 360))
  check('메뉴: 가끔 쓰는 것 묶음이 없다 (D-104)', at('가끔 쓰는 것') === -1)
  check('메뉴: 특허+벤처 · 자금·지원사업이 컨설팅 작업실 안 (작업실 전체보다 위)', at('특허+벤처') > at('정책자금 진단') && at('자금·지원사업') > at('특허+벤처') && at('작업실 전체') > at('자금·지원사업'), navText.slice(0, 700))
  check('메뉴: 세금 계산기가 사이드바에 있다', at('세금 계산기') > 0)
  check('메뉴: AX STUDIO 는 그 아래', at('AX STUDIO') > at('작업실 전체'))
  check('메뉴: 설정이 맨 아래', at('설정') > at('이 시스템'))
  check('메뉴: 기록 셋은 사이드바에 따로 없다 (일정 안 탭, D-103)', !['오늘 기록', '주간 돌아보기', '전체 기록'].some((t) => navText.includes(t)))

  // 시계 — 날짜 + 초, 1초마다 움직인다
  const clock = page.locator('header [aria-label^="지금 "]:visible').first()
  const label = await clock.getAttribute('aria-label')
  check('시계: 날짜와 초까지', /^지금 \d{4}년 \d{1,2}월 \d{1,2}일 \([일월화수목금토]\) \d{2}:\d{2}:\d{2}$/.test(label ?? ''), String(label))
  const t1 = (await clock.innerText()) ?? ''
  check('시계: 화면에 초가 보인다', /\d{2}:\d{2}:\d{2}/.test(t1), t1)
  await page.waitForTimeout(1400)
  check('시계: 1초마다 움직인다', ((await clock.innerText()) ?? '') !== t1, t1)

  // 시계는 고객 플랫폼 단추 왼쪽
  const clockBox = await clock.boundingBox()
  const portalBox = await page.locator('header').getByRole('link', { name: /고객 플랫폼/ }).first().boundingBox()
  check('시계: 고객 플랫폼 왼쪽에 있다', clockBox && portalBox && clockBox.x < portalBox.x, JSON.stringify({ clockBox, portalBox }))
  check('시계: 글자가 크다(16px 이상)', (await clock.locator('span').last().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))) >= 16)

  // 로고 1.5배 (32 → 48px)
  const logoH = await page.locator('aside img').first().evaluate((el) => el.getBoundingClientRect().height)
  check('로고: 48px 로 커졌다', Math.round(logoH) === 48, String(logoH))

  // 검색 — 왼쪽, 좁게
  const search = page.getByRole('button', { name: /찾기/ }).first()
  const sBox = await search.boundingBox()
  const hBox = await page.locator('header').boundingBox()
  // 머리띠는 사이드바 오른쪽에서 시작하므로 가운데는 hBox.x + hBox.width / 2 다 (x 를 빼먹으면 늘 실패한다)
  check('검색: 머리띠 왼쪽 절반에 있다',
    sBox && hBox && sBox.x + sBox.width / 2 < hBox.x + hBox.width / 2,
    JSON.stringify({ search: sBox, headerMid: hBox && Math.round(hBox.x + hBox.width / 2) }))
  check('검색: 폭이 352px 이하', sBox && sBox.width <= 352, String(sBox?.width))

  /* ---- D-104: 메뉴 숫자 — 고객사 수(차분) · 상담신청(빨강 · 0 이면 없음) · 늘고 줄면 따라감 ---- */
  {
    const badge = (k) => page.locator(`aside [data-nav-badge="${k}"]`)
    check('숫자: 빈 저장소 — 고객 관리 0 · 상담신청 숫자 없음', ((await badge('clients').innerText()) ?? '').trim() === '0' && (await badge('requests').count()) === 0)
    await page.evaluate(seedScript())
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const stored = await page.evaluate(() => ({
      // D-114: 계약 고객만 — 계약 전(status 'waiting')인 잠재고객은 빼고 센다
      clients: JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').filter((c) => !c.archivedAt && c.status !== 'waiting').length,
      prospects: JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').filter((c) => !c.archivedAt && c.status === 'waiting').length,
      open: JSON.parse(localStorage.getItem('axmvp.v1.customer_events') ?? '[]').filter((e) => ['new', 'linked', 'in_progress'].includes(e.status)).length,
    }))
    const c1 = ((await badge('clients').innerText()) ?? '').trim()
    const r1 = ((await badge('requests').innerText()) ?? '').trim()
    check('숫자: 고객 관리 옆 = 계약 고객 수 (잠재고객 빼고)', c1 === String(stored.clients) && stored.clients > 0 && stored.prospects > 0, `${c1} / 계약 ${stored.clients} · 잠재 ${stored.prospects}`)
    check('숫자: 상담신청 옆 = 처리 안 한 신청 수', r1 === String(stored.open) && stored.open > 0, `${r1} / ${stored.open}`)
    const colors = await badge('requests').evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, fg: getComputedStyle(el).color }))
    const [rr, gg, bb] = (colors.bg.match(/\d+/g) ?? []).map(Number)
    check('숫자: 상담신청은 빨간 바탕 · 흰 숫자', rr > 150 && gg < 110 && bb < 110 && colors.fg === 'rgb(255, 255, 255)', JSON.stringify(colors))
    const quiet = await badge('clients').evaluate((el) => getComputedStyle(el).backgroundColor)
    check('숫자: 고객사 수는 튀지 않게(바탕 없음)', quiet === 'rgba(0, 0, 0, 0)', quiet)
    // 업체 하나를 지우면(보관) 화면을 옮길 때 줄어든다 · 다시 늘리면 늘어난다
    await page.evaluate(() => { const k = 'axmvp.v1.operations_clients'; const l = JSON.parse(localStorage.getItem(k)); l.find((c) => c.status !== 'waiting').archivedAt = '2026-09-24T00:00:00.000Z'; localStorage.setItem(k, JSON.stringify(l)) })
    await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: /^일정/ }).click()
    await page.waitForTimeout(500)
    check('숫자: 줄면 같이 준다', ((await badge('clients').innerText()) ?? '').trim() === String(stored.clients - 1), (await badge('clients').innerText()) ?? '')
    await page.evaluate(() => { const k = 'axmvp.v1.operations_clients'; const l = JSON.parse(localStorage.getItem(k)); l.forEach((c) => { c.archivedAt = null }); localStorage.setItem(k, JSON.stringify(l)) })
    await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: /^오늘/ }).first().click()
    await page.waitForTimeout(500)
    check('숫자: 늘면 같이 는다', ((await badge('clients').innerText()) ?? '').trim() === String(stored.clients), (await badge('clients').innerText()) ?? '')
    check('숫자: 1차 미팅은 아직 프로그램이 없어 숫자 없음(0 이면 안 단다)', (await badge('first-meetings').count()) === 0)
  }

  /* ---- D-103: 사이드바 아래 이름 · 고객 플랫폼 아이콘 · 글자 크기는 설정에만 ---- */
  const account = page.getByTestId('sidebar-account')
  check('사이드바 아래: 김상호 대표', ((await account.innerText()) ?? '').replace(/\s+/g, ' ').includes('김상호 대표'), await account.innerText())
  const portalIcon = page.getByTestId('sidebar-portal-link')
  check('사이드바 아래: 고객 플랫폼은 작은 아이콘(새 창)', (await portalIcon.getAttribute('target')) === '_blank' && ((await portalIcon.innerText()) ?? '').trim() === '' && ((await portalIcon.boundingBox())?.width ?? 99) <= 40)
  check('사이드바: 글자 크기 조절이 없다', (await page.locator('aside').getByText('글자 크기').count()) === 0)
  await page.getByRole('button', { name: '사용자 메뉴' }).click()
  await page.waitForTimeout(200)
  check('사용자 메뉴: 글자 크기 조절이 없다 (설정으로 옮김)', (await page.locator('header').getByText('글자 크기').count()) === 0)
  check('사용자 메뉴: 김상호 · 대표', ((await page.locator('header').innerText()) ?? '').includes('김상호'))
  await page.keyboard.press('Escape')
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
  check('설정: 글자 크기는 여기', (await page.getByRole('main').getByText('글자 크기').count()) >= 1)

  /* ---- D-103: 향후 확장 — 이동하지 않고 펼침 → 가운데 안내창 → 끄기 ---- */
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  const nav2 = page.getByRole('navigation', { name: '주 메뉴' })
  await nav2.getByRole('button', { name: /이 시스템/ }).click()
  await page.waitForTimeout(200)
  const sys = (await nav2.innerText()) ?? ''
  check('이 시스템: 처음 사용 가이드가 맨 위', sys.indexOf('처음 사용 가이드') > sys.indexOf('이 시스템') && sys.indexOf('처음 사용 가이드') < sys.indexOf('기획의도'), sys.slice(-300))
  const before = page.url()
  const roadmapBtn = nav2.getByRole('button', { name: /향후 확장/ })
  await roadmapBtn.click()
  await page.waitForTimeout(250)
  check('향후 확장: 눌러도 화면이 옮겨 가지 않는다', page.url() === before, page.url())
  check('향후 확장: 메뉴 안에서 펼쳐진다', (await roadmapBtn.getAttribute('aria-expanded')) === 'true' && (await nav2.locator('[data-future]').count()) >= 5)
  await nav2.locator('[data-future="notify"]').click()
  await page.waitForTimeout(300)
  const dlg = page.getByTestId('future-dialog')
  const box = await page.getByRole('dialog').boundingBox()
  const vp = page.viewportSize()
  check('향후 확장: 안내창이 뜬다 — 돌아가는 순서 · 예시', (await dlg.count()) === 1 && ((await dlg.innerText()) ?? '').includes('이렇게 돌아갈 수 있습니다') && ((await dlg.innerText()) ?? '').includes('예시'))
  check('향후 확장: 안내창이 화면 가운데', box && Math.abs(box.x + box.width / 2 - vp.width / 2) < 12 /* 세로 스크롤 막대 폭만큼 */ && Math.abs(box.y + box.height / 2 - vp.height / 2) < 40, JSON.stringify(box))
  await page.getByRole('dialog').getByRole('button', { name: /다음/ }).click()
  await page.waitForTimeout(150)
  check('향후 확장: 다음으로 넘겨 본다', ((await dlg.innerText()) ?? '').includes('하루 정리'))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  check('향후 확장: Esc 로 꺼진다', (await dlg.count()) === 0 && page.url() === before)
  await nav2.locator('[data-future="saas"]').click()
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).last().click()
  await page.waitForTimeout(150)
  check('향후 확장: 닫기 단추로도 꺼진다', (await dlg.count()) === 0)

  /* ---- D-103: 영업 · 1차 미팅 체크리스트 자리 ---- */
  await nav2.getByRole('link', { name: /1차 미팅 체크리스트/ }).click()
  await page.waitForURL(/\/sales\/first-meeting/)
  await page.getByRole('heading', { name: /1차 미팅 체크리스트/ }).first().waitFor().catch(() => {})
  check('1차 미팅 체크리스트: 준비 중 자리 화면', ((await page.getByRole('main').innerText()) ?? '').includes('준비 중'))

  /* ---- D-103: 기록은 일정 안의 탭 ---- */
  for (const [path, label] of [['/ops/calendar', '달력'], ['/journal', '오늘 기록'], ['/journal/week', '주간 돌아보기'], ['/journal/all', '전체 기록']]) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    const tabs = page.getByTestId('schedule-tabs')
    const cur = tabs.locator('[aria-current="page"]')
    check(`일정 탭 ${path}: 네 칸 · '${label}' 이 켜짐`, (await tabs.getByRole('link').count()) === 4 && ((await cur.innerText()) ?? '').includes(label), (await cur.innerText().catch(() => '')) ?? '')
    check(`일정 탭 ${path}: 사이드바는 '일정' 에 불`, ((await page.getByRole('navigation', { name: '주 메뉴' }).locator('a[aria-current="page"]').innerText()) ?? '').includes('일정'))
  }

  // 도구함
  await page.goto(BASE + '/tools', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const tools = (await page.locator('main').innerText()) ?? ''
  check('도구함: 세금 계산기가 먼저', tools.indexOf('세금 계산기') > 0 && tools.indexOf('세금 계산기') < tools.indexOf('기업인증 OS'), tools.slice(0, 260))
  check('도구함: 앞으로 붙을 것을 적어 둔다 (크레탑은 들어와서 빠짐)', tools.includes('기업인증 OS') && tools.includes('아직 없음') && tools.includes('크레탑 분석기'))
  check('도구함: 아직 없는 것은 누를 수 없다', (await page.getByRole('link', { name: /기업인증 OS/ }).count()) === 0)
  await page.getByRole('link', { name: /세금 계산기/ }).first().click()
  await page.waitForTimeout(700)
  check('도구함: 세금 계산기로 간다', page.url().includes('/tools/tax'), page.url())
  await ctx.close()
}

/* ---------------- 휴대폰 390 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)

  const clock = page.locator('header [aria-label^="지금 "]:visible').first()
  check('휴대폰 시계: 머리띠에 보인다', (await clock.count()) === 1)
  // D-96: 휴대폰에서도 오늘 날짜가 늘 보인다 (짧게 — '9월 24일 (목)' 위 · 시각 아래)
  check('휴대폰 시계: 오늘 날짜와 시각이 보인다', /^\d{1,2}월 \d{1,2}일 \([일월화수목금토]\)\s+\d{2}:\d{2}:\d{2}$/.test(((await clock.innerText()) ?? '').trim()), (await clock.innerText()) ?? '')
  const title = (await page.locator('header').innerText()) ?? ''
  check('휴대폰: 화면 이름이 여전히 보인다', title.includes('오늘'), title)

  await page.getByRole('button', { name: '메뉴 열기' }).click()
  await page.waitForTimeout(500)
  const drawer = (await page.getByRole('navigation', { name: '주 메뉴' }).innerText()) ?? ''
  check('휴대폰 서랍: 같은 순서', drawer.indexOf('컨설팅 작업실') > drawer.indexOf('고객 관리') && drawer.indexOf('AX STUDIO') > drawer.indexOf('컨설팅 작업실'), drawer.slice(0, 260))
  const logoH = await page.locator('img[alt]:visible').first().evaluate((el) => el.getBoundingClientRect().height)
  check('휴대폰 서랍: 로고도 48px', Math.round(logoH) === 48, String(logoH))
  // D-103: 예전 '이 기기 · 계정' 칸(고객 플랫폼 열기 · 처음 사용 가이드 · 글자 크기) 없음 — 아래는 이름 한 줄 + 아이콘
  const whole = (await page.locator('.fixed.inset-0.z-50').first().innerText()) ?? ''
  check('휴대폰 서랍: 이 기기 · 계정 칸 · 글자 크기가 없다', !whole.includes('이 기기') && !whole.includes('글자 크기') && !whole.includes('고객 플랫폼 열기'), whole.slice(-200))
  check('휴대폰 서랍: 아래에 김상호 대표', whole.replace(/\s+/g, ' ').includes('김상호 대표'))
  await page.keyboard.press('Escape').catch(() => {})
  await page.goto(BASE + '/journal', { waitUntil: 'networkidle' })
  const tabBoxes = await page.getByTestId('schedule-tabs').getByRole('link').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)] }))
  check('휴대폰 일정 탭: 네 칸이 모두 화면 안 (옆으로 밀지 않아도)', tabBoxes.length === 4 && tabBoxes.every(([l, r]) => l >= 0 && r <= 390), JSON.stringify(tabBoxes))
  await ctx.close()
}

await browser.close()
console.log(`\n껍데기(메뉴·시계·로고·검색): ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
