/**
 * 워크플로 정의 — 모듈 `patent_venture_mvp` 의 S0~S16.
 *
 * Master v2.0 PART 1 §2-1(단계), K5(활성 PART), 각 PART 의 체크리스트를 코드로 옮겼다.
 * 여기 적힌 exit checklist 는 "사람이 확인하고 넘기는 것" 이다. 코드는 필요 사실·필요 산출물이
 * 비어 있으면 완료를 막는 데까지만 관여한다.
 */

import type { StageDefinition, StageGroupKey, StageKey } from '../../types/consulting'

export const STAGE_GROUP_LABEL: Record<StageGroupKey, string> = {
  understand: '회사 이해',
  patent: '특허',
  mvp: 'MVP',
  venture: '벤처',
  submit: '제출·실사',
}

export const STAGE_GROUP_ORDER: StageGroupKey[] = ['understand', 'patent', 'mvp', 'venture', 'submit']

export const STAGES: StageDefinition[] = [
  {
    key: 'S0', code: 'INTAKE', label: '회사 이해', group: 'understand',
    purpose: '회사 기본 사실(대표자·설립·주소·번호·업종·주요 제품)을 사실표에 넣고 출처를 적는다.',
    exitChecklist: ['회사 기본 8항목이 사실표에 있다', '값마다 출처가 있다', '대표자 인터뷰 일정이 잡혔거나 끝났다'],
    requiredFacts: ['companyName', 'representative', 'establishedAt', 'headOffice', 'businessNumber', 'industry', 'mainProducts'],
    requiredArtifacts: [],
    promptTypes: ['GENERAL_PROJECT_REVIEW'],
    activeParts: 'PART 1', skippable: false,
  },
  {
    key: 'S1', code: 'VENTURE GATE', label: 'GO / HOLD / NO-GO', group: 'understand',
    purpose: '혁신성장유형에 맞는 회사인지 9개 항목으로 판정한다. HOLD 는 보강 후 GO 로 돌아온다.',
    exitChecklist: ['GO 항목을 하나씩 사실대로 표시했다', '결정과 이유를 적었다', 'NO-GO 면 억지로 진행하지 않는다'],
    requiredFacts: ['coreProblem', 'customers'],
    requiredArtifacts: [],
    promptTypes: ['GENERAL_PROJECT_REVIEW'],
    activeParts: 'PART 1 · PART A §4', skippable: false,
  },
  {
    key: 'S2', code: 'PROBLEM DISCOVERY', label: '핵심문제 확정', group: 'understand',
    purpose: '현장에서 반복되는 문제 하나와 지금 방식의 한계를 한 문장씩 확정한다 (인터뷰 10문항).',
    exitChecklist: ['핵심 현장문제 한 문장', '기존 해결방식 한 문장', '대표자가 "직접 발명했다" 고 과장하지 않았다'],
    requiredFacts: ['coreProblem', 'currentMethod'],
    requiredArtifacts: [],
    promptTypes: ['GENERAL_PROJECT_REVIEW'],
    activeParts: 'PART 1 §7', skippable: false,
  },
  {
    key: 'S3', code: 'PATENT IDEA', label: '특허 아이디어', group: 'patent',
    purpose: '5개 고정 질문(문제·기존방식·차별구조·처리흐름·권리화 포인트)과 제목 후보를 만든다.',
    exitChecklist: ['5개 질문에 답이 있다', '특허명이 기술구조로 읽힌다(마케팅 문구 아님)', '발명자·출원인을 사실대로 정했다'],
    requiredFacts: ['coreTech'],
    requiredArtifacts: ['PATENT_IDEA'],
    promptTypes: ['PATENT_IDEA'],
    activeParts: 'PART 2 §8·§9', skippable: true,
  },
  {
    key: 'S4', code: 'PRIOR ART', label: '선행기술 검토', group: 'patent',
    purpose: 'KIPRIS 키워드·유사 특허·차별화 포인트를 정리한다. "완전히 같은 게 없다" 가 목적이 아니다.',
    exitChecklist: ['검색 키워드', '유사 목적·구성·처리순서 특허 확인', '무엇을 빼고 좁히고 강조할지 정했다'],
    requiredFacts: [],
    requiredArtifacts: ['PRIOR_ART_REVIEW'],
    promptTypes: ['PRIOR_ART_REVIEW'],
    activeParts: 'PART 2 §10', skippable: true,
  },
  {
    key: 'S5', code: 'KIPO REFERENCE SELECT', label: '참고자료 선정', group: 'patent',
    purpose: 'KIPO 118종에서 2~5종을 고르고 PDF 를 받는다. 받기 전에는 세부 문구를 추측해 쓰지 않는다.',
    exitChecklist: ['2~5종 선정', '선정 이유(4축)', 'PDF 첨부 확인'],
    requiredFacts: [],
    requiredArtifacts: [],
    promptTypes: [],
    activeParts: 'PART 2 §11 · APPENDIX A', skippable: true,
  },
  {
    key: 'S6', code: 'PATENT DRAFT', label: '명세서 작성', group: 'patent',
    purpose: '명세서·청구범위·요약서·도면 초안을 만들고 요약서 QA 를 통과한다.',
    exitChecklist: ['명세서 목차 12항목', '청구항 검토', '요약서 400자 기준·용어 통일·대표도 부호 일치', '예시 문장 복제 없음'],
    requiredFacts: ['coreTech'],
    requiredArtifacts: ['PATENT_SPEC_DRAFT'],
    promptTypes: ['PATENT_SPEC_DRAFT', 'PATENT_CLAIMS_REVIEW'],
    activeParts: 'PART 2 §12·§13', skippable: true,
  },
  {
    key: 'S7', code: 'PATENT FILED', label: '출원 완료', group: 'patent',
    purpose: '전자출원 후 출원번호·출원일·제출본·납부자료를 보관한다. 출원 ≠ 등록.',
    exitChecklist: ['최신 공식 기준 확인(특허로)', '출원번호·출원일 기록', '제출본·납부자료 보관', '심사청구 기한 메모'],
    requiredFacts: ['patent'],
    requiredArtifacts: ['PATENT_FILING_RECORD'],
    promptTypes: [],
    activeParts: 'PART 2 §14 · K9', skippable: true,
  },
  {
    key: 'S8', code: 'MVP STRATEGY LOCK', label: 'MVP 설계 잠금', group: 'mvp',
    purpose: 'MVP_SPEC 을 잠근다 — 핵심 Journey 1개, AX 핵심기능 1개, Platform Surface, LIVE/DEMO/FUTURE, 안 만들 것.',
    exitChecklist: ['핵심가설 한 문장', 'Primary Journey 가 특허 핵심기술과 같다', 'AX 기능이 실제 AI 가 아니면 AI 라 부르지 않는다', 'Future Preview 6~10'],
    requiredFacts: ['axCore', 'platformUsers'],
    requiredArtifacts: ['MVP_SPEC'],
    promptTypes: ['MVP_STRATEGY'],
    activeParts: 'PART 3 §2 · PART 4', skippable: false,
  },
  {
    key: 'S9', code: 'MVP BUILD', label: 'MVP 구현·QA', group: 'mvp',
    purpose: 'Claude Code 빌드 프롬프트로 구현하고 Render/Click/Mobile QA 를 거쳐 URL 을 확보한다.',
    exitChecklist: ['URL 이 열린다', '390/430 실측', 'Primary Journey 클릭 완주', '404·Dead CTA 0', '3분 Demo 가능'],
    requiredFacts: ['mvpUrl'],
    requiredArtifacts: ['MVP_BUILD_PROMPT', 'MVP_STATE'],
    promptTypes: ['MVP_CLAUDE_CODE_BUILD'],
    activeParts: 'PART 3 §43~53', skippable: false,
  },
  {
    key: 'S10', code: 'VENTURE FACTSHEET', label: '사실표 잠금', group: 'venture',
    purpose: '숫자·사실의 단일 원본을 잠근다. 숫자마다 기준연도·출처·산식.',
    exitChecklist: ['재무·고객·시장·3년 계획 채움', 'demo 값이 실적처럼 남아 있지 않다', '스냅샷 저장'],
    requiredFacts: ['employees', 'revenue3y', 'customers', 'tam', 'sam', 'som', 'marketFormula', 'revenueGoal', 'fundingNeed'],
    requiredArtifacts: ['VENTURE_FACTSHEET_SNAPSHOT'],
    promptTypes: [],
    activeParts: 'PART 1 §5 · PART 5', skippable: false,
  },
  {
    key: 'S11', code: 'VENTURE PLAN', label: '사업계획서 7항목', group: 'venture',
    purpose: '개발배경 → 솔루션 → 기술개발 → 시장(TAM/SAM/SOM) → 경쟁사 → 시장진입 → 자금을 순서대로 쓴다.',
    exitChecklist: ['7항목 초안', '"경쟁사 없음" 이 없다', '현재/개발중/향후 구분', '특허·MVP 와 같은 기술명'],
    requiredFacts: ['coreTech', 'tam', 'sam', 'som'],
    requiredArtifacts: ['VENTURE_PLAN_SECTION'],
    promptTypes: ['VENTURE_PLAN_SECTION', 'VENTURE_FULL_REVIEW'],
    activeParts: 'PART 5 §26~32', skippable: false,
  },
  {
    key: 'S12', code: 'EVIDENCE & INFOGRAPHIC', label: '증빙 10슬롯', group: 'venture',
    purpose: '실제 신청화면 10개 첨부 슬롯마다 주장·증빙·인포그래픽 1장(중요한 곳만 2장)을 맞춘다.',
    exitChecklist: ['10슬롯 모두 주장·출처', 'Claim–Evidence Matrix', '향후 기능이 현재처럼 그려지지 않았다'],
    requiredFacts: [],
    requiredArtifacts: ['CLAIM_EVIDENCE_MATRIX'],
    promptTypes: ['EVIDENCE_REVIEW', 'INFOGRAPHIC_BRIEF'],
    activeParts: 'PART 5 §33·§34 · PART 6 §36', skippable: false,
  },
  {
    key: 'S13', code: 'FINAL QA', label: 'Judge / Devil', group: 'submit',
    purpose: 'P0 Red Flag 12개를 없애고 Judge 10항목을 사람이 매긴다. P0 가 남으면 완료 선언 금지.',
    exitChecklist: ['P0 12개 전부 확인', 'Judge 점수 기록', 'One Core Thread 경고 0'],
    requiredFacts: [],
    requiredArtifacts: ['QA_REPORT'],
    promptTypes: ['VENTURE_FULL_REVIEW', 'GENERAL_PROJECT_REVIEW'],
    activeParts: 'PART 7 · PART 9 §50~52', skippable: false,
  },
  {
    key: 'S14', code: 'SUBMITTED', label: '신청 완료', group: 'submit',
    purpose: '신청 당일 최신 공식 기준(글자수·첨부수·용량·발급일)을 확인하고 제출본을 백업한다.',
    exitChecklist: ['최신 공식 기준 확인(벤처확인종합관리시스템)', '기본서류 8종 발급일', '제출본 백업', '신청일 기록'],
    requiredFacts: [],
    requiredArtifacts: ['SUBMISSION_RECORD'],
    promptTypes: [],
    activeParts: 'PART 5 · PART 9 §53 · K9', skippable: false,
  },
  {
    key: 'S15', code: 'FIELD REVIEW', label: '현장실사 준비', group: 'submit',
    purpose: '대표자 3분 Script · MVP 3분 Demo · 예상 Q&A 10~15 · Evidence Pack · 외울 숫자 · 금지표현 · Mock Review.',
    exitChecklist: ['3분 Script', 'Demo 동선', 'Q&A 10~15', 'Evidence Pack 체크', '외울 숫자 8~12', 'Mock Review 1회'],
    requiredFacts: [],
    requiredArtifacts: ['FIELD_REVIEW_SCRIPT', 'FIELD_REVIEW_QA'],
    promptTypes: ['FIELD_REVIEW_SCRIPT', 'FIELD_REVIEW_QA'],
    activeParts: 'PART 8 · PART 7', skippable: true,
  },
  {
    key: 'S16', code: 'RESULT', label: '결과·후속', group: 'submit',
    purpose: '결과를 기록하고 본개발·정책자금·지원사업 연계로 넘긴다.',
    exitChecklist: ['결과 기록', '후속(본개발·자금) 메모'],
    requiredFacts: [],
    requiredArtifacts: ['RESULT_RECORD'],
    promptTypes: ['GENERAL_PROJECT_REVIEW'],
    activeParts: 'PART 1 상태판', skippable: false,
  },
]

export const STAGE_ORDER: StageKey[] = STAGES.map((s) => s.key)

const BY_KEY = new Map(STAGES.map((s) => [s.key, s]))

export function stageDef(key: StageKey): StageDefinition {
  const def = BY_KEY.get(key)
  if (!def) throw new Error(`알 수 없는 단계: ${key}`)
  return def
}

export function stageIndex(key: StageKey): number {
  return STAGE_ORDER.indexOf(key)
}

export function nextStageKey(key: StageKey): StageKey | null {
  const i = stageIndex(key)
  return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : null
}

export function prevStageKey(key: StageKey): StageKey | null {
  const i = stageIndex(key)
  return i > 0 ? STAGE_ORDER[i - 1] : null
}

export function stagesByGroup(): { group: StageGroupKey; stages: StageDefinition[] }[] {
  return STAGE_GROUP_ORDER.map((group) => ({ group, stages: STAGES.filter((s) => s.group === group) }))
}

export function isStageKey(v: unknown): v is StageKey {
  return typeof v === 'string' && (STAGE_ORDER as string[]).includes(v)
}
