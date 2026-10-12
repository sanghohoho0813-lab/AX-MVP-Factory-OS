import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { signInWithPassword } from '../authService'
import {
  accountLabel,
  clearSwitchTarget,
  forgetAccount,
  normalizeEmail,
  peekSwitchTarget,
  readRecentAccounts,
  type RecentAccount,
} from '../recentAccounts'
import { AuthLayout, AuthField, AuthError } from './AuthLayout'

function focusPassword(): void {
  window.setTimeout(() => document.getElementById('password')?.focus(), 0)
}

export function LoginPage() {
  const navigate = useNavigate()
  // D-184: 이 기기에서 로그인했던 계정(이메일 · 이름만) — 누르면 이메일이 들어가고 비밀번호 칸으로 간다
  const [accounts, setAccounts] = useState<RecentAccount[]>(() => readRecentAccounts())
  // 메뉴에서 '○○ 계정으로 바꾸기' 를 누르고 왔으면 그 이메일을 미리 넣는다
  const [target] = useState(() => peekSwitchTarget())
  const [email, setEmail] = useState(target)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (target) focusPassword()
  }, [target])

  const chosen = normalizeEmail(email)
  const switching = target ? accounts.find((a) => a.email === target && a.email === chosen) : undefined

  function pick(a: RecentAccount) {
    if (a.email !== target) clearSwitchTarget()
    setEmail(a.email)
    setError(null)
    focusPassword()
  }

  function forget(a: RecentAccount) {
    setAccounts(forgetAccount(a.email))
    if (chosen === a.email) setEmail('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    const result = await signInWithPassword(email.trim(), password)
    if (!result.ok) {
      setError(result.errorMessage ?? '로그인에 실패했습니다.')
      setSubmitting(false)
      return
    }
    clearSwitchTarget()
    // 세션 확립 후 부트스트랩/가드가 목적지를 결정한다.
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout
      title="로그인"
      subtitle={switching ? `${accountLabel(switching)} 계정으로 로그인합니다. 비밀번호만 넣어 주세요.` : '이메일과 비밀번호로 로그인하세요.'}
      footer={
        <>
          계정이 없으신가요?{' '}
          <Link to="/signup" className="font-semibold text-brand-700 hover:underline">
            회원가입
          </Link>
        </>
      }
    >
      {accounts.length > 0 && (
        <section aria-labelledby="recent-accounts-title" data-testid="recent-accounts" className="mb-5">
          <h2 id="recent-accounts-title" className="text-[0.875rem] font-semibold text-slate-700">
            이 기기에서 로그인했던 계정
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {accounts.map((a) => {
              const on = a.email === chosen
              const label = accountLabel(a)
              return (
                <li
                  key={a.email}
                  className={`flex items-center rounded-(--radius-control) border ${on ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <button
                    type="button"
                    data-testid="recent-account"
                    data-email={a.email}
                    aria-pressed={on}
                    disabled={submitting}
                    onClick={() => pick(a)}
                    className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-2 text-left"
                  >
                    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[0.875rem] font-semibold text-white">
                      {(a.name || a.email).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">{label}</span>
                      {label !== a.email && <span className="block truncate text-[0.875rem] text-slate-500">{a.email}</span>}
                    </span>
                    {on && <Check aria-hidden="true" className="size-4 shrink-0 text-brand-600" />}
                  </button>
                  <button
                    type="button"
                    data-testid="recent-forget"
                    aria-label={`${a.email} 이 기기에서 지우기`}
                    title="이 기기에서 지우기"
                    disabled={submitting}
                    onClick={() => forget(a)}
                    className="tap mr-0.5 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-[0.875rem] break-keep text-slate-500">
            누르면 이메일이 들어갑니다 — 비밀번호만 넣으세요. 비밀번호는 이 기기에 저장하지 않습니다.
          </p>
        </section>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <AuthError message={error} />
        <AuthField
          id="email"
          label="이메일"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="username"
          placeholder="you@example.com"
          disabled={submitting}
        />
        <AuthField
          id="password"
          label="비밀번호"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          disabled={submitting}
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-[13px] text-slate-500 hover:text-brand-700 hover:underline">
            비밀번호를 잊으셨나요?
          </Link>
        </div>
        <Button type="submit" variant="primary" disabled={submitting} className="h-11 w-full">
          {submitting ? '로그인 중…' : '로그인'}
        </Button>
      </form>
    </AuthLayout>
  )
}
