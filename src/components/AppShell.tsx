// 앱 셸 — 데스크톱 사이드바 + 모바일 하단 내비게이션.
// 미구현 메뉴(설문·템플릿·데이터)는 비활성 상태로 명확히 표시 (작동하는 척 금지).
import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const NAV = [
  { to: '/', label: '대시보드', icon: '▦', end: true },
  { to: '/projects', label: '프로젝트', icon: '▶', end: false },
  { to: '/companies', label: '고객사', icon: '◆', end: false },
  { to: '/settings', label: '설정', icon: '⚙', end: false },
]

const PLANNED = [
  { label: '설문', tag: 'S2' },
  { label: '판정', tag: 'S3' },
  { label: '템플릿·산출물', tag: 'S5' },
  { label: '자금·평가 데이터', tag: 'S6' },
]

function navCls(isActive: boolean): string {
  return `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
    isActive ? 'bg-navy-800 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-navy-800'
  }`
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut, devMock } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased [word-break:keep-all]">
      {devMock && (
        <div className="bg-amber-400 px-4 py-1.5 text-center text-xs font-bold text-slate-900">
          개발 목(mock) 모드 — 데이터는 저장되지 않으며 새로고침 시 사라집니다
        </div>
      )}
      <div className="mx-auto flex max-w-7xl">
        {/* 데스크톱 사이드바 */}
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-5 lg:flex">
          <Link to="/" className="mb-6 flex items-center gap-2.5 px-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy-800 text-[0.7rem] font-black tracking-tight text-teal-500">AX</span>
            <span className="leading-tight">
              <span className="block text-[0.92rem] font-bold tracking-tight text-navy-900">MVP Factory OS</span>
              <span className="block text-[0.68rem] font-medium text-slate-400">업종 맞춤 AX 설계·운영</span>
            </span>
          </Link>
          <nav className="space-y-1">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => navCls(isActive)}>
                <span className="w-4 text-center text-[0.8rem]" aria-hidden>{n.icon}</span>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="px-3 pb-2 text-[0.68rem] font-bold uppercase tracking-wide text-slate-400">다음 스프린트 제공</p>
            <ul className="space-y-0.5">
              {PLANNED.map((p) => (
                <li key={p.label} className="flex items-center justify-between rounded-lg px-3 py-1.5 text-[0.82rem] font-medium text-slate-300">
                  {p.label}
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.62rem] font-bold text-slate-400">{p.tag}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-auto border-t border-slate-100 pt-3">
            <p className="truncate px-3 text-[0.82rem] font-semibold text-slate-700">{profile?.name || profile?.email || '-'}</p>
            <p className="px-3 text-[0.7rem] font-medium text-slate-400">{profile?.role === 'owner' ? '대표 (owner)' : 'staff'}</p>
            <button type="button" onClick={handleSignOut} className="mt-2 w-full rounded-lg px-3 py-1.5 text-left text-[0.82rem] font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              로그아웃
            </button>
          </div>
        </aside>

        {/* 본문 */}
        <div className="min-w-0 flex-1">
          {/* 모바일 헤더 */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <Link to="/" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-800 text-[0.62rem] font-black text-teal-500">AX</span>
              <span className="text-[0.92rem] font-bold tracking-tight text-navy-900">MVP Factory OS</span>
            </Link>
            <button type="button" onClick={handleSignOut} className="text-[0.8rem] font-semibold text-slate-400">로그아웃</button>
          </header>

          <main className="px-4 pb-24 pt-6 sm:px-6 lg:pb-10">{children}</main>
        </div>
      </div>

      {/* 모바일 하단 내비 */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden" aria-label="주 메뉴">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-[0.68rem] font-semibold ${isActive ? 'text-navy-800' : 'text-slate-400'}`
            }
          >
            <span className="text-[0.95rem]" aria-hidden>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
