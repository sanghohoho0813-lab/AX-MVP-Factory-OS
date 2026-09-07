/**
 * 성과 지표(Money KPI) — 이미 쌓인 기록에서만 계산한다.
 *
 * 규격(v3.0 §4·§7·§8)의 요구는 두 가지다.
 *   1) 비용·매출·규모 지표를 정의하고 측정 지점을 둔다 (PREPARE NOW)
 *   2) 실제 값이 없으면 숫자를 지어내지 않는다 (BASELINE UNKNOWN)
 *
 * 그래서 이 파일은 새 표를 만들지 않는다. 수금(fees)·업무(services)·자금 신청·
 * 활동 기록·업무 일기처럼 대표가 이미 남기고 있는 기록에서 거꾸로 계산한다.
 * 근거 건수가 적으면 '기준선 만드는 중' 으로 표시하고, 아예 잴 수 없는 것은
 * '측정 방법만 정함' 으로 둔다. 목표치는 어디에도 없다.
 */

import { contractStageOf } from '../types/clientOps'
import type { ClientOpsRecord } from '../types/clientOps'
import type { CustomerEvent, JournalEntry } from '../types/bridge'
import { SERVICES, isServiceStarted } from '../content/clientOpsCatalog'
import { daysLeftFrom } from './clientOpsAlerts'
import { formatKrw } from '../lib/format'

export type KpiGroup = 'cost' | 'revenue' | 'scale' | 'adoption'

/**
 * measured          근거가 충분해 값을 믿을 수 있다
 * baseline_forming  값은 있지만 근거 건수가 적다 — 기준선을 만드는 중
 * unknown           아직 잴 수 없다 — 측정 방법만 정해 두었다
 */
export type KpiStatus = 'measured' | 'baseline_forming' | 'unknown'

export interface KpiMetric {
  key: string
  group: KpiGroup
  /** 쉬운 이름 */
  label: string
  /** 화면에 그대로 쓸 값. 잴 수 없으면 null */
  value: string | null
  /** 이 값의 근거가 된 건수 */
  basis: number
  status: KpiStatus
  /** 어디서 어떻게 재는지 — 숫자보다 이것이 먼저다 */
  method: string
  /** 값을 읽을 때 조심할 점 */
  caution?: string
}

export const KPI_GROUP_LABEL: Record<KpiGroup, string> = {
  cost: '비용 · 시간',
  revenue: '매출 · 돈',
  scale: '규모',
  adoption: '실제 사용',
}

export const KPI_STATUS_LABEL: Record<KpiStatus, string> = {
  measured: '측정 중',
  baseline_forming: '기준선 만드는 중',
  unknown: '측정 방법만 정함',
}

/** 이 건수 미만이면 기준선으로 삼지 않는다 */
export const MIN_BASIS = 5

function statusFor(basis: number): KpiStatus {
  if (basis === 0) return 'unknown'
  return basis < MIN_BASIS ? 'baseline_forming' : 'measured'
}

function shiftDate(day: string, offset: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() + offset)
  return t.toISOString().slice(0, 10)
}

/** ISO 시각 → YYYY-MM-DD (로컬이 아니라 저장된 UTC 기준. 날짜 단위 집계라 충분하다) */
function dayOf(iso: string): string {
  return iso.slice(0, 10)
}

export interface KpiInput {
  records: ClientOpsRecord[]
  journal: JournalEntry[]
  events: CustomerEvent[]
  today: string
}

/* ------------------------------------------------------------------ */
/* 비용 · 시간                                                          */
/* ------------------------------------------------------------------ */

function costMetrics(input: KpiInput): KpiMetric[] {
  const live = input.records.filter((r) => r.archivedAt === null)

  // 다시 요청하지 않고 한 번에 받은 서류 비율은 지금 구조로는 알 수 없다.
  // 서류 요청 문구를 만든 횟수를 기록하지 않기 때문이다. 방법만 적어 둔다.
  const firstAction: KpiMetric = {
    key: 'first_action_minutes',
    group: 'cost',
    label: '앱을 열고 첫 행동까지 걸리는 시간',
    value: null,
    basis: 0,
    status: 'unknown',
    method:
      '오늘 화면이 열린 시각과 첫 클릭(업체 열기·기록·처리) 시각의 차이. 아직 재지 않는다 — 재기 시작하면 여기에 분 단위로 나온다.',
    caution: '"오늘 뭐부터 하지" 를 머릿속에서 조합하던 시간을 대신 재는 값이다.',
  }

  // 마감을 넘긴 업무 — 지금 이 순간의 건수. 시간 누수의 결과 지표.
  let overdueTasks = 0
  let openTasks = 0
  for (const r of live) {
    for (const s of SERVICES) {
      const st = r.services[s.key]
      if (!st || !isServiceStarted(st.status)) continue
      openTasks += 1
      if (st.dueDate) {
        const left = daysLeftFrom(input.today, st.dueDate)
        if (left !== null && left < 0) overdueTasks += 1
      }
    }
  }
  const overdue: KpiMetric = {
    key: 'overdue_tasks_now',
    group: 'cost',
    label: '마감을 넘긴 진행 업무',
    value: openTasks === 0 ? null : `${overdueTasks}건 / 진행 ${openTasks}건`,
    basis: openTasks,
    status: statusFor(openTasks),
    method: '진행 중·고객 대기 상태이면서 마감일이 오늘보다 앞선 업무를 센다. 매일 같은 시각에 보면 추이가 된다.',
  }

  return [firstAction, overdue]
}

/* ------------------------------------------------------------------ */
/* 매출 · 돈                                                            */
/* ------------------------------------------------------------------ */

function revenueMetrics(input: KpiInput): KpiMetric[] {
  const live = input.records.filter((r) => r.archivedAt === null)
  const fees = live.flatMap((r) => r.fees)

  // 지금 못 받은 돈 중 예정일이 지난 것
  const unpaid = fees.filter((f) => f.receivedAt === null)
  const overdue = unpaid.filter((f) => {
    if (!f.dueDate) return false
    const left = daysLeftFrom(input.today, f.dueDate)
    return left !== null && left < 0
  })
  const overdueAmount = overdue.reduce((s, f) => s + (f.amount ?? 0), 0)
  const overdueNow: KpiMetric = {
    key: 'overdue_receivables_now',
    group: 'revenue',
    label: '예정일이 지난 미수금',
    value: unpaid.length === 0 ? null : `${overdue.length}건 · ${formatKrw(overdueAmount)}`,
    basis: unpaid.length,
    status: statusFor(unpaid.length),
    method: '받기로 한 날이 지났는데 입금 확인이 안 된 수금 항목. 금액이 비어 있는 항목은 건수에만 들어간다.',
  }

  // 회수 지연 — 실제로 받은 돈이 예정일보다 며칠 늦게 들어왔는가
  const settled = fees.filter((f) => f.receivedAt !== null && f.dueDate)
  const delays = settled.map((f) => {
    const d = daysLeftFrom(f.dueDate, f.receivedAt as string)
    return d ?? 0
  })
  const avgDelay = delays.length === 0 ? 0 : delays.reduce((a, b) => a + b, 0) / delays.length
  const onTime = delays.filter((d) => d <= 0).length
  const collectionDelay: KpiMetric = {
    key: 'collection_delay_days',
    group: 'revenue',
    label: '수금 지연 일수 (평균)',
    value:
      settled.length === 0
        ? null
        : `${avgDelay <= 0 ? '예정일 안에' : `${Math.round(avgDelay)}일 늦게`} · 제때 ${onTime}/${settled.length}건`,
    basis: settled.length,
    status: statusFor(settled.length),
    method: '입금 확인일 − 받기로 한 날. 예정일과 입금일이 모두 적힌 항목만 센다.',
    caution: '예정일을 적지 않은 수금은 계산에서 빠진다. 예정일을 적을수록 정확해진다.',
  }

  // 자금 신청 마감 누락 — 마감이 지났는데 접수하지 않은 건
  const apps = live.flatMap((r) => r.fundingApplications)
  const missed = apps.filter((a) => {
    if (!a.applyDueDate) return false
    if (a.status !== 'watching' && a.status !== 'preparing') return false
    const left = daysLeftFrom(input.today, a.applyDueDate)
    return left !== null && left < 0
  })
  const withDue = apps.filter((a) => a.applyDueDate)
  const fundingMissed: KpiMetric = {
    key: 'funding_deadlines_missed',
    group: 'revenue',
    label: '마감을 놓친 자금 신청',
    value: withDue.length === 0 ? null : `${missed.length}건 / 마감 있는 신청 ${withDue.length}건`,
    basis: withDue.length,
    status: statusFor(withDue.length),
    method: '신청 마감일이 지났는데 아직 "공고 확인 중" 또는 "서류 준비 중" 인 건.',
  }

  return [overdueNow, collectionDelay, fundingMissed]
}

/* ------------------------------------------------------------------ */
/* 규모                                                                 */
/* ------------------------------------------------------------------ */

function scaleMetrics(input: KpiInput): KpiMetric[] {
  const live = input.records.filter((r) => r.archivedAt === null)
  // 계약 종료만 뺀다 — 계약 전 업체도 관리 대상이다
  const active = live.filter((r) => contractStageOf(r.status) !== 'closed')

  let openServices = 0
  for (const r of active) {
    for (const s of SERVICES) {
      const st = r.services[s.key]
      if (st && isServiceStarted(st.status)) openServices += 1
    }
  }

  const clients: KpiMetric = {
    key: 'active_clients',
    group: 'scale',
    label: '동시에 관리 중인 업체',
    value: `${active.length}곳`,
    basis: active.length,
    status: active.length === 0 ? 'unknown' : 'measured',
    method: '보관하지 않은 업체 중 상태가 진행 중·고객 대기인 곳. 대표 한 사람이 몇 곳을 동시에 돌리는지가 규모 지표다.',
  }

  const perClient: KpiMetric = {
    key: 'open_services_per_client',
    group: 'scale',
    label: '업체당 진행 중 업무',
    value: active.length === 0 ? null : `${(openServices / active.length).toFixed(1)}건 · 전체 ${openServices}건`,
    basis: openServices,
    status: statusFor(openServices),
    method: '진행 중·고객 대기 상태 업무 수 ÷ 관리 중 업체 수.',
  }

  return [clients, perClient]
}

/* ------------------------------------------------------------------ */
/* 실제 사용                                                            */
/* ------------------------------------------------------------------ */

function adoptionMetrics(input: KpiInput): KpiMetric[] {
  const since30 = shiftDate(input.today, -29)
  const since7 = shiftDate(input.today, -6)

  // 기록을 남긴 날 — 일기와 활동 기록의 날짜를 합친다
  const days = new Set<string>()
  for (const j of input.journal) {
    if (j.entryDate >= since30 && j.entryDate <= input.today) days.add(j.entryDate)
  }
  for (const r of input.records) {
    for (const a of r.activity) {
      const d = dayOf(a.at)
      if (d >= since30 && d <= input.today) days.add(d)
    }
  }
  const activeDays: KpiMetric = {
    key: 'active_days_30',
    group: 'adoption',
    label: '최근 30일 중 기록을 남긴 날',
    value: days.size === 0 ? null : `${days.size}일 / 30일`,
    basis: days.size,
    status: statusFor(days.size),
    method: '업무 일기를 쓰거나 업체 상태를 바꾼 날을 센다. 매일 쓰는지가 이 시스템이 자리 잡았는지의 첫 신호다.',
  }

  const journal7 = input.journal.filter((j) => j.entryDate >= since7 && j.entryDate <= input.today).length
  const journalWeek: KpiMetric = {
    key: 'journal_entries_7',
    group: 'adoption',
    label: '최근 7일 업무 일기',
    value: journal7 === 0 ? null : `${journal7}건`,
    basis: journal7,
    status: statusFor(journal7),
    method: '최근 7일 동안 남긴 통화·결정·후속조치·메모 건수.',
  }

  // 고객이 플랫폼에서 한 행동 중 내부에서 처리한 비율
  const recent = input.events.filter((e) => dayOf(e.occurredAt) >= since30)
  const handled = recent.filter((e) => e.status === 'resolved' || e.status === 'in_progress' || e.status === 'linked')
  const eventsHandled: KpiMetric = {
    key: 'events_handled_30',
    group: 'adoption',
    label: '최근 30일 고객 이벤트 처리',
    value: recent.length === 0 ? null : `${handled.length} / ${recent.length}건`,
    basis: recent.length,
    status: statusFor(recent.length),
    method: '고객 플랫폼에서 들어온 요청·서류·주문 중 연결·확인·처리 완료로 넘어간 비율.',
    caution: '고객이 플랫폼을 쓰지 않으면 0건이다. 이 값이 늘어야 고객 셀프서비스가 자리 잡은 것이다.',
  }

  return [activeDays, journalWeek, eventsHandled]
}

/* ------------------------------------------------------------------ */
/* 전체                                                                 */
/* ------------------------------------------------------------------ */

export function buildKpis(input: KpiInput): KpiMetric[] {
  return [...costMetrics(input), ...revenueMetrics(input), ...scaleMetrics(input), ...adoptionMetrics(input)]
}

export function kpisByGroup(metrics: KpiMetric[]): { group: KpiGroup; items: KpiMetric[] }[] {
  const order: KpiGroup[] = ['cost', 'revenue', 'scale', 'adoption']
  return order.map((group) => ({ group, items: metrics.filter((m) => m.group === group) }))
}

/** 한 줄 요약 — "측정 중 3 · 기준선 만드는 중 2 · 방법만 정함 1" */
export function kpiStatusSummary(metrics: KpiMetric[]): Record<KpiStatus, number> {
  const out: Record<KpiStatus, number> = { measured: 0, baseline_forming: 0, unknown: 0 }
  for (const m of metrics) out[m.status] += 1
  return out
}
