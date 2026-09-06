import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { moduleForPath } from '../../config/moduleRegistry'

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
 *
 * 휴대폰의 위쪽 띠가 이미 화면 이름을 말하고 있을 때는 같은 이름을 큰 글자로
 * 한 번 더 쓰지 않는다(읽어 주는 기계에는 남긴다). 이름이 다를 때는 그대로 둔다.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  const { pathname } = useLocation()
  const sameAsHeader = moduleForPath(pathname)?.label === title

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h1 className={`t-page break-keep text-slate-900 ${sameAsHeader ? 'sr-only lg:not-sr-only' : ''}`}>
          {title}
        </h1>
        {description && (
          <p className={`t-sub break-keep text-slate-500 ${sameAsHeader ? 'lg:mt-1' : 'mt-1'}`}>{description}</p>
        )}
      </div>
      {actions && (
        <div className="-mx-4 flex min-w-0 items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:justify-end sm:overflow-visible sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {actions}
        </div>
      )}
    </div>
  )
}
