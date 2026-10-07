/**
 * 메인비즈 준비 점검 문항 · 실사 예상 질문 (D-170) — 이노비즈와 같은 엔진, 다른 도메인 규칙.
 * 묶음은 중소벤처24 현장평가 질문 예시의 4묶음(전략기획 · 성과관리 · 조직인적자원 · 사회적신뢰) — 별표1 3영역 안의 지표다.
 * MIRAE 사전진단이다 — 공식 자가진단(중소벤처24, 600점 이상)이 아니고 공식 배점과 섞지 않는다.
 */
import type { SelfCheckItem } from '../core/selfCheck'
import type { InspectionQuestion } from '../core/inspection'

const won = (n: number) => (Math.abs(n) >= 1e8 ? `${Math.round(n / 1e7) / 10}억원` : `${Math.round(n / 1e4).toLocaleString()}만원`)

export const MAINBIZ_CHECK: SelfCheckItem[] = [
  {
    id: 'mb_vision',
    area: '전략기획',
    question: '올해 경영 목표 · 사업계획이 글로 있나요?',
    plain: '회사가 어디로 가는지 — 연간 목표와 계획서가 있는지 봅니다.',
    evidence: [{ id: 'vision', label: '경영 목표 · 사업계획(연간)' }],
    fieldRisk: '대표 면담에서 올해 목표를 직접 묻습니다.',
  },
  {
    id: 'mb_market',
    area: '전략기획',
    question: '주요 고객 · 시장을 정리해 두었나요?',
    plain: '누구에게 무엇을 파는지, 거래처 현황이 정리돼 있는지 봅니다.',
    evidence: [{ id: 'customer', label: '고객 만족 · 품질 개선 기록' }],
    suggest: (c) => (c.b2b ? { answer: 'partly', because: 'B2B 거래 있음 — 거래처 현황 정리는 확인' } : null),
  },
  {
    id: 'mb_kpi',
    area: '성과관리',
    question: '목표 대비 실적을 정기적으로 점검하나요?',
    plain: '월간 · 분기 실적 회의, 목표 대비 달성률 기록이 있는지 봅니다.',
    evidence: [{ id: 'kpi', label: '성과 관리 기록(목표 · 실적 회의록)' }],
    fieldRisk: '회의록 · 실적표를 보여 달라고 하는 경우가 많습니다.',
  },
  {
    id: 'mb_finance',
    area: '성과관리',
    question: '최근 영업이익이 나고 있나요?',
    plain: '경영 성과를 재무로 봅니다. 손실이어도 개선 추세면 설명할 수 있습니다.',
    evidence: [{ id: 'fin3', label: '최근 3년 재무제표' }],
    suggest: (c) => (c.operatingProfit === null ? null : c.operatingProfit > 0 ? { answer: 'yes', because: `영업이익 ${won(c.operatingProfit)}` } : { answer: 'no', because: '영업손실' }),
  },
  {
    id: 'mb_hr',
    area: '조직인적자원',
    question: '취업규칙 · 인사 평가 · 교육 제도가 있나요?',
    plain: '직원을 뽑고 키우고 평가하는 규칙이 있는지 봅니다.',
    evidence: [{ id: 'hr_rules', label: '취업규칙 · 인사 · 교육 기록' }],
    suggest: (c) => (c.employees !== null && c.employees < 5 ? { answer: 'partly', because: `직원 ${c.employees}명 — 소규모라 제도가 간단할 수 있음` } : null),
  },
  {
    id: 'mb_org',
    area: '조직인적자원',
    question: '조직도와 역할 분담이 정해져 있나요?',
    plain: '누가 무엇을 책임지는지 조직도로 보여 줄 수 있는지 봅니다.',
    evidence: [{ id: 'org_chart', label: '조직도 · 인력 현황' }],
  },
  {
    id: 'mb_esg',
    area: '사회적신뢰',
    question: '윤리 · 안전 · 사회공헌 활동 기록이 있나요?',
    plain: '체불 · 산재 · 공정거래 문제 없이 신뢰를 지키는지, 활동 기록이 있는지 봅니다.',
    evidence: [{ id: 'esg', label: '사회공헌 · 윤리 · 안전 활동 기록' }],
    suggest: (c) => (c.exclusionFlags.length ? { answer: 'no', because: `확인된 사유: ${c.exclusionFlags.join(' · ')}` } : null),
  },
  {
    id: 'mb_customer',
    area: '사회적신뢰',
    question: '고객 불만 · 품질 개선을 기록하고 처리하나요?',
    plain: '고객 의견을 받아 개선한 기록이 있는지 봅니다.',
    evidence: [{ id: 'customer', label: '고객 만족 · 품질 개선 기록' }],
  },
]

export const MAINBIZ_INSPECTION: InspectionQuestion[] = [
  {
    id: 'q_goal',
    question: '올해 회사 목표와 그걸 위해 무엇을 바꾸셨나요?',
    intent: '경영 혁신 — 목표와 실행이 이어지는지',
    facts: () => [],
    evidence: ['vision'],
    draft: () => null,
  },
  {
    id: 'q_kpi',
    question: '목표 대비 실적은 어떻게 점검하시나요?',
    intent: '성과 관리 체계가 실제로 돌아가는지',
    facts: () => [],
    evidence: ['kpi'],
    draft: () => null,
  },
  {
    id: 'q_finance',
    question: '최근 매출 · 이익 흐름은 어떤가요?',
    intent: '경영 성과',
    facts: (c) => [c.revenue !== null ? `매출 ${won(c.revenue)}` : '', c.operatingProfit !== null ? `영업이익 ${won(c.operatingProfit)}` : ''].filter(Boolean) as string[],
    evidence: ['fin3'],
    draft: (c) => (c.revenue !== null && c.operatingProfit !== null ? `작년 매출 ${won(c.revenue)}, 영업이익 ${won(c.operatingProfit)}입니다. [증감 이유]` : null),
  },
  {
    id: 'q_people',
    question: '직원 교육 · 평가는 어떻게 하시나요?',
    intent: '조직 · 인적자원 관리',
    facts: (c) => (c.employees !== null ? [`직원 ${c.employees}명`] : []),
    evidence: ['hr_rules', 'org_chart'],
    draft: () => null,
  },
  {
    id: 'q_trust',
    question: '최근 3년 체불 · 산재 · 공정거래 문제는 없었나요?',
    intent: '2026-06-22 부터 제외 사유 — 사회적 신뢰',
    facts: (c) => (c.exclusionFlags.length ? [`확인된 사유: ${c.exclusionFlags.join(' · ')}`] : []),
    evidence: ['esg'],
    // 기록에 없다고 '없었다' 고 쓰지 않는다 — 대표 확인으로
    draft: () => null,
  },
]
