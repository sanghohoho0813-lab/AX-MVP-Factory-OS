#!/usr/bin/env node
/**
 * 받는 양 재기 — 빌드한 폴더에서 '이 화면을 띄우려면 꼭 같이 받아야 하는 조각'(정적 import 로 이어진 것)의 수와 압축 크기를 센다.
 *
 *   npm run build && node scripts/chunk-weight.mjs dist            (로컬 방식 빌드)
 *   node scripts/chunk-weight.mjs dist-qa-pilot                     (로그인 방식 빌드 — qa:pilot 이 만든 폴더)
 *
 * 브라우저를 띄우지 않는다(파일만 읽는다). 숫자는 gzip 기준 — 실제 서버(브로틀리)보다 조금 크게 나온다.
 * 필요할 때 받는 조각(동적 import)은 세지 않는다 — 그래서 '첫 화면을 막는 양' 을 본다.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const root = process.argv[2] ?? 'dist'
const DIR = `${root}/assets/`
if (!existsSync(DIR)) {
  console.error(`폴더가 없습니다: ${DIR} — 먼저 빌드하세요(npm run build).`)
  process.exit(1)
}
const files = readdirSync(DIR).filter((f) => f.endsWith('.js'))
const src = Object.fromEntries(files.map((f) => [f, readFileSync(DIR + f, 'utf8')]))
const gz = Object.fromEntries(files.map((f) => [f, gzipSync(src[f]).length]))
const deps = {}
for (const f of files) {
  const s = new Set()
  for (const m of src[f].matchAll(/\bfrom\s*["']\.\/([^"']+\.js)["']/g)) s.add(m[1])
  for (const m of src[f].matchAll(/(?:^|[;\n}])\s*import\s*["']\.\/([^"']+\.js)["']/g)) s.add(m[1])
  deps[f] = [...s].filter((x) => src[x] !== undefined)
}
const find = (re) => files.filter((f) => re.test(f))
const short = (f) => f.replace(/-[\w-]{8}\.js$/, '')
const closure = (roots) => {
  const seen = new Set()
  const st = [...roots]
  while (st.length) {
    const f = st.pop()
    if (seen.has(f)) continue
    seen.add(f)
    for (const d of deps[f] ?? []) st.push(d)
  }
  return seen
}
const kb = (set) => Math.round([...set].reduce((a, f) => a + gz[f], 0) / 1024)
let have = new Set()
let total = 0
function step(label, re, { keep = true } = {}) {
  const roots = find(re)
  if (roots.length === 0) return null
  const extra = new Set([...closure(roots)].filter((f) => !have.has(f)))
  const top = [...extra].sort((a, b) => gz[b] - gz[a]).slice(0, 8).map((f) => `${short(f)} ${Math.round(gz[f] / 1024)}`)
  console.log(`${label.padEnd(26)} 조각 ${String(extra.size).padStart(3)}개 · 압축 ${String(kb(extra)).padStart(4)}KB   ${top.join(' · ')}`)
  if (keep) {
    total += kb(extra)
    have = new Set([...have, ...extra])
  }
  return extra
}

console.log(`받는 양(${root}) — 위에서부터 차례로 더 받는 것\n`)
step('첫 조각', /^index-/)
const cloud = find(/^SupabaseApp-/).length > 0
if (cloud) step('로그인 화면까지', /^SupabaseApp-/)
else step('앱 틀(로컬 방식)', /^LocalApp-/)
console.log(`${'  ↳ 여기까지'.padEnd(26)} 압축 ${total}KB${cloud ? ' (로그인 화면)' : ''}`)
step('앱 뼈대(메뉴 · 머리줄)', /^AppShell-/)
console.log(`${'  ↳ 여기까지'.padEnd(26)} 압축 ${total}KB (어느 화면이든 로그인 뒤 꼭 받는 양)\n`)
const base = total
for (const [label, re] of [
  ['오늘', /^TodayCommandCenterPage-/],
  ['고객 관리', /^OperationsHubPage-/],
  ['일정', /^OpsCalendarPage-/],
  ['스레드', /^ThreadsPage-/],
  ['사용법 안내', /^GuidePage-/],
  ['설정', /^SettingsPage-/],
]) {
  const extra = step(`+ ${label} 화면`, re, { keep: false })
  if (extra) console.log(`${'  ↳ 이 화면이 첫 화면이면'.padEnd(26)} 압축 ${base + kb(extra)}KB`)
}
