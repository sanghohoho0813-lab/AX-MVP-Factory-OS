/**
 * 이노비즈 준비 점검 문항 · 실사 예상 질문 (D-170) — 도메인 규칙. 엔진은 core/selfCheck · core/inspection.
 * 묶음 이름은 MIRAE 준비 점검용이다(공식 지표 이름 · 배점 아님 — 공식 자가진단은 이노비즈넷에서 650점 이상).
 */
import type { SelfCheckItem } from '../core/selfCheck'
import type { InspectionQuestion } from '../core/inspection'
import { rndPositive, rndText } from '../core/rnd'

const won = (n: number) => (Math.abs(n) >= 1e8 ? `${Math.round(n / 1e7) / 10}억원` : `${Math.round(n / 1e4).toLocaleString()}만원`)

export const INNOBIZ_CHECK: SelfCheckItem[] = [
  {
    id: 'ib_org',
    area: '연구개발 체제',
    question: '연구개발을 맡는 조직(연구소 · 전담부서)이 있나요?',
    plain: '기술을 개발하는 사람과 자리가 정해져 있는지 봅니다. 인정서가 있으면 가장 확실합니다.',
    evidence: [{ id: 'lab_cert', label: '기업부설연구소 · 전담부서 인정서' }, { id: 'org_chart', label: '조직도 · 인력 현황' }],
    suggest: (c) => (c.researchUnit === 'lab' ? { answer: 'yes', because: '업체 기록: 기업부설연구소 보유' } : c.researchUnit === 'dept' ? { answer: 'yes', because: '업체 기록: 연구개발전담부서 보유' } : c.researchUnit === 'none' ? { answer: 'no', because: '업체 기록: 연구조직 없음' } : null),
    fieldRisk: '현장에서 연구공간 · 연구원 근무를 직접 봅니다.',
  },
  {
    id: 'ib_rnd_cost',
    area: '연구개발 체제',
    question: '연구개발에 꾸준히 돈을 쓰고 있나요?',
    plain: '재무제표의 연구개발비 · 인건비 중 연구 인력 몫을 봅니다.',
    evidence: [{ id: 'fin3', label: '최근 3년 재무제표' }],
    suggest: (c) => (rndPositive(c) === null ? null : rndPositive(c) ? { answer: 'yes', because: `연구개발비 ${rndText(c)}` } : { answer: 'no', because: '연구개발비 없음' }),
  },
  {
    id: 'ib_ip',
    area: '기술 축적 · 성과',
    question: '특허 · 실용신안 · 프로그램 등록 같은 지식재산이 있나요?',
    plain: '기술 성과를 서류로 보여 줄 수 있는지 봅니다. 출원 중이어도 도움이 됩니다.',
    evidence: [{ id: 'patent', label: '특허 · 지식재산권 등록증' }],
    suggest: (c) => (c.patents === null ? null : c.patents > 0 ? { answer: 'yes', because: `특허 ${c.patents}건` } : { answer: 'no', because: '등록된 특허 없음' }),
  },
  {
    id: 'ib_records',
    area: '기술 축적 · 성과',
    question: '연구개발 과제 · 연구노트 같은 기록이 남아 있나요?',
    plain: '무엇을 개발했고 어떻게 진행했는지 기록이 있는지 봅니다.',
    evidence: [{ id: 'rnd_records', label: '연구개발 과제 · 연구노트 기록' }],
    fieldRisk: '최근 1~2년 과제 기록을 보여 달라고 하는 경우가 많습니다.',
  },
  {
    id: 'ib_product',
    area: '사업화',
    question: '개발한 기술이 실제 제품 · 서비스 매출로 이어졌나요?',
    plain: '기술이 돈이 되는지 — 제품 매출 · 계약 실적을 봅니다.',
    evidence: [{ id: 'fin3', label: '최근 3년 재무제표' }, { id: 'biz_plan', label: '기술사업계획서' }],
    suggest: (c) => (c.revenue === null ? null : c.revenue > 0 ? { answer: 'partly', because: `매출 ${won(c.revenue)} — 기술 제품 매출 비중은 확인` } : { answer: 'no', because: '매출 없음' }),
  },
  {
    id: 'ib_quality',
    area: '사업화',
    question: '품질 관리 체계(ISO · 검사 기록)가 있나요?',
    plain: '만든 제품의 품질을 어떻게 관리하는지 봅니다.',
    evidence: [{ id: 'quality', label: '품질 · 인증 현황(ISO 등)' }],
    suggest: (c) => (c.held.some((h) => h.key === 'iso9001') ? { answer: 'yes', because: 'ISO 9001 보유' } : null),
  },
  {
    id: 'ib_ceo',
    area: '혁신 경영',
    question: '대표가 기술혁신 목표 · 계획을 세우고 있나요?',
    plain: '중장기 기술 개발 계획이 있는지 — 사업계획서에 담깁니다.',
    evidence: [{ id: 'biz_plan', label: '기술사업계획서' }],
    fieldRisk: '대표 면담에서 기술 로드맵을 직접 묻습니다.',
  },
  {
    id: 'ib_people',
    area: '혁신 경영',
    question: '기술 인력 교육 · 보상 제도가 있나요?',
    plain: '연구 인력을 키우고 붙잡는 제도(교육 · 직무발명보상 등)가 있는지 봅니다.',
    evidence: [{ id: 'org_chart', label: '조직도 · 인력 현황' }],
  },
]

export const INNOBIZ_INSPECTION: InspectionQuestion[] = [
  {
    id: 'q_tech',
    question: '회사의 핵심 기술은 무엇이고 경쟁사와 무엇이 다른가요?',
    intent: '기술의 차별성 · 혁신성을 대표가 직접 설명할 수 있는지',
    facts: (c) => [c.industryText && `업종: ${c.industryText}`, c.patents ? `특허 ${c.patents}건` : ''].filter(Boolean) as string[],
    evidence: ['patent', 'biz_plan'],
    draft: (c) => (c.patents ? `저희 핵심 기술은 [기술 이름]이며, 특허 ${c.patents}건으로 보호하고 있습니다. 경쟁사 대비 [차이점]이 강점입니다.` : null),
  },
  {
    id: 'q_org',
    question: '연구개발은 누가, 어디서 하나요?',
    intent: '연구조직 · 연구공간이 실제로 운영되는지',
    facts: (c) => [c.researchUnit === 'lab' ? '기업부설연구소 보유' : c.researchUnit === 'dept' ? '연구개발전담부서 보유' : '', c.researchers !== null ? `연구전담요원 ${c.researchers}명` : ''].filter(Boolean) as string[],
    evidence: ['lab_cert', 'org_chart'],
    draft: (c) => (c.researchUnit === 'lab' || c.researchUnit === 'dept' ? `${c.researchUnit === 'lab' ? '기업부설연구소' : '연구개발전담부서'}에서${c.researchers !== null ? ` 연구전담요원 ${c.researchers}명이` : ''} 개발을 맡고 있습니다. 연구공간은 [위치]에 따로 있습니다.` : null),
  },
  {
    id: 'q_records',
    question: '최근 개발한 과제와 그 기록을 보여 주실 수 있나요?',
    intent: '연구 활동이 기록으로 남는지(연구노트 · 과제 보고)',
    facts: () => [],
    evidence: ['rnd_records'],
    draft: () => null,
  },
  {
    id: 'q_sales',
    question: '그 기술로 만든 제품 매출은 얼마나 되나요?',
    intent: '기술 사업화 성과',
    facts: (c) => (c.revenue !== null ? [`매출 ${won(c.revenue)}`] : []),
    evidence: ['fin3'],
    draft: (c) => (c.revenue !== null ? `작년 매출 ${won(c.revenue)} 가운데 [기술 제품] 매출이 [비중]입니다.` : null),
  },
  {
    id: 'q_plan',
    question: '앞으로 3년 기술 개발 계획은 어떻게 되나요?',
    intent: '혁신 경영 — 대표의 기술 로드맵',
    facts: (c) => (c.rndPlan ? ['연구개발 계획 있음'] : []),
    evidence: ['biz_plan'],
    draft: () => null,
  },
]
