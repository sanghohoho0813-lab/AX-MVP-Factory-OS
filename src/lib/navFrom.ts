/**
 * 어디서 왔는가 (D-124) — 영업 관리에서 업체 화면으로 넘어갈 때 돌아갈 곳을 함께 싣는다.
 *
 * 업체 화면(/ops/clients/:id)은 고객 관리 소속이라, 영업 보드 · 미팅 준비에서 업체 이름을 누르면
 * 머리줄 · 메뉴가 '고객 관리' 로 바뀌고 '← 고객 관리 현황' 이 고객 목록으로 보냈다(대표: "영업 관리에서
 * 뒤로가기 누르면 고객 관리로 간다"). 이제 영업에서 온 업체 화면은 '← 영업 관리로'(되돌아가기)를 보이고,
 * 메뉴도 영업 관리에 불을 켠 채로 둔다.
 */
import { useLocation, type Location } from 'react-router-dom'

export interface NavFrom {
  /** 돌아갈 주소(경로 + ?) */
  path: string
  /** 돌아가기 단추 글자 */
  label: string
}

export function fromState(location: Pick<Location, 'pathname' | 'search'>, label = '영업 관리'): { from: NavFrom } {
  return { from: { path: location.pathname + location.search, label } }
}

export function navFromOf(state: unknown): NavFrom | null {
  const f = (state as { from?: unknown } | null)?.from as Partial<NavFrom> | undefined
  return f && typeof f.path === 'string' && typeof f.label === 'string' ? { path: f.path, label: f.label } : null
}

/**
 * 메뉴 · 머리줄이 '지금 어디' 로 볼 경로 — 영업에서 온 업체 화면이면 영업 쪽 경로.
 */
export function useNavPath(): string {
  const location = useLocation()
  const from = navFromOf(location.state)
  if (from && from.path.startsWith('/sales') && location.pathname.startsWith('/ops/clients/')) return from.path.split('?')[0]
  return location.pathname
}
