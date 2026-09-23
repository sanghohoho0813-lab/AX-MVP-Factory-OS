/**
 * 크레탑 화면 색 (D-92) — 원본 영업 OS(App.jsx `C` 팔레트)의 값을 그대로 옮긴 것.
 * 좋아지면 초록, 나빠지면 빨강. 화면과 시험이 같은 표를 본다.
 */

/** 원본 팔레트 (App.jsx `C`) — 화면에서 쓰는 것만 */
export const CRETOP_C = {
  gold: '#B45309',
  blue: '#2563EB',
  purple: '#7C3AED',
  text: '#0F172A',
  textS: '#334155',
  textM: '#64748B',
  bdr: '#E6EAF0',
  bg: '#F4F6F8',
  ok: '#059669',
  warn: '#D97706',
  err: '#DC2626',
  blueBg: '#E8F1FE',
  purpleBg: '#F2ECFE',
} as const

/** 추이 한 줄 평 글상자 색 (원본 그대로) */
export const TREND_COMMENT_TONE = {
  red: { bg: '#FEF2F2', fg: '#B91C1C', bd: '#FCA5A5' },
  green: { bg: '#F0FDF4', fg: '#15803D', bd: '#86EFAC' },
  gray: { bg: '#EFF4FB', fg: '#334155', bd: '#CBD5E1' },
} as const

/** 좋아짐/나빠짐 색 — 상승 초록 · 하락 빨강 · 유지 회색 · 그 밖 주황 */
export function dirColor(d: string): string {
  return d === '상승' ? CRETOP_C.ok : d === '하락' ? CRETOP_C.err : d === '유지' ? CRETOP_C.textM : CRETOP_C.warn
}
export function transColor(tr: string): string {
  return tr === '흑자전환' ? CRETOP_C.ok : tr === '적자폭 축소' ? CRETOP_C.warn : CRETOP_C.err
}


/**
 * 줄어야 좋은 지표 (D-92) — 부채·차입금·원가. 이것들은 늘면 빨강, 줄면 초록이다.
 * 대표가 '작년보다 좋아졌나' 를 색 하나로 읽게 한다 (원본은 방향만 보고 칠했다).
 */
export const LOWER_IS_BETTER = new Set([
  'totalLiabilities',
  'shortTermBorrowings',
  'longTermBorrowings',
  'debtRatio',
  'debtDependency',
  'debtToSales',
  'cogs',
  'sga',
])

/** 연도 사이 변화 칸 색 — 좋아짐 초록 · 나빠짐 빨강 · 그대로 회색 · 판단 불가 주황 */
export function changeColor(key: string, dir: string): string {
  if (dir === '유지') return CRETOP_C.textM
  if (dir !== '상승' && dir !== '하락') return CRETOP_C.warn
  const up = dir === '상승'
  const good = LOWER_IS_BETTER.has(key) ? !up : up
  return good ? CRETOP_C.ok : CRETOP_C.err
}
