/**
 * 지금 쓸 수 있는 것 — 앱 전체가 한 번 읽어 나눠 쓴다 (D-127). 읽는 쪽은 entitlementsStore.ts 의 useEntitlements().
 *
 * 메뉴 · 잠김 화면 · 업체 화면 입구 · 영업 흐름이 모두 여기서 읽는다. 각 화면은 요금제를 모른다.
 * 요금제나 체험·잠금을 바꾸면 notifyEntitlementsChanged() — 모든 곳이 다시 읽는다.
 * 읽기 전과 읽기 실패 때는 아무것도 잠그지 않는다(잠깐 잠겼다 열리는 깜빡임을 만들지 않는다).
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getDataModeConfig } from '../data/dataMode'
import { useAuth } from '../auth/AuthProvider'
import { todayLocalDate } from './appClock'
import { openEntitlements, resolveEntitlements, type Subscription } from '../services/entitlements'
import { listAccess, type ModuleAccess } from '../services/moduleAccess'
import { loadSubscription } from '../services/subscription'
import { ENTITLEMENTS_EVENT, EntitlementsCtx, type EntitlementsValue } from './entitlementsStore'

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  return getDataModeConfig().mode === 'supabase' ? <CloudProvider>{children}</CloudProvider> : <Inner workspaceId={null}>{children}</Inner>
}

function CloudProvider({ children }: { children: ReactNode }) {
  const { currentWorkspaceId } = useAuth()
  return <Inner workspaceId={currentWorkspaceId}>{children}</Inner>
}

function Inner({ workspaceId, children }: { workspaceId: string | null; children: ReactNode }) {
  const today = todayLocalDate()
  const [loaded, setLoaded] = useState<{ sub: Subscription; access: Map<string, ModuleAccess> } | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1)
    window.addEventListener(ENTITLEMENTS_EVENT, bump)
    return () => window.removeEventListener(ENTITLEMENTS_EVENT, bump)
  }, [])

  useEffect(() => {
    let alive = true
    Promise.all([loadSubscription(workspaceId), listAccess(workspaceId)])
      .then(([sub, access]) => {
        if (alive) setLoaded({ sub, access })
      })
      .catch(() => {
        /* 못 읽으면 모두 열림으로 본다 */
      })
    return () => {
      alive = false
    }
  }, [workspaceId, version])

  const value = useMemo<EntitlementsValue>(
    () => ({
      ent: loaded ? resolveEntitlements(loaded.sub, loaded.access, today) : openEntitlements(today),
      ready: loaded !== null,
      workspaceId,
    }),
    [loaded, today, workspaceId],
  )
  return <EntitlementsCtx.Provider value={value}>{children}</EntitlementsCtx.Provider>
}
