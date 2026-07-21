import { useMemo } from 'react'
import { useStoreVersion } from '../../lib/useStoreVersion'
import {
  getProjectFundingContext,
  getStrategy,
  needsRefresh,
  summarizeStrategy,
  type ProjectFundingContext,
} from '../../services/fundingService'
import type { FundingStrategy } from '../../types/funding'
import type { FundingSummary } from '../../services/funding/fundingSummaryBuilder'

export function useFundingData(projectId: string): { context: ProjectFundingContext | null } {
  const version = useStoreVersion()
  return useMemo(() => {
    return { context: getProjectFundingContext(projectId) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, version])
}

export function useStrategy(strategyId: string): {
  strategy: FundingStrategy | null
  summary: FundingSummary | null
  stale: boolean
} {
  const version = useStoreVersion()
  return useMemo(() => {
    const strategy = getStrategy(strategyId)
    return {
      strategy,
      summary: strategy ? summarizeStrategy(strategy) : null,
      stale: strategy ? needsRefresh(strategy) : false,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategyId, version])
}
