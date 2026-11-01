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
import { BIRTH_REREAD_MARK, REREAD_MARK, dateRereadLine } from './bizNoRead'
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
/** D-459 PC(두 장씩 읽는 컴퓨터)는 두 쪽씩 함께 읽고 앞 6쪽까지 — 4쪽을 한 쪽씩 읽던 것보다 빠르다. 휴대폰은 그대로 4쪽 */
export function maxOcrPagesFor(parallel: number): number {
  return parallel >= 2 ? 6 : MAX_OCR_PAGES
}

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
    const list = (only?.length ? only.filter((p) => p >= 1 && p <= doc.numPages) : Array.from({ length: doc.numPages }, (_, k) => k + 1)).slice(0, maxOcrPagesFor(OCR_PARALLEL))
    const n = list.length
    const got: (string | null)[] = list.map(() => null)
    const done: number[] = list.map(() => 0)
    let next = 0
    // D-459 PC 는 두 쪽씩 함께(쪽마다 그리고 읽고 지운다) — 글은 쪽 순서대로 모은다
    const lane = async () => {
      for (;;) {
        const k = next++
        if (k >= n) return
        const pageNo = list[k]
        const canvas = await renderPdfPage(doc, pageNo)
        if (!canvas) continue
        got[k] = await ocrImage(canvas, (r, label) => {
          done[k] = r
          onProgress?.(done.reduce((a, b) => a + b, 0) / n, n > 1 || only ? `${pageNo}쪽 · ${label}` : label)
        })
        done[k] = 1
        canvas.width = 0
        canvas.height = 0
      }
    }
    await Promise.all(Array.from({ length: Math.max(1, Math.min(OCR_PARALLEL, n)) }, lane))
    const byPage = new Map<number, string>()
    const texts: string[] = []
    list.forEach((pageNo, k) => {
      const t = got[k]
      if (t === null) return
      texts.push(t)
      byPage.set(pageNo, t)
    })
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

/**
 * D-454 빨간 도장(직인 · 법인인감)이 글자 위에 찍힌 사진 — 도장 모양(가로세로가 비슷한 덩어리)의 빨강 점만 흰색으로 바꾼다.
 * 도장과 겹친 글자는 검정이라 그대로 남는다. 빨간 글자 줄(제목 · 강조)은 가로로 긴 덩어리라 그대로 둔다. 옅은 분홍 바탕도 그대로.
 * 바꾼 점 수를 돌려준다(0 이면 원래 그림 그대로 — 결과가 예전과 같다).
 */
const isRedInk = (r: number, g: number, b: number) => r >= 90 && r - Math.max(g, b) >= 40
const STAMP_CELL = 8

export function whitenRedStamps(px: Uint8ClampedArray, w: number, h: number): number {
  const gw = Math.ceil(w / STAMP_CELL)
  const gh = Math.ceil(h / STAMP_CELL)
  const counts = new Uint16Array(gw * gh)
  let any = 0
  for (let y = 0; y < h; y++) {
    const row = Math.floor(y / STAMP_CELL) * gw
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (isRedInk(px[i], px[i + 1], px[i + 2])) {
        counts[row + Math.floor(x / STAMP_CELL)]++
        any++
      }
    }
  }
  if (any < 200) return 0
  // 빨간 칸끼리 이어 덩어리로(두 칸 떨어진 것까지 — 도장 테두리 · 안 글자가 한 덩어리가 되게)
  const seen = new Uint8Array(gw * gh)
  const minSide = w * 0.05
  let changed = 0
  for (let start = 0; start < counts.length; start++) {
    if (seen[start] || counts[start] < 3) continue
    const stack = [start]
    seen[start] = 1
    let cx0 = gw, cy0 = gh, cx1 = -1, cy1 = -1, sum = 0
    while (stack.length) {
      const c = stack.pop() as number
      const cx = c % gw
      const cy = (c - cx) / gw
      sum += counts[c]
      if (cx < cx0) cx0 = cx
      if (cx > cx1) cx1 = cx
      if (cy < cy0) cy0 = cy
      if (cy > cy1) cy1 = cy
      for (let dy = -2; dy <= 2; dy++) {
        const ny = cy + dy
        if (ny < 0 || ny >= gh) continue
        for (let dx = -2; dx <= 2; dx++) {
          const nx = cx + dx
          if (nx < 0 || nx >= gw) continue
          const n = ny * gw + nx
          if (seen[n] || counts[n] < 3) continue
          seen[n] = 1
          stack.push(n)
        }
      }
    }
    const bw = (cx1 - cx0 + 1) * STAMP_CELL
    const bh = (cy1 - cy0 + 1) * STAMP_CELL
    const ratio = bw / bh
    if (sum < 150 || Math.min(bw, bh) < minSide || ratio < 0.55 || ratio > 1.8 || Math.max(bw, bh) > w * 0.5) continue
    const x0 = Math.max(0, (cx0 - 1) * STAMP_CELL)
    const x1 = Math.min(w, (cx1 + 2) * STAMP_CELL)
    const y0 = Math.max(0, (cy0 - 1) * STAMP_CELL)
    const y1 = Math.min(h, (cy1 + 2) * STAMP_CELL)
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4
        if (!isRedInk(px[i], px[i + 1], px[i + 2])) continue
        px[i] = 255
        px[i + 1] = 255
        px[i + 2] = 255
        changed++
      }
    }
  }
  return changed
}

function withoutRedStamp(canvas: HTMLCanvasElement): HTMLCanvasElement {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return canvas
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    if (whitenRedStamps(img.data, canvas.width, canvas.height) === 0) return canvas
    const out = document.createElement('canvas')
    out.width = canvas.width
    out.height = canvas.height
    const octx = out.getContext('2d')
    if (!octx) return canvas
    octx.putImageData(img, 0, 0)
    return out
  } catch {
    return canvas
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

/** D-467 '개업연월일' · D-468 '회사성립연월일' 줄의 숫자 낱말들(년 · 월 · 일 글자는 빼고 하나씩) — 생년월일 · 발급일 줄은 아님 */
export function dateWordBoxes(lines: readonly OcrLine[], label: RegExp = /개업(?:연|년)?월?일|회사성립연월일|설립연월일/): Box[] {
  const flat = (t: string) => t.replace(/\s+/g, '')
  // D-468 법인 등기부 '회사성립연월일' 줄도(등기부만 올린 법인의 설립일) · D-470 '생년월일' 줄은 label 로 따로
  const line = lines.find((l) => label.test(flat(l.text)) && /\d{4}/.test(l.text))
  if (!line) return []
  const ws = line.words.filter((w) => /^\D{0,2}\d{1,4}\D{0,2}$/.test(w.text) && /\d/.test(w.text)).slice(0, 3)
  if (ws.length !== 3) return []
  return ws.map((w) => {
    const h = w.bbox.y1 - w.bbox.y0
    return { x0: w.bbox.x0 - h * 0.4, y0: w.bbox.y0 - h * 0.3, x1: w.bbox.x1 + h * 0.4, y1: w.bbox.y1 + h * 0.3 }
  })
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
// 인식기 하나는 한 번에 한 장씩만 읽고, 다 읽고 잠시 쉬면 끈다(메모리). 오류가 나면 그 인식기는 버리고 다음에 새로 켠다.
// D-455 PC(코어 4개 이상 · 메모리 4GB 이상)는 인식기 두 개로 두 장을 함께 읽는다 — 한 장씩 올리면 켜져 있는 하나만 쓴다.
//       휴대폰 · 태블릿은 그대로 한 장씩(인식기 두 개면 메모리가 모자라 멈출 수 있다).
type OcrWorker = Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>
const OCR_IDLE_MS = 90_000

export function ocrParallelFor(env: { cores?: number; memoryGb?: number; userAgent?: string; touchPoints?: number }): number {
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(env.userAgent ?? '') || (env.touchPoints ?? 0) > 1
  if (mobile) return 1
  return (env.cores ?? 1) >= 4 && (env.memoryGb ?? 8) >= 4 ? 2 : 1
}

/** 한꺼번에 읽을 수 있는 장 수(서류 올리기 창이 이만큼 함께 읽는다) */
export const OCR_PARALLEL =
  typeof navigator === 'undefined'
    ? 1
    : ocrParallelFor({ cores: navigator.hardwareConcurrency, memoryGb: (navigator as { deviceMemory?: number }).deviceMemory, userAgent: navigator.userAgent, touchPoints: navigator.maxTouchPoints })

interface OcrSlot {
  worker: Promise<OcrWorker> | null
  busy: boolean
  idle: ReturnType<typeof setTimeout> | null
  progressTo?: ProgressFn
}
const slots: OcrSlot[] = Array.from({ length: OCR_PARALLEL }, () => ({ worker: null, busy: false, idle: null }))
const slotWaiters: (() => void)[] = []

/** 먼저 켜지는 인식기 — 둘째는 이것이 다 켜진 뒤에 켠다(한글 자료를 두 번 내려받지 않고 저장해 둔 것을 쓰게) */
let firstWorker: Promise<OcrWorker> | null = null

function workerOf(slot: OcrSlot): Promise<OcrWorker> {
  if (!slot.worker) {
    const before = firstWorker
    const made = (async () => {
      if (before) await before.catch(() => undefined)
      const { createWorker } = await import('tesseract.js')
      const make = () =>
        withTimeout(
          createWorker('kor+eng', undefined, {
            logger: (m: { status?: string; progress?: number }) => {
              if (m.status === 'recognizing text') slot.progressTo?.(m.progress ?? 0, '글자 읽는 중')
              else slot.progressTo?.(0, '한글 인식 준비 중 (처음 한 번은 다소 걸립니다)')
            },
          }),
          OCR_START_TIMEOUT_MS,
        )
      // D-471 인식기 프로그램 · 한글 자료를 인터넷에서 받다가 잠깐 끊기면 한 번 더(예전: 그 파일이 까닭 없이 '기타' 로)
      try {
        return await make()
      } catch {
        await new Promise((r) => setTimeout(r, 1200))
        return make()
      }
    })()
    slot.worker = made
    if (!firstWorker) firstWorker = made
    made.catch(() => {
      if (slot.worker === made) slot.worker = null
      if (firstWorker === made) firstWorker = null
    })
  }
  return slot.worker
}

function dropWorker(slot: OcrSlot): void {
  const w = slot.worker
  slot.worker = null
  if (firstWorker === w) firstWorker = slots.find((x) => x.worker)?.worker ?? null
  void w?.then((x) => x.terminate()).catch(() => undefined)
}

/** 빈 인식기 하나 — 켜져 있는 것을 먼저(한 장씩 읽을 때 둘째를 켜지 않게) */
async function takeSlot(): Promise<OcrSlot> {
  for (;;) {
    const free = slots.find((s) => !s.busy && s.worker) ?? slots.find((s) => !s.busy)
    if (free) {
      free.busy = true
      if (free.idle) clearTimeout(free.idle)
      free.idle = null
      return free
    }
    await new Promise<void>((r) => slotWaiters.push(r))
  }
}

function giveSlot(slot: OcrSlot): void {
  slot.busy = false
  slot.progressTo = undefined
  if (slot.worker) {
    slot.idle = setTimeout(() => {
      slot.idle = null
      if (!slot.busy) dropWorker(slot)
    }, OCR_IDLE_MS)
  }
  slotWaiters.shift()?.()
}

/** D-471 인식기를 켜지 못했거나 읽다가 멈췄을 때(한 번 더 해도) — 사람 말 한 줄. 파일은 그대로 보관된다 */
export const OCR_START_FAIL_NOTE = '글자 인식을 준비하지 못했어요(인터넷 연결이 잠깐 끊겼을 수 있어요) — 잠시 뒤 다시 올려 주세요.'
const OCR_START_TIMEOUT_MS = 90_000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('ocr-start-timeout')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

async function ocrImage(input: HTMLCanvasElement | Blob, onProgress?: ProgressFn): Promise<string> {
  try {
    return await ocrImageOnce(input, onProgress)
  } catch (e) {
    if (e instanceof OfficeReadError) throw e
    // D-471 인식기가 멈췄으면 버리고 새로 켜서 한 번 더 — 그래도 안 되면 까닭 한 줄
    try {
      return await ocrImageOnce(input, onProgress)
    } catch (e2) {
      if (e2 instanceof OfficeReadError) throw e2
      throw new OfficeReadError(OCR_START_FAIL_NOTE)
    }
  }
}

async function ocrImageOnce(input: HTMLCanvasElement | Blob, onProgress?: ProgressFn): Promise<string> {
  const slot = await takeSlot()
  slot.progressTo = onProgress
  try {
    let worker: OcrWorker
    try {
      worker = await workerOf(slot)
    } catch (e) {
      dropWorker(slot)
      throw e
    }
    let broken = false
    try {
      return await ocrWith(worker, input, onProgress)
    } catch (e) {
      broken = true
      throw e
    } finally {
      if (broken) dropWorker(slot)
      else {
        // 번호 다시 읽기에서 바꾼 설정을 처음대로 — 다음 장은 전체 글을 읽어야 한다
        try {
          await worker.setParameters({ tessedit_char_whitelist: '', tessedit_pageseg_mode: '6' as never })
        } catch {
          dropWorker(slot)
        }
      }
    }
  } finally {
    giveSlot(slot)
  }
}

/**
 * D-460 옆으로 누운 · 거꾸로 된 사진 · 스캔 — 글자 인식 자신감(0~100)이 낮으면 90 · 180 · 270도로 돌려 작게 읽어 보고,
 * 확실히 나은 방향(65 이상 · 처음보다 15 이상 높음)이 있으면 그쪽으로 다시 읽는다. 바로 선 서류는 77~92 라 돌려 보지 않는다.
 */
export const TURN_CHECK_BELOW = 60
export function pickQuarterTurn(base: number, tries: readonly { deg: number; conf: number }[]): number {
  const best = tries.reduce((a, b) => (b.conf > a.conf ? b : a), { deg: 0, conf: -1 })
  return best.conf >= 65 && best.conf >= base + 15 ? best.deg : 0
}

function turnedCanvas(src: HTMLCanvasElement, deg: number, maxWidth = 0): HTMLCanvasElement {
  const side = deg % 180 !== 0
  const w0 = side ? src.height : src.width
  const h0 = side ? src.width : src.height
  // 작게 읽어 볼 때는 maxWidth 로 줄이고, 다시 읽을 때는 처음 읽기처럼 작으면 키우고 너무 크면 줄인다
  const scale = maxWidth > 0 ? Math.min(1, maxWidth / w0) : w0 < 1600 ? Math.min(2, OCR_WIDTH / w0) : w0 > OCR_MAX_WIDTH ? OCR_MAX_WIDTH / w0 : 1
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w0 * scale))
  c.height = Math.max(1, Math.round(h0 * scale))
  const ctx = c.getContext('2d')
  if (!ctx) return c
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.translate(c.width / 2, c.height / 2)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.scale(scale, scale)
  ctx.drawImage(src, -src.width / 2, -src.height / 2)
  return c
}

async function ocrWith(worker: OcrWorker, input: HTMLCanvasElement | Blob, onProgress?: ProgressFn, mayTurn = true): Promise<string> {
  const drawn = input instanceof Blob ? await imageToCanvas(input) : input
  const canvas = drawn ? withoutRedStamp(drawn) : null
  // D-451 기울어진 사진(휴대폰으로 비스듬히) — 글자 인식기가 기울기를 재어 바로잡고 읽는다. 4도 기울기 · 그림자 사진에서 주소 · 번지가 틀리던 것
  const { data } = await worker.recognize(canvas ?? input, { rotateAuto: true }, { text: true, blocks: true, imageColor: true })
  const text = data.text ?? ''
  if (!canvas) return text
  if (mayTurn && (data.confidence ?? 100) < TURN_CHECK_BELOW) {
    onProgress?.(0.9, '서류 방향 확인 중')
    const tries: { deg: number; conf: number }[] = []
    for (const deg of [90, 180, 270]) {
      const r = await worker.recognize(turnedCanvas(canvas, deg, 1000))
      tries.push({ deg, conf: r.data.confidence ?? 0 })
    }
    const deg = pickQuarterTurn(data.confidence ?? 0, tries)
    if (deg) return ocrWith(worker, turnedCanvas(canvas, deg), onProgress, false)
  }
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
  const dateBoxes = dateWordBoxes(lines)
  // D-470 개인사업자 사업자등록증 '생년월일' 줄(대표 생년월일) — 주민번호 줄은 아님(숫자 낱말이 년 · 월 · 일 셋일 때만)
  const birthBoxes = dateWordBoxes(lines, /^생년월일/)
  if (boxes.length === 0 && dateBoxes.length === 0 && birthBoxes.length === 0) return `${text}\n${REREAD_MARK}`
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
  // D-467 개업연월일 — 년 · 월 · 일 숫자를 하나씩 다시 읽어 붙인다(두 크기)
  const dateLines: string[] = []
  for (const [bs, mark] of [[dateBoxes, undefined], [birthBoxes, BIRTH_REREAD_MARK]] as const) {
    if (bs.length !== 3) continue
    for (const scale of [2, 3]) {
      let digits = ''
      for (const b of bs) {
        const r = await worker.recognize(cropScaled(cropSrc, b, scale))
        digits += (r.data.text ?? '').replace(/\D/g, '')
      }
      const line = dateRereadLine(digits, mark)
      if (line) dateLines.push(line)
    }
  }
  const tail = [...(reads.length ? reads.map((t) => `${REREAD_MARK} ${t}`) : [REREAD_MARK]), ...dateLines]
  return `${text}\n${tail.join('\n')}`
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
    // D-463 암호가 걸린 PDF(은행 거래내역 · 4대보험 EDI 명부 등) — 예전에는 까닭 없이 빈 글('기타'). 한 줄로 알린다(파일은 그대로 보관)
    const { text, pages } = await extractPdfText(file, onProgress).catch((e: unknown) => {
      if (isPdfPasswordError(e)) throw new OfficeReadError(PDF_PASSWORD_NOTE)
      // D-464 깨진 PDF(받다 끊김 · 이름만 .pdf) — 까닭 한 줄
      if ((e as { name?: string } | null)?.name === 'InvalidPDFException') throw new OfficeReadError(PDF_BROKEN_NOTE)
      throw e
    })
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
    const maxPages = maxOcrPagesFor(OCR_PARALLEL)
    return { text: ocr.text, method: 'ocr', pages: ocr.total, ...(ocr.total > maxPages ? { note: longScanNote(ocr.total, maxPages) } : {}) }
  }

  onProgress?.(0, '이미지 여는 중')
  // D-432 브라우저가 못 여는 사진(PC 크롬의 아이폰 HEIC · 깨진 파일) — 예전에는 말없이 빈 글이 되어 '기타' 로 갔다. 까닭을 한 줄로(한글 인식 준비도 하지 않음)
  const canvas = await imageToCanvas(file)
  if (!canvas) throw new OfficeReadError(imageOpenFailNote(file))
  return { text: await ocrImage(canvas, onProgress), method: 'ocr' }
}

export const PDF_BROKEN_NOTE = 'PDF 파일이 깨져 열 수 없습니다 — 받다가 끊겼거나 PDF 가 아닌 파일일 수 있어요. 원본을 다시 받아 올려 주세요.'
export const PDF_PASSWORD_NOTE = '암호가 걸린 PDF 라 글자를 읽을 수 없습니다 — 암호를 풀어(열어서 인쇄 → PDF 로 저장) 다시 올려 주세요.'
/** pdf.js 가 암호 때문에 못 열었을 때(PasswordException) */
export function isPdfPasswordError(e: unknown): boolean {
  const name = (e as { name?: string } | null)?.name ?? ''
  const msg = (e as { message?: string } | null)?.message ?? String(e ?? '')
  return name === 'PasswordException' || /password/i.test(msg)
}

/** D-445 글자 PDF 안의 스캔 쪽 — 글자(공백 빼고)가 15자보다 적은 쪽, 2쪽 이상인 파일 · 앞 10쪽 안에서 많아야 3쪽 */
export function mixedScanPages(pages: readonly string[]): number[] {
  if (pages.length < 2) return []
  return pages.map((t, i) => ({ p: i + 1, n: t.replace(/\s/g, '').length })).filter((x) => x.n < 15).map((x) => x.p).slice(0, 3)
}

/** D-433 긴 스캔 PDF — 앞 4쪽만 읽었다는 한 줄 */
export function longScanNote(total: number, max = MAX_OCR_PAGES): string {
  return `스캔본 ${total}쪽 중 앞 ${max}쪽만 글자를 읽었어요 — 필요한 쪽(손익계산서 · 임원 사항 등)이 뒤에 있으면 그 쪽만 따로 올려 주세요.`
}

/** D-432 사진을 못 열었을 때 사람 말 — 아이폰 HEIC 면 바꾸는 법까지 */
export function imageOpenFailNote(file: { name: string; type: string }): string {
  if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) return '아이폰 사진(HEIC)은 이 브라우저에서 글자를 읽을 수 없어요 — JPG 로 바꿔 올리거나(아이폰 설정 › 카메라 › 포맷 › 높은 호환성) PDF 로 보내 주세요.'
  // D-464 스캐너가 흔히 저장하는 TIFF — 크롬 · 엣지는 열지 못한다
  if (/tiff?/i.test(file.type) || /\.tiff?$/i.test(file.name)) return '스캐너 TIFF(.tif) 파일은 이 브라우저에서 글자를 읽을 수 없어요 — 스캐너에서 PDF 나 JPG 로 저장해 올려 주세요.'
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
