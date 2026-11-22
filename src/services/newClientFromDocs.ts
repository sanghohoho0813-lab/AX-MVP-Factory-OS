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
import { isBizRegCertificate } from './koreanDocParser'
import { type ReadMethod } from './docAutoFill'
import { bizNoChecksumOk, readBusinessNumber } from './bizNoRead'
import { looksLikeCretop } from './docSniff'
export {
  EMPTY_DOCS_READ,
  NEW_CLIENT_FIELDS,
  NEW_CLIENT_FIELD_LABEL,
  NOTE_BIZNO_CHECK,
  NOTE_BIZNO_UNREAD,
  NOTE_DIFFERS,
  NOTE_DOC_UNSURE,
  NOTE_FROM_PHOTO,
  applyNewClientGuess,
} from './newClientGuess'
export type { CretopCompanyLite, NewClientDocsRead, NewClientField, NewClientFileNote, NewClientFound, NewClientGuess, ReadForNewClient } from './newClientGuess'
import { NEW_CLIENT_FIELDS, NOTE_BIZNO_CHECK, NOTE_BIZNO_UNREAD, NOTE_DIFFERS, NOTE_DOC_UNSURE, NOTE_FROM_PHOTO, sameKey, type CretopCompanyLite, type NewClientField, type NewClientFileNote, type NewClientFound, type NewClientGuess, type ReadForNewClient } from './newClientGuess'


const BIZ_DOCS: { key: DocumentKey; label: string }[] = [
  { key: 'businessRegistration', label: '사업자등록증' },
  { key: 'corporateRegistry', label: '법인등기부등본' },
]

const FACT_TO_FIELD: Record<string, NewClientField> = {
  companyName: 'companyName',
  representativeName: 'contactName',
  businessNumber: 'businessNumber',
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
  /** D-255: 읽기가 확실하지 않은 까닭(스캔 한 번만 맞음 · 검증 숫자 안 맞음) */
  preNote?: string
  choices?: string[]
  /** 다른 서류와 맞춰 볼 후보 전부(화면에는 choices 만) */
  alts?: string[]
}

function noteOf(hit: Hit): string {
  if (hit.field === 'businessNumber') {
    if (!bizNoChecksumOk(hit.value)) return NOTE_BIZNO_CHECK
    // D-255: 스캔이면 번호 줄을 두 번 읽어 같아야 믿는다(bizNoRead) — 한 번만 맞으면 까닭이 붙어 온다
    if (hit.preNote) return hit.preNote
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
    // D-344 사업자등록증명(새 칸으로 가는 서류)도 사업자등록증처럼 칸을 채운다
    const biz = placed.kind === 'existing' ? BIZ_DOCS.find((b) => b.key === placed.key) : isBizRegCertificate(doc.text) ? { key: 'businessRegistration', label: '사업자등록증명' } : undefined
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
        ...(field === 'businessNumber' && cand.note ? { preNote: cand.note } : {}),
        ...(field === 'businessNumber' && cand.choices?.length ? { choices: cand.choices, alts: readBusinessNumber(doc.text).alternatives } : {}),
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
    if (field === 'businessNumber') {
      const g = guessBizNo(mine)
      if (g) guess[field] = g
      continue
    }
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
 * D-255: 사업자등록번호 고르기 — 확실한 것(PDF 글자 · 크레탑 · 두 번 읽어 같은 스캔)이 먼저.
 * 확실한 게 없으면 칸은 비우고 후보만(하나를 누르게). 확실하지 않은 스캔의 후보 가운데 다른 서류 번호와 같은 게 있으면 그걸로.
 */
function guessBizNo(mine: readonly Hit[]): NewClientFound | undefined {
  const byRank = (a: Hit, b: Hit) => a.rank - b.rank
  const k = (v: string) => sameKey('businessNumber', v)
  // 검증 숫자가 틀린 번호(크레탑 등)는 헷갈리기 쉬운 숫자를 바꿔 본 후보를 붙인다
  const optionsOf = (h: Hit) => [h.value, ...(h.choices ?? []), ...(h.alts ?? []), ...(bizNoChecksumOk(h.value) ? [] : readBusinessNumber(`등록번호 : ${h.value}`).alternatives)]
  const sure = mine.filter((h) => !h.preNote && bizNoChecksumOk(h.value)).sort(byRank)
  const unsure = mine.filter((h) => !sure.includes(h)).sort(byRank)
  if (sure.length) {
    const best = sure[0]
    const key = k(best.value)
    const differs = sure.some((h) => k(h.value) !== key) || unsure.some((h) => !optionsOf(h).some((v) => k(v) === key))
    const agreed = mine.some((h) => h !== best && optionsOf(h).some((v) => k(v) === key))
    const note = differs ? NOTE_DIFFERS : agreed ? '' : noteOf(best)
    return { value: best.value, fileName: best.fileName, docLabel: best.docLabel, note }
  }
  const best = unsure[0]
  if (!best) return undefined
  const all = [...new Set(unsure.flatMap((h) => [h.value, ...(h.choices ?? []), ...(bizNoChecksumOk(h.value) ? [] : readBusinessNumber(`등록번호 : ${h.value}`).candidates)]).filter((v) => bizNoChecksumOk(v)).map((v) => formatBizNo(v)))]
  const choices = all.slice(0, 4)
  const note = best.preNote ?? (choices.length ? `${NOTE_BIZNO_CHECK} (읽힌 글자: ${best.value})` : `${NOTE_BIZNO_UNREAD} (읽힌 글자: ${best.value})`)
  return { value: '', fileName: best.fileName, docLabel: best.docLabel, note, ...(choices.length ? { choices } : {}) }
}


/** 크레탑 보고서처럼 보이나 — 등록 창이 크레탑 엔진을 부를지 정한다(아직 칸이 없으니 글자 · 파일 이름으로만) */
export function looksLikeCretopForNewClient(doc: ReadForNewClient): boolean {
  return looksLikeCretop({ key: '', text: doc.text, fileName: doc.fileName })
}
