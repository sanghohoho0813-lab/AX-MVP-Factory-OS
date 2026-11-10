/**
 * D-585 엑셀 파일 그대로 — 여러 업체 등록 창에서 파일을 고르면 붙여넣은 것과 같은 표 글로 바꾼다.
 *
 * 복사 · 붙여넣기가 익숙하지 않은 사람에게는 '파일 고르기' 가 더 쉽다. 엑셀(.xlsx · .xls) · CSV · 글 파일을 받는다.
 *  - 엑셀은 내용이 있는 첫 시트만 — 여러 장이면 그렇게 읽었다고 알려 준다.
 *  - 표 위의 제목 · 날짜 줄은 버린다(제목 줄을 찾았을 때만 — dropTitleRows).
 *  - CSV 는 UTF-8 이 아니면 옛 한글 방식으로 읽는다(엑셀에서 'CSV(쉼표로 분리)' 로 저장한 파일).
 * 읽기만 한다 — 저장 · 서버 호출 0. 파일은 브라우저 안에서만 읽고 어디에도 올리지 않는다. 규칙 코드다(AI 아님).
 */
import { dropTitleRows, splitPaste } from './clientBulkPaste'

/** 파일 고르개가 받는 확장자 */
export const BULK_FILE_ACCEPT = '.xlsx,.xls,.csv,.tsv,.txt'
/** 이보다 큰 파일은 고객 목록이 아닐 가능성이 크다 — 읽지 않고 알려 준다 */
export const BULK_FILE_MAX_BYTES = 5 * 1024 * 1024

export type BulkFileKind = 'xlsx' | 'xls' | 'text'

export type BulkFileRead =
  | { ok: true; /** 붙여넣는 칸에 넣을 글(탭 · 줄) */ text: string; /** 읽은 줄 수(제목 줄 포함) */ rows: number; /** 사람에게 보여 줄 한 줄 */ note: string }
  | { ok: false; reason: string }

export function bulkFileKind(name: string, type = ''): BulkFileKind | null {
  if (/\.xlsx$/i.test(name) || type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx'
  if (/\.xls$/i.test(name) || type === 'application/vnd.ms-excel') return 'xls'
  if (/\.(csv|tsv|txt)$/i.test(name) || type.startsWith('text/')) return 'text'
  return null
}

/** 글 파일 바이트 → 글. BOM 이 있으면 그대로, 없으면 UTF-8 로 읽어 보고 안 되면 옛 한글 방식(EUC-KR/CP949)으로 */
export function decodeTableBytes(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes.subarray(3))
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('euc-kr').decode(bytes)
  }
}

/** 시트 이름 줄([이름])이 붙은 글에서 첫 시트만 — 옛 엑셀 읽기가 시트가 여럿이면 이름 줄을 붙여 준다 */
export function firstSheetOfText(text: string): { body: string; sheets: number; name: string } {
  const chunks = text.split(/\n\n(?=\[[^\]\n]*\]\n)/)
  const first = chunks[0] ?? ''
  const m = /^\[([^\]\n]*)\]\n/.exec(first)
  return { body: m ? first.slice(m[0].length) : first, sheets: chunks.length, name: m?.[1] ?? '' }
}

/** 줄 · 칸 → 붙여넣는 칸에 넣을 글(탭 · 줄). 끝의 빈 칸은 버린다 */
function cellsText(cells: string[][]): string {
  return cells.map((r) => r.join('\t').replace(/\t+$/, '')).join('\n')
}

/** 표 글(탭 · 쉼표) → 제목 위 줄을 버린 글과 한 줄 안내 */
export function tidyTableText(raw: string, fileName: string, extra = ''): BulkFileRead {
  const { cells, dropped } = dropTitleRows(splitPaste(raw))
  if (cells.length === 0) return { ok: false, reason: `「${fileName}」에서 읽을 줄을 찾지 못했어요 — 엑셀에서 목록을 복사해 붙여넣어 주세요.` }
  const bits = [`「${fileName}」에서 ${cells.length}줄을 읽었어요.`]
  if (extra) bits.push(extra)
  if (dropped > 0) bits.push(`표 위의 ${dropped}줄(제목)은 뺐어요.`)
  return { ok: true, text: cellsText(cells), rows: cells.length, note: bits.join(' ') }
}

/**
 * 고른 파일 → 붙여넣는 칸에 넣을 글. 읽지 못하면 까닭을 쉬운 말로.
 * 엑셀 읽기 코드는 필요할 때만 불러온다(고객 관리 화면을 무겁게 하지 않게).
 */
export async function readBulkFile(file: { name: string; type?: string; size?: number; arrayBuffer(): Promise<ArrayBuffer> }): Promise<BulkFileRead> {
  const kind = bulkFileKind(file.name, file.type ?? '')
  if (!kind) return { ok: false, reason: `「${file.name}」은 읽을 수 없는 파일이에요 — 엑셀(.xlsx · .xls)이나 CSV 파일을 골라 주세요.` }
  if ((file.size ?? 0) > BULK_FILE_MAX_BYTES) return { ok: false, reason: `「${file.name}」이 너무 커요(5MB 넘음) — 고객 목록 시트만 따로 저장해서 골라 주세요.` }
  try {
    const buf = await file.arrayBuffer()
    if (kind === 'xlsx') {
      const { readXlsxSheets } = await import('./xlsxText')
      const sheets = (await readXlsxSheets(buf)).filter((s) => s.rows.some((r) => r.some((c) => String(c ?? '').trim() !== '')))
      if (sheets.length === 0) return { ok: false, reason: `「${file.name}」에 내용이 없어요.` }
      const raw = sheets[0].rows.map((r) => r.map((c) => String(c ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n')
      return tidyTableText(raw, file.name, sheets.length > 1 ? `시트가 ${sheets.length}장이라 첫 시트 '${sheets[0].name}' 만 읽었어요.` : '')
    }
    if (kind === 'xls') {
      const { xlsText } = await import('./legacyOffice')
      const first = firstSheetOfText(await xlsText(new Uint8Array(buf)))
      return tidyTableText(first.body, file.name, first.sheets > 1 ? `시트가 ${first.sheets}장이라 첫 시트${first.name ? ` '${first.name}'` : ''}만 읽었어요.` : '')
    }
    return tidyTableText(decodeTableBytes(new Uint8Array(buf)), file.name)
  } catch {
    return { ok: false, reason: `「${file.name}」을 읽지 못했어요(암호가 걸렸거나 다른 형식) — 엑셀에서 목록을 복사해 아래 칸에 붙여넣어 주세요.` }
  }
}
