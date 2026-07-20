import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react'
import {
  GuidedDemoError,
  prepareGuidedDemo,
} from '../../services/guidedDemo/guidedDemoService'
import { useToast } from '../ui/toastContext'
import { DEMO_TOUR_STEPS, DemoTourContext } from './demoTour'

export function DemoTourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  const start = useCallback(() => {
    try {
      prepareGuidedDemo()
      setActive(true)
      setStepIndex(0)
      navigate(DEMO_TOUR_STEPS[0].path)
      showToast('샘플 데이터를 준비했습니다. 전체 흐름을 둘러보세요.')
    } catch (error) {
      showToast(
        error instanceof GuidedDemoError
          ? error.message
          : '샘플 데이터를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      )
    }
  }, [navigate, showToast])

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(DEMO_TOUR_STEPS.length - 1, index))
      setStepIndex(clamped)
      navigate(DEMO_TOUR_STEPS[clamped].path)
    },
    [navigate],
  )

  const next = useCallback(() => goTo(stepIndex + 1), [goTo, stepIndex])
  const prev = useCallback(() => goTo(stepIndex - 1), [goTo, stepIndex])

  const exit = useCallback(() => {
    setActive(false)
    showToast('샘플 체험을 종료했습니다.')
    navigate('/')
  }, [navigate, showToast])

  const value = useMemo(
    () => ({ active, stepIndex, steps: DEMO_TOUR_STEPS, start, next, prev, goTo, exit }),
    [active, stepIndex, start, next, prev, goTo, exit],
  )

  return (
    <DemoTourContext.Provider value={value}>
      {children}
      {active && <DemoBanner stepIndex={stepIndex} onPrev={prev} onNext={next} onExit={exit} />}
    </DemoTourContext.Provider>
  )
}

function DemoBanner({
  stepIndex,
  onPrev,
  onNext,
  onExit,
}: {
  stepIndex: number
  onPrev: () => void
  onNext: () => void
  onExit: () => void
}) {
  const total = DEMO_TOUR_STEPS.length
  const step = DEMO_TOUR_STEPS[stepIndex]
  const isFirst = stepIndex === 0
  const isLast = stepIndex === total - 1

  return (
    <div
      role="region"
      aria-label="샘플 체험 안내"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-navy-800 bg-navy-900 px-4 py-2.5 text-white shadow-(--shadow-overlay) sm:inset-x-auto sm:right-4 sm:bottom-4 sm:rounded-(--radius-panel) sm:border"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 sm:mx-0">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
          <Sparkles aria-hidden="true" className="size-4 text-brand-200" />
          샘플 체험 중
        </span>
        <span aria-live="polite" className="min-w-0 flex-1 text-[13px] text-navy-200">
          <span className="font-medium text-white">
            {stepIndex + 1}/{total}
          </span>{' '}
          {step.label}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrev}
            disabled={isFirst}
            className="inline-flex min-h-9 items-center gap-1 rounded-(--radius-control) border border-navy-700 px-2.5 text-[13px] font-medium text-navy-200 hover:bg-navy-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            이전
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={isLast}
            className="inline-flex min-h-9 items-center gap-1 rounded-(--radius-control) bg-brand-600 px-3 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            onClick={onExit}
            aria-label="샘플 체험 종료"
            className="inline-flex min-h-9 items-center gap-1 rounded-(--radius-control) px-2 text-[13px] font-medium text-navy-300 hover:bg-navy-800 hover:text-white"
          >
            <X aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">종료</span>
          </button>
        </div>
      </div>
    </div>
  )
}
