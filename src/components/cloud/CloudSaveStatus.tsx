/**
 * 저장/연결 상태 표시 공통 컴포넌트.
 * 실패 상태에서 성공 체크를 표시하지 않는다(연결 실패를 성공처럼 위장 금지).
 */

import { Check, CloudOff, Loader2, RefreshCw, TriangleAlert, HardDrive } from 'lucide-react'

export type CloudSaveState =
  | 'local'
  | 'initializing'
  | 'saved'
  | 'saving'
  | 'failed'
  | 'offline'
  | 'configuration_error'

const META: Record<CloudSaveState, { label: string; className: string; icon: typeof Check }> = {
  local: {
    label: '로컬 데모 · 이 브라우저에만 저장',
    className: 'border-slate-200 bg-slate-50 text-slate-500',
    icon: HardDrive,
  },
  initializing: {
    label: '연결 확인 중',
    className: 'border-slate-200 bg-slate-50 text-slate-500',
    icon: Loader2,
  },
  saved: {
    label: '클라우드 저장됨',
    className: 'border-success-200 bg-success-50/70 text-success-700',
    icon: Check,
  },
  saving: {
    label: '저장 중',
    className: 'border-brand-200 bg-brand-50/70 text-brand-700',
    icon: Loader2,
  },
  failed: {
    label: '저장 실패 · 다시 시도 필요',
    className: 'border-danger-200 bg-danger-50/70 text-danger-700',
    icon: TriangleAlert,
  },
  offline: {
    label: '오프라인 · 저장 보류',
    className: 'border-warning-200 bg-warning-50/70 text-warning-700',
    icon: CloudOff,
  },
  configuration_error: {
    label: '클라우드 설정이 필요합니다',
    className: 'border-warning-200 bg-warning-50/70 text-warning-700',
    icon: TriangleAlert,
  },
}

export function CloudSaveStatus({
  state,
  onRetry,
  compact = false,
}: {
  state: CloudSaveState
  onRetry?: () => void
  compact?: boolean
}) {
  const meta = META[state]
  const Icon = meta.icon
  const spin = state === 'saving' || state === 'initializing'
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium ${meta.className}`}
    >
      <Icon aria-hidden="true" className={`size-3.5 shrink-0 ${spin ? 'animate-spin' : ''}`} />
      {!compact && <span className="truncate">{meta.label}</span>}
      {state === 'failed' && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-1 inline-flex cursor-pointer items-center gap-1 rounded px-1 text-[12px] font-semibold underline hover:no-underline"
        >
          <RefreshCw aria-hidden="true" className="size-3" />
          다시 시도
        </button>
      )}
    </span>
  )
}
