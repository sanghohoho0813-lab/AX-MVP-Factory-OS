/**
 * 글 복사 — 클립보드가 막힌 브라우저는 옛 방법(textarea)으로 한 번 더.
 * W7(D-644) 공고 보기 묶음(grantView)에서 뗐다 — 오른쪽 대화 판이 복사 하나 때문에 공고 판정 묶음을 받지 않게. grantView 는 다시 내보낸다.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand?.('copy') ?? false
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
