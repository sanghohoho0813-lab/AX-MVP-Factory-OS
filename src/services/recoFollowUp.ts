/**
 * D-314 보낸 요청 문구 → 할 일 한 줄('자료 받았는지 확인 — 표준재무제표증명(최근 3년) · 국세 납세증명서 외 8가지').
 * 요청 문구 세 가지(받을 자료 · 서류 요청 · 정책자금 신청 서류)는 모두 '1. 이름 — …' · '1. 이름 (기존 서류는 …)' 줄이다. 줄이 없으면 ''.
 * 글만 다룬다(판정 엔진 없음) — 업체 상세 첫 화면이 가볍게 쓰도록 recoRequest 에서 옮김(D-479 · recoRequest 가 다시 내보낸다).
 */
export function requestFollowUpText(text: string): string {
  const names = text
    .split('\n')
    .map((l) => /^\s*\d+\.\s+(.+?)(?:\s+—\s.*|\s*\(기존 서류는.*\))?\s*$/.exec(l)?.[1]?.trim())
    .filter((x): x is string => !!x)
  if (!names.length) return ''
  return `자료 받았는지 확인 — ${names.slice(0, 2).join(' · ')}${names.length > 2 ? ` 외 ${names.length - 2}가지` : ''}`
}
