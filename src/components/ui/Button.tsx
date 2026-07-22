import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link'
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
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-[0.875rem] gap-1.5',
  md: 'h-10 px-4 text-[1rem] gap-2',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-(--radius-control) font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
