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

/** 탭은 아니지만 영업 관리가 맡는 주소 (D-119) — 크레탑으로 새 잠재고객 */
export const SALES_EXTRA_PATHS = ['/sales/new']

/**
 * D-617 외부 구독 고객(audience = customer)에게 닫는 영업 화면 — 출시 목록 A6(2026-11-15 대표 선택 '고객 화면 정리').
 *  - 상품·제안: 우리 회사 상품표 40 · 제안서 · 월납 — 고객(외부 컨설턴트)의 상품이 아니다.
 *  - 전략: 우리 영업 전략 17 · 크레탑 무기 · 절세 전략 25 자료실.
 *  - 크레탑으로 새 잠재고객: 크레탑(전문 모듈)은 고객에게 이미 닫혀 있다(D-562) — 잠재고객은 [업체 추가] · [엑셀 목록 붙여넣기] 로.
 * 대표 · 내부 팀장 · 대표의 팀장 화면 보기는 그대로. 메뉴 · 주소 · 찾기 · 탭 · 순서 안내 · 단추가 모두 이 목록 하나를 본다.
 */
export const CUSTOMER_CLOSED_SALES_PATHS = ['/sales/proposal', '/sales/strategy', '/sales/new']

/** 이 주소(?뒤 값은 빼고 본다)가 고객에게 닫힌 영업 화면인가 */
export function isCustomerClosedSalesPath(path: string): boolean {
  const p = path.split(/[?#]/)[0]
  return CUSTOMER_CLOSED_SALES_PATHS.some((b) => p === b || p.startsWith(`${b}/`))
}
