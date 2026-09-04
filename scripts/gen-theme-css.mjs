/**
 * 9종 Canonical Theme 의 CSS 변수 램프를 생성한다.
 *
 * 입력: 마스터 규격의 Theme × 6색(Shell/Primary/Secondary/Accent/Highlight/Soft).
 * 출력: src/styles/themes.generated.css
 *
 * 램프는 OKLab 공간에서 흰색/검은색과 섞어 만든다. 결과는 정적 hex 로 고정하므로
 * 브라우저 color-mix 지원이나 계산 결과 편차에 의존하지 않는다.
 *
 * 실행: node scripts/gen-theme-css.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'

/** Theme 목록 — 마스터 규격 CANONICAL 9 THEME 표와 값이 일치해야 한다. */
const THEMES = [
  { key: 'navy-blue',     label: '딥 네이비 블루', shell: '#0B1830', primary: '#2457D6', secondary: '#1687A7', accent: '#17A889', highlight: '#E7C873', soft: '#DCE8F7' },
  { key: 'navy-gold',     label: '네이비 골드',   shell: '#111A2D', primary: '#2847A7', secondary: '#A37A28', accent: '#D0A84B', highlight: '#F0D995', soft: '#EFE8D7' },
  { key: 'emerald-gold',  label: '에메랄드 골드', shell: '#11332B', primary: '#0E7663', secondary: '#2C9277', accent: '#B4862A', highlight: '#E8CE88', soft: '#E2F0EA' },
  { key: 'forest-sage',   label: '포레스트 세이지', shell: '#17352C', primary: '#356E58', secondary: '#73977E', accent: '#A58E4D', highlight: '#D9D2AA', soft: '#E5ECE5' },
  { key: 'deep-teal',     label: '딥 틸',        shell: '#08323A', primary: '#087A83', secondary: '#1597A3', accent: '#D2704C', highlight: '#E9B59B', soft: '#DDEDEF' },
  { key: 'onyx-gold',     label: '오닉스 골드',   shell: '#15171C', primary: '#343942', secondary: '#6A717C', accent: '#B89032', highlight: '#E0C76F', soft: '#E6E8EC' },
  { key: 'burgundy',      label: '버건디 슬레이트', shell: '#3A1724', primary: '#7A2C49', secondary: '#667085', accent: '#A85C72', highlight: '#E6B6A5', soft: '#EEE4E8' },
  { key: 'plum-indigo',   label: '플럼 인디고',   shell: '#291A3D', primary: '#573F91', secondary: '#4E63A8', accent: '#8B5AA6', highlight: '#C4B0E6', soft: '#E9E5F3' },
  { key: 'steel',         label: '스틸 플래티넘', shell: '#24303B', primary: '#44647A', secondary: '#6D8899', accent: '#4C9AAA', highlight: '#C9D6DE', soft: '#E7EDF1' },
]

/** 기본 테마 — 브랜드 로고(짙은 청록)와 공개 사이트 웜 액센트에 가장 가까운 팔레트 */
const DEFAULT_THEME = 'deep-teal'

/* ---------- sRGB ↔ OKLab ---------- */
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
}
function rgbToHex([r, g, b]) {
  const f = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')
  return `#${f(r)}${f(g)}${f(b)}`.toUpperCase()
}
function rgbToOklab([r, g, b]) {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}
function oklabToRgb([L, a, bb]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3
  return [
    toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

/**
 * 밝기만 흰색 쪽으로 옮기고 채도는 덜 깎는다.
 * 단순 흰색 혼합은 옅은 단계에서 색상이 회색으로 죽어버려
 * 어두운 사이드바 위 글자나 옅은 배지에서 브랜드 색이 사라진다.
 */
function tint(hex, amt) {
  const [L, a, b] = rgbToOklab(hexToRgb(hex))
  const keep = (1 - amt) ** 0.55
  return rgbToHex(oklabToRgb([L + (1 - L) * amt, a * keep, b * keep]))
}
/** 밝기만 검은색 쪽으로 옮기고 채도는 유지한다. */
function shade(hex, amt) {
  const [L, a, b] = rgbToOklab(hexToRgb(hex))
  return rgbToHex(oklabToRgb([L * (1 - amt), a, b]))
}
const lighten = tint
const darken = shade

/**
 * 각 테마의 토큰 램프.
 * 이름(navy/brand/accent)은 기존 코드가 이미 쓰고 있는 Tailwind 유틸리티 이름이라 그대로 둔다.
 * 값만 테마에 따라 바뀌므로 화면 전체가 한 번에 갈아입는다.
 */
function ramp(t) {
  return {
    /* 원본 6색 — 신규 컴포넌트가 직접 참조한다 */
    '--theme-shell': t.shell,
    '--theme-primary': t.primary,
    '--theme-secondary': t.secondary,
    '--theme-accent': t.accent,
    '--theme-highlight': t.highlight,
    '--theme-soft': t.soft,

    /* Shell 램프 — 사이드바 표면과 그 위 글자 */
    '--color-navy-950': darken(t.shell, 0.35),
    '--color-navy-900': t.shell,
    '--color-navy-800': lighten(t.shell, 0.08),
    '--color-navy-700': lighten(t.shell, 0.16),
    '--color-navy-600': lighten(t.shell, 0.26),
    '--color-navy-300': lighten(t.shell, 0.62),
    '--color-navy-200': lighten(t.shell, 0.74),

    /* Primary 램프 — 주 버튼·활성 상태·링크 */
    '--color-brand-50': lighten(t.primary, 0.94),
    '--color-brand-100': lighten(t.primary, 0.86),
    '--color-brand-200': lighten(t.primary, 0.74),
    '--color-brand-500': lighten(t.primary, 0.12),
    '--color-brand-600': t.primary,
    '--color-brand-700': darken(t.primary, 0.16),

    /* Accent 램프 — AI/보조 강조 */
    '--color-accent-50': lighten(t.accent, 0.93),
    '--color-accent-200': lighten(t.accent, 0.72),
    '--color-accent-600': t.accent,
    '--color-accent-700': darken(t.accent, 0.16),

    /* Secondary·Highlight — 배지/차트 보조 */
    '--color-second-50': lighten(t.secondary, 0.93),
    '--color-second-200': lighten(t.secondary, 0.72),
    '--color-second-600': t.secondary,
    '--color-second-700': darken(t.secondary, 0.16),
    '--color-highlight-100': lighten(t.highlight, 0.7),
    '--color-highlight-500': t.highlight,
    '--color-highlight-700': darken(t.highlight, 0.3),

    /* Soft — 넓은 면적의 옅은 브랜드 틴트 */
    '--color-soft-50': lighten(t.soft, 0.55),
    '--color-soft-100': t.soft,
  }
}

const header = `/*
 * 자동 생성 파일 — 직접 수정하지 말 것.
 * 생성: node scripts/gen-theme-css.mjs
 *
 * 마스터 규격의 CANONICAL 9 THEME(각 6색)을 앱 전역 색 토큰으로 확장한 결과다.
 * - Theme 토큰(navy/brand/accent/second/highlight/soft)만 테마에 따라 바뀐다.
 * - 본문 중립색(slate)과 의미색(success/warning/danger)은 테마와 분리되어 고정이다.
 */
`

let css = header
for (const t of THEMES) {
  // 선택자 특정도를 (0,1,1) 로 맞춰 Tailwind 의 :root 기본값을 순서와 무관하게 덮는다.
  const sel =
    t.key === DEFAULT_THEME
      ? `html:not([data-theme]),\nhtml[data-theme='${t.key}']`
      : `html[data-theme='${t.key}']`
  const body = Object.entries(ramp(t))
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')
  css += `\n/* ${t.label} */\n${sel} {\n${body}\n}\n`
}

mkdirSync('src/styles', { recursive: true })
writeFileSync('src/styles/themes.generated.css', css)
console.log(`테마 ${THEMES.length}종 생성 · ${css.length} bytes → src/styles/themes.generated.css`)

/* ---------- 대비 검증 — 어두운 사이드바 가독성 규칙 ---------- */
function relLum(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a, b) {
  const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
let fail = 0
for (const t of THEMES) {
  const r = ramp(t)
  const checks = [
    ['navy-300 on shell', r['--color-navy-300'], r['--color-navy-900'], 4.5],
    ['navy-200 on shell', r['--color-navy-200'], r['--color-navy-900'], 4.5],
    ['white on brand-600', '#FFFFFF', r['--color-brand-600'], 4.5],
    ['brand-700 on brand-50', r['--color-brand-700'], r['--color-brand-50'], 4.5],
  ]
  for (const [name, fg, bg, min] of checks) {
    const c = contrast(fg, bg)
    if (c < min) {
      fail += 1
      console.error(`  대비 부족  ${t.key.padEnd(14)} ${name.padEnd(20)} ${c.toFixed(2)} < ${min}`)
    }
  }
}
console.log(fail === 0 ? '대비 검사 통과' : `대비 검사 실패 ${fail}건`)
if (fail > 0) process.exitCode = 1
