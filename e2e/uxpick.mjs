/**
 * qa:uxpick — D-354 모듈 '어느 업체 일인가요?' · 업체로 연 모듈 '이 업체' 한 장 / D-355 내 콘텐츠 '만든 것 한눈에'.
 *
 *   P  업체 없이 연 모듈(정책자금 · 세금 계산기 · 창업감면 · 크레탑) 맨 위 [업체 고르기] → 찾기(이름 · 전화 숫자) → 고르면 같은 화면 ?client= ·
 *      넣어 둔 상황 예시(?preset=) 그대로 · 띠 [다른 업체] · [업체 없이 쓰기] · 상황 예시 안 [업체 고르기] · 홍보 글 · 홈페이지는 띠 없음
 *   F  업체로 연 정책자금 · 연구소 · 고용지원금 첫 화면 맨 위 '이 업체' 한 장(판정 · 더 필요한 것 → 서류함 · 다음 단추 = 그 업체 주소) · 업체 없이는 없음
 *   H  내 콘텐츠 '만든 것 한눈에' — 롱폼 · 릴스 · 틱톡 · 스레드 한 목록(최근 것 먼저) · 형식 칩 · 누르면 그 글이 글 칸에 · 못 찾으면 기록표 ·
 *      쓰던 다른 글이 있으면 묻고 '아니요' 면 그대로
 *   T  마케팅 만들기 칸 — 넓은 화면에서 이름 · 설명이 한 줄씩(서너 줄로 접히지 않음)
 *   M  360 · 390 · 큰 글자 — 가로 넘침 0 · JS 오류 0
 */
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) {
    pass++
    console.log('PASS ', n)
  } else {
    fail++
    console.log('FAIL ', n, d === undefined ? '' : String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500))
  }
}

const NOW = Date.now()
const iso = (minAgo) => new Date(NOW - minAgo * 60_000).toISOString()
const row = (id, data, minAgo) => ({ id, clientId: '', data: { ...data, savedAt: iso(minAgo) }, createdAt: iso(minAgo), updatedAt: iso(minAgo) })
const THREADS = [
  row('thr_a', { topic: '정책자금 신청 전에 꼭 볼 세 가지', body: '정책자금 신청 전에 이것부터 보세요.\n둘째 줄', status: 'draft', source: 'hand' }, 5),
  row('thr_b', { topic: '', body: '[ETX] 벤처확인 받으면 세금이 반으로\n본문', status: 'posted', postedOn: '2026-10-28', source: 'ai' }, 300),
]
const SHORTS = [row('sht_a', { topic: '고용지원금 30초 정리', script: '[0:00] 직원 뽑기 전에 이것부터\n[0:05] 둘째', status: 'draft', platform: 'tiktok', source: 'hand' }, 60)]
const IDEAS = [row('idea_a', { topic: 'AI 로 사업계획서 쓰는 법 × 정책자금', type: 'market', status: 'script' }, 120)]

const browser = await chromium.launch()
const errs = []
const open = async (vp = { width: 1440, height: 900 }, scale) => {
  const ctx = await browser.newContext({ viewport: vp, isMobile: vp.width < 768, hasTouch: vp.width < 768 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errs.push(`${vp.width} ${String(e).slice(0, 200)}`))
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(seedScript())
  await page.evaluate(
    ({ t, s, i, scale }) => {
      localStorage.removeItem('axmvp.fold.all')
      localStorage.setItem('axmvp.module.marketing.threads', JSON.stringify(t))
      localStorage.setItem('axmvp.module.marketing.shorts', JSON.stringify(s))
      localStorage.setItem('axmvp.module.marketing.ideas', JSON.stringify(i))
      localStorage.removeItem('mirae.threads.draft.v1')
      localStorage.removeItem('mirae.shorts.draft.v1')
      if (scale) {
        const k = 'axmvp.ui.preferences'
        const p = JSON.parse(localStorage.getItem(k) || '{}')
        p.textScale = scale
        localStorage.setItem(k, JSON.stringify(p))
      }
    },
    { t: THREADS, s: SHORTS, i: IDEAS, scale },
  )
  return { ctx, page }
}
const go = async (page, p) => {
  await page.goto(BASE + p, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

/* ---------------- P 업체 고르기 ---------------- */
{
  const { ctx, page } = await open()
  await go(page, '/tools/policy-funding')
  const bar = page.getByTestId('tool-client-pick')
  check('P1 업체 없이 연 정책자금 — 맨 위 "어느 업체 일인가요? [업체 고르기]" · 업체 띠 없음', (await bar.count()) === 1 && (await bar.innerText()).includes('어느 업체 일인가요?') && (await page.getByTestId('tool-client-banner').count()) === 0)
  await page.getByTestId('tool-client-pick-open').click()
  const dlg = page.getByTestId('tool-client-pick-dialog')
  const all = await dlg.getByTestId('tool-client-pick-list').locator('button').count()
  check('P2 창 — 보관 안 한 업체 전부(5곳) · 찾기 칸', all === 5 && (await dlg.getByTestId('tool-client-pick-search').count()) === 1, all)
  await dlg.getByTestId('tool-client-pick-search').fill('한솔')
  const one = await dlg.getByTestId('tool-client-pick-list').locator('button').count()
  await dlg.getByTestId('tool-client-pick-search').fill('없는회사이름')
  const none = await dlg.getByTestId('tool-client-pick-none').count()
  await dlg.getByTestId('tool-client-pick-search').fill('2345')
  const byPhone = await dlg.getByTestId('tool-client-pick-list').locator('button').first().getAttribute('data-client')
  check('P3 찾기 — 이름 한솔 → 1곳 · 없는 이름 → 안내 · 전화 숫자 2345 → 한솔테크', one === 1 && none === 1 && byPhone === 'cli_hansol', { one, none, byPhone })
  await dlg.getByTestId('tool-client-pick-list').locator('button').first().click()
  await page.waitForTimeout(700)
  const u = new URL(page.url())
  check('P4 고르면 같은 화면 · ?client= · 업체 띠(한솔테크) · 고르기 띠는 사라짐', u.pathname === '/tools/policy-funding' && u.searchParams.get('client') === 'cli_hansol' && (await page.getByTestId('tool-client-banner').innerText()).includes('한솔테크') && (await page.getByTestId('tool-client-pick').count()) === 0, page.url())
  await page.getByTestId('tool-client-switch').click()
  const cur = await page.getByTestId('tool-client-pick-list').locator('[aria-current="true"]').innerText()
  await page.getByTestId('tool-client-pick-list').locator('button[data-client="cli_daum"]').click()
  await page.waitForTimeout(700)
  check('P5 [다른 업체] — 지금 업체 표시 · 다움에너지로 바꿈', cur.includes('지금 업체') && new URL(page.url()).searchParams.get('client') === 'cli_daum' && (await page.getByTestId('tool-client-banner').innerText()).includes('다움에너지'), cur)
  await page.getByTestId('tool-client-switch').click()
  await page.getByTestId('tool-client-pick-clear').click()
  await page.waitForTimeout(600)
  check('P6 [업체 없이 쓰기] — client 빠지고 고르기 띠가 돌아옴', !new URL(page.url()).searchParams.has('client') && (await page.getByTestId('tool-client-pick').count()) === 1)
  // 상황 예시 안 [업체 고르기]
  await page.getByTestId('module-presets-pick').click()
  check('P7 상황 예시 안 [업체 고르기] → 같은 창', (await page.getByTestId('tool-client-pick-dialog').count()) === 1)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  check('P7b Esc 로 닫힘', (await page.getByTestId('tool-client-pick-dialog').count()) === 0)
  // 주소의 다른 값은 지키며 업체만(상황 예시 ?preset= 은 각 화면이 한 번 쓰고 지운다 — 그 밖의 값)
  await go(page, '/tools/cretop?keep=1')
  await page.getByTestId('tool-client-pick-open').click()
  await page.getByTestId('tool-client-pick-list').locator('button[data-client="cli_hansol"]').click()
  await page.waitForTimeout(700)
  const su = new URL(page.url())
  check('P8 주소의 다른 값(keep=1) 그대로 · client 더함', su.pathname === '/tools/cretop' && su.searchParams.get('keep') === '1' && su.searchParams.get('client') === 'cli_hansol', page.url())
  for (const p of ['/tools/tax', '/tools/cretop', '/tools/labcare/assessment']) {
    await go(page, p)
    check(`P9 ${p} — 고르기 띠`, (await page.getByTestId('tool-client-pick').count()) === 1)
  }
  for (const p of ['/tools/content', '/tools/homepage', '/marketing/threads']) {
    await go(page, p)
    check(`P10 ${p} — 자기 화면에 고르는 곳이 있어 띠 없음`, (await page.getByTestId('tool-client-pick').count()) === 0)
  }
  await ctx.close()
}

/* ---------------- F 이 업체 한 장 ---------------- */
{
  const { ctx, page } = await open()
  await go(page, '/tools/policy-funding?client=cli_hansol')
  const f = page.getByTestId('module-client-focus')
  const txt = (await f.count()) ? await f.innerText() : ''
  const goHref = (await f.getByTestId('module-client-focus-go').count()) ? await f.getByTestId('module-client-focus-go').getAttribute('href') : ''
  check('F1 정책자금 + 한솔테크 — 맨 위 "한솔테크(주) · 정책자금" 한 장 · 판정 말 · 다음 단추 = 이 업체 주소', txt.includes('한솔테크') && txt.includes('정책자금') && (await f.getByTestId('module-client-focus-headline').count()) === 1 && goHref.includes('client=cli_hansol'), { txt: txt.slice(0, 200), goHref })
  const firstBox = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="module-client-focus"]')
    const ai = document.querySelector('[data-testid="ai-assist-bar"]')
    return el && ai ? el.getBoundingClientRect().top < ai.getBoundingClientRect().top : !!el
  })
  check('F2 AI 도우미 띠 · 고객 전체 숫자보다 위', firstBox)
  const need = f.getByTestId('module-client-focus-need')
  check('F3 더 필요한 것(서류) → [서류함에서 올리기] = 이 업체 서류함', (await need.count()) === 1 && (await f.getByTestId('module-client-focus-docs').getAttribute('href')) === '/ops/clients/cli_hansol?tab=docs', (await need.count()) ? await need.innerText() : '')
  check('F4 화면에 NaN · undefined 없음', !/NaN|undefined/.test(txt))
  await go(page, '/tools/policy-funding')
  check('F5 업체 없이 열면 한 장 없음', (await page.getByTestId('module-client-focus').count()) === 0)
  // 고용지원금은 원래 화면이 '이 업체를 고용지원금에 넣을까요' 창을 먼저 띄울 수 있다 — 한 장은 그 아래 한눈에 보기 맨 위에 이미 있다
  // (연구소는 업체로 열면 원래대로 업체 목록 화면으로 간다)
  await go(page, '/tools/employment?client=cli_hansol')
  check('F6 고용지원금 + 한솔테크 — 이 업체 한 장(맨 위 하나)', (await page.getByTestId('module-client-focus').count()) === 1)
  await ctx.close()
}

/* ---------------- H 만든 것 한눈에 ---------------- */
{
  const { ctx, page } = await open()
  await go(page, '/marketing?view=make')
  const hub = page.getByTestId('mk-allmade')
  await hub.getByTestId('mk-allmade-item').first().waitFor({ timeout: 8000 }).catch(() => {})
  const kinds = await hub.getByTestId('mk-allmade-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')))
  check('H1 내 콘텐츠 맨 위 "만든 것 한눈에" — 스레드 · 릴스 · 롱폼 섞어 최근 것부터(스레드 5분 · 쇼츠 1시간 · 롱폼 2시간 · 스레드 5시간)', kinds.join(',') === 'thread,short,long,thread', kinds)
  const chips = await hub.getByTestId('mk-allmade-kind').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()))
  check('H2 형식 칩 — 전체 4 · 유튜브 롱폼 1 · 릴스 · 틱톡 1 · 스레드 2', chips.join('|') === '전체 4|유튜브 롱폼 1|릴스 · 틱톡 1|스레드 2', chips)
  const order = await page.evaluate(() => {
    const a = document.querySelector('[data-testid="mk-projects"]')
    const b = document.querySelector('[data-testid="mk-allmade"]')
    const c = document.querySelector('[data-testid="make-stages"]')
    return !!(a && b && c && a.getBoundingClientRect().top < b.getBoundingClientRect().top && b.getBoundingClientRect().top < c.getBoundingClientRect().top)
  })
  check('H3 자리 — 1주일치 묶음 아래 · 롱폼 단계판 위', order)
  await hub.locator('[data-testid="mk-allmade-kind"][data-kind="thread"]').click()
  const only = await hub.getByTestId('mk-allmade-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')))
  const titles = await hub.getByTestId('mk-allmade-item').allInnerTexts()
  check('H4 스레드만 — 2개 · 주제 없는 글은 첫 줄(틀 표시 [ETX] 뺌) · 올린 날 · 기록표 링크', only.join(',') === 'thread,thread' && titles[1].includes('벤처확인 받으면 세금이 반으로') && !titles[1].includes('[ETX]') && titles[1].includes('올림 10/28') && (await hub.getByTestId('mk-allmade-list-link').getAttribute('href')) === '/marketing/threads?tab=records', titles)
  await hub.getByTestId('mk-allmade-item').first().click()
  await page.waitForURL(/\/marketing\/threads/)
  await page.waitForTimeout(800)
  const body = await page.getByTestId('thr-body').inputValue()
  check('H5 스레드 글 누르면 스레드 화면 글 칸에 그 글 · 주소의 open 은 지워짐', body.startsWith('정책자금 신청 전에 이것부터 보세요.') && !page.url().includes('open='), page.url())
  // 쓰던 다른 글이 있으면 묻는다 — '아니요' 면 그대로
  await page.getByTestId('thr-body').fill('쓰던 다른 글입니다')
  await page.waitForTimeout(300)
  page.once('dialog', (d) => void d.dismiss())
  await go(page, '/marketing/threads?open=thr_b')
  await page.waitForTimeout(600)
  check('H6 쓰던 다른 글이 있으면 묻고 "아니요" → 쓰던 글 그대로', (await page.getByTestId('thr-body').inputValue()) === '쓰던 다른 글입니다')
  page.once('dialog', (d) => void d.accept())
  await go(page, '/marketing/threads?open=thr_b')
  await page.waitForTimeout(600)
  check('H7 "예" → 그 글로', (await page.getByTestId('thr-body').inputValue()).includes('벤처확인 받으면'))
  await go(page, '/marketing/threads?open=thr_none')
  await page.waitForTimeout(600)
  check('H8 못 찾은 글 → 기록표', (await page.getByTestId('thr-records').count()) === 1 && new URL(page.url()).searchParams.get('tab') === 'records')
  await go(page, '/marketing?view=make')
  await page.getByTestId('mk-allmade').locator('[data-testid="mk-allmade-item"][data-kind="short"]').first().click()
  await page.waitForURL(/\/marketing\/shorts/)
  await page.waitForTimeout(800)
  check('H9 릴스 · 틱톡 대본 누르면 대본 칸에 그 대본', (await page.getByTestId('sht-script').inputValue()).startsWith('[0:00] 직원 뽑기 전에'))
  await go(page, '/marketing?view=make')
  await page.getByTestId('mk-allmade').locator('[data-testid="mk-allmade-item"][data-kind="long"]').first().click()
  await page.waitForTimeout(800)
  check('H10 롱폼 누르면 내 콘텐츠의 그 줄(?idea=)', new URL(page.url()).searchParams.get('idea') === 'idea_a' && (await page.locator('[data-testid="radar-idea"][data-focus="1"]').count()) === 1, page.url())
  await ctx.close()
}

/* ---------------- T 만들기 칸 한 줄 ---------------- */
{
  for (const w of [1440, 1920]) {
    const { ctx, page } = await open({ width: w, height: 900 })
    await go(page, '/marketing/threads')
    const hs = await page.evaluate(() => ['threads', 'shorts', 'content', 'homepage'].map((k) => Math.round(document.querySelector(`[data-testid="mk-tab-${k}"]`)?.getBoundingClientRect().height ?? 0)))
    check(`T1 ${w} 만들기 칸 높이 ≤ 64px(이름 · 설명 한 줄씩 — 예전 1440 은 90px · 서너 줄)`, hs.every((h) => h > 0 && h <= 64), hs)
    await ctx.close()
  }
}

/* ---------------- M 휴대폰 ---------------- */
for (const [w, scale] of [[360, ''], [390, ''], [390, 'extra_large']]) {
  const { ctx, page } = await open({ width: w, height: 844 }, scale)
  const tag = `${w}${scale ? ' 큰 글자' : ''}`
  await go(page, '/tools/policy-funding')
  const o1 = await overflow(page)
  await page.getByTestId('tool-client-pick-open').click()
  await page.waitForTimeout(200)
  const o2 = await overflow(page)
  await page.getByTestId('tool-client-pick-list').locator('button').first().click()
  await page.waitForTimeout(700)
  const o3 = await overflow(page)
  await go(page, '/marketing?view=make')
  await page.getByTestId('mk-allmade-item').first().waitFor({ timeout: 8000 }).catch(() => {})
  const o4 = await overflow(page)
  check(`M ${tag} 고르기 띠 · 창 · 이 업체 한 장 · 만든 것 한눈에 — 가로 넘침 0`, [o1, o2, o3, o4].every((x) => x <= 1), [o1, o2, o3, o4])
  await ctx.close()
}
check('E JS 오류 0', errs.length === 0, errs)

await browser.close()
console.log(`\nuxpick e2e: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
