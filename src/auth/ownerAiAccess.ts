/**
 * 대표 AI 작업실을 이 화면에서 열 수 있는가 — 기능 권한(capability) 'can_use_owner_ai_workspace'.
 *
 *   yes    권한 있음(대표). 로컬 모드(이 기기 = 대표 혼자 쓰는 시험 · 개발)도 yes
 *   no     팀장(Pilot) · 대표가 팀장 화면으로 볼 때 · 권한 없는 구성원 · 접근 없음
 *   setup  서버에 0021 이 아직 없다(대표 등급 full 일 때만) — 'DB 설정 필요' 안내만 보이고 열지 않는다
 *
 * 화면 문지기일 뿐이다 — 데이터는 DB 정책(owner_ai_can), AI 호출은 서버 함수(has_capability)가 따로 막는다.
 */
import { useContext } from 'react'
import { AuthContext } from './authContext'
import { useIsPilot } from './osAccess'

export const OWNER_AI_CAP = 'can_use_owner_ai_workspace'

export type OwnerAiAccess = 'yes' | 'no' | 'setup'

export function ownerAiAccessOf(input: { hasAuth: boolean; access: string | null; pilot: boolean; capabilities: readonly string[] | null }): OwnerAiAccess {
  if (!input.hasAuth || input.access === null) return 'yes'
  if (input.pilot) return 'no'
  if (input.access === 'legacy') return 'setup'
  if (input.access !== 'full') return 'no'
  if (input.capabilities === null) return 'setup'
  return input.capabilities.includes(OWNER_AI_CAP) ? 'yes' : 'no'
}

export function useOwnerAiAccess(): OwnerAiAccess {
  const auth = useContext(AuthContext)
  const pilot = useIsPilot()
  return ownerAiAccessOf({ hasAuth: !!auth, access: auth?.access ?? null, pilot, capabilities: auth?.capabilities ?? null })
}

/** 메뉴 · 찾기에 쓰는 권한 묶음(setup 이어도 메뉴는 보여 '설정 필요' 를 안내한다) */
export function useCapabilitySet(): ReadonlySet<string> {
  const a = useOwnerAiAccess()
  return a === 'no' ? new Set() : new Set([OWNER_AI_CAP])
}
