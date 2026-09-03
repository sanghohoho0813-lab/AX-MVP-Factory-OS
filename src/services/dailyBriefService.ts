/**
 * 오늘의 브리핑 — 경고·고객 이벤트·후속조치·자금 마감·수금을 한 줄로 합쳐
 * "지금 무엇부터"를 규칙으로 정한다.
 *
 * AI 가 아니다. 모든 순서에는 사람이 읽을 수 있는 이유(reason)가 붙는다.
 * 하루 정리(End of Day)도 같은 원칙으로 deterministic 하게 만든다.
 */

import type { ClientOpsRecord, OpsAlert } from '../types/clientOps'
import type { CustomerEvent, JournalEntry } from '../types/bridge'
import { daysLeftFrom } from './clientOpsAlerts'
import { eventSummary, isOpenEvent, EVENT_TYPE_LABEL } from './customerBridgeService'

export type BriefActionKind = 'alert' | 'event' | 'follow_up' | 'funding' | 'payment'

export interface BriefAction {
  id: string
  kind: BriefActionKind
  title: string
  detail: string
  /** 왜 이 순서인지 — 화면에 그대로 보여준다 */
  reason: string
  severity: 'critical' | 'warning' | 'info'
  href: string
  clientId: string | null
  clientName: string
  score: number
}

const CRITICAL_ALERT_KINDS = new Set<OpsAlert['kind']>([
  'task_overdue',
  'blocked_missing_doc',
  'doc_expired',
  'payment_overdue',
  'funding_overdue',
])

function alertScore(a: OpsAlert): { score: number; reason: string } {
  switch (a.kind) {
    case 'funding_overdue':
      return { score: 100, reason: '지원사업 신청 마감이 지났습니다' }
    case 'task_overdue':
      return { score: 96, reason: '업무 마감이 지났습니다' }
    case 'payment_overdue':
      return { score: 94, reason: '받기로 한 날이 지난 돈입니다' }
    case 'blocked_missing_doc':
      return { score: 92, reason: '서류가 없어 진행이 막혀 있습니다' }
    case 'doc_expired':
      return { score: 88, reason: '서류 유효기간이 지났습니다' }
    case 'funding_due_soon':
      return { score: 76, reason: '지원사업 신청 마감이 임박했습니다' }
    case 'task_due_soon':
      return { score: 70, reason: '업무 마감이 임박했습니다' }
    case 'payment_due_soon':
      return { score: 66, reason: '수금 예정일이 임박했습니다' }
    case 'waiting_too_long':
      return { score: 62, reason: '고객 회신을 오래 기다리고 있습니다' }
    case 'doc_expiring':
      return { score: 48, reason: '서류 유효기간이 곧 끝납니다' }
    case 'no_next_step':
      return { score: 40, reason: '진행 중인데 다음 할 일이 비어 있습니다' }
  }
}

function eventScore(e: CustomerEvent): { score: number; reason: string } {
  if (e.eventType === 'service_order_created') return { score: 95, reason: '결제한 새 주문 — 아직 처리하지 않았습니다' }
  if (e.eventType === 'document_uploaded') return { score: 84, reason: '고객이 서류를 올렸습니다 — 확인이 필요합니다' }
  if (e.eventType === 'consultation_requested') return { score: 82, reason: '고객이 상담을 신청했습니다' }
  if (e.eventType === 'customer_request_created') return { score: e.priority === 'high' ? 80 : 64, reason: '고객이 요청을 보냈습니다' }
  if (e.eventType === 'diagnosis_completed') return { score: e.priority === 'high' ? 72 : 58, reason: '사업 진단을 마친 잠재 고객입니다' }
  if (e.eventType === 'customer_action_completed') return { score: 56, reason: '고객이 요청한 조치를 마쳤습니다' }
  return { score: 30, reason: '참고용 고객 이벤트' }
}

/**
 * 오늘 처리할 Top N.
 * 순서 규칙: 마감 지남/막힘 > 결제된 주문 > 지난 후속조치 > 고객 서류·요청 > 임박 마감 > 나머지.
 */
export function buildTopActions(
  input: {
    alerts: OpsAlert[]
    events: CustomerEvent[]
    followUps: JournalEntry[]
    clientNames: Map<string, string>
    today: string
  },
  limit = 3,
): BriefAction[] {
  const out: BriefAction[] = []

  for (const a of input.alerts) {
    const { score, reason } = alertScore(a)
    out.push({
      id: `alert:${a.id}`,
      kind: 'alert',
      title: a.title,
      detail: a.detail,
      reason,
      severity: CRITICAL_ALERT_KINDS.has(a.kind) ? 'critical' : a.severity === 'critical' ? 'critical' : a.severity,
      href: `/ops/clients/${a.clientId}`,
      clientId: a.clientId,
      clientName: a.clientName,
      score,
    })
  }

  for (const e of input.events) {
    if (!isOpenEvent(e)) continue
    const { score, reason } = eventScore(e)
    const s = eventSummary(e)
    const clientName = (e.operationsClientId && input.clientNames.get(e.operationsClientId)) || s.who
    out.push({
      id: `event:${e.id}`,
      kind: 'event',
      title: `${EVENT_TYPE_LABEL[e.eventType]} · ${s.who}`,
      detail: s.what,
      reason,
      severity: score >= 80 ? 'critical' : score >= 60 ? 'warning' : 'info',
      href: '/ops/inbox',
      clientId: e.operationsClientId,
      clientName,
      score,
    })
  }

  for (const f of input.followUps) {
    if (f.entryType !== 'follow_up' || f.completed || !f.dueDate) continue
    const left = daysLeftFrom(input.today, f.dueDate)
    if (left === null || left > 0) continue
    const overdue = left < 0
    out.push({
      id: `follow:${f.id}`,
      kind: 'follow_up',
      title: f.content.length > 60 ? `${f.content.slice(0, 60)}…` : f.content,
      detail: f.clientId ? (input.clientNames.get(f.clientId) ?? '') : '',
      reason: overdue ? `후속조치 기한이 ${-left}일 지났습니다` : '오늘까지 하기로 한 후속조치입니다',
      severity: overdue ? 'critical' : 'warning',
      href: f.clientId ? `/ops/clients/${f.clientId}` : '/journal',
      clientId: f.clientId,
      clientName: f.clientId ? (input.clientNames.get(f.clientId) ?? '') : '',
      score: overdue ? Math.min(99, 86 + Math.min(10, -left)) : 68,
    })
  }

  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}

/* ------------------------------------------------------------------ */
/* 하루 정리 — 규칙 기반 요약                                              */
/* ------------------------------------------------------------------ */

export interface DaySummary {
  date: string
  done: string[]
  remaining: string[]
  carriedOver: string[]
  decisions: string[]
  issues: string[]
  counts: { journal: number; activities: number; resolvedEvents: number; openCritical: number; openEvents: number }
}

export function buildDaySummary(input: {
  today: string
  journal: JournalEntry[]
  clients: ClientOpsRecord[]
  alerts: OpsAlert[]
  events: CustomerEvent[]
  clientNames: Map<string, string>
}): DaySummary {
  const { today, journal, clients, alerts, events, clientNames } = input
  const isToday = (iso: string | null) => typeof iso === 'string' && iso.slice(0, 10) === today
  const name = (id: string | null) => (id ? (clientNames.get(id) ?? '') : '')
  const withName = (id: string | null, text: string) => (name(id) ? `${name(id)} · ${text}` : text)

  const todayJournal = journal.filter((j) => j.entryDate === today)

  const done: string[] = []
  for (const c of clients) {
    for (const a of c.activity) {
      if (isToday(a.at)) done.push(`${c.companyName} · ${a.text}`)
    }
  }
  for (const j of journal) {
    if (j.entryType === 'follow_up' && j.completed && isToday(j.completedAt)) done.push(withName(j.clientId, `후속조치 완료 — ${j.content}`))
  }
  const resolvedEvents = events.filter((e) => e.status === 'resolved' && isToday(e.handledAt))
  for (const e of resolvedEvents) done.push(`고객 이벤트 처리 — ${eventSummary(e).who}: ${EVENT_TYPE_LABEL[e.eventType]}`)

  const openCritical = alerts.filter((a) => a.severity === 'critical')
  const remaining = openCritical.map((a) => `${a.clientName} · ${a.title}`)
  const openEvents = events.filter(isOpenEvent)
  for (const e of openEvents) remaining.push(`고객 이벤트 — ${eventSummary(e).who}: ${EVENT_TYPE_LABEL[e.eventType]}`)

  const carriedOver = journal
    .filter((j) => j.entryType === 'follow_up' && !j.completed && j.dueDate !== '' && j.dueDate <= today)
    .map((j) => withName(j.clientId, j.content))

  const decisions = todayJournal.filter((j) => j.entryType === 'decision').map((j) => withName(j.clientId, j.content))
  const issues = todayJournal.filter((j) => j.entryType === 'blocker').map((j) => withName(j.clientId, j.content))
  for (const e of events) {
    if (e.status === 'new' && isToday(e.occurredAt)) issues.push(`새 고객 이벤트 — ${eventSummary(e).who}: ${eventSummary(e).what}`)
  }

  return {
    date: today,
    done: dedupe(done),
    remaining: dedupe(remaining),
    carriedOver: dedupe(carriedOver),
    decisions,
    issues: dedupe(issues),
    counts: {
      journal: todayJournal.length,
      activities: done.length,
      resolvedEvents: resolvedEvents.length,
      openCritical: openCritical.length,
      openEvents: openEvents.length,
    },
  }
}

function dedupe(list: string[]): string[] {
  return [...new Set(list)]
}

/** 요약을 복사·붙여넣기용 텍스트로 */
export function daySummaryText(s: DaySummary): string {
  const block = (title: string, items: string[]) =>
    items.length ? `${title}\n${items.map((i) => `- ${i}`).join('\n')}` : `${title}\n- 없음`
  return [
    `[${s.date} 하루 정리]`,
    block('오늘 처리', s.done),
    block('아직 남음', s.remaining),
    block('내일로 넘김', s.carriedOver),
    block('중요한 결정', s.decisions),
    block('새로운 이슈', s.issues),
  ].join('\n\n')
}

/* ------------------------------------------------------------------ */
/* 돈 · 자금 신호                                                         */
/* ------------------------------------------------------------------ */

export interface MoneySignals {
  /** 예정일이 있고 아직 안 온 돈 (금액 있는 것만 합산) */
  scheduled: { total: number; count: number }
  /** 예정일이 지난 돈 */
  overdue: { total: number; count: number; items: { clientId: string; clientName: string; label: string; amount: number | null; dueDate: string }[] }
  /** 금액이 비어 있어 합산에서 빠진 건수 */
  unknownAmount: number
}

export function buildMoneySignals(clients: ClientOpsRecord[], today: string): MoneySignals {
  const out: MoneySignals = { scheduled: { total: 0, count: 0 }, overdue: { total: 0, count: 0, items: [] }, unknownAmount: 0 }
  for (const c of clients) {
    if (c.archivedAt !== null) continue
    for (const f of c.fees) {
      if (f.receivedAt) continue
      if (f.amount === null) {
        out.unknownAmount += 1
        continue
      }
      if (f.dueDate && f.dueDate < today) {
        out.overdue.total += f.amount
        out.overdue.count += 1
        out.overdue.items.push({ clientId: c.id, clientName: c.companyName, label: f.label, amount: f.amount, dueDate: f.dueDate })
      } else {
        out.scheduled.total += f.amount
        out.scheduled.count += 1
      }
    }
  }
  out.overdue.items.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  return out
}

export interface FundingDeadline {
  clientId: string
  clientName: string
  programName: string
  institution: string
  applyDueDate: string
  daysLeft: number
  status: string
}

/** 앞으로 days 일 안(또는 지난) 지원사업 신청 마감 — 접수 전 건만 */
export function buildFundingDeadlines(clients: ClientOpsRecord[], today: string, days = 14): FundingDeadline[] {
  const out: FundingDeadline[] = []
  for (const c of clients) {
    if (c.archivedAt !== null) continue
    for (const a of c.fundingApplications) {
      if (!a.applyDueDate) continue
      if (a.status !== 'watching' && a.status !== 'preparing') continue
      const left = daysLeftFrom(today, a.applyDueDate)
      if (left === null || left > days) continue
      out.push({
        clientId: c.id,
        clientName: c.companyName,
        programName: a.programName || '이름 미정',
        institution: a.institution,
        applyDueDate: a.applyDueDate,
        daysLeft: left,
        status: a.status,
      })
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft)
}
