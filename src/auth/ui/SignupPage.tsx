import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, MailCheck } from 'lucide-react'
import { loadSignupOpen } from '../../services/selfSignup'
import { cleanSignupFields, signupFormProblem, SIGNUP_FIELD_MAX } from '../../services/signupApproval'
import { Button } from '../../components/ui/Button'
import { signUpWithPassword } from '../authService'
import { AuthLayout, AuthField, AuthError } from './AuthLayout'
import { afterSignInPath } from '../workspaceStorage'

export function SignupPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  // D-635 대표가 승인할 때 누구인지 알 수 있게 — 소속(꼭) · 한 줄 소개(골라서). 전화 · 주민번호는 받지 않는다
  const [company, setCompany] = useState('')
  const [intro, setIntro] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // L-7 · D-610 대표가 '가입하면 바로 쓰기' 를 켜 두었나(서버 0028 · 열림 여부만) — 모르면 지금 문구 그대로
  const [openNow, setOpenNow] = useState(false)
  useEffect(() => {
    let alive = true
    void loadSignupOpen().then((v) => {
      if (alive) setOpenNow(v)
    })
    return () => {
      alive = false
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setErrorKind(null)
    const problem = signupFormProblem({ name, company, email, password, confirm })
    if (problem) {
      setError(problem)
      return
    }
    const f = cleanSignupFields({ name, company, intro })
    setSubmitting(true)
    const result = await signUpWithPassword(email.trim(), password, f.name || undefined, { company: f.company, intro: f.intro })
    if (!result.ok) {
      setError(result.errorMessage ?? '회원가입에 실패했습니다.')
      setErrorKind(result.errorKind ?? null)
      setSubmitting(false)
      return
    }
    if (!result.session) {
      // 이메일 확인이 필요한 설정 — D-635 폼 대신 '가입 신청 접수' 한 장(1 → 2 → 3)
      // 첫날 걸어 보기 — 어느 주소로 갔는지 · 안 보이면 스팸함(확인 메일을 못 찾는 것이 가입에서 가장 흔한 막힘)
      setSentTo(email.trim())
      setSubmitting(false)
      return
    }
    navigate(afterSignInPath(), { replace: true })
  }

  if (sentTo) return <SignupDone email={sentTo} openNow={openNow} />

  return (
    <AuthLayout
      intro
      title="회원가입"
      subtitle="이름 · 소속 · 이메일 · 비밀번호를 적어 주세요."
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
              className="inline-flex h-9 items-center rounded-(--radius-control) border border-slate-200 bg-white px-3 text-[0.9375rem] font-semibold text-brand-700 hover:bg-brand-100"
            >
              로그인하러 가기
            </Link>
            <Link
              to="/forgot-password"
              className="inline-flex h-9 items-center rounded-(--radius-control) border border-slate-300 bg-white px-3 text-[0.9375rem] font-medium text-slate-700 hover:bg-slate-50"
            >
              비밀번호 찾기
            </Link>
          </div>
        )}
        <AuthField id="name" label="이름" value={name} onChange={setName} autoComplete="name" placeholder="홍길동" disabled={submitting} maxLength={SIGNUP_FIELD_MAX.name} />
        <AuthField id="company" label="소속" value={company} onChange={setCompany} autoComplete="organization" placeholder="회사 이름 · 없으면 개인" disabled={submitting} maxLength={SIGNUP_FIELD_MAX.company} />
        <AuthField id="intro" label="한 줄 소개" hint="(골라서)" value={intro} onChange={setIntro} placeholder="예: 정책자금 상담 5년차" required={false} disabled={submitting} maxLength={SIGNUP_FIELD_MAX.intro} />
        <AuthField id="email" label="이메일" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.com" disabled={submitting} />
        <AuthField id="password" label="비밀번호" type="password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="6자 이상" disabled={submitting} />
        <AuthField id="confirm" label="비밀번호 확인" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" disabled={submitting} />
        {/* D-579 가입만으로는 열리지 않는다(승인된 계정만) — 가입하기 전에 미리 알려 준다 · D-610 바로 쓰기가 켜져 있으면 그렇게
            D-635 대표 승인: 가입 신청 → 메일 확인 → 승인되면 바로 */}
        <p className="text-[0.9375rem] break-keep text-slate-600" data-testid="signup-approval-note" data-open={openNow ? '1' : '0'}>
          {openNow ? '가입하고 메일 확인까지 마치면 바로 시작할 수 있어요.' : '가입 신청 → 메일 확인 → 대표가 승인하면 이 계정으로 바로 쓸 수 있어요.'}
        </p>
        <Button type="submit" variant="primary" disabled={submitting} className="h-12 w-full text-[1rem] font-semibold sm:h-12">
          {submitting ? '가입 중…' : openNow ? '회원가입' : '가입 신청'}
        </Button>
      </form>
    </AuthLayout>
  )
}

/** D-635 가입 신청을 받은 뒤 — 폼 대신 한 장: ✓ 가입 신청 → 메일 확인 → 승인(또는 바로 시작) · [로그인하러 가기] */
function SignupDone({ email, openNow }: { email: string; openNow: boolean }) {
  const steps: { done: boolean; title: string; sub: string }[] = [
    { done: true, title: '가입 신청을 받았어요', sub: '' },
    { done: false, title: '메일함에서 확인 링크 누르기', sub: `${email} · 안 보이면 스팸함도` },
    openNow
      ? { done: false, title: '로그인하면 바로 시작', sub: '작업공간 이름만 정하면 열려요' }
      : { done: false, title: '대표 승인 뒤 바로 사용', sub: '승인되면 로그인한 화면이 저절로 열려요' },
  ]
  return (
    <AuthLayout intro title="가입 신청 접수" subtitle={openNow ? '메일 확인만 남았어요.' : '대표 승인 뒤 쓸 수 있어요.'}>
      <div className="flex flex-col gap-4" data-testid="signup-done" data-open={openNow ? '1' : '0'}>
        <ol className="flex flex-col gap-3">
          {steps.map((st, i) => (
            <li key={st.title} className="flex items-start gap-3" data-step={i + 1} data-done={st.done ? '1' : '0'}>
              {st.done ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success-700" />
              ) : i === 1 ? (
                <MailCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-700" />
              ) : (
                <Circle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-slate-400" />
              )}
              <span className="min-w-0">
                <span className="block text-[1rem] font-semibold break-keep text-slate-900">{st.title}</span>
                {st.sub && (
                  <span className="block text-[0.9375rem] break-all text-slate-600" data-testid={i === 1 ? 'signup-done-email' : undefined}>
                    {st.sub}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
        <Link
          to="/login"
          className="inline-flex h-12 w-full items-center justify-center rounded-(--radius-control) bg-brand-600 text-[1rem] font-semibold text-white hover:bg-brand-700"
          data-testid="signup-done-login"
        >
          로그인하러 가기
        </Link>
      </div>
    </AuthLayout>
  )
}
