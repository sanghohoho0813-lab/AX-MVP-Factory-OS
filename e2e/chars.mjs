/**
 * qa:chars — 📐 글자 수 한도(D-627 · 2026-11-18 대표 지시).
 *
 * 대표: "목차를 눌러 들어갔을 때 한 화면에 나오는 글자 수를 엄격하게 제한 — 여러 번 누르더라도 하나하나 더 나오게 하든지 다음 단계로. 토스처럼."
 * 목차 화면마다(오늘 · 일정 밖) 아무것도 누르지 않았을 때 보이는 글자를 PC 1440 · 휴대폰 390 에서 센다.
 *   - 본문(main) 안의 글자만 — 왼쪽 메뉴 · 머리줄 · 경로 줄(고객 관리 › 업체 › 탭) · 휴대폰 아래 메뉴는 빼고, 스크롤해야 보이는 것은 넣는다.
 *   - 빈칸은 세지 않는다. 접힌 칸 · 숨긴 칸 · 화면 읽기 전용 글(sr-only) · 창(dialog) 안은 세지 않는다.
 *   - 목록 자료(업체 · 공고 이름)도 센다 — 견본 업체 5곳 기준(e2e/seed.mjs). 그래서 목록은 5줄 + [더 보기].
 * 목표는 PC 200자 · 휴대폰 150자. 화면마다 한도를 두고(아직 못 고친 화면은 지금 숫자), 고치면 목표로 내린다 — 올리지 않는다.
 *
 *   node e2e/chars.mjs <baseUrl> [--json <file>] [--shots <dir>] [--only <이름 일부>] [--top <n>]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://localhost:4390'
const arg = (k) => {
  const i = process.argv.indexOf(k)
  return i > 0 ? process.argv[i + 1] : ''
}
const JSON_OUT = arg('--json')
const SHOTS = arg('--shots')
const ONLY = arg('--only')
/** --top <n>: 큰 글 조각을 몇 개까지 보일지(줄일 곳 찾기) */
const TOPN = Number(arg('--top')) || 8
if (SHOTS) mkdirSync(SHOTS, { recursive: true })

/** 목표 — 모든 화면이 여기까지 내려와야 한다 */
export const TARGET = { PC: 200, phone: 150 }
const T = 'T'

/**
 * [묶음, 이름, 주소, PC 한도, 휴대폰 한도] — T = 목표(PC 200 · 휴대폰 150).
 * 숫자 한도는 아직 못 고친 화면의 지금 글자 수(2026-11-18 [⋯] 모은 뒤 기준선) — 늘어나면 실패, 고치면 T 로 바꾼다.
 */
export const CHAR_SCREENS = [
  ['오늘', '확인할 것', '/ops/decide', 1085, 1081],
  ['고객', '고객 관리', '/ops/clients', T, T],
  ['고객', '업체 개요', '/ops/clients/cli_hansol', T, T],
  ['고객', '업체 · 맞춤 추천', '/ops/clients/cli_hansol?tab=smart', T, T],
  ['고객', '업체 · 서류', '/ops/clients/cli_hansol?tab=docs', T, T],
  ['고객', '업체 · 업무', '/ops/clients/cli_hansol?tab=work', T, T],
  ['고객', '업체 · 계약 수금', '/ops/clients/cli_hansol?tab=fees', T, T],
  ['고객', 'AI 전략실', '/ai', 465, 465],
  ['고객', '특허 · 벤처', '/patent-venture', T, T],
  ['고객', '잠재고객 상담신청', '/ops/inbox', 345, 345],
  ['영업', '영업 관리', '/sales/board', T, T],
  ['영업', '영업자 정산', '/ops/agents', T, 168],
  ['영업', '매출 · 비용', '/money', T, T],
  ['영업', '1차 미팅 체크리스트', '/sales/first-meeting', 240, 240],
  ['마케팅', '마케팅 첫 화면', '/marketing', 272, T],
  ['마케팅', '유튜브', '/marketing?view=plan', 355, 265],
  ['마케팅', '내 콘텐츠', '/marketing?view=make', 333, 257],
  ['마케팅', '1주일치', '/marketing?week=1', 674, 661],
  ['마케팅', '스레드', '/marketing/threads', 518, 420],
  ['마케팅', '릴스 · 틱톡', '/marketing/shorts', 597, 502],
  ['마케팅', '남의 인기 영상', '/marketing/youtube?view=top', T, T],
  ['마케팅', '기초 7가지', '/marketing/basics', 560, 513],
  ['마케팅', '홍보 글', '/tools/content', 320, 264],
  ['마케팅', '홈페이지', '/tools/homepage', 306, 253],
  ['전문 모듈', '정책자금', '/tools/policy-funding', 517, 402],
  ['전문 모듈', '고용지원금', '/tools/employment', 644, 500],
  ['전문 모듈', '연구소', '/tools/labcare', 737, 605],
  ['전문 모듈', '지원사업 알림', '/grants', T, T],
  ['전문 모듈', '기업인증', '/tools/cert-os', T, T],
  ['전문 모듈', '기업성장 살펴보기', '/modules/growth', 600, 600],
  ['전문 모듈', '세금 계산기', '/tools/tax', 2679, 2546],
  ['전문 모듈', '창업감면', '/tools/startup-tax', 660, 535],
  ['전문 모듈', '크레탑', '/tools/cretop', 423, 365],
  ['전문 모듈', '절세·재무 살펴보기', '/modules/tax-finance', 452, 452],
  ['전문 모듈', '출시 예정 살펴보기', '/upcoming', 812, 812],
  ['전문 모듈', '출시 예정 한 곳', '/upcoming/gasugeum', T, T],
  ['전문 모듈', '모듈 전체', '/tools', 491, 479],
  ['설정', '설정', '/settings', T, T],
  ['설정', '사용법 안내', '/guide', T, T],
  ['이 시스템', '기획의도', '/why', 2385, 2385],
  ['이 시스템', '성과 지표', '/kpi', 1268, 1268],
]

/** 화면 안에서 센다(브라우저) — 보이는 글자 · 첫 화면 안 글자 · 누를 수 있는 것 */
export function countChars(topN = 8) {
  const main = document.querySelector('main')
  if (!main) return null
  const H = window.innerHeight
  let all = 0
  let first = 0
  const blocks = []
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
  let n
  while ((n = walker.nextNode())) {
    const t = n.textContent.replace(/\s+/g, '')
    if (!t) continue
    const el = n.parentElement
    if (!el || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
    if (el.closest('[aria-hidden="true"],[role="dialog"],.sr-only,[data-testid="crumbs"]')) continue
    const r = document.createRange()
    r.selectNodeContents(n)
    const rects = [...r.getClientRects()].filter((x) => x.width > 1 && x.height > 1)
    if (!rects.length) continue
    all += t.length
    if (rects[0].top + window.scrollY < H) first += t.length
    blocks.push([t.length, t.slice(0, 40)])
  }
  const clickables = [...main.querySelectorAll('a[href],button,[role="button"],summary,select,input:not([type=hidden]),textarea')].filter((e) => e.checkVisibility() && e.getBoundingClientRect().width > 4)
  return { all, first, click: clickables.length, top: blocks.sort((a, b) => b[0] - a[0]).slice(0, topN) }
}

let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) pass++
  else fail++
  console.log(c ? 'PASS ' : 'FAIL ', n, c || d === undefined ? '' : String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400))
}

const browser = await chromium.launch()
const out = []
for (const vp of [
  { tag: 'PC', width: 1440, height: 900, col: 3 },
  { tag: 'phone', width: 390, height: 844, col: 4 },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.width < 768, hasTouch: vp.width < 768, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(seedScript())
  await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))
  for (const s of CHAR_SCREENS) {
    const [group, name, path] = s
    if (ONLY && !name.includes(ONLY)) continue
    const raw = s[vp.col]
    const limit = raw === T ? TARGET[vp.tag] : raw
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(800)
    await page.mouse.move(0, 0)
    await page.evaluate(() => window.scrollTo(0, 0))
    const m = await page.evaluate(countChars, TOPN)
    if (!m) {
      check(`${vp.tag} ${name}: 본문을 찾지 못함`, false, path)
      continue
    }
    out.push({ vp: vp.tag, group, name, path, limit, target: raw === T, ...m })
    const tag = raw === T ? '목표' : '아직(기준선)'
    check(`${vp.tag} ${name} ${m.all}자 ≤ ${limit}자 [${tag}]`, m.all <= limit, { path, top: m.top })
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp.tag}-${name.replace(/[^가-힣a-z0-9]+/gi, '_')}.png`, fullPage: true })
  }
  check(`${vp.tag} JS 오류 0`, errs.length === 0, errs)
  await ctx.close()
}
await browser.close()
const done = CHAR_SCREENS.filter((s) => s[3] === T && s[4] === T).length
console.log(`\n목표(PC ${TARGET.PC} · 휴대폰 ${TARGET.phone})까지 내린 화면: ${done} / ${CHAR_SCREENS.length}`)
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(out, null, 2))
console.log(`chars: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
