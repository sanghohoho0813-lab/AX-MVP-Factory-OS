/**
 * 컨설팅 작업실 스크린샷 6장 — 보고용 (최대 6장 규칙).
 *   node e2e/studio-shots.mjs <baseUrl> <outDir>
 */

import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { seedScript, SEED_PROJECT_ID } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const OUT = process.argv[3] ?? 'docs/qa/studio'
mkdirSync(OUT, { recursive: true })

const SHOTS = [
  { file: '01-studio-list-1440.png', path: '/studio', width: 1440, mobile: false },
  { file: '02-overview-1440.png', path: `/studio/${SEED_PROJECT_ID}`, width: 1440, mobile: false },
  { file: '03-overview-390.png', path: `/studio/${SEED_PROJECT_ID}`, width: 390, mobile: true },
  { file: '04-stages-390.png', path: `/studio/${SEED_PROJECT_ID}?tab=stages&focus=S3`, width: 390, mobile: true },
  { file: '05-prompts-1440.png', path: `/studio/${SEED_PROJECT_ID}?tab=prompts&focus=PATENT_IDEA`, width: 1440, mobile: false },
  { file: '06-factsheet-390.png', path: `/studio/${SEED_PROJECT_ID}?tab=factsheet`, width: 390, mobile: true },
]

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const s of SHOTS) {
  const ctx = await browser.newContext({ viewport: { width: s.width, height: s.mobile ? 844 : 900 }, deviceScaleFactor: s.mobile ? 2 : 1, isMobile: s.mobile, hasTouch: s.mobile })
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.evaluate(seedScript())
  await page.goto(BASE + s.path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/${s.file}`, fullPage: false })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  console.log(`${s.file} ${s.width}px overflow=${overflow}`)
  await ctx.close()
}
await browser.close()
