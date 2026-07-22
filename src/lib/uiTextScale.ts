import type { UiTextScale } from '../types/ui'

/**
 * 글자 크기 배율 — 16px 표준 기준 (Stage 12B-UX 5차 재조정).
 * 설정값 이름은 유지하고 배율만 조정해 기존 사용자 설정을 보존한다.
 */
export const TEXT_SCALE_VALUE: Record<UiTextScale, number> = {
  default: 1.0,
  large: 1.15,
  extra_large: 1.3,
}

export interface TextScaleMeta {
  label: string
  hint: string
  order: number
}

export const TEXT_SCALE_META: Record<UiTextScale, TextScaleMeta> = {
  default: { label: '기본', hint: '표준 크기', order: 0 },
  large: { label: '크게', hint: '기본보다 15% 크게', order: 1 },
  extra_large: { label: '매우 크게', hint: '기본보다 30% 크게', order: 2 },
}

export const TEXT_SCALES: UiTextScale[] = ['default', 'large', 'extra_large']

export function isTextScale(v: unknown): v is UiTextScale {
  return v === 'default' || v === 'large' || v === 'extra_large'
}

/** html 요소에 data-text-scale 속성을 적용한다 (CSS 변수로 배율 전환) */
export function applyTextScale(scale: UiTextScale): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-text-scale', scale)
}
