/**
 * 사용자 친화 상태 배지. 내부 상태(enum)를 쉬운 표현으로 변환한다.
 * 색상만으로 구분하지 않도록 라벨 텍스트를 항상 포함한다.
 */

export type FriendlyStatus = 'done' | 'in_progress' | 'waiting' | 'attention' | 'blocked' | 'none'

const META: Record<FriendlyStatus, { label: string; className: string }> = {
  done: { label: '완료', className: 'border-success-200 bg-success-50 text-success-700' },
  in_progress: { label: '진행 중', className: 'border-brand-200 bg-brand-50 text-brand-700' },
  waiting: { label: '기다리는 중', className: 'border-slate-200 bg-slate-100 text-slate-600' },
  attention: { label: '보완 필요', className: 'border-warning-200 bg-warning-50 text-warning-700' },
  blocked: { label: '막힘', className: 'border-danger-200 bg-danger-50 text-danger-700' },
  none: { label: '해당 없음', className: 'border-slate-200 bg-white text-slate-400' },
}

/** 내부 상태 문자열 → 친화 상태 매핑 (도메인 전반의 status 값을 최대한 흡수) */
export function toFriendlyStatus(raw: string | null | undefined): FriendlyStatus {
  switch (raw) {
    case 'finalized':
    case 'approved':
    case 'completed':
    case 'done':
    case 'submitted':
      return 'done'
    case 'in_progress':
    case 'draft':
    case 'editing':
    case 'evaluating':
    case 'testing':
      return 'in_progress'
    case 'reviewed':
    case 'ready':
    case 'issued':
    case 'pending':
      return 'waiting'
    case 'attention':
    case 'stale':
    case 'needs_fix':
      return 'attention'
    case 'blocked':
    case 'risk':
    case 'revoked':
    case 'expired':
      return 'blocked'
    case 'superseded':
    case 'archived':
    case 'none':
      return 'none'
    default:
      return 'waiting'
  }
}

export function StatusPill({
  status,
  label,
  size = 'md',
}: {
  status: FriendlyStatus
  /** 라벨 재정의 (기본 친화 라벨 대신) */
  label?: string
  size?: 'sm' | 'md'
}) {
  const meta = META[status]
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[0.8rem]' : 'px-2.5 py-1 text-[0.9rem]'
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold ${pad} ${meta.className}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-70" />
      {label ?? meta.label}
    </span>
  )
}
