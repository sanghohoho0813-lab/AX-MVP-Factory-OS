import { Suspense, lazy, useEffect, useRef } from 'react'
import { ToastProvider } from './components/ui/toast'
import { TextScaleProvider } from './components/ui/TextScaleProvider'
import { AppearanceProvider } from './components/ui/AppearanceProvider'
import { getDataModeConfig } from './data/dataMode'
import { DatePickerHost } from './components/ui/DatePickerHost'
import { DeviceStage } from './components/layout/DeviceView'
import { isStageExcluded, useDeviceView } from './lib/deviceView'
import { preloadShellIfSignedIn } from './app/shellChunks'
import { slugFromPath } from './lib/askPath'

// supabase 모드 앱(및 Supabase SDK)은 지연 로딩해 local 모드 entry 번들에 포함되지 않게 한다.
const SupabaseApp = lazy(() =>
  import('./app/SupabaseApp').then((m) => ({ default: m.SupabaseApp })),
)

/**
 * L-9 · D-609 상담 신청 공개 화면(/ask/<12자리>) — 컨설턴트의 고객이 여는 화면이라 로그인 준비 · 라우터 · OS 이름 없이 바로 그린다.
 * (작은 조각 하나만 받는다 · 앱 뼈대 미리 받기도 하지 않는다)
 */
const IntakeFormPage = lazy(() => import('./pages/public/IntakeFormPage'))
const askSlug = typeof window !== 'undefined' ? slugFromPath(window.location.pathname) : ''

// D-590 로그인해 둔 브라우저는 앱 뼈대를 기다리지 않게 — 첫 조각을 읽자마자 받기 시작한다(로그인 화면만 볼 사람은 받지 않는다)
try {
  if (getDataModeConfig().mode === 'supabase' && !askSlug) preloadShellIfSignedIn()
} catch {
  /* 설정을 못 읽으면 미리 받지 않는다 — 화면이 필요할 때 받는다 */
}

// D-590 local 모드 앱(로그인 없이 진입)도 조각으로 — 앱 뼈대 · 화면 목록이 맨 처음 받는 조각에 섞이지 않게(로그인 화면을 가볍게)
const LocalApp = lazy(() => import('./app/LocalApp').then((m) => ({ default: m.LocalApp })))

/** D-589 앱 조각을 받는 동안 — index.html 의 첫 화면과 같은 모양(.boot · index.html 의 style)이라 깜박이지 않는다 */
function BootSplash() {
  return (
    <div className="boot" role="status" data-testid="boot-splash">
      <img className="boot-mark" src="/favicon.svg" width={56} height={56} alt="" />
      <p className="boot-name">MIRAE AI LAB OS</p>
      <p className="boot-msg">불러오는 중…</p>
    </div>
  )
}

function App() {
  if (askSlug) {
    return (
      <Suspense fallback={<IntakeSplash />}>
        <IntakeFormPage slug={askSlug} />
      </Suspense>
    )
  }
  return <MainApp />
}

/** 상담 신청 화면을 받는 동안 — OS 이름 · 로고 없이 */
function IntakeSplash() {
  return (
    <div className="boot" role="status" data-testid="boot-splash">
      <p className="boot-msg">상담 신청 화면을 여는 중…</p>
    </div>
  )
}

function MainApp() {
  const cfg = getDataModeConfig()
  // D-164: PC 에서 Mobile · PC+Mobile 을 고르면 앱 대신 보기 무대(같은 앱을 iframe 으로) · D-286 휴대폰에서 PC · PC+Mobile 도
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
          <DeviceStage key={`${device.mode}-${device.narrow}`} />
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
            <Suspense fallback={<BootSplash />}>
              <LocalApp />
            </Suspense>
          )}
        </ToastProvider>
      </AppearanceProvider>
    </TextScaleProvider>
  )
}

export default App
