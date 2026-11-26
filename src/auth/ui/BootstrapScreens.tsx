/**
 * 부트스트랩 상태별 전체 화면. 흰 화면·무한 로딩을 방지하고 각 상태를 명시적으로 보여준다.
 * 조용히 local 모드로 fallback 하지 않는다.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, CheckCircle2, Circle, Copy, Hourglass, Loader2, LogOut, RefreshCw, Settings2, ShieldAlert, WifiOff } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import {
  defaultWorkspaceName,
  loadSelfSignupState,
  selfSignupStartText,
  startSelfSignup,
  type SelfSignupState,
} from '../../services/selfSignup'
import { loadMySignupStatus, type MySignupStatus } from '../../services/signupApproval'

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-[460px] rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {children}
      </div>
    </div>
  )
}

export function InitializingScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50">
      <Loader2 aria-hidden="true" className="size-7 animate-spin text-brand-500" />
      <p className="text-sm text-slate-500">불러오는 중…</p>
    </div>
  )
}

/** 안내문에 올바른 값이 들어있으면 그 값만 뽑아 복사 버튼을 붙인다 */
function extractSuggestedUrl(detail?: string): string | null {
  if (!detail) return null
  const m = /https:\/\/[a-z0-9-]+\.supabase\.co/i.exec(detail)
  return m ? m[0] : null
}

function CopyableValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-3 rounded-(--radius-card) border border-slate-200 bg-white p-3 text-left">
      <p className="text-[12px] font-semibold text-brand-700">이 값을 그대로 넣으세요</p>
      <div className="mt-1.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-slate-800">{value}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value).catch(() => undefined)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-(--radius-control) border border-brand-300 bg-white px-2 py-1 text-[12px] font-semibold text-brand-700 hover:bg-brand-100"
        >
          {copied ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
    </div>
  )
}

export function ConfigurationErrorScreen({
  detail,
  missingKeys,
}: {
  detail?: string
  missingKeys?: string[]
}) {
  const suggested = extractSuggestedUrl(detail)
  return (
    <CenteredCard>
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning-100 text-warning-700">
        <Settings2 aria-hidden="true" className="size-6" />
      </span>
      <h1 className="mt-4 text-lg font-bold text-slate-900">클라우드 설정이 필요합니다</h1>
      <p className="mt-2 text-[1rem] break-keep text-slate-700">
        {detail ?? '클라우드 저장 모드에 필요한 환경변수가 올바르지 않습니다.'}
      </p>
      {missingKeys && missingKeys.length > 0 && (
        <ul className="mt-4 rounded-(--radius-card) border border-slate-200 bg-slate-50 px-4 py-3 text-left text-[13px] text-slate-600">
          {missingKeys.map((k) => (
            <li key={k} className="font-mono">• {k}</li>
          ))}
        </ul>
      )}
      {suggested && <CopyableValue value={suggested} />}

      <div className="mt-4 rounded-(--radius-card) border border-slate-200 bg-slate-50 px-4 py-3 text-left text-[13px] break-keep text-slate-600">
        <p className="font-semibold text-slate-700">고치는 방법</p>
        <ol className="mt-1.5 flex list-decimal flex-col gap-1 pl-4">
          <li>Vercel → 이 프로젝트 → <b>Settings</b> → <b>Environment Variables</b></li>
          <li>위 값으로 수정하고 <b>Save</b></li>
          <li>
            <b>Deployments</b> 탭 → 맨 위 배포의 <b>⋯</b> → <b>Redeploy</b>
            <span className="block text-slate-500">환경변수는 다시 배포해야 반영됩니다.</span>
          </li>
        </ol>
        <p className="mt-2 text-slate-500">
          내 컴퓨터에서 직접 실행하는 경우에는 <code>.env.example</code> 를 참고해 <code>.env</code> 를 만드세요.
        </p>
      </div>

      <p className="mt-3 text-[12px] break-keep text-slate-400">
        브라우저에는 공개 키(anon 또는 sb_publishable)만 사용합니다. service_role·sb_secret 키는 넣지 마세요.
      </p>
      <Button variant="secondary" className="mt-5 w-full" onClick={() => window.location.reload()}>
        <RefreshCw aria-hidden="true" className="size-4" /> 다시 시도
      </Button>
    </CenteredCard>
  )
}

export function ConnectionErrorScreen({ detail, onRetry }: { detail?: string; onRetry: () => void }) {
  return (
    <CenteredCard>
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger-100 text-danger-700">
        <WifiOff aria-hidden="true" className="size-6" />
      </span>
      <h1 className="mt-4 text-lg font-bold text-slate-900" data-testid="connection-error">연결에 실패했습니다</h1>
      <p className="mt-2 text-[1rem] break-keep text-slate-700">
        {detail ?? '서버에 연결하지 못했어요.'}
      </p>
      {/* D-678 무엇을 하면 되는지 · 자료는 안전한지 — 회사 이름 · 기술 말 없이 */}
      <p className="mt-2 text-[1rem] break-keep text-slate-700" data-testid="connection-error-how">
        인터넷(와이파이 · 데이터)을 확인한 뒤 <b>다시 시도</b>를 눌러 주세요. 저장해 둔 자료는 그대로 있어요.
      </p>
      <Button variant="primary" className="mt-5 h-12 w-full text-[1rem] font-semibold sm:h-12" onClick={onRetry} data-testid="connection-error-retry">
        <RefreshCw aria-hidden="true" className="size-4" /> 다시 시도
      </Button>
    </CenteredCard>
  )
}

/**
 * D-162: 로그인은 됐지만 접근 목록에 없는 계정(방금 가입한 사람 · 공개 사이트 가입자 등) — 아무 화면도 열지 않는다.
 * D-579: 방금 가입한 사람이 맨 먼저 보는 화면이다 — '쓸 수 없습니다 · 관리자에게 문의' 한 줄로 끝내지 않고,
 *        무엇을 하면 되는지(가입한 이메일을 담당자에게 알려 주기 → 승인되면 다시 확인)와 그 이메일 · [복사] 를 보여 준다.
 *        권한은 그대로다(승인 전에는 어떤 화면 · 자료도 열리지 않는다).
 * L-7 · D-610: 대표가 '가입하면 바로 쓰기' 를 켜 두었으면(서버 0028) 기다리는 대신 [바로 시작하기] 한 번 — 서버가 계정을 연다.
 *        꺼져 있거나 · 자리가 다 찼거나 · 0028 전이면 지금 화면 그대로.
 * D-635: 내부 OS 가입 화면으로 가입한 사람은 '가입 신청 접수 — 대표 승인 뒤 쓸 수 있어요'(대표가 앱에서 승인 · 거절 — 서버 0029).
 *        창으로 돌아올 때 · [다시 확인] · 1분마다 다시 물어 승인되면 바로 앱으로. 거절되면 '가입이 승인되지 않았어요'.
 *        홈페이지에서만 가입한 사람 · 팀장 초대를 기다리는 사람 · 0029 전에는 예전 '승인 전' 화면 그대로.
 */
export function NoAccessScreen({ onSignOut, email = '', name = '' }: { onSignOut: () => void; email?: string; name?: string }) {
  const [state, setState] = useState<SelfSignupState | null>(null)
  const [signup, setSignup] = useState<MySignupStatus>('missing')
  const [note, setNote] = useState('')
  useEffect(() => {
    let alive = true
    void Promise.all([loadSelfSignupState(), loadMySignupStatus()]).then(([s, m]) => {
      if (!alive) return
      // 그 사이 계정이 열렸다(대표가 승인했거나 다른 창에서 시작) — 새로 열면 앱으로 간다
      if (s === 'has_access' || m === 'has_access') window.location.reload()
      setSignup(m)
      setState(s)
      if (s === 'unconfirmed') setNote(selfSignupStartText('unconfirmed'))
    })
    return () => {
      alive = false
    }
  }, [])
  if (state === null) {
    return (
      <CenteredCard>
        <p role="status" className="flex items-center justify-center gap-2 text-[1rem] text-slate-700" data-testid="no-access-checking">
          <Loader2 aria-hidden="true" className="size-5 animate-spin text-brand-500" /> 계정을 확인하는 중…
        </p>
      </CenteredCard>
    )
  }
  if (state === 'open') {
    return (
      <SelfStartCard
        email={email}
        name={name}
        onSignOut={onSignOut}
        onClosed={(text) => {
          setNote(text)
          setState('closed')
        }}
      />
    )
  }
  if (signup === 'pending' || signup === 'unconfirmed' || signup === 'rejected') {
    return <SignupStatusCard onSignOut={onSignOut} email={email} initial={signup} />
  }
  return <WaitingCard onSignOut={onSignOut} email={email} note={note} />
}

/** D-635 로그인한 이메일 한 줄 + [복사] — 담당자에게 알려 줄 때 */
function EmailRow({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)
  if (!email) return null
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // 복사가 막힌 브라우저 — 이메일은 화면에 그대로 보인다
    }
  }
  return (
    <div className="mt-4 flex items-center gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5 text-left" data-testid="no-access-email">
      <span className="min-w-0 flex-1">
        <span className="block text-[0.875rem] text-slate-600">로그인한 이메일</span>
        <span className="block truncate text-[1rem] font-semibold text-slate-900">{email}</span>
      </span>
      <button
        type="button"
        onClick={() => void copy()}
        data-testid="no-access-copy"
        className="tap inline-flex min-h-11 shrink-0 items-center gap-1 rounded-(--radius-control) border border-slate-300 bg-white px-3 text-[0.9375rem] font-semibold text-slate-800 hover:bg-slate-50"
      >
        {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
        {copied ? '복사했어요' : '복사'}
      </button>
    </div>
  )
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * D-635 가입 신청 접수(대표 승인 기다림) · 메일 확인 전 · 거절됨 — 한 장.
 *  - 다시 묻는 때: [다시 확인] · 창으로 돌아올 때(15초에 한 번까지) · 화면이 보이는 동안 1분마다. 승인되면 새로 열어 앱으로.
 *  - 거절된 사람도 [다시 확인] 은 남긴다(대표가 나중에 승인할 수 있다).
 */
function SignupStatusCard({ onSignOut, email, initial }: { onSignOut: () => void; email: string; initial: MySignupStatus }) {
  const [status, setStatus] = useState<MySignupStatus>(initial)
  const [busy, setBusy] = useState(false)
  const [checkedAt, setCheckedAt] = useState('')
  const lastAt = useRef(0)
  const recheck = useCallback(async (manual: boolean) => {
    if (!manual && Date.now() - lastAt.current < 15_000) return
    lastAt.current = Date.now()
    if (manual) setBusy(true)
    const m = await loadMySignupStatus()
    if (m === 'has_access') {
      window.location.reload()
      return
    }
    if (m === 'pending' || m === 'unconfirmed' || m === 'rejected') setStatus(m)
    const d = new Date()
    setCheckedAt(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`)
    if (manual) setBusy(false)
  }, [])
  useEffect(() => {
    lastAt.current = Date.now()
    const back = () => {
      if (document.visibilityState === 'visible') void recheck(false)
    }
    window.addEventListener('focus', back)
    document.addEventListener('visibilitychange', back)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void recheck(false)
    }, 60_000)
    return () => {
      window.removeEventListener('focus', back)
      document.removeEventListener('visibilitychange', back)
      window.clearInterval(timer)
    }
  }, [recheck])

  const rejected = status === 'rejected'
  const unconfirmed = status === 'unconfirmed'
  const steps: { key: string; title: string; state: 'done' | 'now' | 'next' }[] = [
    { key: 'apply', title: '가입 신청', state: 'done' },
    { key: 'mail', title: '메일 확인', state: unconfirmed ? 'now' : 'done' },
    { key: 'approve', title: '대표 승인', state: unconfirmed ? 'next' : 'now' },
  ]
  return (
    <CenteredCard>
      <div data-testid={rejected ? 'signup-rejected' : 'signup-pending'} data-signup={status}>
        <span className={`mx-auto flex size-12 items-center justify-center rounded-full bg-slate-100 ${rejected ? 'text-slate-600' : 'text-brand-700'}`}>
          {rejected ? <ShieldAlert aria-hidden="true" className="size-6" /> : <Hourglass aria-hidden="true" className="size-6" />}
        </span>
        <h1 className="mt-4 text-[1.2rem] font-bold break-keep text-slate-900" data-testid="no-access" data-signup={status}>
          {rejected ? '가입이 승인되지 않았어요' : unconfirmed ? '메일 확인이 남았어요' : '가입 신청 접수 — 대표 승인 뒤 쓸 수 있어요'}
        </h1>
        <p className="mt-2 text-[1rem] break-keep text-slate-700">
          {rejected
            ? '지금은 이 계정으로 쓸 수 없어요. 궁금한 점은 안내받은 담당자에게 아래 이메일과 함께 문의해 주세요.'
            : unconfirmed
              ? '가입할 때 받은 메일의 확인 링크를 눌러 주세요. 그다음 대표가 승인하면 바로 열려요.'
              : '승인되면 이 화면이 저절로 앱으로 바뀌어요. 다시 가입하지 않아도 돼요.'}
        </p>
        {!rejected && (
          <ol className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[0.9375rem]" data-testid="signup-steps">
            {steps.map((st, i) => (
              <li key={st.key} className="flex items-center gap-1.5" data-step={st.key} data-state={st.state}>
                {i > 0 && <span aria-hidden="true" className="text-slate-400">→</span>}
                {st.state === 'done' ? (
                  <CheckCircle2 aria-hidden="true" className="size-4 text-success-700" />
                ) : (
                  <Circle aria-hidden="true" className={`size-4 ${st.state === 'now' ? 'text-brand-700' : 'text-slate-400'}`} />
                )}
                <span className={st.state === 'now' ? 'font-semibold text-brand-700' : st.state === 'done' ? 'text-slate-700' : 'text-slate-600'}>{st.title}</span>
              </li>
            ))}
          </ol>
        )}
        <EmailRow email={email} />
        <Button variant="primary" className="mt-5 h-12 w-full text-[1rem] font-semibold sm:h-12" onClick={() => void recheck(true)} disabled={busy} data-testid="no-access-retry">
          <RefreshCw aria-hidden="true" className={`size-4 ${busy ? 'animate-spin' : ''}`} /> {busy ? '확인하는 중…' : rejected ? '다시 확인' : '승인됐는지 다시 확인'}
        </Button>
        {checkedAt && (
          <p role="status" className="mt-2 text-[0.9375rem] text-slate-600" data-testid="signup-checked">
            {checkedAt} 에 확인했어요 — {rejected ? '아직 승인되지 않았어요' : '아직 승인 전이에요'}
          </p>
        )}
        <Button variant="ghost" className="mt-2 h-11 w-full" onClick={onSignOut} data-testid="no-access-signout">
          <LogOut aria-hidden="true" className="size-4" /> 로그아웃
        </Button>
      </div>
    </CenteredCard>
  )
}

/** L-7 · D-610 '가입하면 바로 쓰기' 가 켜져 있을 때 — 작업공간 이름 하나 · 큰 단추 하나 */
function SelfStartCard({ email, name, onSignOut, onClosed }: { email: string; name: string; onSignOut: () => void; onClosed: (text: string) => void }) {
  const [wsName, setWsName] = useState(() => defaultWorkspaceName(name))
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const go = async () => {
    if (busy) return
    setBusy(true)
    setProblem('')
    try {
      const r = await startSelfSignup(wsName)
      if (r === 'ok' || r === 'has_access') {
        window.location.reload()
        return
      }
      if (r === 'busy' || r === 'unconfirmed') setProblem(selfSignupStartText(r))
      else onClosed(selfSignupStartText(r === 'missing' ? 'closed' : r))
    } catch {
      setProblem('잠깐 연결이 안 됐어요. 잠시 뒤 다시 눌러 주세요.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <CenteredCard>
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-slate-100 text-success-700">
        <CheckCircle2 aria-hidden="true" className="size-6" />
      </span>
      <h1 className="mt-4 text-[1.2rem] font-bold break-keep text-slate-900" data-testid="self-start-title">
        바로 시작할 수 있어요
      </h1>
      <p className="mt-2 text-[1rem] break-keep text-slate-700">
        가입을 마쳤어요. 내 작업공간 이름을 정하고 [바로 시작하기] 를 누르면 바로 열려요.
      </p>
      <form
        className="mt-4 flex flex-col gap-3 text-left"
        onSubmit={(e) => {
          e.preventDefault()
          void go()
        }}
        data-testid="self-start"
      >
        <label className="flex flex-col gap-1">
          <span className="text-[0.9375rem] font-semibold text-slate-800">작업공간 이름</span>
          <input
            value={wsName}
            onChange={(e) => setWsName(e.target.value)}
            maxLength={40}
            className="min-h-12 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 text-[1rem] text-slate-900 focus:border-brand-500 focus:outline-none"
            data-testid="self-start-name"
          />
        </label>
        {problem && (
          <p role="alert" className="text-[0.9375rem] break-keep text-danger-700" data-testid="self-start-problem">
            {problem}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={busy} className="h-12 w-full text-[1rem] font-semibold sm:h-12" data-testid="self-start-go">
          {busy ? '여는 중…' : '바로 시작하기'}
        </Button>
      </form>
      <p className="mt-3 text-[0.9375rem] break-keep text-slate-600">
        내 업체 · 서류 · 기록은 나만 봐요. 운영자도 볼 수 없어요.
      </p>
      {email && <p className="mt-1 truncate text-[0.9375rem] text-slate-600">{email}</p>}
      <Button variant="ghost" className="mt-2 h-11 w-full" onClick={onSignOut} data-testid="no-access-signout">
        <LogOut aria-hidden="true" className="size-4" /> 로그아웃
      </Button>
    </CenteredCard>
  )
}

/** D-579 아직 사용 승인 전 — 이메일 · [복사] · [승인됐는지 다시 확인] · [로그아웃] */
function WaitingCard({ onSignOut, email, note }: { onSignOut: () => void; email: string; note: string }) {
  return (
    <CenteredCard>
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        <ShieldAlert aria-hidden="true" className="size-6" />
      </span>
      <h1 className="mt-4 text-[1.2rem] font-bold break-keep text-slate-900" data-testid="no-access">
        이 계정은 아직 사용 승인 전이에요
      </h1>
      <p className="mt-2 text-[1rem] break-keep text-slate-700">
        승인된 계정만 쓸 수 있는 프로그램이에요. 사용을 신청하셨다면 안내받은 담당자에게 아래 이메일을 알려 주세요 — 승인되면 이 계정으로 바로 열려요.
      </p>
      {note && (
        <p role="status" className="mt-2 text-[1rem] break-keep text-slate-800" data-testid="no-access-note">
          {note}
        </p>
      )}
      <EmailRow email={email} />
      <Button variant="primary" className="mt-5 h-12 w-full text-[1rem] font-semibold sm:h-12" onClick={() => window.location.reload()} data-testid="no-access-retry">
        <RefreshCw aria-hidden="true" className="size-4" /> 승인됐는지 다시 확인
      </Button>
      <Button variant="ghost" className="mt-2 h-11 w-full" onClick={onSignOut} data-testid="no-access-signout">
        <LogOut aria-hidden="true" className="size-4" /> 로그아웃
      </Button>
    </CenteredCard>
  )
}

/** D-162: 이 브라우저에 다른 계정 자료가 남아 있는데 옮기지 못했다(저장 공간 가득 등) — 섞이지 않게 열지 않는다 */
export function StorageBlockedScreen({ onSignOut }: { onSignOut: () => void }) {
  return (
    <CenteredCard>
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning-100 text-warning-800">
        <ShieldAlert aria-hidden="true" className="size-6" />
      </span>
      <h1 className="mt-4 text-lg font-bold text-slate-900" data-testid="storage-blocked">이 브라우저에서는 열 수 없습니다</h1>
      <p className="mt-2 text-[1rem] break-keep text-slate-700">
        이 브라우저의 저장 공간이 가득 차서 다른 계정이 쓰던 자료를 따로 넣어 두지 못했습니다. 섞이지 않도록 열지 않았습니다(아무것도 지우지 않았습니다). 다른 브라우저나 기기에서 로그인해 주세요.
      </p>
      <Button variant="primary" className="mt-5 w-full" onClick={onSignOut}>
        <LogOut aria-hidden="true" className="size-4" /> 로그아웃
      </Button>
    </CenteredCard>
  )
}
