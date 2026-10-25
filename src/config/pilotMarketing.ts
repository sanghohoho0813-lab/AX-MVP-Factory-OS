/**
 * SAAS-2 마케팅 · 브랜딩을 대표가 아닌 계정(구독 고객 · 팀장)에게 여는 스위치 — 서버가 정한다.
 *
 *  - 서버(api/ai-assist ?status=1)가 '이 계정의 AI 사용량을 장부(0022)로 셀 수 있다' 고 답할 때만 연다(marketing: true).
 *    장부가 없으면(대표가 SQL 을 아직 적용하지 않음) 예전처럼 닫힌 채 — 사용량을 세지 못하는 무거운 AI 를 열지 않는다.
 *  - 고객에게 여는 곳: 콘텐츠 레이더 · 스레드 · 릴스/틱톡. 홍보 글 만들기(업체용 · 카드뉴스 포함) · 홈페이지 만들기 ·
 *    예전 안내(/marketing/more)는 1차 상품 정리(3단계) 전까지 닫힌 채.
 *  - 대표가 팀장 화면으로 볼 때는 닫힌 채(대표 마케팅은 대표 작업공간에서).
 * 메뉴 · 주소 · 찾기 · 휴대폰 메뉴가 모두 isPilotHiddenPath 하나를 보므로 여기 값 하나로 같이 열리고 닫힌다.
 */
import { useSyncExternalStore } from 'react'

export type PilotMarketingState = 'unknown' | 'open' | 'closed'

let state: PilotMarketingState = 'unknown'
const listeners = new Set<() => void>()

export function setPilotMarketing(next: PilotMarketingState) {
  if (state === next) return
  state = next
  listeners.forEach((l) => l())
}

export function pilotMarketingState(): PilotMarketingState {
  return state
}

export function usePilotMarketing(): PilotMarketingState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
    () => state,
  )
}

/** 고객에게 여는 마케팅 주소 — 레이더(/marketing · /marketing/youtube) · 스레드 · 릴스/틱톡 */
const OPEN_BASES = ['/marketing/youtube', '/marketing/threads', '/marketing/shorts']

export function isCustomerMarketingPath(pathname: string): boolean {
  if (pathname === '/marketing' || pathname === '/marketing/') return true
  return OPEN_BASES.some((b) => pathname === b || pathname.startsWith(`${b}/`))
}
