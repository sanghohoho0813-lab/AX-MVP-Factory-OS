/**
 * QA 규칙 — P0 Red Flag(§41) · Judge Scorecard 축(§42) · 실사 질문 풀(§46) · 금지표현(§49) · Evidence Pack(§47).
 * 전부 사람이 확인·채점한다. 코드는 목록과 "아직 안 한 것" 만 센다.
 */

import type { EvidenceSlot, JudgeAxis, VentureGateItem } from '../../types/consulting'

export const RED_FLAGS: { no: number; text: string }[] = [
  { no: 1, text: '특허 핵심과 MVP 핵심이 다르다' },
  { no: 2, text: '대표자가 시스템과 기술을 설명하지 못한다' },
  { no: 3, text: 'DEMO 를 실제 운영성과처럼 표현했다' },
  { no: 4, text: 'Rule 인데 AI 라고 과장했다' },
  { no: 5, text: 'TAM / SAM / SOM 근거가 부족하다' },
  { no: 6, text: '매출·고객·직원·시장·자금 숫자가 서로 다르다' },
  { no: 7, text: '외부개발·발명자·권리관계를 설명할 수 없다' },
  { no: 8, text: 'Future 기능을 현재 완료기능처럼 표시했다' },
  { no: 9, text: '출원 상태인데 "특허 등록" 이라고 적었다' },
  { no: 10, text: '경쟁사 분석 없이 "경쟁사 없음" 이라고 썼다' },
  { no: 11, text: '3년 목표가 현재 실적과 아무 연결이 없다' },
  { no: 12, text: '사업계획서 주장에 증빙이 전혀 없다' },
]

export const JUDGE_AXES: { key: JudgeAxis; label: string }[] = [
  { key: 'A', label: 'Problem Reality — 문제가 실제인가' },
  { key: 'B', label: 'Representative / Team Fit — 대표·팀이 맞는가' },
  { key: 'C', label: 'Technical Differentiation — 기술 차별성' },
  { key: 'D', label: 'Patent ↔ MVP Consistency — 특허와 MVP 가 같은 기술인가' },
  { key: 'E', label: 'MVP Proof — 실제로 동작하는가' },
  { key: 'F', label: 'TAM/SAM/SOM Credibility — 시장 숫자 신뢰도' },
  { key: 'G', label: 'Competitive Advantage — 경쟁우위' },
  { key: 'H', label: 'Market Entry / Growth — 시장진입·성장' },
  { key: 'I', label: 'Funding Logic — 자금 논리' },
  { key: 'J', label: 'Evidence / Integrity — 증빙·정직성' },
]

/** Judge 합계 해석 (§42) — 점수는 사람이 매긴 값의 합일 뿐이다 */
export function judgeVerdict(total: number | null): string {
  if (total === null) return '아직 매기지 않음'
  if (total >= 90) return '제출 권장'
  if (total >= 80) return '보강 후 제출'
  if (total >= 70) return '주요 약점 수정'
  return 'HOLD 재검토'
}

export function judgeTotal(scores: Partial<Record<JudgeAxis, number | null>>): number | null {
  const vals = JUDGE_AXES.map((a) => scores[a.key]).filter((v): v is number => typeof v === 'number')
  if (vals.length < JUDGE_AXES.length) return null
  return vals.reduce((a, b) => a + b, 0)
}

export const GATE_ITEMS: { key: VentureGateItem; text: string }[] = [
  { key: 'knowsProblem', text: '대표자 또는 조직이 실제 현장문제를 알고 있다' },
  { key: 'repeatedInefficiency', text: '현재 업무·제품·서비스에서 반복되는 비효율 또는 고객문제가 있다' },
  { key: 'differentStructure', text: '기존 방식과 다른 해결구조를 설계할 수 있다' },
  { key: 'patentPoint', text: '특허 또는 기술자산으로 연결할 포인트가 있다' },
  { key: 'mvpShowable', text: '핵심기능을 MVP 로 보여줄 수 있다' },
  { key: 'realTarget', text: '실제 고객/거래처/이용자 또는 명확한 타깃시장이 있다' },
  { key: 'marketData', text: 'TAM/SAM/SOM 을 객관적 자료로 구성할 수 있다' },
  { key: 'threeYearPath', text: '향후 3년 기술·사업화 경로를 설명할 수 있다' },
  { key: 'ceoCanExplain', text: '대표자가 현장실사에서 자기 사업과 기술을 설명할 수 있다' },
]

/** NO-GO 신호 (§4-3) — 하나라도 해당하면 억지로 진행하지 않는다 */
export const NO_GO_SIGNALS = [
  '실제 문제와 기술이 연결되지 않는다',
  '단순 홈페이지 제작 수준 외에 혁신 논리가 없다',
  '대표자가 사업내용과 기술을 설명할 수 없다',
  '객관적 사실과 제출하려는 내용 사이에 큰 괴리가 있다',
  '허위 경력·기술·실적·발명자 지정이 있어야만 스토리가 성립한다',
]

/** 10개 첨부 슬롯 (§33) */
export const EVIDENCE_SLOTS: { slot: EvidenceSlot; where: string; direction: string; pages: string }[] = [
  { slot: 1, where: '개발 배경 및 필요성', direction: 'Before / 문제구조 / 현장증빙', pages: '1~2장' },
  { slot: 2, where: '솔루션 소개', direction: 'AX+Platform 구조 / 핵심 Solution / MVP', pages: '1~2장' },
  { slot: 3, where: '기술개발 — 추진경과', direction: '특허 + MVP + 현재 구현범위', pages: '1~2장' },
  { slot: 4, where: '기술개발 — 향후 3년', direction: '3년 기술 Roadmap', pages: '1장' },
  { slot: 5, where: '팀·대표자·기업가정신', direction: '대표자 현장경험 / 문제인식 / 실행역량', pages: '1장' },
  { slot: 6, where: '목표시장 및 고객', direction: 'TAM / SAM / SOM', pages: '1~2장' },
  { slot: 7, where: '경쟁사 분석', direction: '기존방식 / 경쟁사 / 자사 비교', pages: '1장' },
  { slot: 8, where: '시장진입·확대 — 추진경과', direction: '고객/거래처/매출/Demand Proof', pages: '1장' },
  { slot: 9, where: '시장진입·확대 — 향후 3년', direction: '고객확대 / 채널 / 지역·업종 확장', pages: '1장' },
  { slot: 10, where: '자금운용', direction: '자금조달·사용처·Milestone', pages: '1장' },
]

/** 사업계획서 7항목 (§23) */
export const PLAN_SECTIONS: { no: 1 | 2 | 3 | 4 | 5 | 6 | 7; title: string; question: string; must: string[]; slots: EvidenceSlot[] }[] = [
  { no: 1, title: '개발 배경 및 필요성', question: '어떤 문제를 해결할 것인가?', must: ['실제 문제', '문제가 생기는 상황', '기존 방식의 한계', '개발 필요성', '객관적 근거', '대표자/회사가 왜 이 문제를 잘 아는지'], slots: [1] },
  { no: 2, title: '솔루션 소개', question: '어떻게 해결할 것인가?', must: ['기술명', '주요기능', '구성', '작동원리(Input→Data→Logic→Output→Action→Result)', '기존 대비 차별성', '성능·효과의 객관적 근거', '특허 핵심구조와 연결'], slots: [2] },
  { no: 3, title: '기술개발', question: '지금까지 무엇을 개발했고 3년간 무엇을 개발할 것인가?', must: ['현재까지(R&D·MVP·특허·인력·외부협업)', '개발 중', '1년차·2년차·3년차'], slots: [3, 4] },
  { no: 4, title: '목표시장 및 고객 정의', question: '3년 내 확보할 시장 크기와 성장성은?', must: ['TAM', 'SAM', 'SOM', '기준연도', '출처', '산식', '고객단위·단가', '현재 영업범위', '3년 확보율의 현실성'], slots: [6] },
  { no: 5, title: '경쟁사 분석', question: '비슷한 가치를 주는 대안은 무엇이며 왜 우리가 다른가?', must: ['수기/엑셀/전화 방식', '범용 ERP/CRM/POS', '직접 경쟁사', '유사 서비스', '비교표', '자사 차별성 3개', '"경쟁사 없음" 금지'], slots: [7] },
  { no: 6, title: '시장진입 및 확대', question: '지금 어디까지 왔고 앞으로 어떻게 고객을 확보하는가?', must: ['현재 추진경과(고객·거래처·매출·문의)', '향후 3년 경로', '채널전략'], slots: [8, 9] },
  { no: 7, title: '자금운용', question: '얼마가 필요하고 어떻게 조달·사용하는가?', must: ['자금구분(영업이익·자본금·투자·정부지원·정책금융·보증·대출)', '확보 완료/협의 중/계획', '3년 사용처', 'Milestone 연결'], slots: [10] },
]

/** 실사 예상질문 기본 풀 (§46) */
export const FIELD_QUESTION_POOL: string[] = [
  '이 기술을 왜 개발했습니까?',
  '기존 방식은 무엇이 문제입니까?',
  '대표님이 직접 기여한 부분은 무엇입니까?',
  '미래AI랩은 어떤 역할을 했습니까?',
  '특허의 핵심은 무엇입니까?',
  '현재 MVP 에서 실제 작동하는 기능은 무엇입니까?',
  'AI/분석 기능의 원리는 무엇입니까?',
  '현재 실제 고객이 사용하고 있습니까?',
  '경쟁사 대비 차별점은 무엇입니까?',
  'TAM/SAM/SOM 산출근거는 무엇입니까?',
  '3년 후 고객수와 매출목표의 근거는 무엇입니까?',
  '향후 기술개발 계획은 무엇입니까?',
  '개발비와 사업화 자금은 어떻게 조달합니까?',
  '회사 내부에 개발인력이 없는데 어떻게 유지합니까?',
  '특허가 등록되지 않으면 사업에 문제가 있습니까?',
]

/** 실사 금지 표현 (§49) — 증빙이 없으면 말하지 않는다 */
export const FORBIDDEN_PHRASES: { phrase: RegExp; label: string; why: string }[] = [
  { phrase: /국내\s*최초/, label: '국내 최초', why: '근거 없이는 말하지 않는다' },
  { phrase: /업계\s*최초/, label: '업계 최초', why: '근거 없이는 말하지 않는다' },
  { phrase: /유일/, label: '유일', why: '경쟁사 분석과 모순된다' },
  { phrase: /특허\s*등록\s*완료|등록특허/, label: '특허 등록 완료', why: '출원 상태면 "출원 중"' },
  { phrase: /완전\s*자동/, label: 'AI 완전 자동', why: '실제가 아니면 금지' },
  { phrase: /전국\s*확대\s*완료/, label: '전국 확대 완료', why: '계획이면 계획으로' },
  { phrase: /투자\s*유치\s*완료/, label: '투자유치 완료', why: '협의 중이면 협의 중으로' },
  { phrase: /자체\s*개발팀\s*보유/, label: '자체 개발팀 보유', why: '실제 없으면 외부 협업으로 적는다' },
]

export function findForbiddenPhrases(text: string): string[] {
  return FORBIDDEN_PHRASES.filter((f) => f.phrase.test(text)).map((f) => f.label)
}

/** 실사 Evidence Pack 폴더 (§47) */
export const EVIDENCE_PACK: { key: string; group: string; label: string }[] = [
  { key: 'co_bizreg', group: '회사', label: '사업자등록증' },
  { key: 'co_corpreg', group: '회사', label: '법인등기' },
  { key: 'co_share', group: '회사', label: '주주명부' },
  { key: 'co_org', group: '회사', label: '조직/인력' },
  { key: 'ceo_career', group: '대표자', label: '경력·자격·업력' },
  { key: 'tech_patent', group: '기술', label: '특허출원번호통지서·명세서·핵심도면' },
  { key: 'tech_mvp', group: '기술', label: 'MVP URL·Screenshot·QA Report·구조도' },
  { key: 'dev_docs', group: '개발', label: '요구사항·개발계획·협업자료·현재/향후 범위' },
  { key: 'biz_proof', group: '사업', label: '고객·거래처·계약·견적·발주·매출' },
  { key: 'mkt_proof', group: '시장', label: 'TAM/SAM/SOM 출처·경쟁사·3년 확대계획' },
]

/** 3분 Script 뼈대 (§44) */
export const SCRIPT_SKELETON = [
  '0:00~0:30 회사와 현재 본업',
  '0:30~1:00 현장에서 반복적으로 겪은 핵심문제',
  '1:00~1:40 그 문제를 해결하기 위해 개발한 핵심기술과 특허(출원 중)',
  '1:40~2:20 현재 MVP 에서 실제로 동작하는 기능 시연',
  '2:20~2:40 현재 고객/시장과 TAM-SAM-SOM',
  '2:40~3:00 향후 3년 기술고도화·고객확대·매출계획',
]
