/**
 * 인증 컨텍스트 그릇 — AuthProvider(값을 채움)와 useCurrentUser(없어도 되는 자리에서 읽음, D-103)가 같이 쓴다.
 */
import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { BootstrapState } from './bootstrap'
import type { WorkspaceMembership } from './workspaceService'

export interface AuthContextValue {
  bootstrap: BootstrapState
  session: Session | null
  workspaces: WorkspaceMembership[]
  currentWorkspaceId: string | null
  selectWorkspace: (workspaceId: string) => void
  refreshWorkspaces: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
