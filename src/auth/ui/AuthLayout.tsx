/**
 * 인증 화면 공통 레이아웃 (AppShell 밖). 로그인/회원가입/비밀번호/초대 화면이 공유한다.
 */

import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Sparkles aria-hidden="true" className="size-5" />
          </span>
          <span className="text-lg font-bold text-slate-900">AX MVP Factory OS</span>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold break-keep text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm break-keep text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-slate-500">{footer}</div>}
      </div>
    </div>
  )
}

export function AuthField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  placeholder,
  required = true,
  disabled = false,
}: {
  id: string
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
      />
    </div>
  )
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="rounded-(--radius-control) border border-danger-200 bg-danger-50/70 px-3 py-2 text-[13px] break-keep text-danger-700"
    >
      {message}
    </p>
  )
}

export function AuthNotice({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="rounded-(--radius-control) border border-success-200 bg-success-50/70 px-3 py-2 text-[13px] break-keep text-success-700">
      {message}
    </p>
  )
}
