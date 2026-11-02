/**
 * qa:senior — 마케팅 · 브랜딩 화면을 60대 이상이 처음 봐도 쉽게(2026-11-02 대표 지시).
 *
 * 대표: "60대 이상 사용자가 처음에 딱 봐도 이해하기 쉽고 지속적으로 사용하기 쉬운 것을 가장 최우선 목표로."
 *
 * 마케팅 화면마다 PC 1440 · 휴대폰 390 에서 잰다.
 *  - 작은 글자: 보이는 글 중 14px 미만(어떤 글도 안 됨) · 15px 미만(설명 글)
 *  - 옅은 글자: 글자색 ↔ 바탕 대비 4.5 미만(큰 글자 18px+ 는 3 미만)
 *  - 작은 단추(휴대폰): 누를 수 있는 것 높이 40px 미만
 *  - 첫 화면 단추 수: 처음 보이는 화면 안의 누를 것 개수(적을수록 쉽다)
 *  - 어려운 말: 설명 없이 쓴 업계 말(훅 · CTA · 썸네일 · 롱폼 · 숏폼 · 인사이트 …)
 *  - 첫 화면 길이(문서 높이 ÷ 화면 높이)
 *
 *   node e2e/senior.mjs <baseUrl> [--report] [--json <file>] [--shots <dir>] [--only <화면 이름 일부>]
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const REPORT = process.argv.includes('--report')
const ji = process.argv.indexOf('--json')
const JSON_OUT = ji > 0 ? process.argv[ji + 1] : ''
const si = process.argv.indexOf('--shots')
const SHOTS = si > 0 ? process.argv[si + 1] : ''
const oi = process.argv.indexOf('--only')
const ONLY = oi > 0 ? process.argv[oi + 1] : ''

/** [이름, 주소] */
const SCREENS = [
  ['마케팅 첫 화면', '/marketing'],
  ['인기 · 급상승', '/marketing?view=top'],
  ['채널', '/marketing?view=channels'],
  ['분석', '/marketing?view=analysis'],
  ['내 콘텐츠', '/marketing?view=make'],
  ['1주일치', '/marketing?week=1'],
  ['스레드', '/marketing/threads'],
  ['릴스 · 틱톡', '/marketing/shorts'],
  ['홍보 글', '/tools/content'],
  ['홈페이지', '/tools/homepage'],
  // 고른 뒤 화면 — 주제 묶음(첫 주제를 눌러서) · 업체로 연 홍보 글 · 홈페이지
  ['주제 묶음', '/marketing', 'pack'],
  ['홍보 글 만들기', '/tools/content/build?client=cli_hansol'],
  ['홈페이지 만들기', '/tools/homepage/build?client=cli_hansol'],
]

/** 설명 없이 쓰면 60대가 멈추는 말 — 바로 뒤 괄호 설명이 있거나(롱폼(긴 영상)) 쉬운 말 뒤 괄호 안에 있으면(긴 영상(롱폼)) 셈하지 않는다 */
const JARGON = ['훅', 'CTA', 'CTR', '썸네일', '롱폼', '숏폼', '인사이트', '포맷', '템플릿', '브리프', '알고리즘', '벤치마킹', '트렌드', '해시태그', '캡션', '임프레션', '레이더', '피드', '바이럴', '타겟', '페르소나', 'SEO', 'KPI', '스크립트', '콘셉트', '팩']

let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) {
    pass++
    console.log('PASS ', n)
  } else {
    fail++
    console.log('FAIL ', n, d === undefined ? '' : String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 900))
  }
}

function measure({ jargon, phone }) {
  const vis = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return false
    const cs = getComputedStyle(el)
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05 && !el.closest('[aria-hidden="true"], .sr-only, .print-only')
  }
  // Tailwind 4 기본 색은 oklch() 로 나온다 — sRGB 로 바꿔 잰다
  // 반투명 색(bg-slate-900/80 같은)은 oklab() 으로 나온다 — 둘 다 같은 식으로
  const oklch = (c) => {
    const lab = c.startsWith('oklab')
    const m = c.match(/okl(?:ch|ab)\(\s*([\d.]+)(%?)\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s*\/\s*([\d.]+)(%?))?\s*\)/)
    if (!m) return null
    const L = m[2] ? +m[1] / 100 : +m[1]
    const C = +m[3]
    const h = (+m[4] * Math.PI) / 180
    const a = lab ? +m[3] : C * Math.cos(h)
    const b = lab ? +m[4] : C * Math.sin(h)
    const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
    const lin = [4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_, -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_, -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_]
    const g = (x) => Math.round(255 * Math.min(1, Math.max(0, x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)))
    const alpha = m[5] === undefined ? 1 : m[6] ? +m[5] / 100 : +m[5]
    return { r: g(lin[0]), g: g(lin[1]), b: g(lin[2]), a: alpha }
  }
  const parse = (c) => {
    if (c.startsWith('okl')) return oklch(c)
    const m = c.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const [r, g, b, a = '1'] = m[1].split(',').map((x) => x.trim())
    return { r: +r, g: +g, b: +b, a: +a }
  }
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  // 바탕 — 그라데이션 · 그림 바탕은 색을 알 수 없어 재지 않는다(null)
  const bgOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/color-mix/.test(cs.backgroundImage) && /gradient|url/.test(cs.backgroundImage)) return null
      const c = parse(cs.backgroundColor)
      // 반투명 검은 막(사진 위 글씨 칸)도 바탕으로 본다 — 그 아래 사진은 색을 알 수 없다
      if (c && c.a > 0.15) return c.a > 0.5 ? c : { r: Math.round(c.r * c.a), g: Math.round(c.g * c.a), b: Math.round(c.b * c.a), a: 1 }
    }
    return { r: 255, g: 255, b: 255, a: 1 }
  }
  // 글이 직접 들어 있는 칸
  const texts = []
  const walker = document.createTreeWalker(document.querySelector('main') ?? document.body, NodeFilter.SHOW_TEXT)
  const seen = new Set()
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.replace(/\s+/g, ' ').trim()
    if (t.length < 2 || !/[가-힣A-Za-z0-9]/.test(t)) continue
    const el = n.parentElement
    if (!el || seen.has(el) || !vis(el)) continue
    if (el.closest('svg, script, style, textarea, input, select option, [data-senior-skip]')) continue
    seen.add(el)
    texts.push({ el, t })
  }
  const small14 = []
  const small15 = []
  const lowC = []
  for (const { el, t } of texts) {
    const cs = getComputedStyle(el)
    const fs = parseFloat(cs.fontSize)
    if (fs < 13.95) small14.push(`${fs.toFixed(1)}px "${t.slice(0, 30)}"`)
    if (fs < 14.95) small15.push(`${fs.toFixed(1)}px "${t.slice(0, 30)}"`)
    const fg = parse(cs.color)
    const bg = fg ? bgOf(el) : null
    if (fg && bg) {
      const l1 = lum(fg)
      const l2 = lum(bg)
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
      const big = fs >= 18 || (fs >= 14 && Number(cs.fontWeight) >= 700)
      if (ratio < (big ? 3 : 4.5)) lowC.push(`${ratio.toFixed(2)} "${t.slice(0, 30)}"`)
    }
  }
  const SEL = 'button:not(:disabled), a[href], [role="button"], [role="tab"], summary, select, input[type="checkbox"], input[type="radio"], label:has(> input[type="checkbox"])'
  // 본문(main)만 — 왼쪽 메뉴 · 머리줄 · 휴대폰 아래 메뉴는 모든 화면에 같으므로 빼고 잰다
  const root = document.querySelector('main') ?? document.body
  const inter = [...root.querySelectorAll(SEL)].filter((el) => vis(el) && !el.closest('[data-senior-skip], aside, header, nav[data-mobile-nav]'))
  const firstView = inter.filter((el) => {
    const r = el.getBoundingClientRect()
    return r.top + scrollY < innerHeight && r.bottom > 0
  })
  const smallTap = phone
    ? inter
        .filter((el) => {
          const r = el.getBoundingClientRect()
          // 글 사이에 낀 글자 링크는 빼고(문장 속 링크), 단추 모양만
          if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') return false
          return r.height < 39.5
        })
        .map((el) => `${Math.round(el.getBoundingClientRect().height)}px "${(el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24)}"`)
    : []
  const body = (document.querySelector('main') ?? document.body).innerText
  const jar = []
  for (const w of jargon) {
    const re = new RegExp(`${w}(?!\\s*\\()`, 'g')
    // 괄호 안(쉬운 말 뒤 옛 이름)은 뺀다
    const n = (body.replace(/\([^()\n]{0,40}\)/g, '()').match(re) ?? []).length
    if (n) jar.push(`${w}×${n}`)
  }
  // D-507 무엇을 하는 곳인지 한 줄(첫 화면 1 → 2 → 3 · 화면마다 '이 화면은' · 스레드/릴스 탭 설명)이 처음 보이는 화면 안에 있나
  const guideEl = [...document.querySelectorAll('[data-testid="mk-steps"], [data-testid="mk-guide"], [data-testid$="-about"]')].find((el) => vis(el) && el.getBoundingClientRect().top < innerHeight)
  return {
    guide: !!guideEl,
    small14: small14.length,
    small15: small15.length,
    lowContrast: lowC.length,
    smallTap: smallTap.length,
    firstButtons: firstView.length,
    jargon: jar.reduce((s, x) => s + Number(x.split('×')[1]), 0),
    length: +(document.documentElement.scrollHeight / innerHeight).toFixed(1),
    samples: { small14: small14.slice(0, 8), lowC: lowC.slice(0, 8), smallTap: smallTap.slice(0, 10), jargon: jar.slice(0, 12) },
  }
}

const browser = await chromium.launch()
const all = {}
for (const vp of [
  { tag: 'PC', width: 1440, height: 900, phone: false },
  { tag: '휴대폰', width: 390, height: 844, phone: true },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.phone, hasTouch: vp.phone, deviceScaleFactor: vp.phone ? 2 : 1 })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(seedScript())
  await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))
  // 로컬 미리보기에는 유튜브 함수가 없다 — 예시 자료로(대표 화면과 같은 모양)
  await page.goto(BASE + '/marketing', { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(600)
  const sample = page.getByTestId('yt-sample')
  if (await sample.count()) {
    await sample.first().click()
    await page.waitForTimeout(900)
  }
  for (const [name, path, then] of SCREENS.filter(([n]) => !ONLY || n.includes(ONLY))) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(700)
    const ys = page.getByTestId('yt-sample')
    if (await ys.count()) {
      await ys.first().click().catch(() => {})
      await page.waitForTimeout(900)
    }
    if (then === 'pack') {
      await page.getByTestId('mk-key').first().click().catch(() => {})
      await page.getByTestId('mk-pack').waitFor({ timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(500)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(200)
    const m = await page.evaluate(measure, { jargon: JARGON, phone: vp.phone })
    all[`${vp.tag} ${name}`] = m
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true })
      await page.screenshot({ path: `${SHOTS}/${vp.tag}-${name.replace(/[^가-힣a-z0-9]+/gi, '_')}.png` })
    }
    const line = `${vp.tag} ${name} — 안내 ${m.guide ? '있음' : '없음'} · 14px 미만 ${m.small14} · 15px 미만 ${m.small15} · 옅은 글 ${m.lowContrast} · ${vp.phone ? `작은 단추 ${m.smallTap} · ` : ''}첫 화면 단추 ${m.firstButtons} · 어려운 말 ${m.jargon} · 길이 ${m.length}`
    if (REPORT) {
      console.log(`\n■ ${line}`)
      for (const [k, v] of Object.entries(m.samples)) if (v.length) console.log(`   ${k}: ${v.join(' | ')}`)
    } else {
      check(`${line} — 14px 미만 0`, m.small14 === 0, m.samples.small14)
      check(`${vp.tag} ${name}: 옅은 글 0`, m.lowContrast === 0, m.samples.lowC)
      if (vp.phone) check(`${vp.tag} ${name}: 작은 단추(40px 미만) 0`, m.smallTap === 0, m.samples.smallTap)
      check(`${vp.tag} ${name}: 설명 없는 어려운 말 0`, m.jargon === 0, m.samples.jargon)
      // 고른 뒤 화면(주제 묶음 · 업체로 연 도구)은 화면 머리가 이미 무엇인지 말한다 — 목차 칸 첫 화면만 본다
      if (!then && !path.includes('/build')) check(`${vp.tag} ${name}: 무엇을 하는 곳인지 한 줄이 첫 화면 안`, m.guide)
    }
  }
  // D-507 계속 쓰기 쉽게 — 주제 하나를 담으면 첫 화면 맨 위 [이어서 하기] · 묶음 끝 '다음엔 이것'
  if (!REPORT && !ONLY) {
    await page.goto(BASE + '/marketing', { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(500)
    if (await page.getByTestId('yt-sample').count()) {
      await page.getByTestId('yt-sample').first().click()
      await page.waitForTimeout(900)
    }
    const before = await page.getByTestId('mk-resume').count()
    await page.getByTestId('mk-key').first().click()
    await page.getByTestId('mk-pack').waitFor({ timeout: 8000 })
    const topic = (await page.getByTestId('mk-pack-topic').innerText()).split('\n')[0].trim()
    const next = page.getByTestId('mk-pack-next')
    const nextOk = (await next.count()) === 1 && (await page.getByTestId('mk-pack-next-save').count()) === 1
    await page.getByTestId('mk-pack-next-save').click()
    await page.getByTestId('mk-pack-next-open').waitFor({ timeout: 5000 }).catch(() => {})
    const saved = (await page.getByTestId('mk-pack-next-open').count()) === 1
    await page.getByTestId('mk-pack-next-back').click()
    await page.getByTestId('mk-home').waitFor({ timeout: 8000 })
    if (await page.getByTestId('yt-sample').count()) {
      await page.getByTestId('yt-sample').first().click()
      await page.waitForTimeout(900)
    }
    await page.getByTestId('mk-resume').waitFor({ timeout: 5000 }).catch(() => {})
    const card = page.getByTestId('mk-resume')
    const cardText = (await card.innerText().catch(() => '')) ?? ''
    const resumeTop = (await card.boundingBox())?.y ?? 9999
    const keyTop = (await page.getByTestId('mk-key').first().boundingBox())?.y ?? 0
    check(`${vp.tag} 이어서 하기 — 처음엔 없음 · 묶음 끝 [내 콘텐츠에 담기] → [이어서 하기] 단추로 바뀜 · [다른 주제 고르기] → 첫 화면 맨 위 '지난번 하던 것'(주제 · 다음은 찍기) · 주제 단추보다 위`, before === 0 && nextOk && saved && cardText.includes(topic) && cardText.includes('찍기') && resumeTop < keyTop, { before, nextOk, saved, cardText: cardText.slice(0, 120), topic })
    await page.getByTestId('mk-resume-go').click()
    await page.waitForTimeout(800)
    const u = new URL(page.url())
    const rowNext = (await page.locator('[data-testid="radar-idea"][data-focus="1"] [data-testid="make-row-next"]').innerText().catch(() => '')) ?? ''
    check(`${vp.tag} [이어서 하기] → 내 콘텐츠의 그 줄(?view=make&idea=) · 줄 맨 위 '지금 대본 준비 중 · 다음은 찍기 — 무엇을 누르면 되는지'`, u.searchParams.get('view') === 'make' && !!u.searchParams.get('idea') && (await page.locator('[data-testid="radar-idea"][data-focus="1"]').count()) === 1 && rowNext.includes('다음은 찍기') && rowNext.includes('촬영 완료'), { url: page.url(), rowNext })

    // D-507 홍보 글 업체 고르기 — 처음엔 '지난번 하던 곳' 없음 → 글 하나 저장 → 맨 위 [이어서 하기] 가 그 업체 화면으로
    await page.goto(BASE + '/tools/content', { waitUntil: 'networkidle' })
    await page.getByTestId('content-picker').waitFor({ timeout: 8000 }).catch(() => {})
    const pickBefore = await page.getByTestId('subject-resume').count()
    await page.goto(BASE + '/tools/content/build?client=cli_hansol', { waitUntil: 'networkidle' })
    await page.getByTestId('content-pick').first().click()
    // D-507 결과 칸 이름도 쉬운 말(해시태그 → #태그(해시태그)) — 글 본문은 복사되는 글이라 재지 않는다
    await page.getByTestId('content-block').first().waitFor({ timeout: 5000 }).catch(() => {})
    const blockLabels = await page.locator('[data-testid="content-block"] p > span:first-child').allInnerTexts()
    const hardLabels = blockLabels.filter((t) => JARGON.some((w) => new RegExp(`${w}(?!\\s*\\))`).test(t.replace(/\([^()]{0,40}\)/g, '()'))))
    check(`${vp.tag} 홍보 글 결과 칸 이름 — 설명 없는 어려운 말 0`, blockLabels.length > 0 && hardLabels.length === 0, { blockLabels, hardLabels })
    await page.getByTestId('content-save').click()
    await page.waitForTimeout(600)
    await page.goto(BASE + '/tools/content', { waitUntil: 'networkidle' })
    await page.getByTestId('subject-resume').waitFor({ timeout: 5000 }).catch(() => {})
    const pickName = (await page.getByTestId('subject-resume-name').innerText().catch(() => '')) ?? ''
    await page.getByTestId('subject-resume-go').click().catch(() => {})
    await page.waitForURL(/\/tools\/content\/build/, { timeout: 5000 }).catch(() => {})
    check(`${vp.tag} 홍보 글 업체 고르기 — 처음엔 '지난번 하던 곳' 없음 · 글을 저장하면 맨 위 [이어서 하기](한솔테크) → 그 업체 화면`, pickBefore === 0 && pickName.includes('한솔테크') && new URL(page.url()).searchParams.get('client') === 'cli_hansol', { pickBefore, pickName, url: page.url() })

    // D-507 스레드 쓰기 — 글 칸이 비고 쓰다 둔 글이 있으면 맨 위 '쓰다 둔 글 [이어서 쓰기]' → 누르면 그 글이 글 칸에
    await page.goto(BASE + '/marketing/threads', { waitUntil: 'networkidle' })
    await page.getByTestId('thr-write').waitFor({ timeout: 8000 }).catch(() => {})
    const thrBefore = await page.getByTestId('thr-resume').count()
    // 글 칸이 접혀 있으면(글이 없을 때 2단계 한 줄) [직접 쓰기] 로 연다
    if ((await page.getByTestId('thr-body').count()) === 0) await page.getByTestId('thr-hand').click().catch(() => {})
    await page.getByTestId('thr-body').fill('정책자금 신청 전에 꼭 볼 세 가지\n1. 체납 없는지')
    await page.getByTestId('thr-save').click()
    await page.waitForTimeout(500)
    page.once('dialog', (d) => void d.accept())
    await page.getByTestId('thr-new').click()
    await page.getByTestId('thr-resume').waitFor({ timeout: 5000 }).catch(() => {})
    const thrLine = (await page.getByTestId('thr-resume-line').innerText().catch(() => '')) ?? ''
    await page.getByTestId('thr-resume-go').click().catch(() => {})
    await page.waitForTimeout(300)
    const thrBody = await page.getByTestId('thr-body').inputValue().catch(() => '')
    check(`${vp.tag} 스레드 쓰다 둔 글 — 처음엔 없음 · 저장 뒤 새 글이면 맨 위 [이어서 쓰기] → 그 글이 글 칸에`, thrBefore === 0 && thrLine.includes('정책자금 신청 전에') && thrBody.startsWith('정책자금 신청 전에') && (await page.getByTestId('thr-resume').count()) === 0, { thrBefore, thrLine, thrBody: thrBody.slice(0, 30) })

    // D-507 릴스 · 틱톡 — 같은 방식 '써 둔 대본 [이어서 쓰기]'
    await page.goto(BASE + '/marketing/shorts', { waitUntil: 'networkidle' })
    await page.getByTestId('sht-write').waitFor({ timeout: 8000 }).catch(() => {})
    const shtBefore = await page.getByTestId('sht-resume').count()
    if ((await page.getByTestId('sht-script').count()) === 0) await page.getByTestId('sht-hand').click().catch(() => {})
    await page.getByTestId('sht-script').fill('[0:00] 정책자금 거절되는 세 가지\n[0:03] 첫째 체납')
    await page.getByTestId('sht-save').click()
    await page.waitForTimeout(500)
    page.once('dialog', (d) => void d.accept())
    await page.getByTestId('sht-new').click()
    await page.getByTestId('sht-resume').waitFor({ timeout: 5000 }).catch(() => {})
    await page.getByTestId('sht-resume-go').click().catch(() => {})
    await page.waitForTimeout(300)
    const shtScript = await page.getByTestId('sht-script').inputValue().catch(() => '')
    check(`${vp.tag} 릴스 써 둔 대본 — 처음엔 없음 · 저장 뒤 새로 만들기면 맨 위 [이어서 쓰기] → 그 대본이 칸에`, shtBefore === 0 && shtScript.startsWith('[0:00] 정책자금 거절') && (await page.getByTestId('sht-resume').count()) === 0, { shtBefore, shtScript: shtScript.slice(0, 30) })
  }
  // D-507 큰 글자(설정 › 글자 크기 '매우 크게' = 130%)에서도 휴대폰 화면이 옆으로 넘치지 않게
  if (vp.phone && !ONLY) {
    const wide = []
    for (const [name, path, then] of SCREENS) {
      await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {})
      await page.waitForTimeout(500)
      if (await page.getByTestId('yt-sample').count()) {
        await page.getByTestId('yt-sample').first().click().catch(() => {})
        await page.waitForTimeout(700)
      }
      if (then === 'pack') {
        await page.getByTestId('mk-key').first().click().catch(() => {})
        await page.getByTestId('mk-pack').waitFor({ timeout: 8000 }).catch(() => {})
      }
      await page.evaluate(() => document.documentElement.setAttribute('data-text-scale', 'extra_large'))
      await page.waitForTimeout(300)
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      if (over > 1) wide.push(`${name} +${over}px`)
    }
    check(`${vp.tag} 글자 '매우 크게'(130%) — 마케팅 ${SCREENS.length}화면 옆으로 넘침 0`, wide.length === 0, wide)
  }
  check(`${vp.tag} JS 오류 0`, errs.length === 0, errs)
  await ctx.close()
}
await browser.close()
const sum = (k) => Object.values(all).reduce((s, m) => s + m[k], 0)
console.log(`\n합계 — 14px 미만 ${sum('small14')} · 15px 미만 ${sum('small15')} · 옅은 글 ${sum('lowContrast')} · 휴대폰 작은 단추 ${sum('smallTap')} · 첫 화면 단추 ${sum('firstButtons')} · 어려운 말 ${sum('jargon')}`)
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(all, null, 2))
console.log(`\nsenior: ${pass} passed, ${fail} failed`)
process.exit(REPORT ? 0 : fail ? 1 : 0)
