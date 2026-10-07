/**
 * 메인비즈 실사 질문 은행 + 말하기 가이드 (P2). 평가 3영역(경영혁신 인프라 · 활동 · 성과)에 걸쳐 고르게.
 * 근거가 있는 문장만 — 없으면 대표 확인 질문으로.
 */
import type { InspectionQuestion } from '../core/inspection'
import type { GuideParts, Sourced } from '../core/answerGuide'
import { MAINBIZ_INSPECTION } from './mainbizCheck'

const s = (text: string, basis: string): Sourced => ({ text, basis })

const GUIDES: Record<string, Pick<InspectionQuestion, 'topic' | 'weight' | 'guide'>> = {
  q_goal: {
    topic: '올해 목표와 실행',
    weight: 3,
    guide: (k): GuideParts => ({ core: k.hasEvidence('vision') ? [s('연간 경영 목표 · 사업계획을 문서로 갖고 있습니다.', '서류함: 경영 목표 · 사업계획')] : [], points: [], ownerAsk: ['올해 회사 목표는 무엇이고, 그 목표를 위해 바꾼 것이 1~2가지 있나요?'] }),
  },
  q_kpi: {
    topic: '성과 점검',
    weight: 3,
    guide: (k) => ({ core: k.hasEvidence('kpi') ? [s('목표 대비 실적을 회의록으로 점검하고 있습니다.', '서류함: 성과 관리 기록')] : [], points: [], ownerAsk: ['매출 · 목표 달성을 얼마나 자주 점검하나요?(예: 매달 회의) 누가 챙기나요?'] }),
  },
  q_finance: {
    topic: '매출 · 이익 흐름',
    weight: 3,
    guide: (k) => {
      const r = k.fact('revenue')
      const o = k.fact('operatingProfit')
      const core = r && o ? [s(`최근 결산 매출 ${r.value}, 영업이익 ${o.value}입니다.`, [r.basis, o.basis].join(' · '))] : r ? [s(`최근 결산 매출은 ${r.value}입니다.`, r.basis)] : []
      return { core, points: [], ownerAsk: ['최근 2~3년 매출이 늘었거나 줄었다면 가장 큰 이유는 무엇인가요?'] }
    },
  },
  q_people: {
    topic: '직원 교육 · 평가',
    weight: 3,
    guide: (k) => {
      const e = k.fact('employees')
      return { core: k.hasEvidence('hr_rules') ? [s('취업규칙 · 교육 기록을 갖추고 있습니다.', '서류함: 취업규칙 · 인사 · 교육 기록')] : [], points: e ? [s(`직원 ${e.value}`, e.basis)] : [], ownerAsk: ['직원 교육은 1년에 몇 번, 어떤 내용으로 하나요?', '직원을 평가하고 보상(성과급 · 승진)하는 기준이 있나요?'] }
    },
  },
  q_trust: {
    topic: '사회적 신뢰(체불 · 산재 · 공정거래)',
    weight: 3,
    guide: (k) => {
      const x = k.fact('exclusion')
      return { core: x && x.value === '없음' ? [s('최근 3년 체불 · 산재 · 공정거래 문제는 확인된 것이 없습니다(신청 전 증명서로 다시 확인).', x.basis)] : [], points: [], ownerAsk: x ? [] : ['최근 3년 안에 산업재해나 공정거래 문제가 있었나요?'] }
    },
  },
}

const MORE: InspectionQuestion[] = [
  {
    id: 'q_org_struct',
    question: '조직은 어떻게 나뉘어 있고 누가 무엇을 책임지나요?',
    intent: '경영혁신 인프라 — 조직 체계',
    topic: '조직 · 책임',
    weight: 2,
    facts: (c) => (c.employees !== null ? [`직원 ${c.employees}명`] : []),
    evidence: ['org_chart'],
    draft: () => null,
    guide: (k) => ({ core: k.hasEvidence('org_chart') ? [s('조직도로 부서와 책임자를 정해 두었습니다.', '서류함: 조직도')] : [], points: [], ownerAsk: ['부서는 어떻게 나뉘고, 부서마다 책임자가 있나요?(조직도가 있으면 사진으로)'] }),
  },
  {
    id: 'q_process',
    question: '최근 업무를 개선한 사례가 있나요?',
    intent: '경영혁신 활동 — 프로세스 혁신',
    topic: '업무 개선 사례',
    weight: 2,
    facts: () => [],
    evidence: ['kpi'],
    draft: () => null,
    guide: () => ({ core: [], points: [], ownerAsk: ['최근 2~3년 안에 직원 업무 방식이나 고객 관리 방법을 바꿔 효과를 본 사례가 있나요?'] }),
  },
  {
    id: 'q_customer',
    question: '고객 만족이나 불만은 어떻게 관리하나요?',
    intent: '경영혁신 활동 — 마케팅 · 고객',
    topic: '고객 관리',
    weight: 2,
    boost: (k) => (k.fact('b2b')?.value === '예' ? '납품 거래처가 있음 — 고객 관리 질문이 자주 나옴' : null),
    facts: () => [],
    evidence: ['customer'],
    draft: () => null,
    guide: (k) => {
      const b = k.fact('b2b')
      return { core: k.hasEvidence('customer') ? [s('고객 만족 · 불만 처리 기록을 남기고 있습니다.', '서류함: 고객 만족 · 품질 개선 기록')] : [], points: b && b.value === '예' ? [s('기업 · 공공 고객에 납품', b.basis)] : [], ownerAsk: ['고객 불만이 들어오면 누가, 어떻게 처리하나요?'] }
    },
  },
  {
    id: 'q_digital',
    question: '업무에 쓰는 시스템(ERP · 그룹웨어 등)이 있나요?',
    intent: '경영혁신 인프라 — 정보화',
    topic: '업무 시스템',
    weight: 1,
    boost: (k) => (k.fact('employees') && parseInt(k.fact('employees')!.value, 10) >= 30 ? '직원 30명 이상 — 업무 시스템을 물을 수 있음' : null),
    facts: () => [],
    evidence: [],
    draft: () => null,
    guide: () => ({ core: [], points: [], ownerAsk: ['회계 · 재고 · 결재에 쓰는 프로그램(ERP · 그룹웨어)이 있나요?'] }),
  },
  {
    id: 'q_esg',
    question: '사회공헌 · 윤리 · 안전 활동은 어떤 게 있나요?',
    intent: '경영혁신 인프라 — 사회적 책임',
    topic: '사회공헌 · 안전',
    weight: 1,
    boost: (k) => (k.fact('industry') && /제조|가공|건설|생산|물류/.test(k.fact('industry')!.value) ? '현장이 있는 업종 — 안전 활동을 물을 수 있음' : null),
    facts: () => [],
    evidence: ['esg'],
    draft: () => null,
    guide: (k) => ({ core: k.hasEvidence('esg') ? [s('사회공헌 · 안전 활동 기록을 갖고 있습니다.', '서류함: 사회공헌 · 윤리 · 안전 기록')] : [], points: [], ownerAsk: ['봉사 · 기부나 직원 안전교육을 한 적이 있나요?'] }),
  },
]

export const MAINBIZ_BANK: InspectionQuestion[] = [...MAINBIZ_INSPECTION.map((q) => ({ ...q, ...GUIDES[q.id] })), ...MORE]
