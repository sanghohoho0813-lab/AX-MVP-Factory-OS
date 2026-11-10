/**
 * 인증 화면 공통 레이아웃 (AppShell 밖). 로그인/회원가입/비밀번호/초대 화면이 공유한다.
 */

import type { ReactNode } from 'react'
import { CalendarCheck, FolderOpen, Megaphone } from 'lucide-react'
import { BrandLogo, ProductWordmark } from '../../components/brand/BrandLogo'
import { Link } from 'react-router-dom'
import { LEGAL } from '../../content/legal'
import { InAppBrowserNotice } from '../../components/guide/InAppBrowserNotice'

/**
 * D-578 처음 온 사람이 '무슨 프로그램인지' 알게 — 로그인 · 가입 화면 옆(PC 넓은 화면만)에 세 줄.
 * 휴대폰 · 좁은 화면에서는 안 보인다(로그인 칸이 먼저). 가격 · 약속하는 숫자는 쓰지 않는다.
 */
const INTRO: ReadonlyArray<{ icon: typeof FolderOpen; title: string; text: string }> = [
  { icon: FolderOpen, title: '고객 · 서류', text: '서류를 올리면 칸에 알아서 정리되고 회사 정보가 채워져요.' },
  { icon: CalendarCheck, title: '일정 · 업무', text: '오늘 챙길 약속 · 기한 · 받을 돈이 맨 위에 보여요.' },
  { icon: Megaphone, title: '마케팅', text: '올릴 글과 영상 대본을 주제 한 줄로 만들어요.' },
]

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  intro = false,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  /** 로그인 · 가입 화면 — PC 넓은 화면에서 옆에 '무엇을 해 주는 프로그램인지' 세 줄 */
  intro?: boolean
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center gap-16 bg-slate-50 px-4 py-10">
      {intro && (
        <aside className="hidden w-full max-w-[380px] flex-col gap-6 lg:flex" aria-label="이 프로그램이 해 주는 일" data-testid="auth-intro">
          <h2 className="text-[1.75rem] leading-snug font-bold break-keep text-slate-900">
            컨설턴트의 하루를
            <br />한 화면에서
          </h2>
          <ul className="flex flex-col gap-4">
            {INTRO.map(({ icon: Icon, title: t, text }) => (
              <li key={t} className="flex items-start gap-3">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-(--radius-control) border border-slate-200 bg-white text-brand-700">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[1rem] font-semibold text-slate-900">{t}</span>
                  <span className="block text-[0.9375rem] break-keep text-slate-600">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[0.9375rem] break-keep text-slate-600">PC 와 휴대폰에서 같은 자료로 이어서 써요.</p>
        </aside>
      )}
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex flex-col items-start gap-2">
          <BrandLogo imgClassName="h-10 max-w-[220px]" />
          <ProductWordmark />
        </div>
        {/* D-594 카카오톡 · 네이버 앱 안에서 열렸을 때만 — 바깥 브라우저로 여는 길 */}
        <InAppBrowserNotice className="mb-4" />
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold break-keep text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[0.9375rem] break-keep text-slate-600">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-[0.9375rem] text-slate-600">{footer}</div>}
        {/* 출시 목록 L-5: 이용약관 · 개인정보처리방침 — 법률 검토가 끝나(LEGAL.ready) 고객에게 보여도 될 때만 */}
        {LEGAL.ready && (
          <p className="mt-4 flex justify-center gap-3 text-[0.875rem] text-slate-500" data-testid="auth-legal">
            <Link to="/terms" className="hover:text-brand-700 hover:underline">
              이용약관
            </Link>
            <span aria-hidden="true">·</span>
            <Link to="/privacy" className="hover:text-brand-700 hover:underline">
              개인정보처리방침
            </Link>
          </p>
        )}
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
      <label htmlFor={id} className="text-[0.9375rem] font-medium text-slate-700">
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
        className="h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 text-[1rem] text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
      />
    </div>
  )
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 text-[0.9375rem] break-keep text-danger-700"
    >
      {message}
    </p>
  )
}

export function AuthNotice({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 text-[0.9375rem] break-keep text-success-700">
      {message}
    </p>
  )
}
