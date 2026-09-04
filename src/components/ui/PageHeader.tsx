import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

/**
 * 화면 제목 한 벌.
 *
 * 모든 화면이 같은 크기·같은 간격으로 시작하도록 여기서만 정한다.
 * 버튼이 여럿일 때 모바일에서 세 줄로 쌓이면 본문이 화면 밖으로 밀리므로,
 * 좁은 화면에서는 한 줄로 두고 옆으로 밀어서 본다.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h1 className="t-page break-keep text-slate-900">{title}</h1>
        {description && <p className="t-sub mt-1 break-keep text-slate-500">{description}</p>}
      </div>
      {actions && (
        <div className="-mx-4 flex min-w-0 items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:justify-end sm:overflow-visible sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {actions}
        </div>
      )}
    </div>
  )
}
