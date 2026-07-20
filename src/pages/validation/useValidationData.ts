import { useMemo } from 'react'
import { useStoreVersion } from '../../lib/useStoreVersion'
import {
  getProjectValidationContext,
  getWorkspace,
  type ProjectValidationContext,
} from '../../services/validationService'
import type { ValidationTrackType, ValidationWorkspace } from '../../types/validation'

/** 프로젝트 검증 컨텍스트 (트랙별 워크스페이스·요약) */
export function useValidationData(projectId: string): { context: ProjectValidationContext | null } {
  const version = useStoreVersion()
  return useMemo(() => {
    return { context: getProjectValidationContext(projectId) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, version])
}

/** 단일 트랙 컨텍스트를 반환한다 */
export function useTrackData(
  projectId: string,
  trackType: ValidationTrackType,
): {
  context: ProjectValidationContext | null
  workspace: ValidationWorkspace | null
} {
  const { context } = useValidationData(projectId)
  const track = context?.tracks.find((t) => t.trackType === trackType) ?? null
  return { context, workspace: track?.workspace ?? null }
}

/** 워크스페이스 ID로 직접 로드 */
export function useWorkspace(workspaceId: string): { workspace: ValidationWorkspace | null } {
  const version = useStoreVersion()
  return useMemo(() => {
    return { workspace: getWorkspace(workspaceId) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, version])
}
