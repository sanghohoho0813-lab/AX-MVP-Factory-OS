import type { LucideIcon } from 'lucide-react'
import type { StatusTone } from '../../types'
import type {
  AnalysisIssueSeverity,
  AnalysisIssueStatus,
  AnalysisIssueType,
  AssessmentConfidence,
  AssessmentRecommendation,
  AssessmentStatus,
  ComparisonImportance,
  InterviewQuestionPriority,
  InterviewQuestionStatus,
  ResponseComparisonStatus,
  ScoreConfidence,
} from '../../types/assessment'
import { TONE_BADGE_CLASS } from '../../lib/statusMeta'
import {
  ASSESSMENT_STATUS_META,
  COMPARISON_IMPORTANCE_META,
  COMPARISON_STATUS_META,
  CONFIDENCE_META,
  INTERVIEW_PRIORITY_META,
  INTERVIEW_STATUS_META,
  ISSUE_SEVERITY_META,
  ISSUE_STATUS_META,
  ISSUE_TYPE_META,
  RECOMMENDATION_META,
  SCORE_CONFIDENCE_META,
} from '../../lib/assessmentMeta'

interface BaseBadgeProps {
  tone: StatusTone
  label: string
  icon?: LucideIcon
  title?: string
}

function Badge({ tone, label, icon: Icon, title }: BaseBadgeProps) {
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

export function AssessmentStatusBadge({ status }: { status: AssessmentStatus }) {
  const meta = ASSESSMENT_STATUS_META[status]
  return <Badge tone={meta.tone} label={meta.label} icon={meta.icon} title={meta.description} />
}

export function AssessmentRecommendationBadge({
  recommendation,
  withIcon = true,
}: {
  recommendation: AssessmentRecommendation
  withIcon?: boolean
}) {
  const meta = RECOMMENDATION_META[recommendation]
  return (
    <Badge
      tone={meta.tone}
      label={meta.label}
      icon={withIcon ? meta.icon : undefined}
      title={meta.description}
    />
  )
}

export function AssessmentConfidenceBadge({
  confidence,
}: {
  confidence: AssessmentConfidence
}) {
  const meta = CONFIDENCE_META[confidence]
  return <Badge tone={meta.tone} label={`신뢰도 ${meta.label}`} icon={meta.icon} title={meta.description} />
}

export function ScoreConfidenceBadge({
  confidence,
}: {
  confidence: ScoreConfidence
}) {
  const meta = SCORE_CONFIDENCE_META[confidence]
  return <Badge tone={meta.tone} label={meta.label} />
}

export function AnalysisIssueTypeBadge({ type }: { type: AnalysisIssueType }) {
  const meta = ISSUE_TYPE_META[type]
  return <Badge tone={meta.tone} label={meta.label} icon={meta.icon} title={meta.description} />
}

export function IssueSeverityBadge({
  severity,
}: {
  severity: AnalysisIssueSeverity
}) {
  const meta = ISSUE_SEVERITY_META[severity]
  return <Badge tone={meta.tone} label={meta.label} />
}

export function IssueStatusBadge({ status }: { status: AnalysisIssueStatus }) {
  const meta = ISSUE_STATUS_META[status]
  return <Badge tone={meta.tone} label={meta.label} />
}

export function ComparisonStatusBadge({
  status,
}: {
  status: ResponseComparisonStatus
}) {
  const meta = COMPARISON_STATUS_META[status]
  return <Badge tone={meta.tone} label={meta.label} icon={meta.icon} />
}

export function ComparisonImportanceBadge({
  importance,
}: {
  importance: ComparisonImportance
}) {
  const meta = COMPARISON_IMPORTANCE_META[importance]
  return <Badge tone={meta.tone} label={meta.label} />
}

export function InterviewPriorityBadge({
  priority,
}: {
  priority: InterviewQuestionPriority
}) {
  const meta = INTERVIEW_PRIORITY_META[priority]
  return <Badge tone={meta.tone} label={meta.label} />
}

export function InterviewStatusBadge({
  status,
}: {
  status: InterviewQuestionStatus
}) {
  const meta = INTERVIEW_STATUS_META[status]
  return <Badge tone={meta.tone} label={meta.label} />
}
