/**
 * D-253 · D-264 낱말 지킴이 — OS 안(화면 글 · AI 지시문)에 내부 별칭 · 예전 점검 이름 · 출처 문서 이름이 나오지 않게.
 * 대표: "OS 안에서는 그런 단어 자체를 일절 없애 줘" — 마케팅은 '검증된 방법', 점검은 '자체점검' 으로.
 *  - 화면: 빌드한 번들(dist/assets/*.js) 전부 — 코드 주석은 빌드 때 빠지므로 남은 것은 화면 · 복사 글 · 보내는 지시문뿐
 *  - 서버: api/ 의 .js — 주석을 걷어 낸 뒤 문자열(AI 지시문 · 화면 이름표)만
 * 쓰는 법: npm run build && npm run qa:wording
 */
import fs from 'node:fs'
import path from 'node:path'

// D-264 쓰지 않는 이름 · 출처 문서 이름 — 이 파일에도 글자 그대로 두지 않는다(유니코드 번호)
const BAD = new RegExp(
  [
    '\\uC774\\uC0C1\\uD55C\\s*(?:AI|\\uC5D0\\uC774\\uC544\\uC774|\\uB9C8\\uCF00\\uD305)', // 예전 마케팅 별칭
    'is' + 'anghan',
    '\\uC545\\uB9C8', // 예전 점검 이름 앞머리
    '(?<!\\uD604)\\uD310\\uC0AC', // 예전 점검 이름 뒷머리(현판사진은 뺌)
    'Devil',
    'Master\\s*v\\d',
    'Master\\s*§',
    'AX\\s*\\uD3AD\\uADC4',
    'Judge\\s*Scorecard',
    'RED\\s+FLAG', // 화면 글(낱말 사이 빈칸) — 코드 이름(redFlags)은 화면에 안 보임
    '\\uBCA4\\uCC98\\s*\\uC694\\uAD6C\\uC0AC\\uD56D\\s*v\\d',
  ].join('|'),
  'gi',
)
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
check(`W1 화면 번들에 쓰지 않는 이름 · 출처 문서 이름 0곳`, b.length === 0, b.slice(0, 5))
const api = hits(walk('api', ['.js', '.mjs']), stripComments)
check(`W2 서버(AI 지시문 · 이름표)에 0곳 — 주석 제외`, api.length === 0, api.slice(0, 5))
const pub = hits(walk('public', ['.html', '.js', '.json', '.txt', '.webmanifest']))
check(`W3 public 파일에 0곳`, pub.length === 0, pub.slice(0, 5))
// 대신 쓰는 말이 실제로 남아 있는지 — 낱말만 지우고 뜻을 잃지 않게
const joined = bundle.map((f) => fs.readFileSync(f, 'utf8')).join('\n')
check(`W4 대신 '검증된 방법' 말이 화면에 있음`, joined.includes('검증된 방법'))

console.log(`\nqa:wording: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
