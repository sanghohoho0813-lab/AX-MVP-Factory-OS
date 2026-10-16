/**
 * 서류 파일 작은 그림(썸네일) — 서류함 '폴더로 보기' (D-204).
 *
 * PDF 는 첫 장을, 사진은 줄여서 240px 짜리 그림으로 만든다. 저장소는 비공개 그대로 — 몇 분짜리 서명 주소로 한 번 받아
 * 이 화면(탭)이 열려 있는 동안만 메모리에 둔다(어디에도 저장하지 않는다). 한 번에 둘씩만 만든다(서류가 많아도 느려지지 않게).
 * HWP · 엑셀 · 압축 같은 것은 그림을 만들지 않는다 — 종류 아이콘으로 보인다.
 */
import { documentFileUrl } from '../services/clientOpsService'
import { previewKindOf } from './filePreview'

const WIDTH = 240
const MAX_BYTES = 25 * 1024 * 1024
const cache = new Map<string, Promise<string | null>>()
let running = 0
const waiting: (() => void)[] = []

async function slot<T>(job: () => Promise<T>): Promise<T> {
  if (running >= 2) await new Promise<void>((r) => waiting.push(r))
  running += 1
  try {
    return await job()
  } finally {
    running -= 1
    waiting.shift()?.()
  }
}

async function fetchBytes(storagePath: string): Promise<ArrayBuffer | null> {
  const url = await documentFileUrl(storagePath)
  if (!url) return null
  const res = await fetch(url)
  if (!res.ok) return null
  const len = Number(res.headers.get('content-length') ?? 0)
  if (len > MAX_BYTES) return null
  const buf = await res.arrayBuffer()
  return buf.byteLength > MAX_BYTES ? null : buf
}

async function pdfThumb(buf: ArrayBuffer): Promise<string | null> {
  const pdfjs = await import('pdfjs-dist')
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  const task = pdfjs.getDocument({ data: new Uint8Array(buf) })
  try {
    const doc = await task.promise
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: WIDTH / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    return canvas.toDataURL('image/jpeg', 0.72)
  } finally {
    await task.destroy()
  }
}

async function imageThumb(buf: ArrayBuffer): Promise<string | null> {
  const bmp = await createImageBitmap(new Blob([buf]))
  const scale = Math.min(1, WIDTH / bmp.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bmp.width * scale))
  canvas.height = Math.max(1, Math.round(bmp.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return canvas.toDataURL('image/jpeg', 0.72)
}

/** 작은 그림(data URL) — 못 만들면 null(아이콘으로 보인다) */
export function fileThumb(storagePath: string, fileName: string): Promise<string | null> {
  const kind = previewKindOf(fileName)
  if (!storagePath || !kind) return Promise.resolve(null)
  const hit = cache.get(storagePath)
  if (hit) return hit
  const job = slot(async () => {
    try {
      const buf = await fetchBytes(storagePath)
      if (!buf) return null
      return kind === 'pdf' ? await pdfThumb(buf) : await imageThumb(buf)
    } catch {
      return null
    }
  })
  cache.set(storagePath, job)
  return job
}
