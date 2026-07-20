import { Check, Circle, Lock } from 'lucide-react'

export interface JourneyFlowStep {
  key: string
  label: string
  state: 'done' | 'current' | 'locked'
  /** done·current에서 이동할 경로 */
  path?: string
  /** locked 단계의 선행조건 안내 */
  hint?: string
}

/**
 * 프로젝트 전체 진행 흐름을 쉬운 명칭으로 보여준다.
 * 완료 단계는 결과 보기, 현재 단계는 핵심 행동으로 이동하고,
 * 미래 단계는 잠금과 선행조건을 함께 안내한다. 색상만으로 구분하지 않는다.
 */
export function JourneyFlow({
  steps,
  onNavigate,
}: {
  steps: JourneyFlowStep[]
  onNavigate: (path: string) => void
}) {
  return (
    <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      {steps.map((step, i) => {
        const clickable = step.state !== 'locked' && Boolean(step.path)
        const Wrapper = clickable ? 'button' : 'div'
        return (
          <li key={step.key} className="min-w-0">
            <Wrapper
              type={clickable ? 'button' : undefined}
              onClick={clickable && step.path ? () => onNavigate(step.path as string) : undefined}
              title={step.state === 'locked' ? step.hint : undefined}
              aria-disabled={step.state === 'locked' || undefined}
              className={`flex h-full w-full flex-col gap-1.5 rounded-(--radius-card) border px-3 py-2.5 text-left transition-colors ${
                step.state === 'current'
                  ? 'border-brand-300 bg-brand-50/60'
                  : step.state === 'done'
                    ? 'border-slate-200 bg-white hover:border-slate-300'
                    : 'border-slate-200 bg-slate-50/60'
              } ${clickable ? 'cursor-pointer' : ''}`}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${
                    step.state === 'done'
                      ? 'bg-success-100 text-success-700'
                      : step.state === 'current'
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {step.state === 'done' ? (
                    <Check aria-hidden="true" className="size-3" />
                  ) : step.state === 'locked' ? (
                    <Lock aria-hidden="true" className="size-3" />
                  ) : (
                    i + 1
                  )}
                </span>
                {step.state === 'current' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600">
                    <Circle aria-hidden="true" className="size-1.5 fill-current" />
                    지금 단계
                  </span>
                )}
              </span>
              <span
                className={`text-[13px] font-medium ${
                  step.state === 'locked' ? 'text-slate-400' : 'text-slate-800'
                }`}
              >
                {step.label}
                {step.state === 'done' && <span className="sr-only"> 완료됨</span>}
                {step.state === 'locked' && <span className="sr-only"> 잠김</span>}
              </span>
              {step.state === 'locked' && step.hint && (
                <span className="text-[11px] break-keep text-slate-400">{step.hint}</span>
              )}
            </Wrapper>
          </li>
        )
      })}
    </ol>
  )
}
