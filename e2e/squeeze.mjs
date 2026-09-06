/**
 * 좁은 칸에 갇힌 글자 찾기 — "글자가 세로로 길어지는" 현상 탐지.
 *
 *   node e2e/squeeze.mjs <baseUrl> [--all]
 *
 * 왜 필요한가:
 *   flex 줄 안에서 글자 칸이 `flex-1`(기준폭 0) 인데 옆의 버튼이 `shrink-0` 이면,
 *   브라우저는 줄바꿈(wrap)을 하지 않고 글자 칸만 20~60px 로 짜부라뜨린다.
 *   그러면 한 줄에 한 글자씩 세로로 흐른다. 스크린샷을 사람이 봐야만 보이던
 *   이 문제를 숫자로 잡는다.
 *
 * 판정:
 *   글자가 3줄 넘게 흐르는데 칸 너비가 화면의 35% 미만이고, 한 줄에 들어간
 *   글자 수가 평균 6자 미만이면 "짜부라짐" 으로 본다.
 */

import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const ALL = process.argv.includes('--all')

const SCREENS = [
  { name: '오늘', path: '/' },
  { name: '고객 운영', path: '/ops/clients' },
  { name: '업체 개요', path: '/ops/clients/cli_hansol' },
  { name: '업체 업무', path: '/ops/clients/cli_hansol?tab=work' },
  { name: '업체 서류', path: '/ops/clients/cli_hansol?tab=docs' },
  { name: '업체 수금', path: '/ops/clients/cli_hansol?tab=fees' },
  { name: '업체 자금', path: '/ops/clients/cli_daum?tab=funding' },
  { name: '이벤트함', path: '/ops/inbox' },
  { name: '업무 일기', path: '/journal' },
  { name: '일정', path: '/ops/calendar' },
  { name: '전체 도구', path: '/tools' },
  { name: '설정', path: '/settings' },
  { name: '기획의도', path: '/why' },
  { name: '성과 지표', path: '/kpi' },
  { name: '향후 확장', path: '/roadmap' },
]

const VIEWPORTS = ALL
  ? [
      { tag: '360', width: 360 },
      { tag: '390', width: 390 },
      { tag: '430', width: 430 },
      { tag: '360-large', width: 360, scale: 'extra_large' },
    ]
  : [{ tag: '390', width: 390 }]

/** 브라우저 안에서 도는 검사기. Range 로 실제 줄 수를 센다. */
const DETECTOR = `(() => {
  const bad = []
  const seen = new Set()
  for (const el of document.querySelectorAll('p, span, div, h1, h2, h3, h4, li, label, button, a, td, th')) {
    // 글자만 든 잎사귀 요소만 본다 (자식 요소가 있으면 그 자식이 잡힌다)
    const text = (el.textContent || '').trim()
    if (text.length < 8) continue
    if (el.children.length > 0 && Array.from(el.children).some((c) => (c.textContent || '').trim().length >= 8)) continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    if (getComputedStyle(el).visibility === 'hidden') continue

    // 실제로 몇 줄로 흘렀는지 — 글자 상자의 세로 위치 종류를 센다
    let lines = 1
    try {
      const range = document.createRange()
      range.selectNodeContents(el)
      const tops = new Set()
      for (const r of range.getClientRects()) {
        if (r.width > 0 && r.height > 0) tops.add(Math.round(r.top))
      }
      if (tops.size > 0) lines = tops.size
    } catch { /* 무시 */ }

    if (lines < 4) continue
    const perLine = text.length / lines
    const widthRatio = rect.width / window.innerWidth
    if (perLine < 6 && widthRatio < 0.35) {
      const key = text.slice(0, 30) + '|' + Math.round(rect.left)
      if (seen.has(key)) continue
      seen.add(key)
      bad.push({
        text: text.slice(0, 40),
        width: Math.round(rect.width),
        lines,
        perLine: Number(perLine.toFixed(1)),
        tag: el.tagName.toLowerCase(),
        cls: (typeof el.className === 'string' ? el.className : '').slice(0, 90),
      })
    }
  }
  return bad
})()`

const problems = []

async function run() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: 900 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    const page = await ctx.newPage()
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(seedScript())
    if (vp.scale) {
      await page.evaluate((s) => localStorage.setItem('axmvp.ui.text_scale', JSON.stringify(s)), vp.scale)
    }

    for (const screen of SCREENS) {
      await page.goto(BASE + screen.path, { waitUntil: 'networkidle' })
      if (vp.scale) await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), vp.scale)
      await page.waitForTimeout(600)
      const bad = await page.evaluate(DETECTOR)
      for (const b of bad) {
        problems.push(`[${vp.tag}] ${screen.name}: "${b.text}" — ${b.width}px 칸에 ${b.lines}줄 (줄당 ${b.perLine}자) <${b.tag} class="${b.cls}">`)
      }
    }
    await ctx.close()
  }

  await browser.close()

  if (problems.length === 0) {
    console.log('짜부라진 글자 없음 ✅')
  } else {
    console.log(`짜부라진 글자 ${problems.length}건:`)
    for (const p of problems) console.log('  ' + p)
  }
  process.exit(problems.length > 0 ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(2)
})
