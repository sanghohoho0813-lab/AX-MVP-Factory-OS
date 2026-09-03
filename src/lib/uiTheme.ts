import type { UiThemeKey } from '../types/ui'

/**
 * 화면 테마 9종.
 *
 * 색 값은 `scripts/gen-theme-css.mjs` 가 CSS 변수로 확장해 두었고,
 * 여기 있는 값은 설정 화면의 미리보기 점(swatch)에만 쓴다.
 * 두 곳의 키·색이 어긋나면 미리보기와 실제 화면이 달라지므로
 * 테마를 추가·수정할 때는 반드시 두 파일을 함께 고친다.
 */
export interface UiThemeMeta {
  key: UiThemeKey
  label: string
  hint: string
  /** 미리보기 점 — Shell / Primary / Secondary / Accent / Highlight / Soft 순 */
  swatch: [string, string, string, string, string, string]
}

export const UI_THEMES: UiThemeMeta[] = [
  {
    key: 'navy-blue',
    label: '딥 네이비 블루',
    hint: '기본값 · 차분한 남색',
    swatch: ['#0B1830', '#2457D6', '#1687A7', '#17A889', '#E7C873', '#DCE8F7'],
  },
  {
    key: 'navy-gold',
    label: '네이비 골드',
    hint: '남색 + 금색 강조',
    swatch: ['#111A2D', '#2847A7', '#A37A28', '#D0A84B', '#F0D995', '#EFE8D7'],
  },
  {
    key: 'emerald-gold',
    label: '에메랄드 골드',
    hint: '짙은 초록 + 금색',
    swatch: ['#11332B', '#0E7663', '#2C9277', '#B4862A', '#E8CE88', '#E2F0EA'],
  },
  {
    key: 'forest-sage',
    label: '포레스트 세이지',
    hint: '숲색 · 부드러운 톤',
    swatch: ['#17352C', '#356E58', '#73977E', '#A58E4D', '#D9D2AA', '#E5ECE5'],
  },
  {
    key: 'deep-teal',
    label: '딥 틸',
    hint: '청록 + 주황 포인트',
    swatch: ['#08323A', '#087A83', '#1597A3', '#D2704C', '#E9B59B', '#DDEDEF'],
  },
  {
    key: 'onyx-gold',
    label: '오닉스 골드',
    hint: '무채색 + 금색',
    swatch: ['#15171C', '#343942', '#6A717C', '#B89032', '#E0C76F', '#E6E8EC'],
  },
  {
    key: 'burgundy',
    label: '버건디 슬레이트',
    hint: '와인색 · 무게감',
    swatch: ['#3A1724', '#7A2C49', '#667085', '#A85C72', '#E6B6A5', '#EEE4E8'],
  },
  {
    key: 'plum-indigo',
    label: '플럼 인디고',
    hint: '보라 + 남보라',
    swatch: ['#291A3D', '#573F91', '#4E63A8', '#8B5AA6', '#C4B0E6', '#E9E5F3'],
  },
  {
    key: 'steel',
    label: '스틸 플래티넘',
    hint: '강철빛 · 가장 옅음',
    swatch: ['#24303B', '#44647A', '#6D8899', '#4C9AAA', '#C9D6DE', '#E7EDF1'],
  },
]

export const DEFAULT_THEME: UiThemeKey = 'navy-blue'

const THEME_KEYS = new Set<string>(UI_THEMES.map((t) => t.key))

export function isThemeKey(v: unknown): v is UiThemeKey {
  return typeof v === 'string' && THEME_KEYS.has(v)
}

export function themeMeta(key: UiThemeKey): UiThemeMeta {
  return UI_THEMES.find((t) => t.key === key) ?? UI_THEMES[0]
}

/** html 요소에 data-theme 을 적용한다 (CSS 변수로 전체 색이 전환된다) */
export function applyTheme(key: UiThemeKey): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', key)
}
