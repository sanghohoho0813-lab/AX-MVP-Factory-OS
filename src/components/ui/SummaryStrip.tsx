import type { LucideIcon } from 'lucide-react'
import type { StatusTone } from '../../types'
import { TONE_BADGE_CLASS, TONE_DOT_CLASS } from '../../lib/statusMeta'

export interface SummaryStripItem {
  key: string
  label: string
  value: number
  unit?: string
  tone: StatusTone
  icon: LucideIcon
}

interface SummaryStripProps {
  ariaLabel: string
  items: SummaryStripItem[]
}

/** 대시보드 KPI와 동일한 단일 컨테이너 요약 스트립 */
export function SummaryStrip({ ariaLabel, items }: SummaryStripProps) {
  return (
    <section aria-label={ariaLabel}>
      <dl className="grid grid-cols-1 rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card) sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center gap-3.5 border-slate-100 px-5 py-4 max-sm:not-last:border-b sm:max-xl:nth-[-n+2]:border-b sm:max-xl:odd:border-r xl:not-last:border-r"
          >
            <span
              aria-hidden="true"
              className={`flex size-10 shrink-0 items-center justify-center rounded-(--radius-control) border ${TONE_BADGE_CLASS[item.tone]}`}
            >
              <item.icon className="size-4.5" />
            </span>
            <div className="min-w-0">
              <dt className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500">
                <span
                  aria-hidden="true"
                  className={`size-1.5 rounded-full ${TONE_DOT_CLASS[item.tone]}`}
                />
                {item.label}
              </dt>
              <dd className="mt-0.5 text-xl font-bold text-slate-900">
                {item.value}
                {item.unit && (
                  <span className="ml-0.5 text-[13px] font-medium text-slate-500">
                    {item.unit}
                  </span>
                )}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  )
}
