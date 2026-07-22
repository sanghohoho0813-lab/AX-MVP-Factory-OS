/**
 * supabase 데이터 모드 앱 진입점.
 * 부트스트랩 상태에 따라 설정오류/연결오류/초기화 화면을 먼저 처리하고,
 * 그 외에는 인증·워크스페이스 가드가 포함된 라우터를 렌더한다.
 * 조용히 local 모드로 fallback 하지 않는다.
 */

import type { ReactNode } from 'react'
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { getSupabaseClient } from '../lib/supabase/client'
import { RepositoryProvider } from '../repositories/async/RepositoryProvider'
import { AuthProvider, useAuth } from '../auth/AuthProvider'
import {
  ConfigurationErrorScreen,
  ConnectionErrorScreen,
  InitializingScreen,
} from '../auth/ui/BootstrapScreens'
import { WorkspaceOnboarding } from '../auth/ui/WorkspaceOnboarding'
import { LoginPage } from '../auth/ui/LoginPage'
import { SignupPage } from '../auth/ui/SignupPage'
import { ForgotPasswordPage } from '../auth/ui/ForgotPasswordPage'
import { ResetPasswordPage } from '../auth/ui/ResetPasswordPage'
import { JoinPage } from '../auth/ui/JoinPage'
import { appRouteChildren, publicSurveyRoute, publicTestRoute } from './appRouteChildren'

/** 로그인·회원가입 등 게스트 전용 라우트 가드 (로그인 상태면 홈으로) */
function GuestOnly({ children }: { children: ReactNode }) {
  const { bootstrap } = useAuth()
  if (bootstrap.status === 'ready' || bootstrap.status === 'authenticated_no_workspace') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

/** 보호 경로 셸 — 세션·워크스페이스가 준비된 경우에만 AppShell 을 연다. */
function ProtectedShell() {
  const { bootstrap, currentWorkspaceId } = useAuth()
  if (bootstrap.status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }
  if (bootstrap.status === 'authenticated_no_workspace') {
    return <WorkspaceOnboarding />
  }
  if (bootstrap.status !== 'ready') {
    return <InitializingScreen />
  }
  return (
    <RepositoryProvider
      mode="supabase"
      supabaseClient={getSupabaseClient()}
      workspaceId={currentWorkspaceId ?? undefined}
    >
      <AppShell />
    </RepositoryProvider>
  )
}

const supabaseRouter = createBrowserRouter([
  publicSurveyRoute,
  publicTestRoute,
  { path: '/login', element: <GuestOnly><LoginPage /></GuestOnly> },
  { path: '/signup', element: <GuestOnly><SignupPage /></GuestOnly> },
  { path: '/forgot-password', element: <GuestOnly><ForgotPasswordPage /></GuestOnly> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/join/:inviteToken', element: <JoinPage /> },
  { element: <ProtectedShell />, children: appRouteChildren },
])

function SupabaseAppInner() {
  const { bootstrap, refreshWorkspaces } = useAuth()
  if (bootstrap.status === 'configuration_error') {
    return <ConfigurationErrorScreen detail={bootstrap.detail} missingKeys={bootstrap.missingKeys} />
  }
  if (bootstrap.status === 'connection_error') {
    return <ConnectionErrorScreen detail={bootstrap.detail} onRetry={() => void refreshWorkspaces()} />
  }
  if (bootstrap.status === 'initializing') {
    return <InitializingScreen />
  }
  return <RouterProvider router={supabaseRouter} />
}

export function SupabaseApp() {
  return (
    <AuthProvider>
      <SupabaseAppInner />
    </AuthProvider>
  )
}
