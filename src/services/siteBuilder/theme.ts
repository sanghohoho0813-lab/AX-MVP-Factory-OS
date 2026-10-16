/**
 * 홈페이지 꾸밈 (D-202) — 색 묶음 6 · 글꼴 2 · 모서리 3.
 *
 * 색은 사람이 고른 값을 그대로 CSS 에 넣지 않는다 — 여기 표에 있는 값만 쓴다(내려받은 HTML 에 엉뚱한 글이 섞이지 않게).
 * 글자색과 바탕색은 큰 글 기준 4.5:1 을 넘게 골랐다(시험이 잰다).
 */
import type { CornerKey, FontKey, IndustryKey, PaletteKey } from './types'

export interface Palette {
  key: PaletteKey
  label: string
  /** 어울리는 업종 — 고르기 칸에 한 줄 */
  hint: string
  /** 단추 · 강조 */
  primary: string
  /** 강조색 위 글자 */
  onPrimary: string
  /** 머리 큰 화면(히어로) 바탕 그라데이션 두 색 */
  heroFrom: string
  heroTo: string
  /** 옅은 바탕(번갈아 쓰는 구역) */
  soft: string
  /** 본문 글자 */
  ink: string
  /** 흐린 글자 */
  muted: string
  /** 줄 · 테두리 */
  line: string
  /** 바닥(푸터) 바탕 */
  footBg: string
  footInk: string
}

export const PALETTES: Palette[] = [
  { key: 'navy', label: '남색', hint: '전문 서비스 · 금융 · 컨설팅', primary: '#1e3a8a', onPrimary: '#ffffff', heroFrom: '#0f1f4d', heroTo: '#1e3a8a', soft: '#f1f5fb', ink: '#111827', muted: '#4b5563', line: '#dbe3f0', footBg: '#0b1530', footInk: '#cbd5e1' },
  { key: 'forest', label: '숲', hint: '제조 · 친환경 · 농식품', primary: '#166534', onPrimary: '#ffffff', heroFrom: '#0c3b20', heroTo: '#166534', soft: '#f0f7f2', ink: '#111827', muted: '#4b5563', line: '#d7e8dc', footBg: '#0a2615', footInk: '#cfe0d4' },
  { key: 'ocean', label: '바다', hint: 'IT · 소프트웨어 · 의료', primary: '#0e6a8a', onPrimary: '#ffffff', heroFrom: '#063349', heroTo: '#0e6a8a', soft: '#eef7fa', ink: '#0f172a', muted: '#475569', line: '#d3e7ee', footBg: '#04202e', footInk: '#c8dde5' },
  { key: 'wine', label: '와인', hint: '뷰티 · 법률 · 고급 서비스', primary: '#7f1d3f', onPrimary: '#ffffff', heroFrom: '#3d0b1f', heroTo: '#7f1d3f', soft: '#faf2f5', ink: '#1f1218', muted: '#5b4750', line: '#ecd9e0', footBg: '#24070f', footInk: '#e5cfd6' },
  { key: 'sunset', label: '노을', hint: '음식 · 카페 · 교육', primary: '#b4410f', onPrimary: '#ffffff', heroFrom: '#5c1d05', heroTo: '#b4410f', soft: '#fdf5ef', ink: '#1c1410', muted: '#5c4b40', line: '#f1ddd0', footBg: '#2b1206', footInk: '#ecd8cb' },
  { key: 'charcoal', label: '먹색', hint: '건설 · 인테리어 · 제조', primary: '#27272a', onPrimary: '#ffffff', heroFrom: '#09090b', heroTo: '#3f3f46', soft: '#f4f4f5', ink: '#18181b', muted: '#52525b', line: '#e4e4e7', footBg: '#09090b', footInk: '#d4d4d8' },
]

export function paletteOf(key: string): Palette {
  return PALETTES.find((p) => p.key === key) ?? PALETTES[0]
}

export const FONTS: { key: FontKey; label: string; stack: string; link: string | null }[] = [
  {
    key: 'sans',
    label: '고딕(깔끔)',
    stack: `'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', system-ui, sans-serif`,
    link: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css',
  },
  {
    key: 'serif',
    label: '명조(격식)',
    stack: `'Noto Serif KR', 'Nanum Myeongjo', 'AppleMyungjo', serif`,
    link: 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700&display=swap',
  },
]

export function fontOf(key: string) {
  return FONTS.find((f) => f.key === key) ?? FONTS[0]
}

export const CORNERS: { key: CornerKey; label: string; card: number; button: number }[] = [
  { key: 'square', label: '각지게', card: 4, button: 4 },
  { key: 'round', label: '둥글게', card: 14, button: 10 },
  { key: 'pill', label: '아주 둥글게', card: 22, button: 999 },
]

export function cornerOf(key: string) {
  return CORNERS.find((c) => c.key === key) ?? CORNERS[1]
}

/** 업종에 어울리는 처음 색 */
export const INDUSTRY_PALETTE: Record<IndustryKey, PaletteKey> = {
  manufacturing: 'forest',
  it: 'ocean',
  trade: 'navy',
  food: 'sunset',
  health: 'ocean',
  professional: 'navy',
  education: 'sunset',
  construction: 'charcoal',
  general: 'navy',
}

/** 상대 휘도 대비 (WCAG) — 시험이 색 묶음을 잰다 */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = hex.replace('#', '')
    const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
