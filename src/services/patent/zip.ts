/**
 * D-245 ZIP 읽기 · 쓰기 — 라이브러리 없이(브라우저 · Node 둘 다 있는 DecompressionStream 'deflate-raw').
 *
 * 특허로 명세서(.hwpx)는 ZIP 이다(Contents/section0.xml · header.xml · BinData/image1.tif …).
 * 읽기는 필요한 파일만 꺼내고, 압축을 푼 크기가 너무 크면 멈춘다(압축 폭탄 막기).
 * 쓰기는 '압축 안 함(store)' 만 — 시험 자료 · 내려받기 묶음용.
 */

const SIG_EOCD = 0x06054b50
const SIG_CEN = 0x02014b50
const SIG_LOC = 0x04034b50

/** 한 파일 · 전체 압축 푼 크기 한도 */
const MAX_ENTRY = 40 * 1024 * 1024
const MAX_TOTAL = 120 * 1024 * 1024
const MAX_ENTRIES = 4000

export class ZipError extends Error {}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new ZipError('이 브라우저는 압축 풀기를 지원하지 않습니다. 최신 크롬 · 엣지 · 사파리에서 열어 주세요.')
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export interface ZipEntry {
  name: string
  size: number
  method: number
  /** D-266 암호가 걸린 항목(꺼낼 수 없음) */
  encrypted?: boolean
}

/**
 * D-266 파일 이름 — UTF-8 표시(플래그 11번)가 있으면 UTF-8, 없으면 UTF-8 로 읽어 보고 깨지면 CP949(EUC-KR).
 * Windows 기본 압축 · 알집 · 반디집 옛 판은 한글 이름을 CP949 로 적는다(그대로 UTF-8 로 읽으면 '�' 투성이).
 */
const UTF8 = new TextDecoder('utf-8')
function zipName(raw: Uint8Array, utf8: boolean): string {
  if (utf8) return UTF8.decode(raw)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(raw)
  } catch {
    try {
      return new TextDecoder('euc-kr').decode(raw)
    } catch {
      return UTF8.decode(raw)
    }
  }
}

/** 목차만 읽는다(내용은 꺼내지 않음) */
export function zipEntries(bytes: Uint8Array): Array<ZipEntry & { localOffset: number; compSize: number }> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (dv.getUint32(i, true) === SIG_EOCD) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new ZipError('ZIP 파일이 아닙니다(.hwpx 가 맞는지 확인해 주세요).')
  const count = dv.getUint16(eocd + 10, true)
  const cdOff = dv.getUint32(eocd + 16, true)
  if (count > MAX_ENTRIES) throw new ZipError('파일 안에 든 것이 너무 많습니다.')
  const out: Array<ZipEntry & { localOffset: number; compSize: number }> = []
  let p = cdOff
  for (let n = 0; n < count; n++) {
    if (p + 46 > bytes.length || dv.getUint32(p, true) !== SIG_CEN) throw new ZipError('ZIP 목차가 깨졌습니다.')
    const flags = dv.getUint16(p + 8, true)
    const method = dv.getUint16(p + 10, true)
    const compSize = dv.getUint32(p + 20, true)
    const size = dv.getUint32(p + 24, true)
    const nameLen = dv.getUint16(p + 28, true)
    const extraLen = dv.getUint16(p + 30, true)
    const commentLen = dv.getUint16(p + 32, true)
    const localOffset = dv.getUint32(p + 42, true)
    const name = zipName(bytes.subarray(p + 46, p + 46 + nameLen), (flags & 0x800) !== 0)
    out.push({ name, size, method, localOffset, compSize, encrypted: (flags & 1) !== 0 })
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

/** D-266 항목 하나 꺼내기 — 크기 한도는 부르는 쪽이 목차(size)로 먼저 본다 */
export async function readZipEntry(bytes: Uint8Array, e: ZipEntry & { localOffset: number; compSize: number }): Promise<Uint8Array> {
  if (e.encrypted) throw new ZipError(`'${e.name}' 은(는) 암호가 걸려 있어 꺼낼 수 없습니다.`)
  if (e.size > MAX_ENTRY) throw new ZipError(`파일 안의 '${e.name}' 이(가) 너무 큽니다.`)
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const lo = e.localOffset
  if (lo + 30 > bytes.length || dv.getUint32(lo, true) !== SIG_LOC) throw new ZipError('ZIP 안의 파일 머리가 깨졌습니다.')
  const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true)
  const raw = bytes.subarray(start, start + e.compSize)
  if (e.method === 0) return raw
  if (e.method === 8) {
    const data = await inflateRaw(raw)
    if (data.length > MAX_ENTRY) throw new ZipError(`파일 안의 '${e.name}' 이(가) 너무 큽니다.`)
    return data
  }
  throw new ZipError(`지원하지 않는 압축 방식입니다(${e.method}).`)
}

/** 필요한 파일만 꺼낸다(filter 가 없으면 전부) */
export async function unzip(bytes: Uint8Array, filter?: (name: string) => boolean): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>()
  let total = 0
  for (const e of zipEntries(bytes)) {
    if (e.name.endsWith('/') || (filter && !filter(e.name))) continue
    if (e.size > MAX_ENTRY) throw new ZipError(`파일 안의 '${e.name}' 이(가) 너무 큽니다.`)
    total += e.size
    if (total > MAX_TOTAL) throw new ZipError('압축을 푼 크기가 너무 큽니다.')
    files.set(e.name, await readZipEntry(bytes, e))
  }
  return files
}

/** D-266 압축을 푼 크기 한도(전체) — 압축 폭탄 막기 */
export const ZIP_MAX_TOTAL = MAX_TOTAL
/** D-266 압축(deflate-raw) 풀기 — 한글 파일(HWP) 본문도 같은 방식 */
export { inflateRaw }

/* ---------------- 쓰기(압축 안 함) ---------------- */

let CRC_TABLE: Uint32Array | null = null
function crc32(data: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      CRC_TABLE[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** 압축 없이 묶는다 — 이름은 UTF-8(플래그 11번) */
export function zipStore(files: Array<{ name: string; data: Uint8Array | string }>): Uint8Array {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name)
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data
    const crc = crc32(data)
    const loc = new Uint8Array(30 + name.length)
    const lv = new DataView(loc.buffer)
    lv.setUint32(0, SIG_LOC, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true)
    lv.setUint16(8, 0, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, name.length, true)
    loc.set(name, 30)
    parts.push(loc, data)
    const cen = new Uint8Array(46 + name.length)
    const cv = new DataView(cen.buffer)
    cv.setUint32(0, SIG_CEN, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    cen.set(name, 46)
    central.push(cen)
    offset += loc.length + data.length
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, SIG_EOCD, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true)
  const all = [...parts, ...central, end]
  const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0))
  let p = 0
  for (const a of all) {
    out.set(a, p)
    p += a.length
  }
  return out
}
