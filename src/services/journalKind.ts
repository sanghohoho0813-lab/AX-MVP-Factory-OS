/**
 * 할 일 종류 둘 — 업무(기본) · 개인 일정 (2026-11-02 대표 지시).
 *
 *  - DB 칸을 새로 만들지 않는다: 업무 일기의 service_key 칸(할 일에는 비어 있던 칸)에 'personal' 을 적어 개인 일정을 표시한다.
 *    업무 일기(ops_journal_entries)는 처음부터 '쓴 사람 본인만' 읽고 쓴다(RLS owner_id = auth.uid()) — 관리자 · 다른 구성원 · 고객 모두 못 본다.
 *  - 개인 일정 칸은 아주 연한 하늘색(대표 지시 — 박스 색 하나 규칙의 예외). 업무는 그대로 흰 칸.
 */
export const PERSONAL_KEY = 'personal'

export type TodoKind = 'work' | 'personal'

export const TODO_KIND_LABEL: Record<TodoKind, string> = { work: '업무', personal: '개인 일정' }

export const isPersonalEntry = (e: { serviceKey?: string | null }): boolean => e.serviceKey === PERSONAL_KEY

export const kindOfEntry = (e: { serviceKey?: string | null }): TodoKind => (isPersonalEntry(e) ? 'personal' : 'work')

/** 개인 일정 칸 — 아주 연한 하늘색 바탕 · 테두리 */
export const PERSONAL_TINT = 'border-sky-200 bg-sky-50'

/** 할 일 · 업무 일기 · 일정 화면의 안내 한 줄 — 사실(RLS)과 같은 말만 쓴다 */
export const PRIVATE_NOTE = '내가 적은 할 일 · 기록은 나만 봐요 — 관리자 · 다른 사람 · 고객에게 공유되지 않아요'
