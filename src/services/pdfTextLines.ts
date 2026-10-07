/**
 * pdf.js 글자 조각 → 줄 (D-168).
 *
 * 예전에는 한 쪽의 조각을 전부 띄어쓰기로 이어 '한 줄' 로 만들었다 → 서류 맨 위 제목 줄을 못 찾았다
 * (22자 넘는 줄은 제목 후보에서 빠진다). 이제 조각의 높이(y) 가 바뀌거나 pdf.js 가 줄 끝(hasEOL)을 알려 주면 줄을 바꾸고,
 * 같은 줄 안에서는 글자 사이가 벌어졌을 때만 띄어 쓴다('사 업 자 등 록 증' 처럼 글자마다 조각이어도 붙는다 —
 * 실제로 띄어 쓴 제목은 compactTitle 이 붙여서 본다).
 */
export interface PdfTextItem {
  str: string
  transform?: number[]
  width?: number
  height?: number
  hasEOL?: boolean
}

export function pdfItemsToText(items: readonly unknown[]): string {
  const lines: string[] = []
  let line = ''
  let lastY: number | null = null
  let lastEnd: number | null = null
  let lastH = 0
  let breakNext = false
  for (const raw of items) {
    if (!raw || typeof raw !== 'object' || !('str' in raw)) continue
    const it = raw as PdfTextItem
    const str = String(it.str ?? '')
    const t = Array.isArray(it.transform) && it.transform.length >= 6 ? it.transform : null
    const x = t ? t[4] : null
    const y = t ? t[5] : null
    const h = Math.abs(it.height ?? (t ? t[3] : 0)) || lastH || 10
    const newLine = breakNext || (y !== null && lastY !== null && Math.abs(y - lastY) > Math.max(2, Math.min(h, lastH || h) * 0.5))
    if (newLine && line.trim()) {
      lines.push(line.trim())
      line = ''
      lastEnd = null
    }
    if (str) {
      // 같은 줄 — 앞 조각 끝과 이 조각 시작 사이가 글자 높이의 1/4 보다 벌어졌으면 띄어 쓴다(위치를 모르면 띄어 쓴다)
      const gap = x !== null && lastEnd !== null ? x - lastEnd : null
      const space = line !== '' && !/\s$/.test(line) && !/^\s/.test(str) && (gap === null || gap > h * 0.25)
      line += (space ? ' ' : '') + str
      if (x !== null && typeof it.width === 'number') lastEnd = x + it.width
      else lastEnd = null
    }
    if (y !== null && str.trim()) {
      lastY = y
      lastH = h
    }
    breakNext = Boolean(it.hasEOL)
  }
  if (line.trim()) lines.push(line.trim())
  return lines.join('\n')
}
