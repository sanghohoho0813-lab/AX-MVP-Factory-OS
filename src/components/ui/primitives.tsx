/**
 * 화면 공통 부품.
 *
 * 이 파일의 목적은 "모든 화면이 같은 언어로 말하게" 하는 것이다.
 * 카드마다 테두리·그림자·여백·글자 크기를 따로 정하지 않는다.
 *
 * 색 사용 규칙 (여기서 강제한다)
 *   빨강   마감 지남 · 막힘 · 되돌릴 수 없는 행동
 *   주황   임박 · 대기 · 주의
 *   초록   완료 · 확인됨
 *   브랜드 선택됨 · 주요 행동
 *   그 외는 전부 무채색
 *
 * 업무 종류(특허·벤처인증 …) 는 색으로 구분하지 않는다. 작은 점 하나로만
 * 표시한다 — 종류를 색으로 칠하기 시작하면 정작 급한 것이 묻힌다.
 */

import type { ReactNode } from 'react'
import { useEffect, useId, useState } from 'react'
import { ChevronRight, X } from 'lucide-react'

/* ------------------------------------------------------------------ */
/* 색 계약                                                              */
/* ------------------------------------------------------------------ */

export type Tone = 'neutral' | 'brand' | 'danger' | 'warning' | 'success'

const BADGE_TONE: Record<Tone, string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  brand: 'border-brand-200 bg-brand-50 text-brand-700',
  danger: 'border-danger-200 bg-danger-50 text-danger-700',
  warning: 'border-warning-200 bg-warning-50 text-warning-700',
  success: 'border-success-200 bg-success-50 text-success-700',
}

const EDGE_TONE: Record<Tone, string> = {
  neutral: 'bg-slate-200',
  brand: 'bg-brand-500',
  danger: 'bg-danger-500',
  warning: 'bg-warning-500',
  success: 'bg-success-500',
}

const DOT_TONE: Record<Tone, string> = {
  neutral: 'bg-slate-300',
  brand: 'bg-brand-500',
  danger: 'bg-danger-500',
  warning: 'bg-warning-500',
  success: 'bg-success-500',
}

/* ------------------------------------------------------------------ */
/* 표면                                                                 */
/* ------------------------------------------------------------------ */

/**
 * 카드 한 장.
 *
 * 중요한 카드라고 배경 전체를 빨갛게 칠하지 않는다. 왼쪽에 3px 선만 긋는다 —
 * 목록이 길어져도 눈이 아프지 않고, 급한 것이 어디인지는 여전히 한눈에 보인다.
 */
export function Surface({
  children,
  edge = 'neutral',
  showEdge = false,
  as = 'div',
  className = '',
  padded = true,
}: {
  children: ReactNode
  edge?: Tone
  /** 왼쪽 강조선 표시 여부 */
  showEdge?: boolean
  as?: 'div' | 'section' | 'li' | 'article'
  className?: string
  padded?: boolean
}) {
  const Tag = as
  return (
    <Tag
      className={`relative overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white ${
        padded ? 'p-4 sm:p-5' : ''
      } ${className}`}
    >
      {showEdge && <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] ${EDGE_TONE[edge]}`} />}
      {children}
    </Tag>
  )
}

/** 상태 배지 — 한 줄에 두 개를 넘지 않게 쓴다 */
export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={`t-meta inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${BADGE_TONE[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

/** 종류를 나타내는 작은 점 — 색을 아주 조금만 쓰기 위한 장치 */
export function Dot({ tone = 'neutral', className = '' }: { tone?: Tone; className?: string }) {
  return <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOT_TONE[tone]} ${className}`} />
}

/* ------------------------------------------------------------------ */
/* 제목                                                                 */
/* ------------------------------------------------------------------ */

/** 화면 제목 — 한 화면에 하나. 부가 버튼은 최대 2개까지만 노출한다 */
export function ScreenTitle({
  title,
  sub,
  actions,
  back,
}: {
  title: string
  sub?: string
  actions?: ReactNode
  back?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h1 className="t-page break-keep text-slate-900">{title}</h1>
          {sub && <p className="t-sub mt-1 break-keep text-slate-500">{sub}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/** 구역 제목 + 오른쪽 보조 행동 (예: 모두 보기) */
export function SectionTitle({
  title,
  count,
  action,
  id,
}: {
  title: string
  count?: number
  action?: ReactNode
  id?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="t-section flex items-center gap-2 break-keep text-slate-900">
        {title}
        {typeof count === 'number' && count > 0 && (
          <span className="t-meta rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-500">{count}</span>
        )}
      </h2>
      {action}
    </div>
  )
}

/** 화면 구역 — 제목과 내용 사이 간격을 한 곳에서 정한다 */
export function Section({
  title,
  count,
  action,
  children,
  className = '',
}: {
  title?: string
  count?: number
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`flex flex-col gap-3 ${className}`}>
      {title && <SectionTitle title={title} count={count} action={action} />}
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 목록                                                                 */
/* ------------------------------------------------------------------ */

/**
 * 목록 한 줄.
 *
 * 제목 / 보조설명 / 오른쪽 표시 세 자리만 있다. 이 이상 넣고 싶으면
 * 그건 목록이 아니라 상세 화면에 있어야 하는 정보다.
 */
export function ListRow({
  title,
  meta,
  badge,
  right,
  onClick,
  edge = 'neutral',
  showEdge = false,
  leading,
}: {
  title: ReactNode
  meta?: ReactNode
  badge?: ReactNode
  right?: ReactNode
  onClick?: () => void
  edge?: Tone
  showEdge?: boolean
  leading?: ReactNode
}) {
  const inner = (
    <>
      {showEdge && <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[3px] ${EDGE_TONE[edge]}`} />}
      {leading && <span className="mt-0.5 shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="t-card min-w-0 break-keep text-slate-900">{title}</span>
          {badge}
        </span>
        {meta && <span className="t-sub mt-0.5 block break-keep text-slate-500">{meta}</span>}
      </span>
      {right && <span className="t-sub shrink-0 text-right text-slate-500">{right}</span>}
      {onClick && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-300" />}
    </>
  )

  const cls =
    'tap relative flex w-full items-start gap-3 px-4 py-3.5 text-left sm:px-5'

  if (!onClick) return <div className={cls}>{inner}</div>
  return (
    <button type="button" onClick={onClick} className={`${cls} hover:bg-slate-50`}>
      {inner}
    </button>
  )
}

/** 줄 사이 구분선만 있는 목록 상자 — 카드 안 카드를 만들지 않기 위한 형태 */
export function ListSurface({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white ${className}`}>
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 숫자                                                                 */
/* ------------------------------------------------------------------ */

/**
 * 요약 숫자 한 칸.
 *
 * 0 일 때는 색을 넣지 않는다 — 아무 일도 없는데 화면이 빨갛게 물드는 것을 막는다.
 */
export function MetricTile({
  label,
  value,
  hint,
  tone = 'neutral',
  onClick,
  active = false,
}: {
  label: string
  value: string
  hint?: string
  tone?: Tone
  onClick?: () => void
  active?: boolean
}) {
  const valueColor =
    tone === 'danger' ? 'text-danger-700' : tone === 'warning' ? 'text-warning-700' : 'text-slate-900'
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick, 'aria-pressed': active } : {})}
      className={`tap relative overflow-hidden rounded-(--radius-panel) border bg-white px-3.5 py-3 text-left ${
        active ? 'border-brand-400 ring-1 ring-brand-400' : 'border-slate-200'
      } ${onClick ? 'ax-lift cursor-pointer' : ''}`}
    >
      {tone !== 'neutral' && (
        <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${EDGE_TONE[tone]}`} />
      )}
      <span className="t-sub block break-keep text-slate-500">{label}</span>
      <strong className={`t-num mt-1 block ${valueColor}`}>{value}</strong>
      {hint && <span className="t-meta mt-0.5 block break-keep text-slate-400">{hint}</span>}
    </Tag>
  )
}

/* ------------------------------------------------------------------ */
/* 펼치기                                                               */
/* ------------------------------------------------------------------ */

/**
 * 접었다 펴는 구역.
 *
 * 화면을 처음 열었을 때 보이는 정보를 줄이는 것이 이 화면 설계의 핵심이다.
 * 자세한 내용은 필요할 때 펼쳐서 본다.
 */
export function Disclosure({
  title,
  hint,
  defaultOpen = false,
  children,
  badge,
}: {
  title: string
  hint?: string
  defaultOpen?: boolean
  children: ReactNode
  badge?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <div className="overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="tap flex w-full items-center gap-2 px-4 py-3.5 text-left sm:px-5"
      >
        <ChevronRight
          aria-hidden="true"
          className={`size-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
        <span className="min-w-0 flex-1">
          <span className="t-card block break-keep text-slate-900">{title}</span>
          {hint && !open && <span className="t-sub mt-0.5 block break-keep text-slate-500">{hint}</span>}
        </span>
        {badge}
      </button>
      {open && (
        <div id={id} className="border-t border-slate-100 px-4 py-4 sm:px-5">
          {children}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 바텀 시트                                                            */
/* ------------------------------------------------------------------ */

/**
 * 모바일에서 무엇을 입력·선택할 때 쓰는 창.
 *
 * 화면 아래에서 올라오고, 키보드가 올라와도 확인 버튼이 가리지 않도록
 * 내용만 스크롤한다. 데스크톱에서는 가운데 창으로 보인다.
 */
export function BottomSheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      className="ax-fade fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="ax-pop flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white sm:max-w-lg sm:rounded-(--radius-panel)">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="t-section min-w-0 break-keep text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="tap -mr-2 flex size-10 items-center justify-center rounded-(--radius-control) text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="pb-safe shrink-0 border-t border-slate-100 px-5 py-3.5">{footer}</div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 비어 있을 때                                                         */
/* ------------------------------------------------------------------ */

/** 지금 상태 한 줄 + 다음 행동 하나. 설명문을 길게 쓰지 않는다 */
export function Blank({
  title,
  action,
  icon,
}: {
  title: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="rounded-(--radius-panel) border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
      {icon && <div className="mb-2 flex justify-center text-slate-300">{icon}</div>}
      <p className="t-body break-keep text-slate-500">{title}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  )
}
