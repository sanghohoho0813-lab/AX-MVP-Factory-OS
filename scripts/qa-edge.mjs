#!/usr/bin/env node
/**
 * D-483 한쪽 테두리 · 한쪽 색 막대 금지(대표 2026-11-02 지시 — "사각형 모양에서 한쪽 테두리만 칠하는 건 절대 없도록").
 * 박스를 색으로 강조할 때는 네 변을 같은 색으로(src/components/ui/edge.ts 의 EDGE_BOX · EDGE_INSET) 두르거나 박스를 칠한다.
 *
 * src 의 .ts/.tsx 에서 막는 꼴:
 *  - border-l-* · border-r-* (두께 · 색 모두) — 왼쪽 · 오른쪽 한 변만
 *  - border-t-2 이상 · border-t-[..] · border-t-<색> — 위 한 변만 두껍게 · 색으로
 *  - 테두리 자리에 붙인 얇은 막대(absolute inset-y-0 left-0 + 좁은 폭, absolute inset-x-0 top-0 + 낮은 높이, before:w-1 …)
 *  - 제목 옆 세로 막대(h-3 w-1 같은 좁고 긴 칠) — 뜻 점(size-2 rounded-full)을 쓴다
 * 허용: 아래 밑줄(border-b — 글자 탭 · 인쇄 머리줄), 진행 막대(폭을 style 로 채우는 것), 서랍 · 끌기 손잡이.
 * 꼭 필요한 줄은 같은 줄에 'edge-ok' 와 까닭을 적는다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')

const RULES = [
  { name: '왼쪽 · 오른쪽 한 변 테두리', re: /(?<![\w-])border-[lr]-(?!0\b)[\w[\]#./-]+/ },
  { name: '위 한 변만 두꺼운 · 색 테두리', re: /(?<![\w-])border-t-(?:[2-9]\b|\[|(?:slate|gray|zinc|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|brand|danger|warning|success|accent|navy|cat|nav)-)/ },
  { name: '세로 막대(왼쪽 · 오른쪽 띠)', re: /absolute[^"'`]*\binset-y-[0-9][^"'`]*\b(?:left|right)-0\b[^"'`]*\bw-(?:0\.5|1|1\.5|2|\[[0-9]px\])(?![\w.[-])/ },
  { name: '가로 막대(위 · 아래 띠)', re: /absolute[^"'`]*\binset-x-[0-9][^"'`]*\b(?:top|bottom)-0\b[^"'`]*\bh-(?:0\.5|1|1\.5|2|\[[0-9]px\])(?![\w.[-])/ },
  { name: 'before/after 막대', re: /(?:before|after):w-(?:0\.5|1|1\.5|\[[0-9]px\])(?![\w.[-])/ },
  { name: '제목 옆 세로 막대', re: /\bh-(?:2\.5|3|3\.5|4|5|6)\s+w-(?:0\.5|1|1\.5|\[[0-9]px\])\b[^"'`]*rounded/ },
  { name: '글자 스타일 한 변 테두리', re: /border(?:Left|Right)\s*:\s*[`'"][2-9]px|border-(?:left|right)\s*:\s*[2-9]px|borderTop\s*:\s*[`'"][3-9]px|border-top\s*:\s*[3-9]px/ },
]
/** 고객에게 만들어 주는 홈페이지 결과물(운영 OS 화면이 아니다) — 그 디자인은 따로 정한다 */
const SKIP = [/src\/services\/siteBuilder\/render\.ts$/]

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(tsx?|jsx?|css)$/.test(name) && !/\.test\./.test(name) && !SKIP.some((r) => r.test(p))) out.push(p)
  }
  return out
}

const hits = []
for (const file of walk(SRC)) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (line.includes('edge-ok')) return
    // 주석 줄은 보지 않는다(규칙 설명에 예시로 적은 꼴)
    const t = line.trim()
    if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return
    for (const r of RULES) {
      const m = line.match(r.re)
      if (m) hits.push(`${relative(ROOT, file)}:${i + 1}  [${r.name}]  ${m[0]}`)
    }
  })
}

if (hits.length) {
  console.error(`✗ 한쪽만 칠한 테두리 · 막대 ${hits.length}곳 — 네 변을 같은 색으로(edge.ts EDGE_BOX/EDGE_INSET) 바꾸세요\n` + hits.join('\n'))
  process.exit(1)
}
console.log('✓ test:edge — 한쪽 테두리 · 한쪽 색 막대 0 (D-483)')
