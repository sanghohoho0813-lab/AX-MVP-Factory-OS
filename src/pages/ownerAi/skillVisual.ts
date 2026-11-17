/**
 * D-282 AI 전략실 작업마다 아이콘 — 작업 목록 · 목적 단추 · 결과 줄에 같은 그림.
 * D-624 색은 하나(AI 전략실 보라) — 대표 지시 "이모티콘 색은 통일 · 모양은 지금처럼 다르게".
 *       예전에는 작업마다 색이 달라(보라 · 호박 · 초록 · 파랑 · 청록 · 회색) 펼치면 오히려 눈에 안 들어왔다.
 */
import type { LucideIcon } from 'lucide-react'
import { Boxes, Brain, FileSearch, FileText, Landmark, LayoutDashboard, Lightbulb, MessageSquareText, MessagesSquare, Rocket, SpellCheck, Stamp, Target } from 'lucide-react'
import type { FeatureTone } from '../../config/featureVisual'
import type { SkillId } from '../../services/ownerAi/types'

/** 아이콘 색 — 모든 작업이 같은 색 */
export const SKILL_TONE: FeatureTone = 'purple'
/** 타일 없이 아이콘만 그릴 때 글자색(SKILL_TONE 과 같은 색) */
export const SKILL_ICON_TEXT = 'text-violet-600'

export const SKILL_ICON: Record<SkillId, LucideIcon> = {
  AX_PENGUIN: Target,
  AX_IDEA: Lightbulb,
  AX_MVP: Boxes,
  AX_FRONT: LayoutDashboard,
  SANGHO_PROPOSAL: FileText,
  PATENT_IDEA: Stamp,
  VENTURE_PLAN: Rocket,
  FUNDING_STRATEGY: Landmark,
  CONSULTANT_MESSAGE: MessageSquareText,
  FREE_CHAT: MessagesSquare,
  CONTEXT_UPDATE: Brain,
  PROOFREAD: SpellCheck,
  SNAPSHOT_EXTRACT: FileSearch,
}

export function skillIcon(id: SkillId): LucideIcon {
  return SKILL_ICON[id] ?? MessagesSquare
}

export function skillVisual(id: SkillId): { icon: LucideIcon; tone: FeatureTone } {
  return { icon: skillIcon(id), tone: SKILL_TONE }
}
