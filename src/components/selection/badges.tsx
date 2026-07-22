import type { LucideIcon } from 'lucide-react'
import type { StatusTone } from '../../types'
import type {
  AiNecessity,
  AutomationApproach,
  CandidateComplexity,
  CandidateConfidence,
  CandidateRiskLevel,
  CandidateStatus,
  CandidateTaskFamily,
  PriorityQuadrant,
  SelectionResultStatus,
} from '../../types/selection'
import { TONE_BADGE_CLASS } from '../../lib/statusMeta'
import {
  AI_NECESSITY_META,
  AUTOMATION_APPROACH_META,
  CANDIDATE_CONFIDENCE_META,
  CANDIDATE_STATUS_META,
  COMPLEXITY_META,
  QUADRANT_META,
  RISK_LEVEL_META,
  SELECTION_STATUS_META,
  TASK_FAMILY_META,
} from '../../lib/selectionMeta'

interface Base {
  tone: StatusTone
  label: string
  icon?: LucideIcon
  title?: string
}
function Badge({ tone, label, icon: Icon, title }: Base) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.875rem] font-medium ${TONE_BADGE_CLASS[tone]}`}
    >
      {Icon && <Icon aria-hidden="true" className="size-3.5" />}
      {label}
    </span>
  )
}

export function CandidateStatusBadge({ status }: { status: CandidateStatus }) {
  const m = CANDIDATE_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} title={m.description} />
}

export function TaskFamilyBadge({ family }: { family: CandidateTaskFamily }) {
  const m = TASK_FAMILY_META[family]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}

export function AutomationApproachBadge({ approach }: { approach: AutomationApproach }) {
  const m = AUTOMATION_APPROACH_META[approach]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} title={m.description} />
}

export function AiNecessityBadge({ necessity }: { necessity: AiNecessity }) {
  const m = AI_NECESSITY_META[necessity]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} title={m.description} />
}

export function CandidateConfidenceBadge({ confidence }: { confidence: CandidateConfidence }) {
  const m = CANDIDATE_CONFIDENCE_META[confidence]
  return <Badge tone={m.tone} label={`신뢰도 ${m.label}`} />
}

export function ComplexityBadge({ complexity }: { complexity: CandidateComplexity }) {
  const m = COMPLEXITY_META[complexity]
  return <Badge tone={m.tone} label={`복잡도 ${m.label}`} />
}

export function RiskLevelBadge({ level }: { level: CandidateRiskLevel }) {
  const m = RISK_LEVEL_META[level]
  return <Badge tone={m.tone} label={`위험 ${m.label}`} />
}

export function PriorityQuadrantBadge({ quadrant }: { quadrant: PriorityQuadrant }) {
  const m = QUADRANT_META[quadrant]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} title={m.description} />
}

export function SelectionStatusBadge({ status }: { status: SelectionResultStatus }) {
  const m = SELECTION_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} title={m.description} />
}
