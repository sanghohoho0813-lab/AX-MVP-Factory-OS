/**
 * OS 테마 강조색을 16진수로 (D-96).
 *
 * 원본 모듈(영업·크레탑)은 색을 `C.blue + "40"` 처럼 16진수 뒤에 투명도를 붙여 쓴다 — CSS 변수(var())를 넣으면 깨진다.
 * 그래서 모듈을 읽어 들일 때 지금 테마의 강조색을 16진수로 읽어 원본 팔레트에 넣는다.
 * 테마는 index.html 이 앱보다 먼저 붙이므로 이 시점에 이미 정해져 있다. 테마를 바꾸면 새로고침 뒤 반영된다.
 */

export type BrandStep = '50' | '100' | '200' | '500' | '600' | '700'

export function brandHex(step: BrandStep, fallback: string): string {
  try {
    if (typeof document === 'undefined') return fallback
    const v = getComputedStyle(document.documentElement).getPropertyValue(`--color-brand-${step}`).trim()
    return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback
  } catch {
    return fallback
  }
}
