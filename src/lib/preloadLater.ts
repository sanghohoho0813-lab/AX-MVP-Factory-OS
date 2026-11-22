/**
 * D-648 미리 받기는 화면이 다 뜬 뒤에 — 누르면 바로 열리게 미리 받아 두는 조각(찾기 창 · 안내 글 · 등록 창 서류 칸 · 화면 이름 표)은
 * 지금 화면을 그리는 조각과 대역을 다투면 안 된다. requestIdleCallback 만 쓰면 느린 휴대폰에서는 '조각을 기다리는 빈 시간' 에도 불려
 * 화면이 뜨기 전에 시작됐다(2026-11-22 느린 4G 흉내에서 약 7초에 시작 · 화면은 8.3초).
 * 그래서: 문서 load 뒤 → delayMs 기다림 → 그다음 한가할 때. 그 전에 누르면 각 자리에서 그때 받는다(받는 동안 한 줄 안내).
 * 돌려주는 함수를 부르면 취소된다(화면을 떠날 때).
 */
export function preloadLater(fn: () => void, delayMs = 5000): () => void {
  if (typeof window === 'undefined') return () => {}
  let timer = 0
  let idle = 0
  const hasIdle = typeof window.requestIdleCallback === 'function'
  const run = () => {
    if (hasIdle) idle = window.requestIdleCallback(fn, { timeout: 4000 })
    else fn()
  }
  const start = () => {
    timer = window.setTimeout(run, delayMs)
  }
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
  return () => {
    window.removeEventListener('load', start)
    window.clearTimeout(timer)
    if (idle && hasIdle) window.cancelIdleCallback(idle)
  }
}
