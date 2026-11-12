/**
 * SAAS-2 마케팅 · 브랜딩의 **AI 단추**를 대표가 아닌 계정(구독 고객 · 팀장)에게 여는 스위치 — 서버가 정한다.
 * (D-564 화면 자체는 아래 screens 값 — 팀장 등급이면 열린다. 이 state 는 AI 단추만 정한다.)
 *
 *  - 서버(api/ai-assist ?status=1)가 '이 계정의 AI 사용량을 장부(0022)로 셀 수 있다' 고 답할 때만 연다(marketing: true).
 *    장부가 없으면(대표가 SQL 을 아직 적용하지 않음) 예전처럼 닫힌 채 — 사용량을 세지 못하는 무거운 AI 를 열지 않는다.
 *  - 고객에게 여는 곳: 콘텐츠 레이더 · 스레드 · 릴스/틱톡. 홍보 글 만들기(업체용 · 카드뉴스 포함) · 홈페이지 만들기 ·
 *    예전 안내(/marketing/more)는 1차 상품 정리(3단계) 전까지 닫힌 채.
 *  - 대표가 팀장 화면으로 볼 때는 닫힌 채(AI 단추만 — 화면은 D-601 부터 열려 팀장 작업공간 것을 읽기만 한다).
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

/**
 * D-564 화면(메뉴 · 주소 · 찾기)은 팀장 등급 계정 전부에게 연다 — 사용량 장부와 상관없이.
 * 대표(2026-11-10): "최은혜 팀장이랑 새롭게 가입하는 사람들한테도 마케팅 · 브랜딩은 보이게. 대신 김팀장의 경영노트 채널이나 AX 같은 내 기본값은 없이."
 *  - 화면: 로그인 등급이 pilot(내부 팀장 · 구독 고객)이면 열림. D-601(2026-11-12 대표 "내 아이디에서 왔다갔다 해도 보이게") 부터
 *    대표가 팀장 화면으로 볼 때도 열린다 — 팀장 작업공간 것을 읽기만(화면들의 readOnly = useViewingPilot) · AI 단추 없음.
 *  - AI 단추: 위 state(서버가 정함) 그대로 — 화면이 열려도 서버가 허락하지 않으면 AI 단추는 없다(규칙 초안 · 틀 · 점검은 쓴다).
 * AppShell 이 그리기 전에 primePilotMarketingScreens 로 값을 맞추고(첫 화면에 '없는 화면' 이 깜빡이지 않게), 그린 뒤 setPilotMarketingScreens 로 알린다.
 */
let screens = false
let screensTold = false

export function primePilotMarketingScreens(on: boolean) {
  screens = on
}

export function setPilotMarketingScreens(on: boolean) {
  screens = on
  if (screensTold === on) return
  screensTold = on
  listeners.forEach((l) => l())
}

export function pilotMarketingScreens(): boolean {
  return screens
}

export function usePilotMarketingScreens(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => screens,
    () => screens,
  )
}

/** 고객에게 여는 마케팅 주소 — 레이더(/marketing · /marketing/youtube) · 스레드 · 릴스/틱톡 · 기초 7가지(D-571) */
const OPEN_BASES = ['/marketing/youtube', '/marketing/threads', '/marketing/shorts', '/marketing/basics']

export function isCustomerMarketingPath(pathname: string): boolean {
  if (pathname === '/marketing' || pathname === '/marketing/') return true
  return OPEN_BASES.some((b) => pathname === b || pathname.startsWith(`${b}/`))
}
