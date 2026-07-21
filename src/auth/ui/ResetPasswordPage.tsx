import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { updatePassword } from '../authService'
import { AuthLayout, AuthField, AuthError, AuthNotice } from './AuthLayout'

/**
 * 비밀번호 재설정 완료 화면.
 * Supabase 는 메일 링크로 접속 시 임시 세션을 만들어 detectSessionInUrl 로 복구한다.
 * 이 화면에서 새 비밀번호를 설정한다.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
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
    const result = await updatePassword(password)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.errorMessage ?? '비밀번호를 변경하지 못했습니다.')
      return
    }
    setNotice('비밀번호가 변경되었습니다. 잠시 후 이동합니다.')
    setTimeout(() => navigate('/', { replace: true }), 1200)
  }

  return (
    <AuthLayout title="새 비밀번호 설정" subtitle="사용할 새 비밀번호를 입력하세요.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <AuthError message={error} />
        <AuthNotice message={notice} />
        <AuthField id="password" label="새 비밀번호" type="password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="6자 이상" disabled={submitting} />
        <AuthField id="confirm" label="새 비밀번호 확인" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" disabled={submitting} />
        <Button type="submit" variant="primary" disabled={submitting} className="h-11 w-full">
          {submitting ? '변경 중…' : '비밀번호 변경'}
        </Button>
      </form>
    </AuthLayout>
  )
}
