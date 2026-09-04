import { Link } from 'react-router-dom'
import { TextScaleControl } from '../ui/TextScaleControl'
import {
  Building,
  Check,
  ChevronDown,
  ExternalLink,
  Menu,
  Settings,
  UserRound,
} from 'lucide-react'
import { Suspense, lazy, useState } from 'react'
import { CURRENT_USER, WORKSPACES } from '../../data/demo'
import { useDismissable } from '../../lib/useDismissable'
import { GlobalSearch } from '../search/GlobalSearch'
import { GuideButton } from '../onboarding/GuideButton'
import { getDataModeConfig } from '../../data/dataMode'
import { CloudSaveStatus } from '../cloud/CloudSaveStatus'
import { SignalBell } from './SignalBell'
import { brand } from '../../brand/brand.config'

// supabase 전용 헤더 조각은 lazy 로 불러와 local entry 번들에 Supabase SDK 가 섞이지 않게 한다.
const SupabaseWorkspaceSelector = lazy(() =>
  import('./SupabaseHeaderParts').then((m) => ({ default: m.SupabaseWorkspaceSelector })),
)
const SupabaseUserMenu = lazy(() =>
  import('./SupabaseHeaderParts').then((m) => ({ default: m.SupabaseUserMenu })),
)

interface HeaderProps {
  onOpenMobileMenu: () => void
}

function WorkspaceSelector() {
  const { open, setOpen, containerRef } = useDismissable<HTMLDivElement>()
  const [workspace, setWorkspace] = useState<string>(WORKSPACES[0])

  return (
    <div ref={containerRef} className="relative min-w-0 max-w-[34vw] shrink">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full min-w-0 cursor-pointer items-center gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
      >
        <Building aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
        <span className="truncate">{workspace}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="워크스페이스 선택"
          className="absolute top-full left-0 z-30 mt-1.5 w-60 rounded-(--radius-card) border border-slate-200 bg-white p-1.5 shadow-(--shadow-overlay)"
        >
          {WORKSPACES.map((ws) => (
            <li key={ws}>
              <button
                type="button"
                role="option"
                aria-selected={ws === workspace}
                onClick={() => {
                  setWorkspace(ws)
                  setOpen(false)
                }}
                className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="truncate">{ws}</span>
                {ws === workspace && (
                  <Check aria-hidden="true" className="size-4 shrink-0 text-brand-600" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function UserMenu() {
  const { open, setOpen, containerRef } = useDismissable<HTMLDivElement>()

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="사용자 메뉴"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 cursor-pointer items-center gap-2.5 rounded-(--radius-control) px-1.5 hover:bg-slate-100 sm:px-2"
      >
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-full bg-navy-900 text-[13px] font-semibold text-white"
        >
          {CURRENT_USER.initial}
        </span>
        <span className="hidden max-w-[160px] text-left leading-tight xl:block">
          <span className="block truncate text-[13px] font-semibold text-slate-800">
            {CURRENT_USER.name}
          </span>
          <span className="block truncate text-[0.8125rem] text-slate-400">
            {CURRENT_USER.role}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="hidden size-4 text-slate-400 xl:block"
        />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-1.5 w-52 rounded-(--radius-card) border border-slate-200 bg-white p-1.5 shadow-(--shadow-overlay)">
          <div className="border-b border-slate-100 px-3 py-2.5 xl:hidden">
            <p className="text-sm font-semibold text-slate-800">
              {CURRENT_USER.name}
            </p>
            <p className="text-[0.875rem] text-slate-400">{CURRENT_USER.role}</p>
          </div>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <UserRound aria-hidden="true" className="size-4 text-slate-400" />
            내 정보
          </Link>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Settings aria-hidden="true" className="size-4 text-slate-400" />
            설정
          </Link>
          <div className="mt-1 border-t border-slate-100 px-3 pt-2.5 pb-1.5">
            <p className="mb-1.5 text-[0.875rem] font-semibold text-slate-500">글자 크기</p>
            <TextScaleControl compact />
          </div>
        </div>
      )}
    </div>
  )
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const isSupabase = getDataModeConfig().mode === 'supabase'
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-[16px] sm:gap-3 lg:px-[24px]">
      <button
        type="button"
        aria-label="메뉴 열기"
        onClick={onOpenMobileMenu}
        className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-(--radius-control) text-slate-600 hover:bg-slate-100 lg:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      {isSupabase ? (
        <Suspense fallback={<div className="h-10 min-w-0 max-w-[34vw] shrink" />}>
          <SupabaseWorkspaceSelector />
        </Suspense>
      ) : (
        <WorkspaceSelector />
      )}

      <div className="flex min-w-0 flex-1 items-center justify-center px-1 sm:px-4">
        <div className="hidden w-full max-w-xl sm:block">
          <GlobalSearch />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {/* 고객이 보는 표면으로 건너가는 문 — 새 탭. 로그인 세션은 공유하지 않는다(가짜 SSO 금지). */}
        <a
          href={brand.customerPlatformUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden h-10 items-center gap-1.5 rounded-(--radius-control) border border-slate-200 px-3 text-[0.9rem] font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 md:inline-flex"
        >
          <ExternalLink aria-hidden="true" className="size-4 text-slate-400" />
          {brand.customerPlatformLabel}
        </a>
        <GuideButton />
        <span className="hidden xl:inline-flex">
          <CloudSaveStatus state={isSupabase ? 'saved' : 'local'} compact={false} />
        </span>
        <SignalBell />
        <Link
          to="/settings"
          aria-label="설정"
          className="hidden size-10 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:flex"
        >
          <Settings aria-hidden="true" className="size-5" />
        </Link>
        {isSupabase ? (
          <Suspense fallback={<div className="size-10" />}>
            <SupabaseUserMenu />
          </Suspense>
        ) : (
          <UserMenu />
        )}
      </div>
    </header>
  )
}
