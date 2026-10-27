/**
 * D-266 시험용 한글(.hwp · .hwpx) · 워드(.docx) · 압축(.zip) 만들기 — e2e 가 화면에 그대로 올린다.
 * .hwp 는 실제 한글 파일 구조(복합 문서 · 미니 흐름 · 압축된 본문 기록 · 표 칸 주소). 단위 시험(officeDocs.test.ts)과 같은 모양.
 */
import zlib from 'node:zlib'

const deflateRaw = (b) => new Uint8Array(zlib.deflateRawSync(Buffer.from(b)))
const utf16 = (s) => {
  const out = new Uint8Array(s.length * 2)
  const dv = new DataView(out.buffer)
  for (let i = 0; i < s.length; i++) dv.setUint16(i * 2, s.charCodeAt(i), true)
  return out
}
const concat = (parts) => {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
const enc = new TextEncoder()

/** 복합 문서(CFB 3판) — 4KB 아래는 미니 흐름 */
export function makeCfb(streams) {
  const SS = 512
  const END = 0xfffffffe
  const FREE = 0xffffffff
  const root = { name: 'Root Entry', type: 5, kids: [], start: END, size: 0, idx: 0 }
  for (const s of streams) {
    const parts = s.path.split('/')
    let cur = root
    for (const p of parts.slice(0, -1)) {
      let k = cur.kids.find((x) => x.name === p)
      if (!k) {
        k = { name: p, type: 1, kids: [], start: 0, size: 0, idx: 0 }
        cur.kids.push(k)
      }
      cur = k
    }
    cur.kids.push({ name: parts[parts.length - 1], type: 2, kids: [], data: s.data, start: END, size: s.data.length, idx: 0 })
  }
  const all = []
  const number = (n) => {
    n.idx = all.length
    all.push(n)
    n.kids.forEach(number)
  }
  number(root)
  const minis = all.filter((n) => n.type === 2 && n.size < 4096)
  const bigs = all.filter((n) => n.type === 2 && n.size >= 4096)
  const miniFat = []
  const miniParts = []
  for (const n of minis) {
    const count = Math.max(1, Math.ceil(n.size / 64))
    n.start = miniFat.length
    for (let i = 0; i < count; i++) miniFat.push(i === count - 1 ? END : miniFat.length + 1)
    const padded = new Uint8Array(count * 64)
    padded.set(n.data)
    miniParts.push(padded)
  }
  const miniContainer = concat(miniParts)
  const secs = (bytes) => Math.max(bytes ? 1 : 0, Math.ceil(bytes / SS))
  const dirSecs = secs(all.length * 128)
  const miniFatSecs = secs(miniFat.length * 4)
  const miniSecs = secs(miniContainer.length)
  const bigSecs = bigs.map((n) => secs(n.size))
  const used = dirSecs + miniFatSecs + miniSecs + bigSecs.reduce((a, b) => a + b, 0)
  let fatSecs = 1
  while (used + fatSecs > fatSecs * (SS / 4)) fatSecs++
  const fat = new Array(fatSecs * (SS / 4)).fill(FREE)
  let next = 0
  const alloc = (count) => {
    const start = next
    for (let i = 0; i < count; i++) fat[start + i] = i === count - 1 ? END : start + i + 1
    next += count
    return count ? start : END
  }
  const dirStart = alloc(dirSecs)
  const miniFatStart = alloc(miniFatSecs)
  root.start = alloc(miniSecs)
  root.size = miniContainer.length
  bigs.forEach((n, i) => (n.start = alloc(bigSecs[i])))
  const fatStart = next
  for (let i = 0; i < fatSecs; i++) fat[fatStart + i] = 0xfffffffd
  const out = new Uint8Array((used + fatSecs + 1) * SS)
  const dv = new DataView(out.buffer)
  ;[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].forEach((b, i) => (out[i] = b))
  dv.setUint16(0x18, 0x3e, true)
  dv.setUint16(0x1a, 3, true)
  dv.setUint16(0x1c, 0xfffe, true)
  dv.setUint16(0x1e, 9, true)
  dv.setUint16(0x20, 6, true)
  dv.setUint32(0x2c, fatSecs, true)
  dv.setUint32(0x30, dirStart, true)
  dv.setUint32(0x38, 4096, true)
  dv.setUint32(0x3c, miniFatSecs ? miniFatStart : END, true)
  dv.setUint32(0x40, miniFatSecs, true)
  dv.setUint32(0x44, END, true)
  for (let i = 0; i < 109; i++) dv.setUint32(0x4c + i * 4, i < fatSecs ? fatStart + i : FREE, true)
  const sec = (n) => (n + 1) * SS
  for (const n of all) {
    const o = sec(dirStart) + n.idx * 128
    for (let i = 0; i < n.name.length; i++) dv.setUint16(o + i * 2, n.name.charCodeAt(i), true)
    dv.setUint16(o + 0x40, (n.name.length + 1) * 2, true)
    out[o + 0x42] = n.type
    out[o + 0x43] = 1
    dv.setUint32(o + 0x44, FREE, true)
    dv.setUint32(o + 0x48, FREE, true)
    dv.setUint32(o + 0x4c, n.kids.length ? n.kids[0].idx : FREE, true)
    dv.setUint32(o + 0x74, n.start, true)
    dv.setUint32(o + 0x78, n.size, true)
  }
  for (const n of all) for (let i = 0; i + 1 < n.kids.length; i++) dv.setUint32(sec(dirStart) + n.kids[i].idx * 128 + 0x48, n.kids[i + 1].idx, true)
  miniFat.forEach((v, i) => dv.setUint32(sec(miniFatStart) + i * 4, v, true))
  for (let i = 0; i < miniSecs; i++) out.set(miniContainer.subarray(i * SS, (i + 1) * SS), sec(root.start + i))
  for (const n of bigs) for (let i = 0; i * SS < n.size; i++) out.set(n.data.subarray(i * SS, (i + 1) * SS), sec(n.start + i))
  fat.forEach((v, i) => dv.setUint32(sec(fatStart + Math.floor(i / (SS / 4))) + (i % (SS / 4)) * 4, v, true))
  return out
}

const rec = (tag, level, body) => {
  const head = new Uint8Array(4)
  new DataView(head.buffer).setUint32(0, (tag & 0x3ff) | ((level & 0x3ff) << 10) | (body.length << 20), true)
  return concat([head, body])
}
const ctrl8 = (code) => utf16(String.fromCharCode(code, 0, 0, 0, 0, 0, 0, code))
const para = (...parts) => concat([...parts.map((p) => (typeof p === 'string' ? utf16(p) : p)), utf16('\r')])
const cellHead = (row, col) => {
  const b = new Uint8Array(34)
  const dv = new DataView(b.buffer)
  dv.setUint16(0, 1, true)
  dv.setUint16(8, col, true)
  dv.setUint16(10, row, true)
  return b
}

/**
 * 한글(.hwp) — 문단(lines) 뒤에 표(rows: [[이름표, 값] …]) · 그 뒤 문단(after).
 * flags: 1 압축 · 2 암호 · 4 배포용
 */
export function makeHwp({ lines = [], rows = [], after = [], flags = 1 } = {}) {
  const head = new Uint8Array(256)
  head.set(enc.encode('HWP Document File'))
  new DataView(head.buffer).setUint32(32, 0x05000300, true)
  new DataView(head.buffer).setUint32(36, flags, true)
  const p = (t) => [rec(66, 0, new Uint8Array(24)), rec(67, 1, para(t))]
  const table = rows.length
    ? [
        rec(66, 0, new Uint8Array(24)),
        rec(67, 1, para(ctrl8(11))),
        rec(71, 1, new Uint8Array([0x20, 0x6c, 0x62, 0x74, 0, 0, 0, 0])),
        rec(77, 2, new Uint8Array([0, 0, 0, 0, rows.length, 0, 2, 0])),
        ...rows.flatMap((r, ri) => r.flatMap((t, ci) => [rec(72, 2, cellHead(ri, ci)), rec(66, 2, new Uint8Array(24)), rec(67, 3, para(t))])),
      ]
    : []
  const body = concat([...lines.flatMap(p), ...table, ...after.flatMap(p)])
  return makeCfb([
    { path: 'FileHeader', data: head },
    { path: 'DocInfo', data: new Uint8Array(10) },
    { path: 'BodyText/Section0', data: flags & 1 ? deflateRaw(body) : body },
  ])
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
/** 한글(.hwpx) — 문단 · 표(한 행 = 배열) */
export function makeHwpx({ lines = [], rows = [] } = {}) {
  const P = (t) => `<hp:p><hp:run><hp:t>${esc(t)}</hp:t></hp:run></hp:p>`
  const tbl = rows.length ? `<hp:p><hp:run><hp:tbl>${rows.map((r) => `<hp:tr>${r.map((c) => `<hp:tc><hp:subList>${P(c)}</hp:subList></hp:tc>`).join('')}</hp:tr>`).join('')}</hp:tbl></hp:run></hp:p>` : ''
  const xml = `<?xml version="1.0" encoding="UTF-8"?><hs:sec xmlns:hs="s" xmlns:hp="p">${lines.map(P).join('')}${tbl}</hs:sec>`
  return makeZip([
    { name: 'mimetype', data: 'application/hwp+zip', utf8: true },
    { name: 'Contents/section0.xml', data: xml, utf8: true, deflate: true },
  ])
}

/** 워드(.docx) — 문단 */
export function makeDocx({ lines = [] } = {}) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="w"><w:body>${lines.map((t) => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`
  return makeZip([{ name: 'word/document.xml', data: xml, utf8: true, deflate: true }])
}

/** ZIP — name 은 글(UTF-8) 또는 날 바이트(CP949 시험) · utf8 표시 · deflate · 암호 표시 */
export function makeZip(entries) {
  const locals = []
  const cens = []
  let off = 0
  for (const e of entries) {
    const name = typeof e.name === 'string' ? enc.encode(e.name) : e.name
    const raw = typeof e.data === 'string' ? enc.encode(e.data) : e.data
    const comp = e.deflate ? deflateRaw(raw) : raw
    const flags = (e.utf8 ? 0x800 : 0) | (e.encrypted ? 1 : 0)
    const lh = new Uint8Array(30 + name.length)
    const ldv = new DataView(lh.buffer)
    ldv.setUint32(0, 0x04034b50, true)
    ldv.setUint16(4, 20, true)
    ldv.setUint16(6, flags, true)
    ldv.setUint16(8, e.deflate ? 8 : 0, true)
    ldv.setUint32(18, comp.length, true)
    ldv.setUint32(22, raw.length, true)
    ldv.setUint16(26, name.length, true)
    lh.set(name, 30)
    const ch = new Uint8Array(46 + name.length)
    const cdv = new DataView(ch.buffer)
    cdv.setUint32(0, 0x02014b50, true)
    cdv.setUint16(4, 20, true)
    cdv.setUint16(6, 20, true)
    cdv.setUint16(8, flags, true)
    cdv.setUint16(10, e.deflate ? 8 : 0, true)
    cdv.setUint32(20, comp.length, true)
    cdv.setUint32(24, raw.length, true)
    cdv.setUint16(28, name.length, true)
    cdv.setUint32(42, off, true)
    ch.set(name, 46)
    locals.push(lh, comp)
    cens.push(ch)
    off += lh.length + comp.length
  }
  const cd = concat(cens)
  const eocd = new Uint8Array(22)
  const edv = new DataView(eocd.buffer)
  edv.setUint32(0, 0x06054b50, true)
  edv.setUint16(8, entries.length, true)
  edv.setUint16(10, entries.length, true)
  edv.setUint32(12, cd.length, true)
  edv.setUint32(16, off, true)
  return concat([...locals, cd, eocd])
}

/** 한글 이름 → CP949 바이트(Windows 기본 압축과 같게) — 시험에 쓰는 이름만 */
export const CP949 = {
  '서류모음/스캔0003.hwp': [188, 173, 183, 249, 184, 240, 192, 189, 47, 189, 186, 196, 181, 48, 48, 48, 51, 46, 104, 119, 112],
}

/* ------------------------------------------------------------------ */
/* D-301 옛 워드(.doc) · 옛 엑셀(.xls) — 단위 시험(officeFixtures.ts)과 같은 모양                     */
/* ------------------------------------------------------------------ */

const u16b = (n) => {
  const b = new Uint8Array(2)
  new DataView(b.buffer).setUint16(0, n, true)
  return b
}
const u32b = (n) => {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n >>> 0, true)
  return b
}

/** 옛 워드 — 문단(lines) + 표(rows · 한 행 끝은 문단 속성 fTtp 로 표시) */
export function makeDoc({ lines = [], rows = [], after = [] } = {}) {
  let text = lines.map((l) => `${l}\r`).join('')
  const rowEndCps = []
  for (const r of rows) {
    text += r.map((c) => `${c}\u0007`).join('')
    rowEndCps.push(text.length)
    text += '\u0007'
  }
  text += after.map((l) => `${l}\r`).join('')
  const head = new Uint8Array(0x400)
  const hv = new DataView(head.buffer)
  hv.setUint16(0, 0xa5ec, true)
  hv.setUint16(2, 0x00c1, true)
  hv.setUint16(0x0a, 0x0200, true)
  const body = utf16(text)
  const fc = head.length
  const plc = concat([u32b(0), u32b(text.length), u16b(0), u32b(fc), u16b(0)])
  const clx = concat([new Uint8Array([0x02]), u32b(plc.length), plc])
  hv.setUint32(0x01a2, 0, true)
  hv.setUint32(0x01a6, clx.length, true)
  let table = clx
  const extra = []
  if (rowEndCps.length) {
    const ends = rowEndCps.map((cp) => fc + (cp + 1) * 2)
    const at = fc + body.length
    const pad = (512 - (at % 512)) % 512
    const pn = (at + pad) / 512
    const page = new Uint8Array(512)
    const pv = new DataView(page.buffer)
    ;[fc, ...ends].forEach((x, k) => pv.setUint32(k * 4, x, true))
    for (let k = 0; k < ends.length; k++) page[(ends.length + 1) * 4 + k * 13] = 200
    page.set([3, 0, 0, 0x17, 0x24, 0x01], 400)
    page[511] = ends.length
    extra.push(new Uint8Array(pad), page)
    const bte = concat([u32b(fc), u32b(ends[ends.length - 1]), u32b(pn)])
    hv.setUint32(0x0102, clx.length, true)
    hv.setUint32(0x0106, bte.length, true)
    table = concat([clx, bte])
  }
  return makeCfb([
    { path: 'WordDocument', data: concat([head, body, ...extra]) },
    { path: '1Table', data: table },
  ])
}

/** 옛 엑셀 — 시트 하나 · 글은 글 표(SST) · 숫자는 RK */
export function makeXls({ name = 'Sheet1', rows = [] } = {}) {
  const rec = (type, data) => concat([u16b(type), u16b(data.length), data])
  const wide = (s) => [...s].some((c) => c.charCodeAt(0) > 0xff)
  const chars = (s) => (wide(s) ? utf16(s) : new Uint8Array([...s].map((c) => c.charCodeAt(0))))
  const strings = []
  for (const r of rows) for (const v of r) if (typeof v === 'string' && v && !strings.includes(v)) strings.push(v)
  const bof = (dt) => rec(0x0809, concat([u16b(0x0600), u16b(dt), new Uint8Array(12)]))
  const eof = rec(0x000a, new Uint8Array(0))
  const cells = []
  rows.forEach((r, ri) =>
    r.forEach((v, ci) => {
      if (v === '' || v === null || v === undefined) return
      if (typeof v === 'number') cells.push(rec(0x027e, concat([u16b(ri), u16b(ci), u16b(0), u32b(((v << 2) | 2) >>> 0)])))
      else cells.push(rec(0x00fd, concat([u16b(ri), u16b(ci), u16b(0), u32b(strings.indexOf(v))])))
    }),
  )
  const sheet = concat([bof(0x0010), ...cells, eof])
  const sst = rec(0x00fc, concat([u32b(strings.length), u32b(strings.length), ...strings.flatMap((s) => [u16b(s.length), new Uint8Array([wide(s) ? 1 : 0]), chars(s)])]))
  const globals = (pos) => concat([bof(0x0005), rec(0x00e0, concat([u16b(0), u16b(0), new Uint8Array(16)])), rec(0x0085, concat([u32b(pos), new Uint8Array([0, 0, name.length, wide(name) ? 1 : 0]), chars(name)])), sst, eof])
  const g = globals(0)
  return makeCfb([{ path: 'Workbook', data: concat([globals(g.length), sheet]) }])
}
