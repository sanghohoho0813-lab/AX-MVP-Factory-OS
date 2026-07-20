import type { LucideIcon } from 'lucide-react'
import { ArrowRight, CheckCircle2, Circle, Sparkles } from 'lucide-react'
import { Button } from './Button'

export interface PrereqStep {
  label: string
  done: boolean
}

interface GuidedEmptyStateProps {
  icon: LucideIcon
  title: string
  /** 왜 이 화면에 데이터가 없는지 */
  reason: string
  /** 먼저 완료해야 하는 단계 체크리스트 */
  prereqs?: PrereqStep[]
  /** 전체 흐름에서 현재 화면의 위치 (예: 3단계 · 기능·화면 설계) */
  flowPosition?: string
  /** 선행 단계로 이동하는 주 행동 */
  primaryLabel?: string
  onPrimary?: () => void
  /** 샘플로 확인하는 보조 행동 */
  sampleLabel?: string
  onSample?: () => void
}

/**
 * 빈 상태 공통 컴포넌트.
 * 0건만 보여주지 않고 (1) 이유 (2) 선행 단계 (3) 이동 버튼 (4) 샘플 보기
 * (5) 전체 흐름에서의 위치를 함께 안내한다.
 */
export function GuidedEmptyState({
  icon: Icon,
  title,
  reason,
  prereqs,
  flowPosition,
  primaryLabel,
  onPrimary,
  sampleLabel,
  onSample,
}: GuidedEmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      {flowPosition && (
        <span className="mt-3 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
          {flowPosition}
        </span>
      )}
      <h3 className="mt-3 text-base font-semibold text-slate-800">{title}</h3>
      <p className="mt-1.5 text-sm break-keep text-slate-500">{reason}</p>

      {prereqs && prereqs.length > 0 && (
        <ul className="mt-4 flex w-full max-w-sm flex-col gap-2 rounded-(--radius-card) border border-slate-200 bg-slate-50/60 px-4 py-3 text-left">
          {prereqs.map((step) => (
            <li key={step.label} className="flex items-center gap-2 text-[13px]">
              {step.done ? (
                <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success-500" />
              ) : (
                <Circle aria-hidden="true" className="size-4 shrink-0 text-slate-300" />
              )}
              <span className={step.done ? 'text-slate-400 line-through' : 'text-slate-600'}>
                {step.label}
              </span>
              {step.done && <span className="sr-only">완료됨</span>}
            </li>
          ))}
        </ul>
      )}

      {(onPrimary || onSample) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {onPrimary && primaryLabel && (
            <Button variant="primary" onClick={onPrimary}>
              {primaryLabel}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          )}
          {onSample && sampleLabel && (
            <Button variant="secondary" onClick={onSample}>
              <Sparkles aria-hidden="true" className="size-4" />
              {sampleLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
