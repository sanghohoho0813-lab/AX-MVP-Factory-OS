import type { UiTextScale } from '../types/ui'

/**
 * 글자 크기 배율 — 기존(Stage 8) 16px 기준.
 * 기본은 반드시 1.5배이며, 이전 1.0 크기 선택지는 제공하지 않는다.
 */
export const TEXT_SCALE_VALUE: Record<UiTextScale, number> = {
  default: 1.5,
  large: 1.8,
  extra_large: 2.1,
}

export interface TextScaleMeta {
  label: string
  hint: string
  order: number
}

export const TEXT_SCALE_META: Record<UiTextScale, TextScaleMeta> = {
  default: { label: '기본', hint: '현재보다 1.5배', order: 0 },
  large: { label: '크게', hint: '기본보다 20% 크게', order: 1 },
  extra_large: { label: '매우 크게', hint: '기본보다 40% 크게', order: 2 },
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
