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
import { OfficeReadError, officeKindOf, officeText } from './officeText'
import { legacyKindOf, legacyText } from './legacyOffice'
import type { PDFDocumentProxy } from 'pdfjs-dist'

/** D-432 부르는 쪽이 '못 읽은 까닭' 을 보여 줄 수 있게(암호 한글 문서 · 못 여는 사진) */
export { OfficeReadError }

export type ExtractMethod = 'pdf_text' | 'ocr' | 'text' | 'xlsx' | 'hwp' | 'docx' | 'xls' | 'doc' | 'pptx'

export interface ExtractResult {
  text: string
  method: ExtractMethod
  /** 진행률 0~1 */
  pages?: number
  /** D-433 읽기는 했지만 알려 둘 것(스캔 PDF 가 길어 앞쪽만 읽음) — 사람 말 한 줄 */
  note?: string
  /** D-445 글자 PDF 안에 끼운 스캔 쪽(1부터) — 그 쪽에서 나온 정보만 사진 · 스캔처럼 확인을 묻는다 */
  ocrPages?: number[]
}

export type ProgressFn = (ratio: number, label: string) => void

/** PDF에서 텍스트 추출 (스캔본이면 빈 문자열에 가깝다) */
async function extractPdfText(file: File, onProgress?: ProgressFn): Promise<{ text: string; pages: string[] }> {
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
  return { text: chunks.join('\n\f\n'), pages: chunks }
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

async function ocrPdfPages(file: File, onProgress?: ProgressFn, only?: readonly number[]): Promise<{ text: string; total: number; byPage: Map<number, string> } | null> {
  ensureMapUpsert()
  const pdfjs = await import('pdfjs-dist')
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  const buf = await file.arrayBuffer()
  // pdf.js 6: 문서 닫기는 불러오기 작업(task)이 맡는다 (6 판부터 글꼴 코드 실행 자체가 없다)
  const task = pdfjs.getDocument({ data: buf })
  try {
    const doc = await task.promise
    // D-445 고른 쪽만(글자 PDF 안의 스캔 쪽) — 없으면 앞 4쪽
    const list = (only?.length ? only.filter((p) => p >= 1 && p <= doc.numPages) : Array.from({ length: doc.numPages }, (_, k) => k + 1)).slice(0, MAX_OCR_PAGES)
    const n = list.length
    const texts: string[] = []
    const byPage = new Map<number, string>()
    for (const [k, pageNo] of list.entries()) {
      const canvas = await renderPdfPage(doc, pageNo)
      if (!canvas) continue
      const t = await ocrImage(canvas, (r, label) => onProgress?.((k + r) / n, n > 1 || only ? `${pageNo}쪽 · ${label}` : label))
      texts.push(t)
      byPage.set(pageNo, t)
      canvas.width = 0
      canvas.height = 0
    }
    return texts.length ? { text: texts.join('\n'), total: doc.numPages, byPage } : null
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
// D-453 글자 인식기는 한 번 켜서 이어 쓴다 — 여러 장 묶음 · 여러 쪽 스캔에서 장마다 켜고 끄던 시간을 줄인다.
// 한 번에 한 장씩만 읽고(차례 줄), 다 읽고 잠시 쉬면 끈다(메모리). 오류가 나면 그 인식기는 버리고 다음에 새로 켠다.
type OcrWorker = Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>
const OCR_IDLE_MS = 90_000
let sharedWorker: Promise<OcrWorker> | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null
let progressTo: ProgressFn | undefined
let ocrQueue: Promise<unknown> = Promise.resolve()

function getWorker(): Promise<OcrWorker> {
  if (!sharedWorker) {
    const made = (async () => {
      const { createWorker } = await import('tesseract.js')
      return createWorker('kor+eng', undefined, {
        logger: (m: { status?: string; progress?: number }) => {
          if (m.status === 'recognizing text') progressTo?.(m.progress ?? 0, '글자 읽는 중')
          else progressTo?.(0, '한글 인식 준비 중 (처음 한 번은 다소 걸립니다)')
        },
      })
    })()
    sharedWorker = made
    made.catch(() => {
      if (sharedWorker === made) sharedWorker = null
    })
  }
  return sharedWorker
}

function dropWorker(): void {
  const w = sharedWorker
  sharedWorker = null
  void w?.then((x) => x.terminate()).catch(() => undefined)
}

function ocrImage(input: HTMLCanvasElement | Blob, onProgress?: ProgressFn): Promise<string> {
  const run = ocrQueue.then(() => ocrImageNow(input, onProgress))
  ocrQueue = run.catch(() => undefined)
  return run
}

async function ocrImageNow(input: HTMLCanvasElement | Blob, onProgress?: ProgressFn): Promise<string> {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = null
  progressTo = onProgress
  let worker: OcrWorker
  try {
    worker = await getWorker()
  } catch (e) {
    progressTo = undefined
    throw e
  }
  let broken = false
  try {
    return await ocrWith(worker, input, onProgress)
  } catch (e) {
    broken = true
    throw e
  } finally {
    progressTo = undefined
    if (broken) dropWorker()
    else {
      // 번호 다시 읽기에서 바꾼 설정을 처음대로 — 다음 장은 전체 글을 읽어야 한다
      try {
        await worker.setParameters({ tessedit_char_whitelist: '', tessedit_pageseg_mode: '6' as never })
      } catch {
        dropWorker()
      }
      idleTimer = setTimeout(() => {
        idleTimer = null
        dropWorker()
      }, OCR_IDLE_MS)
    }
  }
}

async function ocrWith(worker: OcrWorker, input: HTMLCanvasElement | Blob, onProgress?: ProgressFn): Promise<string> {
  const canvas = input instanceof Blob ? await imageToCanvas(input) : input
  // D-451 기울어진 사진(휴대폰으로 비스듬히) — 글자 인식기가 기울기를 재어 바로잡고 읽는다. 4도 기울기 · 그림자 사진에서 주소 · 번지가 틀리던 것
  const { data } = await worker.recognize(canvas ?? input, { rotateAuto: true }, { text: true, blocks: true, imageColor: true })
  const text = data.text ?? ''
  if (!canvas) return text
  // 바로잡았으면 번호를 다시 읽을 칸도 바로잡은 그림에서 자른다(칸 위치는 그 그림 기준)
  let cropSrc: HTMLCanvasElement = canvas
  const turned = (data as { rotateRadians?: number | null }).rotateRadians
  if (turned && data.imageColor) {
    try {
      const bmp = await createImageBitmap(await (await fetch(data.imageColor)).blob())
      const c = document.createElement('canvas')
      c.width = bmp.width
      c.height = bmp.height
      c.getContext('2d')?.drawImage(bmp, 0, 0)
      bmp.close()
      cropSrc = c
    } catch {
      cropSrc = canvas
    }
  }
  const lines: OcrLine[] = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.map((l) => ({ text: l.text, bbox: l.bbox, words: l.words.map((w) => ({ text: w.text, bbox: w.bbox })) }))))
  const boxes = numberBoxes(lines)
  if (boxes.length === 0) return `${text}\n${REREAD_MARK}`
  onProgress?.(0.95, '번호를 한 번 더 읽는 중')
  await worker.setParameters({ tessedit_char_whitelist: '0123456789-', tessedit_pageseg_mode: '7' as never })
  const reads: string[] = []
  for (const b of boxes) {
    for (const scale of [2, 3]) {
      const r = await worker.recognize(cropScaled(cropSrc, b, scale))
      const t = (r.data.text ?? '').replace(/\s+/g, ' ').trim()
      if (t) reads.push(t)
    }
  }
  return `${text}\n${reads.length ? reads.map((t) => `${REREAD_MARK} ${t}`).join('\n') : REREAD_MARK}`
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
    const { text, pages } = await extractPdfText(file, onProgress)
    if (hasEnoughText(text)) {
      // D-445 홈택스 PDF 사이에 스캔 쪽을 끼워 합친 파일 — 글자가 거의 없는 쪽(많아야 3쪽)만 글자 인식해 그 자리에 넣는다.
      //        예전에는 글자 PDF 로 보고 스캔 쪽을 건너뛰어, 끼워 넣은 등기부 · 사업자등록증을 못 읽었다
      const blank = mixedScanPages(pages)
      if (blank.length) {
        onProgress?.(0, `글자가 없는 ${blank.join(' · ')}쪽(스캔)을 읽는 중`)
        const ocr = await ocrPdfPages(file, onProgress, blank).catch(() => null)
        const got = ocr ? blank.filter((p) => ((ocr.byPage.get(p) ?? '').match(/[가-힣]/g) ?? []).length >= 10) : []
        if (ocr && got.length) {
          const merged = pages.map((t, i) => (got.includes(i + 1) ? (ocr.byPage.get(i + 1) ?? t) : t))
          return { text: merged.join('\n\f\n'), method: 'pdf_text', ocrPages: got, note: `${got.join(' · ')}쪽은 스캔이라 글자 인식으로 읽었어요 — 그 쪽 정보는 한 번 확인해 주세요.` }
        }
      }
      return { text, method: 'pdf_text' }
    }
    // 스캔본 → 앞 4쪽까지 그림으로 만들어 OCR(D-423)
    onProgress?.(0, '스캔본으로 보입니다. 글자 인식으로 전환합니다')
    const ocr = await ocrPdfPages(file, onProgress)
    if (ocr === null) return { text, method: 'pdf_text' }
    // D-433 앞 4쪽만 읽었으면 알린다(예전: 말없이 뒷장을 건너뜀 — 손익계산서 · 임원 사항이 뒤에 있으면 못 읽은 줄 몰랐다)
    return { text: ocr.text, method: 'ocr', pages: ocr.total, ...(ocr.total > MAX_OCR_PAGES ? { note: longScanNote(ocr.total) } : {}) }
  }

  onProgress?.(0, '이미지 여는 중')
  // D-432 브라우저가 못 여는 사진(PC 크롬의 아이폰 HEIC · 깨진 파일) — 예전에는 말없이 빈 글이 되어 '기타' 로 갔다. 까닭을 한 줄로(한글 인식 준비도 하지 않음)
  const canvas = await imageToCanvas(file)
  if (!canvas) throw new OfficeReadError(imageOpenFailNote(file))
  return { text: await ocrImage(canvas, onProgress), method: 'ocr' }
}

/** D-445 글자 PDF 안의 스캔 쪽 — 글자(공백 빼고)가 15자보다 적은 쪽, 2쪽 이상인 파일 · 앞 10쪽 안에서 많아야 3쪽 */
export function mixedScanPages(pages: readonly string[]): number[] {
  if (pages.length < 2) return []
  return pages.map((t, i) => ({ p: i + 1, n: t.replace(/\s/g, '').length })).filter((x) => x.n < 15).map((x) => x.p).slice(0, 3)
}

/** D-433 긴 스캔 PDF — 앞 4쪽만 읽었다는 한 줄 */
export function longScanNote(total: number): string {
  return `스캔본 ${total}쪽 중 앞 ${MAX_OCR_PAGES}쪽만 글자를 읽었어요 — 필요한 쪽(손익계산서 · 임원 사항 등)이 뒤에 있으면 그 쪽만 따로 올려 주세요.`
}

/** D-432 사진을 못 열었을 때 사람 말 — 아이폰 HEIC 면 바꾸는 법까지 */
export function imageOpenFailNote(file: { name: string; type: string }): string {
  if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) return '아이폰 사진(HEIC)은 이 브라우저에서 글자를 읽을 수 없어요 — JPG 로 바꿔 올리거나(아이폰 설정 › 카메라 › 포맷 › 높은 호환성) PDF 로 보내 주세요.'
  return '사진을 열지 못했어요(파일이 깨졌거나 이 브라우저가 모르는 형식) — 다시 찍거나 PDF 로 보내 주세요.'
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
    /\.(png|jpe?g|webp|bmp|gif|tiff?|heic|heif)$/i.test(file.name) ||
    file.type.startsWith('text/') ||
    /\.(txt|md|csv)$/i.test(file.name)
  )
}
