/**
 * D-273 마케팅 기준 묶음 만들기 — 대표가 전달한 docx 두 개(SNS 공식 통합본 · 유튜브 롱폼 공식)에서 채널마다 필요한 장만 뽑아 api/_ai/mkKnowledge.js 로.
 *
 *   node scripts/build-mk-knowledge.mjs <SNS 통합본.docx> <유튜브 롱폼 공식.docx>
 *
 * 원본 파일은 저장소에 넣지 않는다(대표 PC · 대화에 올린 파일). 뽑은 장은 서버 함수(api/)에서만 쓰고 브라우저 번들에는 들어가지 않는다.
 * 표는 줄마다 '칸 | 칸' 으로 편다. 장은 줄 번호가 아니라 머리글로 찾는다 — 원본이 고쳐져도 같은 장을 다시 뽑는다.
 * 남의 계정 이름 · 참고한 외부 방법 이름 · 원본 파일 경로는 뺀다(D-264 · CLAUDE.md).
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { sanitizeKnowledge } from '../api/_ai/guard.js'

const [snsPath, longPath] = process.argv.slice(2)
if (!snsPath || !longPath) {
  console.error('사용법: node scripts/build-mk-knowledge.mjs <SNS 통합본.docx> <유튜브 롱폼 공식.docx>')
  process.exit(1)
}

const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
const textOf = (xml) => unescape(xml.replace(/<w:tab\/>/g, ' ').replace(/<w:br[^>]*\/>/g, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

/** docx → 줄(문단 한 줄 · 표는 행마다 '칸 | 칸') */
function docxLines(path) {
  const xml = execFileSync('unzip', ['-p', path, 'word/document.xml'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8')
  const body = xml.slice(xml.indexOf('<w:body>'), xml.lastIndexOf('</w:body>'))
  const out = []
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g
  for (const m of body.matchAll(re)) {
    const block = m[0]
    if (block.startsWith('<w:tbl>')) {
      for (const row of block.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? []) {
        const cells = (row.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? []).map((c) => (c.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).map(textOf).filter(Boolean).join(' / '))
        if (cells.some(Boolean)) out.push(cells.join(' | '))
      }
    } else {
      const t = textOf(block)
      out.push(t)
    }
  }
  return out
}

/** 머리글 줄(이 글로 시작)부터 다음 머리글 앞까지 — from 번째(0부터) 나온 것 */
function between(lines, startHead, endHead, label, from = 0) {
  let a = -1
  for (let i = 0, seen = 0; i < lines.length; i++) {
    if (lines[i].startsWith(startHead)) {
      if (seen === from) {
        a = i
        break
      }
      seen++
    }
  }
  if (a < 0) throw new Error(`${label}: 시작 머리글을 찾지 못함 — ${startHead}`)
  const b = lines.findIndex((l, i) => i > a && l.startsWith(endHead))
  if (b < 0) throw new Error(`${label}: 끝 머리글을 찾지 못함 — ${endHead}`)
  return lines.slice(a, b).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/*
 * 참고한 외부 방법 · 남의 계정 · 파일 이름은 빼고 '예전 공식' 처럼 일반 말로(쓰지 않는 이름은 guard 가 한 번 더 지운다).
 */
const SCRUB = [
  [/\(\s*이상한\s*AI\s*·\s*자청\s*\)/g, ''],
  [/이상한\s*AI\s*·\s*자청\s*·?\s*(?:김팀장\s*)?(?:대본\s*가이드\s*)?(?:V1\.8)?/g, '예전 공식'],
  [/이상한\s*AI\s*(?:유튜브|릴스|쇼츠)?\s*(?:도구\s*)?(?:공식|기준|도구)?(?:\s*\(규칙집\s*[\d-]+\))?(?:\s*\(?\d+~\d+차\)?)?/g, '예전 공식'],
  [/자청\s*공식\s*중\s*/g, '예전 공식 가운데 '],
  [/자청\s*(?:릴스\s*)?(?:강의\s*)?(?:공식)?\s*(?:\(\d차\))?/g, ''],
  [/표본이론/g, '표본(누구나 볼 주제) 원칙'],
  [/쓰레드나이스/g, '자동 발행 도구'],
  [/\(Mosseri[^)]*\)/g, ''],
  [/Vista Social, Postory, Joltsage/g, '2차 자료'],
  [/@[A-Za-z0-9_.]+/g, '[계정]'],
  [/[A-Za-z]:\\[^\s)]*/g, ''],
  // 문서 안 폴더 경로(배포자료\체크리스트_카드\ 처럼) — 우리 저장 위치는 밖으로 내지 않는다
  [/\(?[\w가-힣_-]+\\(?:[\w가-힣_*.-]+\\?)*\)?/g, ''],
  [/[\w가-힣._-]+\.(?:md|csv|jsonl|js|py|docx|txt)\b/g, ''],
  [/\s*〔[^〕]*〕/g, ''],
  [/\s*⟲\s*\d+차/g, ''],
]
const scrub = (s) => SCRUB.reduce((acc, [re, rep]) => acc.replace(re, rep), s).replace(/[ \t]{2,}/g, ' ').replace(/\(\s*\)/g, '')

const sns = docxLines(snsPath)
const long = docxLines(longPath)

const PACKS = {
  /** 네 플랫폼 공통 — 법칙 10가지 · 플랫폼별 길이 · 형식 표 · 우리 분야 경고 · 예전 공식에서 바꾼 것 */
  mk_common: [['네 플랫폼 공통 법칙', between(sns, '0-2. 네 플랫폼에서 똑같이 나온 법칙 10가지', '0-3. 김팀장이 바로 쓸 것', 'mk_common')]],
  /** 스레드 — Meta 가 보는 것 · 반응별 틀 · 틀 A~H · 쓰는 순서 · AI 에 붙일 틀 + 틀 라이브러리(23가지 · 카드 · 첫 줄 · 끝 · 4주 운영) */
  mk_threads: [
    ['스레드 공식', between(sns, '0. 결론', '5. 김팀장 계정 진단 (실측)', 'mk_threads/formula', 0)],
    ['스레드 AI 틀', between(sns, '9. AI에게 스레드 글을 시킬 때 붙일 틀', '부록. 근거와 한계', 'mk_threads/ai')],
    ['스레드 틀 라이브러리', between(sns, '0. 결론', '7. 데이터는 이렇게 쌓입니다', 'mk_threads/library', 1)],
  ],
  /** 틱톡 · 쇼츠 · 릴스 — 결론 · 업그레이드 공식 · 댓글형 조건 · 세 채널 공통 법칙 · 대본 예시 */
  mk_short: [
    ['숏폼 결론', between(sns, '0. 결론', '1. 숫자로 본 승·패', 'mk_short/conclusion', 2)],
    ['숏폼 공식', between(sns, '3. 업그레이드된 숏폼 공식 (김팀장용)', '6. 규칙집에 반영한 것', 'mk_short/formula')],
  ],
  /** 유튜브 롱폼 — 결론 · 작은 채널 공통점 · 업그레이드 공식 · 기획 예시 */
  mk_long: [
    ['롱폼 결론', between(long, '0. 결론', '1. 숫자로 본 승·패', 'mk_long/conclusion')],
    ['작은 채널에서 터진 영상 공통점', between(long, '14개에서 공통으로 보인 것', '3. 기존 공식 판정표', 'mk_long/small')],
    ['롱폼 공식 · 기획 예시', between(long, '4. 업그레이드된 롱폼 공식 (김팀장용)', '6. 규칙집에 반영한 것', 'mk_long/formula')],
  ],
  /** 김팀장 사실 목록 · 넣지 말 것 — 모든 마케팅 글이 이 사실만 쓴다 */
  mk_facts: [['사실 목록 · 넣지 말 것', between(sns, '5. 김팀장 사실 목록 (이것만 씀)', '7. 리포트 형식', 'mk_facts')]],
}

const out = {}
const meta = {}
for (const [key, parts] of Object.entries(PACKS)) {
  out[key] = sanitizeKnowledge(scrub(parts.map(([, body]) => body).join('\n\n')))
  meta[key] = { parts: parts.map(([t]) => t), chars: out[key].length }
}

const header = `/**
 * D-273 마케팅 기준 묶음 — 대표가 전달한 docx(SNS 공식 통합본 · 유튜브 롱폼 공식)에서 채널마다 필요한 장만 뽑은 것
 * (scripts/build-mk-knowledge.mjs 가 만든다 · 손으로 고치지 않는다). 서버 함수(api/)에서만 쓴다 — 브라우저 번들에 들어가지 않는다.
 * 원본 docx 는 저장소에 넣지 않는다. 남의 계정 이름 · 참고한 외부 방법 이름 · 파일 경로는 뺀 채로 둔다.
 */

`
const body = `export const MK_KNOWLEDGE_META = ${JSON.stringify(meta, null, 2)}\n\nexport const MK_KNOWLEDGE = ${JSON.stringify(out, null, 2)}\n`
writeFileSync(new URL('../api/_ai/mkKnowledge.js', import.meta.url), header + body)
for (const [k, m] of Object.entries(meta)) console.log(`${k}: ${m.chars.toLocaleString()}자 · ${m.parts.join(' + ')}`)
