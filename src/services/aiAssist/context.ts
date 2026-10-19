/**
 * AI 도우미 — 화면 자료를 AI 에 보낼 '작은 묶음' 으로 만든다(D-239).
 *
 * 지키는 것
 *   - 사람 이름(대표자 · 담당자 · 소개한 사람 · 요청자) · 연락처 · 이메일 · 사업자/법인번호 · 주소(시/도만) · 주민번호 · 계좌는 보내지 않는다.
 *     자유 글(메모 · 할 일)은 주민번호 · 비밀번호 · 키 · 계좌 · 이메일 · 휴대폰을 가리고, 그 업체의 사람 이름은 '(이름)' 으로 바꾼다.
 *   - 줄마다 ref(c1 · t3 …)를 붙인다 — AI 가 고른 줄을 화면이 그 업체 · 그 일로 이어 준다(links 는 브라우저에만 남는다).
 *   - 많아도 화면이 보여 주는 만큼만(업체 80 · 할 일 60 …) — 서버가 4만 자로 한 번 더 자른다.
 */
import { redactSensitive } from '../../domain/consulting/privacyFilter'
import { stripRrn } from '../../tools/employment/lib/privacy'
import type { ClientOpsRecord } from '../../types/clientOps'
import { regionOf } from '../clientOpsProfile'
import { sortedNotes } from '../clientOpsService'
import { isContractClient, salesStageLabelOf } from '../salesPipeline'
import { lastSalesTouch } from '../salesSignals'

export type AssistValue = string | number | boolean | null | undefined | readonly string[]

export interface AssistRow {
  ref?: string
  [key: string]: AssistValue
}

export interface AssistSection {
  name: string
  rows: AssistRow[]
  /** 화면 전체 개수(rows 보다 많으면 '더 있음' 으로 알린다) */
  total?: number
}

export interface AssistContext {
  title: string
  today: string
  purpose?: string
  sections: AssistSection[]
  facts?: string[]
  rules?: string[]
}

/** 보낼 묶음 + 브라우저에만 남는 이동 주소(ref → 화면 주소) */
export interface AssistBundle {
  context: AssistContext
  links: Record<string, string>
  /** D-241 ref → 원래 번호(RefBook.ids) */
  ids?: Record<string, string>
}

/* ------------------------------------------------------------------ */
/* 개인정보 거르기                                                        */
/* ------------------------------------------------------------------ */

/** 자유 글 — 주민번호 · 비밀번호 · 키 · 계좌 · 이메일 · 휴대폰을 가리고, 알려 준 사람 이름을 '(이름)' 으로 */
export function safeText(s: string | null | undefined, names: readonly string[] = [], max = 300): string {
  let out = redactSensitive(stripRrn(String(s ?? ''))).text.replace(/\s+/g, ' ').trim()
  for (const n of names) {
    const name = n.trim()
    if (name.length < 2) continue
    out = out.split(name).join('(이름)')
  }
  return out.length > max ? `${out.slice(0, max)}…` : out
}

/** 이 업체 기록에서 사람 이름으로 쓰이는 칸 */
export function personNames(r: ClientOpsRecord): string[] {
  const names = [r.representativeName, r.contactName, r.sales?.referrer ?? '', r.provisional?.requestedBy ?? '']
  for (const s of r.shareholderRegister ?? []) if (s && typeof s.name === 'string') names.push(s.name)
  return names.filter((n): n is string => typeof n === 'string' && n.trim().length >= 2)
}

/** 날짜 사이 날 수(앞이 지난 날이면 양수) */
export function daysBetween(from: string, to: string): number | null {
  if (!from || !to) return null
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00`)
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00`)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : null
}

/** 원 → '1,234만원' (자료 그대로 — 반올림만) */
export function wonText(won: number | null | undefined): string {
  if (won == null || !Number.isFinite(won) || won === 0) return ''
  if (Math.abs(won) >= 10_000) return `${Math.round(won / 10_000).toLocaleString('ko-KR')}만원`
  return `${Math.round(won).toLocaleString('ko-KR')}원`
}

/* ------------------------------------------------------------------ */
/* ref 붙이기                                                             */
/* ------------------------------------------------------------------ */

/**
 * D-241 모델이 돌려준 ref 를 자료의 ref 모양으로 — ' C3 ', '[c3]', '#c3', 'c-3' 도 c3.
 * 모양이 아니면 '' (없는 번호를 만들어 오면 이어 주지 않는다).
 */
export function normRef(ref: unknown): string {
  if (typeof ref !== 'string') return ''
  const t = ref.trim().toLowerCase().replace(/^[[(#\s]+|[\])\s.,]+$/g, '').replace(/^([a-z]{1,3})[-_\s]+(\d)/, '$1$2')
  return /^[a-z]{1,3}\d{1,4}$/.test(t) ? t : ''
}

export class RefBook {
  private n = new Map<string, number>()
  private byKey = new Map<string, string>()
  readonly links: Record<string, string> = {}
  /** D-241 ref → 원래 번호(업체 번호 · 후보 키 · 콘텐츠 번호) — 답의 [할 일로 넣기 · 담기] 가 무엇을 가리키는지 */
  readonly ids: Record<string, string> = {}
  /** 같은 key 는 같은 ref(한 업체가 여러 줄에 나와도 c3 하나) */
  ref(prefix: string, key: string, href?: string): string {
    const k = `${prefix}:${key}`
    const hit = this.byKey.get(k)
    if (hit) return hit
    const next = (this.n.get(prefix) ?? 0) + 1
    this.n.set(prefix, next)
    const ref = `${prefix}${next}`
    this.byKey.set(k, ref)
    this.ids[ref] = key
    if (href) this.links[ref] = href
    return ref
  }
  client(r: Pick<ClientOpsRecord, 'id'>): string {
    return this.ref('c', r.id, `/ops/clients/${encodeURIComponent(r.id)}`)
  }
}

/* ------------------------------------------------------------------ */
/* 업체 한 줄(여러 화면이 같이 쓴다)                                            */
/* ------------------------------------------------------------------ */

export interface ClientRowOpts {
  today: string
  /** 메모 몇 개까지(최신부터) */
  notes?: number
  extra?: (r: ClientOpsRecord) => Record<string, AssistValue>
}

export function clientRow(book: RefBook, r: ClientOpsRecord, o: ClientRowOpts): AssistRow {
  const names = personNames(r)
  const touch = lastSalesTouch(r)
  const quiet = touch ? daysBetween(touch, o.today) : null
  const notes = sortedNotes(r)
    .slice(0, o.notes ?? 2)
    .map((n) => `${n.createdAt.slice(0, 10)} ${safeText(n.text, names, 220)}`)
  const meetings = (r.sales?.meetings ?? []).slice(0, 2).map((m) => `${m.at.slice(0, 10)} ${m.round}차: ${safeText(m.text, names, 200)}`)
  const row: AssistRow = {
    ref: book.client(r),
    업체: r.companyName,
    구분: isContractClient(r) ? '계약 고객' : '잠재고객',
    단계: salesStageLabelOf(r),
    업종: safeText(r.industry || r.businessCategory, [], 40),
    지역: regionOf(r.businessAddress),
    직원: safeText(r.employeeCount, [], 20),
    마지막연락: touch ? `${touch.slice(0, 10)}${quiet !== null ? ` (${quiet}일 전)` : ''}` : '기록 없음',
    다음약속: r.nextAction ? `${safeText(r.nextAction, names, 120)}${r.nextActionDueDate ? ` · ${r.nextActionDueDate}` : ''}` : '',
    관심: (r.sales?.interests ?? []).slice(0, 6),
    고민: safeText(r.sales?.concern, names, 160),
    예상수수료: wonText(r.sales?.expectedFee ?? null),
    메모: [...meetings, ...notes, r.sales?.memo ? safeText(r.sales.memo, names, 200) : '', r.notes ? safeText(r.notes, names, 200) : ''].filter(Boolean).slice(0, 4),
  }
  if (o.extra) Object.assign(row, o.extra(r))
  return row
}
