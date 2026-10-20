/**
 * D-249 도면 초안 그림 → PNG 바이트 · 파일 내려받기(브라우저). 그림 글은 services/patent/specFigureSvg.
 */
import { FIG_W, svgDataUrl } from '../../services/patent/specFigureSvg'

const SCALE = 3

/** SVG 글 → PNG 바이트(3배 · 흰 바탕) */
export async function svgToPngBytes(svg: string, height: number): Promise<Uint8Array> {
  const img = new Image()
  await new Promise<void>((ok, bad) => {
    img.onload = () => ok()
    img.onerror = () => bad(new Error('그림을 만들지 못했습니다'))
    img.src = svgDataUrl(svg)
  })
  const canvas = document.createElement('canvas')
  canvas.width = FIG_W * SCALE
  canvas.height = Math.round(height * SCALE)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('그림을 만들지 못했습니다')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'))
  if (!blob) throw new Error('그림을 만들지 못했습니다')
  return new Uint8Array(await blob.arrayBuffer())
}

export function downloadBytes(fileName: string, bytes: Uint8Array, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type }))
  a.download = fileName
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
