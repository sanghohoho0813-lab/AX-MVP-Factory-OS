/**
 * qa:hover — 누를 수 있는 것은 전부 손가락 커서 + 마우스를 올리면 눈에 보이는 변화(2026-11-02 대표 지시).
 *
 * 대표: "누를 수 있는 건 마우스를 갖다 대면 손가락(두 번째 손가락) 모양으로 바뀌고, 박스가 살짝 색칠되거나 움직여야 해 — 전반적으로 검토."
 *
 * PC(1440)에서 메뉴 화면마다 누를 수 있는 것(단추 · 링크 · role=button/tab · summary · 체크 칸 · onClick 이 붙은 칸)을 모아
 *  1. 그 위에 마우스를 올렸을 때 커서가 손가락(pointer)인지
 *  2. 올리기 전과 뒤에 그것(또는 안쪽 글 · 아이콘)의 색 · 바탕 · 테두리 · 그림자 · 위치가 달라지는지
 * 를 잰다. 움직임(transition)은 잠시 끄고 바로 비교한다.
 *
 *   node e2e/hover.mjs <baseUrl> [--report] [--max 160]
 *   --report : 실패 대신 화면마다 빠진 것 목록만(고칠 곳 찾기)
 */
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const REPORT = process.argv.includes('--report')
const mi = process.argv.indexOf('--max')
const MAX = mi > 0 ? Number(process.argv[mi + 1]) : 160

/** [이름, 주소, 열고 나서 할 일(선택)] */
const SCREENS = [
  ['오늘', '/'],
  ['고객 관리', '/ops/clients'],
  ['업체 개요', '/ops/clients/cli_hansol'],
  ['맞춤 추천', '/ops/clients/cli_hansol?tab=smart'],
  ['서류', '/ops/clients/cli_hansol?tab=docs'],
  ['확인할 것', '/ops/decide'],
  ['일정 기록', '/journal'],
  ['일정', '/ops/calendar'],
  ['영업 관리', '/sales/board'],
  ['매출 · 비용', '/money'],
  ['지원사업', '/grants'],
  ['상담신청', '/ops/inbox'],
  ['특허 · 벤처', '/patent-venture'],
  ['전문 모듈', '/tools'],
  ['정책자금', '/tools/policy-funding'],
  ['고용지원금', '/tools/employment'],
  ['연구소', '/tools/labcare'],
  ['창업감면', '/tools/startup-tax'],
  ['세금 계산기', '/tools/tax'],
  ['기업인증', '/tools/cert-os'],
  ['크레탑', '/tools/cretop'],
  ['마케팅', '/marketing'],
  ['내 콘텐츠', '/marketing?view=make'],
  ['스레드', '/marketing/threads'],
  ['릴스 · 틱톡', '/marketing/shorts'],
  ['홍보 글', '/tools/content'],
  ['홈페이지', '/tools/homepage'],
  ['설정', '/settings'],
]

let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) {
    pass++
    console.log('PASS ', n)
  } else {
    fail++
    console.log('FAIL ', n, d === undefined ? '' : String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 1200))
  }
}

/** 화면 안에서 — 누를 수 있는 것 모으기(번호표를 붙여 둔다) */
function collect(max) {
  document.querySelectorAll('[data-hover-probe]').forEach((e) => e.removeAttribute('data-hover-probe'))
  const SEL = 'button:not(:disabled), a[href], [role="button"]:not([aria-disabled="true"]), [role="tab"], [role="menuitem"], [role="option"], [role="switch"], summary, select:not(:disabled), input[type="checkbox"]:not(:disabled), input[type="radio"]:not(:disabled), label:has(> input[type="checkbox"]:not(:disabled)), label:has(> input[type="radio"]:not(:disabled))'
  const set = new Set(document.querySelectorAll(SEL))
  // onClick 이 붙은 칸(React) — 단추가 아닌데 누르면 무언가 되는 곳
  for (const el of document.querySelectorAll('div, li, tr, td, span, section, article, img, p, header, h2, h3')) {
    const k = Object.keys(el).find((x) => x.startsWith('__reactProps$'))
    const p = k ? el[k] : null
    if (p && typeof p.onClick === 'function' && !/stopPropagation\(\)\s*;?\s*\}?\s*$/.test(String(p.onClick)) && String(p.onClick).length > 40) set.add(el)
  }
  const vw = innerWidth
  const vh = innerHeight
  const out = []
  for (const el of set) {
    if (out.length >= max) break
    if (el.closest('[data-hover-skip], .print-only, [aria-hidden="true"]')) continue
    if (el.matches('input[type="checkbox"], input[type="radio"]') && el.closest('label')) continue // 감싼 label 로 잰다
    const r = el.getBoundingClientRect()
    if (r.width < 6 || r.height < 6) continue
    if (r.width * r.height > vw * vh * 0.6) continue // 뒤판(바깥 누르면 닫힘) 같은 것
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue
    // 화면 밖(가로로 숨은 것 · 아주 아래)은 건너뛴다 — 위에서 3화면까지만
    if (r.left + scrollX < -2 || r.left + scrollX > document.documentElement.scrollWidth) continue
    if (r.top + scrollY > vh * 3) continue
    el.setAttribute('data-hover-probe', String(out.length))
    const label = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)
    out.push({ i: out.length, tag: el.tagName.toLowerCase(), tid: el.getAttribute('data-testid') || '', label })
  }
  return out
}

/** 하나 — 보이게 옮기고 가운데 좌표 */
function locate(i) {
  const el = document.querySelector(`[data-hover-probe="${i}"]`)
  if (!el) return null
  el.scrollIntoView({ block: 'center', inline: 'nearest' })
  const r = el.getBoundingClientRect()
  // 가운데가 글자 사이 빈 곳이면 그대로 — 커서는 상속되므로 안쪽 어디든 같다
  const x = Math.round(Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 2))
  const y = Math.round(Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 2))
  return { x, y, out: { x: Math.round(Math.max(r.left - 40, 2)), y: Math.round(r.top > 60 ? r.top - 30 : Math.min(r.bottom + 30, innerHeight - 2)) } }
}

/** 지금 모양 — 그것 · 안쪽 몇 개 · 바로 위 부모의 보이는 성질 */
function snap({ i, x, y }) {
  const el = document.querySelector(`[data-hover-probe="${i}"]`)
  if (!el) return null
  const P = ['background-color', 'background-image', 'border-top-color', 'border-bottom-color', 'border-left-color', 'box-shadow', 'color', 'text-decoration-line', 'opacity', 'transform', 'translate', 'scale', 'outline-style', 'filter', 'fill', 'stroke']
  const pick = (e) => {
    const cs = getComputedStyle(e)
    return P.map((p) => cs.getPropertyValue(p)).join('|')
  }
  const kids = [...el.querySelectorAll('*')].slice(0, 24)
  const top = x === undefined ? null : document.elementFromPoint(x, y)
  const inside = top ? el === top || el.contains(top) || top.contains(el) : false
  return {
    s: [pick(el), ...kids.map(pick), el.parentElement ? pick(el.parentElement) : ''].join('#'),
    cursor: top ? getComputedStyle(top).cursor : '',
    inside,
    topTag: top ? top.tagName.toLowerCase() : '',
  }
}

/** 둥근 칸 안의 큰 단추가 네모로만 칠해지나(칸 전체가 칠해져야 자연스럽다) */
function patch({ i }) {
  const el = document.querySelector(`[data-hover-probe="${i}"]`)
  if (!el || el.hasAttribute('data-no-veil')) return false
  const cs = getComputedStyle(el)
  if (!cs.backgroundImage.includes('gradient')) return false
  if (parseFloat(cs.borderTopLeftRadius) > 2) return false
  const r = el.getBoundingClientRect()
  let a = el.parentElement
  for (let k = 0; a && k < 3; k++, a = a.parentElement) {
    const s = getComputedStyle(a)
    if (parseFloat(s.borderTopLeftRadius) > 4 && parseFloat(s.borderTopWidth) > 0) {
      const ar = a.getBoundingClientRect()
      const inset = Math.min(r.left - ar.left, ar.right - r.right, r.top - ar.top, ar.bottom - r.bottom)
      return inset >= 2 && inset <= 28 && r.width > ar.width * 0.55 && r.height > 28
    }
  }
  return false
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)))
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
await page.evaluate(seedScript())
let total = 0
let noPointer = 0
let noHover = 0
let totalSquares = 0
for (const [name, path] of SCREENS) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(800)
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' })
  const items = await page.evaluate(collect, MAX)
  const missPointer = []
  const missHover = []
  const squares = []
  let measured = 0
  for (const it of items) {
    const at = await page.evaluate(locate, it.i)
    if (!at) continue
    await page.mouse.move(at.out.x, at.out.y)
    const before = await page.evaluate(snap, { i: it.i })
    await page.mouse.move(at.x, at.y)
    const after = await page.evaluate(snap, { i: it.i, x: at.x, y: at.y })
    if (!before || !after || !after.inside) continue // 다른 것에 가려졌다(떠 있는 판 등) — 건너뜀
    measured++
    const who = `${it.tag}${it.tid ? `[${it.tid}]` : ''} "${it.label}"`
    if (after.cursor !== 'pointer') missPointer.push(`${who} (${after.cursor}@${after.topTag})`)
    if (before.s === after.s) missHover.push(who)
    else if (await page.evaluate(patch, { i: it.i })) squares.push(who)
  }
  total += measured
  noPointer += missPointer.length
  noHover += missHover.length
  totalSquares += squares.length
  const head = `${name} — 잰 것 ${measured} · 손가락 아님 ${missPointer.length} · 변화 없음 ${missHover.length} · 둥근 칸 안 네모 ${squares.length}`
  if (REPORT) {
    console.log(`\n■ ${head}`)
    if (missPointer.length) console.log('  손가락 아님:\n   - ' + missPointer.slice(0, 40).join('\n   - '))
    if (missHover.length) console.log('  변화 없음:\n   - ' + missHover.slice(0, 40).join('\n   - '))
    if (squares.length) console.log('  둥근 칸 안 네모:\n   - ' + squares.slice(0, 40).join('\n   - '))
  } else {
    check(`${name}: 누를 수 있는 것 ${measured}개 전부 손가락 커서`, missPointer.length === 0, missPointer.slice(0, 12))
    check(`${name}: 마우스를 올리면 전부 눈에 보이는 변화`, missHover.length === 0, missHover.slice(0, 12))
    check(`${name}: 둥근 칸 안의 큰 단추는 칸 전체가 칠해짐(네모 조각 0)`, squares.length === 0, squares.slice(0, 12))
    check(`${name}: 잰 것이 있음(빈 화면 아님)`, measured >= 3, measured)
  }
}
console.log(`\n합계 — 잰 것 ${total} · 손가락 아님 ${noPointer} · 변화 없음 ${noHover} · 둥근 칸 안 네모 ${totalSquares}`)
if (!REPORT) check('JS 오류 0', errs.length === 0, errs)
await browser.close()
console.log(`\nhover: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
