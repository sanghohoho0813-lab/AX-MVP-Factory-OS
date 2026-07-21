import type { RespondentRole } from '../../types'
import type {
  ExpertRiskGrade,
  ModuleKind,
  ModuleStatus,
  QuestionCategory,
  QuestionScope,
  QuestionType,
  SurveyTemplateStatus,
} from '../../types/survey'
import { TONE_BADGE_CLASS } from '../../lib/statusMeta'
import {
  EXPERT_RISK_META,
  MODULE_KIND_META,
  MODULE_STATUS_META,
  QUESTION_CATEGORY_META,
  QUESTION_SCOPE_META,
  QUESTION_TYPE_META,
  RESPONDENT_ROLE_META,
  TEMPLATE_STATUS_META,
} from '../../lib/surveyMeta'

const badgeBase =
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.875rem] font-medium whitespace-nowrap'

export function QuestionTypeBadge({ type }: { type: QuestionType }) {
  const meta = QUESTION_TYPE_META[type]
  return (
    <span className={`${badgeBase} border-slate-200 bg-slate-50 text-slate-600`}>
      <meta.icon aria-hidden="true" className="size-3" />
      {meta.label}
    </span>
  )
}

export function QuestionCategoryBadge({
  category,
}: {
  category: QuestionCategory
}) {
  const meta = QUESTION_CATEGORY_META[category]
  return <span className={`${badgeBase} ${TONE_BADGE_CLASS[meta.tone]}`}>{meta.label}</span>
}

export function QuestionScopeBadge({ scope }: { scope: QuestionScope }) {
  const meta = QUESTION_SCOPE_META[scope]
  return <span className={`${badgeBase} ${TONE_BADGE_CLASS[meta.tone]}`}>{meta.label}</span>
}

export function ExpertRiskBadge({
  grade,
  compact = false,
}: {
  grade: ExpertRiskGrade
  compact?: boolean
}) {
  const meta = EXPERT_RISK_META[grade]
  return (
    <span
      title={meta.label}
      className={`${badgeBase} ${TONE_BADGE_CLASS[meta.tone]}`}
    >
      <meta.icon aria-hidden="true" className="size-3" />
      {compact ? '' : meta.label}
    </span>
  )
}

export function RespondentRoleBadge({ role }: { role: RespondentRole }) {
  const meta = RESPONDENT_ROLE_META[role]
  return (
    <span className={`${badgeBase} ${TONE_BADGE_CLASS[meta.tone]}`}>
      <meta.icon aria-hidden="true" className="size-3" />
      {meta.label}
    </span>
  )
}

export function TemplateStatusBadge({
  status,
}: {
  status: SurveyTemplateStatus
}) {
  const meta = TEMPLATE_STATUS_META[status]
  return (
    <span className={`${badgeBase} ${TONE_BADGE_CLASS[meta.tone]}`}>{meta.label}</span>
  )
}

export function ModuleKindBadge({ kind }: { kind: ModuleKind }) {
  const meta = MODULE_KIND_META[kind]
  return (
    <span className={`${badgeBase} ${TONE_BADGE_CLASS[meta.tone]}`}>
      <meta.icon aria-hidden="true" className="size-3" />
      {meta.label}
    </span>
  )
}

export function ModuleStatusBadge({ status }: { status: ModuleStatus }) {
  const meta = MODULE_STATUS_META[status]
  return <span className={`${badgeBase} ${TONE_BADGE_CLASS[meta.tone]}`}>{meta.label}</span>
}
