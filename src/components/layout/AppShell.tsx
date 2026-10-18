import { Suspense, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { DemoTourProvider } from '../demo/DemoTourProvider'
import { TutorialProvider } from '../tutorial/TutorialProvider'
import { ActiveProjectProvider } from '../../context/ActiveProjectProvider'
import { RouteProjectSync } from '../../context/RouteProjectSync'
import { ContentErrorBoundary } from './ContentErrorBoundary'
import { StorageFullNotice } from './StorageFullNotice'
import { ScrollTopButton } from './ScrollTopButton'
import { BackToCloseGuard } from '../../lib/backToClose'
import { useScrollMemory } from '../../lib/scrollMemory'
import { EntitlementsProvider } from '../../lib/entitlementsContext'
import { ModuleBoundary } from '../modules/ModuleBoundary'
import { useIsPilot } from '../../auth/osAccess'
import { isCapabilityHiddenPath, isPilotHiddenPath } from '../../config/moduleRegistry'
import { useCapabilitySet } from '../../auth/ownerAiAccess'
import { NotFoundState } from '../ui/NotFoundState'
import { FrameBridge } from './DeviceView'
import { ViewingPilotBanner } from './ViewAsSwitch'
import { Breadcrumbs } from './Breadcrumbs'
import { setBuiltinServicesHidden } from '../../content/clientOpsCatalog'
import { CONTENT_WIDTH_PX, useContentWidth } from '../../lib/contentWidth'

function PilotRouteGuard({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const pilot = useIsPilot()
  // D-188: 팀장 화면은 기본 업무 6종을 빼고 그린다(화면 목록만 — 업체 기록은 그대로). 화면을 그리기 전에 정한다
  setBuiltinServicesHidden(pilot)
  // 대표 AI 작업실처럼 기능 권한이 필요한 화면 — 권한이 없으면(팀장 · 권한 없는 구성원) 직접 주소로도 없는 화면
  const caps = useCapabilitySet()
  if ((pilot && isPilotHiddenPath(pathname)) || isCapabilityHiddenPath(pathname, caps)) {
    return <NotFoundState title="화면을 찾지 못했습니다" description="주소가 바뀌었거나 없는 화면입니다." backTo="/" backLabel="오늘로" />
  }
  return <>{children}</>
}

function ShellFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <span className="text-sm text-slate-400">불러오는 중…</span>
    </div>
  )
}

export function AppShell() {
  // D-188: 머리줄 · 메뉴 숫자까지 같은 목록을 보게 — 화면을 그리는 맨 위에서 먼저 정한다
  setBuiltinServicesHidden(useIsPilot())
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const contentWidth = useContentWidth()

  // 화면이 바뀌면 모바일 메뉴를 닫고 맨 위로 — 뒤로 · 앞으로 온 것이면 보던 자리로 (D-124)
  useScrollMemory(() => setMobileOpen(false))

  return (
    <EntitlementsProvider>
    <ActiveProjectProvider>
      <RouteProjectSync />
      <BackToCloseGuard />
      {/* D-164: 보기 무대(iframe) 안에서 주소 · 저장을 바깥과 맞춘다 */}
      <FrameBridge />
      <DemoTourProvider>
      {/* D-185: 안내 영상 — 팀장님 로그인 때 먼저 · 머리줄 [안내 영상] */}
      <TutorialProvider>
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
          {/* D-201: PC 본문 폭 — 머리줄 [폭] 단추로 좁게 · 보통(기본) · 넓게. 화면이 더 좁으면 바뀌는 것 없음 */}
          <main
            className="pb-safe-nav mx-auto w-full flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-9 2xl:px-14"
            style={{ maxWidth: CONTENT_WIDTH_PX[contentWidth] }}
            data-content-width={contentWidth}
          >
            {/* key: 화면이 바뀔 때마다 등장 효과를 한 번씩 다시 준다.
                모듈(/tools/<모듈>/<화면>) 안에서 화면만 바꿀 때는 그대로 둔다 — 원본 앱의 고른 고객·열린 창이 살아 있어야 한다 (D-93) */}
            <StorageFullNotice />
            {/* D-164: 대표가 팀장 화면을 보는 동안 */}
            <ViewingPilotBanner />
            {/* D-235: 경로 줄 — 어디를 눌러 들어와도 지금 어디 안에 있는지(앞 칸을 누르면 그 단계로) */}
            <Breadcrumbs />
            <div key={shellKeyOf(location.pathname)} className="ax-rise">
              {/* D-95: 한 화면이 넘어져도 사이드바·머리줄은 남는다. 다른 화면으로 옮기면 풀린다 */}
              <ContentErrorBoundary resetKey={location.pathname}>
                <Suspense fallback={<ShellFallback />}>
                  {/* D-127: 잠긴 모듈의 화면은 여기 한 곳에서 모듈 소개로 바꾼다 — 화면마다 요금제를 묻지 않는다 */}
                  <ModuleBoundary pathname={location.pathname}>
                    {/* D-162: Pilot 에게는 대표 전용 · 내부 화면을 주소로도 열지 않는다(없는 화면처럼) */}
                    <PilotRouteGuard pathname={location.pathname}>
                      <Outlet />
                    </PilotRouteGuard>
                  </ModuleBoundary>
                </Suspense>
              </ContentErrorBoundary>
            </div>
          </main>
        </div>
        <MobileNav onOpenMore={() => setMobileOpen(true)} />
        <ScrollTopButton />
      </div>
      </TutorialProvider>
      </DemoTourProvider>
    </ActiveProjectProvider>
    </EntitlementsProvider>
  )
}

/** 본문을 새로 그릴 기준 — 모듈 안의 화면 이동은 같은 것으로 본다 */
function shellKeyOf(pathname: string): string {
  const m = /^\/tools\/([^/]+)/.exec(pathname)
  return m ? `/tools/${m[1]}` : pathname
}
