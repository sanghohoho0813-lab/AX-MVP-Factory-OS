import { Suspense, lazy } from 'react'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ToastProvider } from './components/ui/toast'
import { TextScaleProvider } from './components/ui/TextScaleProvider'
import { AppearanceProvider } from './components/ui/AppearanceProvider'
import { getDataModeConfig } from './data/dataMode'
import { appRouteChildren, publicSurveyRoute, publicTestRoute } from './app/appRouteChildren'

// supabase 모드 앱(및 Supabase SDK)은 지연 로딩해 local 모드 entry 번들에 포함되지 않게 한다.
const SupabaseApp = lazy(() =>
  import('./app/SupabaseApp').then((m) => ({ default: m.SupabaseApp })),
)

// local 모드 라우터 — 기존 Stage 1~11 구조를 그대로 유지한다(로그인 없이 진입).
const localRouter = createBrowserRouter([
  {
    element: <AppShell />,
    children: appRouteChildren,
  },
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
  return (
    <TextScaleProvider>
      <AppearanceProvider>
        <ToastProvider>
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
