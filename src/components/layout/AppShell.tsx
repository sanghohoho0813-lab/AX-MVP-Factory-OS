import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { DemoTourProvider } from '../demo/DemoTourProvider'
import { OnboardingProvider } from '../onboarding/OnboardingProvider'
import { ActiveProjectProvider } from '../../context/ActiveProjectProvider'
import { RouteProjectSync } from '../../context/RouteProjectSync'
import { ContentErrorBoundary } from './ContentErrorBoundary'
import { StorageFullNotice } from './StorageFullNotice'

function ShellFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <span className="text-sm text-slate-400">불러오는 중…</span>
    </div>
  )
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // 라우트 변경 시 모바일 메뉴를 닫고 스크롤을 상단으로
  useEffect(() => {
    setMobileOpen(false)
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <ActiveProjectProvider>
      <RouteProjectSync />
      <DemoTourProvider>
      <OnboardingProvider>
      <div className="flex min-h-screen">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((v) => !v)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header onOpenMobileMenu={() => setMobileOpen(true)} />
          {/* 하단 여백: 시연 안내 바가 본문을 가리지 않도록 확보 */}
          {/* pb-safe-nav: 하단 내비게이션과 iOS 홈 인디케이터가 본문 마지막 줄을 가리지 않게 한다 */}
          <main className="pb-safe-nav mx-auto w-full max-w-[1840px] flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-9 2xl:px-14">
            {/* key: 화면이 바뀔 때마다 등장 효과를 한 번씩 다시 준다.
                모듈(/tools/<모듈>/<화면>) 안에서 화면만 바꿀 때는 그대로 둔다 — 원본 앱의 고른 고객·열린 창이 살아 있어야 한다 (D-93) */}
            <StorageFullNotice />
            <div key={shellKeyOf(location.pathname)} className="ax-rise">
              {/* D-95: 한 화면이 넘어져도 사이드바·머리줄은 남는다. 다른 화면으로 옮기면 풀린다 */}
              <ContentErrorBoundary resetKey={location.pathname}>
                <Suspense fallback={<ShellFallback />}>
                  <Outlet />
                </Suspense>
              </ContentErrorBoundary>
            </div>
          </main>
        </div>
        <MobileNav onOpenMore={() => setMobileOpen(true)} />
      </div>
      </OnboardingProvider>
      </DemoTourProvider>
    </ActiveProjectProvider>
  )
}

/** 본문을 새로 그릴 기준 — 모듈 안의 화면 이동은 같은 것으로 본다 */
function shellKeyOf(pathname: string): string {
  const m = /^\/tools\/([^/]+)/.exec(pathname)
  return m ? `/tools/${m[1]}` : pathname
}
