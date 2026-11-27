/**
 * D-681 고객성장관리 P0 — 규칙만(화면 · 서버를 끌어오지 않는다 · 외부 호출 · LLM 0).
 *
 *  1) 경과 보고 초안 — 내부에서 이미 적어 둔 업체 기록(업무 · 서류 · 지원사업 · 도구 결과)을 기간으로 잘라 고객용 줄로 만든다.
 *     성과 계산은 기존 성과 보고서(buildClientReport)와 같은 규칙 — 선정 금액과 실제 입금은 한 사업 한 줄로 · 합치지 않고 따로 적는다.
 *     업무 '다음 단계' 처럼 직원이 손으로 적은 글은 내부 글일 수 있어 기본으로 꺼 둔다(켜면 들어간다).
 *  2) 고객 화면 사용 상태 — 연결 전 · 가입 안내함 · 연결됨(안 오심) · 사용 중 · 오래 안 오심 · 잠시 멈춤 · 끊음.
 *  3) 후속 업무 — 가입 안내 3일 · 연결 뒤 첫 방문 없음 3일 · 보고서 안 열어 봄 3일 · 경과 보고 14일 공백 · 30일 안 오심 ·
 *     (D-682) 계약 고객인데 월말 7일 전까지 이번 달 보고가 없음.
 *     (D-684) 계약 끝나는 날 30일 전 ~ 끝난 뒤 30일인데 그 사이 연간 보고가 없음 → '재계약 전 연간 보고'(그때는 보고 공백 · 월말 보고 줄을 같이 띄우지 않는다).
 *  4) (D-682) 월간 보고 · 연간 보고(계약일부터 또는 최근 12개월) — 연간은 '함께 한 기록' 숫자 · '다음 1년 검토해 볼 것'(먼저 제안할 것 · 꺼진 채).
 *     계약일이 비어 있으면 계약 기간을 짐작하지 않는다(그 기간은 고를 수 없고 최근 12개월만).
 *     같은 일은 같은 열쇠(key) — 새 보고서 · 새 연결 · 새 안내가 생기면 새 열쇠(새 주기).
 * 날짜는 한국 날짜(YYYY-MM-DD) 글자로 견준다.
 */
import type { ClientOpsRecord, ServiceKey } from '../types/clientOps'
import { isGrantBookmark } from '../types/clientOps'
import { SERVICES, SERVICE_STATUS_LABEL } from '../content/clientOpsCatalog'
import { buildClientReport, reportFrom, wonShort } from './clientReport'
import { documentsWithExpiry } from './clientOpsAlerts'
import { localDateOf } from '../lib/appClock'
import { RENEWAL_AFTER, RENEWAL_AHEAD, renewalWhen, termStart } from './contractRenewal'

export type PortalReportKind = 'consult_summary' | 'progress' | 'interim' | 'final' | 'monthly' | 'annual'

export const REPORT_KIND_LABEL: Record<PortalReportKind, string> = {
  consult_summary: '상담 요약',
  progress: '경과 보고',
  interim: '중간 보고',
  final: '최종 보고',
  // 홈페이지(My MIRAE)와 같은 이름 — 두 화면이 다른 말을 쓰지 않게(D-682)
  monthly: '월간 보고',
  annual: '연간 보고',
}

/** 보고서 창에서 고르는 종류 — 앞 넷은 늘 보이고, 중간 · 최종은 [그 밖에] 안(D-682 월간 · 연간 더함) */
export const REPORT_KINDS_NOW: PortalReportKind[] = ['progress', 'monthly', 'consult_summary', 'annual', 'interim', 'final']
export const REPORT_KINDS_MAIN = 4

export type DraftPeriodKey = '2w' | '1m' | 'since_last' | 'year' | 'last12' | 'contract' | 'this_month' | 'last_month'

export const DRAFT_PERIOD_LABEL: Record<DraftPeriodKey, string> = {
  '2w': '최근 2주',
  '1m': '최근 1개월',
  since_last: '지난 보고 이후',
  year: '올해',
  last12: '최근 12개월',
  contract: '계약일부터',
  this_month: '이번 달',
  last_month: '지난달',
}

/** 종류마다 고를 수 있는 기간 */
export function periodsFor(kind: PortalReportKind): DraftPeriodKey[] {
  if (kind === 'monthly') return ['this_month', 'last_month']
  if (kind === 'annual') return ['contract', 'last12']
  return ['2w', '1m', 'since_last', 'year']
}

/**
 * 계약일(한국 날짜) — 비어 있으면 '' (짐작하지 않는다).
 * D-684 재계약했으면 이번 계약 기간이 시작한 날 — 끝나기 전에 미리 재계약해 새 기간이 아직이면(today 기준) 지금 돌고 있는 기간.
 */
export function contractStart(record: Pick<ClientOpsRecord, 'contract'>, today?: string): string {
  return termStart(record.contract, today)
}

/** 기간 칩 이름 — D-684 재계약해 새 기간이 시작된 업체의 '계약일부터' 는 '이번 계약부터' */
export function periodLabelFor(key: DraftPeriodKey, record: Pick<ClientOpsRecord, 'contract'>, today?: string): string {
  if (key === 'contract' && contractStart(record, today) !== '' && contractStart(record, today) === (record.contract?.termFrom ?? '').slice(0, 10)) return '이번 계약부터'
  return DRAFT_PERIOD_LABEL[key]
}

/** 이 기간을 고를 수 있는지 — 계약일이 없으면 '계약일부터' 는 못 고른다 */
export function periodUsable(key: DraftPeriodKey, record: Pick<ClientOpsRecord, 'contract'>, today: string): boolean {
  if (key !== 'contract') return true
  const s = contractStart(record, today)
  return !!s && s <= today
}

/** 종류를 고르면 먼저 고를 기간 — 월간: 1~7일이면 지난달 · 연간: 계약일이 있으면 계약일부터 · 그 밖: 지난 보고가 있으면 그 뒤로 */
export function defaultPeriod(kind: PortalReportKind, record: Pick<ClientOpsRecord, 'contract'>, today: string, lastReportEnd?: string | null): DraftPeriodKey {
  if (kind === 'monthly') return Number(today.slice(8, 10)) <= 7 ? 'last_month' : 'this_month'
  if (kind === 'annual') return periodUsable('contract', record, today) ? 'contract' : 'last12'
  return lastReportEnd ? 'since_last' : '2w'
}

export interface DraftSource {
  type: 'service' | 'document' | 'portal_document' | 'portal_update' | 'funding' | 'tool' | 'manual' | 'insight' | 'history'
  id: string
  at?: string
}

export interface DraftLine {
  id: string
  text: string
  date?: string
  /** 고객에게 보낼지 */
  on: boolean
  /** 직원이 손으로 적은 내부 글에서 나온 줄 — 기본 꺼짐 · 화면에 '내부 글' 표시 */
  internal?: boolean
  source?: DraftSource
}

export interface DraftSection {
  key: string
  title: string
  lines: DraftLine[]
}

export interface ReportDraft {
  kind: PortalReportKind
  title: string
  periodStart: string
  periodEnd: string
  summary: string
  staffNote: string
  sections: DraftSection[]
}

/** 고객 화면 서류(브릿지 portal_documents) 가운데 초안에 쓰는 칸 */
export interface PortalDocLite {
  id: string
  title: string
  status: 'requested' | 'uploaded' | 'verified' | 'rejected'
  verifiedAt: string | null
}

/** 고객 화면 업데이트(portal_updates) 가운데 초안에 쓰는 칸 */
export interface PortalUpdateLite {
  id: string
  title: string
  status: 'draft' | 'published' | 'archived'
  actionRequired: boolean
  actionLabel: string | null
  completedAt: string | null
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const dayOf = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? localDateOf(iso) : '')

/** 'YYYY-MM-DD' 에 n 일 — 달력 날짜로(시간대와 상관없다) */
export function shiftDay(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** 두 날짜 사이 날 수(같은 날 0 · b 가 뒤면 양수) */
export function daysBetween(a: string, b: string): number {
  if (!DAY.test(a) || !DAY.test(b)) return 0
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`

/** 기간 — 끝은 늘 오늘(한국 날짜). '지난 보고 이후' 는 지난 보고 끝 다음 날부터(없으면 최근 1개월) */
export function draftPeriod(key: DraftPeriodKey, record: Pick<ClientOpsRecord, 'contract' | 'createdAt'>, today: string, lastReportEnd?: string | null): { from: string; to: string } {
  const to = today
  if (key === 'this_month') return { from: `${today.slice(0, 7)}-01`, to }
  if (key === 'last_month') {
    const end = shiftDay(`${today.slice(0, 7)}-01`, -1)
    return { from: `${end.slice(0, 7)}-01`, to: end }
  }
  // 계약일이 없으면 짐작하지 않는다 — 최근 12개월로(화면은 '계약일부터' 를 못 고르게 막는다)
  if (key === 'contract') {
    const s = contractStart(record, today)
    return s && s <= today ? { from: s, to } : { from: reportFrom(record, 'last12', today), to }
  }
  if (key === '2w') return { from: shiftDay(today, -13), to }
  if (key === '1m' || (key === 'since_last' && !(lastReportEnd && DAY.test(lastReportEnd)))) {
    const [y, m, d] = today.split('-').map(Number)
    const back = new Date(Date.UTC(y, m - 2, Math.min(d, new Date(Date.UTC(y, m - 1, 0)).getUTCDate())))
    return { from: shiftDay(back.toISOString().slice(0, 10), 1), to }
  }
  if (key === 'since_last') {
    const from = shiftDay(lastReportEnd as string, 1)
    return { from: from > today ? today : from, to }
  }
  return { from: reportFrom(record, key, today), to }
}

const serviceLabel = (key: ServiceKey) => SERVICES.find((s) => s.key === key)?.label ?? String(key)

/** 부탁드릴 것은 5개까지(보완 먼저) · 다음 일정은 30일 안 4개까지 — 경과 보고는 짧아야 읽힌다 */
export const ASK_MAX = 5
export const NEXT_DAYS = 30
export const NEXT_MAX = 4

let lineSeq = 0
const lineId = () => `ln${(lineSeq += 1)}`

function line(text: string, opts: Partial<Omit<DraftLine, 'id' | 'text'>> = {}): DraftLine {
  return { id: lineId(), text: text.replace(/\s+/g, ' ').trim().slice(0, 300), on: opts.on ?? true, ...(opts.date ? { date: opts.date } : {}), ...(opts.internal ? { internal: true } : {}), ...(opts.source ? { source: opts.source } : {}) }
}

/**
 * 초안 만들기 — 내부 기록에서 고객용 줄을 뽑는다(직원이 줄마다 켜고 끄고 고친 뒤 발행).
 *   지금 진행 중 · 이번 기간에 끝낸 일 · 확보한 자금(선정/입금 따로) · 대표님께 부탁드릴 것 · 다음 계획
 *   상담 요약 · 최종 보고는 직원이 채울 빈 칸을 함께 둔다.
 */
export function buildReportDraft(input: {
  record: ClientOpsRecord
  today: string
  kind: PortalReportKind
  period: { from: string; to: string }
  docs?: readonly PortalDocLite[]
  updates?: readonly PortalUpdateLite[]
  /** 연간 — '다음 1년 검토해 볼 것'(맞춤 추천 '먼저 제안할 것' 과 같은 판정 · 부르는 쪽이 계산해 넘긴다) */
  picks?: readonly { key: string; label: string }[]
  /** 연간 — 이 기간에 이 업체와 주고받은 것(보낸 보고서 · 그중 열어 본 것) */
  history?: { reports: number; reportsSeen: number }
}): ReportDraft {
  const { record, today, kind, period } = input
  const docs = input.docs ?? []
  const updates = input.updates ?? []
  const inRange = (d: string) => !!d && d >= period.from && d <= period.to
  const rep = buildClientReport(record, today, 'year', period)

  // 지금 진행 중 — 업무 이름 + 상태(고객에게 보여도 되는 말). 직원이 적은 '다음 단계' 글은 따로 · 꺼 둔 채
  const now: DraftLine[] = []
  for (const [key, st] of Object.entries(record.services) as [ServiceKey, ClientOpsRecord['services'][ServiceKey]][]) {
    if (!st || (st.status !== 'in_progress' && st.status !== 'waiting_client')) continue
    now.push(line(`${serviceLabel(key)} — ${st.status === 'waiting_client' ? '대표님 회신을 기다리고 있어요' : SERVICE_STATUS_LABEL[st.status]}`, { source: { type: 'service', id: String(key) } }))
    if (st.nextStep.trim()) now.push(line(`${serviceLabel(key)}: ${st.nextStep.trim()}`, { on: false, internal: true, source: { type: 'service', id: `${String(key)}:next` } }))
  }

  // 이번 기간에 끝낸 일 — 끝낸 업무 · 확인 끝낸 고객 서류 · 도구 판정(고객용 요약이 있는 도구만)
  const done: DraftLine[] = rep.done.map((d) => line(`${d.label} 완료`, { date: d.date, source: { type: 'service', id: d.label, at: d.date } }))
  for (const d of docs) {
    const at = dayOf(d.verifiedAt)
    if (d.status === 'verified' && inRange(at)) done.push(line(`자료 확인 완료: ${d.title}`, { date: at, source: { type: 'portal_document', id: d.id, at } }))
  }
  for (const t of rep.tools) done.push(line(`${t.title} — ${t.verdict}`, { date: t.date, source: { type: 'tool', id: t.title, at: t.date } }))

  // 확보한 자금 — 한 사업 한 줄 · 입금(확정)과 선정(입금 전)을 글로 나눈다 · 합계를 만들지 않는다
  const money: DraftLine[] = rep.money.map((m) =>
    line(
      m.kind === 'executed'
        ? `${m.name} — 입금 확인 ${wonShort(m.amount)}${m.selectedAt ? ` (선정 ${md(m.selectedAt)})` : ''}`
        : `${m.name} — 선정 ${wonShort(m.amount)} (선정 금액 · 아직 입금 전)`,
      { date: m.date, source: { type: 'funding', id: m.name, at: m.date } },
    ),
  )

  // 대표님께 부탁드릴 것 — 고객 화면에서 요청 중인 서류 · 조치. 다시 올려 주실 것(보완) 먼저 · 5개까지
  const ask: DraftLine[] = []
  for (const d of docs) if (d.status === 'rejected') ask.push(line(`${d.title} 다시 올려 주세요`, { source: { type: 'portal_document', id: d.id } }))
  for (const d of docs) if (d.status === 'requested') ask.push(line(`${d.title} 올려 주세요`, { source: { type: 'portal_document', id: d.id } }))
  for (const u of updates) {
    if (u.status === 'published' && u.actionRequired && !u.completedAt) ask.push(line(u.actionLabel?.trim() || u.title, { source: { type: 'portal_update', id: u.id } }))
  }
  ask.splice(ASK_MAX)

  // 다음 계획 — 30일 안의 신청 마감 · 결과 발표 · 업무 목표일(이름만) · 서류 만료 · 가까운 것 4개
  const next: DraftLine[] = []
  const until = shiftDay(today, NEXT_DAYS)
  const pushNext = (date: string, text: string, source: DraftSource) => {
    if (date && DAY.test(date) && date >= today && date <= until) next.push(line(text, { date, source }))
  }
  for (const a of record.fundingApplications) {
    if ((a.status === 'watching' || a.status === 'preparing') && a.applyDueDate && !isGrantBookmark(a)) pushNext(a.applyDueDate, `${a.programName || '지원사업'} 신청 마감`, { type: 'funding', id: a.id })
    if ((a.status === 'submitted' || a.status === 'reviewing') && a.resultDueDate) pushNext(a.resultDueDate, `${a.programName || '지원사업'} 결과 발표 예정`, { type: 'funding', id: a.id })
  }
  for (const [key, st] of Object.entries(record.services) as [ServiceKey, ClientOpsRecord['services'][ServiceKey]][]) {
    if (st && (st.status === 'in_progress' || st.status === 'waiting_client') && st.dueDate) pushNext(dayOf(st.dueDate), `${serviceLabel(key)} 목표일`, { type: 'service', id: String(key) })
  }
  for (const { meta, view } of documentsWithExpiry(record, today)) {
    if (view.expiresOn) pushNext(view.expiresOn, `${meta.label} 유효기간 끝 — 새로 발급`, { type: 'document', id: String(meta.key) })
  }
  next.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))

  const sections: DraftSection[] = []
  const add = (key: string, title: string, lines: DraftLine[], keepEmpty = false) => {
    if (lines.length || keepEmpty) sections.push({ key, title, lines })
  }
  if (kind === 'consult_summary') {
    add('talk', '이야기 나눈 것', [], true)
    add('agreed', '함께 정한 다음 일', [], true)
    add('ask', '대표님께 부탁드릴 것', ask, true)
    add('next', '다음 일정', next.slice(0, NEXT_MAX))
  } else if (kind === 'annual') {
    // 1년 정리 — 끝낸 일 · 진행 · 자금 · 함께 한 기록(숫자만) · 다음 1년 검토해 볼 것(직원이 켜야 나감) · 남은 것(직원이 채움)
    const verified = docs.filter((d) => d.status === 'verified' && inRange(dayOf(d.verifiedAt))).length
    const rec: DraftLine[] = []
    if (input.history && input.history.reports > 0) rec.push(line(`보내 드린 보고서 ${input.history.reports}편${input.history.reportsSeen ? ` · 열어 보신 것 ${input.history.reportsSeen}편` : ''}`, { source: { type: 'history', id: 'reports' } }))
    if (verified > 0) rec.push(line(`확인을 마친 자료 ${verified}개`, { source: { type: 'history', id: 'documents' } }))
    const review = (input.picks ?? []).slice(0, 3).map((p) => line(`${p.label} — 함께 검토해 볼 만해요`, { on: false, source: { type: 'insight', id: p.key } }))
    add('done', '함께 한 일', done, true)
    add('now', '지금 진행 중', now)
    add('money', '확보한 자금', money)
    add('record', '함께 한 기록', rec)
    add('review', '다음 1년 검토해 볼 것', review, true)
    add('limits', '남은 것 · 유의할 점', [], true)
  } else if (kind === 'final') {
    add('done', '전달한 결과', done, true)
    add('money', '확보한 자금', money)
    add('limits', '남은 것 · 유의할 점', [], true)
    add('guide', '앞으로 이렇게 쓰세요', [], true)
  } else {
    add('now', '지금 진행 중', now, true)
    add('done', '이번 기간에 끝낸 일', done, true)
    add('money', '확보한 자금', money)
    add('ask', '대표님께 부탁드릴 것', ask, true)
    add('next', '다음 계획', next.slice(0, NEXT_MAX), true)
    if (kind === 'interim') add('check', '함께 확인할 점', [], true)
  }

  const doneN = done.length
  const nowN = now.filter((l) => !l.internal).length
  const askN = ask.length
  const range = `${md(period.from)} ~ ${md(period.to)}`
  const fullRange = `${period.from.slice(0, 4)}.${md(period.from)} ~ ${period.to.slice(0, 4)}.${md(period.to)}`
  const summary =
    kind === 'consult_summary'
      ? `${md(today)} 상담에서 이야기 나눈 내용과 다음 일을 정리했어요.`
      : kind === 'annual'
        ? `${fullRange} 동안 함께 끝낸 일 ${doneN}건 · 지금 진행 중 ${nowN}건${money.length ? ` · 확보한 자금 ${money.length}건` : ''}이에요.`
        : `이번 기간(${range})에 끝낸 일 ${doneN}건 · 진행 중 ${nowN}건이에요.${askN ? ` 대표님께 부탁드릴 것이 ${askN}건 있어요.` : ''}`
  // 월간 · 연간은 기간이 곧 이름 — 지난달 보고는 그 달 이름으로
  const monthTitle = `${Number((kind === 'monthly' ? period.from : today).slice(5, 7))}월`
  const title =
    kind === 'consult_summary' ? `${md(today)} ${REPORT_KIND_LABEL[kind]}`
      : kind === 'monthly' ? `${monthTitle} 월간 보고`
        : kind === 'annual' ? `연간 보고 (${fullRange})`
          : `${monthTitle} ${REPORT_KIND_LABEL[kind]} (${range})`

  return { kind, title, periodStart: period.from, periodEnd: period.to, summary, staffNote: '', sections }
}

/** 발행할 모양 — 켠 줄만 · 줄의 출처는 내부 감사용(고객 투영에 없음) */
export function draftPayload(draft: ReportDraft): {
  sections: { key: string; title: string; items: { text: string; date?: string }[] }[]
  sourceRefs: DraftSource[]
  lineCount: number
} {
  const sections = draft.sections
    .map((s) => ({ key: s.key, title: s.title, items: s.lines.filter((l) => l.on && l.text.trim()).map((l) => ({ text: l.text.trim(), ...(l.date ? { date: l.date } : {}) })) }))
    .filter((s) => s.items.length > 0)
  const sourceRefs = draft.sections.flatMap((s) => s.lines.filter((l) => l.on && l.source).map((l) => l.source as DraftSource))
  return { sections, sourceRefs, lineCount: sections.reduce((n, s) => n + s.items.length, 0) }
}

/** 고객에게 보낼 안내 문구(카톡 · 문자 복사용) — 민감한 내용은 넣지 않는다. 로그인하면 그 보고서로 */
export function reportNoticeText(opts: { who: string; kindLabel: string; title: string; url: string; corrected?: boolean }): string {
  return [
    `안녕하세요, ${opts.who}.`,
    `${opts.kindLabel}${opts.corrected ? '(정정본)' : ''}가 고객 전용 페이지에 올라왔어요.`,
    `· ${opts.title}`,
    '',
    `아래 주소에서 로그인하시면 바로 보실 수 있어요.`,
    opts.url,
    '',
    '궁금한 점은 그 화면의 [이 보고서 문의] 로 남겨 주세요. 감사합니다.',
  ].join('\n')
}

/* ------------------------------------------------------------------ */
/* 고객 화면 사용 상태 · 후속 업무                                          */
/* ------------------------------------------------------------------ */

export type PortalLinkStatusLite = 'active' | 'paused' | 'revoked'

export interface PortalLinkLite {
  id: string
  status: PortalLinkStatusLite
  linkedAt: string
  profileEmail?: string
}

export interface PortalSeen {
  first: string
  last: string
}

export interface PortalReportLite {
  id: string
  status: 'published' | 'superseded' | 'withdrawn'
  publishedAt: string
  /** D-684 종류(재계약 전 연간 보고를 냈는지 본다) — 모르면 없음 */
  kind?: PortalReportKind
  periodEnd?: string | null
  title?: string
}

export type PortalUsageState = 'none' | 'invited' | 'linked_unvisited' | 'active' | 'dormant' | 'paused' | 'revoked'

export const PORTAL_USAGE_LABEL: Record<PortalUsageState, string> = {
  none: '연결 전',
  invited: '가입 안내함',
  linked_unvisited: '연결됨 · 아직 안 오심',
  active: '사용 중',
  dormant: '30일 넘게 안 오심',
  paused: '잠시 멈춤',
  revoked: '연결 끊음',
}

export const DORMANT_DAYS = 30
export const FIRST_VISIT_WAIT_DAYS = 3
export const INVITE_WAIT_DAYS = 3
export const REPORT_UNSEEN_DAYS = 3
export const REPORT_GAP_DAYS = 14

/** 이 업체의 고객 화면 사용 상태 — 활성 연결이 하나라도 있으면 그 가운데 가장 최근 방문으로 */
export function portalUsage(input: { links: readonly PortalLinkLite[]; homeSeen: ReadonlyMap<string, PortalSeen>; invitedAt?: string | null }, today: string): { state: PortalUsageState; lastVisit: string; firstVisit: string } {
  const active = input.links.filter((l) => l.status === 'active')
  if (!active.length) {
    if (input.links.some((l) => l.status === 'paused')) return { state: 'paused', lastVisit: '', firstVisit: '' }
    if (input.links.some((l) => l.status === 'revoked')) return { state: 'revoked', lastVisit: '', firstVisit: '' }
    return { state: input.invitedAt ? 'invited' : 'none', lastVisit: '', firstVisit: '' }
  }
  const seen = active.map((l) => input.homeSeen.get(l.id)).filter((s): s is PortalSeen => !!s)
  if (!seen.length) return { state: 'linked_unvisited', lastVisit: '', firstVisit: '' }
  const last = seen.map((s) => dayOf(s.last)).sort().at(-1) ?? ''
  const first = seen.map((s) => dayOf(s.first)).sort()[0] ?? ''
  return { state: daysBetween(last, today) >= DORMANT_DAYS ? 'dormant' : 'active', lastVisit: last, firstVisit: first }
}

export type PortalFollowRule = 'invite_pending' | 'first_visit' | 'report_unseen' | 'report_gap' | 'monthly_review' | 'renewal_report' | 'dormant'

/** D-684 이 날 수 안에 낸 연간 보고가 있으면 재계약 전 보고를 낸 것으로 본다(끝나는 날 기준 앞 60일부터) */
export const RENEWAL_REPORT_LOOKBACK = 60

/** 줄마다 [열기] 에서 바로 만들 보고서 종류 — 없으면 탭만 연다 */
export function followUpReportKind(rule: PortalFollowRule): PortalReportKind | null {
  if (rule === 'monthly_review') return 'monthly'
  if (rule === 'renewal_report') return 'annual'
  if (rule === 'report_gap') return 'progress'
  return null
}

/** 월말 며칠 전부터 '이번 달 보고' 를 챙길지 */
export const MONTHLY_REVIEW_DAYS = 7

export interface PortalFollowUp {
  /** 같은 일 = 같은 열쇠(새 보고서 · 새 연결 · 새 안내는 새 열쇠) */
  key: string
  rule: PortalFollowRule
  clientId: string
  days: number
  text: string
}

/**
 * 후속 업무(내부 화면에만) — 저절로 고객에게 보내지 않는다. 조건이 풀리면(열어 봄 · 첫 방문 · 새 보고서) 목록에서 저절로 빠진다.
 *   activeWork — 지금 진행 중인 업무가 있는지(경과 보고 공백은 일하는 동안만 센다)
 */
export function portalFollowUps(
  input: {
    clientId: string
    invitedAt?: string | null
    links: readonly PortalLinkLite[]
    homeSeen: ReadonlyMap<string, PortalSeen>
    reports: readonly PortalReportLite[]
    /** 활성 연결 누구라도 열어 본 보고서 id */
    reportSeen: ReadonlySet<string>
    activeWork: boolean
    /** 고객 방문 기록을 알 수 있는지(연습 모드는 고객 계정이 없어 모른다 — 방문 · 열람 규칙을 건너뛴다) */
    visitsKnown?: boolean
    /** D-682 계약 고객인지(월말 보고 챙기기는 계약 고객만) */
    contracted?: boolean
    /** D-684 계약 끝나는 날(적어 둔 것만 · 모르면 없음) */
    contractEndsAt?: string
  },
  today: string,
): PortalFollowUp[] {
  const out: PortalFollowUp[] = []
  const active = input.links.filter((l) => l.status === 'active')
  const invited = dayOf(input.invitedAt ?? '')
  if (invited && input.links.length === 0) {
    const n = daysBetween(invited, today)
    if (n >= INVITE_WAIT_DAYS) out.push({ key: `${input.clientId}:invite:${invited}`, rule: 'invite_pending', clientId: input.clientId, days: n, text: `가입 안내 ${n}일째 — 가입하셨는지 여쭤 보세요` })
  }
  const known = input.visitsKnown !== false
  for (const l of known ? active : []) {
    const seen = input.homeSeen.get(l.id)
    const linked = dayOf(l.linkedAt)
    if (!seen && linked) {
      const n = daysBetween(linked, today)
      if (n >= FIRST_VISIT_WAIT_DAYS) out.push({ key: `${input.clientId}:first:${l.id}`, rule: 'first_visit', clientId: input.clientId, days: n, text: `연결 ${n}일째 · 아직 고객 화면에 안 오셨어요` })
    } else if (seen) {
      const last = dayOf(seen.last)
      const n = daysBetween(last, today)
      if (n >= DORMANT_DAYS) out.push({ key: `${input.clientId}:dormant:${l.id}:${last}`, rule: 'dormant', clientId: input.clientId, days: n, text: `${n}일째 고객 화면에 안 오셨어요` })
    }
  }
  const published = input.reports.filter((r) => r.status === 'published').sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  const latest = published[0]
  if (known && latest && active.length) {
    const at = dayOf(latest.publishedAt)
    const n = daysBetween(at, today)
    if (!input.reportSeen.has(latest.id) && n >= REPORT_UNSEEN_DAYS) {
      out.push({ key: `${input.clientId}:unseen:${latest.id}`, rule: 'report_unseen', clientId: input.clientId, days: n, text: `보고서 ${n}일째 안 열어 보셨어요 — 안내 문구를 다시 보내 보세요` })
    }
  }
  if (input.activeWork && active.length) {
    const since = latest ? dayOf(latest.publishedAt) : active.map((l) => dayOf(l.linkedAt)).filter(Boolean).sort()[0] ?? ''
    const n = since ? daysBetween(since, today) : 0
    if (since && n >= REPORT_GAP_DAYS) {
      out.push({ key: `${input.clientId}:gap:${latest?.id ?? 'none'}`, rule: 'report_gap', clientId: input.clientId, days: n, text: latest ? `경과 보고 ${n}일째 없음 — 보고서를 만들어 보세요` : `연결 ${n}일째 · 아직 보고서가 없어요` })
    }
  }
  // D-684 재계약 전 연간 보고 — 계약 고객 · 활성 계정 · 끝나는 날 30일 전 ~ 끝난 뒤 30일 · 그 앞 60일 안 낸 연간 보고 0
  //   이 줄이 있으면 보고 공백 · 월말 보고 줄은 빼고 이것 하나(보고서를 만들라는 줄을 한 업체에 둘 띄우지 않는다)
  const ends = (input.contractEndsAt ?? '').slice(0, 10)
  if (input.contracted && active.length && DAY.test(ends)) {
    const left = daysBetween(today, ends)
    const from = shiftDay(ends, -RENEWAL_REPORT_LOOKBACK)
    if (left <= RENEWAL_AHEAD && left >= -RENEWAL_AFTER && !published.some((r) => r.kind === 'annual' && dayOf(r.publishedAt) >= from)) {
      for (let i = out.length - 1; i >= 0; i -= 1) if (out[i].rule === 'report_gap') out.splice(i, 1)
      out.push({ key: `${input.clientId}:renewal:${ends}`, rule: 'renewal_report', clientId: input.clientId, days: left, text: `계약 끝 ${md(ends)}(${renewalWhen(left)}) — 재계약 전에 연간 보고를 보내 보세요` })
    }
  }
  // D-682 월말 보고 — 계약 고객 · 활성 계정 · 월말 7일 전부터 · 이번 달 낸 보고서 0 · 보고 공백 줄이 이미 있으면 하나만(같은 일을 두 번 띄우지 않는다)
  if (input.contracted && active.length && !out.some((f) => f.rule === 'report_gap' || f.rule === 'renewal_report')) {
    const month = today.slice(0, 7)
    const monthEnd = shiftDay(`${shiftDay(`${month}-28`, 4).slice(0, 7)}-01`, -1)
    const left = daysBetween(today, monthEnd)
    if (left < MONTHLY_REVIEW_DAYS && !published.some((r) => dayOf(r.publishedAt).startsWith(month))) {
      out.push({ key: `${input.clientId}:monthly:${month}`, rule: 'monthly_review', clientId: input.clientId, days: daysBetween(`${month}-01`, today), text: `${Number(month.slice(5, 7))}월 보고를 아직 안 보냈어요 — 월간 보고를 만들어 보세요` })
    }
  }
  const order: Record<PortalFollowRule, number> = { report_unseen: 0, renewal_report: 1, report_gap: 2, monthly_review: 3, first_visit: 4, invite_pending: 5, dormant: 6 }
  // 재계약 줄은 끝나는 날이 가까운 것(남은 날이 적은 것)이 먼저 · 그 밖은 오래된 것이 먼저
  return out.sort((a, b) => order[a.rule] - order[b.rule] || (a.rule === 'renewal_report' ? a.days - b.days : b.days - a.days))
}

/** 업체에 지금 진행 중인 업무가 있는지(경과 보고 공백을 셀지) */
export function hasActiveWork(record: Pick<ClientOpsRecord, 'services' | 'archivedAt'>): boolean {
  if (record.archivedAt) return false
  return Object.values(record.services).some((s) => s && (s.status === 'in_progress' || s.status === 'waiting_client'))
}

/** 가입 안내 문구 — 홈페이지 가입 주소 · 가입 뒤 이 이메일을 알려 달라는 한 줄(내부 id · 업무 내용 0) */
export function portalInviteText(opts: { who: string; signupUrl: string; email?: string }): string {
  return [
    `안녕하세요, ${opts.who}.`,
    '미래AI랩 고객 전용 페이지(My MIRAE)에서 진행 상황 · 요청 자료 · 보고서를 한곳에서 보실 수 있어요.',
    '',
    `1) 아래 주소에서 가입해 주세요${opts.email ? `(이메일: ${opts.email})` : ''}.`,
    opts.signupUrl,
    '2) 가입하셨다고 알려 주시면 담당자가 회사와 연결해 드려요.',
    '',
    '감사합니다.',
  ].join('\n')
}
