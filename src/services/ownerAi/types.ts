/**
 * 대표 AI 작업실(Company Case Intelligence) — 타입.
 *
 * Company Case = 미래AI랩이 한 번이라도 검토한 회사(고객이 아니어도). 기존 고객(operations_clients)과 이어 둘 수 있다(clientId).
 * 생성 → 판단(채택 · 일부 채택 · 폐기) → 기록(기억 버전 · 수정 이력 · 타임라인) → 재사용(다음 AI 호출의 맥락).
 */
import type { ActivityEntry } from '../../types/clientOps'

export type CaseRelation = 'reviewed' | 'peer_request' | 'meeting' | 'prospect' | 'proposing' | 'contracted' | 'on_hold' | 'closed'

export const CASE_RELATIONS: readonly CaseRelation[] = ['reviewed', 'peer_request', 'meeting', 'prospect', 'proposing', 'contracted', 'on_hold', 'closed']

export const RELATION_LABEL: Record<CaseRelation, string> = {
  reviewed: '한번 검토',
  peer_request: '동료 컨설턴트 요청',
  meeting: '상담 예정',
  prospect: '잠재고객',
  proposing: '제안중',
  contracted: '계약고객',
  on_hold: '보류',
  closed: '종료',
}

export type MaterialKind =
  | 'bizreg'
  | 'registry'
  | 'company_info'
  | 'intro'
  | 'bizplan'
  | 'patent'
  | 'proposal'
  | 'url'
  | 'paste'
  | 'chatgpt'
  | 'memo'
  | 'image'
  | 'other'

export const MATERIAL_KIND_LABEL: Record<MaterialKind, string> = {
  bizreg: '사업자등록증',
  registry: '법인등기부',
  company_info: '기업정보',
  intro: '회사소개서',
  bizplan: '기존 사업계획서',
  patent: '특허자료',
  proposal: '제안자료',
  url: '홈페이지 · URL',
  paste: '붙여넣은 글',
  chatgpt: 'ChatGPT 결과',
  memo: '메모',
  image: '이미지',
  other: '기타',
}

export interface CaseMaterial {
  id: string
  kind: MaterialKind
  title: string
  /** 읽어 낸 글 — 저장 전에 주민번호 · 비밀번호 · 키를 지운다(원문 저장 안 함) */
  text: string
  chars: number
  /** 같은 자료를 두 번 넣었는지 보는 지문 */
  hash: string
  fileName?: string
  fileSize?: number
  /** 클라우드 보관함 경로(파일을 올렸을 때) */
  storagePath?: string
  url?: string
  /** AI 에 보내지 않는 까닭(예: 4대보험 명부 — 개인별 원문) */
  excluded?: string
  /** 어디서 왔나(직접 · 업체 서류함 · Partner OS) */
  source?: string
  addedAt: string
}

/** 업체에서 읽어 낸 기본 정보(자료 요약 · 직접 입력) — 출처를 같이 둔다 */
export interface CaseFact {
  value: string
  source: string
  at: string
}

export type CaseFactKey = 'industry' | 'founded' | 'ceo' | 'employees' | 'revenue' | 'homepage' | 'mainProblem' | 'currentSystem' | 'coreBusiness'

export interface CompanyCase {
  id: string
  workspaceId: string | null
  ownerId: string | null
  companyName: string
  relation: CaseRelation
  /** 이어 둔 기존 고객(operations_clients.id) */
  clientId: string | null
  /** 숫자 10자리(없으면 '') */
  bizNo: string
  homepageUrl: string
  requester: string
  industry: string
  memo: string
  materials: CaseMaterial[]
  facts: Partial<Record<CaseFactKey, CaseFact>>
  /** 타임라인 — 고객 관리 활동 기록(ActivityEntry)과 같은 모양 */
  activity: ActivityEntry[]
  /** 지금까지의 기억 최신 판 번호(0 = 아직 없음) */
  contextVersion: number
  /** 어디서 들어왔나(예: 'partner:ax_proposal_requested') */
  origin: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

/** 지금까지의 핵심 기억(Current Context) — 칸마다 짧은 글 */
export interface CurrentContext {
  oneLine: string
  coreBusiness: string
  problems: string
  axDirection: string
  mvp: string
  patent: string
  venture: string
  funding: string
  quotes: string
  decided: string
  unknowns: string
  nextSteps: string
}

export type ContextKey = keyof CurrentContext

export const CONTEXT_FIELDS: readonly { key: ContextKey; label: string }[] = [
  { key: 'oneLine', label: '회사 한줄 정의' },
  { key: 'coreBusiness', label: '핵심 사업' },
  { key: 'problems', label: '해결할 문제' },
  { key: 'axDirection', label: '지금까지 선택된 AX 방향' },
  { key: 'mvp', label: '선택한 MVP' },
  { key: 'patent', label: '특허 방향' },
  { key: 'venture', label: '벤처 전략' },
  { key: 'funding', label: '자금 전략' },
  { key: 'quotes', label: '중요한 대표 · 컨설턴트 발언' },
  { key: 'decided', label: '확정사항' },
  { key: 'unknowns', label: '미확인사항' },
  { key: 'nextSteps', label: '다음 할 일' },
]

export function emptyContext(): CurrentContext {
  return { oneLine: '', coreBusiness: '', problems: '', axDirection: '', mvp: '', patent: '', venture: '', funding: '', quotes: '', decided: '', unknowns: '', nextSteps: '' }
}

export interface ContextSnapshot {
  id: string
  caseId: string
  version: number
  content: CurrentContext
  /** manual · run:<id> · chatgpt · free-chat … */
  source: string
  note: string
  createdBy: string | null
  createdAt: string
}

export type SkillId =
  | 'AX_PENGUIN'
  | 'AX_IDEA'
  | 'AX_MVP'
  | 'AX_FRONT'
  | 'SANGHO_PROPOSAL'
  | 'PATENT_IDEA'
  | 'VENTURE_PLAN'
  | 'FUNDING_STRATEGY'
  | 'CONSULTANT_MESSAGE'
  | 'FREE_CHAT'
  | 'CONTEXT_UPDATE'
  | 'PROOFREAD'
  | 'SNAPSHOT_EXTRACT'

export type Tier = 'cheap' | 'standard' | 'deep' | 'manual'

export type Evaluation = 'draft' | 'adopted' | 'partially_adopted' | 'rejected'

export const EVALUATION_LABEL: Record<Evaluation, string> = {
  draft: '검토 전',
  adopted: '채택',
  partially_adopted: '일부 채택',
  rejected: '폐기',
}

export type RunStatus = 'succeeded' | 'parse_fallback' | 'failed' | 'pasted'

export interface AiRunInput {
  task?: string
  options?: Record<string, string | number>
}

export interface AiRun {
  id: string
  caseId: string
  skillId: SkillId
  skillVersion: number
  input: AiRunInput
  /** 구조화된 결과(JSON) — 모양 검사를 통과하지 못했으면 null(원문은 rendered) */
  structured: unknown
  /** 사람이 읽는 글(Markdown) */
  rendered: string
  contextSnapshotId: string | null
  contextVersion: number | null
  provider: string
  model: string
  tier: Tier
  status: RunStatus
  evaluation: Evaluation
  evaluationNote: string
  /** 일부 채택이면 어느 부분(예: { index: 1 }) */
  adoptedPart: unknown
  evaluatedAt: string | null
  usage: { input: number; output: number; total: number }
  estimatedCostUsd: number | null
  requestId: string | null
  createdBy: string | null
  createdAt: string
}

export interface AiRevision {
  runId: string
  revisionNo: number
  content: unknown
  note: string
  editedBy: string | null
  createdAt: string
}
