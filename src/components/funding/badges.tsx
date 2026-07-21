import type { LucideIcon } from 'lucide-react'
import type { StatusTone } from '../../types'
import type {
  ApplicationStage,
  CaseStudyStatus,
  CaseVisibility,
  ConsentStatus,
  CriterionStatus,
  DocumentRequirementStatus,
  FundingStrategyStatus,
  GapSeverity,
  GapStatus,
  InformationFreshnessStatus,
  InstitutionCategory,
  MatchConfidence,
  MatchPriority,
  OutcomeType,
  OutreachChannel,
  OutreachPlanStatus,
  SourceStatus,
  SupportType,
} from '../../types/funding'
import { TONE_BADGE_CLASS } from '../../lib/statusMeta'
import {
  APPLICATION_STAGE_META,
  CASE_STATUS_META,
  CASE_VISIBILITY_META,
  CONSENT_STATUS_META,
  CRITERION_STATUS_META,
  DOCUMENT_STATUS_META,
  FRESHNESS_META,
  GAP_SEVERITY_META,
  GAP_STATUS_META,
  INSTITUTION_CATEGORY_META,
  MATCH_CONFIDENCE_META,
  MATCH_PRIORITY_META,
  OUTCOME_TYPE_META,
  OUTREACH_CHANNEL_META,
  OUTREACH_PLAN_STATUS_META,
  SOURCE_STATUS_META,
  STRATEGY_STATUS_META,
  SUPPORT_TYPE_META,
} from '../../lib/fundingMeta'

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
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${TONE_BADGE_CLASS[tone]}`}
    >
      {Icon && <Icon aria-hidden="true" className="size-3.5" />}
      {label}
    </span>
  )
}

export function InstitutionCategoryBadge({ category }: { category: InstitutionCategory }) {
  const m = INSTITUTION_CATEGORY_META[category]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}
export function SourceStatusBadge({ status }: { status: SourceStatus }) {
  const m = SOURCE_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} title={m.description} />
}
export function SupportTypeBadge({ type }: { type: SupportType }) {
  const m = SUPPORT_TYPE_META[type]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}
export function FreshnessBadge({ status }: { status: InformationFreshnessStatus }) {
  const m = FRESHNESS_META[status]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}
export function StrategyStatusBadge({ status }: { status: FundingStrategyStatus }) {
  const m = STRATEGY_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}
export function MatchPriorityBadge({ priority }: { priority: MatchPriority }) {
  const m = MATCH_PRIORITY_META[priority]
  return <Badge tone={m.tone} label={m.label} title={m.description} />
}
export function MatchConfidenceBadge({ confidence }: { confidence: MatchConfidence }) {
  const m = MATCH_CONFIDENCE_META[confidence]
  return <Badge tone={m.tone} label={m.label} title={m.description} />
}
export function CriterionStatusBadge({ status }: { status: CriterionStatus }) {
  const m = CRITERION_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} title={m.description} />
}
export function GapSeverityBadge({ severity }: { severity: GapSeverity }) {
  const m = GAP_SEVERITY_META[severity]
  return <Badge tone={m.tone} label={m.label} />
}
export function GapStatusBadge({ status }: { status: GapStatus }) {
  const m = GAP_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} />
}
export function OutreachChannelBadge({ channel }: { channel: OutreachChannel }) {
  const m = OUTREACH_CHANNEL_META[channel]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}
export function OutreachPlanStatusBadge({ status }: { status: OutreachPlanStatus }) {
  const m = OUTREACH_PLAN_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} />
}
export function DocumentStatusBadge({ status }: { status: DocumentRequirementStatus }) {
  const m = DOCUMENT_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} />
}
export function ApplicationStageBadge({ stage }: { stage: ApplicationStage }) {
  const m = APPLICATION_STAGE_META[stage]
  return <Badge tone={m.tone} label={m.label} />
}
export function OutcomeTypeBadge({ type }: { type: OutcomeType }) {
  const m = OUTCOME_TYPE_META[type]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}
export function CaseVisibilityBadge({ visibility }: { visibility: CaseVisibility }) {
  const m = CASE_VISIBILITY_META[visibility]
  return <Badge tone={m.tone} label={m.label} title={m.description} />
}
export function CaseStatusBadge({ status }: { status: CaseStudyStatus }) {
  const m = CASE_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} />
}
export function ConsentBadge({ status }: { status: ConsentStatus }) {
  const m = CONSENT_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} />
}
