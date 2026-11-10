/**
 * D-582 여러 업체 한 번에 등록 — 엑셀(또는 메모장)에서 복사해 붙여넣은 표를 업체 목록으로 읽는다.
 *
 * 대표(2026-11-10): "거의 LLM처럼 편하게" · 출시 모드 — 새 고객(외부 컨설턴트)이 맨 먼저 하는 일이 '내 고객 목록 옮기기' 인데,
 * 지금까지는 한 곳씩 등록 창을 열어야 했다.
 *
 *  - 칸 순서는 상관없다. 첫 줄이 제목 줄(회사명 · 대표 · 전화 …)이면 제목으로, 아니면 칸 안의 모양(사업자등록번호 · 전화번호 · 사람 이름)으로 찾는다.
 *  - 찾은 칸은 화면에서 사람이 바꿀 수 있다(여기서는 '추측' 만 한다).
 *  - 이미 있는 업체(사업자등록번호 · 이름)는 건너뛴다 — 크레탑 등록 · 새 업체 등록 창과 같은 규칙(findClientForCretop).
 *  - D-591 이메일 · 주소 칸도 읽는다(제목 줄 · 모양) — 고객 목록에 흔한 칸이라 버리지 않는다.
 * 규칙 계산이다 — AI 가 아니다. 저장은 하지 않는다(등록은 화면이 있는 저장 길 createClient 로 한다).
 */
import { contractStageOf, type ClientOpsRecord } from '../types/clientOps'
import { companyKey, findClientForCretop } from './salesCretop'

export type PasteField = 'companyName' | 'contactName' | 'contactPhone' | 'contactEmail' | 'businessNumber' | 'businessAddress' | 'industry' | 'skip'

export const PASTE_FIELDS: readonly PasteField[] = ['companyName', 'contactName', 'contactPhone', 'contactEmail', 'businessNumber', 'businessAddress', 'industry', 'skip']

export const PASTE_FIELD_LABEL: Record<PasteField, string> = {
  companyName: '회사 이름',
  contactName: '대표 · 담당자',
  contactPhone: '전화',
  contactEmail: '이메일',
  businessNumber: '사업자등록번호',
  businessAddress: '주소',
  industry: '업종',
  skip: '쓰지 않음',
}

/** 한 번에 읽는 줄 수 — 넘는 줄은 읽지 않고 몇 줄 남았는지 알려 준다 */
export const PASTE_MAX_ROWS = 200

export interface PasteRow {
  /** 붙여넣은 표에서 몇 번째 줄인지(1부터 · 제목 줄 포함) */
  line: number
  companyName: string
  contactName: string
  contactPhone: string
  businessNumber: string
  industry: string
  /** D-591 이메일 · 주소 — 없으면 빈 글 */
  contactEmail: string
  businessAddress: string
}

const digits = (v: string) => v.replace(/\D/g, '')

/** 따옴표를 아는 구분자 읽기 — 엑셀은 칸 안에 줄바꿈 · 탭이 있으면 "…" 로 감싼다 */
function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"' && cell === '') {
      quoted = true
      continue
    }
    if (ch === delim) {
      row.push(cell)
      cell = ''
      continue
    }
    if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += ch
  }
  row.push(cell)
  rows.push(row)
  return rows
}

/** 붙여넣은 글 → 줄 · 칸. 탭(엑셀 복사) → 쉼표(CSV) → 한 줄에 한 곳 순서로 본다. 빈 줄은 버린다. */
export function splitPaste(text: string): string[][] {
  const src = text.replace(/\r\n?/g, '\n').replace(/ /g, ' ')
  if (!src.trim()) return []
  const lines = src.split('\n').filter((l) => l.trim() !== '')
  const withTab = lines.filter((l) => l.includes('\t')).length
  const withComma = lines.filter((l) => l.includes(',')).length
  const delim = withTab > 0 ? '\t' : withComma >= Math.max(1, Math.ceil(lines.length / 2)) ? ',' : ''
  const table = delim ? parseDelimited(src, delim) : lines.map((l) => [l])
  const clean = table.map((r) => r.map((c) => c.replace(/\s+/g, ' ').trim())).filter((r) => r.some((c) => c !== ''))
  const width = clean.reduce((m, r) => Math.max(m, r.length), 0)
  return clean.map((r) => (r.length < width ? [...r, ...Array<string>(width - r.length).fill('')] : r))
}

const BIZ_RE = /^\d{3}[-\s]?\d{2}[-\s]?\d{5}$/
const PHONE_RE = /^\(?0\d{1,2}\)?[-\s.]?\d{3,4}[-\s.]?\d{4}$/
const PERSON_RE = /^[가-힣]{2,4}$/
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[A-Za-z]{2,}$/
// 주소 — 시 · 도 이름으로 시작하고 띄어 쓴 뒤 시 · 군 · 구 · 읍 · 면 · 동 · 로 · 길이 이어진다('서울정밀' 같은 회사 이름과 가르려고 띄어쓰기를 본다)
const ADDRESS_RE = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|충청[남북]|전라[남북]|경상[남북])\S*\s+\S*(시|군|구|읍|면|동|로|길)/
const CORP_RE = /\(\s*주\s*\)|㈜|주식회사|유한회사|\(\s*유\s*\)|법인|상사|산업|테크|기업|전자|건설|물산|컴퍼니|컨설팅|조합|농원|식품|상회|엔지니어링|시스템|솔루션/

/**
 * 제목 줄의 한 칸이 어느 항목인지(아니면 null).
 * 칸 전체가 제목 말일 때만 — '대표상사' · '이름테크' 같은 회사 이름을 제목으로 잘못 보면 첫 업체가 통째로 빠진다.
 */
function headerField(cell: string): PasteField | null {
  const c = cell.replace(/[\s:：*·.]/g, '')
  if (!c || c.length > 12) return null
  if (/^(사업자(등록)?(번호|No)|등록번호|사업자No)$/i.test(c)) return 'businessNumber'
  if (/^((대표)?전화(번호)?|대표번호|연락처|휴대폰(번호)?|핸드폰(번호)?|휴대전화|모바일|HP|TEL|Phone)$/i.test(c)) return 'contactPhone'
  if (/^(회사(명|이름)?|업체(명|이름)?|상호(명)?|상호\(법인명\)|법인명|기업명|거래처(명)?|고객사(명)?|사업장명)$/.test(c)) return 'companyName'
  if (/^(대표(자|이사)?(명|성명|이름)?|담당자?(명|성명|이름)?|성명|이름)$/.test(c)) return 'contactName'
  if (/^(업종|업태|종목|업태\/종목|업태종목)$/.test(c)) return 'industry'
  if (/^(이메일|메일|이메일주소|메일주소|전자우편|E-?mail)$/i.test(c)) return 'contactEmail'
  if (/^(주소|사업장주소|사업장소재지|소재지|회사주소|본점소재지|도로명주소)$/.test(c)) return 'businessAddress'
  return null
}

const share = (cells: string[], test: (c: string) => boolean) => {
  const filled = cells.filter((c) => c !== '')
  return filled.length === 0 ? 0 : filled.filter(test).length / filled.length
}

/**
 * D-585 표 위에 얹힌 제목 · 날짜 줄 버리기 — 파일로 받은 표는 맨 위에 '거래처 목록' 같은 줄이 흔하다.
 * 앞 10줄 안에서 제목 말(회사명 · 대표 · 전화 …)이 서로 다른 두 칸 이상인 첫 줄을 제목 줄로 본다.
 * 번호 · 전화가 먼저 나오면 제목 줄이 없는 표 — 그대로 둔다(자료 줄을 버리지 않는다).
 */
export function dropTitleRows(cells: string[][]): { cells: string[][]; dropped: number } {
  const limit = Math.min(cells.length - 1, 10)
  for (let i = 0; i <= limit; i++) {
    const heads = new Set(cells[i].map(headerField).filter((h): h is PasteField => h !== null))
    if (heads.size >= 2) return i === 0 ? { cells, dropped: 0 } : { cells: cells.slice(i), dropped: i }
    if (cells[i].some((c) => BIZ_RE.test(c) || PHONE_RE.test(c))) break
  }
  return { cells, dropped: 0 }
}

export interface ColumnGuess {
  /** 첫 줄을 제목 줄로 봤는지 */
  header: boolean
  /** 칸마다 어느 항목인지 */
  columns: PasteField[]
}

/** 칸마다 어느 항목인지 추측한다 — 제목 줄이 있으면 제목 먼저, 나머지는 칸 안의 모양으로 */
export function guessColumns(cells: string[][]): ColumnGuess {
  const width = cells[0]?.length ?? 0
  if (width === 0) return { header: false, columns: [] }
  const first = cells[0]
  const heads = first.map(headerField)
  const firstLooksData = first.some((c) => BIZ_RE.test(c) || PHONE_RE.test(c))
  const header = heads.some((h) => h !== null) && !firstLooksData && cells.length > 1
  const data = header ? cells.slice(1) : cells
  const columns: PasteField[] = Array<PasteField>(width).fill('skip')
  const used = new Set<PasteField>()
  const take = (i: number, f: PasteField) => {
    if (i < 0 || used.has(f) || columns[i] !== 'skip') return
    columns[i] = f
    used.add(f)
  }
  if (header) heads.forEach((h, i) => h && take(i, h))
  const col = (i: number) => data.map((r) => r[i] ?? '')
  const best = (score: (cells: string[]) => number, min: number) => {
    let at = -1
    let top = min
    for (let i = 0; i < width; i++) {
      if (columns[i] !== 'skip') continue
      const s = score(col(i))
      if (s >= top && (at < 0 || s > top)) {
        at = i
        top = s
      }
    }
    return at
  }
  if (!used.has('businessNumber')) take(best((c) => share(c, (x) => BIZ_RE.test(x)), 0.6), 'businessNumber')
  if (!used.has('contactPhone')) take(best((c) => share(c, (x) => PHONE_RE.test(x)), 0.6), 'contactPhone')
  // D-591 이메일 · 주소는 회사 이름을 찾기 전에 먼저 — 주소 칸(한글 글자)이 회사 이름으로 잘못 잡히지 않게
  if (!used.has('contactEmail')) take(best((c) => share(c, (x) => EMAIL_RE.test(x)), 0.6), 'contactEmail')
  if (!used.has('businessAddress')) take(best((c) => share(c, (x) => ADDRESS_RE.test(x)), 0.6), 'businessAddress')
  if (!used.has('companyName')) {
    let at = best((c) => share(c, (x) => CORP_RE.test(x)), 0.3)
    // 회사 말이 없는 목록(상호만 적은 가게 이름 등) — 숫자가 아니고 사람 이름 칸도 아닌 첫 글자 칸
    if (at < 0) {
      for (let i = 0; i < width; i++) {
        if (columns[i] !== 'skip') continue
        const c = col(i)
        if (share(c, (x) => /[가-힣A-Za-z]/.test(x)) >= 0.6 && share(c, (x) => PERSON_RE.test(x)) < 0.8) {
          at = i
          break
        }
      }
    }
    // 그래도 없으면(전부 두세 글자 이름처럼 보이는 한 칸짜리 목록) 남은 첫 글자 칸
    if (at < 0) at = columns.findIndex((f, i) => f === 'skip' && share(col(i), (x) => /[가-힣A-Za-z]/.test(x)) >= 0.6)
    take(at, 'companyName')
  }
  if (!used.has('contactName')) take(best((c) => share(c, (x) => PERSON_RE.test(x)), 0.6), 'contactName')
  return { header, columns }
}

/** 사업자등록번호 — 숫자 열 자리일 때만 000-00-00000 으로. 아니면 비운다(틀린 번호를 넣지 않는다) */
export function tidyBizNo(v: string): string {
  const d = digits(v)
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : ''
}

/** 전화 — 숫자 8~11자리일 때만 적힌 그대로. 아니면 비운다 */
export function tidyPhone(v: string): string {
  const d = digits(v)
  return d.length >= 8 && d.length <= 11 ? v.trim() : ''
}

/** 이메일 — 이메일 모양일 때만. 아니면 비운다(틀린 주소를 넣지 않는다) */
export function tidyEmail(v: string): string {
  const t = v.trim()
  return EMAIL_RE.test(t) && t.length <= 120 ? t : ''
}

export interface PasteRead {
  rows: PasteRow[]
  /** 회사 이름이 비어 뺀 줄 수 */
  noName: number
  /** 한도(PASTE_MAX_ROWS)를 넘어 읽지 않은 줄 수 */
  over: number
}

/** 줄 · 칸 + 칸 항목 → 업체 줄. 회사 이름이 없는 줄은 뺀다. */
export function rowsFromTable(cells: string[][], guess: ColumnGuess): PasteRead {
  const at = (f: PasteField) => guess.columns.indexOf(f)
  const iName = at('companyName')
  const iWho = at('contactName')
  const iPhone = at('contactPhone')
  const iBiz = at('businessNumber')
  const iInd = at('industry')
  const iMail = at('contactEmail')
  const iAddr = at('businessAddress')
  const start = guess.header ? 1 : 0
  const rows: PasteRow[] = []
  let noName = 0
  let over = 0
  for (let i = start; i < cells.length; i++) {
    const r = cells[i]
    const companyName = iName >= 0 ? (r[iName] ?? '').slice(0, 80) : ''
    if (!companyName) {
      noName++
      continue
    }
    if (rows.length >= PASTE_MAX_ROWS) {
      over++
      continue
    }
    rows.push({
      line: i + 1,
      companyName,
      contactName: iWho >= 0 ? (r[iWho] ?? '').slice(0, 40) : '',
      contactPhone: iPhone >= 0 ? tidyPhone(r[iPhone] ?? '') : '',
      businessNumber: iBiz >= 0 ? tidyBizNo(r[iBiz] ?? '') : '',
      industry: iInd >= 0 ? (r[iInd] ?? '').slice(0, 40) : '',
      contactEmail: iMail >= 0 ? tidyEmail(r[iMail] ?? '') : '',
      businessAddress: iAddr >= 0 ? (r[iAddr] ?? '').slice(0, 200) : '',
    })
  }
  return { rows, noName, over }
}

export interface BulkPlan {
  /** 새로 등록할 줄 */
  add: PasteRow[]
  /** 이미 있는 업체라 건너뛸 줄 */
  dupes: Array<{ row: PasteRow; existing: string }>
  /** 붙여넣은 목록 안에서 위 줄과 같은 업체라 건너뛸 줄 */
  repeats: PasteRow[]
}

/** 등록 계획 — 이미 있는 업체 · 목록 안에서 겹치는 줄은 건너뛴다(같은 사업자등록번호 → 같은 이름, 번호가 서로 다르면 다른 회사) */
export function planBulk(rows: PasteRow[], existing: ClientOpsRecord[]): BulkPlan {
  const add: PasteRow[] = []
  const dupes: BulkPlan['dupes'] = []
  const repeats: PasteRow[] = []
  for (const row of rows) {
    const found = findClientForCretop(existing, { name: row.companyName, bizNo: row.businessNumber })
    if (found) {
      dupes.push({ row, existing: found.companyName })
      continue
    }
    const biz = digits(row.businessNumber)
    const key = companyKey(row.companyName)
    const again = add.some((a) => {
      const theirs = digits(a.businessNumber)
      if (biz.length === 10 && theirs === biz) return true
      if (key === '' || companyKey(a.companyName) !== key) return false
      return !(biz.length === 10 && theirs.length === 10 && theirs !== biz)
    })
    if (again) repeats.push(row)
    else add.push(row)
  }
  return { add, dupes, repeats }
}

/** 미리 보기 위 한 줄 — 몇 곳을 등록하고 무엇을 건너뛰는지 */
export function bulkSummaryLine(plan: BulkPlan, read: Pick<PasteRead, 'noName' | 'over'>): string {
  const parts = [`등록할 곳 ${plan.add.length}`]
  if (plan.dupes.length) parts.push(`이미 있어 건너뛸 곳 ${plan.dupes.length}`)
  if (plan.repeats.length) parts.push(`목록 안에서 겹치는 곳 ${plan.repeats.length}`)
  if (read.noName) parts.push(`회사 이름이 없는 줄 ${read.noName}`)
  if (read.over) parts.push(`한 번에 ${PASTE_MAX_ROWS}곳까지 — 남은 ${read.over}줄은 다음에`)
  return parts.join(' · ')
}

/** 요약 아래 한 줄 — 이메일 · 주소도 같이 넣는 곳 수(없으면 빈 글) */
export function bulkExtrasLine(rows: readonly PasteRow[]): string {
  const mail = rows.filter((r) => r.contactEmail).length
  const addr = rows.filter((r) => r.businessAddress).length
  const parts = [mail ? `이메일 ${mail}곳` : '', addr ? `주소 ${addr}곳` : ''].filter(Boolean)
  return parts.length ? `${parts.join(' · ')}도 같이 넣어요` : ''
}

/* ------------------------------------------------------------------ */
/* D-584 업체 목록 엑셀 파일로 내려받기(CSV) — 붙여넣기의 짝                 */
/* ------------------------------------------------------------------ */

/** 내려받는 표의 제목 줄 — 붙여넣기(guessColumns)가 그대로 다시 읽는 말로 */
export const CLIENTS_CSV_HEADER = ['회사명', '대표자', '전화', '사업자등록번호', '업종', '구분', '다음 할 일', '기한', '등록일', '이메일', '주소'] as const

/** 한 칸 — 쉼표 · 따옴표 · 줄바꿈이 있으면 따옴표로 감싼다. = + - @ 로 시작하면 엑셀이 식으로 읽지 않게 앞에 ' 를 붙인다. */
function csvCell(value: string): string {
  let v = value.replace(/\r\n?/g, '\n')
  if (/^[=+\-@\t]/.test(v)) v = `'${v}`
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** 업체 목록 → CSV(보관한 업체는 뺀다 · 이름 순). 읽기만 — 아무것도 바꾸지 않는다. */
export function clientsCsv(records: readonly ClientOpsRecord[]): { csv: string; count: number } {
  const live = records.filter((r) => r.archivedAt === null).sort((a, b) => a.companyName.localeCompare(b.companyName, 'ko'))
  const lines = [CLIENTS_CSV_HEADER.join(',')]
  for (const r of live) {
    const stage = contractStageOf(r.status)
    lines.push(
      [r.companyName, r.contactName, r.contactPhone, r.businessNumber, r.industry, stage === 'pre' ? '잠재고객' : stage === 'closed' ? '계약 끝남' : '계약 고객', r.nextAction, r.nextActionDueDate, r.createdAt.slice(0, 10), r.contactEmail, r.businessAddress]
        .map((c) => csvCell(String(c ?? '')))
        .join(','),
    )
  }
  return { csv: lines.join('\r\n') + '\r\n', count: live.length }
}

