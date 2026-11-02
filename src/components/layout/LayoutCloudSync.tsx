/**
 * D-485 화면 꾸미기 · D-486 미룬 할 일 흔적을 이 사람의 모든 기기에서 같게 — 로그인 · 작업공간이 정해지면 클라우드와 맞춘다(그림은 없다).
 * 로컬 모드(클라우드 없음)에서는 아무것도 하지 않는다 — 예전처럼 이 기기에만 기억.
 */
import { useContext, useEffect } from 'react'
import { AuthContext } from '../../auth/authContext'
import { getDataModeConfig } from '../../data/dataMode'
import { getSupabaseClient } from '../../lib/supabase/client'
import { startLayoutSync } from '../../services/preferences/layoutSync'
import { startTrailSync } from '../../services/preferences/trailSync'

export function LayoutCloudSync() {
  const auth = useContext(AuthContext)
  const userId = auth?.session?.user.id ?? null
  const workspaceId = auth?.currentWorkspaceId ?? null
  useEffect(() => {
    if (!userId || !workspaceId) return
    if (getDataModeConfig().mode !== 'supabase') return
    let client
    try {
      client = getSupabaseClient()
    } catch {
      return
    }
    const stopLayout = startLayoutSync(client, userId, workspaceId)
    // D-486 미룬 할 일 흔적도 같은 줄에(줄 세워 고쳐 쓰므로 서로 덮지 않는다)
    const stopTrail = startTrailSync(client, userId, workspaceId)
    return () => {
      stopLayout()
      stopTrail()
    }
  }, [userId, workspaceId])
  return null
}
