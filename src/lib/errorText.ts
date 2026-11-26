/**
 * D-678 실패를 사람 말로 — 영어 원문(브라우저 · 통신 · DB 가 낸 글)을 화면에 그대로 보이지 않는다(SALE-4 상태 안내).
 *
 * 예전: 화면 곳곳이 `cause instanceof Error ? cause.message : '저장하지 못했습니다.'` 로 실패를 보였다.
 *       우리가 한국어로 적어 던진 글은 괜찮지만, 인터넷이 끊기면 'Failed to fetch', 코드가 틀리면 'TypeError: …' 가 그대로 떴다.
 *  - errorText(cause, fallback): 한국어로 적힌 글은 그대로 · 통신이 끊긴 것이면 '인터넷 연결을 확인' · 그 밖의 원문은 화면이 정한 글.
 *  - plainMessage(message): 이미 만들어진 알림 글의 안전망(알림 띠가 한 번 지난다) — 원문 조각만 걷어 낸다. 한국어 글은 건드리지 않는다.
 * 규칙만 본다(글자 모양). 무슨 일이 있었는지 숨기려는 것이 아니다 — 원문은 화면 오류 전달(services/support)이 운영자에게 따로 보낸다.
 */

const HANGUL = /[가-힣]/
/** 통신이 끊겼을 때 브라우저 · 라이브러리가 내는 글 */
const OFFLINE = /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet|err_network|network error/i
/** 그 밖에 사람이 읽을 글이 아닌 것(코드 오류 · DB · 통신 규약) */
const RAW = /typeerror|referenceerror|syntaxerror|rangeerror|\bjwt\b|row-level security|violates|permission denied|duplicate key|pgrst\d*|postgrest|unexpected token|is not defined|is not a function|cannot read|of undefined|of null|aborterror|timed? ?out|status code|bad gateway|internal server error/i

export const OFFLINE_TEXT = '인터넷 연결이 끊긴 것 같아요 — 연결을 확인한 뒤 다시 눌러 주세요.'
export const GENERIC_FAIL_TEXT = '처리하지 못했어요 — 잠시 뒤 다시 눌러 주세요.'

function messageOf(cause: unknown): string {
  if (cause instanceof Error) return cause.message ?? ''
  if (typeof cause === 'string') return cause
  if (cause && typeof cause === 'object' && 'message' in cause) {
    const m = (cause as { message?: unknown }).message
    return typeof m === 'string' ? m : ''
  }
  return ''
}

/** 통신이 끊긴 실패인가 — 원문 모양 또는 브라우저가 '끊김' 이라고 할 때 */
export function isOfflineError(cause: unknown): boolean {
  if (OFFLINE.test(messageOf(cause))) return true
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** 화면에 보일 실패 글 — 한국어로 적힌 글은 그대로, 영어 원문은 보이지 않는다 */
export function errorText(cause: unknown, fallback: string): string {
  const msg = messageOf(cause).trim()
  if (msg && HANGUL.test(msg) && !RAW.test(msg) && !OFFLINE.test(msg)) return msg
  if (msg && HANGUL.test(msg)) return plainMessage(msg) || fallback
  if (isOfflineError(cause)) return OFFLINE_TEXT
  return fallback
}

/**
 * 알림 글 안전망 — '되돌리지 못했습니다 — Failed to fetch' 처럼 원문 조각이 섞인 글에서 그 조각만 걷어 낸다.
 * 한국어뿐인 글 · 원문 모양이 아닌 영어(파일 이름 · PDF 같은 말)는 그대로 돌려준다.
 */
export function plainMessage(message: string): string {
  const text = String(message ?? '')
  if (!OFFLINE.test(text) && !RAW.test(text)) return text
  // 통째로 원문
  if (!HANGUL.test(text)) return OFFLINE.test(text) ? OFFLINE_TEXT : GENERIC_FAIL_TEXT
  // 한국어 글 + 원문 조각 — ' — ' · ': ' · ' · ' 로 나뉜 조각 가운데 한국어가 없는 원문만 뺀다
  const parts = text.split(/( — |: | · )/)
  const kept: string[] = []
  let offline = false
  for (let i = 0; i < parts.length; i += 2) {
    const part = parts[i]
    const raw = !HANGUL.test(part) && (OFFLINE.test(part) || RAW.test(part))
    if (raw) {
      if (OFFLINE.test(part)) offline = true
      continue
    }
    if (kept.length) kept.push(parts[i - 1] ?? ' — ')
    kept.push(part)
  }
  const out = kept.join('').trim()
  if (!out) return offline ? OFFLINE_TEXT : GENERIC_FAIL_TEXT
  return offline ? `${out} — 인터넷 연결을 확인해 주세요.` : out
}
