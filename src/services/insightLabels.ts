/**
 * 맞춤 추천 판정 이름표 (D-190) — clientInsights 가 다시 내보낸다.
 * D-479 AI 지시문 묶음(builders)이 이 이름표 하나 때문에 판정 엔진 전체(정책자금 · 인증 · 절세 …)를 받던 것을 떼어 냄. 값은 그대로.
 */
export type InsightTone = 'good' | 'maybe' | 'done' | 'need' | 'no'

export const INSIGHT_TONE_LABEL: Record<InsightTone, string> = {
  good: '가능성 높음',
  maybe: '검토해 볼 만함',
  done: '분석 있음',
  need: '정보가 더 필요해요',
  no: '지금은 어려움',
}
