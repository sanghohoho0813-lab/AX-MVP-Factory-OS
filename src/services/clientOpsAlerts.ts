/**
 * 마감·누락 경고 엔진 (순수 함수).
 *
 * 목적: 여러 업체를 동시에 볼 때 "빠뜨린 것"이 반드시 눈에 띄게 한다.
 * 저장소·화면에 의존하지 않으므로 단위 테스트로 검증한다.
 *
 * 판정 대상
 *  1) 업무 마감 초과 · 임박
 *  2) 착수했는데 필요 서류가 없어 막힌 업무
 *  3) 서류 유효기간 만료 · 임박
 *  4) 받기로 한 날이 지난 미수금 · 임박
 *  5) 고객 회신 장기 대기
 *  6) 진행 중인데 다음 할 일이 비어 있음
 */

import type {
  AlertSeverity,
  ClientOpsRecord,
  DocumentKey,
  DocumentState,
  OpsAlert,
  ServiceKey,
} from '../types/clientOps'
import {
  DOCUMENTS,
  DOC_EXPIRING_DAYS,
  DUE_SOON_DAYS,
  SERVICES,
  SERVICE_STATUS_LABEL,
  WAITING_TOO_LONG_DAYS,
  documentMeta,
  isServiceOpen,
  isServiceStarted,
  serviceMeta,
} from '../content/clientOpsCatalog'
import { todayLocalDate } from '../lib/appClock'

/* ------------------------------------------------------------------ */
/* 날짜 유틸 (로컬 날짜 문자열 기준, 시간대 흔들림 없음)                 */
/* ------------------------------------------------------------------ */

/** 'YYYY-MM-DD' 를 UTC 자정 기준 숫자로 (일 단위 차이 계산용) */
function dateValue(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** from → to 까지 남은 일수. 음수면 이미 지남. 형식 오류면 null */
export function daysBetween(from: string, to: string): number | null {
  const a = dateValue(from)
  const b = dateValue(to)
  if (a === null || b === null) return null
  return Math.round((b - a) / 86_400_000)
}

/** 오늘 기준 남은 일수 */
export function daysLeftFrom(today: string, target: string): number | null {
  return daysBetween(today, target)
}

/** 발급일 + 유효개월 → 만료일 'YYYY-MM-DD' */
export function expiryDate(issuedAt: string, validMonths: number | null): string | null {
  if (validMonths === null) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(issuedAt.trim())
  if (!m) return null
  const y = Number(m[1])
  const mon = Number(m[2]) - 1
  const d = Number(m[3])
  // 월 이동 후 말일 보정 (예: 1/31 + 1개월 → 2/28)
  const target = new Date(Date.UTC(y, mon + validMonths, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  const yy = target.getUTCFullYear()
  const mm = String(target.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(target.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/** 남은 일수를 사람이 읽는 문구로 */
export function dueText(daysLeft: number | null): string {
  if (daysLeft === null) return '기한 미정'
  if (daysLeft < 0) return `${Math.abs(daysLeft)}일 지남`
  if (daysLeft === 0) return '오늘까지'
  if (daysLeft === 1) return '내일까지'
  return `${daysLeft}일 남음`
}

/* ------------------------------------------------------------------ */
/* 서류 상태                                                            */
/* ------------------------------------------------------------------ */

export interface DocumentStatusView {
  key: DocumentKey
  label: string
  received: boolean
  /** 계산된 만료일 (유효기간 없는 서류거나 발급일 미입력이면 null) */
  expiresOn: string | null
  daysLeft: number | null
  expired: boolean
  expiringSoon: boolean
  /** 지금 실제로 쓸 수 있는 서류인지 (받았고 만료되지 않음) */
  usable: boolean
}

export function documentStatus(
  key: DocumentKey,
  state: DocumentState,
  today: string,
): DocumentStatusView {
  const meta = documentMeta(key)
  const expiresOn = state.received ? expiryDate(state.issuedAt, meta.validMonths) : null
  const daysLeft = expiresOn ? daysLeftFrom(today, expiresOn) : null
  const expired = daysLeft !== null && daysLeft < 0
  const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= DOC_EXPIRING_DAYS
  return {
    key,
    label: meta.label,
    received: state.received,
    expiresOn,
    daysLeft,
    expired,
    expiringSoon,
    usable: state.received && !expired,
  }
}

/** 어떤 업무에 필요한 서류 중 지금 못 쓰는 것들 */
export function missingDocumentsFor(
  record: ClientOpsRecord,
  serviceKey: ServiceKey,
  today: string,
): DocumentStatusView[] {
  return serviceMeta(serviceKey)
    .requiredDocuments.map((key) => documentStatus(key, record.documents[key], today))
    .filter((view) => !view.usable)
}

/* ------------------------------------------------------------------ */
/* 진행률                                                               */
/* ------------------------------------------------------------------ */

export interface ClientOpsProgress {
  /** 해당 없음을 제외한 업무 중 완료 수 */
  servicesDone: number
  servicesTotal: number
  documentsUsable: number
  documentsTotal: number
  /** 미수금 합계(원) */
  unpaidAmount: number
  /** 예정일이 지난 미수금 건수 */
  overduePayments: number
  percent: number
}

export function clientOpsProgress(record: ClientOpsRecord, today: string): ClientOpsProgress {
  // 보류(예전 '해당 없음' 포함)는 진척률 분모에서 뺀다
  const applicable = SERVICES.filter(
    (s) => record.services[s.key].status !== 'on_hold',
  )
  const servicesDone = applicable.filter((s) => record.services[s.key].status === 'done').length
  const documentsUsable = DOCUMENTS.filter(
    (d) => documentStatus(d.key, record.documents[d.key], today).usable,
  ).length

  const unpaid = record.fees.filter((f) => f.receivedAt === null)
  const unpaidAmount = unpaid.reduce((sum, f) => sum + (f.amount ?? 0), 0)
  const overduePayments = unpaid.filter((f) => {
    const d = f.dueDate ? daysLeftFrom(today, f.dueDate) : null
    return d !== null && d < 0
  }).length

  const servicesTotal = applicable.length
  const documentsTotal = DOCUMENTS.length
  const denom = servicesTotal + documentsTotal
  const percent = denom === 0 ? 0 : Math.round(((servicesDone + documentsUsable) / denom) * 100)

  return {
    servicesDone,
    servicesTotal,
    documentsUsable,
    documentsTotal,
    unpaidAmount,
    overduePayments,
    percent,
  }
}

/* ------------------------------------------------------------------ */
/* 경고 생성                                                            */
/* ------------------------------------------------------------------ */

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

function push(list: OpsAlert[], alert: OpsAlert): void {
  list.push(alert)
}

/** 업체 한 곳의 경고 */
export function buildClientAlerts(record: ClientOpsRecord, today: string): OpsAlert[] {
  const out: OpsAlert[] = []
  const name = record.companyName

  for (const meta of SERVICES) {
    const state = record.services[meta.key]
    if (!isServiceOpen(state.status)) continue

    // 1) 마감 초과 · 임박
    if (state.dueDate) {
      const left = daysLeftFrom(today, state.dueDate)
      if (left !== null && left < 0) {
        push(out, {
          id: `${record.id}:${meta.key}:overdue`,
          clientId: record.id,
          clientName: name,
          kind: 'task_overdue',
          severity: 'critical',
          title: `${meta.label} 마감이 ${Math.abs(left)}일 지났습니다`,
          detail: state.nextStep || `현재 상태: ${SERVICE_STATUS_LABEL[state.status]}`,
          serviceKey: meta.key,
          dueDate: state.dueDate,
          daysLeft: left,
        })
      } else if (left !== null && left <= DUE_SOON_DAYS) {
        push(out, {
          id: `${record.id}:${meta.key}:duesoon`,
          clientId: record.id,
          clientName: name,
          kind: 'task_due_soon',
          severity: 'warning',
          title: `${meta.label} 마감 ${dueText(left)}`,
          detail: state.nextStep || `현재 상태: ${SERVICE_STATUS_LABEL[state.status]}`,
          serviceKey: meta.key,
          dueDate: state.dueDate,
          daysLeft: left,
        })
      }
    }

    // 2) 착수했는데 필요 서류가 없어 막힘
    if (isServiceStarted(state.status)) {
      const missing = missingDocumentsFor(record, meta.key, today)
      if (missing.length > 0) {
        const labels = missing.map((m) => (m.expired ? `${m.label}(만료)` : m.label))
        push(out, {
          id: `${record.id}:${meta.key}:blocked`,
          clientId: record.id,
          clientName: name,
          kind: 'blocked_missing_doc',
          severity: 'critical',
          title: `${meta.label}에 필요한 서류 ${missing.length}건이 없습니다`,
          detail: `필요: ${labels.join(', ')}`,
          serviceKey: meta.key,
          dueDate: state.dueDate,
          daysLeft: state.dueDate ? daysLeftFrom(today, state.dueDate) : null,
        })
      }
    }

    // 3) 고객 회신 장기 대기
    if (state.status === 'waiting_client' && state.waitingSince) {
      const waited = daysBetween(state.waitingSince.slice(0, 10), today)
      if (waited !== null && waited >= WAITING_TOO_LONG_DAYS) {
        push(out, {
          id: `${record.id}:${meta.key}:waiting`,
          clientId: record.id,
          clientName: name,
          kind: 'waiting_too_long',
          severity: 'warning',
          title: `${meta.label} — 고객 회신을 ${waited}일째 기다리는 중입니다`,
          detail: '다시 연락해 볼 시점입니다.',
          serviceKey: meta.key,
          dueDate: state.dueDate,
          daysLeft: state.dueDate ? daysLeftFrom(today, state.dueDate) : null,
        })
      }
    }

    // 4) 진행 중인데 다음 할 일이 비어 있음
    if (state.status === 'in_progress' && state.nextStep.trim() === '') {
      push(out, {
        id: `${record.id}:${meta.key}:nostep`,
        clientId: record.id,
        clientName: name,
        kind: 'no_next_step',
        severity: 'info',
        title: `${meta.label} — 다음에 할 일이 비어 있습니다`,
        detail: '무엇부터 할지 한 줄만 적어두면 다음에 헷갈리지 않습니다.',
        serviceKey: meta.key,
        dueDate: state.dueDate,
        daysLeft: state.dueDate ? daysLeftFrom(today, state.dueDate) : null,
      })
    }
  }

  // 5) 서류 유효기간
  for (const meta of DOCUMENTS) {
    const view = documentStatus(meta.key, record.documents[meta.key], today)
    if (!view.received || view.expiresOn === null) continue
    const needed = SERVICES.filter(
      (s) => s.requiredDocuments.includes(meta.key) && isServiceOpen(record.services[s.key].status),
    )
    if (view.expired) {
      push(out, {
        id: `${record.id}:${meta.key}:docexpired`,
        clientId: record.id,
        clientName: name,
        kind: 'doc_expired',
        severity: needed.length > 0 ? 'critical' : 'warning',
        title: `${meta.label} 유효기간이 지났습니다`,
        detail:
          needed.length > 0
            ? `${needed.map((s) => s.label).join(', ')} 진행에 필요합니다. 새로 발급받으세요.`
            : '새로 발급받아 두세요.',
        serviceKey: null,
        dueDate: view.expiresOn,
        daysLeft: view.daysLeft,
      })
    } else if (view.expiringSoon) {
      push(out, {
        id: `${record.id}:${meta.key}:docexpiring`,
        clientId: record.id,
        clientName: name,
        kind: 'doc_expiring',
        severity: 'warning',
        title: `${meta.label} 유효기간 ${dueText(view.daysLeft)}`,
        detail: '미리 새로 발급받아 두면 신청 때 막히지 않습니다.',
        serviceKey: null,
        dueDate: view.expiresOn,
        daysLeft: view.daysLeft,
      })
    }
  }

  // 6) 수금
  for (const fee of record.fees) {
    if (fee.receivedAt !== null || !fee.dueDate) continue
    const left = daysLeftFrom(today, fee.dueDate)
    if (left === null) continue
    if (left < 0) {
      push(out, {
        id: `${record.id}:fee:${fee.id}:overdue`,
        clientId: record.id,
        clientName: name,
        kind: 'payment_overdue',
        severity: 'critical',
        title: `${fee.label} 입금 예정일이 ${Math.abs(left)}일 지났습니다`,
        detail: fee.amount ? `${fee.amount.toLocaleString('ko-KR')}원 미입금` : '금액 미정',
        serviceKey: fee.serviceKey,
        dueDate: fee.dueDate,
        daysLeft: left,
      })
    } else if (left <= DUE_SOON_DAYS) {
      push(out, {
        id: `${record.id}:fee:${fee.id}:duesoon`,
        clientId: record.id,
        clientName: name,
        kind: 'payment_due_soon',
        severity: 'info',
        title: `${fee.label} 입금 예정 ${dueText(left)}`,
        detail: fee.amount ? `${fee.amount.toLocaleString('ko-KR')}원` : '금액 미정',
        serviceKey: fee.serviceKey,
        dueDate: fee.dueDate,
        daysLeft: left,
      })
    }
  }

  // 7) 정책자금 신청 마감
  for (const app of record.fundingApplications) {
    const open = app.status === 'watching' || app.status === 'preparing'
    if (!open || !app.applyDueDate) continue
    const left = daysLeftFrom(today, app.applyDueDate)
    if (left === null) continue
    const name = app.programName || '정책자금 공고'
    if (left < 0) {
      push(out, {
        id: `${record.id}:funding:${app.id}:overdue`,
        clientId: record.id,
        clientName: record.companyName,
        kind: 'funding_overdue',
        severity: 'critical',
        title: `${name} 신청 마감이 ${Math.abs(left)}일 지났습니다`,
        detail: app.institution ? `${app.institution} · 아직 접수하지 않았습니다` : '아직 접수하지 않았습니다',
        serviceKey: 'policyFund',
        dueDate: app.applyDueDate,
        daysLeft: left,
      })
    } else if (left <= DUE_SOON_DAYS) {
      push(out, {
        id: `${record.id}:funding:${app.id}:duesoon`,
        clientId: record.id,
        clientName: record.companyName,
        kind: 'funding_due_soon',
        severity: 'warning',
        title: `${name} 신청 마감 ${dueText(left)}`,
        detail: app.institution || '서류를 미리 준비하세요.',
        serviceKey: 'policyFund',
        dueDate: app.applyDueDate,
        daysLeft: left,
      })
    }
  }

  return out
}

/** 전 업체 통합 경고 — 급한 순으로 정렬 */
export function buildAllAlerts(
  records: ClientOpsRecord[],
  today: string = todayLocalDate(),
): OpsAlert[] {
  const all = records
    .filter((r) => r.status !== 'completed' && r.archivedAt === null)
    .flatMap((r) => buildClientAlerts(r, today))

  return all.sort((a, b) => {
    const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    if (s !== 0) return s
    // 날짜가 있는 항목이 먼저, 그중 더 급한(작은) 순
    if (a.daysLeft === null && b.daysLeft === null) return a.clientName.localeCompare(b.clientName)
    if (a.daysLeft === null) return 1
    if (b.daysLeft === null) return -1
    if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft
    return a.clientName.localeCompare(b.clientName)
  })
}

export interface AlertSummary {
  total: number
  critical: number
  warning: number
  info: number
  /** 업체별 심각 경고 수 */
  criticalByClient: Record<string, number>
}

export function summarizeAlerts(alerts: OpsAlert[]): AlertSummary {
  const criticalByClient: Record<string, number> = {}
  for (const a of alerts) {
    if (a.severity === 'critical') {
      criticalByClient[a.clientId] = (criticalByClient[a.clientId] ?? 0) + 1
    }
  }
  return {
    total: alerts.length,
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    info: alerts.filter((a) => a.severity === 'info').length,
    criticalByClient,
  }
}

/* ------------------------------------------------------------------ */
/* 업체 정렬 (급한 순)                                                  */
/* ------------------------------------------------------------------ */

/**
 * 급한 업체가 위로 오도록 정렬한다.
 * 1) 심각 경고 수 → 2) 전체 경고 수 → 3) 가장 급한 마감(작은 daysLeft) → 4) 이름
 */
export function sortClientsByUrgency(
  records: ClientOpsRecord[],
  today: string = todayLocalDate(),
): ClientOpsRecord[] {
  const score = new Map<string, { critical: number; total: number; soonest: number }>()
  for (const r of records) {
    const list = buildClientAlerts(r, today)
    const days = list.map((a) => a.daysLeft).filter((d): d is number => d !== null)
    score.set(r.id, {
      critical: list.filter((a) => a.severity === 'critical').length,
      total: list.length,
      soonest: days.length > 0 ? Math.min(...days) : Number.POSITIVE_INFINITY,
    })
  }
  const done = (r: ClientOpsRecord) => (r.status === 'completed' ? 1 : 0)
  return [...records].sort((a, b) => {
    if (done(a) !== done(b)) return done(a) - done(b)
    const sa = score.get(a.id)!
    const sb = score.get(b.id)!
    if (sa.critical !== sb.critical) return sb.critical - sa.critical
    if (sa.total !== sb.total) return sb.total - sa.total
    if (sa.soonest !== sb.soonest) return sa.soonest - sb.soonest
    return a.companyName.localeCompare(b.companyName)
  })
}
