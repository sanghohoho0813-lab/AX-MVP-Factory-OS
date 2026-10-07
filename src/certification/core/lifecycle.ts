/**
 * 인증 진행 기록 (P1) — 준비 중 → 신청 → 심사 · 평가 → 보완 → 인증 완료 → 갱신 준비.
 * Core 는 상태 · 날짜 규칙만 안다(저장 위치는 integration). 날짜는 사람이 적은 것만 쓴다 — 만들지 않는다.
 */
import type { CertificationKey } from './types'

export type CertStatus = 'preparing' | 'applied' | 'review' | 'supplement' | 'certified' | 'renewal'

export const CERT_STATUS_ORDER: CertStatus[] = ['preparing', 'applied', 'review', 'supplement', 'certified', 'renewal']

export const CERT_STATUS_LABEL: Record<CertStatus, string> = {
  preparing: '준비 중',
  applied: '신청',
  review: '심사 · 평가',
  supplement: '보완',
  certified: '인증 완료',
  renewal: '갱신 준비',
}

export interface CertLifecycle {
  cert: CertificationKey
  status: CertStatus
  /** 인증(확인)서 번호 — 모르면 '' */
  number: string
  /** 인증(확인)일 'YYYY-MM-DD' — 모르면 '' */
  certifiedAt: string
  /** 유효기간 끝 'YYYY-MM-DD' — 모르면 '' (만들지 않는다) */
  validUntil: string
  /** 사후 점검 · 사후심사 예정일 — 모르면 '' */
  postAuditAt: string
  memo: string
  /** 상태가 바뀐 기록(최신이 끝) */
  history: { at: string; status: CertStatus }[]
  updatedAt: string
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const isStatus = (v: unknown): v is CertStatus => typeof v === 'string' && (CERT_STATUS_ORDER as string[]).includes(v)
const date = (v: unknown) => (typeof v === 'string' && DATE.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) ? v : '')

export function emptyLifecycle(cert: CertificationKey): CertLifecycle {
  return { cert, status: 'preparing', number: '', certifiedAt: '', validUntil: '', postAuditAt: '', memo: '', history: [], updatedAt: '' }
}

export function normalizeLifecycle(raw: unknown, cert: CertificationKey): CertLifecycle {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const history = Array.isArray(r.history)
    ? r.history.filter((h): h is { at: string; status: CertStatus } => !!h && typeof h === 'object' && typeof (h as { at?: unknown }).at === 'string' && isStatus((h as { status?: unknown }).status)).slice(-30)
    : []
  return {
    cert,
    status: isStatus(r.status) ? r.status : 'preparing',
    number: typeof r.number === 'string' ? r.number.trim().slice(0, 60) : '',
    certifiedAt: date(r.certifiedAt),
    validUntil: date(r.validUntil),
    postAuditAt: date(r.postAuditAt),
    memo: typeof r.memo === 'string' ? r.memo.slice(0, 2000) : '',
    history,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : '',
  }
}

/** 상태 바꾸기 — 같은 상태면 그대로 */
export function withCertStatus(l: CertLifecycle, status: CertStatus, at: string): CertLifecycle {
  if (l.status === status) return l
  return { ...l, status, history: [...l.history, { at, status }].slice(-30), updatedAt: at }
}

export interface CompletionInput {
  number: string
  certifiedAt: string
  validUntil: string
}

/** 인증 완료 기록 — 번호 · 인증일 · 유효기간만. 적지 않은 날짜는 비워 둔다 */
export function withCompletion(l: CertLifecycle, input: CompletionInput, at: string): CertLifecycle {
  const next = withCertStatus(l, 'certified', at)
  return { ...next, number: input.number.trim().slice(0, 60), certifiedAt: date(input.certifiedAt), validUntil: date(input.validUntil), updatedAt: at }
}

export type CompletionProblem = 'certified_missing' | 'valid_before_certified' | 'certified_in_future'

/** 사람이 적은 날짜가 말이 되는지 — 고치라고만 하고 대신 정하지 않는다 */
export function completionProblems(input: CompletionInput, today: string, needsValidity: boolean): CompletionProblem[] {
  const out: CompletionProblem[] = []
  const ca = date(input.certifiedAt)
  const vu = date(input.validUntil)
  if (!ca) out.push('certified_missing')
  if (ca && ca > today) out.push('certified_in_future')
  if (needsValidity && ca && vu && vu <= ca) out.push('valid_before_certified')
  return out
}

export const COMPLETION_PROBLEM_LABEL: Record<CompletionProblem, string> = {
  certified_missing: '인증(확인)일을 적어 주세요',
  valid_before_certified: '유효기간 끝이 인증일보다 앞입니다 — 확인서를 다시 봐 주세요',
  certified_in_future: '인증일이 오늘보다 뒤입니다 — 확인서를 다시 봐 주세요',
}

/**
 * '인증일 + 공식 유효기간' 으로 끝 날짜 계산 — 화면에서 사람이 눌렀을 때만 칸에 채운다(저장 전 확인서와 대조).
 * 예: 2026-03-15 · 3년 → 2029-03-14
 */
export function validUntilByYears(certifiedAt: string, years: number): string {
  const d = date(certifiedAt)
  if (!d || years <= 0) return ''
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCFullYear(t.getUTCFullYear() + years)
  t.setUTCDate(t.getUTCDate() - 1)
  return t.toISOString().slice(0, 10)
}
