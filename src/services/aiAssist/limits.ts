/**
 * W7(D-644) AI 대화에서 가볍게 쓰는 값만 — 물음 글자 한도 · ref 정리.
 * context.ts(업체 · 영업 · 공고 자료를 모으는 큰 묶음)에서 뗐다: 앱 뼈대(오른쪽 대화 판 · 모델 고르기)가 이 둘 때문에
 * 큰 묶음을 첫 화면 전에 받았다. context.ts 는 그대로 다시 내보낸다.
 */

/** D-638 대화 · 직접 묻기 물음 글자 수(서버 askLimit 과 같은 수) */
export const ASK_MAX_CHAT = 2000

/**
 * D-241 모델이 돌려준 ref 를 자료의 ref 모양으로 — ' C3 ', '[c3]', '#c3', 'c-3' 도 c3.
 * 모양이 아니면 '' (없는 번호를 만들어 오면 이어 주지 않는다).
 */
export function normRef(ref: unknown): string {
  if (typeof ref !== 'string') return ''
  const t = ref.trim().toLowerCase().replace(/^[[(#\s]+|[\])\s.,]+$/g, '').replace(/^([a-z]{1,3})[-_\s]+(\d)/, '$1$2')
  return /^[a-z]{1,3}\d{1,4}$/.test(t) ? t : ''
}
