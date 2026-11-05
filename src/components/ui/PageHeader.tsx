import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { screenTitleForPath } from '../../config/moduleRegistry'
import { HintTip } from './fold'
import { useTitleIcon } from './titleIcon'

interface PageHeaderProps {
  title: string
  description?: string
  /** D-192: 설명을 화면에 깔지 않고 제목 옆 ⓘ · 마우스를 올리면(긴 설명이 있는 내부 화면) */
  descriptionAsHint?: boolean
  actions?: ReactNode
  /** D-233: 휴대폰 위쪽 띠가 줄여 보여 주는 긴 이름(마케팅 · 브랜딩 → '마케…')이면 화면 안에도 제목을 그린다 */
  showOnPhone?: boolean
  /**
   * U5(D-542) 화면 안 탭(예: 일정 › 달력 · 오늘 기록 · 주간 돌아보기 · 전체 기록) — 넓은 PC 는 제목과 단추 사이 한 줄에,
   * 좁으면(머리 폭 1024px 미만 · 휴대폰) 예전처럼 단추 아래 한 줄. 내용 칸이 한 줄만큼 위로 올라온다.
   */
  nav?: ReactNode
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
 * 종이에는 위쪽 띠가 없으니 인쇄할 때는 늘 보인다 (D-102 — 전에는 A4 폭에서 제목 없이 찍혔다).
 */
export function PageHeader({ title, description, descriptionAsHint = false, actions, showOnPhone = false, nav }: PageHeaderProps) {
  const { pathname } = useLocation()
  const sameAsHeader = screenTitleForPath(pathname) === title && !showOnPhone
  const asHint = descriptionAsHint && !!description
  // D-282 메뉴와 같은 기능 아이콘 칸(제목이 메뉴 이름으로 시작할 때만) — 휴대폰에서 제목을 숨기는 화면이면 같이 숨긴다
  const icon = useTitleIcon(title)

  const row = (
    <div className={nav ? 'flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-6 sm:gap-y-3 @5xl:items-center' : 'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6'}>
      <div className={`min-w-0 ${icon ? 'flex items-start gap-3' : ''}`}>
        {icon && <span className={sameAsHeader ? 'hidden lg:flex print:hidden' : 'flex print:hidden'}>{icon}</span>}
        <div className="min-w-0">
        {asHint ? (
          <>
            {/* 휴대폰 위쪽 띠가 이미 이름을 말하면 제목 · ⓘ 를 다시 그리지 않는다(읽어 주는 기계용 제목만) */}
            {sameAsHeader && <h1 className="sr-only lg:hidden print:hidden">{title}</h1>}
            <HintTip tip={description} label={title} className={sameAsHeader ? 'hidden lg:flex print:flex' : ''}>
              <h1 className="t-page break-keep text-slate-900">{title}</h1>
            </HintTip>
          </>
        ) : (
          <h1 className={`t-page break-keep text-slate-900 ${sameAsHeader ? 'sr-only lg:not-sr-only print:not-sr-only' : ''}`}>
            {title}
          </h1>
        )}
        {description && !asHint && (
          <p className={`t-sub break-keep text-slate-500 ${sameAsHeader ? 'lg:mt-1' : 'mt-1'}`}>{description}</p>
        )}
        </div>
      </div>
      {nav && <div className="order-last min-w-0 sm:basis-full @5xl:order-none @5xl:mr-auto @5xl:basis-auto">{nav}</div>}
      {actions && (
        <div className="-mx-4 flex min-w-0 items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:justify-end sm:overflow-visible sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {actions}
        </div>
      )}
    </div>
  )
  return nav ? <div className="@container">{row}</div> : row
}
