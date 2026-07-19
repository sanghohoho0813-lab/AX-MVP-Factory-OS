import { useMemo } from 'react'
import { useStoreVersion } from '../../lib/useStoreVersion'
import {
  getProjectDesignContext,
  type ProjectDesignContext,
} from '../../services/mvpDesignService'

/** MVP 설계 컨텍스트를 로드한다 (store 버전에 반응) */
export function useDesignData(projectId: string): {
  context: ProjectDesignContext | null
} {
  const version = useStoreVersion()
  return useMemo(() => {
    return { context: getProjectDesignContext(projectId) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, version])
}
