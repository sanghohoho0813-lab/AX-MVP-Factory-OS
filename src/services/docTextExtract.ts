/**
 * 업로드한 서류에서 글자를 뽑아낸다.
 *
 *  - PDF: 내장 텍스트를 먼저 읽는다 (인터넷등기소·홈택스 PDF는 대부분 텍스트라 정확하다).
 *         글자가 거의 없으면 스캔본으로 보고 이미지 OCR로 넘어간다.
 *  - 이미지: 한국어 OCR(tesseract).
 *
 * 두 라이브러리 모두 실제로 쓸 때만 내려받도록 동적 import 한다.
 *  - 엑셀(.xlsx): 칸 안의 글자를 그대로 뽑는다 (D-89). 라이브러리를 쓰지 않는다.
 */

import { isXlsxFile, readXlsxText } from './xlsxText'

export type ExtractMethod = 'pdf_text' | 'ocr' | 'text' | 'xlsx'

export interface ExtractResult {
  text: string
  method: ExtractMethod
  /** 진행률 0~1 */
  pages?: number
}

export type ProgressFn = (ratio: number, label: string) => void

/** PDF에서 텍스트 추출 (스캔본이면 빈 문자열에 가깝다) */
async function extractPdfText(file: File, onProgress?: ProgressFn): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  // 워커를 번들에서 함께 제공한다 (CDN 의존 없음)
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const maxPages = Math.min(doc.numPages, 10)
  const chunks: string[] = []
  for (let i = 1; i <= maxPages; i += 1) {
    onProgress?.(i / maxPages, `PDF ${i}/${maxPages}쪽 읽는 중`)
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const line = content.items
      .map((item) => (typeof item === 'object' && item !== null && 'str' in item ? String(item.str) : ''))
      .join(' ')
    chunks.push(line)
  }
  await doc.destroy()
  return chunks.join('\n')
}

/** PDF 첫 장을 이미지로 렌더링 (스캔본 OCR용) */
async function renderPdfFirstPage(file: File): Promise<Blob | null> {
  const pdfjs = await import('pdfjs-dist')
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  await doc.destroy()
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
}

/** 한국어 OCR */
async function ocrImage(input: Blob, onProgress?: ProgressFn): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('kor+eng', undefined, {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress ?? 0, '글자 읽는 중')
      else onProgress?.(0, '한글 인식 준비 중 (처음 한 번은 다소 걸립니다)')
    },
  })
  try {
    const { data } = await worker.recognize(input)
    return data.text ?? ''
  } finally {
    await worker.terminate()
  }
}

/** 글자가 의미 있게 들어있는지 (스캔본 판별) */
function hasEnoughText(text: string): boolean {
  const hangul = (text.match(/[가-힣]/g) ?? []).length
  return hangul >= 20
}

export async function extractTextFromFile(file: File, onProgress?: ProgressFn): Promise<ExtractResult> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  // 엑셀 — 칸 안의 글자만 뽑는다 (라이브러리 없이, D-89)
  if (isXlsxFile(file)) {
    onProgress?.(0.2, '엑셀 여는 중')
    const text = await readXlsxText(await file.arrayBuffer())
    onProgress?.(1, '엑셀 읽음')
    return { text, method: 'xlsx' }
  }
  // 글자 파일은 그대로 읽는다 — 홈택스 텍스트 저장본, 복사해 둔 메모
  if (file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name)) {
    onProgress?.(1, '글자 파일 읽는 중')
    return { text: await file.text(), method: 'text' }
  }

  if (isPdf) {
    onProgress?.(0, 'PDF 여는 중')
    const text = await extractPdfText(file, onProgress)
    if (hasEnoughText(text)) return { text, method: 'pdf_text' }
    // 스캔본 → 첫 장을 이미지로 만들어 OCR
    onProgress?.(0, '스캔본으로 보입니다. 글자 인식으로 전환합니다')
    const png = await renderPdfFirstPage(file)
    if (!png) return { text, method: 'pdf_text' }
    return { text: await ocrImage(png, onProgress), method: 'ocr' }
  }

  onProgress?.(0, '이미지 여는 중')
  return { text: await ocrImage(file, onProgress), method: 'ocr' }
}

export const EXTRACT_METHOD_LABEL: Record<ExtractMethod, string> = {
  pdf_text: 'PDF 글자 추출',
  ocr: '이미지 글자 인식(OCR)',
  text: '글자 파일',
  xlsx: '엑셀 표',
}

/** 판독기가 읽을 수 있는 파일인지 — 아니면 파일 이름만으로 판별한다 */
export function canExtractText(file: File): boolean {
  return (
    isXlsxFile(file) ||
    file.type === 'application/pdf' ||
    /\.pdf$/i.test(file.name) ||
    file.type.startsWith('image/') ||
    /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(file.name) ||
    file.type.startsWith('text/') ||
    /\.(txt|md|csv)$/i.test(file.name)
  )
}
