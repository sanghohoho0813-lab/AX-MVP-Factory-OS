import { ArrowLeft, CircleCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ModulePageConfig } from '../types'
import { PageHeader } from '../components/ui/PageHeader'
import { StatusBadge } from '../components/ui/StatusBadge'

interface EmptyModulePageProps {
  config: ModulePageConfig
}

export function EmptyModulePage({ config }: EmptyModulePageProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={config.title} description={config.description} />

      <section
        aria-label="개발 준비 중 안내"
        className="rounded-(--radius-panel) border border-slate-200 bg-white px-6 py-10 shadow-(--shadow-card) sm:px-10 sm:py-14"
      >
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <span
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-(--radius-panel) border border-brand-200 bg-brand-50 text-brand-600"
          >
            <config.icon className="size-6" />
          </span>
          <div className="mt-4">
            <StatusBadge tone="info">다음 개발 단계에서 구현될 기능</StatusBadge>
          </div>
          <h2 className="mt-4 text-lg font-semibold break-keep text-slate-900">
            {config.title} 화면을 준비하고 있습니다
          </h2>
          <p className="mt-2 text-sm break-keep text-slate-500">
            현재는 1단계(기반·대시보드) 개발이 완료된 상태이며, 이 모듈은 이후
            단계에서 순차적으로 제공됩니다.
          </p>

          <ul className="mt-6 w-full space-y-2.5 text-left">
            {config.upcomingFeatures.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2.5 rounded-(--radius-card) border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <CircleCheck
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-brand-600"
                />
                <span className="text-sm break-keep text-slate-700">{feature}</span>
              </li>
            ))}
          </ul>

          <Link
            to="/"
            className="mt-8 inline-flex h-10 items-center gap-2 rounded-(--radius-control) border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            홈으로 돌아가기
          </Link>
        </div>
      </section>
    </div>
  )
}
