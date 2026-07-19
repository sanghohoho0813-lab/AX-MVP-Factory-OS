import { Check } from 'lucide-react'
import type { ProjectStage } from '../../types'
import { PROJECT_STAGE_META } from '../../lib/statusMeta'

interface StageProgressProps {
  /** 프로젝트 유형에 맞는 단계 순서 */
  flow: ProjectStage[]
  currentStage: ProjectStage
}

/** 완료·현재·예정 단계를 구분하는 가로 스텝 표시 */
export function StageProgress({ flow, currentStage }: StageProgressProps) {
  const currentIndex = Math.max(flow.indexOf(currentStage), 0)

  return (
    <ol className="flex flex-wrap gap-y-3" aria-label="전체 진행 흐름">
      {flow.map((stage, index) => {
        const done = index < currentIndex
        const current = index === currentIndex
        return (
          <li key={stage} className="flex min-w-0 flex-1 basis-1/4 items-start sm:basis-0">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 px-1">
              <div className="flex w-full items-center">
                <span
                  aria-hidden="true"
                  className={`h-px flex-1 ${index === 0 ? 'bg-transparent' : done || current ? 'bg-brand-500' : 'bg-slate-200'}`}
                />
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                    done
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : current
                        ? 'border-brand-600 bg-white text-brand-700 ring-2 ring-brand-100'
                        : 'border-slate-200 bg-white text-slate-400'
                  }`}
                >
                  {done ? (
                    <Check aria-hidden="true" className="size-3.5" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className={`h-px flex-1 ${index === flow.length - 1 ? 'bg-transparent' : done ? 'bg-brand-500' : 'bg-slate-200'}`}
                />
              </div>
              <span
                className={`w-full truncate text-center text-[11px] font-medium sm:text-xs ${
                  current ? 'text-brand-700' : done ? 'text-slate-600' : 'text-slate-400'
                }`}
                title={PROJECT_STAGE_META[stage].label}
              >
                {PROJECT_STAGE_META[stage].label}
                {current && <span className="sr-only"> (현재 단계)</span>}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
