import { useMemo } from 'react'
import { useStoreVersion } from '../../lib/useStoreVersion'
import {
  getPackage,
  getProjectDeliverableContext,
  needsRefresh,
  summarizePackage,
  type ProjectDeliverableContext,
} from '../../services/deliverableService'
import type { DeliverablePackage } from '../../types/deliverables'
import type { DeliverableSummary } from '../../services/deliverables/packageSummaryBuilder'

export function useDeliverableData(projectId: string): { context: ProjectDeliverableContext | null } {
  const version = useStoreVersion()
  return useMemo(() => {
    return { context: getProjectDeliverableContext(projectId) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, version])
}

export function usePackage(packageId: string): {
  pkg: DeliverablePackage | null
  summary: DeliverableSummary | null
  stale: boolean
} {
  const version = useStoreVersion()
  return useMemo(() => {
    const pkg = getPackage(packageId)
    return {
      pkg,
      summary: pkg ? summarizePackage(pkg) : null,
      stale: pkg ? needsRefresh(pkg) : false,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageId, version])
}
