import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

interface DetailHeaderProps {
  backTo: string
  backLabel: string
  title: string
  /** 제목 옆 배지들 */
  badges?: ReactNode
  /** 제목 아래 메타 정보 */
  meta?: ReactNode
  actions?: ReactNode
}

export function DetailHeader({
  backTo,
  backLabel,
  title,
  badges,
  meta,
  actions,
}: DetailHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      <Link
        to={backTo}
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        {backLabel}
      </Link>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold break-keep text-slate-900 lg:text-2xl">
              {title}
            </h1>
            {badges}
          </div>
          {meta && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-slate-500">
              {meta}
            </div>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div>
        )}
      </div>
    </div>
  )
}
