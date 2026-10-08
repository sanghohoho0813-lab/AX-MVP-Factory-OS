/**
 * LEGACY 벤처 기록 잠금 (D-179) — 예전 '특허+벤처'(지금 '특허·MVP') 화면의 벤처 전용 기록은 읽기만.
 *
 * 벤처기업 확인 업무는 기업인증(cert-os/venture)에서만 수정 · 진행한다. 이 화면에서는:
 *  - 벤처 전용 기록(사업계획서 7항목 · 제출서류 · Red Flag · Judge · 신청 기록 · 증빙 10슬롯 · 현장실사 · 결과)
 *  - S10~S16 단계 상태 · 메모
 *  - 핵심 줄기의 '벤처 Solution 핵심문장'
 *  - 벤처 단계 프롬프트 · 산출물 · 신청 직전 기준 확인(venture_application)
 * 을 바꾸지 않는다. 특허 · MVP · 사실표(회사 정보) · S0~S9 · S1 진행 판단은 그대로 편집한다.
 * 데이터는 지우지 않는다 — 기업인증의 LEGACY 어댑터가 계속 읽는다.
 */
import type { ArtifactType, ConsultingProject, StageKey } from '../../types/consulting'
import { artifactDef } from './artifactDefinitions'

export const LEGACY_VENTURE_STAGES: readonly StageKey[] = ['S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16']

/** 벤처 전용 기록 쓰기 잠금 — 코드 경로는 지우지 않고 잠근다 */
export const LEGACY_VENTURE_LOCKED: boolean = true

export const LEGACY_VENTURE_MESSAGE = '이전 벤처 기록은 읽기만 할 수 있습니다. 벤처기업 확인 업무는 기업인증에서 진행합니다.'

export function isLegacyVentureStage(stage: StageKey | string | null | undefined): boolean {
  return !!stage && (LEGACY_VENTURE_STAGES as readonly string[]).includes(stage)
}

/** 벤처 단계(S10~S16)에 속한 산출물 종류 — 새로 만들지 않는다 */
export function isLegacyVentureArtifactType(type: ArtifactType): boolean {
  return isLegacyVentureStage(artifactDef(type).stage)
}

/** 벤처 전용 기록이 바뀌었으면 이전 값으로 되돌린다(특허 · MVP · 사실표 · 다른 단계는 그대로). 바뀐 것이 없으면 next 그대로 */
export function keepLegacyVenture(prev: ConsultingProject, next: ConsultingProject): ConsultingProject {
  const stages = { ...next.stages }
  let stagesChanged = false
  for (const k of LEGACY_VENTURE_STAGES) {
    if (prev.stages[k] && next.stages[k] !== prev.stages[k]) {
      stages[k] = prev.stages[k]
      stagesChanged = true
    }
  }
  const ventureFresh = (p: ConsultingProject) => p.freshness.filter((f) => f.scope === 'venture_application')
  const freshChanged = JSON.stringify(ventureFresh(prev)) !== JSON.stringify(ventureFresh(next))
  const sentenceChanged = next.coreThread.ventureSentence !== prev.coreThread.ventureSentence
  if (next.venture === prev.venture && next.fieldReview === prev.fieldReview && !stagesChanged && !freshChanged && !sentenceChanged) return next
  return {
    ...next,
    venture: prev.venture,
    fieldReview: prev.fieldReview,
    stages,
    coreThread: sentenceChanged ? { ...next.coreThread, ventureSentence: prev.coreThread.ventureSentence } : next.coreThread,
    freshness: freshChanged ? [...ventureFresh(prev), ...next.freshness.filter((f) => f.scope !== 'venture_application')] : next.freshness,
  }
}
