import { preloadLater } from '../lib/preloadLater'

/**
 * D-590 앱 뼈대와 함께 받는 조각들 — 뼈대(AppShell) + 화면을 감싸는 틀(업체로 열기 · 모듈 목차).
 *
 * 로그인 화면이 앱 뼈대(메뉴 · 머리줄 · 찾기 · 알림과 거기 딸린 판정 규칙들)까지 받지 않게 조각으로 뗐다.
 *  - 화면 목록(appRouteChildren)은 이 틀들을 필요할 때 받게 해 두었다. 뼈대를 받을 때 같이 받아 두면,
 *    모듈 화면을 처음 열 때 틀을 받으러 한 번씩 더 기다리지 않는다.
 *  - 이미 로그인해 둔 브라우저(저장된 로그인 표가 있음)는 기다리지 않게, 첫 조각을 읽자마자 미리 받기 시작한다.
 * D-649 모듈 대화창 틀(ChatFirst)은 뼈대를 기다리게 하지 않는다 — 그 틀은 맞춤 추천 · 계산기 · 상황 예시 규칙까지 끌어와
 *   (조각 62개 · 압축 약 320KB) 모듈을 열지 않는 화면(오늘 · 고객 관리 · 일정 · 마케팅)도 그만큼 더 받은 뒤에야 그려졌다.
 *   이제 화면이 다 뜬 뒤 한가할 때 받아 둔다(warmChatFirstLater). 그 전에 모듈을 열면 그때 받는다.
 * 이 파일은 가볍다(받으라는 말만 있다) — 첫 조각에 들어가도 된다.
 */
export function loadShellChunks() {
  const ready = Promise.all([
    import('../components/layout/AppShell'),
    import('../tools/shared/toolClientContext'),
    import('../tools/shared/ModuleRoute'),
  ]).then(([shell]) => ({ default: shell.AppShell }))
  void ready.then(() => warmChatFirstLater()).catch(() => {})
  return ready
}

let chatFirstWarm = false
/** D-649 모듈 대화창 틀은 화면이 다 뜬 뒤에(preloadLater) 한 번만 받아 둔다 — 실패해도 조용히(모듈을 열 때 다시 받는다) */
export function warmChatFirstLater(): void {
  if (chatFirstWarm) return
  chatFirstWarm = true
  preloadLater(() => void import('../components/chat/ChatFirst').catch(() => {}))
}

/** 이 브라우저에 로그인해 둔 표(Supabase 가 저장하는 sb-…-auth-token)가 있는가 — 값은 읽지 않는다 */
export function hasSavedSignIn(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      if (/^sb-.+-auth-token/.test(localStorage.key(i) ?? '')) return true
    }
  } catch {
    /* 저장 공간을 못 읽으면 미리 받지 않는다 — 로그인한 뒤에 받는다 */
  }
  return false
}

/** 로그인해 둔 브라우저면 앱 뼈대를 미리 받기 시작한다(실패해도 조용히 — 필요할 때 다시 받는다) */
export function preloadShellIfSignedIn(): void {
  if (hasSavedSignIn()) void loadShellChunks().catch(() => {})
}
