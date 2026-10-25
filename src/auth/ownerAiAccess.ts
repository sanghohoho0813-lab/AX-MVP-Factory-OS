/**
 * 대표 AI 전략실을 이 화면에서 열 수 있는가 — 기능 권한(capability) 'can_use_owner_ai_workspace'.
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
import { usePilotMarketing } from '../config/pilotMarketing'

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

/**
 * D-257 화면마다 AI 단추(AI 도우미 띠 · 대화창 · 답장 나누기 · 실사 말할 답 · 사업계획서 AI · 오른쪽 판 AI 대화) — 대표 지시 "팀장 계정에도 열되 일단 Gemini 만".
 *   owner  대표(모든 회사 모델) · 로컬 모드
 *   pilot  팀장 · 대표가 팀장 화면으로 볼 때 — Gemini 만(서버 ai-assist 도 Gemini 밖은 403)
 *   no / setup  useOwnerAiAccess 와 같은 뜻
 * AI 전략실(/ai · 업체 'AI 전략실' 탭)은 이것이 아니라 useOwnerAiAccess 그대로 — 팀장에게 안 연다.
 */
export type AssistAccess = 'owner' | 'pilot' | 'no' | 'setup'

export function aiAssistAccessOf(input: { hasAuth: boolean; access: string | null; pilot: boolean; capabilities: readonly string[] | null }): AssistAccess {
  if (!input.hasAuth || input.access === null) return 'owner'
  if (input.pilot) return 'pilot'
  const o = ownerAiAccessOf(input)
  return o === 'yes' ? 'owner' : o
}

export function useAiAssistAccess(): AssistAccess {
  const auth = useContext(AuthContext)
  const pilot = useIsPilot()
  return aiAssistAccessOf({ hasAuth: !!auth, access: auth?.access ?? null, pilot, capabilities: auth?.capabilities ?? null })
}

/**
 * SAAS-2 마케팅 화면(레이더 묶음 · 스레드 · 릴스/틱톡)의 AI — 대표는 예전 판정 그대로,
 * 고객(팀장 등급)은 서버가 마케팅을 열었을 때만(그 계정의 사용량을 장부로 셀 수 있을 때). 대표가 팀장 화면으로 볼 때는 꺼짐.
 */
export function useMarketingAiOn(): boolean {
  const owner = useOwnerAiAccess()
  const auth = useContext(AuthContext)
  const open = usePilotMarketing() === 'open'
  return owner !== 'no' || (auth?.access === 'pilot' && open)
}

/** AI 단추를 눌러 부를 수 있는가(대표 · 팀장) */
export const assistOn = (a: AssistAccess): boolean => a === 'owner' || a === 'pilot'

/** 메뉴 · 찾기에 쓰는 권한 묶음(setup 이어도 메뉴는 보여 '설정 필요' 를 안내한다) */
export function useCapabilitySet(): ReadonlySet<string> {
  const a = useOwnerAiAccess()
  return a === 'no' ? new Set() : new Set([OWNER_AI_CAP])
}
