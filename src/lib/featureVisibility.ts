import type { FeatureVisibilityMode } from '../types/ui'
import { uiPreferencesRepository } from '../repositories/uiPreferencesRepository'

/**
 * 기능 노출 모드 (Stage 12B-UX 5차).
 * core(기본): 핵심 흐름만 표시. advanced: 고급 운영 기능 추가 표시.
 * 숨겨진 기능도 데이터는 보존되며 직접 URL 접근은 막지 않는다.
 */

export function getFeatureVisibility(): FeatureVisibilityMode {
  return uiPreferencesRepository.get().featureVisibility ?? 'core'
}

export function setFeatureVisibility(mode: FeatureVisibilityMode): void {
  uiPreferencesRepository.setFeatureVisibility(mode)
}

export function isAdvancedVisible(): boolean {
  return getFeatureVisibility() === 'advanced'
}

export const FEATURE_VISIBILITY_META: Record<FeatureVisibilityMode, { label: string; desc: string }> = {
  core: {
    label: '핵심 기능만',
    desc: '진단부터 결과자료까지 기본 흐름만 표시합니다.',
  },
  advanced: {
    label: '고급 운영 기능 보기',
    desc: '테스트 운영, 기관 연계, 사례 관리처럼 프로젝트 후반에 사용하는 기능을 추가로 표시합니다.',
  },
}
