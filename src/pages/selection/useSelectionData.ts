import { useMemo } from 'react'
import { useStoreVersion } from '../../lib/useStoreVersion'
import {
  getProjectSelectionContext,
  type ProjectSelectionContext,
} from '../../services/selectionService'

/** 과제선별 컨텍스트를 로드한다 (store 버전에 반응) */
export function useSelectionData(projectId: string): {
  context: ProjectSelectionContext | null
} {
  const version = useStoreVersion()
  return useMemo(() => {
    return { context: getProjectSelectionContext(projectId) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, version])
}
