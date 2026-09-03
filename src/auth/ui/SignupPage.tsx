import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { signUpWithPassword } from '../authService'
import { AuthLayout, AuthField, AuthError, AuthNotice } from './AuthLayout'

export function SignupPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setErrorKind(null)
    setNotice(null)
    if (password.length < 6) {
      setError('비밀번호는 6자 이상으로 설정해 주세요.')
      return
    }
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    setSubmitting(true)
    const result = await signUpWithPassword(email.trim(), password, name.trim() || undefined)
    if (!result.ok) {
      setError(result.errorMessage ?? '회원가입에 실패했습니다.')
      setErrorKind(result.errorKind ?? null)
      setSubmitting(false)
      return
    }
    if (!result.session) {
      // 이메일 확인이 필요한 설정
      setNotice('가입 확인 메일을 보냈습니다. 메일의 링크로 인증한 뒤 로그인해 주세요.')
      setSubmitting(false)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout
      title="회원가입"
      subtitle="새 계정을 만들어 클라우드 워크스페이스를 시작하세요."
      footer={
        <>
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            로그인
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <AuthError message={error} />
        {errorKind === 'email_taken' && (
          <div className="flex flex-wrap gap-2">
            <Link
              to="/login"
              className="inline-flex h-9 items-center rounded-(--radius-control) border border-brand-300 bg-brand-50 px-3 text-[0.92rem] font-semibold text-brand-700 hover:bg-brand-100"
            >
              로그인하러 가기
            </Link>
            <Link
              to="/forgot-password"
              className="inline-flex h-9 items-center rounded-(--radius-control) border border-slate-300 bg-white px-3 text-[0.92rem] font-medium text-slate-700 hover:bg-slate-50"
            >
              비밀번호 찾기
            </Link>
          </div>
        )}
        <AuthNotice message={notice} />
        <AuthField id="name" label="이름" value={name} onChange={setName} autoComplete="name" placeholder="홍길동" disabled={submitting} />
        <AuthField id="email" label="이메일" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.com" disabled={submitting} />
        <AuthField id="password" label="비밀번호" type="password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="6자 이상" disabled={submitting} />
        <AuthField id="confirm" label="비밀번호 확인" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" disabled={submitting} />
        <Button type="submit" variant="primary" disabled={submitting} className="h-11 w-full">
          {submitting ? '가입 중…' : '회원가입'}
        </Button>
      </form>
    </AuthLayout>
  )
}
