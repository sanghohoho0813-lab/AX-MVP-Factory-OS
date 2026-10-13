/**
 * 새 업체 등록 창 — 서류로 칸 채우기 (D-187).
 *
 * 대표: "고객 처음 입력할 때 크레탑이나 사업자등록증만 넣어도 기본 입력이 다 되도록".
 * 예전에는 등록 창에 이름부터 적고, 업체를 연 다음에야 [서류 올리기] 로 읽었다.
 * 이제 등록 창에 서류를 넣으면 글자를 읽어 업체명 · 대표자 · 사업자등록번호를 채운다.
 *
 *  - 어느 서류를 믿나: 사업자등록증 → 법인등기부등본 → 크레탑 보고서 순서. 같은 칸을 여러 서류가 말하면 앞의 것.
 *  - 한 번 봐야 하는 값은 까닭을 붙인다: 사진 · 스캔(OCR) 글자, 검증이 안 맞는 사업자번호, 서류마다 다른 값.
 *    등록 창 자체가 확인하는 자리라 값은 채워 두고 까닭만 보여 준다.
 *  - 빈 칸만 채운다 — 사람이 적은 것은 덮지 않는다(부르는 쪽).
 *  - 휴대폰번호는 채우지 않는다 — 서류의 전화는 회사 대표번호라 대표자 휴대폰이 아니다(D-146 과 같은 까닭).
 *
 * 등록하면 같은 파일을 업체 상세 '서류 올리기' 로 넘겨(docHandoff) 서류함 · 회사 정보 · 크레탑 · 명부 분석까지 이어서 한다.
 * 규칙 계산 — 외부 호출 없음. 크레탑 엔진은 무거워서 부르는 쪽이 읽어 넘긴다.
 */

import type { DocumentKey } from '../types/clientOps'
import { allDocumentMetas } from './clientOpsDocuments'
import { placeDocument } from './docClassify'
import { factCandidatesFromDocText } from './docFacts'
import { bizNoChecksumOk, type ReadMethod } from './docAutoFill'
import { looksLikeCretop } from './docAutoAnalyze'
import type { HandoffDoc } from './docHandoff'

export type NewClientField = 'companyName' | 'contactName' | 'businessNumber'

export const NEW_CLIENT_FIELDS: readonly NewClientField[] = ['companyName', 'contactName', 'businessNumber']

export const NEW_CLIENT_FIELD_LABEL: Record<NewClientField, string> = {
  companyName: '업체명',
  contactName: '대표자',
  businessNumber: '사업자등록번호',
}

export interface NewClientFound {
  value: string
  fileName: string
  /** 어느 서류에서 — '사업자등록증' · '법인등기부등본' · '크레탑 보고서' */
  docLabel: string
  /** 한 번 봐야 하는 까닭 — 없으면 '' */
  note: string
}

export type NewClientGuess = Partial<Record<NewClientField, NewClientFound>>

/** 등록 창에서 읽은 파일 하나 */
export interface ReadForNewClient {
  fileName: string
  text: string
  method: ReadMethod
}

/** 크레탑 보고서에서 읽은 회사(salesCretop.cretopCompany 모양에서 셋만) */
export interface CretopCompanyLite {
  fileName: string
  method: ReadMethod
  name: string
  bizNo: string
  ceo: string
}

/** 파일마다 무엇으로 읽었나 — 등록 창 목록에 '사업자등록증 · 업체명 · 대표자' 처럼 보인다 */
export interface NewClientFileNote {
  fileName: string
  /** 알아본 서류 이름 — 모르면 '' (등록하면 서류함에서 칸을 정한다) */
  docLabel: string
  found: NewClientField[]
}

/** 등록 창이 받는 것 — 넘길 서류 · 칸에 넣을 값 · 파일마다 알아본 것 · 아직 읽는 중인가 */
export interface NewClientDocsRead {
  docs: HandoffDoc[]
  guess: NewClientGuess
  files: NewClientFileNote[]
  reading: boolean
}

export const EMPTY_DOCS_READ: NewClientDocsRead = { docs: [], guess: {}, files: [], reading: false }

export const NOTE_FROM_PHOTO = '사진 · 스캔에서 읽은 글자라 틀릴 수 있어요 — 한 번 봐 주세요'
export const NOTE_BIZNO_CHECK = '번호 검증이 맞지 않아요 — 서류와 한 글자씩 비교해 주세요'
export const NOTE_DOC_UNSURE = '서류 종류가 확실하지 않아요 — 맞는지 봐 주세요'
export const NOTE_DIFFERS = '서류마다 적힌 값이 달라요 — 맞는 것으로 고쳐 주세요'

const BIZ_DOCS: { key: DocumentKey; label: string }[] = [
  { key: 'businessRegistration', label: '사업자등록증' },
  { key: 'corporateRegistry', label: '법인등기부등본' },
]

const FACT_TO_FIELD: Record<string, NewClientField> = {
  companyName: 'companyName',
  representativeName: 'contactName',
  businessNumber: 'businessNumber',
}

/** 비교용 — 번호는 숫자만, 글은 띄어쓰기 · (주) 표기를 뺀다(docAutoFill 과 같은 규칙) */
function sameKey(field: NewClientField, value: string): string {
  if (field === 'businessNumber') return value.replace(/\D/g, '')
  return value.replace(/\s+/g, '').replace(/\(주\)|㈜|주식회사/g, '').toLowerCase()
}

/** '1248100998' → '124-81-00998' (10자리일 때만) */
export function formatBizNo(value: string): string {
  const d = value.replace(/\D/g, '')
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : value.trim()
}

interface Hit {
  field: NewClientField
  value: string
  fileName: string
  docLabel: string
  /** 낮을수록 믿는다: 사업자등록증 0 · 등기 1 · 크레탑 2 */
  rank: number
  method: ReadMethod
  docSure: boolean
}

function noteOf(hit: Hit): string {
  if (hit.field === 'businessNumber') {
    // 검증 숫자가 맞으면 사진에서 읽었어도 믿는다(틀린 글자가 끼면 맞지 않는다)
    if (!bizNoChecksumOk(hit.value)) return NOTE_BIZNO_CHECK
    return hit.docSure ? '' : NOTE_DOC_UNSURE
  }
  if (!hit.docSure) return NOTE_DOC_UNSURE
  if (hit.method === 'ocr') return NOTE_FROM_PHOTO
  return ''
}

/** 읽은 서류들 → 등록 창 칸에 넣을 값 · 파일마다 알아본 것 */
export function guessNewClientFromDocs(
  docs: readonly ReadForNewClient[],
  cretop: readonly CretopCompanyLite[] = [],
): { guess: NewClientGuess; files: NewClientFileNote[] } {
  const metas = allDocumentMetas({ customDocuments: [] })
  const hits: Hit[] = []
  const files: NewClientFileNote[] = []
  const cretopByFile = new Map(cretop.map((c) => [c.fileName, c]))

  for (const doc of docs) {
    const note: NewClientFileNote = { fileName: doc.fileName, docLabel: '', found: [] }
    files.push(note)
    const c = cretopByFile.get(doc.fileName)
    if (c) {
      note.docLabel = '크레탑 보고서'
      const pairs: [NewClientField, string][] = [
        ['companyName', c.name],
        ['contactName', c.ceo],
        ['businessNumber', c.bizNo],
      ]
      for (const [field, value] of pairs) {
        if (value.trim() === '') continue
        hits.push({ field, value: field === 'businessNumber' ? formatBizNo(value) : value.trim(), fileName: doc.fileName, docLabel: note.docLabel, rank: 2, method: c.method, docSure: true })
        note.found.push(field)
      }
      continue
    }
    if (doc.text.replace(/\s/g, '').length < 10) continue
    const placed = placeDocument({ text: doc.text, fileName: doc.fileName }, metas)
    const biz = placed.kind === 'existing' ? BIZ_DOCS.find((b) => b.key === placed.key) : undefined
    if (!biz) {
      if (placed.kind === 'existing') note.docLabel = placed.label
      else if (placed.sure) note.docLabel = placed.label
      continue
    }
    note.docLabel = biz.label
    for (const cand of factCandidatesFromDocText(biz.key, doc.text, `new:${doc.fileName}`)) {
      const field = FACT_TO_FIELD[cand.key]
      if (!field || cand.value.trim() === '') continue
      hits.push({
        field,
        value: field === 'businessNumber' ? formatBizNo(cand.value) : cand.value.trim(),
        fileName: doc.fileName,
        docLabel: biz.label,
        rank: biz.key === 'businessRegistration' ? 0 : 1,
        method: doc.method,
        docSure: placed.sure,
      })
      if (!note.found.includes(field)) note.found.push(field)
    }
  }

  // 찾은 칸은 등록 창 칸 순서로(업체명 · 대표자 · 사업자등록번호)
  for (const f of files) f.found.sort((a, b) => NEW_CLIENT_FIELDS.indexOf(a) - NEW_CLIENT_FIELDS.indexOf(b))
  const guess: NewClientGuess = {}
  for (const field of NEW_CLIENT_FIELDS) {
    const mine = hits.filter((h) => h.field === field)
    if (mine.length === 0) continue
    // 믿는 순서 → 같은 순서면 먼저 넣은 파일. 다른 서류가 같은 값을 말하면 사진 · 종류 까닭은 지운다
    const best = [...mine].sort((a, b) => a.rank - b.rank)[0]
    const agreed = mine.filter((h) => h !== best && sameKey(field, h.value) === sameKey(field, best.value)).length > 0
    const differs = mine.some((h) => sameKey(field, h.value) !== sameKey(field, best.value))
    let note = noteOf(best)
    if (agreed && note !== NOTE_BIZNO_CHECK) note = ''
    if (differs) note = NOTE_DIFFERS
    guess[field] = { value: best.value, fileName: best.fileName, docLabel: best.docLabel, note }
  }
  return { guess, files }
}

/**
 * 찾은 값 → 등록 창 칸. 빈 칸 · 앞서 서류로 채운 그대로인 칸만 바꾼다(사람이 적은 것은 덮지 않는다).
 * 사람이 적은 값과 다르면 '다름' 으로 돌려준다 — 칸 밑에 [서류 값으로] 를 보인다.
 * 서류를 빼서 더 이상 찾지 못한 값은, 서류로 채운 그대로면 비운다.
 */
export function applyNewClientGuess<F extends Record<NewClientField, string>>(
  form: F,
  guess: NewClientGuess,
  prevFilled: NewClientGuess,
): { form: F; filled: NewClientGuess; differs: NewClientGuess } {
  const next = { ...form }
  const filled: NewClientGuess = {}
  const differs: NewClientGuess = {}
  for (const field of NEW_CLIENT_FIELDS) {
    const g = guess[field]
    const now = form[field] ?? ''
    const prev = prevFilled[field]
    const untouched = now.trim() === '' || (prev !== undefined && now === prev.value)
    if (!g) {
      if (prev && now === prev.value) next[field] = '' as F[typeof field]
      continue
    }
    if (untouched) {
      next[field] = g.value as F[typeof field]
      filled[field] = g
    } else if (sameKey(field, now) === sameKey(field, g.value)) {
      filled[field] = { ...g, value: now }
    } else {
      differs[field] = g
    }
  }
  return { form: next, filled, differs }
}

/** 크레탑 보고서처럼 보이나 — 등록 창이 크레탑 엔진을 부를지 정한다(아직 칸이 없으니 글자 · 파일 이름으로만) */
export function looksLikeCretopForNewClient(doc: ReadForNewClient): boolean {
  return looksLikeCretop({ key: '', text: doc.text, fileName: doc.fileName })
}
