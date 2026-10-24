/**
 * D-282 AI 전략실 작업마다 아이콘 · 기능 색 — 작업 단추 · 결과 카드 머리에 같은 그림.
 * 색은 기능 갈래(featureVisual)를 따른다: AX 분석 보라 · 특허 · 벤처 호박 · 자금 초록 · 제안서 파랑 · 전달문구 청록 · 그 밖 회색.
 */
import type { LucideIcon } from 'lucide-react'
import { Boxes, Brain, FileSearch, FileText, Landmark, LayoutDashboard, Lightbulb, MessageSquareText, MessagesSquare, Rocket, SpellCheck, Stamp, Target } from 'lucide-react'
import type { FeatureTone } from '../../config/featureVisual'
import type { SkillId } from '../../services/ownerAi/types'

export const SKILL_VISUAL: Record<SkillId, { icon: LucideIcon; tone: FeatureTone }> = {
  AX_PENGUIN: { icon: Target, tone: 'purple' },
  AX_IDEA: { icon: Lightbulb, tone: 'purple' },
  AX_MVP: { icon: Boxes, tone: 'purple' },
  AX_FRONT: { icon: LayoutDashboard, tone: 'purple' },
  SANGHO_PROPOSAL: { icon: FileText, tone: 'blue' },
  PATENT_IDEA: { icon: Stamp, tone: 'amber' },
  VENTURE_PLAN: { icon: Rocket, tone: 'amber' },
  FUNDING_STRATEGY: { icon: Landmark, tone: 'green' },
  CONSULTANT_MESSAGE: { icon: MessageSquareText, tone: 'teal' },
  FREE_CHAT: { icon: MessagesSquare, tone: 'slate' },
  CONTEXT_UPDATE: { icon: Brain, tone: 'slate' },
  PROOFREAD: { icon: SpellCheck, tone: 'slate' },
  SNAPSHOT_EXTRACT: { icon: FileSearch, tone: 'slate' },
}

export function skillVisual(id: SkillId): { icon: LucideIcon; tone: FeatureTone } {
  return SKILL_VISUAL[id] ?? { icon: MessagesSquare, tone: 'slate' }
}
