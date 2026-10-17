/**
 * 고른 작업공간 — 이 브라우저에 하나(새로 열 때 이 값으로 연다). 읽고 쓰는 곳은 여기뿐.
 */
const WORKSPACE_STORAGE_KEY = 'axmvp.active_workspace'

export function readStoredWorkspace(): string | null {
  try {
    return window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeStoredWorkspace(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(WORKSPACE_STORAGE_KEY, id)
    else window.localStorage.removeItem(WORKSPACE_STORAGE_KEY)
  } catch {
    // 무시 (세션 내 상태는 유지)
  }
}

/**
 * D-223 작업공간을 바꾸고 화면을 새로 연다 — 고른 값은 '새로 열 때' 쓰도록 저장만 하고, 지금 화면의 작업공간(메모리)은 건드리지 않는다.
 * 예전에는 메모리부터 바꾼 뒤 새로 열어, '이 페이지를 나가시겠습니까?' 에서 [취소] 하면 화면은 대표 것인데 저장은 팀장 작업공간으로 갔다.
 * 이제 [취소] 하면 이 화면은 끝까지 지금 작업공간에 저장한다(다음에 새로 열 때 고른 쪽으로 열린다).
 */
export function switchWorkspaceThenGo(id: string, go: () => void): void {
  writeStoredWorkspace(id)
  go()
}

/** D-223 초대 링크(/join/코드)로 왔다가 로그인 · 가입하면 그 초대 화면으로 — 없으면 홈 */
export function afterSignInPath(): string {
  try {
    const t = window.sessionStorage.getItem('axmvp.pending_invite')
    return t ? `/join/${encodeURIComponent(t)}` : '/'
  } catch {
    return '/'
  }
}
