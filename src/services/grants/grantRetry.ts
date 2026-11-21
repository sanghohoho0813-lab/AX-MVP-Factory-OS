/**
 * D-641 떨어진 신청 — 떨어진 까닭을 남기고, 다음 해 같은 공고가 다시 올라오면 '다시 도전' 으로 잇는다.
 *
 * - 까닭은 네 가지 중에서 고르고(점수 · 자격 · 사업계획서 · 서류) 한 줄 메모. 까닭마다 '이번엔 이것부터' 한 줄(규칙 · AI 아님).
 * - 같은 공고인지는 이름으로 본다 — 해(2026년도) · 차수(2차) · 반기 · '공고 · 모집 · 재공고' 같은 말을 빼고 같으면 같은 사업.
 * - 다시 올라온 공고: 떨어진 건 뒤에 나온(마감이 더 늦은) · 아직 마감 전 공고 중 같은 사업. 이미 다시 신청 중이면 알리지 않는다.
 * - 고객에게 가는 글(1년 일정표 · 카톡)에는 까닭을 쓰지 않는다 — 우리 쪽 기록이다.
 *
 * DB 변경 0 — 신청 건(업체 기록 안 fundingApplications)에 칸 셋(rejectReasons · rejectNote · retryPlan)과 다시 도전 건의 retryOf 만 더한다.
 */
import type { ClientOpsRecord, FundingApplication } from '../../types/clientOps'
import type { GrantMatch } from './grantMatch'

export type RejectReason = 'score' | 'eligibility' | 'plan' | 'docs'

export const REJECT_REASONS: readonly { key: RejectReason; label: string; tip: string }[] = [
  { key: 'score', label: '점수 · 경쟁', tip: '가점(인증 · 고용 · 특허)부터 챙겨요' },
  { key: 'eligibility', label: '자격 · 요건', tip: '공고가 나오면 자격(업력 · 지역 · 업종)부터 대조해요' },
  { key: 'plan', label: '사업계획서 · 발표', tip: '공고 전에 사업계획서를 미리 고쳐 둬요(지난 평가 의견부터)' },
  { key: 'docs', label: '서류 빠짐 · 늦음', tip: '마감 2주 전까지 서류를 다 받아 둬요' },
]

export const REJECT_NOTE_MAX = 200

const LABEL: Record<RejectReason, string> = Object.fromEntries(REJECT_REASONS.map((r) => [r.key, r.label])) as Record<RejectReason, string>
const TIP: Record<RejectReason, string> = Object.fromEntries(REJECT_REASONS.map((r) => [r.key, r.tip])) as Record<RejectReason, string>

export function isRejectReason(v: unknown): v is RejectReason {
  return v === 'score' || v === 'eligibility' || v === 'plan' || v === 'docs'
}

/** 해 · 차수 · 반기 · 공고 꾸밈말을 뺀 사업 이름 — 해마다 같은 사업이면 같은 값 */
export function programKey(title: string): string {
  return title
    .replace(/\[[^\]]*\]|【[^】]*】|〔[^〕]*〕/g, ' ')
    .replace(/(?:19|20)\d{2}\s*(?:년\s*도?|년|\.)?/g, ' ')
    .replace(/제?\s*\d+\s*차/g, ' ')
    .replace(/[상하]반기/g, ' ')
    .replace(/재\s*공고|추가\s*모집|연장\s*공고|변경\s*공고|모집\s*공고|참여\s*기업\s*모집|모집|공고|안내/g, ' ')
    .replace(/[^가-힣A-Za-z0-9]/g, '')
    .toLowerCase()
}

/** 해마다 같은 사업인가 — 이름 뼈대가 같거나, 6자 넘는 뼈대가 다른 쪽에 통째로 들어 있으면 */
export function sameProgramAcrossYears(a: string, b: string): boolean {
  const ka = programKey(a)
  const kb = programKey(b)
  if (ka.length < 4 || kb.length < 4) return false
  if (ka === kb) return true
  const [short, long] = ka.length <= kb.length ? [ka, kb] : [kb, ka]
  return short.length >= 6 && long.includes(short)
}

/** 떨어진 건 — 다시 도전을 접은 건(retryPlan 'skip')은 뺀다 */
export function isRetryable(app: Pick<FundingApplication, 'status' | 'retryPlan'>): boolean {
  return app.status === 'rejected' && app.retryPlan !== 'skip'
}

const ymd = (v: string | null | undefined) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '')

/** 그 건의 기준 날 — 신청 마감 → 접수한 날 → 결과 나온 날 → 만든 날 */
export function lastDateOf(app: Pick<FundingApplication, 'applyDueDate' | 'submittedAt' | 'resultAt' | 'createdAt'>): string {
  return ymd(app.applyDueDate) || ymd(app.submittedAt) || ymd(app.resultAt) || ymd(app.createdAt)
}

/**
 * 다음 해 같은 사업이 나올 무렵(짐작) — 기준 날의 같은 달, 한 해 뒤. 기준 날이 없으면 ''.
 * from('YYYY-MM-DD')을 주면 그 달 이후의 첫 번째 같은 달(그 사이 회차는 이미 지났다).
 */
export function expectedRetryMonth(app: Pick<FundingApplication, 'applyDueDate' | 'submittedAt' | 'resultAt' | 'createdAt'>, from = ''): string {
  const d = lastDateOf(app)
  if (!d) return ''
  let y = Number(d.slice(0, 4)) + 1
  const mm = d.slice(5, 7)
  const fromYm = from.slice(0, 7)
  while (fromYm && `${y}-${mm}` < fromYm) y += 1
  return `${y}-${mm}`
}

/** 고른 까닭 → 이름 · 메모 한 줄(우리 쪽 기록 — 고객 글에는 쓰지 않는다) */
export function rejectReasonText(app: Pick<FundingApplication, 'rejectReasons' | 'rejectNote'>): string {
  const names = (app.rejectReasons ?? []).filter(isRejectReason).map((k) => LABEL[k])
  const note = (app.rejectNote ?? '').trim()
  return [names.join(' · '), note ? `'${note.length > 40 ? `${note.slice(0, 40)}…` : note}'` : ''].filter(Boolean).join(' — ')
}

/** 이번엔 이것부터 — 고른 까닭마다 한 줄 */
export function retryTips(app: Pick<FundingApplication, 'rejectReasons'>): string[] {
  return (app.rejectReasons ?? []).filter(isRejectReason).map((k) => TIP[k])
}

/** 까닭 · 메모 · 다시 도전 여부를 적는다(빈 까닭 · 빈 메모는 지운다) */
export function withRejectInfo(
  record: ClientOpsRecord,
  appId: string,
  info: { reasons: readonly RejectReason[]; note: string; retryPlan: 'retry' | 'skip' },
  now: string,
): ClientOpsRecord {
  const reasons = [...new Set(info.reasons.filter(isRejectReason))]
  const note = info.note.trim().slice(0, REJECT_NOTE_MAX)
  return {
    ...record,
    fundingApplications: record.fundingApplications.map((a) => {
      if (a.id !== appId) return a
      const { rejectReasons: _r, rejectNote: _n, ...rest } = a
      void _r
      void _n
      return { ...rest, ...(reasons.length ? { rejectReasons: reasons } : {}), ...(note ? { rejectNote: note } : {}), retryPlan: info.retryPlan, updatedAt: now }
    }),
  }
}

/** 이 공고로 다시 도전할 떨어진 건(가장 최근 것) — 공고로 신청 건을 만들 때 retryOf 로 잇는다 */
export function rejectedTwinOf(record: Pick<ClientOpsRecord, 'fundingApplications'>, notice: { id: string; title: string }): FundingApplication | null {
  const twins = record.fundingApplications.filter((a) => isRetryable(a) && a.noticeId !== notice.id && sameProgramAcrossYears(a.programName, notice.title))
  return twins.sort((a, b) => lastDateOf(b).localeCompare(lastDateOf(a)))[0] ?? null
}

/** 다시 도전 건이 가리키는 떨어진 건 */
export function retrySourceOf(record: Pick<ClientOpsRecord, 'fundingApplications'>, app: Pick<FundingApplication, 'retryOf'>): FundingApplication | null {
  return app.retryOf ? (record.fundingApplications.find((a) => a.id === app.retryOf && a.status === 'rejected') ?? null) : null
}

export interface RetryHit {
  /** 떨어진 건 */
  app: FundingApplication
  /** 다시 올라온 공고(마감 전 · 접수 전 포함) */
  match: GrantMatch
}

const LIVE = new Set(['watching', 'preparing', 'submitted', 'reviewing', 'selected'])

/**
 * 떨어진 사업이 다시 올라왔나 — matches 는 matchesFor(…, { includeUpcoming: true }) 결과(마감 · 조건 안 맞음은 이미 빠짐).
 * 떨어진 건 하나에 공고 하나(마감 가까운 것) · 같은 공고는 한 번만. 이미 이 공고(또는 같은 사업의 더 새 건)로 진행 중이면 뺀다.
 */
export function retryHits(record: Pick<ClientOpsRecord, 'fundingApplications'>, matches: readonly GrantMatch[]): RetryHit[] {
  const rejected = record.fundingApplications.filter(isRetryable)
  if (rejected.length === 0 || matches.length === 0) return []
  const live = record.fundingApplications.filter((a) => LIVE.has(a.status))
  const used = new Set<string>()
  const out: RetryHit[] = []
  const newest = [...rejected].sort((a, b) => lastDateOf(b).localeCompare(lastDateOf(a)))
  for (const app of newest) {
    const last = lastDateOf(app)
    // 같은 사업으로 이미 다시 신청 중(이 건 뒤에 만든 진행 중인 건) — 알리지 않는다
    if (live.some((l) => (l.retryOf === app.id || sameProgramAcrossYears(l.programName, app.programName)) && lastDateOf(l) > last)) continue
    const m = matches
      .filter((x) => x.notice.id !== app.noticeId && !used.has(x.notice.id) && sameProgramAcrossYears(x.notice.title, app.programName))
      // 떨어진 건보다 뒤에 나온 공고만(마감을 모르면 들인다)
      .filter((x) => !x.notice.applyEnd || !last || x.notice.applyEnd > last)
      .filter((x) => !live.some((l) => l.noticeId === x.notice.id))
      .sort((a, b) => (a.deadline.days ?? 9999) - (b.deadline.days ?? 9999))[0]
    if (!m) continue
    used.add(m.notice.id)
    out.push({ app, match: m })
  }
  return out
}
