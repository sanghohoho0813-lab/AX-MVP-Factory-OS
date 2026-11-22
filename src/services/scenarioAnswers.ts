/**
 * 상황 예시 질문 · 대표의 답(decided['scn.*']) — 읽고 쓰는 작은 조각.
 * 오늘 '할 일 적기' 처럼 판정 없이 답만 읽고 쓰는 화면이 판정 묶음(scenarioFit)을 통째로 받지 않게 떼어 냈다.
 */
import type { ClientOpsRecord } from '../types/clientOps'

/** 대표에게 묻는 것 — 같은 질문을 여러 상황이 함께 쓴다(한 번 답하면 같이 열린다) */
export const SCENARIO_QUESTIONS = {
  hireYouth: '청년(만 15~34세)을 새로 뽑을 계획이 있나요?',
  hireSenior: '만 60세 이상을 새로 뽑을 계획이 있나요?',
  childcare: '육아휴직을 쓰고 있거나 쓸 직원이 있나요?',
  contract: '계약직(기간제) 직원이 있나요?',
  researchStaff: '연구 · 개발을 맡을 직원(이공계 학위 · 관련 경력)이 있나요?',
  prototype: '올해 시제품 · 개발 재료비가 드나요?',
  conversion: '개인사업자에서 법인으로 바꾼 회사인가요?',
  facility: '기계 · 설비를 살 계획(견적)이 있나요?',
  succession: '자녀에게 회사 지분을 넘길 계획이 있나요?',
  loan: '가지급금(대표가 회사 돈을 가져다 쓴 것)이 있나요?',
  retire: '대표 퇴임이나 퇴직금 중간정산을 생각하고 있나요?',
  lendToCorp: '대표가 회사에 빌려준 돈(가수금)이 있거나 빌려줄 계획이 있나요?',
  giftToCorp: '대표가 회사에 현금 · 부동산을 넣어 줄 계획이 있나요?',
  // NX-4 상황 예시 더 — 기록으로 알 수 없는 것만 묻는다
  hireWoman: '경력단절 여성을 새로 뽑을 계획이 있나요?',
  hireDisabled: '장애인을 새로 뽑을 계획이 있나요?',
  flexWork: '유연근무(시차출퇴근 · 재택)를 도입할 계획이 있나요?',
  retireKeep: '정년이 됐거나 곧 될 직원이 있나요?',
  interior: '매장 · 사무실 인테리어나 리모델링 계획이 있나요?',
  highRateLoan: '금리가 높은 대출(제2금융권 등)이 있나요?',
  salesDrop: '최근 매출이 갑자기 크게 줄었나요?',
  acquired: '남의 사업(사업장 · 설비)을 넘겨받아 시작했나요?',
  reopened: '예전에 같은 업종 사업을 접고 다시 시작했나요?',
} as const

export type QuestionKey = keyof typeof SCENARIO_QUESTIONS

const answerKey = (q: QuestionKey) => `scn.${q}`

export function scenarioAnswer(record: Pick<ClientOpsRecord, 'decided'>, q: QuestionKey): 'yes' | 'no' | null {
  return record.decided?.[answerKey(q)]?.a ?? null
}

/** 대표의 답 저장(null 이면 지운다 — 답 바꾸기) */
export function withScenarioAnswer(record: ClientOpsRecord, q: QuestionKey, a: 'yes' | 'no' | null, now: string): ClientOpsRecord {
  const decided = { ...(record.decided ?? {}) }
  if (a === null) delete decided[answerKey(q)]
  else decided[answerKey(q)] = { a, at: now }
  return { ...record, decided }
}
