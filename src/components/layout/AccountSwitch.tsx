/**
 * 계정 바꾸기 (D-184) — 이 기기에서 로그인했던 다른 계정으로 한 번에.
 *
 * '○○ 계정으로 바꾸기' 를 누르면 로그아웃하고, 로그인 화면이 그 계정 이메일을 미리 넣어 둔다 — 비밀번호만 넣으면 된다.
 * 비밀번호는 저장하지 않는다(브라우저가 기억한 비밀번호를 고르면 된다).
 * 다시 로그인하지 않고 팀장 화면을 '보기만' 하는 것은 머리줄 [대표 | 팀장] 전환(D-164)이 따로 한다.
 *
 * 머리줄 사용자 메뉴(PC)와 설정 › 계정 · 보기(D-290)가 같이 쓴다.
 * D-290 왼쪽 아래(사이드바 · 휴대폰 서랍)에는 이름 아래 [로그아웃] 하나만(SignOutButton) — 바꾸기는 설정으로 옮겼다.
 * 로컬 모드(로그인 없음)에서는 아무것도 그리지 않는다.
 */
import { useContext, useState, type ReactNode } from 'react'
import { LogOut, Repeat } from 'lucide-react'
import { AuthContext } from '../../auth/authContext'
import { accountLabel, clearSwitchTarget, otherAccounts, readRecentAccounts, setSwitchTarget } from '../../auth/recentAccounts'

export function AccountSwitchItems({ tone, onPick, signout = true, empty = null }: { tone: 'light' | 'dark'; onPick?: () => void; signout?: boolean; empty?: ReactNode }) {
  const auth = useContext(AuthContext)
  const myEmail = auth?.session?.user.email ?? ''
  // D-189 대표: "팀장 아이디로 들어갔을 때는 본인 것 말고 다른 계정으로 바꿀 수 있는 게 없어야 — 오직 김상호 대표만."
  // 계정 바꾸기는 대표(full) 계정에서만. 팀장(Pilot)은 로그아웃만 보인다.
  const canSwitch = auth?.access === 'full'
  const [others] = useState(() => (canSwitch ? otherAccounts(readRecentAccounts(), myEmail) : []))
  if (!auth || !auth.session) return null
  if (!signout && others.length === 0) return <>{empty}</>
  const row =
    tone === 'dark'
      ? 'text-navy-100 hover:bg-navy-800 hover:text-white'
      : 'text-slate-700 hover:bg-slate-50'
  const icon = tone === 'dark' ? 'text-navy-300' : 'text-slate-400'
  const sub = tone === 'dark' ? 'text-navy-300' : 'text-slate-500'
  const signOut = auth.signOut
  return (
    <div data-testid="account-switch" className="flex flex-col">
      {others.map((o) => {
        const label = accountLabel(o)
        return (
          <button
            key={o.email}
            type="button"
            data-testid="account-switch-to"
            data-email={o.email}
            onClick={() => {
              onPick?.()
              setSwitchTarget(o.email)
              void signOut()
            }}
            className={`tap flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm ${row}`}
          >
            <Repeat aria-hidden="true" className={`size-4 shrink-0 ${icon}`} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold break-keep">{label} 계정으로 바꾸기</span>
              {label !== o.email && <span className={`block truncate text-[0.875rem] ${sub}`}>{o.email}</span>}
            </span>
          </button>
        )
      })}
      {signout && <button
        type="button"
        data-testid="account-signout"
        onClick={() => {
          onPick?.()
          clearSwitchTarget()
          void signOut()
        }}
        className={`tap flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm ${row}`}
      >
        <LogOut aria-hidden="true" className={`size-4 shrink-0 ${icon}`} /> 로그아웃
      </button>}
    </div>
  )
}

/**
 * D-290 왼쪽 아래(사이드바 · 휴대폰 서랍) — 이름 아래 [로그아웃] 하나.
 * 대표: "왼쪽 아래엔 김상호 대표, 로그아웃만 두고 나머지는 다 설정 안에."
 * 접힌 사이드바에서는 아이콘만(손을 올리면 이름표).
 */
export function SignOutButton({ collapsed = false, testId = 'account-signout' }: { collapsed?: boolean; testId?: string }) {
  const auth = useContext(AuthContext)
  if (!auth || !auth.session) return null
  const signOut = auth.signOut
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={collapsed ? '로그아웃' : undefined}
      data-nav-tip={collapsed ? '로그아웃' : undefined}
      onClick={() => {
        clearSwitchTarget()
        void signOut()
      }}
      className={`tap flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-(--radius-control) px-3 py-2 text-left text-[0.95rem] text-navy-100 hover:bg-navy-800 hover:text-white ${collapsed ? 'justify-center px-0' : ''}`}
    >
      <LogOut aria-hidden="true" className="size-[18px] shrink-0 text-navy-300" />
      {!collapsed && <span>로그아웃</span>}
    </button>
  )
}
