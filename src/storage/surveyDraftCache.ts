/**
 * 설문 최신 답변 동기 임시저장 어댑터 (Stage 12C).
 *
 * debounce 자동저장이 실행되기 전에 탭이 닫혀도 마지막 유효 답변을 복구할 수
 * 있도록, 답변 변경 직후 아주 작은 draft 를 동기적으로 localStorage 에 남긴다.
 * 정식 저장(SurveyResponseRepository)과 별개의 임시 캐시이며,
 * 복구 시 updatedAt 비교로 오래된 draft 가 최신 정상 저장을 덮어쓰지 않게 한다.
 *
 * UI 는 이 어댑터를 통해서만 접근한다 (localStorage 직접 호출 금지).
 */

import type { RespondentProfile, SurveyAnswerValue } from '../types/surveyRuntime'

const DRAFT_KEY_PREFIX = 'axmvp.survey.draft.'

export interface SurveyDraftCacheEntry {
  responseId: string
  answers: Record<string, SurveyAnswerValue>
  profile: RespondentProfile
  consented: boolean
  currentPageIndex: number
  /** ISO — 정식 저장(updatedAt)과 비교해 최신일 때만 복구에 사용 */
  updatedAt: string
}

function keyFor(responseId: string): string {
  return `${DRAFT_KEY_PREFIX}${responseId}`
}

/** 동기 저장 — 실패해도 앱을 막지 않는다 (용량 초과 등) */
export function writeSurveyDraft(entry: SurveyDraftCacheEntry): void {
  try {
    localStorage.setItem(keyFor(entry.responseId), JSON.stringify(entry))
  } catch {
    /* 저장 실패는 조용히 무시 — 정식 autosave 경로가 남아 있다 */
  }
}

export function readSurveyDraft(responseId: string): SurveyDraftCacheEntry | null {
  try {
    const raw = localStorage.getItem(keyFor(responseId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SurveyDraftCacheEntry>
    if (
      parsed.responseId !== responseId ||
      typeof parsed.updatedAt !== 'string' ||
      typeof parsed.answers !== 'object' ||
      parsed.answers === null
    ) {
      return null
    }
    return parsed as SurveyDraftCacheEntry
  } catch {
    return null
  }
}

export function clearSurveyDraft(responseId: string): void {
  try {
    localStorage.removeItem(keyFor(responseId))
  } catch {
    /* 무시 */
  }
}

/**
 * draft 가 정식 저장보다 최신인지 판단한다.
 * 정식 저장 시각이 없으면(최초 진입) draft 가 있으면 최신으로 본다.
 */
export function isDraftNewer(
  draft: SurveyDraftCacheEntry,
  lastOfficialSaveIso: string | null,
): boolean {
  if (!lastOfficialSaveIso) return true
  return draft.updatedAt > lastOfficialSaveIso
}
