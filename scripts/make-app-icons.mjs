/**
 * D-587 홈 화면 아이콘 만들기 — favicon 과 같은 마크를 모서리 없이 꽉 찬 네모로(휴대폰이 알아서 둥글게 깎는다).
 *
 *   node scripts/make-app-icons.mjs
 *
 * 만드는 것: public/apple-touch-icon.png(180) · public/icons/app-192.png · public/icons/app-512.png
 * 마크를 바꾸면 이 파일의 SVG 를 고치고 다시 돌린다(브라우저로 그려 PNG 로 저장 — 다른 도구 필요 없음).
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">
  <rect width="32" height="32" fill="#08323A" />
  <path d="M7 24V8h4.2l4.8 8.2L20.8 8H25v16h-3.6v-9.6l-5.4 8.8-5.4-8.8V24Z" fill="#FFFFFF" />
  <path d="M20.8 8H25v16h-3.6v-9.6L16 22.6V16.2Z" fill="#22C6E8" />
  <circle cx="8.4" cy="22.4" r="2" fill="#22C6E8" />
</svg>`

const OUT = [
  { size: 180, path: 'public/apple-touch-icon.png' },
  { size: 192, path: 'public/icons/app-192.png' },
  { size: 512, path: 'public/icons/app-512.png' },
]

mkdirSync('public/icons', { recursive: true })
const browser = await chromium.launch()
for (const { size, path } of OUT) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  await page.setContent(`<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;overflow:hidden">${SVG}</body></html>`)
  await page.screenshot({ path, clip: { x: 0, y: 0, width: size, height: size } })
  await page.close()
  console.log('만듦', path, `${size}x${size}`)
}
await browser.close()
