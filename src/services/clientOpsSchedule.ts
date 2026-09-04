/**
 * 일정 수집 — 전 업체의 모든 기한을 한 목록으로 모은다 (순수 함수).
 *
 * 모으는 것: 업무 마감 · 정책자금 신청 마감 · 수금 예정일 · 서류 유효기간 만료일.
 * 달력·오늘 화면이 이 결과만 사용한다.
 */

import type { ClientOpsRecord, ServiceKey } from '../types/clientOps'
import {
  DOCUMENTS,
  SERVICES,
  SERVICE_STATUS_LABEL,
  isServiceOpen,
} from '../content/clientOpsCatalog'
import { documentStatus, daysLeftFrom } from './clientOpsAlerts'
import { todayLocalDate } from '../lib/appClock'

export type ScheduleKind = 'task' | 'funding' | 'payment' | 'document'

export interface ScheduleEvent {
  id: string
  /** YYYY-MM-DD */
  date: string
  kind: ScheduleKind
  clientId: string
  clientName: string
  title: string
  detail: string
  serviceKey: ServiceKey | null
  /** 이미 처리된 건인지 (지난 일정 회색 표시) */
  done: boolean
  /** 오늘 기준 남은 일수 */
  daysLeft: number | null
}

export const SCHEDULE_KIND_LABEL: Record<ScheduleKind, string> = {
  task: '업무 마감',
  funding: '정책자금 신청',
  payment: '수금 예정',
  document: '서류 만료',
}

/** 종류별 색 (달력 점·칩) */
/**
 * 일정 종류 표시.
 *
 * 종류는 작은 점 하나로만 구분한다. 칸 전체를 종류색으로 칠하면 달력이
 * 색 모자이크가 되어 정작 '오늘 뭐가 있나' 가 보이지 않는다.
 */
export const SCHEDULE_KIND_CLASS: Record<ScheduleKind, { dot: string; chip: string }> = {
  task: { dot: 'bg-cat-plan-500', chip: 'border-slate-200 bg-white text-slate-600' },
  funding: { dot: 'bg-cat-fund-500', chip: 'border-slate-200 bg-white text-slate-600' },
  payment: { dot: 'bg-cat-money-500', chip: 'border-slate-200 bg-white text-slate-600' },
  document: { dot: 'bg-cat-doc-500', chip: 'border-slate-200 bg-white text-slate-600' },
}

/** 한 업체의 일정 */
export function buildClientSchedule(record: ClientOpsRecord, today: string): ScheduleEvent[] {
  if (record.archivedAt !== null) return []
  const out: ScheduleEvent[] = []
  const name = record.companyName || '(이름 없음)'

  // 업무 마감
  for (const meta of SERVICES) {
    const st = record.services[meta.key]
    if (!st.dueDate) continue
    const open = isServiceOpen(st.status)
    out.push({
      id: `${record.id}:task:${meta.key}`,
      date: st.dueDate,
      kind: 'task',
      clientId: record.id,
      clientName: name,
      title: meta.label,
      detail: st.nextStep || SERVICE_STATUS_LABEL[st.status],
      serviceKey: meta.key,
      done: !open,
      daysLeft: daysLeftFrom(today, st.dueDate),
    })
  }

  // 정책자금 신청 마감
  for (const app of record.fundingApplications) {
    if (!app.applyDueDate) continue
    const open = app.status === 'watching' || app.status === 'preparing'
    out.push({
      id: `${record.id}:funding:${app.id}`,
      date: app.applyDueDate,
      kind: 'funding',
      clientId: record.id,
      clientName: name,
      title: app.programName || '정책자금 신청',
      detail: app.institution || '',
      serviceKey: 'policyFund',
      done: !open,
      daysLeft: daysLeftFrom(today, app.applyDueDate),
    })
  }

  // 수금 예정
  for (const fee of record.fees) {
    if (!fee.dueDate) continue
    out.push({
      id: `${record.id}:fee:${fee.id}`,
      date: fee.dueDate,
      kind: 'payment',
      clientId: record.id,
      clientName: name,
      title: fee.label,
      detail: fee.amount ? `${fee.amount.toLocaleString('ko-KR')}원` : '금액 미정',
      serviceKey: fee.serviceKey,
      done: fee.receivedAt !== null,
      daysLeft: daysLeftFrom(today, fee.dueDate),
    })
  }

  // 서류 만료
  for (const meta of DOCUMENTS) {
    const view = documentStatus(meta.key, record.documents[meta.key], today)
    if (!view.received || view.expiresOn === null) continue
    out.push({
      id: `${record.id}:doc:${meta.key}`,
      date: view.expiresOn,
      kind: 'document',
      clientId: record.id,
      clientName: name,
      title: `${meta.label} 만료`,
      detail: '새로 발급받아야 합니다',
      serviceKey: null,
      done: false,
      daysLeft: view.daysLeft,
    })
  }

  return out
}

/** 전 업체 일정 (날짜순) */
export function buildAllSchedule(
  records: ClientOpsRecord[],
  today: string = todayLocalDate(),
): ScheduleEvent[] {
  return records
    .flatMap((r) => buildClientSchedule(r, today))
    .sort((a, b) => (a.date === b.date ? a.clientName.localeCompare(b.clientName) : a.date.localeCompare(b.date)))
}

/** 날짜별로 묶는다 */
export function groupByDate(events: ScheduleEvent[]): Map<string, ScheduleEvent[]> {
  const map = new Map<string, ScheduleEvent[]>()
  for (const e of events) {
    const list = map.get(e.date)
    if (list) list.push(e)
    else map.set(e.date, [e])
  }
  return map
}

/** 달력 격자 — 해당 월을 감싸는 6주(일요일 시작) */
export function monthGrid(year: number, month1to12: number): string[] {
  const first = new Date(Date.UTC(year, month1to12 - 1, 1))
  const start = new Date(first)
  start.setUTCDate(1 - first.getUTCDay())
  const days: string[] = []
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    days.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
    )
  }
  return days
}

/** 이번 주(오늘 포함 7일) 안에 처리해야 할 일정 */
export function upcomingWithin(events: ScheduleEvent[], days: number): ScheduleEvent[] {
  return events.filter((e) => !e.done && e.daysLeft !== null && e.daysLeft >= 0 && e.daysLeft <= days)
}

/** 이미 지났는데 아직 안 끝난 일정 */
export function overdueEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  return events.filter((e) => !e.done && e.daysLeft !== null && e.daysLeft < 0)
}

export function shiftMonth(year: number, month1to12: number, delta: number): [number, number] {
  const m = month1to12 - 1 + delta
  return [year + Math.floor(m / 12), ((m % 12) + 12) % 12 + 1]
}
