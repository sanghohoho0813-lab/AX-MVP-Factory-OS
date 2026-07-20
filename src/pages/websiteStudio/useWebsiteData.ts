import { useMemo } from 'react'
import { useStoreVersion } from '../../lib/useStoreVersion'
import {
  getProjectWebsiteContext,
  type ProjectWebsiteContext,
} from '../../services/websiteDesignService'

/** 홈페이지 설계 컨텍스트를 로드한다 (store 버전에 반응) */
export function useWebsiteData(projectId: string): {
  context: ProjectWebsiteContext | null
} {
  const version = useStoreVersion()
  return useMemo(() => {
    return { context: getProjectWebsiteContext(projectId) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, version])
}
