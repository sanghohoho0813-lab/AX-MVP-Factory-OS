/**
 * 업로드한 서류에서 글자를 뽑아낸다.
 *
 *  - PDF: 내장 텍스트를 먼저 읽는다 (인터넷등기소·홈택스 PDF는 대부분 텍스트라 정확하다).
 *         글자가 거의 없으면 스캔본으로 보고 이미지 OCR로 넘어간다.
 *  - 이미지: 한국어 OCR(tesseract).
 *
 * 두 라이브러리 모두 실제로 쓸 때만 내려받도록 동적 import 한다.
 *  - 엑셀(.xlsx): 칸 안의 글자를 그대로 뽑는다 (D-89). 라이브러리를 쓰지 않는다.
 *  - 한글(.hwp · .hwpx) · 워드(.docx): 본문 글과 표를 뽑는다 (D-266 — officeText). 라이브러리를 쓰지 않는다.
 *  - 옛 엑셀(.xls) · 옛 워드(.doc) · 파워포인트(.pptx): D-301 — legacyOffice. 이름만 옛 형식인 웹 표 · RTF 도 글만.
 */

import { isXlsxFile, readXlsxText } from './xlsxText'
import { pdfItemsToText } from './pdfTextLines'
import { REREAD_MARK } from './bizNoRead'
import { ensureMapUpsert } from '../lib/mapUpsert'
import { officeKindOf, officeText } from './officeText'
import { legacyKindOf, legacyText } from './legacyOffice'
import type { PDFDocumentProxy } from 'pdfjs-dist'

export type ExtractMethod = 'pdf_text' | 'ocr' | 'text' | 'xlsx' | 'hwp' | 'docx' | 'xls' | 'doc' | 'pptx'

export interface ExtractResult {
  text: string
  method: ExtractMethod
  /** 진행률 0~1 */
  pages?: number
}

export type ProgressFn = (ratio: number, label: string) => void

/** PDF에서 텍스트 추출 (스캔본이면 빈 문자열에 가깝다) */
async function extractPdfText(file: File, onProgress?: ProgressFn): Promise<string> {
  ensureMapUpsert()
  const pdfjs = await import('pdfjs-dist')
  // 워커를 번들에서 함께 제공한다 (CDN 의존 없음)
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

  const buf = await file.arrayBuffer()
  // pdf.js 6: 문서 닫기는 불러오기 작업(task)이 맡는다 (6 판부터 글꼴 코드 실행 자체가 없다)
  const task = pdfjs.getDocument({ data: buf })
  const doc = await task.promise
  const maxPages = Math.min(doc.numPages, 10)
  const chunks: string[] = []
  for (let i = 1; i <= maxPages; i += 1) {
    onProgress?.(i / maxPages, `PDF ${i}/${maxPages}쪽 읽는 중`)
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    // D-168: 줄을 살린다(높이 · 줄 끝) — 서류 맨 위 제목 줄을 찾을 수 있게
    chunks.push(pdfItemsToText(content.items))
  }
  await task.destroy()
  // D-386 쪽 사이에 쪽 나눔(\f) — 여러 서류를 한 PDF 로 합쳐 보냈으면 쪽마다 나눠 읽는다(docBundle). 줄 나눔 사이라 다른 읽기에는 빈 줄
  return chunks.join('\n\f\n')
}

/**
 * 글자 인식에 넘길 그림 폭 — 스캔 A4 를 300dpi 쯤으로(약 2,480px).
 * D-255: 예전에는 PDF 첫 장을 144dpi(2배)로만 그려, 300dpi 로 잘 스캔한 서류도 절반 크기로 뭉개져
 * 작은 숫자(7 · 1)가 헷갈렸다. 사진도 작으면 키운다(글자 높이가 20px 은 넘어야 잘 읽힌다).
 */
const OCR_WIDTH = 2480
const OCR_MAX_WIDTH = 3300

/**
 * D-423 스캔 PDF 는 앞 4쪽까지 글자 인식 — 예전에는 첫 장만 읽어, 스캔 재무제표의 둘째 장(손익계산서 · 매출) ·
 * 등기부 뒷장(임원에 관한 사항 · 대표 취임일) · 여러 장 명부를 못 읽었다. 한 쪽씩 그리고 읽고 지운다(메모리).
 */
const MAX_OCR_PAGES = 4

async function ocrPdfPages(file: File, onProgress?: ProgressFn): Promise<string | null> {
  ensureMapUpsert()
  const pdfjs = await import('pdfjs-dist')
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  const buf = await file.arrayBuffer()
  // pdf.js 6: 문서 닫기는 불러오기 작업(task)이 맡는다 (6 판부터 글꼴 코드 실행 자체가 없다)
  const task = pdfjs.getDocument({ data: buf })
  try {
    const doc = await task.promise
    const n = Math.min(doc.numPages, MAX_OCR_PAGES)
    const texts: string[] = []
    for (let i = 1; i <= n; i++) {
      const canvas = await renderPdfPage(doc, i)
      if (!canvas) continue
      texts.push(await ocrImage(canvas, (r, label) => onProgress?.((i - 1 + r) / n, n > 1 ? `${i}/${n}쪽 · ${label}` : label)))
      canvas.width = 0
      canvas.height = 0
    }
    return texts.length ? texts.join('\n') : null
  } finally {
    await task.destroy()
  }
}

/** PDF 한 쪽을 그림으로 (스캔본 OCR용) — 300dpi 쯤으로 그린다 */
async function renderPdfPage(doc: PDFDocumentProxy, pageNo: number): Promise<HTMLCanvasElement | null> {
  const page = await doc.getPage(pageNo)
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(OCR_MAX_WIDTH / base.width, Math.max(2, OCR_WIDTH / base.width))
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  return canvas
}


/** 사진 → 그림판(작으면 키우고 너무 크면 줄인다) */
async function imageToCanvas(input: Blob): Promise<HTMLCanvasElement | null> {
  try {
    const bmp = await createImageBitmap(input)
    const scale = bmp.width < 1600 ? Math.min(2, OCR_WIDTH / bmp.width) : bmp.width > OCR_MAX_WIDTH ? OCR_MAX_WIDTH / bmp.width : 1
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bmp.width * scale))
    canvas.height = Math.max(1, Math.round(bmp.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    return canvas
  } catch {
    return null
  }
}

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}
interface OcrWord {
  text: string
  bbox: Box
}
interface OcrLine {
  text: string
  bbox: Box
  words: OcrWord[]
}

/** 번호가 있는 줄의 숫자 부분 — '등록번호' 줄(법인등록번호 빼고), 없으면 3-2-5 모양 숫자가 있는 줄 */
export function numberBoxes(lines: readonly OcrLine[]): Box[] {
  const flat = (t: string) => t.replace(/\s+/g, '')
  const isLabel = (t: string) => /등록번호/.test(flat(t)) && !/법인등록번호/.test(flat(t).replace(/사업자등록번호/, ''))
  const looksNumber = (t: string) => /\d{3}\s*[-.]?\s*\d{2}\s*[-.]?\s*\d{5}/.test(t)
  let picked = lines.filter((l) => isLabel(l.text) && /\d/.test(l.text))
  if (picked.length === 0) picked = lines.filter((l) => looksNumber(l.text))
  const out: Box[] = []
  for (const l of picked.slice(0, 2)) {
    // 숫자가 든 낱말만 감싼다 — 앞의 '등록번호 :' 글자는 빼야 숫자만 읽기가 된다
    const ws = l.words.filter((w) => /\d/.test(w.text))
    const src = ws.length ? ws : [l]
    const b = { x0: Math.min(...src.map((w) => w.bbox.x0)), y0: Math.min(...src.map((w) => w.bbox.y0)), x1: Math.max(...src.map((w) => w.bbox.x1)), y1: Math.max(...src.map((w) => w.bbox.y1)) }
    const h = b.y1 - b.y0
    out.push({ x0: b.x0 - h * 0.6, y0: b.y0 - h * 0.35, x1: b.x1 + h * 0.6, y1: b.y1 + h * 0.35 })
  }
  return out
}

/** 그림판 일부를 잘라 키운 흑백 그림 */
function cropScaled(src: HTMLCanvasElement, b: Box, scale: number): HTMLCanvasElement {
  const x0 = Math.max(0, Math.floor(b.x0))
  const y0 = Math.max(0, Math.floor(b.y0))
  const w = Math.max(1, Math.min(src.width, Math.ceil(b.x1)) - x0)
  const h = Math.max(1, Math.min(src.height, Math.ceil(b.y1)) - y0)
  const c = document.createElement('canvas')
  c.width = Math.round(w * scale)
  c.height = Math.round(h * scale)
  const ctx = c.getContext('2d')
  if (!ctx) return c
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.filter = 'grayscale(1) contrast(1.35)'
  ctx.drawImage(src, x0, y0, w, h, 0, 0, c.width, c.height)
  return c
}

/**
 * 한국어 OCR — 전체를 한 번 읽고, 번호 줄은 숫자만 다시 두 번(크기 다르게) 읽어 끝에 붙인다.
 * 번호 고르기(bizNoRead)는 본문과 다시 읽은 것이 같은 번호를 말할 때만 '확실' 로 본다.
 */
async function ocrImage(input: HTMLCanvasElement | Blob, onProgress?: ProgressFn): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('kor+eng', undefined, {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress ?? 0, '글자 읽는 중')
      else onProgress?.(0, '한글 인식 준비 중 (처음 한 번은 다소 걸립니다)')
    },
  })
  try {
    const canvas = input instanceof Blob ? await imageToCanvas(input) : input
    const { data } = await worker.recognize(canvas ?? input, {}, { text: true, blocks: true })
    const text = data.text ?? ''
    if (!canvas) return text
    const lines: OcrLine[] = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.map((l) => ({ text: l.text, bbox: l.bbox, words: l.words.map((w) => ({ text: w.text, bbox: w.bbox })) }))))
    const boxes = numberBoxes(lines)
    if (boxes.length === 0) return `${text}\n${REREAD_MARK}`
    onProgress?.(0.95, '번호를 한 번 더 읽는 중')
    await worker.setParameters({ tessedit_char_whitelist: '0123456789-', tessedit_pageseg_mode: '7' as never })
    const reads: string[] = []
    for (const b of boxes) {
      for (const scale of [2, 3]) {
        const r = await worker.recognize(cropScaled(canvas, b, scale))
        const t = (r.data.text ?? '').replace(/\s+/g, ' ').trim()
        if (t) reads.push(t)
      }
    }
    return `${text}\n${reads.length ? reads.map((t) => `${REREAD_MARK} ${t}`).join('\n') : REREAD_MARK}`
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
  // D-266 한글 · 워드 — 본문 글 · 표(한 행이 한 줄). 암호 · 배포용 문서는 OfficeReadError(사람 말)로 알린다
  const office = officeKindOf(file.name, file.type)
  if (office) {
    onProgress?.(0.2, office === 'docx' ? '워드 문서 여는 중' : '한글 문서 여는 중')
    const text = await officeText(office, new Uint8Array(await file.arrayBuffer()))
    onProgress?.(1, office === 'docx' ? '워드 문서 읽음' : '한글 문서 읽음')
    return { text, method: office === 'docx' ? 'docx' : 'hwp' }
  }
  // D-301 옛 엑셀 · 옛 워드 · 파워포인트 — 엑셀은 .xlsx 와 같은 모양(탭 · 줄), 워드 · 파워포인트는 본문 글
  const legacy = legacyKindOf(file.name, file.type)
  if (legacy) {
    const what = legacy === 'xls' ? '엑셀' : legacy === 'doc' ? '워드 문서' : '파워포인트'
    onProgress?.(0.2, `${what} 여는 중`)
    const text = await legacyText(legacy, new Uint8Array(await file.arrayBuffer()))
    onProgress?.(1, `${what} 읽음`)
    return { text, method: legacy }
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
    // 스캔본 → 앞 4쪽까지 그림으로 만들어 OCR(D-423)
    onProgress?.(0, '스캔본으로 보입니다. 글자 인식으로 전환합니다')
    const ocr = await ocrPdfPages(file, onProgress)
    if (ocr === null) return { text, method: 'pdf_text' }
    return { text: ocr, method: 'ocr' }
  }

  onProgress?.(0, '이미지 여는 중')
  return { text: await ocrImage(file, onProgress), method: 'ocr' }
}

export const EXTRACT_METHOD_LABEL: Record<ExtractMethod, string> = {
  pdf_text: 'PDF 글자 추출',
  ocr: '이미지 글자 인식(OCR)',
  text: '글자 파일',
  xlsx: '엑셀 표',
  hwp: '한글 문서',
  docx: '워드 문서',
  xls: '엑셀 표(옛 형식)',
  doc: '워드 문서(옛 형식)',
  pptx: '파워포인트',
}

/** 판독기가 읽을 수 있는 파일인지 — 아니면 파일 이름만으로 판별한다 */
export function canExtractText(file: File): boolean {
  return (
    isXlsxFile(file) ||
    officeKindOf(file.name, file.type) !== null ||
    legacyKindOf(file.name, file.type) !== null ||
    file.type === 'application/pdf' ||
    /\.pdf$/i.test(file.name) ||
    file.type.startsWith('image/') ||
    /\.(png|jpe?g|webp|bmp|gif|tiff?)$/i.test(file.name) ||
    file.type.startsWith('text/') ||
    /\.(txt|md|csv)$/i.test(file.name)
  )
}
