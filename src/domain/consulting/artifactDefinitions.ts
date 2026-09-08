/**
 * 산출물 종류 정의 — 어느 단계의 것이고, 어떤 프롬프트 결과로 들어오는가.
 */

import type { ArtifactStatus, ArtifactType, PromptPackageType, StageKey } from '../../types/consulting'

export interface ArtifactDefinition {
  type: ArtifactType
  label: string
  stage: StageKey
  /** 이 산출물을 만드는 프롬프트 종류 (없으면 사람이 직접 적는다) */
  fromPrompt: PromptPackageType | null
}

export const ARTIFACT_DEFS: ArtifactDefinition[] = [
  { type: 'PATENT_IDEA', label: '특허 아이디어 설계', stage: 'S3', fromPrompt: 'PATENT_IDEA' },
  { type: 'PRIOR_ART_REVIEW', label: '선행기술 검토', stage: 'S4', fromPrompt: 'PRIOR_ART_REVIEW' },
  { type: 'KIPO_REFERENCE_SET', label: 'KIPO 참고자료 세트', stage: 'S5', fromPrompt: null },
  { type: 'PATENT_SPEC_DRAFT', label: '명세서 초안', stage: 'S6', fromPrompt: 'PATENT_SPEC_DRAFT' },
  { type: 'PATENT_CLAIMS', label: '청구항 검토', stage: 'S6', fromPrompt: 'PATENT_CLAIMS_REVIEW' },
  { type: 'PATENT_FILING_RECORD', label: '출원 기록', stage: 'S7', fromPrompt: null },
  { type: 'MVP_SPEC', label: 'MVP_SPEC (전략 잠금)', stage: 'S8', fromPrompt: 'MVP_STRATEGY' },
  { type: 'MVP_BUILD_PROMPT', label: 'MVP 빌드 프롬프트', stage: 'S9', fromPrompt: 'MVP_CLAUDE_CODE_BUILD' },
  { type: 'MVP_STATE', label: 'MVP_STATE / QA', stage: 'S9', fromPrompt: null },
  { type: 'VENTURE_FACTSHEET_SNAPSHOT', label: '사실표 스냅샷', stage: 'S10', fromPrompt: null },
  { type: 'VENTURE_PLAN_SECTION', label: '사업계획서 항목', stage: 'S11', fromPrompt: 'VENTURE_PLAN_SECTION' },
  { type: 'VENTURE_PLAN_FULL', label: '사업계획서 전체 검토', stage: 'S11', fromPrompt: 'VENTURE_FULL_REVIEW' },
  { type: 'CLAIM_EVIDENCE_MATRIX', label: 'Claim–Evidence Matrix', stage: 'S12', fromPrompt: 'EVIDENCE_REVIEW' },
  { type: 'INFOGRAPHIC_BRIEF', label: '인포그래픽 기획', stage: 'S12', fromPrompt: 'INFOGRAPHIC_BRIEF' },
  { type: 'QA_REPORT', label: 'Final QA 보고', stage: 'S13', fromPrompt: 'VENTURE_FULL_REVIEW' },
  { type: 'SUBMISSION_RECORD', label: '신청 기록', stage: 'S14', fromPrompt: null },
  { type: 'FIELD_REVIEW_SCRIPT', label: '대표자 3분 Script', stage: 'S15', fromPrompt: 'FIELD_REVIEW_SCRIPT' },
  { type: 'FIELD_REVIEW_QA', label: '실사 예상 Q&A', stage: 'S15', fromPrompt: 'FIELD_REVIEW_QA' },
  { type: 'RESULT_RECORD', label: '결과 기록', stage: 'S16', fromPrompt: null },
  { type: 'GENERAL_REVIEW', label: '프로젝트 검토', stage: 'S0', fromPrompt: 'GENERAL_PROJECT_REVIEW' },
  { type: 'NOTE', label: '메모', stage: 'S0', fromPrompt: null },
]

const BY_TYPE = new Map(ARTIFACT_DEFS.map((d) => [d.type, d]))

export function artifactDef(type: ArtifactType): ArtifactDefinition {
  return BY_TYPE.get(type) ?? { type, label: type, stage: 'S0', fromPrompt: null }
}

export function isArtifactType(v: unknown): v is ArtifactType {
  return typeof v === 'string' && BY_TYPE.has(v as ArtifactType)
}

/** 프롬프트 종류 → 결과가 저장될 산출물 종류 */
export function artifactTypeForPrompt(p: PromptPackageType): ArtifactType {
  const hit = ARTIFACT_DEFS.find((d) => d.fromPrompt === p)
  return hit ? hit.type : 'GENERAL_REVIEW'
}

export const ARTIFACT_STATUS_LABEL: Record<ArtifactStatus, string> = {
  draft: '초안',
  in_review: '검토 중',
  approved: '확정',
  superseded: '대체됨',
}
