import { STORAGE_KEYS, hasKey, writeJson } from '../storage/localStore'

/**
 * 실운영 기본값. 예시 고객·프로젝트는 만들지 않는다.
 * 각 저장소는 빈 상태로만 준비해 사용자가 처음 고객부터 직접 등록한다.
 */
export function seedCoreData(): void {
  if (!hasKey(STORAGE_KEYS.organizations)) writeJson(STORAGE_KEYS.organizations, [])
  if (!hasKey(STORAGE_KEYS.projects)) writeJson(STORAGE_KEYS.projects, [])
  if (!hasKey(STORAGE_KEYS.activities)) writeJson(STORAGE_KEYS.activities, [])
}
