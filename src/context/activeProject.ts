import { createContext, useContext } from 'react'
import type { Organization, Project } from '../types/domain'

export interface ActiveProjectValue {
  /** 현재 선택된 프로젝트 (없으면 null) */
  project: Project | null
  organization: Organization | null
  /** 최근 전환한 프로젝트 (최대 5) */
  recentProjects: Project[]
  /** 프로젝트 선택/전환 */
  setActiveProject: (projectId: string | null) => void
}

export const ActiveProjectContext = createContext<ActiveProjectValue | null>(null)

export function useActiveProject(): ActiveProjectValue {
  const ctx = useContext(ActiveProjectContext)
  if (!ctx) {
    throw new Error('useActiveProject 는 ActiveProjectProvider 안에서만 사용할 수 있습니다.')
  }
  return ctx
}
