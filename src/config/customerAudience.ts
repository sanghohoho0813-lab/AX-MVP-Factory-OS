/**
 * D-562 구독 고객 화면 — 지금 로그인한 계정이 '외부 구독 고객'(os_access.audience = customer · 0024)인가.
 *
 * 대표(2026-11-10): "영업자 정산 · 1차 미팅 체크리스트 · 전문 모듈들은 당분간 빼자 — 아직 완성도를 다듬어야 하니까.
 *                    내 화면에서 말고 고객 화면에서."
 *  - 고객 계정은 등급이 pilot 이라 대표 전용 줄(영업자 정산 · 1차 미팅 체크리스트 등)은 이미 안 보인다.
 *    여기 값이 켜지면 '전문 모듈' 묶음(분야 줄 · 도구 · 모듈 전체 · 출시 예정)까지 메뉴 · 주소 · 찾기에서 같이 닫힌다
 *    (config/moduleRegistry 의 isPilotHiddenPath 하나가 본다 — 메뉴를 두 벌 만들지 않는다).
 *  - 대표 · 내부 팀장(audience = internal)은 그대로 — 대표가 팀장 화면으로 볼 때도 꺼진 채.
 *  - 서버에 0024 가 아직 없으면(audience 칸 없음) 늘 꺼진 채 — 외부 고객 계정 자체가 아직 없다.
 * 화면 정리일 뿐이다 — 자료는 서버(RLS)가 작업공간 단위로 나눈다.
 */
import { useSyncExternalStore } from 'react'

let customer = false
const listeners = new Set<() => void>()

export function setCustomerAudience(next: boolean) {
  if (customer === next) return
  customer = next
  listeners.forEach((l) => l())
}

export function isCustomerAudience(): boolean {
  return customer
}

export function useCustomerAudience(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => customer,
    () => customer,
  )
}
