/**
 * D-505 말에서 읽은 것(사정 · 숫자 · 다음 약속)을 업체 기록에 — 오늘 대화창 · 업체 상세 업무 일기가 같은 길을 쓴다.
 *  - 사정 → 상황 예시 질문의 답(decided['scn.*'] · 맞춤 추천과 같은 칸)
 *  - 숫자 → 사실 창고(출처 '상담 메모' · 해)
 *  - 다음 약속 → 업체 '다음 할 일'(날짜 · 무엇 · 활동 기록)
 * 이미 업체에 같은 값이면 처음부터 뺀다(talkFound) — 다시 기록하자고 하지 않게.
 */
import type { ClientOpsRecord } from '../../types/clientOps'
import { scenarioAnswer, withScenarioAnswer } from '../scenarioFit'
import { readFact, withFactValue } from '../customerFacts'
import { withNextAction } from '../clientOpsNextAction'
import { newFacts, newNumbers, talkAnswers, talkNext, talkNumbers, type TalkAnswer, type TalkNext, type TalkNumber } from './homeTalk'

export interface TalkFound {
  answers: TalkAnswer[]
  numbers: TalkNumber[]
  next: TalkNext | null
}

/** 이 업체에 아직 없는 것만 — 사실(가정은 빼고) · 다른 숫자 · 다른 다음 약속 */
export function talkFound(text: string, record: ClientOpsRecord, today: string): TalkFound {
  const said = talkNext(text, today)
  return {
    answers: newFacts(talkAnswers(text), (k) => scenarioAnswer(record, k)),
    numbers: newNumbers(talkNumbers(text, Number(today.slice(0, 4))), (k) => readFact(record, k)?.value ?? ''),
    next: said && !(record.nextActionDueDate === said.date && record.nextAction === said.text) ? said : null,
  }
}

export const hasTalk = (f: Pick<TalkFound, 'answers' | 'numbers' | 'next'>): boolean => f.answers.length > 0 || f.numbers.length > 0 || !!f.next

/** 읽은 것을 기록에 — 숫자 → 사정 → 다음 약속 순서(같은 저장 한 번) */
export function applyTalk(record: ClientOpsRecord, f: Pick<TalkFound, 'answers' | 'numbers' | 'next'>, now: string): ClientOpsRecord {
  const withNums = f.numbers.reduce((r, n) => withFactValue(r, n.key, n.value, { source: 'meeting', asOf: n.asOf, now }), record)
  const withAnswers = f.answers.reduce((r, t) => withScenarioAnswer(r, t.key, t.a, now), withNums)
  return f.next ? withNextAction(withAnswers, f.next.text, f.next.date, { at: now }) : withAnswers
}
