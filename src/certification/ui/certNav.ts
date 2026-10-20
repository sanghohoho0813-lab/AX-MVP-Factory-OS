/** 기업인증 화면 주소 (D-170) */
export function sectionHref(section: string, clientId: string | null) {
  return `/tools/cert-os/${section}${clientId ? `?client=${clientId}` : ''}`
}

/** D-246 벤처 사업계획서 쓰기(기업인증 › 벤처 안) */
export function venturePlanHref(clientId: string | null) {
  return `/tools/cert-os/venture?${clientId ? `client=${clientId}&` : ''}plan=1`
}

/** 4단계 문법 — 받을 수 있나요? · 무엇을 준비하나요? · 실제 진행 · 받으면 무엇이 달라지나요? */
export const STEP_LABEL = ['받을 수 있나요?', '무엇을 준비하나요?', '실제 진행', '받으면 무엇이 달라지나요?'] as const
