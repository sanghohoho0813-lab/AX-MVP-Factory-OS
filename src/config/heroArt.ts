/**
 * UXS-1 화면 머리 배경 그림 — 대표가 준 4장(2026-10-25). 자리마다 한 장 · 오른쪽에 두고 왼쪽은 글자 자리로 비워 둔 그림.
 * 지금은 받은 PNG 를 WebP 로 줄인 것(1440×420 · 1280×360). 대표가 SVG 를 주면 이 표의 import 만 바꾼다(화면 코드 그대로).
 */
import home from '../assets/hero/hero-home.webp'
import ai from '../assets/hero/hero-ai.webp'
import patentVenture from '../assets/hero/hero-patent-venture.webp'
import sales from '../assets/hero/hero-sales.webp'

export type HeroArt = 'home' | 'ai' | 'patent-venture' | 'sales'

export const HERO_ART: Record<HeroArt, string> = {
  /** 홈 대시보드(오늘) 웰컴 — 나침반 · 물결 */
  home,
  /** AI 전략실 — 연결망 · 분석 카드 */
  ai,
  /** 특허 · 벤처 — 반짝임 · 확인 도장 문서 · 성장 그래프 */
  'patent-venture': patentVenture,
  /** 영업 관리 — 성장 선 · 과녁 */
  sales,
}
