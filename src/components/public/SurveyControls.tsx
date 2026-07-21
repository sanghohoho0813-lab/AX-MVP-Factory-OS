import { AlertCircle, Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '../ui/Button'

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error'

interface SurveyAutosaveIndicatorProps {
  state: AutosaveState
  lastSavedAt: string | null
  onRetry?: () => void
}

function timeLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${ampm} ${h12}:${m}`
}

/** 자동 임시 저장 상태 표시 (aria-live) */
export function SurveyAutosaveIndicator({
  state,
  lastSavedAt,
  onRetry,
}: SurveyAutosaveIndicatorProps) {
  return (
    <div aria-live="polite" className="flex items-center gap-1.5 text-[0.875rem]">
      {state === 'saving' && (
        <span className="flex items-center gap-1 text-slate-400">
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          저장 중…
        </span>
      )}
      {state === 'saved' && (
        <span className="flex items-center gap-1 text-slate-400">
          <Check aria-hidden="true" className="size-3.5 text-success-500" />
          {lastSavedAt ? `${timeLabel(lastSavedAt)} 저장됨` : '저장됨'}
        </span>
      )}
      {state === 'error' && (
        <span className="flex items-center gap-1.5 text-danger-600">
          <AlertCircle aria-hidden="true" className="size-3.5" />
          임시 저장에 실패했습니다.
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="cursor-pointer font-medium underline"
            >
              다시 시도
            </button>
          )}
        </span>
      )}
      {state === 'idle' && lastSavedAt && (
        <span className="text-slate-400">{timeLabel(lastSavedAt)} 저장됨</span>
      )}
    </div>
  )
}

interface SurveyProgressHeaderProps {
  surveyTitle: string
  sectionTitle: string
  pageInfo: string
  progressPercent: number
  answered: number
  total: number
}

/** 상단 진행률 헤더 */
export function SurveyProgressHeader({
  surveyTitle,
  sectionTitle,
  pageInfo,
  progressPercent,
  answered,
  total,
}: SurveyProgressHeaderProps) {
  return (
    <div className="mb-5">
      <p className="text-[0.875rem] text-slate-400">{surveyTitle}</p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold break-keep text-slate-900">
          {sectionTitle}
        </h1>
        <span className="text-[0.875rem] text-slate-400">{pageInfo}</span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`전체 진행률 ${progressPercent}%`}
      >
        <div
          className="h-full rounded-full bg-brand-600 transition-[width]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <p className="mt-1.5 text-[0.875rem] text-slate-400" aria-live="polite">
        전체 {progressPercent}% · 응답 {answered} / {total} 문항
      </p>
    </div>
  )
}

interface SurveyPageNavigationProps {
  canPrev: boolean
  isLast: boolean
  submitting?: boolean
  autosave: React.ReactNode
  onPrev: () => void
  onNext: () => void
}

/** 하단 이전/다음 내비게이션 */
export function SurveyPageNavigation({
  canPrev,
  isLast,
  submitting,
  autosave,
  onPrev,
  onNext,
}: SurveyPageNavigationProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Button variant="secondary" onClick={onPrev} disabled={!canPrev || submitting}>
        <ChevronLeft aria-hidden="true" className="size-4" />
        이전
      </Button>
      <div className="hidden sm:block">{autosave}</div>
      <Button variant="primary" onClick={onNext} disabled={submitting}>
        {isLast ? '응답 검토' : '다음'}
        <ChevronRight aria-hidden="true" className="size-4" />
      </Button>
    </div>
  )
}
