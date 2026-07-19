import { SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from './PageHeader'

interface NotFoundStateProps {
  title: string
  description: string
  backTo: string
  backLabel: string
}

/** 존재하지 않는 고객사·프로젝트 접근 시 공통 안내 */
export function NotFoundState({
  title,
  description,
  backTo,
  backLabel,
}: NotFoundStateProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <div className="rounded-(--radius-panel) border border-slate-200 bg-white px-6 py-14 shadow-(--shadow-card)">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <span
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-(--radius-panel) border border-slate-200 bg-slate-50 text-slate-400"
          >
            <SearchX className="size-6" />
          </span>
          <p className="mt-4 text-base font-semibold break-keep text-slate-900">
            {title}
          </p>
          <p className="mt-2 text-sm break-keep text-slate-500">{description}</p>
          <Link
            to={backTo}
            className="mt-6 inline-flex h-10 items-center rounded-(--radius-control) bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
