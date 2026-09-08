/**
 * 프로젝트 편집 컨텍스트 — 탭 컴포넌트들이 같은 저장 경로를 쓰게 한다.
 *
 * update(fn) 은 즉시 화면에 반영하고 잠깐 뒤 한 번만 저장한다(자동저장).
 * 산출물·프롬프트·결정·증빙은 각자 서비스 함수를 부르고 refresh() 로 다시 읽는다.
 */

import { createContext, useContext } from 'react'
import type {
  ConsultingArtifact,
  ConsultingDecision,
  ConsultingEvidence,
  ConsultingProject,
  ConsultingPromptPackage,
  DecisionKind,
  StageKey,
} from '../../types/consulting'

export interface EditorValue {
  workspaceId: string | null
  userId: string | null
  today: string
  project: ConsultingProject
  artifacts: ConsultingArtifact[]
  prompts: ConsultingPromptPackage[]
  decisions: ConsultingDecision[]
  evidence: ConsultingEvidence[]
  /** 프로젝트 부분 수정 (자동저장) */
  update: (fn: (p: ConsultingProject) => ConsultingProject) => void
  /** 목록(산출물·프롬프트·결정·증빙)을 다시 읽는다 */
  refresh: () => Promise<void>
  /** 결정 한 줄 기록 (일기에도 남긴다) */
  decide: (input: { stageKey: StageKey; kind: DecisionKind; summary: string; reason?: string }) => Promise<void>
  /** 탭 이동 (focus 는 탭 안의 항목) */
  goTo: (tab: string, focus?: string) => void
  toast: (msg: string) => void
}

export const EditorContext = createContext<EditorValue | null>(null)

export function useEditor(): EditorValue {
  const v = useContext(EditorContext)
  if (!v) throw new Error('EditorContext 밖에서 useEditor 를 불렀습니다.')
  return v
}
