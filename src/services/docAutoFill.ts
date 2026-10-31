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
import { CUSTOM_FACT_PREFIX, customFactValue, formatWon, pendingFacts, readFact, withFactCandidates, withFactDecisions, parseWonInput, type PendingFact } from './customerFacts'
import { bizNoChecksumOk, readBusinessNumber } from './bizNoRead'
import { fullYearFromReturns, mergeVatTrend, periodOfReturnValue, readVatReturn, type VatReturnRead } from './vatReturnDoc'
import { mergeHeadcountTrend, readWithholdingReport } from './withholdingReport'
import { withCustomField } from './clientOpsService'
import { readSiteReport } from './siteReportDoc'

export type ReadMethod = 'pdf_text' | 'ocr' | 'text' | 'xlsx' | 'hwp' | 'docx' | 'xls' | 'doc' | 'pptx' | 'none'

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

export { bizNoChecksumOk }

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

/**
 * D-311 부가세 과세표준증명 매출은 재무제표 · 크레탑 · 직접 적은 매출에 밀린다 — 같은 해이거나 더 최근 해 값이 이미 있으면(연도를 모르는 값도) 묻지 않는다.
 * 부가세 서류끼리면(다시 받은 증명) 다르면 묻는다.
 */
function vatYields(record: ClientOpsRecord, year: string, source = 'vatCertificate'): boolean {
  const f = readFact(record, 'revenue')
  if (!f || f.status === 'missing') return false
  if (f.source === source) return false
  const y = /^(\d{4})/.exec(f.asOf)?.[1]
  return !y || Number(y) >= Number(year)
}

/**
 * D-373 소득금액증명 매출 · 순이익도 같은 규칙 — 다른 출처(재무제표 · 크레탑 · 부가세 · 직접)의 같은 해 이상 값이 있으면 묻지 않는다.
 * 매출 추이: 소득금액증명 줄은 이미 있는 줄에 밀리고, 부가세 줄은 소득금액증명 줄에 밀린다(둘 다 올려도 질문이 생기지 않게).
 */
function docYields(record: ClientOpsRecord, c: { key: string; source: string; asOf: string; value?: string }): boolean {
  // D-390 세무조정계산서 안 표준재무제표 숫자는 다른 출처(재무제표 · 크레탑 · 직접)의 같은 해 이상 값에 밀린다 — 작년 신고서를 올려도 올해 값과 다르다고 묻지 않게
  if (c.source === 'taxReturn' && FIN_KEYS.has(c.key)) {
    const f = readFact(record, c.key)
    if (!f || f.status === 'missing' || f.source === c.source) return false
    const y = /^(\d{4})/.exec(f.asOf)?.[1]
    return !y || Number(y) >= Number(c.asOf.slice(0, 4))
  }
  // D-392 법인 설립일은 등기부 '회사성립연월일' 이 맞다 — 사업자등록증 개업일은 등기부 날짜가 이미 있으면 묻지 않는다
  if (c.key === 'establishedAt' && c.source === 'businessRegistration') {
    const f = readFact(record, 'establishedAt')
    return !!f && f.status !== 'missing' && f.source === 'corporateRegistry'
  }
  // D-406 재무제표 · 세무조정계산서의 매출 추이(두 해) — 과세표준증명 · 소득금액증명의 여러 해 줄이 이미 있으면 그것이 먼저.
  //        같은 출처끼리면 더 최근 해가 바꾸고(아래), 같거나 앞선 해는 묻지 않는다
  // D-408 서류끼리(재무제표 · 세무조정계산서 · 과세표준증명 · 소득금액증명 · 사업장현황신고서)는 묻지 않는다 —
  //        더 최근 해(같은 해면 재무제표가 사업장현황신고서를)가 아래에서 바로 바꾸고, 같거나 앞선 해는 먼저 있던 줄 그대로.
  //        한 번에 같이 올려도(재무제표 + 과세표준증명) 먼저 읽힌 줄이 남고 묻지 않는다. 과세표준증명은 소득금액증명 줄에 늘 밀린다(D-373 — 면세 매출 빠짐)
  if (c.key === TREND_KEY && TREND_DOCS.has(c.source)) {
    if (!customFactValue(record, '매출 추이')) return false
    const m = record.factMeta?.[c.key]
    if (m && TREND_DOCS.has(m.source)) {
      if (c.source === 'vatCertificate' && m.source === 'incomeCertificate') return true
      return !trendBeats(c, m)
    }
    // 사람이 적은 줄 — 재무제표 · 세무조정계산서 · 소득금액증명은 그대로 두고 묻지 않는다(D-406 · D-373). 과세표준증명은 예전처럼 묻는다
    if (c.source !== 'vatCertificate') return true
  }
  // D-408 업태 · 종목 — 이미 적힌 글이 새 글을 다 담으면 묻지 않는다(더 긴 쪽이 이미 있음)
  if (c.key === 'businessCategory' || c.key === 'businessItem') {
    const f = readFact(record, c.key)
    if (f && f.status !== 'missing' && bizTextContains(f.value, c.value ?? '')) return true
  }
  // D-391 다른 달 원천세 신고서를 또 올리면 — 같은 달이거나 더 앞선 달은 묻지 않고 그대로(더 최근 달은 아래에서 바로 바꾼다)
  // D-395 부가세 신고서도 같은 규칙 — 더 최근 신고 기간이 바꾸고, 같거나 앞선 기간은 묻지 않는다
  // D-408 사업장현황신고서도 — 두 해를 한 번에 올려도 종업원수 · 매출은 더 최근 해로, 앞선 해는 묻지 않는다
  if (c.source === 'withholding' || c.source === 'vatReturn' || c.source === 'siteReport') {
    const m = record.factMeta?.[c.key]
    if (m?.source === c.source && c.asOf && m.asOf && c.asOf <= m.asOf) return true
  }
  // D-391 원천세 신고서의 근로자 수는 이미 적힌 직원 수(명부 · 직접 적음)에 밀린다 — 퇴사 · 대표 급여로 한두 명 달라도 묻지 않는다
  if ((c.source === 'withholding' || c.source === 'siteReport') && c.key === 'employeeCount') {
    const f = readFact(record, 'employeeCount')
    return !!f && f.status !== 'missing' && f.source !== c.source
  }
  if (c.key === 'revenue' && (c.source === 'vatCertificate' || c.source === 'vatReturn' || c.source === 'siteReport')) return vatYields(record, c.asOf, c.source)
  if (c.source !== 'incomeCertificate' && !(c.source === 'vatCertificate' && c.key === `${CUSTOM_FACT_PREFIX}매출 추이`)) return false
  if (c.key === 'revenue' || c.key === 'netIncome') {
    const f = readFact(record, c.key)
    if (!f || f.status === 'missing' || f.source === c.source) return false
    const y = /^(\d{4})/.exec(f.asOf)?.[1]
    return !y || Number(y) >= Number(c.asOf)
  }
  if (c.key === `${CUSTOM_FACT_PREFIX}매출 추이`) {
    if (!customFactValue(record, '매출 추이')) return false
    const from = record.factMeta?.[c.key]?.source
    return c.source === 'incomeCertificate' ? from !== 'incomeCertificate' : from === 'incomeCertificate'
  }
  return false
}

const FIN_KEYS = new Set(['revenue', 'operatingProfit', 'netIncome', 'totalAssets', 'totalLiabilities'])
/** D-406 매출 · 이익을 말하는 서류의 종류 — 같은 종류끼리만 더 최근 해가 바꾼다(재무제표 = 세무조정계산서의 표준재무제표) */
/** D-408 '매출 추이' 줄을 만드는 서류 — 서류끼리는 묻지 않는다(더 최근 해가 바꾸고 같거나 앞선 해는 먼저 있던 줄 그대로) */
const TREND_KEY = `${CUSTOM_FACT_PREFIX}매출 추이`
const TREND_DOCS = new Set(['financialStatements', 'taxReturn', 'vatCertificate', 'incomeCertificate', 'siteReport'])
const yearOf = (s: string | undefined) => /^(\d{4})/.exec(s ?? '')?.[1] ?? ''
/** 같은 해면 재무제표 · 세무조정계산서가 사업장현황신고서 줄을 바꾼다(D-407 — 더 자세한 장부) */
function trendBeats(cand: { source: string; asOf: string }, cur: { source: string; asOf?: string }): boolean {
  const cy = yearOf(cand.asOf)
  const my = yearOf(cur.asOf)
  if (!cy || !my) return false
  if (cy > my) return true
  return cy === my && (cand.source === 'financialStatements' || cand.source === 'taxReturn') && cur.source === 'siteReport'
}

/** D-408 업태 · 종목 — 한쪽 글이 다른 쪽을 다 담으면(‘응용소프트웨어 개발’ ⊂ ‘응용소프트웨어 개발 및 공급업’) 같은 뜻 */
const bizNorm = (v: string) => v.replace(/[\s·,./()]/g, '')
export function bizTextContains(longer: string, shorter: string): boolean {
  const a = bizNorm(longer)
  const b = bizNorm(shorter)
  return b.length >= 2 && a.length > b.length && a.includes(b)
}

function finFamily(source: string | undefined): string {
  if (source === 'financialStatements' || source === 'taxReturn') return 'fs'
  if (source === 'vatCertificate' || source === 'incomeCertificate' || source === 'siteReport' || source === 'vatReturn') return source
  return ''
}

/** 올린 서류들 → 바로 넣기 · 확인 필요 */
export function autoFillFromDocs(record: ClientOpsRecord, docs: readonly ReadDoc[], now: string, makeId: () => string): AutoFillOutcome {
  let rec = record
  const entered: FilledFact[] = []
  const flagged: FlaggedFact[] = []
  const agreed = agreedFacts(docs)
  // D-255: 다른 서류가 확실하게 말한 사업자등록번호(크레탑 · 등기 · PDF 글자) — 스캔 후보 가운데 이것과 같은 게 있으면 그걸로
  const sureNos = docs.map((d) => factCandidatesFromDocText(d.key, d.text, 'sure').filter((c) => c.key === 'businessNumber' && !c.note && bizNoChecksumOk(c.value)).map((c) => c.value.replace(/\D/g, '')))
  docs.forEach((doc, i) => {
    const ref = `doc:${doc.key}:${now}:${i}`
    const others = new Set(sureNos.filter((_, j) => j !== i).flat())
    const found = factCandidatesFromDocText(doc.key, doc.text, ref).map((c) => {
      const pick = c.key === 'businessNumber' && c.note ? [c.value, ...(c.choices ?? []), ...readBusinessNumber(doc.text).alternatives].find((v) => others.has(v.replace(/\D/g, ''))) : undefined
      if (pick) return { key: c.key, value: pick, source: c.source, asOf: c.asOf, ref: c.ref }
      const isAgreed = agreed.has(`${c.key}|${sameKey(c.key, c.value)}`)
      const note = noteFor(doc, c.key, c.value, isAgreed)
      // D-255: 다른 서류(크레탑 · 등기)가 같은 번호를 말하면 — 스캔 한 번 읽기 · 후보 까닭을 지운다(서로 맞춰 봤다)
      if (isAgreed && !note) return { key: c.key, value: c.value, source: c.source, asOf: c.asOf, ref: c.ref, ...(c.label ? { label: c.label } : {}), ...(c.group ? { group: c.group } : {}) }
      return note ? { ...c, note } : c
    }).filter((c) => !docYields(rec, c))
    if (found.length === 0) return
    rec = withFactCandidates(rec, found, now, makeId)
    const mine = pendingFacts(rec).filter((p) => p.ref === ref && p.from === 'inbox')
    // 비어 있는 칸 · 까닭 없음 → 바로 넣는다. D-392 사업자등록증 개업일이 먼저 들어간 설립일은 등기부 회사성립일로 바꾼다(묻지 않음)
    const regWins = (p: PendingFact) =>
      (p.key === 'establishedAt' && p.source === 'corporateRegistry' && readFact(rec, 'establishedAt')?.source === 'businessRegistration') ||
      // D-408 업태 · 종목 — 새 글이 지금 글을 다 담으면(더 자세함) 묻지 않고 새 글로. 사람이 적은 값은 그대로 묻는다
      ((p.key === 'businessCategory' || p.key === 'businessItem') && p.source !== 'manual' && readFact(rec, p.key)?.source !== 'manual' && bizTextContains(p.value, p.current)) ||
      // D-408 같은 해 이후 재무제표 매출은 과세표준(면세 매출 빠짐) · 부가세 신고서 · 사업장현황신고서 매출을 묻지 않고 바꾼다 —
      //        같이 올렸을 때 순서에 따라 묻던 것. 재무제표가 더 앞선 해면 예전처럼 묻는다(D-311)
      (p.key === 'revenue' && p.source === 'financialStatements' && (() => {
        const f = readFact(rec, 'revenue')
        return !!f && (f.source === 'vatCertificate' || f.source === 'vatReturn' || f.source === 'siteReport') && !!yearOf(p.asOf) && !!yearOf(f.asOf) && yearOf(p.asOf) >= yearOf(f.asOf)
      })())
    // D-391 더 최근 달 원천세 신고서 — 앞 달 값을 바로 바꾼다(묻지 않음)
    const newerMonth = (p: PendingFact) => {
      const m = rec.factMeta?.[p.key]
      // D-408 매출 추이 — 서류끼리면 더 최근 해(같은 해면 재무제표가 사업장현황신고서를)가 바로 바꾼다
      if (p.key === TREND_KEY && TREND_DOCS.has(p.source) && m && TREND_DOCS.has(m.source)) return trendBeats(p, m)
      if (!p.asOf || p.asOf <= (m?.asOf ?? '')) return false
      if ((p.source === 'withholding' || p.source === 'vatReturn' || p.source === 'siteReport') && m?.source === p.source) return true
      // D-406 매출 · 이익 · 자산 · 부채 — 같은 종류 서류끼리면 더 최근 해가 바꾼다(2025 재무제표 뒤 2026 재무제표 · 세무조정계산서).
      //        종류가 다르면(부가세 과세표준은 면세 매출이 빠짐 — D-311) · 사람이 적은 값이면 그대로 묻는다
      return FIN_KEYS.has(p.key) && !!m && finFamily(p.source) !== '' && finFamily(p.source) === finFamily(m.source) && /^\d{4}/.test(p.asOf) && /^\d{4}/.test(m.asOf ?? '') && p.asOf.slice(0, 4) > (m.asOf ?? '').slice(0, 4)
    }
    const auto = mine.filter((p) => !p.note && (p.current === '' || regWins(p) || newerMonth(p)))
    // 다른 값이 이미 적혀 있으면 덮지 않고 묻는다
    const conflicts = mine.filter((p) => !p.note && p.current !== '' && !auto.includes(p))
    if (conflicts.length) {
      const ids = new Set(conflicts.map((p) => p.id))
      rec = { ...rec, factInbox: (rec.factInbox ?? []).map((c) => (ids.has(c.id) ? { ...c, note: NOTE_CONFLICT } : c)) }
    }
    if (auto.length) rec = withFactDecisions(rec, auto.map((p) => ({ id: p.id, action: 'accept' as const })), now)
    const label = (p: PendingFact) => ({ key: p.key, label: p.label, display: p.display, fileName: doc.fileName })
    for (const p of auto) {
      // 같은 칸을 앞 서류가 넣었으면(개업일 → 회사성립일) 앞 줄은 지운다 — '바로 넣은 것' 에 한 줄만
      const before = entered.findIndex((e) => e.key === p.key)
      if (before >= 0) entered.splice(before, 1)
      entered.push(label(p))
    }
    for (const p of mine) if (!auto.includes(p)) flagged.push({ ...label(p), note: p.note ?? NOTE_CONFLICT })
  })
  // D-403 원천세 신고서 여러 달(이번에 · 예전에) → '원천세 인원 추이' 칸(달이 둘 이상일 때) — 작년 같은 달과 비교해 고용 증가를 본다
  const whReads = docs.map((d) => readWithholdingReport(d.text)).filter((r): r is NonNullable<typeof r> => !!r && !!r.yearMonth && !r.until)
  if (whReads.length) {
    const cur = rec.customFields.find((f) => f.label === '원천세 인원 추이')
    // 올리기 전 '원천세 신고 인원' 칸의 달(예: '2025년 9월분 근로자 9명')도 씨앗으로 — 이번 서류가 그 칸을 새 달로 바꿨어도 지난 달이 남게
    const seed = /(20\d{2})년 (\d{1,2})월분 근로자 (\d{1,4})명/.exec(customFactValue(record, '원천세 신고 인원'))
    const seedRead = seed ? [{ yearMonth: `${seed[1]}-${seed[2].padStart(2, '0')}`, employees: Number(seed[3]) }] : []
    const merged = mergeHeadcountTrend(cur?.value ?? '', [...seedRead, ...whReads.map((r) => ({ yearMonth: r.yearMonth, employees: r.employees }))])
    if (merged && merged !== cur?.value) rec = withCustomField(rec, { id: cur?.id, group: cur?.group ?? 'people', label: '원천세 인원 추이', value: merged })
  }
  // D-405 부가세 신고서 여러 기간(이번에 · 예전에) → '부가세 신고 추이' 칸 — 작년 같은 기간과 비교해 올해 매출 흐름을 본다
  const vrReads = docs.map((d) => readVatReturn(d.text)).filter((r): r is VatReturnRead => !!r && !!r.from && !!r.to)
  if (vrReads.length) {
    const curT = rec.customFields.find((f) => f.label === '부가세 신고 추이')
    const seedP = periodOfReturnValue(customFactValue(record, '부가세 신고 매출'))
    const seedWon = seedP ? parseWonInput(seedP.amountText) : null
    const seed = seedP && seedWon !== null ? [{ from: seedP.from, to: seedP.to, base: seedWon }] : []
    const merged = mergeVatTrend(curT?.value ?? '', [...seed, ...vrReads.map((r) => ({ from: r.from, to: r.to, base: r.base }))])
    if (merged && merged !== curT?.value) rec = withCustomField(rec, { id: curT?.id, group: curT?.group ?? 'identity', label: '부가세 신고 추이', value: merged })
  }
  // D-407 면세사업자 사업장현황신고서 — 올리기 전 매출이 같은 서류의 바로 앞 해면 '매출 추이'(작년보다 +N%). 재무제표가 없는 병원 · 학원도 매출 성장세를 본다
  //        과세표준증명 · 소득금액증명 · 재무제표 줄이 이미 있으면 그것이 먼저
  const sr = docs.map((d) => readSiteReport(d.text)).filter((r): r is NonNullable<typeof r> => !!r).sort((a, b) => a.year - b.year)
  if (sr.length) {
    const before = readFact(record, 'revenue')
    const pts = new Map<number, number>()
    if (before && before.status !== 'missing' && before.source === 'siteReport' && /^\d{4}/.test(before.asOf)) {
      const w = parseWonInput(before.value)
      if (w !== null && w > 0) pts.set(Number(before.asOf.slice(0, 4)), w)
    }
    for (const r of sr) pts.set(r.year, r.revenue)
    const latest = Math.max(...pts.keys())
    const cur = pts.get(latest)
    const prev = pts.get(latest - 1)
    const trendFrom = rec.factMeta?.[`${CUSTOM_FACT_PREFIX}매출 추이`]?.source
    const trendMeta = rec.factMeta?.[TREND_KEY]
    const replaceable = !customFactValue(rec, '매출 추이') || trendFrom === 'siteReport' || (!!trendMeta && TREND_DOCS.has(trendMeta.source) && trendBeats({ source: 'siteReport', asOf: String(latest) }, trendMeta))
    if (cur && prev && prev > 0 && replaceable) {
      const pct = Math.round(((cur - prev) / prev) * 100)
      const line = `${latest}년 ${formatWon(cur)}(사업장현황신고서 · ${latest - 1}년보다 ${pct > 0 ? '+' : ''}${pct}%)`
      const curF = rec.customFields.find((f) => f.label === '매출 추이')
      if (curF?.value !== line) {
        rec = withCustomField(rec, { id: curF?.id, group: curF?.group ?? 'identity', label: '매출 추이', value: line })
        rec = { ...rec, factMeta: { ...(rec.factMeta ?? {}), [`${CUSTOM_FACT_PREFIX}매출 추이`]: { source: 'siteReport', status: 'entered', asOf: String(latest), confirmedAt: '', updatedAt: now } } }
      }
    }
  }
  // D-396 같은 해 부가세 신고서 여러 장이 1~12월을 다 덮으면 그해 매출(과세표준 합계) — 재무제표 · 크레탑 · 신고서 같은 해 이상 값이 있으면 묻지 않는다
  const returns = docs.map((d) => ({ d, r: readVatReturn(d.text) })).filter((x): x is { d: ReadDoc; r: VatReturnRead } => !!x.r)
  const full = returns.length >= 2 ? fullYearFromReturns(returns.map((x) => x.r)) : null
  if (full) {
    const used = returns.filter((x) => Number(x.r.from.slice(0, 4)) === full.year)
    const note = used.some((x) => x.d.method === 'ocr') ? NOTE_OCR : used.some((x) => !x.d.docSure) ? NOTE_DOC_UNSURE : ''
    const ref = `doc:vatReturns:${now}`
    const cand = { key: 'revenue', value: String(full.total), source: 'vatReturn' as const, asOf: String(full.year), ref, ...(note ? { note } : {}) }
    if (!docYields(rec, cand)) {
      rec = withFactCandidates(rec, [cand], now, makeId)
      const p = pendingFacts(rec).find((x) => x.ref === ref && x.key === 'revenue')
      const fileName = `부가세 신고서 ${used.length}장(${full.year}년 1~12월)`
      if (p && !p.note && p.current === '') {
        rec = withFactDecisions(rec, [{ id: p.id, action: 'accept' }], now)
        entered.push({ key: p.key, label: p.label, display: `${full.year}년 ${formatWon(full.total)}`, fileName })
      } else if (p) {
        if (!p.note) rec = { ...rec, factInbox: (rec.factInbox ?? []).map((c) => (c.id === p.id ? { ...c, note: NOTE_CONFLICT } : c)) }
        flagged.push({ key: p.key, label: p.label, display: p.display, fileName, note: p.note ?? NOTE_CONFLICT })
      }
    }
  }
  return { record: rec, entered, flagged }
}
