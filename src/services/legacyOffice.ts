/**
 * D-301 고도화 1단계 남은 것 — 옛 엑셀(.xls) · 옛 워드(.doc) · 파워포인트(.pptx) 글 읽기(라이브러리 없이 · 브라우저와 Node 둘 다).
 * 대표 목표 1 "서류는 대충 올려도 알아서" — 4대보험 명부 · 재무제표 · 관공서 서식은 아직 옛 형식(.xls · .doc)으로 많이 온다.
 * 예전에는 이 파일들의 글자를 못 읽어 파일 이름으로만 칸을 정했다.
 *
 *  - .xls(엑셀 97~2003 · BIFF8): 복합 문서(CFB) 안 Workbook 흐름 — 글 표(SST) · 칸 기록(LABELSST · LABEL · NUMBER · RK · MULRK ·
 *    FORMULA 결과 · BOOLERR)을 시트별 표로. 날짜 서식 칸은 YYYY-MM-DD(1904 날짜 체계 포함). 결과는 .xlsx 읽기와 같은 모양(탭 · 줄 · [시트 이름]).
 *    이름만 .xls 인 파일도 알아서 — 속이 .xlsx(ZIP)면 .xlsx 로, 웹 표(HTML · 관공서 '엑셀로 저장' 이 흔히 이렇다) · 엑셀 2003 XML 이면 표 그대로.
 *  - .doc(워드 97~2003): WordDocument 의 조각표(Clx → Pcd)로 글을 차례로 잇는다 — 필드 명령은 빼고 결과만 · 표 칸 표시는 탭.
 *    이름만 .doc 인 RTF · 웹 문서도 글만.
 *  - .pptx: 슬라이드 XML(문단 · 글 · 표) — 슬라이드 차례대로(한글 · 워드와 같은 XML 읽기).
 *  - 암호 문서 · 아주 옛 형식(엑셀 95 · 워드 95 이전)은 사람 말로 알린다(OfficeReadError).
 * 규칙 계산 — 외부 호출 없음.
 */
import { OfficeReadError, isCfb, readCfb, xmlBodyText } from './officeText'
import { readXlsxText, excelSerialToDate } from './xlsxText'
import { unzip, zipEntries, ZipError } from './patent/zip'

export type LegacyKind = 'xls' | 'doc' | 'pptx'

/** 한 파일에서 뽑는 글자 수 · 표 크기 한도(분류 · 사실 찾기 · 명부에는 충분 · 화면이 멈추지 않게) */
const MAX_CHARS = 300_000
const MAX_ROWS = 5000
const MAX_COLS = 200

/** 파일 이름 · 종류 → 읽을 수 있는 옛 형식 */
export function legacyKindOf(name: string, type = ''): LegacyKind | null {
  const n = name.toLowerCase()
  if (n.endsWith('.xls') || type === 'application/vnd.ms-excel') return 'xls'
  if (n.endsWith('.doc') || type === 'application/msword') return 'doc'
  if (n.endsWith('.pptx') || type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx'
  return null
}

export async function legacyText(kind: LegacyKind, bytes: Uint8Array): Promise<string> {
  try {
    if (kind === 'xls') return await xlsText(bytes)
    if (kind === 'doc') return docText(bytes)
    return await pptxText(bytes)
  } catch (e) {
    if (e instanceof OfficeReadError) throw e
    if (e instanceof ZipError) throw new OfficeReadError('파일이 깨졌거나 파워포인트(.pptx) 형식이 아닙니다.')
    throw new OfficeReadError('파일을 읽지 못했습니다.')
  }
}

/* ------------------------------------------------------------------ */
/* 공통 — 이름만 옛 형식인 글 파일(웹 문서 · RTF)                          */
/* ------------------------------------------------------------------ */

const isZip = (b: Uint8Array) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5 || b[2] === 7)

/** 앞부분을 글로 — 웹 문서 · RTF 를 알아보려고 */
function headText(b: Uint8Array, n = 4096): string {
  return new TextDecoder('latin1').decode(b.subarray(0, Math.min(n, b.length))).replace(/^﻿|^ï»¿/, '').trimStart()
}

/** 웹 문서 글 고르기 — meta charset(euc-kr · ks_c_5601 · cp949)이면 그것, BOM 이 UTF-16 이면 그것, 아니면 UTF-8 */
function decodeWeb(b: Uint8Array): string {
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b)
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b)
  const head = new TextDecoder('latin1').decode(b.subarray(0, 4096)).toLowerCase()
  const cs = /charset\s*=\s*["']?([a-z0-9_-]+)/.exec(head)?.[1] ?? /encoding\s*=\s*["']([a-z0-9_-]+)/.exec(head)?.[1] ?? ''
  if (/euc-?kr|ks_c_5601|cp949|x-windows-949|windows-949/.test(cs)) {
    try {
      return new TextDecoder('euc-kr').decode(b)
    } catch {
      // 이 환경에 euc-kr 가 없으면 UTF-8 로
    }
  }
  return new TextDecoder('utf-8').decode(b)
}

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|nbsp|lt|gt|amp|quot|apos);/gi, (_, e: string) => {
    const k = e.toLowerCase()
    if (k === 'nbsp') return ' '
    if (k === 'lt') return '<'
    if (k === 'gt') return '>'
    if (k === 'amp') return '&'
    if (k === 'quot') return '"'
    if (k === 'apos') return "'"
    const code = k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10)
    return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ''
  })
}

const cellClean = (s: string) => decodeEntities(s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/[\t\r\n ]+/g, ' ').replace(/\s{2,}/g, ' ').trim()

/** 웹 표(HTML) → 시트 하나 · 엑셀 2003 XML(Row · Cell · Data) → 시트별 */
export function webTableSheets(src: string): { name: string; rows: string[][] }[] {
  // 엑셀 2003 XML — <Worksheet ss:Name> · <Row> · <Cell ss:Index> · <Data>
  if (/<Workbook\b[\s\S]*?urn:schemas-microsoft-com:office:spreadsheet/i.test(src.slice(0, 4000)) || /<ss:Workbook\b/i.test(src.slice(0, 4000))) {
    const out: { name: string; rows: string[][] }[] = []
    const wsRe = /<(?:ss:)?Worksheet\b([^>]*)>([\s\S]*?)<\/(?:ss:)?Worksheet>/gi
    let w: RegExpExecArray | null
    while ((w = wsRe.exec(src))) {
      const name = decodeEntities(/(?:ss:)?Name="([^"]*)"/i.exec(w[1])?.[1] ?? `시트${out.length + 1}`)
      const rows: string[][] = []
      const rowRe = /<(?:ss:)?Row\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:ss:)?Row>)/gi
      let r: RegExpExecArray | null
      while ((r = rowRe.exec(w[2])) && rows.length < MAX_ROWS) {
        const cells: string[] = []
        const cellRe = /<(?:ss:)?Cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:ss:)?Cell>)/gi
        let c: RegExpExecArray | null
        while ((c = cellRe.exec(r[1] ?? ''))) {
          const idx = Number(/(?:ss:)?Index="(\d+)"/i.exec(c[1])?.[1] ?? 0)
          if (idx > 0) while (cells.length < idx - 1 && cells.length < MAX_COLS) cells.push('')
          const data = /<(?:ss:)?Data\b[^>]*>([\s\S]*?)<\/(?:ss:)?Data>/i.exec(c[2] ?? '')?.[1] ?? ''
          let v = cellClean(data)
          // 날짜는 2024-03-02T00:00:00.000 모양으로 온다
          if (/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?$/.test(v)) v = v.slice(0, 10)
          if (cells.length < MAX_COLS) cells.push(v)
        }
        rows.push(cells)
      }
      out.push({ name, rows })
    }
    return out
  }
  // 웹 표 — <tr> · <td>/<th>(colspan 은 그만큼 빈칸)
  const rows: string[][] = []
  const body = src.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
  const rowRe = /<tr\b[^>]*>([\s\S]*?)(?=<tr\b|<\/table>|$)/gi
  let r: RegExpExecArray | null
  while ((r = rowRe.exec(body)) && rows.length < MAX_ROWS) {
    const cells: string[] = []
    const cellRe = /<t([dh])\b([^>]*)>([\s\S]*?)(?=<t[dh]\b|<\/tr>|$)/gi
    let c: RegExpExecArray | null
    while ((c = cellRe.exec(r[1])) && cells.length < MAX_COLS) {
      cells.push(cellClean(c[3].replace(/<\/t[dh]>[\s\S]*$/i, '')))
      const span = Number(/colspan\s*=\s*["']?(\d+)/i.exec(c[2])?.[1] ?? 1)
      for (let i = 1; i < Math.min(span, 50) && cells.length < MAX_COLS; i++) cells.push('')
    }
    if (cells.some((x) => x !== '')) rows.push(cells)
  }
  return rows.length ? [{ name: '시트1', rows }] : []
}

function sheetsText(sheets: { name: string; rows: string[][] }[]): string {
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

/* ------------------------------------------------------------------ */
/* .xls — BIFF8                                                         */
/* ------------------------------------------------------------------ */

const R = {
  EOF: 0x000a,
  FORMULA: 0x0006,
  DATEMODE: 0x0022,
  FILEPASS: 0x002f,
  CONTINUE: 0x003c,
  BOUNDSHEET: 0x0085,
  MULRK: 0x00bd,
  XF: 0x00e0,
  SST: 0x00fc,
  LABELSST: 0x00fd,
  NUMBER: 0x0203,
  LABEL: 0x0204,
  BOOLERR: 0x0205,
  STRING: 0x0207,
  RK: 0x027e,
  FORMAT: 0x041e,
  BOF: 0x0809,
} as const

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57])

interface Rec {
  type: number
  /** 이 기록이 시작하는 자리(시트 BOF 를 찾을 때) */
  at: number
  data: Uint8Array
}

/** 기록 차례 — 뒤에 붙은 CONTINUE 는 앞 기록의 이어지는 조각(conts)으로 */
function xlsRecords(wb: Uint8Array, from: number, untilEof: boolean): { rec: Rec; conts: Uint8Array[] }[] {
  const dv = new DataView(wb.buffer, wb.byteOffset, wb.byteLength)
  const out: { rec: Rec; conts: Uint8Array[] }[] = []
  let p = from
  let depth = 0
  while (p + 4 <= wb.length) {
    const type = dv.getUint16(p, true)
    const len = dv.getUint16(p + 2, true)
    const data = wb.subarray(p + 4, Math.min(p + 4 + len, wb.length))
    if (type === R.CONTINUE && out.length) out[out.length - 1].conts.push(data)
    else out.push({ rec: { type, at: p, data }, conts: [] })
    p += 4 + len
    if (untilEof) {
      if (type === R.BOF) depth++
      if (type === R.EOF && --depth <= 0) break
    }
  }
  return out
}

/** 이어지는 조각을 건너가며 읽는 글자 읽개 — SST 의 글은 CONTINUE 경계에서 잘리고, 잘린 뒤 첫 바이트가 새 '두 바이트 글자' 표시다 */
class ChunkReader {
  private i = 0
  private p = 0
  private chunks: Uint8Array[]
  constructor(chunks: Uint8Array[]) {
    this.chunks = chunks
  }
  private get cur(): Uint8Array | undefined {
    return this.chunks[this.i]
  }
  done(): boolean {
    while (this.cur && this.p >= this.cur.length) {
      this.i++
      this.p = 0
    }
    return !this.cur
  }
  byte(): number {
    if (this.done()) throw new Error('eof')
    return (this.cur as Uint8Array)[this.p++]
  }
  u16(): number {
    return this.byte() | (this.byte() << 8)
  }
  u32(): number {
    return (this.u16() | (this.u16() << 16)) >>> 0
  }
  skip(n: number): void {
    for (let k = 0; k < n && !this.done(); k++) this.p++
  }
  /** 글자 cch 개 — 조각이 바뀌면 다음 조각 첫 바이트로 1바이트/2바이트가 다시 정해진다 */
  chars(cch: number, high: boolean): string {
    let out = ''
    let wide = high
    let left = cch
    while (left > 0) {
      if (this.done()) break
      const c = this.cur as Uint8Array
      if (this.p >= c.length) continue
      const room = Math.floor((c.length - this.p) / (wide ? 2 : 1))
      const n = Math.min(left, room)
      if (n <= 0) {
        // 조각 끝에 반쪽 글자 — 다음 조각으로
        this.i++
        this.p = 0
        if (this.done()) break
        wide = (this.byte() & 1) === 1
        continue
      }
      if (wide) {
        for (let k = 0; k < n; k++) out += String.fromCharCode(c[this.p + k * 2] | (c[this.p + k * 2 + 1] << 8))
        this.p += n * 2
      } else {
        for (let k = 0; k < n; k++) out += String.fromCharCode(c[this.p + k])
        this.p += n
      }
      left -= n
      if (left > 0) {
        this.i++
        this.p = 0
        if (this.done()) break
        wide = (this.byte() & 1) === 1
      }
    }
    return out
  }
}

function readSst(first: Uint8Array, conts: Uint8Array[]): string[] {
  const r = new ChunkReader([first, ...conts])
  const out: string[] = []
  try {
    r.u32() // 전체 수
    const unique = r.u32()
    for (let k = 0; k < unique && !r.done(); k++) {
      const cch = r.u16()
      const flags = r.byte()
      const rich = (flags & 0x08) !== 0
      const ext = (flags & 0x04) !== 0
      const runs = rich ? r.u16() : 0
      const extLen = ext ? r.u32() : 0
      out.push(r.chars(cch, (flags & 1) === 1))
      r.skip(runs * 4)
      r.skip(extLen)
    }
  } catch {
    // 깨진 끝은 거기까지만
  }
  return out
}

/** XLUnicodeString(cch 2바이트) / ShortXLUnicodeString(cch 1바이트) */
function xlStr(d: Uint8Array, at: number, short: boolean): string {
  const cch = short ? d[at] : d[at] | (d[at + 1] << 8)
  const flags = d[at + (short ? 1 : 2)]
  return new ChunkReader([d.subarray(at + (short ? 2 : 3))]).chars(cch, (flags & 1) === 1)
}

function rkValue(rk: number): number {
  let v: number
  if (rk & 0x02) v = rk >> 2
  else {
    const b = new DataView(new ArrayBuffer(8))
    b.setUint32(4, rk & 0xfffffffc, true)
    b.setUint32(0, 0, true)
    v = b.getFloat64(0, true)
  }
  return rk & 0x01 ? v / 100 : v
}

const numText = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12))))

function xlsSheets(wb: Uint8Array): { name: string; rows: string[][] }[] {
  const dv = new DataView(wb.buffer, wb.byteOffset, wb.byteLength)
  if (wb.length < 8 || dv.getUint16(0, true) !== R.BOF) throw new OfficeReadError('엑셀(.xls) 파일이 깨졌습니다.')
  const ver = dv.getUint16(4, true)
  if (ver !== 0x0600) throw new OfficeReadError('아주 옛 엑셀(95 이전) 파일이라 글자를 읽을 수 없습니다 — 엑셀에서 다시 저장해 올려 주세요.')
  // 1) 통합 문서 머리 — 글 표 · 서식 · 시트 목록
  let sst: string[] = []
  const formats = new Map<number, string>()
  const xfFmt: number[] = []
  const sheets: { name: string; at: number }[] = []
  let date1904 = false
  for (const { rec, conts } of xlsRecords(wb, 0, true)) {
    const d = rec.data
    const v = new DataView(d.buffer, d.byteOffset, d.byteLength)
    if (rec.type === R.FILEPASS) throw new OfficeReadError('암호가 걸린 엑셀 파일이라 글자를 읽을 수 없습니다 — 암호를 풀어 다시 저장해 올려 주세요.')
    if (rec.type === R.SST && d.length >= 8) sst = readSst(d, conts)
    else if (rec.type === R.FORMAT && d.length >= 5) formats.set(v.getUint16(0, true), xlStr(d, 2, false))
    else if (rec.type === R.XF && d.length >= 4) xfFmt.push(v.getUint16(2, true))
    else if (rec.type === R.DATEMODE && d.length >= 2) date1904 = v.getUint16(0, true) === 1
    else if (rec.type === R.BOUNDSHEET && d.length >= 8) {
      // 0 = 일반 시트(차트 · 매크로 시트는 뺀다)
      if (d[5] === 0) sheets.push({ at: v.getUint32(0, true), name: xlStr(d, 6, true) || `시트${sheets.length + 1}` })
    }
  }
  const dateXf = (ixfe: number) => {
    const f = xfFmt[ixfe]
    if (f === undefined) return false
    if (BUILTIN_DATE_FORMATS.has(f)) return true
    const code = (formats.get(f) ?? '').replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '')
    return /[ymd]/i.test(code) && !/^[#0,.%\s]*$/.test(code)
  }
  const numCell = (v: number, ixfe: number) => (dateXf(ixfe) && v > 0 ? excelSerialToDate(v + (date1904 ? 1462 : 0)) : numText(v))
  // 2) 시트마다 칸
  const out: { name: string; rows: string[][] }[] = []
  for (const sh of sheets) {
    if (sh.at <= 0 || sh.at >= wb.length) continue
    const grid = new Map<number, string[]>()
    const put = (row: number, col: number, val: string) => {
      if (row >= MAX_ROWS || col >= MAX_COLS) return
      const r = grid.get(row) ?? []
      while (r.length < col) r.push('')
      r[col] = val.replace(/[\t\r\n]+/g, ' ').trim()
      grid.set(row, r)
    }
    let pending: { row: number; col: number } | null = null
    for (const { rec } of xlsRecords(wb, sh.at, true)) {
      const d = rec.data
      if (d.length < 6 && rec.type !== R.STRING) continue
      const v = new DataView(d.buffer, d.byteOffset, d.byteLength)
      const row = d.length >= 2 ? v.getUint16(0, true) : 0
      const col = d.length >= 4 ? v.getUint16(2, true) : 0
      switch (rec.type) {
        case R.LABELSST:
          if (d.length >= 10) put(row, col, sst[v.getUint32(6, true)] ?? '')
          break
        case R.LABEL:
          if (d.length >= 9) put(row, col, xlStr(d, 6, false))
          break
        case R.NUMBER:
          if (d.length >= 14) put(row, col, numCell(v.getFloat64(6, true), v.getUint16(4, true)))
          break
        case R.RK:
          if (d.length >= 10) put(row, col, numCell(rkValue(v.getUint32(6, true)), v.getUint16(4, true)))
          break
        case R.MULRK: {
          const last = v.getUint16(d.length - 2, true)
          for (let c = col, o = 4; c <= last && o + 6 <= d.length - 2; c++, o += 6) put(row, c, numCell(rkValue(v.getUint32(o + 2, true)), v.getUint16(o, true)))
          break
        }
        case R.BOOLERR:
          if (d.length >= 8) put(row, col, d[7] ? '' : d[6] ? 'TRUE' : 'FALSE')
          break
        case R.FORMULA:
          if (d.length >= 14) {
            if (d[12] === 0xff && d[13] === 0xff) {
              // 글 · 참거짓 · 오류 · 빈 결과 — 글이면 바로 뒤 STRING 기록에
              if (d[6] === 0) pending = { row, col }
              else if (d[6] === 1) put(row, col, d[8] ? 'TRUE' : 'FALSE')
            } else put(row, col, numCell(v.getFloat64(6, true), v.getUint16(4, true)))
          }
          break
        case R.STRING:
          if (pending && d.length >= 3) put(pending.row, pending.col, xlStr(d, 0, false))
          pending = null
          break
      }
    }
    const maxRow = Math.max(-1, ...grid.keys())
    const rows: string[][] = []
    for (let r = 0; r <= maxRow; r++) rows.push(grid.get(r) ?? [])
    out.push({ name: sh.name, rows })
  }
  return out
}

/** .xls(또는 이름만 .xls 인 .xlsx · 웹 표 · 엑셀 2003 XML) → 글(탭 · 줄 · 시트 이름) */
export async function xlsText(bytes: Uint8Array): Promise<string> {
  if (isZip(bytes)) return readXlsxText(bytes.slice().buffer)
  if (!isCfb(bytes)) {
    const head = headText(bytes)
    if (/^<|<html|<table|<\?xml/i.test(head)) {
      const sheets = webTableSheets(decodeWeb(bytes))
      if (!sheets.length) throw new OfficeReadError('엑셀(.xls) 이름의 웹 문서인데 표를 찾지 못했습니다.')
      return sheetsText(sheets)
    }
    throw new OfficeReadError('엑셀(.xls) 파일이 아닙니다.')
  }
  const cfb = readCfb(bytes, '엑셀(.xls)')
  const wb = cfb.get('Workbook')
  if (!wb) {
    if (cfb.get('Book')) throw new OfficeReadError('아주 옛 엑셀(95 이전) 파일이라 글자를 읽을 수 없습니다 — 엑셀에서 다시 저장해 올려 주세요.')
    if (cfb.get('EncryptionInfo')) throw new OfficeReadError('암호가 걸린 엑셀 파일이라 글자를 읽을 수 없습니다 — 암호를 풀어 다시 저장해 올려 주세요.')
    throw new OfficeReadError('엑셀(.xls) 본문을 찾지 못했습니다.')
  }
  return sheetsText(xlsSheets(wb)).slice(0, MAX_CHARS)
}

/** 이름이나 종류로 옛 엑셀인지 — 명부 읽기(payrollDiagnosis)도 쓴다 */
export function isXlsFile(file: { name: string; type?: string }): boolean {
  return /\.xls$/i.test(file.name) || file.type === 'application/vnd.ms-excel'
}

/* ------------------------------------------------------------------ */
/* .doc — 워드 97~2003                                                   */
/* ------------------------------------------------------------------ */

/** 표 한 행 끝 표시 — 조각 글을 이을 때 이 자리의 0x07 을 행 끝(줄)로 바꿔 둔다(칸 끝 0x07 과 글자로는 같다) */
const ROW_END = '\uE000'

/** 조각 글자 → 글. 문단 끝(\r) · 줄바꿈(0x0B) · 쪽 나눔(0x0C) · 행 끝 = 줄, 표 칸 표시(0x07) = 탭, 필드는 결과만(겹친 필드도) */
export function wordChars(raw: string): string {
  let out = ''
  // 필드 깊이마다 '명령 중인가' — 0x13 시작 · 0x14 결과부터 · 0x15 끝. 바깥 필드가 명령 중이면 안쪽 필드는 결과까지 통째로 뺀다
  const field: boolean[] = []
  for (const ch of raw) {
    const c = ch.charCodeAt(0)
    if (ch === ROW_END) {
      if (!field.some(Boolean)) out += '\n'
      continue
    }
    if (c === 0x13) {
      field.push(true)
      continue
    }
    if (c === 0x14) {
      if (field.length) field[field.length - 1] = false
      continue
    }
    if (c === 0x15) {
      field.pop()
      continue
    }
    if (field.some(Boolean)) continue
    if (c === 0x0d || c === 0x0b || c === 0x0c) out += '\n'
    else if (c === 0x07) out += '\t'
    else if (c === 0x09) out += '\t'
    else if (c === 0x1e) out += '-'
    else if (c === 0xa0) out += ' '
    else if (c >= 0x20) out += ch
  }
  return out
    .split('\n')
    .map((l) => l.replace(/\t+$/, '').replace(/[ 　]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const CP1252 = new TextDecoder('windows-1252')

function wordText(bytes: Uint8Array): string {
  const cfb = readCfb(bytes, '워드(.doc)')
  const wd = cfb.get('WordDocument')
  if (!wd || wd.length < 0x1aa) throw new OfficeReadError('워드(.doc) 본문을 찾지 못했습니다.')
  const dv = new DataView(wd.buffer, wd.byteOffset, wd.byteLength)
  if (dv.getUint16(0, true) !== 0xa5ec) throw new OfficeReadError('워드(.doc) 파일이 깨졌습니다.')
  const nFib = dv.getUint16(2, true)
  if (nFib < 0x0065) throw new OfficeReadError('아주 옛 워드(95 이전) 파일이라 글자를 읽을 수 없습니다 — 워드에서 다시 저장해 올려 주세요.')
  const flags = dv.getUint16(0x0a, true)
  if (flags & 0x0100) throw new OfficeReadError('암호가 걸린 워드 문서라 글자를 읽을 수 없습니다 — 암호를 풀어 다시 저장해 올려 주세요.')
  const table = cfb.get(flags & 0x0200 ? '1Table' : '0Table')
  if (!table) throw new OfficeReadError('워드(.doc) 본문 표를 찾지 못했습니다.')
  const fcClx = dv.getUint32(0x01a2, true)
  const lcbClx = dv.getUint32(0x01a6, true)
  if (fcClx + lcbClx > table.length || lcbClx < 5) throw new OfficeReadError('워드(.doc) 파일이 깨졌습니다.')
  const tv = new DataView(table.buffer, table.byteOffset, table.byteLength)
  // Clx = Prc(서식 · 0x01) 여럿 + Pcdt(0x02) 하나
  let p = fcClx
  const end = fcClx + lcbClx
  while (p < end && table[p] === 0x01) p += 3 + tv.getInt16(p + 1, true)
  if (p >= end || table[p] !== 0x02) throw new OfficeReadError('워드(.doc) 파일이 깨졌습니다.')
  const lcb = tv.getUint32(p + 1, true)
  const plc = p + 5
  const n = Math.floor((lcb - 4) / 12)
  const rowEnds = wordRowEnds(wd, table, dv)
  const UTF16 = new TextDecoder('utf-16le')
  let raw = ''
  for (let i = 0; i < n && raw.length < MAX_CHARS; i++) {
    const cpStart = tv.getUint32(plc + i * 4, true)
    const cpEnd = tv.getUint32(plc + (i + 1) * 4, true)
    const pcd = plc + (n + 1) * 4 + i * 8
    const fcRaw = tv.getUint32(pcd + 2, true)
    const len = Math.max(0, cpEnd - cpStart)
    const compressed = (fcRaw & 0x40000000) !== 0
    const at = compressed ? (fcRaw & 0x3fffffff) / 2 : fcRaw
    const size = compressed ? 1 : 2
    let text = compressed ? CP1252.decode(wd.subarray(at, Math.min(at + len, wd.length))) : UTF16.decode(wd.subarray(at, Math.min(at + len * 2, wd.length)))
    // 행 끝 문단 표시(0x07) — 그 글자가 끝나는 자리(FC)가 행 끝 문단의 끝과 같으면
    if (rowEnds.size && text.includes('\u0007')) {
      let t2 = ''
      for (let k = 0; k < text.length; k++) t2 += text[k] === '\u0007' && rowEnds.has(at + (k + 1) * size) ? ROW_END : text[k]
      text = t2
    }
    raw += text
  }
  return wordChars(raw).slice(0, MAX_CHARS)
}

/**
 * 표 행 끝 문단의 끝 자리(FC) — 문단 속성(PAPX)에 '표 행 끝(fTtp · sprmPFTtp 0x2417 · 안쪽 표 0x244C = 1)' 이 있는 문단.
 * PlcBtePapx(FIB fcPlcfBtePapx) → 512바이트 FKP 쪽 → 문단 끝 FC · PapxInFkp 의 grpprl. 못 읽으면 빈 목록(행이 한 줄로 이어질 뿐).
 */
function wordRowEnds(wd: Uint8Array, table: Uint8Array, dv: DataView): Set<number> {
  const out = new Set<number>()
  try {
    const fc = dv.getUint32(0x0102, true)
    const lcb = dv.getUint32(0x0106, true)
    if (lcb < 12 || fc + lcb > table.length) return out
    const tv = new DataView(table.buffer, table.byteOffset, table.byteLength)
    const wv = new DataView(wd.buffer, wd.byteOffset, wd.byteLength)
    const n = Math.floor((lcb - 4) / 8)
    for (let i = 0; i < n && i < 10000; i++) {
      const pn = tv.getUint32(fc + (n + 1) * 4 + i * 4, true) & 0x3fffff
      const page = pn * 512
      if (page + 512 > wd.length) continue
      const crun = wd[page + 511]
      for (let k = 0; k < crun; k++) {
        const end = wv.getUint32(page + (k + 1) * 4, true)
        const bOff = wd[page + (crun + 1) * 4 + k * 13]
        if (!bOff) continue
        let q = page + bOff * 2
        let cb = wd[q]
        let len: number
        if (cb === 0) {
          cb = wd[q + 1]
          len = cb * 2
          q += 2
        } else {
          len = cb * 2 - 1
          q += 1
        }
        // istd(2바이트) 뒤 sprm 들 — 표 행 끝 표시만 찾는다(17 24 01 · 4C 24 01)
        for (let s = q + 2; s + 2 < q + len && s + 2 < page + 512; s++) {
          if ((wd[s] === 0x17 || wd[s] === 0x4c) && wd[s + 1] === 0x24 && wd[s + 2] === 1) {
            out.add(end)
            break
          }
        }
      }
    }
  } catch {
    // 행 끝을 못 찾아도 글은 그대로
  }
  return out
}

/** RTF → 글(이름만 .doc 인 RTF). \par = 줄 · \tab · \cell = 탭 · \'hh 는 문서 글자표(ansicpg949 → euc-kr) · \uN */
export function rtfText(src: string): string {
  const cp = /\\ansicpg(\d+)/.exec(src)?.[1] ?? '1252'
  let dec: TextDecoder
  try {
    dec = new TextDecoder(cp === '949' ? 'euc-kr' : cp === '1252' ? 'windows-1252' : `windows-${cp}`)
  } catch {
    dec = new TextDecoder('windows-1252')
  }
  const SKIP = /^(fonttbl|colortbl|stylesheet|info|pict|object|header|footer|headerl|headerr|footerl|footerr|listtable|listoverridetable|themedata|colorschememapping|latentstyles|datastore|xmlnstbl|rsidtbl|generator|filetbl|revtbl)$/
  let out = ''
  const bytes: number[] = []
  const flushBytes = () => {
    if (bytes.length) out += dec.decode(new Uint8Array(bytes.splice(0)))
  }
  const stack: { skip: boolean; uc: number }[] = [{ skip: false, uc: 1 }]
  let skipChars = 0
  for (let i = 0; i < src.length; ) {
    const top = stack[stack.length - 1]
    const ch = src[i]
    if (ch === '{') {
      flushBytes()
      stack.push({ skip: top.skip, uc: top.uc })
      i++
      continue
    }
    if (ch === '}') {
      flushBytes()
      if (stack.length > 1) stack.pop()
      i++
      continue
    }
    if (ch === '\\') {
      const next = src[i + 1] ?? ''
      if (next === "'") {
        const hex = parseInt(src.slice(i + 2, i + 4), 16)
        i += 4
        if (skipChars > 0) {
          skipChars--
          continue
        }
        if (!top.skip && Number.isFinite(hex)) bytes.push(hex)
        continue
      }
      if (next === '*') {
        top.skip = true
        i += 2
        continue
      }
      if (!/[a-z]/i.test(next)) {
        // \\ \{ \} 같은 글자 · \~ 붙는 빈칸
        flushBytes()
        if (!top.skip) out += next === '~' ? ' ' : next === '-' || next === '_' ? '' : next === '\n' || next === '\r' ? '\n' : next
        i += 2
        continue
      }
      const m = /^\\([a-z]+)(-?\d+)? ?/i.exec(src.slice(i, i + 40))
      if (!m) {
        i++
        continue
      }
      i += m[0].length
      const word = m[1]
      const num = m[2] === undefined ? null : Number(m[2])
      if (SKIP.test(word)) {
        top.skip = true
        continue
      }
      if (top.skip) continue
      flushBytes()
      if (word === 'par' || word === 'line' || word === 'row' || word === 'sect' || word === 'page') out += '\n'
      else if (word === 'tab' || word === 'cell') out += '\t'
      else if (word === 'uc' && num !== null) top.uc = num
      else if (word === 'u' && num !== null) {
        out += String.fromCharCode(num < 0 ? num + 65536 : num)
        skipChars = top.uc
      }
      continue
    }
    if (ch === '\r' || ch === '\n') {
      i++
      continue
    }
    if (skipChars > 0) {
      skipChars--
      i++
      continue
    }
    if (!top.skip) {
      flushBytes()
      out += ch
    }
    i++
  }
  flushBytes()
  return out
    .split('\n')
    .map((l) => l.replace(/\t+$/, '').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 웹 문서 → 글(문단 · 줄 · 표 한 행 = 한 줄) */
export function webDocText(src: string): string {
  const body = src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(body)
    .replace(/ /g, ' ')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, '').replace(/^[ ]+/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function docText(bytes: Uint8Array): string {
  if (isCfb(bytes)) return wordText(bytes)
  // 이름만 .doc — 속이 .docx(ZIP)면 알리고, RTF · 웹 문서면 글만
  if (isZip(bytes)) throw new OfficeReadError('이름은 .doc 인데 속은 .docx 예요 — 파일 이름 끝을 .docx 로 바꿔 다시 올려 주세요.')
  const head = headText(bytes)
  if (head.startsWith('{\\rtf')) return rtfText(new TextDecoder('latin1').decode(bytes)).slice(0, MAX_CHARS)
  if (/^<|<html/i.test(head)) return webDocText(decodeWeb(bytes)).slice(0, MAX_CHARS)
  throw new OfficeReadError('워드(.doc) 파일이 아닙니다.')
}

/* ------------------------------------------------------------------ */
/* .pptx                                                                */
/* ------------------------------------------------------------------ */

async function pptxText(bytes: Uint8Array): Promise<string> {
  const names = zipEntries(bytes).map((e) => e.name)
  const slides = names
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
    .sort((a, b) => Number(/(\d+)\.xml$/i.exec(a)?.[1] ?? 0) - Number(/(\d+)\.xml$/i.exec(b)?.[1] ?? 0))
  if (slides.length === 0) throw new OfficeReadError('파워포인트(.pptx) 슬라이드를 찾지 못했습니다.')
  const files = await unzip(bytes, (n) => slides.includes(n))
  const dec = new TextDecoder('utf-8')
  const parts: string[] = []
  let size = 0
  for (const s of slides) {
    const data = files.get(s)
    if (!data) continue
    const t = xmlBodyText(dec.decode(data))
    if (t) parts.push(t)
    size += t.length
    if (size > MAX_CHARS) break
  }
  return parts.join('\n\n').slice(0, MAX_CHARS)
}
