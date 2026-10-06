/**
 * 인증 컨텍스트 그릇 — AuthProvider(값을 채움)와 useCurrentUser(없어도 되는 자리에서 읽음, D-103)가 같이 쓴다.
 */
import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { BootstrapState } from './bootstrap'
import type { WorkspaceMembership } from './workspaceService'
import type { OsAccess, PilotView } from './osAccess'

export interface AuthContextValue {
  bootstrap: BootstrapState
  session: Session | null
  workspaces: WorkspaceMembership[]
  currentWorkspaceId: string | null
  /** D-162: 내부 OS 접근 등급(서버 0019) — 로컬 모드 · 로그인 전은 null */
  access: OsAccess | null
  /** D-164: 대표가 바로 볼 수 있는 팀장 화면(작업공간) — 대표가 아니면 빈 목록 */
  pilotViews: PilotView[]
  selectWorkspace: (workspaceId: string) => void
  refreshWorkspaces: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
