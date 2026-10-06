import { Suspense, lazy, useEffect, useRef } from 'react'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ToastProvider } from './components/ui/toast'
import { TextScaleProvider } from './components/ui/TextScaleProvider'
import { AppearanceProvider } from './components/ui/AppearanceProvider'
import { getDataModeConfig } from './data/dataMode'
import { appRouteChildren, PublicGrantFinder, publicSurveyRoute, publicTestRoute } from './app/appRouteChildren'
import { DatePickerHost } from './components/ui/DatePickerHost'
import { RouteErrorScreen } from './components/layout/RouteErrorScreen'
import { DeviceStage } from './components/layout/DeviceView'
import { isStageExcluded, useDeviceView } from './lib/deviceView'

// supabase 모드 앱(및 Supabase SDK)은 지연 로딩해 local 모드 entry 번들에 포함되지 않게 한다.
const SupabaseApp = lazy(() =>
  import('./app/SupabaseApp').then((m) => ({ default: m.SupabaseApp })),
)

// local 모드 라우터 — 기존 Stage 1~11 구조를 그대로 유지한다(로그인 없이 진입).
const localRouter = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteErrorScreen />,
    children: appRouteChildren,
  },
  { path: '/grants/find', errorElement: <RouteErrorScreen />, element: <PublicGrantFinder /> },
  publicSurveyRoute,
  publicTestRoute,
])

function BootSplash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50">
      <span className="text-sm text-slate-400">불러오는 중…</span>
    </div>
  )
}

function App() {
  const cfg = getDataModeConfig()
  // D-164: PC 에서 Mobile · PC+Mobile 을 고르면 앱 대신 보기 무대(같은 앱을 iframe 으로)
  const device = useDeviceView()
  const staged = device.staged && !isStageExcluded(window.location.pathname)
  const wasStaged = useRef(staged)
  useEffect(() => {
    // 무대에서 PC 로 돌아오면 지금 주소로 한 번 새로 연다(라우터가 무대 사이의 이동을 모른다)
    if (wasStaged.current && !staged) window.location.reload()
    wasStaged.current = staged
  }, [staged])
  if (staged) {
    return (
      <TextScaleProvider>
        <AppearanceProvider>
          {/* 방식이 바뀌면 무대를 새로 그린다(칸 크기 재기 · iframe 새로) */}
          <DeviceStage key={device.mode} />
        </AppearanceProvider>
      </TextScaleProvider>
    )
  }
  return (
    <TextScaleProvider>
      <AppearanceProvider>
        <ToastProvider>
          {/* D-131: OS 의 모든 날짜 칸 → 큰 달력(일요일부터) */}
          <DatePickerHost />
          {cfg.mode === 'supabase' ? (
            <Suspense fallback={<BootSplash />}>
              <SupabaseApp />
            </Suspense>
          ) : (
            <RouterProvider router={localRouter} />
          )}
        </ToastProvider>
      </AppearanceProvider>
    </TextScaleProvider>
  )
}

export default App
