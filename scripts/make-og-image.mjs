/**
 * D-595 링크 미리보기 그림 만들기 — 주소를 카카오톡 · 문자로 보냈을 때 카드에 뜨는 그림(1200×630).
 *
 *   node scripts/make-og-image.mjs [글꼴 폴더]
 *
 * 만드는 것: public/og-image.png. 제품 이름 · 한 줄 소개를 바꾸면 아래 글을 고치고 다시 돌린다
 * (브라우저로 그려 PNG 로 저장 — 다른 도구 필요 없음).
 * 글꼴 폴더(선택): Pretendard-ExtraBold/SemiBold/Medium.woff2 가 든 폴더(공개 글꼴 · OFL). 없으면 기계에 있는 글꼴로 그린다.
 * 글꼴 파일은 저장소에 넣지 않는다 — 그림만 넣는다.
 */
import { chromium } from 'playwright'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const W = 1200
const H = 630
const OUT = 'public/og-image.png'
const NAME = 'MIRAE AI LAB OS'
const HEAD = ['컨설턴트의 하루를', '한 화면에서']
const SUB = '고객 · 서류 · 일정 · 마케팅을 한곳에서 챙기는 업무 프로그램'

const fontDir = process.argv[2]
const face = (weight, file) => {
  const p = fontDir ? join(fontDir, file) : ''
  if (!p || !existsSync(p)) return ''
  return `@font-face{font-family:'OgSans';font-weight:${weight};src:url(data:font/woff2;base64,${readFileSync(p).toString('base64')}) format('woff2');}`
}
const fonts = [face(800, 'Pretendard-ExtraBold.woff2'), face(600, 'Pretendard-SemiBold.woff2'), face(500, 'Pretendard-Medium.woff2')].join('')
const logo = `data:image/png;base64,${readFileSync('public/brand/mirae-ai-lab-logo-light.png').toString('base64')}`

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
${fonts}
*{box-sizing:border-box;margin:0;padding:0}
body{width:${W}px;height:${H}px;overflow:hidden;background:#0b1326;color:#fff;font-family:'OgSans','Pretendard','Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif}
.wrap{position:absolute;inset:0;padding:72px 96px;display:flex;flex-direction:column;justify-content:space-between}
.logo{height:84px;width:auto;align-self:flex-start;margin-left:-10px}
h1{font-size:84px;line-height:1.16;font-weight:800;letter-spacing:-0.02em}
p{margin-top:26px;font-size:32px;line-height:1.4;font-weight:500;color:#c3cbdb;letter-spacing:-0.01em}
.foot{display:flex;align-items:center;gap:18px;font-size:26px;font-weight:600;letter-spacing:0.14em;color:#8fa0bd}
.dot{width:12px;height:12px;border-radius:999px;background:#22c6e8}
</style></head><body><div class="wrap">
<img class="logo" src="${logo}" alt="">
<div><h1>${HEAD.join('<br>')}</h1><p>${SUB}</p></div>
<div class="foot"><span class="dot"></span><span>${NAME}</span></div>
</div></body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: W, height: H }, type: 'png' })
await browser.close()
console.log('만듦', OUT, `${W}x${H}`, fonts ? '(고른 글꼴)' : '(기계 글꼴)')
