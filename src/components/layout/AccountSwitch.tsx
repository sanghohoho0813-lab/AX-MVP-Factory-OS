/**
 * 계정 바꾸기 (D-184) — 이 기기에서 로그인했던 다른 계정으로 한 번에.
 *
 * '○○ 계정으로 바꾸기' 를 누르면 로그아웃하고, 로그인 화면이 그 계정 이메일을 미리 넣어 둔다 — 비밀번호만 넣으면 된다.
 * 비밀번호는 저장하지 않는다(브라우저가 기억한 비밀번호를 고르면 된다).
 * 다시 로그인하지 않고 팀장 화면을 '보기만' 하는 것은 머리줄 [대표 | 팀장] 전환(D-164)이 따로 한다.
 *
 * 머리줄 사용자 메뉴(PC)와 휴대폰 서랍(더보기)이 같이 쓴다 — 휴대폰에는 예전에 로그아웃 단추가 없었다.
 * 로컬 모드(로그인 없음)에서는 아무것도 그리지 않는다.
 */
import { useContext, useState } from 'react'
import { LogOut, Repeat } from 'lucide-react'
import { AuthContext } from '../../auth/authContext'
import { accountLabel, clearSwitchTarget, otherAccounts, readRecentAccounts, setSwitchTarget } from '../../auth/recentAccounts'

export function AccountSwitchItems({ tone, onPick }: { tone: 'light' | 'dark'; onPick?: () => void }) {
  const auth = useContext(AuthContext)
  const myEmail = auth?.session?.user.email ?? ''
  const [others] = useState(() => otherAccounts(readRecentAccounts(), myEmail))
  if (!auth || !auth.session) return null
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
      <button
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
      </button>
    </div>
  )
}
