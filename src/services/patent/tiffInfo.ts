/**
 * D-245 도면 그림 머리 읽기 — TIFF 첫 IFD 만(픽셀은 읽지 않는다).
 *
 * 특허로(MOIP) 흑백 도면 기본 규격(Master v2.4): TIFF · 흑백 1비트 · 300dpi(또는 400) · CCITT G4 · 한 줄(single strip) · Intel(II).
 * 권장 최대 크기 255mm × 170mm — 픽셀 수 자체를 강제하지 않는다.
 */

export type ImageFormat = 'tiff' | 'png' | 'jpeg' | 'bmp' | 'gif' | 'unknown'

export interface ImageInfo {
  format: ImageFormat
  bytes: number
  /** TIFF 일 때만 아래 값 */
  byteOrder?: 'II' | 'MM'
  width?: number
  height?: number
  bitsPerSample?: number
  compression?: number
  photometric?: number
  xRes?: number
  yRes?: number
  /** 2 = 인치, 3 = 센티 */
  resUnit?: number
  strips?: number
  widthMm?: number
  heightMm?: number
}

export const COMPRESSION_NAME: Record<number, string> = {
  1: '압축 없음',
  2: 'CCITT 1D',
  3: 'CCITT G3',
  4: 'CCITT G4',
  5: 'LZW',
  7: 'JPEG',
  8: 'Deflate',
  32773: 'PackBits',
}

export function sniffFormat(b: Uint8Array): ImageFormat {
  if (b.length < 4) return 'unknown'
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 42 && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 42)) return 'tiff'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg'
  if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif'
  return 'unknown'
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 }

export function imageInfo(b: Uint8Array): ImageInfo {
  const format = sniffFormat(b)
  const info: ImageInfo = { format, bytes: b.length }
  if (format !== 'tiff') return info
  try {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
    const le = b[0] === 0x49
    info.byteOrder = le ? 'II' : 'MM'
    const u16 = (o: number) => dv.getUint16(o, le)
    const u32 = (o: number) => dv.getUint32(o, le)
    const ifd = u32(4)
    const n = u16(ifd)
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12
      const tag = u16(e)
      const type = u16(e + 2)
      const count = u32(e + 4)
      const size = (TYPE_SIZE[type] ?? 1) * count
      const valOff = size <= 4 ? e + 8 : u32(e + 8)
      const first = () => (type === 3 ? u16(valOff) : type === 4 ? u32(valOff) : type === 5 ? u32(valOff) / Math.max(1, u32(valOff + 4)) : 0)
      if (tag === 256) info.width = first()
      else if (tag === 257) info.height = first()
      else if (tag === 258) info.bitsPerSample = first()
      else if (tag === 259) info.compression = first()
      else if (tag === 262) info.photometric = first()
      else if (tag === 273) info.strips = count
      else if (tag === 282) info.xRes = Math.round(first() * 10) / 10
      else if (tag === 283) info.yRes = Math.round(first() * 10) / 10
      else if (tag === 296) info.resUnit = first()
    }
    const unit = info.resUnit === 3 ? 10 : 25.4
    if (info.width && info.xRes) info.widthMm = Math.round((info.width / info.xRes) * unit)
    if (info.height && (info.yRes || info.xRes)) info.heightMm = Math.round((info.height / (info.yRes || info.xRes || 1)) * unit)
  } catch {
    /* 머리가 깨졌으면 아는 데까지만 */
  }
  return info
}

/** dpi(인치 기준) — 센티 단위면 바꿔서 */
export function dpiOf(i: ImageInfo): number | null {
  if (!i.xRes) return null
  return i.resUnit === 3 ? Math.round(i.xRes * 2.54) : Math.round(i.xRes)
}
