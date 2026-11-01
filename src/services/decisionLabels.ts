/**
 * 확인할 것(D-158) — 종류 이름표 · 한 번에 처리할 종류 · 할 일 기한 주말 피하기. decisions 가 다시 내보낸다.
 * D-481 오늘 화면 · 확인할 것 모두 보기가 이것 때문에 판정 엔진(clientInsights · 정책자금 · 인증 · 절세)을 처음부터 받던 것을 떼어 냄. 값은 그대로.
 */
import { addDaysLocal } from './clientOpsNextAction'

export type DecisionKind = 'fact' | 'module' | 'grant' | 'doc' | 'money' | 'stale' | 'next' | 'followup' | 'shelf' | 'autofill'

export const DECISION_KIND_LABEL: Record<DecisionKind, string> = {
  fact: '자료에서 읽은 정보',
  module: '해 볼 만한 일',
  grant: '맞는 지원사업',
  doc: '서류 기한',
  money: '받을 돈',
  stale: '밀린 업무',
  next: '다음 약속',
  followup: '다시 연락',
  shelf: '서류함 정리',
  autofill: '바로 넣은 값',
}

/** D-160: 한 번에 '모두 맞아요' 해도 되는 종류 — 복사(카톡 문구)는 하나씩 보내야 하므로 뺀다 */
export const DECISION_BULK_KINDS: DecisionKind[] = ['fact', 'module', 'stale', 'next', 'autofill']

/** 주말이면 다음 월요일로 — 약속 · 기한을 토 · 일에 잡지 않는다 */
export function weekdayOnOrAfter(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 6 ? addDaysLocal(date, 2) : day === 0 ? addDaysLocal(date, 1) : date
}
