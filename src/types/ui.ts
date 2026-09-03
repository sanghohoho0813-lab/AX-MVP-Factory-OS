/** 전역 표시(글자 크기·기능 노출) 설정 도메인 */

export type UiTextScale = 'default' | 'large' | 'extra_large'

/**
 * 기능 노출 모드 (Stage 12B-UX 5차).
 * core: 핵심 흐름만 표시 / advanced: 고급 운영 기능(테스트·기관·사례) 추가 표시.
 */
export type FeatureVisibilityMode = 'core' | 'advanced'

/** 화면 테마 9종 (마스터 규격 CANONICAL 9 THEME) */
export type UiThemeKey =
  | 'navy-blue'
  | 'navy-gold'
  | 'emerald-gold'
  | 'forest-sage'
  | 'deep-teal'
  | 'onyx-gold'
  | 'burgundy'
  | 'plum-indigo'
  | 'steel'

/** 모션(전환 효과) 표시 방식 */
export type UiMotionMode = 'full' | 'reduced'

export interface UiPreferences {
  textScale: UiTextScale
  /** 기존 저장값에 없을 수 있으므로 optional — 기본 core */
  featureVisibility?: FeatureVisibilityMode
  /** 기존 저장값에 없을 수 있으므로 optional — 기본 navy-blue */
  theme?: UiThemeKey
  /** 기존 저장값에 없을 수 있으므로 optional — 기본 full */
  motion?: UiMotionMode
  updatedAt: string
}
