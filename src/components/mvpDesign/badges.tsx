import type { LucideIcon } from 'lucide-react'
import type { StatusTone } from '../../types'
import type {
  BusinessRuleType,
  FeatureAutomationMode,
  FeatureScope,
  FeatureType,
  GuardrailStatus,
  IntegrationReadiness,
  MvpDesignStatus,
  QualityCheckSeverity,
  ScreenType,
} from '../../types/mvpDesign'
import { TONE_BADGE_CLASS } from '../../lib/statusMeta'
import {
  AUTOMATION_MODE_META,
  BUSINESS_RULE_TYPE_META,
  FEATURE_SCOPE_META,
  FEATURE_TYPE_META,
  GUARDRAIL_STATUS_META,
  INTEGRATION_READINESS_META,
  MVP_DESIGN_STATUS_META,
  QUALITY_SEVERITY_META,
  SCREEN_TYPE_META,
} from '../../lib/mvpDesignMeta'

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

export function DesignStatusBadge({ status }: { status: MvpDesignStatus }) {
  const m = MVP_DESIGN_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} title={m.description} />
}

export function FeatureScopeBadge({ scope }: { scope: FeatureScope }) {
  const m = FEATURE_SCOPE_META[scope]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} title={m.description} />
}

export function FeatureTypeBadge({ type }: { type: FeatureType }) {
  const m = FEATURE_TYPE_META[type]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}

export function AutomationModeBadge({ mode }: { mode: FeatureAutomationMode }) {
  const m = AUTOMATION_MODE_META[mode]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} title={m.description} />
}

export function ScreenTypeBadge({ type }: { type: ScreenType }) {
  const m = SCREEN_TYPE_META[type]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}

export function BusinessRuleTypeBadge({ type }: { type: BusinessRuleType }) {
  const m = BUSINESS_RULE_TYPE_META[type]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}

export function IntegrationReadinessBadge({ readiness }: { readiness: IntegrationReadiness }) {
  const m = INTEGRATION_READINESS_META[readiness]
  return <Badge tone={m.tone} label={m.label} />
}

export function GuardrailStatusBadge({ status }: { status: GuardrailStatus }) {
  const m = GUARDRAIL_STATUS_META[status]
  return <Badge tone={m.tone} label={m.label} />
}

export function QualitySeverityBadge({ severity }: { severity: QualityCheckSeverity }) {
  const m = QUALITY_SEVERITY_META[severity]
  return <Badge tone={m.tone} label={m.label} icon={m.icon} />
}
