/** 한글을 자모로 풀어 쓴다 — 글자 인식이 받침 · 모음 하나를 잘못 읽은 것을 '한 글자 차이' 보다 작게 잰다(D-448) */
export function jamoOf(s: string): string {
  let out = ''
  for (const ch of s) {
    const c = ch.charCodeAt(0)
    if (c >= 0xac00 && c <= 0xd7a3) {
      const i = c - 0xac00
      out += String.fromCharCode(0x1100 + Math.floor(i / 588), 0x1161 + Math.floor((i % 588) / 28)) + (i % 28 ? String.fromCharCode(0x11a7 + (i % 28)) : '')
    } else out += ch
  }
  return out
}

/** 두 글의 고칠 거리(넣기 · 빼기 · 바꾸기 한 번 = 1) */
export function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const t = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = t
    }
  }
  return dp[b.length]
}
