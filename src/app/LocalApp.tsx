/**
 * local 데이터 모드 앱(로그인 없이 진입) — 예전 App.tsx 의 localRouter 그대로.
 *
 * D-590 앱 뼈대(AppShell)와 화면 목록(appRouteChildren)을 맨 처음 받는 조각에서 떼어 냈다 —
 * 로그인 화면(supabase 모드)이 앱 뼈대까지 받지 않게 하려고. local 모드는 이 조각을 바로 받는다(화면 동작은 같다).
 */
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { appRouteChildren, legalRoutes, PublicGrantFinder, publicSurveyRoute, publicTestRoute } from './appRouteChildren'
import { RouteErrorScreen } from '../components/layout/RouteErrorScreen'
// 화면을 감싸는 틀은 화면 목록이 필요할 때 받게 돼 있다 — local 모드는 예전처럼 처음부터 같이 받는다
import '../tools/shared/toolClientContext'
import '../tools/shared/ModuleRoute'
import '../components/chat/ChatFirst'

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
  ...legalRoutes,
])

export function LocalApp() {
  return <RouterProvider router={localRouter} />
}
