/**
 * Repository 번들 팩토리 — 데이터 모드에 따라 비동기 저장소 번들을 만든다.
 *
 * - local    : 검증된 Stage 1~11 로컬 구현을 비동기로 감싼 번들
 * - supabase : 워크스페이스 범위 Supabase 어댑터 번들 (도메인 어댑터는 Stage 12B 에서
 *              완성. 현재는 런타임 미검증이므로 명시적 오류로 알린다 — 조용한 fallback 금지)
 *
 * 조용히 local 로 되돌리지 않는다. 연결/구성 문제는 상위(부트스트랩)에서
 * 오류 상태로 표시한다.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DataMode } from '../../data/dataMode'
import { createLocalAsyncBundle, type AsyncRepositoryBundle } from './bundle'

export class SupabaseModeNotWiredError extends Error {
  constructor() {
    super(
      'Supabase 저장소가 아직 런타임에 연결되지 않았습니다. ' +
        '로컬 데이터 모드로 이용하거나, Supabase 도메인 어댑터 연동(다음 단계)이 필요합니다.',
    )
    this.name = 'SupabaseModeNotWiredError'
  }
}

export interface RepositoryFactoryOptions {
  mode: DataMode
  supabaseClient?: SupabaseClient
  workspaceId?: string
}

/**
 * 비동기 저장소 번들을 만든다.
 * local 모드는 항상 즉시 사용 가능. supabase 모드는 client·workspaceId 가 필요하다.
 */
export function createRepositoryBundle(options: RepositoryFactoryOptions): AsyncRepositoryBundle {
  if (options.mode === 'local') {
    return createLocalAsyncBundle()
  }
  // supabase 모드: 필수 조건이 없으면 fake 성공 대신 명시적으로 실패시킨다.
  if (!options.supabaseClient) {
    throw new SupabaseModeNotWiredError()
  }
  if (!options.workspaceId) {
    throw new SupabaseModeNotWiredError()
  }
  // 도메인별 Supabase 어댑터는 다음 단계에서 채운다. 현재는 조용한 성공을 만들지 않는다.
  throw new SupabaseModeNotWiredError()
}
