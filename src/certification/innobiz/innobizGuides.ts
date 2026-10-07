/**
 * 이노비즈 실사 질문 은행 + 말하기 가이드 (P2). 엔진은 core/answerGuide · core/inspectionPackage.
 * 앞 5개(INNOBIZ_INSPECTION)는 P1 실사 대비 흐름 그대로, 뒤 5개는 업체에 따라 골라 쓰는 질문.
 * 가이드는 근거가 있는 문장만 — 없으면 대표 확인 질문으로.
 */
import type { InspectionQuestion } from '../core/inspection'
import type { FactKit, GuideParts, Sourced } from '../core/answerGuide'
import { INNOBIZ_INSPECTION } from './innobizCheck'

const s = (text: string, basis: string): Sourced => ({ text, basis })
const has = (v: string | undefined) => !!v && !/^없음|^0\s*(건|명)?$/.test(v)

function unitLine(k: FactKit): Sourced | null {
  const u = k.fact('researchUnit')
  return u && has(u.value) ? s(`${u.value}에서 직접 개발합니다.`, u.basis) : null
}

const GUIDES: Record<string, Pick<InspectionQuestion, 'topic' | 'weight' | 'guide'>> = {
  q_tech: {
    topic: '핵심 기술 · 차별점',
    weight: 3,
    guide: (k): GuideParts => {
      const p = k.fact('patents')
      const core = [p && has(p.value) ? s(`특허 ${p.value}으로 기술을 보호하고 있습니다.`, p.basis) : null, unitLine(k)].filter(Boolean) as Sourced[]
      // FV: '업종: …' 같은 채움 말은 넣지 않는다 — 기술을 뒷받침하는 사실(보유 인증 · 특허증)만
      const points = [k.held.length ? s(`이미 받은 인증: ${k.held.join(' · ')}`, '회사 정보 인증서 칸 · 진행 기록') : null, p && has(p.value) && k.hasEvidence('patent') ? s('특허증 사본을 보여 드립니다.', '서류함: 특허 등록증') : null].filter(Boolean) as Sourced[]
      return { core, points, ownerAsk: ['우리 회사 핵심 기술을 한 줄로 말하면 무엇이고, 경쟁사와 무엇이 다른가요?', ...(p && has(p.value) ? [] : ['등록했거나 출원 중인 특허가 있나요?'])] }
    },
  },
  q_org: {
    topic: '연구 조직 · 인력',
    weight: 3,
    guide: (k) => {
      const u = k.fact('researchUnit')
      const r = k.fact('researchers')
      const core = u && has(u.value) ? [s(`${u.value}에서${r ? ` 연구전담요원 ${r.value}이` : ''} 개발을 맡고 있습니다.`, [u.basis, r?.basis].filter(Boolean).join(' · '))] : []
      const points = k.hasEvidence('lab_cert') ? [s('연구소 · 전담부서 인정서 원본을 보여 드립니다.', '서류함: 인정서')] : []
      return { core, points, ownerAsk: [...(core.length ? [] : ['연구개발을 맡는 직원이나 부서가 따로 있나요?']), '연구하는 공간은 어디에 있고, 다른 사무 공간과 벽 · 문으로 나뉘어 있나요?'] }
    },
  },
  q_records: {
    topic: '최근 개발 과제 · 기록',
    weight: 3,
    guide: (k) => ({
      core: k.hasEvidence('rnd_records') ? [s('연구노트 · 과제 기록을 보관하고 있어 바로 보여 드릴 수 있습니다.', '서류함: 연구노트 · 과제 기록')] : [],
      points: [],
      ownerAsk: ['최근 1~2년 안에 개발한 것 1~2가지는 무엇이고, 결과는 어땠나요?'],
    }),
  },
  q_sales: {
    topic: '기술 사업화 매출',
    weight: 2,
    guide: (k) => {
      const r = k.fact('revenue')
      return { core: r ? [s(`최근 결산 매출은 ${r.value}입니다.`, r.basis)] : [], points: [], ownerAsk: ['전체 매출 중 우리 기술로 만든 제품 · 서비스 매출은 대략 얼마인가요?', ...(r ? [] : ['작년 매출은 얼마인가요?(재무제표 숫자)'])] }
    },
  },
  q_plan: {
    topic: '3년 기술 개발 계획',
    weight: 2,
    guide: () => ({ core: [], points: [], ownerAsk: ['앞으로 3년 안에 개발하려는 제품이나 기술이 있나요?(무엇을 · 언제쯤)'] }),
  },
}

const MORE: InspectionQuestion[] = [
  {
    id: 'q_ip',
    question: '지식재산(특허 · 상표)은 어떻게 관리하시나요?',
    intent: '기술 축적 — 성과를 권리로 남기는지',
    topic: '지식재산 관리',
    weight: 2,
    facts: (c) => (c.patents ? [`특허 ${c.patents}건`] : []),
    evidence: ['patent'],
    draft: () => null,
    guide: (k) => {
      const p = k.fact('patents')
      return { core: p && has(p.value) ? [s(`등록 · 출원한 특허가 ${p.value} 있습니다.`, p.basis)] : [], points: k.hasEvidence('patent') ? [s('특허증 사본을 준비했습니다.', '서류함: 특허 등록증')] : [], ownerAsk: ['지금 출원 중이거나 준비 중인 특허 · 상표가 있나요?'] }
    },
  },
  {
    id: 'q_rnd_cost',
    question: '연구개발에 돈을 얼마나, 어떻게 쓰고 있나요?',
    intent: '연구개발 투자 — 꾸준한지',
    topic: '연구개발 투자',
    weight: 2,
    boost: (k) => (k.fact('rndExpense') ? '연구개발비가 확인됨 — 투자 질문에 숫자로 답할 수 있음' : null),
    facts: () => [],
    evidence: ['fin3'],
    draft: () => null,
    guide: (k) => {
      const r = k.fact('rndExpense')
      return { core: r && has(r.value) ? [s(`최근 연구개발비는 ${r.value} 정도입니다.`, r.basis)] : [], points: [], ownerAsk: ['작년에 연구개발에 쓴 돈은 대략 얼마이고, 주로 어디에 썼나요?(연구원 월급 · 재료 · 외주)'] }
    },
  },
  {
    id: 'q_quality',
    question: '품질이나 공정을 개선한 사례가 있나요?',
    intent: '기술 사업화 — 생산 · 품질 관리',
    topic: '품질 · 공정 개선',
    weight: 1,
    boost: (k) => (k.fact('industry') && /제조|가공|생산|부품/.test(k.fact('industry')!.value) ? '제조업 — 품질 · 공정 질문이 자주 나옴' : k.held.some((h) => /ISO/.test(h)) ? 'ISO 보유 — 품질 체계를 보여 줄 수 있음' : null),
    facts: () => [],
    evidence: ['quality'],
    draft: () => null,
    guide: (k) => {
      const iso = k.held.filter((h) => /ISO/.test(h))
      return { core: iso.length ? [s(`${iso.join(' · ')} 인증으로 품질을 관리하고 있습니다.`, '회사 정보 인증서 칸')] : [], points: k.hasEvidence('quality') ? [s('품질 관리 자료를 준비했습니다.', '서류함: 품질 · 인증 현황')] : [], ownerAsk: ['최근 2~3년 안에 불량을 줄이거나 공정을 바꿔 좋아진 사례가 있나요?'] }
    },
  },
  {
    id: 'q_people_tech',
    question: '기술 인력은 어떻게 키우고 계신가요?',
    intent: '기술혁신 경영 — 인력 육성',
    topic: '기술 인력 육성',
    weight: 1,
    facts: (c) => (c.employees !== null ? [`직원 ${c.employees}명`] : []),
    evidence: ['org_chart'],
    draft: () => null,
    guide: (k) => {
      const e = k.fact('employees')
      return { core: [], points: e ? [s(`직원 ${e.value}`, e.basis)] : [], ownerAsk: ['기술 직원이 교육을 받거나 자격증을 따도록 회사가 돕고 있나요?'] }
    },
  },
  {
    id: 'q_market',
    question: '주요 고객과 시장은 어디인가요?',
    intent: '기술 사업화 — 판로',
    topic: '고객 · 시장',
    weight: 2,
    boost: (k) => (k.fact('b2b')?.value === '예' ? '납품 거래처가 있음 — 판로 질문에 답할 거리가 있음' : null),
    facts: () => [],
    evidence: ['biz_plan'],
    draft: () => null,
    guide: (k) => {
      const b = k.fact('b2b')
      return { core: b && b.value === '예' ? [s('기업 · 공공 고객에 납품합니다.', b.basis)] : [], points: [], ownerAsk: ['주요 거래처 3곳은 어디이고, 그 회사들이 우리를 고른 이유는 무엇인가요?'] }
    },
  },
]

/** 패키지에 쓰는 이노비즈 질문 전부(앞 5개 = P1 흐름) */
export const INNOBIZ_BANK: InspectionQuestion[] = [...INNOBIZ_INSPECTION.map((q) => ({ ...q, ...GUIDES[q.id] })), ...MORE]
