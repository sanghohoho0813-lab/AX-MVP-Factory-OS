/**
 * 크레탑 PDF → 줄 단위 텍스트 (D-88).
 *
 * 원본 App.jsx `extractPdfLayout` 을 옮긴 것. 글자의 좌표(x·y)를 살려 같은 줄에 있던 글자를 다시 한 줄로
 * 묶는다 — 크레탑 표는 "계정명  2023  2024  2025" 처럼 한 줄에 숫자가 여러 개라서, 줄을 잃으면 연도별
 * 숫자가 섞인다. 줄 묶기 자체는 엔진의 `groupItemsIntoLines` 를 그대로 쓴다.
 *
 * pdfjs 는 실제로 쓸 때만 내려받는다. OCR 은 하지 않는다 — 스캔본이면 그렇게 말한다.
 */

import { groupItemsIntoLines } from '../engine/index.js'

export interface PdfLayoutResult {
  rawText: string
  layoutText: string
  numPages: number
  chars: number
  fileName: string
}

interface TextItemLike {
  str?: string
  hasEOL?: boolean
  transform?: number[]
  width?: number
  height?: number
}

export async function extractPdfLayout(file: File, onProgress?: (page: number, total: number) => void): Promise<PdfLayoutResult> {
  const pdfjs = await import('pdfjs-dist')
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
  const pageLines: string[] = []
  let rawText = ''
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const items: Array<{ text: string; x: number; y: number; w: number; h: number }> = []
    let rline = ''
    for (const raw of content.items as TextItemLike[]) {
      if (!raw || typeof raw.str !== 'string') continue
      rline += raw.str + (raw.hasEOL ? '\n' : ' ')
      if (raw.str.trim() === '') continue
      const tr = raw.transform || [1, 0, 0, 1, 0, 0]
      items.push({ text: raw.str, x: tr[4], y: tr[5], w: raw.width || 0, h: raw.height || Math.abs(tr[3]) || 10 })
    }
    rawText += rline + '\n'
    const lines = groupItemsIntoLines(items)
    pageLines.push(lines.map((l) => l.text).join('\n'))
    onProgress?.(i, doc.numPages)
  }
  try {
    await doc.destroy()
  } catch {
    /* 이미 닫혔으면 그만 */
  }
  const layoutText = pageLines.join('\n').trim()
  return { rawText, layoutText, numPages: doc.numPages, chars: (layoutText || rawText || '').length, fileName: file.name }
}
