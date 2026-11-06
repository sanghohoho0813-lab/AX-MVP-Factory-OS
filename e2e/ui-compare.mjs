/**
 * qa:uicompare — qa:uiaudit 두 번(전 · 후)의 결과를 나란히 놓은 사진 + 숫자 표. 읽기만 한다.
 *
 *   node e2e/ui-compare.mjs <전 폴더> <후 폴더> <내보낼 폴더> [PC:sales phone:client-work …]
 *
 * 화면을 고르지 않으면 숫자가 달라진 화면을 전부 고른다.
 * <내보낼 폴더>/compare-<PC|phone>-<이름>.png · table.md(바뀐 화면 표 · 합계) 를 만든다.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const [BEFORE, AFTER, OUT, ...picks] = process.argv.slice(2)
if (!BEFORE || !AFTER || !OUT) {
  console.log('쓰는 법: node e2e/ui-compare.mjs <전 폴더> <후 폴더> <내보낼 폴더> [PC:sales …]')
  process.exit(2)
}
mkdirSync(OUT, { recursive: true })
const load = (dir) => new Map(JSON.parse(readFileSync(`${dir}/audit.json`, 'utf8')).rows.map((r) => [`${r.vp}:${r.slug}`, r]))
const before = load(BEFORE)
const after = load(AFTER)

const METRICS = [
  ['screens', '첫 화면 길이(화면 수)'],
  ['fontKinds', '글자 크기 종류'],
  ['nested', '상자 안 상자'],
  ['smallTaps', '휴대폰 40px 미만 단추'],
  ['filled', '첫 화면 칠한 단추'],
  ['tinyText', '12px 미만 글자'],
  ['overflow', '가로 넘침 px'],
  ['errors', '화면 오류'],
]
const changed = [...after.keys()].filter((k) => before.has(k) && METRICS.some(([m]) => before.get(k)[m] !== after.get(k)[m]))
const keys = picks.length ? picks.filter((k) => after.has(k) && before.has(k)) : changed

// 표 — 바뀐 화면 · 합계
const lines = ['| 화면 | 바뀐 숫자(전 → 후) |', '|---|---|']
for (const k of changed) {
  const b = before.get(k)
  const a = after.get(k)
  const diff = METRICS.filter(([m]) => b[m] !== a[m]).map(([m, label]) => `${label} ${b[m]} → ${a[m]}`)
  lines.push(`| ${k.startsWith('PC') ? 'PC' : '휴대폰'} ${a.name} | ${diff.join(' · ')} |`)
}
const sum = (map, vp, m) => [...map.values()].filter((r) => r.vp === vp).reduce((s, r) => s + (Number(r[m]) || 0), 0)
const over6 = (map, vp) => [...map.values()].filter((r) => r.vp === vp && r.fontKinds > 6).length
lines.push('', '| 합계(31화면) | PC 전 → 후 | 휴대폰 전 → 후 |', '|---|---|---|')
for (const [m, label] of METRICS.filter(([m]) => m !== 'screens' && m !== 'overflow')) lines.push(`| ${label} | ${sum(before, 'PC', m)} → ${sum(after, 'PC', m)} | ${sum(before, 'phone', m)} → ${sum(after, 'phone', m)} |`)
lines.push(`| 글자 크기 6종 넘는 화면 | ${over6(before, 'PC')} → ${over6(after, 'PC')} | ${over6(before, 'phone')} → ${over6(after, 'phone')} |`)
writeFileSync(`${OUT}/table.md`, lines.join('\n') + '\n')
console.log(lines.join('\n'))

// 나란히 사진
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
for (const k of keys) {
  const b = before.get(k)
  const a = after.get(k)
  const phone = b.vp === 'phone'
  const img = (dir, file) => `data:image/png;base64,${readFileSync(`${dir}/${file}`).toString('base64')}`
  const chips = METRICS.filter(([m]) => b[m] !== a[m])
    .map(([m, label]) => {
      const better = Number(a[m]) < Number(b[m])
      return `<span class="chip ${better ? 'good' : 'bad'}">${esc(label)} <b>${esc(b[m])} → ${esc(a[m])}</b></span>`
    })
    .join('')
  const w = phone ? 390 : 760
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:24px;font-family:'Noto Sans KR','Apple SD Gothic Neo',sans-serif;background:#fff;color:#0f172a;width:max-content}
    h1{font-size:22px;margin:0 0 6px} .chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}
    .chip{font-size:14px;border:1px solid #cbd5e1;border-radius:999px;padding:3px 10px;color:#334155}
    .chip.good b{color:#1d4ed8} .chip.bad b{color:#b91c1c}
    .row{display:flex;gap:20px;align-items:flex-start} figure{margin:0} figcaption{font-size:16px;font-weight:700;margin:0 0 6px}
    img{display:block;width:${w}px;border:1px solid #cbd5e1;border-radius:8px}
  </style>
  <h1>${phone ? '휴대폰 390' : 'PC 1440'} · ${esc(a.name)} <span style="font-weight:400;color:#64748b;font-size:15px">${esc(a.path)}</span></h1>
  <div class="chips">${chips || '<span class="chip">숫자 같음</span>'}</div>
  <div class="row"><figure><figcaption>전</figcaption><img src="${img(BEFORE, b.file)}"></figure><figure><figcaption>후</figcaption><img src="${img(AFTER, a.file)}"></figure></div>`)
  await page.waitForLoadState('load')
  const file = `${OUT}/compare-${b.vp}-${b.slug}.png`
  await page.locator('body').screenshot({ path: file })
  console.log('사진', file)
}
await browser.close()
