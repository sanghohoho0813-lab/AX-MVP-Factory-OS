/**
 * 안내 영상(D-185) 렌더 — 합성 HTML 의 render(t) 를 한 장씩 찍어 ffmpeg 로 넘긴다(가이드 v4.1 14-3).
 *
 *   node render.mjs <comp.html> --stills <폴더> <t,t,…>          — 고른 시각만 PNG 로
 *   node render.mjs <comp.html> --video <out.mp4> <voice.wav>     — 30fps · H.264 CRF 18 · AAC 192k
 *
 * 음성은 0.6초 늦게 시작하고(OFFSET), 영상 길이는 DUR(음성 + 0.6 + 2.6) 그대로 — -shortest 는 쓰지 않는다.
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const [comp, mode, out, arg] = process.argv.slice(2)
const FPS = 30
const tall = /_tall\.html$/.test(comp)
const [W, H] = tall ? [1080, 1920] : [1920, 1080]

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--force-color-profile=srgb'] })
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await page.goto('file://' + resolve(comp))
// 글꼴 · 그림(배경 그림 포함)을 다 받은 뒤에 찍는다
await page.evaluate(async () => {
  await document.fonts.ready
  const urls = new Set([...document.querySelectorAll('img')].map((i) => i.src))
  for (const el of document.querySelectorAll('[style*="url("]')) {
    const m = /url\(([^)]+)\)/.exec(el.getAttribute('style'))
    if (m) urls.add(new URL(m[1].replace(/['"]/g, ''), location.href).href)
  }
  await Promise.all([...urls].map((u) => new Promise((ok) => { const i = new Image(); i.onload = i.onerror = ok; i.src = u })))
  await Promise.all([...document.querySelectorAll('img')].map((i) => i.decode().catch(() => {})))
})
const DUR = await page.evaluate(() => window.DUR)

if (mode === '--stills') {
  mkdirSync(out, { recursive: true })
  for (const t of arg.split(',').map(Number)) {
    await page.evaluate((x) => window.render(x), t)
    await page.screenshot({ path: `${out}/t${t.toFixed(2).padStart(7, '0')}.png` })
  }
  console.log('stills', arg.split(',').length)
} else {
  const voice = arg
  const n = Math.round(DUR * FPS)
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', voice, '-filter_complex', `[1:a]adelay=600|600,apad=whole_dur=${DUR}[a]`, '-map', '0:v', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(DUR), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] })
  const t0 = Date.now()
  for (let i = 0; i < n; i++) {
    await page.evaluate((x) => window.render(x), i / FPS)
    const buf = await page.screenshot({ type: 'jpeg', quality: 94 })
    if (!ff.stdin.write(buf)) await new Promise((ok) => ff.stdin.once('drain', ok))
    if (i % 300 === 0) console.log(`${out} ${i}/${n} ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  }
  ff.stdin.end()
  await new Promise((ok, no) => ff.on('close', (c) => (c === 0 ? ok() : no(new Error('ffmpeg ' + c)))))
  console.log('done', out, DUR, `${((Date.now() - t0) / 1000).toFixed(0)}s`)
}
await browser.close()
