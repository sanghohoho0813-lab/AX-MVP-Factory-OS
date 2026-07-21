import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { sendPasswordReset } from '../authService'
import { AuthLayout, AuthField, AuthError, AuthNotice } from './AuthLayout'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setNotice(null)
    setSubmitting(true)
    const redirectTo = `${window.location.origin}/reset-password`
    const result = await sendPasswordReset(email.trim(), redirectTo)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.errorMessage ?? '요청을 처리하지 못했습니다.')
      return
    }
    // 계정 존재 여부를 드러내지 않도록 중립적으로 안내
    setNotice('입력하신 이메일로 재설정 안내를 보냈습니다. 메일함을 확인해 주세요.')
  }

  return (
    <AuthLayout
      title="비밀번호 재설정"
      subtitle="가입한 이메일을 입력하면 재설정 링크를 보내드립니다."
      footer={
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          로그인으로 돌아가기
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <AuthError message={error} />
        <AuthNotice message={notice} />
        <AuthField id="email" label="이메일" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.com" disabled={submitting} />
        <Button type="submit" variant="primary" disabled={submitting} className="h-11 w-full">
          {submitting ? '전송 중…' : '재설정 링크 보내기'}
        </Button>
      </form>
    </AuthLayout>
  )
}
