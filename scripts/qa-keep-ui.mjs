#!/usr/bin/env node
/**
 * D-315 꾸미기 지키기 — 대표가 저장해 둔 화면 꾸미기(칸 순서 · 숨김 · 접기 · 아래 메뉴 · 테마)가 새 개발로 풀리지 않게.
 *
 * 저장된 꾸미기는 '이름표'(칸 id · 접기 id · 메뉴 key · 테마 key)로 기억된다. 새 버전에서 이름표가 없어지거나 바뀌면
 * 그 이름표로 저장한 것이 조용히 풀린다. 그래서 지금 쓰는 이름표를 src/config/keepUiNames.json 에 적어 두고:
 *  - 적어 둔 이름표가 코드에서 사라졌는데 aliases(옛 이름 → 새 이름)에 없으면 → 실패(이름을 바꿨으면 연결을 적어야 한다).
 *  - 새 이름표가 생겼으면 → 실패(--update 로 목록에 더한다 — 더하는 것은 안전하다).
 *  - aliases 의 새 이름이 코드에 없으면 → 실패.
 *
 *   node scripts/qa-keep-ui.mjs            검사
 *   node scripts/qa-keep-ui.mjs --update   새 이름표를 목록에 더한다(사라진 것은 지우지 않는다 — 연결을 적어야 지워진다)
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const LIST = join(ROOT, 'src/config/keepUiNames.json')

function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name.startsWith('.')) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) files(p, out)
    else if (/\.(tsx?|mjs)$/.test(name)) out.push(p)
  }
  return out
}

const src = files(join(ROOT, 'src')).map((p) => ({ p, t: readFileSync(p, 'utf8') }))
const all = (re, pick = (m) => m[1]) => [...new Set(src.flatMap(({ t }) => [...t.matchAll(re)].map(pick)))].sort()

// 화면 꾸미기 — ArrangeArea page 마다 그 안의 ArrangeItem id (page:id)
const layout = []
for (const { t } of src) {
  for (const m of t.matchAll(/<ArrangeArea\s+page="([^"]+)"[\s\S]*?<\/ArrangeArea>/g)) {
    for (const it of m[0].matchAll(/<ArrangeItem\s+id="([^"]+)"/g)) layout.push(`${m[1]}:${it[1]}`)
  }
}
const now = {
  layout: [...new Set(layout)].sort(),
  // 접기 — Section fold={{ id }} · <Fold id="…"> · useFold('…') · openFold('…')
  fold: all(/(?:fold=\{\{\s*id:\s*'([^']+)'|<Fold\b[^>]*\sid="([^"]+)"|useFold\(\s*'([^']+)'|openFold\(\s*'([^']+)')/g, (m) => m[1] ?? m[2] ?? m[3] ?? m[4]),
  // 휴대폰 아래 메뉴 · 왼쪽 메뉴 — 메뉴 표 key
  nav: [...new Set([...readFileSync(join(ROOT, 'src/config/moduleRegistry.ts'), 'utf8').matchAll(/\bkey:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]))].sort(),
  // 테마 · 글자 크기(설정 › 화면에서 고른 것)
  theme: (() => {
    const t = readFileSync(join(ROOT, 'src/types/ui.ts'), 'utf8')
    const block = (name) => /type\s+NAME\s*=([^;]*?)(?:\n\s*\n|\n\/|$)/.source.replace('NAME', name)
    const vals = (name) => [...(new RegExp(block(name)).exec(t)?.[1] ?? '').matchAll(/'([a-z_-]+)'/g)].map((m) => m[1])
    return [...new Set([...vals('UiThemeKey'), ...vals('UiTextScale').map((v) => `text:${v}`)])].sort()
  })(),
}

const saved = JSON.parse(readFileSync(LIST, 'utf8'))
const kinds = ['layout', 'fold', 'nav', 'theme']
const update = process.argv.includes('--update')
let fail = 0
const say = (ok, msg) => {
  if (!ok) fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`)
}

for (const k of kinds) {
  const have = new Set(now[k])
  const list = saved.names[k] ?? []
  const alias = saved.aliases[k] ?? {}
  const gone = list.filter((n) => !have.has(n) && !(n in alias))
  say(gone.length === 0, `${k}: 저장된 꾸미기 이름표가 사라지지 않음${gone.length ? ` — 사라짐: ${gone.join(', ')} (이름을 바꿨으면 keepUiNames.json aliases.${k} 에 "옛 이름": "새 이름" 을 적으세요)` : ''}`)
  const badAlias = Object.entries(alias).filter(([, to]) => !have.has(to))
  say(badAlias.length === 0, `${k}: 연결(옛 → 새)의 새 이름이 코드에 있음${badAlias.length ? ` — 없음: ${badAlias.map(([a, b]) => `${a}→${b}`).join(', ')}` : ''}`)
  const fresh = now[k].filter((n) => !list.includes(n))
  if (update && fresh.length) saved.names[k] = [...list, ...fresh].sort()
  say(update || fresh.length === 0, `${k}: 새 이름표가 목록에 있음${fresh.length && !update ? ` — 새로 생김: ${fresh.join(', ')} (node scripts/qa-keep-ui.mjs --update)` : ''}`)
}

if (update) writeFileSync(LIST, `${JSON.stringify(saved, null, 2)}\n`)
const total = kinds.reduce((n, k) => n + now[k].length, 0)
console.log(`\nkeep-ui: 이름표 ${total}개 · ${fail ? `${fail} failed` : '0 failed'}`)
process.exit(fail ? 1 : 0)
