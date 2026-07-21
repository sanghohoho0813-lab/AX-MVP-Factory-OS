/**
 * Repository 컨텍스트 — 앱 전역에서 비동기 저장소 번들을 주입한다.
 * UI 는 useRepositories() 로만 접근하고, Supabase SDK·localStorage 를 직접 쓰지 않는다.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { DataMode } from '../../data/dataMode'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createRepositoryBundle, type RepositoryFactoryOptions } from './factory'
import type { AsyncRepositoryBundle } from './bundle'

interface RepositoryContextValue {
  repositories: AsyncRepositoryBundle
  mode: DataMode
  workspaceId: string | null
}

const RepositoryContext = createContext<RepositoryContextValue | null>(null)

export interface RepositoryProviderProps {
  mode: DataMode
  supabaseClient?: SupabaseClient
  workspaceId?: string
  children: ReactNode
}

export function RepositoryProvider({
  mode,
  supabaseClient,
  workspaceId,
  children,
}: RepositoryProviderProps) {
  const value = useMemo<RepositoryContextValue>(() => {
    const options: RepositoryFactoryOptions = { mode, supabaseClient, workspaceId }
    return {
      repositories: createRepositoryBundle(options),
      mode,
      workspaceId: workspaceId ?? null,
    }
  }, [mode, supabaseClient, workspaceId])

  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>
}

export function useRepositories(): AsyncRepositoryBundle {
  const ctx = useContext(RepositoryContext)
  if (!ctx) {
    throw new Error('useRepositories 는 RepositoryProvider 안에서만 사용할 수 있습니다.')
  }
  return ctx.repositories
}

export function useDataMode(): { mode: DataMode; workspaceId: string | null } {
  const ctx = useContext(RepositoryContext)
  if (!ctx) {
    throw new Error('useDataMode 는 RepositoryProvider 안에서만 사용할 수 있습니다.')
  }
  return { mode: ctx.mode, workspaceId: ctx.workspaceId }
}
