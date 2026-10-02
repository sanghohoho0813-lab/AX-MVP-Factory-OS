/**
 * 고객 사실 창고 (D-128) — One Client → One Fact Base → Many Modules.
 *
 * 고객 자료와 회사 정보는 **한 번** 넣고, 모든 전문 모듈이 같은 값을 다시 쓴다.
 *
 * 저장은 따로 만들지 않는다. 업체 기록(ClientOpsRecord)이 곧 사실 창고다.
 *  - 업체 칸이 이미 있는 사실(회사명 · 사업자등록번호 · 설립일 · 직원 수 …)은 그 칸이 유일한 자리다.
 *  - 칸이 없는 사실(매출 · 영업이익 · 자산 · 부채 · 인증 · 특허 …)은 `factValues` 가 유일한 자리다.
 *  - 출처 · 상태 · 확인일은 `factMeta` 에(값은 복제하지 않는다).
 *  - 자료에서 읽었지만 아직 확인하지 않은 값은 `factInbox`(또는 붙어 있는 크레탑 결과)에서 **후보** 로만 나온다.
 *    후보는 어떤 모듈도 쓰지 않는다 — 대표가 '맞음' 을 눌러야 사실이 된다(OCR 결과를 저절로 확정하지 않는다).
 *
 * 이 파일은 계산만 한다(저장 · 화면 없음). 전문 모듈과 요금제에 매이지 않는 기본 OS 의 고객 자산이다 —
 * 모듈을 새로 사도 이미 있는 사실을 바로 쓴다.
 */

import type { ClientOpsRecord, FactCandidate, FactMeta, FactSource, FactStatus, ProfileGroupKey } from '../types/clientOps'
import { withCustomField } from './clientOpsService'
import { parseKoreanDate } from './koreanDocParser'

/* ------------------------------------------------------------------ */
/* 사실 목록                                                             */
/* ------------------------------------------------------------------ */

export type FactKind = 'text' | 'date' | 'count' | 'won'
export type FactGroup = 'company' | 'finance' | 'growth'

/** 업체 칸이 있는 사실 — 그 칸 이름 */
type HomeField =
  | 'companyName'
  | 'businessNumber'
  | 'corporateNumber'
  | 'representativeName'
  | 'representativeBirth'
  | 'establishedAt'
  | 'businessAddress'
  | 'businessCategory'
  | 'businessItem'
  | 'employeeCount'

export interface FactDef {
  key: string
  label: string
  group: FactGroup
  kind: FactKind
  /** 업체 칸이 있으면 그 칸, 없으면 factValues */
  field?: HomeField
  /** 신청 · 제출 · 출원처럼 정확해야 하는 단계에서 확인을 받는 사실 */
  hard?: boolean
  /** 적을 때 기본 상태 — 예상 매출은 처음부터 예상값 */
  defaultStatus?: FactStatus
}

/**
 * 공통 사실 — 모든 모듈이 여기서 읽는다. 새 모듈이 새 사실을 원하면 여기 한 줄.
 * (거대한 스키마를 만들지 않는다 — 여러 모듈이 실제로 묻는 것만)
 */
export const FACT_DEFS: FactDef[] = [
  { key: 'companyName', label: '회사명', group: 'company', kind: 'text', field: 'companyName', hard: true },
  { key: 'businessNumber', label: '사업자등록번호', group: 'company', kind: 'text', field: 'businessNumber', hard: true },
  { key: 'corporateNumber', label: '법인등록번호', group: 'company', kind: 'text', field: 'corporateNumber', hard: true },
  { key: 'representativeName', label: '대표자', group: 'company', kind: 'text', field: 'representativeName', hard: true },
  { key: 'representativeBirth', label: '대표 생년월일', group: 'company', kind: 'date', field: 'representativeBirth' },
  { key: 'establishedAt', label: '설립일', group: 'company', kind: 'date', field: 'establishedAt', hard: true },
  { key: 'businessAddress', label: '주소', group: 'company', kind: 'text', field: 'businessAddress', hard: true },
  { key: 'businessCategory', label: '업태', group: 'company', kind: 'text', field: 'businessCategory' },
  { key: 'businessItem', label: '종목', group: 'company', kind: 'text', field: 'businessItem' },
  { key: 'employeeCount', label: '직원 수', group: 'company', kind: 'count', field: 'employeeCount', hard: true },
  { key: 'revenue', label: '매출', group: 'finance', kind: 'won', hard: true },
  { key: 'operatingProfit', label: '영업이익', group: 'finance', kind: 'won' },
  { key: 'netIncome', label: '순이익', group: 'finance', kind: 'won' },
  { key: 'totalAssets', label: '자산', group: 'finance', kind: 'won' },
  { key: 'totalLiabilities', label: '부채', group: 'finance', kind: 'won' },
  { key: 'expectedRevenue', label: '올해 예상 매출', group: 'finance', kind: 'won', defaultStatus: 'estimated' },
  { key: 'mainCustomers', label: '주요 거래처', group: 'growth', kind: 'text' },
  { key: 'certifications', label: '보유 인증', group: 'growth', kind: 'text' },
  { key: 'patents', label: '특허', group: 'growth', kind: 'text' },
  { key: 'researchLab', label: '연구소', group: 'growth', kind: 'text' },
]

export function factDef(key: string): FactDef | undefined {
  return FACT_DEFS.find((d) => d.key === key)
}

export const FACT_SOURCE_LABEL: Record<FactSource, string> = {
  manual: '직접 적음',
  businessRegistration: '사업자등록증',
  corporateRegistry: '법인등기부등본',
  cretop: '크레탑 보고서',
  financialStatements: '재무제표',
  payrollRoster: '4대보험 명부',
  meeting: '상담 메모',
  certificate: '인증서 · 확인서',
}

export const FACT_STATUS_LABEL: Record<FactStatus, string> = {
  confirmed: '확인됨',
  entered: '적어 둠',
  estimated: '예상값',
}

/* ------------------------------------------------------------------ */
/* 값 모양                                                               */
/* ------------------------------------------------------------------ */

/** 원 단위 숫자 (없거나 숫자가 아니면 null) */
export function wonOf(value: string): number | null {
  const n = Number(String(value).replace(/[,\s원]/g, ''))
  return Number.isFinite(n) && String(value).trim() !== '' ? n : null
}

/** 12억 3,400만원 · 8,000만원 · -2억원 */
export function formatWon(won: number): string {
  const sign = won < 0 ? '-' : ''
  const a = Math.abs(Math.round(won))
  const eok = Math.floor(a / 1e8)
  const man = Math.round((a % 1e8) / 1e4)
  if (eok > 0 && man > 0) return `${sign}${eok.toLocaleString('ko-KR')}억 ${man.toLocaleString('ko-KR')}만원`
  if (eok > 0) return `${sign}${eok.toLocaleString('ko-KR')}억원`
  if (man > 0) return `${sign}${man.toLocaleString('ko-KR')}만원`
  return `${sign}${a.toLocaleString('ko-KR')}원`
}

/** 화면에 보일 값 */
export function displayFact(def: FactDef | undefined, value: string): string {
  if (!value) return ''
  if (def?.kind === 'won') {
    const w = wonOf(value)
    return w === null ? value : formatWon(w)
  }
  if (def?.kind === 'count' && /^\d+$/.test(value.trim())) return `${value.trim()}명`
  return value
}

/** 같은 값인가 — 띄어쓰기 · 하이픈 · 단위를 빼고 본다 */
export function sameFactValue(def: FactDef | undefined, a: string, b: string): boolean {
  if (def?.kind === 'won') return wonOf(a) !== null && wonOf(a) === wonOf(b)
  // 직원 수는 첫 숫자로 — '12명(대표 포함)' 과 '12' 는 같다
  if (def?.kind === 'count') {
    const n = (v: string) => /(\d[\d,]*)/.exec(v)?.[1]?.replace(/,/g, '') ?? ''
    return n(a) !== '' && n(a) === n(b)
  }
  // 회사명은 (주) · 주식회사 · ㈜ 위치가 달라도 같다
  const norm = (v: string) => v.replace(/주식회사|\(주\)|㈜/g, '').replace(/[\s\-·,.()명]/g, '').toLowerCase()
  return norm(a) === norm(b) && norm(a) !== ''
}

/* ------------------------------------------------------------------ */
/* 읽기                                                                  */
/* ------------------------------------------------------------------ */

export interface Fact {
  key: string
  label: string
  group: FactGroup
  /** 저장된 값 그대로 (없으면 '') */
  value: string
  /** 화면에 보일 값 */
  display: string
  /** 값이 없으면 'missing' */
  status: FactStatus | 'missing'
  source: FactSource | null
  /** "크레탑 보고서 2025 · 확인됨" */
  sourceLabel: string
  asOf: string
  confirmedAt: string
  updatedAt: string
  hard: boolean
}

function rawValue(record: ClientOpsRecord, def: FactDef): string {
  if (def.field) return (record[def.field] ?? '').trim()
  return (record.factValues?.[def.key] ?? '').trim()
}

export function readFact(record: ClientOpsRecord, key: string): Fact | null {
  const def = factDef(key)
  if (!def) return null
  const value = rawValue(record, def)
  const meta: FactMeta | undefined = record.factMeta?.[key]
  // 예전 기록(출처가 없는 값)은 대표가 적은 값으로 본다 — 쓰지만 '확인됨' 으로 올리지는 않는다
  const status: Fact['status'] = !value ? 'missing' : (meta?.status ?? 'entered')
  const source: FactSource | null = !value ? null : (meta?.source ?? 'manual')
  const sourceLabel = !value
    ? ''
    : [FACT_SOURCE_LABEL[source as FactSource] + (meta?.asOf ? ` ${meta.asOf}` : ''), FACT_STATUS_LABEL[status as FactStatus]].join(' · ')
  return {
    key,
    label: def.label,
    group: def.group,
    value,
    display: displayFact(def, value),
    status,
    source,
    sourceLabel,
    asOf: meta?.asOf ?? '',
    confirmedAt: meta?.confirmedAt ?? '',
    updatedAt: meta?.updatedAt ?? '',
    hard: Boolean(def.hard),
  }
}

export function readFacts(record: ClientOpsRecord): Fact[] {
  return FACT_DEFS.map((d) => readFact(record, d.key) as Fact)
}

/** 모듈이 써도 되는 값 — 확인됨 · 적어 둠 · 예상값(예상은 표시해서). 후보는 절대 아님 */
export function usableFactValue(record: ClientOpsRecord, key: string): string {
  const f = readFact(record, key)
  return f && f.status !== 'missing' ? f.value : ''
}

/** 신청 · 제출 전에 확인을 받아야 할 것 — 값이 없거나 아직 '확인됨' 이 아닌 꼭 필요한 사실 */
export function hardFactsToConfirm(record: ClientOpsRecord, keys?: string[]): Fact[] {
  return readFacts(record).filter((f) => f.hard && (!keys || keys.includes(f.key)) && f.status !== 'confirmed')
}

/* ------------------------------------------------------------------ */
/* 자료 → 후보                                                           */
/* ------------------------------------------------------------------ */

export interface PendingFact {
  /** 후보의 이름 — 받는 쪽이 고르거나 뺄 때 */
  id: string
  key: string
  label: string
  value: string
  display: string
  source: FactSource
  /** "크레탑 보고서 2025" */
  sourceLabel: string
  asOf: string
  ref: string
  /** 지금 적혀 있는 값(다르면 보여 준다) */
  current: string
  /** 받아 둔 후보(factInbox) 인가, 붙어 있는 크레탑 결과에서 읽은 것인가 */
  from: 'inbox' | 'cretop'
  /** D-129: 회사 기본 정보의 직접 만든 칸으로 가면 그 묶음(인증서 …) */
  customGroup?: ProfileGroupKey
  /** D-144: 확인을 묻는 까닭(사진 글자 · 지금 값과 다름 …) */
  note?: string
}

/** D-129: 'cf:<칸 이름>' — 직접 만든 칸으로 가는 후보 */
export const CUSTOM_FACT_PREFIX = 'cf:'
export function isCustomFactKey(key: string): boolean {
  return key.startsWith(CUSTOM_FACT_PREFIX)
}
function customFieldOf(record: ClientOpsRecord, label: string) {
  const norm = (v: string) => v.replace(/\s/g, '')
  return record.customFields.find((f) => norm(f.label) === norm(label))
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** 크레탑 원문 단위 → 원 배수 */
const CRETOP_UNIT_WON: Record<string, number> = { 원: 1, 천원: 1e3, 천: 1e3, 만원: 1e4, 만: 1e4, 백만원: 1e6, 백만: 1e6, 억원: 1e8, 억: 1e8 }

/**
 * 크레탑 금액 한 칸 → 원.
 * D-136: ① 원문 값 × 원문 단위로 정확히(예전에는 억 단위로 반올림한 값 × 1억 — 6,703,634천원이 67.04억 = 6,704,000,000원이 됐다).
 *        ② 엔진이 '확인 필요'로 표시한 칸(최신 연도 빈칸 · 단위 모름 · 값/연도 짝 모름 · 표끼리 다름 · 현실 범위 밖)은 사실 후보로 만들지 않는다.
 *        ③ 연도를 모르는 값도 만들지 않는다 — 어느 해 숫자인지 모르는 것을 '최신' 으로 올리지 않는다.
 */
function cretopWon(cell: unknown): { won: number; year: string } | null {
  if (!cell || typeof cell !== 'object') return null
  const c = cell as { value?: unknown; unit?: unknown; eok?: unknown; year?: unknown; absent?: unknown; needsCheck?: unknown; latestMissing?: unknown }
  if (c.absent || c.needsCheck === true || c.latestMissing === true) return null
  const year = c.year === null || c.year === undefined ? '' : String(c.year)
  if (!/^(19|20)\d{2}$/.test(year)) return null
  const v = num(c.value)
  const unit = typeof c.unit === 'string' ? c.unit.trim() : ''
  const mult = CRETOP_UNIT_WON[unit]
  let won: number | null = v !== null && mult !== undefined ? v * mult : null
  if (won === null) {
    // 예전 결과(단위 없이 억만 남은 것) — 억 값 그대로
    const eok = num(c.eok)
    if (eok === null) return null
    won = eok * 1e8
  }
  return { won: Math.round(won), year }
}

/** 붙어 있는 가장 최근 크레탑 결과에서 읽을 수 있는 사실들 */
export function cretopFacts(record: ClientOpsRecord): { key: string; value: string; asOf: string; ref: string }[] {
  const r = record.toolResults.find((t) => t.toolKey === 'cretop')
  if (!r || !r.data || typeof r.data !== 'object') return []
  const d = r.data as { companyInfo?: Record<string, unknown>; corePreview?: Record<string, unknown> }
  const ref = `cretop:${r.id}`
  const out: { key: string; value: string; asOf: string; ref: string }[] = []
  const ci = d.companyInfo ?? {}
  const text = (k: string) => (typeof ci[k] === 'string' ? (ci[k] as string).trim() : '')
  const push = (key: string, value: string, asOf = '') => {
    if (value) out.push({ key, value, asOf, ref })
  }
  push('companyName', text('companyName'))
  push('businessNumber', text('businessNo'))
  push('corporateNumber', text('corpRegNo'))
  push('representativeName', text('ceoName'))
  push('establishedAt', parseKoreanDate(text('established')) ?? '')
  push('businessAddress', text('address'))
  const emp = /(\d[\d,]*)/.exec(text('employees'))?.[1]?.replace(/,/g, '') ?? ''
  push('employeeCount', emp)
  const cp = d.corePreview ?? {}
  for (const key of ['revenue', 'operatingProfit', 'netIncome', 'totalAssets', 'totalLiabilities']) {
    const w = cretopWon(cp[key])
    if (w) push(key, String(w.won), w.year)
  }
  return out
}

/**
 * 확인을 기다리는 것 — 받아 둔 후보 + 붙어 있는 크레탑 결과에서 읽은 것.
 * 지금 값과 같거나, 예전에 '틀림' 으로 뺀 자료면 다시 묻지 않는다.
 */
export function pendingFacts(record: ClientOpsRecord): PendingFact[] {
  const out: PendingFact[] = []
  const seen = new Set<string>()
  const consider = (c: { id: string; key: string; value: string; source: FactSource; asOf: string; ref: string; label?: string; group?: ProfileGroupKey; note?: string }, from: PendingFact['from']) => {
    if (!c.value.trim()) return
    if (isCustomFactKey(c.key)) {
      // 직접 만든 칸으로 가는 후보 — 같은 이름의 칸에 같은 값이면 묻지 않는다(같은 인증서를 또 올려도 칸이 늘지 않는다)
      const label = c.label ?? c.key.slice(CUSTOM_FACT_PREFIX.length)
      const cur = customFieldOf(record, label)?.value ?? ''
      if (cur && sameFactValue(undefined, cur, c.value)) return
      if (record.factMeta?.[c.key]?.dismissed?.includes(c.ref)) return
      if (seen.has(c.key)) return
      seen.add(c.key)
      out.push({ id: c.id, key: c.key, label, value: c.value, display: c.value, source: c.source, sourceLabel: FACT_SOURCE_LABEL[c.source] + (c.asOf ? ` ${c.asOf}` : ''), asOf: c.asOf, ref: c.ref, current: cur, from, customGroup: c.group ?? 'credential', ...(c.note ? { note: c.note } : {}) })
      return
    }
    const def = factDef(c.key)
    if (!def) return
    const cur = rawValue(record, def)
    if (cur && sameFactValue(def, cur, c.value)) return
    if (record.factMeta?.[c.key]?.dismissed?.includes(c.ref)) return
    // 같은 사실을 두 자료가 말하면 먼저 받아 둔 것 하나만 묻는다
    if (seen.has(c.key)) return
    seen.add(c.key)
    out.push({
      id: c.id,
      key: c.key,
      label: def.label,
      value: c.value,
      display: displayFact(def, c.value),
      source: c.source,
      sourceLabel: FACT_SOURCE_LABEL[c.source] + (c.asOf ? ` ${c.asOf}` : ''),
      asOf: c.asOf,
      ref: c.ref,
      current: cur ? displayFact(def, cur) : '',
      from,
      ...(c.note ? { note: c.note } : {}),
    })
  }
  for (const c of record.factInbox ?? []) consider(c, 'inbox')
  for (const c of cretopFacts(record)) consider({ id: `${c.ref}:${c.key}`, source: 'cretop', ...c }, 'cretop')
  return [...FACT_DEFS.flatMap((d) => out.filter((p) => p.key === d.key)), ...out.filter((p) => isCustomFactKey(p.key))]
}

/* ------------------------------------------------------------------ */
/* 쓰기 (새 기록을 돌려준다 — 저장은 부르는 쪽)                            */
/* ------------------------------------------------------------------ */

function writeValue(record: ClientOpsRecord, def: FactDef, value: string): ClientOpsRecord {
  if (def.field) return { ...record, [def.field]: value }
  const factValues = { ...(record.factValues ?? {}) }
  if (value.trim() === '') delete factValues[def.key]
  else factValues[def.key] = value
  return { ...record, factValues }
}

/** 대표가 칸을 적거나 고쳤을 때 — 값 + 출처(직접 적음) */
export function withFactValue(
  record: ClientOpsRecord,
  key: string,
  value: string,
  opts: { source?: FactSource; status?: FactStatus; asOf?: string; now: string },
): ClientOpsRecord {
  const def = factDef(key)
  if (!def) return record
  const next = writeValue(record, def, value.trim())
  const factMeta = { ...(next.factMeta ?? {}) }
  if (value.trim() === '') {
    delete factMeta[key]
  } else {
    const status = opts.status ?? def.defaultStatus ?? 'entered'
    factMeta[key] = {
      source: opts.source ?? 'manual',
      status,
      asOf: opts.asOf ?? '',
      confirmedAt: status === 'confirmed' ? opts.now : '',
      updatedAt: opts.now,
      ...(record.factMeta?.[key]?.dismissed ? { dismissed: record.factMeta[key].dismissed } : {}),
    }
  }
  return { ...next, factMeta }
}

/** 적어 둔 값을 '확인됨' 으로 — 값은 그대로 */
export function withFactConfirmed(record: ClientOpsRecord, key: string, now: string): ClientOpsRecord {
  const f = readFact(record, key)
  if (!f || f.status === 'missing') return record
  const prev = record.factMeta?.[key]
  return {
    ...record,
    factMeta: { ...(record.factMeta ?? {}), [key]: { source: prev?.source ?? 'manual', status: 'confirmed', asOf: prev?.asOf ?? '', confirmedAt: now, updatedAt: now, ...(prev?.dismissed ? { dismissed: prev.dismissed } : {}) } },
  }
}

/** 자료에서 찾은 값 받아 두기 — 확정하지 않는다(확인 필요로만) */
export function withFactCandidates(record: ClientOpsRecord, found: Omit<FactCandidate, 'id' | 'foundAt'>[], now: string, makeId: () => string): ClientOpsRecord {
  const keep = (record.factInbox ?? []).filter((c) => !found.some((f) => f.key === c.key))
  const fresh = found.filter((f) => (factDef(f.key) || isCustomFactKey(f.key)) && f.value.trim() !== '').map((f) => ({ ...f, id: makeId(), foundAt: now }))
  return { ...record, factInbox: [...fresh, ...keep] }
}

export interface FactDecision {
  /** PendingFact.id */
  id: string
  /** 'accept' 그대로 맞음 · 'fix' 고친 값으로 · 'reject' 틀림(다시 묻지 않음) */
  action: 'accept' | 'fix' | 'reject'
  /** fix 일 때 고친 값 */
  value?: string
}

/**
 * 확인 필요 → 사실. 맞음은 그 자료를 출처로 '확인됨', 고친 값은 대표가 확인한 값(직접 적음 · 확인됨),
 * 틀림은 그 자료를 다시 묻지 않는다. 결정하지 않은 후보는 그대로 남는다(나중에 확인).
 */
export function withFactDecisions(record: ClientOpsRecord, decisions: FactDecision[], now: string): ClientOpsRecord {
  const pending = pendingFacts(record)
  let next = record
  const doneInbox = new Set<string>()
  for (const d of decisions) {
    const p = pending.find((x) => x.id === d.id)
    if (!p) continue
    if (p.from === 'inbox') doneInbox.add(p.id)
    const dismiss = (r: ClientOpsRecord) => {
      const meta = r.factMeta?.[p.key]
      const dismissed = [...new Set([...(meta?.dismissed ?? []), p.ref])]
      return { ...r, factMeta: { ...(r.factMeta ?? {}), [p.key]: meta ? { ...meta, dismissed } : { source: 'manual' as const, status: 'entered' as const, asOf: '', confirmedAt: '', updatedAt: now, dismissed } } }
    }
    if (d.action === 'reject') {
      // 값이 없던 사실이면 빈 메타만 남는다 — 읽을 때 값이 없으므로 '없음' 이다
      next = dismiss(next)
      continue
    }
    if (isCustomFactKey(p.key)) {
      // 회사 기본 정보의 칸 — 같은 이름이 있으면 고치고, 없으면 만든다
      const value = d.action === 'fix' ? (d.value ?? '').trim() : p.value
      if (!value) continue
      const cur = customFieldOf(next, p.label)
      next = withCustomField(next, { id: cur?.id, group: cur?.group ?? p.customGroup ?? 'credential', label: cur?.label ?? p.label, value })
      next = { ...next, factMeta: { ...(next.factMeta ?? {}), [p.key]: { source: d.action === 'fix' ? 'manual' : p.source, status: 'confirmed', asOf: p.asOf, confirmedAt: now, updatedAt: now, dismissed: [...new Set([...(next.factMeta?.[p.key]?.dismissed ?? []), p.ref])] } } }
      continue
    }
    if (d.action === 'fix') {
      next = withFactValue(next, p.key, d.value ?? '', { source: 'manual', status: 'confirmed', now })
      next = dismiss(next)
      continue
    }
    next = withFactValue(next, p.key, p.value, { source: p.source, status: 'confirmed', asOf: p.asOf, now })
  }
  if (doneInbox.size > 0) next = { ...next, factInbox: (next.factInbox ?? []).filter((c) => !doneInbox.has(c.id)) }
  return next
}

/* ------------------------------------------------------------------ */
/* 사람이 적은 글 → 저장할 값                                             */
/* ------------------------------------------------------------------ */

/**
 * "12억 5,000만" · "12.5억" · "8000만원" · "1,250,000,000" · "-3억" → 원 (못 읽으면 null).
 * 짐작하지 않는다 — 숫자가 아닌 글이 섞이면 null.
 */
export function parseWonInput(text: string): number | null {
  const t = text.replace(/[\s,원]/g, '')
  if (!t) return null
  const m = /^(-?)(?:(\d+(?:\.\d+)?)억)?(?:(\d+(?:\.\d+)?)천만)?(?:(\d+(?:\.\d+)?)만)?(\d+)?$/.exec(t)
  if (!m) return null
  const [, sign, eok, cheonman, man, rest] = m
  if (!eok && !cheonman && !man && !rest) return null
  const won = (Number(eok ?? 0) * 1e8) + (Number(cheonman ?? 0) * 1e7) + (Number(man ?? 0) * 1e4) + Number(rest ?? 0)
  return Math.round(sign ? -won : won)
}

/** 사람이 적은 값 → 저장할 값. 못 읽으면 null(저장하지 않고 다시 묻는다) */
export function normalizeFactInput(key: string, text: string): string | null {
  const def = factDef(key)
  const t = text.trim()
  if (!def || !t) return t === '' ? '' : null
  if (def.kind === 'won') {
    const w = parseWonInput(t)
    return w === null ? null : String(w)
  }
  if (def.kind === 'date') return parseKoreanDate(t) ?? (/^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null)
  return t
}

/** 업체 화면에서 칸 하나를 고쳤을 때 — 사실이면 출처(직접 적음)도 함께, 아니면 값만 */
export function withProfileFieldEdit(record: ClientOpsRecord, key: string, value: string, now: string): ClientOpsRecord {
  if (factDef(key)?.field) return withFactValue(record, key, value, { source: 'manual', now })
  return { ...record, [key]: value }
}

/** 업체 화면에서 보여 줄 출처 한 줄 — 직접 적은 평범한 값은 조용히(없음) */
export function factNoteFor(record: ClientOpsRecord, key: string): { text: string; confirmed: boolean } | null {
  const f = readFact(record, key)
  if (!f || f.status === 'missing') return null
  if (f.source === 'manual' && f.status === 'entered') return null
  return { text: f.sourceLabel, confirmed: f.status === 'confirmed' }
}
