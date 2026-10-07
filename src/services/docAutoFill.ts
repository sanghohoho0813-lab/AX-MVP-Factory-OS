/**
 * 서류 올리기 → 확실한 것은 바로 넣고, 애매한 것은 까닭을 붙여 '확인 필요' 로 (D-144).
 *
 * D-128 까지는 서류에서 찾은 회사 정보를 전부 '확인 필요' 로만 남겼다. 대표 지시(D-144):
 * "확실한 건 바로 다 입력, 정확히 인식 안 된 것은 반드시 표시".
 *
 * 바로 넣는 조건(셋 다):
 *  1. 서류 종류가 확실하다(docClassify 'sure') — 사업자등록증인지 애매하면 그 안의 값도 믿지 않는다.
 *  2. 글자를 '그대로' 읽었다(PDF 글자 · 글자 파일 · 엑셀). 사진 · 스캔(OCR)은 글자를 잘못 읽을 수 있다 —
 *     단, 사업자등록번호는 검증 숫자가 맞으면 OCR 이어도 넣는다(틀린 글자가 끼면 검증이 안 맞는다).
 *  3. 그 칸이 비어 있다. 이미 다른 값이 적혀 있으면 덮어쓰지 않고 '지금 값과 다름' 으로 묻는다.
 * 값 모양이 이상하면(날짜가 아닌 설립일 · 13자리가 아닌 법인번호) 넣지 않고 묻는다.
 *
 * 규칙 계산이다 — 외부 호출 없음. 저장은 부르는 쪽.
 */
import type { ClientOpsRecord, DocumentKey } from '../types/clientOps'
import { factCandidatesFromDocText } from './docFacts'
import { pendingFacts, withFactCandidates, withFactDecisions, type PendingFact } from './customerFacts'

export type ReadMethod = 'pdf_text' | 'ocr' | 'text' | 'xlsx' | 'none'

export interface ReadDoc {
  key: DocumentKey
  fileName: string
  text: string
  method: ReadMethod
  /** 서류 종류 판별이 확실했나 */
  docSure: boolean
}

export interface FilledFact {
  key: string
  label: string
  display: string
  fileName: string
}

export interface FlaggedFact extends FilledFact {
  note: string
}

export interface AutoFillOutcome {
  record: ClientOpsRecord
  /** 바로 넣은 것 */
  entered: FilledFact[]
  /** 확인을 묻는 것(까닭과 함께) */
  flagged: FlaggedFact[]
}

export const NOTE_OCR = '사진 · 스캔 글자라 한 번 확인해 주세요'
export const NOTE_DOC_UNSURE = '서류 종류가 확실하지 않아 확인이 필요해요'
export const NOTE_SHAPE = '읽은 값의 모양이 이상해요 — 원본과 비교해 주세요'
export const NOTE_CONFLICT = '지금 적힌 값과 달라요 — 어느 쪽이 맞는지 골라 주세요'

/** 사업자등록번호 검증 숫자(국세청 규칙) — 글자 하나만 틀려도 맞지 않는다 */
export function bizNoChecksumOk(value: string): boolean {
  const d = value.replace(/\D/g, '').split('').map(Number)
  if (d.length !== 10) return false
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5]
  let sum = 0
  for (let i = 0; i < 9; i += 1) sum += d[i] * w[i]
  sum += Math.floor((d[8] * 5) / 10)
  return (10 - (sum % 10)) % 10 === d[9]
}

/** 값 모양 검사 — 틀린 글자가 낀 값은 넣지 않는다 */
function shapeOk(key: string, value: string): boolean {
  const v = value.trim()
  if (key === 'businessNumber') return bizNoChecksumOk(v)
  if (key === 'corporateNumber') return v.replace(/\D/g, '').length === 13
  if (key === 'establishedAt' || key === 'representativeBirth') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
    if (!m) return false
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
    return d.getUTCMonth() === +m[2] - 1 && +m[1] >= 1900 && +m[1] <= 2100
  }
  return v.length > 0 && v.length <= 200
}

function noteFor(doc: ReadDoc, key: string, value: string, agreed: boolean): string {
  if (!shapeOk(key, value)) return NOTE_SHAPE
  // D-168: 서로 다른 두 서류가 같은 값을 말하면 — 종류가 애매하거나 스캔이어도 믿는다
  if (agreed) return ''
  if (!doc.docSure) return NOTE_DOC_UNSURE
  if (doc.method === 'ocr' && key !== 'businessNumber') return NOTE_OCR
  return ''
}

/** 비교용 값 — 번호는 숫자만, 글은 띄어쓰기 · (주) 표기를 뺀다 */
function sameKey(key: string, value: string): string {
  if (key === 'businessNumber' || key === 'corporateNumber') return value.replace(/\D/g, '')
  return value.replace(/\s+/g, '').replace(/\(주\)|㈜|주식회사/g, '').toLowerCase()
}

/** 두 서류 이상이 같은 값을 말한 사실(키|값) */
function agreedFacts(docs: readonly ReadDoc[]): Set<string> {
  const seen = new Map<string, Set<number>>()
  docs.forEach((doc, i) => {
    for (const c of factCandidatesFromDocText(doc.key, doc.text, 'agree')) {
      const k = `${c.key}|${sameKey(c.key, c.value)}`
      const s = seen.get(k) ?? new Set<number>()
      s.add(i)
      seen.set(k, s)
    }
  })
  return new Set([...seen].filter(([, s]) => s.size >= 2).map(([k]) => k))
}

/** 올린 서류들 → 바로 넣기 · 확인 필요 */
export function autoFillFromDocs(record: ClientOpsRecord, docs: readonly ReadDoc[], now: string, makeId: () => string): AutoFillOutcome {
  let rec = record
  const entered: FilledFact[] = []
  const flagged: FlaggedFact[] = []
  const agreed = agreedFacts(docs)
  docs.forEach((doc, i) => {
    const ref = `doc:${doc.key}:${now}:${i}`
    const found = factCandidatesFromDocText(doc.key, doc.text, ref).map((c) => {
      const note = noteFor(doc, c.key, c.value, agreed.has(`${c.key}|${sameKey(c.key, c.value)}`))
      return note ? { ...c, note } : c
    })
    if (found.length === 0) return
    rec = withFactCandidates(rec, found, now, makeId)
    const mine = pendingFacts(rec).filter((p) => p.ref === ref && p.from === 'inbox')
    // 비어 있는 칸 · 까닭 없음 → 바로 넣는다
    const auto = mine.filter((p) => !p.note && p.current === '')
    // 다른 값이 이미 적혀 있으면 덮지 않고 묻는다
    const conflicts = mine.filter((p) => !p.note && p.current !== '')
    if (conflicts.length) {
      const ids = new Set(conflicts.map((p) => p.id))
      rec = { ...rec, factInbox: (rec.factInbox ?? []).map((c) => (ids.has(c.id) ? { ...c, note: NOTE_CONFLICT } : c)) }
    }
    if (auto.length) rec = withFactDecisions(rec, auto.map((p) => ({ id: p.id, action: 'accept' as const })), now)
    const label = (p: PendingFact) => ({ key: p.key, label: p.label, display: p.display, fileName: doc.fileName })
    for (const p of auto) entered.push(label(p))
    for (const p of mine) if (!auto.includes(p)) flagged.push({ ...label(p), note: p.note ?? NOTE_CONFLICT })
  })
  return { record: rec, entered, flagged }
}
