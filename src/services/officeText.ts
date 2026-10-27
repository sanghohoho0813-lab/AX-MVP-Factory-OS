/**
 * D-266 한글(.hwp · .hwpx) · 워드(.docx) 서류에서 글자 뽑기 — 라이브러리 없이(브라우저 · Node 둘 다).
 * 대표 지시(고도화 최종 목표 1): "서류는 대충 올려도 알아서" — 사업계획서 · 정관 · 주주명부 · 직원명부는 한글 · 워드로 많이 온다.
 * 예전에는 이 파일들의 글자를 못 읽어 파일 이름으로만 칸을 정했다(이름이 '스캔0003.hwp' 면 '기타 · 확인 필요').
 *
 *  - .hwpx · .docx 는 ZIP 안의 XML(본문 section*.xml · word/document.xml)
 *  - .hwp(한글 2002 이후 5.0 형식)는 복합 문서(CFB) 안 BodyText/Section* — 문단 글(PARA_TEXT) 기록을 차례로 읽는다
 *  - 표는 한 줄이 한 행 · 칸 사이는 탭(엑셀 읽기와 같은 모양) — '등록번호 [탭] 123-45-67890' 처럼 이름표와 값이 한 줄에 남는다
 *  - 암호 문서 · 배포용 문서는 본문을 열 수 없다 — 사람 말로 알린다(배포용은 미리보기 글이 있으면 그것만)
 * 규칙 계산 — 외부 호출 없음.
 */

import { inflateRaw, unzip, zipEntries, ZipError } from './patent/zip'

export class OfficeReadError extends Error {}

/** 한 파일에서 뽑는 글자 수 한도(분류 · 사실 찾기에는 앞부분이면 충분 · 화면이 멈추지 않게) */
const MAX_CHARS = 300_000

export type OfficeKind = 'hwp' | 'hwpx' | 'docx'

/** 파일 이름 · 종류 → 읽을 수 있는 한글 · 워드 형식 */
export function officeKindOf(name: string, type = ''): OfficeKind | null {
  const n = name.toLowerCase()
  if (n.endsWith('.hwpx') || type === 'application/hwp+zip') return 'hwpx'
  if (n.endsWith('.hwp') || type === 'application/x-hwp' || type === 'application/haansofthwp' || type === 'application/vnd.hancom.hwp') return 'hwp'
  if (n.endsWith('.docx') || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx'
  return null
}

export async function officeText(kind: OfficeKind, bytes: Uint8Array): Promise<string> {
  try {
    if (kind === 'hwp') return await hwpText(bytes)
    if (kind === 'hwpx') return await hwpxText(bytes)
    return await docxText(bytes)
  } catch (e) {
    if (e instanceof OfficeReadError) throw e
    if (e instanceof ZipError) throw new OfficeReadError(`파일이 깨졌거나 ${kind === 'docx' ? '워드' : '한글'} 형식이 아닙니다.`)
    throw new OfficeReadError('파일을 읽지 못했습니다.')
  }
}

/* ------------------------------------------------------------------ */
/* XML(.hwpx · .docx) — 문단 · 표                                        */
/* ------------------------------------------------------------------ */

function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (_, e: string) => {
    if (e === 'lt') return '<'
    if (e === 'gt') return '>'
    if (e === 'amp') return '&'
    if (e === 'quot') return '"'
    if (e === 'apos') return "'"
    const code = e.startsWith('#x') ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
    return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ''
  })
}

interface Cell {
  paras: string[]
}
interface Table {
  rows: string[][]
  row: string[] | null
  cell: Cell | null
}

/** 칸 글 — 줄바꿈 · 탭은 빈칸으로(표 한 행이 한 줄로 남게) */
const cellText = (c: Cell) => c.paras.map((p) => p.replace(/[\t\r\n]+/g, ' ').trim()).filter(Boolean).join(' ')

/**
 * HWPX · DOCX 본문 XML → 글. 둘 다 문단 p · 글 t · 표 tbl/tr/tc · 탭 tab · 줄바꿈(lineBreak · br · cr) — 이름 앞머리(hp: · w:)만 다르다.
 * 글은 t 안에 있는 것만(필드 명령 · 지운 글 · 탭 위치 정의는 뺀다).
 */
export function xmlBodyText(xml: string): string {
  const lines: string[] = []
  const paras: string[] = []
  const tables: Table[] = []
  let inT = 0
  let inTabs = 0
  let size = 0
  const add = (s: string) => {
    if (!paras.length) return
    paras[paras.length - 1] += s
  }
  const emit = (line: string) => {
    if (size > MAX_CHARS) return
    size += line.length + 1
    lines.push(line)
  }
  const re = /<(\/?)(?:[A-Za-z0-9_]+:)?([A-Za-z0-9_]+)\b[^>]*?(\/?)>|([^<]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const [, close, local, selfClose, text] = m
    if (text !== undefined) {
      if (inT > 0) add(decodeXml(text))
      continue
    }
    if (local === 't') {
      if (!selfClose) inT += close ? -1 : 1
      if (inT < 0) inT = 0
      continue
    }
    if (local === 'tabs') {
      if (!selfClose) inTabs += close ? -1 : 1
      continue
    }
    if (local === 'tab' && !close) {
      if (inTabs === 0) add('\t')
      continue
    }
    if ((local === 'lineBreak' || local === 'br' || local === 'cr') && !close) {
      add('\n')
      continue
    }
    if (local === 'p') {
      if (selfClose) continue
      if (!close) {
        paras.push('')
        continue
      }
      const done = paras.pop() ?? ''
      const t = tables[tables.length - 1]
      // 표 칸 안 문단이면 그 칸에, 아니면 한 줄(문단 안 줄바꿈은 줄로)
      if (t?.cell) t.cell.paras.push(done)
      else for (const l of done.split('\n')) emit(l.replace(/\s+$/, ''))
      continue
    }
    if (local === 'tbl') {
      if (selfClose) continue
      if (!close) {
        tables.push({ rows: [], row: null, cell: null })
        continue
      }
      const t = tables.pop()
      if (!t) continue
      const rows = t.rows.map((r) => r.join('\t').replace(/\t+$/, '')).filter((r) => r.trim() !== '')
      const outer = tables[tables.length - 1]
      // 표 안의 표는 바깥 칸 글로(줄 대신 빈칸)
      if (outer?.cell) outer.cell.paras.push(rows.join(' '))
      else rows.forEach(emit)
      continue
    }
    const t = tables[tables.length - 1]
    if (!t) continue
    if (local === 'tr') {
      if (selfClose) continue
      if (!close) t.row = []
      else {
        if (t.row) t.rows.push(t.row)
        t.row = null
      }
      continue
    }
    if (local === 'tc') {
      if (selfClose) {
        t.row?.push('')
        continue
      }
      if (!close) t.cell = { paras: [] }
      else {
        if (t.cell) (t.row ?? (t.row = [])).push(cellText(t.cell))
        t.cell = null
      }
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

async function hwpxText(bytes: Uint8Array): Promise<string> {
  const names = zipEntries(bytes).map((e) => e.name)
  const sections = names
    .filter((n) => /^Contents\/section\d+\.xml$/i.test(n))
    .sort((a, b) => Number(/(\d+)\.xml$/i.exec(a)?.[1] ?? 0) - Number(/(\d+)\.xml$/i.exec(b)?.[1] ?? 0))
  if (sections.length === 0) throw new OfficeReadError('한글(.hwpx) 본문을 찾지 못했습니다.')
  const files = await unzip(bytes, (n) => sections.includes(n))
  const dec = new TextDecoder('utf-8')
  const parts: string[] = []
  for (const s of sections) {
    const data = files.get(s)
    if (data) parts.push(xmlBodyText(dec.decode(data)))
    if (parts.join('').length > MAX_CHARS) break
  }
  return parts.filter(Boolean).join('\n\n')
}

async function docxText(bytes: Uint8Array): Promise<string> {
  const files = await unzip(bytes, (n) => n === 'word/document.xml')
  const data = files.get('word/document.xml')
  if (!data) throw new OfficeReadError('워드(.docx) 본문을 찾지 못했습니다.')
  return xmlBodyText(new TextDecoder('utf-8').decode(data))
}

/* ------------------------------------------------------------------ */
/* 복합 문서(CFB) — .hwp 5.0 의 그릇                                      */
/* ------------------------------------------------------------------ */

const CFB_SIG = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
const END_OF_CHAIN = 0xfffffffe
const FREE_SECT = 0xffffffff
const MAX_STREAM = 40 * 1024 * 1024

interface DirEntry {
  name: string
  type: number
  left: number
  right: number
  child: number
  start: number
  size: number
}

export function isCfb(bytes: Uint8Array): boolean {
  return bytes.length >= 512 && CFB_SIG.every((b, i) => bytes[i] === b)
}

/** 복합 문서 읽기 — 이름 경로('BodyText/Section0')로 흐름(stream)을 꺼낸다. what = 알릴 때 쓸 형식 이름(D-301 옛 엑셀 · 워드도 같은 그릇) */
export function readCfb(bytes: Uint8Array, what = '한글(.hwp)'): { list: () => string[]; get: (path: string) => Uint8Array | null } {
  if (!isCfb(bytes)) throw new OfficeReadError(`${what} 파일이 아닙니다.`)
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u32 = (o: number) => (o + 4 <= bytes.length ? dv.getUint32(o, true) : END_OF_CHAIN)
  const sectorShift = dv.getUint16(0x1e, true)
  const miniShift = dv.getUint16(0x20, true)
  if (sectorShift !== 9 && sectorShift !== 12) throw new OfficeReadError(`${what} 파일이 깨졌습니다.`)
  const ss = 1 << sectorShift
  const ms = 1 << miniShift
  const sectorOff = (n: number) => (n + 1) * ss
  const numFat = u32(0x2c)
  const dirStart = u32(0x30)
  const cutoff = u32(0x38)
  const miniFatStart = u32(0x3c)
  let difatSect = u32(0x44)
  // FAT 섹터 목록(머리 109개 + DIFAT 사슬)
  const fatSectors: number[] = []
  for (let i = 0; i < 109 && fatSectors.length < numFat; i++) {
    const s = u32(0x4c + i * 4)
    if (s !== FREE_SECT) fatSectors.push(s)
  }
  let guard = 0
  while (difatSect !== END_OF_CHAIN && difatSect !== FREE_SECT && fatSectors.length < numFat && guard++ < 10000) {
    const base = sectorOff(difatSect)
    for (let i = 0; i < ss / 4 - 1 && fatSectors.length < numFat; i++) {
      const s = u32(base + i * 4)
      if (s !== FREE_SECT) fatSectors.push(s)
    }
    difatSect = u32(base + ss - 4)
  }
  const fat: number[] = []
  for (const s of fatSectors) {
    const base = sectorOff(s)
    for (let i = 0; i < ss / 4; i++) fat.push(u32(base + i * 4))
  }
  const chain = (start: number, table: number[]): number[] => {
    const out: number[] = []
    let s = start
    while (s !== END_OF_CHAIN && s !== FREE_SECT && s < table.length && out.length <= table.length) {
      out.push(s)
      s = table[s]
    }
    return out
  }
  const readChain = (start: number, size: number): Uint8Array => {
    const out = new Uint8Array(Math.min(size, MAX_STREAM))
    let at = 0
    for (const s of chain(start, fat)) {
      if (at >= out.length) break
      const base = sectorOff(s)
      const piece = bytes.subarray(base, Math.min(base + ss, bytes.length, base + out.length - at))
      out.set(piece, at)
      at += piece.length
    }
    return out.subarray(0, at)
  }
  // 목록(directory)
  const dirBytes = readChain(dirStart, chain(dirStart, fat).length * ss)
  const dirs: DirEntry[] = []
  const ddv = new DataView(dirBytes.buffer, dirBytes.byteOffset, dirBytes.byteLength)
  for (let o = 0; o + 128 <= dirBytes.length; o += 128) {
    const nameLen = Math.min(64, ddv.getUint16(o + 0x40, true))
    let name = ''
    for (let i = 0; i + 1 < nameLen - 1; i += 2) name += String.fromCharCode(ddv.getUint16(o + i, true))
    dirs.push({ name, type: dirBytes[o + 0x42], left: ddv.getUint32(o + 0x44, true), right: ddv.getUint32(o + 0x48, true), child: ddv.getUint32(o + 0x4c, true), start: ddv.getUint32(o + 0x74, true), size: ddv.getUint32(o + 0x78, true) })
  }
  const root = dirs[0]
  if (!root || root.type !== 5) throw new OfficeReadError(`${what} 파일이 깨졌습니다.`)
  // 작은 흐름(4KB 아래)은 미니 흐름 안에
  const miniStream = readChain(root.start, root.size)
  const miniFat: number[] = []
  for (const s of chain(miniFatStart, fat)) {
    const base = sectorOff(s)
    for (let i = 0; i < ss / 4; i++) miniFat.push(u32(base + i * 4))
  }
  const readMini = (start: number, size: number): Uint8Array => {
    const out = new Uint8Array(Math.min(size, MAX_STREAM))
    let at = 0
    for (const s of chain(start, miniFat)) {
      if (at >= out.length) break
      const base = s * ms
      const piece = miniStream.subarray(base, Math.min(base + ms, miniStream.length, base + out.length - at))
      out.set(piece, at)
      at += piece.length
    }
    return out.subarray(0, at)
  }
  // 경로 → 항목(형제는 이진 나무로 이어져 있다)
  const childrenOf = (idx: number): DirEntry[] => {
    const out: DirEntry[] = []
    const seen = new Set<number>()
    const walk = (i: number) => {
      if (i === FREE_SECT || i >= dirs.length || seen.has(i) || seen.size > dirs.length) return
      seen.add(i)
      const d = dirs[i]
      walk(d.left)
      out.push(d)
      walk(d.right)
    }
    walk(dirs[idx]?.child ?? FREE_SECT)
    return out
  }
  const find = (path: string): DirEntry | null => {
    let idx = 0
    let cur: DirEntry | null = root
    for (const part of path.split('/')) {
      const kids = childrenOf(idx)
      const hit = kids.find((k) => k.name.toLowerCase() === part.toLowerCase())
      if (!hit) return null
      idx = dirs.indexOf(hit)
      cur = hit
    }
    return cur
  }
  return {
    list: () => {
      const out: string[] = []
      const rec = (idx: number, prefix: string, depth: number) => {
        if (depth > 4) return
        for (const k of childrenOf(idx)) {
          out.push(prefix + k.name)
          if (k.type === 1) rec(dirs.indexOf(k), `${prefix}${k.name}/`, depth + 1)
        }
      }
      rec(0, '', 0)
      return out
    },
    get: (path) => {
      const d = find(path)
      if (!d || d.type !== 2) return null
      return d.size < cutoff ? readMini(d.start, d.size) : readChain(d.start, d.size)
    },
  }
}

/* ------------------------------------------------------------------ */
/* .hwp 본문 기록                                                        */
/* ------------------------------------------------------------------ */

const TAG_PARA_HEADER = 66
const TAG_PARA_TEXT = 67
const TAG_CTRL_HEADER = 71
const TAG_LIST_HEADER = 72
const TAG_TABLE = 77

/** 글 한 칸을 차지하는 제어 글자(나머지 제어 글자는 8칸 — 표 · 그림 · 필드 같은 개체 자리) */
const CHAR_CONTROLS = new Set([0, 10, 13, 24, 25, 26, 27, 28, 29, 30, 31])

/** 문단 글(UTF-16) → 글. 탭(9)은 탭 · 줄바꿈(10)은 줄 · 하이픈(24) · 빈칸(30 · 31) */
export function hwpParaText(data: Uint8Array): string {
  const n = Math.floor(data.length / 2)
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let out = ''
  for (let i = 0; i < n; ) {
    const c = dv.getUint16(i * 2, true)
    if (c >= 32) {
      out += String.fromCharCode(c)
      i += 1
      continue
    }
    if (CHAR_CONTROLS.has(c)) {
      if (c === 10) out += '\n'
      else if (c === 24) out += '-'
      else if (c === 30 || c === 31) out += ' '
      i += 1
      continue
    }
    if (c === 9) out += '\t'
    i += 8
  }
  return out
}

interface HwpTable {
  level: number
  cells: Map<string, { row: number; col: number; paras: string[] }>
  cur: { row: number; col: number; paras: string[] } | null
}

/** 본문 한 구역(압축을 푼 기록들) → 줄. 표는 칸 주소(행 · 열)로 모아 한 행을 한 줄로 */
export function hwpSectionLines(data: Uint8Array): string[] {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const lines: string[] = []
  const tables: HwpTable[] = []
  let pendingTable = -1
  let size = 0
  const emit = (l: string) => {
    if (size > MAX_CHARS) return
    size += l.length + 1
    lines.push(l)
  }
  const flush = (t: HwpTable) => {
    const rows = new Map<number, { col: number; text: string }[]>()
    for (const c of t.cells.values()) {
      const text = c.paras.map((p) => p.replace(/[\t\r\n]+/g, ' ').trim()).filter(Boolean).join(' ')
      const r = rows.get(c.row) ?? []
      r.push({ col: c.col, text })
      rows.set(c.row, r)
    }
    const out = [...rows.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, cs]) => cs.sort((a, b) => a.col - b.col).map((c) => c.text).join('\t').replace(/\t+$/, ''))
      .filter((r) => r.trim() !== '')
    const outer = tables[tables.length - 1]
    if (outer?.cur) outer.cur.paras.push(out.join(' '))
    else out.forEach(emit)
  }
  let p = 0
  while (p + 4 <= data.length) {
    const h = dv.getUint32(p, true)
    const tag = h & 0x3ff
    const level = (h >>> 10) & 0x3ff
    let len = (h >>> 20) & 0xfff
    p += 4
    if (len === 0xfff) {
      if (p + 4 > data.length) break
      len = dv.getUint32(p, true)
      p += 4
    }
    if (p + len > data.length) break
    const start = p
    const body = data.subarray(p, p + len)
    p += len
    // 표가 끝남 — 그 표보다 얕은 기록이 나오면
    while (tables.length && level < tables[tables.length - 1].level) flush(tables.pop() as HwpTable)
    if (tag === TAG_CTRL_HEADER && len >= 4) {
      // 개체 이름(4글자 · 거꾸로 저장) — 'tbl ' 이면 다음 TABLE 기록부터 표
      const id = String.fromCharCode(body[3], body[2], body[1], body[0])
      pendingTable = id === 'tbl ' ? level : -1
      continue
    }
    if (tag === TAG_TABLE && pendingTable >= 0) {
      tables.push({ level, cells: new Map(), cur: null })
      pendingTable = -1
      continue
    }
    const t = tables[tables.length - 1]
    if (tag === TAG_LIST_HEADER && t && level === t.level && len >= 12) {
      // 칸 머리: 문단 수(2) · 알 수 없음(2) · 속성(4) · 열 주소(2) · 행 주소(2) …
      const col = dv.getUint16(start + 8, true)
      const row = dv.getUint16(start + 10, true)
      const key = `${row}:${col}`
      const cell = t.cells.get(key) ?? { row, col, paras: [] }
      t.cells.set(key, cell)
      t.cur = cell
      continue
    }
    if (tag === TAG_PARA_TEXT) {
      const text = hwpParaText(body)
      if (t?.cur) t.cur.paras.push(text)
      else for (const l of text.split('\n')) emit(l.replace(/\s+$/, ''))
      continue
    }
    if (tag === TAG_PARA_HEADER && !t) {
      // 글 없는 문단(빈 줄)도 문단 — 글이 있으면 PARA_TEXT 가 뒤따른다
      continue
    }
  }
  while (tables.length) flush(tables.pop() as HwpTable)
  return lines
}

async function hwpText(bytes: Uint8Array): Promise<string> {
  const cfb = readCfb(bytes)
  const head = cfb.get('FileHeader')
  if (!head || head.length < 40 || !new TextDecoder('latin1').decode(head.subarray(0, 17)).startsWith('HWP Document File')) throw new OfficeReadError('한글(.hwp) 5.0 형식이 아닙니다(아주 옛 한글 파일이면 한글에서 다시 저장해 주세요).')
  const flags = new DataView(head.buffer, head.byteOffset, head.byteLength).getUint32(36, true)
  const compressed = (flags & 1) !== 0
  if (flags & 2) throw new OfficeReadError('암호가 걸린 한글 문서라 글자를 읽을 수 없습니다 — 암호를 풀어 다시 저장해 올려 주세요.')
  const preview = () => {
    const pv = cfb.get('PrvText')
    if (!pv) return ''
    const dv = new DataView(pv.buffer, pv.byteOffset, pv.byteLength)
    let s = ''
    for (let i = 0; i + 1 < pv.length; i += 2) s += String.fromCharCode(dv.getUint16(i, true))
    return s.replace(/\0+$/, '').replace(/<|>/g, '').trim()
  }
  // 배포용 문서는 본문이 따로 잠겨 있다 — 미리보기 글(앞부분)만 쓴다
  if (flags & 4) {
    const pv = preview()
    if (pv) return pv
    throw new OfficeReadError('배포용(읽기 전용) 한글 문서라 글자를 읽을 수 없습니다.')
  }
  const sections = cfb
    .list()
    .filter((n) => /^BodyText\/Section\d+$/i.test(n))
    .sort((a, b) => Number(/(\d+)$/.exec(a)?.[1] ?? 0) - Number(/(\d+)$/.exec(b)?.[1] ?? 0))
  const lines: string[] = []
  for (const s of sections) {
    const raw = cfb.get(s)
    if (!raw) continue
    const data = compressed ? await inflateRaw(raw) : raw
    lines.push(...hwpSectionLines(data))
    if (lines.join('\n').length > MAX_CHARS) break
  }
  const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return text || preview()
}
