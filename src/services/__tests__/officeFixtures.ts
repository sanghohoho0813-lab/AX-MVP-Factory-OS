/**
 * 시험 자료 만들기 — 복합 문서(CFB) · 옛 엑셀(.xls BIFF8) · 옛 워드(.doc). test:office-docs · test:employment 가 같이 쓴다.
 * 실제 파일 구조 그대로(미니 흐름 · 글 표 SST 와 CONTINUE 경계 · 칸 기록 · 워드 조각표) — 라이브러리 없이 바이트를 직접 쓴다.
 */

export const utf16 = (s: string) => {
  const out = new Uint8Array(s.length * 2)
  const dv = new DataView(out.buffer)
  for (let i = 0; i < s.length; i++) dv.setUint16(i * 2, s.charCodeAt(i), true)
  return out
}
export const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** 시험용 복합 문서(CFB 3판 · 512 섹터) — 4KB 아래 흐름은 미니 흐름(64바이트 조각)에 넣는다(실제 한글 파일과 같게) */
export function makeCfb(streams: { path: string; data: Uint8Array }[]): Uint8Array {
  const SS = 512
  const END = 0xfffffffe
  const FREE = 0xffffffff
  type Node = { name: string; type: number; kids: Node[]; data?: Uint8Array; start: number; size: number; idx: number }
  const root: Node = { name: 'Root Entry', type: 5, kids: [], start: END, size: 0, idx: 0 }
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
  const all: Node[] = []
  const number = (n: Node) => {
    n.idx = all.length
    all.push(n)
    n.kids.forEach(number)
  }
  number(root)
  // 미니 흐름
  const minis = all.filter((n) => n.type === 2 && n.size < 4096)
  const bigs = all.filter((n) => n.type === 2 && n.size >= 4096)
  const miniFat: number[] = []
  const miniParts: Uint8Array[] = []
  for (const n of minis) {
    const count = Math.max(1, Math.ceil(n.size / 64))
    n.start = miniFat.length
    for (let i = 0; i < count; i++) miniFat.push(i === count - 1 ? END : miniFat.length + 1)
    const padded = new Uint8Array(count * 64)
    padded.set(n.data as Uint8Array)
    miniParts.push(padded)
  }
  const miniContainer = concat(miniParts)
  const secs = (bytes: number) => Math.max(bytes ? 1 : 0, Math.ceil(bytes / SS))
  const dirSecs = secs(all.length * 128)
  const miniFatSecs = secs(miniFat.length * 4)
  const miniSecs = secs(miniContainer.length)
  const bigSecs = bigs.map((n) => secs(n.size))
  const used = dirSecs + miniFatSecs + miniSecs + bigSecs.reduce((a, b) => a + b, 0)
  let fatSecs = 1
  while (used + fatSecs > fatSecs * (SS / 4)) fatSecs++
  const total = used + fatSecs
  const fat = new Array<number>(fatSecs * (SS / 4)).fill(FREE)
  let next = 0
  const alloc = (count: number) => {
    const start = next
    for (let i = 0; i < count; i++) fat[start + i] = i === count - 1 ? END : start + i + 1
    next += count
    return count ? start : END
  }
  const dirStart = alloc(dirSecs)
  const miniFatStart = alloc(miniFatSecs)
  root.start = alloc(miniSecs)
  root.size = miniContainer.length
  for (let i = 0; i < bigs.length; i++) bigs[i].start = alloc(bigSecs[i])
  const fatStart = next
  for (let i = 0; i < fatSecs; i++) fat[fatStart + i] = 0xfffffffd
  const out = new Uint8Array((total + 1) * SS)
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
  const sec = (n: number) => (n + 1) * SS
  // 목록 — 형제는 오른쪽으로 이은 나무(읽는 쪽은 왼쪽 · 자기 · 오른쪽 차례로 본다)
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
  // 미니 FAT · 미니 흐름 · 큰 흐름 · FAT
  miniFat.forEach((v, i) => dv.setUint32(sec(miniFatStart) + i * 4, v, true))
  for (let i = 0; i < miniSecs; i++) out.set(miniContainer.subarray(i * SS, (i + 1) * SS), sec(root.start + i))
  for (const n of bigs) for (let i = 0; i * SS < n.size; i++) out.set((n.data as Uint8Array).subarray(i * SS, (i + 1) * SS), sec(n.start + i))
  fat.forEach((v, i) => dv.setUint32(sec(fatStart + Math.floor(i / (SS / 4))) + (i % (SS / 4)) * 4, v, true))
  return out
}

/* ------------------------------------------------------------------ */
/* D-301 옛 엑셀(.xls · BIFF8)                                            */
/* ------------------------------------------------------------------ */

/** 칸 값 — 글(SST) · 숫자 · 날짜(서식 번호 1 = 기본 날짜 · 2 = 'yyyy"년" m"월" d"일"') · 식 결과 · 바로 적힌 글(LABEL) · 참거짓 · 숫자 여럿(MULRK) */
export type XlsCell = string | number | null | { date: number; xf?: 1 | 2 } | { fnum: number } | { fstr: string } | { label: string } | { bool: boolean } | { mulrk: number[] }

const rec = (type: number, data: Uint8Array) => {
  const h = new Uint8Array(4)
  const dv = new DataView(h.buffer)
  dv.setUint16(0, type, true)
  dv.setUint16(2, data.length, true)
  return concat([h, data])
}
const u16b = (n: number) => {
  const b = new Uint8Array(2)
  new DataView(b.buffer).setUint16(0, n, true)
  return b
}
const u32b = (n: number) => {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n >>> 0, true)
  return b
}
const f64b = (n: number) => {
  const b = new Uint8Array(8)
  new DataView(b.buffer).setFloat64(0, n, true)
  return b
}
const wide = (s: string) => [...s].some((c) => c.charCodeAt(0) > 0xff)
const chars = (s: string, w: boolean) => (w ? utf16(s) : new Uint8Array([...s].map((c) => c.charCodeAt(0))))
/** XLUnicodeString(cch 2바이트) */
const xlStr = (s: string) => concat([u16b(s.length), new Uint8Array([wide(s) ? 1 : 0]), chars(s, wide(s))])
const cellHead = (r: number, c: number, xf: number) => concat([u16b(r), u16b(c), u16b(xf)])

export function makeXls(sheets: { name: string; rows: XlsCell[][] }[], opts: { splitSst?: boolean; encrypt?: boolean; date1904?: boolean; biff5?: boolean } = {}): Uint8Array {
  const strings: string[] = []
  for (const sh of sheets) for (const row of sh.rows) for (const v of row) if (typeof v === 'string' && !strings.includes(v)) strings.push(v)
  const bof = (dt: number) => rec(0x0809, concat([u16b(opts.biff5 ? 0x0500 : 0x0600), u16b(dt), new Uint8Array(12)]))
  const eof = rec(0x000a, new Uint8Array(0))
  // 시트 몸
  const sheetBytes = sheets.map((sh) => {
    const parts: Uint8Array[] = [bof(0x0010)]
    sh.rows.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v === null || v === '') return
        if (typeof v === 'string') parts.push(rec(0x00fd, concat([cellHead(r, c, 0), u32b(strings.indexOf(v))])))
        else if (typeof v === 'number') {
          if (Number.isInteger(v) && Math.abs(v) < 2 ** 29) parts.push(rec(0x027e, concat([cellHead(r, c, 0), u32b(((v << 2) | 2) >>> 0)])))
          else parts.push(rec(0x0203, concat([cellHead(r, c, 0), f64b(v)])))
        } else if ('date' in v) parts.push(rec(0x0203, concat([cellHead(r, c, v.xf ?? 1), f64b(v.date)])))
        else if ('fnum' in v) parts.push(rec(0x0006, concat([cellHead(r, c, 0), f64b(v.fnum), new Uint8Array(6)])))
        else if ('fstr' in v) {
          parts.push(rec(0x0006, concat([cellHead(r, c, 0), new Uint8Array([0, 0, 0, 0, 0, 0, 0xff, 0xff]), new Uint8Array(6)])))
          parts.push(rec(0x0207, xlStr(v.fstr)))
        } else if ('label' in v) parts.push(rec(0x0204, concat([cellHead(r, c, 0), xlStr(v.label)])))
        else if ('bool' in v) parts.push(rec(0x0205, concat([cellHead(r, c, 0), new Uint8Array([v.bool ? 1 : 0, 0])])))
        else if ('mulrk' in v) parts.push(rec(0x00bd, concat([u16b(r), u16b(c), ...v.mulrk.map((n) => concat([u16b(0), u32b(((n << 2) | 2) >>> 0)])), u16b(c + v.mulrk.length - 1)])))
      }),
    )
    parts.push(eof)
    return concat(parts)
  })
  // 글 표(SST) — splitSst 면 둘째 글 가운데에서 CONTINUE 로 자른다(이어지는 조각 첫 바이트 = 새 '두 바이트 글자' 표시)
  const strBytes = strings.map((s) => ({ s, head: concat([u16b(s.length), new Uint8Array([wide(s) ? 1 : 0])]), body: chars(s, wide(s)), w: wide(s) }))
  let sstRecs: Uint8Array
  const sstHead = concat([u32b(strings.length), u32b(strings.length)])
  if (opts.splitSst && strBytes.length >= 2) {
    const [a, b, ...rest] = strBytes
    const cut = Math.floor(b.s.length / 2) * (b.w ? 2 : 1)
    const first = concat([sstHead, a.head, a.body, b.head, b.body.subarray(0, cut)])
    const cont = concat([new Uint8Array([b.w ? 1 : 0]), b.body.subarray(cut), ...rest.flatMap((x) => [x.head, x.body])])
    sstRecs = concat([rec(0x00fc, first), rec(0x003c, cont)])
  } else sstRecs = rec(0x00fc, concat([sstHead, ...strBytes.flatMap((x) => [x.head, x.body])]))
  const fmtCode = 'yyyy"년" m"월" d"일"'
  const xf = (ifmt: number) => rec(0x00e0, concat([u16b(0), u16b(ifmt), new Uint8Array(16)]))
  const globals = (positions: number[]) =>
    concat([
      bof(0x0005),
      ...(opts.encrypt ? [rec(0x002f, new Uint8Array(54))] : []),
      ...(opts.date1904 ? [rec(0x0022, u16b(1))] : []),
      rec(0x041e, concat([u16b(164), xlStr(fmtCode)])),
      xf(0),
      xf(14),
      xf(164),
      ...sheets.map((sh, i) => rec(0x0085, concat([u32b(positions[i] ?? 0), new Uint8Array([0, 0]), new Uint8Array([sh.name.length, wide(sh.name) ? 1 : 0]), chars(sh.name, wide(sh.name))]))),
      sstRecs,
      eof,
    ])
  const gLen = globals(sheets.map(() => 0)).length
  const positions: number[] = []
  let at = gLen
  for (const b of sheetBytes) {
    positions.push(at)
    at += b.length
  }
  const wb = concat([globals(positions), ...sheetBytes])
  return makeCfb([{ path: opts.biff5 ? 'Book' : 'Workbook', data: wb }])
}

/* ------------------------------------------------------------------ */
/* D-301 옛 워드(.doc · 97~2003)                                          */
/* ------------------------------------------------------------------ */

/** 조각마다 글 — compressed 면 1바이트(서양 글자표) 조각 · 아니면 UTF-16 조각 */
export function makeDoc(pieces: { text: string; compressed?: boolean }[], opts: { encrypted?: boolean; table?: '0Table' | '1Table'; nFib?: number; rowEnds?: number[] } = {}): Uint8Array {
  const table = opts.table ?? '1Table'
  const head = new Uint8Array(0x400)
  const hv = new DataView(head.buffer)
  hv.setUint16(0, 0xa5ec, true)
  hv.setUint16(2, opts.nFib ?? 0x00c1, true)
  hv.setUint16(0x0a, (opts.encrypted ? 0x0100 : 0) | (table === '1Table' ? 0x0200 : 0), true)
  const bodies: Uint8Array[] = []
  const fcs: number[] = []
  let at = head.length
  for (const p of pieces) {
    const b = p.compressed ? new Uint8Array([...p.text].map((c) => c.charCodeAt(0) & 0xff)) : utf16(p.text)
    fcs.push(p.compressed ? ((at * 2) | 0x40000000) >>> 0 : at)
    bodies.push(b)
    at += b.length
  }
  const cps: number[] = [0]
  for (const p of pieces) cps.push(cps[cps.length - 1] + p.text.length)
  const plc = concat([...cps.map((c) => u32b(c)), ...fcs.map((fc) => concat([u16b(0), u32b(fc), u16b(0)]))])
  const clx = concat([new Uint8Array([0x02]), u32b(plc.length), plc])
  hv.setUint32(0x01a2, 0, true)
  hv.setUint32(0x01a6, clx.length, true)
  // 표 행 끝 문단(rowEnds = 전체 글에서 그 0x07 의 자리) — FKP 한 쪽 + PlcBtePapx(문단 속성에 sprmPFTtp 0x2417 = 1)
  let tableData = clx
  const extra: Uint8Array[] = []
  if (opts.rowEnds?.length) {
    const endFc = (cp: number) => {
      let i = 0
      while (i < pieces.length - 1 && cp >= cps[i + 1]) i++
      const p = pieces[i]
      const base = p.compressed ? (fcs[i] & 0x3fffffff) / 2 : fcs[i]
      return base + (cp - cps[i] + 1) * (p.compressed ? 1 : 2)
    }
    const ends = opts.rowEnds.map(endFc)
    const pad = (512 - (at % 512)) % 512
    const pn = (at + pad) / 512
    const page = new Uint8Array(512)
    const pv = new DataView(page.buffer)
    const crun = ends.length
    const first = head.length
    ;[first, ...ends].forEach((fc, k) => pv.setUint32(k * 4, fc, true))
    for (let k = 0; k < crun; k++) page[(crun + 1) * 4 + k * 13] = 200 // PAPX 는 쪽 안 400바이트 자리(200 낱말)
    page.set([3, 0, 0, 0x17, 0x24, 0x01], 400)
    page[511] = crun
    extra.push(new Uint8Array(pad), page)
    const btePapx = concat([u32b(first), u32b(ends[ends.length - 1]), u32b(pn)])
    hv.setUint32(0x0102, clx.length, true)
    hv.setUint32(0x0106, btePapx.length, true)
    tableData = concat([clx, btePapx])
  }
  return makeCfb([
    { path: 'WordDocument', data: concat([head, ...bodies, ...extra]) },
    { path: table, data: tableData },
  ])
}
