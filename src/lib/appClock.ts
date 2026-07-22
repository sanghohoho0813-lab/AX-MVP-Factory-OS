/**
 * 앱 공용 시계 — "오늘 하루 보지 않기" 등 날짜 경계 판단을 한곳에 모은다.
 *
 * 규칙:
 *  - 스누즈/일일 노출은 로컬 "날짜"(YYYY-MM-DD) 기준으로 판단한다(+24시간이 아님).
 *  - 테스트에서 시각을 주입할 수 있도록 override 를 둔다(도메인 계산과 무관, UI 안내용).
 */

let nowOverride: (() => Date) | null = null

/** 현재 시각 (테스트 주입 가능) */
export function nowDate(): Date {
  return nowOverride ? nowOverride() : new Date()
}

/** ISO 문자열 (저장용) */
export function nowIso(): string {
  return nowDate().toISOString()
}

/** 로컬 기준 오늘 날짜 문자열 YYYY-MM-DD (스누즈·일일 노출 경계) */
export function todayLocalDate(at: Date = nowDate()): string {
  const y = at.getFullYear()
  const m = String(at.getMonth() + 1).padStart(2, '0')
  const d = String(at.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 테스트 전용 — 고정 시각을 주입한다. null 로 해제.
 * (프로덕션 코드 경로에서는 호출하지 않는다.)
 */
export function __setClockForTest(fn: (() => Date) | null): void {
  nowOverride = fn
}
