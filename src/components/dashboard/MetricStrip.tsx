import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import type { MetricSummary } from '../../types'
import { TONE_BADGE_CLASS, TONE_DOT_CLASS } from '../../lib/statusMeta'

interface MetricStripProps {
  metrics: MetricSummary[]
}

function DeltaIndicator({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-500">
        <Minus aria-hidden="true" className="size-3" />
        변동 없음
      </span>
    )
  }
  const rising = delta > 0
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium ${
        rising
          ? 'border-success-200 bg-success-50 text-success-700'
          : 'border-danger-200 bg-danger-50 text-danger-700'
      }`}
    >
      {rising ? (
        <TrendingUp aria-hidden="true" className="size-3" />
      ) : (
        <TrendingDown aria-hidden="true" className="size-3" />
      )}
      {rising ? `+${delta}` : delta}
    </span>
  )
}

/** 하나의 컨테이너 안에서 구분선으로 나뉘는 KPI 스트립 */
export function MetricStrip({ metrics }: MetricStripProps) {
  return (
    <section aria-label="핵심 운영 현황">
      <dl className="grid grid-cols-1 rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card) sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.key}
            className="flex items-start gap-4 border-slate-100 px-5 py-5 max-sm:not-last:border-b sm:max-xl:nth-[-n+2]:border-b sm:max-xl:odd:border-r xl:not-last:border-r lg:px-6"
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) border ${TONE_BADGE_CLASS[metric.tone]}`}
            >
              <metric.icon className="size-5" />
            </span>
            <div className="min-w-0">
              <dt className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500">
                <span
                  aria-hidden="true"
                  className={`size-1.5 rounded-full ${TONE_DOT_CLASS[metric.tone]}`}
                />
                {metric.label}
              </dt>
              <dd className="mt-1">
                <p className="text-2xl font-bold text-slate-900">
                  {metric.value}
                  <span className="ml-0.5 text-sm font-medium text-slate-500">
                    {metric.unit}
                  </span>
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
                  전주 대비 <DeltaIndicator delta={metric.weeklyDelta} />
                </p>
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  )
}
