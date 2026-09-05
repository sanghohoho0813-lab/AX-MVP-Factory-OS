import type { ReactNode } from 'react'
import type { Tone } from '../ui/primitives'
import {
  AlertTriangle,
  Check,
  CircleDashed,
  Clock,
  FileWarning,
  Info,
  Landmark,
  Lock,
  Pause,
  Wallet,
} from 'lucide-react'
import type {
  AlertKind,
  AlertSeverity,
  ClientOpsRecord,
  ClientOpsStatus,
  OpsAlert,
  ServiceKey,
  ServiceStatus,
} from '../../types/clientOps'
import {
  SERVICE_STATUS_LABEL,
  isServiceOpen,
  isServiceStarted,
  serviceMeta,
} from '../../content/clientOpsCatalog'
import { dueText, missingDocumentsFor } from '../../services/clientOpsAlerts'

/* ------------------------------------------------------------------ */
/* 심각도                                                               */
/* ------------------------------------------------------------------ */

export const SEVERITY_META: Record<
  AlertSeverity,
  { label: string; icon: typeof AlertTriangle; box: string; chip: string }
> = {
  critical: {
    label: '지금 처리',
    icon: AlertTriangle,
    box: 'border-danger-200 bg-danger-50/70',
    chip: 'bg-danger-100 text-danger-700 border-danger-200',
  },
  warning: {
    label: '곧 처리',
    icon: Clock,
    box: 'border-warning-200 bg-warning-50/70',
    chip: 'bg-warning-100 text-warning-800 border-warning-200',
  },
  info: {
    label: '참고',
    icon: Info,
    box: 'border-slate-200 bg-slate-50',
    chip: 'bg-slate-100 text-slate-600 border-slate-200',
  },
}

const ALERT_KIND_LABEL: Record<AlertKind, string> = {
  task_overdue: '마감 지남',
  task_due_soon: '마감 임박',
  blocked_missing_doc: '서류 없음',
  doc_expired: '서류 만료',
  doc_expiring: '만료 임박',
  payment_overdue: '수금 연체',
  payment_due_soon: '수금 예정',
  waiting_too_long: '회신 지연',
  no_next_step: '할 일 미정',
  funding_due_soon: '신청 마감 임박',
  funding_overdue: '신청 마감 지남',
}

const ALERT_KIND_ICON: Record<AlertKind, typeof AlertTriangle> = {
  task_overdue: AlertTriangle,
  task_due_soon: Clock,
  blocked_missing_doc: Lock,
  doc_expired: FileWarning,
  doc_expiring: FileWarning,
  payment_overdue: Wallet,
  payment_due_soon: Wallet,
  waiting_too_long: Clock,
  no_next_step: CircleDashed,
  funding_due_soon: Landmark,
  funding_overdue: Landmark,
}

/**
 * 경고 한 줄.
 *
 * 배경을 빨갛게 칠하지 않는다 — 급한 일이 다섯 건만 돼도 화면 전체가 빨개져서
 * 오히려 무엇이 더 급한지 알 수 없다. 왼쪽 3px 선과 남은 날짜 하나로만 말한다.
 * 업체 화면 안에서는 업체명을 다시 쓰지 않는다(이미 위에 있다).
 */
export function AlertRow({
  alert,
  onOpen,
  hideClient = false,
}: {
  alert: OpsAlert
  onOpen: (a: OpsAlert) => void
  hideClient?: boolean
}) {
  const Icon = ALERT_KIND_ICON[alert.kind]
  const tone: Tone = alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'neutral'
  const edge = tone === 'danger' ? 'bg-danger-500' : tone === 'warning' ? 'bg-warning-500' : 'bg-slate-200'
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(alert)}
        title={`${ALERT_KIND_LABEL[alert.kind]} · ${alert.clientName}`}
        className="tap relative flex w-full items-start gap-3 overflow-hidden rounded-(--radius-card) border border-slate-200 bg-white py-3 pr-3 pl-4 text-left hover:bg-slate-50"
      >
        <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] ${edge}`} />
        <Icon
          aria-hidden="true"
          className={`mt-0.5 size-4 shrink-0 ${
            tone === 'danger' ? 'text-danger-500' : tone === 'warning' ? 'text-warning-500' : 'text-slate-400'
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className="t-card block break-keep text-slate-900">{alert.title}</span>
          <span className="t-sub mt-0.5 block break-keep text-slate-500">
            {!hideClient && <span className="font-medium text-slate-600">{alert.clientName}</span>}
            {!hideClient && (alert.detail || alert.daysLeft !== null) && ' · '}
            {alert.detail}
          </span>
        </span>
        {alert.daysLeft !== null && (
          <span
            className={`t-meta shrink-0 font-semibold whitespace-nowrap ${
              tone === 'danger' ? 'text-danger-700' : tone === 'warning' ? 'text-warning-700' : 'text-slate-500'
            }`}
          >
            {dueText(alert.daysLeft)}
          </span>
        )}
      </button>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* 업무 상태 표시                                                       */
/* ------------------------------------------------------------------ */

interface CellLook {
  icon: typeof Check
  cls: string
  /** 배경 없이 글자만 쓸 때의 색 */
  text: string
  short: string
}

/**
 * 상태 → 색.
 *
 * 색은 의미가 있을 때만 쓴다.
 *   초록  완료      · 주황  고객 대기(내가 아니라 상대를 기다리는 중)
 *   브랜드 진행 중  · 무채색 시작 전 / 보류
 * 마감 지남·서류 없음(빨강)은 상태가 아니라 사정이므로 아래 cell 계산에서 덮어쓴다.
 */
export function statusTone(status: ServiceStatus): Tone {
  switch (status) {
    case 'done': return 'success'
    case 'in_progress': return 'brand'
    case 'waiting_client': return 'warning'
    default: return 'neutral'
  }
}

const STATUS_LOOK: Record<ServiceStatus, CellLook> = {
  done: { icon: Check, cls: 'bg-success-50 text-success-700 border-success-200', text: 'text-success-700', short: '완료' },
  in_progress: { icon: Clock, cls: 'bg-brand-50 text-brand-700 border-brand-200', text: 'text-brand-700', short: '진행' },
  waiting_client: { icon: Clock, cls: 'bg-warning-50 text-warning-800 border-warning-200', text: 'text-warning-700', short: '대기' },
  on_hold: { icon: Pause, cls: 'bg-slate-100 text-slate-500 border-slate-200', text: 'text-slate-400', short: '보류' },
  not_started: { icon: CircleDashed, cls: 'bg-white text-slate-500 border-slate-200', text: 'text-slate-500', short: '시작 전' },
}

export interface CellState {
  status: ServiceStatus
  /** 마감 초과 여부 */
  overdue: boolean
  /** 마감 임박 여부 */
  dueSoon: boolean
  /** 필요 서류가 없어 막혔는지 */
  blocked: boolean
  daysLeft: number | null
}

/** 현황표 한 칸 — 색만이 아니라 글자로도 상태를 알려준다 */
export function ServiceCell({
  cell,
  onClick,
  label,
}: {
  cell: CellState
  onClick: () => void
  label: string
}) {
  const look = STATUS_LOOK[cell.status]
  const Icon = cell.blocked ? Lock : look.icon
  const danger = cell.overdue || cell.blocked
  // 칸 전체를 색으로 칠하지 않는다 — 표가 넓어지면 색면끼리 싸운다.
  // 급한 칸(빨강·주황)만 옅게 칠하고 나머지는 흰 바탕에 글자로 말한다.
  const cls = danger
    ? 'bg-danger-50 text-danger-700 border-danger-200'
    : cell.dueSoon
      ? 'bg-warning-50 text-warning-800 border-warning-200'
      : `bg-white border-slate-200 ${look.text}`

  const note = cell.blocked
    ? '서류 없음'
    : cell.overdue
      ? dueText(cell.daysLeft)
      : cell.dueSoon
        ? dueText(cell.daysLeft)
        : ''

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} · ${SERVICE_STATUS_LABEL[cell.status]}${note ? ` · ${note}` : ''}`}
      className={`flex w-full min-w-[86px] flex-col items-center gap-0.5 rounded-(--radius-control) border px-2 py-2 transition-colors hover:brightness-[0.97] ${cls}`}
    >
      <span className="flex items-center gap-1 text-[0.88rem] font-semibold">
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
        {look.short}
      </span>
      {note && <span className="t-meta font-medium whitespace-nowrap">{note}</span>}
    </button>
  )
}

/** 레코드에서 한 업무의 표시 상태를 계산한다 */
export function cellStateFor(
  record: ClientOpsRecord,
  key: ServiceKey,
  today: string,
  dueSoonDays: number,
): CellState {
  const state = record.services[key]
  const open = isServiceOpen(state.status)
  let daysLeft: number | null = null
  if (state.dueDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(state.dueDate)
    const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today)
    if (m && t) {
      const a = Date.UTC(Number(t[1]), Number(t[2]) - 1, Number(t[3]))
      const b = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      daysLeft = Math.round((b - a) / 86_400_000)
    }
  }
  const started = isServiceStarted(state.status)
  const blocked = open && started && missingDocumentsFor(record, key, today).length > 0
  return {
    status: state.status,
    overdue: open && daysLeft !== null && daysLeft < 0,
    dueSoon: open && daysLeft !== null && daysLeft >= 0 && daysLeft <= dueSoonDays,
    blocked,
    daysLeft,
  }
}

/* ------------------------------------------------------------------ */
/* 기타                                                                 */
/* ------------------------------------------------------------------ */

export const CLIENT_STATUS_LABEL: Record<ClientOpsStatus, string> = {
  active: '진행 중',
  waiting: '고객 대기',
  paused: '일시 중지',
  completed: '종료',
}

export function ClientStatusChip({ status }: { status: ClientOpsStatus }) {
  const cls: Record<ClientOpsStatus, string> = {
    active: 'bg-brand-50 text-brand-700 border-brand-200',
    waiting: 'bg-warning-50 text-warning-800 border-warning-200',
    paused: 'bg-slate-100 text-slate-600 border-slate-200',
    completed: 'bg-success-50 text-success-700 border-success-200',
  }
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[0.85rem] font-semibold ${cls[status]}`}>
      {CLIENT_STATUS_LABEL[status]}
    </span>
  )
}

/** 숫자 요약 타일 */
/**
 * 요약 숫자 한 칸.
 * onClick 을 주면 눌러서 해당 숫자를 만든 목록으로 좁혀 볼 수 있다.
 * 숫자만 보여 주고 끝나면 "그래서 어느 업체인데?"를 다시 찾아야 하므로,
 * 셀 수 있는 숫자에는 되도록 목록으로 가는 길을 붙인다.
 */
export function StatTile({
  label,
  value,
  tone = 'neutral',
  hint,
  icon: Icon,
  onClick,
  active = false,
}: {
  label: string
  value: string
  tone?: 'neutral' | 'danger' | 'warning' | 'success'
  hint?: string
  icon: typeof Check
  onClick?: () => void
  active?: boolean
}) {
  const cls =
    tone === 'danger'
      ? 'border-danger-200 bg-danger-50/70'
      : tone === 'warning'
        ? 'border-warning-200 bg-warning-50/70'
        : tone === 'success'
          ? 'border-success-200 bg-success-50/70'
          : 'border-slate-200 bg-white'
  const interactive = onClick
    ? `ax-lift cursor-pointer text-left ${active ? 'ring-2 ring-brand-600' : ''}`
    : ''
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick, 'aria-pressed': active } : {})}
      className={`block w-full rounded-(--radius-panel) border p-4 ${cls} ${interactive}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.95rem] font-medium text-slate-600">{label}</span>
        <Icon aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
      </div>
      <strong className="mt-1.5 block text-[1.7rem] leading-tight font-bold text-slate-900">
        {value}
      </strong>
      {hint && <span className="mt-0.5 block text-[0.85rem] break-keep text-slate-500">{hint}</span>}
    </Tag>
  )
}

/** 라벨 + 내용 한 줄 */
export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-50 py-2 last:border-0">
      <span className="text-[0.92rem] text-slate-500">{label}</span>
      <span className="text-[0.98rem] font-medium break-keep text-slate-800">{children}</span>
    </div>
  )
}

/** 서비스 이름 (현황표 헤더용) */
export function serviceHeaderLabel(key: ServiceKey): string {
  return serviceMeta(key).shortLabel
}
