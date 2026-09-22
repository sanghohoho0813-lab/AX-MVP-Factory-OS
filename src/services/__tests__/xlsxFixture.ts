/**
 * 시험용 엑셀(.xlsx) 만들기 (D-89).
 *
 * 판독기를 시험하려면 진짜 xlsx 가 있어야 한다. 파일을 저장소에 넣어 두는 대신
 * zip 을 손으로 써서 시험할 때마다 만든다 — 저장·압축 두 방식을 다 쓴다.
 * 시험에서만 쓴다(화면 코드에서 부르지 않는다).
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c >>> 0
  }
  return t
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw')
  const stream = new Blob([bytes as unknown as BlobPart]).stream().pipeThrough(cs)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export interface ZipInput {
  name: string
  text: string
  /** true 면 압축해서(방식 8), false 면 그냥 담는다(방식 0) */
  compress: boolean
}

export async function makeZip(files: ZipInput[]): Promise<ArrayBuffer> {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0

  for (const f of files) {
    const raw = enc.encode(f.text)
    const data = f.compress ? await deflateRaw(raw) : raw
    const nameBytes = enc.encode(f.name)
    const crc = crc32(raw)

    const local = new Uint8Array(30 + nameBytes.length + data.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(8, f.compress ? 8 : 0, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, raw.length, true)
    lv.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    local.set(data, 30 + nameBytes.length)
    locals.push(local)

    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(10, f.compress ? 8 : 0, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, raw.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    central.set(nameBytes, 46)
    centrals.push(central)

    offset += local.length
  }

  const centralSize = centrals.reduce((s, c) => s + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  const out = new Uint8Array(offset + centralSize + eocd.length)
  let at = 0
  for (const l of locals) {
    out.set(l, at)
    at += l.length
  }
  for (const c of centrals) {
    out.set(c, at)
    at += c.length
  }
  out.set(eocd, at)
  return out.buffer
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 글자만 든 한 장짜리 엑셀 (칸 안 글자를 그대로 넣는다) */
export async function makeSimpleXlsx(rows: readonly (readonly string[])[], sheetName = '시트1'): Promise<ArrayBuffer> {
  const body = rows
    .map((cells, r) => {
      const cs = cells
        .map((v, c) => {
          const ref = `${String.fromCharCode(65 + c)}${r + 1}`
          return v === '' ? '' : `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(v)}</t></is></c>`
        })
        .join('')
      return `<row r="${r + 1}">${cs}</row>`
    })
    .join('')
  return makeZip([
    { name: 'xl/workbook.xml', text: `<?xml version="1.0"?><workbook><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1"/></sheets></workbook>`, compress: true },
    { name: 'xl/worksheets/sheet1.xml', text: `<?xml version="1.0"?><worksheet><sheetData>${body}</sheetData></worksheet>`, compress: true },
  ])
}
