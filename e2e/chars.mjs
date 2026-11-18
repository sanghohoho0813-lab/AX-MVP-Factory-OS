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
 * D-628(2026-11-18) 대화창은 오른쪽 판으로 — 가운데(main)는 작업 화면만 센다(위 한도 그대로).
 *   오른쪽 판은 따로 잰다: 처음(시작 카드 · 판 전체 — 탭 이름 포함) 60자 이하 · [대화 시작] 을 누른 뒤 판 안은 PC 200자 이하 ·
 *   휴대폰은 둥근 [대화] 를 누른 뒤 아래 판 안 150자 이하. 판이 열린 채 가운데도 한도 안인지 다시 본다(모듈 첫 화면).
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
  ['오늘', '확인할 것', '/ops/decide', T, T],
  ['고객', '고객 관리', '/ops/clients', T, T],
  ['고객', '업체 개요', '/ops/clients/cli_hansol', T, T],
  ['고객', '업체 · 맞춤 추천', '/ops/clients/cli_hansol?tab=smart', T, T],
  ['고객', '업체 · 서류', '/ops/clients/cli_hansol?tab=docs', T, T],
  ['고객', '업체 · 업무', '/ops/clients/cli_hansol?tab=work', T, T],
  ['고객', '업체 · 계약 수금', '/ops/clients/cli_hansol?tab=fees', T, T],
  ['고객', 'AI 전략실', '/ai', T, T],
  ['고객', '특허 · 벤처', '/patent-venture', T, T],
  ['고객', '잠재고객 상담신청', '/ops/inbox', T, T],
  ['영업', '영업 관리', '/sales/board', T, T],
  ['영업', '영업자 정산', '/ops/agents', T, T],
  ['영업', '매출 · 비용', '/money', T, T],
  ['영업', '1차 미팅 체크리스트', '/sales/first-meeting', T, T],
  ['마케팅', '마케팅 첫 화면', '/marketing', T, T],
  ['마케팅', '유튜브', '/marketing?view=plan', T, T],
  ['마케팅', '내 콘텐츠', '/marketing?view=make', T, T],
  ['마케팅', '1주일치', '/marketing?week=1', T, T],
  ['마케팅', '스레드', '/marketing/threads', T, T],
  ['마케팅', '릴스 · 틱톡', '/marketing/shorts', T, T],
  ['마케팅', '남의 인기 영상', '/marketing/youtube?view=top', T, T],
  ['마케팅', '기초 7가지', '/marketing/basics', T, T],
  ['마케팅', '홍보 글', '/tools/content', T, T],
  ['마케팅', '홈페이지', '/tools/homepage', T, T],
  ['전문 모듈', '정책자금', '/tools/policy-funding', T, T],
  ['전문 모듈', '고용지원금', '/tools/employment', T, T],
  ['전문 모듈', '연구소', '/tools/labcare', T, T],
  ['전문 모듈', '지원사업 알림', '/grants', T, T],
  ['전문 모듈', '기업인증', '/tools/cert-os', T, T],
  ['전문 모듈', '기업성장 살펴보기', '/modules/growth', T, T],
  ['전문 모듈', '세금 계산기', '/tools/tax', T, T],
  ['전문 모듈', '창업감면', '/tools/startup-tax', T, T],
  ['전문 모듈', '크레탑', '/tools/cretop', T, T],
  ['전문 모듈', '절세·재무 살펴보기', '/modules/tax-finance', T, T],
  ['전문 모듈', '출시 예정 살펴보기', '/upcoming', T, T],
  ['전문 모듈', '출시 예정 한 곳', '/upcoming/gasugeum', T, T],
  ['전문 모듈', '모듈 전체', '/tools', T, T],
  ['설정', '설정', '/settings', T, T],
  ['설정', '사용법 안내', '/guide', T, T],
  ['이 시스템', '기획의도', '/why', T, T],
  ['이 시스템', '성과 지표', '/kpi', T, T],
]

/** D-628 오른쪽 대화창 시작 카드 한도(판 전체 — 탭 이름 포함) */
export const DOCK_START_LIMIT = 60

/**
 * D-628 대화창이 있는 화면 — [이름, 주소, 종류]. chat = 대화창(질문칸 · 큰 단추) · assist = AI 도우미가 그 화면의 대화창(마케팅 세 화면).
 * 유튜브는 받아 온 영상이 있어야 AI 도우미가 생긴다 — 견본([예시로 보기])을 켠 뒤 잰다.
 */
export const DOCK_SCREENS = [
  ['정책자금', '/tools/policy-funding', 'chat'],
  ['고용지원금', '/tools/employment', 'chat'],
  ['연구소', '/tools/labcare', 'chat'],
  ['창업감면', '/tools/startup-tax', 'chat'],
  ['세금 계산기', '/tools/tax', 'chat'],
  ['지원사업 알림', '/grants', 'chat'],
  ['크레탑', '/tools/cretop', 'chat'],
  ['홍보 글', '/tools/content', 'chat'],
  ['홈페이지', '/tools/homepage', 'chat'],
  ['특허 · 벤처', '/patent-venture', 'chat'],
  ['기업인증', '/tools/cert-os', 'chat'],
  ['마케팅 첫 화면', '/marketing', 'chat'],
  ['유튜브', '/marketing?view=plan', 'assist'],
  ['스레드', '/marketing/threads', 'assist'],
  ['릴스 · 틱톡', '/marketing/shorts', 'assist'],
]

/** 화면 안에서 센다(브라우저) — 보이는 글자 · 첫 화면 안 글자 · 누를 수 있는 것. sel: 셀 곳(기본 본문 main) */
export function countChars(topN = 8, sel = 'main') {
  if (typeof topN === 'object' && topN) {
    sel = topN.sel ?? 'main'
    topN = topN.topN ?? 8
  }
  const main = document.querySelector(sel)
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
    if (el.closest('[aria-hidden="true"],.sr-only,[data-testid="crumbs"]')) continue
    // 창(dialog) 안은 세지 않는다 — 단, 그 창 자체를 세라고 했으면(휴대폰 아래 판) 센다
    const dialog = el.closest('[role="dialog"]')
    if (dialog && dialog !== main && main.contains(dialog)) continue
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

  /* ---- D-628 오른쪽 대화창 — 처음 쓰는 사람처럼('대화창 같이' · 닫아 둔 기억 없음) ---- */
  await page.evaluate(() => ['axmvp.chatfirst.v1', 'axmvp.ui.page_chat', 'axmvp.ui.side_dock'].forEach((k) => localStorage.removeItem(k)))
  const dockErrs = []
  page.on('pageerror', (e) => dockErrs.push(String(e).slice(0, 160)))
  for (const [name, path, kind] of DOCK_SCREENS) {
    if (ONLY && !name.includes(ONLY)) continue
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(700)
    // 유튜브 — 받아 온 영상이 없으면 견본을 켠다(AI 도우미는 영상이 있어야 생긴다)
    const sample = page.getByTestId('yt-sample')
    if (kind === 'assist' && (await sample.count())) {
      await sample.first().click()
      await page.waitForTimeout(900)
    }
    await page.mouse.move(0, 0)
    const tag = name.replace(/[^가-힣a-z0-9]+/gi, '_')
    if (vp.tag === 'PC') {
      await page.getByTestId('side-dock').waitFor({ timeout: 6000 }).catch(() => {})
      const start = await page.evaluate(countChars, { topN: TOPN, sel: '[data-testid="side-dock"]' })
      const card = await page.getByTestId('chat-start').count()
      check(`PC 대화창 처음 · ${name} ${start?.all ?? '없음'}자 ≤ ${DOCK_START_LIMIT}자 [시작 카드 · 판이 저절로 열림]`, !!start && card === 1 && start.all > 0 && start.all <= DOCK_START_LIMIT, { path, card, top: start?.top })
      // 판이 열린 채(본문이 좁아진 채)로도 가운데는 한도 안
      const center = await page.evaluate(countChars, TOPN)
      if (kind === 'chat') check(`PC 대화창 열린 채 가운데 · ${name} ${center?.all}자 ≤ ${TARGET.PC}자`, !!center && center.all <= TARGET.PC, { path, top: center?.top })
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/PC-대화창-${tag}-1처음.png` })
      await page.getByTestId('chat-start').click().catch(() => {})
      await page.waitForTimeout(500)
      const begun = await page.evaluate(countChars, { topN: TOPN, sel: '[data-testid="side-dock"]' })
      // [대화 시작] 뒤 새로 나온 것도 화면 한도 안 — 대화창 · 오른쪽 판 안의 AI 도우미 판 모두
      check(`PC 대화창 시작 뒤 · ${name} ${begun?.all}자 ≤ ${TARGET.PC}자`, !!begun && begun.all > 0 && begun.all <= TARGET.PC, { path, top: begun?.top })
      out.push({ vp: 'PC', group: '대화창', name, path, limit: DOCK_START_LIMIT, target: true, all: start?.all ?? -1, first: start?.all ?? -1, click: start?.click ?? 0, top: start?.top ?? [], begun: begun?.all ?? -1 })
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/PC-대화창-${tag}-2시작.png` })
    } else {
      const fab = page.getByTestId('page-chat-launch')
      const has = await fab.count()
      if (!has) {
        check(`phone 대화 단추 · ${name}: 둥근 [대화] 가 없음`, false, path)
        continue
      }
      await fab.click()
      await page.waitForTimeout(900)
      if (kind === 'chat') {
        const sheet = await page.evaluate(countChars, { topN: TOPN, sel: '[data-testid="page-chat-sheet"]' })
        check(`phone 대화창(아래 판) · ${name} ${sheet?.all ?? '없음'}자 ≤ ${TARGET.phone}자`, !!sheet && sheet.all > 0 && sheet.all <= TARGET.phone, { path, top: sheet?.top })
        out.push({ vp: 'phone', group: '대화창', name, path, limit: TARGET.phone, target: true, all: sheet?.all ?? -1, first: sheet?.all ?? -1, click: sheet?.click ?? 0, top: sheet?.top ?? [] })
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/phone-대화창-${tag}.png` })
        await page.getByTestId('page-chat-sheet-close').click().catch(() => {})
      } else {
        check(`phone 대화 단추 · ${name}: 둥근 [대화] → AI 도우미 판`, (await page.getByTestId('ai-assist-panel').count()) === 1, path)
        await page.keyboard.press('Escape')
      }
      await page.waitForTimeout(200)
    }
  }
  check(`${vp.tag} 대화창 JS 오류 0`, dockErrs.length === 0, dockErrs)
  await ctx.close()
}
await browser.close()
const done = CHAR_SCREENS.filter((s) => s[3] === T && s[4] === T).length
console.log(`\n목표(PC ${TARGET.PC} · 휴대폰 ${TARGET.phone})까지 내린 화면: ${done} / ${CHAR_SCREENS.length}`)
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(out, null, 2))
console.log(`chars: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
