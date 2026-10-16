/**
 * 서류함 보기 방식 — 목차(서류 칸) · 폴더 (D-204). 이 브라우저에 기억한다(사람별 금고 — 다른 화면 설정과 같은 칸).
 * 저장이 막힌 브라우저(사생활 모드 등)에서도 화면은 그대로 된다 — 기본은 목차.
 */
export type DocView = 'list' | 'folder'

const KEY = 'axmvp.ui.doc_view'

export function readDocView(): DocView {
  try {
    return window.localStorage.getItem(KEY) === 'folder' ? 'folder' : 'list'
  } catch {
    return 'list'
  }
}

export function writeDocView(v: DocView): void {
  try {
    window.localStorage.setItem(KEY, v)
  } catch {
    /* 기억 못 해도 지금 화면은 바뀐다 */
  }
}
