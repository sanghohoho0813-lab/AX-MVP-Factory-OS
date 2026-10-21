/**
 * D-253 낱말 지킴이 — OS 안(화면 글 · AI 지시문)에 '이상한AI' 같은 내부 별칭이 나오지 않게.
 * 대표: "OS 안에서는 이상한 AI 이런 단어 자체를 일절 없애 줘 — '검증된 방법' 으로 통일".
 *  - 화면: 빌드한 번들(dist/assets/*.js) 전부 — 코드 주석은 빌드 때 빠지므로 남은 것은 화면 · 복사 글 · 보내는 지시문뿐
 *  - 서버: api/ 의 .js — 주석을 걷어 낸 뒤 문자열(AI 지시문 · 화면 이름표)만
 * 쓰는 법: npm run build && npm run qa:wording
 */
import fs from 'node:fs'
import path from 'node:path'

const BAD = /이상한\s*(?:AI|에이아이|마케팅)|isanghan/gi
let pass = 0
let fail = 0
const check = (n, c, d) => {
  if (c) {
    pass++
    console.log('PASS ', n)
  } else {
    fail++
    console.log('FAIL ', n, d === undefined ? '' : JSON.stringify(d).slice(0, 600))
  }
}
const walk = (dir, ext) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p, ext)
        return ext.some((x) => e.name.endsWith(x)) ? [p] : []
      })
    : []
const hits = (files, strip) =>
  files.flatMap((f) => {
    const raw = fs.readFileSync(f, 'utf8')
    const text = strip ? strip(raw) : raw
    return [...text.matchAll(BAD)].map((m) => `${path.relative('.', f)}: …${text.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g, ' ')}…`)
  })

// 주석 걷기 — /* … */ 와 줄 끝 // …(주소의 https:// 는 남김)
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')

const bundle = walk('dist/assets', ['.js', '.css', '.html']).concat(fs.existsSync('dist/index.html') ? ['dist/index.html'] : [])
check(`W0 번들이 있음(npm run build 먼저) — 파일 ${bundle.length}개`, bundle.length > 0)
const b = hits(bundle)
check(`W1 화면 번들에 '이상한AI · 이상한 마케팅' 0곳`, b.length === 0, b.slice(0, 5))
const api = hits(walk('api', ['.js', '.mjs']), stripComments)
check(`W2 서버(AI 지시문 · 이름표)에 0곳 — 주석 제외`, api.length === 0, api.slice(0, 5))
const pub = hits(walk('public', ['.html', '.js', '.json', '.txt', '.webmanifest']))
check(`W3 public 파일에 0곳`, pub.length === 0, pub.slice(0, 5))
// 대신 쓰는 말이 실제로 남아 있는지 — 낱말만 지우고 뜻을 잃지 않게
const joined = bundle.map((f) => fs.readFileSync(f, 'utf8')).join('\n')
check(`W4 대신 '검증된 방법' 말이 화면에 있음`, joined.includes('검증된 방법'))

console.log(`\nqa:wording: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
