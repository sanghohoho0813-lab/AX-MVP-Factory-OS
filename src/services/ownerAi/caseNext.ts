/**
 * AI-1 AI 전략실 업체 작업실 첫 질문 "이 회사에 어떤 도움을 줄까요?" — 지금 할 작업 하나 추천(규칙 계산, AI 아님).
 * 대표 "이 회사는 기존에 AX 방향이 확정되어 있으므로 MVP 구체화를 추천 / 분석 기록이 없어 AX 전략 분석부터".
 *
 *  - 채택(일부 채택 포함)한 결과만 '정해진 것' 으로 본다. 검토 전 결과가 있으면 그 수를 같이 알려 준다(채택 · 폐기를 먼저).
 *  - 순서: AX 전략 분석 → MVP 구체화 → 제안서 → 특허 · 벤처 → 정책자금 · 지원 전략.
 *  - 목적 단추 4개(AX 성장전략 · 정책자금 · 지원사업 · 특허 · 벤처 · 제안서)는 늘 보이고, 나머지 작업은 '다른 작업' 안에(지운 것 없음).
 */
import type { AiRun, SkillId } from './types'

export type CaseActionKey = 'ax' | 'idea' | 'mvp' | 'patent' | 'venture' | 'funding' | 'proposal' | 'front' | 'message' | 'free'

/** 첫 화면 목적 단추 — 빠른 작업 키로 잇는다 */
export const CASE_PURPOSES: ReadonlyArray<{ key: CaseActionKey; label: string }> = [
  { key: 'ax', label: 'AX 성장전략 분석' },
  { key: 'funding', label: '정책자금 · 지원사업 검토' },
  { key: 'patent', label: '특허 · 벤처 준비' },
  { key: 'proposal', label: '제안서 만들기' },
]

export interface CaseNext {
  action: CaseActionKey
  why: string
  /** 검토 전(채택 · 폐기 안 한) 결과 수 */
  pending: number
}

const ADOPTED = new Set(['adopted', 'partially_adopted'])
/** 결과 목록에 안 보이는 작업(기억 정리 · 맞춤법)은 세지 않는다 */
const HIDDEN: ReadonlySet<SkillId> = new Set(['PROOFREAD', 'CONTEXT_UPDATE', 'SNAPSHOT_EXTRACT'])

export function caseNext(runs: readonly Pick<AiRun, 'skillId' | 'evaluation' | 'status'>[]): CaseNext {
  const shown = runs.filter((r) => !HIDDEN.has(r.skillId) && r.status !== 'failed')
  const adopted = (s: SkillId) => shown.some((r) => r.skillId === s && ADOPTED.has(r.evaluation))
  const made = (s: SkillId) => shown.some((r) => r.skillId === s)
  const pending = shown.filter((r) => r.evaluation === 'draft').length
  // 결과는 있는데 아직 채택 전이면 — 다시 만들기보다 채택을 먼저(다음 단계 이름을 같이)
  const waiting = (s: SkillId, label: string, next: string) => (made(s) ? `${label} 결과를 채택하면 다음 단계(${next})를 추천해 드려요` : '')
  if (!adopted('AX_PENGUIN')) return { action: 'ax', pending, why: waiting('AX_PENGUIN', 'AX 전략 분석', 'MVP 구체화') || '아직 분석 기록이 없어 AX 전략 분석부터 시작하는 것을 추천합니다' }
  if (!adopted('AX_MVP')) return { action: 'mvp', pending, why: waiting('AX_MVP', 'MVP 구체화', '제안서') || 'AX 방향이 확정되어 있어 MVP 구체화를 추천합니다' }
  if (!adopted('SANGHO_PROPOSAL')) return { action: 'proposal', pending, why: waiting('SANGHO_PROPOSAL', '제안서', '특허 · 벤처') || 'AX · MVP 가 정해졌어요 — 고객에게 보여 줄 제안서를 만들 차례예요' }
  if (!adopted('PATENT_IDEA') && !adopted('VENTURE_PLAN')) return { action: 'patent', pending, why: waiting('PATENT_IDEA', '특허 아이디어', '정책자금 · 지원사업') || '제안서까지 됐어요 — 특허 · 벤처 준비를 추천합니다(변리사 검토 필요)' }
  return { action: 'funding', pending, why: '특허 · 벤처까지 정리됐어요 — 정책자금 · 지원사업을 검토할 차례예요' }
}
