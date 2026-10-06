/**
 * 업체 없이 쓰는 도구 칸 — 작업공간마다 따로 (D-165).
 *
 * 도구 입력값은 업체로 열면 `…<업체 id>` 칸에 따로 두므로 작업공간이 섞일 일이 없다. 그런데 업체 없이 연
 * 도구는 브라우저에 한 칸뿐이라, 같은 사람이 작업공간을 바꾸면(대표 → 팀장 화면) 앞 작업공간에서 적던 숫자가
 * 그대로 보이고 그 작업공간 업체에 붙을 수 있었다. 클라우드 모드에서는 그 칸 이름 뒤에 작업공간 id 를 붙인다.
 *
 *   - 로컬 모드(작업공간 없음)는 예전 칸 그대로 — 아무것도 옮기지 않는다.
 *   - 예전 칸에 값이 있으면 처음 연 작업공간 칸으로 한 번 옮긴다(지우지 않고 옮긴다 — 다른 작업공간에 또 보이지 않게).
 *   - 칸 이름은 그대로 `axmvp.tools.` · `axmvp.tax` 로 시작한다 — 백업 · 사람별 저장소 금고가 그대로 담는다.
 */

let currentWorkspace: string | null = null

/** 도구 틀(ToolClientFrame)이 지금 작업공간을 알려 준다 */
export function setToolWorkspace(workspaceId: string | null): void {
  currentWorkspace = workspaceId
}

export function sharedToolKey(base: string, workspaceId: string | null = currentWorkspace): string {
  if (!workspaceId) return base
  const scoped = `${base}@ws.${workspaceId}`
  try {
    if (localStorage.getItem(scoped) === null) {
      const old = localStorage.getItem(base)
      if (old !== null) {
        localStorage.setItem(scoped, old)
        localStorage.removeItem(base)
      }
    }
  } catch {
    /* 저장소를 못 쓰면 새 칸 이름만 돌려준다 */
  }
  return scoped
}
