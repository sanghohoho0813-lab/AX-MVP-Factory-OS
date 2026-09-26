import { KanbanSquare, Library, PackageSearch, Presentation, type LucideIcon } from 'lucide-react'

/**
 * 영업 관리 안의 탭 목록 (D-114) — 사이드바 '영업 관리' 한 줄이 이 주소들을 모두 맡는다.
 * 탭이 늘면 여기만 는다(메뉴 목록 moduleRegistry 와 탭 모양 SalesTabs 가 같이 읽는다).
 */
export interface SalesTab {
  to: string
  label: string
  icon: LucideIcon
}

export const SALES_TABS: SalesTab[] = [
  { to: '/sales/board', label: '영업 보드', icon: KanbanSquare },
  // D-114 2단계 — 'AX 1차 미팅 체크리스트'(/sales/first-meeting, 대표가 따로 만드는 중)와는 다른 것: 원본 영업 도구의 1·2·3차 대본
  { to: '/sales/meeting', label: '미팅 준비', icon: Presentation },
  // D-114 3단계 — 상품표 40 · 제안서 · 업무범위서 · 월납 제안 · 계약 준비
  { to: '/sales/proposal', label: '상품·제안', icon: PackageSearch },
  // D-114 4단계 — 영업 전략 17 · 크레탑 무기 34 · 절세 전략 25 · 주제별 연락할 고객
  { to: '/sales/strategy', label: '전략', icon: Library },
]

export const SALES_TAB_PATHS = SALES_TABS.map((t) => t.to)
