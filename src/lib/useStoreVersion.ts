import { useSyncExternalStore } from 'react'
import { getStoreVersion, subscribeStore } from '../storage/localStore'

/**
 * 저장 데이터 변경 시 리렌더를 트리거하는 버전 카운터.
 * 사용처: const version = useStoreVersion(); useMemo(() => repo.getAll(), [version])
 */
export function useStoreVersion(): number {
  return useSyncExternalStore(subscribeStore, getStoreVersion, getStoreVersion)
}
