/** 전역 표시(글자 크기·기능 노출) 설정 도메인 */

export type UiTextScale = 'default' | 'large' | 'extra_large'

/**
 * 기능 노출 모드 (Stage 12B-UX 5차).
 * core: 핵심 흐름만 표시 / advanced: 고급 운영 기능(테스트·기관·사례) 추가 표시.
 */
export type FeatureVisibilityMode = 'core' | 'advanced'

export interface UiPreferences {
  textScale: UiTextScale
  /** 기존 저장값에 없을 수 있으므로 optional — 기본 core */
  featureVisibility?: FeatureVisibilityMode
  updatedAt: string
}
