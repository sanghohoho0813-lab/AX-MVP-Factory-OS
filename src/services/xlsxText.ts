/**
 * 엑셀(.xlsx) 파일에서 표 글자를 뽑아낸다 — 라이브러리 없이 (D-89).
 *
 * 왜 직접 만들었나: 대표가 받는 4대보험 가입자 명부·직원 명부는 거의 다 엑셀이다.
 * 지금까지는 "CSV 로 다시 저장하세요" 라고 안내했다. 엑셀 라이브러리(SheetJS·exceljs)는
 * 번들이 수백 KB 이고, 우리가 필요한 것은 "칸 안의 글자" 뿐이다.
 *
 * xlsx 는 XML 몇 장을 담은 zip 파일이다. 브라우저·Node 에 이미 들어 있는
 * `DecompressionStream('deflate-raw')` 으로 풀고, 필요한 XML 세 장만 읽는다.
 *   - `xl/sharedStrings.xml` : 글자들이 모여 있는 표 (칸은 번호로만 가리킨다)
 *   - `xl/worksheets/sheet*.xml` : 칸 위치와 값
 *   - `xl/styles.xml` : 날짜 서식 여부 (엑셀은 날짜를 숫자로 저장한다)
 *
 * 하지 않는 것: 수식 재계산(엑셀이 저장해 둔 마지막 값을 쓴다) · 서식 · 그림 · 차트 ·
 * 암호가 걸린 파일. 그런 파일은 CSV 로 저장해 달라고 안내한다.
 *
 * 결과는 줄바꿈·탭으로 이은 글자다 — 기존 CSV/TSV 판독기가 그대로 받아 쓴다.
 */

/** 너무 큰 명부에서 브라우저가 멈추지 않도록 — 5,000줄이면 직원 5,000명이다 */
const MAX_ROWS = 5000
const MAX_COLS = 200

export class XlsxReadError extends Error {}

/* ------------------------------------------------------------------ */
/* zip 풀기                                                             */
/* ------------------------------------------------------------------ */

interface ZipEntry {
  name: string
  method: number
  offset: number
  compressedSize: number
}

function u16(view: DataView, at: number): number {
  return view.getUint16(at, true)
}
function u32(view: DataView, at: number): number {
  return view.getUint32(at, true)
}

/** 중앙 디렉터리를 읽어 파일 목록을 만든다 */
function readZipEntries(buf: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)
  // EOCD(끝 표식, 0x06054b50)를 뒤에서 찾는다. 주석이 붙어 있을 수 있어 최대 64KB 뒤진다.
  let eocd = -1
  const from = Math.max(0, bytes.length - 66_000)
  for (let i = bytes.length - 22; i >= from; i -= 1) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new XlsxReadError('엑셀 파일이 아닙니다(압축 형식이 아닙니다).')

  const count = u16(view, eocd + 10)
  let at = u32(view, eocd + 16)
  const out: ZipEntry[] = []
  for (let i = 0; i < count; i += 1) {
    if (at + 46 > bytes.length || u32(view, at) !== 0x02014b50) break
    const method = u16(view, at + 10)
    const compressedSize = u32(view, at + 20)
    const nameLen = u16(view, at + 28)
    const extraLen = u16(view, at + 30)
    const commentLen = u16(view, at + 32)
    const offset = u32(view, at + 42)
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen))
    out.push({ name, method, offset, compressedSize })
    at += 46 + nameLen + extraLen + commentLen
  }
  return out
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw')
  // Uint8Array 를 그대로 흘려보낸다 (ArrayBuffer 하나짜리 스트림)
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** 한 파일을 꺼내 글자로 (없으면 빈 글자) */
async function readFile(buf: ArrayBuffer, entry: ZipEntry | undefined): Promise<string> {
  if (!entry) return ''
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)
  if (u32(view, entry.offset) !== 0x04034b50) throw new XlsxReadError('엑셀 파일이 깨진 것 같습니다.')
  const nameLen = u16(view, entry.offset + 26)
  const extraLen = u16(view, entry.offset + 28)
  const start = entry.offset + 30 + nameLen + extraLen
  const raw = bytes.subarray(start, start + entry.compressedSize)
  if (entry.method === 0) return new TextDecoder().decode(raw)
  if (entry.method !== 8) throw new XlsxReadError('이 엑셀 파일의 압축 방식은 읽지 못합니다. CSV 로 저장해 주세요.')
  return new TextDecoder().decode(await inflateRaw(raw))
}

/* ------------------------------------------------------------------ */
/* XML 읽기 — 필요한 만큼만                                              */
/* ------------------------------------------------------------------ */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeXml(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) return String.fromCodePoint(parseInt(body.slice(2), 16))
    if (body.startsWith('#')) return String.fromCodePoint(parseInt(body.slice(1), 10))
    return ENTITIES[body] ?? whole
  })
}

/** `<si>` 하나 안의 모든 `<t>` 를 이어 붙인다 (서식이 섞인 글자는 조각으로 쪼개져 있다) */
function textOf(xml: string): string {
  const out: string[] = []
  const re = /<t\b[^>]*>([\s\S]*?)<\/t>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) out.push(decodeXml(m[1]))
  return out.join('')
}

function parseSharedStrings(xml: string): string[] {
  if (!xml) return []
  const out: string[] = []
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) out.push(m[1] ? textOf(m[1]) : '')
  return out
}

/* ---- 날짜 서식 ---- */

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57])

/** 스타일 번호 → 날짜 서식인가 */
function parseDateStyles(xml: string): Set<number> {
  const dateFmtIds = new Set<number>(BUILTIN_DATE_FORMATS)
  const fmtRe = /<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"[^>]*\/?>/g
  let m: RegExpExecArray | null
  while ((m = fmtRe.exec(xml)) !== null) {
    const code = decodeXml(m[2]).replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '')
    if (/[ymdhs]/i.test(code) && /[ymd]/i.test(code)) dateFmtIds.add(Number(m[1]))
  }
  const out = new Set<number>()
  const block = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)
  if (!block) return out
  const xfRe = /<xf\b[^>]*numFmtId="(\d+)"[^>]*\/?>/g
  let i = 0
  while ((m = xfRe.exec(block[1])) !== null) {
    if (dateFmtIds.has(Number(m[1]))) out.add(i)
    i += 1
  }
  return out
}

/** 엑셀 날짜 숫자 → YYYY-MM-DD (엑셀 기준일 1899-12-30, 1900 윤년 버그까지 그대로 따른다) */
export function excelSerialToDate(serial: number): string {
  const ms = Math.round(serial * 86400000)
  const d = new Date(Date.UTC(1899, 11, 30) + ms)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${mm}-${dd}`
}

/** "AB12" → 열 번호 0부터 */
function colOf(ref: string): number {
  const letters = /^([A-Z]+)/.exec(ref)?.[1] ?? ''
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return Math.max(0, n - 1)
}

function parseSheet(xml: string, shared: string[], dateStyles: Set<number>): string[][] {
  const rows: string[][] = []
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g
  let rm: RegExpExecArray | null
  while ((rm = rowRe.exec(xml)) !== null && rows.length < MAX_ROWS) {
    const body = rm[1] ?? ''
    const cells: string[] = []
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
    let cm: RegExpExecArray | null
    while ((cm = cellRe.exec(body)) !== null) {
      const attrs = cm[1] ?? ''
      const inner = cm[2] ?? ''
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? ''
      const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? ''
      const styleIdx = Number(/s="(\d+)"/.exec(attrs)?.[1] ?? '-1')
      let value = ''
      if (type === 's') {
        const idx = Number(textOfTag(inner, 'v'))
        value = shared[idx] ?? ''
      } else if (type === 'inlineStr') {
        value = textOf(inner)
      } else if (type === 'str' || type === 'e') {
        value = decodeXml(textOfTag(inner, 'v'))
      } else if (type === 'b') {
        value = textOfTag(inner, 'v') === '1' ? 'TRUE' : 'FALSE'
      } else {
        const raw = textOfTag(inner, 'v')
        value = raw
        if (raw !== '' && dateStyles.has(styleIdx)) {
          const num = Number(raw)
          if (Number.isFinite(num) && num > 0) value = excelSerialToDate(num)
        }
      }
      const at = ref ? colOf(ref) : cells.length
      if (at >= MAX_COLS) continue
      while (cells.length < at) cells.push('')
      cells[at] = value.replace(/[\t\r\n]+/g, ' ').trim()
    }
    rows.push(cells)
  }
  return rows
}

function textOfTag(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml)
  return m ? m[1] : ''
}

/* ------------------------------------------------------------------ */
/* 바깥에서 쓰는 것                                                      */
/* ------------------------------------------------------------------ */

export interface XlsxSheet {
  name: string
  rows: string[][]
}

/** 엑셀 한 벌을 시트별 표로 */
export async function readXlsxSheets(buf: ArrayBuffer): Promise<XlsxSheet[]> {
  const entries = readZipEntries(buf)
  const byName = new Map(entries.map((e) => [e.name, e]))
  const sheetEntries = entries
    .filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name))
    .sort((a, b) => Number(/(\d+)/.exec(a.name)?.[1] ?? 0) - Number(/(\d+)/.exec(b.name)?.[1] ?? 0))
  if (sheetEntries.length === 0) throw new XlsxReadError('엑셀 안에서 표를 찾지 못했습니다.')

  const shared = parseSharedStrings(await readFile(buf, byName.get('xl/sharedStrings.xml')))
  const dateStyles = parseDateStyles(await readFile(buf, byName.get('xl/styles.xml')))
  // 시트 이름 (workbook.xml 의 순서가 sheet1, sheet2 … 와 같다고 본다)
  const workbook = await readFile(buf, byName.get('xl/workbook.xml'))
  const names: string[] = []
  const nameRe = /<sheet\b[^>]*name="([^"]*)"[^>]*>/g
  let nm: RegExpExecArray | null
  while ((nm = nameRe.exec(workbook)) !== null) names.push(decodeXml(nm[1]))

  const out: XlsxSheet[] = []
  for (const [i, entry] of sheetEntries.entries()) {
    const xml = await readFile(buf, entry)
    out.push({ name: names[i] ?? `시트${i + 1}`, rows: parseSheet(xml, shared, dateStyles) })
  }
  return out
}

/**
 * 엑셀 → 글자 (탭으로 칸, 줄바꿈으로 줄).
 * 시트가 여럿이면 시트 이름을 한 줄 적고 이어 붙인다 — 명부 판독기는 줄 단위로 읽는다.
 */
export async function readXlsxText(buf: ArrayBuffer): Promise<string> {
  const sheets = await readXlsxSheets(buf)
  const chunks: string[] = []
  for (const sheet of sheets) {
    const body = sheet.rows
      .map((r) => r.join('\t').replace(/\t+$/, ''))
      .filter((line) => line.trim() !== '')
      .join('\n')
    if (!body) continue
    chunks.push(sheets.length > 1 ? `[${sheet.name}]\n${body}` : body)
  }
  return chunks.join('\n\n')
}

/** 파일 이름·형식으로 엑셀인지 */
export function isXlsxFile(file: { name: string; type?: string }): boolean {
  return (
    /\.xlsx$/i.test(file.name) ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
}
