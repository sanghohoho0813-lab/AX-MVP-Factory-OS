/**
 * D-252 AI 기준 문서 묶음 만들기 — 대표가 전달한 MD 원본에서 업무마다 필요한 장만 뽑아 api/_ai/knowledge.js 로.
 *
 *   node scripts/build-ai-knowledge.mjs <내부 기준 문서.md> <AX 기준 문서.md> <내부 기준 문서.md>   — 전부 다시
 *   node scripts/build-ai-knowledge.mjs --ax <AX 기준 문서.md>                                     — AX 기준에서 뽑는 묶음만(D-625)
 *   node scripts/build-ai-knowledge.mjs --plan <설계 기준 문서.md> <특허 · 벤처 기준 문서.md>          — 기획 대화가 쓰는 묶음만(D-626)
 *
 * 원본 파일은 저장소에 넣지 않는다(대표 PC · 대화에 올린 파일). 뽑은 장은 서버 함수(api/)에서만 쓰고 브라우저 번들에는 들어가지 않는다.
 * 장은 줄 번호가 아니라 머리글로 찾는다 — 원본이 고쳐져도 같은 장을 다시 뽑는다.
 *
 * D-626 '--plan' — 기획 대화(이어서 묻기 · 자체점검 · 기획서 판 · 개발 프롬프트)가 쓰는 묶음(plan_* · ip_route)만 다시 만들고 나머지는 그대로 둔다.
 * D-625 '--ax' — AX 기준 문서만 새로 받았을 때. AX 기준에서 뽑는 묶음(ax_*)만 다시 만들고 나머지는 지금 knowledge.js 그대로 둔다.
 *   특허 아이디어 묶음은 AX 기준의 4~8장을 같이 쓰므로, 그 부분이 지금 것과 한 글자라도 다르면 멈추고 세 파일로 다시 만들라고 알린다.
 * D-625 AX 기준(통합본)에서 새로 뽑는 것: 맨 앞 '우선 원칙' 요약 · 부록 A~G(필수 개정 원칙 · 증거 등급 · 게이트 · 출력 계약 · 정합성) · 영업용 4장 퀵진단.
 *   부록 H(개발 데이터 · QA 수락 기준)와 14장 이후(운영 OS 데이터 모델 · 구현 로드맵)는 개발 문서라 보내지 않는다.
 *   실제 다른 고객사 이름은 '사례 A · 사례 B' 로, 내부 명령 이름은 하는 일 이름으로 바꾼 뒤 넣는다(모델이 다른 업체 답에 옮겨 쓰지 않게).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { hasBanned, sanitizeKnowledge } from '../api/_ai/guard.js'

const args = process.argv.slice(2)
const AX_ONLY = args[0] === '--ax'
const PLAN_ONLY = args[0] === '--plan'
const [masterPath, penguinPath, venturePath] = AX_ONLY ? [null, args[1], null] : PLAN_ONLY ? [null, null, null] : args
const [designPath, ipPath] = PLAN_ONLY ? [args[1], args[2]] : [null, null]
if (PLAN_ONLY ? !designPath || !ipPath : AX_ONLY ? !penguinPath : !masterPath || !penguinPath || !venturePath) {
  console.error('사용법: node scripts/build-ai-knowledge.mjs <기준 MD 1> <기준 MD 2> <기준 MD 3>\n       node scripts/build-ai-knowledge.mjs --ax <AX 기준 MD>\n       node scripts/build-ai-knowledge.mjs --plan <설계 기준 MD> <특허 · 벤처 기준 MD>')
  process.exit(1)
}

const read = (p) => readFileSync(p, 'utf8').replace(/\r\n?/g, '\n')
const penguin = PLAN_ONLY ? '' : read(penguinPath)
const master = AX_ONLY || PLAN_ONLY ? '' : read(masterPath)
const venture = AX_ONLY || PLAN_ONLY ? '' : read(venturePath)
const design = PLAN_ONLY ? read(designPath) : ''
const ipDoc = PLAN_ONLY ? read(ipPath) : ''

/** 머리글 줄(정확히 이 글로 시작)부터 다음 머리글 앞까지 */
function between(text, startHead, endHead, label) {
  const lines = text.split('\n')
  const a = lines.findIndex((l) => l.startsWith(startHead))
  if (a < 0) throw new Error(`${label}: 시작 머리글을 찾지 못함 — ${startHead}`)
  const b = lines.findIndex((l, i) => i > a && l.startsWith(endHead))
  if (b < 0) throw new Error(`${label}: 끝 머리글을 찾지 못함 — ${endHead}`)
  return lines
    .slice(a, b)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^---\s*$/gm, '')
    .trim()
}

/*
 * D-625 다른 고객사 이름 · 내부 명령 이름 바꾸기 — 이름은 이 파일에도 글자 그대로 두지 않는다(유니코드 번호 · 글자 번호로만, guard.js 와 같은 방식).
 */
const PG = '\uD3AD\uADC4' // 내부 명령 이름의 뒷말
const CLIENT_A = '\uD558\uB098\uC815\uBCF4\uD1B5\uC2E0'
const CLIENT_B = '\x4B\x50\x4A\x4B'
const CLIENT_B_SUFFIX = '\uCF54\uD37C\uB808\uC774\uC158'
const STEP_NAME = { '': '정밀 분석', 2: '퀵진단', 3: '상세 제안' }
const RENAMES = [
  // 단계 이름 + 괄호 설명이 한 묶음으로 따옴표 안에 든 것(다음 단계 넘기기 줄)
  [new RegExp(`\`/AX${PG}([23]?)\\s*\\(([^)\`]*)\\)\``, 'g'), (_, n, what) => `${STEP_NAME[n]}(${what})`],
  [new RegExp(`${CLIENT_B}\\s*${CLIENT_B_SUFFIX}`, 'g'), '사례 B 기업'],
  [new RegExp(CLIENT_B, 'g'), '사례 B'],
  [new RegExp(CLIENT_A, 'g'), '사례 A'],
  [new RegExp(`\`?/AX${PG}2\`?`, 'g'), '퀵진단(4장)'],
  [new RegExp(`\`?/AX${PG}3\`?`, 'g'), '상세 제안 단계'],
  [new RegExp(`\`?/AX${PG}(\\s+(?:audit|evidence|coach|judge|roadmap|build))?\`?`, 'g'), (_, mode) => (mode ? `정밀 분석(${mode.trim()})` : '정밀 분석')],
  [new RegExp(`AX${PG}2`, 'g'), '퀵진단'],
  // 신용보증기금 창업기업 보증의 별칭 — 낱말이 내부 명령 이름과 같아 쉬운 말로
  [new RegExp(`신보\\s*'${PG}'\\s*보증`, 'g'), '신보 창업기업 우대 보증'],
  // 사례 기업 화면에서 쓰던 내부 약어 — 그 회사를 알아볼 수 있어 일반 말로
  [/'SO·DE'와 같은 /g, ''],
  [/불명확한 SO\/DE 약어/g, '불명확한 내부 약어'],
]
/** 원본 파일 이름이 든 줄(…​.md) · 인터넷 주소 줄은 뺀다(고시 · 기관 이름은 글로 남아 있다) */
const anonymize = (text) => {
  let out = text
    .split('\n')
    .filter((l) => !/\.md\b/.test(l) && !/https?:\/\//.test(l))
    .join('\n')
  for (const [re, rep] of RENAMES) out = out.replace(re, rep)
  return out
}

/* ------------------------------------------------------------------ */
/* AX 기준에서 뽑는 묶음                                                  */
/* ------------------------------------------------------------------ */

const axPacks = PLAN_ONLY ? {} : {
  /**
   * D-272 AI 전략실 [AX 전략 분석] · [AX 아이템 발굴] · [MVP 구체화] — 대표: "전략 분석 누르면 무조건 AX 기준 MD 를 기반으로 · 하나하나씩".
   * 목적 · 적용 경계(1장) + 원칙 · 입력 · 적합성 판정 · 16단계 · 업무 재설계 · KPI · 12주 실증 · 기관 관점 · 반론 · 출력 규격(4~13장).
   * D-625 맨 앞에 우선 원칙 요약(본업 손실 먼저 · 증거 상태 표기) · 맨 뒤에 부록 A~G(충돌하면 이것이 먼저).
   */
  ax_strategy: [
    ['AX 우선 원칙', between(penguin, '### 2026-11-04에 새롭게 확정한 핵심 판단', '### 퀵진단 4장과 정밀 16단계의 차이', 'ax_strategy/priority')],
    ['AX 전략 목적', between(penguin, '# 1. 스킬의 최종 목적과 적용 범위', '# 2. 원본과 우선순위', 'ax_strategy/purpose')],
    ['AX 전략 기준', between(penguin, '# 4. 절대 원칙과 금지사항', '# 14. 운영 OS 데이터 모델 및 JSON 계약', 'ax_strategy/core')],
    ['AX 필수 개정 원칙', between(penguin, '# 부록 A.', '# 부록 H.', 'ax_strategy/revision')],
  ],
  /** D-625 벤처 사업계획 — 공식 평가기준 연결 · 벤처 증거 게이트(부록 C · E) */
  ax_venture: [
    ['벤처 평가기준 연결', between(penguin, '# 부록 C.', '# 부록 D.', 'ax_venture/criteria')],
    ['벤처 증거 게이트', between(penguin, '# 부록 E.', '# 부록 F.', 'ax_venture/gates')],
  ],
  /** D-625 특허 · 기술사업계획 · 벤처 정합성(부록 G) — 특허 아이디어 · 벤처 사업계획 */
  ax_alignment: [['특허 · 벤처 정합성', between(penguin, '# 부록 G.', '# 부록 H.', 'ax_alignment')]],
  /** D-625 영업용 4장 퀵진단 — 제안서 구성의 'AX 퀵진단 4장' 형식만(출처 · 경계 장은 뺀다) */
  ax_quick: [['AX 퀵진단 4장', between(penguin, '## 1. 목표·독자·기본 작동', '## 9. 참고 출처/경계', 'ax_quick')]],
}
for (const parts of Object.values(axPacks)) for (const p of parts) p[1] = anonymize(p[1])

/** 특허 아이디어 묶음에 들어가는 AX 기준 부분(4~8장) */
const patentAxPart = PLAN_ONLY ? '' : between(penguin, '# 4. 절대 원칙과 금지사항', '# 9. KPI·데이터 자산·증거 설계', 'patent_idea/penguin')

/* ------------------------------------------------------------------ */
/* D-626 기획 대화가 쓰는 묶음(설계 기준 · 특허 · 벤처 기준에서)              */
/* ------------------------------------------------------------------ */

/** 묶음 이름 — '--ax' · 세 파일 모드에서는 지금 knowledge.js 의 것을 그대로 둔다 */
const PLAN_KEYS = ['plan_lock', 'plan_judge', 'plan_bench', 'plan_handoff', 'ip_route']

/** 도구 · 문서 이름을 일반 말로(이름은 글자 번호로만) */
const TOOL_A = '\x43\x6C\x61\x75\x64\x65'
const TOOL_B = '\x43\x6F\x64\x65\x78'
const CHECK_EN = '\x44\x45\x56\x49\x4C' // 예전 점검 이름(영어) — 원본 머리글을 찾을 때만
const PLAN_RENAMES = [
  [new RegExp(`AX${PG}\\s*[0-9.]*`, 'g'), 'AX 기준 '],
  [new RegExp(`퍼스트${PG}`, 'g'), '창업기업 우대 보증'],
  [new RegExp(`${TOOL_A.toUpperCase()} 본문`, 'g'), '프롬프트 본문'],
  [new RegExp(TOOL_A, 'gi'), '개발 AI'],
  [new RegExp(`${TOOL_B} App`, 'g'), '이미지 생성 도구'],
  [/본 Master/g, '이 기준'],
  [/\b([A-Z][A-Z_]+)\.md\b/g, '$1 문서'],
  [/ v[0-9]+(?:\.[0-9]+)?(?:\/v[0-9]+)?/g, ''],
  [/\s+—\s+(?:신규|강화) 필수/g, ''],
  [/ {2,}/g, ' '],
]
const planClean = (text) => {
  let out = text
    .split('\n')
    .filter((l) => !/https?:\/\//.test(l) && !l.startsWith('**판정 예:**'))
    .join('\n')
  for (const [re, rep] of PLAN_RENAMES) out = out.replace(re, rep)
  return out
}

const planPacks = () => ({
  /** 기획서 판 · 이어서 묻기 — 구현 전 판정 · 병목 하나 · 핵심 가치 3 + 돈 KPI · 지금 만들 것/준비할 것/나중에 검증할 것 · 안 만드는 것 · 왜 지금 · 전략 잠금 16칸 */
  plan_lock: [
    ['구현 전 판정', between(design, '# 1. STRATEGIC PREFLIGHT', '# 3. PROCESS REDESIGN', 'plan_lock/preflight')],
    ['핵심 가치 · KPI', between(design, '# 4. CORE VALUE 3 + MONEY KPI CONTRACT', '# 5. DATA FOUNDATION', 'plan_lock/value')],
    ['지금 · 준비 · 나중', between(design, '# 7. DESIGN NOW / PREPARE NOW / VALIDATE LATER', '# 8. PROOF SYSTEM', 'plan_lock/now')],
    ['안 만드는 것 · 왜 지금', between(design, '# 16. NOT BUILDING / KILL CRITERIA', '# 18. DUAL SCORE', 'plan_lock/not')],
    ['전략 잠금', between(design, '# U-6. PASS 1-A', '# U-7. WHOLE-HYBRID ACCEPTANCE', 'plan_lock/lock')],
  ],
  /** 자체점검(반대 입장에서 따지기) — 다섯 질문 · 점수 두 가지 · 하나라도 있으면 안 되는 것 · 갈래별 공격 목록 · 여덟 사람 관점 */
  plan_judge: [
    ['다섯 질문', between(design, `## F. FIVE ${CHECK_EN} QUESTIONS`, '## G. UNIFIED', 'plan_judge/five')],
    ['점수 · 공격 목록 · 심판', between(design, '# 18. DUAL SCORE', '# 22. PROJECT MEMORY', 'plan_judge/judge')],
  ],
  /** 리서치 — 증명 네 가지 · 사업 모델 · 자금 적합 · 사례 고르는 법과 근거 등급 */
  plan_bench: [
    ['증명', between(design, '# 8. PROOF SYSTEM', '# 9. AX EVIDENCE SYSTEM', 'plan_bench/proof')],
    ['사업 모델', between(design, '# 11. BUSINESS MODEL / UNIT ECONOMICS GATE', '# 12. MOAT / ASSET AFTER BUILD', 'plan_bench/model')],
    ['자금 · 사례 등급', between(design, '# 13. FINANCEABILITY', '# 15. DEMO / PILOT / PRODUCTION', 'plan_bench/grade')],
  ],
  /** 개발 프롬프트 — 단계(시연 · 시범 · 운영) · 프로젝트 기록 · 첫 실행 뒤 남길 것 · 그림 자산 준비 · 프롬프트 길이 */
  plan_handoff: [
    ['단계', between(design, '# 15. DEMO / PILOT / PRODUCTION', '# 16. NOT BUILDING / KILL CRITERIA', 'plan_handoff/stage')],
    ['프로젝트 기록', between(design, '# 22. PROJECT MEMORY', '# 23. ', 'plan_handoff/memory')],
    ['첫 실행 뒤 남길 것', between(design, '# 27. FIRST BUILD HANDOFF PACKAGE', '# U-2. CUSTOMER PLATFORM STRENGTH', 'plan_handoff/first')],
    ['그림 자산 준비', between(design, '# PROMPT 최상단 ASSET PREP BLOCK', '# AX VISUAL ASSET PACK', 'plan_handoff/asset')],
    ['프롬프트 본문 · 길이', between(design, `# ${TOOL_A.toUpperCase()} 본문 내 ASSET ASSUMPTION`, '# v6.3 UPDATE', 'plan_handoff/length')],
  ],
  /** 특허 · 벤처 기획 대화 — 열 가지 원칙 · 기술자산 먼저 · 네 갈래 · 주장 ↔ 증거 장부 · 갈래별 산출물 */
  ip_route: [
    ['열 가지 원칙', between(ipDoc, '## A. 반드시 지킬 10가지 실행 원칙', '## B. ', 'ip_route/principles')],
    ['기술자산 먼저 · 네 갈래', between(ipDoc, '# 1. 프로젝트 진입', '# 2. 특허 전략', 'ip_route/entry')],
    ['주장 ↔ 증거 장부', between(ipDoc, '## 6.2 Claim–Evidence Ledger', '## 6.3 ', 'ip_route/ledger')],
    ['갈래별 산출물', between(ipDoc, '# 10. 경로별 필수 산출물', '# 11. ', 'ip_route/outputs')],
  ],
})

/* ------------------------------------------------------------------ */
/* 나머지 기준에서 뽑는 묶음(세 파일로 다시 만들 때만)                       */
/* ------------------------------------------------------------------ */

const otherPacks = () => ({
  /** 아이디어 내줘 — 특허 출원 전 확인 · 문제발굴 인터뷰 · 5개 고정 질문 · 명칭 공식 · 발명자 · AX 적합성 · 업무 재설계 */
  patent_idea: [
    ['특허 아이디어 기준', between(master, '# 6. 특허 출원 전 최소 확인정보', '# 10. 선행기술 검토', 'patent_idea/master')],
    ['AX 적합성 기준', patentAxPart],
  ],
  /** 조사해줘 — 선행기술 검토 · KIPO 명세서 Reference */
  patent_research: [['선행기술 검토 기준', between(master, '# 10. 선행기술 검토', '# 12. 명세서 작성 세트', 'patent_research')]],
  /** 구성 · 본문 · 청구항 써줘 — 명세서 작성 세트 · Production Pack */
  patent_spec: [['명세서 작성 기준', between(master, '# 12. 명세서 작성 세트', '# 13. 요약서 · 대표도 공통 QA', 'patent_spec')]],
  /** 점검대로 고쳐줘 — 요약서 · 대표도 QA · 형식 검증 */
  patent_format: [['요약서 · 형식 기준', between(master, '# 13. 요약서 · 대표도 공통 QA', '# 15. 특허 출원 후 관리', 'patent_format')]],
  /** 벤처 사업계획서 — 한 이야기 · 점검 · 1,000자 작성 · 항목별 작성 규정 */
  venture_plan: [
    ['벤처 사업계획서 기준 1', between(master, '# PART 5. VENTURE ENGINE', '# 33. 실제 신청화면 10개 첨부 슬롯', 'venture_plan/engine')],
    ['벤처 사업계획서 기준 2', between(master, '# V2.5-4. VENTURE WRITING LOCK', '# V2.5-5. VENTURE PRODUCTION PACK', 'venture_plan/lock')],
    ['벤처 사업계획서 기준 3', between(master, '# PART 6. ONE CORE THREAD', '# PART 8. FIELD REVIEW', 'venture_plan/thread')],
    ['벤처 사업계획서 기준 4', between(venture, '# III. 핵심 업무', '# IV. 실제 신청 폼 전체 관리', 'venture_plan/story')],
    ['벤처 사업계획서 기준 5', between(venture, '# 부록 A. 혁신성장유형 신청 항목별 상세 작성 규정', '# 부록 C. 버전/작성 근거', 'venture_plan/appendix')],
  ],
  /** 실사 답변 — 현장실사 대표자 설명 · 예상 질문 · 금지 표현 */
  inspection: [['현장실사 기준', between(master, '# PART 8. FIELD REVIEW', '# PART 9. QA', 'inspection')]],
})

const out = {}
const meta = {}
const build = (key, parts) => {
  // D-264 장 이름표 줄 · 출처 문서 이름 · 쓰지 않는 이름은 빼고 저장
  out[key] = sanitizeKnowledge(parts.map(([, body]) => body).join('\n\n'))
  meta[key] = { parts: parts.map(([t]) => t), chars: out[key].length }
}

const keepFromCurrent = async (skip) => {
  const cur = await import(new URL('../api/_ai/knowledge.js', import.meta.url))
  for (const [k, v] of Object.entries(cur.KNOWLEDGE)) if (!skip(k)) out[k] = v
  for (const [k, m] of Object.entries(cur.KNOWLEDGE_META)) if (!skip(k)) meta[k] = m
  return cur
}

if (PLAN_ONLY) {
  // D-626 기획 대화 묶음만 새로 — 나머지는 지금 것 그대로
  await keepFromCurrent((k) => PLAN_KEYS.includes(k))
  for (const [key, parts] of Object.entries(planPacks())) {
    for (const p of parts) p[1] = planClean(p[1])
    build(key, parts)
    if (hasBanned(out[key])) {
      console.error(`${key}: 쓰지 않는 이름이 남아 있습니다 — 바꿀 이름을 더 적으세요.`)
      process.exit(1)
    }
  }
} else if (AX_ONLY) {
  const cur = await keepFromCurrent((k) => k in axPacks)
  // 특허 아이디어 묶음 안의 AX 부분이 지금 것과 같아야 나머지를 그대로 둘 수 있다
  const pi = cur.KNOWLEDGE.patent_idea ?? ''
  const at = pi.indexOf('# 4. 절대 원칙과 금지사항')
  if (at < 0 || pi.slice(at) !== sanitizeKnowledge(patentAxPart)) {
    console.error('특허 아이디어 묶음에 든 AX 기준(4~8장)이 바뀌었습니다 — 세 파일을 모두 주고 다시 만드세요(--ax 로는 못 함).')
    process.exit(1)
  }
} else {
  // 세 파일로 다시 만들 때도 기획 대화 묶음(다른 문서에서 온 것)은 그대로 둔다
  await keepFromCurrent((k) => !PLAN_KEYS.includes(k))
  for (const [key, parts] of Object.entries(otherPacks())) build(key, parts)
}
for (const [key, parts] of Object.entries(axPacks)) build(key, parts)

const header = `/**
 * D-252 AI 기준 문서 — 대표가 전달한 MD 원본에서 업무마다 필요한 장만 뽑은 것(scripts/build-ai-knowledge.mjs 가 만든다 · 손으로 고치지 않는다).
 * 서버 함수(api/)에서만 쓴다 — 브라우저 번들에 들어가지 않는다. 원본 MD 는 저장소에 넣지 않는다.
 * D-264 출처 문서 이름 · 버전 · 장 이름표 줄과 쓰지 않는 이름은 뺀 채로 둔다(guard.sanitizeKnowledge).
 */

`
const body = `export const KNOWLEDGE_META = ${JSON.stringify(meta, null, 2)}\n\nexport const KNOWLEDGE = ${JSON.stringify(out, null, 2)}\n`
writeFileSync(new URL('../api/_ai/knowledge.js', import.meta.url), header + body)
for (const [k, m] of Object.entries(meta)) console.log(`${k}: ${m.chars.toLocaleString()}자 · ${m.parts.join(' + ')}`)
