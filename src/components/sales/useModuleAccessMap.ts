import { useEffect, useState } from 'react'
import { listAccess, type ModuleAccess } from '../../services/moduleAccess'

/** 모듈 잠금 상태 — 워크스페이스마다 한 번 읽는다 */
export function useModuleAccessMap(workspaceId: string | null): Map<string, ModuleAccess> | undefined {
  const [map, setMap] = useState<Map<string, ModuleAccess>>()
  useEffect(() => {
    let alive = true
    listAccess(workspaceId)
      .then((m) => {
        if (alive) setMap(m)
      })
      .catch(() => {
        /* 못 읽으면 모두 열림으로 본다 */
      })
    return () => {
      alive = false
    }
  }, [workspaceId])
  return map
}
