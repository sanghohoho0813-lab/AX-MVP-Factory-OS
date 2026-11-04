/**
 * D-512 서류 요청 → 회신 대기 → 받으면 줄어든다.
 *
 * 요청 문구(서류 요청 · 받을 자료 · 정책자금 신청 서류)를 고객에게 보내고 [보냈어요] 를 누르면,
 * 업체 기록에 '무엇을 · 언제 부탁했는지' 를 남긴다. 그 뒤 서류함 칸이 채워지면(부탁한 뒤 올린 파일 · 새로 받음)
 * 그 줄은 저절로 '받음' 이 된다. 칸이 없는 것(생년월일 · 금액 · 한 줄 답)은 사람이 [받았어요] 로 체크한다.
 *
 *  - 글만 읽는다 — 세 가지 요청 문구 모두 '1. 이름 …' 줄 + '   - 어디서' 줄이라(D-191 · D-313 · clientOpsMessages) 문구를 다시 만들지 않는다.
 *  - 저장은 업체 기록(payload) 안의 선택 칸 하나(docRequests) — DB 변경 없음. 할 일은 예전처럼 업무 일기(D-314).
 *  - '받음' 판단은 규칙(서류 칸 이름 짝)이다 — AI 아님. 확실하지 않은 줄은 사람이 체크한다. 칸을 지우거나 덮지 않는다.
 */
import type { ClientOpsRecord, DocRequest, DocRequestItem, DocumentKey } from '../types/clientOps'
import { allDocumentMetas } from './clientOpsDocuments'

/**
 * D-532 보관 ≠ 표시. 예전에는 업체마다 요청 기록을 12개만 남기고 넘으면 **끝내지 않은 요청까지** 오래된 것부터 버렸다(읽을 때도 12개로 잘랐다).
 * 이제 끝내지 않은 요청은 몇 개든 버리지 않는다. '끝낸' 요청만 최근 것부터 이만큼 남긴다.
 */
export const DOC_REQUEST_KEEP_CLOSED = 30
/** 저장된 값을 읽을 때 한 번에 보는 줄 수 상한(망가진 값 · 아주 큰 값 막기) — 끝내지 않은 요청은 이 안에서 전부 남는다 */
const DOC_REQUEST_READ_MAX = 500
/** 서류함 맨 위에 펼쳐 보이는 끝내지 않은 요청 수 — 나머지는 [n개 더 보기](표시만 줄인다 · 기록은 그대로) */
export const DOC_REQUEST_SHOWN = 3
/** @deprecated D-532 — 예전 '업체당 12개' 상한. 기록을 버리는 데는 더 쓰지 않는다(이름만 남김) */
export const DOC_REQUEST_LIMIT = DOC_REQUEST_KEEP_CLOSED
/** 한 요청 안의 줄 수 */
const ITEM_LIMIT = 30

/* ------------------------------------------------------------------ */
/* 문구 → 줄                                                            */
/* ------------------------------------------------------------------ */

export interface RequestLine {
  label: string
  where: string
  /** '기존 서류는 유효기간이 지나 새 발급본이 필요합니다' — 이미 받은 칸이라도 새로 올라와야 받음 */
  renew: boolean
}

const ITEM_RE = /^\s*\d+\.\s+(.+?)\s*$/
const WHERE_RE = /^\s+-\s+(.+?)\s*$/

/** 국세 · 지방세 · 4대보험 증명이 한 줄에 묶여 오면 셋으로 — 하나씩 따로 들어오니까 */
function splitTaxClear(label: string): string[] {
  if (!/납세증명|완납증명/.test(label) || !/\s·\s/.test(label)) return [label]
  const out: string[] = []
  if (/국세/.test(label)) out.push('국세 납세증명서')
  if (/지방세/.test(label)) out.push('지방세 납세증명서')
  if (/4대\s*보험|4대사회보험/.test(label)) out.push('4대보험 완납증명서')
  return out.length ? out : [label]
}

/** 요청 문구 → 줄(이름 · 어디서 · 새 발급본인지). 줄이 없으면 [] */
export function requestLinesOf(text: string): RequestLine[] {
  const out: RequestLine[] = []
  const lines = String(text || '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = ITEM_RE.exec(lines[i])
    if (!m) continue
    let raw = m[1]
    const renew = /\(기존 서류는[^)]*\)/.test(raw)
    raw = raw.replace(/\s*\(기존 서류는[^)]*\)\s*$/, '').replace(/\s+—\s.*$/, '').trim()
    if (!raw) continue
    const w = WHERE_RE.exec(lines[i + 1] ?? '')
    const where = w ? w[1] : ''
    for (const label of splitTaxClear(raw)) {
      if (out.some((x) => x.label === label)) continue
      out.push({ label: label.slice(0, 80), where: where.slice(0, 160), renew })
    }
  }
  return out.slice(0, ITEM_LIMIT)
}

/* ------------------------------------------------------------------ */
/* 줄 → 서류함 칸                                                        */
/* ------------------------------------------------------------------ */

/** 부탁한 이름(왼쪽)이 맞으면 → 서류함 칸 이름(오른쪽)이 맞는 칸이 그 서류 */
const PAIRS: [RegExp, RegExp][] = [
  [/사업자\s*등록증/, /사업자\s*등록증/],
  [/법인\s*등기|등기사항\s*전부|법인등기부/, /법인\s*등기|법인등기부|^등기사항\s*전부/],
  [/부동산\s*등기|건물\s*등기/, /부동산\s*등기|건물/],
  [/신분증/, /신분증/],
  [/중소기업\s*확인서/, /중소기업\s*확인서/],
  [/득실/, /득실/],
  [/가입자\s*명부|피보험자/, /가입자\s*명부|피보험자/],
  [/재무제표/, /재무제표/],
  [/과세표준/, /과세표준/],
  [/^국세 납세증명서$/, /^(?:국세\s*)?납세증명서/],
  [/지방세/, /지방세/],
  [/완납증명/, /완납증명/],
  [/주주명부/, /주주명부/],
  [/원천징수\s*영수증/, /원천징수\s*영수증/],
  [/원천징수\s*이행/, /원천징수\s*이행/],
  [/소득금액증명/, /소득금액증명/],
  [/사업장현황/, /사업장현황/],
  [/부가(?:가치)?세\s*신고서/, /부가(?:가치)?세\s*신고서/],
  [/연구소|전담부서/, /연구소|전담부서/],
  [/특허/, /특허/],
  [/보유\s*인증서|인증서\s*사본|벤처|이노비즈|메인비즈|여성기업/, /벤처|이노비즈|메인비즈|여성기업|인증서/],
  [/임대차/, /임대차/],
  [/정관/, /정관/],
  [/퇴직금/, /퇴직금/],
  [/취업규칙/, /취업규칙/],
  [/급여대장/, /급여대장/],
  [/크레탑|기업종합보고서/, /크레탑|기업종합보고서/],
  [/신용점수/, /신용점수/],
  [/통장/, /통장/],
  [/견적서/, /견적/],
  [/거래처\s*계약서|발주서/, /거래처|발주/],
  [/노란우산/, /노란우산/],
  [/수출실적/, /수출/],
]

const compact = (s: string) => s.replace(/\s*\(\d+\)\s*$/, '').replace(/\([^)]*\)/g, '').replace(/[\s·・,]/g, '')

/** 이 줄을 채우는 서류함 칸(지금 업체 기록 기준 — 서류를 올리며 새로 생긴 칸까지) */
export function slotsFor(record: Pick<ClientOpsRecord, 'customDocuments'>, label: string): DocumentKey[] {
  const metas = allDocumentMetas(record)
  const rights = PAIRS.filter(([l]) => l.test(label)).map(([, r]) => r)
  if (rights.length) return metas.filter((m) => rights.some((r) => r.test(m.label))).map((m) => m.key)
  // 짝이 없으면 이름이 같은 칸(띄어쓰기 · 괄호 무시) — '공동인증서 전달' 같은 기본 칸
  const want = compact(label)
  if (want.length < 3) return []
  return metas.filter((m) => compact(m.label) === want).map((m) => m.key)
}

/** 칸에 서류가 들어온 때(ISO) — 올린 때가 없으면 마지막으로 고친 때 */
const stampOf = (state: { uploadedAt?: string; updatedAt: string | null } | undefined): string => state?.uploadedAt || state?.updatedAt || ''

/* ------------------------------------------------------------------ */
/* 기록 만들기 · 상태                                                    */
/* ------------------------------------------------------------------ */

/** [보냈어요] 한 번 → 요청 기록(줄이 없으면 null) */
export function newDocRequest(
  record: Pick<ClientOpsRecord, 'customDocuments' | 'documents'>,
  input: { id: string; title: string; text: string; today: string; nowIso: string; todoId?: string },
): DocRequest | null {
  const lines = requestLinesOf(input.text)
  if (!lines.length) return null
  const items: DocRequestItem[] = lines.map((l) => {
    const keys = slotsFor(record, l.label)
    const had = l.renew || keys.some((k) => record.documents[k]?.received)
    return { label: l.label, where: l.where, ...(had ? { had: true } : {}) }
  })
  return {
    id: input.id,
    sentAt: input.today,
    sentAtIso: input.nowIso,
    title: input.title.slice(0, 60),
    items,
    ...(input.todoId ? { todoId: input.todoId } : {}),
  }
}

export interface ItemView {
  item: DocRequestItem
  /** 받음(서류함 칸이 채워짐 또는 사람이 체크) */
  got: boolean
  /** 받은 날(YYYY-MM-DD) — 칸이면 올린 날, 체크면 체크한 날 */
  gotAt: string
  /** 이 줄을 채우는 서류함 칸 — 없으면 사람이 체크하는 줄 */
  keys: DocumentKey[]
  /** 서류함 칸이 받은 줄로 만들었다(사람 체크가 아니라) */
  byDoc: boolean
}

export function itemView(record: Pick<ClientOpsRecord, 'customDocuments' | 'documents'>, req: DocRequest, item: DocRequestItem): ItemView {
  const keys = slotsFor(record, item.label)
  const hit = keys.find((k) => {
    const st = record.documents[k]
    if (!st?.received) return false
    return !item.had || stampOf(st) >= req.sentAtIso
  })
  if (hit) {
    const at = stampOf(record.documents[hit]).slice(0, 10)
    return { item, got: true, gotAt: at || req.sentAt, keys, byDoc: true }
  }
  if (item.doneAt) return { item, got: true, gotAt: item.doneAt, keys, byDoc: false }
  return { item, got: false, gotAt: '', keys, byDoc: false }
}

export interface RequestProgress {
  req: DocRequest
  items: ItemView[]
  total: number
  got: number
  /** 다 받음 */
  done: boolean
  /** 보낸(다시 보낸) 날부터 오늘까지 */
  waitingDays: number
  pending: ItemView[]
}

const dayDiff = (from: string, to: string): number => {
  const a = Date.parse(`${from}T00:00:00Z`)
  const b = Date.parse(`${to}T00:00:00Z`)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.round((b - a) / 86_400_000)) : 0
}

export function requestProgress(record: Pick<ClientOpsRecord, 'customDocuments' | 'documents'>, req: DocRequest, today: string): RequestProgress {
  const items = req.items.map((it) => itemView(record, req, it))
  const got = items.filter((x) => x.got).length
  return {
    req,
    items,
    total: items.length,
    got,
    done: items.length > 0 && got === items.length,
    waitingDays: dayDiff(req.resentAt ?? req.sentAt, today),
    pending: items.filter((x) => !x.got),
  }
}

/** 끝내지 않은 요청(최근 것 먼저) */
export function openRequests(record: Pick<ClientOpsRecord, 'docRequests'>): DocRequest[] {
  return (record.docRequests ?? []).filter((r) => !r.closedAt)
}

/** 업체 한 곳의 회신 대기 한 줄(고객 관리 카드 · 오늘) — 끝내지 않은 요청이 없으면 null */
export function requestSummary(record: ClientOpsRecord, today: string): { got: number; total: number; waitingDays: number; done: boolean } | null {
  const open = openRequests(record)
  if (!open.length) return null
  const ps = open.map((r) => requestProgress(record, r, today))
  const total = ps.reduce((s, p) => s + p.total, 0)
  const got = ps.reduce((s, p) => s + p.got, 0)
  const waiting = ps.filter((p) => !p.done)
  return { got, total, waitingDays: waiting.length ? Math.max(...waiting.map((p) => p.waitingDays)) : 0, done: waiting.length === 0 }
}

/** 서류함 칸 → 이 칸을 기다리는 요청(아직 안 온 것만) — 칸 알약 '요청함 · N일째' */
export function pendingDocKeys(record: ClientOpsRecord, today: string): Map<DocumentKey, { days: number; renew: boolean }> {
  const out = new Map<DocumentKey, { days: number; renew: boolean }>()
  for (const r of openRequests(record)) {
    const p = requestProgress(record, r, today)
    for (const v of p.pending) {
      for (const k of v.keys) {
        const prev = out.get(k)
        if (!prev || prev.days < p.waitingDays) out.set(k, { days: p.waitingDays, renew: !!v.item.had })
      }
    }
  }
  return out
}

/** 할 일 id → 그 할 일로 기다리는 요청의 진행(오늘 · 일정의 할 일 줄) */
export function todoRequestProgress(clients: readonly ClientOpsRecord[], today: string): Map<string, { got: number; total: number; done: boolean }> {
  const out = new Map<string, { got: number; total: number; done: boolean }>()
  for (const c of clients) {
    for (const r of c.docRequests ?? []) {
      if (!r.todoId || r.closedAt) continue
      const p = requestProgress(c, r, today)
      out.set(r.todoId, { got: p.got, total: p.total, done: p.done })
    }
  }
  return out
}

/* ------------------------------------------------------------------ */
/* 고치기(새 기록을 돌려준다 — 저장은 부르는 쪽)                            */
/* ------------------------------------------------------------------ */

const replace = (record: ClientOpsRecord, id: string, fn: (r: DocRequest) => DocRequest): ClientOpsRecord => ({
  ...record,
  docRequests: (record.docRequests ?? []).map((r) => (r.id === id ? fn(r) : r)),
})

/**
 * D-532 남길 기록 고르기 — 끝내지 않은 요청은 전부, 끝낸 요청은 앞(최근)부터 DOC_REQUEST_KEEP_CLOSED 개. 순서는 그대로.
 */
export function pruneDocRequests(list: readonly DocRequest[]): DocRequest[] {
  let closed = 0
  return list.filter((r) => {
    if (!r.closedAt) return true
    closed += 1
    return closed <= DOC_REQUEST_KEEP_CLOSED
  })
}

/** 끝낸 요청(최근 것 먼저) — 서류함 '지난 요청' 에 읽기만으로 보여 준다 */
export function closedRequests(record: Pick<ClientOpsRecord, 'docRequests'>): DocRequest[] {
  return (record.docRequests ?? []).filter((r) => !!r.closedAt)
}

export function withDocRequest(record: ClientOpsRecord, req: DocRequest): ClientOpsRecord {
  return { ...record, docRequests: pruneDocRequests([req, ...(record.docRequests ?? []).filter((r) => r.id !== req.id)]) }
}

/** 칸이 없는 줄(생년월일 · 금액 …)을 사람이 [받았어요] — 되돌리면 doneAt 을 지운다 */
export function withItemDone(record: ClientOpsRecord, id: string, label: string, today: string | null): ClientOpsRecord {
  return replace(record, id, (r) => ({
    ...r,
    items: r.items.map((it) => {
      if (it.label !== label) return it
      if (today) return { ...it, doneAt: today }
      const { doneAt: _drop, ...rest } = it
      void _drop
      return rest
    }),
  }))
}

export function withRequestClosed(record: ClientOpsRecord, id: string, today: string): ClientOpsRecord {
  return replace(record, id, (r) => ({ ...r, closedAt: today }))
}

export function withRequestResent(record: ClientOpsRecord, id: string, today: string): ClientOpsRecord {
  return replace(record, id, (r) => ({ ...r, resentAt: today }))
}

/** 아직 안 온 것만 다시 부탁하는 문구 — 같은 '1. 이름 / - 어디서' 모양(다시 [보냈어요] 로 이어짐) */
export function resendText(record: Pick<ClientOpsRecord, 'contactName' | 'representativeName' | 'companyName' | 'customDocuments' | 'documents'>, req: DocRequest, today: string): string {
  const pending = requestProgress(record, req, today).pending
  if (!pending.length) return ''
  const who = (record.representativeName || record.contactName || '').trim()
  const name = who ? `${who} 대표님` : '대표님'
  const body = pending.map((v, i) => [`${i + 1}. ${v.item.label}`, v.item.where ? `   - ${v.item.where}` : ''].filter(Boolean).join('\n')).join('\n')
  const md = `${Number(req.sentAt.slice(5, 7))}월 ${Number(req.sentAt.slice(8, 10))}일`
  return [
    `안녕하세요, ${name}.`,
    '',
    `${md}에 부탁드린 자료 중 아래 ${pending.length}가지가 아직 도착하지 않아 다시 부탁드립니다.`,
    '',
    body,
    '',
    '사진이나 PDF로 보내 주셔도 됩니다. 감사합니다.',
  ].join('\n')
}

/* ------------------------------------------------------------------ */
/* 저장된 값 다듬기(clientOpsService.normalizeClientOps)                   */
/* ------------------------------------------------------------------ */

const DAY = /^\d{4}-\d{2}-\d{2}$/
export function normalizeDocRequests(value: unknown): { docRequests?: DocRequest[] } {
  if (!Array.isArray(value)) return {}
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
  const out: DocRequest[] = []
  // D-532 읽을 때는 자르지 않는다(예전: 12개) — 남길지는 pruneDocRequests 가 정한다(끝내지 않은 요청은 전부)
  for (const raw of value.slice(0, DOC_REQUEST_READ_MAX)) {
    if (!raw || typeof raw !== 'object') continue
    const v = raw as Record<string, unknown>
    if (typeof v.id !== 'string' || typeof v.sentAt !== 'string' || !DAY.test(v.sentAt)) continue
    const items: DocRequestItem[] = Array.isArray(v.items)
      ? v.items
          .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && typeof (x as Record<string, unknown>).label === 'string')
          .slice(0, ITEM_LIMIT)
          .map((x) => ({
            label: str(x.label, 80),
            where: str(x.where, 160),
            ...(x.had === true ? { had: true } : {}),
            ...(typeof x.doneAt === 'string' && DAY.test(x.doneAt) ? { doneAt: x.doneAt } : {}),
          }))
          .filter((x) => x.label)
      : []
    if (!items.length) continue
    out.push({
      id: v.id.slice(0, 60),
      sentAt: v.sentAt,
      sentAtIso: str(v.sentAtIso, 40) || `${v.sentAt}T00:00:00.000Z`,
      title: str(v.title, 60),
      items,
      ...(typeof v.todoId === 'string' && v.todoId ? { todoId: v.todoId.slice(0, 80) } : {}),
      ...(typeof v.resentAt === 'string' && DAY.test(v.resentAt) ? { resentAt: v.resentAt } : {}),
      ...(typeof v.closedAt === 'string' && DAY.test(v.closedAt) ? { closedAt: v.closedAt } : {}),
    })
  }
  return out.length ? { docRequests: pruneDocRequests(out) } : {}
}
