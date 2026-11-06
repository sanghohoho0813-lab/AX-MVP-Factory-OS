/**
 * qa:uiaudit — 전체 화면 UI 진단(같은 자로 전후 비교). 읽기만 한다(화면을 바꾸지 않음).
 *
 *   node e2e/ui-audit.mjs <baseUrl> <outDir>
 *
 * 메뉴 · 목차 화면마다 PC 1440 · 휴대폰 390 에서:
 *   screens   문서 길이 ÷ 화면 높이(첫 화면 길이)
 *   fontKinds 본문 글자 크기 종류 수 · nested 상자 안 상자 수(e2e/uiMetrics.mjs 와 같은 자)
 *   overflow  가로 넘침 px
 *   smallTaps 휴대폰에서 누르는 칸이 40px 보다 낮은 것(단추 · 링크 · 고르는 칸)
 *   tinyText  12px 보다 작은 글자 칸
 *   filled    첫 화면 안 '칠한 단추'(주 단추) 수 — 하나가 좋다
 *   errors    화면 JS 오류
 * 첫 화면(창 높이만큼) 사진을 <outDir>/<PC|phone>-<이름>.png 로 · 숫자는 <outDir>/audit.json.
 * 비교는 e2e/ui-compare.mjs.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'
import { measureUi } from './uiMetrics.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const OUT = process.argv[3] ?? '/tmp/ui-audit'
mkdirSync(OUT, { recursive: true })

export const AUDIT_SCREENS = [
  ['today', '오늘', '/'],
  ['clients', '고객 관리', '/ops/clients'],
  ['client-overview', '업체 개요', '/ops/clients/cli_hansol'],
  ['client-smart', '맞춤 추천', '/ops/clients/cli_hansol?tab=smart'],
  ['client-docs', '서류', '/ops/clients/cli_hansol?tab=docs'],
  ['client-work', '업무', '/ops/clients/cli_hansol?tab=work'],
  ['client-fees', '계약 · 수금', '/ops/clients/cli_hansol?tab=fees'],
  ['calendar', '일정', '/ops/calendar'],
  ['journal', '업무 일기', '/journal'],
  ['decide', '확인할 것', '/ops/decide'],
  ['sales', '영업 관리', '/sales/board'],
  ['money', '매출 · 비용', '/money'],
  ['grants', '지원사업', '/grants'],
  ['inbox', '상담신청', '/ops/inbox'],
  ['patent', '특허 · 벤처', '/patent-venture'],
  ['tools', '전문 모듈', '/tools'],
  ['policy', '정책자금', '/tools/policy-funding'],
  ['employment', '고용지원금', '/tools/employment'],
  ['labcare', '연구소', '/tools/labcare'],
  ['startup', '창업감면', '/tools/startup-tax'],
  ['tax', '세금 계산기', '/tools/tax'],
  ['cert', '기업인증', '/tools/cert-os'],
  ['cretop', '크레탑', '/tools/cretop'],
  ['marketing', '마케팅', '/marketing'],
  ['mk-plan', '이번 주 찍을 것', '/marketing?view=plan'],
  ['mk-make', '내 콘텐츠', '/marketing?view=make'],
  ['threads', '스레드', '/marketing/threads'],
  ['shorts', '릴스 · 틱톡', '/marketing/shorts'],
  ['content', '홍보 글', '/tools/content'],
  ['homepage', '홈페이지', '/tools/homepage'],
  ['settings', '설정', '/settings'],
]

const browser = await chromium.launch()
const result = { base: BASE, at: new Date().toISOString(), rows: [] }
for (const vp of [
  { tag: 'PC', width: 1440, height: 900 },
  { tag: 'phone', width: 390, height: 844 },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.width < 768, hasTouch: vp.width < 768, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const page = await ctx.newPage()
  let errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)))
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(seedScript())
  await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))
  for (const [slug, name, path] of AUDIT_SCREENS) {
    errs = []
    await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(800)
    await page.mouse.move(0, 0)
    const m = await measureUi(page, '')
    const extra = await page.evaluate((phone) => {
      const H = window.innerHeight
      const main = document.querySelector('main') ?? document.body
      const vis = (el) => {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'
      }
      const taps = [...main.querySelectorAll('button, a[href], [role="button"], summary, select, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])')].filter(vis)
      // 화면 읽기 프로그램용으로 숨긴 칸(1px 파일 고르기 등)은 누르는 칸이 아니다 — 4px 보다 작으면 뺀다
      const smallTaps = phone ? taps.filter((el) => { const r = el.getBoundingClientRect(); return r.width >= 4 && r.height >= 4 && r.height < 40 }).length : 0
      const textEls = [...main.querySelectorAll('*')].filter(vis).filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
      const tinyText = textEls.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12).length
      const filled = [...main.querySelectorAll('button, a[href]')].filter(vis).filter((el) => {
        const r = el.getBoundingClientRect()
        if (r.top > H || r.bottom < 0) return false
        const cs = getComputedStyle(el)
        const bg = cs.backgroundColor.match(/\d+(\.\d+)?/g)?.map(Number) ?? [255, 255, 255, 0]
        const alpha = bg.length > 3 ? bg[3] : 1
        const dark = alpha > 0.5 && bg[0] + bg[1] + bg[2] < 420
        return dark && r.height >= 28 && r.width >= 60
      }).length
      return { overflow: document.documentElement.scrollWidth - window.innerWidth, smallTaps, tinyText, filled }
    }, vp.tag === 'phone')
    const file = `${vp.tag}-${slug}.png`
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: false })
    const row = { vp: vp.tag, slug, name, path, screens: Math.round(m.screens * 10) / 10, fontKinds: m.fontKinds, boxes: m.boxes, nested: m.nested, ...extra, errors: errs.length, file }
    result.rows.push(row)
    console.log(`${vp.tag.padEnd(5)} ${name.padEnd(10)} 길이 ${row.screens} · 글자 ${row.fontKinds}종 · 상자안상자 ${row.nested} · 넘침 ${row.overflow} · 작은단추 ${row.smallTaps} · 작은글자 ${row.tinyText} · 칠한단추 ${row.filled} · 오류 ${row.errors}`)
  }
  await ctx.close()
}
await browser.close()
writeFileSync(`${OUT}/audit.json`, JSON.stringify(result, null, 2))
console.log(`\n${result.rows.length}개 화면 · ${OUT}/audit.json`)
