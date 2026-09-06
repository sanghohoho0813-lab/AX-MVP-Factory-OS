/**
 * 9 테마 전수 검사 — 규격 Q-1: 대표 3개가 아니라 아홉 개 전부.
 *
 * 핵심 화면 세 개(오늘 · 고객 운영 · 업체 상세)를 테마마다 열어서
 *   1) 본문 글자색이 테마에 물들지 않는지 (slate 중립 고정)
 *   2) 선택 상태·주요 버튼이 테마 색을 쓰는지
 *   3) JS 오류가 없는지
 * 를 확인하고 스크린샷을 남긴다.
 *
 *   node e2e/themes.mjs <baseUrl> <outDir>
 */

import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const OUT = process.argv[3] ?? '/tmp/themes'
const THEMES = ['navy-blue', 'navy-gold', 'emerald-gold', 'forest-sage', 'deep-teal', 'onyx-gold', 'burgundy', 'plum-indigo', 'steel']
const SCREENS = [
  { name: 'today', path: '/' },
  { name: 'clients', path: '/ops/clients' },
  { name: 'detail', path: '/ops/clients/cli_hansol' },
]

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const problems = []
page.on('pageerror', (e) => problems.push(`[JS] ${String(e).slice(0, 120)}`))

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
await page.evaluate(seedScript())

let bodyColors = new Set()
let primaryColors = new Set()

for (const theme of THEMES) {
  for (const s of SCREENS) {
    await page.goto(`${BASE}${s.path}`, { waitUntil: 'networkidle' })
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
    await page.waitForTimeout(250)
    const probe = await page.evaluate(() => {
      const h1 = document.querySelector('main h1')
      const body = h1 ? getComputedStyle(h1).color : ''
      const primary = document.querySelector('nav[aria-label="주 메뉴"] a[aria-current="page"], button.bg-brand-600, .bg-brand-600')
      const brand = primary ? getComputedStyle(primary).backgroundColor : ''
      return { body, brand }
    })
    bodyColors.add(probe.body)
    primaryColors.add(`${theme}:${probe.brand}`)
    await page.screenshot({ path: `${OUT}/${theme}-${s.name}.png` })
  }
}
await browser.close()

if (bodyColors.size !== 1) problems.push(`[본문색] 테마에 따라 본문 글자색이 달라진다: ${[...bodyColors].join(' | ')}`)
const distinctBrand = new Set([...primaryColors].map((x) => x.split(':')[1]).filter(Boolean))
if (distinctBrand.size < 5) problems.push(`[테마색] 주요 색이 테마별로 충분히 달라지지 않는다 (${distinctBrand.size}종)`)

console.log(`테마 ${THEMES.length}종 × 화면 ${SCREENS.length} = ${THEMES.length * SCREENS.length}장 → ${OUT}`)
console.log(`본문 글자색 종류: ${bodyColors.size} (1 이어야 함) · 주요 색 종류: ${distinctBrand.size}`)
if (problems.length === 0) console.log('9 테마 문제 없음 ✅')
else for (const p of problems) console.log('  ' + p)
process.exit(problems.length > 0 ? 1 : 0)
