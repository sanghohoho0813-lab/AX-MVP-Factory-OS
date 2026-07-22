import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { DemoTourProvider } from '../demo/DemoTourProvider'
import { OnboardingProvider } from '../onboarding/OnboardingProvider'
import { ActiveProjectProvider } from '../../context/ActiveProjectProvider'
import { RouteProjectSync } from '../../context/RouteProjectSync'

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
          <main className="mx-auto w-full max-w-[1840px] flex-1 px-4 py-6 pb-24 sm:px-6 sm:pb-8 lg:px-10 lg:py-9 2xl:px-14">
            <Suspense fallback={<ShellFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
      </OnboardingProvider>
      </DemoTourProvider>
    </ActiveProjectProvider>
  )
}
