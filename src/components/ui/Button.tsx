import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link' | 'danger'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white border border-brand-600 hover:bg-brand-700 hover:border-brand-700',
  secondary:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900',
  ghost:
    'bg-transparent text-slate-600 border border-transparent hover:bg-slate-100 hover:text-slate-900',
  link: 'bg-transparent text-brand-600 border border-transparent hover:text-brand-700 hover:underline px-0',
  danger: 'bg-white text-danger-700 border border-danger-200 hover:bg-danger-50',
}

/* 손가락으로 누르는 화면에서는 44px 아래로 내려가지 않는다 */
const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'tap h-10 px-3 t-sub gap-1.5',
  md: 'h-11 px-4 t-body gap-2 sm:h-10',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  // D-166: 밖에서 'hidden sm:inline-flex' 처럼 숨김을 주면 기본 inline-flex 를 빼야 숨는다
  // (같은 층 유틸리티끼리는 inline-flex 가 이겨 PC 전용 단추가 휴대폰에도 보였다)
  const display = /(^|\s)hidden(\s|$)/.test(className) ? '' : 'inline-flex '
  return (
    <button
      type={type}
      className={`btn-fit ${display}shrink-0 cursor-pointer items-center justify-center rounded-(--radius-control) font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
