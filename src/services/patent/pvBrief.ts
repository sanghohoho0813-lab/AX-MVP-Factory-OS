/**
 * PV-1 특허 · 벤처 첫 화면 '이 회사 준비 현황' — 대표 "회사 선택 → 이미 작성한 자료 자동 확인 → [AI로 명세서 초안] → 점검 → [벤처 사업계획서 이어 만들기]".
 *
 * 규칙 계산(AI 아님). 진행판(pvBoard)의 다음 할 일을 그대로 쓰고, 화면에는 세 칸(명세서 → 점검 → 사업계획서) · 이미 있는 자료 · 주의 한 줄만.
 *  - 명세서가 아직 없으면 다음 할 일은 '새 명세서'(대표 AI 계정이면 열자마자 AI 가 처음부터 — D-261).
 *  - 정확도: AI 가 쓴 것은 초안 — 출원 · 신청은 사람이 정한다. 출원번호 · 등록 · 매출은 기록에 있는 것만(지어내지 않음).
 *    선행기술 조사를 했는지 보여 준다(안 했으면 '아직').
 */
import { normalizeDraft } from './specDraft'
import { pvBoard, type PvBoardRow, type PvDraftInput, type PvPlanInput } from './pvBoard'

export type PvStepState = 'done' | 'doing' | 'todo'

export interface PvBrief {
  steps: Array<{ key: 'spec' | 'check' | 'plan'; label: string; state: PvStepState; text: string }>
  /** 이미 있는 자료(AI · 규칙이 알아서 씀) */
  have: string[]
  /** 다음 할 일 — href 가 없으면 새 명세서(act) */
  next: { text: string; label: string; href?: string; act?: 'new-spec' }
  /** 선행기술 조사 — 명세서가 없으면 null */
  research: 'done' | 'todo' | null
  cautions: string[]
  row: PvBoardRow | null
}

export interface PvBriefInput {
  clientId: string
  drafts: readonly PvDraftInput[]
  plans: readonly PvPlanInput[]
  clients: readonly { id: string; companyName: string }[]
  /** 회사 기록에서 AI 에 갈 사실 줄 수(업종 · 설립 · 직원 · 매출 · 거래처 · 인증 · 특허 · 연구소 · 메모) */
  factLines: number
  /** 서류함에서 재료로 읽을 수 있는 파일 이름 */
  docs: readonly string[]
  /** 대표 AI(명세서 AI)를 쓸 수 있음 */
  specAi: boolean
  /** 기록에 있는 출원번호(없으면 '') */
  applicationNumber?: string
}

export function pvBrief(input: PvBriefInput): PvBrief {
  const row = pvBoard({ drafts: input.drafts, plans: input.plans, clients: input.clients }).find((r) => r.key === input.clientId) ?? null
  const spec = row?.spec ?? null
  const plan = row?.plan ?? null
  const latest = [...input.drafts].filter((d) => d.clientId === input.clientId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  const research = latest ? (normalizeDraft(latest.draft).research ? 'done' : 'todo') : null
  const specDone = !!spec && spec.done === spec.total
  const steps: PvBrief['steps'] = [
    // 상태는 화면이 '끝 · 진행 중 · 아직' 으로 따로 적는다 — 여기 text 는 숫자만(아직이면 빈칸)
    { key: 'spec', label: '특허 명세서', state: specDone ? 'done' : spec ? 'doing' : 'todo', text: spec ? `${spec.done}/${spec.total}단계` : '' },
    // 점검은 명세서를 다 쓴 뒤의 일 — 쓰는 중에 나오는 '고칠 것' 은 아직 보이지 않는다(헷갈리지 않게)
    { key: 'check', label: '점검', state: !specDone ? 'todo' : spec.errors > 0 ? 'doing' : 'done', text: !specDone ? '' : spec.errors > 0 ? `고칠 것 ${spec.errors}` : '고칠 것 0' },
    { key: 'plan', label: '벤처 사업계획서', state: plan?.complete ? 'done' : plan ? 'doing' : 'todo', text: plan ? `서술 ${plan.narrative}/${plan.narrativeTotal}` : '' },
  ]
  const have: string[] = []
  if (input.factLines) have.push(`회사 기록 ${input.factLines}줄`)
  if (input.docs.length) have.push(`서류함 ${input.docs.length}개(${input.docs.slice(0, 2).join(' · ')}${input.docs.length > 2 ? ' …' : ''})`)
  if (row && row.specCount) have.push(`명세서 ${row.specCount}개`)
  if (plan) have.push(plan.hasPatent ? '사업계획서 기록 · 특허 재료 있음' : '사업계획서 기록')
  const next: PvBrief['next'] = !spec && (!row || row.stage === 'spec') ? { text: '명세서부터 — 그 요약이 벤처 사업계획서 재료가 돼요', label: input.specAi ? 'AI로 명세서 초안 쓰기' : '명세서 쓰기 시작', act: 'new-spec' } : row ? { ...row.next } : { text: '명세서부터', label: '명세서 쓰기 시작', act: 'new-spec' }
  const cautions = ['AI 가 쓴 것은 초안이에요 — 출원 · 신청은 대표 · 변리사가 확인하고 정해요']
  cautions.push(input.applicationNumber?.trim() ? `출원번호(기록): ${input.applicationNumber.trim()}` : '출원번호 · 등록 · 매출은 기록에 있는 것만 써요 — 지금 기록에 출원번호 없음')
  return { steps, have, next, research, cautions, row }
}
