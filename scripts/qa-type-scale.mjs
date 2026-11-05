#!/usr/bin/env node
/**
 * U1(§10 UI 개편 · 2026-11-05) 글자 크기는 여섯 단계만 — 14 · 15 · 16 · 19.2px · 큰 숫자 · 화면 제목(src/index.css 타이포그래피 머리 글).
 * U1 에서 사이 크기(0.85 · 0.88 · 0.9 · 0.92 · 0.95 · 0.98 · 1.02 · 1.05 · 1.1 · 1.15 · 1.25 · 1.3rem)를 가까운 단계로 모았다.
 * 다시 쓰면 화면마다 글자 크기가 들쭉날쭉해진다(qa:firstscreen 의 '글자 크기 종류' 가 늘어난다) — 여기서 먼저 막는다.
 * 단계: text-[0.875rem] · text-[0.9375rem] · text-[1rem] · text-[1.2rem] · .t-meta · .t-sub · .t-body · .t-card · .t-section · .t-num · .t-page
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')
const BANNED = /(?<![\w-])(?:[a-z]+:)*text-\[(0\.85|0\.88|0\.9|0\.92|0\.95|0\.98|1\.02|1\.05|1\.1|1\.15|1\.25|1\.3)rem\]/g
/** 고객에게 만들어 주는 홈페이지 결과물(운영 OS 화면이 아니다) — 그 디자인은 따로 정한다 */
const SKIP = [/src\/services\/siteBuilder\/render\.ts$/]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name) && !p.includes('__tests__') && !SKIP.some((r) => r.test(p))) out.push(p)
  }
  return out
}

const hits = []
for (const f of walk(SRC)) {
  readFileSync(f, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const m of line.matchAll(BANNED)) hits.push(`${relative(ROOT, f)}:${i + 1}  ${m[0]}`)
    })
}

// .t-card 는 본문과 같은 16px(굵기로 가른다)
const css = readFileSync(join(SRC, 'index.css'), 'utf8')
const card = /\.t-card\s*\{[^}]*font-size:\s*([0-9.]+rem)/.exec(css)?.[1]
const checks = [
  ['사이 글자 크기(text-[0.9rem] 같은 것) 0곳', hits.length === 0, hits.slice(0, 20).join('\n')],
  ['.t-card = 1rem(본문과 같은 크기)', card === '1rem', card],
]
let fail = 0
for (const [name, ok, detail] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n${detail}`}`)
  if (!ok) fail += 1
}
console.log(`\ntype-scale: ${checks.length - fail} passed, ${fail} failed${hits.length ? ` — 사이 크기 ${hits.length}곳: 가까운 단계(0.875 · 0.9375 · 1 · 1.2rem)로` : ''}`)
process.exit(fail ? 1 : 0)
