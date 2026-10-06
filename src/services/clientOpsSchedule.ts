/**
 * 일정 수집 — 전 업체의 모든 기한을 한 목록으로 모은다 (순수 함수).
 *
 * 모으는 것: 업무 마감 · 정책자금 신청 마감 · 수금 예정일 · 서류 유효기간 만료일 · 다음 약속(D-120).
 * 달력·오늘 화면이 이 결과만 사용한다.
 */

import type { ClientOpsRecord, ServiceKey } from '../types/clientOps'
import {
  SERVICES,
  SERVICE_STATUS_LABEL,
  isServiceOpen,
} from '../content/clientOpsCatalog'
import { documentsWithExpiry, daysLeftFrom } from './clientOpsAlerts'
import { todayLocalDate } from '../lib/appClock'
import { applyDocViews } from './grants/grantApply'

export type ScheduleKind = 'next' | 'task' | 'funding' | 'payment' | 'document' | 'tool'

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
  /** D-138: 지나면 신청할 수 없는 기한(도구 기한 중) */
  hard?: boolean
}

export const SCHEDULE_KIND_LABEL: Record<ScheduleKind, string> = {
  next: '다음 약속',
  task: '업무 마감',
  funding: '자금 · 지원사업 신청',
  payment: '수금 예정',
  document: '서류 만료',
  tool: '도구 기한',
}

/** 종류별 색 (달력 점·칩) */
/**
 * 일정 종류 표시.
 *
 * 종류는 작은 점 하나로만 구분한다. 칸 전체를 종류색으로 칠하면 달력이
 * 색 모자이크가 되어 정작 '오늘 뭐가 있나' 가 보이지 않는다.
 */
export const SCHEDULE_KIND_CLASS: Record<ScheduleKind, { dot: string; chip: string; cell: string; bar: string }> = {
  // cell · bar (D-156): PC 달력 칸의 한 줄 · 그날 목록 왼쪽 띠 — 대표 요청 '색을 입혀 눈에 들어오게'. 옅은 바탕 + 진한 글씨로 글은 읽히게
  next: { dot: 'bg-brand-600', chip: 'border-brand-200 bg-brand-50 text-brand-800', cell: 'border-brand-200 bg-brand-50 text-brand-800', bar: 'border-l-brand-600' },
  task: { dot: 'bg-cat-plan-500', chip: 'border-slate-200 bg-white text-slate-600', cell: 'border-cat-plan-200 bg-cat-plan-50 text-cat-plan-700', bar: 'border-l-cat-plan-500' },
  funding: { dot: 'bg-cat-fund-500', chip: 'border-slate-200 bg-white text-slate-600', cell: 'border-cat-fund-200 bg-cat-fund-50 text-cat-fund-700', bar: 'border-l-cat-fund-500' },
  payment: { dot: 'bg-cat-money-500', chip: 'border-slate-200 bg-white text-slate-600', cell: 'border-cat-money-200 bg-cat-money-50 text-cat-money-700', bar: 'border-l-cat-money-500' },
  document: { dot: 'bg-cat-doc-500', chip: 'border-slate-200 bg-white text-slate-600', cell: 'border-cat-doc-200 bg-cat-doc-50 text-cat-doc-700', bar: 'border-l-cat-doc-500' },
  tool: { dot: 'bg-cat-client-500', chip: 'border-slate-200 bg-white text-slate-600', cell: 'border-cat-client-200 bg-cat-client-50 text-cat-client-700', bar: 'border-l-cat-client-500' },
}

/** 한 업체의 일정 */
export function buildClientSchedule(record: ClientOpsRecord, today: string): ScheduleEvent[] {
  if (record.archivedAt !== null) return []
  const out: ScheduleEvent[] = []
  const name = record.companyName || '(이름 없음)'

  // 다음 약속 (D-120) — 1차 미팅 · 자료 받기 · 견적 회신 … 지나도 '끝남' 이 아니다(바꿀 때까지 남는다)
  if (record.nextActionDueDate) {
    out.push({
      id: `${record.id}:next`,
      date: record.nextActionDueDate,
      kind: 'next',
      clientId: record.id,
      clientName: name,
      title: record.nextAction || '다음 할 일',
      detail: '다음 약속',
      serviceKey: null,
      done: false,
      daysLeft: daysLeftFrom(today, record.nextActionDueDate),
    })
  }

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
      detail: fundingDetail(record, app, today, open),
      serviceKey: 'policyFund',
      done: !open,
      daysLeft: daysLeftFrom(today, app.applyDueDate),
    })
  }

  // D-152: 접수한 신청의 결과 발표 예정일 — 지나면 '결과 적기' 를 챙기게 남는다
  for (const app of record.fundingApplications) {
    if (!app.resultDueDate || !(app.status === 'submitted' || app.status === 'reviewing')) continue
    out.push({
      id: `${record.id}:funding-result:${app.id}`,
      date: app.resultDueDate,
      kind: 'funding',
      clientId: record.id,
      clientName: name,
      title: `결과 발표 — ${app.programName || '지원사업'}`,
      detail: app.institution || '',
      serviceKey: 'policyFund',
      done: false,
      daysLeft: daysLeftFrom(today, app.resultDueDate),
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
  // D-148: 직접 만든 칸(법인인감증명서 · 납세증명서 …)도 달력 · 오늘에
  for (const { meta, view } of documentsWithExpiry(record, today)) {
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

  // 도구가 계산한 기한 (D-89) — 고용지원금 회차 신청일 · 연구소 사후관리 기한 …
  for (const result of record.toolResults) {
    for (const [i, d] of result.deadlines.entries()) {
      out.push({
        id: `${record.id}:tool:${result.id}:${i}`,
        date: d.date,
        kind: 'tool',
        clientId: record.id,
        clientName: name,
        title: d.title,
        detail: d.note || result.title,
        serviceKey: null,
        done: d.date < today,
        daysLeft: daysLeftFrom(today, d.date),
        ...(d.hard ? { hard: true } : {}),
      })
    }
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

/** D-151: 신청 준비 건은 '서류 3/6 · 18:00 마감' 을 함께 — 오늘 · 달력에서 무엇이 모자란지 바로 보이게 */
function fundingDetail(record: ClientOpsRecord, app: ClientOpsRecord['fundingApplications'][number], today: string, open: boolean): string {
  const parts = [app.institution || '']
  if (open && app.docs?.length) {
    const views = applyDocViews(record, app, today)
    const ready = views.filter((v) => v.state === 'ok' || v.state === 'manual_done').length
    parts.push(ready === views.length ? '서류 다 모음' : `서류 ${ready}/${views.length}`)
  }
  if (app.applyDueTime) parts.push(`${app.applyDueTime} 마감`)
  return parts.filter(Boolean).join(' · ')
}
