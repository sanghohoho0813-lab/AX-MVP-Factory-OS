// 로그인 — owner 전용 (가입 UI 없음: 계정은 Supabase 대시보드에서 생성)
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Button, ErrorNote, Field, inputCls } from '../components/ui'

export default function LoginPage() {
  const { signIn, configured, devMock } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      navigate('/', { replace: true })
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : '로그인에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-5 [word-break:keep-all]">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-navy-800 text-sm font-black tracking-tight text-teal-500">AX</span>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-navy-900">AX MVP Factory OS</h1>
          <p className="mt-1 text-sm text-slate-500">업종 맞춤형 AX MVP 설계·제작 운영 시스템</p>
        </div>

        {!configured ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-800">
            <p className="font-bold">환경변수 설정이 필요합니다</p>
            <p className="mt-1.5">
              <code className="rounded bg-amber-100 px-1">.env.example</code> 을 <code className="rounded bg-amber-100 px-1">.env</code> 로
              복사한 뒤 이 프로젝트 전용 Supabase URL/키를 입력하고 다시 실행해 주세요.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <Field label="이메일" required>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email" required placeholder="owner@example.com" className={inputCls}
                />
              </Field>
              <Field label="비밀번호" required>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password" required placeholder="••••••••" className={inputCls}
                />
              </Field>
              <ErrorNote msg={err} />
              <Button type="submit" disabled={busy} variant="primary">
                {busy ? '확인 중…' : '로그인'}
              </Button>
            </div>
            <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-400">
              내부 운영 도구입니다. 계정은 Supabase 대시보드(Authentication)에서 생성합니다.
              {devMock && ' (목 모드: 아무 이메일/비밀번호로 로그인됩니다)'}
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
