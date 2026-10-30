import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'
const [BASE, OUT, ...paths] = process.argv.slice(2)
const b = await chromium.launch()
for (const vp of [{ t: '1440', width: 1440, height: 900 }, { t: '390', width: 390, height: 844 }]) {
  const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.width < 768, hasTouch: vp.width < 768 })
  const page = await ctx.newPage()
  await page.goto(BASE + '/'); await page.evaluate(seedScript()); await page.evaluate(() => localStorage.removeItem('axmvp.fold.all'))
  for (const p of paths) {
    await page.goto(BASE + p, { waitUntil: 'networkidle' }); await page.waitForTimeout(900)
    const name = p.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)
    await page.screenshot({ path: `${OUT}/${name}-${vp.t}.png`, fullPage: true })
    console.log(vp.t, p, (await page.evaluate(() => document.documentElement.scrollHeight / innerHeight)).toFixed(1))
  }
  await ctx.close()
}
await b.close()
