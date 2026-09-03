import type { ReactNode } from 'react'
import { getDataModeConfig } from '../../data/dataMode'
import { useAuth } from '../../auth/AuthProvider'

export interface WorkspaceContextValue {
  /** supabase 모드의 현재 워크스페이스. local 모드는 null */
  workspaceId: string | null
  /** 로그인 사용자 id. local 모드는 null */
  userId: string | null
}

/**
 * 두 데이터 모드에서 같은 화면 코드를 쓰기 위한 얇은 경계.
 * local 모드는 AuthProvider 가 없으므로 훅을 부르지 않고 null 을 준다.
 * (모든 운영 화면이 반복하던 `mode === 'supabase' ? <Cloud/> : <Content/>` 분기를 한곳으로 모은다.)
 */
export function WorkspaceScope({ children }: { children: (ctx: WorkspaceContextValue) => ReactNode }) {
  if (getDataModeConfig().mode === 'supabase') return <CloudScope>{children}</CloudScope>
  return <>{children({ workspaceId: null, userId: null })}</>
}

function CloudScope({ children }: { children: (ctx: WorkspaceContextValue) => ReactNode }) {
  const { currentWorkspaceId, session } = useAuth()
  return <>{children({ workspaceId: currentWorkspaceId, userId: session?.user.id ?? null })}</>
}
