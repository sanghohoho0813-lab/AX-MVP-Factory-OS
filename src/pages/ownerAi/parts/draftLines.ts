/** D-219: 줄 칸 다듬기 — DraftTextarea 와 함께 쓴다 */

/** 한 줄에 하나 — 앞뒤 빈칸 다듬고 빈 줄 뺌 */
export function tidyLines(text: string, max = Infinity): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max)
}

/** 첫 줄 제목 + 나머지 줄 */
export function titledLines(text: string, max = Infinity): { title: string; lines: string[] } {
  const [t = '', ...rest] = text.split('\n')
  return { title: t.trim(), lines: tidyLines(rest.join('\n'), max) }
}
