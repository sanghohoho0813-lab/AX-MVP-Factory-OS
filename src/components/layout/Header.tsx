import { Link } from 'react-router-dom'
import { useNavPath } from '../../lib/navFrom'
import { DeviceSwitchCompact } from './DeviceView'
import {
  Building,
  Check,
  ChevronDown,
  Menu,
  Settings,
  UserRound,
} from 'lucide-react'
import { Suspense, lazy, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { CURRENT_USER, WORKSPACES } from '../../data/demo'
import { useDismissable } from '../../lib/useDismissable'
import { GlobalSearch } from '../search/GlobalSearch'
import { getDataModeConfig } from '../../data/dataMode'
import { SignalBell } from './SignalBell'
import { TutorialMenuItem } from '../tutorial/TutorialButton'
import { HeaderClock } from './HeaderClock'
import { brand } from '../../brand/brand.config'
import { screenGroupForPath, screenTitleForPath, type NavAccent } from '../../config/moduleRegistry'

/* D-110: 머리줄 묶음 이름 앞 색 띠 — 서랍 메뉴 묶음 띠와 같은 색. 글자와 한 줄로 흐르게 ::before 로 그린다 (통째로 적어야 Tailwind 가 만든다) */
const GROUP_BAR: Record<NavAccent, string> = {
  overview: 'before:bg-nav-overview',
  ops: 'before:bg-nav-ops',
  revenue: 'before:bg-nav-revenue',
  customer: 'before:bg-nav-customer',
  ai: 'before:bg-nav-ai',
  evidence: 'before:bg-nav-evidence',
  alert: 'before:bg-nav-alert',
  system: 'before:bg-nav-system',
}

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
    <div ref={containerRef} className="relative w-[12.5rem] shrink-0 2xl:w-[15rem]">
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
          aria-label="작업공간 선택"
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
          className="flex size-8 items-center justify-center rounded-full bg-navy-900 text-[0.875rem] font-semibold text-white"
        >
          {CURRENT_USER.initial}
        </span>
        <span className="hidden max-w-[160px] text-left leading-tight xl:block">
          <span className="block truncate text-[0.875rem] font-semibold text-slate-800">
            {CURRENT_USER.name}
          </span>
          <span className="block truncate text-[0.875rem] text-slate-400">
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
          <TutorialMenuItem onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}

/**
 * D-256 왼쪽 메뉴를 끌어 넓히면 머리줄 자리가 화면 폭 기준(1360 · 1440 · 1600 …)보다 좁아진다 — 실제로 넘칠 때만
 * 덜 중요한 것부터 뺀다(data-fit 1 · 2: 보기 방식 글자 — 고르지 않은 둘 → 고른 것(D-290) / 3: 넓은 찾기 칸 → 찾기 단추 · 폭 · 저장 글 / 4: 시계 / 5: 고객 플랫폼 · 설정 아이콘). index.css
 * 머리줄 크기나 안 내용이 바뀔 때마다 0 부터 다시 재므로 메뉴를 좁히면 도로 보인다. 한 번에 재고 그려서 깜박이지 않는다.
 */
function useHeaderFit(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let frame = 0
    const fit = () => {
      frame = 0
      // 숨어 있을 때(인쇄 · 무대 뒤)는 재지 않는다 — 폭 0 으로 재면 0 단계로 돌아가 다시 보일 때 잠깐 넘친다(D-290)
      if (el.clientWidth === 0) return
      for (let level = 0; level <= 5; level++) {
        el.dataset.fit = String(level)
        if (el.scrollWidth <= el.clientWidth + 1) return
      }
    }
    const ro = new ResizeObserver(() => {
      if (!frame) frame = requestAnimationFrame(fit)
    })
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    // 글자 크기만 바뀌면 머리줄 칸 크기가 그대로라 위 관찰이 울리지 않을 때가 있다 — 큰 글자 → 기본으로 돌아오면 숨겼던 글자가 다시 나와 넘쳤다(D-290 · SAAS-1 때 시험이 잡음)
    const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(fit)
    })
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-text-scale'] })
    fit()
    return () => {
      ro.disconnect()
      mo?.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref])
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const headerRef = useRef<HTMLElement>(null)
  useHeaderFit(headerRef)
  const isSupabase = getDataModeConfig().mode === 'supabase'
  // D-124: 영업에서 온 업체 화면은 머리줄도 '영업 관리' 그대로
  const pathname = useNavPath()
  const screenTitle = screenTitleForPath(pathname) ?? brand.brandNameKo
  const screenGroup = screenGroupForPath(pathname)
  return (
    <header ref={headerRef} className="no-print sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-[16px] sm:gap-3 lg:px-[24px]">
      <button
        type="button"
        aria-label="메뉴 열기"
        onClick={onOpenMobileMenu}
        className="tap flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-(--radius-control) text-slate-600 hover:bg-slate-100 lg:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      {/*
        모바일 상단에는 지금 어느 화면인지만 둔다. 작업공간 선택·가이드·저장상태·
        설정은 서랍과 '더보기' 로 옮겼다 — 작은 아이콘 대여섯 개가 위에서 경쟁하면
        정작 화면 제목이 안 보인다.
      */}
      {/* D-110: 제목 위에 서랍 메뉴의 묶음 이름을 작게 (영업 › 영업자 정산) — 색 띠는 서랍의 묶음 띠와 같은 색 */}
      <span className="flex min-w-0 flex-1 flex-col lg:hidden">
        {screenGroup && (
          <span
            data-testid="screen-group"
            className={`flex min-w-0 items-center gap-1 text-[0.875rem] leading-tight font-semibold text-slate-500 before:h-2.5 before:w-[3px] before:shrink-0 before:rounded-full before:content-[''] ${GROUP_BAR[screenGroup.accent]}`}
          >
            <span className="truncate">
              {screenGroup.title}
              <span aria-hidden="true" className="ml-1 text-slate-400">
                ›
              </span>
            </span>
          </span>
        )}
        <span className="t-card truncate text-slate-900">{screenTitle}</span>
      </span>
      {/* 휴대폰에서도 지금 몇 시인지는 보인다 (D-87) */}
      <span className="hdr-mclock lg:hidden">
        <HeaderClock />
      </span>

      <span className="hidden lg:contents">
        {isSupabase ? (
          <Suspense fallback={<div className="h-10 w-[12.5rem] shrink-0 2xl:w-[15rem]" />}>
            <SupabaseWorkspaceSelector />
          </Suspense>
        ) : (
          <WorkspaceSelector />
        )}
      </span>

      {/*
        검색은 작업공간 바로 옆, 왼쪽에 붙인다 (D-87).
        가운데에 크게 두었더니 화면 폭의 절반을 먹으면서도 1560px 아래에서는 아예 사라졌다.
        이제 폭을 정해(15rem, 아주 넓은 화면에서 19rem) 왼쪽에 두고, 남는 자리는 오른쪽 시계·단추에 준다.
        폭을 정하는 이유는 D-87 — 전부 shrink 로 두면 좁아질 때 이 칸이 먼저 무너진다.

        1360px 부터 보인다. 1280 에서는 머리띠 내용이 1008px 인데 자리가 977px 뿐이라 화면이 옆으로
        밀렸다(실측). 그 아래에서는 감추고 Ctrl+K 로 연다 — 억지로 줄이면 안내 문구가 잘린다.
      */}
      {/* D-120: 글자 '크게 · 매우 크게' 에서는 넓은 검색 칸 대신 '찾기' 단추(hdr-wide-search · index.css) */}
      <div className="hdr-wide-search hidden w-[15rem] shrink-0 min-[1360px]:block 2xl:w-[19rem]">
        <GlobalSearch />
      </div>

      <div className="hidden flex-1 lg:block" />

      <div className="flex shrink-0 items-center gap-1.5 lg:gap-2.5">
        {/* 오늘이 며칠이고 지금 몇 시인지 — 고객 플랫폼 단추 왼쪽에 크게 (D-87) */}
        <span className="hdr-clock hidden lg:inline-flex">
          <HeaderClock />
        </span>
        {/*
          D-296 대표 "머리줄이 지저분 — 안내 영상 · 고객 플랫폼 · 대표/팀장 단추는 숨기고 설정 안에서만, PC · Mobile 고르기는 접어 두고 눌러서".
          머리줄에서 뺀 것(기능은 그대로): 고객 플랫폼 열기 · 안내 영상 · 대표 ↔ 팀장 화면 → 설정 › 계정 · 보기 / 본문 폭 · 저장 상태 → 설정 › 화면.
          보기 방식은 모든 PC 폭에서 단추 하나(지금 방식 이름 ▾) → 눌러서 PC · Mobile · PC+Mobile.
        */}
        <span className="hidden lg:inline-flex">
          <DeviceSwitchCompact />
        </span>
        {/* D-120: 1360px 아래에서도 찾기 — 예전에는 Ctrl+K 로만 열렸다 */}
        <span className="hdr-compact-search inline-flex min-[1360px]:hidden">
          <GlobalSearch compact />
        </span>
        {/* D-164 대표 ↔ 최은혜 팀장 화면 전환 — D-296 설정 › 계정 · 보기 › 보는 화면에서만. 팀장 화면을 보는 동안에는 본문 위 띠의 [대표로 돌아가기] */}
        <SignalBell />
        <Link
          to="/settings"
          aria-label="설정"
          className="hdr-tight hidden size-10 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:flex"
        >
          <Settings aria-hidden="true" className="size-5" />
        </Link>
        <span className="hidden lg:contents">
          {isSupabase ? (
            <Suspense fallback={<div className="size-10" />}>
              <SupabaseUserMenu />
            </Suspense>
          ) : (
            <UserMenu />
          )}
        </span>
      </div>
    </header>
  )
}
