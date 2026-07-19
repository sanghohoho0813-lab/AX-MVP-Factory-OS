import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-(--radius-card) border border-slate-200 bg-slate-50 text-slate-400"
      >
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-sm font-semibold break-keep text-slate-800">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-[13px] break-keep text-slate-500">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
