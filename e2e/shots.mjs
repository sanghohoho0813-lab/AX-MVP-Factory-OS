/**
 * 화면 스크린샷 QA.
 *
 *   node e2e/shots.mjs <baseUrl> <outDir> [--wide]
 *
 * 기본은 모바일 390. --wide 를 주면 360 / 430 / 768 / 1280 / 1440 과
 * 360 + 글자 1.3배까지 함께 찍는다.
 */

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const OUT = process.argv[3] ?? '/tmp/shots'
const WIDE = process.argv.includes('--wide')

const SCREENS = [
  { name: 'today', path: '/' },
  { name: 'clients', path: '/ops/clients' },
  { name: 'client-overview', path: '/ops/clients/cli_hansol' },
  { name: 'client-work', path: '/ops/clients/cli_hansol?tab=work' },
  { name: 'client-docs', path: '/ops/clients/cli_hansol?tab=docs' },
  { name: 'client-fees', path: '/ops/clients/cli_hansol?tab=fees' },
  { name: 'inbox', path: '/ops/inbox' },
  { name: 'journal', path: '/journal' },
  { name: 'calendar', path: '/ops/calendar' },
  { name: 'funding', path: '/ops/clients/cli_daum?tab=funding' },
  { name: 'tools', path: '/tools' },
  { name: 'settings', path: '/settings' },
]

const VIEWPORTS = WIDE
  ? [
      { tag: '360', width: 360, height: 900 },
      { tag: '390', width: 390, height: 900 },
      { tag: '430', width: 430, height: 900 },
      { tag: '768', width: 768, height: 1000 },
      { tag: '1280', width: 1280, height: 900 },
      { tag: '1440', width: 1440, height: 900 },
      { tag: '360-large', width: 360, height: 900, scale: 'extra_large' },
    ]
  : [{ tag: '390', width: 390, height: 900 }]

const problems = []

async function run() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: vp.width < 768,
      hasTouch: vp.width < 768,
    })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => problems.push(`[JS] ${vp.tag} ${String(e).slice(0, 160)}`))

    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(seedScript())
    if (vp.scale) {
      await page.evaluate((s) => localStorage.setItem('axmvp.ui.text_scale', JSON.stringify(s)), vp.scale)
    }

    for (const screen of SCREENS) {
      await page.goto(BASE + screen.path, { waitUntil: 'networkidle' })
      if (vp.scale) await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), vp.scale)
      await page.waitForTimeout(700)

      const overflow = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        win: window.innerWidth,
      }))
      if (overflow.doc > overflow.win + 1) {
        problems.push(`[가로넘침] ${vp.tag} ${screen.name}: ${overflow.doc}px > ${overflow.win}px`)
      }

      // 화면 밖으로 나간 요소 찾기
      const escaped = await page.evaluate(() => {
        const out = []
        for (const el of document.querySelectorAll('button, a, input, select, h1, h2, h3')) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          if (r.right > window.innerWidth + 1 || r.left < -1) {
            out.push((el.textContent || el.tagName).trim().slice(0, 24) + ` @${Math.round(r.left)}..${Math.round(r.right)}`)
          }
        }
        return out.slice(0, 5)
      })
      for (const e of escaped) problems.push(`[밖으로] ${vp.tag} ${screen.name}: ${e}`)

      await page.screenshot({ path: `${OUT}/${vp.tag}-${screen.name}.png`, fullPage: vp.width < 768 })
    }
    await ctx.close()
  }

  await browser.close()

  console.log(`\n스크린샷: ${OUT}`)
  if (problems.length === 0) {
    console.log('반응형 문제 없음 ✅')
  } else {
    console.log(`\n문제 ${problems.length}건:`)
    for (const p of problems) console.log('  ' + p)
  }
  process.exit(problems.length > 0 ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(2)
})
