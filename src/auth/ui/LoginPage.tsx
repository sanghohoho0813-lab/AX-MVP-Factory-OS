import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { signInWithPassword } from '../authService'
import { AuthLayout, AuthField, AuthError } from './AuthLayout'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
    // 세션 확립 후 부트스트랩/가드가 목적지를 결정한다.
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout
      title="로그인"
      subtitle="이메일과 비밀번호로 로그인하세요."
      footer={
        <>
          계정이 없으신가요?{' '}
          <Link to="/signup" className="font-semibold text-brand-700 hover:underline">
            회원가입
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <AuthError message={error} />
        <AuthField
          id="email"
          label="이메일"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
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
