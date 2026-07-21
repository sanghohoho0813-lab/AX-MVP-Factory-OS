import type { LucideIcon } from 'lucide-react'
import type { StatusTone } from '../../types'
import type {
  BuildArtifactStatus,
  FeedbackSeverity,
  FeedbackStatus,
  FeedbackType,
  GateCriterionStatus,
  MetricDirection,
  ParticipantConsentStatus,
  ParticipantStatus,
  ScenarioRunResult,
  ValidationDecisionType,
  ValidationGateStatus,
  ValidationIssueStatus,
  ValidationIssueType,
  ValidationParticipantRole,
  ValidationQualitySeverity,
  ValidationRoundStatus,
  ValidationTrackType,
  ValidationWorkspaceStatus,
} from '../../types/validation'
import { TONE_BADGE_CLASS } from '../../lib/statusMeta'
import {
  BUILD_STATUS_META,
  CONSENT_META,
  DECISION_META,
  FEEDBACK_STATUS_META,
  FEEDBACK_TYPE_META,
  GATE_CRITERION_STATUS_META,
  GATE_STATUS_META,
  ISSUE_STATUS_META,
  ISSUE_TYPE_META,
  METRIC_DIRECTION_META,
  PARTICIPANT_ROLE_META,
  PARTICIPANT_STATUS_META,
  QUALITY_SEVERITY_META,
  ROUND_STATUS_META,
  RUN_RESULT_META,
  SEVERITY_META,
  TRACK_META,
  WORKSPACE_STATUS_META,
} from '../../lib/validationMeta'

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

export function TrackBadge({ track }: { track: ValidationTrackType }) {
  const m = TRACK_META[track]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}

export function WorkspaceStatusBadge({ status }: { status: ValidationWorkspaceStatus }) {
  const m = WORKSPACE_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}

export function GateStatusBadge({ status }: { status: ValidationGateStatus }) {
  const m = GATE_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}

export function RunResultBadge({ result }: { result: ScenarioRunResult }) {
  const m = RUN_RESULT_META[result]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}

export function FeedbackTypeBadge({ type }: { type: FeedbackType }) {
  const m = FEEDBACK_TYPE_META[type]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}

export function SeverityBadge({ severity }: { severity: FeedbackSeverity }) {
  const m = SEVERITY_META[severity]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}

export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  const m = FEEDBACK_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} />
}

export function IssueStatusBadge({ status }: { status: ValidationIssueStatus }) {
  const m = ISSUE_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} />
}

export function IssueTypeBadge({ type }: { type: ValidationIssueType }) {
  const m = ISSUE_TYPE_META[type]
  return <Badge tone="neutral" label={m.label} icon={m.icon} />
}

export function DecisionBadge({ type }: { type: ValidationDecisionType }) {
  const m = DECISION_META[type]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}

export function GateCriterionStatusBadge({ status }: { status: GateCriterionStatus }) {
  const m = GATE_CRITERION_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} />
}

export function ParticipantRoleBadge({ role }: { role: ValidationParticipantRole }) {
  const m = PARTICIPANT_ROLE_META[role]
  return <Badge tone="neutral" label={m.label} icon={m.icon} />
}

export function ParticipantStatusBadge({ status }: { status: ParticipantStatus }) {
  const m = PARTICIPANT_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} />
}

export function ConsentBadge({ status }: { status: ParticipantConsentStatus }) {
  const m = CONSENT_META[status]
  return <Badge tone={m.tone} label={m.label} />
}

export function MetricDirectionBadge({ direction }: { direction: MetricDirection }) {
  const m = METRIC_DIRECTION_META[direction]
  return <Badge tone="neutral" label={`${m.symbol} ${m.label}`} icon={m.icon} />
}

export function BuildStatusBadge({ status }: { status: BuildArtifactStatus }) {
  const m = BUILD_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} />
}

export function RoundStatusBadge({ status }: { status: ValidationRoundStatus }) {
  const m = ROUND_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} />
}

export function QualitySeverityBadge({ severity }: { severity: ValidationQualitySeverity }) {
  const m = QUALITY_SEVERITY_META[severity]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}
