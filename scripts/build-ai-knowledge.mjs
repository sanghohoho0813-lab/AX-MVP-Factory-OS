/**
 * D-252 AI 기준 문서 묶음 만들기 — 대표가 전달한 MD 원본에서 업무마다 필요한 장만 뽑아 api/_ai/knowledge.js 로.
 *
 *   node scripts/build-ai-knowledge.mjs <내부 기준 문서.md> <내부 기준 문서.md> <내부 기준 문서.md>
 *
 * 원본 파일은 저장소에 넣지 않는다(대표 PC · 대화에 올린 파일). 뽑은 장은 서버 함수(api/)에서만 쓰고 브라우저 번들에는 들어가지 않는다.
 * 장은 줄 번호가 아니라 머리글로 찾는다 — 원본이 고쳐져도 같은 장을 다시 뽑는다.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { sanitizeKnowledge } from '../api/_ai/guard.js'

const [masterPath, penguinPath, venturePath] = process.argv.slice(2)
if (!masterPath || !penguinPath || !venturePath) {
  console.error('사용법: node scripts/build-ai-knowledge.mjs <기준 MD 1> <기준 MD 2> <기준 MD 3>')
  process.exit(1)
}

const read = (p) => readFileSync(p, 'utf8').replace(/\r\n?/g, '\n')
const master = read(masterPath)
const penguin = read(penguinPath)
const venture = read(venturePath)

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

const PACKS = {
  /** 아이디어 내줘 — 특허 출원 전 확인 · 문제발굴 인터뷰 · 5개 고정 질문 · 명칭 공식 · 발명자 · AX 적합성 · 업무 재설계 */
  patent_idea: [
    ['특허 아이디어 기준', between(master, '# 6. 특허 출원 전 최소 확인정보', '# 10. 선행기술 검토', 'patent_idea/master')],
    ['AX 적합성 기준', between(penguin, '# 4. 절대 원칙과 금지사항', '# 9. KPI·데이터 자산·증거 설계', 'patent_idea/penguin')],
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
  /**
   * D-272 AI 전략실 [AX 전략 분석] · [AX 아이템 발굴] · [MVP 구체화] — 대표: "전략 분석 누르면 무조건 AX 기준 MD 를 기반으로 · 하나하나씩".
   * 목적 · 적용 경계(1장) + 원칙 · 입력 · 적합성 판정 · 16단계 · 업무 재설계 · KPI · 12주 실증 · 기관 관점 · 반론 · 출력 규격(4~13장).
   * 14장 이후(운영 OS 데이터 모델 · 구현 로드맵 · 개발 완료 기준)는 개발 문서라 모델에 보내지 않는다.
   */
  ax_strategy: [
    ['AX 전략 목적', between(penguin, '# 1. 스킬의 최종 목적과 적용 범위', '# 2. 원본과 우선순위', 'ax_strategy/purpose')],
    ['AX 전략 기준', between(penguin, '# 4. 절대 원칙과 금지사항', '# 14. 운영 OS 데이터 모델 및 JSON 계약', 'ax_strategy/core')],
  ],
}

const out = {}
const meta = {}
for (const [key, parts] of Object.entries(PACKS)) {
  // D-264 장 이름표 줄 · 출처 문서 이름 · 쓰지 않는 이름은 빼고 저장
  out[key] = sanitizeKnowledge(parts.map(([, body]) => body).join('\n\n'))
  meta[key] = { parts: parts.map(([t]) => t), chars: out[key].length }
}

const header = `/**
 * D-252 AI 기준 문서 — 대표가 전달한 MD 원본에서 업무마다 필요한 장만 뽑은 것(scripts/build-ai-knowledge.mjs 가 만든다 · 손으로 고치지 않는다).
 * 서버 함수(api/)에서만 쓴다 — 브라우저 번들에 들어가지 않는다. 원본 MD 는 저장소에 넣지 않는다.
 * D-264 출처 문서 이름 · 버전 · 장 이름표 줄과 쓰지 않는 이름은 뺀 채로 둔다(guard.sanitizeKnowledge).
 */

`
const body = `export const KNOWLEDGE_META = ${JSON.stringify(meta, null, 2)}\n\nexport const KNOWLEDGE = ${JSON.stringify(out, null, 2)}\n`
writeFileSync(new URL('../api/_ai/knowledge.js', import.meta.url), header + body)
for (const [k, m] of Object.entries(meta)) console.log(`${k}: ${m.chars.toLocaleString()}자 · ${m.parts.join(' + ')}`)
