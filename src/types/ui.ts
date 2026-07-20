/** 전역 표시(글자 크기) 설정 도메인 */

export type UiTextScale = 'default' | 'large' | 'extra_large'

export interface UiPreferences {
  textScale: UiTextScale
  updatedAt: string
}
